'use strict';

const logger = require('../../config/logger');
const smartOfficeAttendanceService = require('./smartOfficeAttendanceService');
const { AttendanceSyncRun } = require('../../models');

class SmartOfficeAttendanceWorker {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.isSyncing = false;
    this.intervalMs = parseInt(process.env.SMARTOFFICE_SYNC_INTERVAL_SECONDS || 60, 10) * 1000;
  }

  /**
   * Start the background poller worker
   */
  start() {
    if (this.isRunning) {
      logger.info('[SmartOffice Worker] Worker is already running.');
      return;
    }

    const enabled = process.env.SMARTOFFICE_SYNC_ENABLED === 'true';
    if (!enabled) {
      logger.info('[SmartOffice Worker] Sync is disabled in environment (SMARTOFFICE_SYNC_ENABLED=false). Worker standing by.');
      return;
    }

    this.isRunning = true;
    logger.info(`[SmartOffice Worker] Starting background worker with interval ${this.intervalMs / 1000}s`);

    // Run first sync immediately (async without blocking)
    setTimeout(() => {
      this.executeTick();
    }, 5000);

    // Schedule regular ticks
    this.timer = setInterval(() => {
      this.executeTick();
    }, this.intervalMs);
  }

  /**
   * Stop the background worker
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('[SmartOffice Worker] Stopped.');
  }

  /**
   * Execute single sync tick with overlap window and concurrency guard
   */
  async executeTick() {
    if (this.isSyncing) {
      logger.debug('[SmartOffice Worker] Previous sync still active. Skipping tick.');
      return;
    }

    this.isSyncing = true;

    try {
      // Determine query window: last successful sync minus 1 day (overlap) up to now
      const lastSuccess = await AttendanceSyncRun.findOne({
        where: { status: 'COMPLETED' },
        order: [['completed_at', 'DESC']],
      });

      const now = new Date();
      let fromDate;

      if (lastSuccess && lastSuccess.completed_at) {
        // Last success minus 24 hours overlap
        fromDate = new Date(new Date(lastSuccess.completed_at).getTime() - 24 * 60 * 60 * 1000);
      } else {
        // Default to last 2 days if first run
        fromDate = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      }

      await smartOfficeAttendanceService.syncLogs({
        fromDate,
        toDate: now,
        syncType: 'SCHEDULED',
      });
    } catch (err) {
      // Requirement 20: Do not erase or mark existing attendance absent if API unreachable.
      // Log failure and retry next cycle.
      logger.warn(`[SmartOffice Worker] Tick failed gracefully: ${err.message}. Retrying next cycle.`);
    } finally {
      this.isSyncing = false;
    }
  }
}

module.exports = new SmartOfficeAttendanceWorker();
module.exports.SmartOfficeAttendanceWorker = SmartOfficeAttendanceWorker;
