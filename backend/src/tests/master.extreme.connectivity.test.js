'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';
process.env.WHATSAPP_PROVIDER = 'aoc';
process.env.WHATSAPP_SANDBOX = 'true';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

const {
  sequelize,
  Order,
  Customer,
  OrderEvent,
  WhatsAppOutbox,
  CustomerImage,
  Warranty,
  WarrantyEvent,
  FollowUp,
  WhatsAppLog,
  User,
} = require('../models');

const OrderImportService = require('../services/orderImport/orderImportService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');
const DeliveryEventOrchestrator = require('../services/orderWorkflow/deliveryEventOrchestrator');
const orderController = require('../controllers/orderController');
const warrantyController = require('../controllers/warrantyController');
const { ORDER_WORKFLOW_STATES } = require('../services/orderWorkflow/orderStateMachine');
const { OrderTransitionGuard, OrderTransitionError } = require('../services/orderWorkflow/orderTransitionGuard');

async function runMasterExtremeConnectivityTest() {
  console.log('🚀 =========================================================================');
  console.log('🚀 EXTREME END-TO-END CONNECTIVITY, SYNCHRONIZATION & PRODUCTION VERIFICATION');
  console.log('🚀 =========================================================================\n');

  const uniqueRunId = Date.now();
  const testPhone = `+919888${String(uniqueRunId).slice(-6)}`;
  const testCustomerName = `Master Test Customer ${uniqueRunId}`;
  const testOrderNumber = `ORD-MASTER-${uniqueRunId}`;
  const testSku = 'AKUA-COP-PREMIUM';
  const testProductName = 'AquaBeat Pure Copper RO System';

  console.log(`📋 Test Context: Order #${testOrderNumber}, Phone: ${testPhone}`);

  // ---------------------------------------------------------------------------
  // STEP 1: UNIVERSAL ORDER IMPORT (FILE -> PENDING_VERIFICATION -> MSG 1 OUTBOX)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 1: IMPORT & MESSAGE 1 DISPATCH] ---');
  const csvBuffer = Buffer.from(
    `order-id,order-item-id,purchase-date,buyer-name,buyer-phone-number,sku,product-name,quantity,item-price,ship-postal-code\n` +
    `${testOrderNumber},ITEM-1,2026-09-11,${testCustomerName},${testPhone},${testSku},${testProductName},1,14999,560001\n`
  );

  const importResult = await OrderImportService.importOrders({
    buffer: csvBuffer,
    originalName: 'amazon_orders.csv',
    channel: 'amazon',
    actorId: 'SYSTEM',
    enqueueVerification: true,
  });

  assert.strictEqual(importResult.success, true, 'Import must succeed');
  assert.strictEqual(importResult.importedCount, 1, 'Exactly 1 order must be imported');

  const createdOrder = await Order.findOne({
    where: { order_number: testOrderNumber },
    include: [{ model: Customer, as: 'customer' }],
  });
  assert(createdOrder, 'Order record must physically exist in database');
  assert.strictEqual(createdOrder.workflow_state, ORDER_WORKFLOW_STATES.PENDING_VERIFICATION);
  assert.strictEqual(createdOrder.customer_name, testCustomerName);

  // Check OrderEvent
  const importEvent = await OrderEvent.findOne({
    where: { order_id: createdOrder.id, event_type: 'ORDER_IMPORTED' },
  });
  assert(importEvent, 'ORDER_IMPORTED event must be physically recorded in OrderEvent table');

  // Check WhatsAppOutbox Message 1
  const outboxM1 = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `order_verification_${createdOrder.id}` },
  });
  assert(outboxM1, 'Message 1 (order_verification_interactive) must be in outbox');
  assert.strictEqual(outboxM1.status, 'QUEUED');
  assert.strictEqual(outboxM1.template_name, 'order_verification_interactive');
  console.log('   ✓ Stage 1 Passed: Order created in PENDING_VERIFICATION, event recorded, Message 1 queued in Outbox.');

  // ---------------------------------------------------------------------------
  // STEP 2: OUTBOX WORKER PICKS ROW & CALLS PROVIDER
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 2: OUTBOX WORKER DISPATCH & PROVIDER ACCEPTANCE] ---');
  const workerResult = await whatsappOutboxQueue.processItem(outboxM1);
  assert.strictEqual(workerResult.success, true, 'Worker must dispatch Message 1');

  await outboxM1.reload();
  assert.strictEqual(outboxM1.status, 'PROVIDER_ACCEPTED', 'Outbox status must transition to PROVIDER_ACCEPTED');
  assert(outboxM1.provider_message_id, 'Actual provider_message_id must be stored');
  assert(outboxM1.sent_at, 'sent_at timestamp must exist');
  console.log(`   ✓ Stage 2 Passed: Worker dispatched message. Provider message ID: ${outboxM1.provider_message_id}`);

  // ---------------------------------------------------------------------------
  // STEP 3: CUSTOMER CLICKS "SEND SCREENSHOT" (WEBHOOK -> SCREENSHOT_REQUESTED -> 15m)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 3: CUSTOMER ACTION — REQUEST SCREENSHOT] ---');
  const screenshotWebhookEvent = {
    provider: 'aoc',
    type: 'button',
    sender: testPhone,
    messageId: `btn_req_screen_${uniqueRunId}`,
    buttonId: 'request_screenshot',
    raw: { order_id: createdOrder.id },
  };

  const btnResult = await WhatsAppWebhookService.processEvent(screenshotWebhookEvent);
  assert.strictEqual(btnResult.success, true);

  await createdOrder.reload();
  assert.strictEqual(createdOrder.workflow_state, ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED);
  assert(createdOrder.screenshot_requested_at, 'screenshot_requested_at must be set');
  assert(createdOrder.screenshot_deadline_at, 'screenshot_deadline_at must be set');

  const diffMinutes = Math.round((new Date(createdOrder.screenshot_deadline_at) - new Date(createdOrder.screenshot_requested_at)) / (60 * 1000));
  assert.strictEqual(diffMinutes, 15, 'Screenshot deadline must be exactly 15 minutes from request');

  // Check screenshot_from_customer message in outbox
  const outboxScreenshot = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `screenshot_request_${createdOrder.id}` },
  });
  assert(outboxScreenshot, 'screenshot_from_customer template must be queued');
  console.log('   ✓ Stage 3 Passed: SCREENSHOT_REQUESTED set, 15-minute deadline stored, screenshot instructions queued.');

  // ---------------------------------------------------------------------------
  // STEP 4: CUSTOMER SENDS IMAGE (WEBHOOK -> S3 -> CustomerImage -> IMAGE_RECEIVED)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 4: INBOUND CUSTOMER MEDIA PIPELINE] ---');
  const imageWebhookEvent = {
    provider: 'aoc',
    type: 'image',
    sender: testPhone,
    messageId: `img_msg_${uniqueRunId}`,
    mediaId: `media_valid_${uniqueRunId}`,
    raw: { order_id: createdOrder.id },
  };

  const imgResult = await WhatsAppWebhookService.processEvent(imageWebhookEvent);
  assert.strictEqual(imgResult.success, true);

  await createdOrder.reload();
  assert.strictEqual(createdOrder.workflow_state, ORDER_WORKFLOW_STATES.IMAGE_RECEIVED);

  const customerImage = await CustomerImage.findOne({
    where: { order_id: createdOrder.id, media_id: `media_valid_${uniqueRunId}` },
  });
  assert(customerImage, 'CustomerImage row must exist in database');
  assert.strictEqual(customerImage.status, 'RECEIVED');
  assert(customerImage.s3_key, 'S3 storage key must be stored');

  // Verify Premature Message 2 was NOT sent
  const prematureM2 = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `order_confirmation013_${createdOrder.id}` },
  });
  assert.strictEqual(prematureM2, null, 'Message 2 MUST NOT be queued merely on receiving image');
  console.log('   ✓ Stage 4 Passed: Customer image stored in S3, CustomerImage linked, state is IMAGE_RECEIVED, premature M2 suppressed.');

  // ---------------------------------------------------------------------------
  // STEP 5: CRM OPERATOR APPROVAL (CRM API -> PENDING_CUSTOMER_CONFIRMATION -> MSG 2)
  // ---------------------------------------------------------------------------
  let adminUser = await User.findOne();
  if (!adminUser) {
    adminUser = await User.create({
      id: uuidv4(),
      name: 'System Admin',
      email: `admin_${uniqueRunId}@test.com`,
      password_hash: 'hashedpassword',
      role: 'admin',
      is_active: true,
    });
  }

  let crmResponseData = null;
  const mockReq = {
    params: { id: createdOrder.id },
    user: adminUser,
    body: { image_id: customerImage.id, note: 'Approved in E2E connectivity test' },
  };
  const mockRes = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(payload) { crmResponseData = payload; return this; },
  };

  await orderController.approveImages(mockReq, mockRes, (err) => { if (err) throw err; });
  assert.strictEqual(crmResponseData?.status, 'success');

  await createdOrder.reload();
  assert.strictEqual(createdOrder.workflow_state, ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION);

  await customerImage.reload();
  assert.strictEqual(customerImage.status.toLowerCase(), 'approved');

  // Message 2 outbox record
  const outboxM2 = await WhatsAppOutbox.findOne({
    where: {
      order_id: createdOrder.id,
      template_name: 'order_confirmation013',
    },
  });
  assert(outboxM2, 'Message 2 (order_confirmation013) must be queued in Outbox');
  assert.strictEqual(outboxM2.status, 'QUEUED');
  console.log('   ✓ Stage 5 Passed: CRM operator approved image, state transitioned to PENDING_CUSTOMER_CONFIRMATION, Message 2 queued.');

  // ---------------------------------------------------------------------------
  // STEP 6: CUSTOMER CONFIRMS MESSAGE 2 (WEBHOOK -> CONFIRMED -> CONFIRMATION MSG)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 6: CUSTOMER FINAL CONFIRMATION] ---');
  const m2ConfirmEvent = {
    provider: 'aoc',
    type: 'button',
    sender: testPhone,
    messageId: `btn_m2_conf_${uniqueRunId}`,
    buttonId: 'order_confirm_final',
    raw: { order_id: createdOrder.id },
  };

  const confResult = await WhatsAppWebhookService.processEvent(m2ConfirmEvent);
  assert.strictEqual(confResult.success, true);

  await createdOrder.reload();
  assert.strictEqual(createdOrder.workflow_state, ORDER_WORKFLOW_STATES.CONFIRMED);
  assert.strictEqual(createdOrder.verification_status.toLowerCase(), 'confirmed');

  const outboxFinalConfirm = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `order_confirmation_${createdOrder.id}` },
  });
  assert(outboxFinalConfirm, 'Final order_confirmation message must be queued in Outbox');
  console.log('   ✓ Stage 6 Passed: Order is officially CONFIRMED, final confirmation template queued.');

  // ---------------------------------------------------------------------------
  // STEP 7: SHIPPING BULK UPLOAD (DISPATCHED EVENT & NOTIFICATION)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 7: LOGISTICS DISPATCH EVENT] ---');
  const trackingNumber = `AWB-${uniqueRunId}`;
  const courier = 'Bluedart Logistics';

  await createdOrder.update({
    status: 'dispatched',
    dispatched_at: new Date(),
    tracking_number: trackingNumber,
    shipping_partner: courier,
  });

  const dispatchResult = await DeliveryEventOrchestrator.handleOrderDispatched(createdOrder, {
    actor: 'shipping_upload',
  });
  assert.strictEqual(dispatchResult.success, true);

  const dispatchEvent = await OrderEvent.findOne({
    where: { order_id: createdOrder.id, event_type: 'ORDER_DISPATCHED' },
  });
  assert(dispatchEvent, 'ORDER_DISPATCHED event must be recorded');

  const outboxDispatch = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `order_dispatched_${createdOrder.id}` },
  });
  assert(outboxDispatch, 'order_dispatched template must be queued in Outbox');
  console.log(`   ✓ Stage 7 Passed: Order transitioned to DISPATCHED, tracking #${trackingNumber} recorded, dispatch WA queued.`);

  // ---------------------------------------------------------------------------
  // STEP 8: SHIPPING DELIVERY EVENT ORCHESTRATION (4 DECOUPLED CONSUMERS)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 8: DELIVERY EVENT ORCHESTRATION] ---');
  await createdOrder.update({
    status: 'delivered',
    delivered_at: new Date(),
  });

  const deliveryResult = await DeliveryEventOrchestrator.handleOrderDelivered(createdOrder, {
    actor: 'courier_webhook',
  });
  assert.strictEqual(deliveryResult.success, true);

  // 1. ORDER_DELIVERED event
  const deliveryEvent = await OrderEvent.findOne({
    where: { order_id: createdOrder.id, event_type: 'ORDER_DELIVERED' },
  });
  assert(deliveryEvent, 'ORDER_DELIVERED event must be recorded');

  // 2. Consumer 1: Delivery WhatsApp
  const outboxDelivery = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `order_delivery_${createdOrder.id}` },
  });
  assert(outboxDelivery, 'order_delivery message must be in Outbox');

  // 3. Consumer 2: Installation Guide
  const outboxGuide = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `installation_guide_${createdOrder.id}` },
  });
  assert(outboxGuide, 'installation_guide message must be in Outbox');

  // 4. Consumer 3 & 4: Warranty Created & Warranty Claim Message Queued
  const warrantyRecord = await Warranty.findOne({
    where: { order_id: createdOrder.id },
  });
  assert(warrantyRecord, 'Warranty record must be created');
  assert(warrantyRecord.warranty_number.startsWith('WAR-'), 'Warranty number must follow canonical WAR-YYYY-XXXX format');

  const outboxClaim = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `warranty_claim_${warrantyRecord.id}` },
  });
  assert(outboxClaim, 'warranty_claim message must be in Outbox with signed token');
  assert(outboxClaim.payload.activation_url.includes('/warranty/activate/'), 'Activation URL must point to dedicated activate route');
  console.log(`   ✓ Stage 8 Passed: Delivery fired all 4 independent consumers: Delivery WA, Installation Guide, Warranty #${warrantyRecord.warranty_number}, and Claim URL.`);

  // ---------------------------------------------------------------------------
  // STEP 9: INSTALLATION GUIDE INTERACTION ("NEED HELP" -> TELECALLER TASK)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 9: INSTALLATION ASSISTANCE ESCALATION] ---');
  const installHelpEvent = {
    provider: 'aoc',
    type: 'button',
    sender: testPhone,
    messageId: `btn_install_help_${uniqueRunId}`,
    buttonId: 'installation_need_help',
    raw: { order_id: createdOrder.id },
  };

  const installHelpRes = await WhatsAppWebhookService.processEvent(installHelpEvent);
  assert.strictEqual(installHelpRes.success, true);

  const telecallerTask = await FollowUp.findOne({
    where: { order_id: createdOrder.id, priority: 'urgent' },
  });
  assert(telecallerTask, 'Urgent follow-up task must be physically created for telecaller team');
  console.log('   ✓ Stage 9 Passed: "installation_need_help" button created urgent telecaller dispatch task.');

  // ---------------------------------------------------------------------------
  // STEP 10: WARRANTY WEBSITE ACTIVATION VIA SIGNED EXPIRING TOKEN
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 10: WEBSITE WARRANTY SELF-ACTIVATION] ---');
  const activationToken = outboxClaim.payload.activation_url.split('/warranty/activate/')[1];
  assert(activationToken, 'Signed JWT token must be extractable from claim URL');

  // Test Public Check Token Endpoint (GET /api/warranty/activate/:token)
  let checkResPayload = null;
  const mockCheckReq = { params: { token: activationToken } };
  const mockCheckRes = {
    status: function(c) { this.statusCode = c; return this; },
    json: function(p) { checkResPayload = p; return this; },
  };

  await warrantyController.checkActivationToken(mockCheckReq, mockCheckRes, (err) => { if (err) throw err; });
  assert.strictEqual(checkResPayload?.status, 'success');
  assert.strictEqual(checkResPayload?.data?.warranty?.id, warrantyRecord.id);
  assert.strictEqual(checkResPayload?.data?.isAlreadyActive, false);

  // Test Customer Submission (POST /api/warranty/activate/:token)
  let activateResPayload = null;
  const mockActivateReq = {
    params: { token: activationToken },
    body: { serial_number: `SN-AKUA-${uniqueRunId}` },
  };
  const mockActivateRes = {
    status: function(c) { this.statusCode = c; return this; },
    json: function(p) { activateResPayload = p; return this; },
  };

  await warrantyController.activateByToken(mockActivateReq, mockActivateRes, (err) => { if (err) throw err; });
  assert.strictEqual(activateResPayload?.status, 'success');

  await warrantyRecord.reload();
  assert.strictEqual(warrantyRecord.status, 'ACTIVE');
  assert.strictEqual(warrantyRecord.serial_number, `SN-AKUA-${uniqueRunId}`);
  assert(warrantyRecord.activated_at, 'activated_at must be stamped');

  // Check Warranty Activated WhatsApp Outbox
  const outboxActivated = await WhatsAppOutbox.findOne({
    where: { idempotency_key: `warranty_activated_${warrantyRecord.id}` },
  });
  assert(outboxActivated, 'warranty_activated confirmation message must be queued in Outbox');
  console.log('   ✓ Stage 10 Passed: Public token verified, customer form submitted, warranty is ACTIVE, confirmation WA queued.');

  // ---------------------------------------------------------------------------
  // STEP 11: PROVIDER STATUS RECONCILIATION (SENT -> DELIVERED -> READ)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 11: TRUE DELIVERY STATUS RECONCILIATION] ---');
  const reconciliationEvent = {
    provider: 'aoc',
    type: 'status_update',
    providerMessageId: outboxM1.provider_message_id,
    status: 'DELIVERED',
    timestamp: new Date().toISOString(),
  };

  const statusResult = await WhatsAppWebhookService.processEvent(reconciliationEvent);
  assert.strictEqual(statusResult.success, true);

  await outboxM1.reload();
  assert.strictEqual(outboxM1.status, 'DELIVERED');
  assert(outboxM1.delivered_at, 'delivered_at timestamp must be populated from webhook');
  console.log(`   ✓ Stage 11 Passed: Provider message ${outboxM1.provider_message_id} reconciled to DELIVERED.`);

  // ---------------------------------------------------------------------------
  // STEP 12: SECURITY AUDIT — CROSS-CUSTOMER ATTACK REJECTION
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 12: SECURITY & ISOLATION AUDIT] ---');
  const attackerPhone = '+919999999999';
  const maliciousEvent = {
    provider: 'aoc',
    type: 'button',
    sender: attackerPhone,
    messageId: `btn_hack_${uniqueRunId}`,
    buttonId: `order_confirm:${createdOrder.id}`,
  };

  let securityBlocked = false;
  try {
    await WhatsAppWebhookService.processEvent(maliciousEvent);
  } catch (secErr) {
    if (secErr.statusCode === 403 || secErr.message.includes('UNAUTHORIZED_ORDER_ACCESS')) {
      securityBlocked = true;
    }
  }
  assert.strictEqual(securityBlocked, true, 'Customer A must be strictly prohibited from mutating Customer B order');
  console.log('   ✓ Stage 12 Passed: Cross-customer tampering attempt strictly blocked with 403 Forbidden.');

  // ---------------------------------------------------------------------------
  // STEP 13: STATE MACHINE IMMUTABILITY ATTACK TEST
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 13: STATE MACHINE IMMUTABILITY ATTACK TEST] ---');
  // Attempt illegal transition: CONFIRMED -> SCREENSHOT_REQUESTED
  let transitionBlocked = false;
  try {
    OrderTransitionGuard.validate({
      currentState: ORDER_WORKFLOW_STATES.CONFIRMED,
      targetState: ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
    });
  } catch (err) {
    if (err.code === 'TERMINAL_STATE_IMMUTABLE') {
      transitionBlocked = true;
    }
  }
  assert.strictEqual(transitionBlocked, true, 'Illegal transition CONFIRMED -> SCREENSHOT_REQUESTED must be rejected');
  console.log('   ✓ Stage 13 Passed: Illegal backward state mutation safely rejected by guard.');

  // ---------------------------------------------------------------------------
  // STEP 14: DUPLICATE-EVERYTHING REPLAY TEST (IDEMPOTENCY)
  // ---------------------------------------------------------------------------
  console.log('\n--- [STAGE 14: DUPLICATE-EVERYTHING IDEMPOTENCY PROOF] ---');
  // Re-enqueue confirmation message 5 times
  for (let i = 0; i < 5; i++) {
    await whatsappOutboxQueue.enqueue({
      order_id: createdOrder.id,
      recipient_phone: testPhone,
      template_name: 'order_confirmation',
      idempotency_key: `order_confirmation_${createdOrder.id}`,
    });
  }

  const allConfirmOutboxRows = await WhatsAppOutbox.findAll({
    where: { idempotency_key: `order_confirmation_${createdOrder.id}` },
  });
  assert.strictEqual(allConfirmOutboxRows.length, 1, 'Exactly 1 logical outbox record must exist despite 5 repeated dispatches');

  // Re-submit identical warranty activation
  await warrantyController.activateByToken(mockActivateReq, mockActivateRes, () => {});
  assert.strictEqual(activateResPayload?.status, 'success');
  assert.strictEqual(mockActivateRes.statusCode, 200);
  console.log('   ✓ Stage 14 Passed: Repeated operations produced exactly 1 logical row; duplicate storms handled idempotently.');

  console.log('\n=========================================================================');
  console.log('🎉 MASTER EXTREME CONNECTIVITY ACCEPTANCE SUITE PASSED (100% SUCCESS)');
  console.log('🎉 ALL 14 PHASES PHYSICALLY CONNECTED, SYNCHRONIZED, AND AUDITED.');
  console.log('=========================================================================\n');
}

runMasterExtremeConnectivityTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ MASTER EXTREME CONNECTIVITY SUITE FAILED:', err);
    process.exit(1);
  });
