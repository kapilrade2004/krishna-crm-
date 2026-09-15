'use strict';

require('dotenv').config();
const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Order, Customer, WhatsAppOutbox, FollowUp } = require('../models');
const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');

async function testAllInputs() {
  console.log('\n--- Testing Inbound Actions: Text, Confirm Button, Call Representative ---');
  const testPhone = '+917768868525';
  let customer = await Customer.findOne({ where: { phone: testPhone } });

  // 1. Test Inbound Text: "Yes, confirm order"
  const order1 = await Order.create({
    id: uuidv4(),
    customer_id: customer.id,
    order_number: `TEST-CONF-${Date.now()}`,
    customer_name: customer.name,
    customer_phone: testPhone,
    status: 'pending',
    verification_status: 'pending_verification',
    workflow_state: 'PENDING_VERIFICATION',
    flow_stage: 'ask_images',
  });

  console.log(`1. Testing customer texting "Yes, confirm" for Order #${order1.order_number}...`);
  const textEvent = {
    provider: 'aoc',
    type: 'text',
    senderPhone: testPhone,
    text: `Yes confirm order ${order1.order_number}`,
    messageId: `text_msg_${Date.now()}`,
  };
  const textRes = await WhatsAppWebhookService.processEvent(textEvent);
  console.log('   Text process result:', textRes.success ? 'SUCCESS' : 'FAILED');
  const reloadedOrd1 = await Order.findByPk(order1.id);
  console.log(`   Order state: status=${reloadedOrd1.status}, workflow_state=${reloadedOrd1.workflow_state}`);
  assert.strictEqual(reloadedOrd1.status, 'confirmed');

  // Verify order_confirmation outbox item was created and can be dispatched
  const confOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: order1.id, template_name: 'order_confirmation' },
  });
  assert.ok(confOutbox, 'order_confirmation outbox item must exist');
  console.log(`   Outbox item created for order_confirmation: #${confOutbox.id}`);

  // 2. Test Call Representative button
  const order2 = await Order.create({
    id: uuidv4(),
    customer_id: customer.id,
    order_number: `TEST-CALL-${Date.now()}`,
    customer_name: customer.name,
    customer_phone: testPhone,
    status: 'pending',
    verification_status: 'pending_verification',
    workflow_state: 'PENDING_VERIFICATION',
    flow_stage: 'ask_images',
  });

  console.log(`\n2. Testing customer clicking [Call Representative] for Order #${order2.order_number}...`);
  const callEvent = {
    provider: 'aoc',
    type: 'button',
    senderPhone: testPhone,
    buttonId: `Call Representative:${order2.order_number}`,
    buttonTitle: 'Call Representative',
    messageId: `call_msg_${Date.now()}`,
  };
  const callRes = await WhatsAppWebhookService.processEvent(callEvent);
  console.log('   Call process result:', callRes.success ? 'SUCCESS' : 'FAILED');
  const reloadedOrd2 = await Order.findByPk(order2.id);
  console.log(`   Order state: verification_status=${reloadedOrd2.verification_status}, workflow_state=${reloadedOrd2.workflow_state}`);
  assert.strictEqual(reloadedOrd2.verification_status, 'call_representative_requested');

  const followUpTask = await FollowUp.findOne({
    where: { order_id: order2.id },
  });
  assert.ok(followUpTask, 'Urgent Telecaller FollowUp task must be created');
  console.log(`   FollowUp task created: #${followUpTask.id}, priority=${followUpTask.priority}, subject="${followUpTask.subject}"`);

  // 3. Test Cancel Order button
  const order3 = await Order.create({
    id: uuidv4(),
    customer_id: customer.id,
    order_number: `TEST-CANC-${Date.now()}`,
    customer_name: customer.name,
    customer_phone: testPhone,
    status: 'image_verification',
    verification_status: 'pending_confirmation',
    workflow_state: 'PENDING_CUSTOMER_CONFIRMATION',
    flow_stage: 'match_confirmed',
  });

  console.log(`\n3. Testing customer clicking [Cancel Order] for Order #${order3.order_number}...`);
  const cancelEvent = {
    provider: 'aoc',
    type: 'button',
    senderPhone: testPhone,
    buttonId: `Cancel Order:${order3.order_number}`,
    buttonTitle: 'Cancel Order',
    messageId: `canc_msg_${Date.now()}`,
  };
  const cancelRes = await WhatsAppWebhookService.processEvent(cancelEvent);
  console.log('   Cancel process result:', cancelRes.success ? 'SUCCESS' : 'FAILED');
  const reloadedOrd3 = await Order.findByPk(order3.id);
  console.log(`   Order state: status=${reloadedOrd3.status}, workflow_state=${reloadedOrd3.workflow_state}`);
  assert.strictEqual(reloadedOrd3.status, 'cancelled');

  const cancelOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: order3.id, template_name: 'order_cancelled' },
  });
  assert.ok(cancelOutbox, 'order_cancelled outbox item must exist');
  console.log(`   Outbox item created for order_cancelled: #${cancelOutbox.id}`);

  console.log('\n🎉 ALL INPUT TESTS (TEXT, CONFIRM, CALL REP, CANCEL) PASSED!\n');
  process.exit(0);
}

testAllInputs().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
