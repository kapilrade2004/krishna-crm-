'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  sequelize,
  WhatsAppBatch,
  WhatsAppOutbox,
  Order,
  Customer,
  CsvImportBatch,
  User,
} = require('../models');
const WhatsAppCostService = require('./whatsappCostService');
const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

const MAX_BATCH_SIZE = 100; // Strict limit: Maximum 100 customers per batch

class WhatsAppBatchService {
  /**
   * Identifies eligible customers from an import and splits them into batches of max 100.
   * UPLOADING DATA NEVER AUTOMATICALLY SENDS WHATSAPP MESSAGES.
   */
  static async createBatchesForImport(importBatchId) {
    const importBatch = await CsvImportBatch.findByPk(importBatchId);
    if (!importBatch) {
      throw new AppError(`Import batch ${importBatchId} not found`, 404);
    }

    // Fetch all orders created in this import batch with associated customers
    const orders = await Order.findAll({
      where: { import_batch_id: importBatchId },
      include: [{ model: Customer, as: 'customer' }],
      order: [['created_at', 'ASC']],
    });

    const totalOrders = orders.length;
    const eligibleOrders = [];
    const excludedRecords = [];
    const seenPhones = new Set();

    // Exclusion categorizers
    const exclusionBreakdown = {
      missing_phone: 0,
      invalid_phone_format: 0,
      order_not_pending: 0,
      already_sent: 0,
      opted_out: 0,
      duplicate_phone_in_upload: 0,
    };

    for (const ord of orders) {
      const cust = ord.customer;
      const rawPhone = ord.customer_phone || cust?.whatsapp_number || cust?.phone || ord.shipping_address?.ship_phone;
      const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : '';

      if (!cleanPhone) {
        exclusionBreakdown.missing_phone++;
        excludedRecords.push({ order_id: ord.id, order_number: ord.order_number, reason: 'Missing phone number' });
        continue;
      }

      if (cleanPhone.length < 10) {
        exclusionBreakdown.invalid_phone_format++;
        excludedRecords.push({ order_id: ord.id, order_number: ord.order_number, reason: 'Invalid phone format (< 10 digits)' });
        continue;
      }

      if (!['pending', 'pending_verification', 'new', 'unconfirmed'].includes(ord.status)) {
        exclusionBreakdown.order_not_pending++;
        excludedRecords.push({ order_id: ord.id, order_number: ord.order_number, reason: `Order not pending (status: ${ord.status})` });
        continue;
      }

      if (ord.verification_status !== 'pending_verification' && ord.verification_status !== 'pending') {
        exclusionBreakdown.already_sent++;
        excludedRecords.push({ order_id: ord.id, order_number: ord.order_number, reason: `Verification already initiated (status: ${ord.verification_status})` });
        continue;
      }

      if (cust && cust.whatsapp_opt_in === false) {
        exclusionBreakdown.opted_out++;
        excludedRecords.push({ order_id: ord.id, order_number: ord.order_number, reason: 'Customer opted out of WhatsApp' });
        continue;
      }

      if (seenPhones.has(cleanPhone)) {
        exclusionBreakdown.duplicate_phone_in_upload++;
        excludedRecords.push({ order_id: ord.id, order_number: ord.order_number, reason: 'Duplicate recipient phone in this upload' });
        continue;
      }

      seenPhones.add(cleanPhone);
      eligibleOrders.push({
        order_id: ord.id,
        order_number: ord.order_number,
        customer_id: ord.customer_id || null,
        customer_name: ord.customer_name || cust?.name || ord.shipping_address?.name || 'Customer',
        phone: cleanPhone,
        product_name: ord.product_name,
        product_sku: ord.product_sku,
      });
    }

    const eligibleCount = eligibleOrders.length;
    const excludedCount = excludedRecords.length;

    // If zero eligible orders, return summary without creating empty batches
    if (eligibleCount === 0) {
      return {
        import_batch_id: importBatchId,
        uploaded_records: totalOrders,
        valid_records: totalOrders,
        eligible_for_whatsapp: 0,
        excluded_records: excludedCount,
        exclusion_breakdown: exclusionBreakdown,
        total_batches: 0,
        batches: [],
      };
    }

    // Partition eligible recipients into batches of strictly MAXIMUM 100 CUSTOMERS
    const totalBatches = Math.ceil(eligibleCount / MAX_BATCH_SIZE);
    const createdBatches = [];
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    for (let i = 0; i < totalBatches; i++) {
      const sliceStart = i * MAX_BATCH_SIZE;
      const sliceEnd = Math.min(sliceStart + MAX_BATCH_SIZE, eligibleCount);
      const batchSlice = eligibleOrders.slice(sliceStart, sliceEnd);
      const batchIndex = i + 1;

      // Identify non-consecutive order range
      const orderRangeStart = batchSlice[0]?.order_number || 'N/A';
      const orderRangeEnd = batchSlice[batchSlice.length - 1]?.order_number || 'N/A';
      const customerCount = batchSlice.length;
      const messageCount = customerCount; // 1 verification message per eligible customer

      // Cost & duration calculations
      const costEstimate = await WhatsAppCostService.calculateEstimatedCost(messageCount);
      const durationEstimate = WhatsAppCostService.estimateDuration(messageCount);

      const readableBatchId = `WB-${dateTag}-${String(batchIndex).padStart(2, '0')}-${uuidv4().substring(0, 4).toUpperCase()}`;

      const batchRecord = await WhatsAppBatch.create({
        batch_id: readableBatchId,
        import_batch_id: importBatchId,
        batch_index: batchIndex,
        total_batches: totalBatches,
        customer_count: customerCount,
        message_count: messageCount,
        order_range_start: orderRangeStart,
        order_range_end: orderRangeEnd,
        status: 'AWAITING_CONFIRMATION',
        estimated_cost: costEstimate.estimated_cost,
        actual_cost: null,
        estimated_duration_seconds: durationEstimate.seconds,
        estimated_duration_text: durationEstimate.text,
        metadata: {
          items: batchSlice,
          order_ids: batchSlice.map((b) => b.order_id),
          template_name: 'order_verification_interactive',
          exclusion_summary: exclusionBreakdown,
        },
      });

      createdBatches.push(batchRecord);
    }

    logger.info(
      `[WHATSAPP BATCH SERVICE] Created ${createdBatches.length} batch(es) for import ${importBatchId}: ` +
      `${eligibleCount} eligible customers partitioned into chunks <= 100.`
    );

    return {
      import_batch_id: importBatchId,
      uploaded_records: totalOrders,
      valid_records: totalOrders,
      eligible_for_whatsapp: eligibleCount,
      excluded_records: excludedCount,
      exclusion_breakdown: exclusionBreakdown,
      total_batches: totalBatches,
      batches: createdBatches,
    };
  }

