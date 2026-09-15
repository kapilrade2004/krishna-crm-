'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { WhatsAppLog, CustomerImage, Order, Customer, OrderActivity, ProductMaster, FollowUp, User } = require('../models');
const s3Service = require('./s3Service');
const OrderVerificationWorkflowService = new Proxy({}, {
  get: (_, prop) => require('./orderVerificationWorkflowService')[prop],
});
const logger = require('../config/logger');

const getEnv = () => ({
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v19.0',
  WHATSAPP_API_BASE_URL: process.env.WHATSAPP_API_BASE_URL,
  WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY,
  WHATSAPP_SENDER_NUMBER: process.env.WHATSAPP_SENDER_NUMBER,
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL,
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
});

// ─── Low-level API helpers ────────────────────────────────────────────────────

const isConfigured = () => {
  const env = getEnv();
  return !!(
    (env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN) ||
    (env.WHATSAPP_API_KEY && env.WHATSAPP_API_URL)
  );
};

const cleanAocPhone = (num) => {
  if (!num) return '';
  const clean = String(num).replace(/\D/g, '');
  const last10 = clean.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return clean;
};

const formatPhone = (num) => {
  if (!num) return '';
  const clean = String(num).replace(/\D/g, '');
  const last10 = clean.slice(-10);
  if (last10.length === 10) return `+91${last10}`;
  return `+${clean}`;
};

exports.isConfigured = isConfigured;
exports.cleanAocPhone = cleanAocPhone;
exports.formatPhone = formatPhone;

const normalizePhoneForMatch = (num) => {
  if (!num) return [];
  const clean = String(num).replace(/\D/g, '');
  const last10 = clean.slice(-10);
  return [
    clean,
    `+${clean}`,
    last10,
    `+91${last10}`,
    `91${last10}`,
  ];
};

