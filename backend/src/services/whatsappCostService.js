'use strict';

const { SystemSetting } = require('../models');
const logger = require('../config/logger');

// Official Meta / Vasify AOC India conversation pricing:
// - Utility: ₹0.35 INR (100% of Krishna CRM operational templates are UTILITY)
// - Marketing: ₹0.80 INR (Promotional broadcasts)
// - Authentication: ₹0.15 INR (OTP / Login verification)
const UTILITY_RATE_PER_MESSAGE = 0.35; // ₹0.35 INR (Vasify AOC / Meta Utility Rate)
const MARKETING_RATE_PER_MESSAGE = 0.80; // ₹0.80 INR (Meta Marketing Rate)
const DEFAULT_RATE_PER_MESSAGE = 0.35; // ₹0.35 INR (Official CRM Utility Rate)
const DEFAULT_MESSAGES_PER_MINUTE = 30; // Conservative default based on queue TokenBucket

/**
 * Centralized WhatsApp Cost & Time Estimation Service
 */
class WhatsAppCostService {
  /**
   * Returns official pricing rates and category breakdown
   */
  static getPricingBreakdown() {
    return {
      utility_rate: UTILITY_RATE_PER_MESSAGE,
      marketing_rate: MARKETING_RATE_PER_MESSAGE,
      default_budget_ceiling_rate: DEFAULT_RATE_PER_MESSAGE,
      currency: 'INR',
      currency_symbol: '₹',
      all_crm_templates_category: 'utility',
      crm_templates_effective_rate: UTILITY_RATE_PER_MESSAGE,
    };
  }

  /**
   * Retrieves configured estimated rate per message from database or fallback default
   */
  static async getRatePerMessage(category = null) {
    if (category === 'utility') {
      return UTILITY_RATE_PER_MESSAGE;
    }
    if (category === 'marketing') {
      return MARKETING_RATE_PER_MESSAGE;
    }
    try {
      const setting = await SystemSetting.findOne({ where: { key: 'WHATSAPP_ESTIMATED_RATE_PER_MESSAGE' } });
      if (setting && setting.value) {
        const val = parseFloat(setting.value);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (err) {
      logger.debug('Using default WhatsApp rate per message:', err.message);
    }
    return DEFAULT_RATE_PER_MESSAGE;
  }

  /**
   * Calculates ESTIMATED cost for a given message count.
   * NOTE: This is strictly an estimate and does not represent actual billed provider charges.
   */
  static async calculateEstimatedCost(messageCount = 0) {
    const rate = await this.getRatePerMessage();
    const count = Math.max(0, parseInt(messageCount, 10) || 0);
    const estimatedCost = parseFloat((count * rate).toFixed(2));

    return {
      message_count: count,
      rate_per_message: rate,
      currency: 'INR',
      currency_symbol: '₹',
      estimated_cost: estimatedCost,
      is_estimate: true,
      formatted_estimated_cost: `₹${estimatedCost.toFixed(2)}`,
    };
  }

  /**
   * Calculates ACTUAL cost based on confirmed sent message count.
   */
  static async calculateActualCost(sentCount = 0) {
    const rate = await this.getRatePerMessage();
    const count = Math.max(0, parseInt(sentCount, 10) || 0);
    const actualCost = parseFloat((count * rate).toFixed(2));

    return {
      sent_count: count,
      rate_per_message: rate,
      currency: 'INR',
      currency_symbol: '₹',
      actual_cost: actualCost,
      is_estimate: false,
      formatted_actual_cost: `₹${actualCost.toFixed(2)}`,
    };
  }

  /**
   * Checks the available WhatsApp provider balance.
   * STRICT SAFETY RULE:
   * If the provider does not expose a real balance, return "BALANCE UNAVAILABLE".
   * Never invent or hardcode a fake balance.
   */
  static async getProviderBalance() {
    // Meta Cloud API operates on post-paid Business Manager credit lines / invoices
    // and does NOT expose a real-time pre-paid balance endpoint via Graph API.
    return {
      available: false,
      balance: null,
      currency: 'INR',
      currency_symbol: '₹',
      status_text: 'BALANCE UNAVAILABLE',
      reason: 'Provider Meta Cloud API does not expose real-time prepaid wallet balance via API.',
    };
  }

  /**
   * Estimates processing duration for a batch based on configured throughput
   */
  static estimateDuration(messageCount = 0) {
    const count = Math.max(0, parseInt(messageCount, 10) || 0);
    if (count === 0) {
      return {
        seconds: 0,
        text: '0 seconds',
        estimated_rate_text: `${DEFAULT_MESSAGES_PER_MINUTE} messages/minute`,
      };
    }

    // Read RPS or rate limit from environment
    const rps = parseInt(process.env.WHATSAPP_RPS_LIMIT, 10) || 1;
    // Real-world conservative dispatch rate: ~20-30 messages/minute to respect Meta tier limits
    const messagesPerMinute = Math.min(60 * rps, DEFAULT_MESSAGES_PER_MINUTE);

    const minutes = Math.ceil(count / messagesPerMinute);
    const seconds = Math.ceil((count / messagesPerMinute) * 60);

    const text = minutes <= 1 ? '~1 minute (ESTIMATE)' : `~${minutes} minutes (ESTIMATE)`;

    return {
      seconds,
      minutes,
      text,
      estimated_rate_text: `~${messagesPerMinute} messages/minute`,
      is_estimate: true,
    };
  }
}

module.exports = WhatsAppCostService;
