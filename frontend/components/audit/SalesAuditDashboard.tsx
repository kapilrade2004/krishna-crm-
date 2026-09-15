'use client';

import React from 'react';
import { UserCheck, PhoneCall, ShoppingCart, IndianRupee, CheckSquare, CalendarCheck, TrendingUp, Users } from 'lucide-react';

interface SalesAuditDashboardProps {
  auditData: {
    attendance: {
      applicable_working_days: number;
      present_days: number;
      absent_days: number;
      leave_days: number;
      half_days: number;
      late_days: number;
      attendance_percentage: number;
    };
    sales: {
      leads_received: number;
      leads_contacted: number;
      qualified_leads: number;
      orders_created: number;
      orders_completed: number;
      orders_cancelled: number;
      units_sold: number;
      revenue: number;
      average_order_value: number;
      conversion_rate: number;
    };
    customer_activity: {
      new_customers: number;
      customers_contacted: number;
      customer_interactions: number;
      calls: number;
      meetings: number;
      followups_created: number;
      followups_completed: number;
    };
    tasks: {
      assigned: number;
      completed: number;
      pending: number;
      overdue: number;
    };
    daily_tasks: {
      assigned: number;
      completed: number;
      pending: number;
      overdue: number;
    };
  };
}

export default function SalesAuditDashboard({ auditData }: SalesAuditDashboardProps) {
  const { attendance, sales, customer_activity, tasks, daily_tasks } = auditData;

  return (
    <div className="space-y-6">
      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Attendance</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              {attendance.present_days} <span className="text-sm font-normal text-muted">/ {attendance.applicable_working_days} Days</span>
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Attendance Rate</span>
              <span className="font-bold text-emerald-600">{attendance.attendance_percentage}%</span>
            </div>
          </div>
        </div>

        {/* Customer Interactions KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Interactions</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <PhoneCall size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              {customer_activity.customer_interactions}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Calls & Followups</span>
              <span className="font-semibold text-blue-600">{customer_activity.calls} Calls logged</span>
            </div>
          </div>
        </div>

        {/* Orders KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Orders</span>
            <div className="w-9 h-9 rounded-lg bg-amber/20 text-amber-700 flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              {sales.orders_completed} <span className="text-sm font-normal text-muted">({sales.units_sold} units)</span>
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Conversion Rate</span>
              <span className="font-semibold text-amber-700">{sales.conversion_rate}%</span>
            </div>
          </div>
        </div>

        {/* Revenue KPI */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Revenue</span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-navy">
              ₹{sales.revenue.toLocaleString('en-IN')}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted">Avg Order Value</span>
              <span className="font-semibold text-purple-600">₹{sales.average_order_value.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Section: Sales & Customer Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer & Interaction Activity Card */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <Users className="text-amber" size={18} />
            <h3 className="text-sm font-bold text-navy">Customer & Field Activity</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-muted">New Customers Added</p>
              <p className="text-lg font-bold text-navy mt-0.5">{customer_activity.new_customers}</p>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-muted">Customers Contacted</p>
              <p className="text-lg font-bold text-navy mt-0.5">{customer_activity.customers_contacted}</p>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-muted">Phone Calls Logged</p>
              <p className="text-lg font-bold text-navy mt-0.5">{customer_activity.calls}</p>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-muted">Meetings / Visits</p>
              <p className="text-lg font-bold text-navy mt-0.5">{customer_activity.meetings}</p>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-muted">Follow-ups Created</p>
              <p className="text-lg font-bold text-navy mt-0.5">{customer_activity.followups_created}</p>
            </div>

            <div className="p-3 bg-surface rounded-lg border border-border">
              <p className="text-muted">Follow-ups Completed</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">{customer_activity.followups_completed}</p>
            </div>
          </div>
        </div>

        {/* Sales & Conversion Pipeline Card */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <TrendingUp className="text-amber" size={18} />
            <h3 className="text-sm font-bold text-navy">Sales & Conversion Funnel</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
              <span className="text-navy font-medium">Leads Received</span>
              <span className="font-bold text-navy">{sales.leads_received}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
              <span className="text-navy font-medium">Leads Contacted</span>
              <span className="font-bold text-navy">{sales.leads_contacted}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-surface rounded-lg border border-border">
              <span className="text-navy font-medium">Qualified Leads</span>
              <span className="font-bold text-navy">{sales.qualified_leads}</span>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="font-medium text-emerald-800">Completed Orders</span>
              <span className="font-bold text-emerald-700">{sales.orders_completed} ({sales.conversion_rate}% Conv.)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-surface rounded border border-border text-center">
                <span className="text-muted">Total Amount:</span> <span className="font-semibold text-navy">₹{sales.revenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 bg-surface rounded border border-border text-center">
                <span className="text-muted">Cancelled Orders:</span> <span className="font-semibold text-red-500">{sales.orders_cancelled}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Section: Tasks vs Daily Tasks Separate Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Existing Tasks */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckSquare className="text-amber" size={18} />
              <h3 className="text-sm font-bold text-navy">CRM Tasks</h3>
            </div>
            <span className="text-xs text-muted">Assigned: {tasks.assigned}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 bg-surface rounded-lg border border-border">
              <p className="text-muted text-[10px] uppercase font-semibold">Assigned</p>
              <p className="text-base font-bold text-navy mt-1">{tasks.assigned}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-emerald-800 text-[10px] uppercase font-semibold">Completed</p>
              <p className="text-base font-bold text-emerald-700 mt-1">{tasks.completed}</p>
            </div>
            <div className="p-2.5 bg-amber/10 border border-amber/20 rounded-lg">
              <p className="text-amber-800 text-[10px] uppercase font-semibold">Pending</p>
              <p className="text-base font-bold text-amber-800 mt-1">{tasks.pending}</p>
            </div>
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-[10px] uppercase font-semibold">Overdue</p>
              <p className="text-base font-bold text-red-700 mt-1">{tasks.overdue}</p>
            </div>
          </div>
        </div>

        {/* Daily Tasks */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CalendarCheck className="text-amber" size={18} />
              <h3 className="text-sm font-bold text-navy">Daily Tasks</h3>
            </div>
            <span className="text-xs text-muted">Assigned: {daily_tasks.assigned}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 bg-surface rounded-lg border border-border">
              <p className="text-muted text-[10px] uppercase font-semibold">Assigned</p>
              <p className="text-base font-bold text-navy mt-1">{daily_tasks.assigned}</p>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-emerald-800 text-[10px] uppercase font-semibold">Completed</p>
              <p className="text-base font-bold text-emerald-700 mt-1">{daily_tasks.completed}</p>
            </div>
            <div className="p-2.5 bg-amber/10 border border-amber/20 rounded-lg">
              <p className="text-amber-800 text-[10px] uppercase font-semibold">Pending</p>
              <p className="text-base font-bold text-amber-800 mt-1">{daily_tasks.pending}</p>
            </div>
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-[10px] uppercase font-semibold">Overdue</p>
              <p className="text-base font-bold text-red-700 mt-1">{daily_tasks.overdue}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