const sendRequest = async (payload) => {
  const env = getEnv();
  
  // ─── 1. Global WhatsApp Emergency Kill Switch Guard (Central Enforcement) ───
  const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
  if (!(await isWhatsAppSendingEnabled())) {
    logger.warn('🛑 [WHATSAPP SERVICE] Global WhatsApp kill switch is ACTIVE (WHATSAPP_SENDING_ENABLED = false). Aborting Meta/Gateway API call.');
    const err = new Error('WHATSAPP_SENDING_PAUSED');
    err.isEmergencyPause = true;
    err.code = 'WHATSAPP_SENDING_PAUSED';
    throw err;
  }

  // ─── 2. Centralized Distributed Rate Limiter Enforcement ─────────────────────
  const whatsappRateLimiter = require('./whatsappRateLimiter');
  const token = await whatsappRateLimiter.acquireSendToken({
    messageType: payload.type || 'direct',
  });

  if (!token.allowed) {
    if (token.isEmergencyPause) {
      const err = new Error('WHATSAPP_SENDING_PAUSED');
      err.isEmergencyPause = true;
      err.code = 'WHATSAPP_SENDING_PAUSED';
      throw err;
    }
    const waitSec = Math.ceil((token.waitMs || 1500) / 1000);
    const err = new Error(`WHATSAPP_RATE_LIMIT_EXCEEDED: ${token.reason}. Please retry after ${waitSec}s.`);
    err.code = token.reason || 'RATE_LIMIT_EXCEEDED';
    err.waitMs = token.waitMs;
    err.isThrottled = true;
    throw err;
  }

  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'test') {
      return { messages: [{ id: `wam_mock_${Date.now()}` }], data: [{ messageId: `wam_mock_${Date.now()}` }] };
    }
    logger.warn('WhatsApp credentials not configured. Message not sent.');
    return null;
  }

  // AOC Portal / Vasify Gateway API Integration
  if (env.WHATSAPP_API_KEY && env.WHATSAPP_API_URL) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': env.WHATSAPP_API_KEY,
    };

    let response;
    let data;
    try {
      response = await fetch(env.WHATSAPP_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000), // 8-second network timeout
      });

      const rawText = await response.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { message: rawText ? rawText.substring(0, 300) : `HTTP ${response.status}` };
      }
    } catch (fetchErr) {
      if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
        throw new Error('WhatsApp AOC Gateway request timed out after 8 seconds');
      }
      throw fetchErr;
    }

    if (!response.ok || data.error) {
      const errObj = typeof data.error === 'object' ? data.error : null;
      const errMsg = String(errObj?.message || data.message || (typeof data.error === 'string' ? data.error : '') || `WhatsApp AOC API error: ${response.status}`);
      const err = new Error(errMsg);
      err.metaErrorCode = errObj?.code;
      err.metaErrorSubcode = errObj?.error_subcode;

      if (/insufficient\s*(credit|balance)|out\s*of\s*credit|balance\s*low|payment\s*required/i.test(errMsg)) {
        err.isInsufficientCredit = true;
      }
      if (response.status === 429 || /rate\s*limit|too\s*many\s*requests/i.test(errMsg) || errObj?.code === 130429) {
        err.isRateLimit = true;
        whatsappRateLimiter.reportProviderThrottle({
          errorCode: response.status || errObj?.code || 429,
          errorMessage: errMsg,
        }).catch(() => {});
      }
      throw err;
    }
    return data;
  }

  // Meta Direct Cloud API Integration
  const url = env.WHATSAPP_API_BASE_URL || `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let response;
  let data;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8-second network timeout
    });

    const rawText = await response.text();
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText ? rawText.substring(0, 300) : `HTTP ${response.status}` };
    }
  } catch (fetchErr) {
    if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
      throw new Error('WhatsApp Meta API request timed out after 8 seconds');
    }
    throw fetchErr;
  }

  if (!response.ok) {
    const errMsg = String(data.error?.message || data.message || `WhatsApp API error: ${response.status}`);
    const metaErrorCode = data.error?.code;
    const metaErrorSubcode = data.error?.error_subcode;
    const err = new Error(errMsg);
    err.metaErrorCode = metaErrorCode;
    err.metaErrorSubcode = metaErrorSubcode;

    if (/insufficient\s*(credit|balance)|out\s*of\s*credit|payment\s*required/i.test(errMsg)) {
      err.isInsufficientCredit = true;
    }

    const isRateLimit =
      response.status === 429 ||
      metaErrorCode === 80007 ||
      metaErrorSubcode === 130429 ||
      metaErrorSubcode === 131056 ||
      metaErrorSubcode === 130428 ||
      /rate\s*limit|too\s*many\s*requests/i.test(errMsg);

    if (isRateLimit) {
      err.isRateLimit = true;
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
      whatsappRateLimiter.reportProviderThrottle({
        errorCode: response.status,
        errorSubcode: metaErrorSubcode || metaErrorCode,
        errorMessage: errMsg,
        retryAfterSeconds: retryAfterSec,
      }).catch(() => {});
    }

    throw err;
  }
  return data;
};
exports.sendRequest = sendRequest;

// ─── Media Downloader & Sanitizer ─────────────────────────────────────────────

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024;

const downloadAndSaveMedia = async (imagePayload) => {
  try {
    const env = getEnv();
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadBase = path.join(process.cwd(), env.UPLOAD_DIR, 'whatsapp-media', year, month);

    if (!fs.existsSync(uploadBase)) {
      fs.mkdirSync(uploadBase, { recursive: true });
    }

    let buffer = null;
    let mimeType = (imagePayload.mime_type || '').toLowerCase().trim();

    // Scenario A: Direct URL provided (handles direct string or payload object)
    const directUrl = typeof imagePayload === 'string' && /^https?:\/\//i.test(imagePayload)
      ? imagePayload
      : (imagePayload.url || imagePayload.file_url || imagePayload.link || imagePayload.downloadUrl || imagePayload.mediaUrl || imagePayload.media_url || imagePayload.fileUrl);
    if (directUrl && directUrl.startsWith('http')) {
      const headers = {};
      if (env.WHATSAPP_ACCESS_TOKEN) headers['Authorization'] = `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`;
      if (env.WHATSAPP_API_KEY) headers['apikey'] = env.WHATSAPP_API_KEY;

      let res = await fetch(directUrl, { headers }).catch(() => null);
      if (!res || !res.ok) {
        // Retry without custom auth headers (e.g. S3 presigned URLs, AWS CDN, public media URLs)
        res = await fetch(directUrl).catch(() => null);
      }
      if (res && res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        const headerMime = res.headers.get('content-type');
        if (headerMime) mimeType = headerMime.toLowerCase().split(';')[0].trim();
      }
    }

    // Scenario B1: AOC Portal Media ID provided (when using AOC API Key)
    if (!buffer && imagePayload.id && env.WHATSAPP_API_KEY && !env.WHATSAPP_ACCESS_TOKEN) {
      const aocBase = env.WHATSAPP_API_URL ? env.WHATSAPP_API_URL.replace(/\/+$/, '') : 'https://api.aoc-portal.com/v1/whatsapp';
      const possibleAocEndpoints = [
        `${aocBase}/media/${imagePayload.id}`,
        `${aocBase.replace(/\/whatsapp$/, '')}/media/${imagePayload.id}`,
        `https://api.aoc-portal.com/v1/whatsapp/media/${imagePayload.id}`,
        `https://api.aoc-portal.com/v1/media/${imagePayload.id}`,
      ];

      const aocHeaders = {
        apikey: env.WHATSAPP_API_KEY,
        'x-api-key': env.WHATSAPP_API_KEY,
        Authorization: `Bearer ${env.WHATSAPP_API_KEY}`,
      };

      for (const endpoint of possibleAocEndpoints) {
        try {
          const aocRes = await fetch(endpoint, { headers: aocHeaders });
          if (aocRes && aocRes.ok) {
            const contentType = (aocRes.headers.get('content-type') || '').toLowerCase();
            if (contentType.includes('application/json')) {
              const aocData = await aocRes.json();
              const downloadUrl = aocData.url || aocData.media_url || aocData.file_url || aocData.data?.url;
              if (downloadUrl) {
                let fileRes = await fetch(downloadUrl, { headers: aocHeaders }).catch(() => null);
                if (!fileRes || !fileRes.ok) {
                  fileRes = await fetch(downloadUrl).catch(() => null);
                }
                if (fileRes && fileRes.ok) {
                  const arrBuf = await fileRes.arrayBuffer();
                  buffer = Buffer.from(arrBuf);
                  const mime = fileRes.headers.get('content-type') || aocData.mime_type;
                  if (mime) mimeType = mime.toLowerCase().split(';')[0].trim();
                  break;
                }
              }
            } else if (contentType.startsWith('image/') || contentType.includes('octet-stream')) {
              const arrBuf = await aocRes.arrayBuffer();
              buffer = Buffer.from(arrBuf);
              if (contentType.startsWith('image/')) {
                mimeType = contentType.split(';')[0].trim();
              }
              break;
            }
          }
        } catch (_) {}
      }
    }

    // Scenario B2: Meta Media ID provided (when using Meta Access Token)
    if (!buffer && imagePayload.id && env.WHATSAPP_ACCESS_TOKEN) {
      const metaUrl = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${imagePayload.id}`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      });
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        if (metaData.mime_type) mimeType = metaData.mime_type.toLowerCase().split(';')[0].trim();
        if (metaData.url) {
          const fileRes = await fetch(metaData.url, {
            headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
          });
          if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          }
        }
      }
    }

    // Scenario C: Buffer directly supplied (unit tests / in-memory payloads)
    if (!buffer && imagePayload.buffer && Buffer.isBuffer(imagePayload.buffer)) {
      buffer = imagePayload.buffer;
    }

    if (!buffer) {
      if (directUrl && directUrl.startsWith('http')) {
        logger.info(`Binary buffer unavailable, falling back to direct URL: ${directUrl}`);
        return {
          s3Key: null,
          fileUrl: directUrl,
          mimeType: mimeType || 'image/jpeg',
          fileSize: null,
          success: true,
        };
      }
      logger.warn(`Could not fetch binary buffer for media ID: ${imagePayload.id || 'N/A'}`);
      return { s3Key: null, fileUrl: null, mimeType: mimeType || 'image/jpeg', error: 'DOWNLOAD_FAILED' };
    }

    // MIME type resolution from buffer magic numbers if missing or non-standard
    if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'binary/octet-stream' || !ALLOWED_IMAGE_MIMES.includes(mimeType)) {
      if (buffer[0] === 0xff && buffer[1] === 0xd8) mimeType = 'image/jpeg';
      else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) mimeType = 'image/png';
      else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    // 1. Strict MIME type validation with safe fallback
    if (!ALLOWED_IMAGE_MIMES.includes(mimeType)) {
      mimeType = 'image/jpeg';
    }

    // 2. Strict File Size validation
    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      const err = new Error(`Image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB.`);
      err.code = 'FILE_TOO_LARGE';
      err.fileSize = buffer.length;
      throw err;
    }

    const fileExt = mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : '.jpg';
    const filename = `${crypto.randomUUID()}${fileExt}`;
    const s3Key = `uploads/whatsapp-media/${year}/${month}/${filename}`;

    // 3. Upload to AWS S3 bucket
    let uploadRes = null;
    try {
      uploadRes = await s3Service.uploadBuffer({
        buffer,
        key: s3Key,
        contentType: mimeType,
        metadata: {
          originalMediaId: String(imagePayload.id || ''),
          uploadedAt: new Date().toISOString(),
        },
      });
    } catch (s3Err) {
      logger.error('Failed to upload media buffer to AWS S3, saving locally:', s3Err.message);
    }

    // 4. Save local disk cache/backup
    const filePath = path.join(uploadBase, filename);
    try {
      fs.writeFileSync(filePath, buffer);
    } catch (fsErr) {
      logger.warn('Failed to write local disk backup:', fsErr.message);
    }

    const relativeUrl = `/uploads/whatsapp-media/${year}/${month}/${filename}`;
    const isS3Success = Boolean(uploadRes && uploadRes.success && !uploadRes.isFallback);
    return {
      s3Key: isS3Success ? (uploadRes.key || s3Key) : null,
      fileUrl: isS3Success ? uploadRes.url : relativeUrl,
      mimeType,
      fileSize: buffer.length,
      success: true,
    };
  } catch (err) {
    logger.error('Failed to download & save inbound media:', err.message);
    throw err;
  }
};
exports.downloadAndSaveMedia = downloadAndSaveMedia;

// ─── Template sender (outbound) ───────────────────────────────────────────────

const sendTemplate = async ({
  to, templateName, languageCode = 'en', components = [],
  orderId = null, customerId = null, batchId = null, retryCount = 0, estimatedCost = 0.35,
}) => {
  const env = getEnv();
  const logEntry = await WhatsAppLog.create({
    phone_number: to,
    order_id: orderId,
    customer_id: customerId,
    batch_id: batchId,
    message_type: 'template',
    template_name: templateName,
    direction: 'outbound',
    status: 'queued',
    payload: { templateName, components },
    retry_count: retryCount || 0,
    estimated_cost: estimatedCost !== undefined ? estimatedCost : 0.35,
    actual_cost: null,
    cost_currency: 'INR',
  });

  try {
    let result;
    if (env.WHATSAPP_API_KEY && env.WHATSAPP_API_URL) {
      // Official AOC Portal / Vasify Schema
      const aocPayload = {
        from: cleanAocPhone(env.WHATSAPP_SENDER_NUMBER),
        campaignName: 'crm-order-system',
        to: cleanAocPhone(to),
        templateName,
        type: 'template',
      };

      const aocComponents = {};

      // 1. Header Media Component
      const headerComponent = components.find(c => c.type === 'header');
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
          const textParams = headerComponent.parameters.map(p => (p.text !== undefined ? String(p.text) : String(p)));
          aocComponents.header = { params: textParams };
        }
      }

      // 2. Body Component
      const bodyComponent = components.find(c => c.type === 'body');
      const params = bodyComponent?.parameters?.map(p => (p.text !== undefined ? String(p.text) : String(p))) || [];
      if (params.length > 0) {
        aocComponents.body = { params };
      } else {
        aocComponents.body = { params: [] };
      }

      // 3. Dynamic URL / Interactive Button Component
      const buttonComponent = components.find(c => c.type === 'button' || c.type === 'buttons');
      if (buttonComponent) {
        const btnParams = buttonComponent.parameters?.map(p => (p.text !== undefined ? String(p.text) : String(p))) || [];
        if (btnParams.length > 0) {
          aocComponents.buttons = { params: btnParams };
        }
      }

      if (Object.keys(aocComponents).length > 0) {
        aocPayload.components = aocComponents;
      }

      result = await sendRequest(aocPayload);
    } else {
      // Direct Meta Cloud API Format
      result = await sendRequest({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formatPhone(to),
        type: 'template',
        template: { name: templateName, language: { code: languageCode }, components },
      });
    }

    const waMessageId = result?.data?.[0]?.messageId || result?.messages?.[0]?.id || result?.id;
    await logEntry.update({ status: 'sent', wa_message_id: waMessageId, sent_at: new Date() });
    return { success: true, waMessageId, response: result };
  } catch (err) {
    const status = err.isEmergencyPause ? 'paused' : 'failed';
    await logEntry.update({ status, error_message: err.message, failed_at: new Date() });
    throw err;
  }
};

// ─── Interactive template with quick-reply buttons ───────────────────────────

const sendInteractive = async ({
  to, bodyText, buttons, orderId = null, customerId = null, templateName = 'interactive',
  batchId = null, retryCount = 0, estimatedCost = 0.35,
}) => {
  const logEntry = await WhatsAppLog.create({
    phone_number: to,
    order_id: orderId,
    customer_id: customerId,
    batch_id: batchId,
    message_type: 'interactive',
    template_name: templateName,
    direction: 'outbound',
    status: 'queued',
    payload: { bodyText, buttons },
    retry_count: retryCount || 0,
    estimated_cost: estimatedCost !== undefined ? estimatedCost : 0.35,
    actual_cost: null,
    cost_currency: 'INR',
  });

  try {
    const result = await sendRequest({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formatPhone(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b, i) => ({
            type: 'reply',
            reply: { id: b.id || `btn_${i}`, title: b.title.substring(0, 20) },
          })),
        },
      },
    });

    const waMessageId = result?.messages?.[0]?.id || result?.data?.[0]?.messageId;
    await logEntry.update({ status: 'sent', wa_message_id: waMessageId, sent_at: new Date() });
    return { success: true, waMessageId };
  } catch (err) {
    const status = err.isEmergencyPause ? 'paused' : 'failed';
    await logEntry.update({ status, error_message: err.message, failed_at: new Date() });
    throw err;
  }
};

// ─── Official Template Implementations (9-Stage Lifecycle) ───────────────────

async function getCustomerForOrder(order) {
  if (order.customer) return order.customer;
  if (order.customer_id) {
    try {
      const cust = await Customer.findByPk(order.customer_id);
      if (cust) {
        order.customer = cust;
        return cust;
      }
    } catch (e) {
      logger.warn(`Failed to lazy load customer for order ${order.id}: ${e.message}`);
    }
  }

  // Pre-delivery recipient fallback: use order-level contact data prior to delivery registration
  const phone = order.customer_phone || order.shipping_address?.ship_phone;
  if (phone || order.customer_name) {
    return {
      id: null,
      name: order.customer_name || order.shipping_address?.name || 'Valued Customer',
      phone: phone || null,
      whatsapp_number: phone || null,
      email: order.customer_email || order.shipping_address?.email || null,
      whatsapp_opt_in: true,
    };
  }
  return null;
}

/**
 * 1. Template 1: order_verification_interactive (4 params)
 * Initial Inbound Verification Message sent when an order is created/imported/updated.
 *
 * Params: [customerName, orderNumber, productName, productSku]
 * Buttons: [Yes, Confirm], [Send Screenshot], [Cancel Order]
 */
exports.sendProductVerificationTemplate = async (order, options = {}) => {
  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone;
  if (!phone) return null;

  const customerName = cust?.name || 'Valued Customer';
  const orderNumber  = order.order_number || String(order.id);
  const productName  = order.product_name || 'AquaBeat Water Purifier Premier';
  const productSku   = order.product_sku || 'AKU-WTR-PREM-01';

  const res = await sendTemplate({
    to: phone,
    templateName: 'order_verification_interactive',
    orderId: order.id,
    customerId: order.customer_id,
    batchId: options.batchId || null,
    retryCount: options.retryCount || 0,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNumber },
        { type: 'text', text: productName },
        { type: 'text', text: productSku },
      ],
    }],
  });

  await order.update({
    verification_status: 'pending_verification',
    flow_stage: order.flow_stage || 'ask_images',
    whatsapp_confirmation_sent: true,
    confirmation_sent_at: new Date(),
    confirmation_message_sent_at: new Date(),
    workflow_state: 'PENDING_VERIFICATION',
    message_1_id: res?.waMessageId || null,
    ...(options.batchId && { whatsapp_batch_id: options.batchId }),
  });

  return res;
};

/**
 * Template: screenshot_from_customer (0 params)
 * Fired immediately when the customer clicks [Send Screenshot] on Message 1 (order_verification_interactive).
 * Prompts the buyer to reply with a photo of their kitchen tap / water purifier.
 * Approved WhatsApp template in AOC / Meta has 0 body parameters.
 */
exports.sendScreenshotRequestMessage = async (order) => {
  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone || order.customer_phone || order.shipping_address?.ship_phone;
  if (!phone) return null;

  try {
    return await sendTemplate({
      to: phone,
      templateName: 'screenshot_from_customer',
      orderId: order.id,
      customerId: order.customer_id,
      components: [],
    });
  } catch (tmplErr) {
    logger.warn(`Template screenshot_from_customer send failed (${tmplErr.message}). Dispatching prompt fallback text message.`);
    const custName = cust?.name || order.customer_name || 'Valued Customer';
    const fallbackText = `Hi ${custName} 👋 Please send a clear photo of your kitchen tap / water purifier location here. Our technical team will verify the fitting for Order #${order.order_number || ''}.`;
    return await exports.sendMessage({
      phone,
      message: fallbackText,
      orderId: order.id,
      customerId: order.customer_id,
    });
  }
};
exports.sendScreenshotFromCustomer = exports.sendScreenshotRequestMessage;

