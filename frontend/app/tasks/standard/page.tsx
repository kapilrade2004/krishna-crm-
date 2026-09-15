'use client';

import React, { useState, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  List,
  Columns,
  Star,
  User as UserIcon,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useTasks, useUpdateTask, useDeleteTask, useSetTaskScore, useUsers } from '@/hooks/useApi';
import { useAuthStore } from '@/lib/auth';
import { Spinner, EmptyState, Modal, Input, Select, Textarea, ConfirmDialog } from '@/components/ui';
import { fmtDate, PRIORITY_COLOURS } from '@/lib/utils';
import type { Task, TaskStatus, Priority, User } from '@/types';
import toast from 'react-hot-toast';

import TaskWorkspaceHeader from '@/components/tasks/TaskWorkspaceHeader';
import TaskDetailDrawer, { InspectableTask } from '@/components/tasks/TaskDetailDrawer';
import TaskFilterDrawer, { TaskFilterState } from '@/components/tasks/TaskFilterDrawer';
import TaskItemRow from '@/components/tasks/TaskItemRow';
import TaskItemCard from '@/components/tasks/TaskItemCard';
import UnifiedCreateTaskModal from '@/components/tasks/UnifiedCreateTaskModal';

const KANBAN_COLUMNS: { status: TaskStatus; label: string; dotBg: string; badgeBg: string }[] = [
  { status: 'todo', label: 'To Do', dotBg: 'bg-slate-400', badgeBg: 'bg-slate-100 text-slate-700' },
  { status: 'in_progress', label: 'In Progress', dotBg: 'bg-amber-500', badgeBg: 'bg-amber-50 text-amber-700' },
  { status: 'review', label: 'Review', dotBg: 'bg-purple-500', badgeBg: 'bg-purple-50 text-purple-700' },
  { status: 'done', label: 'Completed', dotBg: 'bg-emerald-500', badgeBg: 'bg-emerald-50 text-emerald-700' },
];

