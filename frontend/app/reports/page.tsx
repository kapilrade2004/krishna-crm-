'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { useSalesReport, useTeamReport, useDashboardKpis, downloadReport } from '@/hooks/useApi';
import { Button, Select, PageLoader } from '@/components/ui';
import { formatCurrency, formatNumber, fmtDate, getErrorMessage } from '@/lib/utils';
import {
  Download, TrendingUp, Package, IndianRupee, CheckCircle2, Users,
  ShoppingCart, RotateCcw, UserCheck, UserPlus, ShieldCheck, XCircle, Layers,
  BarChart3, Award, Search, Filter, ArrowUpDown, Target, PhoneCall, CheckSquare,
  AlertCircle, ChevronRight, UserCircle, Briefcase
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import QuickExportModal from '@/components/common/QuickExportModal';
import type { ExportFormat } from '@/components/common/ExportFormatSelector';

function formatCompactINR(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  if (isNaN(n) || n === 0) return '₹0';
  if (Math.abs(n) >= 10000000) {
    return `₹${(n / 10000000).toFixed(1)}Cr`;
  }
  if (Math.abs(n) >= 100000) {
    return `₹${(n / 100000).toFixed(1)}L`;
  }
  if (Math.abs(n) >= 1000) {
    const kVal = n / 1000;
    return kVal >= 100 ? `₹${kVal.toFixed(0)}K` : `₹${kVal.toFixed(1)}K`;
  }
  return `₹${n.toLocaleString('en-IN')}`;
}

interface TeamMemberRecord {
  id?: string | number;
  name: string;
  role: string;
  orders_assigned: number;
  total_value: number;
  orders_delivered: number;
  orders_cancelled: number;
  followups_total: number;
  followups_completed: number;
  tasks_total: number;
  tasks_done: number;
}

const GROUP_OPTIONS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'marketplace', label: 'By Marketplace' },
  { value: 'user', label: 'By Team Member' },
];

const SORT_OPTIONS = [
  { value: 'value_desc', label: 'Highest Order Value' },
  { value: 'assigned_desc', label: 'Most Orders Assigned' },
  { value: 'delivered_desc', label: 'Most Delivered Orders' },
  { value: 'delivery_rate_desc', label: 'Highest Delivery Rate (%)' },
  { value: 'followups_desc', label: 'Most Follow-ups Completed' },
  { value: 'tasks_desc', label: 'Most Tasks Done' },
  { value: 'name_asc', label: 'Name (A to Z)' },
];

