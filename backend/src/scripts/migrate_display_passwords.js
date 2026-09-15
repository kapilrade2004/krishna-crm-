'use strict';

const { sequelize, User } = require('../models');

const USER_CREDENTIAL_MAP = {
  'admin@krishnacrm.com': 'Admin@123456',
  'manager@krishnacrm.com': 'Manager@123456',
  'hr@krishnacrm.com': 'Hr@123456',
  'sales@krishnacrm.com': 'Sales@123456',
  'telecaller@krishnacrm.com': 'Telecaller@123456',
  'technician@krishnacrm.com': 'Technician@123456',
  'employee@krishnacrm.com': 'Employee@123456',
  'biometric.test@krishnacrm.com': 'Employee@123456',
  'sushil@akuabeat.com': 'Reviewer@123456',
  'yash.telecaller@nityamenterprises.com': 'Telecaller@123456',
  'meenakshi.telecaller@nityamenterprises.com': 'Telecaller@123456',
  'sanjay.accountant@leretailproject.com': 'Accountant@123456',
  'riya.accountant@leretailproject.com': 'Accountant@123456',
  'priti.accountant@leretailproject.com': 'Accountant@123456',
  'smallbusiness.ecs@gmail.com': 'Manager@123456',
  'bharat.manager@nityamenterprises.com': 'Manager@123456',
  'manoj.delivery@krishnacrm.com': 'Delivery@123456',
  'shruti.ecom@nityamenterprises.com': 'Executive@123456',
  'faijal.ecom@nityamenterprises.com': 'Executive@123456',
  'priya.ecom@nityamenterprises.com': 'Executive@123456',
  'laxmi.exec@nityamenterprises.com': 'Employee@123456',
  'manish.exec@nityamenterprises.com': 'Employee@123456',
  'support@krishnacrm.com': 'Support@123456',
  'ceo@krishnacrm.com': 'Ceo@123456',
};

const resolveFallbackPassword = (role) => {
  const r = (role || '').toLowerCase();
  if (r === 'admin' || r === 'super_admin') return 'Admin@123456';
  if (r === 'manager' || r === 'senior_account_manager' || r === 'spn_ads_manager') return 'Manager@123456';
  if (r === 'telecaller') return 'Telecaller@123456';
  if (r === 'accountant') return 'Accountant@123456';
  if (r === 'ecommerce_executive') return 'Executive@123456';
  if (r === 'delivery_boy') return 'Delivery@123456';
  if (r === 'reviewer') return 'Reviewer@123456';
  if (r === 'hr') return 'Hr@123456';
  if (r === 'technician') return 'Technician@123456';
  if (r === 'support') return 'Support@123456';
  return 'Employee@123456';
};

async function migrate() {
  console.log('🔄 Checking users table schema for display_password column...');
  try {
    const [cols] = await sequelize.query("PRAGMA table_info('users')");
    const hasDisplayPassword = cols.some(c => c.name === 'display_password');
    if (!hasDisplayPassword) {
      console.log('Adding display_password column to users table...');
      await sequelize.query('ALTER TABLE users ADD COLUMN display_password VARCHAR(255);');
      console.log('✅ Column display_password added.');
    } else {
      console.log('Column display_password already exists.');
    }
  } catch (err) {
    console.error('Error verifying/adding column:', err.message);
  }

  const allUsers = await User.findAll();
  console.log(`Found ${allUsers.length} users to verify and populate passwords...`);

  let updatedCount = 0;
  for (const u of allUsers) {
    const emailKey = (u.email || '').toLowerCase().trim();
    const targetPassword = USER_CREDENTIAL_MAP[emailKey] || resolveFallbackPassword(u.role);
    if (!u.display_password || u.display_password !== targetPassword) {
      u.display_password = targetPassword;
      await u.save({ hooks: false });
      updatedCount++;
      console.log(`  ✓ Updated ${u.email} (${u.role}): ${targetPassword}`);
    }
  }

  console.log(`🎉 Finished backfilling display_password for ${updatedCount} users.`);
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
