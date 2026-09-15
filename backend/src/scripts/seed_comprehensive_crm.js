'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { connectDB } = require('../config/database');
const { seedComprehensiveCRMData } = require('../services/seedService');

async function main() {
  await connectDB();
  const res = await seedComprehensiveCRMData();
  console.log('Seeding result:', JSON.stringify(res, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