export default function ReportsPage() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo = today.toISOString().split('T')[0];

  // Tab State
  const [activeTab, setActiveTab] = useState<'business' | 'team'>('business');

  // Filter States
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [groupBy, setGroupBy] = useState('day');

  // Team Specific Filters
  const [teamSearch, setTeamSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [teamSort, setTeamSort] = useState('value_desc');

  // Export States
  const [exporting, setExporting] = useState<'orders' | 'customers' | 'team' | null>(null);
  const [exportModalType, setExportModalType] = useState<'orders' | 'customers' | 'team' | null>(null);

  // Queries
  const { data: salesReport, isLoading: salesLoading } = useSalesReport({ from_date: fromDate, to_date: toDate, group_by: groupBy });
  const { data: teamReport, isLoading: teamLoading } = useTeamReport({ from_date: fromDate, to_date: toDate });
  const { data: kpis } = useDashboardKpis();

  const handleExport = async (type: 'orders' | 'customers' | 'team', format: ExportFormat) => {
    setExporting(type);
    try {
      await downloadReport(type, { from_date: fromDate, to_date: toDate, format });
      toast.success(`${type.toUpperCase()} report exported as ${format.toUpperCase()}.`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setExporting(null);
    }
  };

  const summary = salesReport?.summary;
  const chartData = salesReport?.data || [];
  const teamList: TeamMemberRecord[] = useMemo(() => {
    return (teamReport?.team || []) as TeamMemberRecord[];
  }, [teamReport?.team]);

  // Roles in team list
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    teamList.forEach(m => {
      if (m.role) set.add(m.role.toLowerCase());
    });
    return Array.from(set);
  }, [teamList]);

  // Filtered & Sorted Team List
  const filteredTeamList = useMemo(() => {
    return teamList
      .filter((m) => {
        const matchesSearch = !teamSearch ||
          m.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
          m.role.toLowerCase().includes(teamSearch.toLowerCase());
        const matchesRole = roleFilter === 'all' || m.role.toLowerCase() === roleFilter.toLowerCase();
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => {
        const rateA = Number(a.orders_assigned) > 0 ? (Number(a.orders_delivered) / Number(a.orders_assigned)) : 0;
        const rateB = Number(b.orders_assigned) > 0 ? (Number(b.orders_delivered) / Number(b.orders_assigned)) : 0;

        switch (teamSort) {
          case 'value_desc':
            return (Number(b.total_value) || 0) - (Number(a.total_value) || 0);
          case 'assigned_desc':
            return (Number(b.orders_assigned) || 0) - (Number(a.orders_assigned) || 0);
          case 'delivered_desc':
            return (Number(b.orders_delivered) || 0) - (Number(a.orders_delivered) || 0);
          case 'delivery_rate_desc':
            return rateB - rateA;
          case 'followups_desc':
            return (Number(b.followups_completed) || 0) - (Number(a.followups_completed) || 0);
          case 'tasks_desc':
            return (Number(b.tasks_done) || 0) - (Number(a.tasks_done) || 0);
          case 'name_asc':
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
  }, [teamList, teamSearch, roleFilter, teamSort]);

  // Aggregate Team Summary
  const teamSummary = useMemo(() => {
    const totalMembers = teamList.length;
    const totalAssigned = teamList.reduce((acc, m) => acc + (Number(m.orders_assigned) || 0), 0);
    const totalValue = teamList.reduce((acc, m) => acc + (Number(m.total_value) || 0), 0);
    const totalDelivered = teamList.reduce((acc, m) => acc + (Number(m.orders_delivered) || 0), 0);
    const totalCancelled = teamList.reduce((acc, m) => acc + (Number(m.orders_cancelled) || 0), 0);
    const deliveryRate = totalAssigned > 0 ? ((totalDelivered / totalAssigned) * 100).toFixed(1) : '0.0';

    const totalFollowups = teamList.reduce((acc, m) => acc + (Number(m.followups_total) || 0), 0);
    const completedFollowups = teamList.reduce((acc, m) => acc + (Number(m.followups_completed) || 0), 0);
    const followupRate = totalFollowups > 0 ? ((completedFollowups / totalFollowups) * 100).toFixed(1) : '0.0';

    const totalTasks = teamList.reduce((acc, m) => acc + (Number(m.tasks_total) || 0), 0);
    const doneTasks = teamList.reduce((acc, m) => acc + (Number(m.tasks_done) || 0), 0);
    const taskRate = totalTasks > 0 ? ((doneTasks / totalTasks) * 100).toFixed(1) : '0.0';

    return {
      totalMembers,
      totalAssigned,
      totalValue,
      totalDelivered,
      totalCancelled,
      deliveryRate,
      totalFollowups,
      completedFollowups,
      followupRate,
      totalTasks,
      doneTasks,
      taskRate,
    };
  }, [teamList]);

  // Top 8 Team Members for chart visualization
  const teamChartData = useMemo(() => {
    return [...teamList]
      .sort((a, b) => (Number(b.total_value) || 0) - (Number(a.total_value) || 0))
      .slice(0, 8)
      .map(m => ({
        name: m.name.length > 12 ? m.name.substring(0, 10) + '..' : m.name,
        fullName: m.name,
        assigned: Number(m.orders_assigned) || 0,
        delivered: Number(m.orders_delivered) || 0,
        cancelled: Number(m.orders_cancelled) || 0,
        totalValue: Number(m.total_value) || 0,
      }));
  }, [teamList]);

  const xKey = groupBy === 'marketplace' ? 'marketplace'
    : groupBy === 'user' ? 'user_name'
    : 'period';

  return (
    <AppShell>
      <Topbar
        title="Reports & Analytics"
        subtitle={
          activeTab === 'business'
            ? 'Business health, revenue, orders, customers & warranty reports'
            : 'Team performance, agent efficiency, order fulfillment & tasks execution'
        }
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* ── TOP NAVIGATION TAB BAR ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('business')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 ${
                activeTab === 'business'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <BarChart3 size={16} className={activeTab === 'business' ? 'text-indigo-600' : 'text-slate-400'} />
              <span>Business Reports</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                activeTab === 'business' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                Revenue & Sales
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 ${
                activeTab === 'team'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Users size={16} className={activeTab === 'team' ? 'text-indigo-600' : 'text-slate-400'} />
              <span>Team Reports / Performance</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                activeTab === 'team' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {teamList.length} Members
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 px-2 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Period: {fmtDate(fromDate)} — {fmtDate(toDate)}</span>
          </div>
        </div>

        {/* Universal Format Prompt Modal */}
        <QuickExportModal
          open={!!exportModalType}
          onClose={() => setExportModalType(null)}
          title={
            exportModalType === 'orders'
              ? 'Export Orders Report'
              : exportModalType === 'customers'
              ? 'Export Customers Report'
              : 'Export Team Performance Report'
          }
          subtitle={`Choose your preferred format to export ${
            exportModalType === 'orders'
              ? 'orders'
              : exportModalType === 'customers'
              ? 'customers'
              : 'team performance'
          } data from ${fromDate} to ${toDate}.`}
          loading={!!exporting}
          onConfirm={async (format) => {
            if (exportModalType) {
              await handleExport(exportModalType, format);
              setExportModalType(null);
            }
          }}
        />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: BUSINESS REPORTS                                           */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'business' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Filters Bar */}
            <div className="card">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-0">
                  <label className="form-label">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>
                <div className="flex flex-col gap-0">
                  <label className="form-label">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>
                <Select
                  label="Group By"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  options={GROUP_OPTIONS}
                  className="w-44 text-xs"
                />
                <div className="flex-1" />
                <Button
                  variant="secondary"
                  icon={<Download size={14} />}
                  loading={exporting === 'orders'}
                  onClick={() => setExportModalType('orders')}
                >
                  Export Orders
                </Button>
                <Button
                  variant="secondary"
                  icon={<Download size={14} />}
                  loading={exporting === 'customers'}
                  onClick={() => setExportModalType('customers')}
                >
                  Export Customers
                </Button>
              </div>
            </div>

            {salesLoading ? (
              <PageLoader />
            ) : (
              <>
                {/* ── ROW 1: ORDERS & REVENUE SNAPSHOT ── */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 rounded-full bg-[#4F46E5]"></span>
                    <h2 className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-500">
                      ORDERS & REVENUE SNAPSHOT
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                    {/* 1. TOTAL ORDERS */}
                    <Link href="/orders" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#5046e5] via-[#6355ff] to-[#7f56d9] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            TOTAL ORDERS
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <ShoppingCart size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.total_orders) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> in selected period
                        </div>
                      </div>
                    </Link>

                    {/* 2. DELIVERED ORDERS */}
                    <Link href="/orders?status=delivered" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#38bdf8] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            DELIVERED ORDERS
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <CheckCircle2 size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.delivered_orders) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> fulfilled successfully
                        </div>
                      </div>
                    </Link>

                    {/* 3. RETURNED ORDERS */}
                    <Link href="/orders?status=returned" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#9f1239] via-[#be123c] to-[#e11d48] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            RETURNED ORDERS
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <RotateCcw size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.returned_orders ?? kpis?.orders?.returned) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> returns & refunds
                        </div>
                      </div>
                    </Link>

                    {/* 4. TOTAL REVENUE */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#0284c7] via-[#0ea5e9] to-[#38bdf8]">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          TOTAL REVENUE
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <TrendingUp size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {formatCompactINR(Number(summary?.total_revenue) || 0)}
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> gross sales volume
                      </div>
                    </div>

                    {/* 5. AVG ORDER VALUE */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#c25e00] via-[#ea580c] to-[#f59e0b]">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          AVG ORDER VALUE
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <IndianRupee size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {formatCurrency(Number(summary?.avg_order_value) || 0)}
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> average order size
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ROW 2: CUSTOMERS PORTFOLIO ── */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 rounded-full bg-[#059669]"></span>
                    <h2 className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-500">
                      CUSTOMERS PORTFOLIO
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. TOTAL CUSTOMERS */}
                    <Link href="/customers" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#4f46e5] via-[#6366f1] to-[#818cf8] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            TOTAL CUSTOMERS
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <Users size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.total_customers ?? kpis?.customers?.total) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> registered client base
                        </div>
                      </div>
                    </Link>

                    {/* 2. ACTIVE CLIENTS */}
                    <Link href="/customers?status=active" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#1d4ed8] via-[#2563eb] to-[#60a5fa] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            ACTIVE CLIENTS
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <UserCheck size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.active_customers ?? kpis?.customers?.active) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> active portfolio
                        </div>
                      </div>
                    </Link>

                    {/* 3. NEW IN PERIOD */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#c25e00] via-[#d97706] to-[#ea580c]">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          NEW IN PERIOD
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <UserPlus size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {formatNumber(Number(summary?.new_customers ?? kpis?.customers?.newThisMonth) || 0)}
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> newly acquired clients
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ROW 3: WARRANTY & PROTECTION STATUS ── */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 rounded-full bg-[#EA580C]"></span>
                    <h2 className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-500">
                      WARRANTY & PROTECTION STATUS
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. ACTIVE WARRANTY */}
                    <Link href="/warranty?status=ACTIVE" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#059669] via-[#10b981] to-[#34d399] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            ACTIVE WARRANTY
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <ShieldCheck size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.active_warranties ?? kpis?.warranty?.activated) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> covered & active purifiers
                        </div>
                      </div>
                    </Link>

                    {/* 2. DEACTIVE / INACTIVE WARRANTY */}
                    <Link href="/warranty?status=EXPIRED" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#9f1239] via-[#be123c] to-[#f43f5e] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            DEACTIVE WARRANTY
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <XCircle size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.deactive_warranties ?? (Math.max(0, (kpis?.warranty?.total || 0) - (kpis?.warranty?.activated || 0)))) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> expired, voided or pending
                        </div>
                      </div>
                    </Link>

                    {/* 3. TOTAL WARRANTIES */}
                    <Link href="/warranty" className="block">
                      <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-gradient-to-br from-[#3730a3] via-[#4338ca] to-[#6366f1] cursor-pointer">
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                            TOTAL WARRANTIES
                          </span>
                          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                            <Layers size={12} />
                          </div>
                        </div>
                        <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                          {formatNumber(Number(summary?.total_warranties ?? kpis?.warranty?.total) || 0)}
                        </div>
                        <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                          <span>↗</span> registered warranty cards
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>

                {/* Sales & Revenue Chart */}
                <div className="card">
                  <div className="card-header flex items-center justify-between">
                    <div>
                      <p className="card-title">
                        Revenue Trend ({GROUP_OPTIONS.find(g => g.value === groupBy)?.label})
                      </p>
                      <p className="text-xs text-muted">
                        Sales revenue and order count distribution for {fromDate} to {toDate}
                      </p>
                    </div>
                  </div>
                  {chartData.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted">
                      No sales data recorded for the selected period.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey={xKey}
                          tick={{ fontSize: 12, fill: '#6B7A8F' }}
                          axisLine={false} tickLine={false}
                          tickFormatter={(v) => groupBy === 'day' || groupBy === 'week' ? fmtDate(v) : v}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6B7A8F' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => name === 'revenue' ? formatCurrency(value) : value}
                          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 13 }} />
                        <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                        <Bar dataKey="order_count" fill="#06B6D4" radius={[4, 4, 0, 0]} name="Orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: TEAM REPORTS / PERFORMANCE                                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'team' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Filter & Search Bar */}
            <div className="card">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-0">
                  <label className="form-label">From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>

                <div className="flex flex-col gap-0">
                  <label className="form-label">To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="form-input text-xs"
                  />
                </div>

                {/* Search Member */}
                <div className="flex-1 min-w-[200px]">
                  <label className="form-label">Search Team Member</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by agent name or role..."
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      className="form-input text-xs pl-8 w-full"
                    />
                  </div>
                </div>

                {/* Role Filter */}
                <div className="w-40">
                  <label className="form-label">Role Filter</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="form-input text-xs w-full capitalize"
                  >
                    <option value="all">All Roles</option>
                    {availableRoles.map((r) => (
                      <option key={r} value={r} className="capitalize">
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div className="w-48">
                  <label className="form-label">Sort By</label>
                  <select
                    value={teamSort}
                    onChange={(e) => setTeamSort(e.target.value)}
                    className="form-input text-xs w-full"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="secondary"
                  icon={<Download size={14} />}
                  loading={exporting === 'team'}
                  onClick={() => setExportModalType('team')}
                >
                  Export Team Report
                </Button>
              </div>
            </div>

            {teamLoading ? (
              <PageLoader />
            ) : (
              <>
                {/* ── TEAM SUMMARY KPIS ── */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-1 rounded-full bg-[#4F46E5]"></span>
                    <h2 className="text-[10.5px] font-extrabold uppercase tracking-widest text-slate-500">
                      TEAM PERFORMANCE OVERVIEW
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
                    {/* 1. Active Team Members */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs bg-gradient-to-br from-[#4338ca] via-[#4f46e5] to-[#6366f1] text-white">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          ACTIVE AGENTS
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <Users size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {teamSummary.totalMembers}
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> active staff members
                      </div>
                    </div>

                    {/* 2. Total Orders Assigned */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6] text-white">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          ORDERS HANDLED
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <ShoppingCart size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {formatNumber(teamSummary.totalAssigned)}
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> total assigned orders
                      </div>
                    </div>

                    {/* 3. Total Value Managed */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs bg-gradient-to-br from-[#0e7490] via-[#0284c7] to-[#38bdf8] text-white">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          VALUE MANAGED
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <IndianRupee size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {formatCompactINR(teamSummary.totalValue)}
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> orders portfolio size
                      </div>
                    </div>

                    {/* 4. Delivery Success Rate */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs bg-gradient-to-br from-[#047857] via-[#059669] to-[#10b981] text-white">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          DELIVERY RATE
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <CheckCircle2 size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {teamSummary.deliveryRate}%
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> {formatNumber(teamSummary.totalDelivered)} delivered
                      </div>
                    </div>

                    {/* 5. Follow-ups & Tasks Rate */}
                    <div className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 shadow-2xs bg-gradient-to-br from-[#b45309] via-[#d97706] to-[#f59e0b] text-white">
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <span className="text-[9.5px] font-bold uppercase tracking-wider text-white/80">
                          FOLLOW-UPS DONE
                        </span>
                        <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0 shadow-xs">
                          <PhoneCall size={12} />
                        </div>
                      </div>
                      <div className="text-lg xl:text-xl font-black text-white tracking-tight leading-none my-0.5">
                        {teamSummary.followupRate}%
                      </div>
                      <div className="text-[10px] font-medium text-white/90 flex items-center gap-1 mt-0.5">
                        <span>↗</span> {formatNumber(teamSummary.completedFollowups)} / {formatNumber(teamSummary.totalFollowups)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── COMPARATIVE TEAM CHART ── */}
                {teamChartData.length > 0 && (
                  <div className="card">
                    <div className="card-header flex items-center justify-between">
                      <div>
                        <p className="card-title flex items-center gap-1.5">
                          <Award size={16} className="text-amber-500" />
                          Top Team Members Performance Breakdown
                        </p>
                        <p className="text-xs text-muted">
                          Orders delivered vs assigned and cancelled for top contributors
                        </p>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={teamChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: '#6B7A8F' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6B7A8F' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [value, name]}
                          contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E2E8F0' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 13 }} />
                        <Bar dataKey="delivered" fill="#10B981" radius={[4, 4, 0, 0]} name="Orders Delivered" />
                        <Bar dataKey="assigned" fill="#6366F1" radius={[4, 4, 0, 0]} name="Orders Assigned" />
                        <Bar dataKey="cancelled" fill="#EF4444" radius={[4, 4, 0, 0]} name="Orders Cancelled" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* ── DETAILED PERFORMANCE TABLE (LINE VIEW BY DEFAULT) ── */}
                <div className="card p-0 overflow-hidden">
                  <div className="card-header px-4 py-3.5 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <p className="card-title text-sm font-bold flex items-center gap-1.5">
                        Team Member Efficiency Ledger
                      </p>
                      <span className="badge badge-neutral text-xs">
                        {filteredTeamList.length} of {teamList.length} Members
                      </span>
                    </div>

                    {teamSearch && (
                      <button
                        onClick={() => setTeamSearch('')}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Clear Search
                      </button>
                    )}
                  </div>

                  {filteredTeamList.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-sm font-semibold text-slate-700">No team members match your criteria</p>
                      <p className="text-xs text-muted">Try adjusting the search query or role filter.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Team Member</th>
                            <th>Role</th>
                            <th className="text-right">Assigned</th>
                            <th className="text-right">Total Value</th>
                            <th className="text-right">Delivered</th>
                            <th className="text-center">Delivery Rate</th>
                            <th className="text-right">Cancelled</th>
                            <th className="text-center">Follow-ups</th>
                            <th className="text-center">Tasks Done</th>
                            <th className="text-center">Performance Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTeamList.map((m, idx) => {
                            const assigned = Number(m.orders_assigned) || 0;
                            const delivered = Number(m.orders_delivered) || 0;
                            const cancelled = Number(m.orders_cancelled) || 0;
                            const value = Number(m.total_value) || 0;
                            const deliveryRate = assigned > 0 ? (delivered / assigned) * 100 : 0;
                            const followupsTotal = Number(m.followups_total) || 0;
                            const followupsCompleted = Number(m.followups_completed) || 0;
                            const followRate = followupsTotal > 0 ? (followupsCompleted / followupsTotal) * 100 : 0;
                            const tasksTotal = Number(m.tasks_total) || 0;
                            const tasksDone = Number(m.tasks_done) || 0;

                            // Rating tier
                            const isTop = deliveryRate >= 70 || (delivered >= 15 && deliveryRate >= 60);
                            const isOnTrack = deliveryRate >= 45 || delivered >= 5;

                            return (
                              <tr key={m.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="font-semibold text-slate-800">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                      {m.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-800 leading-snug">{m.name}</p>
                                      <p className="text-[10.5px] text-slate-400 font-normal">ID: #{m.id || idx + 1}</p>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize border border-slate-200/60">
                                    {m.role || 'Staff'}
                                  </span>
                                </td>

                                <td className="text-right font-medium">
                                  {formatNumber(assigned)}
                                </td>

                                <td className="text-right font-bold text-slate-800">
                                  {formatCurrency(value)}
                                </td>

                                <td className="text-right font-semibold text-emerald-600">
                                  {formatNumber(delivered)}
                                </td>

                                <td className="text-center">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                      deliveryRate >= 70
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : deliveryRate >= 40
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {deliveryRate.toFixed(1)}%
                                  </span>
                                </td>

                                <td className={`text-right font-medium ${cancelled > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                  {formatNumber(cancelled)}
                                </td>

                                <td className="text-center">
                                  <div className="inline-flex flex-col items-center">
                                    <span className="text-xs font-medium text-slate-700">
                                      {followupsCompleted} / {followupsTotal}
                                    </span>
                                    {followupsTotal > 0 && (
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 border border-slate-200/60">
                                        <div
                                          className="h-full bg-indigo-500 rounded-full"
                                          style={{ width: `${Math.min(100, followRate)}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="text-center">
                                  <span className="text-xs font-semibold text-slate-700">
                                    {tasksDone} <span className="text-slate-400 font-normal">/ {tasksTotal}</span>
                                  </span>
                                </td>

                                <td className="text-center">
                                  {isTop ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                                      ★ Top Performer
                                    </span>
                                  ) : isOnTrack ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ● On Track
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-600">
                                      ○ Review
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                            <td colSpan={2}>Team Totals ({filteredTeamList.length} members)</td>
                            <td className="text-right">
                              {formatNumber(filteredTeamList.reduce((s, m) => s + (Number(m.orders_assigned) || 0), 0))}
                            </td>
                            <td className="text-right">
                              {formatCurrency(filteredTeamList.reduce((s, m) => s + (Number(m.total_value) || 0), 0))}
                            </td>
                            <td className="text-right text-emerald-700">
                              {formatNumber(filteredTeamList.reduce((s, m) => s + (Number(m.orders_delivered) || 0), 0))}
                            </td>
                            <td className="text-center">
                              {(() => {
                                const a = filteredTeamList.reduce((s, m) => s + (Number(m.orders_assigned) || 0), 0);
                                const d = filteredTeamList.reduce((s, m) => s + (Number(m.orders_delivered) || 0), 0);
                                return a > 0 ? `${((d / a) * 100).toFixed(1)}%` : '0.0%';
                              })()}
                            </td>
                            <td className="text-right text-rose-700">
                              {formatNumber(filteredTeamList.reduce((s, m) => s + (Number(m.orders_cancelled) || 0), 0))}
                            </td>
                            <td className="text-center">
                              {filteredTeamList.reduce((s, m) => s + (Number(m.followups_completed) || 0), 0)} / {filteredTeamList.reduce((s, m) => s + (Number(m.followups_total) || 0), 0)}
                            </td>
                            <td className="text-center">
                              {filteredTeamList.reduce((s, m) => s + (Number(m.tasks_done) || 0), 0)} / {filteredTeamList.reduce((s, m) => s + (Number(m.tasks_total) || 0), 0)}
                            </td>
                            <td className="text-center text-xs text-slate-500 font-semibold">
                              Aggregated
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
