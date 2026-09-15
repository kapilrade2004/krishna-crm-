'use client';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { useCeoView, useDashboardKpis } from '@/hooks/useApi';
import { PageLoader, Badge, KpiCard } from '@/components/ui';
import { formatCurrency, formatNumber, fmtDate, ORDER_STATUS_COLOURS, MARKETPLACE_COLOURS } from '@/lib/utils';
import { Crown, TrendingUp, IndianRupee, Users, Award, ShoppingBag } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = ['#E8A020', '#1A8F7A', '#2A3F5F', '#5A7598', '#FBCA6A', '#80D6C6'];

export default function CeoViewPage() {
  const { data: ceo, isLoading } = useCeoView();
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();

  if (isLoading || kpisLoading || !ceo || !kpis) {
    return <AppShell><Topbar title="CEO View" subtitle="Executive business pulse" /><PageLoader /></AppShell>;
  }

  const { topCustomers, recentOrders, teamPerformance, marketplaceBreakdown } = ceo;

  return (
    <AppShell>
      <Topbar title="CEO View" subtitle="Real-time business pulse across orders, revenue, and team" />
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Revenue This Month"
            value={formatCurrency(kpis.revenue.thisMonth)}
            icon={<IndianRupee size={16} />}
            trend={kpis.revenue.growthPercent !== null ? { value: kpis.revenue.growthPercent } : undefined}
            sub={`vs ${formatCurrency(kpis.revenue.lastMonth)} last month`}
          />
          <KpiCard label="Active Customers" value={formatNumber(kpis.customers.active)} icon={<Users size={16} />} sub={`+${kpis.customers.newThisMonth} new`} />
          <KpiCard label="Orders Today" value={formatNumber(kpis.orders.today)} icon={<ShoppingBag size={16} />} />
          <KpiCard label="Pending Dispatch" value={formatNumber(kpis.orders.pendingDispatch)} icon={<TrendingUp size={16} />} sub={kpis.orders.overdueDispatch > 0 ? `${kpis.orders.overdueDispatch} overdue` : undefined} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top customers */}
          <div className="card">
            <div className="card-header">
              <p className="card-title flex items-center gap-1.5"><Award size={14} className="text-amber-500" /> Top Customers</p>
            </div>
            <div className="space-y-3">
              {topCustomers.map((c: Record<string, unknown>, i: number) => (
                <Link key={String(c.id)} href={`/customers/${c.id}`} className="flex items-center justify-between hover:bg-surface -mx-2 px-2 py-1.5 rounded-md transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-amber/10 flex items-center justify-center text-amber-700 text-xs font-semibold flex-shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy">{String(c.name)}</p>
                      <p className="text-[11px] text-muted">{Number(c.total_orders)} orders · {String(c.source)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-navy">{formatCurrency(Number(c.total_revenue))}</span>
                </Link>
              ))}
              {topCustomers.length === 0 && <p className="text-sm text-muted text-center py-4">No customer data yet.</p>}
            </div>
          </div>

          {/* Marketplace breakdown */}
          <div className="card">
            <div className="card-header">
              <p className="card-title">Marketplace Revenue (This Month)</p>
            </div>
            {marketplaceBreakdown.length === 0 ? (
              <p className="text-sm text-muted text-center py-12">No orders this month yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={marketplaceBreakdown}
                    dataKey="revenue"
                    nameKey="marketplace"
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={2}
                  >
                    {marketplaceBreakdown.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Team performance */}
          <div className="card">
            <div className="card-header">
              <p className="card-title flex items-center gap-1.5"><Crown size={14} className="text-amber-500" /> Team This Month</p>
            </div>
            <div className="space-y-3">
              {teamPerformance.slice(0, 6).map((m: Record<string, unknown>) => (
                <div key={String(m.id)} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-navy">{String(m.name)}</p>
                    <p className="text-[11px] text-muted capitalize">{String(m.role)} · {Number(m.delivered)} delivered</p>
                  </div>
                  <span className="text-sm font-semibold text-navy">{formatCurrency(Number(m.total_value) || 0)}</span>
                </div>
              ))}
              {teamPerformance.length === 0 && <p className="text-sm text-muted text-center py-4">No team activity yet.</p>}
            </div>
          </div>
        </div>

        {/* Recent orders */}
        <div className="card p-0 overflow-hidden">
          <div className="card-header px-4 pt-4">
            <p className="card-title">Latest Orders</p>
            <Link href="/orders" className="text-xs text-amber-600 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Marketplace</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o: Record<string, unknown>) => (
                  <tr key={String(o.id)} className="cursor-pointer">
                    <td>
                      <Link href={`/orders/${o.id}`} className="text-navy font-medium hover:text-amber-600 transition-colors">
                        {String(o.order_number)}
                      </Link>
                    </td>
                    <td>{(o.customer as Record<string, unknown> | undefined)?.name as string || '—'}</td>
                    <td><Badge label={String(o.marketplace)} colorClass={MARKETPLACE_COLOURS[String(o.marketplace)]} /></td>
                    <td className="font-medium">{o.total_amount ? formatCurrency(Number(o.total_amount)) : '—'}</td>
                    <td><Badge label={String(o.status)} colorClass={ORDER_STATUS_COLOURS[String(o.status)]} /></td>
                    <td className="text-xs text-muted">{fmtDate(String(o.order_date || o.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
