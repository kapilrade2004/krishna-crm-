'use strict';

const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('../utils/errors');

// ─── Run validation and short-circuit on errors ───────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return next(new AppError('Validation failed.', 422, formatted));
  }
  next();
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
const loginRules = [
  body('email').isEmail().withMessage('Valid email required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

const createUserRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('email').isEmail().withMessage('Valid email required.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  body('role').isIn(['admin', 'manager', 'sales', 'support', 'ceo', 'hr']).withMessage('Invalid role.'),
  body('phone').optional({ checkFalsy: true }).isLength({ min: 7, max: 20 }).withMessage('Invalid phone number.'),
];

const changePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
];

// ─── Customers ────────────────────────────────────────────────────────────────
const createCustomerRules = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Name must be 2–150 characters.'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('phone').optional({ checkFalsy: true }).isLength({ min: 7, max: 20 }).withMessage('Invalid phone number.'),
  body('source').optional().isIn(['amazon', 'flipkart', 'indiamart', 'akuabeat_website', 'website', 'direct', 'other']).withMessage('Invalid source.'),
  body('status').optional().isIn(['active', 'inactive', 'blocked']).withMessage('Invalid status.'),
  body('pincode').optional().isLength({ min: 4, max: 10 }).withMessage('Invalid pincode.'),
  body('whatsapp_opt_in').optional().isBoolean().withMessage('whatsapp_opt_in must be boolean.'),
];

const updateCustomerRules = [
  body('name').optional().trim().isLength({ min: 2, max: 150 }).withMessage('Name must be 2–150 characters.'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('status').optional().isIn(['active', 'inactive', 'blocked']).withMessage('Invalid status.'),
  body('source').optional().isIn(['amazon', 'flipkart', 'indiamart', 'akuabeat_website', 'website', 'direct', 'other']).withMessage('Invalid source.'),
];

// ─── Orders ───────────────────────────────────────────────────────────────────
const createOrderRules = [
  body('customer_id').optional({ checkFalsy: true }).isUUID(4).withMessage('Valid customer_id (UUID) required.'),
  body('marketplace').isIn(['amazon', 'flipkart', 'indiamart', 'akuabeat_website', 'website', 'direct', 'other']).withMessage('Invalid marketplace.'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer.'),
  body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be non-negative.'),
  body('total_amount').optional().isFloat({ min: 0 }).withMessage('Total amount must be non-negative.'),
  body('feedback_rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5.'),
];

const updateStatusRules = [
  param('id').isUUID(4).withMessage('Valid order ID required.'),
  body('status').isIn(['pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'returned', 'refunded'])
    .withMessage('Invalid status.'),
];

const updateFlowStageRules = [
  param('id').isUUID(4).withMessage('Valid order ID required.'),
  body('flow_stage').isIn([
    'ask_images', 'match_pending', 'match_confirmed', 'match_alternate',
    'match_reorder', 'match_cancelled', 'processing', 'delivery_confirmed',
    'installation', 'feedback_pending', 'completed',
  ]).withMessage('Invalid flow_stage.'),
];

const bulkStatusRules = [
  body('order_ids').isArray({ min: 1, max: 100 }).withMessage('order_ids must be an array of 1–100 IDs.'),
  body('order_ids.*').isUUID(4).withMessage('Each order_id must be a valid UUID.'),
  body('status').isIn(['confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'])
    .withMessage('Invalid status for bulk update.'),
];

// ─── Follow-ups ───────────────────────────────────────────────────────────────
const createFollowUpRules = [
  body('customer_id').isUUID(4).withMessage('Valid customer_id (UUID) required.'),
  body('subject').trim().isLength({ min: 2, max: 255 }).withMessage('Subject must be 2–255 characters.'),
  body('due_at').isISO8601().toDate().withMessage('Valid due_at date required.'),
  body('type').optional().isIn(['call', 'whatsapp', 'email', 'visit', 'other']).withMessage('Invalid type.'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority.'),
  body('order_id').optional({ checkFalsy: true }).isUUID(4).withMessage('order_id must be a valid UUID.'),
];

const updateFollowUpRules = [
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled', 'rescheduled']).withMessage('Invalid status.'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority.'),
  body('type').optional().isIn(['call', 'whatsapp', 'email', 'visit', 'other']).withMessage('Invalid type.'),
  body('due_at').optional().isISO8601().toDate().withMessage('Invalid due_at date.'),
  body('next_followup_at').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid next_followup_at date.'),
];

// ─── Tasks ────────────────────────────────────────────────────────────────────
const createTaskRules = [
  body('title').trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2–255 characters.'),
  body('assigned_to').optional().isUUID(4).withMessage('assigned_to must be a valid UUID.'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority.'),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done', 'cancelled']).withMessage('Invalid status.'),
  body('due_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid due_date.'),
  body('progress_percent').optional().isInt({ min: 0, max: 100 }).withMessage('progress_percent must be 0–100.'),
  body('customer_id').optional({ checkFalsy: true }).isUUID(4).withMessage('customer_id must be a valid UUID.'),
  body('order_id').optional({ checkFalsy: true }).isUUID(4).withMessage('order_id must be a valid UUID.'),
];

const updateTaskRules = [
  body('title').optional().trim().isLength({ min: 2, max: 255 }).withMessage('Title must be 2–255 characters.'),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done', 'cancelled']).withMessage('Invalid status.'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority.'),
  body('progress_percent').optional().isInt({ min: 0, max: 100 }).withMessage('progress_percent must be 0–100.'),
];

// SOW §3.7 — Task Score Management
const taskScoreRules = [
  body('score').isFloat({ min: 0, max: 10 }).withMessage('score must be a number between 0 and 10.'),
  body('score_comment').optional().trim().isLength({ max: 1000 }).withMessage('score_comment must be under 1000 characters.'),
];

// ─── WhatsApp manual send ─────────────────────────────────────────────────────
const manualSendRules = [
  body('phone').isMobilePhone('any').withMessage('Valid phone number required.'),
  body('template_name').trim().notEmpty().withMessage('template_name is required.'),
  body('customer_id').optional({ checkFalsy: true }).isUUID(4).withMessage('customer_id must be a valid UUID.'),
  body('order_id').optional({ checkFalsy: true }).isUUID(4).withMessage('order_id must be a valid UUID.'),
];

// ─── Shipping Partners ────────────────────────────────────────────────────────
const createShippingPartnerRules = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('code').trim().isLength({ min: 2, max: 20 }).withMessage('Code must be 2–20 characters.')
    .matches(/^[A-Za-z0-9_-]+$/).withMessage('Code may only contain letters, numbers, hyphens, underscores.'),
  body('contact_phone').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid phone number.'),
  body('contact_email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email.'),
  body('tracking_url_template').optional({ checkFalsy: true }).isURL({ require_tld: false }).withMessage('Invalid tracking URL template.'),
  body('default_tat_days').optional({ checkFalsy: true }).isInt({ min: 0, max: 60 }).withMessage('TAT must be 0–60 days.'),
];

const updateShippingPartnerRules = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('code').optional().trim().isLength({ min: 2, max: 20 }).withMessage('Code must be 2–20 characters.'),
  body('contact_email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email.'),
  body('is_active').optional().isBoolean().withMessage('is_active must be boolean.'),
  body('default_tat_days').optional({ checkFalsy: true }).isInt({ min: 0, max: 60 }).withMessage('TAT must be 0–60 days.'),
];

