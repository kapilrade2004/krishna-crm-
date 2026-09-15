'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { useDocumentCenter, useVerifyDocument, useDepartments, useUsers } from '@/hooks/useApi';
import { Badge, Button, Input, Select, Modal, PageLoader, EmptyState } from '@/components/ui';
import {
  FileCheck, Search, Filter, AlertCircle, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronUp, Eye, Download, ShieldCheck, RefreshCw, FileText, UserCheck, ArrowRight
} from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth';
import type { DocumentCenterEmployee, DocumentStatus, EmployeeDocument, DocumentType } from '@/types';
import toast from 'react-hot-toast';
import api from '@/lib/api';

const DOC_STATUS_BADGES: Record<DocumentStatus, { label: string; color: string; icon: any }> = {
  missing:      { label: 'Missing',      color: 'bg-gray-100 text-gray-600 border-gray-200', icon: AlertCircle },
  uploaded:     { label: 'Uploaded',     color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  verified:     { label: 'Verified',     color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     color: 'bg-red-100 text-red-700 border-red-200',     icon: XCircle },
};

const ONBOARDING_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Onboarding Pending', color: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'In Progress',        color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Onboarding Done',    color: 'bg-emerald-100 text-emerald-800' },
  waived:      { label: 'Waived',             color: 'bg-purple-100 text-purple-700' },
};

