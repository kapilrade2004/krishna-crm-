'use client';
import { useState, useEffect } from 'react';
import { useOrderWhatsAppLogs, useSendOrderTemplate, useOrderImages } from '@/hooks/useApi';
import { Button, Badge, Modal } from '@/components/ui';
import { fmtDateTime, timeAgo, getMediaUrl } from '@/lib/utils';
import {
  MessageCircle, Send, CheckCircle2, Clock, AlertTriangle, ShieldCheck,
  RotateCw, Truck, FileText, Check, ExternalLink, HelpCircle, XCircle, ChevronRight, Info,
  ImageIcon, Eye,
} from 'lucide-react';
import type { Order } from '@/types';

export const WHATSAPP_TEMPLATES = [
  {
    key: 'order_verification_interactive',
    name: '1. Order Verification (Interactive)',
    short: 'Msg 1: Verification',
    category: 'Verification',
    desc: 'Interactive buttons for customer to Confirm Product, Send Screenshot, or Cancel Order.',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <MessageCircle size={14} className="text-emerald-600" />,
  },
  {
    key: 'screenshot_from_customer',
    name: '1.1 Request Customer Screenshot',
    short: 'Msg 1.1: Request Photo',
    category: 'Verification',
    desc: 'Sent immediately when customer clicks [Send Screenshot]. Prompts buyer to share photo of tap/purifier.',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <ImageIcon size={14} className="text-purple-600" />,
  },
  {
    key: 'order_confirmation013',
    name: '2. 15-Min Detailed Order Confirmation',
    short: 'Msg 2: 15m Pricing Conf',
    category: 'Verification',
    desc: 'Detailed summary of SKU, Quantity, and Payable Amount with Confirm/Cancel options.',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: <Clock size={14} className="text-sky-600" />,
  },
  {
    key: 'order_confirmation',
    name: '3. Order Confirmed Notice',
    short: 'Msg 3: Confirmed',
    category: 'Verification',
    desc: 'Notice sent to customer once order is verified and ready for fulfillment.',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: <CheckCircle2 size={14} className="text-indigo-600" />,
  },
  {
    key: 'order_cancelled',
    name: '4. Order Cancelled Notice',
    short: 'Msg 4: Cancelled',
    category: 'Verification',
    desc: 'Notice sent to customer informing them of order cancellation.',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <XCircle size={14} className="text-rose-600" />,
  },
  {
    key: 'order_dispatched',
    name: '5. Order Dispatched (AWB & Courier)',
    short: 'Msg 5: Dispatched',
    category: 'Shipping',
    desc: 'Fulfillment update with courier partner and tracking AWB number.',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Truck size={14} className="text-amber-600" />,
  },
  {
    key: 'order_deliverd',
    name: '6. Order Delivered Notice',
    short: 'Msg 6: Delivered',
    category: 'Shipping',
    desc: 'Sent upon successful delivery confirmation to customer.',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <CheckCircle2 size={14} className="text-blue-600" />,
  },
  {
    key: 'installation_guide',
    name: '7. Product Installation Guide',
    short: 'Msg 7: Install Guide',
    category: 'Shipping',
    desc: 'Step-by-step installation instructions for the customer purifier.',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <FileText size={14} className="text-purple-600" />,
  },
  {
    key: 'warranty_claim',
    name: '8. 24-Hour Warranty Claim Invitation',
    short: 'Msg 8: Warranty Claim (24h)',
    category: 'Warranty',
    desc: 'Sent 24h post-delivery with brand image & dynamic registration link button.',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: <ShieldCheck size={14} className="text-teal-600" />,
  },
  {
    key: 'warranty_activated1',
    name: '9. Warranty Activated (warranty_activated1)',
    short: 'Msg 9: Warranty Activated',
    category: 'Utility',
    desc: 'Dear {{customer_name}} - Approved Utility template sent when warranty registration is activated.',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    icon: <Check size={14} className="text-emerald-700" />,
  },
];

interface OrderWhatsAppSectionProps {
  order: Order;
}

