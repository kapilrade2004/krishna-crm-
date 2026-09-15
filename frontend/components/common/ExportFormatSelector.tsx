'use client';
import React from 'react';
import { FileSpreadsheet, FileText, FileCode, CheckCircle2 } from 'lucide-react';

export type ExportFormat = 'xlsx' | 'pdf' | 'csv';

interface ExportFormatSelectorProps {
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
  label?: string;
}

export const EXPORT_FORMAT_OPTIONS: {
  id: ExportFormat;
  title: string;
  extension: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  activeColor: string;
  borderColor: string;
  badgeColor: string;
}[] = [
  {
    id: 'xlsx',
    title: 'Excel Workbook',
    extension: '.xlsx',
    description: 'Formatted spreadsheet with full column layouts & auto-filters',
    badge: 'Recommended',
    icon: <FileSpreadsheet size={22} className="text-emerald-600" />,
    activeColor: 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20',
    borderColor: 'border-border hover:border-emerald-300',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    id: 'pdf',
    title: 'PDF Document',
    extension: '.pdf',
    description: 'Formatted printable report with Khrisha Enterprises header & timestamps',
    badge: 'Print & Share',
    icon: <FileText size={22} className="text-rose-600" />,
    activeColor: 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20',
    borderColor: 'border-border hover:border-rose-300',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    id: 'csv',
    title: 'CSV File',
    extension: '.csv',
    description: 'Universal raw comma-separated text compatible with all software',
    badge: 'Standard',
    icon: <FileCode size={22} className="text-blue-600" />,
    activeColor: 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20',
    borderColor: 'border-border hover:border-blue-300',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
];

export default function ExportFormatSelector({
  value,
  onChange,
  label = 'Select Export Format',
}: ExportFormatSelectorProps) {
  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-bold text-navy">{label}</label>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {EXPORT_FORMAT_OPTIONS.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`relative cursor-pointer rounded-xl border p-3 transition-all duration-200 flex flex-col justify-between ${
                isSelected ? opt.activeColor : `${opt.borderColor} bg-white hover:bg-slate-50/70`
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="p-1.5 rounded-lg bg-white border border-border/80 shadow-2xs">
                  {opt.icon}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${opt.badgeColor}`}>
                    {opt.badge}
                  </span>
                  {isSelected && <CheckCircle2 size={16} className="text-navy" />}
                </div>
              </div>

              <div className="mt-2.5">
                <p className="text-xs font-bold text-navy flex items-center gap-1">
                  {opt.title} <span className="font-mono text-[11px] text-muted font-medium">({opt.extension})</span>
                </p>
                <p className="text-[11px] text-muted leading-tight mt-0.5">{opt.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
