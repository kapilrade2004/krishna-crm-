'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'mysql';
process.env.JWT_SECRET = 'test_jwt_secret_exact_workflow_123';

const {
  sequelize,
  User,
  Customer,
  Order,
  CustomerImage,
  OrderActivity,
  WhatsAppLog,
  CsvImportBatch,
  WhatsAppBatch,
  syncModels,
} = require('../models');

const whatsappService = require('../services/whatsappService');
const whatsappCostService = require('../services/whatsappCostService');
const whatsappBatchService = require('../services/whatsappBatchService');
const orderController = require('../controllers/orderController');
const orderVerificationWorker = require('../services/orderVerificationWorker');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');

// 1x1 JPEG buffer
const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);

// Mock low-level network sendTemplate
const dispatchedTemplates = [];
whatsappService.sendTemplate = async ({ to, templateName, orderId, customerId, components }) => {
  dispatchedTemplates.push({ to, templateName, orderId, customerId, components });
  return {
    success: true,
    messageId: `wam_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    status: 'sent',
  };
};

// Mock downloadMediaBuffer for testing images
whatsappService.downloadMediaBuffer = async () => ({
  buffer: JPEG_BUFFER,
  mimeType: 'image/jpeg',
  fileExt: 'jpg',
});

async function runExactWorkflowTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 RUNNING EXACT USER DIRECTIVES VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, msg) {
    if (!cond) {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
      throw new Error(`Assertion Failed: ${msg}`);
    } else {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    }
  }

  await syncModels({ force: true });

  try {
    let adminUser = await User.findOne();
    if (!adminUser) {
      adminUser = await User.create({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Operations Manager',
        email: `ops_${Date.now()}@krishnawater.com`,
        password: 'Password123!',
        password_hash: 'hash123',
        role: 'admin',
      });
    }

    // ── Test 1: Batch division and exact cost calculation (100 customers/batch) ──
    console.log('--- Test 1: Batch Division & Pricing for 1st Message (100/batch) ---');
    const costPerMsg = await whatsappCostService.getRatePerMessage();
    assert(costPerMsg > 0, `Exact cost configured for order_verification_interactive (₹${costPerMsg})`);

    const estCost100 = await whatsappCostService.calculateEstimatedCost(100);
    assert(estCost100.estimated_cost === parseFloat((costPerMsg * 100).toFixed(2)), `Exact cost for 100 customers calculates to ₹${estCost100.estimated_cost}`);

    const estCost250 = await whatsappCostService.calculateEstimatedCost(250);
    assert(estCost250.estimated_cost === parseFloat((costPerMsg * 250).toFixed(2)), `Exact cost for 250 customers calculates to ₹${estCost250.estimated_cost}`);

    const timestamp = Date.now();
    const importBatch = await CsvImportBatch.create({
      filename: `test_batch_${timestamp}.csv`,
      file_path: `/uploads/csv/test_batch_${timestamp}.csv`,
      marketplace: 'shopify',
      uploaded_by: adminUser.id,
      total_rows: 250,
      valid_rows: 250,
      invalid_rows: 0,
      status: 'completed',
    });

    const createdOrderIds = [];
    for (let i = 0; i < 250; i++) {
      const cust = await Customer.create({
        name: `Batch User ${i}`,
        phone: `9198${String(timestamp).slice(-6)}${String(i).padStart(3, '0')}`,
        whatsapp_number: `9198${String(timestamp).slice(-6)}${String(i).padStart(3, '0')}`,
        whatsapp_opt_in: true,
      });
      const ord = await Order.create({
        order_number: `ORD-B-${timestamp}-${i}`,
        customer_id: cust.id,
        product_name: 'AquaBeat Purifier Premier',
        product_sku: 'AKU-WTR-PREM-01',
        total_amount: 8999,
        status: 'pending_verification',
        verification_status: 'pending_verification',
        flow_stage: 'ask_images',
        import_batch_id: importBatch.id,
      });
      createdOrderIds.push(ord.id);
    }

    const batchResult = await whatsappBatchService.createBatchesForImport(importBatch.id);
    console.log('batchResult summary:', {
      totalOrders: batchResult.uploaded_records,
      eligible: batchResult.eligible_for_whatsapp,
      excluded: batchResult.excluded_records,
      exclusion_breakdown: batchResult.exclusion_breakdown,
      batchesCount: batchResult.batches?.length,
    });
    const createdBatches = batchResult.batches || [];

    assert(createdBatches.length === 3, `250 orders divided into 3 batches (Batch 1: 100, Batch 2: 100, Batch 3: 50)`);
    assert(createdBatches[0].customer_count === 100, `Batch 1 contains exactly 100 customers`);
    assert(createdBatches[1].customer_count === 100, `Batch 2 contains exactly 100 customers`);
    assert(createdBatches[2].customer_count === 50, `Batch 3 contains exactly 50 customers`);
    assert(createdBatches[0].estimated_cost === parseFloat((costPerMsg * 100).toFixed(2)), `Batch 1 estimated cost matches ₹${parseFloat((costPerMsg * 100).toFixed(2))}`);

    // ── Test 2: Message 1 Direct Confirmation -> Confirmed -> Dispatches order_confirmation (Msg 3) ──
    console.log('\n--- Test 2: Msg 1 [Yes, Confirm] -> Direct Order Confirmed & Msg 3 Sent ---');
    dispatchedTemplates.length = 0;
    const cust2 = await Customer.create({
      name: 'Rohan Sharma',
      phone: `919811${String(timestamp).slice(-6)}1`,
      whatsapp_number: `919811${String(timestamp).slice(-6)}1`,
    });
    const ord2 = await Order.create({
      order_number: `ORD-DIRECT-${timestamp}`,
      customer_id: cust2.id,
      product_name: 'AquaBeat Purifier Premier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 8999,
      status: 'pending_verification',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
    });

    // Customer clicks [Yes, Confirm] on Message 1
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust2.whatsapp_number,
              id: `wam_confirm_${timestamp}`,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: { id: `yes_confirm_${ord2.id}`, title: 'Yes, Confirm' },
              },
            }],
          },
        }],
      }],
    });

    await whatsappOutboxQueue.processPendingMessages();

    const reloadedOrd2 = await Order.findByPk(ord2.id);
    assert(reloadedOrd2.status === 'confirmed', `Order directly marked status='confirmed' on CRM`);
    assert(reloadedOrd2.verification_status === 'confirmed', `Order marked verification_status='confirmed'`);
    assert(reloadedOrd2.flow_stage === 'match_confirmed', `Order marked flow_stage='match_confirmed'`);
    assert(reloadedOrd2.second_message_due_at === null, `15-minute countdown cleared (no Msg 2 needed)`);

    const msg3Log = await WhatsAppLog.findOne({
      where: { order_id: ord2.id, template_name: 'order_confirmation', direction: 'outbound' },
    });
    assert(!!msg3Log || dispatchedTemplates.some(t => t.templateName === 'order_confirmation'), `Template 3 (order_confirmation) was automatically dispatched and logged`);

    // ── Test 3: Message 1 [Send Screenshot] -> Dispatches 'screenshot_from_customer' & sets 15 min window ──
    console.log('\n--- Test 3: Msg 1 [Send Screenshot] -> Dispatches screenshot_from_customer & 15m Window ---');
    dispatchedTemplates.length = 0;
    const cust3 = await Customer.create({
      name: 'Pooja Verma',
      phone: `919822${String(timestamp).slice(-6)}2`,
      whatsapp_number: `919822${String(timestamp).slice(-6)}2`,
      whatsapp_opt_in: true,
    });
    const ord3 = await Order.create({
      order_number: `ORD-SCR-${timestamp}`,
      customer_id: cust3.id,
      product_name: 'AquaBeat Purifier Premier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 8999,
      status: 'pending_verification',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
    });

    // Customer clicks [Send Screenshot] on Message 1
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust3.whatsapp_number,
              id: `wam_scr_${timestamp}`,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: { id: `send_screenshot_${ord3.id}`, title: 'Send Screenshot' },
              },
            }],
          },
        }],
      }],
    });

    await whatsappOutboxQueue.processPendingMessages();

    const reloadedOrd3 = await Order.findByPk(ord3.id);
    assert(reloadedOrd3.verification_status === 'screenshot_requested', `Order marked verification_status='screenshot_requested'`);
    assert(reloadedOrd3.screenshot_requested_at !== null, `screenshot_requested_at timestamp recorded`);
    assert(reloadedOrd3.second_message_due_at !== null, `15-minute window second_message_due_at scheduled`);

    const scrPromptLog = await WhatsAppLog.findOne({
      where: { order_id: ord3.id, template_name: 'screenshot_from_customer', direction: 'outbound' },
    });
    assert(!!scrPromptLog || dispatchedTemplates.some(t => t.templateName === 'screenshot_from_customer'), `Template 'screenshot_from_customer' immediately dispatched to customer`);

    // ── Test 4: Inbound image received -> Operator clicks "Matched" -> order_confirmation013 dispatched ──
    console.log('\n--- Test 4: Image Received -> Operator Clicks "Matched" -> order_confirmation013 Sent ---');
    dispatchedTemplates.length = 0;
    // Simulate customer uploading tap photo
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust3.whatsapp_number,
              id: `wam_img_${timestamp}`,
              type: 'image',
              image: { id: `media_${timestamp}`, mime_type: 'image/jpeg' },
            }],
          },
        }],
      }],
    });

    const imgOrd3 = await Order.findByPk(ord3.id);
    assert(imgOrd3.verification_status === 'image_received', `Order moves to Image Received section (verification_status='image_received')`);
    assert(imgOrd3.images_provided === true, `Order images_provided flag set to true`);

    // Operator reviews photo and clicks "Matched" (POST /api/orders/:id/sku-match)
    let mockResData = null;
    const mockReq = {
      params: { id: ord3.id },
      user: { id: adminUser.id },
      body: { notes: 'Tap verified compatible with standard adapter.' },
    };
    const mockRes = {
      status: () => mockRes,
      json: (data) => { mockResData = data; return mockRes; },
    };
    const mockNext = (err) => { if (err) throw err; };

    await orderController.skuMatch(mockReq, mockRes, mockNext);
    await whatsappOutboxQueue.processPendingMessages();

    const matchedOrd3 = await Order.findByPk(ord3.id);
    assert(matchedOrd3.status === 'pending_confirmation', `Order moved to Pending Confirmation (status='pending_confirmation')`);
    assert(matchedOrd3.flow_stage === 'match_pending', `Order flow_stage='match_pending'`);
    assert(['pending_confirmation', 'sku_matched'].includes(matchedOrd3.verification_status), `Order verification_status is pending customer confirmation`);

    const msg2Log = await WhatsAppLog.findOne({
      where: { order_id: ord3.id, template_name: 'order_confirmation013', direction: 'outbound' },
    });
    assert(!!msg2Log || dispatchedTemplates.some(t => t.templateName === 'order_confirmation013'), `Template 2 (order_confirmation013) automatically dispatched to customer upon SKU Match`);

    // Customer clicks [Confirm Order] on Message 2
    dispatchedTemplates.length = 0;
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust3.whatsapp_number,
              id: `wam_conf2_${timestamp}`,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: { id: `confirm_order_${ord3.id}`, title: 'Confirm Order' },
              },
            }],
          },
        }],
      }],
    });

    await whatsappOutboxQueue.processPendingMessages();

    const finalOrd3 = await Order.findByPk(ord3.id);
    assert(finalOrd3.status === 'confirmed', `Order moves to Confirmed Orders (status='confirmed')`);
    assert(finalOrd3.verification_status === 'confirmed', `verification_status='confirmed'`);
    const finalMsg3Log = await WhatsAppLog.findOne({
      where: { order_id: ord3.id, template_name: 'order_confirmation', direction: 'outbound' },
    });
    assert(!!finalMsg3Log || dispatchedTemplates.some(t => t.templateName === 'order_confirmation'), `Template 3 (order_confirmation) dispatched upon Message 2 customer confirmation`);

    // ── Test 5: Cancellation on Message 1 or Message 2 -> Cancelled & order_cancelled sent ──
    console.log('\n--- Test 5: Cancellation Flow on Msg 1 / Msg 2 -> Cancelled & order_cancelled Sent ---');
    dispatchedTemplates.length = 0;
    const cust5 = await Customer.create({
      name: 'Amit Patel',
      phone: `919833${String(timestamp).slice(-6)}5`,
      whatsapp_number: `919833${String(timestamp).slice(-6)}5`,
      whatsapp_opt_in: true,
    });
    const ord5 = await Order.create({
      order_number: `ORD-CANCEL-${timestamp}`,
      customer_id: cust5.id,
      product_name: 'AquaBeat Purifier Premier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 8999,
      status: 'pending_verification',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
    });

    // Customer clicks [Cancel Order]
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust5.whatsapp_number,
              id: `wam_canc_${timestamp}`,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: { id: `cancel_order_${ord5.id}`, title: 'Cancel Order' },
              },
            }],
          },
        }],
      }],
    });

    await whatsappOutboxQueue.processPendingMessages();

    const cancelledOrd5 = await Order.findByPk(ord5.id);
    assert(cancelledOrd5.status === 'cancelled', `Order marked status='cancelled' on CRM`);
    assert(cancelledOrd5.verification_status === 'cancelled', `Order marked verification_status='cancelled'`);
    assert(cancelledOrd5.flow_stage === 'match_cancelled', `Order marked flow_stage='match_cancelled'`);

    const cancelMsgLog = await WhatsAppLog.findOne({
      where: { order_id: ord5.id, template_name: 'order_cancelled', direction: 'outbound' },
    });
    assert(!!cancelMsgLog || dispatchedTemplates.some(t => t.templateName === 'order_cancelled'), `Template 4 (order_cancelled) dispatched to customer`);

    // ── Test 6: 15-Minute Countdown Worker Fallback Trigger ──
    console.log('\n--- Test 6: 15-Minute Countdown Fallback Worker ---');
    dispatchedTemplates.length = 0;
    const cust6 = await Customer.create({
      name: 'Suresh Raina',
      phone: `919844${String(timestamp).slice(-6)}6`,
      whatsapp_number: `919844${String(timestamp).slice(-6)}6`,
      whatsapp_opt_in: true,
    });
    const ord6 = await Order.create({
      order_number: `ORD-TIMEOUT-${timestamp}`,
      customer_id: cust6.id,
      product_name: 'AquaBeat Purifier Premier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 8999,
      status: 'pending_verification',
      verification_status: 'screenshot_requested',
      flow_stage: 'ask_images',
      second_message_due_at: new Date(Date.now() - 1000), // Due in the past (expired 15-min countdown)
    });

    await orderVerificationWorker.processOrderVerificationQueue();
    await whatsappOutboxQueue.processPendingMessages();

    const timedOutOrd6 = await Order.findByPk(ord6.id);
    assert(timedOutOrd6.second_message_sent_at !== null, `second_message_sent_at recorded by 15-minute worker`);
    assert(timedOutOrd6.status === 'pending_confirmation', `Order transitioned to pending_confirmation by worker`);
    assert(timedOutOrd6.final_confirmation_due_at !== null, `final_confirmation_due_at deadline scheduled by worker`);

    const timeoutMsg2Log = await WhatsAppLog.findOne({
      where: { order_id: ord6.id, template_name: 'order_confirmation013', direction: 'outbound' },
    });
    assert(!!timeoutMsg2Log || dispatchedTemplates.some(t => t.templateName === 'order_confirmation013'), `Worker dispatched Template 2 (order_confirmation013) after 15-minute countdown expiry`);

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 7: Final Confirmation Deadline Expiration Auto-Cancels Order (Sections 18, 68, 79)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Stage 7: Final Confirmation Response Window Expiration Auto-Cancels Order ---');
    const cust7 = await Customer.create({
      name: 'Nitin Rao',
      whatsapp_number: `919844${String(timestamp).slice(-6)}7`,
      whatsapp_opt_in: true,
    });
    const ord7 = await Order.create({
      order_number: `ORD-FINALTIMEOUT-${timestamp}`,
      customer_id: cust7.id,
      product_name: 'AquaBeat Purifier Premier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 8999,
      status: 'pending_confirmation',
      verification_status: 'pending_confirmation',
      flow_stage: 'match_pending',
      second_message_sent_at: new Date(Date.now() - 8 * 60 * 60 * 1000), // Sent 8 hours ago
      final_confirmation_due_at: new Date(Date.now() - 1000), // Expired
    });

    await orderVerificationWorker.processOrderVerificationQueue();
    await whatsappOutboxQueue.processPendingMessages();

    const cancelledOrd7 = await Order.findByPk(ord7.id);
    assert(cancelledOrd7.status === 'cancelled', `Order automatically transitioned to CANCELLED on final timeout`);
    assert(cancelledOrd7.verification_status === 'cancelled', `verification_status updated to cancelled`);
    assert(cancelledOrd7.flow_stage === 'match_cancelled', `flow_stage updated to match_cancelled`);
    assert(cancelledOrd7.final_confirmation_due_at === null, `final_confirmation_due_at cleared after cancellation`);

    const timeoutAct = await OrderActivity.findOne({
      where: { order_id: ord7.id, action: 'customer_timeout_cancelled' },
    });
    assert(!!timeoutAct, `CUSTOMER_NO_RESPONSE_AFTER_FINAL_CONFIRMATION activity recorded in audit trail`);

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 8: Late Customer Response on Cancelled Order (Section 69)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Stage 8: Late Customer Response on Cancelled Order Protected ---');
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust7.whatsapp_number,
              id: `wam_late_${timestamp}`,
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: { id: 'confirm_order', title: 'Confirm Order' },
              },
            }],
          },
        }],
      }],
    });

    const reloadedLateOrd7 = await Order.findByPk(ord7.id);
    assert(reloadedLateOrd7.status === 'cancelled', `Cancelled order NOT resurrected to confirmed on late response`);

    const lateAct = await OrderActivity.findOne({
      where: { order_id: ord7.id, action: 'late_response_received' },
    });
    assert(!!lateAct, `late_response_received audit activity logged`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`🎉 ALL EXACT USER WORKFLOW TESTS PASSED: ${passed} PASSED, ${failed} FAILED`);
    console.log('═══════════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test Suite Aborted with Error:', err);
    process.exit(1);
  }
}

runExactWorkflowTests();
