'use strict';

const { Op } = require('sequelize');
const { Customer, User, Order, FollowUp, Warranty, WarrantyReturn, ManualCallLog } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination, getOrder } = require('../utils/response');
const whatsappService = require('../services/whatsappService');
const logger = require('../config/logger');

const ALLOWED_SORT = ['name', 'email', 'created_at', 'total_orders', 'total_revenue', 'last_contacted_at'];

// GET /api/customers
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const order = getOrder(req.query, ALLOWED_SORT);

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.source) where.source = req.query.source;
    if (req.query.assigned_to) where.assigned_to = req.query.assigned_to;
    if (req.query.lifecycle_stage) where.lifecycle_stage = req.query.lifecycle_stage;
    if (req.query.installation_help === 'true' || req.query.installation_help_requested === 'true' || req.query.telecaller === 'true') {
      where.installation_help_requested = { [Op.in]: [true, 1, '1', 'true'] };
      if (!req.query.installation_help_status && req.query.include_resolved !== 'true') {
        where.installation_help_status = { [Op.ne]: 'resolved' };
      }
    }
    if (req.query.installation_help_status) {
      where.installation_help_status = req.query.installation_help_status;
    }
    if (req.query.q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.q}%` } },
        { email: { [Op.like]: `%${req.query.q}%` } },
        { phone: { [Op.like]: `%${req.query.q}%` } },
      ];
    }

    const { count, rows } = await Customer.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        {
          model: Order,
          as: 'orders',
          attributes: ['id', 'order_number', 'marketplace_order_id', 'marketplace', 'status', 'verification_status', 'total_amount', 'order_date', 'product_sku', 'product_name', 'delivery_pincode', 'delivered_at', 'shipping_address', 'flow_stage', 'created_at'],
          required: false,
        },
      ],
      order,
      limit,
      offset,
      distinct: true,
    });

    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// GET /api/customers/:id
exports.getOne = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        {
          model: Order,
          as: 'orders',
          limit: 15,
          order: [['created_at', 'DESC']],
          attributes: ['id', 'order_number', 'marketplace', 'status', 'total_amount', 'order_date', 'product_sku', 'product_name', 'delivered_at', 'flow_stage'],
        },
        {
          model: Warranty,
          as: 'warranties',
          limit: 10,
          order: [['created_at', 'DESC']],
          attributes: ['id', 'warranty_number', 'status', 'product_name_snapshot', 'model_snapshot', 'warranty_end_date', 'created_at'],
          required: false,
        },
        {
          model: WarrantyReturn,
          as: 'warrantyReturns',
          limit: 5,
          order: [['requested_at', 'DESC']],
          attributes: ['id', 'return_number', 'status', 'reason_code', 'pickup_tracking_number', 'requested_at'],
          required: false,
        },
        {
          model: ManualCallLog,
          as: 'callLogs',
          limit: 10,
          order: [['called_at', 'DESC']],
          include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
          required: false,
        },
        {
          model: FollowUp,
          as: 'followUps',
          where: { status: { [Op.in]: ['pending', 'in_progress'] } },
          required: false,
          limit: 5,
          order: [['due_at', 'ASC']],
        },
      ],
    });
    if (!customer) return next(new AppError('Customer not found.', 404));
    sendSuccess(res, { customer });
  } catch (err) {
    next(err);
  }
};

// POST /api/customers
exports.create = async (req, res, next) => {
  try {
    const customer = await Customer.create({
      ...req.body,
      assigned_to: req.body.assigned_to || req.user.id,
    });
    sendCreated(res, { customer }, 'Customer created.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/customers/:id
exports.update = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return next(new AppError('Customer not found.', 404));

    const allowed = [
      'name', 'email', 'phone', 'whatsapp_number', 'address_line1', 'address_line2',
      'city', 'state', 'pincode', 'country', 'source', 'status', 'tags', 'notes',
      'assigned_to', 'whatsapp_opt_in', 'last_contacted_at', 'lifecycle_stage',
      'installation_help_requested', 'installation_help_requested_at',
      'installation_help_status', 'installation_notes',
    ];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    await customer.update(updates);
    sendSuccess(res, { customer }, 'Customer updated.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/customers/:id
exports.remove = async (req, res, next) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return next(new AppError('Customer not found.', 404));
    await customer.destroy();
    sendSuccess(res, null, 'Customer deleted.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/customers/clear-all
exports.removeAll = async (req, res, next) => {
  try {
    const { CustomerImage, ManualCallLog, WhatsAppLog, FollowUp, OrderActivity, Order } = require('../models');
    await CustomerImage.destroy({ where: {} });
    await ManualCallLog.destroy({ where: {} });
    await WhatsAppLog.destroy({ where: {} });
    await FollowUp.destroy({ where: {} });
    await OrderActivity.destroy({ where: {} });
    await Order.destroy({ where: {} });
    const deletedCount = await Customer.destroy({ where: {} });
    sendSuccess(res, { deletedCount }, 'All customer records and associated data have been cleared.');
  } catch (err) {
    next(err);
  }
};

// POST /api/customers/bulk-delete
exports.bulkDelete = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('No customer IDs provided for bulk deletion.', 400));
    }
    const { CustomerImage, ManualCallLog, WhatsAppLog, FollowUp, Order } = require('../models');
    await CustomerImage.destroy({ where: { customer_id: ids } });
    await ManualCallLog.destroy({ where: { customer_id: ids } });
    await WhatsAppLog.destroy({ where: { customer_id: ids } });
    await FollowUp.destroy({ where: { customer_id: ids } });
    await Order.destroy({ where: { customer_id: ids } });
    const count = await Customer.destroy({ where: { id: ids } });
    sendSuccess(res, { deletedCount: count }, `Successfully deleted ${count} customer(s).`);
  } catch (err) {
    next(err);
  }
};

// POST /api/customers/bulk-assign
exports.bulkAssign = async (req, res, next) => {
  try {
    const { ids, assigned_to } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('No customer IDs provided.', 400));
    }
    if (!assigned_to) {
      return next(new AppError('Assigned user ID is required.', 400));
    }
    const [updatedCount] = await Customer.update(
      { assigned_to },
      { where: { id: ids } }
    );
    sendSuccess(res, { updatedCount }, `Successfully assigned ${updatedCount} customer(s).`);
  } catch (err) {
    next(err);
  }
};

// POST /api/customers/export
const XLSX = require('xlsx');

exports.exportCustomers = async (req, res, next) => {
  try {
    const { scope, ids, filters, columns, format } = req.body;

    const where = {};
    if (scope === 'selected' && Array.isArray(ids) && ids.length > 0) {
      where.id = ids;
    } else if (filters) {
      if (filters.status) where.status = filters.status;
      if (filters.source) where.source = filters.source;
      if (filters.assigned_to) where.assigned_to = filters.assigned_to;
      if (filters.q) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.q}%` } },
          { email: { [Op.like]: `%${filters.q}%` } },
          { phone: { [Op.like]: `%${filters.q}%` } },
        ];
      }
    }

    const customers = await Customer.findAll({
      where,
      include: [{ model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
    });

    const columnDefinitions = {
      name: { label: 'Customer Name', get: c => c.name || '' },
      phone: { label: 'Phone', get: c => c.phone || '' },
      whatsapp_number: { label: 'WhatsApp Number', get: c => c.whatsapp_number || '' },
      email: { label: 'Email', get: c => c.email || '' },
      address_line1: { label: 'Address Line 1', get: c => c.address_line1 || '' },
      address_line2: { label: 'Address Line 2', get: c => c.address_line2 || '' },
      city: { label: 'City', get: c => c.city || '' },
      state: { label: 'State', get: c => c.state || '' },
      pincode: { label: 'Pincode', get: c => c.pincode || '' },
      country: { label: 'Country', get: c => c.country || '' },
      source: { label: 'Source', get: c => c.source || '' },
      status: { label: 'Status', get: c => c.status || '' },
      lifecycle_stage: { label: 'Lifecycle Stage', get: c => c.lifecycle_stage || '' },
      total_orders: { label: 'Total Orders', get: c => c.total_orders || 0 },
      total_revenue: { label: 'Total Spent (₹)', get: c => c.total_revenue || 0 },
      assigned_to: { label: 'Assigned Staff', get: c => c.assignedUser ? c.assignedUser.name : 'Unassigned' },
      last_contacted_at: { label: 'Last Contacted', get: c => c.last_contacted_at ? new Date(c.last_contacted_at).toISOString().split('T')[0] : '' },
      created_at: { label: 'Registration Date', get: c => c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '' },
      notes: { label: 'Notes', get: c => c.notes || '' },
      tags: { label: 'Tags', get: c => Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || '') },
    };

    const selectedKeys = Array.isArray(columns) && columns.length > 0
      ? columns.filter(k => columnDefinitions[k])
      : Object.keys(columnDefinitions);

    const exportColumns = selectedKeys.map(k => ({
      key: k,
      label: columnDefinitions[k].label,
    }));

    const exportData = customers.map(c => {
      const row = {};
      selectedKeys.forEach(k => {
        row[k] = columnDefinitions[k].get(c);
      });
      return row;
    });

    const { sendExportResponse } = require('../utils/exportHelper');
    await sendExportResponse({
      res,
      title: 'Customers Export Report',
      filenameBase: 'customers_export',
      format,
      columns: exportColumns,
      data: exportData,
      metadata: {
        generatedBy: req.user ? req.user.name : 'Staff',
        filters: filters ? (filters.status ? `Status: ${filters.status}` : 'Filtered List') : (scope === 'selected' ? `Selected (${ids ? ids.length : 0})` : 'All Customers'),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/customers/:id/orders
exports.getOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { count, rows } = await Order.findAndCountAll({
      where: { customer_id: req.params.id },
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// ─── CR4: PATCH /api/customers/:id/lifecycle ──────────────────────────────────
// Advance a customer through the post-sale journey stages.
// Stages: prospect → customer → installation_pending → installation_done
//         → feedback_pending → engaged

const LIFECYCLE_TRANSITIONS = {
  prospect:             ['customer'],
  customer:             ['installation_pending'],
  installation_pending: ['installation_done', 'customer'],
  installation_done:    ['feedback_pending'],
  feedback_pending:     ['engaged', 'installation_pending'], // re-open if issue
  engaged:              ['feedback_pending'], // can re-enter feedback loop
};

exports.advanceLifecycle = async (req, res, next) => {
  try {
    const { stage, engagement_notes } = req.body;
    if (!stage) return next(new AppError('stage is required.', 400));

    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return next(new AppError('Customer not found.', 404));

    const allowed = LIFECYCLE_TRANSITIONS[customer.lifecycle_stage] || [];
    if (!allowed.includes(stage)) {
      return next(new AppError(
        `Cannot move customer from '${customer.lifecycle_stage}' to '${stage}'. ` +
        `Allowed next stages: ${allowed.join(', ') || 'none'}.`,
        422
      ));
    }

    const updates = {
      lifecycle_stage: stage,
      ...(engagement_notes && { engagement_notes }),
    };

    // Record timestamps per stage transition
    const now = new Date();
    if (stage === 'installation_pending') {
      // Send installation guide via WhatsApp
      if (customer.whatsapp_opt_in && customer.whatsapp_number) {
        whatsappService.sendInstallationGuide(customer).catch((e) =>
          logger.warn('WhatsApp installation guide failed:', e.message)
        );
        updates.installation_sent_at = now;
      }
    }

    if (stage === 'installation_done') {
      updates.installation_confirmed_at = now;
    }

    if (stage === 'feedback_pending') {
      // Send feedback request via WhatsApp
      if (customer.whatsapp_opt_in && customer.whatsapp_number) {
        whatsappService.sendFeedbackRequest({ customer, id: null, order_number: 'your recent order' })
          .catch((e) => logger.warn('WhatsApp feedback request failed:', e.message));
      }
    }

    if (stage === 'engaged') {
      updates.feedback_collected_at = now;
    }

    await customer.update(updates);
    sendSuccess(res, { customer }, `Customer lifecycle advanced to '${stage}'.`);
  } catch (err) {
    next(err);
  }
};

// POST /api/customers/:id/dispatch-visit  (Telecaller Visit Dispatch)
exports.dispatchVisit = async (req, res, next) => {
  try {
    const { centre_name, visit_date, visit_time, notes } = req.body;
    if (!centre_name || !visit_date || !visit_time) {
      return next(new AppError('centre_name, visit_date, and visit_time are required.', 400));
    }

    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return next(new AppError('Customer not found.', 404));

    const visitNote = `[Centre Visit Scheduled] Branch: ${centre_name} | Date: ${visit_date} | Time: ${visit_time}. Notes: ${notes || 'N/A'}`;
    const updatedNotes = customer.notes ? `${customer.notes}\n${visitNote}` : visitNote;

    await customer.update({
      status: 'active',
      notes: updatedNotes,
      last_contacted_at: new Date(),
    });

    // Dispatch WhatsApp Notification
    if (customer.whatsapp_number || customer.phone) {
      const recipientPhone = customer.whatsapp_number || customer.phone;
      const messageText = `Hello ${customer.name}, your visit to our ${centre_name} center has been confirmed for ${visit_date} at ${visit_time}. Please carry relevant identity documents. Address: ${centre_name} HQ. Thank you!`;

      whatsappService.sendMessage({ phone: recipientPhone, message: messageText })
        .catch((e) => logger.warn('WhatsApp visit notification failed:', e.message));
    }

    sendSuccess(res, { customer, visit_details: { centre_name, visit_date, visit_time, notes } }, 'Store/Centre visit dispatched and notification triggered.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/customers/:id/installation-status (Telecaller Workbench Disposition Update)
exports.updateInstallationHelpStatus = async (req, res, next) => {
  try {
    const { status, notes, visit_date, visit_time, technician_name } = req.body;
    const allowedStatuses = ['pending', 'contacted', 'visit_scheduled', 'resolved'];
    if (!status || !allowedStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`, 400));
    }

    const customer = await Customer.findByPk(req.params.id, {
      include: [{ model: Order, as: 'orders', limit: 1, order: [['created_at', 'DESC']] }],
    });
    if (!customer) return next(new AppError('Customer not found.', 404));

    const now = new Date();
    const timeFormatted = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    let noteEntry = `[Installation Status: ${status.toUpperCase()}] ${timeFormatted}${notes ? ` - ${notes}` : ''}`;
    if (visit_date && visit_time) {
      noteEntry += ` (Visit: ${visit_date} @ ${visit_time}${technician_name ? `, Tech: ${technician_name}` : ''})`;
    }

    const updatedNotes = customer.notes ? `${noteEntry}\n${customer.notes}` : noteEntry;

    await customer.update({
      installation_help_status: status,
      installation_notes: notes || customer.installation_notes,
      notes: updatedNotes,
      last_contacted_at: now,
      ...(status === 'resolved' ? { lifecycle_stage: 'installation_done', installation_confirmed_at: now } : {}),
      ...(status === 'visit_scheduled' ? { lifecycle_stage: 'installation_pending' } : {}),
    });

    sendSuccess(res, { customer }, `Installation help status updated to '${status}'.`);
  } catch (err) {
    next(err);
  }
};
