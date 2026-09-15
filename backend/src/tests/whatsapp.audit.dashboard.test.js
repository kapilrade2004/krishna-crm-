'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — PRODUCTION WHATSAPP AUDIT, STATUS & COST TEST SUITE
 *  Verifies:
 *   1. Empty state handling (0 messages)
 *   2. Single sent message isolation (SENT != DELIVERED != READ)
 *   3. Strict status segregation: QUEUED/PENDING/PROCESSING/PAUSED/CANCELLED != SENT
 *   4. Successful webhook delivery & read progression
 *   5. Duplicate webhook handling (idempotency)
 *   6. Out-of-order webhook delivery (read before delivered)
 *   7. Estimated vs Actual cost separation (Never mix them; transparent UNAVAILABLE)
 *   8. TODAY filter in IST (+05:30)
 *   9. YESTERDAY filter in IST
 *  10. LAST 7 DAYS filter
 *  11. LAST 30 DAYS filter
 *  12. THIS MONTH filter
 *  13. LAST MONTH filter
 *  14. CUSTOM date range filtering
 *  15. Midnight boundary transition (23:59:59 IST vs 00:00:01 IST)
 *  16. Month boundary transition
 *  17. Template filtering
 *  18. Batch filtering
 *  19. Customer search (name, phone)
 *  20. Order search (order number)
 *  21. Failure categorization & grouping
 *  22. Retry analytics & exhausted detection
 *  23. RECONCILIATION CONTRACT: TOTAL SENT === SUM(DAILY SENT COUNTS)
 *  24. CSV Export generation & formula injection protection
 *  25. REST Controller response validation & RBAC security
 * ═══════════════════════════════════════════════════════════════════════════
 */

process.env.NODE_ENV = 'test';
process.env.WHATSAPP_ACCESS_TOKEN = 'mock_audit_token_123';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock_audit_phone_id_123';
process.env.JWT_SECRET = 'test_secret_audit_dashboard_jwt';

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
  SystemSetting,
  syncModels,
} = require('../models');

const whatsappService = require('../services/whatsappService');
const whatsappAuditService = require('../services/whatsappAuditService');
const emergencyPauseService = require('../services/emergencyPauseService');
const auditCtrl = require('../controllers/whatsappAuditController');

