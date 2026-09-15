'use client';
import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  useServiceabilityList, useShippingPartners, useCreateServiceability,
  useUpdateServiceability, useDeleteServiceability, useBulkServiceability,
} from '@/hooks/useApi';
import { Button, Input, Select, Modal, PageLoader, EmptyState, Badge, Pagination } from '@/components/ui';
import { ArrowLeft, Plus, Pencil, Trash2, MapPinned, Upload } from 'lucide-react';
import type { PincodeServiceability } from '@/types';
import toast from 'react-hot-toast';

const emptyEntry = {
  pincode: '', city: '', state: '', shipping_partner_id: '',
  tat_days: 3 as string | number, is_serviceable: true, cod_available: true, notes: '',
};

export default function ServiceabilityPage() {
  const [page, setPage] = useState(1);
  const [pincodeFilter, setPincodeFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('');

  const { data, isLoading } = useServiceabilityList({
    page, limit: 20,
    ...(pincodeFilter && { pincode: pincodeFilter }),
    ...(partnerFilter && { shipping_partner_id: partnerFilter }),
  });
  const { data: partners } = useShippingPartners({ is_active: true });

  const createEntry = useCreateServiceability();
  const updateEntry = useUpdateServiceability();
  const deleteEntry = useDeleteServiceability();
  const bulkUpload = useBulkServiceability();

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<PincodeServiceability | null>(null);
  const [form, setForm] = useState(emptyEntry);
  const [confirmDelete, setConfirmDelete] = useState<PincodeServiceability | null>(null);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const entries: PincodeServiceability[] = data?.data || [];
  const pagination = data?.pagination;

  const openCreate = () => { setEditing(null); setForm(emptyEntry); setModal(true); };
  const openEdit = (e: PincodeServiceability) => {
    setEditing(e);
    setForm({
      pincode: e.pincode, city: e.city || '', state: e.state || '',
      shipping_partner_id: e.shipping_partner_id || '',
      tat_days: e.tat_days, is_serviceable: e.is_serviceable,
      cod_available: e.cod_available, notes: e.notes || '',
    });
    setModal(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const payload = {
      ...form,
      tat_days: Number(form.tat_days),
      shipping_partner_id: form.shipping_partner_id || undefined,
    };
    if (editing) {
      await updateEntry.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createEntry.mutateAsync(payload);
    }
    setModal(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteEntry.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  };

  const handleBulkUpload = async () => {
    try {
      const lines = bulkText.trim().split('\n').filter(Boolean);
      const parsed = lines.map((line) => {
        const [pincode, city, state, tat_days, cod] = line.split(',').map(s => s.trim());
        return {
          pincode,
          city: city || undefined,
          state: state || undefined,
          tat_days: Number(tat_days),
          cod_available: cod ? cod.toLowerCase() !== 'no' : true,
        };
      });
      if (parsed.some(e => !e.pincode || isNaN(e.tat_days))) {
        toast.error('Each line must be: pincode,city,state,tat_days,cod(yes/no)');
        return;
      }
      await bulkUpload.mutateAsync(parsed);
      setBulkModal(false);
      setBulkText('');
    } catch {
      toast.error('Could not parse input. Check the format.');
    }
  };

  return (
    <AppShell>
      <Topbar title="Pincode Serviceability" subtitle="Delivery TAT and COD availability by pincode" />
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        <Link href="/shipping" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-navy transition-colors">
          <ArrowLeft size={14} /> Back to Shipping
        </Link>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap items-end gap-3">
            <Input label="Pincode" value={pincodeFilter} onChange={(e) => { setPincodeFilter(e.target.value); setPage(1); }} placeholder="Search pincode…" className="w-40" />
            <Select
              label="Partner" value={partnerFilter} onChange={(e) => { setPartnerFilter(e.target.value); setPage(1); }}
              options={[{ value: '', label: 'All partners' }, ...(partners || []).map(p => ({ value: p.id, label: p.name }))]}
              className="w-44"
            />
            <div className="flex-1" />
            <Button variant="secondary" icon={<Upload size={14} />} onClick={() => setBulkModal(true)}>Bulk Upload</Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Pincode</Button>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <PageLoader />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<MapPinned size={36} />}
              title="No serviceability data yet"
              description="Add pincode entries individually or use bulk upload to populate delivery TAT data."
              action={<Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Pincode</Button>}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Pincode</th>
                      <th>City / State</th>
                      <th>Partner</th>
                      <th>TAT (days)</th>
                      <th>COD</th>
                      <th>Serviceable</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td className="font-medium font-mono">{e.pincode}</td>
                        <td className="text-muted">{[e.city, e.state].filter(Boolean).join(', ') || '—'}</td>
                        <td>{e.shippingPartner?.name || <span className="text-muted">All partners</span>}</td>
                        <td>{e.tat_days} day{e.tat_days !== 1 ? 's' : ''}</td>
                        <td>
                          <Badge label={e.cod_available ? 'Yes' : 'No'} colorClass={e.cod_available ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'} />
                        </td>
                        <td>
                          <Badge label={e.is_serviceable ? 'Yes' : 'No'} colorClass={e.is_serviceable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'} />
                        </td>
                        <td>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(e)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-navy hover:bg-surface transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setConfirmDelete(e)} className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination && (
                <div className="flex justify-end px-4 py-3 border-t border-border">
                  <Pagination page={pagination.page} totalPages={pagination.totalPages} onPage={setPage} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Create/Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Serviceability Entry' : 'Add Pincode Entry'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Pincode" required value={form.pincode} onChange={(e) => setForm(f => ({ ...f, pincode: e.target.value }))} maxLength={10} disabled={!!editing} />
            <Input label="TAT (days)" required type="number" min={0} max={60} value={form.tat_days} onChange={(e) => setForm(f => ({ ...f, tat_days: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} />
            <Input label="State" value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} />
          </div>
          <Select
            label="Shipping Partner (optional)" value={form.shipping_partner_id}
            onChange={(e) => setForm(f => ({ ...f, shipping_partner_id: e.target.value }))}
            options={[{ value: '', label: 'Applies to all partners' }, ...(partners || []).map(p => ({ value: p.id, label: p.name }))]}
            disabled={!!editing}
          />
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
              <input type="checkbox" checked={form.is_serviceable} onChange={(e) => setForm(f => ({ ...f, is_serviceable: e.target.checked }))} className="rounded border-border" />
              Serviceable
            </label>
            <label className="flex items-center gap-2 text-sm text-navy cursor-pointer">
              <input type="checkbox" checked={form.cod_available} onChange={(e) => setForm(f => ({ ...f, cod_available: e.target.checked }))} className="rounded border-border" />
              COD Available
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={createEntry.isPending || updateEntry.isPending}>
              {editing ? 'Save Changes' : 'Add Entry'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk upload modal */}
      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Upload Pincodes" width="max-w-xl">
        <div className="space-y-3">
          <p className="text-xs text-muted">
            One entry per line: <code className="bg-surface px-1 py-0.5 rounded">pincode,city,state,tat_days,cod(yes/no)</code>
          </p>
          <textarea
            className="form-input font-mono text-xs resize-none"
            rows={8}
            placeholder={'400001,Mumbai,Maharashtra,3,yes\n110001,Delhi,Delhi,4,yes\n380001,Ahmedabad,Gujarat,5,no'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkModal(false)}>Cancel</Button>
            <Button variant="primary" icon={<Upload size={14} />} loading={bulkUpload.isPending} onClick={handleBulkUpload} disabled={!bulkText.trim()}>
              Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Entry" width="max-w-sm">
        <p className="text-sm text-muted mb-5">
          Delete serviceability entry for pincode <strong>{confirmDelete?.pincode}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={deleteEntry.isPending} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </AppShell>
  );
}
