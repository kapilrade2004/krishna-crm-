'use strict';

const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { sequelize, Order, Customer, User, OrderActivity, WhatsAppLog, FollowUp, CustomerImage, WhatsAppOutbox, CsvImportBatch, Warranty } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination, getOrder } = require('../utils/response');
const whatsappService = require('../services/whatsappService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const warrantyService = require('../services/warrantyService');
const productMasterService = require('../services/productMasterService');
const s3Service = require('../services/s3Service');
const OrderVerificationWorkflowService = require('../services/orderVerificationWorkflowService');
const logger = require('../config/logger');

/**
 * Enriches an array of CustomerImage models or objects with valid Presigned S3 viewing URLs
 */
const enrichCustomerImages = async (images) => {
  if (!images || !Array.isArray(images)) return [];
  const backendBase = (
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_BASE_URL ||
    process.env.APP_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://krishabackend.vasifytech.com' : 'http://localhost:5000')
  ).replace(/\/+$/, '');

  return Promise.all(
    images.map(async (img) => {
      const imgJson = typeof img.toJSON === 'function' ? img.toJSON() : { ...img };
      let presignedUrl = null;

      // 1. Try to generate presigned URL for S3 key or direct S3 URL
      if (imgJson.s3_key) {
        presignedUrl = await s3Service.getPresignedViewUrl({ key: imgJson.s3_key, expiresIn: 86400 });
      } else if (imgJson.file_url && (imgJson.file_url.includes('.amazonaws.com') || imgJson.file_url.includes('customer_images/'))) {
        presignedUrl = await s3Service.getPresignedViewUrl({ key: imgJson.file_url, expiresIn: 86400 });
      }

      // If presignedUrl is a relative path or local fallback, normalize it
      if (presignedUrl && presignedUrl.startsWith('/')) {
        const cleanPath = presignedUrl.replace(/^\/+/, '');
        const rel = cleanPath.startsWith('uploads/') ? cleanPath : `uploads/${cleanPath}`;
        presignedUrl = `${backendBase}/${rel}`;
      }

      // 2. Direct backend proxy view URL as reliable fallback
      const proxyViewUrl = imgJson.id ? `${backendBase}/api/orders/images/${imgJson.id}/view` : null;

      // 3. Final display URL: prefer valid presigned S3 URL, then proxyViewUrl, then file_url
      let finalUrl = presignedUrl || proxyViewUrl || imgJson.file_url || null;
      if (finalUrl && finalUrl.startsWith('/')) {
        const clean = finalUrl.replace(/^\/+/, '');
        const rel = clean.startsWith('uploads/') ? clean : `uploads/${clean}`;
        finalUrl = `${backendBase}/${rel}`;
      }

      let rawFileUrl = presignedUrl || imgJson.file_url || finalUrl;
      if (rawFileUrl && rawFileUrl.startsWith('/')) {
        const clean = rawFileUrl.replace(/^\/+/, '');
        const rel = clean.startsWith('uploads/') ? clean : `uploads/${clean}`;
        rawFileUrl = `${backendBase}/${rel}`;
      }

      return {
        ...imgJson,
        presigned_url: finalUrl,
        view_url: finalUrl,
        file_url: rawFileUrl || finalUrl,
        proxy_view_url: proxyViewUrl,
      };
    })
  );
};

const autoHealOrderImages = async (order) => {
  if (!order) return [];
  try {
    const phone = order.customer_phone || order.shipping_address?.ship_phone || order.shipping_address?.phone || order.customer?.phone || order.customer?.whatsapp_number;
    const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : null;

    const unlinkedCriteria = [];
    if (order.customer_id) {
      unlinkedCriteria.push({ customer_id: order.customer_id });
    }
    if (cleanPhone && cleanPhone.length >= 7) {
      unlinkedCriteria.push(
        sequelize.literal(`EXISTS (SELECT 1 FROM whatsapp_logs wl WHERE wl.wa_message_id = CustomerImage.wa_message_id AND wl.phone_number LIKE '%${cleanPhone}%')`)
      );
    }
    if (unlinkedCriteria.length === 0) return [];

    const unlinked = await CustomerImage.findAll({
      where: {
        order_id: null,
        [Op.or]: unlinkedCriteria,
      },
      order: [['uploaded_at', 'DESC']],
    });

    if (unlinked && unlinked.length > 0) {
      for (const img of unlinked) {
        await img.update({
          order_id: order.id,
          customer_id: order.customer_id || img.customer_id,
        });
      }
      if (order.flow_stage === 'awaiting_screenshot' || !order.images_provided || order.verification_status === 'pending_verification') {
        await order.update({
          status: order.status === 'confirmed' ? order.status : 'image_verification',
          verification_status: 'image_received',
          images_provided: true,
          flow_stage: 'match_pending',
          screenshot_received_at: order.screenshot_received_at || new Date(),
        });
      }
      return unlinked;
    }
  } catch (err) {
    logger.warn(`autoHealOrderImages error for order ${order.id}:`, err.message);
  }
  return [];
};

const ALLOWED_SORT = ['order_date', 'created_at', 'total_amount', 'status', 'marketplace', 'verification_status'];

// ─── Valid status transitions ────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  pending:              ['image_verification', 'pending_confirmation', 'confirmed', 'cancelled', 'verification_exception'],
  image_verification:   ['pending_confirmation', 'confirmed', 'cancelled', 'verification_exception'],
  pending_confirmation: ['confirmed', 'cancelled', 'verification_exception'],
  confirmed:            ['processing', 'dispatched', 'delivered', 'cancelled'],
  processing:           ['dispatched', 'delivered', 'cancelled'],
  dispatched:           ['delivered', 'returned'],
  delivered:            ['returned', 'refunded'],
  cancelled:            [],
  returned:             ['refunded'],
  refunded:             [],
  verification_exception: ['pending_verification', 'image_verification', 'pending_confirmation', 'cancelled', 'confirmed'],
};

const canTransition = (from, to) => {
  const allowed = VALID_TRANSITIONS[from] || [];
  return allowed.includes(to);
};

