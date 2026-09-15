'use strict';

const whatsappRateLimiter = require('../services/whatsappRateLimiter');
const whatsappSpendGuard = require('../services/whatsappSpendGuard');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const { isWhatsAppSendingEnabled } = require('../services/emergencyPauseService');
const { SystemSetting, WhatsAppRateLimitEvent } = require('../models');
const logger = require('../config/logger');

/**
 * Controller for WhatsApp Rate Limiter and Balance-Spend Protection
 */
class WhatsAppRateLimitController {
  /**
   * GET /api/whatsapp/rate-limiter/status
   * Live operational status of Rate Limiter, Spend Ceiling, Queue & Balances
   */
  static async getStatus(req, res) {
    try {
      const [rateLimitStatus, spendStatus, queueStatus, sendingEnabled] = await Promise.all([
        whatsappRateLimiter.getStatus().catch((err) => {
          logger.error('Error getting rate limit status:', err);
          return {
            active_adapter: 'DATABASE_SLIDING_WINDOW',
            configured_limits: { messages_per_minute: 60, messages_per_hour: 1800, messages_per_day: 10000 },
            limits: { messages_per_minute: 60, messages_per_hour: 1800, messages_per_day: 10000 },
            current_usage: { active_claims_count: 0, approx_remaining_in_minute: 60 },
            provider_throttling: { is_throttled: false, remaining_backoff_seconds: 0 },
          };
        }),
        whatsappSpendGuard.getSpendStatus().catch((err) => {
          logger.error('Error getting spend guard status:', err);
          return {
            daily_spend_limit: 50.00,
            today_confirmed_spend: 0,
            today_reserved_spend: 0,
            today_remaining_spend: 50.00,
            spend_utilization_pct: 0,
            provider_balance: { display: 'BALANCE UNAVAILABLE', available: false },
          };
        }),
        whatsappOutboxQueue.getStatus(),
        isWhatsAppSendingEnabled().catch(() => true),
      ]);

      const spendGuardMerged = {
        ...spendStatus,
        daily_spend_limit_inr: spendStatus.daily_spend_limit ?? 50,
        today_confirmed_spend_inr: spendStatus.today_confirmed_spend ?? 0,
        active_reserved_spend_inr: spendStatus.today_reserved_spend ?? 0,
        remaining_budget_inr: spendStatus.today_remaining_spend ?? 50,
        budget_utilization_pct: spendStatus.spend_utilization_pct ?? 0,
      };

      return res.status(200).json({
        success: true,
        data: {
          whatsapp_sending_enabled: sendingEnabled,
          rate_limiter: rateLimitStatus,
          spend_guard: spendGuardMerged,
          queue_worker: queueStatus,
          // Flattened top-level aliases for direct frontend access:
          limits: rateLimitStatus.limits || rateLimitStatus.configured_limits,
          configured_limits: rateLimitStatus.configured_limits || rateLimitStatus.limits,
          active_adapter: rateLimitStatus.active_adapter || 'DATABASE_SLIDING_WINDOW',
          current_usage: rateLimitStatus.current_usage || { active_claims_count: 0, approx_remaining_in_minute: 60 },
          provider_throttling: rateLimitStatus.provider_throttling || { is_throttled: false, remaining_backoff_seconds: 0 },
          provider_balance: spendStatus.provider_balance || { display: 'BALANCE UNAVAILABLE', available: false },
        },
      });
    } catch (err) {
      logger.error('Error in WhatsAppRateLimitController.getStatus:', err);
      return res.status(200).json({
        success: true,
        data: {
          whatsapp_sending_enabled: true,
          rate_limiter: {
            active_adapter: 'DATABASE_SLIDING_WINDOW',
            configured_limits: { messages_per_minute: 60, messages_per_hour: 1800, messages_per_day: 10000 },
          },
          spend_guard: {
            daily_spend_limit: 50.00,
            daily_spend_limit_inr: 50.00,
            today_confirmed_spend: 0,
            today_confirmed_spend_inr: 0,
            today_reserved_spend: 0,
            active_reserved_spend_inr: 0,
            today_remaining_spend: 50.00,
            remaining_budget_inr: 50.00,
            spend_utilization_pct: 0,
          },
          limits: { messages_per_minute: 60, messages_per_hour: 1800, messages_per_day: 10000 },
          configured_limits: { messages_per_minute: 60, messages_per_hour: 1800, messages_per_day: 10000 },
          active_adapter: 'DATABASE_SLIDING_WINDOW',
          current_usage: { active_claims_count: 0, approx_remaining_in_minute: 60 },
          provider_throttling: { is_throttled: false, remaining_backoff_seconds: 0 },
          provider_balance: { display: 'BALANCE UNAVAILABLE', available: false },
          queue_worker: { is_processing: false },
        },
      });
    }
  }

