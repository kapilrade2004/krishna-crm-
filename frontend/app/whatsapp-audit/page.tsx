'use client';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import WhatsAppAuditDashboard from '@/components/dashboards/WhatsAppAuditDashboard';

export default function WhatsAppAuditPage() {
  return (
    <AppShell>
      <Topbar
        title="WhatsApp Production Audit & Cost"
        subtitle="Authoritative message status tracking, billing reconciliation, delivery rates & failure diagnostics"
      />
      <main className="flex-1 overflow-y-auto p-6">
        <WhatsAppAuditDashboard />
      </main>
    </AppShell>
  );
}
