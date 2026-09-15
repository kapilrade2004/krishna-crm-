'use strict';

require('dotenv').config();
const { connectDB } = require('./database');
const { User, Role, Permission, RolePermission, syncModels } = require('../models');
const logger = require('./logger');

const SYSTEM_ROLES = [
  { id: 'r-super-admin', name: 'Super admin', description: 'Master login with full system access and ability to grant/revoke access rights.', data_scope: 'Global', is_system: true },
  { id: 'r-manager',     name: 'Manager',     description: 'Management access over teams, orders, customers, tasks, and reports.',         data_scope: 'Global', is_system: true },
  { id: 'r-hr',          name: 'Hr',          description: 'HR access for employee profiles, documents, and management.',                  data_scope: 'Global', is_system: true },
  { id: 'r-sales',       name: 'Sales',       description: 'Sales access for orders, customers, follow-ups, and shipping.',                 data_scope: 'Global', is_system: true },
  { id: 'r-telecaller',  name: 'Telecaller',  description: 'Telecaller access for lead management, follow-ups, and call logs.',             data_scope: 'Global', is_system: true },
  { id: 'r-reviewer',    name: 'Reviewer',    description: 'Product reviews management, moderation, and rating verification.',              data_scope: 'Global', is_system: true },
  { id: 'r-accountant',  name: 'Accountant',  description: 'Tally entry, stock reconciliation, purchase & sales invoicing, and banking.',    data_scope: 'Global', is_system: true },
  { id: 'r-spn-ads',     name: 'SPN & ADs Manager', description: 'Traffic growth, keyword management, bid optimization, and ads monitoring.', data_scope: 'Global', is_system: true },
  { id: 'r-sr-acct-mgr', name: 'Senior Account Manager', description: 'Account health, coupon activation, team performance, and profitability.', data_scope: 'Global', is_system: true },
  { id: 'r-delivery-boy',name: 'Delivery Boy',description: 'Product/document deliveries, office assignments, and cheque collections.',       data_scope: 'Global', is_system: true },
  { id: 'r-ecom-exec',   name: 'E-Commerce Executive', description: 'Channel orders, marketplace listing, return claims, and putaway.',       data_scope: 'Global', is_system: true },
];

