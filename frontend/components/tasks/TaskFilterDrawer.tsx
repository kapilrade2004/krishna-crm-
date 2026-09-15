'use client';

import React, { useEffect } from 'react';
import { X, Filter, RotateCcw, Check, User as UserIcon, Calendar, Tag, Layers } from 'lucide-react';
import type { User, TaskStatus, Priority } from '@/types';

export interface TaskFilterState {
  search: string;
  scope: 'all' | 'standard' | 'daily';
  status: string;
  priority: string;
  assignedTo: string;
  overdueOnly: boolean;
}

interface TaskFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: TaskFilterState;
  onChangeFilters: (filters: TaskFilterState) => void;
  onResetFilters: () => void;
  users: User[];
  matchCount?: number;
}

export default function TaskFilterDrawer({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  onResetFilters,
  users,
  matchCount,
}: TaskFilterDrawerProps) {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const update = <K extends keyof TaskFilterState>(key: K, val: TaskFilterState[K]) => {
    onChangeFilters({ ...filters, [key]: val });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Filter Panel */}
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-[#FFFDF7] shadow-2xl flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center justify-center">
              <Filter size={15} />
            </div>
            <div>
              <h3 className="text-sm font-black text-navy leading-none">Task Module Filters</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                Refine unified workspace queries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-navy px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              title="Reset all filter parameters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Filter 1: Task Scope */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Workspace Task Scope
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 text-xs">
              {(['all', 'standard', 'daily'] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => update('scope', sc)}
                  className={`py-1.5 px-2 rounded-lg font-bold capitalize text-center transition-all ${
                    filters.scope === sc
                      ? 'bg-white text-navy shadow-2xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-navy'
                  }`}
                >
                  {sc === 'all' ? 'Unified All' : sc === 'standard' ? 'Tickets' : 'Daily SOP'}
                </button>
              ))}
            </div>
          </div>

          {/* Filter 2: Staff Member / Assignee */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Assigned Staff Member
            </label>
            <select
              value={filters.assignedTo}
              onChange={(e) => update('assignedTo', e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white text-navy focus:outline-none focus:border-amber"
            >
              <option value="">All Team Members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Status */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Execution Status
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { val: 'all', label: 'All Statuses' },
                { val: 'todo', label: 'To Do / Pending' },
                { val: 'in_progress', label: 'In Progress' },
                { val: 'completed', label: 'Done / Completed' },
              ].map((st) => (
                <button
                  key={st.val}
                  onClick={() => update('status', st.val)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold border transition-all ${
                    filters.status === st.val
                      ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                      : 'bg-white text-slate-600 border-slate-200/70 hover:bg-slate-50'
                  }`}
                >
                  <span>{st.label}</span>
                  {filters.status === st.val && <Check size={14} className="text-amber-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Filter 4: Priority */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Priority Urgency
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {['all', 'low', 'medium', 'high', 'urgent'].map((p) => (
                <button
                  key={p}
                  onClick={() => update('priority', p)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-center border transition-all ${
                    filters.priority === p
                      ? 'bg-navy text-white font-bold border-navy'
                      : 'bg-white text-slate-600 border-slate-200/70 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Filter 5: Overdue Toggle */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-navy">Overdue Deadlines Only</div>
              <div className="text-[10px] text-slate-400">Filter tasks past target due date</div>
            </div>
            <input
              type="checkbox"
              checked={filters.overdueOnly}
              onChange={(e) => update('overdueOnly', e.target.checked)}
              className="w-4 h-4 rounded text-amber focus:ring-amber border-slate-300 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200/70 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {matchCount !== undefined ? `${matchCount} tasks found` : 'Filters active'}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber text-navy font-bold text-xs hover:bg-amber-500 transition-colors shadow-2xs cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
