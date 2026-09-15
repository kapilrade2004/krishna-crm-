'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CANONICAL ORDER WORKFLOW STATE MACHINE
 *  Authoritative single source of truth for Order verification states.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ORDER_WORKFLOW_STATES = Object.freeze({
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  SCREENSHOT_REQUESTED: 'SCREENSHOT_REQUESTED',
  IMAGE_RECEIVED: 'IMAGE_RECEIVED',
  PENDING_CUSTOMER_CONFIRMATION: 'PENDING_CUSTOMER_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  TELECALLER_REQUIRED: 'TELECALLER_REQUIRED',
});

const TERMINAL_STATES = Object.freeze([
  ORDER_WORKFLOW_STATES.CONFIRMED,
  ORDER_WORKFLOW_STATES.CANCELLED,
]);

/**
 * Valid transitions between canonical workflow states
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  [ORDER_WORKFLOW_STATES.PENDING_VERIFICATION]: Object.freeze([
    ORDER_WORKFLOW_STATES.CONFIRMED,
    ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
    ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED,
    ORDER_WORKFLOW_STATES.CANCELLED,
  ]),
  [ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED]: Object.freeze([
    ORDER_WORKFLOW_STATES.IMAGE_RECEIVED,
    ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION,
    ORDER_WORKFLOW_STATES.CANCELLED,
    ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED,
  ]),
  [ORDER_WORKFLOW_STATES.IMAGE_RECEIVED]: Object.freeze([
    ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION,
    ORDER_WORKFLOW_STATES.CANCELLED,
    ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED,
  ]),
  [ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION]: Object.freeze([
    ORDER_WORKFLOW_STATES.CONFIRMED,
    ORDER_WORKFLOW_STATES.CANCELLED,
    ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED,
  ]),
  [ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED]: Object.freeze([
    ORDER_WORKFLOW_STATES.CONFIRMED,
    ORDER_WORKFLOW_STATES.CANCELLED,
    ORDER_WORKFLOW_STATES.PENDING_VERIFICATION,
  ]),
  // Terminal states cannot transition to any new verification state
  [ORDER_WORKFLOW_STATES.CONFIRMED]: Object.freeze([]),
  [ORDER_WORKFLOW_STATES.CANCELLED]: Object.freeze([]),
});

/**
 * Verifies if a given state string is a valid canonical workflow state
 */
function isValidState(state) {
  return Object.values(ORDER_WORKFLOW_STATES).includes(state);
}

/**
 * Checks if a state is terminal
 */
function isTerminalState(state) {
  return TERMINAL_STATES.includes(state);
}

/**
 * Checks if transitioning from currentState to targetState is permitted
 */
function canTransition(currentState, targetState) {
  if (!isValidState(currentState) || !isValidState(targetState)) {
    return false;
  }
  if (currentState === targetState) {
    return true; // Idempotent same-state transition
  }
  const allowed = ALLOWED_TRANSITIONS[currentState] || [];
  return allowed.includes(targetState);
}

/**
 * Maps legacy status & verification_status fields to canonical workflow state
 */
function toCanonicalState(order) {
  if (!order) return ORDER_WORKFLOW_STATES.PENDING_VERIFICATION;
  if (order.workflow_state && isValidState(order.workflow_state)) {
    return order.workflow_state;
  }
  if (order.status === 'confirmed') return ORDER_WORKFLOW_STATES.CONFIRMED;
  if (order.status === 'cancelled') return ORDER_WORKFLOW_STATES.CANCELLED;
  if (order.verification_status === 'call_representative_requested') return ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED;
  if (order.verification_status === 'screenshot_requested') return ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED;
  if (order.verification_status === 'image_received') return ORDER_WORKFLOW_STATES.IMAGE_RECEIVED;
  if (order.verification_status === 'pending_confirmation') return ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION;
  return ORDER_WORKFLOW_STATES.PENDING_VERIFICATION;
}

module.exports = {
  ORDER_WORKFLOW_STATES,
  TERMINAL_STATES,
  ALLOWED_TRANSITIONS,
  isValidState,
  isTerminalState,
  canTransition,
  toCanonicalState,
};
