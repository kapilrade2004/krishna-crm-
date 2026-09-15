'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '@/components/ui';
import {
  CheckCircle2,
  Clock,
  Play,
  AlertTriangle,
  Send,
  MessageSquare,
  FileText,
  User as UserIcon,
  Shield,
  Tag,
  Check,
  Calendar,
  History,
} from 'lucide-react';
import { DailyActivity, DailyActivityStatus } from '@/types';
import { useAuthStore } from '@/lib/auth';
import { useUpdateDailyActivity, useDailyActivityById } from '@/hooks/useApi';
import { fmtDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

interface TaskDetailModalProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDetailModal({ taskId, isOpen, onClose }: TaskDetailModalProps) {
  const { user } = useAuthStore();
  const { data: task, isLoading } = useDailyActivityById(taskId || undefined);
  const updateMutation = useUpdateDailyActivity();

  const [status, setStatus] = useState<DailyActivityStatus>('ASSIGNED');
  const [actualHours, setActualHours] = useState<number>(0);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [newRemark, setNewRemark] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setActualHours(task.actual_hours || 0);
      setCompletionNotes(task.completion_notes || '');
      setNewRemark('');
    }
  }, [task]);

  if (!isOpen || !taskId) return null;

  const userRole = (user?.role || '').toLowerCase();
  const isSuperAdmin =
    userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || user?.permissions?.includes('*');
  const isManagerOrHr = userRole === 'manager' || userRole === 'hr';
  const isAssignee = task?.assigned_to === user?.id;
  const canEdit = isSuperAdmin || isManagerOrHr || isAssignee;

  const handleSaveChanges = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task) return;

    try {
      setIsSaving(true);
      await updateMutation.mutateAsync({
        id: task.id,
        status,
        actual_hours: Number(actualHours) || 0,
        completion_notes: completionNotes.trim() || undefined,
        note: newRemark.trim() || undefined,
      });

      setNewRemark('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const getPriorityBadge = (p?: string) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Low</span>;
      default:
        return <Badge label={p || 'Medium'} />;
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Task Execution & Audit Log">
      {isLoading || !task ? (
        <div className="py-16 text-center text-muted text-xs">Loading task details...</div>
      ) : (
        <form onSubmit={handleSaveChanges} className="space-y-4">
          {/* Header Metadata */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {getPriorityBadge(task.priority)}
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-navy/10 text-navy border border-navy/20">
                {status}
              </span>
              {task.category && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-slate-700 font-mono text-[10px] border border-border">
                  <Tag size={9} /> {task.category}
                </span>
              )}
            </div>

            <h3 className="text-base font-extrabold text-navy leading-snug">
              {task.title}
            </h3>

            <div className="flex items-center gap-4 text-xs text-muted mt-2 flex-wrap pt-2 border-t border-border/70">
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-amber-600" /> Scheduled Date: <strong className="text-navy font-semibold">{task.scheduled_date || 'Today'}</strong>
              </span>
              <span className="flex items-center gap-1">
                <UserIcon size={12} className="text-amber-600" /> Assigner: <strong className="text-navy font-semibold">{task.assigner?.name || 'Super Admin'}</strong>
              </span>
              <span className="flex items-center gap-1">
                <UserIcon size={12} className="text-amber-600" /> Assignee: <strong className="text-navy font-semibold">{task.assignee?.name || 'Employee'}</strong>
              </span>
            </div>
          </div>

          {/* Supervisor Instructions Card */}
          <div className="p-3.5 rounded-xl bg-surface/80 border border-border space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              <Shield size={13} />
              <span>Deliverables & Work Instructions</span>
            </div>
            <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
            {task.notes && (
              <p className="text-[11px] text-muted italic pt-1 border-t border-border/60">
                Operational note: {task.notes}
              </p>
            )}
          </div>

          {/* Quick Status Pill Selector */}
          {canEdit && (
            <div>
              <label className="form-label font-semibold mb-1.5 block">
                Update Execution Status:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ASSIGNED', label: 'Assigned / Pending', icon: Clock, color: 'hover:border-blue-300' },
                  { id: 'IN_PROGRESS', label: 'In Progress', icon: Play, color: 'hover:border-purple-300' },
                  { id: 'COMPLETED', label: 'Completed', icon: CheckCircle2, color: 'hover:border-teal-300' },
                  { id: 'BLOCKED', label: 'Blocked / Issue', icon: AlertTriangle, color: 'hover:border-rose-300' },
                ].map((st) => {
                  const Icon = st.icon;
                  const isSelected = status === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatus(st.id as DailyActivityStatus)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-navy text-white border-navy shadow-sm ring-2 ring-amber/40'
                          : `bg-white text-slate-700 border-border ${st.color} hover:bg-surface`
                      }`}
                    >
                      <Icon size={13} />
                      <span>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Log Actual Hours & Completion Notes */}
          {canEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="form-label font-semibold flex items-center gap-1">
                  <Clock size={12} className="text-amber-600" /> Actual Hours Logged
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="24"
                    value={actualHours}
                    onChange={(e) => setActualHours(parseFloat(e.target.value) || 0)}
                    className="form-input text-xs"
                    placeholder="e.g. 2.5"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted font-bold">
                    hrs
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="form-label font-semibold">Completion Notes & Outcomes</label>
                <input
                  type="text"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Completed proposal review, scheduled follow-up for Friday"
                  className="form-input text-xs"
                />
              </div>
            </div>
          )}

          {/* Add Progress Remark Input */}
          {canEdit && (
            <div>
              <label className="form-label font-semibold flex items-center gap-1">
                <MessageSquare size={12} className="text-amber-600" /> Post Progress Remark / Update
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a timestamped remark or note to this task's activity feed..."
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  className="form-input text-xs flex-1"
                />
              </div>
            </div>
          )}

          {/* Activity Timeline History Feed */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-navy mb-2 pt-2 border-t border-border">
              <History size={14} className="text-amber-600" />
              <span>Activity History & Audit Trail</span>
            </div>

            {task.history && task.history.length > 0 ? (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {task.history.map((hist) => (
                  <div
                    key={hist.id}
                    className="p-2.5 rounded-lg bg-surface/50 border border-border/70 flex items-start gap-2.5 text-xs"
                  >
                    <div className="w-6 h-6 rounded-full bg-navy/10 text-navy font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {hist.actor?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-navy text-[11px]">{hist.actor?.name || 'System'}</span>
                        <span className="text-[10px] text-muted">{fmtDateTime(hist.created_at)}</span>
                      </div>
                      <p className="text-slate-700 text-[11px] mt-0.5">{hist.notes}</p>
                      {hist.old_status && hist.new_status && hist.old_status !== hist.new_status && (
                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                          <span className="px-1.5 py-0.2 rounded bg-surface border border-border text-muted">
                            {hist.old_status}
                          </span>
                          <span className="text-muted">→</span>
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 border border-amber-300 text-amber-800 font-semibold">
                            {hist.new_status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No activity history recorded yet.</p>
            )}
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canEdit && (
              <Button type="submit" disabled={isSaving || updateMutation.isPending} className="btn-primary">
                {isSaving ? 'Saving...' : 'Save Updates'}
              </Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