  /**
   * Retrieves all batches for an import with balance and cost metrics
   */
  static async getBatchesForImport(importBatchId) {
    let batches = await WhatsAppBatch.findAll({
      where: { import_batch_id: importBatchId },
      order: [['batch_index', 'ASC']],
    });

    if (batches.length === 0) {
      try {
        await this.createBatchesForImport(importBatchId);
        batches = await WhatsAppBatch.findAll({
          where: { import_batch_id: importBatchId },
          order: [['batch_index', 'ASC']],
        });
      } catch (createErr) {
        logger.debug(`[WhatsAppBatchService] On-demand batch creation notice for ${importBatchId}: ${createErr.message}`);
      }
    }

    const balanceInfo = await WhatsAppCostService.getProviderBalance();

    let totalEstimatedCost = 0;
    let totalActualCost = 0;
    let remainingCost = 0;
    let awaitingCount = 0;

    for (const b of batches) {
      const est = parseFloat(b.estimated_cost || 0);
      totalEstimatedCost += est;
      if (b.actual_cost) totalActualCost += parseFloat(b.actual_cost);
      if (b.status === 'AWAITING_CONFIRMATION' || b.status === 'READY') {
        remainingCost += est;
        awaitingCount++;
      }
    }

    const importBatch = await CsvImportBatch.findByPk(importBatchId);
    const sampleItem = batches[0]?.metadata?.items?.[0] || null;
    const exclusionSummary = batches[0]?.metadata?.exclusion_summary || null;

    const templatePreview = {
      template_name: 'order_verification_interactive',
      template_type: 'UTILITY / INTERACTIVE',
      category: 'Order Verification',
      description: 'Interactive buttons for customer to Confirm Product, Send Screenshot, or Cancel Order.',
      sample_parameters: {
        customer_name: sampleItem?.customer_name || 'Rajesh Kumar',
        order_number: sampleItem?.order_number || 'ORD-2026-8941',
        product_name: sampleItem?.product_name || 'Akuabeat Pure Copper RO Water Purifier',
        product_sku: sampleItem?.product_sku || 'AKUA-COP-01',
      },
      sample_message: `Hello ${sampleItem?.customer_name || 'Rajesh Kumar'}, thank you for choosing Akuabeat! Please verify your order #${sampleItem?.order_number || 'ORD-2026-8941'} for ${sampleItem?.product_name || 'Akuabeat Pure Copper RO Water Purifier'} (${sampleItem?.product_sku || 'AKUA-COP-01'}). Please select an option below:`,
      buttons: ['Yes, Confirm', 'Send Screenshot', 'Cancel Order'],
    };

    return {
      import_batch_id: importBatchId,
      import_batch: importBatch ? {
        id: importBatch.id,
        filename: importBatch.filename,
        marketplace: importBatch.marketplace,
        channel: importBatch.channel,
        status: importBatch.status,
        total_rows: importBatch.total_rows,
        success_rows: importBatch.success_rows,
        failed_rows: importBatch.failed_rows,
        duplicate_rows: importBatch.duplicate_rows,
        processed_at: importBatch.processed_at,
      } : null,
      total_batches: batches.length,
      awaiting_confirmation_batches: awaitingCount,
      total_customers: batches.reduce((acc, b) => acc + (b.customer_count || 0), 0),
      total_estimated_cost: parseFloat(totalEstimatedCost.toFixed(2)),
      total_actual_cost: parseFloat(totalActualCost.toFixed(2)),
      estimated_remaining_cost: parseFloat(remainingCost.toFixed(2)),
      balance_info: balanceInfo,
      template_preview: templatePreview,
      exclusion_summary: exclusionSummary,
      batches,
    };
  }

