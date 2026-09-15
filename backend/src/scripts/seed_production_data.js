'use strict';

const { seedComprehensiveCRMData } = require('../services/seedService');
const { sequelize } = require('../config/database');
const logger = require('../config/logger');

async function run() {
  try {
    console.log('🚀 Running Master Static Data Seeding for Tasks, Employee Audit, HR, and Follow-ups...');
    const result = await seedComprehensiveCRMData();
    console.log('✅ Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

run();
