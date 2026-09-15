'use client';
import { useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { useTaskScoreDashboard, useUnscoredTasks } from '@/hooks/useApi';
import { Badge, PageLoader, EmptyState, KpiCard } from '@/components/ui';
import { fmtDate } from '@/lib/utils';
import TaskWorkspaceHeader from '@/components/tasks/TaskWorkspaceHeader';
import {
  ArrowLeft, Star, TrendingUp, Users, ClipboardCheck,
  Award, AlertCircle, Crown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';

const BUCKET_COLOURS: Record<string, string> = {
  '0-2 (Poor)':      '#E24B4A',
  '3-5 (Average)':   '#E8A020',
  '6-8 (Good)':       '#378ADD',
  '9-10 (Excellent)': '#1A8F7A',
};

export default function TaskScoreDashboardPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = useTaskScoreDashboard(
    fromDate && toDate ? { from_date: fromDate, to_date: toDate } : {}
  );
  const { data: unscoredData } = useUnscoredTasks({ limit: 10 });

  const unscoredTasks = unscoredData?.data || [];

  const scoreColour = (s: number | null) => {
    if (s === null) return 'text-muted';
    if (s >= 8) return 'text-teal-600';
    if (s >= 5) return 'text-amber-600';
    return 'text-danger';
  };

  const scoreBg = (s: number | null) => {
    if (s === null) return 'bg-gray-50';
    if (s >= 8) return 'bg-teal-50';
    if (s >= 5) return 'bg-amber-50';
    return 'bg-red-50';
  };

  return (
    <AppShell>
      <Topbar title="Task Score Dashboard" subtitle="Manager scoring overview — SOW §3.7 Task Score Management" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
        <TaskWorkspaceHeader showKpis={false} />

        {/* Date filter */}
        <div className="card">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-0">
              <label className="form-label">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input" />
            </div>
            <div className="flex flex-col gap-0">
              <label className="form-label">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input" />
            </div>
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-xs text-muted hover:text-navy">
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {isLoading || !data ? (
          <PageLoader />
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Overall Avg Score"
                value={data.summary.overall_avg_score !== null ? `${data.summary.overall_avg_score}/10` : '—'}
                icon={<Star size={16} />}
              />
              <KpiCard label="Total Scored Tasks" value={data.summary.total_scored} icon={<ClipboardCheck size={16} />} />
              <KpiCard
                label="Pending Score"
                value={data.summary.pending_score_count}
                icon={<AlertCircle size={16} />}
                sub={data.summary.pending_score_count > 0 ? 'Tasks done, not yet scored' : undefined}
              />
              <KpiCard label="Team Members Scored" value={data.scoreTable.length} icon={<Users size={16} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Score distribution chart */}
              <div className="card lg:col-span-1">
                <div className="card-header"><p className="card-title">Score Distribution</p></div>
                {data.distribution.length === 0 ? (
                  <p className="text-sm text-muted text-center py-12">No scores recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.distribution}
                        dataKey="count"
                        nameKey="bucket"
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={75}
                        paddingAngle={2}
                      >
                        {data.distribution.map((d: any, i: number) => (
                          <Cell key={i} fill={BUCKET_COLOURS[d.bucket] || '#999'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                      <Legend verticalAlign="bottom" height={50} iconSize={8} formatter={(v) => <span className="text-[11px]">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Leaderboard bar chart */}
              <div className="card lg:col-span-2">
                <div className="card-header">
                  <p className="card-title flex items-center gap-1.5"><Crown size={14} className="text-amber-500" /> Team Score Leaderboard</p>
                </div>
                {data.scoreTable.length === 0 ? (
                  <p className="text-sm text-muted text-center py-12">No scored tasks yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.scoreTable} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 12, fill: '#6B7A8F' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#6B7A8F' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: any) => [`${v}/10`, 'Avg Score']}
                        contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E2E8F0' }}
                      />
                      <Bar dataKey="avg_score" radius={[0, 4, 4, 0]}>
                        {data.scoreTable.map((entry: any, i: number) => (
                          <Cell key={i} fill={
                            entry.avg_score === null ? '#CBD5E1' :
                            entry.avg_score >= 8 ? '#1A8F7A' :
                            entry.avg_score >= 5 ? '#E8A020' : '#E24B4A'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Score Table — per SOW §3.7 requirement */}
            <div className="card p-0 overflow-hidden">
              <div className="card-header px-4 pt-4">
                <p className="card-title flex items-center gap-1.5"><Award size={14} /> Score Table — Per Team Member</p>
              </div>
              {data.scoreTable.length === 0 ? (
                <EmptyState icon={<Star size={36} />} title="No scored tasks yet" description="Scores will appear here once managers start scoring completed tasks." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Team Member</th>
                        <th>Role</th>
                        <th>Total Tasks</th>
                        <th>Completed</th>
                        <th>Scored</th>
                        <th>Pending Score</th>
                        <th>Avg Score</th>
                        <th>Min / Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.scoreTable.map((row: any, i: number) => (
                        <tr key={row.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              {i === 0 && row.avg_score !== null && (
                                <Crown size={13} className="text-amber-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-navy">{row.name}</span>
                            </div>
                          </td>
                          <td className="text-xs text-muted capitalize">{row.role}</td>
                          <td>{row.total_tasks}</td>
                          <td className="text-teal-600 font-medium">{row.completed_tasks}</td>
                          <td>{row.scored_tasks}</td>
                          <td>
                            {row.pending_score_count > 0 ? (
                              <Badge label={String(row.pending_score_count)} colorClass="bg-amber-100 text-amber-700" />
                            ) : (
                              <span className="text-xs text-muted">0</span>
                            )}
                          </td>
                          <td>
                            <span className={`inline-flex items-center gap-1 font-semibold ${scoreColour(row.avg_score)} ${scoreBg(row.avg_score)} px-2 py-0.5 rounded-md`}>
                              <Star size={11} className="fill-current" />
                              {row.avg_score !== null ? `${row.avg_score}/10` : '—'}
                            </span>
                          </td>
                          <td className="text-xs text-muted">
                            {row.min_score !== null ? `${row.min_score} / ${row.max_score}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tasks awaiting score */}
            {unscoredTasks.length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="card-header px-4 pt-4">
                  <p className="card-title flex items-center gap-1.5 text-amber-700">
                    <AlertCircle size={14} /> Tasks Awaiting Score ({unscoredTasks.length})
                  </p>
                  <Link href="/tasks" className="text-xs text-amber-600 hover:underline">Go score them →</Link>
                </div>
                <div className="divide-y divide-border">
                  {unscoredTasks.map((t: Record<string, unknown>) => (
                    <div key={String(t.id)} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-navy">{String(t.title)}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {(t.assignedUser as Record<string, unknown> | undefined)?.name as string || '—'}
                          {t.completed_at ? ` · Completed ${fmtDate(String(t.completed_at))}` : ''}
                        </p>
                      </div>
                      <Link href="/tasks" className="text-xs text-amber-600 hover:underline whitespace-nowrap">
                        Score now →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
