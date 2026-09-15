'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  useOrders, useUsers, useUpdateOrderStatus, useUpdateOrderVerificationStatus, useCreateCallLog, useUpdateOrder,
  useDeleteOrder, useClearAllOrders, useBulkDeleteOrders, useBulkAssignOrders, useExportOrders, useBulkUpdateStatus,
  useOrderVerificationDetail, useSkuMatchOrder, useSkuMismatchOrder, useRequestNewImageOrder,
  useMarkUnreadableOrder, useSendConfirmationOrder, useSendToExceptionOrder, useSendVerificationMessage,
  useCustomerConfirmOrder, useBulkSendWhatsAppOrders, useCsvBatches,
} from '@/hooks/useApi';
import {
  Badge, Button, EmptyState, Input, Modal, Textarea, ConfirmDialog, DropdownMenu,
} from '@/components/ui';
import {
  cn, formatCurrency, fmtDate, fmtDateTime, getMediaUrl, ORDER_STATUS_COLOURS, VERIFICATION_STATUS_COLOURS,
  ORDER_STATUSES, VERIFICATION_STATUS_OPTIONS,
  CALL_OUTCOMES, CALL_CONTEXTS,
} from '@/lib/utils';
import {
  Search, Plus, ShoppingCart, Phone, MessageCircle, FileText, Eye, MoreVertical, Package, Clock, IndianRupee,
  Camera, Edit3, Trash2, Download, CheckSquare, CheckCircle2, XCircle, HelpCircle, ShieldAlert, Send,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Image as ImageIcon, ZoomIn, ZoomOut, RotateCw, X, ExternalLink,
  Upload, SlidersHorizontal, FilterX, PackageCheck, Shield, Truck,
} from 'lucide-react';
import type { Order, CallOutcome, CallContext, CustomerImage, ProductMaster, CsvBatch } from '@/types';
import OrderWhatsAppSection from '@/components/orders/OrderWhatsAppSection';
import ExportFormatSelector, { ExportFormat } from '@/components/common/ExportFormatSelector';
import SmoothFilterDropdown from '@/components/orders/SmoothFilterDropdown';

// ── Channel & Sub-channel Configurations ────────────────────────────────────
const CHANNEL_OPTIONS_LIST = [
  { value: '', label: 'All Channels' },
  { value: 'amazon', label: 'Amazon', colorDot: 'bg-amber-500' },
  { value: 'flipkart', label: 'Flipkart', colorDot: 'bg-blue-500' },
  { value: 'indiamart', label: 'IndiaMART', colorDot: 'bg-emerald-500' },
  { value: 'akuabeat_website', label: 'Akuabeat Website', colorDot: 'bg-purple-500' },
  { value: 'direct', label: 'Direct / Manual', colorDot: 'bg-indigo-500' },
  { value: 'other', label: 'Other', colorDot: 'bg-slate-400' },
];

const SUB_CHANNELS_BY_CHANNEL: Record<string, { value: string; label: string }[]> = {
  amazon: [
    { value: 'amazon_channel_1', label: 'Channel 1 (Primary)' },
    { value: 'amazon_channel_2', label: 'Channel 2 (Secondary)' },
    { value: 'amazon_channel_3', label: 'Channel 3 (Tertiary)' },
  ],
  flipkart: [
    { value: 'flipkart', label: 'Flipkart Seller Hub' },
  ],
  indiamart: [
    { value: 'indiamart', label: 'IndiaMART B2B Portal' },
  ],
  akuabeat_website: [
    { value: 'akuabeat_website', label: 'Official Store (akuabeat.com)' },
  ],
  direct: [
    { value: 'direct', label: 'Direct / Offline Orders' },
  ],
};

const ALL_SUB_CHANNELS_LIST: { value: string; label: string; channel: string }[] = [
  { value: 'amazon_channel_1', label: 'Channel 1 (Primary)', channel: 'amazon' },
  { value: 'amazon_channel_2', label: 'Channel 2 (Secondary)', channel: 'amazon' },
  { value: 'amazon_channel_3', label: 'Channel 3 (Tertiary)', channel: 'amazon' },
  { value: 'flipkart', label: 'Flipkart · Seller Hub', channel: 'flipkart' },
  { value: 'indiamart', label: 'IndiaMART · B2B Portal', channel: 'indiamart' },
  { value: 'akuabeat_website', label: 'Akuabeat · Official Store', channel: 'akuabeat_website' },
  { value: 'direct', label: 'Direct · Manual Orders', channel: 'direct' },
];

const SUB_CHANNEL_LABELS: Record<string, string> = {
  amazon_channel_1: 'Channel1 (Primary)',
  amazon_channel_2: 'Channel2 (Secondary)',
  amazon_channel_3: 'Channel3 (Tertiary)',
  flipkart: 'Seller Hub',
  indiamart: 'B2B Portal',
  akuabeat_website: 'Official Store',
  direct: 'Direct / Manual',
};

// Reference Demonstration Dataset removed for clean local environment
const REFERENCE_ORDERS: any[] = [];


