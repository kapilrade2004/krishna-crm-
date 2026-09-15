'use strict';

const logger = require('../../../config/logger');

/**
 * AOC Portal / Vasify Gateway WhatsApp Provider Implementation
 */
class AocProvider {
  constructor(config = {}) {
    this.name = 'aoc';
    this.apiKey = config.apiKey || process.env.WHATSAPP_API_KEY;
    this.apiUrl = config.apiUrl || process.env.WHATSAPP_API_URL || 'https://api.aoc-portal.com/v1/whatsapp';
    this.verifyToken = config.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
    this.senderNumber = config.senderNumber || process.env.WHATSAPP_SENDER_NUMBER;
  }

  /**
   * Cleans phone number for AOC format (91XXXXXXXXXX)
   */
  _cleanPhone(phone) {
    if (!phone) return '';
    const clean = String(phone).replace(/\D/g, '');
    const last10 = clean.slice(-10);
    return last10.length === 10 ? `91${last10}` : clean;
  }

  /**
   * Send WhatsApp Template via AOC Portal
   */
  async sendTemplate({ to, templateName, components = [], payload = {}, idempotencyKey = null }) {
    if (!this.apiKey || !this.apiUrl) {
      if (process.env.NODE_ENV === 'test') {
        return {
          provider: this.name,
          providerMessageId: `aoc_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          status: 'PROVIDER_ACCEPTED',
          rawResponse: { mock: true },
        };
      }
      throw new Error('AOC Provider is missing WHATSAPP_API_KEY or WHATSAPP_API_URL configuration');
    }

    const formattedPhone = this._cleanPhone(to);
    const formattedSender = this._cleanPhone(this.senderNumber || process.env.WHATSAPP_SENDER_NUMBER);

    // Transform Meta-style components array into official AOC Portal components object structure
    let aocComponents = {};
    if (Array.isArray(components) && components.length > 0) {
      // 1. Header Media / Text Component
      const headerComponent = components.find((c) => c.type === 'header');
      if (headerComponent) {
        if (headerComponent.image || headerComponent.parameters?.[0]?.image) {
          const imgObj = headerComponent.image || headerComponent.parameters[0].image;
          aocComponents.header = {
            type: 'image',
            image: { link: imgObj.link || imgObj.url || 'https://akuabeat.com/logo.png' },
          };
        } else if (headerComponent.link || headerComponent.parameters?.[0]?.link) {
          const link = headerComponent.link || headerComponent.parameters[0].link;
          aocComponents.header = {
            type: 'image',
            image: { link },
          };
        } else if (headerComponent.parameters && headerComponent.parameters.length > 0) {
          const textParams = headerComponent.parameters.map((p) =>
            p.text !== undefined ? String(p.text) : String(p)
          );
          aocComponents.header = { params: textParams };
        }
      }

      // 2. Body Component (positional parameters)
      const bodyComponent = components.find((c) => c.type === 'body');
      if (bodyComponent) {
        const params =
          bodyComponent.parameters?.map((p) => (p.text !== undefined ? String(p.text) : String(p))) || [];
        aocComponents.body = { params };
      }

      // 3. Dynamic URL / Interactive Button Component
      const buttonComponent = components.find((c) => c.type === 'button' || c.type === 'buttons');
      if (buttonComponent) {
        const btnParams =
          buttonComponent.parameters?.map((p) => (p.text !== undefined ? String(p.text) : String(p))) || [];
        if (btnParams.length > 0) {
          aocComponents.buttons = { params: btnParams };
        }
      }
    } else if (components && typeof components === 'object') {
      aocComponents = components;
    }

    // Official AOC Portal Payload Schema
    const bodyPayload = {
      from: formattedSender || undefined,
      campaignName: payload.campaignName || 'crm-order-system',
      to: formattedPhone,
      templateName,
      type: 'template',
    };

    if (Object.keys(aocComponents).length > 0) {
      bodyPayload.components = aocComponents;
    }

    if (process.env.WHATSAPP_SANDBOX === 'true' || process.env.WHATSAPP_MOCK === 'true') {
      return {
        provider: this.name,
        providerMessageId: `aoc_sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        status: 'PROVIDER_ACCEPTED',
        rawResponse: { sandbox: true, body: bodyPayload },
      };
    }

    const headers = {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(10000),
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }

    const hasError = !response.ok || (data.error && data.error !== false && data.error !== 'false');
    if (hasError) {
      const errMsg =
        data.error?.message ||
        data.message ||
        (typeof data.error === 'string' ? data.error : null) ||
        `AOC API failed with HTTP ${response.status}`;
      const err = new Error(errMsg);
      err.provider = this.name;
      err.statusCode = response.status;
      err.details = data;
      throw err;
    }

    const providerMessageId =
      data.data?.[0]?.messageId ||
      data.messages?.[0]?.id ||
      data.messageId ||
      data.id ||
      `aoc_${Date.now()}`;

    return {
      provider: this.name,
      providerMessageId,
      status: 'PROVIDER_ACCEPTED',
      rawResponse: data,
    };
  }

  /**
   * Send plain text via AOC
   */
  async sendText({ to, text }) {
    const formattedPhone = this._cleanPhone(to);
    const formattedSender = this._cleanPhone(this.senderNumber || process.env.WHATSAPP_SENDER_NUMBER);
    const bodyPayload = {
      from: formattedSender || undefined,
      campaignName: 'crm-order-system',
      to: formattedPhone,
      type: 'text',
      text: { body: text },
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(8000),
    });

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }

