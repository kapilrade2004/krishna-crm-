'use client';

import React from 'react';
import { UserCheck, Wrench, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

interface TechnicianAuditDashboardProps {
  auditData: {
    attendance: {
      applicable_working_days: number;
      present_days: number;
      attendance_percentage: number;
    };
    technician: {
      jobs_assigned: number;
      jobs_accepted: number;
      jobs_completed: number;
      pending_jobs: number;
      cancelled_jobs: number;
      completion_percentage: number;
      average_job_completion_time_minutes: number;
      installations: number;
      repairs: number;
      maintenance_visits: number;
      customer_visits: number;
    };
  };
}

export default function TechnicianAuditDashboard({ auditData }: TechnicianAuditDashboardProps) {
  const { attendance, technician } = auditData;
  const avgHours = (technician.average_job_completion_time_minutes / 60).toFixed(1);

  return (
    <div className="space-y-6">
      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Attendance</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              {attendance.present_days} <span className="text-sm font-normal text-muted">/ {attendance.applicable_working_days} Days</span>
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Attendance Rate</span>
              <span className="font-bold text-emerald-600">{attendance.attendance_percentage}%</span>
            </div>
          </div>
        </div>

        {/* Jobs Assigned KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Jobs Assigned</span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Wrench size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              {technician.jobs_assigned}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Accepted Jobs</span>
              <span className="font-semibold text-purple-600">{technician.jobs_accepted} Jobs</span>
            </div>
          </div>
        </div>

        {/* Jobs Completed KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Jobs Completed</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              {technician.jobs_completed}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Pending Jobs</span>
              <span className="font-semibold text-amber-800">{technician.pending_jobs} Pending</span>
            </div>
          </div>
        </div>

        {/* Completion Rate KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Completion Rate</span>
            <div className="w-9 h-9 rounded-lg bg-amber/20 text-amber-700 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              {technician.completion_percentage}%
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Avg Job Time</span>
              <span className="font-semibold text-navy">{technician.average_job_completion_time_minutes} mins (~{avgHours}h)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Service Activity & Job Performance Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Activity Breakdown */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Wrench className="text-amber" size={18} />
            <h3 className="text-sm font-bold text-navy">Field Service Activity</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
              <p className="text-purple-800 font-medium">Installations</p>
              <p className="text-xl font-bold text-purple-900 mt-1">{technician.installations}</p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-blue-800 font-medium">Repairs Performed</p>
              <p className="text-xl font-bold text-blue-900 mt-1">{technician.repairs}</p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
              <p className="text-emerald-800 font-medium">Maintenance Visits</p>
              <p className="text-xl font-bold text-emerald-900 mt-1">{technician.maintenance_visits}</p>
            </div>

            <div className="p-3 bg-amber/10 border border-amber/20 rounded-lg">
              <p className="text-amber-900 font-medium">Customer Site Visits</p>
              <p className="text-xl font-bold text-amber-900 mt-1">{technician.customer_visits}</p>
            </div>
          </div>
        </div>

        {/* Job Performance & Status Breakdown */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Clock className="text-amber" size={18} />
            <h3 className="text-sm font-bold text-navy">Job Completion & Efficiency</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
              <span className="text-navy font-medium">Jobs Assigned vs Accepted</span>
              <span className="font-bold text-navy">{technician.jobs_assigned} assigned / {technician.jobs_accepted} accepted</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="font-medium text-emerald-800">Completed Service Jobs</span>
              <span className="font-bold text-emerald-700">{technician.jobs_completed} jobs ({technician.completion_percentage}%)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-amber/10 border border-amber/20 rounded-lg">
              <span className="text-amber-900 font-medium">Pending Service Jobs</span>
              <span className="font-bold text-amber-800">{technician.pending_jobs} jobs</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
              <span className="text-navy font-medium">Average Job Turnaround Time</span>
              <span className="font-bold text-navy">{technician.average_job_completion_time_minutes} minutes per job</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