export default function StandardTasksPage() {
  const { user } = useAuthStore();

  // Queries
  const { data: tasksData, isLoading } = useTasks({ limit: 250, sort: 'due_date:asc' });
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

  // View States
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<TaskFilterState>({
    search: '',
    scope: 'standard',
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
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const canScore = Boolean(user && ['admin', 'super_admin', 'manager'].includes(user.role));
  const canDelete = (t: Task) =>
    Boolean(user && (user.role === 'admin' || user.role === 'super_admin' || t.created_by === user.id));

  const filteredTasks = useMemo(() => {
    return standardTasks.filter((t) => {
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
      if (filters.assignedTo && t.assigned_to !== filters.assignedTo) return false;
      if (filters.overdueOnly && (!t.due_date || new Date(t.due_date) >= new Date() || t.status === 'done')) return false;

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesAssignee = (t.assignedUser?.name || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
      }
      return true;
    });
  }, [standardTasks, filters, searchQuery]);

  const handleToggleComplete = async (item: InspectableTask) => {
    const isDone = item.data.status === 'done';
    const nextStatus: TaskStatus = isDone ? 'todo' : 'done';
    try {
      await updateTask.mutateAsync({
        id: item.data.id,
        status: nextStatus,
        progress_percent: isDone ? 0 : 100,
      } as Partial<Task> & { id: string });
      toast.success(isDone ? 'Ticket reopened' : 'Ticket marked as Completed');
    } catch {
      toast.error('Failed to update ticket');
    }
  };

  const handleStatusChange = async (item: InspectableTask, nextStatus: string) => {
    try {
      await updateTask.mutateAsync({
        id: item.data.id,
        status: nextStatus as TaskStatus,
        ...(nextStatus === 'done' ? { progress_percent: 100 } : {}),
      } as Partial<Task> & { id: string });
      toast.success(`Moved to ${nextStatus.toUpperCase()}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTask.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setDetailDrawerOpen(false);
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  return (
    <AppShell>
      <Topbar
        title="Standard Tickets"
        subtitle="Project tasks, sprint milestones, and ad-hoc work tickets"
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
        {/* Navigation Tabs Header */}
        <TaskWorkspaceHeader
          totalDaily={0}
          completedDaily={0}
          openStandard={standardTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length}
          inProgressStandard={standardTasks.filter((t) => t.status === 'in_progress').length}
          doneStandard={standardTasks.filter((t) => t.status === 'done').length}
          onOpenCreateModal={() => setCreateModalOpen(true)}
          onToggleFilterDrawer={() => setFilterDrawerOpen(true)}
          showKpis={false}
        />

        {/* Toolbar: Search, View Switcher & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search standard tickets by title, description or assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber text-navy font-medium"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {/* View Mode: Kanban vs Table */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 text-xs">
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-white text-navy shadow-2xs'
                    : 'text-slate-500 hover:text-navy'
                }`}
              >
                <Columns size={13} />
                <span>Kanban Board</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-navy shadow-2xs'
                    : 'text-slate-500 hover:text-navy'
                }`}
              >
                <List size={13} />
                <span>Table View</span>
              </button>
            </div>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber text-navy hover:bg-amber-500 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>+ New Ticket</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted">
            <Spinner className="w-8 h-8" />
          </div>
        ) : viewMode === 'kanban' ? (
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {KANBAN_COLUMNS.map((col) => {
              const columnTasks = filteredTasks.filter((t) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  className="bg-[#FFFDF7] rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotBg}`} />
                      <span className="text-xs font-black text-navy">{col.label}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.badgeBg}`}
                    >
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 min-h-[300px]">
                    {columnTasks.length === 0 ? (
                      <div className="py-12 text-center text-slate-300 text-xs font-medium">
                        No tickets in {col.label}
                      </div>
                    ) : (
                      columnTasks.map((t) => (
                        <TaskItemCard
                          key={t.id}
                          item={{ type: 'standard', data: t }}
                          onSelect={(item) => {
                            setInspectedTask(item);
                            setDetailDrawerOpen(true);
                          }}
                          onToggleComplete={handleToggleComplete}
                          onStatusChange={handleStatusChange}
                          canScore={canScore}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-[#FFFDF7] rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No tickets matching criteria.
              </div>
            ) : (
              filteredTasks.map((t) => (
                <TaskItemRow
                  key={t.id}
                  item={{ type: 'standard', data: t }}
                  onSelect={(item) => {
                    setInspectedTask(item);
                    setDetailDrawerOpen(true);
                  }}
                  onToggleComplete={handleToggleComplete}
                  onStatusChange={handleStatusChange}
                  canScore={canScore}
                />
              ))
            )}
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
          onScoreTask={async (score, comment) => {
            if (inspectedTask?.type === 'standard') {
              await setTaskScore.mutateAsync({
                id: inspectedTask.data.id,
                score,
                score_comment: comment,
              });
            }
          }}
          onDelete={() => {
            if (inspectedTask?.type === 'standard') {
              setDeleteTarget(inspectedTask.data as Task);
            }
          }}
          canScore={canScore}
          canDelete={Boolean(inspectedTask?.type === 'standard' && canDelete(inspectedTask.data as Task))}
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
              scope: 'standard',
              status: 'all',
              priority: 'all',
              assignedTo: '',
              overdueOnly: false,
            })
          }
          users={userList}
          matchCount={filteredTasks.length}
        />

        {/* Create Modal */}
        <UnifiedCreateTaskModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          defaultMode="standard"
        />

        {/* Delete Confirm */}
        {deleteTarget && (
          <ConfirmDialog
            open={!!deleteTarget}
            title="Delete Ticket"
            message={`Permanently delete ticket "${deleteTarget.title}"?`}
            confirmText="Delete"
            variant="danger"
            onConfirm={handleDeleteTask}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </main>
    </AppShell>
  );
}
