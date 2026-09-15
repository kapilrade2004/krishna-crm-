'use strict';

const { User } = require('../models');
const logger = require('../config/logger');

// In-memory cache to debounce database writes for active requests: userId -> timestamp (ms)
const presenceCache = new Map();
const DEBOUNCE_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Middleware to track user CRM application presence on authenticated requests.
 * Runs non-blocking (fire-and-forget).
 */
const trackPresence = (req, res, next) => {
  if (req.user && req.user.id) {
    const userId = req.user.id;
    const now = Date.now();
    const lastTracked = presenceCache.get(userId) || 0;

    if (now - lastTracked > DEBOUNCE_INTERVAL_MS) {
      presenceCache.set(userId, now);
      User.update(
        {
          last_active_at: new Date(now),
          presence_status: 'online',
        },
        { where: { id: userId } }
      ).catch((err) => {
        logger.debug(`Presence update notice for user ${userId}: ${err.message}`);
      });
    }
  }
  next();
};

/**
 * Helper to compute real-time presence status given a last_active_at timestamp.
 * Biometric punch presence is completely independent of this.
 */
const computePresenceStatus = (lastActiveAt) => {
  if (!lastActiveAt) return 'offline';
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  if (diffMs < 2 * 60 * 1000) return 'online'; // active within 2 mins
  if (diffMs < 7 * 60 * 1000) return 'idle';   // active within 7 mins
  return 'offline';
};

module.exports = {
  trackPresence,
  computePresenceStatus,
  presenceCache,
};
