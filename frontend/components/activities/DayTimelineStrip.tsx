'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Activity,
  TrendingUp,
  Flame,
  Check,
} from 'lucide-react';
import { DailyCalendarDaySummary, DailyActivity, DailyStatsSummary } from '@/types';

function formatToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayMetadata(dateString?: string) {
  let validStr = dateString;
  if (!validStr || typeof validStr !== 'string' || !validStr.includes('-')) {
    validStr = formatToYMD(new Date());
  }
  const parts = validStr.split('-').map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || (new Date().getMonth() + 1);
  const day = parts[2] || new Date().getDate();

  const dateObj = new Date(year, month - 1, day);
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const validDayIdx = isNaN(dateObj.getDay()) ? 0 : dateObj.getDay();
  const validMonthIdx = isNaN(dateObj.getMonth()) ? 0 : dateObj.getMonth();

  return {
    dayOfWeek: validDayIdx,
    dayName: dayNames[validDayIdx] || 'TODAY',
    fullDayName: fullDayNames[validDayIdx] || 'Today',
    dayNumber: isNaN(dateObj.getDate()) ? day : dateObj.getDate(),
    monthIndex: validMonthIdx,
    monthName: monthNames[validMonthIdx] || 'Aug',
    fullMonthName: fullMonthNames[validMonthIdx] || 'August',
    year: isNaN(dateObj.getFullYear()) ? year : dateObj.getFullYear(),
    formatted: validStr,
  };
}

interface DayTimelineStripProps {
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  calendarOverview?: DailyCalendarDaySummary[];
  dailySummary?: DailyStatsSummary;
  tasks?: DailyActivity[];
}

