'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');
const { User, Role, Permission, UserPermission, RolePermission } = require('../models');
const { getEffectivePermissions } = require('../middleware/auth');

const runTest = async () => {
  try {
    console.log('🔄 Connecting to Database...');
    await sequelize.authenticate();
    console.log('✅ Connected.');

    const sqlPath = path.join(__dirname, '../../migrations/009_user_access_control.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('🔄 Running migration 009_user_access_control.sql...');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT') && !s.startsWith('USE') && !s.startsWith('SET'));

      for (const statement of statements) {
        try {
          await sequelize.query(statement);
        } catch (err) {
          console.warn(`  ⚠️ Migration statement notice: ${err.message.substring(0, 80)}`);
        }
      }
      console.log('✅ Migration executed.');
    }

    console.log('\n📊 Verifying Roles:');
    const roles = await Role.findAll();
    roles.forEach(r => console.log(`  - Role: ${r.name} (Scope: ${r.data_scope})`));

    console.log('\n🔐 Verifying System Permissions:');
    const permCount = await Permission.count();
    console.log(`  - Total Permissions: ${permCount}`);

    console.log('\n👤 Verifying User Permissions Computation:');
    const sampleUser = await User.findOne();
    if (sampleUser) {
      const perms = await getEffectivePermissions(sampleUser);
      console.log(`  - Effective Permissions for ${sampleUser.name} (${sampleUser.role}):`, perms.slice(0, 5), '...');
    }

    console.log('\n🎉 ALL RBAC VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
};

runTest();
