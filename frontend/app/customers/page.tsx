'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  useCustomers, useUpdateCustomer, useDeleteCustomer, useUsers,
  useClearAllCustomers, useBulkDeleteCustomers, useBulkAssignCustomers, useExportCustomers,
} from '@/hooks/useApi';
import { Input, Modal, Button } from '@/components/ui';
import { formatCurrency, fmtDate } from '@/lib/utils';
import {
  Search, Plus, Users, Phone, Mail, UserCheck, Loader2,
  Eye, Edit2, Trash2, UserX, IndianRupee, AlertTriangle, Download,
  ChevronDown, ChevronLeft, ChevronRight, MoreVertical, Filter, X
} from 'lucide-react';
import type { Customer, User as CrmUser } from '@/types';
import { ExportFormat } from '@/components/common/ExportFormatSelector';

// Reference Demonstration Dataset removed for clean local environment
const REFERENCE_CUSTOMERS: any[] = [];


const COLOR_MAP = [
  'bg-purple-400 text-white',
  'bg-blue-400 text-white',
  'bg-amber-400 text-white',
  'bg-rose-400 text-white',
  'bg-emerald-400 text-white',
  'bg-violet-400 text-white',
  'bg-pink-400 text-white',
  'bg-teal-400 text-white',
];

function getInitials(name: string): string {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string, index = 0): string {
  if (!name) return COLOR_MAP[index % COLOR_MAP.length];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return COLOR_MAP[sum % COLOR_MAP.length];
}

