'use strict';

const assert = require('assert');
const reportController = require('../controllers/reportController');

async function testReportsLogic() {
  console.log('🧪 Starting Reports & Team Performance verification test...');

  // Verify functions exist and are exported
  assert.strictEqual(typeof reportController.getSalesReport, 'function', 'getSalesReport must be exported');
  assert.strictEqual(typeof reportController.getTeamReport, 'function', 'getTeamReport must be exported');
  assert.strictEqual(typeof reportController.exportOrders, 'function', 'exportOrders must be exported');
  assert.strictEqual(typeof reportController.exportCustomers, 'function', 'exportCustomers must be exported');
  assert.strictEqual(typeof reportController.exportTeam, 'function', 'exportTeam must be exported');

  console.log('✅ All report controller exports verified successfully.');
  console.log('🎉 Reports unit check passed with 0 errors.');
}

testReportsLogic().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
