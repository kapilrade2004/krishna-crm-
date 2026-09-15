'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

interface DailyBreakdownItem {
  date: string;
  attendance: string;
  customer_activity?: number;
  orders?: number;
  revenue?: number;
  tasks?: number;
  jobs_assigned?: number;
  jobs_completed?: number;
  installations?: number;
  repairs?: number;
}

interface DailyBreakdownTableProps {
  breakdown: DailyBreakdownItem[];
  template: 'sales_executive' | 'technician';
}

export default function DailyBreakdownTable({ breakdown, template }: DailyBreakdownTableProps) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="text-amber" size={18} />
          <h3 className="text-sm font-bold text-navy">Daily Activity Breakdown</h3>
        </div>
        <span className="text-xs text-muted">{breakdown.length} Records</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface text-muted uppercase tracking-wider font-semibold border-b border-border">
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3">Attendance</th>
              {template === 'technician' ? (
                <>
                  <th className="py-2.5 px-3 text-right">Jobs Assigned</th>
                  <th className="py-2.5 px-3 text-right">Completed</th>
                  <th className="py-2.5 px-3 text-right">Installations</th>
                  <th className="py-2.5 px-3 text-right">Repairs</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-3 text-right">Customer Activity</th>
                  <th className="py-2.5 px-3 text-right">Orders</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Tasks Done</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-navy">
            {breakdown.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  No activity recorded for this period.
                </td>
              </tr>
            ) : (
              breakdown.map((row) => (
                <tr key={row.date} className="hover:bg-surface transition-colors">
                  <td className="py-2.5 px-3 font-medium font-mono text-navy">
                    {new Date(row.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        row.attendance === 'Present'
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.attendance === 'Holiday'
                          ? 'bg-gray-100 text-muted'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {row.attendance}
                    </span>
                  </td>

                  {template === 'technician' ? (
                    <>
                      <td className="py-2.5 px-3 text-right font-semibold">{row.jobs_assigned || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                        {row.jobs_completed || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.installations || '—'}</td>
                      <td className="py-2.5 px-3 text-right">{row.repairs || '—'}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-3 text-right font-semibold">{row.customer_activity || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-navy">{row.orders || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                        {row.revenue ? `₹${row.revenue.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.tasks || '—'}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
