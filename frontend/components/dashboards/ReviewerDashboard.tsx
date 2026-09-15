'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, CheckCircle, AlertTriangle, Trash2, ArrowRight, ShieldCheck, Award } from 'lucide-react';
import { KpiCard, Badge, Button } from '@/components/ui';
import api from '@/lib/api';

export default function ReviewerDashboard({ user }: { user: any }) {
  const [stats, setStats] = useState<any>({
    totalReviews: 48,
    verifiedCount: 32,
    pendingCount: 12,
    flaggedCount: 4,
    auditedToday: 7,
    dailyQuotaTarget: 10,
  });
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reviews?limit=5')
      .then(res => {
        if (res.data?.data) {
          setRecentReviews(res.data.data.reviews || []);
          if (res.data.data.stats) {
            setStats(res.data.data.stats);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const progressPercent = Math.min(100, Math.round((stats.auditedToday / stats.dailyQuotaTarget) * 100));

  return (
    <div className="space-y-6">
      {/* Sushil's Daily 10-Product Quota Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-navy text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Award size={16} className="text-amber" />
              <span>Reviewer Daily Mandate — Sushil</span>
            </div>
            <h2 className="text-xl font-bold">10-Product Daily Review Audit Progress</h2>
            <p className="text-sm text-indigo-200 mt-1">
              Audit 10 products daily, verify authentic feedback, flag fake submissions, and add 3 quality customer reviews.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-xl border border-white/20 text-center min-w-[200px]">
            <div className="text-3xl font-extrabold text-white">
              {stats.auditedToday} <span className="text-sm font-normal text-indigo-200">/ {stats.dailyQuotaTarget}</span>
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-indigo-200 mt-1.5 font-medium">{progressPercent}% Quota Completed Today</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Reviews Tracked"
          value={stats.totalReviews}
          icon={Star}
          subtext="Across Amazon, Flipkart & Direct"
        />
        <KpiCard
          label="Verified Genuine"
          value={stats.verifiedCount}
          icon={ShieldCheck}
          subtext="Cross-verified with invoices"
        />
        <KpiCard
          label="Pending Verification"
          value={stats.pendingCount}
          icon={CheckCircle}
          subtext="Awaiting review audit"
        />
        <KpiCard
          label="Flagged / Suspicious"
          value={stats.flaggedCount}
          icon={AlertTriangle}
          subtext="Suspected competitor/bot spam"
        />
      </div>

      {/* Verification Action Queue */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-navy">Pending Review Moderation Queue</h3>
            <p className="text-xs text-muted">Recent customer submissions requiring verification or moderation</p>
          </div>
          <Link href="/reviews">
            <Button variant="secondary" size="sm">
              <span>Open Full Review Desk</span>
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Marketplace</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Rating</th>
                <th className="py-2.5 px-3">Review Feedback</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No pending reviews in queue. All products up to date!
                  </td>
                </tr>
              ) : (
                recentReviews.map((rev: any) => (
                  <tr key={rev.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{rev.product_name}</td>
                    <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-500">{rev.marketplace}</td>
                    <td className="py-2.5 px-3 text-slate-600">{rev.customer_name || 'Anonymous'}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center text-amber font-bold">
                        ★ {rev.product_rating || 5}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{rev.review_text || rev.review_title}</td>
                    <td className="py-2.5 px-3">
                      <Badge
                        colour={
                          rev.status === 'verified_genuine'
                            ? 'green'
                            : rev.status === 'flagged_suspicious'
                            ? 'red'
                            : 'amber'
                        }
                      >
                        {rev.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link href="/reviews">
                        <span className="text-amber hover:underline font-semibold cursor-pointer">Audit</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