export default function OrderWhatsAppSection({ order }: OrderWhatsAppSectionProps) {
  const { data: logs = [], isLoading: isLogsLoading, refetch } = useOrderWhatsAppLogs(order.id);
  const { data: customerImages = [] } = useOrderImages(order.id);
  const sendTemplate = useSendOrderTemplate();

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('order_verification_interactive');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [templateToConfirm, setTemplateToConfirm] = useState<typeof WHATSAPP_TEMPLATES[0] | null>(null);
  const [waSendingStatus, setWaSendingStatus] = useState<{ enabled?: boolean } | null>(null);

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/whatsapp/sending-status')
        .then((res) => setWaSendingStatus(res.data?.data || null))
        .catch(() => {});
    });
  }, []);

  const phone = order.customer?.whatsapp_number || order.customer?.phone || order.customer_phone || (order.shipping_address as any)?.ship_phone || '';
  const selectedTemplate = WHATSAPP_TEMPLATES.find(t => t.key === selectedTemplateKey) || WHATSAPP_TEMPLATES[0];

  // Map of which templates were already sent for this order
  const sentTemplatesMap = new Map<string, { status: string; sentAt: string; messageId?: string }>();
  logs.forEach((log: any) => {
    if (log.template_name && !sentTemplatesMap.has(log.template_name)) {
      sentTemplatesMap.set(log.template_name, {
        status: log.status,
        sentAt: log.created_at || log.sent_at,
        messageId: log.wa_message_id,
      });
    }
  });

  const handleInitiateSend = (tmpl: typeof WHATSAPP_TEMPLATES[0]) => {
    setTemplateToConfirm(tmpl);
    setConfirmModalOpen(true);
  };

  const handleConfirmSend = () => {
    if (!templateToConfirm) return;
    sendTemplate.mutate(
      { id: order.id, template_name: templateToConfirm.key },
      {
        onSuccess: () => {
          setConfirmModalOpen(false);
          setTemplateToConfirm(null);
          refetch();
        },
        onError: () => {
          setConfirmModalOpen(false);
          setTemplateToConfirm(null);
        },
      }
    );
  };

  const isAlreadySent = templateToConfirm ? sentTemplatesMap.has(templateToConfirm.key) : false;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-bold">
            <MessageCircle size={18} />
          </span>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              WhatsApp Communication & Template Dispatch Center
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Recipient: {phone ? `+91 ${phone.replace(/\D/g, '').slice(-10)}` : 'No Phone Number'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Co-workers can manually dispatch any approved template, view real-time delivery status, and review complete communication history.
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          title="Refresh Message Status"
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-xs flex items-center gap-1"
        >
          <RotateCw size={13} className={isLogsLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Section 78: Operational Workflow Status & Timeout Diagnosis Card */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-indigo-100 text-indigo-700">
              <Info size={14} />
            </span>
            <span className="text-xs font-bold text-slate-800">
              Workflow Status & Stuck Order Diagnosis
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
              Flow Stage: <span className="font-mono text-indigo-600 font-bold">{order.flow_stage || 'N/A'}</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
              Verification: <span className="font-mono text-emerald-600 font-bold">{order.verification_status || 'N/A'}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
          <div className="bg-white border border-slate-200 rounded p-2">
            <span className="text-slate-400 font-semibold block uppercase text-[9px]">Active Timer / Deadline</span>
            <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
              <Clock size={12} className="text-amber-500" />
              {order.second_message_due_at ? (
                <span className="text-amber-700 font-bold">15m Screenshot Due: {fmtDateTime(order.second_message_due_at)}</span>
              ) : (order as any).final_confirmation_due_at ? (
                <span className="text-indigo-700 font-bold">Final Conf Due: {fmtDateTime((order as any).final_confirmation_due_at)}</span>
              ) : (
                <span className="text-slate-500">No Active Countdown</span>
              )}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2">
            <span className="text-slate-400 font-semibold block uppercase text-[9px]">Next Expected Input</span>
            <span className="font-medium text-slate-800 mt-0.5 block truncate">
              {order.status === 'pending' || order.status === 'image_verification'
                ? (order.second_message_due_at ? 'Customer Screenshot / Photo' : 'Customer Button Response')
                : order.status === 'pending_confirmation'
                ? 'Customer Final Confirmation'
                : order.status === 'confirmed'
                ? 'Warehouse Packing & Dispatch'
                : order.status === 'dispatched'
                ? 'Courier Delivery Confirmation'
                : order.status === 'delivered'
                ? 'Installation / Warranty'
                : 'Order Closed'}
            </span>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2">
            <span className="text-slate-400 font-semibold block uppercase text-[9px]">Timeout Action</span>
            <span className="font-medium text-slate-800 mt-0.5 block truncate">
              {order.second_message_due_at
                ? 'Auto-send Msg 2 (order_confirmation013)'
                : (order as any).final_confirmation_due_at
                ? 'Auto-cancel (Customer No Response)'
                : 'None (Awaiting manual/external event)'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Left = Template Action Palette, Right = Communication Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: 9 Approved Templates Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              Select Template to Send Manually
            </span>
            <span className="text-[10px] text-slate-400">
              {sentTemplatesMap.size} of 9 Dispatched
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WHATSAPP_TEMPLATES.map((tmpl) => {
              const sentInfo = sentTemplatesMap.get(tmpl.key);
              const isSelected = selectedTemplateKey === tmpl.key;

              return (
                <div
                  key={tmpl.key}
                  onClick={() => setSelectedTemplateKey(tmpl.key)}
                  className={`border rounded-lg p-2.5 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                        {tmpl.icon}
                        <span className="truncate">{tmpl.short}</span>
                      </span>
                      {sentInfo ? (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                          sentInfo.status === 'sent' || sentInfo.status === 'delivered' || sentInfo.status === 'read'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {sentInfo.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                          Not Sent
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-tight">
                      {tmpl.desc}
                    </p>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-mono truncate">
                      {tmpl.key}
                    </span>
                    <button
                      type="button"
                      disabled={sendTemplate.isPending || !phone}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInitiateSend(tmpl);
                      }}
                      className={`text-[11px] font-semibold px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                        sentInfo
                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                      }`}
                    >
                      <Send size={11} />
                      <span>{sentInfo ? 'Resend' : 'Send'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Template Details Banner & Primary Dispatch Button */}
          <div className="bg-slate-900 text-white rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold text-xs">{selectedTemplate.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/80 font-mono">
                  {selectedTemplate.category}
                </span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-1">{selectedTemplate.desc}</p>
            </div>

            <Button
              variant="primary"
              disabled={!phone || waSendingStatus?.enabled === false}
              loading={sendTemplate.isPending}
              onClick={() => handleInitiateSend(selectedTemplate)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs h-9 px-4 shrink-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              icon={<Send size={14} />}
              title={waSendingStatus?.enabled === false ? 'WhatsApp sending is globally paused' : undefined}
            >
              {waSendingStatus?.enabled === false ? 'Sending Paused' : 'Dispatch to Customer'}
            </Button>
          </div>

          {waSendingStatus?.enabled === false && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600 shrink-0" />
              <span>🛑 WhatsApp sending is globally paused by the Emergency Kill Switch. Messages cannot be dispatched until resumed.</span>
            </div>
          )}
        </div>

        {/* Right Column: Live Order Message History Stream (5 cols) */}
        <div className="lg:col-span-5 bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock size={14} className="text-blue-600" />
                Message History ({logs.length})
              </span>
              <span className="text-[10px] text-slate-500">Live Auto-Refreshed</span>
            </div>

            {/* Inbound Customer Media Notification Widget if images exist */}
            {customerImages.length > 0 && (
              <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-amber-600" />
                    Inbound Customer Photos ({customerImages.length})
                  </span>
                  <span className="text-[10px] text-amber-800 font-semibold px-1.5 py-0.5 rounded bg-amber-200/70">
                    S3 Verified
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
                  {customerImages.map((img: any) => {
                    const src = getMediaUrl(img);
                    return (
                      <div key={img.id} className="relative w-14 h-14 shrink-0 rounded-md overflow-hidden border border-amber-300 bg-slate-900">
                        {src ? (
                          <a href={src} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="Customer tap" className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <span className={`absolute bottom-0 inset-x-0 text-[8px] text-center font-bold uppercase text-white ${
                          img.status === 'approved' ? 'bg-emerald-600/90' : img.status === 'rejected' ? 'bg-red-600/90' : 'bg-amber-600/90'
                        }`}>
                          {img.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message Stream List */}
            {logs.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {logs.map((log: any) => {
                  const tmplInfo = WHATSAPP_TEMPLATES.find(t => t.key === log.template_name);
                  const isSuccess = ['sent', 'delivered', 'read'].includes(log.status);

                  return (
                    <div
                      key={log.id}
                      className={`border rounded-lg p-2.5 text-xs space-y-1 ${
                        log.direction === 'inbound' ? 'bg-purple-50/70 border-purple-200' :
                        isSuccess ? 'bg-white border-slate-200' : 'bg-rose-50/70 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-900 flex items-center gap-1 truncate">
                          {log.direction === 'inbound' ? (
                            <span className="flex items-center gap-1 text-purple-700">
                              <ImageIcon size={13} /> Inbound Customer Message ({log.message_type || 'Media'})
                            </span>
                          ) : (
                            <>
                              {tmplInfo?.icon || <MessageCircle size={13} />}
                              <span className="truncate">{tmplInfo?.short || log.template_name || 'Template'}</span>
                            </>
                          )}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          log.status === 'read' ? 'bg-purple-100 text-purple-800' :
                          log.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                          log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {log.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{log.direction === 'inbound' ? `From: ${log.phone_number}` : `To: ${log.phone_number || phone}`}</span>
                        <span>{fmtDateTime(log.created_at || log.sent_at)}</span>
                      </div>

                      {log.error_message && (
                        <p className="text-[10px] text-rose-700 bg-rose-100/50 p-1 rounded font-mono break-all">
                          {log.error_message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center space-y-1">
                <MessageCircle size={28} className="text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No WhatsApp messages dispatched yet</p>
                <p className="text-[11px] text-slate-400">Select any approved template on the left to send manually.</p>
              </div>
            )}
          </div>

          {/* Warranty 24-Hour Automated Rule Summary */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-950">
              <ShieldCheck size={14} className="text-amber-700" />
              Automated Warranty Lifecycle
            </div>
            <p className="text-[11px] text-amber-800/90 leading-tight">
              • <strong>After 24h of Delivery:</strong> System automatically schedules and dispatches <code>warranty_claim</code>.
            </p>
            <p className="text-[11px] text-amber-800/90 leading-tight">
              • <strong>On Customer Registration:</strong> System automatically activates warranty and sends <code>warranty_activated</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && templateToConfirm && (
        <Modal
          open={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Confirm WhatsApp Template Dispatch"
        >
          <div className="space-y-4 pt-1">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{templateToConfirm.name}</span>
                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {templateToConfirm.key}
                </span>
              </div>
              <p className="text-xs text-slate-600">{templateToConfirm.desc}</p>
              <div className="pt-2 border-t border-slate-200 text-xs flex justify-between">
                <span className="text-slate-500">Recipient Mobile:</span>
                <strong className="text-slate-900">{phone ? `+91 ${phone.replace(/\D/g, '').slice(-10)}` : 'No phone specified'}</strong>
              </div>
            </div>

            {isAlreadySent && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-900">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Notice: Duplicate Warning</strong>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    This template was already dispatched to this customer earlier. Are you sure you want to resend it?
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="secondary" onClick={() => setConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={sendTemplate.isPending}
                onClick={handleConfirmSend}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                icon={<Send size={14} />}
              >
                Confirm & Send Now
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
