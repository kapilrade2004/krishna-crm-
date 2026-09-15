'use strict';

const { Op, fn, col } = require('sequelize');
const { sequelize, Order, Customer, User, FollowUp, Task } = require('../models');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');
const warrantyService = require('../services/warrantyService');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const dateRange = (req) => {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: req.query.from_date ? new Date(req.query.from_date) : defaultFrom,
    to: req.query.to_date ? new Date(req.query.to_date) : now,
  };
};

const escapeCsv = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const arrayToCsv = (headers, rows) => {
  const head = headers.join(',');
  const body = rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(','));
  return [head, ...body].join('\r\n');
};

// ─── GET /api/reports/sales ───────────────────────────────────────────────────
exports.getSalesReport = async (req, res, next) => {
  try {
    const { from, to } = dateRange(req);
    const groupBy = req.query.group_by || 'day'; // day | week | month | marketplace | user

    let groupQuery;
    if (groupBy === 'marketplace') {
      groupQuery = sequelize.query(
        `SELECT marketplace,
                COUNT(id) as order_count,
                SUM(total_amount) as revenue,
                AVG(total_amount) as avg_order_value
         FROM orders
         WHERE status IN ('confirmed','processing','dispatched','delivered')
           AND created_at BETWEEN :from AND :to
         GROUP BY marketplace ORDER BY revenue DESC`,
        { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
      );
    } else if (groupBy === 'user') {
      groupQuery = sequelize.query(
        `SELECT u.name as user_name, u.role,
                COUNT(o.id) as order_count,
                SUM(o.total_amount) as revenue,
                COUNT(CASE WHEN o.status='delivered' THEN 1 END) as delivered
         FROM orders o
         JOIN users u ON o.assigned_to = u.id
         WHERE o.status IN ('confirmed','processing','dispatched','delivered')
           AND o.created_at BETWEEN :from AND :to
         GROUP BY u.id, u.name, u.role ORDER BY revenue DESC`,
        { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
      );
    } else {
      const dateCol = sequelize.options.dialect === 'sqlite'
        ? (groupBy === 'month' ? "strftime('%Y-%m', created_at)" : "strftime('%Y-%m-%d', created_at)")
        : (groupBy === 'month' ? "DATE_FORMAT(created_at, '%Y-%m')" : "DATE_FORMAT(created_at, '%Y-%m-%d')");

      groupQuery = sequelize.query(
        `SELECT ${dateCol} as period,
                COUNT(id) as order_count,
                SUM(total_amount) as revenue,
                COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered
         FROM orders
         WHERE status IN ('confirmed','processing','dispatched','delivered')
           AND created_at BETWEEN :from AND :to
         GROUP BY period ORDER BY period ASC`,
        { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
      );
    }

    const [salesData, summaryRows, customerStats, warrantyStats] = await Promise.all([
      groupQuery,
      sequelize.query(
        `SELECT COUNT(id) as total_orders,
                COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_revenue,
                COALESCE(AVG(CASE WHEN status != 'cancelled' THEN total_amount ELSE NULL END), 0) as avg_order_value,
                COUNT(CASE WHEN status='delivered' THEN 1 END) as delivered_orders,
                COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled_orders,
                COUNT(CASE WHEN status IN ('returned', 'return_requested', 'refunded') OR workflow_state LIKE '%RETURN%' THEN 1 END) as returned_orders
         FROM orders
         WHERE created_at BETWEEN :from AND :to`,
        { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
      ),
      Promise.all([
        Customer.count(),
        Customer.count({ where: { status: 'active' } }),
        Customer.count({ where: { created_at: { [Op.between]: [from, to] } } }),
      ]).then(([total, active, newInPeriod]) => ({
        total_customers: total || 0,
        active_customers: active || 0,
        new_customers: newInPeriod || 0,
      })).catch(() => ({ total_customers: 0, active_customers: 0, new_customers: 0 })),
      warrantyService.getWarrantyDashboardStats()
        .then((stats) => ({
          total_warranties: stats.total || 0,
          active_warranties: stats.active || 0,
          deactive_warranties: Math.max(0, (stats.total || 0) - (stats.active || 0)),
        }))
        .catch(() => ({ total_warranties: 0, active_warranties: 0, deactive_warranties: 0 })),
    ]);

    const rawSummary = (summaryRows && summaryRows[0]) || {};
    const summary = {
      ...rawSummary,
      ...customerStats,
      ...warrantyStats,
    };

    sendSuccess(res, {
      report: {
        period: { from, to },
        group_by: groupBy,
        summary,
        data: salesData,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/customers ───────────────────────────────────────────────
exports.getCustomerReport = async (req, res, next) => {
  try {
    const { from, to } = dateRange(req);

    const [bySource, topCustomers, newVsReturning] = await Promise.all([
      Customer.findAll({
        attributes: [
          'source',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('total_revenue')), 'revenue'],
        ],
        group: ['source'],
        raw: true,
      }),
      Customer.findAll({
        attributes: ['id', 'name', 'phone', 'source', 'total_orders', 'total_revenue'],
        order: [['total_revenue', 'DESC']],
        limit: 20,
      }),
      sequelize.query(
        `SELECT
           COUNT(CASE WHEN total_orders = 1 THEN 1 END) as new_customers,
           COUNT(CASE WHEN total_orders > 1 THEN 1 END) as returning_customers,
           COUNT(*) as total
         FROM customers`,
        { type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    sendSuccess(res, {
      report: {
        bySource,
        topCustomers,
        newVsReturning: newVsReturning[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/team ────────────────────────────────────────────────────
exports.getTeamReport = async (req, res, next) => {
  try {
    const { from, to } = dateRange(req);

    const data = await sequelize.query(
      `SELECT u.id, u.name, u.role,
              COUNT(DISTINCT o.id) as orders_assigned,
              SUM(o.total_amount) as total_value,
              COUNT(DISTINCT CASE WHEN o.status='delivered' THEN o.id END) as orders_delivered,
              COUNT(DISTINCT CASE WHEN o.status='cancelled' THEN o.id END) as orders_cancelled,
              COUNT(DISTINCT f.id) as followups_total,
              COUNT(DISTINCT CASE WHEN f.status='completed' THEN f.id END) as followups_completed,
              COUNT(DISTINCT t.id) as tasks_total,
              COUNT(DISTINCT CASE WHEN t.status='done' THEN t.id END) as tasks_done
       FROM users u
       LEFT JOIN orders o
         ON o.assigned_to = u.id AND o.created_at BETWEEN :from AND :to
       LEFT JOIN follow_ups f
         ON f.assigned_to = u.id AND f.created_at BETWEEN :from AND :to
       LEFT JOIN tasks t
         ON t.assigned_to = u.id AND t.created_at BETWEEN :from AND :to
       WHERE u.is_active = 1
       GROUP BY u.id, u.name, u.role
       ORDER BY total_value DESC`,
      { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
    );

    sendSuccess(res, { report: { period: { from, to }, team: data } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/followups ───────────────────────────────────────────────
exports.getFollowUpReport = async (req, res, next) => {
  try {
    const [byStatus, byType, overdue] = await Promise.all([
      FollowUp.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
      FollowUp.findAll({
        attributes: ['type', [fn('COUNT', col('id')), 'count']],
        group: ['type'],
        raw: true,
      }),
      FollowUp.count({
        where: {
          status: { [Op.in]: ['pending', 'in_progress'] },
          due_at: { [Op.lt]: new Date() },
        },
      }),
    ]);

    sendSuccess(res, { report: { byStatus, byType, overdue } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/export/orders  (CSV download) ──────────────────────────
exports.exportOrders = async (req, res, next) => {
  try {
    const { from, to } = dateRange(req);
    const format = req.query.format || req.body?.format || 'xlsx';
    const where = { created_at: { [Op.between]: [from, to] } };
    if (req.query.status) where.status = req.query.status;
    if (req.query.marketplace) where.marketplace = req.query.marketplace;

    const orders = await Order.findAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['name', 'phone', 'email', 'city', 'state', 'pincode'] },
        { model: User, as: 'assignedUser', attributes: ['name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 10000,
    });

    const columns = [
      { key: 'order_number', label: 'Order #' },
      { key: 'marketplace_order_id', label: 'Marketplace ID' },
      { key: 'marketplace', label: 'Marketplace' },
      { key: 'order_date', label: 'Order Date' },
      { key: 'status', label: 'Status' },
      { key: 'product_name', label: 'Product' },
      { key: 'product_sku', label: 'SKU' },
      { key: 'quantity', label: 'Qty' },
      { key: 'total_amount', label: 'Total (INR)' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'customer_phone', label: 'Phone' },
      { key: 'city', label: 'City' },
      { key: 'assigned_to', label: 'Assigned Staff' },
    ];

    const rows = orders.map((o) => ({
      order_number: o.order_number,
      marketplace_order_id: o.marketplace_order_id || '',
      marketplace: o.marketplace,
      order_date: o.order_date || o.created_at,
      status: o.status,
      product_name: o.product_name,
      product_sku: o.product_sku,
      quantity: o.quantity,
      total_amount: o.total_amount,
      customer_name: o.customer?.name || 'Awaiting',
      customer_phone: o.customer?.phone || '',
      city: o.customer?.city || '',
      assigned_to: o.assignedUser?.name || 'Unassigned',
    }));

    const { sendExportResponse } = require('../utils/exportHelper');
    await sendExportResponse({
      res,
      title: 'Sales Orders Report',
      filenameBase: `orders_report_${from.toISOString().split('T')[0]}`,
      format,
      columns,
      data: rows,
      metadata: {
        period: `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`,
        generatedBy: req.user ? req.user.name : 'Staff',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/export/customers ───────────────────────────────────────
exports.exportCustomers = async (req, res, next) => {
  try {
    const format = req.query.format || req.body?.format || 'xlsx';
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.source) where.source = req.query.source;

    const customers = await Customer.findAll({
      where,
      attributes: [
        'name', 'email', 'phone', 'whatsapp_number', 'source', 'status',
        'city', 'state', 'pincode', 'total_orders', 'total_revenue',
        'whatsapp_opt_in', 'last_contacted_at', 'created_at',
      ],
      order: [['name', 'ASC']],
      limit: 10000,
    });

    const columns = [
      { key: 'name', label: 'Customer Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'total_orders', label: 'Total Orders' },
      { key: 'total_revenue', label: 'Total Spent (INR)' },
      { key: 'created_at', label: 'Joined On' },
    ];

    const rows = customers.map((c) => ({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      source: c.source || '',
      status: c.status || '',
      city: c.city || '',
      state: c.state || '',
      total_orders: c.total_orders || 0,
      total_revenue: c.total_revenue || 0,
      created_at: c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
    }));

    const { sendExportResponse } = require('../utils/exportHelper');
    await sendExportResponse({
      res,
      title: 'Customer Accounts Report',
      filenameBase: `customers_report_${new Date().toISOString().split('T')[0]}`,
      format,
      columns,
      data: rows,
      metadata: {
        generatedBy: req.user ? req.user.name : 'Staff',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/export/team ───────────────────────────────────────────
exports.exportTeam = async (req, res, next) => {
  try {
    const { from, to } = dateRange(req);
    const format = req.query.format || req.body?.format || 'xlsx';

    const data = await sequelize.query(
      `SELECT u.id, u.name, u.role,
              COUNT(DISTINCT o.id) as orders_assigned,
              COALESCE(SUM(o.total_amount), 0) as total_value,
              COUNT(DISTINCT CASE WHEN o.status='delivered' THEN o.id END) as orders_delivered,
              COUNT(DISTINCT CASE WHEN o.status='cancelled' THEN o.id END) as orders_cancelled,
              COUNT(DISTINCT f.id) as followups_total,
              COUNT(DISTINCT CASE WHEN f.status='completed' THEN f.id END) as followups_completed,
              COUNT(DISTINCT t.id) as tasks_total,
              COUNT(DISTINCT CASE WHEN t.status='done' THEN t.id END) as tasks_done
       FROM users u
       LEFT JOIN orders o
         ON o.assigned_to = u.id AND o.created_at BETWEEN :from AND :to
       LEFT JOIN follow_ups f
         ON f.assigned_to = u.id AND f.created_at BETWEEN :from AND :to
       LEFT JOIN tasks t
         ON t.assigned_to = u.id AND t.created_at BETWEEN :from AND :to
       WHERE u.is_active = 1
       GROUP BY u.id, u.name, u.role
       ORDER BY total_value DESC`,
      { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
    );

    const columns = [
      { key: 'name', label: 'Team Member' },
      { key: 'role', label: 'Role' },
      { key: 'orders_assigned', label: 'Orders Assigned' },
      { key: 'total_value', label: 'Total Value (INR)' },
      { key: 'orders_delivered', label: 'Delivered Orders' },
      { key: 'orders_cancelled', label: 'Cancelled Orders' },
      { key: 'delivery_rate', label: 'Delivery Rate' },
      { key: 'followups_completed', label: 'Follow-ups Completed' },
      { key: 'followups_total', label: 'Total Follow-ups' },
      { key: 'tasks_done', label: 'Tasks Done' },
      { key: 'tasks_total', label: 'Total Tasks' },
    ];

    const rows = (data || []).map((m) => {
      const assigned = Number(m.orders_assigned) || 0;
      const delivered = Number(m.orders_delivered) || 0;
      const rate = assigned > 0 ? `${((delivered / assigned) * 100).toFixed(1)}%` : '0.0%';
      return {
        name: m.name || '',
        role: m.role || '',
        orders_assigned: assigned,
        total_value: Number(m.total_value) || 0,
        orders_delivered: delivered,
        orders_cancelled: Number(m.orders_cancelled) || 0,
        delivery_rate: rate,
        followups_completed: Number(m.followups_completed) || 0,
        followups_total: Number(m.followups_total) || 0,
        tasks_done: Number(m.tasks_done) || 0,
        tasks_total: Number(m.tasks_total) || 0,
      };
    });

    const { sendExportResponse } = require('../utils/exportHelper');
    await sendExportResponse({
      res,
      title: 'Team Performance Report',
      filenameBase: `team_performance_${from.toISOString().split('T')[0]}`,
      format,
      columns,
      data: rows,
      metadata: {
        period: `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`,
        generatedBy: req.user ? req.user.name : 'Staff',
      },
    });
  } catch (err) {
    next(err);
  }
};
