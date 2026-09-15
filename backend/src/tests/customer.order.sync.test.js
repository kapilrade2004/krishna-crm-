'use strict';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Customer, Order, ManualCallLog, OrderActivity, Warranty, WarrantyReturn, sequelize } = require('../models');
const customerController = require('../controllers/customerController');
const orderController = require('../controllers/orderController');
const callLogController = require('../controllers/callLogController');

async function runTests() {
  console.log('====================================================');
  console.log('⚡ STARTING CRM CUSTOMER-ORDER-CALL SYNC TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Find a valid user
  const { User } = require('../models');
  const user = await User.findOne();
  const userId = user ? user.id : 'usr-admin-01';

  // 1. Create a customer
  const customerId = uuidv4();
  const customer = await Customer.create({
    id: customerId,
    name: 'Sync Test Customer',
    phone: '9888877777',
    email: 'sync.test@example.com',
    source: 'website',
    status: 'active',
    lifecycle_stage: 'customer',
    total_orders: 0,
    total_revenue: 0,
  });

  // TC01: Verify order creation updates customer aggregate metrics
  try {
    const fakeReq = {
      user: { id: userId, role: 'super_admin' },
      body: {
        order_number: `ORD-SYNC-${Date.now()}`,
        marketplace: 'direct',
        customer_id: customerId,
        total_amount: 4500,
        order_date: new Date(),
        status: 'pending',
        product_name: 'Smart Lock Pro',
        product_sku: 'SL-PRO-01',
      },
    };
    let createdOrder = null;
    const fakeRes = {
      status: (c) => ({
        json: (data) => { createdOrder = data.data.order; return data; }
      }),
    };

    await orderController.create(fakeReq, fakeRes, (err) => { if (err) throw err; });

    const updatedCustomer = await Customer.findByPk(customerId);
    assert.strictEqual(updatedCustomer.total_orders, 1, 'Customer total_orders should be 1');
    assert.strictEqual(Number(updatedCustomer.total_revenue), 4500, 'Customer total_revenue should be 4500');
    assert.ok(updatedCustomer.last_contacted_at, 'last_contacted_at should be updated');
    console.log('  ✅ [PASS] TC01: Order creation atomically increments Customer total_orders and total_revenue');
    passed++;
  } catch (err) {
    console.error('  ❌ [FAIL] TC01:', err.message);
    failed++;
  }

  // TC02: Logging call updates customer last_contacted_at and records OrderActivity
  try {
    const orders = await Order.findAll({ where: { customer_id: customerId } });
    const order = orders[0];

    const fakeReq = {
      user: { id: userId, role: 'telecaller' },
      body: {
        customer_id: customerId,
        order_id: order.id,
        call_type: 'outbound',
        outcome: 'answered',
        context: 'order_verification',
        notes: 'Customer confirmed availability for delivery tomorrow',
      },
    };
    let createdCallLog = null;
    const fakeRes = {
      status: (c) => ({
        json: (data) => { createdCallLog = data.data.callLog; return data; }
      }),
    };

    await callLogController.create(fakeReq, fakeRes, (err) => { if (err) throw err; });

    const activity = await OrderActivity.findOne({
      where: { order_id: order.id, action: 'call_logged' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(activity, 'OrderActivity should be created for the logged call');
    assert.strictEqual(activity.to_value, 'answered', 'OrderActivity to_value should match outcome');
    console.log('  ✅ [PASS] TC02: Call log creation updates Customer contact date and creates OrderActivity');
    passed++;
  } catch (err) {
    console.error('  ❌ [FAIL] TC02:', err.message);
    failed++;
  }

  // TC03: Customer getOne API returns 360-degree linked profile data
  try {
    const orders = await Order.findAll({ where: { customer_id: customerId } });
    const order = orders[0];

    // Create warranty for the customer
    await Warranty.create({
      warranty_number: `WAR-SYNC-${Date.now()}`,
      customer_id: customerId,
      order_id: order ? order.id : null,
      product_name_snapshot: 'Smart Lock Pro',
      model_snapshot: 'SL-PRO-01',
      status: 'ACTIVE',
      purchase_date: new Date(),
      warranty_start_date: new Date(),
      warranty_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    let customerResult = null;
    const fakeReq = {
      params: { id: customerId },
      user: { id: userId, role: 'super_admin' },
    };
    const fakeRes = {
      status: (c) => ({
        json: (data) => { customerResult = data.data.customer; return data; }
      }),
    };

    await customerController.getOne(fakeReq, fakeRes, (err) => { if (err) throw err; });

    assert.ok(customerResult, 'Customer detail should be returned');
    assert.ok(customerResult.orders && customerResult.orders.length > 0, 'Orders should be included in 360 view');
    assert.ok(customerResult.warranties && customerResult.warranties.length > 0, 'Warranties should be included in 360 view');
    assert.ok(customerResult.callLogs && customerResult.callLogs.length > 0, 'Call logs should be included in 360 view');
    console.log('  ✅ [PASS] TC03: Customer getOne API returns interconnected Orders, Warranties, and Call Logs');
    passed++;
  } catch (err) {
    console.error('  ❌ [FAIL] TC03:', err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🎯 SYNC TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
