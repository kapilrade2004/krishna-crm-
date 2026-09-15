'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  Trash2,
  Edit2,
  Tag,
  Activity,
  Play,
  CheckCheck,
  List,
  LayoutGrid,
} from 'lucide-react';
import { DailyActivity, DailyActivityStatus } from '@/types';
import { useAuthStore, User } from '@/lib/auth';
import {
  useDeleteDailyActivity,
  useDailyActivityAssignableUsers,
  useStartDailyActivity,
  useCompleteDailyActivity,
} from '@/hooks/useApi';
import { Badge, Spinner, EmptyState, Button } from '@/components/ui';
import toast from 'react-hot-toast';

function getFormattedDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

interface MasterTaskBoardProps {
  tasks: DailyActivity[];
  isLoading: boolean;
  onOpenAssignModal: () => void;
  onOpenTaskDetail: (taskId: string) => void;
  selectedEmployeeId: string;
  onSelectEmployeeId: (id: string) => void;
  dayFilter: string;
  onSelectDayFilter: (df: string) => void;
  customDate: string;
  onSelectCustomDate: (cd: string) => void;
  statusFilter: string;
  onSelectStatusFilter: (sf: string) => void;
  priorityFilter: string;
  onSelectPriorityFilter: (pf: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
}

export default function MasterTaskBoard({
  tasks,
  isLoading,
  onOpenAssignModal,
  onOpenTaskDetail,
  selectedEmployeeId,
  onSelectEmployeeId,
  dayFilter,
  onSelectDayFilter,
  customDate,
  onSelectCustomDate,
  statusFilter,
  onSelectStatusFilter,
  priorityFilter,
  onSelectPriorityFilter,
  search,
  onSearchChange,
}: MasterTaskBoardProps) {
  const { user } = useAuthStore();
  const deleteMutation = useDeleteDailyActivity();
  const startMutation = useStartDailyActivity();
  const completeMutation = useCompleteDailyActivity();

  const { data: assignableUsers = [] } = useDailyActivityAssignableUsers();

  const todayStr = getFormattedDate(0);

  // View Mode: 'line' (default across CRM) | 'card'
  const [viewMode, setViewMode] = useState<'line' | 'card'>('line');

  // Workforce KPIs
  const totalEmployees = assignableUsers.length;
  const todayTasks = tasks.filter((t) => (t.scheduled_date || t.assigned_at?.split('T')[0]) === todayStr);
  const todayCompleted = todayTasks.filter((t) => ['COMPLETED', 'LATE'].includes(t.status)).length;
  const todayInProgress = todayTasks.filter((t) => ['IN_PROGRESS'].includes(t.status)).length;
  const todayPending = todayTasks.filter((t) => ['ASSIGNED', 'pending', 'PENDING'].includes(t.status)).length;
  const todayBlocked = todayTasks.filter((t) => ['BLOCKED', 'INCOMPLETE'].includes(t.status)).length;

  const todayCompletionRate = todayTasks.length > 0 ? Math.round((todayCompleted / todayTasks.length) * 100) : 0;
  const overdueCount = tasks.filter(
    (t) => (t.due_date || t.scheduled_date || '') < todayStr && !['COMPLETED', 'LATE'].includes(t.status)
  ).length;

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete daily task "${title}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: DailyActivityStatus) => {
    switch (status) {
      case 'ASSIGNED':
      case 'pending':
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <Clock size={10} /> Assigned
          </span>
        );
      case 'IN_PROGRESS':
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
            <Activity size={10} className="animate-pulse" /> In Progress
          </span>
        );
      case 'COMPLETED':
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle2 size={10} /> Completed
          </span>
        );
      case 'BLOCKED':
      case 'INCOMPLETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle size={10} /> Blocked
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle size={10} /> Late
          </span>
        );
      default:
        return <Badge label={status} />;
    }
  };

  const getPriorityBadge = (p?: string) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Low</span>;
      default:
        return <Badge label={p || 'Medium'} />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner with Quick Actions */}
      <div className="card p-4.5 bg-gradient-to-r from-navy via-slate to-navy text-white rounded-2xl border-none shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber text-navy flex items-center justify-center font-bold shadow-xs">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">
              Master Daily Task Tracking Board
            </h2>
            <p className="text-xs text-white/70 mt-0.5">
              Super Admin & Executive tracking view: Monitor task status, progress remarks, and logged hours across the organization.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onOpenAssignModal} className="btn-primary flex items-center gap-1.5 shadow-sm text-xs">
            <PlusCircle size={15} />
            <span>Assign New Task</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5 bg-white border border-border flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted block">Active Workforce</span>
            <div className="text-2xl font-black text-navy">{totalEmployees}</div>
            <span className="text-[11px] text-muted font-medium mt-0.5 block">Managed employees</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
        </div>

        <div className="card p-3.5 bg-white border border-border flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-blue-600 block">Today&apos;s Tasks</span>
            <div className="text-2xl font-black text-navy">{todayTasks.length}</div>
            <span className="text-[11px] text-muted font-medium mt-0.5 block">Scheduled for today</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Calendar size={20} />
          </div>
        </div>

        <div className="card p-3.5 bg-white border border-border flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-teal-600 block">Today&apos;s Completion</span>
            <div className="text-2xl font-black text-teal-700">{todayCompletionRate}%</div>
            <span className="text-[11px] text-teal-600 font-bold mt-0.5 block">
              {todayCompleted} of {todayTasks.length} done
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="card p-3.5 bg-white border border-border flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-rose-600 block">Overdue Tasks</span>
            <div className={`text-2xl font-black ${overdueCount > 0 ? 'text-rose-600' : 'text-navy'}`}>
              {overdueCount}
            </div>
            <span className="text-[11px] text-muted font-medium mt-0.5 block">Needs follow-up</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle size={20} />
          </div>
        </div>
      </div>

      {/* Real-Time Today Progress Bar */}
      {todayTasks.length > 0 && (
        <div className="card p-4 bg-white border border-border shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-navy flex items-center gap-1.5">
              <Activity size={14} className="text-amber-600" /> Today&apos;s Live Execution Breakdown
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500" /> Completed: {todayCompleted}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> In Progress: {todayInProgress}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Pending: {todayPending}</span>
              {todayBlocked > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Blocked: {todayBlocked}</span>}
            </div>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
            <div style={{ width: `${(todayCompleted / todayTasks.length) * 100}%` }} className="bg-teal-500 transition-all duration-300" title={`Completed: ${todayCompleted}`} />
            <div style={{ width: `${(todayInProgress / todayTasks.length) * 100}%` }} className="bg-purple-500 transition-all duration-300" title={`In Progress: ${todayInProgress}`} />
            <div style={{ width: `${(todayPending / todayTasks.length) * 100}%` }} className="bg-blue-400 transition-all duration-300" title={`Pending: ${todayPending}`} />
            <div style={{ width: `${(todayBlocked / todayTasks.length) * 100}%` }} className="bg-rose-500 transition-all duration-300" title={`Blocked: ${todayBlocked}`} />
          </div>
        </div>
      )}

      {/* Day-to-Day Timeline Selector Bar */}
      <div className="card p-3 bg-white border border-border shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'today', label: "Today's Tasks" },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'all', label: 'All Dates' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelectDayFilter(item.id);
                onSelectCustomDate('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                dayFilter === item.id && !customDate
                  ? 'bg-amber text-navy shadow-xs'
                  : 'bg-surface hover:bg-slate-200 text-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted font-medium">Custom Date:</span>
          <input
            type="date"
            value={customDate}
            onChange={(e) => {
              onSelectCustomDate(e.target.value);
              onSelectDayFilter('');
            }}
            className="form-input text-xs py-1"
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-3.5 bg-white border border-border flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search across all employee tasks, instructions, notes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="form-input pl-8 text-xs py-1.5"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Employee Filter */}
          <div className="flex items-center gap-1">
            <Users size={12} className="text-muted" />
            <select
              value={selectedEmployeeId}
              onChange={(e) => onSelectEmployeeId(e.target.value)}
              className="form-select text-xs py-1 w-40"
            >
              <option value="ALL">All Employees</option>
              {assignableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onSelectStatusFilter(e.target.value)}
            className="form-select text-xs py-1 w-32"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="LATE">Late</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => onSelectPriorityFilter(e.target.value)}
            className="form-select text-xs py-1 w-28"
          >
            <option value="ALL">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* View Switcher: Line View (Default across CRM) vs Card View */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('line')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'line'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-slate-600 hover:text-navy hover:bg-white/60'
              }`}
              title="Line View (Default Table Rows)"
            >
              <List size={12} />
              <span>Line</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-slate-600 hover:text-navy hover:bg-white/60'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid size={12} />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Master Task List */}
      {isLoading ? (
        <div className="py-24 flex justify-center items-center">
          <Spinner />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<Calendar size={48} className="text-muted/40" />}
          title="No Tasks Found in Master Board"
          description="No tasks match the active filters or date selection. Try assigning a new task or switching filters."
          action={
            <Button onClick={onOpenAssignModal} className="btn-primary mt-2">
              <PlusCircle size={14} /> Assign Task
            </Button>
          }
        />
      ) : viewMode === 'line' ? (
        <div className="bg-white border border-border rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-border">
                <tr>
                  <th className="p-3">Status</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Task Title &amp; Details</th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Scheduled Date</th>
                  <th className="p-3">Logged Time</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 whitespace-nowrap">{getStatusBadge(t.status)}</td>
                    <td className="p-3 whitespace-nowrap">{getPriorityBadge(t.priority)}</td>
                    <td className="p-3 min-w-[240px]">
                      <div
                        onClick={() => onOpenTaskDetail(t.id)}
                        className="font-bold text-navy hover:text-amber-600 cursor-pointer transition-colors"
                      >
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="text-[11px] text-muted line-clamp-1 mt-0.5">{t.description}</div>
                      )}
                      {t.category && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-mono text-[9px] border border-purple-100 mt-1">
                          <Tag size={9} /> {t.category}
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-semibold text-navy bg-surface px-2 py-0.5 rounded border border-border text-[11px]">
                        {t.assignee?.name || 'Employee'}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-700 font-medium">
                      {t.scheduled_date || 'Today'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {Number(t.actual_hours) > 0 ? (
                        <span className="text-teal-700 font-bold">{t.actual_hours}h</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenTaskDetail(t.id)}
                          className="btn btn-ghost py-1 px-2 text-xs text-muted hover:text-navy"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleDelete(t.id, t.title)}
                          className="btn btn-ghost py-1 px-1.5 text-xs text-muted hover:text-rose-600"
                          title="Delete Task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tasks.map((t) => {
            const isCompleted = ['COMPLETED', 'completed', 'LATE'].includes(t.status);
            const isInProgress = ['IN_PROGRESS', 'in_progress'].includes(t.status);
            const isBlocked = ['BLOCKED', 'INCOMPLETE'].includes(t.status);

            return (
              <div
                key={t.id}
                className={`card p-4 rounded-xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                  isCompleted
                    ? 'bg-teal-50/15 border-teal-200'
                    : isInProgress
                    ? 'bg-purple-50/15 border-purple-200'
                    : isBlocked
                    ? 'bg-rose-50/15 border-rose-200'
                    : 'bg-white border-border hover:border-amber-400'
                }`}
              >
                <div>
                  {/* Top Bar: Status + Priority + Category */}
                  <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {getStatusBadge(t.status)}
                      {t.category && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-slate-700 font-mono text-[9px] border border-border">
                          <Tag size={9} /> {t.category}
                        </span>
                      )}
                    </div>
                    {getPriorityBadge(t.priority)}
                  </div>

                  {/* Task Title */}
                  <h3
                    onClick={() => onOpenTaskDetail(t.id)}
                    className="font-extrabold text-navy text-sm leading-snug mb-1 cursor-pointer hover:text-amber-600 transition-colors line-clamp-2"
                  >
                    {t.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                    {t.description}
                  </p>

                  {/* Assignee & Dates Card */}
                  <div className="p-2.5 rounded-lg bg-surface/70 border border-border/80 text-xs space-y-1 mb-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[11px]">Assignee:</span>
                      <span className="font-bold text-navy bg-white px-2 py-0.5 rounded border border-border text-[11px]">
                        {t.assignee?.name || 'Employee'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted text-[11px]">
                      <span>Scheduled Date:</span>
                      <span className="text-slate-800 font-semibold">{t.scheduled_date || 'Today'}</span>
                    </div>
                    {Number(t.actual_hours) > 0 && (
                      <div className="flex items-center justify-between text-muted text-[11px]">
                        <span>Logged Time:</span>
                        <span className="text-teal-700 font-bold">{t.actual_hours}h</span>
                      </div>
                    )}
                  </div>

                  {t.completion_notes && (
                    <div className="p-2 rounded bg-amber-50/60 border border-amber-200 text-[11px] text-amber-900 italic mb-2">
                      <span className="font-bold not-italic text-navy text-[10px] block">Outcome:</span>
                      &ldquo;{t.completion_notes}&rdquo;
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2 mt-1">
                  <button
                    onClick={() => onOpenTaskDetail(t.id)}
                    className="btn btn-ghost py-1 px-2 text-xs text-muted hover:text-navy"
                  >
                    Details & Audit
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(t.id, t.title)}
                      className="btn btn-ghost py-1 px-2 text-xs text-muted hover:text-rose-600"
                      title="Delete Task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
