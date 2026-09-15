'use strict';

const { Op } = require('sequelize');
const { FollowUp, Customer, Order, User } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination, getOrder } = require('../utils/response');

const ALLOWED_SORT = ['due_at', 'created_at', 'priority', 'status'];

// GET /api/follow-ups
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const order = getOrder(req.query, ALLOWED_SORT);

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.type) where.type = req.query.type;
    if (req.query.customer_id) where.customer_id = req.query.customer_id;
    if (req.query.assigned_to) {
      where.assigned_to = req.query.assigned_to;
    } else if (req.user.role === 'sales' || req.user.role === 'support') {
      // Non-admin users see only their own follow-ups
      where.assigned_to = req.user.id;
    }
    if (req.query.overdue === 'true') {
      where.due_at = { [Op.lt]: new Date() };
      where.status = { [Op.in]: ['pending', 'in_progress'] };
    }
    if (req.query.today === 'true') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      where.due_at = { [Op.between]: [start, end] };
    }

    const { count, rows } = await FollowUp.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'whatsapp_number'] },
        { model: Order, as: 'order', attributes: ['id', 'order_number', 'status'] },
        { model: User, as: 'assignedUser', attributes: ['id', 'name'] },
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

// GET /api/follow-ups/:id
exports.getOne = async (req, res, next) => {
  try {
    const fu = await FollowUp.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Order, as: 'order' },
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
      ],
    });
    if (!fu) return next(new AppError('Follow-up not found.', 404));
    sendSuccess(res, { followUp: fu });
  } catch (err) {
    next(err);
  }
};

// POST /api/follow-ups
exports.create = async (req, res, next) => {
  try {
    const fu = await FollowUp.create({
      ...req.body,
      assigned_to: req.body.assigned_to || req.user.id,
    });
    sendCreated(res, { followUp: fu }, 'Follow-up created.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/follow-ups/:id
exports.update = async (req, res, next) => {
  try {
    const fu = await FollowUp.findByPk(req.params.id);
    if (!fu) return next(new AppError('Follow-up not found.', 404));

    const allowed = [
      'type', 'status', 'priority', 'subject', 'notes', 'outcome',
      'due_at', 'completed_at', 'next_followup_at', 'assigned_to',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    if (updates.status === 'completed' && !updates.completed_at) {
      updates.completed_at = new Date();
    }

    await fu.update(updates);

    // Auto-create next follow-up if rescheduled
    if (updates.status === 'rescheduled' && fu.next_followup_at) {
      await FollowUp.create({
        customer_id: fu.customer_id,
        order_id: fu.order_id,
        assigned_to: fu.assigned_to,
        type: fu.type,
        priority: fu.priority,
        subject: `[Rescheduled] ${fu.subject}`,
        notes: fu.notes,
        due_at: fu.next_followup_at,
        status: 'pending',
      });
    }

    sendSuccess(res, { followUp: fu }, 'Follow-up updated.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/follow-ups/:id
exports.remove = async (req, res, next) => {
  try {
    const fu = await FollowUp.findByPk(req.params.id);
    if (!fu) return next(new AppError('Follow-up not found.', 404));
    await fu.destroy();
    sendSuccess(res, null, 'Follow-up deleted.');
  } catch (err) {
    next(err);
  }
};
