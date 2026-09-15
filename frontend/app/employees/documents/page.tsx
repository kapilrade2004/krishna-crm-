'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  useAllDocuments, useDocumentStats, useVerifyDocument,
  useDeleteEmployeeDocument, useUpdateDocument,
  useEmployees, useUploadEmployeeDocument,
} from '@/hooks/useApi';
import {
  Badge, Button, Input, Select, Modal, Textarea,
  PageLoader, EmptyState, Pagination, ConfirmDialog,
} from '@/components/ui';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import {
  FileText, Search, Upload, ShieldCheck, XCircle,
  Trash2, Download, Pencil, ArrowLeft, Plus,
  CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import type { EmployeeDocument, DocumentType } from '@/types';
import toast from 'react-hot-toast';
import api from '@/lib/api';

const DOC_TYPES: { value: string; label: string }[] = [
  { value: '',                      label: 'All Types' },
  { value: 'id_proof',              label: 'ID Proof' },
  { value: 'address_proof',         label: 'Address Proof' },
  { value: 'photo',                 label: 'Photograph' },
  { value: 'pan_card',              label: 'PAN Card' },
  { value: 'aadhaar_card',          label: 'Aadhaar Card' },
  { value: 'offer_letter',          label: 'Offer Letter' },
  { value: 'appointment_letter',    label: 'Appointment Letter' },
  { value: 'relieving_letter',      label: 'Relieving Letter' },
  { value: 'experience_letter',     label: 'Experience Letter' },
  { value: 'educational_certificate', label: 'Educational Certificate' },
  { value: 'bank_passbook',         label: 'Bank Passbook / Cheque' },
  { value: 'other',                 label: 'Other' },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  id_proof: 'ID Proof', address_proof: 'Address Proof', photo: 'Photograph',
  pan_card: 'PAN Card', aadhaar_card: 'Aadhaar Card', offer_letter: 'Offer Letter',
  appointment_letter: 'Appointment Letter', relieving_letter: 'Relieving Letter',
  experience_letter: 'Experience Letter', educational_certificate: 'Educational Certificate',
  bank_passbook: 'Bank Passbook', other: 'Other',
};

const STATUS_COLOURS: Record<string, string> = {
  uploaded: 'bg-blue-100 text-blue-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-600',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  uploaded: <Clock size={11} />,
  verified: <CheckCircle2 size={11} />,
  rejected: <XCircle size={11} />,
};

export default function DocumentManagementPage() {
  const { user } = useAuthStore();
  const canAdmin = user?.role === 'admin';

  // ── Filters ────────────────────────────────────────────────────────────────
  const [page,       setPage]       = useState(1);
  const [q,          setQ]          = useState('');
  const [docType,    setDocType]    = useState('');
  const [status,     setStatus]     = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const params: Record<string, unknown> = { page, limit: 15 };
  if (q)          params.q             = q;
  if (docType)    params.document_type = docType;
  if (status)     params.status        = status;
  if (employeeId) params.user_id       = employeeId;

  // ── API ────────────────────────────────────────────────────────────────────
  const { data, isLoading }         = useAllDocuments(params);
  const { data: stats }             = useDocumentStats();
  const { data: employees = [] }    = useEmployees();
  const verifyDoc   = useVerifyDocument();
  const deleteDoc   = useDeleteEmployeeDocument();
  const updateDoc   = useUpdateDocument();
  const uploadDoc   = useUploadEmployeeDocument();

  const documents: EmployeeDocument[] = data?.data || [];
  const pagination = data?.pagination;

  // ── Modal state ────────────────────────────────────────────────────────────
  const [editTarget,    setEditTarget]    = useState<EmployeeDocument | null>(null);
  const [rejectTarget,  setRejectTarget]  = useState<EmployeeDocument | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<EmployeeDocument | null>(null);
  const [uploadModal,   setUploadModal]   = useState(false);
  const [rejectReason,  setRejectReason]  = useState('');
  const [editForm,      setEditForm]      = useState({ document_name: '', document_type: '', notes: '', expiry_date: '' });
  const [uploadEmployee, setUploadEmployee] = useState('');
  const [uploadForm,    setUploadForm]    = useState({ document_type: 'id_proof' as DocumentType, document_name: '', expiry_date: '', notes: '' });
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openEdit = (doc: EmployeeDocument) => {
    setEditTarget(doc);
    setEditForm({
      document_name: doc.document_name,
      document_type: doc.document_type,
      notes:         doc.notes || '',
      expiry_date:   doc.expiry_date || '',
    });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    await updateDoc.mutateAsync({ docId: editTarget.id, ...editForm });
    setEditTarget(null);
  };

  const handleVerify = async (doc: EmployeeDocument) => {
    await verifyDoc.mutateAsync({ docId: doc.id, action: 'verify' });
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    await verifyDoc.mutateAsync({ docId: rejectTarget.id, action: 'reject', rejection_reason: rejectReason });
    setRejectTarget(null);
    setRejectReason('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    try {
      const res = await api.get(
        `/employees/${doc.employee_id}/documents/${doc.id}/download`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = doc.original_name; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed.'); }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadEmployee) return;
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('document_type', uploadForm.document_type);
    fd.append('document_name', uploadForm.document_name || '');
    if (uploadForm.expiry_date) fd.append('expiry_date', uploadForm.expiry_date);
    if (uploadForm.notes) fd.append('notes', uploadForm.notes);
    await uploadDoc.mutateAsync({ userId: uploadEmployee, formData: fd });
    setUploadModal(false);
    setSelectedFile(null);
    setUploadEmployee('');
    setUploadForm({ document_type: 'id_proof', document_name: '', expiry_date: '', notes: '' });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <AppShell>
      <Topbar title="Document Management" subtitle="Central HR document repository — all employee documents" />
      <main className="flex-1 overflow-y-auto p-6 space-y-5">

        <Link href="/employees" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-navy transition-colors">
          <ArrowLeft size={14} /> Back to Employees
        </Link>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card text-center py-3">
              <p className="text-2xl font-semibold text-navy">
                {stats.byStatus.reduce((s: number, r: {count: string}) => s + Number(r.count), 0)}
              </p>
              <p className="text-[11px] text-muted mt-0.5">Total Documents</p>
            </div>
            <div className="card text-center py-3 border-amber-200">
              <p className="text-2xl font-semibold text-amber-600">{stats.pendingVerification}</p>
              <p className="text-[11px] text-muted mt-0.5">Pending Verification</p>
            </div>
            <div className="card text-center py-3 border-emerald-200">
              <p className="text-2xl font-semibold text-emerald-600">
                {stats.byStatus.find((r: {status:string; count:string}) => r.status === 'verified')?.count || 0}
              </p>
              <p className="text-[11px] text-muted mt-0.5">Verified</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-2xl font-semibold text-blue-600">{stats.recentlyUploaded}</p>
              <p className="text-[11px] text-muted mt-0.5">Added (Last 7 days)</p>
            </div>
          </div>
        )}

        {/* Pending verification alert */}
        {stats?.pendingVerification > 0 && canAdmin && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>{stats.pendingVerification} document(s)</strong> are awaiting verification.
              Filter by <strong>Status: Uploaded</strong> below to review them.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="card">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="relative min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input placeholder="Search employee name…" value={q}
                onChange={e => { setQ(e.target.value); setPage(1); }} className="pl-8" />
            </div>
            <Select value={docType} onChange={e => { setDocType(e.target.value); setPage(1); }}
              options={DOC_TYPES} className="w-52" />
            <Select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
              options={[
                { value: '',         label: 'All Statuses' },
                { value: 'uploaded', label: '⏳ Uploaded — Pending' },
                { value: 'verified', label: '✅ Verified' },
                { value: 'rejected', label: '❌ Rejected' },
              ]} className="w-44" />
            <Select value={employeeId} onChange={e => { setEmployeeId(e.target.value); setPage(1); }}
              options={[
                { value: '', label: 'All Employees' },
                ...employees.map((e: any) => ({
                  value: e.user_id || e.id || e.user?.id,
                  label: e.user?.name || e.name || e.user_id || e.id,
                })),
              ]} className="w-44" />
            {(q || docType || status || employeeId) && (
              <button onClick={() => { setQ(''); setDocType(''); setStatus(''); setEmployeeId(''); setPage(1); }}
                className="text-xs text-muted hover:text-navy px-2 py-1.5 border border-border rounded-md">
                ✕ Clear
              </button>
            )}
            <div className="flex-1" />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setUploadModal(true)}>
              Upload Document
            </Button>
          </div>
        </div>

        {/* Documents table */}
        {isLoading ? <PageLoader /> : documents.length === 0 ? (
          <EmptyState icon={<FileText size={36} />} title="No documents found"
            description="Upload documents per employee or adjust your filters."
            action={<Button variant="primary" icon={<Upload size={14} />} onClick={() => setUploadModal(true)}>Upload Document</Button>} />
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th>Expiry</th>
                    <th>Verified By</th>
                    <th style={{ width: 130 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      {/* Document name + file info */}
                      <td>
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FileText size={13} className="text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-navy text-sm truncate max-w-[180px]">{doc.document_name}</p>
                            <p className="text-[11px] text-muted mt-0.5">
                              {doc.original_name} · {(doc.file_size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Employee */}
                      <td>
                        <Link href={`/employees/${doc.employee_id}`}
                          className="text-sm font-medium text-amber-600 hover:underline">
                          {doc.uploader?.name || '—'}
                        </Link>
                      </td>

                      {/* Type */}
                      <td className="text-xs text-muted">
                        {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_COLOURS[doc.status]}`}>
                          {STATUS_ICONS[doc.status]}
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                        {doc.rejection_reason && (
                          <p className="text-[10px] text-danger mt-0.5 max-w-[140px] truncate"
                            title={doc.rejection_reason}>{doc.rejection_reason}</p>
                        )}
                      </td>

                      {/* Uploaded date */}
                      <td className="text-xs text-muted">
                        <div>{fmtDate(doc.created_at)}</div>
                        <div className="text-[10px] mt-0.5">
                          by {doc.uploader?.name || '—'}
                        </div>
                      </td>

                      {/* Expiry */}
                      <td className="text-xs text-muted">
                        {doc.expiry_date ? (
                          <span className={new Date(doc.expiry_date) < new Date() ? 'text-danger font-medium' : ''}>
                            {fmtDate(doc.expiry_date)}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Verified by */}
                      <td className="text-xs text-muted">
                        {doc.verifier ? (
                          <div>
                            <p className="font-medium text-navy">{doc.verifier.name}</p>
                            {doc.verified_at && <p className="text-[10px]">{fmtDate(doc.verified_at)}</p>}
                          </div>
                        ) : '—'}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="flex items-center gap-1">
                          {/* Download */}
                          <button onClick={() => handleDownload(doc)} title="Download"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Download size={13} />
                          </button>

                          {/* Edit */}
                          <button onClick={() => openEdit(doc)} title="Edit"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-navy hover:bg-surface transition-colors">
                            <Pencil size={13} />
                          </button>

                          {/* Verify — admin only, uploaded status */}
                          {canAdmin && doc.status === 'uploaded' && (
                            <button onClick={() => handleVerify(doc)} title="Verify"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                              <ShieldCheck size={13} />
                            </button>
                          )}

                          {/* Reject — admin only, uploaded status */}
                          {canAdmin && doc.status === 'uploaded' && (
                            <button onClick={() => setRejectTarget(doc)} title="Reject"
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 transition-colors">
                              <XCircle size={13} />
                            </button>
                          )}

                          {/* Delete */}
                          <button onClick={() => setDeleteTarget(doc)} title="Delete"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
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

      {/* ── UPLOAD MODAL ──────────────────────────────────────────────────── */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Upload Document" width="max-w-md">
        <div className="space-y-3">
          <Select label="Employee *" value={uploadEmployee} onChange={e => setUploadEmployee(e.target.value)}
            options={[
              { value: '', label: 'Select employee…' },
              ...employees.map((e: any) => ({
                value: e.user_id || e.id || e.user?.id,
                label: e.user?.name || e.name || e.user_id || e.id,
              })),
            ]} />
          <Select label="Document Type *" value={uploadForm.document_type}
            onChange={e => setUploadForm(f => ({ ...f, document_type: e.target.value as DocumentType }))}
            options={DOC_TYPES.filter(d => d.value !== '')} />
          <Input label="Document Label" value={uploadForm.document_name}
            onChange={e => setUploadForm(f => ({ ...f, document_name: e.target.value }))}
            placeholder="e.g. Aadhaar Card — Front" />
          <div>
            <label className="form-label">File * (PDF, Image, Word, Excel — max 10MB)</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="form-input file:mr-3 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs file:font-medium cursor-pointer" />
            {selectedFile && (
              <p className="text-xs text-muted mt-1">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
          <Input label="Expiry Date (optional)" type="date" value={uploadForm.expiry_date}
            onChange={e => setUploadForm(f => ({ ...f, expiry_date: e.target.value }))} />
          <Textarea label="Notes (optional)" value={uploadForm.notes}
            onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setUploadModal(false)}>Cancel</Button>
            <Button variant="primary" icon={<Upload size={14} />}
              loading={uploadDoc.isPending}
              disabled={!selectedFile || !uploadEmployee}
              onClick={handleUpload}>
              Upload
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── EDIT MODAL ────────────────────────────────────────────────────── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Document" width="max-w-md">
        <div className="space-y-3">
          <Input label="Document Name" value={editForm.document_name}
            onChange={e => setEditForm(f => ({ ...f, document_name: e.target.value }))} />
          <Select label="Document Type" value={editForm.document_type}
            onChange={e => setEditForm(f => ({ ...f, document_type: e.target.value }))}
            options={DOC_TYPES.filter(d => d.value !== '')} />
          <Input label="Expiry Date" type="date" value={editForm.expiry_date}
            onChange={e => setEditForm(f => ({ ...f, expiry_date: e.target.value }))} />
          <Textarea label="Notes" value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button variant="primary" loading={updateDoc.isPending} onClick={handleEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── REJECT MODAL ──────────────────────────────────────────────────── */}
      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Document" width="max-w-sm">
        <div className="space-y-3">
          <p className="text-xs text-muted bg-surface rounded-md px-3 py-2">
            Rejecting: <span className="font-medium text-navy">{rejectTarget?.document_name}</span>
          </p>
          <Textarea label="Rejection Reason *" value={rejectReason}
            onChange={e => setRejectReason(e.target.value)} rows={3}
            placeholder="e.g. Document is unclear, wrong document type…" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={verifyDoc.isPending}
              disabled={!rejectReason.trim()} onClick={handleReject}>
              Reject Document
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM ─────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Permanently delete "${deleteTarget?.document_name}"? This cannot be undone.`}
        loading={deleteDoc.isPending}
      />
    </AppShell>
  );
}
