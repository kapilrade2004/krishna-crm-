'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import {
  useOrder, useUpdateOrderStatus, useUpdateOrderVerificationStatus, useUpdateFlowStage,
  useShippingPartners, useUpdateOrderShipping, useCheckServiceability,
  useOrderImages, useApproveImages, useRejectImages,
  useOrderCallLogs, useCreateCallLog,
  useUpdateFeedbackResolution, useSendVerificationMessage, useCustomerConfirmOrder,
  useSkuMatchOrder, useSkuMismatchOrder,
} from '@/hooks/useApi';
import { Badge, Button, PageLoader, Select, Textarea, Modal, Input } from '@/components/ui';
import {
  formatCurrency, fmtDateTime, fmtDate, timeAgo, getMediaUrl,
  ORDER_STATUS_COLOURS, VERIFICATION_STATUS_COLOURS, VERIFICATION_STATUS_OPTIONS, MARKETPLACE_COLOURS, buildTrackingUrl,
  CALL_OUTCOMES, CALL_CONTEXTS, CALL_OUTCOME_COLOURS, FEEDBACK_STATUS_COLOURS, VALID_ORDER_TRANSITIONS,
} from '@/lib/utils';
import {
  ArrowLeft, Package, MapPin, Phone, MessageCircle, Truck, CheckCircle2,
  ImageIcon, ClipboardList, Star, ExternalLink, Clock,
  XCircle, CheckCircle, PhoneCall, AlertTriangle, ShieldCheck, Send, FileText,
  ZoomIn, ZoomOut, RotateCcw, Download, Eye, RefreshCw, X, Check, PackageCheck,
} from 'lucide-react';
import type { FlowStage, CallOutcome, CallContext } from '@/types';
import OrderWhatsAppSection from '@/components/orders/OrderWhatsAppSection';

