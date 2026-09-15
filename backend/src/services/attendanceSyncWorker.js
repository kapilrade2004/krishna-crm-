'use strict';

const cron = require('node-cron');
const biometricService = require('./biometricService');
const logger = require('../config/logger');

class AttendanceSyncWorker {
  constructor() {
    this.task = null;
    this.isRunning = false;
    this.cronSchedule = process.env.SMARTOFFICE_SYNC_CRON || '*/2 * * * *'; // Default: every 2 minutes
    this.consecutiveFailures = 0;
    this.skipCounter = 0;
  }

  start() {
    if (this.task) {
      logger.info('Biometric attendance sync worker is already running.');
      return;
    }

    const isAutoSyncEnabled = process.env.SMARTOFFICE_AUTO_SYNC === 'true';
    if (!isAutoSyncEnabled) {
      logger.info('Biometric attendance background auto-sync is DISABLED (Manual refresh mode active).');
      return;
    }

    logger.info(`Starting Biometric attendance sync worker with schedule: ${this.cronSchedule}`);
    this.task = cron.schedule(this.cronSchedule, async () => {
      if (this.isRunning) {
        logger.debug('Previous biometric sync job still in progress, skipping this iteration.');
        return;
      }

      // Resilience & Backoff:
      // If 3 to 5 failures: execute every 2nd iteration (~4 min)
      // If > 5 failures: enter offline standby, execute every 5th iteration (~10 min)
      if (this.consecutiveFailures >= 6) {
        this.skipCounter = (this.skipCounter + 1) % 5;
        if (this.skipCounter !== 0) {
          logger.debug(`[Biometric Worker] In offline standby mode (${this.consecutiveFailures} consecutive notices). Backoff iteration ${this.skipCounter}/5.`);
          return;
        }
      } else if (this.consecutiveFailures >= 3) {
        this.skipCounter = (this.skipCounter + 1) % 2;
        if (this.skipCounter !== 0) {
          logger.debug(`[Biometric Worker] In degraded backoff mode (${this.consecutiveFailures} failures). Skipping one run.`);
          return;
        }
      }

      this.isRunning = true;
      try {
        const result = await biometricService.syncBiometricLogs();
        if (result && result.status === 'offline_standby') {
          this.consecutiveFailures++;
        } else {
          if (this.consecutiveFailures > 0) {
            logger.info(`[Biometric Worker] Reconnected successfully after ${this.consecutiveFailures} failed/standby attempts.`);
          }
          this.consecutiveFailures = 0;
          this.skipCounter = 0;
        }
      } catch (err) {
        this.consecutiveFailures++;
        logger.warn(`Biometric attendance background sync notice (attempt #${this.consecutiveFailures}): ${err.message}`);
      } finally {
        this.isRunning = false;
      }
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Biometric attendance sync worker stopped.');
    }
  }
}

module.exports = new AttendanceSyncWorker();
