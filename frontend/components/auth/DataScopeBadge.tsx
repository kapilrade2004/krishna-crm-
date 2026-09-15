'use client';

import React from 'react';
import { Shield, Users, Building, UserCheck, Globe } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';

export default function DataScopeBadge({ scope }: { scope?: string }) {
  const { user } = useAuthStore();
  const effectiveScope = scope || (user as any)?.data_scope || 'Global';

  const scopeConfig: Record<string, { label: string; icon: any; colour: string }> = {
    all: { label: 'Global Scope', icon: Globe, colour: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    global: { label: 'Global Scope', icon: Globe, colour: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    department: { label: 'Department Scope', icon: Building, colour: 'bg-blue-50 text-blue-700 border-blue-200' },
    team: { label: 'Team Scope', icon: Users, colour: 'bg-purple-50 text-purple-700 border-purple-200' },
    assigned: { label: 'Assigned Records Only', icon: UserCheck, colour: 'bg-amber-50 text-amber-700 border-amber-200' },
    own: { label: 'Self Records Only', icon: Shield, colour: 'bg-slate-50 text-slate-700 border-slate-200' },
  };

  const current = scopeConfig[effectiveScope.toLowerCase()] || scopeConfig.global;
  const Icon = current.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${current.colour}`}>
      <Icon size={12} />
      <span>{current.label}</span>
    </span>
  );
}
