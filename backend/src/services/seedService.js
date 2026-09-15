'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — MASTER STATIC SEED SERVICE (PRODUCTION BASELINE)
 *  Seeds fully functional, interconnected static records for:
 *  1. Roles, Permissions & Core Demo Users
 *  2. Employees, Documents & Multi-Month Payroll Records (HR Module)
 *  3. Daily Activities & Tasks (All 5 State Workflows + History)
 *  4. Employee Audit Events & Daily Performance Summaries
 *  5. Customers & Telecaller/Sales Follow-ups
 * ═══════════════════════════════════════════════════════════════════════════
 */

const bcrypt = require('bcryptjs');
const {
  sequelize,
  User,
  Customer,
  Order,
  OrderActivity,
  FollowUp,
  Task,
  CsvImportBatch,
  WhatsAppLog,
  ManualCallLog,
  CustomerImage,
  ShippingPartner,
  PincodeServiceability,
  Employee,
  EmployeeDocument,
  Role,
  Permission,
  RolePermission,
  UserPermission,
  DailyTask,
  DailyTaskHistory,
  DailyActivity,
  DailyActivityHistory,
  EmployeeAuditEvent,
  EmployeeAuditDailySummary,
  Warranty,
  WarrantyDocument,
  WarrantyServiceRequest,
  WarrantyEvent,
  LoginHistory,
  UserAuditLog,
  AccessTemplate,
  AccessRequest,
  PayrollProfile,
  PayrollRecord,
  syncModels,
} = require('../models');
const logger = require('../config/logger');