/**
 * 2. Template 2: order_confirmation013 (6 params)
 * Second Verification Message dispatched 15 minutes after customer clicks 'Send Screenshot' / uploads a photo.
 *
 * Params: [customerName, orderNumber, productName, productSku, quantityStr, amountStr]
 * Buttons: [Confirm Order], [Cancel Order]
 */
exports.sendProductMatchedVerificationMessage = async (order, options = {}) => {
  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone;
  if (!phone) return null;

  const customerName = cust?.name || 'Valued Customer';
  const orderNumber  = order.order_number || String(order.id);
  const productName  = order.product_name || 'AquaBeat Purifier';
  const productSku   = order.product_sku || 'AKU-WTR-PREM-01';
  const quantityStr  = String(order.quantity || 1);
  const amountStr    = order.total_amount ? String(order.total_amount) : '0';

  const res = await sendTemplate({
    to: phone,
    templateName: 'order_confirmation013',
    orderId: order.id,
    customerId: order.customer_id,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNumber },
        { type: 'text', text: productName },
        { type: 'text', text: productSku },
        { type: 'text', text: quantityStr },
        { type: 'text', text: amountStr },
      ],
    }],
  });

  const finalTimeoutHours = options.finalTimeoutHours || 7;
  const finalDueAt = order.final_confirmation_due_at || new Date(Date.now() + finalTimeoutHours * 60 * 60 * 1000);

  await order.update({
    second_message_sent_at: new Date(),
    final_confirmation_due_at: finalDueAt,
    flow_stage: order.flow_stage === 'match_confirmed' ? order.flow_stage : 'match_pending',
    verification_status: order.verification_status === 'sku_matched' ? 'sku_matched' : 'pending_confirmation',
  });

  await OrderActivity.create({
    order_id: order.id,
    action: 'second_verification_message_sent',
    from_value: 'screenshot_requested',
    to_value: 'pending_confirmation',
    note: `Message 2 (order_confirmation013) dispatched. Final confirmation deadline set for ${finalDueAt.toISOString()} (${finalTimeoutHours}h window).`,
  });

  return res;
};

/**
 * 3. Template 3: order_confirmation (3 params)
 * Approved Utility Template for Confirmed / Verified Orders.
 *
 * Params: [customerName, orderNumber, productName]
 */
exports.sendOrderConfirmation = async (order) => {
  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone;
  if (!phone) return null;

  const customerName = cust?.name || 'Customer';
  const orderNumber  = order.order_number || String(order.id);
  const productName  = order.product_name || 'your ordered item';

  const res = await sendTemplate({
    to: phone,
    templateName: 'order_confirmation',
    orderId: order.id,
    customerId: order.customer_id,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNumber },
        { type: 'text', text: productName },
      ],
    }],
  });

  await order.update({
    confirmation_message_sent_at: new Date(),
    whatsapp_confirmation_sent: true,
  });

  return res;
};

/**
 * 4. Template 4: order_cancelled (3 params)
 * Approved Utility Template for Order Cancellation.
 *
 * Params: [customerName, orderNumber, productName]
 */
