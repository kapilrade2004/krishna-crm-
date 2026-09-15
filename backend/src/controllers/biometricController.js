'use strict';

const { Op } = require('sequelize');
const {
  BiometricDevice,
  EmployeeBiometricMapping,
  BiometricPunchEvent,
  AttendanceShift,
  IntegrationSyncState,
  AttendanceAuditLog,
  Employee,
  User,
} = require('../models');
const biometricService = require('../services/biometricService');
const smartOfficeClient = require('../services/smartOfficeClient');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated } = require('../utils/response');
const logger = require('../config/logger');

/**
 * GET /api/biometric/devices - Get all registered biometric devices
 */
exports.getDevices = async (req, res, next) => {
  try {
    const devices = await BiometricDevice.findAll({
      order: [['created_at', 'DESC']],
    });
    sendSuccess(res, { devices, total: devices.length });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/biometric/devices - Register a new device
 */
exports.registerDevice = async (req, res, next) => {
  try {
    const { device_name, serial_number, location, ip_address, port } = req.body;
    if (!device_name || !serial_number) {
      return next(new AppError('Device name and serial number are required.', 400));
    }

    const device = await biometricService.registerDevice(
      { device_name, serial_number, location, ip_address, port },
      req.user?.id
    );

    sendCreated(res, { device }, 'Biometric device registered successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/biometric/devices/:id - Remove a device
 */
exports.deleteDevice = async (req, res, next) => {
  try {
    const result = await biometricService.removeDevice(req.params.id, req.user?.id);
    sendSuccess(res, result, 'Device deleted successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/biometric/devices/:id/test - Test connection to hardware device
 */
exports.testDeviceConnection = async (req, res, next) => {
  try {
    const device = await BiometricDevice.findByPk(req.params.id);
    if (!device) return next(new AppError('Device not found.', 404));

    const liveUsers = await smartOfficeClient.fetchLiveUsers(device.serial_number);
    await device.update({
      status: 'online',
      last_sync_at: new Date(),
      error_count: 0,
      last_error_message: null,
    });

    sendSuccess(res, {
      status: 'online',
      serial_number: device.serial_number,
      live_users_count: liveUsers.length,
      live_users: liveUsers,
    }, 'Device connection verified successfully.');
  } catch (err) {
    const device = await BiometricDevice.findByPk(req.params.id);
    if (device) {
      await device.update({
        status: 'sync_error',
        error_count: device.error_count + 1,
        last_error_message: err.message,
      });
    }
    next(new AppError(`Device connection test failed: ${err.message}`, 502));
  }
};

/**
 * POST /api/biometric/sync - Trigger manual "Sync Now"
 */
exports.triggerSync = async (req, res, next) => {
  try {
    const result = await biometricService.syncBiometricLogs({
      actorUserId: req.user?.id,
      fromDateOverride: req.body?.from_date || req.body?.fromDate || req.query?.from_date,
      toDateOverride: req.body?.to_date || req.body?.toDate || req.query?.to_date,
    });
    sendSuccess(res, { sync_result: result }, 'Biometric sync completed successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/biometric/sync-state - Get current sync status
 */
exports.getSyncState = async (req, res, next) => {
  try {
    const syncState = await IntegrationSyncState.findOne({
      where: { integration_name: 'smartoffice_biometric' },
    });
    const devicesOnline = await BiometricDevice.count({ where: { status: 'online', is_active: true } });
    const totalDevices = await BiometricDevice.count({ where: { is_active: true } });

    sendSuccess(res, {
      sync_state: syncState,
      devices_online: devicesOnline,
      total_devices: totalDevices,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST or GET /api/biometric/pull-data - Pull data from BioMax API with full diagnostic reporting
 */
exports.pullDataFromBiomax = async (req, res, next) => {
  try {
    const baseUrl = req.body?.baseUrl || req.query?.baseUrl || smartOfficeClient.baseUrl;
    const apiKey = req.body?.apiKey || req.query?.apiKey || smartOfficeClient.apiKey;
    const fromDate = req.body?.fromDate || req.query?.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = req.body?.toDate || req.query?.toDate || new Date();
    const timeout = parseInt(req.body?.timeout || req.query?.timeout || smartOfficeClient.timeout, 10);

    const startTime = Date.now();
    let rawLogs = [];
    let connectionStatus = 'success';
    let errorMessage = null;

    try {
      rawLogs = await smartOfficeClient.getDeviceLogs({
        fromDate,
        toDate,
        baseUrl,
        apiKey,
        timeout,
        throwOnError: true,
      });
    } catch (fetchErr) {
      connectionStatus = 'error';
      errorMessage = fetchErr.message;
      logger.warn(`[Biometric Pull API] Fetch failed: ${fetchErr.message}`);
    }

    const elapsedMs = Date.now() - startTime;
    let ingestResult = null;

    if (Array.isArray(rawLogs) && rawLogs.length > 0) {
      ingestResult = await biometricService.ingestRawLogs(rawLogs, 'BIOMETRIC');
    }

    sendSuccess(res, {
      configured_endpoint: baseUrl,
      api_key_used: apiKey ? `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}` : null,
      time_range: { from: fromDate, to: toDate },
      connection_status: connectionStatus,
      duration_ms: elapsedMs,
      logs_fetched: Array.isArray(rawLogs) ? rawLogs.length : 0,
      logs_sample: Array.isArray(rawLogs) ? rawLogs.slice(0, 5) : [],
      ingestion_result: ingestResult,
      error: errorMessage,
    }, connectionStatus === 'success' ? 'BioMax data pull completed.' : `BioMax connection notice: ${errorMessage}`);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/biometric/raw-punches - Get raw biometric punch logs
 */
exports.getRawPunches = async (req, res, next) => {
  try {
    const { employee_id, employee_code, date, status, limit = 100 } = req.query;
    const where = {};

    if (employee_id) where.employee_id = employee_id;
    if (employee_code) where.employee_code = employee_code;
    if (date) where.punch_date = date;
    if (status) where.processing_status = status;

    const punches = await BiometricPunchEvent.findAll({
      where,
      order: [['punch_timestamp', 'DESC']],
      limit: parseInt(limit, 10),
    });

    // Populate employee details safely without cross-collation JOIN
    const employeeIds = [...new Set(punches.map((p) => p.employee_id).filter(Boolean))];
    const employeeCodes = [...new Set(punches.map((p) => p.employee_code).filter(Boolean))];

    const employeesMap = new Map();
    if (employeeIds.length > 0 || employeeCodes.length > 0) {
      const orClauses = [];
      if (employeeIds.length) orClauses.push({ id: { [Op.in]: employeeIds } });
      if (employeeCodes.length) orClauses.push({ employee_code: { [Op.in]: employeeCodes } });

      const emps = await Employee.findAll({
        where: { [Op.or]: orClauses },
        attributes: ['id', 'first_name', 'last_name', 'employee_code', 'department'],
      });

      emps.forEach((e) => {
        employeesMap.set(String(e.id), e);
        if (e.employee_code) employeesMap.set(String(e.employee_code), e);
      });
    }

    const formattedPunches = punches.map((p) => {
      const pJson = p.toJSON ? p.toJSON() : p;
      const emp =
        (p.employee_id && employeesMap.get(String(p.employee_id))) ||
        (p.employee_code && employeesMap.get(String(p.employee_code))) ||
        null;
      return {
        ...pJson,
        employee: emp
          ? {
              id: emp.id,
              first_name: emp.first_name,
              last_name: emp.last_name,
              employee_code: emp.employee_code,
              department: emp.department,
            }
          : null,
      };
    });

    sendSuccess(res, { punches: formattedPunches, total: formattedPunches.length });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/biometric/employees/:employeeId/upload - Upload employee to device
 */
exports.uploadEmployeeToDevice = async (req, res, next) => {
  try {
    const { device_id } = req.body;
    const mapping = await biometricService.uploadEmployeeToDevice(
      req.params.employeeId,
      device_id,
      req.user?.id
    );
    sendSuccess(res, { mapping }, 'Employee uploaded to biometric device successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/biometric/employees/:employeeId/trigger-enrollment - Trigger online enrollment
 */
exports.triggerOnlineEnrollment = async (req, res, next) => {
  try {
    const result = await biometricService.triggerOnlineEnrollment(
      req.params.employeeId,
      req.user?.id
    );
    sendSuccess(res, { result }, 'Online enrollment prompt triggered on machine.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/biometric/shifts - Get shift definitions
 */
exports.getShifts = async (req, res, next) => {
  try {
    const shifts = await AttendanceShift.findAll({
      order: [['is_default', 'DESC'], ['shift_name', 'ASC']],
    });
    sendSuccess(res, { shifts });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/biometric/shifts - Create new shift definition
 */
exports.createShift = async (req, res, next) => {
  try {
    const {
      shift_name,
      shift_code,
      start_time,
      end_time,
      grace_period_minutes,
      late_after_minutes,
      early_leave_before_minutes,
      min_full_day_hours,
      min_half_day_hours,
      is_default,
    } = req.body;

    if (!shift_name || !shift_code || !start_time || !end_time) {
      return next(new AppError('Shift name, code, start time, and end time are required.', 400));
    }

    if (is_default) {
      await AttendanceShift.update({ is_default: false }, { where: {} });
    }

    const shift = await AttendanceShift.create({
      shift_name,
      shift_code,
      start_time,
      end_time,
      grace_period_minutes: grace_period_minutes || 10,
      late_after_minutes: late_after_minutes || 10,
      early_leave_before_minutes: early_leave_before_minutes || 10,
      min_full_day_hours: min_full_day_hours || 8.0,
      min_half_day_hours: min_half_day_hours || 4.0,
      is_default: Boolean(is_default),
      is_active: true,
    });

    sendCreated(res, { shift }, 'Shift schedule created successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/biometric/shifts/:id - Update shift definition
 */
exports.updateShift = async (req, res, next) => {
  try {
    const shift = await AttendanceShift.findByPk(req.params.id);
    if (!shift) return next(new AppError('Shift not found.', 404));

    if (req.body.is_default) {
      await AttendanceShift.update({ is_default: false }, { where: {} });
    }

    await shift.update(req.body);
    sendSuccess(res, { shift }, 'Shift updated successfully.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/biometric/upload-logs - Upload USB / Offline log file (.dat, .txt, .csv, .json)
 * Enables "Without Wire" sync by uploading pen drive logs directly.
 */
exports.uploadOfflineLogs = async (req, res, next) => {
  try {
    let rawContent = '';

    if (req.file) {
      rawContent = req.file.buffer.toString('utf8');
    } else if (req.body.file_content || req.body.fileContent) {
      rawContent = req.body.file_content || req.body.fileContent;
    } else if (Array.isArray(req.body.logs)) {
      const ingestResult = await biometricService.ingestRawLogs(req.body.logs, 'USB_OFFLINE', req.user?.id);
      return sendSuccess(res, ingestResult, `Successfully ingested ${ingestResult.inserted} offline biometric punches.`);
    } else {
      return next(new AppError('No log file or content provided. Please upload a BioMax .dat or .csv file.', 400));
    }

    const parsedLogs = biometricService.parseUSBLogFile(rawContent);
    if (!parsedLogs || parsedLogs.length === 0) {
      return next(new AppError('No valid attendance punches found in uploaded file. Verify file format.', 422));
    }

    const result = await biometricService.ingestRawLogs(parsedLogs, 'USB_OFFLINE', req.user?.id);

    sendSuccess(res, {
      ...result,
      total_parsed_from_file: parsedLogs.length,
    }, `Successfully processed USB logs: ${result.inserted} new punches inserted, ${result.duplicates} duplicates skipped.`);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/biometric/webhook - Direct Cloud Push / ADMS Webhook Receiver
 * BioMax hardware terminals with Wi-Fi / GPRS push punches directly over HTTP.
 */
exports.receiveDeviceWebhook = async (req, res, next) => {
  try {
    let rawPayload = req.body;
    let logsToProcess = [];

    // Check if body is an array of punch events
    if (Array.isArray(rawPayload)) {
      logsToProcess = rawPayload;
    } else if (rawPayload && typeof rawPayload === 'object') {
      if (Array.isArray(rawPayload.punches || rawPayload.logs || rawPayload.data)) {
        logsToProcess = rawPayload.punches || rawPayload.logs || rawPayload.data;
      } else if (rawPayload.EmployeeCode || rawPayload.employee_code || rawPayload.userId || rawPayload.pin) {
        logsToProcess = [rawPayload];
      }
    }

    if (logsToProcess.length === 0) {
      // ADMS handshake response or empty payload
      return res.status(200).send('OK\n');
    }

    const result = await biometricService.ingestRawLogs(logsToProcess, 'CLOUD_PUSH');

    logger.info(`[Biometric Webhook] Received ${logsToProcess.length} punches via push. Inserted: ${result.inserted}, Duplicates: ${result.duplicates}`);

    // Return format standard for BioMax / ZKTeco ADMS
    return res.status(200).json({
      status: 'SUCCESS',
      received: logsToProcess.length,
      inserted: result.inserted,
      duplicates: result.duplicates,
    });
  } catch (err) {
    logger.error('[Biometric Webhook Error]:', err.message);
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

/**
 * POST /api/biometric/auto-map-employees - Auto-map all active employees
 */
exports.autoMapEmployees = async (req, res, next) => {
  try {
    const mapped = await biometricService.autoMapDefaultEmployees();
    sendSuccess(res, { mapped_count: mapped }, `Auto-mapped ${mapped} employees to biometric codes.`);
  } catch (err) {
    next(err);
  }
};

