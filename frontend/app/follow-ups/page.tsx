'use client';
import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  useFollowUps, useCreateFollowUp, useUpdateFollowUp,
  useDeleteFollowUp, useCustomers, useUsers,
} from '@/hooks/useApi';
import {
  Badge, Button, EmptyState, Pagination, Select,
  PageLoader, Modal, Textarea, Input, ConfirmDialog,
} from '@/components/ui';
import {
  fmtDateTime, timeAgo, FOLLOWUP_STATUS_COLOURS, PRIORITY_COLOURS,
  FOLLOWUP_TYPES, PRIORITIES,
} from '@/lib/utils';
import {
  Phone, Mail, MessageCircle, MapPin, Clock, CheckCircle2,
  AlertCircle, Plus, Pencil, Trash2, RotateCcw, Search,
  User as UserIcon, Calendar, Filter,
} from 'lucide-react';
import type { FollowUp, FollowUpType, Priority, Customer } from '@/types';
import { useAuthStore } from '@/lib/auth';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call:      <Phone      size={13} />,
  whatsapp:  <MessageCircle size={13} />,
  email:     <Mail       size={13} />,
  visit:     <MapPin     size={13} />,
  other:     <Clock      size={13} />,
};

const TYPE_BG: Record<string, string> = {
  call:     'bg-blue-50 text-blue-600',
  whatsapp: 'bg-teal-50 text-teal-600',
  email:    'bg-purple-50 text-purple-600',
  visit:    'bg-amber-50 text-amber-600',
  other:    'bg-gray-50 text-gray-500',
};

const emptyForm = {
  customer_id: '',
  subject: '',
  type: 'call' as FollowUpType,
  priority: 'medium' as Priority,
  notes: '',
  due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  assigned_to: '',
  order_id: '',
};