    const hasError = !response.ok || (data.error && data.error !== false && data.error !== 'false');
    if (hasError) {
      const errMsg =
        data.error?.message ||
        data.message ||
        (typeof data.error === 'string' ? data.error : null) ||
        `AOC text send failed with HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    const providerMessageId =
      data.data?.[0]?.messageId ||
      data.messages?.[0]?.id ||
      data.messageId ||
      data.id ||
      `aoc_${Date.now()}`;

    return {
      provider: this.name,
      providerMessageId,
      status: 'PROVIDER_ACCEPTED',
      rawResponse: data,
    };
  }

  /**
   * Downloads media binary via AOC Media endpoint or direct URL
   */
  async downloadMedia({ mediaId, directUrl = null, raw = null }) {
    if (!mediaId && !directUrl && !raw) {
      throw new Error('downloadMedia requires mediaId, directUrl, or raw payload');
    }

    if (process.env.WHATSAPP_SANDBOX === 'true' || process.env.WHATSAPP_MOCK === 'true') {
      const buffer = Buffer.from('MOCK_JPEG_IMAGE_BINARY_DATA', 'utf-8');
      return {
        provider: this.name,
        buffer,
        mimeType: 'image/jpeg',
        fileSize: buffer.byteLength,
      };
    }

    // Check for inline base64 image data in raw payload
    const inlineBase64 = raw?.image?.data || raw?.image?.base64 || raw?.data || raw?.base64 || raw?.image?.file_data;
    if (inlineBase64 && typeof inlineBase64 === 'string') {
      try {
        const cleanBase64 = inlineBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        if (buffer && buffer.length > 0) {
          return {
            provider: this.name,
            buffer,
            mimeType: raw?.image?.mime_type || raw?.mime_type || 'image/jpeg',
            fileSize: buffer.byteLength,
          };
        }
      } catch (b64Err) {
        logger.warn(`Could not decode inline base64 image: ${b64Err.message}`);
      }
    }

    // Direct URL support
    const targetUrl = directUrl || raw?.directUrl || raw?.image?.url || raw?.image?.link || raw?.url || raw?.link;
    if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
      let res = await fetch(targetUrl, {
        headers: { apikey: this.apiKey, 'x-api-key': this.apiKey },
      }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(targetUrl).catch(() => null);
      }
      if (res && res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
        return {
          provider: this.name,
          buffer: Buffer.from(arrayBuffer),
          mimeType,
          fileSize: arrayBuffer.byteLength,
          directUrl: targetUrl,
        };
      }
    }

    // AOC Media ID retrieval
    if (mediaId) {
      const aocBase = (this.apiUrl || '').replace(/\/+$/, '').replace(/\/whatsapp$/, '');
      const endpoints = [
        `${aocBase}/media/${mediaId}`,
        `${aocBase}/whatsapp/media/${mediaId}`,
        `https://api.aoc-portal.com/v1/whatsapp/media/${mediaId}`,
        `https://api.aoc-portal.com/v1/media/${mediaId}`,
      ];

      const aocHeaders = {
        apikey: this.apiKey,
        'x-api-key': this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
      };

