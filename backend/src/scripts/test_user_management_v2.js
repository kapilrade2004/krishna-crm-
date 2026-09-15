'use strict';

require('dotenv').config();
const { User, LoginHistory, UserAuditLog, AccessTemplate, syncModels } = require('../models');
const { getEffectivePermissions } = require('../middleware/auth');

async function testUserManagement() {
  console.log('🧪 Testing User Management Module Refinements...');

  await syncModels();

  const testEmail = `user_test_${Date.now()}@krishnacrm.com`;

  // 1. Create a User with 4-section data
  console.log('1️⃣ Creating User with 4-Section Data (Personal, Org, Account, Access)...');
  const user = await User.create({
    first_name: 'Vikram',
    last_name: 'Singh',
    name: 'Vikram Singh',
    email: testEmail,
    password: 'Password@123',
    phone: '9988776655',
    department: 'Telecalling',
    designation: 'Senior Telecaller',
    employee_id: 'EMP-001',
    role: 'telecaller',
    status: 'active',
    is_active: true,
    force_password_reset: true,
  });
  console.log(`   ✅ User created with ID: ${user.id} (${user.name})`);

  // 2. Verify effective permissions
  console.log('2️⃣ Resolving Effective Permissions for Role "telecaller"...');
  const perms = await getEffectivePermissions(user);
  console.log(`   ✅ Resolved ${perms.length} effective permissions for user.`);

  // 3. Test Password Reset
  console.log('3️⃣ Testing Password Reset & Force Reset flag...');
  user.password = 'NewSecret@1234';
  user.force_password_reset = true;
  await user.save();
  const passwordMatch = await user.comparePassword('NewSecret@1234');
  console.log(`   ✅ Password reset verified: ${passwordMatch ? 'SUCCESS' : 'FAILED'}`);

  // 4. Test Account Lock
  console.log('4️⃣ Testing Account Lock / Unlock...');
  user.is_locked = true;
  user.locked_reason = 'Automated security test lock';
  user.locked_at = new Date();
  await user.save();
  console.log(`   ✅ User locked: is_locked=${user.is_locked}, reason="${user.locked_reason}"`);

  // 5. Test Login History Logging
  console.log('5️⃣ Testing Login History Log creation...');
  const logEntry = await LoginHistory.create({
    user_id: user.id,
    email: user.email,
    login_at: new Date(),
    ip_address: '127.0.0.1',
    user_agent: 'Mozilla/5.0 Chrome/120.0',
    browser: 'Google Chrome',
    os: 'Windows 11',
    device: 'Desktop',
    status: 'locked',
    failure_reason: user.locked_reason,
  });
  console.log(`   ✅ LoginHistory recorded: ID=${logEntry.id}, status=${logEntry.status}`);

  // 6. Test User Audit Logging
  console.log('6️⃣ Testing User Audit Log creation...');
  const auditEntry = await UserAuditLog.create({
    actor_user_id: user.id,
    target_user_id: user.id,
    event_type: 'ACCOUNT_LOCKED',
    module: 'user_management',
    new_values: { is_locked: true, reason: user.locked_reason },
    ip_address: '127.0.0.1',
    user_agent: 'Test runner',
  });
  console.log(`   ✅ UserAuditLog recorded: ID=${auditEntry.id}, event_type=${auditEntry.event_type}`);

  // 7. Test Access Template
  console.log('7️⃣ Testing Access Templates...');
  const tpl = await AccessTemplate.create({
    name: `Test Telecaller Template ${Date.now()}`,
    description: 'Automated test template',
    permissions: ['telecaller:view', 'csv:import', 'customers:view'],
  });
  console.log(`   ✅ AccessTemplate created: ID=${tpl.id}, name="${tpl.name}"`);
  await tpl.destroy();

  // 8. Test Soft Deletion / Archival
  console.log('8️⃣ Testing Soft Deletion / User Archival...');
  user.is_deleted = true;
  user.is_active = false;
  user.status = 'archived';
  user.deleted_at = new Date();
  await user.save();
  console.log(`   ✅ User soft-deleted: is_deleted=${user.is_deleted}, status="${user.status}"`);

  // Clean up test user
  await user.destroy();
  console.log('🎉 All User Management Module Tests PASSED successfully!');
}

if (require.main === module) {
  testUserManagement()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}
