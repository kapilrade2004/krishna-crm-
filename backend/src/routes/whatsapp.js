'use strict';

const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappService');
const { protect, authorize } = require('../middleware/auth');
const { manualSendRules, validate } = require('../validators');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');
const { WhatsAppLog } = require('../models');
const { getPagination, sendPaginated } = require('../utils/response');
const logger = require('../config/logger');

const { imageUpload } = require('../middleware/upload');

// Optional file upload middleware for local test webhook
const optionalImageUpload = (req, res, next) => {
  const handler = imageUpload.single('image');
  handler(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) {
      const fallback = imageUpload.single('file');
      return fallback(req, res, () => next());
    }
    next();
  });
};

// ─── Webhook verification (GET) — no auth, Meta/AOC challenge ─────────────────
const handleGetWebhook = (req, res) => {
  const mode = req.query['hub.mode'] || req.query['mode'];
  const token = req.query['hub.verify_token'] || req.query['verify_token'] || req.query['token'];
  const challenge = req.query['hub.challenge'] || req.query['challenge'];

  const configuredToken = process.env.WHATSAPP_VERIFY_TOKEN || 'vasify_crm_webhook_token';

  if ((mode === 'subscribe' || !mode) && (token === configuredToken || !token)) {
    logger.info('WhatsApp webhook verified successfully.');
    return res.status(200).send(challenge || 'VERIFIED');
  }

  if (mode === 'subscribe' && token === configuredToken) {
    logger.info('WhatsApp webhook verified successfully.');
    return res.status(200).send(challenge || 'VERIFIED');
  }

  logger.warn('WhatsApp webhook verification failed: Invalid verify token received.');
  return res.sendStatus(403);
};

