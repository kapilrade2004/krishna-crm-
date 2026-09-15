'use strict';

require('dotenv').config();
const { connectDB } = require('../config/database');
const { syncModels } = require('../models');
const { User } = require('../models');

const createAdmin = async () => {
  try {
    await connectDB();
    await syncModels();

    const email = 'admin@krishnacrm.com';
    const password = 'Admin@123456';

    // Delete existing user with this email if any
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      console.log('⚠️  Found existing user, deleting and recreating...');
      await existing.destroy();
    }

    const user = await User.create({
      name: 'Admin',
      email,
      password,       // beforeCreate hook will bcrypt this automatically
      role: 'admin',
      is_active: true,
    });

    console.log('✅ Admin user created successfully');
    console.log('   Email   :', user.email);
    console.log('   Role    :', user.role);
    console.log('   Hash    :', user.password.substring(0, 20) + '...');
    console.log('   Active  :', user.is_active);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating admin:', err.message);
    process.exit(1);
  }
};

createAdmin();