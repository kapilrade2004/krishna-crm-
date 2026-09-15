'use strict';
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Badge, Modal, Select } from '@/components/ui';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import {
  Shield, ShieldCheck, ShieldX, Clock, AlertTriangle, Search,
  Plus, Eye, CheckCircle2, Package, RotateCcw, Truck, Check,
  Phone, ChevronRight, ChevronLeft, ChevronDown, X, List, LayoutGrid,
  ExternalLink, Copy,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { Warranty, WarrantyReturn, WarrantyStats } from '@/types';

// Reference Demonstration Dataset removed for clean local environment
const REFERENCE_WARRANTIES: any[] = [];


// ── Product SKU Customer Lookup Modal ───────────────────────────────────────
function ProductSkuLookupModal({
  isOpen,
  onClose,
  onSelectOrderForWarranty,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrderForWarranty: (order: any) => void;
}) {
  const [skuList, setSkuList] = useState<any[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [customSkuInput, setCustomSkuInput] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/warranty/sku-products')
        .then(res => {
          const list = res.data?.data?.products || [];
          setSkuList(list);
          if (list.length > 0 && list[0]?.product_sku) {
            setSelectedSku(list[0].product_sku);
          } else {
            setSelectedSku('');
          }
        })
        .catch(() => {
          setSkuList([]);
          setSelectedSku('');
        });
    }
  }, [isOpen]);

  const activeSku = customSkuInput.trim() || selectedSku;

  const fetchCustomersForSku = useCallback(async (skuToFetch: string) => {
    if (!skuToFetch) {
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/warranty/customers-by-sku', { params: { sku: skuToFetch } });
      setOrders(res.data?.data?.orders || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch customers for this SKU');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeSku) {
      fetchCustomersForSku(activeSku);
    } else if (isOpen && !activeSku) {
      setOrders([]);
    }
  }, [isOpen, activeSku, fetchCustomersForSku]);

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title="📦 Lookup Customers by Product SKU" size="xl">
      <div className="space-y-4 pt-1">
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Catalog Product</label>
              <select
                value={selectedSku}
                onChange={(e) => {
                  setSelectedSku(e.target.value);
                  setCustomSkuInput('');
                }}
                className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-white"
              >
                <option value="">Choose a product SKU...</option>
                {skuList.map((item) => (
                  <option key={item.product_sku || item.sku} value={item.product_sku || item.sku}>
                    {item.product_name || item.product_sku} ({item.product_sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Input
                label="Or Enter Custom SKU"
                placeholder="e.g. Mapp-Top-Mesh"
                value={customSkuInput}
                onChange={(e) => setCustomSkuInput(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-gray-900 mb-2">Matching Customer Orders ({orders.length})</h4>
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl">
            {loading ? (
              <div className="p-4 text-center text-xs text-gray-400">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">No orders found for this SKU</div>
            ) : (
              orders.map((ord) => (
                <div key={ord.id} className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-gray-900">{ord.order_number}</p>
                    <p className="text-gray-500">{ord.customer?.name} · {ord.customer?.phone}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      onSelectOrderForWarranty(ord);
                      onClose();
                    }}
                  >
                    Register Warranty
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Warranty Operations Component ──────────────────────────────────────
export default function WarrantyDashboard() {
  const [stats, setStats] = useState<WarrantyStats>({
    total: 2,
    active: 2,
    inactive: 0,
    pendingDelivery: 0,
    installationPending: 0,
    activationPending: 0,
    expiringSoon: 0,
    returnRequested: 0,
    returned: 1,
    expired: 0,
    openServiceRequests: 0,
  });

  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [returnsList, setReturnsList] = useState<WarrantyReturn[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs: 'all' | 'active' | 'pending_activation' | 'returns' | 'expiring_soon' | 'reset'
  const [lifecycleTab, setLifecycleTab] = useState<'all' | 'active' | 'pending_activation' | 'returns' | 'expiring_soon' | 'reset'>('all');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [returnStatusFilter, setReturnStatusFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [viewMode, setViewMode] = useState<'line' | 'detailed'>('line');

  // Modals
  const [isSkuLookupModalOpen, setIsSkuLookupModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Warranty | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Registration Form State
  const [regForm, setRegForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    orderId: '',
    marketplace: 'Amazon',
    productName: 'AquaBeat Water Purifier Premier',
    brand: 'AkuaBeat',
    modelName: 'Premier Alkaline RO+UV',
    serialNumber: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    addressLine1: '',
    city: '',
    state: '',
    pinCode: '',
  });

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchWarrantyData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        search,
        status: statusFilter,
        return_status: returnStatusFilter,
        verification_status: verificationFilter,
      };

      if (lifecycleTab === 'active') {
        params.warranty_status = 'ACTIVE';
      } else if (lifecycleTab === 'pending_activation') {
        params.warranty_status = 'ACTIVATION_PENDING';
      } else if (lifecycleTab === 'expiring_soon') {
        params.status = 'EXPIRING_SOON';
      } else if (lifecycleTab === 'reset') {
        params.warranty_status = 'WARRANTY_CANCELLED';
      }

      const [statsRes, listRes] = await Promise.all([
        api.get('/warranty/stats').catch(() => null),
        lifecycleTab === 'returns'
          ? api.get('/warranty/returns', { params: { search, status: returnStatusFilter } }).catch(() => null)
          : api.get('/warranty', { params }).catch(() => null),
      ]);

      const statsData = statsRes?.data?.data?.stats || statsRes?.data?.stats;
      if (statsData) {
        setStats(statsData);
      }

      if (lifecycleTab === 'returns') {
        const returnsData = listRes?.data?.data?.returns || listRes?.data?.returns || listRes?.data?.data || [];
        setReturnsList(Array.isArray(returnsData) ? returnsData : []);
      } else {
        const warrantiesData = listRes?.data?.data?.warranties || listRes?.data?.warranties || listRes?.data?.data || [];
        setWarranties(Array.isArray(warrantiesData) ? warrantiesData : []);
      }
    } catch (err) {
      console.error('Failed to fetch warranty data:', err);
      setWarranties([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, returnStatusFilter, verificationFilter, lifecycleTab]);

  useEffect(() => {
    fetchWarrantyData();
  }, [fetchWarrantyData]);

  // Displayed records after local search filter
  const displayedWarranties = useMemo(() => {
    const list = warranties;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((w: any) =>
      w.warranty_number?.toLowerCase().includes(q) ||
      w.order?.order_number?.toLowerCase().includes(q) ||
      w.order_id?.toLowerCase().includes(q) ||
      w.customer?.name?.toLowerCase().includes(q) ||
      w.customer?.phone?.includes(q) ||
      w.product_name_snapshot?.toLowerCase().includes(q)
    );
  }, [warranties, search]);

  // ── Manual Warranty Reset ──────────────────────────────────────────────────
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !resetReason.trim()) {
      toast.error('A mandatory reason is required to reset warranty.');
      return;
    }
    setIsResetting(true);
    try {
      const res = await api.post(`/warranty/${resetTarget.id}/reset`, {
        reason: resetReason.trim(),
      });
      toast.success(res.data?.message || 'Warranty manually reset. Audit history preserved.');
      setResetTarget(null);
      setResetReason('');
      fetchWarrantyData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset warranty.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/warranty/register', regForm);
      toast.success(res.data?.message || 'Warranty registered successfully!');
      setIsRegisterModalOpen(false);
      fetchWarrantyData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to register warranty');
    }
  };

  return (
    <AppShell>
      <Topbar
        icon={Shield}
        title="Warranty Operations & Dispatch Console"
        subtitle="Streamlined verification of customer product registrations, automated 1-year coverage activation, reverse logistics tracking, and field technician dispatch."
      />

      <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#f8fafc]/50">
        
        {/* Upper Action Bar (Lookup by SKU + Register Warranty) */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setIsSkuLookupModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span>Lookup by SKU</span>
          </button>
          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563eb] hover:bg-blue-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register Warranty</span>
          </button>
        </div>

        {/* ── ROW 1: 6 KPI SUMMARY CARDS ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          
          {/* Card 1: TOTAL */}
          <div
            onClick={() => {
              setLifecycleTab('all');
              setStatusFilter('');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm bg-white ${
              lifecycleTab === 'all' && !statusFilter
                ? 'border-blue-300 ring-1 ring-blue-400/40'
                : 'border-gray-200/90 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">TOTAL</span>
              <span className="text-[10px] font-bold text-gray-400">Fleet 👑</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                  {stats.total ?? 2}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium leading-none">All Registered</p>
              </div>
            </div>
          </div>

          {/* Card 2: ACTIVE */}
          <div
            onClick={() => {
              setLifecycleTab('active');
              setStatusFilter('');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm bg-white ${
              lifecycleTab === 'active'
                ? 'border-emerald-300 ring-1 ring-emerald-400/40'
                : 'border-gray-200/90 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">ACTIVE</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Protected 🛡
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                  {stats.active ?? 2}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Active Coverage</p>
              </div>
            </div>
          </div>

          {/* Card 3: INACTIVE */}
          <div
            onClick={() => {
              setLifecycleTab('all');
              setStatusFilter('INACTIVE');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm bg-white ${
              statusFilter === 'INACTIVE'
                ? 'border-blue-300 ring-1 ring-blue-400/40'
                : 'border-gray-200/90 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">INACTIVE</span>
              <span className="text-[10px] font-bold text-blue-600">0/1 ℹ</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                  {stats.inactive ?? 0}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Non-active / Pending</p>
              </div>
            </div>
          </div>

          {/* Card 4: EXPIRING */}
          <div
            onClick={() => {
              setLifecycleTab('expiring_soon');
              setStatusFilter('');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm bg-white ${
              lifecycleTab === 'expiring_soon'
                ? 'border-amber-300 ring-1 ring-amber-400/40'
                : 'border-gray-200/90 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">EXPIRING</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                  {stats.expiringSoon ?? 0}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium leading-none">&lt; 30 Days Left</p>
              </div>
            </div>
          </div>

          {/* Card 5: EXPIRED */}
          <div
            onClick={() => {
              setLifecycleTab('reset');
              setStatusFilter('');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm bg-white ${
              lifecycleTab === 'reset'
                ? 'border-slate-300 ring-1 ring-slate-400/40'
                : 'border-gray-200/90 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">EXPIRED</span>
              <span className="text-[10px] font-bold text-gray-400">Verified 🛡</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <ShieldX className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                  {stats.expired ?? 0}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Cancelled / Reset</p>
              </div>
            </div>
          </div>

          {/* Card 6: RETURNED */}
          <div
            onClick={() => {
              setLifecycleTab('returns');
              setReturnStatusFilter('CLOSED');
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-sm bg-white ${
              lifecycleTab === 'returns'
                ? 'border-rose-300 ring-1 ring-rose-400/40'
                : 'border-gray-200/90 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">RETURNED</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Settled 🛡
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-2xl font-bold font-mono text-gray-900 tracking-tight leading-none">
                  {stats.returned ?? 1}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium leading-none">Settled / Closed</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: NAVIGATION STATUS PILLS ─────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          {[
            { key: 'all', label: 'All Warranties', count: stats.total ?? 2 },
            { key: 'active', label: 'Active Coverage', count: stats.active ?? 2 },
            { key: 'pending_activation', label: 'Pending Activation', count: stats.activationPending ?? 0 },
            { key: 'returns', label: 'Returns & Logistics', count: (stats.returnRequested ?? 0) + (stats.returned ?? 0) },
            { key: 'expiring_soon', label: 'Expiring Soon', count: stats.expiringSoon ?? 0 },
            { key: 'reset', label: 'Reset Archive', count: stats.expired ?? 0 },
          ].map((tab) => {
            const isActive = lifecycleTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setLifecycleTab(tab.key as any);
                  setStatusFilter('');
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-2 cursor-pointer shadow-2xs ${
                  isActive
                    ? 'bg-[#0f172a] text-white font-semibold'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-slate-700 text-slate-200'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── ROW 3: SEARCH & FILTER BAR ────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by Warranty Number, Customer Name, Phone, Order ID, Serial Number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-24 py-2.5 text-xs bg-white border border-gray-200 rounded-xl shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-800 placeholder-gray-400"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-50 border border-gray-200 rounded-md">
                  Ctrl + K
                </kbd>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Status Select */}
            <div className="relative w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 pr-8 cursor-pointer"
              >
                <option value="">All Lifecycle Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="PENDING_DELIVERY">Pending Delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="INSTALLATION_COMPLETED">Installation Completed</option>
                <option value="ACTIVATION_PENDING">Activation Pending</option>
                <option value="RETURN_REQUESTED">Return Requested</option>
                <option value="RETURNED">Returned</option>
                <option value="EXPIRING_SOON">Expiring Soon</option>
                <option value="EXPIRED">Expired</option>
                <option value="WARRANTY_CANCELLED">Cancelled / Reset</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Verification Select */}
            <div className="relative w-44">
              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
                className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 pr-8 cursor-pointer"
              >
                <option value="">All Verification</option>
                <option value="VERIFIED">Verified Genuine</option>
                <option value="PENDING">Pending Review</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ── ROW 4 & 5: WARRANTIES DATA TABLE ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          
          {/* Card Header Bar */}
          <div className="px-6 py-4 border-b border-gray-200/90 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center font-bold">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-snug">Registered Product Warranties</h3>
                <p className="text-xs text-gray-500">
                  Customer equipment coverage, automated activation records, and lifecycle audits
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Density Toggle */}
              <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode('line')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewMode === 'line'
                      ? 'bg-[#0f172a] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Line View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('detailed')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewMode === 'detailed'
                      ? 'bg-[#0f172a] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Detailed</span>
                </button>
              </div>

              {/* Records Found Badge */}
              <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 border border-gray-200">
                {displayedWarranties.length} Records Found
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[960px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">WARRANTY &amp; ORDER</th>
                  <th className="py-3.5 px-6">CUSTOMER</th>
                  <th className="py-3.5 px-6">PRODUCT</th>
                  <th className="py-3.5 px-6">STATUS</th>
                  <th className="py-3.5 px-6">VALIDITY &amp; LIFECYCLE</th>
                  <th className="py-3.5 px-6 text-right pr-6">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedWarranties.map((w: any) => {
                  const orderRef = w.order?.order_number || w.order_id;
                  const isActive = (w.warranty_status || w.status) === 'ACTIVE';

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                      
                      {/* 1. Warranty & Order */}
                      <td className="py-4 px-6 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <div>
                            <Link
                              href={`/warranty/${w.id}`}
                              className="font-bold text-xs text-gray-900 hover:text-blue-600 transition-colors tracking-tight block"
                            >
                              {w.warranty_number}
                            </Link>
                            <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                              Order: {orderRef || 'ORD-1786982172439-0954'}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <span>📅 08 Sep 2026</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Customer */}
                      <td className="py-4 px-6 min-w-[160px]">
                        <p className="font-bold text-xs text-gray-900">
                          {w.customer?.name || w.customer_name_snapshot || 'Customer'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{w.customer?.phone || w.customer_phone_snapshot || '—'}</span>
                        </p>
                      </td>

                      {/* 3. Product */}
                      <td className="py-4 px-6 min-w-[220px]">
                        <p className="font-medium text-xs text-gray-900 truncate max-w-[240px]">
                          {w.product_name_snapshot || 'AquaBeat Water Purifier Premier'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {w.serial_number ? `SN: ${w.serial_number}` : 'No serial received'}
                        </p>
                      </td>

                      {/* 4. Status */}
                      <td className="py-4 px-6 min-w-[120px]">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            {w.warranty_status || w.status || 'Pending'}
                          </span>
                        )}
                      </td>

                      {/* 5. Validity & Lifecycle */}
                      <td className="py-4 px-6 min-w-[180px]">
                        <p className="font-medium text-xs text-gray-800">
                          Valid till {w.warranty_end_at ? fmtDate(w.warranty_end_at) : '10 Sep 2027'}
                        </p>
                        <div className="mt-0.5 text-[11px] flex items-center gap-1">
                          {w.delivered_at ? (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                              <span>Delivered</span>
                            </span>
                          ) : (
                            <span className="text-gray-500 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span>Pending delivery</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-4 px-6 text-right pr-6 min-w-[140px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/warranty/${w.id}`}>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-gray-500" />
                              <span>View</span>
                            </button>
                          </Link>

                          <button
                            type="button"
                            onClick={() => {
                              setResetTarget(w);
                              setResetReason('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 shadow-2xs transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                            <span>Reset</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── ROW 6: TABLE FOOTER & PAGINATION ─────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3.5 border-t border-gray-200/90 text-xs text-gray-500 gap-3">
            <div>
              Showing <span className="font-semibold text-gray-800">1-2</span> of{' '}
              <span className="font-semibold text-gray-800">{displayedWarranties.length}</span> records
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 disabled:opacity-40 cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2563eb] text-white font-semibold text-xs shadow-2xs"
              >
                1
              </button>
              <button
                type="button"
                disabled
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 disabled:opacity-40 cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* SKU Lookup Modal */}
      <ProductSkuLookupModal
        isOpen={isSkuLookupModalOpen}
        onClose={() => setIsSkuLookupModalOpen(false)}
        onSelectOrderForWarranty={(ord) => {
          setRegForm(prev => ({
            ...prev,
            orderId: ord.order_number || ord.id,
            fullName: ord.customer?.name || '',
            mobile: ord.customer?.phone || '',
            email: ord.customer?.email || '',
            productName: ord.product_name || prev.productName,
          }));
          setIsRegisterModalOpen(true);
        }}
      />

      {/* Register Warranty Modal */}
      <Modal
        open={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Product Warranty"
        size="lg"
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Order ID"
              placeholder="e.g. AMA-408-9148303-2383510"
              value={regForm.orderId}
              onChange={(e) => setRegForm({ ...regForm, orderId: e.target.value })}
              required
            />
            <Input
              label="Customer Full Name"
              placeholder="e.g. Rajesh Kumar"
              value={regForm.fullName}
              onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Customer Mobile"
              placeholder="10-digit mobile"
              value={regForm.mobile}
              onChange={(e) => setRegForm({ ...regForm, mobile: e.target.value })}
              required
            />
            <Input
              label="Customer Email"
              type="email"
              placeholder="customer@example.com"
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Product Name"
              value={regForm.productName}
              onChange={(e) => setRegForm({ ...regForm, productName: e.target.value })}
              required
            />
            <Input
              label="Serial Number (Optional)"
              placeholder="e.g. SN-AKB-99120"
              value={regForm.serialNumber}
              onChange={(e) => setRegForm({ ...regForm, serialNumber: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Register Warranty
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Warranty Modal */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Reset Warranty — ${resetTarget?.warranty_number}`}
      >
        <form onSubmit={handleResetSubmit} className="space-y-4 pt-1">
          <p className="text-xs text-gray-600">
            Resetting warranty will cancel active coverage for order #{resetTarget?.order?.order_number || resetTarget?.order_id}. A mandatory reason is required for audit trails.
          </p>
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              Reason for Reset <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Customer returned the product / order cancelled / defective unit replacement issued..."
              value={resetReason}
              onChange={(e) => setResetReason(e.target.value)}
              className="w-full p-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 text-gray-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={isResetting}>
              Confirm Reset
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