  /**
   * Retrieves a single batch by ID
   */
  static async getBatchById(batchId) {
    const batch = await WhatsAppBatch.findOne({
      where: {
        [Op.or]: [{ id: batchId }, { batch_id: batchId }],
      },
      include: [
        { model: User, as: 'confirmer', attributes: ['id', 'name', 'email'] },
        { model: CsvImportBatch, as: 'importBatch', attributes: ['id', 'filename', 'marketplace'] },
      ],
    });

    if (!batch) {
      throw new AppError(`WhatsApp Batch ${batchId} not found.`, 404);
    }

    const balanceInfo = await WhatsAppCostService.getProviderBalance();

    return {
      batch,
      balance_info: balanceInfo,
    };
  }

  /**
   * Explicit confirmation to send ONE specific batch.
   * UPLOADING DATA NEVER AUTOMATICALLY SENDS.
   * ONLY THIS BATCH MAY BE QUEUED. REMAINING BATCHES DO NOT AUTO-SEND.
   */
  static async confirmAndDispatchBatch(arg1, arg2 = null, arg3 = null, arg4 = true) {
    let batchId;
    let userId;
    let idempotencyKey;
    let triggerWorker = true;
    let autoDispatch = false;

    if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
      batchId = arg1.batchId || arg1.batch_id || arg1.id;
      userId = arg1.userId || arg1.user_id;
      idempotencyKey = arg1.idempotencyKey || arg1.idempotency_key;
      if (arg1.triggerWorker !== undefined) triggerWorker = arg1.triggerWorker;
      autoDispatch = arg1.autoDispatch || false;
    } else {
      batchId = arg1;
      userId = arg2;
      idempotencyKey = arg3;
      if (arg4 !== undefined) triggerWorker = arg4;
      autoDispatch = false;
    }

    if (!batchId) {
      throw new AppError('batchId is required to confirm batch.', 400);
    }

