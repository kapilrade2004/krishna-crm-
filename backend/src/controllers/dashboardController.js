'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Order, Customer, Task, FollowUp, User, Employee, Warranty } = require('../models');
const { sendSuccess } = require('../utils/response');

// GET /api/dashboard/kpis  – main dashboard KPIs
exports.getKpis = async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    const [
      todayOrders,
      pendingDispatch,
      overdueDispatch,
      monthRevenue,
      lastMonthRevenue,
      allTimeRevenue,
      confirmedThisMonth,
      confirmedAllTime,
      activeCustomers,
      newCustomersMonth,
      pendingFollowUps,
      overdueFollowUps,
      openTasks,
      overdueTasks,
      ordersByStatus,
      ordersByMarketplace,
      revenueByDay,
      totalOrdersAllTime,
      totalCustomersAllTime,
      ordersByProduct,
      cityWiseBreakdown,
      totalEmployeesCount,
      activeEmployeesCount,
      deliveredOrdersCount,
      returnedOrdersCount,
      inactiveCustomersCount,
      totalWarrantiesCount,
      activeWarrantiesCount,
      pendingWarrantiesCount,
    ] = await Promise.all([
      // Today's orders
      Order.count({ where: { created_at: { [Op.between]: [startOfDay, endOfDay] } } }),

      // Pending dispatch
      Order.count({ where: { status: { [Op.in]: ['confirmed', 'processing'] } } }),

      // Overdue dispatch (processing for > 2 days)
      Order.count({
        where: {
          status: { [Op.in]: ['confirmed', 'processing'] },
          created_at: { [Op.lt]: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        },
      }),

      // This month revenue (all active, non-cancelled orders created this month)
      Order.sum('total_amount', {
        where: {
          status: { [Op.ne]: 'cancelled' },
          created_at: { [Op.gte]: startOfMonth },
        },
      }),

      // Last month revenue
      Order.sum('total_amount', {
        where: {
          status: { [Op.ne]: 'cancelled' },
          created_at: { [Op.between]: [startOfLastMonth, endOfLastMonth] },
        },
      }),

      // All-time total revenue
      Order.sum('total_amount', {
        where: {
          status: { [Op.ne]: 'cancelled' },
        },
      }),

      // Confirmed revenue this month
      Order.sum('total_amount', {
        where: {
          status: { [Op.in]: ['confirmed', 'processing', 'dispatched', 'delivered'] },
          created_at: { [Op.gte]: startOfMonth },
        },
      }),

      // Confirmed revenue all-time
      Order.sum('total_amount', {
        where: {
          status: { [Op.in]: ['confirmed', 'processing', 'dispatched', 'delivered'] },
        },
      }),

      // Active customers
      Customer.count({ where: { status: 'active' } }),

      // New customers this month
      Customer.count({ where: { created_at: { [Op.gte]: startOfMonth } } }),

      // Pending follow-ups
      FollowUp.count({ where: { status: { [Op.in]: ['pending', 'in_progress'] } } }),

      // Overdue follow-ups
      FollowUp.count({
        where: {
          status: { [Op.in]: ['pending', 'in_progress'] },
          due_at: { [Op.lt]: new Date() },
        },
      }),

      // Open tasks
      Task.count({ where: { status: { [Op.notIn]: ['done', 'cancelled'] } } }),

      // Overdue tasks
      Task.count({
        where: {
          status: { [Op.notIn]: ['done', 'cancelled'] },
          due_date: { [Op.lt]: today.toISOString().split('T')[0] },
        },
      }),

      // Orders by status
      Order.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),

      // Orders by marketplace — now includes revenue alongside count
      Order.findAll({
        attributes: [
          'marketplace',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('total_amount')), 'revenue'],
        ],
        group: ['marketplace'],
        raw: true,
      }),

      // Revenue last 30 days by day
      Order.findAll({
        attributes: [
          [fn('DATE', col('created_at')), 'date'],
          [fn('SUM', col('total_amount')), 'revenue'],
          [fn('COUNT', col('id')), 'orders'],
        ],
        where: {
          status: { [Op.ne]: 'cancelled' },
          created_at: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        group: [fn('DATE', col('created_at'))],
        order: [[fn('DATE', col('created_at')), 'ASC']],
        raw: true,
      }),

      // ── New: Total orders, all time ──────────────────────────────────
      Order.count(),

      // ── New: Total customers, all time ───────────────────────────────
      Customer.count(),

      // ── New: Product-wise order breakdown ────────────────────────────
      Order.findAll({
        attributes: [
          'product_name',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('total_amount')), 'revenue'],
        ],
        where: { product_name: { [Op.ne]: null } },
        group: ['product_name'],
        order: [[literal('count'), 'DESC']],
        limit: 10,
        raw: true,
      }),

      // ── New: City-wise order & customer breakdown ────────────────────
      sequelize.query(
        `SELECT
           c.city as city,
           COUNT(DISTINCT c.id) as customer_count,
           COUNT(o.id) as order_count,
           SUM(o.total_amount) as revenue
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.id
         WHERE c.city IS NOT NULL AND c.city != ''
         GROUP BY c.city
         ORDER BY order_count DESC
         LIMIT 10`,
        { type: sequelize.QueryTypes.SELECT }
      ),

      // ── Module Metrics: Employee, Delivered/Returned, Inactive Customers, Warranty ──
      Employee.count().catch(() => 0),
      Employee.count({ where: { status: 'active' } }).catch(() => 0),
      Order.count({ where: { status: 'delivered' } }).catch(() => 0),
      Order.count({ where: { status: { [Op.in]: ['returned', 'return_requested', 'refunded', 'cancelled'] } } }).catch(() => 0),
      Customer.count({ where: { status: 'inactive' } }).catch(() => 0),
      Warranty.count().catch(() => 0),
      Warranty.count({ where: { status: 'active' } }).catch(() => 0),
      Warranty.count({ where: { status: { [Op.in]: ['pending', 'unclaimed', 'claimed'] } } }).catch(() => 0),
    ]);

    const revenueGrowth = lastMonthRevenue
      ? (((monthRevenue || 0) - lastMonthRevenue) / lastMonthRevenue) * 100
      : null;

    sendSuccess(res, {
      kpis: {
        employees: {
          total: totalEmployeesCount || 0,
          presentToday: activeEmployeesCount || 0,
          onboarded: totalEmployeesCount || 0,
          pendingOnboarding: 0,
        },
        orders: {
          today: todayOrders,
          pendingDispatch,
          overdueDispatch,
          total: totalOrdersAllTime,
          delivered: deliveredOrdersCount || Math.max(0, totalOrdersAllTime - pendingDispatch),
          returned: returnedOrdersCount || 0,
          byStatus: ordersByStatus,
          byMarketplace: ordersByMarketplace,
          byProduct: ordersByProduct,
        },
        revenue: {
          thisMonth: monthRevenue || 0,
          lastMonth: lastMonthRevenue || 0,
          allTime: allTimeRevenue || 0,
          total: allTimeRevenue || 0,
          confirmedThisMonth: confirmedThisMonth || 0,
          confirmedAllTime: confirmedAllTime || 0,
          growthPercent: revenueGrowth ? Math.round(revenueGrowth * 10) / 10 : null,
          byDay: revenueByDay,
        },
        customers: {
          active: activeCustomers,
          inactive: inactiveCustomersCount || Math.max(0, totalCustomersAllTime - activeCustomers),
          newThisMonth: newCustomersMonth,
          total: totalCustomersAllTime,
        },
        warranty: {
          total: totalWarrantiesCount || totalCustomersAllTime,
          activated: activeWarrantiesCount || activeCustomers,
          pending: pendingWarrantiesCount || Math.max(0, totalCustomersAllTime - activeCustomers),
        },
        followUps: {
          pending: pendingFollowUps,
          overdue: overdueFollowUps,
        },
        tasks: {
          open: openTasks,
          overdue: overdueTasks,
        },
        cityWise: cityWiseBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/dashboard/ceo  – CEO pulse view
exports.getCeoView = async (req, res, next) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [topCustomers, recentOrders, teamPerformance, marketplaceBreakdown] =
      await Promise.all([
        // Top 5 customers by revenue
        Customer.findAll({
          attributes: ['id', 'name', 'total_orders', 'total_revenue', 'source'],
          order: [['total_revenue', 'DESC']],
          limit: 5,
        }),

        // Latest 10 orders
        Order.findAll({
          include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
          order: [['created_at', 'DESC']],
          limit: 10,
          attributes: ['id', 'order_number', 'marketplace', 'status', 'total_amount', 'order_date', 'customer_id'],
        }),

        // Team performance – orders closed per user this month
        sequelize.query(
          `SELECT u.id, u.name, u.role,
                  COUNT(o.id) as orders_assigned,
                  SUM(o.total_amount) as total_value,
                  COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) as delivered,
                  COUNT(f.id) as follow_ups_done
           FROM users u
           LEFT JOIN orders o ON o.assigned_to = u.id AND o.created_at >= :startOfMonth
           LEFT JOIN follow_ups f ON f.assigned_to = u.id AND f.status = 'completed' AND f.completed_at >= :startOfMonth
           WHERE u.is_active = 1
           GROUP BY u.id, u.name, u.role
           ORDER BY total_value DESC`,
          {
            replacements: { startOfMonth },
            type: sequelize.QueryTypes.SELECT,
          }
        ),

        // Marketplace breakdown
        Order.findAll({
          attributes: [
            'marketplace',
            [fn('COUNT', col('id')), 'order_count'],
            [fn('SUM', col('total_amount')), 'revenue'],
          ],
          where: { created_at: { [Op.gte]: startOfMonth } },
          group: ['marketplace'],
          raw: true,
        }),
      ]);

    sendSuccess(res, {
      ceoView: { topCustomers, recentOrders, teamPerformance, marketplaceBreakdown },
    });
  } catch (err) {
    next(err);
  }
};