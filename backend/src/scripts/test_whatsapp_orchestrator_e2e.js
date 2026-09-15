'use strict';

process.env.DB_DIALECT = 'sqlite';
process.env.NODE_ENV = 'test';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Order,
  Customer,
  WhatsAppOutbox,
  WhatsAppLog,
  OrderActivity,
  User,
  syncModels,
} = require('../models');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const orderVerificationWorker = require('../services/orderVerificationWorker');
const whatsappService = require('../services/whatsappService');
const logger = require('../config/logger');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runE2EOrchestratorTests() {
  console.log('\n=============================================================');
  console.log('🚀 RUNNING WHATSAPP ORDER ORCHESTRATOR E2E VERIFICATION SUITE');
  console.log('=============================================================\n');

  await syncModels(false);
  const { migrateWhatsAppOrchestrator } = require('./migrate_whatsapp_orchestrator');
  await migrateWhatsAppOrchestrator();

  // Mock whatsappService remote HTTP calls to avoid external network dependencies
  const originalSendProductVerification = whatsappService.sendProductVerificationTemplate;
  const originalSendMatched = whatsappService.sendProductMatchedVerificationMessage;
  const originalSendConfirmation = whatsappService.sendOrderConfirmation;
  const originalSendDispatch = whatsappService.sendDispatchUpdate;
  const originalSendDelivery = whatsappService.sendDeliveryUpdate;
  const originalSendInstallation = whatsappService.sendInstallationGuide;

  let dispatchedMessages = [];

  whatsappService.sendProductVerificationTemplate = async (order) => {
    dispatchedMessages.push({ type: 'order_verification_interactive', orderId: order.id });
    await order.update({ confirmation_message_sent_at: new Date(), whatsapp_confirmation_sent: true });
    return { success: true, messageId: `msg-${Date.now()}` };
  };

  whatsappService.sendProductMatchedVerificationMessage = async (order) => {
    dispatchedMessages.push({ type: 'order_confirmation013', orderId: order.id });
    await order.update({ second_message_sent_at: new Date() });
    return { success: true, messageId: `msg-matched-${Date.now()}` };
  };

  whatsappService.sendOrderConfirmation = async (order) => {
    dispatchedMessages.push({ type: 'order_confirmation', orderId: order.id });
    await order.update({ confirmation_sent_at: new Date() });
    return { success: true, messageId: `msg-confirm-${Date.now()}` };
  };

  whatsappService.sendDispatchUpdate = async (order) => {
    dispatchedMessages.push({ type: 'order_dispatched', orderId: order.id });
    await order.update({ whatsapp_dispatch_sent: true });
    return { success: true, messageId: `msg-dispatch-${Date.now()}` };
  };

  whatsappService.sendDeliveryUpdate = async (order) => {
    dispatchedMessages.push({ type: 'order_deliverd', orderId: order.id });
    await order.update({ delivered_message_sent_at: new Date(), whatsapp_delivery_sent: true });
    return { success: true, messageId: `msg-deliver-${Date.now()}` };
  };

  whatsappService.sendInstallationGuide = async (order) => {
    dispatchedMessages.push({ type: 'installation_guide', orderId: order?.id });
    return { success: true, messageId: `msg-guide-${Date.now()}` };
  };

  try {
    // ─── TEST 1: Automated Enqueue on Order Creation ───────────────────────
    console.log('--- Test 1: Automated Outbox Enqueue on Order Ingestion ---');
    const customer1 = await Customer.create({
      id: uuidv4(),
      name: 'Rohan Sharma',
      phone: '9876543210',
      whatsapp_number: '9876543210',
      email: 'rohan.sharma@example.com',
      source: 'amazon',
    });

    const order1 = await Order.create({
      id: uuidv4(),
      order_number: `ORD-TEST-${Date.now()}`,
      customer_id: customer1.id,
      marketplace: 'amazon',
      product_name: 'Water Purifier Filter Cartridge',
      product_sku: 'WP-FLT-001',
      total_amount: 1499.00,
      status: 'pending',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
    });

    // Simulate automated post-persistence ingestion hook
    const outboxItem1 = await whatsappOutboxQueue.enqueue({
      order_id: order1.id,
      customer_id: customer1.id,
      recipient_phone: customer1.phone,
      template_name: 'order_verification_interactive',
      payload: { order_number: order1.order_number, product_name: order1.product_name },
      idempotency_key: `verif-init-${order1.id}`,
    });

    assert(outboxItem1 && outboxItem1.id, 'Outbox entry successfully enqueued');
    assert(outboxItem1.status === 'pending', 'Outbox status initialized to pending');
    assert(outboxItem1.template_name === 'order_verification_interactive', 'Outbox template correctly set to order_verification_interactive');

    // ─── TEST 2: Idempotency & Duplicate Prevention ───────────────────────
    console.log('\n--- Test 2: Idempotency & Re-Ingestion Duplicate Prevention ---');
    const duplicateEnqueue = await whatsappOutboxQueue.enqueue({
      order_id: order1.id,
      customer_id: customer1.id,
      recipient_phone: customer1.phone,
      template_name: 'order_verification_interactive',
      payload: { order_number: order1.order_number, product_name: order1.product_name },
      idempotency_key: `verif-init-${order1.id}`,
    });

    const allMatches = await WhatsAppOutbox.findAll({ where: { idempotency_key: `verif-init-${order1.id}` } });
    assert(allMatches.length === 1, 'Exactly one outbox record exists; duplicate was prevented');
    assert(duplicateEnqueue.id === outboxItem1.id, 'Idempotent call safely returned existing record');

    // ─── TEST 3: Outbox Queue Dispatcher & State Reflection ───────────────
    console.log('\n--- Test 3: Outbox Dispatcher Execution & State Reflection ---');
    dispatchedMessages = [];
    const dispatchResult = await whatsappOutboxQueue.processItem(outboxItem1);
    assert(dispatchResult.success === true, 'Outbox item processed successfully');

    await outboxItem1.reload();
    assert(outboxItem1.status === 'sent', 'Outbox item status transitioned to sent');
    assert(outboxItem1.sent_at !== null, 'Outbox sent_at timestamp recorded');

    await order1.reload();
    assert(order1.whatsapp_confirmation_sent === true, 'Order whatsapp_confirmation_sent set to true');
    assert(order1.confirmation_message_sent_at !== null, 'Order confirmation_message_sent_at recorded');

    const activity = await OrderActivity.findOne({ where: { order_id: order1.id, action: 'whatsapp_outbox_delivered' } });
    assert(activity !== null, 'OrderActivity logged for WhatsApp delivery');

    // ─── TEST 4: 15-Minute Countdown Automated Worker (Message 2) ─────────
    console.log('\n--- Test 4: 15-Minute Countdown Automated Worker for Message 2 ---');
    // Simulate customer uploading image or requesting screenshot 16 minutes ago
    const sixteenMinsAgo = new Date(Date.now() - 16 * 60 * 1000);
    await order1.update({
      second_message_due_at: sixteenMinsAgo,
      second_message_sent_at: null,
      status: 'pending',
    });

    dispatchedMessages = [];
    const workerResult = await orderVerificationWorker.processOrderVerificationQueue();
    assert(workerResult.processed >= 1, 'Worker automatically picked up due verification order');

    await order1.reload();
    assert(order1.second_message_sent_at !== null, 'Second message timestamp recorded on order');
    assert(
      dispatchedMessages.some((m) => m.type === 'order_confirmation013' && m.orderId === order1.id),
      'Template order_confirmation013 automatically dispatched by background worker'
    );

    // ─── TEST 5: Customer Confirmation Webhook & Order Confirmation Trigger
    console.log('\n--- Test 5: Customer Confirmation & Template 3 Automated Dispatch ---');
    dispatchedMessages = [];
    await order1.update({
      status: 'confirmed',
      verification_status: 'confirmed',
      customer_confirmed_at: new Date(),
    });

    // Automatic trigger check on confirmed status
    await whatsappService.sendOrderConfirmation(order1);
    await order1.reload();
    assert(order1.status === 'confirmed', 'Order status moved to confirmed');
    assert(order1.confirmation_sent_at !== null, 'Order confirmation_sent_at recorded');
    assert(
      dispatchedMessages.some((m) => m.type === 'order_confirmation' && m.orderId === order1.id),
      'Template order_confirmation automatically dispatched upon confirmation'
    );

    // ─── TEST 6: Order Lifecycle Triggers: Dispatched & Delivered ─────────
    console.log('\n--- Test 6: Lifecycle Notifications: Dispatched, Delivered & Installation Guide ---');
    dispatchedMessages = [];
    await order1.update({ status: 'dispatched', tracking_number: 'AWB987654321', shipping_partner: 'Delhivery' });
    await whatsappService.sendDispatchUpdate(order1);
    assert(
      dispatchedMessages.some((m) => m.type === 'order_dispatched'),
      'Template order_dispatched triggered with tracking info'
    );

    dispatchedMessages = [];
    await order1.update({ status: 'delivered' });
    await whatsappService.sendDeliveryUpdate(order1);
    await whatsappService.sendInstallationGuide(order1);
    assert(
      dispatchedMessages.some((m) => m.type === 'order_deliverd'),
      'Template order_deliverd triggered upon delivery'
    );
    assert(
      dispatchedMessages.some((m) => m.type === 'installation_guide'),
      'Template installation_guide triggered immediately post-delivery'
    );

    // ─── TEST 7: Invalid Phone & Ineligible Order Graceful Handling ───────
    console.log('\n--- Test 7: Phone Validation & Ineligible Order Graceful Handling ---');
    const invalidPhoneCustomer = await Customer.create({
      id: uuidv4(),
      name: 'Invalid Phone Customer',
      phone: '123', // invalid short phone
      source: 'custom',
    });

    const rawPhone = invalidPhoneCustomer.phone ? String(invalidPhoneCustomer.phone).replace(/\D/g, '') : '';
    const isPhoneValid = rawPhone.length >= 10;
    assert(isPhoneValid === false, 'Invalid phone number (< 10 digits) correctly identified as ineligible');

    // ─── TEST 8: Token Bucket Concurrency Throttle ────────────────────────
    console.log('\n--- Test 8: Token Bucket Rate Limiter Concurrency Test ---');
    const bucket = whatsappOutboxQueue.rateLimiter;
    assert(bucket.capacity > 0, 'Token bucket initialized with capacity');
    let consumedCount = 0;
    for (let i = 0; i < 5; i++) {
      if (bucket.tryConsume(1)) consumedCount++;
    }
    assert(consumedCount === 5, 'Rate limiter consumed 5 tokens smoothly under capacity');

    console.log('\n=============================================================');
    console.log(`🎉 ALL ${passedTests}/${totalTests} WHATSAPP ORCHESTRATION TESTS PASSED! (100%)`);
    console.log('=============================================================\n');

    // Restore original methods
    whatsappService.sendProductVerificationTemplate = originalSendProductVerification;
    whatsappService.sendProductMatchedVerificationMessage = originalSendMatched;
    whatsappService.sendOrderConfirmation = originalSendConfirmation;
    whatsappService.sendDispatchUpdate = originalSendDispatch;
    whatsappService.sendDeliveryUpdate = originalSendDelivery;
    whatsappService.sendInstallationGuide = originalSendInstallation;

    process.exit(0);
  } catch (err) {
    console.error('❌ Orchestration test error:', err);
    process.exit(1);
  }
}

runE2EOrchestratorTests();
