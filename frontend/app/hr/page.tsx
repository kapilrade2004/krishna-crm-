'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Badge, PageLoader, Select } from '@/components/ui';
import { fmtDate } from '@/lib/utils';
import {
  Users, Clock, DollarSign, CheckCircle, ShieldCheck, UserCheck, Calculator,
  Briefcase, Edit3, Save, Plus, Search, ChevronRight, Building2, UserPlus,
  RefreshCw, AlertCircle, FileCheck, Cpu, Fingerprint, Wifi, AlertTriangle,
  Settings2, ArrowDownRight, ArrowUpRight, History, Calendar, CheckCircle2,
  Lock, Eye, Edit2, Play, Usb, ArrowLeft, Download, Printer, FileText, FileSpreadsheet
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth';
import type {
  Employee,
  EmploymentType,
  AttendanceDay,
  BiometricDevice,
  AttendanceSummaryMetrics,
  IntegrationSyncState
} from '@/types';

// Biometric Modals
import DeviceManagementModal from '@/components/biometric/DeviceManagementModal';
import BiometricEnrollmentModal from '@/components/biometric/BiometricEnrollmentModal';
import RawPunchTimelineModal from '@/components/biometric/RawPunchTimelineModal';
import AttendanceCorrectionModal from '@/components/biometric/AttendanceCorrectionModal';
import ShiftConfigModal from '@/components/biometric/ShiftConfigModal';
import UploadUSBLogsModal from '@/components/biometric/UploadUSBLogsModal';
import SmartOfficeSyncModal from '@/components/biometric/SmartOfficeSyncModal';

interface PayrollRecord {
  employee_id: string;
  employee_code?: string;
  employee_name: string;
  role: string;
  department: string;
  base_salary: number;
  basic: number;
  hra: number;
  conveyance: number;
  special_allowance: number;
  overtime_addition: number;
  unpaid_absence_deduction: number;
  late_penalty_deduction: number;
  pf: number;
  esi: number;
  tds: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  attendance_summary?: any;
}

interface Policy {
  id: string;
  title: string;
  category: string;
  published_date: string;
  status: string;
  file_url: string;
}

const initialEmployeeForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  employee_code: '',
  department: 'Operations',
  designation: 'Executive',
  employment_type: 'full_time' as EmploymentType,
  date_of_joining: new Date().toISOString().split('T')[0],
  reporting_manager: '',
  salary: 25000,
  bank_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  pan_number: '',
  notes: '',
};

