'use strict';

const { Op } = require('sequelize');
const { sequelize, Order } = require('../../models');
const OrderWorkflowService = require('./orderWorkflowService');
const { ORDER_WORKFLOW_STATES } = require('./orderStateMachine');
const logger = require('../../config/logger');

class OrderScreenshotTimeoutWorker {
  /**
   * Scans for orders stuck in SCREENSHOT_REQUESTED whose 15-minute deadline has elapsed
   * and where NO customer image has been received.
   *
   * Transitions qualifying orders to PENDING_CUSTOMER_CONFIRMATION and atomically
   * enqueues Message 2 (order_confirmation013).
   *
   * @param {Object} [options]
   * @param {Date} [options.currentTime=new Date()] - Override time for deterministic testing
   * @returns {Promise<{ processedCount: number, orders: Array<Object> }>}
   */
  static async processExpiredScreenshotDeadlines(options = {}) {
    const now = options.currentTime || new Date();

    // Find candidate orders past their deadline
    const candidateOrders = await Order.findAll({
      where: {
        workflow_state: ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
        screenshot_received_at: null,
        [Op.or]: [
          { screenshot_deadline_at: { [Op.lte]: now } },
          { second_message_due_at: { [Op.lte]: now } },
        ],
      },
    });

    if (candidateOrders.length === 0) {
      return { processedCount: 0, orders: [] };
    }

    logger.info(`[ScreenshotTimeoutWorker] Found ${candidateOrders.length} orders past 15-minute screenshot deadline.`);

    const processedOrders = [];

    for (const candidate of candidateOrders) {
      try {
        const result = await OrderWorkflowService.transitionOrder({
          orderId: candidate.id,
          targetState: ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION,
          actor: 'screenshot_timeout_worker',
          source: 'cron_timeout',
          correlationId: `ORD-${candidate.order_number}-TIMEOUT-15M`,
          note: '15-minute screenshot window expired without customer image upload. Dispatching Message 2 (order_confirmation013).',
          outboxMessage: {
            templateName: 'order_confirmation013',
            recipientPhone: candidate.customer_phone,
            idempotencyKey: `order_confirmation013_${candidate.id}`,
            payload: {
              customer_name: candidate.customer_name,
              order_number: candidate.order_number,
              product_name: candidate.product_name,
              product_sku: candidate.product_sku,
              total_amount: candidate.total_amount,
            },
          },
        });

        if (result.success && !result.isIdempotent) {
          processedOrders.push(candidate);
          logger.info(`[ScreenshotTimeoutWorker] Successfully escalated order #${candidate.order_number} to PENDING_CUSTOMER_CONFIRMATION.`);
        }
      } catch (err) {
        logger.error(`[ScreenshotTimeoutWorker] Failed to process order #${candidate.order_number}: ${err.message}`);
      }
    }

    return {
      processedCount: processedOrders.length,
      orders: processedOrders,
    };
  }
}

module.exports = OrderScreenshotTimeoutWorker;
