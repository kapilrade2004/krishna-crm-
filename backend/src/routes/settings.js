'use strict';

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { sequelize, User, Customer, Order, OrderActivity, FollowUp, Task, CsvImportBatch,
  WhatsAppLog, ManualCallLog, CustomerImage, ShippingPartner, PincodeServiceability,
  Employee, EmployeeDocument, DailyTask, DailyTaskHistory, EmployeeAuditEvent,
  EmployeeAuditDailySummary, Warranty, WarrantyDocument, WarrantyServiceRequest,
  WarrantyEvent, LoginHistory, UserAuditLog, AccessTemplate, AccessRequest,
  PayrollProfile, PayrollRecord, SystemSetting, ResetAuditLog, WhatsAppOutbox, OrderEvent, syncModels } = require('../models');
const WarrantyReturn = require('../models/WarrantyReturn');
const WarrantyMessage = require('../models/WarrantyMessage');
const ProductReview = require('../models/ProductReview');
const AccountingRecord = require('../models/AccountingRecord');
const ChequeCollection = require('../models/ChequeCollection');
const AdCampaignMetric = require('../models/AdCampaignMetric');
const KeywordMetric = require('../models/KeywordMetric');
const ReturnClaim = require('../models/ReturnClaim');
const crypto = require('crypto');
const emergencyPauseService = require('../services/emergencyPauseService');
const { seedComprehensiveCRMData } = require('../services/seedService');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

router.use(protect);

// Helper to count CRM records
const getCRMRecordCounts = async () => {
  const { Op } = require('sequelize');
  const safeCount = async (model, where = {}) => {
    try { return await model.count({ where }); } catch (err) { return 0; }
  };
  const safeSum = async (model, field) => {
    try { return await model.sum(field) || 0; } catch (err) { return 0; }
  };

  const [
    customers, orders, orderItems, imports,
    whatsappLogs, whatsappOutbox, warrantyMessages,
    orderActivities, followUps, tasks, manualCallLogs,
    customerImages, warranties, warrantyDocs, warrantyServiceReqs,
    warrantyEvents, warrantyReturns, productReviews,
    accountingRecords, chequeCollections, adCampaigns,
    keywords, returnClaims, users
  ] = await Promise.all([
    safeCount(Customer),
    safeCount(Order),
    safeSum(Order, 'quantity'),
    safeCount(CsvImportBatch),
    safeCount(WhatsAppLog),
    safeCount(WhatsAppOutbox),
    safeCount(WarrantyMessage),
    safeCount(OrderActivity),
    safeCount(FollowUp),
    safeCount(Task),
    safeCount(ManualCallLog),
    safeCount(CustomerImage),
    safeCount(Warranty),
    safeCount(WarrantyDocument),
    safeCount(WarrantyServiceRequest),
    safeCount(WarrantyEvent),
    safeCount(WarrantyReturn),
    safeCount(ProductReview),
    safeCount(AccountingRecord),
    safeCount(ChequeCollection),
    safeCount(AdCampaignMetric),
    safeCount(KeywordMetric),
    safeCount(ReturnClaim),
    safeCount(User)
  ]);

  const whatsappRecords = whatsappLogs + whatsappOutbox + warrantyMessages;
  const otherCrmRecords = orderActivities + followUps + tasks + manualCallLogs +
    customerImages + warranties + warrantyDocs + warrantyServiceReqs +
    warrantyEvents + warrantyReturns + productReviews + accountingRecords +
    chequeCollections + adCampaigns + keywords + returnClaims;

  return {
    customers,
    orders,
    orderItems,
    imports,
    whatsappRecords,
    otherCrmRecords,
    usersPreserved: users,
    details: {
      customers, orders, orderItems, imports,
      whatsappLogs, whatsappOutbox, warrantyMessages,
      orderActivities, followUps, tasks, manualCallLogs,
      customerImages, warranties, warrantyDocs, warrantyServiceReqs,
      warrantyEvents, warrantyReturns, productReviews,
      accountingRecords, chequeCollections, adCampaigns,
      keywords, returnClaims
    }
  };
};

