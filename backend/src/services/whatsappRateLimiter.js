'use strict';

const { Op } = require('sequelize');
const { WhatsAppLog, WhatsAppRateLimitEvent, SystemSetting } = require('../models');
const logger = require('../config/logger');

// Provider Tier Limits (Meta WhatsApp Cloud API)
// Tier 1: 1,000 conversations/24h
// Tier 2: 10,000 conversations/24h (Standard Production Baseline)
// Tier 3: 100,000 conversations/24h
// Cloud API Throughput limit: default 80 msgs/sec for throughput (scaled by Meta)
const DEFAULT_LIMITS = {
  MESSAGES_PER_MINUTE: 60,     // 1 msg/sec average default
  MESSAGES_PER_HOUR: 1800,     // 30 msgs/min sustained
  MESSAGES_PER_DAY: 10000,     // Meta Tier 2 standard baseline
  MAX_CONCURRENT_SENDS: 5,
};

class WhatsAppRateLimiter {
  constructor() {
    this.redisClient = null;
    this.isRedisAvailable = false;
    this.redisFallbackLogged = false;

    // In-process fallback tracking
    this.localRecentSends = [];
    this.providerThrottleUntil = 0;
    this.providerThrottleCount = 0;
    this.lastThrottleLogAt = 0;

    // Initialize Redis client if configured in environment
    this.initRedis();
  }

