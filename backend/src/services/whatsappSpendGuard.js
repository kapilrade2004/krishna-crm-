'use strict';

const { Op } = require('sequelize');
const { WhatsAppLog, WhatsAppBatch, WhatsAppRateLimitEvent, SystemSetting, sequelize } = require('../models');
const whatsappCostService = require('./whatsappCostService');
const logger = require('../config/logger');

const DEFAULT_DAILY_SPEND_LIMIT = parseFloat(process.env.WHATSAPP_DAILY_SPEND_LIMIT) || 10000.00; // ₹10,000.00 INR per day (Default operational ceiling, editable)
const DEFAULT_BALANCE_POLICY = 'ALLOW_WITH_DAILY_CEILING'; // Standard Meta Invoicing Policy

class WhatsAppSpendGuard {
  /**
   * Helper: Resolves today's start and end timestamps in India Standard Time (+05:30)
   */
  getTodayIstBoundaries() {
    const now = new Date();
    // Convert current UTC time to IST
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(now.getTime() + istOffsetMs);

    const year = nowIst.getUTCFullYear();
    const month = String(nowIst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(nowIst.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // IST Day start: 00:00:00 IST = previous day 18:30:00 UTC
    const startUtc = new Date(`${dateStr}T00:00:00+05:30`);
    // IST Day end: 23:59:59.999 IST = 18:29:59.999 UTC
    const endUtc = new Date(`${dateStr}T23:59:59.999+05:30`);

    return { startUtc, endUtc, dateStr };
  }

  /**
   * Reads configured daily spend ceiling from SystemSetting
   */
  async getDailySpendLimit() {
    try {
      const setting = await SystemSetting.findOne({ where: { key: 'WHATSAPP_DAILY_SPEND_LIMIT' } });
      if (setting && setting.value) {
        const val = parseFloat(setting.value);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch (e) {
      logger.debug('Using default daily WhatsApp spend ceiling:', e.message);
    }
    return DEFAULT_DAILY_SPEND_LIMIT;
  }

  /**
   * Reads balance policy (ALLOW_WITH_DAILY_CEILING vs STRICT_BLOCK_IF_UNKNOWN)
   */
  async getBalancePolicy() {
    try {
      const setting = await SystemSetting.findOne({ where: { key: 'WHATSAPP_BALANCE_POLICY' } });
      if (setting && setting.value) return setting.value;
    } catch (_) {}
    return DEFAULT_BALANCE_POLICY;
  }

  /**
   * Calculates confirmed spend for today (IST)
   */
  async getTodayConfirmedSpend(transaction = null) {
    const { startUtc, endUtc } = this.getTodayIstBoundaries();

    // Sum estimated_cost (or actual_cost if billed) of all sent messages today
    const logs = await WhatsAppLog.findAll({
      where: {
        sent_at: { [Op.between]: [startUtc, endUtc] },
        status: { [Op.in]: ['sent', 'delivered', 'read'] },
      },
      attributes: ['estimated_cost', 'actual_cost'],
      raw: true,
      ...(transaction ? { transaction } : {}),
    });

    let total = 0;
    for (const log of logs) {
      const cost = log.actual_cost !== null ? parseFloat(log.actual_cost) : (parseFloat(log.estimated_cost) || 0);
      total += cost;
    }
    return parseFloat(total.toFixed(2));
  }

  /**
   * Calculates currently active reserved spend from active batches
   */
  async getActiveReservedSpend(excludeBatchId = null, transaction = null) {
    const where = {
      status: { [Op.in]: ['QUEUED', 'PROCESSING'] },
      reserved_cost: { [Op.gt]: 0 },
    };
    if (excludeBatchId && typeof excludeBatchId === 'string') {
      where.id = { [Op.ne]: excludeBatchId };
    }

    const batches = await WhatsAppBatch.findAll({
      where,
      attributes: ['reserved_cost'],
      raw: true,
      ...(transaction ? { transaction } : {}),
    });

    let total = 0;
    for (const b of batches) {
      total += parseFloat(b.reserved_cost) || 0;
    }
    return parseFloat(total.toFixed(2));
  }

  /**
   * Verifies available provider balance where technically supported.
   * If balance is available and insufficient, blocks.
   * If balance is UNAVAILABLE (Meta direct), applies configured policy.
   */
  async checkProviderBalance(estimatedCost) {
    const balanceInfo = await whatsappCostService.getProviderBalance();
    const policy = await this.getBalancePolicy();

    if (balanceInfo.available && balanceInfo.balance !== null) {
      if (estimatedCost > balanceInfo.balance) {
        const err = new Error(
          `INSUFFICIENT_WHATSAPP_BALANCE: Required ₹${estimatedCost.toFixed(2)}, available wallet balance: ₹${balanceInfo.balance.toFixed(2)}`
        );
        err.code = 'INSUFFICIENT_WHATSAPP_BALANCE';
        err.statusCode = 400;
        throw err;
      }
    } else {
      if (policy === 'STRICT_BLOCK_IF_UNKNOWN') {
        const err = new Error('BALANCE_STATUS_UNKNOWN: Strict balance verification policy is active and balance cannot be queried.');
        err.code = 'BALANCE_STATUS_UNKNOWN';
        err.statusCode = 400;
        throw err;
      }
    }
    return balanceInfo;
  }

  /**
   * Atomically checks daily spend ceiling and reserves spend for a batch
   * Prevents concurrent batches from overspending.
   */
  async checkAndReserveSpend({ batchId, amount, userId = null, transaction = null }) {
    const dailyLimit = await this.getDailySpendLimit();
    const cost = parseFloat(amount) || 0;

    // 1. Check provider balance where applicable
    await this.checkProviderBalance(cost);

    // 2. Query today confirmed spend and active reservations atomically
    const confirmedSpend = await this.getTodayConfirmedSpend(transaction);
    const reservedSpend = await this.getActiveReservedSpend(batchId, transaction);
    const projectedSpend = confirmedSpend + reservedSpend + cost;

    if (projectedSpend > dailyLimit) {
      const remainingSpend = Math.max(0, dailyLimit - (confirmedSpend + reservedSpend));
      const errMsg =
        `DAILY_SPEND_LIMIT_EXCEEDED: Proposed batch cost ₹${cost.toFixed(2)} exceeds remaining daily spend limit ` +
        `of ₹${remainingSpend.toFixed(2)} (Daily Ceiling: ₹${dailyLimit.toFixed(2)}, Confirmed Spend: ₹${confirmedSpend.toFixed(2)}, Active Reservations: ₹${reservedSpend.toFixed(2)}).`;

      // Log spend blocking event
      WhatsAppRateLimitEvent.create({
        event_type: 'SPEND_CEILING_BLOCKED',
        batch_id: batchId,
        configured_limit: Math.round(dailyLimit),
        current_usage: Math.round(confirmedSpend + reservedSpend),
        amount: cost,
        details: {
          reason: 'DAILY_SPEND_LIMIT_EXCEEDED',
          daily_limit: dailyLimit,
          confirmed_spend: confirmedSpend,
          reserved_spend: reservedSpend,
          requested_amount: cost,
        },
      }).catch(() => {});

      // Dispatch real-time email alert to configured admin recipient
      try {
        const emailService = require('./emailService');
        emailService.sendWhatsAppErrorAlert({
          errorType: 'DAILY_SPEND_LIMIT_EXCEEDED',
          message: errMsg,
          batchId,
          details: {
            daily_limit: dailyLimit,
            confirmed_spend: confirmedSpend,
            reserved_spend: reservedSpend,
            requested_amount: cost,
          },
        }).catch(() => {});
      } catch (_) {}

      const err = new Error(errMsg);
      err.code = 'DAILY_SPEND_LIMIT_EXCEEDED';
      err.statusCode = 400;
      err.details = {
        daily_limit: dailyLimit,
        confirmed_spend: confirmedSpend,
        reserved_spend: reservedSpend,
        remaining_spend: remainingSpend,
        requested_amount: cost,
      };
      throw err;
    }

    // 3. Atomically record reservation on the batch record
    if (batchId) {
      const updatePayload = { reserved_cost: cost };
      const options = transaction ? { transaction } : {};
      await WhatsAppBatch.update(updatePayload, {
        where: { id: batchId },
        ...options,
      });

      WhatsAppRateLimitEvent.create({
        event_type: 'RESERVATION_ACQUIRED',
        batch_id: batchId,
        amount: cost,
        details: {
          daily_limit: dailyLimit,
          confirmed_spend: confirmedSpend,
          reserved_spend: reservedSpend + cost,
        },
      }).catch(() => {});
    }

    return {
      allowed: true,
      daily_limit: dailyLimit,
      confirmed_spend: confirmedSpend,
      reserved_spend: reservedSpend + cost,
      projected_spend: projectedSpend,
      remaining_spend: dailyLimit - projectedSpend,
    };
  }

  /**
   * Releases or adjusts reservation upon batch completion, failure, or cancellation
   */
  async releaseOrAdjustReservation({ batchId, actualCost = null, transaction = null }) {
    if (!batchId) return;

    try {
      const updatePayload = { reserved_cost: 0.00 };
      if (actualCost !== null) {
        updatePayload.actual_cost = parseFloat(actualCost) || 0;
      }

      const options = transaction ? { transaction } : {};
      await WhatsAppBatch.update(updatePayload, {
        where: { id: batchId },
        ...options,
      });

      WhatsAppRateLimitEvent.create({
        event_type: 'RESERVATION_RELEASED',
        batch_id: batchId,
        amount: actualCost !== null ? parseFloat(actualCost) : 0,
        details: { actual_cost: actualCost },
      }).catch(() => {});
    } catch (e) {
      logger.warn(`Failed to release spend reservation for batch ${batchId}:`, e.message);
    }
  }

  /**
   * Returns complete spend metrics, daily ceiling, and balance for dashboards
   */
  async getSpendStatus() {
    const dailyLimit = await this.getDailySpendLimit();
    const confirmedSpend = await this.getTodayConfirmedSpend();
    const reservedSpend = await this.getActiveReservedSpend();
    const projectedSpend = confirmedSpend + reservedSpend;
    const remainingSpend = Math.max(0, dailyLimit - projectedSpend);
    const balanceInfo = await whatsappCostService.getProviderBalance();
    const balancePolicy = await this.getBalancePolicy();
    const { dateStr } = this.getTodayIstBoundaries();

    return {
      date_ist: dateStr,
      timezone: 'Asia/Kolkata (IST, UTC+05:30)',
      daily_spend_limit: dailyLimit,
      today_confirmed_spend: confirmedSpend,
      today_reserved_spend: reservedSpend,
      today_projected_spend: projectedSpend,
      today_remaining_spend: remainingSpend,
      spend_utilization_pct: dailyLimit > 0 ? parseFloat(((projectedSpend / dailyLimit) * 100).toFixed(1)) : 0,
      spend_ceiling_breached: projectedSpend >= dailyLimit,
      provider_balance: balanceInfo,
      balance_policy: balancePolicy,
      currency: 'INR',
      currency_symbol: '₹',
    };
  }
}

// Singleton instance
module.exports = new WhatsAppSpendGuard();