// ─── GET /api/settings/stats & /api/settings/reset-preview ──────────────────────
router.get(['/stats', '/reset-preview'], authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const counts = await getCRMRecordCounts();
    sendSuccess(res, counts, 'Pre-reset counts compiled successfully.');
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/settings/reset-crm ─────────────────────────────────────────────
router.post('/reset-crm', authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const { confirmation_phrase, confirmation_text } = req.body;
    const phrase = (confirmation_phrase || confirmation_text || '').trim().toUpperCase();
    const validPhrases = ['RESET CRM', 'RESET CRM DATA'];

    if (!validPhrases.includes(phrase)) {
      return next(new AppError('You must type the exact confirmation phrase "RESET CRM" to proceed.', 400));
    }

    // Ensure WhatsApp Emergency Pause is active before reset (auto-pause if not already active)
    let isPaused = await emergencyPauseService.isEmergencyPauseActive();
    if (!isPaused) {
      await emergencyPauseService.setSendingState({
        enabled: false,
        actorUserId: req.user.id,
        initiatedByEmail: req.user.email,
        reason: 'Automatic emergency pause activated before CRM reset operation',
      });
      isPaused = true;
    }

    logger.warn(`[EMERGENCY RESET] CRM reset initiated by user ${req.user.id} (${req.user.email})`);

    const startTime = Date.now();
    const resetOpId = crypto.randomUUID();
    let resetStatus = 'success';
    let failureReason = null;

    // Gather counts before reset
    const countsBefore = await getCRMRecordCounts();

    // Gather file paths to delete from storage
    let filesToDelete = [];
    try {
      const [cImages, wDocs, csvBatches, cheques, reviews] = await Promise.all([
        CustomerImage.findAll({ attributes: ['file_url'] }),
        WarrantyDocument.findAll({ attributes: ['file_path'] }),
        CsvImportBatch.findAll({ attributes: ['file_path'] }),
        ChequeCollection.findAll({ attributes: ['photo_url'] }),
        ProductReview.findAll({ attributes: ['screenshot_url'] }),
      ]);

      cImages.forEach(i => { if (i.file_url) filesToDelete.push(i.file_url); });
      wDocs.forEach(d => { if (d.file_path) filesToDelete.push(d.file_path); });
      csvBatches.forEach(b => { if (b.file_path) filesToDelete.push(b.file_path); });
      cheques.forEach(c => { if (c.photo_url) filesToDelete.push(c.photo_url); });
      reviews.forEach(r => { if (r.screenshot_url) filesToDelete.push(r.screenshot_url); });
    } catch (gatherErr) {
      logger.warn(`[EMERGENCY RESET] Warning gathering file paths: ${gatherErr.message}`);
    }

    // Execute wipe inside a transaction
    const t = await sequelize.transaction();
    try {
      if (sequelize.getDialect() === 'mysql') {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;', { transaction: t });
      }

      // 1. Delete child records referencing warranties, orders, customers
      await WarrantyDocument.destroy({ where: {}, transaction: t, force: true });
      await WarrantyServiceRequest.destroy({ where: {}, transaction: t, force: true });
      await WarrantyEvent.destroy({ where: {}, transaction: t, force: true });
      await WarrantyReturn.destroy({ where: {}, transaction: t, force: true });
      await WarrantyMessage.destroy({ where: {}, transaction: t, force: true });

      await OrderActivity.destroy({ where: {}, transaction: t, force: true });
      if (OrderEvent && typeof OrderEvent.destroy === 'function') {
        await OrderEvent.destroy({ where: {}, transaction: t, force: true });
      }
      await FollowUp.destroy({ where: {}, transaction: t, force: true });
      await WhatsAppOutbox.destroy({ where: {}, transaction: t, force: true });
      await WhatsAppLog.destroy({ where: {}, transaction: t, force: true });
      await ManualCallLog.destroy({ where: {}, transaction: t, force: true });
      await CustomerImage.destroy({ where: {}, transaction: t, force: true });
      await ChequeCollection.destroy({ where: {}, transaction: t, force: true });
      await ProductReview.destroy({ where: {}, transaction: t, force: true });
      await Task.destroy({ where: {}, transaction: t, force: true });

      // 2. Delete warranties
      await Warranty.destroy({ where: {}, transaction: t, force: true });

      // 3. Delete orders
      await Order.destroy({ where: {}, transaction: t, force: true });

      // 4. Delete csv_import_batches
      await CsvImportBatch.destroy({ where: {}, transaction: t, force: true });

      // 5. Delete customers
      await Customer.destroy({ where: {}, transaction: t, force: true });

      // 6. Delete independent business data
      await ReturnClaim.destroy({ where: {}, transaction: t, force: true });
      await AdCampaignMetric.destroy({ where: {}, transaction: t, force: true });
      await KeywordMetric.destroy({ where: {}, transaction: t, force: true });
      await AccountingRecord.destroy({ where: {}, transaction: t, force: true });

      if (sequelize.getDialect() === 'mysql') {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;', { transaction: t });
      }
      await t.commit();

      // 7. Physical file cleanup
      const fs = require('fs');
      const path = require('path');
      let deletedFilesCount = 0;

      for (const relativePath of filesToDelete) {
        try {
          let absPath = relativePath;
          if (!path.isAbsolute(absPath)) {
            absPath = path.resolve(process.cwd(), relativePath.startsWith('/') ? relativePath.substring(1) : relativePath);
          }
          if (fs.existsSync(absPath)) {
            fs.unlinkSync(absPath);
            deletedFilesCount++;
          }
        } catch (fileErr) {
          logger.warn(`[EMERGENCY RESET] Failed to delete file ${relativePath}: ${fileErr.message}`);
        }
      }
      logger.info(`[EMERGENCY RESET] Unlinked ${deletedFilesCount} file(s) from storage.`);

      // 8. Automatic verification
      const countsAfter = await getCRMRecordCounts();
      if (
        countsAfter.customers !== 0 ||
        countsAfter.orders !== 0 ||
        countsAfter.orderItems !== 0 ||
        countsAfter.imports !== 0 ||
        countsAfter.whatsappRecords !== 0 ||
        countsAfter.otherCrmRecords !== 0
      ) {
        throw new Error('Post-reset verification failed: Some CRM business data tables are not empty.');
      }

      if (countsAfter.usersPreserved !== countsBefore.usersPreserved) {
        throw new Error('Post-reset verification failed: Preservation violation. User accounts were deleted.');
      }

      logger.warn(`[EMERGENCY RESET] Successful. Operations id: ${resetOpId}`);
      sendSuccess(res, { resetOpId, preCounts: countsBefore, postCounts: countsAfter }, 'CRM has been reset. All business data has been purged. User accounts are preserved.');
    } catch (err) {
      if (t && !t.finished) {
        await t.rollback();
      }
      if (sequelize.getDialect() === 'mysql') {
        try { await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;'); } catch (_) {}
      }
      resetStatus = 'failure';
      failureReason = err.message;
      logger.error(`[EMERGENCY RESET] Failed: ${err.message}`);
      next(err);
    } finally {
      const duration = Date.now() - startTime;
      await ResetAuditLog.create({
        id: resetOpId,
        initiated_by_id: req.user.id,
        initiated_by_email: req.user.email,
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development',
        records_deleted: countsBefore,
        execution_duration_ms: duration,
        status: resetStatus,
        failure_reason: failureReason,
      }).catch(auditErr => logger.error('[EMERGENCY RESET] Failed to save reset audit log:', auditErr));
    }
  } catch (routeErr) {
    next(routeErr);
  }
});

