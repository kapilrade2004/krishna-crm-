'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { useCsvBatches, useUploadCsv, useCsvBatch } from '@/hooks/useApi';
import { Button, EmptyState, PageLoader, Badge, Modal, Input, Select } from '@/components/ui';
import { fmtDateTime, timeAgo } from '@/lib/utils';
import {
  Upload, FileText, Loader2, AlertCircle, Layers, RefreshCw, CheckCircle2,
  AlertTriangle, Clock, Calendar, Search, Package, ArrowRight, User as UserIcon,
  ExternalLink, Eye, Info, MessageSquare, Trash2, X
} from 'lucide-react';
import type { CsvBatch } from '@/types';
import ChannelSelectionModal, { CHANNEL_OPTIONS } from '@/components/csv/ChannelSelectionModal';
import WhatsAppBatchConfirmationPanel from '@/components/csv/WhatsAppBatchConfirmationPanel';

const BATCH_STATUS_COLOURS: Record<string, string> = {
  uploaded:   'bg-blue-100 text-blue-700',
  processing: 'bg-amber-100 text-amber-700',
  completed:  'bg-emerald-100 text-emerald-700',
  failed:     'bg-red-100 text-red-600',
  partial:    'bg-orange-100 text-orange-700',
};

export default function CsvImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('');
  const [inspectBatch, setInspectBatch] = useState<CsvBatch | null>(null);

  const { data, isLoading, refetch, isFetching } = useCsvBatches();
  const upload = useUploadCsv();

  const batches: CsvBatch[] = data?.data || [];

  // Auto-track latest active batch if none explicitly selected
  const activeProcessingBatch = batches.find((b) => b.status === 'processing' || b.status === 'uploaded');
  const currentTrackedId = activeBatchId || activeProcessingBatch?.id || null;
  const { data: activeBatch } = useCsvBatch(currentTrackedId);

  useEffect(() => {
    if (activeProcessingBatch && !activeBatchId) {
      setActiveBatchId(activeProcessingBatch.id);
    }
  }, [activeProcessingBatch, activeBatchId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      setShowChannelModal(true);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
    setShowChannelModal(false);
  };

  const handleConfirmUpload = async (marketplace: string, channel: string) => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('marketplace', marketplace);
    formData.append('channel', channel);

    try {
      const res = await upload.mutateAsync(formData);
      const batchId = res.data?.data?.batch?.id;
      if (batchId) {
        setActiveBatchId(batchId);
      }
      setShowChannelModal(false);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const formatChannelName = (channelKey?: string, marketplace?: string) => {
    if (!channelKey) return marketplace ? marketplace.toUpperCase() : 'N/A';
    const found = CHANNEL_OPTIONS.find((c) => c.value === channelKey);
    return found ? found.label : channelKey.replace(/_/g, ' ').toUpperCase();
  };

  const getDuration = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${mins}m ${rem}s`;
  };

  const filteredBatches = batches.filter((b) => {
    const matchSearch =
      !historySearch ||
      b.filename.toLowerCase().includes(historySearch.toLowerCase()) ||
      (b.channel && b.channel.toLowerCase().includes(historySearch.toLowerCase())) ||
      (b.uploader?.name && b.uploader.name.toLowerCase().includes(historySearch.toLowerCase()));
    const matchMarketplace = !marketplaceFilter || b.marketplace === marketplaceFilter;
    return matchSearch && matchMarketplace;
  });

  return (
    <AppShell>
      <Topbar title="CSV / Excel Import" subtitle="Bulk import marketplace orders — Amazon Channel 1/2/3, Flipkart, IndiaMart, Akuabeat Website" />
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Upload card */}
        <div className="card shadow-xs">
          <div className="card-header flex items-center justify-between">
            <p className="card-title flex items-center gap-2 text-navy font-bold">
              <Upload size={16} className="text-amber-600" />
              Upload Order Data File
            </p>
            <span className="text-xs text-muted font-medium">Supports .xlsx, .xls, .csv, .tsv up to 50MB</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.tsv"
              onChange={handleFileChange}
              className="form-input flex-1 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-amber/10 file:text-amber-700 file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
            />
            {selectedFile && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={handleClearFile}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shrink-0"
                icon={<X size={14} />}
              >
                Clear File
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Layers size={14} />}
              onClick={() => {
                if (fileRef.current?.files?.[0]) {
                  setSelectedFile(fileRef.current.files[0]);
                  setShowChannelModal(true);
                } else {
                  fileRef.current?.click();
                }
              }}
            >
              Select Channel & Upload
            </Button>
          </div>

          <div className="mt-4 p-3.5 bg-surface rounded-lg border border-border text-xs text-muted space-y-1.5">
            <p className="font-semibold text-navy flex items-center gap-1.5">
              <Layers size={13} className="text-amber-600" />
              Universal Column & Channel Ingestion Engine:
            </p>
            <p>
              All channels automatically accept the exact same comprehensive Excel/CSV fields as Amazon (Order ID, SKU, Buyer Name, Contact, Address, Delivery Dates, Amounts). Select choices like <span className="font-semibold text-navy">Akuabeat Website</span>, <span className="font-semibold text-navy">Amazon Channel 1/2/3</span>, <span className="font-semibold text-navy">Flipkart</span>, or <span className="font-semibold text-navy">IndiaMart</span> to seamlessly map and tag order channels.
            </p>
          </div>
        </div>

        {/* Interactive Channel Selection Modal Pop-Up */}
        <ChannelSelectionModal
          open={showChannelModal}
          onClose={() => setShowChannelModal(false)}
          file={selectedFile}
          onClear={handleClearFile}
          onConfirm={handleConfirmUpload}
          loading={upload.isPending}
        />

        {/* Active batch progress card */}
        {activeBatch && (activeBatch.status === 'processing' || activeBatch.status === 'uploaded') && (
          <div className="card border-amber-300 bg-amber-50/50 shadow-sm transition-all duration-300">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy truncate">
                    Processing {activeBatch.filename}…
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                      <Clock size={11} /> Started {fmtDateTime(activeBatch.created_at)}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 animate-pulse">
                      Live Uploading
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted mt-1">
                  <span className="font-semibold text-navy">{activeBatch.processed_rows}</span> / {activeBatch.total_rows || '?'} rows processed
                  {activeBatch.total_rows > 0 && (
                    <> · <span className="text-emerald-600 font-medium">{activeBatch.success_rows} success</span> · <span className="text-blue-600 font-medium">{activeBatch.existing_customers_reused || 0} reused contacts</span> · <span className="text-muted">{activeBatch.duplicate_rows} duplicate orders</span> · <span className="text-red-600 font-medium">{activeBatch.failed_rows} failed</span></>
                  )}
                </p>
                {activeBatch.total_rows > 0 && (
                  <div className="w-full h-2 bg-amber-200/50 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(5, Math.min(100, (activeBatch.processed_rows / activeBatch.total_rows) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Batch completed banner if freshly selected */}
        {activeBatch && (activeBatch.status === 'completed' || activeBatch.status === 'partial') && activeBatchId === activeBatch.id && (
          <div className="card border-emerald-300 bg-emerald-50/40 p-4 shadow-xs">
            <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-950">
                    Import {activeBatch.status === 'completed' ? 'Completed' : 'Partially Completed'}: {activeBatch.filename}
                  </p>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    {activeBatch.success_rows} order(s) created · {activeBatch.existing_customers_reused || 0} existing contacts reused · {activeBatch.duplicate_rows} duplicate orders skipped · {activeBatch.failed_rows} failed
                  </p>
                  <p className="text-[11px] text-emerald-700 font-mono mt-1 flex items-center gap-2">
                    <span>Uploaded: {fmtDateTime(activeBatch.created_at)}</span>
                    {activeBatch.processed_at && <span>· Finished: {fmtDateTime(activeBatch.processed_at)}</span>}
                    {getDuration(activeBatch.created_at, activeBatch.processed_at) && (
                      <span className="font-semibold">(Duration: {getDuration(activeBatch.created_at, activeBatch.processed_at)})</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/orders?import_batch_id=${activeBatch.id}`}
                  className="btn btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 shadow-xs"
                >
                  <Package size={13} />
                  <span>View Orders</span>
                </Link>
                <Button size="sm" variant="secondary" onClick={() => setActiveBatchId(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Controlled WhatsApp Bulk Messaging Console (Batches of Max 100) */}
        {activeBatch && (activeBatch.status === 'completed' || activeBatch.status === 'partial') && activeBatchId === activeBatch.id && (
          <WhatsAppBatchConfirmationPanel
            importBatchId={activeBatch.id}
            filename={activeBatch.filename}
            onRefresh={refetch}
          />
        )}
        <div className="card p-0 overflow-hidden shadow-xs border border-border">
          <div className="card-header px-5 pt-4 pb-3 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <p className="card-title text-navy font-bold flex items-center gap-2">
                <Calendar size={16} className="text-amber-600" />
                CSV Import History & Timestamp Records
              </p>
              <p className="text-xs text-muted mt-0.5">
                Complete audit log of all marketplace order files uploaded, with exact dates, times, durations, and channels.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <div className="relative min-w-[200px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Filter by file or channel..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 pr-2.5 py-1 text-xs rounded-lg border border-border bg-white text-navy focus:ring-1 focus:ring-navy w-full"
                />
              </div>

              <select
                value={marketplaceFilter}
                onChange={(e) => setMarketplaceFilter(e.target.value)}
                className="form-select text-xs"
              >
                <option value="">All Marketplaces</option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="indiamart">IndiaMart</option>
                <option value="akuabeat_website">Akuabeat Website</option>
                <option value="website">Website</option>
                <option value="direct">Direct</option>
              </select>

              <Button
                size="sm"
                variant="secondary"
                icon={<RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />}
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-7 text-xs"
              >
                Refresh
              </Button>
            </div>
          </div>

          {isLoading ? (
            <PageLoader />
          ) : filteredBatches.length === 0 ? (
            <EmptyState
              icon={<FileText size={36} />}
              title="No import records match"
              description="No CSV import batches found matching the selected filter criteria."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-xs">
                    <th>File</th>
                    <th>Channel & Source</th>
                    <th>Status</th>
                    <th>Rows Breakdown</th>
                    <th>Uploaded Date & Time</th>
                    <th>Processed Date & Time</th>
                    <th>Duration</th>
                    <th>Uploaded By</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBatches.map((b) => {
                    const isSelected = (activeBatchId || currentTrackedId) === b.id;
                    const isRowProcessing = b.status === 'processing' || b.status === 'uploaded';
                    const uploadTime = b.created_at || (b as any).createdAt;
                    const processedTime = b.processed_at || (b as any).processedAt;
                    const duration = getDuration(uploadTime, processedTime);

                    return (
                      <tr
                        key={b.id}
                        onClick={() => setInspectBatch(b)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-amber-50/50' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="font-semibold text-navy text-xs">
                          <div className="flex items-center gap-2">
                            {isRowProcessing ? (
                              <Loader2 size={15} className="animate-spin text-amber-600 shrink-0" />
                            ) : (
                              <FileText size={15} className="text-muted shrink-0" />
                            )}
                            <div>
                              <p className="truncate max-w-[190px]" title={b.filename}>{b.filename}</p>
                              <p className="text-[10px] font-mono text-muted">ID: {b.id.substring(0, 8)}…</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber/15 text-amber-900 border border-amber-200">
                              <Layers size={10} />
                              {formatChannelName((b as any).channel, b.marketplace)}
                            </span>
                            <p className="text-[10px] text-muted capitalize pl-0.5">{b.marketplace}</p>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Badge label={b.status} colorClass={BATCH_STATUS_COLOURS[b.status]} />
                            {isRowProcessing && (
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="text-xs">
                            <p className="font-semibold text-navy">{b.total_rows} total rows</p>
                            <div className="flex items-center gap-1.5 text-[11px] mt-0.5 flex-wrap">
                              <span className="text-emerald-700 font-semibold" title="Successfully imported orders">
                                ✓ {b.success_rows}
                              </span>
                              <span className="text-blue-700 font-medium" title="Existing customers/contacts reused">
                                ↻ {b.existing_customers_reused || 0} reused
                              </span>
                              <span className="text-muted" title="Duplicate orders skipped">
                                · {b.duplicate_rows} dup
                              </span>
                              {b.failed_rows > 0 && (
                                <span className="text-red-600 font-bold" title="Failed rows">
                                  · ✕ {b.failed_rows}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <p className="text-xs font-semibold text-navy flex items-center gap-1">
                              <Clock size={11} className="text-amber-600" />
                              {fmtDateTime(uploadTime)}
                            </p>
                            <p className="text-[11px] text-muted">{timeAgo(uploadTime)}</p>
                          </div>
                        </td>
                        <td>
                          {processedTime ? (
                            <div>
                              <p className="text-xs font-medium text-slate-800 flex items-center gap-1">
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                {fmtDateTime(processedTime)}
                              </p>
                              <p className="text-[11px] text-emerald-700 font-medium">Completed</p>
                            </div>
                          ) : isRowProcessing ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium animate-pulse">
                              <Loader2 size={11} className="animate-spin" /> In Progress
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className="text-xs font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {duration || (isRowProcessing ? 'Processing…' : '—')}
                          </span>
                        </td>
                        <td>
                          <div className="text-xs">
                            <p className="font-medium text-navy flex items-center gap-1">
                              <UserIcon size={11} className="text-slate-400" />
                              {b.uploader?.name || 'Staff User'}
                            </p>
                            {b.uploader?.email && (
                              <p className="text-[10px] text-muted truncate max-w-[130px]">{b.uploader.email}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {(b.status === 'completed' || b.status === 'partial') && (
                              <button
                                onClick={() => setActiveBatchId(b.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                title="Open WhatsApp batch console for this import"
                              >
                                <MessageSquare size={12} className="text-emerald-600" />
                                <span>WhatsApp</span>
                              </button>
                            )}
                            <button
                              onClick={() => setInspectBatch(b)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-navy hover:bg-slate-100 transition-colors"
                              title="Inspect batch details & errors"
                            >
                              <Eye size={14} />
                            </button>
                            <Link
                              href={`/orders?import_batch_id=${b.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-navy/10 hover:bg-navy text-navy hover:text-white transition-colors"
                              title="View imported orders in Orders Desk"
                            >
                              <Package size={12} />
                              <span>Orders</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detailed Batch Inspection Modal */}
        <Modal
          open={!!inspectBatch}
          onClose={() => setInspectBatch(null)}
          title={inspectBatch ? `Import Batch Details: ${inspectBatch.filename}` : 'Batch Details'}
          size="lg"
        >
          {inspectBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-border">
                  <p className="text-[11px] text-muted font-medium">Status</p>
                  <div className="mt-1">
                    <Badge label={inspectBatch.status} colorClass={BATCH_STATUS_COLOURS[inspectBatch.status]} />
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-border">
                  <p className="text-[11px] text-muted font-medium">Channel / Tag</p>
                  <p className="text-xs font-bold text-navy mt-1">
                    {formatChannelName(inspectBatch.channel, inspectBatch.marketplace)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-border">
                  <p className="text-[11px] text-muted font-medium">Total Rows</p>
                  <p className="text-sm font-bold text-navy mt-0.5">{inspectBatch.total_rows}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-border">
                  <p className="text-[11px] text-muted font-medium">Successful Orders</p>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">{inspectBatch.success_rows}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-border">
                  <p className="text-[11px] text-muted font-medium">Contacts Reused</p>
                  <p className="text-sm font-bold text-blue-600 mt-0.5">{inspectBatch.existing_customers_reused || 0}</p>
                </div>
              </div>

              {/* Exact Date & Time Details Box */}
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Calendar size={14} className="text-amber-700" />
                  Exact Ingestion Timestamps:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted block text-[11px]">Upload Started:</span>
                    <span className="font-semibold text-navy font-mono">
                      {fmtDateTime(inspectBatch.created_at || (inspectBatch as any).createdAt)}
                    </span>
                    <span className="text-[10px] text-muted block">
                      {timeAgo(inspectBatch.created_at || (inspectBatch as any).createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Processing Finished:</span>
                    <span className="font-semibold text-navy font-mono">
                      {(inspectBatch.processed_at || (inspectBatch as any).processedAt)
                        ? fmtDateTime(inspectBatch.processed_at || (inspectBatch as any).processedAt)
                        : 'In Progress…'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Total Duration:</span>
                    <span className="font-semibold text-navy font-mono">
                      {getDuration(
                        inspectBatch.created_at || (inspectBatch as any).createdAt,
                        inspectBatch.processed_at || (inspectBatch as any).processedAt
                      ) || 'Calculating…'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Uploader & Duplicate stats */}
              <div className="flex items-center justify-between text-xs p-3 bg-slate-50 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <UserIcon size={14} className="text-slate-500" />
                  <span className="text-muted">Uploaded By:</span>
                  <span className="font-semibold text-navy">{inspectBatch.uploader?.name || 'Staff User'}</span>
                  {inspectBatch.uploader?.email && <span className="text-muted">({inspectBatch.uploader.email})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted">Duplicates Skipped: <strong className="text-navy">{inspectBatch.duplicate_rows}</strong></span>
                  <span className="text-muted">Failed Rows: <strong className="text-red-600">{inspectBatch.failed_rows}</strong></span>
                </div>
              </div>

              {/* Error Log Section */}
              {inspectBatch.error_log && inspectBatch.error_log.length > 0 ? (
                <div className="border border-red-200 rounded-xl p-3.5 bg-red-50/30">
                  <p className="text-xs font-bold text-red-800 flex items-center gap-1.5 mb-2">
                    <AlertTriangle size={14} /> Processing Errors ({inspectBatch.error_log.length}):
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-red-100">
                    {inspectBatch.error_log.map((err: any, idx: number) => {
                      const rowNum = err.row ?? err.rowIndex ?? (idx + 1);
                      const fieldName = err.field || err.column || null;
                      const errMsg = err.error || (Array.isArray(err.errors) ? err.errors.join('; ') : String(err));
                      return (
                        <div key={idx} className="text-xs pt-1.5 flex items-start gap-2">
                          <span className="font-mono font-bold text-red-700 shrink-0">Row {rowNum}:</span>
                          {fieldName && (
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-semibold shrink-0">
                              [{fieldName}]
                            </span>
                          )}
                          <span className="text-red-900">{errMsg}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>No row-level errors encountered during processing.</span>
                </div>
              )}

              {/* Controlled WhatsApp Bulk Messaging Console for this Batch */}
              <div className="pt-2">
                <WhatsAppBatchConfirmationPanel
                  importBatchId={inspectBatch.id}
                  filename={inspectBatch.filename}
                  onRefresh={refetch}
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-xs text-muted font-mono">Batch UUID: {inspectBatch.id}</p>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/orders?import_batch_id=${inspectBatch.id}`}
                    className="btn btn-primary text-xs flex items-center gap-1.5"
                    onClick={() => setInspectBatch(null)}
                  >
                    <Package size={13} />
                    <span>View Orders from this Batch</span>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => setInspectBatch(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </AppShell>
  );
}


