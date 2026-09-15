'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';

const assert = require('assert');
const XLSX = require('xlsx');
const { sequelize, Order, Customer, OrderEvent, WhatsAppOutbox } = require('../models');
const OrderImportService = require('../services/orderImport/orderImportService');

async function runFeatures4And5AcceptanceTests() {
  console.log('🧪 RUNNING FEATURES 4 & 5 ACCEPTANCE TESTS: Universal Order Import & Upload -> Message 1\n');

  await sequelize.sync();

  const timestamp = Date.now();

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Amazon XLSX vs Flipkart CSV vs IndiaMART TSV Convergence
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Testing Universal Channel Convergence (Amazon XLSX, Flipkart CSV, IndiaMART TSV)...');

  // Common baseline data for 3 channel formats
  const basePhone = '9876543210';
  const baseName = 'Rohan Sharma';
  const baseSku = 'KRISHNA-PUMP-X1';
  const baseProduct = 'High Pressure Water Pump';

  // Format 1: Amazon XLSX
  const amazonOrderId = `AMZ-${timestamp}-001`;
  const amazonRows = [
    {
      'order-id': amazonOrderId,
      'purchase-date': '2026-09-11',
      'buyer-name': baseName,
      'buyer-phone-number': `+91 ${basePhone}`,
      'sku': baseSku,
      'product-name': baseProduct,
      'quantity-purchased': '2',
      'item-price': '1500.00',
      'ship-address-1': 'Plot 42, Sector 18',
      'ship-city': 'Gurugram',
      'ship-state': 'Haryana',
      'ship-postal-code': '122015',
    },
  ];
  const amzWb = XLSX.utils.book_new();
  const amzWs = XLSX.utils.json_to_sheet(amazonRows);
  XLSX.utils.book_append_sheet(amzWb, amzWs, 'Orders');
  const amzBuffer = XLSX.write(amzWb, { type: 'buffer', bookType: 'xlsx' });

  // Format 2: Flipkart CSV
  const flipkartOrderId = `FLIP-${timestamp}-002`;
  const flipkartRows = [
    {
      'Order ID': flipkartOrderId,
      'Order Date': '11-09-2026',
      'Customer Name': baseName,
      'Contact Number': basePhone,
      'Item SKU': baseSku,
      'Product Name': baseProduct,
      'Item Quantity': '2',
      'Selling Price': '1500',
      'Address Line 1': 'Plot 42, Sector 18',
      'City': 'Gurugram',
      'State': 'Haryana',
      'Pincode': '122015',
    },
  ];
  const flipkartCsvText = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(flipkartRows));
  const flipkartBuffer = Buffer.from(flipkartCsvText, 'utf-8');

  // Format 3: IndiaMART TSV
  const indiamartOrderId = `IM-${timestamp}-003`;
  const indiamartRows = [
    {
      'Query ID': indiamartOrderId,
      'Query Date': '2026-09-11 10:00:00',
      'Sender Name': baseName,
      'Sender Mobile': `91${basePhone}`,
      'Requirement': baseProduct,
      'Product / Service Name': baseProduct,
      'Model Number': baseSku,
      'Quantity': '2',
      'Estimated Value': '3000',
      'Location': 'Plot 42, Sector 18, Gurugram, Haryana',
    },
  ];
  const indiamartTsvText = XLSX.utils.sheet_to_txt(XLSX.utils.json_to_sheet(indiamartRows));
  const indiamartBuffer = Buffer.from(indiamartTsvText, 'utf-8');

  // Import all 3
  const amzResult = await OrderImportService.importOrders({
    buffer: amzBuffer,
    originalName: 'amazon_orders.xlsx',
    channel: 'amazon',
  });
  const flipResult = await OrderImportService.importOrders({
    buffer: flipkartBuffer,
    originalName: 'flipkart_orders.csv',
    channel: 'flipkart',
  });
  const imResult = await OrderImportService.importOrders({
    buffer: indiamartBuffer,
    originalName: 'indiamart_leads.tsv',
    channel: 'indiamart',
  });

  assert.strictEqual(amzResult.importedCount, 1, 'Amazon XLSX must import 1 order');
  assert.strictEqual(flipResult.importedCount, 1, 'Flipkart CSV must import 1 order');
  assert.strictEqual(imResult.importedCount, 1, 'IndiaMART TSV must import 1 order');

  const amzOrder = await Order.findOne({ where: { order_number: amazonOrderId } });
  const flipOrder = await Order.findOne({ where: { order_number: flipkartOrderId } });
  const imOrder = await Order.findOne({ where: { order_number: indiamartOrderId } });

  // Verification: All 3 converge to canonical state PENDING_VERIFICATION and normalized phone
  for (const [name, ord] of [
    ['Amazon', amzOrder],
    ['Flipkart', flipOrder],
    ['IndiaMART', imOrder],
  ]) {
    assert(ord, `${name} order must be found in DB`);
    assert.strictEqual(ord.workflow_state, 'PENDING_VERIFICATION', `${name} workflow_state must be PENDING_VERIFICATION`);
    assert.strictEqual(ord.verification_status, 'pending_verification', `${name} verification_status must be pending_verification`);
    assert.strictEqual(ord.customer_phone, `+91${basePhone}`, `${name} phone must be normalized to +91${basePhone}`);
    assert.strictEqual(ord.quantity, 2, `${name} quantity must be 2`);
  }

  console.log('   ✓ Amazon XLSX, Flipkart CSV, and IndiaMART TSV all converged to identical PENDING_VERIFICATION canonical state.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Bulk 10 Orders Import -> Exactly 10 Verification Outbox Messages
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Feature 5: Upload 10 Orders -> 10 Messages & 0 Duplicates...');

  const bulkRows = [];
  const testOrderIds = [];
  for (let i = 1; i <= 10; i++) {
    const ordId = `BULK-${timestamp}-${String(i).padStart(3, '0')}`;
    testOrderIds.push(ordId);
    bulkRows.push({
      'Order ID': ordId,
      'Customer Name': `Customer ${i}`,
      'Mobile': `98765432${String(i).padStart(2, '0')}`,
      'Item SKU': `SKU-PRO-${i}`,
      'Product Name': `Krishna Smart Appliance Unit ${i}`,
      'Quantity': 1,
      'Price': 2499,
    });
  }

  const bulkWb = XLSX.utils.book_new();
  const bulkWs = XLSX.utils.json_to_sheet(bulkRows);
  XLSX.utils.book_append_sheet(bulkWb, bulkWs, 'Batch');
  const bulkBuffer = XLSX.write(bulkWb, { type: 'buffer', bookType: 'xlsx' });

  // First import of 10 orders (explicitly enable enqueueVerification to test outbox generation)
  const bulkResult1 = await OrderImportService.importOrders({
    buffer: bulkBuffer,
    originalName: 'bulk_10_orders.xlsx',
    channel: 'direct',
    enqueueVerification: true,
  });

  assert.strictEqual(bulkResult1.importedCount, 10, 'Expected exactly 10 orders imported');
  assert.strictEqual(bulkResult1.skippedCount, 0, 'Expected 0 duplicates on first import');

  // Verify DB outbox entries created for these 10 orders
  const importedOrders = await Order.findAll({ where: { order_number: testOrderIds } });
  assert.strictEqual(importedOrders.length, 10, 'All 10 orders must exist in DB');

  for (const ord of importedOrders) {
    assert.strictEqual(ord.workflow_state, 'PENDING_VERIFICATION');

    // Check OrderEvent
    const event = await OrderEvent.findOne({
      where: { order_id: ord.id, event_type: 'ORDER_IMPORTED' },
    });
    assert(event, `OrderEvent ORDER_IMPORTED must exist for order ${ord.order_number}`);
    assert.strictEqual(event.after_state, 'PENDING_VERIFICATION');

    // Check WhatsApp Outbox row
    const outbox = await WhatsAppOutbox.findOne({
      where: { order_id: ord.id, template_name: 'order_verification_interactive' },
    });
    assert(outbox, `WhatsAppOutbox message must exist for order ${ord.order_number}`);
    assert.strictEqual(outbox.status, 'QUEUED');
    assert.strictEqual(outbox.idempotency_key, `order_verification_${ord.id}`);
  }
  console.log('   ✓ 10 orders imported, 10 OrderEvents recorded, 10 verification messages queued in outbox.');

  // Second import of the SAME 10 orders -> Must skip all 10 (0 duplicates created)
  console.log('3. Re-importing identical 10 orders to verify duplicate rejection...');
  const bulkResult2 = await OrderImportService.importOrders({
    buffer: bulkBuffer,
    originalName: 'bulk_10_orders.xlsx',
    channel: 'direct',
  });

  assert.strictEqual(bulkResult2.importedCount, 0, 'Second import must import 0 orders');
  assert.strictEqual(bulkResult2.skippedCount, 10, 'Second import must detect 10 duplicates');
  console.log('   ✓ Re-import correctly skipped all 10 duplicates (0 duplicate orders or messages created).');

  // ──────────────────────────────────────────────────────────────────────────
  // Clean up test data
  // ──────────────────────────────────────────────────────────────────────────
  const allTestIds = [amazonOrderId, flipkartOrderId, indiamartOrderId, ...testOrderIds];
  const createdOrders = await Order.findAll({ where: { order_number: allTestIds } });
  const createdOrderIds = createdOrders.map((o) => o.id);

  await WhatsAppOutbox.destroy({ where: { order_id: createdOrderIds } });
  await OrderEvent.destroy({ where: { order_id: createdOrderIds } });
  await Order.destroy({ where: { id: createdOrderIds } });

  console.log('\n🎉 ALL FEATURES 4 & 5 ACCEPTANCE TESTS PASSED (100% SUCCESS)\n');
}

runFeatures4And5AcceptanceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Features 4 & 5 test failed:', err);
    process.exit(1);
  });
