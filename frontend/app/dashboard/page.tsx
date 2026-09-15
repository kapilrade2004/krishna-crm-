'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { useDashboardKpis, useOnboardingDashboard } from '@/hooks/useApi';
import { PageLoader } from '@/components/ui';
import {
  Package, Clock, IndianRupee, CheckCircle2, User, UserCheck, Star,
  ShieldCheck, FileText, Layers, Award, AlertCircle, Share2, Shield
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useAuthStore } from '@/lib/auth';
import TelecallerDashboard from '@/components/dashboards/TelecallerDashboard';

// Reference fallback datasets removed for clean local environment
const FALLBACK_REVENUE_CHART: any[] = [];
const FALLBACK_PRODUCTS: any[] = [];
const FALLBACK_CITIES: any[] = [];

export default function DashboardPage() {
  const { data: kpis, isLoading } = useDashboardKpis();
  const { data: onboardingWidgets } = useOnboardingDashboard();
  const { user } = useAuthStore();

  const role = (user?.role || '').toLowerCase().trim();

  // Role-specific dedicated desk for Telecaller
  if (role === 'telecaller') {
    return (
      <AppShell>
        <Topbar title="Overview" subtitle="Telecaller Calling Desk (95% Target)" />
        <main className="flex-1 overflow-y-auto p-6">
          <TelecallerDashboard user={user} />
        </main>
      </AppShell>
    );
  }

  // Calculated KPI values from live API
  const totalOrders = kpis?.orders?.total || 0;
  const pendingOrders = kpis?.orders?.byStatus?.find((s: any) => s.status?.toLowerCase().includes('pending'))?.count || 0;
  const confirmedOrders = kpis?.orders?.byStatus?.find((s: any) => s.status?.toLowerCase().includes('confirmed'))?.count || 0;
  const deliveredOrders = kpis?.orders?.byStatus?.find((s: any) => s.status?.toLowerCase().includes('delivered'))?.count || 0;

  const totalCustomers = kpis?.customers?.total || 0;
  const activeCustomers = kpis?.customers?.active || 0;
  const newCustomers = kpis?.customers?.newThisMonth || 0;

  const totalRevenue = Number(kpis?.revenue?.allTime || kpis?.revenue?.thisMonth || 0);
  const totalRevenueFormatted = totalRevenue > 0
    ? (totalRevenue >= 1000 ? `₹${(totalRevenue / 1000).toFixed(1)}K` : `₹${totalRevenue.toLocaleString('en-IN')}`)
    : '₹0';

  const activeWarranty = kpis?.warranty?.activated || 0;
  const pendingDocs = onboardingWidgets?.incomplete_documentation ?? 0;
  const pendingOnboarding = onboardingWidgets?.pending_onboarding ?? 0;
  const verificationPending = onboardingWidgets?.verification_requests ?? 0;
  const rejectedDocs = onboardingWidgets?.rejected_documents ?? 0;

  // Chart data calculation
  const revenueChartData = kpis?.revenue?.byDay && kpis.revenue.byDay.length > 0
    ? kpis.revenue.byDay.map((d: any) => ({
        day: d.date ? d.date.slice(5) : 'Day',
        revenue: d.revenue || 0,
      }))
    : FALLBACK_REVENUE_CHART;

  const channelData = kpis?.orders?.byMarketplace && kpis.orders.byMarketplace.length > 0
    ? kpis.orders.byMarketplace.map((m: any, idx: number) => ({
        name: m.marketplace || 'Direct',
        value: m.count || 0,
        color: ['#2563eb', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6'][idx % 5],
        percentage: totalOrders > 0 ? `${((m.count / totalOrders) * 100).toFixed(1)}%` : '0%',
      }))
    : [];

  const productsList = kpis?.orders?.byProduct && kpis.orders.byProduct.length > 0
    ? kpis.orders.byProduct.slice(0, 5).map((p: any) => ({
        name: p.product_name || 'Product Item',
        count: p.count || 0,
      }))
    : FALLBACK_PRODUCTS;

  const maxProductCount = Math.max(...productsList.map((p: any) => p.count), 1);

  const cityData = kpis?.cityWise && kpis.cityWise.length > 0
    ? kpis.cityWise.slice(0, 5).map((c: any) => ({
        city: c.city || 'Unknown',
        orders: c.order_count || 0,
        customers: c.customer_count || 0,
        revenue: `₹${(c.revenue || 0).toLocaleString('en-IN')}`,
      }))
    : FALLBACK_CITIES;

  return (
    <AppShell>
      <Topbar title="Overview" subtitle="Business performance at a glance" />

      <main className="flex-1 overflow-y-auto p-3.5 sm:p-4 lg:p-5 space-y-3.5 bg-[#f8fafc]">
        {isLoading && !kpis ? (
          <PageLoader />
        ) : (
          <div className="max-w-[1680px] mx-auto space-y-3.5">

            {/* ══════════════════════════════════════════════════════════════
                ROW 1: 3 KPI CONTAINER CARDS (Orders & Sales, Customers, Ops)
                ══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">

              {/* CARD 1: Orders & Sales (4 Sub-Cards) */}
              <div className="lg:col-span-4 bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-blue-500 text-xs">✦</span>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight">Orders & Sales</h3>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {/* Total Orders */}
                  <div className="bg-blue-50/50 rounded-xl p-2.5 border border-blue-100/80 hover:bg-blue-50/70 hover:border-blue-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center mb-1 shadow-2xs">
                      <Package size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-blue-600/75 uppercase tracking-wider truncate">TOTAL ORDERS</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{totalOrders}</p>
                      <p className="text-[8.5px] font-semibold text-emerald-600 leading-tight">↑ 12% <span className="font-normal text-slate-400">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Pending Verification */}
                  <div className="bg-amber-50/50 rounded-xl p-2.5 border border-amber-100/80 hover:bg-amber-50/70 hover:border-amber-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-600 flex items-center justify-center mb-1 shadow-2xs">
                      <Clock size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-amber-600/75 uppercase tracking-wider truncate">PENDING VERIFICATION</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{pendingOrders}</p>
                      <p className="text-[8.5px] font-semibold text-amber-600 leading-tight">↑ 8% <span className="font-normal text-slate-400">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Total Revenue */}
                  <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100/80 hover:bg-emerald-50/70 hover:border-emerald-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-1 shadow-2xs">
                      <IndianRupee size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-emerald-600/75 uppercase tracking-wider truncate">TOTAL REVENUE</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{totalRevenueFormatted}</p>
                      <p className="text-[8.5px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Confirmed Orders */}
                  <div className="bg-teal-50/50 rounded-xl p-2.5 border border-teal-100/80 hover:bg-teal-50/70 hover:border-teal-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-teal-100/80 text-teal-600 flex items-center justify-center mb-1 shadow-2xs">
                      <CheckCircle2 size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-teal-600/75 uppercase tracking-wider truncate">CONFIRMED ORDERS</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{confirmedOrders}</p>
                      <p className="text-[8.5px] font-semibold text-teal-600 leading-tight">↑ 100% <span className="font-normal text-slate-400">vs last 7 days</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: Customers & Conversion Platform (3 Sub-Cards) */}
              <div className="lg:col-span-3 bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-emerald-500 text-xs">✦</span>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight">Customers & Conversion Platform</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Total Customers */}
                  <div className="bg-sky-50/50 rounded-xl p-2.5 border border-sky-100/80 hover:bg-sky-50/70 hover:border-sky-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-sky-100/80 text-sky-600 flex items-center justify-center mb-1 shadow-2xs">
                      <User size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-sky-600/75 uppercase tracking-wider truncate">TOTAL CUSTOMERS</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{totalCustomers}</p>
                      <p className="text-[8.5px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Customers Active */}
                  <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100/80 hover:bg-emerald-50/70 hover:border-emerald-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-1 shadow-2xs">
                      <UserCheck size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-emerald-600/75 uppercase tracking-wider truncate">CUSTOMERS ACTIVE</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{activeCustomers}</p>
                      <p className="text-[8.5px] font-semibold text-emerald-600 leading-tight">↑ 100% <span className="font-normal text-slate-400">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Top New Customers */}
                  <div className="bg-indigo-50/50 rounded-xl p-2.5 border border-indigo-100/80 hover:bg-indigo-50/70 hover:border-indigo-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100/80 text-indigo-600 flex items-center justify-center mb-1 shadow-2xs">
                      <Star size={13} strokeWidth={2.2} className="fill-indigo-500 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-indigo-600/75 uppercase tracking-wider truncate">TOP NEW CUSTOMERS</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{newCustomers}</p>
                      <p className="text-[8.5px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: Operations & Warranty Performance (5 Sub-Cards) */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="text-purple-500 text-xs">✦</span>
                  <h3 className="text-xs font-bold text-slate-800 tracking-tight">Operations & Warranty Performance</h3>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {/* Pending Orders */}
                  <div className="bg-amber-50/50 rounded-xl p-2.5 border border-amber-100/80 hover:bg-amber-50/70 hover:border-amber-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-600 flex items-center justify-center mb-1 shadow-2xs">
                      <Clock size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-amber-600/75 uppercase tracking-wider truncate">PENDING ORDERS</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{pendingOrders}</p>
                      <p className="text-[8.5px] font-semibold text-amber-600 leading-tight">↑ 8% <span className="font-normal text-slate-400">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Warranty Active */}
                  <div className="bg-teal-50/50 rounded-xl p-2.5 border border-teal-100/80 hover:bg-teal-50/70 hover:border-teal-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-teal-100/80 text-teal-600 flex items-center justify-center mb-1 shadow-2xs">
                      <ShieldCheck size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-teal-600/75 uppercase tracking-wider truncate">WARRANTY ACTIVE</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{activeWarranty}</p>
                      <p className="text-[8.5px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Employees Onboarding */}
                  <div className="bg-blue-50/50 rounded-xl p-2.5 border border-blue-100/80 hover:bg-blue-50/70 hover:border-blue-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center mb-1 shadow-2xs">
                      <User size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-blue-600/75 uppercase tracking-wider truncate">EMPLOYEES ONBOARDING</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{pendingOnboarding}</p>
                      <p className="text-[8.5px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Pending Documents */}
                  <div className="bg-rose-50/50 rounded-xl p-2.5 border border-rose-100/80 hover:bg-rose-50/70 hover:border-rose-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-rose-100/80 text-rose-600 flex items-center justify-center mb-1 shadow-2xs">
                      <FileText size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-rose-600/75 uppercase tracking-wider truncate">PENDING DOCUMENTS</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">{pendingDocs}</p>
                      <p className="text-[8.5px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                    </div>
                  </div>

                  {/* Employee Audit */}
                  <div className="bg-purple-50/50 rounded-xl p-2.5 border border-purple-100/80 hover:bg-purple-50/70 hover:border-purple-200 transition-all flex flex-col justify-between">
                    <div className="w-6 h-6 rounded-lg bg-purple-100/80 text-purple-600 flex items-center justify-center mb-1 shadow-2xs">
                      <ShieldCheck size={13} strokeWidth={2.2} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-purple-600/75 uppercase tracking-wider truncate">EMPLOYEE AUDIT</p>
                      <p className="text-lg font-black text-slate-900 leading-tight my-0.5">0</p>
                      <p className="text-[8.5px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* ══════════════════════════════════════════════════════════════
                ROW 2: 3 ANALYTICS VISUAL CARDS (Revenue, Channel, Status)
                ══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">

              {/* CARD 1: Revenue & Deals Closed (Area Chart) */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Package size={13} strokeWidth={2.2} />
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900">Revenue & Deals Closed</h3>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-100/80 text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                    <span>Total Revenue</span>
                    <span className="font-bold text-slate-900">{totalRevenueFormatted}</span>
                  </div>
                </div>

                <div className="h-[200px] w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        ticks={[0, 1000, 2000, 3000, 4000, 5000]}
                        domain={[0, 5000]}
                        tickFormatter={(v: number) => (v === 0 ? '₹0' : `₹${v / 1000}K`)}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val: number) => [`₹${val.toLocaleString('en-IN')}`, 'Revenue']}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        dot={{ r: 3, fill: '#2563eb', stroke: '#fff', strokeWidth: 1.5 }}
                        activeDot={{ r: 5, fill: '#1d4ed8' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CARD 2: Sales by Channel (Donut Chart) */}
              <div className="lg:col-span-3 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Share2 size={13} strokeWidth={2.2} />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">Sales by Channel</h3>
                </div>

                <div className="flex items-center justify-between gap-2 h-[200px] px-2">
                  {/* Donut Chart with Center Text */}
                  <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={channelData}
                          innerRadius={46}
                          outerRadius={62}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {channelData.map((entry: any) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[10px] text-slate-400 font-medium">Total</span>
                      <span className="text-xl font-bold text-slate-900 leading-tight">{totalOrders}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Orders</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="space-y-3 pr-2">
                    {channelData.length > 0 ? (
                      channelData.map((ch: any) => (
                        <div key={ch.name} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ch.color }}></span>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{ch.name}</p>
                            <p className="text-[11px] text-slate-500">{ch.value} ({ch.percentage})</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">No channel orders</div>
                    )}
                  </div>
                </div>
              </div>

              {/* CARD 3: Order Status Breakdown (Horizontal Bar Breakdown) */}
              <div className="lg:col-span-4 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Layers size={13} strokeWidth={2.2} />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">Order Status Breakdown</h3>
                </div>

                <div className="flex-1 flex flex-col justify-center space-y-4 py-2">
                  {/* Row 1: Pending */}
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-xs text-slate-600 font-medium shrink-0">Pending</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 relative overflow-hidden">
                      <div
                        className="bg-[#2563eb] h-full rounded-full transition-all duration-500"
                        style={{ width: `${(pendingOrders / 50) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-800 w-6 text-right">{pendingOrders}</span>
                  </div>

                  {/* Row 2: Confirmed */}
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-xs text-slate-600 font-medium shrink-0">Confirmed</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 relative overflow-hidden">
                      <div
                        className="bg-[#2563eb] h-full rounded-full transition-all duration-500"
                        style={{ width: `${(confirmedOrders / 50) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-800 w-6 text-right">{confirmedOrders}</span>
                  </div>

                  {/* Row 3: Delivered */}
                  <div className="flex items-center gap-3">
                    <span className="w-16 text-xs text-slate-600 font-medium shrink-0">Delivered</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 relative overflow-hidden">
                      <div
                        className="bg-[#2563eb] h-full rounded-full transition-all duration-500"
                        style={{ width: `${(deliveredOrders / 50) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-800 w-6 text-right">{deliveredOrders}</span>
                  </div>

                  {/* Scale labels at bottom */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pl-16 pr-9 pt-1 border-t border-slate-100">
                    <span>0</span>
                    <span>10</span>
                    <span>20</span>
                    <span>30</span>
                    <span>40</span>
                    <span>50</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ══════════════════════════════════════════════════════════════
                ROW 3: 2 CARDS (Top Products by Orders & City-wise Orders)
                ══════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">

              {/* Top Products by Orders */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Award size={13} strokeWidth={2.2} />
                    </div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900">Top Products by Orders</h3>
                  </div>
                  <div className="px-2 py-0.5 rounded-lg border border-slate-200 text-[10px] font-medium text-slate-500 flex items-center gap-1">
                    <span>↕</span> Product Count
                  </div>
                </div>

                <div className="space-y-2.5 py-1">
                  {productsList.length > 0 ? (
                    productsList.map((prod: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 text-xs">
                        <span className="w-56 sm:w-64 text-slate-700 truncate font-medium" title={prod.name}>
                          {prod.name}
                        </span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 relative overflow-hidden">
                          <div
                            className="bg-[#2563eb] h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(4, (prod.count / maxProductCount) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-800 w-6 text-right shrink-0">{prod.count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400 italic">No products recorded yet</div>
                  )}
                </div>
              </div>

              {/* City-wise Orders & Customers */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <ShieldCheck size={13} strokeWidth={2.2} />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">City-wise Orders & Customers</h3>
                </div>

                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 font-bold uppercase text-[9.5px] border-b border-slate-100 pb-1.5">
                        <th className="py-1.5 font-semibold">CITY</th>
                        <th className="py-1.5 font-semibold text-center">TOTAL ORDERS</th>
                        <th className="py-1.5 font-semibold text-center">CUSTOMERS</th>
                        <th className="py-1.5 font-semibold text-right">REVENUE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {cityData.length > 0 ? (
                        cityData.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 text-slate-800 font-medium">{item.city}</td>
                            <td className="py-2 text-slate-600 text-center">{item.orders}</td>
                            <td className="py-2 text-slate-600 text-center">{item.customers}</td>
                            <td className="py-2 text-slate-900 font-semibold text-right">{item.revenue}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400 text-xs italic">No city order records found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  {cityData.length > 0 ? `Showing 1-${cityData.length} of ${cityData.length} cities` : 'No cities to display'}
                </p>
              </div>

            </div>

            {/* ══════════════════════════════════════════════════════════════
                ROW 4: FULL-WIDTH CARD (Employee Onboarding & Document Verification)
                ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck size={13} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                    Employee Onboarding & Document Verification
                  </h3>
                  <p className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                    Workflow tracking for onboarding and document verification
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                {/* 1. Pending Onboarding */}
                <div className="flex items-center gap-3 p-2 rounded-xl bg-blue-50/50 border border-blue-100/70 hover:bg-blue-50/70 transition-all">
                  <div className="w-8 h-8 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <User size={15} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold text-blue-700/80 leading-tight">Pending Onboarding</p>
                    <p className="text-xl font-black text-slate-900 leading-tight my-0.5">{pendingOnboarding}</p>
                    <p className="text-[9px] font-semibold text-emerald-600 leading-tight">↑ 0% <span className="font-normal text-slate-400">vs last 7 days</span></p>
                  </div>
                </div>

                {/* 2. Incomplete Docs */}
                <div className="flex items-center gap-3 p-2 rounded-xl bg-amber-50/50 border border-amber-100/70 hover:bg-amber-50/70 transition-all">
                  <div className="w-8 h-8 rounded-full bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <FileText size={15} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold text-amber-700/80 leading-tight">Incomplete Docs</p>
                    <p className="text-xl font-black text-slate-900 leading-tight my-0.5">{pendingDocs}</p>
                    <p className="text-[9px] font-semibold text-emerald-600 leading-tight">↑ 0% <span className="font-normal text-slate-400">vs last 7 days</span></p>
                  </div>
                </div>

                {/* 3. Verification Pending */}
                <div className="flex items-center gap-3 p-2 rounded-xl bg-purple-50/50 border border-purple-100/70 hover:bg-purple-50/70 transition-all">
                  <div className="w-8 h-8 rounded-full bg-purple-100/80 text-purple-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <Shield size={15} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold text-purple-700/80 leading-tight">Verification Pending</p>
                    <p className="text-xl font-black text-slate-900 leading-tight my-0.5">{verificationPending}</p>
                    <p className="text-[9px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                  </div>
                </div>

                {/* 4. Rejected Documents */}
                <div className="flex items-center gap-3 p-2 rounded-xl bg-rose-50/50 border border-rose-100/70 hover:bg-rose-50/70 transition-all">
                  <div className="w-8 h-8 rounded-full bg-rose-100/80 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                    <AlertCircle size={15} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-[10.5px] font-semibold text-rose-700/80 leading-tight">Rejected Documents</p>
                    <p className="text-xl font-black text-slate-900 leading-tight my-0.5">{rejectedDocs}</p>
                    <p className="text-[9px] font-medium text-slate-400 leading-tight">— 0% <span className="font-normal">vs last 7 days</span></p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </AppShell>
  );
}
