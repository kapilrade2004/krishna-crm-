'use client';

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  CheckSquare,
  Activity,
  Star,
  User as UserIcon,
  AlertTriangle,
  Tag,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import { fmtDate, PRIORITY_COLOURS } from '@/lib/utils';
import type { Task, DailyActivity, Priority } from '@/types';
import type { InspectableTask } from './TaskDetailDrawer';

interface TaskItemCardProps {
  item: InspectableTask;
  onSelect: (item: InspectableTask) => void;
  onToggleComplete: (item: InspectableTask) => void;
  onStatusChange?: (item: InspectableTask, nextStatus: string) => void;
  canScore?: boolean;
}

export default function TaskItemCard({
  item,
  onSelect,
  onToggleComplete,
  onStatusChange,
  canScore,
}: TaskItemCardProps) {
  const isStandard = item.type === 'standard';
  const task = isStandard ? (item.data as Task) : null;
  const daily = !isStandard ? (item.data as DailyActivity) : null;

  const isDone = isStandard
    ? task?.status === 'done'
    : daily?.status === 'completed' || daily?.status === 'COMPLETED';

  const title = isStandard ? task?.title : daily?.title;
  const description = isStandard ? task?.description : daily?.description;
  const priority = isStandard ? task?.priority : daily?.priority;
  const assignee = isStandard ? task?.assignedUser : daily?.assignee;
  const dueDate = isStandard ? task?.due_date : daily?.due_date || daily?.scheduled_date;
  const progressPercent = isStandard ? task?.progress_percent || 0 : isDone ? 100 : 0;
  const score = isStandard ? task?.score : undefined;

  const isOverdue =
    dueDate &&
    new Date(dueDate) < new Date() &&
    !isDone &&
    task?.status !== 'cancelled';

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group bg-[#FFFDF7] rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
        isDone
          ? 'border-slate-200/50 opacity-80'
          : 'border-slate-200/80 hover:border-amber/60 hover:shadow-sm'
      }`}
    >
      {/* Top Header: Badge, Priority & Overdue */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isStandard ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
              <CheckSquare size={11} className="text-amber-600" />
              <span>Ticket #{task?.id.slice(0, 6)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/70">
              <Activity size={11} className="text-teal-600" />
              <span>Daily SOP</span>
            </span>
          )}

          {priority && (
            <span
              className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                PRIORITY_COLOURS[priority as Priority] || 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {priority}
            </span>
          )}
        </div>

        {isOverdue && (
          <span className="px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5">
            <AlertTriangle size={9} /> Overdue
          </span>
        )}
      </div>

      {/* Main: Checkbox + Title + Description */}
      <div className="space-y-1.5 flex-1">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(item);
            }}
            className={`mt-0.5 shrink-0 transition-colors cursor-pointer ${
              isDone ? 'text-teal-600' : 'text-slate-300 hover:text-amber'
            }`}
            title={isDone ? 'Mark uncompleted' : 'Mark completed'}
          >
            {isDone ? (
              <CheckCircle2 size={18} className="fill-teal-50" />
            ) : (
              <Circle size={18} />
            )}
          </button>

          <h4
            className={`text-xs sm:text-sm font-bold leading-snug line-clamp-2 ${
              isDone ? 'line-through text-slate-400' : 'text-navy group-hover:text-amber-700'
            }`}
          >
            {title}
          </h4>
        </div>

        {description && (
          <p className="text-xs text-slate-500 line-clamp-2 pl-7 font-normal">
            {description}
          </p>
        )}
      </div>

      {/* Progress Bar (Standard Tasks) */}
      {isStandard && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isDone ? 'bg-teal-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: Assignee, Due Date, Score, Status selector */}
      <div
        className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Assignee pill */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[9px] flex items-center justify-center shrink-0">
            {assignee?.name?.[0]?.toUpperCase() || <UserIcon size={10} />}
          </div>
          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[90px]">
            {assignee?.name || 'Unassigned'}
          </span>
        </div>

        {/* Due Date & Quick Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          {score !== undefined && score > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              <Star size={10} fill="currentColor" /> {score}
            </span>
          )}

          {onStatusChange && (
            <select
              value={isStandard ? task?.status : daily?.status}
              onChange={(e) => onStatusChange(item, e.target.value)}
              className="text-[10px] font-bold border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-navy focus:outline-none focus:border-amber cursor-pointer"
            >
              {isStandard ? (
                <>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </>
              ) : (
                <>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </>
              )}
            </select>
          )}

          <button
            type="button"
            onClick={() => onSelect(item)}
            className="p-1 rounded-md text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors"
            title="Inspect Task in Toggle Window"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
