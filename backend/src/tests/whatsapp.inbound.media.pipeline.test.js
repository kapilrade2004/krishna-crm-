'use strict';

const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'mysql';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.JWT_SECRET = 'test_jwt_secret_media_pipeline_123';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test_aws_key_id_placeholder';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test_aws_secret_access_key_placeholder';
process.env.AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'krishna-crm';

const assert = require('assert');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, Customer, Order, CustomerImage, OrderActivity, WhatsAppLog, syncModels } = require('../models');
const whatsappService = require('../services/whatsappService');
const s3Service = require('../services/s3Service');
const orderController = require('../controllers/orderController');

// 1x1 transparent GIF / JPEG / PNG / WEBP sample buffers
const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);
const PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const WEBP_BUFFER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 ', 'ascii'),
  Buffer.from([0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25]),
]);
const PDF_BUFFER = Buffer.from('%PDF-1.4 dummy non-image content');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING INBOUND WHATSAPP CUSTOMER MEDIA PIPELINE TEST SUITE (20 CASES)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  await syncModels({ force: true });

  const testUser = await User.create({
    name: 'Lead Verifier',
    email: `verifier-${Date.now()}@krishnacrm.local`,
    password: 'Password@123',
    role: 'admin',
  });
  const userId = testUser.id;

  // Helper for mock response object
  const createMockRes = () => {
    const res = {
      statusCode: 200,
      data: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (payload) {
        this.data = payload;
        return this;
      },
    };
    return res;
  };

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. S3 Presigned URL Generation
  await test('TC1: S3 Service generates valid presigned URL', async () => {
    const testKey = `test/whatsapp-media/${crypto.randomUUID()}.jpg`;
    const url = await s3Service.getPresignedViewUrl({ key: testKey, expiresIn: 1800 });
    assert.ok(url, 'Presigned URL must be generated');
    assert.ok(typeof url === 'string', 'URL must be a string');
  });

  // 2. Inbound JPEG Media Download & S3 Upload
  await test('TC2: Inbound JPEG image buffer upload & validation', async () => {
    const res = await whatsappService.downloadAndSaveMedia({
      mime_type: 'image/jpeg',
      buffer: JPEG_BUFFER,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.mimeType, 'image/jpeg');
    assert.ok(res.s3Key.includes('.jpg'));
    assert.ok(res.fileSize > 0);
  });

  // 3. Inbound PNG Media Download & S3 Upload
  await test('TC3: Inbound PNG image buffer upload & validation', async () => {
    const res = await whatsappService.downloadAndSaveMedia({
      mime_type: 'image/png',
      buffer: PNG_BUFFER,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.mimeType, 'image/png');
    assert.ok(res.s3Key.includes('.png'));
  });

  // 4. Inbound WEBP Media Download & S3 Upload
  await test('TC4: Inbound WEBP image buffer upload & validation', async () => {
    const res = await whatsappService.downloadAndSaveMedia({
      mime_type: 'image/webp',
      buffer: WEBP_BUFFER,
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.mimeType, 'image/webp');
    assert.ok(res.s3Key.includes('.webp'));
  });

  // 5. Unsupported MIME rejection
  await test('TC5: Unsupported MIME type (application/pdf) is rejected', async () => {
    let threw = false;
    try {
      await whatsappService.downloadAndSaveMedia({
        mime_type: 'application/pdf',
        buffer: PDF_BUFFER,
      });
    } catch (e) {
      threw = true;
      assert.strictEqual(e.code, 'UNSUPPORTED_MIME_TYPE');
    }
    assert.ok(threw, 'Should throw UNSUPPORTED_MIME_TYPE error');
  });

  // 6. Oversized image rejection (>10MB)
  await test('TC6: Oversized image (>10MB) is rejected', async () => {
    let threw = false;
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    try {
      await whatsappService.downloadAndSaveMedia({
        mime_type: 'image/jpeg',
        buffer: largeBuffer,
      });
    } catch (e) {
      threw = true;
      assert.strictEqual(e.code, 'FILE_TOO_LARGE');
    }
    assert.ok(threw, 'Should throw FILE_TOO_LARGE error');
  });

  // Create test customer & orders
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const customer = await Customer.create({
    name: 'Test WhatsApp Media Customer',
    phone: testPhone,
    whatsapp_number: `91${testPhone}`,
    whatsapp_opt_in: true,
  });

  // 7. Single active order auto-attachment
  let singleOrder = await Order.create({
    order_number: `ORD-TEST-${Date.now()}-1`,
    customer_id: customer.id,
    status: 'image_verification',
    verification_status: 'pending_verification',
    flow_stage: 'ask_images',
    product_sku: 'KB-TAP-FILTER-01',
    product_name: 'Krishna Tap Purifier Filter Model 1',
    quantity: 1,
    unit_price: 1999,
    total_amount: 1999,
    marketplace: 'website',
  });

  await test('TC7: Inbound WhatsApp webhook auto-attaches to single eligible order', async () => {
    const msgId = `wam_test_${Date.now()}_1`;
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: `91${testPhone}`,
              id: msgId,
              type: 'image',
              timestamp: `${Math.floor(Date.now() / 1000)}`,
              image: {
                mime_type: 'image/jpeg',
                buffer: JPEG_BUFFER,
              },
            }],
          },
        }],
      }],
    });

    const savedImage = await CustomerImage.findOne({ where: { wa_message_id: msgId } });
    assert.ok(savedImage, 'CustomerImage record must be created');
    assert.strictEqual(savedImage.order_id, singleOrder.id, 'Image must be auto-attached to single active order');
    assert.strictEqual(savedImage.status, 'received');

    await singleOrder.reload();
    assert.strictEqual(singleOrder.flow_stage, 'match_pending', 'Order must transition to match_pending');
    assert.strictEqual(singleOrder.verification_status, 'image_received');
    assert.strictEqual(singleOrder.images_provided, true);
  });

  // 8. OrderActivity audit log creation
  await test('TC8: OrderActivity is recorded on customer image receipt', async () => {
    const activity = await OrderActivity.findOne({
      where: { order_id: singleOrder.id, action: 'customer_image_received' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(activity, 'OrderActivity must be recorded');
    assert.strictEqual(activity.to_value, 'image_received');
  });

  // 9. Idempotency test (duplicate webhook replay)
  await test('TC9: Idempotent webhook handling prevents duplicate customer images', async () => {
    const msgId = `wam_test_idempotent_${Date.now()}`;
    const payload = {
      from: `91${testPhone}`,
      messageId: msgId,
      type: 'image',
      image: { mime_type: 'image/jpeg', buffer: JPEG_BUFFER },
    };

    // First arrival
    await whatsappService.handleWebhook(payload);
    const count1 = await CustomerImage.count({ where: { wa_message_id: msgId } });
    assert.strictEqual(count1, 1, 'First webhook must insert 1 customer image');

    // Duplicate replay
    await whatsappService.handleWebhook(payload);
    const count2 = await CustomerImage.count({ where: { wa_message_id: msgId } });
    assert.strictEqual(count2, 1, 'Duplicate webhook replay must NOT insert extra records');
  });

  // 10. Multi-order disambiguation rule (DO NOT GUESS)
  await test('TC10: Multi-order disambiguation leaves image unassigned when multiple orders are open', async () => {
    // Create two active orders for same customer to test disambiguation conflict
    const order2 = await Order.create({
      order_number: `ORD-TEST-${Date.now()}-2`,
      customer_id: customer.id,
      status: 'image_verification',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      product_sku: 'KB-TAP-FILTER-02',
      product_name: 'Krishna Tap Purifier Filter Model 2',
      quantity: 1,
      unit_price: 2499,
      total_amount: 2499,
      marketplace: 'amazon',
    });

    const order3 = await Order.create({
      order_number: `ORD-TEST-${Date.now()}-3`,
      customer_id: customer.id,
      status: 'image_verification',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      product_sku: 'KB-TAP-FILTER-03',
      product_name: 'Krishna Tap Purifier Filter Model 3',
      quantity: 1,
      unit_price: 2999,
      total_amount: 2999,
      marketplace: 'amazon',
    });

    const multiMsgId = `wam_test_multi_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: `91${testPhone}`,
      messageId: multiMsgId,
      type: 'image',
      image: { mime_type: 'image/png', buffer: PNG_BUFFER },
    });

    const multiImage = await CustomerImage.findOne({ where: { wa_message_id: multiMsgId } });
    assert.ok(multiImage, 'CustomerImage must be created');
    assert.strictEqual(multiImage.customer_id, customer.id);
    assert.strictEqual(multiImage.order_id, null, 'Multi-order conflict must leave order_id null to prevent guessing');
  });

  // 11. Unknown phone number sender handling
  await test('TC11: Inbound image from unknown phone number is safely saved unassigned', async () => {
    const unknownPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
    const unknownMsgId = `wam_test_unknown_${Date.now()}`;

    await whatsappService.handleWebhook({
      from: `91${unknownPhone}`,
      messageId: unknownMsgId,
      type: 'image',
      image: { mime_type: 'image/jpeg', buffer: JPEG_BUFFER },
    });

    const unassignedImage = await CustomerImage.findOne({ where: { wa_message_id: unknownMsgId } });
    assert.ok(unassignedImage, 'Image must be saved');
    assert.strictEqual(unassignedImage.order_id, null);
  });

  // 12. Manual image assignment to order (PATCH /api/orders/:id/assign-image/:imageId)
  await test('TC12: Operator can assign unlinked image to specific order', async () => {
    const unlinkedImg = await CustomerImage.create({
      customer_id: customer.id,
      order_id: null,
      s3_key: `uploads/test-${Date.now()}.jpg`,
      status: 'received',
      uploaded_at: new Date(),
    });

    const mockReq = {
      params: { id: singleOrder.id, imageId: unlinkedImg.id },
      user: { id: userId, name: 'Verifier Operator' },
    };
    const mockRes = createMockRes();

    await orderController.assignImageToOrder(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    await unlinkedImg.reload();
    assert.strictEqual(unlinkedImg.order_id, singleOrder.id);
    assert.ok(mockRes.data?.data?.image, 'Response must include enriched image');
  });

  // 13. GET /api/orders/:id includes customerImages with presigned URLs
  await test('TC13: GET /api/orders/:id enriches customerImages with presigned S3 URLs', async () => {
    const mockReq = { params: { id: singleOrder.id } };
    const mockRes = createMockRes();

    await orderController.getOne(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    const returnedOrder = mockRes.data?.data?.order;
    assert.ok(returnedOrder, 'Order must be returned');
    assert.ok(Array.isArray(returnedOrder.customerImages), 'customerImages must be an array');
    assert.ok(returnedOrder.customerImages.length > 0, 'Must have attached images');

    const firstImg = returnedOrder.customerImages[0];
    assert.ok(firstImg.presigned_url, 'Must include generated presigned_url');
    assert.ok(firstImg.view_url, 'Must include view_url');
  });

  // 14. GET /api/orders/:id/images returns enriched images
  await test('TC14: GET /api/orders/:id/images returns all order images with presigned URLs', async () => {
    const mockReq = { params: { id: singleOrder.id } };
    const mockRes = createMockRes();

    await orderController.getOrderImages(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    const images = mockRes.data?.data?.images;
    assert.ok(Array.isArray(images), 'Images must be returned');
    assert.ok(images.length > 0);
    assert.ok(images[0].presigned_url, 'Images must include presigned_url');
  });

  // 15. GET /api/orders/:id/verification-detail returns enriched images and product master
  await test('TC15: GET /api/orders/:id/verification-detail returns verification workstation payload', async () => {
    const mockReq = { params: { id: singleOrder.id } };
    const mockRes = createMockRes();

    await orderController.getVerificationDetail(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    const detail = mockRes.data?.data;
    assert.ok(detail.order, 'Detail must include order');
    assert.ok(Array.isArray(detail.customerImages), 'Must include customerImages');
  });

  // 16. Approve specific image -> transitions order to confirmed
  await test('TC16: POST /api/orders/:id/approve-images approves image and transitions order to confirmed', async () => {
    const imgToApprove = await CustomerImage.findOne({ where: { order_id: singleOrder.id, status: 'received' } });
    assert.ok(imgToApprove, 'Must have a received image');

    const mockReq = {
      params: { id: singleOrder.id },
      body: { imageId: imgToApprove.id, note: 'Approved tap photo 22mm external thread' },
      user: { id: userId, name: 'Lead Verifier' },
    };
    const mockRes = createMockRes();

    await orderController.approveImages(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    await imgToApprove.reload();
    assert.strictEqual(imgToApprove.status, 'approved');
    assert.strictEqual(imgToApprove.reviewed_by, userId);
    assert.ok(imgToApprove.reviewed_at);

    await singleOrder.reload();
    assert.strictEqual(singleOrder.status, 'confirmed');
    assert.strictEqual(singleOrder.verification_status, 'confirmed');
    assert.strictEqual(singleOrder.flow_stage, 'match_confirmed');

    const activity = await OrderActivity.findOne({
      where: { order_id: singleOrder.id, action: 'images_approved' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(activity, 'OrderActivity images_approved must be recorded');
  });

  // 17. Reject image -> keeps order in image_verification with reason
  await test('TC17: POST /api/orders/:id/reject-images rejects image and sets reason', async () => {
    // Re-open single order for rejection test
    await singleOrder.update({
      status: 'image_verification',
      verification_status: 'image_received',
      flow_stage: 'match_pending',
    });

    const newImg = await CustomerImage.create({
      order_id: singleOrder.id,
      customer_id: customer.id,
      s3_key: `uploads/test-reject-${Date.now()}.jpg`,
      status: 'received',
      uploaded_at: new Date(),
    });

    const mockReq = {
      params: { id: singleOrder.id },
      body: { imageId: newImg.id, reason: 'Tap photo is blurry and thread size is unreadable', request_new: false },
      user: { id: userId, name: 'Lead Verifier' },
    };
    const mockRes = createMockRes();

    await orderController.rejectImages(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    await newImg.reload();
    assert.strictEqual(newImg.status, 'rejected');
    assert.strictEqual(newImg.rejection_reason, 'Tap photo is blurry and thread size is unreadable');

    await singleOrder.reload();
    assert.strictEqual(singleOrder.status, 'image_verification');
    assert.strictEqual(singleOrder.flow_stage, 'ask_images');
    assert.strictEqual(singleOrder.image_rejection_reason, 'Tap photo is blurry and thread size is unreadable');
  });

  // 18. Request new image endpoint (POST /api/orders/:id/request-new-image)
  await test('TC18: POST /api/orders/:id/request-new-image records action and updates notes', async () => {
    const mockReq = {
      params: { id: singleOrder.id },
      body: { reason: 'Please send photo of tap from side angle' },
      user: { id: userId, name: 'Lead Verifier' },
    };
    const mockRes = createMockRes();

    await orderController.requestNewImage(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    await singleOrder.reload();
    assert.strictEqual(singleOrder.status, 'image_verification');
    assert.strictEqual(singleOrder.image_rejection_reason, 'Please send photo of tap from side angle');

    const activity = await OrderActivity.findOne({
      where: { order_id: singleOrder.id, action: 'new_image_requested' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(activity, 'OrderActivity new_image_requested must be logged');
  });

  // 19. SKU match verification endpoint (POST /api/orders/:id/sku-match)
  await test('TC19: POST /api/orders/:id/sku-match manually marks SKU verified', async () => {
    const mockReq = {
      params: { id: singleOrder.id },
      body: { notes: 'SKU confirmed matching Model 1' },
      user: { id: userId, name: 'Lead Verifier' },
    };
    const mockRes = createMockRes();

    await orderController.skuMatch(mockReq, mockRes, (err) => {
      if (err) throw err;
    });

    await singleOrder.reload();
    assert.strictEqual(singleOrder.verification_status, 'sku_matched');
  });

  // 20. Data integrity cleanup & verification
  await test('TC20: Data relational integrity between Customer, Orders, and Images preserved', async () => {
    const imagesCount = await CustomerImage.count({ where: { customer_id: customer.id } });
    assert.ok(imagesCount >= 2, 'Customer should have multiple recorded images in audit history');

    const activitiesCount = await OrderActivity.count({ where: { order_id: singleOrder.id } });
    assert.ok(activitiesCount >= 3, 'Order should have full audit trail of image operations');
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL 20 CASES)`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
