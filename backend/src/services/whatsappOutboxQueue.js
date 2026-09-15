'use strict';

const { Op } = require('sequelize');
const { WhatsAppOutbox, Order, Customer, WhatsAppBatch } = require('../models');
const whatsappService = require('./whatsappService');
const whatsappRateLimiter = require('./whatsappRateLimiter');
const logger = require('../config/logger');

class WhatsAppOutboxQueue {
  constructor() {
    this.workerId = `worker-${process.pid}-${Math.random().toString(36).substring(2, 8)}`;
    this.workerTimer = null;
    this.isProcessing = false;
    this.pollIntervalMs = 3000; // Poll every 3 seconds

    // ── Circuit Breaker State (Account-level issues like zero AOC credits) ──────
    this.circuitBreakerOpen = false;
    this.circuitBreakerReason = null;
    this.circuitBreakerResetAt = null;
    this.lastCircuitLogAt = 0;
  }

  /**
   * Checks whether the circuit breaker is currently active
   */
  isCircuitBreakerActive() {
    if (!this.circuitBreakerOpen) return false;
    const now = Date.now();
    if (this.circuitBreakerResetAt && now >= this.circuitBreakerResetAt) {
      return false;
    }
    return true;
  }

  /**
   * Trips the circuit breaker for account-level issues (Zero AOC Gateway credit)
   */
  tripCircuitBreaker(reason = 'Insufficient credit on WhatsApp Gateway', cooldownMinutes = 15) {
    this.circuitBreakerOpen = true;
    this.circuitBreakerReason = reason;
    this.circuitBreakerResetAt = Date.now() + cooldownMinutes * 60 * 1000;

    const now = Date.now();
    if (now - this.lastCircuitLogAt > 300000) {
      this.lastCircuitLogAt = now;
      logger.warn(
        `🛑 [CIRCUIT BREAKER TRIPPED] WhatsApp Outbox paused for ${cooldownMinutes} minutes. ` +
        `Reason: "${reason}". Resumes at ${new Date(this.circuitBreakerResetAt).toISOString()}.`
      );
    }
  }

  /**
   * Resets the circuit breaker
   */
  resetCircuitBreaker() {
    this.circuitBreakerOpen = false;
    this.circuitBreakerReason = null;
    this.circuitBreakerResetAt = null;
    logger.info('✅ [CIRCUIT BREAKER RESET] WhatsApp Outbox circuit breaker closed. Resuming normal dispatch.');
  }

  /**
   * Returns current health & circuit breaker metrics
   */
  getStatus() {
    return {
      worker_id: this.workerId,
      circuit_breaker_open: this.isCircuitBreakerActive(),
      reason: this.circuitBreakerReason,
      resumes_at: this.circuitBreakerResetAt ? new Date(this.circuitBreakerResetAt).toISOString() : null,
      is_processing: this.isProcessing,
    };
  }

  /**
   * Fast non-blocking enqueue for a single message
   */
  async enqueue({
    order_id = null,
    customer_id = null,
    batch_id = null,
    recipient_phone,
    template_name,
    payload = {},
    idempotency_key = null,
  }, options = {}) {
    if (!recipient_phone || !template_name) {
      throw new Error('recipient_phone and template_name are required for WhatsApp Outbox.');
    }

    const txOpts = options.transaction ? { transaction: options.transaction } : {};

    if (idempotency_key) {
      const existing = await WhatsAppOutbox.findOne({ where: { idempotency_key }, ...txOpts });
      if (existing) {
        if (['failed', 'FAILED', 'stale', 'dead_letter'].includes(existing.status)) {
          await existing.update({
            status: 'QUEUED',
            attempts: 0,
            attempt_count: 0,
            last_error: null,
            failure_code: null,
            failure_reason: null,
            failed_at: null,
            next_attempt_at: new Date(),
          }, txOpts);
        }
        return existing;
      }
    }

    const now = new Date();
    return await WhatsAppOutbox.create({
      order_id,
      customer_id,
      batch_id,
      recipient_phone,
      template_name,
      payload,
      idempotency_key,
      status: 'QUEUED',
      queued_at: now,
      attempt_count: 0,
      attempts: 0,
      next_attempt_at: now,
    }, txOpts);
  }