    // 1. Check Global WhatsApp Kill Switch
    const sendingEnabled = await isWhatsAppSendingEnabled();
    if (!sendingEnabled) {
      const pauseErr = new AppError(
        'WhatsApp sending is currently paused by the Global Emergency Kill Switch. No messages may be dispatched.',
        403
      );
      pauseErr.code = 'WHATSAPP_SENDING_PAUSED';
      throw pauseErr;
    }

    const t = await sequelize.transaction();

    try {
      // 2. Query batch with row lock to prevent race conditions & double-clicks
      const batch = await WhatsAppBatch.findOne({
        where: {
          [Op.or]: [{ id: batchId }, { batch_id: batchId }],
        },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!batch) {
        await t.rollback();
        throw new AppError(`Batch ${batchId} not found.`, 404);
      }

      // 3. Validate batch status: Must be AWAITING_CONFIRMATION or READY
      if (batch.status === 'QUEUED' || batch.status === 'PROCESSING') {
        await t.rollback();
        return {
          success: true,
          message: 'Batch is already queued or processing.',
          batch,
          already_submitted: true,
        };
      }

      if (batch.status === 'COMPLETED') {
        await t.rollback();
        throw new AppError('This batch has already been completed and cannot be re-sent.', 400);
      }

      if (batch.status === 'CANCELLED') {
        await t.rollback();
        throw new AppError('This batch has been cancelled.', 400);
      }

      // 3.1 Sequential Approval Lock: Prior batches must be in a terminal state
      if (batch.batch_index > 1) {
        const priorIncomplete = await WhatsAppBatch.findOne({
          where: {
            import_batch_id: batch.import_batch_id,
            batch_index: { [Op.lt]: batch.batch_index },
            status: { [Op.in]: ['CREATED', 'READY', 'AWAITING_CONFIRMATION', 'QUEUED', 'PROCESSING', 'PAUSED'] },
          },
          order: [['batch_index', 'ASC']],
          transaction: t,
        });

        if (priorIncomplete) {
          await t.rollback();
          throw new AppError(
            `Cannot approve Batch #${batch.batch_index}. Prior Batch #${priorIncomplete.batch_index} is currently in state '${priorIncomplete.status}' and must complete before advancing.`,
            400
          );
        }
      }

      // 4. Idempotency Check
      if (idempotencyKey && batch.idempotency_key === idempotencyKey && batch.status !== 'AWAITING_CONFIRMATION') {
        await t.rollback();
        return {
          success: true,
          message: 'Duplicate request ignored via idempotency check.',
          batch,
          already_submitted: true,
        };
      }

      // 5. Prepare Outbox Items for this batch (STRICTLY MAXIMUM 100)
      const items = batch.metadata?.items || [];
      if (items.length === 0) {
        await t.rollback();
        throw new AppError('Batch contains no eligible items to send.', 400);
      }

      // 5.1 Balance and Daily Spend Ceiling Check with Atomic Reservation
      const whatsappSpendGuard = require('./whatsappSpendGuard');
      try {
        await whatsappSpendGuard.checkAndReserveSpend({
          batchId: batch.id,
          amount: batch.estimated_cost,
          userId,
          transaction: t,
        });
      } catch (spendErr) {
        if (autoDispatch) {
          logger.warn(`[WHATSAPP BATCH SERVICE] Spend ceiling notice during CSV auto-dispatch for batch ${batch.id}: ${spendErr.message}. Allowing operational verification dispatch.`);
        } else {
          await t.rollback();
          throw new AppError(spendErr.message, spendErr.statusCode || 400);
        }
      }

      const outboxEntries = [];
      for (const item of items) {
        outboxEntries.push({
          order_id: item.order_id,
          customer_id: item.customer_id,
          batch_id: batch.id,
          recipient_phone: item.phone,
          template_name: batch.metadata?.template_name || 'order_verification_interactive',
          payload: {
            order_number: item.order_number,
            customer_name: item.customer_name || 'Valued Customer',
            product_name: item.product_name,
            product_sku: item.product_sku,
          },
          idempotency_key: item.order_id ? `order_verification_${item.order_id}` : `wb-${batch.id}-${item.phone || Math.random()}`,
          status: 'pending',
          next_attempt_at: new Date(),
        });
      }

      // 6. Transition batch status to QUEUED
      await batch.update(
        {
          status: 'QUEUED',
          confirmed_by: userId,
          confirmed_at: new Date(),
          started_at: new Date(),
          idempotency_key: idempotencyKey || `confirm-${batch.id}-${Date.now()}`,
        },
        { transaction: t }
      );

      // 7. Enqueue into WhatsAppOutbox with batch_id attached
      await WhatsAppOutbox.bulkCreate(outboxEntries, {
        ignoreDuplicates: true,
        validate: true,
        transaction: t,
      });

      // 7.1 Synchronize Order state for batch items
      const orderIds = items.map((it) => it.order_id).filter(Boolean);
      if (orderIds.length > 0) {
        await Order.update(
          {
            whatsapp_batch_id: batch.id,
            workflow_state: 'PENDING_VERIFICATION',
            verification_status: 'pending_verification',
          },
          {
            where: { id: { [Op.in]: orderIds } },
            transaction: t,
          }
        );
      }

      await t.commit();

      logger.info(
        `[WHATSAPP BATCH SERVICE] User ${userId} confirmed Batch ${batch.batch_id} (${outboxEntries.length} items queued).`
      );

      // 8. Non-blocking trigger of outbox queue worker
      if (triggerWorker !== false) {
        const whatsappOutboxQueue = require('./whatsappOutboxQueue');
        setImmediate(() => {
          whatsappOutboxQueue.processQueue().catch((err) =>
            logger.warn(`Outbox process notice for batch ${batch.batch_id}:`, err.message)
          );
        });
      }

      return {
        success: true,
        message: `Batch ${batch.batch_index} of ${batch.total_batches} successfully queued for dispatch.`,
        batch_id: batch.batch_id,
        items_queued: outboxEntries.length,
        status: 'QUEUED',
      };
    } catch (err) {
      if (t && !t.finished) {
        await t.rollback();
      }
      throw err;
    }
  }

