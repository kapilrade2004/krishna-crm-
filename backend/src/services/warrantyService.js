'use strict';

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const {
  Warranty,
  WarrantyDocument,
  WarrantyServiceRequest,
  WarrantyEvent,
  WarrantyReturn,
  WarrantyMessage,
  Customer,
  Order,
  User,
  sequelize,
} = require('../models');
const {
  WARRANTY_STATUSES,
  RETURN_STATUSES,
  validateWarrantyTransition,
  validateReturnTransition,
  normalizeWarrantyStatus,
  normalizeReturnStatus,
} = require('./warrantyStateMachine');
const {
  generateActivationToken,
  verifyActivationToken,
  getActivationUrl,
} = require('./warrantyTokenService');
const { createAuditEvent } = require('./auditService');
const whatsappService = require('./whatsappService');
const logger = require('../config/logger');

/**
 * Generate unique Warranty Number (WAR-YYYY-XXXXXX)
 */
async function generateWarrantyNumber() {
  const year = new Date().getFullYear();
  const count = await Warranty.count();
  const nextNum = String(count + 1).padStart(6, '0');
  return `WAR-${year}-${nextNum}`;
}

/**
 * Generate unique Return Number (RET-YYYY-XXXXXX)
 */
async function generateReturnNumber() {
  const year = new Date().getFullYear();
  const count = await WarrantyReturn.count();
  const nextNum = String(count + 1).padStart(6, '0');
  return `RET-${year}-${nextNum}`;
}

/**
 * Generate unique Service Request Number (SR-YYYY-XXXXXX)
 */
async function generateServiceRequestNumber() {
  const year = new Date().getFullYear();
  const count = await WarrantyServiceRequest.count();
  const nextNum = String(count + 1).padStart(6, '0');
  return `SR-${year}-${nextNum}`;
}

/**
 * Normalize document file paths
 */
function normalizeDocPath(filePath) {
  if (!filePath) return filePath;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;

  const uploadsIdx = filePath.indexOf('uploads');
  if (uploadsIdx !== -1) {
    return '/' + filePath.substring(uploadsIdx).replace(/\\/g, '/');
  }
  const basename = path.basename(filePath);
  return `/uploads/documents/${basename}`;
}

exports.normalizeDocPath = normalizeDocPath;
exports.generateWarrantyNumber = generateWarrantyNumber;
exports.generateReturnNumber = generateReturnNumber;

/**
 * Customer Matching Algorithm
 */
async function findOrCreateWarrantyCustomer(payload) {
  let customer = null;
  const mobile = payload.mobile || payload.mobileNumber || payload.phone;

  // 1. Match via Order ID
  if (payload.orderId) {
    const raw = String(payload.orderId).trim();
    const clean = raw.replace(/^(AMA-|FK-|IM-|ORD-|KR-)/i, '').trim();
    const orderConds = [
      { order_number: raw },
      { marketplace_order_id: raw },
      { id: raw },
    ];
    if (clean && clean !== raw) {
      orderConds.push({ order_number: clean });
      orderConds.push({ marketplace_order_id: clean });
    }

    const existingOrder = await Order.findOne({
      where: { [Op.or]: orderConds },
      include: [{ model: Customer, as: 'customer' }],
    });
    if (existingOrder) {
      if (existingOrder.customer) {
        customer = existingOrder.customer;
      } else {
        const { ensureCustomerOnDelivery } = require('../controllers/orderController');
        customer = await ensureCustomerOnDelivery(existingOrder);
      }
    }
  }

  // 2. Match via Mobile Number
  if (!customer && mobile) {
    const clean10 = String(mobile).replace(/\D/g, '').slice(-10);
    customer = await Customer.findOne({
      where: {
        [Op.or]: [
          { phone: String(mobile).trim() },
          { phone: clean10 },
          { phone: `+91${clean10}` },
          { whatsapp_number: clean10 },
          { whatsapp_number: `+91${clean10}` },
        ],
      },
    });
  }

  // 3. Match via Email
  if (!customer && payload.email) {
    customer = await Customer.findOne({
      where: { email: String(payload.email).trim().toLowerCase() },
    });
  }

  // Update existing customer or create new
  if (customer) {
    const updates = {};
    if ((!customer.name || customer.name === 'Unknown' || customer.name === 'Customer') && payload.fullName) {
      updates.name = payload.fullName;
    }
    if (!customer.phone && mobile) updates.phone = mobile;
    if (!customer.email && payload.email) updates.email = payload.email;
    if (!customer.address_line1 && payload.addressLine1) {
      updates.address_line1 = payload.addressLine1;
      updates.address_line2 = payload.addressLine2 || null;
    }
    if (!customer.city && payload.city) updates.city = payload.city;
    if (!customer.state && payload.state) updates.state = payload.state;
    if (!customer.pincode && payload.pinCode) updates.pincode = payload.pinCode;

    if (Object.keys(updates).length > 0) {
      await customer.update(updates);
    }
  } else {
    customer = await Customer.create({
      name: payload.fullName || 'Customer',
      phone: mobile || '0000000000',
      email: payload.email || null,
      address_line1: payload.addressLine1 || null,
      address_line2: payload.addressLine2 || null,
      city: payload.city || null,
      state: payload.state || null,
      pincode: payload.pinCode || null,
      status: 'Active',
    });
  }

  return customer;
}

/**
 * 1. Register Warranty (Public Website Form or Admin Registration)
 */
