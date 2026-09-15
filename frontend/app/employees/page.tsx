'use strict';
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Button, Input, Select, Modal, PageLoader, EmptyState,
} from '@/components/ui';
import {
  Search,
  Plus,
  Users,
  ChevronRight,
  ChevronLeft,
  FileText,
  Building2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
  Briefcase,
  MoreVertical,
  ArrowUpRight
} from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import type { Employee, EmploymentType } from '@/types';

const AVATAR_PALETTES = [
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200/80 ring-1 ring-indigo-500/10' },
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200/80 ring-1 ring-blue-500/10' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80 ring-1 ring-emerald-500/10' },
  { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200/80 ring-1 ring-amber-500/10' },
  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200/80 ring-1 ring-purple-500/10' },
  { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200/80 ring-1 ring-rose-500/10' },
  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200/80 ring-1 ring-teal-500/10' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200/80 ring-1 ring-cyan-500/10' },
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  employment_type: 'full_time' as EmploymentType,
  date_of_joining: '',
  employee_code: '',
  reporting_manager: '',
  salary: 25000,
};

export default function EmployeesPage() {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isHR = currentUser?.role === 'hr';
  const canManage = isSuperAdmin || isHR;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination & selection
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  // Super Admin Delete State
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      const list = res.data?.data?.employees || res.data?.data || [];
      setEmployees(list);
    } catch (err: any) {
      toast.error('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/employees/${deleteTarget.id}`);
      toast.success(`Employee ${deleteTarget.first_name} ${deleteTarget.last_name} deleted successfully.`);
      setDeleteTarget(null);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete employee.');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Extract unique departments
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Extract unique roles
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.linkedUser?.role) set.add(e.linkedUser.role);
    });
    return Array.from(set);
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (deptFilter !== 'all' && e.department !== deptFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (roleFilter !== 'all' && e.linkedUser?.role !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = `${e.first_name} ${e.last_name}`.toLowerCase().includes(q);
        const matchEmail = e.email?.toLowerCase().includes(q);
        const matchPhone = e.phone?.toLowerCase().includes(q);
        const matchCode = e.employee_code?.toLowerCase().includes(q);
        const matchTitle = e.designation?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchCode && !matchTitle) {
          return false;
        }
      }
      return true;
    });
  }, [employees, deptFilter, statusFilter, roleFilter, searchQuery]);

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, currentPage, pageSize]);

  // Selection handlers
  const isAllSelected = paginatedEmployees.length > 0 && paginatedEmployees.every((e) => selectedIds[e.id]);
  const toggleSelectAll = () => {
    if (isAllSelected) {
      const next = { ...selectedIds };
      paginatedEmployees.forEach((e) => delete next[e.id]);
      setSelectedIds(next);
    } else {
      const next = { ...selectedIds };
      paginatedEmployees.forEach((e) => {
        next[e.id] = true;
      });
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      return toast.error('First and Last name are required.');
    }

    setCreating(true);
    try {
      await api.post('/employees', form);
      toast.success('Employee created successfully!');
      setCreateModal(false);
      setForm(emptyForm);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create employee.');
    } finally {
      setCreating(false);
    }
  };

  // Metrics calculations
  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.status === 'active').length;
  const inactiveCount = employees.filter((e) => e.status === 'inactive' || e.status === 'terminated').length;
  const pendingOnboarding = employees.filter((e) => e.onboarding_status !== 'completed').length;
  const departmentCount = departmentOptions.length || (totalCount > 0 ? 1 : 0);

  return (
    <AppShell>
      <Topbar
        title="Employee Directory & HR"
        subtitle="Manage your team, roles, and employee information in one place."
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 w-full bg-[#f8fafc]">
        <div className="space-y-5 max-w-[1400px] mx-auto pb-12">
          
          {/* 5 KPI Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            {/* 1. Total Employees */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between hover:border-gray-300 transition-all">
              <div>
                <p className="text-[12px] font-medium text-gray-500">Total Employees</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900 tracking-tight">{totalCount}</span>
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center">
                    ↑ 12%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">vs last month</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100/60 shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* 2. Active */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between hover:border-gray-300 transition-all">
              <div>
                <p className="text-[12px] font-medium text-gray-500">Active</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900 tracking-tight">{activeCount}</span>
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center">
                    ↑ 4%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Currently working</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100/60 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            {/* 3. Inactive / Blocked */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between hover:border-gray-300 transition-all">
              <div>
                <p className="text-[12px] font-medium text-gray-500">Inactive / Blocked</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900 tracking-tight">{inactiveCount}</span>
                  <span className="text-[11px] font-medium text-gray-400">
                    0%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Suspended / exited</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100/60 shrink-0">
                <UserX className="w-5 h-5" />
              </div>
            </div>

            {/* 4. Onboarding In Progress */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between hover:border-gray-300 transition-all">
              <div>
                <p className="text-[12px] font-medium text-gray-500">Onboarding In Progress</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900 tracking-tight">{pendingOnboarding}</span>
                  <span className="text-[11px] font-medium text-amber-600">
                    Pending
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Docs incomplete</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100/60 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* 5. Departments */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex items-center justify-between hover:border-gray-300 transition-all">
              <div>
                <p className="text-[12px] font-medium text-gray-500">Departments</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-gray-900 tracking-tight">{departmentCount}</span>
                  <span className="text-[11px] font-medium text-gray-400">
                    Units
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Active organizational</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 border border-red-100/60 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Clean Single-Row Filter & Action Toolbar */}
          <div className="bg-white p-2.5 px-3.5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between gap-3 overflow-x-auto">
            {/* Search Input */}
            <div className="relative w-72 shrink-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, code, email, phone..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-[38px] pl-10 pr-3.5 text-xs border border-gray-200 rounded-full bg-gray-50/60 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-hidden text-gray-800 placeholder-gray-400"
              />
            </div>

            {/* Dropdowns & Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-44 shrink-0">
                <Select
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  size="sm"
                  triggerClassName="rounded-full h-[38px] min-h-[38px] text-xs font-medium border-gray-200 bg-white hover:bg-gray-50/80"
                  options={[
                    { value: 'all', label: 'All Departments' },
                    ...departmentOptions.map((d) => ({ value: d, label: d })),
                  ]}
                />
              </div>

              <div className="w-36 shrink-0">
                <Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  size="sm"
                  triggerClassName="rounded-full h-[38px] min-h-[38px] text-xs font-medium border-gray-200 bg-white hover:bg-gray-50/80"
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'terminated', label: 'Terminated (Exit)' },
                  ]}
                />
              </div>

              {roleOptions.length > 0 && (
                <div className="w-40 shrink-0">
                  <Select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    size="sm"
                    triggerClassName="rounded-full h-[38px] min-h-[38px] text-xs font-medium border-gray-200 bg-white hover:bg-gray-50/80"
                    options={[
                      { value: 'all', label: 'All Roles' },
                      ...roleOptions.map((r) => ({
                        value: r,
                        label: r.replace(/_/g, ' ').toUpperCase(),
                      })),
                    ]}
                  />
                </div>
              )}

              {/* Refresh Icon Button */}
              <button
                type="button"
                onClick={fetchEmployees}
                title="Refresh Table"
                className="h-[38px] w-[38px] shrink-0 flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 text-gray-600 transition-all shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {/* Document Center Button */}
              <Link href="/hr/document-center" className="shrink-0">
                <button
                  type="button"
                  className="h-[38px] px-3.5 rounded-full border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-700 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs active:scale-[0.98] whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  Document Center
                </button>
              </Link>

              {/* Add Employee Button */}
              {canManage && (
                <button
                  type="button"
                  onClick={() => setCreateModal(true)}
                  className="h-[38px] px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all shrink-0 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
                  Add Employee
                </button>
              )}
            </div>
          </div>

          {/* Directory SaaS Table */}
          {loading ? (
            <div className="bg-white border border-gray-200/80 rounded-xl p-16 flex justify-center shadow-xs">
              <PageLoader />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="bg-white border border-gray-200/80 rounded-xl p-8 shadow-xs">
              <EmptyState
                title="No Employees Found"
                description="Try adjusting your filter or search query."
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200/80 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8fafc] text-gray-500 font-semibold border-b border-gray-200/80 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </th>
                      <th className="py-3 px-3.5">Employee Name</th>
                      <th className="py-3 px-3.5">Employee Code</th>
                      <th className="py-3 px-3.5">Role</th>
                      <th className="py-3 px-3.5">Department & Title</th>
                      <th className="py-3 px-3.5">Reporting Manager</th>
                      <th className="py-3 px-3.5">Joining Date</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedEmployees.map((emp) => {
                      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee';
                      const initials = `${(emp.first_name?.[0] || 'E')}${(emp.last_name?.[0] || '')}`.toUpperCase();
                      const avatar = getAvatarStyle(fullName);
                      const isSelected = Boolean(selectedIds[emp.id]);
                      const roleLabel = (emp.linkedUser?.role || 'employee').replace(/_/g, ' ').toUpperCase();

                      return (
                        <tr
                          key={emp.id}
                          className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                        >
                          {/* Checkbox */}
                          <td className="py-3 px-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(emp.id)}
                              className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                          </td>

                          {/* Employee Name + Avatar */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs tracking-wider border shrink-0 transition-transform ${avatar.bg} ${avatar.text} ${avatar.border}`}
                              >
                                {initials}
                              </div>
                              <div>
                                <Link
                                  href={`/employees/${emp.id}`}
                                  className="font-semibold text-gray-900 hover:text-blue-600 transition-colors block leading-tight"
                                >
                                  {fullName}
                                </Link>
                                <p className="text-[11px] text-gray-400 font-normal mt-0.5 leading-tight">
                                  {emp.email || emp.phone || 'No contact email'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Employee Code */}
                          <td className="py-3 px-3.5">
                            <span className="font-mono text-gray-600 text-[11px] font-medium bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                              {emp.employee_code || '—'}
                            </span>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3 px-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50/80 text-blue-700 border border-blue-100/70 text-[10px] font-semibold tracking-wide uppercase">
                              {roleLabel}
                            </span>
                          </td>

                          {/* Department & Designation */}
                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-gray-900">
                              {emp.designation || 'Staff'}
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                              <span>{emp.department || 'General'}</span>
                            </div>
                          </td>

                          {/* Reporting Manager */}
                          <td className="py-3 px-3.5 text-gray-600">
                            {emp.reporting_manager || 'None'}
                          </td>

                          {/* Joining Date */}
                          <td className="py-3 px-3.5 text-gray-500 font-medium">
                            {emp.date_of_joining ? fmtDate(emp.date_of_joining) : '—'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3.5">
                            {emp.status === 'active' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Active
                              </span>
                            ) : emp.status === 'terminated' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                Terminated
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                Inactive
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link href={`/employees/${emp.id}`}>
                                <button
                                  type="button"
                                  className="h-7 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                                >
                                  View Profile
                                  <ChevronRight className="w-3 h-3 text-gray-400" />
                                </button>
                              </Link>

                              {isSuperAdmin && (
                                <button
                                  type="button"
                                  title="Delete Employee"
                                  onClick={() => setDeleteTarget(emp)}
                                  className="h-7 w-7 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Pagination Bar */}
              <div className="py-3 px-4 bg-white border-t border-gray-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                <div>
                  Showing{' '}
                  <span className="font-semibold text-gray-900">
                    {filteredEmployees.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-gray-900">
                    {Math.min(currentPage * pageSize, filteredEmployees.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-gray-900">{filteredEmployees.length}</span> employees
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-7 h-7 px-2 text-xs font-semibold rounded-md border transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="w-28">
                    <Select
                      value={String(pageSize)}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      size="sm"
                      options={[
                        { value: '5', label: '5 per page' },
                        { value: '10', label: '10 per page' },
                        { value: '25', label: '25 per page' },
                        { value: '50', label: '50 per page' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Add Employee Modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Add New Employee"
        size="lg"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder="e.g. Vikram"
              required
            />
            <Input
              label="Last Name *"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder="e.g. Verma"
              required
            />
            <Input
              label="Official Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="vikram@krishnacrm.com"
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
            <Input
              label="Employee Code"
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              placeholder="EMP-1050"
            />
            <Input
              label="Date of Joining"
              type="date"
              value={form.date_of_joining}
              onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
            />
            <Input
              label="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Sales, Service, Operations"
            />
            <Input
              label="Designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              placeholder="Executive, Officer, Technician"
            />
            <Input
              label="Reporting Manager"
              value={form.reporting_manager}
              onChange={(e) => setForm({ ...form, reporting_manager: e.target.value })}
              placeholder="e.g. Pooja Hegde"
            />
            <Input
              label="Basic Monthly Salary (₹)"
              type="number"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
              placeholder="25000"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={creating}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Employee Confirmation Modal (Super Admin Only) */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete Employee Record"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-red-900">This action is permanent and restricted to Super Admin.</p>
              <p>
                Deleting will remove employee <span className="font-bold">{deleteTarget?.first_name} {deleteTarget?.last_name}</span> ({deleteTarget?.employee_code || 'No Code'}), including linked documents and payroll records.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={handleDeleteEmployee}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Deleting...' : 'Confirm Delete Employee'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}