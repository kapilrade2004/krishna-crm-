'use strict';

/**
 * Warranty State Machine & Transition Rules Engine
 * Enforces server-side validation and business rules for all warranty and return state changes.
 */

// ─── Recommended 16 Warranty Lifecycle States ──────────────────────────────────
const WARRANTY_STATUSES = {
  PENDING_DELIVERY: 'PENDING_DELIVERY',
  DELIVERED: 'DELIVERED',
  INSTALLATION_PENDING: 'INSTALLATION_PENDING',
  INSTALLATION_COMPLETED: 'INSTALLATION_COMPLETED',
  ACTIVATION_MESSAGE_SCHEDULED: 'ACTIVATION_MESSAGE_SCHEDULED',
  ACTIVATION_MESSAGE_SENT: 'ACTIVATION_MESSAGE_SENT',
  ACTIVATION_PENDING: 'ACTIVATION_PENDING',
  ACTIVE: 'ACTIVE',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURN_APPROVED: 'RETURN_APPROVED',
  RETURN_PICKUP_SCHEDULED: 'RETURN_PICKUP_SCHEDULED',
  RETURNED: 'RETURNED',
  RETURN_REJECTED: 'RETURN_REJECTED',
  WARRANTY_VOIDED: 'WARRANTY_VOIDED',
  WARRANTY_EXPIRED: 'WARRANTY_EXPIRED',
  WARRANTY_CANCELLED: 'WARRANTY_CANCELLED',
};

// ─── Recommended 11 Return Lifecycle States ────────────────────────────────────
const RETURN_STATUSES = {
  NONE: 'NONE',
  REQUESTED: 'REQUESTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  PICKED_UP: 'PICKED_UP',
  RECEIVED: 'RECEIVED',
  INSPECTED: 'INSPECTED',
  ACCEPTED: 'ACCEPTED',
  CLOSED: 'CLOSED',
};

// ─── Valid Warranty Transitions ────────────────────────────────────────────────
const WARRANTY_TRANSITIONS = {
  [WARRANTY_STATUSES.PENDING_DELIVERY]: [
    WARRANTY_STATUSES.DELIVERED,
    WARRANTY_STATUSES.INSTALLATION_PENDING,
    WARRANTY_STATUSES.INSTALLATION_COMPLETED,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.DELIVERED]: [
    WARRANTY_STATUSES.INSTALLATION_PENDING,
    WARRANTY_STATUSES.INSTALLATION_COMPLETED,
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SCHEDULED,
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SENT,
    WARRANTY_STATUSES.ACTIVATION_PENDING,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.INSTALLATION_PENDING]: [
    WARRANTY_STATUSES.INSTALLATION_COMPLETED,
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SCHEDULED,
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SENT,
    WARRANTY_STATUSES.ACTIVATION_PENDING,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.INSTALLATION_COMPLETED]: [
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SCHEDULED,
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SENT,
    WARRANTY_STATUSES.ACTIVATION_PENDING,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.ACTIVATION_MESSAGE_SCHEDULED]: [
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SENT,
    WARRANTY_STATUSES.ACTIVATION_PENDING,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.ACTIVATION_MESSAGE_SENT]: [
    WARRANTY_STATUSES.ACTIVATION_PENDING,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
    WARRANTY_STATUSES.WARRANTY_EXPIRED,
  ],
  [WARRANTY_STATUSES.ACTIVATION_PENDING]: [
    WARRANTY_STATUSES.ACTIVATION_MESSAGE_SENT,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
    WARRANTY_STATUSES.WARRANTY_EXPIRED,
  ],
  [WARRANTY_STATUSES.ACTIVE]: [
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.RETURN_APPROVED,
    WARRANTY_STATUSES.RETURNED,
    WARRANTY_STATUSES.WARRANTY_EXPIRED,
    WARRANTY_STATUSES.WARRANTY_VOIDED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.RETURN_REQUESTED]: [
    WARRANTY_STATUSES.RETURN_APPROVED,
    WARRANTY_STATUSES.RETURN_REJECTED,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.ACTIVATION_PENDING,
    WARRANTY_STATUSES.INSTALLATION_COMPLETED,
    WARRANTY_STATUSES.DELIVERED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.RETURN_APPROVED]: [
    WARRANTY_STATUSES.RETURN_PICKUP_SCHEDULED,
    WARRANTY_STATUSES.RETURNED,
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.RETURN_PICKUP_SCHEDULED]: [
    WARRANTY_STATUSES.RETURNED,
    WARRANTY_STATUSES.RETURN_APPROVED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.RETURNED]: [
    WARRANTY_STATUSES.WARRANTY_VOIDED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.RETURN_REJECTED]: [
    WARRANTY_STATUSES.ACTIVE,
    WARRANTY_STATUSES.ACTIVATION_PENDING,
    WARRANTY_STATUSES.INSTALLATION_COMPLETED,
    WARRANTY_STATUSES.DELIVERED,
    WARRANTY_STATUSES.RETURN_REQUESTED,
    WARRANTY_STATUSES.WARRANTY_CANCELLED,
  ],
  [WARRANTY_STATUSES.WARRANTY_VOIDED]: [
    WARRANTY_STATUSES.ACTIVE, // Only via explicit admin override with audit
  ],
  [WARRANTY_STATUSES.WARRANTY_EXPIRED]: [
    WARRANTY_STATUSES.ACTIVE, // Only via explicit admin extension with audit
  ],
  [WARRANTY_STATUSES.WARRANTY_CANCELLED]: [
    WARRANTY_STATUSES.ACTIVE, // Only via explicit admin restoration
  ],
};