exports.registerWarranty = async (payload, file) => {
  const normalized = {
    ...payload,
    mobile: payload.mobile || payload.mobileNumber || payload.phone,
    brand: payload.brand || payload.purifierBrand,
    modelName: payload.modelName || payload.purifierModel,
    purchaseDate: payload.purchaseDate || payload.dateOfPurchase,
  };

  const customer = await findOrCreateWarrantyCustomer(normalized);

  let order = null;
  let verificationStatus = 'PENDING';
  let warrantyStatus = WARRANTY_STATUSES.PENDING_DELIVERY;

  if (normalized.orderId) {
    const raw = String(normalized.orderId).trim();
    const clean = raw.replace(/^(AMA-|FK-|IM-|ORD-|KR-)/i, '').trim();
    const orderConds = [
      { order_number: raw },
      { marketplace_order_id: raw },
      { id: raw },
    ];
    if (clean && clean !== raw) {
      orderConds.push({ order_number: clean });
      orderConds.push({ marketplace_order_id: clean });
    }

    order = await Order.findOne({ where: { [Op.or]: orderConds } });
    if (order) {
      verificationStatus = 'VERIFIED';
      if (order.status === 'delivered') {
        warrantyStatus = WARRANTY_STATUSES.DELIVERED;
      }
    }
  }

  // Duplicate Check: Same customer + order
  if (order) {
    const existingWarranty = await Warranty.findOne({
      where: {
        [Op.or]: [
          { order_id: order.id },
          { customer_id: customer.id, order_id: order.id },
        ],
      },
    });

    if (existingWarranty) {
      // Strictly gate activation: linked order MUST be delivered
      if (!order || order.status !== 'delivered') {
        return {
          alreadyRegistered: false,
          warranty: existingWarranty,
          pendingDelivery: true,
          message: 'Your warranty registration is recorded and will be automatically activated once your order is delivered.',
        };
      }

      if (existingWarranty.status !== 'ACTIVE' || existingWarranty.warranty_status !== WARRANTY_STATUSES.ACTIVE) {
        const now = new Date();
        const oneYearLater = new Date(now);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

        const prev = existingWarranty.warranty_status;
        await existingWarranty.update({
          customer_id: customer.id,
          status: 'ACTIVE',
          warranty_status: WARRANTY_STATUSES.ACTIVE,
          activated_at: now,
          warranty_activation_date: now,
          warranty_start_at: now,
          warranty_end_at: oneYearLater,
          warranty_start_date: now.toISOString().split('T')[0],
          warranty_end_date: oneYearLater.toISOString().split('T')[0],
          verification_status: 'VERIFIED',
          terms_accepted: normalized.termsAccepted !== false && normalized.agree !== false,
          privacy_accepted: normalized.privacyAccepted !== false && normalized.agree !== false,
          registration_source: normalized.registration_source || 'WEBSITE_FORM',
          serial_number: normalized.serialNumber || normalized.serial_number || existingWarranty.serial_number,
        });

        await WarrantyEvent.create({
          warranty_id: existingWarranty.id,
          actor_user_id: null,
          event_type: 'WARRANTY_ACTIVATED',
          from_status: prev,
          to_status: WARRANTY_STATUSES.ACTIVE,
          source_type: 'CUSTOMER',
          title: 'Customer Activated Warranty via Website Form',
          description: `Customer submitted website warranty registration form. Coverage active through ${oneYearLater.toLocaleDateString()}.`,
          metadata: { activated_at: now },
        });

        const whatsappService = require('./whatsappService');
        await whatsappService.sendWarrantyActivatedConfirmation({
          ...(existingWarranty.toJSON ? existingWarranty.toJSON() : existingWarranty),
          customer,
          order,
        }).catch((e) => {
          logger.warn(`Failed to send warranty_activated WhatsApp message for Warranty ${existingWarranty.warranty_number}:`, e.message);
        });

        return {
          alreadyRegistered: false,
          warranty: existingWarranty,
          message: 'Congratulations! Your AkuaBeat product warranty is now fully active for 1 year.',
        };
      }

      return {
        alreadyRegistered: true,
        warranty: existingWarranty,
        message: 'This product order is already registered and active for warranty.',
      };
    }
  }

  const warrantyNumber = await generateWarrantyNumber();
  const rawPurchaseDate = normalized.purchaseDate ? new Date(normalized.purchaseDate) : new Date();
  const purchaseDate = isNaN(rawPurchaseDate.getTime()) ? new Date() : rawPurchaseDate;
  const startDate = purchaseDate;
  const endDate = new Date(purchaseDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  // Warranty activation is strictly gated by order.status === 'delivered'
  const isDelivered = order && order.status === 'delivered';
  const shouldActivate = Boolean(isDelivered);
  if (shouldActivate) {
    warrantyStatus = WARRANTY_STATUSES.ACTIVE;
    verificationStatus = 'VERIFIED';
  } else {
    warrantyStatus = WARRANTY_STATUSES.PENDING_DELIVERY;
    verificationStatus = order ? 'VERIFIED' : 'PENDING';
  }

  const warranty = await Warranty.create({
    warranty_number: warrantyNumber,
    customer_id: customer.id,
    order_id: order ? order.id : null,
    product_name_snapshot: normalized.productName || order?.product_name || 'AkuaBeat Water Purifier',
    brand_snapshot: normalized.brand || 'AkuaBeat',
    model_snapshot: normalized.modelName || order?.product_sku || 'Standard Model',
    serial_number: normalized.serialNumber || normalized.serial_number || null,
    marketplace: normalized.marketplace || order?.marketplace || 'Direct',
    purchase_date: purchaseDate,
    warranty_start_date: startDate.toISOString().split('T')[0],
    warranty_end_date: endDate.toISOString().split('T')[0],
    warranty_start_at: startDate,
    warranty_end_at: endDate,
    status: shouldActivate ? 'ACTIVE' : 'PENDING_VERIFICATION',
    warranty_status: warrantyStatus,
    return_status: RETURN_STATUSES.NONE,
    verification_status: verificationStatus,
    registration_source: normalized.registration_source || 'WEBSITE_FORM',
    terms_accepted: normalized.termsAccepted !== false && normalized.agree !== false,
    privacy_accepted: normalized.privacyAccepted !== false && normalized.agree !== false,
    verified_at: verificationStatus === 'VERIFIED' ? new Date() : null,
    activated_at: shouldActivate ? new Date() : null,
    is_returned: false,
  });

  if (file) {
    const filename = file.filename || (file.path ? path.basename(file.path) : null);
    const webPath = filename ? `/uploads/documents/${filename}` : (file.path || null);

    await WarrantyDocument.create({
      warranty_id: warranty.id,
      document_type: 'PURCHASE_INVOICE',
      file_name: file.originalname || filename || 'purchase_invoice.pdf',
      file_path: webPath || `/uploads/documents/${filename}`,
      file_size: file.size || 0,
      mime_type: file.mimetype || 'application/pdf',
    });
  }

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    event_type: shouldActivate ? 'WARRANTY_ACTIVATED' : 'ORDER_CREATED',
    from_status: null,
    to_status: warrantyStatus,
    source_type: 'CUSTOMER',
    title: shouldActivate ? 'Warranty Registered and Activated' : 'Warranty Registration Submitted',
    description: `Product warranty registered via ${warranty.registration_source} for ${warranty.product_name_snapshot}.`,
    metadata: { marketplace: normalized.marketplace, order_id: normalized.orderId, activated: shouldActivate },
  });

  createAuditEvent({
    userId: null,
    actorUserId: null,
    action: shouldActivate ? 'WARRANTY_ACTIVATED_BY_CUSTOMER' : 'WARRANTY_REGISTERED',
    module: 'warranty',
    entityType: 'Warranty',
    entityId: warranty.id,
    metadata: { warranty_number: warrantyNumber, customer_name: customer.name, status: warrantyStatus },
  });

  if (shouldActivate) {
    const whatsappService = require('./whatsappService');
    await whatsappService.sendWarrantyActivatedConfirmation({
      ...(warranty.toJSON ? warranty.toJSON() : warranty),
      customer,
      order,
    }).catch((e) => {
      logger.warn(`Failed to dispatch warranty_activated message on registration: ${e.message}`);
    });
  }

  return {
    alreadyRegistered: false,
    warranty,
    message: shouldActivate
      ? 'Warranty registered and activated successfully! Confirmation sent via WhatsApp.'
      : 'Warranty registered successfully.',
  };
};

/**
 * 2. Handle Delivery Event (Carrier Webhook / CRM Status Change)
 */
