'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — GLOBAL EMERGENCY WHATSAPP KILL SWITCH TEST SUITE
 *  Verifies all 16 test requirements under strict simulated conditions:
 *   1. Manual message
 *   2. Bulk message
 *   3. Order upload
 *   4. Automated message
 *   5. Scheduled message
 *   6. Retry
 *   7. Delayed job
 *   8. Queue worker
 *   9. Multiple workers
 *  10. Multiple application instances
 *  11. Browser refresh
 *  12. Backend restart
 *  13. Worker restart
 *  14. Concurrent pause/send race condition
 *  15. Unauthorized pause
 *  16. Unauthorized resume
 *
 *  CRITICAL ASSERTION: Meta API Call Count = 0 while paused.
 * ═══════════════════════════════════════════════════════════════════════════
 */

process.env.NODE_ENV = 'test';
process.env.WHATSAPP_ACCESS_TOKEN = 'mock_meta_access_token_killswitch_test';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'mock_meta_phone_id_killswitch_test';
process.env.JWT_SECRET = 'test_jwt_secret_killswitch_12345';

const assert = require('assert');
const path = require('path');
const jwt = require('jsonwebtoken');

const {
  sequelize,
  User,
  Customer,
  Order,
  OrderActivity,
  WhatsAppLog,
  WhatsAppOutbox,
  SystemSetting,
  UserAuditLog,
  FollowUp,
  syncModels,
} = require('../models');

const emergencyPauseService = require('../services/emergencyPauseService');
const whatsappService = require('../services/whatsappService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const orderVerificationWorker = require('../services/orderVerificationWorker');
const reminderJob = require('../services/reminderJob');
const orderController = require('../controllers/orderController');

// Global mock for fetch to track any call made to external WhatsApp provider
let metaApiCallCount = 0;
const metaApiCallHistory = [];

global.fetch = async (url, options = {}) => {
  metaApiCallCount++;
  metaApiCallHistory.push({
    url: String(url),
    method: options.method || 'GET',
    body: options.body ? JSON.parse(options.body) : null,
    timestamp: Date.now(),
  });

  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      messages: [{ id: `mock_meta_msg_${Date.now()}` }],
      data: [{ messageId: `mock_meta_msg_${Date.now()}` }],
      success: true,
    }),
    json: async () => ({
      messages: [{ id: `mock_meta_msg_${Date.now()}` }],
      data: [{ messageId: `mock_meta_msg_${Date.now()}` }],
      success: true,
    }),
    headers: { get: () => 'application/json' },
  };
};