const SYSTEM_PERMISSIONS = [
  { id: 'p-dash-view',    module: 'dashboard', action: 'view',   name: 'dashboard:view',   description: 'View analytical dashboard' },
  { id: 'p-ord-view',     module: 'orders',    action: 'view',   name: 'orders:view',      description: 'View orders list and details' },
  { id: 'p-ord-create',   module: 'orders',    action: 'create', name: 'orders:create',    description: 'Create new orders' },
  { id: 'p-ord-edit',     module: 'orders',    action: 'edit',   name: 'orders:edit',      description: 'Edit order details and status' },
  { id: 'p-ord-delete',   module: 'orders',    action: 'delete', name: 'orders:delete',    description: 'Delete orders' },
  { id: 'p-cust-view',    module: 'customers', action: 'view',   name: 'customers:view',   description: 'View customers list' },
  { id: 'p-cust-create',  module: 'customers', action: 'create', name: 'customers:create', description: 'Create new customers' },
  { id: 'p-cust-edit',    module: 'customers', action: 'edit',   name: 'customers:edit',   description: 'Edit customer details' },
  { id: 'p-cust-delete',  module: 'customers', action: 'delete', name: 'customers:delete', description: 'Delete customers' },
  { id: 'p-ship-view',    module: 'shipping',  action: 'view',   name: 'shipping:view',    description: 'View shipping and tracking' },
  { id: 'p-ship-edit',    module: 'shipping',  action: 'edit',   name: 'shipping:edit',    description: 'Update shipping status' },
  { id: 'p-fup-view',     module: 'followups', action: 'view',   name: 'followups:view',   description: 'View follow-up reminders' },
  { id: 'p-fup-create',   module: 'followups', action: 'create', name: 'followups:create', description: 'Create follow-up reminders' },
  { id: 'p-fup-edit',     module: 'followups', action: 'edit',   name: 'followups:edit',   description: 'Update follow-up status' },
  { id: 'p-task-view',    module: 'tasks',     action: 'view',   name: 'tasks:view',       description: 'View tasks' },
  { id: 'p-task-create',  module: 'tasks',     action: 'create', name: 'tasks:create',     description: 'Create new tasks' },
  { id: 'p-task-edit',    module: 'tasks',     action: 'edit',   name: 'tasks:edit',       description: 'Update and score tasks' },
  { id: 'p-task-delete',  module: 'tasks',     action: 'delete', name: 'tasks:delete',     description: 'Delete tasks' },
  { id: 'p-csv-import',   module: 'csv',       action: 'import', name: 'csv:import',       description: 'Import CSV files' },
  { id: 'p-rep-view',     module: 'reports',   action: 'view',   name: 'reports:view',     description: 'View sales and operational reports' },
  { id: 'p-emp-view',     module: 'employees', action: 'view',   name: 'employees:view',   description: 'View employee directory' },
  { id: 'p-emp-create',   module: 'employees', action: 'create', name: 'employees:create', description: 'Create employee profiles' },
  { id: 'p-emp-edit',     module: 'employees', action: 'edit',   name: 'employees:edit',   description: 'Edit employee records' },
  { id: 'p-emp-delete',   module: 'employees', action: 'delete', name: 'employees:delete', description: 'Delete employee records' },
  { id: 'p-usr-view',     module: 'users',     action: 'view',   name: 'users:view',       description: 'View system users list' },
  { id: 'p-usr-manage',   module: 'users',     action: 'manage', name: 'users:manage',     description: 'Create and activate/deactivate users' },
  { id: 'p-acc-manage',   module: 'access',    action: 'manage', name: 'access:manage',    description: 'Give and revoke access rights to users' },
  { id: 'p-dtask-view',   module: 'daily_tasks', action: 'view',   name: 'daily_tasks:view',   description: 'View daily tasks' },
  { id: 'p-dtask-create', module: 'daily_tasks', action: 'create', name: 'daily_tasks:create', description: 'Assign daily tasks' },
  { id: 'p-dtask-edit',   module: 'daily_tasks', action: 'edit',   name: 'daily_tasks:edit',   description: 'Edit daily tasks and status' },
  { id: 'p-dtask-delete', module: 'daily_tasks', action: 'delete', name: 'daily_tasks:delete', description: 'Delete daily tasks' },
  { id: 'p-onboard-view',  module: 'onboarding',  action: 'view',   name: 'onboarding:view',    description: 'View employee onboarding status' },
  { id: 'p-onboard-manage',module: 'onboarding',  action: 'manage', name: 'onboarding:manage',  description: 'Manage onboarding & verify documents' },
  { id: 'p-doccenter-view',module: 'document_center', action: 'view', name: 'document_center:view', description: 'Access HR Document Center' },
  { id: 'p-war-view',     module: 'warranty',  action: 'view',   name: 'warranty:view',    description: 'View warranties list and statistics' },
  { id: 'p-war-verify',   module: 'warranty',  action: 'verify', name: 'warranty:verify',  description: 'Verify, activate and manage warranties' },
  { id: 'p-rev-view',     module: 'reviews',   action: 'view',   name: 'reviews:view',     description: 'View customer ratings and product reviews' },
  { id: 'p-rev-create',   module: 'reviews',   action: 'create', name: 'reviews:create',   description: 'Submit new reviews' },
  { id: 'p-rev-edit',     module: 'reviews',   action: 'edit',   name: 'reviews:edit',     description: 'Edit reviews and ratings' },
  { id: 'p-rev-delete',   module: 'reviews',   action: 'delete', name: 'reviews:delete',   description: 'Delete reviews' },
  { id: 'p-rev-verify',   module: 'reviews',   action: 'verify', name: 'reviews:verify',   description: 'Verify authenticity of customer reviews' },
  { id: 'p-acct-view',    module: 'accounting',action: 'view',   name: 'accounting:view',  description: 'View ledgers, vouchers, and invoicing' },
  { id: 'p-acct-edit',    module: 'accounting',action: 'edit',   name: 'accounting:edit',  description: 'Update accounting and bill records' },
  { id: 'p-acct-manage',  module: 'accounting',action: 'manage', name: 'accounting:manage',description: 'Manage Tally and MyBillBook reconciliations' },
  { id: 'p-inv-view',     module: 'inventory', action: 'view',   name: 'inventory:view',   description: 'View stock levels, SKU counts and audits' },
  { id: 'p-inv-edit',     module: 'inventory', action: 'edit',   name: 'inventory:edit',   description: 'Update stock levels and putaway entries' },
  { id: 'p-inv-manage',   module: 'inventory', action: 'manage', name: 'inventory:manage', description: 'Manage stock reconciliation and warehouse' },
  { id: 'p-ads-view',     module: 'ads',        action: 'view',   name: 'ads:view',         description: 'View advertisement accounts, keywords and traffic' },
  { id: 'p-ads-manage',   module: 'ads',        action: 'manage', name: 'ads:manage',       description: 'Manage bids, budgets, and SPN campaigns' },
  { id: 'p-del-view',     module: 'delivery',   action: 'view',   name: 'delivery:view',    description: 'View delivery dispatches and schedules' },
  { id: 'p-del-manage',   module: 'delivery',   action: 'manage', name: 'delivery:manage',  description: 'Manage courier dispatch and office jobs' },
  { id: 'p-chq-view',     module: 'cheques',    action: 'view',   name: 'cheques:view',     description: 'View client cheque collection logs' },
  { id: 'p-chq-manage',   module: 'cheques',    action: 'manage', name: 'cheques:manage',   description: 'Record and update cheque collection status' },
];

