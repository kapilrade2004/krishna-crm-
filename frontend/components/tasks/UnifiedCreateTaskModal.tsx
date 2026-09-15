'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, Textarea } from '@/components/ui';
import {
  CheckSquare,
  Activity,
  Layers,
  Repeat,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import {
  useCreateTask,
  useCreateDailyActivity,
  useDailyActivityAssignableUsers,
  useUsers,
} from '@/hooks/useApi';
import { useNotificationStore } from '@/lib/notifications';
import toast from 'react-hot-toast';
import type { Task, Priority, User } from '@/types';

function getFormattedDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

interface UnifiedCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'standard' | 'daily';
  preSelectedDate?: string;
  preSelectedUserId?: string;
}

export default function UnifiedCreateTaskModal({
  isOpen,
  onClose,
  defaultMode = 'standard',
  preSelectedDate,
  preSelectedUserId,
}: UnifiedCreateTaskModalProps) {
  const { user } = useAuthStore();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [mode, setMode] = useState<'standard' | 'daily'>(defaultMode);

  // Queries
  const { data: assignableUsers = [] } = useDailyActivityAssignableUsers();
  const { data: usersData } = useUsers();
  const allUsers: User[] = Array.isArray(usersData)
    ? usersData
    : (usersData as unknown as { data?: User[] })?.data || [];

  const createStandardTask = useCreateTask();
  const createDailyActivity = useCreateDailyActivity();

  const todayStr = getFormattedDate(0);

  // Common Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  // Standard Task Specific Fields
  const [assignedToSingle, setAssignedToSingle] = useState('');
  const [dueDate, setDueDate] = useState(todayStr);

  // Daily Directive Specific Fields
  const [assignedToMultiple, setAssignedToMultiple] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState(preSelectedDate || todayStr);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setScheduledDate(preSelectedDate || todayStr);
      setDueDate(todayStr);
      if (preSelectedUserId) {
        setAssignedToSingle(preSelectedUserId);
        setAssignedToMultiple([preSelectedUserId]);
      } else if (assignableUsers.length > 0) {
        setAssignedToSingle(assignableUsers[0].id);
        setAssignedToMultiple([assignableUsers[0].id]);
      }
    }
  }, [isOpen, defaultMode, preSelectedDate, preSelectedUserId, assignableUsers, todayStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title.');
      return;
    }

    try {
      if (mode === 'standard') {
        // Create Standard Task
        await createStandardTask.mutateAsync({
          title: title.trim(),
          description: description.trim(),
          assigned_to: assignedToSingle || undefined,
          due_date: dueDate,
          priority,
          status: 'todo',
        } as Partial<Task>);

        toast.success('Standard Task created successfully.');
      } else {
        // Create Standing Daily Directive
        if (assignedToMultiple.length === 0) {
          toast.error('Please select at least one employee for the daily directive.');
          return;
        }

        await createDailyActivity.mutateAsync({
          title: title.trim(),
          description: description.trim() || 'Daily operational directive.',
          assigned_to: assignedToMultiple.length === 1 ? assignedToMultiple[0] : assignedToMultiple,
          priority: priority as 'low' | 'medium' | 'high' | 'urgent',
          scheduled_date: scheduledDate,
          due_date: scheduledDate,
          notes: notes.trim() || undefined,
        });

        assignedToMultiple.forEach((targetId) => {
          const target = assignableUsers.find((u: { id: string; email?: string }) => u.id === targetId);
          if (target?.email) {
            addNotification({
              userId: target.email,
              title: 'New Standing Daily Directive',
              message: `${user?.name || 'Manager'} assigned daily directive "${title.trim()}" starting ${scheduledDate}`,
              type: 'task',
            });
          }
        });

        toast.success('Standing Daily Directive created and assigned successfully.');
      }

      // Reset and close
      setTitle('');
      setDescription('');
      setNotes('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create task.';
      toast.error(msg);
    }
  };

  const priorityOptions = [
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'urgent', label: 'Urgent / Critical' },
  ];

  const userOptions = [
    { value: '', label: 'Unassigned' },
    ...allUsers.map((u: User) => ({
      value: u.id,
      label: `${u.name || u.email} (${u.role})`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Task / Daily Directive"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Mode Selector Toggle */}
        <div className="bg-surface/80 p-1.5 rounded-xl border border-border flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('standard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'standard'
                ? 'bg-amber text-navy font-bold shadow-sm'
                : 'text-muted hover:text-navy hover:bg-white/60'
            }`}
          >
            <CheckSquare size={16} />
            🔵 Standard Task
          </button>
          <button
            type="button"
            onClick={() => setMode('daily')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === 'daily'
                ? 'bg-amber text-navy font-bold shadow-sm'
                : 'text-muted hover:text-navy hover:bg-white/60'
            }`}
          >
            <Activity size={16} />
            🟣 Standing Daily Directive
          </button>
        </div>

        {mode === 'daily' && (
          <div className="space-y-2">
            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <Repeat size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Standing Manager Directive:</span> This task will recur on the assigned employee&apos;s daily checklist every working day until you modify or revoke it.
              </div>
            </div>

            {/* Quick SOP Template Picker */}
            <div>
              <p className="text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-wider">⚡ Quick SOP Templates (Auto-fill)</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    name: 'Telecaller NDR',
                    t: 'EasyShip Order NDR Calling & Confirmation',
                    d: 'Call customers on pending COD orders to confirm address, phone, and delivery readiness. Target >= 95% verification rate.',
                    p: 'high',
                  },
                  {
                    name: 'Reviewer Fraud',
                    t: 'High-Risk & Serviceable Pincode Audit',
                    d: 'Inspect incoming orders for fraud risk, high-value COD anomalies, and courier serviceability before dispatch confirmation.',
                    p: 'high',
                  },
                  {
                    name: 'Accountant Recon',
                    t: 'Daily Settlement & Payment Reconciliation',
                    d: 'Match Amazon/Flipkart remittance reports against bank entries, register pending dispute deductions, and check GST output.',
                    p: 'medium',
                  },
                  {
                    name: 'Ads / ROAS',
                    t: 'PPC Campaign Budget & ROAS Monitoring',
                    d: 'Audit daily ad spend, pause bleeders below target ROAS, adjust top placement bids, and log search term additions.',
                    p: 'medium',
                  },
                  {
                    name: 'Returns RTO',
                    t: 'Daily RTO Inbound Physical Inspection',
                    d: 'Physically open and photograph all received customer return shipments, log damage state, and raise carrier claims.',
                    p: 'urgent',
                  },
                ].map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => {
                      setTitle(s.t);
                      setDescription(s.d);
                      setPriority(s.p as Priority);
                    }}
                    className="px-2 py-1 bg-white hover:bg-amber-50 border border-border hover:border-amber text-[11px] font-medium text-navy rounded-lg transition-colors shadow-xs"
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-navy mb-1">
            {mode === 'standard' ? 'Task Title *' : 'Standing Directive Title *'}
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              mode === 'standard'
                ? 'e.g. Follow up on Enterprise Purifier Deal / Quotation'
                : 'e.g. EasyShip Order Confirmation Calling (95% Target)'
            }
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-navy mb-1">
            Description / Standard Instructions
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Detailed instructions or expectations for this work..."
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-medium text-navy mb-1">Priority Level</label>
          <Select
            options={priorityOptions}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />
        </div>

        {/* Mode Specific Inputs */}
        {mode === 'standard' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-navy mb-1">Assignee</label>
              <Select
                options={userOptions}
                value={assignedToSingle}
                onChange={(e) => setAssignedToSingle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-navy mb-1">Target Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-navy mb-1">
                Assign to Direct Report(s) *
              </label>
              <div className="max-h-36 overflow-y-auto border border-border rounded-xl p-2 space-y-1 bg-white">
                {assignableUsers.map((u: User) => {
                  const checked = assignedToMultiple.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        checked ? 'bg-amber-50/80 font-semibold text-navy' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignedToMultiple([...assignedToMultiple, u.id]);
                          } else {
                            setAssignedToMultiple(assignedToMultiple.filter((id) => id !== u.id));
                          }
                        }}
                        className="accent-amber-500 rounded"
                      />
                      <span>{u.name}</span>
                      <span className="text-[10px] text-muted font-normal">({u.role})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-navy mb-1">Effective Start Date</label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createStandardTask.isPending || createDailyActivity.isPending}
            className="bg-amber text-navy hover:bg-amber-400 font-bold"
          >
            {mode === 'standard' ? 'Create Standard Task' : 'Assign Standing Directive'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
