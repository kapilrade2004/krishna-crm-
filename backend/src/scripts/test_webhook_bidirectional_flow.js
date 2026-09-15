'use strict';

require('dotenv').config();
const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Order, Customer, WhatsAppLog, WhatsAppOutbox, FollowUp } = require('../models');
const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const WhatsAppProviderFactory = require('../services/whatsapp/whatsappProviderFactory');

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 TESTING WHATSAPP BIDIRECTIONAL FLOW & DOWNSTREAM DISPATCH');
  console.log('======================================================\n');

  const testPhone = '+917768868525';
  const rawSender = '917768868525';

  // 1. Setup Test Customer & Order
  console.log('1. Setting up test customer and order in database...');
  let customer = await Customer.findOne({ where: { phone: testPhone } });
  if (!customer) {
    customer = await Customer.create({
      id: uuidv4(),
      name: 'Mohish Test',
      phone: testPhone,
      whatsapp_number: testPhone,
      status: 'active',
    });
  }

  const orderNumber = `TEST-E2E-${Date.now()}`;
  const order = await Order.create({
    id: uuidv4(),
    customer_id: customer.id,
    order_number: orderNumber,
    customer_name: customer.name,
    customer_phone: testPhone,
    product_name: 'AquaBeat Pure Copper RO Water Purifier',
    product_sku: 'AKUA-COP-01',
    quantity: 1,
    total_amount: 8999,
    status: 'pending',
    verification_status: 'pending_verification',
    workflow_state: 'PENDING_VERIFICATION',
    flow_stage: 'ask_images',
  });
  console.log(`   Created test order #${order.order_number} (ID: ${order.id})`);

  // 2. Test Component Building for all templates
  console.log('\n2. Testing buildCanonicalComponents for all templates against AOC specifications...');
  const compM1 = whatsappOutboxQueue.buildCanonicalComponents('order_verification_interactive', {
    customer_name: 'Test', order_number: 'ORD-1', product_name: 'Purifier', product_sku: 'SKU-1'
  });
  assert.strictEqual(compM1[0].parameters.length, 4, 'order_verification_interactive must have 4 parameters');
  console.log('   ✓ order_verification_interactive: 4 params');

  const compScreen = whatsappOutboxQueue.buildCanonicalComponents('screenshot_from_customer', {
    customer_name: 'Test', order_number: 'ORD-1'
  });
  assert.strictEqual(compScreen.length, 0, 'screenshot_from_customer must have 0 components (0 body params)');
  console.log('   ✓ screenshot_from_customer: 0 params (exact match for AOC)');

  const compConf = whatsappOutboxQueue.buildCanonicalComponents('order_confirmation', {
    customer_name: 'Test', order_number: 'ORD-1', product_name: 'Purifier'
  });
  assert.strictEqual(compConf[0].parameters.length, 3, 'order_confirmation must have 3 parameters');
  console.log('   ✓ order_confirmation: 3 params (customerName, orderNumber, productName)');

  const compCancel = whatsappOutboxQueue.buildCanonicalComponents('order_cancelled', {
    customer_name: 'Test', order_number: 'ORD-1', product_name: 'Purifier'
  });
  assert.strictEqual(compCancel[0].parameters.length, 3, 'order_cancelled must have 3 parameters');
  console.log('   ✓ order_cancelled: 3 params (customerName, orderNumber, productName)');

  const compConf013 = whatsappOutboxQueue.buildCanonicalComponents('order_confirmation013', {
    customer_name: 'Test', order_number: 'ORD-1', product_name: 'Purifier', product_sku: 'SKU-1', quantity: 1, total_amount: 8999
  });
  assert.strictEqual(compConf013[0].parameters.length, 6, 'order_confirmation013 must have 6 parameters');
  console.log('   ✓ order_confirmation013: 6 params (customerName, orderNumber, productName, productSku, quantityStr, amountStr)');

  const compDeliv = whatsappOutboxQueue.buildCanonicalComponents('order_deliverd', {
    customer_name: 'Test', order_number: 'ORD-1'
  });
  assert.strictEqual(compDeliv[0].parameters.length, 2, 'order_deliverd must have 2 parameters');
  console.log('   ✓ order_deliverd: 2 params');

  const compInst = whatsappOutboxQueue.buildCanonicalComponents('installation_guide', {
    customer_name: 'Test', product_name: 'Purifier', order_number: 'ORD-1'
  });
  assert.strictEqual(compInst[0].parameters.length, 3, 'installation_guide must have 3 parameters');
  console.log('   ✓ installation_guide: 3 params');

  const compDisp = whatsappOutboxQueue.buildCanonicalComponents('order_dispatched', {
    customer_name: 'Test', order_number: 'ORD-1', tracking_number: 'AWB123', shipping_partner: 'Delhivery'
  });
  assert.strictEqual(compDisp[0].parameters.length, 4, 'order_dispatched must have 4 parameters');
  console.log('   ✓ order_dispatched: 4 params');

  // 3. Test Webhook Normalization: Flat & Nested
  console.log('\n3. Testing AocProvider.normalizeWebhook on flat and nested payloads...');
  const aocProvider = WhatsAppProviderFactory.getProvider();

  // Nested Meta format
  const nestedPayload = {
    entry: [{ changes: [{ value: { messages: [{ from: rawSender, type: 'button', button: { id: 'btn_1', text: 'Send Screenshot' } }] } }] }]
  };
  const normNested = aocProvider.normalizeWebhook(nestedPayload);
  assert.strictEqual(normNested.length, 1);
  assert.strictEqual(normNested[0].type, 'button');
  assert.strictEqual(normNested[0].buttonId, 'btn_1');
  console.log('   ✓ Nested Meta payload normalized correctly');

  // Flat AOC format
  const flatPayload = {
    from: rawSender,
    type: 'button',
    button: { id: 'btn_1', text: 'Send Screenshot' }
  };
  const normFlat = aocProvider.normalizeWebhook(flatPayload);
  assert.strictEqual(normFlat.length, 1);
  assert.strictEqual(normFlat[0].type, 'button');
  assert.strictEqual(normFlat[0].buttonId, 'btn_1');
  console.log('   ✓ Flat AOC payload normalized correctly');

  // 4. Test Semantic Button Command Normalization
  console.log('\n4. Testing normalizeButtonCommand mapping...');
  assert.strictEqual(WhatsAppWebhookService.normalizeButtonCommand('Send Screenshot', 'Send Screenshot', order), 'request_screenshot');
  assert.strictEqual(WhatsAppWebhookService.normalizeButtonCommand('btn_1', '', order), 'request_screenshot');
  assert.strictEqual(WhatsAppWebhookService.normalizeButtonCommand('Yes, Confirm', 'Yes, Confirm', order), 'order_confirm');
  assert.strictEqual(WhatsAppWebhookService.normalizeButtonCommand('btn_0', '', order), 'order_confirm');
  assert.strictEqual(WhatsAppWebhookService.normalizeButtonCommand('Call Representative', 'Call Representative', order), 'call_representative');
  assert.strictEqual(WhatsAppWebhookService.normalizeButtonCommand('btn_2', '', order), 'call_representative');
  console.log('   ✓ All button commands mapped to canonical workflow states');

  // 5. Test Live Inbound Button Processing: [Send Screenshot]
  console.log(`\n5. Simulating customer tapping [Send Screenshot] on Order #${order.order_number}...`);
  const webhookEvent = {
    provider: 'aoc',
    type: 'button',
    senderPhone: testPhone,
    buttonId: `btn_1:${order.order_number}`,
    buttonTitle: 'Send Screenshot',
    messageId: `test_msg_${Date.now()}`,
  };

  const processResult = await WhatsAppWebhookService.processEvent(webhookEvent);
  console.log('   Process result:', processResult.success ? 'SUCCESS' : 'FAILED', processResult.error || '');

  // Verify Order transitioned to SCREENSHOT_REQUESTED
  const reloadedOrder = await Order.findByPk(order.id);
  console.log(`   Order state after button tap: workflow_state=${reloadedOrder.workflow_state}, verification_status=${reloadedOrder.verification_status}`);
  assert.strictEqual(reloadedOrder.workflow_state, 'SCREENSHOT_REQUESTED', 'Order workflow state must be SCREENSHOT_REQUESTED');

  // Verify Outbox item for screenshot_from_customer was created
  const outboxScreenshot = await WhatsAppOutbox.findOne({
    where: {
      order_id: order.id,
      template_name: 'screenshot_from_customer',
    }
  });
  assert.ok(outboxScreenshot, 'WhatsAppOutbox entry for screenshot_from_customer must exist');
  console.log(`   Outbox item created: #${outboxScreenshot.id}, status=${outboxScreenshot.status}`);

  // 6. Test Outbox Queue Processing with AOC Gateway
  console.log('\n6. Waiting for outbox queue worker to finish dispatching to AOC Gateway API...');
  let reloadedOutbox = await WhatsAppOutbox.findByPk(outboxScreenshot.id);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (reloadedOutbox.status === 'PROVIDER_ACCEPTED') break;
    await whatsappOutboxQueue.drainQueue(5, 5);
    await new Promise((r) => setTimeout(r, 400));
    reloadedOutbox = await WhatsAppOutbox.findByPk(outboxScreenshot.id);
  }

  console.log(`   Outbox item final status: status=${reloadedOutbox.status}, provider_message_id=${reloadedOutbox.provider_message_id || 'none'}`);
  assert.ok(['sent', 'PROVIDER_ACCEPTED'].includes(reloadedOutbox.status), `Outbox item must transition to sent, got ${reloadedOutbox.status}`);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! BIDIRECTIONAL LOOP VERIFIED END-TO-END.\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
