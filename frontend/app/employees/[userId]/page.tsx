'use strict';
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Select, Modal, Badge, PageLoader, EmptyState } from '@/components/ui';
import { fmtDate, fmtDateTime, timeAgo } from '@/lib/utils';
import {
  ArrowLeft, User as UserIcon, Briefcase, CreditCard, FileText, CheckCircle2,
  XCircle, Trash2, Download, ShieldCheck, AlertCircle, Edit2, Building2, Save,
  Clock, DollarSign, ListTodo, Zap, History, UserMinus, Check, X,
  AlertTriangle, Upload, Eye, RefreshCw, Send, Lock, Fingerprint, Cpu, Wifi
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import type {
  Employee, EmployeeDocument, DocumentType, DocumentStatus,
  EmploymentType, PayrollProfile, PayrollRecord, Task, DailyTask,
  AttendanceDay, BiometricPunchEvent, BiometricDevice
} from '@/types';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import BiometricEnrollmentModal from '@/components/biometric/BiometricEnrollmentModal';
import RawPunchTimelineModal from '@/components/biometric/RawPunchTimelineModal';

const MANDATORY_DOCS: { type: DocumentType; label: string; desc: string }[] = [
  { type: 'aadhaar_card', label: 'Aadhaar Card', desc: 'Government identity proof (Front & Back)' },
  { type: 'pan_card', label: 'PAN Card', desc: 'Permanent Account Number card' },
  { type: 'resume', label: 'Resume / CV', desc: 'Updated professional CV' },
  { type: 'bank_passbook', label: 'Bank Proof / Passbook', desc: 'Bank statement or cancelled cheque' },
  { type: 'photo', label: 'Photograph', desc: 'Passport size clear photo' },
];

const DOC_TYPE_OPTIONS = [
  ...MANDATORY_DOCS.map(d => ({ value: d.type, label: d.label })),
  { value: 'offer_letter' as DocumentType, label: 'Offer Letter' },
  { value: 'appointment_letter' as DocumentType, label: 'Appointment Letter' },
  { value: 'experience_letter' as DocumentType, label: 'Experience Letter' },
  { value: 'educational_certificate' as DocumentType, label: 'Educational Certificate' },
  { value: 'other' as DocumentType, label: 'Other Document' },
];

export default function EmployeeProfilePage() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const rawId = params.userId;
  const router = useRouter();
  const { user: currentUser } = useAuthStore();

  const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isHR = currentUser?.role === 'hr';
  const canManageHR = isSuperAdmin || isHR;

  // Tabs
  const defaultTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<'overview' | 'employment' | 'documents' | 'payroll' | 'tasks' | 'daily_tasks' | 'activity' | 'biometric'>(
    (defaultTab as any) || 'overview'
  );

  // Data states
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payrollProfile, setPayrollProfile] = useState<PayrollProfile | null>(null);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<any[]>([]);
  const [employeeAttendance, setEmployeeAttendance] = useState<AttendanceDay[]>([]);
  const [rawPunchModalDay, setRawPunchModalDay] = useState<AttendanceDay | null>(null);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);

  // Edit Profile / Employment Modal
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Document Upload Modal
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>('aadhaar_card');
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Document Verification / Rejection Modal
  const [verifyModal, setVerifyModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<EmployeeDocument | null>(null);
  const [verifyAction, setVerifyAction] = useState<'verify' | 'reject'>('verify');
  const [rejectionReason, setRejectionReason] = useState('');
  const [verifyingDoc, setVerifyingDoc] = useState(false);

  // Payroll Modals
  const [payrollProfileModal, setPayrollProfileModal] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    salary_type: 'monthly',
    basic_salary: 0,
    fixed_allowances: 0,
    fixed_deductions: 0,
    payment_method: 'bank_transfer',
    bank_name: '',
    bank_account_reference: '',
    bank_ifsc: '',
    pan_number: '',
  });
  const [savingPayroll, setSavingPayroll] = useState(false);

  const [addPayslipModal, setAddPayslipModal] = useState(false);
  const [payslipForm, setPayslipForm] = useState({
    payroll_month: new Date().toISOString().slice(0, 7),
    gross_amount: 0,
    allowances: 0,
    deductions: 0,
    payment_status: 'draft',
    remarks: '',
  });
  const [creatingPayslip, setCreatingPayslip] = useState(false);

  // Offboarding Modal
  const [offboardModal, setOffboardModal] = useState(false);
  const [exitReason, setExitReason] = useState('resigned');
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [offboarding, setOffboarding] = useState(false);

  // Fetch Employee Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Employee Profile
      const empRes = await api.get(`/employees/${rawId}`);
      const empData = empRes.data?.data?.employee;
      if (!empData) throw new Error('Employee not found');
      setEmployee(empData);

      const targetEmpId = empData.id;
      const targetUserId = empData.user_id;

      // 2. Fetch Payroll Data (if authorized)
      const isSelf = currentUser?.id === targetUserId;
      if (canManageHR || isSelf) {
        try {
          const [pProfRes, pHistRes] = await Promise.all([
            api.get(`/payroll/profile/${targetEmpId}`),
            api.get(`/payroll/history/${targetEmpId}`),
          ]);
          setPayrollProfile(pProfRes.data?.data?.profile || null);
          setPayrollHistory(pHistRes.data?.data?.records || []);
        } catch {}
      }

      // 3. Fetch Tasks (Assignee / Admin)
      if (targetUserId) {
        try {
          const tRes = await api.get('/tasks', { params: { assigned_to: targetUserId } });
          setTasks(tRes.data?.data?.tasks || tRes.data?.data || []);
        } catch {}

        try {
          const dtRes = await api.get('/daily-activities', { params: { assigned_to: targetUserId } });
          setDailyTasks(dtRes.data?.data?.activities || dtRes.data?.data?.dailyTasks || dtRes.data?.data || []);
        } catch {}
      }

      // 4. Fetch Activity Timeline
      try {
        const actRes = await api.get(`/employee-audit/${targetEmpId}/activity`);
        setActivityTimeline(actRes.data?.data?.timeline || []);
      } catch {}

      // 5. Fetch Biometric & Attendance History
      try {
        const attRes = await api.get(`/hr/attendance/employee/${targetEmpId}`);
        setEmployeeAttendance(attRes.data?.data?.history || []);
      } catch {}
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load employee profile.');
    } finally {
      setLoading(false);
    }
  }, [rawId, canManageHR, currentUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Edit Modal
  const openEditModal = () => {
    if (!employee) return;
    setEditForm({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      phone: employee.phone || '',
      department: employee.department || '',
      designation: employee.designation || '',
      employment_type: employee.employment_type || 'full_time',
      date_of_joining: employee.date_of_joining || '',
      probation_end_date: employee.probation_end_date || '',
      confirmation_date: employee.confirmation_date || '',
      work_location: (employee as any).work_location || '',
      reporting_manager: employee.reporting_manager || '',
      bank_name: (employee as any).bank_name || '',
      bank_account_number: (employee as any).bank_account_number || '',
      bank_ifsc: (employee as any).bank_ifsc || '',
      pan_number: (employee as any).pan_number || '',
      notes: (employee as any).notes || '',
    });
    setEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setSavingEdit(true);
    try {
      await api.patch(`/employees/${employee.id}`, editForm);
      toast.success('Employee profile updated successfully!');
      setEditModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Document Upload
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !uploadFile) return toast.error('Please select a file to upload.');

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('document_type', uploadType);
    formData.append('document_name', uploadName.trim() || uploadFile.name);

    try {
      await api.post(`/employees/${employee.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document uploaded successfully!');
      setUploadModal(false);
      setUploadFile(null);
      setUploadName('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  // Document Verify / Reject
  const handleVerifyDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;

    if (verifyAction === 'reject' && !rejectionReason.trim()) {
      return toast.error('Please provide a reason for rejecting the document.');
    }

    setVerifyingDoc(true);
    try {
      await api.patch(`/employees/documents/${selectedDoc.id}/verify`, {
        action: verifyAction,
        rejection_reason: verifyAction === 'reject' ? rejectionReason.trim() : null,
      });
      toast.success(`Document marked as ${verifyAction === 'verify' ? 'Verified' : 'Rejected'}.`);
      setVerifyModal(false);
      setSelectedDoc(null);
      setRejectionReason('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification failed.');
    } finally {
      setVerifyingDoc(false);
    }
  };

  // Save Payroll Profile
  const handleSavePayrollProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setSavingPayroll(true);
    try {
      await api.post(`/payroll/profile/${employee.id}`, payrollForm);
      toast.success('Payroll profile saved successfully!');
      setPayrollProfileModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update payroll profile.');
    } finally {
      setSavingPayroll(false);
    }
  };

  // Add Monthly Payslip
  const handleAddPayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setCreatingPayslip(true);
    try {
      await api.post('/payroll/records', {
        employee_id: employee.id,
        payroll_month: payslipForm.payroll_month,
        gross_amount: payslipForm.gross_amount,
        allowances: payslipForm.allowances,
        deductions: payslipForm.deductions,
        payment_status: payslipForm.payment_status,
        remarks: payslipForm.remarks,
      });
      toast.success('Monthly payroll record generated!');
      setAddPayslipModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create payroll record.');
    } finally {
      setCreatingPayslip(false);
    }
  };

  // Offboarding action
  const handleOffboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setOffboarding(true);
    try {
      await api.post(`/employees/${employee.id}/offboard`, {
        exit_reason: exitReason,
        exit_date: exitDate,
        handover_notes: handoverNotes,
      });
      toast.success('Employee offboarded successfully. User account disabled.');
      setOffboardModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Offboarding failed.');
    } finally {
      setOffboarding(false);
    }
  };

  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [deletingEmployee, setDeletingEmployee] = useState(false);

  const handleDeleteEmployee = async () => {
    if (!employee) return;
    setDeletingEmployee(true);
    try {
      await api.delete(`/employees/${employee.id}`);
      toast.success(`Employee ${employee.first_name} ${employee.last_name} deleted successfully.`);
      router.push('/employees');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete employee.');
      setDeletingEmployee(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-16 flex justify-center">
          <PageLoader />
        </div>
      </AppShell>
    );
  }

  if (!employee) {
    return (
      <AppShell>
        <div className="p-12">
          <EmptyState
            title="Employee Not Found"
            description="The requested employee record does not exist or has been removed."
            action={
              <Link href="/employees">
                <Button variant="primary">Back to Directory</Button>
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  const docs = (employee as any).documents || [];
  const onboardingProgress = (employee as any).onboarding_progress;

  return (
    <AppShell>
      <Topbar
        title={`${employee.first_name} ${employee.last_name}`}
        subtitle={`${employee.designation || 'Staff'} • ${employee.department || 'General'} • ${employee.employee_code || 'KR-EMP'}`}
      />

      <main className="flex-1 overflow-y-auto p-6 w-full">
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
          {/* Header Navigation & Quick Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 border border-gray-200 rounded-3xl shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/employees">
              <button className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
              {employee.first_name.charAt(0)}{employee.last_name.charAt(0)}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">
                  {employee.first_name} {employee.last_name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    employee.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : employee.status === 'terminated'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {employee.status}
                </span>
                {employee.onboarding_status && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                    Onboarding: {employee.onboarding_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                <span>{employee.email || 'No email provided'}</span>
                <span>•</span>
                <span>{employee.phone || 'No phone provided'}</span>
                <span>•</span>
                <span className="font-mono">{employee.employee_code || 'KR-EMP'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {canManageHR && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openEditModal}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                </Button>

                {employee.status !== 'terminated' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setOffboardModal(true)}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Offboard Employee
                  </Button>
                )}

                {isSuperAdmin && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteConfirmModal(true)}
                    className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white border-0 shadow-sm"
                    title="Permanently Delete Employee (Super Admin Only)"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Employee
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Onboarding Progress Alert (if not completed) */}
        {employee.status === 'active' && employee.onboarding_status !== 'completed' && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-900">
                  Onboarding Checklist ({onboardingProgress?.completion_percent || 0}% Complete)
                </h4>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  {onboardingProgress?.missing_docs?.length
                    ? `Missing: ${onboardingProgress.missing_docs.join(', ')}`
                    : 'All mandatory documents submitted. Pending HR review.'}
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveTab('documents')}
              className="text-xs bg-blue-600 hover:bg-blue-700"
            >
              Complete Documents
            </Button>
          </div>
        )}

        {/* 7-Tab Navigation Bar */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'overview' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" /> 1. Overview
          </button>

          <button
            onClick={() => setActiveTab('employment')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'employment' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> 2. Employment
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'documents' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> 3. Documents
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 text-[10px]">
              {docs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'payroll' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> 4. Payroll
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'tasks' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" /> 5. Tasks
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 text-[10px]">
              {tasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('daily_tasks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'daily_tasks' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> 6. Daily Activities
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-700 text-[10px]">
              {dailyTasks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'activity' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="w-3.5 h-3.5" /> 7. Activity
          </button>

          <button
            onClick={() => setActiveTab('biometric')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === 'biometric' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-indigo-600" /> 8. Biometric & Attendance
          </button>
        </div>

        {/* ─── TAB 1: OVERVIEW ────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Metrics */}
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
                <span className="text-xs text-gray-500 font-semibold">Department</span>
                <p className="text-base font-bold text-gray-900 mt-1">{employee.department || 'General'}</p>
              </div>
              <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
                <span className="text-xs text-gray-500 font-semibold">Designation</span>
                <p className="text-base font-bold text-gray-900 mt-1">{employee.designation || 'Staff'}</p>
              </div>
              <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
                <span className="text-xs text-gray-500 font-semibold">Date of Joining</span>
                <p className="text-base font-bold text-gray-900 mt-1">
                  {employee.date_of_joining ? fmtDate(employee.date_of_joining) : '—'}
                </p>
              </div>
              <div className="bg-white p-4 border border-gray-200 rounded-2xl shadow-sm text-center">
                <span className="text-xs text-gray-500 font-semibold">Profile Completeness</span>
                <p className="text-base font-bold text-emerald-600 mt-1">{employee.completeness || 0}%</p>
              </div>
            </div>

            {/* Personal Details */}
            <div className="md:col-span-2 bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-blue-600" /> Personal & Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 font-medium">Full Name</span>
                  <p className="text-gray-800 font-bold mt-0.5">{employee.first_name} {employee.last_name}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Official Email</span>
                  <p className="text-gray-800 font-bold mt-0.5">{employee.email || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Phone Number</span>
                  <p className="text-gray-800 font-bold mt-0.5">{employee.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Employee Code</span>
                  <p className="text-gray-800 font-bold font-mono mt-0.5">{employee.employee_code || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Reporting Manager</span>
                  <p className="text-gray-800 font-bold mt-0.5">{employee.reporting_manager || 'None'}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-medium">Work Location</span>
                  <p className="text-gray-800 font-bold mt-0.5">{(employee as any).work_location || 'Headquarters'}</p>
                </div>
              </div>
            </div>

            {/* Employment Status Summary */}
            <div className="bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" /> Employment Lifecycle
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Status</span>
                  <span className="font-bold uppercase text-gray-800">{employee.status}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Employment Type</span>
                  <span className="font-bold uppercase text-gray-800">{employee.employment_type?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Joining Date</span>
                  <span className="font-bold text-gray-800">{employee.date_of_joining ? fmtDate(employee.date_of_joining) : '—'}</span>
                </div>
                {employee.exit_date && (
                  <div className="flex justify-between py-1.5 border-b border-gray-100 text-red-600">
                    <span>Exit Date</span>
                    <span className="font-bold">{fmtDate(employee.exit_date)}</span>
                  </div>
                )}
                {employee.exit_reason && (
                  <div className="p-2.5 bg-red-50 rounded-xl text-red-800 text-[11px]">
                    <span className="font-bold">Exit Reason: </span>{employee.exit_reason}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: EMPLOYMENT ──────────────────────────────────────────── */}
        {activeTab === 'employment' && (
          <div className="bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-600" /> Employment & Job Contract
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Contractual dates, designation, work location, and managerial hierarchy.
                </p>
              </div>
              {canManageHR && (
                <Button variant="secondary" size="sm" onClick={openEditModal} className="text-xs">
                  <Edit2 className="w-3.5 h-3.5" /> Edit Details
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div>
                <span className="text-gray-400 font-medium">Employment Type</span>
                <p className="text-gray-900 font-bold mt-1 uppercase text-sm">
                  {employee.employment_type?.replace(/_/g, ' ') || 'Full Time'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Date of Joining</span>
                <p className="text-gray-900 font-bold mt-1 text-sm">
                  {employee.date_of_joining ? fmtDate(employee.date_of_joining) : 'Not specified'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Probation End Date</span>
                <p className="text-gray-900 font-bold mt-1 text-sm">
                  {employee.probation_end_date ? fmtDate(employee.probation_end_date) : '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Confirmation Date</span>
                <p className="text-gray-900 font-bold mt-1 text-sm">
                  {employee.confirmation_date ? fmtDate(employee.confirmation_date) : '—'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Work Location</span>
                <p className="text-gray-900 font-bold mt-1 text-sm">
                  {(employee as any).work_location || 'Headquarters'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 font-medium">Reporting Manager</span>
                <p className="text-gray-900 font-bold mt-1 text-sm">
                  {employee.reporting_manager || 'None'}
                </p>
              </div>

              {employee.exit_date && (
                <>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 col-span-full space-y-2">
                    <div className="text-red-900 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" /> Offboarding & Exit Records
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-red-800">
                      <div>
                        <span className="font-semibold">Exit Date: </span>
                        {fmtDate(employee.exit_date)}
                      </div>
                      <div>
                        <span className="font-semibold">Exit Reason: </span>
                        {employee.exit_reason || 'Resigned'}
                      </div>
                      {employee.handover_notes && (
                        <div className="col-span-full">
                          <span className="font-semibold">Handover Notes: </span>
                          {employee.handover_notes}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: DOCUMENTS ───────────────────────────────────────────── */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-5 border border-gray-200 rounded-3xl shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" /> Mandatory Employee Document Checklist
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Aadhaar, PAN, Resume, Bank Proof, and Photograph verification records.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setUploadModal(true)}
                className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Document
              </Button>
            </div>

            {/* Mandatory 5 Docs Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MANDATORY_DOCS.map((reqDoc) => {
                const uploadedDoc = docs.find((d: EmployeeDocument) => d.document_type === reqDoc.type);
                const status = uploadedDoc ? uploadedDoc.status : 'missing';

                return (
                  <div
                    key={reqDoc.type}
                    className={`bg-white p-5 border rounded-3xl shadow-sm transition-all space-y-3 ${
                      status === 'verified'
                        ? 'border-emerald-200 bg-emerald-50/10'
                        : status === 'under_review' || status === 'uploaded'
                        ? 'border-blue-200 bg-blue-50/10'
                        : status === 'rejected'
                        ? 'border-red-200 bg-red-50/10'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{reqDoc.label}</h4>
                        <p className="text-[11px] text-gray-400 mt-0.5">{reqDoc.desc}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          status === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : status === 'under_review' || status === 'uploaded'
                            ? 'bg-blue-100 text-blue-800'
                            : status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    {uploadedDoc ? (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-mono text-[11px] truncate max-w-[140px]" title={uploadedDoc.original_name}>
                          {uploadedDoc.original_name}
                        </span>

                        <div className="flex items-center gap-1">
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/employees/${employee.id}/documents/${uploadedDoc.id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Download Document"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {canManageHR && (
                            <button
                              onClick={() => {
                                setSelectedDoc(uploadedDoc);
                                setVerifyModal(true);
                              }}
                              className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Review / Verify"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setUploadType(reqDoc.type);
                            setUploadModal(true);
                          }}
                          className="w-full text-center py-1.5 rounded-xl border border-dashed border-gray-300 hover:border-purple-500 text-purple-600 text-xs font-semibold hover:bg-purple-50/50 transition-colors"
                        >
                          + Upload {reqDoc.label}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB 4: PAYROLL (CONFIDENTIAL) ──────────────────────────────── */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            {!payrollProfile && !canManageHR ? (
              <div className="p-12 text-center bg-white border border-gray-200 rounded-3xl shadow-sm">
                <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-gray-900">Payroll Information is Confidential</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Compensation structures and monthly payroll slips can only be accessed by authorized HR administrators or the account holder.
                </p>
              </div>
            ) : (
              <>
                {/* Compensation Structure Card */}
                <div className="bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" /> Employee Compensation Profile
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Base salary, fixed allowances, deductions, and payout reference.
                      </p>
                    </div>

                    {canManageHR && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPayrollForm({
                            salary_type: payrollProfile?.salary_type || 'monthly',
                            basic_salary: payrollProfile?.basic_salary || 0,
                            fixed_allowances: payrollProfile?.fixed_allowances || 0,
                            fixed_deductions: payrollProfile?.fixed_deductions || 0,
                            payment_method: payrollProfile?.payment_method || 'bank_transfer',
                            bank_name: payrollProfile?.bank_name || (employee as any).bank_name || '',
                            bank_account_reference: payrollProfile?.bank_account_reference || (employee as any).bank_account_number || '',
                            bank_ifsc: payrollProfile?.bank_ifsc || (employee as any).bank_ifsc || '',
                            pan_number: payrollProfile?.pan_number || (employee as any).pan_number || '',
                          });
                          setPayrollProfileModal(true);
                        }}
                        className="text-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit Compensation
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                      <span className="text-[11px] text-gray-500 font-semibold">Basic Salary</span>
                      <p className="text-base font-bold text-gray-900 mt-1">
                        ₹{(payrollProfile?.basic_salary || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                      <span className="text-[11px] text-emerald-700 font-semibold">Fixed Allowances</span>
                      <p className="text-base font-bold text-emerald-700 mt-1">
                        + ₹{(payrollProfile?.fixed_allowances || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl">
                      <span className="text-[11px] text-red-700 font-semibold">Fixed Deductions</span>
                      <p className="text-base font-bold text-red-700 mt-1">
                        - ₹{(payrollProfile?.fixed_deductions || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                      <span className="text-[11px] text-blue-700 font-semibold">Net Payable Reference</span>
                      <p className="text-base font-bold text-blue-700 mt-1">
                        ₹{(payrollProfile?.net_payable_reference || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Monthly Payroll History */}
                <div className="bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-600" /> Monthly Payroll History
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Chronological payslips and disbursement records.</p>
                    </div>

                    {canManageHR && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setPayslipForm({
                            payroll_month: new Date().toISOString().slice(0, 7),
                            gross_amount: (payrollProfile?.basic_salary || 0) + (payrollProfile?.fixed_allowances || 0),
                            allowances: payrollProfile?.fixed_allowances || 0,
                            deductions: payrollProfile?.fixed_deductions || 0,
                            payment_status: 'draft',
                            remarks: '',
                          });
                          setAddPayslipModal(true);
                        }}
                        className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                      >
                        + Generate Payslip
                      </Button>
                    )}
                  </div>

                  {payrollHistory.length === 0 ? (
                    <EmptyState
                      title="No Payroll Records"
                      description="Monthly payslips generated for this employee will appear here."
                    />
                  ) : (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-200">
                          <tr>
                            <th className="p-3.5">Payroll Month</th>
                            <th className="p-3.5">Gross Amount</th>
                            <th className="p-3.5">Allowances</th>
                            <th className="p-3.5">Deductions</th>
                            <th className="p-3.5">Net Amount</th>
                            <th className="p-3.5">Payment Status</th>
                            <th className="p-3.5">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {payrollHistory.map((rec) => (
                            <tr key={rec.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="p-3.5 font-bold font-mono text-gray-900">{rec.payroll_month}</td>
                              <td className="p-3.5">₹{(rec.gross_amount || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-emerald-600">+₹{(rec.allowances || 0).toLocaleString()}</td>
                              <td className="p-3.5 text-red-600">-₹{(rec.deductions || 0).toLocaleString()}</td>
                              <td className="p-3.5 font-bold text-gray-900">₹{(rec.net_amount || 0).toLocaleString()}</td>
                              <td className="p-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    rec.payment_status === 'processed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : rec.payment_status === 'approved'
                                      ? 'bg-blue-100 text-blue-800'
                                      : rec.payment_status === 'cancelled'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {rec.payment_status}
                                </span>
                              </td>
                              <td className="p-3.5 text-gray-500">{rec.remarks || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── TAB 5: TASKS (ASSIGNEE PRIVACY) ────────────────────────────── */}
        {activeTab === 'tasks' && (
          <div className="bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-amber-600" /> Assigned Operational Tasks
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Tasks assigned directly to this employee.</p>
            </div>

            {tasks.length === 0 ? (
              <EmptyState title="No Tasks Assigned" description="Active and historical task assignments will appear here." />
            ) : (
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3.5">Title</th>
                      <th className="p-3.5">Priority</th>
                      <th className="p-3.5">Due Date</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="p-3.5 font-semibold text-gray-900">{t.title}</td>
                        <td className="p-3.5 font-bold uppercase text-[10px]">{t.priority}</td>
                        <td className="p-3.5 text-gray-500">{t.due_date ? fmtDate(t.due_date) : '—'}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold uppercase">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 6: DAILY ACTIVITIES (ASSIGNEE PRIVACY) ────────────────── */}
        {activeTab === 'daily_tasks' && (
          <div className="bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-teal-600" /> Daily Operational Activities
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">24-hour shift-based activity assignments and execution logs.</p>
            </div>

            {dailyTasks.length === 0 ? (
              <EmptyState title="No Daily Activities" description="Daily activities assigned to this employee will appear here." />
            ) : (
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3.5">Activity Title & Description</th>
                      <th className="p-3.5">Assigned At</th>
                      <th className="p-3.5">Execution Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyTasks.map((dt) => (
                      <tr key={dt.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="p-3.5 font-semibold text-gray-900">
                          <div>{dt.title || (dt as any).task_description}</div>
                          {dt.description && <div className="text-[11px] text-gray-500 font-normal mt-0.5">{dt.description}</div>}
                        </td>
                        <td className="p-3.5 text-gray-500">{fmtDateTime(dt.assigned_at || (dt as any).created_at)}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              dt.status === 'COMPLETED'
                                ? 'bg-teal-50 text-teal-700'
                                : dt.status === 'IN_PROGRESS'
                                ? 'bg-purple-50 text-purple-700'
                                : dt.status === 'INCOMPLETE'
                                ? 'bg-rose-50 text-rose-700'
                                : dt.status === 'LATE'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {dt.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 7: ACTIVITY (CHRONOLOGICAL TIMELINE) ───────────────────── */}
        {activeTab === 'activity' && (
          <div className="bg-white p-6 border border-gray-200 rounded-3xl shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-rose-600" /> Employee Activity & Audit Timeline
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Chronological record of actions performed across the CRM.</p>
            </div>

            {activityTimeline.length === 0 ? (
              <EmptyState title="No Activity Recorded" description="CRM actions performed by this employee will appear here." />
            ) : (
              <div className="relative pl-6 border-l-2 border-gray-200 space-y-6 my-4">
                {activityTimeline.map((act, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                          {act.action?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {fmtDateTime(act.created_at || act.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{act.description || act.entity_type || 'CRM Activity'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 8: BIOMETRIC & ATTENDANCE ──────────────────────────────── */}
        {activeTab === 'biometric' && (
          <div className="space-y-6">
            {/* Biometric Device & Enrollment Card */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 text-amber flex items-center justify-center border border-white/20 shadow-inner">
                  <Fingerprint size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">BioMax Hardware Terminal Link</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        employee.biometricMapping?.enrollment_status === 'enrolled'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {employee.biometricMapping?.enrollment_status || 'Not Enrolled'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Employee Code: <code className="font-mono text-amber font-bold">{employee.employee_code || 'KR-EMP'}</code> • SmartOffice ID: <code>{employee.biometricMapping?.smartoffice_employee_code || '—'}</code>
                  </p>
                </div>
              </div>

              {canManageHR && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setEnrollModalOpen(true)}
                    className="bg-amber hover:bg-amber-500 text-slate-900 font-bold text-xs shadow-lg"
                  >
                    <Cpu size={14} className="mr-1.5" /> Manage Biometric Sync
                  </Button>
                </div>
              )}
            </div>

            {/* Attendance History */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" /> Attendance Roster & Punch Timeline
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Calculated daily records, break segments, and raw BioMax verification stamps.</p>
                </div>
                <Button variant="secondary" size="xs" onClick={fetchData} className="text-xs">
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh Records
                </Button>
              </div>

              {employeeAttendance.length === 0 ? (
                <EmptyState
                  title="No Attendance History"
                  description="No clock-in or biometric punches logged for this employee yet."
                />
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                      <tr>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">First IN</th>
                        <th className="p-3.5">Last OUT</th>
                        <th className="p-3.5">Work Hours</th>
                        <th className="p-3.5">Late By</th>
                        <th className="p-3.5">Source</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Punches</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employeeAttendance.map((att) => (
                        <tr key={att.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="p-3.5 font-semibold text-gray-900">{att.date}</td>
                          <td className="p-3.5 font-mono text-emerald-700 font-semibold">{att.clock_in ? att.clock_in.slice(0, 5) : '—'}</td>
                          <td className="p-3.5 font-mono text-slate-700 font-semibold">{att.clock_out ? att.clock_out.slice(0, 5) : '—'}</td>
                          <td className="p-3.5 font-mono text-gray-600">{att.work_hours} hrs</td>
                          <td className="p-3.5">
                            {att.late_minutes && att.late_minutes > 0 ? (
                              <span className="text-amber-700 font-semibold font-mono text-[11px]">+{att.late_minutes}m</span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">On Time</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 border border-gray-200">
                              {att.source === 'BIOMETRIC' ? <Cpu size={10} className="text-indigo-600" /> : <Clock size={10} className="text-amber-600" />}
                              {att.source}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                att.status === 'PRESENT'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : att.status === 'LATE'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : att.status === 'INCOMPLETE'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {att.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => setRawPunchModalDay(att)}
                              className="text-[10px]"
                            >
                              <Eye size={11} className="mr-1" /> View Raw
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* ─── MODALS ────────────────────────────────────────────────────────── */}

      {/* Edit Profile Modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Employee Information"
        size="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name *"
              value={editForm.first_name || ''}
              onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
              required
            />
            <Input
              label="Last Name *"
              value={editForm.last_name || ''}
              onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
              required
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={editForm.phone || ''}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <Input
              label="Department"
              value={editForm.department || ''}
              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            />
            <Input
              label="Designation"
              value={editForm.designation || ''}
              onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
            />
            <Select
              label="Employment Type"
              value={editForm.employment_type || 'full_time'}
              onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })}
              options={[
                { value: 'full_time', label: 'Full Time' },
                { value: 'part_time', label: 'Part Time' },
                { value: 'contract', label: 'Contract' },
                { value: 'intern', label: 'Intern' },
              ]}
            />
            <Input
              label="Date of Joining"
              type="date"
              value={editForm.date_of_joining || ''}
              onChange={(e) => setEditForm({ ...editForm, date_of_joining: e.target.value })}
            />
            <Input
              label="Probation End Date"
              type="date"
              value={editForm.probation_end_date || ''}
              onChange={(e) => setEditForm({ ...editForm, probation_end_date: e.target.value })}
            />
            <Input
              label="Confirmation Date"
              type="date"
              value={editForm.confirmation_date || ''}
              onChange={(e) => setEditForm({ ...editForm, confirmation_date: e.target.value })}
            />
            <Input
              label="Work Location"
              value={editForm.work_location || ''}
              onChange={(e) => setEditForm({ ...editForm, work_location: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={savingEdit}>
              <Save className="w-4 h-4" /> Save Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* Document Upload Modal */}
      <Modal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        title="Upload Employee Document"
        size="md"
      >
        <form onSubmit={handleUploadDoc} className="space-y-4">
          <Select
            label="Document Category *"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as DocumentType)}
            options={DOC_TYPE_OPTIONS}
          />
          <Input
            label="Document Title"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="e.g. Aadhaar Card copy 2026"
          />
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Select File *</label>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setUploadModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={uploading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4" /> Upload Document
            </Button>
          </div>
        </form>
      </Modal>

      {/* Document Verify / Reject Modal */}
      <Modal
        open={verifyModal}
        onClose={() => setVerifyModal(false)}
        title={`Review Document: ${selectedDoc?.document_name}`}
        size="md"
      >
        <form onSubmit={handleVerifyDoc} className="space-y-4">
          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1">
            <p><strong>Type: </strong>{selectedDoc?.document_type}</p>
            <p><strong>Filename: </strong>{selectedDoc?.original_name}</p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="radio"
                name="action"
                value="verify"
                checked={verifyAction === 'verify'}
                onChange={() => setVerifyAction('verify')}
                className="text-emerald-600"
              />
              <span className="text-emerald-700 font-bold">Approve & Verify</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="radio"
                name="action"
                value="reject"
                checked={verifyAction === 'reject'}
                onChange={() => setVerifyAction('reject')}
                className="text-red-600"
              />
              <span className="text-red-700 font-bold">Reject Document</span>
            </label>
          </div>

          {verifyAction === 'reject' && (
            <Input
              label="Rejection Reason *"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Blurry photo, expired document"
              required
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setVerifyModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={verifyAction === 'verify' ? 'primary' : 'danger'}
              size="sm"
              loading={verifyingDoc}
            >
              {verifyAction === 'verify' ? 'Confirm Verification' : 'Reject Document'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Payroll Profile Modal */}
      <Modal
        open={payrollProfileModal}
        onClose={() => setPayrollProfileModal(false)}
        title="Configure Employee Compensation"
        size="lg"
      >
        <form onSubmit={handleSavePayrollProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Basic Salary (₹) *"
              type="number"
              value={payrollForm.basic_salary}
              onChange={(e) => setPayrollForm({ ...payrollForm, basic_salary: parseFloat(e.target.value) || 0 })}
              required
            />
            <Input
              label="Fixed Allowances (₹)"
              type="number"
              value={payrollForm.fixed_allowances}
              onChange={(e) => setPayrollForm({ ...payrollForm, fixed_allowances: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Fixed Deductions (₹)"
              type="number"
              value={payrollForm.fixed_deductions}
              onChange={(e) => setPayrollForm({ ...payrollForm, fixed_deductions: parseFloat(e.target.value) || 0 })}
            />
            <Select
              label="Payment Method"
              value={payrollForm.payment_method}
              onChange={(e) => setPayrollForm({ ...payrollForm, payment_method: e.target.value })}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS)' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'cash', label: 'Cash' },
                { value: 'upi', label: 'UPI' },
              ]}
            />
            <Input
              label="Bank Name"
              value={payrollForm.bank_name}
              onChange={(e) => setPayrollForm({ ...payrollForm, bank_name: e.target.value })}
            />
            <Input
              label="Bank Account Number"
              value={payrollForm.bank_account_reference}
              onChange={(e) => setPayrollForm({ ...payrollForm, bank_account_reference: e.target.value })}
            />
            <Input
              label="Bank IFSC Code"
              value={payrollForm.bank_ifsc}
              onChange={(e) => setPayrollForm({ ...payrollForm, bank_ifsc: e.target.value })}
            />
            <Input
              label="PAN Number"
              value={payrollForm.pan_number}
              onChange={(e) => setPayrollForm({ ...payrollForm, pan_number: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPayrollProfileModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={savingPayroll}>
              <Save className="w-4 h-4" /> Save Compensation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Payslip Record Modal */}
      <Modal
        open={addPayslipModal}
        onClose={() => setAddPayslipModal(false)}
        title="Generate Monthly Payslip"
        size="md"
      >
        <form onSubmit={handleAddPayslip} className="space-y-4">
          <Input
            label="Payroll Month (YYYY-MM) *"
            type="month"
            value={payslipForm.payroll_month}
            onChange={(e) => setPayslipForm({ ...payslipForm, payroll_month: e.target.value })}
            required
          />
          <Input
            label="Gross Amount (₹) *"
            type="number"
            value={payslipForm.gross_amount}
            onChange={(e) => setPayslipForm({ ...payslipForm, gross_amount: parseFloat(e.target.value) || 0 })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Allowances (₹)"
              type="number"
              value={payslipForm.allowances}
              onChange={(e) => setPayslipForm({ ...payslipForm, allowances: parseFloat(e.target.value) || 0 })}
            />
            <Input
              label="Deductions (₹)"
              type="number"
              value={payslipForm.deductions}
              onChange={(e) => setPayslipForm({ ...payslipForm, deductions: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <Select
            label="Payment Status"
            value={payslipForm.payment_status}
            onChange={(e) => setPayslipForm({ ...payslipForm, payment_status: e.target.value })}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'approved', label: 'Approved' },
              { value: 'processed', label: 'Processed (Paid)' },
            ]}
          />
          <Input
            label="Remarks"
            value={payslipForm.remarks}
            onChange={(e) => setPayslipForm({ ...payslipForm, remarks: e.target.value })}
            placeholder="e.g. Regular monthly payout"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddPayslipModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={creatingPayslip}>
              Generate Payslip
            </Button>
          </div>
        </form>
      </Modal>

      {/* Offboarding Confirmation Modal */}
      <Modal
        open={offboardModal}
        onClose={() => setOffboardModal(false)}
        title="Initiate Employee Offboarding"
        size="md"
      >
        <form onSubmit={handleOffboard} className="space-y-4">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Soft Offboarding Notice</span>
            </div>
            <p>
              Offboarding will mark <strong>{employee.first_name} {employee.last_name}</strong> as terminated, disable their CRM user account, and revoke all active login sessions.
            </p>
            <p className="text-[11px] text-red-700">
              ✓ All historical orders, warranties, and audit logs will be permanently preserved.
            </p>
          </div>

          <Select
            label="Exit Reason *"
            value={exitReason}
            onChange={(e) => setExitReason(e.target.value)}
            options={[
              { value: 'resigned', label: 'Resigned' },
              { value: 'terminated', label: 'Terminated' },
              { value: 'contract_ended', label: 'Contract Ended' },
              { value: 'other', label: 'Other' },
            ]}
          />

          <Input
            label="Last Working Date *"
            type="date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
            required
          />

          <Input
            label="Handover Notes / Summary"
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            placeholder="Details of client, asset, and key handover"
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOffboardModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={offboarding}>
              <UserMinus className="w-4 h-4" /> Confirm Offboarding
            </Button>
          </div>
        </form>
      </Modal>

      {/* Biometric Enrollment Modal */}
      <BiometricEnrollmentModal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        employee={employee}
        onEnrollmentSuccess={fetchData}
      />

      {/* Raw Punch Timeline Modal */}
      <RawPunchTimelineModal
        isOpen={Boolean(rawPunchModalDay)}
        onClose={() => setRawPunchModalDay(null)}
        attendanceDay={rawPunchModalDay}
      />

      {/* Delete Employee Confirmation Modal (Super Admin Only) */}
      <Modal
        open={deleteConfirmModal}
        onClose={() => !deletingEmployee && setDeleteConfirmModal(false)}
        title="Delete Employee Record"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-red-900">This action is permanent and restricted to Super Admin.</p>
              <p>
                Deleting will remove employee <span className="font-bold">{employee.first_name} {employee.last_name}</span> ({employee.employee_code || 'No Code'}), including linked onboarding documents and payroll profiles.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={deletingEmployee}
              onClick={() => setDeleteConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deletingEmployee}
              onClick={handleDeleteEmployee}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingEmployee ? 'Deleting...' : 'Confirm Delete Employee'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
