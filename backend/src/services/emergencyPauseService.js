'use strict';

const { SystemSetting, WhatsAppOutbox, WhatsAppLog, UserAuditLog } = require('../models');
const logger = require('../config/logger');

/**
 * Authoritative check: Is WhatsApp sending globally enabled?
 * Reads from the persistent `system_settings` table.
 * Adheres to the FAIL-CLOSED principle: if database query fails, defaults to false (paused).
 *
 * @returns {Promise<boolean>} true if sending is active, false if paused
 */
async function isWhatsAppSendingEnabled() {
  try {
    const setting = await SystemSetting.findOne({
      where: { key: 'WHATSAPP_SENDING_ENABLED' },
      paranoid: false,
    });

    if (setting && setting.value !== null && setting.value !== undefined) {
      return setting.value === 'true';
    }

    // Fallback/Legacy key check
    const legacySetting = await SystemSetting.findOne({
      where: { key: 'whatsapp_emergency_pause' },
      paranoid: false,
    });

    if (legacySetting && legacySetting.value !== null && legacySetting.value !== undefined) {
      return legacySetting.value !== 'true'; // if pause is 'true', enabled is false
    }

    // Default to true if not explicitly configured in fresh deployment
    return true;
  } catch (err) {
    logger.error('[EMERGENCY PAUSE SERVICE] Error checking sending state. FAILING CLOSED (disabling sending):', err);
    // Security & Safety Directive: Fail closed to prevent unwanted external sends during DB outages
    return false;
  }
}

/**
 * Legacy compatibility alias: returns true when emergency pause is active.
 * @returns {Promise<boolean>}
 */
async function isEmergencyPauseActive() {
  const enabled = await isWhatsAppSendingEnabled();
  return !enabled;
}

/**
 * Returns full status details including queue counts and metadata.
 */
async function getSendingStatus() {
  const enabled = await isWhatsAppSendingEnabled();
  const status = enabled ? 'ACTIVE' : 'PAUSED';

  let metadata = null;
  try {
    const metaRecord = await SystemSetting.findOne({ where: { key: 'whatsapp_pause_metadata' } });
    if (metaRecord && metaRecord.value) {
      metadata = JSON.parse(metaRecord.value);
    }
  } catch {
    metadata = null;
  }

  // Queue counts for operational visibility
  let outboxCounts = { pending: 0, processing: 0, paused: 0, sent: 0, failed: 0 };
  let logCounts = { queued: 0, paused: 0, sent: 0, delivered: 0, read: 0, failed: 0 };

  try {
    const [p, pr, pa, s, f] = await Promise.all([
      WhatsAppOutbox.count({ where: { status: 'pending' } }).catch(() => 0),
      WhatsAppOutbox.count({ where: { status: 'processing' } }).catch(() => 0),
      WhatsAppOutbox.count({ where: { status: 'paused' } }).catch(() => 0),
      WhatsAppOutbox.count({ where: { status: 'sent' } }).catch(() => 0),
      WhatsAppOutbox.count({ where: { status: 'failed' } }).catch(() => 0),
    ]);
    outboxCounts = { pending: p, processing: pr, paused: pa, sent: s, failed: f };

    const [lq, lpa, ls, ld, lr, lf] = await Promise.all([
      WhatsAppLog.count({ where: { status: 'queued' } }).catch(() => 0),
      WhatsAppLog.count({ where: { status: 'paused' } }).catch(() => 0),
      WhatsAppLog.count({ where: { status: 'sent' } }).catch(() => 0),
      WhatsAppLog.count({ where: { status: 'delivered' } }).catch(() => 0),
      WhatsAppLog.count({ where: { status: 'read' } }).catch(() => 0),
      WhatsAppLog.count({ where: { status: 'failed' } }).catch(() => 0),
    ]);
    logCounts = { queued: lq, paused: lpa, sent: ls, delivered: ld, read: lr, failed: lf };
  } catch (countErr) {
    logger.warn('[EMERGENCY PAUSE SERVICE] Error reading outbox counts:', countErr.message);
  }

  return {
    enabled,
    status,
    message: enabled
      ? 'WhatsApp sending is active.'
      : 'WhatsApp sending is globally paused. No new WhatsApp messages will be sent.',
    updated_at: metadata?.timestamp || null,
    updated_by: metadata?.initiated_by_email || 'system',
    reason: metadata?.reason || null,
    outbox_counts: outboxCounts,
    log_counts: logCounts,
  };
}

/**
 * Sets the authoritative WhatsApp sending state (enabled or paused).
 *
 * @param {Object} params
 * @param {boolean} params.enabled - true to enable sending, false to pause
 * @param {string} [params.actorUserId] - ID of user initiating change
 * @param {string} [params.initiatedByEmail] - Email of user initiating change
 * @param {string} [params.reason] - Explanation for pause or resume
 * @param {string} [params.ipAddress] - Request IP
 * @param {string} [params.userAgent] - Request User-Agent
 * @returns {Promise<{ enabled: boolean, status: string, message: string }>}
 */
