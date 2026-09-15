'use strict';

require('dotenv').config();
const { connectDB } = require('../config/database');
const { syncModels, User } = require('../models');

const demoUsers = [
  { name: 'Super Admin', email: 'admin@krishnacrm.com', password: 'Admin@123456', role: 'admin' },
  { name: 'Vikram Malhotra', email: 'manager@krishnacrm.com', password: 'Manager@123456', role: 'manager' },
  { name: 'Pooja Hegde', email: 'hr@krishnacrm.com', password: 'Hr@123456', role: 'hr' },
  { name: 'Neha Sharma', email: 'telecaller@krishnacrm.com', password: 'Telecaller@123456', role: 'telecaller' },
  { name: 'Rahul Deshmukh', email: 'sales@krishnacrm.com', password: 'Sales@123456', role: 'sales' },
  { name: 'Amit Shinde', email: 'technician@krishnacrm.com', password: 'Technician@123456', role: 'technician' },
  { name: 'Standard Employee', email: 'employee@krishnacrm.com', password: 'Employee@123456', role: 'employee' },
];

const seedDemoAccounts = async () => {
  try {
    await connectDB();
    await syncModels();

    console.log('🌱 Reseeding 6 Demo Accounts (Fixing password hashes)...');

    for (const d of demoUsers) {
      let user = await User.findOne({ where: { email: d.email }, paranoid: false });

      if (user) {
        if (user.deletedAt) {
          await user.restore();
        }
        user.name = d.name;
        user.role = d.role;
        user.password = d.password; // Hook beforeUpdate will hash plaintext password ONCE
        user.is_active = true;
        await user.save();
        console.log(` Updated account: ${d.role} -> ${d.email}`);
      } else {
        await User.create({
          name: d.name,
          email: d.email,
          password: d.password, // Hook beforeCreate will hash plaintext password ONCE
          role: d.role,
          is_active: true,
        });
        console.log(` Created account: ${d.role} -> ${d.email}`);
      }
    }

    console.log('✅ All 6 demo accounts successfully updated with single-hash passwords.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding demo accounts:', err.message);
    process.exit(1);
  }
};

seedDemoAccounts();
