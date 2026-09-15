'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — SINGLE SOURCE OF TRUTH (SSOT) FOR ROLES, PERMISSIONS & CAPABILITIES
 * ═══════════════════════════════════════════════════════════════════════════════
 *  This is the authoritative system-wide registry powering:
 *  1. Backend route and data-scope authorization
 *  2. Frontend dynamic navigation & permission gates
 *  3. User access management & role assignment
 *  4. Adaptive role-aware workspace mounting
 *  5. Agent intelligence metadata queries
 */

const DATA_SCOPES = {
  ALL: 'all',
  DEPARTMENT: 'department',
  TEAM: 'team',
  ASSIGNED: 'assigned',
  OWN: 'own',
};

const SYSTEM_ROLES = [
  {
    key: 'super_admin',
    name: 'Super admin',
    description: 'Master login with full system access and unrestricted control across all modules.',
    data_scope: DATA_SCOPES.ALL,
    is_system: true,
    badge_colour: 'bg-red-100 text-red-800 border-red-200',
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Operations, team supervision, order fulfillment, task oversight, and daily workflows.',
    data_scope: DATA_SCOPES.ALL,
    is_system: true,
    badge_colour: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    key: 'senior_account_manager',
    name: 'Senior Account Manager',
    description: 'E-commerce account health, coupon & BXGY monitoring, FBA reports, team performance, MTR & OMS Guru management.',
    data_scope: DATA_SCOPES.ALL,
    is_system: true,
    badge_colour: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  {
    key: 'hr',
    name: 'Hr',
    description: 'Human Resources, employee directory, biometric attendance, shifts, onboarding, documents & payroll.',
    data_scope: DATA_SCOPES.ALL,
    is_system: true,
    badge_colour: 'bg-pink-100 text-pink-800 border-pink-200',
  },
  {
    key: 'spn_ads_manager',
    name: 'SPN & ADs Manager',
    description: 'Traffic growth, keyword management, bid & budget optimization, advertising trends, and product research.',
    data_scope: DATA_SCOPES.ALL,
    is_system: true,
    badge_colour: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description: 'Tally entries, stock audit, MyBillBook invoicing, sales returns, banking, cheque collections & ledger maintenance.',
    data_scope: DATA_SCOPES.DEPARTMENT,
    is_system: true,
    badge_colour: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    key: 'ecommerce_executive',
    name: 'E-Commerce Executive',
    description: 'Channel orders, Amazon returns entry, OMS putaway, 60-day claims, FBA shipments, listings & infographics.',
    data_scope: DATA_SCOPES.TEAM,
    is_system: true,
    badge_colour: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  },
  {
    key: 'telecaller',
    name: 'Telecaller',
    description: 'Order confirmation calling, Amazon Easyship calling, seller rating collection, review verification & installation help.',
    data_scope: DATA_SCOPES.TEAM,
    is_system: true,
    badge_colour: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    key: 'sales',
    name: 'Sales',
    description: 'Direct sales pipeline, customer inquiries, order creation, and follow-ups.',
    data_scope: DATA_SCOPES.OWN,
    is_system: true,
    badge_colour: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    key: 'technician',
    name: 'Technician',
    description: 'Field service requests, installation tickets, warranty inspections, and product repair work.',
    data_scope: DATA_SCOPES.ASSIGNED,
    is_system: true,
    badge_colour: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  {
    key: 'reviewer',
    name: 'Reviewer',
    description: 'Product review auditing, rating collection verification, customer feedback validation, and review tracking.',
    data_scope: DATA_SCOPES.TEAM,
    is_system: true,
    badge_colour: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    key: 'delivery_boy',
    name: 'Delivery Boy',
    description: 'Delivery fulfillment, customer parcel delivery, office assignments, and cheque collections.',
    data_scope: DATA_SCOPES.ASSIGNED,
    is_system: true,
    badge_colour: 'bg-lime-100 text-lime-800 border-lime-200',
  },
  {
    key: 'employee',
    name: 'Employee',
    description: 'Standard staff profile for daily shift activities, assigned tasks, and personal attendance tracking.',
    data_scope: DATA_SCOPES.OWN,
    is_system: true,
    badge_colour: 'bg-slate-100 text-slate-800 border-slate-200',
  },
];

const SYSTEM_PERMISSIONS = [
  // ─── REVIEWS & RATINGS (ROLE 1) [COMMENTED OUT] ───────────────────────────
  /*
  { name: 'reviews:view', action: 'view', description: 'View customer ratings and product reviews', module: 'reviews' },
  { name: 'reviews:create', action: 'create', description: 'Add customer feedback and product reviews', module: 'reviews' },
  { name: 'reviews:verify', action: 'verify', description: 'Audit and verify legitimacy of reviews', module: 'reviews' },
  { name: 'reviews:delete', action: 'delete', description: 'Delete or moderate abusive / fake reviews', module: 'reviews' },
  { name: 'reviews:export', action: 'export', description: 'Export review compliance and rating summaries', module: 'reviews' },
  */

  // ─── TELECALLER & CALL CENTER (ROLE 2) ───────────────────────────────────────
  { name: 'telecaller:view', action: 'view', description: 'Access telecaller workstation and calling queues', module: 'telecalling' },
  { name: 'telecaller:confirmation', action: 'confirmation', description: 'Order confirmation calling and customization verification', module: 'telecalling' },
  { name: 'telecaller:easyship', action: 'easyship', description: 'Amazon Easyship rating collection calls', module: 'telecalling' },
  // { name: 'telecaller:reviews', action: 'reviews', description: 'Verify received customer review submissions', module: 'telecalling' },
  { name: 'telecaller:cancellation', action: 'cancellation', description: 'Cancellation reporting and rate calculation', module: 'telecalling' },
  { name: 'telecaller:installation_help', action: 'installation_help', description: 'Customer installation assistance workbench', module: 'telecalling' },

  // ─── ACCOUNTING & FINANCE (ROLE 3) [COMMENTED OUT] ─────────────────────────
  /*
  { name: 'accounting:view', action: 'view', description: 'View accounting records, ledgers, and cash/bank status', module: 'accounting' },
  { name: 'accounting:tally', action: 'tally', description: 'Voucher entry and daily stock sync in Tally', module: 'accounting' },
  { name: 'accounting:invoicing', action: 'invoicing', description: 'MyBillBook sales billing and invoice checks', module: 'accounting' },
  { name: 'accounting:banking', action: 'banking', description: 'Daily banking entries and DSR reconciliation', module: 'accounting' },
  { name: 'accounting:stock_audit', action: 'stock_audit', description: 'Physical vs book stock audit reconciliation', module: 'accounting' },
  { name: 'accounting:cheques', action: 'cheques', description: 'Verify, record and deposit collected cheques', module: 'accounting' },
  { name: 'accounting:pos', action: 'pos', description: 'Purchase orders verification (Pureit, Kent, Usha)', module: 'accounting' },
  */

  // ─── SPN & ADVERTISING MANAGEMENT (ROLE 4) [COMMENTED OUT] ─────────────────
  /*
  { name: 'spn_ads:view', action: 'view', description: 'View advertising performance dashboards and reports', module: 'spn_ads' },
  { name: 'spn_ads:keywords', action: 'keywords', description: 'Keyword management, negative mapping and bid optimization', module: 'spn_ads' },
  { name: 'spn_ads:budget', action: 'budget', description: 'Advertising budget allocation and spend management', module: 'spn_ads' },
  { name: 'spn_ads:research', action: 'research', description: 'Market research, competitor pricing and demand discovery', module: 'spn_ads' },
  { name: 'spn_ads:sku_audit', action: 'sku_audit', description: 'Bottom 10 SKU review and impression trend turnaround', module: 'spn_ads' },
  */

  // ─── SENIOR ACCOUNT MANAGEMENT (ROLE 5) [COMMENTED OUT] ────────────────────
  /*
  { name: 'sam:view', action: 'view', description: 'Access account management dashboard and health center', module: 'sam' },
  { name: 'sam:account_health', action: 'account_health', description: 'Monitor account health, suppressed listings and safety stock', module: 'sam' },
  { name: 'sam:promotions', action: 'promotions', description: 'Live coupon verification and Buy X Get Y (BXGY) monitoring', module: 'sam' },
  { name: 'sam:profitability', action: 'profitability', description: 'Account-wise net margin and profitability analysis', module: 'sam' },
  { name: 'sam:fba_oms', action: 'fba_oms', description: 'FBA weekly discrepancy tracking and OMS Guru oversight', module: 'sam' },
  { name: 'sam:po_qc', action: 'po_qc', description: 'Final quality check and authorization of purchase orders', module: 'sam' },
  */

  // ─── DELIVERY & FIELD OPERATIONS (ROLE 6) [COMMENTED OUT] ──────────────────
  /*
  { name: 'delivery:view', action: 'view', description: 'Access parcel delivery run-sheets and task lists', module: 'delivery' },
  { name: 'delivery:status', action: 'status', description: 'Update delivery completion, failure reasons and proof', module: 'delivery' },
  { name: 'delivery:cheque_collect', action: 'cheque_collect', description: 'Collect customer cheques, record amount and bank details', module: 'delivery' },
  { name: 'delivery:office_work', action: 'office_work', description: 'Log and complete daily office errands and warehouse tasks', module: 'delivery' },
  */

  // ─── E-COMMERCE OPERATIONS (ROLE 7) [COMMENTED OUT] ────────────────────────
  /*
  { name: 'ecommerce:view', action: 'view', description: 'Access e-commerce operational workstations', module: 'ecommerce' },
  { name: 'ecommerce:orders', action: 'orders', description: 'Process channel orders (1:20 PM cutoff, screenshots at 1:59 PM)', module: 'ecommerce' },
  { name: 'ecommerce:returns', action: 'returns', description: 'Amazon returns entry, customer calling and OMS putaway', module: 'ecommerce' },
  { name: 'ecommerce:claims', action: 'claims', description: 'File and track channel damage claims & 60-day claims', module: 'ecommerce' },
  { name: 'ecommerce:fba', action: 'fba', description: 'Manage FBA shipments, FC files and removal SKUs', module: 'ecommerce' },
  { name: 'ecommerce:listings', action: 'listings', description: 'Create and update product listings and infographics', module: 'ecommerce' },
  { name: 'ecommerce:inventory', action: 'inventory', description: 'Check Amazon inventory, suppressed items and replenishment', module: 'ecommerce' },
  */

  // ─── ORDERS & FULFILLMENT ───────────────────────────────────────────────────
  { name: 'orders:view', action: 'view', description: 'View sales orders and pipeline', module: 'orders' },
  { name: 'orders:create', action: 'create', description: 'Create manual direct or offline sales orders', module: 'orders' },
  { name: 'orders:edit', action: 'edit', description: 'Update order details, flow stage, and tracking numbers', module: 'orders' },
  { name: 'orders:cancel', action: 'cancel', description: 'Cancel order and trigger refund / return workflows', module: 'orders' },

  // ─── CUSTOMERS ──────────────────────────────────────────────────────────────
  { name: 'customers:view', action: 'view', description: 'View Customer 360 profiles and interaction history', module: 'customers' },
  { name: 'customers:create', action: 'create', description: 'Register new customers manually or via API', module: 'customers' },
  { name: 'customers:edit', action: 'edit', description: 'Update customer contact, addresses, and tags', module: 'customers' },
  { name: 'customers:delete', action: 'delete', description: 'Archive customer records', module: 'customers' },

  // ─── SHIPPING & LOGISTICS ───────────────────────────────────────────────────
  { name: 'shipping:view', action: 'view', description: 'View courier dispatches and tracking dashboard', module: 'shipping' },
  { name: 'shipping:serviceability', action: 'serviceability', description: 'Check courier pincode serviceability and COD eligibility', module: 'shipping' },
  { name: 'shipping:deliveries', action: 'deliveries', description: 'Manage delivery run-sheets and assignments', module: 'shipping' },

  // ─── WARRANTY & SERVICE REQUESTS ────────────────────────────────────────────
  { name: 'warranty:view', action: 'view', description: 'View registered warranties and service tickets', module: 'warranty' },
  { name: 'warranty:verify', action: 'verify', description: 'Verify warranty purchase bills and serial numbers', module: 'warranty' },
  { name: 'warranty:service', action: 'service', description: 'Create and assign field technician service tickets', module: 'warranty' },

  // ─── DAILY TASKS & CHECKLISTS ───────────────────────────────────────────────
  { name: 'daily_tasks:view', action: 'view', description: 'View assigned daily routines and shift checklists', module: 'daily_tasks' },
  { name: 'daily_tasks:create', action: 'create', description: 'Assign tasks to team members', module: 'daily_tasks' },
  { name: 'daily_tasks:edit', action: 'edit', description: 'Update task progress and submit completion notes', module: 'daily_tasks' },
  { name: 'daily_tasks:export', action: 'export', description: 'Export daily status reports (DSR)', module: 'daily_tasks' },

  // ─── SHIFT ACTIVITIES & AUDIT ───────────────────────────────────────────────
  { name: 'activities:view', action: 'view', description: 'View shift activity timeline', module: 'activities' },
  { name: 'activities:log', action: 'log', description: 'Log real-time shift activities and break timers', module: 'activities' },
  { name: 'activities:audit', action: 'audit', description: 'Audit employee shift productivity', module: 'activities' },

  // ─── REPORTS & ANALYTICS ────────────────────────────────────────────────────
  { name: 'reports:view', action: 'view', description: 'View business intelligence reports and KPIs', module: 'reports' },
  { name: 'reports:export', action: 'export', description: 'Export tabular reports to Excel / CSV', module: 'reports' },

  // ─── HR & BIOMETRICS ────────────────────────────────────────────────────────
  { name: 'employees:view', action: 'view', description: 'View employee directory and profiles', module: 'hr' },
  { name: 'employees:create', action: 'create', description: 'Onboard new staff members', module: 'hr' },
  { name: 'employees:edit', action: 'edit', description: 'Update staff compensation and designations', module: 'hr' },
  { name: 'onboarding:manage', action: 'manage', description: 'Verify KYC documents, Aadhaar, PAN, and Bank passbooks', module: 'hr' },
  { name: 'attendance:view', action: 'view', description: 'View attendance registers and punch logs', module: 'hr' },
  { name: 'attendance:edit', action: 'edit', description: 'Correct attendance records and review correction requests', module: 'hr' },
  { name: 'attendance:manage', action: 'manage', description: 'Recalculate attendance and configure shift policies', module: 'hr' },
  { name: 'biometric:view', action: 'view', description: 'View biometric devices, sync logs, and raw punch stream', module: 'biometric' },
  { name: 'biometric:manage', action: 'manage', description: 'Register/remove devices, upload staff and trigger machine enrollments', module: 'biometric' },
  { name: 'biometric:sync', action: 'sync', description: 'Trigger hardware sync and upload offline USB log files', module: 'biometric' },
  { name: 'payroll:process', action: 'process', description: 'Calculate and process monthly salary disbursements', module: 'hr' },

  // ─── SYSTEM ADMINISTRATION & ACCESS CONTROL ─────────────────────────────────
  { name: 'access:manage', action: 'manage', description: 'Create, update, lock and archive user accounts', module: 'access' },
  { name: 'access:roles', action: 'roles', description: 'Configure role permission matrices', module: 'access' },
  { name: 'access:audit', action: 'audit', description: 'Inspect login histories and security audit logs', module: 'access' },
  { name: 'csv:import', action: 'import', description: 'Upload multi-channel order batch spreadsheets', module: 'csv' },
];

const ROLE_DEFAULT_PERMISSIONS = {
  'Super admin': ['*'],
  'Manager': [
    'orders:view', 'orders:create', 'orders:edit', 'orders:cancel',
    'customers:view', 'customers:create', 'customers:edit',
    'telecaller:view', 'telecaller:confirmation', 'telecaller:easyship', 'telecaller:cancellation',
    'shipping:view', 'shipping:serviceability', 'shipping:deliveries',
    'warranty:view', 'warranty:verify', 'warranty:service',
    'daily_tasks:view', 'daily_tasks:create', 'daily_tasks:edit', 'daily_tasks:export',
    'activities:view', 'activities:audit',
    'reports:view', 'reports:export',
    'employees:view', 'attendance:view',
    'csv:import', 'access:manage', 'access:audit',
  ],
  'Senior Account Manager': [
    'orders:view', 'orders:create', 'orders:edit', 'orders:cancel',
    'customers:view',
    'reports:view', 'reports:export',
    'daily_tasks:view', 'daily_tasks:create', 'daily_tasks:edit', 'daily_tasks:export',
    'activities:view', 'activities:audit',
    'csv:import',
  ],
  'Reviewer': [
    'orders:view',
    'telecaller:easyship',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
  'Telecaller': [
    'telecaller:view', 'telecaller:confirmation', 'telecaller:easyship', 'telecaller:cancellation', 'telecaller:installation_help',
    'customers:view', 'customers:create', 'customers:edit',
    'orders:view', 'orders:edit',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
  'Accountant': [
    'orders:view',
    'shipping:deliveries',
    'reports:view', 'reports:export',
    'daily_tasks:view', 'daily_tasks:edit', 'daily_tasks:export',
    'activities:view', 'activities:log',
  ],
  'SPN & ADs Manager': [
    'orders:view',
    'reports:view', 'reports:export',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
  'Delivery Boy': [
    'shipping:deliveries',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
  'E-Commerce Executive': [
    'orders:view', 'orders:create', 'orders:edit',
    'telecaller:confirmation',
    'csv:import',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
  'Hr': [
    'employees:view', 'employees:create', 'employees:edit', 'onboarding:manage', 'attendance:view', 'payroll:process',
    'attendance:edit', 'attendance:manage', 'biometric:view', 'biometric:manage', 'biometric:sync',
    'daily_tasks:view', 'daily_tasks:create', 'daily_tasks:edit',
    'activities:view', 'activities:audit',
    'access:manage', 'access:audit',
  ],
  'Sales': [
    'orders:view', 'orders:create', 'orders:edit',
    'customers:view', 'customers:create', 'customers:edit',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
  'Technician': [
    'warranty:view', 'warranty:service',
    'telecaller:installation_help',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
  'Employee': [
    'attendance:view',
    'daily_tasks:view', 'daily_tasks:edit',
    'activities:view', 'activities:log',
  ],
};

const MODULE_REGISTRY = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    icon: 'LayoutDashboard',
    permissions: ['dashboard:view'],
    supportedRoles: ['*'],
    dataScopeSupport: ['all', 'department', 'team', 'assigned', 'own'],
  },
  /*
  {
    key: 'reviews',
    label: 'Reviews & Ratings',
    route: '/reviews',
    icon: 'Star',
    permissions: ['reviews:view'],
    supportedRoles: ['super_admin', 'manager', 'reviewer', 'telecaller', 'senior_account_manager', 'ecommerce_executive'],
    dataScopeSupport: ['all', 'team', 'assigned'],
    capabilities: ['audit_reviews', 'verify_ratings', 'flag_abusive', 'daily_10_quota'],
  },
  */
  {
    key: 'telecaller',
    label: 'Telecaller Suite',
    route: '/telecaller',
    icon: 'PhoneCall',
    permissions: ['telecaller:view'],
    supportedRoles: ['super_admin', 'manager', 'telecaller', 'senior_account_manager', 'ecommerce_executive'],
    dataScopeSupport: ['all', 'team', 'assigned'],
    capabilities: ['confirmation_calling', 'easyship_ratings', 'cancellation_report', '95_percent_target'],
  },
  /*
  {
    key: 'accounting',
    label: 'Accounting & Finance',
    route: '/accounting',
    icon: 'Calculator',
    permissions: ['accounting:view'],
    supportedRoles: ['super_admin', 'manager', 'accountant', 'senior_account_manager'],
    dataScopeSupport: ['all', 'department'],
    capabilities: ['tally_vouchers', 'stock_reconciliation', 'mybillbook_invoicing', 'banking_dsr', 'cheque_verification'],
  },
  {
    key: 'marketing',
    label: 'SPN & Ads Optimizer',
    route: '/marketing',
    icon: 'TrendingUp',
    permissions: ['spn_ads:view'],
    supportedRoles: ['super_admin', 'manager', 'spn_ads_manager', 'senior_account_manager'],
    dataScopeSupport: ['all'],
    capabilities: ['campaign_roas', 'keyword_optimizer', 'bottom_10_skus', 'bid_benchmarks', 'product_research'],
  },
  {
    key: 'account_management',
    label: 'Account Management',
    route: '/account-management',
    icon: 'Briefcase',
    permissions: ['sam:view'],
    supportedRoles: ['super_admin', 'manager', 'senior_account_manager'],
    dataScopeSupport: ['all'],
    capabilities: ['account_health', 'promotions_bxgy', 'profitability_matrix', 'fba_discrepancy', 'po_quality_check'],
  },
  {
    key: 'field_ops',
    label: 'Field Operations & Delivery',
    route: '/field-ops',
    icon: 'Truck',
    permissions: ['delivery:view'],
    supportedRoles: ['super_admin', 'delivery_boy', 'manager'],
    dataScopeSupport: ['assigned', 'all'],
    capabilities: ['parcel_run_sheet', 'delivery_confirmation', 'cheque_collection', 'office_errands'],
  },
  {
    key: 'ecommerce_ops',
    label: 'E-Commerce Operations',
    route: '/ecommerce-ops',
    icon: 'ShoppingBag',
    permissions: ['ecommerce:view'],
    supportedRoles: ['super_admin', 'manager', 'ecommerce_executive', 'senior_account_manager'],
    dataScopeSupport: ['all', 'team'],
    capabilities: ['cutoff_120pm_orders', 'returns_entry', 'oms_putaway', '60_day_claims', 'fba_fc_files'],
  },
  */
  {
    key: 'orders',
    label: 'Orders',
    route: '/orders',
    icon: 'ShoppingCart',
    permissions: ['orders:view'],
    supportedRoles: ['super_admin', 'manager', 'sales', 'senior_account_manager', 'ecommerce_executive', 'accountant', 'telecaller'],
    dataScopeSupport: ['all', 'team', 'assigned', 'own'],
  },
  {
    key: 'customers',
    label: 'Customers',
    route: '/customers',
    icon: 'Users',
    permissions: ['customers:view'],
    supportedRoles: ['super_admin', 'manager', 'sales', 'telecaller', 'senior_account_manager'],
    dataScopeSupport: ['all', 'team', 'assigned', 'own'],
  },
  {
    key: 'shipping',
    label: 'Shipping & Logistics',
    route: '/shipping',
    icon: 'Navigation',
    permissions: ['shipping:view'],
    supportedRoles: ['super_admin', 'manager', 'delivery_boy', 'senior_account_manager', 'ecommerce_executive'],
    dataScopeSupport: ['all', 'assigned'],
  },
  {
    key: 'warranty',
    label: 'Warranty & Service',
    route: '/warranty',
    icon: 'ShieldCheck',
    permissions: ['warranty:view'],
    supportedRoles: ['super_admin', 'manager', 'technician', 'senior_account_manager'],
    dataScopeSupport: ['all', 'assigned'],
  },
  {
    key: 'tasks',
    label: 'Tasks & Daily Work',
    route: '/tasks',
    icon: 'CheckSquare',
    permissions: ['daily_tasks:view'],
    supportedRoles: ['*'],
    dataScopeSupport: ['all', 'team', 'assigned', 'own'],
  },
  {
    key: 'csv',
    label: 'CSV Import',
    route: '/csv-import',
    icon: 'Upload',
    permissions: ['csv:import'],
    supportedRoles: ['super_admin', 'manager', 'sales', 'ecommerce_executive', 'telecaller'],
    dataScopeSupport: ['all'],
  },
  {
    key: 'reports',
    label: 'Reports & BI',
    route: '/reports',
    icon: 'BarChart2',
    permissions: ['reports:view'],
    supportedRoles: ['super_admin', 'manager', 'senior_account_manager', 'spn_ads_manager', 'accountant'],
    dataScopeSupport: ['all', 'department'],
  },
  {
    key: 'hr',
    label: 'HR Workspace',
    route: '/hr',
    icon: 'Building2',
    permissions: ['employees:view'],
    supportedRoles: ['super_admin', 'hr', 'manager'],
    dataScopeSupport: ['all'],
  },
  {
    key: 'settings_users',
    label: 'Users & Rights',
    route: '/settings/users',
    icon: 'UserCheck',
    permissions: ['access:manage'],
    supportedRoles: ['super_admin', 'manager', 'hr'],
    dataScopeSupport: ['all'],
  },
];

module.exports = {
  DATA_SCOPES,
  SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  MODULE_REGISTRY,
};
