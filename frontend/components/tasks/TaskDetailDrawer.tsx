'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  Calendar,
  User as UserIcon,
  Tag,
  AlertTriangle,
  Award,
  Star,
  CheckSquare,
  Activity,
  MessageSquare,
  Send,
  Pencil,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Percent,
} from 'lucide-react';
import { fmtDate, PRIORITY_COLOURS } from '@/lib/utils';
import type { Task, DailyActivity, Priority, TaskStatus } from '@/types';
import toast from 'react-hot-toast';

export type InspectableTask =
  | { type: 'standard'; data: Task }
  | { type: 'daily'; data: DailyActivity };

interface TaskDetailDrawerProps {
  item: InspectableTask | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (status: string) => Promise<void>;
  onUpdateProgress?: (percent: number) => Promise<void>;
  onAddNote?: (note: string) => Promise<void>;
  onScoreTask?: (score: number, comment: string) => Promise<void>;
  onOpenEdit?: (task: Task) => void;
  onDelete?: () => void;
  canScore?: boolean;
  canDelete?: boolean;
}

export default function TaskDetailDrawer({
  item,
  isOpen,
  onClose,
  onUpdateStatus,
  onUpdateProgress,
  onAddNote,
  onScoreTask,
  onOpenEdit,
  onDelete,
  canScore = false,
  canDelete = false,
}: TaskDetailDrawerProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [scoreVal, setScoreVal] = useState<number>(8);
  const [scoreComment, setScoreComment] = useState('');
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  const [progressVal, setProgressVal] = useState<number>(0);

  // Sync initial state
  useEffect(() => {
    if (item?.type === 'standard') {
      setProgressVal(item.data.progress_percent || 0);
      setScoreVal(item.data.score || 8);
      setScoreComment(item.data.score_comment || '');
    } else if (item?.type === 'daily') {
      const isDone = item.data.status === 'completed' || item.data.status === 'COMPLETED';
      setProgressVal(isDone ? 100 : 0);
    }
  }, [item]);

  // Handle ESC key to close
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

  if (!isOpen || !item) return null;

  const isStandard = item.type === 'standard';
  const standardData = isStandard ? (item.data as Task) : null;
  const dailyData = !isStandard ? (item.data as DailyActivity) : null;

  const title = isStandard ? standardData?.title : dailyData?.title;
  const description = isStandard ? standardData?.description : dailyData?.description;
  const priority = isStandard ? standardData?.priority : dailyData?.priority;
  const status = isStandard ? standardData?.status : dailyData?.status;
  const assignee = isStandard ? standardData?.assignedUser : dailyData?.assignee;
  const dueDate = isStandard ? standardData?.due_date : dailyData?.due_date || dailyData?.scheduled_date;

  const isDone = isStandard
    ? standardData?.status === 'done'
    : dailyData?.status === 'completed' || dailyData?.status === 'COMPLETED';

  const handleQuickStatusChange = async (nextStatus: string) => {
    if (onUpdateStatus) {
      try {
        await onUpdateStatus(nextStatus);
        toast.success(`Status updated to ${nextStatus.toUpperCase()}`);
      } catch {
        toast.error('Failed to update status');
      }
    }
  };

  const handleProgressChange = async (val: number) => {
    setProgressVal(val);
    if (onUpdateProgress) {
      try {
        await onUpdateProgress(val);
      } catch {
        toast.error('Failed to update progress');
      }
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !onAddNote) return;
    setIsSubmittingComment(true);
    try {
      await onAddNote(newComment.trim());
      setNewComment('');
      toast.success('Note added successfully');
    } catch {
      toast.error('Failed to record note');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleScoreSubmit = async () => {
    if (!onScoreTask) return;
    setIsSubmittingScore(true);
    try {
      await onScoreTask(scoreVal, scoreComment);
      toast.success(`Score of ${scoreVal}/10 recorded!`);
    } catch {
      toast.error('Failed to record score');
    } finally {
      setIsSubmittingScore(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Panel (Toggle Window) */}
      <div className="absolute inset-y-0 right-0 max-w-xl w-full bg-[#FFFDF7] shadow-2xl flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Task Type Badge */}
            {isStandard ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/70">
                <CheckSquare size={12} className="text-amber-600" />
                <span>Standard Ticket</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200/70">
                <Activity size={12} className="text-teal-600" />
                <span>Daily SOP Directive</span>
              </span>
            )}

            {/* Priority Pill */}
            {priority && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  PRIORITY_COLOURS[priority as Priority] || 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {priority}
              </span>
            )}

            {/* ID */}
            <span className="text-[11px] font-mono text-slate-400 font-semibold">
              #{item.data.id.slice(0, 8)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {isStandard && onOpenEdit && standardData && (
              <button
                onClick={() => onOpenEdit(standardData)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-navy hover:bg-slate-100 transition-colors"
                title="Edit Task"
              >
                <Pencil size={15} />
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete Task"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors ml-1"
              title="Close Panel (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Title & Status Strip */}
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-black text-navy leading-snug tracking-tight">
              {title}
            </h2>

            {/* Quick Status Pill Bar */}
            <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Current Status &amp; Transitions
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {isStandard ? (
                  ['todo', 'in_progress', 'review', 'done', 'cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleQuickStatusChange(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        status === st
                          ? 'bg-navy text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.replace('_', ' ').toUpperCase()}
                    </button>
                  ))
                ) : (
                  ['pending', 'in_progress', 'completed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleQuickStatusChange(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        status === st
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.replace('_', ' ').toUpperCase()}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Description & SOP Checklist */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/70 shadow-2xs space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Operational Scope &amp; Guidelines
            </div>
            {description ? (
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                {description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided for this task.</p>
            )}
          </div>

          {/* Progress Percent Slider */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/70 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Completion Progress
              </span>
              <span className="text-sm font-black text-navy">{progressVal}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progressVal}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full accent-amber h-2 bg-slate-100 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
              <span>0% (Not Started)</span>
              <span>50% (In Flight)</span>
              <span>100% (Completed)</span>
            </div>
          </div>

          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Assignee Card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 font-black text-sm flex items-center justify-center shrink-0">
                {assignee?.name?.[0]?.toUpperCase() || <UserIcon size={18} />}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Assigned Staff
                </div>
                <div className="text-xs font-bold text-navy truncate">
                  {assignee?.name || 'Unassigned Staff'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {assignee?.email || assignee?.role || 'Staff Member'}
                </div>
              </div>
            </div>

            {/* Due / Scheduled Date Card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Target Deadline
                </div>
                <div className="text-xs font-bold text-navy">
                  {dueDate ? fmtDate(dueDate) : 'No due date'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {isDone ? 'Finished' : 'Pending completion'}
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {standardData?.tags && standardData.tags.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Categorization Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {standardData.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    <Tag size={10} className="text-slate-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Manager Quality Score Widget (SOW §3.7) */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/70 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Manager Quality &amp; Audit Score
              </div>
              <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md">
                {scoreVal}/10 Stars
              </span>
            </div>

            {canScore ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setScoreVal(star)}
                      className={`p-1 rounded transition-colors ${
                        star <= scoreVal ? 'text-amber-500 hover:scale-110' : 'text-slate-200 hover:text-amber-300'
                      }`}
                    >
                      <Star size={16} fill={star <= scoreVal ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Manager review note / feedback..."
                  value={scoreComment}
                  onChange={(e) => setScoreComment(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber bg-[#FFFDF7]"
                />
                <button
                  onClick={handleScoreSubmit}
                  disabled={isSubmittingScore}
                  className="px-3 py-1 rounded-lg bg-navy text-white text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingScore ? 'Saving Score...' : 'Record Audit Score'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: scoreVal }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {scoreComment || 'Audited by supervisor'}
                </span>
              </div>
            )}
          </div>

          {/* Notes & Activity Log Section */}
          <div className="bg-white rounded-xl p-4 border border-slate-200/70 shadow-2xs space-y-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={12} />
              <span>Internal Execution Notes</span>
            </div>

            {/* Note Input */}
            {onAddNote && (
              <form onSubmit={handleCommentSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a progress update note..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber bg-[#FFFDF7]"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmittingComment}
                  className="px-3 py-1.5 rounded-lg bg-amber text-navy font-bold text-xs hover:bg-amber-500 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send size={13} />
                </button>
              </form>
            )}

            {/* Existing Notes Display */}
            {isStandard && standardData?.notes && (
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/60 text-xs text-slate-700 whitespace-pre-wrap">
                {standardData.notes}
              </div>
            )}
            {!isStandard && dailyData?.notes && (
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/60 text-xs text-slate-700 whitespace-pre-wrap">
                {dailyData.notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200/70 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close Inspector
          </button>

          <button
            onClick={() => handleQuickStatusChange(isDone ? (isStandard ? 'todo' : 'pending') : (isStandard ? 'done' : 'completed'))}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isDone
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>{isDone ? 'Reopen Task' : 'Mark Completed'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
