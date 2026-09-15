'use strict';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Briefcase, ShieldCheck, AlertTriangle, TrendingUp, IndianRupee, Tag, ArrowRight } from 'lucide-react';
import { KpiCard, Badge, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

export default function SeniorAccountManagerDashboard({ user }: { user: any }) {
  const [healthData, setHealthData] = useState<any>({
    overallHealthScore: 98,
    marketplaces: [],
    suppressedItems: [],
  });
  const [profitability, setProfitability] = useState<any>({
    accounts: [],
    summary: { totalRevenue: 1770000, totalProfit: 484400, overallMarginPercent: 27.4 },
  });

  useEffect(() => {
    api.get('/account-management/health')
      .then(res => {
        if (res.data?.data) setHealthData(res.data.data);
      })
      .catch(() => {});

    api.get('/account-management/profitability')
      .then(res => {
        if (res.data?.data) setProfitability(res.data.data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Senior Account Manager Mandate Banner */}
      <div className="bg-gradient-to-r from-cyan-900 via-slate-800 to-navy text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Briefcase size={16} className="text-amber" />
              <span>Senior Account Management — Bharat</span>
            </div>
            <h2 className="text-xl font-bold">Marketplace Health, Coupon/BXGY & Profitability Oversight</h2>
            <p className="text-sm text-cyan-100 mt-1">
              Maintain 100% account health, resolve suppressed listings, verify coupon/BXGY offers, audit FBA discrepancies and track net profitability.
            </p>
          </div>
          <Link href="/account-management">
            <button className="bg-amber text-navy font-bold px-4 py-2.5 rounded-xl hover:bg-amber-400 text-xs transition shadow-sm">
              Open SAM Command Desk
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Overall Account Health"
          value={`${healthData.overallHealthScore}%`}
          icon={ShieldCheck}
          subtext="ODR & VTR compliant"
        />
        <KpiCard
          label="Net Margin Realized"
          value={`${profitability.summary.overallMarginPercent}%`}
          icon={TrendingUp}
          subtext={formatCurrency(profitability.summary.totalProfit) + ' Net Profit'}
        />
        <KpiCard
          label="Suppressed Listings"
          value={healthData.suppressedItems?.length || 3}
          icon={AlertTriangle}
          subtext="Urgent image/brand fixes"
        />
        <KpiCard
          label="Live Coupons & Deals"
          value="4 Active"
          icon={Tag}
          subtext="BXGY & vouchers monitored"
        />
      </div>

      {/* Account-wise Margin Performance Table */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-navy">Account-Wise Net Margin Breakdown</h3>
            <p className="text-xs text-muted">Gross revenue minus marketplace commissions, returns, and PPC spend</p>
          </div>
          <Link href="/account-management">
            <Button variant="secondary" size="sm">
              <span>View Profitability Matrix</span>
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Marketplace Account</th>
                <th className="py-2.5 px-3">Gross Revenue</th>
                <th className="py-2.5 px-3">Ad Spend</th>
                <th className="py-2.5 px-3">Channel Fees</th>
                <th className="py-2.5 px-3">Net Profit</th>
                <th className="py-2.5 px-3 text-right">Net Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profitability.accounts?.map((acc: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{acc.account}</td>
                  <td className="py-2.5 px-3 font-mono">{formatCurrency(acc.grossRevenue)}</td>
                  <td className="py-2.5 px-3 font-mono text-red-600">-{formatCurrency(acc.adSpend)}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">-{formatCurrency(acc.channelFees)}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{formatCurrency(acc.netProfit)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      {acc.netMarginPercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
