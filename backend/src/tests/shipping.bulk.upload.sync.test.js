'use strict';
require('dotenv').config();

const assert = require('assert');

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Order, Customer, OrderActivity, sequelize, User } = require('../models');
const { processShippingBulkUpload } = require('../services/csvService');

async function runTests() {
  console.log('================================================================');
  console.log('🚚 STARTING SHIPPING BULK UPLOAD & STATUS SYNC TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const tempDir = path.join(__dirname, 'temp_test_csv');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const orderId1 = `ORD-SHIP-TEST-${Date.now()}-A`;
  const orderId2 = `ORD-SHIP-TEST-${Date.now()}-B`;
  const awb1 = `DEL-AWB-${Date.now()}-1`;
  const awb2 = `DEL-AWB-${Date.now()}-2`;

  const file1Path = path.join(tempDir, `shipping_upload_1_${Date.now()}.csv`);
  const file2Path = path.join(tempDir, `shipping_upload_2_${Date.now()}.csv`);

  let adminUser = await User.findOne();
  const userId = adminUser ? adminUser.id : null;

  try {
    // ── Pre-seed Orders in CRM ────────────────────────────────────────────────
    // Shipping uploads only update existing confirmed orders; pre-seed them now.
    await Order.create({
      order_number: orderId1,
      marketplace_order_id: orderId1,
      marketplace: 'amazon',
      status: 'confirmed',
      customer_name: 'Aarav Sharma',
      customer_phone: '9811122233',
      shipping_pincode: '110001',
      shipping_city: 'New Delhi',
      total_amount: 1500,
    });

    await Order.create({
      order_number: orderId2,
      marketplace_order_id: orderId2,
      marketplace: 'amazon',
      status: 'confirmed',
      customer_name: 'Bhavna Patel',
      customer_phone: '9822233344',
      shipping_pincode: '400001',
      shipping_city: 'Mumbai',
      total_amount: 2500,
    });

    // ── Test 1: Upload 1 with In-Transit Orders ──────────────────────────────
    console.log('--- Test 1: First Upload (Shipped / In Transit Orders) ---');
    const csvContent1 = [
      'Order ID,AWB Tracking Number,Shipping Partner,Status,Dispatched Date,Delivered Date,Customer Name,Phone,Pincode,City',
      `${orderId1},${awb1},Delhivery,in_transit,2026-09-08,,Aarav Sharma,9811122233,110001,New Delhi`,
      `${orderId2},${awb2},BlueDart,dispatched,2026-09-08,,Bhavna Patel,9822233344,400001,Mumbai`,
    ].join('\n');

    fs.writeFileSync(file1Path, csvContent1, 'utf8');

    const result1 = await processShippingBulkUpload(file1Path, {
      userId,
      defaultChannel: 'amazon',
    });

    console.log('Result 1:', result1);
    assert.strictEqual(result1.total, 2, 'Total rows should be 2');
    assert.strictEqual(result1.updatedInTransit, 2, '2 orders should be in transit');
    assert.strictEqual(result1.updatedDelivered, 0, '0 orders should be delivered');

    // Verify in database
    const dbOrder1 = await Order.findOne({ where: { order_number: orderId1 } });
    const dbOrder2 = await Order.findOne({ where: { order_number: orderId2 } });

    assert.ok(dbOrder1, 'Order 1 must exist');
    assert.strictEqual(dbOrder1.status, 'dispatched', 'Order 1 status must be dispatched');
    assert.strictEqual(dbOrder1.tracking_number, awb1, 'Order 1 tracking number must match');
    assert.strictEqual(dbOrder1.shipping_partner, 'Delhivery');
    assert.strictEqual(dbOrder1.customer_id, null, 'Customer should NOT be registered while order is in transit');

    assert.ok(dbOrder2, 'Order 2 must exist');
    assert.strictEqual(dbOrder2.status, 'dispatched', 'Order 2 status must be dispatched');
    assert.strictEqual(dbOrder2.customer_id, null, 'Customer 2 should NOT be registered while in transit');

    console.log('✅ Test 1 Passed: In-transit orders uploaded and saved with status dispatched without premature customer registration.');
    passed++;

    // ── Test 2: Upload 2 (Order 1 delivered, Order 2 still in transit) ─────────
    console.log('\n--- Test 2: Second Upload (Order 1 delivered, Order 2 in transit) ---');
    const csvContent2 = [
      'Order ID,AWB Tracking Number,Shipping Partner,Status,Dispatched Date,Delivered Date,Customer Name,Phone,Pincode,City',
      `${orderId1},${awb1},Delhivery,Delivered,2026-09-08,2026-09-09 14:30:00,Aarav Sharma,9811122233,110001,New Delhi`,
      `${orderId2},${awb2},BlueDart,in_transit,2026-09-08,,Bhavna Patel,9822233344,400001,Mumbai`,
    ].join('\n');

    fs.writeFileSync(file2Path, csvContent2, 'utf8');

    const result2 = await processShippingBulkUpload(file2Path, {
      userId,
      defaultChannel: 'amazon',
    });

    console.log('Result 2:', result2);
    assert.strictEqual(result2.total, 2, 'Total rows should be 2');
    assert.strictEqual(result2.updatedDelivered, 1, '1 order should be updated to delivered');
    assert.strictEqual(result2.updatedInTransit, 1, '1 order should remain in transit');

    // Reload Order 1
    await dbOrder1.reload();
    assert.strictEqual(dbOrder1.status, 'delivered', 'Order 1 must now be delivered');
    assert.ok(dbOrder1.delivered_at !== null, 'Order 1 delivered_at must be populated');
    assert.strictEqual(dbOrder1.flow_stage, 'installation', 'Order 1 flow stage must advance to installation');
    assert.ok(dbOrder1.customer_id !== null, 'Order 1 customer_id must now be linked upon delivery');

    // Verify Customer record created in CRM
    const customer1 = await Customer.findByPk(dbOrder1.customer_id);
    assert.ok(customer1, 'Customer 1 record must exist in customers table');
    assert.strictEqual(customer1.name, 'Aarav Sharma');
    assert.strictEqual(customer1.phone, '9811122233');
    assert.strictEqual(customer1.lifecycle_stage, 'installation_pending', 'Customer lifecycle_stage must be installation_pending');
    assert.strictEqual(customer1.status, 'active');

    // Reload Order 2
    await dbOrder2.reload();
    assert.strictEqual(dbOrder2.status, 'dispatched', 'Order 2 status must remain dispatched');
    assert.strictEqual(dbOrder2.customer_id, null, 'Order 2 customer_id must still be null');

    console.log('✅ Test 2 Passed: Delivered order transitioned across CRM, customer created, and in-transit order preserved.');
    passed++;

    // ── Test 3: Idempotency Replay (Re-upload does not regress status) ───────
    console.log('\n--- Test 3: Idempotency Replay ---');
    const result3 = await processShippingBulkUpload(file2Path, {
      userId,
      defaultChannel: 'amazon',
    });

    console.log('Result 3:', result3);
    assert.strictEqual(result3.alreadyDelivered, 1, 'Delivered order should be recorded as already delivered');
    await dbOrder1.reload();
    assert.strictEqual(dbOrder1.status, 'delivered', 'Status must stay delivered without regression');

    console.log('✅ Test 3 Passed: Replay protection verified.');
    passed++;

    // ── Test 4: Unknown Order Rejection (Branch B removal verification) ──────
    console.log('\n--- Test 4: Unknown Order Rejection (Branch B Removed) ---');
    const unknownOrderId = `ORD-UNKNOWN-${Date.now()}`;
    const file3Path = path.join(tempDir, `shipping_upload_3_${Date.now()}.csv`);
    const csvContent3 = [
      'Order ID,AWB Tracking Number,Shipping Partner,Status,Dispatched Date,Delivered Date,Customer Name,Phone,Pincode,City',
      `${unknownOrderId},AWB-UNKNOWN-1,Delhivery,in_transit,2026-09-08,,Ghost User,9800000000,110001,New Delhi`,
    ].join('\n');
    fs.writeFileSync(file3Path, csvContent3, 'utf8');

    const result4 = await processShippingBulkUpload(file3Path, { userId, defaultChannel: 'amazon' });
    assert.strictEqual(result4.errors.length, 1, 'Unknown order should produce 1 error');
    assert.ok(result4.errors[0].error.includes('not found in CRM'));
    const ghostDbOrder = await Order.findOne({ where: { order_number: unknownOrderId } });
    assert.strictEqual(ghostDbOrder, null, 'No order should have been created in database');
    console.log('✅ Test 4 Passed: Non-existent orders are strictly rejected and cannot create new orders.');
    passed++;

  } catch (err) {
    console.error('❌ Test Failed:', err);
    failed++;
  } finally {
    // Clean up temporary files and test data
    try {
      if (fs.existsSync(file1Path)) fs.unlinkSync(file1Path);
      if (fs.existsSync(file2Path)) fs.unlinkSync(file2Path);
      const leftoverFiles = fs.readdirSync(tempDir);
      for (const f of leftoverFiles) {
        fs.unlinkSync(path.join(tempDir, f));
      }
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    } catch {}

    try {
      const ord1 = await Order.findOne({ where: { order_number: orderId1 } });
      if (ord1) {
        if (ord1.customer_id) await Customer.destroy({ where: { id: ord1.customer_id } });
        await ord1.destroy();
      }
      const ord2 = await Order.findOne({ where: { order_number: orderId2 } });
      if (ord2) {
        if (ord2.customer_id) await Customer.destroy({ where: { id: ord2.customer_id } });
        await ord2.destroy();
      }
    } catch {}
  }

  console.log(`\n================================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================`);

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
