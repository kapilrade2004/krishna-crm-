'use strict';

// Set up mock WhatsApp environment for deterministic automated testing
process.env.WHATSAPP_ACCESS_TOKEN = 'mock_token_123';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock_phone_id_123';
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { sequelize, User, Customer, Order, OrderActivity, WhatsAppLog, syncModels } = require('../models');
const whatsappService = require('../services/whatsappService');
const customerController = require('../controllers/customerController');

// Mock global fetch for WhatsApp API calls
global.fetch = async (url, options) => {
  const payload = {
    messages: [{ id: `mock_wa_msg_${Date.now()}` }],
    data: [{ messageId: `mock_wa_msg_${Date.now()}` }],
    success: true,
  };
  return {
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    headers: { get: () => 'application/json' },
  };
};

const runSuite = async () => {
  console.log('====================================================');
  console.log('⚡ STARTING WHATSAPP INSTALLATION HELP FLOW TEST MATRIX');
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

  // Setup DB & Sync
  await syncModels();

  let testUser = await User.findOne();
  if (!testUser) {
    testUser = await User.create({
      name: 'Telecaller Officer',
      email: `telecaller_${Date.now()}@test.com`,
      password: 'Password@123',
      role: 'telecaller',
    });
  }

  const phoneNum = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testCustomer = await Customer.create({
    name: 'Amit Sharma',
    phone: phoneNum,
    whatsapp_number: phoneNum,
    email: `amit_${Date.now()}@test.com`,
    city: 'Thane',
    state: 'Maharashtra',
    pincode: '400601',
    source: 'direct',
    status: 'active',
  });

  const testOrder = await Order.create({
    order_number: `ORD-DELIV-${Date.now()}`,
    customer_id: testCustomer.id,
    product_name: 'AquaBeat Alkaline Water Purifier Premier',
    product_sku: 'AKU-ALK-01',
    total_amount: 14999,
    status: 'delivered',
    flow_stage: 'installation',
    delivered_at: new Date(),
  });

  testOrder.customer = testCustomer;

  // ── TC01: sendInstallationGuide dispatches template 7 with order info
  await asyncTest('TC01: sendInstallationGuide sends installation_guide template', async () => {
    const res = await whatsappService.sendInstallationGuide(testOrder);
    assert.ok(res !== null, 'Send installation guide response must be truthy');
    assert.strictEqual(res.success, true);

    const log = await WhatsAppLog.findOne({
      where: { order_id: testOrder.id, template_name: 'installation_guide' },
      order: [['created_at', 'DESC']],
    });

    assert.ok(log !== null, 'WhatsAppLog record must exist for installation_guide');
    assert.strictEqual(log.status, 'sent');
    assert.strictEqual(log.payload.components[0].parameters[0].text, 'Amit Sharma');
    assert.strictEqual(log.payload.components[0].parameters[1].text, testOrder.order_number);
  });

  // ── TC02: Webhook receives "Yes, Need Help" button click
  await asyncTest('TC02: handleWebhook processes "Yes, Need Help" button and flags Customer & Order for Telecaller Workbench', async () => {
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              from: phoneNum,
              id: `wamid_${Date.now()}`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: 'yes_need_help',
                  title: 'Yes, Need Help',
                },
              },
            }],
          },
        }],
      }],
    };

    await whatsappService.handleWebhook(webhookPayload);

    await testCustomer.reload();
    await testOrder.reload();

    assert.strictEqual(testCustomer.installation_help_requested, true, 'Customer installation_help_requested must be true');
    assert.strictEqual(testCustomer.installation_help_status, 'pending', 'Customer installation_help_status must be pending');
    assert.strictEqual(testCustomer.lifecycle_stage, 'installation_pending', 'Customer lifecycle_stage must be installation_pending');
    assert.ok(testCustomer.notes.includes('[Installation Help Requested]'), 'Notes must contain installation help tag');
    assert.ok(testCustomer.tags.includes('installation_help_requested'), 'Customer tags must include installation_help_requested');

    // Check OrderActivity
    const act = await OrderActivity.findOne({
      where: { order_id: testOrder.id, action: 'installation_help_requested' },
    });
    assert.ok(act !== null, 'OrderActivity must be recorded for installation_help_requested');
  });

  // ── TC03: Verify Customer Controller returns installation_help leads with Order details
  await asyncTest('TC03: customerController.getAll filters and returns installation_help leads with orders', async () => {
    const mockReq = {
      query: {
        installation_help: 'true',
        limit: '10',
        page: '1',
      },
    };

    let resultJson = null;
    const mockRes = {
      status: () => mockRes,
      json: (data) => { resultJson = data; return mockRes; },
    };

    await customerController.getAll(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.ok(resultJson !== null, 'Response json must exist');
    const items = resultJson.data || resultJson.items || [];
    assert.ok(items.length > 0, 'Must return at least 1 lead');
    const matched = items.find(c => c.id === testCustomer.id);
    assert.ok(matched !== undefined, 'Matched customer must be returned');
    assert.strictEqual(matched.installation_help_requested, true);
    assert.strictEqual(matched.installation_help_status, 'pending');
    assert.ok(matched.orders && matched.orders.length > 0, 'Orders array must be included');
    assert.strictEqual(matched.orders[0].order_number, testOrder.order_number);
  });

  // ── TC04: Telecaller updates installation disposition (Contacted -> Visit Scheduled)
  await asyncTest('TC04: customerController.updateInstallationHelpStatus updates status and records notes', async () => {
    const mockReq = {
      params: { id: testCustomer.id },
      body: {
        status: 'contacted',
        notes: 'Called customer, confirmed Purifier is unboxed and ready for installation.',
      },
      user: testUser,
    };

    let resultJson = null;
    const mockRes = {
      status: () => mockRes,
      json: (data) => { resultJson = data; return mockRes; },
    };

    await customerController.updateInstallationHelpStatus(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    assert.ok(resultJson !== null, 'Response json must exist');
    assert.strictEqual(resultJson.data.customer.installation_help_status, 'contacted');

    await testCustomer.reload();
    assert.strictEqual(testCustomer.installation_help_status, 'contacted');
    assert.ok(testCustomer.notes.includes('Installation Status: CONTACTED'));
  });

  // ── TC05: Webhook handles "All Good, Done!" button click to resolve installation
  await asyncTest('TC05: handleWebhook processes "All Good, Done!" button and resolves installation status', async () => {
    const webhookPayloadDone = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              from: phoneNum,
              id: `wamid_done_${Date.now()}`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: 'all_good_done',
                  title: 'All Good, Done!',
                },
              },
            }],
          },
        }],
      }],
    };

    await whatsappService.handleWebhook(webhookPayloadDone);

    await testCustomer.reload();
    await testOrder.reload();

    assert.strictEqual(testCustomer.installation_help_status, 'resolved', 'Customer installation_help_status must be resolved');
    assert.strictEqual(testCustomer.lifecycle_stage, 'installation_done', 'Customer lifecycle_stage must be installation_done');
    assert.ok(testCustomer.installation_confirmed_at !== null, 'installation_confirmed_at must be populated');

    const doneAct = await OrderActivity.findOne({
      where: { order_id: testOrder.id, action: 'installation_confirmed_done' },
    });
    assert.ok(doneAct !== null, 'OrderActivity must be recorded for installation_confirmed_done');
  });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runSuite().then(() => {
  console.log('All Installation Help test cases passed successfully.');
  process.exit(0);
}).catch((e) => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
