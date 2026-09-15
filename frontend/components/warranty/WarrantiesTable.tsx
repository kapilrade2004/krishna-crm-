'use strict';
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Eye,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  Check,
  Phone,
  MapPin,
  LayoutGrid,
  List,
  Copy,
  Plus,
  Search,
  Info,
} from 'lucide-react';
import { fmtDate } from '@/lib/utils';
import type { Warranty } from '@/types';
import { Badge } from '@/components/ui';
import toast from 'react-hot-toast';

interface WarrantiesTableProps {
  warranties: Warranty[];
  loading: boolean;
  onQuickActivate: (id: string) => void;
  onReset: (warranty: Warranty) => void;
  onOpenRegisterModal?: () => void;
  onOpenSkuLookupModal?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

function EmptyWarrantyState({
  hasActiveFilters,
  onClearFilters,
  onOpenRegisterModal,
  onOpenSkuLookupModal,
}: {
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onOpenRegisterModal?: () => void;
  onOpenSkuLookupModal?: () => void;
}) {
  return (
    <div className="py-16 px-6 max-w-lg mx-auto text-center flex flex-col items-center animate-in fade-in-50 zoom-in-95 duration-300">
      {/* Shield Icon Container */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
          <ShieldCheck size={40} className="stroke-[2.2] text-slate-700" />
        </div>
      </div>

      {hasActiveFilters ? (
        <>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs mb-2.5">
            <span>Filter Active</span>
          </span>
          <h4 className="text-lg font-bold text-slate-900 tracking-tight">
            No Matching Warranties Found
          </h4>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm">
            No registered warranties match your current filter or search criteria.
          </p>
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Clear Search &amp; Filters</span>
            </button>
          )}
        </>
      ) : (
        <>
          <h4 className="text-lg font-bold text-slate-900 tracking-tight">
            No Warranties Registered Yet
          </h4>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm">
            All customer equipment is running smoothly. Register a new warranty or look up an order by SKU to get started.
          </p>
          <div className="mt-6 flex items-center gap-3.5 justify-center flex-wrap">
            {onOpenRegisterModal && (
              <button
                type="button"
                onClick={onOpenRegisterModal}
                className="px-4.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <Plus size={15} className="stroke-[2.5]" />
                <span>Register Warranty</span>
              </button>
            )}
            {onOpenSkuLookupModal && (
              <button
                type="button"
                onClick={onOpenSkuLookupModal}
                className="px-4.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-all border border-slate-200 shadow-2xs cursor-pointer"
              >
                <Search size={14} className="text-slate-500" />
                <span>Lookup by SKU</span>
              </button>
            )}
          </div>

          {/* Clean Info Notice */}
          <div className="mt-7 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2.5 text-left max-w-sm shadow-2xs">
            <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-900">Automated WhatsApp Activation</p>
              <p className="text-slate-500 leading-snug">
                Delivered orders automatically schedule customer WhatsApp activation within 24 hours.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function WarrantiesTable({
  warranties,
  loading,
  onQuickActivate,
  onReset,
  onOpenRegisterModal,
  onOpenSkuLookupModal,
  hasActiveFilters,
  onClearFilters,
}: WarrantiesTableProps) {
  const [density, setDensity] = useState<'simplified' | 'detailed'>('simplified');

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`Copied ${label} to clipboard!`, { id: 'copy-toast', duration: 2000 });
    }
  };

  const renderStatusBadge = (w: Warranty) => {
    const status = w.warranty_status || w.status;
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    if (['ACTIVATION_PENDING', 'ACTIVATION_MESSAGE_SENT', 'ACTIVATION_MESSAGE_SCHEDULED'].includes(status)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Activation Scheduled
        </span>
      );
    }
    if (status === 'RETURNED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Returned {w.return_status === 'CLOSED' ? '• Settled' : ''}
        </span>
      );
    }
    if (['RETURN_REQUESTED', 'RETURN_APPROVED'].includes(status)) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Return Requested
        </span>
      );
    }
    if (status === 'WARRANTY_CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300/80 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Cancelled / Reset
        </span>
      );
    }
    if (status === 'DELIVERED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/80 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
          Delivered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs whitespace-nowrap">
        {status ? status.replace(/_/g, ' ') : 'Pending'}
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* ── Table Toolbar ────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Registered Product Warranties</h3>
            <p className="text-[11px] text-slate-500">
              Customer equipment coverage, automated activation records, and lifecycle audits
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Density Switcher */}
          <div className="flex items-center bg-slate-200/60 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setDensity('simplified')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                density === 'simplified'
                  ? 'bg-white text-navy shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Line View (Default compact unified single-line rows across CRM)"
            >
              <List size={12} />
              <span>Line View</span>
            </button>

            <button
              type="button"
              onClick={() => setDensity('detailed')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                density === 'detailed'
                  ? 'bg-white text-navy shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="All 11 individual columns"
            >
              <List size={12} />
              <span>Detailed</span>
            </button>
          </div>

          <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {warranties.length} Records Found
          </span>
        </div>
      </div>

      {/* ── Table Container ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        {density === 'simplified' ? (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* 1. SIMPLIFIED MODERN TABLE (6 spacious, breathable columns)          */
          /* ═══════════════════════════════════════════════════════════════════ */
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-5 whitespace-nowrap">Warranty &amp; Order</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Customer</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Product</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Validity &amp; Lifecycle</th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading warranty records...</span>
                  </td>
                </tr>
              ) : warranties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyWarrantyState
                      hasActiveFilters={hasActiveFilters}
                      onClearFilters={onClearFilters}
                      onOpenRegisterModal={onOpenRegisterModal}
                      onOpenSkuLookupModal={onOpenSkuLookupModal}
                    />
                  </td>
                </tr>
              ) : (
                warranties.map((w) => {
                  const status = w.warranty_status || w.status;
                  const orderRef = w.order?.order_number || w.order_id;
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* 1. Warranty & Order */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/warranty/${w.id}`}
                            className="font-mono font-bold text-navy hover:text-amber-600 transition-colors inline-flex items-center gap-1.5 text-xs group-hover:underline"
                          >
                            <span>{w.warranty_number}</span>
                            <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-600" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleCopy(w.warranty_number, 'Warranty Number')}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-all cursor-pointer"
                            title="Copy Warranty Number"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                          <span className="text-slate-400">Order:</span>
                          <span className="font-semibold text-slate-700 max-w-[170px] truncate" title={orderRef || 'Direct Sale'}>
                            {orderRef || 'Direct Sale'}
                          </span>
                          {orderRef && (
                            <button
                              type="button"
                              onClick={() => handleCopy(orderRef, 'Order Number')}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-700 transition-opacity cursor-pointer"
                              title="Copy Order Number"
                            >
                              <Copy size={10} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 2. Customer */}
                      <td className="py-4 px-5 align-middle">
                        <p className="font-bold text-slate-900 text-xs">
                          {w.customer?.name || 'Customer'}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 whitespace-nowrap">
                          {w.customer?.phone && (
                            <a
                              href={`tel:${w.customer.phone}`}
                              className="font-mono text-slate-600 hover:text-amber-600 flex items-center gap-1 transition-colors"
                              title="Call Customer"
                            >
                              <Phone size={10} className="text-slate-400" />
                              <span>{w.customer.phone}</span>
                            </a>
                          )}
                          {w.customer?.phone && w.customer?.city && (
                            <span className="text-slate-300">•</span>
                          )}
                          {w.customer?.city && (
                            <span className="flex items-center gap-0.5 text-slate-500">
                              <MapPin size={10} className="text-slate-400" />
                              <span>{w.customer.city}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Product */}
                      <td className="py-4 px-5 align-middle max-w-[260px]">
                        <p className="font-semibold text-slate-900 truncate text-xs" title={w.product_name_snapshot}>
                          {w.product_name_snapshot}
                        </p>
                        {w.serial_number ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-medium border border-slate-200/80 whitespace-nowrap">
                              <span>SN:</span>
                              <span>{w.serial_number}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No serial recorded</span>
                        )}
                      </td>

                      {/* 4. Status */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        {renderStatusBadge(w)}
                      </td>

                      {/* 5. Validity & Lifecycle */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs">
                          {w.warranty_end_at || w.warranty_end_date ? (
                            <span>Valid till {fmtDate(w.warranty_end_at || w.warranty_end_date)}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Validity pending</span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                          {w.installation_completed_at ? (
                            <span className="text-teal-600 font-medium flex items-center gap-1">
                              <CheckCircle2 size={11} /> Installed
                            </span>
                          ) : w.delivered_at ? (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <Truck size={11} /> Delivered
                            </span>
                          ) : (
                            <span className="text-slate-400 italic flex items-center gap-1">
                              <Clock size={11} /> Pending delivery
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-4 px-5 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {status !== 'ACTIVE' && (
                            <button
                              onClick={() => onQuickActivate(w.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-2xs"
                            >
                              Activate
                            </button>
                          )}

                          <Link href={`/warranty/${w.id}`}>
                            <button className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors shadow-2xs">
                              <Eye size={12} /> View
                            </button>
                          </Link>

                          <button
                            onClick={() => onReset(w)}
                            title="Reset warranty on return"
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg text-xs transition-colors shadow-2xs"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════ */
          /* 2. DETAILED FULL-COLUMN TABLE (Formatted, non-wrapping)             */
          /* ═══════════════════════════════════════════════════════════════════ */
          <table className="w-full text-left border-collapse text-xs min-w-[1250px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap">Warranty No.</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Customer</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Phone</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Product &amp; Serial</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Order ID</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Delivered</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Installed</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Coverage State</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Return Status</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Expiry Date</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading warranty records...</span>
                  </td>
                </tr>
              ) : warranties.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-0">
                    <EmptyWarrantyState
                      hasActiveFilters={hasActiveFilters}
                      onClearFilters={onClearFilters}
                      onOpenRegisterModal={onOpenRegisterModal}
                      onOpenSkuLookupModal={onOpenSkuLookupModal}
                    />
                  </td>
                </tr>
              ) : (
                warranties.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <Link href={`/warranty/${w.id}`} className="text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1">
                        {w.warranty_number}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-bold text-slate-900">{w.customer?.name || 'Customer'}</p>
                      <p className="text-[11px] text-slate-500">{w.customer?.city || 'India'}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {w.customer?.phone || '-'}
                    </td>
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <p className="font-semibold text-slate-900 truncate" title={w.product_name_snapshot}>
                        {w.product_name_snapshot}
                      </p>
                      {w.serial_number && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200 whitespace-nowrap">
                          SN: {w.serial_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {w.order?.order_number || w.order_id || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {w.delivered_at ? fmtDate(w.delivered_at) : <span className="text-slate-400 italic">Pending</span>}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {w.installation_completed_at ? fmtDate(w.installation_completed_at) : <span className="text-slate-400 italic">Pending</span>}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(w)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {w.return_status && w.return_status !== 'NONE' ? (
                        <Badge variant={w.return_status === 'ACCEPTED' || w.return_status === 'CLOSED' ? 'danger' : 'warning'}>
                          {w.return_status}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-medium">
                      {fmtDate(w.warranty_end_at || w.warranty_end_date)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {w.warranty_status !== 'ACTIVE' && w.status !== 'ACTIVE' && (
                          <button
                            onClick={() => onQuickActivate(w.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition-colors"
                          >
                            Activate
                          </button>
                        )}

                        <Link href={`/warranty/${w.id}`}>
                          <button className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors">
                            <Eye size={11} /> View
                          </button>
                        </Link>

                        <button
                          onClick={() => onReset(w)}
                          title="Reset warranty on return"
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-[11px] transition-colors"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
