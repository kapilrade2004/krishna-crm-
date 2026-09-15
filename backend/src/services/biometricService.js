'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  BiometricDevice,
  EmployeeBiometricMapping,
  BiometricPunchEvent,
  AttendanceDay,
  AttendanceCorrection,
  IntegrationSyncState,
  AttendanceAuditLog,
  Employee,
  User,
  sequelize,
} = require('../models');
const smartOfficeClient = require('./smartOfficeClient');
const attendanceEngine = require('./attendanceEngine');
const logger = require('../config/logger');

/**
 * Biometric Service
 * Orchestrates device management, employee synchronization, raw punch ingestion, and audit trails.
 */
class BiometricService {
  /**
   * Helper: Generate unique SHA-256 hash for duplicate event prevention
   */
  generatePunchHash({ employeeCode, punchTimestamp, deviceSerialNumber, punchDirection }) {
    const raw = `${String(employeeCode).trim()}_${new Date(punchTimestamp).toISOString()}_${String(deviceSerialNumber || '').trim()}_${String(punchDirection || '').toUpperCase().trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Register a new BioMax / SmartOffice device
   */
  async registerDevice(deviceData, actorUserId = null) {
    const { device_name, serial_number, location, ip_address, port } = deviceData;

    // Check if device exists in CRM
    const existing = await BiometricDevice.findOne({ where: { serial_number } });
    if (existing) {
      throw new Error(`Device with serial number ${serial_number} is already registered.`);
    }

    // Call SmartOffice AddBiometric API
    try {
      await smartOfficeClient.addBiometricDevice(device_name, serial_number);
    } catch (apiErr) {
      logger.warn(`SmartOffice device registration notice: ${apiErr.message}`);
    }

    const device = await BiometricDevice.create({
      device_name,
      serial_number,
      location: location || 'Main Office',
      ip_address,
      port: port || 4370,
      status: 'online',
      created_by: actorUserId,
    });

    if (actorUserId) {
      await AttendanceAuditLog.create({
        actor_user_id: actorUserId,
        action: 'DEVICE_REGISTERED',
        entity_type: 'BiometricDevice',
        entity_id: device.id,
        after_state: device.toJSON(),
        reason: `Registered biometric device ${device_name} (${serial_number})`,
      });
    }

    return device;
  }

  /**
   * Remove biometric device
   */
  async removeDevice(deviceId, actorUserId = null) {
    const device = await BiometricDevice.findByPk(deviceId);
    if (!device) throw new Error('Biometric device not found.');

    try {
      await smartOfficeClient.deleteBiometricDevice(device.serial_number);
    } catch (apiErr) {
      logger.warn(`SmartOffice delete device notice: ${apiErr.message}`);
    }

    const beforeState = device.toJSON();
    await device.destroy();

    if (actorUserId) {
      await AttendanceAuditLog.create({
        actor_user_id: actorUserId,
        action: 'DEVICE_DELETED',
        entity_type: 'BiometricDevice',
        entity_id: deviceId,
        before_state: beforeState,
        reason: `Deleted biometric device ${device.device_name} (${device.serial_number})`,
      });
    }

    return { message: 'Device removed successfully.' };
  }

  /**
   * Upload employee profile to SmartOffice & BioMax device
   */
  async uploadEmployeeToDevice(employeeId, deviceId = null, actorUserId = null) {
    const employee = await Employee.findByPk(employeeId);
    if (!employee) throw new Error('Employee not found.');

    let device = null;
    if (deviceId) {
      device = await BiometricDevice.findByPk(deviceId);
    } else {
      device = await BiometricDevice.findOne({ where: { status: 'online', is_active: true } });
    }

    const serialNumber = device ? device.serial_number : 'BIO-DEFAULT-01';

    // Ensure employee code exists
    const employeeCode = employee.employee_code || `EMP-${employee.id.slice(0, 5)}`;
    if (!employee.employee_code) {
      await employee.update({ employee_code: employeeCode });
    }

    const employeeName = `${employee.first_name} ${employee.last_name}`.trim();

    // Call SmartOffice UploadUser API
    let uploadSuccess = false;
    let syncError = null;

    try {
      const res = await smartOfficeClient.uploadUser({
        employeeName,
        employeeCode,
        serialNumber,
        isFPUpload: true,
      });
      uploadSuccess = true;
      logger.info(`[Biometric] Successfully uploaded user ${employeeCode} to device ${serialNumber}`);
    } catch (err) {
      syncError = err.message;
      logger.error(`[Biometric] Failed to upload user ${employeeCode} to device: ${err.message}`);
    }

    // Upsert mapping record
    const [mapping, created] = await EmployeeBiometricMapping.findOrCreate({
      where: { employee_id: employeeId },
      defaults: {
        employee_id: employeeId,
        employee_code: employeeCode,
        smartoffice_employee_code: employeeCode,
        device_id: device ? device.id : null,
        device_serial_number: serialNumber,
        fingerprint_enabled: true,
        enrollment_status: uploadSuccess ? 'pending_enrollment' : 'sync_failed',
        last_synced_at: new Date(),
        sync_error: syncError,
      },
    });

    if (!created) {
      await mapping.update({
        employee_code: employeeCode,
        device_id: device ? device.id : mapping.device_id,
        device_serial_number: serialNumber,
        enrollment_status: uploadSuccess ? 'pending_enrollment' : 'sync_failed',
        last_synced_at: new Date(),
        sync_error: syncError,
      });
    }

    if (actorUserId) {
      await AttendanceAuditLog.create({
        actor_user_id: actorUserId,
        action: 'EMPLOYEE_BIOMETRIC_UPLOADED',
        entity_type: 'EmployeeBiometricMapping',
        entity_id: mapping.id,
        after_state: mapping.toJSON(),
        reason: `Uploaded employee ${employeeName} (${employeeCode}) to biometric device ${serialNumber}`,
      });
    }

    return mapping;
  }

  /**
   * Trigger online enrollment on BioMax machine
   */
  async triggerOnlineEnrollment(employeeId, actorUserId = null) {
    const mapping = await EmployeeBiometricMapping.findOne({ where: { employee_id: employeeId } });
    if (!mapping) throw new Error('Employee biometric mapping not found. Please upload to device first.');

    const employee = await Employee.findByPk(employeeId);
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : 'Staff Member';

    const res = await smartOfficeClient.triggerOnlineEnrollment(
      mapping.device_serial_number,
      mapping.employee_code,
      employeeName,
      1
    );

    await mapping.update({ enrollment_status: 'enrolled', last_synced_at: new Date() });

    if (actorUserId) {
      await AttendanceAuditLog.create({
        actor_user_id: actorUserId,
        action: 'ONLINE_ENROLLMENT_TRIGGERED',
        entity_type: 'EmployeeBiometricMapping',
        entity_id: mapping.id,
        reason: `Triggered online enrollment for ${employeeName} (${mapping.employee_code}) on device ${mapping.device_serial_number}`,
      });
    }

    return res;
  }

  /**
   * Resolve an Employee by biometric code, smart mapping, or numeric ID
   */
  async resolveEmployee(code) {
    if (!code) return null;
    const trimmed = String(code).trim();

    // 1. Check EmployeeBiometricMapping
    const mapping = await EmployeeBiometricMapping.findOne({
      where: {
        [Op.or]: [
          { employee_code: trimmed },
          { smartoffice_employee_code: trimmed },
          { biometric_user_id: trimmed },
        ],
      },
      include: [{ model: Employee, as: 'employee' }],
    });
    if (mapping && mapping.employee) return mapping.employee;

    // 2. Direct match on Employee table
    let employee = await Employee.findOne({
      where: {
        [Op.or]: [
          { employee_code: trimmed },
          { id: trimmed },
        ],
      },
    });
    if (employee) return employee;

    // 3. Smart numeric matching (e.g. BioMax code "1" -> "KR-EMP-001")
    const numMatch = trimmed.match(/\d+/);
    if (numMatch) {
      const num = parseInt(numMatch[0], 10);
      const padded3 = String(num).padStart(3, '0');
      employee = await Employee.findOne({
        where: {
          [Op.or]: [
            { employee_code: `KR-EMP-${padded3}` },
            { employee_code: `KR-EMP-${num}` },
            { employee_code: `EMP-${padded3}` },
            { employee_code: `EMP-${num}` },
            { employee_code: `KR-REV-${padded3}` },
            { employee_code: `KR-TEL-${padded3}` },
          ],
        },
      });
      if (employee) return employee;
    }

    return null;
  }

  /**
   * Ingest an array of raw punch logs from any source (Wired API, Wireless Push, or Offline USB)
   * Deterministic SHA-256 deduplication and automatic daily attendance calculation.
   */
  async ingestRawLogs(rawLogs = [], source = 'BIOMETRIC', actorUserId = null) {
    let insertedCount = 0;
    let duplicateCount = 0;
    let unmappedCount = 0;
    const affectedDays = new Map();

    for (const log of rawLogs) {
      const code = String(log.EmployeeCode || log.employee_code || log.userId || log.pin || '').trim();
      const logDateStr = log.LogDate || log.log_date || log.punch_time || log.timestamp || log.time;
      const serial = String(log.SerialNumber || log.serial_number || log.deviceId || '').trim();
      let direction = String(log.PunchDirection || log.punch_direction || log.direction || '').toUpperCase().trim();
      const temp = parseFloat(log.Temperature || log.temperature) || null;
      const tempState = log.TemperatureState || log.temperature_state || 'Normal';

      if (!code || !logDateStr) continue;

      const punchDateObj = new Date(logDateStr);
      if (isNaN(punchDateObj.getTime())) continue;

      const punchDateStr = punchDateObj.toISOString().split('T')[0];

      // Normalize punch direction if numeric (0 = IN, 1 = OUT or vice versa in BioMax)
      if (direction === '0' || direction === 'IN' || direction === 'CHECKIN') direction = 'IN';
      else if (direction === '1' || direction === 'OUT' || direction === 'CHECKOUT') direction = 'OUT';
      else if (direction !== 'IN' && direction !== 'OUT') direction = 'UNKNOWN';

      // SHA-256 hash for deterministic deduplication
      const eventHash = this.generatePunchHash({
        employeeCode: code,
        punchTimestamp: punchDateObj,
        deviceSerialNumber: serial,
        punchDirection: direction,
      });

      // Deduplication check
      const existingEvent = await BiometricPunchEvent.findOne({ where: { external_event_hash: eventHash } });
      if (existingEvent) {
        duplicateCount++;
        continue;
      }

      // Resolve Employee
      const employee = await this.resolveEmployee(code);
      const processingStatus = employee ? 'PENDING' : 'UNMAPPED';
      if (!employee) unmappedCount++;

      let device = null;
      if (serial) {
        device = await BiometricDevice.findOne({ where: { serial_number: serial } });
      }

      await BiometricPunchEvent.create({
        employee_code: code,
        employee_id: employee ? employee.id : null,
        device_id: device ? device.id : null,
        device_serial_number: serial || 'BIOMAX_TERMINAL',
        punch_timestamp: punchDateObj,
        punch_date: punchDateStr,
        punch_direction: direction,
        temperature: temp,
        temperature_state: tempState,
        source: source,
        external_event_hash: eventHash,
        raw_payload: log,
        processing_status: processingStatus,
      });

      insertedCount++;

      if (employee) {
        if (!affectedDays.has(employee.id)) {
          affectedDays.set(employee.id, new Set());
        }
        affectedDays.get(employee.id).add(punchDateStr);
      }
    }

    // Recalculate daily attendance for all affected days
    for (const [empId, datesSet] of affectedDays.entries()) {
      for (const dStr of datesSet) {
        try {
          await attendanceEngine.calculateAttendanceForDay(empId, dStr);
        } catch (calcErr) {
          logger.error(`Error calculating attendance for employee ${empId} on ${dStr}: ${calcErr.message}`);
        }
      }
    }

    if (rawLogs.length > 0) {
      try {
        await AttendanceAuditLog.create({
          actor_user_id: actorUserId || null,
          action: `PUNCH_INGESTION_${source}`,
          entity_type: 'BiometricPunchEvent',
          entity_id: `batch-${Date.now()}`,
          after_state: {
            source,
            total_logs: rawLogs.length,
            inserted: insertedCount,
            duplicates: duplicateCount,
            unmapped: unmappedCount,
            affected_employees: affectedDays.size,
          },
          reason: `Processed ${rawLogs.length} punch log(s) via ${source}. Inserted: ${insertedCount}, Duplicates: ${duplicateCount}`,
        });
      } catch (auditErr) {
        logger.debug(`Audit log creation notice: ${auditErr.message}`);
      }
    }

    return {
      total: rawLogs.length,
      inserted: insertedCount,
      duplicates: duplicateCount,
      unmapped: unmappedCount,
      affected_employees: affectedDays.size,
    };
  }

  /**
   * Parse USB flash drive offline attendance log exports (.dat, .txt, .csv, .json)
   * Format 1 (BioMax attlog.dat): <Pin>\t<YYYY-MM-DD HH:mm:ss>\t<Status>\t<VerifyType>\t<WorkCode>
   * Format 2 (CSV): EmployeeCode,Date,Time,Direction
   */
  parseUSBLogFile(fileContent) {
    if (!fileContent) return [];
    const text = typeof fileContent === 'string' ? fileContent : fileContent.toString('utf8');
    const trimmedText = text.trim();

    // Check if JSON format
    if (trimmedText.startsWith('[') && trimmedText.endsWith(']')) {
      try {
        const json = JSON.parse(trimmedText);
        if (Array.isArray(json)) return json;
      } catch {}
    }

    const lines = trimmedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedLogs = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(employee|emp_code|code|user|pin|id)/i.test(line)) continue;

      let parts = line.split('\t');
      if (parts.length < 2) parts = line.split(',');
      if (parts.length < 2) parts = line.split(/\s{2,}|\s+/);

      if (parts.length >= 2) {
        const empCode = parts[0].trim();
        let logDate = null;
        let punchDirection = 'UNKNOWN';

        if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) && /^\d{2}:\d{2}/.test(parts[2])) {
          logDate = `${parts[1]} ${parts[2]}`;
          if (parts[3]) {
            const dirVal = parts[3].trim().toUpperCase();
            if (dirVal === 'IN' || dirVal === '0' || dirVal === 'CHECKIN') punchDirection = 'IN';
            else if (dirVal === 'OUT' || dirVal === '1' || dirVal === 'CHECKOUT') punchDirection = 'OUT';
          }
        } else if (/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}/.test(parts[1])) {
          logDate = parts[1].replace('T', ' ');
          if (parts[2]) {
            const state = parts[2].trim();
            if (state === '0' || state === 'IN') punchDirection = 'IN';
            else if (state === '1' || state === 'OUT') punchDirection = 'OUT';
          }
        }

        if (empCode && logDate) {
          parsedLogs.push({
            EmployeeCode: empCode,
            LogDate: logDate,
            SerialNumber: 'BIOMAX_OFFLINE_USB',
            PunchDirection: punchDirection,
            Temperature: 98.4,
            TemperatureState: 'Normal',
          });
        }
      }
    }

    return parsedLogs;
  }

  /**
   * Auto-map active CRM employees to BioMax biometric codes
   */
  async autoMapDefaultEmployees() {
    try {
      const employees = await Employee.findAll({ where: { status: 'active' } });
      let mapped = 0;
      for (const emp of employees) {
        const existing = await EmployeeBiometricMapping.findOne({
          where: { employee_id: emp.id },
        });
        if (!existing) {
          const numMatch = emp.employee_code?.match(/\d+/);
          const rawNum = numMatch ? String(parseInt(numMatch[0], 10)) : null;

          let targetCode = emp.employee_code;
          if (rawNum) {
            // Check if numeric code is already used by another mapping
            const inUse = await EmployeeBiometricMapping.findOne({ where: { employee_code: rawNum } });
            if (!inUse) {
              targetCode = rawNum;
            }
          }

          // Double check targetCode availability
          const codeTaken = await EmployeeBiometricMapping.findOne({ where: { employee_code: targetCode } });
          if (codeTaken) {
            targetCode = `${emp.employee_code}_${emp.id.slice(0, 4)}`;
          }

          await EmployeeBiometricMapping.create({
            employee_id: emp.id,
            employee_code: targetCode,
            smartoffice_employee_code: emp.employee_code,
            biometric_user_id: targetCode,
            enrollment_status: 'enrolled',
            enrolled_at: new Date(),
          });
          mapped++;
        }
      }
      return mapped;
    } catch (err) {
      logger.warn(`Biometric auto-map notice: ${err.message}`);
      return 0;
    }
  }

  /**
   * Ingest and synchronize raw logs from SmartOffice API ("With Wire" / Online mode)
   * Automatically handles reconnection catch-up when wire is plugged back in.
   */
  async syncBiometricLogs(options = {}) {
    const { fromDateOverride = null, toDateOverride = null } = options;

    // 1. Retrieve or initialize sync state
    let syncState = await IntegrationSyncState.findOne({ where: { integration_name: 'smartoffice_biometric' } });
    if (!syncState) {
      syncState = await IntegrationSyncState.create({
        integration_name: 'smartoffice_biometric',
        last_successful_timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'healthy',
        sync_count: 0,
      });
    }

    const now = new Date();
    // Reconnection Catch-Up: Query from last successful sync checkpoint (up to 30 days back if wire was disconnected)
    const lastTimestamp = syncState.last_successful_timestamp || new Date(Date.now() - 24 * 60 * 60 * 1000);
    // 5-minute safety overlap to guarantee no missed punches at boundaries
    const fromDate = fromDateOverride ? new Date(fromDateOverride) : new Date(lastTimestamp.getTime() - 5 * 60 * 1000);
    const toDate = toDateOverride ? new Date(toDateOverride) : now;

    await syncState.update({ status: 'syncing', last_attempt_at: now });

    let rawLogs = [];
    try {
      rawLogs = await smartOfficeClient.getDeviceLogs(fromDate, toDate);
    } catch (apiErr) {
      await syncState.update({
        status: 'offline_standby',
        last_error: apiErr.message,
      });
      return {
        status: 'offline_standby',
        fetched: 0,
        inserted: 0,
        duplicates: 0,
        unmapped: 0,
        message: 'BioMax device is currently offline or without wire. Stored punches will auto-sync on reconnect.',
      };
    }

    // Ingest all fetched logs through unified ingestion pipeline
    const ingestResult = await this.ingestRawLogs(rawLogs, 'BIOMETRIC');

    // Update sync state checkpoint
    await syncState.update({
      status: 'healthy',
      last_successful_timestamp: toDate,
      last_success_at: now,
      last_error: null,
      sync_count: syncState.sync_count + 1,
    });

    await BiometricDevice.update(
      { last_sync_at: now, last_successful_log_fetch_at: now, status: 'online' },
      { where: { is_active: true } }
    );

    logger.info(`[Biometric Sync] Completed. Fetched: ${rawLogs.length}, Inserted: ${ingestResult.inserted}, Duplicates: ${ingestResult.duplicates}, Unmapped: ${ingestResult.unmapped}`);

    return {
      status: 'healthy',
      fetched: rawLogs.length,
      inserted: ingestResult.inserted,
      duplicates: ingestResult.duplicates,
      unmapped: ingestResult.unmapped,
      affected_employees: ingestResult.affected_employees,
      last_sync_timestamp: toDate,
    };
  }

  /**
   * Manual Clock-In via CRM Web UI
   */
  async manualClockIn(userId, actorUserId = null) {
    const employee = await Employee.findOne({ where: { user_id: userId } });
    const emp = employee || (await Employee.findByPk(userId));
    if (!emp) throw new Error('Employee record not found.');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const code = emp.employee_code || `EMP-${emp.id.slice(0, 5)}`;

    const eventHash = this.generatePunchHash({
      employeeCode: code,
      punchTimestamp: now,
      deviceSerialNumber: 'MANUAL_WEB_UI',
      punchDirection: 'IN',
    });

    const punch = await BiometricPunchEvent.create({
      employee_code: code,
      employee_id: emp.id,
      device_serial_number: 'MANUAL_WEB_UI',
      punch_timestamp: now,
      punch_date: todayStr,
      punch_direction: 'IN',
      source: 'MANUAL',
      external_event_hash: eventHash,
      raw_payload: { manual_user_id: actorUserId || userId, note: 'Web Clock-In' },
      processing_status: 'PENDING',
    });

    const dayRecord = await attendanceEngine.calculateAttendanceForDay(emp.id, todayStr);

    if (actorUserId) {
      await AttendanceAuditLog.create({
        actor_user_id: actorUserId,
        action: 'MANUAL_CLOCK_IN',
        entity_type: 'AttendanceDay',
        entity_id: dayRecord ? dayRecord.id : emp.id,
        reason: 'Employee manual clock-in from CRM web interface',
      });
    }

    return dayRecord;
  }

  /**
   * Manual Clock-Out via CRM Web UI
   */
  async manualClockOut(userId, actorUserId = null) {
    const employee = await Employee.findOne({ where: { user_id: userId } });
    const emp = employee || (await Employee.findByPk(userId));
    if (!emp) throw new Error('Employee record not found.');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const code = emp.employee_code || `EMP-${emp.id.slice(0, 5)}`;

    const eventHash = this.generatePunchHash({
      employeeCode: code,
      punchTimestamp: now,
      deviceSerialNumber: 'MANUAL_WEB_UI',
      punchDirection: 'OUT',
    });

    const punch = await BiometricPunchEvent.create({
      employee_code: code,
      employee_id: emp.id,
      device_serial_number: 'MANUAL_WEB_UI',
      punch_timestamp: now,
      punch_date: todayStr,
      punch_direction: 'OUT',
      source: 'MANUAL',
      external_event_hash: eventHash,
      raw_payload: { manual_user_id: actorUserId || userId, note: 'Web Clock-Out' },
      processing_status: 'PENDING',
    });

    const dayRecord = await attendanceEngine.calculateAttendanceForDay(emp.id, todayStr);

    if (actorUserId) {
      await AttendanceAuditLog.create({
        actor_user_id: actorUserId,
        action: 'MANUAL_CLOCK_OUT',
        entity_type: 'AttendanceDay',
        entity_id: dayRecord ? dayRecord.id : emp.id,
        reason: 'Employee manual clock-out from CRM web interface',
      });
    }

    return dayRecord;
  }

  /**
   * Submit Attendance Correction Request
   */
  async submitCorrection(correctionData, requesterUserId) {
    const { employee_id, correction_date, corrected_in, corrected_out, reason } = correctionData;

    if (!employee_id || !correction_date || !reason) {
      throw new Error('Employee, correction date, and reason are required.');
    }

    const attDay = await AttendanceDay.findOne({
      where: { employee_id, date: correction_date },
    });

    const correction = await AttendanceCorrection.create({
      attendance_day_id: attDay ? attDay.id : null,
      employee_id,
      correction_date,
      original_in: attDay ? attDay.first_in : null,
      original_out: attDay ? attDay.last_out : null,
      original_status: attDay ? attDay.status : 'ABSENT',
      corrected_in,
      corrected_out,
      reason,
      requested_by: requesterUserId,
      status: 'pending',
    });

    await AttendanceAuditLog.create({
      actor_user_id: requesterUserId,
      action: 'CORRECTION_REQUESTED',
      entity_type: 'AttendanceCorrection',
      entity_id: correction.id,
      after_state: correction.toJSON(),
      reason: `Attendance correction requested for ${correction_date}: ${reason}`,
    });

    return correction;
  }

  /**
   * Approve or Reject Attendance Correction Request
   */
  async reviewCorrection(correctionId, action, approverUserId, rejectionReason = '') {
    const correction = await AttendanceCorrection.findByPk(correctionId);
    if (!correction) throw new Error('Correction request not found.');

    if (action === 'approved') {
      await correction.update({
        status: 'approved',
        approved_by: approverUserId,
        approved_at: new Date(),
      });

      // Recalculate attendance with approved override
      await attendanceEngine.calculateAttendanceForDay(correction.employee_id, correction.correction_date);

      await AttendanceAuditLog.create({
        actor_user_id: approverUserId,
        action: 'CORRECTION_APPROVED',
        entity_type: 'AttendanceCorrection',
        entity_id: correction.id,
        after_state: correction.toJSON(),
        reason: `Approved attendance correction for ${correction.correction_date}`,
      });
    } else {
      await correction.update({
        status: 'rejected',
        rejection_reason: rejectionReason || 'Rejected by HR',
        approved_by: approverUserId,
        approved_at: new Date(),
      });

      await AttendanceAuditLog.create({
        actor_user_id: approverUserId,
        action: 'CORRECTION_REJECTED',
        entity_type: 'AttendanceCorrection',
        entity_id: correction.id,
        reason: `Rejected attendance correction: ${rejectionReason}`,
      });
    }

    return correction;
  }
}

module.exports = new BiometricService();
