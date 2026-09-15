'use strict';

/**
 * SmartOffice Attendance Normalizer
 * Enforces Requirements 5, 8, 9 of the SmartOffice Integration Plan:
 * - Normalizes varied punch direction (" ", "", null, "IN", "OUT")
 * - Generates deterministic external_event_key (serialNumber + employeeCode + logDateTime)
 * - Retains raw payload intact
 */

/**
 * Normalize punch direction strictly according to Requirement 9:
 * If IN -> IN
 * If OUT -> OUT
 * If blank / whitespace / undefined / other -> UNKNOWN (NEVER randomly infer IN or OUT)
 */
function normalizePunchDirection(rawDirection) {
  if (!rawDirection || typeof rawDirection !== 'string') {
    return 'UNKNOWN';
  }
  const clean = rawDirection.trim().toUpperCase();
  if (clean === 'IN') return 'IN';
  if (clean === 'OUT') return 'OUT';
  return 'UNKNOWN';
}

/**
 * Normalize log datetime string to standard MySQL DATETIME format YYYY-MM-DD HH:mm:ss
 */
function normalizeLogDateTime(rawDateStr) {
  if (!rawDateStr) return null;
  const str = String(rawDateStr).trim();

  // Already format: '2026-08-01 08:58:30'
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
  }

  // Fallback to Date parser
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    return str; // return original if unparseable
  }

  const pad = (n) => String(n).padStart(2, '0');
  const y = parsed.getFullYear();
  const m = pad(parsed.getMonth() + 1);
  const d = pad(parsed.getDate());
  const hh = pad(parsed.getHours());
  const mm = pad(parsed.getMinutes());
  const ss = pad(parsed.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

/**
 * Normalize a single raw SmartOffice log object into Krishna CRM canonical format
 * @param {Object} rawLog
 * @returns {Object} normalizedLog
 */
function normalizeSmartOfficeLog(rawLog) {
  if (!rawLog || typeof rawLog !== 'object') {
    return null;
  }

  const employeeCode = String(rawLog.EmployeeCode || rawLog.employee_code || rawLog.employeeCode || '').trim();
  const rawDateTime = rawLog.LogDate || rawLog.log_date || rawLog.logDate || rawLog.log_datetime;
  const logDateTime = normalizeLogDateTime(rawDateTime);
  const serialNumber = String(rawLog.SerialNumber || rawLog.serial_number || rawLog.serialNumber || 'UNKNOWN').trim();
  const punchDirection = normalizePunchDirection(rawLog.PunchDirection || rawLog.punch_direction || rawLog.punchDirection);
  
  const rawTemp = rawLog.Temperature !== undefined ? rawLog.Temperature : (rawLog.temperature !== undefined ? rawLog.temperature : 0);
  const temperature = isNaN(parseFloat(rawTemp)) ? 0.0 : parseFloat(rawTemp);
  const temperatureState = String(rawLog.TemperatureState || rawLog.temperature_state || rawLog.temperatureState || 'Not Measured').trim();

  // Deterministic deduplication key: serialNumber + employeeCode + logDateTime
  const externalEventKey = `${serialNumber}_${employeeCode}_${logDateTime}`;

  return {
    employeeCode,
    logDateTime,
    serialNumber,
    punchDirection,
    temperature,
    temperatureState,
    externalEventKey,
    source: 'smartoffice',
    raw: rawLog,
  };
}

/**
 * Batch normalize an array of raw SmartOffice logs
 */
function normalizeSmartOfficeLogs(rawLogs) {
  if (!Array.isArray(rawLogs)) {
    return [];
  }
  return rawLogs
    .map(normalizeSmartOfficeLog)
    .filter((item) => item !== null && item.employeeCode && item.logDateTime);
}

module.exports = {
  normalizePunchDirection,
  normalizeLogDateTime,
  normalizeSmartOfficeLog,
  normalizeSmartOfficeLogs,
};
