'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Play,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  Activity,
  CheckCheck,
  Tag,
  Kanban,
  List,
  LayoutGrid,
  ExternalLink,
  ChevronDown,
  Check,
  Clock3,
  XCircle,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import { DailyActivity, DailyActivityStatus, DailyStatsSummary } from '@/types';
import { useAuthStore } from '@/lib/auth';
import { useStartDailyActivity, useCompleteDailyActivity, useUpdateDailyActivity } from '@/hooks/useApi';
import { Badge, Spinner, EmptyState } from '@/components/ui';
import api from '@/lib/api';
import toast from 'react-hot-toast';

function getFormattedDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

interface EmployeeDailyWorkspaceProps {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  tasks: DailyActivity[];
  dailySummary?: DailyStatsSummary;
  isLoading: boolean;
  onOpenTaskDetail: (taskId: string) => void;
}

interface StatusOption {
  value: DailyActivityStatus;
  label: string;
  description: string;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  dotBg: string;
}

const STATUS_CONFIG: StatusOption[] = [
  {
    value: 'ASSIGNED',
    label: 'Assigned',
    description: 'Task allocated & queued',
    pillBg: 'bg-blue-50 hover:bg-blue-100/70',
    pillText: 'text-blue-700',
    pillBorder: 'border-blue-200 hover:border-blue-300',
    dotBg: 'bg-blue-500',
  },
  {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Currently being executed',
    pillBg: 'bg-purple-50 hover:bg-purple-100/70',
    pillText: 'text-purple-700',
    pillBorder: 'border-purple-200 hover:border-purple-300',
    dotBg: 'bg-purple-500',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'Done & verified',
    pillBg: 'bg-teal-50 hover:bg-teal-100/70',
    pillText: 'text-teal-700',
    pillBorder: 'border-teal-200 hover:border-teal-300',
    dotBg: 'bg-teal-500',
  },
  {
    value: 'BLOCKED',
    label: 'Blocked',
    description: 'Waiting on external dependency',
    pillBg: 'bg-rose-50 hover:bg-rose-100/70',
    pillText: 'text-rose-700',
    pillBorder: 'border-rose-200 hover:border-rose-300',
    dotBg: 'bg-rose-500',
  },
  {
    value: 'INCOMPLETE',
    label: 'Incomplete',
    description: 'Could not finish in schedule',
    pillBg: 'bg-rose-50 hover:bg-rose-100/70',
    pillText: 'text-rose-700',
    pillBorder: 'border-rose-200 hover:border-rose-300',
    dotBg: 'bg-rose-500',
  },
  {
    value: 'LATE',
    label: 'Late',
    description: 'Completed past deadline',
    pillBg: 'bg-amber-50 hover:bg-amber-100/70',
    pillText: 'text-amber-800',
    pillBorder: 'border-amber-200 hover:border-amber-300',
    dotBg: 'bg-amber-500',
  },
];

