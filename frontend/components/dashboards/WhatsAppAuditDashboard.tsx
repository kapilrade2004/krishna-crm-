'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Clock,
  IndianRupee,
  RefreshCw,
  Download,
  Search,
  Filter,
  Layers,
  FileSpreadsheet,
  Info,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  XCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Gauge,
  Sliders,
  Zap,
  Check,
  RefreshCcw,
  Mail,
  FileText,
  Send,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Badge, Button, Modal, Spinner } from '@/components/ui';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

interface AuditSummary {
  period?: {
    preset: string;
    start_date_ist: string;
    end_date_ist: string;
    start_date_utc: string;
    end_date_utc: string;
    timezone: string;
  };
  date_range?: {
    preset: string;
    start_date: string;
    end_date: string;
    label: string;
  };
  metrics: {
    total_messages_processed?: number;
    total_sent: number;
    sent_awaiting_delivery: number;
    delivered?: number;
    delivered_count?: number;
    read?: number;
    read_count?: number;
    failed?: number;
    failed_count?: number;
    queued?: number;
    queued_count?: number;
    pending?: number;
    pending_count?: number;
    processing?: number;
    processing_count?: number;
    paused?: number;
    paused_count?: number;
    cancelled?: number;
    cancelled_count?: number;
    delivery_rate_pct?: number;
    delivery_rate_percent?: number;
    read_rate_pct?: number;
    read_rate_percent?: number;
    failure_rate_pct?: number;
    failure_rate_percent?: number;
    total_unique_recipients: number;
  };
  costs?: {
    estimated_cost_inr: number;
    actual_cost_inr: number | null;
    actual_cost_display: string;
    currency: string;
    per_message_rate_estimated: number;
    cost_status_note: string;
  };
  cost?: {
    estimated_rate_per_message?: number;
    total_estimated_cost?: number;
    total_actual_cost?: number | null;
    actual_cost_status?: string;
    actual_cost_note?: string;
    currency?: string;
    provider_balance?: {
      amount?: number | null;
      status?: string;
      note?: string;
    };
  };
  provider_account?: {
    provider_name: string;
    account_status: string;
    balance_amount: number | null;
    balance_currency: string | null;
    balance_display: string;
    balance_note: string;
  };
}

interface DailyRow {
  date: string;
  total_sent: number;
  delivered: number;
  read: number;
  failed: number;
  queued: number;
  paused: number;
  estimated_cost: number;
  actual_cost: number | null;
  actual_cost_display: string;
}

interface TemplateCostRow {
  template_name: string;
  category: string;
  language: string;
  total_sent: number;
  delivered: number;
  read: number;
  failed: number;
  delivery_rate_pct: number;
  read_rate_pct: number;
  estimated_cost: number;
  actual_cost: number | null;
  actual_cost_display: string;
}

interface BatchCostRow {
  id: string;
  batch_id: string;
  batch_index: number;
  total_batches: number;
  customer_count: number;
  message_count: number;
  order_range: string;
  status: string;
  sent_count: number;
  failed_count: number;
  cancelled_count: number;
  paused_count: number;
  estimated_cost: number;
  actual_cost: number | null;
  actual_cost_display: string;
  import_filename: string;
  created_at: string;
  completed_at: string | null;
}

interface MessageLogRow {
  id: string;
  wa_message_id: string | null;
  phone_number: string;
  template_name: string | null;
  message_type: string;
  status: string;
  retry_count: number;
  estimated_cost: number;
  actual_cost: number | null;
  error_message: string | null;
  created_at_ist: string;
  sent_at_ist: string;
  delivered_at_ist: string;
  read_at_ist: string;
  failed_at_ist: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    city: string | null;
  } | null;
  order: {
    id: string;
    order_number: string;
    total_amount: number | null;
  } | null;
  batch: {
    batch_id: string;
    status: string;
  } | null;
}

interface FailureAnalytics {
  total_failed_messages: number;
  category_breakdown: {
    rate_limit: number;
    invalid_phone: number;
    template_mismatch: number;
    kill_switch_paused: number;
    insufficient_credit: number;
    network_timeout: number;
    other: number;
  };
  top_errors: Array<{ error_message: string; count: number }>;
}

interface RetryAnalytics {
  total_retried_messages: number;
  recovered_after_retry: number;
  exhausted_max_retries: number;
  currently_pending_retry: number;
  recovery_rate_pct: number;
}

interface RateLimiterStatus {
  is_emergency_paused?: boolean;
  active_adapter?: string;
  limits?: {
    messages_per_minute: number;
    messages_per_hour: number;
    messages_per_day: number;
    max_concurrent_sends: number;
  };
  configured_limits?: {
    messages_per_minute: number;
    messages_per_hour: number;
    messages_per_day: number;
    max_concurrent_sends: number;
  };
  current_usage?: {
    window_seconds?: number;
    active_claims_count: number;
    approx_remaining_in_minute: number;
  };
  spend_guard?: {
    daily_spend_limit?: number;
    daily_spend_limit_inr?: number;
    today_confirmed_spend?: number;
    today_confirmed_spend_inr?: number;
    today_reserved_spend?: number;
    active_reserved_spend_inr?: number;
    total_spend_allocated_inr?: number;
    today_remaining_spend?: number;
    remaining_budget_inr?: number;
    budget_utilization_pct?: number;
    spend_utilization_pct?: number;
    is_ceiling_reached?: boolean;
    spend_ceiling_breached?: boolean;
  };
  provider_balance?: {
    status?: string;
    balance_inr?: number | null;
    display?: string;
    note?: string;
  };
  provider_throttling?: {
    is_throttled?: boolean;
    remaining_backoff_seconds?: number;
    meta_error_code?: number | null;
    cooldown_until?: string | null;
  };
}