exports.sendOrderCancellation = async (order) => {
  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone;
  if (!phone) return null;

  const customerName = cust?.name || 'Customer';
  const orderNumber  = order.order_number || String(order.id);
  const productName  = order.product_name || 'your ordered item';

  return sendTemplate({
    to: phone,
    templateName: 'order_cancelled',
    orderId: order.id,
    customerId: order.customer_id,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNumber },
        { type: 'text', text: productName },
      ],
    }],
  });
};

/**
 * 5. Template 5: order_dispatched (4 params)
 * Approved Utility Template for Dispatch & Tracking Update.
 *
 * Params: [customerName, orderNumber, awbNumber, courier]
 */
exports.sendDispatchUpdate = async (order) => {
  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone;
  if (!phone) return null;

  const customerName = cust?.name || 'Customer';
  const orderNumber  = order.order_number || String(order.id);
  const awbNumber    = order.tracking_number || order.awb_code || 'N/A';
  const courier      = order.shipping_partner || 'our delivery partner';

  const res = await sendTemplate({
    to: phone,
    templateName: 'order_dispatched',
    orderId: order.id,
    customerId: order.customer_id,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNumber },
        { type: 'text', text: awbNumber },
        { type: 'text', text: courier },
      ],
    }],
  });

  await order.update({ whatsapp_dispatch_sent: true, dispatched_at: order.dispatched_at || new Date() });
  return res;
};

/**
 * 6. Template 6: order_deliverd (2 params)
 * Approved Utility Template for Delivery Notification.
 *
 * Params: [customerName, orderNumber]
 */
exports.sendDeliveryUpdate = async (order) => {
  if (!order.customer_id) {
    try {
      const { ensureCustomerOnDelivery } = require('../controllers/orderController');
      await ensureCustomerOnDelivery(order);
    } catch (custErr) {
      logger.warn(`Failed to auto-register customer on delivery for order ${order.id}: ${custErr.message}`);
    }
  }

  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone;
  if (!phone) return null;

  const customerName = cust?.name || 'Customer';
  const orderNumber  = order.order_number || String(order.id);

  try {
    const res = await sendTemplate({
      to: phone,
      templateName: 'order_deliverd',
      orderId: order.id,
      customerId: order.customer_id,
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },
          { type: 'text', text: orderNumber },
        ],
      }],
    });

    await order.update({ delivered_message_sent_at: new Date(), whatsapp_delivery_sent: true });

    // Step 1: Instantly after delivery message, dispatch installation_guide template (Section 27)
    try {
      await exports.sendInstallationGuide(order);
      logger.info(`[WhatsAppDelivery] Dispatched installation_guide for Order #${order.order_number}`);
    } catch (instErr) {
      logger.warn(`Failed to dispatch installation_guide for Order #${order.order_number}:`, instErr.message);
    }

    // Step 2: Dispatch warranty_claim template (Section 28)
    try {
      const { Warranty, Customer: CustModel } = require('../models');
      let warranty = await Warranty.findOne({
        where: { order_id: order.id },
        include: [{ model: CustModel, as: 'customer' }],
      });
      if (!warranty) {
        const { handleDeliveryEvent } = require('./warrantyService');
        warranty = await handleDeliveryEvent(order.id, { delivered_at: order.delivered_at || new Date() });
      }
      if (warranty) {
        const { generateActivationToken, getActivationUrl } = require('./warrantyTokenService');
        const token = generateActivationToken(warranty, 7);
        const activationUrl = getActivationUrl(token);

        await exports.sendWarrantyActivationMessage({
          warranty: {
            ...(warranty.toJSON ? warranty.toJSON() : warranty),
            customer: cust,
            order,
          },
          token,
          activationUrl,
          idempotencyKey: `warranty_claim_${warranty.id}`,
        });

        if (warranty.update) {
          await warranty.update({
            warranty_status: 'ACTIVATION_MESSAGE_SENT',
            activation_sent_at: new Date(),
          }).catch(() => {});
        }
        logger.info(`[WhatsAppDelivery] Instantly dispatched warranty_claim after order_deliverd for Order #${order.order_number}`);
      }
    } catch (claimErr) {
      logger.warn(`Failed to dispatch instant warranty_claim for Order #${order.order_number}:`, claimErr.message);
    }

    return res;
  } catch (err) {
    logger.warn(`Failed to send order_deliverd template: ${err.message}`);
    return null;
  }
};

/**
 * 7. Template 7: installation_guide (3 params)
 * Approved Utility Template for Product Installation Instructions.
 *
 * Params: [customerName, orderNumber, installationGuideUrl]
 * Buttons: [Yes, Need Help], [All Good, Done!]
 */
exports.sendInstallationGuide = async (order) => {
  const cust = await getCustomerForOrder(order);
  const phone = cust?.whatsapp_number || cust?.phone;
  if (!phone) return null;

  const customerName = cust?.name || 'Valued Customer';
  const orderNumber  = order.order_number || String(order.id);
  const guideUrl     = order.installation_guide_url || process.env.INSTALLATION_GUIDE_URL || 'https://akuabeat.com/installation-guide';

  return sendTemplate({
    to: phone,
    templateName: 'installation_guide',
    orderId: order.id,
    customerId: order.customer_id,
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: orderNumber },
        { type: 'text', text: guideUrl },
      ],
    }],
  });
};

/**
 * Send freeform text WhatsApp message (e.g. alerts, auto-replies, dispatch notifications)
 */
const sendMessage = async ({ phone, message, orderId = null, customerId = null, batchId = null, retryCount = 0, estimatedCost = 0.35 }) => {
  const env = getEnv();
  const logEntry = await WhatsAppLog.create({
    phone_number: phone,
    order_id: orderId,
    customer_id: customerId,
    batch_id: batchId,
    message_type: 'text',
    direction: 'outbound',
    status: 'queued',
    payload: { message },
    retry_count: retryCount || 0,
    estimated_cost: estimatedCost !== undefined ? estimatedCost : 0.35,
    actual_cost: null,
    cost_currency: 'INR',
  });

  try {
    let result;
    if (env.WHATSAPP_API_KEY && env.WHATSAPP_API_URL) {
      result = await sendRequest({
        from: cleanAocPhone(env.WHATSAPP_SENDER_NUMBER),
        campaignName: 'crm-order-system',
        to: cleanAocPhone(phone),
        type: 'text',
        text: { body: message },
      });
    } else {
      result = await sendRequest({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formatPhone(phone),
        type: 'text',
        text: { preview_url: false, body: message },
      });
    }

    const waMessageId = result?.data?.[0]?.messageId || result?.messages?.[0]?.id || result?.id;
    await logEntry.update({ status: 'sent', wa_message_id: waMessageId, sent_at: new Date() });
    return { success: true, waMessageId, response: result };
  } catch (err) {
    const status = err.isEmergencyPause ? 'paused' : 'failed';
    await logEntry.update({ status, error_message: err.message, failed_at: new Date() });
    logger.warn(`Failed to send WhatsApp text message to ${phone}: ${err.message}`);
    return { success: false, error: err.message };
  }
};
exports.sendMessage = sendMessage;

/**
 * 8. Template 8: warranty_claim (3 params)
 * Approved Marketing/Utility Template for 24-Hour Post-Delivery Warranty Claim.
 *
 * Params: [customerName, productName, orderNumber]
 */
exports.sendWarrantyActivationMessage = async ({
  warranty,
  token,
  activationUrl,
  idempotencyKey,
}) => {
  const phone = warranty.customer?.whatsapp_number || warranty.customer?.phone;
  if (!phone) {
    throw new Error(`Customer has no valid phone number for Warranty ${warranty.warranty_number}`);
  }

  const customerName = warranty.customer?.name || 'Valued Customer';
  const productName  = warranty.product_name_snapshot || 'AkuaBeat Water Purifier';
  const orderNumber  = warranty.order?.order_number || String(warranty.order_id || 'N/A');

  const brandUrl = process.env.AKUABEAT_WEBSITE_URL || process.env.PUBLIC_WEBSITE_URL || 'https://akuabeat.com';
  const cleanBase = brandUrl.replace(/\/$/, '');
  const targetActivationUrl = activationUrl || `${cleanBase}/warranty?order_id=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(token || '')}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(targetActivationUrl)}`;

  const components = [
    {
      type: 'header',
      image: {
        link: qrCodeUrl,
      },
    },
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: productName },
        { type: 'text', text: orderNumber },
      ],
    },
    {
      type: 'buttons',
      parameters: [
        { type: 'text', text: token || 'activate' },
      ],
    },
  ];

  const stableKey = (idempotencyKey && !idempotencyKey.includes(String(Date.now()).slice(0, 5)))
    ? idempotencyKey
    : `warranty_claim_${warranty.id}`;

  const whatsappOutboxQueue = require('./whatsappOutboxQueue');
  const outboxRes = await whatsappOutboxQueue.enqueue({
    order_id: warranty.order_id || null,
    customer_id: warranty.customer_id || null,
    recipient_phone: phone,
    template_name: 'warranty_claim',
    payload: {
      customer_name: customerName,
      product_name: productName,
      order_number: orderNumber,
      warranty_number: warranty.warranty_number,
      activation_url: targetActivationUrl,
      components,
    },
    idempotency_key: stableKey,
  });
  await whatsappOutboxQueue.drainQueue().catch(() => {});
  return outboxRes;
};

