'use strict';

const { Op } = require('sequelize');
const { PayrollProfile, PayrollRecord, Employee, User } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination } = require('../utils/response');
const { createAuditEvent } = require('../services/auditService');
const logger = require('../config/logger');

// ── Helper: Check Payroll Access Authorization ────────────────────────────────
const checkPayrollAccess = async (reqUser, targetEmployeeId) => {
  const role = (reqUser.role || '').toLowerCase();
  const isSuperAdmin = role === 'admin' || role === 'super_admin';
  const isHR = role === 'hr';

  if (isSuperAdmin || isHR) return true;

  // Check if it is the employee's own record
  const employee = await Employee.findByPk(targetEmployeeId);
  if (employee && employee.user_id === reqUser.id) {
    return true;
  }

  return false;
};

/**
 * GET /api/payroll/profile/:employeeId
 * Retrieve employee compensation profile (Confidential)
 */
exports.getPayrollProfile = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const isAuthorized = await checkPayrollAccess(req.user, employeeId);

    if (!isAuthorized) {
      return next(new AppError('Unauthorized: Payroll information is strictly confidential.', 403));
    }

    const employee = await Employee.findByPk(employeeId, {
      attributes: ['id', 'user_id', 'employee_code', 'first_name', 'last_name', 'department', 'designation', 'salary', 'bank_name', 'bank_account_number', 'bank_ifsc', 'pan_number'],
    });

    if (!employee) {
      return next(new AppError('Employee record not found.', 404));
    }

    let profile = await PayrollProfile.findOne({ where: { employee_id: employeeId } });

    // If profile doesn't exist yet, return a populated draft from Employee table defaults
    if (!profile) {
      const basic = parseFloat(employee.salary || 0);
      const allowances = 0;
      const deductions = 0;
      profile = {
        employee_id: employee.id,
        salary_type: 'monthly',
        basic_salary: basic,
        fixed_allowances: allowances,
        fixed_deductions: deductions,
        net_payable_reference: basic + allowances - deductions,
        effective_from: null,
        payment_method: 'bank_transfer',
        bank_name: employee.bank_name || '',
        bank_account_reference: employee.bank_account_number || '',
        bank_ifsc: employee.bank_ifsc || '',
        pan_number: employee.pan_number || '',
        status: 'active',
        is_draft: true,
      };
    }

    sendSuccess(res, { profile, employee });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payroll/profile/:employeeId
 * Create or update employee compensation profile (HR / Super Admin only)
 */
