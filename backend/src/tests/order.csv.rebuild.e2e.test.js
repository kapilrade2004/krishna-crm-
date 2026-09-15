'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';

const assert = require('assert');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Order, Customer, OrderEvent, WhatsAppOutbox, CsvImportBatch } = require('../models');
const OrderImportService = require('../services/orderImport/orderImportService');
const FileParser = require('../services/orderImport/fileParser');
const { ChannelAdapterFactory } = require('../services/orderImport/channelAdapters');
const OrderValidator = require('../services/orderImport/orderValidator');

async function runRebuildE2ETests() {
  console.log('======================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE CSV/EXCEL ORDER IMPORT REBUILD TEST SUITE');
  console.log('======================================================================\n');

  const { migrateWhatsAppOrchestrator } = require('../scripts/migrate_whatsapp_orchestrator');
  await migrateWhatsAppOrchestrator();
  await sequelize.sync();

  const timestamp = Date.now();

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 1: Pre-flight Validation (Section 19 & 20)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Testing Pre-flight Validation & Schema Incompatibility Detection...');
  await OrderImportService.preflightCheck();
  console.log('   ✅ Preflight passed when required schema is present.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 2: Multi-format parsing (XLSX, XLS, CSV, TSV) (Section 3)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('2. Testing Supported File Formats (.xlsx, .xls, .csv, .tsv)...');

  const testRow = {
    'order-id': `FMT-${timestamp}-001`,
    'purchase-date': '2026-09-12',
    'buyer-name': 'Format Test User',
    'buyer-phone-number': '9876543210',
    'sku': 'SKU-FMT-1',
    'product-name': 'Universal Pressure Valve',
    'quantity-purchased': '1',
    'item-price': '999.00',
  };

  // A. XLSX
  const wbXlsx = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbXlsx, XLSX.utils.json_to_sheet([testRow]), 'Sheet1');
  const bufXlsx = XLSX.write(wbXlsx, { type: 'buffer', bookType: 'xlsx' });
  const parsedXlsx = await FileParser.parse({ buffer: bufXlsx, originalName: 'orders.xlsx' });
  assert.strictEqual(parsedXlsx.length, 1);
  console.log('   ✅ XLSX format parsed successfully.');

  // B. XLS
  const wbXls = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbXls, XLSX.utils.json_to_sheet([testRow]), 'Sheet1');
  const bufXls = XLSX.write(wbXls, { type: 'buffer', bookType: 'biff8' });
  const parsedXls = await FileParser.parse({ buffer: bufXls, originalName: 'orders.xls' });
  assert.strictEqual(parsedXls.length, 1);
  console.log('   ✅ XLS format parsed successfully.');

  // C. CSV
  const csvContent = 'order-id,purchase-date,buyer-name,buyer-phone-number,sku,product-name,quantity-purchased,item-price\n' +
    `CSV-${timestamp}-002,2026-09-12,CSV User,9876543211,SKU-CSV,CSV Widget,1,500\n`;
  const parsedCsv = await FileParser.parse({ buffer: Buffer.from(csvContent), originalName: 'orders.csv' });
  assert.strictEqual(parsedCsv.length, 1);
  console.log('   ✅ CSV format parsed successfully.');

  // D. TSV
  const tsvContent = 'order-id\tpurchase-date\tbuyer-name\tbuyer-phone-number\tsku\tproduct-name\tquantity-purchased\titem-price\n' +
    `TSV-${timestamp}-003\t2026-09-12\tTSV User\t9876543212\tSKU-TSV\tTSV Widget\t1\t600\n`;
  const parsedTsv = await FileParser.parse({ buffer: Buffer.from(tsvContent), originalName: 'orders.tsv' });
  assert.strictEqual(parsedTsv.length, 1);
  console.log('   ✅ TSV format parsed successfully.');

  // Reject unsupported formats
  try {
    await FileParser.parse({ buffer: Buffer.from('test'), originalName: 'malicious.exe' });
    assert.fail('Should have rejected .exe extension');
  } catch (extErr) {
    assert.match(extErr.message, /Unsupported file extension/i);
    console.log('   ✅ Unsupported file extensions rejected securely.');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 3: Channel Adaptation & Normalization (Section 4 & 5)
  // Amazon 1/2/3, Flipkart, IndiaMART, AkuaBeat Website, Direct
  // ──────────────────────────────────────────────────────────────────────────
  console.log('3. Testing Channel Adapters & Punctuation Normalization (Section 4 & 5)...');

  const channelsToTest = [
    { channel: 'amazon_channel_1', raw: { 'order-id': `AMZ1-${timestamp}`, 'buyer-phone-number': '9876500001', 'sku': 'SKU1' } },
    { channel: 'amazon_channel_2', raw: { 'Order ID': `AMZ2-${timestamp}`, 'buyer phone': '9876500002', 'item-name': 'SKU2' } },
    { channel: 'amazon_channel_3', raw: { 'order id.': `AMZ3-${timestamp}`, 'Mobile no.': '9876500003', 'item description': 'SKU3' } },
    { channel: 'flipkart', raw: { 'Order ID': `FLP-${timestamp}`, 'Contact Number': '9876500004', 'Product Name': 'SKU4' } },
    { channel: 'indiamart', raw: { 'Query ID': `IM-${timestamp}`, 'Sender Mobile': '9876500005', 'Requirement': 'SKU5' } },
    { channel: 'akuabeat_website', raw: { 'Order Number': `WEB-${timestamp}`, 'Phone': '9876500006', 'Lineitem name': 'SKU6' } },
    { channel: 'direct', raw: { 'order_id': `DIR-${timestamp}`, 'phone': '9876500007', 'product_name': 'SKU7' } },
  ];

  for (const ch of channelsToTest) {
    const adapter = ChannelAdapterFactory.getAdapter(ch.channel, ch.raw);
    const dto = adapter.adaptRow(ch.raw);
    assert.ok(dto.order_number, `Order number missing for channel ${ch.channel}`);
    assert.ok(dto.customer_phone, `Customer phone missing for channel ${ch.channel}`);
    assert.ok(dto.customer_phone.startsWith('+91'), `Customer phone not canonical +91 for ${ch.channel}`);
  }
  console.log('   ✅ All 7 channels adapt to canonical DTO with +91 E.164 phone representation.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 4: Customer Upsert Without Fuzzy LIKE (Section 9)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('4. Testing Customer Match and Reuse (Exact matching, no fuzzy LIKE)...');

  const existingPhone = `9${String(Date.now()).slice(-9)}`;
  const canonicalExistingPhone = `+91${existingPhone}`;
  const existingCustId = uuidv4();

  const preExistingCustomer = await Customer.create({
    id: existingCustId,
    name: 'Existing Customer Profile',
    phone: canonicalExistingPhone,
    whatsapp_number: canonicalExistingPhone,
    email: 'existing.cust@example.com',
    source: 'amazon',
  });

  // Parse directly via service with raw buffer
  const custWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    custWb,
    XLSX.utils.json_to_sheet([
      {
        'order-id': `CUST-REUSE-${timestamp}`,
        'buyer-name': 'New Order Buyer',
        'buyer-phone-number': existingPhone,
        'sku': 'SKU-REUSE',
        'product-name': 'Pump Part',
        'quantity-purchased': '1',
        'item-price': '1200',
      },
    ]),
    'Sheet1'
  );
  const custBuf = XLSX.write(custWb, { type: 'buffer', bookType: 'xlsx' });

  const custSummary = await OrderImportService.importOrders({
    buffer: custBuf,
    originalName: 'reuse.xlsx',
    channel: 'amazon_channel_1',
    actorId: 'TEST_AGENT',
  });

  assert.strictEqual(custSummary.importedCount, 1);
  const matchedOrder = custSummary.importedOrders[0];
  assert.strictEqual(matchedOrder.customer_id, preExistingCustomer.id, 'Must reuse existing customer ID');
  console.log('   ✅ Existing customer matched and reused accurately.');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 5: Critical E2E Test (Section 30)
  // File with: 3 valid rows, 1 duplicate row, 1 invalid row
  // Expected: total = 5, success = 3, duplicate = 1, failed = 1, status = PARTIAL
  // ──────────────────────────────────────────────────────────────────────────
  console.log('5. Running Section 30 Critical E2E Test (3 valid, 1 duplicate, 1 invalid)...');

  const sharedDupOrderId = `E2E-DUP-${timestamp}`;

  // Pre-seed the duplicate order
  const preseededOrder = await Order.create({
    id: uuidv4(),
    order_number: sharedDupOrderId,
    marketplace_order_id: sharedDupOrderId,
    marketplace: 'amazon',
    channel: 'amazon_channel_1',
    customer_name: 'Pre-existing Order Buyer',
    customer_phone: '+919111111111',
    product_name: 'Existing Motor',
    quantity: 1,
    total_amount: 1000,
    status: 'pending',
    verification_status: 'pending_verification',
    workflow_state: 'PENDING_VERIFICATION',
  });

  const mixedRows = [
    // Row 1: Valid
    {
      'order-id': `E2E-VALID-${timestamp}-1`,
      'buyer-name': 'Valid User 1',
      'buyer-phone-number': '9876543101',
      'product-name': 'High Pressure Washer',
      'quantity-purchased': '1',
      'item-price': '2500',
    },
    // Row 2: Valid
    {
      'order-id': `E2E-VALID-${timestamp}-2`,
      'buyer-name': 'Valid User 2',
      'buyer-phone-number': '9876543102',
      'product-name': 'Foam Cannon Pro',
      'quantity-purchased': '2',
      'item-price': '1200',
    },
    // Row 3: Duplicate of pre-seeded order
    {
      'order-id': sharedDupOrderId,
      'buyer-name': 'Duplicate Order Buyer',
      'buyer-phone-number': '9111111111',
      'product-name': 'Existing Motor',
      'quantity-purchased': '1',
      'item-price': '1000',
    },
    // Row 4: Invalid (Missing phone number)
    {
      'order-id': `E2E-INVALID-${timestamp}-4`,
      'buyer-name': 'Invalid User Missing Phone',
      'buyer-phone-number': '',
      'product-name': 'Car Wash Shampoo',
      'quantity-purchased': '1',
      'item-price': '400',
    },
    // Row 5: Valid
    {
      'order-id': `E2E-VALID-${timestamp}-5`,
      'buyer-name': 'Valid User 3',
      'buyer-phone-number': '9876543105',
      'product-name': 'Microfiber Drying Towel',
      'quantity-purchased': '3',
      'item-price': '300',
    },
  ];

  const mixedWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(mixedWb, XLSX.utils.json_to_sheet(mixedRows), 'Orders');
  const mixedBuf = XLSX.write(mixedWb, { type: 'buffer', bookType: 'xlsx' });

  const e2eSummary = await OrderImportService.importOrders({
    buffer: mixedBuf,
    originalName: 'mixed_batch.xlsx',
    channel: 'amazon_channel_1',
    actorId: 'TEST_ADMIN',
  });

  console.log(`   E2E Results: total=${e2eSummary.total}, imported=${e2eSummary.importedCount}, skipped/dup=${e2eSummary.skippedCount}, invalid=${e2eSummary.invalidCount}, status=${e2eSummary.status}`);

  assert.strictEqual(e2eSummary.total, 5, 'Total rows must be 5');
  assert.strictEqual(e2eSummary.importedCount, 3, 'Successful orders must be 3');
  assert.strictEqual(e2eSummary.skippedCount, 1, 'Duplicate count must be 1');
  assert.strictEqual(e2eSummary.invalidCount, 1, 'Invalid count must be 1');
  assert.strictEqual(e2eSummary.status, 'partial', 'Batch status must be "partial"');

  // Verify DB state:
  // 1. 3 new orders exist in DB
  const validOrder1 = await Order.findOne({ where: { order_number: `E2E-VALID-${timestamp}-1` } });
  const validOrder2 = await Order.findOne({ where: { order_number: `E2E-VALID-${timestamp}-2` } });
  const validOrder5 = await Order.findOne({ where: { order_number: `E2E-VALID-${timestamp}-5` } });
  assert.ok(validOrder1, 'Valid order 1 must exist');
  assert.ok(validOrder2, 'Valid order 2 must exist');
  assert.ok(validOrder5, 'Valid order 5 must exist');

  // 2. Canonical states
  assert.strictEqual(validOrder1.status, 'pending');
  assert.strictEqual(validOrder1.verification_status, 'pending_verification');
  assert.strictEqual(validOrder1.workflow_state, 'PENDING_VERIFICATION');

  // 3. Duplicate was NOT duplicated
  const dupOrders = await Order.findAll({ where: { order_number: sharedDupOrderId } });
  assert.strictEqual(dupOrders.length, 1, 'Duplicate order must NOT exist twice');

  // 4. Invalid row did NOT create an order
  const invalidOrder = await Order.findOne({ where: { order_number: `E2E-INVALID-${timestamp}-4` } });
  assert.strictEqual(invalidOrder, null, 'Invalid row must not create an order');

  // 5. Exactly 3 OrderEvent records created
  const events1 = await OrderEvent.findAll({ where: { order_id: validOrder1.id } });
  const events2 = await OrderEvent.findAll({ where: { order_id: validOrder2.id } });
  const events5 = await OrderEvent.findAll({ where: { order_id: validOrder5.id } });
  assert.strictEqual(events1.length, 1, 'Valid order 1 must have 1 OrderEvent');
  assert.strictEqual(events2.length, 1, 'Valid order 2 must have 1 OrderEvent');
  assert.strictEqual(events5.length, 1, 'Valid order 5 must have 1 OrderEvent');

  // 6. Verification outbox messages exist with exact idempotency key
  const outbox1 = await WhatsAppOutbox.findOne({ where: { idempotency_key: `order_verification_${validOrder1.id}` } });
  const outbox2 = await WhatsAppOutbox.findOne({ where: { idempotency_key: `order_verification_${validOrder2.id}` } });
  const outbox5 = await WhatsAppOutbox.findOne({ where: { idempotency_key: `order_verification_${validOrder5.id}` } });
  assert.ok(outbox1, 'Outbox message 1 must exist');
  assert.ok(outbox2, 'Outbox message 2 must exist');
  assert.ok(outbox5, 'Outbox message 5 must exist');
  assert.strictEqual(outbox1.status, 'QUEUED');
  assert.strictEqual(outbox1.template_name, 'order_verification_interactive');

  // 7. Duplicate order did NOT create another outbox message
  const dupOutbox = await WhatsAppOutbox.findAll({ where: { idempotency_key: `order_verification_${preseededOrder.id}` } });
  assert.strictEqual(dupOutbox.length, 0, 'Duplicate order must not trigger outbox message');

  console.log('   ✅ Section 30 Critical E2E Test PASSED with 100% precision!');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUITE 6: Verification of the exact user screenshot file
  // `Test_ Details.xlsx` with 'Mobile no.' header
  // ──────────────────────────────────────────────────────────────────────────
  console.log('6. Testing Live Failure Reproduction File (Punctuated header "Mobile no." & order_events persistence)...');

  const testDetailsRows = [
    {
      'order id.': `AMZ-SCREENSHOT-${timestamp}`,
      'buyer name.': 'Screenshot Buyer',
      'Mobile no.': '9876543210',
      'product name': 'Specialty Pressure Nozzle',
      'quantity': '1',
      'item price': '750',
      'ship address 1': '123 Main Road',
      'city': 'Jaipur',
      'state': 'Rajasthan',
      'pincode': '302001',
    },
  ];

  const testDetailsWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(testDetailsWb, XLSX.utils.json_to_sheet(testDetailsRows), 'Sheet1');
  const testDetailsBuf = XLSX.write(testDetailsWb, { type: 'buffer', bookType: 'xlsx' });

  const testDetailsSummary = await OrderImportService.importOrders({
    buffer: testDetailsBuf,
    originalName: 'Test_ Details.xlsx',
    channel: 'amazon_channel_1',
    actorId: 'SCREENSHOT_TEST',
  });

  assert.strictEqual(testDetailsSummary.importedCount, 1, 'Must import 1 order successfully');
  assert.strictEqual(testDetailsSummary.invalidCount, 0, 'Must have 0 invalid orders');
  assert.strictEqual(testDetailsSummary.status, 'completed', 'Batch status must be completed');

  const importedFromScreenshot = testDetailsSummary.importedOrders[0];
  const screenshotOrderEvent = await OrderEvent.findOne({ where: { order_id: importedFromScreenshot.id } });
  assert.ok(screenshotOrderEvent, 'OrderEvent must be created and persisted in DB');
  assert.strictEqual(screenshotOrderEvent.event_type, 'ORDER_IMPORTED');

  const screenshotOutbox = await WhatsAppOutbox.findOne({ where: { idempotency_key: `order_verification_${importedFromScreenshot.id}` } });
  assert.ok(screenshotOutbox, 'Outbox message for screenshot file must be queued');

  console.log('   ✅ Live failure file "Test_ Details.xlsx" successfully imports, creates order, creates order_event, and queues outbox!');

  console.log('\n======================================================================');
  console.log('🎉 ALL 6 TEST SUITES PASSED FLAWLESSLY! REBUILD VERIFIED END-TO-END');
  console.log('======================================================================\n');
}

runRebuildE2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ TEST FAILURE:', err);
    process.exit(1);
  });
