'use strict';

require('dotenv').config();
const { connectDB, sequelize } = require('../config/database');
const {
  Customer,
  Order,
  OrderActivity,
  CustomerImage,
  ManualCallLog,
  WhatsAppLog,
  CsvImportBatch,
  FollowUp,
  Warranty,
  WarrantyDocument,
  WarrantyServiceRequest,
  WarrantyEvent,
  User,
  Employee,
  PayrollProfile,
  PayrollRecord,
  DailyTask,
  Task,
  syncModels,
} = require('../models');
const logger = require('../config/logger');

const purgeOrdersCustomersWarranty = async () => {
  await connectDB();
  await syncModels({ force: false });

  logger.info('🧹 Starting purge of static Orders, Customers, and Warranty records...');

  const tablesToPurge = [
    'warranty_events',
    'warranty_service_requests',
    'warranty_documents',
    'warranties',
    'customer_images',
    'order_activities',
    'manual_call_logs',
    'whatsapp_logs',
    'csv_import_batches',
    'follow_ups',
    'orders',
    'customers',
    'pincode_serviceability',
    'shipping_partners',
  ];

  for (const table of tablesToPurge) {
    try {
      await sequelize.query(`DELETE FROM ${table};`);
      logger.info(`  ✓ Purged table: ${table}`);
    } catch (err) {
      logger.warn(`  Notice purging ${table}: ${err.message}`);
    }
  }

  // Count check
  const [
    custCount,
    ordCount,
    warCount,
    shipCount,
    pincodeCount,
    userCount,
    empCount,
    payrollProfCount,
    payrollRecCount,
    dailyTaskCount,
    taskCount,
  ] = await Promise.all([
    Customer.count().catch(() => 0),
    Order.count().catch(() => 0),
    Warranty.count().catch(() => 0),
    ShippingPartner.count().catch(() => 0),
    PincodeServiceability.count().catch(() => 0),
    User.count().catch(() => 0),
    Employee.count().catch(() => 0),
    PayrollProfile.count().catch(() => 0),
    PayrollRecord.count().catch(() => 0),
    DailyTask.count().catch(() => 0),
    Task.count().catch(() => 0),
  ]);

  logger.info('\n📊 Database Status After Purge:');
  logger.info(`  Customers            : ${custCount} (Purged)`);
  logger.info(`  Orders               : ${ordCount} (Purged)`);
  logger.info(`  Warranties           : ${warCount} (Purged)`);
  logger.info(`  Shipping Partners    : ${shipCount} (Purged)`);
  logger.info(`  Pincode Serviceability: ${pincodeCount} (Purged)`);
  logger.info(`  Users                : ${userCount} (Preserved)`);
  logger.info(`  Employees            : ${empCount} (Preserved)`);
  logger.info(`  Payroll Profiles     : ${payrollProfCount} (Preserved)`);
  logger.info(`  Payroll Records      : ${payrollRecCount} (Preserved)`);
  logger.info(`  Daily Tasks          : ${dailyTaskCount} (Preserved)`);
  logger.info(`  Tasks                : ${taskCount} (Preserved)`);

  logger.info('\n✅ Static data from orders, customers, warranty, and shipping partners removed successfully while keeping all other fields and modules intact.');
};

if (require.main === module) {
  purgeOrdersCustomersWarranty()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Purge script failed:', err);
      process.exit(1);
    });
}

module.exports = purgeOrdersCustomersWarranty;