export default function EmployeeDailyWorkspace({
  selectedDate,
  onSelectDate,
  tasks,
  dailySummary,
  isLoading,
  onOpenTaskDetail,
}: EmployeeDailyWorkspaceProps) {
  const { user } = useAuthStore();
  const updateMutation = useUpdateDailyActivity();

  const todayStr = getFormattedDate(0);

  // View Mode: 'list' | 'kanban' | 'grid'
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'grid'>('list');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [syncingMandatory, setSyncingMandatory] = useState(false);

  const handleSyncMandatory = async () => {
    setSyncingMandatory(true);
    try {
      const res = await api.post('/daily-activities/sync-mandatory', { targetDate: selectedDate });
      toast.success(res.data?.message || 'Mandatory daily tasks synchronized!');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to sync mandatory tasks');
    } finally {
      setSyncingMandatory(false);
    }
  };

  const isSelectedToday = selectedDate === todayStr;
  const isSelectedYesterday = selectedDate === getFormattedDate(-1);
  const isSelectedTomorrow = selectedDate === getFormattedDate(1);

  const dayLabel = isSelectedToday
    ? 'Today'
    : isSelectedYesterday
    ? 'Yesterday'
    : isSelectedTomorrow
    ? 'Tomorrow'
    : selectedDate;

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchCat = t.category?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }
    return true;
  });

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await updateMutation.mutateAsync({
        id: taskId,
        status: newStatus,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getPriorityBadge = (p?: string) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">Low</span>;
      default:
        return <Badge label={p || 'Medium'} />;
    }
  };

  // ── Custom Khrisha-Themed Status Dropdown Component ────────────────────────
  const StatusDropdown = ({ task }: { task: DailyActivity }) => {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number; openUpwards: boolean } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const currentStatus = task.status || 'ASSIGNED';
    const activeConfig = STATUS_CONFIG.find((c) => c.value === currentStatus) || STATUS_CONFIG[0];

    useEffect(() => {
      setMounted(true);
    }, []);

    const updatePosition = useCallback(() => {
      if (!dropdownRef.current) return;
      const rect = dropdownRef.current.getBoundingClientRect();
      const menuHeight = 240; // Estimated dropdown height
      const menuWidth = 192;  // w-48 (192px)

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpwards = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - menuWidth - 12);
      }

      const top = openUpwards
        ? Math.max(10, rect.top - menuHeight - 6)
        : rect.bottom + 6;

      setCoords({ top, left, openUpwards });
    }, []);

    useEffect(() => {
      if (!open) return;
      updatePosition();

      const handleScrollOrResize = () => {
        updatePosition();
      };

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          dropdownRef.current && !dropdownRef.current.contains(target) &&
          menuRef.current && !menuRef.current.contains(target)
        ) {
          setOpen(false);
        }
      };

      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [open, updatePosition]);

    return (
      <div className="relative inline-block text-left" ref={dropdownRef}>
        {/* Trigger Pill Button */}
        <button
          type="button"
          disabled={updateMutation.isPending}
          onClick={() => {
            updatePosition();
            setOpen((prev) => !prev);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all duration-150 shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 ${activeConfig.pillBg} ${activeConfig.pillText} ${activeConfig.pillBorder}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${activeConfig.dotBg} ${currentStatus === 'IN_PROGRESS' ? 'animate-ping' : ''}`} />
          <span>{activeConfig.label}</span>
          <ChevronDown
            size={11}
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Floating Khrisha Themed Menu Portaled directly to document.body */}
        {open && mounted && coords && typeof window !== 'undefined' && createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className="w-48 bg-white border border-border rounded-xl shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100 divide-y divide-border/30"
          >
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted/80">
              Change Task Status
            </div>

            <div className="py-1 space-y-0.5 px-1 max-h-60 overflow-y-auto">
              {STATUS_CONFIG.map((opt) => {
                const isSelected = opt.value === currentStatus;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (opt.value !== currentStatus) {
                        handleStatusChange(task.id, opt.value);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-amber-50 text-navy font-bold'
                        : 'text-slate-700 hover:bg-surface hover:text-navy'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${opt.dotBg}`} />
                      <span>{opt.label}</span>
                    </div>
                    {isSelected && <Check size={13} className="text-amber-600" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };

  // ── Kanban Column Definitions ──────────────────────────────────────────────
  const kanbanColumns = [
    {
      id: 'assigned',
      title: 'Assigned',
      headerBg: 'bg-blue-50 text-blue-800 border-blue-200',
      tasks: filteredTasks.filter((t) => ['ASSIGNED', 'pending', 'PENDING'].includes(t.status)),
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      headerBg: 'bg-purple-50 text-purple-800 border-purple-200',
      tasks: filteredTasks.filter((t) => ['IN_PROGRESS', 'in_progress'].includes(t.status)),
    },
    {
      id: 'completed',
      title: 'Completed',
      headerBg: 'bg-teal-50 text-teal-800 border-teal-200',
      tasks: filteredTasks.filter((t) => ['COMPLETED', 'completed', 'LATE'].includes(t.status)),
    },
    {
      id: 'blocked',
      title: 'Incomplete / Blocked',
      headerBg: 'bg-rose-50 text-rose-800 border-rose-200',
      tasks: filteredTasks.filter((t) => ['BLOCKED', 'INCOMPLETE'].includes(t.status)),
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* ── Minimal Filter & View Toolbar ───────────────────────────────────── */}
      <div className="card p-2.5 bg-white border border-border flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-8 text-xs py-1.5 rounded-lg w-full"
          />
        </div>

        {/* Filter Dropdowns + View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="form-select text-xs py-1 w-32 rounded-lg"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="INCOMPLETE">Incomplete</option>
            <option value="LATE">Late</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="form-select text-xs py-1 w-28 rounded-lg"
          >
            <option value="ALL">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Sync Mandatory Tasks Button */}
          <button
            type="button"
            onClick={handleSyncMandatory}
            disabled={syncingMandatory}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold shadow-2xs transition-all"
            title="Load designated enterprise mandatory daily tasks"
          >
            <RefreshCw size={12} className={syncingMandatory ? 'animate-spin text-amber-700' : 'text-amber-700'} />
            <span className="hidden sm:inline">Sync Mandatory Tasks</span>
          </button>

          {/* View Switcher: List | Kanban | Cards */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-navy text-white shadow-2xs'
                  : 'text-muted hover:text-navy'
              }`}
              title="Line View (Default Table Rows across CRM)"
            >
              <List size={13} />
              <span>Line</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-navy text-white shadow-2xs'
                  : 'text-muted hover:text-navy'
              }`}
              title="Kanban Board View"
            >
              <Kanban size={13} />
              <span>Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-navy text-white shadow-2xs'
                  : 'text-muted hover:text-navy'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Content View Area ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <Spinner />
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={<Calendar size={40} className="text-muted/40" />}
          title={`No Tasks Scheduled for ${dayLabel}`}
          description={
            search || statusFilter !== 'ALL'
              ? 'Try clearing your search query or filters.'
              : `You have no tasks scheduled for ${selectedDate}. Click below to load your designated mandatory daily routine.`
          }
          action={
            <button
              type="button"
              onClick={handleSyncMandatory}
              disabled={syncingMandatory}
              className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 rounded-lg mt-2"
            >
              <RefreshCw size={12} className={syncingMandatory ? 'animate-spin' : ''} />
              <span>{syncingMandatory ? 'Syncing...' : 'Sync Mandatory Tasks'}</span>
            </button>
          }
        />
      ) : (
        <>
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 1. SIMPLIFIED TABLE LIST VIEW                                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {viewMode === 'list' && (
            <div className="card p-0 overflow-visible border border-border/80 shadow-2xs">
              <div className="overflow-x-auto overflow-y-visible">
                <table className="data-table text-left">
                  <thead>
                    <tr>
                      <th className="w-36">Status</th>
                      <th className="w-20">Priority</th>
                      <th>Task Title &amp; Details</th>
                      <th className="w-36">Category</th>
                      <th className="w-32">Assigned By</th>
                      <th className="w-24">Scheduled</th>
                      <th className="w-20">Hours</th>
                      <th className="w-24 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Custom Themed Status Dropdown */}
                        <td className="overflow-visible">
                          <StatusDropdown task={t} />
                        </td>

                        {/* Priority */}
                        <td>{getPriorityBadge(t.priority)}</td>

                        {/* Title & Description */}
                        <td>
                          <div
                            onClick={() => onOpenTaskDetail(t.id)}
                            className="font-bold text-xs text-navy hover:text-amber-600 cursor-pointer line-clamp-1"
                          >
                            {t.title}
                          </div>
                          {t.description && (
                            <p className="text-[11px] text-muted line-clamp-1 mt-0.5">
                              {t.description}
                            </p>
                          )}
                        </td>

                        {/* Category (Clean nowrap) */}
                        <td>
                          {t.category ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-slate-700 font-mono text-[10px] border border-border whitespace-nowrap">
                              <Tag size={9} /> {t.category}
                            </span>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>

                        {/* Assigned By */}
                        <td className="text-xs font-medium text-navy truncate max-w-[120px]">
                          {t.assigner?.name || 'Super Admin'}
                        </td>

                        {/* Scheduled Date */}
                        <td className="text-xs text-muted whitespace-nowrap">
                          {t.scheduled_date || 'Today'}
                        </td>

                        {/* Time Logged */}
                        <td className="text-xs">
                          {Number(t.actual_hours) > 0 ? (
                            <span className="font-bold text-teal-700">{t.actual_hours}h</span>
                          ) : (
                            <span className="text-muted">0h</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="text-right">
                          <button
                            onClick={() => onOpenTaskDetail(t.id)}
                            className="btn btn-secondary py-1 px-2 text-xs text-navy hover:text-amber-700 inline-flex items-center gap-1 rounded-lg"
                            title="Open Details & Audit"
                          >
                            <span>Details</span>
                            <ExternalLink size={10} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 2. KANBAN VIEW                                                  */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
              {kanbanColumns.map((col) => (
                <div
                  key={col.id}
                  className="bg-surface/50 rounded-2xl border border-border/80 p-3 space-y-3 flex flex-col min-h-[320px]"
                >
                  {/* Header */}
                  <div className={`flex items-center justify-between p-2 rounded-xl border ${col.headerBg}`}>
                    <span className="text-xs font-black uppercase tracking-wider">{col.title}</span>
                    <span className="text-[11px] font-black bg-white px-2 py-0.2 rounded-md shadow-2xs">
                      {col.tasks.length}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="space-y-2.5 flex-1">
                    {col.tasks.length === 0 ? (
                      <div className="p-4 text-center border border-dashed border-border rounded-xl text-muted text-xs">
                        No tasks in this stage
                      </div>
                    ) : (
                      col.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="card p-3 bg-white border border-border/80 rounded-xl shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between gap-1">
                            {getPriorityBadge(t.priority)}
                            {t.category && (
                              <span className="text-[9px] font-mono text-muted bg-surface px-1.5 py-0.2 rounded border border-border whitespace-nowrap">
                                {t.category}
                              </span>
                            )}
                          </div>

                          <h4
                            onClick={() => onOpenTaskDetail(t.id)}
                            className="text-xs font-bold text-navy hover:text-amber-600 cursor-pointer leading-snug line-clamp-2"
                          >
                            {t.title}
                          </h4>

                          {t.description && (
                            <p className="text-[11px] text-muted line-clamp-2 leading-relaxed">
                              {t.description}
                            </p>
                          )}

                          {/* Status changer on Kanban Card */}
                          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-1">
                            <StatusDropdown task={t} />
                            <button
                              onClick={() => onOpenTaskDetail(t.id)}
                              className="text-[10px] font-bold text-muted hover:text-navy flex items-center gap-0.5"
                            >
                              Details &rarr;
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* 3. CARDS / GRID VIEW                                            */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className="card p-4 rounded-xl border border-border bg-white hover:border-amber-400 hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <StatusDropdown task={t} />
                      {getPriorityBadge(t.priority)}
                    </div>

                    <h3
                      onClick={() => onOpenTaskDetail(t.id)}
                      className="font-bold text-navy text-sm leading-snug cursor-pointer hover:text-amber-600 transition-colors line-clamp-2"
                    >
                      {t.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {t.description}
                    </p>

                    <div className="p-2.5 rounded-lg bg-surface/60 border border-border/80 text-xs space-y-1">
                      <div className="flex items-center justify-between text-muted text-[11px]">
                        <span>Assigned by:</span>
                        <span className="font-semibold text-navy">{t.assigner?.name || 'Super Admin'}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted text-[11px]">
                        <span>Scheduled:</span>
                        <span className="font-semibold text-navy">{t.scheduled_date || 'Today'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-border flex items-center justify-between mt-3">
                    {t.category ? (
                      <span className="text-[10px] font-mono text-muted bg-surface px-1.5 py-0.5 rounded border border-border whitespace-nowrap">
                        {t.category}
                      </span>
                    ) : <span />}

                    <button
                      onClick={() => onOpenTaskDetail(t.id)}
                      className="btn btn-secondary py-1 px-2.5 text-xs text-navy hover:text-amber-700 flex items-center gap-1 rounded-lg"
                    >
                      <span>Details &amp; Audit</span>
                      <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
