'use strict';

const { Op } = require('sequelize');
const {
  AttendanceDay,
  AttendanceEvent,
  AttendanceSyncRun,
  Employee,
  User,
  EmployeeBiometricMapping,
  BiometricDevice,
} = require('../models');
const smartOfficeAttendanceService = require('../services/smartoffice/smartOfficeAttendanceService');
const { computePresenceStatus } = require('../middleware/presenceMiddleware');
const { sendSuccess, sendPaginated, getPagination } = require('../utils/response');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * 1. GET /api/attendance
 * List daily attendance across employees for a given date.
 * Incorporates:
 * - Biometric Status: PRESENT, HALF_DAY, LATE, ABSENT
 * - CRM Application Status: Online vs Offline (Separated, Requirement 14)
 */
exports.getAttendance = async (req, res, next) => {
  try {
    const { date, department } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const { page, limit, offset } = getPagination(req.query);

    const empWhere = { status: 'active' };
    if (department && department !== 'all') {
      empWhere.department = department;
    }

    const { count, rows: employees } = await Employee.findAndCountAll({
      where: empWhere,
      attributes: ['id', 'user_id', 'employee_code', 'smartoffice_employee_code', 'first_name', 'last_name', 'department', 'designation', 'work_location', 'avatar_url'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'last_active_at', 'presence_status', 'role'],
          required: false,
        },
        {
          model: AttendanceDay,
          as: 'attendanceDays',
          where: { date: targetDate },
          required: false,
        },
      ],
      limit,
      offset,
      order: [['first_name', 'ASC']],
    });

    const data = employees.map((emp) => {
      const attendance = emp.attendanceDays && emp.attendanceDays.length > 0 ? emp.attendanceDays[0] : null;

      // CRM Session Presence (Online vs Offline)
      let crmOnlineStatus = 'no_crm_account';
      if (emp.user) {
        crmOnlineStatus = computePresenceStatus(emp.user.last_active_at);
      }

      // Biometric Attendance Status
      const biometricStatus = attendance ? attendance.status : 'ABSENT';

      return {
        employeeId: emp.id,
        employeeCode: emp.employee_code,
        smartOfficeCode: emp.smartoffice_employee_code,
        name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
        department: emp.department,
        designation: emp.designation,
        avatarUrl: emp.avatar_url,
        date: targetDate,
        biometricStatus, // PRESENT, HALF_DAY, LATE, ABSENT
        firstPunch: attendance ? attendance.first_in : null,
        lastPunch: attendance ? attendance.last_out : null,
        workedMinutes: attendance ? attendance.total_work_minutes : 0,
        workHours: attendance ? attendance.work_hours : 0,
        lateMinutes: attendance ? attendance.late_minutes : 0,
        crmStatus: crmOnlineStatus, // online, idle, offline, no_crm_account
        isLocked: attendance ? attendance.is_locked : false,
      };
    });

    sendPaginated(res, data, { total: count, page, limit }, { targetDate });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. GET /api/attendance/:employeeId
 * Employee-specific attendance history & timeline punches
 */
