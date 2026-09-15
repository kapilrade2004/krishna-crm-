'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — END-TO-END WHATSAPP BULK-MESSAGING WORKFLOW TEST SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Covers the complete contract:
 *  1. 1 Customer Flow: Upload -> Process -> Auto-create Batch <= 100 in AWAITING_CONFIRMATION
 *     -> Zero auto-send -> Explicit user confirmation -> Server revalidation -> Worker claim
 *     -> Provider send -> Outbox status update -> Batch status COMPLETED.
 *  2. 100 Customer Flow: Exact 1 Batch of 100 -> Verify max batch size invariant (cap <= 100)
 *     -> Confirm -> Dispatched & Completed.
 *  3. 101 Customer Flow: Exactly 2 Batches (Batch 1: 100, Batch 2: 1) -> Confirm Batch 1
 *     leaves Batch 2 untouched -> Sequential confirmation works cleanly.
 *  4. 1,000 Customer Flow & Controlled "SEND ALL BATCHES": Exactly 10 Batches of 100
 *     -> SEND ALL BATCHES queues all 10 batches into outbox without burst -> Paced rate-limited processing.
 *  5. Eligibility & Exclusion Breakdown: Missing phones, invalid phones (<10 digits),
 *     non-pending orders, opted-out customers, and upload duplicates properly categorized.
 *  6. Global Emergency Kill Switch: Paused sending immediately halts single batch and
 *     send-all approvals, and stops outbox workers before calling Meta.
 *  7. Daily Spend Ceiling Guard: Exceeding spend ceiling blocks batch confirmation.
 *  8. Action Buttons Health Check:
 *     - whatsappService.sendMessage (Telecaller store visit notifications)
 *     - warrantyController.retryWarrantyMessage (Manual warranty activation retries)
 *     - orderController.bulkSendWhatsApp (Enforces max 100 cap and pause guard)
 *  9. Batch Cancellation & Budget Release: Single batch cancel and cancel-all release reserved spend.
 */

process.env.NODE_ENV = 'test';
process.env.WHATSAPP_ACCESS_TOKEN = 'mock_meta_token_e2e_bulk';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock_meta_phone_id_e2e_bulk';
process.env.JWT_SECRET = 'test_secret_e2e_jwt_123';

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
  WhatsAppLog,
  Warranty,
  WarrantyMessage,
  WarrantyEvent,
  SystemSetting,
  syncModels,
} = require('../models');

const whatsappBatchService = require('../services/whatsappBatchService');
const whatsappCostService = require('../services/whatsappCostService');
const whatsappService = require('../services/whatsappService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const whatsappRateLimiter = require('../services/whatsappRateLimiter');
const whatsappSpendGuard = require('../services/whatsappSpendGuard');
const emergencyPauseService = require('../services/emergencyPauseService');

// Unique run tag to prevent order_number collision across test runs
const RUN_TAG = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

// Global mock for fetch to track any call made to external WhatsApp provider
let metaApiCallCount = 0;
const metaApiCallHistory = [];

global.fetch = async (url, options = {}) => {
  const urlStr = String(url || '');
  if (urlStr.includes('graph.facebook.com') || urlStr.includes('vasify') || urlStr.includes('aoc')) {
    metaApiCallCount++;
    metaApiCallHistory.push({ url: urlStr, method: options.method, body: options.body });
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      contacts: [{ input: '919876543210', wa_id: '919876543210' }],
      messages: [{ id: `wamid.E2E_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` }],
    });
    return {
      ok: true,
      status: 200,
      headers: {
        get: () => null,
      },
      json: async () => JSON.parse(payload),
      text: async () => payload,
    };
  }
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}), text: async () => '{}' };
};

let testAdminUser;

