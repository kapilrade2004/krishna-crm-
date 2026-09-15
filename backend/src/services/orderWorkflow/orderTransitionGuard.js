'use strict';

const {
  ORDER_WORKFLOW_STATES,
  isValidState,
  isTerminalState,
  canTransition,
} = require('./orderStateMachine');
const { AppError } = require('../../utils/errors');

class OrderTransitionError extends AppError {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message, statusCode);
    this.code = code;
    this.details = details;
  }
}

class OrderTransitionGuard {
  /**
   * Validates whether an order can transition from its current state to a target state
   *
   * @param {Object} params
   * @param {string} params.currentState - Current canonical state of the order
   * @param {string} params.targetState - Requested canonical target state
   * @param {Object} [params.order] - Order instance for contextual validation
   * @param {string} [params.actor] - Identifier of user or system triggering transition
   * @returns {{ allowed: boolean, isIdempotent: boolean }}
   */
  static validate({ currentState, targetState, order = null, actor = 'system' }) {
    if (!isValidState(targetState)) {
      throw new OrderTransitionError(
        `Invalid target workflow state: "${targetState}"`,
        'UNKNOWN_WORKFLOW_STATE',
        400,
        { currentState, targetState }
      );
    }

    if (!isValidState(currentState)) {
      throw new OrderTransitionError(
        `Order is in an unrecognized workflow state: "${currentState}"`,
        'CORRUPT_WORKFLOW_STATE',
        500,
        { currentState, targetState }
      );
    }

    // Idempotency: Transitioning to the exact same state is safely accepted as a no-op
    if (currentState === targetState) {
      return { allowed: true, isIdempotent: true };
    }

    // Terminal state protection: Once confirmed or cancelled, verification states cannot change
    if (isTerminalState(currentState)) {
      throw new OrderTransitionError(
        `Cannot transition order from terminal state "${currentState}" to "${targetState}"`,
        'TERMINAL_STATE_IMMUTABLE',
        409,
        { currentState, targetState, orderId: order?.id }
      );
    }

    // State machine graph check
    if (!canTransition(currentState, targetState)) {
      throw new OrderTransitionError(
        `Illegal transition from "${currentState}" to "${targetState}"`,
        'INVALID_TRANSITION',
        422,
        { currentState, targetState, orderId: order?.id }
      );
    }

    return { allowed: true, isIdempotent: false };
  }

  /**
   * Validates that an incoming customer phone belongs to the given order
   * Ensures Customer A cannot mutate Customer B's order.
   *
   * @param {Object} order - Order model instance (with optional customer included)
   * @param {string} incomingPhone - Normalized customer phone number
   */
  static validateCustomerOwnership(order, incomingPhone) {
    if (!order || !incomingPhone) return true;

    const cleanIncoming = String(incomingPhone).replace(/\D/g, '').slice(-10);
    if (!cleanIncoming || cleanIncoming.length < 10) return true;

    const phones = [
      order.customer_phone,
      order.customer?.whatsapp_number,
      order.customer?.phone,
      order.shipping_address?.ship_phone,
      order.shipping_address?.phone,
    ]
      .filter(Boolean)
      .map(p => String(p).replace(/\D/g, '').slice(-10));

    if (phones.length > 0 && !phones.includes(cleanIncoming)) {
      throw new OrderTransitionError(
        `Sender phone ${cleanIncoming} does not match order #${order.order_number} recipient`,
        'UNAUTHORIZED_ORDER_ACCESS',
        403,
        { orderId: order.id, incomingPhone: cleanIncoming }
      );
    }

    return true;
  }
}

module.exports = {
  OrderTransitionGuard,
  OrderTransitionError,
};