// ── Image Lightbox Modal ────────────────────────────────────────────────────
function ImageLightboxModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (url) {
      setScale(1);
      setRotation(0);
    }
  }, [url]);

  if (!url) return null;

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleReset = () => { setScale(1); setRotation(0); };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="relative max-w-5xl w-full max-h-[92vh] bg-slate-900/90 border border-white/10 rounded-2xl p-4 overflow-hidden flex flex-col items-center justify-center shadow-2xl" onClick={e => e.stopPropagation()}>
        
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs">
            <span className="font-semibold text-amber-400 flex items-center gap-1.5">
              <Camera size={14} /> Customer WhatsApp Screenshot
            </span>
            <span className="text-white/40">|</span>
            <span>{Math.round(scale * 100)}%</span>
            {rotation !== 0 && <span className="text-amber-300">({rotation}°)</span>}
          </div>

          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/10">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleRotate}
              title="Rotate 90°"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={handleReset}
              title="Reset View"
              className="px-2.5 py-1 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              Reset
            </button>
            <a
              href={url}
              download="customer_screenshot.jpg"
              target="_blank"
              rel="noopener noreferrer"
              title="Download Original"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <Download size={16} />
            </a>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 text-rose-400 hover:text-white hover:bg-rose-600 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scalable Image Canvas */}
        <div className="w-full h-[78vh] flex items-center justify-center overflow-auto p-4 select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Customer Verification Screenshot"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="max-h-full max-w-full object-contain rounded-lg shadow-lg cursor-grab active:cursor-grabbing"
          />
        </div>
      </div>
    </div>
  );
}