interface RateLimitAuditEvent {
  id: string;
  event_type: string;
  batch_id: string | null;
  outbox_id: string | null;
  worker_id: string | null;
  configured_limit: number | null;
  current_usage: number | null;
  amount: number | null;
  details: any;
  created_at: string;
}

export default function WhatsAppAuditDashboard() {
  // Global Sending Status (Emergency Kill Switch State)
  const [killSwitchState, setKillSwitchState] = useState<{
    enabled: boolean;
    status: string;
    updated_at: string | null;
    actor_email: string | null;
    reason: string | null;
  } | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'daily' | 'templates' | 'batches' | 'failures' | 'messages' | 'ratelimit'>('daily');

  // Rate Limiter & Spend Guard States
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimiterStatus | null>(null);
  const [rateLimitAuditEvents, setRateLimitAuditEvents] = useState<RateLimitAuditEvent[]>([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingLimits, setEditingLimits] = useState({
    messages_per_minute: 60,
    daily_spend_limit: 50,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Filter State
  const [preset, setPreset] = useState<DatePreset>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Loading States
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Data States
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyRow[]>([]);
  const [templateCosts, setTemplateCosts] = useState<TemplateCostRow[]>([]);
  const [batchCosts, setBatchCosts] = useState<BatchCostRow[]>([]);
  const [failureAnalytics, setFailureAnalytics] = useState<FailureAnalytics | null>(null);
  const [retryAnalytics, setRetryAnalytics] = useState<RetryAnalytics | null>(null);

  // Message Log State
  const [messages, setMessages] = useState<MessageLogRow[]>([]);
  const [messagePagination, setMessagePagination] = useState({ page: 1, total: 0, totalPages: 1, limit: 20 });
  const [messageSearch, setMessageSearch] = useState('');
  const [messageStatusFilter, setMessageStatusFilter] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<MessageLogRow | null>(null);

  // Total Report State
  const [totalReportModalOpen, setTotalReportModalOpen] = useState(false);
  const [sendingReportEmail, setSendingReportEmail] = useState(false);

  const handleEmailTotalReport = async () => {
    setSendingReportEmail(true);
    try {
      const res = await api.post('/whatsapp/audit/email-report', {
        recipient: 'uidaniel69@gmail.com',
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Total report successfully emailed to uidaniel69@gmail.com');
      } else {
        toast.error(res.data?.message || 'Failed to dispatch report email');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch report email');
    } finally {
      setSendingReportEmail(false);
    }
  };

  // ── 1. Fetch Kill Switch Status ─────────────────────────────────────────────
  const fetchKillSwitchStatus = useCallback(async () => {
    try {
      const res = await api.get('/whatsapp/sending-status');
      if (res.data?.success) {
        setKillSwitchState(res.data.data);
      }
    } catch {
      // Fallback if endpoint unreachable
    }
  }, []);

  // ── 2. Fetch Summary Metrics & Rate Limit / Budget Status ───────────────────
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const params: any = { preset };
      if (preset === 'CUSTOM') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      const [summaryRes, rateRes] = await Promise.allSettled([
        api.get('/whatsapp/audit/summary', { params }),
        api.get('/whatsapp/rate-limiter/status'),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.data?.success) {
        setSummary(summaryRes.value.data.data);
      }
      if (rateRes.status === 'fulfilled' && rateRes.value.data?.success) {
        const rateData = rateRes.value.data.data;
        setRateLimitStatus(rateData);
        setEditingLimits({
          messages_per_minute: rateData.limits?.messages_per_minute || 60,
          daily_spend_limit: rateData.spend_guard?.daily_spend_limit_inr ?? 50,
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load audit summary');
    } finally {
      setLoadingSummary(false);
    }
  }, [preset, startDate, endDate]);

  // ── 3. Fetch Tab Specific Data ──────────────────────────────────────────────
  const fetchTabData = useCallback(async () => {
    setLoadingTab(true);
    try {
      const commonParams: any = { preset };
      if (preset === 'CUSTOM') {
        if (startDate) commonParams.startDate = startDate;
        if (endDate) commonParams.endDate = endDate;
      }

      if (activeTab === 'daily') {
        const res = await api.get('/whatsapp/audit/daily', { params: commonParams });
        if (res.data?.success) {
          setDailyReport(res.data.data.daily_report || []);
        }
      } else if (activeTab === 'templates') {
        const res = await api.get('/whatsapp/audit/cost/templates', { params: commonParams });
        if (res.data?.success) {
          setTemplateCosts(res.data.data.templates || []);
        }
      } else if (activeTab === 'batches') {
        const res = await api.get('/whatsapp/audit/cost/batches', { params: commonParams });
        if (res.data?.success) {
          setBatchCosts(res.data.data.batches || []);
        }
      } else if (activeTab === 'failures') {
        const [failRes, retryRes] = await Promise.all([
          api.get('/whatsapp/audit/failures', { params: commonParams }),
          api.get('/whatsapp/audit/retries', { params: commonParams }),
        ]);
        if (failRes.data?.success) setFailureAnalytics(failRes.data.data);
        if (retryRes.data?.success) setRetryAnalytics(retryRes.data.data);
      } else if (activeTab === 'messages') {
        const msgParams: any = {
          ...commonParams,
          page: messagePagination.page,
          limit: messagePagination.limit,
        };
        if (messageSearch) msgParams.search = messageSearch;
        if (messageStatusFilter) msgParams.status = messageStatusFilter;

        const res = await api.get('/whatsapp/audit/messages', { params: msgParams });
        if (res.data?.success) {
          setMessages(res.data.data.messages || []);
          setMessagePagination(res.data.data.pagination || { page: 1, total: 0, totalPages: 1, limit: 20 });
        }
      } else if (activeTab === 'ratelimit') {
        const [statusRes, auditRes] = await Promise.all([
          api.get('/whatsapp/rate-limiter/status'),
          api.get('/whatsapp/rate-limiter/audit', { params: { limit: 30 } }),
        ]);
        if (statusRes.data?.success) {
          const sData = statusRes.data.data;
          setRateLimitStatus(sData);
          setEditingLimits({
            messages_per_minute: sData?.limits?.messages_per_minute || sData?.configured_limits?.messages_per_minute || 60,
            daily_spend_limit: sData?.spend_guard?.daily_spend_limit_inr ?? sData?.spend_guard?.daily_spend_limit ?? 50,
          });
        }
        if (auditRes.data?.success) {
          setRateLimitAuditEvents(auditRes.data.data.events || []);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load tab data');
    } finally {
      setLoadingTab(false);
    }
  }, [activeTab, preset, startDate, endDate, messagePagination.page, messagePagination.limit, messageSearch, messageStatusFilter]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await api.put('/whatsapp/rate-limiter/config', {
        messages_per_minute: Number(editingLimits.messages_per_minute),
        daily_spend_ceiling: Number(editingLimits.daily_spend_limit),
      });
      if (res.data?.success) {
        toast.success('Daily budget & rate limits updated successfully');
        setIsConfigModalOpen(false);
        const statusRes = await api.get('/whatsapp/rate-limiter/status');
        if (statusRes.data?.success) {
          setRateLimitStatus(statusRes.data.data);
        }
        fetchTabData();
        fetchSummary();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchKillSwitchStatus();
  }, [fetchKillSwitchStatus]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTabData();
  }, [fetchTabData]);

  // ── CSV Export Handler ──────────────────────────────────────────────────────
  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const params: any = { preset };
      if (preset === 'CUSTOM') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      if (messageStatusFilter) params.status = messageStatusFilter;

      const res = await api.get('/whatsapp/audit/export', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `whatsapp_audit_${preset.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('WhatsApp Audit CSV exported successfully.');
    } catch (err: any) {
      toast.error('Failed to export CSV report');
    } finally {
      setExportingCsv(false);
    }
  };

  const isPaused = killSwitchState && !killSwitchState.enabled;

  return (
    <div className="space-y-6">
      {/* ── 1. GLOBAL WHATSAPP KILL SWITCH / SYSTEM HEALTH BANNER ─────────────── */}
      <div
        className={`rounded-2xl p-5 text-white shadow-lg transition-all duration-300 relative overflow-hidden ${
          isPaused
            ? 'bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 border border-rose-700/60'
            : 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40'
        }`}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                isPaused ? 'bg-rose-600/30 text-rose-300 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {isPaused ? <ShieldAlert size={26} /> : <ShieldCheck size={26} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase ${
                    isPaused ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40' : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${isPaused ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`}
                  />
                  {isPaused ? 'WHATSAPP SENDING: PAUSED' : 'WHATSAPP SENDING: ACTIVE'}
                </span>
                <span className="text-xs text-slate-400">Canonical DB: MySQL 8.x SSOT</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                {isPaused
                  ? 'Emergency Kill Switch Engaged — Zero Outbound Messages Allowed'
                  : 'Meta Cloud API Sending Gateway Active'}
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                {isPaused
                  ? `Sending was paused by ${killSwitchState?.actor_email || 'Administrator'} (Reason: "${killSwitchState?.reason || 'Manual emergency stop'}"). All outbox messages and automated triggers are frozen safely.`
                  : 'All customer verification, dispatch notices, and campaign dispatches are transmitting normally. Webhook delivery & read receipts are synced in real-time.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTotalReportModalOpen(true)}
              icon={<FileText size={13} />}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-transparent text-xs font-bold shadow-sm"
            >
              📊 Total Report
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                fetchKillSwitchStatus();
                fetchSummary();
                fetchTabData();
              }}
              icon={<RefreshCw size={13} className={loadingSummary || loadingTab ? 'animate-spin' : ''} />}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
            >
              Refresh
            </Button>
            <a href="/settings">
              <Button
                variant={isPaused ? 'danger' : 'secondary'}
                size="sm"
                className={`text-xs font-semibold ${
                  isPaused ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
              >
                {isPaused ? 'Manage Kill Switch' : 'System Settings'}
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* ── 2. DATE FILTER & IST TIMEZONE CONTROLS ────────────────────────────── */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'] as DatePreset[]).map(
            (p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  preset === p
                    ? 'bg-navy text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {p.replace(/_/g, ' ')}
              </button>
            )
          )}
        </div>

        {preset === 'CUSTOM' && (
          <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input text-xs py-1 px-2 rounded-lg border-slate-300 w-36"
              placeholder="YYYY-MM-DD"
            />
            <span className="text-xs text-muted">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input text-xs py-1 px-2 rounded-lg border-slate-300 w-36"
              placeholder="YYYY-MM-DD"
            />
          </div>
        )}

        <div className="flex items-center gap-2 self-end md:self-auto text-[11px] text-muted font-medium">
          <Calendar size={13} className="text-slate-400" />
          <span>India Standard Time (IST, UTC+05:30)</span>
        </div>
      </div>

      {/* ── 3. SIMPLIFIED EXECUTIVE KPI SUMMARY ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Messages Sent (How many went) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Messages Sent</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-navy tracking-tight">
              {loadingSummary ? '—' : (summary?.metrics?.total_sent ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Successfully sent ({summary?.metrics?.delivered ?? summary?.metrics?.delivered_count ?? 0} delivered)
            </p>
          </div>
        </div>

        {/* Messages Failed (How many failed) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Messages Failed</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-rose-600 tracking-tight">
              {loadingSummary ? '—' : (summary?.metrics?.failed ?? summary?.metrics?.failed_count ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-rose-500 mt-1 font-medium">
              Failed or undeliverable messages
            </p>
          </div>
        </div>

        {/* Total Spend & Total Report Action */}
        <div className="bg-gradient-to-br from-slate-900 via-navy to-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Spend (Estimated)</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">
                  ₹{(summary?.costs?.estimated_cost_inr ?? summary?.cost?.total_estimated_cost ?? 0).toFixed(2)}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  (@ ₹0.35 / message)
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 text-emerald-400 flex items-center justify-center">
              <IndianRupee size={20} />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTotalReportModalOpen(true)}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <FileText size={14} />
              View Total Report
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. NAVIGATION TABS ────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'daily'
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp size={14} />
            Daily Activity
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'templates'
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} />
            Cost by Template
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'batches'
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet size={14} />
            Cost by Batch
          </button>
          <button
            onClick={() => setActiveTab('failures')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'failures'
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle size={14} />
            Failures & Retries
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'messages'
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare size={14} />
            Message Audit Log
          </button>
          <button
            onClick={() => setActiveTab('ratelimit')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'ratelimit'
                ? 'border-navy text-navy'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Gauge size={14} />
            Rate Limits & Spend Guard
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCsv}
          loading={exportingCsv}
          icon={<Download size={13} />}
          className="text-xs font-semibold"
        >
          Export CSV
        </Button>
      </div>

      {/* ── 6. TAB CONTENTS ──────────────────────────────────────────────────── */}
      {loadingTab ? (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <Spinner className="w-8 h-8 text-navy" />
          <p className="text-xs text-muted mt-2">Loading audit analytics...</p>
        </div>
      ) : (
        <>
          {/* ── TAB 1: DAILY ACTIVITY & VOLUME ───────────────────────────────── */}
          {activeTab === 'daily' && (
            <div className="space-y-6">
              {/* Daily Volume Bar Chart */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-navy mb-4">Daily Transmission Volume (IST Calendar)</h3>
                {dailyReport.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted">No transmission data for this period.</div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyReport} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            borderRadius: '8px',
                            border: 'none',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                        <Bar dataKey="total_sent" name="Sent" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="delivered" name="Delivered" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="read" name="Read" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="failed" name="Failed" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Daily Data Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-3 px-4">Date (IST)</th>
                        <th className="py-3 px-4">Total Sent</th>
                        <th className="py-3 px-4">Delivered</th>
                        <th className="py-3 px-4">Read</th>
                        <th className="py-3 px-4">Failed</th>
                        <th className="py-3 px-4">Queued</th>
                        <th className="py-3 px-4">Estimated Cost</th>
                        <th className="py-3 px-4">Actual Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyReport.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted">
                            No records found for the selected period.
                          </td>
                        </tr>
                      ) : (
                        dailyReport.map((row) => (
                          <tr key={row.date} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-4 font-semibold text-navy">{row.date}</td>
                            <td className="py-2.5 px-4 font-bold text-blue-700">{row.total_sent}</td>
                            <td className="py-2.5 px-4 text-emerald-700 font-semibold">{row.delivered}</td>
                            <td className="py-2.5 px-4 text-sky-700 font-semibold">{row.read}</td>
                            <td className="py-2.5 px-4 text-rose-600 font-semibold">{row.failed}</td>
                            <td className="py-2.5 px-4 text-amber-600">{row.queued}</td>
                            <td className="py-2.5 px-4 text-slate-800 font-medium">₹{row.estimated_cost.toFixed(2)}</td>
                            <td className="py-2.5 px-4">
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                                {row.actual_cost_display}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: COST & VOLUME BY TEMPLATE ─────────────────────────────── */}
          {activeTab === 'templates' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Template Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Language</th>
                      <th className="py-3 px-4">Sent Count</th>
                      <th className="py-3 px-4">Delivery Rate</th>
                      <th className="py-3 px-4">Read Rate</th>
                      <th className="py-3 px-4">Estimated Cost</th>
                      <th className="py-3 px-4">Actual Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {templateCosts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted">
                          No template messages recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      templateCosts.map((t) => (
                        <tr key={t.template_name} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4 font-bold text-navy">{t.template_name}</td>
                          <td className="py-2.5 px-4">
                            <Badge variant="outline" className="text-[10px] bg-slate-50">
                              {t.category}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 uppercase text-muted font-medium">{t.language}</td>
                          <td className="py-2.5 px-4 font-bold text-blue-700">{t.total_sent}</td>
                          <td className="py-2.5 px-4 text-emerald-700 font-semibold">{t.delivery_rate_pct}%</td>
                          <td className="py-2.5 px-4 text-sky-700 font-semibold">{t.read_rate_pct}%</td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">₹{t.estimated_cost.toFixed(2)}</td>
                          <td className="py-2.5 px-4">
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                              {t.actual_cost_display}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 3: COST & PERFORMANCE BY BATCH ────────────────────────────── */}
          {activeTab === 'batches' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Batch ID</th>
                      <th className="py-3 px-4">CSV File Origin</th>
                      <th className="py-3 px-4">Order Range</th>
                      <th className="py-3 px-4">Customer Count</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Dispatched / Sent</th>
                      <th className="py-3 px-4">Failed</th>
                      <th className="py-3 px-4">Estimated Cost</th>
                      <th className="py-3 px-4">Actual Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchCosts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted">
                          No batch dispatches found for this period.
                        </td>
                      </tr>
                    ) : (
                      batchCosts.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4 font-bold text-navy">{b.batch_id}</td>
                          <td className="py-2.5 px-4 text-muted truncate max-w-xs">{b.import_filename}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-700">{b.order_range}</td>
                          <td className="py-2.5 px-4 font-semibold">{b.customer_count}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : b.status === 'QUEUED' || b.status === 'PROCESSING'
                                  ? 'bg-blue-100 text-blue-800'
                                  : b.status === 'AWAITING_CONFIRMATION'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-blue-700 font-bold">{b.sent_count}</td>
                          <td className="py-2.5 px-4 text-rose-600 font-semibold">{b.failed_count}</td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">₹{b.estimated_cost.toFixed(2)}</td>
                          <td className="py-2.5 px-4">
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
                              {b.actual_cost_display}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB 4: FAILURE & RETRY DIAGNOSTICS ────────────────────────────── */}
          {activeTab === 'failures' && (
            <div className="space-y-6">
              {/* Failure Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-muted uppercase">Rate Limits</span>
                  <p className="text-xl font-black text-navy mt-1">
                    {failureAnalytics?.category_breakdown?.rate_limit || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-muted uppercase">Invalid Numbers</span>
                  <p className="text-xl font-black text-navy mt-1">
                    {failureAnalytics?.category_breakdown?.invalid_phone || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-muted uppercase">Template Mismatch</span>
                  <p className="text-xl font-black text-navy mt-1">
                    {failureAnalytics?.category_breakdown?.template_mismatch || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-muted uppercase">Kill Switch Paused</span>
                  <p className="text-xl font-black text-rose-600 mt-1">
                    {failureAnalytics?.category_breakdown?.kill_switch_paused || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-muted uppercase">Insufficient Credit</span>
                  <p className="text-xl font-black text-navy mt-1">
                    {failureAnalytics?.category_breakdown?.insufficient_credit || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-sm text-center">
                  <span className="text-[10px] font-bold text-muted uppercase">Timeouts</span>
                  <p className="text-xl font-black text-navy mt-1">
                    {failureAnalytics?.category_breakdown?.network_timeout || 0}
                  </p>
                </div>
              </div>

              {/* Retry Metrics Card */}
              <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">
                  Autonomous Retry & Circuit Breaker Performance
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-3 pt-3 border-t border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400">Total Retries Attempted:</span>
                    <p className="text-lg font-bold text-white mt-0.5">
                      {retryAnalytics?.total_retried_messages || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Recovered After Retry:</span>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {retryAnalytics?.recovered_after_retry || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Exhausted Max Retries:</span>
                    <p className="text-lg font-bold text-rose-400 mt-0.5">
                      {retryAnalytics?.exhausted_max_retries || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Recovery Rate:</span>
                    <p className="text-lg font-bold text-amber-400 mt-0.5">
                      {retryAnalytics?.recovery_rate_pct || 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Failure Messages */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-navy mb-3">Top Error Messages from Provider</h3>
                {!failureAnalytics?.top_errors || failureAnalytics.top_errors.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">Zero provider errors recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {failureAnalytics.top_errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span className="font-mono text-rose-700 font-medium truncate max-w-xl">
                          {err.error_message}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 shrink-0">
                          {err.count} occurrences
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 5: LIVE MESSAGE AUDIT LOG ─────────────────────────────────── */}
          {activeTab === 'messages' && (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    placeholder="Search by customer name, phone number, order number, or provider ID..."
                    className="form-input text-xs pl-9 pr-3 py-2 rounded-lg border-slate-300 w-full"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select
                    value={messageStatusFilter}
                    onChange={(e) => setMessageStatusFilter(e.target.value)}
                    className="form-input text-xs py-2 px-3 rounded-lg border-slate-300 w-full md:w-36"
                  >
                    <option value="">All Statuses</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="read">Read</option>
                    <option value="failed">Failed</option>
                    <option value="queued">Queued</option>
                    <option value="paused">Paused</option>
                  </select>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setMessagePagination((p) => ({ ...p, page: 1 }));
                      fetchTabData();
                    }}
                    className="text-xs shrink-0"
                  >
                    Search
                  </Button>
                </div>
              </div>

              {/* Messages Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-3 px-4">Recipient</th>
                        <th className="py-3 px-4">Order #</th>
                        <th className="py-3 px-4">Template</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Sent (IST)</th>
                        <th className="py-3 px-4">Delivered (IST)</th>
                        <th className="py-3 px-4">Read (IST)</th>
                        <th className="py-3 px-4">Retries</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {messages.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-muted">
                            No message records matching query.
                          </td>
                        </tr>
                      ) : (
                        messages.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-navy">{m.customer?.name || 'Direct Phone'}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{m.phone_number}</div>
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-700">
                              {m.order?.order_number || '—'}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                              {m.template_name || m.message_type}
                            </td>
                            <td className="py-2.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  m.status === 'read'
                                    ? 'bg-sky-100 text-sky-800'
                                    : m.status === 'delivered'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.status === 'sent'
                                    ? 'bg-blue-100 text-blue-800'
                                    : m.status === 'failed'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {m.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{m.sent_at_ist || '—'}</td>
                            <td className="py-2.5 px-4 text-emerald-700 font-medium">{m.delivered_at_ist || '—'}</td>
                            <td className="py-2.5 px-4 text-sky-700 font-medium">{m.read_at_ist || '—'}</td>
                            <td className="py-2.5 px-4 text-slate-600 font-mono">{m.retry_count}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                onClick={() => setSelectedMessage(m)}
                                className="text-navy hover:text-blue-700 font-semibold text-[11px] underline"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {messagePagination.totalPages > 1 && (
                  <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-muted">
                    <span>
                      Showing Page {messagePagination.page} of {messagePagination.totalPages} ({messagePagination.total} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled={messagePagination.page <= 1}
                        onClick={() => setMessagePagination((p) => ({ ...p, page: p.page - 1 }))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled={messagePagination.page >= messagePagination.totalPages}
                        onClick={() => setMessagePagination((p) => ({ ...p, page: p.page + 1 }))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 6: RATE LIMITER & SPEND GUARD ────────────────────────────── */}
          {activeTab === 'ratelimit' && (
            <div className="space-y-6">
              {/* Header Actions Bar */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center">
                    <Gauge size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Centralized Rate Limiter & Daily Spend Guard</h3>
                    <p className="text-xs text-muted">
                      Distributed pacing across workers with Meta 429 adaptive backoff and IST midnight ceiling
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchTabData()}
                    icon={<RefreshCcw size={13} />}
                    className="text-xs"
                  >
                    Refresh State
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsConfigModalOpen(true)}
                    icon={<Sliders size={13} />}
                    className="text-xs"
                  >
                    Adjust Limits
                  </Button>
                </div>
              </div>

              {/* Status & Guard Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Adapter & Worker Health */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Distributed Engine</span>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-navy">
                      {rateLimitStatus?.active_adapter || 'DETECTING...'}
                    </span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Active
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    {rateLimitStatus?.active_adapter === 'REDIS_DISTRIBUTED'
                      ? 'Redis sorted-set sliding window active'
                      : 'Indexed MySQL database sliding window active'}
                  </p>
                </div>

                {/* Throughput Pacing */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Throughput Pacing</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-navy">
                      {rateLimitStatus?.limits?.messages_per_minute || rateLimitStatus?.configured_limits?.messages_per_minute || 60}
                    </span>
                    <span className="text-xs text-muted">msgs / minute</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                    <span>Recent dispatch: {rateLimitStatus?.current_usage?.active_claims_count || 0}</span>
                    <span>Remaining: ~{rateLimitStatus?.current_usage?.approx_remaining_in_minute || 60}</span>
                  </div>
                </div>

                {/* Spend Ceiling Utilization */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Daily Spend Ceiling</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-700">
                      ₹{(rateLimitStatus?.spend_guard?.daily_spend_limit_inr ?? rateLimitStatus?.spend_guard?.daily_spend_limit ?? 50).toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      ({rateLimitStatus?.spend_guard?.budget_utilization_pct || rateLimitStatus?.spend_guard?.spend_utilization_pct || 0}% used)
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        (rateLimitStatus?.spend_guard?.budget_utilization_pct || rateLimitStatus?.spend_guard?.spend_utilization_pct || 0) > 90
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(rateLimitStatus?.spend_guard?.budget_utilization_pct || rateLimitStatus?.spend_guard?.spend_utilization_pct || 0, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted mt-1">
                    <span>Spent: ₹{rateLimitStatus?.spend_guard?.today_confirmed_spend_inr ?? rateLimitStatus?.spend_guard?.today_confirmed_spend ?? 0}</span>
                    <span>Reserved: ₹{rateLimitStatus?.spend_guard?.active_reserved_spend_inr ?? rateLimitStatus?.spend_guard?.today_reserved_spend ?? 0}</span>
                  </div>
                </div>

                {/* Provider Throttle State */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Provider Throttling</span>
                  <div className="mt-2">
                    {rateLimitStatus?.provider_throttling?.is_throttled ? (
                      <Badge variant="danger" className="font-semibold">
                        429 BACKOFF ACTIVE ({rateLimitStatus.provider_throttling.remaining_backoff_seconds}s)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                        NORMAL DISPATCH
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    {rateLimitStatus?.provider_throttling?.is_throttled
                      ? `Meta error ${rateLimitStatus.provider_throttling.meta_error_code}. Workers paused.`
                      : 'Meta Cloud API throughput optimal.'}
                  </p>
                </div>
              </div>

              {/* Detailed Spend Breakdown Card */}
              <div className="bg-gradient-to-br from-slate-900 to-navy text-white rounded-xl p-5 border border-slate-800 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      Spend Reservation & Balance Guard
                    </span>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="text-xl font-bold text-white">
                        Available Budget Remaining Today:
                      </span>
                      <span className="text-2xl font-black text-emerald-400">
                        ₹{rateLimitStatus?.spend_guard?.remaining_budget_inr?.toLocaleString() || '0.00'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
                      <span className="text-[10px] text-slate-400 block uppercase">Provider Balance</span>
                      <span className="text-xs font-bold text-amber-400">
                        {rateLimitStatus?.provider_balance?.display || 'BALANCE UNAVAILABLE'}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
                      <span className="text-[10px] text-slate-400 block uppercase">Ceiling Guard</span>
                      <span className="text-xs font-bold text-white">
                        {rateLimitStatus?.spend_guard?.spend_ceiling_breached || rateLimitStatus?.spend_guard?.is_ceiling_reached ? 'BLOCKED' : 'ALLOWING DISPATCH'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate Limit & Spend Audit Trail Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-navy">Rate Limit & Spend Protection Audit Log</h4>
                    <p className="text-[11px] text-muted">Recent throttling, rate limit events, and spend reservations</p>
                  </div>
                  <span className="text-[11px] text-muted">Showing last {rateLimitAuditEvents.length} events</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <th className="py-3 px-4">Timestamp (IST)</th>
                        <th className="py-3 px-4">Event Type</th>
                        <th className="py-3 px-4">Worker ID</th>
                        <th className="py-3 px-4">Batch / Outbox ID</th>
                        <th className="py-3 px-4">Configured Limit</th>
                        <th className="py-3 px-4">Usage / Amount</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rateLimitAuditEvents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted">
                            No rate limit or spend guard events recorded yet.
                          </td>
                        </tr>
                      ) : (
                        rateLimitAuditEvents.map((evt) => (
                          <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                              {evt.created_at ? new Date(evt.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                            </td>
                            <td className="py-2.5 px-4">
                              <Badge
                                variant={
                                  evt.event_type.includes('PROVIDER_429') || evt.event_type.includes('BLOCKED')
                                    ? 'danger'
                                    : evt.event_type.includes('THROTTLED')
                                    ? 'warning'
                                    : 'primary'
                                }
                                className="font-mono text-[10px]"
                              >
                                {evt.event_type}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                              {evt.worker_id || 'System'}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                              {evt.batch_id || evt.outbox_id || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-700">
                              {evt.configured_limit != null ? `${evt.configured_limit}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-navy">
                              {evt.amount != null ? `₹${parseFloat(evt.amount as any).toFixed(2)}` : evt.current_usage != null ? `${evt.current_usage}` : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-[11px] text-slate-600 max-w-xs truncate" title={JSON.stringify(evt.details)}>
                              {evt.details ? JSON.stringify(evt.details) : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 7. MESSAGE DETAILS MODAL ─────────────────────────────────────────── */}
      {selectedMessage && (
        <Modal
          open={!!selectedMessage}
          onClose={() => setSelectedMessage(null)}
          title="WhatsApp Transmission Record"
          subtitle={`Log ID: ${selectedMessage.id}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Provider Message ID</span>
                <span className="font-mono text-navy font-semibold break-all">
                  {selectedMessage.wa_message_id || 'Pending Meta ID'}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Customer Name</span>
                <span className="font-semibold text-navy">{selectedMessage.customer?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Recipient Phone</span>
                <span className="font-mono font-semibold text-navy">{selectedMessage.phone_number}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Order Number</span>
                <span className="font-semibold text-navy">{selectedMessage.order?.order_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Status</span>
                <Badge
                  variant={
                    selectedMessage.status === 'read'
                      ? 'primary'
                      : selectedMessage.status === 'delivered'
                      ? 'success'
                      : selectedMessage.status === 'failed'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {selectedMessage.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-bold">Batch Reference</span>
                <span className="font-mono text-navy">{selectedMessage.batch?.batch_id || 'Direct'}</span>
              </div>
            </div>

            {/* Lifecycle Timestamps (IST) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-navy block">Lifecycle Milestones (India Standard Time)</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-muted block">Enqueued At:</span>
                  <span className="font-medium text-slate-700">{selectedMessage.created_at_ist}</span>
                </div>
                <div>
                  <span className="text-muted block">Sent At:</span>
                  <span className="font-medium text-blue-700">{selectedMessage.sent_at_ist || '—'}</span>
                </div>
                <div>
                  <span className="text-muted block">Delivered At:</span>
                  <span className="font-medium text-emerald-700">{selectedMessage.delivered_at_ist || '—'}</span>
                </div>
                <div>
                  <span className="text-muted block">Read At:</span>
                  <span className="font-medium text-sky-700">{selectedMessage.read_at_ist || '—'}</span>
                </div>
              </div>
            </div>

            {/* Error Message if Failed */}
            {selectedMessage.error_message && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                <span className="font-bold block mb-1">Provider Error Notice:</span>
                <p className="font-mono text-[11px]">{selectedMessage.error_message}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── 8. CONFIGURATION MODAL ───────────────────────────────────────────── */}
      {isConfigModalOpen && (
        <Modal
          open={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          title="Configure WhatsApp Rate Limiter & Spend Guard"
          subtitle="Enterprise safety limits across all workers and batch senders"
          size="md"
        >
          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-navy mb-1">
                Messages Per Minute (Rate Pacing)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={editingLimits.messages_per_minute}
                onChange={(e) =>
                  setEditingLimits((prev) => ({
                    ...prev,
                    messages_per_minute: parseInt(e.target.value) || 1,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-navy/20 font-mono text-sm"
                required
              />
              <span className="text-[11px] text-muted block mt-1">
                Distributed across all active workers. Higher values may trigger Meta Cloud API 429 throttling.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-navy mb-1">
                Daily Spend Ceiling (₹ INR)
              </label>
              <input
                type="number"
                min="1"
                max="500000"
                step="1"
                value={editingLimits.daily_spend_limit}
                onChange={(e) =>
                  setEditingLimits((prev) => ({
                    ...prev,
                    daily_spend_limit: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-navy/20 font-mono text-sm"
                required
              />
              <span className="text-[11px] text-muted block mt-1">
                Resets daily at midnight IST (00:00:00). Default is ₹50.00. Batches exceeding remaining budget are safely blocked before dispatch.
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsConfigModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingConfig}
              >
                Save Limits
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── 9. TOTAL REPORT MODAL ───────────────────────────────────────────── */}
      {totalReportModalOpen && (
        <Modal
          open={totalReportModalOpen}
          onClose={() => setTotalReportModalOpen(false)}
          title="📊 WhatsApp Total Spending & Executive Audit Report"
          subtitle="Full consolidated summary across dispatches, delivery rates, and budget utilization"
          size="lg"
        >
          <div className="space-y-5 text-xs text-slate-700">
            {/* Header info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-navy block text-sm">Selected Timeframe: {preset.replace(/_/g, ' ')}</span>
                <span className="text-[11px] text-muted">India Standard Time (IST, UTC+05:30)</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleEmailTotalReport}
                loading={sendingReportEmail}
                icon={<Mail size={14} />}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0"
              >
                📧 Email Report to uidaniel69@gmail.com
              </Button>
            </div>

            {/* Financial Overview Grid */}
            <div>
              <h4 className="font-bold text-navy text-sm mb-2 flex items-center gap-1.5">
                <IndianRupee size={15} className="text-emerald-600" />
                Financial & Spending Summary
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <span className="text-[11px] text-muted block uppercase font-semibold">Total Estimated Cost</span>
                  <span className="text-xl font-black text-emerald-600 block mt-0.5">
                    ₹{(summary?.costs?.estimated_cost_inr ?? summary?.cost?.total_estimated_cost ?? 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500">Utility Rate: ₹0.35 / msg</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <span className="text-[11px] text-muted block uppercase font-semibold">Confirmed Real Spend</span>
                  <span className="text-xl font-black text-navy block mt-0.5">
                    {summary?.costs?.actual_cost_display ?? (summary?.cost?.total_actual_cost != null ? `₹${summary.cost.total_actual_cost.toFixed(2)}` : 'Post-paid / Invoiced')}
                  </span>
                  <span className="text-[10px] text-slate-500">Meta Business Account</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted block uppercase font-semibold">Daily Budget</span>
                    <button
                      type="button"
                      onClick={() => setIsConfigModalOpen(true)}
                      className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-0.5"
                    >
                      ✏️ Edit
                    </button>
                  </div>
                  <span className="text-xl font-black text-blue-600 block mt-0.5">
                    ₹{(rateLimitStatus?.spend_guard?.daily_spend_limit_inr ?? 50).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500">Default: ₹50.00 (Editable)</span>
                </div>
              </div>
            </div>

            {/* Delivery Analytics Table */}
            <div>
              <h4 className="font-bold text-navy text-sm mb-2 flex items-center gap-1.5">
                <MessageSquare size={15} className="text-blue-600" />
                Message Delivery Analytics
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Count</th>
                      <th className="p-2.5">Status / Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr>
                      <td className="p-2.5 font-semibold text-navy">Total Dispatched (Went)</td>
                      <td className="p-2.5 font-bold">{(summary?.metrics?.total_sent ?? 0).toLocaleString()}</td>
                      <td className="p-2.5 text-blue-600 font-medium">100% handoff</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-emerald-700 font-medium">Delivered Messages</td>
                      <td className="p-2.5 font-bold">{(summary?.metrics?.delivered ?? summary?.metrics?.delivered_count ?? 0).toLocaleString()}</td>
                      <td className="p-2.5 text-emerald-600 font-semibold">{summary?.metrics?.delivery_rate_pct ?? summary?.metrics?.delivery_rate_percent ?? 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-sky-700 font-medium">Read Messages</td>
                      <td className="p-2.5 font-bold">{(summary?.metrics?.read ?? summary?.metrics?.read_count ?? 0).toLocaleString()}</td>
                      <td className="p-2.5 text-sky-600 font-semibold">{summary?.metrics?.read_rate_pct ?? summary?.metrics?.read_rate_percent ?? 0}%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 text-rose-700 font-medium">Failed Messages</td>
                      <td className="p-2.5 font-bold text-rose-600">{(summary?.metrics?.failed ?? summary?.metrics?.failed_count ?? 0).toLocaleString()}</td>
                      <td className="p-2.5 text-rose-600 font-semibold">{summary?.metrics?.failure_rate_pct ?? summary?.metrics?.failure_rate_percent ?? 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Connected alert recipient: <strong className="text-navy">uidaniel69@gmail.com</strong>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTotalReportModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