/**
 * 9. Template 9: warranty_activated1 (Header 1 param - Dear{{1}}, Category: utility)
 * Approved Vasify Tech / Meta Utility Template dispatched immediately when customer submits warranty registration form.
 *
 * Header: Dear{{1}} -> {{customerName}}
 * Body: "Your product warranty is now active. ✅\n\nThank you for choosing us and trusting our products. We truly appreciate your support.\n\nFor any warranty-related assistance, please feel free to contact us.\n\nThank you! 🙏"
 */
exports.sendWarrantyActivatedConfirmation = async (warranty) => {
  let cust = warranty.customer;
  if (!cust && warranty.customer_id) {
    try {
      const { Customer } = require('../models');
      cust = await Customer.findByPk(warranty.customer_id);
    } catch (_) {}
  }
  if (!cust && warranty.order_id) {
    try {
      const { Order, Customer } = require('../models');
      const ord = await Order.findByPk(warranty.order_id, { include: [{ model: Customer, as: 'customer' }] });
      cust = ord?.customer;
    } catch (_) {}
  }

  const phone = cust?.whatsapp_number || cust?.phone || warranty.phone_number || warranty.mobile;
  if (!phone) return null;

  const customerName = cust?.name || warranty.customer_name || 'Valued Customer';
  const whatsappOutboxQueue = require('./whatsappOutboxQueue');

  const enq = await whatsappOutboxQueue.enqueue({
    order_id: warranty.order_id || null,
    customer_id: warranty.customer_id || cust?.id || null,
    recipient_phone: phone,
    template_name: 'warranty_activated',
    payload: {
      customer_name: customerName,
      warranty_number: warranty.warranty_number,
      product_name: warranty.product_name_snapshot,
      components: [
        {
          type: 'header',
          parameters: [
            { type: 'text', text: customerName },
          ],
        },
      ],
    },
    idempotency_key: `warranty_activated_${warranty.id}`,
  });
  await whatsappOutboxQueue.drainQueue().catch(() => {});
  return enq;
};

exports.sendOrderVerificationInteractive = exports.sendProductVerificationTemplate;
exports.send15MinConfirmation = exports.sendProductMatchedVerificationMessage;
exports.sendOrderCancelled = exports.sendOrderCancellation;
exports.sendOrderDispatched = exports.sendDispatchUpdate;
exports.sendOrderDelivered = exports.sendDeliveryUpdate;
exports.sendImageRequest = exports.sendProductVerificationTemplate;
exports.sendOrderCancellationThankYou = exports.sendOrderCancellation;
exports.sendSecondConfirmationMessage = exports.sendProductMatchedVerificationMessage;
exports.sendTemplate = sendTemplate;
exports.sendInteractive = sendInteractive;

// ─── Webhook Engine (AOC & Meta Normalizer) ───────────────────────────────────

/**
 * Robust helper to extract customer phone from varied WhatsApp webhook payloads (AOC, Meta Cloud API, etc.)
 * Actively filters out business account sender numbers (+919930386406) so the customer's phone is correctly identified.
 */
const extractSenderPhone = (body = {}, msg = {}) => {
  const env = getEnv();
  const companyNumbers = [
    env.WHATSAPP_SENDER_NUMBER,
    env.WHATSAPP_PHONE_NUMBER_ID,
    '919930386406',
    '+919930386406',
  ].filter(Boolean).map(n => String(n).replace(/\D/g, ''));

  const candidates = [];

  // 1. Contacts structure (handles both array and object formats)
  if (body.contacts) {
    if (Array.isArray(body.contacts)) {
      for (const c of body.contacts) {
        if (c.recipient) candidates.push(c.recipient);
        if (c.wa_id) candidates.push(c.wa_id);
        if (c.phone) candidates.push(c.phone);
      }
    } else if (typeof body.contacts === 'object') {
      if (body.contacts.recipient) candidates.push(body.contacts.recipient);
      if (body.contacts.wa_id) candidates.push(body.contacts.wa_id);
      if (body.contacts.phone) candidates.push(body.contacts.phone);
    }
  }

  // 2. Meta entry changes contacts / messages
  const metaContact = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
  if (metaContact?.wa_id) candidates.push(metaContact.wa_id);
  const metaMsg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (metaMsg?.from) candidates.push(metaMsg.from);

  // 3. Message object fields
  if (msg.from) candidates.push(msg.from);
  if (msg.sender) candidates.push(msg.sender);
  if (msg.mobile) candidates.push(msg.mobile);
  if (msg.phone) candidates.push(msg.phone);
  if (msg.wa_id) candidates.push(msg.wa_id);
  if (msg.recipient) candidates.push(msg.recipient);

  // 4. Body object fields
  if (body.sender) candidates.push(body.sender);
  if (body.mobile) candidates.push(body.mobile);
  if (body.phone) candidates.push(body.phone);
  if (body.wa_id) candidates.push(body.wa_id);

  // 5. Fallback fields
  if (body.recipient) candidates.push(body.recipient);
  if (body.from) candidates.push(body.from);
  if (body.to) candidates.push(body.to);

  // Pick first candidate with >= 10 digits that is NOT the company business sender number
  for (const cand of candidates) {
    if (!cand) continue;
    const clean = String(cand).replace(/\D/g, '');
    if (clean.length >= 10 && !companyNumbers.includes(clean)) {
      return String(cand).trim();
    }
  }

  // Fallback: pick any non-empty candidate
  for (const cand of candidates) {
    if (cand && String(cand).trim().length > 0) {
      return String(cand).trim();
    }
  }

  return '';
};

/**
 * Robustly resolves the active or most recent relevant order for an inbound interaction,
 * searching across UUID, order number, customer ID, customer phone, and shipping address JSON.
 */
const resolveOrderForSender = async ({ order, customer, senderPhone, payloadText }) => {
  if (order) return order;

  // 1. Check for UUID or Order Number pattern in payload
  if (payloadText) {
    const uuidMatch = String(payloadText).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const ordNumMatch = String(payloadText).match(/ORD-[A-Z0-9-]+/i);
    if (uuidMatch) {
      const ord = await Order.findByPk(uuidMatch[0], { include: [{ model: Customer, as: 'customer' }] });
      if (ord) return ord;
    } else if (ordNumMatch) {
      const ord = await Order.findOne({ where: { order_number: ordNumMatch[0] }, include: [{ model: Customer, as: 'customer' }] });
      if (ord) return ord;
    }
  }

  // 2. Delegate to Workflow Service disambiguation
  if (senderPhone || customer || payloadText) {
    try {
      const res = await OrderVerificationWorkflowService.resolveActiveOrderForCustomer({
        customer,
        phone: senderPhone,
        payloadText,
      });
      if (res?.order) return res.order;
    } catch (_) {}
  }

  // 3. Direct DB lookup across customer_phone and shipping_address JSON
  if (senderPhone) {
    const cleanDigits = String(senderPhone).replace(/\D/g, '');
    const last10 = cleanDigits.slice(-10);
    if (last10 && last10.length >= 7) {
      try {
        const { sequelize } = require('../config/database');
        // A. Priority: Orders actively awaiting verification/images
        let found = await Order.findOne({
          where: {
            [Op.or]: [
              { customer_phone: { [Op.like]: `%${last10}%` } },
              sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.ship_phone')) LIKE '%${last10}%'`),
              sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.phone')) LIKE '%${last10}%'`),
            ],
            status: { [Op.in]: ['pending', 'pending_verification', 'image_verification', 'pending_confirmation'] },
          },
          order: [
            ['confirmation_message_sent_at', 'DESC'],
            ['updated_at', 'DESC'],
            ['created_at', 'DESC'],
          ],
          include: [{ model: Customer, as: 'customer' }],
        });

        // B. Fallback: Any recent order for this phone
        if (!found) {
          found = await Order.findOne({
            where: {
              [Op.or]: [
                { customer_phone: { [Op.like]: `%${last10}%` } },
                sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.ship_phone')) LIKE '%${last10}%'`),
                sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.phone')) LIKE '%${last10}%'`),
              ],
            },
            order: [
              ['updated_at', 'DESC'],
              ['created_at', 'DESC'],
            ],
            include: [{ model: Customer, as: 'customer' }],
          });
        }

        if (found) return found;
      } catch (_) {}
    }
  }

  // 4. Fallback by customer_id if known
  if (customer?.id) {
    try {
      const found = await Order.findOne({
        where: { customer_id: customer.id },
        order: [['created_at', 'DESC']],
        include: [{ model: Customer, as: 'customer' }],
      });
      if (found) return found;
    } catch (_) {}
  }

  return null;
};