export default function DocumentCenterPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isHR = user?.role === 'hr' || isSuperAdmin;

  const [q, setQ]                   = useState('');
  const [role, setRole]             = useState('');
  const [dept, setDept]             = useState('');
  const [onboardingStatus, setOnboardingStatus] = useState('');
  const [docStatus, setDocStatus]   = useState('');
  const [managerId, setManagerId]   = useState('');

  const { data: documentCenter, isLoading, refetch } = useDocumentCenter({
    onboarding_status: onboardingStatus || undefined,
    department: dept || undefined,
    role: role || undefined,
    document_status: docStatus || undefined,
    reporting_manager_id: managerId || undefined,
  });

  const { data: departments = [] } = useDepartments();
  const { data: allUsers = [] } = useUsers();
  const verifyDoc = useVerifyDocument();

  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  // Verification Modal State
  const [verifyModal, setVerifyModal] = useState<{ open: boolean; doc: EmployeeDocument | null; emp: DocumentCenterEmployee | null }>({
    open: false, doc: null, emp: null,
  });
  const [actionType, setActionType]   = useState<'verify' | 'reject'>('verify');
  const [rejectionReason, setRejectionReason] = useState('');
  const [remarks, setRemarks]                 = useState('');

  const employees = documentCenter?.employees || [];
  const summary   = documentCenter?.summary;

  // Filter client-side by query string search
  const filteredEmployees = employees.filter(e => {
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return (
      e.full_name.toLowerCase().includes(term) ||
      (e.employee_code && e.employee_code.toLowerCase().includes(term)) ||
      (e.department && e.department.toLowerCase().includes(term)) ||
      (e.designation && e.designation.toLowerCase().includes(term))
    );
  });

  const handleVerifySubmit = async () => {
    if (!verifyModal.doc) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      toast.error('Please enter a rejection reason.');
      return;
    }

    await verifyDoc.mutateAsync({
      docId: verifyModal.doc.id,
      action: actionType,
      rejection_reason: actionType === 'reject' ? rejectionReason : undefined,
      remarks: remarks || undefined,
    });

    setVerifyModal({ open: false, doc: null, emp: null });
    setRejectionReason('');
    setRemarks('');
  };

  const handleDownload = (empId: string, docId: string, filename: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    window.open(`${API_URL}/api/employees/${empId}/documents/${docId}/download`, '_blank');
  };

  return (
    <AppShell>
      <Topbar title="HR Document Center" subtitle="Track workforce onboarding, mandatory compliance & document verification" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="card py-3 px-4 flex items-center justify-between border-l-4 border-l-navy">
            <div>
              <p className="text-xs text-muted font-medium">Total Employees</p>
              <p className="text-2xl font-bold text-navy mt-0.5">{summary?.total || 0}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-navy">
              <FileText size={18} />
            </div>
          </div>

          <div className="card py-3 px-4 flex items-center justify-between border-l-4 border-l-amber">
            <div>
              <p className="text-xs text-muted font-medium">Pending Onboarding</p>
              <p className="text-2xl font-bold text-amber-700 mt-0.5">{summary?.pending_onboarding || 0}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-amber/10 flex items-center justify-center text-amber-700">
              <Clock size={18} />
            </div>
          </div>

          <div className="card py-3 px-4 flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs text-muted font-medium">Onboarding Completed</p>
              <p className="text-2xl font-bold text-emerald-700 mt-0.5">{summary?.completed_onboarding || 0}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="card py-3 px-4 flex items-center justify-between border-l-4 border-l-blue-500">
            <div>
              <p className="text-xs text-muted font-medium">Pending Verifications</p>
              <p className="text-2xl font-bold text-blue-700 mt-0.5">{summary?.pending_verifications || 0}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="card py-3 px-4 flex items-center justify-between border-l-4 border-l-red-500">
            <div>
              <p className="text-xs text-muted font-medium">Rejected Documents</p>
              <p className="text-2xl font-bold text-red-600 mt-0.5">{summary?.rejected_documents || 0}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <XCircle size={18} />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Filter size={15} />
              <span>Document Center Filters</span>
            </div>
            <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => refetch()}>
              Refresh Data
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Search employee..."
                value={q}
                onChange={e => setQ(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>

            {/* Role filter */}
            <Select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="text-xs"
              options={[
                { value: '', label: 'All System Roles' },
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'manager', label: 'Manager' },
                { value: 'hr', label: 'HR' },
                { value: 'telecaller', label: 'Telecaller' },
                { value: 'sales', label: 'Sales' },
              ]}
            />

            {/* Department filter */}
            <Select
              value={dept}
              onChange={e => setDept(e.target.value)}
              className="text-xs"
              options={[
                { value: '', label: 'All Departments' },
                ...(departments as string[]).map(d => ({ value: d, label: d })),
              ]}
            />

            {/* Onboarding status filter */}
            <Select
              value={onboardingStatus}
              onChange={e => setOnboardingStatus(e.target.value)}
              className="text-xs"
              options={[
                { value: '', label: 'All Onboarding' },
                { value: 'pending', label: 'Pending Onboarding' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'waived', label: 'Waived' },
              ]}
            />

            {/* Document status filter */}
            <Select
              value={docStatus}
              onChange={e => setDocStatus(e.target.value)}
              className="text-xs"
              options={[
                { value: '', label: 'All Doc Status' },
                { value: 'pending_review', label: 'Review Pending' },
                { value: 'incomplete', label: 'Docs Incomplete' },
                { value: 'rejected', label: 'Has Rejected Doc' },
                { value: 'verified', label: 'Fully Verified' },
              ]}
            />

            {/* Manager filter */}
            <Select
              value={managerId}
              onChange={e => setManagerId(e.target.value)}
              className="text-xs"
              options={[
                { value: '', label: 'All Managers' },
                ...allUsers.filter(u => ['admin', 'super_admin', 'manager'].includes(u.role)).map(u => ({
                  value: u.id,
                  label: u.name,
                })),
              ]}
            />
          </div>
        </div>

        {/* Employee Table */}
        {isLoading ? (
          <PageLoader />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            icon={<FileCheck size={36} />}
            title="No employees found"
            description="No employee document records match the selected filters."
          />
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Employee Name</th>
                    <th>Role & Dept</th>
                    <th>Reporting Manager</th>
                    <th>Onboarding State</th>
                    <th>Mandatory Docs</th>
                    <th>Doc Status</th>
                    <th>Pending Action</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const isExpanded = expandedEmployeeId === emp.id;
                    const obBadge = ONBOARDING_STATUS_BADGES[emp.onboarding_status] || ONBOARDING_STATUS_BADGES.pending;

                    return (
                      <tr key={emp.id} className={isExpanded ? 'bg-amber/5' : ''}>
                        {/* Expand toggle */}
                        <td>
                          <button
                            onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                            className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-navy hover:bg-surface transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>

                        {/* Name & Code */}
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber/15 text-navy flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {emp.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-navy text-sm">{emp.full_name}</p>
                              <p className="text-[11px] text-muted font-mono">{emp.employee_code || 'No Code'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role & Dept */}
                        <td>
                          <p className="text-xs font-medium text-navy capitalize">{emp.role}</p>
                          <p className="text-[11px] text-muted">{emp.department}</p>
                        </td>

                        {/* Reporting Manager */}
                        <td className="text-xs text-navy font-medium">
                          {emp.reporting_manager}
                        </td>

                        {/* Onboarding State */}
                        <td>
                          <Badge label={obBadge.label} colorClass={obBadge.color} />
                        </td>

                        {/* Progress Bar */}
                        <td>
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-semibold text-navy">{emp.onboarding_completion}%</span>
                              <span className="text-muted">({5 - emp.missing_docs.length}/5)</span>
                            </div>
                            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  emp.onboarding_completion === 100
                                    ? 'bg-emerald-500'
                                    : emp.onboarding_completion > 40
                                    ? 'bg-amber'
                                    : 'bg-red-400'
                                }`}
                                style={{ width: `${emp.onboarding_completion}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Verification Percent */}
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold ${emp.verified_percent === 100 ? 'text-emerald-700' : 'text-muted'}`}>
                              {emp.verified_percent}% Verified
                            </span>
                          </div>
                        </td>

                        {/* Pending Action Counter */}
                        <td>
                          {emp.pending_review_count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              {emp.pending_review_count} Review Needed
                            </span>
                          ) : emp.rejected_count > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              {emp.rejected_count} Rejected
                            </span>
                          ) : emp.onboarding_completion < 100 ? (
                            <span className="text-xs text-muted italic">Awaiting Docs</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                              <CheckCircle2 size={13} /> Complete
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                            >
                              Checklist
                            </Button>
                            <Link href={`/employees/${emp.id}`}>
                              <button className="p-1.5 rounded text-muted hover:text-navy hover:bg-surface transition-colors" title="View Full Profile">
                                <ArrowRight size={14} />
                              </button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Expanded Checklist Sub-Panel */}
            {expandedEmployeeId && (() => {
              const emp = filteredEmployees.find(e => e.id === expandedEmployeeId);
              if (!emp) return null;

              return (
                <div className="bg-surface/70 border-t border-border p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-navy flex items-center gap-2">
                        <FileCheck size={16} className="text-amber-700" />
                        Onboarding Checklist — {emp.full_name}
                      </h4>
                      <p className="text-xs text-muted">
                        Mandatory documents compliance status and verification panel
                      </p>
                    </div>
                    {emp.is_super_admin && (
                      <div className="bg-amber-50 text-amber-800 text-xs px-3 py-1 rounded border border-amber-200 flex items-center gap-1.5">
                        <ShieldCheck size={14} />
                        <span>Super Admin Document Protection Active</span>
                      </div>
                    )}
                  </div>

                  {/* Checklist Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {emp.checklist.map((item: { type: DocumentType; label: string; status: DocumentStatus; doc_id?: string | null }) => {
                      const badge = DOC_STATUS_BADGES[item.status] || DOC_STATUS_BADGES.missing;
                      const Icon = badge.icon;
                      const doc = emp.documents.find((d: EmployeeDocument) => d.document_type === item.type && d.is_current !== false);

                      return (
                        <div key={item.type} className="bg-white rounded-lg border border-border p-3.5 space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-navy truncate">{item.label}</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${badge.color}`}>
                              <Icon size={10} />
                              {badge.label}
                            </span>
                          </div>

                          {doc ? (
                            <div className="space-y-2 text-xs">
                              <p className="text-muted truncate text-[11px]" title={doc.original_name}>
                                📄 {doc.original_name}
                              </p>
                              <div className="flex items-center justify-between text-[11px] text-muted">
                                <span>Ver. {doc.version || 1}</span>
                                <span>{fmtDate(doc.created_at)}</span>
                              </div>

                              {doc.rejection_reason && (
                                <p className="text-[11px] text-red-600 bg-red-50 p-1.5 rounded border border-red-100">
                                  <strong>Reason:</strong> {doc.rejection_reason}
                                </p>
                              )}

                              {/* Action Buttons */}
                              <div className="pt-1 flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDownload(emp.id, doc.id, doc.original_name)}
                                  className="flex-1 py-1 px-2 rounded bg-surface hover:bg-border text-navy text-[11px] font-medium flex items-center justify-center gap-1"
                                >
                                  <Download size={11} /> Download
                                </button>
                                {isHR && item.status !== 'verified' && (!emp.is_super_admin || isSuperAdmin) && (
                                  <button
                                    onClick={() => setVerifyModal({ open: true, doc, emp })}
                                    className="flex-1 py-1 px-2 rounded bg-amber text-navy hover:bg-amber-600 text-[11px] font-bold flex items-center justify-center gap-1"
                                  >
                                    Verify / Reject
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="py-3 text-center space-y-1">
                              <p className="text-xs text-muted italic">Not Uploaded Yet</p>
                              <span className="text-[10px] text-red-500 font-medium">Mandatory</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Verification / Rejection Modal */}
      <Modal
        open={verifyModal.open}
        onClose={() => setVerifyModal({ open: false, doc: null, emp: null })}
        title={`Verify Document — ${verifyModal.doc?.document_name}`}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="bg-surface p-3 rounded text-xs space-y-1">
            <p><strong>Employee:</strong> {verifyModal.emp?.full_name}</p>
            <p><strong>Document:</strong> {verifyModal.doc?.original_name}</p>
            <p><strong>Version:</strong> {verifyModal.doc?.version || 1}</p>
          </div>

          {/* Action Choice */}
          <div className="flex gap-2">
            <button
              onClick={() => setActionType('verify')}
              className={`flex-1 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                actionType === 'verify'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                  : 'bg-white text-navy border-border hover:bg-surface'
              }`}
            >
              <CheckCircle2 size={14} /> Approve & Verify
            </button>
            <button
              onClick={() => setActionType('reject')}
              className={`flex-1 py-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                actionType === 'reject'
                  ? 'bg-red-600 text-white border-red-600 shadow'
                  : 'bg-white text-navy border-border hover:bg-surface'
              }`}
            >
              <XCircle size={14} /> Reject Document
            </button>
          </div>

          {/* Conditional Rejection Input */}
          {actionType === 'reject' && (
            <Input
              label="Rejection Reason *"
              placeholder="e.g. Image blur / PAN details illegible"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="text-xs"
            />
          )}

          {/* Remarks input */}
          <Input
            label="Internal Remarks / Notes (Optional)"
            placeholder="e.g. Verified with original physical card"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className="text-xs"
          />

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="secondary" onClick={() => setVerifyModal({ open: false, doc: null, emp: null })}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'verify' ? 'primary' : 'danger'}
              loading={verifyDoc.isPending}
              onClick={handleVerifySubmit}
            >
              {actionType === 'verify' ? 'Confirm Verification' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
