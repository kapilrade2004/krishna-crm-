'use strict';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Clock, RotateCcw, AlertTriangle, ArrowRight, ShieldCheck, CheckCircle, Package } from 'lucide-react';
import { KpiCard, Badge, Button } from '@/components/ui';
import api from '@/lib/api';

export default function EcommerceExecutiveDashboard({ user }: { user: any }) {
  const [cutoffData, setCutoffData] = useState<any>({
    orders: [],
    timing: { isPastCutoff: false, isPastScreenshotTime: false },
    stats: { pendingProcessingCount: 24, amazonOrders: 16, flipkartOrders: 6, directOrders: 2 },
  });
  const [returnStats, setReturnStats] = useState<any>({
    totalReturns: 14,
    totalGood: 9,
    totalDamage: 5,
    pendingPutaway: 3,
    pendingClaims: 2,
  });

  useEffect(() => {
    api.get('/ecommerce-ops/cutoff-orders')
      .then(res => {
        if (res.data?.data) setCutoffData(res.data.data);
      })
      .catch(() => {});

    api.get('/ecommerce-ops/returns')
      .then(res => {
        if (res.data?.data?.stats) setReturnStats(res.data.data.stats);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* 1:20 PM Cutoff Mandate Banner */}
      <div className="bg-gradient-to-r from-fuchsia-900 via-purple-900 to-navy text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-fuchsia-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Clock size={16} className="text-amber" />
              <span>E-Commerce Operations — Priya, Shruti & Faijal</span>
            </div>
            <h2 className="text-xl font-bold">Channel Order Processing (1:20 PM Cutoff Mandate)</h2>
            <p className="text-sm text-fuchsia-100 mt-1">
              Process all channel orders arriving after 1:20 PM cutoff. Upload morning screenshot & final 1:59 PM verification screenshot.
            </p>
          </div>
          <Link href="/ecommerce-ops">
            <button className="bg-amber text-navy font-bold px-4 py-2.5 rounded-xl hover:bg-amber-400 text-xs transition shadow-sm">
              Open E-Com Operations
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Pending Cutoff Orders"
          value={cutoffData.stats.pendingProcessingCount}
          icon={Package}
          subtext={`${cutoffData.stats.amazonOrders} Amazon, ${cutoffData.stats.flipkartOrders} Flipkart`}
        />
        <KpiCard
          label="Amazon Returns Tracked"
          value={returnStats.totalReturns}
          icon={RotateCcw}
          subtext={`${returnStats.totalGood} Good / ${returnStats.totalDamage} Damaged`}
        />
        <KpiCard
          label="Pending OMS Putaway"
          value={returnStats.pendingPutaway}
          icon={Clock}
          subtext="Warehouse stock replenishment"
        />
        <KpiCard
          label="Active 60-Day Claims"
          value={returnStats.pendingClaims}
          icon={AlertTriangle}
          subtext="Marketplace reimbursement pending"
        />
      </div>

      {/* Workstation Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 border-l-4 border-fuchsia-600">
          <h4 className="font-bold text-navy text-sm">Channel Order Cutoff</h4>
          <p className="text-xs text-muted mt-1">Check orders arriving after 1:20 PM and generate manifests.</p>
          <div className="mt-4">
            <Link href="/ecommerce-ops">
              <Button variant="primary" size="sm" className="w-full justify-center">
                <span>Process Orders</span>
                <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-amber">
          <h4 className="font-bold text-navy text-sm">Returns Entry & Calling</h4>
          <p className="text-xs text-muted mt-1">Shruti&apos;s desk: log Amazon return box, call customer, record condition.</p>
          <div className="mt-4">
            <Link href="/ecommerce-ops">
              <Button variant="secondary" size="sm" className="w-full justify-center">
                <span>Log Returns</span>
                <RotateCcw size={14} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-emerald-600">
          <h4 className="font-bold text-navy text-sm">FBA Shipments & FC Files</h4>
          <p className="text-xs text-muted mt-1">Priya&apos;s desk: FBA packing slips, box labels, and inventory replenishments.</p>
          <div className="mt-4">
            <Link href="/ecommerce-ops">
              <Button variant="secondary" size="sm" className="w-full justify-center">
                <span>View FBA Shipments</span>
                <Package size={14} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
