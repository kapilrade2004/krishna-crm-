'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@/components/ui';
import {
  Calendar,
  User as UserIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useCreateDailyActivity, useDailyActivityAssignableUsers } from '@/hooks/useApi';
import { useNotificationStore } from '@/lib/notifications';
import toast from 'react-hot-toast';

function getFormattedDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

interface TaskAssignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedDate?: string;
  preSelectedUserId?: string;
}

export default function TaskAssignerModal({
  isOpen,
  onClose,
  preSelectedDate,
  preSelectedUserId,
}: TaskAssignerModalProps) {
  const { user } = useAuthStore();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const { data: assignableUsers = [], isLoading: loadingUsers } = useDailyActivityAssignableUsers();
  const createMutation = useCreateDailyActivity();

  const todayStr = getFormattedDate(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [scheduledDate, setScheduledDate] = useState(preSelectedDate || todayStr);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setScheduledDate(preSelectedDate || todayStr);
      if (preSelectedUserId) {
        setAssignedTo([preSelectedUserId]);
      } else if (assignableUsers.length > 0) {
        setAssignedTo((prev) => (prev.length === 0 ? [assignableUsers[0].id] : prev));
      }
    }
  }, [isOpen, preSelectedDate, preSelectedUserId, assignableUsers, todayStr]);

  const setDateOffset = (offset: number) => {
    const d = getFormattedDate(offset);
    setScheduledDate(d);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a task title.');
      return;
    }
    if (!description.trim()) {
      toast.error('Please enter work scope / instructions.');
      return;
    }
    if (assignedTo.length === 0) {
      toast.error('Please select at least one employee to assign.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        assigned_to: assignedTo.length === 1 ? assignedTo[0] : assignedTo,
        priority,
        scheduled_date: scheduledDate,
        due_date: scheduledDate,
        notes: notes.trim() || undefined,
      });

      // Dispatch notifications
      assignedTo.forEach((targetId) => {
        const target = assignableUsers.find((u) => u.id === targetId);
        if (target?.email) {
          addNotification({
            userId: target.email,
            title: 'New Daily Task Assigned',
            message: `${user?.name || 'Super Admin'} assigned you "${title.trim()}" for ${scheduledDate}`,
            type: 'task',
          });
        }
      });

      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setAssignedTo([]);
      setPriority('medium');
      setNotes('');
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Assign Daily Task to Employee">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Scheduled Date with Quick Presets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="form-label font-semibold flex items-center gap-1 mb-0">
              <Calendar size={13} className="text-amber-600" /> Scheduled Date *
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDateOffset(0)}
                className={`text-[11px] px-2.5 py-0.5 rounded-lg font-bold transition-all ${
                  scheduledDate === todayStr
                    ? 'bg-amber text-navy shadow-xs'
                    : 'bg-surface hover:bg-slate-200 text-muted'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateOffset(1)}
                className={`text-[11px] px-2.5 py-0.5 rounded-lg font-bold transition-all ${
                  scheduledDate === getFormattedDate(1)
                    ? 'bg-amber text-navy shadow-xs'
                    : 'bg-surface hover:bg-slate-200 text-muted'
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDateOffset(2)}
                className={`text-[11px] px-2.5 py-0.5 rounded-lg font-bold transition-all ${
                  scheduledDate === getFormattedDate(2)
                    ? 'bg-amber text-navy shadow-xs'
                    : 'bg-surface hover:bg-slate-200 text-muted'
                }`}
              >
                +2 Days
              </button>
            </div>
          </div>

          <input
            type="date"
            required
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        {/* Task Title */}
        <div>
          <label className="form-label font-semibold">Task Title *</label>
          <input
            type="text"
            required
            placeholder="e.g. Follow up on hot leads from campaign & update CRM status"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
          />
        </div>

        {/* Assignee Selection (Role Filtered) */}
        <div>
          <label className="form-label font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1">
              <UserIcon size={13} className="text-amber-600" /> Assign To Employee *
            </span>
            <span className="text-[10px] text-muted">Filtered by role permission hierarchy</span>
          </label>

          {loadingUsers ? (
            <p className="text-xs text-muted py-2">Loading authorized workforce...</p>
          ) : assignableUsers.length === 0 ? (
            <p className="text-xs text-rose-500 py-2">No authorized assignees available for your role.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto border border-border rounded-xl p-2 space-y-1 bg-surface/30">
              {assignableUsers.map((u) => {
                const selected = assignedTo.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      selected ? 'bg-amber-100/70 border border-amber-300 font-semibold text-navy' : 'hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignedTo((prev) => [...prev, u.id]);
                          } else {
                            setAssignedTo((prev) => prev.filter((id) => id !== u.id));
                          }
                        }}
                        className="rounded border-border text-amber focus:ring-amber"
                      />
                      <span>{u.name}</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-white rounded border border-border text-muted">
                      {u.role}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Priority */}
        <div>
          <label className="form-label font-semibold">Priority *</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="form-select text-xs"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Description / Deliverables & Work Scope */}
        <div>
          <label className="form-label font-semibold">Deliverables & Work Scope *</label>
          <textarea
            rows={3}
            required
            placeholder="Outline exact objectives, required deliverables, and step-by-step instructions..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        {/* Optional Notes */}
        <div>
          <label className="form-label font-semibold">Additional Operational Notes (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Reference Client Ticket #4021 or SOW Appendix B"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? 'Assigning...' : 'Assign Daily Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