exports.handleWebhook = async (body) => {
  try {
    if (!body) return;

    const metaStatuses = body.entry?.[0]?.changes?.[0]?.value?.statuses;
    const aocStatuses  = body.statuses || body.data?.statuses;
    let statuses = [];
    if (Array.isArray(metaStatuses) && metaStatuses.length > 0) {
      statuses = metaStatuses;
    } else if (Array.isArray(aocStatuses)) {
      statuses = aocStatuses;
    } else if (aocStatuses && typeof aocStatuses === 'object') {
      statuses = [{
        ...aocStatuses,
        messageId: aocStatuses.messageId || aocStatuses.id || body.messageId || body.id,
        id: aocStatuses.id || aocStatuses.messageId || body.messageId || body.id,
        status: aocStatuses.status || body.status,
      }];
    } else if (body.event === 'status_update' || body.event === 'message_status' || body.event === 'status_failed' || (body.status && (body.id || body.messageId || body.wa_message_id))) {
      statuses = [body];
    }

    if (statuses.length > 0) {
      for (const st of statuses) {
        const waMsgId = st.id || st.messageId || st.wa_message_id;
        if (!waMsgId) continue;
        const rawStatus = (st.status || '').toLowerCase();
        const eventTime = st.timestamp
          ? new Date(parseInt(st.timestamp, 10) * (String(st.timestamp).length === 10 ? 1000 : 1))
          : new Date();

        const baseWaMsgId = String(waMsgId).split(':')[0];
        const log = await WhatsAppLog.findOne({
          where: {
            [Op.or]: [
              { wa_message_id: waMsgId },
              { wa_message_id: `${baseWaMsgId}:1` },
              { wa_message_id: baseWaMsgId },
              { wa_message_id: { [Op.like]: `${baseWaMsgId}%` } },
            ],
          },
        });
        if (log) {
          const updateFields = {};
          // Idempotent state machine:
          // Progression: queued -> sent -> delivered -> read.
          // 'failed' is terminal unless already delivered/read.
          if (rawStatus === 'delivered') {
            if (log.status !== 'read') {
              updateFields.status = 'delivered';
            }
            if (!log.delivered_at) updateFields.delivered_at = eventTime;
          } else if (rawStatus === 'read') {
            updateFields.status = 'read';
            if (!log.read_at) updateFields.read_at = eventTime;
            if (!log.delivered_at) updateFields.delivered_at = eventTime;
          } else if (rawStatus === 'sent') {
            if (log.status === 'queued') {
              updateFields.status = 'sent';
            }
            if (!log.sent_at) updateFields.sent_at = eventTime;
          } else if (rawStatus === 'failed') {
            if (log.status !== 'delivered' && log.status !== 'read') {
              updateFields.status = 'failed';
            }
            if (!log.failed_at) updateFields.failed_at = eventTime;
            const errObj = st.errors?.[0] || st.error;
            if (errObj) {
              updateFields.error_message = `${errObj.title || errObj.message || 'Delivery failed'} (code: ${errObj.code || 'N/A'})`;
            }
          }

          if (Object.keys(updateFields).length > 0) {
            await log.update(updateFields);
            logger.info(`Updated WhatsAppLog ${log.id} status to ${updateFields.status || log.status} from webhook.`);
            if (log.batch_id) {
              try {
                const whatsappBatchService = require('./whatsappBatchService');
                await whatsappBatchService.updateBatchProgress(log.batch_id);
              } catch (_) {}
            }
          }
        }
      }
    }

    // 1. Extract messages from either Meta nested format or AOC flat format
    const metaMessages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    const aocMessages  = body.messages || body.data?.messages || (body.message && typeof body.message === 'object' ? [body.message] : null);
    
    let messages = [];
    const isStatusPayload = statuses.length > 0 || body.event === 'message_status' || body.event === 'status_update' || body.event === 'status_failed';
    if (Array.isArray(metaMessages) && metaMessages.length > 0) {
      messages = metaMessages;
    } else if (Array.isArray(aocMessages)) {
      messages = aocMessages;
    } else if (aocMessages && typeof aocMessages === 'object') {
      messages = [aocMessages];
    } else if (!isStatusPayload && (body.type || body.image || body.interactive || body.text || body.button_reply || body.media || body.mediaUrl || body.data?.media || body.data?.image || body.from || body.sender || body.mobile)) {
      // Direct root message payload
      messages = [body];
    }

    for (const msg of messages) {
      // Intelligently extract customer's phone, filtering out company sender numbers
      const senderPhone = extractSenderPhone(body, msg);
      const phoneVariants = normalizePhoneForMatch(senderPhone);
      let rawMsgType = msg.type || body.type || (msg.image ? 'image' : (msg.text ? 'text' : (msg.button || msg.button_reply ? 'interactive' : 'text')));
      const msgType = String(rawMsgType).toLowerCase().trim() === 'button' ? 'interactive' : String(rawMsgType).toLowerCase().trim();
      const msgId = msg.id || msg.messageId || body.messageId || msg.wa_message_id || `wa_${Date.now()}`;

      // Idempotency check: Skip duplicate webhook delivery
      if (msgId) {
        const existingLog = await WhatsAppLog.findOne({ where: { wa_message_id: msgId } });
        const existingImg = await CustomerImage.findOne({ where: { wa_message_id: msgId } });
        if (existingLog || existingImg) {
          logger.warn(`Duplicate webhook message received (${msgId}). Skipping duplicate processing.`);
          continue;
        }
      }

      await WhatsAppLog.create({
        phone_number: senderPhone || 'unknown',
        direction: 'inbound',
        message_type: msgType,
        status: 'delivered',
        wa_message_id: msgId,
        payload: body,
        sent_at: msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * (String(msg.timestamp).length === 10 ? 1000 : 1)) : new Date(),
      });

      logger.info(`Inbound WhatsApp message from ${senderPhone}: type=${msgType}`);

      // Locate customer in DB
      let customer = await Customer.findOne({
        where: {
          [Op.or]: [
            { whatsapp_number: { [Op.in]: phoneVariants } },
            { phone: { [Op.in]: phoneVariants } },
          ],
        },
      });

      // Locate latest relevant order for customer or phone
      let order = null;

      // 1. Check if payload directly references an order by UUID or Order Number
      const payloadStr = JSON.stringify(body || {});
      const uuidMatch = payloadStr.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const ordNumMatch = payloadStr.match(/ORD-[A-Z0-9-]+/i);

      if (uuidMatch) {
        order = await Order.findByPk(uuidMatch[0], {
          include: [{ model: Customer, as: 'customer' }],
        });
      } else if (ordNumMatch) {
        order = await Order.findOne({
          where: { order_number: ordNumMatch[0] },
          include: [{ model: Customer, as: 'customer' }],
        });
      }

      // 2. Disambiguated Order Resolution via resolveOrderForSender
      if (!order) {
        order = await resolveOrderForSender({
          order,
          customer,
          senderPhone,
          payloadText: payloadStr,
        });
        if (order && !customer) {
          customer = order.customer;
        }
      }

      // ── Handle Inbound Screenshot / Image ──────────────────────────────────
      const hasImage = msgType === 'image' || msg.image || body.image || msg.media || body.media || body.data?.image || body.data?.media || body.mediaUrl || body.media_url || (msg.document && (msg.document.mime_type || '').startsWith('image/'));
      if (hasImage) {
        try {
          const rawImage = msg.image || body.image || msg.media || body.media || body.data?.image || body.data?.media || msg.document || msg;
          const isImageStr = typeof rawImage === 'string' && /^https?:\/\//i.test(rawImage);
          const imageObj = {
            id: isImageStr ? null : (rawImage.id || rawImage.media_id || rawImage.mediaId || body.mediaId || body.media_id),
            url: isImageStr ? rawImage : (rawImage.url || rawImage.file_url || rawImage.link || rawImage.media_url || rawImage.downloadUrl || rawImage.mediaUrl || body.mediaUrl || body.media_url || rawImage.fileUrl),
            mime_type: isImageStr ? '' : (rawImage.mime_type || rawImage.mimetype || rawImage.contentType || ''),
            caption: isImageStr ? '' : (rawImage.caption || msg.text || body.text || ''),
            buffer: isImageStr ? null : rawImage.buffer,
          };

          // Active fallback resolution for inbound image if order is not already determined
          if (!order) {
            order = await resolveOrderForSender({
              order: null,
              customer,
              senderPhone,
              payloadText: imageObj.caption,
            });
            if (order && !customer) customer = order.customer;
          }

          // Log when image arrives but order can't be linked — helps diagnose phone number mismatches
          if (!order) {
            logger.warn(
              `[WEBHOOK] Inbound image received from ${senderPhone} but NO ORDER found to link it to. ` +
              `Customer found: ${customer ? `Yes (ID: ${customer.id})` : 'No'}. ` +
              `Phone variants tried: ${JSON.stringify(phoneVariants)}. ` +
              `Image will be saved unlinked (order_id = null). ` +
              `To fix: ensure customer phone number in DB exactly matches the sender number.`
            );
          }

          const { s3Key, fileUrl, mimeType, fileSize } = await downloadAndSaveMedia(imageObj);

          const customerImage = await CustomerImage.create({
            order_id:     order?.id || null,
            customer_id:  customer?.id || order?.customer_id || null,
            wa_message_id: msgId,
            media_id:     imageObj.id || null,
            s3_key:       s3Key || null,
            file_url:     fileUrl || imageObj.url || null,
            mime_type:    mimeType,
            file_size:    fileSize || null,
            image_type:   'tap_photo',
            status:       'received',
            uploaded_at:  new Date(),
          });

          if (order) {
            await OrderVerificationWorkflowService.handleScreenshotReceived({
              orderId: order.id,
              customerId: customer?.id || order.customer_id,
              customerImageId: customerImage.id,
              waMessageId: msgId,
              actor: 'customer_whatsapp',
              phone: senderPhone,
            });

            // Automatically send photo receipt acknowledgment to the customer
            try {
              const custName = customer?.name || order.customer?.name || 'Valued Customer';
              const imgAck = `Hi ${custName} ✅ We have received your tap/purifier photo for Order #${order.order_number}!\n\nOur technical team is reviewing compatibility now. You will receive an update in a few minutes.`;
              await exports.sendMessage({
                phone: senderPhone,
                message: imgAck,
                orderId: order.id,
                customerId: customer?.id || null,
              });
              logger.info(`Dispatched photo receipt acknowledgment to ${senderPhone} for Order #${order.order_number}.`);
            } catch (ackErr) {
              logger.warn(`Failed to dispatch photo receipt acknowledgment: ${ackErr.message}`);
            }
          } else {
            await OrderVerificationWorkflowService.handleScreenshotReceived({
              orderId: null,
              customerId: customer?.id || null,
              customerImageId: customerImage.id,
              waMessageId: msgId,
              actor: 'customer_whatsapp',
              phone: senderPhone,
            });
            logger.info(`Customer WhatsApp image saved without order binding (customer: ${customer?.id || 'unknown'}).`);
            try {
              const custName = customer?.name || 'Valued Customer';
              const imgAck = `Hi ${custName} ✅ We have received your photo. If this is regarding an existing order, please reply with your Order Number so our team can link and verify it immediately!`;
              await exports.sendMessage({
                phone: senderPhone,
                message: imgAck,
                orderId: null,
                customerId: customer?.id || null,
              });
            } catch (ackErr) {
              logger.warn(`Failed to dispatch unlinked photo acknowledgment: ${ackErr.message}`);
            }
          }
        } catch (imgErr) {
          logger.error('Error handling inbound customer screenshot:', imgErr.message);
        }
      }

      // ── Handle Interactive Quick-Reply Button Click ────────────────────────
      const replyObj = msg.button || msg.interactive?.button_reply || msg.interactive?.list_reply || msg.button_reply || body.button_reply;
      if (replyObj || msgType === 'interactive' || body.event === 'button_reply') {
        const rawId = (replyObj?.id || replyObj?.payload || body.buttonId || '').toLowerCase();
        const rawTitle = (replyObj?.title || replyObj?.text || body.buttonTitle || '').toLowerCase();
        const combinedText = `${rawId} ${rawTitle}`.trim();
        const buttonId = rawId || combinedText;
        logger.info(`WhatsApp Button Click from ${senderPhone}: id="${rawId}" title="${rawTitle}" combined="${combinedText}"`);

        // If button text contains an order UUID or order number, ensure we bind to that exact order
        const btnUuid = combinedText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        const btnOrdNum = combinedText.match(/ORD-[A-Z0-9-]+/i);
        if (btnUuid) {
          const matchedOrd = await Order.findByPk(btnUuid[0], { include: [{ model: Customer, as: 'customer' }] });
          if (matchedOrd) order = matchedOrd;
        } else if (btnOrdNum) {
          const matchedOrd = await Order.findOne({ where: { order_number: btnOrdNum[0] }, include: [{ model: Customer, as: 'customer' }] });
          if (matchedOrd) order = matchedOrd;
        }

        // Semantic analysis (text / title takes precedence over raw button ids)
        const isScreenshotSemantic = [
          'send_screenshot', 'send screenshot', 'screenshot', 'photo',
          'send photo', 'tap_photo', 'upload_photo', 'tap photo', 'image'
        ].some(k => combinedText.includes(k));

        const isNeedHelpSemantic = [
          'yes_need_help', 'need_help', 'yes, need help', 'yes need help',
          'yess, need help', 'yess need help', 'yes help', 'yess_need_help',
          'installation_help', 'install_help', 'help_needed', 'btn_need_help',
          'need assistance', 'assistance', 'technician'
        ].some(k => combinedText.includes(k));

        const isAllGoodDoneSemantic = [
          'all_good', 'all_good_done', 'all good', 'done', 'all good, done!',
          'no_help', 'no_need_help', 'second_option', 'installed', 'working fine'
        ].some(k => combinedText.includes(k));

        const isConfirmSemantic = [
          'yes_confirm', 'yes, confirm', 'yes confirm', 'yes_order',
          'confirm_order', 'confirm', 'confirm order', 'confirm product',
          'accept_alternate', 'accept', 'verify_order', 'product_ok'
        ].some(k => combinedText.includes(k));

        const isCancelSemantic = [
          'cancel_order', 'no_cancel', 'reject_alternate', 'cancel',
          'cancel order', 'reject', 'cancle', 'cancle order', 'cancle_order'
        ].some(k => combinedText.includes(k));

        // Determine context if only raw IDs (btn_0, btn_1, btn_2) provided without descriptive title
        const isInstallationContext = (order && (order.flow_stage === 'installation' || order.status === 'delivered')) ||
          (customer && customer.lifecycle_stage?.includes('installation'));

        let isScreenshot = isScreenshotSemantic;
        let isNeedHelp = !isScreenshot && isNeedHelpSemantic;
        let isAllGoodDone = !isScreenshot && isAllGoodDoneSemantic;
        let isConfirm = !isScreenshot && !isNeedHelp && isConfirmSemantic;
        let isCancel = !isScreenshot && isCancelSemantic;

        // Fallback for raw button IDs when title is empty or generic
        if (!isScreenshot && !isNeedHelp && !isAllGoodDone && !isConfirm && !isCancel) {
          if (isInstallationContext) {
            if (rawId === 'btn_0') isNeedHelp = true;
            else if (rawId === 'btn_1') isAllGoodDone = true;
          } else {
            // Default verification flow: btn_0 = Confirm, btn_1 = Screenshot, btn_2 = Cancel
            if (rawId === 'btn_0') isConfirm = true;
            else if (rawId === 'btn_1') isScreenshot = true;
            else if (rawId === 'btn_2') isCancel = true;
          }
        }

        // Deterministic Button Event Mapping (Sections 4, 12, 18, 20)
        const isConfirmBtn = rawId === 'order_confirm' || rawId === 'order_confirm_final' ||
          (rawId === 'btn_0' && !isInstallationContext) || isConfirmSemantic;
        
        const isScreenshotBtn = rawId === 'request_screenshot' || rawId === 'send_screenshot' ||
          (rawId === 'btn_1' && !isInstallationContext) || isScreenshotSemantic;
        
        const isCallRepBtn = rawId === 'call_representative' || rawId === 'call_rep' || rawId === 'representative' ||
          (rawId === 'btn_2' && !isInstallationContext && order?.workflow_state !== 'PENDING_CUSTOMER_CONFIRMATION' && order?.verification_status !== 'sku_matched') ||
          combinedText.includes('representative') || combinedText.includes('call rep') || combinedText.includes('agent') ||
          combinedText.includes('call representative') || combinedText.includes('callback') || combinedText.includes('call back');
        
        const isCancelBtn = rawId === 'order_cancel_final' || rawId === 'order_cancel' ||
          (!isCallRepBtn && (rawId === 'btn_2' && !isInstallationContext && (order?.workflow_state === 'PENDING_CUSTOMER_CONFIRMATION' || order?.verification_status === 'sku_matched' || order?.verification_status === 'pending_confirmation'))) ||
          isCancelSemantic;

        if (isScreenshotBtn) {
          if (!order) {
            order = await resolveOrderForSender({ order: null, customer, senderPhone, payloadText: combinedText });
            if (order && !customer) customer = order.customer;
          }
          if (order) {
            await OrderVerificationWorkflowService.handleScreenshotRequest({
              orderId: order.id,
              waMessageId: msgId,
              actor: 'customer_whatsapp',
            });
          } else {
            logger.warn(`Customer clicked [Send Screenshot] but no eligible order found for phone ${senderPhone}`);
          }
        } else if (isConfirmBtn) {
          if (!order) {
            order = await resolveOrderForSender({ order: null, customer, senderPhone, payloadText: combinedText });
            if (order && !customer) customer = order.customer;
          }
          if (order) {
            if (order.status === 'cancelled' || order.workflow_state === 'CANCELLED') {
              logger.warn(`Late customer button confirmation received for already CANCELLED Order #${order.order_number}. Order remains cancelled.`);
              await OrderActivity.create({
                order_id: order.id,
                action: 'late_response_received',
                from_value: 'cancelled',
                to_value: 'cancelled',
                note: `Late customer confirmation attempt received via WhatsApp button ("${rawTitle || rawId}") after order was already cancelled. No resurrection performed.`,
              });
            } else {
              await OrderVerificationWorkflowService.handleCustomerConfirm({
                orderId: order.id,
                waMessageId: msgId,
                actor: 'customer_whatsapp',
              });
            }
          } else {
            logger.warn(`Customer clicked [Confirm Order] but no eligible order found for phone ${senderPhone}`);
          }
        } else if (isCallRepBtn) {
          if (!order) {
            order = await resolveOrderForSender({ order: null, customer, senderPhone, payloadText: combinedText });
            if (order && !customer) customer = order.customer;
          }
          await OrderVerificationWorkflowService.handleRepresentativeRequest({
            orderId: order?.id || null,
            customerId: customer?.id || order?.customer_id || null,
            phone: senderPhone,
            waMessageId: msgId,
          });
        } else if (isCancelBtn) {
          if (!order) {
            order = await resolveOrderForSender({ order: null, customer, senderPhone, payloadText: combinedText });
            if (order && !customer) customer = order.customer;
          }
          if (order) {
            await OrderVerificationWorkflowService.handleCustomerCancel({
              orderId: order.id,
              waMessageId: msgId,
              actor: 'customer_whatsapp',
              reason: replyObj?.title || rawTitle || 'Customer cancelled via WhatsApp button',
            });
          } else {
            logger.warn(`Customer clicked [Cancel Order] but no eligible order found for phone ${senderPhone}`);
          }
        } else if (isNeedHelp) {
          logger.info(`Customer requested Installation Help via WhatsApp button from ${senderPhone}`);

          if (!order) {
            order = await resolveOrderForSender({ order: null, customer, senderPhone, payloadText: combinedText });
            if (order && !customer) customer = order.customer;
          }

          let repUser = null;
          try {
            repUser = await User.findOne({
              where: { role: { [Op.in]: ['telecaller', 'admin', 'super_admin'] } },
            });
          } catch (_) {}

          if (customer) {
            const timeFormatted = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            const orderRef = order?.order_number ? `Order #${order.order_number}` : 'Delivered Water Purifier';
            const prodRef = order?.product_name ? ` (${order.product_name})` : '';
            const newNote = `[Installation Help Requested] Customer clicked 'Yes, Need Help' via WhatsApp on ${timeFormatted} for ${orderRef}${prodRef}.`;

            let currentTags = Array.isArray(customer.tags) ? [...customer.tags] : [];
            if (!currentTags.includes('installation_help_requested')) {
              currentTags.push('installation_help_requested');
            }

            await customer.update({
              installation_help_requested: true,
              installation_help_requested_at: new Date(),
              installation_help_status: 'pending',
              lifecycle_stage: 'installation_pending',
              status: 'active',
              tags: currentTags,
              notes: customer.notes ? `${newNote}\n${customer.notes}` : newNote,
              last_contacted_at: new Date(),
            });

            // Create high-priority FollowUp for Telecaller
            try {
              await FollowUp.create({
                customer_id: customer.id,
                order_id: order?.id || null,
                assigned_to: repUser?.id || customer.id,
                type: 'call',
                priority: 'high',
                status: 'pending',
                subject: `Installation Assistance Needed: ${customer.name}`,
                notes: `Customer requested installation assistance via WhatsApp button for ${orderRef}.`,
                due_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // Due in 2 hours
              });
            } catch (fuErr) {
              logger.warn('Failed to auto-create installation FollowUp task:', fuErr.message);
            }
          }

          if (order) {
            await order.update({
              flow_stage: 'installation',
            });

            await OrderActivity.create({
              order_id: order.id,
              action: 'installation_help_requested',
              from_value: 'installation_guide_sent',
              to_value: 'installation_help_needed',
              note: 'Customer clicked [Yes, Need Help] on installation_guide WhatsApp message. Routed to Telecaller Lead Workbench.',
              metadata: {
                button_id: buttonId,
                sender_phone: senderPhone,
                timestamp: new Date().toISOString(),
              },
            });
          }

          try {
            const custName = customer?.name || 'Valued Customer';
            const ackText = `Hi ${custName} 🎉 We have received your request for installation assistance for your ${order?.product_name || 'Water Purifier'}. Our dedicated technical specialist will call you shortly to assist you or schedule a technician visit!`;
            await exports.sendMessage({
              phone: senderPhone,
              message: ackText,
              orderId: order?.id || null,
              customerId: customer?.id || null,
            });
          } catch (ackErr) {
            logger.warn('Failed to send installation help acknowledgment reply:', ackErr.message);
          }
        } else if (isAllGoodDone) {
          logger.info(`Customer confirmed installation complete ('All Good, Done!') from ${senderPhone}. Nothing more triggered.`);

          if (!order && customer) {
            order = await Order.findOne({
              where: { customer_id: customer.id },
              order: [['created_at', 'DESC']],
            });
          }

          if (customer) {
            await customer.update({
              installation_confirmed_at: new Date(),
              installation_help_requested: false,
              installation_help_status: 'resolved',
              lifecycle_stage: 'installation_done',
            });
          }

          if (order) {
            await order.update({
              flow_stage: 'completed',
            });

            await OrderActivity.create({
              order_id: order.id,
              action: 'installation_confirmed_done',
              from_value: 'installation',
              to_value: 'installation_done',
              note: 'Customer clicked [All Good, Done!] on WhatsApp. Recorded quietly — no outbound messages or escalations triggered.',
            });
          }
        }
      }

      // ── Handle Text Inbound Reply ──────────────────────────────────────────
      const rawTextBody = (typeof msg.text === 'string' ? msg.text : msg.text?.body) ||
                          msg.body || msg.message ||
                          (typeof body.text === 'string' ? body.text : body.text?.body) ||
                          body.message || '';

      // ── Handle Inbound Customer Text Reply ──────────────────────────────────
      if (!hasImage && !replyObj && rawTextBody && String(rawTextBody).trim().length > 0) {
        logger.info(
          `Inbound customer free-form text logged from ${senderPhone}: "${rawTextBody}". Order #${order?.order_number || 'N/A'}.`
        );
      }
    }
  } catch (err) {
    logger.error('WhatsApp webhook processing error:', err);
  }
};
