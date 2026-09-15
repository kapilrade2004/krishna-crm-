'use strict';
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Select, Badge, PageLoader, EmptyState } from '@/components/ui';
import { fmtDateTime, timeAgo } from '@/lib/utils';
import { History, ShieldCheck, ShieldAlert, Laptop, Smartphone, Tablet, Search, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { LoginHistoryLog } from '@/types';

export default function LoginHistoryTable() {
  const [logs, setLogs] = useState<LoginHistoryLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/user-access/login-history', {
        params: {
          page,
          limit: 30,
          email: emailFilter || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      const data = res.data?.data;
      setLogs(data?.logs || []);
      setTotal(data?.total || 0);
    } catch (err: any) {
      toast.error('Failed to load login history.');
    } finally {
      setLoading(false);
    }
  }, [page, emailFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Failed
          </span>
        );
      case 'locked':
        return (
          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Locked Out
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Suspended
          </span>
        );
      case 'pending_activation':
        return (
          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending Activation
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {status}
          </span>
        );
    }
  };

  const getDeviceIcon = (device?: string) => {
    if (device?.toLowerCase() === 'mobile') return <Smartphone className="w-3.5 h-3.5 text-gray-500" />;
    if (device?.toLowerCase() === 'tablet') return <Tablet className="w-3.5 h-3.5 text-gray-500" />;
    return <Laptop className="w-3.5 h-3.5 text-gray-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 border border-gray-200 rounded-2xl shadow-sm">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by email..."
              value={emailFilter}
              onChange={(e) => {
                setEmailFilter(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="form-select text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="locked">Locked</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchLogs}
          className="flex items-center gap-1.5 text-xs self-end sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <PageLoader />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No Login Records Found"
          description="Login events and security attempts will appear here in real time."
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Email Address</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5">Browser & OS</th>
                  <th className="p-3.5">Device</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="p-3.5 text-gray-500 whitespace-nowrap">
                      <div>{fmtDateTime(log.login_at)}</div>
                      <span className="text-[10px] text-gray-400">{timeAgo(log.login_at)}</span>
                    </td>
                    <td className="p-3.5 font-semibold text-gray-900 font-mono text-[11px]">{log.email}</td>
                    <td className="p-3.5 font-mono text-gray-600 text-[11px]">{log.ip_address || '—'}</td>
                    <td className="p-3.5 text-gray-700">
                      <div>{log.browser || 'Browser'}</div>
                      <span className="text-[10px] text-gray-400">{log.os || 'OS'}</span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 text-gray-700">
                        {getDeviceIcon(log.device)}
                        <span>{log.device || 'Desktop'}</span>
                      </div>
                    </td>
                    <td className="p-3.5">{getStatusBadge(log.status)}</td>
                    <td className="p-3.5 text-gray-500 text-[11px] max-w-xs truncate" title={log.failure_reason}>
                      {log.failure_reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/30">
            <span>Showing {logs.length} of {total} total login records</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={logs.length < 30}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
