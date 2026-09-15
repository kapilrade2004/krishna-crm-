'use strict';

const { sequelize, Order, Customer, OrderEvent, OrderActivity, WhatsAppOutbox } = require('../../models');
const { ORDER_WORKFLOW_STATES, toCanonicalState } = require('./orderStateMachine');
const { OrderTransitionGuard, OrderTransitionError } = require('./orderTransitionGuard');
const logger = require('../../config/logger');
const { AppError } = require('../../utils/errors');

class OrderWorkflowService {
  /**
   * Authoritatively transitions an order to a target canonical workflow state.
   * Performs row locking, validation, state persistence, audit event creation,
   * and atomic outbox queuing.
   *
   * @param {Object} params
   * @param {string} params.orderId - Unique Order UUID
   * @param {string} params.targetState - Canonical target state from ORDER_WORKFLOW_STATES
   * @param {string} [params.actor='system'] - User ID, phone, or worker identifier
   * @param {string} [params.source='system'] - Webhook, crm_operator, cron_worker, etc.
   * @param {string} [params.correlationId] - Distributed tracking correlation ID
   * @param {string} [params.customerPhone] - Phone to verify ownership against
   * @param {string} [params.note] - Optional description or audit note
   * @param {Object} [params.metadata={}] - Additional event metadata
   * @param {Object} [params.outboxMessage] - Optional WhatsApp outbox message to enqueue atomically
   * @param {Object} [params.transaction] - Optional existing transaction
   * @returns {Promise<{ success: boolean, order: Object, beforeState: string, afterState: string, isIdempotent: boolean }>}
   */
  static async transitionOrder({
    orderId,
    targetState,
    actor = 'system',
    source = 'system',
    correlationId = null,
    customerPhone = null,
    note = null,
    metadata = {},
    outboxMessage = null,
    transaction: externalTx = null,
  }) {
    if (!orderId) {
      throw new AppError('orderId is required for workflow transition', 400);
    }

    const execute = async (t) => {
      // 1. Row-level lock on the order
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      // 2. Validate customer ownership if phone is supplied
      if (customerPhone) {
        OrderTransitionGuard.validateCustomerOwnership(order, customerPhone);
      }

      // 3. Read current canonical state
      const currentState = toCanonicalState(order);

      // 4. Validate transition through the guard
      const { allowed, isIdempotent } = OrderTransitionGuard.validate({
        currentState,
        targetState,
        order,
        actor,
      });

      if (isIdempotent) {
        logger.info(`[WORKFLOW IDEMPOTENT] Order #${order.order_number} already in "${targetState}". Skipping mutation.`);
        return {
          success: true,
          order,
          beforeState: currentState,
          afterState: currentState,
          isIdempotent: true,
        };
      }

      // 5. Compute backward-compatible field synchronizations
      const updates = {
        workflow_state: targetState,
      };

      const now = new Date();
      switch (targetState) {
        case ORDER_WORKFLOW_STATES.CONFIRMED:
          updates.status = 'confirmed';
          updates.verification_status = 'confirmed';
          updates.flow_stage = 'delivery_confirmed';
          updates.customer_confirmed_at = now;
          break;

        case ORDER_WORKFLOW_STATES.CANCELLED:
          updates.status = 'cancelled';
          updates.verification_status = 'cancelled';
          updates.flow_stage = 'match_cancelled';
          updates.cancelled_at = now;
          updates.customer_cancelled_at = now;
          if (metadata.cancel_reason) {
            updates.cancel_reason = metadata.cancel_reason;
          }
          break;

        case ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED:
          updates.status = 'image_verification';
          updates.verification_status = 'screenshot_requested';
          updates.flow_stage = 'ask_images';
          updates.screenshot_requested_at = now;
          // 15-minute response deadline
          const deadline = new Date(now.getTime() + 15 * 60 * 1000);
          updates.screenshot_deadline_at = deadline;
          updates.second_message_due_at = deadline;
          break;

        case ORDER_WORKFLOW_STATES.IMAGE_RECEIVED:
          updates.status = 'image_verification';
          updates.verification_status = 'image_received';
          updates.flow_stage = 'match_pending';
          updates.images_provided = true;
          updates.screenshot_received_at = now;
          break;

        case ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION:
          updates.verification_status = 'pending_confirmation';
          updates.flow_stage = 'match_confirmed';
          break;

        case ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED:
          updates.verification_status = 'call_representative_requested';
          break;

        case ORDER_WORKFLOW_STATES.PENDING_VERIFICATION:
          updates.status = 'pending';
          updates.verification_status = 'pending_verification';
          updates.flow_stage = 'ask_images';
          break;
      }

      // 6. Update order within transaction
      await order.update(updates, { transaction: t });

      const finalCorrId = correlationId || `ORD-${order.order_number}-${now.getTime()}`;

      const eventTypeMap = {
        [ORDER_WORKFLOW_STATES.CONFIRMED]: actor === 'customer_whatsapp' ? 'CUSTOMER_CONFIRMED' : 'ORDER_CONFIRMED',
        [ORDER_WORKFLOW_STATES.CANCELLED]: actor === 'customer_whatsapp' ? 'CUSTOMER_CANCELLED' : 'ORDER_CANCELLED',
        [ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED]: 'SCREENSHOT_REQUESTED',
        [ORDER_WORKFLOW_STATES.IMAGE_RECEIVED]: 'IMAGE_RECEIVED',
        [ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION]: 'IMAGE_APPROVED',
        [ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED]: 'TELECALLER_REQUIRED',
        [ORDER_WORKFLOW_STATES.DISPATCHED]: 'ORDER_DISPATCHED',
        [ORDER_WORKFLOW_STATES.DELIVERED]: 'ORDER_DELIVERED',
      };
      const canonicalEventType = metadata.event_type || eventTypeMap[targetState] || `STATE_${targetState}`;

      // 7. Create unified OrderEvent within transaction
      await OrderEvent.create(
        {
          order_id: order.id,
          customer_id: order.customer_id,
          event_type: canonicalEventType,
          source,
          actor,
          before_state: currentState,
          after_state: targetState,
          correlation_id: finalCorrId,
          metadata: {
            ...metadata,
            notes: note,
          },
          timestamp: now,
        },
        { transaction: t }
      );

      // 8. Create backward-compatible OrderActivity within transaction
      await OrderActivity.create(
        {
          order_id: order.id,
          action: `workflow_transition_${targetState.toLowerCase()}`,
          from_value: currentState,
          to_value: targetState,
          note: note || `Transitioned from ${currentState} to ${targetState}`,
          metadata: { actor, source, correlationId: finalCorrId, ...metadata },
        },
        { transaction: t }
      );

      // 9. Atomically enqueue outbox message if provided
      let outboxItem = null;
      if (outboxMessage) {
        const {
          templateName,
          recipientPhone,
          payload = {},
          idempotencyKey,
          batchId = null,
        } = outboxMessage;

        if (templateName && recipientPhone && idempotencyKey) {
          const [created, wasCreated] = await WhatsAppOutbox.findOrCreate({
            where: { idempotency_key: idempotencyKey },
            defaults: {
              order_id: order.id,
              customer_id: order.customer_id,
              batch_id: batchId || order.whatsapp_batch_id,
              recipient_phone: recipientPhone,
              template_name: templateName,
              payload,
              idempotency_key: idempotencyKey,
              status: 'QUEUED',
              queued_at: now,
              next_attempt_at: now,
              attempt_count: 0,
              attempts: 0,
            },
            transaction: t,
          });
          outboxItem = created;
          if (!wasCreated) {
            logger.info(`[OUTBOX IDEMPOTENT] Outbox row with key "${idempotencyKey}" already exists.`);
          }
        }
      }

      logger.info(
        `✅ [ORDER WORKFLOW] Order #${order.order_number}: ${currentState} → ${targetState} (Actor: ${actor}, Source: ${source})`
      );

      return {
        success: true,
        order,
        beforeState: currentState,
        afterState: targetState,
        isIdempotent: false,
        correlationId: finalCorrId,
        outboxItem,
      };
    };

    let result;
    if (externalTx) {
      result = await execute(externalTx);
    } else {
      result = await sequelize.transaction(execute);
    }

    if (result && result.outboxItem) {
      try {
        const whatsappOutboxQueue = require('../whatsappOutboxQueue');
        setImmediate(() => {
          whatsappOutboxQueue.drainQueue().catch((err) =>
            logger.warn(`Outbox drain notice for order #${result.order?.order_number}: ${err.message}`)
          );
        });
      } catch (_) {}
    }

    return result;
  }
}

module.exports = OrderWorkflowService;