// ─── POST /api/settings/emergency-pause ───────────────────────────────────────
router.post('/emergency-pause', authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const result = await emergencyPauseService.setSendingState({
      enabled: false,
      actorUserId: req.user?.id || null,
      initiatedByEmail: req.user?.email || 'admin',
      reason: req.body?.reason || 'Manual emergency pause initiated via settings dashboard',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/settings/emergency-resume ──────────────────────────────────────
router.post('/emergency-resume', authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const result = await emergencyPauseService.setSendingState({
      enabled: true,
      actorUserId: req.user?.id || null,
      initiatedByEmail: req.user?.email || 'admin',
      reason: req.body?.reason || 'Manual resume initiated via settings dashboard',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/settings/emergency-status ───────────────────────────────────────
router.get('/emergency-status', authorize('admin', 'super_admin', 'manager'), async (req, res, next) => {
  try {
    const status = await emergencyPauseService.getSendingStatus();
    sendSuccess(res, status, status.message);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/settings/seed-crm ──────────────────────────────────────────────
// Super Admin: Populates rich static and connected sample data across the entire CRM
router.post('/seed-crm', authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    logger.info(`[SEED CRM] Initiated by user ${req.user.id} (${req.user.email})`);
    const result = await seedComprehensiveCRMData();
    sendSuccess(res, result.summary, 'CRM static data has been populated successfully.');
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/settings/stats ──────────────────────────────────────────────────
// Returns counts for the settings overview dashboard
router.get('/stats', authorize('admin', 'super_admin', 'manager'), async (req, res, next) => {
  try {
    const safeCount = async (model) => {
      try {
        return await model.count();
      } catch {
        return 0;
      }
    };

    const [
      totalUsers, totalCustomers, totalOrders, totalEmployees,
      totalWarranties, totalTasks, totalFollowUps, totalCallLogs,
    ] = await Promise.all([
      safeCount(User),
      safeCount(Customer),
      safeCount(Order),
      safeCount(Employee),
      safeCount(Warranty),
      safeCount(Task),
      safeCount(FollowUp),
      safeCount(ManualCallLog),
    ]);

    sendSuccess(res, {
      totalUsers,
      totalCustomers,
      totalOrders,
      totalEmployees,
      totalWarranties,
      totalTasks,
      totalFollowUps,
      totalCallLogs,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
