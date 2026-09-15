'use strict';

const WhatsAppProviderFactory = require('./whatsappProviderFactory');
const { isWhatsAppSendingEnabled } = require('../emergencyPauseService');
const whatsappRateLimiter = require('../whatsappRateLimiter');
const logger = require('../../config/logger');

class WhatsAppMessageService {
  /**
   * Dispatches a template message through the configured provider,
   * respecting killswitch and rate limiter release gates.
   */
  static async sendTemplate({
    to,
    templateName,
    components = [],
    payload = {},
    idempotencyKey = null,
    providerOverride = null,
  }) {
    // 1. Emergency Kill Switch Check
    if (!(await isWhatsAppSendingEnabled())) {
      const err = new Error('WHATSAPP_SENDING_PAUSED: Emergency kill switch is active');
      err.isEmergencyPause = true;
      err.code = 'WHATSAPP_SENDING_PAUSED';
      throw err;
    }

    // 2. Centralized Distributed Rate Limiter
    const rateToken = await whatsappRateLimiter.acquireSendToken({
      messageType: templateName || 'template',
    });

    if (!rateToken.allowed) {
      const waitSec = Math.ceil((rateToken.waitMs || 1500) / 1000);
      const err = new Error(`WHATSAPP_RATE_LIMIT_EXCEEDED: ${rateToken.reason}. Retry after ${waitSec}s`);
      err.code = rateToken.reason || 'RATE_LIMIT_EXCEEDED';
      err.waitMs = rateToken.waitMs;
      err.isThrottled = true;
      throw err;
    }

    // 3. Resolve Provider
    const provider = WhatsAppProviderFactory.getProvider(providerOverride ? { provider: providerOverride } : {});

    // 4. Send via Provider
    return await provider.sendTemplate({
      to,
      templateName,
      components,
      payload,
      idempotencyKey,
    });
  }

  /**
   * Dispatches text message through the configured provider
   */
  static async sendText({ to, text, providerOverride = null }) {
    if (!(await isWhatsAppSendingEnabled())) {
      const err = new Error('WHATSAPP_SENDING_PAUSED: Emergency kill switch is active');
      err.isEmergencyPause = true;
      err.code = 'WHATSAPP_SENDING_PAUSED';
      throw err;
    }

    const provider = WhatsAppProviderFactory.getProvider(providerOverride ? { provider: providerOverride } : {});
    return await provider.sendText({ to, text });
  }

  /**
   * Downloads media using the configured provider
   */
  static async downloadMedia({ mediaId, directUrl = null, providerOverride = null, raw = null }) {
    const provider = WhatsAppProviderFactory.getProvider(providerOverride ? { provider: providerOverride } : {});
    return await provider.downloadMedia({ mediaId, directUrl, raw });
  }
}

module.exports = WhatsAppMessageService;
