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

  return (
    <div className="space-y-4">
      {/* ── 1. SEGMENTED NAVIGATION PILL BAR (ICIT INSPIRATION) ── */}
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
                onClick={() => onOpenCreateModal('daily')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 hover:border-teal-300 transition-all duration-150 shadow-2xs cursor-pointer"
                title="Create a daily recurring SOP task"
              >
                <Plus size={14} className="text-teal-600" />
                <span className="hidden sm:inline">+ Daily Directive</span>
                <span className="sm:hidden">+ Daily</span>
              </button>

              <button
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

      {/* ── 2. ICIT-INSPIRED KPI SUMMARY CARDS ── */}
      {showKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Standing Daily Directives */}
          <div className="bg-[#FFFDF7] p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Standing Daily Directives
              </div>
              <div className="text-2xl font-black text-navy leading-none">
                {completedDaily}{' '}
                <span className="text-xs font-semibold text-slate-400">/ {totalDaily}</span>
              </div>
              <div className="w-36 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-300"
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
              <div className="text-[10px] text-teal-700 font-bold mt-1">
                {dailyPct}% Checklist Done Today
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
              <Activity size={20} />
            </div>
          </div>

          {/* Card 2: Standard Tasks & Tickets */}
          <div className="bg-[#FFFDF7] p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Standard Tasks &amp; Tickets
              </div>
              <div className="text-2xl font-black text-navy leading-none">{openStandard}</div>
              <div className="text-[11px] text-amber-700 font-medium mt-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{inProgressStandard} in progress</span>
                <span>·</span>
                <span className="text-teal-700 font-semibold">{doneStandard} done</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <CheckSquare size={20} />
            </div>
          </div>

          {/* Card 3: Shift Work Date Stepper */}
          {selectedDate && onStepDay && onResetToday && (
            <div className="bg-[#FFFDF7] p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Shift Work Date
                </span>
                {!isToday && (
                  <button
                    onClick={onResetToday}
                    className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200/70 px-1.5 py-0.5 rounded-md font-bold hover:bg-blue-100 transition-colors"
                  >
                    <RotateCcw size={10} /> Reset Today
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => onStepDay(-1)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Previous Day"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <div className="text-sm font-black text-navy">{fmtDate(selectedDate)}</div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {isToday ? 'Today (Live Shift)' : 'Historical Log'}
                  </div>
                </div>
                <button
                  onClick={() => onStepDay(1)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  title="Next Day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              {onDateChange && (
                <div className="mt-2.5 flex items-center justify-center">
                  <div className="relative inline-flex items-center">
                    <Calendar size={12} className="absolute left-2.5 text-amber pointer-events-none" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => onDateChange(e.target.value)}
                      className="text-xs font-semibold pl-7 pr-2.5 py-1 rounded-xl border border-slate-200/90 bg-white hover:border-amber/60 focus:border-amber focus:ring-2 focus:ring-amber/20 text-navy shadow-2xs transition-all duration-150 cursor-pointer outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card 4: Task Velocity & Quality */}
          <div className="bg-[#FFFDF7] p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Daily Completion Velocity
              </div>
              <div className="text-2xl font-black text-emerald-600 leading-none">
                {totalDaily + openStandard > 0
                  ? Math.round(((completedDaily + doneStandard) / (totalDaily + openStandard + doneStandard)) * 100)
                  : 0}
                %
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-2 flex items-center gap-1">
                <Sparkles size={11} className="text-amber" />
                <span>Unified efficiency index across all staff</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
          </div>
        </div>
      )}

      {/* ── 3. WORKSPACE CONTROLS & VIEW TOGGLES ── */}
      {(onSetViewMode || onSetLayoutMode) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Layout Mode:
            </span>
            {onSetLayoutMode && (
              <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 text-xs">
                <button
                  onClick={() => onSetLayoutMode('split')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
                    layoutMode === 'split'
                      ? 'bg-white text-navy font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                  title="Side-by-side Dual Column View"
                >
                  <Columns size={12} />
                  <span>Split Columns</span>
                </button>
                <button
                  onClick={() => onSetLayoutMode('stream')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-all ${
                    layoutMode === 'stream'
                      ? 'bg-white text-navy font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                  title="Single Chronological Stream View"
                >
                  <List size={12} />
                  <span>Unified Stream</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Display:
            </span>
            {onSetViewMode && (
              <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/60 text-xs">
                <button
                  onClick={() => onSetViewMode('line')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                    viewMode === 'line'
                      ? 'bg-white text-navy font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  <List size={12} />
                  <span>Compact Lines</span>
                </button>
                <button
                  onClick={() => onSetViewMode('card')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-all ${
                    viewMode === 'card'
                      ? 'bg-white text-navy font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-navy'
                  }`}
                >
                  <LayoutGrid size={12} />
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