      for (const endpoint of endpoints) {
        try {
          const aocRes = await fetch(endpoint, { headers: aocHeaders });
          if (aocRes && aocRes.ok) {
            const contentType = (aocRes.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('application/json')) {
              const data = await aocRes.json();
              const downloadUrl = data.url || data.media_url || data.file_url || data.data?.url;
              if (downloadUrl) {
                const fileRes = await fetch(downloadUrl, { headers: aocHeaders }).catch(() => null) ||
                                await fetch(downloadUrl);
                if (fileRes && fileRes.ok) {
                  const arrBuf = await fileRes.arrayBuffer();
                  const mime = (fileRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
                  return {
                    provider: this.name,
                    buffer: Buffer.from(arrBuf),
                    mimeType: mime,
                    fileSize: arrBuf.byteLength,
                    directUrl: downloadUrl,
                  };
                }
              }
            } else {
              // Direct binary streaming
              const arrBuf = await aocRes.arrayBuffer();
              return {
                provider: this.name,
                buffer: Buffer.from(arrBuf),
                mimeType: contentType.split(';')[0].trim() || 'image/jpeg',
                fileSize: arrBuf.byteLength,
              };
            }
          }
        } catch (err) {
          logger.debug(`AOC media fetch error on ${endpoint}: ${err.message}`);
        }
      }
    }

