'use strict';

require('dotenv').config();
const { connectDB } = require('../config/database');
const { User, UserPermission, Employee, syncModels } = require('../models');

const clearUsers = async () => {
  try {
    await connectDB();
    await syncModels();

    console.log('🔄 Cleaning user records from database...');

    // 1. Permanently delete all soft-deleted or non-admin user records
    const allUsers = await User.findAll({ paranoid: false });

    // Identify primary Super Admin email to retain for system access
    const PRIMARY_ADMIN_EMAIL = 'admin@krishnacrm.com';

    let deletedCount = 0;
    for (const user of allUsers) {
      if (user.email.toLowerCase() !== PRIMARY_ADMIN_EMAIL.toLowerCase()) {
        // Clean UserPermission overrides
        await UserPermission.destroy({ where: { user_id: user.id } });
        
        // Clean Employee record if exists
        if (user.email) {
          await Employee.destroy({ where: { email: user.email }, force: true });
        }

        // Hard delete user record
        await user.destroy({ force: true });
        deletedCount++;
        console.log(`  ❌ Deleted user: ${user.email} (${user.role})`);
      }
    }

    // 2. Ensure primary Super Admin account is active and clean
    let adminUser = await User.findOne({
      where: { email: PRIMARY_ADMIN_EMAIL },
      paranoid: false,
    });

    if (!adminUser) {
      adminUser = await User.create({
        name: 'Super Admin',
        email: PRIMARY_ADMIN_EMAIL,
        password: 'Admin@123456',
        role: 'admin',
        is_active: true,
      });
      console.log(`  ✅ Created primary Super Admin: ${PRIMARY_ADMIN_EMAIL}`);
    } else {
      if (adminUser.deletedAt) {
        await adminUser.restore();
      }
      adminUser.is_active = true;
      adminUser.password = 'Admin@123456';
      await adminUser.save();
      console.log(`  ✅ Preserved active Super Admin: ${PRIMARY_ADMIN_EMAIL}`);
    }

    console.log(`\n🎉 Cleanup complete! Deleted ${deletedCount} user(s).`);
    console.log(`🔑 Super Admin login retained for logging in to create new users:`);
    console.log(`   Email   : admin@krishnacrm.com`);
    console.log(`   Password: Admin@123456`);
    console.log(`   Role    : Super admin`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing users:', err);
    process.exit(1);
  }
};

clearUsers();
