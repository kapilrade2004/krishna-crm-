'use strict';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calculator, IndianRupee, FileText, CheckSquare, AlertTriangle, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { KpiCard, Badge, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

export default function AccountantDashboard({ user }: { user: any }) {
  const [stats, setStats] = useState<any>({
    tallyVouchersEntered: 18,
    stockDiscrepanciesCount: 2,
    mybillbookTotalInvoiced: 214500,
    pendingChequesCount: 3,
    pendingChequesAmount: 55500,
    dsrStatus: 'Filed',
  });
  const [pendingCheques, setPendingCheques] = useState<any[]>([]);

  useEffect(() => {
    api.get('/accounting/cheques?status=submitted_to_office')
      .then(res => {
        if (res.data?.data?.cheques) {
          setPendingCheques(res.data.data.cheques);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Accountant Mandate Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-navy text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Calculator size={16} className="text-amber" />
              <span>Accounting Command Desk — Sanjay & Riya</span>
            </div>
            <h2 className="text-xl font-bold">Tally Vouchers, Stock Audit & Cheque Verification</h2>
            <p className="text-sm text-emerald-100 mt-1">
              Maintain daily stock in/out in Tally, reconcile MyBillBook invoicing, verify Manoj&apos;s collected cheques, and file company DSR.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/accounting">
              <button className="bg-amber text-navy font-bold px-4 py-2.5 rounded-xl hover:bg-amber-400 text-xs transition shadow-sm">
                Open Accounting Desk
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Tally Entries Logged"
          value={stats.tallyVouchersEntered}
          icon={Calculator}
          subtext="Inward, outward & purchase"
        />
        <KpiCard
          label="MyBillBook Billing Today"
          value={formatCurrency(stats.mybillbookTotalInvoiced)}
          icon={IndianRupee}
          subtext="Invoices & E-way bills synced"
        />
        <KpiCard
          label="Cheques Awaiting Office Check"
          value={stats.pendingChequesCount}
          icon={Clock}
          subtext={formatCurrency(stats.pendingChequesAmount)}
        />
        <KpiCard
          label="Stock Audit Mismatches"
          value={stats.stockDiscrepanciesCount}
          icon={AlertTriangle}
          subtext="Physical vs book stock alerts"
        />
      </div>

      {/* Cheque Verification Queue */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-navy">Cheques Handed Over by Delivery Boy (Manoj)</h3>
            <p className="text-xs text-muted">Verify cheque numbers, customer signatures and bank names before banking deposit</p>
          </div>
          <Link href="/accounting">
            <Button variant="secondary" size="sm">
              <span>View All Cheques</span>
              <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Customer / Firm</th>
                <th className="py-2.5 px-3">Cheque #</th>
                <th className="py-2.5 px-3">Bank</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Handover Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingCheques.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No pending cheques waiting for office verification.
                  </td>
                </tr>
              ) : (
                pendingCheques.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{c.customer_name}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{c.cheque_number}</td>
                    <td className="py-2.5 px-3 text-slate-600">{c.bank_name}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-700">{formatCurrency(c.amount)}</td>
                    <td className="py-2.5 px-3">
                      <Badge colour="amber">Submitted to Office</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link href="/accounting">
                        <span className="text-emerald-700 hover:underline font-semibold cursor-pointer">Verify & Deposit</span>
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