async function seedComprehensiveCRMData() {
  logger.info('🌱 [SeedService] Starting comprehensive static CRM data seeding...');
  await syncModels({ force: false });

  const now = new Date();
  const shiftHoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000);
  const shiftHoursAhead = (h) => new Date(now.getTime() + h * 3600 * 1000);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ROLES & PERMISSIONS
  // ─────────────────────────────────────────────────────────────────────────
  const rolesData = [
    { id: 'r-super-admin', name: 'Super admin', description: 'Master login with full system access and unrestricted control.', data_scope: 'Global', is_system: true },
    { id: 'r-manager',     name: 'Manager',     description: 'Operational management over teams, orders, tasks, and reports.',     data_scope: 'Global', is_system: true },
    { id: 'r-hr',          name: 'Hr',          description: 'HR access for employee profiles, documents, and payroll.',           data_scope: 'Global', is_system: true },
    { id: 'r-sales',       name: 'Sales',       description: 'Sales and order processing access across marketplaces.',             data_scope: 'Global', is_system: true },
    { id: 'r-telecaller',  name: 'Telecaller',  description: 'Telecalling leads, verification calls, and customer follow-ups.',    data_scope: 'Global', is_system: true },
    { id: 'r-technician',  name: 'Technician',  description: 'Field service technician for warranty repairs and installation.',   data_scope: 'Global', is_system: true },
    { id: 'r-employee',    name: 'Employee',    description: 'General staff for shift activities, personal documents, and profile.', data_scope: 'Department', is_system: true },
    { id: 'r-reviewer',    name: 'Reviewer',    description: 'Product reviews management, moderation, and rating verification.',    data_scope: 'Global', is_system: true },
    { id: 'r-accountant',  name: 'Accountant',  description: 'Tally entry, stock reconciliation, purchase & sales invoicing, and banking.', data_scope: 'Global', is_system: true },
    { id: 'r-spn-ads',     name: 'SPN & ADs Manager', description: 'Traffic growth, keyword management, bid optimization, and ads monitoring.', data_scope: 'Global', is_system: true },
    { id: 'r-sr-acct-mgr', name: 'Senior Account Manager', description: 'Account health, coupon activation, team performance, and profitability.', data_scope: 'Global', is_system: true },
    { id: 'r-delivery-boy',name: 'Delivery Boy',description: 'Product/document deliveries, office assignments, and cheque collections.',       data_scope: 'Global', is_system: true },
    { id: 'r-ecom-exec',   name: 'E-Commerce Executive', description: 'Channel orders, marketplace listing, return claims, and putaway.',       data_scope: 'Global', is_system: true },
  ];

  for (const r of rolesData) {
    await Role.findOrCreate({ where: { name: r.name }, defaults: r });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CORE SYSTEM USERS
  // ─────────────────────────────────────────────────────────────────────────
  const usersSeed = [
    {
      name: 'Super Admin',
      first_name: 'Super',
      last_name: 'Admin',
      email: 'admin@krishnacrm.com',
      password: 'Admin@123456',
      role: 'admin',
      phone: '9820011001',
      department: 'Executive Management',
      designation: 'Managing Director',
      employee_id: 'KR-EMP-001',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Sushil',
      first_name: 'Sushil',
      last_name: '',
      email: 'sushil@akuabeat.com',
      password: 'Reviewer@123456',
      role: 'reviewer',
      phone: '9898989898',
      department: 'Product & Quality',
      designation: 'Reviewer',
      employee_id: 'KR-REV-001',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Yash',
      first_name: 'Yash',
      last_name: '',
      email: 'yash.telecaller@nityamenterprises.com',
      password: 'Telecaller@123456',
      role: 'telecaller',
      phone: '8169637672',
      department: 'Customer Support',
      designation: 'Telecaller',
      employee_id: 'KR-TEL-002',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Meenakshi',
      first_name: 'Meenakshi',
      last_name: '',
      email: 'meenakshi.telecaller@nityamenterprises.com',
      password: 'Telecaller@123456',
      role: 'telecaller',
      phone: '9152815055',
      department: 'Customer Support',
      designation: 'Telecaller',
      employee_id: 'KR-TEL-003',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Sanjay',
      first_name: 'Sanjay',
      last_name: '',
      email: 'sanjay.accountant@leretailproject.com',
      password: 'Accountant@123456',
      role: 'accountant',
      phone: '9987930521',
      department: 'Finance & Accounts',
      designation: 'Accountant',
      employee_id: 'KR-ACC-001',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Riya',
      first_name: 'Riya',
      last_name: '',
      email: 'riya.accountant@leretailproject.com',
      password: 'Accountant@123456',
      role: 'accountant',
      phone: '9820011015',
      department: 'Finance & Accounts',
      designation: 'Accountant',
      employee_id: 'KR-ACC-002',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Priti',
      first_name: 'Priti',
      last_name: '',
      email: 'priti.accountant@leretailproject.com',
      password: 'Accountant@123456',
      role: 'accountant',
      phone: '9820011016',
      department: 'Finance & Accounts',
      designation: 'Accountant',
      employee_id: 'KR-ACC-003',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Naushad',
      first_name: 'Naushad',
      last_name: '',
      email: 'smallbusiness.ecs@gmail.com',
      password: 'Manager@123456',
      role: 'spn_ads_manager',
      phone: '7977820947',
      department: 'E-Commerce & Marketing',
      designation: 'SPN & ADs Manager',
      employee_id: 'KR-SPN-001',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Bharat',
      first_name: 'Bharat',
      last_name: '',
      email: 'bharat.manager@nityamenterprises.com',
      password: 'Manager@123456',
      role: 'senior_account_manager',
      phone: '9021102407',
      department: 'Account Management',
      designation: 'Senior Account Manager',
      employee_id: 'KR-SAM-001',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Manoj',
      first_name: 'Manoj',
      last_name: '',
      email: 'manoj.delivery@krishnacrm.com',
      password: 'Delivery@123456',
      role: 'delivery_boy',
      phone: '8149229217',
      department: 'Logistics & Office',
      designation: 'Delivery Boy',
      employee_id: 'KR-DEL-001',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Shruti',
      first_name: 'Shruti',
      last_name: '',
      email: 'shruti.ecom@nityamenterprises.com',
      password: 'Executive@123456',
      role: 'ecommerce_executive',
      phone: '7379790673',
      department: 'E-Commerce Operations',
      designation: 'E-Commerce Executive',
      employee_id: 'KR-ECM-001',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Faijal',
      first_name: 'Faijal',
      last_name: '',
      email: 'faijal.ecom@nityamenterprises.com',
      password: 'Executive@123456',
      role: 'ecommerce_executive',
      phone: '9651081945',
      department: 'E-Commerce Operations',
      designation: 'E-Commerce Executive',
      employee_id: 'KR-ECM-002',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Priya',
      first_name: 'Priya',
      last_name: '',
      email: 'priya.ecom@nityamenterprises.com',
      password: 'Executive@123456',
      role: 'ecommerce_executive',
      phone: '9082556657',
      department: 'E-Commerce Operations',
      designation: 'E-Commerce Executive',
      employee_id: 'KR-ECM-003',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Laxmi',
      first_name: 'Laxmi',
      last_name: '',
      email: 'laxmi.exec@nityamenterprises.com',
      password: 'Employee@123456',
      role: 'employee',
      phone: '9820011018',
      department: 'General Operations',
      designation: 'Operations Executive',
      employee_id: 'KR-EMP-018',
      is_active: true,
      status: 'active',
    },
    {
      name: 'Manish',
      first_name: 'Manish',
      last_name: '',
      email: 'manish.exec@nityamenterprises.com',
      password: 'Employee@123456',
      role: 'employee',
      phone: '9820011019',
      department: 'General Operations',
      designation: 'Operations Executive',
      employee_id: 'KR-EMP-019',
      is_active: true,
      status: 'active',
    },
  ];

  const createdUsers = {};
  for (const u of usersSeed) {
    let user = await User.findOne({ where: { email: u.email } });
    if (!user) {
      user = await User.create(u);
    } else {
      user.password = u.password;
      user.name = u.name;
      user.first_name = u.first_name;
      user.last_name = u.last_name;
      user.role = u.role;
      user.phone = u.phone;
      user.department = u.department;
      user.designation = u.designation;
      user.employee_id = u.employee_id;
      user.is_active = true;
      user.status = 'active';
      await user.save();
    }
    const roleKey = u.role === 'admin' ? 'admin' : u.role;
    createdUsers[roleKey] = user;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. HR MODULE — EMPLOYEES, DOCUMENTS & PAYROLL (Past 3 Months)
  // ─────────────────────────────────────────────────────────────────────────
  const employeesSeed = [
    {
      user_id: createdUsers.admin?.id,
      employee_code: 'KR-EMP-001',
      first_name: 'Super',
      last_name: 'Admin',
      email: 'admin@krishnacrm.com',
      phone: '9820011001',
      department: 'Executive Management',
      designation: 'Managing Director',
      employment_type: 'full_time',
      date_of_joining: '2023-01-01',
      status: 'active',
      onboarding_status: 'completed',
      date_of_birth: '1985-06-15',
      gender: 'male',
      present_address: 'Flat 402, Krishna Heights, Powai, Mumbai',
      permanent_address: 'Flat 402, Krishna Heights, Powai, Mumbai',
      pan_number: 'ADMPA1234A',
      aadhaar_number: '987654321012',
      bank_name: 'HDFC Bank',
      bank_account_number: '50100123456789',
      bank_ifsc: 'HDFC0000123',
      basic_salary: 85000,
      fixed_allowances: 15000,
      fixed_deductions: 2500,
    },
    {
      user_id: createdUsers.manager?.id,
      employee_code: 'KR-EMP-002',
      first_name: 'Vikram',
      last_name: 'Malhotra',
      email: 'manager@krishnacrm.com',
      phone: '9820011002',
      department: 'Operations',
      designation: 'Operations Head',
      employment_type: 'full_time',
      date_of_joining: '2023-03-15',
      status: 'active',
      onboarding_status: 'completed',
      date_of_birth: '1988-11-20',
      gender: 'male',
      present_address: 'B-12, Palm Grove, Andheri East, Mumbai',
      permanent_address: 'B-12, Palm Grove, Andheri East, Mumbai',
      pan_number: 'MANPA5678B',
      aadhaar_number: '876543210987',
      bank_name: 'ICICI Bank',
      bank_account_number: '001105001234',
      bank_ifsc: 'ICIC0000011',
      basic_salary: 55000,
      fixed_allowances: 10000,
      fixed_deductions: 2000,
    },
    {
      user_id: createdUsers.hr?.id,
      employee_code: 'KR-EMP-003',
      first_name: 'Pooja',
      last_name: 'Hegde',
      email: 'hr@krishnacrm.com',
      phone: '9820011003',
      department: 'Human Resources',
      designation: 'HR Lead & People Ops',
      employment_type: 'full_time',
      date_of_joining: '2023-06-01',
      status: 'active',
      onboarding_status: 'completed',
      date_of_birth: '1992-04-10',
      gender: 'female',
      present_address: 'A-504, Symphony Towers, Goregaon West, Mumbai',
      permanent_address: 'A-504, Symphony Towers, Goregaon West, Mumbai',
      pan_number: 'HRPA9012C',
      aadhaar_number: '765432109876',
      bank_name: 'State Bank of India',
      bank_account_number: '30981234567',
      bank_ifsc: 'SBIN0001234',
      basic_salary: 45000,
      fixed_allowances: 8000,
      fixed_deductions: 1800,
    },
    {
      user_id: createdUsers.sales?.id,
      employee_code: 'KR-EMP-004',
      first_name: 'Rahul',
      last_name: 'Deshmukh',
      email: 'sales@krishnacrm.com',
      phone: '9820011004',
      department: 'Sales & Marketing',
      designation: 'Senior Sales Executive',
      employment_type: 'full_time',
      date_of_joining: '2023-09-01',
      status: 'active',
      onboarding_status: 'completed',
      date_of_birth: '1994-08-25',
      gender: 'male',
      present_address: 'C-302, Green Acres, Thane West',
      permanent_address: 'C-302, Green Acres, Thane West',
      pan_number: 'SALPA3456D',
      aadhaar_number: '654321098765',
      bank_name: 'Axis Bank',
      bank_account_number: '918010023456789',
      bank_ifsc: 'UTIB0000123',
      basic_salary: 35000,
      fixed_allowances: 7000,
      fixed_deductions: 1500,
    },
    {
      user_id: createdUsers.telecaller?.id,
      employee_code: 'KR-EMP-005',
      first_name: 'Neha',
      last_name: 'Sharma',
      email: 'telecaller@krishnacrm.com',
      phone: '9820011005',
      department: 'Customer Support',
      designation: 'Senior Telecaller',
      employment_type: 'full_time',
      date_of_joining: '2024-01-15',
      status: 'active',
      onboarding_status: 'completed',
      date_of_birth: '1995-12-05',
      gender: 'female',
      present_address: '104, Sunrise Apts, Kandivali East, Mumbai',
      permanent_address: '104, Sunrise Apts, Kandivali East, Mumbai',
      pan_number: 'TELPA7890E',
      aadhaar_number: '543210987654',
      bank_name: 'Kotak Mahindra Bank',
      bank_account_number: '431102001234',
      bank_ifsc: 'KKBK0000651',
      basic_salary: 28000,
      fixed_allowances: 5000,
      fixed_deductions: 1200,
    },
    {
      user_id: createdUsers.technician?.id,
      employee_code: 'KR-EMP-006',
      first_name: 'Amit',
      last_name: 'Shinde',
      email: 'technician@krishnacrm.com',
      phone: '9820011006',
      department: 'Field Service',
      designation: 'Lead Field Engineer',
      employment_type: 'full_time',
      date_of_joining: '2024-03-01',
      status: 'active',
      onboarding_status: 'completed',
      date_of_birth: '1993-07-18',
      gender: 'male',
      present_address: '22/B, Sai Krupa, Borivali East, Mumbai',
      permanent_address: '22/B, Sai Krupa, Borivali East, Mumbai',
      pan_number: 'SHIPA3322D',
      aadhaar_number: '432109876546',
      bank_name: 'Bank of Baroda',
      bank_account_number: '05430100012345',
      bank_ifsc: 'BARB0BORIVX',
      basic_salary: 32000,
      fixed_allowances: 6000,
      fixed_deductions: 1500,
    },
    {
      user_id: createdUsers.employee?.id,
      employee_code: 'KR-EMP-007',
      first_name: 'Standard',
      last_name: 'Employee',
      email: 'employee@krishnacrm.com',
      phone: '9820011007',
      department: 'General Operations',
      designation: 'Associate',
      employment_type: 'full_time',
      date_of_joining: '2024-04-01',
      status: 'active',
      onboarding_status: 'completed',
      date_of_birth: '1996-01-15',
      gender: 'male',
      present_address: '15, Blossom Apts, Malad West, Mumbai',
      permanent_address: '15, Blossom Apts, Malad West, Mumbai',
      pan_number: 'EMPAS9988E',
      aadhaar_number: '321098765432',
      bank_name: 'HDFC Bank',
      bank_account_number: '50100234567899',
      bank_ifsc: 'HDFC0000001',
      basic_salary: 25000,
      fixed_allowances: 4000,
      fixed_deductions: 1000,
    },
  ];

  const createdEmployees = {};
  const currentMonthStr = '2026-08';
  const prevMonths = ['2026-06', '2026-07', '2026-08'];

  for (const empData of employeesSeed) {
    const { basic_salary, fixed_allowances, fixed_deductions, ...cleanEmp } = empData;
    let employee = await Employee.findOne({ where: { employee_code: empData.employee_code } });
    if (!employee) {
      employee = await Employee.create(cleanEmp);
    } else {
      await employee.update(cleanEmp);
    }
    createdEmployees[empData.employee_code] = employee;

    // 3A. Configure Employee Payroll Profile
    await PayrollProfile.upsert({
      employee_id: employee.id,
      salary_type: 'monthly',
      basic_salary,
      fixed_allowances,
      fixed_deductions,
      payment_method: 'bank_transfer',
      bank_name: empData.bank_name,
      bank_account_number: empData.bank_account_number,
      bank_ifsc: empData.bank_ifsc,
      notes: 'Standard verified permanent payroll structure',
    });

    // 3B. Multi-month Historical Payslips
    for (const m of prevMonths) {
      await PayrollRecord.findOrCreate({
        where: {
          employee_id: employee.id,
          payroll_month: m,
        },
        defaults: {
          employee_id: employee.id,
          payroll_month: m,
          gross_amount: basic_salary + fixed_allowances,
          allowances: fixed_allowances,
          deductions: fixed_deductions,
          net_amount: basic_salary + fixed_allowances - fixed_deductions,
          payment_status: m === currentMonthStr ? 'approved' : 'paid',
          remarks: `Monthly Salary Credit for ${m}`,
        },
      });
    }

    // 3C. Seed Verified Employee Documents
    const docTypes = [
      { type: 'aadhaar_card', name: 'Aadhaar Card Front & Back', orig: 'aadhaar_card.pdf', status: 'verified' },
      { type: 'pan_card', name: 'PAN Card Official Copy', orig: 'pan_card.pdf', status: 'verified' },
      { type: 'bank_passbook', name: 'Cancelled Cheque / Bank Statement', orig: 'bank_statement.pdf', status: 'verified' },
      { type: 'appointment_letter', name: 'Signed Appointment & Offer Letter', orig: 'offer_letter.pdf', status: 'verified' },
      { type: 'educational_certificate', name: 'Degree & Graduation Certificate', orig: 'degree_certificate.pdf', status: 'verified' },
    ];

    for (const doc of docTypes) {
      await EmployeeDocument.findOrCreate({
        where: {
          employee_id: employee.id,
          document_type: doc.type,
        },
        defaults: {
          employee_id: employee.id,
          document_type: doc.type,
          document_name: doc.name,
          original_name: `${empData.employee_code}_${doc.orig}`,
          file_path: `/uploads/documents/${empData.employee_code.toLowerCase()}_${doc.type}.pdf`,
          file_size: 245000,
          mime_type: 'application/pdf',
          status: doc.status,
          uploaded_by: createdUsers.hr?.id || createdUsers.admin.id,
          verified_by: createdUsers.hr?.id || createdUsers.admin.id,
          verified_at: new Date(),
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DAILY ACTIVITIES & TASKS (All 5 Workflow States)
  // ─────────────────────────────────────────────────────────────────────────
  const todayDateStr = now.toISOString().split('T')[0];
  const yesterdayDateStr = new Date(now.getTime() - 24 * 3600 * 1000).toISOString().split('T')[0];
  const tomorrowDateStr = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().split('T')[0];

  const dailyActivitiesSeed = [
    // 1. ASSIGNED (Not Started - Scheduled for Today)
    {
      title: 'High-Priority Inbound Lead Calls & Qualification',
      description: 'Execute calling queue for 20 verified leads received from marketplace portal and record interest status.',
      assigned_by: createdUsers.manager.id,
      assigned_to: createdUsers.telecaller.id,
      priority: 'high',
      category: 'Customer Telecalling',
      scheduled_date: todayDateStr,
      due_date: todayDateStr,
      estimated_hours: 2.0,
      actual_hours: 0.0,
      notes: 'Focus on Mumbai metro leads first.',
      status: 'ASSIGNED',
      assigned_at: shiftHoursAgo(2),
      started_at: null,
      completed_at: null,
      shift_duration: 24,
    },
    // 2. IN_PROGRESS (Started by employee - Scheduled for Today)
    {
      title: 'Enterprise Client Dispatch & Courier SLA Reconciliation',
      description: 'Review courier pickup manifests and cross-verify consignment tracking numbers with Shiprocket.',
      assigned_by: createdUsers.manager.id,
      assigned_to: createdUsers.sales.id,
      priority: 'medium',
      category: 'Order Logistics',
      scheduled_date: todayDateStr,
      due_date: todayDateStr,
      estimated_hours: 1.5,
      actual_hours: 1.0,
      notes: 'Check Delhivery and BlueDart shipment tracking status.',
      status: 'IN_PROGRESS',
      assigned_at: shiftHoursAgo(5),
      started_at: shiftHoursAgo(3),
      completed_at: null,
      shift_duration: 24,
    },
    // 3. COMPLETED (Completed within Shift - Scheduled for Today)
    {
      title: 'Commercial Solar Inverter Warranty Replacement (Ticket #W-8041)',
      description: 'On-site diagnosis, PCB replacement, and field calibration test at client industrial site in Navi Mumbai.',
      assigned_by: createdUsers.manager.id,
      assigned_to: createdUsers.technician.id,
      priority: 'high',
      category: 'Field Service',
      scheduled_date: todayDateStr,
      due_date: todayDateStr,
      estimated_hours: 3.0,
      actual_hours: 2.5,
      completion_notes: 'Completed replacement and verified 415V 3-phase output stability.',
      notes: 'Completed replacement. Voltage calibrated to 415V stable.',
      status: 'COMPLETED',
      assigned_at: shiftHoursAgo(14),
      started_at: shiftHoursAgo(10),
      completed_at: shiftHoursAgo(4),
      shift_duration: 24,
    },
    // 4. LATE (Completed after Shift Duration - Scheduled for Yesterday)
    {
      title: 'Monthly Safety Compliance Checklist & Stock Audit',
      description: 'Conduct visual inspection of workshop inventory, fire extinguisher tags, and emergency exit signage.',
      assigned_by: createdUsers.manager.id,
      assigned_to: createdUsers.employee.id,
      priority: 'low',
      category: 'Operations & Safety',
      scheduled_date: yesterdayDateStr,
      due_date: yesterdayDateStr,
      estimated_hours: 2.0,
      actual_hours: 2.5,
      completion_notes: 'Safety inspection completed. All warehouse fire extinguishers tagged.',
      notes: 'Audit finished. All 4 fire extinguishers tagged and current.',
      status: 'LATE',
      assigned_at: shiftHoursAgo(48),
      started_at: shiftHoursAgo(30),
      completed_at: shiftHoursAgo(2),
      shift_duration: 24,
    },
    // 5. INCOMPLETE (Shift Lapsed Without Completion - Scheduled for Yesterday)
    {
      title: 'Telecalling Campaign: Inactive Customer Re-engagement',
      description: 'Contact 50 past customers who purchased over 180 days ago to offer seasonal equipment checkup.',
      assigned_by: createdUsers.manager.id,
      assigned_to: createdUsers.telecaller.id,
      priority: 'medium',
      category: 'Lead Follow-up',
      scheduled_date: yesterdayDateStr,
      due_date: yesterdayDateStr,
      estimated_hours: 3.0,
      actual_hours: 0.5,
      notes: 'Shift duration expired before completion.',
      status: 'INCOMPLETE',
      assigned_at: shiftHoursAgo(72),
      started_at: shiftHoursAgo(60),
      completed_at: null,
      shift_duration: 24,
    },
    // 6. Additional Active Task for Sales (Scheduled for Today)
    {
      title: 'B2B Quotation Preparation for Maharashtra Industrial Corp',
      description: 'Prepare commercial proposal for 15 Units Industrial Inverters with 3-year extended warranty package.',
      assigned_by: createdUsers.manager.id,
      assigned_to: createdUsers.sales.id,
      priority: 'high',
      category: 'Commercial Proposals',
      scheduled_date: todayDateStr,
      due_date: todayDateStr,
      estimated_hours: 2.5,
      actual_hours: 1.5,
      notes: 'Client requested proposal delivery before 5:00 PM.',
      status: 'IN_PROGRESS',
      assigned_at: shiftHoursAgo(4),
      started_at: shiftHoursAgo(2),
      completed_at: null,
      shift_duration: 24,
    },
    // 7. Upcoming Task for Tomorrow
    {
      title: 'Quarterly Spare Parts Inventory Re-Stock Planning',
      description: 'Audit warehouse shelf quantities and raise purchase requisitions for critical solar inverter capacitors.',
      assigned_by: createdUsers.manager.id,
      assigned_to: createdUsers.employee.id,
      priority: 'medium',
      category: 'Inventory',
      scheduled_date: tomorrowDateStr,
      due_date: tomorrowDateStr,
      estimated_hours: 2.0,
      actual_hours: 0.0,
      notes: 'Prepare RFQ for primary supplier by noon.',
      status: 'ASSIGNED',
      assigned_at: now,
      started_at: null,
      completed_at: null,
      shift_duration: 24,
    },
  ];

  for (const act of dailyActivitiesSeed) {
    let activity = await DailyActivity.findOne({ where: { title: act.title } });
    if (!activity) {
      activity = await DailyActivity.create(act);
    } else {
      await activity.update(act);
    }

    // Seed Activity History Audit
    await DailyActivityHistory.findOrCreate({
      where: {
        activity_id: activity.id,
        event_type: 'ACTIVITY_CREATED',
      },
      defaults: {
        activity_id: activity.id,
        actor_id: act.assigned_by,
        event_type: 'ACTIVITY_CREATED',
        old_status: null,
        new_status: 'ASSIGNED',
        notes: 'Activity assigned to employee.',
      },
    });

    if (act.started_at) {
      await DailyActivityHistory.findOrCreate({
        where: {
          activity_id: activity.id,
          event_type: 'ACTIVITY_STARTED',
        },
        defaults: {
          activity_id: activity.id,
          actor_id: act.assigned_to,
          event_type: 'ACTIVITY_STARTED',
          old_status: 'ASSIGNED',
          new_status: 'IN_PROGRESS',
          notes: 'Employee clocked in and began execution.',
        },
      });
    }

    if (act.completed_at) {
      const eventType = act.status === 'LATE' ? 'ACTIVITY_LATE' : 'ACTIVITY_COMPLETED';
      await DailyActivityHistory.findOrCreate({
        where: {
          activity_id: activity.id,
          event_type: eventType,
        },
        defaults: {
          activity_id: activity.id,
          actor_id: act.assigned_to,
          event_type: eventType,
          old_status: 'IN_PROGRESS',
          new_status: act.status,
          notes: act.notes || 'Activity completed successfully.',
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. EMPLOYEE AUDIT EVENTS & DAILY PERFORMANCE SUMMARIES
  // ─────────────────────────────────────────────────────────────────────────
  const auditEventsSeed = [
    {
      employee_id: createdEmployees['KR-EMP-004'].id,
      user_id: createdUsers.sales.id,
      actor_user_id: createdUsers.admin.id,
      event_type: 'USER_ROLE_UPDATED',
      module: 'user_management',
      entity_type: 'User',
      entity_id: createdUsers.sales.id,
      metadata: { action: 'Promotion', level: 'Senior' },
      old_values: { designation: 'Sales Officer', role: 'sales' },
      new_values: { designation: 'Senior Sales Executive', role: 'sales' },
      ip_address: '192.168.1.10',
    },
    {
      employee_id: createdEmployees['KR-EMP-005'].id,
      user_id: createdUsers.telecaller.id,
      actor_user_id: createdUsers.hr.id,
      event_type: 'EMPLOYEE_ONBOARDING_COMPLETED',
      module: 'hr_management',
      entity_type: 'Employee',
      entity_id: createdEmployees['KR-EMP-005'].id,
      metadata: { verification: 'All KYC Documents Approved' },
      old_values: { onboarding_status: 'in_review' },
      new_values: { onboarding_status: 'completed' },
      ip_address: '192.168.1.15',
    },
    {
      employee_id: createdEmployees['KR-EMP-006'].id,
      user_id: createdUsers.technician.id,
      actor_user_id: createdUsers.manager.id,
      event_type: 'SERVICE_TICKET_RESOLVED',
      module: 'field_service',
      entity_type: 'WarrantyServiceRequest',
      entity_id: 'w-sr-001',
      metadata: { ticket_code: 'W-8041', time_taken_minutes: 180 },
      old_values: { status: 'in_progress' },
      new_values: { status: 'resolved' },
      ip_address: '192.168.1.20',
    },
    {
      employee_id: createdEmployees['KR-EMP-007'].id,
      user_id: createdUsers.employee.id,
      actor_user_id: createdUsers.manager.id,
      event_type: 'DAILY_ACTIVITY_EVALUATION',
      module: 'activity_tracking',
      entity_type: 'DailyActivity',
      entity_id: 'act-001',
      metadata: { score: 9.2, status: 'COMPLETED' },
      old_values: null,
      new_values: { status: 'COMPLETED', remarks: 'Safety checklist fulfilled cleanly' },
      ip_address: '192.168.1.1',
    },
  ];

  for (const ev of auditEventsSeed) {
    await EmployeeAuditEvent.create(ev);
  }

  // 5B. Seed Daily Performance Summaries (Past 7 Days)
  for (let d = 0; d < 7; d++) {
    const dateObj = new Date(now.getTime() - d * 86400 * 1000);
    const dateStr = dateObj.toISOString().split('T')[0];

    for (const [code, emp] of Object.entries(createdEmployees)) {
      await EmployeeAuditDailySummary.findOrCreate({
        where: {
          employee_id: emp.id,
          date: dateStr,
        },
        defaults: {
          employee_id: emp.id,
          user_id: emp.user_id,
          date: dateStr,
          present: true,
          late: d === 2,
          leave: false,
          half_day: false,
          work_hours: 8.5,
          customer_interactions: code === 'KR-EMP-005' ? 35 : code === 'KR-EMP-004' ? 12 : 5,
          new_customers: code === 'KR-EMP-004' ? 2 : 0,
          followups_created: code === 'KR-EMP-005' ? 15 : 4,
          followups_completed: code === 'KR-EMP-005' ? 12 : 3,
          calls_logged: code === 'KR-EMP-005' ? 32 : code === 'KR-EMP-004' ? 8 : 2,
          orders_created: code === 'KR-EMP-004' ? 3 : 0,
          orders_completed: code === 'KR-EMP-004' ? 2 : 0,
          units_sold: code === 'KR-EMP-004' ? 5 : 0,
          revenue: code === 'KR-EMP-004' ? 125000 : 0,
          tasks_assigned: 2,
          tasks_completed: 2,
          daily_tasks_assigned: 1,
          daily_tasks_completed: 1,
          jobs_assigned: code === 'KR-EMP-006' ? 3 : 0,
          jobs_completed: code === 'KR-EMP-006' ? 2 : 0,
          installations: code === 'KR-EMP-006' ? 1 : 0,
          repairs: code === 'KR-EMP-006' ? 1 : 0,
          total_completion_time_minutes: code === 'KR-EMP-006' ? 240 : 0,
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CUSTOMERS & FOLLOW-UPS (Telecaller & Sales Workstation)
  // ─────────────────────────────────────────────────────────────────────────
  const customersSeed = [
    {
      name: 'Rajesh Mehta',
      email: 'rajesh.mehta@apexsolar.in',
      phone: '9820155001',
      alternate_phone: '02228456789',
      address_line1: 'Plot 45, MIDC Industrial Area',
      city: 'Thane',
      state: 'Maharashtra',
      pincode: '400604',
      customer_type: 'b2b',
      status: 'active',
      assigned_to: createdUsers.sales.id,
      notes: 'Apex Solar Solutions — B2B Inverter Client',
    },
    {
      name: 'Sunita Patel',
      email: 'sunita.patel@gmail.com',
      phone: '9820155002',
      address_line1: 'Flat 302, Sai Residency, Deccan Gymkhana',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411004',
      customer_type: 'retail',
      status: 'active',
      assigned_to: createdUsers.telecaller.id,
      notes: 'Interested in 5kVA Solar Hybrid Model',
    },
    {
      name: 'Arvind Kumar',
      email: 'arvind.kumar@shaktipumps.co.in',
      phone: '9820155003',
      address_line1: 'Sector 18, Phase 2, Industrial Hub',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122015',
      customer_type: 'b2b',
      status: 'active',
      assigned_to: createdUsers.sales.id,
      notes: 'Commercial pump controller bulk requirement',
    },
    {
      name: 'Sneha Kulkarni',
      email: 'sneha.k@rediffmail.com',
      phone: '9820155004',
      address_line1: 'B-14, Green Valley, Baner Road',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411045',
      customer_type: 'retail',
      status: 'active',
      assigned_to: createdUsers.telecaller.id,
      notes: 'Warranty extension query',
    },
    {
      name: 'Suresh Reddy',
      email: 'suresh.reddy@hyderabadsolar.com',
      phone: '9820155005',
      address_line1: 'Plot 88, Jubilee Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500033',
      customer_type: 'b2b',
      status: 'active',
      assigned_to: createdUsers.sales.id,
      notes: 'South region distributor discussion',
    },
  ];

  const createdCustomers = [];
  for (const c of customersSeed) {
    let customer = await Customer.findOne({ where: { phone: c.phone } });
    if (!customer) {
      customer = await Customer.create(c);
    } else {
      await customer.update(c);
    }
    createdCustomers.push(customer);
  }

  // 6B. Follow-Ups for Telecallers and Sales
  const followUpsSeed = [
    {
      customer_id: createdCustomers[0].id,
      assigned_to: createdUsers.sales.id,
      type: 'call',
      status: 'scheduled',
      priority: 'high',
      subject: 'Review B2B Solar Inverter Quotation & Finalize Volume Discount',
      notes: 'Client reviewed preliminary specs. Call to confirm delivery schedule and commercial terms.',
      due_at: shiftHoursAhead(4),
    },
    {
      customer_id: createdCustomers[1].id,
      assigned_to: createdUsers.telecaller.id,
      type: 'call',
      status: 'pending',
      priority: 'high',
      subject: 'Lead Verification: 5kVA Solar Hybrid Product Demo',
      notes: 'Customer submitted enquiry via web portal. Check availability for virtual demo session.',
      due_at: shiftHoursAhead(2),
    },
    {
      customer_id: createdCustomers[2].id,
      assigned_to: createdUsers.sales.id,
      type: 'email',
      status: 'completed',
      priority: 'medium',
      subject: 'Send Technical Data Sheet & Compliance Certifications',
      notes: 'Transmitted ISO 9001 and CE compliance certificates to purchase department.',
      outcome: 'Client acknowledged receipt and scheduled purchase committee review.',
      due_at: shiftHoursAgo(12),
      completed_at: shiftHoursAgo(10),
    },
    {
      customer_id: createdCustomers[3].id,
      assigned_to: createdUsers.telecaller.id,
      type: 'whatsapp',
      status: 'in_progress',
      priority: 'medium',
      subject: 'Share Warranty Registration Link & Extended Care Brochure',
      notes: 'WhatsApp brochure transmitted. Waiting for customer response on 2-year AMC package.',
      due_at: shiftHoursAgo(3),
    },
    {
      customer_id: createdCustomers[4].id,
      assigned_to: createdUsers.sales.id,
      type: 'visit',
      status: 'scheduled',
      priority: 'high',
      subject: 'Commercial Distribution Agreement Signing',
      notes: 'Meeting scheduled at Krishna Regional Center with Director of South Sales.',
      due_at: shiftHoursAhead(24),
    },
    {
      customer_id: createdCustomers[1].id,
      assigned_to: createdUsers.telecaller.id,
      type: 'call',
      status: 'completed',
      priority: 'low',
      subject: 'Initial Customer Welcome Call & Support Intro',
      notes: 'Introduced customer care helpline and WhatsApp support channel.',
      outcome: 'Customer satisfied with onboarding support.',
      due_at: shiftHoursAgo(48),
      completed_at: shiftHoursAgo(47),
    },
  ];

  for (const fu of followUpsSeed) {
    let followUp = await FollowUp.findOne({
      where: {
        customer_id: fu.customer_id,
        subject: fu.subject,
      },
    });
    if (!followUp) {
      await FollowUp.create(fu);
    } else {
      await followUp.update(fu);
    }
  }

  logger.info('✅ [SeedService] Master Static CRM Data Seeded Successfully!');
  return {
    success: true,
    message: 'Master static CRM data seeded successfully across Tasks, Employee Audit, HR, Payroll, and Follow-ups.',
    summary: {
      users: usersSeed.length,
      employees: employeesSeed.length,
      dailyActivities: dailyActivitiesSeed.length,
      auditEvents: auditEventsSeed.length,
      customers: customersSeed.length,
      followUps: followUpsSeed.length,
    },
  };
}

module.exports = {
  seedComprehensiveCRMData,
};