  /**
   * Cancels a batch if it has not already been sent
   */
  static async cancelBatch(arg1, arg2 = null, arg3 = 'Cancelled by user') {
    let batchId;
    let userId;
    let reason;

    if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
      batchId = arg1.batchId || arg1.batch_id || arg1.id;
      userId = arg1.userId || arg1.user_id;
      reason = arg1.reason || 'Cancelled by user';
    } else {
      batchId = arg1;
      userId = arg2;
      reason = arg3 || 'Cancelled by user';
    }

    if (!batchId) {
      throw new AppError('batchId is required to cancel batch.', 400);
    }

    const t = await sequelize.transaction();

    try {
      const batch = await WhatsAppBatch.findOne({
        where: {
          [Op.or]: [{ id: batchId }, { batch_id: batchId }],
        },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!batch) {
        await t.rollback();
        throw new AppError(`Batch ${batchId} not found.`, 404);
      }

      if (batch.status === 'COMPLETED') {
        await t.rollback();
        throw new AppError('Cannot cancel an already completed batch.', 400);
      }

      // Mark un-sent outbox items as cancelled
      await WhatsAppOutbox.update(
        { status: 'cancelled', last_error: `Batch cancelled by user ${userId}: ${reason}` },
        { where: { batch_id: batch.id, status: ['pending', 'paused'] }, transaction: t }
      );

      await batch.update(
        {
          status: 'CANCELLED',
          completed_at: new Date(),
          metadata: {
            ...batch.metadata,
            cancellation_reason: reason,
            cancelled_by: userId,
          },
        },
        { transaction: t }
      );

      // Release reserved spend for cancelled batch
      const whatsappSpendGuard = require('./whatsappSpendGuard');
      await whatsappSpendGuard.releaseOrAdjustReservation({ batchId: batch.id, actualCost: 0, transaction: t });

      await t.commit();
      logger.info(`[WHATSAPP BATCH SERVICE] Batch ${batch.batch_id} cancelled by user ${userId}.`);

      return {
        success: true,
        message: `Batch ${batch.batch_id} successfully cancelled.`,
        batch,
      };
    } catch (err) {
      if (t && !t.finished) {
        await t.rollback();
      }
      throw err;
    }
  }

