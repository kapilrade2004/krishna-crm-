'use strict';

require('dotenv').config();
const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Order, Customer, WhatsAppLog, WhatsAppOutbox, FollowUp, CustomerImage } = require('../models');
const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');
const OrderWorkflowService = require('../services/orderWorkflow/orderWorkflowService');
const { ORDER_WORKFLOW_STATES } = require('../services/orderWorkflow/orderStateMachine');

async function runVasify10WebhookTests() {
  console.log('\n========================================================================');
  console.log('🧪 TESTING VASIFY/AOC 10-PAYLOAD WEBHOOK SUITE IN EXACT SPECIFIED ORDER');
  console.log('   References: WEBHOOK_VASIFY_REVIEW.md & ORDER_PROCESSING_AUDIT.md');
  console.log('========================================================================\n');

  const testPhone = '+919988776655';
  const rawSender = '919988776655';

  // Ensure test customer exists
  let customer = await Customer.findOne({ where: { phone: testPhone } });
  if (!customer) {
    customer = await Customer.create({
      id: uuidv4(),
      name: 'Vasify Test Customer',
      phone: testPhone,
      whatsapp_number: testPhone,
      status: 'active',
    });
  }

  // Helper to create fresh test order
  const createOrder = async (suffix) => {
    const orderNum = `TEST-VASIFY-${Date.now()}-${suffix}`;
    return await Order.create({
      id: uuidv4(),
      customer_id: customer.id,
      order_number: orderNum,
      customer_name: customer.name,
      customer_phone: testPhone,
      product_name: 'AkuaBeat Copper RO Water Purifier',
      product_sku: 'AKUA-COP-01',
      quantity: 1,
      total_amount: 14999,
      status: 'pending',
      verification_status: 'pending_verification',
      workflow_state: ORDER_WORKFLOW_STATES.PENDING_VERIFICATION,
      flow_stage: 'order_created',
    });
  };

  let passed = 0;
  let total = 0;

  async function step(num, name, fn) {
    total++;
    process.stdout.write(`Step ${num}: ${name} ... `);
    try {
      await fn();
      passed++;
      console.log('✅ PASS');
    } catch (err) {
      console.log('❌ FAIL');
      console.error(`   Error: ${err.message}`);
      if (err.stack) console.error(err.stack.split('\n').slice(1, 3).join('\n'));
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Payload 1: Inbound Text
  // ---------------------------------------------------------------------------
  const order1 = await createOrder('1-TEXT');
  await step(1, 'Inbound customer text message', async () => {
    const payload = {
      event: 'user_initiated_messages(Text)',
      from: rawSender,
      type: 'text',
      messages: {
        from: rawSender,
        id: `wamid_vasify_text_${Date.now()}`,
        type: 'text',
        text: { body: 'Hello Krishna CRM team, checking my order status' },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1, 'Exactly 1 event processed');
    assert.strictEqual(results[0].success, true, 'Event must succeed');

    await order1.reload();
    // Inbound text does not mutate pending order state
    assert.strictEqual(order1.workflow_state, ORDER_WORKFLOW_STATES.PENDING_VERIFICATION);
  });

  // ---------------------------------------------------------------------------
  // Payload 2: Verification Button [Yes, Confirm]
  // ---------------------------------------------------------------------------
  await step(2, 'Verification button [Yes, Confirm]', async () => {
    const payload = {
      event: 'button_reply',
      from: rawSender,
      type: 'button',
      messages: {
        from: rawSender,
        id: `wamid_vasify_btn_confirm_${Date.now()}`,
        type: 'button',
        button: {
          payload: `order_confirm:${order1.id}`,
          text: 'Yes, Confirm',
        },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await order1.reload();
    assert.strictEqual(order1.workflow_state, ORDER_WORKFLOW_STATES.CONFIRMED);
    assert.strictEqual(order1.status, 'confirmed');

    // Verify outbox queued confirmation template
    const outbox = await WhatsAppOutbox.findOne({
      where: { order_id: order1.id, template_name: 'order_confirmation' },
    });
    assert.ok(outbox, 'order_confirmation outbox item must be enqueued');
  });

  // ---------------------------------------------------------------------------
  // Payload 3: Verification Button [Send Screenshot]
  // ---------------------------------------------------------------------------
  const order2 = await createOrder('2-SCREEN');
  await step(3, 'Verification button [Send Screenshot]', async () => {
    const payload = {
      event: 'button_reply',
      from: rawSender,
      type: 'button',
      messages: {
        from: rawSender,
        id: `wamid_vasify_btn_screen_${Date.now()}`,
        type: 'button',
        button: {
          payload: `request_screenshot:${order2.id}`,
          text: 'Send Screenshot',
        },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await order2.reload();
    assert.strictEqual(order2.workflow_state, ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED);
    assert.strictEqual(order2.verification_status, 'screenshot_requested');

    const outbox = await WhatsAppOutbox.findOne({
      where: { order_id: order2.id, template_name: 'screenshot_from_customer' },
    });
    assert.ok(outbox, 'screenshot_from_customer outbox item must be enqueued');
  });

  // ---------------------------------------------------------------------------
  // Payload 4: Inbound Image
  // ---------------------------------------------------------------------------
  await step(4, 'Inbound customer image (tap photo / screenshot)', async () => {
    const payload = {
      event: 'user_initiated_messages(Image)',
      from: rawSender,
      type: 'image',
      messages: {
        from: rawSender,
        id: `wamid_vasify_img_${Date.now()}`,
        type: 'image',
        image: {
          url: 'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885_1280.jpg',
          mime_type: 'image/jpeg',
          caption: `Order #${order2.order_number} screenshot`,
        },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await order2.reload();
    assert.strictEqual(order2.workflow_state, ORDER_WORKFLOW_STATES.IMAGE_RECEIVED);
    assert.strictEqual(order2.verification_status, 'image_received');

    const imageRec = await CustomerImage.findOne({
      where: { order_id: order2.id },
      order: [['created_at', 'DESC']],
    });
    assert.ok(imageRec, 'CustomerImage record must exist');
    assert.strictEqual(imageRec.status, 'RECEIVED');
  });

  // ---------------------------------------------------------------------------
  // Payload 5: Final Confirmation Button [Confirm Order]
  // ---------------------------------------------------------------------------
  // Move order2 to PENDING_CUSTOMER_CONFIRMATION (operator matched SKU)
  await OrderWorkflowService.transitionOrder({
    orderId: order2.id,
    targetState: ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION,
    actor: 'crm_operator',
    source: 'operator_match',
    note: 'SKU match verified by operator.',
  });

  await step(5, 'Final confirmation button [Confirm order]', async () => {
    const payload = {
      event: 'button_reply',
      from: rawSender,
      type: 'button',
      messages: {
        from: rawSender,
        id: `wamid_vasify_btn_m2_confirm_${Date.now()}`,
        type: 'button',
        button: {
          payload: `order_confirm_final:${order2.id}`,
          text: 'Confirm Order',
        },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await order2.reload();
    assert.strictEqual(order2.workflow_state, ORDER_WORKFLOW_STATES.CONFIRMED);
    assert.strictEqual(order2.status, 'confirmed');
  });

  // ---------------------------------------------------------------------------
  // Payload 6: Cancellation Button [Cancel Order]
  // ---------------------------------------------------------------------------
  const order3 = await createOrder('3-CANCEL');
  await OrderWorkflowService.transitionOrder({
    orderId: order3.id,
    targetState: ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
    actor: 'customer_whatsapp',
    source: 'whatsapp_button',
    note: 'Customer requested screenshot',
  });
  await OrderWorkflowService.transitionOrder({
    orderId: order3.id,
    targetState: ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION,
    actor: 'system',
    source: 'timeout',
    note: 'Escalated past screenshot window',
  });

  await step(6, 'Cancellation button [Cancel Order]', async () => {
    const payload = {
      event: 'button_reply',
      from: rawSender,
      type: 'button',
      messages: {
        from: rawSender,
        id: `wamid_vasify_btn_cancel_${Date.now()}`,
        type: 'button',
        button: {
          payload: `order_cancel_final:${order3.id}`,
          text: 'Cancel Order',
        },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await order3.reload();
    assert.strictEqual(order3.workflow_state, ORDER_WORKFLOW_STATES.CANCELLED);
    assert.strictEqual(order3.status, 'cancelled');

    const cancelOutbox = await WhatsAppOutbox.findOne({
      where: { order_id: order3.id, template_name: 'order_cancelled' },
    });
    assert.ok(cancelOutbox, 'order_cancelled outbox item must be enqueued');
  });

  // ---------------------------------------------------------------------------
  // Payload 7: Status Delivered
  // ---------------------------------------------------------------------------
  const testOutboxDelivered = await WhatsAppOutbox.create({
    id: uuidv4(),
    order_id: order1.id,
    recipient_phone: testPhone,
    template_name: 'order_deliverd',
    direction: 'outbound',
    status: 'sent',
    provider_message_id: `vasify_test_outbox_deliv_${Date.now()}`,
    payload: { customerName: 'Test', orderNumber: order1.order_number },
  });

  await step(7, 'Status Delivered callback', async () => {
    const payload = {
      event: 'status_update',
      statuses: [{
        id: testOutboxDelivered.provider_message_id,
        recipient_id: rawSender,
        status: 'delivered',
        timestamp: String(Math.floor(Date.now() / 1000)),
      }],
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await testOutboxDelivered.reload();
    assert.strictEqual(testOutboxDelivered.status, 'DELIVERED');
    assert.ok(testOutboxDelivered.delivered_at, 'delivered_at must be populated');
  });

  // ---------------------------------------------------------------------------
  // Payload 8: Status Failed
  // ---------------------------------------------------------------------------
  const testOutboxFailed = await WhatsAppOutbox.create({
    id: uuidv4(),
    order_id: order1.id,
    recipient_phone: testPhone,
    template_name: 'order_deliverd',
    direction: 'outbound',
    status: 'sent',
    provider_message_id: `vasify_test_outbox_fail_${Date.now()}`,
    payload: { customerName: 'Test', orderNumber: order1.order_number },
  });

  await step(8, 'Status Failed callback', async () => {
    const payload = {
      event: 'status_failed',
      statuses: [{
        id: testOutboxFailed.provider_message_id,
        recipient_id: rawSender,
        status: 'failed',
        timestamp: String(Math.floor(Date.now() / 1000)),
        errors: [{
          code: 131026,
          title: 'Message Undeliverable',
          message: 'Recipient phone number is inactive or blocked',
        }],
      }],
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await testOutboxFailed.reload();
    assert.strictEqual(testOutboxFailed.status, 'FAILED');
    assert.ok(testOutboxFailed.failed_at, 'failed_at must be populated');
    assert.strictEqual(testOutboxFailed.failure_reason, 'Message Undeliverable');
  });

  // ---------------------------------------------------------------------------
  // Payload 9: Installation Help Button [Yes, Need Help]
  // ---------------------------------------------------------------------------
  const orderDelivered = await createOrder('4-DELIV');
  await orderDelivered.update({
    status: 'delivered',
    flow_stage: 'installation',
    delivered_at: new Date(),
  });

  await step(9, 'Installation Help Button [Yes, Need Help]', async () => {
    const payload = {
      event: 'button_reply',
      from: rawSender,
      type: 'button',
      messages: {
        from: rawSender,
        id: `wamid_vasify_btn_help_${Date.now()}`,
        type: 'button',
        button: {
          payload: `installation_need_help:${orderDelivered.id}`,
          text: 'Yes, Need Help',
        },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    const followUp = await FollowUp.findOne({
      where: { order_id: orderDelivered.id, priority: 'urgent' },
    });
    assert.ok(followUp, 'Urgent FollowUp task must be created for installation assistance');
    assert.strictEqual(followUp.status, 'pending');

    await customer.reload();
    assert.strictEqual(customer.installation_help_requested, true);
  });

  // ---------------------------------------------------------------------------
  // Payload 10: Installation Done Button [All Good, Done]
  // ---------------------------------------------------------------------------
  await step(10, 'Installation Done Button [All Good, Done!]', async () => {
    const payload = {
      event: 'button_reply',
      from: rawSender,
      type: 'button',
      messages: {
        from: rawSender,
        id: `wamid_vasify_btn_done_${Date.now()}`,
        type: 'button',
        button: {
          payload: `installation_done:${orderDelivered.id}`,
          text: 'All Good, Done',
        },
      },
    };

    const results = await WhatsAppWebhookService.processWebhook(payload);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, true);

    await orderDelivered.reload();
    assert.strictEqual(orderDelivered.flow_stage, 'completed');

    await customer.reload();
    assert.ok(customer.installation_confirmed_at, 'installation_confirmed_at must be recorded on customer');
    assert.strictEqual(customer.lifecycle_stage, 'installation_done');
  });

  console.log('\n------------------------------------------------------------------------');
  console.log(`🎉 ALL ${passed} / ${total} VASIFY TEST PAYLOADS EXECUTED AND PASSED SUCCESSFULLY!`);
  console.log('------------------------------------------------------------------------\n');
  process.exit(0);
}

runVasify10WebhookTests().catch((err) => {
  console.error('\n❌ VASIFY 10-PAYLOAD TEST FAILED:', err);
  process.exit(1);
});