// ── Expanded Order Verification Section ─────────────────────────────────────
function VerificationPanel({ order, onClose }: { order: Order; onClose: () => void }) {
  const { data: detailData, isLoading } = useOrderVerificationDetail(order.id);
  const skuMatch = useSkuMatchOrder();
  const skuMismatch = useSkuMismatchOrder();
  const requestNewImage = useRequestNewImageOrder();
  const markUnreadable = useMarkUnreadableOrder();
  const sendToException = useSendToExceptionOrder();
  const sendVerification = useSendVerificationMessage();
  const customerConfirm = useCustomerConfirmOrder();

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const rawImages: CustomerImage[] = detailData?.customerImages || [];
  const images = [...rawImages].sort((a, b) => new Date(b.uploaded_at || (b as any).createdAt || 0).getTime() - new Date(a.uploaded_at || (a as any).createdAt || 0).getTime());
  const productMaster: ProductMaster = detailData?.productMaster;
  const currentImage = images[selectedImageIndex] || images[0];

  const verificationStatus = order.verification_status || 'pending_verification';
  const isPendingConfirmation = verificationStatus === 'pending_confirmation' || order.status === 'pending_confirmation';
  const isConfirmed = order.status === 'confirmed' || verificationStatus === 'confirmed';

  return (
    <div className="bg-slate-50/70 border-t border-b border-gray-200 p-4 space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2563eb] text-white">
            Order #{order.order_number}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${VERIFICATION_STATUS_COLOURS[verificationStatus] || 'bg-gray-100 text-gray-700'}`}>
            Verification: {verificationStatus.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-900 underline font-medium">
          Close Verification
        </button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-gray-500">Loading verification details & images...</div>
      ) : (
        <>
          {/* 3-Way Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Ordered Product Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Package size={14} className="text-amber-600" /> Ordered Product
                </span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase">{order.marketplace}</span>
              </div>
              <div className="text-xs space-y-1.5">
                <p><strong className="text-gray-500">Product:</strong> {order.product_name || 'N/A'}</p>
                <p className="bg-amber-50 border border-amber-200 p-1.5 rounded font-mono text-gray-900">
                  <strong>Ordered SKU:</strong> {order.product_sku || 'N/A'}
                </p>
                <p><strong className="text-gray-500">Amount:</strong> {order.total_amount ? formatCurrency(order.total_amount) : 'N/A'} (Qty: {order.quantity || 1})</p>
                <p><strong className="text-gray-500">Customer:</strong> {order.customer?.name || 'Awaiting'} ({order.customer?.phone || 'No phone'})</p>
              </div>
            </div>

            {/* Card 2: Product Master Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <CheckSquare size={14} className="text-blue-600" /> Product Master Catalog
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                  {productMaster?.status || 'Active'}
                </span>
              </div>
              <div className="text-xs space-y-1.5">
                <p><strong className="text-gray-500">Master Name:</strong> {productMaster?.product_name || order.product_name || '—'}</p>
                <p className="bg-blue-50 border border-blue-200 p-1.5 rounded font-mono text-gray-900">
                  <strong>Master SKU:</strong> {productMaster?.sku || order.product_sku || 'N/A'}
                </p>
                <p><strong className="text-gray-500">Catalog Price:</strong> {productMaster?.price ? formatCurrency(productMaster.price) : 'N/A'}</p>
                <p className="text-[11px] text-gray-500 truncate"><strong className="text-gray-500">Specs:</strong> {productMaster?.specifications || '—'}</p>
              </div>
            </div>

            {/* Card 3: Customer Image Viewer */}
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Camera size={14} className="text-purple-600" /> Customer Photo ({images.length})
                </span>
                {currentImage && (
                  <span className="text-[10px] text-gray-500">{fmtDateTime(currentImage.uploaded_at)}</span>
                )}
              </div>

              {(currentImage?.proxy_view_url || currentImage?.presigned_url || currentImage?.view_url || currentImage?.file_url || currentImage?.s3_key) ? (
                (() => {
                  const mediaUrl = getMediaUrl(currentImage);
                  return (
                    <div className="space-y-2">
                      <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-slate-100 h-28 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaUrl} alt="Customer product screenshot" className="h-full w-auto object-cover" />
                        <button
                          onClick={() => setActiveImage(mediaUrl)}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-xs cursor-pointer"
                        >
                          <ZoomIn size={16} /> Expand Image
                        </button>
                      </div>

                      {/* Multi-image thumbnail strip */}
                      {images.length > 1 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {images.map((img, idx) => {
                            const thumbUrl = getMediaUrl(img);
                            const isSelected = idx === selectedImageIndex;
                            return (
                              <button
                                key={img.id || idx}
                                onClick={() => setSelectedImageIndex(idx)}
                                className={`w-9 h-9 shrink-0 rounded border overflow-hidden transition-all ${
                                  isSelected ? 'border-purple-600 ring-2 ring-purple-600/30 scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={thumbUrl} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="h-28 rounded-lg border border-dashed border-gray-200 bg-slate-50 flex flex-col items-center justify-center p-2 text-center">
                  <ImageIcon size={24} className="text-gray-400 mb-1" />
                  <p className="text-[11px] text-gray-500">No photo uploaded via WhatsApp yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">CRM Employee Manual Verification Actions</p>

            <div className="flex flex-wrap items-center gap-2">
              {/* 1. MATCHED */}
              <Button
                variant="primary"
                onClick={() => skuMatch.mutate({ id: order.id })}
                loading={skuMatch.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-bold shadow-2xs flex items-center gap-1.5"
                icon={<CheckCircle2 size={15} />}
                title="Verify product compatibility and dispatch Message 2 to customer"
              >
                MATCHED ✓
              </Button>

              {/* 2. SKU MISMATCH */}
              <Button
                variant="secondary"
                onClick={() => skuMismatch.mutate({ id: order.id })}
                loading={skuMismatch.isPending}
                className="text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 text-xs h-9"
                icon={<XCircle size={15} />}
              >
                SKU MISMATCH
              </Button>

              {/* 3. REQUEST NEW IMAGE */}
              <Button
                variant="secondary"
                onClick={() => setShowRejectInput(!showRejectInput)}
                className="text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 text-xs h-9"
                icon={<Camera size={15} />}
              >
                NEED NEW IMAGE
              </Button>

              {/* 4. UNREADABLE */}
              <Button
                variant="secondary"
                onClick={() => markUnreadable.mutate({ id: order.id })}
                loading={markUnreadable.isPending}
                className="text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100 text-xs h-9"
                icon={<HelpCircle size={15} />}
              >
                UNREADABLE
              </Button>

              {/* 5. EXCEPTION */}
              <Button
                variant="secondary"
                onClick={() => sendToException.mutate({ id: order.id })}
                loading={sendToException.isPending}
                className="text-red-700 bg-red-50 border-red-200 hover:bg-red-100 text-xs h-9"
                icon={<ShieldAlert size={15} />}
              >
                SEND TO EXCEPTION
              </Button>

              <Button
                variant="secondary"
                onClick={() => sendVerification.mutate(order.id)}
                loading={sendVerification.isPending}
                className="text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-xs h-9"
                icon={<MessageCircle size={15} />}
              >
                SEND VERIFICATION (MSG 1)
              </Button>

              {!isConfirmed && (
                <Button
                  variant="primary"
                  onClick={() => customerConfirm.mutate({ id: order.id, note: 'Manual customer confirmation recorded.' })}
                  loading={customerConfirm.isPending}
                  className="ml-auto text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-2xs flex items-center gap-1.5"
                  icon={<CheckCircle2 size={15} />}
                >
                  CUSTOMER CONFIRMED ✓
                </Button>
              )}
            </div>

            {showRejectInput && (
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <Input
                  placeholder="Reason for requesting new image (e.g. Photo too blurry)..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="text-xs flex-1"
                />
                <Button
                  variant="primary"
                  loading={requestNewImage.isPending}
                  onClick={() => {
                    requestNewImage.mutate(
                      { id: order.id, reason: rejectReason },
                      { onSuccess: () => setShowRejectInput(false) }
                    );
                  }}
                  className="text-xs"
                >
                  Send Request
                </Button>
              </div>
            )}
          </div>

          {/* Live Status Banners */}
          {isPendingConfirmation && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex items-center justify-between text-sky-800 text-xs">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-sky-600 shrink-0 animate-pulse" />
                <span><strong>SKU Verified Manually ✓</strong> · Confirmation Message Sent to WhatsApp · ⏳ Waiting for Customer Response</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-sky-700">{order.confirmation_sent_at ? fmtDateTime(order.confirmation_sent_at) : 'Sent'}</span>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 px-3 h-7 shadow-2xs"
                  icon={<CheckCircle2 size={13} />}
                  onClick={() => customerConfirm.mutate({ id: order.id, note: 'Confirmed by customer.' })}
                  loading={customerConfirm.isPending}
                >
                  Mark Confirmed ✓
                </Button>
              </div>
            </div>
          )}

          {isConfirmed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-emerald-800 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span><strong>ORDER CONFIRMED ✓</strong> · Customer clicked Confirm Order on WhatsApp</span>
              </div>
              <span className="font-mono text-[11px]">{order.customer_confirmed_at ? fmtDateTime(order.customer_confirmed_at) : 'Confirmed'}</span>
            </div>
          )}

          {/* Dedicated WhatsApp Communication Center */}
          <OrderWhatsAppSection order={order} />
        </>
      )}

      <ImageLightboxModal url={activeImage} onClose={() => setActiveImage(null)} />
    </div>
  );
}

// ── Edit Order Modal ────────────────────────────────────────────────────────
function EditOrderModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const updateOrder = useUpdateOrder();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [orderDate, setOrderDate] = useState('');

  useEffect(() => {
    if (order) {
      setName(order.customer?.name && order.customer.name !== 'Unknown' ? order.customer.name : (order.customer_name || ''));
      setPhone(order.customer?.phone || order.customer_phone || '');
      setEmail(order.customer?.email || order.customer_email || '');
      setAmount(order.total_amount ? String(order.total_amount) : '');
      setOrderDate(order.order_date ? String(order.order_date).split('T')[0] : '');
    }
  }, [order]);

  if (!order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrder.mutate({
      id: order.id,
      customer_name: name || undefined,
      customer_phone: phone || undefined,
      customer_email: email || undefined,
      total_amount: amount ? parseFloat(amount) : undefined,
      order_date: orderDate || undefined,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <Modal open={!!order} onClose={onClose} title={`Edit Order — ${order.order_number}`}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <Input label="Customer Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rajesh Kumar" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Customer Mobile" value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile" />
          <Input label="Customer Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Order Amount (₹)" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 1499" />
          <Input label="Order Date" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={updateOrder.isPending}>Save Order Details</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Quick call-log modal ───────────────────────────────────────────────────
function QuickCallModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const createCallLog = useCreateCallLog();
  const [outcome, setOutcome] = useState<CallOutcome>('answered');
  const [context, setContext] = useState<CallContext>('general');
  const [notes, setNotes] = useState('');

  if (!order) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCallLog.mutate(
      {
        order_id: order.id,
        customer_id: order.customer_id || undefined,
        phone_used: order.customer?.phone || order.customer_phone || (order.shipping_address as any)?.ship_phone || '',
        call_type: 'outbound',
        outcome,
        context,
        notes: notes.trim() || '',
        called_at: new Date().toISOString(),
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Modal open={!!order} onClose={onClose} title={`Log Call — ${order.order_number}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-gray-500">{order.customer?.name || order.customer_name} · {order.customer?.phone || order.customer_phone}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Outcome</label>
            <select
              value={outcome}
              onChange={e => setOutcome(e.target.value as CallOutcome)}
              className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white"
            >
              {CALL_OUTCOMES.map(o => (
                <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Context</label>
            <select
              value={context}
              onChange={e => setContext(e.target.value as CallContext)}
              className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white"
            >
              {CALL_CONTEXTS.map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={createCallLog.isPending} type="submit">Log Call</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Export Modal ────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'order_number', label: 'Order #' },
  { key: 'marketplace_order_id', label: 'Marketplace Order ID' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'channel', label: 'Channel' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'customer_phone', label: 'Customer Mobile' },
  { key: 'customer_email', label: 'Customer Email' },
  { key: 'address', label: 'Address Line 1' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'product_name', label: 'Product Name' },
  { key: 'product_sku', label: 'Product SKU' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unit_price', label: 'Unit Price' },
  { key: 'total_amount', label: 'Total Amount' },
  { key: 'status', label: 'Status' },
  { key: 'flow_stage', label: 'Flow Stage' },
  { key: 'order_date', label: 'Order Date' },
  { key: 'tracking_number', label: 'Tracking #' },
  { key: 'shipping_partner', label: 'Shipping Partner' },
  { key: 'assigned_to', label: 'Assigned Staff' },
];

function ExportOrdersModal({
  isOpen, onClose, selectedIds, currentFilters,
}: {
  isOpen: boolean; onClose: () => void; selectedIds: string[];
  currentFilters: { status: string; marketplace: string; channel?: string; flowStage: string; assignedTo: string; q: string };
}) {
  const exportOrders = useExportOrders();
  const [scope, setScope] = useState<'selected' | 'filtered'>(selectedIds.length > 0 ? 'selected' : 'filtered');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [selectedCols, setSelectedCols] = useState<string[]>(ALL_COLUMNS.map(c => c.key));

  useEffect(() => {
    if (selectedIds.length > 0) setScope('selected');
    else setScope('filtered');
  }, [selectedIds]);

  if (!isOpen) return null;

  const toggleCol = (key: string) => {
    setSelectedCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleAllCols = () => {
    if (selectedCols.length === ALL_COLUMNS.length) {
      setSelectedCols([]);
    } else {
      setSelectedCols(ALL_COLUMNS.map(c => c.key));
    }
  };

  const handleExport = () => {
    exportOrders.mutate(
      {
        format,
        columns: selectedCols,
        ...(scope === 'selected' ? { order_ids: selectedIds } : {
          status: currentFilters.status || undefined,
          marketplace: currentFilters.marketplace || undefined,
          channel: currentFilters.channel || undefined,
          flow_stage: currentFilters.flowStage || undefined,
          assigned_to: currentFilters.assignedTo || undefined,
          q: currentFilters.q || undefined,
        }),
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="Customizable Order Export Engine" size="lg">
      <div className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-bold text-gray-900 mb-1.5">1. Export Scope</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setScope('selected')}
              className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                scope === 'selected' ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-600' : 'border-gray-200 text-gray-600 hover:text-gray-900'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Selected Orders ({selectedIds.length})
              <p className="text-[10px] text-gray-500 font-normal mt-0.5">Export only rows ticked in the table</p>
            </button>
            <button
              type="button"
              onClick={() => setScope('filtered')}
              className={`p-2.5 rounded-lg border text-xs font-medium text-left transition-all ${
                scope === 'filtered' ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-600' : 'border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              All Matching Filters
              <p className="text-[10px] text-gray-500 font-normal mt-0.5">Export all orders matching current desk filters</p>
            </button>
          </div>
        </div>

        <ExportFormatSelector
          value={format}
          onChange={setFormat}
          label="2. Choose Export File Format (Excel, PDF, or CSV):"
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-gray-900">
              3. Columns to Include ({selectedCols.length}/{ALL_COLUMNS.length})
            </label>
            <button type="button" onClick={toggleAllCols} className="text-[11px] text-blue-600 hover:underline font-medium">
              {selectedCols.length === ALL_COLUMNS.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2.5 bg-slate-50 border border-gray-200 rounded-xl">
            {ALL_COLUMNS.map(col => (
              <label key={col.key} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedCols.includes(col.key)}
                  onChange={() => toggleCol(col.key)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{col.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={exportOrders.isPending}
            disabled={selectedCols.length === 0}
            onClick={handleExport}
            icon={<Download size={14} />}
          >
            Export {format.toUpperCase()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Orders Page Component ──────────────────────────────────────────────
export default function OrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [marketplace, setMarketplace] = useState('');
  const [channel, setChannel] = useState('');

  const currentSubChannelOptions = useMemo(() => {
    const list = marketplace && SUB_CHANNELS_BY_CHANNEL[marketplace]
      ? SUB_CHANNELS_BY_CHANNEL[marketplace]
      : ALL_SUB_CHANNELS_LIST;
    return [
      { value: '', label: 'All Sub-channels' },
      ...list.map(sub => ({ value: sub.value, label: sub.label })),
    ];
  }, [marketplace]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending_verification' | 'pending_dispatch' | 'in_transit' | 'delivered' | 'cancelled'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [callOrder, setCallOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCsvHistoryOpen, setIsCsvHistoryOpen] = useState(false);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [deleteOrderTarget, setDeleteOrderTarget] = useState<Order | null>(null);


  const deleteOrder = useDeleteOrder();
  const updateVerificationStatus = useUpdateOrderVerificationStatus();
  const updateStatus = useUpdateOrderStatus();
  const bulkUpdateStatus = useBulkUpdateStatus();
  const bulkDeleteOrders = useBulkDeleteOrders();

  const { data: batchesData, isLoading: isBatchesLoading } = useCsvBatches();
  const importBatches: CsvBatch[] = batchesData?.data || [];

  const { data, isLoading } = useOrders({
    page,
    limit,
    ...(q && { q }),
    ...(status && { status }),
    ...(verificationStatus && { verification_status: verificationStatus }),
    ...(marketplace && { marketplace }),
    ...(channel && { channel }),
    sort: 'created_at:desc',
  });

  const apiOrders: Order[] = useMemo(() => data?.data || [], [data?.data]);
  const pagination = data?.pagination;

  // Live database orders directly from backend API
  const orders: any[] = apiOrders;

  // Tab count metrics
  const tabCounts = useMemo(() => {
    const stats = (data as any)?.stats;
    if (stats) {
      return {
        total: stats.total ?? (pagination?.total ?? apiOrders.length),
        pending_verification: stats.pending_verification ?? 0,
        pending_dispatch: stats.pending_dispatch ?? stats.confirmed ?? 0,
        in_transit: stats.in_transit ?? stats.dispatched ?? 0,
        delivered: stats.delivered ?? 0,
        cancelled: stats.cancelled ?? 0,
      };
    }

    const totalCount = pagination?.total ?? apiOrders.length;
    const pendingVerif = apiOrders.filter(o => o.verification_status === 'pending_verification').length;
    const pendingDispatch = apiOrders.filter(o => o.status === 'confirmed' || o.status === 'processing').length;
    const inTransit = apiOrders.filter(o => o.status === 'dispatched' || (o.status as string) === 'in_transit').length;
    const delivered = apiOrders.filter(o => o.status === 'delivered').length;
    const cancelled = apiOrders.filter(o => o.status === 'cancelled').length;

    return {
      total: totalCount,
      pending_verification: pendingVerif,
      pending_dispatch: pendingDispatch,
      in_transit: inTransit,
      delivered: delivered,
      cancelled: cancelled,
    };
  }, [data, apiOrders, pagination]);

  const handleTabChange = (tab: 'all' | 'pending_verification' | 'pending_dispatch' | 'in_transit' | 'delivered' | 'cancelled') => {
    setActiveTab(tab);
    setPage(1);
    setStatus('');
    setVerificationStatus('');

    if (tab === 'pending_verification') setVerificationStatus('pending_verification');
    else if (tab === 'pending_dispatch') setStatus('confirmed');
    else if (tab === 'in_transit') setStatus('dispatched');
    else if (tab === 'delivered') setStatus('delivered');
    else if (tab === 'cancelled') setStatus('cancelled');
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) setSelectedIds(prev => [...prev, id]);
    else setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const isAllPageSelected = orders.length > 0 && orders.every(o => selectedIds.includes(o.id));
  const handleSelectAllPage = (checked: boolean) => {
    if (checked) setSelectedIds(prev => Array.from(new Set([...prev, ...orders.map(o => o.id)])));
    else setSelectedIds(prev => prev.filter(id => !orders.map(o => o.id).includes(id)));
  };

  return (
    <AppShell>
      <Topbar
        icon={Package}
        title="Orders"
        subtitle="Manage and verify orders from all channels. View, track and process orders efficiently."
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#f8fafc]/50">

        {/* ── ROW 1: 6 KPI SUMMARY CARDS ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          
          {/* Card 1: Total Orders */}
          <div
            onClick={() => handleTabChange('all')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
              activeTab === 'all'
                ? 'bg-purple-50/90 border-purple-300 ring-1 ring-purple-400/40'
                : 'bg-[#faf8ff] border-purple-100/70 hover:border-purple-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100/80 flex items-center justify-center text-purple-600 shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Total Orders</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{tabCounts.total}</h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span>↑ 12%</span>
              <span className="text-gray-400 font-normal">vs last month</span>
            </div>
          </div>

          {/* Card 2: Pending Verification */}
          <div
            onClick={() => handleTabChange('pending_verification')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
              activeTab === 'pending_verification'
                ? 'bg-amber-50/90 border-amber-300 ring-1 ring-amber-400/40'
                : 'bg-[#fffcf7] border-amber-100/70 hover:border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 flex items-center justify-center text-amber-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Pending Verification</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{tabCounts.pending_verification}</h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-amber-600">
              <span>↑ 8%</span>
              <span className="text-gray-400 font-normal">vs last month</span>
            </div>
          </div>

          {/* Card 3: Pending Confirmation */}
          <div
            onClick={() => handleTabChange('pending_dispatch')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
              activeTab === 'pending_dispatch'
                ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-400/40'
                : 'bg-[#f8faff] border-blue-100/70 hover:border-blue-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100/80 flex items-center justify-center text-blue-600 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Pending Confirmation</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{tabCounts.pending_dispatch}</h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span>↑ 100%</span>
              <span className="text-gray-400 font-normal">vs last month</span>
            </div>
          </div>

          {/* Card 4: In Transit */}
          <div
            onClick={() => handleTabChange('in_transit')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
              activeTab === 'in_transit'
                ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400/40'
                : 'bg-[#f7fcf9] border-emerald-100/70 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 flex items-center justify-center text-emerald-600 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">In Transit</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{tabCounts.in_transit}</h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span>↑ 0%</span>
              <span className="text-gray-400 font-normal">vs last month</span>
            </div>
          </div>

          {/* Card 5: Delivered */}
          <div
            onClick={() => handleTabChange('delivered')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
              activeTab === 'delivered'
                ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400/40'
                : 'bg-[#f7fcf9] border-emerald-100/70 hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Delivered</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{tabCounts.delivered}</h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <span>↑ 0%</span>
              <span className="text-gray-400 font-normal">vs last month</span>
            </div>
          </div>

          {/* Card 6: Cancelled */}
          <div
            onClick={() => handleTabChange('cancelled')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm ${
              activeTab === 'cancelled'
                ? 'bg-rose-50/90 border-rose-300 ring-1 ring-rose-400/40'
                : 'bg-[#fff8f8] border-rose-100/70 hover:border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100/80 flex items-center justify-center text-rose-600 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Cancelled</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{tabCounts.cancelled}</h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-rose-600">
              <span>↓ 0%</span>
              <span className="text-gray-400 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        {/* ── ROW 2: STATUS NAVIGATION TABS ─────────────────────────────────── */}
        <div className="border-b border-gray-200 flex items-center gap-6 sm:gap-8 overflow-x-auto text-xs scrollbar-none pt-1">
          {[
            { key: 'all', label: 'All Orders', count: tabCounts.total },
            { key: 'pending_verification', label: 'Pending Verification', count: tabCounts.pending_verification },
            { key: 'pending_dispatch', label: 'Pending Dispatch', count: tabCounts.pending_dispatch },
            { key: 'in_transit', label: 'In Transit', count: tabCounts.in_transit },
            { key: 'delivered', label: 'Delivered', count: tabCounts.delivered },
            { key: 'cancelled', label: 'Cancelled', count: tabCounts.cancelled },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key as any)}
                className={`flex items-center gap-2 pb-3 font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── ROW 3: SEARCH, FILTERS & ACTION TOOLBAR (IN ONE SINGLE LINE) ──── */}
        <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-2.5">
          {/* Left: Search Input + Smooth Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
            {/* Search Input (Darkened) */}
            <div className="relative w-full sm:w-60 md:w-68 lg:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by order ID, customer name, product, etc..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="w-full h-[36px] pl-9 pr-7 text-xs bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 placeholder:text-slate-500 font-medium transition-all"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Smooth Channel Selector */}
            <SmoothFilterDropdown
              value={marketplace}
              onChange={(val) => {
                setMarketplace(val);
                setPage(1);
                setChannel('');
              }}
              options={CHANNEL_OPTIONS_LIST}
              placeholder="All Channels"
              widthClass="w-36 lg:w-40 shrink-0"
            />

            {/* Smooth Sub-channel Selector */}
            <SmoothFilterDropdown
              value={channel}
              onChange={(val) => {
                setChannel(val);
                setPage(1);
              }}
              options={currentSubChannelOptions}
              placeholder="All Sub-channels"
              widthClass="w-40 lg:w-44 shrink-0"
            />

            {/* Clear Filters button if any active */}
            {(marketplace || channel || q) && (
              <button
                type="button"
                onClick={() => {
                  setMarketplace('');
                  setChannel('');
                  setQ('');
                  setPage(1);
                }}
                className="h-[36px] inline-flex items-center gap-1 px-2.5 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs shrink-0"
                title="Reset all filters"
              >
                <FilterX className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCsvHistoryOpen(true)}
              className="h-[36px] flex items-center gap-1.5 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>CSV Import</span>
            </button>

            <Link
              href="/csv-import"
              className="h-[36px] flex items-center gap-1.5 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Import File</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              className="h-[36px] flex items-center gap-1.5 px-3 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Orders</span>
            </button>

            <Link
              href="/orders/new"
              className="h-[36px] flex items-center gap-1.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Order</span>
            </Link>
          </div>
        </div>

        {/* ── ROW 4: ORDERS DATA TABLE ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] border-collapse text-left">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="w-10 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isAllPageSelected}
                      onChange={(e) => handleSelectAllPage(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">Order #</th>
                  <th className="px-4 py-3.5">Customer</th>
                  <th className="px-4 py-3.5">Channel / Sub-channel</th>
                  <th className="px-4 py-3.5">Product & SKU</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Verification State</th>
                  <th className="px-4 py-3.5">WhatsApp</th>
                  <th className="px-4 py-3.5">Fulfilment Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((ord: any) => {
                  const isExpanded = expandedOrderId === ord.id;
                  const isSelected = selectedIds.includes(ord.id);
                  const isAmazon = (ord.marketplace || '').toLowerCase().includes('amazon');

                  return (
                    <React.Fragment key={ord.id}>
                      <tr className={`hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                        
                        {/* 1. Checkbox */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectRow(ord.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        {/* 2. Order # & Datetime */}
                        <td className="px-4 py-3 min-w-[220px]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                              className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title={isExpanded ? 'Collapse Verification' : 'Expand Verification Panel'}
                            >
                              <ChevronRight className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90 text-blue-600')} />
                            </button>
                            <div>
                              <p className="font-bold text-xs text-gray-900 tracking-tight">{ord.order_number}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {ord.order_date ? fmtDateTime(ord.order_date) : '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 3. Customer & Badge */}
                        <td className="px-4 py-3 min-w-[170px]">
                          <p className="font-bold text-xs text-gray-900">{ord.customer?.name || ord.customer_name || 'Customer'}</p>
                          {ord.delivery_badge ? (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                              {ord.delivery_badge}
                            </span>
                          ) : (
                            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                              {ord.customer?.phone || ord.customer_phone || ''}
                            </p>
                          )}
                        </td>

                        {/* 4. Channel / Sub-channel */}
                        <td className="px-4 py-3 min-w-[170px]">
                          {isAmazon ? (
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-extrabold text-sm tracking-tighter text-slate-800 lowercase leading-tight">
                                  amazon
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                                <span className="text-[11px] font-medium text-blue-600">
                                  {SUB_CHANNEL_LABELS[ord.channel] || ord.channel || 'Primary'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-xs text-gray-800 capitalize">
                                {ord.marketplace || 'Direct'}
                              </span>
                              {ord.channel && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                  <span className="text-[11px] text-gray-500">
                                    {SUB_CHANNEL_LABELS[ord.channel] || ord.channel}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Product & SKU */}
                        <td className="px-4 py-3 min-w-[240px] max-w-[300px]">
                          <p className="font-medium text-xs text-gray-800 truncate" title={ord.product_name}>
                            {ord.product_name || '—'}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate" title={ord.product_sku}>
                            SKU : {ord.product_sku || '—'}
                          </p>
                        </td>

                        {/* 6. Amount */}
                        <td className="px-4 py-3 min-w-[90px]">
                          <p className="font-bold text-xs text-gray-900">
                            {ord.total_amount != null ? `₹${Number(ord.total_amount).toLocaleString('en-IN')}` : '—'}
                          </p>
                        </td>

                        {/* 7. Verification State Pill */}
                        <td className="px-4 py-3 min-w-[170px]">
                          <DropdownMenu
                            align="left"
                            width={200}
                            triggerType="custom"
                            trigger={
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-200/80 hover:bg-blue-100/70 transition-colors cursor-pointer"
                              >
                                <Clock className="w-3 h-3 text-blue-500" />
                                <span>
                                  {ord.verification_status === 'sku_matched'
                                    ? 'SKU Matched'
                                    : ord.verification_status === 'confirmed'
                                    ? 'Confirmed'
                                    : 'Pending Verification'}
                                </span>
                                <ChevronDown className="w-3 h-3 text-blue-400" />
                              </button>
                            }
                            items={[
                              { val: 'pending_verification', label: 'Pending Verification' },
                              { val: 'sku_matched', label: 'SKU Matched' },
                              { val: 'image_received', label: 'Image Received' },
                              { val: 'screenshot_requested', label: 'Need New Image' },
                              { val: 'unreadable', label: 'Unreadable' },
                              { val: 'confirmed', label: 'Confirmed' },
                              { val: 'verification_exception', label: 'Exception' },
                            ].map(item => ({
                              key: item.val,
                              label: item.label,
                              onClick: () => updateVerificationStatus.mutate({ id: ord.id, verification_status: item.val }),
                            }))}
                          />
                        </td>

                        {/* 8. WhatsApp Status Pill */}
                        <td className="px-4 py-3 min-w-[130px]">
                          {ord.whatsapp_status === 'sent' || ord.whatsapp_confirmation_sent ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sent</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                              <Phone className="w-3 h-3 text-amber-600" />
                              <span>Auto-Queued</span>
                            </span>
                          )}
                        </td>

                        {/* 9. Fulfilment Status Pill */}
                        <td className="px-4 py-3 min-w-[130px]">
                          <DropdownMenu
                            align="left"
                            width={170}
                            triggerType="custom"
                            trigger={
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-sky-50 text-sky-600 border border-sky-200/80 hover:bg-sky-100/70 transition-colors cursor-pointer capitalize"
                              >
                                <span>{ord.status || 'pending'}</span>
                                <ChevronDown className="w-3 h-3 text-sky-400" />
                              </button>
                            }
                            items={['pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'].map(st => ({
                              key: st,
                              label: <span className="capitalize">{st}</span>,
                              onClick: () => updateStatus.mutate({ id: ord.id, status: st }),
                            }))}
                          />
                        </td>

                        {/* 10. Date */}
                        <td className="px-4 py-3 min-w-[110px] text-xs text-gray-600">
                          {ord.display_date || (ord.created_at ? fmtDate(ord.created_at) : '08 Sep 2026')}
                        </td>

                        {/* 11. Actions Button */}
                        <td className="px-4 py-3 text-right pr-5">
                          <DropdownMenu
                            align="right"
                            width={200}
                            triggerType="custom"
                            trigger={
                              <button
                                type="button"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="More actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            }
                            items={[
                              {
                                key: 'details',
                                icon: <Eye className="w-3.5 h-3.5 text-blue-600" />,
                                label: isExpanded ? 'Hide Details' : 'View Details & Photos',
                                onClick: () => setExpandedOrderId(isExpanded ? null : ord.id),
                              },
                              {
                                key: 'call',
                                icon: <Phone className="w-3.5 h-3.5 text-emerald-600" />,
                                label: 'Log Call',
                                onClick: () => setCallOrder(ord),
                              },
                              {
                                key: 'edit',
                                icon: <Edit3 className="w-3.5 h-3.5 text-amber-600" />,
                                label: 'Edit Order',
                                onClick: () => setEditOrder(ord),
                              },
                              ...(ord.customer?.phone
                                ? [
                                    {
                                      key: 'whatsapp',
                                      icon: <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />,
                                      label: 'WhatsApp Chat',
                                      variant: 'success' as const,
                                      onClick: () =>
                                        window.open(
                                          `https://wa.me/${ord.customer.phone.replace(/\D/g, '')}`,
                                          '_blank',
                                          'noopener,noreferrer'
                                        ),
                                    },
                                  ]
                                : []),
                              { divider: true },
                              {
                                key: 'confirm',
                                icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
                                label: 'Mark Confirmed',
                                variant: 'success' as const,
                                onClick: () => updateStatus.mutate({ id: ord.id, status: 'confirmed' }),
                              },
                              {
                                key: 'cancel',
                                icon: <X className="w-3.5 h-3.5 text-rose-600" />,
                                label: 'Cancel Order',
                                variant: 'danger' as const,
                                onClick: () => updateStatus.mutate({ id: ord.id, status: 'cancelled' }),
                              },
                              { divider: true },
                              {
                                key: 'delete',
                                icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" />,
                                label: 'Delete Order',
                                variant: 'danger' as const,
                                onClick: () => setDeleteOrderTarget(ord),
                              },
                            ]}
                          />
                        </td>
                      </tr>

                      {/* Expanded Inline Verification Section */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} className="p-0 border-b border-gray-200">
                            <VerificationPanel order={ord} onClose={() => setExpandedOrderId(null)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── ROW 5: TABLE FOOTER & PAGINATION ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3.5 border-t border-gray-200/90 text-xs text-gray-500 gap-3">
            <div>
              Showing <span className="font-semibold text-gray-800">1</span> to{' '}
              <span className="font-semibold text-gray-800">{orders.length}</span> of{' '}
              <span className="font-semibold text-gray-800">{orders.length}</span> leads
            </div>

            <div className="flex items-center gap-3">
              {/* Pagination Arrows */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2563eb] text-white font-semibold text-xs shadow-2xs cursor-pointer"
                >
                  {page}
                </button>
                <button
                  type="button"
                  disabled={pagination ? !pagination.hasNext : true}
                  onClick={() => setPage(p => p + 1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Page Size Select */}
              <div className="relative">
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Auxiliary Modals */}
      <QuickCallModal order={callOrder} onClose={() => setCallOrder(null)} />
      <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} />
      <ImageLightboxModal url={activeLightboxImage} onClose={() => setActiveLightboxImage(null)} />
      <ExportOrdersModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedIds={selectedIds}
        currentFilters={{ status, marketplace, channel, flowStage: '', assignedTo: '', q }}
      />

      {/* Delete Single Order Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteOrderTarget}
        title="Delete Order"
        message={`Are you sure you want to delete order #${deleteOrderTarget?.order_number}? This will permanently remove the order, verification records, and all associated activities.`}
        confirmText="Delete Order"
        variant="danger"
        loading={deleteOrder.isPending}
        onConfirm={async () => {
          if (deleteOrderTarget) {
            await deleteOrder.mutateAsync(deleteOrderTarget.id);
            setSelectedIds(prev => prev.filter(id => id !== deleteOrderTarget.id));
            setDeleteOrderTarget(null);
          }
        }}
        onCancel={() => setDeleteOrderTarget(null)}
      />

      {/* CSV Import History Modal */}
      <Modal
        open={isCsvHistoryOpen}
        onClose={() => setIsCsvHistoryOpen(false)}
        title="CSV / Excel Import History"
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 pb-1 border-b border-gray-200">
            <p>
              Log of all marketplace data files uploaded into the CRM with timestamps and records.
            </p>
            <Link
              href="/csv-import"
              className="text-blue-600 font-semibold hover:underline flex items-center gap-1 shrink-0"
              onClick={() => setIsCsvHistoryOpen(false)}
            >
              <span>Upload New File</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          {isBatchesLoading ? (
            <div className="py-6 text-center text-xs text-gray-400">Loading batch history...</div>
          ) : importBatches.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} />}
              title="No CSV imports recorded"
              description="No marketplace order files have been uploaded yet."
            />
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {importBatches.map((b) => (
                <div
                  key={b.id}
                  className="py-3 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <FileText size={14} className="text-amber-600 shrink-0" />
                        {b.filename}
                      </span>
                      <Badge
                        label={b.status}
                        colorClass={
                          b.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-800'
                        }
                      />
                      <span className="text-[10px] font-semibold bg-amber-100/80 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                        {b.channel ? b.channel.replace(/_/g, ' ').toUpperCase() : b.marketplace.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap pt-0.5">
                      <span className="flex items-center gap-1 text-gray-700 font-medium">
                        <Clock size={12} className="text-amber-600" />
                        <strong>Uploaded:</strong> {fmtDateTime(b.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span>Total Rows: <strong className="text-gray-800">{b.total_rows}</strong></span>
                      <span>· Created: <strong className="text-emerald-600">{b.success_rows}</strong></span>
                      <span>· Duplicates: <strong className="text-gray-600">{b.duplicate_rows}</strong></span>
                      {b.failed_rows > 0 && <span className="text-red-600 font-semibold">· Failed: <strong>{b.failed_rows}</strong></span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-gray-200">
            <Button size="sm" variant="secondary" onClick={() => setIsCsvHistoryOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}