const seed = async () => {
  await connectDB();
  await syncModels({ force: false });

  // ─── Seed Roles ────────────────────────────────────────────────────────────
  for (const r of SYSTEM_ROLES) {
    await Role.findOrCreate({
      where: { name: r.name },
      defaults: r,
    });
  }

  // ─── Seed Permissions ──────────────────────────────────────────────────────
  for (const p of SYSTEM_PERMISSIONS) {
    await Permission.findOrCreate({
      where: { name: p.name },
      defaults: p,
    });
  }

  // ─── Map Default Permissions to All System Roles ─────────────────────────
  const allPerms = await Permission.findAll();
  const allRoles = await Role.findAll();

  const ROLE_PERM_MAP = {
    'Super admin': allPerms.map(p => p.id),
    'Manager': ['p-dash-view', 'p-ord-view', 'p-ord-create', 'p-ord-edit', 'p-cust-view', 'p-cust-create', 'p-cust-edit', 'p-ship-view', 'p-ship-edit', 'p-fup-view', 'p-fup-create', 'p-fup-edit', 'p-task-view', 'p-task-create', 'p-task-edit', 'p-csv-import', 'p-rep-view', 'p-emp-view', 'p-emp-create', 'p-emp-edit', 'p-dtask-view', 'p-dtask-create', 'p-dtask-edit', 'p-dtask-delete', 'p-onboard-view', 'p-war-view'],
    'Hr': ['p-dash-view', 'p-emp-view', 'p-emp-create', 'p-emp-edit', 'p-emp-delete', 'p-usr-view', 'p-usr-manage', 'p-task-view', 'p-task-create', 'p-task-edit', 'p-fup-view', 'p-dtask-view', 'p-dtask-create', 'p-dtask-edit', 'p-dtask-delete', 'p-onboard-view', 'p-onboard-manage', 'p-doccenter-view'],
    'Telecaller': ['p-dash-view', 'p-cust-view', 'p-cust-create', 'p-cust-edit', 'p-ord-view', 'p-ord-edit', 'p-fup-view', 'p-fup-create', 'p-fup-edit', 'p-task-view', 'p-task-create', 'p-task-edit', 'p-csv-import', 'p-dtask-view', 'p-dtask-create', 'p-dtask-edit', 'p-rep-view', 'p-rev-view', 'p-rev-verify'],
    'Sales': ['p-dash-view', 'p-ord-view', 'p-ord-create', 'p-ord-edit', 'p-cust-view', 'p-cust-create', 'p-cust-edit', 'p-ship-view', 'p-fup-view', 'p-fup-create', 'p-fup-edit', 'p-task-view', 'p-task-edit', 'p-csv-import', 'p-dtask-view', 'p-dtask-edit'],
    'Reviewer': ['p-dash-view', 'p-task-view', 'p-dtask-view', 'p-dtask-edit', 'p-rev-view', 'p-rev-create', 'p-rev-edit', 'p-rev-delete', 'p-rev-verify'],
    'Accountant': ['p-dash-view', 'p-ord-view', 'p-ord-edit', 'p-cust-view', 'p-ship-view', 'p-rep-view', 'p-task-view', 'p-dtask-view', 'p-dtask-edit', 'p-acct-view', 'p-acct-edit', 'p-acct-manage', 'p-inv-view', 'p-inv-edit', 'p-inv-manage', 'p-chq-view', 'p-chq-manage'],
    'SPN & ADs Manager': ['p-dash-view', 'p-ord-view', 'p-cust-view', 'p-rep-view', 'p-task-view', 'p-dtask-view', 'p-dtask-edit', 'p-ads-view', 'p-ads-manage'],
    'Senior Account Manager': ['p-dash-view', 'p-ord-view', 'p-ord-create', 'p-ord-edit', 'p-cust-view', 'p-cust-edit', 'p-ship-view', 'p-rep-view', 'p-emp-view', 'p-task-view', 'p-task-create', 'p-task-edit', 'p-dtask-view', 'p-dtask-create', 'p-dtask-edit', 'p-ads-view', 'p-inv-view', 'p-acct-view'],
    'Delivery Boy': ['p-dash-view', 'p-ship-view', 'p-ship-edit', 'p-ord-view', 'p-cust-view', 'p-task-view', 'p-dtask-view', 'p-dtask-edit', 'p-del-view', 'p-del-manage', 'p-chq-view', 'p-chq-manage'],
    'E-Commerce Executive': ['p-dash-view', 'p-ord-view', 'p-ord-create', 'p-ord-edit', 'p-cust-view', 'p-cust-edit', 'p-ship-view', 'p-ship-edit', 'p-war-view', 'p-war-verify', 'p-rep-view', 'p-csv-import', 'p-task-view', 'p-task-create', 'p-task-edit', 'p-dtask-view', 'p-dtask-create', 'p-dtask-edit', 'p-rev-view', 'p-inv-view', 'p-inv-edit'],
  };

  for (const roleObj of allRoles) {
    const permIds = ROLE_PERM_MAP[roleObj.name] || [];
    for (const pid of permIds) {
      await RolePermission.findOrCreate({
        where: { role_id: roleObj.id, permission_id: pid },
        defaults: { role_id: roleObj.id, permission_id: pid },
      });
    }
  }

  // ─── Core Demo Users ───────────────────────────────────────────────────────
  const demoUsers = [
    { name: 'Super Admin',  email: 'admin@krishnacrm.com',    password: 'Admin@123456',    role: 'admin' },
    { name: 'Manager User', email: 'manager@krishnacrm.com',  password: 'Manager@123456',  role: 'manager' },
    { name: 'HR Executive', email: 'hr@krishnacrm.com',       password: 'Hr@123456',       role: 'hr' },
    { name: 'Telecaller Raj',email:'telecaller@krishnacrm.com',password: 'Telecaller@123456',role: 'telecaller' },
    { name: 'Sales Exec',   email: 'sales@krishnacrm.com',    password: 'Sales@123456',    role: 'sales' },
  ];

  for (const u of demoUsers) {
    let userRecord = await User.findOne({ where: { email: u.email }, paranoid: false });
    if (userRecord) {
      if (userRecord.deletedAt) {
        await userRecord.restore();
      }
      userRecord.name = u.name;
      userRecord.role = u.role;
      userRecord.password = u.password;
      userRecord.is_active = true;
      await userRecord.save();
      logger.info(`ℹ️  User updated/restored: ${u.email}`);
    } else {
      await User.create({
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        is_active: true,
      });
      logger.info(`✅ User created: ${u.email} (${u.role})`);
    }
  }

  logger.info('✅ Seed complete.');
  process.exit(0);
};

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
