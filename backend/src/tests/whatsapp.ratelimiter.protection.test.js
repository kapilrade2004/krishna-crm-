'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — PRODUCTION WHATSAPP RATE LIMITER & SPEND PROTECTION SUITE
 *  Verifies:
 *   1. Global Emergency Pause Absolute Authority (Zero sends when paused).
 *   2. Distributed Rate Limiter - Minute Limit Pacing & waitMs calculation.
 *   3. Multi-Worker Distributed Concurrency (Workers A, B, C respect shared cap).
 *   4. Atomic Outbox Send Authorization (Prevents duplicate worker sends).
 *   5. Daily Spend Ceiling Guard (Blocks new messages/batches when ceiling hit).
 *   6. Concurrent Batch Spend Reservation (Prevents race condition overspending).
 *   7. Reservation Release & Adjustment (Cancelled/completed batches free spend).
 *   8. Provider HTTP 429 / Meta Throttling Backoff & Cooldown Window.
 *   9. Failure Classification (Transient network/429 vs Permanent invalid phone).
 *  10. Pause Mid-Batch Transmission (Halts cleanly, records partial state).
 *  11. Database Sliding Window Fallback (Resilient when Redis is offline).
 *  12. Admin Control Panel REST Endpoints (Status, Config, Audit Trail).
 * ═══════════════════════════════════════════════════════════════════════════
 */

process.env.NODE_ENV = 'test';
process.env.WHATSAPP_ACCESS_TOKEN = 'mock_token_for_rate_limit_test';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock_phone_id_for_rate_limit_test';
process.env.JWT_SECRET = 'test_secret_ratelimit_jwt_123';

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
  WhatsAppRateLimitEvent,
  SystemSetting,
  syncModels,
} = require('../models');

const whatsappRateLimiter = require('../services/whatsappRateLimiter');
const whatsappSpendGuard = require('../services/whatsappSpendGuard');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const whatsappBatchService = require('../services/whatsappBatchService');
const whatsappService = require('../services/whatsappService');
const emergencyPauseService = require('../services/emergencyPauseService');
const WhatsAppRateLimitController = require('../controllers/whatsappRateLimitController');

let mockMetaCallCount = 0;
let mockMetaCallHistory = [];
let mockMetaErrorMode = null; // '429', '131026', 'timeout'