// ── Flow stage definitions (matches SOW mindmap) ──────────────────────────────
const FLOW_STAGES: { key: FlowStage; label: string; group: number }[] = [
  { key: 'ask_images',         label: '1. Ask Images',         group: 1 },
  { key: 'match_pending',      label: '2. Matching',           group: 2 },
  { key: 'match_confirmed',    label: '2.1 Match Confirmed',   group: 2 },
  { key: 'match_alternate',    label: '2.2 Alternate Price',   group: 2 },
  { key: 'match_reorder',      label: '2.3 Reorder',           group: 2 },
  { key: 'match_cancelled',    label: '2.4 Cancellation',      group: 2 },
  { key: 'processing',         label: '3. Processing',         group: 3 },
  { key: 'delivery_confirmed', label: '4. Delivery Confirmed', group: 4 },
  { key: 'installation',       label: '5. Installation',       group: 5 },
  { key: 'feedback_pending',   label: '6. Feedback Pending',   group: 6 },
  { key: 'completed',          label: '7. Completed',          group: 7 },
];
const MAIN_STEPS = [
  { group: 1, label: 'Ask Images' },
  { group: 2, label: 'Match' },
  { group: 3, label: 'Process' },
  { group: 4, label: 'Delivery' },
  { group: 5, label: 'Installation' },
  { group: 6, label: 'Feedback' },
  { group: 7, label: 'Done' },
];

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = ['Details', 'Images', 'Call Logs', 'Activity', 'Feedback', 'Warranty'] as const;
type Tab = typeof TABS[number];

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  // Core data
  const { data: order, isLoading } = useOrder(id);
  const updateStatus   = useUpdateOrderStatus();
  const updateFlow     = useUpdateFlowStage();
  const updateShipping = useUpdateOrderShipping();

  // CR1 — Image verification
  const { data: images = [] }  = useOrderImages(id);
  const approveImages          = useApproveImages();
  const rejectImages           = useRejectImages();

  // CR2 — Call logs
  const { data: callLogsData } = useOrderCallLogs(id);
  const createCallLog          = useCreateCallLog();

  // CR7 — Feedback resolution
  const updateFeedback = useUpdateFeedbackResolution();

  // Verification status & triggers
  const updateVerificationStatus = useUpdateOrderVerificationStatus();
  const sendVerification = useSendVerificationMessage();
  const customerConfirm = useCustomerConfirmOrder();
  const skuMatch = useSkuMatchOrder();
  const skuMismatch = useSkuMismatchOrder();

  // Shipping
  const { data: partners }     = useShippingPartners({ is_active: true });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('Details');

  // Status / flow modals
  const [statusModal, setStatusModal] = useState(false);
  const [flowModal, setFlowModal]     = useState(false);
  const [nextStatus, setNextStatus]   = useState('');
  const [nextFlow, setNextFlow]       = useState<FlowStage>('ask_images');
  const [note, setNote]               = useState('');

  // Shipping modal
  const [shippingModal, setShippingModal] = useState(false);
  const [shippingForm, setShippingForm]   = useState({
    shipping_partner: '', tracking_number: '', delivery_pincode: '',
    estimated_delivery_date: '', mark_dispatched: false,
  });
  const { data: serviceability } = useCheckServiceability(
    shippingModal ? shippingForm.delivery_pincode : null
  );

  // CR1 & Inbound Media — Image verification workstation states
  const [rejectModal, setRejectModal]         = useState(false);
  const [rejectReason, setRejectReason]       = useState('');
  const [targetImageId, setTargetImageId]     = useState<string | null>(null);
  const [selectedImageForView, setSelectedImageForView] = useState<any | null>(null);
  const [imageZoom, setImageZoom]             = useState(1);
  const [requestImageModal, setRequestImageModal] = useState(false);
  const [requestImageReason, setRequestImageReason] = useState('Please share a clear photo of your kitchen tap and aerator.');

  // CR2 — Log call modal
  const [callModal, setCallModal] = useState(false);
  const [callForm, setCallForm]   = useState({
    call_type:        'outbound' as 'outbound' | 'inbound',
    outcome:          'answered' as CallOutcome,
    context:          'general' as CallContext,
    phone_used:       '',
    duration_seconds: '' as string | number,
    notes:            '',
    called_at:        new Date().toISOString().slice(0, 16),
  });

  // CR7 — Feedback modal
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm]   = useState({
    feedback_status:      'not_collected',
    feedback_issue_notes: '',
    customer_feedback:    '',
    feedback_rating:      '' as string | number,
  });

  if (isLoading || !order) {
    return <AppShell><Topbar title="Order Detail" /><PageLoader /></AppShell>;
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const VALID_TRANSITIONS: Record<string, string[]> = {
    pending:              ['image_verification', 'confirmed', 'cancelled'],
    image_verification:   ['pending_confirmation', 'confirmed', 'cancelled'],
    pending_confirmation: ['confirmed', 'cancelled'],
    confirmed:            ['processing', 'dispatched', 'delivered', 'cancelled'],
    processing:           ['dispatched', 'delivered', 'cancelled'],
    dispatched:           ['delivered', 'returned'],
    delivered:            ['returned', 'refunded'],
    cancelled: [], returned: ['refunded'], refunded: [],
  };
  const allowedNext    = VALID_TRANSITIONS[order.status] || [];
  const currentGroup   = FLOW_STAGES.find(f => f.key === order.flow_stage)?.group || 1;
  const receivedImages = images.filter((i: any) => i.status === 'received');
  const callLogs       = callLogsData?.data || [];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStatusUpdate = async () => {
    await updateStatus.mutateAsync({ id: order.id, status: nextStatus, note });
    setStatusModal(false); setNote('');
  };
  const handleFlowUpdate = async () => {
    await updateFlow.mutateAsync({ id: order.id, flow_stage: nextFlow, note });
    setFlowModal(false); setNote('');
  };
  const handleShippingUpdate = async () => {
    await updateShipping.mutateAsync({ id: order.id, ...shippingForm });
    setShippingModal(false);
  };
  const handleApproveImages = async (imgId?: string) => {
    await approveImages.mutateAsync({ id: order.id, ...(imgId && { imageId: imgId }) } as any);
    if (selectedImageForView) {
      if (!imgId || selectedImageForView.id === imgId) {
        setSelectedImageForView((prev: any) => prev ? { ...prev, status: 'approved' } : null);
      }
    }
  };
  const handleOpenRejectModal = (imgId?: string) => {
    setTargetImageId(imgId || null);
    setRejectModal(true);
  };
  const handleRejectImages = async () => {
    await rejectImages.mutateAsync({
      id: order.id,
      reason: rejectReason,
      request_new: true,
      ...(targetImageId && { imageId: targetImageId }),
    } as any);
    setRejectModal(false);
    setRejectReason('');
    setTargetImageId(null);
    if (selectedImageForView) {
      setSelectedImageForView(null);
    }
  };
  const handleRequestNewImage = async () => {
    try {
      const { default: api } = await import('@/lib/api');
      await api.post(`/orders/${order.id}/request-new-image`, { reason: requestImageReason });
      setRequestImageModal(false);
      const { toast } = await import('react-hot-toast');
      toast.success('WhatsApp image request sent to customer.');
    } catch (err: any) {
      const { toast } = await import('react-hot-toast');
      toast.error(err?.response?.data?.message || 'Failed to send image request.');
    }
  };
  const handleLogCall = async () => {
    await createCallLog.mutateAsync({
      customer_id:      order.customer_id,
      order_id:         order.id,
      ...callForm,
      duration_seconds: callForm.duration_seconds === '' ? undefined : Number(callForm.duration_seconds),
    });
    setCallModal(false);
    setCallForm({ call_type: 'outbound', outcome: 'answered', context: 'general', phone_used: '', duration_seconds: '', notes: '', called_at: new Date().toISOString().slice(0, 16) });
  };
  const handleFeedbackSave = async () => {
    await updateFeedback.mutateAsync({
      id: order.id,
      ...feedbackForm,
      feedback_rating: feedbackForm.feedback_rating === '' ? undefined : Number(feedbackForm.feedback_rating),
    });
    setFeedbackModal(false);
  };

  return (
    <AppShell>
      <Topbar title={order.order_number} subtitle={`Created ${fmtDateTime(order.created_at)}`} />
      <main className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Back + status badges */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted hover:text-navy transition-colors">
            <ArrowLeft size={14} /> Back to Orders
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={order.marketplace} colorClass={MARKETPLACE_COLOURS[order.marketplace]} />

            {/* Order Lifecycle Status Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-border px-2 py-1 rounded-lg">
              <span className="text-[11px] font-semibold text-muted">Status:</span>
              <Select
                value={order.status}
                disabled={updateStatus.isPending}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next !== order.status) {
                    updateStatus.mutate({ id: order.id, status: next, note: `Status updated to ${next} from Order Detail.` });
                  }
                }}
                options={[
                  { value: order.status, label: order.status.replace('_', ' ') },
                  ...(VALID_ORDER_TRANSITIONS[order.status] || []).map((s) => ({
                    value: s,
                    label: s.replace('_', ' '),
                  })),
                ]}
                className="w-36 text-xs font-semibold capitalize"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-border px-2 py-1 rounded-lg">
              <span className="text-[11px] font-semibold text-muted">Verification:</span>
              <Select
                value={order.verification_status || 'pending_verification'}
                disabled={updateVerificationStatus.isPending}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next !== order.verification_status) {
                    updateVerificationStatus.mutate({ id: order.id, verification_status: next });
                  }
                }}
                options={VERIFICATION_STATUS_OPTIONS}
                className="w-44 text-xs font-semibold"
              />
            </div>

            {/* Prominent Mark Delivered Button */}
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <Button
                size="sm"
                variant="primary"
                icon={<PackageCheck size={14} />}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                loading={updateStatus.isPending}
                onClick={() => {
                  updateStatus.mutate({
                    id: order.id,
                    status: 'delivered',
                    note: 'Order marked as Delivered. Automatically triggering order_deliverd followed by warranty_claim WhatsApp templates.',
                  });
                }}
                title="Mark this order as delivered. This dispatches the 'order_deliverd' WhatsApp notification followed instantly by the 'warranty_claim' template."
              >
                Mark as Delivered ✓
              </Button>
            )}

            {order.status === 'delivered' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Delivered &amp; Warranty Dispatched</span>
              </span>
            )}

            {order.customer_confirmed_at && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>Customer Confirmed ({fmtDateTime(order.customer_confirmed_at)})</span>
              </span>
            )}
            {order.feedback_status && order.feedback_status !== 'not_collected' && (
              <Badge label={order.feedback_status} colorClass={FEEDBACK_STATUS_COLOURS[order.feedback_status]} />
            )}
            {!['confirmed', 'cancelled', 'delivered'].includes(order.status) && (
              <Button
                size="sm"
                variant="primary"
                icon={<CheckCircle size={13} />}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                loading={customerConfirm.isPending}
                onClick={() => customerConfirm.mutate({ id: order.id, note: 'Manual customer confirmation recorded from Order Detail.' })}
              >
                Customer Confirmed ✓
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              icon={<Send size={13} />}
              className="text-xs text-navy font-semibold border-navy/20 hover:bg-navy/5"
              loading={sendVerification.isPending}
              onClick={() => sendVerification.mutate(order.id)}
            >
              Send WhatsApp Verification
            </Button>
          </div>
        </div>

        {/* 15-Minute Screenshot Verification Countdown Alert Banner */}
        {order.second_message_due_at && !order.second_message_sent_at && !['confirmed', 'cancelled'].includes(order.status) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4.5 py-3.5 flex items-start justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-2.5">
              <Clock size={18} className="text-amber-600 mt-0.5 shrink-0 animate-pulse" />
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-amber-900 flex items-center gap-2">
                  <span>Customer Verification in Progress (15-Minute Timer Active)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 text-amber-900 border border-amber-300">
                    Due: {fmtDateTime(order.second_message_due_at)}
                  </span>
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Customer clicked [Send Screenshot] on WhatsApp. Message 2 (<code className="font-mono bg-amber-100 px-1 rounded">order_confirmation013</code>) is scheduled to dispatch automatically after the 15-minute window or upon controller approval.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="primary"
                icon={<CheckCircle size={13} />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => handleApproveImages()}
                loading={approveImages.isPending}
              >
                Instant Confirm
              </Button>
            </div>
          </div>
        )}

        {/* Pending Customer Confirmation Banner */}
        {order.status === 'pending_confirmation' && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl px-4.5 py-3.5 flex items-start justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-2.5">
              <Clock size={18} className="text-sky-600 mt-0.5 shrink-0 animate-pulse" />
              <div className="space-y-0.5 text-xs">
                <p className="font-bold text-sky-900 flex items-center gap-2">
                  <span>Awaiting Customer Confirmation</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-200 text-sky-900 border border-sky-300">
                    {order.confirmation_sent_at ? fmtDateTime(order.confirmation_sent_at) : 'Dispatched to WhatsApp'}
                  </span>
                </p>
                <p className="text-sky-800 leading-relaxed">
                  Verification message was dispatched to customer. Once customer confirms on WhatsApp, the order will immediately transition to Confirmed. If confirmed via phone call or direct contact, click <strong>Customer Confirmed ✓</strong> below.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="primary"
                icon={<CheckCircle size={13} />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                onClick={() => customerConfirm.mutate({ id: order.id, note: 'Customer confirmed via manual verification.' })}
                loading={customerConfirm.isPending}
              >
                Customer Confirmed ✓
              </Button>
            </div>
          </div>
        )}

        {/* CR1 — Image verification alert banner */}
        {order.status === 'image_verification' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <ImageIcon size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-800">Pending Image Verification</p>
                <p className="text-xs text-purple-600 mt-0.5">
                  {receivedImages.length > 0
                    ? `${receivedImages.length} image(s) received from customer — review in the Images tab.`
                    : 'Waiting for product images from customer. Follow up if needed.'}
                  {order.image_rejection_reason && (
                    <span className="block mt-1 text-red-600">Last rejection: {order.image_rejection_reason}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {receivedImages.length > 0 ? (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<CheckCircle2 size={14} />}
                    loading={skuMatch.isPending}
                    onClick={() => skuMatch.mutate({ id: order.id })}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center gap-1.5"
                    title="Mark product matched and automatically dispatch Message 2 (order_confirmation013) to customer"
                  >
                    Matched ✓ (Send Msg 2)
                  </Button>
                  <Button size="sm" variant="danger" icon={<XCircle size={13} />} onClick={() => setRejectModal(true)}>
                    Reject
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<MessageCircle size={13} />}
                  onClick={() => {
                    const waNumber = (order.customer?.whatsapp_number || order.customer?.phone || '').replace(/\D/g, '');
                    const num = waNumber.length === 10 ? '91' + waNumber : waNumber;
                    const text = `Hi ${order.customer?.name || ''}, regarding your Order #${order.order_number}: Please reply with photos of your product to complete image verification.`;
                    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                  }}
                >
                  Request Photos via WhatsApp
                </Button>
              )}
            </div>
          </div>
        )}

        {/* CR7 — Unhappy customer alert */}
        {['unhappy', 'escalated'].includes(order.feedback_status) && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-danger mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Customer {order.feedback_status === 'escalated' ? 'Escalated' : 'Unhappy'} — Follow-up auto-created
                </p>
                <p className="text-xs text-red-600 mt-0.5">{order.feedback_issue_notes || 'Resolve the issue and update feedback status.'}</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => { setFeedbackForm(f => ({ ...f, feedback_status: order.feedback_status || 'not_collected', feedback_issue_notes: order.feedback_issue_notes || '', customer_feedback: order.customer_feedback || '', feedback_rating: order.feedback_rating || '' })); setFeedbackModal(true); }}>
              Update
            </Button>
          </div>
        )}

        {/* Order Processing Flow Stepper */}
        <div className="card">
          <div className="card-header">
            <p className="card-title">Order Processing Flow</p>
            <Button size="sm" variant="secondary" onClick={() => { setNextFlow(order.flow_stage); setFlowModal(true); }}>
              Update Stage
            </Button>
          </div>
          <div className="flex items-center overflow-x-auto pb-1">
            {MAIN_STEPS.map((step, idx) => {
              const isActive = step.group === currentGroup;
              const isDone   = step.group < currentGroup;
              return (
                <div key={step.group} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-1.5 min-w-[88px]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all
                      ${isDone   ? 'bg-teal border-teal text-white'
                      : isActive ? 'bg-amber border-amber text-navy'
                      :            'bg-white border-border text-muted'}`}>
                      {isDone ? <CheckCircle2 size={14} /> : step.group}
                    </div>
                    <p className={`text-[10px] text-center leading-tight ${isActive ? 'text-navy font-medium' : 'text-muted'}`}>
                      {step.label}
                    </p>
                  </div>
                  {idx < MAIN_STEPS.length - 1 && (
                    <div className={`h-0.5 w-6 flex-shrink-0 mx-1 ${step.group < currentGroup ? 'bg-teal' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-2">
            Current: <span className="font-medium text-navy">{FLOW_STAGES.find(f => f.key === order.flow_stage)?.label}</span>
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-0 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab
                  ? 'border-amber text-amber-700'
                  : 'border-transparent text-muted hover:text-navy'
              }`}
            >
              {tab}
              {tab === 'Images' && receivedImages.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                  {receivedImages.length}
                </span>
              )}
              {tab === 'Call Logs' && callLogs.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  {callLogs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: Details ──────────────────────────────────────────────── */}
        {activeTab === 'Details' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Order info */}
              <div className="card">
                <div className="card-header">
                  <p className="card-title">Order Information</p>
                  <div className="flex gap-2">
                    {allowedNext.length > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => { setNextStatus(allowedNext[0]); setStatusModal(true); }}>
                        Update Status
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="text-muted">Order #</p><p className="font-medium text-navy mt-0.5">{order.order_number}</p></div>
                  <div><p className="text-muted">Marketplace ID</p><p className="font-medium text-navy mt-0.5">{order.marketplace_order_id || '—'}</p></div>
                  <div><p className="text-muted">Marketplace</p><p className="font-medium text-navy mt-0.5 capitalize">{order.marketplace}</p></div>
                  <div><p className="text-muted">Channel / Sub-Channel</p><p className="font-medium text-navy mt-0.5 capitalize">{order.channel ? order.channel.replace(/_/g, ' ') : order.marketplace}</p></div>
                  <div><p className="text-muted">Order Date</p><p className="font-medium text-navy mt-0.5">{order.order_date ? fmtDate(order.order_date) : '—'}</p></div>
                  <div><p className="text-muted">Product</p><p className="font-medium text-navy mt-0.5">{order.product_name || '—'}</p></div>
                  <div><p className="text-muted">SKU</p><p className="font-medium text-navy mt-0.5">{order.product_sku || '—'}</p></div>
                  <div><p className="text-muted">Quantity</p><p className="font-medium text-navy mt-0.5">{order.quantity}</p></div>
                  <div><p className="text-muted">Total Amount</p><p className="font-medium text-navy mt-0.5">{order.total_amount ? formatCurrency(order.total_amount) : '—'}</p></div>
                  <div><p className="text-muted">Images Provided</p><p className="font-medium mt-0.5">
                    <Badge label={order.images_provided ? 'Yes' : 'No'} colorClass={order.images_provided ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'} />
                  </p></div>
                  <div><p className="text-muted">Assigned To</p><p className="font-medium text-navy mt-0.5">{order.assignedUser?.name || '—'}</p></div>

                  {order.importBatch && (
                    <div className="col-span-2 p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 mt-1">
                      <p className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                        <FileText size={13} className="text-amber-700" />
                        CSV Import Batch Record & Timestamps:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted block text-[11px]">Source File:</span>
                          <span className="font-semibold text-navy truncate block" title={order.importBatch.filename}>
                            {order.importBatch.filename}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted block text-[11px]">Upload Date & Time:</span>
                          <span className="font-semibold text-navy font-mono">
                            {fmtDateTime(order.importBatch.created_at)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted block text-[11px]">Marketplace / Channel:</span>
                          <span className="font-semibold text-navy capitalize">
                            {order.importBatch.channel ? order.importBatch.channel.replace(/_/g, ' ') : order.importBatch.marketplace}
                          </span>
                        </div>
                      </div>
                      {order.importBatch.uploader?.name && (
                        <p className="text-[11px] text-muted pt-0.5">
                          Uploaded by: <strong className="text-slate-700">{order.importBatch.uploader.name}</strong>
                          {order.importBatch.uploader.email && ` (${order.importBatch.uploader.email})`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {order.internal_notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted">Internal Notes</p>
                    <p className="text-xs text-navy mt-1">{order.internal_notes}</p>
                  </div>
                )}
              </div>

              {/* Customer info */}
              {order.customer ? (
                <div className="card">
                  <div className="card-header">
                    <p className="card-title">Customer</p>
                    <Link href={`/customers/${order.customer_id}`} className="text-xs text-amber-600 hover:underline">View →</Link>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-muted">Name</p><p className="font-medium text-navy mt-0.5">{order.customer.name}</p></div>
                    <div><p className="text-muted">Phone</p><p className="font-medium text-navy mt-0.5">{order.customer.phone || '—'}</p></div>
                    <div><p className="text-muted">WhatsApp</p><p className="font-medium text-navy mt-0.5">{order.customer.whatsapp_number || '—'}</p></div>
                    <div><p className="text-muted">WA Opt-in</p>
                      <Badge label={order.customer.whatsapp_opt_in ? 'Yes' : 'No'} colorClass={order.customer.whatsapp_opt_in ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <p className="card-title">Recipient / Customer Details</p>
                    <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Registers Upon Delivery
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-muted">Recipient Name</p><p className="font-medium text-navy mt-0.5">{order.customer_name || '—'}</p></div>
                    <div><p className="text-muted">Phone / WhatsApp</p><p className="font-medium text-navy mt-0.5">{order.customer_phone || (order.shipping_address as any)?.ship_phone || '—'}</p></div>
                    <div><p className="text-muted">Email</p><p className="font-medium text-navy mt-0.5">{order.customer_email || '—'}</p></div>
                    <div><p className="text-muted">Customer Account</p><p className="text-slate-600 mt-0.5">Automated registration on delivery</p></div>
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Shipping */}
              <div className="card">
                <div className="card-header">
                  <p className="card-title">Shipping & Tracking</p>
                  <Button size="sm" variant="secondary" onClick={() => { setShippingForm({ shipping_partner: order.shipping_partner || '', tracking_number: order.tracking_number || '', delivery_pincode: order.delivery_pincode || '', estimated_delivery_date: order.estimated_delivery_date || '', mark_dispatched: false }); setShippingModal(true); }}>
                    <Truck size={13} /> Update
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 text-xs">
                  <div><p className="text-muted">Partner</p><p className="font-medium text-navy mt-0.5">{order.shipping_partner || '—'}</p></div>
                  <div>
                    <p className="text-muted">Tracking #</p>
                    {order.tracking_number ? (() => {
                      const partner = partners?.find((p: any) => p.name === order.shipping_partner);
                      const url = buildTrackingUrl(partner?.tracking_url_template, order.tracking_number);
                      return url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-amber-600 hover:underline mt-0.5 flex items-center gap-1">
                          {order.tracking_number} <ExternalLink size={10} />
                        </a>
                      ) : <p className="font-medium text-navy mt-0.5">{order.tracking_number}</p>;
                    })() : <p className="text-muted mt-0.5">—</p>}
                  </div>
                  <div><p className="text-muted">Pincode</p><p className="font-medium text-navy mt-0.5">{order.delivery_pincode || '—'}</p></div>
                  <div><p className="text-muted">Est. Delivery</p><p className="font-medium text-navy mt-0.5">{order.estimated_delivery_date ? fmtDate(order.estimated_delivery_date) : '—'}</p></div>
                  <div><p className="text-muted">Dispatched</p><p className="font-medium text-navy mt-0.5">{order.dispatched_at ? fmtDateTime(order.dispatched_at) : '—'}</p></div>
                  <div><p className="text-muted">Delivered</p><p className="font-medium text-navy mt-0.5">{order.delivered_at ? fmtDateTime(order.delivered_at) : '—'}</p></div>
                </div>
              </div>

              {/* WhatsApp status */}
              <div className="card">
                <p className="card-title mb-3">WhatsApp Notifications</p>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Order Confirmation', sent: order.whatsapp_confirmation_sent },
                    { label: 'Dispatch Update', sent: order.whatsapp_dispatch_sent },
                    { label: 'Delivery Notification', sent: order.whatsapp_delivery_sent },
                  ].map(n => (
                    <div key={n.label} className="flex items-center justify-between">
                      <span className="text-muted">{n.label}</span>
                      <Badge label={n.sent ? 'Sent' : 'Pending'} colorClass={n.sent ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Complete WhatsApp Dispatch & History Stream */}
            <div className="lg:col-span-3 mt-4">
              <OrderWhatsAppSection order={order} />
            </div>
          </div>
        )}

        {/* ── TAB: Images (CR1 + CR3: Customer WhatsApp Media Workstation) ─────────── */}
        {activeTab === 'Images' && (
          <div className="space-y-4">
            {/* Workstation Header & Stats Card */}
            <div className="card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                      <ImageIcon size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-navy text-sm flex items-center gap-2">
                        Customer WhatsApp Media &amp; Tap Verification
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {images.length} {images.length === 1 ? 'file' : 'files'}
                        </span>
                      </h3>
                      <p className="text-xs text-muted">
                        Inbound media automatically received from WhatsApp webhook, validated, and stored in AWS S3.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Send size={13} />}
                    className="text-xs text-navy font-semibold"
                    onClick={() => setRequestImageModal(true)}
                  >
                    Request New Photo
                  </Button>

                  {receivedImages.length > 0 && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<CheckCircle2 size={13} />}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                        loading={skuMatch.isPending}
                        onClick={() => skuMatch.mutate({ id: order.id })}
                        title="Mark product matched and automatically dispatch Message 2 (order_confirmation013) to customer"
                      >
                        Matched ✓ ({receivedImages.length} Photo{receivedImages.length > 1 ? 's' : ''})
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<XCircle size={13} />}
                        className="text-xs font-bold"
                        onClick={() => handleOpenRejectModal()}
                      >
                        Reject All
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* SKU & Tap Compatibility Quick Context Guide */}
              <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-muted text-[11px]">Ordered Product &amp; Model Target:</p>
                  <p className="font-bold text-navy flex items-center gap-2">
                    <Package size={14} className="text-amber-600" />
                    <span>{order.product_name || 'Khrisha Water Purifier Model'}</span>
                    {order.product_sku && (
                      <span className="font-mono text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                        SKU: {order.product_sku}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg p-2 max-w-md">
                  💡 <strong>Verification Tip:</strong> Check if customer’s kitchen tap has standard 22mm external or 24mm internal threads to guarantee seamless connector fit before dispatch.
                </div>
              </div>

              {/* Inbound Media Grid */}
              {images.length === 0 ? (
                <div className="py-12 text-center bg-surface/50 rounded-xl border border-dashed border-border mt-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-muted">
                    <ImageIcon size={24} />
                  </div>
                  <p className="text-sm font-semibold text-navy">No customer media received yet</p>
                  <p className="text-xs text-muted max-w-sm mx-auto mt-1 leading-relaxed">
                    When the customer sends tap photos or order screenshots via WhatsApp, they will automatically be downloaded, uploaded to AWS S3, and displayed here.
                  </p>
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Send size={13} />}
                      onClick={() => setRequestImageModal(true)}
                    >
                      Send Image Request via WhatsApp
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                  {images.map((img: any) => {
                    const mediaUrl = getMediaUrl(img);
                    const isApproved = img.status === 'approved';
                    const isRejected = img.status === 'rejected';
                    const isPending  = img.status === 'received';

                    return (
                      <div
                        key={img.id}
                        className={`group relative rounded-xl overflow-hidden border bg-white shadow-xs transition-all hover:shadow-md ${
                          isApproved ? 'border-emerald-200 ring-1 ring-emerald-100' :
                          isRejected ? 'border-red-200 ring-1 ring-red-100' :
                          'border-amber-200 ring-1 ring-amber-100'
                        }`}
                      >
                        {/* Thumbnail Container */}
                        <div
                          className="relative w-full h-44 bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center"
                          onClick={() => { setSelectedImageForView(img); setImageZoom(1); }}
                        >
                          {mediaUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={mediaUrl}
                              alt="Customer WhatsApp Media"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                              <ImageIcon size={32} className="opacity-40 mb-1" />
                              <span className="text-[11px]">Processing media buffer…</span>
                            </div>
                          )}

                          {/* Overlay View Button */}
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <span className="px-3 py-1.5 rounded-full bg-white/90 text-navy font-bold text-xs flex items-center gap-1.5 shadow-lg backdrop-blur-xs">
                              <Eye size={13} /> View Fullscreen
                            </span>
                          </div>

                          {/* Status Pill Badge top-left */}
                          <div className="absolute top-2 left-2">
                            <Badge
                              label={isApproved ? 'Approved ✓' : isRejected ? 'Rejected ✕' : 'Pending Review'}
                              colorClass={
                                isApproved ? 'bg-emerald-500 text-white font-bold shadow-xs' :
                                isRejected ? 'bg-red-500 text-white font-bold shadow-xs' :
                                'bg-amber-500 text-white font-bold shadow-xs'
                              }
                            />
                          </div>

                          {/* Image Type top-right */}
                          <div className="absolute top-2 right-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs font-mono">
                              {img.image_type === 'tap_photo' ? 'Tap Photo' : (img.image_type || 'Media')}
                            </span>
                          </div>
                        </div>

                        {/* Card Details & Metadata */}
                        <div className="p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between text-[11px] text-muted">
                            <span>{fmtDateTime(img.uploaded_at)}</span>
                            <span>{timeAgo(img.uploaded_at)}</span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>{img.mime_type || 'image/jpeg'}</span>
                            <span>{img.file_size ? `${(img.file_size / 1024).toFixed(0)} KB` : 'Cloud S3'}</span>
                          </div>

                          {/* Reviewer / Rejection Note */}
                          {img.reviewer && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100">
                              Reviewed by <strong>{img.reviewer.name}</strong>
                            </p>
                          )}
                          {img.rejection_reason && (
                            <p className="text-[11px] text-danger bg-red-50 p-1.5 rounded border border-red-100">
                              <strong>Reason:</strong> {img.rejection_reason}
                            </p>
                          )}

                          {/* Action Buttons for this single image */}
                          <div className="pt-2 border-t border-border flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setSelectedImageForView(img); setImageZoom(1); }}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1"
                            >
                              <Eye size={12} /> Inspect
                            </button>

                            {isPending && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleApproveImages(img.id)}
                                  disabled={approveImages.isPending}
                                  className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] flex items-center gap-1 border border-emerald-200"
                                >
                                  <Check size={12} /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenRejectModal(img.id)}
                                  className="px-2.5 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[11px] flex items-center gap-1 border border-red-200"
                                >
                                  <X size={12} /> Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rejection Alert Banner if any */}
              {order.image_rejection_reason && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-danger flex items-start gap-2">
                  <AlertTriangle size={15} className="text-danger mt-0.5 shrink-0" />
                  <div>
                    <strong>Latest Rejection Reason:</strong> {order.image_rejection_reason}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Call Logs (CR2) ─────────────────────────────────────── */}
        {activeTab === 'Call Logs' && (
          <div className="space-y-4">
            <div className="card p-0 overflow-hidden">
              <div className="card-header px-4 pt-4">
                <p className="card-title flex items-center gap-1.5"><PhoneCall size={14} /> Manual Call Logs</p>
                <Button size="sm" variant="primary" icon={<PhoneCall size={13} />} onClick={() => setCallModal(true)}>
                  Log Call
                </Button>
              </div>
              {callLogs.length === 0 ? (
                <div className="py-10 text-center">
                  <PhoneCall size={32} className="text-muted/30 mx-auto mb-2" />
                  <p className="text-sm text-muted">No calls logged yet.</p>
                  <p className="text-xs text-muted mt-1">When WhatsApp gets no reply, log your call here.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Rep</th>
                      <th>Type</th>
                      <th>Outcome</th>
                      <th>Context</th>
                      <th>Duration</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {callLogs.map((log: Record<string, unknown>) => (
                      <tr key={String(log.id)}>
                        <td className="text-xs">{fmtDateTime(String(log.called_at))}</td>
                        <td>{(log.user as Record<string, unknown>)?.name as string || '—'}</td>
                        <td><Badge label={String(log.call_type)} colorClass="bg-blue-50 text-blue-700" /></td>
                        <td><Badge label={String(log.outcome).replace('_', ' ')} colorClass={CALL_OUTCOME_COLOURS[String(log.outcome)] || ''} /></td>
                        <td className="text-xs text-muted capitalize">{String(log.context).replace('_', ' ')}</td>
                        <td className="text-xs text-muted">
                          {log.duration_seconds ? `${Math.floor(Number(log.duration_seconds) / 60)}m ${Number(log.duration_seconds) % 60}s` : '—'}
                        </td>
                        <td className="text-xs text-muted max-w-[180px] truncate">{String(log.notes || '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Activity ────────────────────────────────────────────── */}
        {activeTab === 'Activity' && (
          <div className="card p-0 overflow-hidden">
            <div className="card-header px-4 pt-4">
              <p className="card-title flex items-center gap-1.5"><ClipboardList size={14} /> Activity Log</p>
            </div>
            <div className="divide-y divide-border">
              {(order.activities || []).length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No activity yet.</p>
              ) : (
                (order.activities || []).map((act: any) => (
                  <div key={act.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-semibold text-navy">{act.user?.name?.[0] || 'S'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-navy">
                        {act.user?.name || 'System'} — <span className="font-normal capitalize">{act.action.replace(/_/g, ' ')}</span>
                      </p>
                      {(act.from_value || act.to_value) && (
                        <p className="text-xs text-muted mt-0.5">
                          {act.from_value && <span className="line-through mr-1">{act.from_value}</span>}
                          {act.to_value && <span className="text-navy font-medium">{act.to_value}</span>}
                        </p>
                      )}
                      {act.note && <p className="text-xs text-muted mt-0.5">{act.note}</p>}
                      <p className="text-[10px] text-muted mt-1">{timeAgo(act.created_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Feedback (CR7) ──────────────────────────────────────── */}
        {activeTab === 'Feedback' && (
          <div className="space-y-4">
            <div className="card">
              <div className="card-header">
                <p className="card-title flex items-center gap-1.5"><Star size={14} /> Feedback & Resolution</p>
                <Button size="sm" variant="secondary" onClick={() => {
                  setFeedbackForm({
                    feedback_status:      order.feedback_status || 'not_collected',
                    feedback_issue_notes: order.feedback_issue_notes || '',
                    customer_feedback:    order.customer_feedback || '',
                    feedback_rating:      order.feedback_rating || '',
                  });
                  setFeedbackModal(true);
                }}>
                  Update
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted">Feedback Status</p>
                  <div className="mt-1">
                    <Badge
                      label={(order.feedback_status || 'not_collected').replace('_', ' ')}
                      colorClass={FEEDBACK_STATUS_COLOURS[order.feedback_status || 'not_collected']}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-muted">Rating</p>
                  <div className="flex items-center gap-0.5 mt-1">
                    {order.feedback_rating
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={14} className={i < order.feedback_rating! ? 'fill-amber text-amber' : 'text-border'} />
                        ))
                      : <span className="text-muted">—</span>}
                  </div>
                </div>
                {order.customer_feedback && (
                  <div className="col-span-2">
                    <p className="text-muted">Customer Feedback</p>
                    <p className="text-navy mt-1">{order.customer_feedback}</p>
                  </div>
                )}
                {order.feedback_issue_notes && (
                  <div className="col-span-2">
                    <p className="text-muted">Issue / Resolution Notes</p>
                    <p className="text-navy mt-1">{order.feedback_issue_notes}</p>
                  </div>
                )}
              </div>
              {['unhappy', 'escalated'].includes(order.feedback_status) && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                  A high-priority follow-up call has been auto-created for this order. Check the Follow-Ups module.
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── TAB: Warranty ──────────────────────────────────────────────── */}
        {activeTab === 'Warranty' && (
          <div className="card space-y-4">
            <div className="card-header">
              <p className="card-title flex items-center gap-2">
                <ShieldCheck size={16} className="text-amber" /> Product Warranty & Coverage
              </p>
              <Link href="/warranty" className="text-xs text-amber-600 font-semibold hover:underline">
                Warranty Hub →
              </Link>
            </div>
            {order.warranty ? (
              <div className="p-4 bg-surface border border-border rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-600 text-sm">
                    {order.warranty.warranty_code || order.warranty.warranty_number || 'WAR-REG'}
                  </span>
                  <Badge
                    label={order.warranty.status}
                    colorClass={['ACTIVE', 'active'].includes(order.warranty.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}
                  />
                </div>
                <p><strong>Product:</strong> {order.warranty.product_name || order.warranty.product_name_snapshot || order.product_name || 'Standard Unit'}</p>
                <p><strong>Validity:</strong> {fmtDate(order.warranty.coverage_start_date || order.warranty.warranty_start_date || order.order_date)} — {fmtDate(order.warranty.coverage_end_date || order.warranty.warranty_end_date || new Date(Date.now() + 365*24*60*60*1000))}</p>
                <div className="pt-2 border-t border-border/50">
                  <Link href={`/warranty?q=${encodeURIComponent(order.order_number)}`} className="text-xs font-bold text-amber-700 hover:underline">
                    View Full Warranty &amp; Service Tickets →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-muted space-y-3">
                <ShieldCheck size={32} className="mx-auto text-muted/40" />
                <p>No warranty registration linked to this order yet.</p>
                <Link
                  href="/warranty"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber text-navy font-bold rounded hover:bg-amber-600 transition-colors"
                >
                  Register Product Warranty
                </Link>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}

      {/* Status update */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Order Status">
        <div className="space-y-3">
          <Select label="New Status" value={nextStatus} onChange={e => setNextStatus(e.target.value)}
            options={allowedNext.map(s => ({ value: s, label: s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1) }))} />
          <Textarea label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button variant="primary" loading={updateStatus.isPending} onClick={handleStatusUpdate}>Update</Button>
          </div>
        </div>
      </Modal>

      {/* Flow stage update */}
      <Modal open={flowModal} onClose={() => setFlowModal(false)} title="Update Processing Stage">
        <div className="space-y-3">
          <Select label="Stage" value={nextFlow} onChange={e => setNextFlow(e.target.value as FlowStage)}
            options={FLOW_STAGES.map(s => ({ value: s.key, label: s.label }))} />
          <Textarea label="Note (optional)" value={note} onChange={e => setNote(e.target.value)} rows={2} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFlowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={updateFlow.isPending} onClick={handleFlowUpdate}>Update</Button>
          </div>
        </div>
      </Modal>

      {/* Shipping update */}
      <Modal open={shippingModal} onClose={() => setShippingModal(false)} title="Update Shipping & Tracking">
        <div className="space-y-3">
          <Select label="Shipping Partner" value={shippingForm.shipping_partner} onChange={e => setShippingForm(s => ({ ...s, shipping_partner: e.target.value }))}
            options={[{ value: '', label: 'Select partner…' }, ...(partners || []).map((p: any) => ({ value: p.name, label: `${p.name}${p.default_tat_days ? ` (${p.default_tat_days}d TAT)` : ''}` }))]} />
          <Input label="Tracking Number" value={shippingForm.tracking_number} onChange={e => setShippingForm(s => ({ ...s, tracking_number: e.target.value }))} />
          <Input label="Delivery Pincode" value={shippingForm.delivery_pincode} onChange={e => setShippingForm(s => ({ ...s, delivery_pincode: e.target.value }))} maxLength={10} />
          {shippingForm.delivery_pincode.length >= 4 && serviceability && (
            <div className="text-xs bg-surface rounded px-3 py-2 flex items-start gap-1.5">
              <Clock size={12} className="text-muted mt-0.5 flex-shrink-0" />
              {serviceability.serviceable && serviceability.bestOption
                ? <span>TAT: <strong>{serviceability.bestOption.tat_days} days</strong>{serviceability.bestOption.cod_available ? ' · COD available' : ''}</span>
                : <span className="text-muted">{serviceability.message || 'No TAT data for this pincode.'}</span>}
            </div>
          )}
          <Input label="Estimated Delivery Date" type="date" value={shippingForm.estimated_delivery_date} onChange={e => setShippingForm(s => ({ ...s, estimated_delivery_date: e.target.value }))} />
          {['confirmed', 'processing'].includes(order.status) && shippingForm.tracking_number && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={shippingForm.mark_dispatched} onChange={e => setShippingForm(s => ({ ...s, mark_dispatched: e.target.checked }))} className="rounded border-border" />
              Mark as dispatched &amp; notify via WhatsApp
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShippingModal(false)}>Cancel</Button>
            <Button variant="primary" loading={updateShipping.isPending} onClick={handleShippingUpdate}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* CR1 — Reject images */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject Product Images" width="max-w-sm">
        <div className="space-y-3">
          <p className="text-xs text-muted">Provide a reason — the customer will be notified via WhatsApp to resend clearer images.</p>
          <Textarea label="Rejection Reason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="e.g. Images are blurry, product label not visible…" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectModal(false)}>Cancel</Button>
            <Button variant="danger" loading={rejectImages.isPending} disabled={!rejectReason.trim()} onClick={handleRejectImages}>Reject & Notify</Button>
          </div>
        </div>
      </Modal>

      {/* CR2 — Log call */}
      <Modal open={callModal} onClose={() => setCallModal(false)} title="Log Manual Call">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Call Type" value={callForm.call_type} onChange={e => setCallForm(f => ({ ...f, call_type: e.target.value as 'outbound' | 'inbound' }))}
              options={[{ value: 'outbound', label: 'Outbound (I called)' }, { value: 'inbound', label: 'Inbound (They called)' }]} />
            <Select label="Outcome" value={callForm.outcome} onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value as CallOutcome }))}
              options={CALL_OUTCOMES.map(o => ({ value: o, label: o.replace('_', ' ').charAt(0).toUpperCase() + o.replace('_', ' ').slice(1) }))} />
          </div>
          <Select label="Call Context" value={callForm.context} onChange={e => setCallForm(f => ({ ...f, context: e.target.value as CallContext }))}
            options={CALL_CONTEXTS.map(c => ({ value: c, label: c.replace(/_/g, ' ').charAt(0).toUpperCase() + c.replace(/_/g, ' ').slice(1) }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone Used" value={callForm.phone_used} onChange={e => setCallForm(f => ({ ...f, phone_used: e.target.value }))} placeholder="Number dialled" />
            <Input label="Duration (seconds)" type="number" min={0} value={callForm.duration_seconds} onChange={e => setCallForm(f => ({ ...f, duration_seconds: e.target.value }))} />
          </div>
          <Input label="Called At" type="datetime-local" value={callForm.called_at} onChange={e => setCallForm(f => ({ ...f, called_at: e.target.value }))} />
          <Textarea label="Notes" value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Outcome summary, customer response…" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCallModal(false)}>Cancel</Button>
            <Button variant="primary" loading={createCallLog.isPending} onClick={handleLogCall}>Log Call</Button>
          </div>
        </div>
      </Modal>

      {/* CR7 — Feedback resolution */}
      <Modal open={feedbackModal} onClose={() => setFeedbackModal(false)} title="Update Feedback & Resolution">
        <div className="space-y-3">
          <Select label="Feedback Status" value={feedbackForm.feedback_status}
            onChange={e => setFeedbackForm(f => ({ ...f, feedback_status: e.target.value }))}
            options={[
              { value: 'not_collected', label: 'Not Collected' },
              { value: 'happy',         label: '😊 Happy' },
              { value: 'unhappy',       label: '😞 Unhappy — auto follow-up created' },
              { value: 'escalated',     label: '🚨 Escalated — urgent follow-up created' },
              { value: 'resolved',      label: '✅ Resolved' },
            ]}
          />
          <Textarea label="Customer Feedback" value={feedbackForm.customer_feedback} onChange={e => setFeedbackForm(f => ({ ...f, customer_feedback: e.target.value }))} rows={2} />
          <Input label="Rating (1–5)" type="number" min={1} max={5} value={feedbackForm.feedback_rating} onChange={e => setFeedbackForm(f => ({ ...f, feedback_rating: e.target.value }))} />
          {['unhappy', 'escalated'].includes(feedbackForm.feedback_status) && (
            <Textarea label="Issue Notes" value={feedbackForm.feedback_issue_notes} onChange={e => setFeedbackForm(f => ({ ...f, feedback_issue_notes: e.target.value }))}
              rows={2} placeholder="Describe the issue and resolution steps…" />
          )}
          {['unhappy', 'escalated'].includes(feedbackForm.feedback_status) && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              A high-priority follow-up call will be auto-created and assigned to the order rep.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFeedbackModal(false)}>Cancel</Button>
            <Button variant="primary" loading={updateFeedback.isPending} onClick={handleFeedbackSave}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* ── High-Resolution Fullscreen Image Viewer Modal ──────────────────── */}
      {selectedImageForView && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in duration-200">
          {/* Top Bar */}
          <div className="w-full max-w-5xl flex items-center justify-between bg-slate-900/90 border border-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xl">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-amber-400 flex items-center gap-1.5">
                <ImageIcon size={16} /> Customer WhatsApp Photo
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/10 text-slate-300">
                {selectedImageForView.image_type || 'Tap Photo'}
              </span>
              <span className="text-xs text-slate-400">
                {fmtDateTime(selectedImageForView.uploaded_at)}
              </span>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImageZoom(z => Math.max(0.5, z - 0.25))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs font-mono text-slate-300 w-12 text-center">
                {Math.round(imageZoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setImageZoom(z => Math.min(3, z + 0.25))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setImageZoom(1)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Reset Zoom"
              >
                <RotateCcw size={15} />
              </button>

              <div className="h-4 w-px bg-slate-700 mx-1" />

              {/* Direct Download Link */}
              {(() => {
                const src = getMediaUrl(selectedImageForView);
                return src ? (
                  <a
                    href={src}
                    download={`order-${order.order_number}-customer-image.jpg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 text-xs"
                    title="Open / Download Full Resolution"
                  >
                    <Download size={15} />
                  </a>
                ) : null;
              })()}

              <button
                type="button"
                onClick={() => setSelectedImageForView(null)}
                className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white ml-2"
                title="Close Viewer"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Central Image Canvas with Zoom & Scroll */}
          <div className="w-full flex-1 overflow-auto flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getMediaUrl(selectedImageForView)}
              alt="Fullscreen Customer Media"
              style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center center' }}
              className="max-h-[75vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-transform duration-150"
            />
          </div>

          {/* Bottom Bar: Action Triggers */}
          <div className="w-full max-w-3xl flex items-center justify-between bg-slate-900/90 border border-slate-800 text-white px-5 py-3 rounded-xl shadow-xl">
            <div className="text-xs text-slate-300">
              Status:{' '}
              <strong className={
                selectedImageForView.status === 'approved' ? 'text-emerald-400' :
                selectedImageForView.status === 'rejected' ? 'text-rose-400' : 'text-amber-400'
              }>
                {selectedImageForView.status?.toUpperCase()}
              </strong>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                size="sm"
                variant="danger"
                icon={<XCircle size={14} />}
                onClick={() => handleOpenRejectModal(selectedImageForView.id)}
              >
                Reject Image
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<CheckCircle size={14} />}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                loading={approveImages.isPending}
                onClick={() => handleApproveImages(selectedImageForView.id)}
              >
                Approve &amp; Confirm Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Request New Image via WhatsApp Modal ────────────────────────────── */}
      <Modal open={requestImageModal} onClose={() => setRequestImageModal(false)} title="Request Customer Tap Photo via WhatsApp">
        <div className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            Dispatch interactive WhatsApp template (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-navy">order_verification_interactive</code>) asking the customer to take a clear, well-lit photo of their kitchen tap / aerator.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-navy">Select Preset or Custom Instructions:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                'Please send a clear photo of your kitchen tap and aerator.',
                'Tap thread size is unclear. Please take a close-up photo of the tap nozzle.',
                'Please send a photo showing the entire water connection area under the sink.',
                'Photo was blurry. Please resend a sharp photo with good lighting.',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRequestImageReason(preset)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    requestImageReason === preset ? 'border-amber-500 bg-amber-50/50 text-navy font-semibold' : 'border-border bg-white text-muted hover:bg-slate-50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            label="Message Details / Custom Guidance"
            value={requestImageReason}
            onChange={(e) => setRequestImageReason(e.target.value)}
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="secondary" onClick={() => setRequestImageModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<Send size={13} />}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={!requestImageReason.trim()}
              onClick={handleRequestNewImage}
            >
              Dispatch to Customer WhatsApp
            </Button>
          </div>
        </div>
      </Modal>

    </AppShell>
  );
}