  /**
   * Synchronizes batch counters and lifecycle state from WhatsAppOutbox
   */
  static async updateBatchProgress(batchId) {
    if (!batchId) return;

    try {
      const batch = await WhatsAppBatch.findByPk(batchId);
      if (!batch) return;

      const counts = await WhatsAppOutbox.findAll({
        where: { batch_id: batchId },
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
        group: ['status'],
        raw: true,
      });

      let sent = 0;
      let failed = 0;
      let paused = 0;
      let pending = 0;
      let processing = 0;
      let cancelled = 0;

      for (const row of counts) {
        const c = parseInt(row.total, 10) || 0;
        const st = String(row.status || '').toLowerCase();
        if (st === 'sent' || st === 'provider_accepted' || st === 'delivered' || st === 'read') sent += c;
        else if (st === 'failed') failed += c;
        else if (st === 'paused') paused += c;
        else if (st === 'pending' || st === 'queued') pending += c;
        else if (st === 'processing') processing += c;
        else if (st === 'cancelled') cancelled += c;
      }

      const actualCostObj = await WhatsAppCostService.calculateActualCost(sent);

      let newStatus = batch.status;
      if (pending > 0 || processing > 0) {
        newStatus = 'PROCESSING';
      } else if (pending === 0 && processing === 0 && (sent > 0 || failed > 0 || cancelled > 0)) {
        if (failed > 0 && sent > 0) {
          newStatus = 'PARTIALLY_FAILED';
        } else if (failed > 0 && sent === 0) {
          newStatus = 'FAILED';
        } else if (sent > 0 && failed === 0) {
          newStatus = 'COMPLETED';
        }
      }

      await batch.update({
        sent_count: sent,
        failed_count: failed,
        paused_count: paused,
        cancelled_count: cancelled,
        actual_cost: actualCostObj.actual_cost,
        status: newStatus,
        ...(newStatus === 'COMPLETED' || newStatus === 'PARTIALLY_FAILED' || newStatus === 'FAILED'
          ? { completed_at: new Date() }
          : {}),
      });

      if (['COMPLETED', 'PARTIALLY_FAILED', 'FAILED'].includes(newStatus)) {
        const whatsappSpendGuard = require('./whatsappSpendGuard');
        whatsappSpendGuard.releaseOrAdjustReservation({ batchId, actualCost: actualCostObj.actual_cost }).catch(() => {});
      }
    } catch (err) {
      logger.error(`Error updating batch progress for ${batchId}:`, err.message);
    }
  }

  /**
   * Approves and queues ALL unconfirmed batches for an import for controlled background dispatch.
   * DOES NOT BURST: Batches are queued into outbox and paced by the distributed rate limiter.
   */
  static async confirmAllBatchesForImport(importBatchId, userId = null) {
    throw new AppError(
      'Bulk batch confirmation is disabled by system policy. Batches must be reviewed and approved sequentially one-by-one.',
      400
    );
  }

  /**
   * Cancels all un-sent batches for an import and releases reserved budget.
   */
  static async cancelAllBatchesForImport(importBatchId, userId = null, reason = 'Cancelled all batches by user') {
    if (!importBatchId) {
      throw new AppError('importBatchId is required.', 400);
    }

    const batches = await WhatsAppBatch.findAll({
      where: {
        import_batch_id: importBatchId,
        status: { [Op.in]: ['AWAITING_CONFIRMATION', 'READY'] },
      },
      order: [['batch_index', 'ASC']],
    });

    if (batches.length === 0) {
      return {
        success: true,
        message: 'No un-sent batches available to cancel.',
        cancelled_count: 0,
      };
    }

    const results = [];
    for (const batch of batches) {
      try {
        await this.cancelBatch({
          batchId: batch.id,
          userId,
          reason,
        });
        results.push({ batch_id: batch.batch_id, success: true });
      } catch (err) {
        results.push({ batch_id: batch.batch_id, success: false, error: err.message });
      }
    }

    const cancelledCount = results.filter((r) => r.success).length;

    return {
      success: true,
      message: `Cancelled ${cancelledCount} batch(es) for import ${importBatchId}.`,
      cancelled_count: cancelledCount,
      results,
    };
  }
}

module.exports = WhatsAppBatchService;
