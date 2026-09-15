'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Edit3, RotateCcw, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { useDateTimeStore } from '@/lib/dateTimeStore';
import { Modal, Button } from '@/components/ui';
import { format, parseISO } from 'date-fns';

export default function TopBarDateTime() {
  const { isCustom, customDate, customTime, setCustomDateTime, resetToLive } = useDateTimeStore();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state inside modal
  const [inputDate, setInputDate] = useState('');
  const [inputTime, setInputTime] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tick live time every second when not in custom mode
  useEffect(() => {
    if (!mounted || isCustom) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [mounted, isCustom]);

  // Sync modal inputs whenever modal opens or values change
  const handleOpenModal = () => {
    if (isCustom && customDate && customTime) {
      setInputDate(customDate);
      setInputTime(customTime);
    } else {
      const currentDate = new Date();
      setInputDate(format(currentDate, 'yyyy-MM-dd'));
      setInputTime(format(currentDate, 'HH:mm:ss'));
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!inputDate || !inputTime) return;
    setCustomDateTime(inputDate, inputTime);
    setIsModalOpen(false);
  };

  const handleReset = () => {
    resetToLive();
    setIsModalOpen(false);
  };

  // Quick preset helpers
  const applyPresetNow = () => {
    const cur = new Date();
    setInputDate(format(cur, 'yyyy-MM-dd'));
    setInputTime(format(cur, 'HH:mm:ss'));
  };

  const applyPresetCutoff = () => {
    const cur = new Date();
    setInputDate(format(cur, 'yyyy-MM-dd'));
    setInputTime('13:20:00');
  };

  const applyPresetShiftStart = () => {
    const cur = new Date();
    setInputDate(format(cur, 'yyyy-MM-dd'));
    setInputTime('09:00:00');
  };

  const applyPresetYesterday = () => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    setInputDate(format(yest, 'yyyy-MM-dd'));
    setInputTime(format(yest, 'HH:mm:ss'));
  };

  // Format display string
  let displayDateStr = '';
  let displayTimeStr = '';

  if (mounted) {
    if (isCustom && customDate && customTime) {
      try {
        const parsed = parseISO(`${customDate}T${customTime}`);
        displayDateStr = format(parsed, 'EEE, dd MMM yyyy');
        displayTimeStr = format(parsed, 'hh:mm:ss a');
      } catch {
        displayDateStr = customDate;
        displayTimeStr = customTime;
      }
    } else {
      displayDateStr = format(now, 'EEE, dd MMM yyyy');
      displayTimeStr = format(now, 'hh:mm:ss a');
    }
  }

  return (
    <>
      {/* Date Pill */}
      <button
        type="button"
        onClick={handleOpenModal}
        className="flex items-center gap-2 px-3 py-1.5 h-8 sm:h-9 rounded-xl border border-slate-200/90 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-amber/70 hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer shrink-0 group"
        title="Operational Date"
      >
        <Calendar size={13} className="text-amber group-hover:scale-110 transition-transform duration-200 shrink-0" />
        <span className="text-[11.5px] font-semibold text-slate-700 group-hover:text-navy transition-colors">
          {mounted ? displayDateStr : 'Thu, 10 Sep 2026'}
        </span>
      </button>

      {/* Time Pill */}
      <button
        type="button"
        onClick={handleOpenModal}
        className="flex items-center gap-1.5 px-3 py-1.5 h-8 sm:h-9 rounded-xl border border-slate-200/90 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-amber/70 hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer shrink-0 group"
        title="Operational Time"
      >
        <span className="font-mono text-[11.5px] font-semibold text-slate-700 group-hover:text-navy transition-colors">
          {mounted ? displayTimeStr : '12:43:09 PM'}
        </span>
        <ChevronDown size={12} className="text-slate-400 group-hover:text-amber transition-colors ml-0.5" />
      </button>

      {/* Edit Date & Time Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Edit System Date & Time"
        subtitle="Manage and simulate the active operational date & time for all CRM desks"
        size="md"
      >
        <div className="space-y-4 pt-1">
          {/* Active status banner */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
              isCustom
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <span className={`w-2 h-2 rounded-full ${isCustom ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>
                {isCustom
                  ? 'Custom Date & Time Override is currently active.'
                  : 'Live Real-Time Clock is currently active.'}
              </span>
            </div>
            {isCustom && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-bold text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} /> Reset to Live
              </button>
            )}
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-navy mb-1.5">Operational Date</label>
              <input
                type="date"
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium border border-border rounded-xl bg-white text-navy focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition-all cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-navy mb-1.5">Operational Time</label>
              <input
                type="time"
                step="1"
                value={inputTime}
                onChange={(e) => setInputTime(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium border border-border rounded-xl bg-white text-navy font-mono focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Quick Shortcuts
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={applyPresetNow}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-navy transition-all cursor-pointer"
              >
                Now (Current Time)
              </button>
              <button
                type="button"
                onClick={applyPresetShiftStart}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-navy transition-all cursor-pointer"
              >
                09:00 AM (Shift Start)
              </button>
              <button
                type="button"
                onClick={applyPresetCutoff}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all cursor-pointer"
              >
                01:20 PM (OMS Cutoff)
              </button>
              <button
                type="button"
                onClick={applyPresetYesterday}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-navy transition-all cursor-pointer"
              >
                Yesterday
              </button>
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
            <div>
              {isCustom ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  icon={<RotateCcw size={12} />}
                  className="text-xs text-red-600 hover:bg-red-50 border-red-200"
                >
                  Reset to Live Clock
                </Button>
              ) : (
                <span className="text-[11px] text-muted">Clock auto-ticks in real-time</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSave}
                icon={<Check size={13} />}
                className="font-bold shadow-xs"
              >
                Apply Date &amp; Time
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
