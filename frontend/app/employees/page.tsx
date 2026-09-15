'use strict';
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Badge, Button, Input, Select, Modal, PageLoader, EmptyState,
} from '@/components/ui';
import { Search, Plus, Users, ChevronRight, FileText, UserMinus, Building2, ShieldCheck, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import type { Employee, EmploymentType } from '@/types';

const STATUS_PILLS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-700 border-gray-200',
  terminated: 'bg-red-50 text-red-700 border-red-200',
};

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

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const pendingOnboarding = employees.filter((e) => e.onboarding_status !== 'completed').length;

  return (
    <AppShell>
      <Topbar
        title="Employee Directory & HR"
        subtitle="Single source of truth for active and offboarded team members"
      />

      <main className="flex-1 overflow-y-auto p-6 w-full">
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
          {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
            <span className="text-xs text-gray-500 font-semibold">Total Workforce</span>
            <p className="text-2xl font-bold text-gray-900 mt-1">{employees.length}</p>
          </div>
          <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
            <span className="text-xs text-gray-500 font-semibold">Active Staff</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
            <span className="text-xs text-gray-500 font-semibold">Onboarding In Progress</span>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingOnboarding}</p>
          </div>
          <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
            <span className="text-xs text-gray-500 font-semibold">Departments</span>
            <p className="text-2xl font-bold text-blue-600 mt-1">{departmentOptions.length || 1}</p>
          </div>
        </div>

        {/* Filters & Actions Bar */}
        <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, code, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="w-44">
              <Select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                size="sm"
                options={[
                  { value: 'all', label: 'All Departments' },
                  ...departmentOptions.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>

            <div className="w-36">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                size="sm"
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'terminated', label: 'Terminated (Exit)' },
                ]}
              />
            </div>

            {roleOptions.length > 0 && (
              <div className="w-48">
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  size="sm"
                  options={[
                    { value: 'all', label: 'All Roles' },
                    ...roleOptions.map((r) => ({
                      value: r,
                      label: `Role: ${r.replace(/_/g, ' ').toUpperCase()}`,
                    })),
                  ]}
                />
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={fetchEmployees}
              className="text-xs"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>

            <Link href="/hr/document-center">
              <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs text-purple-700">
                <FileText className="w-3.5 h-3.5" /> Document Center
              </Button>
            </Link>

            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateModal(true)}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Employee
              </Button>
            )}
          </div>
        </div>

        {/* Directory Table */}
        {loading ? (
          <div className="p-16 flex justify-center">
            <PageLoader />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            title="No Employees Found"
            description="Try adjusting your filter or search query."
          />
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-3.5">Employee Name</th>
                    <th className="p-3.5">Employee Code</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Department & Title</th>
                    <th className="p-3.5">Reporting Manager</th>
                    <th className="p-3.5">Joining Date</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                            {(emp.first_name?.[0] || 'E')}{(emp.last_name?.[0] || '')}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">
                              {emp.first_name} {emp.last_name}
                            </p>
                            <p className="text-[11px] text-gray-400">{emp.email || emp.phone || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-gray-600 text-[11px]">{emp.employee_code || '—'}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] uppercase font-bold tracking-wide">
                          {emp.linkedUser?.role || 'employee'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-gray-900">{emp.designation || 'Staff'}</div>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {emp.department || 'General'}
                        </span>
                      </td>
                      <td className="p-3.5 text-gray-600">{emp.reporting_manager || 'None'}</td>
                      <td className="p-3.5 text-gray-500">
                        {emp.date_of_joining ? fmtDate(emp.date_of_joining) : '—'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            STATUS_PILLS[emp.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/employees/${emp.id}`}>
                            <Button variant="secondary" size="sm" className="text-xs">
                              View Profile <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                          {isSuperAdmin && (
                            <Button
                              variant="danger"
                              size="sm"
                              className="text-xs px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                              title="Delete Employee (Super Admin Only)"
                              onClick={() => setDeleteTarget(emp)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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