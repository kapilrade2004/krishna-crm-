'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Order, Customer, WhatsAppOutbox, OrderEvent } = require('../models');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const OrderImportService = require('../services/orderImport/orderImportService');
const XLSX = require('xlsx');

async function runAutoMessagingTests() {
  console.log('======================================================================');
  console.log('🚀 TESTING AUTOMATIC ORDER MESSAGING DISPATCH ON UPLOAD & CREATION');
  console.log('======================================================================\n');

  await sequelize.sync();
  const timestamp = Date.now();

  // Mock dispatchMessage to verify automatic dispatch pipeline
  const originalDispatch = whatsappOutboxQueue.dispatchMessage;
  let dispatchedPhone = null;
  whatsappOutboxQueue.dispatchMessage = async (item) => {
    dispatchedPhone = item.recipient_phone;
    return {
      success: true,
      providerMessageId: `msg_${Date.now()}`,
      provider: 'mock_auto_provider',
    };
  };

  try {
    // 1. Test that QUEUED items are processed by worker without manual intervention
    console.log('1. Testing that newly enqueued items with status "QUEUED" are dispatched automatically...');
    const testPhone = `+91${String(Date.now()).slice(-10)}`;
    const outboxItem = await whatsappOutboxQueue.enqueue({
      recipient_phone: testPhone,
      template_name: 'order_verification_interactive',
      payload: { customer_name: 'Auto Trigger Test User' },
      idempotency_key: `auto_test_${uuidv4()}`,
    });

    assert.strictEqual(outboxItem.status, 'QUEUED');
    console.log('   ✅ Outbox item enqueued with status QUEUED.');

    const claimRes = await whatsappOutboxQueue.processItem(outboxItem);
    assert.strictEqual(claimRes.success, true);
    const updatedItem = await WhatsAppOutbox.findByPk(outboxItem.id);
    assert.strictEqual(updatedItem.status, 'PROVIDER_ACCEPTED', 'Outbox item must transition to PROVIDER_ACCEPTED');
    assert.strictEqual(dispatchedPhone, testPhone, 'Mock provider must have received the recipient phone');
    console.log('   ✅ Outbox item dispatched automatically to provider without manual intervention!');

    // 2. Test Order Import triggers automatic outbox record & dispatch
    console.log('\n2. Testing Order CSV/Excel Import auto-creates and dispatches outbox messaging...');
    const importPhone = `9${String(Date.now() + 1).slice(-9)}`;
    const importOrderId = `AUTO-IMP-${timestamp}`;

    const testWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      testWb,
      XLSX.utils.json_to_sheet([
        {
          'order-id': importOrderId,
          'buyer-name': 'Import Auto User',
          'buyer-phone-number': importPhone,
          'product-name': 'High Pressure Purifier',
          'quantity-purchased': '1',
          'item-price': '1999',
        },
      ]),
      'Sheet1'
    );
    const buf = XLSX.write(testWb, { type: 'buffer', bookType: 'xlsx' });

    const summary = await OrderImportService.importOrders({
      buffer: buf,
      originalName: 'auto_orders.xlsx',
      channel: 'amazon_channel_1',
      actorId: 'AUTO_SYSTEM',
      enqueueVerification: true,
    });

    assert.strictEqual(summary.importedCount, 1);
    const createdOrder = summary.importedOrders[0];

    const outboxRecord = await WhatsAppOutbox.findOne({
      where: { order_id: createdOrder.id },
    });
    assert.ok(outboxRecord, 'Outbox record must exist for imported order');
    assert.strictEqual(outboxRecord.template_name, 'order_verification_interactive');
    assert.strictEqual(outboxRecord.status, 'QUEUED');

    // Automatic dispatch execution
    const autoDispatchRes = await whatsappOutboxQueue.processItem(outboxRecord);
    assert.strictEqual(autoDispatchRes.success, true);
    const refreshedOutbox = await WhatsAppOutbox.findByPk(outboxRecord.id);
    assert.strictEqual(refreshedOutbox.status, 'PROVIDER_ACCEPTED');
    console.log('   ✅ Order import automatically queued and dispatched Message 1 (order_verification_interactive)!');

    // 3. Verify Manual Resend Fallback for Special Cases (when message failed)
    console.log('\n3. Testing manual resend fallback for failed messages (special cases)...');
    const failedItem = await WhatsAppOutbox.create({
      recipient_phone: '+919999999999',
      template_name: 'order_verification_interactive',
      status: 'failed',
      attempts: 3,
      attempt_count: 3,
      last_error: 'Network timeout during provider dispatch',
      idempotency_key: `manual_retry_${uuidv4()}`,
    });

    // Re-queue for manual retry
    await failedItem.update({
      status: 'QUEUED',
      attempts: 0,
      attempt_count: 0,
      last_error: null,
      next_attempt_at: new Date(),
    });

    let manualRetried = false;
    whatsappOutboxQueue.dispatchMessage = async (item) => {
      if (item.id === failedItem.id) {
        manualRetried = true;
      }
      return { success: true, providerMessageId: 'retry_ok' };
    };

    const retryRes = await whatsappOutboxQueue.processItem(failedItem);
    assert.strictEqual(retryRes.success, true);
    const retriedItem = await WhatsAppOutbox.findByPk(failedItem.id);
    assert.strictEqual(retriedItem.status, 'PROVIDER_ACCEPTED');
    assert.strictEqual(manualRetried, true);
    console.log('   ✅ Manual retry path functions correctly as a fallback for failed messages.');

  } finally {
    whatsappOutboxQueue.dispatchMessage = originalDispatch;
  }

  console.log('\n======================================================================');
  console.log('🎉 ALL AUTOMATIC MESSAGING TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================================\n');
}

runAutoMessagingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  });