exports.getEmployeeAttendance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { fromDate, toDate, month, year } = req.query;

    const employee = await Employee.findByPk(employeeId, {
      attributes: ['id', 'user_id', 'employee_code', 'smartoffice_employee_code', 'first_name', 'last_name', 'department', 'designation'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'last_active_at', 'presence_status'],
          required: false,
        },
      ],
    });

    if (!employee) {
      return next(new AppError('Employee not found.', 404));
    }

    const where = { employee_id: employeeId };
    if (fromDate && toDate) {
      where.date = { [Op.between]: [fromDate, toDate] };
    } else if (month && year) {
      const pad = (n) => String(n).padStart(2, '0');
      const start = `${year}-${pad(month)}-01`;
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      where.date = { [Op.between]: [start, end] };
    }

    const attendanceDays = await AttendanceDay.findAll({
      where,
      order: [['date', 'DESC']],
    });

    // Recent raw punch events
    const recentPunches = await AttendanceEvent.findAll({
      where: { employee_id: employeeId },
      order: [['log_datetime', 'DESC']],
      limit: 30,
    });

    // Compute month aggregations
    let totalPresent = 0;
    let totalHalfDay = 0;
    let totalLate = 0;
    let totalWorkMinutes = 0;

    for (const d of attendanceDays) {
      if (d.status === 'PRESENT') totalPresent++;
      if (d.status === 'HALF_DAY') totalHalfDay++;
      if (d.late_minutes > 0) totalLate++;
      totalWorkMinutes += d.total_work_minutes || 0;
    }

    const crmStatus = employee.user ? computePresenceStatus(employee.user.last_active_at) : 'no_crm_account';

    sendSuccess(res, {
      employee: {
        id: employee.id,
        name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
        employeeCode: employee.employee_code,
        smartOfficeCode: employee.smartoffice_employee_code,
        department: employee.department,
        designation: employee.designation,
        crmStatus,
      },
      summary: {
        daysPresent: totalPresent,
        daysHalfDay: totalHalfDay,
        daysLate: totalLate,
        totalWorkHours: (totalWorkMinutes / 60).toFixed(1),
      },
      attendanceDays,
      recentPunches,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. GET /api/attendance/events
 * Raw attendance events queryable with filters
 */
exports.getAttendanceEvents = async (req, res, next) => {
  try {
    const { employeeId, smartOfficeCode, date, fromDate, toDate, status } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const result = await smartOfficeAttendanceService.getEvents({
      employeeId,
      smartOfficeCode,
      date,
      fromDate,
      toDate,
      status,
      limit,
      offset,
    });

    sendPaginated(res, result.rows, { total: result.count, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. GET /api/attendance/smartoffice/status
 * Health, connection, and metrics for SmartOffice integration
 */
exports.getSmartOfficeStatus = async (req, res, next) => {
  try {
    const status = await smartOfficeAttendanceService.getStatus();
    sendSuccess(res, status, 'SmartOffice integration status retrieved.');
  } catch (err) {
    next(err);
  }
};

/**
 * 5. POST /api/attendance/smartoffice/sync
 * Trigger manual sync or historical backfill (Requirement 17 & 18)
 */
exports.triggerSmartOfficeSync = async (req, res, next) => {
  try {
    const { fromDate, toDate, simulate } = req.body;

    logger.info(`[SmartOffice Controller] Sync requested by user ${req.user ? req.user.email : 'system'}: from=${fromDate}, to=${toDate}`);

    const syncResult = await smartOfficeAttendanceService.syncLogs({
      fromDate,
      toDate,
      syncType: (fromDate && toDate) ? 'BACKFILL' : 'MANUAL',
      simulate: simulate === true,
    });

    sendSuccess(res, syncResult, 'SmartOffice synchronization completed.');
  } catch (err) {
    next(err);
  }
};

/**
 * 6. GET /api/attendance/smartoffice/sync-runs
 * Historical audit log of sync runs (Requirement 6)
 */
exports.getSmartOfficeSyncRuns = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const result = await smartOfficeAttendanceService.getSyncRuns({ limit, offset });

    sendPaginated(res, result.rows, { total: result.count, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. POST /api/attendance/smartoffice/map-employee
 * Link unmatched SmartOffice EmployeeCode to CRM employee
 */
exports.mapEmployee = async (req, res, next) => {
  try {
    const { smartOfficeCode, employeeId } = req.body;
    if (!smartOfficeCode || !employeeId) {
      return next(new AppError('Both smartOfficeCode and employeeId are required.', 400));
    }

    const result = await smartOfficeAttendanceService.mapUnmatchedEmployee(smartOfficeCode, employeeId);
    sendSuccess(res, result, 'Employee mapped and historical attendance recalculated.');
  } catch (err) {
    next(err);
  }
};
