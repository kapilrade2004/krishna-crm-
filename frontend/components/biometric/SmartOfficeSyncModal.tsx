'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Badge } from '@/components/ui';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface SmartOfficeStatus {
  configured: boolean;
  baseUrl: string;
  syncEnabled: boolean;
  intervalSeconds: number;
  totalPunches: number;
  unmatchedPunches: number;
  lastRun: any;
  lastSuccessfulSync: string | null;
}

interface SyncRunRecord {
  id: string;
  from_datetime: string;
  to_datetime: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number;
  records_received: number;
  records_inserted: number;
  records_duplicate: number;
  records_unmatched: number;
  records_failed: number;
  status: 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  error_message: string | null;
  sync_type: string;
}

interface SmartOfficeSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: () => void;
}

export default function SmartOfficeSyncModal({
  isOpen,
  onClose,
  onSyncCompleted,
}: SmartOfficeSyncModalProps) {
  const [statusData, setStatusData] = useState<SmartOfficeStatus | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Manual Sync / Backfill date controls
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  const fetchStatusAndRuns = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, runsRes] = await Promise.all([
        api.get('/attendance/smartoffice/status'),
        api.get('/attendance/smartoffice/sync-runs', { params: { limit: 10 } }),
      ]);
      setStatusData(statusRes.data?.data || null);
      setSyncRuns(runsRes.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load SmartOffice status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatusAndRuns();
    }
  }, [isOpen, fetchStatusAndRuns]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/attendance/smartoffice/sync', {
        fromDate,
        toDate,
      });

      const result = res.data?.data;
      const count = result?.recordsInserted ?? 0;
      const dupes = result?.recordsDuplicate ?? 0;
      const unmatched = result?.recordsUnmatched ?? 0;

      toast.success(
        `Sync finished! Ingested ${count} new punch(es), ${dupes} duplicate(s) prevented, ${unmatched} unmatched.`
      );

      fetchStatusAndRuns();
      if (onSyncCompleted) {
        onSyncCompleted();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'SmartOffice synchronization failed.';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const setRangeQuick = (type: 'today' | 'yesterday' | 'week' | 'aug_sep') => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === 'today') {
      const t = toYMD(now);
      setFromDate(t);
      setToDate(t);
    } else if (type === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setFromDate(toYMD(y));
      setToDate(toYMD(now));
    } else if (type === 'week') {
      const w = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFromDate(toYMD(w));
      setToDate(toYMD(now));
    } else if (type === 'aug_sep') {
      setFromDate('2026-08-01');
      setToDate('2026-09-12');
    }
  };

  const lastRun = statusData?.lastRun;
  const isConnected = statusData?.configured && (!lastRun || lastRun.status !== 'FAILED');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SmartOffice Biometric Sync Monitor" size="xl">
      <div className="space-y-6">
        {/* Top Status Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                isConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {isConnected ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">SmartOffice Connection</p>
              <p className="text-sm font-bold text-slate-900">
                {isConnected ? 'Connected' : 'Connection Error'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Last Successful Sync</p>
              <p className="text-sm font-bold text-slate-900">
                {statusData?.lastSuccessfulSync
                  ? new Date(statusData.lastSuccessfulSync).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Never'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Database size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Saved Punches</p>
              <p className="text-sm font-bold text-indigo-600">
                {statusData?.totalPunches ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Sync Metrics Row (Requirement 16) */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600" />
              Latest Sync Run Statistics
            </h4>
            {lastRun && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  lastRun.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : lastRun.status === 'PARTIAL'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {lastRun.status}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
              <p className="text-[11px] text-slate-400 font-medium">Duration</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {lastRun?.duration_ms ? `${(lastRun.duration_ms / 1000).toFixed(1)}s` : '0.0s'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
              <p className="text-[11px] text-slate-400 font-medium">Received</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {lastRun?.records_received ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
              <p className="text-[11px] text-emerald-700 font-medium">Inserted</p>
              <p className="text-sm font-bold text-emerald-800 mt-0.5">
                {lastRun?.records_inserted ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200">
              <p className="text-[11px] text-blue-700 font-medium">Duplicates</p>
              <p className="text-sm font-bold text-blue-800 mt-0.5">
                {lastRun?.records_duplicate ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200">
              <p className="text-[11px] text-amber-700 font-medium">Unmatched</p>
              <p className="text-sm font-bold text-amber-800 mt-0.5">
                {lastRun?.records_unmatched ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200">
              <p className="text-[11px] text-rose-700 font-medium">Failed</p>
              <p className="text-sm font-bold text-rose-800 mt-0.5">
                {lastRun?.records_failed ?? 0}
              </p>
            </div>
          </div>

          {lastRun?.error_message && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Last Synchronization Failure Notice:</p>
                <p className="font-mono text-[11px] mt-0.5">{lastRun.error_message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Manual Synchronization & Historical Backfill (Requirement 17 & 18) */}
        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw size={14} className="text-indigo-600" />
                Manual Synchronization & Historical Backfill
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Fetch biometric logs for any date range with automatic database deduplication.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setRangeQuick('today')}
                className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('yesterday')}
                className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
              >
                Yesterday & Today
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('week')}
                className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setRangeQuick('aug_sep')}
                className="px-2 py-1 text-[11px] font-semibold bg-indigo-100 border border-indigo-300 rounded text-indigo-800 hover:bg-indigo-200"
              >
                Aug 1 - Sep 12 (All Logs)
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              loading={syncing}
              onClick={handleManualSync}
              className="w-full sm:w-auto ml-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow"
            >
              <RefreshCw size={13} className={`mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronizing...' : 'Sync Now'}
            </Button>
          </div>
        </div>

        {/* Sync Runs History Audit Table */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={14} className="text-slate-500" />
            Recent Synchronization History (Audit Trail)
          </h4>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Started At</th>
                  <th className="p-3">Range</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-center">Received</th>
                  <th className="p-3 text-center">Inserted</th>
                  <th className="p-3 text-center">Duplicates</th>
                  <th className="p-3 text-center">Duration</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150">
                {syncRuns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      No synchronization runs recorded yet.
                    </td>
                  </tr>
                ) : (
                  syncRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50/60">
                      <td className="p-3 font-mono text-[11px] text-slate-700">
                        {new Date(run.started_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        {run.from_datetime} → {run.to_datetime}
                      </td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {run.sync_type}
                        </span>
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-900">
                        {run.records_received}
                      </td>
                      <td className="p-3 text-center font-semibold text-emerald-600">
                        +{run.records_inserted}
                      </td>
                      <td className="p-3 text-center text-slate-500">
                        {run.records_duplicate}
                      </td>
                      <td className="p-3 text-center text-slate-500">
                        {(run.duration_ms / 1000).toFixed(1)}s
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            run.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : run.status === 'PARTIAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Monitor
          </Button>
        </div>
      </div>
    </Modal>
  );
}
