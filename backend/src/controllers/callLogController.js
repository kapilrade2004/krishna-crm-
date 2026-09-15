'use strict';

const { Op } = require('sequelize');
const { ManualCallLog, Order, Customer, User, OrderActivity } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination, getOrder } = require('../utils/response');

// GET /api/call-logs  — all call logs (admin/manager) or own logs (sales/support)
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const order = getOrder(req.query, ['called_at', 'created_at', 'outcome']);

    const where = {};
    if (req.query.order_id)   where.order_id   = req.query.order_id;
    if (req.query.customer_id) where.customer_id = req.query.customer_id;
    if (req.query.outcome)     where.outcome     = req.query.outcome;
    if (req.query.context)     where.context     = req.query.context;
    if (req.query.call_type)   where.call_type   = req.query.call_type;

    // Sales reps see only their own call logs
    if (['sales', 'support'].includes(req.user.role)) {
      where.user_id = req.user.id;
    } else if (req.query.user_id) {
      where.user_id = req.query.user_id;
    }

    if (req.query.from_date && req.query.to_date) {
      where.called_at = { [Op.between]: [req.query.from_date, req.query.to_date] };
    }

    const { count, rows } = await ManualCallLog.findAndCountAll({
      where,
      include: [
        { model: Order,    as: 'order',    attributes: ['id', 'order_number', 'status'], required: false },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User,     as: 'user',     attributes: ['id', 'name'] },
      ],
      order,
      limit,
      offset,
    });

    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:orderId/call-logs  — call logs for a specific order
exports.getByOrder = async (req, res, next) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await ManualCallLog.findAndCountAll({
      where: { order_id: orderId },
      include: [
        { model: User,     as: 'user',     attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      ],
      order: [['called_at', 'DESC']],
      limit,
      offset,
    });
    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// GET /api/customers/:customerId/call-logs  — call logs for a specific customer
exports.getByCustomer = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await ManualCallLog.findAndCountAll({
      where: { customer_id: req.params.customerId },
      include: [
        { model: Order, as: 'order', attributes: ['id', 'order_number', 'status'], required: false },
        { model: User,  as: 'user',  attributes: ['id', 'name'] },
      ],
      order: [['called_at', 'DESC']],
      limit,
      offset,
    });
    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// POST /api/call-logs
exports.create = async (req, res, next) => {
  try {
    const {
      order_id, customer_id, call_type, phone_used,
      duration_seconds, outcome, context, notes, called_at,
    } = req.body;

    if (!customer_id) return next(new AppError('customer_id is required.', 400));

    // Validate order belongs to customer if both are provided
    if (order_id && customer_id) {
      const ord = await Order.findOne({ where: { id: order_id, customer_id } });
      if (!ord) return next(new AppError('Order does not belong to this customer.', 400));
    }

    const log = await ManualCallLog.create({
      order_id:        order_id || null,
      customer_id,
      user_id:         req.user.id,
      call_type:       call_type || 'outbound',
      phone_used:      phone_used || null,
      duration_seconds: duration_seconds || null,
      outcome:         outcome || 'answered',
      context:         context || 'general',
      notes:           notes || null,
      called_at:       called_at || new Date(),
    });

    // Touch customer last_contacted_at
    await Customer.update(
      { last_contacted_at: new Date() },
      { where: { id: customer_id } }
    );

    // Record order activity if tied to an order
    if (order_id) {
      await OrderActivity.create({
        order_id,
        user_id: req.user.id,
        action: 'call_logged',
        from_value: null,
        to_value: outcome || 'called',
        note: notes ? `[${outcome}] ${notes}` : `Call outcome logged: ${outcome}`,
      });
    }

    const populated = await ManualCallLog.findByPk(log.id, {
      include: [
        { model: User,     as: 'user',     attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Order,    as: 'order',    attributes: ['id', 'order_number'], required: false },
      ],
    });

    sendCreated(res, { callLog: populated }, 'Call logged successfully.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/call-logs/:id  — update notes/outcome after the call
exports.update = async (req, res, next) => {
  try {
    const log = await ManualCallLog.findByPk(req.params.id);
    if (!log) return next(new AppError('Call log not found.', 404));

    // Only the rep who logged it or admin/manager can edit
    if (!['admin', 'manager'].includes(req.user.role) && log.user_id !== req.user.id) {
      return next(new AppError('You can only edit your own call logs.', 403));
    }

    const allowed = ['outcome', 'context', 'notes', 'duration_seconds', 'phone_used', 'called_at'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    await log.update(updates);
    sendSuccess(res, { callLog: log }, 'Call log updated.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/call-logs/:id
exports.remove = async (req, res, next) => {
  try {
    const log = await ManualCallLog.findByPk(req.params.id);
    if (!log) return next(new AppError('Call log not found.', 404));
    await log.destroy();
    sendSuccess(res, null, 'Call log deleted.');
  } catch (err) {
    next(err);
  }
};

// GET /api/call-logs/stats  — outcome breakdown summary
exports.getStats = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.from_date && req.query.to_date) {
      where.called_at = { [Op.between]: [req.query.from_date, req.query.to_date] };
    }
    if (['sales', 'support'].includes(req.user.role)) {
      where.user_id = req.user.id;
    }

    const { sequelize: db } = require('../models');
    const stats = await ManualCallLog.findAll({
      attributes: [
        'outcome',
        'context',
        [db.fn('COUNT', db.col('id')), 'count'],
      ],
      where,
      group: ['outcome', 'context'],
      raw: true,
    });

    sendSuccess(res, { stats });
  } catch (err) {
    next(err);
  }
};
