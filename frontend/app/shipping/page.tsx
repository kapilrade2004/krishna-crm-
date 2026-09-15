'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  useShippingDashboard, useShippingPartners, useCreateShippingPartner,
  useUpdateShippingPartner, useDeleteShippingPartner, useShipments,
  useBulkUploadShipments, useUpdateOrderStatus,
} from '@/hooks/useApi';
import { Button, Input, Modal, PageLoader, KpiCard, EmptyState, Badge, Pagination } from '@/components/ui';
import { formatNumber, fmtDate, fmtDateTime } from '@/lib/utils';
import {
  Truck, Package, CheckCircle2, AlertTriangle, Plus, Pencil, Trash2,
  MapPinned, ExternalLink, Upload, FileSpreadsheet, Search, Download,
  RefreshCw, Copy, Check, Filter, Calendar, MapPin, Phone, User, Store,
  ArrowRight, X, AlertCircle, PackageCheck,
} from 'lucide-react';
import type { ShippingPartner } from '@/types';
import toast from 'react-hot-toast';

const emptyPartner = {
  name: '', code: '', contact_person: '', contact_phone: '', contact_email: '',
  tracking_url_template: '', default_tat_days: '' as string | number, notes: '',
};

const CHANNEL_OPTIONS = [
  { value: '', label: 'Default / Auto-detect' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'flipkart', label: 'Flipkart' },
  { value: 'indiamart', label: 'IndiaMART' },
  { value: 'akuabeat_website', label: 'Akuabeat Website' },
  { value: 'direct', label: 'Direct / Manual' },
  { value: 'other', label: 'Other' },
];