// ─── Workflow Diagnosis (Section 78) ─────────────────────────────────────────
const computeWorkflowDiagnosis = (ord) => {
  if (!ord) return null;
  const now = new Date();
  let deadline = null;
  let deadlineType = null;
  let automaticActionOnTimeout = 'None (Awaiting Manual or External Event)';
  let nextExpectedInput = 'None';
  let waitingSince = ord.updated_at || ord.created_at;

  if (ord.status === 'pending' || ord.status === 'image_verification') {
    if (ord.second_message_due_at) {
      deadline = ord.second_message_due_at;
      deadlineType = '15_MIN_SCREENSHOT_WINDOW';
      automaticActionOnTimeout = 'Auto-dispatch Message 2 (order_confirmation013)';
      nextExpectedInput = 'Customer Screenshot (Tap / Purifier Photo)';
      waitingSince = ord.screenshot_requested_at || ord.updated_at;
    } else if (ord.verification_status === 'pending_verification') {
      nextExpectedInput = 'Customer Response ([Yes, Confirm] / [Send Screenshot] / [Cancel Order])';
      waitingSince = ord.created_at;
    } else if (ord.verification_status === 'image_received') {
      nextExpectedInput = 'Operator Review (Click [Matched] or [SKU Mismatch])';
      waitingSince = ord.screenshot_received_at || ord.updated_at;
    }
  } else if (ord.status === 'pending_confirmation') {
    nextExpectedInput = 'Customer Confirmation on Message 2 ([Confirm Order] / [Cancel Order])';
    waitingSince = ord.second_message_sent_at || ord.updated_at;
    if (ord.final_confirmation_due_at) {
      deadline = ord.final_confirmation_due_at;
      deadlineType = 'FINAL_CONFIRMATION_WINDOW';
      automaticActionOnTimeout = 'Auto-cancel Order (CUSTOMER_NO_RESPONSE_AFTER_FINAL_CONFIRMATION)';
    }
  } else if (ord.status === 'confirmed') {
    nextExpectedInput = 'Warehouse Packing & Dispatch (Courier AWB Assignment)';
    waitingSince = ord.customer_confirmed_at || ord.updated_at;
  } else if (ord.status === 'dispatched') {
    nextExpectedInput = 'Courier Delivery Event';
    waitingSince = ord.dispatched_at || ord.updated_at;
  } else if (ord.status === 'delivered') {
    nextExpectedInput = 'Customer Installation & 24h Warranty Claim';
    waitingSince = ord.delivered_at || ord.updated_at;
  } else if (ord.status === 'cancelled') {
    nextExpectedInput = 'Order Closed (Terminal State)';
    automaticActionOnTimeout = 'None (Cancelled)';
  }

  const isExpired = deadline ? new Date(deadline) <= now : false;

  return {
    order_id: ord.id,
    order_number: ord.order_number,
    status: ord.status,
    flow_stage: ord.flow_stage,
    verification_status: ord.verification_status,
    waiting_since: waitingSince,
    deadline,
    deadline_type: deadlineType,
    is_deadline_expired: isExpired,
    next_expected_input: nextExpectedInput,
    automatic_action_on_timeout: automaticActionOnTimeout,
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const logActivity = async (orderId, userId, action, fromValue, toValue, note = null, t = null) => {
  const opts = t ? { transaction: t } : {};
  await OrderActivity.create(
    { order_id: orderId, user_id: userId, action, from_value: fromValue, to_value: toValue, note },
    opts
  );
};

/**
 * Ensures a Customer record exists in the database once an order is delivered (fulfilled).
 * If the customer doesn't exist yet, creates them from the order's recipient data and links order.customer_id.
 * If the customer already exists, links and increments stats.
 */
const ensureCustomerOnDelivery = async (order, transaction = null) => {
  if (!order) return null;

  let customer = null;

  // 1. If already linked, fetch customer
  if (order.customer_id) {
    customer = await Customer.findByPk(order.customer_id, { transaction });
  }

  // 2. If not linked, search by phone
  const rawPhone = order.customer_phone || order.shipping_address?.ship_phone || (order.customer && order.customer.phone);
  const phone = rawPhone ? String(rawPhone).trim() : null;

  if (!customer && phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    const last10 = cleanPhone.slice(-10);
    if (last10) {
      customer = await Customer.findOne({
        where: {
          [Op.or]: [
            { phone: { [Op.like]: `%${last10}` } },
            { whatsapp_number: { [Op.like]: `%${last10}` } },
          ],
        },
        transaction,
      });
    }
  }

  const orderTotal = Number(order.total_amount) || 0;

  if (customer) {
    // Customer exists: link order if not linked
    if (order.customer_id !== customer.id) {
      await order.update({ customer_id: customer.id }, { transaction });
      order.customer_id = customer.id;
    }
    order.customer = customer;

    // Update customer stats
    await customer.increment({
      total_orders: 1,
      total_revenue: orderTotal,
    }, { transaction });

    // Advance lifecycle stage to installation_pending if prospect or customer
    if (['prospect', 'customer'].includes(customer.lifecycle_stage)) {
      await customer.update({ lifecycle_stage: 'installation_pending' }, { transaction });
    }
    return customer;
  }

  // 3. Create new Customer on delivery
  const shipAddr = order.shipping_address || {};
  const customerName = order.customer_name || shipAddr.name || 'Valued Customer';
  const customerEmail = order.customer_email || shipAddr.email || null;
  const pincode = order.delivery_pincode || shipAddr.pincode || null;

  customer = await Customer.create({
    name: customerName,
    phone: phone || null,
    whatsapp_number: phone || null,
    email: customerEmail,
    address_line1: shipAddr.line1 || shipAddr.address_line1 || null,
    address_line2: shipAddr.line2 || shipAddr.address_line2 || null,
    city: shipAddr.city || null,
    state: shipAddr.state || null,
    pincode: pincode,
    source: order.marketplace || 'direct',
    status: 'active',
    lifecycle_stage: 'installation_pending',
    total_orders: 1,
    total_revenue: orderTotal,
    whatsapp_opt_in: true,
  }, { transaction });

  await order.update({ customer_id: customer.id }, { transaction });
  order.customer_id = customer.id;
  order.customer = customer;

  logger.info(`[OrderDelivery] Customer #${customer.id} (${customer.name}) officially registered upon delivery of Order #${order.order_number}`);
  return customer;
};

exports.ensureCustomerOnDelivery = ensureCustomerOnDelivery;

// ─── GET /api/orders ──────────────────────────────────────────────────────────
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const order = getOrder(req.query, ALLOWED_SORT);

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.verification_status) where.verification_status = req.query.verification_status;
    const andClauses = [];
    if (req.query.marketplace) {
      const mp = String(req.query.marketplace).toLowerCase().trim();
      if (mp === 'amazon') {
        andClauses.push({
          [Op.or]: [
            { marketplace: 'amazon' },
            { channel: { [Op.like]: 'amazon%' } },
          ],
        });
      } else {
        andClauses.push({
          [Op.or]: [
            { marketplace: req.query.marketplace },
            { channel: req.query.marketplace },
          ],
        });
      }
    }
    if (req.query.channel) where.channel = req.query.channel;
    if (req.query.flow_stage) where.flow_stage = req.query.flow_stage;
    if (req.query.assigned_to) where.assigned_to = req.query.assigned_to;
    if (req.query.import_batch_id) where.import_batch_id = req.query.import_batch_id;
    if (req.query.from_date && req.query.to_date) {
      where.order_date = { [Op.between]: [req.query.from_date, req.query.to_date] };
    }

    // q= searches order fields; customer_name= searches via join
    const customerWhere = {};
    if (req.query.customer_name) {
      customerWhere.name = { [Op.like]: `%${req.query.customer_name}%` };
    }

    if (req.query.q) {
      andClauses.push({
        [Op.or]: [
          { order_number: { [Op.like]: `%${req.query.q}%` } },
          { marketplace_order_id: { [Op.like]: `%${req.query.q}%` } },
          { customer_name: { [Op.like]: `%${req.query.q}%` } },
          { customer_phone: { [Op.like]: `%${req.query.q}%` } },
          { product_name: { [Op.like]: `%${req.query.q}%` } },
          { tracking_number: { [Op.like]: `%${req.query.q}%` } },
        ],
      });
    }

    if (andClauses.length > 0) {
      where[Op.and] = andClauses;
    }

    const [
      [
        totalCount,
        pendingVerifCount,
        imgReceivedCount,
        pendingConfCount,
        confirmedCount,
        inTransitCount,
        deliveredCount,
        cancelledCount,
        exceptionsCount,
      ],
      orderSearchResult,
    ] = await Promise.all([
      Promise.all([
        Order.count(),
        Order.count({ where: { verification_status: { [Op.in]: ['pending_verification', 'screenshot_requested'] } } }),
        Order.count({ where: { verification_status: 'image_received' } }),
        Order.count({ where: { status: 'pending_confirmation' } }),
        Order.count({ where: { status: { [Op.in]: ['confirmed', 'processing'] } } }),
        Order.count({ where: { status: { [Op.in]: ['dispatched', 'in_transit'] } } }),
        Order.count({ where: { status: 'delivered' } }),
        Order.count({ where: { status: 'cancelled' } }),
        Order.count({ where: { verification_status: 'verification_exception' } }),
      ]),
      Order.findAndCountAll({
        where,
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'phone', 'whatsapp_number', 'email', 'address_line1', 'address_line2', 'city', 'state', 'pincode'],
            where: Object.keys(customerWhere).length ? customerWhere : undefined,
            required: Object.keys(customerWhere).length > 0,
          },
          { model: User, as: 'assignedUser', attributes: ['id', 'name'] },
          {
            model: CsvImportBatch,
            as: 'importBatch',
            attributes: ['id', 'filename', 'marketplace', 'channel', 'created_at', 'processed_at'],
          },
          {
            model: CustomerImage,
            as: 'customerImages',
            required: false,
          },
        ],
        order,
        limit,
        offset,
        distinct: true,
      }),
    ]);

    const { count, rows } = orderSearchResult;

    const enrichedRows = await Promise.all(
      rows.map(async (row) => {
        const rowJson = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
        if (!rowJson.customerImages || rowJson.customerImages.length === 0) {
          const healed = await autoHealOrderImages(row);
          if (healed.length > 0) {
            rowJson.customerImages = healed;
          }
        }
        if (rowJson.customerImages && rowJson.customerImages.length > 0) {
          rowJson.customerImages = await enrichCustomerImages(rowJson.customerImages);
        }
        return rowJson;
      })
    );

    sendPaginated(res, enrichedRows, { total: count, page, limit }, {
      stats: {
        total: totalCount,
        pending_verification: pendingVerifCount,
        image_received: imgReceivedCount,
        pending_confirmation: pendingConfCount,
        confirmed: confirmedCount,
        pending_dispatch: confirmedCount,
        in_transit: inTransitCount,
        dispatched: inTransitCount,
        delivered: deliveredCount,
        cancelled: cancelledCount,
        exceptions: exceptionsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/orders/stats ────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    const dateWhere = from_date && to_date
      ? { order_date: { [Op.between]: [from_date, to_date] } }
      : {};

    const [byStatus, byMarketplace, byFlowStage, byVerificationStatus, totals] = await Promise.all([
      Order.findAll({
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: dateWhere,
        group: ['status'],
        raw: true,
      }),
      Order.findAll({
        attributes: [
          'marketplace',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('total_amount')), 'revenue'],
        ],
        where: dateWhere,
        group: ['marketplace'],
        raw: true,
      }),
      Order.findAll({
        attributes: ['flow_stage', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: dateWhere,
        group: ['flow_stage'],
        raw: true,
      }),
      Order.findAll({
        attributes: ['verification_status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: dateWhere,
        group: ['verification_status'],
        raw: true,
      }),
      Order.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_orders'],
          [sequelize.fn('SUM', sequelize.col('total_amount')), 'total_revenue'],
          [sequelize.fn('AVG', sequelize.col('total_amount')), 'avg_order_value'],
        ],
        where: dateWhere,
        raw: true,
      }),
    ]);

    sendSuccess(res, { stats: { byStatus, byMarketplace, byFlowStage, byVerificationStatus, totals: totals[0] } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const ord = await Order.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        {
          model: CustomerImage,
          as: 'customerImages',
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
          order: [['uploaded_at', 'DESC']],
        },
        {
          model: OrderActivity,
          as: 'activities',
          include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
          order: [['created_at', 'DESC']],
        },
        { model: WhatsAppLog, as: 'whatsappLogs', order: [['created_at', 'DESC']], limit: 20 },
        {
          model: CsvImportBatch,
          as: 'importBatch',
          attributes: ['id', 'filename', 'marketplace', 'channel', 'created_at', 'processed_at', 'uploaded_by'],
          include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
        },
      ],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    if (!ord.customerImages || ord.customerImages.length === 0) {
      const healed = await autoHealOrderImages(ord);
      if (healed.length > 0) {
        ord.customerImages = await CustomerImage.findAll({
          where: { order_id: ord.id },
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
          order: [['uploaded_at', 'DESC']],
        });
      }
    }

    const enrichedImages = await enrichCustomerImages(ord.customerImages || []);
    const ordJson = ord.toJSON();
    ordJson.customerImages = enrichedImages;
    const diagnosis = computeWorkflowDiagnosis(ordJson);

    sendSuccess(res, { order: ordJson, workflowDiagnosis: diagnosis });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders ─────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const idempotencyKey = req.headers?.['idempotency-key'] || req.body?.idempotency_key || null;

    // Fast-path Idempotency Check: Prevent duplicate order placements
    if (idempotencyKey) {
      const existing = await Order.findOne({
        where: {
          [Op.or]: [
            { order_number: idempotencyKey },
            { marketplace_order_id: idempotencyKey },
          ],
        },
        include: [{ model: Customer, as: 'customer' }],
      });
      if (existing) {
        return sendSuccess(res, { order: existing }, 'Order already exists (idempotent replay).');
      }
    } else if (req.body.marketplace_order_id && req.body.marketplace) {
      const existing = await Order.findOne({
        where: {
          marketplace_order_id: req.body.marketplace_order_id,
          marketplace: req.body.marketplace,
        },
        include: [{ model: Customer, as: 'customer' }],
      });
      if (existing) {
        return sendSuccess(res, { order: existing }, 'Order already exists for this marketplace order ID.');
      }
    }

    let customerId = req.body.customer_id || null;
    const phone = req.body.customer_phone ? String(req.body.customer_phone).trim() : null;
    const customerName = req.body.customer_name ? String(req.body.customer_name).trim() : null;
    const customerEmail = req.body.customer_email ? String(req.body.customer_email).trim() : null;

    // Check if repeat registered customer exists by phone
    if (!customerId && phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const last10 = cleanPhone.slice(-10);
      if (last10) {
        const existingCustomer = await Customer.findOne({
          where: {
            [Op.or]: [
              { phone: { [Op.like]: `%${last10}` } },
              { whatsapp_number: { [Op.like]: `%${last10}` } },
            ],
          },
        });
        if (existingCustomer) {
          customerId = existingCustomer.id;
          if (customerName && existingCustomer.name === 'Unknown') {
            await existingCustomer.update({ name: customerName });
          }
        }
      }
    }

    // Recipient info validation
    if (!customerId && !phone && !customerName) {
      return next(new AppError('Recipient name or phone number is required to create an order.', 400));
    }

    const orderNumber = req.body.order_number || `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const shippingAddress = req.body.shipping_address || {
      name: customerName,
      line1: req.body.address_line1 || null,
      line2: req.body.address_line2 || null,
      city: req.body.city || null,
      state: req.body.state || null,
      pincode: req.body.delivery_pincode || null,
      ship_phone: phone || null,
    };

    const ord = await Order.create({
      ...req.body,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: phone,
      customer_email: customerEmail,
      shipping_address: shippingAddress,
      order_number: orderNumber,
      status: req.body.status || 'pending',
      verification_status: req.body.verification_status || 'pending_verification',
      flow_stage: req.body.flow_stage || 'ask_images',
      assigned_to: req.body.assigned_to || req.user?.id || null,
    });

    await logActivity(ord.id, req.user?.id || ord.assigned_to, 'order_created', null, ord.status);

    // If order was created directly with status 'delivered', immediately fulfill and register customer
    if (ord.status === 'delivered') {
      await ensureCustomerOnDelivery(ord);
    } else if (customerId) {
      // If linked to existing customer, update their metrics
      const orderTotal = Number(ord.total_amount) || 0;
      const linkedCust = await Customer.findByPk(customerId);
      if (linkedCust) {
        await linkedCust.increment('total_orders', { by: 1 });
        if (orderTotal > 0) {
          await linkedCust.increment('total_revenue', { by: orderTotal });
        }
        await linkedCust.update({
          status: 'active',
          last_contacted_at: new Date(),
        });
      }
    }

    const reloaded = await Order.findByPk(ord.id, {
      include: [{ model: Customer, as: 'customer' }],
    });

    // Automated WhatsApp verification message orchestration
    const waPhone = reloaded.customer?.whatsapp_number || reloaded.customer?.phone || reloaded.customer_phone || ord.customer_phone;
    if (waPhone && reloaded.status !== 'cancelled' && reloaded.status !== 'confirmed') {
      try {
        await OrderVerificationWorkflowService.initiateFirstVerification({
          orderId: ord.id,
          phone: waPhone,
          triggerWorker: true,
        });
        const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
        setImmediate(() => {
          whatsappOutboxQueue.processQueue().catch((err) => {
            logger.warn(`Immediate outbox dispatch notice for order ${ord.id}:`, err.message);
          });
        });
      } catch (queueErr) {
        logger.error(`Outbox enqueue failed for Order #${reloaded.order_number}:`, queueErr.message);
      }
    }

    sendCreated(res, { order: reloaded }, 'Order created successfully.');
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      const orderNumber = req.body?.order_number || req.headers?.['idempotency-key'] || req.body?.idempotency_key;
      const marketplaceOrderId = req.body?.marketplace_order_id;
      try {
        const existing = await Order.findOne({
          where: {
            [Op.or]: [
              ...(orderNumber ? [{ order_number: orderNumber }] : []),
              ...(marketplaceOrderId ? [{ marketplace_order_id: marketplaceOrderId }] : []),
            ],
          },
          include: [{ model: Customer, as: 'customer' }],
        });
        if (existing) {
          return sendSuccess(res, { order: existing }, 'Order already created by concurrent request.');
        }
      } catch (findErr) {
        logger.warn('Concurrent order lookup notice:', findErr.message);
      }
    }
    next(err);
  }
};

