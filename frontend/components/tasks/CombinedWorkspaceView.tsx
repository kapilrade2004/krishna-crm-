'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Activity,
  Calendar,
  Clock,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  TrendingUp,
  Award,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Filter,
  BarChart3,
  Columns,
  List,
  LayoutGrid,
  Layers,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import {
  useTasks,
  useUpdateTask,
  useDeleteTask,
  useSetTaskScore,
  useDailyActivities,
  useUpdateDailyActivity,
  useUsers,
} from '@/hooks/useApi';
import { Spinner, EmptyState, Modal, Input, Select, Textarea, ConfirmDialog } from '@/components/ui';
import { fmtDate, PRIORITY_COLOURS } from '@/lib/utils';
import type { Task, TaskStatus, Priority, DailyActivity, User } from '@/types';
import toast from 'react-hot-toast';

import TaskWorkspaceHeader from './TaskWorkspaceHeader';
import TaskDetailDrawer, { InspectableTask } from './TaskDetailDrawer';
import TaskFilterDrawer, { TaskFilterState } from './TaskFilterDrawer';
import TaskItemRow from './TaskItemRow';
import TaskItemCard from './TaskItemCard';
import UnifiedCreateTaskModal from './UnifiedCreateTaskModal';

function getFormattedDate(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function CombinedWorkspaceView() {
  const { user } = useAuthStore();
  const todayStr = useMemo(() => getFormattedDate(new Date()), []);

  // ── Layout & View Modes ──
  const [viewMode, setViewMode] = useState<'line' | 'card'>('line');
  const [layoutMode, setLayoutMode] = useState<'split' | 'stream'>('split');

  useEffect(() => {
    try {
      const savedView = localStorage.getItem('crm_tasks_view_mode');
      if (savedView === 'card' || savedView === 'line') setViewMode(savedView);
      const savedLayout = localStorage.getItem('crm_tasks_layout_mode');
      if (savedLayout === 'split' || savedLayout === 'stream') setLayoutMode(savedLayout);
    } catch {}
  }, []);

  const handleSetViewMode = (mode: 'line' | 'card') => {
    setViewMode(mode);
    try {
      localStorage.setItem('crm_tasks_view_mode', mode);
    } catch {}
  };

  const handleSetLayoutMode = (mode: 'split' | 'stream') => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('crm_tasks_layout_mode', mode);
    } catch {}
  };

  // ── Date Navigation ──
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const handleStepDay = (delta: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + delta);
    setSelectedDate(getFormattedDate(current));
  };

  const handleResetToToday = () => {
    setSelectedDate(todayStr);
  };

  // ── Search & Filter State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilterState>({
    search: '',
    scope: 'all',
    status: 'all',
    priority: 'all',
    assignedTo: '',
    overdueOnly: false,
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.scope !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.priority !== 'all') count++;
    if (filters.assignedTo) count++;
    if (filters.overdueOnly) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filters, searchQuery]);

  const handleResetFilters = () => {
    setFilters({
      search: '',
      scope: 'all',
      status: 'all',
      priority: 'all',
      assignedTo: '',
      overdueOnly: false,
    });
    setSearchQuery('');
  };

  // ── Toggle Window Inspector (Detail Drawer) ──
  const [inspectedTask, setInspectedTask] = useState<InspectableTask | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const handleOpenInspector = (item: InspectableTask) => {
    setInspectedTask(item);
    setDetailDrawerOpen(true);
  };

  // ── Creation & Edit Modals ──
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<'standard' | 'daily'>('standard');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    assigned_to: '',
    due_date: '',
    status: 'todo' as TaskStatus,
    notes: '',
    tags: '',
  });

  // ── Queries & Mutations ──
  const { data: dailyActivitiesRaw, isLoading: loadingDaily } = useDailyActivities({
    scheduled_date: selectedDate,
  });

  const dailyActivities: DailyActivity[] = useMemo(() => {
    if (Array.isArray(dailyActivitiesRaw?.data?.activities)) return dailyActivitiesRaw.data.activities;
    if (Array.isArray(dailyActivitiesRaw?.activities)) return dailyActivitiesRaw.activities;
    if (Array.isArray(dailyActivitiesRaw?.data)) return dailyActivitiesRaw.data;
    if (Array.isArray(dailyActivitiesRaw)) return dailyActivitiesRaw;
    return [];
  }, [dailyActivitiesRaw]);

  const { data: tasksData, isLoading: loadingTasks } = useTasks({
    limit: 200,
    sort: 'due_date:asc',
  });

  const standardTasks: Task[] = useMemo(() => {
    const raw = tasksData?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.tasks)) return (raw as any).tasks;
    if (Array.isArray(tasksData)) return tasksData as Task[];
    return [];
  }, [tasksData]);

  const { data: users = [] } = useUsers();
  const userList: User[] = useMemo(() => {
    if (Array.isArray(users)) return users;
    if (Array.isArray((users as any)?.data?.users)) return (users as any).data.users;
    if (Array.isArray((users as any)?.data)) return (users as any).data;
    return [];
  }, [users]);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const setTaskScore = useSetTaskScore();
  const updateDailyActivity = useUpdateDailyActivity();

  const canScore = Boolean(user && ['admin', 'super_admin', 'manager'].includes(user.role));
  const canDelete = (t: Task) =>
    Boolean(user && (user.role === 'admin' || user.role === 'super_admin' || t.created_by === user.id));

  // ── Filter Matching Logic ──
  const isOverdue = (dueDate?: string, isDone?: boolean) => {
    if (!dueDate || isDone) return false;
    return new Date(dueDate) < new Date();
  };

  const filteredDaily = useMemo(() => {
    if (filters.scope === 'standard') return [];
    return dailyActivities.filter((act) => {
      const isDone = act.status === 'completed' || act.status === 'COMPLETED';
      if (filters.status === 'todo' && isDone) return false;
      if (filters.status === 'completed' && !isDone) return false;
      if (filters.priority !== 'all' && act.priority !== filters.priority) return false;
      if (filters.assignedTo && act.assigned_to !== filters.assignedTo) return false;
      if (filters.overdueOnly && !isOverdue(act.due_date || act.scheduled_date, isDone)) return false;

      const q = (searchQuery || filters.search).trim().toLowerCase();
      if (q) {
        const matchesTitle = act.title?.toLowerCase().includes(q);
        const matchesDesc = act.description?.toLowerCase().includes(q);
        const matchesAssigner = (act.assigner?.name || act.assigner?.email || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAssigner) return false;
      }
      return true;
    });
  }, [dailyActivities, filters, searchQuery]);

  const filteredStandard = useMemo(() => {
    if (filters.scope === 'daily') return [];
    return standardTasks.filter((t) => {
      const isDone = t.status === 'done' || t.status === 'cancelled';
      if (filters.status === 'todo' && (t.status === 'done' || t.status === 'cancelled')) return false;
      if (filters.status === 'in_progress' && t.status !== 'in_progress') return false;
      if (filters.status === 'completed' && t.status !== 'done') return false;
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
      if (filters.assignedTo && t.assigned_to !== filters.assignedTo) return false;
      if (filters.overdueOnly && !isOverdue(t.due_date, isDone)) return false;

      const q = (searchQuery || filters.search).trim().toLowerCase();
      if (q) {
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesTags = (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
        const matchesAssignee = (t.assignedUser?.name || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesTags && !matchesAssignee) return false;
      }
      return true;
    });
  }, [standardTasks, filters, searchQuery]);

  // Unified Chronological Stream Data
  const unifiedStreamItems: InspectableTask[] = useMemo(() => {
    const list: InspectableTask[] = [
      ...filteredDaily.map((a) => ({ type: 'daily' as const, data: a })),
      ...filteredStandard.map((t) => ({ type: 'standard' as const, data: t })),
    ];
    return list.sort((a, b) => {
      const dateA = a.type === 'standard' ? a.data.due_date || a.data.created_at : a.data.due_date || a.data.scheduled_date || a.data.created_at;
      const dateB = b.type === 'standard' ? b.data.due_date || b.data.created_at : b.data.due_date || b.data.scheduled_date || b.data.created_at;
      return new Date(dateA || 0).getTime() - new Date(dateB || 0).getTime();
    });
  }, [filteredDaily, filteredStandard]);

  // Metrics
  const totalDaily = dailyActivities.length;
  const completedDaily = dailyActivities.filter(
    (a) => a.status === 'completed' || a.status === 'COMPLETED'
  ).length;
  const dailyPct = totalDaily > 0 ? Math.round((completedDaily / totalDaily) * 100) : 0;

  const totalStandard = standardTasks.length;
  const openStandard = standardTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;
  const inProgressStandard = standardTasks.filter((t) => t.status === 'in_progress').length;
  const doneStandard = standardTasks.filter((t) => t.status === 'done').length;

  // ── Handlers ──
  const handleToggleComplete = async (item: InspectableTask) => {
    if (item.type === 'daily') {
      const isDone = item.data.status === 'completed' || item.data.status === 'COMPLETED';
      const nextStatus = isDone ? 'pending' : 'completed';
      try {
        await updateDailyActivity.mutateAsync({
          id: item.data.id,
          status: nextStatus,
          note: isDone ? 'Reopened by user' : 'Completed from Unified Workspace',
        });
        toast.success(isDone ? 'Directive reopened' : 'Daily directive completed!');
      } catch {
        toast.error('Failed to update directive status.');
      }
    } else {
      const isDone = item.data.status === 'done';
      const nextStatus: TaskStatus = isDone ? 'todo' : 'done';
      try {
        await updateTask.mutateAsync({
          id: item.data.id,
          status: nextStatus,
          progress_percent: isDone ? 0 : 100,
        } as Partial<Task> & { id: string });
        toast.success(isDone ? 'Task reopened' : 'Standard task marked Done!');
      } catch {
        toast.error('Failed to update task status.');
      }
    }
  };

  const handleStatusChange = async (item: InspectableTask, nextStatus: string) => {
    if (item.type === 'daily') {
      try {
        await updateDailyActivity.mutateAsync({
          id: item.data.id,
          status: nextStatus,
          note: `Status changed to ${nextStatus}`,
        });
        toast.success(`Directive status moved to ${nextStatus.toUpperCase()}`);
      } catch {
        toast.error('Failed to update status');
      }
    } else {
      try {
        await updateTask.mutateAsync({
          id: item.data.id,
          status: nextStatus as TaskStatus,
          ...(nextStatus === 'done' ? { progress_percent: 100 } : {}),
        } as Partial<Task> & { id: string });
        toast.success(`Task moved to ${nextStatus.toUpperCase()}`);
      } catch {
        toast.error('Failed to update status');
      }
    }
  };

  const handleOpenCreateModal = (mode: 'standard' | 'daily') => {
    setCreateModalMode(mode);
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (t: Task) => {
    setEditTask(t);
    setEditForm({
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      assigned_to: t.assigned_to,
      due_date: t.due_date ? t.due_date.slice(0, 10) : '',
      status: t.status,
      notes: t.notes || '',
      tags: (t.tags || []).join(', '),
    });
  };

  const handleSaveEdit = async () => {
    if (!editTask) return;
    try {
      await updateTask.mutateAsync({
        id: editTask.id,
        ...editForm,
        tags: editForm.tags
          ? editForm.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      } as Partial<Task> & { id: string });
      setEditTask(null);
      toast.success('Task updated successfully.');
    } catch {
      toast.error('Failed to update task.');
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTask.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setDetailDrawerOpen(false);
      toast.success('Task deleted.');
    } catch {
      toast.error('Failed to delete task.');
    }
  };

  if (loadingDaily && loadingTasks) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted">
        <Spinner className="w-8 h-8" />
        <span className="text-xs font-semibold">Loading Unified Workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── 1. UNIFIED HEADER, NAVIGATION & ACTION BUTTONS ── */}
      <TaskWorkspaceHeader
        totalDaily={totalDaily}
        completedDaily={completedDaily}
        dailyPct={dailyPct}
        openStandard={openStandard}
        inProgressStandard={inProgressStandard}
        doneStandard={doneStandard}
        totalAll={totalDaily + totalStandard}
        completedAll={completedDaily + doneStandard}
        inProgressAll={inProgressStandard}
        pendingAll={Math.max(0, (totalDaily - completedDaily) + (openStandard - inProgressStandard))}
        overdueAll={
          dailyActivities.filter((a) => isOverdue(a.due_date || a.scheduled_date, a.status === 'completed' || a.status === 'COMPLETED')).length +
          standardTasks.filter((t) => isOverdue(t.due_date, t.status === 'done' || t.status === 'cancelled')).length
        }
        selectedDate={selectedDate}
        onStepDay={handleStepDay}
        onResetToday={handleResetToToday}
        onDateChange={setSelectedDate}
        onOpenCreateModal={handleOpenCreateModal}
        onToggleFilterDrawer={() => setFilterDrawerOpen(true)}
        activeFilterCount={activeFilterCount}
        viewMode={viewMode}
        onSetViewMode={handleSetViewMode}
        layoutMode={layoutMode}
        onSetLayoutMode={handleSetLayoutMode}
        showKpis={true}
      />


      {/* ── 2. STATIC SEARCH & QUICK FILTER BAR (ORIGINAL THEME, FIXED IN ONE PLACE) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tasks by title, description, tags, or assignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber text-navy font-medium transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          {/* Quick Scope Switcher */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 text-xs">
            {(['all', 'daily', 'standard'] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setFilters({ ...filters, scope: sc })}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  filters.scope === sc
                    ? 'bg-white text-navy font-bold shadow-2xs'
                    : 'text-slate-500 hover:text-navy'
                }`}
              >
                {sc === 'all' ? 'All' : sc === 'daily' ? 'Daily SOP' : 'Tickets'}
              </button>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 px-2 py-1 bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── 3. HORIZONTAL STACKED FULL-WIDTH SECTIONS ── */}
      <div className="space-y-6">
        {/* ── SECTION 1: DAILY TASKS (FULL-WIDTH HORIZONTAL CARD TABLE) ── */}
        <div className="bg-[#FFFDF7] rounded-[20px] border border-[#E7E5DE] shadow-xs overflow-hidden transition-all duration-180 hover:border-slate-300">
          {/* Section Header */}
          <div className="p-5 sm:p-6 border-b border-[#E7E5DE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
                <CheckSquare size={20} />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-navy leading-tight flex items-center gap-2">
                  <span>Daily Tasks</span>
                  <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70 px-2.5 py-0.5 rounded-full">
                    {filteredDaily.length}
                  </span>
                </h2>
                <p className="text-[12px] text-slate-400 font-medium mt-0.5">
                  Today&apos;s tasks and immediate actions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleOpenCreateModal('daily')}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all duration-180 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>+ Add Daily Task</span>
              </button>
            </div>
          </div>

          {/* Inline Filter Bar */}
          <div className="px-5 sm:px-6 py-3.5 bg-slate-50/50 border-b border-[#E7E5DE] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by task name, assigned to, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-9 text-xs border border-[#E7E5DE] rounded-full bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-navy font-medium transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="h-9 px-3.5 rounded-full text-xs font-semibold bg-white border border-[#E7E5DE] text-slate-700 hover:bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="h-9 px-3.5 rounded-full text-xs font-semibold bg-white border border-[#E7E5DE] text-slate-700 hover:bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="todo">Pending</option>
                <option value="completed">Completed</option>
              </select>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-9 px-3.5 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            {filteredDaily.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Activity size={22} />
                </div>
                <h4 className="text-sm font-bold text-navy">No daily tasks found</h4>
                <p className="text-xs text-slate-400">Add a new daily task for today&apos;s shift to get started.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E7E5DE] bg-slate-50/70 text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer" />
                    </th>
                    <th className="py-3 px-4 font-semibold">Task Name</th>
                    <th className="py-3 px-4 font-semibold">Assigned To</th>
                    <th className="py-3 px-4 font-semibold">Priority</th>
                    <th className="py-3 px-4 font-semibold">Due Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5DE]/80 text-xs">
                  {filteredDaily.map((act) => {
                    const isDone = act.status === 'completed' || act.status === 'COMPLETED';
                    const assigneeInitials = (act.assignee?.name || act.assigner?.name || 'SS')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    return (
                      <tr
                        key={act.id}
                        onClick={() => handleOpenInspector({ type: 'daily', data: act })}
                        className="hover:bg-[#F7F6F2] transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => handleToggleComplete({ type: 'daily', data: act })}
                            className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-semibold text-navy ${isDone ? 'line-through text-slate-400' : ''}`}>
                            {act.title}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {assigneeInitials}
                            </span>
                            <span className="font-medium text-slate-700">
                              {act.assignee?.name || act.assigner?.name || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                              act.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-700'
                                : act.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : act.priority === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {act.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {act.due_date || act.scheduled_date ? fmtDate(act.due_date || act.scheduled_date || '') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {isDone ? 'Completed' : 'In Progress'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 text-slate-400">
                            <button
                              type="button"
                              onClick={() => handleOpenInspector({ type: 'daily', data: act })}
                              className="p-1 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                              title="Inspect Task"
                            >
                              <ChevronRight size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleComplete({ type: 'daily', data: act })}
                              className="p-1 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                              title={isDone ? 'Reopen' : 'Mark Completed'}
                            >
                              <CheckSquare size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── SECTION 2: STANDARD TASKS (FULL-WIDTH HORIZONTAL CARD TABLE) ── */}
        <div className="bg-[#FFFDF7] rounded-[20px] border border-[#E7E5DE] shadow-xs overflow-hidden transition-all duration-180 hover:border-slate-300">
          {/* Section Header */}
          <div className="p-5 sm:p-6 border-b border-[#E7E5DE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100/80 text-amber-600 flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-navy leading-tight flex items-center gap-2">
                  <span>Standard Tasks</span>
                  <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/70 px-2.5 py-0.5 rounded-full">
                    {filteredStandard.length}
                  </span>
                </h2>
                <p className="text-[12px] text-slate-400 font-medium mt-0.5">
                  Predefined and recurring tasks &amp; project tickets
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleOpenCreateModal('standard')}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-full text-xs font-bold bg-amber text-navy hover:bg-amber-500 shadow-xs transition-all duration-180 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer shrink-0"
              >
                <Plus size={15} className="text-navy" />
                <span>+ Add Standard Task</span>
              </button>
            </div>
          </div>

          {/* Inline Filter Bar */}
          <div className="px-5 sm:px-6 py-3.5 bg-slate-50/50 border-b border-[#E7E5DE] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by task name, code, email, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-9 text-xs border border-[#E7E5DE] rounded-full bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-navy font-medium transition-all"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="h-9 px-3.5 rounded-full text-xs font-semibold bg-white border border-[#E7E5DE] text-slate-700 hover:bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="h-9 px-3.5 rounded-full text-xs font-semibold bg-white border border-[#E7E5DE] text-slate-700 hover:bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Done</option>
              </select>

              <select
                value={filters.assignedTo}
                onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
                className="h-9 px-3.5 rounded-full text-xs font-semibold bg-white border border-[#E7E5DE] text-slate-700 hover:bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="">All Roles / Assignees</option>
                {userList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-9 px-3.5 rounded-full text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            {filteredStandard.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <CheckSquare size={22} />
                </div>
                <h4 className="text-sm font-bold text-navy">No standard tasks found</h4>
                <p className="text-xs text-slate-400">Create a standard ticket to track ongoing sprint deliverables.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E7E5DE] bg-slate-50/70 text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 w-10 text-center">
                      <input type="checkbox" className="rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer" />
                    </th>
                    <th className="py-3 px-4 font-semibold">Task Name</th>
                    <th className="py-3 px-4 font-semibold">Assigned To</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold">Due Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5DE]/80 text-xs">
                  {filteredStandard.map((task) => {
                    const isDone = task.status === 'done';
                    return (
                      <tr
                        key={task.id}
                        onClick={() => handleOpenInspector({ type: 'standard', data: task })}
                        className="hover:bg-[#F7F6F2] transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => handleToggleComplete({ type: 'standard', data: task })}
                            className="rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-semibold text-navy ${isDone ? 'line-through text-slate-400' : ''}`}>
                            {task.title}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {(task.assignedUser?.name || 'U').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-medium text-slate-700">
                              {task.assignedUser?.name || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                            {task.assignedUser?.role || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {task.due_date ? fmtDate(task.due_date) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold capitalize ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-700'
                                : task.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 text-slate-400">
                            <button
                              type="button"
                              onClick={() => handleOpenInspector({ type: 'standard', data: task })}
                              className="p-1 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                              title="Inspect Task"
                            >
                              <ChevronRight size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(task)}
                              className="p-1 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                              title="Edit Task"
                            >
                              <Pencil size={15} />
                            </button>
                            {canDelete(task) && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(task)}
                                className="p-1 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                title="Delete Task"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. SLIDE-OVER TOGGLE WINDOW: TASK DETAIL INSPECTOR ── */}
      <TaskDetailDrawer
        item={inspectedTask}
        isOpen={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        onUpdateStatus={async (nextStatus) => {
          if (inspectedTask) await handleStatusChange(inspectedTask, nextStatus);
        }}
        onUpdateProgress={async (percent) => {
          if (inspectedTask?.type === 'standard') {
            await updateTask.mutateAsync({
              id: inspectedTask.data.id,
              progress_percent: percent,
              ...(percent === 100 ? { status: 'done' } : {}),
            } as Partial<Task> & { id: string });
          }
        }}
        onAddNote={async (note) => {
          if (inspectedTask?.type === 'standard') {
            const existing = (inspectedTask.data as Task).notes || '';
            const updated = existing ? `${existing}\n[${fmtDate(new Date().toISOString())}] ${note}` : note;
            await updateTask.mutateAsync({
              id: inspectedTask.data.id,
              notes: updated,
            } as Partial<Task> & { id: string });
          } else if (inspectedTask?.type === 'daily') {
            await updateDailyActivity.mutateAsync({
              id: inspectedTask.data.id,
              note,
            });
          }
        }}
        onScoreTask={async (score, comment) => {
          if (inspectedTask?.type === 'standard') {
            await setTaskScore.mutateAsync({
              id: inspectedTask.data.id,
              score,
              score_comment: comment,
            });
          }
        }}
        onOpenEdit={(t) => {
          setDetailDrawerOpen(false);
          handleOpenEdit(t);
        }}
        onDelete={() => {
          if (inspectedTask?.type === 'standard') {
            setDeleteTarget(inspectedTask.data as Task);
          }
        }}
        canScore={canScore}
        canDelete={Boolean(inspectedTask?.type === 'standard' && canDelete(inspectedTask.data as Task))}
      />

      {/* ── 5. SLIDE-OVER TOGGLE WINDOW: FILTER DRAWER ── */}
      <TaskFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        onChangeFilters={setFilters}
        onResetFilters={handleResetFilters}
        users={userList}
        matchCount={filteredDaily.length + filteredStandard.length}
      />

      {/* ── 6. UNIFIED CREATION MODAL ── */}
      <UnifiedCreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        defaultMode={createModalMode}
        preSelectedDate={selectedDate}
      />

      {/* ── 7. EDIT STANDARD TASK MODAL ── */}
      {editTask && (
        <Modal
          title="Edit Standard Ticket"
          open={!!editTask}
          onClose={() => setEditTask(null)}
        >
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Task Title *
              </label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Brief summary..."
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Description
              </label>
              <Textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Full operational instructions..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Assign To
                </label>
                <select
                  value={editForm.assigned_to}
                  onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                  className="form-input text-xs"
                >
                  <option value="">Select staff...</option>
                  {userList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Priority
                </label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as Priority })}
                  className="form-input text-xs"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Due Date
                </label>
                <Input
                  type="date"
                  value={editForm.due_date}
                  onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TaskStatus })}
                  className="form-input text-xs"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditTask(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={updateTask.isPending}
                className="px-4 py-1.5 rounded-lg bg-amber text-navy font-bold text-xs hover:bg-amber-500 shadow-2xs cursor-pointer"
              >
                {updateTask.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 8. DELETE CONFIRMATION ── */}
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Task Confirmation"
          message={`Are you sure you want to permanently delete "${deleteTarget.title}"? This action cannot be undone.`}
          confirmText="Delete Task"
          variant="danger"
          onConfirm={handleDeleteTask}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