// ─── Pincode Serviceability ────────────────────────────────────────────────────
const createServiceabilityRules = [
  body('pincode').trim().matches(/^\d{4,10}$/).withMessage('Pincode must be 4–10 digits.'),
  body('tat_days').isInt({ min: 0, max: 60 }).withMessage('tat_days must be 0–60.'),
  body('shipping_partner_id').optional({ checkFalsy: true }).isUUID(4).withMessage('shipping_partner_id must be a valid UUID.'),
  body('is_serviceable').optional().isBoolean().withMessage('is_serviceable must be boolean.'),
  body('cod_available').optional().isBoolean().withMessage('cod_available must be boolean.'),
];

const updateServiceabilityRules = [
  body('tat_days').optional().isInt({ min: 0, max: 60 }).withMessage('tat_days must be 0–60.'),
  body('is_serviceable').optional().isBoolean().withMessage('is_serviceable must be boolean.'),
  body('cod_available').optional().isBoolean().withMessage('cod_available must be boolean.'),
];

const bulkServiceabilityRules = [
  body('entries').isArray({ min: 1, max: 1000 }).withMessage('entries must be an array of 1–1000 items.'),
  body('entries.*.pincode').notEmpty().withMessage('Each entry requires a pincode.'),
  body('entries.*.tat_days').isInt({ min: 0, max: 60 }).withMessage('Each entry requires tat_days (0–60).'),
];