exports.handleDeliveryEvent = async (orderId, deliveryPayload = {}, actorUserId = null) => {
  if (!orderId) return null;

  const order = await Order.findByPk(orderId, {
    include: [{ model: Customer, as: 'customer' }],
  });
  if (!order) throw new Error(`Order #${orderId} not found.`);

  const deliveryTimestamp = deliveryPayload.delivered_at ? new Date(deliveryPayload.delivered_at) : new Date();

  // Update order delivery timestamp if not set
  if (!order.delivered_at || order.status !== 'delivered') {
    await order.update({
      status: 'delivered',
      delivered_at: deliveryTimestamp,
    });
  }

  let warranty = await Warranty.findOne({ where: { order_id: order.id } });

  if (warranty) {
    // Idempotency: If already delivered, don't duplicate transition
    if (warranty.warranty_status === WARRANTY_STATUSES.PENDING_DELIVERY || !warranty.delivered_at) {
      const prev = warranty.warranty_status;
      await warranty.update({
        delivered_at: deliveryTimestamp,
        delivery_id: deliveryPayload.delivery_id || warranty.delivery_id || order.tracking_number,
        delivery_partner: deliveryPayload.delivery_partner || warranty.delivery_partner || order.shipping_partner,
        tracking_number: deliveryPayload.tracking_number || warranty.tracking_number || order.tracking_number,
        warranty_status: warranty.installation_completed_at ? WARRANTY_STATUSES.ACTIVATION_MESSAGE_SCHEDULED : WARRANTY_STATUSES.DELIVERED,
      });

      await WarrantyEvent.create({
        warranty_id: warranty.id,
        actor_user_id: actorUserId,
        event_type: 'PRODUCT_DELIVERED',
        from_status: prev,
        to_status: warranty.warranty_status,
        source_type: deliveryPayload.source_type || (actorUserId ? 'ADMIN' : 'WEBHOOK'),
        source_id: deliveryPayload.delivery_id || order.tracking_number,
        title: 'Product Delivered to Customer',
        description: `Delivered via ${warranty.delivery_partner || 'Courier'}. Tracking: ${warranty.tracking_number || 'N/A'}.`,
        metadata: deliveryPayload,
      });
    }
  } else {
    // Create new warranty record in DELIVERED state
    const warNum = await generateWarrantyNumber();
    const purchaseDate = order.order_date ? new Date(order.order_date) : deliveryTimestamp;
    const oneYearLater = new Date(deliveryTimestamp);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    warranty = await Warranty.create({
      warranty_number: warNum,
      customer_id: order.customer_id,
      order_id: order.id,
      product_name_snapshot: order.product_name || 'AkuaBeat Water Purifier',
      brand_snapshot: 'AkuaBeat',
      model_snapshot: order.product_sku || 'Standard',
      marketplace: order.marketplace || 'direct',
      purchase_date: purchaseDate,
      delivered_at: deliveryTimestamp,
      delivery_id: deliveryPayload.delivery_id || order.tracking_number,
      delivery_partner: deliveryPayload.delivery_partner || order.shipping_partner,
      tracking_number: deliveryPayload.tracking_number || order.tracking_number,
      warranty_start_date: deliveryTimestamp.toISOString().split('T')[0],
      warranty_end_date: oneYearLater.toISOString().split('T')[0],
      warranty_start_at: deliveryTimestamp,
      warranty_end_at: oneYearLater,
      status: 'PENDING_VERIFICATION',
      warranty_status: WARRANTY_STATUSES.DELIVERED,
      return_status: RETURN_STATUSES.NONE,
      verification_status: 'VERIFIED',
      registration_source: 'DELIVERY_TRIGGER',
      is_returned: false,
    });

    await WarrantyEvent.create({
      warranty_id: warranty.id,
      actor_user_id: actorUserId,
      event_type: 'PRODUCT_DELIVERED',
      from_status: null,
      to_status: WARRANTY_STATUSES.DELIVERED,
      source_type: deliveryPayload.source_type || (actorUserId ? 'ADMIN' : 'WEBHOOK'),
      source_id: deliveryPayload.delivery_id || order.tracking_number,
      title: 'Order Delivered — Warranty Initialized',
      description: `Product delivered to customer. Warranty record created in DELIVERED status.`,
      metadata: deliveryPayload,
    });
  }

  return warranty;
};

/**
 * 3. Handle Installation Completed Event
 * Calculates activation_due_at = installation_completed_at + 24 Hours
 */
exports.handleInstallationEvent = async (orderId, installationPayload = {}, actorUserId = null) => {
  if (!orderId) return null;

  const order = await Order.findByPk(orderId, {
    include: [{ model: Customer, as: 'customer' }],
  });
  if (!order) throw new Error(`Order #${orderId} not found.`);

  let warranty = await Warranty.findOne({ where: { order_id: order.id } });
  if (!warranty) {
    // If warranty doesn't exist yet, create it from order
    warranty = await exports.handleDeliveryEvent(order.id, { source_type: 'INSTALLATION' }, actorUserId);
  }

  const completedAt = installationPayload.completed_at
    ? new Date(installationPayload.completed_at)
    : new Date();

  // Idempotency: If already has installation_completed_at and same timestamp, return existing
  if (warranty.installation_completed_at && Math.abs(new Date(warranty.installation_completed_at) - completedAt) < 1000) {
    return warranty;
  }

  const twentyFourHoursLater = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
  const prev = warranty.warranty_status;

  await warranty.update({
    installation_id: installationPayload.installation_id || warranty.installation_id || null,
    installation_completed_at: completedAt,
    activation_due_at: twentyFourHoursLater,
    warranty_status: WARRANTY_STATUSES.ACTIVATION_MESSAGE_SCHEDULED,
  });

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: actorUserId,
    event_type: 'INSTALLATION_COMPLETED',
    from_status: prev,
    to_status: WARRANTY_STATUSES.ACTIVATION_MESSAGE_SCHEDULED,
    source_type: installationPayload.source_type || 'INSTALLATION',
    source_id: installationPayload.installation_id || null,
    title: 'Installation Completed — Activation Message Scheduled',
    description: `Installation verified on ${completedAt.toLocaleString()}. WhatsApp activation message scheduled for ${twentyFourHoursLater.toLocaleString()} (24h SLA).`,
    metadata: {
      completed_at: completedAt,
      activation_due_at: twentyFourHoursLater,
      technician_id: installationPayload.technician_id || null,
    },
  });

  createAuditEvent({
    userId: warranty.customer_id,
    actorUserId: actorUserId,
    action: 'INSTALLATION_COMPLETED',
    module: 'warranty',
    entityType: 'Warranty',
    entityId: warranty.id,
    metadata: {
      installation_completed_at: completedAt,
      activation_due_at: twentyFourHoursLater,
    },
  });

  return warranty;
};

/**
 * 4. Public Customer Activation via Signed Expiring Token
 */
exports.activateWarrantyByToken = async (token, clientMetadata = {}) => {
  const verification = verifyActivationToken(token);
  if (!verification.valid) {
    return {
      success: false,
      isExpired: verification.isExpired || false,
      message: verification.reason || 'Invalid or expired activation link.',
    };
  }

  const warranty = await Warranty.findByPk(verification.warrantyId, {
    include: [
      { model: Customer, as: 'customer' },
      { model: Order, as: 'order' },
    ],
  });

  if (!warranty) {
    return { success: false, message: 'Warranty record matching this token was not found.' };
  }

  // Cross-check order & customer match
  if (verification.customerId && String(warranty.customer_id) !== String(verification.customerId)) {
    return { success: false, message: 'Security mismatch: Customer identity does not match token.' };
  }

  // Idempotency: If already active, return success without duplicate activation events
  if (warranty.warranty_status === WARRANTY_STATUSES.ACTIVE || warranty.status === 'ACTIVE') {
    return {
      success: true,
      alreadyActive: true,
      warranty,
      message: `Warranty is already active until ${new Date(warranty.warranty_end_at || warranty.warranty_end_date).toLocaleDateString()}.`,
    };
  }

  // Gate: Do not activate if item was returned or cancelled
  const isReturned = warranty.is_returned === true || warranty.is_returned === 1 || warranty.is_returned === '1' || warranty.is_returned === 'true';
  if (isReturned || ['RETURNED', 'WARRANTY_CANCELLED', 'WARRANTY_VOIDED'].includes(warranty.warranty_status)) {
    return {
      success: false,
      message: 'This product has been returned or cancelled and is not eligible for activation.',
    };
  }

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const prev = warranty.warranty_status;
  await warranty.update({
    warranty_status: WARRANTY_STATUSES.ACTIVE,
    status: 'ACTIVE',
    activated_at: now,
    warranty_activation_date: now,
    warranty_start_at: now,
    warranty_end_at: oneYearLater,
    warranty_start_date: now.toISOString().split('T')[0],
    warranty_end_date: oneYearLater.toISOString().split('T')[0],
    verification_status: 'VERIFIED',
  });

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: null,
    event_type: 'WARRANTY_ACTIVATED',
    from_status: prev,
    to_status: WARRANTY_STATUSES.ACTIVE,
    source_type: 'CUSTOMER',
    title: 'Customer Activated Warranty Coverage',
    description: `Customer completed online activation via signed token link. Coverage active through ${oneYearLater.toLocaleDateString()}.`,
    metadata: {
      client_ip: clientMetadata.ip || 'N/A',
      user_agent: clientMetadata.userAgent || 'N/A',
      activated_at: now,
    },
  });

  createAuditEvent({
    userId: warranty.customer_id,
    actorUserId: null,
    action: 'WARRANTY_ACTIVATED_BY_CUSTOMER',
    module: 'warranty',
    entityType: 'Warranty',
    entityId: warranty.id,
    metadata: {
      warranty_number: warranty.warranty_number,
      activated_at: now,
      expires_at: oneYearLater,
    },
  });

  // Step 9: Send official warranty_activated template to customer on WhatsApp
  await whatsappService.sendWarrantyActivatedConfirmation(warranty).catch((e) => {
    logger.warn(`Failed to send warranty_activated WhatsApp message for Warranty ${warranty.warranty_number}:`, e.message);
  });

  return {
    success: true,
    alreadyActive: false,
    warranty,
    message: 'Congratulations! Your AkuaBeat product warranty is now fully active for 1 year.',
  };
};

