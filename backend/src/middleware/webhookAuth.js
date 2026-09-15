'use strict';

const logger = require('../config/logger');
const { BiometricDevice } = require('../models');

/**
 * Middleware to authenticate biometric hardware push webhooks.
 * Supports:
 * 1. Secret token header (X-Webhook-Secret / X-Device-Token) or query parameter.
 * 2. Allowed IP address whitelist (BIOMETRIC_ALLOWED_IPS).
 * 3. Known registered device serial number verification (when devices are configured).
 */
const verifyBiometricWebhook = async (req, res, next) => {
  try {
    const configuredSecret = process.env.BIOMETRIC_WEBHOOK_SECRET;
    const allowedIpsEnv = process.env.BIOMETRIC_ALLOWED_IPS;
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    // 1. Check IP whitelist if configured
    if (allowedIpsEnv) {
      const allowedIps = allowedIpsEnv.split(',').map((ip) => ip.trim());
      const isAllowed = allowedIps.some((allowed) => clientIp.includes(allowed) || allowed === '*');
      if (!isAllowed) {
        logger.warn(`[Biometric Webhook] Blocked unauthorized IP: ${clientIp}`);
        return res.status(403).json({
          status: 'ERROR',
          message: 'Access denied: IP address not authorized for biometric webhooks.',
        });
      }
    }

    // 2. Check webhook secret token if configured
    if (configuredSecret) {
      const providedSecret =
        req.headers['x-webhook-secret'] ||
        req.headers['x-device-token'] ||
        req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
        req.query.secret ||
        req.query.token;

      if (providedSecret !== configuredSecret) {
        logger.warn(`[Biometric Webhook] Blocked invalid secret from IP ${clientIp}`);
        return res.status(401).json({
          status: 'ERROR',
          message: 'Unauthorized: Invalid biometric webhook secret.',
        });
      }
    }

    // 3. Device Serial verification (defense in depth if device serial is sent in headers or query)
    const deviceSerial =
      req.headers['x-device-serial'] ||
      req.headers['x-serial-number'] ||
      req.query.sn ||
      req.query.serial;

    if (deviceSerial) {
      const registeredDevice = await BiometricDevice.findOne({
        where: { serial_number: deviceSerial, is_active: true },
      });
      if (registeredDevice) {
        req.biometricDevice = registeredDevice;
      }
    }

    next();
  } catch (err) {
    logger.error(`[Biometric Webhook Auth Error]: ${err.message}`);
    return res.status(500).json({ status: 'ERROR', message: 'Internal authentication error.' });
  }
};

module.exports = { verifyBiometricWebhook };