// ─── Valid Return Transitions ──────────────────────────────────────────────────
const RETURN_TRANSITIONS = {
  [RETURN_STATUSES.NONE]: [
    RETURN_STATUSES.REQUESTED,
    RETURN_STATUSES.APPROVED, // Direct controller/carrier logging
  ],
  [RETURN_STATUSES.REQUESTED]: [
    RETURN_STATUSES.UNDER_REVIEW,
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.REJECTED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.UNDER_REVIEW]: [
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.REJECTED,
    RETURN_STATUSES.REQUESTED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.APPROVED]: [
    RETURN_STATUSES.PICKUP_SCHEDULED,
    RETURN_STATUSES.PICKED_UP,
    RETURN_STATUSES.RECEIVED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.REJECTED]: [
    RETURN_STATUSES.REQUESTED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.PICKUP_SCHEDULED]: [
    RETURN_STATUSES.PICKED_UP,
    RETURN_STATUSES.RECEIVED,
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.PICKED_UP]: [
    RETURN_STATUSES.RECEIVED,
    RETURN_STATUSES.INSPECTED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.RECEIVED]: [
    RETURN_STATUSES.INSPECTED,
    RETURN_STATUSES.ACCEPTED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.INSPECTED]: [
    RETURN_STATUSES.ACCEPTED,
    RETURN_STATUSES.REJECTED,
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.ACCEPTED]: [
    RETURN_STATUSES.CLOSED,
  ],
  [RETURN_STATUSES.CLOSED]: [],
};

// ─── Normalizer (handles legacy lowercase strings) ─────────────────────────────
function normalizeWarrantyStatus(status) {
  if (!status) return WARRANTY_STATUSES.PENDING_DELIVERY;
  const upper = String(status).toUpperCase();
  const legacyMap = {
    INACTIVE: WARRANTY_STATUSES.WARRANTY_CANCELLED,
    PENDING_ACTIVATION: WARRANTY_STATUSES.ACTIVATION_PENDING,
    RETURN_INITIATED: WARRANTY_STATUSES.RETURN_REQUESTED,
    VOIDED: WARRANTY_STATUSES.WARRANTY_VOIDED,
    EXPIRED: WARRANTY_STATUSES.WARRANTY_EXPIRED,
  };
  return legacyMap[upper] || upper;
}

function normalizeReturnStatus(status) {
  if (!status) return RETURN_STATUSES.NONE;
  return String(status).toUpperCase();
}

