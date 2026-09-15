'use client';

import React from 'react';
import { FileText, Info } from 'lucide-react';

interface PerformanceSummaryProps {
  summary: string;
}

export default function PerformanceSummary({ summary }: PerformanceSummaryProps) {
  return (
    <div className="bg-amber/10 border border-amber/30 rounded-xl p-5 shadow-xs mb-6">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="text-amber-700" size={18} />
        <h3 className="text-sm font-bold text-navy uppercase tracking-wider">Performance Summary</h3>
      </div>
      <p className="text-xs text-navy font-medium leading-relaxed">
        {summary}
      </p>
      <div className="mt-3 pt-2 border-t border-amber/20 flex items-center gap-1.5 text-[10px] text-muted">
        <Info size={12} className="text-amber-700" />
        <span>Factual summary dynamically generated from verified CRM records and attendance activity.</span>
      </div>
    </div>
  );
}