/**
 * 5. Controller / Admin Manual Activation
 */
exports.activateWarranty = async (id, actorUserId, options = {}) => {
  let effectiveActor = typeof actorUserId === 'string' ? actorUserId : null;
  let effectiveOptions = (actorUserId && typeof actorUserId === 'object' ? actorUserId : options) || {};
  if (effectiveOptions.actorUserId && typeof effectiveOptions.actorUserId === 'string') {
    effectiveActor = effectiveOptions.actorUserId;
  }

  const warranty = await Warranty.findByPk(id, {
    include: [
      { model: Customer, as: 'customer' },
      { model: Order, as: 'order' },
    ],
  });
  if (!warranty) throw new Error('Warranty record not found.');

  const now = new Date();
  const activationDate = effectiveOptions.activation_date ? new Date(effectiveOptions.activation_date) : now;
  const durationMonths = effectiveOptions.duration_months || 12;
  const expiryDate = new Date(activationDate);
  expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

  const prev = warranty.warranty_status;
  warranty.warranty_status = WARRANTY_STATUSES.ACTIVE;
  warranty.status = 'ACTIVE';
  warranty.activated_at = activationDate;
  warranty.warranty_activation_date = activationDate;
  warranty.warranty_start_at = activationDate;
  warranty.warranty_end_at = expiryDate;
  warranty.warranty_start_date = activationDate.toISOString().split('T')[0];
  warranty.warranty_end_date = expiryDate.toISOString().split('T')[0];
  warranty.warranty_expiry_date = expiryDate;
  warranty.verification_status = 'VERIFIED';
  warranty.verified_by = effectiveActor || (typeof warranty.verified_by === 'string' ? warranty.verified_by : null);
  warranty.verified_at = now;
  warranty.is_returned = false;

  await warranty.save();

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: effectiveActor || null,
    event_type: 'WARRANTY_ACTIVATED',
    from_status: prev,
    to_status: WARRANTY_STATUSES.ACTIVE,
    source_type: effectiveActor ? 'ADMIN' : 'SYSTEM',
    title: 'Warranty Activated by Operations Controller',
    description: `Coverage activated from ${activationDate.toLocaleDateString()} to ${expiryDate.toLocaleDateString()}.`,
  });

  createAuditEvent({
    userId: warranty.customer_id,
    actorUserId: effectiveActor,
    action: 'WARRANTY_ACTIVATED_MANUAL',
    module: 'warranty',
    entityType: 'Warranty',
    entityId: warranty.id,
    metadata: {
      warranty_number: warranty.warranty_number,
      activation_date: activationDate,
      expiry_date: expiryDate,
    },
  });

  // Step 9: Send official warranty_activated template to customer on WhatsApp
  await whatsappService.sendWarrantyActivatedConfirmation(warranty).catch((e) => {
    logger.warn(`Failed to send warranty_activated WhatsApp message for Warranty ${warranty.warranty_number}:`, e.message);
  });

  return exports.getWarrantyById(warranty.id);
};


/**
 * 6. Reverse Logistics: Request Return
 */
exports.requestReturn = async (warrantyId, payload = {}, actorUserId = null) => {
  const warranty = await Warranty.findByPk(warrantyId, {
    include: [{ model: Customer, as: 'customer' }, { model: Order, as: 'order' }],
  });
  if (!warranty) throw new Error('Warranty record not found.');

  if (!payload.reason_text || !payload.reason_text.trim()) {
    throw new Error('A detailed reason is required to request a return.');
  }

  const returnNumber = await generateReturnNumber();
  const returnRecord = await WarrantyReturn.create({
    return_number: returnNumber,
    warranty_id: warranty.id,
    order_id: warranty.order_id,
    customer_id: warranty.customer_id,
    requested_at: new Date(),
    request_source: payload.request_source || (actorUserId ? 'CRM_CONTROLLER' : 'CUSTOMER_WEB'),
    reason_code: payload.reason_code || 'DEFECTIVE',
    reason_text: payload.reason_text.trim(),
    photos_json: payload.photos_json || [],
    documents_json: payload.documents_json || [],
    status: RETURN_STATUSES.REQUESTED,
    notes: payload.notes || null,
    created_by: actorUserId,
  });

  const prevWarranty = warranty.warranty_status;
  await warranty.update({
    warranty_status: WARRANTY_STATUSES.RETURN_REQUESTED,
    return_status: RETURN_STATUSES.REQUESTED,
    return_requested_at: new Date(),
    return_id: returnRecord.id,
    returned_reason: payload.reason_text.trim(),
    is_returned: true,
  });

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: actorUserId,
    event_type: 'WARRANTY_RETURN_REQUESTED',
    from_status: prevWarranty,
    to_status: WARRANTY_STATUSES.RETURN_REQUESTED,
    source_type: returnRecord.request_source,
    source_id: returnRecord.id,
    title: `Product Return Requested (${returnNumber})`,
    description: `Reason: ${payload.reason_text.trim()}. Status marked RETURN_REQUESTED.`,
    metadata: { return_id: returnRecord.id, return_number: returnNumber },
  });

  createAuditEvent({
    userId: warranty.customer_id,
    actorUserId,
    action: 'WARRANTY_RETURN_REQUESTED',
    module: 'warranty_return',
    entityType: 'WarrantyReturn',
    entityId: returnRecord.id,
    metadata: { return_number: returnNumber, reason: payload.reason_text },
  });

  return returnRecord;
};

/**
 * 7. Reverse Logistics: Approve Return
 */
exports.approveReturn = async (returnId, actorUserId, notes = '') => {
  const returnRecord = await WarrantyReturn.findByPk(returnId, {
    include: [{ model: Warranty, as: 'warranty' }],
  });
  if (!returnRecord) throw new Error('Return record not found.');

  const warranty = returnRecord.warranty;
  if (!warranty) throw new Error('Associated warranty record not found.');

  const prevReturn = returnRecord.status;
  const prevWarranty = warranty.warranty_status;

  await returnRecord.update({
    status: RETURN_STATUSES.APPROVED,
    approved_by: actorUserId,
    approved_at: new Date(),
    notes: notes ? `${returnRecord.notes || ''}\n[Approved]: ${notes}`.trim() : returnRecord.notes,
  });

  await warranty.update({
    warranty_status: WARRANTY_STATUSES.RETURN_APPROVED,
    return_status: RETURN_STATUSES.APPROVED,
  });

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: actorUserId,
    event_type: 'WARRANTY_RETURN_APPROVED',
    from_status: prevWarranty,
    to_status: WARRANTY_STATUSES.RETURN_APPROVED,
    source_type: 'ADMIN',
    source_id: returnRecord.id,
    title: `Product Return Approved (${returnRecord.return_number})`,
    description: notes ? `Approved by controller. Note: ${notes}` : `Approved by controller. Ready for pickup dispatch.`,
  });

  createAuditEvent({
    userId: warranty.customer_id,
    actorUserId,
    action: 'WARRANTY_RETURN_APPROVED',
    module: 'warranty_return',
    entityType: 'WarrantyReturn',
    entityId: returnRecord.id,
    metadata: { return_number: returnRecord.return_number, notes },
  });

  return returnRecord;
};

