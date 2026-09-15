'use strict';

const { Op } = require('sequelize');
const {
  Warranty,
  WarrantyMessage,
  WarrantyEvent,
  Customer,
  Order,
  sequelize,
} = require('../models');
const { isEligibleForActivationMessage, WARRANTY_STATUSES } = require('./warrantyStateMachine');
const { generateActivationToken, getActivationUrl } = require('./warrantyTokenService');
const whatsappService = require('./whatsappService');
const logger = require('../config/logger');

const WORKER_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes
const MAX_ATTEMPTS = 3;

let workerTimer = null;
let isWorkerRunning = false;

/**
 * Process the Warranty Activation Queue
 * Idempotently evaluates eligible warranties and sends 24h WhatsApp activation messages.
 */
async function processWarrantyActivationQueue() {
  if (isWorkerRunning) {
    logger.debug('Warranty activation worker is already processing. Skipping overlapping cycle.');
    return { processed: 0, skipped: 0, errors: 0 };
  }

  // Check Global WhatsApp Sending Kill Switch before starting cycle
  const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
  if (!(await isWhatsAppSendingEnabled())) {
    logger.debug('Warranty activation worker: Global WhatsApp sending is paused. Skipping cycle.');
    return { processed: 0, skipped: 0, errors: 0, reason: 'whatsapp_sending_paused' };
  }

  isWorkerRunning = true;
  const now = new Date();
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Find eligible warranties whose activation due date has passed
    const candidateWarranties = await Warranty.findAll({
      where: {
        installation_completed_at: { [Op.ne]: null },
        activation_due_at: { [Op.lte]: now },
        warranty_status: {
          [Op.in]: [
            'INSTALLATION_COMPLETED',
            'ACTIVATION_MESSAGE_SCHEDULED',
            'ACTIVATION_PENDING',
            'pending_activation',
            'inactive',
            'DELIVERED',
          ],
        },
        return_status: {
          [Op.in]: ['NONE', 'REJECTED', null, ''],
        },
        activated_at: null,
      },
      include: [
        { model: Customer, as: 'customer' },
        { model: Order, as: 'order' },
      ],
      limit: 100, // Process in batches of 100
    });

    if (candidateWarranties.length === 0) {
      isWorkerRunning = false;
      return { processed: 0, skipped: 0, errors: 0 };
    }

    logger.info(`Warranty activation queue: Found ${candidateWarranties.length} candidate(s) for evaluation.`);

    for (const warranty of candidateWarranties) {
      // 1. Strict Eligibility Gate
      const eligibility = isEligibleForActivationMessage(warranty, now);
      if (!eligibility.eligible) {
        skippedCount++;
        continue;
      }

      // 2. Form Unique Idempotency Key based on installation / due timestamp
      const dueEpoch = warranty.activation_due_at
        ? Math.floor(new Date(warranty.activation_due_at).getTime() / 1000)
        : Math.floor(now.getTime() / 1000);
      const idempotencyKey = `act_msg_${warranty.id}_${dueEpoch}`;

      // Check if message was already sent/queued under this key
      const existingMessage = await WarrantyMessage.findOne({
        where: { idempotency_key: idempotencyKey },
      });

      if (existingMessage && ['SENT', 'DELIVERED', 'READ'].includes(existingMessage.delivery_status)) {
        // Already successfully sent, make sure warranty status reflects it
        if (warranty.warranty_status !== 'ACTIVATION_MESSAGE_SENT' && warranty.warranty_status !== 'ACTIVE') {
          await warranty.update({
            warranty_status: 'ACTIVATION_MESSAGE_SENT',
            activation_sent_at: existingMessage.sent_at || existingMessage.created_at,
          });
        }
        skippedCount++;
        continue;
      }

      // If attempt count exceeded max allowed, skip to avoid spamming failed numbers
      if (existingMessage && existingMessage.attempt_count >= MAX_ATTEMPTS) {
        logger.warn(`Max message attempts (${MAX_ATTEMPTS}) reached for Warranty ${warranty.warranty_number}. Skipping.`);
        skippedCount++;
        continue;
      }

      // 3. Generate Signed Token & Activation URL
      const token = generateActivationToken(warranty, 7);
      const activationUrl = getActivationUrl(token);

      // Create or update message record in QUEUED status
      let msgRecord = existingMessage;
      if (!msgRecord) {
        msgRecord = await WarrantyMessage.create({
          warranty_id: warranty.id,
          customer_id: warranty.customer_id,
          phone_number: warranty.customer?.whatsapp_number || warranty.customer?.phone || '',
          template_key: 'warranty_claim',
          channel: 'WHATSAPP',
          scheduled_at: warranty.activation_due_at,
          delivery_status: 'QUEUED',
          attempt_count: 1,
          idempotency_key: idempotencyKey,
          activation_token: token,
          activation_url: activationUrl,
        });
      } else {
        await msgRecord.update({
          attempt_count: msgRecord.attempt_count + 1,
          activation_token: token,
          activation_url: activationUrl,
        });
      }

      // 4. Dispatch via WhatsApp Service
      const previousStatus = warranty.warranty_status;
      try {
        const sendResult = await whatsappService.sendWarrantyActivationMessage({
          warranty,
          token,
          activationUrl,
          idempotencyKey,
        });

        const providerMsgId = sendResult?.waMessageId || sendResult?.response?.messages?.[0]?.id || `msg_${Date.now()}`;

        await msgRecord.update({
          delivery_status: 'SENT',
          provider_message_id: providerMsgId,
          sent_at: new Date(),
          failure_reason: null,
        });

        // 5. Transition Warranty State to ACTIVATION_MESSAGE_SENT
        await warranty.update({
          warranty_status: 'ACTIVATION_MESSAGE_SENT',
          activation_sent_at: new Date(),
          activation_message_id: msgRecord.id,
        });

        // 6. Record Immutable Audit Event
        await WarrantyEvent.create({
          warranty_id: warranty.id,
          event_type: 'ACTIVATION_MESSAGE_SENT',
          from_status: previousStatus,
          to_status: 'ACTIVATION_MESSAGE_SENT',
          source_type: 'SYSTEM',
          source_id: msgRecord.id,
          title: 'Warranty Activation WhatsApp Message Sent',
          description: `24-hour activation invitation dispatched to customer (${warranty.customer?.phone || 'N/A'}) with secure token link.`,
          metadata: {
            template: 'warranty_claim',
            provider_message_id: providerMsgId,
            activation_url: activationUrl,
            due_at: warranty.activation_due_at,
          },
        });

        processedCount++;
        logger.info(`Successfully dispatched warranty activation message for Warranty ${warranty.warranty_number} (Order: ${warranty.order_id || 'N/A'})`);
      } catch (sendErr) {
        errorCount++;
        logger.error(`Failed to send warranty activation message for ${warranty.warranty_number}:`, sendErr.message);

        await msgRecord.update({
          delivery_status: 'FAILED',
          failure_reason: sendErr.message,
        });

        await WarrantyEvent.create({
          warranty_id: warranty.id,
          event_type: 'ACTIVATION_MESSAGE_FAILED',
          from_status: previousStatus,
          to_status: previousStatus,
          source_type: 'SYSTEM',
          title: 'Warranty Activation Message Delivery Failed',
          description: `Attempt ${msgRecord.attempt_count}/${MAX_ATTEMPTS} failed: ${sendErr.message}`,
          metadata: { error: sendErr.message, attempt: msgRecord.attempt_count },
        });
      }
    }
  } catch (queueErr) {
    logger.error('Error during processWarrantyActivationQueue execution:', queueErr);
  } finally {
    isWorkerRunning = false;
  }

  return { processed: processedCount, skipped: skippedCount, errors: errorCount };
}

/**
 * Start the recurring background worker.
 */
function start() {
  if (workerTimer) return;
  logger.info('Warranty activation worker started (polling interval: 5 min).');
  // Initial run on startup
  processWarrantyActivationQueue();
  workerTimer = setInterval(processWarrantyActivationQueue, WORKER_INTERVAL_MS);
}

/**
 * Stop the recurring background worker.
 */
function stop() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    logger.info('Warranty activation worker stopped.');
  }
}

module.exports = {
  start,
  stop,
  processWarrantyActivationQueue,
  generateActivationToken,
  getActivationUrl,
};