global.fetch = async (url, options = {}) => {
  const urlStr = String(url || '');
  if (urlStr.includes('graph.facebook.com') || urlStr.includes('api.aoc-portal.com')) {
    mockMetaCallCount++;
    mockMetaCallHistory.push({ url: urlStr, method: options.method, body: options.body });

    if (mockMetaErrorMode === '429') {
      return {
        ok: false,
        status: 429,
        headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? '5' : null) },
        text: async () => JSON.stringify({
          error: {
            message: 'Rate limit hit: Cloud API throughput exceeded',
            type: 'OAuthException',
            code: 130429,
            error_subcode: 130429,
          },
        }),
        json: async () => ({
          error: {
            message: 'Rate limit hit: Cloud API throughput exceeded',
            code: 130429,
            error_subcode: 130429,
          },
        }),
      };
    }

    if (mockMetaErrorMode === '131026') {
      return {
        ok: false,
        status: 400,
        headers: { get: () => null },
        text: async () => JSON.stringify({
          error: {
            message: 'Message undeliverable: Recipient phone number is not a valid WhatsApp user',
            code: 131026,
          },
        }),
        json: async () => ({
          error: {
            message: 'Message undeliverable: Recipient phone number is not a valid WhatsApp user',
            code: 131026,
          },
        }),
      };
    }

    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
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
  console.log('║   KRISHNA CRM — WHATSAPP RATE LIMITER & SPEND PROTECTION SUITE      ║');
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
      if (err.stack) console.error(err.stack);
      failedTests++;
    }
  }

  // Setup database
  await syncModels(false);

  // Clean tables
  await WhatsAppRateLimitEvent.destroy({ where: {}, force: true });
  await WhatsAppOutbox.destroy({ where: {}, force: true });
  await WhatsAppBatch.destroy({ where: {}, force: true });
  await WhatsAppLog.destroy({ where: {}, force: true });
  await SystemSetting.destroy({ where: {}, force: true });

  // Create test user
  testUser = await User.create({
    id: uuidv4(),
    name: 'Rate Limit Admin',
    email: `ratelimit-admin-${Date.now()}@krishnacrm.com`,
    role: 'super_admin',
    password: 'HashedPassword123!',
    is_active: true,
  });

  // Ensure WhatsApp sending is enabled by default
  await emergencyPauseService.setSendingState({
    enabled: true,
    actorUserId: testUser.id,
    initiatedByEmail: testUser.email,
    reason: 'Test suite initialization',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Global Pause Absolute Authority
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 1: Global Pause Absolute Authority', async () => {
    mockMetaCallCount = 0;
    mockMetaErrorMode = null;

    try {
      // Engage emergency pause
      await emergencyPauseService.setSendingState({
        enabled: false,
        actorUserId: testUser.id,
        initiatedByEmail: testUser.email,
        reason: 'Testing pause authority',
      });

      // Verify rate limiter token acquisition is blocked
      const token = await whatsappRateLimiter.acquireSendToken();
      assert.strictEqual(token.allowed, false, 'Should disallow token when paused');
      assert.strictEqual(token.isEmergencyPause, true, 'Should flag emergency pause');

      // Verify sendRequest throws WHATSAPP_SENDING_PAUSED
      let threw = false;
      try {
        await whatsappService.sendRequest({ type: 'text', text: { body: 'Test' } });
      } catch (err) {
        threw = true;
        assert.strictEqual(err.code, 'WHATSAPP_SENDING_PAUSED');
      }
      assert.strictEqual(threw, true, 'sendRequest must throw when paused');
      assert.strictEqual(mockMetaCallCount, 0, 'Zero Meta API calls must be made during pause');
    } finally {
      // Restore pause state
      await emergencyPauseService.setSendingState({
        enabled: true,
        actorUserId: testUser.id,
        initiatedByEmail: testUser.email,
        reason: 'Resume for remaining tests',
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Distributed Rate Limiter - Minute Limit Pacing
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 2: Distributed Rate Limiter - Minute Limit Pacing', async () => {
    // Set limit to 4 messages per minute
    await SystemSetting.upsert({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: '4' });
    whatsappRateLimiter.localRecentSends = []; // Clear in-memory slice

    const res1 = await whatsappRateLimiter.acquireSendToken();
    const res2 = await whatsappRateLimiter.acquireSendToken();
    const res3 = await whatsappRateLimiter.acquireSendToken();
    const res4 = await whatsappRateLimiter.acquireSendToken();

    assert.strictEqual(res1.allowed, true, 'Token 1 should be allowed');
    assert.strictEqual(res2.allowed, true, 'Token 2 should be allowed');
    assert.strictEqual(res3.allowed, true, 'Token 3 should be allowed');
    assert.strictEqual(res4.allowed, true, 'Token 4 should be allowed');

    // 5th token should be throttled
    const res5 = await whatsappRateLimiter.acquireSendToken();
    assert.strictEqual(res5.allowed, false, 'Token 5 should be throttled');
    assert.strictEqual(res5.reason, 'RATE_LIMIT_PER_MINUTE');
    assert.ok(res5.waitMs > 0, 'Should provide non-zero waitMs delay');

    // Reset limit
    await SystemSetting.upsert({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: '60' });
    whatsappRateLimiter.localRecentSends = [];
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Multi-Worker Distributed Concurrency
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 3: Multi-Worker Distributed Concurrency (Workers A, B, C)', async () => {
    // Set limit to 6 messages per minute
    await SystemSetting.upsert({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: '6' });
    whatsappRateLimiter.localRecentSends = [];

    // Simulate 3 workers each requesting 3 tokens concurrently (total 9 requests for limit 6)
    const workerA = Promise.all([
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-A' }),
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-A' }),
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-A' }),
    ]);
    const workerB = Promise.all([
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-B' }),
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-B' }),
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-B' }),
    ]);
    const workerC = Promise.all([
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-C' }),
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-C' }),
      whatsappRateLimiter.acquireSendToken({ workerId: 'worker-C' }),
    ]);

    const [resultsA, resultsB, resultsC] = await Promise.all([workerA, workerB, workerC]);
    const allResults = [...resultsA, ...resultsB, ...resultsC];

    const allowedCount = allResults.filter(r => r.allowed).length;
    const throttledCount = allResults.filter(r => !r.allowed).length;

    assert.strictEqual(allowedCount, 6, `Strictly 6 tokens allowed across all workers, received ${allowedCount}`);
    assert.strictEqual(throttledCount, 3, `Strictly 3 tokens throttled, received ${throttledCount}`);

    // Reset limit
    await SystemSetting.upsert({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: '60' });
    whatsappRateLimiter.localRecentSends = [];
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Atomic Outbox Send Authorization (No Duplicate Processing)
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 4: Atomic Outbox Send Authorization', async () => {
    const item = await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543210',
      template_name: 'test_template',
      status: 'pending',
      next_attempt_at: new Date(Date.now() - 1000),
    });

    // Simulate Worker 1 and Worker 2 attempting atomic claim on the same row concurrently
    const claimWorker1 = WhatsAppOutbox.update(
      { status: 'processing', worker_id: 'worker-1', locked_at: new Date() },
      { where: { id: item.id, status: 'pending' } }
    );
    const claimWorker2 = WhatsAppOutbox.update(
      { status: 'processing', worker_id: 'worker-2', locked_at: new Date() },
      { where: { id: item.id, status: 'pending' } }
    );

    const [[count1], [count2]] = await Promise.all([claimWorker1, claimWorker2]);

    // Exactly one worker must win the claim (1), and the other must get (0)
    assert.strictEqual(count1 + count2, 1, 'Exactly one worker must succeed in atomic claim');
    const winningWorker = count1 === 1 ? 'worker-1' : 'worker-2';

    const refreshed = await WhatsAppOutbox.findByPk(item.id);
    assert.strictEqual(refreshed.status, 'processing');
    assert.strictEqual(refreshed.worker_id, winningWorker);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: Daily Spend Ceiling Guard
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 5: Daily Spend Ceiling Guard (Blocks confirmation when ceiling hit)', async () => {
    // Set daily spend ceiling to ₹100.00
    await SystemSetting.upsert({ key: 'WHATSAPP_DAILY_SPEND_LIMIT', value: '100.00' });

    // Seed ₹80.00 in sent messages today
    const { startUtc } = whatsappSpendGuard.getTodayIstBoundaries();
    await WhatsAppLog.create({
      id: uuidv4(),
      phone_number: '919999999999',
      status: 'sent',
      sent_at: new Date(startUtc.getTime() + 10000),
      actual_cost: 80.00,
      cost_currency: 'INR',
    });

    // Create a batch with estimated cost of ₹30.00 (80 + 30 = 110 > 100)
    const batch = await WhatsAppBatch.create({
      id: uuidv4(),
      batch_id: `WB-TEST-SPEND-${Date.now()}`,
      customer_count: 38,
      message_count: 38,
      estimated_cost: 30.00,
      status: 'AWAITING_CONFIRMATION',
      metadata: {
        items: [{ order_id: uuidv4(), customer_id: uuidv4(), phone: '919876543210' }],
      },
    });

    // Attempting confirmation must be rejected
    let threw = false;
    try {
      await whatsappBatchService.confirmAndDispatchBatch(batch.id, testUser.id);
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('DAILY_SPEND_LIMIT_EXCEEDED'), `Expected DAILY_SPEND_LIMIT_EXCEEDED, got: ${err.message}`);
    }
    assert.strictEqual(threw, true, 'Batch confirmation must be rejected when spend ceiling is exceeded');

    // Verify batch remains AWAITING_CONFIRMATION
    const refreshed = await WhatsAppBatch.findByPk(batch.id);
    assert.strictEqual(refreshed.status, 'AWAITING_CONFIRMATION');
    assert.strictEqual(parseFloat(refreshed.reserved_cost), 0.00);

    // Verify audit event recorded
    const event = await WhatsAppRateLimitEvent.findOne({
      where: { event_type: 'SPEND_CEILING_BLOCKED', batch_id: batch.id },
    });
    assert.ok(event, 'SPEND_CEILING_BLOCKED audit event must be logged');

    // Reset daily spend ceiling
    await SystemSetting.upsert({ key: 'WHATSAPP_DAILY_SPEND_LIMIT', value: '5000.00' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: Concurrent Batch Spend Reservation Protection
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 6: Concurrent Batch Spend Reservation (Balance ₹1000, 2x ₹700 batches)', async () => {
    await SystemSetting.upsert({ key: 'WHATSAPP_DAILY_SPEND_LIMIT', value: '1000.00' });
    await WhatsAppLog.destroy({ where: {} });

    // Batch A: ₹700
    const batchA = await WhatsAppBatch.create({
      id: uuidv4(),
      batch_id: `WB-RACE-A-${Date.now()}`,
      customer_count: 100,
      message_count: 100,
      estimated_cost: 700.00,
      status: 'AWAITING_CONFIRMATION',
      metadata: { items: [{ order_id: null, phone: '919876543211' }] },
    });

    // Batch B: ₹700
    const batchB = await WhatsAppBatch.create({
      id: uuidv4(),
      batch_id: `WB-RACE-B-${Date.now()}`,
      customer_count: 100,
      message_count: 100,
      estimated_cost: 700.00,
      status: 'AWAITING_CONFIRMATION',
      metadata: { items: [{ order_id: null, phone: '919876543212' }] },
    });

    // Set Batch A as actively processing with ₹700 reservation
    await batchA.update({ status: 'PROCESSING', reserved_cost: 700.00 });

    const activeSpend = await whatsappSpendGuard.getActiveReservedSpend();
    assert.strictEqual(activeSpend, 700.00, 'Batch A must hold ₹700 active reservation');

    // Confirm Batch B: Must be blocked because remaining limit is 1000 - 700 = 300 < 700
    let threwB = false;
    try {
      await whatsappBatchService.confirmAndDispatchBatch(batchB.id, testUser.id);
    } catch (err) {
      threwB = true;
      assert.ok(err.message.includes('DAILY_SPEND_LIMIT_EXCEEDED'), `Expected DAILY_SPEND_LIMIT_EXCEEDED, got: ${err.message}`);
    }
    assert.strictEqual(threwB, true, 'Batch B must be blocked by Batch A reserved spend');

    const refreshedB = await WhatsAppBatch.findByPk(batchB.id);
    assert.strictEqual(refreshedB.status, 'AWAITING_CONFIRMATION', 'Batch B must remain un-queued');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: Reservation Release & Adjustment
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 7: Reservation Release & Adjustment upon Cancellation', async () => {
    await WhatsAppBatch.destroy({ where: {}, force: true });

    // Create an active queued batch with ₹500 reservation
    const batch = await WhatsAppBatch.create({
      id: uuidv4(),
      batch_id: `WB-CANCEL-TEST-${Date.now()}`,
      customer_count: 50,
      message_count: 50,
      estimated_cost: 500.00,
      reserved_cost: 500.00,
      status: 'QUEUED',
      metadata: { items: [] },
    });

    const preReserved = await whatsappSpendGuard.getActiveReservedSpend();
    assert.strictEqual(preReserved >= 500.00, true, 'Pre-cancellation reserved spend must include batch');

    // Cancel Batch
    await whatsappBatchService.cancelBatch(batch.id, testUser.id, 'User cancelled');

    const refreshed = await WhatsAppBatch.findByPk(batch.id);
    assert.strictEqual(refreshed.status, 'CANCELLED');
    assert.strictEqual(parseFloat(refreshed.reserved_cost), 0.00, 'Reserved cost must be released to ₹0.00');

    // Active reserved spend should now be 0
    const activeReserved = await whatsappSpendGuard.getActiveReservedSpend();
    assert.strictEqual(activeReserved, 0.00, 'Total active reserved spend must return to 0');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8: Provider HTTP 429 / Meta Throttling Backoff
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 8: Provider HTTP 429 Throttling Backoff & Cooldown Window', async () => {
    whatsappRateLimiter.resetProviderThrottle();
    mockMetaErrorMode = '429';

    const item = await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543210',
      template_name: 'test_throttling',
      status: 'pending',
    });

    const res = await whatsappOutboxQueue.processItem(item);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isRateLimit, true);

    // Verify rate limiter entered cooldown
    const throttleStatus = await whatsappRateLimiter.isProviderThrottled();
    assert.strictEqual(throttleStatus.throttled, true, 'Limiter must be in provider throttle cooldown');
    assert.ok(throttleStatus.waitMs > 0, 'Cooldown waitMs must be greater than 0');

    // In cooldown, acquireSendToken must yield PROVIDER_THROTTLED
    const token = await whatsappRateLimiter.acquireSendToken();
    assert.strictEqual(token.allowed, false);
    assert.strictEqual(token.reason, 'PROVIDER_THROTTLED');

    // Item should be rescheduled with TRANSIENT_RATE_LIMIT
    const refreshed = await WhatsAppOutbox.findByPk(item.id);
    assert.strictEqual(refreshed.status, 'pending');
    assert.strictEqual(refreshed.error_category, 'TRANSIENT_RATE_LIMIT');
    assert.ok(new Date(refreshed.next_attempt_at) > new Date(), 'next_attempt_at must be pushed into future');

    // Reset throttle
    whatsappRateLimiter.resetProviderThrottle();
    mockMetaErrorMode = null;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9: Failure Classification (Transient vs Permanent)
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 9: Failure Classification (Transient vs Permanent)', async () => {
    mockMetaErrorMode = '131026'; // Invalid recipient phone

    const permanentItem = await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '910000000000',
      template_name: 'order_verification_interactive',
      status: 'pending',
      max_attempts: 5,
    });

    const res = await whatsappOutboxQueue.processItem(permanentItem);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.permanent, true, 'Must identify permanent failure');

    const refreshed = await WhatsAppOutbox.findByPk(permanentItem.id);
    assert.strictEqual(refreshed.status, 'failed', 'Permanent failure must immediately be marked failed');
    assert.strictEqual(refreshed.error_category, 'PERMANENT_FAILURE');
    assert.strictEqual(refreshed.attempts, 1, 'Attempts should only increment once');

    mockMetaErrorMode = null;
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 10: Pause Mid-Batch Transmission
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 10: Pause Mid-Batch Transmission', async () => {
    mockMetaCallCount = 0;
    mockMetaErrorMode = null;

    const outboxItem = await WhatsAppOutbox.create({
      id: uuidv4(),
      recipient_phone: '919876543210',
      template_name: 'test_pause_mid_batch',
      status: 'pending',
      next_attempt_at: new Date(Date.now() - 1000),
    });

    // Engage emergency pause
    await emergencyPauseService.setSendingState({
      enabled: false,
      actorUserId: testUser.id,
      initiatedByEmail: testUser.email,
      reason: 'Mid-batch pause test',
    });

    // Queue worker tick
    await whatsappOutboxQueue.processQueue(5);

    // Item must not be sent
    const refreshed = await WhatsAppOutbox.findByPk(outboxItem.id);
    assert.notStrictEqual(refreshed.status, 'sent', 'Item must not be marked sent when paused');
    assert.strictEqual(mockMetaCallCount, 0, 'Zero Meta API calls during mid-batch pause');

    // Resume sending
    await emergencyPauseService.setSendingState({
      enabled: true,
      actorUserId: testUser.id,
      initiatedByEmail: testUser.email,
      reason: 'Resume after mid-batch test',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 11: Database Sliding Window Fallback
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 11: Database Sliding Window Fallback (Resilient when Redis offline)', async () => {
    // Ensure limiter is using database sliding window
    whatsappRateLimiter.isRedisAvailable = false;
    whatsappRateLimiter.localRecentSends = [];
    whatsappRateLimiter.resetProviderThrottle();

    await SystemSetting.upsert({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: '3' });

    // Seed 3 logs sent within the last 30 seconds
    const now = new Date();
    await WhatsAppLog.bulkCreate([
      { id: uuidv4(), phone_number: '919999999991', status: 'sent', sent_at: new Date(now.getTime() - 5000) },
      { id: uuidv4(), phone_number: '919999999992', status: 'sent', sent_at: new Date(now.getTime() - 10000) },
      { id: uuidv4(), phone_number: '919999999993', status: 'sent', sent_at: new Date(now.getTime() - 15000) },
    ]);

    // Next token acquisition must be throttled by database query
    const res = await whatsappRateLimiter.acquireSendToken();
    assert.strictEqual(res.allowed, false, 'Database-backed rate limiter must throttle when minute count hit');
    assert.strictEqual(res.reason, 'RATE_LIMIT_PER_MINUTE');

    // Clean up
    await WhatsAppLog.destroy({ where: {} });
    await SystemSetting.upsert({ key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE', value: '60' });
    whatsappRateLimiter.localRecentSends = [];
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 12: Admin Control Panel REST Endpoints
  // ─────────────────────────────────────────────────────────────────────────
  await test('Test 12: Admin Control Panel REST Endpoints (Status, Config, Audit)', async () => {
    // 1. Test getStatus
    const reqMock = {};
    let statusResponseData = null;
    const resMock = {
      status: (code) => ({
        json: (data) => {
          statusResponseData = { code, data };
        },
      }),
    };

    await WhatsAppRateLimitController.getStatus(reqMock, resMock);
    assert.strictEqual(statusResponseData.code, 200);
    assert.strictEqual(statusResponseData.data.success, true);
    assert.ok(statusResponseData.data.data.rate_limiter, 'Must include rate_limiter metrics');
    assert.ok(statusResponseData.data.data.spend_guard, 'Must include spend_guard metrics');

    // 2. Test updateConfig
    const updateReq = {
      body: {
        messages_per_minute: 45,
        daily_spend_ceiling: 7500.00,
        balance_policy: 'ALLOW_WITH_DAILY_CEILING',
      },
    };
    let updateResponseData = null;
    const updateRes = {
      status: (code) => ({
        json: (data) => {
          updateResponseData = { code, data };
        },
      }),
    };

    await WhatsAppRateLimitController.updateConfig(updateReq, updateRes);
    assert.strictEqual(updateResponseData.code, 200);

    // Verify settings updated in database
    const minuteSetting = await SystemSetting.findOne({ where: { key: 'WHATSAPP_RATE_LIMIT_PER_MINUTE' } });
    assert.strictEqual(minuteSetting.value, '45');
    const ceilingSetting = await SystemSetting.findOne({ where: { key: 'WHATSAPP_DAILY_SPEND_LIMIT' } });
    assert.strictEqual(ceilingSetting.value, '7500.00');

    // 3. Test getAuditLog
    let auditResponseData = null;
    const auditRes = {
      status: (code) => ({
        json: (data) => {
          auditResponseData = { code, data };
        },
      }),
    };

    await WhatsAppRateLimitController.getAuditLog({ query: { page: 1, limit: 10 } }, auditRes);
    assert.strictEqual(auditResponseData.code, 200);
    assert.ok(auditResponseData.data.data.events.length > 0, 'Must return logged rate limit and spend events');
  });

  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log(`  SUITE COMPLETE: ${passedTests} passed, ${failedTests} failed`);
  console.log('───────────────────────────────────────────────────────────────────────\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
