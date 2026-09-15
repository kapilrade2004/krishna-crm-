'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PhoneCall, CheckCircle, Clock, XCircle, Star, ArrowRight, Target, ShieldCheck } from 'lucide-react';
import { KpiCard, Badge, Button } from '@/components/ui';
import api from '@/lib/api';

export default function TelecallerDashboard({ user }: { user: any }) {
  const [stats, setStats] = useState<any>({
    todayAssignedCalls: 0,
    completedCalls: 0,
    confirmedOrders: 0,
    cancelledOrders: 0,
    easyshipRatingsCollected: 0,
    confirmationRate: 0,
    targetRate: 95.0,
  });

  const progressPercent = stats.todayAssignedCalls > 0
    ? Math.min(100, Math.round((stats.completedCalls / stats.todayAssignedCalls) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* 95% Confirmation Target Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-navy text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Target size={16} className="text-white" />
              <span>Telecaller Mandate — Confirmation & Rating Collection</span>
            </div>
            <h2 className="text-xl font-bold">Order Confirmation Calling Queue (95% Target)</h2>
            <p className="text-sm text-amber-100 mt-1">
              Call customers within 15 minutes of order placement. Confirm purifier model, membrane compatibility, and shipping address.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-xl border border-white/20 text-center min-w-[220px]">
            <div className="text-3xl font-extrabold text-white">
              {stats.confirmationRate}% <span className="text-sm font-normal text-amber-200">/ 95%</span>
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${stats.confirmationRate}%` }}
              />
            </div>
            <p className="text-[11px] text-amber-100 mt-1.5 font-medium">Daily Confirmation Rate</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Calling Queue"
          value={`${stats.completedCalls} / ${stats.todayAssignedCalls}`}
          icon={PhoneCall}
          subtext={`${progressPercent}% calls completed today`}
        />
        <KpiCard
          label="Confirmed for Dispatch"
          value={stats.confirmedOrders}
          icon={CheckCircle}
          subtext="Address & specs verified"
        />
        <KpiCard
          label="Easyship Ratings Collected"
          value={stats.easyshipRatingsCollected}
          icon={Star}
          subtext="5-star seller feedback logged"
        />
        <KpiCard
          label="Cancellations Caught"
          value={stats.cancelledOrders}
          icon={XCircle}
          subtext="Saved RTO courier freight"
        />
      </div>

      {/* Action Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 border-l-4 border-amber">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-navy text-sm">Order Confirmation Workbench</h4>
              <p className="text-xs text-muted mt-0.5">Call new channel orders and confirm custom purifier fittings.</p>
            </div>
            <Link href="/telecaller">
              <Button variant="primary" size="sm">
                <span>Start Calling</span>
                <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-navy text-sm">Amazon Easyship Calling Desk</h4>
              <p className="text-xs text-muted mt-0.5">Collect 5-star seller ratings & product reviews from delivered parcels.</p>
            </div>
            {/*
            <Link href="/reviews">
              <Button variant="secondary" size="sm">
                <span>Record Rating</span>
                <Star size={14} className="ml-1.5 text-amber" />
              </Button>
            </Link>
            */}
          </div>
        </div>
      </div>
    </div>
  );
}
