'use strict';

const crypto = require('crypto');
const logger = require('../../../config/logger');

/**
 * Meta Direct Cloud API (v19.0) WhatsApp Provider Implementation
 */
class MetaProvider {
  constructor(config = {}) {
    this.name = 'meta';
    this.phoneNumberId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    this.apiVersion = config.apiVersion || process.env.WHATSAPP_API_VERSION || 'v19.0';
    this.verifyToken = config.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
    this.appSecret = config.appSecret || process.env.WHATSAPP_APP_SECRET;
    this.baseUrl = config.baseUrl || process.env.WHATSAPP_API_BASE_URL || `https://graph.facebook.com/${this.apiVersion}`;
  }

  _cleanPhone(phone) {
    if (!phone) return '';
    const clean = String(phone).replace(/\D/g, '');
    const last10 = clean.slice(-10);
    return last10.length === 10 ? `91${last10}` : clean;
  }

  /**
   * Send WhatsApp Template via Meta Cloud API
   */
  async sendTemplate({ to, templateName, components = [], payload = {}, idempotencyKey = null }) {
    if (!this.phoneNumberId || !this.accessToken) {
      if (process.env.NODE_ENV === 'test') {
        return {
          provider: this.name,
          providerMessageId: `wamid.mock.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`,
          status: 'PROVIDER_ACCEPTED',
          rawResponse: { mock: true },
        };
      }
      throw new Error('Meta Provider is missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
    }

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const formattedPhone = this._cleanPhone(to);

    const bodyPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: payload.languageCode || 'en' },
        components: components.length > 0 ? components : undefined,
      },
    };

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      const errMsg = data.error?.message || `Meta API failed with HTTP ${response.status}`;
      const err = new Error(errMsg);
      err.provider = this.name;
      err.statusCode = response.status;
      err.metaCode = data.error?.code;
      err.metaSubcode = data.error?.error_subcode;
      err.details = data;
      throw err;
    }

    const providerMessageId = data.messages?.[0]?.id || `wamid.${Date.now()}`;
    return {
      provider: this.name,
      providerMessageId,
      status: 'PROVIDER_ACCEPTED',
      rawResponse: data,
    };
  }

  /**
   * Send text via Meta Cloud API
   */
  async sendText({ to, text }) {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const formattedPhone = this._cleanPhone(to);

    const bodyPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: { body: text },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `Meta text send failed with HTTP ${response.status}`);
    }

    const providerMessageId = data.messages?.[0]?.id || `wamid.${Date.now()}`;
    return {
      provider: this.name,
      providerMessageId,
      status: 'PROVIDER_ACCEPTED',
      rawResponse: data,
    };
  }

  /**
   * Downloads media binary via Meta Media API
   */
  async downloadMedia({ mediaId, directUrl = null }) {
    let downloadUrl = directUrl;

    if (!downloadUrl) {
      if (!mediaId) {
        throw new Error('downloadMedia requires mediaId or directUrl');
      }

      // Step 1: Query Graph API for media URL
      const metaUrl = `${this.baseUrl}/${mediaId}`;
      const res = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`Meta Media metadata lookup failed for ${mediaId}: HTTP ${res.status}`);
      }

      const metaData = await res.json();
      downloadUrl = metaData.url;
      if (!downloadUrl) {
        throw new Error(`Meta Media metadata did not return a valid download URL for ${mediaId}`);
      }
    }

    // Step 2: Download raw media binary using Access Token
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!fileRes.ok) {
      throw new Error(`Failed to download binary from Meta CDN: HTTP ${fileRes.status}`);
    }

    const arrBuf = await fileRes.arrayBuffer();
    const mimeType = (fileRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();

    return {
      provider: this.name,
      buffer: Buffer.from(arrBuf),
      mimeType,
      fileSize: arrBuf.byteLength,
    };
  }

  /**
   * Normalizes inbound Meta webhook payload
   */
  normalizeWebhook(rawPayload) {
    const events = [];
    const entries = rawPayload?.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const val = change.value;
        if (!val) continue;

        // Inbound messages
        const messages = val.messages || [];
        for (const msg of messages) {
          const senderPhone = String(msg.from || '').replace(/\D/g, '').slice(-10);
          const providerMessageId = msg.id;

          if (msg.type === 'button' || msg.button) {
            events.push({
              provider: this.name,
              type: 'button',
              providerMessageId,
              senderPhone,
              buttonId: msg.button?.payload || msg.button?.text,
              buttonTitle: msg.button?.text,
              raw: msg,
            });
          } else if (msg.type === 'interactive' && msg.interactive?.button_reply) {
            events.push({
              provider: this.name,
              type: 'button',
              providerMessageId,
              senderPhone,
              buttonId: msg.interactive.button_reply.id,
              buttonTitle: msg.interactive.button_reply.title,
              raw: msg,
            });
          } else if (msg.type === 'image' || msg.image) {
            const img = msg.image || {};
            events.push({
              provider: this.name,
              type: 'image',
              providerMessageId,
              senderPhone,
              mediaId: img.id,
              mimeType: img.mime_type || 'image/jpeg',
              caption: img.caption || null,
              raw: msg,
            });
          } else if (msg.type === 'text' || msg.text) {
            events.push({
              provider: this.name,
              type: 'text',
              providerMessageId,
              senderPhone,
              text: msg.text?.body || '',
              raw: msg,
            });
          }
        }

        // Status Updates
        const statuses = val.statuses || [];
        for (const st of statuses) {
          events.push({
            provider: this.name,
            type: 'status',
            providerMessageId: st.id,
            senderPhone: String(st.recipient_id || '').replace(/\D/g, '').slice(-10),
            status: (st.status || '').toUpperCase(),
            timestamp: st.timestamp ? new Date(parseInt(st.timestamp, 10) * 1000) : new Date(),
            errorCode: st.errors?.[0]?.code || null,
            errorReason: st.errors?.[0]?.message || null,
            raw: st,
          });
        }
      }
    }

    return events;
  }

  /**
   * Verifies Meta webhook signatures (GET verify token & POST sha256)
   */
  verifyWebhook(req) {
    if (req.method === 'GET') {
      const mode = req.query?.['hub.mode'];
      const token = req.query?.['hub.verify_token'];
      const challenge = req.query?.['hub.challenge'];
      if (mode === 'subscribe' && token === (this.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN)) {
        return { verified: true, challenge };
      }
      return { verified: false };
    }

    // POST: Check X-Hub-Signature-256 if appSecret is configured
    if (this.appSecret && req.headers?.['x-hub-signature-256']) {
      const signature = req.headers['x-hub-signature-256'];
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const expected = `sha256=${crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex')}`;
      return { verified: crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) };
    }

    return { verified: true };
  }

  async getMessageStatus(providerMessageId) {
    return {
      provider: this.name,
      providerMessageId,
      status: 'UNKNOWN',
    };
  }
}

module.exports = MetaProvider;