// ─── Order Shipping Update ─────────────────────────────────────────────────────
const updateOrderShippingRules = [
  param('id').isUUID(4).withMessage('Valid order ID required.'),
  body('tracking_number').optional({ checkFalsy: true }).trim().isLength({ max: 150 }).withMessage('Tracking number too long.'),
  body('shipping_partner').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Shipping partner name too long.'),
  body('delivery_pincode').optional({ checkFalsy: true }).matches(/^\d{4,10}$/).withMessage('Invalid pincode.'),
  body('estimated_delivery_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid estimated_delivery_date.'),
  body('mark_dispatched').optional().isBoolean().withMessage('mark_dispatched must be boolean.'),
];

// ─── CR1 — Image Approval / Rejection ────────────────────────────────────────
const imageApprovalRules = [
  param('id').isUUID(4).withMessage('Valid order ID required.'),
  body('note').optional().trim().isLength({ max: 500 }).withMessage('Note too long.'),
];

const imageRejectionRules = [
  param('id').isUUID(4).withMessage('Valid order ID required.'),
  body('reason').trim().notEmpty().withMessage('Rejection reason is required.').isLength({ max: 500 }),
  body('request_new').optional().isBoolean().withMessage('request_new must be boolean.'),
];

// ─── CR2 — Manual Call Log ────────────────────────────────────────────────────
const createCallLogRules = [
  body('customer_id').isUUID(4).withMessage('Valid customer_id (UUID) required.'),
  body('order_id').optional({ checkFalsy: true }).isUUID(4).withMessage('order_id must be a valid UUID.'),
  body('call_type').optional().isIn(['outbound', 'inbound']).withMessage('call_type must be outbound or inbound.'),
  body('outcome').optional().isIn(['answered', 'no_answer', 'busy', 'callback_requested', 'confirmed', 'rejected', 'escalated']).withMessage('Invalid outcome.'),
  body('context').optional().isIn(['image_collection', 'reorder_assistance', 'feedback_resolution', 'general']).withMessage('Invalid context.'),
  body('duration_seconds').optional({ checkFalsy: true }).isInt({ min: 0, max: 86400 }).withMessage('Duration must be 0–86400 seconds.'),
  body('phone_used').optional({ checkFalsy: true }).isLength({ max: 20 }).withMessage('Phone number too long.'),
  body('called_at').optional().isISO8601().withMessage('Invalid called_at date.'),
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notes too long.'),
];

const updateCallLogRules = [
  body('outcome').optional().isIn(['answered', 'no_answer', 'busy', 'callback_requested', 'confirmed', 'rejected', 'escalated']).withMessage('Invalid outcome.'),
  body('context').optional().isIn(['image_collection', 'reorder_assistance', 'feedback_resolution', 'general']).withMessage('Invalid context.'),
  body('duration_seconds').optional({ checkFalsy: true }).isInt({ min: 0, max: 86400 }).withMessage('Duration must be 0–86400 seconds.'),
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notes too long.'),
];

// ─── CR4 — Customer Lifecycle ─────────────────────────────────────────────────
const lifecycleUpdateRules = [
  body('stage').isIn(['prospect', 'customer', 'installation_pending', 'installation_done', 'feedback_pending', 'engaged'])
    .withMessage('Invalid lifecycle stage.'),
  body('engagement_notes').optional().trim().isLength({ max: 2000 }).withMessage('Engagement notes too long.'),
];

// ─── CR7 — Feedback Resolution ────────────────────────────────────────────────
const feedbackResolutionRules = [
  param('id').isUUID(4).withMessage('Valid order ID required.'),
  body('feedback_status').isIn(['not_collected', 'happy', 'unhappy', 'escalated', 'resolved'])
    .withMessage('Invalid feedback_status.'),
  body('feedback_issue_notes').optional().trim().isLength({ max: 2000 }).withMessage('Issue notes too long.'),
  body('customer_feedback').optional().trim().isLength({ max: 2000 }).withMessage('Feedback too long.'),
  body('feedback_rating').optional({ checkFalsy: true }).isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5.'),
];

module.exports = {
  validate,
  loginRules,
  createUserRules,
  changePasswordRules,
  createCustomerRules,
  updateCustomerRules,
  createOrderRules,
  updateStatusRules,
  updateFlowStageRules,
  bulkStatusRules,
  createFollowUpRules,
  updateFollowUpRules,
  createTaskRules,
  updateTaskRules,
  taskScoreRules,
  manualSendRules,
  createShippingPartnerRules,
  updateShippingPartnerRules,
  createServiceabilityRules,
  updateServiceabilityRules,
  bulkServiceabilityRules,
  updateOrderShippingRules,
  // CR1
  imageApprovalRules,
  imageRejectionRules,
  // CR2
  createCallLogRules,
  updateCallLogRules,
  // CR4
  lifecycleUpdateRules,
  // CR7
  feedbackResolutionRules,
};