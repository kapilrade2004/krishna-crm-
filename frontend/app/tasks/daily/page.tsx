'use client';

import React, { useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  Activity,
  Plus,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  List,
  LayoutGrid,
  Users,
  Sparkles,
} from 'lucide-react';
import { useDailyActivities, useUpdateDailyActivity, useDeleteDailyActivity, useUsers } from '@/hooks/useApi';
import { useAuthStore } from '@/lib/auth';
import { Spinner, EmptyState } from '@/components/ui';
import { fmtDate } from '@/lib/utils';
import type { DailyActivity, User } from '@/types';
import toast from 'react-hot-toast';

import TaskWorkspaceHeader from '@/components/tasks/TaskWorkspaceHeader';
import TaskDetailDrawer, { InspectableTask } from '@/components/tasks/TaskDetailDrawer';
import TaskFilterDrawer, { TaskFilterState } from '@/components/tasks/TaskFilterDrawer';
import TaskItemRow from '@/components/tasks/TaskItemRow';
import TaskItemCard from '@/components/tasks/TaskItemCard';
import UnifiedCreateTaskModal from '@/components/tasks/UnifiedCreateTaskModal';

function getFormattedDate(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DailyTasksPage() {
  const { user } = useAuthStore();
  const todayStr = useMemo(() => getFormattedDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const handleStepDay = (delta: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + delta);
    setSelectedDate(getFormattedDate(current));
  };

  const handleResetToToday = () => {
    setSelectedDate(todayStr);
  };

  // Queries
  const { data: dailyRaw, isLoading } = useDailyActivities({ scheduled_date: selectedDate });
  const dailyActivities: DailyActivity[] = useMemo(() => {
    if (Array.isArray(dailyRaw?.data?.activities)) return dailyRaw.data.activities;
    if (Array.isArray(dailyRaw?.activities)) return dailyRaw.activities;
    if (Array.isArray(dailyRaw?.data)) return dailyRaw.data;
    if (Array.isArray(dailyRaw)) return dailyRaw;
    return [];
  }, [dailyRaw]);

  const { data: users = [] } = useUsers();
  const userList: User[] = useMemo(() => {
    if (Array.isArray(users)) return users;
    if (Array.isArray((users as any)?.data?.users)) return (users as any).data.users;
    if (Array.isArray((users as any)?.data)) return (users as any).data;
    return [];
  }, [users]);

  const updateDailyActivity = useUpdateDailyActivity();

  // View States
  const [viewMode, setViewMode] = useState<'line' | 'card'>('line');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilterState>({
    search: '',
    scope: 'daily',
    status: 'all',
    priority: 'all',
    assignedTo: '',
    overdueOnly: false,
  });

  // Slide-over Inspector
  const [inspectedTask, setInspectedTask] = useState<InspectableTask | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Filter Matching
  const filteredActivities = useMemo(() => {
    return dailyActivities.filter((act) => {
      const isDone = act.status === 'completed' || act.status === 'COMPLETED';
      if (statusFilter === 'pending' && isDone) return false;
      if (statusFilter === 'completed' && !isDone) return false;
      if (filters.priority !== 'all' && act.priority !== filters.priority) return false;
      if (filters.assignedTo && act.assigned_to !== filters.assignedTo) return false;

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesTitle = act.title?.toLowerCase().includes(q);
        const matchesDesc = act.description?.toLowerCase().includes(q);
        const matchesAssignee = (act.assignee?.name || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
      }
      return true;
    });
  }, [dailyActivities, statusFilter, filters, searchQuery]);

  const totalDaily = dailyActivities.length;
  const completedDaily = dailyActivities.filter(
    (a) => a.status === 'completed' || a.status === 'COMPLETED'
  ).length;
  const dailyPct = totalDaily > 0 ? Math.round((completedDaily / totalDaily) * 100) : 0;

  const handleToggleComplete = async (item: InspectableTask) => {
    const isDone = item.data.status === 'completed' || item.data.status === 'COMPLETED';
    const nextStatus = isDone ? 'pending' : 'completed';
    try {
      await updateDailyActivity.mutateAsync({
        id: item.data.id,
        status: nextStatus,
        note: isDone ? 'Reopened by staff' : 'Completed from Daily SOP Directives',
      });
      toast.success(isDone ? 'Directive reopened' : 'Daily directive marked Completed!');
    } catch {
      toast.error('Failed to update directive status');
    }
  };

  const handleStatusChange = async (item: InspectableTask, nextStatus: string) => {
    try {
      await updateDailyActivity.mutateAsync({
        id: item.data.id,
        status: nextStatus,
        note: `Status updated to ${nextStatus}`,
      });
      toast.success(`Directive status moved to ${nextStatus.toUpperCase()}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <AppShell>
      <Topbar
        title="Daily SOP Directives"
        subtitle="Shift work checklists, recurring operational duties &amp; standard operating procedures"
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
        {/* Navigation Tabs Header */}
        <TaskWorkspaceHeader
          totalDaily={totalDaily}
          completedDaily={completedDaily}
          dailyPct={dailyPct}
          selectedDate={selectedDate}
          onStepDay={handleStepDay}
          onResetToday={handleResetToToday}
          onDateChange={setSelectedDate}
          onOpenCreateModal={() => setCreateModalOpen(true)}
          onToggleFilterDrawer={() => setFilterDrawerOpen(true)}
          showKpis={false}
        />

        {/* Date Stepper Banner (ICIT Style) */}
        <div className="bg-[#FFFDF7] p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-navy flex items-center gap-2">
                <span>Shift Date: {fmtDate(selectedDate)}</span>
                {selectedDate === todayStr ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-md font-bold">
                    Live Shift Today
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                    Historical Log
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {completedDaily} of {totalDaily} operational checklist items completed ({dailyPct}%)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => handleStepDay(-1)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Previous Day
            </button>
            {selectedDate !== todayStr && (
              <button
                onClick={handleResetToToday}
                className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 flex items-center gap-1"
              >
                <RotateCcw size={12} /> Today
              </button>
            )}
            <button
              onClick={() => handleStepDay(1)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1"
            >
              Next Day <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search daily SOP directives by title, description or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-navy font-medium"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* Status Pills */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 text-xs">
              {(['all', 'pending', 'completed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg capitalize font-semibold transition-all ${
                    statusFilter === st
                      ? 'bg-white text-navy font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 text-xs">
              <button
                onClick={() => setViewMode('line')}
                className={`p-1.5 rounded-lg ${viewMode === 'line' ? 'bg-white text-navy shadow-2xs' : 'text-slate-500'}`}
                title="Line View"
              >
                <List size={13} />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-lg ${viewMode === 'card' ? 'bg-white text-navy shadow-2xs' : 'text-slate-500'}`}
                title="Card View"
              >
                <LayoutGrid size={13} />
              </button>
            </div>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Add Directive</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted">
            <Spinner className="w-8 h-8" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="bg-[#FFFDF7] rounded-2xl border border-slate-200/80 p-16 text-center shadow-xs">
            <EmptyState
              title="No Daily Directives Scheduled"
              description={`There are no daily SOP checklist items scheduled for ${fmtDate(selectedDate)} matching your criteria.`}
            />
          </div>
        ) : viewMode === 'line' ? (
          <div className="bg-[#FFFDF7] rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-1.5">
            {filteredActivities.map((act) => (
              <TaskItemRow
                key={act.id}
                item={{ type: 'daily', data: act }}
                onSelect={(item) => {
                  setInspectedTask(item);
                  setDetailDrawerOpen(true);
                }}
                onToggleComplete={handleToggleComplete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredActivities.map((act) => (
              <TaskItemCard
                key={act.id}
                item={{ type: 'daily', data: act }}
                onSelect={(item) => {
                  setInspectedTask(item);
                  setDetailDrawerOpen(true);
                }}
                onToggleComplete={handleToggleComplete}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}

        {/* Slide-over Toggle Window (Detail Drawer) */}
        <TaskDetailDrawer
          item={inspectedTask}
          isOpen={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          onUpdateStatus={async (nextStatus) => {
            if (inspectedTask) await handleStatusChange(inspectedTask, nextStatus);
          }}
          onAddNote={async (note) => {
            if (inspectedTask) {
              await updateDailyActivity.mutateAsync({
                id: inspectedTask.data.id,
                note,
              });
            }
          }}
        />

        {/* Filter Drawer */}
        <TaskFilterDrawer
          isOpen={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          filters={filters}
          onChangeFilters={setFilters}
          onResetFilters={() =>
            setFilters({
              search: '',
              scope: 'daily',
              status: 'all',
              priority: 'all',
              assignedTo: '',
              overdueOnly: false,
            })
          }
          users={userList}
          matchCount={filteredActivities.length}
        />

        {/* Create Modal */}
        <UnifiedCreateTaskModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          defaultMode="daily"
          preSelectedDate={selectedDate}
        />
      </main>
    </AppShell>
  );
}
