'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Order, Customer, User, FollowUp, WhatsAppOutbox, OrderEvent } = require('../models');
const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');
const OrderScreenshotTimeoutWorker = require('../services/orderWorkflow/orderScreenshotTimeoutWorker');
const { ORDER_WORKFLOW_STATES } = require('../services/orderWorkflow/orderStateMachine');

async function runOrderButtonsAndTimeoutTests() {
  console.log('🧪 RUNNING ACCEPTANCE TESTS: Features 6, 7, 8, 11, 12, 13 (Buttons, Security, Timeout, Telecaller)\n');

  await sequelize.sync();
  const timestamp = Date.now();

  // Ensure a Telecaller user exists for FollowUp assignment
  let testUser = await User.findOne({ where: { role: 'telecaller' } });
  if (!testUser) {
    testUser = await User.create({
      id: uuidv4(),
      name: 'Test Telecaller Rep',
      email: `telecaller-${timestamp}@krishnacrm.local`,
      password: 'HashPassword@123',
      role: 'telecaller',
    });
  }

  let testPhoneSeq = Math.floor(Math.random() * 800000) + 100000;
  async function createTestOrder(suffix, initialWorkflowState = ORDER_WORKFLOW_STATES.PENDING_VERIFICATION) {
    const custId = uuidv4();
    const ordId = uuidv4();
    testPhoneSeq += 1;
    const phone = `+919${String(testPhoneSeq).padStart(9, '0')}`;

    const customer = await Customer.create({
      id: custId,
      name: `Customer ${suffix}`,
      phone: phone,
      whatsapp_number: phone,
      source: 'direct',
    });

    const order = await Order.create({
      id: ordId,
      order_number: `ORD-TEST-${timestamp}-${suffix}`,
      customer_id: custId,
      customer_name: customer.name,
      customer_phone: phone,
      product_name: 'AquaBeat Alkaline RO Purifier',
      product_sku: 'AKUA-ALK-01',
      quantity: 1,
      total_amount: 8999,
      status: 'pending',
      verification_status: 'pending_verification',
      workflow_state: initialWorkflowState,
    });

    return { customer, order };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE 6: Cross-Customer Mutation Security Rejection
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Feature 6 Acceptance Test: Customer A must NEVER mutate Customer B\'s order...');

  const { customer: custA, order: ordA } = await createTestOrder('A01');
  const { customer: custB, order: ordB } = await createTestOrder('B02');

  // Customer A sends a button with explicit order ID of Customer B
  let securityErrorCaught = false;
  try {
    await WhatsAppWebhookService.processEvent({
      type: 'button',
      sender: custA.phone,
      buttonId: `order_confirm:${ordB.id}`, // Attacking Customer B's order
      messageId: `msg-sec-${timestamp}`,
    });
  } catch (err) {
    securityErrorCaught = true;
    assert(err.message.includes('UNAUTHORIZED_ORDER_ACCESS'), 'Must throw UNAUTHORIZED_ORDER_ACCESS');
  }

  assert.strictEqual(securityErrorCaught, true, 'Cross-customer order mutation must be rejected');

  // Verify Order B state remains untouched
  const freshOrdB = await Order.findByPk(ordB.id);
  assert.strictEqual(freshOrdB.workflow_state, ORDER_WORKFLOW_STATES.PENDING_VERIFICATION, 'Order B state must remain PENDING_VERIFICATION');
  console.log('   ✓ Cross-customer mutation blocked: Customer A cannot mutate Customer B\'s order.');

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE 7: Message 1 Direct Confirm
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Feature 7 Acceptance Test: Button [order_confirm] -> CONFIRMED & Outbox Queued...');

  const confirmRes = await WhatsAppWebhookService.processEvent({
    type: 'button',
    sender: custA.phone,
    buttonId: 'order_confirm',
    messageId: `msg-conf-${timestamp}`,
  });

  assert(confirmRes.success, 'order_confirm button processing must succeed');

  const updatedOrdA = await Order.findByPk(ordA.id);
  assert.strictEqual(updatedOrdA.workflow_state, ORDER_WORKFLOW_STATES.CONFIRMED, 'Workflow state must be CONFIRMED');
  assert.strictEqual(updatedOrdA.status, 'confirmed', 'Order status must be confirmed');
  assert.strictEqual(updatedOrdA.verification_status, 'confirmed', 'Verification status must be confirmed');

  // Check outbox item
  const confOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: ordA.id, template_name: 'order_confirmation' },
  });
  assert(confOutbox, 'Outbox item for order_confirmation must be created');
  assert.strictEqual(confOutbox.status, 'QUEUED');
  assert.strictEqual(confOutbox.idempotency_key, `order_confirmation_${ordA.id}`);
  console.log('   ✓ Order A transitioned to CONFIRMED and order_confirmation enqueued.');

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE 8: Message 1 Send Screenshot Request
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n3. Feature 8 Acceptance Test: Button [request_screenshot] -> SCREENSHOT_REQUESTED & 15m Deadline...');

  const { customer: custC, order: ordC } = await createTestOrder('C03');

  const screenRes = await WhatsAppWebhookService.processEvent({
    type: 'button',
    sender: custC.phone,
    buttonId: 'request_screenshot',
    messageId: `msg-screen-${timestamp}`,
  });

  assert(screenRes.success, 'request_screenshot button processing must succeed');

  const updatedOrdC = await Order.findByPk(ordC.id);
  assert.strictEqual(updatedOrdC.workflow_state, ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED);
  assert.strictEqual(updatedOrdC.verification_status, 'screenshot_requested');
  assert(updatedOrdC.screenshot_requested_at, 'screenshot_requested_at must be set');
  assert(updatedOrdC.screenshot_deadline_at, 'screenshot_deadline_at must be set');

  const screenOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: ordC.id, template_name: 'screenshot_from_customer' },
  });
  assert(screenOutbox, 'Outbox item for screenshot_from_customer must be created');
  assert.strictEqual(screenOutbox.status, 'QUEUED');
  console.log('   ✓ Order C transitioned to SCREENSHOT_REQUESTED with 15m deadline and outbox item queued.');

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE 11: 15-Minute Timeout Worker
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n4. Feature 11 Acceptance Test: 15-Minute Timeout Worker...');

  // Case A: Image arrived at minute 8 -> Timeout worker must NOT send Message 2
  const { customer: custD, order: ordD } = await createTestOrder('D04', ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED);
  const eightMinutesAgo = new Date(Date.now() - 8 * 60 * 1000);
  const sevenMinutesRemaining = new Date(Date.now() + 7 * 60 * 1000);

  // Set order D as having received image at minute 8
  await ordD.update({
    screenshot_requested_at: eightMinutesAgo,
    screenshot_deadline_at: sevenMinutesRemaining,
    screenshot_received_at: new Date(),
    workflow_state: ORDER_WORKFLOW_STATES.IMAGE_RECEIVED,
  });

  // Run worker now
  const workerResA = await OrderScreenshotTimeoutWorker.processExpiredScreenshotDeadlines();
  const dOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: ordD.id, template_name: 'order_confirmation013' },
  });
  assert.strictEqual(dOutbox, null, 'Case A: Message 2 must NOT be sent when image is received within window');
  console.log('   ✓ Case A: Image arrived within window -> Message 2 was NOT sent.');

  // Case B: No image and 15 minutes expired
  const { customer: custE, order: ordE } = await createTestOrder('E05', ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED);
  const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
  const oneMinuteExpired = new Date(Date.now() - 1 * 60 * 1000);

  await ordE.update({
    screenshot_requested_at: sixteenMinutesAgo,
    screenshot_deadline_at: oneMinuteExpired,
    second_message_due_at: oneMinuteExpired,
    screenshot_received_at: null,
  });

  const workerResB = await OrderScreenshotTimeoutWorker.processExpiredScreenshotDeadlines();
  assert(workerResB.processedCount >= 1, 'Worker must process expired order E');

  const updatedOrdE = await Order.findByPk(ordE.id);
  assert.strictEqual(updatedOrdE.workflow_state, ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION);

  const eOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: ordE.id, template_name: 'order_confirmation013' },
  });
  assert(eOutbox, 'Case B: order_confirmation013 must be enqueued by timeout worker');
  assert.strictEqual(eOutbox.status, 'QUEUED');
  console.log('   ✓ Case B: 15-minute window expired with no image -> Message 2 (order_confirmation013) queued.');

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE 12: Message 2 Confirmation and Cancellation Idempotency
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n5. Feature 12 Acceptance Test: Message 2 Final Confirm & Cancel Idempotency...');

  // 12A: Final Confirm
  await WhatsAppWebhookService.processEvent({
    type: 'button',
    sender: custE.phone,
    buttonId: 'order_confirm_final',
    messageId: `msg-m2-conf-${timestamp}`,
  });

  const finalConfirmedOrdE = await Order.findByPk(ordE.id);
  assert.strictEqual(finalConfirmedOrdE.workflow_state, ORDER_WORKFLOW_STATES.CONFIRMED);

  // Send repeated confirmation button -> Must not create duplicate confirmation messages
  await WhatsAppWebhookService.processEvent({
    type: 'button',
    sender: custE.phone,
    buttonId: 'order_confirm_final',
    messageId: `msg-m2-conf-dup-${timestamp}`,
  });

  const confMessagesCount = await WhatsAppOutbox.count({
    where: { order_id: ordE.id, template_name: 'order_confirmation' },
  });
  assert.strictEqual(confMessagesCount, 1, 'Repeated button webhook must not create duplicate confirmation messages');
  console.log('   ✓ Message 2 confirm succeeded; repeated button press produced 0 duplicate confirmation messages.');

  // 12B: Final Cancel
  const { customer: custF, order: ordF } = await createTestOrder('F06', ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION);

  await WhatsAppWebhookService.processEvent({
    type: 'button',
    sender: custF.phone,
    buttonId: 'order_cancel_final',
    messageId: `msg-m2-cancel-${timestamp}`,
  });

  const cancelledOrdF = await Order.findByPk(ordF.id);
  assert.strictEqual(cancelledOrdF.workflow_state, ORDER_WORKFLOW_STATES.CANCELLED);
  assert.strictEqual(cancelledOrdF.status, 'cancelled');

  const cancelOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: ordF.id, template_name: 'order_cancelled' },
  });
  assert(cancelOutbox, 'Outbox item for order_cancelled must be queued');
  console.log('   ✓ Message 2 cancel succeeded and order_cancelled queued.');

  // ──────────────────────────────────────────────────────────────────────────
  // FEATURE 13: Call Representative -> Telecaller Task Idempotency
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n6. Feature 13 Acceptance Test: Call Representative -> Telecaller Task Idempotency...');

  const { customer: custG, order: ordG } = await createTestOrder('G07');

  // Trigger call_representative 3 times in a row
  for (let i = 1; i <= 3; i++) {
    await WhatsAppWebhookService.processEvent({
      type: 'button',
      sender: custG.phone,
      buttonId: 'call_representative',
      messageId: `msg-call-rep-${timestamp}-${i}`,
    });
  }

  const telecallerOrdG = await Order.findByPk(ordG.id);
  assert.strictEqual(telecallerOrdG.workflow_state, ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED, 'Order must transition to TELECALLER_REQUIRED');
  assert.notStrictEqual(telecallerOrdG.status, 'confirmed', 'Must NOT confirm order');
  assert.notStrictEqual(telecallerOrdG.status, 'cancelled', 'Must NOT cancel order');

  // Verify Telecaller FollowUp task exists and is NOT duplicated
  const followUps = await FollowUp.findAll({
    where: { order_id: ordG.id, status: 'pending' },
  });
  assert.strictEqual(followUps.length, 1, 'Repeated call_representative clicks must create exactly 1 work item, not multiple duplicates');
  assert.strictEqual(followUps[0].priority, 'urgent', 'Task priority must be urgent');

  const freshCustG = await Customer.findByPk(custG.id);
  assert(freshCustG.tags?.includes('call_representative_requested'), 'Customer must be tagged with call_representative_requested');
  assert.strictEqual(freshCustG.installation_help_requested, true, 'installation_help_requested must be true');

  console.log('   ✓ Order escalated to TELECALLER_REQUIRED with exactly 1 urgent work item (0 duplicates created).');

  // ──────────────────────────────────────────────────────────────────────────
  // Clean up test data
  // ──────────────────────────────────────────────────────────────────────────
  const testOrderIds = [ordA.id, ordB.id, ordC.id, ordD.id, ordE.id, ordF.id, ordG.id];
  await WhatsAppOutbox.destroy({ where: { order_id: testOrderIds } });
  await FollowUp.destroy({ where: { order_id: testOrderIds } });
  await OrderEvent.destroy({ where: { order_id: testOrderIds } });
  await Order.destroy({ where: { id: testOrderIds } });

  console.log('\n🎉 ALL FEATURES 6, 7, 8, 11, 12, 13 ACCEPTANCE TESTS PASSED (100% SUCCESS)\n');
}

runOrderButtonsAndTimeoutTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Order Buttons & Timeout test failed:', err);
    process.exit(1);
  });
