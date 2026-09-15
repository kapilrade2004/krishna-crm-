'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Modal, PageLoader, Select } from '@/components/ui';
import {
  Settings, Database, Users, ShoppingCart, UserCheck, Shield, Trash2, AlertTriangle,
  BarChart2, Phone, ClipboardList, ShieldCheck, Server, RefreshCw, Download, Globe,
  Bell, Lock, Building2, Palette, FileText, HardDrive,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth';
import Link from 'next/link';

// ── Stat Box ──────────────────────────────────────────────────────────────────
function StatBox({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-border rounded-lg">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-navy leading-tight">{value}</p>
        <p className="text-[11px] text-muted truncate">{label}</p>
      </div>
    </div>
  );
}

// ── Settings Section Card ─────────────────────────────────────────────────────
function SettingsSection({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border/60">
        <div className="w-9 h-9 rounded-lg bg-navy/5 flex items-center justify-center text-navy shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-navy">{title}</h3>
          <p className="text-xs text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Individual Setting Row ────────────────────────────────────────────────────
function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-navy">{label}</p>
        {description && <p className="text-[11px] text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── Inline Toggle ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 cursor-pointer ${
        checked ? 'bg-navy' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'left-5' : 'left-0.5'
        }`}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // System stats
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Reset CRM
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Toggleable settings (client-side only for now)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [auditLogging, setAuditLogging] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/settings/stats');
        setStats(data.data);
      } catch {
        // Fail silently — stats are informational
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  // Reset CRM Action
  const handleResetCRM = async () => {
    const text = (resetConfirmText || '').trim().toUpperCase();
    if (text !== 'RESET CRM' && text !== 'RESET CRM DATA') {
      toast.error('You must type "RESET CRM" exactly to confirm.');
      return;
    }
    setIsResetting(true);
    try {
      await api.post('/settings/reset-crm', {
        confirmation_phrase: text,
        confirmation_text: text,
      });
      toast.success('CRM has been reset successfully. All business data purged.');
      setIsResetModalOpen(false);
      setResetConfirmText('');
      // Refresh stats
      const { data } = await api.get('/settings/stats');
      setStats(data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reset CRM.');
    } finally {
      setIsResetting(false);
    }
  };

  // ── WhatsApp Emergency Kill Switch State ─────────────────────────────────────
  const [waSendingStatus, setWaSendingStatus] = useState<{
    enabled: boolean;
    status: 'ACTIVE' | 'PAUSED';
    message: string;
    updated_at?: string | null;
    updated_by?: string | null;
    reason?: string | null;
    outbox_counts?: { pending: number; processing: number; paused: number; sent: number; failed: number };
    log_counts?: { queued: number; paused: number; sent: number; delivered: number; read: number; failed: number };
  } | null>(null);
  const [loadingWaStatus, setLoadingWaStatus] = useState(true);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [isTogglingWa, setIsTogglingWa] = useState(false);

  const fetchWaStatus = async () => {
    try {
      const { data } = await api.get('/whatsapp/sending-status');
      if (data?.data) {
        setWaSendingStatus(data.data);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoadingWaStatus(false);
    }
  };

  useEffect(() => {
    fetchWaStatus();
  }, []);

  const handleToggleWhatsApp = async (shouldPause: boolean) => {
    setIsTogglingWa(true);
    try {
      if (shouldPause) {
        await api.post('/whatsapp/emergency-pause', { reason: pauseReason || 'Manual pause from settings dashboard' });
        toast.success('WhatsApp sending has been globally PAUSED.');
        setIsPauseModalOpen(false);
        setPauseReason('');
      } else {
        await api.post('/whatsapp/emergency-resume', { reason: 'Resumed from settings dashboard' });
        toast.success('WhatsApp sending has been RESUMED.');
      }
      await fetchWaStatus();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update WhatsApp sending state.');
    } finally {
      setIsTogglingWa(false);
    }
  };

  // Seed Demo Data Action
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedCRM = async () => {
    setIsSeeding(true);
    try {
      await api.post('/settings/seed-crm');
      toast.success('Static sample data populated across all CRM modules!');
      // Refresh stats
      const { data } = await api.get('/settings/stats');
      setStats(data.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to seed CRM data.');
    } finally {
      setIsSeeding(false);
    }
  };

  if (loadingStats) {
    return <AppShell><Topbar title="Settings" subtitle="System configuration & administration" /><main className="flex-1 overflow-y-auto p-6"><PageLoader /></main></AppShell>;
  }

  return (
    <AppShell>
      <Topbar title="Settings" subtitle="System configuration & administration" />
      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* System Overview Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox icon={<Users size={16} />} label="Total Users" value={stats.totalUsers} color="bg-navy/10 text-navy" />
            <StatBox icon={<ShoppingCart size={16} />} label="Total Orders" value={stats.totalOrders} color="bg-blue-100 text-blue-600" />
            <StatBox icon={<UserCheck size={16} />} label="Total Customers" value={stats.totalCustomers} color="bg-teal-100 text-teal-600" />
            <StatBox icon={<Shield size={16} />} label="Active Warranties" value={stats.totalWarranties} color="bg-purple-100 text-purple-600" />
            <StatBox icon={<ClipboardList size={16} />} label="Tasks" value={stats.totalTasks} color="bg-amber-100 text-amber-700" />
            <StatBox icon={<Phone size={16} />} label="Call Logs" value={stats.totalCallLogs} color="bg-green-100 text-green-600" />
            {/* <StatBox icon={<BarChart2 size={16} />} label="Follow-Ups" value={stats.totalFollowUps} color="bg-indigo-100 text-indigo-600" /> */}
            <StatBox icon={<Building2 size={16} />} label="Employees" value={stats.totalEmployees} color="bg-pink-100 text-pink-600" />
          </div>
        )}

        {/* Global WhatsApp Emergency Kill Switch Banner & Card */}
        <div className={`p-5 rounded-xl border transition-all ${
          waSendingStatus?.enabled === false
            ? 'bg-red-50/90 border-red-300 shadow-sm'
            : 'bg-white border-border shadow-xs'
        }`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                waSendingStatus?.enabled === false
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-green-100 text-green-700'
              }`}>
                {waSendingStatus?.enabled === false ? <AlertTriangle size={22} /> : <Phone size={22} />}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-navy">WhatsApp Master Sending Switch</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase ${
                    waSendingStatus?.enabled === false
                      ? 'bg-red-600 text-white'
                      : 'bg-green-600 text-white'
                  }`}>
                    {waSendingStatus?.status || (waSendingStatus?.enabled ? 'ACTIVE' : 'PAUSED')}
                  </span>
                </div>
                <p className={`text-xs mt-1 font-medium ${
                  waSendingStatus?.enabled === false ? 'text-red-700 font-semibold' : 'text-muted'
                }`}>
                  {waSendingStatus?.enabled === false
                    ? '🛑 WhatsApp sending is globally paused. No new WhatsApp messages will be sent to Meta or SMS gateways.'
                    : 'WhatsApp sending is active across all order verifications, automated notifications, and workers.'}
                </p>
                {waSendingStatus?.reason && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Reason: <span className="italic">{waSendingStatus.reason}</span> (Updated by: {waSendingStatus.updated_by || 'system'})
                  </p>
                )}
                {waSendingStatus?.outbox_counts && (
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-600">
                    <span>Pending Outbox: <strong>{waSendingStatus.outbox_counts.pending}</strong></span>
                    <span>•</span>
                    <span>Paused Outbox: <strong>{waSendingStatus.outbox_counts.paused}</strong></span>
                    <span>•</span>
                    <span>Failed Outbox: <strong>{waSendingStatus.outbox_counts.failed}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="shrink-0 flex items-center gap-2">
                {waSendingStatus?.enabled === false ? (
                  <Button
                    variant="primary"
                    className="bg-green-600 hover:bg-green-700 text-white text-xs h-9 px-4 font-semibold"
                    loading={isTogglingWa}
                    onClick={() => handleToggleWhatsApp(false)}
                  >
                    Resume WhatsApp Sending
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 px-4 font-semibold"
                    loading={isTogglingWa}
                    onClick={() => setIsPauseModalOpen(true)}
                  >
                    EMERGENCY PAUSE WHATSAPP
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* General */}
          <SettingsSection
            icon={<Settings size={16} />}
            title="General"
            description="Basic CRM configuration and preferences"
          >
            <SettingRow label="Company Name" description="Displayed in headers and reports">
              <Input defaultValue="Khrisha Enterprises" className="w-48 text-xs h-8" />
            </SettingRow>
            <SettingRow label="Timezone" description="Used for date/time display across the CRM">
              <Select
                size="sm"
                defaultValue="Asia/Kolkata (IST)"
                options={[
                  { value: 'Asia/Kolkata (IST)', label: 'Asia/Kolkata (IST)' },
                  { value: 'UTC', label: 'UTC' },
                  { value: 'America/New_York', label: 'America/New_York' },
                  { value: 'Europe/London', label: 'Europe/London' },
                ]}
                className="w-48"
              />
            </SettingRow>
            <SettingRow label="Default Currency" description="Currency symbol for amounts">
              <Select
                size="sm"
                defaultValue="₹ INR"
                options={[
                  { value: '₹ INR', label: '₹ INR' },
                  { value: '$ USD', label: '$ USD' },
                  { value: '€ EUR', label: '€ EUR' },
                  { value: '£ GBP', label: '£ GBP' },
                ]}
                className="w-32"
              />
            </SettingRow>
            <SettingRow label="Date Format" description="Format used across the CRM interface">
              <Select
                size="sm"
                defaultValue="DD MMM YYYY"
                options={[
                  { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                ]}
                className="w-44"
              />
            </SettingRow>
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection
            icon={<Bell size={16} />}
            title="Notifications"
            description="Configure how alerts and notifications are delivered"
          >
            <SettingRow label="Email Notifications" description="Send email alerts for order updates, follow-ups, and tasks">
              <Toggle checked={emailNotifications} onChange={setEmailNotifications} />
            </SettingRow>
            <SettingRow label="WhatsApp Notifications" description="Send WhatsApp messages for order confirmations and reminders">
              <Toggle checked={whatsappNotifications} onChange={setWhatsappNotifications} />
            </SettingRow>
            <SettingRow label="Task Reminders" description="Daily task digest notifications for assigned staff">
              <Toggle checked={true} onChange={() => {}} />
            </SettingRow>
            <SettingRow label="Low Stock Alerts" description="Notify when product stock levels are low">
              <Toggle checked={false} onChange={() => {}} />
            </SettingRow>
          </SettingsSection>

          {/* Orders & Workflow */}
          <SettingsSection
            icon={<ShoppingCart size={16} />}
            title="Orders & Workflow"
            description="Order processing, assignment, and flow settings"
          >
            <SettingRow label="Auto-Assign Orders" description="Automatically assign incoming orders to available staff in a round-robin pattern">
              <Toggle checked={autoAssign} onChange={setAutoAssign} />
            </SettingRow>
            <SettingRow label="Require Image Verification" description="Orders must pass image verification before confirmation">
              <Toggle checked={true} onChange={() => {}} />
            </SettingRow>
            <SettingRow label="Default Order Flow" description="Initial flow stage for new orders">
              <Select
                size="sm"
                defaultValue="Ask Images"
                options={[
                  { value: 'Ask Images', label: 'Ask Images' },
                  { value: 'Negotiation', label: 'Negotiation' },
                  { value: 'Skip to Processing', label: 'Skip to Processing' },
                ]}
                className="w-44"
              />
            </SettingRow>
            <SettingRow label="Orders Per Page" description="Default pagination for order listings">
              <Select
                size="sm"
                defaultValue="20"
                options={[
                  { value: '20', label: '20 / page' },
                  { value: '50', label: '50 / page' },
                  { value: '100', label: '100 / page' },
                ]}
                className="w-28"
              />
            </SettingRow>
          </SettingsSection>

          {/* Security */}
          <SettingsSection
            icon={<Lock size={16} />}
            title="Security"
            description="Authentication, access control, and audit settings"
          >
            <SettingRow label="Two-Factor Authentication" description="Require 2FA for admin and manager accounts">
              <Toggle checked={twoFactor} onChange={setTwoFactor} />
            </SettingRow>
            <SettingRow label="Session Timeout" description="Auto-logout inactive users after this duration">
              <Select
                size="sm"
                defaultValue="2 hours"
                options={[
                  { value: '30 minutes', label: '30 minutes' },
                  { value: '1 hour', label: '1 hour' },
                  { value: '2 hours', label: '2 hours' },
                  { value: '4 hours', label: '4 hours' },
                  { value: '8 hours', label: '8 hours' },
                ]}
                className="w-36"
              />
            </SettingRow>
            <SettingRow label="Audit Logging" description="Log all user actions for compliance and traceability">
              <Toggle checked={auditLogging} onChange={setAuditLogging} />
            </SettingRow>
            <SettingRow label="Password Policy" description="Minimum requirements for user passwords">
              <Select
                size="sm"
                defaultValue="Strong (8+ chars)"
                options={[
                  { value: 'Strong (8+ chars)', label: 'Strong (8+ chars)' },
                  { value: 'Medium (6+ chars)', label: 'Medium (6+ chars)' },
                  { value: 'Basic (4+ chars)', label: 'Basic (4+ chars)' },
                ]}
                className="w-44"
              />
            </SettingRow>
          </SettingsSection>

          {/* Quick Links */}
          <SettingsSection
            icon={<Globe size={16} />}
            title="Quick Links"
            description="Navigate to related configuration pages"
          >
            <div className="grid grid-cols-1 gap-2">
              <Link href="/settings/users" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface hover:border-navy/20 transition-all group cursor-pointer">
                <div className="w-8 h-8 rounded-md bg-navy/5 flex items-center justify-center text-navy group-hover:bg-navy group-hover:text-white transition-colors">
                  <Users size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-navy">Users & Rights Management</p>
                  <p className="text-[11px] text-muted">Manage user accounts, roles, and permissions</p>
                </div>
              </Link>
              <Link href="/hr" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface hover:border-navy/20 transition-all group cursor-pointer">
                <div className="w-8 h-8 rounded-md bg-navy/5 flex items-center justify-center text-navy group-hover:bg-navy group-hover:text-white transition-colors">
                  <Building2 size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-navy">HR & Employee Management</p>
                  <p className="text-[11px] text-muted">Employee directory, payroll, and policies</p>
                </div>
              </Link>
              <Link href="/reports" className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface hover:border-navy/20 transition-all group cursor-pointer">
                <div className="w-8 h-8 rounded-md bg-navy/5 flex items-center justify-center text-navy group-hover:bg-navy group-hover:text-white transition-colors">
                  <BarChart2 size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-navy">Reports & Analytics</p>
                  <p className="text-[11px] text-muted">Sales reports, performance metrics, and insights</p>
                </div>
              </Link>
            </div>
          </SettingsSection>

          {/* Danger Zone */}
          {isAdmin && (
            <SettingsSection
              icon={<AlertTriangle size={16} />}
              title="Danger Zone"
              description="Destructive actions — cannot be undone"
            >
              <div className="space-y-4">
                {/* Seed Static Demo Data */}
                <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Database size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-blue-800">Seed Static & Connected CRM Data</h4>
                    <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                      Populate realistic, interconnected test records across all modules (Customers, Orders with SKUs, Warranties, Daily Tasks, Employees, Payroll, and Shipping) seamlessly linked to the website warranty registration workflow.
                    </p>
                    <Button
                      variant="primary"
                      icon={<Database size={14} />}
                      onClick={handleSeedCRM}
                      loading={isSeeding}
                      className="mt-3"
                    >
                      Seed Static CRM Data
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 size={18} className="text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-red-800">Reset Entire CRM</h4>
                    <p className="text-xs text-red-600 mt-1 leading-relaxed">
                      This will permanently delete <strong>ALL business data</strong> including orders, customers, 
                      employees, tasks, follow-ups, call logs, warranties, and audit records.
                      <strong> User accounts will be preserved.</strong> This action cannot be undone.
                    </p>
                    <Button
                      variant="danger"
                      icon={<RefreshCw size={14} />}
                      onClick={() => setIsResetModalOpen(true)}
                      className="mt-3"
                    >
                      Reset CRM
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <Download size={18} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-amber-800">Export System Backup</h4>
                    <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                      Download a full database backup before performing destructive actions.
                      It is strongly recommended to export before resetting.
                    </p>
                    <Button
                      variant="secondary"
                      icon={<HardDrive size={14} />}
                      className="mt-3"
                      onClick={() => toast('Database export coming soon.', { icon: '🔜' })}
                    >
                      Export Backup
                    </Button>
                  </div>
                </div>
              </div>
            </SettingsSection>
          )}
        </div>
      </main>

      {/* Reset CRM Confirmation Modal */}
      {isResetModalOpen && (
        <Modal open={isResetModalOpen} onClose={() => { setIsResetModalOpen(false); setResetConfirmText(''); }} title="⚠️ Reset Entire CRM">
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 leading-relaxed space-y-2">
                <p>
                  You are about to <strong>permanently delete ALL business data</strong> from the CRM.
                  This includes:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>All orders, order activities, and customer images</li>
                  <li>All customers and their records</li>
                  <li>All employees and employee documents</li>
                  <li>All tasks, daily tasks, and task histories</li>
                  <li>All follow-ups and call logs</li>
                  <li>All warranties and service requests</li>
                  <li>All audit events and summaries</li>
                  <li>All CSV import batches and WhatsApp logs</li>
                </ul>
                <p className="font-bold">User accounts will NOT be deleted.</p>
                <p>This action <strong>CANNOT</strong> be undone.</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1.5">
                Type <code className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono text-[11px]">RESET CRM</code> to confirm:
              </label>
              <Input
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                placeholder="RESET CRM"
                className="font-mono text-sm"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => { setIsResetModalOpen(false); setResetConfirmText(''); }} disabled={isResetting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={isResetting}
                disabled={!['RESET CRM', 'RESET CRM DATA'].includes((resetConfirmText || '').trim().toUpperCase())}
                onClick={handleResetCRM}
                icon={<Trash2 size={14} />}
              >
                Permanently Reset CRM
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Emergency Pause Confirmation Modal */}
      {isPauseModalOpen && (
        <Modal
          open={isPauseModalOpen}
          onClose={() => { setIsPauseModalOpen(false); setPauseReason(''); }}
          title="🛑 Confirm Emergency WhatsApp Pause"
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={22} className="text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 leading-relaxed space-y-2">
                <p className="font-bold text-sm text-red-800">Are you sure?</p>
                <p>
                  This will <strong>immediately prevent all new WhatsApp messages</strong> from being sent across all CRM modules, background queues, and automated workflows.
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Active queue consumers will immediately stop dispatching messages to Meta.</li>
                  <li>Order verification, confirmation, and warranty automations will be held.</li>
                  <li>Pending queue items will be safely preserved in a <strong>PAUSED</strong> state.</li>
                  <li>No message records or customer data will be deleted.</li>
                </ul>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Reason for Pause (Optional - recorded in audit log):
              </label>
              <Input
                value={pauseReason}
                onChange={e => setPauseReason(e.target.value)}
                placeholder="e.g. Gateway balance low / Template audit / Emergency testing"
                className="text-xs h-9"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="secondary"
                onClick={() => { setIsPauseModalOpen(false); setPauseReason(''); }}
                disabled={isTogglingWa}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={isTogglingWa}
                onClick={() => handleToggleWhatsApp(true)}
              >
                Confirm Emergency Pause
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
