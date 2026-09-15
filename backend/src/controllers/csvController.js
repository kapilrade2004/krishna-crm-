'use strict';

const path = require('path');
const { CsvImportBatch, User } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination } = require('../utils/response');
const csvService = require('../services/csvService');
const logger = require('../config/logger');

// POST /api/csv/upload — marketplace order CSV (Amazon 1/2/3, Flipkart, IndiaMart, AkuaBeat Website, Direct)
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('File (.xlsx, .xls, .csv, .tsv) is required.', 400));
    const { marketplace = 'other', channel = null } = req.body;
    const resolvedChannel = channel || marketplace;

    const batch = await CsvImportBatch.create({
      uploaded_by: req.user.id,
      marketplace,
      channel: resolvedChannel,
      filename: req.file.originalname,
      file_path: req.file.path,
      status: 'uploaded',
    });

    // Process asynchronously — respond immediately with batch ID (202 Accepted)
    res.status(202).json({
      status: 'success',
      message: 'File uploaded. Processing started.',
      data: { batch },
    });

    // Non-blocking background processing via canonical OrderImportService
    (async () => {
      try {
        const startTime = new Date();
        await batch.update({ status: 'processing', started_at: startTime });
        const OrderImportService = require('../services/orderImport/orderImportService');
        const summary = await OrderImportService.importOrders({
          filePath: req.file.path,
          originalName: req.file.originalname,
          channel: resolvedChannel,
          actorId: req.user.id,
          batchId: batch.id,
          enqueueVerification: false,
        });
        const finishTime = new Date();
        const durationMs = finishTime.getTime() - startTime.getTime();

        const formattedErrors = (summary.invalidEntries || []).slice(0, 100).map((item) => {
          const firstStructured = item.structuredErrors && item.structuredErrors[0] ? item.structuredErrors[0] : null;
          return {
            row: item.rowIndex || item.row,
            rowIndex: item.rowIndex || item.row,
            error: Array.isArray(item.errors) ? item.errors.join('; ') : (item.errors || 'Validation failed'),
            errors: item.errors,
            field: firstStructured?.field || null,
            problem: firstStructured?.problem || null,
            value: firstStructured?.value || null,
            reason: firstStructured?.reason || (Array.isArray(item.errors) ? item.errors.join('; ') : item.errors),
          };
        });

        const finalStatus = summary.status || (
          summary.importedCount > 0
            ? (summary.invalidCount > 0 ? 'partial' : 'completed')
            : (summary.invalidCount > 0 ? 'failed' : 'completed')
        );

        await batch.update({
          status: finalStatus,
          total_rows: summary.total || 0,
          processed_rows: summary.total || 0,
          success_rows: summary.importedCount || 0,
          failed_rows: summary.invalidCount || 0,
          duplicate_rows: summary.skippedCount || 0,
          existing_customers_reused: summary.existingCustomersReused || 0,
          error_log: formattedErrors,
          started_at: startTime,
          completed_at: finishTime,
          processed_at: finishTime,
          duration_ms: durationMs,
        });

        logger.info(
          `[CSV UPLOAD] Batch ${batch.id} finished with status "${finalStatus}": ` +
          `${summary.importedCount} imported, ${summary.skippedCount} skipped/duplicate, ${summary.invalidCount} failed ` +
          `(out of ${summary.total} total rows). Batches prepared for sequential operator review.`
        );
      } catch (err) {
        logger.error(`[CSV UPLOAD] Batch ${batch.id} critical failure:`, err);
        await batch.update({
          status: 'failed',
          total_rows: 0,
          processed_rows: 0,
          success_rows: 0,
          failed_rows: 1,
          duplicate_rows: 0,
          error_log: [{ error: err.message, row: 1, reason: err.message }],
          processed_at: new Date(),
        });
      }
    })();
  } catch (err) {
    next(err);
  }
};

// POST /api/csv/delivery-upload — Two-Way Delivery CSV (Client Email Point 5)
// Upload Amazon daily delivery report → system marks matching orders as delivered
// and auto-advances flow_stage to 'installation'
exports.uploadDeliveryCsv = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('CSV file is required.', 400));

    logger.info(`Delivery CSV upload: ${req.file.originalname} by user ${req.user.id}`);

    // Process synchronously (delivery files are typically small — 50–200 rows/day)
    const results = await csvService.processDeliveryCsv(req.file.path);

    // Clean up temp file after processing
    const fs = require('fs');
    fs.unlink(req.file.path, () => {});

    sendSuccess(res, { results }, [
      `Delivery CSV processed: ${results.matched} order(s) marked as delivered.`,
      results.alreadyDelivered > 0 ? `${results.alreadyDelivered} already delivered (skipped).` : '',
      results.notFound > 0 ? `${results.notFound} order ID(s) not found in CRM.` : '',
    ].filter(Boolean).join(' '));
  } catch (err) {
    next(err);
  }
};

// GET /api/csv/batches
exports.getBatches = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await CsvImportBatch.findAndCountAll({
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// GET /api/csv/batches/:id
exports.getBatch = async (req, res, next) => {
  try {
    const batch = await CsvImportBatch.findByPk(req.params.id, {
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
    });
    if (!batch) return next(new AppError('Batch not found.', 404));

    const batchData = batch.toJSON();
    const createdAt = batchData.created_at || batchData.createdAt;
    const processedAt = batchData.processed_at || batchData.processedAt;
    if (createdAt && processedAt) {
      const start = new Date(createdAt).getTime();
      const end = new Date(processedAt).getTime();
      batchData.duration = Math.max(0, Math.round((end - start) / 1000));
    } else {
      batchData.duration = 0;
    }

    sendSuccess(res, { batch: batchData });
  } catch (err) {
    next(err);
  }
};
