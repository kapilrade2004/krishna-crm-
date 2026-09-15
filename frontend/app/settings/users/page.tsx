'use strict';
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Select, Modal, Badge, EmptyState, PageLoader } from '@/components/ui';
import { fmtDateTime, timeAgo } from '@/lib/utils';
import {
  Plus, Pencil, ShieldCheck, ShieldOff, Eye, EyeOff, Users, User, Key, Shield,
  Layers, LayoutGrid, Trash2, AlertTriangle, Copy, Lock, Unlock, FileSpreadsheet,
  History, RefreshCw, Search, Building2, CheckCircle2, UserCheck, ShieldAlert
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { User as UserType, Role, Permission, AccessTemplateItem } from '@/types';
import GrantRevokeAccessModal from '@/components/users/GrantRevokeAccessModal';
import RolePermissionMatrix from '@/components/users/RolePermissionMatrix';
import CreateUserWizardModal from '@/components/users/CreateUserWizardModal';
import PasswordManagementModal from '@/components/users/PasswordManagementModal';
import LockAccountModal from '@/components/users/LockAccountModal';
import CloneUserModal from '@/components/users/CloneUserModal';
import LoginHistoryTable from '@/components/users/LoginHistoryTable';
import UserAuditLogsTable from '@/components/users/UserAuditLogsTable';
import AccessTemplatesTab from '@/components/users/AccessTemplatesTab';
import { useAuthStore } from '@/lib/auth';

const ROLE_COLOUR: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 border border-red-200',
  super_admin: 'bg-red-100 text-red-800 border border-red-200',
  manager: 'bg-purple-100 text-purple-800 border border-purple-200',
  employee: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  hr: 'bg-pink-100 text-pink-800 border border-pink-200',
  telecaller: 'bg-amber-100 text-amber-800 border border-amber-200',
  sales: 'bg-blue-100 text-blue-800 border border-blue-200',
  support: 'bg-teal-100 text-teal-800 border border-teal-200',
  technician: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  ceo: 'bg-amber-100 text-amber-800 border border-amber-200',
  reviewer: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  accountant: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  spn_ads_manager: 'bg-orange-100 text-orange-800 border border-orange-200',
  senior_account_manager: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  delivery_boy: 'bg-lime-100 text-lime-800 border border-lime-200',
  ecommerce_executive: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200',
};