/**
 * 8. Reverse Logistics: Reject Return
 */
exports.rejectReturn = async (returnId, actorUserId, reason = '') => {
  if (!reason || !reason.trim()) {
    throw new Error('A mandatory reason is required to reject a return.');
  }

  const returnRecord = await WarrantyReturn.findByPk(returnId, {
    include: [{ model: Warranty, as: 'warranty' }],
  });
  if (!returnRecord) throw new Error('Return record not found.');

  const warranty = returnRecord.warranty;
  const prevWarranty = warranty ? warranty.warranty_status : null;

  await returnRecord.update({
    status: RETURN_STATUSES.REJECTED,
    rejection_reason: reason.trim(),
  });

  if (warranty) {
    // Revert warranty to prior active or installation state if it was activated earlier
    const revertStatus = warranty.activated_at ? WARRANTY_STATUSES.ACTIVE : WARRANTY_STATUSES.INSTALLATION_COMPLETED;

    await warranty.update({
      warranty_status: revertStatus,
      return_status: RETURN_STATUSES.REJECTED,
      is_returned: false,
    });

    await WarrantyEvent.create({
      warranty_id: warranty.id,
      actor_user_id: actorUserId,
      event_type: 'WARRANTY_RETURN_REJECTED',
      from_status: prevWarranty,
      to_status: revertStatus,
      source_type: 'ADMIN',
      source_id: returnRecord.id,
      title: `Return Request Rejected (${returnRecord.return_number})`,
      description: `Return refused by controller. Reason: ${reason.trim()}. Warranty restored to ${revertStatus}.`,
    });
  }

  return returnRecord;
};

/**
 * 9. Reverse Logistics: Schedule Return Pickup
 */
exports.scheduleReturnPickup = async (returnId, pickupPayload = {}, actorUserId = null) => {
  const returnRecord = await WarrantyReturn.findByPk(returnId, {
    include: [{ model: Warranty, as: 'warranty' }],
  });
  if (!returnRecord) throw new Error('Return record not found.');

  const scheduledDate = pickupPayload.pickup_scheduled_date ? new Date(pickupPayload.pickup_scheduled_date) : new Date();

  await returnRecord.update({
    status: RETURN_STATUSES.PICKUP_SCHEDULED,
    pickup_partner: pickupPayload.pickup_partner || 'BlueDart Logistics',
    pickup_tracking_number: pickupPayload.pickup_tracking_number || `RET-TRK-${Date.now()}`,
    pickup_scheduled_date: scheduledDate,
    notes: pickupPayload.notes || returnRecord.notes,
  });

  if (returnRecord.warranty) {
    const prev = returnRecord.warranty.warranty_status;
    await returnRecord.warranty.update({
      warranty_status: WARRANTY_STATUSES.RETURN_PICKUP_SCHEDULED,
      return_status: RETURN_STATUSES.PICKUP_SCHEDULED,
    });

    await WarrantyEvent.create({
      warranty_id: returnRecord.warranty.id,
      actor_user_id: actorUserId,
      event_type: 'RETURN_PICKUP_SCHEDULED',
      from_status: prev,
      to_status: WARRANTY_STATUSES.RETURN_PICKUP_SCHEDULED,
      source_type: 'ADMIN',
      source_id: returnRecord.id,
      title: `Return Pickup Scheduled (${returnRecord.return_number})`,
      description: `Scheduled with ${returnRecord.pickup_partner} on ${scheduledDate.toLocaleDateString()}. Tracking: ${returnRecord.pickup_tracking_number}.`,
    });
  }

  return returnRecord;
};

/**
 * 10. Reverse Logistics: Mark Picked Up
 */
exports.markReturnPickedUp = async (returnId, payload = {}, actorUserId = null) => {
  const returnRecord = await WarrantyReturn.findByPk(returnId, {
    include: [{ model: Warranty, as: 'warranty' }],
  });
  if (!returnRecord) throw new Error('Return record not found.');

  const pickedUpAt = payload.picked_up_at ? new Date(payload.picked_up_at) : new Date();

  await returnRecord.update({
    status: RETURN_STATUSES.PICKED_UP,
    picked_up_at: pickedUpAt,
  });

  if (returnRecord.warranty) {
    await returnRecord.warranty.update({
      return_status: RETURN_STATUSES.PICKED_UP,
    });

    await WarrantyEvent.create({
      warranty_id: returnRecord.warranty.id,
      actor_user_id: actorUserId,
      event_type: 'PRODUCT_PICKED_UP',
      from_status: returnRecord.warranty.warranty_status,
      to_status: returnRecord.warranty.warranty_status,
      source_type: payload.source_type || 'DELIVERY',
      source_id: returnRecord.id,
      title: `Product Collected by Courier (${returnRecord.return_number})`,
      description: `Courier confirmed package pickup from customer address on ${pickedUpAt.toLocaleString()}.`,
    });
  }

  return returnRecord;
};

/**
 * 11. Reverse Logistics: Mark Warehouse Received
 */
exports.markReturnReceived = async (returnId, payload = {}, actorUserId = null) => {
  const returnRecord = await WarrantyReturn.findByPk(returnId, {
    include: [{ model: Warranty, as: 'warranty' }],
  });
  if (!returnRecord) throw new Error('Return record not found.');

  const receivedAt = payload.received_at ? new Date(payload.received_at) : new Date();

  await returnRecord.update({
    status: RETURN_STATUSES.RECEIVED,
    received_at: receivedAt,
  });

  if (returnRecord.warranty) {
    await returnRecord.warranty.update({
      return_status: RETURN_STATUSES.RECEIVED,
    });

    await WarrantyEvent.create({
      warranty_id: returnRecord.warranty.id,
      actor_user_id: actorUserId,
      event_type: 'PRODUCT_RECEIVED',
      from_status: returnRecord.warranty.warranty_status,
      to_status: returnRecord.warranty.warranty_status,
      source_type: 'ADMIN',
      source_id: returnRecord.id,
      title: `Product Received at Central Warehouse (${returnRecord.return_number})`,
      description: `Inward receipt confirmed on ${receivedAt.toLocaleString()}. Pending quality inspection.`,
    });
  }

  return returnRecord;
};

/**
 * 12. Reverse Logistics: Inspect Return
 */
exports.inspectReturn = async (returnId, inspectionData = {}, actorUserId = null) => {
  const returnRecord = await WarrantyReturn.findByPk(returnId, {
    include: [{ model: Warranty, as: 'warranty' }],
  });
  if (!returnRecord) throw new Error('Return record not found.');

  const inspectedAt = new Date();
  const result = inspectionData.inspection_result || 'PASS';
  const notes = inspectionData.inspection_notes || '';

  const nextStatus = result === 'PASS' ? RETURN_STATUSES.ACCEPTED : RETURN_STATUSES.INSPECTED;

  await returnRecord.update({
    status: nextStatus,
    inspected_at: inspectedAt,
    inspection_result: result,
    inspection_notes: notes,
  });

  if (returnRecord.warranty) {
    const isAccepted = nextStatus === RETURN_STATUSES.ACCEPTED;
    const prev = returnRecord.warranty.warranty_status;

    await returnRecord.warranty.update({
      return_status: nextStatus,
      ...(isAccepted && {
        warranty_status: WARRANTY_STATUSES.RETURNED,
        returned_at: inspectedAt,
      }),
    });

    await WarrantyEvent.create({
      warranty_id: returnRecord.warranty.id,
      actor_user_id: actorUserId,
      event_type: isAccepted ? 'PRODUCT_RETURNED' : 'PRODUCT_INSPECTED',
      from_status: prev,
      to_status: isAccepted ? WARRANTY_STATUSES.RETURNED : prev,
      source_type: 'ADMIN',
      source_id: returnRecord.id,
      title: `Warehouse Inspection: ${result} (${returnRecord.return_number})`,
      description: notes ? `Result: ${result}. Notes: ${notes}` : `Inspection result: ${result}. Status updated to ${nextStatus}.`,
    });
  }

  return returnRecord;
};

