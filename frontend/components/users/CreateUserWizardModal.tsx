'use strict';
'use client';

import { useState, useMemo } from 'react';
import { Button, Input, Modal, Badge } from '@/components/ui';
import {
  User,
  Mail,
  Lock,
  Shield,
  Building2,
  Phone,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  Briefcase,
  Layers,
  ChevronRight,
  ChevronLeft,
  Key,
  ShieldCheck,
  UserCog,
  ShoppingBag,
  PhoneCall,
  Wrench,
  Check,
  FileSpreadsheet,
  TrendingUp,
  Award,
  Truck,
  ShoppingCart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Role, Permission, User as UserType, AccessTemplateItem } from '@/types';
import api from '@/lib/api';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allRoles?: Role[];
  allPermissions?: Permission[];
  existingUsers?: UserType[];
  templates?: AccessTemplateItem[];
  currentUser?: UserType | null;
}

const SYSTEM_ROLES = [
  {
    value: 'sales',
    label: 'Sales Officer',
    desc: 'Orders, customer CRM, shipping & warranty lookup',
    icon: ShoppingBag,
    color: 'border-blue-500 bg-blue-50/70 text-blue-800',
    modules: ['Orders', 'Customers', 'Shipping', 'Follow-ups'],
  },
  {
    value: 'telecaller',
    label: 'Telecaller',
    desc: 'Calling workstation, CSV leads & customer follow-ups',
    icon: PhoneCall,
    color: 'border-amber-500 bg-amber-50/70 text-amber-900',
    modules: ['Calling', 'Leads', 'Follow-ups', 'Customers'],
  },
  {
    value: 'reviewer',
    label: 'Reviewer',
    desc: 'Product reviews management, rating collection & validation',
    icon: ShieldCheck,
    color: 'border-indigo-500 bg-indigo-50/70 text-indigo-800',
    modules: ['Reviews', 'Ratings', 'Tasks', 'Daily Activities'],
  },
  {
    value: 'accountant',
    label: 'Accountant',
    desc: 'Tally entry, MyBillBook, stock audits, ledger & banking',
    icon: FileSpreadsheet,
    color: 'border-emerald-600 bg-emerald-50/70 text-emerald-800',
    modules: ['Tally', 'MyBillBook', 'Stock', 'Invoicing', 'Orders'],
  },
  {
    value: 'spn_ads_manager',
    label: 'SPN & ADs Manager',
    desc: 'Traffic growth, keyword bids, budget allocation & ad monitoring',
    icon: TrendingUp,
    color: 'border-orange-500 bg-orange-50/70 text-orange-800',
    modules: ['Advertising', 'Keywords', 'Bids', 'Reports', 'SKUs'],
  },
  {
    value: 'senior_account_manager',
    label: 'Senior Account Manager',
    desc: 'Marketplace health, coupon promotions, QC & profitability',
    icon: Award,
    color: 'border-cyan-600 bg-cyan-50/70 text-cyan-800',
    modules: ['Account Health', 'FBA', 'Coupons', 'Profitability', 'Orders'],
  },
  {
    value: 'delivery_boy',
    label: 'Delivery Boy',
    desc: 'Field product deliveries, office assignments & cheque collections',
    icon: Truck,
    color: 'border-lime-600 bg-lime-50/70 text-lime-800',
    modules: ['Delivery', 'Cheques', 'Shipping', 'Office Work'],
  },
  {
    value: 'ecommerce_executive',
    label: 'E-Commerce Executive',
    desc: 'Channel order processing, listings, returns & claims putaway',
    icon: ShoppingCart,
    color: 'border-fuchsia-500 bg-fuchsia-50/70 text-fuchsia-800',
    modules: ['Orders', 'Listings', 'Returns', 'Claims', 'OMS Guru'],
  },
  {
    value: 'manager',
    label: 'Manager',
    desc: 'Operations, orders, activity assignments & team reports',
    icon: UserCheck,
    color: 'border-purple-500 bg-purple-50/70 text-purple-800',
    modules: ['Orders', 'Customers', 'Tasks', 'Reports', 'Audits'],
  },
  {
    value: 'hr',
    label: 'HR Executive',
    desc: 'Employee directory, onboarding documentation & audits',
    icon: UserCog,
    color: 'border-pink-500 bg-pink-50/70 text-pink-800',
    modules: ['Employees', 'Payroll', 'Onboarding', 'Audits'],
  },
  {
    value: 'technician',
    label: 'Field Technician',
    desc: 'Warranty service requests & installation tickets',
    icon: Wrench,
    color: 'border-emerald-500 bg-emerald-50/70 text-emerald-800',
    modules: ['Warranties', 'Service Tickets', 'Activities'],
  },
  {
    value: 'employee',
    label: 'General Employee',
    desc: 'Daily shift activities, personal documents & profile',
    icon: Briefcase,
    color: 'border-gray-400 bg-gray-50/70 text-gray-800',
    modules: ['Daily Activities', 'Profile', 'Documents'],
  },
  {
    value: 'super_admin',
    label: 'Super Admin',
    desc: 'Full unrestricted system administration & security authority',
    icon: Shield,
    color: 'border-red-500 bg-red-50/70 text-red-800',
    modules: ['All Modules', 'User Access', 'Settings', 'Full System'],
  },
];