// ─── PATCH /api/orders/:id ────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const allowed = [
      'product_name', 'product_sku', 'quantity', 'unit_price', 'total_amount',
      'discount_amount', 'shipping_charge', 'shipping_partner', 'tracking_number',
      'shipping_address', 'delivery_pincode', 'estimated_delivery_date',
      'assigned_to', 'internal_notes', 'images_provided', 'order_date',
      'marketplace_order_id', 'customer_feedback', 'feedback_rating',
      'verification_status', 'flow_stage',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    await ord.update(updates);

    // Update recipient details on order or linked Customer
    let customerUpdated = false;
    if (req.body.customer_name || req.body.customer_phone || req.body.customer_email) {
      if (ord.customer) {
        await ord.customer.update({
          ...(req.body.customer_name && { name: req.body.customer_name }),
          ...(req.body.customer_phone && { phone: req.body.customer_phone, whatsapp_number: req.body.customer_phone }),
          ...(req.body.customer_email && { email: req.body.customer_email }),
        });
        customerUpdated = true;
      } else {
        await ord.update({
          ...(req.body.customer_name && { customer_name: req.body.customer_name }),
          ...(req.body.customer_phone && { customer_phone: req.body.customer_phone }),
          ...(req.body.customer_email && { customer_email: req.body.customer_email }),
        });
        customerUpdated = true;
      }
    }

    if (Object.keys(updates).length > 0 || customerUpdated) {
      await logActivity(ord.id, req.user?.id || null, 'order_updated', null, null,
        `Fields updated: ${Object.keys(updates).concat(customerUpdated ? ['customer_details'] : []).join(', ')}`);
    }

    const reloaded = await Order.findByPk(ord.id, {
      include: [{ model: Customer, as: 'customer' }],
    });

    sendSuccess(res, { order: reloaded }, 'Order updated.');
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/orders/:id/verification-status ──────────────────────────────
exports.updateVerificationStatus = async (req, res, next) => {
  try {
    const { verification_status, note } = req.body;
    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const validStatuses = [
      'pending_verification',
      'image_received',
      'verification_in_review',
      'sku_matched',
      'sku_mismatched',
      'image_unreadable',
      'product_not_found',
      'pending_confirmation',
      'confirmed',
      'cancelled',
      'verification_exception',
    ];

    if (!validStatuses.includes(verification_status)) {
      return next(new AppError(`Invalid verification status '${verification_status}'.`, 400));
    }

    const prev = ord.verification_status;
    await ord.update({
      verification_status,
      verified_by: req.user.id,
      verified_at: new Date(),
      ...(note && { verification_notes: note }),
    });

    await logActivity(ord.id, req.user.id, 'verification_status_changed', prev, verification_status, note);
    sendSuccess(res, { order: ord }, `Verification status updated to '${verification_status}'.`);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/orders/:id/status ─────────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    // ── Transition guard ──────────────────────────────────────────────────────
    if (!canTransition(ord.status, status)) {
      return next(new AppError(
        `Cannot transition order from '${ord.status}' to '${status}'. ` +
        `Allowed next states: ${(VALID_TRANSITIONS[ord.status] || []).join(', ') || 'none'}.`,
        422
      ));
    }

    const prev = ord.status;
    await ord.update({
      status,
      ...(status === 'confirmed' && {
        verification_status: 'confirmed',
        flow_stage: ['ask_images', 'match_pending'].includes(ord.flow_stage) ? 'match_confirmed' : ord.flow_stage,
        second_message_due_at: null,
        customer_confirmed_at: ord.customer_confirmed_at || new Date(),
      }),
      ...(status === 'dispatched' && { dispatched_at: new Date() }),
      ...(status === 'delivered' && { delivered_at: new Date() }),
    });
    await logActivity(ord.id, req.user.id, 'status_changed', prev, status, note);

    // Automated outbox orchestration on order lifecycle state changes
    if (status === 'delivered') {
      try {
        await ensureCustomerOnDelivery(ord);
        const DeliveryEventOrchestrator = require('../services/orderWorkflow/deliveryEventOrchestrator');
        await DeliveryEventOrchestrator.handleOrderDelivered(ord, { actor: req.user?.id, source: 'manual_status_update' });
      } catch (e) {
        logger.warn('Delivery orchestration notice:', e.message);
      }
    } else if (status === 'dispatched') {
      try {
        const DeliveryEventOrchestrator = require('../services/orderWorkflow/deliveryEventOrchestrator');
        await DeliveryEventOrchestrator.handleOrderDispatched(ord, { actor: req.user?.id, source: 'manual_status_update' });
      } catch (e) {
        logger.warn('Dispatch orchestration notice:', e.message);
      }
    } else if (status === 'confirmed') {
      try {
        const OrderWorkflowService = require('../services/orderWorkflow/orderWorkflowService');
        await OrderWorkflowService.transitionOrder({
          orderId: ord.id,
          targetState: 'CONFIRMED',
          actor: req.user?.id ? `user:${req.user.id}` : 'admin',
          source: 'manual_status_update',
          note: note || 'Confirmed by CRM operator',
        });
      } catch (e) {
        logger.warn('Confirmation workflow notice:', e.message);
      }
    }

    sendSuccess(res, { order: ord }, `Order status updated to '${status}'.`);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/orders/:id/flow-stage ─────────────────────────────────────────
exports.updateFlowStage = async (req, res, next) => {
  try {
    const { flow_stage, note } = req.body;
    const ord = await Order.findByPk(req.params.id);
    if (!ord) return next(new AppError('Order not found.', 404));

    const prev = ord.flow_stage;
    await ord.update({ flow_stage });
    await logActivity(ord.id, req.user.id, 'flow_stage_changed', prev, flow_stage, note);
    sendSuccess(res, { order: ord }, 'Flow stage updated.');
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/orders/bulk-status ────────────────────────────────────────────
exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { order_ids, status, note } = req.body;

    const orders = await Order.findAll({
      where: { id: { [Op.in]: order_ids } },
      include: [{ model: Customer, as: 'customer' }],
    });

    if (orders.length === 0) {
      return next(new AppError('No valid orders found for the provided IDs.', 404));
    }

    const results = { updated: [], skipped: [], errors: [] };
    const t = await sequelize.transaction();

    try {
      for (const ord of orders) {
        if (!canTransition(ord.status, status)) {
          results.skipped.push({
            id: ord.id,
            order_number: ord.order_number,
            reason: `Cannot transition from '${ord.status}' to '${status}'`,
          });
          continue;
        }
        const prev = ord.status;
        await ord.update({
          status,
          ...(status === 'confirmed' && { second_message_due_at: null }),
          ...(status === 'dispatched' && { dispatched_at: new Date() }),
          ...(status === 'delivered' && { delivered_at: new Date() }),
        }, { transaction: t });
        await logActivity(ord.id, req.user.id, 'status_changed', prev, status,
          note || `Bulk update to ${status}`, t);
        results.updated.push(ord.id);

        if (status === 'delivered') {
          await ensureCustomerOnDelivery(ord, t);
        }
      }
      await t.commit();

      // Post-commit outbox orchestration
      for (const ord of orders) {
        if (!results.updated.includes(ord.id)) continue;
        try {
          if (status === 'delivered') {
            const DeliveryEventOrchestrator = require('../services/orderWorkflow/deliveryEventOrchestrator');
            await DeliveryEventOrchestrator.handleOrderDelivered(ord, { actor: req.user?.id, source: 'bulk_status_update' });
          } else if (status === 'dispatched') {
            const DeliveryEventOrchestrator = require('../services/orderWorkflow/deliveryEventOrchestrator');
            await DeliveryEventOrchestrator.handleOrderDispatched(ord, { actor: req.user?.id, source: 'bulk_status_update' });
          } else if (status === 'confirmed') {
            const OrderWorkflowService = require('../services/orderWorkflow/orderWorkflowService');
            await OrderWorkflowService.transitionOrder({
              orderId: ord.id,
              targetState: 'CONFIRMED',
              actor: req.user?.id ? `user:${req.user.id}` : 'admin',
              source: 'bulk_status_update',
              note: note || 'Bulk confirmed by CRM operator',
            });
          }
        } catch (postCommitErr) {
          logger.warn(`Post-commit orchestration notice for order ${ord.id}:`, postCommitErr.message);
        }
      }
    } catch (err) {
      await t.rollback();
      throw err;
    }

    sendSuccess(res, { results }, `Bulk update complete. ${results.updated.length} updated, ${results.skipped.length} skipped.`);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/bulk-delete ─────────────────────────────────────────────
exports.bulkDelete = async (req, res, next) => {
  try {
    const { order_ids } = req.body;
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return next(new AppError('No order IDs provided.', 400));
    }

    await OrderActivity.destroy({ where: { order_id: { [Op.in]: order_ids } } });
    await CustomerImage.destroy({ where: { order_id: { [Op.in]: order_ids } } });
    await FollowUp.destroy({ where: { order_id: { [Op.in]: order_ids } } });
    const count = await Order.destroy({ where: { id: { [Op.in]: order_ids } } });

    sendSuccess(res, { deletedCount: count }, `Successfully deleted ${count} order(s).`);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/bulk-assign ─────────────────────────────────────────────
exports.bulkAssign = async (req, res, next) => {
  try {
    const { order_ids, assigned_to } = req.body;
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return next(new AppError('No order IDs provided.', 400));
    }

    const [count] = await Order.update(
      { assigned_to: assigned_to || null },
      { where: { id: { [Op.in]: order_ids } } }
    );

    sendSuccess(res, { updatedCount: count }, `Successfully assigned ${count} order(s).`);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/export ──────────────────────────────────────────────────
exports.exportOrders = async (req, res, next) => {
  try {
    const XLSX = require('xlsx');
    const {
      order_ids,
      status,
      marketplace,
      channel,
      flow_stage,
      assigned_to,
      from_date,
      to_date,
      q,
      columns = [],
      format = 'xlsx',
    } = req.body;

    const where = {};
    if (order_ids && Array.isArray(order_ids) && order_ids.length > 0) {
      where.id = { [Op.in]: order_ids };
    } else {
      if (status) where.status = status;
      if (marketplace) where.marketplace = marketplace;
      if (channel) where.channel = channel;
      if (flow_stage) where.flow_stage = flow_stage;
      if (assigned_to) where.assigned_to = assigned_to;
      if (from_date && to_date) {
        where.order_date = { [Op.between]: [from_date, to_date] };
      }
      if (q) {
        where[Op.or] = [
          { order_number: { [Op.like]: `%${q}%` } },
          { marketplace_order_id: { [Op.like]: `%${q}%` } },
          { product_name: { [Op.like]: `%${q}%` } },
          { tracking_number: { [Op.like]: `%${q}%` } },
        ];
      }
    }

    const orders = await Order.findAll({
      where,
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    });

    const columnDefinitions = {
      order_number: { label: 'Order #', get: (o) => o.order_number },
      marketplace_order_id: { label: 'Marketplace Order ID', get: (o) => o.marketplace_order_id || '' },
      marketplace: { label: 'Marketplace', get: (o) => o.marketplace },
      channel: { label: 'Channel', get: (o) => o.channel || '' },
      customer_name: { label: 'Customer Name', get: (o) => o.customer?.name || 'Awaiting Registration' },
      customer_phone: { label: 'Customer Mobile', get: (o) => o.customer?.phone || '' },
      customer_email: { label: 'Customer Email', get: (o) => o.customer?.email || '' },
      address: { label: 'Address Line 1', get: (o) => o.customer?.address_line1 || o.shipping_address?.line1 || '' },
      city: { label: 'City', get: (o) => o.customer?.city || o.shipping_address?.city || '' },
      state: { label: 'State', get: (o) => o.customer?.state || o.shipping_address?.state || '' },
      pincode: { label: 'Pincode', get: (o) => o.customer?.pincode || o.delivery_pincode || '' },
      product_name: { label: 'Product Name', get: (o) => o.product_name || '' },
      product_sku: { label: 'Product SKU', get: (o) => o.product_sku || '' },
      quantity: { label: 'Quantity', get: (o) => o.quantity || 1 },
      unit_price: { label: 'Unit Price (INR)', get: (o) => o.unit_price || 0 },
      total_amount: { label: 'Total Amount (INR)', get: (o) => o.total_amount || 0 },
      status: { label: 'Status', get: (o) => o.status },
      flow_stage: { label: 'Flow Stage', get: (o) => o.flow_stage },
      order_date: { label: 'Order Date', get: (o) => o.order_date || o.created_at },
      tracking_number: { label: 'Tracking #', get: (o) => o.tracking_number || '' },
      shipping_partner: { label: 'Shipping Partner', get: (o) => o.shipping_partner || '' },
      assigned_to: { label: 'Assigned Staff', get: (o) => o.assignedUser?.name || 'Unassigned' },
    };

    const exportColumns = selectedColKeys.map((k) => ({
      key: k,
      label: columnDefinitions[k].label,
    }));

    const exportData = orders.map((o) => {
      const row = {};
      selectedColKeys.forEach((k) => {
        row[k] = columnDefinitions[k].get(o);
      });
      return row;
    });

    const { sendExportResponse } = require('../utils/exportHelper');
    await sendExportResponse({
      res,
      title: 'Orders Export Report',
      filenameBase: 'orders_export',
      format,
      columns: exportColumns,
      data: exportData,
      metadata: {
        generatedBy: req.user ? req.user.name : 'Staff',
        filters: status || marketplace || flow_stage ? `Status: ${status || 'All'}, Market: ${marketplace || 'All'}` : 'All Matching',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/orders/:id ───────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const ord = await Order.findByPk(req.params.id);
    if (!ord) return next(new AppError('Order not found.', 404));
    await ord.destroy();
    await logActivity(req.params.id, req.user.id, 'order_deleted', ord.status, null);
    sendSuccess(res, null, 'Order deleted.');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/orders/:id/activities ──────────────────────────────────────────
exports.getActivities = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await OrderActivity.findAndCountAll({
      where: { order_id: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// ─── CR1: POST /api/orders/:id/approve-images ────────────────────────────────
// Approves images for this order → advances to PENDING_CUSTOMER_CONFIRMATION and queues order_verification013
exports.approveImages = async (req, res, next) => {
  try {
    const { image_id, imageId, note } = req.body || {};
    const targetImageId = image_id || imageId;

    const result = await OrderVerificationWorkflowService.handleCrmMatch(
      req.params.id,
      req.user?.id || null,
      { notes: note || 'Product tap photo/screenshot approved by verifier.', imageId: targetImageId }
    );

    if (!result.success) {
      return next(new AppError(result.message || 'Cannot approve images for this order in its current state.', 400));
    }

    const reloaded = await Order.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        {
          model: CustomerImage,
          as: 'customerImages',
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
          order: [['uploaded_at', 'DESC']],
        },
      ],
    });

    const enrichedImages = await enrichCustomerImages(reloaded.customerImages || []);
    const ordJson = reloaded.toJSON();
    ordJson.customerImages = enrichedImages;

    sendSuccess(
      res,
      { order: ordJson, images: enrichedImages },
      'Images approved successfully. Final verification message (order_confirmation013) queued for customer confirmation.'
    );
  } catch (err) {
    next(err);
  }
};

// ─── CR1: POST /api/orders/:id/reject-images ─────────────────────────────────
// Rejects images — order stays in image_verification, reason stored, WA sent
exports.rejectImages = async (req, res, next) => {
  try {
    const { reason, image_id, imageId, request_new = true } = req.body || {};
    if (!reason) return next(new AppError('Rejection reason is required.', 400));
    const targetImageId = image_id || imageId;

    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));
    if (!['pending', 'pending_confirmation', 'image_verification'].includes(ord.status)) {
      return next(new AppError(`Cannot reject images for an order with status '${ord.status}'.`, 422));
    }

    const whereClause = { order_id: ord.id };
    if (targetImageId) {
      whereClause.id = targetImageId;
    } else {
      whereClause.status = 'received';
    }

    // Mark received images as rejected
    await CustomerImage.update(
      { status: 'rejected', reviewed_by: req.user.id, reviewed_at: new Date(), rejection_reason: reason },
      { where: whereClause }
    );

    await ord.update({
      status: 'image_verification',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      images_provided: false,
      image_rejection_reason: reason,
    });

    await logActivity(ord.id, req.user.id, 'images_rejected', ord.verification_status, 'image_verification', reason);

    // Send WA asking for new images
    if (request_new && (ord.customer?.whatsapp_number || ord.customer?.phone)) {
      const sendFn = whatsappService.sendOrderVerificationInteractive || whatsappService.sendProductVerificationTemplate;
      if (typeof sendFn === 'function') {
        sendFn(ord, reason).catch((e) =>
          logger.warn('WhatsApp image request failed:', e.message)
        );
      }
    }

    const reloaded = await Order.findByPk(ord.id, {
      include: [
        { model: Customer, as: 'customer' },
        {
          model: CustomerImage,
          as: 'customerImages',
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
          order: [['uploaded_at', 'DESC']],
        },
      ],
    });

    const enrichedImages = await enrichCustomerImages(reloaded.customerImages || []);
    const ordJson = reloaded.toJSON();
    ordJson.customerImages = enrichedImages;

    sendSuccess(res, { order: ordJson, images: enrichedImages }, 'Images rejected. Customer notified to resend.');
  } catch (err) {
    next(err);
  }
};

// ─── CR7: PATCH /api/orders/:id/feedback-resolution ──────────────────────────
// Records feedback outcome; auto-creates follow-up when customer is unhappy
exports.updateFeedbackResolution = async (req, res, next) => {
  try {
    const { feedback_status, feedback_issue_notes, customer_feedback, feedback_rating } = req.body;

    if (!feedback_status) return next(new AppError('feedback_status is required.', 400));

    const validStatuses = ['not_collected', 'happy', 'unhappy', 'escalated', 'resolved'];
    if (!validStatuses.includes(feedback_status)) {
      return next(new AppError(`Invalid feedback_status. Must be one of: ${validStatuses.join(', ')}`, 422));
    }

    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const prev = ord.feedback_status;
    await ord.update({
      feedback_status,
      ...(feedback_issue_notes !== undefined && { feedback_issue_notes }),
      ...(customer_feedback !== undefined && { customer_feedback }),
      ...(feedback_rating !== undefined && { feedback_rating }),
      // Advance flow_stage to completed if happy/resolved
      ...((['happy', 'resolved'].includes(feedback_status) && ord.flow_stage === 'feedback_pending') && {
        flow_stage: 'completed',
      }),
    });

    await logActivity(ord.id, req.user.id, 'feedback_updated', prev, feedback_status, feedback_issue_notes);

    // CR7 — auto-create a high-priority follow-up for unhappy/escalated customers
    if (['unhappy', 'escalated'].includes(feedback_status)) {
      await FollowUp.create({
        customer_id: ord.customer_id,
        order_id: ord.id,
        assigned_to: ord.assigned_to || req.user.id,
        type: 'call',
        priority: feedback_status === 'escalated' ? 'urgent' : 'high',
        status: 'pending',
        subject: `[${feedback_status.toUpperCase()}] Customer issue — Order ${ord.order_number}`,
        notes: feedback_issue_notes || 'Customer reported issue after delivery. Call and resolve.',
        due_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // due in 2 hours
      });

      logger.info(`Auto follow-up created for unhappy customer on order ${ord.order_number}`);
    }

    sendSuccess(res, { order: ord }, 'Feedback resolution updated.');
  } catch (err) {
    next(err);
  }
};

// ─── CR3: GET /api/orders/:id/images ─────────────────────────────────────────
exports.getOrderImages = async (req, res, next) => {
  try {
    let images = await CustomerImage.findAll({
      where: { order_id: req.params.id },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
      order: [['uploaded_at', 'DESC']],
    });

    if (!images || images.length === 0) {
      const ord = await Order.findByPk(req.params.id, {
        include: [{ model: Customer, as: 'customer' }],
      });
      if (ord) {
        const healed = await autoHealOrderImages(ord);
        if (healed.length > 0) {
          images = await CustomerImage.findAll({
            where: { order_id: ord.id },
            include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
            order: [['uploaded_at', 'DESC']],
          });
        }
      }
    }

    const enriched = await enrichCustomerImages(images);
    sendSuccess(res, { images: enriched });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/orders/:id/assign-image/:imageId ─────────────────────────────
// Allows operator to assign an unlinked customer image to an active order
exports.assignImageToOrder = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;
    const ord = await Order.findByPk(id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const image = await CustomerImage.findByPk(imageId);
    if (!image) return next(new AppError('Customer image not found.', 404));

    await image.update({
      order_id: ord.id,
      customer_id: ord.customer_id,
    });

    const prev = ord.flow_stage;
    await ord.update({
      status: ord.status === 'confirmed' ? ord.status : 'image_verification',
      verification_status: 'image_received',
      images_provided: true,
      flow_stage: 'match_pending',
      screenshot_received_at: ord.screenshot_received_at || new Date(),
    });

    await logActivity(
      ord.id,
      req.user.id,
      'customer_image_assigned',
      prev,
      'match_pending',
      `Manual image assignment to Order #${ord.order_number} by ${req.user.name || 'Staff'}.`
    );

    const enriched = await enrichCustomerImages([image]);
    sendSuccess(res, { image: enriched[0] }, 'Image successfully assigned to order.');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/orders/images/:imageId/view & /api/orders/images/view ───────────
// Public / authenticated proxy view endpoint for reliable customer image rendering
exports.viewCustomerImage = async (req, res, next) => {
  try {
    const { imageId } = req.params || {};
    const queryKey = req.query?.key || req.query?.url || req.query?.path;

    let img = null;
    if (imageId && imageId !== 'view') {
      img = await CustomerImage.findByPk(imageId);
    }

    // 1. Determine target key / URL
    const targetKey = img ? (img.s3_key || img.file_url) : queryKey;
    if (!targetKey && !img) {
      return res.status(404).send('Image key or ID not provided');
    }

    // 2. Try S3 presigned URL
    if (targetKey) {
      const presigned = await s3Service.getPresignedViewUrl({ key: targetKey, expiresIn: 3600 });
      if (presigned && /^https?:\/\//i.test(presigned) && !presigned.includes('/uploads/')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.redirect(302, presigned);
      }
    }

    // 3. Try local disk backup in uploads
    const cleanKey = (targetKey || '').replace(/^\/+/, '').replace(/^uploads\//, '');
    const uploadRoot = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    const localCandidates = [
      path.join(uploadRoot, cleanKey),
      path.join(uploadRoot, 'customer_images', cleanKey),
      path.join(uploadRoot, path.basename(cleanKey)),
    ];

    for (const cand of localCandidates) {
      if (cand && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        res.setHeader('Content-Type', img?.mime_type || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return fs.createReadStream(cand).pipe(res);
      }
    }

    // 4. If targetKey or file_url is an external HTTP URL, redirect
    const externalUrl = img?.file_url || targetKey;
    if (externalUrl && /^https?:\/\//i.test(externalUrl)) {
      return res.redirect(302, externalUrl);
    }

    return res.status(404).send('Image binary not available on storage');
  } catch (err) {
    logger.error('Error in viewCustomerImage:', err);
    res.status(500).send('Error loading image');
  }
};

// ─── GET /api/orders/:id/verification-detail ───────────────────────────────
exports.getVerificationDetail = async (req, res, next) => {
  try {
    const ord = await Order.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'verifier', attributes: ['id', 'name', 'email'] },
        {
          model: CustomerImage,
          as: 'customerImages',
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
          order: [['uploaded_at', 'DESC']],
        },
        {
          model: OrderActivity,
          as: 'activities',
          include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
          order: [['created_at', 'DESC']],
        },
        { model: WhatsAppLog, as: 'whatsappLogs', order: [['created_at', 'DESC']], limit: 20 },
      ],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    if (!ord.customerImages || ord.customerImages.length === 0) {
      const healed = await autoHealOrderImages(ord);
      if (healed.length > 0) {
        ord.customerImages = await CustomerImage.findAll({
          where: { order_id: ord.id },
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'name'] }],
          order: [['uploaded_at', 'DESC']],
        });
      }
    }

    const productMaster = productMasterService.getBySku(ord.product_sku);
    const enrichedImages = await enrichCustomerImages(ord.customerImages || []);

    const ordJson = ord.toJSON();
    ordJson.customerImages = enrichedImages;
    const diagnosis = computeWorkflowDiagnosis(ordJson);

    sendSuccess(res, {
      order: ordJson,
      productMaster,
      customerImages: enrichedImages,
      workflowDiagnosis: diagnosis,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/sku-match ──────────────────────────────────────────
exports.skuMatch = async (req, res, next) => {
  try {
    const notes = req.body.notes || 'Ordered SKU matches Product Master and Customer Image SKU.';
    const result = await OrderVerificationWorkflowService.handleCrmMatch(
      req.params.id,
      req.user?.id || null,
      { notes }
    );

    if (!result.success) {
      return next(new AppError(result.message || 'Cannot match SKU for this order in its current state.', 400));
    }

    const reloaded = await Order.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'verifier', attributes: ['id', 'name'] },
      ],
    });

    sendSuccess(res, { order: reloaded, outboxEvent: result.outboxEvent }, 'Product matched successfully. Confirmation message (order_confirmation013) queued for customer.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/sku-mismatch ───────────────────────────────────────
exports.skuMismatch = async (req, res, next) => {
  try {
    const { notes, reason } = req.body;
    const ord = await Order.findByPk(req.params.id);
    if (!ord) return next(new AppError('Order not found.', 404));

    const prev = ord.verification_status;
    const mismatchNotes = notes || reason || 'Customer image SKU does not match ordered SKU.';

    await ord.update({
      verification_status: 'sku_mismatched',
      status: 'image_verification',
      verification_notes: mismatchNotes,
      image_rejection_reason: mismatchNotes,
    });

    await logActivity(
      ord.id,
      req.user.id,
      'sku_mismatched',
      prev,
      'sku_mismatched',
      mismatchNotes
    );

    sendSuccess(res, { order: ord }, 'Marked SKU as mismatched.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/request-new-image ──────────────────────────────────
exports.requestNewImage = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const prev = ord.verification_status;

    await ord.update({
      status: 'image_verification',
      verification_status: 'pending_verification',
      images_provided: false,
      image_rejection_reason: reason || 'Please resend a clear screenshot of your order.',
    });

    await logActivity(
      ord.id,
      req.user.id,
      'new_image_requested',
      prev,
      'pending_verification',
      reason || 'Requested new image from customer.'
    );

    // Send WhatsApp order_verification_interactive template requesting new image
    if (ord.customer?.phone || ord.customer?.whatsapp_number) {
      const sendFn = whatsappService.sendOrderVerificationInteractive || whatsappService.sendProductVerificationTemplate;
      if (typeof sendFn === 'function') {
        sendFn(ord, reason)
          .catch((e) => logger.warn('WhatsApp requestNewImage failed:', e.message));
      }
    }

    sendSuccess(res, { order: ord }, 'Requested new image from customer on WhatsApp.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/mark-unreadable ────────────────────────────────────
exports.markUnreadable = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const ord = await Order.findByPk(req.params.id);
    if (!ord) return next(new AppError('Order not found.', 404));

    const prev = ord.verification_status;
    const unreadableNotes = notes || 'Customer photo is blurry or unreadable.';

    await ord.update({
      verification_status: 'image_unreadable',
      verification_notes: unreadableNotes,
    });

    await logActivity(
      ord.id,
      req.user.id,
      'image_unreadable',
      prev,
      'image_unreadable',
      unreadableNotes
    );

    sendSuccess(res, { order: ord }, 'Marked customer image as unreadable.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/send-verification ──────────────────────────────────
exports.sendVerification = async (req, res, next) => {
  try {
    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const phone = ord.customer?.whatsapp_number || ord.customer?.phone || ord.customer_phone || (ord.shipping_address && ord.shipping_address.ship_phone);
    if (!phone) {
      return next(new AppError('Customer has no valid phone number for WhatsApp message.', 400));
    }

    const waResult = await whatsappService.sendProductVerificationTemplate(ord);
    await logActivity(
      ord.id,
      req.user?.id || null,
      'whatsapp_verification_sent',
      ord.verification_status,
      'pending_verification',
      `Manual WhatsApp verification message dispatched to customer (${phone}).`
    );

    const reloaded = await Order.findByPk(ord.id, {
      include: [{ model: Customer, as: 'customer' }],
    });

    sendSuccess(res, { order: reloaded, waResult }, 'WhatsApp verification message dispatched successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/send-confirmation ──────────────────────────────────
exports.sendConfirmation = async (req, res, next) => {
  try {
    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    if (ord.verification_status !== 'sku_matched' && ord.status !== 'confirmed') {
      return next(
        new AppError(
          `Cannot send confirmation. Manual SKU verification must be completed first (current status: '${ord.verification_status}').`,
          422
        )
      );
    }

    const prev = ord.status;

    await ord.update({
      status: 'confirmed',
      verification_status: 'confirmed',
      flow_stage: 'match_confirmed',
      whatsapp_confirmation_sent: true,
      confirmation_sent_at: new Date(),
      customer_confirmed_at: ord.customer_confirmed_at || new Date(),
      second_message_due_at: null,
    });

    await logActivity(
      ord.id,
      req.user.id,
      'confirmation_sent',
      prev,
      'confirmed',
      'Sent verified order confirmation to customer on WhatsApp.'
    );

    let waResult = null;
    if (ord.customer?.phone || ord.customer?.whatsapp_number) {
      try {
        waResult = await whatsappService.sendOrderConfirmation(ord);
      } catch (waErr) {
        logger.error('Error sending WhatsApp order confirmation message:', waErr.message);
      }
    }

    const reloaded = await Order.findByPk(ord.id, {
      include: [{ model: Customer, as: 'customer' }],
    });

    sendSuccess(
      res,
      { order: reloaded, waResult },
      'Verified order confirmation sent to customer on WhatsApp. Order is now Confirmed.'
    );
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/customer-confirm ────────────────────────────────────
// Explicitly records customer confirmation (via phone call, WhatsApp, or direct verification)
// and transitions order to Confirmed status
exports.customerConfirm = async (req, res, next) => {
  try {
    const note = req.body.note || 'Customer confirmation recorded by CRM user. Order moved to Confirmed status.';
    const result = await OrderVerificationWorkflowService.handleCustomerConfirm(
      req.params.id,
      {
        source: 'crm_manual',
        actor_id: req.user?.id || null,
        actor_type: 'crm_user',
        notes: note,
        skipWhatsApp: req.body.send_whatsapp === false,
      }
    );

    if (!result.success && result.reason !== 'already_confirmed') {
      return next(new AppError(result.message || 'Order cannot be confirmed.', 400));
    }

    const reloaded = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });

    sendSuccess(
      res,
      { order: reloaded },
      'Customer confirmation recorded successfully. Order state updated to Confirmed.'
    );
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/send-to-exception ──────────────────────────────────
exports.sendToException = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const ord = await Order.findByPk(req.params.id);
    if (!ord) return next(new AppError('Order not found.', 404));

    const prev = ord.verification_status;
    const exceptionReason = reason || 'Moved to verification exceptions for manual intervention.';

    await ord.update({
      verification_status: 'verification_exception',
      verification_notes: exceptionReason,
    });

    await logActivity(
      ord.id,
      req.user.id,
      'order_exception',
      prev,
      'verification_exception',
      exceptionReason
    );

    sendSuccess(res, { order: ord }, 'Moved order to Verification Exceptions.');
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/orders/:id ────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const ord = await Order.findByPk(req.params.id);
    if (!ord) return next(new AppError('Order not found.', 404));

    const custId = ord.customer_id;

    await OrderActivity.destroy({ where: { order_id: ord.id } });
    await CustomerImage.destroy({ where: { order_id: ord.id } });
    await FollowUp.destroy({ where: { order_id: ord.id } });
    await WhatsAppLog.destroy({ where: { order_id: ord.id } });
    await ord.destroy();

    // Recalculate customer totals
    if (custId) {
      const remainingOrders = await Order.count({ where: { customer_id: custId } });
      const remainingRev = (await Order.sum('total_amount', { where: { customer_id: custId, status: { [Op.ne]: 'cancelled' } } })) || 0;
      await Customer.update(
        { total_orders: remainingOrders, total_revenue: remainingRev },
        { where: { id: custId } }
      );
    }

    sendSuccess(res, null, 'Order deleted successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/orders/clear-all ─────────────────────────────────────────────
exports.clearAll = async (req, res, next) => {
  try {
    await OrderActivity.destroy({ where: {} });
    await CustomerImage.destroy({ where: {} });
    await FollowUp.destroy({ where: { order_id: { [Op.ne]: null } } });
    await WhatsAppLog.destroy({ where: { order_id: { [Op.ne]: null } } });
    await Order.destroy({ where: {} });
    await Customer.update({ total_orders: 0, total_revenue: 0 }, { where: {} });

    sendSuccess(res, null, 'All orders and order-related records have been cleared.');
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/bulk-delete ──────────────────────────────────────────────
exports.bulkDelete = async (req, res, next) => {
  try {
    const ids = req.body.ids || req.body.order_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('No order IDs provided for bulk deletion.', 400));
    }

    // Find affected customers before deleting
    const affectedOrders = await Order.findAll({ where: { id: ids }, attributes: ['customer_id'] });
    const affectedCustomerIds = [...new Set(affectedOrders.map(o => o.customer_id).filter(Boolean))];

    await OrderActivity.destroy({ where: { order_id: ids } });
    await CustomerImage.destroy({ where: { order_id: ids } });
    await FollowUp.destroy({ where: { order_id: ids } });
    await WhatsAppLog.destroy({ where: { order_id: ids } });
    const count = await Order.destroy({ where: { id: ids } });

    // Recalculate customer totals for all affected customers
    for (const custId of affectedCustomerIds) {
      const remainingOrders = await Order.count({ where: { customer_id: custId } });
      const remainingRev = (await Order.sum('total_amount', { where: { customer_id: custId, status: { [Op.ne]: 'cancelled' } } })) || 0;
      await Customer.update(
        { total_orders: remainingOrders, total_revenue: remainingRev },
        { where: { id: custId } }
      );
    }

    sendSuccess(res, { deletedCount: count }, `Successfully deleted ${count} order(s).`);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/:id/send-template ──────────────────────────────────────
exports.sendTemplateForOrder = async (req, res, next) => {
  try {
    const { template_name } = req.body;
    if (!template_name) {
      return next(new AppError('Template name is required.', 400));
    }

    const ord = await Order.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Warranty, as: 'warranty' },
      ],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const phone = ord.customer?.whatsapp_number || ord.customer?.phone || ord.customer_phone || (ord.shipping_address && ord.shipping_address.ship_phone);
    if (!phone) {
      return next(new AppError('Customer has no valid phone or WhatsApp number for message delivery.', 400));
    }

    // Lifecycle guards against accidental workflow corruption (Section 60, 62)
    if (ord.status === 'cancelled' && ['order_confirmation', 'order_confirmation013', 'order_verification_interactive'].includes(template_name)) {
      return next(new AppError(`Cannot send '${template_name}' to an order that is already CANCELLED.`, 422));
    }
    if (template_name === 'order_dispatched' && !ord.tracking_number) {
      return next(new AppError('Tracking number (AWB) is required to dispatch the order_dispatched template.', 422));
    }

    let waResult = null;
    let templateDescription = '';

    switch (template_name) {
      case 'order_verification_interactive':
        waResult = await whatsappService.sendOrderVerificationInteractive(ord);
        templateDescription = 'Order Verification (Interactive with Confirm/Cancel Buttons)';
        break;

      case 'screenshot_from_customer':
        waResult = await whatsappService.sendScreenshotRequestMessage(ord);
        templateDescription = 'Request Customer Screenshot (Tap / Purifier Photo)';
        break;

      case 'order_confirmation013':
        waResult = await whatsappService.send15MinConfirmation(ord);
        templateDescription = '15-Minute Order Confirmation (Detailed with Pricing)';
        break;

      case 'order_confirmation':
        waResult = await whatsappService.sendOrderConfirmation(ord);
        templateDescription = 'Order Confirmed Notice';
        break;

      case 'order_cancelled':
        waResult = await whatsappService.sendOrderCancelled(ord);
        templateDescription = 'Order Cancelled Notice';
        break;

      case 'order_dispatched':
        waResult = await whatsappService.sendOrderDispatched(ord);
        templateDescription = 'Order Dispatched (AWB & Courier)';
        break;

      case 'order_deliverd':
        waResult = await whatsappService.sendOrderDelivered(ord);
        templateDescription = 'Order Delivered Notice';
        break;

      case 'installation_guide':
        waResult = await whatsappService.sendInstallationGuide(ord);
        templateDescription = 'Product Installation Guide';
        break;

      case 'warranty_claim': {
        let warranty = ord.warranty;
        if (!warranty) {
          warranty = await warrantyService.handleDeliveryEvent(ord.id, {
            delivered_at: ord.delivered_at || new Date(),
          });
        }
        const { generateActivationToken, getActivationUrl } = require('../services/warrantyTokenService');
        const token = generateActivationToken(warranty, 7);
        const activationUrl = getActivationUrl(token);
        waResult = await whatsappService.sendWarrantyActivationMessage({
          warranty: {
            ...(warranty.toJSON ? warranty.toJSON() : warranty),
            customer: ord.customer,
            order: ord,
          },
          token,
          activationUrl,
          idempotencyKey: `manual_claim_${warranty.id}_${Date.now()}`,
        });
        if (warranty && warranty.update) {
          try {
            await warranty.update({
              warranty_status: 'ACTIVATION_MESSAGE_SENT',
              activation_sent_at: new Date(),
            });
          } catch (_) {
            await warranty.update({
              activation_sent_at: new Date(),
            });
          }
        }
        templateDescription = '24-Hour Warranty Claim Invitation with Activation Link';
        break;
      }

      case 'warranty_activated1':
      case 'warranty_activated': {
        let warranty = ord.warranty;
        if (!warranty) {
          warranty = await warrantyService.handleDeliveryEvent(ord.id, {
            delivered_at: ord.delivered_at || new Date(),
          });
        }
        waResult = await whatsappService.sendWarrantyActivatedConfirmation({
          ...warranty.toJSON(),
          customer: ord.customer,
          order: ord,
        });
        templateDescription = 'Warranty Activated Confirmation (warranty_activated1)';
        break;
      }

      default:
        return next(new AppError(`Unsupported template '${template_name}'.`, 400));
    }

    // Log Activity for CRM Audit trail
    await logActivity(
      ord.id,
      req.user?.id || null,
      'manual_whatsapp_sent',
      ord.status,
      ord.status,
      `Manual WhatsApp message dispatched: ${templateDescription} (${template_name}) to ${phone}.`
    );

    // Fetch latest WhatsApp logs for this order
    const logs = await WhatsAppLog.findAll({
      where: { order_id: ord.id },
      order: [['created_at', 'DESC']],
      limit: 20,
    });

    const reloaded = await Order.findByPk(ord.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Warranty, as: 'warranty' },
      ],
    });

    sendSuccess(
      res,
      {
        order: reloaded,
        waResult,
        logs,
        template_name,
        template_description: templateDescription,
      },
      `WhatsApp message (${template_name}) dispatched successfully to ${phone}.`
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/orders/:id/whatsapp-logs ───────────────────────────────────────
exports.getOrderWhatsAppLogs = async (req, res, next) => {
  try {
    const logs = await WhatsAppLog.findAll({
      where: { order_id: req.params.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    sendSuccess(res, { logs });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/orders/bulk-send-whatsapp ─────────────────────────────────────
exports.bulkSendWhatsApp = async (req, res, next) => {
  try {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return next(new AppError('orderIds must be a non-empty array of order IDs.', 400));
    }

    if (orderIds.length > 100) {
      return next(new AppError('Maximum 100 orders can be dispatched in a single batch.', 400));
    }

    const { isWhatsAppSendingEnabled } = require('../services/emergencyPauseService');
    if (!(await isWhatsAppSendingEnabled())) {
      return next(new AppError('WhatsApp sending is currently paused by the Global Emergency Kill Switch.', 403));
    }

    const orders = await Order.findAll({
      where: { id: { [Op.in]: orderIds } },
      include: [{ model: Customer, as: 'customer' }],
    });

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const ord of orders) {
      const phone = ord.customer?.whatsapp_number || ord.customer?.phone || ord.customer_phone || (ord.shipping_address && ord.shipping_address.ship_phone);
      if (!phone) {
        failed++;
        results.push({ order_id: ord.id, order_number: ord.order_number, success: false, reason: 'No phone number available' });
        continue;
      }

      try {
        await whatsappService.sendProductVerificationTemplate(ord);
        await logActivity(
          ord.id,
          req.user?.id || null,
          'whatsapp_verification_sent',
          ord.verification_status,
          'pending_verification',
          `Bulk manual WhatsApp verification dispatched by ${req.user?.name || 'Staff'}`
        );
        sent++;
        results.push({ order_id: ord.id, order_number: ord.order_number, success: true });
      } catch (e) {
        failed++;
        results.push({ order_id: ord.id, order_number: ord.order_number, success: false, reason: e.message });
      }
    }

    sendSuccess(
      res,
      { total: orderIds.length, sent, failed, results },
      `Dispatched WhatsApp verification messages to ${sent} customer(s).${failed > 0 ? ` (${failed} skipped/failed)` : ''}`
    );
  } catch (err) {
    next(err);
  }
};