export default function UserManagementPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [templates, setTemplates] = useState<AccessTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'templates' | 'login_history' | 'audit_logs'>('users');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showAllPasswords, setShowAllPasswords] = useState(true);
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswordIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`${label} copied!`, { id: `copy-${id}` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // Edit User State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
    employee_id: '',
    role: 'sales',
    status: 'active',
    password: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Archive / Soft Delete Modal
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [userToArchive, setUserToArchive] = useState<UserType | null>(null);
  const [archiving, setArchiving] = useState(false);

  const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, permsRes, tplRes] = await Promise.all([
        api.get('/user-access/users', {
          params: { includeArchived: includeArchived ? 'true' : undefined },
        }).catch(() => api.get('/auth/users')),
        api.get('/user-access/roles').catch(() => ({ data: { data: [] } })),
        api.get('/user-access/permissions').catch(() => ({ data: { data: [] } })),
        api.get('/user-access/templates').catch(() => ({ data: { data: [] } })),
      ]);

      const fetchedUsers = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.data || []);
      const fetchedRoles = Array.isArray(rolesRes.data) ? rolesRes.data : (rolesRes.data?.data || []);
      const fetchedPerms = Array.isArray(permsRes.data) ? permsRes.data : (permsRes.data?.data || []);
      const fetchedTpls = Array.isArray(tplRes.data) ? tplRes.data : (tplRes.data?.data || []);

      setUsers(fetchedUsers);
      setRoles(fetchedRoles);
      setAllPermissions(fetchedPerms);
      setTemplates(fetchedTpls);
    } catch (err) {
      console.error('Failed to load user management data', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role?.toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }
      if (statusFilter !== 'all') {
        const uStatus = u.status || (u.is_active ? 'active' : 'inactive');
        if (statusFilter === 'locked' && !u.is_locked) return false;
        if (statusFilter !== 'locked' && uStatus !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = u.name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchPhone = u.phone?.toLowerCase().includes(q);
        const matchDept = u.department?.toLowerCase().includes(q);
        const matchEmpId = u.employee_id?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchDept && !matchEmpId) {
          return false;
        }
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Open Edit Modal
  const handleOpenEdit = (u: UserType) => {
    setSelectedUser(u);
    setEditForm({
      name: u.name || '',
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      phone: u.phone || '',
      department: u.department || '',
      designation: u.designation || '',
      employee_id: u.employee_id || '',
      role: u.role || 'sales',
      status: u.status || (u.is_active ? 'active' : 'inactive'),
      password: '',
    });
    setEditModalOpen(true);
  };

  // Submit Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, any> = {
        name: editForm.name.trim() || `${editForm.first_name} ${editForm.last_name}`.trim(),
        first_name: editForm.first_name.trim() || null,
        last_name: editForm.last_name.trim() || null,
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || null,
        department: editForm.department.trim() || null,
        designation: editForm.designation.trim() || null,
        employee_id: editForm.employee_id.trim() || null,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await api.patch(`/user-access/users/${selectedUser.id}`, payload);
      toast.success(res.data?.message || 'User updated successfully!');
      setEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update user.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Archive (Soft-delete) User
  const handleArchive = async () => {
    if (!userToArchive) return;
    setArchiving(true);
    try {
      const res = await api.delete(`/user-access/users/${userToArchive.id}`);
      toast.success(res.data?.message || 'User archived successfully.');
      setArchiveModalOpen(false);
      setUserToArchive(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to archive user.');
    } finally {
      setArchiving(false);
    }
  };

  const getStatusPill = (u: UserType) => {
    if (u.is_locked) {
      return (
        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
          <Lock className="w-2.5 h-2.5" /> Locked
        </span>
      );
    }
    const s = u.status || (u.is_active ? 'active' : 'inactive');
    switch (s) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
          </span>
        );
      case 'pending_activation':
        return (
          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending Activation
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Suspended
          </span>
        );
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactive
          </span>
        );
    }
  };

  return (
    <AppShell>
      <Topbar
        title="User Management & Access Authority"
        subtitle="Centralized user identity, hierarchical access delegation, RBAC, and complete audit trail"
      />

      <main className="flex-1 overflow-y-auto p-6 w-full">
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-2">
          <div className="flex items-center gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/80">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'users'
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-gray-600 hover:text-navy hover:bg-white/60'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'users' ? 'text-amber' : 'text-gray-500'}`} /> User Directory
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'users' ? 'bg-amber text-navy' : 'bg-gray-200 text-gray-700'
              }`}>
                {users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'roles'
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-gray-600 hover:text-navy hover:bg-white/60'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'roles' ? 'text-amber' : 'text-gray-500'}`} /> Roles &amp; Permissions
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'templates'
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-gray-600 hover:text-navy hover:bg-white/60'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === 'templates' ? 'text-amber' : 'text-gray-500'}`} /> Access Templates
            </button>

            <button
              onClick={() => setActiveTab('login_history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'login_history'
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-gray-600 hover:text-navy hover:bg-white/60'
              }`}
            >
              <History className={`w-4 h-4 ${activeTab === 'login_history' ? 'text-amber' : 'text-gray-500'}`} /> Login History
            </button>

            <button
              onClick={() => setActiveTab('audit_logs')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'audit_logs'
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-gray-600 hover:text-navy hover:bg-white/60'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'audit_logs' ? 'text-amber' : 'text-gray-500'}`} /> Audit Logs
            </button>
          </div>

          {activeTab === 'users' && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-amber hover:bg-amber/90 text-navy font-bold px-4 py-2 rounded-xl shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 text-navy" /> Create User
            </button>
          )}
        </div>

        {/* Tab 1: User Directory */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-3 sm:p-3.5 border border-gray-200 rounded-2xl shadow-xs">
              <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[220px] w-full xl:max-w-md">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by name, email, department, employee ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-amber/40 focus:border-amber focus:outline-none"
                  />
                </div>

                {/* Filters & Actions in a cohesive row */}
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
                  <div className="w-36 sm:w-44">
                    <Select
                      size="sm"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      options={[
                        { value: 'all', label: 'All Roles' },
                        { value: 'super_admin', label: 'Super Admin' },
                        { value: 'manager', label: 'Manager' },
                        { value: 'hr', label: 'HR' },
                        { value: 'telecaller', label: 'Telecaller' },
                        { value: 'sales', label: 'Sales' },
                        { value: 'technician', label: 'Technician' },
                        { value: 'employee', label: 'Employee' },
                        { value: 'reviewer', label: 'Reviewer' },
                        { value: 'accountant', label: 'Accountant' },
                        { value: 'spn_ads_manager', label: 'SPN & ADs Manager' },
                        { value: 'senior_account_manager', label: 'Senior Account Manager' },
                        { value: 'delivery_boy', label: 'Delivery Boy' },
                        { value: 'ecommerce_executive', label: 'E-Commerce Executive' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="w-32 sm:w-36">
                    <Select
                      size="sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      options={[
                        { value: 'all', label: 'All Statuses' },
                        { value: 'active', label: 'Active' },
                        { value: 'pending_activation', label: 'Pending Activation' },
                        { value: 'suspended', label: 'Suspended' },
                        { value: 'locked', label: 'Locked Out' },
                        { value: 'inactive', label: 'Inactive' },
                        { value: 'archived', label: 'Archived' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 text-xs text-gray-600 font-medium cursor-pointer px-2 py-1.5 rounded-xl hover:bg-gray-50 border border-gray-200/80 bg-white shadow-2xs transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-amber focus:ring-amber border-gray-300"
                    />
                    <span className="whitespace-nowrap">Show Archived</span>
                  </label>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAllPasswords(!showAllPasswords)}
                    className="flex items-center gap-1.5 text-xs text-navy border-gray-200 whitespace-nowrap shadow-2xs"
                    title={showAllPasswords ? "Mask Passwords" : "Reveal Passwords"}
                  >
                    {showAllPasswords ? <EyeOff className="w-3.5 h-3.5 text-gray-500" /> : <Eye className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{showAllPasswords ? 'Mask Passwords' : 'Show Passwords'}</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fetchData}
                    className="flex items-center justify-center p-2 text-xs border-gray-200 shadow-2xs"
                    title="Refresh List"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Users Table */}
            {loading ? (
              <div className="p-16 flex justify-center">
                <PageLoader />
              </div>
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                title="No Users Found"
                description="Try adjusting your search criteria or click 'Create User' to add a new account."
              />
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/90 text-navy font-bold border-b border-gray-200">
                      <tr>
                        <th className="p-3.5 whitespace-nowrap">User Identity</th>
                        <th className="p-3.5 whitespace-nowrap">Department &amp; Title</th>
                        <th className="p-3.5 whitespace-nowrap">Role</th>
                        <th className="p-3.5 whitespace-nowrap">Status</th>
                        <th className="p-3.5 whitespace-nowrap">Password / Credentials</th>
                        <th className="p-3.5 whitespace-nowrap">Access Scope</th>
                        <th className="p-3.5 whitespace-nowrap">Last Login</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.map((u) => {
                        const isTargetSuperAdmin = u.role === 'admin' || u.role === 'super_admin';
                        const canModify = isSuperAdmin || (!isTargetSuperAdmin && u.id !== currentUser?.id);

                        return (
                          <tr key={u.id} className="hover:bg-amber-50/20 transition-colors">
                            {/* Identity */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-navy text-amber flex items-center justify-center font-bold text-xs shadow-xs">
                                  {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div>
                                  <div className="font-bold text-navy flex items-center gap-1.5">
                                    <span>{u.name}</span>
                                    {u.employee_id && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-navy/5 text-navy font-mono border border-navy/10">
                                        {u.employee_id}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-500 text-[11px] font-mono">{u.email}</div>
                                  {u.phone && <div className="text-gray-400 text-[10px]">{u.phone}</div>}
                                </div>
                              </div>
                            </td>

                            {/* Organization */}
                            <td className="p-3.5">
                              <div className="text-gray-900 font-semibold">{u.designation || 'Staff'}</div>
                              <div className="text-gray-400 text-[11px] flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {u.department || 'General'}
                              </div>
                            </td>

                            {/* Role */}
                            <td className="p-3.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider ${
                                  ROLE_COLOUR[u.role?.toLowerCase()] || 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {u.role?.replace(/_/g, ' ')}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="p-3.5">{getStatusPill(u)}</td>

                            {/* Password / Credentials */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/80 text-gray-800 shadow-2xs">
                                  <Lock className="w-3 h-3 text-gray-400 shrink-0" />
                                  <span className="font-semibold text-gray-800 tracking-wide select-all">
                                    {showAllPasswords || visiblePasswordIds[u.id] ? (u.display_password || 'Admin@123456') : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility(u.id)}
                                    className="text-gray-400 hover:text-navy p-0.5 ml-0.5 rounded transition-colors"
                                    title={visiblePasswordIds[u.id] ? "Hide Password" : "Show Password"}
                                  >
                                    {visiblePasswordIds[u.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(u.display_password || 'Admin@123456', u.id, 'Password')}
                                    className="text-gray-400 hover:text-navy p-0.5 ml-0.5 rounded transition-colors"
                                    title="Copy Password"
                                  >
                                    {copiedId === u.id ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Access Scope */}
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-gray-700">
                                  {u.permissions?.includes('*')
                                    ? 'Unrestricted (*)'
                                    : `${u.permissions?.length || 0} Permissions`}
                                </span>
                              </div>
                            </td>

                            {/* Last Login */}
                            <td className="p-3.5 text-gray-500 whitespace-nowrap">
                              {u.last_login_at ? (
                                <div>
                                  <div className="text-[11px]">{fmtDateTime(u.last_login_at)}</div>
                                  <span className="text-[10px] text-gray-400">{timeAgo(u.last_login_at)}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[11px]">Never</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(u)}
                                  disabled={!canModify}
                                  className="p-1.5 text-gray-500 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Edit Profile & Org Details"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setAccessModalOpen(true);
                                  }}
                                  disabled={!canModify}
                                  className="p-1.5 text-gray-500 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Manage Access & Permission Overrides"
                                >
                                  <Shield className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setCloneModalOpen(true);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors"
                                  title="Clone User Permissions"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setPasswordModalOpen(true);
                                  }}
                                  disabled={!canModify}
                                  className="p-1.5 text-gray-500 hover:text-amber-700 hover:bg-amber/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Reset Password"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setLockModalOpen(true);
                                  }}
                                  disabled={!canModify || u.id === currentUser?.id}
                                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                    u.is_locked
                                      ? 'text-rose-600 hover:bg-rose-50'
                                      : 'text-gray-500 hover:text-rose-600 hover:bg-rose-50'
                                  }`}
                                  title={u.is_locked ? 'Unlock Account' : 'Lock Account'}
                                >
                                  {u.is_locked ? <Unlock className="w-3.5 h-3.5 text-rose-600" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                  onClick={() => {
                                    setUserToArchive(u);
                                    setArchiveModalOpen(true);
                                  }}
                                  disabled={!canModify || u.id === currentUser?.id || u.status === 'archived'}
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Archive / Soft Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Role Permission Matrix */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            <RolePermissionMatrix
              roles={roles}
              permissions={allPermissions}
              onRefresh={fetchData}
            />
          </div>
        )}

        {/* Tab 3: Access Templates */}
        {activeTab === 'templates' && (
          <AccessTemplatesTab
            templates={templates}
            allPermissions={allPermissions}
            onRefresh={fetchData}
          />
        )}

        {/* Tab 4: Login History */}
        {activeTab === 'login_history' && <LoginHistoryTable />}

        {/* Tab 5: User Audit Logs */}
        {activeTab === 'audit_logs' && <UserAuditLogsTable />}
        </div>
      </main>

      {/* ─── MODALS ────────────────────────────────────────────────────────── */}

      {/* 4-Section Create User Wizard */}
      <CreateUserWizardModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchData}
        allRoles={roles}
        allPermissions={allPermissions}
        existingUsers={users}
        templates={templates}
        currentUser={currentUser as any}
      />

      {/* Password Reset Modal */}
      <PasswordManagementModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={fetchData}
        user={selectedUser}
      />

      {/* Lock Account Modal */}
      <LockAccountModal
        isOpen={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        onSuccess={fetchData}
        user={selectedUser}
      />

      {/* Clone User Modal */}
      <CloneUserModal
        isOpen={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        onSuccess={fetchData}
        sourceUser={selectedUser}
      />

      {/* Access Rights Grant / Revoke Modal */}
      <GrantRevokeAccessModal
        open={accessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        onSaved={fetchData}
        user={selectedUser}
        allPermissions={allPermissions}
      />

      {/* Edit User Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit User: ${selectedUser?.name}`}
        size="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Display Name *"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
            <Input
              label="Email Address *"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              required
            />
            <Input
              label="New Password (Optional)"
              type="text"
              placeholder="Leave blank to keep current password"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <Input
              label="Department"
              value={editForm.department}
              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            />
            <Input
              label="Designation"
              value={editForm.designation}
              onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
            />
            <Input
              label="Employee ID"
              value={editForm.employee_id}
              onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
            />
            <Select
              label="System Role"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              options={roles.length > 0 ? roles.map((r) => ({ value: r.name, label: r.name.replace(/_/g, ' ').toUpperCase() })) : [
                { value: 'admin', label: 'SUPER ADMIN' },
                { value: 'manager', label: 'OPERATIONS MANAGER' },
                { value: 'hr', label: 'HR EXECUTIVE' },
                { value: 'sales', label: 'SALES EXECUTIVE' },
                { value: 'telecaller', label: 'TELECALLER' },
                { value: 'technician', label: 'FIELD TECHNICIAN' },
                { value: 'employee', label: 'OPERATIONS STAFF' },
                { value: 'reviewer', label: 'PRODUCT REVIEWER' },
                { value: 'accountant', label: 'ACCOUNTANT' },
                { value: 'spn_ads_manager', label: 'SPN & ADS MANAGER' },
                { value: 'senior_account_manager', label: 'SENIOR ACCOUNT MANAGER' },
                { value: 'delivery_boy', label: 'DELIVERY BOY' },
                { value: 'ecommerce_executive', label: 'E-COMMERCE EXECUTIVE' },
              ]}
            />
            <Select
              label="Status"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'pending_activation', label: 'Pending Activation' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={savingEdit}>
              <CheckCircle2 className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        open={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Archive User Account (Soft Delete)"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Confirm User Archival</span>
            </div>
            <p>
              Are you sure you want to archive <strong>{userToArchive?.name}</strong> (
              <span className="font-mono">{userToArchive?.email}</span>)?
            </p>
            <p className="text-[11px] text-red-700">
              ✓ Login access will be immediately terminated.
              <br />
              ✓ Historical orders, customer associations, and warranty records will be safely preserved.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setArchiveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={archiving}
              onClick={handleArchive}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Archive User Account
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}