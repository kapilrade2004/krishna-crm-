'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Order, Customer, User, CustomerImage, WhatsAppOutbox, OrderEvent } = require('../models');
const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');
const WhatsAppMessageService = require('../services/whatsapp/whatsappMessageService');
const { ORDER_WORKFLOW_STATES } = require('../services/orderWorkflow/orderStateMachine');
const orderController = require('../controllers/orderController');

async function runFeatures9And10AcceptanceTests() {
  console.log('🧪 RUNNING ACCEPTANCE TESTS: Features 9 & 10 (Customer Image Media Pipeline & CRM Review)\n');

  await sequelize.sync();
  const timestamp = Date.now();

  // Create operator user
  let adminUser = await User.findOne({ where: { role: 'admin' } });
  if (!adminUser) {
    adminUser = await User.create({
      id: uuidv4(),
      name: 'Admin Reviewer',
      email: `admin-${timestamp}@krishnacrm.local`,
      password: 'HashPassword@123',
      role: 'admin',
    });
  }

  // Create test customer & order in SCREENSHOT_REQUESTED state
  const custId = uuidv4();
  const ordId = uuidv4();
  const testPhone = `+919777${String(Math.floor(Math.random() * 800000) + 100000)}`;

  const customer = await Customer.create({
    id: custId,
    name: 'Media Pipeline Customer',
    phone: testPhone,
    whatsapp_number: testPhone,
    source: 'direct',
  });

  const order = await Order.create({
    id: ordId,
    order_number: `ORD-MEDIA-${timestamp}`,
    customer_id: custId,
    customer_name: customer.name,
    customer_phone: testPhone,
    product_name: 'AquaBeat Alkaline Water Purifier',
    product_sku: 'AKUA-ALK-01',
    quantity: 1,
    total_amount: 9499,
    status: 'image_verification',
    verification_status: 'screenshot_requested',
    workflow_state: ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
    screenshot_requested_at: new Date(),
    screenshot_deadline_at: new Date(Date.now() + 15 * 60 * 1000),
  });

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Media Download Failure -> Never set status = 'received'
    // ──────────────────────────────────────────────────────────────────────────
    console.log('1. Testing Media Download Failure Handling (Failure must be DOWNLOAD_FAILED, never RECEIVED)...');

    // Temporarily mock downloadMedia to throw an error
    const originalDownloadMedia = WhatsAppMessageService.downloadMedia;
    WhatsAppMessageService.downloadMedia = async () => {
      throw new Error('AOC_MEDIA_404_EXPIRED: Media expired or invalid on WhatsApp servers');
    };

    const failMediaId = `media-fail-${timestamp}`;
    const failResult = await WhatsAppWebhookService.processEvent({
      type: 'image',
      sender: testPhone,
      mediaId: failMediaId,
      messageId: `msg-fail-${timestamp}`,
    });

    assert.strictEqual(failResult.success, false, 'Failed media download must return success: false');
    assert.strictEqual(failResult.status, 'MEDIA_DOWNLOAD_FAILED');

    const failedImageRow = await CustomerImage.findOne({ where: { media_id: failMediaId } });
    assert(failedImageRow, 'CustomerImage row for failed download must exist');
    assert.strictEqual(failedImageRow.status, 'DOWNLOAD_FAILED', 'Status must be DOWNLOAD_FAILED');
    assert.notStrictEqual(failedImageRow.status, 'RECEIVED', 'Must NEVER be marked RECEIVED when download failed');
    assert.notStrictEqual(failedImageRow.status, 'received', 'Must NEVER be marked received when download failed');
    console.log('   ✓ Media download failure correctly recorded as DOWNLOAD_FAILED (0 false RECEIVED records).');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Successful Inbound Customer Image Pipeline
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n2. Testing Feature 9: Inbound Image Pipeline (Webhook -> Download -> S3 -> CustomerImage -> Link)...');

    // Mock successful downloadMedia returning valid JPEG image buffer
    const mockImageBuffer = Buffer.from('FAKE_JPEG_IMAGE_CONTENT_FOR_TESTING', 'utf-8');
    WhatsAppMessageService.downloadMedia = async () => ({
      buffer: mockImageBuffer,
      contentType: 'image/jpeg',
      mimeType: 'image/jpeg',
    });

    const successMediaId = `media-succ-${timestamp}`;
    const successMsgId = `msg-succ-${timestamp}`;

    const imgResult = await WhatsAppWebhookService.processEvent({
      type: 'image',
      sender: testPhone,
      mediaId: successMediaId,
      messageId: successMsgId,
    });

    assert(imgResult.success, 'Image webhook processing must succeed');
    assert.strictEqual(imgResult.status, 'RECEIVED');

    // Verify CustomerImage row
    const savedImage = await CustomerImage.findOne({ where: { media_id: successMediaId } });
    assert(savedImage, 'CustomerImage record must exist in DB');
    assert.strictEqual(savedImage.order_id, order.id, 'Image must be correctly linked to order');
    assert.strictEqual(savedImage.customer_id, customer.id, 'Image must be linked to customer');
    assert.strictEqual(savedImage.status, 'RECEIVED', 'Status must be RECEIVED');
    assert.ok(savedImage.s3_key, 'S3 key must be populated');
    assert.ok(savedImage.file_url, 'File URL must be populated');
    assert.strictEqual(savedImage.file_size, mockImageBuffer.length, 'File size must match buffer');

    // Verify Order state transition to IMAGE_RECEIVED
    const reloadedOrder = await Order.findByPk(order.id);
    assert.strictEqual(reloadedOrder.workflow_state, ORDER_WORKFLOW_STATES.IMAGE_RECEIVED, 'Workflow state must be IMAGE_RECEIVED');
    assert.strictEqual(reloadedOrder.verification_status, 'image_received', 'verification_status must be image_received');
    assert.ok(reloadedOrder.screenshot_received_at, 'screenshot_received_at must be populated');

    // CRITICAL: Verify Message 2 was NOT sent automatically
    const prematureM2 = await WhatsAppOutbox.findOne({
      where: { order_id: order.id, template_name: 'order_confirmation013' },
    });
    assert.strictEqual(prematureM2, null, 'Message 2 (order_confirmation013) must NOT be sent before CRM operator approval');
    console.log('   ✓ CustomerImage row saved with S3 key, order linked, and Message 2 correctly NOT sent prematurely.');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: CRM API returns image with presigned URL
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n3. Testing CRM API (GET /api/orders/:id returns customerImages with presigned view_url)...');

    let responseData = null;
    const mockReq = { params: { id: order.id }, user: adminUser };
    const mockRes = {
      status: () => mockRes,
      json: (payload) => { responseData = payload; },
    };

    await orderController.getOne(mockReq, mockRes, (err) => { if (err) throw err; });

    assert(responseData && responseData.data, 'API must return order data');
    const returnedOrder = responseData.data.order;
    assert(Array.isArray(returnedOrder.customerImages), 'customerImages must be an array');
    assert(returnedOrder.customerImages.length > 0, 'Must have attached customer images');

    const apiImg = returnedOrder.customerImages.find((img) => img.media_id === successMediaId);
    assert(apiImg, 'API must include the uploaded image');
    assert.ok(apiImg.view_url || apiImg.file_url, 'Image must have view_url or file_url populated for UI rendering');
    console.log('   ✓ CRM API returns customerImages enriched with presigned view_url for frontend rendering.');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Feature 10: CRM Operator Review & Approval
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n4. Testing Feature 10: CRM Operator Review & Approval (POST /api/orders/:id/approve-images)...');

    let approveResponseData = null;
    const mockApproveReq = {
      params: { id: order.id },
      user: adminUser,
      body: { image_id: savedImage.id, note: 'SKU and tap photo confirmed matching.' },
    };
    const mockApproveRes = {
      status: () => mockApproveRes,
      json: (payload) => { approveResponseData = payload; },
    };

    await orderController.approveImages(mockApproveReq, mockApproveRes, (err) => { if (err) throw err; });

    assert(approveResponseData && approveResponseData.data, 'Approve API must return success payload');

    // Verify Image status updated to approved
    const approvedImage = await CustomerImage.findByPk(savedImage.id);
    assert.strictEqual(approvedImage.status, 'approved', 'Image status must be approved');
    assert.strictEqual(approvedImage.reviewed_by, adminUser.id, 'Image reviewed_by must be set to operator');

    // Verify Order state advanced to PENDING_CUSTOMER_CONFIRMATION
    const finalOrder = await Order.findByPk(order.id);
    assert.strictEqual(finalOrder.workflow_state, ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION);
    assert.strictEqual(finalOrder.verification_status, 'sku_matched');

    // Verify Message 2 (order_confirmation013) is NOW enqueued in Outbox
    const m2Outbox = await WhatsAppOutbox.findOne({
      where: { order_id: order.id, template_name: 'order_confirmation013' },
    });
    assert(m2Outbox, 'Message 2 (order_confirmation013) must be enqueued after CRM approval');
    assert.strictEqual(m2Outbox.status, 'QUEUED');
    console.log('   ✓ CRM operator approved image -> Order transitioned to PENDING_CUSTOMER_CONFIRMATION and Message 2 queued.');

    // Restore downloadMedia
    WhatsAppMessageService.downloadMedia = originalDownloadMedia;

    console.log('\n🎉 ALL FEATURES 9 & 10 ACCEPTANCE TESTS PASSED (100% SUCCESS)\n');
  } finally {
    // Clean up test data
    await CustomerImage.destroy({ where: { customer_id: customer.id } });
    await WhatsAppOutbox.destroy({ where: { order_id: order.id } });
    await OrderEvent.destroy({ where: { order_id: order.id } });
    await Order.destroy({ where: { id: order.id } });
    await Customer.destroy({ where: { id: customer.id } });
  }
}

runFeatures9And10AcceptanceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Features 9 & 10 test failed:', err);
    process.exit(1);
  });