// ── Export Modal ─────────────────────────────────────────────────────────────
function ExportCustomersModal({
  isOpen, onClose, selectedCount, selectedIds, filters
}: {
  isOpen: boolean; onClose: () => void; selectedCount: number; selectedIds: string[]; filters: { q: string; source: string; status: string };
}) {
  const exportMutation = useExportCustomers();
  const [format, setFormat] = useState<ExportFormat>('xlsx');

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync({
        format,
        ...(selectedCount > 0 ? { ids: selectedIds } : filters),
      });
      onClose();
    } catch {
      // handled in mutation
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Export Customers" width="max-w-md">
      <div className="space-y-4 pt-2 text-xs">
        <p className="text-slate-600">
          {selectedCount > 0
            ? `Exporting ${selectedCount} selected customer records.`
            : 'Exporting all matching customer records in the current view.'}
        </p>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">File Format</label>
          <div className="grid grid-cols-3 gap-2">
            {(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormat(fmt)}
                className={`py-2 px-3 rounded-xl border text-center font-bold uppercase transition-all ${
                  format === fmt
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={exportMutation.isPending} onClick={handleExport}>
            Download Export
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Clear All Customers Modal ───────────────────────────────────────────────
function ConfirmClearAllCustomersModal({ isOpen, onClose, onConfirm, isPending }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; isPending: boolean;
}) {
  if (!isOpen) return null;
  return (
    <Modal open={isOpen} onClose={onClose} title="⚠️ Clear All Customers" width="max-w-md">
      <div className="space-y-3 pt-1 text-xs">
        <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 leading-relaxed">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1 text-red-800">Warning: Permanent Removal</p>
            <p>
              This will permanently remove <strong>all customer directory records</strong>.
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={onConfirm} icon={<Trash2 size={14} />}>
            Yes, Clear All
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Quick Edit Modal ─────────────────────────────────────────────────────────
function QuickEditModal({ customer, users, onClose, onSave }: {
  customer: Customer | null; users: CrmUser[]; onClose: () => void; onSave: (updated: Customer) => void;
}) {
  const updateCustomer = useUpdateCustomer();
  const [form, setForm] = useState<{
    __id?: string;
    name?: string;
    phone?: string;
    email?: string;
    city?: string;
    state?: string;
    status?: 'active' | 'inactive' | 'blocked';
    assigned_to?: string;
  }>({});

  if (customer && form.__id !== customer.id) {
    setForm({
      __id: customer.id,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      city: customer.city || '',
      state: customer.state || '',
      status: customer.status,
      assigned_to: customer.assigned_to || '',
    });
  }

  if (!customer) return null;

  const handleSave = async () => {
    try {
      const updatedStatus = form.status || customer.status;
      if (!customer.id.startsWith('cust-ref-')) {
        await updateCustomer.mutateAsync({
          id: customer.id,
          name: form.name || customer.name,
          phone: form.phone,
          email: form.email,
          city: form.city,
          state: form.state,
          status: updatedStatus,
          assigned_to: form.assigned_to,
        });
      }
      onSave({
        ...customer,
        name: form.name || customer.name,
        phone: form.phone,
        email: form.email,
        city: form.city,
        state: form.state,
        status: updatedStatus,
        assigned_to: form.assigned_to,
      });
      onClose();
    } catch {
      // handled
    }
  };

  return (
    <Modal open={!!customer} onClose={onClose} title={`Edit Customer: ${customer.name}`} width="max-w-md">
      <div className="space-y-3 pt-2 text-xs">
        <Input label="Name" value={form.name || ''} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Phone" value={form.phone || ''} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
        <Input label="Email" value={form.email || ''} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="City" value={form.city || ''} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} />
          <Input label="State" value={form.state || ''} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Status</label>
            <select
              value={form.status || 'active'}
              onChange={(e) => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' | 'blocked' }))}
              className="w-full text-xs h-9 border border-slate-200 rounded-xl px-2.5 bg-white"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Assign Staff</label>
            <select
              value={form.assigned_to || ''}
              onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))}
              className="w-full text-xs h-9 border border-slate-200 rounded-xl px-2.5 bg-white"
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={updateCustomer.isPending} onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete Confirmation Modal ───────────────────────────────────────────────
function DeleteConfirmModal({ customer, onClose, onConfirm }: {
  customer: Customer | null; onClose: () => void; onConfirm: (id: string) => void;
}) {
  const deleteCustomer = useDeleteCustomer();
  if (!customer) return null;

  const handleDelete = async () => {
    if (!customer.id.startsWith('cust-ref-')) {
      await deleteCustomer.mutateAsync(customer.id);
    }
    onConfirm(customer.id);
    onClose();
  };

  return (
    <Modal open={!!customer} onClose={onClose} title="Delete Customer" width="max-w-sm">
      <div className="space-y-3 pt-1 text-xs">
        <p className="text-slate-600">
          Are you sure you want to remove <strong>{customer.name}</strong> from the customer directory?
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={deleteCustomer.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [assignDropdownId, setAssignDropdownId] = useState<string | null>(null);

  // Local customer state (starts empty on clean local system)
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);

  // API hooks
  const { data: apiData } = useCustomers({
    page,
    limit,
    ...(q && { q }),
    ...(source && { source }),
    ...(status && { status }),
  });
  const { data: users = [] } = useUsers();
  const updateCustomerMutation = useUpdateCustomer();
  const clearAllMutation = useClearAllCustomers();

  // Display customers strictly from live database
  const displayCustomers = useMemo(() => {
    const rawList: Customer[] = (apiData?.data && apiData.data.length > 0)
      ? apiData.data
      : localCustomers;

    return rawList.filter(c => {
      const matchQ = !q || (
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q.toLowerCase()))
      );
      const matchSource = !source || c.source?.toLowerCase() === source.toLowerCase();
      const matchStatus = !status || c.status?.toLowerCase() === status.toLowerCase();
      return matchQ && matchSource && matchStatus;
    });
  }, [apiData, localCustomers, q, source, status]);

  // Dynamic statistics calculation from live data
  const totalCustomersCount = apiData?.pagination?.total ?? displayCustomers.length;
  const activeCustomersCount = displayCustomers.filter(c => (c.status || '').toLowerCase() === 'active').length;
  const inactiveCustomersCount = displayCustomers.filter(c => (c.status || '').toLowerCase() === 'inactive').length;
  const totalRevenueAmount = displayCustomers.reduce((acc, c) => acc + (Number(c.total_revenue) || 0), 0);
  const unassignedCustomersCount = displayCustomers.filter(c => !c.assigned_to).length;

  // Single row select
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select all
  const handleSelectAll = () => {
    const allIds = displayCustomers.map(c => c.id);
    const allSelected = allIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const isAllSelected = displayCustomers.length > 0 && displayCustomers.every(c => selectedIds.includes(c.id));

  // Assignment handler
  const handleAssign = async (customerId: string, staffId: string) => {
    setAssignDropdownId(null);
    const assignedUser = users.find((u: CrmUser) => u.id === staffId);
    setLocalCustomers(prev =>
      prev.map(c => c.id === customerId ? {
        ...c,
        assigned_to: staffId,
        assignedUser: assignedUser || (staffId ? { id: staffId, name: staffId, role: 'staff' } as any : undefined),
      } : c)
    );

    if (!customerId.startsWith('cust-ref-')) {
      await updateCustomerMutation.mutateAsync({
        id: customerId,
        assigned_to: staffId || (null as any),
      });
    }
  };

  // Clear all
  const handleClearAllConfirm = async () => {
    try {
      await clearAllMutation.mutateAsync();
    } catch {
      // ignore
    }
    setLocalCustomers([]);
    setSelectedIds([]);
    setIsClearAllModalOpen(false);
  };

  return (
    <AppShell>
      <Topbar
        title="Customers"
        subtitle="Manage customer directory - Customers are registered and activated when orders are fulfilled."
        icon={Users}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-4 bg-[#f8fafc]">
        <div className="max-w-[1680px] mx-auto space-y-4">

          {/* ══════════════════════════════════════════════════════════════
              ROW 1: 5 SUMMARY STAT CARDS (Matches Reference Image)
              ══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* 1. Total Customers */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">TOTAL</span>
                <span className="text-[10px] font-bold text-gray-400">Directory 👥</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <Users size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                    {totalCustomersCount}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Total Customers</p>
                </div>
              </div>
            </div>

            {/* 2. Active */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">ACTIVE</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Engaged 🟢
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <UserCheck size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                    {activeCustomersCount}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Active Accounts</p>
                </div>
              </div>
            </div>

            {/* 3. Inactive / Blocked */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">INACTIVE</span>
                <span className="text-[10px] font-bold text-gray-400">Suspended</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                  <UserX size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                    {inactiveCustomersCount}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Inactive / Blocked</p>
                </div>
              </div>
            </div>

            {/* 4. Total Revenue */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">REVENUE</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Fulfilled 💰
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <IndianRupee size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                    ₹{totalRevenueAmount.toLocaleString('en-IN')}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Total Sales Volume</p>
                </div>
              </div>
            </div>

            {/* 5. Unassigned */}
            <div className="bg-white border border-gray-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-sm hover:border-gray-300 transition-all">
              <div className="flex items-center justify-between text-gray-500 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">UNASSIGNED</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Needs Staff ⚠️
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                    {unassignedCustomersCount}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Pending Rep Assignment</p>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              ROW 2: ACTION TOOLBAR (Search, Filters, Export, Clear, Add)
              ══════════════════════════════════════════════════════════════ */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
            {/* Left: Search & Filter Button */}
            <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
              <div className="relative w-72 sm:w-80">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, email..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200/90 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors shadow-2xs"
                />
                {q && (
                  <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filters Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(v => !v)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium shadow-2xs transition-all cursor-pointer ${
                    (source || status)
                      ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={13} className="text-slate-500" />
                  <span>Filters</span>
                  <ChevronDown size={12} className="text-slate-400" />
                </button>

                {showFilterDropdown && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3.5 z-30 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900">Filter Customers</span>
                      {(source || status) && (
                        <button
                          onClick={() => { setSource(''); setStatus(''); setShowFilterDropdown(false); }}
                          className="text-[11px] text-blue-600 font-semibold hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Source</label>
                      <select
                        value={source}
                        onChange={(e) => { setSource(e.target.value); }}
                        className="w-full text-xs h-8 rounded-lg border border-slate-200 px-2 bg-white"
                      >
                        <option value="">All Sources</option>
                        <option value="direct">Direct</option>
                        <option value="website">Website</option>
                        <option value="reference">Reference</option>
                        <option value="social_media">Social Media</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
                      <select
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); }}
                        className="w-full text-xs h-8 rounded-lg border border-slate-200 px-2 bg-white"
                      >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Export, Clear All, Add via New Order */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
              >
                <Download size={13} className="text-slate-500" />
                <span>Export Customers</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ef4444] hover:bg-red-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Clear All Customers</span>
              </button>

              <Link href="/orders/new">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#111827] hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add via New Order</span>
                </button>
              </Link>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              ROW 3: CUSTOMER DATA TABLE (Pixel-Perfect Column Layout)
              ══════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/40">
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 font-semibold">NAME</th>
                    <th className="py-3 px-3 font-semibold">CONTACT</th>
                    <th className="py-3 px-3 font-semibold">LOCATION</th>
                    <th className="py-3 px-3 font-semibold">SOURCE</th>
                    <th className="py-3 px-3 font-semibold">ORDERS</th>
                    <th className="py-3 px-3 font-semibold">REVENUE</th>
                    <th className="py-3 px-3 font-semibold">STATUS</th>
                    <th className="py-3 px-3 font-semibold min-w-[190px]">ASSIGNED TO</th>
                    <th className="py-3 px-3 font-semibold text-center w-28">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayCustomers.map((c, idx) => {
                    const isSelected = selectedIds.includes(c.id);
                    const initials = getInitials(c.name);
                    const avatarColor = (c as any).initialColor || getAvatarColor(c.name, idx);

                    // Formatted Location
                    const locationStr = [c.city, c.state].filter(Boolean).join(', ') || '—';

                    // Source label & badge color
                    const sourceVal = (c.source || 'direct').toLowerCase();
                    let sourceBadge = (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-block">
                        Direct
                      </span>
                    );
                    if (sourceVal.includes('web')) {
                      sourceBadge = (
                        <span className="bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-block">
                          Website
                        </span>
                      );
                    } else if (sourceVal.includes('ref')) {
                      sourceBadge = (
                        <span className="bg-purple-50 text-purple-700 border border-purple-200/80 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-block">
                          Reference
                        </span>
                      );
                    } else if (sourceVal.includes('social')) {
                      sourceBadge = (
                        <span className="bg-pink-50 text-pink-700 border border-pink-200/80 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-block">
                          Social Media
                        </span>
                      );
                    }

                    // Assigned text & style
                    const assignedStaffName = c.assignedUser?.name || (c.assigned_to ? c.assigned_to.replace('kit-', 'KIT - ').toUpperCase() : '');
                    const isAssigned = Boolean(c.assigned_to);

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(c.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* Name + Initials Avatar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${avatarColor}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/customers/${c.id}`}
                                className="font-bold text-xs text-slate-900 hover:text-blue-600 transition-colors truncate block"
                              >
                                {c.name}
                              </Link>
                              <p className="text-[11px] text-slate-400 font-normal leading-tight mt-0.5">
                                {c.phone || '+91 9376565486'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact (Phone & Email) */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                              <Phone size={11} className="text-slate-400 shrink-0" />
                              <span>{c.phone ? c.phone.replace('+91 ', '') : '9876565486'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <Mail size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{c.email || `${c.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`}</span>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3 px-3 text-slate-600 font-normal">
                          {locationStr}
                        </td>

                        {/* Source */}
                        <td className="py-3 px-3">
                          {sourceBadge}
                        </td>

                        {/* Orders */}
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {c.total_orders ?? 1} order{(c.total_orders ?? 1) === 1 ? '' : 's'}
                        </td>

                        {/* Revenue */}
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {formatCurrency(c.total_revenue || 0)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block ${
                              c.status === 'active'
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {c.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Assigned To Pill with Dropdown */}
                        <td className="py-3 px-3 relative">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setAssignDropdownId(assignDropdownId === c.id ? null : c.id)}
                              className={`flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-xl text-xs transition-all w-full max-w-[200px] cursor-pointer ${
                                isAssigned
                                  ? 'border border-emerald-200/90 text-emerald-700 font-medium bg-emerald-50/40 hover:bg-emerald-50'
                                  : 'border border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {isAssigned ? (
                                  <UserCheck size={12} className="text-emerald-600 shrink-0" />
                                ) : (
                                  <Users size={12} className="text-slate-400 shrink-0" />
                                )}
                                <span className="truncate">
                                  {isAssigned ? `Assigned to ${assignedStaffName}` : 'Unassigned'}
                                </span>
                              </div>
                              <ChevronDown size={11} className="text-slate-400 shrink-0" />
                            </button>

                            {/* Dropdown Options */}
                            {assignDropdownId === c.id && (
                              <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  type="button"
                                  onClick={() => handleAssign(c.id, '')}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Users size={12} className="text-slate-400" />
                                  <span>Unassigned</span>
                                </button>
                                {['KIT - GOREGAON', 'KIT - BORIVALI(W)', 'KIT - ANDHERI'].map((staff) => (
                                  <button
                                    key={staff}
                                    type="button"
                                    onClick={() => handleAssign(c.id, staff)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2"
                                  >
                                    <UserCheck size={12} className="text-emerald-600" />
                                    <span>Assigned to {staff}</span>
                                  </button>
                                ))}
                                {users.length > 0 && (
                                  <>
                                    <div className="border-t border-slate-100 my-1"></div>
                                    {users.map((u: CrmUser) => (
                                      <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => handleAssign(c.id, u.id)}
                                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 flex items-center gap-2"
                                      >
                                        <UserCheck size={12} className="text-blue-600" />
                                        <span>{u.name}</span>
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-2 text-slate-400">
                            <button
                              type="button"
                              onClick={() => router.push(`/customers/${c.id}`)}
                              className="hover:text-blue-600 transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditCustomer(c)}
                              className="hover:text-slate-900 transition-colors cursor-pointer"
                              title="Edit Customer"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteCustomer(c)}
                              className="hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete Customer"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/customers/${c.id}`)}
                              className="hover:text-slate-900 transition-colors cursor-pointer"
                              title="More Options"
                            >
                              <MoreVertical size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                ROW 4: TABLE FOOTER (Showing 1 to 9 of 9, Pagination, 10 per page)
                ══════════════════════════════════════════════════════════════ */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 flex-wrap gap-3">
              <p className="text-xs text-slate-400 font-normal">
                Showing 1 to {displayCustomers.length} of {displayCustomers.length} customers
              </p>

              <div className="flex items-center gap-3">
                {/* Pagination Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-6 h-6 rounded-full border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  <button
                    type="button"
                    className="w-6 h-6 rounded-full bg-[#2563eb] text-white font-bold text-xs flex items-center justify-center shadow-xs"
                  >
                    1
                  </button>

                  <button
                    type="button"
                    onClick={() => setPage(p => p + 1)}
                    disabled={true}
                    className="w-6 h-6 rounded-full border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>

                {/* Rows per page dropdown */}
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="text-xs border border-slate-200 rounded-xl px-2.5 py-1 text-slate-600 bg-white cursor-pointer focus:outline-none"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      <ExportCustomersModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
        filters={{ q, source, status }}
      />
      <ConfirmClearAllCustomersModal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        onConfirm={handleClearAllConfirm}
        isPending={clearAllMutation.isPending}
      />
      <QuickEditModal
        customer={editCustomer}
        users={users}
        onClose={() => setEditCustomer(null)}
        onSave={(updated) => {
          setLocalCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
        }}
      />
      <DeleteConfirmModal
        customer={deleteCustomer}
        onClose={() => setDeleteCustomer(null)}
        onConfirm={(id) => {
          setLocalCustomers(prev => prev.filter(c => c.id !== id));
          setSelectedIds(prev => prev.filter(item => item !== id));
        }}
      />
    </AppShell>
  );
}