async function setSendingState({
  enabled,
  actorUserId = null,
  initiatedByEmail = 'system',
  reason = null,
  ipAddress = null,
  userAgent = null,
}) {
  const previousEnabled = await isWhatsAppSendingEnabled();
  const activePause = !enabled;
  const newStatus = enabled ? 'ACTIVE' : 'PAUSED';
  const prevStatus = previousEnabled ? 'ACTIVE' : 'PAUSED';

  logger.warn(
    `[EMERGENCY PAUSE SERVICE] Transitioning WhatsApp Sending: ${prevStatus} -> ${newStatus} ` +
    `(Actor: ${initiatedByEmail} / ${actorUserId || 'N/A'}, Reason: "${reason || 'None provided'}")`
  );

  const timestamp = new Date().toISOString();
  const metadataPayload = {
    timestamp,
    actor_user_id: actorUserId,
    initiated_by_email: initiatedByEmail,
    reason: reason || (enabled ? 'Normal dispatch resumed' : 'Emergency pause activated'),
    previous_state: prevStatus,
    new_state: newStatus,
  };

  // 1. Persist state in database (clearing soft-deletes if present)
  const [setting1] = await SystemSetting.findOrCreate({
    where: { key: 'WHATSAPP_SENDING_ENABLED' },
    defaults: { key: 'WHATSAPP_SENDING_ENABLED', value: enabled ? 'true' : 'false' },
    paranoid: false,
  });
  await setting1.update({ value: enabled ? 'true' : 'false', deleted_at: null });

  const [setting2] = await SystemSetting.findOrCreate({
    where: { key: 'whatsapp_emergency_pause' },
    defaults: { key: 'whatsapp_emergency_pause', value: activePause ? 'true' : 'false' },
    paranoid: false,
  });
  await setting2.update({ value: activePause ? 'true' : 'false', deleted_at: null });

  const [setting3] = await SystemSetting.findOrCreate({
    where: { key: 'whatsapp_pause_metadata' },
    defaults: { key: 'whatsapp_pause_metadata', value: JSON.stringify(metadataPayload) },
    paranoid: false,
  });
  await setting3.update({ value: JSON.stringify(metadataPayload), deleted_at: null });

  // 2. Queue state management
  if (activePause) {
    // Transition all pending/processing outbox records to 'paused'
    // Critical: Do NOT delete queued messages or alter already-sent messages!
    const [outboxUpdated] = await WhatsAppOutbox.update(
      {
        status: 'paused',
        last_error: `Emergency pause activated by ${initiatedByEmail}: ${reason || 'Global pause'}`,
      },
      { where: { status: ['pending', 'processing'] } }
    );
    if (outboxUpdated > 0) {
      logger.info(`[EMERGENCY PAUSE SERVICE] Paused ${outboxUpdated} pending/processing outbox messages.`);
    }

    // Transition all queued WhatsAppLog records to 'paused'
    const [logsUpdated] = await WhatsAppLog.update(
      {
        status: 'paused',
        error_message: `Emergency pause activated by ${initiatedByEmail}: ${reason || 'Global pause'}`,
      },
      { where: { status: 'queued' } }
    );
    if (logsUpdated > 0) {
      logger.info(`[EMERGENCY PAUSE SERVICE] Paused ${logsUpdated} queued log entries.`);
    }
  } else {
    // Resuming: Transition previously 'paused' outbox records back to 'pending'
    const [outboxResumed] = await WhatsAppOutbox.update(
      {
        status: 'pending',
        last_error: null,
        next_attempt_at: new Date(),
      },
      { where: { status: 'paused' } }
    );
    if (outboxResumed > 0) {
      logger.info(`[EMERGENCY PAUSE SERVICE] Resumed ${outboxResumed} previously paused outbox messages to 'pending'.`);
    }

    // Transition previously 'paused' logs back to 'queued'
    const [logsResumed] = await WhatsAppLog.update(
      {
        status: 'queued',
        error_message: null,
      },
      { where: { status: 'paused' } }
    );
    if (logsResumed > 0) {
      logger.info(`[EMERGENCY PAUSE SERVICE] Resumed ${logsResumed} previously paused log entries to 'queued'.`);
    }
  }

  // 3. Record Audit Log in user_audit_logs
  try {
    await UserAuditLog.create({
      actor_user_id: actorUserId,
      event_type: enabled ? 'WHATSAPP_SENDING_RESUMED' : 'WHATSAPP_SENDING_PAUSED',
      module: 'whatsapp_settings',
      old_values: { enabled: previousEnabled, status: prevStatus },
      new_values: { enabled, status: newStatus, reason },
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (auditErr) {
    logger.error('[EMERGENCY PAUSE SERVICE] Failed to record user audit log:', auditErr);
  }

  // 4. Send Immediate Email Alert if Emergency Pause is Engaged
  if (activePause) {
    try {
      const emailService = require('./emailService');
      emailService.sendWhatsAppErrorAlert({
        errorType: 'GLOBAL_KILL_SWITCH_ENGAGED',
        message: `Global Emergency WhatsApp Kill Switch was ENGAGED by ${initiatedByEmail}: "${reason || 'No reason specified'}"`,
        details: {
          actor_user_id: actorUserId,
          initiated_by: initiatedByEmail,
          reason: reason || 'None provided',
          timestamp,
        },
      }).catch(() => {});
    } catch (_) {}
  }

  return {
    enabled,
    status: newStatus,
    message: enabled
      ? 'WhatsApp sending is active.'
      : 'WhatsApp sending is globally paused. No new WhatsApp messages will be sent.',
  };
}

/**
 * Legacy compatibility wrapper for setEmergencyPause
 */
async function setEmergencyPause(active, initiatedByEmail = 'system', reason = null, actorUserId = null) {
  return await setSendingState({
    enabled: !active,
    actorUserId,
    initiatedByEmail,
    reason,
  });
}

module.exports = {
  isWhatsAppSendingEnabled,
  isEmergencyPauseActive,
  getSendingStatus,
  setSendingState,
  setEmergencyPause,
};
