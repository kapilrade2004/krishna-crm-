'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Loader2,
  Wallet,
  ShieldAlert,
  Eye,
  Info,
} from 'lucide-react';
import { Button, Modal, Badge } from '@/components/ui';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export interface WhatsAppBatchItem {
  id: string;
  batch_id: string;
  import_batch_id: string;
  batch_index: number;
  total_batches: number;
  customer_count: number;
  message_count: number;
  order_range_start: string;
  order_range_end: string;
  status:
    | 'CREATED'
    | 'READY'
    | 'AWAITING_CONFIRMATION'
    | 'QUEUED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'PARTIALLY_FAILED'
    | 'FAILED'
    | 'PAUSED'
    | 'CANCELLED';
  estimated_cost: string | number;
  actual_cost: string | number | null;
  estimated_duration_seconds: number;
  estimated_duration_text: string;
  sent_count: number;
  failed_count: number;
  cancelled_count: number;
  paused_count: number;
  confirmed_at?: string;
  metadata?: any;
}

interface Props {
  importBatchId: string;
  filename?: string;
  onRefresh?: () => void;
}

export default function WhatsAppBatchConfirmationPanel({
  importBatchId,
  filename,
  onRefresh,
}: Props) {
  const [batches, setBatches] = useState<WhatsAppBatchItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<WhatsAppBatchItem | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [waSendingStatus, setWaSendingStatus] = useState<any>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [showExclusions, setShowExclusions] = useState(false);
  const [completedBatchPrompt, setCompletedBatchPrompt] = useState<number | null>(null);
  const prevCompletedCountRef = useRef<number>(0);
  const hasAutoOpenedInitialRef = useRef<boolean>(false);

  // Fetch batches & sending status
  const fetchBatches = useCallback(async () => {
    try {
      setIsLoading(true);
      const [batchRes, waStatusRes] = await Promise.all([
        api.get(`/whatsapp/batches?import_batch_id=${importBatchId}`),
        api.get('/whatsapp/sending-status').catch(() => ({ data: { data: null } })),
      ]);

      const data = batchRes.data?.data;
      if (data) {
        setBatches(data.batches || []);
        setSummary(data);
      }
      if (waStatusRes.data?.data) {
        setWaSendingStatus(waStatusRes.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch WhatsApp batches:', err);
    } finally {
      setIsLoading(false);
    }
  }, [importBatchId]);

  useEffect(() => {
    if (importBatchId) {
      fetchBatches();
    }
  }, [importBatchId, fetchBatches]);

  // Batches require explicit sequential manual operator approval (Max 100/batch).

  // Track batch completion to prompt next batch of 100 customers
  useEffect(() => {
    const completedCount = batches.filter((b) => b.status === 'COMPLETED').length;
    if (completedCount > 0 && completedCount > prevCompletedCountRef.current) {
      const nextBatch = batches.find(
        (b) => (b.status === 'AWAITING_CONFIRMATION' || b.status === 'READY') && b.batch_index === completedCount + 1
      );
      if (nextBatch) {
        setSelectedBatch(nextBatch);
        setCompletedBatchPrompt(completedCount);
        setIsConfirmModalOpen(true);
        toast.success(`Batch ${completedCount} completed! Ready to send Batch ${nextBatch.batch_index}.`, {
          icon: '🚀',
        });
      }
    }
    prevCompletedCountRef.current = completedCount;
  }, [batches]);

  // Polling for live status while batches are processing
  useEffect(() => {
    const hasActiveBatches = batches.some(
      (b) => b.status === 'QUEUED' || b.status === 'PROCESSING'
    );
    if (!hasActiveBatches) return;

    const interval = setInterval(() => {
      fetchBatches();
    }, 4000);

    return () => clearInterval(interval);
  }, [batches, fetchBatches]);

  const handleOpenConfirmModal = (batch: WhatsAppBatchItem) => {
    setSelectedBatch(batch);
    setCompletedBatchPrompt(null);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmBatch = async () => {
    if (!selectedBatch) return;

    if (waSendingStatus && waSendingStatus.enabled === false) {
      toast.error('WhatsApp sending is currently paused by the Emergency Kill Switch.', {
        icon: '🛑',
      });
      return;
    }

    try {
      setIsConfirming(true);
      const idempotencyKey = `confirm-${selectedBatch.id}-${Date.now()}`;
      const res = await api.post(`/whatsapp/batches/${selectedBatch.id}/confirm`, {
        idempotency_key: idempotencyKey,
      });

      toast.success(res.data?.message || `Batch ${selectedBatch.batch_index} queued successfully!`);
      setIsConfirmModalOpen(false);
      setSelectedBatch(null);
      await fetchBatches();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to dispatch batch';
      toast.error(errMsg);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelBatch = async (batch: WhatsAppBatchItem) => {
    if (!confirm(`Are you sure you want to cancel Batch ${batch.batch_index}?`)) return;

    try {
      setIsCancelling(true);
      await api.post(`/whatsapp/batches/${batch.id}/cancel`, {
        reason: 'Cancelled by user from import console',
      });
      toast.success(`Batch ${batch.batch_index} cancelled.`);
      await fetchBatches();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel batch');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading && batches.length === 0) {
    return (
      <div className="card p-6 flex items-center justify-center gap-3 text-muted text-xs">
        <Loader2 size={18} className="animate-spin text-amber-600" />
        <span>Evaluating eligible customers and calculating batches (Max 100/batch)…</span>
      </div>
    );
  }

  if (batches.length === 0) {
    return null;
  }

  const awaitingBatches = batches.filter(
    (b) => b.status === 'AWAITING_CONFIRMATION' || b.status === 'READY'
  );
  const completedBatchesCount = batches.filter((b) => b.status === 'COMPLETED').length;

  // Next batch to send sequentially: first batch with AWAITING_CONFIRMATION
  const nextBatchIndex = awaitingBatches.length > 0 ? awaitingBatches[0].batch_index : null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AWAITING_CONFIRMATION':
        return <Badge variant="warning">AWAITING CONFIRMATION</Badge>;
      case 'QUEUED':
        return <Badge variant="primary">QUEUED</Badge>;
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 animate-pulse">
            <Loader2 size={11} className="animate-spin" /> Live Dispatching
          </span>
        );
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'PARTIALLY_FAILED':
        return <Badge colorClass="bg-orange-100 text-orange-800 border-orange-200">PARTIALLY FAILED</Badge>;
      case 'FAILED':
        return <Badge variant="danger">FAILED</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary">CANCELLED</Badge>;
      case 'PAUSED':
        return <Badge variant="danger">PAUSED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const exclusions = summary?.exclusion_summary;
  const hasExclusions =
    exclusions &&
    Object.values(exclusions).some((v: any) => typeof v === 'number' && v > 0);

  return (
    <div className="space-y-4">
      {/* Global Kill Switch Warning if paused */}
      {waSendingStatus && waSendingStatus.enabled === false && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-700">
          <div className="flex items-center gap-2.5 font-semibold">
            <ShieldAlert size={18} className="text-red-600 shrink-0" />
            <span>
              🛑 WhatsApp Sending is Globally Paused. You can review batches below, but sending is blocked until resumed in Settings.
            </span>
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <div className="card shadow-xs border border-border overflow-hidden">
        {/* Header */}
        <div className="card-header bg-slate-50/80 px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <MessageSquare size={18} className="text-emerald-600" />
              <h3 className="text-sm font-bold text-navy">
                WhatsApp Batch Delivery Console
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Max 100 Customers / Batch
              </span>
              {filename && (
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {filename}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Review eligible customers, estimated cost, and estimated time. Explicit confirmation is required for each batch.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBatches}
              loading={isLoading}
              className="text-xs"
            >
              Refresh Status
            </Button>
          </div>
        </div>

        {/* Dispatch Live Status Banner */}
        {batches.some((b) => b.status === 'QUEUED' || b.status === 'PROCESSING') && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold">
                Dispatch Active: WhatsApp verification messages are currently processing in the background.
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 font-medium">Auto-refreshing live</span>
          </div>
        )}

        {/* Upload Summary Strip */}
        {summary?.import_batch && (
          <div className="px-5 py-2.5 bg-slate-100/70 border-b border-border text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                Total Rows: <strong>{summary.import_batch.total_rows || 0}</strong>
              </span>
              <span>•</span>
              <span className="text-emerald-700">
                Created: <strong>{summary.import_batch.success_rows || 0}</strong>
              </span>
              <span>•</span>
              <span className="text-amber-700">
                Duplicates: <strong>{summary.import_batch.duplicate_rows || 0}</strong>
              </span>
              <span>•</span>
              <span className="text-rose-700">
                Failed: <strong>{summary.import_batch.failed_rows || 0}</strong>
              </span>
              <span>•</span>
              <span className="text-navy font-bold">
                WhatsApp Eligible: <strong>{summary.total_customers || 0}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                className="text-xs text-navy hover:underline font-semibold flex items-center gap-1"
              >
                <Eye size={12} />
                <span>{showTemplatePreview ? 'Hide Template Preview' : 'Preview WhatsApp Template'}</span>
              </button>

              {hasExclusions && (
                <button
                  type="button"
                  onClick={() => setShowExclusions(!showExclusions)}
                  className="text-xs text-amber-800 hover:underline font-semibold flex items-center gap-1"
                >
                  <Info size={12} />
                  <span>{showExclusions ? 'Hide Exclusions' : 'View Exclusions Breakdown'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapsible Template Preview Card */}
        {showTemplatePreview && (
          <div className="p-4 bg-emerald-50/40 border-b border-emerald-200 text-xs">
            <div className="max-w-xl mx-auto bg-white border border-emerald-200 rounded-xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <MessageSquare size={14} className="text-emerald-600" />
                  <span>Template: order_verification_interactive</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                  UTILITY / INTERACTIVE
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Hello <strong>{summary?.template_preview?.sample_parameters?.customer_name || 'Customer'}</strong>, thank you for choosing Akuabeat! Please verify your order #<strong>{summary?.template_preview?.sample_parameters?.order_number || 'ORD-1001'}</strong> for <strong>{summary?.template_preview?.sample_parameters?.product_name || 'Akuabeat Water Purifier'}</strong> ({summary?.template_preview?.sample_parameters?.product_sku || 'SKU-01'}). Please select an option below:
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-md text-[11px] font-bold">
                  [Yes, Confirm]
                </span>
                <span className="px-3 py-1 bg-blue-50 border border-blue-300 text-blue-800 rounded-md text-[11px] font-bold">
                  [Send Screenshot]
                </span>
                <span className="px-3 py-1 bg-rose-50 border border-rose-300 text-rose-800 rounded-md text-[11px] font-bold">
                  [Cancel Order]
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Exclusions Breakdown */}
        {showExclusions && exclusions && (
          <div className="p-4 bg-amber-50/50 border-b border-amber-200 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <div className="p-2 bg-white rounded border border-amber-200">
                <span className="text-muted text-[10px]">Missing Phone</span>
                <p className="font-bold text-navy">{exclusions.missing_phone || 0}</p>
              </div>
              <div className="p-2 bg-white rounded border border-amber-200">
                <span className="text-muted text-[10px]">Invalid Phone (&lt;10)</span>
                <p className="font-bold text-navy">{exclusions.invalid_phone_format || 0}</p>
              </div>
              <div className="p-2 bg-white rounded border border-amber-200">
                <span className="text-muted text-[10px]">Not Pending</span>
                <p className="font-bold text-navy">{exclusions.order_not_pending || 0}</p>
              </div>
              <div className="p-2 bg-white rounded border border-amber-200">
                <span className="text-muted text-[10px]">Already Sent</span>
                <p className="font-bold text-navy">{exclusions.already_sent || 0}</p>
              </div>
              <div className="p-2 bg-white rounded border border-amber-200">
                <span className="text-muted text-[10px]">Opted Out</span>
                <p className="font-bold text-navy">{exclusions.opted_out || 0}</p>
              </div>
              <div className="p-2 bg-white rounded border border-amber-200">
                <span className="text-muted text-[10px]">Duplicate in Upload</span>
                <p className="font-bold text-navy">{exclusions.duplicate_phone_in_upload || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-white border-b border-border text-xs">
          <div className="p-3 bg-surface rounded-lg border border-border">
            <p className="text-muted text-[11px]">Total Batches</p>
            <p className="text-base font-bold text-navy mt-0.5">
              {summary?.total_batches || batches.length}
            </p>
            <span className="text-[10px] text-muted">
              {summary?.awaiting_confirmation_batches || 0} awaiting confirmation
            </span>
          </div>

          <div className="p-3 bg-surface rounded-lg border border-border">
            <p className="text-muted text-[11px]">Estimated Total Cost</p>
            <p className="text-base font-bold text-emerald-700 mt-0.5">
              ₹{summary?.total_estimated_cost || 0}
            </p>
            <span className="text-[10px] text-muted">₹0.80 / msg (ESTIMATE)</span>
          </div>

          <div className="p-3 bg-surface rounded-lg border border-border">
            <p className="text-muted text-[11px]">Estimated Remaining Cost</p>
            <p className="text-base font-bold text-amber-700 mt-0.5">
              ₹{summary?.estimated_remaining_cost || 0}
            </p>
            <span className="text-[10px] text-muted">For unconfirmed batches</span>
          </div>

          <div className="p-3 bg-surface rounded-lg border border-border">
            <p className="text-muted text-[11px]">Provider Balance</p>
            <p className="text-xs font-bold text-gray-700 mt-1 flex items-center gap-1">
              <Wallet size={13} className="text-gray-500" />
              <span>BALANCE UNAVAILABLE</span>
            </p>
            <span className="text-[10px] text-muted">Meta Cloud Invoiced</span>
          </div>
        </div>

        {/* Batch Cards List */}
        <div className="p-5 space-y-3.5 bg-slate-50/30">
          {batches.map((batch) => {
            const TERMINAL_BATCH_STATUSES = ['COMPLETED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED'];
            const isAwaiting = batch.status === 'AWAITING_CONFIRMATION' || batch.status === 'READY';
            const isProcessing = batch.status === 'QUEUED' || batch.status === 'PROCESSING';
            const isCompleted = batch.status === 'COMPLETED';
            const isPartial = batch.status === 'PARTIALLY_FAILED';
            const hasUnfinishedPriorBatch = batches.some(
              (b) => b.batch_index < batch.batch_index && !TERMINAL_BATCH_STATUSES.includes(b.status)
            );
            const isNextBatch = isAwaiting && !hasUnfinishedPriorBatch;

            return (
              <div
                key={batch.id}
                className={`p-4 rounded-xl border transition-all ${
                  isProcessing
                    ? 'bg-indigo-50/40 border-indigo-200 shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50/20 border-emerald-200'
                    : isNextBatch
                    ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-300'
                    : 'bg-white border-border shadow-xs'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Batch Identity & Ranges */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-navy text-sm">
                        WhatsApp Batch {batch.batch_index} of {batch.total_batches}
                      </span>
                      <span className="text-[11px] font-mono text-gray-500">
                        ({batch.batch_id})
                      </span>
                      {getStatusBadge(batch.status)}
                      {isNextBatch && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                          👉 Next Ready Batch
                        </span>
                      )}
                      {isAwaiting && hasUnfinishedPriorBatch && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          🔒 Waiting for Batch {batch.batch_index - 1}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-700 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted">Orders:</span>
                        <span className="font-semibold text-navy font-mono">
                          {batch.order_range_start} → {batch.order_range_end}
                        </span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted">Customers:</span>
                        <strong className="text-navy">{batch.customer_count}</strong>
                        <span className="text-[10px] text-muted">(Max 100)</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted">Est. Cost:</span>
                        <strong className="text-emerald-700">₹{batch.estimated_cost}</strong>
                        <span className="text-[10px] text-muted">(ESTIMATE)</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-muted" />
                        <span className="text-muted">Est. Time:</span>
                        <strong className="text-gray-700">{batch.estimated_duration_text || '~5 minutes'}</strong>
                      </div>
                    </div>

                    {/* Live Progress Bar for active or completed batches */}
                    {(isProcessing || isCompleted || isPartial) && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-600 mb-1">
                          <span>
                            Progress: <strong>{batch.sent_count}</strong> sent
                            {batch.failed_count > 0 && <span className="text-red-600"> · {batch.failed_count} failed</span>}
                            {batch.paused_count > 0 && <span className="text-amber-600"> · {batch.paused_count} paused</span>}
                            {' '}of {batch.message_count}
                          </span>
                          <span>
                            Actual Cost: <strong>₹{batch.actual_cost || '0.00'}</strong>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isPartial ? 'bg-orange-500' : 'bg-emerald-500'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(5, ((batch.sent_count + batch.failed_count) / batch.message_count) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {isAwaiting && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isCancelling}
                          onClick={() => handleCancelBatch(batch)}
                          className="text-xs h-8 text-gray-600"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={(waSendingStatus && waSendingStatus.enabled === false) || hasUnfinishedPriorBatch}
                          onClick={() => handleOpenConfirmModal(batch)}
                          title={hasUnfinishedPriorBatch ? `Wait for Batch ${batch.batch_index - 1} to complete` : undefined}
                          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shadow-xs"
                        >
                          <Play size={12} className="fill-white" />
                          <span>
                            {hasUnfinishedPriorBatch
                              ? `Locked (Batch ${batch.batch_index})`
                              : `Send This Batch (${batch.customer_count})`}
                          </span>
                        </Button>
                      </>
                    )}

                    {isProcessing && (
                      <span className="text-xs text-indigo-700 font-medium flex items-center gap-1.5 py-1 px-3 bg-indigo-100 rounded-lg">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Worker Dispatching…</span>
                      </span>
                    )}

                    {isCompleted && (
                      <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 py-1 px-3 bg-emerald-100 rounded-lg">
                        <CheckCircle2 size={14} />
                        <span>All Messages Dispatched</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal - Single Batch */}
      {isConfirmModalOpen && selectedBatch && (
        <Modal
          open={isConfirmModalOpen}
          onClose={() => {
            if (!isConfirming) {
              setIsConfirmModalOpen(false);
              setSelectedBatch(null);
              setCompletedBatchPrompt(null);
            }
          }}
          title={
            completedBatchPrompt
              ? `🎉 Batch ${completedBatchPrompt} Completed! Send Batch ${selectedBatch.batch_index}?`
              : selectedBatch.batch_index === 1
              ? `💰 Confirm Batch 1 WhatsApp Dispatch (${selectedBatch.customer_count} Customers)`
              : `⚠️ Confirm WhatsApp Batch ${selectedBatch.batch_index} Dispatch`
          }
        >
          <div className="space-y-4 pt-1">
            {completedBatchPrompt && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>Batch {completedBatchPrompt} (100 customers)</strong> messages have been fully dispatched. Ready to send messages to the next 100 customers!
                </span>
              </div>
            )}

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-900">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-emerald-950">
                  Batch {selectedBatch.batch_index} of {selectedBatch.total_batches}
                </span>
                <span className="font-mono text-[11px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded font-bold">
                  Template: order_verification_interactive
                </span>
              </div>
              <p>
                You are about to send the 1st verification message to{' '}
                <strong>{selectedBatch.customer_count} customers</strong> (Orders in this batch of 100).
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div>Order Range: <strong>{selectedBatch.order_range_start} → {selectedBatch.order_range_end}</strong></div>
                <div>Customer Count: <strong>{selectedBatch.customer_count} (Max 100)</strong></div>
                <div>Batch Cost: <strong className="text-emerald-700 font-bold">₹{selectedBatch.estimated_cost}</strong></div>
                <div>Total Upload Cost: <strong>₹{summary?.total_estimated_cost || selectedBatch.estimated_cost}</strong></div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <span>100-Customer Batch Safety Rule:</span>
              </p>
              <p>
                Messages are dispatched in controlled batches of up to 100 customers.
                Once this batch finishes, the system will prompt you before dispatching the next batch.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="secondary"
                disabled={isConfirming}
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setSelectedBatch(null);
                  setCompletedBatchPrompt(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={isConfirming}
                onClick={handleConfirmBatch}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <Play size={13} className="fill-white" />
                <span>Send Batch {selectedBatch.batch_index} ({selectedBatch.customer_count} Customers)</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
