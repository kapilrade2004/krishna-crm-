'use strict';

const { Op } = require('sequelize');
const { Order, Customer, OrderActivity } = require('../models');
const whatsappService = require('./whatsappService');
const whatsappOutboxQueue = require('./whatsappOutboxQueue');
const OrderVerificationWorkflowService = require('./orderVerificationWorkflowService');
const logger = require('../config/logger');

let workerTimer = null;
let isProcessing = false;

/**
 * Process all orders that have completed the 15-minute screenshot verification countdown.
 */
async function processOrderVerificationQueue() {
  // Automatic background dispatch active by default
  if (process.env.DISABLE_WHATSAPP_WORKER === 'true') {
    return { processed: 0, skipped: 0, mode: 'worker_disabled' };
  }

  // Check Global WhatsApp Sending Kill Switch before doing any work
  const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
  if (!(await isWhatsAppSendingEnabled())) {
    logger.debug('Order verification worker: Global WhatsApp sending is paused. Skipping tick.');
    return { processed: 0, skipped: 0, reason: 'whatsapp_sending_paused' };
  }

  // Check Circuit Breaker before doing any work
  if (whatsappOutboxQueue.isCircuitBreakerActive()) {
    logger.debug('Order verification worker: WhatsApp gateway circuit breaker active. Skipping tick.');
    return { processed: 0, skipped: 0, reason: 'circuit_breaker_active' };
  }

  if (isProcessing) {
    logger.debug('Order verification worker: Previous run still active. Skipping tick.');
    return { processed: 0, skipped: 0 };
  }

  isProcessing = true;
  let processed = 0;
  let skipped = 0;

  try {
    const now = new Date();

    // Phase 1: Query candidates who requested screenshot but 15-minute deadline passed WITHOUT receiving any image
    const candidates = await Order.findAll({
      where: {
        [Op.or]: [
          { workflow_state: 'SCREENSHOT_REQUESTED' },
          { verification_status: 'screenshot_requested' },
        ],
        screenshot_received_at: null,
        second_message_sent_at: null,
        [Op.and]: [
          {
            [Op.or]: [
              { screenshot_deadline_at: { [Op.lte]: now, [Op.ne]: null } },
              { second_message_due_at: { [Op.lte]: now, [Op.ne]: null } },
            ],
          },
        ],
        status: {
          [Op.notIn]: ['confirmed', 'cancelled', 'dispatched', 'delivered', 'returned', 'refunded'],
        },
      },
      include: [
        { model: Customer, as: 'customer' },
      ],
      order: [['second_message_due_at', 'ASC']],
      limit: 50,
    });

    if (candidates.length > 0) {
      logger.info(`Order verification worker: Found ${candidates.length} candidate(s) ready for Message 2 timeout dispatch.`);
    }

    for (const order of candidates) {
      // Check circuit breaker mid-loop
      if (whatsappOutboxQueue.isCircuitBreakerActive()) {
        break;
      }

      try {
        const timeoutRes = await OrderVerificationWorkflowService.handleScreenshotTimeout(order.id);
        if (timeoutRes.success) {
          logger.info(`Successfully dispatched Message 2 timeout for Order #${order.order_number || order.id}`);
          processed++;
        } else {
          logger.debug(`Skipped Message 2 timeout for Order #${order.order_number || order.id}: ${timeoutRes.reason || timeoutRes.message}`);
          skipped++;
        }
      } catch (orderErr) {
        const isInsufficientCredit =
          Boolean(orderErr.isInsufficientCredit) ||
          /insufficient\s*(credit|balance)|out\s*of\s*credit|balance\s*low|payment\s*required/i.test(orderErr.message || '');

        if (isInsufficientCredit) {
          whatsappOutboxQueue.tripCircuitBreaker(orderErr.message, 15);
          skipped++;
          break;
        }

        logger.error(`Failed to process screenshot timeout for Order #${order.order_number}:`, orderErr.message);
        skipped++;
      }
    }

    // ── Phase 2: Process Expired Final Confirmation Timeouts (Sections 17, 18, 68) ──
    const expiredFinalCandidates = await Order.findAll({
      where: {
        final_confirmation_due_at: {
          [Op.ne]: null,
          [Op.lte]: now,
        },
        status: {
          [Op.in]: ['pending_confirmation', 'image_verification', 'pending'],
        },
        customer_confirmed_at: null,
      },
      include: [
        { model: Customer, as: 'customer' },
      ],
      order: [['final_confirmation_due_at', 'ASC']],
      limit: 50,
    });

    if (expiredFinalCandidates.length > 0) {
      logger.info(`Order verification worker: Found ${expiredFinalCandidates.length} order(s) with expired final confirmation deadline.`);
    }

    for (const order of expiredFinalCandidates) {
      try {
        const cancelRes = await OrderVerificationWorkflowService.handleFinalConfirmationTimeout(order.id);
        if (cancelRes.success) {
          logger.info(`Successfully auto-cancelled timed-out Order #${order.order_number || order.id}`);
          processed++;
        } else {
          skipped++;
        }
      } catch (err) {
        logger.error(`Error processing final confirmation timeout for Order #${order.order_number}:`, err.message);
        skipped++;
      }
    }

    return { processed, skipped };
  } catch (err) {
    logger.error('Error during processOrderVerificationQueue:', err);
    return { processed, skipped, error: err.message };
  } finally {
    isProcessing = false;
  }
}

/**
 * Start recurring queue runner
 */
function startOrderVerificationWorker(intervalMs = 60000) {
  if (workerTimer) {
    logger.warn('Order verification worker is already running.');
    return;
  }

  logger.info(`🚀 Starting Order 15-Minute Verification Worker (Interval: ${intervalMs / 1000}s)...`);

  // Initial tick after 5s
  setTimeout(() => {
    processOrderVerificationQueue().catch(err => {
      logger.error('Order verification worker initial tick failed:', err);
    });
  }, 5000);

  workerTimer = setInterval(() => {
    processOrderVerificationQueue().catch(err => {
      logger.error('Order verification worker tick error:', err);
    });
  }, intervalMs);
}

/**
 * Graceful shutdown
 */
function stopOrderVerificationWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    logger.info('🛑 Stopped Order 15-Minute Verification Worker.');
  }
}

module.exports = {
  processOrderVerificationQueue,
  startOrderVerificationWorker,
  stopOrderVerificationWorker,
};
