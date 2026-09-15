'use strict';
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Badge, PageLoader, Modal, Input, Select } from '@/components/ui';
import { fmtDate, fmtDateTime, getMediaUrl } from '@/lib/utils';
import {
  ShieldCheck, ShieldX, User, ShoppingCart, Calendar, Clock, Wrench, Download,
  CheckCircle2, XCircle, FileText, ArrowLeft, Activity, Plus, Eye, ExternalLink,
  Image as ImageIcon, ZoomIn, X, RotateCcw, AlertTriangle, ShieldAlert,
  HelpCircle, History, PackageOpen, Check, Shield, Truck, Send, MessageSquare,
  CheckSquare, Undo2, ArrowUpRight, Copy, Phone, MapPin, Layers
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import CreateServiceRequestModal from '@/components/warranty/CreateServiceRequestModal';
import type { Warranty, WarrantyReturn, WarrantyMessage, WarrantyStatusEnum } from '@/types';

export default function WarrantyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const warrantyId = params?.id as string;

  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [loading, setLoading] = useState(true);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Active workspace tab
  const [activeTab, setActiveTab] = useState<'overview' | 'service' | 'returns' | 'messages' | 'audit'>('overview');

  // Modals & Action States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetReason, setResetReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Return Request Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({
    reason_code: 'DEFECTIVE',
    reason_text: '',
    notes: '',
  });
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Return Action Execution Modal
  const [activeReturnModal, setActiveReturnModal] = useState<{
    type: 'approve' | 'reject' | 'pickup' | 'received' | 'inspect' | 'close';
    record: WarrantyReturn;
  } | null>(null);
  const [modalInput, setModalInput] = useState<any>({});
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [isActivating, setIsActivating] = useState(false);
  const [isRetryingMsg, setIsRetryingMsg] = useState(false);

  const fetchWarranty = useCallback(async () => {
    if (!warrantyId) return;
    setLoading(true);
    try {
      const res = await api.get(`/warranty/${warrantyId}`);
      const war = res.data?.data?.warranty || res.data?.warranty;
      if (war) setWarranty(war);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load warranty record.');
    } finally {
      setLoading(false);
    }
  }, [warrantyId]);

  useEffect(() => {
    fetchWarranty();
  }, [fetchWarranty]);

  // ── Activate Warranty ──────────────────────────────────────────────────────
  const handleActivateWarranty = async () => {
    if (!confirm('Are you sure you want to activate this product warranty for 1 full year?')) return;
    setIsActivating(true);
    try {
      const res = await api.post(`/warranty/${warrantyId}/activate`, {});
      toast.success(res.data?.message || 'Warranty activated successfully!');
      fetchWarranty();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to activate warranty.');
    } finally {
      setIsActivating(false);
    }
  };

  // ── Manual Warranty Reset ──────────────────────────────────────────────────
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetReason.trim()) {
      toast.error('A reason is mandatory to reset warranty.');
      return;
    }
    setIsResetting(true);
    try {
      const res = await api.post(`/warranty/${warrantyId}/reset`, {
        reason: resetReason.trim(),
      });
      toast.success(res.data?.message || 'Warranty manually reset to Inactive. Audit history preserved.');
      setIsResetModalOpen(false);
      setResetReason('');
      fetchWarranty();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset warranty.');
    } finally {
      setIsResetting(false);
    }
  };

  // ── Request Return ─────────────────────────────────────────────────────────
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.reason_text.trim()) {
      toast.error('A detailed reason is required to request a return.');
      return;
    }
    setIsSubmittingReturn(true);
    try {
      const res = await api.post(`/warranty/${warrantyId}/returns`, returnForm);
      toast.success(res.data?.message || 'Return request created successfully!');
      setIsReturnModalOpen(false);
      setReturnForm({ reason_code: 'DEFECTIVE', reason_text: '', notes: '' });
      fetchWarranty();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit return request.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // ── Return Workflow Actions ────────────────────────────────────────────────
  const handleReturnActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturnModal) return;
    setIsProcessingAction(true);

    const { type, record } = activeReturnModal;
    try {
      if (type === 'approve') {
        await api.post(`/warranty/returns/${record.id}/approve`, { notes: modalInput.notes });
        toast.success(`Return #${record.return_number} approved.`);
      } else if (type === 'reject') {
        if (!modalInput.reason?.trim()) {
          toast.error('Rejection reason is required.');
          setIsProcessingAction(false);
          return;
        }
        await api.post(`/warranty/returns/${record.id}/reject`, { reason: modalInput.reason });
        toast.success(`Return #${record.return_number} rejected.`);
      } else if (type === 'pickup') {
        await api.post(`/warranty/returns/${record.id}/schedule-pickup`, modalInput);
        toast.success(`Pickup scheduled for #${record.return_number}.`);
      } else if (type === 'received') {
        await api.post(`/warranty/returns/${record.id}/mark-received`, modalInput);
        toast.success(`Marked #${record.return_number} received at central warehouse.`);
      } else if (type === 'inspect') {
        await api.post(`/warranty/returns/${record.id}/inspect`, {
          inspection_result: modalInput.inspection_result || 'PASS',
          inspection_notes: modalInput.inspection_notes,
        });
        toast.success(`Inspection recorded for #${record.return_number}.`);
      } else if (type === 'close') {
        await api.post(`/warranty/returns/${record.id}/close`, modalInput);
        toast.success(`Return #${record.return_number} successfully closed.`);
      }

      setActiveReturnModal(null);
      setModalInput({});
      fetchWarranty();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // ── Retry WhatsApp Message ─────────────────────────────────────────────────
  const handleRetryMessage = async (msgId: string) => {
    setIsRetryingMsg(true);
    try {
      await api.post(`/warranty/messages/${msgId}/retry`, {});
      toast.success('WhatsApp activation message retry queued!');
      fetchWarranty();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to retry message.');
    } finally {
      setIsRetryingMsg(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loading) {
    return (
      <AppShell>
        <Topbar title="Warranty Details" />
        <PageLoader />
      </AppShell>
    );
  }

  if (!warranty) {
    return (
      <AppShell>
        <Topbar title="Warranty Not Found" />
        <div className="p-12 text-center text-slate-400">
          <ShieldAlert size={36} className="mx-auto mb-3 text-rose-500" />
          <p className="text-sm font-bold text-slate-800">Warranty record not found.</p>
          <Link href="/warranty" className="mt-3 inline-block text-xs text-amber-600 hover:underline">
            &larr; Return to Warranty Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const today = new Date();
  const startDate = new Date(warranty.warranty_start_at || warranty.warranty_start_date || warranty.created_at);
  const endDate = new Date(warranty.warranty_end_at || warranty.warranty_end_date || new Date());
  const diffTime = endDate.getTime() - today.getTime();
  const totalDuration = Math.max(1, endDate.getTime() - startDate.getTime());
  const elapsed = Math.max(0, today.getTime() - startDate.getTime());
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const currentWStatus = warranty.warranty_status || 'inactive';
  const isActive = currentWStatus === 'ACTIVE' || warranty.status === 'ACTIVE';

  const getWarrantyStatusBadge = (ws: WarrantyStatusEnum | string) => {
    switch (ws) {
      case 'ACTIVE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Active Coverage
          </span>
        );
      case 'ACTIVATION_MESSAGE_SCHEDULED':
      case 'ACTIVATION_MESSAGE_SENT':
      case 'ACTIVATION_PENDING':
      case 'pending_activation':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 inline-flex items-center gap-1.5">
            <Clock size={13} /> Pending Activation
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 inline-flex items-center gap-1.5">
            <Truck size={13} /> Delivered
          </span>
        );
      case 'INSTALLATION_COMPLETED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1.5">
            <Wrench size={13} /> Installed (24h Pending)
          </span>
        );
      case 'RETURN_REQUESTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1.5">
            <RotateCcw size={13} /> Return Requested
          </span>
        );
      case 'RETURN_APPROVED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1.5">
            <AlertTriangle size={13} /> Return Approved
          </span>
        );
      case 'RETURNED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/25 text-rose-200 border border-rose-500/50 inline-flex items-center gap-1.5">
            <XCircle size={13} /> Product Returned
          </span>
        );
      case 'WARRANTY_CANCELLED':
      case 'WARRANTY_VOIDED':
      case 'inactive':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-700/60 text-slate-300 border border-slate-600 inline-flex items-center gap-1.5">
            <ShieldX size={13} /> Inactive / Reset
          </span>
        );
      case 'WARRANTY_EXPIRED':
      case 'expired':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-500/20 text-orange-300 border border-orange-500/40 inline-flex items-center gap-1.5">
            <Clock size={13} /> Expired
          </span>
        );
      default:
        return <Badge label={ws} />;
    }
  };

  return (
    <AppShell>
      <Topbar
        title={`Warranty ${warranty.warranty_number}`}
        subtitle="Customer product warranty lifecycle, activation, return management, reset controls, and immutable audit logs"
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <Link
            href="/warranty"
            className="inline-flex items-center gap-1.5 font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Warranty Console
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Record ID:</span>
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {warranty.id}
            </span>
          </div>
        </div>

        {/* Return / Reset Active Banner */}
        {warranty.is_returned && (
          <div className="p-4.5 rounded-2xl border border-rose-300 bg-gradient-to-r from-rose-50 to-orange-50 text-rose-950 flex items-start gap-3.5 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/30 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-extrabold text-rose-950">
                  Reverse Logistics Active / Warranty Reset
                </h4>
                {warranty.warranty_reset_date && (
                  <span className="text-[11px] font-bold bg-rose-200 text-rose-900 px-3 py-0.5 rounded-full border border-rose-300">
                    Reset on {fmtDate(warranty.warranty_reset_date)} by {warranty.resetByUser?.name || 'Administrator'}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                {warranty.returned_reason || warranty.warranty_reset_reason
                  ? `Reason: "${warranty.returned_reason || warranty.warranty_reset_reason}". Historical evidence and documents preserved in audit timeline.`
                  : 'This item is active in reverse logistics. The warranty state has been archived.'}
              </p>
            </div>
          </div>
        )}

        {/* Hero Banner with Warranty Status & Action Ribbon */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-navy to-slate-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl md:text-3xl font-extrabold font-mono text-white tracking-tight flex items-center gap-2">
                  {warranty.warranty_number}
                  <button
                    onClick={() => copyToClipboard(warranty.warranty_number, 'Warranty Number')}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Copy Warranty Number"
                  >
                    <Copy size={15} />
                  </button>
                </h2>
                {getWarrantyStatusBadge(currentWStatus)}
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-amber-400 border border-white/20">
                  Channel: {warranty.marketplace || 'Direct'}
                </span>
              </div>

              <div>
                <p className="text-base font-bold text-slate-100">
                  {warranty.product_name_snapshot}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    ({warranty.brand_snapshot || 'AkuaBeat'} • Model: {warranty.model_snapshot || 'Standard'})
                  </span>
                </p>
                {warranty.serial_number && (
                  <p className="text-xs text-amber-400 font-mono mt-0.5">
                    Serial Number: <strong className="text-white">{warranty.serial_number}</strong>
                  </p>
                )}
              </div>

              {/* Progress Validity Bar */}
              <div className="pt-2 max-w-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Start: {fmtDate(warranty.warranty_start_at || warranty.warranty_start_date)}</span>
                  <span className={`font-bold ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {isActive ? `${daysRemaining} Days Remaining` : 'Coverage Inactive'}
                  </span>
                  <span>End: {fmtDate(warranty.warranty_end_at || warranty.warranty_end_date)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isActive ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-slate-500'
                    }`}
                    style={{ width: `${isActive ? 100 - progressPercent : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Action Ribbon */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              {!isActive && (
                <button
                  onClick={handleActivateWarranty}
                  disabled={isActivating}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
                >
                  <CheckCircle2 size={15} />
                  <span>Activate 1-Yr Warranty</span>
                </button>
              )}

              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
              >
                <Wrench size={15} />
                <span>Create Service Ticket</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsReturnModalOpen(true)}
                  className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>Return</span>
                </button>
                <button
                  onClick={() => setIsResetModalOpen(true)}
                  className="flex-1 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Undo2 size={13} />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Workspace Segmented Tabs Bar */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Overview &amp; Equipment Specs</span>
          </button>

          <button
            onClick={() => setActiveTab('service')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'service'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Wrench size={14} />
            <span>Service Tickets &amp; Jobs</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${activeTab === 'service' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {warranty.serviceRequests?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'returns'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <RotateCcw size={14} />
            <span>Return Cases &amp; Reverse Logistics</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${activeTab === 'returns' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {warranty.returns?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'messages'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <MessageSquare size={14} />
            <span>WhatsApp / SMS Log</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${activeTab === 'messages' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {warranty.messages?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <History size={14} />
            <span>Audit Trail &amp; Documents</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] ${activeTab === 'audit' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {warranty.events?.length || 0}
            </span>
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Customer Profile */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                        <User size={15} />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Customer Details</h3>
                    </div>
                    {warranty.customer && (
                      <Link href={`/customers/${warranty.customer.id}`} className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-0.5">
                        Profile <ArrowUpRight size={11} />
                      </Link>
                    )}
                  </div>

                  {warranty.customer ? (
                    <div className="space-y-2 pt-2 text-xs">
                      <p className="text-sm font-bold text-slate-900">{warranty.customer.name}</p>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone size={13} className="text-slate-400" />
                        <span className="font-mono font-medium">{warranty.customer.phone}</span>
                      </div>
                      {warranty.customer.email && (
                        <p className="text-slate-500 text-[11px]">{warranty.customer.email}</p>
                      )}
                      <div className="flex items-start gap-2 text-slate-600 text-[11px] pt-1">
                        <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          {[warranty.customer.address_line1, warranty.customer.city, warranty.customer.state, warranty.customer.pincode].filter(Boolean).join(', ') || 'No street address'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 pt-2">No customer record linked.</p>
                  )}
                </div>

                {warranty.customer?.phone && (
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <a
                      href={`tel:${warranty.customer.phone}`}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-center text-[11px] transition-colors"
                    >
                      Call Customer
                    </a>
                    <a
                      href={`https://wa.me/${warranty.customer.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-center text-[11px] transition-colors"
                    >
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>

              {/* Order Attribution */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                        <ShoppingCart size={15} />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Order &amp; Purchase</h3>
                    </div>
                    {warranty.order && (
                      <Link href={`/orders/${warranty.order.id}`} className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-0.5">
                        Order <ArrowUpRight size={11} />
                      </Link>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 text-xs">
                    {warranty.order ? (
                      <>
                        <p className="text-sm font-bold font-mono text-slate-900">
                          Order #{warranty.order.order_number || warranty.order.id}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Marketplace ID:</span>
                          <span className="font-mono text-slate-800">{warranty.order.marketplace_order_id || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Order Status:</span>
                          <Badge variant="outline">{warranty.order.status}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Purchase Date:</span>
                          <span className="font-medium text-slate-800">{fmtDate(warranty.order.order_date || warranty.order.created_at)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Order Ref:</span>
                          <span className="font-mono font-bold text-slate-800">{warranty.order_id || 'Direct Registration'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Channel:</span>
                          <span className="font-medium text-slate-800">{warranty.marketplace || 'Direct'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Purchase Date:</span>
                          <span className="font-medium text-slate-800">{fmtDate(warranty.purchase_date)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery, Installation & 24h Activation SLA */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <Clock size={15} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Delivery &amp; SLA Status</h3>
                </div>

                <div className="space-y-2.5 pt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Delivered:</span>
                    {warranty.delivered_at ? (
                      <span className="font-semibold text-emerald-700">{fmtDateTime(warranty.delivered_at)}</span>
                    ) : (
                      <span className="text-slate-400 italic">Pending Carrier</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Installation:</span>
                    {warranty.installation_completed_at ? (
                      <span className="font-semibold text-emerald-700">{fmtDateTime(warranty.installation_completed_at)}</span>
                    ) : (
                      <span className="text-slate-400 italic">Pending Technician</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">24h SLA Due:</span>
                    {warranty.activation_due_at ? (
                      <span className="font-mono font-bold text-indigo-700">{fmtDateTime(warranty.activation_due_at)}</span>
                    ) : (
                      <span className="text-slate-400 italic">Awaiting Install</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Activation Link Sent:</span>
                    {warranty.activation_sent_at ? (
                      <span className="font-semibold text-teal-700">{fmtDateTime(warranty.activation_sent_at)}</span>
                    ) : (
                      <span className="text-slate-400 italic">Not Dispatched</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Vault Preview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText size={17} className="text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Purchase Invoice &amp; Customer Proof</h3>
                </div>
                <span className="text-xs text-slate-500">{warranty.documents?.length || 0} Files</span>
              </div>

              {!warranty.documents || warranty.documents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No invoice or documentation uploaded for this warranty.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {warranty.documents.map((doc) => (
                    <div key={doc.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="truncate text-xs">
                          <p className="font-bold text-slate-900 truncate" title={doc.file_name}>
                            {doc.file_name}
                          </p>
                          <p className="text-[10px] text-slate-500">{fmtDate(doc.uploaded_at)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`/api/warranty/documents/${doc.id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                          title="View Inline"
                        >
                          <Eye size={14} />
                        </a>
                        <a
                          href={`/api/warranty/documents/${doc.id}/download`}
                          download
                          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                          title="Download File"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Service Tickets */}
        {activeTab === 'service' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="text-purple-600" size={17} /> Technician Service Tickets
                </h3>
                <p className="text-xs text-slate-500">Service complaints, technician dispatch, parts logs, and resolution details</p>
              </div>
              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} />
                <span>New Service Ticket</span>
              </button>
            </div>

            {!warranty.serviceRequests || warranty.serviceRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Wrench size={30} className="mx-auto mb-2 opacity-40 text-purple-600" />
                <p>No service tickets recorded for this product.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {warranty.serviceRequests.map((sr) => (
                  <div key={sr.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 p-3 rounded-xl transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <Link
                          href={`/warranty/service-requests/${sr.id}`}
                          className="font-mono font-bold text-slate-900 hover:text-purple-700 hover:underline"
                        >
                          {sr.service_request_number}
                        </Link>
                        <Badge variant={sr.status === 'COMPLETED' ? 'success' : 'warning'}>{sr.status}</Badge>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {sr.priority} Priority
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900">{sr.issue}</p>
                      {sr.description && <p className="text-slate-500 text-[11px]">{sr.description}</p>}
                      {sr.technician && (
                        <p className="text-slate-600 text-[11px]">Assigned Technician: <strong>{sr.technician.name}</strong></p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-slate-400 text-[11px]">{fmtDate(sr.created_at)}</span>
                      <Link href={`/warranty/service-requests/${sr.id}`}>
                        <button className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold rounded-xl text-[11px] flex items-center gap-1 transition-colors">
                          <Eye size={12} /> Dispatch Console
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Returns & Reverse Logistics */}
        {activeTab === 'returns' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="text-amber-600" size={17} /> Reverse Logistics &amp; Return Cases
                </h3>
                <p className="text-xs text-slate-500">Return requests, courier pickup scheduling, central warehouse receipt, and QC inspection</p>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} />
                <span>Initiate Return</span>
              </button>
            </div>

            {!warranty.returns || warranty.returns.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <RotateCcw size={30} className="mx-auto mb-2 opacity-40 text-amber-600" />
                <p>No return cases recorded for this product warranty.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {warranty.returns.map((ret) => (
                  <div key={ret.id} className="py-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-slate-900 text-sm">{ret.return_number}</span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            ret.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ret.status === 'REQUESTED'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : ret.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {ret.status}
                        </span>
                        <span className="text-slate-400 text-[11px]">Requested: {fmtDate(ret.requested_at)}</span>
                      </div>

                      {/* Return Action Workflow Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ret.status === 'REQUESTED' && (
                          <>
                            <button
                              onClick={() => setActiveReturnModal({ type: 'approve', record: ret })}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setActiveReturnModal({ type: 'reject', record: ret })}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {ret.status === 'APPROVED' && (
                          <button
                            onClick={() => setActiveReturnModal({ type: 'pickup', record: ret })}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <Truck size={11} /> Schedule Pickup
                          </button>
                        )}

                        {ret.status === 'PICKUP_SCHEDULED' && (
                          <button
                            onClick={() => setActiveReturnModal({ type: 'received', record: ret })}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <Check size={11} /> Mark Received
                          </button>
                        )}

                        {ret.status === 'RECEIVED' && (
                          <button
                            onClick={() => setActiveReturnModal({ type: 'inspect', record: ret })}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <CheckSquare size={11} /> Inspect
                          </button>
                        )}

                        {['INSPECTED', 'ACCEPTED'].includes(ret.status) && (
                          <button
                            onClick={() => setActiveReturnModal({ type: 'close', record: ret })}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] transition-colors"
                          >
                            Close Return
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-slate-700">
                      <p>
                        <strong>Reason ({ret.reason_code || 'DEFECTIVE'}):</strong> {ret.reason_text}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-500">
                      <div>
                        <span>Pickup: </span>
                        <strong className="text-slate-900">{ret.pickup_tracking_number || 'Pending'}</strong>
                      </div>
                      <div>
                        <span>Received at Warehouse: </span>
                        <strong className="text-slate-900">{ret.received_at ? fmtDate(ret.received_at) : 'No'}</strong>
                      </div>
                      <div>
                        <span>QC Inspection: </span>
                        <strong className="text-slate-900">{ret.inspection_result || 'Pending'}</strong>
                      </div>
                      <div>
                        <span>Closed: </span>
                        <strong className="text-slate-900">{ret.closed_at ? fmtDate(ret.closed_at) : 'Open'}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Messages */}
        {activeTab === 'messages' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="text-emerald-600" size={17} /> WhatsApp &amp; SMS Dispatch Logs
                </h3>
                <p className="text-xs text-slate-500">Automated 24h warranty activation links, reminder dispatches, and delivery status</p>
              </div>
              <span className="text-xs text-slate-500">{warranty.messages?.length || 0} Dispatches</span>
            </div>

            {!warranty.messages || warranty.messages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <MessageSquare size={30} className="mx-auto mb-2 opacity-40 text-emerald-600" />
                <p>No WhatsApp or SMS activation messages logged yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {warranty.messages.map((msg) => (
                  <div key={msg.id} className="py-3.5 flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-slate-900">Template: {msg.template_key}</span>
                        <Badge variant={msg.delivery_status === 'SENT' || msg.delivery_status === 'DELIVERED' ? 'success' : 'danger'}>
                          {msg.delivery_status}
                        </Badge>
                        <span className="text-slate-500 text-[11px]">Attempts: {msg.attempt_count}</span>
                      </div>
                      <p className="text-slate-500 font-mono text-[11px]">
                        To: {msg.phone_number} • Message ID: {msg.provider_message_id || 'Queued'}
                      </p>
                      {msg.activation_url && (
                        <p className="text-[11px] text-indigo-600 truncate max-w-md">
                          Activation Link: {msg.activation_url}
                        </p>
                      )}
                      {msg.failure_reason && (
                        <p className="text-[11px] text-rose-600 font-semibold">Error: {msg.failure_reason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[11px]">{fmtDateTime(msg.sent_at || msg.created_at)}</span>
                      {msg.delivery_status === 'FAILED' && (
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={<Send size={11} />}
                          loading={isRetryingMsg}
                          onClick={() => handleRetryMessage(msg.id)}
                        >
                          Retry Send
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="text-indigo-600" size={17} /> Immutable Lifecycle Timeline
                </h3>
                <p className="text-xs text-slate-500">Chronological history of state changes, technician visits, return inspections, and employee audits</p>
              </div>
              <span className="text-xs text-slate-500">{warranty.events?.length || 0} Events</span>
            </div>

            {!warranty.events || warranty.events.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <History size={30} className="mx-auto mb-2 opacity-40 text-indigo-600" />
                <p>No timeline events recorded.</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {warranty.events.map((ev) => (
                  <div key={ev.id} className="relative text-xs space-y-1">
                    <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white shadow-xs" />
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-bold text-slate-900">{ev.title}</p>
                      <span className="text-slate-400 text-[10px]">{fmtDateTime(ev.timestamp || ev.created_at)}</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{ev.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span>Source: <strong className="text-slate-800">{ev.source_type || 'SYSTEM'}</strong></span>
                      {ev.actor && <span>Actor: <strong className="text-slate-800">{ev.actor.name}</strong></span>}
                      {ev.to_status && <span>Status Transition &rarr; <strong className="text-slate-900">{ev.to_status}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Modals ────────────────────────────────────────────────────────── */}

        {/* Create Service Request Modal */}
        <CreateServiceRequestModal
          isOpen={isServiceModalOpen}
          warrantyId={warranty.id}
          warranty={warranty}
          onClose={() => setIsServiceModalOpen(false)}
          onSuccess={() => {
            fetchWarranty();
            setActiveTab('service');
          }}
        />

        {/* Request Return Modal */}
        {isReturnModalOpen && (
          <Modal
            open={isReturnModalOpen}
            onClose={() => setIsReturnModalOpen(false)}
            title="🔄 Request Product Return (Reverse Logistics)"
          >
            <form onSubmit={handleReturnSubmit} className="space-y-4 pt-1">
              <div>
                <Select
                  label="Return Reason Code"
                  value={returnForm.reason_code}
                  onChange={(e) => setReturnForm({ ...returnForm, reason_code: e.target.value })}
                  options={[
                    { value: 'DEFECTIVE', label: 'DEFECTIVE — Product Malfunction / Hardware Issue' },
                    { value: 'DAMAGED_IN_TRANSIT', label: 'DAMAGED_IN_TRANSIT — Transit Damage' },
                    { value: 'WRONG_ITEM', label: 'WRONG_ITEM — Incorrect Model Dispatched' },
                    { value: 'BUYER_REMORSE', label: 'BUYER_REMORSE — Customer Cancelled / Changed Mind' },
                    { value: 'EXCHANGE', label: 'EXCHANGE — Unit Replacement Requested' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Detailed Reason <span className="text-rose-500">*</span></label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the exact fault or customer return reason..."
                  value={returnForm.reason_text}
                  onChange={(e) => setReturnForm({ ...returnForm, reason_text: e.target.value })}
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Internal Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Notes for logistics / warehouse inspection team..."
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setIsReturnModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={isSubmittingReturn} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                  Submit Return Request
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Return Action Execution Modal */}
        {activeReturnModal && (
          <Modal
            open={!!activeReturnModal}
            onClose={() => setActiveReturnModal(null)}
            title={`Reverse Logistics: ${activeReturnModal.type.toUpperCase()} Return #${activeReturnModal.record.return_number}`}
          >
            <form onSubmit={handleReturnActionSubmit} className="space-y-4 pt-1">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-700">
                <p><strong className="text-slate-900">Customer:</strong> {activeReturnModal.record.customer?.name} ({activeReturnModal.record.customer?.phone})</p>
                <p><strong className="text-slate-900">Reason:</strong> {activeReturnModal.record.reason_text}</p>
              </div>

              {activeReturnModal.type === 'approve' && (
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Controller Approval Remarks</label>
                  <textarea
                    rows={3}
                    placeholder="Enter approval notes or instructions for logistics team..."
                    value={modalInput.notes || ''}
                    onChange={(e) => setModalInput({ ...modalInput, notes: e.target.value })}
                    className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900"
                  />
                </div>
              )}

              {activeReturnModal.type === 'reject' && (
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">Rejection Reason <span className="text-rose-500">*</span></label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Specify why this return is rejected (policy violation, damage out-of-scope)..."
                    value={modalInput.reason || ''}
                    onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                    className="w-full p-3 text-xs border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900"
                  />
                </div>
              )}

              {activeReturnModal.type === 'pickup' && (
                <div className="space-y-3">
                  <Input
                    label="Pickup Partner / Courier"
                    value={modalInput.pickup_partner || 'BlueDart Express'}
                    onChange={(e) => setModalInput({ ...modalInput, pickup_partner: e.target.value })}
                  />
                  <Input
                    label="Tracking / AWB Number"
                    placeholder="e.g. BD-RET-9923841"
                    value={modalInput.pickup_tracking_number || ''}
                    onChange={(e) => setModalInput({ ...modalInput, pickup_tracking_number: e.target.value })}
                  />
                  <Input
                    label="Scheduled Pickup Date"
                    type="date"
                    value={modalInput.pickup_scheduled_date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setModalInput({ ...modalInput, pickup_scheduled_date: e.target.value })}
                  />
                </div>
              )}

              {activeReturnModal.type === 'inspect' && (
                <div className="space-y-3">
                  <div>
                    <Select
                      label="Inspection Result"
                      value={modalInput.inspection_result || 'PASS'}
                      onChange={(e) => setModalInput({ ...modalInput, inspection_result: e.target.value })}
                      options={[
                        { value: 'PASS', label: 'PASS — Verified Genuine & Eligible' },
                        { value: 'FAIL', label: 'FAIL — Damaged / Tampered by Customer' },
                        { value: 'DAMAGED', label: 'DAMAGED — Physical transit damage' },
                        { value: 'MISSING_PARTS', label: 'MISSING_PARTS — Accessories incomplete' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1">Quality Inspector Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Inspection observations..."
                      value={modalInput.inspection_notes || ''}
                      onChange={(e) => setModalInput({ ...modalInput, inspection_notes: e.target.value })}
                      className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900"
                    />
                  </div>
                </div>
              )}

              {activeReturnModal.type === 'close' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      id="replacementCheckbox"
                      checked={!!modalInput.create_replacement}
                      onChange={(e) => setModalInput({ ...modalInput, create_replacement: e.target.checked })}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <label htmlFor="replacementCheckbox" className="text-xs font-bold text-slate-900 cursor-pointer">
                      Create Replacement Unit Warranty Automatically
                    </label>
                  </div>

                  {modalInput.create_replacement && (
                    <Input
                      label="Replacement Unit Serial Number"
                      placeholder="e.g. SN-REP-2026-0091"
                      value={modalInput.replacement_serial_number || ''}
                      onChange={(e) => setModalInput({ ...modalInput, replacement_serial_number: e.target.value })}
                    />
                  )}

                  <Input
                    label="Refund ID / Accounting Reference (Optional)"
                    placeholder="e.g. REF-AXIS-992144"
                    value={modalInput.refund_id || ''}
                    onChange={(e) => setModalInput({ ...modalInput, refund_id: e.target.value })}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setActiveReturnModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={isProcessingAction} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                  Confirm &amp; Update
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Reset Warranty Modal */}
        {isResetModalOpen && (
          <Modal
            open={isResetModalOpen}
            onClose={() => setIsResetModalOpen(false)}
            title="⚠️ Manual Warranty Reset (Return / Inactive)"
          >
            <form onSubmit={handleResetSubmit} className="space-y-4 pt-1">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-700" /> Preserves Complete History
                </p>
                <p className="text-slate-700">
                  Resetting warranty <strong className="text-slate-900">{warranty.warranty_number}</strong> marks it Inactive/Cancelled due to product return. All historical events and customer documents remain permanently auditable.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1.5">
                  Mandatory Reset Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Product returned via Amazon return center. Awaiting courier receipt."
                  value={resetReason}
                  onChange={(e) => setResetReason(e.target.value)}
                  className="w-full p-3 text-xs border border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setIsResetModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" loading={isResetting}>
                  Confirm Warranty Reset
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </AppShell>
  );
}
