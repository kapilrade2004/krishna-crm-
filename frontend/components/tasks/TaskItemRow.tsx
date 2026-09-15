'use client';

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  CheckSquare,
  Activity,
  ChevronRight,
  Star,
  User as UserIcon,
  AlertTriangle,
  Tag,
  MoreVertical,
} from 'lucide-react';
import { fmtDate, PRIORITY_COLOURS } from '@/lib/utils';
import type { Task, DailyActivity, Priority } from '@/types';
import type { InspectableTask } from './TaskDetailDrawer';

interface TaskItemRowProps {
  item: InspectableTask;
  onSelect: (item: InspectableTask) => void;
  onToggleComplete: (item: InspectableTask) => void;
  onStatusChange?: (item: InspectableTask, nextStatus: string) => void;
  canScore?: boolean;
}

export default function TaskItemRow({
  item,
  onSelect,
  onToggleComplete,
  onStatusChange,
  canScore,
}: TaskItemRowProps) {
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
  const progressPercent = isStandard ? task?.progress_percent : isDone ? 100 : 0;
  const score = isStandard ? task?.score : undefined;

  const isOverdue =
    dueDate &&
    new Date(dueDate) < new Date() &&
    !isDone &&
    task?.status !== 'cancelled';

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-all duration-180 cursor-pointer ${
        isDone
          ? 'bg-slate-50/70 border-[#E7E5DE]/60 opacity-75'
          : 'bg-white border-[#E7E5DE] hover:border-slate-300 hover:bg-[#F7F6F2] hover:shadow-xs'
      }`}
    >
      {/* Left: Checkbox + Icon Badge + Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Instant Completion Checkbox Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(item);
          }}
          className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isDone
              ? 'text-teal-600 hover:text-teal-700'
              : 'text-slate-300 hover:text-amber group-hover:border-slate-400'
          }`}
          title={isDone ? 'Click to reopen' : 'Click to mark completed'}
        >
          {isDone ? (
            <CheckCircle2 size={20} className="fill-teal-50" />
          ) : (
            <Circle size={18} />
          )}
        </button>

        {/* Squircle Type Badge */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
            isStandard
              ? 'bg-amber-50 text-amber-700 border-amber-200/70'
              : 'bg-teal-50 text-teal-700 border-teal-200/70'
          }`}
          title={isStandard ? 'Standard Project Ticket' : 'Daily SOP Directive'}
        >
          {isStandard ? <CheckSquare size={14} /> : <Activity size={14} />}
        </div>

        {/* Title and Snippet */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold truncate leading-tight ${
                isDone ? 'line-through text-slate-400' : 'text-navy group-hover:text-amber-700'
              }`}
            >
              {title}
            </span>

            {/* Overdue Alert Pill */}
            {isOverdue && (
              <span className="shrink-0 px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={9} /> Overdue
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            {isStandard ? (
              <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded">
                Ticket #{task?.id.slice(0, 6)}
              </span>
            ) : (
              <span className="text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.2 rounded">
                Daily SOP
              </span>
            )}

            {description && (
              <span className="truncate max-w-xs text-slate-500 font-normal hidden sm:inline">
                · {description}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Metadata Badges + Assignee + Quick Action */}
      <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Progress percent mini indicator */}
        {isStandard && progressPercent !== undefined && progressPercent > 0 && !isDone && (
          <div className="hidden md:flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
            <span>{progressPercent}%</span>
          </div>
        )}

        {/* Priority Badge */}
        {priority && (
          <span
            className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              PRIORITY_COLOURS[priority as Priority] || 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {priority}
          </span>
        )}

        {/* Due Date */}
        {dueDate && (
          <span
            className={`hidden lg:flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
              isOverdue
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-slate-50 text-slate-600 border-slate-200/70'
            }`}
          >
            <Calendar size={11} className="text-slate-400" />
            <span>{fmtDate(dueDate)}</span>
          </span>
        )}

        {/* Assignee Avatar */}
        <div
          className="w-6 h-6 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-[10px] font-black flex items-center justify-center shrink-0"
          title={assignee ? `Assigned to: ${assignee.name}` : 'Unassigned'}
        >
          {assignee?.name?.[0]?.toUpperCase() || <UserIcon size={12} />}
        </div>

        {/* Score Badge (if scored) */}
        {score !== undefined && score > 0 && (
          <span className="hidden xl:inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
            <Star size={10} fill="currentColor" /> {score}
          </span>
        )}

        {/* Quick Status Dropdown Button */}
        {onStatusChange && (
          <select
            value={isStandard ? task?.status : daily?.status}
            onChange={(e) => onStatusChange(item, e.target.value)}
            className="text-[11px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-navy focus:outline-none focus:border-amber cursor-pointer"
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

        {/* Open Drawer Inspector Trigger */}
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors"
          title="Open Toggle Window Inspector"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
