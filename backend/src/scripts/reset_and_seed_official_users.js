'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, sequelize } = require('../config/database');
const {
  User,
  Employee,
  PayrollProfile,
  Role,
  syncModels,
} = require('../models');
const logger = require('../config/logger');

const OFFICIAL_USERS = [
  {
    name: 'Super Admin',
    email: 'admin@krishnacrm.com',
    password: 'Admin@123456',
    role: 'admin',
    phone: '9820011001',
    department: 'Executive Management',
    designation: 'Managing Director',
    employee_code: 'KR-EMP-001',
    employment_type: 'full_time',
    date_of_joining: '2023-01-01',
    basic_salary: 120000,
    fixed_allowances: 30000,
    fixed_deductions: 5000,
    bank_name: 'HDFC Bank',
    bank_account_number: '50100234567890',
    bank_ifsc: 'HDFC0000001',
  },
  {
    name: 'Sushil',
    email: 'sushil@akuabeat.com',
    password: 'Reviewer@123456',
    role: 'reviewer',
    phone: '9898989898',
    department: 'Product & Quality',
    designation: 'Reviewer',
    employee_code: 'KR-REV-001',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 22000,
    fixed_allowances: 3000,
    fixed_deductions: 800,
    bank_name: 'HDFC Bank',
    bank_account_number: '501009990003',
    bank_ifsc: 'HDFC0000001',
  },
  {
    name: 'Yash',
    email: 'yash.telecaller@nityamenterprises.com',
    password: 'Telecaller@123456',
    role: 'telecaller',
    phone: '8169637672',
    department: 'Customer Support',
    designation: 'Telecaller',
    employee_code: 'KR-TEL-002',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 24000,
    fixed_allowances: 4000,
    fixed_deductions: 1000,
    bank_name: 'State Bank of India',
    bank_account_number: '30987654901',
    bank_ifsc: 'SBIN0000300',
  },
  {
    name: 'Meenakshi',
    email: 'meenakshi.telecaller@nityamenterprises.com',
    password: 'Telecaller@123456',
    role: 'telecaller',
    phone: '9152815055',
    department: 'Customer Support',
    designation: 'Telecaller',
    employee_code: 'KR-TEL-003',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 24000,
    fixed_allowances: 4000,
    fixed_deductions: 1000,
    bank_name: 'State Bank of India',
    bank_account_number: '30987654902',
    bank_ifsc: 'SBIN0000300',
  },
  {
    name: 'Sanjay',
    email: 'sanjay.accountant@leretailproject.com',
    password: 'Accountant@123456',
    role: 'accountant',
    phone: '9987930521',
    department: 'Finance & Accounts',
    designation: 'Accountant',
    employee_code: 'KR-ACC-001',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 30000,
    fixed_allowances: 5000,
    fixed_deductions: 1200,
    bank_name: 'Axis Bank',
    bank_account_number: '912010099901',
    bank_ifsc: 'UTIB0000045',
  },
  {
    name: 'Riya',
    email: 'riya.accountant@leretailproject.com',
    password: 'Accountant@123456',
    role: 'accountant',
    phone: '9820011015',
    department: 'Finance & Accounts',
    designation: 'Accountant',
    employee_code: 'KR-ACC-002',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 30000,
    fixed_allowances: 5000,
    fixed_deductions: 1200,
    bank_name: 'Axis Bank',
    bank_account_number: '912010099902',
    bank_ifsc: 'UTIB0000045',
  },
  {
    name: 'Priti',
    email: 'priti.accountant@leretailproject.com',
    password: 'Accountant@123456',
    role: 'accountant',
    phone: '9820011016',
    department: 'Finance & Accounts',
    designation: 'Accountant',
    employee_code: 'KR-ACC-003',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 30000,
    fixed_allowances: 5000,
    fixed_deductions: 1200,
    bank_name: 'Axis Bank',
    bank_account_number: '912010099903',
    bank_ifsc: 'UTIB0000045',
  },
  {
    name: 'Naushad',
    email: 'smallbusiness.ecs@gmail.com',
    password: 'Manager@123456',
    role: 'spn_ads_manager',
    phone: '7977820947',
    department: 'E-Commerce & Marketing',
    designation: 'SPN & ADs Manager',
    employee_code: 'KR-SPN-001',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 50000,
    fixed_allowances: 10000,
    fixed_deductions: 2000,
    bank_name: 'ICICI Bank',
    bank_account_number: '001105009901',
    bank_ifsc: 'ICIC0000011',
  },
  {
    name: 'Bharat',
    email: 'bharat.manager@nityamenterprises.com',
    password: 'Manager@123456',
    role: 'senior_account_manager',
    phone: '9021102407',
    department: 'Account Management',
    designation: 'Senior Account Manager',
    employee_code: 'KR-SAM-001',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 60000,
    fixed_allowances: 12000,
    fixed_deductions: 2500,
    bank_name: 'HDFC Bank',
    bank_account_number: '501009990001',
    bank_ifsc: 'HDFC0000001',
  },
  {
    name: 'Manoj',
    email: 'manoj.delivery@krishnacrm.com',
    password: 'Delivery@123456',
    role: 'delivery_boy',
    phone: '8149229217',
    department: 'Logistics & Office',
    designation: 'Delivery Boy',
    employee_code: 'KR-DEL-001',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 20000,
    fixed_allowances: 3000,
    fixed_deductions: 800,
    bank_name: 'Bank of Baroda',
    bank_account_number: '0543010009999',
    bank_ifsc: 'BARB0BORIVX',
  },
  {
    name: 'Shruti',
    email: 'shruti.ecom@nityamenterprises.com',
    password: 'Executive@123456',
    role: 'ecommerce_executive',
    phone: '7379790673',
    department: 'E-Commerce Operations',
    designation: 'E-Commerce Executive',
    employee_code: 'KR-ECM-001',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 28000,
    fixed_allowances: 5000,
    fixed_deductions: 1100,
    bank_name: 'HDFC Bank',
    bank_account_number: '501009990002',
    bank_ifsc: 'HDFC0000001',
  },
  {
    name: 'Faijal',
    email: 'faijal.ecom@nityamenterprises.com',
    password: 'Executive@123456',
    role: 'ecommerce_executive',
    phone: '9651081945',
    department: 'E-Commerce Operations',
    designation: 'E-Commerce Executive',
    employee_code: 'KR-ECM-002',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 28000,
    fixed_allowances: 5000,
    fixed_deductions: 1100,
    bank_name: 'HDFC Bank',
    bank_account_number: '501009990004',
    bank_ifsc: 'HDFC0000001',
  },
  {
    name: 'Priya',
    email: 'priya.ecom@nityamenterprises.com',
    password: 'Executive@123456',
    role: 'ecommerce_executive',
    phone: '9082556657',
    department: 'E-Commerce Operations',
    designation: 'E-Commerce Executive',
    employee_code: 'KR-ECM-003',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 28000,
    fixed_allowances: 5000,
    fixed_deductions: 1100,
    bank_name: 'HDFC Bank',
    bank_account_number: '501009990005',
    bank_ifsc: 'HDFC0000001',
  },
  {
    name: 'Laxmi',
    email: 'laxmi.exec@nityamenterprises.com',
    password: 'Employee@123456',
    role: 'employee',
    phone: '9820011018',
    department: 'General Operations',
    designation: 'Operations Executive',
    employee_code: 'KR-EMP-018',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 25000,
    fixed_allowances: 4000,
    fixed_deductions: 1000,
    bank_name: 'Kotak Mahindra Bank',
    bank_account_number: '4411223399',
    bank_ifsc: 'KKBK0000651',
  },
  {
    name: 'Manish',
    email: 'manish.exec@nityamenterprises.com',
    password: 'Employee@123456',
    role: 'employee',
    phone: '9820011019',
    department: 'General Operations',
    designation: 'Operations Executive',
    employee_code: 'KR-EMP-019',
    employment_type: 'full_time',
    date_of_joining: '2024-04-01',
    basic_salary: 25000,
    fixed_allowances: 4000,
    fixed_deductions: 1000,
    bank_name: 'Kotak Mahindra Bank',
    bank_account_number: '4411223398',
    bank_ifsc: 'KKBK0000651',
  },
];

