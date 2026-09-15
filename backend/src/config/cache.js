'use strict';



const logger = require('./logger');

const REDIS_ENABLED =
  process.env.REDIS_HOST &&
  process.env.REDIS_HOST !== '' &&
  process.env.NODE_ENV !== 'test';

let client = null;

// ─── Redis
// const Redis = require('ioredis');
// if (REDIS_ENABLED) {
//   client = new Redis({
//     host: process.env.REDIS_HOST,
//     port: parseInt(process.env.REDIS_PORT, 10) || 6379,
//     password: process.env.REDIS_PASSWORD || undefined,
//     db: parseInt(process.env.REDIS_DB, 10) || 0,
//     retryStrategy: (times) => Math.min(times * 50, 2000),
//     enableReadyCheck: true,
//     maxRetriesPerRequest: 3,
//   });
//   client.on('connect', () => logger.info('Redis connected'));
//   client.on('error', (err) => logger.error('Redis error:', err));
// }
// ─────────────────────────────────────────────────────────────────────────────

const noop = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 1,
  exists: async () => 0,
  expire: async () => 1,
  keys: async () => [],
  flushdb: async () => 'OK',
};

const cache = {
  /** @returns {Promise<string|null>} */
  async get(key) {
    if (!REDIS_ENABLED || !client) return null;
    return client.get(key);
  },

  /** @param {string} key @param {*} value @param {number} [ttlSeconds] */
  async set(key, value, ttlSeconds = null) {
    if (!REDIS_ENABLED || !client) return;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
  },

  /** @param {string|string[]} keys */
  async del(...keys) {
    if (!REDIS_ENABLED || !client) return;
    await client.del(...keys.flat());
  },

  /** @param {string} pattern e.g. 'orders:*' */
  async delPattern(pattern) {
    if (!REDIS_ENABLED || !client) return;
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(...keys);
  },

  /** Wrap a DB call with cache-aside logic */
  async wrap(key, ttlSeconds, fetchFn) {
    const cached = await this.get(key);
    if (cached) {
      try { return JSON.parse(cached); } catch { return cached; }
    }
    const result = await fetchFn();
    await this.set(key, result, ttlSeconds);
    return result;
  },

  isEnabled() { return REDIS_ENABLED && client !== null; },
};

module.exports = cache;