/**
 * 13. Reverse Logistics: Close Return & Issue Replacement or Refund
 */
exports.closeReturn = async (returnId, closeData = {}, actorUserId = null) => {
  const returnRecord = await WarrantyReturn.findByPk(returnId, {
    include: [
      { model: Warranty, as: 'warranty' },
      { model: Customer, as: 'customer' },
      { model: Order, as: 'order' },
    ],
  });
  if (!returnRecord) throw new Error('Return record not found.');

  const now = new Date();
  let replacementWarranty = null;

  // Handle Replacement Unit Creation if specified
  if (closeData.create_replacement && returnRecord.warranty) {
    const parentWarranty = returnRecord.warranty;
    const newWarNum = await generateWarrantyNumber();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    replacementWarranty = await Warranty.create({
      warranty_number: newWarNum,
      customer_id: parentWarranty.customer_id,
      order_id: parentWarranty.order_id,
      product_name_snapshot: closeData.replacement_product_name || parentWarranty.product_name_snapshot,
      brand_snapshot: parentWarranty.brand_snapshot,
      model_snapshot: closeData.replacement_model || parentWarranty.model_snapshot,
      serial_number: closeData.replacement_serial_number || null,
      unit_identifier: closeData.replacement_unit_id || null,
      marketplace: parentWarranty.marketplace,
      purchase_date: now,
      warranty_start_at: now,
      warranty_end_at: oneYearLater,
      warranty_start_date: now.toISOString().split('T')[0],
      warranty_end_date: oneYearLater.toISOString().split('T')[0],
      status: 'ACTIVE',
      warranty_status: WARRANTY_STATUSES.ACTIVE,
      return_status: RETURN_STATUSES.NONE,
      verification_status: 'VERIFIED',
      registration_source: 'REPLACEMENT',
      is_returned: false,
    });

    await WarrantyEvent.create({
      warranty_id: replacementWarranty.id,
      actor_user_id: actorUserId,
      event_type: 'WARRANTY_ACTIVATED',
      from_status: null,
      to_status: WARRANTY_STATUSES.ACTIVE,
      source_type: 'ADMIN',
      title: 'Replacement Warranty Created',
      description: `Replacement warranty generated for returned unit (${parentWarranty.warranty_number}). Parent Return ID: ${returnRecord.return_number}.`,
    });
  }

  await returnRecord.update({
    status: RETURN_STATUSES.CLOSED,
    closed_at: now,
    refund_id: closeData.refund_id || returnRecord.refund_id,
    replacement_order_id: closeData.replacement_order_id || returnRecord.replacement_order_id,
    replacement_warranty_id: replacementWarranty ? replacementWarranty.id : returnRecord.replacement_warranty_id,
    notes: closeData.notes ? `${returnRecord.notes || ''}\n[Closed]: ${closeData.notes}`.trim() : returnRecord.notes,
  });

  if (returnRecord.warranty) {
    const prev = returnRecord.warranty.warranty_status;
    await returnRecord.warranty.update({
      warranty_status: WARRANTY_STATUSES.RETURNED,
      return_status: RETURN_STATUSES.CLOSED,
      returned_at: returnRecord.warranty.returned_at || now,
    });

    await WarrantyEvent.create({
      warranty_id: returnRecord.warranty.id,
      actor_user_id: actorUserId,
      event_type: 'WARRANTY_CLOSED',
      from_status: prev,
      to_status: WARRANTY_STATUSES.RETURNED,
      source_type: 'ADMIN',
      source_id: returnRecord.id,
      title: `Return Process Closed (${returnRecord.return_number})`,
      description: `Return officially settled and closed. ${replacementWarranty ? `Replacement Warranty issued: ${replacementWarranty.warranty_number}` : ''}`,
    });
  }

  return { returnRecord, replacementWarranty };
};

/**
 * 14. Reset Warranty (Admin Action - Preserves Audit Trail)
 */
exports.resetWarranty = async (id, actorUserId, reason) => {
  if (!reason || !reason.trim()) {
    throw new Error('A mandatory reason is required to reset warranty.');
  }

  const warranty = await Warranty.findByPk(id);
  if (!warranty) throw new Error('Warranty record not found.');

  const oldStatus = warranty.warranty_status;
  const now = new Date();

  warranty.warranty_status = WARRANTY_STATUSES.WARRANTY_CANCELLED;
  warranty.status = 'CANCELLED';
  warranty.is_returned = true;
  warranty.warranty_reset_date = now;
  warranty.warranty_reset_by = actorUserId;
  warranty.warranty_reset_reason = reason.trim();

  await warranty.save();

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: actorUserId,
    event_type: 'WARRANTY_RESET',
    from_status: oldStatus,
    to_status: WARRANTY_STATUSES.WARRANTY_CANCELLED,
    source_type: 'ADMIN',
    title: 'Warranty Manually Reset / Cancelled',
    description: `Warranty reset by administrator. Reason: ${reason.trim()}. Audit trail preserved.`,
  });

  createAuditEvent({
    userId: warranty.customer_id,
    actorUserId,
    action: 'WARRANTY_RESET',
    module: 'warranty',
    entityType: 'Warranty',
    entityId: warranty.id,
    metadata: {
      warranty_number: warranty.warranty_number,
      previous_status: oldStatus,
      reset_reason: reason.trim(),
    },
  });

  return exports.getWarrantyById(warranty.id);
};

/**
 * 15. Get 10 Comprehensive Dashboard KPI Statistics
 */
