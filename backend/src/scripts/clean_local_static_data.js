'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const { connectDB, sequelize } = require('../config/database');
const {
  User,
  Employee,
  UserPermission,
  Customer,
  Order,
  Warranty,
  syncModels,
} = require('../models');
const logger = require('../config/logger');

const cleanLocalStaticData = async () => {
  const dbHost = process.env.DB_HOST || 'localhost';
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(dbHost.toLowerCase());

  if (!isLocal) {
    logger.error(`🛑 SAFETY GUARD: DB_HOST is '${dbHost}', which is not localhost! Aborting to protect non-local databases.`);
    process.exit(1);
  }

  logger.info(`🔌 Connecting to local MySQL database on ${dbHost}...`);
  await connectDB();
  await syncModels({ force: false });

  logger.info('🧹 [CLEANUP] Starting cleanup of local static data & demo accounts...');

  const PRIMARY_ADMIN_EMAIL = 'admin@krishnacrm.com';

  // 1. Temporarily disable FK checks to cleanly truncate/delete
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

  const tablesToClear = [
    // Orders, Customers & Logistics
    'order_events',
    'order_activities',
    'customer_images',
    'manual_call_logs',
    'follow_ups',
    'csv_import_batches',
    'orders',
    'customers',
    'shipping_partners',
    'pincode_serviceability',

    // WhatsApp Communications
    'whatsapp_outbox',
    'whatsapp_logs',
    'whatsapp_batches',
    'whatsapp_rate_limit_events',

    // Warranties & Field Tickets
    'warranty_events',
    'warranty_documents',
    'warranty_service_requests',
    'warranty_returns',
    'warranty_messages',
    'warranties',

    // Tasks & Activities
    'daily_task_histories',
    'daily_tasks',
    'daily_activity_histories',
    'daily_activities',
    'tasks',

    // Business & Marketing Stubs
    'product_reviews',
    'accounting_records',
    'cheque_collections',
    'ad_campaign_metrics',
    'keyword_metrics',
    'return_claims',

    // Biometrics & Attendance Days
    'biometric_punch_events',
    'attendance_segments',
    'attendance_days',
    'attendance_corrections',
    'attendance_events',
    'attendance_sync_runs',
    'attendance_audit_logs',
    'employee_biometric_mappings',

    // HR Payroll Records
    'payroll_records',
    'payroll_profiles',
    'employee_audit_events',
    'employee_audit_daily_summaries',
    'employee_documents',

    // Audit and system test logs
    'reset_audit_logs',
    'login_histories',
    'user_audit_logs',
  ];

  for (const table of tablesToClear) {
    try {
      await sequelize.query(`DELETE FROM \`${table}\`;`);
      logger.info(`  ✓ Cleared table: ${table}`);
    } catch (err) {
      logger.warn(`  Notice clearing table ${table}: ${err.message}`);
    }
  }

  // 2. Ensure Super Admin user exists and is fully active
  let adminUser = await User.findOne({
    where: { email: PRIMARY_ADMIN_EMAIL },
    paranoid: false,
  });

  if (!adminUser) {
    adminUser = await User.create({
      name: 'Super Admin',
      email: PRIMARY_ADMIN_EMAIL,
      password: 'Admin@123456',
      display_password: 'Admin@123456',
      role: 'admin',
      department: 'Executive Management',
      designation: 'Super Admin',
      is_active: true,
      status: 'active',
    });
    logger.info(`  ✅ Created Super Admin account: ${PRIMARY_ADMIN_EMAIL}`);
  } else {
    if (adminUser.deletedAt) {
      await adminUser.restore();
    }
    adminUser.is_active = true;
    adminUser.display_password = 'Admin@123456';
    adminUser.role = 'admin';
    await adminUser.save();
    logger.info(`  ✅ Preserved Super Admin account: ${PRIMARY_ADMIN_EMAIL}`);
  }

  // 3. Remove all other users
  const { Op } = require('sequelize');
  const deletedUsersCount = await User.destroy({
    where: {
      email: { [Op.ne]: PRIMARY_ADMIN_EMAIL },
    },
    force: true,
  });
  logger.info(`  ✓ Purged ${deletedUsersCount} demo user(s) from 'users'.`);

  // Remove overrides and audit entries for non-admin users
  await sequelize.query(`DELETE FROM user_permissions WHERE user_id != '${adminUser.id}';`).catch(() => {});
  await sequelize.query(`DELETE FROM login_histories WHERE user_id != '${adminUser.id}';`).catch(() => {});
  await sequelize.query(`DELETE FROM user_audit_logs WHERE target_user_id != '${adminUser.id}' AND actor_user_id != '${adminUser.id}';`).catch(() => {});
  await sequelize.query(`DELETE FROM access_requests WHERE user_id != '${adminUser.id}';`).catch(() => {});

  // 4. Clean Employee table — retain only Super Admin employee profile
  await sequelize.query(`DELETE FROM employees WHERE user_id != '${adminUser.id}' AND email != '${PRIMARY_ADMIN_EMAIL}';`).catch(() => {});
  
  // Sync Super Admin to Employee directory
  const { syncUserToEmployee } = require('../services/userEmployeeSyncService');
  await syncUserToEmployee(adminUser);
  logger.info(`  ✓ Synchronized Super Admin in Employee directory.`);

  // 5. Re-enable FK checks
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

  // 6. Clean local uploaded media files in uploads/
  const uploadsRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
  if (fs.existsSync(uploadsRoot)) {
    const subdirs = ['customer_images', 'documents', 'invoices', 'temp', 'csv'];
    let unlinkedFiles = 0;
    for (const sub of subdirs) {
      const dirPath = path.join(uploadsRoot, sub);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          try {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              unlinkedFiles++;
            }
          } catch (_) {}
        }
      } else {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
    logger.info(`  ✓ Unlinked ${unlinkedFiles} local static file(s) from uploads/`);
  }

  // 7. Verify final database state
  const [usersCount, custCount, ordCount, warCount, empCount] = await Promise.all([
    User.count(),
    Customer.count(),
    Order.count(),
    Warranty.count(),
    Employee.count(),
  ]);

  logger.info('\n==================================================');
  logger.info('🎉 LOCAL CLEANUP AUDIT SUMMARY:');
  logger.info(`  Users Count         : ${usersCount} (Only Super Admin: ${PRIMARY_ADMIN_EMAIL})`);
  logger.info(`  Employees Count     : ${empCount} (Super Admin Employee)`);
  logger.info(`  Customers Count     : ${custCount} (Completely Cleared)`);
  logger.info(`  Orders Count        : ${ordCount} (Completely Cleared)`);
  logger.info(`  Warranties Count    : ${warCount} (Completely Cleared)`);
  logger.info('==================================================');
  logger.info('🔑 Super Admin Credentials:');
  logger.info('   Email   : admin@krishnacrm.com');
  logger.info('   Password: Admin@123456');
  logger.info('   Role    : admin (Super Admin)');
  logger.info('==================================================\n');
};

if (require.main === module) {
  cleanLocalStaticData()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Cleanup script error:', err);
      process.exit(1);
    });
}

module.exports = cleanLocalStaticData;
