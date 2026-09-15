'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  KRISHNA CRM — FRONTEND MODULE & CAPABILITY REGISTRY (SSOT)
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Powers dynamic navigation, permission-based action rendering, and
 *  role-aware workspace routing.
 */

import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  CheckSquare,
  Upload,
  BarChart2,
  Truck,
  ShieldCheck,
  PhoneCall,
  Star,
  Calculator,
  TrendingUp,
  Briefcase,
  ShoppingBag,
  Building2,
  UserCheck,
  FileText,
  FileCheck,
  Fingerprint,
  Settings,
} from 'lucide-react';
import type { User } from '@/types';

export interface ModuleDefinition {
  key: string;
  label: string;
  route: string;
  icon: any;
  permissions: string[];
  supportedRoles: string[];
  capabilities?: string[];
  description?: string;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    icon: LayoutDashboard,
    permissions: ['dashboard:view'],
    supportedRoles: ['*'],
    description: 'Role-aware operational intelligence and executive dashboards',
  },
  /*
  {
    key: 'reviews',
    label: 'Reviews & Ratings',
    route: '/reviews',
    icon: Star,
    permissions: ['reviews:view', 'telecaller:reviews'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'reviewer', 'telecaller', 'senior_account_manager', 'ecommerce_executive'],
    capabilities: ['audit_reviews', 'verify_ratings', 'flag_abusive', 'daily_10_quota'],
    description: 'Product review auditing, rating collection verification and compliance',
  },
  */
  {
    key: 'telecaller',
    label: 'Telecaller Suite',
    route: '/telecaller',
    icon: PhoneCall,
    permissions: ['telecaller:view', 'telecaller:confirmation', 'telecaller:easyship'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'telecaller', 'senior_account_manager', 'ecommerce_executive'],
    capabilities: ['confirmation_calling', 'easyship_ratings', 'cancellation_report', '95_percent_target'],
    description: 'Order confirmation calls, Amazon Easyship rating collection, customer issue resolution',
  },
  /*
  {
    key: 'accounting',
    label: 'Accounting & Finance',
    route: '/accounting',
    icon: Calculator,
    permissions: ['accounting:view', 'accounting:tally', 'accounting:invoicing'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'accountant', 'senior_account_manager'],
    capabilities: ['tally_vouchers', 'stock_reconciliation', 'mybillbook_invoicing', 'banking_dsr', 'cheque_verification'],
    description: 'Tally voucher entry, stock audit, MyBillBook invoicing, banking and cheque collections',
  },
  {
    key: 'marketing',
    label: 'SPN & Ads Optimizer',
    route: '/marketing',
    icon: TrendingUp,
    permissions: ['spn_ads:view', 'spn_ads:keywords', 'spn_ads:budget'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'spn_ads_manager', 'senior_account_manager'],
    capabilities: ['campaign_roas', 'keyword_optimizer', 'bottom_10_skus', 'bid_benchmarks', 'product_research'],
    description: 'PPC campaign management, Auto-to-Exact keywords, bid benchmarks, bottom 10 SKUs',
  },
  {
    key: 'account_management',
    label: 'Account Management',
    route: '/account-management',
    icon: Briefcase,
    permissions: ['sam:view', 'sam:account_health', 'sam:promotions'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'senior_account_manager'],
    capabilities: ['account_health', 'promotions_bxgy', 'profitability_matrix', 'fba_discrepancy', 'po_quality_check'],
    description: 'Account health, coupon & BXGY verification, profitability analysis, FBA oversight',
  },
  {
    key: 'field_ops',
    label: 'Field Ops & Delivery',
    route: '/field-ops',
    icon: Truck,
    permissions: ['delivery:view', 'shipping:deliveries'],
    supportedRoles: ['super_admin', 'admin', 'delivery_boy', 'manager'],
    capabilities: ['parcel_run_sheet', 'delivery_confirmation', 'cheque_collection', 'office_errands'],
    description: 'Daily parcel delivery run-sheet, cheque collection recorder, office tasks',
  },
  {
    key: 'ecommerce_ops',
    label: 'E-Commerce Ops',
    route: '/ecommerce-ops',
    icon: ShoppingBag,
    permissions: ['ecommerce:view', 'ecommerce:orders', 'ecommerce:returns'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'ecommerce_executive', 'senior_account_manager'],
    capabilities: ['cutoff_120pm_orders', 'returns_entry', 'oms_putaway', '60_day_claims', 'fba_fc_files'],
    description: 'Channel order processing (1:20 PM cutoff), Amazon returns entry, OMS putaway, 60-day claims',
  },
  */
  {
    key: 'orders',
    label: 'Orders',
    route: '/orders',
    icon: ShoppingCart,
    permissions: ['orders:view'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'sales', 'senior_account_manager', 'ecommerce_executive', 'accountant', 'telecaller'],
    description: 'Multi-channel sales orders, verification stages, flow tracking',
  },
  {
    key: 'customers',
    label: 'Customers',
    route: '/customers',
    icon: Users,
    permissions: ['customers:view'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'sales', 'telecaller', 'senior_account_manager'],
    description: 'Customer 360 profiles, order history, communication timeline',
  },
  {
    key: 'shipping',
    label: 'Shipping & Courier',
    route: '/shipping',
    icon: Truck,
    permissions: ['shipping:view', 'shipping:serviceability'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'delivery_boy', 'senior_account_manager', 'ecommerce_executive'],
    description: 'Shiprocket logistics, AWB assignment, pincode serviceability checker',
  },
  {
    key: 'warranty',
    label: 'Warranty & Service',
    route: '/warranty',
    icon: ShieldCheck,
    permissions: ['warranty:view'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'technician', 'senior_account_manager'],
    description: 'Warranty registrations, bill verification, technician service requests',
  },
  {
    key: 'tasks',
    label: 'Tasks & Routines',
    route: '/tasks',
    icon: CheckSquare,
    permissions: ['daily_tasks:view', 'tasks:view'],
    supportedRoles: ['*'],
    description: 'Daily shift routines, mandatory task checklists, performance scorecards',
  },
  {
    key: 'csv',
    label: 'CSV Import',
    route: '/csv-import',
    icon: Upload,
    permissions: ['csv:import'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'sales', 'ecommerce_executive', 'telecaller'],
    description: 'Batch upload orders from Amazon, Flipkart, IndiaMART spreadsheets',
  },
  {
    key: 'reports',
    label: 'Reports & BI',
    route: '/reports',
    icon: BarChart2,
    permissions: ['reports:view'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'senior_account_manager', 'spn_ads_manager', 'accountant'],
    description: 'Analytics, channel sales trends, profitability, and data export',
  },
  {
    key: 'hr',
    label: 'HR Workspace',
    route: '/hr',
    icon: Building2,
    permissions: ['employees:view', 'onboarding:manage'],
    supportedRoles: ['super_admin', 'admin', 'hr', 'manager'],
    description: 'Workforce directory, biometric punches, document KYC, monthly payroll',
  },
  {
    key: 'my_attendance',
    label: 'My Attendance',
    route: '/my-attendance',
    icon: Fingerprint,
    permissions: ['attendance:view'],
    supportedRoles: ['*'],
    description: 'Personal biometric punch history, work hours, attendance calendar & corrections',
  },
  {
    key: 'my_documents',
    label: 'My Documents',
    route: '/my-documents',
    icon: FileText,
    permissions: [],
    supportedRoles: ['*'],
    description: 'Personal employee onboarding documents, ID proofs, certificates, and payroll records',
  },
  {
    key: 'settings_users',
    label: 'Users & Rights',
    route: '/settings/users',
    icon: UserCheck,
    permissions: ['access:manage', 'users:manage'],
    supportedRoles: ['super_admin', 'admin', 'manager', 'hr'],
    description: 'RBAC user management, granular permission matrices, security audit logs',
  },
  {
    key: 'settings',
    label: 'Settings',
    route: '/settings',
    icon: Settings,
    permissions: ['settings:manage'],
    supportedRoles: ['super_admin', 'admin'],
    description: 'System configuration, emergency controls, and CRM data management',
  },
];