  /**
   * PUT /api/whatsapp/rate-limiter/config
   * Configure rate limits and daily spend ceiling
   */
  static async updateConfig(req, res) {
    try {
      const {
        messages_per_minute,
        messages_per_hour,
        messages_per_day,
        daily_spend_ceiling,
        balance_policy,
        max_concurrent_sends,
      } = req.body;

      const updates = [];

      if (messages_per_minute !== undefined) {
        const val = parseInt(messages_per_minute, 10);
        if (isNaN(val) || val < 1 || val > 1000) {
          return res.status(400).json({ success: false, message: 'messages_per_minute must be between 1 and 1000.' });
        }
        updates.push({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: String(val) });
      }

      if (messages_per_hour !== undefined) {
        const val = parseInt(messages_per_hour, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ success: false, message: 'messages_per_hour must be a positive integer.' });
        }
        updates.push({ key: 'WHATSAPP_RATE_LIMIT_PER_HOUR', value: String(val) });
      }

      if (messages_per_day !== undefined) {
        const val = parseInt(messages_per_day, 10);
        if (isNaN(val) || val < 1) {
          return res.status(400).json({ success: false, message: 'messages_per_day must be a positive integer.' });
        }
        updates.push({ key: 'WHATSAPP_RATE_LIMIT_PER_DAY', value: String(val) });
      }

      if (daily_spend_ceiling !== undefined) {
        const val = parseFloat(daily_spend_ceiling);
        if (isNaN(val) || val < 0) {
          return res.status(400).json({ success: false, message: 'daily_spend_ceiling must be a non-negative number.' });
        }
        updates.push({ key: 'WHATSAPP_DAILY_SPEND_LIMIT', value: val.toFixed(2) });
      }

      if (balance_policy !== undefined) {
        if (!['ALLOW_WITH_DAILY_CEILING', 'STRICT_BLOCK_IF_UNKNOWN'].includes(balance_policy)) {
          return res.status(400).json({ success: false, message: 'balance_policy must be ALLOW_WITH_DAILY_CEILING or STRICT_BLOCK_IF_UNKNOWN.' });
        }
        updates.push({ key: 'WHATSAPP_BALANCE_POLICY', value: balance_policy });
      }

      if (max_concurrent_sends !== undefined) {
        const val = parseInt(max_concurrent_sends, 10);
        if (isNaN(val) || val < 1 || val > 20) {
          return res.status(400).json({ success: false, message: 'max_concurrent_sends must be between 1 and 20.' });
        }
        updates.push({ key: 'WHATSAPP_MAX_CONCURRENT_SENDS', value: String(val) });
      }

      for (const u of updates) {
        const [setting] = await SystemSetting.findOrCreate({
          where: { key: u.key },
          defaults: { key: u.key, value: u.value },
        });
        await setting.update({ value: u.value });
      }

      return res.status(200).json({
        success: true,
        message: 'WhatsApp rate limiter and spend guard configuration successfully updated.',
        updated_keys: updates.map(u => u.key),
      });
    } catch (err) {
      logger.error('Error updating WhatsApp rate limiter config:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update WhatsApp rate limiter config.',
        error: err.message,
      });
    }
  }

  /**
   * GET /api/whatsapp/rate-limiter/audit
   * Fetch recent rate limiter and spend events audit log
   */
  static async getAuditLog(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const offset = (page - 1) * limit;

      const { count, rows } = await WhatsAppRateLimitEvent.findAndCountAll({
        order: [['created_at', 'DESC']],
        limit,
        offset,
      });

      return res.status(200).json({
        success: true,
        data: {
          total: count,
          page,
          limit,
          total_pages: Math.ceil(count / limit),
          events: rows,
        },
      });
    } catch (err) {
      logger.error('Error fetching rate limiter audit log:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve rate limiter audit log.',
        error: err.message,
      });
    }
  }
}

module.exports = WhatsAppRateLimitController;
