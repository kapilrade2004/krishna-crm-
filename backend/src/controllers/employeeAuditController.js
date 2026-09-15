'use strict';

const { Op } = require('sequelize');
const { Employee, User } = require('../models');
const auditService = require('../services/auditService');
const { AppError } = require('../utils/errors');
const { sendSuccess } = require('../utils/response');

/**
 * GET /api/employee-audit/employees
 * List available employees with department/role grouping and active/inactive status
 */
exports.getEmployees = async (req, res, next) => {
  try {
    const { include_inactive, search } = req.query;

    const where = {};
    if (include_inactive !== 'true') {
      where.status = 'active';
    }

    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { employee_code: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { designation: { [Op.like]: `%${search}%` } },
      ];
    }

    // RBAC Manager scoping: Managers can only see their reportees
    if (req.user && req.user.role === 'manager') {
      where[Op.or] = [
        { reporting_manager_id: req.user.id },
        { user_id: req.user.id },
      ];
    }

    const employees = await Employee.findAll({
      where,
      include: [
        { model: User, as: 'linkedUser', attributes: ['id', 'name', 'role', 'email', 'avatar_url'] },
      ],
      order: [['department', 'ASC'], ['first_name', 'ASC']],
    });

    const formatted = employees.map((emp) => ({
      id: emp.id,
      user_id: emp.user_id,
      employee_code: emp.employee_code || `KR-${emp.id.slice(0, 6).toUpperCase()}`,
      full_name: `${emp.first_name} ${emp.last_name}`,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email || emp.linkedUser?.email,
      avatar_url: emp.avatar_url || emp.linkedUser?.avatar_url,
      department: emp.department || 'Sales',
      designation: emp.designation || 'Staff',
      role: emp.linkedUser?.role || 'sales',
      status: emp.status,
      date_of_joining: emp.date_of_joining,
    }));

    sendSuccess(res, { employees: formatted, total: formatted.length });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employee-audit/:employeeId
 */
exports.getEmployeeProfile = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    // Verify permission scoping for Manager
    if (req.user && req.user.role === 'manager') {
      const emp = await Employee.findByPk(employeeId);
      if (emp && emp.reporting_manager_id !== req.user.id && emp.user_id !== req.user.id) {
        return next(new AppError('You are not authorized to view this employee audit.', 403));
      }
    }

    const metrics = await auditService.getEmployeeAuditMetrics(employeeId, 'monthly');
    sendSuccess(res, { profile: metrics.employee, template: metrics.template });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employee-audit/:employeeId/metrics
 */
exports.getMetrics = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { period, from, to } = req.query;

    if (req.user && req.user.role === 'manager') {
      const emp = await Employee.findByPk(employeeId);
      if (emp && emp.reporting_manager_id !== req.user.id && emp.user_id !== req.user.id) {
        return next(new AppError('You are not authorized to view this employee audit.', 403));
      }
    }

    const metrics = await auditService.getEmployeeAuditMetrics(employeeId, period || 'monthly', { from, to });
    sendSuccess(res, { audit: metrics });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employee-audit/:employeeId/daily-breakdown
 */
exports.getDailyBreakdown = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { period, from, to } = req.query;

    if (req.user && req.user.role === 'manager') {
      const emp = await Employee.findByPk(employeeId);
      if (emp && emp.reporting_manager_id !== req.user.id && emp.user_id !== req.user.id) {
        return next(new AppError('You are not authorized to view this employee audit.', 403));
      }
    }

    const breakdown = await auditService.getDailyBreakdown(employeeId, period || 'monthly', { from, to });
    sendSuccess(res, { breakdown });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employee-audit/:employeeId/activity
 */
exports.getActivityTimeline = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 20;

    if (req.user && req.user.role === 'manager') {
      const emp = await Employee.findByPk(employeeId);
      if (emp && emp.reporting_manager_id !== req.user.id && emp.user_id !== req.user.id) {
        return next(new AppError('You are not authorized to view this employee audit.', 403));
      }
    }

    const timeline = await auditService.getActivityTimeline(employeeId, limit);
    sendSuccess(res, { timeline });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/employee-audit/:employeeId/export
 */
exports.exportAudit = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { period, format } = req.query;

    if (req.user && req.user.role === 'manager') {
      const emp = await Employee.findByPk(employeeId);
      if (emp && emp.reporting_manager_id !== req.user.id && emp.user_id !== req.user.id) {
        return next(new AppError('You are not authorized to export this employee audit.', 403));
      }
    }

    const metrics = await auditService.getEmployeeAuditMetrics(employeeId, period || 'monthly');

    const rows = [
      { metric: 'Employee Name', value: metrics.employee.full_name },
      { metric: 'Employee Code', value: metrics.employee.employee_code },
      { metric: 'Department', value: metrics.employee.department },
      { metric: 'Audit Period', value: `${metrics.period.type} (${metrics.period.start} to ${metrics.period.end})` },
      { metric: 'Attendance Rate', value: `${metrics.attendance.attendance_percentage}%` },
    ];

    if (metrics.template === 'technician') {
      rows.push(
        { metric: 'Jobs Assigned', value: metrics.technician.jobs_assigned },
        { metric: 'Jobs Completed', value: metrics.technician.jobs_completed },
        { metric: 'Completion Rate', value: `${metrics.technician.completion_percentage}%` },
        { metric: 'Installations', value: metrics.technician.installations },
        { metric: 'Repairs', value: metrics.technician.repairs }
      );
    } else {
      rows.push(
        { metric: 'Orders Completed', value: metrics.sales.orders_completed },
        { metric: 'Revenue', value: `INR ${metrics.sales.revenue}` },
        { metric: 'Customer Interactions', value: metrics.customer_activity.customer_interactions },
        { metric: 'Tasks Completed', value: metrics.tasks.completed }
      );
    }

    const { sendExportResponse } = require('../utils/exportHelper');
    await sendExportResponse({
      res,
      title: `Audit Report - ${metrics.employee.full_name}`,
      filenameBase: `employee_audit_${metrics.employee.employee_code || employeeId}_${period || 'monthly'}`,
      format: format || 'xlsx',
      columns: [
        { key: 'metric', label: 'Metric / Indicator' },
        { key: 'value', label: 'Value / Performance' },
      ],
      data: rows,
      metadata: {
        period: `${metrics.period.type} (${metrics.period.start} to ${metrics.period.end})`,
        generatedBy: req.user ? req.user.name : 'Manager',
      },
    });
  } catch (err) {
    next(err);
  }
};
