'use strict';
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Select, Badge, PageLoader, EmptyState } from '@/components/ui';
import { fmtDateTime, timeAgo } from '@/lib/utils';
import { ShieldCheck, RefreshCw, FileText, UserCog, Key, Lock, Trash2, Plus, Edit } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { UserAuditLogEntry } from '@/types';

export default function UserAuditLogsTable() {
  const [logs, setLogs] = useState<UserAuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventFilter, setEventFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/user-access/audit-logs', {
        params: {
          page,
          limit: 30,
          event_type: eventFilter !== 'all' ? eventFilter : undefined,
        },
      });
      const data = res.data?.data;
      setLogs(data?.logs || []);
      setTotal(data?.total || 0);
    } catch (err: any) {
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'USER_CREATED':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Plus className="w-3 h-3" /> User Created
          </span>
        );
      case 'USER_UPDATED':
        return (
          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Edit className="w-3 h-3" /> User Updated
          </span>
        );
      case 'USER_ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Trash2 className="w-3 h-3" /> User Archived
          </span>
        );
      case 'PASSWORD_RESET':
        return (
          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Key className="w-3 h-3" /> Password Reset
          </span>
        );
      case 'ACCOUNT_LOCKED':
        return (
          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Lock className="w-3 h-3" /> Account Locked
          </span>
        );
      case 'ACCOUNT_UNLOCKED':
        return (
          <span className="inline-flex items-center gap-1 text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <ShieldCheck className="w-3 h-3" /> Account Unlocked
          </span>
        );
      case 'PERMISSIONS_MODIFIED':
        return (
          <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <UserCog className="w-3 h-3" /> Rights Changed
          </span>
        );
      case 'USER_CLONED':
        return (
          <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full text-[11px] font-semibold">
            <Plus className="w-3 h-3" /> User Cloned
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full text-[10px] font-mono">
            {eventType}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-white p-3.5 border border-gray-200 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-700">Filter Action:</label>
          <select
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setPage(1);
            }}
            className="form-select text-xs"
          >
            <option value="all">All Audit Events</option>
            <option value="USER_CREATED">User Created</option>
            <option value="USER_UPDATED">User Updated</option>
            <option value="USER_ARCHIVED">User Archived</option>
            <option value="PASSWORD_RESET">Password Reset</option>
            <option value="ACCOUNT_LOCKED">Account Locked</option>
            <option value="ACCOUNT_UNLOCKED">Account Unlocked</option>
            <option value="PERMISSIONS_MODIFIED">Permissions Modified</option>
            <option value="USER_CLONED">User Cloned</option>
            <option value="BULK_USERS_IMPORTED">Bulk Import</option>
          </select>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchLogs}
          className="flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="p-12 flex justify-center">
          <PageLoader />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No Audit Records Found"
          description="Every user creation, role modification, and access update is automatically recorded here."
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-200">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Action Event</th>
                  <th className="p-3.5">Target User ID</th>
                  <th className="p-3.5">Actor / Origin</th>
                  <th className="p-3.5">Audit Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="p-3.5 text-gray-500 whitespace-nowrap">
                      <div>{fmtDateTime(log.created_at)}</div>
                      <span className="text-[10px] text-gray-400">{timeAgo(log.created_at)}</span>
                    </td>
                    <td className="p-3.5">{getEventBadge(log.event_type)}</td>
                    <td className="p-3.5 font-mono text-gray-600 text-[11px]">
                      {log.target_user_id ? log.target_user_id.slice(0, 8) + '...' : '— (Batch)'}
                    </td>
                    <td className="p-3.5 text-gray-700">
                      <div className="font-mono text-[11px]">{log.ip_address || '127.0.0.1'}</div>
                      <span className="text-[10px] text-gray-400 truncate max-w-[120px] block" title={log.user_agent}>
                        {log.user_agent || 'Client'}
                      </span>
                    </td>
                    <td className="p-3.5 max-w-md">
                      <div className="bg-gray-50 border border-gray-200 p-2 rounded-lg font-mono text-[10px] text-gray-700 overflow-x-auto max-h-20">
                        {log.new_values ? JSON.stringify(log.new_values) : log.old_values ? JSON.stringify(log.old_values) : '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50/30">
            <span>Showing {logs.length} of {total} total audit records</span>
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