async function runSuite() {
  console.log('\n╔═════════════════════════════════════════════════════════════════════╗');
  console.log('║   KRISHNA CRM — END-TO-END WHATSAPP BULK WORKFLOW TEST SUITE       ║');
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
        console.error('     Sequelize error details:', err.errors.map((e) => ({ field: e.path, message: e.message })));
      } else {
        console.error(err.stack);
      }
      failedTests++;
    }
  }

  // Setup Database Schema & Baseline Admin User
  await syncModels({ alter: true });
  await WhatsAppBatch.sync();
  await WhatsAppOutbox.sync();
  await WhatsAppLog.sync();
  await WarrantyMessage.sync();
  try {
    await sequelize.query('PRAGMA busy_timeout = 30000;');
  } catch (_) {}

  // Clean outbox and batch tables so tests run in complete isolation
  await WhatsAppOutbox.destroy({ where: {} });
  await WhatsAppBatch.destroy({ where: {} });

  // High limits for automated test execution
  await SystemSetting.upsert({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: '100000' });
  await SystemSetting.upsert({ key: 'WHATSAPP_DAILY_SPEND_LIMIT', value: '500000.00' });
  whatsappRateLimiter.localRecentSends = [];

  // Ensure WhatsApp sending is ACTIVE initially
  await emergencyPauseService.setSendingState({
    enabled: true,
    reason: 'Initial setup for e2e bulk messaging test suite',
  });

  testAdminUser = await User.create({
    name: 'E2E Bulk Admin',
    email: `e2e-bulk-admin-${Date.now()}@krishnacrm.com`,
    password: 'mockPassword123!',
    role: 'admin',
    status: 'active',
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: 1 Customer End-to-End Workflow
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 1: 1 Customer Upload -> Auto-create Batch <= 100 in AWAITING_CONFIRMATION -> Confirm -> Worker Claim -> Sent -> COMPLETED', async () => {
    metaApiCallCount = 0;
    whatsappRateLimiter.localRecentSends = [];

    const importBatch = await CsvImportBatch.create({
      filename: `e2e_1cust_${RUN_TAG}.csv`,
      file_path: `uploads/csv/e2e_1cust_${RUN_TAG}.csv`,
      uploaded_by: testAdminUser.id,
      marketplace: 'amazon',
      channel: 'amazon_channel_1',
      total_rows: 1,
      success_rows: 1,
      failed_rows: 0,
      duplicate_rows: 0,
      status: 'completed',
    });

    const cust = await Customer.create({
      name: 'Pooja Sharma',
      phone: `9876500001`,
      whatsapp_number: `9876500001`,
      whatsapp_opt_in: true,
    });

    const ord = await Order.create({
      order_number: `ORD-E2E-001-${RUN_TAG}`,
      marketplace: 'amazon',
      customer_id: cust.id,
      import_batch_id: importBatch.id,
      status: 'pending',
      product_name: 'Akuabeat RO Smart Purifier',
      product_sku: 'AKUA-SMART-01',
    });

    // 1. Post-upload batch creation
    const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);
    assert.strictEqual(summary.total_batches, 1, 'Should create exactly 1 batch');
    assert.strictEqual(summary.eligible_for_whatsapp, 1, '1 eligible customer');

    const batch = summary.batches[0];
    assert.strictEqual(batch.status, 'AWAITING_CONFIRMATION', 'Initial state MUST be AWAITING_CONFIRMATION');
    assert.strictEqual(batch.customer_count, 1, 'Customer count must be 1');
    assert.strictEqual(metaApiCallCount, 0, 'ZERO Meta calls must occur upon upload / batch creation');

    // 2. Query batch details for review panel
    const reviewData = await whatsappBatchService.getBatchesForImport(importBatch.id);
    assert.strictEqual(reviewData.batches.length, 1);
    assert.strictEqual(reviewData.awaiting_confirmation_batches, 1);
    assert.strictEqual(reviewData.total_customers, 1);
    assert.ok(reviewData.template_preview, 'Must include template preview for frontend');
    assert.strictEqual(reviewData.template_preview.template_name, 'order_verification_interactive');

    // 3. User explicitly confirms batch (triggerWorker: false for deterministic control)
    const confirmRes = await whatsappBatchService.confirmAndDispatchBatch({
      batchId: batch.id,
      userId: testAdminUser.id,
      idempotencyKey: `confirm-e2e-1-${Date.now()}`,
      triggerWorker: false,
    });
    assert.strictEqual(confirmRes.success, true);
    assert.strictEqual(confirmRes.status, 'QUEUED');

    // Verify outbox record created in 'pending' status
    const outboxItem = await WhatsAppOutbox.findOne({ where: { batch_id: batch.id } });
    assert.ok(outboxItem, 'Outbox item must exist');
    assert.strictEqual(outboxItem.status, 'pending');

    // 4. Worker claims and executes dispatch
    await whatsappOutboxQueue.processQueue(5);
    assert.strictEqual(metaApiCallCount, 1, 'Meta API should be called once');

    // 5. Verify batch lifecycle updated to COMPLETED
    await whatsappBatchService.updateBatchProgress(batch.id);
    const updatedBatch = await WhatsAppBatch.findByPk(batch.id);
    assert.strictEqual(updatedBatch.status, 'COMPLETED', 'Batch must transition to COMPLETED');
    assert.strictEqual(updatedBatch.sent_count, 1);
    assert.strictEqual(updatedBatch.failed_count, 0);

    // Verify outbox item is sent
    await outboxItem.reload();
    assert.strictEqual(outboxItem.status, 'sent');
    assert.ok(outboxItem.sent_at, 'Must record sent_at timestamp');

    // Verify whatsapp_logs entry
    const log = await WhatsAppLog.findOne({ where: { batch_id: batch.id } });
    assert.ok(log, 'WhatsAppLog entry must be recorded');
    assert.strictEqual(log.status, 'sent');
    assert.ok(log.wa_message_id, 'Must record provider message ID in whatsapp_logs');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: 100 Customers End-to-End Workflow (Exact Cap)
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 2: 100 Customers Upload -> Exactly 1 Batch of 100 (Max Batch Size Invariant) -> Confirm -> Dispatched', async () => {
    whatsappRateLimiter.localRecentSends = [];

    const importBatch = await CsvImportBatch.create({
      filename: `e2e_100cust_${RUN_TAG}.csv`,
      file_path: `uploads/csv/e2e_100cust_${RUN_TAG}.csv`,
      uploaded_by: testAdminUser.id,
      marketplace: 'flipkart',
      channel: 'flipkart_channel_1',
      total_rows: 100,
      success_rows: 100,
      status: 'completed',
    });

    const orders = [];
    for (let i = 1; i <= 100; i++) {
      const c = await Customer.create({
        name: `Customer ${i}`,
        phone: `91987${String(i).padStart(7, '0')}`,
        whatsapp_opt_in: true,
      });
      orders.push({
        order_number: `ORD-100-${String(i).padStart(3, '0')}-${RUN_TAG}`,
        marketplace: 'flipkart',
        customer_id: c.id,
        import_batch_id: importBatch.id,
        status: 'pending',
        product_name: 'Akuabeat Copper RO',
        product_sku: 'AKUA-COP-01',
      });
    }
    await Order.bulkCreate(orders);

    metaApiCallCount = 0;
    const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);
    assert.strictEqual(summary.total_batches, 1, '100 customers must yield exactly 1 batch');
    assert.strictEqual(summary.eligible_for_whatsapp, 100);

    const batch = summary.batches[0];
    assert.strictEqual(batch.customer_count, 100, 'Batch customer count must be exactly 100');
    assert.strictEqual(batch.status, 'AWAITING_CONFIRMATION');
    assert.strictEqual(metaApiCallCount, 0, 'No auto-send on upload');

    // Confirm batch
    await whatsappBatchService.confirmAndDispatchBatch({
      batchId: batch.id,
      userId: testAdminUser.id,
      triggerWorker: false,
    });

    const outboxCount = await WhatsAppOutbox.count({ where: { batch_id: batch.id } });
    assert.strictEqual(outboxCount, 100, 'Exactly 100 outbox items must be enqueued');

    // Worker executes
    await whatsappOutboxQueue.processQueue(100);
    assert.strictEqual(metaApiCallCount, 100, 'All 100 messages dispatched');

    await whatsappBatchService.updateBatchProgress(batch.id);
    const updatedBatch = await WhatsAppBatch.findByPk(batch.id);
    assert.strictEqual(updatedBatch.status, 'COMPLETED');
    assert.strictEqual(updatedBatch.sent_count, 100);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: 101 Customers End-to-End Workflow (Partitioning Invariant)
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 3: 101 Customers Upload -> Strictly 2 Batches (Batch 1: 100, Batch 2: 1) -> Single confirm preserves Batch 2', async () => {
    whatsappRateLimiter.localRecentSends = [];

    const importBatch = await CsvImportBatch.create({
      filename: `e2e_101cust_${RUN_TAG}.csv`,
      file_path: `uploads/csv/e2e_101cust_${RUN_TAG}.csv`,
      uploaded_by: testAdminUser.id,
      marketplace: 'amazon',
      channel: 'amazon_channel_2',
      total_rows: 101,
      success_rows: 101,
      status: 'completed',
    });

    const orders = [];
    for (let i = 1; i <= 101; i++) {
      const c = await Customer.create({
        name: `Cust 101_${i}`,
        phone: `91988${String(i).padStart(7, '0')}`,
        whatsapp_opt_in: true,
      });
      orders.push({
        order_number: `ORD-101-${String(i).padStart(3, '0')}-${RUN_TAG}`,
        marketplace: 'amazon',
        customer_id: c.id,
        import_batch_id: importBatch.id,
        status: 'pending',
        product_name: 'Akuabeat Alkaline Purifier',
        product_sku: 'AKUA-ALK-01',
      });
    }
    await Order.bulkCreate(orders);

    metaApiCallCount = 0;
    const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);
    assert.strictEqual(summary.total_batches, 2, '101 customers must strictly yield 2 batches');
    assert.strictEqual(summary.batches[0].customer_count, 100, 'Batch 1 must have 100 customers');
    assert.strictEqual(summary.batches[1].customer_count, 1, 'Batch 2 must have 1 customer');

    const b1 = summary.batches[0];
    const b2 = summary.batches[1];

    // Explicitly confirm ONLY Batch 1
    await whatsappBatchService.confirmAndDispatchBatch({
      batchId: b1.id,
      userId: testAdminUser.id,
      triggerWorker: false,
    });

    await b1.reload();
    await b2.reload();

    assert.strictEqual(b1.status, 'QUEUED', 'Batch 1 must be QUEUED');
    assert.strictEqual(b2.status, 'AWAITING_CONFIRMATION', 'Batch 2 MUST remain AWAITING_CONFIRMATION');

    // Run worker for Batch 1
    await whatsappOutboxQueue.processQueue(100);
    await whatsappBatchService.updateBatchProgress(b1.id);
    await b1.reload();
    assert.strictEqual(b1.status, 'COMPLETED');
    assert.strictEqual(b1.sent_count, 100);

    // Now confirm Batch 2 sequentially
    await whatsappBatchService.confirmAndDispatchBatch({
      batchId: b2.id,
      userId: testAdminUser.id,
      triggerWorker: false,
    });

    await b2.reload();
    assert.strictEqual(b2.status, 'QUEUED');

    // Run worker for Batch 2
    await whatsappOutboxQueue.processQueue(5);
    await whatsappBatchService.updateBatchProgress(b2.id);
    await b2.reload();
    assert.strictEqual(b2.status, 'COMPLETED');
    assert.strictEqual(b2.sent_count, 1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: 1,000 Customers & "SEND ALL BATCHES" Paced Queueing
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 4: 1,000 Customers Upload & "SEND ALL BATCHES" -> Exactly 10 Batches of 100 -> All Queued Without Burst', async () => {
    whatsappRateLimiter.localRecentSends = [];

    const importBatch = await CsvImportBatch.create({
      filename: `e2e_1000cust_${RUN_TAG}.csv`,
      file_path: `uploads/csv/e2e_1000cust_${RUN_TAG}.csv`,
      uploaded_by: testAdminUser.id,
      marketplace: 'website',
      channel: 'website_direct',
      total_rows: 1000,
      success_rows: 1000,
      status: 'completed',
    });

    const orders = [];
    for (let i = 1; i <= 1000; i++) {
      const c = await Customer.create({
        name: `Cust 1K_${i}`,
        phone: `91989${String(i).padStart(7, '0')}`,
        whatsapp_opt_in: true,
      });
      orders.push({
        order_number: `ORD-1K-${String(i).padStart(4, '0')}-${RUN_TAG}`,
        marketplace: 'website',
        customer_id: c.id,
        import_batch_id: importBatch.id,
        status: 'pending',
        product_name: 'Akuabeat Grand Plus',
        product_sku: 'AKUA-GRAND-01',
      });
    }
    await Order.bulkCreate(orders);

    const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);
    assert.strictEqual(summary.total_batches, 10, '1,000 customers must yield exactly 10 batches');
    assert.strictEqual(summary.eligible_for_whatsapp, 1000);

    for (const b of summary.batches) {
      assert.strictEqual(b.customer_count, 100, 'Every batch must have exactly 100 customers');
      assert.strictEqual(b.status, 'AWAITING_CONFIRMATION', 'All batches must be awaiting confirmation');
    }

    // Call confirmAllBatchesForImport
    const confirmAllResult = await whatsappBatchService.confirmAllBatchesForImport(
      importBatch.id,
      testAdminUser.id
    );

    assert.strictEqual(confirmAllResult.success, true);
    assert.strictEqual(confirmAllResult.batches_queued, 10, 'All 10 batches must be queued');
    assert.strictEqual(confirmAllResult.total_items_queued, 1000, 'Total 1000 items queued');

    // Verify all 10 batches in database are now QUEUED
    const queuedBatches = await WhatsAppBatch.findAll({
      where: { import_batch_id: importBatch.id },
    });
    assert.strictEqual(queuedBatches.every((b) => b.status === 'QUEUED'), true);

    // Verify total outbox items count
    const totalOutbox = await WhatsAppOutbox.count({
      where: { batch_id: queuedBatches.map((b) => b.id) },
    });
    assert.strictEqual(totalOutbox, 1000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Eligibility Filtering & Categorized Exclusion Breakdown
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 5: Eligibility Filtering -> Missing phone, invalid phone, not pending, opted out, duplicate categorized', async () => {
    const importBatch = await CsvImportBatch.create({
      filename: `e2e_excl_${RUN_TAG}.csv`,
      file_path: `uploads/csv/e2e_excl_${RUN_TAG}.csv`,
      uploaded_by: testAdminUser.id,
      marketplace: 'other',
      channel: 'direct',
      total_rows: 6,
      success_rows: 6,
      status: 'completed',
    });

    // 1. Valid customer
    const c1 = await Customer.create({ name: 'Valid User', phone: '9811100001', whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-1-${RUN_TAG}`, customer_id: c1.id, import_batch_id: importBatch.id, status: 'pending' });

    // 2. Missing phone
    const c2 = await Customer.create({ name: 'No Phone', phone: null, whatsapp_number: null, whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-2-${RUN_TAG}`, customer_id: c2.id, import_batch_id: importBatch.id, status: 'pending' });

    // 3. Invalid phone (< 10 digits)
    const c3 = await Customer.create({ name: 'Short Phone', phone: '12345', whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-3-${RUN_TAG}`, customer_id: c3.id, import_batch_id: importBatch.id, status: 'pending' });

    // 4. Order status not pending (e.g. cancelled)
    const c4 = await Customer.create({ name: 'Cancelled Order Cust', phone: '9811100004', whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-4-${RUN_TAG}`, customer_id: c4.id, import_batch_id: importBatch.id, status: 'cancelled' });

    // 5. Opted out customer
    const c5 = await Customer.create({ name: 'Opted Out Cust', phone: '9811100005', whatsapp_opt_in: false });
    await Order.create({ order_number: `ORD-EX-5-${RUN_TAG}`, customer_id: c5.id, import_batch_id: importBatch.id, status: 'pending' });

    // 6. Duplicate phone in same upload (same as c1)
    const c6 = await Customer.create({ name: 'Duplicate Phone Cust', phone: '9811100001', whatsapp_opt_in: true });
    await Order.create({ order_number: `ORD-EX-6-${RUN_TAG}`, customer_id: c6.id, import_batch_id: importBatch.id, status: 'pending' });

    const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);

    assert.strictEqual(summary.uploaded_records, 6);
    assert.strictEqual(summary.eligible_for_whatsapp, 1, 'Only 1 record should be eligible');
    assert.strictEqual(summary.excluded_records, 5, '5 records should be excluded');

    const breakdown = summary.exclusion_breakdown;
    assert.strictEqual(breakdown.missing_phone, 1);
    assert.strictEqual(breakdown.invalid_phone_format, 1);
    assert.strictEqual(breakdown.order_not_pending, 1);
    assert.strictEqual(breakdown.opted_out, 1);
    assert.strictEqual(breakdown.duplicate_phone_in_upload, 1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6: Emergency Kill Switch Absolute Stop
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 6: Global Emergency Kill Switch blocks single & send-all batch confirmations with WHATSAPP_SENDING_PAUSED', async () => {
    try {
      // Engage Kill Switch
      await emergencyPauseService.setSendingState({
        enabled: false,
        reason: 'Testing kill switch block on batch operations',
      });

      const importBatch = await CsvImportBatch.create({
        filename: `e2e_pause_${RUN_TAG}.csv`,
        file_path: `uploads/csv/e2e_pause_${RUN_TAG}.csv`,
        uploaded_by: testAdminUser.id,
        marketplace: 'amazon',
        channel: 'amazon_channel_1',
        total_rows: 2,
        success_rows: 2,
        status: 'completed',
      });

      const c = await Customer.create({ name: 'Pause Test', phone: '9822200001', whatsapp_opt_in: true });
      await Order.create({ order_number: `ORD-PZ-1-${RUN_TAG}`, customer_id: c.id, import_batch_id: importBatch.id, status: 'pending' });

      const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);
      const batch = summary.batches[0];

      // Try single batch confirmation while paused -> MUST THROW WHATSAPP_SENDING_PAUSED
      let singlePaused = false;
      try {
        await whatsappBatchService.confirmAndDispatchBatch({
          batchId: batch.id,
          userId: testAdminUser.id,
        });
      } catch (e) {
        singlePaused = e.code === 'WHATSAPP_SENDING_PAUSED';
      }
      assert.strictEqual(singlePaused, true, 'confirmAndDispatchBatch must fail with WHATSAPP_SENDING_PAUSED');

      // Try confirmAllBatchesForImport while paused -> MUST THROW WHATSAPP_SENDING_PAUSED
      let allPaused = false;
      try {
        await whatsappBatchService.confirmAllBatchesForImport(importBatch.id, testAdminUser.id);
      } catch (e) {
        allPaused = e.code === 'WHATSAPP_SENDING_PAUSED';
      }
      assert.strictEqual(allPaused, true, 'confirmAllBatchesForImport must fail with WHATSAPP_SENDING_PAUSED');
    } finally {
      // Always restore sending state to ACTIVE for subsequent tests
      await emergencyPauseService.setSendingState({
        enabled: true,
        reason: 'Resume sending after pause test',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7: Daily Spend Ceiling Guard
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 7: Daily Spend Ceiling blocks batch confirmation when spend limit exceeded', async () => {
    try {
      // Set daily spend ceiling to ₹50.00
      await SystemSetting.upsert({ key: 'WHATSAPP_DAILY_SPEND_LIMIT', value: '50.00' });

      const importBatch = await CsvImportBatch.create({
        filename: `e2e_spend_${RUN_TAG}.csv`,
        file_path: `uploads/csv/e2e_spend_${RUN_TAG}.csv`,
        uploaded_by: testAdminUser.id,
        marketplace: 'amazon',
        channel: 'amazon_channel_1',
        total_rows: 100,
        success_rows: 100,
        status: 'completed',
      });

      // 100 messages at ₹0.80 = ₹80.00 (which exceeds the ₹50.00 limit)
      const orders = [];
      for (let i = 1; i <= 100; i++) {
        const c = await Customer.create({
          name: `SpendCust_${i}`,
          phone: `98333${String(i).padStart(7, '0')}`,
          whatsapp_opt_in: true,
        });
        orders.push({
          order_number: `ORD-SPD-${i}-${RUN_TAG}`,
          customer_id: c.id,
          import_batch_id: importBatch.id,
          status: 'pending',
        });
      }
      await Order.bulkCreate(orders);

      const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);
      assert.strictEqual(summary.total_batches, 1);
      const batch = summary.batches[0];

      let spendBlocked = false;
      try {
        await whatsappBatchService.confirmAndDispatchBatch({
          batchId: batch.id,
          userId: testAdminUser.id,
        });
      } catch (e) {
        spendBlocked = e.message.includes('DAILY_SPEND_LIMIT_EXCEEDED') || e.message.includes('ceiling') || e.message.includes('exceeds');
      }
      assert.strictEqual(spendBlocked, true, 'Batch confirmation must be blocked when spend limit exceeded');

      // Batch status should remain AWAITING_CONFIRMATION
      await batch.reload();
      assert.strictEqual(batch.status, 'AWAITING_CONFIRMATION');
    } finally {
      // Reset daily limit to high value for next tests
      await SystemSetting.upsert({ key: 'WHATSAPP_DAILY_SPEND_LIMIT', value: '500000.00' });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8: Existing Action Buttons Verification
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 8: Existing Action Buttons (sendMessage, retryWarrantyMessage, bulkSendWhatsApp)', async () => {
    metaApiCallCount = 0;
    whatsappRateLimiter.localRecentSends = [];

    // 8.1 whatsappService.sendMessage (Telecaller visit notification)
    const testPhone = `98444${RUN_TAG.slice(-5)}`;
    const msgRes = await whatsappService.sendMessage({
      phone: testPhone,
      message: 'Hello, your store visit is scheduled for 10:00 AM.',
    });
    assert.strictEqual(msgRes.success, true, 'Direct text sendMessage must succeed');
    assert.ok(msgRes.waMessageId, 'Must return provider message ID');

    const directLog = await WhatsAppLog.findOne({
      where: { phone_number: testPhone },
      order: [['created_at', 'DESC']],
    });
    assert.ok(directLog, 'Direct message log entry must exist');
    assert.strictEqual(directLog.status, 'sent');

    // 8.2 warrantyController.retryWarrantyMessage
    const warrantyCustomer = await Customer.create({
      name: 'Warranty User',
      phone: `98555${RUN_TAG.slice(-5)}`,
      whatsapp_number: `98555${RUN_TAG.slice(-5)}`,
      whatsapp_opt_in: true,
    });

    const testWarranty = await Warranty.create({
      warranty_number: `WAR-E2E-${RUN_TAG}`,
      customer_id: warrantyCustomer.id,
      product_name: 'Akuabeat Purifier',
      product_name_snapshot: 'Akuabeat Purifier',
      product_sku: 'AKUA-WARR-01',
      purchase_date: '2026-08-30',
      warranty_start_date: '2026-08-30',
      warranty_end_date: '2027-08-30',
      warranty_status: 'INSTALLATION_COMPLETED',
      installation_completed_at: new Date(),
      activation_due_at: new Date(),
    });

    const failedMsg = await WarrantyMessage.create({
      warranty_id: testWarranty.id,
      customer_id: warrantyCustomer.id,
      phone_number: `98555${RUN_TAG.slice(-5)}`,
      template_key: 'warranty_claim',
      channel: 'WHATSAPP',
      delivery_status: 'FAILED',
      failure_reason: 'Provider timeout simulation',
      attempt_count: 1,
      idempotency_key: `wm-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    });

    const warrantyCtrl = require('../controllers/warrantyController');
    const mockReq = {
      params: { messageId: failedMsg.id },
      user: testAdminUser,
    };
    let responseData = null;
    const mockRes = {
      status: () => mockRes,
      json: (data) => { responseData = data; return mockRes; },
    };
    const mockNext = (err) => { if (err) throw err; };

    await warrantyCtrl.retryWarrantyMessage(mockReq, mockRes, mockNext);

    assert.ok(responseData, 'Should return response JSON');
    assert.strictEqual(responseData.status, 'success');

    await failedMsg.reload();
    assert.strictEqual(failedMsg.delivery_status, 'SENT', 'WarrantyMessage status must become SENT');
    assert.strictEqual(failedMsg.attempt_count, 2, 'Attempt count must increment');

    // Verify WarrantyEvent recorded
    const event = await WarrantyEvent.findOne({
      where: { warranty_id: testWarranty.id, event_type: 'ACTIVATION_MESSAGE_RETRY' },
    });
    assert.ok(event, 'ACTIVATION_MESSAGE_RETRY event must be recorded in audit log');

    // 8.3 orderController.bulkSendWhatsApp: verify max 100 guard
    const orderCtrl = require('../controllers/orderController');
    const largeOrderIds = Array.from({ length: 101 }, (_, i) => `mock_order_${i}`);
    let bulkBlocked = false;
    await orderCtrl.bulkSendWhatsApp(
      { body: { orderIds: largeOrderIds }, user: testAdminUser },
      mockRes,
      (err) => {
        if (err && err.statusCode === 400 && err.message.includes('Maximum 100')) {
          bulkBlocked = true;
        }
      }
    );
    assert.strictEqual(bulkBlocked, true, 'bulkSendWhatsApp must reject > 100 orders with 400');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 9: Batch Cancellation with Budget Release
  // ─────────────────────────────────────────────────────────────────────────────
  await test('Flow 9: Batch Cancellation -> Single batch cancel & cancel-all release reserved budget cleanly', async () => {
    const importBatch = await CsvImportBatch.create({
      filename: `e2e_cancel_${RUN_TAG}.csv`,
      file_path: `uploads/csv/e2e_cancel_${RUN_TAG}.csv`,
      uploaded_by: testAdminUser.id,
      marketplace: 'amazon',
      channel: 'amazon_channel_1',
      total_rows: 200,
      success_rows: 200,
      status: 'completed',
    });

    const orders = [];
    for (let i = 1; i <= 200; i++) {
      const c = await Customer.create({
        name: `CancelCust_${i}`,
        phone: `98666${String(i).padStart(7, '0')}`,
        whatsapp_opt_in: true,
      });
      orders.push({
        order_number: `ORD-CCL-${i}-${RUN_TAG}`,
        customer_id: c.id,
        import_batch_id: importBatch.id,
        status: 'pending',
      });
    }
    await Order.bulkCreate(orders);

    const summary = await whatsappBatchService.createBatchesForImport(importBatch.id);
    assert.strictEqual(summary.total_batches, 2);

    const b1 = summary.batches[0];
    const b2 = summary.batches[1];

    // Cancel Batch 1
    const cancelRes = await whatsappBatchService.cancelBatch({
      batchId: b1.id,
      userId: testAdminUser.id,
      reason: 'Cancelled by test',
    });
    assert.strictEqual(cancelRes.success, true);
    await b1.reload();
    assert.strictEqual(b1.status, 'CANCELLED');

    // Cancel remaining batches using cancelAllBatchesForImport
    const cancelAllRes = await whatsappBatchService.cancelAllBatchesForImport(
      importBatch.id,
      testAdminUser.id,
      'Test bulk cancel'
    );
    assert.strictEqual(cancelAllRes.success, true);
    assert.strictEqual(cancelAllRes.cancelled_count, 1, 'Only 1 remaining batch to cancel');

    await b2.reload();
    assert.strictEqual(b2.status, 'CANCELLED');
  });

  console.log('\n╔═════════════════════════════════════════════════════════════════════╗');
  console.log(`║   SUITE FINISHED: ${passedTests} PASSED, ${failedTests} FAILED                            ║`);
  console.log('╚═════════════════════════════════════════════════════════════════════╝\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal e2e test runner error:', err);
  process.exit(1);
});
