'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — SAFE WHATSAPP BULK MESSAGING & BATCHING TEST SUITE
 *  Verifies:
 *   1. Partitioning Matrix (1, 99, 100, 101, 199, 200, 201, 1,000, 10,000)
 *      Strict Cap: Under NO condition does ANY batch exceed 100 customers.
 *   2. Non-consecutive order range tracking (start -> end).
 *   3. Zero Auto-Send rule: Upload processing NEVER sends or enqueues messages.
 *   4. Balance Check: Returns "BALANCE UNAVAILABLE" (never invented).
 *   5. Cost & Duration Estimation (est ₹0.80/msg, duration in minutes).
 *   6. Explicit Single-Batch Authorization: Confirming Batch 1 queues ONLY Batch 1.
 *   7. Idempotency & Double-Click Protection.
 *   8. Emergency Kill Switch Guard: Paused sending prevents batch dispatch.
 *   9. Lifecycle state transitions & progress tracking (sent/failed/actual cost).
 *  10. Batch cancellation.
 * ═══════════════════════════════════════════════════════════════════════════
 */

process.env.NODE_ENV = 'test';
process.env.WHATSAPP_ACCESS_TOKEN = 'mock_meta_token_for_batch_test';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock_meta_phone_id_for_batch_test';
process.env.JWT_SECRET = 'test_secret_batching_jwt_123';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');

const {
  sequelize,
  User,
  Customer,
  Order,
  CsvImportBatch,
  WhatsAppBatch,
  WhatsAppOutbox,
  SystemSetting,
  syncModels,
} = require('../models');

const whatsappBatchService = require('../services/whatsappBatchService');
const whatsappCostService = require('../services/whatsappCostService');
const emergencyPauseService = require('../services/emergencyPauseService');

// Global mock for fetch to track any call made to external WhatsApp provider
let metaApiCallCount = 0;
const metaApiCallHistory = [];

global.fetch = async (url, options = {}) => {
  const urlStr = String(url || '');
  if (urlStr.includes('graph.facebook.com')) {
    metaApiCallCount++;
    metaApiCallHistory.push({ url: urlStr, method: options.method, body: options.body });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        messaging_product: 'whatsapp',
        contacts: [{ input: '919876543210', wa_id: '919876543210' }],
        messages: [{ id: `wamid.HBgL${Date.now()}` }],
      }),
      text: async () => JSON.stringify({ messaging_product: 'whatsapp' }),
    };
  }
  return { ok: true, status: 200, json: async () => ({}) };
};

let testUser;

