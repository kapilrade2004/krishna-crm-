'use strict';

const fs = require('fs');
const { Op } = require('sequelize');
const { sequelize, Order, Customer, ShippingPartner, PincodeServiceability, OrderActivity } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination, getOrder } = require('../utils/response');
const whatsappService = require('../services/whatsappService');
const csvService = require('../services/csvService');
const logger = require('../config/logger');


// ════════════════════════════════════════════════════════════════════════════
//  SHIPPING PARTNERS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/shipping/partners
exports.getPartners = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.is_active !== undefined) {
      where.is_active = req.query.is_active === 'true';
    }
    const partners = await ShippingPartner.findAll({
      where,
      order: [['name', 'ASC']],
    });
    sendSuccess(res, { partners });
  } catch (err) {
    next(err);
  }
};

// GET /api/shipping/partners/:id
exports.getPartner = async (req, res, next) => {
  try {
    const partner = await ShippingPartner.findByPk(req.params.id, {
      include: [{ model: PincodeServiceability, as: 'serviceability', limit: 50 }],
    });
    if (!partner) return next(new AppError('Shipping partner not found.', 404));
    sendSuccess(res, { partner });
  } catch (err) {
    next(err);
  }
};

// POST /api/shipping/partners
exports.createPartner = async (req, res, next) => {
  try {
    const { name, code, contact_person, contact_phone, contact_email, tracking_url_template, default_tat_days, notes } = req.body;
    const partner = await ShippingPartner.create({
      name,
      code: code.toUpperCase().trim(),
      contact_person,
      contact_phone,
      contact_email,
      tracking_url_template,
      default_tat_days,
      notes,
    });
    sendCreated(res, { partner }, 'Shipping partner created.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/shipping/partners/:id
exports.updatePartner = async (req, res, next) => {
  try {
    const partner = await ShippingPartner.findByPk(req.params.id);
    if (!partner) return next(new AppError('Shipping partner not found.', 404));

    const allowed = [
      'name', 'code', 'contact_person', 'contact_phone', 'contact_email',
      'tracking_url_template', 'default_tat_days', 'is_active', 'notes',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    if (updates.code) updates.code = updates.code.toUpperCase().trim();

    await partner.update(updates);
    sendSuccess(res, { partner }, 'Shipping partner updated.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/shipping/partners/:id
exports.deletePartner = async (req, res, next) => {
  try {
    const partner = await ShippingPartner.findByPk(req.params.id);
    if (!partner) return next(new AppError('Shipping partner not found.', 404));

    // Soft-deactivate instead of hard delete if in use
    const inUseCount = await Order.count({ where: { shipping_partner: partner.name } });
    if (inUseCount > 0) {
      await partner.update({ is_active: false });
      return sendSuccess(res, { partner }, `Partner is used by ${inUseCount} order(s) — deactivated instead of deleted.`);
    }

    await partner.destroy();
    sendSuccess(res, null, 'Shipping partner deleted.');
  } catch (err) {
    next(err);
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  PINCODE SERVICEABILITY
// ════════════════════════════════════════════════════════════════════════════

// GET /api/shipping/serviceability?pincode=400001
exports.checkServiceability = async (req, res, next) => {
  try {
    const { pincode, shipping_partner_id } = req.query;
    if (!pincode) return next(new AppError('pincode query parameter is required.', 400));

    const where = { pincode };
    if (shipping_partner_id) where.shipping_partner_id = shipping_partner_id;

    const entries = await PincodeServiceability.findAll({
      where,
      include: [{ model: ShippingPartner, as: 'shippingPartner', attributes: ['id', 'name', 'code', 'default_tat_days'] }],
    });

    if (entries.length === 0) {
      return sendSuccess(res, {
        pincode,
        serviceable: null,
        message: 'No serviceability data for this pincode. Defaulting to partner TAT or manual confirmation required.',
        entries: [],
      });
    }

    // Best (fastest) TAT among matching entries
    const best = entries
      .filter((e) => e.is_serviceable)
      .sort((a, b) => a.tat_days - b.tat_days)[0];

    sendSuccess(res, {
      pincode,
      serviceable: !!best,
      bestOption: best || null,
      entries,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/shipping/serviceability/list — admin management list
exports.getServiceabilityList = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const order = getOrder(req.query, ['pincode', 'tat_days', 'created_at']);

    const where = {};
    if (req.query.pincode) where.pincode = { [Op.like]: `%${req.query.pincode}%` };
    if (req.query.shipping_partner_id) where.shipping_partner_id = req.query.shipping_partner_id;
    if (req.query.is_serviceable !== undefined) where.is_serviceable = req.query.is_serviceable === 'true';

    const { count, rows } = await PincodeServiceability.findAndCountAll({
      where,
      include: [{ model: ShippingPartner, as: 'shippingPartner', attributes: ['id', 'name', 'code'] }],
      order,
      limit,
      offset,
    });

    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// POST /api/shipping/serviceability
exports.createServiceability = async (req, res, next) => {
  try {
    const { pincode, city, state, shipping_partner_id, is_serviceable, tat_days, cod_available, notes } = req.body;

    const entry = await PincodeServiceability.create({
      pincode,
      city,
      state,
      shipping_partner_id: shipping_partner_id || null,
      is_serviceable: is_serviceable !== undefined ? is_serviceable : true,
      tat_days,
      cod_available: cod_available !== undefined ? cod_available : true,
      notes,
    });
    sendCreated(res, { entry }, 'Serviceability entry created.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/shipping/serviceability/:id
exports.updateServiceability = async (req, res, next) => {
  try {
    const entry = await PincodeServiceability.findByPk(req.params.id);
    if (!entry) return next(new AppError('Serviceability entry not found.', 404));

    const allowed = ['city', 'state', 'is_serviceable', 'tat_days', 'cod_available', 'notes', 'shipping_partner_id'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    await entry.update(updates);
    sendSuccess(res, { entry }, 'Serviceability entry updated.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/shipping/serviceability/:id
exports.deleteServiceability = async (req, res, next) => {
  try {
    const entry = await PincodeServiceability.findByPk(req.params.id);
    if (!entry) return next(new AppError('Serviceability entry not found.', 404));
    await entry.destroy();
    sendSuccess(res, null, 'Serviceability entry deleted.');
  } catch (err) {
    next(err);
  }
};

// POST /api/shipping/serviceability/bulk — bulk upload (JSON array)
exports.bulkCreateServiceability = async (req, res, next) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return next(new AppError('entries must be a non-empty array.', 400));
    }
    if (entries.length > 1000) {
      return next(new AppError('Maximum 1000 entries per bulk request.', 400));
    }

    const t = await sequelize.transaction();
    const results = { created: 0, skipped: 0, errors: [] };

    try {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e.pincode || e.tat_days === undefined) {
          results.errors.push({ row: i + 1, error: 'pincode and tat_days are required.' });
          results.skipped++;
          continue;
        }

        await PincodeServiceability.upsert(
          {
            pincode: String(e.pincode).trim(),
            city: e.city || null,
            state: e.state || null,
            shipping_partner_id: e.shipping_partner_id || null,
            is_serviceable: e.is_serviceable !== undefined ? e.is_serviceable : true,
            tat_days: e.tat_days,
            cod_available: e.cod_available !== undefined ? e.cod_available : true,
          },
          { transaction: t }
        );
        results.created++;
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    sendSuccess(res, { results }, `Bulk upload complete. ${results.created} created/updated, ${results.skipped} skipped.`);
  } catch (err) {
    next(err);
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  ORDER SHIPPING UPDATE (dedicated endpoint)
// ════════════════════════════════════════════════════════════════════════════

// PATCH /api/orders/:id/shipping
exports.updateOrderShipping = async (req, res, next) => {
  try {
    const {
      shipping_partner, tracking_number, delivery_pincode,
      estimated_delivery_date, shipping_address, mark_dispatched,
    } = req.body;

    const ord = await Order.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!ord) return next(new AppError('Order not found.', 404));

    const allowed = {};
    if (shipping_partner !== undefined) allowed.shipping_partner = shipping_partner;
    if (tracking_number !== undefined) allowed.tracking_number = tracking_number;
    if (delivery_pincode !== undefined) allowed.delivery_pincode = delivery_pincode;
    if (estimated_delivery_date !== undefined) allowed.estimated_delivery_date = estimated_delivery_date;
    if (shipping_address !== undefined) allowed.shipping_address = shipping_address;

    const prevStatus = ord.status;
    const wasTrackingSet = !!ord.tracking_number;

    // Auto-transition to 'dispatched' when tracking number is added
    // and order is currently confirmed/processing
    let statusChanged = false;
    if (
      mark_dispatched &&
      tracking_number &&
      ['confirmed', 'processing'].includes(ord.status)
    ) {
      allowed.status = 'dispatched';
      allowed.dispatched_at = new Date();
      statusChanged = true;
    }

    await ord.update(allowed);

    // Activity log
    const changedFields = Object.keys(allowed).filter((k) => k !== 'status' && k !== 'dispatched_at');
    if (changedFields.length > 0) {
      await OrderActivity.create({
        order_id: ord.id,
        user_id: req.user.id,
        action: 'shipping_updated',
        note: `Shipping details updated: ${changedFields.join(', ')}`,
        metadata: allowed,
      });
    }
    if (statusChanged) {
      await OrderActivity.create({
        order_id: ord.id,
        user_id: req.user.id,
        action: 'status_changed',
        from_value: prevStatus,
        to_value: 'dispatched',
        note: 'Auto-dispatched on tracking number assignment.',
      });
    }

    // Trigger WhatsApp dispatch notification
    if (
      statusChanged &&
      !wasTrackingSet &&
      ord.customer?.whatsapp_opt_in &&
      ord.customer?.whatsapp_number
    ) {
      whatsappService.sendDispatchUpdate(ord).catch((e) =>
        logger.warn('WhatsApp dispatch notification failed:', e.message)
      );
    }

    sendSuccess(res, { order: ord }, 'Shipping details updated.');
  } catch (err) {
    next(err);
  }
};

// GET /api/shipping/dashboard — shipping operations overview
exports.getShippingDashboard = async (req, res, next) => {
  try {
    const [pendingDispatch, inTransit, deliveredToday, byPartner, noTracking] = await Promise.all([
      Order.count({
        where: {
          status: { [Op.in]: ['confirmed', 'processing'] },
          tracking_number: null,
        },
      }),
      Order.count({ where: { status: 'dispatched' } }),
      Order.count({
        where: {
          status: 'delivered',
          delivered_at: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      Order.findAll({
        attributes: [
          'shipping_partner',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        where: {
          status: { [Op.in]: ['dispatched', 'delivered'] },
          shipping_partner: { [Op.ne]: null },
        },
        group: ['shipping_partner'],
        raw: true,
      }),
      Order.count({
        where: {
          status: 'dispatched',
          [Op.or]: [{ tracking_number: null }, { tracking_number: '' }],
        },
      }),
    ]);

    sendSuccess(res, {
      dashboard: { pendingDispatch, inTransit, deliveredToday, byPartner, noTracking },
    });
  } catch (err) {
    next(err);
  }
};

// ════════════════════════════════════════════════════════════════════════════
//  LIVE SHIPMENTS & BULK TRANSIT / DELIVERY UPLOAD
// ════════════════════════════════════════════════════════════════════════════

// GET /api/shipping/shipments — Live dispatches & transit tracking list
exports.getShipments = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, shipping_partner, channel, search } = req.query;

    const where = {};

    // Status filter
    if (status === 'in_transit' || status === 'dispatched') {
      where.status = 'dispatched';
    } else if (status === 'delivered') {
      where.status = 'delivered';
    } else if (status === 'pending') {
      where.status = { [Op.in]: ['pending', 'confirmed', 'processing'] };
    } else if (status === 'returned' || status === 'rto') {
      where.status = 'returned';
    } else if (status && status !== 'all') {
      where.status = status;
    } else {
      // 'all' shows all actionable shipping statuses
      where.status = { [Op.in]: ['dispatched', 'delivered', 'confirmed', 'processing', 'returned'] };
    }

    if (shipping_partner) {
      where.shipping_partner = shipping_partner;
    }

    if (channel) {
      where.channel = channel;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { order_number: { [Op.like]: q } },
        { marketplace_order_id: { [Op.like]: q } },
        { tracking_number: { [Op.like]: q } },
        { customer_name: { [Op.like]: q } },
        { customer_phone: { [Op.like]: q } },
        { delivery_pincode: { [Op.like]: q } },
        { shipping_partner: { [Op.like]: q } },
      ];
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'email', 'city', 'state', 'pincode', 'lifecycle_stage'],
        },
      ],
      order: [
        ['dispatched_at', 'DESC'],
        ['created_at', 'DESC'],
      ],
      limit,
      offset,
    });

    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// POST /api/shipping/bulk-upload — Bulk Shipments & Tracking Upload
exports.bulkUploadShipments = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('CSV or Excel file is required.', 400));

    logger.info(`Shipping bulk upload initiated: ${req.file.originalname} by user ${req.user?.id}`);

    const options = {
      defaultShippingPartner: req.body.default_shipping_partner || req.body.shipping_partner || null,
      defaultChannel: req.body.default_channel || req.body.channel || null,
      userId: req.user ? req.user.id : null,
    };

    let results;
    try {
      results = await csvService.processShippingBulkUpload(req.file.path, options);
    } finally {
      // Clean up temp file
      fs.unlink(req.file.path, (err) => {
        if (err) logger.warn(`Failed to unlink temp upload file ${req.file.path}: ${err.message}`);
      });
    }

    const message = [
      `Shipping file processed successfully.`,
      `${results.updatedDelivered} order(s) marked as delivered (customers registered in CRM).`,
      `${results.updatedInTransit} order(s) updated in transit/dispatched.`,
      results.newlyCreated > 0 ? `${results.newlyCreated} new order(s) created.` : '',
      results.alreadyDelivered > 0 ? `${results.alreadyDelivered} already delivered.` : '',
      results.errors.length > 0 ? `${results.errors.length} row(s) had errors.` : '',
    ].filter(Boolean).join(' ');

    sendSuccess(res, { results }, message);
  } catch (err) {
    next(err);
  }
};

