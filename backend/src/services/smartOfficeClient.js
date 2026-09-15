'use strict';

const logger = require('../config/logger');

function formatSmartOfficeDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

/**
 * SmartOffice API Client (v1.0.4)
 * Integration layer for SmartOffice Suite & BioMax biometric hardware devices.
 * Supports wired Ethernet, wireless Wi-Fi, cloud sync, and offline flash-memory accumulation.
 */
class SmartOfficeClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.SMARTOFFICE_BASE_URL || 'http://127.0.0.1:89';
    this.apiKey = config.apiKey || process.env.SMARTOFFICE_API_KEY || '274416082629';
    this.timeout = parseInt(config.timeout || process.env.SMARTOFFICE_TIMEOUT || 10000, 10);
    this.simulationMode = process.env.SMARTOFFICE_SIMULATION_MODE === 'true';
    this.maxRetries = parseInt(process.env.SMARTOFFICE_MAX_RETRIES || 2, 10);
  }

  /**
   * Helper to execute requests with exponential retry and offline fallback
   */
  async _requestWithRetry(fn, operationName, options = {}) {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        if (this.simulationMode) {
          return await this._simulateResponse(operationName);
        }
        return await fn();
      } catch (err) {
        attempt++;
        const isLastAttempt = attempt > this.maxRetries;
        const errMsg = err.message;

        if (isLastAttempt) {
          logger.info(`[SmartOffice API] ${operationName} connection attempt failed (${errMsg}). Operating in manual/standby mode.`);
        } else {
          logger.debug(`[SmartOffice API] ${operationName} retry attempt ${attempt}/${this.maxRetries + 1}: ${errMsg}`);
        }

        if (isLastAttempt) {
          if (options.throwOnError) {
            throw err;
          }
          if (this.simulationMode) {
            return await this._simulateResponse(operationName);
          }
          // When hardware/network is offline or wire is unplugged, fail gracefully into offline standby
          if (
            err.code === 'ECONNREFUSED' ||
            err.code === 'ETIMEDOUT' ||
            err.code === 'ENOTFOUND' ||
            err.name === 'TypeError' ||
            err.name === 'AbortError' ||
            err.message?.includes('fetch failed')
          ) {
            logger.info(`[SmartOffice API] Hardware/SmartOffice server currently unreachable without wire (${operationName}). Operating in offline standby.`);
            if (operationName === 'GetDeviceLogs') {
              return []; // Empty logs — real punches accumulate on device memory until reconnected
            }
            return { status: 'offline', message: `Hardware offline: ${errMsg}` };
          }
          throw new Error(`SmartOffice API Error (${operationName}): ${errMsg}`);
        }

        // Exponential backoff delay (300ms, 600ms, etc.)
        const delay = Math.pow(2, attempt) * 150;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  /**
   * Core HTTP Fetch wrapper
   */
  async _fetch(path, method = 'GET', data = null, params = {}, fetchOptions = {}) {
    const baseUrl = fetchOptions.baseUrl || this.baseUrl;
    const url = new URL(path, baseUrl);
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    const timeout = fetchOptions.timeout || this.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const options = {
        method,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url.toString(), options);
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(json.message || `HTTP ${response.status} ${response.statusText}`);
      }

      return json;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 1. Register Biometric Device
   * POST /api/v2/WebAPI/AddBiometric
   * Supports addBiometricDevice({ deviceName, serialNumber }) and addBiometricDevice(deviceName, serialNumber)
   */
  async addBiometricDevice(arg1, arg2) {
    const deviceName = (arg1 && typeof arg1 === 'object') ? (arg1.deviceName || arg1.device_name) : arg1;
    const serialNumber = (arg1 && typeof arg1 === 'object') ? (arg1.serialNumber || arg1.serial_number) : arg2;

    return this._requestWithRetry(async () => {
      return await this._fetch('/api/v2/WebAPI/AddBiometric', 'POST', {
        APIKey: this.apiKey,
        DeviceName: deviceName,
        SerialNumber: serialNumber,
      });
    }, 'AddBiometricDevice');
  }

  /**
   * 2. Delete Biometric Device
   * GET /api/v2/WebAPI/DeleteBiometric
   * Supports deleteBiometricDevice({ serialNumber }) and deleteBiometricDevice(serialNumber)
   */
  async deleteBiometricDevice(arg1) {
    const serialNumber = (arg1 && typeof arg1 === 'object') ? (arg1.serialNumber || arg1.serial_number) : arg1;

    return this._requestWithRetry(async () => {
      return await this._fetch('/api/v2/WebAPI/DeleteBiometric', 'GET', null, {
        APIKey: this.apiKey,
        SerialNumber: serialNumber,
      });
    }, 'DeleteBiometricDevice');
  }

  /**
   * 3. Fetch Incremental Logs
   * GET /api/v2/WebAPI/GetDeviceLogs
   * Supports both getDeviceLogs(fromDate, toDate) and getDeviceLogs({ fromDate, toDate })
   * Query params: APIKey, FromDate, ToDate (Format: 'yyyy-MM-dd HH:mm:ss')
   */
  async getDeviceLogs(arg1, arg2) {
    let fromDate;
    let toDate;
    let options = {};
    if (arg1 && typeof arg1 === 'object' && !(arg1 instanceof Date)) {
      fromDate = arg1.fromDate || arg1.from_date;
      toDate = arg1.toDate || arg1.to_date;
      options = arg1;
    } else {
      fromDate = arg1;
      toDate = arg2;
    }

    const formattedFrom = formatSmartOfficeDate(fromDate);
    const formattedTo = formatSmartOfficeDate(toDate);
    const apiKey = options.apiKey || this.apiKey;

    return this._requestWithRetry(async () => {
      const res = await this._fetch(
        '/api/v2/WebAPI/GetDeviceLogs',
        'GET',
        null,
        {
          APIKey: apiKey,
          FromDate: formattedFrom,
          ToDate: formattedTo,
        },
        options
      );
      // SmartOffice returns array or object containing logs
      return Array.isArray(res) ? res : res.data || res.logs || [];
    }, 'GetDeviceLogs', options);
  }

  /**
   * 4. Upload User to Biometric Terminal
   * POST /api/v2/WebAPI/UploadUser
   */
  async uploadUser(arg1, arg2) {
    const opts = (arg1 && typeof arg1 === 'object') ? arg1 : { employeeName: arg1, employeeCode: arg2 };
    return this._requestWithRetry(async () => {
      return await this._fetch('/api/v2/WebAPI/UploadUser', 'POST', {
        APIKey: this.apiKey,
        EmployeeName: opts.employeeName || opts.name,
        EmployeeCode: opts.employeeCode || opts.code,
        CardNumber: opts.cardNumber || '',
        SerialNumber: opts.serialNumber || '',
        QRCode: opts.qrCode || '',
        VerifyMode: opts.verifyMode || 0,
        IsFaceUpload: opts.isFaceUpload !== undefined ? opts.isFaceUpload : true,
        IsFPUpload: opts.isFPUpload !== undefined ? opts.isFPUpload : true,
        IsCardUpload: opts.isCardUpload !== undefined ? opts.isCardUpload : true,
        IsBioPasswordUpload: opts.isBioPasswordUpload !== undefined ? opts.isBioPasswordUpload : true,
      });
    }, 'UploadUser');
  }

  /**
   * 5. Delete User from Biometric Terminal
   * POST /api/v2/WebAPI/DeleteUser
   */
  async deleteUser(arg1, arg2) {
    const employeeCode = (arg1 && typeof arg1 === 'object') ? (arg1.employeeCode || arg1.employee_code) : arg1;
    const serialNumber = (arg1 && typeof arg1 === 'object') ? (arg1.serialNumber || arg1.serial_number) : arg2;

    return this._requestWithRetry(async () => {
      return await this._fetch('/api/v2/WebAPI/DeleteUser', 'POST', {
        APIKey: this.apiKey,
        EmployeeCode: employeeCode,
        SerialNumber: serialNumber,
      });
    }, 'DeleteUser');
  }

  /**
   * 6. Fetch Live Users From Terminal
   * GET /api/v2/WebAPI/FetchLiveUsersFromBiometric
   * Supports fetchLiveUsers({ serialNumber }) and fetchLiveUsers(serialNumber)
   */
  async fetchLiveUsers(arg1) {
    const serialNumber = (arg1 && typeof arg1 === 'object') ? (arg1.serialNumber || arg1.serial_number) : arg1;

    return this._requestWithRetry(async () => {
      return await this._fetch('/api/v2/WebAPI/FetchLiveUsersFromBiometric', 'GET', null, {
        APIKey: this.apiKey,
        SerialNumber: serialNumber,
      });
    }, 'FetchLiveUsers');
  }

  /**
   * 7. Trigger User Online Enrollment (Fingerprint / Face prompt on screen)
   * GET /api/v2/WebAPI/TriggerUserOnlineEnrollment
   */
  async triggerOnlineEnrollment(arg1, arg2, arg3) {
    const opts = (arg1 && typeof arg1 === 'object') ? arg1 : { serialNumber: arg1, employeeCode: arg2, employeeName: arg3 };
    return this._requestWithRetry(async () => {
      return await this._fetch('/api/v2/WebAPI/TriggerUserOnlineEnrollment', 'GET', null, {
        APIKey: this.apiKey,
        SerialNumber: opts.serialNumber || opts.serial_number,
        EmployeeCode: opts.employeeCode || opts.employee_code,
        EmployeeName: opts.employeeName || opts.name || opts.employee_name || '',
        backup_number: opts.backupNumber || 0,
      });
    }, 'TriggerOnlineEnrollment');
  }

  /**
   * 8. Set User Expiration
   * GET /api/v2/WebAPI/SetUserExpiration
   */
  async setUserExpiration({ serialNumber, employeeCode, expirationDate }) {
    return this._requestWithRetry(async () => {
      return await this._fetch('/api/v2/WebAPI/SetUserExpiration', 'GET', null, {
        APIKey: this.apiKey,
        SerialNumber: serialNumber,
        EmployeeCode: employeeCode,
        ExpirationDate: expirationDate,
      });
    }, 'SetUserExpiration');
  }

  /**
   * 9. Block / Unblock User on Terminal
   * GET /api/WebAPI/BlockUserinBiometric
   */
  async blockUser({ employeeCode, serialNumber, blockUser = true }) {
    return this._requestWithRetry(async () => {
      return await this._fetch('/api/WebAPI/BlockUserinBiometric', 'GET', null, {
        APIKey: this.apiKey,
        EmployeeCode: employeeCode,
        SerialNumber: serialNumber,
        BlockUser: blockUser,
      });
    }, 'BlockUser');
  }

  /**
   * 10. Get Device Commands
   * GET /api/WebAPI/GetDeviceCommands
   */
  async getDeviceCommands({ fromDate, toDate, serialNumbers }) {
    return this._requestWithRetry(async () => {
      return await this._fetch('/api/WebAPI/GetDeviceCommands', 'GET', null, {
        APIKey: this.apiKey,
        FromDate: fromDate,
        ToDate: toDate,
        SerialNumbers: Array.isArray(serialNumbers) ? serialNumbers.join(',') : serialNumbers,
      });
    }, 'GetDeviceCommands');
  }

  /**
   * Sandbox response simulator for offline testing, CI, and decoupled development
   */
  async _simulateResponse(operationName) {
    switch (operationName) {
      case 'GetDeviceLogs': {
        const today = new Date().toISOString().split('T')[0];
        return [
          {
            EmployeeCode: 'KR-EMP-001',
            LogDate: `${today} 09:58:20`,
            SerialNumber: 'BIOMAX_HQ_01',
            PunchDirection: 'IN',
            Temperature: 98.4,
            TemperatureState: 'Normal',
          },
          {
            EmployeeCode: 'KR-EMP-001',
            LogDate: `${today} 18:05:40`,
            SerialNumber: 'BIOMAX_HQ_01',
            PunchDirection: 'OUT',
            Temperature: 98.6,
            TemperatureState: 'Normal',
          },
          {
            EmployeeCode: 'KR-EMP-002',
            LogDate: `${today} 10:25:00`,
            SerialNumber: 'BIOMAX_HQ_01',
            PunchDirection: 'IN',
            Temperature: 98.2,
            TemperatureState: 'Normal',
          },
        ];
      }
      case 'AddBiometricDevice':
      case 'UploadUser':
      case 'TriggerOnlineEnrollment':
      case 'SetUserExpiration':
      case 'BlockUser':
      case 'DeleteBiometricDevice':
      case 'DeleteUser':
        return { status: 'success', message: `${operationName} executed successfully (sandbox simulated)` };
      case 'FetchLiveUsers':
        return { status: 'success', liveUsers: ['KR-EMP-001', 'KR-EMP-002', 'KR-EMP-003'] };
      case 'GetDeviceCommands':
        return { status: 'success', commands: [] };
      default:
        return { status: 'success', message: 'Simulated OK' };
    }
  }
}

module.exports = new SmartOfficeClient();
