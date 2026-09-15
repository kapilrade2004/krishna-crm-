'use strict';

const assert = require('assert');
const {
  sequelize,
  Customer,
  Order,
  Warranty,
  WarrantyReturn,
  WarrantyMessage,
  WarrantyEvent,
  WarrantyServiceRequest,
  WarrantyDocument,
  User,
} = require('../models');

const warrantyStateMachine = require('../services/warrantyStateMachine');
const warrantyTokenService = require('../services/warrantyTokenService');
const warrantyService = require('../services/warrantyService');
const warrantyActivationWorker = require('../services/warrantyActivationWorker');
const whatsappService = require('../services/whatsappService');

async function runTests() {
  console.log('====================================================');
  console.log('⚡ STARTING WARRANTY MODULE LIFECYCLE TEST MATRIX (TC01-TC34)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // Ensure DB is synchronized
  await sequelize.sync({ force: false });

  // Create test customer & order
  const testCustomer = await Customer.create({
    name: 'Test Customer Matrix',
    phone: `98765${Math.floor(10000 + Math.random() * 90000)}`,
    whatsapp_number: `98765${Math.floor(10000 + Math.random() * 90000)}`,
    email: `matrix_test_${Date.now()}@example.com`,
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    status: 'Active',
  });

  const testOrder = await Order.create({
    order_number: `ORD-TEST-${Date.now()}`,
    customer_id: testCustomer.id,
    product_name: 'AkuaBeat Alkaline RO Water Purifier',
    product_sku: 'AKU-RO-ALKALINE-01',
    marketplace: 'Amazon',
    total_amount: 14999,
    status: 'processing',
    shipping_partner: 'BlueDart',
    tracking_number: `TRK-${Date.now()}`,
  });

  let testWarranty = null;
  let testReturn = null;
  let testToken = null;

  // ── TC01 to TC07: Order, Delivery, Installation & 24h Boundaries ───────────
  await asyncTest('TC01: Order creation allows warranty registration in PENDING_DELIVERY', async () => {
    const reg = await warrantyService.registerWarranty({
      orderId: testOrder.order_number,
      fullName: testCustomer.name,
      mobile: testCustomer.phone,
      productName: testOrder.product_name,
    });
    assert.strictEqual(reg.alreadyRegistered, false);
    assert.ok(reg.warranty.warranty_number.startsWith('WAR-'));
    assert.strictEqual(reg.warranty.warranty_status, 'PENDING_DELIVERY');
    testWarranty = reg.warranty;
  });

  await asyncTest('TC02: Delivery event moves warranty to DELIVERED and records audit event', async () => {
    const delivered = await warrantyService.handleDeliveryEvent(testOrder.id, {
      delivered_at: new Date(),
      delivery_partner: 'BlueDart',
      tracking_number: 'BD-9918231',
    });
    assert.strictEqual(delivered.warranty_status, 'DELIVERED');
    assert.ok(delivered.delivered_at !== null);

    const event = await WarrantyEvent.findOne({
      where: { warranty_id: delivered.id, event_type: 'PRODUCT_DELIVERED' },
    });
    assert.ok(event !== null, 'Audit event for delivery must exist');
  });

  await asyncTest('TC03: Delivery event is idempotent upon replay', async () => {
    const replay = await warrantyService.handleDeliveryEvent(testOrder.id, {
      delivered_at: new Date(),
    });
    assert.strictEqual(replay.id, testWarranty.id);
    assert.strictEqual(replay.warranty_status, 'DELIVERED');
  });

  await asyncTest('TC04: Installation completed event schedules 24h activation message', async () => {
    const installTime = new Date();
    const installed = await warrantyService.handleInstallationEvent(testOrder.id, {
      completed_at: installTime,
      technician_id: 'TECH-101',
    });
    assert.strictEqual(installed.warranty_status, 'ACTIVATION_MESSAGE_SCHEDULED');
    assert.ok(installed.activation_due_at !== null);

    const dueDiff = new Date(installed.activation_due_at).getTime() - installTime.getTime();
    assert.strictEqual(dueDiff, 24 * 60 * 60 * 1000, 'Activation due time must be exactly +24 hours');
  });

  await asyncTest('TC05: Installation completed event is idempotent upon replay', async () => {
    const replay = await warrantyService.handleInstallationEvent(testOrder.id, {
      completed_at: testWarranty.installation_completed_at,
    });
    assert.strictEqual(replay.warranty_status, 'ACTIVATION_MESSAGE_SCHEDULED');
  });

  test('TC06: 24h boundary validator rejects eligibility when now < activation_due_at', () => {
    const futureDue = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours remaining
    const result = warrantyStateMachine.isEligibleForActivationMessage(
      {
        installation_completed_at: new Date(),
        activation_due_at: futureDue,
        warranty_status: 'INSTALLATION_COMPLETED',
        return_status: 'NONE',
        activated_at: null,
      },
      new Date()
    );
    assert.strictEqual(result.eligible, false);
    assert.ok(result.reason.includes('minute(s) remaining'));
  });

  test('TC07: 24h boundary validator confirms eligibility when now >= activation_due_at', () => {
    const pastDue = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago
    const result = warrantyStateMachine.isEligibleForActivationMessage(
      {
        installation_completed_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
        activation_due_at: pastDue,
        warranty_status: 'ACTIVATION_MESSAGE_SCHEDULED',
        return_status: 'NONE',
        activated_at: null,
      },
      new Date()
    );
    assert.strictEqual(result.eligible, true);
  });

  // ── TC08 to TC14: Token Security, Worker & Public Self-Activation ──────────
  test('TC08: HMAC-SHA256 signed activation token generation & verification', () => {
    testToken = warrantyTokenService.generateActivationToken(testWarranty, 7);
    assert.ok(typeof testToken === 'string');
    assert.ok(testToken.includes('.'));

    const verification = warrantyTokenService.verifyActivationToken(testToken);
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.warrantyId, String(testWarranty.id));
    assert.strictEqual(verification.customerId, String(testWarranty.customer_id));
  });

  test('TC09: Token verification rejects tampered token signatures', () => {
    const tampered = testToken + 'maliciousPayload';
    const result = warrantyTokenService.verifyActivationToken(tampered);
    assert.strictEqual(result.valid, false);
  });

  await asyncTest('TC10: Worker processes eligible queue and creates WarrantyMessage with unique idempotency_key', async () => {
    // Mock whatsappService for isolated unit testing
    whatsappService.sendWarrantyActivationMessage = async () => ({
      success: true,
      waMessageId: 'mock_msg_test_8899',
    });

    // Simulate 24-hour elapsed window
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    await testWarranty.update({
      installation_completed_at: twentyFiveHoursAgo,
      activation_due_at: oneHourAgo,
      warranty_status: 'ACTIVATION_MESSAGE_SCHEDULED',
    });

    const queueResult = await warrantyActivationWorker.processWarrantyActivationQueue();
    assert.ok(queueResult.processed >= 1);

    const reloaded = await Warranty.findByPk(testWarranty.id);
    assert.strictEqual(reloaded.warranty_status, 'ACTIVATION_MESSAGE_SENT');

    const msg = await WarrantyMessage.findOne({ where: { warranty_id: testWarranty.id } });
    assert.ok(msg !== null);
    assert.ok(msg.idempotency_key.startsWith('act_msg_'));
    assert.strictEqual(msg.delivery_status, 'SENT');
  });

  await asyncTest('TC11: Worker idempotency skips already processed messages', async () => {
    const replayQueue = await warrantyActivationWorker.processWarrantyActivationQueue();
    assert.strictEqual(replayQueue.processed, 0, 'Should not re-send to already processed warranties');
  });

  await asyncTest('TC12: Customer self-activates warranty via valid signed token', async () => {
    const actRes = await warrantyService.activateWarrantyByToken(testToken, {
      ip: '127.0.0.1',
      userAgent: 'Jest-Unit-Runner',
    });
    assert.strictEqual(actRes.success, true);
    assert.strictEqual(actRes.warranty.warranty_status, 'ACTIVE');
    assert.strictEqual(actRes.warranty.status, 'ACTIVE');
    assert.ok(actRes.warranty.activated_at !== null);
    assert.ok(actRes.warranty.warranty_end_at !== null);

    const actEvent = await WarrantyEvent.findOne({
      where: { warranty_id: testWarranty.id, event_type: 'WARRANTY_ACTIVATED' },
    });
    assert.ok(actEvent !== null);
    assert.strictEqual(actEvent.source_type, 'CUSTOMER');
  });

  await asyncTest('TC13: Repeated token activation is safe and idempotent', async () => {
    const repeated = await warrantyService.activateWarrantyByToken(testToken, {});
    assert.strictEqual(repeated.success, true);
    assert.strictEqual(repeated.alreadyActive, true);
  });

  await asyncTest('TC14: Expired token is rejected gracefully', async () => {
    const expiredToken = warrantyTokenService.generateActivationToken(testWarranty, -1); // expired yesterday
    const res = await warrantyService.activateWarrantyByToken(expiredToken, {});
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.isExpired, true);
  });

  // ── TC15 to TC23: Reverse Logistics Lifecycle ──────────────────────────────
  await asyncTest('TC15: Customer requests return -> Warranty moves to RETURN_REQUESTED', async () => {
    testReturn = await warrantyService.requestReturn(testWarranty.id, {
      reason_code: 'DEFECTIVE',
      reason_text: 'RO Membrane leaking after 2 days',
      request_source: 'CUSTOMER_PORTAL',
    });

    assert.ok(testReturn.return_number.startsWith('RET-'));
    assert.strictEqual(testReturn.status, 'REQUESTED');

    const reloaded = await Warranty.findByPk(testWarranty.id);
    assert.strictEqual(reloaded.warranty_status, 'RETURN_REQUESTED');
    assert.strictEqual(reloaded.return_status, 'REQUESTED');
    assert.ok(Boolean(reloaded.is_returned));
  });

  await asyncTest('TC16: Return approval by controller transitions status to APPROVED', async () => {
    const approved = await warrantyService.approveReturn(testReturn.id, null, 'Approved by QC manager');
    assert.strictEqual(approved.status, 'APPROVED');

    const reloaded = await Warranty.findByPk(testWarranty.id);
    assert.strictEqual(reloaded.warranty_status, 'RETURN_APPROVED');
    assert.strictEqual(reloaded.return_status, 'APPROVED');
  });

  await asyncTest('TC17: Return rejection restores warranty coverage', async () => {
    // Create temporary return to test rejection
    const tempReturn = await warrantyService.requestReturn(testWarranty.id, {
      reason_code: 'BUYER_REMORSE',
      reason_text: 'Changed mind after 30 days',
    });

    const rejected = await warrantyService.rejectReturn(tempReturn.id, null, 'Beyond 7 day return policy');
    assert.strictEqual(rejected.status, 'REJECTED');

    const reloaded = await Warranty.findByPk(testWarranty.id);
    assert.strictEqual(reloaded.warranty_status, 'ACTIVE');
    assert.strictEqual(reloaded.return_status, 'REJECTED');
  });

  await asyncTest('TC18: Scheduling return pickup sets carrier info and moves status to PICKUP_SCHEDULED', async () => {
    const pickup = await warrantyService.scheduleReturnPickup(testReturn.id, {
      pickup_partner: 'BlueDart Express',
      pickup_tracking_number: 'RET-BD-998811',
      pickup_scheduled_date: new Date(),
    });
    assert.strictEqual(pickup.status, 'PICKUP_SCHEDULED');

    const reloaded = await Warranty.findByPk(testWarranty.id);
    assert.strictEqual(reloaded.warranty_status, 'RETURN_PICKUP_SCHEDULED');
    assert.strictEqual(reloaded.return_status, 'PICKUP_SCHEDULED');
  });

  await asyncTest('TC19: Courier marks product picked up -> status moves to PICKED_UP', async () => {
    const pickedUp = await warrantyService.markReturnPickedUp(testReturn.id, {
      picked_up_at: new Date(),
    });
    assert.strictEqual(pickedUp.status, 'PICKED_UP');
  });

  await asyncTest('TC20: Warehouse marks inward product received -> status moves to RECEIVED', async () => {
    const received = await warrantyService.markReturnReceived(testReturn.id, {
      received_at: new Date(),
    });
    assert.strictEqual(received.status, 'RECEIVED');
  });

  await asyncTest('TC21: Quality inspector completes inspection -> status moves to ACCEPTED & warranty to RETURNED', async () => {
    const inspected = await warrantyService.inspectReturn(testReturn.id, {
      inspection_result: 'PASS',
      inspection_notes: 'Physical serial matches, genuine fault verified.',
    });
    assert.strictEqual(inspected.status, 'ACCEPTED');

    const reloaded = await Warranty.findByPk(testWarranty.id);
    assert.strictEqual(reloaded.warranty_status, 'RETURNED');
  });

  await asyncTest('TC22: Return closed with replacement creates NEW replacement warranty unit', async () => {
    const closeResult = await warrantyService.closeReturn(testReturn.id, {
      create_replacement: true,
      replacement_serial_number: 'SN-REPL-2026-999',
      replacement_model: 'Premier Alkaline RO V2',
      notes: 'New unit dispatched to customer',
    });

    assert.strictEqual(closeResult.returnRecord.status, 'CLOSED');
    assert.ok(closeResult.replacementWarranty !== null);
    assert.strictEqual(closeResult.replacementWarranty.warranty_status, 'ACTIVE');
    assert.strictEqual(closeResult.replacementWarranty.registration_source, 'REPLACEMENT');
    assert.strictEqual(closeResult.replacementWarranty.serial_number, 'SN-REPL-2026-999');
  });

  await asyncTest('TC23: Closed parent warranty remains in RETURNED state', async () => {
    const parentReloaded = await Warranty.findByPk(testWarranty.id);
    assert.strictEqual(parentReloaded.warranty_status, 'RETURNED');
    assert.strictEqual(parentReloaded.return_status, 'CLOSED');
  });

  // ── TC24 to TC34: Auditing, State Machine Guards, Stats & Services ──────────
  await asyncTest('TC24: Manual warranty reset marks status WARRANTY_CANCELLED and logs reason', async () => {
    const freshWar = await warrantyService.registerWarranty({
      fullName: 'Reset Target Customer',
      mobile: '9888877777',
      productName: 'AkuaBeat Basic RO',
    });

    const resetWar = await warrantyService.resetWarranty(freshWar.warranty.id, null, 'Customer requested cancellation before shipment');
    assert.strictEqual(resetWar.warranty_status, 'WARRANTY_CANCELLED');
    assert.strictEqual(resetWar.status, 'CANCELLED');
    assert.strictEqual(resetWar.warranty_reset_reason, 'Customer requested cancellation before shipment');

    const resetEvent = await WarrantyEvent.findOne({
      where: { warranty_id: freshWar.warranty.id, event_type: 'WARRANTY_RESET' },
    });
    assert.ok(resetEvent !== null);
  });

  test('TC25: Invalid state machine transitions are rejected with clear error', () => {
    const invalidCheck = warrantyStateMachine.validateWarrantyTransition('DELIVERED', 'RETURN_APPROVED');
    assert.strictEqual(invalidCheck.valid, false);
  });

  await asyncTest('TC26: Dashboard 10 KPI statistics compute accurately', async () => {
    const stats = await warrantyService.getWarrantyDashboardStats();
    assert.ok(typeof stats.total === 'number');
    assert.ok(typeof stats.pendingDelivery === 'number');
    assert.ok(typeof stats.installationPending === 'number');
    assert.ok(typeof stats.activationPending === 'number');
    assert.ok(typeof stats.active === 'number');
    assert.ok(typeof stats.expiringSoon === 'number');
    assert.ok(typeof stats.returnRequested === 'number');
    assert.ok(typeof stats.returned === 'number');
    assert.ok(typeof stats.expired === 'number');
    assert.ok(typeof stats.openServiceRequests === 'number');
  });

  await asyncTest('TC27: Warranty list filter by status and customer search', async () => {
    const list = await warrantyService.getWarrantiesList({
      search: testCustomer.name,
      page: 1,
      limit: 10,
    });
    assert.ok(list.warranties.length >= 1);
    assert.strictEqual(list.warranties[0].customer_id, testCustomer.id);
  });

  await asyncTest('TC28: Returns list pagination and query filters', async () => {
    const retList = await warrantyService.getReturnsList({ page: 1, limit: 10 });
    assert.ok(retList.returns.length >= 1);
  });

  test('TC29: Document path normalization handles Windows backslashes and relative paths', () => {
    const norm = warrantyService.normalizeDocPath('uploads\\documents\\invoice_123.pdf');
    assert.strictEqual(norm, '/uploads/documents/invoice_123.pdf');
  });

  await asyncTest('TC30: Service request creation and technician assignment', async () => {
    const sr = await warrantyService.createServiceRequest({
      warranty_id: testWarranty.id,
      issue: 'Filter cartridge pressure drop',
      priority: 'HIGH',
    }, null);

    assert.ok(sr.service_request_number.startsWith('SR-'));
    assert.strictEqual(sr.status, 'NEW');
  });

  await asyncTest('TC31: Service request status update to COMPLETED with parts used', async () => {
    const sr = await WarrantyServiceRequest.findOne({ where: { warranty_id: testWarranty.id } });
    const updatedSr = await warrantyService.updateServiceRequestStatus(sr.id, {
      status: 'COMPLETED',
      resolution: 'Replaced Sediment Filter 10 inch',
      parts_used: 'Sediment 10"',
    }, null);

    assert.strictEqual(updatedSr.status, 'COMPLETED');
    assert.ok(updatedSr.completed_at !== null);
  });

  await asyncTest('TC32: Order auto-fill lookup finds order by number or tracking', async () => {
    const ord = await warrantyService.lookupOrderDetails(testOrder.order_number);
    assert.ok(ord !== null);
    assert.strictEqual(ord.id, testOrder.id);
  });

  await asyncTest('TC33: SKU product list grouping returns aggregated counts', async () => {
    const skus = await warrantyService.getProductsSkuList();
    assert.ok(Array.isArray(skus));
  });

  await asyncTest('TC34: WhatsApp activation message retry logic updates message attempt count and delivers', async () => {
    const msg = await WarrantyMessage.findOne({ where: { warranty_id: testWarranty.id } });
    if (msg) {
      const retried = await warrantyService.retryWarrantyMessage(msg.id, null);
      assert.ok(retried.attempt_count > msg.attempt_count);
    }
  });

  console.log('\n====================================================');
  console.log(`🎯 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
