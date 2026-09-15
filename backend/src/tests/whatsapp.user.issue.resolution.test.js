'use strict';

const assert = require('assert');

process.env.DB_HOST = '127.0.0.1';
process.env.DB_USER = 'krisha_crm_user';
process.env.DB_PASSWORD = 'krisha_crm-app@20260819';
process.env.DB_NAME = 'krisha_crm_db';

const { sequelize, Order, Customer, CustomerImage, OrderActivity, WhatsAppLog, Warranty } = require('../models');
const whatsappService = require('../services/whatsappService');
const orderController = require('../controllers/orderController');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 TESTING WHATSAPP USER ISSUE RESOLUTIONS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Test 1: Verify all required service exports and models
  console.log('--- Test 1: Verify Exports & Imports ---');
  assert(Warranty, 'Warranty model must be present');
  const requiredTemplates = [
    'sendOrderVerificationInteractive',
    'sendScreenshotRequestMessage',
    'send15MinConfirmation',
    'sendOrderConfirmation',
    'sendOrderCancelled',
    'sendOrderDispatched',
    'sendOrderDelivered',
    'sendInstallationGuide',
    'sendWarrantyActivationMessage',
    'sendWarrantyActivatedConfirmation'
  ];
  for (const tmpl of requiredTemplates) {
    assert(typeof whatsappService[tmpl] === 'function', `whatsappService.${tmpl} must be exported`);
  }
  console.log('  ✅ [PASS] All exports & imports verified successfully.\n');

  // Create temporary test customer and order
  const testPhone = '919999999991';
  let cust = await Customer.findOne({ where: { phone: testPhone } });
  if (!cust) {
    cust = await Customer.create({
      name: 'Test Screenshot Customer',
      phone: testPhone,
      whatsapp_number: testPhone,
      address: 'Test Address',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    });
  }

  const testOrderNum = `TEST-ORD-${Date.now()}`;
  const order = await Order.create({
    order_number: testOrderNum,
    customer_id: cust.id,
    product_name: 'Alkaline Water Purifier',
    product_code: 'AWP-01',
    sku: 'AWP-01-STD',
    amount: 14999,
    status: 'pending_confirmation',
    verification_status: 'pending_verification',
    flow_stage: 'ask_images',
    payment_method: 'cod',
  });

  try {
    // Test 2: Mock sendScreenshotRequestMessage and simulate clicking [Send Screenshot] button
    console.log('--- Test 2: Button Click for "Send Screenshot" ---');
    let screenshotMsgDispatched = false;
    let dispatchedOrderNumber = null;

    const originalSendScr = whatsappService.sendScreenshotRequestMessage;
    whatsappService.sendScreenshotRequestMessage = async (ord) => {
      screenshotMsgDispatched = true;
      dispatchedOrderNumber = ord.order_number;
      return { success: true, messageId: 'wam_test_scr_req' };
    };

    const webhookPayloadBtn = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              from: testPhone,
              id: `wa_msg_${Date.now()}_btn`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              type: 'interactive',
              interactive: {
                type: 'button_reply',
                button_reply: {
                  id: 'btn_1',
                  title: 'Send Screenshot',
                },
              },
            }],
          },
        }],
      }],
    };

    await whatsappService.handleWebhook(webhookPayloadBtn);

    const reloadedOrderAfterBtn = await Order.findByPk(order.id);
    assert(screenshotMsgDispatched, 'screenshot_from_customer message must be automatically dispatched');
    assert.strictEqual(dispatchedOrderNumber, testOrderNum, 'Must dispatch for the correct order');
    assert.strictEqual(reloadedOrderAfterBtn.verification_status, 'screenshot_requested', 'verification_status must be screenshot_requested');
    assert.strictEqual(reloadedOrderAfterBtn.flow_stage, 'ask_images', 'flow_stage must be ask_images');
    assert(reloadedOrderAfterBtn.second_message_due_at, 'second_message_due_at countdown must be set');
    assert.notStrictEqual(reloadedOrderAfterBtn.flow_stage, 'completed', 'flow_stage must NOT be marked completed');
    console.log('  ✅ [PASS] "Send Screenshot" button click strictly triggers screenshot_from_customer and sets 15-min timer.\n');

    // Restore original method
    whatsappService.sendScreenshotRequestMessage = originalSendScr;

    // Test 3: Inbound Customer Screenshot Image Webhook
    console.log('--- Test 3: Inbound Screenshot Webhook Ingestion ---');
    const originalDownload = whatsappService.downloadMediaBuffer;
    whatsappService.downloadMediaBuffer = async () => ({
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      mimeType: 'image/jpeg',
      fileExt: 'jpg',
    });

    const webhookPayloadImg = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            messages: [{
              from: testPhone,
              id: `wa_msg_${Date.now()}_img`,
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              type: 'image',
              image: {
                id: 'media_id_test_123',
                mime_type: 'image/jpeg',
                url: 'https://example.com/mock-image.jpg',
              },
            }],
          },
        }],
      }],
    };

    await whatsappService.handleWebhook(webhookPayloadImg);

    const reloadedOrderAfterImg = await Order.findByPk(order.id);
    const savedImages = await CustomerImage.findAll({ where: { order_id: order.id } });

    assert(savedImages.length > 0, 'Inbound image must be saved and linked to order');
    assert.strictEqual(savedImages[0].order_id, order.id, 'Image order_id must match order');
    assert.strictEqual(reloadedOrderAfterImg.verification_status, 'image_received', 'Order verification_status must be image_received');
    assert.strictEqual(reloadedOrderAfterImg.flow_stage, 'match_pending', 'Order flow_stage must be match_pending');
    assert(reloadedOrderAfterImg.images_provided, 'images_provided flag must be true');
    console.log('  ✅ [PASS] Inbound screenshot attached to order in CRM and updated status.\n');

    // Restore download
    whatsappService.downloadMediaBuffer = originalDownload;

    // Test 4: Auto-reconciliation of orphaned customer images
    console.log('--- Test 4: Auto-reconciliation of Orphaned Customer Images ---');
    const orphanedImg = await CustomerImage.create({
      order_id: null,
      customer_id: cust.id,
      wa_message_id: `wa_orphan_${Date.now()}`,
      file_url: 'https://example.com/orphan.jpg',
      mime_type: 'image/jpeg',
      image_type: 'tap_photo',
      status: 'received',
      uploaded_at: new Date(),
    });

    // Simulate getOne or getOrderImages auto-reconciliation
    const mockReq = { params: { id: order.id } };
    let jsonSent = null;
    const mockRes = {
      status: () => mockRes,
      json: (data) => { jsonSent = data; },
    };
    const mockNext = (err) => { if (err) throw err; };

    await orderController.getOne(mockReq, mockRes, mockNext);

    const reconciledImg = await CustomerImage.findByPk(orphanedImg.id);
    assert.strictEqual(reconciledImg.order_id, order.id, 'Orphaned image must be auto-reconciled to customer order');
    console.log('  ✅ [PASS] Orphaned customer image was auto-reconciled.\n');

    // Test 5: Verify sendTemplateForOrder does not throw "Warranty is not defined"
    console.log('--- Test 5: Verify sendTemplateForOrder avoids "Warranty is not defined" ---');
    const mockResSend = {
      status: () => mockResSend,
      json: (d) => { jsonSent = d; },
    };
    const mockReqSend = {
      params: { id: order.id },
      body: { template_name: 'screenshot_from_customer' },
      user: { id: '00000000-0000-0000-0000-000000000001' },
    };

    let sendErr = null;
    try {
      await orderController.sendTemplateForOrder(mockReqSend, mockResSend, (err) => {
        if (err) sendErr = err;
      });
    } catch (e) {
      sendErr = e;
    }

    if (sendErr) {
      assert(
        !sendErr.message.includes('Warranty is not defined'),
        `sendTemplateForOrder must NOT throw "Warranty is not defined" (Got: ${sendErr.message})`
      );
    }
    console.log('  ✅ [PASS] sendTemplateForOrder does not throw ReferenceError: Warranty is not defined.\n');

  } finally {
    // Cleanup test records
    await CustomerImage.destroy({ where: { customer_id: cust.id } });
    await OrderActivity.destroy({ where: { order_id: order.id } });
    await WhatsAppLog.destroy({ where: { phone_number: testPhone } });
    await order.destroy();
    await cust.destroy();
    console.log('🧹 Cleaned up test records.');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL USER ISSUE RESOLUTION TESTS PASSED!');
  console.log('═══════════════════════════════════════════════════════════════════');
}

runTests().then(() => process.exit(0)).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
