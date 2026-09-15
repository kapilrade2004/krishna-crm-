'use strict';

const crypto = require('crypto');

const TOKEN_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'khrisha-warranty-signing-key-2026';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generate a signed, expiring activation token for a warranty record.
 */
function generateActivationToken(warranty, expiresInDays = 7) {
  if (!warranty || !warranty.id) {
    throw new Error('Valid warranty record is required to generate activation token.');
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInDays * 24 * 60 * 60;

  const payload = {
    wid: String(warranty.id),
    cid: String(warranty.customer_id || ''),
    oid: String(warranty.order_id || ''),
    wn: String(warranty.warranty_number || ''),
    iat: now,
    exp,
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadString);

  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${encodedPayload}.${signature}`;
}

/**
 * Verify signed token validity and check expiration.
 */
function verifyActivationToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'No token provided' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Malformed token structure' };
  }

  const [encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Constant-time signature comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedSigBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)) {
    return { valid: false, reason: 'Invalid token signature' };
  }

  let payload;
  try {
    const jsonStr = base64UrlDecode(encodedPayload);
    payload = JSON.parse(jsonStr);
  } catch (err) {
    return { valid: false, reason: 'Invalid token payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return {
      valid: false,
      reason: 'Activation link has expired. Please request a new activation link from support.',
      isExpired: true,
      expiredAt: new Date(payload.exp * 1000),
      payload,
    };
  }

  return {
    valid: true,
    warrantyId: payload.wid,
    customerId: payload.cid,
    orderId: payload.oid,
    warrantyNumber: payload.wn,
    issuedAt: new Date(payload.iat * 1000),
    expiresAt: new Date(payload.exp * 1000),
    payload,
  };
}

/**
 * Build absolute public customer activation URL.
 */
function getActivationUrl(token) {
  const brandUrl = process.env.AKUABEAT_WEBSITE_URL || process.env.PUBLIC_WEBSITE_URL || 'https://akuabeat.com';
  const cleanBase = brandUrl.replace(/\/$/, '');
  return `${cleanBase}/warranty/activate/${token}`;
}

module.exports = {
  generateActivationToken,
  verifyActivationToken,
  getActivationUrl,
};
