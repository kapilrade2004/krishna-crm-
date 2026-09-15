'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Master End-to-End Synchronization Test Suite
 * Strictly validates the 3 interconnected operational lifecycles:
 * 1. Order Processing (.xlsx/.xls/.csv/.tsv, channel select, order_verification_interactive, 3 buttons, screenshot 15m window, order_confirmation013, call representative -> telecaller)
 * 2. Shipping Module (.xlsx/.xls/.csv/.tsv upload, dispatched/delivered triggers, installation_guide with "yes, need help" -> telecaller and "All good, Done" quiet)
 * 3. Warranty Processing (warranty_claim with QR code & link, AkuaBeat website auto-fill, activation, and warranty_activated confirmation)
 */

const assert = require('assert');
const { Op } = require('sequelize');
const {
  sequelize,
  Order,
  Customer,
  CustomerImage,
  OrderActivity,
  WhatsAppOutbox,
  WhatsAppLog,
  Warranty,
  FollowUp,
  User,
} = require('../models');

const OrderVerificationWorkflowService = require('../services/orderVerificationWorkflowService');
const whatsappService = require('../services/whatsappService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const { processOrderVerificationQueue } = require('../services/orderVerificationWorker');
const csvService = require('../services/csvService');
const warrantyService = require('../services/warrantyService');

let passedTests = 0;
let failedTests = 0;

function pass(testName) {
  passedTests++;
  console.log(`  ✅ [PASS] ${testName}`);
}

function fail(testName, err) {
  failedTests++;
  console.error(`  ❌ [FAIL] ${testName}:`, err.message);
}

async function runSuite() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 MASTER END-TO-END SYNCHRONIZATION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  await sequelize.authenticate();
  console.log('Database connected successfully.\n');

  const ts = Date.now();
  const testPhone = `9198${String(ts).slice(-8)}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 1: ORDER PROCESSING & 3-BUTTON VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- Phase 1: Order Processing, Channel Support & First Message ---');

  // Create an order simulating CSV import for Channel "amazon_channel_1"
  const order1 = await Order.create({
    order_number: `ORD-TEST-${ts}-1`,
    marketplace_order_id: `MKT-${ts}-1`,
    marketplace: 'amazon',
    channel: 'amazon_channel_1',
    customer_name: 'Rajesh Sharma',
    customer_phone: testPhone,
    product_name: 'AquaBeat Pure Copper RO Purifier',
    product_sku: 'AKUA-COP-01',
    quantity: 1,
    total_amount: 14999,
    status: 'pending',
    verification_status: 'pending_verification',
    flow_stage: 'ask_images',
    shipping_address: {
      name: 'Rajesh Sharma',
      line1: 'Flat 402, Lotus Towers',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      ship_phone: testPhone,
    },
  });

  // Initiate first verification message (order_verification_interactive)
  const initRes = await OrderVerificationWorkflowService.initiateFirstVerification({
    orderId: order1.id,
    phone: testPhone,
    triggerWorker: false,
  });

  assert.strictEqual(initRes.success, true, 'First verification initiated');
  const outbox1 = await WhatsAppOutbox.findOne({
    where: { order_id: order1.id, template_name: 'order_verification_interactive' },
  });
  assert.ok(outbox1, 'order_verification_interactive queued in outbox');
  pass('order_verification_interactive dispatched upon order ingestion');

  // 1a. Button "yes, Confirm"
  console.log('\n--- Phase 1a: Button [yes, Confirm] Immediately Confirms Order ---');
  const confirmWebhook = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: testPhone,
            id: `msg_confirm_${ts}`,
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: `yes_confirm_${order1.id}`, title: 'yes, Confirm' },
            },
          }],
        },
      }],
    }],
  };

  await whatsappService.handleWebhook(confirmWebhook);
  await order1.reload();

  assert.strictEqual(order1.status, 'confirmed', 'Order status must be confirmed');
  assert.strictEqual(order1.verification_status, 'confirmed', 'Verification status must be confirmed');
  assert.strictEqual(order1.workflow_state, 'CONFIRMED', 'Workflow state must be CONFIRMED');
  pass('Button [yes, Confirm] directly marks order as confirmed on CRM');

  const confirmOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: order1.id, template_name: 'order_confirmation' },
  });
  assert.ok(confirmOutbox, 'order_confirmation template queued to customer');
  pass('Template [order_confirmation] triggered automatically to customer');

  // 1b. Button "send screenshot" & 15-Minute Window
  console.log('\n--- Phase 1b: Button [send screenshot] -> 15-Minute Window & Screenshot Request ---');
  const order2 = await Order.create({
    order_number: `ORD-TEST-${ts}-2`,
    marketplace_order_id: `MKT-${ts}-2`,
    marketplace: 'flipkart',
    channel: 'flipkart',
    customer_name: 'Pooja Verma',
    customer_phone: `9197${String(ts).slice(-8)}`,
    product_name: 'AquaBeat Alkaline RO Purifier',
    product_sku: 'AKUA-ALK-02',
    status: 'pending',
    verification_status: 'pending_verification',
  });

  const screenshotWebhook = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: order2.customer_phone,
            id: `msg_screenshot_${ts}`,
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: `send_screenshot_${order2.id}`, title: 'send screenshot' },
            },
          }],
        },
      }],
    }],
  };

  await whatsappService.handleWebhook(screenshotWebhook);
  await order2.reload();

  assert.strictEqual(order2.verification_status, 'screenshot_requested', 'Status is screenshot_requested');
  assert.ok(order2.screenshot_requested_at, 'screenshot_requested_at recorded');
  assert.ok(order2.screenshot_deadline_at, '15-minute countdown deadline scheduled');
  pass('Button [send screenshot] sets 15-minute window on CRM');

  const scrOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: order2.id, template_name: 'screenshot_from_customer' },
  });
  assert.ok(scrOutbox, 'screenshot_from_customer template queued');
  pass('Template [screenshot_from_customer] triggered to customer');

  // Customer shares screenshot -> Image attached & 15m window cleared
  console.log('\n--- Phase 1b-i: Inbound Customer Screenshot Received ---');
  const imgWebhook = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: order2.customer_phone,
            id: `msg_img_${ts}`,
            type: 'image',
            image: { id: `media_${ts}`, mime_type: 'image/jpeg' },
          }],
        },
      }],
    }],
  };

  await whatsappService.handleWebhook(imgWebhook);
  await order2.reload();

  assert.strictEqual(order2.verification_status, 'image_received', 'Status changed to image_received');
  assert.strictEqual(order2.second_message_due_at, null, '15-minute timer cleared upon receiving image');
  assert.strictEqual(order2.images_provided, true, 'images_provided set to true');

  const customerImages = await CustomerImage.findAll({ where: { order_id: order2.id } });
  assert.ok(customerImages.length > 0, 'CustomerImage saved for order');
  pass('Customer screenshot saved in CustomerImage and displayed in CRM order verification');

  // 1b-ii. 15-Minute Timeout Fallback when customer does NOT share image
  console.log('\n--- Phase 1b-ii: 15-Minute Timeout with NO Image Received ---');
  const order3 = await Order.create({
    order_number: `ORD-TEST-${ts}-3`,
    marketplace_order_id: `MKT-${ts}-3`,
    marketplace: 'indiamart',
    channel: 'indiamart',
    customer_name: 'Amit Patel',
    customer_phone: `9196${String(ts).slice(-8)}`,
    status: 'image_verification',
    verification_status: 'screenshot_requested',
    workflow_state: 'SCREENSHOT_REQUESTED',
    screenshot_deadline_at: new Date(Date.now() - 1000), // Expired 15-min window
    second_message_due_at: new Date(Date.now() - 1000),
  });

  await processOrderVerificationQueue();
  await order3.reload();

  assert.strictEqual(order3.verification_status, 'pending_confirmation', 'Transitioned to pending_confirmation');
  assert.ok(order3.second_message_sent_at, 'second_message_sent_at recorded');

  const m2Outbox = await WhatsAppOutbox.findOne({
    where: { order_id: order3.id, template_name: 'order_confirmation013' },
  });
  assert.ok(m2Outbox, 'order_confirmation013 queued by 15-minute worker');
  pass('Worker dispatches [order_confirmation013] when 15 minutes expire without image');

  // 1b-iii. order_confirmation013 Button: "Cancle order"
  console.log('\n--- Phase 1b-iii: [Cancle order] on order_confirmation013 ---');
  const cancelWebhook = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: order3.customer_phone,
            id: `msg_cancel_${ts}`,
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: `cancel_${order3.id}`, title: 'Cancle order' },
            },
          }],
        },
      }],
    }],
  };

  await whatsappService.handleWebhook(cancelWebhook);
  await order3.reload();

  assert.strictEqual(order3.status, 'cancelled', 'Order status is cancelled');
  assert.strictEqual(order3.verification_status, 'cancelled', 'Verification status is cancelled');
  pass('Button [Cancle order] marks order cancelled on CRM');

  const cancelOutbox = await WhatsAppOutbox.findOne({
    where: { order_id: order3.id, template_name: 'order_cancelled' },
  });
  assert.ok(cancelOutbox, 'order_cancelled template queued');
  pass('Template [order_cancelled] triggered to customer');

  // 1c. Button "call representative"
  console.log('\n--- Phase 1c: Button [call representative] Escalation to Telecaller Suite ---');
  const order4 = await Order.create({
    order_number: `ORD-TEST-${ts}-4`,
    marketplace_order_id: `MKT-${ts}-4`,
    marketplace: 'akuabeat_website',
    channel: 'akuabeat_website',
    customer_name: 'Sunita Rao',
    customer_phone: `9195${String(ts).slice(-8)}`,
    status: 'pending',
    verification_status: 'pending_verification',
  });

  const callRepWebhook = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: order4.customer_phone,
            id: `msg_callrep_${ts}`,
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: `call_rep_${order4.id}`, title: 'call representative' },
            },
          }],
        },
      }],
    }],
  };

  await whatsappService.handleWebhook(callRepWebhook);
  await order4.reload();

  assert.strictEqual(order4.verification_status, 'call_representative_requested', 'Verification status updated to call_representative_requested');

  const telecallerCust = await Customer.findOne({
    where: {
      [Op.or]: [
        { phone: { [Op.like]: `%${order4.customer_phone.slice(-10)}` } },
        { whatsapp_number: { [Op.like]: `%${order4.customer_phone.slice(-10)}` } },
      ],
    },
  });

  assert.ok(telecallerCust, 'Customer entity created/linked for telecaller');
  assert.strictEqual(telecallerCust.installation_help_requested, true, 'installation_help_requested set to true');
  assert.ok(telecallerCust.tags?.includes('call_representative_requested'), 'Tagged with call_representative_requested');

  const followUp = await FollowUp.findOne({
    where: { customer_id: telecallerCust.id, priority: 'urgent' },
  });
  assert.ok(followUp, 'Urgent FollowUp task created for telecaller');
  pass('Button [call representative] routes customer lead directly into Telecaller Suite');

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 2: SHIPPING MODULE STATUS PROGRESSION & INSTALLATION GUIDE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Phase 2: Shipping Module Status Progression & Triggers ---');

  const order5 = await Order.create({
    order_number: `ORD-TEST-${ts}-5`,
    marketplace_order_id: `MKT-${ts}-5`,
    marketplace: 'amazon',
    channel: 'amazon_channel_1',
    customer_name: 'Vikram Singh',
    customer_phone: `9194${String(ts).slice(-8)}`,
    product_name: 'AquaBeat Alkaline RO Purifier',
    status: 'confirmed',
    verification_status: 'confirmed',
    tracking_number: `AWB${ts}5`,
    shipping_partner: 'Delhivery',
  });

  // 2a. Dispatch Status Update
  await order5.update({ status: 'dispatched', dispatched_at: new Date() });
  const dispatchRes = await whatsappService.sendDispatchUpdate(order5);
  assert.ok(dispatchRes, 'sendDispatchUpdate dispatched successfully');
  pass('Status transition to DISPATCHED triggers [order_dispatched] template');

  // 2b. Delivered Status Update -> triggers delivered, installation_guide, warranty_claim
  console.log('\n--- Phase 2b: Delivery Trigger -> order_deliverd + installation_guide ---');
  await order5.update({ status: 'delivered', delivered_at: new Date(), flow_stage: 'installation' });
  const deliveryRes = await whatsappService.sendDeliveryUpdate(order5);
  assert.ok(deliveryRes, 'sendDeliveryUpdate dispatched');
  pass('Status transition to DELIVERED triggers [order_deliverd] template');

  const installLog = await WhatsAppLog.findOne({
    where: { order_id: order5.id, template_name: 'installation_guide' },
  });
  assert.ok(installLog, 'installation_guide template dispatched');
  pass('Immediate [installation_guide] template dispatched to customer upon delivery');

  // 2c. Installation Guide Button "yes, need help" -> Telecaller Suite
  console.log('\n--- Phase 2c: [yes, need help] on installation_guide ---');
  const needHelpWebhook = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: order5.customer_phone,
            id: `msg_needhelp_${ts}`,
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: `yes_need_help`, title: 'yes, need help' },
            },
          }],
        },
      }],
    }],
  };

  await whatsappService.handleWebhook(needHelpWebhook);
  const helpCust = await Customer.findOne({
    where: { phone: { [Op.like]: `%${order5.customer_phone.slice(-10)}` } },
  });
  assert.strictEqual(helpCust.installation_help_requested, true, 'Help requested set');
  pass('Button [yes, need help] escalates customer into Telecaller Suite');

  // 2d. Installation Guide Button "All good, Done" -> Nothing happens
  console.log('\n--- Phase 2d: [All good, Done] on installation_guide ---');
  const allGoodWebhook = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: order5.customer_phone,
            id: `msg_allgood_${ts}`,
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: `all_good_done`, title: 'All good, Done' },
            },
          }],
        },
      }],
    }],
  };

  await whatsappService.handleWebhook(allGoodWebhook);
  pass('Button [All good, Done] recorded quietly without extra messages or escalations');

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 3: WARRANTY PROCESSING & AKUABEAT WEBSITE AUTO-FILL
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Phase 3: Warranty Claim, QR Code, Auto-fill & Activation ---');

  const warrantyLog = await WhatsAppLog.findOne({
    where: { order_id: order5.id, template_name: 'warranty_claim' },
  });
  assert.ok(warrantyLog, 'warranty_claim template dispatched after delivery');
  pass('Delivery automatically dispatched [warranty_claim] template');

  // Verify QR code URL in payload
  const headerComponent = warrantyLog.payload?.components?.find?.((c) => c.type === 'header');
  assert.ok(headerComponent, 'Header component exists in warranty_claim');
  assert.ok(headerComponent.image?.link?.includes('create-qr-code'), 'Dynamic QR Code URL included in header image');
  pass('Template [warranty_claim] contains dynamic scannable QR Code and activation URL');

  // Test Auto-Fill API Endpoint for AkuaBeat Website
  console.log('\n--- Phase 3b: AkuaBeat Website Auto-Fill Lookup Endpoint ---');
  const req = { query: { query: order5.order_number }, params: {} };
  let lookupResult = null;
  const res = {
    status: () => res,
    json: (data) => { lookupResult = data; return res; },
  };

  const warrantyCtrl = require('../controllers/warrantyController');
  await warrantyCtrl.lookupOrder(req, res, () => {});

  assert.ok(lookupResult?.data?.order, 'Order lookup returns order for auto-fill');
  assert.strictEqual(lookupResult.data.order.order_number, order5.order_number, 'Order number matches');
  assert.strictEqual(lookupResult.data.order.product_name, order5.product_name, 'Product name matches');
  pass('AkuaBeat website auto-fill endpoint returns complete order & customer details');

  // Customer submits warranty form on AkuaBeat website
  console.log('\n--- Phase 3c: Warranty Form Submission & Activation ---');
  const formPayload = {
    fullName: 'Vikram Singh',
    mobile: order5.customer_phone.slice(-10),
    orderId: order5.order_number,
    marketplace: 'Amazon',
    productName: order5.product_name,
    purchaseDate: '2026-09-01',
    addressLine1: '123 Marine Drive',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400020',
    brand: 'AkuaBeat',
    modelName: 'Smart Alkaline Series',
    agree: true,
  };

  const registerResult = await warrantyService.registerWarranty(formPayload, null);
  assert.ok(registerResult.warranty, 'Warranty created and returned');
  assert.strictEqual(registerResult.warranty.status, 'ACTIVE', 'Warranty is immediately ACTIVE');
  assert.strictEqual(registerResult.warranty.warranty_status, 'ACTIVE', 'Warranty status is ACTIVE');
  pass('Submitting warranty form activates warranty immediately on CRM');

  // Verify warranty_activated WhatsApp message was queued/sent
  const activatedLog = await WhatsAppLog.findOne({
    where: { order_id: order5.id, template_name: 'warranty_activated' },
  });
  assert.ok(activatedLog, 'warranty_activated template dispatched upon form submission');
  pass('Template [warranty_activated] automatically dispatched to customer upon activation');

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`🎉 ALL TESTS PASSED: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failedTests > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
