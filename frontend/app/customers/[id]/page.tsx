'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  useCustomer, useUpdateCustomer, useToggleWhatsappOptin,
  useCreateFollowUp, useAdvanceLifecycle, useCustomerCallLogs, useCreateCallLog,
  useUsers,
} from '@/hooks/useApi';
import { Badge, Button, PageLoader, Modal, Input, Select, Textarea } from '@/components/ui';
import {
  formatCurrency, fmtDate, fmtDateTime, ORDER_STATUS_COLOURS, MARKETPLACE_COLOURS,
  FOLLOWUP_STATUS_COLOURS, PRIORITY_COLOURS, FOLLOWUP_TYPES, PRIORITIES,
  LIFECYCLE_STAGES, LIFECYCLE_COLOURS, CALL_OUTCOMES, CALL_CONTEXTS, CALL_OUTCOME_COLOURS,
} from '@/lib/utils';
import {
  ArrowLeft, Phone, Mail, MapPin, MessageCircle, Edit2, Plus, ShoppingCart, Clock,
  CheckCircle2, PhoneCall, UserCheck, ShieldCheck,
} from 'lucide-react';
import type { CallOutcome, CallContext } from '@/types';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id);
  const updateCustomer   = useUpdateCustomer();
  const toggleOptin      = useToggleWhatsappOptin();
  const createFollowUp   = useCreateFollowUp();
  const advanceLifecycle = useAdvanceLifecycle();          // CR4
  const { data: callLogsData } = useCustomerCallLogs(id); // CR2
  const createCallLog    = useCreateCallLog();             // CR2
  const { data: users = [] } = useUsers();

  const [editModal, setEditModal]       = useState(false);
  const [followUpModal, setFollowUpModal] = useState(false);
  const [lifecycleModal, setLifecycleModal] = useState(false);  // CR4
  const [callModal, setCallModal]       = useState(false);      // CR2

  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [fuForm, setFuForm] = useState<{
    type: 'call' | 'whatsapp' | 'email' | 'visit' | 'other';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    subject: string; notes: string; due_at: string;
  }>({
    type: 'call', priority: 'medium', subject: '', notes: '',
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  });

  // CR4 — Lifecycle state
  const [nextStage, setNextStage]         = useState('');
  const [engagementNotes, setEngagementNotes] = useState('');

  // CR2 — Call log state
  const [callForm, setCallForm] = useState({
    call_type:        'outbound' as 'outbound' | 'inbound',
    outcome:          'answered' as CallOutcome,
    context:          'general' as CallContext,
    phone_used:       '',
    duration_seconds: '' as string | number,
    notes:            '',
    called_at:        new Date().toISOString().slice(0, 16),
  });

  if (isLoading || !customer) return <AppShell><PageLoader /></AppShell>;

  const openEdit = () => {
    setEditForm({
      name: customer.name, email: customer.email || '', phone: customer.phone || '',
      whatsapp_number: customer.whatsapp_number || '', city: customer.city || '',
      state: customer.state || '', pincode: customer.pincode || '',
      address_line1: customer.address_line1 || '', notes: customer.notes || '',
      status: customer.status,
      assigned_to: customer.assigned_to || '',
    });
    setEditModal(true);
  };

  const handleEditSave = async () => {
    await updateCustomer.mutateAsync({ id: customer.id, ...editForm });
    setEditModal(false);
  };

  const handleFollowUpCreate = async () => {
    await createFollowUp.mutateAsync({ customer_id: customer.id, ...fuForm });
    setFollowUpModal(false);
  };

  // CR4 — Lifecycle handlers
  const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
    prospect:             ['customer'],
    customer:             ['installation_pending'],
    installation_pending: ['installation_done', 'customer'],
    installation_done:    ['feedback_pending'],
    feedback_pending:     ['engaged', 'installation_pending'],
    engaged:              ['feedback_pending'],
  };
  const allowedStages = LIFECYCLE_TRANSITIONS[customer.lifecycle_stage] || [];

  const handleLifecycleAdvance = async () => {
    await advanceLifecycle.mutateAsync({ id: customer.id, stage: nextStage, engagement_notes: engagementNotes });
    setLifecycleModal(false);
    setEngagementNotes('');
  };

  // CR2 — Call log handlers
  const callLogs = callLogsData?.data || [];
  const handleLogCall = async () => {
    await createCallLog.mutateAsync({
      customer_id:      customer.id,
      ...callForm,
      duration_seconds: callForm.duration_seconds === '' ? undefined : Number(callForm.duration_seconds),
    });
    setCallModal(false);
    setCallForm({ call_type: 'outbound', outcome: 'answered', context: 'general', phone_used: '', duration_seconds: '', notes: '', called_at: new Date().toISOString().slice(0, 16) });
  };

  return (
    <AppShell>
      <Topbar title={customer.name} subtitle={`Customer since ${fmtDate(customer.created_at)}`} />
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted hover:text-navy transition-colors">
            <ArrowLeft size={14} /> Back to Customers
          </button>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Plus size={13} />} onClick={() => setFollowUpModal(true)}>Add Follow-Up</Button>
            <Button size="sm" variant="secondary" icon={<Edit2 size={13} />} onClick={openEdit}>Edit</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: profile */}
          <div className="space-y-5">
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber font-semibold text-lg">{customer.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-navy">{customer.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge label={customer.source} colorClass={MARKETPLACE_COLOURS[customer.source]} />
                    <Badge
                      label={customer.status}
                      colorClass={customer.status === 'active' ? 'bg-teal-50 text-teal-600' : customer.status === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}
                    />
                    <Badge
                      label={customer.lifecycle_stage.replace(/_/g, ' ')}
                      colorClass={LIFECYCLE_COLOURS[customer.lifecycle_stage] || 'bg-gray-100 text-gray-500'}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 text-xs text-muted">
                {customer.phone && <div className="flex items-center gap-2"><Phone size={12} /> {customer.phone}</div>}
                {customer.email && <div className="flex items-center gap-2"><Mail size={12} /> {customer.email}</div>}
                {(customer.address_line1 || customer.city) && (
                  <div className="flex items-start gap-2">
                    <MapPin size={12} className="mt-0.5" />
                    <span>{[customer.address_line1, customer.address_line2, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted flex items-center gap-1.5"><MessageCircle size={12} /> WhatsApp Opt-In</span>
                  <button
                    onClick={() => toggleOptin.mutate({ id: customer.id, value: !customer.whatsapp_opt_in })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${customer.whatsapp_opt_in ? 'bg-teal' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${customer.whatsapp_opt_in ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
                {customer.whatsapp_number && (
                  <p className="text-[11px] text-muted mt-1.5">{customer.whatsapp_number}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="card">
              <p className="card-title mb-3">Lifetime Stats</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-surface rounded-md">
                  <p className="text-xl font-semibold text-navy">{customer.total_orders}</p>
                  <p className="text-[11px] text-muted mt-0.5">Total Orders</p>
                </div>
                <div className="text-center p-3 bg-surface rounded-md">
                  <p className="text-xl font-semibold text-navy">{formatCurrency(customer.total_revenue)}</p>
                  <p className="text-[11px] text-muted mt-0.5">Total Revenue</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted flex items-center gap-1.5">
                  <UserCheck size={12} /> Assigned To
                </span>
                <span className="font-medium text-navy">
                  {customer.assignedUser?.name || <span className="text-muted italic">Unassigned</span>}
                </span>
              </div>
            </div>

            {customer.notes && (
              <div className="card">
                <p className="card-title mb-3">Notes</p>
                <p className="text-xs text-navy whitespace-pre-wrap">{customer.notes}</p>
              </div>
            )}
          </div>

          {/* Right: orders + follow-ups */}
          <div className="lg:col-span-2 space-y-5">
            {/* Recent orders */}
            <div className="card">
              <div className="card-header">
                <p className="card-title">Recent Orders</p>
                <Link href="/orders" className="text-xs text-amber-600 hover:underline">View all</Link>
              </div>
              {!customer.orders || customer.orders.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <ShoppingCart size={28} className="text-muted/40 mb-2" />
                  <p className="text-xs text-muted">No orders yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customer.orders.map((o: any) => (
                    <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between p-2.5 rounded-md hover:bg-surface transition-colors border border-border">
                      <div>
                        <p className="text-sm font-medium text-navy">{o.order_number}</p>
                        <p className="text-[11px] text-muted mt-0.5">{fmtDate(o.order_date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{o.total_amount ? formatCurrency(o.total_amount) : '—'}</span>
                        <Badge label={o.status} colorClass={ORDER_STATUS_COLOURS[o.status]} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pending follow-ups */}
            <div className="card">
              <div className="card-header">
                <p className="card-title">Pending Follow-Ups</p>
                <Link href="/follow-ups" className="text-xs text-amber-600 hover:underline">View all</Link>
              </div>
              {!customer.followUps || customer.followUps.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Clock size={28} className="text-muted/40 mb-2" />
                  <p className="text-xs text-muted">No pending follow-ups</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customer.followUps.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-md border border-border">
                      <div>
                        <p className="text-sm font-medium text-navy">{f.subject}</p>
                        <p className="text-[11px] text-muted mt-0.5">Due {fmtDateTime(f.due_at)} · {f.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge label={f.priority} colorClass={PRIORITY_COLOURS[f.priority]} />
                        <Badge label={f.status} colorClass={FOLLOWUP_STATUS_COLOURS[f.status]} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CR4 — Customer Journey (Lifecycle) ─────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <p className="card-title flex items-center gap-1.5"><CheckCircle2 size={14} className="text-teal" /> Customer Journey</p>
            {allowedStages.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => { setNextStage(allowedStages[0]); setLifecycleModal(true); }}>
                Advance Stage
              </Button>
            )}
          </div>
          <div className="flex items-center overflow-x-auto pb-2 gap-0">
            {LIFECYCLE_STAGES.map((stage, idx) => {
              const stageIdx   = LIFECYCLE_STAGES.indexOf(customer.lifecycle_stage);
              const thisIdx    = idx;
              const isActive   = stage === customer.lifecycle_stage;
              const isDone     = thisIdx < stageIdx;
              return (
                <div key={stage} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-1 min-w-[90px]">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2
                      ${isDone   ? 'bg-teal-500 border-teal-500 text-white'
                      : isActive ? 'bg-amber border-amber text-navy'
                      :            'bg-white border-border text-muted'}`}>
                      {isDone ? <CheckCircle2 size={13} /> : idx + 1}
                    </div>
                    <p className={`text-[10px] text-center capitalize leading-tight ${isActive ? 'text-navy font-medium' : 'text-muted'}`}>
                      {stage.replace(/_/g, ' ')}
                    </p>
                  </div>
                  {idx < LIFECYCLE_STAGES.length - 1 && (
                    <div className={`h-0.5 w-5 flex-shrink-0 ${thisIdx < stageIdx ? 'bg-teal-400' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs border-t border-border pt-3">
            <div><p className="text-muted">Installation Sent</p><p className="font-medium text-navy mt-0.5">{customer.installation_sent_at ? fmtDateTime(customer.installation_sent_at) : '—'}</p></div>
            <div><p className="text-muted">Installation Confirmed</p><p className="font-medium text-navy mt-0.5">{customer.installation_confirmed_at ? fmtDateTime(customer.installation_confirmed_at) : '—'}</p></div>
            <div><p className="text-muted">Feedback Collected</p><p className="font-medium text-navy mt-0.5">{customer.feedback_collected_at ? fmtDateTime(customer.feedback_collected_at) : '—'}</p></div>
            {customer.engagement_notes && (
              <div className="col-span-2"><p className="text-muted">Engagement Notes</p><p className="text-navy mt-0.5">{customer.engagement_notes}</p></div>
            )}
          </div>
        </div>

        {/* Warranties & Protection Units ───────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="card-header px-4 pt-4">
            <p className="card-title flex items-center gap-1.5"><ShieldCheck size={14} className="text-amber" /> Product Warranties &amp; Protection Units</p>
            <Link href="/warranty" className="text-xs text-amber-600 hover:underline">Open Warranty Hub</Link>
          </div>
          {!customer.warranties || customer.warranties.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">No warranties registered for this customer.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Warranty Number</th><th>Product Name</th><th>Status</th><th>Coverage End</th><th>Created</th></tr>
              </thead>
              <tbody>
                {customer.warranties.map((w: any) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs font-bold text-navy">{w.warranty_number || w.warranty_code}</td>
                    <td className="text-xs max-w-[200px] truncate">{w.product_name_snapshot || w.product_name || 'Standard Unit'}</td>
                    <td>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        ['active', 'ACTIVE'].includes(w.status) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ['delivered', 'DELIVERED'].includes(w.status) ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        ['return_requested', 'RETURN_REQUESTED'].includes(w.status) ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="text-xs text-muted">{w.warranty_end_date || w.coverage_end_date ? fmtDate(w.warranty_end_date || w.coverage_end_date) : '1 Year Standard'}</td>
                    <td className="text-xs text-muted">{fmtDate(w.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* CR2 — Call Logs ─────────────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="card-header px-4 pt-4">
            <p className="card-title flex items-center gap-1.5"><PhoneCall size={14} /> Call History</p>
            <Button size="sm" variant="primary" icon={<PhoneCall size={13} />} onClick={() => setCallModal(true)}>
              Log Call
            </Button>
          </div>
          {callLogs.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">No calls logged yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Outcome</th><th>Context</th><th>Duration</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {callLogs.slice(0, 8).map((log: Record<string, unknown>) => (
                  <tr key={String(log.id)}>
                    <td className="text-xs">{fmtDateTime(String(log.called_at))}</td>
                    <td><Badge label={String(log.outcome).replace('_', ' ')} colorClass={CALL_OUTCOME_COLOURS[String(log.outcome)] || ''} /></td>
                    <td className="text-xs text-muted capitalize">{String(log.context).replace(/_/g, ' ')}</td>
                    <td className="text-xs text-muted">
                      {log.duration_seconds ? `${Math.floor(Number(log.duration_seconds) / 60)}m ${Number(log.duration_seconds) % 60}s` : '—'}
                    </td>
                    <td className="text-xs text-muted max-w-[160px] truncate">{String(log.notes || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>

      {/* ── CR4: Lifecycle Journey Modal ─────────────────────────────── */}
      <Modal open={lifecycleModal} onClose={() => setLifecycleModal(false)} title="Advance Customer Journey">
        <div className="space-y-3">
          <div className="p-3 bg-surface rounded-md text-xs text-muted">
            Current stage: <span className="font-medium text-navy capitalize">{customer.lifecycle_stage.replace(/_/g, ' ')}</span>
          </div>
          <Select label="Move to Stage" value={nextStage} onChange={(e: any) => setNextStage(e?.target?.value ?? e)}
            options={[
              { value: '', label: 'Select next stage…' },
              ...allowedStages.map(s => ({ value: s, label: s.replace(/_/g, ' ').charAt(0).toUpperCase() + s.replace(/_/g, ' ').slice(1) })),
            ]}
          />
          {nextStage === 'installation_pending' && (
            <p className="text-xs text-teal-700 bg-teal-50 border border-teal-100 rounded px-3 py-2">
              Installation guide will be sent to customer via WhatsApp automatically.
            </p>
          )}
          {nextStage === 'feedback_pending' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              Feedback request will be sent to customer via WhatsApp automatically.
            </p>
          )}
          <Textarea label="Engagement Notes (optional)" value={engagementNotes} onChange={(e) => setEngagementNotes(e.target.value)} rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLifecycleModal(false)}>Cancel</Button>
            <Button variant="primary" disabled={!nextStage} loading={advanceLifecycle.isPending} onClick={handleLifecycleAdvance}>
              Advance Stage
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── CR2: Log Call Modal ──────────────────────────────────────── */}
      <Modal open={callModal} onClose={() => setCallModal(false)} title="Log Manual Call">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Call Type" value={callForm.call_type} onChange={e => setCallForm(f => ({ ...f, call_type: e.target.value as 'outbound' | 'inbound' }))}
              options={[{ value: 'outbound', label: 'Outbound (I called)' }, { value: 'inbound', label: 'Inbound (They called)' }]} />
            <Select label="Outcome" value={callForm.outcome} onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value as CallOutcome }))}
              options={CALL_OUTCOMES.map(o => ({ value: o, label: o.replace('_', ' ').charAt(0).toUpperCase() + o.replace('_', ' ').slice(1) }))} />
          </div>
          <Select label="Context" value={callForm.context} onChange={e => setCallForm(f => ({ ...f, context: e.target.value as CallContext }))}
            options={CALL_CONTEXTS.map(c => ({ value: c, label: c.replace(/_/g, ' ').charAt(0).toUpperCase() + c.replace(/_/g, ' ').slice(1) }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone Used" value={callForm.phone_used} onChange={e => setCallForm(f => ({ ...f, phone_used: e.target.value }))} />
            <Input label="Duration (seconds)" type="number" min={0} value={callForm.duration_seconds} onChange={e => setCallForm(f => ({ ...f, duration_seconds: e.target.value }))} />
          </div>
          <Textarea label="Notes" value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Call summary…" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCallModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createCallLog.isPending} onClick={handleLogCall}>Log Call</Button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Customer" width="max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" className="col-span-2" value={editForm.name || ''} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Phone" value={editForm.phone || ''} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="WhatsApp Number" value={editForm.whatsapp_number || ''} onChange={(e) => setEditForm(f => ({ ...f, whatsapp_number: e.target.value }))} />
          <Input label="Email" className="col-span-2" value={editForm.email || ''} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Address" className="col-span-2" value={editForm.address_line1 || ''} onChange={(e) => setEditForm(f => ({ ...f, address_line1: e.target.value }))} />
          <Input label="City" value={editForm.city || ''} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))} />
          <Input label="State" value={editForm.state || ''} onChange={(e) => setEditForm(f => ({ ...f, state: e.target.value }))} />
          <Input label="Pincode" value={editForm.pincode || ''} onChange={(e) => setEditForm(f => ({ ...f, pincode: e.target.value }))} />
          <Select
            label="Status" value={editForm.status || 'active'} onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'blocked', label: 'Blocked' }]}
          />
          <Select
            label="Assigned To" value={editForm.assigned_to || ''} onChange={(e) => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
            options={[
              { value: '', label: 'Unassigned' },
              ...users.map((u: any) => ({ value: u.id, label: `${u.name} (${u.role})` })),
            ]}
          />
          <Textarea label="Notes" className="col-span-2" value={editForm.notes || ''} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setEditModal(false)}>Cancel</Button>
          <Button variant="primary" loading={updateCustomer.isPending} onClick={handleEditSave}>Save Changes</Button>
        </div>
      </Modal>

      {/* New follow-up modal */}
      <Modal open={followUpModal} onClose={() => setFollowUpModal(false)} title="New Follow-Up">
        <div className="space-y-3">
          <Input label="Subject *" value={fuForm.subject} onChange={(e) => setFuForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. Confirm product images" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={fuForm.type} onChange={(e) => setFuForm(f => ({ ...f, type: e.target.value as typeof f.type }))} options={FOLLOWUP_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} />
            <Select label="Priority" value={fuForm.priority} onChange={(e) => setFuForm(f => ({ ...f, priority: e.target.value as typeof f.priority }))} options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
          </div>
          <Input label="Due Date & Time" type="datetime-local" value={fuForm.due_at} onChange={(e) => setFuForm(f => ({ ...f, due_at: e.target.value }))} />
          <Textarea label="Notes" value={fuForm.notes} onChange={(e) => setFuForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFollowUpModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createFollowUp.isPending} disabled={!fuForm.subject} onClick={handleFollowUpCreate}>Create</Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
