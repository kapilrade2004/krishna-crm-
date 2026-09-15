'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const logger = require('../../config/logger');
const smartOfficeClient = require('./smartOfficeClient');
const { normalizeSmartOfficeLogs } = require('./smartOfficeNormalizer');
const {
  AttendanceEvent,
  AttendanceSyncRun,
  AttendanceDay,
  AttendanceShift,
  Employee,
  EmployeeBiometricMapping,
  BiometricDevice,
} = require('../../models');

class SmartOfficeAttendanceService {
  /**
   * Resolve an Employee instance from a SmartOffice employee code.
   * Matches against:
   * 1. employees.smartoffice_employee_code
   * 2. employees.employee_code
   * 3. employee_biometric_mappings.smartoffice_employee_code
   * 4. employee_biometric_mappings.employee_code
   */
  async _buildEmployeeLookupMap() {
    const lookupMap = new Map();

    try {
      // 1. All employees
      const employees = await Employee.findAll({
        attributes: ['id', 'employee_code', 'smartoffice_employee_code', 'first_name', 'last_name', 'status'],
      });

      for (const emp of employees) {
        if (emp.smartoffice_employee_code) {
          lookupMap.set(String(emp.smartoffice_employee_code).trim().toLowerCase(), emp);
        }
        if (emp.employee_code) {
          lookupMap.set(String(emp.employee_code).trim().toLowerCase(), emp);
        }
      }

      // 2. Mappings table
      const mappings = await EmployeeBiometricMapping.findAll({
        attributes: ['employee_id', 'employee_code', 'smartoffice_employee_code'],
      });

      for (const map of mappings) {
        if (!map.employee_id) continue;
        const emp = employees.find((e) => e.id === map.employee_id);
        if (!emp) continue;

        if (map.smartoffice_employee_code) {
          lookupMap.set(String(map.smartoffice_employee_code).trim().toLowerCase(), emp);
        }
        if (map.employee_code) {
          lookupMap.set(String(map.employee_code).trim().toLowerCase(), emp);
        }
      }
    } catch (err) {
      logger.error(`[SmartOffice Service] Failed to build employee lookup map: ${err.message}`);
    }

    return lookupMap;
  }

