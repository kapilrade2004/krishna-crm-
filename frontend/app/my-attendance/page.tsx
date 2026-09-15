'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Badge, PageLoader } from '@/components/ui';
import { fmtDate } from '@/lib/utils';
import {
  Fingerprint, Clock, Calendar, CheckCircle2, AlertCircle, AlertTriangle,
  RefreshCw, ShieldCheck, ArrowDownRight, ArrowUpRight, Play, Square,
  CheckCircle, History, Info, ChevronLeft, ChevronRight, UserCheck
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth';
import type { AttendanceDay } from '@/types';
import AttendanceCorrectionModal from '@/components/biometric/AttendanceCorrectionModal';

interface PunchEvent {
  id: string;
  punch_timestamp: string;
  punch_direction: string;
  device_serial_number: string;
  source: string;
}

interface MyAttendanceData {
  employee: {
    id: string;
    employee_code: string;
    name: string;
    department: string;
    designation: string;
    biometric_enrolled: boolean;
    biometric_code: string | null;
  };
  today: {
    id?: string;
    date: string;
    status: string;
    clock_in?: string | null;
    first_in?: string | null;
    clock_out?: string | null;
    last_out?: string | null;
    work_hours?: number;
    break_hours?: number;
    late_minutes?: number;
    early_leave_minutes?: number;
  };
  today_punches: PunchEvent[];
  records: any[];
  summary: {
    month: string;
    total_days_tracked: number;
    present_days: number;
    late_days: number;
    half_days: number;
    absent_days: number;
    total_work_hours: number;
    average_hours_per_day: number;
  };
}

export default function MyAttendancePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<MyAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceDay | null>(null);

  const fetchMyAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hr/attendance/me', {
        params: { month: selectedMonth },
      });
      const payload = res.data?.data;
      if (payload) {
        setData(payload);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchMyAttendance();
  }, [fetchMyAttendance]);

  const handleClockIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/hr/attendance/clock-in', {});
      toast.success('Clocked in successfully! Punch registered in biometric engine.');
      fetchMyAttendance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Clock in failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    setActionLoading(true);
    try {
      await api.post('/hr/attendance/clock-out', {});
      toast.success('Clocked out successfully! Shift hours updated.');
      fetchMyAttendance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Clock out failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PRESENT':
      case 'OVERTIME':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"><CheckCircle2 className="w-3 h-3" /> Present</span>;
      case 'LATE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-300 dark:border-amber-800"><AlertTriangle className="w-3 h-3" /> Late Arrival</span>;
      case 'HALF_DAY':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-300 dark:border-orange-800"><Clock className="w-3 h-3" /> Half Day</span>;
      case 'ON_LEAVE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-300 dark:border-blue-800"><Calendar className="w-3 h-3" /> On Leave</span>;
      case 'ABSENT':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-300 dark:border-rose-800"><AlertCircle className="w-3 h-3" /> Absent</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Not Recorded</span>;
    }
  };

  const todayStatus = data?.today?.status || 'NOT_RECORDED';
  const todayIn = data?.today?.clock_in || data?.today?.first_in;
  const todayOut = data?.today?.clock_out || data?.today?.last_out;
  const todayHours = data?.today?.work_hours || 0;

  return (
    <AppShell>
      <Topbar title="My Attendance" subtitle="Personal biometric attendance punches, shift hours & history" />

      <main className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium">
                <Fingerprint className="w-3.5 h-3.5" />
                <span>SmartOffice Biometric Sync Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {data?.employee?.name || user?.name || 'Staff Member'}
              </h1>
              <p className="text-sm text-slate-300">
                Employee Code: <span className="font-mono text-indigo-200 font-semibold">{data?.employee?.employee_code || '—'}</span> &bull; {data?.employee?.designation || 'Staff'} &bull; {data?.employee?.department || 'General'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-center min-w-[120px]">
                <p className="text-xs text-slate-300 font-medium">Machine Enrolled</p>
                <div className="mt-1 flex items-center justify-center gap-1.5 font-semibold text-sm">
                  {data?.employee?.biometric_enrolled ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> Enrolled
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> Pending
                    </span>
                  )}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={fetchMyAttendance}
                disabled={loading}
                className="bg-white/15 hover:bg-white/25 text-white border-white/20"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Live Today's Attendance Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Today&apos;s Shift Activity</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {getStatusBadge(todayStatus)}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    user
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300'
                  }`}
                  title="CRM Application Session State (independent of Biometric punch)"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      user ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-400'
                    }`}
                  />
                  CRM: {user ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" /> First In (Clock-In)
                </p>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                  {todayIn || '— : —'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Shift Start: 10:00 AM</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" /> Last Out (Clock-Out)
                </p>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-2">
                  {todayOut || '— : —'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Shift End: 06:00 PM</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" /> Total Work Hours
                </p>
                <p className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-2">
                  {todayHours ? `${todayHours} hrs` : '0.0 hrs'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Target: 8.0 hrs</p>
              </div>
            </div>

            {/* Manual Clock Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Info className="w-4 h-4 text-slate-400" />
                <span>BioMax punches take priority. Web punches are tagged as MANUAL.</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleClockIn}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Clock In Now
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleClockOut}
                  disabled={actionLoading}
                  className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Square className="w-3.5 h-3.5 mr-1.5" />
                  Clock Out Now
                </Button>
              </div>
            </div>
          </div>

          {/* Today's Punch Stream / Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-500" /> Today&apos;s Punches Stream
            </h3>
            <p className="text-xs text-slate-500 mt-1">Raw events captured from terminal & web</p>

            <div className="mt-4 flex-1 overflow-y-auto max-h-64 space-y-2.5">
              {!data?.today_punches || data.today_punches.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No punches recorded today yet.
                </div>
              ) : (
                data.today_punches.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${p.punch_direction === 'IN' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {p.punch_direction}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({p.source || 'BIOMETRIC'})
                      </span>
                    </div>
                    <span className="font-mono text-slate-600 dark:text-slate-400 font-medium">
                      {new Date(p.punch_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Monthly Performance KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Present Days</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {data?.summary?.present_days ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Late Arrivals</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {data?.summary?.late_days ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Half Days</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
              {data?.summary?.half_days ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Absent Days</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {data?.summary?.absent_days ?? 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Work Hours</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {data?.summary?.total_work_hours ?? 0}h
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Daily Average</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {data?.summary?.average_hours_per_day ?? 0}h
            </p>
          </div>
        </div>

        {/* Monthly Attendance Log Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Attendance Register</h3>
              <p className="text-xs text-slate-500">Day-by-day punch breakdown and calculated work hours</p>
            </div>

            {/* Month selector */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 px-2 py-1 outline-none"
              />
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <PageLoader />
            </div>
          ) : !data?.records || data.records.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              No attendance records found for {selectedMonth}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-4 py-3">Shift Schedule</th>
                    <th className="px-4 py-3">Clock In</th>
                    <th className="px-4 py-3">Clock Out</th>
                    <th className="px-4 py-3">Work Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.records.map((rec: any) => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        {fmtDate(rec.date)}
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                        {rec.shift?.shift_name || 'General (10:00 - 18:00)'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                        {rec.first_in || '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                        {rec.last_out || '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {rec.work_hours ? `${rec.work_hours} hrs` : '0 hrs'}
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusBadge(rec.status)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setCorrectingRecord({
                            id: rec.id,
                            employee_id: rec.employee_id,
                            employee_name: data.employee.name,
                            date: rec.date,
                            clock_in: rec.first_in,
                            clock_out: rec.last_out,
                            status: rec.status,
                            work_hours: rec.work_hours,
                            late_minutes: rec.late_minutes,
                            early_leave_minutes: rec.early_leave_minutes,
                            overtime_minutes: rec.overtime_minutes,
                          } as any)}
                          className="text-xs h-7 px-2.5"
                        >
                          Correction
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Attendance Correction Modal */}
      {correctingRecord && (
        <AttendanceCorrectionModal
          isOpen={Boolean(correctingRecord)}
          onClose={() => setCorrectingRecord(null)}
          attendanceDay={correctingRecord}
          onSuccess={fetchMyAttendance}
        />
      )}
    </AppShell>
  );
}
