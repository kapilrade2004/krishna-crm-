'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { sendExportResponse } = require('../utils/exportHelper');

async function testUniversalExports() {
  console.log('\n=============================================================');
  console.log('🧪 TESTING UNIVERSAL EXPORTS ENGINE (EXCEL, PDF, CSV)');
  console.log('=============================================================');

  const sampleColumns = [
    { key: 'order_number', label: 'Order #' },
    { key: 'customer', label: 'Customer Name' },
    { key: 'amount', label: 'Total Amount' },
    { key: 'status', label: 'Order Status' },
  ];

  const sampleData = [
    { order_number: 'ORD-TEST-001', customer: 'Ramesh Kumar', amount: 'INR 3,500', status: 'Delivered' },
    { order_number: 'ORD-TEST-002', customer: 'Priya Sharma', amount: 'INR 1,250', status: 'Confirmed' },
    { order_number: 'ORD-TEST-003', customer: 'Amitabh Sen', amount: 'INR 8,900', status: 'Pending Verification' },
  ];

  const formats = ['xlsx', 'pdf', 'csv'];

  for (const fmt of formats) {
    let sentBuffer = null;
    let headersSet = {};

    const mockRes = {
      setHeader: (k, v) => {
        headersSet[k.toLowerCase()] = v;
      },
      send: (buf) => {
        sentBuffer = buf;
        return mockRes;
      },
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      json: (data) => {
        mockRes.jsonData = data;
        return mockRes;
      },
    };

    await sendExportResponse({
      res: mockRes,
      title: 'Sample Orders Export',
      filenameBase: 'test_orders',
      format: fmt,
      columns: sampleColumns,
      data: sampleData,
      metadata: { generatedBy: 'System Test', period: 'Current Month' },
    });

    if (!sentBuffer || sentBuffer.length === 0) {
      throw new Error(`Failed to generate export for format: ${fmt}`);
    }

    console.log(`✅ [${fmt.toUpperCase()}] Export Generated Successfully:`);
    console.log(`   - Size: ${sentBuffer.length} bytes`);
    console.log(`   - Content-Type: ${headersSet['content-type']}`);
    console.log(`   - Content-Disposition: ${headersSet['content-disposition']}`);
  }

  console.log('\n=============================================================');
  console.log('🎉 ALL EXPORT FORMAT TESTS PASSED! (EXCEL, PDF, CSV)');
  console.log('=============================================================\n');
}

testUniversalExports()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