export default function HRWorkspacePage() {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isHR = currentUser?.role === 'hr';
  const canManage = isSuperAdmin || isHR;

  // Workspace View: Main HR vs Dedicated Salary & Payroll Workspace
  const [isSalaryWorkspace, setIsSalaryWorkspace] = useState(false);

  // Active Tab for Main Workforce Workspace
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'devices' | 'shifts' | 'policies'>('employees');

  // Salary & Payroll specific states
  const [payrollMonth, setPayrollMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [salarySearchQuery, setSalarySearchQuery] = useState('');
  const [salaryDeptFilter, setSalaryDeptFilter] = useState('all');
  const [selectedSlipRecord, setSelectedSlipRecord] = useState<PayrollRecord | null>(null);

  // Core Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [syncState, setSyncState] = useState<IntegrationSyncState | null>(null);
  const [metrics, setMetrics] = useState<AttendanceSummaryMetrics | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, { status: string; is_online: boolean; last_active_at: string | null }>>({});
  const [loading, setLoading] = useState(true);

  // Syncing state
  const [syncingNow, setSyncingNow] = useState(false);

  // Attendance Date Picker Filter
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Search & Filters for Staff & Attendance tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [attStatusFilter, setAttStatusFilter] = useState('all');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [empForm, setEmpForm] = useState(initialEmployeeForm);
  const [creatingEmp, setCreatingEmp] = useState(false);

  // Biometric Modals State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showSmartOfficeSyncModal, setShowSmartOfficeSyncModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showUSBModal, setShowUSBModal] = useState(false);
  const [enrollEmployee, setEnrollEmployee] = useState<Employee | null>(null);
  const [inspectAttendanceDay, setInspectAttendanceDay] = useState<AttendanceDay | null>(null);
  const [correctAttendanceDay, setCorrectAttendanceDay] = useState<AttendanceDay | null>(null);

  // Payroll Calculator State
  const [calcForm, setCalcForm] = useState({
    employee_id: '',
    employee_name: '',
    basic: 25000,
    hra: 10000,
    conveyance: 2000,
    special_allowance: 5000,
    pf: 1800,
    esi: 500,
    tds: 1000,
  });

  const fetchHRData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, attRes, payRes, polRes, devRes, syncRes, presenceRes] = await Promise.all([
        api.get('/employees').catch(() => ({ data: { data: { employees: [] } } })),
        api.get('/hr/attendance', { params: { date: selectedDate } }).catch(() => ({ data: { data: { roster: [], summary: null } } })),
        api.get('/hr/payroll', { params: { month: payrollMonth } }).catch(() => ({ data: { data: { payroll: [] } } })),
        api.get('/hr/policies').catch(() => ({ data: { data: { policies: [] } } })),
        api.get('/biometric/devices').catch(() => ({ data: { data: { devices: [] } } })),
        api.get('/biometric/sync-state').catch(() => ({ data: { data: { sync_state: null } } })),
        api.get('/presence/team').catch(() => ({ data: { data: { members: [] } } })),
      ]);

      const empList = (empRes.data as any)?.data?.employees || (empRes.data as any)?.employees || [];
      setEmployees(Array.isArray(empList) ? empList : []);

      const attData = (attRes.data as any)?.data;
      if (attData) {
        setAttendance(attData.roster || []);
        setMetrics(attData.summary || null);
      }

      const pMembers = (presenceRes.data as any)?.data?.members || [];
      const pMap: Record<string, any> = {};
      pMembers.forEach((m: any) => {
        if (m.biometric_attendance?.employee_id) pMap[m.biometric_attendance.employee_id] = m.crm_presence;
        if (m.user_id) pMap[m.user_id] = m.crm_presence;
        if (m.user_email) pMap[m.user_email.toLowerCase()] = m.crm_presence;
      });
      setPresenceMap(pMap);

      const payList = (payRes.data as any)?.data?.payroll || [];
      setPayroll(Array.isArray(payList) ? payList : []);

      const polList = (polRes.data as any)?.data?.policies || [];
      setPolicies(Array.isArray(polList) ? polList : []);

      const devList = (devRes.data as any)?.data?.devices || [];
      setDevices(Array.isArray(devList) ? devList : []);

      const syncObj = (syncRes.data as any)?.data?.sync_state || null;
      setSyncState(syncObj);

      if (payList.length > 0 && !calcForm.employee_name) {
        const first = payList[0];
        setCalcForm({
          employee_id: first.employee_id,
          employee_name: first.employee_name,
          basic: first.basic || 25000,
          hra: first.hra || 10000,
          conveyance: first.conveyance || 2000,
          special_allowance: first.special_allowance || 5000,
          pf: first.pf || 1800,
          esi: first.esi || 500,
          tds: first.tds || 1000,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, payrollMonth, calcForm.employee_name]);

  useEffect(() => {
    fetchHRData();
  }, [fetchHRData]);

  // Handle Manual "Sync Now" (Requirement 17)
  const handleSyncNow = async () => {
    setSyncingNow(true);
    try {
      const res = await api.post('/attendance/smartoffice/sync');
      const syncResult = res.data?.data;
      if (syncResult?.status === 'FAILED') {
        toast(syncResult.errorMessage || 'SmartOffice device is currently offline/unreachable.', { icon: 'ℹ️' });
      } else {
        const count = syncResult?.recordsInserted ?? 0;
        const dupes = syncResult?.recordsDuplicate ?? 0;
        toast.success(`SmartOffice sync complete! ${count} punch(es) ingested, ${dupes} duplicate(s) filtered.`);
      }
      fetchHRData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'SmartOffice sync failed.');
    } finally {
      setSyncingNow(false);
    }
  };

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => { if (e.department) set.add(e.department); });
    return Array.from(set);
  }, [employees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (deptFilter !== 'all' && e.department !== deptFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = `${e.first_name} ${e.last_name}`.toLowerCase().includes(q);
        const matchEmail = e.email?.toLowerCase().includes(q);
        const matchPhone = e.phone?.toLowerCase().includes(q);
        const matchCode = e.employee_code?.toLowerCase().includes(q);
        const matchTitle = e.designation?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchCode && !matchTitle) return false;
      }
      return true;
    });
  }, [employees, deptFilter, statusFilter, searchQuery]);

  // Filtered attendance records
  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (deptFilter !== 'all' && a.department !== deptFilter) return false;
      if (attStatusFilter !== 'all' && a.status.toLowerCase() !== attStatusFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (a.employee_name || '').toLowerCase().includes(q);
        const matchCode = (a.employee_code || '').toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [attendance, deptFilter, attStatusFilter, searchQuery]);

  // Create Employee Handler
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.first_name.trim() || !empForm.last_name.trim()) {
      return toast.error('First and Last name are required.');
    }

    setCreatingEmp(true);
    try {
      await api.post('/employees', empForm);
      toast.success(`Employee ${empForm.first_name} ${empForm.last_name} created!`);
      setShowCreateModal(false);
      setEmpForm(initialEmployeeForm);
      fetchHRData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create employee.');
    } finally {
      setCreatingEmp(false);
    }
  };

  const handleClockIn = async () => {
    try {
      await api.post('/hr/attendance/clock-in', {});
      toast.success('Clocked in successfully via biometric attendance engine!');
      fetchHRData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Clock in failed');
    }
  };

  const handleClockOut = async () => {
    try {
      await api.post('/hr/attendance/clock-out', {});
      toast.success('Clocked out successfully via biometric attendance engine!');
      fetchHRData();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Clock out failed');
    }
  };

  const handleSelectEmployeeForCalc = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    const existingPay = payroll.find((p) => p.employee_id === empId);
    if (emp) {
      setCalcForm({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        basic: existingPay?.basic || Math.round((emp.salary || 25000) * 0.5),
        hra: existingPay?.hra || Math.round((emp.salary || 25000) * 0.2),
        conveyance: existingPay?.conveyance || 2000,
        special_allowance: existingPay?.special_allowance || Math.max(0, Math.round((emp.salary || 25000) * 0.3) - 2000),
        pf: existingPay?.pf || 1800,
        esi: existingPay?.esi || 500,
        tds: existingPay?.tds || 0,
      });
    }
  };

  const handleCalculatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calcForm.employee_id) {
      return toast.error('Please select an employee to update their salary structure.');
    }
    try {
      await api.post('/hr/payroll/calculate', { ...calcForm, month: payrollMonth });
      toast.success(`Salary structure updated for ${calcForm.employee_name || 'Staff'}`);
      fetchHRData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update salary structure.');
    }
  };

  const filteredPayroll = useMemo(() => {
    return payroll.filter((p) => {
      if (salaryDeptFilter !== 'all' && p.department !== salaryDeptFilter) return false;
      if (salarySearchQuery.trim()) {
        const q = salarySearchQuery.toLowerCase();
        const matchName = (p.employee_name || '').toLowerCase().includes(q);
        const matchCode = (p.employee_code || '').toLowerCase().includes(q);
        const matchRole = (p.role || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchRole) return false;
      }
      return true;
    });
  }, [payroll, salaryDeptFilter, salarySearchQuery]);

  const handleExportPayrollCSV = () => {
    if (payroll.length === 0) {
      return toast.error('No payroll records available to export.');
    }
    const headers = [
      'Employee Code',
      'Employee Name',
      'Role',
      'Department',
      'Base Salary',
      'Overtime Addition',
      'Unpaid Absence Deduction',
      'Late Penalty Deduction',
      'Gross Salary',
      'PF',
      'ESI',
      'TDS',
      'Total Deductions',
      'Net Salary'
    ];
    const rows = payroll.map((p) => [
      `"${p.employee_code || ''}"`,
      `"${p.employee_name || ''}"`,
      `"${p.role || ''}"`,
      `"${p.department || ''}"`,
      p.base_salary || 0,
      p.overtime_addition || 0,
      p.unpaid_absence_deduction || 0,
      p.late_penalty_deduction || 0,
      p.gross_salary || 0,
      p.pf || 0,
      p.esi || 0,
      p.tds || 0,
      p.total_deductions || 0,
      p.net_salary || 0,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll_${payrollMonth}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${payroll.length} payroll records for ${payrollMonth}`);
  };

  const totalNetDisbursed = useMemo(() => payroll.reduce((acc, p) => acc + (p.net_salary || 0), 0), [payroll]);
  const totalGrossDisbursed = useMemo(() => payroll.reduce((acc, p) => acc + (p.gross_salary || 0), 0), [payroll]);
  const totalStatutoryDeductions = useMemo(() => payroll.reduce((acc, p) => acc + (p.pf || 0) + (p.esi || 0) + (p.tds || 0), 0), [payroll]);
  const totalBiometricPenalties = useMemo(() => payroll.reduce((acc, p) => acc + (p.late_penalty_deduction || 0) + (p.unpaid_absence_deduction || 0), 0), [payroll]);
  const totalOvertimeAdditions = useMemo(() => payroll.reduce((acc, p) => acc + (p.overtime_addition || 0), 0), [payroll]);

  const activeStaffCount = metrics?.active_staff ?? employees.filter((e) => e.status === 'active').length;
  const presentCount = metrics?.present_today ?? 0;
  const lateCount = metrics?.late_today ?? 0;
  const absentCount = metrics?.absent_today ?? 0;
  const incompleteCount = metrics?.incomplete_today ?? 0;
  const onlineDevicesCount = metrics?.devices_online ?? devices.filter((d) => d.status === 'online').length;

  return (
    <AppShell>
      <Topbar
        title={isSalaryWorkspace ? "Salary & Payroll Workspace" : "HR & Workforce Operations"}
        subtitle={isSalaryWorkspace ? "Biometric attendance-linked payroll calculation, salary structures, earnings/deductions, and payslip generation" : "BioMax biometric sync, live daily attendance, staff lifecycle, payroll computations & HR policies"}
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {!isSalaryWorkspace ? (
          <>
            {/* Command Bar Header */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-3 text-white shadow-md">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10">
                <div className="shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-medium text-amber border border-white/15 mb-1">
                    <Cpu size={11} />
                    BioMax Hardware & SmartOffice Connected
                  </div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
                    Workforce Operations & Biometric Attendance
                  </h2>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Calculator size={13} />}
                    onClick={() => setIsSalaryWorkspace(true)}
                    className="bg-amber hover:bg-amber-600 text-slate-900 font-extrabold shadow-xs text-xs h-8 px-3 rounded-full shrink-0 whitespace-nowrap"
                    title="Launch dedicated Salary & Payroll Workspace"
                  >
                    Salary & Payroll Workspace ↗
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={<RefreshCw size={12} className={syncingNow ? 'animate-spin' : ''} />}
                    loading={syncingNow}
                    onClick={handleSyncNow}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs text-xs h-8 px-3 rounded-full shrink-0 whitespace-nowrap"
                    title="Fetch latest biometric logs from SmartOffice API"
                  >
                    Sync Now
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Cpu size={12} />}
                    onClick={() => setShowSmartOfficeSyncModal(true)}
                    className="bg-indigo-900/80 hover:bg-indigo-800 text-white font-semibold text-xs border border-indigo-400/30 h-8 px-3 rounded-full shrink-0 whitespace-nowrap"
                    title="Open SmartOffice Biometric Sync Monitor & Historical Backfill"
                  >
                    Sync Monitor
                  </Button>

                  {canManage && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<UserPlus size={12} />}
                      onClick={() => setShowCreateModal(true)}
                      className="bg-slate-800/90 hover:bg-slate-700 text-white font-semibold text-xs border border-white/15 h-8 px-3 rounded-full shrink-0 whitespace-nowrap"
                    >
                      Add Employee
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Clock size={12} />}
                    onClick={handleClockIn}
                    className="bg-slate-800/90 hover:bg-slate-700 text-white font-semibold text-xs border border-white/15 h-8 px-3 rounded-full shrink-0 whitespace-nowrap"
                  >
                    Web Clock-In
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Clock size={12} />}
                    onClick={handleClockOut}
                    className="bg-slate-800/90 hover:bg-slate-700 text-white font-semibold text-xs border border-white/15 h-8 px-3 rounded-full shrink-0 whitespace-nowrap"
                  >
                    Web Clock-Out
                  </Button>
                </div>
              </div>
            </div>

        {/* 6 Sleek Compact KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Active Workforce */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-2xl shadow-2xs hover:border-gray-300 transition-all flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Active Staff</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-gray-900 tracking-tight">{activeStaffCount}</span>
                <span className="text-[10px] font-medium text-emerald-600">↑ 12%</span>
              </div>
              <p className="text-[10px] text-gray-400">vs last month</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-100/60 flex items-center justify-center shrink-0">
              <Users size={16} />
            </div>
          </div>

          {/* Card 2: Present Today */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-2xl shadow-2xs hover:border-gray-300 transition-all flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Present Today</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-gray-900 tracking-tight">{presentCount}</span>
                <span className="text-[10px] font-medium text-emerald-600">↑ 8%</span>
              </div>
              <p className="text-[10px] text-gray-400">vs last month</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/60 flex items-center justify-center shrink-0">
              <CheckCircle size={16} />
            </div>
          </div>

          {/* Card 3: Late Today */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-2xl shadow-2xs hover:border-gray-300 transition-all flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Late Today</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-gray-900 tracking-tight">{lateCount}</span>
                <span className="text-[10px] font-medium text-amber-600">Grace pd</span>
              </div>
              <p className="text-[10px] text-gray-400">flagged punches</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/60 flex items-center justify-center shrink-0">
              <Clock size={16} />
            </div>
          </div>

          {/* Card 4: Absent Today */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-2xl shadow-2xs hover:border-gray-300 transition-all flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Absent Today</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-gray-900 tracking-tight">{absentCount}</span>
                <span className="text-[10px] font-medium text-rose-500">No punch</span>
              </div>
              <p className="text-[10px] text-gray-400">unexcused</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-100/60 flex items-center justify-center shrink-0">
              <AlertCircle size={16} />
            </div>
          </div>

          {/* Card 5: Missing Punches / Incomplete */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-2xl shadow-2xs hover:border-gray-300 transition-all flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Incomplete</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-gray-900 tracking-tight">{incompleteCount}</span>
                <span className="text-[10px] font-medium text-purple-600">Pending</span>
              </div>
              <p className="text-[10px] text-gray-400">single punch</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-100/60 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} />
            </div>
          </div>

          {/* Card 6: Biometric Fleet Status */}
          <div className="p-3.5 bg-white border border-gray-200/80 rounded-2xl shadow-2xs hover:border-gray-300 transition-all flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">Devices Online</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-bold text-gray-900 tracking-tight">{onlineDevicesCount} / {Math.max(devices.length, 1)}</span>
                <span className="text-[10px] font-medium text-emerald-600">Live</span>
              </div>
              <p className="text-[10px] text-gray-400">SmartOffice</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60 flex items-center justify-center shrink-0">
              <Wifi size={16} />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border gap-2">
          <div className="flex space-x-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('employees')}
              className={`pb-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'employees' ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Users size={14} /> Staff Directory & Biometrics
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`pb-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'attendance' ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Clock size={14} /> Daily Attendance Records
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`pb-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'devices' ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Cpu size={14} /> Biometric Devices & Hardware
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`pb-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'shifts' ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <Settings2 size={14} /> Shifts & Grace Rules
            </button>
            <button
              onClick={() => setActiveTab('policies')}
              className={`pb-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'policies' ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              <ShieldCheck size={14} /> Company Policies
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsSalaryWorkspace(true)}
            className="mb-2 bg-gradient-to-r from-amber-500/10 to-amber-500/20 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-sm shrink-0 self-start sm:self-auto"
          >
            <Calculator size={14} className="text-amber-700" />
            Salary & Payroll Workspace ↗
          </Button>
        </div>

        {/* ── TAB 1: Staff Directory & Onboarding ───────────────────────────── */}
        {activeTab === 'employees' && (
          <div className="space-y-4">
            <div className="bg-white p-4 border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff by name, code, email, designation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-lg bg-surface/50 focus:bg-white focus:ring-2 focus:ring-navy focus:outline-none"
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
                      ...departments.map((d) => ({ value: d, label: d })),
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
                      { value: 'terminated', label: 'Terminated' },
                    ]}
                  />
                </div>

                <Button variant="secondary" size="sm" onClick={fetchHRData} className="text-xs" title="Refresh Workforce">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>

                {canManage && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-1.5 text-xs bg-navy hover:bg-navy/90 text-white font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Employee
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <PageLoader />
            ) : filteredEmployees.length === 0 ? (
              <div className="card p-12 text-center bg-white border border-border rounded-xl space-y-3">
                <Users className="w-10 h-10 text-muted mx-auto" />
                <h4 className="text-sm font-bold text-navy">No Staff Members Found</h4>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {searchQuery ? 'Try changing your search query or department filter.' : 'Get started by creating your first employee profile.'}
                </p>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden bg-white border border-border rounded-xl shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface text-muted font-bold border-b border-border">
                      <tr>
                        <th className="p-3.5">Employee</th>
                        <th className="p-3.5">Code</th>
                        <th className="p-3.5">Department & Role</th>
                        <th className="p-3.5">Biometric Status</th>
                        <th className="p-3.5">Onboarding</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredEmployees.map((emp) => {
                        const isEnrolled = emp.biometricMapping?.enrollment_status === 'enrolled';
                        const isPending = emp.biometricMapping?.enrollment_status === 'pending_enrollment';

                        return (
                          <tr key={emp.id} className="hover:bg-surface/50 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-navy to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                  {(emp.first_name?.[0] || 'E')}{(emp.last_name?.[0] || '')}
                                </div>
                                <div>
                                  <p className="font-bold text-navy">{emp.first_name} {emp.last_name}</p>
                                  <p className="text-[11px] text-muted">{emp.email || emp.phone || '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5 font-mono text-muted text-[11px] font-semibold">{emp.employee_code || '—'}</td>
                            <td className="p-3.5">
                              <div className="font-semibold text-navy">{emp.designation || 'Staff'}</div>
                              <span className="text-[10px] text-muted flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {emp.department || 'General'}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    isEnrolled
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : isPending
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <Fingerprint size={11} />
                                  {isEnrolled ? 'Enrolled' : isPending ? 'Pending' : 'Not Enrolled'}
                                </span>
                                {canManage && !isEnrolled && (
                                  <button
                                    type="button"
                                    onClick={() => setEnrollEmployee(emp)}
                                    className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                                    title="Upload & Enroll in Biometric Machine"
                                  >
                                    <Cpu size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  emp.onboarding_status === 'completed'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : emp.onboarding_status === 'in_progress'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {emp.onboarding_status || 'pending'}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  emp.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {emp.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link href={`/employees/${emp.id}`}>
                                  <Button variant="secondary" size="xs" className="text-xs">
                                    Profile <ChevronRight className="w-3 h-3 ml-0.5" />
                                  </Button>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Daily Attendance Records ──────────────────────────────── */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white p-4 border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 bg-surface/50 border border-border rounded-lg px-3 py-1.5">
                  <Calendar size={14} className="text-muted" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="text-xs font-semibold bg-transparent focus:outline-none text-navy"
                  />
                </div>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search attendee by name/code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-surface/50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="w-52">
                  <Select
                    value={attStatusFilter}
                    onChange={(e) => setAttStatusFilter(e.target.value)}
                    size="sm"
                    options={[
                      { value: 'all', label: 'All Attendance Statuses' },
                      { value: 'present', label: 'Present' },
                      { value: 'late', label: 'Late' },
                      { value: 'incomplete', label: 'Incomplete (Missing Punch)' },
                      { value: 'half_day', label: 'Half Day' },
                      { value: 'absent', label: 'Absent' },
                    ]}
                  />
                </div>

                <Button variant="secondary" size="sm" onClick={fetchHRData} className="text-xs" title="Refresh Roster">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Attendance Roster Table */}
            {loading ? (
              <PageLoader />
            ) : filteredAttendance.length === 0 ? (
              <div className="card p-12 text-center bg-white border border-border rounded-xl space-y-2">
                <Clock className="w-10 h-10 text-muted mx-auto" />
                <h4 className="text-sm font-bold text-navy">No Attendance Records for {selectedDate}</h4>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Use &quot;Sync Now&quot; to fetch punches from SmartOffice or use Web Clock-In above.
                </p>
              </div>
            ) : (
              <div className="card p-0 overflow-hidden bg-white border border-border rounded-xl shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface text-muted font-bold border-b border-border">
                      <tr>
                        <th className="p-3.5">Employee & CRM Presence</th>
                        <th className="p-3.5">First IN</th>
                        <th className="p-3.5">Last OUT</th>
                        <th className="p-3.5">Work Hours</th>
                        <th className="p-3.5">Late By</th>
                        <th className="p-3.5">Source</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAttendance.map((rec) => {
                        const presence = presenceMap[rec.employee_id];
                        const presenceStatus = presence?.status || 'offline';
                        return (
                        <tr key={rec.id} className="hover:bg-surface/50 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  presenceStatus === 'online'
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                                    : presenceStatus === 'idle'
                                    ? 'bg-amber-400'
                                    : 'bg-slate-300'
                                }`}
                                title={`Application Presence: ${presenceStatus}`}
                              />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-navy">{rec.employee_name || 'Staff'}</p>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                    presenceStatus === 'online'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}>
                                    {presenceStatus === 'online' ? 'CRM Active' : 'CRM Offline'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted font-mono">{rec.employee_code} • {rec.department}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-emerald-700 font-semibold">
                            {rec.clock_in ? rec.clock_in.slice(0, 5) : '—'}
                          </td>
                          <td className="p-3.5 font-mono text-slate-700 font-semibold">
                            {rec.clock_out ? rec.clock_out.slice(0, 5) : '—'}
                          </td>
                          <td className="p-3.5 font-mono text-muted">
                            {rec.work_hours > 0 ? `${rec.work_hours} hrs` : '0 hrs'}
                          </td>
                          <td className="p-3.5">
                            {rec.late_minutes && rec.late_minutes > 0 ? (
                              <span className="text-amber-700 font-semibold font-mono text-[11px]">
                                +{rec.late_minutes}m
                              </span>
                            ) : (
                              <span className="text-muted text-[11px]">On Time</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-surface border border-border">
                              {rec.source === 'BIOMETRIC' ? <Cpu size={11} className="text-indigo-600" /> : <Clock size={11} className="text-amber-600" />}
                              {rec.source}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  rec.status === 'PRESENT'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : rec.status === 'LATE'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : rec.status === 'INCOMPLETE'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : rec.status === 'HALF_DAY'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {rec.status}
                              </span>
                              {rec.is_corrected && (
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                                  Corrected
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => setInspectAttendanceDay(rec)}
                                className="text-[10px]"
                                title="View Raw BioMax Punches"
                              >
                                <Eye size={12} className="mr-1" /> Punches
                              </Button>
                              {canManage && (
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => setCorrectAttendanceDay(rec)}
                                  className="text-[10px] text-amber-700 bg-amber-50/50 hover:bg-amber-100 border-amber-200"
                                  title="Submit Manual Punch Correction"
                                >
                                  <Edit2 size={12} className="mr-1" /> Correct
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Biometric Devices Fleet ──────────────────────────────── */}
        {activeTab === 'devices' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm gap-3">
              <div>
                <h3 className="font-bold text-navy text-sm flex items-center gap-2">
                  <Cpu size={16} className="text-indigo-600" /> BioMax Terminal Hardware Fleet
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Universal synchronization: Wired Ethernet, Wireless Wi-Fi, and Offline USB flash drive
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSyncNow}
                  disabled={syncingNow}
                  className="text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${syncingNow ? 'animate-spin' : ''}`} />
                  {syncingNow ? 'Syncing...' : 'Sync Now'}
                </Button>
                {canManage && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowUSBModal(true)}
                    className="text-xs bg-indigo-50/60 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                  >
                    <Usb className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                    Upload USB Logs
                  </Button>
                )}
                {canManage && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus size={13} />}
                    onClick={() => setShowDeviceModal(true)}
                    className="bg-navy text-white font-bold text-xs"
                  >
                    Add Biometric Device
                  </Button>
                )}
              </div>
            </div>

            {/* SmartOffice & Wire/Wireless Sync Integration Info Banner */}
            <div className="bg-surface/60 border border-border rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <span className="text-[11px] text-muted block">SmartOffice API Key</span>
                  <span className="font-mono font-bold text-navy text-xs">274416082629</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <Wifi size={16} />
                </div>
                <div>
                  <span className="text-[11px] text-muted block">Wired / Network Mode</span>
                  <span className="font-semibold text-navy text-xs">Auto-Sync & Reconnect Catch-Up</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                  <Usb size={16} />
                </div>
                <div>
                  <span className="text-[11px] text-muted block">Without Wire / Offline Mode</span>
                  <span className="font-semibold text-navy text-xs">Flash Memory & USB AttLog Sync</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.length === 0 ? (
                <div className="col-span-2 card p-8 text-center bg-white border border-border rounded-xl space-y-2">
                  <Cpu className="w-8 h-8 text-muted mx-auto" />
                  <p className="font-bold text-navy">No Devices Registered</p>
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    Click &quot;Add Biometric Device&quot; to connect your BioMax terminal serial number.
                  </p>
                </div>
              ) : (
                devices.map((dev) => (
                  <div key={dev.id} className="p-4 bg-white border border-border rounded-xl shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                          <Cpu size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-navy text-sm">{dev.device_name}</h4>
                          <p className="text-xs text-muted font-mono">{dev.serial_number} • {dev.location}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          dev.status === 'online'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${dev.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {dev.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-surface/50 p-2.5 rounded-lg border border-border">
                      <div>
                        <span className="text-muted block">Last Communication:</span>
                        <span className="font-semibold text-navy">
                          {dev.last_sync_at ? new Date(dev.last_sync_at).toLocaleTimeString() : 'Never'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block">IP Endpoint:</span>
                        <span className="font-mono text-navy">{dev.ip_address || 'SmartOffice Cloud'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-muted">Error Count: <strong>{dev.error_count}</strong></span>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          api.post(`/biometric/devices/${dev.id}/test`).then((res) => {
                            toast.success(`Online! Users on machine: ${res.data?.data?.live_users_count ?? 0}`);
                            fetchHRData();
                          }).catch((err) => toast.error(err.response?.data?.message || 'Connection test failed.'));
                        }}
                      >
                        <Wifi size={12} className="mr-1 text-emerald-600" /> Ping Device
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: Shifts & Grace Rules ──────────────────────────────────── */}
        {activeTab === 'shifts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-border shadow-sm">
              <div>
                <h3 className="font-bold text-navy text-sm flex items-center gap-2">
                  <Settings2 size={16} className="text-indigo-600" /> Attendance Shifts & Policy Definitions
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Configure work schedules, late grace periods, and minimum work hour thresholds
                </p>
              </div>
              {canManage && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => setShowShiftModal(true)}
                  className="bg-navy text-white font-bold"
                >
                  Configure Shifts
                </Button>
              )}
            </div>

            <div className="bg-white border border-border rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="font-bold text-navy flex items-center gap-1.5">
                    <Clock size={14} className="text-indigo-600" /> General Day Shift
                  </p>
                  <p className="text-xs font-mono font-semibold text-slate-700">10:00 AM — 06:00 PM</p>
                  <ul className="text-[11px] text-muted space-y-1 pt-1">
                    <li>• Grace Period: <strong>10 minutes</strong> (Late after 10:10 AM)</li>
                    <li>• Early Leave: Before <strong>05:50 PM</strong></li>
                    <li>• Min Full Day: <strong>8.0 hours</strong></li>
                    <li>• Min Half Day: <strong>4.0 hours</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: Company Policies ──────────────────────────────────────── */}
        {activeTab === 'policies' && (
          <div className="card p-0 overflow-hidden bg-white border border-border rounded-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h4 className="font-bold text-navy text-sm">Company Policies & Guidelines</h4>
            </div>
            <div className="divide-y divide-border">
              {policies.map((pol) => (
                <div key={pol.id} className="p-4 flex items-center justify-between hover:bg-surface/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-navy text-xs">{pol.title}</p>
                      <p className="text-[11px] text-muted">Category: {pol.category} • Published: {pol.published_date}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {pol.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    ) : (
      /* ═══════════════════════════════════════════════════════════════════════
         DEDICATED SALARY & PAYROLL WORKSPACE (FULL-PAGE VIEW)
         ═══════════════════════════════════════════════════════════════════════ */
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Navigation Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowLeft size={14} />}
              onClick={() => setIsSalaryWorkspace(false)}
              className="bg-slate-100 hover:bg-slate-200 text-navy font-bold text-xs shadow-sm border border-slate-300"
            >
              Back to Main HR Workspace
            </Button>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <span className="text-xs text-muted font-medium hidden sm:inline">
              Workforce Operations &gt; <strong className="text-navy font-bold">Salary & Payroll Engine</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-lg border border-border text-xs">
              <Calendar size={13} className="text-muted" />
              <span className="font-bold text-navy text-xs">Payroll Month:</span>
              <input
                type="month"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="bg-transparent font-bold text-navy focus:outline-none cursor-pointer text-xs"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<FileSpreadsheet size={14} className="text-emerald-600" />}
              onClick={handleExportPayrollCSV}
              className="text-xs font-bold bg-white hover:bg-surface border-border text-navy shadow-sm"
              title="Export complete payroll records to CSV"
            >
              Export CSV
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw size={14} className={syncingNow ? 'animate-spin' : ''} />}
              loading={syncingNow}
              onClick={handleSyncNow}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md text-xs"
              title="Sync latest punches and recompute payroll"
            >
              Sync &amp; Recompute
            </Button>
          </div>
        </div>

        {/* Dedicated Salary Command Bar Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-300 border border-emerald-500/30 mb-2">
                <Calculator size={13} />
                Biometric Attendance-Linked Payroll Engine
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Salary &amp; Compensation Operations
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Cryptographic time-card synchronization, automated overtime incentives, late arrival penalty deductions, statutory PF/ESI/TDS withholdings, and verified monthly salary slips.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ArrowLeft size={13} />}
                onClick={() => setIsSalaryWorkspace(false)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold"
              >
                Exit to Workforce
              </Button>
            </div>
          </div>
        </div>

        {/* Salary KPI Bento Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {/* 1: Total Net Disbursed */}
          <div className="p-3.5 bg-white border border-border rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Net Disbursed</p>
              <p className="text-lg font-bold text-emerald-700 mt-0.5 font-mono">
                ₹{totalNetDisbursed.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={16} />
            </div>
          </div>

          {/* 2: Gross Disbursed */}
          <div className="p-3.5 bg-white border border-border rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Gross Payroll</p>
              <p className="text-lg font-bold text-navy mt-0.5 font-mono">
                ₹{totalGrossDisbursed.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 size={16} />
            </div>
          </div>

          {/* 3: Statutory Deductions */}
          <div className="p-3.5 bg-white border border-border rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">PF / ESI / TDS</p>
              <p className="text-lg font-bold text-rose-600 mt-0.5 font-mono">
                ₹{totalStatutoryDeductions.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>

          {/* 4: Biometric Penalties */}
          <div className="p-3.5 bg-white border border-border rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Late / Absence</p>
              <p className="text-lg font-bold text-amber-600 mt-0.5 font-mono">
                ₹{totalBiometricPenalties.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>

          {/* 5: Overtime Additions */}
          <div className="p-3.5 bg-white border border-border rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Overtime Paid</p>
              <p className="text-lg font-bold text-indigo-600 mt-0.5 font-mono">
                +₹{totalOvertimeAdditions.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ArrowUpRight size={16} />
            </div>
          </div>

          {/* 6: Staff On Payroll */}
          <div className="p-3.5 bg-white border border-border rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">Staff Count</p>
              <p className="text-lg font-bold text-navy mt-0.5 font-mono">
                {payroll.length} active
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-center">
              <Users size={16} />
            </div>
          </div>
        </div>

        {/* 2-Column Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Salary Structure & Biometric Calculator Form */}
          <div className="card space-y-4 bg-white border border-border rounded-xl shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h4 className="font-bold flex items-center gap-2 text-navy text-sm">
                  <Calculator className="text-amber" size={16} /> Salary Structure &amp; Formula
                </h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Select staff to adjust base pay and statutory withholdings
                </p>
              </div>
            </div>

            <form onSubmit={handleCalculatePayroll} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-navy mb-1 text-[11px]">Select Employee Profile *</label>
                <select
                  value={calcForm.employee_id}
                  onChange={(e) => handleSelectEmployeeForCalc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-surface/50 focus:bg-white focus:ring-2 focus:ring-navy focus:outline-none"
                  required
                >
                  <option value="">-- Choose Employee to Configure --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code || 'No Code'}) — {emp.designation || emp.department}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Selected Employee Name *"
                value={calcForm.employee_name}
                onChange={(e) => setCalcForm({ ...calcForm, employee_name: e.target.value })}
                placeholder="Employee Name"
                required
              />

              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  label="Basic Pay (₹)"
                  type="number"
                  value={calcForm.basic}
                  onChange={(e) => setCalcForm({ ...calcForm, basic: Number(e.target.value) })}
                />
                <Input
                  label="HRA (₹)"
                  type="number"
                  value={calcForm.hra}
                  onChange={(e) => setCalcForm({ ...calcForm, hra: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  label="Conveyance (₹)"
                  type="number"
                  value={calcForm.conveyance}
                  onChange={(e) => setCalcForm({ ...calcForm, conveyance: Number(e.target.value) })}
                />
                <Input
                  label="Special Allowance (₹)"
                  type="number"
                  value={calcForm.special_allowance}
                  onChange={(e) => setCalcForm({ ...calcForm, special_allowance: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="PF (₹)"
                  type="number"
                  value={calcForm.pf}
                  onChange={(e) => setCalcForm({ ...calcForm, pf: Number(e.target.value) })}
                />
                <Input
                  label="ESI (₹)"
                  type="number"
                  value={calcForm.esi}
                  onChange={(e) => setCalcForm({ ...calcForm, esi: Number(e.target.value) })}
                />
                <Input
                  label="TDS (₹)"
                  type="number"
                  value={calcForm.tds}
                  onChange={(e) => setCalcForm({ ...calcForm, tds: Number(e.target.value) })}
                />
              </div>

              {/* Live Preview Summary Box */}
              <div className="bg-surface/80 p-3 rounded-xl border border-border space-y-1.5 text-xs">
                <div className="flex justify-between text-muted text-[11px]">
                  <span>Calculated Base Gross:</span>
                  <span className="font-mono font-bold text-navy">
                    ₹{((calcForm.basic || 0) + (calcForm.hra || 0) + (calcForm.conveyance || 0) + (calcForm.special_allowance || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-muted text-[11px]">
                  <span>Fixed Deductions (PF+ESI+TDS):</span>
                  <span className="font-mono font-bold text-rose-600">
                    -₹{((calcForm.pf || 0) + (calcForm.esi || 0) + (calcForm.tds || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="border-t border-border pt-1 flex justify-between font-bold text-navy text-xs">
                  <span>Net Reference (pre-biometrics):</span>
                  <span className="font-mono text-emerald-700 font-extrabold">
                    ₹{Math.max(0, ((calcForm.basic || 0) + (calcForm.hra || 0) + (calcForm.conveyance || 0) + (calcForm.special_allowance || 0)) - ((calcForm.pf || 0) + (calcForm.esi || 0) + (calcForm.tds || 0))).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                type="submit"
                className="w-full bg-navy hover:bg-navy/90 text-white font-bold py-2 shadow-sm"
              >
                Save &amp; Update Salary Structure
              </Button>
            </form>
          </div>

          {/* Right Column: Biometric Monthly Payroll Breakdown Table */}
          <div className="lg:col-span-2 card p-0 overflow-hidden bg-white border border-border rounded-xl shadow-sm flex flex-col">
            {/* Table Header Filter Controls */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface/30">
              <div>
                <h4 className="font-bold text-navy text-sm">Biometric Monthly Payroll Breakdown &amp; Disbursement Ledger</h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Real-time reconciliation of biometric overtime bonuses and late punch penalties
                </p>
              </div>
              <Badge label={`Period: ${payrollMonth}`} colorClass="bg-indigo-50 text-indigo-700 border-indigo-200" />
            </div>

            <div className="p-3 border-b border-border flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white">
              <div className="relative flex-1 w-full max-w-sm">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by staff name, code or designation..."
                  value={salarySearchQuery}
                  onChange={(e) => setSalarySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-surface/50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="w-44">
                <Select
                  value={salaryDeptFilter}
                  onChange={(e) => setSalaryDeptFilter(e.target.value)}
                  size="sm"
                  options={[
                    { value: 'all', label: 'All Departments' },
                    ...departments.map((d) => ({ value: d, label: d })),
                  ]}
                />
              </div>
            </div>

            {/* Ledger Line View Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface text-muted font-bold border-b border-border">
                  <tr>
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Base Salary</th>
                    <th className="p-3">Biometric Adj.</th>
                    <th className="p-3">Gross</th>
                    <th className="p-3">Deductions</th>
                    <th className="p-3">Net Disbursable</th>
                    <th className="p-3 text-right">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayroll.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        No payroll records found for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredPayroll.map((p) => {
                      const netAdj = (p.overtime_addition || 0) - (p.unpaid_absence_deduction || 0) - (p.late_penalty_deduction || 0);

                      return (
                        <tr key={p.employee_id} className="hover:bg-surface/50 transition-colors">
                          <td className="p-3">
                            <p className="font-bold text-navy">{p.employee_name}</p>
                            <p className="text-[10px] text-muted font-mono">{p.employee_code || '—'} • {p.role}</p>
                          </td>
                          <td className="p-3 font-mono">₹{Number(p.base_salary || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 font-mono">
                            {netAdj > 0 ? (
                              <span className="text-emerald-600 font-semibold" title={`Overtime: +₹${p.overtime_addition}`}>+₹{netAdj}</span>
                            ) : netAdj < 0 ? (
                              <span className="text-rose-600 font-semibold" title={`Late: -₹${p.late_penalty_deduction}, Absent: -₹${p.unpaid_absence_deduction}`}>-₹{Math.abs(netAdj)}</span>
                            ) : (
                              <span className="text-muted">₹0</span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-semibold">₹{Number(p.gross_salary || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 font-mono text-rose-600">₹{Number(p.total_deductions || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 font-mono font-bold text-emerald-700 text-sm">
                            ₹{Number(p.net_salary || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<FileText size={12} />}
                              onClick={() => setSelectedSlipRecord(p)}
                              className="text-[11px] px-2.5 py-1 bg-surface hover:bg-slate-200 border-border font-bold text-navy"
                              title="View &amp; Print Official Payslip"
                            >
                              Payslip
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )}

      </main>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}

      {/* Add Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-navy text-base flex items-center gap-2">
                <UserPlus size={18} className="text-amber-600" /> Add New Employee
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-navy">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name *"
                  value={empForm.first_name}
                  onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })}
                  required
                />
                <Input
                  label="Last Name *"
                  value={empForm.last_name}
                  onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Email Address"
                  type="email"
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                />
                <Input
                  label="Phone Number"
                  value={empForm.phone}
                  onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Employee Code"
                  placeholder="e.g. EMP-005"
                  value={empForm.employee_code}
                  onChange={(e) => setEmpForm({ ...empForm, employee_code: e.target.value })}
                />
                <Input
                  label="Base Salary (₹)"
                  type="number"
                  value={empForm.salary}
                  onChange={(e) => setEmpForm({ ...empForm, salary: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-navy mb-1">Department</label>
                  <select
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className="form-select w-full text-xs"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Sales">Sales</option>
                    <option value="Telecalling">Telecalling</option>
                    <option value="Technical & Field">Technical & Field</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Logistics">Logistics</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-navy mb-1">Designation</label>
                  <Input
                    value={empForm.designation}
                    onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={creatingEmp}
                  className="bg-navy hover:bg-navy/90 text-white font-bold"
                >
                  Create Profile
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Biometric Device Management Modal */}
      <DeviceManagementModal
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        onRefreshDevices={fetchHRData}
      />

      {/* SmartOffice Sync Monitor & Backfill Modal (Requirement 16, 17, 18) */}
      <SmartOfficeSyncModal
        isOpen={showSmartOfficeSyncModal}
        onClose={() => setShowSmartOfficeSyncModal(false)}
        onSyncCompleted={fetchHRData}
      />

      {/* Biometric Shift Config Modal */}
      <ShiftConfigModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        onSuccess={fetchHRData}
      />

      {/* Biometric Enrollment Modal for Employee */}
      <BiometricEnrollmentModal
        isOpen={Boolean(enrollEmployee)}
        onClose={() => setEnrollEmployee(null)}
        employee={enrollEmployee}
        onEnrollmentSuccess={fetchHRData}
      />

      {/* Raw Punches Modal */}
      <RawPunchTimelineModal
        isOpen={Boolean(inspectAttendanceDay)}
        onClose={() => setInspectAttendanceDay(null)}
        attendanceDay={inspectAttendanceDay}
      />

      {/* Attendance Correction Modal */}
      <AttendanceCorrectionModal
        isOpen={Boolean(correctAttendanceDay)}
        onClose={() => setCorrectAttendanceDay(null)}
        attendanceDay={correctAttendanceDay}
        onSuccess={fetchHRData}
      />

      {/* Biometric USB Offline Logs Modal */}
      <UploadUSBLogsModal
        isOpen={showUSBModal}
        onClose={() => setShowUSBModal(false)}
        onSuccess={fetchHRData}
      />

      {/* ── SALARY PAYSLIP MODAL ── */}
      {selectedSlipRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-border p-6 space-y-5 animate-in fade-in zoom-in-95 my-8">
            {/* Top Slip Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center font-black text-lg shadow-md">
                  KE
                </div>
                <div>
                  <h3 className="font-bold text-navy text-base tracking-tight">Khrisha Enterprises • Vasify Operations</h3>
                  <p className="text-[11px] text-muted">Official Payslip &amp; Biometric Compensation Statement</p>
                </div>
              </div>
              <div className="text-right">
                <Badge label={`Month: ${payrollMonth}`} colorClass="bg-navy/10 text-navy font-bold border-navy/20" />
                <p className="text-[10px] text-muted mt-1">Generated on {new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            {/* Staff Bio & Deployment Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface/60 p-3.5 rounded-xl border border-border text-xs">
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase">Employee</span>
                <p className="font-bold text-navy mt-0.5">{selectedSlipRecord.employee_name}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase">Employee Code</span>
                <p className="font-mono font-bold text-navy mt-0.5">{selectedSlipRecord.employee_code || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase">Designation</span>
                <p className="font-medium text-navy mt-0.5">{selectedSlipRecord.role || 'Staff'}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted uppercase">Department</span>
                <p className="font-medium text-navy mt-0.5">{selectedSlipRecord.department || 'General'}</p>
              </div>
            </div>

            {/* Biometric Attendance Summary */}
            {selectedSlipRecord.attendance_summary && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-navy text-[11px] flex items-center gap-1.5">
                    <Fingerprint size={13} className="text-blue-600" /> Biometric Attendance Record
                  </span>
                  <span className="text-[10px] text-muted">
                    Total Cycle Days: {selectedSlipRecord.attendance_summary.total_days || 30}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <p className="text-[10px] text-muted font-medium">Present</p>
                    <p className="text-sm font-bold text-emerald-600">{selectedSlipRecord.attendance_summary.present_days ?? '—'}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <p className="text-[10px] text-muted font-medium">Late Marks</p>
                    <p className="text-sm font-bold text-amber-600">{selectedSlipRecord.attendance_summary.late_days ?? 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <p className="text-[10px] text-muted font-medium">Absences</p>
                    <p className="text-sm font-bold text-rose-600">{selectedSlipRecord.attendance_summary.absent_days ?? 0}</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <p className="text-[10px] text-muted font-medium">Overtime Hrs</p>
                    <p className="text-sm font-bold text-indigo-600">{selectedSlipRecord.attendance_summary.overtime_hours ?? 0}h</p>
                  </div>
                </div>
              </div>
            )}

            {/* Earnings vs Deductions Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Earnings */}
              <div className="border border-border rounded-xl p-3.5 space-y-2 bg-white">
                <h4 className="font-bold text-emerald-700 text-xs border-b border-border pb-1.5 flex items-center justify-between">
                  <span>Earnings &amp; Allowances</span>
                  <span>Amount (₹)</span>
                </h4>
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex justify-between"><span>Basic Pay</span><span className="font-mono">₹{Number(selectedSlipRecord.basic || 0).toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span>HRA</span><span className="font-mono">₹{Number(selectedSlipRecord.hra || 0).toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span>Conveyance</span><span className="font-mono">₹{Number(selectedSlipRecord.conveyance || 0).toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span>Special Allowance</span><span className="font-mono">₹{Number(selectedSlipRecord.special_allowance || 0).toLocaleString('en-IN')}</span></div>
                  {selectedSlipRecord.overtime_addition > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Biometric Overtime Bonus</span>
                      <span className="font-mono">+₹{Number(selectedSlipRecord.overtime_addition).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-navy">
                  <span>Total Gross Earnings</span>
                  <span className="font-mono text-emerald-700 font-extrabold">₹{Number(selectedSlipRecord.gross_salary || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Deductions */}
              <div className="border border-border rounded-xl p-3.5 space-y-2 bg-white">
                <h4 className="font-bold text-rose-700 text-xs border-b border-border pb-1.5 flex items-center justify-between">
                  <span>Deductions &amp; Withholdings</span>
                  <span>Amount (₹)</span>
                </h4>
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex justify-between"><span>Provident Fund (PF)</span><span className="font-mono">₹{Number(selectedSlipRecord.pf || 0).toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span>ESI Contribution</span><span className="font-mono">₹{Number(selectedSlipRecord.esi || 0).toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between"><span>Tax (TDS)</span><span className="font-mono">₹{Number(selectedSlipRecord.tds || 0).toLocaleString('en-IN')}</span></div>
                  {selectedSlipRecord.late_penalty_deduction > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Late Punch Penalties</span>
                      <span className="font-mono">-₹{Number(selectedSlipRecord.late_penalty_deduction).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {selectedSlipRecord.unpaid_absence_deduction > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Unpaid Absence Deductions</span>
                      <span className="font-mono">-₹{Number(selectedSlipRecord.unpaid_absence_deduction).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-navy">
                  <span>Total Deductions</span>
                  <span className="font-mono text-rose-600 font-extrabold">₹{Number(selectedSlipRecord.total_deductions || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Net Salary Payable Banner */}
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Net Disbursable Salary</span>
                <p className="text-xs text-muted">Direct transfer to employee verified bank account</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
                  ₹{Number(selectedSlipRecord.net_salary || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-[10px] text-muted italic">System-generated confidential document. No physical signature required.</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedSlipRecord(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Printer size={13} />}
                  onClick={() => window.print()}
                  className="bg-navy hover:bg-navy/90 text-white font-bold text-xs"
                >
                  Print / Save PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
