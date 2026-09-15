'use client';

import React from 'react';
import { Target } from 'lucide-react';

interface PerformanceIndicatorsProps {
  indicators: {
    attendance_rate: number;
    attendance_target: number;
    customer_activity_rate: number;
    customer_activity_actual_pct: number;
    task_completion_rate: number;
    task_completion_target: number;
    sales_achievement_rate: number;
    sales_achievement_actual_pct: number;
  };
  template: 'sales_executive' | 'technician';
}

export default function PerformanceIndicators({ indicators, template }: PerformanceIndicatorsProps) {
  const items = [
    {
      label: 'Attendance Rate',
      actual: indicators.attendance_rate,
      target: indicators.attendance_target,
      visualPct: Math.min(100, indicators.attendance_rate),
      color: 'bg-emerald-500',
    },
    {
      label: template === 'technician' ? 'Job Completion Rate' : 'Task Completion',
      actual: indicators.task_completion_rate,
      target: indicators.task_completion_target,
      visualPct: Math.min(100, indicators.task_completion_rate),
      color: 'bg-blue-500',
    },
    {
      label: template === 'technician' ? 'Service Activity Level' : 'Customer Activity Target',
      actual: indicators.customer_activity_actual_pct,
      target: 100,
      visualPct: Math.min(100, indicators.customer_activity_rate),
      color: 'bg-amber',
    },
    {
      label: template === 'technician' ? 'Overall Efficiency' : 'Sales Achievement',
      actual: indicators.sales_achievement_actual_pct,
      target: 100,
      visualPct: Math.min(100, indicators.sales_achievement_rate),
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-xs mb-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <Target className="text-amber" size={18} />
        <h3 className="text-sm font-bold text-navy">Performance Target Indicators</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label} className="p-3.5 bg-surface rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-navy">{item.label}</span>
              <span className="font-bold text-navy">
                {item.actual}% {item.actual > 100 && <span className="text-emerald-600 font-extrabold text-[11px]">(Overachieved!)</span>}
              </span>
            </div>

            {/* Progress Bar (Capped at 100% visually) */}
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-500`}
                style={{ width: `${item.visualPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted">
              <span>Target: {item.target}%</span>
              <span>Visual Cap: 100%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
