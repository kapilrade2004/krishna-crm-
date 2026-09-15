'use client';

import React from 'react';
import {
  Award,
  TrendingUp,
  Flame,
  CheckCircle2,
  Clock,
  Calendar,
  Tag,
  Check,
  FileText,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useDailyActivityScorecard } from '@/hooks/useApi';
import { Spinner, EmptyState, Badge } from '@/components/ui';
import { DailyActivity } from '@/types';

export default function DailyScorecardView() {
  const { user } = useAuthStore();
  const { data: scorecard, isLoading } = useDailyActivityScorecard();

  if (isLoading && !scorecard) {
    return (
      <div className="py-24 flex justify-center items-center">
        <Spinner />
      </div>
    );
  }

  const {
    myTotalTasks = 0,
    myCompletedTasks = 0,
    overallCompletionRate = 0,
    today = { total: 0, completed: 0, in_progress: 0, pending: 0, blocked: 0, completionRate: 0 },
    completedTasks = [],
  } = scorecard || {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="card p-5 bg-gradient-to-r from-navy to-slate text-white rounded-2xl border-none shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Award size={14} /> Productivity & Accomplishments Scorecard
            </div>
            <h2 className="text-xl font-extrabold text-white">
              {user?.name}&apos;s Performance Track Record
            </h2>
            <p className="text-xs text-white/70 mt-1 max-w-xl">
              Lifetime operational efficiency metrics and verified completed deliverables archive.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15 text-center min-w-[100px]">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Lifetime Rate</span>
              <span className="text-xl font-extrabold text-amber-400">{overallCompletionRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Completed */}
        <div className="card p-4.5 bg-white border border-border flex items-center justify-between shadow-xs hover:border-teal-400/50 transition-all">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Total Deliverables Done
            </span>
            <div className="text-2xl font-black text-navy">{myCompletedTasks}</div>
            <span className="text-xs text-teal-600 font-bold flex items-center gap-1 mt-1">
              <Check size={13} /> Lifetime Finished Tasks
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            <Award size={24} />
          </div>
        </div>

        {/* Completion Efficiency */}
        <div className="card p-4.5 bg-white border border-border flex items-center justify-between shadow-xs hover:border-amber-400/50 transition-all">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Completion Efficiency
            </span>
            <div className="text-2xl font-black text-navy">{overallCompletionRate}%</div>
            <span className="text-xs text-amber-700 font-bold flex items-center gap-1 mt-1">
              <TrendingUp size={13} /> {myCompletedTasks} of {myTotalTasks} assigned tasks
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Today's Execution */}
        <div className="card p-4.5 bg-white border border-border flex items-center justify-between shadow-xs hover:border-purple-400/50 transition-all">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Today&apos;s Execution Rate
            </span>
            <div className="text-2xl font-black text-navy">{today.completionRate || 0}%</div>
            <span className="text-xs text-purple-700 font-bold flex items-center gap-1 mt-1">
              <Flame size={13} /> {today.completed || 0} of {today.total || 0} tasks done today
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Flame size={24} />
          </div>
        </div>
      </div>

      {/* Completed Deliverables Archive */}
      <div className="card p-5 bg-white shadow-xs border border-border">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
              <CheckCircle2 size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy">
                Completed Deliverables Archive
              </h3>
              <p className="text-xs text-muted">
                Detailed record of all completed operational deliverables and outcomes
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-surface border border-border text-navy">
            {completedTasks.length} archived
          </span>
        </div>

        {completedTasks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={42} className="text-muted/40" />}
            title="No Completed Tasks Yet"
            description="Tasks marked as completed in your daily workspace will be archived here."
          />
        ) : (
          <div className="space-y-3">
            {completedTasks.map((t: DailyActivity) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl bg-surface/50 border border-border hover:border-teal-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-extrabold text-navy">{t.title}</h4>
                      {t.category && (
                        <span className="px-1.5 py-0.2 rounded bg-white border border-border font-mono text-[9px] text-muted">
                          {t.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> Scheduled: <strong className="text-navy">{t.scheduled_date || 'Today'}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> Est: {t.estimated_hours || 1.0}h | Logged: <strong className="text-teal-700 font-bold">{t.actual_hours || 0}h</strong>
                      </span>
                    </div>

                    {t.completion_notes && (
                      <p className="text-[11px] text-slate-700 bg-white/80 p-2 rounded-md border border-border/70 mt-2 italic">
                        &ldquo;{t.completion_notes}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-2 self-end sm:self-center">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    Finished
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
