'use strict';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Truck, CheckCircle, Clock, IndianRupee, ArrowRight, MapPin, Phone } from 'lucide-react';
import { KpiCard, Badge, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';

export default function DeliveryBoyDashboard({ user }: { user: any }) {
  const [deliveryStats, setDeliveryStats] = useState<any>({
    totalAssigned: 12,
    pendingDeliveries: 4,
    deliveredCount: 8,
  });
  const [chequeStats, setChequeStats] = useState<any>({
    totalCount: 3,
    totalCollected: 43500,
    pendingOfficeSubmission: 2,
  });

  useEffect(() => {
    api.get('/delivery/run-sheet')
      .then(res => {
        if (res.data?.data?.stats) setDeliveryStats(res.data.data.stats);
      })
      .catch(() => {});

    api.get('/delivery/cheques')
      .then(res => {
        if (res.data?.data?.stats) setChequeStats(res.data.data.stats);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Delivery Boy Mandate Banner */}
      <div className="bg-gradient-to-r from-lime-800 via-emerald-800 to-navy text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-lime-200 text-xs font-semibold uppercase tracking-wider mb-1">
              <Truck size={16} className="text-amber" />
              <span>Field Operations & Delivery — Manoj</span>
            </div>
            <h2 className="text-xl font-bold">Today&apos;s Delivery Run-Sheet & Cheque Collections</h2>
            <p className="text-sm text-lime-100 mt-1">
              Deliver assigned parcels on schedule, record recipient confirmation, collect scheduled customer cheques, and hand over to office.
            </p>
          </div>
          <Link href="/field-ops">
            <button className="bg-amber text-navy font-bold px-4 py-2.5 rounded-xl hover:bg-amber-400 text-xs transition shadow-sm">
              Open Delivery Run-Sheet
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Today's Assigned Deliveries"
          value={deliveryStats.totalAssigned}
          icon={Truck}
          subtext={`${deliveryStats.deliveredCount} Delivered, ${deliveryStats.pendingDeliveries} Pending`}
        />
        <KpiCard
          label="Delivered Today"
          value={deliveryStats.deliveredCount}
          icon={CheckCircle}
          subtext="On-time delivery rate 100%"
        />
        <KpiCard
          label="Cheques Collected"
          value={formatCurrency(chequeStats.totalCollected)}
          icon={IndianRupee}
          subtext={`${chequeStats.totalCount} cheques logged`}
        />
        <KpiCard
          label="Cheques to Submit to Office"
          value={chequeStats.pendingOfficeSubmission}
          icon={Clock}
          subtext="Handover to Riya / Sanjay"
        />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 border-l-4 border-lime-500">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-navy text-sm">Delivery Run-Sheet</h4>
              <p className="text-xs text-muted mt-0.5">View addresses, customer phones, and mark parcel delivered.</p>
            </div>
            <Link href="/field-ops">
              <Button variant="primary" size="sm">
                <span>View Run-Sheet</span>
                <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-navy text-sm">Log New Cheque Collection</h4>
              <p className="text-xs text-muted mt-0.5">Enter cheque number, bank, amount and photo proof on the field.</p>
            </div>
            <Link href="/field-ops">
              <Button variant="secondary" size="sm">
                <span>Log Cheque</span>
                <IndianRupee size={14} className="ml-1.5 text-emerald-600" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
