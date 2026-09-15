'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import EmployeeSelector, { EmployeeItem } from '@/components/audit/EmployeeSelector';
import EmployeeProfileHeader from '@/components/audit/EmployeeProfileHeader';
import PeriodSelector, { AuditPeriod } from '@/components/audit/PeriodSelector';
import SalesAuditDashboard from '@/components/audit/SalesAuditDashboard';
import TechnicianAuditDashboard from '@/components/audit/TechnicianAuditDashboard';
import PerformanceIndicators from '@/components/audit/PerformanceIndicators';
import DailyBreakdownTable from '@/components/audit/DailyBreakdownTable';
import ActivityTimeline from '@/components/audit/ActivityTimeline';
import PerformanceSummary from '@/components/audit/PerformanceSummary';
import { Download, RefreshCw, AlertCircle, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import toast from 'react-hot-toast';
import QuickExportModal from '@/components/common/QuickExportModal';
import type { ExportFormat } from '@/components/common/ExportFormatSelector';

export default function EmployeeAuditPage() {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [period, setPeriod] = useState<AuditPeriod>('monthly');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [auditData, setAuditData] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Check RBAC permission for sales/telecaller
  const isAuthorized = user && ['admin', 'super_admin', 'hr', 'manager', 'ceo'].includes(user.role);

  // 1. Fetch Employees
  useEffect(() => {
    if (!isAuthorized && user) {
      setIsForbidden(true);
      setIsLoadingEmployees(false);
      return;
    }

    async function fetchEmployees() {
      setIsLoadingEmployees(true);
      try {
        const res = await api.get(`/employee-audit/employees?include_inactive=${includeInactive}`);
        const list: EmployeeItem[] = res.data.data?.employees || [];
        setEmployees(list);

        // Auto select first employee if not set
        if (list.length > 0 && !selectedEmployee) {
          setSelectedEmployee(list[0]);
        }
      } catch (err: any) {
        if (err.response?.status === 403) {
          setIsForbidden(true);
        } else {
          setErrorMsg(err.response?.data?.message || 'Failed to load employee list.');
        }
      } finally {
        setIsLoadingEmployees(false);
      }
    }

    fetchEmployees();
  }, [includeInactive, user, isAuthorized, selectedEmployee]);

  // 2. Fetch Audit Data when Employee or Period changes
  useEffect(() => {
    const currentEmployee = selectedEmployee;
    if (!currentEmployee) return;

    async function fetchAuditDetails() {
      if (!currentEmployee) return;
      setIsLoadingAudit(true);
      setErrorMsg(null);

      try {
        const empId = currentEmployee.id;
        const [metricsRes, breakdownRes, timelineRes] = await Promise.all([
          api.get(`/employee-audit/${empId}/metrics?period=${period}`),
          api.get(`/employee-audit/${empId}/daily-breakdown?period=${period}`),
          api.get(`/employee-audit/${empId}/activity`),
        ]);

        setAuditData(metricsRes.data.data?.audit || null);
        setBreakdown(breakdownRes.data.data?.breakdown || []);
        setTimeline(timelineRes.data.data?.timeline || []);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.message || 'Unable to load employee audit data.');
      } finally {
        setIsLoadingAudit(false);
      }
    }

    fetchAuditDetails();
  }, [selectedEmployee, period]);

  // Multi-Format Export Handler (Excel, PDF, CSV)
  const handleExport = async (format: ExportFormat) => {
    if (!selectedEmployee) return;
    try {
      setIsExporting(true);
      const response = await api.get(
        `/employee-audit/${selectedEmployee.id}/export?period=${period}&format=${format}`,
        { responseType: 'blob' }
      );
      const fmt = format.toLowerCase();
      const mimeType =
        fmt === 'pdf'
          ? 'application/pdf'
          : fmt === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = fmt === 'excel' ? 'xlsx' : fmt;
      const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `employee_audit_${selectedEmployee.employee_code || selectedEmployee.id}_${period}.${ext}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Audit report exported as ${format.toUpperCase()}.`);
    } catch (err) {
      toast.error('Failed to export audit report.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isForbidden) {
    return (
      <AppShell>
        <Topbar title="Employee Audit" subtitle="Access Restricted" />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-surface">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-navy">403 Forbidden</h2>
          <p className="text-sm text-muted max-w-md mt-1">
            You don&apos;t have permission to view employee audits. Only management, HR, and super admins can access this page.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Topbar title="Employee Audit" subtitle="Comprehensive performance, attendance, sales, and service evaluation module" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-surface space-y-6">
        {/* Controls Bar: Employee Selector & Export */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <EmployeeSelector
            employees={employees}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={setSelectedEmployee}
            includeInactive={includeInactive}
            onToggleIncludeInactive={setIncludeInactive}
            isLoading={isLoadingEmployees}
          />

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {selectedEmployee && (
              <span className="text-xs text-muted">
                Selected: <strong className="text-navy">{selectedEmployee.full_name}</strong> ({selectedEmployee.department})
              </span>
            )}
            {selectedEmployee && (
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-amber text-navy font-bold text-xs rounded-lg shadow-xs hover:bg-amber-400 transition-all cursor-pointer"
              >
                <Download size={14} />
                Export Audit Report
              </button>
            )}
          </div>
        </div>

        {/* Universal Format Prompt Modal */}
        <QuickExportModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          title={`Export Audit Report - ${selectedEmployee?.full_name || 'Employee'}`}
          subtitle={`Please choose your preferred format to export the performance audit report for ${selectedEmployee?.full_name || 'this employee'} (${period}).`}
          loading={isExporting}
          onConfirm={async (format) => {
            await handleExport(format);
            setExportModalOpen(false);
          }}
        />

        {/* Period Selector Tabs */}
        <PeriodSelector
          period={period}
          onPeriodChange={setPeriod}
          dateLabel={auditData ? `${auditData.period.start} to ${auditData.period.end}` : undefined}
        />

        {/* Main Content Area */}
        {isLoadingAudit ? (
          /* Skeleton Loader */
          <div className="space-y-6 animate-pulse">
            <div className="h-28 bg-gray-200 rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        ) : errorMsg ? (
          /* Error Box */
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700 space-y-3">
            <AlertCircle size={28} className="mx-auto text-red-500" />
            <p className="text-sm font-semibold">{errorMsg}</p>
            <button
              onClick={() => selectedEmployee && setSelectedEmployee({ ...selectedEmployee })}
              className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Retry Loading
            </button>
          </div>
        ) : auditData ? (
          <>
            {/* Employee Profile Header */}
            <EmployeeProfileHeader employee={auditData.employee} template={auditData.template} />

            {/* Performance Summary Text */}
            <PerformanceSummary summary={auditData.summary} />

            {/* Dynamic Dashboard: Sales Executive vs Technician */}
            {auditData.template === 'technician' ? (
              <TechnicianAuditDashboard auditData={auditData} />
            ) : (
              <SalesAuditDashboard auditData={auditData} />
            )}

            {/* Performance Progress Indicators */}
            <PerformanceIndicators
              indicators={auditData.performance_indicators}
              template={auditData.template}
            />

            {/* Daily Breakdown Table */}
            <DailyBreakdownTable breakdown={breakdown} template={auditData.template} />

            {/* Chronological Activity Timeline */}
            <ActivityTimeline timeline={timeline} />
          </>
        ) : (
          <div className="bg-white border border-border rounded-xl p-8 text-center text-muted text-sm shadow-xs">
            Select an employee from the dropdown above to view audit metrics.
          </div>
        )}
      </main>
    </AppShell>
  );
}