    // If targetUrl exists but could not be downloaded, return directUrl reference
    if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
      return {
        provider: this.name,
        buffer: null,
        directUrl: targetUrl,
        mimeType: 'image/jpeg',
        fileSize: 0,
      };
    }

    // If targetUrl exists but could not be downloaded, return directUrl reference
    if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
      return {
        provider: this.name,
        buffer: null,
        directUrl: targetUrl,
        mimeType: 'image/jpeg',
        fileSize: 0,
      };
    }

    // Do NOT fabricate synthetic image buffer when media is unavailable
    logger.error(`[AOC Provider] Media ID ${mediaId || 'unknown'} could not be retrieved from provider`);
    throw new Error(`AOC media download failed: Media ${mediaId || 'unknown'} unavailable`);
  }

  /**
   * Normalizes inbound AOC webhook payload into canonical format
   */
  normalizeWebhook(rawPayload) {
    const events = [];
    if (!rawPayload) return events;

    const messageList = [];
    const statusList = [];

    const isStatusEvent = rawPayload.event === 'message_status' || rawPayload.event === 'status_update' || rawPayload.event === 'status_failed';

    // 1. Extract messages & statuses from Meta nested format or AOC formats
    if (rawPayload.entry && Array.isArray(rawPayload.entry)) {
      for (const entry of rawPayload.entry) {
        const changes = entry.changes || [{ value: entry }];
        for (const change of changes) {
          const val = change.value || change;
          if (Array.isArray(val.messages)) messageList.push(...val.messages);
          if (Array.isArray(val.statuses)) statusList.push(...val.statuses);
        }
      }
    } else if (Array.isArray(rawPayload.messages)) {
      messageList.push(...rawPayload.messages);
    } else if (rawPayload.message && typeof rawPayload.message === 'object') {
      messageList.push(rawPayload.message);
    } else if (rawPayload.messages && typeof rawPayload.messages === 'object') {
      messageList.push({
        ...rawPayload.messages,
        from: rawPayload.messages.from || rawPayload.from,
        id: rawPayload.messages.id || rawPayload.messages.messageId || rawPayload.messageId || rawPayload.id,
        contacts: rawPayload.contacts,
      });
    } else if (Array.isArray(rawPayload.data?.messages)) {
      messageList.push(...rawPayload.data.messages);
    } else if (
      !isStatusEvent &&
      (rawPayload.type ||
      rawPayload.from ||
      rawPayload.sender ||
      rawPayload.button ||
      rawPayload.interactive ||
      rawPayload.button_reply ||
      rawPayload.image ||
      rawPayload.text)
    ) {
      // Direct root message payload
      messageList.push(rawPayload);
    }

    if (Array.isArray(rawPayload.statuses)) {
      statusList.push(...rawPayload.statuses);
    } else if (Array.isArray(rawPayload.data?.statuses)) {
      statusList.push(...rawPayload.data.statuses);
    } else if (rawPayload.statuses && typeof rawPayload.statuses === 'object') {
      statusList.push({
        ...rawPayload.statuses,
        id: rawPayload.statuses.id || rawPayload.statuses.messageId || rawPayload.messageId || rawPayload.id,
        from: rawPayload.statuses.from || rawPayload.from,
        to: rawPayload.statuses.to || rawPayload.to,
      });
    } else if (isStatusEvent || (rawPayload.status && (rawPayload.id || rawPayload.messageId || rawPayload.wa_message_id))) {
      statusList.push(rawPayload);
    }

    // 2. Parse extracted messages
    for (const msg of messageList) {
      const senderPhone = String(
        msg.from || msg.sender || msg.mobile || rawPayload.from || rawPayload.sender || ''
      ).replace(/\D/g, '').slice(-10);
      const providerMessageId = msg.id || msg.messageId || msg.wa_message_id || `aoc_${Date.now()}`;
      const msgType = String(
        msg.type || (msg.image ? 'image' : (msg.button || msg.interactive || msg.button_reply ? 'button' : msg.location ? 'location' : 'text'))
      ).toLowerCase().trim();

      const btnObj =
        msg.button ||
        msg.button_reply ||
        msg.interactive?.button_reply ||
        msg.interactive?.list_reply ||
        msg.interactive?.text?.list_reply ||
        msg.interactive?.text?.button_reply ||
        rawPayload.button_reply ||
        null;

      if (msgType === 'button' || msgType === 'interactive' || btnObj) {
        const buttonId = btnObj?.id || btnObj?.payload || btnObj?.text || btnObj?.title || msg.text || msg.body || '';
        const buttonTitle = btnObj?.title || btnObj?.text || btnObj?.payload || msg.text || msg.body || '';
        events.push({
          provider: this.name,
          type: 'button',
          providerMessageId,
          senderPhone,
          buttonId,
          buttonTitle,
          raw: msg,
        });
      } else if (msgType === 'location' || msg.location) {
        const loc = msg.location?.text || msg.location || {};
        const lat = loc.latitude || loc.lat || '';
        const lng = loc.longitude || loc.long || loc.lng || '';
        const locText = lat && lng ? `Location: ${lat}, ${lng} (https://maps.google.com/?q=${lat},${lng})` : 'Shared location';
        events.push({
          provider: this.name,
          type: 'text',
          providerMessageId,
          senderPhone,
          text: locText,
          location: { latitude: lat, longitude: lng },
          raw: msg,
        });
      } else if (
        msgType === 'image' ||
        msg.image ||
        msg.media ||
        (msg.document && (msg.document.mime_type || '').startsWith('image/'))
      ) {
        const img = msg.image || msg.media || msg.document || {};
        const extractedDirectUrl = img.url || img.link || img.directUrl || img.file_url || msg.url || msg.link || null;
        events.push({
          provider: this.name,
          type: 'image',
          providerMessageId,
          senderPhone,
          mediaId: img.id || img.media_id || `media_${providerMessageId || Date.now()}`,
          directUrl: extractedDirectUrl,
          mimeType: img.mime_type || img.contentType || 'image/jpeg',
          caption: img.caption || msg.caption || null,
          raw: { ...msg, directUrl: extractedDirectUrl },
        });
      } else {
        const textBody =
          (typeof msg.text === 'object' ? msg.text?.body : msg.text) ||
          msg.body ||
          (typeof msg === 'string' ? msg : '');
        events.push({
          provider: this.name,
          type: 'text',
          providerMessageId,
          senderPhone,
          text: String(textBody || ''),
          raw: msg,
        });
      }
    }

    // 3. Parse extracted statuses
    for (const st of statusList) {
      events.push({
        provider: this.name,
        type: 'status',
        providerMessageId: st.id || st.messageId || st.wa_message_id,
        senderPhone: String(st.recipient_id || st.recipient || st.to || '').replace(/\D/g, '').slice(-10),
        status: String(st.status || '').toUpperCase(),
        timestamp: this._parseTimestamp(st.timestamp),
        errorCode: st.errors?.[0]?.code || st.error?.code || null,
        errorReason: st.errors?.[0]?.message || st.error?.message || null,
        raw: st,
      });
    }

    return events;
  }

  /**
   * Safely parses epoch seconds, epoch milliseconds, or ISO-8601 timestamps
   */
  _parseTimestamp(rawTimestamp) {
    if (!rawTimestamp) return new Date();
    const str = String(rawTimestamp).trim();
    if (/^\d+$/.test(str)) {
      const num = Number(str);
      return new Date(str.length === 10 ? num * 1000 : num);
    }
    const d = new Date(rawTimestamp);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /**
   * Verifies webhook authenticity
   */
  verifyWebhook(req) {
    // Verification query token check (GET)
    if (req.method === 'GET') {
      const mode = req.query?.['hub.mode'];
      const token = req.query?.['hub.verify_token'];
      const challenge = req.query?.['hub.challenge'];
      if (mode === 'subscribe' && token === (this.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN)) {
        return { verified: true, challenge };
      }
      return { verified: false };
    }

    // POST webhook: check header apikey or secret if configured
    const apiKey = req.headers?.apikey || req.headers?.['x-api-key'];
    if (this.apiKey && apiKey) {
      return { verified: apiKey === this.apiKey };
    }

    // Permissive by default if no shared webhook secret is enforced
    return { verified: true };
  }

  /**
   * Queries delivery status from provider
   */
  async getMessageStatus(providerMessageId) {
    return {
      provider: this.name,
      providerMessageId,
      status: 'UNKNOWN',
    };
  }
}

module.exports = AocProvider;
