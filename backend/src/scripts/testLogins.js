'use strict';

require('dotenv').config();
const { connectDB } = require('../config/database');
const { User } = require('../models');

const accountsToTest = [
  { email: 'admin@krishnacrm.com', pass: 'Admin@123456' },
  { email: 'manager@krishnacrm.com', pass: 'Manager@123456' },
  { email: 'hr@krishnacrm.com', pass: 'Hr@123456' },
  { email: 'telecaller@krishnacrm.com', pass: 'Telecaller@123456' },
  { email: 'employee@krishnacrm.com', pass: 'Employee@123456' },
  { email: 'sales@krishnacrm.com', pass: 'Sales@123456' },
  { email: 'technician@krishnacrm.com', pass: 'Technician@123456' },
];

const testLogins = async () => {
  try {
    await connectDB();
    console.log('🔍 Testing Passwords for Demo Accounts...');

    for (const acc of accountsToTest) {
      const u = await User.findOne({ where: { email: acc.email } });
      if (!u) {
        console.log(`❌ NOT FOUND: ${acc.email}`);
      } else {
        const match = await u.comparePassword(acc.pass);
        if (match) {
          console.log(`✅ MATCH: ${acc.email} (Role: ${u.role}, Active: ${u.is_active})`);
        } else {
          console.log(`❌ PASSWORD MISMATCH: ${acc.email}`);
        }
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

testLogins();