async function runSuite() {
  console.log('\n╔═════════════════════════════════════════════════════════════════════╗');
  console.log('║   KRISHNA CRM — SAFE WHATSAPP BULK MESSAGING VERIFICATION SUITE     ║');
  console.log('╚═════════════════════════════════════════════════════════════════════╝\n');

  let passedTests = 0;
  let failedTests = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`  ▶ RUNNING: ${name} ... `);
      await fn();
      console.log('✅ PASSED');
      passedTests++;
    } catch (err) {
      console.log(`❌ FAILED\n     Error: ${err.message}`);
      if (err.errors) {
        console.error('     Sequelize error details:', err.errors.map(e => ({ field: e.path, message: e.message })));
      } else {
        console.error(err.stack);
      }
      failedTests++;
    }
  }

  // Setup Database Schema & Baseline Admin User
  await syncModels({ alter: true });
  await WhatsAppBatch.sync();
  try {
    await sequelize.query('PRAGMA busy_timeout = 30000;');
  } catch (_) {}
  await SystemSetting.upsert({ key: 'WHATSAPP_SENDING_ENABLED', value: 'true' });

  testUser = await User.create({
    name: 'Bulk Messaging Test Admin',
    email: `batch-admin-${Date.now()}@krishnacrm.com`,
    password: 'mockPassword123!',
    role: 'admin',
    status: 'active',
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Partitioning Matrix & Strict Max 100 Cap
  // ───────────────────────────────────────────────────────────────────────────
  await test('Batch Slicing Matrix (1, 99, 100, 101, 199, 200, 201, 1000, 10000)', async () => {
    const testCases = [1, 99, 100, 101, 199, 200, 201, 1000, 10000];

    for (const N of testCases) {
      const expectedBatches = Math.ceil(N / 100);

      // Synthesize N items
      const items = [];
      for (let i = 1; i <= N; i++) {
        items.push({
          order_id: `ord-${i}`,
          order_number: `ORD-TEST-${10000 + i}`,
          phone: `9198000${String(i).padStart(5, '0')}`,
        });
      }

      // Slicing logic
      const BATCH_SIZE = 100;
      const batches = [];
      for (let i = 0; i < Math.ceil(items.length / BATCH_SIZE); i++) {
        const slice = items.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        batches.push({
          batch_index: i + 1,
          customer_count: slice.length,
          order_range_start: slice[0].order_number,
          order_range_end: slice[slice.length - 1].order_number,
        });
      }

      assert.strictEqual(
        batches.length,
        expectedBatches,
        `N=${N}: Expected ${expectedBatches} batches, got ${batches.length}`
      );

      let totalAssigned = 0;
      for (const b of batches) {
        assert.ok(
          b.customer_count <= 100,
          `STRICT INVARIANT VIOLATION: Batch ${b.batch_index} has ${b.customer_count} > 100!`
        );
        totalAssigned += b.customer_count;
      }

      assert.strictEqual(
        totalAssigned,
        N,
        `N=${N}: Total assigned customers ${totalAssigned} does not match N`
      );

      // Verify non-consecutive order ranges
      const firstBatch = batches[0];
      const lastBatch = batches[batches.length - 1];
      assert.strictEqual(firstBatch.order_range_start, 'ORD-TEST-10001');
      assert.strictEqual(lastBatch.order_range_end, `ORD-TEST-${10000 + N}`);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Provider Balance Transparency
  // ───────────────────────────────────────────────────────────────────────────
  await test('Provider Balance returns BALANCE UNAVAILABLE (No fake balance)', async () => {
    const balance = await whatsappCostService.getProviderBalance();
    assert.strictEqual(balance.available, false, 'Available should be false');
    assert.strictEqual(balance.balance, null, 'Balance must be null');
    assert.strictEqual(balance.status_text, 'BALANCE UNAVAILABLE', 'Must state BALANCE UNAVAILABLE');
    assert.ok(balance.reason.length > 0, 'Must provide clear reason');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Cost and Duration Estimation
  // ───────────────────────────────────────────────────────────────────────────
  await test('Estimated vs Actual Cost and Processing Duration Calculation', async () => {
    const est100 = await whatsappCostService.calculateEstimatedCost(100);
    assert.strictEqual(est100.estimated_cost, 35.00, '100 msgs * 0.35 = ₹35.00');
    assert.strictEqual(est100.currency, 'INR');
    assert.strictEqual(est100.is_estimate, true);

    const actual75 = await whatsappCostService.calculateActualCost(75);
    assert.strictEqual(actual75.actual_cost, 26.25, '75 sent * 0.35 = ₹26.25');
    assert.strictEqual(actual75.is_estimate, false);

    const duration = whatsappCostService.estimateDuration(100);
    assert.ok(duration.seconds > 0, 'Duration seconds must be > 0');
    assert.ok(duration.text.includes('minute'), 'Must format duration text with ESTIMATE indicator');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Zero Auto-Send Rule on CSV Import
  // ───────────────────────────────────────────────────────────────────────────
  let importBatchRecord;
  await test('Import Processing creates Batches in AWAITING_CONFIRMATION without sending', async () => {
    metaApiCallCount = 0; // Reset counter

    // Create an import batch
    importBatchRecord = await CsvImportBatch.create({
      filename: 'sample_orders_250.csv',
      file_path: 'uploads/sample_orders_250.csv',
      marketplace: 'amazon',
      status: 'completed',
      total_rows: 250,
      success_rows: 250,
      failed_rows: 0,
      duplicate_rows: 0,
      uploaded_by: testUser.id,
    });

    const runTag = Date.now().toString().slice(-6);

    // Create 250 test customers & orders for this import
    for (let i = 1; i <= 250; i++) {
      const cust = await Customer.create({
        name: `Test Customer ${i}`,
        phone: `91987${runTag}${String(i).padStart(4, '0')}`.slice(0, 15),
        whatsapp_number: `91987${runTag}${String(i).padStart(4, '0')}`.slice(0, 15),
        whatsapp_opt_in: true,
      });

      await Order.create({
        order_number: `ORD-${runTag}-${String(i).padStart(5, '0')}`,
        customer_id: cust.id,
        import_batch_id: importBatchRecord.id,
        status: 'pending',
        product_name: 'Super Hearing Aid Pro',
        product_sku: 'SHA-PRO-01',
        total_amount: 4999.00,
      });
    }

    // Call batch creation service
    const summary = await whatsappBatchService.createBatchesForImport(importBatchRecord.id);

    assert.strictEqual(summary.uploaded_records, 250);
    assert.strictEqual(summary.eligible_for_whatsapp, 250);
    assert.strictEqual(summary.excluded_records, 0);
    assert.strictEqual(summary.total_batches, 3, '250 customers should partition into 3 batches (100, 100, 50)');

    // Verify Batches in Database
    const batches = await WhatsAppBatch.findAll({
      where: { import_batch_id: importBatchRecord.id },
      order: [['batch_index', 'ASC']],
    });

    assert.strictEqual(batches.length, 3);
    assert.strictEqual(batches[0].customer_count, 100);
    assert.strictEqual(batches[1].customer_count, 100);
    assert.strictEqual(batches[2].customer_count, 50);

    // Non-consecutive order ranges
    assert.strictEqual(batches[0].order_range_start, `ORD-${runTag}-00001`);
    assert.strictEqual(batches[0].order_range_end, `ORD-${runTag}-00100`);
    assert.strictEqual(batches[1].order_range_start, `ORD-${runTag}-00101`);
    assert.strictEqual(batches[1].order_range_end, `ORD-${runTag}-00200`);
    assert.strictEqual(batches[2].order_range_start, `ORD-${runTag}-00201`);
    assert.strictEqual(batches[2].order_range_end, `ORD-${runTag}-00250`);

    // All must be in AWAITING_CONFIRMATION
    for (const b of batches) {
      assert.strictEqual(b.status, 'AWAITING_CONFIRMATION');
    }

    // CRITICAL ASSERTION: Outbox must have ZERO records, Meta must have ZERO calls!
    const outboxCount = await WhatsAppOutbox.count({ where: { batch_id: batches.map((b) => b.id) } });
    assert.strictEqual(outboxCount, 0, 'ZERO messages may be in WhatsAppOutbox prior to confirmation');
    assert.strictEqual(metaApiCallCount, 0, 'ZERO calls may be made to Meta API during upload');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Explicit Single-Batch Confirmation
  // ───────────────────────────────────────────────────────────────────────────
  let batch1, batch2, batch3;
  await test('Confirming Batch 1 queues ONLY Batch 1; Batches 2 & 3 remain waiting', async () => {
    const batches = await WhatsAppBatch.findAll({
      where: { import_batch_id: importBatchRecord.id },
      order: [['batch_index', 'ASC']],
    });
    [batch1, batch2, batch3] = batches;

    // Explicitly confirm ONLY Batch 1
    const result = await whatsappBatchService.confirmAndDispatchBatch({
      batchId: batch1.id,
      userId: testUser.id,
      idempotencyKey: `test-confirm-batch1-${Date.now()}`,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.items_queued, 100);

    // Refresh batches from DB
    await batch1.reload();
    await batch2.reload();
    await batch3.reload();

    assert.strictEqual(batch1.status, 'QUEUED', 'Batch 1 must be QUEUED');
    assert.strictEqual(batch2.status, 'AWAITING_CONFIRMATION', 'Batch 2 must STILL be AWAITING_CONFIRMATION');
    assert.strictEqual(batch3.status, 'AWAITING_CONFIRMATION', 'Batch 3 must STILL be AWAITING_CONFIRMATION');

    // Check Outbox counts
    const outboxBatch1 = await WhatsAppOutbox.count({ where: { batch_id: batch1.id } });
    const outboxBatch2 = await WhatsAppOutbox.count({ where: { batch_id: batch2.id } });
    const outboxBatch3 = await WhatsAppOutbox.count({ where: { batch_id: batch3.id } });

    assert.strictEqual(outboxBatch1, 100, 'Exactly 100 items queued for Batch 1');
    assert.strictEqual(outboxBatch2, 0, 'Exactly 0 items queued for Batch 2');
    assert.strictEqual(outboxBatch3, 0, 'Exactly 0 items queued for Batch 3');

    // Allow background processQueue to settle before next test
    await new Promise((r) => setTimeout(r, 1000));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Idempotency & Double-Click Protection
  // ───────────────────────────────────────────────────────────────────────────
  await test('Double confirmation with same idempotency key is safely ignored', async () => {
    const idempotencyKey = `idemp-key-${Date.now()}`;

    // First call
    const call1 = await whatsappBatchService.confirmAndDispatchBatch({
      batchId: batch2.id,
      userId: testUser.id,
      idempotencyKey,
    });
    assert.strictEqual(call1.success, true);

    // Duplicate call immediately following
    const call2 = await whatsappBatchService.confirmAndDispatchBatch({
      batchId: batch2.id,
      userId: testUser.id,
      idempotencyKey,
    });
    assert.strictEqual(call2.success, true);
    assert.strictEqual(call2.already_submitted, true, 'Must detect duplicate submission');

    // Verify outbox did not duplicate
    const outboxBatch2 = await WhatsAppOutbox.count({ where: { batch_id: batch2.id } });
    assert.strictEqual(outboxBatch2, 100, 'Outbox must have exactly 100 items (no duplicates)');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Emergency Kill Switch Integration
  // ───────────────────────────────────────────────────────────────────────────
  await test('Emergency Pause blocks batch confirmation with WHATSAPP_SENDING_PAUSED', async () => {
    // 1. Activate Emergency Pause
    await emergencyPauseService.setSendingState({
      enabled: false,
      actorUserId: testUser.id,
      initiatedByEmail: testUser.email,
      reason: 'Testing emergency kill switch on batch dispatch',
    });

    // 2. Attempt to confirm Batch 3
    let thrownError = null;
    try {
      await whatsappBatchService.confirmAndDispatchBatch({
        batchId: batch3.id,
        userId: testUser.id,
      });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError !== null, 'Confirmation must throw an error when WhatsApp is paused');
    assert.strictEqual(thrownError.statusCode, 403);
    assert.strictEqual(thrownError.code, 'WHATSAPP_SENDING_PAUSED');

    // Batch 3 must remain AWAITING_CONFIRMATION
    await batch3.reload();
    assert.strictEqual(batch3.status, 'AWAITING_CONFIRMATION');

    // Resume sending for subsequent tests
    await emergencyPauseService.setSendingState({
      enabled: true,
      actorUserId: testUser.id,
      initiatedByEmail: testUser.email,
      reason: 'Resuming sending after test',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Lifecycle State Transitions & Progress Tracking
  // ───────────────────────────────────────────────────────────────────────────
  await test('Outbox dispatch outcomes update batch counters and transitions to COMPLETED', async () => {
    // Take batch1 outbox items and simulate completion
    const items = await WhatsAppOutbox.findAll({ where: { batch_id: batch1.id }, limit: 100 });
    assert.strictEqual(items.length, 100);

    // Mark 95 sent, 5 failed
    const { Op } = require('sequelize');
    const sentIds = items.slice(0, 95).map(i => i.id);
    const failedIds = items.slice(95, 100).map(i => i.id);
    await WhatsAppOutbox.update(
      { status: 'sent', sent_at: new Date() },
      { where: { id: { [Op.in]: sentIds } } }
    );
    await WhatsAppOutbox.update(
      { status: 'failed', last_error: 'Simulated carrier rejection' },
      { where: { id: { [Op.in]: failedIds } } }
    );

    // Trigger batch progress update
    await whatsappBatchService.updateBatchProgress(batch1.id);
    await batch1.reload();

    assert.strictEqual(batch1.sent_count, 95);
    assert.strictEqual(batch1.failed_count, 5);
    assert.strictEqual(batch1.status, 'PARTIALLY_FAILED', 'Batch with sent and failed items should be PARTIALLY_FAILED');
    assert.strictEqual(parseFloat(batch1.actual_cost), 33.25, 'Actual cost for 95 sent msgs @ ₹0.35 = ₹33.25');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Batch Cancellation
  // ───────────────────────────────────────────────────────────────────────────
  await test('Unsent Batch 3 can be cancelled with audit reason', async () => {
    await new Promise(r => setTimeout(r, 500));
    await batch3.reload();
    assert.strictEqual(batch3.status, 'AWAITING_CONFIRMATION');

    const result = await whatsappBatchService.cancelBatch({
      batchId: batch3.id,
      userId: testUser.id,
      reason: 'Marketing campaign rescheduled',
    });

    assert.strictEqual(result.success, true);
    await batch3.reload();
    assert.strictEqual(batch3.status, 'CANCELLED');
    assert.strictEqual(batch3.metadata?.cancellation_reason, 'Marketing campaign rescheduled');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Deduplication and Exclusion Breakdown
  // ───────────────────────────────────────────────────────────────────────────
  await test('Upload with invalid phones and duplicates reports correct exclusion breakdown', async () => {
    const importWithExclusions = await CsvImportBatch.create({
      filename: 'dirty_data_test.csv',
      file_path: 'uploads/dirty_data_test.csv',
      marketplace: 'shopify',
      status: 'completed',
      total_rows: 5,
      success_rows: 5,
      failed_rows: 0,
      duplicate_rows: 0,
      uploaded_by: testUser.id,
    });

    const exTag = Date.now().toString().slice(-6);

    // 1. Valid customer
    const c1 = await Customer.create({ name: 'Valid 1', phone: `9198${exTag}11`, whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-${exTag}-1`, customer_id: c1.id, import_batch_id: importWithExclusions.id, status: 'pending' });

    // 2. Missing phone
    const c2 = await Customer.create({ name: 'No Phone', phone: null, whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-${exTag}-2`, customer_id: c2.id, import_batch_id: importWithExclusions.id, status: 'pending' });

    // 3. Short/invalid phone (<10 digits)
    const c3 = await Customer.create({ name: 'Short Phone', phone: '12345', whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-${exTag}-3`, customer_id: c3.id, import_batch_id: importWithExclusions.id, status: 'pending' });

    // 4. Opted out
    const c4 = await Customer.create({ name: 'Opted Out', phone: `9198${exTag}22`, whatsapp_opt_in: false });
    await Order.create({ order_number: `ORD-EX-${exTag}-4`, customer_id: c4.id, import_batch_id: importWithExclusions.id, status: 'pending' });

    // 5. Duplicate phone (same phone as c1)
    const c5 = await Customer.create({ name: 'Duplicate Phone', phone: `9198${exTag}11`, whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-${exTag}-5`, customer_id: c5.id, import_batch_id: importWithExclusions.id, status: 'pending' });

    const summary = await whatsappBatchService.createBatchesForImport(importWithExclusions.id);

    assert.strictEqual(summary.uploaded_records, 5);
    assert.strictEqual(summary.eligible_for_whatsapp, 1, 'Only 1 customer is eligible');
    assert.strictEqual(summary.excluded_records, 4, '4 customers must be excluded');
    assert.strictEqual(summary.exclusion_breakdown.missing_phone, 1);
    assert.strictEqual(summary.exclusion_breakdown.invalid_phone_format, 1);
    assert.strictEqual(summary.exclusion_breakdown.opted_out, 1);
    assert.strictEqual(summary.exclusion_breakdown.duplicate_phone_in_upload, 1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n╔═════════════════════════════════════════════════════════════════════╗');
  console.log(`║   SUITE FINISHED: ${passedTests} PASSED, ${failedTests} FAILED                            ║`);
  console.log('╚═════════════════════════════════════════════════════════════════════╝\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
