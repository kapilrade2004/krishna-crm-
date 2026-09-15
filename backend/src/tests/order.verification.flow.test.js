'use strict';

const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'mysql';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.WHATSAPP_ACCESS_TOKEN = 'mock_token_123';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock_phone_id_123';

const assert = require('assert');
const { sequelize, User, Customer, Order, OrderActivity, CustomerImage, WhatsAppLog, Warranty } = require('../models');
const whatsappService = require('../services/whatsappService');
const orderVerificationWorker = require('../services/orderVerificationWorker');
const warrantyService = require('../services/warrantyService');
const orderController = require('../controllers/orderController');

let testUser;
let testCustomer;

// Mock global fetch for WhatsApp API calls
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      messages: [{ id: `mock_wa_msg_${Date.now()}` }],
    }),
    text: async () => JSON.stringify({ messages: [{ id: `mock_wa_msg_${Date.now()}` }] }),
  };
};

const runSuite = async () => {
  console.log('====================================================');
  console.log('⚡ STARTING REVISED ORDER VERIFICATION & LIFECYCLE TEST MATRIX');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const asyncTest = async (title, fn) => {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${title}: ${err.message}`);
      failed++;
    }
  };

  // ── Setup Test Fixtures ──────────────────────────────────────────────────
  await sequelize.sync();
  testUser = await User.findOne();
  if (!testUser) {
    testUser = await User.create({
      name: 'Test Controller',
      email: `controller_${Date.now()}@test.com`,
      password: 'Password@123',
      role: 'admin',
    });
  }

  testCustomer = await Customer.create({
    name: 'Rohan Patil',
    phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
    whatsapp_number: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: `rohan_${Date.now()}@test.com`,
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411045',
  });

  // ── TC01: Initial Outreach strictly sends Message 1 (order_verification_interactive)
  await asyncTest('TC01: sendProductVerificationTemplate sends Message 1 (order_verification_interactive)', async () => {
    const order1 = await Order.create({
      order_number: `ORD-TEST-01-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Purifier Ultra',
      product_sku: 'AKU-ULTRA-01',
      total_amount: 4999,
      status: 'pending',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
    });

    order1.customer = testCustomer;
    await whatsappService.sendProductVerificationTemplate(order1);

    const log = await WhatsAppLog.findOne({
      where: { order_id: order1.id, template_name: 'order_verification_interactive' },
      order: [['created_at', 'DESC']],
    });

    assert.ok(log !== null, 'WhatsAppLog record must exist for order_verification_interactive');
    assert.strictEqual(log.status, 'sent');
    assert.strictEqual(log.payload.components[0].parameters[0].text, 'Rohan Patil');
    assert.strictEqual(log.payload.components[0].parameters[1].text, order1.order_number);
  });

  // ── TC02: Customer clicks "Yes, Confirm" on Message 1 -> Direct confirmation & Skip Message 2
  await asyncTest('TC02: Customer clicks [Yes, Confirm] on Message 1 -> Directly confirms order & sends order_confirmation', async () => {
    const order2 = await Order.create({
      order_number: `ORD-TEST-02-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Purifier Pro',
      product_sku: 'AKU-PRO-01',
      total_amount: 3499,
      status: 'pending',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
    });

    // Simulate WhatsApp Webhook button click for 'yes_confirm'
    const webhookPayload = {
      from: testCustomer.phone,
      button_reply: {
        id: `yes_confirm_${order2.id}`,
        title: 'Yes, Confirm',
      },
    };

    await whatsappService.handleWebhook(webhookPayload);

    const reloaded = await Order.findByPk(order2.id);
    assert.strictEqual(reloaded.status, 'confirmed');
    assert.strictEqual(reloaded.verification_status, 'confirmed');
    assert.strictEqual(reloaded.flow_stage, 'match_confirmed');
    assert.strictEqual(reloaded.second_message_due_at, null, 'Message 2 timer must be null');
    assert.ok(reloaded.customer_confirmed_at !== null);

    // Verify order_confirmation was logged
    const confLog = await WhatsAppLog.findOne({
      where: { order_id: order2.id, template_name: 'order_confirmation' },
    });
    assert.ok(confLog !== null, 'order_confirmation WhatsAppLog record must exist');
  });

  // ── TC03: Customer clicks "Send Screenshot" -> 15-Minute Timer is set
  await asyncTest('TC03: Customer clicks [Send Screenshot] on Message 1 -> 15-minute timer set and status becomes screenshot_requested', async () => {
    const order3 = await Order.create({
      order_number: `ORD-TEST-03-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Purifier RO',
      product_sku: 'AKU-RO-01',
      total_amount: 2999,
      status: 'pending',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
    });

    const webhookPayload = {
      from: testCustomer.phone,
      button_reply: {
        id: `send_screenshot_${order3.id}`,
        title: 'Send Screenshot',
      },
    };

    await whatsappService.handleWebhook(webhookPayload);

    const reloaded = await Order.findByPk(order3.id);
    assert.strictEqual(reloaded.verification_status, 'screenshot_requested');
    assert.ok(reloaded.screenshot_requested_at !== null);
    assert.ok(reloaded.second_message_due_at !== null);

    const timeDiff = new Date(reloaded.second_message_due_at).getTime() - new Date(reloaded.screenshot_requested_at).getTime();
    assert.strictEqual(timeDiff, 15 * 60 * 1000, 'Second message due time must be exactly +15 minutes');
  });

  // ── TC04: 15-minute worker skips candidates where 15 minutes haven't elapsed
  await asyncTest('TC04: 15-minute worker skips order when now < second_message_due_at', async () => {
    const order4 = await Order.create({
      order_number: `ORD-TEST-04-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Filter',
      product_sku: 'AKU-FLT-01',
      total_amount: 1499,
      status: 'pending',
      verification_status: 'screenshot_requested',
      second_message_due_at: new Date(Date.now() + 10 * 60 * 1000), // In 10 min
    });

    const queueResult = await orderVerificationWorker.processOrderVerificationQueue();
    const m2Log = await WhatsAppLog.findOne({
      where: { order_id: order4.id, template_name: 'order_confirmation01.0' },
    });
    assert.strictEqual(m2Log, null, 'Message 2 must NOT be sent before 15 minutes elapse');
  });

  // ── TC05: After 15 minutes, worker dispatches Message 2 (order_confirmation01.0)
  await asyncTest('TC05: 15-minute worker dispatches Message 2 (order_confirmation01.0) once timer expires', async () => {
    const order5 = await Order.create({
      order_number: `ORD-TEST-05-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Purifier RO+',
      product_sku: 'AKU-RO-PLUS',
      total_amount: 3999,
      status: 'pending',
      verification_status: 'screenshot_requested',
      flow_stage: 'ask_images',
      screenshot_requested_at: new Date(Date.now() - 16 * 60 * 1000),
      second_message_due_at: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
    });

    const queueResult = await orderVerificationWorker.processOrderVerificationQueue();
    assert.ok(queueResult.processed >= 1);

    const reloaded = await Order.findByPk(order5.id);
    assert.ok(reloaded.second_message_sent_at !== null);
    assert.strictEqual(reloaded.verification_status, 'pending_confirmation');

    const m2Log = await WhatsAppLog.findOne({
      where: { order_id: order5.id, template_name: ['order_confirmation013', 'order_confirmation01.0'] },
    });
    assert.ok(m2Log !== null, 'Message 2 (order_confirmation013) must be logged');
  });

  // ── TC06: Customer clicks "Confirm Order" on Message 2 -> Order Confirmed & Confirmation template sent
  await asyncTest('TC06: Customer clicks [Confirm Order] on Message 2 -> Order confirms and sends order_confirmation', async () => {
    const order6 = await Order.create({
      order_number: `ORD-TEST-06-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Water Purifier Premier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 2499,
      status: 'pending_confirmation',
      verification_status: 'pending_confirmation',
      flow_stage: 'match_pending',
    });

    const webhookPayload = {
      from: testCustomer.phone,
      button_reply: {
        id: `confirm_order_${order6.id}`,
        title: 'Confirm Order',
      },
    };

    await whatsappService.handleWebhook(webhookPayload);

    const reloaded = await Order.findByPk(order6.id);
    assert.strictEqual(reloaded.status, 'confirmed');
    assert.strictEqual(reloaded.verification_status, 'confirmed');

    const confLog = await WhatsAppLog.findOne({
      where: { order_id: order6.id, template_name: 'order_confirmation' },
    });
    assert.ok(confLog !== null);
  });

  // ── TC07: Customer clicks "Cancel Order" on Message 2 -> Order Cancelled & Cancellation template sent
  await asyncTest('TC07: Customer clicks [Cancel Order] -> Order is marked cancelled and sends order_cancelled', async () => {
    const order7 = await Order.create({
      order_number: `ORD-TEST-07-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Water Purifier Premier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 2499,
      status: 'pending_confirmation',
      verification_status: 'pending_confirmation',
      flow_stage: 'match_pending',
    });

    const webhookPayload = {
      from: testCustomer.phone,
      button_reply: {
        id: `cancel_order_${order7.id}`,
        title: 'Cancel Order',
      },
    };

    await whatsappService.handleWebhook(webhookPayload);

    const reloaded = await Order.findByPk(order7.id);
    assert.strictEqual(reloaded.status, 'cancelled');
    assert.strictEqual(reloaded.flow_stage, 'match_cancelled');

    const cancelLog = await WhatsAppLog.findOne({
      where: { order_id: order7.id, template_name: 'order_cancelled' },
    });
    assert.ok(cancelLog !== null);
  });

  // ── TC08: Order Controller manually approves order in CRM -> sends order_confirmation and cancels timer
  await asyncTest('TC08: CRM Controller manually approves/confirms order -> dispatches order_confirmation', async () => {
    const order8 = await Order.create({
      order_number: `ORD-TEST-08-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Smart RO',
      product_sku: 'AKU-SMART-RO',
      total_amount: 5499,
      status: 'pending',
      verification_status: 'pending_verification',
      second_message_due_at: new Date(Date.now() + 10 * 60 * 1000),
    });

    const mockReq = {
      params: { id: order8.id },
      body: { status: 'confirmed', note: 'Approved by Controller via CRM' },
      user: testUser,
    };
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    };

    await orderController.updateStatus(mockReq, mockRes, (err) => { if (err) throw err; });

    const reloaded = await Order.findByPk(order8.id);
    assert.strictEqual(reloaded.status, 'confirmed');
    assert.strictEqual(reloaded.second_message_due_at, null);

    const confLog = await WhatsAppLog.findOne({
      where: { order_id: order8.id, template_name: 'order_confirmation' },
    });
    assert.ok(confLog !== null);
  });

  // ── TC09: Order delivered -> sends order_delivered and registers Warranty
  await asyncTest('TC09: Order marked delivered -> dispatches order_delivered & initializes Warranty', async () => {
    const order9 = await Order.create({
      order_number: `ORD-TEST-09-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Alkaline Filter',
      product_sku: 'AKU-ALK-01',
      total_amount: 1999,
      status: 'dispatched',
      verification_status: 'confirmed',
    });

    const mockReq = {
      params: { id: order9.id },
      body: { status: 'delivered', note: 'Delivered by BlueDart' },
      user: testUser,
    };
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    };

    await orderController.updateStatus(mockReq, mockRes, (err) => { if (err) throw err; });

    const reloaded = await Order.findByPk(order9.id);
    assert.strictEqual(reloaded.status, 'delivered');
    assert.ok(reloaded.delivered_at !== null);

    const delLog = await WhatsAppLog.findOne({
      where: { order_id: order9.id, template_name: ['order_deliverd', 'order_delivered'] },
    });
    assert.ok(delLog !== null, 'Delivery update template must be logged');

    const war = await Warranty.findOne({ where: { order_id: order9.id } });
    assert.ok(war !== null, 'Warranty record must be initialized on delivery');
    assert.strictEqual(war.warranty_status, 'DELIVERED');
  });

  // ── TC10: Inbound WhatsApp Text Confirmation ("yes please") -> Order Confirmed
  await asyncTest('TC10: Inbound WhatsApp text confirmation ("yes please confirm") -> state moved to confirmed', async () => {
    const cust10 = await Customer.create({
      name: 'Text Confirm Customer',
      phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      whatsapp_number: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `text_conf_${Date.now()}@test.com`,
    });
    const order10 = await Order.create({
      order_number: `ORD-TEST-10-${Date.now()}`,
      customer_id: cust10.id,
      product_name: 'AquaBeat Alkaline RO Purifier',
      product_sku: 'AKU-RO-ALKALINE-01',
      total_amount: 8999,
      status: 'pending_confirmation',
      verification_status: 'pending_confirmation',
      flow_stage: 'match_pending',
    });

    const mockTextPayload = {
      channel: 'whatsapp',
      messages: [{
        from: cust10.whatsapp_number,
        id: `wamid.TEXT_CONF_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type: 'text',
        text: { body: 'Yes please confirm my order, proceed with delivery' },
      }],
    };

    await whatsappService.handleWebhook(mockTextPayload);

    const reloaded = await Order.findByPk(order10.id);
    assert.strictEqual(reloaded.status, 'confirmed');
    assert.strictEqual(reloaded.verification_status, 'confirmed');
    assert.strictEqual(reloaded.flow_stage, 'match_confirmed');
    assert.ok(reloaded.customer_confirmed_at !== null);
    assert.strictEqual(reloaded.second_message_due_at, null);
  });

  // ── TC11: Manual customerConfirm endpoint -> Order Confirmed
  await asyncTest('TC11: orderController.customerConfirm endpoint -> immediately marks confirmed', async () => {
    const order11 = await Order.create({
      order_number: `ORD-TEST-11-${Date.now()}`,
      customer_id: testCustomer.id,
      product_name: 'AquaBeat Copper RO Filter',
      product_sku: 'AKU-COP-01',
      total_amount: 4999,
      status: 'pending_confirmation',
      verification_status: 'pending_confirmation',
      flow_stage: 'match_pending',
    });

    const mockReq = {
      params: { id: order11.id },
      body: { note: 'Customer confirmed verbally during telecaller phone call.', send_whatsapp: false },
      user: testUser,
    };
    let responseData = null;
    const mockRes = {
      status: () => mockRes,
      json: (d) => { responseData = d; return mockRes; },
    };

    await orderController.customerConfirm(mockReq, mockRes, (err) => { if (err) throw err; });

    const reloaded = await Order.findByPk(order11.id);
    assert.strictEqual(reloaded.status, 'confirmed');
    assert.strictEqual(reloaded.verification_status, 'confirmed');
    assert.strictEqual(reloaded.flow_stage, 'match_confirmed');
    assert.ok(reloaded.customer_confirmed_at !== null);
  });

  console.log('\n====================================================');
  console.log(`🎯 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