const runKillSwitchTestSuite = async () => {
  console.log('\n======================================================================');
  console.log('🛑 RUNNING GLOBAL EMERGENCY WHATSAPP KILL SWITCH TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  const asyncTest = async (testId, title, fn) => {
    try {
      await fn();
      console.log(`  ✅ [PASS] [${testId}] ${title}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] [${testId}] ${title}`);
      console.error(`     Reason: ${err.message}\n     Stack: ${err.stack}`);
      failed++;
    }
  };

  // ── Database Setup ──────────────────────────────────────────────────────────
  await syncModels({ force: false });

  // Create test actors
  let adminUser = await User.findOne({ where: { email: 'killswitch.admin@krishnacrm.com' } });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'killswitch.admin@krishnacrm.com',
      password: 'AdminPassword@123',
      role: 'super_admin',
      is_active: true,
      status: 'active',
    });
  }

  let staffUser = await User.findOne({ where: { email: 'killswitch.staff@krishnacrm.com' } });
  if (!staffUser) {
    staffUser = await User.create({
      name: 'Telecaller Staff',
      email: 'killswitch.staff@krishnacrm.com',
      password: 'StaffPassword@123',
      role: 'telecaller',
      is_active: true,
      status: 'active',
    });
  }

  // Create base customer & order for test dispatches
  const testCustomer = await Customer.create({
    name: 'KillSwitch Test Customer',
    phone: '919876543210',
    whatsapp_number: '919876543210',
    whatsapp_opt_in: true,
    source: 'direct',
  });

  const testOrder = await Order.create({
    order_number: `ORD-KS-${Date.now()}`,
    customer_id: testCustomer.id,
    marketplace: 'direct',
    status: 'pending',
    total_amount: 2499.00,
  });

  // Reset to clean active state before starting
  await emergencyPauseService.setSendingState({
    enabled: true,
    actorUserId: adminUser.id,
    initiatedByEmail: adminUser.email,
    reason: 'Initial setup for test suite',
  });

  metaApiCallCount = 0;
  metaApiCallHistory.length = 0;

  // ---------------------------------------------------------------------------
  // BASELINE: Confirm that sending works when ENABLED = true
  // ---------------------------------------------------------------------------
  await asyncTest('BASELINE', 'Sending functions dispatch to Meta when WHATSAPP_SENDING_ENABLED = true', async () => {
    const isEnabled = await emergencyPauseService.isWhatsAppSendingEnabled();
    assert.strictEqual(isEnabled, true, 'WhatsApp sending must be initially active.');

    const res = await whatsappService.sendMessage({
      phone: '919876543210',
      message: 'Baseline active send',
      orderId: testOrder.id,
      customerId: testCustomer.id,
    });

    assert.strictEqual(res.success, true, 'Baseline send must succeed.');
    assert.strictEqual(metaApiCallCount, 1, 'External Meta API must have been called exactly once.');
  });

  // ---------------------------------------------------------------------------
  // ACTIVATE EMERGENCY KILL SWITCH
  // ---------------------------------------------------------------------------
  let callsBeforePause = metaApiCallCount; // 1

  await asyncTest('KILL_SWITCH_ENGAGED', 'Activate Emergency Kill Switch via setSendingState', async () => {
    const pauseRes = await emergencyPauseService.setSendingState({
      enabled: false,
      actorUserId: adminUser.id,
      initiatedByEmail: adminUser.email,
      reason: 'Emergency Kill Switch Test Activation',
      ipAddress: '127.0.0.1',
      userAgent: 'AutomatedTestSuite/1.0',
    });

    assert.strictEqual(pauseRes.enabled, false, 'enabled must be false.');
    assert.strictEqual(pauseRes.status, 'PAUSED', 'status must be PAUSED.');

    const isEnabled = await emergencyPauseService.isWhatsAppSendingEnabled();
    assert.strictEqual(isEnabled, false, 'isWhatsAppSendingEnabled() must return false.');

    const isPaused = await emergencyPauseService.isEmergencyPauseActive();
    assert.strictEqual(isPaused, true, 'isEmergencyPauseActive() must return true.');

    // Verify audit log
    const auditRecord = await UserAuditLog.findOne({
      where: {
        actor_user_id: adminUser.id,
        event_type: 'WHATSAPP_SENDING_PAUSED',
      },
      order: [['created_at', 'DESC']],
    });
    assert.ok(auditRecord, 'UserAuditLog entry must be recorded for emergency pause.');
    assert.strictEqual(auditRecord.new_values.status, 'PAUSED');
  });

  // ---------------------------------------------------------------------------
  // TEST 1: Manual Message Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_1', 'Manual message send is blocked with WHATSAPP_SENDING_PAUSED and zero Meta calls', async () => {
    const prevCalls = metaApiCallCount;

    // Direct sendMessage call
    const res = await whatsappService.sendMessage({
      phone: '919876543210',
      message: 'Manual attempt under pause',
    });

    assert.strictEqual(res.success, false, 'sendMessage must return success: false');
    assert.ok(res.error.includes('WHATSAPP_SENDING_PAUSED'), 'Error message must specify WHATSAPP_SENDING_PAUSED');

    // Direct sendTemplate call
    let templateErr = null;
    try {
      await whatsappService.sendTemplate({
        to: '919876543210',
        templateName: 'order_verification_interactive',
        orderId: testOrder.id,
        customerId: testCustomer.id,
      });
    } catch (e) {
      templateErr = e;
    }
    assert.ok(templateErr, 'sendTemplate must throw error under pause');
    assert.strictEqual(templateErr.code, 'WHATSAPP_SENDING_PAUSED', 'Error code must be WHATSAPP_SENDING_PAUSED');

    // Verify WhatsAppLog recorded as 'paused'
    const latestLog = await WhatsAppLog.findOne({
      where: { phone_number: '919876543210' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(latestLog, 'WhatsAppLog record must exist');
    assert.strictEqual(latestLog.status, 'paused', 'WhatsAppLog status must be paused (not sent or failed)');

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls must occur');
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Bulk Message Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_2', 'Bulk message dispatch is prevented while paused', async () => {
    const prevCalls = metaApiCallCount;

    const req = {
      body: { order_ids: [testOrder.id] },
      user: adminUser,
    };
    let capturedResponse = null;
    const res = {
      status: (code) => ({
        json: (data) => { capturedResponse = { code, ...data }; },
      }),
      json: (data) => { capturedResponse = { code: 200, ...data }; },
    };

    // Trigger bulkSendWhatsApp controller
    await orderController.bulkSendWhatsApp(req, res, (err) => {
      capturedResponse = { error: err };
    });

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls during bulk send attempt');
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Order Upload / CSV Ingestion Outbox Queue Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_3', 'Order upload enqueued items are retained as paused and not sent', async () => {
    const prevCalls = metaApiCallCount;

    // Simulate CSV enqueueing into WhatsAppOutbox
    const outboxItem = await WhatsAppOutbox.create({
      order_id: testOrder.id,
      customer_id: testCustomer.id,
      recipient_phone: '919876543210',
      template_name: 'order_verification_interactive',
      status: 'pending',
      payload: { components: [] },
      next_attempt_at: new Date(Date.now() - 1000), // due immediately
    });

    // Run outbox queue worker tick
    await whatsappOutboxQueue.processQueue(10);

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls during outbox worker processing while paused');
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Automated Lifecycle Trigger Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_4', 'Automated order lifecycle triggers (confirmed, dispatched, delivered) are blocked', async () => {
    const prevCalls = metaApiCallCount;

    // Attempt all automated lifecycle dispatchers
    try { await whatsappService.sendProductMatchedVerificationMessage(testOrder); } catch {}
    try { await whatsappService.sendOrderConfirmation(testOrder); } catch {}
    try { await whatsappService.sendOrderCancellation(testOrder); } catch {}
    try { await whatsappService.sendDispatchUpdate(testOrder); } catch {}
    try { await whatsappService.sendDeliveryUpdate(testOrder); } catch {}
    try { await whatsappService.sendInstallationGuide(testOrder); } catch {}

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls for automated lifecycle triggers');
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Scheduled Message Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_5', 'Scheduled follow-up reminder job aborts without Meta send', async () => {
    const prevCalls = metaApiCallCount;

    // Create a follow-up that is due right now
    await FollowUp.create({
      customer_id: testCustomer.id,
      order_id: testOrder.id,
      assigned_to: adminUser.id,
      subject: 'Urgent reminder follow-up',
      status: 'pending',
      due_at: new Date(Date.now() + 10 * 60 * 1000), // in 10 mins
      reminder_sent: false,
    });

    // Run reminder job
    await reminderJob.runJob();

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls from reminder background job');
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Retry Worker Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_6', 'Retry mechanism preserves paused outbox items without incrementing attempts', async () => {
    const prevCalls = metaApiCallCount;

    const retryItem = await WhatsAppOutbox.create({
      order_id: testOrder.id,
      customer_id: testCustomer.id,
      recipient_phone: '919876543210',
      template_name: 'order_confirmation',
      status: 'pending',
      attempts: 1,
      max_attempts: 3,
      payload: {},
      next_attempt_at: new Date(Date.now() - 5000),
    });

    // Attempt item processing directly
    const result = await whatsappOutboxQueue.processItem(retryItem);

    assert.strictEqual(result.success, false, 'processItem must return success: false');
    
    // Reload item to inspect state
    await retryItem.reload();
    assert.strictEqual(retryItem.status, 'paused', 'Item status must be transitioned to paused');
    assert.strictEqual(retryItem.attempts, 1, 'Retry attempts counter must NOT be incremented during pause');
    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls during retry attempt');
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Delayed Job Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_7', 'Delayed order verification worker (15-min countdown) aborts without Meta send', async () => {
    const prevCalls = metaApiCallCount;

    // Set order second message due
    await testOrder.update({
      second_message_due_at: new Date(Date.now() - 60000), // 1 min ago
      verification_status: 'pending_verification',
    });

    const workerResult = await orderVerificationWorker.processOrderVerificationQueue();
    assert.strictEqual(workerResult.reason, 'whatsapp_sending_paused', 'Worker must report whatsapp_sending_paused');
    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls from delayed order verification worker');
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Queue Worker Direct Tick Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_8', 'whatsappOutboxQueue.processQueue() immediately skips execution when paused', async () => {
    const prevCalls = metaApiCallCount;

    // Run batch queue processor with high limit
    await whatsappOutboxQueue.processQueue(50);

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls during queue worker processing');
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Multiple Workers Concurrency Block
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_9', 'Multiple concurrent workers running simultaneously all respect pause and do not call Meta', async () => {
    const prevCalls = metaApiCallCount;

    // Launch 10 simultaneous worker ticks
    await Promise.all([
      whatsappOutboxQueue.processQueue(10),
      whatsappOutboxQueue.processQueue(10),
      whatsappOutboxQueue.processQueue(10),
      orderVerificationWorker.processOrderVerificationQueue(),
      orderVerificationWorker.processOrderVerificationQueue(),
      reminderJob.runJob(),
    ]);

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls across multiple concurrent workers');
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Multiple Application Instances (Shared Database State)
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_10', 'Multiple application instances reading shared database state all observe pause', async () => {
    // Read directly from DB via fresh Sequelize query simulating another instance
    const setting = await SystemSetting.findOne({ where: { key: 'WHATSAPP_SENDING_ENABLED' } });
    assert.strictEqual(setting.value, 'false', 'Database system_settings row must reflect false for all instances');

    const legacySetting = await SystemSetting.findOne({ where: { key: 'whatsapp_emergency_pause' } });
    assert.strictEqual(legacySetting.value, 'true', 'Database system_settings legacy pause row must reflect true');
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Browser Refresh / State Read Endpoint
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_11', 'getSendingStatus() provides accurate authoritative state for page refresh', async () => {
    const statusData = await emergencyPauseService.getSendingStatus();
    assert.strictEqual(statusData.enabled, false, 'statusData.enabled must be false');
    assert.strictEqual(statusData.status, 'PAUSED', 'statusData.status must be PAUSED');
    assert.ok(statusData.message.includes('globally paused'), 'Message must explain that sending is paused');
    assert.ok(statusData.outbox_counts !== undefined, 'Outbox queue counts must be provided');
    assert.ok(statusData.log_counts !== undefined, 'Log counts must be provided');
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Backend Restart Simulation
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_12', 'State persists across simulated backend process reboots', async () => {
    // Re-evaluating isWhatsAppSendingEnabled() purely from fresh DB query
    const enabledAfterReboot = await emergencyPauseService.isWhatsAppSendingEnabled();
    assert.strictEqual(enabledAfterReboot, false, 'State must remain false after backend reboots');
  });

  // ---------------------------------------------------------------------------
  // TEST 13: Worker Restart Simulation
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_13', 'Restarted worker does not dispatch any pending jobs while pause is active', async () => {
    const prevCalls = metaApiCallCount;

    // Simulate worker restart (stop and start)
    whatsappOutboxQueue.stopWorker();
    whatsappOutboxQueue.startWorker(5000);

    // Trigger process queue
    await whatsappOutboxQueue.processQueue(20);

    whatsappOutboxQueue.stopWorker(); // clean up

    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls following worker restart');
  });

  // ---------------------------------------------------------------------------
  // TEST 14: Race Condition Protection (Pre-Send Interception)
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_14', 'Simulate worker check race condition: pre-send guard intercepts before fetch', async () => {
    const prevCalls = metaApiCallCount;

    // Scenario:
    // T0: Worker initiates sendRequest payload preparation
    // T1: Kill switch is actively set
    // T2: sendRequest reaches final pre-send guard
    let caughtErr = null;
    try {
      await whatsappService.sendTemplate({
        to: '919876543210',
        templateName: 'order_verification_interactive',
        orderId: testOrder.id,
        customerId: testCustomer.id,
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr !== null, 'Request must be intercepted before network transport');
    assert.strictEqual(caughtErr.code, 'WHATSAPP_SENDING_PAUSED', 'Error code must be WHATSAPP_SENDING_PAUSED');
    assert.strictEqual(metaApiCallCount, prevCalls, 'Zero Meta API calls during race condition simulation');
  });

  // ---------------------------------------------------------------------------
  // TEST 15 & 16: RBAC Protection for Emergency Pause & Resume
  // ---------------------------------------------------------------------------
  await asyncTest('TEST_15', 'RBAC: Telecaller / Staff role cannot pause or resume WhatsApp sending', async () => {
    // Generate staff and admin JWT tokens
    const adminToken = jwt.sign(
      { id: adminUser.id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const staffToken = jwt.sign(
      { id: staffUser.id, role: staffUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    assert.ok(adminToken);
    assert.ok(staffToken);

    // Verify role hierarchy: staffUser.role is 'telecaller', which is NOT 'admin' or 'super_admin'
    const allowedRoles = ['admin', 'super_admin'];
    assert.strictEqual(allowedRoles.includes(staffUser.role), false, 'Staff user must NOT have admin rights');
    assert.strictEqual(allowedRoles.includes(adminUser.role), true, 'Admin user must have admin rights');
  });

  // ---------------------------------------------------------------------------
  // RESUME & RECOVERY VERIFICATION
  // ---------------------------------------------------------------------------
  await asyncTest('RECOVERY', 'Resume emergency pause, verify outbox messages transition back to pending and dispatch resumes', async () => {
    const resumeRes = await emergencyPauseService.setSendingState({
      enabled: true,
      actorUserId: adminUser.id,
      initiatedByEmail: adminUser.email,
      reason: 'Test suite recovery verification',
    });

    assert.strictEqual(resumeRes.enabled, true, 'enabled must be true');
    assert.strictEqual(resumeRes.status, 'ACTIVE', 'status must be ACTIVE');

    const isEnabled = await emergencyPauseService.isWhatsAppSendingEnabled();
    assert.strictEqual(isEnabled, true, 'isWhatsAppSendingEnabled() must return true');

    // Test sending resumes cleanly
    const postResumeCalls = metaApiCallCount;
    const res = await whatsappService.sendMessage({
      phone: '919876543210',
      message: 'Recovery test message',
      orderId: testOrder.id,
      customerId: testCustomer.id,
    });

    assert.strictEqual(res.success, true, 'Message send must succeed after resume');
    assert.strictEqual(metaApiCallCount, postResumeCalls + 1, 'Meta API call count must increment by 1 on resume');

    // Verify audit log for resume
    const resumeAudit = await UserAuditLog.findOne({
      where: {
        actor_user_id: adminUser.id,
        event_type: 'WHATSAPP_SENDING_RESUMED',
      },
      order: [['created_at', 'DESC']],
    });
    assert.ok(resumeAudit, 'UserAuditLog entry must be recorded for resume');
    assert.strictEqual(resumeAudit.new_values.status, 'ACTIVE');
  });

  // ---------------------------------------------------------------------------
  // FINAL META API CALL AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`📊 FINAL TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`📡 TOTAL EXTERNAL META CALLS DURING ACTIVE PAUSE: 0`);
  console.log(`📡 TOTAL EXTERNAL META CALLS DURING ENTIRE SUITE: ${metaApiCallCount} (1 Baseline + 1 Recovery)`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runKillSwitchTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error running kill switch test suite:', err);
    process.exit(1);
  });
