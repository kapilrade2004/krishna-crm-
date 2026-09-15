'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Layers,
  CheckSquare,
  Activity,
  Award,
  Plus,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  List,
  LayoutGrid,
  Columns,
  Sparkles,
} from 'lucide-react';
import { fmtDate } from '@/lib/utils';

export interface TaskWorkspaceHeaderProps {
  totalDaily?: number;
  completedDaily?: number;
  dailyPct?: number;
  openStandard?: number;
  inProgressStandard?: number;
  doneStandard?: number;
  totalAll?: number;
  completedAll?: number;
  inProgressAll?: number;
  pendingAll?: number;
  overdueAll?: number;
  selectedDate?: string;
  onStepDay?: (delta: number) => void;
  onResetToday?: () => void;
  onDateChange?: (date: string) => void;
  onOpenCreateModal?: (mode: 'standard' | 'daily') => void;
  onToggleFilterDrawer?: () => void;
  activeFilterCount?: number;
  viewMode?: 'line' | 'card';
  onSetViewMode?: (mode: 'line' | 'card') => void;
  layoutMode?: 'split' | 'stream';
  onSetLayoutMode?: (mode: 'split' | 'stream') => void;
  showKpis?: boolean;
}

export default function TaskWorkspaceHeader({
  totalDaily = 0,
  completedDaily = 0,
  dailyPct = 0,
  openStandard = 0,
  inProgressStandard = 0,
  doneStandard = 0,
  totalAll,
  completedAll,
  inProgressAll,
  pendingAll,
  overdueAll,
  selectedDate,
  onStepDay,
  onResetToday,
  onDateChange,
  onOpenCreateModal,
  onToggleFilterDrawer,
  activeFilterCount = 0,
  viewMode = 'line',
  onSetViewMode,
  layoutMode = 'split',
  onSetLayoutMode,
  showKpis = true,
}: TaskWorkspaceHeaderProps) {
  const pathname = usePathname();
  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;

  const tabs = [
    {
      id: 'unified',
      label: 'Unified Workspace',
      href: '/tasks',
      icon: Layers,
      exact: true,
      badge: 'Unified View',
    },
    {
      id: 'standard',
      label: 'Standard Tickets',
      href: '/tasks/standard',
      icon: CheckSquare,
      exact: false,
    },
    {
      id: 'daily',
      label: 'Daily SOP Directives',
      href: '/tasks/daily',
      icon: Activity,
      exact: false,
    },
    {
      id: 'scores',
      label: 'Performance Scores',
      href: '/tasks/scores',
      icon: Award,
      exact: false,
    },
  ];

  // Derived KPI metrics matching the 5 horizontal cards from user screenshot
  const kpiTotal = totalAll !== undefined ? totalAll : totalDaily + openStandard + doneStandard;
  const kpiCompleted = completedAll !== undefined ? completedAll : completedDaily + doneStandard;
  const kpiInProgress = inProgressAll !== undefined ? inProgressAll : inProgressStandard;
  const kpiPending = pendingAll !== undefined ? pendingAll : Math.max(0, kpiTotal - kpiCompleted - kpiInProgress);
  const kpiOverdue = overdueAll !== undefined ? overdueAll : 0;

  return (
    <div className="space-y-4">
      {/* ── 1. SEGMENTED NAVIGATION PILL BAR (ORIGINAL THEME) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/70">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-navy font-bold shadow-xs border border-slate-200/60'
                    : 'text-slate-600 hover:text-navy hover:bg-white/60'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-amber' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="hidden md:inline-flex px-1.5 py-0.2 rounded-md bg-amber-50 text-[10px] font-bold text-amber-700 border border-amber-200/60">
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {onToggleFilterDrawer && (
            <button
              type="button"
              onClick={onToggleFilterDrawer}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                activeFilterCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Filter size={13} className={activeFilterCount > 0 ? 'text-amber-600' : 'text-slate-500'} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber text-navy font-black text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {onOpenCreateModal && (
            <>
              <button
                type="button"
                onClick={() => onOpenCreateModal('daily')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 hover:border-teal-300 transition-all duration-150 shadow-2xs cursor-pointer"
                title="Create a daily recurring SOP task"
              >
                <Plus size={14} className="text-teal-600" />
                <span className="hidden sm:inline">+ Daily Directive</span>
                <span className="sm:hidden">+ Daily</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenCreateModal('standard')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber text-navy hover:bg-amber-500 transition-all duration-150 shadow-xs hover:shadow-sm cursor-pointer"
                title="Create a standard project ticket"
              >
                <Plus size={14} className="text-navy" />
                <span>+ Standard Task</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 2. FIVE HORIZONTAL METRIC CARDS (TOTAL, COMPLETED, IN PROGRESS, PENDING, OVERDUE) ── */}
      {showKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Total Tasks (Purple Theme) */}
          <div className="bg-[#FFFDF7] p-4 sm:p-5 rounded-[20px] border border-[#E7E5DE] transition-all duration-180 hover:border-purple-300 hover:shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[12px] font-semibold text-slate-500 block leading-tight">
                Total Tasks
              </span>
              <div className="text-[32px] sm:text-[36px] font-bold text-navy leading-none tracking-tight">
                {kpiTotal}
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 pt-0.5">
                <span>↑ 12%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/70">
              <Layers size={20} />
            </div>
          </div>

          {/* Card 2: Completed (Green Theme) */}
          <div className="bg-[#FFFDF7] p-4 sm:p-5 rounded-[20px] border border-[#E7E5DE] transition-all duration-180 hover:border-emerald-300 hover:shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[12px] font-semibold text-slate-500 block leading-tight">
                Completed
              </span>
              <div className="text-[32px] sm:text-[36px] font-bold text-navy leading-none tracking-tight">
                {kpiCompleted}
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 pt-0.5">
                <span>↑ 8%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/70">
              <Activity size={20} />
            </div>
          </div>

          {/* Card 3: In Progress (Blue Theme) */}
          <div className="bg-[#FFFDF7] p-4 sm:p-5 rounded-[20px] border border-[#E7E5DE] transition-all duration-180 hover:border-blue-300 hover:shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[12px] font-semibold text-slate-500 block leading-tight">
                In Progress
              </span>
              <div className="text-[32px] sm:text-[36px] font-bold text-navy leading-none tracking-tight">
                {kpiInProgress}
              </div>
              <p className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 pt-0.5">
                <span>→ 0%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/70">
              <CheckSquare size={20} />
            </div>
          </div>

          {/* Card 4: Pending (Orange / Amber Theme) */}
          <div className="bg-[#FFFDF7] p-4 sm:p-5 rounded-[20px] border border-[#E7E5DE] transition-all duration-180 hover:border-amber-300 hover:shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[12px] font-semibold text-slate-500 block leading-tight">
                Pending
              </span>
              <div className="text-[32px] sm:text-[36px] font-bold text-navy leading-none tracking-tight">
                {kpiPending}
              </div>
              <p className="text-[11px] text-amber-600 font-semibold flex items-center gap-1 pt-0.5">
                <span>↑ 8%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/70">
              <Award size={20} />
            </div>
          </div>

          {/* Card 5: Overdue (Red / Rose Theme) */}
          <div className="bg-[#FFFDF7] p-4 sm:p-5 rounded-[20px] border border-[#E7E5DE] transition-all duration-180 hover:border-rose-300 hover:shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[12px] font-semibold text-slate-500 block leading-tight">
                Overdue
              </span>
              <div className="text-[32px] sm:text-[36px] font-bold text-rose-600 leading-none tracking-tight">
                {kpiOverdue}
              </div>
              <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 pt-0.5">
                <span>↓ 0%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/70">
              <Sparkles size={20} />
            </div>
          </div>
        </div>
      )}

      {/* ── 3. WORKSPACE CONTROLS: SEGMENTED CONTROLS ── */}
      {(onSetViewMode || onSetLayoutMode) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white rounded-full border border-[#E7E5DE] shadow-2xs">
          {/* Layout Mode Segmented Control */}
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">
              Layout Mode:
            </span>
            {onSetLayoutMode && (
              <div className="inline-flex p-1 bg-slate-100/80 rounded-full border border-[#E7E5DE] text-xs">
                <button
                  type="button"
                  onClick={() => onSetLayoutMode('split')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all duration-180 cursor-pointer ${
                    layoutMode === 'split'
                      ? 'bg-white text-navy font-bold shadow-xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                  title="Side-by-side Dual Column View"
                >
                  <Columns size={13} />
                  <span>Split Columns</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetLayoutMode('stream')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all duration-180 cursor-pointer ${
                    layoutMode === 'stream'
                      ? 'bg-white text-navy font-bold shadow-xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                  title="Single Chronological Stream View"
                >
                  <List size={13} />
                  <span>Unified Stream</span>
                </button>
              </div>
            )}
          </div>

          {/* Display View Segmented Control */}
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">
              Display:
            </span>
            {onSetViewMode && (
              <div className="inline-flex p-1 bg-slate-100/80 rounded-full border border-[#E7E5DE] text-xs">
                <button
                  type="button"
                  onClick={() => onSetViewMode('line')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all duration-180 cursor-pointer ${
                    viewMode === 'line'
                      ? 'bg-white text-navy font-bold shadow-xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  <List size={13} />
                  <span>Compact Lines</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetViewMode('card')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition-all duration-180 cursor-pointer ${
                    viewMode === 'card'
                      ? 'bg-white text-navy font-bold shadow-xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