export default function FollowUpsPage() {
  const { user } = useAuthStore();

  // ── Filters ────────────────────────────────────────────────────────────────
  const [page, setPage]         = useState(1);
  const [status, setStatus]     = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType]         = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [filter, setFilter]     = useState<'all' | 'today' | 'overdue'>('all');

  // ── API ────────────────────────────────────────────────────────────────────
  const params: Record<string, unknown> = { page, limit: 20, sort: 'due_at:asc' };
  if (status)     params.status      = status;
  if (priority)   params.priority    = priority;
  if (type)       params.type        = type;
  if (assignedTo) params.assigned_to = assignedTo;
  if (filter === 'today')   params.today   = 'true';
  if (filter === 'overdue') params.overdue = 'true';

  const { data, isLoading }    = useFollowUps(params);
  const { data: users = [] }   = useUsers();
  const createFollowUp         = useCreateFollowUp();
  const updateFollowUp         = useUpdateFollowUp();
  const deleteFollowUp         = useDeleteFollowUp();

  const followUps: FollowUp[]  = data?.data || [];
  const pagination             = data?.pagination;

  // Customer search for create modal
  const [customerSearch, setCustomerSearch] = useState('');
  const { data: customerData }  = useCustomers({
    q: customerSearch, limit: 6,
  });
  const customerResults: Customer[] = customerSearch.length >= 2
    ? (customerData?.data || []) : [];
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [createModal,  setCreateModal]  = useState(false);
  const [outcomeModal, setOutcomeModal] = useState<FollowUp | null>(null);
  const [editModal,    setEditModal]    = useState<FollowUp | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FollowUp | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [outcome, setOutcome]     = useState('');
  const [nextDate, setNextDate]   = useState('');
  const [completing, setCompleting] = useState(true);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setForm({ ...emptyForm, assigned_to: user?.id || '' });
    setCreateModal(true);
  };

  const handleCreate = async () => {
    if (!selectedCustomer && !form.customer_id) return;
    await createFollowUp.mutateAsync({
      ...form,
      customer_id: selectedCustomer?.id || form.customer_id,
    });
    setCreateModal(false);
    setSelectedCustomer(null);
    setCustomerSearch('');
  };

  const openOutcome = (f: FollowUp, complete: boolean) => {
    setOutcomeModal(f);
    setOutcome('');
    setNextDate('');
    setCompleting(complete);
  };

  const handleOutcomeSave = async () => {
    if (!outcomeModal) return;
    await updateFollowUp.mutateAsync({
      id: outcomeModal.id,
      status:   completing ? 'completed' : 'rescheduled',
      outcome,
      ...(nextDate && { next_followup_at: nextDate }),
    });
    setOutcomeModal(null);
  };

  const openEdit = (f: FollowUp) => {
    setEditModal(f);
    setForm({
      customer_id: f.customer_id,
      subject:     f.subject,
      type:        f.type,
      priority:    f.priority,
      notes:       f.notes || '',
      due_at:      f.due_at.slice(0, 16),
      assigned_to: f.assigned_to,
      order_id:    f.order_id || '',
    });
  };

  const handleEdit = async () => {
    if (!editModal) return;
    await updateFollowUp.mutateAsync({ id: editModal.id, ...form });
    setEditModal(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteFollowUp.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  // Stats
  const pendingCount  = followUps.filter(f => f.status === 'pending').length;
  const overdueCount  = followUps.filter(f =>
    ['pending','in_progress'].includes(f.status) && new Date(f.due_at) < new Date()
  ).length;

  const isOverdue = (f: FollowUp) =>
    ['pending','in_progress'].includes(f.status) && new Date(f.due_at) < new Date();

  const canDelete = user && ['admin','manager'].includes(user.role);

  return (
    <AppShell>
      <Topbar title="Follow-Ups" subtitle="Sales follow-up tracking and reminders" />
      <main className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',    value: pagination?.total || 0,  colour: 'text-navy' },
            { label: 'Pending',  value: pendingCount,             colour: 'text-amber-600' },
            { label: 'Overdue',  value: overdueCount,             colour: overdueCount > 0 ? 'text-danger' : 'text-navy' },
            { label: 'Today',    value: followUps.filter(f =>
              new Date(f.due_at).toDateString() === new Date().toDateString()
            ).length, colour: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="card text-center py-3">
              <p className={`text-xl font-semibold ${s.colour}`}>{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick filter tabs */}
          <div className="flex gap-1 bg-surface rounded-md p-1 border border-border">
            {(['all', 'today', 'overdue'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize
                  ${filter === f ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'}`}
              >
                {f === 'overdue' && overdueCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-danger text-white rounded-full text-[9px] mr-1">
                    {overdueCount}
                  </span>
                )}
                {f}
              </button>
            ))}
          </div>

          <Select
            value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'pending',     label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed',   label: 'Completed' },
              { value: 'rescheduled', label: 'Rescheduled' },
              { value: 'cancelled',   label: 'Cancelled' },
            ]}
            className="w-40"
          />
          <Select
            value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All Types' },
              ...FOLLOWUP_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
            ]}
            className="w-36"
          />
          <Select
            value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All Priorities' },
              { value: 'urgent', label: '🔴 Urgent' },
              { value: 'high',   label: '🟠 High' },
              { value: 'medium', label: '🟡 Medium' },
              { value: 'low',    label: '🟢 Low' },
            ]}
            className="w-40"
          />
          {/* Assigned To filter — managers see all */}
          {user && ['admin', 'manager', 'ceo'].includes(user.role) && (
            <Select
              value={assignedTo} onChange={(e) => { setAssignedTo(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'All Team Members' },
                ...users.map(u => ({ value: u.id, label: u.name })),
              ]}
              className="w-44"
            />
          )}

          <div className="flex-1" />
          <Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>
            New Follow-Up
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <PageLoader />
        ) : followUps.length === 0 ? (
          <EmptyState
            icon={<Clock size={36} />}
            title="No follow-ups found"
            description="Create a follow-up or change your filters."
            action={<Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>New Follow-Up</Button>}
          />
        ) : (
          <div className="space-y-2.5">
            {followUps.map((f) => {
              const overdue = isOverdue(f);
              const done    = ['completed','cancelled'].includes(f.status);
              return (
                <div
                  key={f.id}
                  className={`card flex items-start gap-3 transition-all
                    ${overdue ? 'border-red-200 bg-red-50/30' : ''}
                    ${done    ? 'opacity-60' : ''}`}
                >
                  {/* Type icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${TYPE_BG[f.type]}`}>
                    {TYPE_ICONS[f.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy">{f.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {f.customer && (
                            <Link href={`/customers/${f.customer.id}`} className="text-xs text-amber-600 hover:underline font-medium">
                              {f.customer.name}
                            </Link>
                          )}
                          {f.customer?.phone && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Phone size={10} /> {f.customer.phone}
                            </span>
                          )}
                          {f.order && (
                            <Link href={`/orders/${f.order.id}`} className="text-xs text-muted hover:underline">
                              · {f.order.order_number}
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge label={f.priority} colorClass={PRIORITY_COLOURS[f.priority]} />
                        <Badge label={f.status.replace('_',' ')} colorClass={FOLLOWUP_STATUS_COLOURS[f.status]} />
                      </div>
                    </div>

                    {f.notes && (
                      <p className="text-xs text-muted mt-1.5 line-clamp-2">{f.notes}</p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted flex-wrap">
                      <span className={`flex items-center gap-1 ${overdue ? 'text-danger font-medium' : ''}`}>
                        {overdue && <AlertCircle size={11} />}
                        <Calendar size={11} />
                        {fmtDateTime(f.due_at)} · {timeAgo(f.due_at)}
                      </span>
                      {f.assignedUser && (
                        <span className="flex items-center gap-1">
                          <UserIcon size={11} />
                          {f.assignedUser.name}
                        </span>
                      )}
                      {f.outcome && (
                        <span className="flex items-center gap-1 text-teal-600">
                          <CheckCircle2 size={11} />
                          {f.outcome}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    {!done && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm" variant="primary"
                          icon={<CheckCircle2 size={12} />}
                          onClick={() => openOutcome(f, true)}
                        >
                          Mark Done
                        </Button>
                        <Button
                          size="sm" variant="secondary"
                          icon={<RotateCcw size={12} />}
                          onClick={() => openOutcome(f, false)}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          icon={<Pencil size={12} />}
                          onClick={() => openEdit(f)}
                        >
                          Edit
                        </Button>
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(f)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 transition-colors ml-auto"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-1 pt-2">
                <p className="text-xs text-muted">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <Pagination page={pagination.page} totalPages={pagination.totalPages} onPage={setPage} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── CREATE MODAL ──────────────────────────────────────────────────── */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Follow-Up" width="max-w-lg">
        <div className="space-y-3">
          {/* Customer search */}
          <div>
            <label className="form-label">Customer *</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-navy">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted">{selectedCustomer.phone}</p>
                </div>
                <button
                  onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                  className="text-xs text-muted hover:text-danger"
                >
                  ✕ Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="form-input pl-8"
                  placeholder="Search customer name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customerResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-border rounded-md shadow-card-hover mt-1 max-h-48 overflow-y-auto">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                        className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-surface text-left transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-navy">{c.name}</p>
                          <p className="text-xs text-muted">{c.phone} · {c.city}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {customerSearch.length >= 2 && customerResults.length === 0 && (
                  <p className="text-xs text-muted mt-1.5">No customers found.</p>
                )}
              </div>
            )}
          </div>

          <Input
            label="Subject *"
            value={form.subject}
            onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="e.g. Follow up on order confirmation"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value as FollowUpType }))}
              options={FOLLOWUP_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
              options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Due Date & Time *"
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm(f => ({ ...f, due_at: e.target.value }))}
            />
            <Select
              label="Assign To"
              value={form.assigned_to}
              onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))}
              options={[
                { value: user?.id || '', label: 'Me' },
                ...users.filter(u => u.id !== user?.id).map(u => ({ value: u.id, label: `${u.name} (${u.role})` })),
              ]}
            />
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Context or instructions for this follow-up..."
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createFollowUp.isPending}
              disabled={!selectedCustomer || !form.subject || !form.due_at}
              onClick={handleCreate}
            >
              Create Follow-Up
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── OUTCOME / RESCHEDULE MODAL ────────────────────────────────────── */}
      <Modal
        open={!!outcomeModal}
        onClose={() => setOutcomeModal(null)}
        title={completing ? '✅ Complete Follow-Up' : '🔄 Reschedule Follow-Up'}
        width="max-w-md"
      >
        <div className="space-y-3">
          {outcomeModal && (
            <div className="text-xs text-muted bg-surface rounded-md px-3 py-2">
              <span className="font-medium text-navy">{outcomeModal.subject}</span>
              {outcomeModal.customer && <span> · {outcomeModal.customer.name}</span>}
            </div>
          )}
          <Textarea
            label={completing ? 'Outcome *' : 'Reason for rescheduling *'}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            placeholder={completing ? 'What happened? What did the customer say?' : 'Why is this being rescheduled?'}
            rows={3}
          />
          {!completing && (
            <Input
              label="New Follow-Up Date & Time *"
              type="datetime-local"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOutcomeModal(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={updateFollowUp.isPending}
              disabled={!outcome.trim() || (!completing && !nextDate)}
              onClick={handleOutcomeSave}
            >
              {completing ? 'Mark Complete' : 'Reschedule'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── EDIT MODAL ────────────────────────────────────────────────────── */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Edit Follow-Up" width="max-w-lg">
        <div className="space-y-3">
          <Input
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value as FollowUpType }))}
              options={FOLLOWUP_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
              options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Due Date & Time"
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm(f => ({ ...f, due_at: e.target.value }))}
            />
            <Select
              label="Assign To"
              value={form.assigned_to}
              onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))}
              options={users.map(u => ({ value: u.id, label: `${u.name} (${u.role})` }))}
            />
          </div>
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button variant="primary" loading={updateFollowUp.isPending} onClick={handleEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Follow-Up"
        message={`Delete "${deleteTarget?.subject}"? This cannot be undone.`}
        loading={deleteFollowUp.isPending}
      />
    </AppShell>
  );
}
