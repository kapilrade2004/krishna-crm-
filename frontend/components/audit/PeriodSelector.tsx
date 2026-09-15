'use client';

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AuditPeriod = 'weekly' | 'monthly' | 'total';

interface PeriodSelectorProps {
  period: AuditPeriod;
  onPeriodChange: (p: AuditPeriod) => void;
  dateLabel?: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}

export default function PeriodSelector({
  period,
  onPeriodChange,
  dateLabel,
  onNavigatePrev,
  onNavigateNext,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-border/80 rounded-2xl p-3 shadow-xs mb-6 transition-all">
      {/* Period Tabs */}
      <div className="flex items-center bg-slate-50/80 p-1 rounded-xl w-full sm:w-auto border border-border/70 shadow-2xs">
        {(['weekly', 'monthly', 'total'] as AuditPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
            className={cn(
              'flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ease-out uppercase tracking-wider cursor-pointer active:scale-95',
              period === p
                ? 'bg-amber text-navy shadow-xs font-bold scale-[1.02]'
                : 'text-muted hover:text-navy hover:bg-white/60'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Date Range Navigation */}
      {period !== 'total' && (
        <div className="flex items-center gap-2 text-xs font-medium text-navy">
          {onNavigatePrev && (
            <button
              type="button"
              onClick={onNavigatePrev}
              className="p-1.5 rounded-xl hover:bg-slate-50 text-muted hover:text-navy transition-all duration-200 ease-out hover:scale-105 active:scale-95 border border-border/80 cursor-pointer shadow-2xs"
              title="Previous Period"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50/80 rounded-xl border border-border/70 text-navy font-semibold shadow-2xs">
            <Calendar size={14} className="text-amber" />
            <span>{dateLabel || (period === 'weekly' ? 'Current Week' : 'Current Month')}</span>
          </div>

          {onNavigateNext && (
            <button
              type="button"
              onClick={onNavigateNext}
              className="p-1.5 rounded-xl hover:bg-slate-50 text-muted hover:text-navy transition-all duration-200 ease-out hover:scale-105 active:scale-95 border border-border/80 cursor-pointer shadow-2xs"
              title="Next Period"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