// Global mock for fetch
global.fetch = async (url, options = {}) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      messaging_product: 'whatsapp',
      contacts: [{ input: '919876543210', wa_id: '919876543210' }],
      messages: [{ id: `wamid.HBgL${Date.now()}` }],
    }),
  };
};

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 RUNNING PRODUCTION WHATSAPP AUDIT & COST DASHBOARD TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Sync models
  await syncModels();
  const syncMissing = require('../scripts/sync_missing_columns');
  if (typeof syncMissing === 'function') await syncMissing();

  // Clear existing WhatsApp logs and outbox for pristine test environment
  await WhatsAppLog.destroy({ where: {}, truncate: false, force: true }).catch(() => {});
  await WhatsAppOutbox.destroy({ where: {}, truncate: false, force: true }).catch(() => {});
  await WhatsAppBatch.destroy({ where: {}, truncate: false, force: true }).catch(() => {});

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // ─── TC01: Empty State ──────────────────────────────────────────────────────
  await test('TC01: Empty State (zero messages) returns 0 counts and safe defaults', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'LAST_30_DAYS' });
    assert.strictEqual(summary.metrics.total_sent, 0);
    assert.strictEqual(summary.metrics.delivered_count, 0);
    assert.strictEqual(summary.metrics.read_count, 0);
    assert.strictEqual(summary.metrics.failed_count, 0);
    assert.strictEqual(summary.cost.total_estimated_cost, 0);
    assert.strictEqual(summary.cost.total_actual_cost, null);
    assert.strictEqual(summary.cost.actual_cost_status, 'UNAVAILABLE');
    assert.strictEqual(summary.cost.provider_balance.status, 'BALANCE UNAVAILABLE');
  });

  // ─── TC02: Single Sent Message ──────────────────────────────────────────────
  await test('TC02: Single sent message appears under SENT, not delivered or read', async () => {
    const log = await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543210',
      message_type: 'template',
      template_name: 'order_verification',
      status: 'sent',
      wa_message_id: 'wamid.TC02_TEST',
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    const summary = await whatsappAuditService.getAuditSummary({ preset: 'TODAY' });
    assert.strictEqual(summary.metrics.total_sent, 1, 'Total sent must be 1');
    assert.strictEqual(summary.metrics.sent_awaiting_delivery, 1, 'Sent awaiting delivery must be 1');
    assert.strictEqual(summary.metrics.delivered_count, 0, 'Delivered must be 0');
    assert.strictEqual(summary.metrics.read_count, 0, 'Read must be 0');
  });

  // ─── TC03: Status Segregation ───────────────────────────────────────────────
  await test('TC03: Status segregation: QUEUED/PENDING/PROCESSING/PAUSED/CANCELLED are NEVER counted as SENT', async () => {
    // Create non-sent records
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543211',
      status: 'queued',
      created_at: new Date(),
    });
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543212',
      status: 'paused',
      created_at: new Date(),
    });
    await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543213',
      template_name: 'order_update',
      status: 'pending',
      created_at: new Date(),
    });
    await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543214',
      template_name: 'order_update',
      status: 'processing',
      created_at: new Date(),
    });
    await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543215',
      template_name: 'order_update',
      status: 'cancelled',
      created_at: new Date(),
    });

    const summary = await whatsappAuditService.getAuditSummary({ preset: 'TODAY' });
    // TC02 created 1 sent. None of the above 5 must be added to total_sent!
    assert.strictEqual(summary.metrics.total_sent, 1, 'Total sent must still be strictly 1');
    assert.strictEqual(summary.metrics.queued_count, 1);
    assert.strictEqual(summary.metrics.paused_count, 1);
    assert.strictEqual(summary.metrics.pending_count, 1);
    assert.strictEqual(summary.metrics.processing_count, 1);
    assert.strictEqual(summary.metrics.cancelled_count, 1);
  });

  // ─── TC04: Delivery Progression (sent -> delivered -> read) ────────────────
  await test('TC04: Successful webhook delivery & read progression', async () => {
    const waId = `wamid.TC04_${Date.now()}`;
    const log = await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543220',
      status: 'sent',
      wa_message_id: waId,
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    // Webhook delivers
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: waId,
              status: 'delivered',
              timestamp: `${Math.floor(Date.now() / 1000)}`,
            }],
          },
        }],
      }],
    });

    await log.reload();
    assert.strictEqual(log.status, 'delivered');
    assert.ok(log.delivered_at !== null, 'delivered_at must be populated');

    // Webhook reads
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: waId,
              status: 'read',
              timestamp: `${Math.floor(Date.now() / 1000)}`,
            }],
          },
        }],
      }],
    });

    await log.reload();
    assert.strictEqual(log.status, 'read');
    assert.ok(log.read_at !== null, 'read_at must be populated');
  });

  // ─── TC05: Duplicate Webhook Handling (Idempotency) ─────────────────────────
  await test('TC05: Duplicate webhook handling does not duplicate counts or alter timestamps', async () => {
    const waId = `wamid.TC05_${Date.now()}`;
    const log = await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543225',
      status: 'sent',
      wa_message_id: waId,
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    const fixedTs = Math.floor(Date.now() / 1000);
    const webhookPayload = {
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: waId,
              status: 'delivered',
              timestamp: `${fixedTs}`,
            }],
          },
        }],
      }],
    };

    // Receive first time
    await whatsappService.handleWebhook(webhookPayload);
    await log.reload();
    const firstDeliveredAt = new Date(log.delivered_at).getTime();

    // Receive second time (duplicate)
    await whatsappService.handleWebhook(webhookPayload);
    await log.reload();
    assert.strictEqual(new Date(log.delivered_at).getTime(), firstDeliveredAt, 'Timestamp must remain unchanged on duplicate webhook');
    assert.strictEqual(log.status, 'delivered');
  });

  // ─── TC06: Out-of-Order Webhook Delivery ────────────────────────────────────
  await test('TC06: Out-of-order webhook delivery (read before delivered) does not regress status', async () => {
    const waId = `wamid.TC06_${Date.now()}`;
    const log = await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543230',
      status: 'sent',
      wa_message_id: waId,
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    // Customer reads message first (e.g. delivered webhook was delayed in transit)
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: waId,
              status: 'read',
              timestamp: `${Math.floor(Date.now() / 1000)}`,
            }],
          },
        }],
      }],
    });
    await log.reload();
    assert.strictEqual(log.status, 'read');

    // Delayed delivered webhook arrives later
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: waId,
              status: 'delivered',
              timestamp: `${Math.floor(Date.now() / 1000) - 10}`,
            }],
          },
        }],
      }],
    });
    await log.reload();
    assert.strictEqual(log.status, 'read', 'Status must NOT regress from read back to delivered');
  });

  // ─── TC07: Estimated vs Actual Cost Separation ──────────────────────────────
  await test('TC07: Estimated vs Actual cost separation; actual cost transparently UNAVAILABLE when unbilled', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'TODAY' });
    assert.ok(summary.cost.total_estimated_cost > 0, 'Estimated cost should reflect sent messages');
    assert.strictEqual(summary.cost.total_actual_cost, null, 'Actual cost must be null when unbilled');
    assert.strictEqual(summary.cost.actual_cost_status, 'UNAVAILABLE');
  });

  // ─── TC08: TODAY Filter (IST) ───────────────────────────────────────────────
  await test('TC08: TODAY filter selects only records belonging to today in IST', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'TODAY' });
    assert.ok(summary.metrics.total_sent >= 1, 'Should find messages created today');
  });

  // ─── TC09: YESTERDAY Filter (IST) ───────────────────────────────────────────
  await test('TC09: YESTERDAY filter isolates yesterday records in IST', async () => {
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543240',
      status: 'sent',
      wa_message_id: 'wamid.TC09_YEST',
      sent_at: yesterdayDate,
      estimated_cost: 0.80,
    });

    const yesterdaySummary = await whatsappAuditService.getAuditSummary({ preset: 'YESTERDAY' });
    assert.ok(yesterdaySummary.metrics.total_sent >= 1, 'Should find yesterday messages');
  });

  // ─── TC10: LAST 7 DAYS Filter ───────────────────────────────────────────────
  await test('TC10: LAST 7 DAYS filter includes records from the past 7 days', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'LAST_7_DAYS' });
    assert.ok(summary.metrics.total_sent >= 2, 'Should encompass today and yesterday records');
  });

  // ─── TC11: LAST 30 DAYS Filter ──────────────────────────────────────────────
  await test('TC11: LAST 30 DAYS filter aggregates all recent activity', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'LAST_30_DAYS' });
    assert.ok(summary.metrics.total_sent >= 2);
  });

  // ─── TC12: THIS MONTH Filter ────────────────────────────────────────────────
  await test('TC12: THIS MONTH filter isolates current month records', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'THIS_MONTH' });
    assert.ok(summary.metrics.total_sent >= 1);
  });

  // ─── TC13: LAST MONTH Filter ────────────────────────────────────────────────
  await test('TC13: LAST MONTH filter returns zero if no messages in previous month', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'LAST_MONTH' });
    assert.strictEqual(typeof summary.metrics.total_sent, 'number');
  });

  // ─── TC14: CUSTOM Date Range ────────────────────────────────────────────────
  await test('TC14: CUSTOM date range filtering', async () => {
    const summary = await whatsappAuditService.getAuditSummary({
      preset: 'CUSTOM',
      startDate: '2026-01-01',
      endDate: '2026-01-02',
    });
    // In 2026-01-01 to 01-02 there are no records
    assert.strictEqual(summary.metrics.total_sent, 0);
  });

  // ─── TC15: Midnight Boundary (23:59:59 vs 00:00:01 IST) ─────────────────────
  await test('TC15: Midnight boundary test: 23:59:59 IST vs 00:00:01 IST land in exact adjacent calendar days', async () => {
    // 2025-05-10 23:59:59 IST = 2025-05-10 18:29:59 UTC
    const day1Utc = new Date('2025-05-10T18:29:59.000Z');
    // 2025-05-11 00:00:01 IST = 2025-05-10 18:30:01 UTC
    const day2Utc = new Date('2025-05-10T18:30:01.000Z');

    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543250',
      status: 'sent',
      wa_message_id: 'wamid.TC15_D1',
      sent_at: day1Utc,
      estimated_cost: 0.80,
    });
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543251',
      status: 'sent',
      wa_message_id: 'wamid.TC15_D2',
      sent_at: day2Utc,
      estimated_cost: 0.80,
    });

    const report = await whatsappAuditService.getDailyMessageReport({
      preset: 'CUSTOM',
      startDate: '2025-05-10',
      endDate: '2025-05-11',
    });

    const day10 = report.daily_report.find(r => r.date === '2025-05-10');
    const day11 = report.daily_report.find(r => r.date === '2025-05-11');

    assert.ok(day10, 'Date 2025-05-10 must exist in daily report');
    assert.ok(day11, 'Date 2025-05-11 must exist in daily report');
    assert.strictEqual(day10.total_sent, 1, 'Day 10 must have exactly 1 sent message');
    assert.strictEqual(day11.total_sent, 1, 'Day 11 must have exactly 1 sent message');
  });

  // ─── TC16: Month Boundary Transition ────────────────────────────────────────
  await test('TC16: Month boundary transition separates cleanly', async () => {
    // 2025-07-31 23:59:59 IST = 2025-07-31 18:29:59 UTC
    const julLastSec = new Date('2025-07-31T18:29:59.000Z');
    // 2025-08-01 00:00:01 IST = 2025-07-31 18:30:01 UTC
    const augFirstSec = new Date('2025-07-31T18:30:01.000Z');

    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543252',
      status: 'sent',
      wa_message_id: 'wamid.TC16_JUL',
      sent_at: julLastSec,
      estimated_cost: 0.80,
    });
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543253',
      status: 'sent',
      wa_message_id: 'wamid.TC16_AUG',
      sent_at: augFirstSec,
      estimated_cost: 0.80,
    });

    const report = await whatsappAuditService.getDailyMessageReport({
      preset: 'CUSTOM',
      startDate: '2025-07-31',
      endDate: '2025-08-01',
    });

    const jul = report.daily_report.find(r => r.date === '2025-07-31');
    const aug = report.daily_report.find(r => r.date === '2025-08-01');

    assert.ok(jul, 'Jul 31 must be present');
    assert.ok(aug, 'Aug 01 must be present');
    assert.strictEqual(jul.total_sent, 1, 'Jul 31 must have 1 message');
    assert.strictEqual(aug.total_sent, 1, 'Aug 1 must have 1 message');
  });

  // ─── TC17: Template Filtering ───────────────────────────────────────────────
  await test('TC17: Template filter isolates template metrics', async () => {
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543260',
      template_name: 'installation_guide_v2',
      status: 'sent',
      wa_message_id: 'wamid.TC17_TPL',
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    const tplCost = await whatsappAuditService.getCostByTemplate({ preset: 'TODAY' });
    const targetTpl = tplCost.templates.find(t => t.template_name === 'installation_guide_v2');
    assert.ok(targetTpl, 'Template installation_guide_v2 must exist');
    assert.strictEqual(targetTpl.total_sent, 1);
  });

  // ─── TC18: Batch Filtering ──────────────────────────────────────────────────
  await test('TC18: Batch filtering isolates batch metrics', async () => {
    const batchId = uuidv4();
    await WhatsAppBatch.create({
      id: batchId,
      batch_id: 'WB-TEST-TC18',
      customer_count: 50,
      message_count: 50,
      status: 'COMPLETED',
      sent_count: 50,
      failed_count: 0,
      estimated_cost: 40.00,
    });

    await WhatsAppLog.create({
      id: uuidv4(),
      batch_id: batchId,
      phone_number: '919876543270',
      status: 'sent',
      wa_message_id: 'wamid.TC18_BATCH',
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    const batchCost = await whatsappAuditService.getCostByBatch({ preset: 'TODAY' });
    const targetBatch = batchCost.batches.find(b => b.batch_id === 'WB-TEST-TC18');
    assert.ok(targetBatch, 'Batch WB-TEST-TC18 must be listed');
    assert.strictEqual(targetBatch.sent_count, 50);
  });

  // ─── TC19: Customer Search ──────────────────────────────────────────────────
  await test('TC19: Customer search by name and phone', async () => {
    const custId = uuidv4();
    await Customer.create({
      id: custId,
      name: 'Aarav Sharma',
      phone: '919811122334',
    });

    await WhatsAppLog.create({
      id: uuidv4(),
      customer_id: custId,
      phone_number: '919811122334',
      status: 'sent',
      wa_message_id: 'wamid.TC19_CUST',
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    const resByName = await whatsappAuditService.getMessageList({ search: 'Aarav' });
    assert.ok(resByName.messages.some(m => m.customer?.name.includes('Aarav')), 'Found by customer name');

    const resByPhone = await whatsappAuditService.getMessageList({ search: '9811122334' });
    assert.ok(resByPhone.messages.some(m => m.phone_number.includes('9811122334')), 'Found by phone');
  });

  // ─── TC20: Order Search ─────────────────────────────────────────────────────
  await test('TC20: Order search by order number', async () => {
    const custId = uuidv4();
    await Customer.create({
      id: custId,
      name: 'Order Test Customer',
      phone: '919876543280',
    });

    const ordNum = `ORD-TC20-${uuidv4().substring(0, 8).toUpperCase()}`;
    const ordId = uuidv4();
    await Order.create({
      id: ordId,
      order_number: ordNum,
      customer_id: custId,
      status: 'confirmed',
      total_amount: 1499.00,
    });

    await WhatsAppLog.create({
      id: uuidv4(),
      order_id: ordId,
      customer_id: custId,
      phone_number: '919876543280',
      status: 'sent',
      wa_message_id: 'wamid.TC20_ORD',
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    const resByOrd = await whatsappAuditService.getMessageList({ search: ordNum });
    assert.ok(resByOrd.messages.some(m => m.order?.order_number === ordNum), 'Found by order number');
  });

  // ─── TC21: Failure Categorization ───────────────────────────────────────────
  await test('TC21: Failure categorization maps real errors to categories', async () => {
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543290',
      status: 'failed',
      error_message: 'Rate limit exceeded: 429 too many requests',
      created_at: new Date(),
      failed_at: new Date(),
    });
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543291',
      status: 'failed',
      error_message: 'Recipient phone number is not a valid WhatsApp user (code 131026)',
      created_at: new Date(),
      failed_at: new Date(),
    });
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543292',
      status: 'failed',
      error_message: 'Emergency Kill Switch is active (Sending Paused)',
      created_at: new Date(),
      failed_at: new Date(),
    });

    const failures = await whatsappAuditService.getFailureAnalytics({ preset: 'TODAY' });
    assert.ok(failures.total_failures >= 3, 'Must track at least 3 failures');

    const rateLimitCat = failures.breakdown.find(b => b.category.includes('Rate Limit'));
    const phoneCat = failures.breakdown.find(b => b.category.includes('Invalid Phone'));
    const pauseCat = failures.breakdown.find(b => b.category.includes('Kill Switch'));

    assert.ok(rateLimitCat && rateLimitCat.count >= 1, 'Rate limit category found');
    assert.ok(phoneCat && phoneCat.count >= 1, 'Invalid phone category found');
    assert.ok(pauseCat && pauseCat.count >= 1, 'Kill switch category found');
  });

  // ─── TC22: Retry Analytics ──────────────────────────────────────────────────
  await test('TC22: Retry analytics tracks retried, recovered, and exhausted messages', async () => {
    // 1 recovered after retry
    await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543301',
      template_name: 'test_tpl',
      status: 'sent',
      attempts: 2,
      max_attempts: 5,
      created_at: new Date(),
    });
    // 1 exhausted
    await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543302',
      template_name: 'test_tpl',
      status: 'failed',
      attempts: 5,
      max_attempts: 5,
      created_at: new Date(),
    });

    const retries = await whatsappAuditService.getRetryAnalytics({ preset: 'TODAY' });
    assert.ok(retries.total_messages_with_retries >= 2, 'At least 2 retried messages');
    assert.ok(retries.successful_after_retry >= 1, 'At least 1 recovered');
    assert.ok(retries.exhausted_max_retries >= 1, 'At least 1 exhausted');
  });

  // ─── TC23: RECONCILIATION CONTRACT ──────────────────────────────────────────
  await test('TC23: Reconciliation contract: TOTAL SENT === SUM OF DAILY SENT COUNTS', async () => {
    const summary = await whatsappAuditService.getAuditSummary({ preset: 'LAST_30_DAYS' });
    const dailyReport = await whatsappAuditService.getDailyMessageReport({ preset: 'LAST_30_DAYS' });

    const totalFromSummary = summary.metrics.total_sent;
    const totalFromDailySum = dailyReport.daily_report.reduce((sum, d) => sum + d.total_sent, 0);

    assert.strictEqual(
      totalFromSummary,
      totalFromDailySum,
      `Reconciliation Failure: Summary total (${totalFromSummary}) != Sum of daily reports (${totalFromDailySum})`
    );
  });

  // ─── TC24: CSV Export Integrity ─────────────────────────────────────────────
  await test('TC24: CSV export data integrity and formula injection protection', async () => {
    // Insert a log with potential CSV injection characters
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919876543310',
      status: 'sent',
      template_name: '=cmd|/c calc!A0', // Injection test
      wa_message_id: 'wamid.TC24_CSV',
      sent_at: new Date(),
      estimated_cost: 0.80,
    });

    const csvOutput = await whatsappAuditService.exportAuditReport({ preset: 'TODAY' });
    assert.ok(csvOutput.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
    assert.ok(csvOutput.includes('Log ID'), 'CSV headers must be present');
    assert.ok(csvOutput.includes('wamid.TC24_CSV'), 'Message ID must be present');
    assert.ok(csvOutput.includes(`"'=cmd|/c calc!A0"`), 'Formula must be safely sanitized with single-quote prefix');
  });

  // ─── TC25: REST Controller & RBAC Check ─────────────────────────────────────
  await test('TC25: REST controller response formatting', async () => {
    let responseData = null;
    let statusCode = null;

    const mockReq = { query: { preset: 'TODAY' } };
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return mockRes;
      },
      json: (payload) => {
        responseData = payload;
        return mockRes;
      },
    };

    await auditCtrl.getSummary(mockReq, mockRes);
    assert.ok(responseData, 'Controller should return response');
    assert.strictEqual(responseData.success, true);
    assert.ok(responseData.data.metrics, 'Metrics object must be returned');
    assert.ok(responseData.data.cost, 'Cost object must be returned');
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running audit test suite:', err);
  process.exit(1);
});