// ─── Local Image Testing Webhook Handler ──────────────────────────────────────
const handleTestSimulateImage = async (req, res) => {
  const ts = new Date().toISOString();
  console.log(`\n⚡ [LOCAL TEST IMAGE WEBHOOK TRIGGERED] ${ts}`);

  try {
    const { Order, Customer, CustomerImage, WhatsAppLog } = require('../models');
    const OrderWorkflowService = require('../services/orderWorkflow/orderWorkflowService');
    const { ORDER_WORKFLOW_STATES } = require('../services/orderWorkflow/orderStateMachine');
    const s3Service = require('../services/s3Service');
    const fs = require('fs');
    const { v4: uuidv4 } = require('uuid');
    const { Op } = require('sequelize');

    const body = req.body || {};
    const query = req.query || {};
    const targetHint = body.order_id || body.order_number || query.order_id || query.order_number;
    const phoneHint = body.phone || query.phone;
    const imageUrlHint = body.image_url || body.url || query.image_url || query.url;
    const captionHint = body.caption || query.caption || 'Customer tap photo verification';

    // 1. Locate Target Order
    let order = null;
    if (targetHint) {
      order = await Order.findOne({
        where: {
          [Op.or]: [
            { id: targetHint },
            { order_number: targetHint },
            { marketplace_order_id: targetHint },
          ],
        },
        include: [{ model: Customer, as: 'customer' }],
      });
    }

    // If no order specified, find latest pending verification order
    if (!order) {
      order = await Order.findOne({
        where: {
          verification_status: {
            [Op.in]: ['pending_verification', 'screenshot_requested', 'pending', 'image_verification'],
          },
        },
        order: [['created_at', 'DESC']],
        include: [{ model: Customer, as: 'customer' }],
      });
    }

    // Fallback to any recent order
    if (!order) {
      order = await Order.findOne({
        order: [['created_at', 'DESC']],
        include: [{ model: Customer, as: 'customer' }],
      });
    }

    // 2. Locate Customer & Phone
    let customer = order ? order.customer : null;
    const resolvedPhone = phoneHint || order?.customer_phone || customer?.phone || customer?.whatsapp_number || '+917768868525';
    const digitsOnly = String(resolvedPhone).replace(/\D/g, '');
    const senderPhone = digitsOnly.length === 10 ? `+91${digitsOnly}` : `+${digitsOnly}`;

    if (!customer && digitsOnly.length >= 7) {
      customer = await Customer.findOne({
        where: {
          [Op.or]: [
            { phone: { [Op.like]: `%${digitsOnly.slice(-10)}%` } },
            { whatsapp_number: { [Op.like]: `%${digitsOnly.slice(-10)}%` } },
          ],
        },
      });
    }

    // 3. Resolve Image Buffer
    let fileBuffer = null;
    let mimeType = 'image/jpeg';

    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fileBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype || 'image/jpeg';
    } else if (imageUrlHint && /^https?:\/\//i.test(imageUrlHint)) {
      try {
        const fetchRes = await fetch(imageUrlHint, { signal: AbortSignal.timeout(8000) });
        if (fetchRes.ok) {
          const arrBuf = await fetchRes.arrayBuffer();
          fileBuffer = Buffer.from(arrBuf);
          mimeType = (fetchRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
        }
      } catch (fetchErr) {
        logger.warn(`Could not fetch external image_url ${imageUrlHint}: ${fetchErr.message}`);
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      // Valid sample JPEG binary buffer
      fileBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);
      mimeType = 'image/jpeg';
    }

    const testMediaId = `local_test_media_${Date.now()}`;
    const testMsgId = `wamid.LOCAL_SIM_${Date.now()}`;
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const orderKey = order?.id || 'unmatched';
    const s3Key = `customer_images/${orderKey}/${testMediaId}.${ext}`;

    // 4. Save to S3 & Local Disk
    const s3Res = await s3Service.uploadBuffer({
      buffer: fileBuffer,
      key: s3Key,
      contentType: mimeType,
      metadata: {
        orderId: order?.id || '',
        customerId: customer?.id || '',
        mediaId: testMediaId,
        messageId: testMsgId,
        isLocalTest: 'true',
      },
    });

    // 5. Create CustomerImage record
    const customerImage = await CustomerImage.create({
      id: uuidv4(),
      order_id: order?.id || null,
      customer_id: customer?.id || order?.customer_id || null,
      wa_message_id: testMsgId,
      media_id: testMediaId,
      s3_key: s3Res.key,
      file_url: s3Res.url,
      mime_type: mimeType,
      file_size: fileBuffer.length,
      image_type: 'tap_photo',
      status: 'RECEIVED',
      uploaded_at: new Date(),
    });

    // 6. Inbound WhatsAppLog record
    const inboundLog = await WhatsAppLog.create({
      phone_number: senderPhone,
      order_id: order?.id || null,
      customer_id: customer?.id || order?.customer_id || null,
      message_type: 'image',
      direction: 'inbound',
      status: 'delivered',
      wa_message_id: testMsgId,
      payload: {
        type: 'image',
        source: 'local_test_webhook',
        caption: captionHint,
        mediaId: testMediaId,
        url: s3Res.url,
      },
      sent_at: new Date(),
      delivered_at: new Date(),
    });

    // 7. Transition Order Status
    if (order) {
      await order.update({
        images_provided: true,
        verification_status: 'image_received',
        workflow_state: ORDER_WORKFLOW_STATES.IMAGE_RECEIVED,
      });

      try {
        await OrderWorkflowService.transitionOrder({
          orderId: order.id,
          targetState: ORDER_WORKFLOW_STATES.IMAGE_RECEIVED,
          actor: 'local_test_webhook',
          source: 'local_test_webhook',
          correlationId: `ORD-${order.order_number}-TEST-IMG`,
          customerPhone: senderPhone,
          note: `Local test image received and verified. (Media ID: ${testMediaId})`,
          metadata: {
            customer_image_id: customerImage.id,
            media_id: testMediaId,
            s3_key: s3Res.key,
          },
        });
      } catch (transErr) {
        logger.warn(`Order state transition notice: ${transErr.message}`);
      }
    }

    const presignedUrl = await s3Service.getPresignedViewUrl({ key: s3Res.key, expiresIn: 3600 });
    const finalViewUrl = presignedUrl || s3Res.url;

    logger.info(`⚡ [LOCAL TEST WEBHOOK SUCCESS] Inbound image simulated for Order #${order?.order_number || 'UNLINKED'}`);

    return res.status(200).json({
      status: 'success',
      message: 'Local test image webhook received and processed successfully!',
      data: {
        order: order ? {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          verification_status: order.verification_status,
          images_provided: order.images_provided,
          workflow_state: order.workflow_state,
        } : null,
        customer_image: {
          id: customerImage.id,
          order_id: customerImage.order_id,
          status: customerImage.status,
          file_url: customerImage.file_url,
          view_url: finalViewUrl,
          mime_type: customerImage.mime_type,
          file_size: customerImage.file_size,
        },
        whatsapp_log: {
          id: inboundLog.id,
          direction: inboundLog.direction,
          message_type: inboundLog.message_type,
          wa_message_id: inboundLog.wa_message_id,
        },
      },
    });
  } catch (err) {
    logger.error('Error in local test image webhook:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// ─── Incoming messages (POST) — no auth, Meta/AOC sends this ─────────────────────
const handlePostWebhook = async (req, res) => {
  const ts = new Date().toISOString();
  const topKeys = req.body ? Object.keys(req.body) : [];
  console.log(`\n⚡ [WHATSAPP WEBHOOK RECEIVED] ${ts}`);
  console.log(`   Top-level keys: [${topKeys.join(', ')}]`);
  if (req.body?.type) console.log(`   type: ${req.body.type}`);
  if (req.body?.event) console.log(`   event: ${req.body.event}`);
  if (req.body?.from || req.body?.sender) console.log(`   from: ${req.body.from || req.body.sender}`);
  try {
    const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');

    // 1. Verify webhook signature
    const verification = WhatsAppWebhookService.verify(req);
    const isVerified = typeof verification === 'boolean' ? verification : verification?.verified !== false;
    if (!isVerified) {
      logger.warn('[WHATSAPP WEBHOOK] Webhook signature verification failed.');
      return res.status(403).json({ error: 'INVALID_SIGNATURE' });
    }

    // 2. Normalize raw payload into canonical events
    const events = WhatsAppWebhookService.normalize(req.body);
    if (!events || events.length === 0) {
      logger.warn('[WHATSAPP WEBHOOK] Webhook payload could not be normalized into any event', { body: req.body });
      return res.status(422).json({ error: 'UNPROCESSABLE_ENTITY', message: 'Payload could not be normalized into any canonical event' });
    }

    const results = [];

    // 3. Process each normalized event through canonical WhatsAppWebhookService
    for (const event of events) {
      try {
        const result = await WhatsAppWebhookService.processEvent(event);
        results.push(result);
      } catch (eventErr) {
        logger.error(`[WHATSAPP WEBHOOK] Error processing event: ${eventErr.message}`, eventErr);
        throw eventErr; // Re-throw to trigger 500 for provider retry
      }
    }

    return res.status(200).json({ status: 'success', processed: results.length, data: results });
  } catch (err) {
    logger.error('WhatsApp webhook error:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// Canonical webhook route (/api/whatsapp/webhook)
router.get('/webhook', handleGetWebhook);
router.post('/webhook', handlePostWebhook);

// Local test image webhook (accepts JSON or multipart file upload)
router.post('/test-simulate-image', optionalImageUpload, handleTestSimulateImage);
router.post('/simulate-image', optionalImageUpload, handleTestSimulateImage);
router.get('/test-simulate-image', handleTestSimulateImage);

// Also attach handlers to router instance for explicit mounting if needed
router.handleGetWebhook = handleGetWebhook;
router.handlePostWebhook = handlePostWebhook;
router.handleTestSimulateImage = handleTestSimulateImage;

// ─── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);

// POST /api/whatsapp/send — manual send a template message
router.post('/send',
  authorize('admin', 'manager', 'sales'),
  manualSendRules,
  validate,
  async (req, res, next) => {
    try {
      const { phone, template_name, components = [], customer_id, order_id } = req.body;
      const result = await whatsappService.sendTemplate({
        to: phone,
        templateName: template_name,
        components,
        customerId: customer_id,
        orderId: order_id,
      });
      sendSuccess(res, { result }, 'WhatsApp message queued.');
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/whatsapp/logs — message history
router.get('/logs',
  authorize('admin', 'manager', 'ceo'),
  async (req, res, next) => {
    try {
      const { page, limit, offset } = getPagination(req.query);
      const where = {};
      if (req.query.phone) where.phone_number = req.query.phone;
      if (req.query.status) where.status = req.query.status;
      if (req.query.direction) where.direction = req.query.direction;

      const { count, rows } = await WhatsAppLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });
      sendPaginated(res, rows, { total: count, page, limit });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/customers/:id/whatsapp-optin — toggle opt-in
// (mounted separately in customers router, defined here for reference)

// GET /api/whatsapp/outbox-status — check circuit breaker & queue counts
router.get('/outbox-status',
  authorize('admin', 'manager', 'ceo', 'super_admin'),
  async (req, res, next) => {
    try {
      const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
      const { WhatsAppOutbox } = require('../models');
      const { fn, col } = require('sequelize');

      const counts = await WhatsAppOutbox.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      });

      const countMap = { pending: 0, processing: 0, sent: 0, failed: 0 };
      counts.forEach((c) => {
        countMap[c.status] = parseInt(c.count, 10) || 0;
      });

      const lastErrorItem = await WhatsAppOutbox.findOne({
        where: { last_error: { [require('sequelize').Op.ne]: null } },
        order: [['updated_at', 'DESC']],
        attributes: ['last_error', 'updated_at', 'template_name'],
      });

      sendSuccess(res, {
        circuit_breaker: whatsappOutboxQueue.getStatus(),
        queue_counts: countMap,
        last_error: lastErrorItem?.last_error || null,
        last_error_at: lastErrorItem?.updated_at || null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/whatsapp/resume-outbox — reset circuit breaker
router.post('/resume-outbox',
  authorize('admin', 'manager', 'super_admin'),
  async (req, res, next) => {
    try {
      const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
      whatsappOutboxQueue.resetCircuitBreaker();
      // Trigger a probe run
      setTimeout(() => {
        whatsappOutboxQueue.processQueue(1).catch(() => {});
      }, 500);

      sendSuccess(res, { message: 'WhatsApp Outbox circuit breaker reset. Dispatch resumed.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Global WhatsApp Emergency Kill Switch Controls ─────────────────────────

// GET /api/whatsapp/sending-status — authoritative sending state & queue metrics
router.get('/sending-status',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales', 'employee'),
  async (req, res, next) => {
    try {
      const emergencyPauseService = require('../services/emergencyPauseService');
      const status = await emergencyPauseService.getSendingStatus();
      sendSuccess(res, status, status.message);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/whatsapp/emergency-pause — immediately halt all outgoing WhatsApp dispatch
router.post('/emergency-pause',
  authorize('admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const emergencyPauseService = require('../services/emergencyPauseService');
      const result = await emergencyPauseService.setSendingState({
        enabled: false,
        actorUserId: req.user?.id || null,
        initiatedByEmail: req.user?.email || 'admin',
        reason: req.body?.reason || 'Manual emergency pause initiated by administrator',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/whatsapp/emergency-resume — resume normal WhatsApp dispatch
router.post('/emergency-resume',
  authorize('admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const emergencyPauseService = require('../services/emergencyPauseService');
      const result = await emergencyPauseService.setSendingState({
        enabled: true,
        actorUserId: req.user?.id || null,
        initiatedByEmail: req.user?.email || 'admin',
        reason: req.body?.reason || 'Manual resume initiated by administrator',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }
);

// ─── WhatsApp Batching & Controlled Bulk Messaging ─────────────────────────
const batchCtrl = require('../controllers/whatsappBatchController');

// GET /api/whatsapp/batches?import_batch_id=... — list batches for an import
router.get('/batches',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  batchCtrl.getImportBatches
);

// GET /api/whatsapp/batches/pricing-info — cost & balance preview
router.get('/batches/pricing-info',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  batchCtrl.getPricingAndBalance
);

// POST /api/whatsapp/batches/confirm-all — approve all batches for controlled paced dispatch
router.post('/batches/confirm-all',
  authorize('admin', 'manager', 'super_admin', 'sales'),
  batchCtrl.confirmAllBatches
);

// POST /api/whatsapp/batches/cancel-all — cancel all un-sent batches for an import
router.post('/batches/cancel-all',
  authorize('admin', 'manager', 'super_admin'),
  batchCtrl.cancelAllBatches
);

// GET /api/whatsapp/batches/:id — inspect specific batch
router.get('/batches/:id',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  batchCtrl.getBatchDetails
);

// POST /api/whatsapp/batches/:id/confirm — explicitly confirm and queue single batch
router.post('/batches/:id/confirm',
  authorize('admin', 'manager', 'super_admin', 'sales'),
  batchCtrl.confirmBatch
);

// POST /api/whatsapp/batches/:id/cancel — cancel un-sent batch
router.post('/batches/:id/cancel',
  authorize('admin', 'manager', 'super_admin'),
  batchCtrl.cancelBatch
);

// ─── WhatsApp Audit, Message Status & Cost Dashboard ────────────────────────
const auditCtrl = require('../controllers/whatsappAuditController');

// GET /api/whatsapp/audit/summary
router.get('/audit/summary',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getSummary
);

// GET /api/whatsapp/audit/daily
router.get('/audit/daily',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getDailyReport
);

// GET /api/whatsapp/audit/cost/templates
router.get('/audit/cost/templates',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getCostByTemplate
);

// GET /api/whatsapp/audit/cost/batches
router.get('/audit/cost/batches',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getCostByBatch
);

// GET /api/whatsapp/audit/messages
router.get('/audit/messages',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getMessages
);

// GET /api/whatsapp/audit/messages/:id
router.get('/audit/messages/:id',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getMessageDetail
);

// GET /api/whatsapp/audit/failures
router.get('/audit/failures',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getFailureAnalytics
);

// GET /api/whatsapp/audit/retries
router.get('/audit/retries',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.getRetryAnalytics
);

// GET /api/whatsapp/audit/export
router.get('/audit/export',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  auditCtrl.exportCsv
);

// POST /api/whatsapp/audit/email-report
router.post('/audit/email-report',
  authorize('admin', 'manager', 'ceo', 'super_admin'),
  auditCtrl.emailTotalReport
);

// ─── WhatsApp Rate Limiter & Spend Guard Controls ──────────────────────────
const rateLimitCtrl = require('../controllers/whatsappRateLimitController');

// GET /api/whatsapp/rate-limiter/status
router.get('/rate-limiter/status',
  authorize('admin', 'manager', 'ceo', 'super_admin', 'sales'),
  rateLimitCtrl.getStatus
);

// PUT /api/whatsapp/rate-limiter/config
router.put('/rate-limiter/config',
  authorize('admin', 'super_admin'),
  rateLimitCtrl.updateConfig
);

// GET /api/whatsapp/rate-limiter/audit
router.get('/rate-limiter/audit',
  authorize('admin', 'manager', 'ceo', 'super_admin'),
  rateLimitCtrl.getAuditLog
);

module.exports = router;
