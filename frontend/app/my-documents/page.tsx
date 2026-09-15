'use client';

import { useState, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { useEmployee, useUploadEmployeeDocument, useReplaceDocument, useRequestReview } from '@/hooks/useApi';
import { useAuthStore } from '@/lib/auth';
import { Badge, Button, Input, Modal, PageLoader, EmptyState, Select } from '@/components/ui';
import {
  FileText, Upload, CheckCircle2, Clock, XCircle, AlertCircle, Download,
  RefreshCw, ShieldCheck, History, Eye, ArrowUpRight
} from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import type { DocumentType, EmployeeDocument, DocumentStatus } from '@/types';
import toast from 'react-hot-toast';

const DOC_STATUS_BADGES: Record<DocumentStatus, { label: string; color: string; icon: any }> = {
  missing:      { label: 'Missing',      color: 'bg-gray-100 text-gray-600 border-gray-200', icon: AlertCircle },
  uploaded:     { label: 'Uploaded',     color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  verified:     { label: 'Verified',     color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     color: 'bg-red-100 text-red-700 border-red-200',     icon: XCircle },
};

const DOC_TYPES_LIST: { type: DocumentType; label: string; mandatory: boolean }[] = [
  { type: 'aadhaar_card', label: 'Aadhaar Card', mandatory: true },
  { type: 'pan_card', label: 'PAN Card', mandatory: true },
  { type: 'resume', label: 'Resume / CV', mandatory: true },
  { type: 'bank_passbook', label: 'Bank Passbook / Cheque', mandatory: true },
  { type: 'photo', label: 'Passport Size Photo', mandatory: true },
  { type: 'id_proof', label: 'Other ID Proof', mandatory: false },
  { type: 'address_proof', label: 'Address Proof', mandatory: false },
  { type: 'educational_certificate', label: 'Degree / Certificate', mandatory: false },
  { type: 'experience_letter', label: 'Experience Letter', mandatory: false },
];

export default function MyDocumentsPage() {
  const { user } = useAuthStore();
  const userId = user?.id || '';

  const { data: employeeData, isLoading, refetch } = useEmployee(userId);
  const uploadDoc = useUploadEmployeeDocument();
  const replaceDoc = useReplaceDocument();
  const requestReview = useRequestReview();

  // Upload modal state
  const [uploadModal, setUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType>('aadhaar_card');
  const [replaceTargetDocId, setReplaceTargetDocId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onboarding = employeeData?.onboarding_progress;
  const documents = employeeData?.documents || [];

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('document_type', selectedType);

    if (replaceTargetDocId && employeeData?.id) {
      await replaceDoc.mutateAsync({
        employeeId: employeeData.id,
        docId: replaceTargetDocId,
        formData,
      });
    } else {
      await uploadDoc.mutateAsync({
        userId: employeeData?.id || userId,
        formData,
      });
    }

    setUploadModal(false);
    setSelectedFile(null);
    setReplaceTargetDocId(null);
  };

  const handleDownload = (docId: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const empId = employeeData?.id || userId;
    window.open(`${API_URL}/api/employees/${empId}/documents/${docId}/download`, '_blank');
  };

  return (
    <AppShell>
      <Topbar title="My Documents" subtitle="Upload and manage your onboarding documents" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            {/* Onboarding Progress Header Banner */}
            <div className="card p-5 bg-gradient-to-r from-navy via-navy to-slate-800 text-white shadow-lg">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-amber">
                    Onboarding Status: {employeeData?.onboarding_status || 'Pending'}
                  </span>
                  <h3 className="text-xl font-bold mt-1">{user?.name} — Document Vault</h3>
                  <p className="text-xs text-white/70 mt-1">
                    Upload mandatory documents to complete your employee verification.
                  </p>
                </div>

                {/* Progress Ring / Bar */}
                <div className="w-full md:w-64 space-y-2 bg-white/10 p-3 rounded-lg border border-white/10">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span>Onboarding Progress</span>
                    <span className="text-amber">{onboarding?.completion_percent || 0}%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber rounded-full transition-all"
                      style={{ width: `${onboarding?.completion_percent || 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/60">
                    {onboarding?.verified_percent === 100
                      ? 'All mandatory documents verified!'
                      : `${onboarding?.missing_docs.length || 0} mandatory document(s) remaining`}
                  </p>
                </div>
              </div>
            </div>

            {/* Mandatory Document Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-navy flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-700" />
                  Mandatory Document Checklist
                </h4>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload size={14} />}
                  onClick={() => {
                    setReplaceTargetDocId(null);
                    setSelectedType('aadhaar_card');
                    setUploadModal(true);
                  }}
                >
                  Upload New Document
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DOC_TYPES_LIST.map(item => {
                  const currentDoc = documents.find(d => d.document_type === item.type && d.is_current !== false);
                  const status: DocumentStatus = currentDoc ? currentDoc.status : 'missing';
                  const badge = DOC_STATUS_BADGES[status] || DOC_STATUS_BADGES.missing;
                  const Icon = badge.icon;

                  return (
                    <div key={item.type} className="card p-4 space-y-3 flex flex-col justify-between hover:shadow-md transition-all border-l-4 border-l-amber">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-navy">{item.label}</p>
                            <span className="text-[10px] font-semibold text-muted uppercase">
                              {item.mandatory ? 'Mandatory' : 'Optional'}
                            </span>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                            <Icon size={12} />
                            {badge.label}
                          </span>
                        </div>

                        {currentDoc ? (
                          <div className="space-y-1.5 pt-1 text-xs">
                            <p className="text-navy font-medium truncate" title={currentDoc.original_name}>
                              📄 {currentDoc.original_name}
                            </p>
                            <div className="flex justify-between text-[11px] text-muted">
                              <span>Version {currentDoc.version || 1}</span>
                              <span>Uploaded: {fmtDate(currentDoc.created_at)}</span>
                            </div>

                            {currentDoc.rejection_reason && (
                              <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                <strong>HR Note:</strong> {currentDoc.rejection_reason}
                              </p>
                            )}

                            {currentDoc.remarks && (
                              <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100">
                                <strong>HR Remarks:</strong> {currentDoc.remarks}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted italic py-2">
                            Document not uploaded yet.
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 border-t flex items-center gap-2">
                        {currentDoc ? (
                          <>
                            <button
                              onClick={() => handleDownload(currentDoc.id)}
                              className="flex-1 py-1.5 px-2 rounded bg-surface hover:bg-border text-navy text-xs font-medium flex items-center justify-center gap-1"
                            >
                              <Download size={13} /> View File
                            </button>
                            {status !== 'verified' && (
                              <button
                                onClick={() => {
                                  setSelectedType(item.type);
                                  setReplaceTargetDocId(currentDoc.id);
                                  setUploadModal(true);
                                }}
                                className="flex-1 py-1.5 px-2 rounded bg-amber text-navy hover:bg-amber-600 text-xs font-bold flex items-center justify-center gap-1"
                              >
                                <RefreshCw size={13} /> Re-upload
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedType(item.type);
                              setReplaceTargetDocId(null);
                              setUploadModal(true);
                            }}
                            className="w-full py-1.5 px-2 rounded bg-navy text-white hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Upload size={13} /> Upload {item.label}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Upload / Replace Document Modal */}
      <Modal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        title={replaceTargetDocId ? "Re-upload / Replace Document Version" : "Upload Onboarding Document"}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <Select
              label="Document Type *"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType)}
              disabled={!!replaceTargetDocId}
              options={DOC_TYPES_LIST.map((d) => ({
                value: d.type,
                label: `${d.label} ${d.mandatory ? '(Mandatory)' : ''}`,
                badge: d.mandatory ? 'Required' : undefined,
                badgeColor: d.mandatory ? 'bg-amber-100 text-amber-800' : undefined,
              }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-navy">Select File (PDF, Image, Word) *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs border border-border rounded-md p-2"
            />
            <p className="text-[10px] text-muted">Max file size: 10MB</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" onClick={() => setUploadModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={uploadDoc.isPending || replaceDoc.isPending}
              disabled={!selectedFile}
              onClick={handleUploadSubmit}
            >
              Submit Document
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
