'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  BarChart3,
  Calendar,
  Layers,
  Award,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import {
  useDailyActivities,
  useDailyActivityCalendarOverview,
  useDailyActivitySummary,
  useDailyActivityAnalytics,
} from '@/hooks/useApi';
import { Button, Spinner, EmptyState } from '@/components/ui';
import DayTimelineStrip from './DayTimelineStrip';
import EmployeeDailyWorkspace from './EmployeeDailyWorkspace';
import MasterTaskBoard from './MasterTaskBoard';
import DailyScorecardView from './DailyScorecardView';
import TaskAssignerModal from './TaskAssignerModal';
import TaskDetailModal from './TaskDetailModal';

function getFormattedDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

export default function DailyActivitiesView() {
  const { user } = useAuthStore();
  const todayStr = getFormattedDate(0);

  // Active Tab State: 'workspace' | 'master' | 'scorecard' | 'analytics'
  const [activeTab, setActiveTab] = useState<'workspace' | 'master' | 'scorecard' | 'analytics'>('workspace');

  // Day Timeline State
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Master Board Filter States
  const [masterEmployeeId, setMasterEmployeeId] = useState<string>('ALL');
  const [masterDayFilter, setMasterDayFilter] = useState<string>('today');
  const [masterCustomDate, setMasterCustomDate] = useState<string>('');
  const [masterStatusFilter, setMasterStatusFilter] = useState<string>('ALL');
  const [masterPriorityFilter, setMasterPriorityFilter] = useState<string>('ALL');
  const [masterSearch, setMasterSearch] = useState<string>('');

  // Analytics filter
  const [analyticsRoleFilter, setAnalyticsRoleFilter] = useState<string>('all');

  // Modal States
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const userRole = (user?.role || '').toLowerCase();
  const isSuperAdmin =
    userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || user?.permissions?.includes('*');
  const isManagerOrHr = userRole === 'manager' || userRole === 'hr';
  const hasCreatePerm =
    isSuperAdmin ||
    isManagerOrHr ||
    user?.permissions?.includes('daily_activities:create') ||
    user?.permissions?.includes('daily_tasks:create') ||
    user?.permissions?.includes('tasks:create');

  // Default to master board for super admin if preferred, or workspace
  useEffect(() => {
    if (isSuperAdmin) {
      // Allow super admin to toggle between workspace and master board
    }
  }, [isSuperAdmin]);

  // Queries
  // 1. Calendar Overview for Timeline Strip
  const { data: calendarOverview = [] } = useDailyActivityCalendarOverview();

  // 2. Day-specific tasks for workspace
  const { data: workspaceApiData, isLoading: loadingWorkspace } = useDailyActivities({
    scheduled_date: selectedDate,
  });

  // 3. Daily Summary KPIs
  const { data: summaryApiData } = useDailyActivitySummary({
    date: selectedDate,
  });

  // 4. Master Board tasks (when activeTab is master or for global tracking)
  const masterParams: Record<string, unknown> = {};
  if (masterEmployeeId !== 'ALL') masterParams.assigned_to = masterEmployeeId;
  if (masterCustomDate) {
    masterParams.scheduled_date = masterCustomDate;
  } else if (masterDayFilter && masterDayFilter !== 'all') {
    masterParams.day_filter = masterDayFilter;
  }
  if (masterStatusFilter !== 'ALL') masterParams.status = masterStatusFilter;
  if (masterPriorityFilter !== 'ALL') masterParams.priority = masterPriorityFilter;
  if (masterSearch.trim()) masterParams.search = masterSearch.trim();

  const { data: masterApiData, isLoading: loadingMaster } = useDailyActivities(masterParams);

  // 5. Analytics
  const { data: analyticsData = [], isLoading: loadingAnalytics } = useDailyActivityAnalytics({
    role: analyticsRoleFilter !== 'all' ? analyticsRoleFilter : undefined,
  });

  const workspaceTasks = workspaceApiData?.data?.activities || [];
  const masterTasks = masterApiData?.data?.activities || [];
  const dailySummary = summaryApiData?.stats;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Tab Navigation Bar ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-navy flex items-center gap-2">
            <Activity className="text-amber-500" size={24} />
            <span>Daily Task & Operational Management</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Real-time day-to-day workforce execution, task timeline distribution & productivity tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Main Navigation Tabs */}
          <div className="flex items-center bg-white border border-border rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'workspace'
                  ? 'bg-amber text-navy shadow-xs'
                  : 'text-muted hover:text-navy'
              }`}
            >
              <Layers size={13} />
              <span>Workspace</span>
            </button>

            {(isSuperAdmin || isManagerOrHr) && (
              <button
                onClick={() => setActiveTab('master')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'master'
                    ? 'bg-amber text-navy shadow-xs'
                    : 'text-muted hover:text-navy'
                }`}
              >
                <ShieldCheck size={13} />
                <span>Master Board</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('scorecard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'scorecard'
                  ? 'bg-amber text-navy shadow-xs'
                  : 'text-muted hover:text-navy'
              }`}
            >
              <Award size={13} />
              <span>Scorecard</span>
            </button>

            {(isSuperAdmin || isManagerOrHr) && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-amber text-navy shadow-xs'
                    : 'text-muted hover:text-navy'
                }`}
              >
                <BarChart3 size={13} />
                <span>Performance</span>
              </button>
            )}
          </div>

          {/* Quick Assign Task Button */}
          {hasCreatePerm && (
            <Button
              onClick={() => setAssignModalOpen(true)}
              className="btn-primary flex items-center gap-1.5 shadow-sm text-xs"
            >
              <Plus size={15} />
              <span>Assign Daily Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Interactive Day Timeline Strip & Side KPI Boxes (Always Visible in Workspace Tab) ── */}
      {activeTab === 'workspace' && (
        <DayTimelineStrip
          selectedDate={selectedDate}
          onSelectDate={(d) => setSelectedDate(d)}
          calendarOverview={calendarOverview}
          dailySummary={dailySummary}
          tasks={workspaceTasks}
        />
      )}

      {/* ── Tab 1: Employee Daily Workspace ───────────────────────────────── */}
      {activeTab === 'workspace' && (
        <EmployeeDailyWorkspace
          selectedDate={selectedDate}
          onSelectDate={(d) => setSelectedDate(d)}
          tasks={workspaceTasks}
          dailySummary={dailySummary}
          isLoading={loadingWorkspace}
          onOpenTaskDetail={(id) => setSelectedTaskId(id)}
        />
      )}

      {/* ── Tab 2: Super Admin / Manager Master Task Board ─────────────────── */}
      {activeTab === 'master' && (isSuperAdmin || isManagerOrHr) && (
        <MasterTaskBoard
          tasks={masterTasks}
          isLoading={loadingMaster}
          onOpenAssignModal={() => setAssignModalOpen(true)}
          onOpenTaskDetail={(id) => setSelectedTaskId(id)}
          selectedEmployeeId={masterEmployeeId}
          onSelectEmployeeId={setMasterEmployeeId}
          dayFilter={masterDayFilter}
          onSelectDayFilter={setMasterDayFilter}
          customDate={masterCustomDate}
          onSelectCustomDate={setMasterCustomDate}
          statusFilter={masterStatusFilter}
          onSelectStatusFilter={setMasterStatusFilter}
          priorityFilter={masterPriorityFilter}
          onSelectPriorityFilter={setMasterPriorityFilter}
          search={masterSearch}
          onSearchChange={setMasterSearch}
        />
      )}

      {/* ── Tab 3: Personal Productivity Scorecard ─────────────────────────── */}
      {activeTab === 'scorecard' && <DailyScorecardView />}

      {/* ── Tab 4: Performance Analytics Matrix (HR & Super Admin) ─────────── */}
      {activeTab === 'analytics' && (isSuperAdmin || isManagerOrHr) && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-white shadow-xs border border-border">
            <div>
              <h3 className="text-sm font-bold text-navy flex items-center gap-1.5">
                <TrendingUp size={16} className="text-amber-600" /> Employee Activity Performance Matrix
              </h3>
              <p className="text-xs text-muted">
                Formula: Completion Rate = (Completed Activities ÷ Assigned Activities) × 100
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">Filter Role:</span>
              <select
                value={analyticsRoleFilter}
                onChange={(e) => setAnalyticsRoleFilter(e.target.value)}
                className="form-select py-1 text-xs w-36"
              >
                <option value="all">All Roles</option>
                <option value="employee">Employee</option>
                <option value="sales">Sales</option>
                <option value="telecaller">Telecaller</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
              </select>
            </div>
          </div>

          {loadingAnalytics ? (
            <div className="py-20 flex justify-center">
              <Spinner />
            </div>
          ) : analyticsData.length === 0 ? (
            <EmptyState
              title="No Employee Analytics Found"
              description="No activity records match the selected role filter."
            />
          ) : (
            <div className="card p-0 overflow-hidden shadow-xs border border-border">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Assigned</th>
                      <th>In Progress</th>
                      <th>Completed</th>
                      <th>Blocked / Issue</th>
                      <th>Late</th>
                      <th>Incomplete</th>
                      <th>Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.map((row) => (
                      <tr key={row.user.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber/20 text-navy font-bold text-xs flex items-center justify-center">
                              {row.user.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-navy text-xs">{row.user.name}</p>
                              <p className="text-[10px] text-muted">{row.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded bg-surface border border-border text-[10px] font-mono uppercase text-navy">
                            {row.user.role}
                          </span>
                        </td>
                        <td className="font-bold text-navy">{row.assigned}</td>
                        <td className="text-purple-700 font-semibold">{row.in_progress}</td>
                        <td className="text-teal-700 font-bold">{row.completed}</td>
                        <td className="text-rose-600 font-semibold">{row.blocked || 0}</td>
                        <td className="text-amber-700 font-semibold">{row.late}</td>
                        <td className="text-rose-600 font-semibold">{row.incomplete}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-2 rounded-full ${
                                  row.completion_rate >= 80
                                    ? 'bg-teal-500'
                                    : row.completion_rate >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(row.completion_rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-navy">{row.completion_rate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <TaskAssignerModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        preSelectedDate={selectedDate}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
