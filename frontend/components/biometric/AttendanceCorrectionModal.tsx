'use strict';
'use client';

import React, { useState } from 'react';
import { Modal, Button, Input } from '@/components/ui';
import { Edit3, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { AttendanceDay } from '@/types';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceDay: AttendanceDay | null;
  onSuccess?: () => void;
}

export default function AttendanceCorrectionModal({
  isOpen,
  onClose,
  attendanceDay,
  onSuccess,
}: AttendanceCorrectionModalProps) {
  const [correctedIn, setCorrectedIn] = useState(attendanceDay?.clock_in || '10:00');
  const [correctedOut, setCorrectedOut] = useState(attendanceDay?.clock_out || '18:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!attendanceDay) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      return toast.error('Please provide a reason for the correction.');
    }

    setSaving(true);
    try {
      // 1. Submit correction request
      const res = await api.post('/hr/attendance/corrections', {
        employee_id: attendanceDay.employee_id,
        correction_date: attendanceDay.date,
        corrected_in: correctedIn ? `${correctedIn}:00`.slice(0, 8) : null,
        corrected_out: correctedOut ? `${correctedOut}:00`.slice(0, 8) : null,
        reason: reason.trim(),
      });

      const correctionId = res.data?.data?.correction?.id;
      if (correctionId) {
        // Direct auto-approve for HR / Admin
        await api.post(`/hr/attendance/corrections/${correctionId}/review`, {
          action: 'approved',
        });
      }

      toast.success('Attendance correction applied & recalculated successfully!');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit attendance correction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manual Attendance Correction" size="md">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Header Summary */}
        <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-xl space-y-1 text-amber-900">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-600" /> Correcting Attendance Record
          </p>
          <p className="text-[11px]">
            Employee: <strong>{attendanceDay.employee_name || 'Staff'}</strong> • Date: <strong>{attendanceDay.date}</strong>
          </p>
          <p className="text-[10px] text-amber-800">
            Original Record: In: <code>{attendanceDay.clock_in || '—'}</code> | Out: <code>{attendanceDay.clock_out || '—'}</code> | Status: <code>{attendanceDay.status}</code>
          </p>
        </div>

        {/* Correction Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-navy mb-1 flex items-center gap-1">
              <Clock size={12} className="text-emerald-600" /> Corrected Clock-In
            </label>
            <input
              type="time"
              value={correctedIn}
              onChange={(e) => setCorrectedIn(e.target.value)}
              className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </div>

          <div>
            <label className="block font-semibold text-navy mb-1 flex items-center gap-1">
              <Clock size={12} className="text-slate-600" /> Corrected Clock-Out
            </label>
            <input
              type="time"
              value={correctedOut}
              onChange={(e) => setCorrectedOut(e.target.value)}
              className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-navy mb-1">
            Reason for Correction *
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Employee forgot to punch OUT due to offsite client meeting; verified with manager."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full text-xs border border-border rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>

        <div className="p-2.5 bg-surface text-muted text-[10px] rounded-lg border border-border">
          🛡️ <strong>Audit Guarantee:</strong> This manual correction is logged in the permanent audit trail. Original raw biometric logs are never deleted or modified.
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={saving}
            icon={<CheckCircle size={13} />}
            className="bg-navy hover:bg-navy/90 text-white font-bold"
          >
            Apply Correction
          </Button>
        </div>
      </form>
    </Modal>
  );
}