const resetAndSeedOfficialUsers = async () => {
  await connectDB();
  await syncModels({ force: false });

  logger.info('🧹 Removing all existing/stale users, employee records & payroll profiles...');

  // Tables to wipe
  const tables = [
    'login_histories',
    'user_audit_logs',
    'access_requests',
    'user_permissions',
    'daily_activity_histories',
    'daily_activities',
    'daily_task_histories',
    'daily_tasks',
    'payroll_records',
    'payroll_profiles',
    'employee_documents',
    'employees',
    'users',
  ];

  for (const t of tables) {
    try {
      await sequelize.query(`DELETE FROM ${t};`);
      logger.info(`  ✓ Cleared table: ${t}`);
    } catch (e) {
      logger.warn(`  Notice clearing ${t}: ${e.message}`);
    }
  }

  // Ensure system roles exist
  const SYSTEM_ROLES = [
    { id: 'r-super-admin', name: 'Super admin', description: 'Master login with full system access and unrestricted control.', data_scope: 'Global', is_system: true },
    { id: 'r-manager',     name: 'Manager',     description: 'Operational management over teams, orders, tasks, and reports.',     data_scope: 'Global', is_system: true },
    { id: 'r-hr',          name: 'Hr',          description: 'HR access for employee profiles, documents, and payroll.',           data_scope: 'Global', is_system: true },
    { id: 'r-sales',       name: 'Sales',       description: 'Sales and order processing access across marketplaces.',             data_scope: 'Global', is_system: true },
    { id: 'r-telecaller',  name: 'Telecaller',  description: 'Telecalling leads, verification calls, and customer follow-ups.',    data_scope: 'Global', is_system: true },
    { id: 'r-technician',  name: 'Technician',  description: 'Field service technician for warranty repairs and installation.',   data_scope: 'Global', is_system: true },
    { id: 'r-employee',    name: 'Employee',    description: 'Standard employee portal access for profile, attendance and tasks.', data_scope: 'Department', is_system: true },
    { id: 'r-reviewer',    name: 'Reviewer',    description: 'Product reviews management, moderation, and rating verification.',    data_scope: 'Global', is_system: true },
    { id: 'r-accountant',  name: 'Accountant',  description: 'Tally entry, stock reconciliation, purchase & sales invoicing, and banking.', data_scope: 'Global', is_system: true },
    { id: 'r-spn-ads',     name: 'SPN & ADs Manager', description: 'Traffic growth, keyword management, bid optimization, and ads monitoring.', data_scope: 'Global', is_system: true },
    { id: 'r-sr-acct-mgr', name: 'Senior Account Manager', description: 'Account health, coupon activation, team performance, and profitability.', data_scope: 'Global', is_system: true },
    { id: 'r-delivery-boy',name: 'Delivery Boy',description: 'Product/document deliveries, office assignments, and cheque collections.',       data_scope: 'Global', is_system: true },
    { id: 'r-ecom-exec',   name: 'E-Commerce Executive', description: 'Channel orders, marketplace listing, return claims, and putaway.',       data_scope: 'Global', is_system: true },
  ];

  for (const r of SYSTEM_ROLES) {
    await Role.findOrCreate({ where: { name: r.name }, defaults: r });
  }

  logger.info('\n🌱 Creating only official system users and employee records...');
  const { syncUserMandatoryTasks } = require('../services/mandatoryTaskService');

  for (const u of OFFICIAL_USERS) {
    const names = u.name.split(' ');
    const firstName = names[0];
    const lastName = names.slice(1).join(' ') || firstName;

    // Create User record (Password hook will single-hash plaintext password)
    const user = await User.create({
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      phone: u.phone,
      department: u.department,
      designation: u.designation,
      employee_id: u.employee_code,
      is_active: true,
    });

    // Create corresponding Employee record
    const employee = await Employee.create({
      user_id: user.id,
      employee_code: u.employee_code,
      first_name: firstName,
      last_name: lastName,
      email: u.email,
      phone: u.phone,
      department: u.department,
      designation: u.designation,
      employment_type: u.employment_type,
      date_of_joining: u.date_of_joining,
      status: 'active',
      onboarding_status: 'completed',
    });

    // Create Payroll Profile
    await PayrollProfile.create({
      employee_id: employee.id,
      salary_type: 'monthly',
      basic_salary: u.basic_salary,
      fixed_allowances: u.fixed_allowances,
      fixed_deductions: u.fixed_deductions,
      payment_method: 'bank_transfer',
      bank_name: u.bank_name,
      bank_account_reference: u.bank_account_number,
      bank_ifsc: u.bank_ifsc,
      notes: 'Standard official payroll profile',
    });

    // Seed mandatory daily tasks from catalog
    try {
      const taskRes = await syncUserMandatoryTasks(user);
      if (taskRes && taskRes.created > 0) {
        logger.info(`     ↳ Assigned ${taskRes.created} daily mandatory routine tasks from catalog`);
      }
    } catch (tErr) {
      logger.warn(`     Notice assigning daily tasks: ${tErr.message}`);
    }

    logger.info(`  ✅ Created User & Employee: ${u.role.toUpperCase().padEnd(12)} -> ${u.name} (${u.email})`);
  }

  const [totalUsers, totalEmployees, totalPayroll] = await Promise.all([
    User.count(),
    Employee.count(),
    PayrollProfile.count(),
  ]);

  logger.info('\n📊 Final User Directory Status:');
  logger.info(`  Total Users     : ${totalUsers}`);
  logger.info(`  Total Employees : ${totalEmployees}`);
  logger.info(`  Payroll Profiles: ${totalPayroll}`);
  logger.info('\n🔑 Official Listed Credentials:');
  for (const u of OFFICIAL_USERS) {
    logger.info(`  • ${u.name.padEnd(18)} | ${u.email.padEnd(30)} | ${u.password.padEnd(15)} | Role: ${u.role}`);
  }
};

if (require.main === module) {
  resetAndSeedOfficialUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Failed to reset and seed official users:', err);
      process.exit(1);
    });
}

module.exports = { resetAndSeedOfficialUsers, OFFICIAL_USERS };
