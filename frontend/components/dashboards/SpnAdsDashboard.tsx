'use strict';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, IndianRupee, Zap, Target, AlertTriangle, ArrowRight, BarChart2, CheckCircle } from 'lucide-react';
import { KpiCard, Badge, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

export default function SpnAdsDashboard({ user }: { user: any }) {
  const [overview, setOverview] = useState<any>({
    totalSpend: 4180,
    totalSales: 16900,
    blendedRoas: 4.04,
    blendedAcos: 24.7,
    activeCampaigns: 3,
  });
  const [bottom10, setBottom10] = useState<any[]>([]);

  useEffect(() => {
    api.get('/spn-ads/campaigns')
      .then(res => {
        if (res.data?.data?.overview) {
          setOverview(res.data.data.overview);
        }
      })
      .catch(() => {});

    api.get('/spn-ads/bottom-10-skus')
      .then(res => {
        if (res.data?.data?.skus) {
          setBottom10(res.data.data.skus.slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* SPN & Ads Mandate Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-700 to-navy text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-orange-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <TrendingUp size={16} className="text-amber" />
              <span>SPN & Ads Growth Center — Naushad</span>
            </div>
            <h2 className="text-xl font-bold">PPC Bids, ROAS Optimization & Bottom 10 SKUs Turnaround</h2>
            <p className="text-sm text-orange-100 mt-1">
              Prune high-waste Auto campaigns, migrate top-converting terms to Exact Match, optimize bids vs benchmarks, and revive bottom 10 SKUs.
            </p>
          </div>
          <Link href="/marketing">
            <button className="bg-amber text-navy font-bold px-4 py-2.5 rounded-xl hover:bg-amber-400 text-xs transition shadow-sm">
              Open Ads Optimizer
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Today's PPC Ad Spend"
          value={formatCurrency(overview.totalSpend)}
          icon={IndianRupee}
          subtext="Amazon & Flipkart ads"
        />
        <KpiCard
          label="PPC Ad Generated Sales"
          value={formatCurrency(overview.totalSales)}
          icon={TrendingUp}
          subtext="Direct attributed revenue"
        />
        <KpiCard
          label="Blended ROAS"
          value={`${overview.blendedRoas}x`}
          icon={Zap}
          subtext="Target: > 3.8x ROAS"
        />
        <KpiCard
          label="Blended ACOS"
          value={`${overview.blendedAcos}%`}
          icon={Target}
          subtext="Target: < 25% ACOS"
        />
      </div>

      {/* Bottom 10 SKUs Priority Action Deck */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-navy">Lowest Performing SKUs Requiring Impression Turnaround</h3>
            <p className="text-xs text-muted">Daily review of bottom 10 catalog items with low traffic or poor CTR</p>
          </div>
          <Link href="/marketing">
            <Button variant="secondary" size="sm">
              <span>View All 10 SKUs</span>
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {bottom10.map((item: any, idx: number) => (
            <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{item.sku}</span>
                    <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                  </div>
                  <p className="text-[11px] text-orange-700 font-medium mt-0.5">
                    Suggested Action: {item.action}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span>{item.impressions} Impr.</span>
                <span>{item.clicks} Clicks</span>
                <span className="font-bold text-slate-800">{item.orders} Orders</span>
                <Link href="/marketing">
                  <span className="text-amber hover:underline font-semibold text-xs cursor-pointer">Optimize Bids</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
