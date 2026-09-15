'use strict';

const path = require('path');
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'mysql';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';

const assert = require('assert');
const { sequelize, Order, Customer, WhatsAppLog, WhatsAppOutbox, CustomerImage, OrderActivity } = require('../models');
const whatsappReconciliationWorker = require('../services/whatsappReconciliationWorker');

async function runReconciliationTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING WHATSAPP RECONCILIATION WORKER TEST SUITE (SECTION 77)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;

  try {
    await sequelize.sync();

    const timestamp = Date.now();
    const cust = await Customer.create({
      name: 'Reconciliation Test Customer',
      whatsapp_number: `919899${String(timestamp).slice(-6)}`,
      whatsapp_opt_in: true,
    });

    // 1. Create order awaiting screenshot with image present (State Mismatch)
    const ordMismatch = await Order.create({
      order_number: `ORD-REC-MISMATCH-${timestamp}`,
      customer_id: cust.id,
      product_name: 'AquaBeat Purifier',
      status: 'pending',
      verification_status: 'screenshot_requested',
      flow_stage: 'ask_images',
    });

    await CustomerImage.create({
      order_id: ordMismatch.id,
      customer_id: cust.id,
      s3_url: 'https://krishna-crm.s3.amazonaws.com/test-img.jpg',
      verification_status: 'unassigned',
    });

    // 2. Create CANCELLED order with QUEUED outbox message
    const ordCancelled = await Order.create({
      order_number: `ORD-REC-CANCELLED-${timestamp}`,
      customer_id: cust.id,
      product_name: 'AquaBeat Purifier',
      status: 'cancelled',
      verification_status: 'cancelled',
      flow_stage: 'match_cancelled',
    });

    const outQueued = await WhatsAppOutbox.create({
      order_id: ordCancelled.id,
      customer_id: cust.id,
      recipient_phone: cust.whatsapp_number,
      template_name: 'order_confirmation013',
      status: 'QUEUED',
    });

    console.log('--- Step 1: Run Reconciliation Scan ---');
    const scanResult = await whatsappReconciliationWorker.runReconciliationScan();
    assert.ok(scanResult, 'Scan result returned');
    assert.ok(scanResult.anomalies_count >= 2, 'At least 2 anomalies detected and flagged');

    // 3. Verify auto-repair on SCREENSHOT_STATE_MISMATCH
    const reloadedMismatch = await Order.findByPk(ordMismatch.id);
    assert.strictEqual(reloadedMismatch.verification_status, 'image_received', 'Verification status auto-repaired to image_received');
    assert.strictEqual(reloadedMismatch.flow_stage, 'match_pending', 'Flow stage auto-repaired to match_pending');
    passed++;
    console.log('  ✅ [PASS] Screenshot state mismatch auto-repaired to image_received');

    // 4. Verify auto-repair on QUEUED_MSG_ON_CANCELLED_ORDER
    const reloadedOut = await WhatsAppOutbox.findByPk(outQueued.id);
    assert.strictEqual(reloadedOut.status, 'CANCELLED', 'Queued outbox message auto-cancelled');
    passed++;
    console.log('  ✅ [PASS] Queued message on cancelled order auto-cancelled');

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log(`🎉 RECONCILIATION TEST SUITE PASSED: ${passed} PASSED, 0 FAILED`);
    console.log('═══════════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Reconciliation Test Suite Failed:', err);
    process.exit(1);
  }
}

runReconciliationTests();
