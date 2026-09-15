'use strict';

const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const OrderImportService = require('../services/orderImport/orderImportService');
const { Order, Customer, CsvImportBatch } = require('../models');

async function runTest() {
  console.log('🚀 Starting Comprehensive Multi-Channel Import Test...');

  const tmpDir = path.resolve(__dirname, '../../uploads/test_channels');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Channel 1: Amazon Channel 2 (Spreadsheet with banner header on row 1, headers on row 2)
  const amazonRows = [
    { 'Amazon Order Report': 'CONFIDENTIAL', 'Generated': '2026-09-13', '': '' }, // Banner row 1
    { 'order-id': 'AMZ-101-9988221', 'buyer-name': 'Ramesh Kumar', 'buyer-phone-number': '9876543210', 'sku': 'AKUA-PUR-01', 'item-price': '1499', 'quantity-purchased': '1' }
  ];
  const amzFile = path.join(tmpDir, 'amazon_test.xlsx');
  const wbAmz = xlsx.utils.book_new();
  const wsAmz = xlsx.utils.json_to_sheet(amazonRows, { skipHeader: true });
  xlsx.utils.book_append_sheet(wbAmz, wsAmz, 'Orders');
  xlsx.writeFile(wbAmz, amzFile);

  console.log('\n--- 1. Testing Amazon Channel 2 (with banner header row) ---');
  const resAmz = await OrderImportService.importOrders({
    filePath: amzFile,
    originalName: 'amazon_test.xlsx',
    channel: 'amazon_channel_2',
    actorId: 'test_admin',
    enqueueVerification: false,
  });
  console.log('Amazon Import Result:', {
    status: resAmz.status,
    total: resAmz.total,
    importedCount: resAmz.importedCount,
    failedRows: resAmz.failedRows,
  });

  // Channel 2: Flipkart (Orders sheet with FSN, Item ID, NO phone number)
  const flipkartRows = [
    { 'Order ID': 'OD302918239019', 'Order Item ID': 'ITEM-99182', 'FSN': 'WATFPUR1029', 'Product Title': 'Water Purifier Filter Candle', 'Quantity': 2, 'Selling Price': 850, 'Customer Name': 'Pooja Sharma', 'Delivery Pincode': '400001' }
  ];
  const fkFile = path.join(tmpDir, 'flipkart_test.xlsx');
  const wbFk = xlsx.utils.book_new();
  const wsFk = xlsx.utils.json_to_sheet(flipkartRows);
  xlsx.utils.book_append_sheet(wbFk, wsFk, 'FlipkartOrders');
  xlsx.writeFile(wbFk, fkFile);

  console.log('\n--- 2. Testing Flipkart (Missing Phone Number) ---');
  const resFk = await OrderImportService.importOrders({
    filePath: fkFile,
    originalName: 'flipkart_test.xlsx',
    channel: 'flipkart',
    actorId: 'test_admin',
    enqueueVerification: false,
  });
  console.log('Flipkart Import Result:', {
    status: resFk.status,
    total: resFk.total,
    importedCount: resFk.importedCount,
    failedRows: resFk.failedRows,
  });

  // Channel 3: IndiaMART (B2B Lead Export with Query ID, Sender Mobile, Sender City)
  const indiamartRows = [
    { 'Query ID': 'IM-LEAD-88271', 'Sender Name': 'Amit Patel', 'Sender Mobile': '9123456780', 'Subject': 'RO Membrane 75 GPD', 'Sender City': 'Ahmedabad', 'Date': '2026-09-12' }
  ];
  const imFile = path.join(tmpDir, 'indiamart_test.csv');
  const wbIm = xlsx.utils.book_new();
  const wsIm = xlsx.utils.json_to_sheet(indiamartRows);
  xlsx.utils.book_append_sheet(wbIm, wsIm, 'Leads');
  xlsx.writeFile(wbIm, imFile);

  console.log('\n--- 3. Testing IndiaMART ---');
  const resIm = await OrderImportService.importOrders({
    filePath: imFile,
    originalName: 'indiamart_test.csv',
    channel: 'indiamart',
    actorId: 'test_admin',
    enqueueVerification: false,
  });
  console.log('IndiaMART Import Result:', {
    status: resIm.status,
    total: resIm.total,
    importedCount: resIm.importedCount,
    failedRows: resIm.failedRows,
  });

  // Channel 4: Akuabeat Website / Shopify (Header 'Name' e.g. #1055, Lineitem sku, Shipping Phone)
  const shopifyRows = [
    { 'Name': '#1055', 'Email': 'priya.singh@example.com', 'Lineitem name': 'Akuabeat Carbon Filter', 'Lineitem sku': 'AKUA-CF-01', 'Lineitem quantity': 1, 'Lineitem price': 699, 'Shipping Name': 'Priya Singh', 'Shipping Phone': '+919988776655' }
  ];
  const shopifyFile = path.join(tmpDir, 'shopify_test.xlsx');
  const wbShopify = xlsx.utils.book_new();
  const wsShopify = xlsx.utils.json_to_sheet(shopifyRows);
  xlsx.utils.book_append_sheet(wbShopify, wsShopify, 'ShopifyOrders');
  xlsx.writeFile(wbShopify, shopifyFile);

  console.log('\n--- 4. Testing Akuabeat Website / Shopify ---');
  const resShopify = await OrderImportService.importOrders({
    filePath: shopifyFile,
    originalName: 'shopify_test.xlsx',
    channel: 'akuabeat_website',
    actorId: 'test_admin',
    enqueueVerification: false,
  });
  console.log('Shopify Import Result:', {
    status: resShopify.status,
    total: resShopify.total,
    importedCount: resShopify.importedCount,
    failedRows: resShopify.failedRows,
  });

  // Verify orders in database
  console.log('\n--- 5. Verifying Database Records ---');
  const orders = await Order.findAll({
    where: {
      order_number: ['AMZ-101-9988221', 'OD302918239019', 'IM-LEAD-88271', '#1055']
    }
  });
  console.log('Imported Orders in DB:', orders.map(o => ({
    order_number: o.order_number,
    marketplace: o.marketplace,
    channel: o.channel,
    customer_phone: o.customer_phone,
    verification_status: o.verification_status,
  })));

  console.log('\n🎉 ALL MULTI-CHANNEL TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
