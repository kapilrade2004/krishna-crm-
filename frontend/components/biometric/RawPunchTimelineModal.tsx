'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '@/components/ui';
import { Clock, Fingerprint, ShieldCheck, Thermometer, Cpu, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { BiometricPunchEvent, AttendanceDay } from '@/types';

interface RawPunchTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceDay: AttendanceDay | null;
}

export default function RawPunchTimelineModal({
  isOpen,
  onClose,
  attendanceDay,
}: RawPunchTimelineModalProps) {
  const [punches, setPunches] = useState<BiometricPunchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && attendanceDay) {
      setLoading(true);
      api
        .get('/biometric/raw-punches', {
          params: {
            employee_id: attendanceDay.employee_id,
            date: attendanceDay.date,
          },
        })
        .then((res) => {
          setPunches(res.data?.data?.punches || []);
        })
        .catch(() => {
          toast.error('Failed to load raw punch logs');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, attendanceDay]);

  if (!attendanceDay) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Raw Biometric Punch Timeline & Traceability" size="md">
      <div className="space-y-4 text-xs">
        {/* Header Summary */}
        <div className="bg-surface/60 p-3.5 rounded-xl border border-border flex items-center justify-between">
          <div>
            <p className="font-bold text-navy text-sm">{attendanceDay.employee_name || 'Staff Member'}</p>
            <p className="text-[11px] text-muted font-mono">
              Date: {attendanceDay.date} • Code: {attendanceDay.employee_code || '—'}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                attendanceDay.status === 'PRESENT'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : attendanceDay.status === 'LATE'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : attendanceDay.status === 'INCOMPLETE'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Status: {attendanceDay.status}
            </span>
            <p className="text-[10px] text-muted mt-1 font-mono">Total: {attendanceDay.work_hours} hrs</p>
          </div>
        </div>

        {/* Calculated vs Raw Notice */}
        <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-indigo-900">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Raw punches below are cryptographically deduplicated (SHA-256) and ingested directly from the BioMax terminal via SmartOffice API.
          </p>
        </div>

        {/* Punches Timeline */}
        {loading ? (
          <div className="p-8 text-center text-muted">Loading punch events...</div>
        ) : punches.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-border rounded-xl space-y-1">
            <AlertCircle className="w-6 h-6 text-muted mx-auto" />
            <p className="font-semibold text-navy">No Raw Punches Recorded</p>
            <p className="text-muted text-[11px]">No biometric or manual punches found for this date.</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {punches.map((p, idx) => {
              const pDate = new Date(p.punch_timestamp);
              const timeStr = pDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const isIN = p.punch_direction === 'IN';

              return (
                <div key={p.id || idx} className="relative flex items-center justify-between p-2.5 bg-white border border-border rounded-lg shadow-sm hover:border-navy/30 transition-colors">
                  <div
                    className={`absolute -left-[27px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                      isIN ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  />
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${
                        isIN ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {isIN ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div>
                      <p className="font-bold text-navy text-xs flex items-center gap-1.5">
                        {p.punch_direction} <span className="font-mono text-slate-600">({timeStr})</span>
                      </p>
                      <p className="text-[10px] text-muted flex items-center gap-1">
                        <Cpu size={11} /> {p.device_serial_number || 'Terminal'} • Source: {p.source}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {p.temperature && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-600 bg-surface px-1.5 py-0.5 rounded border border-border">
                        <Thermometer size={10} className="text-amber-600" /> {p.temperature}°F
                      </span>
                    )}
                    <p className="text-[9px] font-mono text-muted mt-0.5">{p.processing_status}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