exports.getWarrantyDashboardStats = async () => {
  const total = await Warranty.count();

  const pendingDelivery = await Warranty.count({
    where: {
      warranty_status: { [Op.in]: ['PENDING_DELIVERY', 'pending_delivery'] },
    },
  });

  const installationPending = await Warranty.count({
    where: {
      warranty_status: { [Op.in]: ['DELIVERED', 'INSTALLATION_PENDING', 'installation_pending', 'delivered'] },
      installation_completed_at: null,
    },
  });

  const activationPending = await Warranty.count({
    where: {
      [Op.or]: [
        { warranty_status: { [Op.in]: ['INSTALLATION_COMPLETED', 'ACTIVATION_MESSAGE_SCHEDULED', 'ACTIVATION_MESSAGE_SENT', 'ACTIVATION_PENDING', 'pending_activation'] } },
        { verification_status: 'PENDING' },
      ],
      activated_at: null,
    },
  });

  const active = await Warranty.count({
    where: {
      [Op.or]: [
        { warranty_status: { [Op.in]: ['ACTIVE', 'active'] } },
        { status: 'ACTIVE' },
      ],
      is_returned: false,
    },
  });

  // Expiring soon: ending in next 30 days
  const today = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);

  const expiringSoon = await Warranty.count({
    where: {
      status: 'ACTIVE',
      warranty_end_date: {
        [Op.between]: [today.toISOString().split('T')[0], thirtyDaysLater.toISOString().split('T')[0]],
      },
      is_returned: false,
    },
  });

  const returnRequested = await Warranty.count({
    where: {
      [Op.or]: [
        { return_status: { [Op.in]: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PICKUP_SCHEDULED'] } },
        { warranty_status: { [Op.in]: ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_PICKUP_SCHEDULED'] } },
      ],
    },
  });

  const returned = await Warranty.count({
    where: {
      [Op.or]: [
        { warranty_status: { [Op.in]: ['RETURNED', 'returned'] } },
        { return_status: { [Op.in]: ['RECEIVED', 'ACCEPTED', 'CLOSED'] } },
      ],
    },
  });

  const expired = await Warranty.count({
    where: {
      [Op.or]: [
        { warranty_status: { [Op.in]: ['WARRANTY_EXPIRED', 'WARRANTY_VOIDED', 'WARRANTY_CANCELLED', 'inactive', 'expired', 'voided'] } },
        { status: { [Op.in]: ['EXPIRED', 'CANCELLED', 'SUSPENDED'] } },
      ],
    },
  });

  const openServiceRequests = await WarrantyServiceRequest.count({
    where: {
      status: {
        [Op.notIn]: ['COMPLETED', 'CLOSED', 'REJECTED'],
      },
    },
  });

    const inactive = Math.max(0, total - active);

  return {
    total,
    active,
    inactive,
    pendingDelivery,
    installationPending,
    activationPending,
    expiringSoon,
    returnRequested,
    returned,
    expired,
    openServiceRequests,
  };
};

/**
 * 16. Get Warranties List with Advanced Filters & Sorting
 */
exports.getWarrantiesList = async (query = {}) => {
  const {
    status,
    warranty_status,
    return_status,
    verification_status,
    is_returned,
    delivery_from,
    delivery_to,
    installation_from,
    installation_to,
    activation_from,
    activation_to,
    search,
    page = 1,
    limit = 20,
  } = query;

  const where = {};

  if (status) {
    if (status === 'EXPIRING_SOON') {
      const today = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(today.getDate() + 30);
      where.status = 'ACTIVE';
      where.warranty_end_date = {
        [Op.between]: [today.toISOString().split('T')[0], thirtyDaysLater.toISOString().split('T')[0]],
      };
      where.is_returned = false;
    } else if (status === 'INACTIVE' || status === 'inactive') {
      where[Op.or] = [
        { status: { [Op.notIn]: ['ACTIVE', 'active'] } },
        { warranty_status: { [Op.notIn]: ['ACTIVE', 'active'] } },
      ];
    } else {
      where.status = status;
    }
  }
  if (warranty_status) {
    const norm = normalizeWarrantyStatus(warranty_status);
    where[Op.or] = [
      { warranty_status: norm },
      { warranty_status: warranty_status },
      { warranty_status: warranty_status.toLowerCase() },
    ];
  }
  if (return_status) where.return_status = normalizeReturnStatus(return_status);
  if (verification_status) where.verification_status = verification_status;
  if (is_returned !== undefined) where.is_returned = is_returned === 'true' || is_returned === true;

  // Date ranges
  if (delivery_from && delivery_to) {
    where.delivered_at = { [Op.between]: [new Date(delivery_from), new Date(delivery_to)] };
  }
  if (installation_from && installation_to) {
    where.installation_completed_at = { [Op.between]: [new Date(installation_from), new Date(installation_to)] };
  }
  if (activation_from && activation_to) {
    where.activated_at = { [Op.between]: [new Date(activation_from), new Date(activation_to)] };
  }

  if (search) {
    const searchFilter = {
      [Op.or]: [
        { warranty_number: { [Op.like]: `%${search}%` } },
        { product_name_snapshot: { [Op.like]: `%${search}%` } },
        { model_snapshot: { [Op.like]: `%${search}%` } },
        { serial_number: { [Op.like]: `%${search}%` } },
        { tracking_number: { [Op.like]: `%${search}%` } },
        { '$customer.name$': { [Op.like]: `%${search}%` } },
        { '$customer.phone$': { [Op.like]: `%${search}%` } },
        { '$order.order_number$': { [Op.like]: `%${search}%` } },
      ],
    };
    Object.assign(where, searchFilter);
  }

  const offset = (Number(page) - 1) * Number(limit);

  const { rows: warranties, count: total } = await Warranty.findAndCountAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email', 'city', 'state'] },
      { model: Order, as: 'order', attributes: ['id', 'order_number', 'marketplace_order_id', 'status', 'created_at'] },
      { model: User, as: 'resetByUser', attributes: ['id', 'name', 'email', 'role'] },
      { model: WarrantyReturn, as: 'returns', limit: 1, order: [['created_at', 'DESC']] },
    ],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset,
  });

  return {
    warranties,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * 17. Get Returns List for Dedicated Returns & Reverse Logistics Tab
 */
exports.getReturnsList = async (query = {}) => {
  const { page = 1, limit = 20, search, status } = query;
  const where = {};

  if (status) {
    where.status = normalizeReturnStatus(status);
  }

  if (search) {
    where[Op.or] = [
      { return_number: { [Op.like]: `%${search}%` } },
      { reason_text: { [Op.like]: `%${search}%` } },
      { pickup_tracking_number: { [Op.like]: `%${search}%` } },
      { '$customer.name$': { [Op.like]: `%${search}%` } },
      { '$customer.phone$': { [Op.like]: `%${search}%` } },
      { '$warranty.warranty_number$': { [Op.like]: `%${search}%` } },
      { '$order.order_number$': { [Op.like]: `%${search}%` } },
    ];
  }

  const offset = (Number(page) - 1) * Number(limit);

  const { rows: returns, count: total } = await WarrantyReturn.findAndCountAll({
    where,
    include: [
      { model: Warranty, as: 'warranty' },
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email', 'city'] },
      { model: Order, as: 'order', attributes: ['id', 'order_number', 'marketplace_order_id'] },
      { model: User, as: 'approver', attributes: ['id', 'name', 'email'] },
    ],
    order: [['created_at', 'DESC']],
    limit: Number(limit),
    offset,
  });

  return {
    returns,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * 18. Get Warranty Details with Documents, Timeline, Returns, Messages, and Service Requests
 */
exports.getWarrantyById = async (id) => {
  const warranty = await Warranty.findByPk(id, {
    include: [
      { model: Customer, as: 'customer' },
      { model: Order, as: 'order' },
      { model: User, as: 'verifier', attributes: ['id', 'name', 'email', 'role'] },
      { model: User, as: 'resetByUser', attributes: ['id', 'name', 'email', 'role'] },
      { model: WarrantyDocument, as: 'documents' },
      {
        model: WarrantyReturn,
        as: 'returns',
        include: [{ model: User, as: 'approver', attributes: ['id', 'name', 'email'] }],
        order: [['created_at', 'DESC']],
      },
      {
        model: WarrantyMessage,
        as: 'messages',
        order: [['created_at', 'DESC']],
      },
      {
        model: WarrantyServiceRequest,
        as: 'serviceRequests',
        include: [{ model: User, as: 'technician', attributes: ['id', 'name', 'phone', 'email'] }],
      },
      {
        model: WarrantyEvent,
        as: 'events',
        include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email', 'role'] }],
        order: [['timestamp', 'DESC']],
      },
    ],
  });

  if (warranty && warranty.documents) {
    warranty.documents.forEach((doc) => {
      if (doc.file_path) {
        doc.file_path = normalizeDocPath(doc.file_path);
      }
    });
  }

  return warranty;
};

/**
 * 19. Verify or Reject Warranty Registration (Admin Action)
 */
exports.verifyWarranty = async (id, status, verifierId, rejectionReason = null) => {
  const warranty = await Warranty.findByPk(id);
  if (!warranty) throw new Error('Warranty record not found.');

  const isVerified = status === 'VERIFIED';
  const prev = warranty.warranty_status;

  warranty.verification_status = isVerified ? 'VERIFIED' : 'REJECTED';
  warranty.status = isVerified ? 'ACTIVE' : 'CANCELLED';
  if (isVerified) {
    warranty.warranty_status = WARRANTY_STATUSES.ACTIVE;
    warranty.activated_at = new Date();
    warranty.warranty_activation_date = new Date();
  } else {
    warranty.warranty_status = WARRANTY_STATUSES.WARRANTY_CANCELLED;
  }
  warranty.verified_by = verifierId;
  warranty.verified_at = new Date();
  if (rejectionReason) warranty.rejection_reason = rejectionReason;

  await warranty.save();

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: verifierId,
    event_type: isVerified ? 'WARRANTY_VERIFIED' : 'WARRANTY_REJECTED',
    from_status: prev,
    to_status: warranty.warranty_status,
    source_type: 'ADMIN',
    title: isVerified ? 'Warranty Verified & Activated' : 'Warranty Registration Rejected',
    description: isVerified ? 'Verified by controller. Status set to ACTIVE.' : `Rejected: ${rejectionReason || 'Invalid proof'}`,
  });

  createAuditEvent({
    userId: null,
    actorUserId: verifierId,
    action: isVerified ? 'WARRANTY_VERIFIED' : 'WARRANTY_REJECTED',
    module: 'warranty',
    entityType: 'Warranty',
    entityId: warranty.id,
    metadata: { warranty_number: warranty.warranty_number, status: warranty.status },
  });

  return warranty;
};

/**
 * 20. Service Requests
 */
exports.createServiceRequest = async (payload, actorUserId) => {
  const warranty = await Warranty.findByPk(payload.warranty_id);
  if (!warranty) throw new Error('Warranty record not found.');

  const srNumber = await generateServiceRequestNumber();
  const initialStatus = payload.technician_id ? 'TECHNICIAN_ASSIGNED' : 'NEW';
  const finalIssue = payload.issue || payload.issue_type || payload.title || payload.description || 'General Maintenance';

  const serviceRequest = await WarrantyServiceRequest.create({
    service_request_number: srNumber,
    warranty_id: warranty.id,
    customer_id: warranty.customer_id,
    technician_id: payload.technician_id || null,
    created_by: actorUserId,
    issue: finalIssue,
    description: payload.description || '',
    priority: payload.priority || 'MEDIUM',
    status: initialStatus,
    assigned_at: payload.technician_id ? new Date() : null,
  });

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: actorUserId,
    event_type: 'SERVICE_REQUEST_CREATED',
    source_type: 'ADMIN',
    source_id: serviceRequest.id,
    title: `Service Request Created (${srNumber})`,
    description: `Issue: ${finalIssue}`,
  });

  return serviceRequest;
};