  /**
   * Synchronize attendance logs from SmartOffice for a specified date range
   * @param {Object} options
   * @param {string|Date} options.fromDate
   * @param {string|Date} options.toDate
   * @param {string} [options.syncType='SCHEDULED'] 'SCHEDULED', 'MANUAL', or 'BACKFILL'
   * @param {boolean} [options.simulate=false]
   * @returns {Promise<Object>} syncSummary
   */
  async syncLogs(options = {}) {
    const startTime = Date.now();
    const fromDate = options.fromDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = options.toDate || new Date();
    const syncType = options.syncType || 'SCHEDULED';

    const fromDateStr = typeof fromDate === 'string' ? fromDate : fromDate.toISOString().split('T')[0];
    const toDateStr = typeof toDate === 'string' ? toDate : toDate.toISOString().split('T')[0];

    logger.info(`[SmartOffice Service] Starting ${syncType} sync from ${fromDateStr} to ${toDateStr}`);

    // Create sync run record
    let syncRun = null;
    try {
      syncRun = await AttendanceSyncRun.create({
        id: uuidv4(),
        from_datetime: fromDateStr,
        to_datetime: toDateStr,
        started_at: new Date(),
        sync_type: syncType,
        status: 'RUNNING',
      });
    } catch (err) {
      logger.error(`[SmartOffice Service] Error creating sync run record: ${err.message}`);
    }

    let recordsReceived = 0;
    let recordsInserted = 0;
    let recordsDuplicate = 0;
    let recordsUnmatched = 0;
    let recordsFailed = 0;
    let syncStatus = 'COMPLETED';
    let errorMessage = null;

    const affectedEmployeeDates = new Map(); // key: employeeId_YYYY-MM-DD -> { employeeId, date, employeeCode }

    try {
      // 1. Fetch raw logs from SmartOffice API
      let rawLogs = [];
      try {
        rawLogs = await smartOfficeClient.getDeviceLogs({
          fromDate,
          toDate,
          simulate: options.simulate,
          apiKey: options.apiKey,
        });
      } catch (fetchErr) {
        syncStatus = 'FAILED';
        errorMessage = fetchErr.message;
        logger.error(`[SmartOffice Service] API fetch error: ${fetchErr.message}`);
        throw fetchErr;
      }

      // 2. Normalize logs
      const normalizedLogs = normalizeSmartOfficeLogs(rawLogs);
      recordsReceived = normalizedLogs.length;

      logger.info(`[SmartOffice Service] Received ${rawLogs.length} raw logs, ${normalizedLogs.length} normalized logs.`);

      if (normalizedLogs.length === 0) {
        const durationMs = Date.now() - startTime;
        if (syncRun) {
          await syncRun.update({
            completed_at: new Date(),
            duration_ms: durationMs,
            records_received: 0,
            records_inserted: 0,
            records_duplicate: 0,
            records_unmatched: 0,
            records_failed: 0,
            status: 'COMPLETED',
          });
        }
        return {
          syncRunId: syncRun ? syncRun.id : null,
          status: 'COMPLETED',
          recordsReceived: 0,
          recordsInserted: 0,
          recordsDuplicate: 0,
          recordsUnmatched: 0,
          recordsFailed: 0,
          durationMs,
        };
      }

      // 3. Match Employees
      const employeeLookup = await this._buildEmployeeLookupMap();

      // Check existing keys in DB for bulk deduplication
      const externalKeys = normalizedLogs.map((l) => l.externalEventKey);
      const existingEvents = await AttendanceEvent.findAll({
        where: { external_event_key: { [Op.in]: externalKeys } },
        attributes: ['external_event_key'],
      });
      const existingKeySet = new Set(existingEvents.map((e) => e.external_event_key));

      // 4. Process each log
      for (const log of normalizedLogs) {
        // Check duplicate
        if (existingKeySet.has(log.externalEventKey)) {
          recordsDuplicate++;
          continue;
        }

        const lookupKey = log.employeeCode.toLowerCase();
        const matchedEmp = employeeLookup.get(lookupKey);

        const eventStatus = matchedEmp ? 'PROCESSED' : 'UNMATCHED_EMPLOYEE';
        const employeeId = matchedEmp ? matchedEmp.id : null;

        if (!matchedEmp) {
          recordsUnmatched++;
        }

        try {
          await AttendanceEvent.create({
            id: uuidv4(),
            employee_id: employeeId,
            smartoffice_employee_code: log.employeeCode,
            device_serial_number: log.serialNumber,
            log_datetime: new Date(log.logDateTime),
            punch_direction: log.punchDirection,
            temperature: log.temperature,
            temperature_state: log.temperatureState,
            source: 'smartoffice',
            external_event_key: log.externalEventKey,
            status: eventStatus,
            raw_payload: log.raw,
            received_at: new Date(),
          });

          recordsInserted++;
          existingKeySet.add(log.externalEventKey);

          // Mark date for daily attendance calculation if employee was matched
          if (matchedEmp && log.logDateTime) {
            const dateOnly = log.logDateTime.split(' ')[0];
            const compositeKey = `${matchedEmp.id}_${dateOnly}`;
            affectedEmployeeDates.set(compositeKey, {
              employeeId: matchedEmp.id,
              date: dateOnly,
              employeeCode: matchedEmp.employee_code || log.employeeCode,
            });
          }
        } catch (insertErr) {
          if (insertErr.name === 'SequelizeUniqueConstraintError') {
            recordsDuplicate++;
          } else {
            recordsFailed++;
            logger.error(`[SmartOffice Service] Failed to insert event ${log.externalEventKey}: ${insertErr.message}`);
          }
        }
      }

      // 5. Recalculate Daily Attendance for affected dates
      if (affectedEmployeeDates.size > 0) {
        logger.info(`[SmartOffice Service] Recalculating daily attendance for ${affectedEmployeeDates.size} employee-date combinations...`);
        for (const item of affectedEmployeeDates.values()) {
          await this.recalculateDailyAttendance(item.employeeId, item.date, item.employeeCode);
        }
      }

      if (recordsFailed > 0 && recordsInserted > 0) {
        syncStatus = 'PARTIAL';
      } else if (recordsFailed > 0 && recordsInserted === 0 && recordsReceived > 0) {
        syncStatus = 'FAILED';
      } else {
        syncStatus = 'COMPLETED';
      }
    } catch (err) {
      syncStatus = 'FAILED';
      errorMessage = err.message;
      logger.error(`[SmartOffice Service] Sync failed: ${err.message}`);
    } finally {
      const durationMs = Date.now() - startTime;
      if (syncRun) {
        try {
          await syncRun.update({
            completed_at: new Date(),
            duration_ms: durationMs,
            records_received: recordsReceived,
            records_inserted: recordsInserted,
            records_duplicate: recordsDuplicate,
            records_unmatched: recordsUnmatched,
            records_failed: recordsFailed,
            status: syncStatus,
            error_message: errorMessage,
          });
        } catch (updateErr) {
          logger.error(`[SmartOffice Service] Failed to update sync run: ${updateErr.message}`);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      syncRunId: syncRun ? syncRun.id : null,
      status: syncStatus,
      recordsReceived,
      recordsInserted,
      recordsDuplicate,
      recordsUnmatched,
      recordsFailed,
      durationMs,
      errorMessage,
    };
  }

  /**
   * Recalculate daily attendance for an employee on a given date (Requirement 12 & 13)
   * Status is 'PRESENT' if >= 1 valid punch exists.
   */
  async recalculateDailyAttendance(employeeId, dateStr, employeeCode = null) {
    if (!employeeId || !dateStr) return null;

    try {
      // Find all valid punches for this employee on this date
      const startOfDay = new Date(`${dateStr} 00:00:00`);
      const endOfDay = new Date(`${dateStr} 23:59:59`);

      const punches = await AttendanceEvent.findAll({
        where: {
          employee_id: employeeId,
          log_datetime: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
        order: [['log_datetime', 'ASC']],
      });

      if (punches.length === 0) {
        return null;
      }

      const firstPunch = punches[0];
      const lastPunch = punches[punches.length - 1];

      const pad = (n) => String(n).padStart(2, '0');
      const getHMSTime = (d) => {
        const dateObj = new Date(d);
        return `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
      };

      const firstIn = getHMSTime(firstPunch.log_datetime);
      const lastOut = punches.length > 1 ? getHMSTime(lastPunch.log_datetime) : firstIn;

      // Calculate total work minutes
      let totalWorkMinutes = 0;
      if (punches.length > 1) {
        const diffMs = new Date(lastPunch.log_datetime).getTime() - new Date(firstPunch.log_datetime).getTime();
        totalWorkMinutes = Math.max(0, Math.round(diffMs / 60000));
      }
      const workHours = (totalWorkMinutes / 60).toFixed(2);

      // Default shift checks
      let attendanceStatus = 'PRESENT';
      let lateMinutes = 0;
      let earlyLeaveMinutes = 0;

      // Check default shift if available
      const shift = await AttendanceShift.findOne({ where: { is_default: true, is_active: true } });
      if (shift) {
        const [shiftStartH, shiftStartM] = shift.start_time.split(':').map(Number);
        const [firstInH, firstInM] = firstIn.split(':').map(Number);
        const shiftStartMins = shiftStartH * 60 + shiftStartM + (shift.grace_period_minutes || 0);
        const firstInMins = firstInH * 60 + firstInM;

        if (firstInMins > shiftStartMins) {
          lateMinutes = firstInMins - (shiftStartH * 60 + shiftStartM);
        }

        const minFullDayMins = (parseFloat(shift.min_full_day_hours) || 8.0) * 60;
        const minHalfDayMins = (parseFloat(shift.min_half_day_hours) || 4.0) * 60;

        if (totalWorkMinutes > 0 && totalWorkMinutes < minHalfDayMins) {
          attendanceStatus = 'HALF_DAY';
        }
      }

      // Upsert into AttendanceDay
      let attendanceDay = await AttendanceDay.findOne({
        where: { employee_id: employeeId, date: dateStr },
      });

      if (!attendanceDay) {
        attendanceDay = await AttendanceDay.create({
          id: uuidv4(),
          employee_id: employeeId,
          employee_code: employeeCode,
          date: dateStr,
          first_in: firstIn,
          last_out: lastOut,
          total_work_minutes: totalWorkMinutes,
          work_hours: parseFloat(workHours),
          late_minutes: lateMinutes,
          early_leave_minutes: earlyLeaveMinutes,
          status: attendanceStatus,
          source: 'BIOMETRIC',
        });
      } else {
        // Do not overwrite manual manager edits if locked
        if (!attendanceDay.is_locked) {
          await attendanceDay.update({
            first_in: firstIn,
            last_out: lastOut,
            total_work_minutes: totalWorkMinutes,
            work_hours: parseFloat(workHours),
            late_minutes: lateMinutes,
            status: attendanceStatus,
            source: attendanceDay.source === 'MANUAL' ? 'HYBRID' : 'BIOMETRIC',
          });
        }
      }

      return attendanceDay;
    } catch (err) {
      logger.error(`[SmartOffice Service] Error calculating daily attendance for ${employeeId} on ${dateStr}: ${err.message}`);
      return null;
    }
  }

  /**
   * Retroactive mapping resolution for unmatched SmartOffice employee codes (Requirement 10)
   * Links all historical unmatched punches for smartOfficeCode to employeeId and recalculates daily attendance.
   */
  async mapUnmatchedEmployee(smartOfficeCode, employeeId) {
    if (!smartOfficeCode || !employeeId) {
      throw new Error('smartOfficeCode and employeeId are required.');
    }

    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      throw new Error(`Employee with ID ${employeeId} not found.`);
    }

    // 1. Update employee record
    await employee.update({ smartoffice_employee_code: smartOfficeCode });

    // 2. Also ensure mapping in employee_biometric_mappings
    await EmployeeBiometricMapping.upsert({
      employee_id: employee.id,
      employee_code: employee.employee_code || smartOfficeCode,
      smartoffice_employee_code: smartOfficeCode,
      enrollment_status: 'enrolled',
      last_synced_at: new Date(),
    });

    // 3. Find all unmatched events for this code
    const unmatchedEvents = await AttendanceEvent.findAll({
      where: {
        smartoffice_employee_code: smartOfficeCode,
        employee_id: null,
      },
      attributes: ['id', 'log_datetime'],
    });

    // 4. Update unmatched events
    const [updatedCount] = await AttendanceEvent.update(
      {
        employee_id: employee.id,
        status: 'PROCESSED',
      },
      {
        where: {
          smartoffice_employee_code: smartOfficeCode,
          employee_id: null,
        },
      }
    );

    // 5. Recalculate daily attendance for all affected dates
    const affectedDates = new Set(
      unmatchedEvents.map((e) => {
        const d = new Date(e.log_datetime);
        return d.toISOString().split('T')[0];
      })
    );

    for (const dateStr of affectedDates) {
      await this.recalculateDailyAttendance(employee.id, dateStr, employee.employee_code);
    }

    return {
      success: true,
      smartOfficeCode,
      employeeId: employee.id,
      eventsMapped: updatedCount,
      datesRecalculated: affectedDates.size,
    };
  }

  /**
   * Backfill attendance across an arbitrary historical date range (Requirement 18)
   */
  async backfill(fromDate, toDate) {
    return await this.syncLogs({
      fromDate,
      toDate,
      syncType: 'BACKFILL',
    });
  }

  /**
   * Get sync status, connection health, and summary metrics (Requirement 16)
   */
  async getStatus() {
    const lastRun = await AttendanceSyncRun.findOne({
      order: [['started_at', 'DESC']],
    });

    const lastSuccessfulRun = await AttendanceSyncRun.findOne({
      where: { status: 'COMPLETED' },
      order: [['completed_at', 'DESC']],
    });

    const totalPunches = await AttendanceEvent.count();
    const unmatchedPunches = await AttendanceEvent.count({
      where: { status: 'UNMATCHED_EMPLOYEE' },
    });

    const devices = await BiometricDevice.findAll({
      attributes: ['id', 'device_name', 'serial_number', 'status', 'last_sync_at'],
    });

    return {
      configured: Boolean(process.env.SMARTOFFICE_API_KEY && process.env.SMARTOFFICE_BASE_URL),
      baseUrl: process.env.SMARTOFFICE_BASE_URL || 'http://192.168.1.38:82',
      syncEnabled: process.env.SMARTOFFICE_SYNC_ENABLED === 'true',
      intervalSeconds: parseInt(process.env.SMARTOFFICE_SYNC_INTERVAL_SECONDS || 60, 10),
      totalPunches,
      unmatchedPunches,
      devices,
      lastRun,
      lastSuccessfulSync: lastSuccessfulRun ? lastSuccessfulRun.completed_at : null,
    };
  }

  /**
   * Get list of sync runs for audit / monitoring
   */
  async getSyncRuns({ limit = 20, offset = 0 } = {}) {
    return await AttendanceSyncRun.findAndCountAll({
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['started_at', 'DESC']],
    });
  }

  /**
   * Query raw attendance events with filters
   */
  async getEvents({ employeeId, smartOfficeCode, date, fromDate, toDate, status, limit = 50, offset = 0 } = {}) {
    const where = {};
    if (employeeId) where.employee_id = employeeId;
    if (smartOfficeCode) where.smartoffice_employee_code = smartOfficeCode;
    if (status) where.status = status;

    if (date) {
      const start = new Date(`${date} 00:00:00`);
      const end = new Date(`${date} 23:59:59`);
      where.log_datetime = { [Op.between]: [start, end] };
    } else if (fromDate && toDate) {
      where.log_datetime = {
        [Op.between]: [new Date(`${fromDate} 00:00:00`), new Date(`${toDate} 23:59:59`)],
      };
    }

    return await AttendanceEvent.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order: [['log_datetime', 'DESC']],
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'first_name', 'last_name', 'employee_code', 'department', 'designation'],
          required: false,
        },
      ],
    });
  }
}

module.exports = new SmartOfficeAttendanceService();
module.exports.SmartOfficeAttendanceService = SmartOfficeAttendanceService;