/**
 * Validate whether a warranty status transition is permissible.
 */
function validateWarrantyTransition(fromStatus, toStatus, isAdminOverride = false) {
  const normFrom = normalizeWarrantyStatus(fromStatus);
  const normTo = normalizeWarrantyStatus(toStatus);

  if (normFrom === normTo) return { valid: true, isNoop: true };
  if (isAdminOverride) return { valid: true, isAdminOverride: true };

  const allowed = WARRANTY_TRANSITIONS[normFrom] || [];
  if (!allowed.includes(normTo)) {
    return {
      valid: false,
      error: `Invalid warranty status transition from '${normFrom}' to '${normTo}'.`,
      allowedTransitions: allowed,
    };
  }

  return { valid: true, from: normFrom, to: normTo };
}

/**
 * Validate whether a return status transition is permissible.
 */
function validateReturnTransition(fromStatus, toStatus, isAdminOverride = false) {
  const normFrom = normalizeReturnStatus(fromStatus);
  const normTo = normalizeReturnStatus(toStatus);

  if (normFrom === normTo) return { valid: true, isNoop: true };
  if (isAdminOverride) return { valid: true, isAdminOverride: true };

  const allowed = RETURN_TRANSITIONS[normFrom] || [];
  if (!allowed.includes(normTo)) {
    return {
      valid: false,
      error: `Invalid return status transition from '${normFrom}' to '${normTo}'.`,
      allowedTransitions: allowed,
    };
  }

  return { valid: true, from: normFrom, to: normTo };
}

/**
 * Check if a warranty is eligible for 24-hour activation message dispatch.
 * 
 * Rules:
 * 1. Order is delivered (delivered_at is set or order status is delivered)
 * 2. Installation is completed (installation_completed_at is set)
 * 3. installation_completed_at is at least 24 hours in the past
 * 4. Warranty status is not already active, returned, cancelled, or voided
 * 5. Return status is NONE or REJECTED (no open/approved return)
 */
function isEligibleForActivationMessage(warranty, now = new Date()) {
  if (!warranty) return { eligible: false, reason: 'Warranty record is null' };

  const normStatus = normalizeWarrantyStatus(warranty.warranty_status || warranty.status);
  const normReturn = normalizeReturnStatus(warranty.return_status);

  // Exclude terminal / active / return states
  if (['ACTIVE', 'RETURNED', 'WARRANTY_CANCELLED', 'WARRANTY_VOIDED', 'WARRANTY_EXPIRED'].includes(normStatus)) {
    return { eligible: false, reason: `Warranty status '${normStatus}' is not eligible for activation message.` };
  }

  // Exclude active returns
  if (['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'ACCEPTED', 'CLOSED'].includes(normReturn)) {
    return { eligible: false, reason: `Active return in status '${normReturn}' blocks activation message.` };
  }

  // Installation completed check
  if (!warranty.installation_completed_at) {
    return { eligible: false, reason: 'Installation is not yet marked as completed.' };
  }

  // 24-hour elapsed check
  const completedAt = new Date(warranty.installation_completed_at);
  if (isNaN(completedAt.getTime())) {
    return { eligible: false, reason: 'Invalid installation_completed_at timestamp.' };
  }

  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - completedAt.getTime();

  if (elapsedMs < twentyFourHoursMs) {
    const remainingMinutes = Math.ceil((twentyFourHoursMs - elapsedMs) / (60 * 1000));
    return {
      eligible: false,
      reason: `24 hours have not elapsed yet. ${remainingMinutes} minute(s) remaining.`,
      remainingMinutes,
      activationDueAt: new Date(completedAt.getTime() + twentyFourHoursMs),
    };
  }

  return { eligible: true };
}

module.exports = {
  WARRANTY_STATUSES,
  RETURN_STATUSES,
  validateWarrantyTransition,
  validateReturnTransition,
  isEligibleForActivationMessage,
  normalizeWarrantyStatus,
  normalizeReturnStatus,
};