export default function ShippingPage() {
  const { data: dash, isLoading: dashLoading, refetch: refetchDash } = useShippingDashboard();
  const { data: partners, isLoading: partnersLoading } = useShippingPartners();
  const updateOrderStatus = useUpdateOrderStatus();

  // Shipments state & queries
  const [activeTab, setActiveTab] = useState<'shipments' | 'partners'>('shipments');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_transit' | 'delivered' | 'pending' | 'returned'>('all');
  const [partnerFilter, setPartnerFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const {
    data: shipmentsData,
    isLoading: shipmentsLoading,
    isFetching: shipmentsFetching,
    refetch: refetchShipments,
  } = useShipments({
    page,
    limit: 20,
    status: statusFilter,
    shipping_partner: partnerFilter || undefined,
    search: searchQuery || undefined,
  });

  // Partner Mutations
  const createPartner = useCreateShippingPartner();
  const updatePartner = useUpdateShippingPartner();
  const deletePartner = useDeleteShippingPartner();

  // Partner Modal State
  const [partnerModal, setPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ShippingPartner | null>(null);
  const [partnerForm, setPartnerForm] = useState(emptyPartner);
  const [confirmDelete, setConfirmDelete] = useState<ShippingPartner | null>(null);

  // Bulk Upload Modal State
  const [bulkModal, setBulkModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPartner, setUploadPartner] = useState<string>('');
  const [uploadChannel, setUploadChannel] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkUpload = useBulkUploadShipments();

  // Partner handlers
  const openCreatePartner = () => { setEditingPartner(null); setPartnerForm(emptyPartner); setPartnerModal(true); };
  const openEditPartner = (p: ShippingPartner) => {
    setEditingPartner(p);
    setPartnerForm({
      name: p.name, code: p.code,
      contact_person: p.contact_person || '', contact_phone: p.contact_phone || '',
      contact_email: p.contact_email || '', tracking_url_template: p.tracking_url_template || '',
      default_tat_days: p.default_tat_days ?? '', notes: p.notes || '',
    });
    setPartnerModal(true);
  };

  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...partnerForm,
      default_tat_days: partnerForm.default_tat_days === '' ? undefined : Number(partnerForm.default_tat_days),
    };
    if (editingPartner) {
      await updatePartner.mutateAsync({ id: editingPartner.id, ...payload });
    } else {
      await createPartner.mutateAsync(payload);
    }
    setPartnerModal(false);
  };

  const handlePartnerDelete = async () => {
    if (!confirmDelete) return;
    await deletePartner.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  };

  // Bulk Upload Handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadFile(file);
      setUploadSummary(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
      setUploadSummary(null);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvHeader = 'Order ID,AWB Tracking Number,Shipping Partner,Status,Dispatched Date,Delivered Date,Customer Name,Phone,Pincode,City\n';
    const sampleRows = [
      'ORD-2026-1001,DEL123456789,Delhivery,in_transit,2026-09-08,,Ramesh Kumar,9876543210,110001,New Delhi',
      'ORD-2026-1002,BD987654321,Blue Dart,delivered,2026-09-07,2026-09-09 14:30:00,Priya Sharma,9876543211,400001,Mumbai',
      'ORD-2026-1003,SR555444333,Shiprocket,in_transit,2026-09-08,,Anil Verma,9876543212,560001,Bangalore',
    ].join('\n');

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_shipping_transit_manifest.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select a CSV or Excel file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadPartner) formData.append('default_shipping_partner', uploadPartner);
    if (uploadChannel) formData.append('default_channel', uploadChannel);

    try {
      const res = await bulkUpload.mutateAsync(formData);
      setUploadSummary(res.data?.data?.results || null);
      refetchDash();
      refetchShipments();
    } catch (err: any) {
      // Handled by onError in hook
    }
  };

  // Helper for tracking links
  const getTrackingUrl = (partnerName: string | null | undefined, awb: string | null | undefined) => {
    if (!awb) return null;
    const partner = partners?.find((p: any) => p.name?.toLowerCase() === partnerName?.toLowerCase() || p.code?.toLowerCase() === partnerName?.toLowerCase());
    if (partner?.tracking_url_template) {
      return partner.tracking_url_template.replace('{tracking_number}', encodeURIComponent(awb));
    }
    // Generic courier fallback
    if (partnerName?.toLowerCase().includes('delhivery')) {
      return `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`;
    }
    if (partnerName?.toLowerCase().includes('bluedart')) {
      return `https://www.bluedart.com/tracking`;
    }
    if (partnerName?.toLowerCase().includes('shiprocket')) {
      return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`;
    }
    return null;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  return (
    <AppShell>
      <Topbar
        title="Shipping & Tracking"
        subtitle="Logistics dispatch tracking, bulk shipping upload, and courier partner management"
      />
      <main className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Operations KPIs */}
        {dashLoading || !dash ? (
          <PageLoader />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Pending Dispatch"
              value={formatNumber(dash.pendingDispatch)}
              icon={<Package size={16} />}
              sub="No tracking number yet"
            />
            <KpiCard
              label="In Transit"
              value={formatNumber(dash.inTransit)}
              icon={<Truck size={16} />}
              sub="Actively in logistics transit"
            />
            <KpiCard
              label="Delivered Today"
              value={formatNumber(dash.deliveredToday)}
              icon={<CheckCircle2 size={16} />}
              sub="Delivered & registered in CRM"
            />
            <KpiCard
              label="Missing Tracking"
              value={formatNumber(dash.noTracking)}
              icon={<AlertTriangle size={16} />}
              sub={dash.noTracking > 0 ? 'Dispatched but no AWB' : undefined}
            />
          </div>
        )}

        {/* Top Action Bar & Active Shipments by Partner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('shipments')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'shipments'
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-slate-600 hover:text-navy hover:bg-slate-100'
              }`}
            >
              <Truck size={16} />
              Live Shipments & Tracking
              {dash && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === 'shipments' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {formatNumber(dash.inTransit + dash.deliveredToday)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('partners')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'partners'
                  ? 'bg-navy text-white shadow-sm'
                  : 'text-slate-600 hover:text-navy hover:bg-slate-100'
              }`}
            >
              <Store size={16} />
              Shipping Partners
              {partners && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === 'partners' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {partners.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={<Upload size={14} />}
              onClick={() => {
                setUploadFile(null);
                setUploadSummary(null);
                setBulkModal(true);
              }}
              className="font-semibold shadow-xs"
            >
              Bulk Upload Shipments
            </Button>
            <Link href="/shipping/serviceability">
              <Button size="sm" variant="secondary" icon={<MapPinned size={14} />}>
                Pincode Serviceability
              </Button>
            </Link>
            {activeTab === 'partners' && (
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={openCreatePartner}>
                Add Partner
              </Button>
            )}
          </div>
        </div>

        {/* Breakdown by Partner Chips */}
        {dash && dash.byPartner.length > 0 && (
          <div className="card p-3.5 bg-slate-50/60 border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Active Shipments Breakdown</span>
              {partnerFilter && (
                <button
                  onClick={() => { setPartnerFilter(''); setPage(1); }}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Clear Partner Filter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {dash.byPartner.map((p: any) => {
                const isSelected = partnerFilter === p.shipping_partner;
                return (
                  <button
                    key={p.shipping_partner}
                    onClick={() => {
                      setPartnerFilter(isSelected ? '' : p.shipping_partner);
                      setPage(1);
                      if (activeTab !== 'shipments') setActiveTab('shipments');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-navy text-white border-navy shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>{p.shipping_partner}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {formatNumber(p.count)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 1: LIVE SHIPMENTS & TRACKING (Line View by Default) */}
        {activeTab === 'shipments' && (
          <div className="card p-0 overflow-hidden border-border shadow-xs">
            {/* Filter and Search Command Bar */}
            <div className="p-4 border-b border-border bg-slate-50/40 space-y-3">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative w-full md:w-96">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Search by Order #, AWB, Customer, Phone, Pincode..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-navy/20 focus:border-navy text-slate-800"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); setPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Right controls: Partner selector & Refresh */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <select
                    value={partnerFilter}
                    onChange={(e) => {
                      setPartnerFilter(e.target.value);
                      setPage(1);
                    }}
                    className="text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-navy/20"
                  >
                    <option value="">All Courier Partners</option>
                    {partners?.map((p: any) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => { refetchShipments(); refetchDash(); }}
                    title="Refresh Shipments"
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-navy hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw size={14} className={shipmentsFetching ? 'animate-spin text-navy' : ''} />
                  </button>
                </div>
              </div>

              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  { key: 'all', label: 'All Shipments' },
                  { key: 'in_transit', label: 'In Transit / Dispatched' },
                  { key: 'delivered', label: 'Delivered' },
                  { key: 'pending', label: 'Pending Dispatch' },
                  { key: 'returned', label: 'Returned / RTO' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setStatusFilter(tab.key as any);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      statusFilter === tab.key
                        ? 'bg-navy text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-navy'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Shipments Table (Line View by Default) */}
            {shipmentsLoading ? (
              <PageLoader />
            ) : !shipmentsData?.shipments || shipmentsData.shipments.length === 0 ? (
              <EmptyState
                icon={<Truck size={36} />}
                title="No shipments found"
                description={
                  searchQuery || statusFilter !== 'all' || partnerFilter
                    ? 'No orders match your active search filters. Try clearing filters or search term.'
                    : 'No shipment tracking records found. Click "Bulk Upload Shipments" to ingest dispatch manifests from Delhivery, Shiprocket, Blue Dart, etc.'
                }
                action={
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Upload size={14} />}
                    onClick={() => {
                      setUploadFile(null);
                      setUploadSummary(null);
                      setBulkModal(true);
                    }}
                  >
                    Bulk Upload Shipments
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Channel</th>
                      <th>Customer & Destination</th>
                      <th>Logistics Partner</th>
                      <th>AWB / Tracking Number</th>
                      <th>Status</th>
                      <th>Dispatched At</th>
                      <th>Delivered At</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipmentsData.shipments.map((order: any) => {
                      const trackingUrl = getTrackingUrl(order.shipping_partner, order.tracking_number);
                      const isDelivered = order.status === 'delivered';
                      const isInTransit = ['dispatched', 'in_transit'].includes(order.status);
                      const isPending = ['pending', 'confirmed', 'processing'].includes(order.status);
                      const isReturned = ['returned', 'rto'].includes(order.status);

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="font-semibold text-navy">
                            <Link
                              href={`/orders/${order.id}`}
                              className="hover:underline flex items-center gap-1.5 text-xs text-navy group font-mono"
                            >
                              <span>{order.order_number}</span>
                              <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600" />
                            </Link>
                            {order.marketplace_order_id && order.marketplace_order_id !== order.order_number && (
                              <p className="text-[10px] text-muted font-mono">{order.marketplace_order_id}</p>
                            )}
                          </td>
                          <td>
                            <Badge
                              label={order.channel || order.marketplace || 'direct'}
                              variant="outline"
                              className="capitalize text-[10px]"
                            />
                          </td>
                          <td>
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-slate-800 flex items-center gap-1">
                                <User size={11} className="text-slate-400 shrink-0" />
                                {order.customer?.name || order.customer_name || 'Valued Customer'}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted">
                                {(order.customer?.phone || order.customer_phone) && (
                                  <span className="flex items-center gap-0.5 font-mono">
                                    <Phone size={10} className="text-slate-400 shrink-0" />
                                    {order.customer?.phone || order.customer_phone}
                                  </span>
                                )}
                                {(order.delivery_pincode || order.customer?.pincode) && (
                                  <span className="flex items-center gap-0.5 text-slate-500">
                                    <MapPin size={10} className="text-slate-400 shrink-0" />
                                    {order.delivery_pincode || order.customer?.pincode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1 font-medium text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {order.shipping_partner || '—'}
                            </span>
                          </td>
                          <td>
                            {order.tracking_number ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-slate-800 select-all font-semibold">
                                  {order.tracking_number}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(order.tracking_number, 'AWB')}
                                  className="text-slate-400 hover:text-navy p-0.5 transition-colors cursor-pointer"
                                  title="Copy AWB"
                                >
                                  <Copy size={11} />
                                </button>
                                {trackingUrl && (
                                  <a
                                    href={trackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:text-blue-800 p-0.5 transition-colors cursor-pointer"
                                    title="Track on Courier Portal"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <AlertTriangle size={10} /> Missing AWB
                              </span>
                            )}
                          </td>
                          <td>
                            <Badge
                              label={isDelivered ? 'delivered' : isInTransit ? 'in_transit' : isPending ? 'pending_dispatch' : order.status}
                              colorClass={
                                isDelivered
                                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                  : isInTransit
                                  ? 'bg-amber-100 text-amber-800 font-semibold'
                                  : isPending
                                  ? 'bg-blue-100 text-blue-800'
                                  : isReturned
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }
                            />
                          </td>
                          <td className="text-xs text-muted whitespace-nowrap">
                            {order.dispatched_at ? fmtDateTime(order.dispatched_at) : '—'}
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {order.delivered_at ? (
                              <span className="text-emerald-700 font-medium flex items-center gap-1">
                                <CheckCircle2 size={12} /> {fmtDateTime(order.delivered_at)}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isDelivered && !isReturned && (
                                <Button
                                  size="xs"
                                  variant="primary"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                                  icon={<PackageCheck size={12} />}
                                  loading={updateOrderStatus.isPending}
                                  onClick={async () => {
                                    if (confirm(`Mark shipment for Order #${order.order_number} as Delivered?\n\nThis immediately dispatches the order_deliverd message followed by the warranty_claim invitation.`)) {
                                      await updateOrderStatus.mutateAsync({
                                        id: order.id,
                                        status: 'delivered',
                                        note: 'Marked delivered from Shipping table.',
                                      });
                                      refetchShipments();
                                      refetchDash();
                                    }
                                  }}
                                  title="Mark Delivered (Triggers order_deliverd & warranty_claim)"
                                >
                                  Delivered
                                </Button>
                              )}
                              <Link href={`/orders/${order.id}`}>
                                <Button size="xs" variant="secondary">View</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {shipmentsData.totalPages > 1 && (
                  <div className="p-4 border-t border-border flex items-center justify-between bg-slate-50/40">
                    <p className="text-xs text-muted">
                      Showing Page {shipmentsData.page} of {shipmentsData.totalPages} ({shipmentsData.total} total shipments)
                    </p>
                    <Pagination
                      page={shipmentsData.page}
                      totalPages={shipmentsData.totalPages}
                      onPage={(p) => setPage(p)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SHIPPING PARTNERS MANAGEMENT */}
        {activeTab === 'partners' && (
          <div className="card p-0 overflow-hidden border-border shadow-xs">
            <div className="card-header px-4 pt-4">
              <div>
                <p className="card-title">Courier & Logistics Partners</p>
                <p className="card-subtitle text-xs text-muted">Configure partner codes, default turnaround time, and tracking URLs</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/shipping/serviceability">
                  <Button size="sm" variant="secondary" icon={<MapPinned size={13} />}>Pincode Serviceability</Button>
                </Link>
                <Button size="sm" variant="primary" icon={<Plus size={13} />} onClick={openCreatePartner}>Add Partner</Button>
              </div>
            </div>

            {partnersLoading ? (
              <PageLoader />
            ) : !partners || partners.length === 0 ? (
              <EmptyState
                icon={<Truck size={36} />}
                title="No shipping partners yet"
                description="Add your courier partners (Delhivery, Blue Dart, DTDC, etc.) to enable tracking links and TAT lookups."
                action={<Button variant="primary" icon={<Plus size={14} />} onClick={openCreatePartner}>Add Partner</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Default TAT</th>
                      <th>Contact</th>
                      <th>Tracking URL</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p: any) => (
                      <tr key={p.id}>
                        <td className="font-semibold text-navy">{p.name}</td>
                        <td><span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">{p.code}</span></td>
                        <td>{p.default_tat_days ? `${p.default_tat_days} days` : '—'}</td>
                        <td className="text-xs text-muted">
                          {p.contact_person || p.contact_phone || p.contact_email
                            ? [p.contact_person, p.contact_phone].filter(Boolean).join(' · ')
                            : '—'}
                        </td>
                        <td>
                          {p.tracking_url_template ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <ExternalLink size={11} /> Configured
                            </span>
                          ) : <span className="text-xs text-muted">—</span>}
                        </td>
                        <td>
                          <Badge
                            label={p.is_active ? 'active' : 'inactive'}
                            colorClass={p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}
                          />
                        </td>
                        <td>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => openEditPartner(p)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-navy hover:bg-surface transition-colors cursor-pointer"
                              title="Edit Partner"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(p)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-danger hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete Partner"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── BULK UPLOAD MODAL (Manifests, Dispatches & Deliveries) ─────────────── */}
      <Modal
        open={bulkModal}
        onClose={() => {
          if (!bulkUpload.isPending) setBulkModal(false);
        }}
        title="Bulk Upload Shipping & Transit Manifest"
        width="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Informational Callout explaining the two-way progression */}
          <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-xl text-blue-900 text-xs leading-relaxed space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-950">
              <CheckCircle2 size={15} className="text-blue-700 shrink-0" />
              <span>Two-Way Transit & Delivery Progression Engine</span>
            </div>
            <p>
              Upload shipping manifests from Delhivery, Shiprocket, Blue Dart, Amazon EasyShip, or custom Excel/CSV files.
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-800">
              <li>Orders with status <strong>in_transit</strong> or <strong>shipped</strong> will be registered/updated with AWB and carrier.</li>
              <li>When a subsequent upload marks an order as <strong>delivered</strong>, it automatically advances to Delivered across the CRM, registers the customer profile in the Customers database, triggers installation stage, and sets delivery timestamps.</li>
              <li>Orders already delivered are safely preserved and never demoted back to transit.</li>
            </ul>
          </div>

          <form onSubmit={handleBulkUploadSubmit} className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-navy bg-navy/5 scale-[1.01]'
                  : uploadFile
                  ? 'border-emerald-400 bg-emerald-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .tsv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {uploadFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <FileSpreadsheet size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{uploadFile.name}</p>
                  <p className="text-xs text-muted">
                    {(uploadFile.size / 1024).toFixed(1)} KB · Click or drag another file to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Upload size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy">Click to browse or drag & drop shipping file</p>
                    <p className="text-xs text-muted mt-0.5">Supports CSV, TSV, and Excel (.xlsx, .xls) up to 50MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Fallback Partner & Channel Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="form-label text-xs">Default Courier Partner (Optional)</label>
                <select
                  value={uploadPartner}
                  onChange={(e) => setUploadPartner(e.target.value)}
                  className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-navy/20"
                >
                  <option value="">Auto-detect from file courier column</option>
                  {partners?.map((p: ShippingPartner) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted mt-1">Fallback partner if a row lacks a courier name.</p>
              </div>

              <div>
                <label className="form-label text-xs">Default Sales Channel (Optional)</label>
                <select
                  value={uploadChannel}
                  onChange={(e) => setUploadChannel(e.target.value)}
                  className="w-full text-xs font-medium py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-navy/20"
                >
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted mt-1">Applied when creating new orders.</p>
              </div>
            </div>

            {/* Template Download & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 py-1"
              >
                <Download size={13} />
                Download Sample CSV Template
              </button>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkModal(false)}
                  disabled={bulkUpload.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={bulkUpload.isPending}
                  disabled={!uploadFile}
                  icon={<Upload size={14} />}
                >
                  {bulkUpload.isPending ? 'Processing Shipments...' : 'Upload & Sync Shipments'}
                </Button>
              </div>
            </div>
          </form>

          {/* Results Summary Dialog */}
          {uploadSummary && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-700" />
                  Upload & Sync Summary
                </p>
                <span className="text-xs font-semibold text-emerald-800">
                  {uploadSummary.total} Total Rows
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-center">
                  <p className="text-xs text-muted">Moved to Delivered</p>
                  <p className="text-base font-bold text-emerald-700">{uploadSummary.updatedDelivered}</p>
                  <span className="text-[10px] text-emerald-600 font-medium">Customer registered</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-center">
                  <p className="text-xs text-muted">Updated In Transit</p>
                  <p className="text-base font-bold text-amber-700">{uploadSummary.updatedInTransit}</p>
                  <span className="text-[10px] text-amber-600 font-medium">AWB assigned</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-center">
                  <p className="text-xs text-muted">Newly Created</p>
                  <p className="text-base font-bold text-blue-700">{uploadSummary.newlyCreated}</p>
                  <span className="text-[10px] text-blue-600 font-medium">Added to CRM</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-center">
                  <p className="text-xs text-muted">Already Delivered</p>
                  <p className="text-base font-bold text-slate-700">{uploadSummary.alreadyDelivered}</p>
                  <span className="text-[10px] text-slate-500 font-medium">Idempotent</span>
                </div>
              </div>

              {uploadSummary.errors && uploadSummary.errors.length > 0 && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200/70 text-xs text-amber-900 space-y-1 max-h-32 overflow-y-auto">
                  <p className="font-bold flex items-center gap-1">
                    <AlertCircle size={13} className="text-amber-700" />
                    {uploadSummary.errors.length} Row Notices / Skipped:
                  </p>
                  {uploadSummary.errors.map((e: any, idx: number) => (
                    <p key={idx} className="text-[11px] text-amber-800">
                      Row {e.row}: {e.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── CREATE / EDIT PARTNER MODAL ───────────────────────────────────────── */}
      <Modal
        open={partnerModal}
        onClose={() => setPartnerModal(false)}
        title={editingPartner ? 'Edit Shipping Partner' : 'Add Shipping Partner'}
      >
        <form onSubmit={handlePartnerSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Partner Name"
              required
              value={partnerForm.name}
              onChange={(e) => setPartnerForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Delhivery"
            />
            <Input
              label="Code"
              required
              value={partnerForm.code}
              onChange={(e) => setPartnerForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. DELHIVERY"
              maxLength={20}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Person"
              value={partnerForm.contact_person}
              onChange={(e) => setPartnerForm(f => ({ ...f, contact_person: e.target.value }))}
            />
            <Input
              label="Contact Phone"
              value={partnerForm.contact_phone}
              onChange={(e) => setPartnerForm(f => ({ ...f, contact_phone: e.target.value }))}
            />
          </div>
          <Input
            label="Contact Email"
            type="email"
            value={partnerForm.contact_email}
            onChange={(e) => setPartnerForm(f => ({ ...f, contact_email: e.target.value }))}
          />
          <Input
            label="Tracking URL Template"
            value={partnerForm.tracking_url_template}
            onChange={(e) => setPartnerForm(f => ({ ...f, tracking_url_template: e.target.value }))}
            placeholder="https://partner.com/track?awb={tracking_number}"
            hint="Use {tracking_number} as a placeholder for the AWB/consignment number."
          />
          <Input
            label="Default TAT (days)"
            type="number"
            min={0}
            max={60}
            value={partnerForm.default_tat_days}
            onChange={(e) => setPartnerForm(f => ({ ...f, default_tat_days: e.target.value }))}
            hint="Fallback delivery estimate when no pincode-specific TAT exists."
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setPartnerModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={createPartner.isPending || updatePartner.isPending}>
              {editingPartner ? 'Save Changes' : 'Add Partner'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────────────────── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Remove Shipping Partner"
        width="max-w-sm"
      >
        <p className="text-sm text-muted mb-5">
          Remove <strong>{confirmDelete?.name}</strong>? If this partner is used by existing orders, it will be deactivated instead of deleted.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={deletePartner.isPending} onClick={handlePartnerDelete}>Remove</Button>
        </div>
      </Modal>
    </AppShell>
  );
}
