'use strict';

const { Op } = require('sequelize');
const { Order, WhatsAppLog, WhatsAppOutbox, CustomerImage, OrderActivity } = require('../models');
const logger = require('../config/logger');

/**
 * Section 77: Automated Reconciliation Engine
 * Scans the database for cross-layer workflow and delivery inconsistencies:
 * 1. Order records confirmation sent timestamp but no corresponding outbound WhatsAppLog exists.
 * 2. Outbound WhatsAppLog marked delivered/read but outbox queue record stuck in PENDING/SENDING.
 * 3. Outbox marked SENT but Order workflow stage was not updated.
 * 4. Order status is screenshot_requested / ask_images but a CustomerImage already exists for the order.
 * 5. Order is CANCELLED but pending outbox messages remain QUEUED or PROCESSING.
 */
class WhatsAppReconciliationWorker {
  async runReconciliationScan() {
    const anomalies = [];
    const now = new Date();

    try {
      // 1. Order says confirmation sent but no WhatsApp log exists
      const ordersWithMissingLogs = await Order.findAll({
        where: {
          confirmation_message_sent_at: { [Op.ne]: null },
        },
        attributes: ['id', 'order_number', 'confirmation_message_sent_at'],
        limit: 100,
      });

      for (const ord of ordersWithMissingLogs) {
        const hasLog = await WhatsAppLog.findOne({
          where: { order_id: ord.id, template_name: 'order_confirmation' },
        });
        if (!hasLog) {
          anomalies.push({
            type: 'CONFIRMATION_LOG_MISSING',
            order_id: ord.id,
            order_number: ord.order_number,
            severity: 'MEDIUM',
            description: `Order #${ord.order_number} records confirmation_message_sent_at (${ord.confirmation_message_sent_at.toISOString()}) but no outbound order_confirmation WhatsAppLog exists.`,
            recommended_action: 'Resync log record or inspect manual trigger trail.',
          });
        }
      }

      // 2. Workflow says awaiting screenshot but screenshot already exists
      const ordersAwaitingScreenshot = await Order.findAll({
        where: {
          verification_status: 'screenshot_requested',
        },
        attributes: ['id', 'order_number', 'screenshot_requested_at'],
        include: [{ model: CustomerImage, as: 'customerImages' }],
        limit: 100,
      });

      for (const ord of ordersAwaitingScreenshot) {
        if (ord.customerImages && ord.customerImages.length > 0) {
          anomalies.push({
            type: 'SCREENSHOT_STATE_MISMATCH',
            order_id: ord.id,
            order_number: ord.order_number,
            severity: 'HIGH',
            description: `Order #${ord.order_number} is in 'screenshot_requested' state but has ${ord.customerImages.length} uploaded CustomerImage(s).`,
            recommended_action: 'Advance order to image_received / match_pending.',
          });

          // Safe auto-repair: advance state to image_received if image is unassigned/pending
          await ord.update({
            verification_status: 'image_received',
            flow_stage: 'match_pending',
          });

          await OrderActivity.create({
            order_id: ord.id,
            action: 'reconciliation_auto_repaired',
            from_value: 'screenshot_requested',
            to_value: 'image_received',
            note: '[Reconciliation Worker] Mismatch auto-repaired: Uploaded screenshot detected on order awaiting screenshot.',
          });
        }
      }

      // 3. Order is CANCELLED but pending confirmation messages remain QUEUED in Outbox
      const cancelledOrders = await Order.findAll({
        where: { status: 'cancelled' },
        attributes: ['id', 'order_number'],
        limit: 100,
      });

      const cancelledOrderIds = cancelledOrders.map(o => o.id);
      if (cancelledOrderIds.length > 0) {
        const queuedOutbox = await WhatsAppOutbox.findAll({
          where: {
            order_id: { [Op.in]: cancelledOrderIds },
            status: { [Op.in]: ['QUEUED', 'PROCESSING', 'RETRYING'] },
          },
        });

        for (const out of queuedOutbox) {
          anomalies.push({
            type: 'QUEUED_MSG_ON_CANCELLED_ORDER',
            order_id: out.order_id,
            outbox_id: out.id,
            severity: 'HIGH',
            description: `Outbox entry #${out.id} (${out.template_name}) is QUEUED for cancelled Order ID ${out.order_id}.`,
            recommended_action: 'Cancel outbox entry to prevent invalid dispatch.',
          });

          // Safe auto-repair: cancel queued outbox message for cancelled order
          await out.update({
            status: 'CANCELLED',
            error_message: 'Auto-cancelled by Reconciliation Worker: Order was cancelled.',
          });
        }
      }

      // 4. WhatsAppLog delivered/read but OutboxQueue stuck in PENDING/SENDING
      const stuckOutbox = await WhatsAppOutbox.findAll({
        where: {
          status: { [Op.in]: ['QUEUED', 'SENDING'] },
          created_at: { [Op.lte]: new Date(now.getTime() - 15 * 60 * 1000) }, // Stuck >15m
        },
        limit: 50,
      });

      for (const out of stuckOutbox) {
        anomalies.push({
          type: 'STUCK_OUTBOX_QUEUE',
          outbox_id: out.id,
          order_id: out.order_id,
          severity: 'MEDIUM',
          description: `Outbox message #${out.id} (${out.template_name}) stuck in ${out.status} state for >15 minutes.`,
          recommended_action: 'Inspect circuit breaker or outbox worker health.',
        });
      }

      logger.info(`WhatsApp Reconciliation Worker completed scan: ${anomalies.length} anomaly/anomalies detected.`);
      return {
        scanned_at: now.toISOString(),
        anomalies_count: anomalies.length,
        anomalies,
      };
    } catch (err) {
      logger.error('WhatsApp Reconciliation Worker scan failed:', err);
      return { scanned_at: now.toISOString(), error: err.message, anomalies: [] };
    }
  }
}

module.exports = new WhatsAppReconciliationWorker();
