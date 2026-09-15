'use strict';

require('dotenv').config();
const { syncAllUsersToEmployees } = require('../services/userEmployeeSyncService');

async function main() {
  console.log('====================================================');
  console.log('⚡ SYNCHRONIZING ALL USERS TO EMPLOYEE DIRECTORY');
  console.log('====================================================\n');

  const res = await syncAllUsersToEmployees();
  console.log(`\n✅ Finished sync: Total Users = ${res.totalUsers}, New Employees Created = ${res.createdCount}, Existing Updated = ${res.updatedCount}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('Fatal sync error:', e);
  process.exit(1);
});