export const ROLE_CONFIGS: Record<string, { label: string; colour: string; defaultModule: string }> = {
  admin: { label: 'Super admin', colour: 'bg-red-100 text-red-800 border-red-200', defaultModule: '/dashboard' },
  super_admin: { label: 'Super admin', colour: 'bg-red-100 text-red-800 border-red-200', defaultModule: '/dashboard' },
  manager: { label: 'Manager', colour: 'bg-purple-100 text-purple-800 border-purple-200', defaultModule: '/dashboard' },
  senior_account_manager: { label: 'Senior Account Manager', colour: 'bg-cyan-100 text-cyan-800 border-cyan-200', defaultModule: '/dashboard' },
  hr: { label: 'Hr', colour: 'bg-pink-100 text-pink-800 border-pink-200', defaultModule: '/hr' },
  spn_ads_manager: { label: 'SPN & ADs Manager', colour: 'bg-orange-100 text-orange-800 border-orange-200', defaultModule: '/dashboard' },
  accountant: { label: 'Accountant', colour: 'bg-emerald-100 text-emerald-800 border-emerald-200', defaultModule: '/dashboard' },
  ecommerce_executive: { label: 'E-Commerce Executive', colour: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', defaultModule: '/dashboard' },
  telecaller: { label: 'Telecaller', colour: 'bg-amber-100 text-amber-800 border-amber-200', defaultModule: '/telecaller' },
  sales: { label: 'Sales', colour: 'bg-blue-100 text-blue-800 border-blue-200', defaultModule: '/orders' },
  technician: { label: 'Technician', colour: 'bg-teal-100 text-teal-800 border-teal-200', defaultModule: '/warranty' },
  reviewer: { label: 'Reviewer', colour: 'bg-indigo-100 text-indigo-800 border-indigo-200', defaultModule: '/dashboard' },
  delivery_boy: { label: 'Delivery Boy', colour: 'bg-lime-100 text-lime-800 border-lime-200', defaultModule: '/dashboard' },
  employee: { label: 'Employee', colour: 'bg-slate-100 text-slate-800 border-slate-200', defaultModule: '/tasks' },
};

/**
 * Checks whether a user has permission to access a specific module
 */
export const canAccessModule = (user: User | null | undefined, moduleDef: ModuleDefinition): boolean => {
  if (!user) return false;
  const role = (user.role || '').toLowerCase().trim();

  // Root administrators have unrestricted access
  if (role === 'admin' || role === 'super_admin' || role === 'super admin' || user.permissions?.includes('*')) {
    return true;
  }

  // If module supports all roles (like dashboard, tasks)
  if (moduleDef.supportedRoles.includes('*')) {
    return true;
  }

  // Check explicit permission array
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    if (moduleDef.permissions.some(p => user.permissions?.includes(p))) {
      return true;
    }
    // Prefix match
    if (user.permissions.some(p => p.startsWith(moduleDef.key + ':'))) {
      return true;
    }
  }

  // Check role match
  return moduleDef.supportedRoles.some(r => r.toLowerCase().trim() === role);
};
