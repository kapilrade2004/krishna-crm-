'use strict';

const whatsappBatchService = require('../services/whatsappBatchService');
const whatsappCostService = require('../services/whatsappCostService');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');

/**
 * GET /api/whatsapp/batches?import_batch_id=...
 */
exports.getImportBatches = async (req, res, next) => {
  try {
    const { import_batch_id } = req.query;
    if (!import_batch_id) {
      return next(new AppError('import_batch_id query parameter is required.', 400));
    }

    const data = await whatsappBatchService.getBatchesForImport(import_batch_id);
    sendSuccess(res, data, 'WhatsApp batches retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/whatsapp/batches/:id
 */
exports.getBatchDetails = async (req, res, next) => {
  try {
    const data = await whatsappBatchService.getBatchById(req.params.id);
    sendSuccess(res, data, 'Batch details retrieved successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/whatsapp/batches/:id/confirm
 * Requires explicit user confirmation.
 * Only this batch is queued. Remaining batches do NOT auto-send.
 */
exports.confirmBatch = async (req, res, next) => {
  try {
    const { idempotency_key } = req.body;
    const result = await whatsappBatchService.confirmAndDispatchBatch({
      batchId: req.params.id,
      userId: req.user?.id || null,
      idempotencyKey: idempotency_key || req.headers['x-idempotency-key'] || null,
    });

    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/whatsapp/batches/:id/cancel
 */
exports.cancelBatch = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await whatsappBatchService.cancelBatch({
      batchId: req.params.id,
      userId: req.user?.id || null,
      reason,
    });

    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/whatsapp/batches/pricing-info
 */
exports.getPricingAndBalance = async (req, res, next) => {
  try {
    const count = parseInt(req.query.count || '100', 10);
    const costEstimate = await whatsappCostService.calculateEstimatedCost(count);
    const durationEstimate = whatsappCostService.estimateDuration(count);
    const balanceInfo = await whatsappCostService.getProviderBalance();

    sendSuccess(res, {
      sample_count: count,
      estimated_cost: costEstimate,
      estimated_duration: durationEstimate,
      balance_info: balanceInfo,
    }, 'Pricing and balance information retrieved.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/whatsapp/batches/confirm-all
 * Controlled approval of all unconfirmed batches for an import.
 * Paces messages through outbox rate limiter without bursting.
 */
exports.confirmAllBatches = async (req, res, next) => {
  try {
    const { import_batch_id } = req.body;
    if (!import_batch_id) {
      return next(new AppError('import_batch_id is required.', 400));
    }

    const result = await whatsappBatchService.confirmAllBatchesForImport(
      import_batch_id,
      req.user?.id || null
    );

    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/whatsapp/batches/cancel-all
 * Cancels all remaining un-sent batches for an import.
 */
exports.cancelAllBatches = async (req, res, next) => {
  try {
    const { import_batch_id, reason } = req.body;
    if (!import_batch_id) {
      return next(new AppError('import_batch_id is required.', 400));
    }

    const result = await whatsappBatchService.cancelAllBatchesForImport(
      import_batch_id,
      req.user?.id || null,
      reason || 'Cancelled all batches by user'
    );

    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};