  initRedis() {
    const host = process.env.REDIS_HOST;
    if (host && host.trim() !== '' && process.env.NODE_ENV !== 'test') {
      try {
        const Redis = require('ioredis');
        this.redisClient = new Redis({
          host,
          port: parseInt(process.env.REDIS_PORT, 10) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB, 10) || 0,
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => Math.min(times * 200, 3000),
          lazyConnect: false,
        });

        this.redisClient.on('connect', () => {
          this.isRedisAvailable = true;
          this.redisFallbackLogged = false;
          logger.info('✅ [RATE LIMITER] Distributed Redis rate-limiting adapter connected.');
        });

        this.redisClient.on('error', (err) => {
          this.isRedisAvailable = false;
          if (!this.redisFallbackLogged) {
            this.redisFallbackLogged = true;
            logger.warn(`⚠️ [RATE LIMITER] Redis unavailable (${err.message}). Using database-backed distributed sliding window.`);
          }
        });
      } catch (e) {
        this.isRedisAvailable = false;
      }
    } else {
      this.isRedisAvailable = false;
    }
  }

  /**
   * Loads configured limits from SystemSetting or falls back to defaults
   */
  async getConfiguredLimits() {
    try {
      const settings = await SystemSetting.findAll({
        where: {
          key: [
            'WHATSAPP_RATE_LIMIT_PER_MINUTE',
            'WHATSAPP_RATE_LIMIT_PER_HOUR',
            'WHATSAPP_RATE_LIMIT_PER_DAY',
            'WHATSAPP_MAX_CONCURRENT_SENDS',
          ],
        },
      });

      const limits = { ...DEFAULT_LIMITS };
      for (const s of settings) {
        const val = parseInt(s.value, 10);
        if (!isNaN(val) && val > 0) {
          if (s.key === 'WHATSAPP_RATE_LIMIT_PER_MINUTE') limits.MESSAGES_PER_MINUTE = val;
          if (s.key === 'WHATSAPP_RATE_LIMIT_PER_HOUR') limits.MESSAGES_PER_HOUR = val;
          if (s.key === 'WHATSAPP_RATE_LIMIT_PER_DAY') limits.MESSAGES_PER_DAY = val;
          if (s.key === 'WHATSAPP_MAX_CONCURRENT_SENDS') limits.MAX_CONCURRENT_SENDS = val;
        }
      }
      return limits;
    } catch {
      return { ...DEFAULT_LIMITS };
    }
  }

  /**
   * Reports a provider rate-limit response (HTTP 429, Meta code 130429, 131056, 80007)
   * Dynamically activates a backoff window across all workers to prevent retry storms.
   */
  async reportProviderThrottle({
    errorCode = 429,
    errorSubcode = null,
    errorMessage = 'Provider rate limit exceeded',
    retryAfterSeconds = null,
    workerId = null,
    batchId = null,
    outboxId = null,
  } = {}) {
    this.providerThrottleCount++;
    const now = Date.now();

    let cooldownSeconds;
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      cooldownSeconds = retryAfterSeconds;
    } else {
      // Exponential backoff with jitter: 15s, 30s, 60s, 120s, up to 300s + jitter
      const base = Math.min(15 * Math.pow(2, Math.min(this.providerThrottleCount - 1, 4)), 300);
      const jitter = Math.floor(Math.random() * 5000); // 0-5s random jitter
      cooldownSeconds = Math.ceil((base * 1000 + jitter) / 1000);
    }

    this.providerThrottleUntil = now + (cooldownSeconds * 1000);

    // Sync to Redis if available so all workers share backoff window
    if (this.isRedisAvailable && this.redisClient) {
      try {
        await this.redisClient.set('wa:provider:throttle_until', String(this.providerThrottleUntil), 'PX', cooldownSeconds * 1000);
      } catch (_) {}
    }

    if (now - this.lastThrottleLogAt > 10000) {
      this.lastThrottleLogAt = now;
      logger.warn(
        `🛑 [PROVIDER THROTTLED] Meta/Gateway returned rate limit (${errorCode}/${errorSubcode || 'N/A'}: ${errorMessage}). ` +
        `Activating ${cooldownSeconds}s backoff window across all workers until ${new Date(this.providerThrottleUntil).toISOString()}.`
      );
    }

    // Persist audit event asynchronously
    WhatsAppRateLimitEvent.create({
      event_type: 'PROVIDER_429',
      batch_id: batchId,
      outbox_id: outboxId,
      worker_id: workerId,
      configured_limit: null,
      current_usage: null,
      details: {
        error_code: errorCode,
        error_subcode: errorSubcode,
        error_message: errorMessage,
        cooldown_seconds: cooldownSeconds,
        resumes_at: new Date(this.providerThrottleUntil).toISOString(),
      },
    }).catch(() => {});

    // Dispatch real-time email alert for provider rate limit
    try {
      const emailService = require('./emailService');
      emailService.sendWhatsAppErrorAlert({
        errorType: 'PROVIDER_HTTP_429_THROTTLED',
        message: `Meta Cloud API / Gateway rate limit hit: ${errorMessage} (${errorCode}/${errorSubcode})`,
        batchId,
        outboxId,
        details: {
          error_code: errorCode,
          error_subcode: errorSubcode,
          cooldown_seconds: cooldownSeconds,
          resumes_at: new Date(this.providerThrottleUntil).toISOString(),
        },
      }).catch(() => {});
    } catch (_) {}

    return {
      throttled: true,
      cooldown_seconds: cooldownSeconds,
      resumes_at: new Date(this.providerThrottleUntil).toISOString(),
    };
  }

  /**
   * Resets provider throttle status (e.g. upon successful manual test or test teardown)
   */
  resetProviderThrottle() {
    this.providerThrottleUntil = 0;
    this.providerThrottleCount = 0;
    if (this.isRedisAvailable && this.redisClient) {
      this.redisClient.del('wa:provider:throttle_until').catch(() => {});
    }
  }

  /**
   * Checks whether the system is currently under provider throttle cooldown
   */
  async isProviderThrottled() {
    const now = Date.now();

    // Check in-process state
    if (this.providerThrottleUntil && now < this.providerThrottleUntil) {
      return {
        throttled: true,
        waitMs: this.providerThrottleUntil - now,
      };
    }

    // Check shared Redis state if present
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const val = await this.redisClient.get('wa:provider:throttle_until');
        if (val) {
          const ts = parseInt(val, 10);
          if (ts > now) {
            this.providerThrottleUntil = ts;
            return { throttled: true, waitMs: ts - now };
          }
        }
      } catch (_) {}
    }

    // Cooldown expired
    if (this.providerThrottleUntil && now >= this.providerThrottleUntil) {
      this.providerThrottleUntil = 0;
    }
    return { throttled: false, waitMs: 0 };
  }

  /**
   * Acquires a send token for an outbound message across distributed workers.
   * STRICT ORDER:
   * 1. Global Kill Switch Check
   * 2. Provider Throttle Window Check
   * 3. Distributed Rate Limits Check (Minute, Hour, Day)
   *
   * @returns {Promise<{ allowed: boolean, waitMs: number, reason: string|null, currentUsage?: number, limit?: number }>}
   */
  async acquireSendToken({ workerId = null, messageType = 'template', batchId = null } = {}) {
    // ── 1. Hard Global Kill Switch Pre-Check ──────────────────────────────────
    const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
    if (!(await isWhatsAppSendingEnabled())) {
      return {
        allowed: false,
        waitMs: 60000,
        reason: 'WHATSAPP_SENDING_PAUSED',
        isEmergencyPause: true,
      };
    }

    // ── 2. Provider Throttle Window Check ────────────────────────────────────
    const throttleCheck = await this.isProviderThrottled();
    if (throttleCheck.throttled) {
      return {
        allowed: false,
        waitMs: throttleCheck.waitMs,
        reason: 'PROVIDER_THROTTLED',
        isThrottled: true,
      };
    }

    // ── 3. Load Limits ───────────────────────────────────────────────────────
    const limits = await this.getConfiguredLimits();
    const now = Date.now();

    // ── 4. Try Distributed Redis Sliding Window ──────────────────────────────
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const res = await this.acquireRedisToken(limits, now);
        if (!res.allowed) {
          this.logRateLimitEvent({
            eventType: 'THROTTLED',
            batchId,
            workerId,
            configuredLimit: res.limit,
            currentUsage: res.currentUsage,
            details: { reason: res.reason, waitMs: res.waitMs, adapter: 'redis' },
          });
        }
        return res;
      } catch (redisErr) {
        if (!this.redisFallbackLogged) {
          this.redisFallbackLogged = true;
          logger.warn(`Redis sliding window check failed: ${redisErr.message}. Falling back to database rate limiter.`);
        }
      }
    }

    // ── 5. Resilient Database-Backed Sliding Window Fallback ──────────────────
    const dbRes = await this.acquireDatabaseToken(limits, now);
    if (!dbRes.allowed) {
      this.logRateLimitEvent({
        eventType: 'THROTTLED',
        batchId,
        workerId,
        configuredLimit: dbRes.limit,
        currentUsage: dbRes.currentUsage,
        details: { reason: dbRes.reason, waitMs: dbRes.waitMs, adapter: 'database' },
      });
    }
    return dbRes;
  }

  /**
   * Redis Sliding Window Implementation
   */
  async acquireRedisToken(limits, now) {
    const minKey = 'wa:ratelimit:window:minute';
    const hourKey = 'wa:ratelimit:window:hour';
    const dayKey = 'wa:ratelimit:window:day';

    const oneMinAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const pipeline = this.redisClient.pipeline();
    // Prune expired
    pipeline.zremrangebyscore(minKey, 0, oneMinAgo);
    pipeline.zremrangebyscore(hourKey, 0, oneHourAgo);
    pipeline.zremrangebyscore(dayKey, 0, oneDayAgo);
    // Count active
    pipeline.zcard(minKey);
    pipeline.zcard(hourKey);
    pipeline.zcard(dayKey);

    const results = await pipeline.exec();
    const minCount = results[3][1] || 0;
    const hourCount = results[4][1] || 0;
    const dayCount = results[5][1] || 0;

    // Check minute limit
    if (minCount >= limits.MESSAGES_PER_MINUTE) {
      return {
        allowed: false,
        waitMs: 2000, // Wait 2s for minute window to slide
        reason: 'RATE_LIMIT_PER_MINUTE',
        currentUsage: minCount,
        limit: limits.MESSAGES_PER_MINUTE,
      };
    }

    // Check hour limit
    if (hourCount >= limits.MESSAGES_PER_HOUR) {
      return {
        allowed: false,
        waitMs: 15000,
        reason: 'RATE_LIMIT_PER_HOUR',
        currentUsage: hourCount,
        limit: limits.MESSAGES_PER_HOUR,
      };
    }

    // Check day limit
    if (dayCount >= limits.MESSAGES_PER_DAY) {
      return {
        allowed: false,
        waitMs: 60000,
        reason: 'RATE_LIMIT_PER_DAY',
        currentUsage: dayCount,
        limit: limits.MESSAGES_PER_DAY,
      };
    }

    // Consume token atomically in Redis
    const member = `${now}-${Math.random()}`;
    const addPipe = this.redisClient.pipeline();
    addPipe.zadd(minKey, now, member);
    addPipe.expire(minKey, 120);
    addPipe.zadd(hourKey, now, member);
    addPipe.expire(hourKey, 7200);
    addPipe.zadd(dayKey, now, member);
    addPipe.expire(dayKey, 172800);
    await addPipe.exec();

    return {
      allowed: true,
      waitMs: 0,
      reason: null,
      currentUsage: minCount + 1,
      limit: limits.MESSAGES_PER_MINUTE,
    };
  }

  /**
   * Database-Backed Sliding Window Implementation (Authoritative MySQL SSOT fallback)
   * Uses indexed queries on whatsapp_logs: idx_wal_status_sent (status, sent_at)
   */
  async acquireDatabaseToken(limits, now) {
    const oneMinAgo = new Date(now - 60000);
    const oneHourAgo = new Date(now - 3600000);
    const oneDayAgo = new Date(now - 86400000);

    // Track in-memory recent token reservations for sub-millisecond local pacing
    this.pruneLocalRecentSends(now);

    // Query database sent records across all workers/instances
    const [minSent, hourSent, daySent] = await Promise.all([
      WhatsAppLog.count({
        where: {
          sent_at: { [Op.gte]: oneMinAgo },
          status: { [Op.in]: ['sent', 'delivered', 'read'] },
        },
      }),
      WhatsAppLog.count({
        where: {
          sent_at: { [Op.gte]: oneHourAgo },
          status: { [Op.in]: ['sent', 'delivered', 'read'] },
        },
      }),
      WhatsAppLog.count({
        where: {
          sent_at: { [Op.gte]: oneDayAgo },
          status: { [Op.in]: ['sent', 'delivered', 'read'] },
        },
      }),
    ]);

    const totalMinUsage = minSent + this.localRecentSends.filter(ts => ts > now - 60000).length;
    const totalHourUsage = hourSent + this.localRecentSends.filter(ts => ts > now - 3600000).length;
    const totalDayUsage = daySent + this.localRecentSends.filter(ts => ts > now - 86400000).length;

    if (totalMinUsage >= limits.MESSAGES_PER_MINUTE) {
      return {
        allowed: false,
        waitMs: 1500, // Controlled delay
        reason: 'RATE_LIMIT_PER_MINUTE',
        currentUsage: totalMinUsage,
        limit: limits.MESSAGES_PER_MINUTE,
      };
    }

    if (totalHourUsage >= limits.MESSAGES_PER_HOUR) {
      return {
        allowed: false,
        waitMs: 10000,
        reason: 'RATE_LIMIT_PER_HOUR',
        currentUsage: totalHourUsage,
        limit: limits.MESSAGES_PER_HOUR,
      };
    }

    if (totalDayUsage >= limits.MESSAGES_PER_DAY) {
      return {
        allowed: false,
        waitMs: 60000,
        reason: 'RATE_LIMIT_PER_DAY',
        currentUsage: totalDayUsage,
        limit: limits.MESSAGES_PER_DAY,
      };
    }

    // Record local reservation
    this.localRecentSends.push(now);

    return {
      allowed: true,
      waitMs: 0,
      reason: null,
      currentUsage: totalMinUsage + 1,
      limit: limits.MESSAGES_PER_MINUTE,
    };
  }

  pruneLocalRecentSends(now) {
    const cutoff = now - 60000;
    this.localRecentSends = this.localRecentSends.filter(ts => ts > cutoff);
  }

  /**
   * Logs a rate limit event to audit table asynchronously without blocking sender
   */
  logRateLimitEvent({ eventType, batchId, workerId, configuredLimit, currentUsage, details }) {
    WhatsAppRateLimitEvent.create({
      event_type: eventType,
      batch_id: batchId,
      worker_id: workerId,
      configured_limit: configuredLimit,
      current_usage: currentUsage,
      details,
    }).catch(() => {});
  }

  /**
   * Retrieves operational health, throughput, and limiter status for dashboards
   */
  async getStatus() {
    const limits = await this.getConfiguredLimits();
    const now = Date.now();
    const oneMinAgo = new Date(now - 60000);

    const recentSentCount = await WhatsAppLog.count({
      where: {
        sent_at: { [Op.gte]: oneMinAgo },
        status: { [Op.in]: ['sent', 'delivered', 'read'] },
      },
    });

    const isThrottled = await this.isProviderThrottled();

    return {
      active_adapter: this.isRedisAvailable ? 'REDIS_DISTRIBUTED' : 'DATABASE_SLIDING_WINDOW',
      redis_connected: this.isRedisAvailable,
      limits: {
        messages_per_minute: limits.MESSAGES_PER_MINUTE,
        messages_per_hour: limits.MESSAGES_PER_HOUR,
        messages_per_day: limits.MESSAGES_PER_DAY,
        max_concurrent_sends: limits.MAX_CONCURRENT_SENDS,
      },
      configured_limits: {
        messages_per_minute: limits.MESSAGES_PER_MINUTE,
        messages_per_hour: limits.MESSAGES_PER_HOUR,
        messages_per_day: limits.MESSAGES_PER_DAY,
        max_concurrent_sends: limits.MAX_CONCURRENT_SENDS,
      },
      current_throughput_per_minute: recentSentCount,
      current_usage: {
        active_claims_count: recentSentCount,
        approx_remaining_in_minute: Math.max(0, limits.MESSAGES_PER_MINUTE - recentSentCount),
      },
      provider_throttling: {
        is_throttled: isThrottled.throttled,
        remaining_backoff_seconds: Math.ceil((isThrottled.waitMs || 0) / 1000),
        meta_error_code: isThrottled.throttled ? 429 : null,
      },
      provider_throttled: isThrottled.throttled,
      provider_cooldown_remaining_ms: isThrottled.waitMs,
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton instance
module.exports = new WhatsAppRateLimiter();