const MODULE_ENTITLEMENTS = [
  { id: 'orders', label: 'Order Processing', desc: 'Create, update & fulfill customer orders' },
  { id: 'customers', label: 'Customer CRM', desc: 'Customer database, interactions & history' },
  { id: 'tasks', label: 'Daily Activities', desc: '24h shift activity assignments & execution' },
  { id: 'shipping', label: 'Shipping & Logistics', desc: 'Shiprocket courier tracking & dispatches' },
  { id: 'warranty', label: 'Warranty & Claims', desc: 'Product registrations & service tickets' },
  { id: 'hr', label: 'HR & Employees', desc: 'Staff directory, payroll profiles & audits' },
  { id: 'reports', label: 'Reports & Analytics', desc: 'Business intelligence & executive dashboards' },
];

export default function CreateUserWizardModal({
  isOpen,
  onClose,
  onSuccess,
  allPermissions = [],
  existingUsers = [],
  templates = [],
  currentUser,
}: CreateUserModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Profile & Organization
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState('sales');
  const [department, setDepartment] = useState('Sales & Marketing');
  const [designation, setDesignation] = useState('Sales Officer');
  const [employeeId, setEmployeeId] = useState('');
  const [reportingManagerId, setReportingManagerId] = useState('');

  // Step 2: Security & Permissions
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'active' | 'inactive' | 'pending_activation'>('active');
  const [forcePasswordReset, setForcePasswordReset] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({
    orders: true,
    customers: true,
    tasks: true,
    shipping: true,
    warranty: false,
    hr: false,
    reports: false,
  });

  const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Available roles (non-super admins cannot create super admins)
  const availableRoles = SYSTEM_ROLES.filter((r) => {
    if (r.value === 'super_admin' && !isSuperAdmin) return false;
    return true;
  });

  // Current active role definition
  const currentRoleDef = SYSTEM_ROLES.find((r) => r.value === selectedRole) || SYSTEM_ROLES[0];

  // Auto-update department and designation when role changes
  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    if (newRole === 'sales') {
      setDepartment('Sales & Marketing');
      setDesignation('Sales Officer');
      setEnabledModules({ orders: true, customers: true, tasks: true, shipping: true, warranty: false, hr: false, reports: false });
    } else if (newRole === 'telecaller') {
      setDepartment('Customer Calling');
      setDesignation('Senior Telecaller');
      setEnabledModules({ orders: true, customers: true, tasks: true, shipping: false, warranty: false, hr: false, reports: false });
    } else if (newRole === 'manager') {
      setDepartment('Operations');
      setDesignation('Operations Manager');
      setEnabledModules({ orders: true, customers: true, tasks: true, shipping: true, warranty: true, hr: false, reports: true });
    } else if (newRole === 'hr') {
      setDepartment('Human Resources');
      setDesignation('HR Executive');
      setEnabledModules({ orders: false, customers: false, tasks: true, shipping: false, warranty: false, hr: true, reports: true });
    } else if (newRole === 'technician') {
      setDepartment('Field Service');
      setDesignation('Lead Field Technician');
      setEnabledModules({ orders: false, customers: true, tasks: true, shipping: false, warranty: true, hr: false, reports: false });
    } else if (newRole === 'employee') {
      setDepartment('General Staff');
      setDesignation('Associate');
      setEnabledModules({ orders: false, customers: false, tasks: true, shipping: false, warranty: false, hr: false, reports: false });
    } else if (newRole === 'super_admin') {
      setDepartment('Executive Management');
      setDesignation('System Administrator');
      setEnabledModules({ orders: true, customers: true, tasks: true, shipping: true, warranty: true, hr: true, reports: true });
    }
  };

  // Generate secure temporary password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Kri@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setShowPassword(true);
    toast.success('Generated secure initial password');
  };

  const toggleModule = (modId: string) => {
    setEnabledModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const validateStep1 = () => {
    if (!firstName.trim()) {
      toast.error('First name is required.');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Valid work email address is required.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      if (!password) {
        handleGeneratePassword();
      }
      setStep(2);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setSelectedRole('sales');
    setDepartment('Sales & Marketing');
    setDesignation('Sales Officer');
    setEmployeeId('');
    setReportingManagerId('');
    setPassword('');
    setStatus('active');
    setForcePasswordReset(true);
    setSelectedTemplateId('');
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep1()) {
      setStep(1);
      return;
    }

    if (!password || password.length < 6) {
      setStep(2);
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const cleanEmail = email.trim().toLowerCase();

    setSubmitting(true);
    try {
      const payload = {
        name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: cleanEmail,
        password,
        role: selectedRole === 'super_admin' ? 'admin' : selectedRole,
        phone: phone.trim() || null,
        department: department.trim() || null,
        designation: designation.trim() || null,
        employee_id: employeeId.trim() || null,
        reporting_manager_id: reportingManagerId || null,
        status,
        force_password_reset: forcePasswordReset,
        access_type: 'role',
        template_id: selectedTemplateId || null,
      };

      const res = await api.post('/user-access/users', payload);
      toast.success(res.data?.message || `User account for ${fullName} created successfully!`);
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create user.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Create New User Account"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── 2-Step Interactive Stepper ───────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 border-b border-gray-100 pb-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
              step === 1
                ? 'bg-amber/10 border-amber text-navy shadow-xs ring-2 ring-amber/20'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100/70'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                step === 1 ? 'bg-amber text-navy' : 'bg-gray-200 text-gray-700'
              }`}
            >
              1
            </div>
            <div>
              <div className="text-xs font-bold">1. Profile &amp; Organization</div>
              <div className="text-[10px] text-gray-500">Identity, role &amp; hierarchy details</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (validateStep1()) setStep(2);
            }}
            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
              step === 2
                ? 'bg-amber/10 border-amber text-navy shadow-xs ring-2 ring-amber/20'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100/70'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                step === 2 ? 'bg-amber text-navy' : 'bg-gray-200 text-gray-700'
              }`}
            >
              2
            </div>
            <div>
              <div className="text-xs font-bold">2. Security &amp; Permissions</div>
              <div className="text-[10px] text-gray-500">Credentials, status &amp; module access</div>
            </div>
          </button>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* STEP 1: PROFILE & ORGANIZATION DETAILS                          */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in-50 duration-150">
            {/* Section 1A: Personal Identity */}
            <div>
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-amber" /> Personal &amp; Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Input
                  label="First Name *"
                  placeholder="e.g. Rahul"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoFocus
                />

                <Input
                  label="Last Name"
                  placeholder="e.g. Sharma"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />

                <Input
                  label="Official Work Email *"
                  type="email"
                  placeholder="rahul.sharma@krishnacrm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Input
                  label="Mobile Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Section 1B: Role & Hierarchy Selection */}
            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-amber" /> Organization &amp; Role Assignment
              </h3>

              {/* Role Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                {availableRoles.map((r) => {
                  const IconComp = r.icon;
                  const isSelected = selectedRole === r.value;
                  return (
                    <div
                      key={r.value}
                      onClick={() => handleRoleChange(r.value)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? `${r.color} shadow-sm ring-2 ring-amber/30`
                          : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconComp size={15} />
                          <span className="text-xs font-bold">{r.label}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-amber-800" />}
                      </div>
                      <p className="text-[10px] opacity-80 leading-tight">{r.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Organization Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-gray-50/70 p-3.5 rounded-2xl border border-gray-200">
                <Input
                  label="Department"
                  placeholder="e.g. Sales, Operations"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />

                <Input
                  label="Job Designation"
                  placeholder="e.g. Senior Executive"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />

                <Input
                  label="Employee Code / ID"
                  placeholder="e.g. KR-EMP-015"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                />

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reporting Manager</label>
                  <select
                    value={reportingManagerId}
                    onChange={(e) => setReportingManagerId(e.target.value)}
                    className="form-select w-full text-xs h-[34px]"
                  >
                    <option value="">None / Direct</option>
                    {existingUsers
                      .filter((u) => u.role === 'manager' || u.role === 'admin' || u.role === 'super_admin')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleNext}
                className="flex items-center gap-1.5 font-bold px-4"
              >
                Next: Security &amp; Permissions <ChevronRight size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* STEP 2: SECURITY, CREDENTIALS & PERMISSIONS                     */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in-50 duration-150">
            {/* Selected User Summary Banner */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-navy text-white flex items-center justify-center font-bold text-xs">
                  {firstName.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="text-xs font-bold text-navy">
                    {firstName} {lastName}
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono">{email}</div>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber/20 text-navy border border-amber/30">
                Role: {currentRoleDef.label}
              </span>
            </div>

            {/* Section 2A: Credentials & Security Settings */}
            <div>
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-amber" /> Authentication &amp; Password Settings
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Password input with generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Lock size={12} className="text-navy" /> Initial Login Password *
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw size={10} /> Auto-Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter initial password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full text-xs bg-white border border-gray-300 rounded-xl pl-3 pr-9 py-2 text-navy font-mono focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent h-[36px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-navy focus:outline-none"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Account Status Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Initial Account Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="form-select w-full text-xs font-semibold h-[36px]"
                  >
                    <option value="active">Active (Immediate Login Enabled)</option>
                    <option value="pending_activation">Pending Activation</option>
                    <option value="inactive">Inactive (Access Disabled)</option>
                  </select>
                </div>
              </div>

              {/* Force Password Reset Policy */}
              <div className="mt-3 p-3 bg-amber/5 border border-amber/20 rounded-xl">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-800 font-semibold">
                  <input
                    type="checkbox"
                    checked={forcePasswordReset}
                    onChange={(e) => setForcePasswordReset(e.target.checked)}
                    className="w-4 h-4 text-amber rounded border-gray-300 focus:ring-amber"
                  />
                  <span>Require user to set a new password on their first login (Recommended)</span>
                </label>
              </div>
            </div>

            {/* Section 2B: Module Entitlements & Permissions */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber" /> Module Entitlements &amp; Access Authority
                </h3>
                {templates.length > 0 && (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="form-select text-[11px]"
                  >
                    <option value="">Standard Role Defaults</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        Template: {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Module Checkboxes / Toggle Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {MODULE_ENTITLEMENTS.map((m) => {
                  const isEnabled = Boolean(enabledModules[m.id]);
                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleModule(m.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        isEnabled
                          ? 'bg-navy/5 border-navy/30 text-navy font-semibold'
                          : 'bg-white border-gray-200 text-gray-400 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleModule(m.id)}
                        className="mt-0.5 w-4 h-4 text-navy rounded border-gray-300 focus:ring-navy pointer-events-none"
                      />
                      <div className="text-left">
                        <div className="text-xs">{m.label}</div>
                        <div className="text-[10px] text-gray-500 font-normal leading-tight">{m.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setStep(1)}
                className="flex items-center gap-1"
              >
                <ChevronLeft size={15} /> Back to Profile
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  className="flex items-center gap-1.5 font-bold px-4 shadow-xs"
                >
                  <CheckCircle2 size={15} /> Create User Account
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
