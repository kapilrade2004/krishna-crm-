'use strict';

const logger = require('../../config/logger');

/**
 * Format date for SmartOffice WebAPI query parameters:
 * Accepts Date object, YYYY-MM-DD string, or timestamp.
 * SmartOffice supports 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm:ss'.
 */
function formatSmartOfficeQueryDate(d) {
  if (!d) return '';
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed;
    }
  }
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
 * SmartOfficeClient
 * Dedicated HTTP API client for SmartOffice WebAPI:
 * GET /api/v2/WebAPI/GetDeviceLogs?APIKey=...&FromDate=...&ToDate=...
 */
class SmartOfficeClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.SMARTOFFICE_BASE_URL || 'http://192.168.1.38:82';
    this.apiKey = config.apiKey || process.env.SMARTOFFICE_API_KEY || '274416082629';
    this.timeout = parseInt(config.timeout || process.env.SMARTOFFICE_TIMEOUT_MS || process.env.SMARTOFFICE_TIMEOUT || 10000, 10);
    this.maxRetries = parseInt(process.env.SMARTOFFICE_MAX_RETRIES || 2, 10);
    this.simulationMode = process.env.SMARTOFFICE_SIMULATION_MODE === 'true';
  }

  /**
   * Fetch device logs from SmartOffice
   * @param {Object|string} arg1 fromDate or options object { fromDate, toDate, apiKey, timeout }
   * @param {string} [arg2] toDate if arg1 is string
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

    const formattedFrom = formatSmartOfficeQueryDate(fromDate);
    const formattedTo = formatSmartOfficeQueryDate(toDate);
    const apiKey = options.apiKey || this.apiKey;
    const baseUrl = options.baseUrl || this.baseUrl;
    const timeoutMs = options.timeout || this.timeout;

    if (!apiKey) {
      throw new Error('SmartOffice API Key is required but not configured.');
    }

    if (this.simulationMode || options.simulate) {
      return this._simulateDeviceLogs(formattedFrom, formattedTo);
    }

    return this._requestWithRetry(async () => {
      const url = new URL('/api/v2/WebAPI/GetDeviceLogs', baseUrl);
      url.searchParams.append('APIKey', apiKey);
      if (formattedFrom) url.searchParams.append('FromDate', formattedFrom);
      if (formattedTo) url.searchParams.append('ToDate', formattedTo);

      logger.info(`[SmartOffice API] Fetching logs from: ${url.origin}${url.pathname}?APIKey=***&FromDate=${formattedFrom}&ToDate=${formattedTo}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        const text = await response.text();
        clearTimeout(timer);

        let data;
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          // If response text is an error string e.g. "Invalid API Key."
          if (text.includes('Invalid API Key') || text.includes('Invalid') || text.includes('Error')) {
            throw new Error(`SmartOffice API Error: ${text.trim()}`);
          }
          throw new Error(`Malformed JSON received from SmartOffice API: ${text.slice(0, 150)}`);
        }

        // SmartOffice error conditions check
        if (typeof data === 'string') {
          if (data.includes('Invalid API Key')) {
            throw new Error('SmartOffice Error: Invalid API Key.');
          }
          if (data.includes('Invalid')) {
            throw new Error(`SmartOffice Error: ${data}`);
          }
        }

        if (data && data.status === 'error') {
          throw new Error(data.message || 'SmartOffice reported API error');
        }

        if (Array.isArray(data)) {
          return data;
        }

        if (data && Array.isArray(data.data)) {
          return data.data;
        }

        if (data && Array.isArray(data.logs)) {
          return data.logs;
        }

        // Empty response or unexpected structure
        return [];
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    }, 'GetDeviceLogs', options);
  }

  /**
   * Internal retry wrapper with exponential backoff
   */
  async _requestWithRetry(fn, operationName, options = {}) {
    let attempt = 0;
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : this.maxRetries;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        const isLast = attempt > maxRetries;
        const msg = err.message || String(err);

        // Immediate fail on explicit authentication / authorization errors
        if (msg.includes('Invalid API Key') || msg.includes('Unauthorized')) {
          logger.error(`[SmartOffice API] Critical Authentication Failure: ${msg}`);
          throw err;
        }

        if (isLast) {
          logger.error(`[SmartOffice API] ${operationName} failed after ${attempt} attempts: ${msg}`);
          throw err;
        }

        logger.warn(`[SmartOffice API] ${operationName} attempt ${attempt} failed (${msg}). Retrying in ${attempt * 300}ms...`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }

  /**
   * Simulated test data generator matching real SmartOffice response schema
   */
  _simulateDeviceLogs(fromDate, toDate) {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        EmployeeCode: '10',
        LogDate: `${today} 08:58:30`,
        SerialNumber: 'AMDB24070600331',
        PunchDirection: ' ',
        Temperature: 0,
        TemperatureState: 'Not Measured',
      },
      {
        EmployeeCode: '11',
        LogDate: `${today} 09:36:22`,
        SerialNumber: 'AMDB24070600331',
        PunchDirection: ' ',
        Temperature: 0,
        TemperatureState: 'Not Measured',
      },
      {
        EmployeeCode: '10',
        LogDate: `${today} 17:45:10`,
        SerialNumber: 'AMDB24070600331',
        PunchDirection: ' ',
        Temperature: 0,
        TemperatureState: 'Not Measured',
      },
    ];
  }
}

module.exports = new SmartOfficeClient();
module.exports.SmartOfficeClient = SmartOfficeClient;
