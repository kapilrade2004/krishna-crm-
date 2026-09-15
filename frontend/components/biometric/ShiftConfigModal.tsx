'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Badge } from '@/components/ui';
import { Clock, Plus, CheckCircle, ShieldCheck, Settings2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { AttendanceShift } from '@/types';

interface ShiftConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ShiftConfigModal({ isOpen, onClose, onSuccess }: ShiftConfigModalProps) {
  const [shifts, setShifts] = useState<AttendanceShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    shift_name: '',
    shift_code: '',
    start_time: '10:00',
    end_time: '18:00',
    grace_period_minutes: 10,
    min_full_day_hours: 8.0,
    min_half_day_hours: 4.0,
    is_default: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/biometric/shifts');
      setShifts(res.data?.data?.shifts || []);
    } catch {
      toast.error('Failed to load shift definitions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchShifts();
      setIsAdding(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.shift_name.trim() || !form.shift_code.trim()) {
      return toast.error('Shift name and code are required.');
    }

    setSaving(true);
    try {
      await api.post('/biometric/shifts', {
        ...form,
        start_time: `${form.start_time}:00`.slice(0, 8),
        end_time: `${form.end_time}:00`.slice(0, 8),
      });
      toast.success('Shift policy created successfully!');
      setIsAdding(false);
      fetchShifts();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save shift.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Attendance Shifts & Grace Period Rules" size="lg">
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between bg-surface/50 p-3 rounded-xl border border-border">
          <div>
            <p className="font-bold text-navy">Configured Shift Schedules</p>
            <p className="text-[11px] text-muted">Defines working hours, late arrival grace period, and minimum hours</p>
          </div>
          {!isAdding && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setIsAdding(true)}
              className="bg-navy text-white font-bold"
            >
              Add New Shift
            </Button>
          )}
        </div>

        {/* Add Shift Form */}
        {isAdding && (
          <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3">
            <p className="font-bold text-navy flex items-center gap-1.5">
              <Settings2 size={14} className="text-indigo-600" /> Create Work Shift
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Shift Name *"
                placeholder="e.g. General Day Shift (10 AM - 6 PM)"
                value={form.shift_name}
                onChange={(e) => setForm({ ...form, shift_name: e.target.value })}
                required
              />
              <Input
                label="Shift Code *"
                placeholder="e.g. GEN_10_06"
                value={form.shift_code}
                onChange={(e) => setForm({ ...form, shift_code: e.target.value })}
                required
              />
              <div>
                <label className="block font-semibold text-navy mb-1">Start Time *</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-navy mb-1">End Time *</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white"
                  required
                />
              </div>
              <Input
                label="Grace Period (Minutes)"
                type="number"
                value={form.grace_period_minutes}
                onChange={(e) => setForm({ ...form, grace_period_minutes: Number(e.target.value) })}
              />
              <Input
                label="Min Full-Day (Hours)"
                type="number"
                value={form.min_full_day_hours}
                onChange={(e) => setForm({ ...form, min_full_day_hours: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={saving} className="bg-indigo-600 text-white font-bold">
                Save Shift
              </Button>
            </div>
          </form>
        )}

        {/* Shifts Table */}
        <div className="border border-border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-muted font-bold border-b border-border">
              <tr>
                <th className="p-3">Shift Name</th>
                <th className="p-3">Timing</th>
                <th className="p-3">Grace</th>
                <th className="p-3">Min Hours</th>
                <th className="p-3">Default</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                  <td className="p-3 font-semibold text-navy">{s.shift_name}</td>
                  <td className="p-3 font-mono text-[11px]">
                    {s.start_time.slice(0, 5)} — {s.end_time.slice(0, 5)}
                  </td>
                  <td className="p-3 text-muted">{s.grace_period_minutes} mins</td>
                  <td className="p-3 text-muted">Full: {s.min_full_day_hours}h | Half: {s.min_half_day_hours}h</td>
                  <td className="p-3">
                    {s.is_default ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Default
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
