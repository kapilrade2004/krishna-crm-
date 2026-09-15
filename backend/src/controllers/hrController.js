'use strict';

const { Op } = require('sequelize');
const {
  User,
  Employee,
  PayrollProfile,
  PayrollRecord,
  AttendanceDay,
  BiometricPunchEvent,
  BiometricDevice,
  EmployeeBiometricMapping,
} = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated } = require('../utils/response');
const { createAuditEvent } = require('../services/auditService');
const biometricService = require('../services/biometricService');
const attendanceEngine = require('../services/attendanceEngine');
const payrollAttendanceService = require('../services/payrollAttendanceService');
const attendanceController = require('./attendanceController');
const logger = require('../config/logger');

// Persisted HR Policies
let hrPolicies = [
  { id: 'pol-1', title: 'Code of Conduct & Data Security Policy 2026', category: 'General', published_date: '2026-01-15', status: 'Active', file_url: '/docs/code_of_conduct.pdf' },
  { id: 'pol-2', title: 'Paid Leave & Attendance Guidelines', category: 'Leaves', published_date: '2026-02-01', status: 'Active', file_url: '/docs/leave_policy.pdf' },
  { id: 'pol-3', title: 'Remote Work & Telecalling Protocol', category: 'Operations', published_date: '2026-03-10', status: 'Active', file_url: '/docs/telecalling_policy.pdf' },
];

/**
 * GET /api/hr/attendance - Get attendance records & roster
 */
exports.getAttendance = attendanceController.getDailyAttendanceRoster;

/**
 * POST /api/hr/attendance/clock-in - Clock in daily attendance
 */
exports.clockIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const dayRecord = await biometricService.manualClockIn(userId, req.user.id);
    sendSuccess(res, { record: dayRecord }, 'Clocked in successfully via biometric attendance engine.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hr/attendance/clock-out - Clock out daily attendance
 */
exports.clockOut = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const dayRecord = await biometricService.manualClockOut(userId, req.user.id);
    sendSuccess(res, { record: dayRecord }, 'Clocked out successfully via biometric attendance engine.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/hr/payroll - Get payroll components calculated with biometric attendance
 */
exports.getPayroll = async (req, res, next) => {
  try {
    const currentMonth = req.query.month || new Date().toISOString().slice(0, 7);

    const employees = await Employee.findAll({
      where: { status: 'active' },
      include: [
        { model: User, as: 'linkedUser', attributes: ['id', 'name', 'role', 'email'] },
        { model: PayrollProfile, as: 'payrollProfile' },
      ],
      order: [['first_name', 'ASC']],
    });

    const payrollList = [];

    for (const emp of employees) {
      const calc = await payrollAttendanceService.calculateMonthlySalary(emp.id, currentMonth);
      payrollList.push({
        employee_id: emp.id,
        employee_code: emp.employee_code || '—',
        employee_name: calc.employee_name,
        role: emp.designation || emp.department || 'Staff',
        department: emp.department || 'General',
        base_salary: calc.breakdown.base_salary,
        basic: calc.breakdown.basic,
        hra: calc.breakdown.hra,
        conveyance: calc.breakdown.conveyance,
        special_allowance: calc.breakdown.special_allowance,
        overtime_addition: calc.breakdown.overtime_addition,
        unpaid_absence_deduction: calc.breakdown.unpaid_absence_deduction,
        late_penalty_deduction: calc.breakdown.late_penalty_deduction,
        pf: calc.breakdown.pf,
        esi: calc.breakdown.esi,
        tds: calc.breakdown.tds,
        gross_salary: calc.breakdown.gross_salary,
        total_deductions: calc.breakdown.total_deductions,
        net_salary: calc.breakdown.net_salary,
        attendance_summary: calc.attendance_summary,
      });
    }

    sendSuccess(res, {
      payroll: payrollList,
      total: payrollList.length,
      month: currentMonth,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hr/payroll/calculate - Calculate & save salary structure components
 */
exports.calculatePayroll = async (req, res, next) => {
  try {
    const { employee_id, month, basic, hra, conveyance, special_allowance, pf, esi, tds } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    if (!employee_id) {
      return next(new AppError('Employee ID is required.', 400));
    }

    const calculation = await payrollAttendanceService.calculateMonthlySalary(
      employee_id,
      targetMonth,
      { basic, hra, conveyance, special_allowance, pf, esi, tds }
    );

    // Persist or update PayrollProfile
    const [profile] = await PayrollProfile.findOrCreate({
      where: { employee_id },
      defaults: {
        employee_id,
        basic_salary: calculation.breakdown.base_salary,
        fixed_allowances: Number(hra || 0) + Number(conveyance || 0) + Number(special_allowance || 0),
        fixed_deductions: Number(pf || 0) + Number(esi || 0) + Number(tds || 0),
        net_payable_reference: calculation.breakdown.net_salary,
        created_by: req.user?.id,
      },
    });

    await profile.update({
      basic_salary: calculation.breakdown.base_salary,
      fixed_allowances: Number(hra || 0) + Number(conveyance || 0) + Number(special_allowance || 0),
      fixed_deductions: Number(pf || 0) + Number(esi || 0) + Number(tds || 0),
      net_payable_reference: calculation.breakdown.net_salary,
      updated_by: req.user?.id,
    });

    sendSuccess(res, { payroll: calculation }, 'Payroll structure updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/hr/policies - Get all HR policies
 */
exports.getPolicies = async (req, res, next) => {
  try {
    sendSuccess(res, { policies: hrPolicies });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hr/policies - Add new HR policy
 */
exports.createPolicy = async (req, res, next) => {
  try {
    const { title, category, file_url } = req.body;
    if (!title || !category) {
      return next(new AppError('Title and category are required.', 400));
    }

    const newPolicy = {
      id: `pol-${Date.now()}`,
      title,
      category,
      published_date: new Date().toISOString().split('T')[0],
      status: 'Active',
      file_url: file_url || '/docs/policy_default.pdf',
    };

    hrPolicies.unshift(newPolicy);
    sendCreated(res, { policy: newPolicy }, 'Policy created successfully.');
  } catch (err) {
    next(err);
  }
};