  /**
   * Bulk enqueue for batches
   */
  async bulkEnqueue(items = []) {
    if (!items || items.length === 0) return [];
    return await WhatsAppOutbox.bulkCreate(items, {
      ignoreDuplicates: true,
      validate: true,
    });
  }

  /**
   * Dispatches a single outbox message via whatsappService
   */
  async dispatchMessage(item) {
    const WhatsAppMessageService = require('./whatsapp/whatsappMessageService');

    if (item.template_name === 'text_message') {
      return await WhatsAppMessageService.sendText({
        to: item.recipient_phone,
        text: item.payload?.message || item.payload?.text || '',
      });
    }

    let components = item.payload?.components || [];
    if (!components.length) {
      components = this.buildCanonicalComponents(item.template_name, item.payload || {});
    }

    return await WhatsAppMessageService.sendTemplate({
      to: item.recipient_phone,
      templateName: item.template_name,
      components,
      payload: item.payload || {},
      idempotencyKey: item.idempotency_key,
    });
  }

  /**
   * Builds standard components for canonical CRM templates when not pre-packaged
   */
  buildCanonicalComponents(templateName, payload) {
    const custName = payload.customer_name || 'Valued Customer';
    const orderNum = payload.order_number || String(payload.order_id || 'N/A');
    const prodName = payload.product_name || 'AquaBeat Water Purifier';

    switch (templateName) {
      case 'order_verification_interactive':
        return [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: custName },
              { type: 'text', text: orderNum },
              { type: 'text', text: prodName },
              { type: 'text', text: payload.product_sku || 'AKU-WTR-PREM-01' },
            ],
          },
        ];
      case 'warranty_activated':
        return [
          {
            type: 'header',
            parameters: [{ type: 'text', text: custName }],
          },
        ];
      case 'warranty_claim': {
        const qrCodeUrl = payload.qr_code_url || (payload.activation_url
          ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(payload.activation_url)}`
          : 'https://akuabeat.com/logo.png');
        return [
          {
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { link: qrCodeUrl },
              },
            ],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: custName },
              { type: 'text', text: prodName },
              { type: 'text', text: orderNum },
            ],
          },
          ...(payload.activation_url ? [{
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: payload.activation_url }],
          }] : []),
        ];
      }
      case 'installation_guide':
        return [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: custName },
              { type: 'text', text: prodName },
              { type: 'text', text: orderNum },
            ],
          },
        ];
      case 'order_deliverd':
        return [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: custName },
              { type: 'text', text: orderNum },
            ],
          },
        ];
      case 'order_confirmation':
      case 'order_cancelled':
        return [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: custName },
              { type: 'text', text: orderNum },
              { type: 'text', text: prodName },
            ],
          },
        ];
      case 'order_confirmation013':
        return [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: custName },
              { type: 'text', text: orderNum },
              { type: 'text', text: prodName },
              { type: 'text', text: payload.product_sku || 'AKU-WTR-PREM-01' },
              { type: 'text', text: String(payload.quantity || 1) },
              { type: 'text', text: String(payload.total_amount || payload.amount || '0') },
            ],
          },
        ];
      case 'order_dispatched':
        return [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: custName },
              { type: 'text', text: orderNum },
              { type: 'text', text: payload.tracking_number || 'N/A' },
              { type: 'text', text: payload.shipping_partner || payload.carrier || 'Courier' },
            ],
          },
        ];
      case 'screenshot_from_customer':
        return [];
      default:
        return [];
    }
  }

  /**
   * Process a single outbox item with transient vs permanent failure classification
   */
  async processItem(item) {
    try {
      const result = await this.dispatchMessage(item);

      if (result && result.success === false) {
        throw new Error(result.error || 'WhatsApp message dispatch failed without explicit exception.');
      }

      // Successful send: mark PROVIDER_ACCEPTED, clear locks, record provider message ID
      const providerMsgId =
        result?.providerMessageId ||
        result?.messageId ||
        result?.messages?.[0]?.id ||
        result?.data?.[0]?.messageId ||
        null;
      const providerName =
        result?.provider ||
        process.env.WHATSAPP_PROVIDER ||
        'aoc';

      const now = new Date();
      await item.update({
        status: 'sent',
        sent_at: now,
        accepted_at: now,
        provider: providerName,
        provider_message_id: providerMsgId,
        attempt_count: (item.attempt_count || item.attempts || 0) + 1,
        attempts: (item.attempts || 0) + 1,
        worker_id: null,
        locked_at: null,
        last_error: null,
        error_category: null,
      });

      // Update parent batch progress
      if (item.batch_id) {
        const whatsappBatchService = require('./whatsappBatchService');
        whatsappBatchService.updateBatchProgress(item.batch_id).catch(() => {});
      }

      // Record in WhatsAppLog table for conversation history and CRM audit trail
      try {
        const { WhatsAppLog, Order } = require('../models');
        await WhatsAppLog.create({
          phone_number: item.recipient_phone,
          order_id: item.order_id || null,
          customer_id: item.customer_id || null,
          batch_id: item.batch_id || null,
          message_type: item.template_name === 'text_message' ? 'text' : 'template',
          template_name: item.template_name,
          direction: 'outbound',
          status: 'sent',
          wa_message_id: providerMsgId,
          sent_at: now,
          payload: item.payload,
          retry_count: item.attempts || 0,
          estimated_cost: 0.35,
          cost_currency: 'INR',
        });

        // Update Order milestone timestamps upon actual dispatch acceptance
        if (item.order_id) {
          const orderUpdates = {};
          if (
            item.template_name === 'order_verification_interactive' ||
            item.template_name === 'order_verification'
          ) {
            orderUpdates.confirmation_message_sent_at = now;
            orderUpdates.whatsapp_confirmation_sent = true;
          } else if (item.template_name === 'order_confirmation013') {
            orderUpdates.second_message_sent_at = now;
            orderUpdates.final_confirmation_sent_at = now;
          } else if (item.template_name === 'order_confirmation') {
            orderUpdates.confirmation_message_sent_at = now;
            orderUpdates.whatsapp_confirmation_sent = true;
          }

          if (Object.keys(orderUpdates).length > 0) {
            await Order.update(orderUpdates, { where: { id: item.order_id } });
          }
        }
      } catch (auditErr) {
        logger.warn(`[Outbox] Audit record update notice: ${auditErr.message}`);
      }

      return { success: true, item, circuitTripped: false };
    } catch (err) {
      const errMsg = err.message || String(err);
      const isEmergencyPause = err.isEmergencyPause || errMsg.includes('WHATSAPP_SENDING_PAUSED');

      // ── Handle Global Pause mid-send ─────────────────────────────────────────
      if (isEmergencyPause) {
        await item.update({
          status: 'paused',
          worker_id: null,
          locked_at: null,
          last_error: 'WHATSAPP_SENDING_PAUSED: Outbox processing paused via Emergency Kill Switch.',
        });
        return { success: false, error: err, isEmergencyPause: true };
      }

      // ── Handle Zero Gateway Credit Circuit Breaker ───────────────────────────
      const isInsufficientCredit =
        errMsg.toLowerCase().includes('insufficient credit') ||
        errMsg.toLowerCase().includes('payment required') ||
        errMsg.includes('402');

      if (isInsufficientCredit) {
        this.tripCircuitBreaker(errMsg, 15);
        await item.update({
          status: 'pending',
          worker_id: null,
          locked_at: null,
          last_error: errMsg,
          error_category: 'CIRCUIT_BREAKER_CREDIT',
          next_attempt_at: new Date(Date.now() + 15 * 60 * 1000),
        });
        return { success: false, error: err, circuitTripped: true };
      }

      // ── Classify Failure: Permanent vs Transient ─────────────────────────────
      const isPermanent =
        err.metaErrorCode === 131026 ||
        err.metaErrorCode === 132000 ||
        err.metaErrorCode === 132001 ||
        err.metaErrorCode === 100 ||
        errMsg.includes('131026') || // Message undeliverable / invalid WhatsApp recipient
        errMsg.includes('132000') || // Template does not exist
        errMsg.includes('132001') || // Template parameters count mismatch
        errMsg.includes('100') ||    // Invalid parameter
        errMsg.toLowerCase().includes('undeliverable') ||
        errMsg.toLowerCase().includes('not a valid whatsapp') ||
        errMsg.toLowerCase().includes('invalid phone') ||
        errMsg.toLowerCase().includes('opted out');

      const isRateLimit =
        errMsg.includes('429') ||
        errMsg.includes('130429') ||
        errMsg.includes('131056') ||
        errMsg.includes('80007') ||
        errMsg.includes('130428') ||
        errMsg.toLowerCase().includes('rate limit');

      const nextAttempts = (item.attempts || 0) + 1;
      const jitter = Math.floor(Math.random() * 3000); // 0-3s jitter

      if (isPermanent) {
        // Permanent failure: DO NOT retry. Mark failed immediately.
        await item.update({
          attempts: nextAttempts,
          status: 'failed',
          error_category: 'PERMANENT_FAILURE',
          last_error: errMsg,
          worker_id: null,
          locked_at: null,
        });

        if (item.batch_id) {
          const whatsappBatchService = require('./whatsappBatchService');
          whatsappBatchService.updateBatchProgress(item.batch_id).catch(() => {});
        }

        logger.warn(`WhatsApp Outbox item ${item.id} permanently failed (no retries scheduled): ${errMsg}`);
        return { success: false, error: err, permanent: true };
      }

      if (isRateLimit) {
        // Transient Rate Limit: Notify shared limiter to back off
        await whatsappRateLimiter.reportProviderThrottle({
          errorCode: 429,
          errorMessage: errMsg,
          workerId: this.workerId,
          batchId: item.batch_id,
          outboxId: item.id,
        });

        const backoffSec = Math.min(300, 15 * Math.pow(2, Math.min(nextAttempts - 1, 4))) + Math.ceil(jitter / 1000);
        const nextAttemptAt = new Date(Date.now() + backoffSec * 1000);
        const isExhausted = nextAttempts >= item.max_attempts;

        await item.update({
          attempts: nextAttempts,
          status: isExhausted ? 'failed' : 'pending',
          error_category: 'TRANSIENT_RATE_LIMIT',
          last_error: errMsg,
          next_attempt_at: nextAttemptAt,
          worker_id: null,
          locked_at: null,
        });

        if (item.batch_id) {
          const whatsappBatchService = require('./whatsappBatchService');
          whatsappBatchService.updateBatchProgress(item.batch_id).catch(() => {});
        }

        return { success: false, error: err, isRateLimit: true, waitMs: backoffSec * 1000 };
      }

      // Other Transient Errors (Network timeout, 500, 502, 503)
      const backoffSec = Math.min(1800, Math.pow(2, nextAttempts) * 10) + Math.ceil(jitter / 1000);
      const nextAttemptAt = new Date(Date.now() + backoffSec * 1000);
      const isFailed = nextAttempts >= item.max_attempts;

      await item.update({
        attempts: nextAttempts,
        status: isFailed ? 'failed' : 'pending',
        error_category: 'TRANSIENT_NETWORK',
        last_error: errMsg,
        next_attempt_at: nextAttemptAt,
        worker_id: null,
        locked_at: null,
      });

      if (item.batch_id) {
        const whatsappBatchService = require('./whatsappBatchService');
        whatsappBatchService.updateBatchProgress(item.batch_id).catch(() => {});
      }

      logger.warn(`WhatsApp Outbox item ${item.id} attempt ${nextAttempts} failed: ${errMsg}. Next attempt: ${nextAttemptAt.toISOString()}`);
      return { success: false, error: err, circuitTripped: false };
    }
  }

  /**
   * Self-healing: Recovers orphan items locked by crashed workers (> 5 minutes ago)
   */
  async recoverOrphanLocks() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const [recoveredCount] = await WhatsAppOutbox.update(
        {
          status: 'pending',
          worker_id: null,
          locked_at: null,
        },
        {
          where: {
            status: 'processing',
            locked_at: { [Op.lt]: fiveMinutesAgo },
          },
        }
      );
      if (recoveredCount > 0) {
        logger.info(`🔄 [OUTBOX RECOVERY] Reset ${recoveredCount} stuck processing item(s) to 'pending'.`);
      }
    } catch (e) {
      logger.debug('Orphan lock recovery notice:', e.message);
    }
  }

  /**
   * Background batch consumer with Atomic Multi-Worker Claiming and Rate Limiting
   */
  async processQueue(batchLimit = 30) {
    if (this.isProcessing) return;

    // Check Global Emergency Pause
    const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
    if (!(await isWhatsAppSendingEnabled())) {
      return;
    }

    // Check Circuit Breaker
    if (this.isCircuitBreakerActive()) {
      return;
    }

    // Check Provider Throttle Window
    const throttleCheck = await whatsappRateLimiter.isProviderThrottled();
    if (throttleCheck.throttled) {
      return;
    }

    this.isProcessing = true;
    try {
      // Periodically recover orphan locks
      await this.recoverOrphanLocks();

      const now = new Date();
      // 1. Find candidate pending items
      const candidates = await WhatsAppOutbox.findAll({
        where: {
          status: { [Op.in]: ['QUEUED', 'pending'] },
          next_attempt_at: { [Op.lte]: now },
        },
        order: [['next_attempt_at', 'ASC']],
        limit: batchLimit,
      });

      if (candidates.length === 0) {
        this.isProcessing = false;
        return;
      }

      for (const candidate of candidates) {
        // Stop immediately if Kill Switch engaged or Circuit Breaker tripped
        if (!(await isWhatsAppSendingEnabled()) || this.isCircuitBreakerActive()) {
          break;
        }

        // 2. ATOMIC CLAIM: Update status to 'processing' with this worker's ID
        const [claimedCount] = await WhatsAppOutbox.update(
          {
            status: 'processing',
            worker_id: this.workerId,
            locked_at: new Date(),
          },
          {
            where: {
              id: candidate.id,
              status: { [Op.in]: ['QUEUED', 'pending', 'queued'] },
              next_attempt_at: { [Op.lte]: new Date() },
            },
          }
        );

        if (claimedCount === 0) {
          // Another worker claimed this item or it was cancelled/updated in the meantime
          continue;
        }

        // Reload fresh item
        const item = await WhatsAppOutbox.findByPk(candidate.id);
        if (!item) continue;

        // 3. RATE LIMIT TOKEN ACQUISITION
        const token = await whatsappRateLimiter.acquireSendToken({
          workerId: this.workerId,
          messageType: item.template_name,
          batchId: item.batch_id,
        });

        if (!token.allowed) {
          // Rate limit or throttle active: Release item back to pending with delay
          const delayMs = Math.max(token.waitMs || 2000, 2000);
          await item.update({
            status: token.isEmergencyPause ? 'paused' : 'pending',
            worker_id: null,
            locked_at: null,
            next_attempt_at: new Date(Date.now() + delayMs),
          });

          // Yield execution for this tick
          break;
        }

        // 4. DISPATCH ITEM
        const res = await this.processItem(item);
        if (res?.circuitTripped || res?.isRateLimit || res?.isEmergencyPause) {
          break;
        }
      }
    } catch (queueErr) {
      logger.error('WhatsApp Outbox queue processing error:', queueErr);
    } finally {
      this.isProcessing = false;
    }
  }

  async processPendingMessages(batchLimit = 50) {
    return this.processQueue(batchLimit);
  }

  /**
   * Actively drains pending messages in outbox in rapid succession
   * until all pending items are dispatched or throttled.
   */
  async drainQueue(maxIterations = 60, batchLimit = 50) {
    const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
    for (let i = 0; i < maxIterations; i++) {
      if (!(await isWhatsAppSendingEnabled()) || this.isCircuitBreakerActive()) {
        break;
      }
      const pendingCount = await WhatsAppOutbox.count({
        where: {
          status: { [Op.in]: ['QUEUED', 'pending', 'queued'] },
          next_attempt_at: { [Op.lte]: new Date() },
        },
      });
      if (pendingCount === 0) break;

      // Wait if another worker tick is momentarily running
      let waitLoops = 0;
      while (this.isProcessing && waitLoops < 20) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        waitLoops++;
      }

      await this.processQueue(batchLimit);
      if (this.isCircuitBreakerActive()) break;
      // Brief pause between chunks to respect rate limiter
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  async startWorker(intervalMs = 3000) {
    if (this.workerTimer) return;
    this.pollIntervalMs = intervalMs;

    // Startup self-healing
    await this.recoverOrphanLocks();

    this.workerTimer = setInterval(() => {
      this.processQueue().catch((e) => logger.error('Outbox worker tick error:', e));
    }, this.pollIntervalMs);
    logger.info(`WhatsApp Outbox Queue Worker [${this.workerId}] started (polling every ${intervalMs}ms).`);
  }

  stopWorker() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
      logger.info(`WhatsApp Outbox Queue Worker [${this.workerId}] stopped.`);
    }
  }
}

module.exports = new WhatsAppOutboxQueue();
