'use strict';

const { Op } = require('sequelize');
const {
  AttendanceDay,
  AttendanceSegment,
  AttendanceShift,
  AttendanceCorrection,
  BiometricPunchEvent,
  BiometricDevice,
  EmployeeBiometricMapping,
  Employee,
  User,
} = require('../models');
const attendanceEngine = require('../services/attendanceEngine');
const biometricService = require('../services/biometricService');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated } = require('../utils/response');
const logger = require('../config/logger');

/**
 * GET /api/hr/attendance - Get daily attendance roster with metrics
 */
exports.getDailyAttendanceRoster = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = req.query.date || todayStr;
    const { department, status, q } = req.query;

    // 1. Fetch all active employees
    const empWhere = { status: 'active' };
    if (department && department !== 'all') empWhere.department = department;

    if (q) {
      empWhere[Op.or] = [
        { first_name: { [Op.like]: `%${q}%` } },
        { last_name: { [Op.like]: `%${q}%` } },
        { employee_code: { [Op.like]: `%${q}%` } },
      ];
    }

    const employees = await Employee.findAll({
      where: empWhere,
      include: [
        { model: EmployeeBiometricMapping, as: 'biometricMapping' },
        { model: User, as: 'linkedUser', attributes: ['id', 'name', 'role', 'email'] },
      ],
      order: [['first_name', 'ASC']],
    });

    // 2. Fetch existing AttendanceDay records for target date
    const attendanceRecords = await AttendanceDay.findAll({
      where: {
        date: targetDate,
      },
      include: [
        { model: AttendanceShift, as: 'shift' },
        { model: AttendanceSegment, as: 'segments' },
      ],
    });

    const attMap = new Map();
    attendanceRecords.forEach((r) => attMap.set(r.employee_id, r));

    // 3. Build unified roster for all employees (ensures absent/unpunched employees are shown)
    const roster = [];
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let incompleteCount = 0;
    let onLeaveCount = 0;

    for (const emp of employees) {
      let att = attMap.get(emp.id);

      // If no record exists yet and date is today or past, calculate or generate placeholder
      if (!att) {
        const punchCount = await BiometricPunchEvent.count({
          where: { employee_id: emp.id, punch_date: targetDate },
        });

        if (punchCount > 0) {
          att = await attendanceEngine.calculateAttendanceForDay(emp.id, targetDate);
        } else {
          att = {
            id: `temp-${emp.id}`,
            employee_id: emp.id,
            employee_code: emp.employee_code,
            date: targetDate,
            scheduled_start: '10:00:00',
            scheduled_end: '18:00:00',
            first_in: null,
            last_out: null,
            work_hours: 0,
            break_hours: 0,
            late_minutes: 0,
            early_leave_minutes: 0,
            overtime_minutes: 0,
            status: 'ABSENT',
            source: 'BIOMETRIC',
            is_corrected: false,
          };
        }
      }

      const attJson = att.toJSON ? att.toJSON() : att;

      switch (attJson.status) {
        case 'PRESENT':
        case 'OVERTIME':
          presentCount++;
          break;
        case 'LATE':
          lateCount++;
          presentCount++;
          break;
        case 'INCOMPLETE':
          incompleteCount++;
          break;
        case 'ON_LEAVE':
          onLeaveCount++;
          break;
        case 'ABSENT':
        default:
          absentCount++;
          break;
      }

      // Filter by status if requested
      if (status && status !== 'all' && attJson.status.toLowerCase() !== status.toLowerCase()) {
        continue;
      }

      roster.push({
        id: attJson.id,
        employee_id: emp.id,
        employee_code: emp.employee_code || '—',
        employee_name: `${emp.first_name} ${emp.last_name}`,
        department: emp.department || 'General',
        designation: emp.designation || 'Staff',
        date: targetDate,
        scheduled_start: attJson.scheduled_start || '10:00',
        scheduled_end: attJson.scheduled_end || '18:00',
        clock_in: attJson.first_in,
        clock_out: attJson.last_out,
        work_hours: attJson.work_hours || 0,
        break_hours: attJson.break_hours || 0,
        late_minutes: attJson.late_minutes || 0,
        early_leave_minutes: attJson.early_leave_minutes || 0,
        overtime_minutes: attJson.overtime_minutes || 0,
        status: attJson.status,
        source: attJson.source || 'BIOMETRIC',
        is_corrected: attJson.is_corrected || false,
        remarks: attJson.remarks,
        biometric_enrolled: emp.biometricMapping?.enrollment_status === 'enrolled',
        device_serial: emp.biometricMapping?.device_serial_number || '—',
      });
    }

    // 4. Device and Biometric high-level stats
    const totalDevices = await BiometricDevice.count({ where: { is_active: true } });
    const devicesOnline = await BiometricDevice.count({ where: { status: 'online', is_active: true } });
    const pendingEnrollments = await EmployeeBiometricMapping.count({
      where: { enrollment_status: { [Op.in]: ['not_enrolled', 'pending_enrollment', 'sync_failed'] } },
    });

    sendSuccess(res, {
      date: targetDate,
      roster,
      summary: {
        total_workforce: employees.length,
        active_staff: employees.length,
        present_today: presentCount,
        late_today: lateCount,
        absent_today: absentCount,
        incomplete_today: incompleteCount,
        on_leave_today: onLeaveCount,
        pending_biometrics: pendingEnrollments,
        devices_online: devicesOnline,
        total_devices: totalDevices,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/hr/attendance/employee/:id - Get attendance history for employee
 */
exports.getEmployeeAttendanceHistory = async (req, res, next) => {
  try {
    const { month } = req.query; // YYYY-MM
    const employeeId = req.params.id;

    const where = { employee_id: employeeId };
    if (month) {
      where.date = { [Op.like]: `${month}%` };
    }

    const records = await AttendanceDay.findAll({
      where,
      include: [
        { model: AttendanceShift, as: 'shift' },
        { model: AttendanceSegment, as: 'segments' },
        { model: AttendanceCorrection, as: 'corrections' },
      ],
      order: [['date', 'DESC']],
    });

    const mapping = await EmployeeBiometricMapping.findOne({ where: { employee_id: employeeId } });

    sendSuccess(res, {
      records,
      biometric_mapping: mapping,
      total: records.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hr/attendance/corrections - Request attendance punch correction
 */
exports.requestCorrection = async (req, res, next) => {
  try {
    const correction = await biometricService.submitCorrection(req.body, req.user?.id);
    sendCreated(res, { correction }, 'Attendance correction request submitted.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/hr/attendance/corrections - List correction requests
 */
exports.getCorrections = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const corrections = await AttendanceCorrection.findAll({
      where,
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'first_name', 'last_name', 'employee_code', 'department'],
        },
        { model: User, as: 'requester', attributes: ['id', 'name'] },
        { model: User, as: 'approver', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']],
    });

    sendSuccess(res, { corrections, total: corrections.length });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hr/attendance/corrections/:id/review - Approve or Reject correction
 */
exports.reviewCorrection = async (req, res, next) => {
  try {
    const { action, rejection_reason } = req.body;
    if (!['approved', 'rejected'].includes(action)) {
      return next(new AppError('Action must be "approved" or "rejected".', 400));
    }

    const correction = await biometricService.reviewCorrection(
      req.params.id,
      action,
      req.user?.id,
      rejection_reason
    );

    sendSuccess(res, { correction }, `Correction request ${action} successfully.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hr/attendance/recalculate - Force recalculation
 */
exports.recalculateAttendance = async (req, res, next) => {
  try {
    const { start_date, end_date, employee_id } = req.body;
    if (!start_date || !end_date) {
      return next(new AppError('start_date and end_date are required.', 400));
    }

    const results = await attendanceEngine.recalculateDateRange(start_date, end_date, employee_id);
    sendSuccess(res, { updated_records_count: results.length }, 'Attendance recalculated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/hr/attendance/me - Self-service attendance for logged-in employee
 */
exports.getMyAttendance = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError('Authentication required.', 401));
    }

    // 1. Resolve employee profile (query user_id first, fallback to email to avoid collation mismatch)
    let employee = await Employee.findOne({
      where: { user_id: userId },
      include: [
        { model: EmployeeBiometricMapping, as: 'biometricMapping' },
      ],
    });

    if (!employee && req.user?.email) {
      employee = await Employee.findOne({
        where: { email: req.user.email.toLowerCase() },
        include: [
          { model: EmployeeBiometricMapping, as: 'biometricMapping' },
        ],
      });
    }

    if (!employee) {
      const { syncUserToEmployee } = require('../services/userEmployeeSyncService');
      employee = await syncUserToEmployee(req.user);
    }

    if (!employee) {
      return next(new AppError('No employee profile associated with your account.', 404));
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = req.query.month || todayStr.slice(0, 7);

    // 2. Query attendance records for current month
    const records = await AttendanceDay.findAll({
      where: {
        employee_id: employee.id,
        date: { [Op.like]: `${currentMonth}%` },
      },
      include: [
        { model: AttendanceShift, as: 'shift' },
        { model: AttendanceSegment, as: 'segments' },
        { model: AttendanceCorrection, as: 'corrections' },
      ],
      order: [['date', 'DESC']],
    });

    // 3. Get or calculate today's record
    let todayRecord = records.find((r) => r.date === todayStr);
    if (!todayRecord) {
      const punchCount = await BiometricPunchEvent.count({
        where: { employee_id: employee.id, punch_date: todayStr },
      });
      if (punchCount > 0) {
        todayRecord = await attendanceEngine.calculateAttendanceForDay(employee.id, todayStr);
      }
    }

    // 4. Calculate monthly summary stats
    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let totalWorkHours = 0;

    records.forEach((r) => {
      const hours = parseFloat(r.work_hours || 0);
      totalWorkHours += hours;
      switch (r.status) {
        case 'PRESENT':
        case 'OVERTIME':
          presentDays++;
          break;
        case 'LATE':
          lateDays++;
          presentDays++;
          break;
        case 'HALF_DAY':
          halfDays++;
          break;
        case 'ABSENT':
        default:
          absentDays++;
          break;
      }
    });

    // 5. Fetch raw punches for today
    const todayPunches = await BiometricPunchEvent.findAll({
      where: { employee_id: employee.id, punch_date: todayStr },
      order: [['punch_timestamp', 'ASC']],
    });

    sendSuccess(res, {
      employee: {
        id: employee.id,
        employee_code: employee.employee_code,
        name: `${employee.first_name} ${employee.last_name}`,
        department: employee.department,
        designation: employee.designation,
        biometric_enrolled: employee.biometricMapping?.enrollment_status === 'enrolled',
        biometric_code: employee.biometricMapping?.biometric_user_id || null,
      },
      today: todayRecord || {
        date: todayStr,
        status: 'NOT_RECORDED',
        clock_in: null,
        clock_out: null,
        work_hours: 0,
      },
      today_punches: todayPunches,
      records,
      summary: {
        month: currentMonth,
        total_days_tracked: records.length,
        present_days: presentDays,
        late_days: lateDays,
        half_days: halfDays,
        absent_days: absentDays,
        total_work_hours: Math.round(totalWorkHours * 10) / 10,
        average_hours_per_day: presentDays > 0 ? Math.round((totalWorkHours / presentDays) * 10) / 10 : 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

