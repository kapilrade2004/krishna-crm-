'use strict';

require('dotenv').config();
const { connectDB, sequelize } = require('../config/database');
const { User, Employee, PayrollProfile, Role } = require('../models');
const logger = require('../config/logger');

const USERS_TO_SYNC = [
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

async function syncMissingUsers() {
  logger.info('🔌 Starting non-destructive sync of missing operational users...');
  
  await connectDB();

  let addedCount = 0;
  let updatedCount = 0;

  for (const u of USERS_TO_SYNC) {
    const names = u.name.split(' ');
    const firstName = names[0];
    const lastName = names.slice(1).join(' ') || firstName;

    // 1. Find or create the User
    let [user, created] = await User.findOrCreate({
      where: { email: u.email },
      defaults: {
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        phone: u.phone,
        department: u.department,
        designation: u.designation,
        employee_id: u.employee_code,
        is_active: true,
        status: 'active'
      }
    });

    if (created) {
      logger.info(`  ✓ Created new User: ${u.name} (${u.email})`);
      addedCount++;
    } else {
      // Safe non-destructive update of user fields if they are missing/incorrect
      let needsSave = false;
      if (!user.role) { user.role = u.role; needsSave = true; }
      if (!user.department) { user.department = u.department; needsSave = true; }
      if (!user.designation) { user.designation = u.designation; needsSave = true; }
      if (!user.employee_id) { user.employee_id = u.employee_code; needsSave = true; }
      if (needsSave) {
        await user.save();
        logger.info(`  ✓ Updated fields for existing User: ${u.name}`);
        updatedCount++;
      }
    }

    // 2. Find or create the linked Employee
    let [employee, empCreated] = await Employee.findOrCreate({
      where: { employee_code: u.employee_code },
      defaults: {
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
      }
    });

    if (empCreated) {
      logger.info(`    └─ Created Employee record for: ${u.name}`);
    } else {
      // Ensure user_id link is set
      if (!employee.user_id) {
        employee.user_id = user.id;
        await employee.save();
        logger.info(`    └─ Linked existing Employee record to User for: ${u.name}`);
      }
    }

    // 3. Find or create the Payroll Profile
    let [payrollProfile, payCreated] = await PayrollProfile.findOrCreate({
      where: { employee_id: employee.id },
      defaults: {
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
        status: 'active'
      }
    });

    if (payCreated) {
      logger.info(`    └─ Created Payroll Profile for: ${u.name}`);
    } else {
      // Update values if they are 0 or empty
      let needsPaySave = false;
      if (!payrollProfile.basic_salary || parseFloat(payrollProfile.basic_salary) === 0) {
        payrollProfile.basic_salary = u.basic_salary;
        needsPaySave = true;
      }
      if (!payrollProfile.fixed_allowances || parseFloat(payrollProfile.fixed_allowances) === 0) {
        payrollProfile.fixed_allowances = u.fixed_allowances;
        needsPaySave = true;
      }
      if (!payrollProfile.bank_name) {
        payrollProfile.bank_name = u.bank_name;
        needsPaySave = true;
      }
      if (!payrollProfile.bank_account_reference) {
        payrollProfile.bank_account_reference = u.bank_account_number;
        needsPaySave = true;
      }
      if (!payrollProfile.bank_ifsc) {
        payrollProfile.bank_ifsc = u.bank_ifsc;
        needsPaySave = true;
      }
      if (needsPaySave) {
        await payrollProfile.save();
        logger.info(`    └─ Updated Payroll Profile details for: ${u.name}`);
      }
    }
  }

  logger.info(`🎉 Sync Complete! Added ${addedCount} new users, updated ${updatedCount} users.`);
}

syncMissingUsers()
  .then(() => {
    logger.info('✅ Non-destructive sync script executed successfully.');
    process.exit(0);
  })
  .catch(err => {
    logger.error('❌ Sync script failed:', err);
    process.exit(1);
  });