exports.upsertPayrollProfile = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const role = (req.user.role || '').toLowerCase();
    const canManage = role === 'admin' || role === 'super_admin' || role === 'hr';

    if (!canManage) {
      return next(new AppError('Unauthorized: Only HR and Super Admin can manage payroll compensation.', 403));
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return next(new AppError('Employee not found.', 404));
    }

    const {
      salary_type = 'monthly',
      basic_salary = 0,
      fixed_allowances = 0,
      fixed_deductions = 0,
      effective_from,
      payment_method = 'bank_transfer',
      bank_account_reference,
      bank_name,
      bank_ifsc,
      pan_number,
      status = 'active',
    } = req.body;

    const numBasic = parseFloat(basic_salary) || 0;
    const numAllow = parseFloat(fixed_allowances) || 0;
    const numDeduct = parseFloat(fixed_deductions) || 0;
    const netPayable = numBasic + numAllow - numDeduct;

    let profile = await PayrollProfile.findOne({ where: { employee_id: employeeId } });

    if (profile) {
      await profile.update({
        salary_type,
        basic_salary: numBasic,
        fixed_allowances: numAllow,
        fixed_deductions: numDeduct,
        net_payable_reference: netPayable,
        effective_from: effective_from || profile.effective_from,
        payment_method,
        bank_account_reference: bank_account_reference || profile.bank_account_reference,
        bank_name: bank_name || profile.bank_name,
        bank_ifsc: bank_ifsc || profile.bank_ifsc,
        pan_number: pan_number || profile.pan_number,
        status,
        updated_by: req.user.id,
      });
    } else {
      profile = await PayrollProfile.create({
        employee_id: employeeId,
        salary_type,
        basic_salary: numBasic,
        fixed_allowances: numAllow,
        fixed_deductions: numDeduct,
        net_payable_reference: netPayable,
        effective_from: effective_from || new Date().toISOString().split('T')[0],
        payment_method,
        bank_account_reference,
        bank_name,
        bank_ifsc,
        pan_number,
        status,
        created_by: req.user.id,
        updated_by: req.user.id,
      });
    }

    // Sync basic salary & bank details back to Employee record
    await employee.update({
      salary: numBasic,
      bank_name: bank_name || employee.bank_name,
      bank_account_number: bank_account_reference || employee.bank_account_number,
      bank_ifsc: bank_ifsc || employee.bank_ifsc,
      pan_number: pan_number || employee.pan_number,
    });

    createAuditEvent({
      userId: employee.user_id || req.user.id,
      actorUserId: req.user.id,
      action: 'PAYROLL_PROFILE_UPDATED',
      module: 'hr',
      entityType: 'PayrollProfile',
      entityId: profile.id,
      metadata: { basic_salary: numBasic, net_payable: netPayable },
    });

    sendSuccess(res, { profile }, 'Compensation profile updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/payroll/records
 * Query monthly payroll records with filtering & pagination
 */
exports.getPayrollRecords = async (req, res, next) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const isSuperAdmin = role === 'admin' || role === 'super_admin';
    const isHR = role === 'hr';

    const { month, status, employee_id, search } = req.query;
    const { limit, offset, page } = getPagination(req);

    const where = {};
    if (month) where.payroll_month = month;
    if (status && status !== 'all') where.payment_status = status;

    if (!isSuperAdmin && !isHR) {
      // Find logged-in user's employee record
      const myEmployee = await Employee.findOne({ where: { user_id: req.user.id } });
      if (!myEmployee) {
        return sendPaginated(res, [], 0, page, limit);
      }
      where.employee_id = myEmployee.id;
    } else if (employee_id) {
      where.employee_id = employee_id;
    }

    const empWhere = {};
    if (search) {
      empWhere[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { employee_code: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await PayrollRecord.findAndCountAll({
      where,
      include: [
        {
          model: Employee,
          as: 'employee',
          where: Object.keys(empWhere).length > 0 ? empWhere : undefined,
          attributes: ['id', 'user_id', 'employee_code', 'first_name', 'last_name', 'department', 'designation', 'email'],
        },
      ],
      order: [['payroll_month', 'DESC'], ['created_at', 'DESC']],
      limit,
      offset,
    });

    sendPaginated(res, rows, count, page, limit);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payroll/records
 * Create a new monthly payroll record (HR / Super Admin only)
 */
exports.createPayrollRecord = async (req, res, next) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    const canManage = role === 'admin' || role === 'super_admin' || role === 'hr';

    if (!canManage) {
      return next(new AppError('Unauthorized: Only HR and Super Admin can create payroll records.', 403));
    }

    const {
      employee_id,
      payroll_month,
      gross_amount,
      allowances = 0,
      deductions = 0,
      payment_status = 'draft',
      payment_method = 'bank_transfer',
      transaction_reference,
      remarks,
    } = req.body;

    if (!employee_id || !payroll_month) {
      return next(new AppError('Employee ID and Payroll Month (YYYY-MM) are required.', 400));
    }

    const employee = await Employee.findByPk(employee_id);
    if (!employee) {
      return next(new AppError('Employee not found.', 404));
    }

    const numGross = parseFloat(gross_amount) || 0;
    const numAllow = parseFloat(allowances) || 0;
    const numDeduct = parseFloat(deductions) || 0;
    const numNet = numGross + numAllow - numDeduct;

    const record = await PayrollRecord.create({
      employee_id,
      payroll_month,
      gross_amount: numGross,
      allowances: numAllow,
      deductions: numDeduct,
      net_amount: numNet,
      payment_status,
      processed_by: req.user.id,
      processed_at: payment_status === 'processed' ? new Date() : null,
      payment_method,
      transaction_reference,
      remarks,
    });

    createAuditEvent({
      userId: employee.user_id || req.user.id,
      actorUserId: req.user.id,
      action: 'PAYROLL_RECORD_CREATED',
      module: 'hr',
      entityType: 'PayrollRecord',
      entityId: record.id,
      metadata: { month: payroll_month, net_amount: numNet, status: payment_status },
    });

    sendCreated(res, { record }, 'Payroll record created successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/payroll/records/:id/status
 * Update payroll payment status (Approved, Processed, Cancelled)
 */
exports.updatePayrollRecordStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = (req.user.role || '').toLowerCase();
    const canManage = role === 'admin' || role === 'super_admin' || role === 'hr';

    if (!canManage) {
      return next(new AppError('Unauthorized: Only HR and Super Admin can update payroll status.', 403));
    }

    const record = await PayrollRecord.findByPk(id, {
      include: [{ model: Employee, as: 'employee' }],
    });

    if (!record) {
      return next(new AppError('Payroll record not found.', 404));
    }

    const { payment_status, transaction_reference, remarks } = req.body;

    const oldStatus = record.payment_status;
    record.payment_status = payment_status || record.payment_status;
    if (transaction_reference !== undefined) record.transaction_reference = transaction_reference;
    if (remarks !== undefined) record.remarks = remarks;

    if (payment_status === 'processed' && !record.processed_at) {
      record.processed_at = new Date();
      record.processed_by = req.user.id;
    }

    await record.save();

    createAuditEvent({
      userId: record.employee?.user_id || req.user.id,
      actorUserId: req.user.id,
      action: 'PAYROLL_STATUS_UPDATED',
      module: 'hr',
      entityType: 'PayrollRecord',
      entityId: record.id,
      metadata: { old_status: oldStatus, new_status: record.payment_status },
    });

    sendSuccess(res, { record }, `Payroll record updated to ${record.payment_status}.`);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/payroll/history/:employeeId
 * Get payslip history for a specific employee
 */
exports.getEmployeePayrollHistory = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const isAuthorized = await checkPayrollAccess(req.user, employeeId);

    if (!isAuthorized) {
      return next(new AppError('Unauthorized: Payroll information is strictly confidential.', 403));
    }

    const records = await PayrollRecord.findAll({
      where: { employee_id: employeeId },
      order: [['payroll_month', 'DESC']],
    });

    sendSuccess(res, { records, total: records.length });
  } catch (err) {
    next(err);
  }
};
