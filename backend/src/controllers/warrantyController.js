'use strict';

const path = require('path');
const fs = require('fs');
const warrantyService = require('../services/warrantyService');
const { verifyActivationToken } = require('../services/warrantyTokenService');
const { sendSuccess, sendCreated } = require('../utils/response');
const { AppError } = require('../utils/errors');
const {
  WarrantyServiceRequest,
  Warranty,
  WarrantyDocument,
  Customer,
  User,
  WarrantyReturn,
  WarrantyMessage,
  WarrantyEvent,
} = require('../models');

/**
 * POST /api/warranty/register
 * Public & Admin warranty registration
 */
exports.registerWarranty = async (req, res, next) => {
  try {
    const file = req.file || null;
    const result = await warrantyService.registerWarranty(req.body, file);

    if (result.alreadyRegistered) {
      return sendSuccess(res, result, result.message);
    }

    sendCreated(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/warranty/stats
 * Dashboard 10 KPI statistics
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const stats = await warrantyService.getWarrantyDashboardStats();
    sendSuccess(res, { stats });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/warranty
 * Warranty List with search & filters
 */
exports.getWarrantiesList = async (req, res, next) => {
  try {
    const result = await warrantyService.getWarrantiesList(req.query);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/warranty/:id
 * Get single warranty details with full relations
 */
exports.getWarrantyById = async (req, res, next) => {
  try {
    const warranty = await warrantyService.getWarrantyById(req.params.id);
    if (!warranty) return next(new AppError('Warranty record not found.', 404));

    sendSuccess(res, { warranty });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/warranty/:id/verify
 * Manager/Admin verification action
 */
exports.verifyWarranty = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return next(new AppError('Invalid verification status.', 400));
    }

    const verifierId = req.user.id;
    const warranty = await warrantyService.verifyWarranty(
      req.params.id,
      status,
      verifierId,
      rejectionReason
    );

    sendSuccess(res, { warranty }, `Warranty ${status.toLowerCase()} successfully.`);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/warranty/activate/:token
 * Public Token Verification (Preview prior to customer activation)
 */
exports.checkActivationToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const verification = verifyActivationToken(token);

    if (!verification.valid) {
      return res.status(400).json({
        status: 'fail',
        isExpired: verification.isExpired || false,
        message: verification.reason || 'Invalid or expired token.',
      });
    }

    const warranty = await warrantyService.getWarrantyById(verification.warrantyId);
    if (!warranty) {
      return next(new AppError('Warranty record not found.', 404));
    }

    sendSuccess(res, {
      warranty,
      tokenDetails: verification,
      isAlreadyActive: warranty.warranty_status === 'ACTIVE' || warranty.status === 'ACTIVE',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/activate/:token
 * Public Customer Activation via Signed Expiring Token
 */
exports.activateByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const clientMetadata = {
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const result = await warrantyService.activateWarrantyByToken(token, clientMetadata);
    if (!result.success) {
      return res.status(400).json({
        status: 'fail',
        isExpired: result.isExpired || false,
        message: result.message,
      });
    }

    sendSuccess(res, result, result.message);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/:id/activate
 * Admin Manual Activation
 */
exports.activateWarranty = async (req, res, next) => {
  try {
    const actorUserId = req.user?.id || null;
    const warranty = await warrantyService.activateWarranty(req.params.id, actorUserId, req.body);
    sendSuccess(res, { warranty }, 'Warranty successfully activated.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/warranty/returns
 * List all Reverse Logistics & Returns
 */
exports.getReturnsList = async (req, res, next) => {
  try {
    const result = await warrantyService.getReturnsList(req.query);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/:id/returns
 * Request Product Return
 */
exports.requestReturn = async (req, res, next) => {
  try {
    const actorUserId = req.user?.id || null;
    const returnRecord = await warrantyService.requestReturn(req.params.id, req.body, actorUserId);
    sendCreated(res, { returnRecord }, `Return request #${returnRecord.return_number} created successfully.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/returns/:id/approve
 */
exports.approveReturn = async (req, res, next) => {
  try {
    const actorUserId = req.user.id;
    const returnRecord = await warrantyService.approveReturn(req.params.id, actorUserId, req.body.notes);
    sendSuccess(res, { returnRecord }, `Return #${returnRecord.return_number} approved.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/returns/:id/reject
 */
exports.rejectReturn = async (req, res, next) => {
  try {
    const actorUserId = req.user.id;
    const returnRecord = await warrantyService.rejectReturn(req.params.id, actorUserId, req.body.reason);
    sendSuccess(res, { returnRecord }, `Return #${returnRecord.return_number} rejected.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/returns/:id/schedule-pickup
 */
exports.scheduleReturnPickup = async (req, res, next) => {
  try {
    const actorUserId = req.user.id;
    const returnRecord = await warrantyService.scheduleReturnPickup(req.params.id, req.body, actorUserId);
    sendSuccess(res, { returnRecord }, `Pickup scheduled for Return #${returnRecord.return_number}.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/returns/:id/mark-picked-up
 */
exports.markReturnPickedUp = async (req, res, next) => {
  try {
    const actorUserId = req.user?.id || null;
    const returnRecord = await warrantyService.markReturnPickedUp(req.params.id, req.body, actorUserId);
    sendSuccess(res, { returnRecord }, `Return #${returnRecord.return_number} marked picked up.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/returns/:id/mark-received
 */
exports.markReturnReceived = async (req, res, next) => {
  try {
    const actorUserId = req.user?.id || null;
    const returnRecord = await warrantyService.markReturnReceived(req.params.id, req.body, actorUserId);
    sendSuccess(res, { returnRecord }, `Return #${returnRecord.return_number} received at central warehouse.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/returns/:id/inspect
 */
exports.inspectReturn = async (req, res, next) => {
  try {
    const actorUserId = req.user?.id || null;
    const returnRecord = await warrantyService.inspectReturn(req.params.id, req.body, actorUserId);
    sendSuccess(res, { returnRecord }, `Inspection completed for Return #${returnRecord.return_number}.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/returns/:id/close
 */
exports.closeReturn = async (req, res, next) => {
  try {
    const actorUserId = req.user?.id || null;
    const result = await warrantyService.closeReturn(req.params.id, req.body, actorUserId);
    sendSuccess(res, result, `Return closed successfully.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/:id/reset
 * Manual admin warranty reset
 */
exports.resetWarranty = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return next(new AppError('A valid reason is mandatory to reset warranty.', 400));
    }
    const actorUserId = req.user.id;
    const warranty = await warrantyService.resetWarranty(req.params.id, actorUserId, reason);
    sendSuccess(res, { warranty }, 'Warranty has been manually reset to Inactive. Audit history preserved.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/messages/:messageId/retry
 */
exports.retryWarrantyMessage = async (req, res, next) => {
  try {
    const actorUserId = req.user?.id || null;
    const msg = await warrantyService.retryWarrantyMessage(req.params.messageId, actorUserId);
    sendSuccess(res, { message: msg }, 'Warranty activation message retry queued.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/webhooks/delivery
 */
exports.handleDeliveryWebhook = async (req, res, next) => {
  try {
    const { order_id, order_number, delivered_at, tracking_number, delivery_partner } = req.body;
    const targetOrderId = order_id || order_number;
    if (!targetOrderId) return next(new AppError('order_id is required', 400));

    const warranty = await warrantyService.handleDeliveryEvent(targetOrderId, {
      delivered_at,
      tracking_number,
      delivery_partner,
      source_type: 'WEBHOOK',
    });

    sendSuccess(res, { warranty }, 'Delivery webhook processed.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/webhooks/installation
 */
exports.handleInstallationWebhook = async (req, res, next) => {
  try {
    const { order_id, order_number, completed_at, installation_id, technician_id } = req.body;
    const targetOrderId = order_id || order_number;
    if (!targetOrderId) return next(new AppError('order_id is required', 400));

    const warranty = await warrantyService.handleInstallationEvent(targetOrderId, {
      completed_at,
      installation_id,
      technician_id,
      source_type: 'WEBHOOK',
    });

    sendSuccess(res, { warranty }, 'Installation webhook processed. Activation scheduled.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/webhooks/return
 */
exports.handleReturnWebhook = async (req, res, next) => {
  try {
    const { order_id, reason, tracking_number, status } = req.body;
    const order = await warrantyService.lookupOrderDetails(String(order_id));
    if (!order) return next(new AppError('Order not found for return webhook', 404));

    let warranty = await Warranty.findOne({ where: { order_id: order.id } });
    if (!warranty) {
      warranty = await warrantyService.handleDeliveryEvent(order.id, { source_type: 'CARRIER_RETURN' });
    }

    const returnRecord = await warrantyService.requestReturn(warranty.id, {
      reason_text: reason || 'Carrier initiated return',
      request_source: 'CARRIER_WEBHOOK',
      pickup_tracking_number: tracking_number,
    });

    if (status === 'PICKED_UP') {
      await warrantyService.markReturnPickedUp(returnRecord.id, { source_type: 'CARRIER_WEBHOOK' });
    }

    sendSuccess(res, { returnRecord }, 'Carrier return webhook processed.');
  } catch (err) {
    next(err);
  }
};

/**
 * Service Requests CRUD
 */
exports.createServiceRequest = async (req, res, next) => {
  try {
    const payload = { ...req.body, warranty_id: req.params.id };
    const actorUserId = req.user.id;
    const serviceRequest = await warrantyService.createServiceRequest(payload, actorUserId);
    sendCreated(res, { serviceRequest }, 'Service request created successfully.');
  } catch (err) {
    next(err);
  }
};

exports.getServiceRequestById = async (req, res, next) => {
  try {
    const sr = await WarrantyServiceRequest.findByPk(req.params.srId, {
      include: [
        { model: Warranty, as: 'warranty' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'technician', attributes: ['id', 'name', 'phone', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });
    if (!sr) return next(new AppError('Service Request not found.', 404));
    sendSuccess(res, { serviceRequest: sr });
  } catch (err) {
    next(err);
  }
};

exports.updateServiceRequestStatus = async (req, res, next) => {
  try {
    const actorUserId = req.user.id;
    const sr = await warrantyService.updateServiceRequestStatus(req.params.srId, req.body, actorUserId);
    sendSuccess(res, { serviceRequest: sr }, 'Service request status updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * Order lookup for Auto-Fill
 */
exports.lookupOrder = async (req, res, next) => {
  try {
    const orderId = req.params.orderId || req.query.orderId || req.query.query || req.query.q;
    if (!orderId) return next(new AppError('Please provide an order ID or query parameter.', 400));
    const order = await warrantyService.lookupOrderDetails(orderId);
    if (!order) return next(new AppError('No matching order found.', 404));
    sendSuccess(res, { order });
  } catch (err) {
    next(err);
  }
};

exports.getProductsSkuList = async (req, res, next) => {
  try {
    const products = await warrantyService.getProductsSkuList();
    sendSuccess(res, { products });
  } catch (err) {
    next(err);
  }
};

exports.getCustomersBySku = async (req, res, next) => {
  try {
    const sku = req.query.sku || req.params.sku;
    if (!sku) return sendSuccess(res, { sku: '', total_customers: 0, orders: [] });
    const orders = await warrantyService.getCustomersBySku(sku);
    sendSuccess(res, { sku, total_customers: orders.length, orders });
  } catch (err) {
    next(err);
  }
};

/**
 * Documents View & Download
 */
function resolveDiskPath(filePath) {
  if (!filePath) return null;
  const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  const basename = path.basename(filePath);

  const candidates = [
    filePath,
    path.join(uploadDir, 'documents', basename),
    path.join(uploadDir, basename),
    path.join(process.cwd(), 'uploads', 'documents', basename),
    path.join(process.cwd(), 'uploads', basename),
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      try {
        if (fs.statSync(c).isFile()) return c;
      } catch {}
    }
  }
  return null;
}

exports.viewWarrantyDocument = async (req, res, next) => {
  try {
    const doc = await WarrantyDocument.findByPk(req.params.docId);
    if (!doc) return next(new AppError('Document record not found.', 404));

    const foundPath = resolveDiskPath(doc.file_path);
    if (!foundPath) return next(new AppError('Document file not found on disk.', 404));

    const mimeType = doc.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`);
    res.sendFile(foundPath);
  } catch (err) {
    next(err);
  }
};

exports.downloadWarrantyDocument = async (req, res, next) => {
  try {
    const doc = await WarrantyDocument.findByPk(req.params.docId);
    if (!doc) return next(new AppError('Document record not found.', 404));

    const foundPath = resolveDiskPath(doc.file_path);
    if (!foundPath) return next(new AppError('Document file not found on disk.', 404));

    res.download(foundPath, doc.file_name);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/messages/:messageId/retry
 * Retries dispatch of a failed or pending warranty message.
 */
exports.retryWarrantyMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const msg = await WarrantyMessage.findByPk(messageId, {
      include: [
        {
          model: Warranty,
          as: 'warranty',
          include: [{ model: Customer, as: 'customer' }],
        },
      ],
    });

    if (!msg) {
      return next(new AppError(`Warranty message ${messageId} not found.`, 404));
    }

    const { isWhatsAppSendingEnabled } = require('../services/emergencyPauseService');
    if (!(await isWhatsAppSendingEnabled())) {
      return next(new AppError('WhatsApp sending is currently paused by the Global Emergency Kill Switch.', 403));
    }

    const warranty = msg.warranty;
    if (!warranty) {
      return next(new AppError('Associated warranty not found.', 404));
    }

    const { generateActivationToken, getActivationUrl } = require('../services/warrantyTokenService');
    const token = generateActivationToken(warranty, 7);
    const activationUrl = getActivationUrl(token);

    await msg.update({
      attempt_count: (msg.attempt_count || 0) + 1,
      delivery_status: 'QUEUED',
      activation_token: token,
      activation_url: activationUrl,
    });

    const idempotencyKey = `wm-retry-${msg.id}-${Date.now()}`;
    const whatsappService = require('../services/whatsappService');
    const sendResult = await whatsappService.sendWarrantyActivationMessage({
      warranty,
      token,
      activationUrl,
      idempotencyKey,
    });

    const providerMsgId = sendResult?.waMessageId || sendResult?.response?.messages?.[0]?.id || `msg_${Date.now()}`;

    await msg.update({
      delivery_status: 'SENT',
      provider_message_id: providerMsgId,
      sent_at: new Date(),
      failure_reason: null,
    });

    await WarrantyEvent.create({
      warranty_id: warranty.id,
      event_type: 'ACTIVATION_MESSAGE_RETRY',
      from_status: warranty.warranty_status,
      to_status: warranty.warranty_status,
      source_type: 'USER',
      source_id: req.user?.id || null,
      title: 'Warranty Activation Message Retried',
      description: `Manual retry dispatched by user ${req.user?.name || req.user?.email || 'Staff'} to ${warranty.customer?.phone || 'customer'}.`,
      metadata: {
        message_id: msg.id,
        provider_message_id: providerMsgId,
      },
    });

    sendSuccess(res, { message: msg, sendResult }, 'Warranty activation message retry dispatched successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/warranty/activate/:token
 * Public customer check of signed expiring activation link
 */
exports.checkActivationToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { verifyActivationToken } = require('../services/warrantyTokenService');
    const verification = verifyActivationToken(token);
    if (!verification.valid) {
      return res.status(400).json({
        status: 'fail',
        isExpired: verification.isExpired || false,
        message: verification.reason || 'Invalid or expired activation link.',
      });
    }

    const wid = verification.warrantyId || verification.payload?.wid;
    const { Warranty, Customer, Order } = require('../models');
    const warranty = await Warranty.findByPk(wid, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Order, as: 'order', attributes: ['id', 'order_number', 'product_name', 'product_sku', 'order_date', 'delivered_at'] },
      ],
    });

    if (!warranty) {
      return res.status(404).json({
        status: 'fail',
        message: 'Warranty record not found for this activation token.',
      });
    }

    const isAlreadyActive = warranty.status === 'ACTIVE';

    return res.status(200).json({
      status: 'success',
      data: {
        warranty,
        tokenDetails: verification.payload,
        isAlreadyActive,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/warranty/activate/:token
 * Public customer self-activation submission via token
 */
exports.activateByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const DeliveryEventOrchestrator = require('../services/orderWorkflow/deliveryEventOrchestrator');
    const result = await DeliveryEventOrchestrator.activateWarranty({
      token,
      formData: req.body || {},
      actor: 'customer_website',
    });

    return res.status(200).json({
      status: 'success',
      message: result.message || 'Warranty activated successfully!',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

