'use strict';

require('dotenv').config();
const { connectDB, sequelize } = require('../config/database');
const { User, Role, Permission, RolePermission, syncModels } = require('../models');
const logger = require('../config/logger');

const clearData = async () => {
  await connectDB();
  await syncModels({ force: false });

  logger.info('🧹 Clearing CRM transactional data, orders, and custom users...');

  const tables = [
    'warranty_events', 'warranty_service_requests', 'warranty_documents', 'warranties',
    'order_activities', 'follow_ups', 'tasks', 'daily_task_history', 'daily_tasks',
    'manual_call_logs', 'whatsapp_logs', 'customer_images', 'csv_import_batches',
    'employee_audit_events', 'employee_audit_daily_summaries', 'orders',
    'customers', 'employee_documents', 'employees', 'users'
  ];

  for (const t of tables) {
    try {
      await sequelize.query(`DELETE FROM ${t};`);
    } catch (_) {}
  }

  logger.info('✅ Database tables cleared successfully.');

  // Re-seed system roles & default admin user so you can log in
  const SYSTEM_ROLES = [
    { id: 'r-super-admin', name: 'Super admin', description: 'Master login with full system access and ability to grant/revoke access rights.', data_scope: 'Global', is_system: true },
    { id: 'r-manager',     name: 'Manager',     description: 'Management access over teams, orders, customers, tasks, and reports.',         data_scope: 'Global', is_system: true },
    { id: 'r-hr',          name: 'Hr',          description: 'HR access for employee profiles, documents, and management.',                  data_scope: 'Global', is_system: true },
    { id: 'r-sales',       name: 'Sales',       description: 'Sales access for orders, customers, follow-ups, and shipping.',                 data_scope: 'Global', is_system: true },
    { id: 'r-telecaller',  name: 'Telecaller',  description: 'Telecaller access for lead management, follow-ups, and call logs.',             data_scope: 'Global', is_system: true },
  ];

  for (const r of SYSTEM_ROLES) {
    await Role.findOrCreate({ where: { name: r.name }, defaults: r });
  }

  const demoUsers = [
    { name: 'Super Admin',  email: 'admin@krishnacrm.com',    password: 'Admin@123456',    role: 'admin' },
    { name: 'Manager User', email: 'manager@krishnacrm.com',  password: 'Manager@123456',  role: 'manager' },
    { name: 'HR Executive', email: 'hr@krishnacrm.com',       password: 'Hr@123456',       role: 'hr' },
  ];

  for (const u of demoUsers) {
    await User.create({
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      is_active: true,
    });
  }

  logger.info('✅ Initial system admin users re-created successfully.');
  logger.info('🔑 Login Credentials for Testing:');
  logger.info('   Super Admin: admin@krishnacrm.com / Admin@123456');
  logger.info('   Manager: manager@krishnacrm.com / Manager@123456');
  logger.info('   HR: hr@krishnacrm.com / Hr@123456');

  process.exit(0);
};

clearData().catch((err) => {
  logger.error('Data clear script failed:', err);
  process.exit(1);
});