export default function DayTimelineStrip({
  selectedDate,
  onSelectDate,
  calendarOverview = [],
  dailySummary,
  tasks = [],
}: DayTimelineStripProps) {
  const todayStr = useMemo(() => formatToYMD(new Date()), []);

  // View Mode: 'strip' (Line Strip - default across CRM) or 'calendar' (Month Grid)
  const [viewMode, setViewMode] = useState<'calendar' | 'strip'>('strip');

  // Month currently in view
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  // Sync currentMonthDate when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number);
      setCurrentMonthDate((prev) => {
        if (prev.getFullYear() !== y || prev.getMonth() !== m - 1) {
          return new Date(y, m - 1, 1);
        }
        return prev;
      });
    }
  }, [selectedDate]);

  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(todayStr);
  };

  const overviewMap = useMemo(() => {
    const map = new Map<string, DailyCalendarDaySummary>();
    for (const item of calendarOverview) {
      map.set(item.scheduled_date, item);
    }
    return map;
  }, [calendarOverview]);

  const getDaySummary = (dateStr: string) => {
    return overviewMap.get(dateStr) || {
      scheduled_date: dateStr,
      total_count: 0,
      completed_count: 0,
      pending_count: 0,
    };
  };

  // ── Month Calendar Grid Calculation ──────────────────────────────────────────
  const monthData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const calendarCells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    // 1. Prev month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dNum);
      const dStr = formatToYMD(d);
      calendarCells.push({
        dateStr: dStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
      });
    }

    // 2. Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dStr = formatToYMD(d);
      calendarCells.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
      });
    }

    // 3. Next month leading days to complete grid
    const remainingCells = 7 - (calendarCells.length % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        const d = new Date(year, month + 1, i);
        const dStr = formatToYMD(d);
        calendarCells.push({
          dateStr: dStr,
          dayNumber: i,
          isCurrentMonth: false,
          isToday: dStr === todayStr,
          isSelected: dStr === selectedDate,
        });
      }
    }

    const monthNamesFull = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return {
      year,
      monthName: monthNamesFull[month],
      cells: calendarCells,
    };
  }, [currentMonthDate, todayStr, selectedDate]);

  // Strip View Timeline (Centered around selected date)
  const timelineDays = useMemo(() => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    return [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + offset);
      const dStr = formatToYMD(d);
      return {
        offset,
        ...getDayMetadata(dStr),
        isToday: dStr === todayStr,
        isSelected: dStr === selectedDate,
      };
    });
  }, [todayStr, selectedDate]);

  const selectedMeta = useMemo(() => {
    return getDayMetadata(selectedDate || todayStr);
  }, [selectedDate, todayStr]);

  const isSelectedToday = selectedDate === todayStr;

  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // Selected Day KPI Stats
  const stats = dailySummary || {
    total: safeTasks.length,
    pending: safeTasks.filter((t) => ['ASSIGNED', 'pending', 'PENDING'].includes(t.status)).length,
    in_progress: safeTasks.filter((t) => ['IN_PROGRESS', 'in_progress'].includes(t.status)).length,
    completed: safeTasks.filter((t) => ['COMPLETED', 'completed', 'LATE'].includes(t.status)).length,
    blocked: safeTasks.filter((t) => ['BLOCKED', 'INCOMPLETE'].includes(t.status)).length,
    late: safeTasks.filter((t) => t.status === 'LATE').length,
    completion_rate:
      safeTasks.length > 0
        ? Math.round(
            (safeTasks.filter((t) => ['COMPLETED', 'LATE'].includes(t.status)).length / safeTasks.length) * 100
          )
        : 0,
    total_estimated_hours: Number(
      (
        safeTasks.reduce((sum, t) => sum + (parseFloat(String(t?.estimated_hours || 0)) || 0), 0) || 0
      ).toFixed(1)
    ),
    total_actual_hours: Number(
      (
        safeTasks.reduce((sum, t) => sum + (parseFloat(String(t?.actual_hours || 0)) || 0), 0) || 0
      ).toFixed(1)
    ),
  };

  return (
    <div className="card p-3.5 bg-white border border-border/80 rounded-2xl shadow-xs">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        {/* Title & Selected Day Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber/15 text-amber-700 flex items-center justify-center font-bold shadow-xs">
            <Calendar size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-navy uppercase tracking-wider leading-none">
                Timeline Focus
              </h3>
              {isSelectedToday && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  Today
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted font-medium mt-0.5">
              {selectedMeta.fullDayName}, {selectedMeta.dayNumber} {selectedMeta.fullMonthName} {selectedMeta.year}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month Navigator */}
          <div className="flex items-center bg-surface border border-border rounded-xl p-0.5 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 hover:bg-white hover:text-navy text-muted rounded-lg transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[11px] font-bold text-navy px-2 min-w-[95px] text-center select-none">
              {monthData.monthName} {monthData.year}
            </span>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 hover:bg-white hover:text-navy text-muted rounded-lg transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* View Switcher: Line (Week) / Month */}
          <div className="flex items-center bg-surface border border-border rounded-xl p-0.5 shadow-2xs">
            <button
              onClick={() => setViewMode('strip')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'strip'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-muted hover:text-navy'
              }`}
              title="Line View (7-Day Strip - Default across CRM)"
            >
              <SlidersHorizontal size={12} />
              <span>Line (Week)</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-muted hover:text-navy'
              }`}
              title="Month Calendar Grid View"
            >
              <CalendarDays size={12} />
              <span>Month</span>
            </button>
          </div>

          {/* Today Button */}
          <button
            onClick={handleJumpToToday}
            className={`btn text-[11px] py-1 px-3 rounded-xl font-bold transition-all ${
              isSelectedToday
                ? 'bg-amber text-navy font-black shadow-xs'
                : 'btn-secondary text-navy hover:bg-amber-50'
            }`}
          >
            Today
          </button>
        </div>
      </div>

      {/* ── Main Dual-Panel Content: Calendar on Left, KPI Boxes on Right ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 pt-3 items-stretch">
        {/* Left Column: Interactive Calendar or Strip (7 cols on lg, 7 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center">
          {viewMode === 'calendar' ? (
            <div className="animate-fade-in-fast">
              {/* Weekday Row */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, idx) => (
                  <div
                    key={d}
                    className={`text-[9px] font-black uppercase py-0.5 tracking-wider ${
                      idx === 0 || idx === 6 ? 'text-amber-700/80' : 'text-slate-500'
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* 7-Column Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {monthData.cells.map((cell) => {
                  const summary = getDaySummary(cell.dateStr);
                  const hasTasks = summary.total_count > 0;
                  const isAllDone = hasTasks && summary.completed_count === summary.total_count;

                  return (
                    <button
                      key={cell.dateStr}
                      onClick={() => onSelectDate(cell.dateStr)}
                      className={`relative flex flex-col justify-between p-1.5 min-h-[46px] rounded-xl border transition-all duration-200 ease-out text-left cursor-pointer active:scale-95 ${
                        cell.isSelected
                          ? 'bg-navy text-white border-navy shadow-md shadow-navy/25 ring-2 ring-amber/70 font-bold scale-[1.03] z-10'
                          : cell.isToday
                          ? 'bg-amber-500/10 text-navy border-amber-400 font-bold hover:bg-amber-500/15 hover:scale-[1.03] hover:shadow-xs'
                          : cell.isCurrentMonth
                          ? 'bg-white text-slate-800 border-slate-200/80 hover:bg-slate-50 hover:border-amber-400/60 hover:scale-[1.03] hover:shadow-xs'
                          : 'bg-surface/20 text-muted/30 border-transparent hover:text-navy hover:scale-[1.01]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-[11px] font-black leading-none ${
                            cell.isSelected
                              ? 'text-white'
                              : cell.isToday
                              ? 'text-amber-700'
                              : cell.isCurrentMonth
                              ? 'text-navy'
                              : 'text-muted/40'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {cell.isToday && (
                          <span
                            className={`w-2 h-2 rounded-full ring-2 ring-white ${
                              cell.isSelected ? 'bg-amber shadow-xs' : 'bg-amber-500 pulse-amber'
                            }`}
                          />
                        )}
                      </div>

                      <div className="mt-1 flex items-center justify-between w-full">
                        {hasTasks ? (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[8.5px] font-black tracking-tight ${
                              cell.isSelected
                                ? 'bg-amber text-navy shadow-2xs'
                                : isAllDone
                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}
                          >
                            {summary.completed_count}/{summary.total_count}
                          </span>
                        ) : (
                          <span className="text-[8px] text-muted/30 leading-none">0</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Strip View */
            <div className="py-2 animate-fade-in-fast">
              <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                {timelineDays.map((d) => {
                  const summary = getDaySummary(d.formatted);
                  const hasTasks = summary.total_count > 0;
                  const isAllDone = hasTasks && summary.completed_count === summary.total_count;

                  return (
                    <button
                      key={d.formatted}
                      onClick={() => onSelectDate(d.formatted)}
                      className={`flex flex-col items-center justify-between p-2 min-h-[66px] rounded-xl transition-all duration-200 ease-out border cursor-pointer active:scale-95 ${
                        d.isSelected
                          ? 'bg-navy text-white border-navy shadow-md shadow-navy/25 ring-2 ring-amber/70 font-bold scale-[1.04] z-10'
                          : d.isToday
                          ? 'bg-amber-500/10 text-navy border-amber-400/80 hover:bg-amber-500/15 hover:scale-[1.02] font-bold shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:border-amber-400/60 hover:scale-[1.02] hover:shadow-xs'
                      }`}
                    >
                      <span
                        className={`text-[9px] font-black uppercase ${
                          d.isSelected ? 'text-amber-300' : d.isToday ? 'text-amber-700' : 'text-muted'
                        }`}
                      >
                        {d.isToday ? 'TODAY' : d.dayName}
                      </span>
                      <span
                        className={`text-sm font-black my-0.5 ${
                          d.isSelected ? 'text-white' : 'text-navy'
                        }`}
                      >
                        {d.dayNumber}
                      </span>
                      {hasTasks ? (
                        <span
                          className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-md ${
                            d.isSelected
                              ? 'bg-amber text-navy'
                              : isAllDone
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {summary.completed_count}/{summary.total_count}
                        </span>
                      ) : (
                        <span className="text-[8px] text-muted/40">0</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Day Insights & 6 KPI Metric Cards (5 cols on lg, 5 cols on xl) */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between gap-2.5 bg-surface/30 p-2.5 rounded-xl border border-border/60">
          {/* Day Status Header & Progress Bar */}
          <div className="bg-navy text-white p-2.5 rounded-xl border border-navy shadow-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
                {selectedMeta.dayName}, {selectedMeta.dayNumber} {selectedMeta.monthName} Performance
              </span>
              <span className="font-extrabold text-amber-300 bg-white/10 px-2 py-0.5 rounded-md text-[10px]">
                {stats.completion_rate}% Done
              </span>
            </div>
            {/* Completion Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, stats.completion_rate))}%` }}
              />
            </div>
          </div>

          {/* 6 Metric Cards in a balanced 2-column grid */}
          <div className="grid grid-cols-2 gap-2 flex-1">
            {/* 1. Total Tasks */}
            <div className="card p-2.5 bg-white border border-border/80 rounded-xl flex items-center justify-between shadow-2xs hover:border-navy/30 transition-colors">
              <div>
                <span className="text-[9px] uppercase font-bold text-muted block leading-none">
                  Total Tasks
                </span>
                <div className="text-lg font-black text-navy leading-none mt-1.5">{stats.total}</div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-navy/10 text-navy flex items-center justify-center font-bold">
                <Calendar size={14} />
              </div>
            </div>

            {/* 2. Pending */}
            <div className="card p-2.5 bg-white border border-border/80 rounded-xl flex items-center justify-between shadow-2xs hover:border-blue-300 transition-colors">
              <div>
                <span className="text-[9px] uppercase font-bold text-blue-600 block leading-none">
                  Pending
                </span>
                <div className="text-lg font-black text-blue-700 leading-none mt-1.5">{stats.pending}</div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Clock size={14} />
              </div>
            </div>

            {/* 3. In Progress */}
            <div className="card p-2.5 bg-white border border-border/80 rounded-xl flex items-center justify-between shadow-2xs hover:border-purple-300 transition-colors">
              <div>
                <span className="text-[9px] uppercase font-bold text-purple-600 block leading-none">
                  In Progress
                </span>
                <div className="text-lg font-black text-purple-700 leading-none mt-1.5">{stats.in_progress}</div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Activity size={14} />
              </div>
            </div>

            {/* 4. Completed */}
            <div className="card p-2.5 bg-white border border-border/80 rounded-xl flex items-center justify-between shadow-2xs hover:border-teal-300 transition-colors">
              <div>
                <span className="text-[9px] uppercase font-bold text-teal-600 block leading-none">
                  Completed
                </span>
                <div className="text-lg font-black text-teal-700 leading-none mt-1.5">{stats.completed}</div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <CheckCircle2 size={14} />
              </div>
            </div>

            {/* 5. Execution % */}
            <div className="card p-2.5 bg-white border border-border/80 rounded-xl flex items-center justify-between shadow-2xs hover:border-amber-300 transition-colors">
              <div>
                <span className="text-[9px] uppercase font-bold text-amber-600 block leading-none">
                  Execution %
                </span>
                <div className="text-lg font-black text-amber-700 leading-none mt-1.5">
                  {stats.completion_rate}%
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <TrendingUp size={14} />
              </div>
            </div>

            {/* 6. Hours Logged */}
            <div className="card p-2.5 bg-white border border-border/80 rounded-xl flex items-center justify-between shadow-2xs hover:border-slate-300 transition-colors">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-600 block leading-none">
                  Hours Logged
                </span>
                <div className="text-base font-black text-navy leading-none mt-1.5">
                  {stats.total_actual_hours}{' '}
                  <span className="text-[10px] text-muted font-medium">/{stats.total_estimated_hours}h</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-surface text-slate-700 flex items-center justify-center font-bold">
                <Clock size={14} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