exports.updateServiceRequestStatus = async (srId, payload, actorUserId) => {
  const sr = await WarrantyServiceRequest.findByPk(srId, {
    include: [{ model: Warranty, as: 'warranty' }],
  });
  if (!sr) throw new Error('Service Request not found.');

  const oldStatus = sr.status;
  const newStatus = payload.status;

  sr.status = newStatus;
  if (newStatus === 'IN_PROGRESS' && !sr.started_at) sr.started_at = new Date();
  if (newStatus === 'COMPLETED') {
    sr.completed_at = new Date();
    if (payload.resolution) sr.resolution = payload.resolution;
    if (payload.parts_used) sr.parts_used = payload.parts_used;
  }

  await sr.save();

  await WarrantyEvent.create({
    warranty_id: sr.warranty_id,
    actor_user_id: actorUserId,
    event_type: `SERVICE_${newStatus}`,
    source_type: 'TECHNICIAN',
    source_id: sr.id,
    title: `Service Request ${newStatus} (${sr.service_request_number})`,
    description: payload.resolution || `Status changed from ${oldStatus} to ${newStatus}`,
  });

  return sr;
};

/**
 * 21. Order Lookup for Auto-fill
 */
exports.lookupOrderDetails = async (orderIdQuery) => {
  if (!orderIdQuery || typeof orderIdQuery !== 'string') return null;
  let query = orderIdQuery.trim();
  query = query.replace(/^(order\s*(id|no|number|#)?\s*[:#-]?\s*|#+)/i, '').trim();
  if (query.length < 2) return null;

  const raw = query;
  const clean = raw.replace(/^(AMA-|FK-|IM-|ORD-|KR-|WEB-|DIR-|SHOP-|STORE-|B2B-)/i, '').trim();

  const exactConditions = [
    { order_number: raw },
    { marketplace_order_id: raw },
    { tracking_number: raw },
    { id: raw },
  ];

  if (clean && clean !== raw) {
    exactConditions.push({ order_number: clean });
    exactConditions.push({ marketplace_order_id: clean });
    exactConditions.push({ tracking_number: clean });
  }

  let order = await Order.findOne({
    where: { [Op.or]: exactConditions },
    include: [{ model: Customer, as: 'customer' }],
    order: [['created_at', 'DESC']],
  });

  if (!order) {
    order = await Order.findOne({
      where: {
        [Op.or]: [
          { order_number: { [Op.like]: `%${clean}%` } },
          { marketplace_order_id: { [Op.like]: `%${clean}%` } },
          { tracking_number: { [Op.like]: `%${clean}%` } },
        ],
      },
      include: [{ model: Customer, as: 'customer' }],
      order: [['created_at', 'DESC']],
    });
  }

  return order;
};

exports.getProductsSkuList = async () => {
  const products = await Order.findAll({
    attributes: [
      'product_sku',
      'product_name',
      [sequelize.fn('COUNT', sequelize.col('Order.id')), 'total_orders'],
    ],
    where: { product_sku: { [Op.ne]: null } },
    group: ['product_sku', 'product_name'],
    order: [[sequelize.literal('total_orders'), 'DESC']],
    raw: true,
  });
  return products;
};

exports.getCustomersBySku = async (skuQuery) => {
  if (!skuQuery || typeof skuQuery !== 'string') return [];
  const cleanSku = skuQuery.trim();

  return Order.findAll({
    where: {
      [Op.or]: [
        { product_sku: cleanSku },
        { product_sku: { [Op.like]: `%${cleanSku}%` } },
        { product_name: { [Op.like]: `%${cleanSku}%` } },
      ],
    },
    include: [
      { model: Customer, as: 'customer' },
      { model: Warranty, as: 'warranty' },
    ],
    order: [['order_date', 'DESC'], ['created_at', 'DESC']],
    limit: 200,
  });
};

/**
 * 22. Retry Failed WhatsApp Message
 */
exports.retryWarrantyMessage = async (messageId, actorUserId = null) => {
  const msg = await WarrantyMessage.findByPk(messageId, {
    include: [
      {
        model: Warranty,
        as: 'warranty',
        include: [{ model: Customer, as: 'customer' }, { model: Order, as: 'order' }],
      },
    ],
  });

  if (!msg) throw new Error('Message record not found.');

  const warranty = msg.warranty;
  if (!warranty) throw new Error('Associated warranty record not found.');

  const token = generateActivationToken(warranty, 7);
  const activationUrl = getActivationUrl(token);

  await msg.update({
    attempt_count: msg.attempt_count + 1,
    activation_token: token,
    activation_url: activationUrl,
    delivery_status: 'QUEUED',
  });

  const whatsappService = require('./whatsappService');
  const sendResult = await whatsappService.sendWarrantyActivationMessage({
    warranty,
    token,
    activationUrl,
    idempotencyKey: msg.idempotency_key,
  });

  const providerMsgId = sendResult?.waMessageId || `msg_retry_${Date.now()}`;

  await msg.update({
    delivery_status: 'SENT',
    provider_message_id: providerMsgId,
    sent_at: new Date(),
    failure_reason: null,
  });

  await WarrantyEvent.create({
    warranty_id: warranty.id,
    actor_user_id: actorUserId,
    event_type: 'ACTIVATION_MESSAGE_SENT',
    from_status: warranty.warranty_status,
    to_status: warranty.warranty_status,
    source_type: 'ADMIN',
    title: 'Warranty Activation Message Retried',
    description: `Manual retry dispatched to ${msg.phone_number}. Provider ID: ${providerMsgId}`,
  });

  return msg;
};
