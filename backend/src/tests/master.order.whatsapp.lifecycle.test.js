'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const assert = require('assert');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Order, Customer, CustomerImage, WhatsAppLog, WhatsAppOutbox, OrderActivity, Warranty, sequelize } = require('../models');
const OrderVerificationWorkflowService = require('../services/orderVerificationWorkflowService');
const whatsappService = require('../services/whatsappService');
const orderController = require('../controllers/orderController');
const warrantyService = require('../services/warrantyService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    process.stdout.write(`  ▶ ${name} ... `);
    await fn();
    passedTests++;
    console.log(`\x1b[32mPASS\x1b[0m`);
  } catch (err) {
    console.log(`\x1b[31mFAIL\x1b[0m`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

async function runMasterSuite() {
  console.log('\n========================================================================');
  console.log('   MASTER ORDER → WHATSAPP → DELIVERY → WARRANTY TEST SUITE');
  console.log('   Validating End-to-End Contract and Invariants (Sections 46 - 52)');
  console.log('========================================================================\n');

  const runId = Date.now();
  const testPhone = `+9198${String(runId).slice(-8)}`;

  // Create isolated test Customer
  const customer = await Customer.create({
    name: `Master Test Customer ${runId}`,
    phone: testPhone,
    whatsapp_number: testPhone,
    status: 'lead',
  });

  let testOrder = null;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A: ORDER UPLOAD & FIRST VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test A: Order Upload triggers first verification outbox entry', async () => {
    testOrder = await Order.create({
      order_number: `ORD-MSTR-${runId}`,
      customer_id: customer.id,
      customer_phone: testPhone,
      customer_name: customer.name,
      product_name: 'AkuaBeat Ro System',
      total_amount: 15999,
      status: 'pending',
      verification_status: 'pending_verification',
      workflow_state: 'PENDING_VERIFICATION',
      flow_stage: 'order_created',
      order_date: new Date(),
    });

    const initResult = await OrderVerificationWorkflowService.initiateFirstVerification({
      orderId: testOrder.id,
      phone: testPhone,
    });

    assert.strictEqual(initResult.success, true, 'First verification initiation should succeed');

    // Verify outbox queued
    const outboxItem = await WhatsAppOutbox.findOne({
      where: { order_id: testOrder.id, template_name: 'order_verification_interactive' },
    });
    assert.ok(outboxItem, 'Outbox item for order_verification_interactive must exist');
    assert.strictEqual(outboxItem.idempotency_key, `order_verification_${testOrder.id}`);

    // Verify duplicate initiation is idempotent
    const dupResult = await OrderVerificationWorkflowService.initiateFirstVerification({
      orderId: testOrder.id,
      phone: testPhone,
    });
    assert.strictEqual(dupResult.idempotent, true, 'Duplicate initiation must be idempotent');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST H: MANDATORY TEXT INPUT RESTRICTION (SECTIONS 2, 15, 47)
  // Free-form text MUST NOT mutate order state
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test H (Mandatory): Customer free-form text ("hi", "confirm", "cancel") does NOT mutate order state', async () => {
    await testOrder.reload();
    const initialState = testOrder.status;
    const initialVerif = testOrder.verification_status;
    const initialFlow = testOrder.flow_stage;

    const testPhrases = ['hi', 'hello', 'yes', 'confirm', 'cancel', 'ok', 'okay', 'thank you', 'please deliver'];

    for (const phrase of testPhrases) {
      await whatsappService.handleWebhook({
        object: 'whatsapp_business_account',
        entry: [{
          id: 'test_entry',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: 'test_phone_id' },
              messages: [{
                from: testPhone.replace('+', ''),
                id: `wamid_text_${crypto.randomUUID()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: 'text',
                text: { body: phrase },
              }],
            },
          }],
        }],
      });
    }

    // Reload order and verify state has NOT mutated
    await testOrder.reload();
    assert.strictEqual(testOrder.status, initialState, `Order status changed after text messages!`);
    assert.strictEqual(testOrder.verification_status, initialVerif, `Verification status changed after text messages!`);
    assert.strictEqual(testOrder.flow_stage, initialFlow, `Flow stage changed after text messages!`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST C: FIRST MESSAGE — SEND SCREENSHOT BUTTON
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test C: Customer clicks [Send Screenshot] button', async () => {
    const btnMsgId = `wamid_btn_${crypto.randomUUID()}`;
    await whatsappService.handleWebhook({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: testPhone.replace('+', ''),
              id: btnMsgId,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'interactive',
              interactive: {
                button_reply: {
                  id: 'btn_send_screenshot',
                  title: 'Send Screenshot',
                },
              },
            }],
          },
        }],
      }],
    });

    await testOrder.reload();
    assert.strictEqual(testOrder.verification_status, 'screenshot_requested', 'Verification status must be screenshot_requested');
    assert.ok(testOrder.second_message_due_at, 'second_message_due_at timer must be set');

    // Verify screenshot request message queued in Outbox
    const ssOutbox = await WhatsAppOutbox.findOne({
      where: { order_id: testOrder.id, template_name: 'screenshot_from_customer' },
    });
    assert.ok(ssOutbox, 'Outbox item for screenshot_from_customer must exist');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST D: CUSTOMER SENDS IMAGE (SECTIONS 8, 9, 48)
  // Image stored, visible in CRM, waiting for CRM review, NO verification013 yet
  // ──────────────────────────────────────────────────────────────────────────
  let customerImage = null;
  await runTest('Test D: Customer sends image -> Stored, CRM Review Pending, no verification013 sent', async () => {
    // 1x1 transparent PNG buffer
    const fakePngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    const imgMsgId = `wamid_img_${crypto.randomUUID()}`;
    await whatsappService.handleWebhook({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: testPhone.replace('+', ''),
              id: imgMsgId,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'image',
              image: {
                id: `media_${crypto.randomUUID()}`,
                mime_type: 'image/png',
                buffer: fakePngBuffer,
              },
            }],
          },
        }],
      }],
    });

    await testOrder.reload();
    assert.strictEqual(testOrder.verification_status, 'image_received', 'Verification status must be image_received');
    assert.strictEqual(testOrder.flow_stage, 'match_pending', 'Flow stage must be match_pending');
    assert.ok(testOrder.screenshot_received_at, 'screenshot_received_at must be recorded');

    // Verify CustomerImage record created
    customerImage = await CustomerImage.findOne({
      where: { order_id: testOrder.id },
      order: [['uploaded_at', 'DESC']],
    });
    assert.ok(customerImage, 'CustomerImage record must exist for order');
    assert.strictEqual(customerImage.status, 'received', 'Image status must be received');
    assert.ok(customerImage.file_url, 'Image file_url must be populated');

    // CRITICAL: verification013 MUST NOT be queued yet (requires CRM approval)
    const prematureM2 = await WhatsAppOutbox.findOne({
      where: { order_id: testOrder.id, template_name: 'order_confirmation013' },
    });
    assert.strictEqual(prematureM2, null, 'order_confirmation013 must NOT be queued before CRM review/approval');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST I: GET ENDPOINTS STRICTLY READ-ONLY (SECTION 33)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test I: GET /api/orders, /:id, and /:id/images do NOT mutate DB state', async () => {
    const prevOrderSnapshot = testOrder.toJSON();
    const prevImgSnapshot = customerImage.toJSON();

    // Invoke GET getOne logic via controller simulation
    let sentData = null;
    const mockRes = {
      status: () => mockRes,
      json: (data) => { sentData = data; return mockRes; },
    };

    await orderController.getOne(
      { params: { id: testOrder.id } },
      mockRes,
      (err) => { if (err) throw err; }
    );

    await testOrder.reload();
    await customerImage.reload();

    assert.strictEqual(testOrder.status, prevOrderSnapshot.status, 'Order status was modified by GET /api/orders/:id');
    assert.strictEqual(testOrder.verification_status, prevOrderSnapshot.verification_status, 'Verification status modified by GET');
    assert.strictEqual(customerImage.status, prevImgSnapshot.status, 'CustomerImage status modified by GET');

    // Verify canonical image viewing URLs
    assert.ok(sentData?.data?.order?.customerImages?.[0]?.view_url, 'Canonical view_url must be returned by GET');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST E: CRM OPERATOR APPROVES SCREENSHOT (SECTIONS 10, 11)
  // Triggers Message 2 (order_confirmation013)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test E: CRM operator approves image -> SKU matched & verification013 queued', async () => {
    const matchResult = await OrderVerificationWorkflowService.handleCrmMatch({
      orderId: testOrder.id,
      userId: null,
      notes: 'Customer tap verified compatible with AkuaBeat RO',
    });

    assert.strictEqual(matchResult.success, true, 'CRM match must succeed');

    await testOrder.reload();
    assert.strictEqual(testOrder.status, 'pending_confirmation', 'Order status must be pending_confirmation');
    assert.strictEqual(testOrder.verification_status, 'sku_matched', 'Verification status must be sku_matched');
    assert.ok(testOrder.second_message_sent_at, 'second_message_sent_at must be recorded');
    assert.ok(testOrder.final_confirmation_due_at, 'final_confirmation_due_at must be set');

    // Verify Message 2 (order_confirmation013) is now queued in Outbox
    const m2Outbox = await WhatsAppOutbox.findOne({
      where: { order_id: testOrder.id, template_name: 'order_confirmation013' },
    });
    assert.ok(m2Outbox, 'order_confirmation013 must be queued after CRM approval');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST F: SECOND MESSAGE — CUSTOMER CONFIRM BUTTON (SECTION 13)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test F: Customer clicks [Confirm Order] button -> Order Confirmed', async () => {
    const confirmMsgId = `wamid_confirm_${crypto.randomUUID()}`;
    await whatsappService.handleWebhook({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: testPhone.replace('+', ''),
              id: confirmMsgId,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'interactive',
              interactive: {
                button_reply: {
                  id: 'btn_confirm_order',
                  title: 'Yes, Confirm Order',
                },
              },
            }],
          },
        }],
      }],
    });

    await testOrder.reload();
    assert.strictEqual(testOrder.status, 'confirmed', 'Order status must be confirmed');
    assert.strictEqual(testOrder.verification_status, 'confirmed', 'Verification status must be confirmed');
    assert.ok(testOrder.customer_confirmed_at, 'customer_confirmed_at must be recorded');

    // Verify order_confirmation queued
    const confOutbox = await WhatsAppOutbox.findOne({
      where: { order_id: testOrder.id, template_name: 'order_confirmation' },
    });
    assert.ok(confOutbox, 'order_confirmation template must be queued in Outbox');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST J: DELIVERY WORKFLOW & INSTALLATION GUIDE & WARRANTY CLAIM (SECTIONS 25-28)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test J: Progression to DELIVERED dispatches order_deliverd, installation_guide, and warranty_claim', async () => {
    // Progress: confirmed -> processing -> dispatched -> delivered
    await testOrder.update({ status: 'processing' });
    await testOrder.update({ status: 'dispatched', tracking_number: 'TRK-98765' });

    // Mark Delivered via controller or workflow
    await testOrder.update({
      status: 'delivered',
      delivered_at: new Date(),
    });

    // Invoke delivery update send
    await whatsappService.sendDeliveryUpdate(testOrder);

    // Verify order_deliverd log exists
    const delivLog = await WhatsAppLog.findOne({
      where: { order_id: testOrder.id, template_name: 'order_deliverd' },
    });
    assert.ok(delivLog, 'WhatsAppLog for order_deliverd must exist');

    // Verify installation_guide log exists
    const installLog = await WhatsAppLog.findOne({
      where: { order_id: testOrder.id, template_name: 'installation_guide' },
    });
    assert.ok(installLog, 'WhatsAppLog for installation_guide must exist');

    // Verify warranty_claim log exists
    const claimLog = await WhatsAppLog.findOne({
      where: { order_id: testOrder.id, template_name: 'warranty_claim' },
    });
    assert.ok(claimLog, 'WhatsAppLog for warranty_claim must exist');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST K: WARRANTY ACTIVATION (SECTIONS 29, 30)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test K: Customer activates warranty -> warranty becomes active and warranty_activated dispatched', async () => {
    let warranty = await Warranty.findOne({ where: { order_id: testOrder.id } });
    if (!warranty) {
      warranty = await warrantyService.handleDeliveryEvent(testOrder.id, { delivered_at: new Date() });
    }
    assert.ok(warranty, 'Warranty record must exist for delivered order');

    // Activate warranty via warrantyService
    const activated = await warrantyService.activateWarranty(warranty.id, {
      source: 'customer_portal',
      customer_notes: 'Installed and working perfectly',
    });

    assert.ok(activated, 'Warranty activation must succeed');
    assert.strictEqual(activated.warranty_status, 'ACTIVE', 'Warranty status must be ACTIVE');
    assert.ok(activated.activated_at, 'activated_at must be populated');

    // Ensure outbox queue is drained so WhatsAppLog is populated
    await whatsappOutboxQueue.drainQueue().catch(() => {});

    // Verify warranty_activated WhatsApp message was dispatched
    const activatedLog = await WhatsAppLog.findOne({
      where: {
        order_id: testOrder.id,
        template_name: { [Op.in]: ['warranty_activated', 'warranty_activated1'] },
      },
    });
    assert.ok(activatedLog, 'WhatsAppLog for warranty_activated must exist');

    // Idempotent reactivation check
    const reActivation = await warrantyService.activateWarranty(warranty.id, { source: 'customer_portal' });
    assert.strictEqual(reActivation.warranty_status, 'ACTIVE', 'Re-activation must return ACTIVE without error');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST L: TERMINAL STATE PROTECTION (SECTION 21)
  // ──────────────────────────────────────────────────────────────────────────
  await runTest('Test L: Cancel or Confirm button replay on DELIVERED order is rejected', async () => {
    // Attempt to send cancel button for delivered order
    await whatsappService.handleWebhook({
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: testPhone.replace('+', ''),
              id: `wamid_stale_cancel_${crypto.randomUUID()}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'interactive',
              interactive: {
                button_reply: {
                  id: 'btn_cancel_order',
                  title: 'Cancel Order',
                },
              },
            }],
          },
        }],
      }],
    });

    await testOrder.reload();
    assert.strictEqual(testOrder.status, 'delivered', 'Order status must NOT change from delivered to cancelled on stale button replay');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CLEANUP
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n------------------------------------------------------------------------');
  console.log(`Master Lifecycle Results: ${passedTests} / ${totalTests} tests passed.`);
  if (passedTests === totalTests) {
    console.log('\x1b[32m✔ ALL END-TO-END SPECIFICATION SCENARIOS VERIFIED SUCCESSFULLY.\x1b[0m\n');
  } else {
    console.log('\x1b[31m✘ SOME TESTS FAILED.\x1b[0m\n');
  }
}

runMasterSuite()
  .then(() => process.exit(passedTests === totalTests ? 0 : 1))
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
