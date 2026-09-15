'use client';

import { useState, useEffect, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Input, Select, Modal, Badge, EmptyState, PageLoader, Textarea } from '@/components/ui';
import { fmtDate } from '@/lib/utils';
import {
  PhoneCall, Upload, Calendar, MapPin, CheckCircle, Clock, MessageSquare,
  Search, Filter, Plus, ChevronRight, Phone, Send, UserCheck, AlertCircle,
  Layers, Users, Wrench, ShieldAlert, Check, RefreshCw, ExternalLink
} from 'lucide-react';
import api from '@/lib/api';
import ChannelSelectionModal from '@/components/csv/ChannelSelectionModal';
import toast from 'react-hot-toast';

interface CustomerOrder {
  id: string;
  order_number: string;
  marketplace_order_id?: string;
  marketplace?: string;
  status: string;
  verification_status?: string;
  total_amount?: number;
  product_sku?: string;
  product_name?: string;
  delivery_pincode?: string;
  delivered_at?: string;
  flow_stage?: string;
  shipping_address?: any;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp_number?: string;
  email: string;
  city?: string;
  state?: string;
  pincode?: string;
  status: string;
  source: string;
  lifecycle_stage?: string;
  installation_help_requested?: boolean;
  installation_help_requested_at?: string | null;
  installation_help_status?: 'pending' | 'contacted' | 'visit_scheduled' | 'resolved';
  installation_notes?: string;
  tags?: string[];
  notes: string;
  last_contacted_at: string | null;
  assigned_to: string;
  orders?: CustomerOrder[];
}

export default function TelecallerWorkbenchPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'contacted' | 'visits'>('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState<'all' | 'verification' | 'installation'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');

  const isVerificationLead = (lead: Customer | null) => {
    if (!lead) return false;
    const tags = Array.isArray(lead.tags) ? lead.tags : [];
    const notes = lead.notes || '';
    const installNotes = lead.installation_notes || '';
    return (
      tags.includes('call_representative_requested') ||
      tags.includes('verification_callback') ||
      notes.includes('Verification Callback') ||
      notes.includes('Call Representative') ||
      installNotes.includes('Call Representative') ||
      installNotes.includes('Verification Callback') ||
      Boolean(lead.orders?.some((o) => o.verification_status === 'call_representative_requested'))
    );
  };

  // Modal States
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Visit Form
  const [visitForm, setVisitForm] = useState({
    visit_type: 'store_visit', // 'store_visit' or 'technician_home_dispatch'
    centre_name: 'Thane Centre',
    technician_name: 'Rahul Sharma (Field Tech)',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '11:00 AM',
    notes: 'Customer requested installation assistance.',
  });

  // Call Log Form
  const [callForm, setCallForm] = useState({
    status: 'Connected',
    installation_status: 'contacted',
    remarks: 'Customer called. Scheduled installation guidance.',
  });

  // Quick Status Form
  const [statusForm, setStatusForm] = useState({
    status: 'contacted',
    notes: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      // Exclusively fetch leads who pressed "Yes, Need Help" on WhatsApp and are not resolved/dismissed
      const res = await api.get<any>('/customers?installation_help=true&limit=200').catch(() => ({ data: {} }));
      const leadList: Customer[] = Array.isArray(res.data?.data)
        ? res.data.data
        : (Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []));
      
      // Strict client-side safety guard: only include if installation_help_requested === true and not resolved
      const validHelpLeads = leadList.filter(c => c.installation_help_requested && c.installation_help_status !== 'resolved');
      setCustomers(validHelpLeads);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setSaving(true);
    try {
      const locationOrTech = visitForm.visit_type === 'technician_home_dispatch'
        ? `Field Tech: ${visitForm.technician_name}`
        : visitForm.centre_name;

      await api.post(`/customers/${selectedCustomer.id}/dispatch-visit`, {
        centre_name: locationOrTech,
        visit_date: visitForm.visit_date,
        visit_time: visitForm.visit_time,
        notes: `[${visitForm.visit_type === 'technician_home_dispatch' ? 'Technician Dispatch' : 'Centre Visit'}] ${visitForm.notes}`,
      });

      // Also update installation help status if customer had requested it
      if (selectedCustomer.installation_help_requested) {
        await api.patch(`/customers/${selectedCustomer.id}/installation-status`, {
          status: 'visit_scheduled',
          visit_date: visitForm.visit_date,
          visit_time: visitForm.visit_time,
          technician_name: visitForm.technician_name,
          notes: `Visit scheduled at ${locationOrTech}`,
        }).catch(() => {});
      }

      toast.success(`Visit scheduled for ${selectedCustomer.name} at ${locationOrTech}! WhatsApp alert sent.`);
      setShowVisitModal(false);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch visit');
    } finally {
      setSaving(false);
    }
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setSaving(true);
    try {
      await api.patch(`/customers/${selectedCustomer.id}`, {
        notes: `[Call Log - ${callForm.status}] ${callForm.remarks}`,
        last_contacted_at: new Date().toISOString(),
      });

      if (selectedCustomer.installation_help_requested) {
        await api.patch(`/customers/${selectedCustomer.id}/installation-status`, {
          status: callForm.installation_status,
          notes: callForm.remarks,
        }).catch(() => {});
      }

      toast.success(`Call log recorded for ${selectedCustomer.name}`);
      setShowCallModal(false);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to log call');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setSaving(true);
    try {
      await api.patch(`/customers/${selectedCustomer.id}/installation-status`, {
        status: statusForm.status,
        notes: statusForm.notes,
      });

      toast.success(`Installation status updated for ${selectedCustomer.name}`);
      setShowStatusModal(false);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  // Metrics for WhatsApp Leads (Order Verification Callbacks + Installation Help)
  const urgentPendingCount = useMemo(() => {
    return customers.filter(c => !c.installation_help_status || c.installation_help_status === 'pending').length;
  }, [customers]);

  const verificationCount = useMemo(() => {
    return customers.filter(c => isVerificationLead(c) && (!c.installation_help_status || c.installation_help_status === 'pending')).length;
  }, [customers]);

  const installationCount = useMemo(() => {
    return customers.filter(c => !isVerificationLead(c) && (!c.installation_help_status || c.installation_help_status === 'pending')).length;
  }, [customers]);

  const contactedCount = useMemo(() => {
    return customers.filter(c => c.installation_help_status === 'contacted').length;
  }, [customers]);

  const scheduledVisitsCount = useMemo(() => {
    return customers.filter(c => c.installation_help_status === 'visit_scheduled' || (c.notes && (c.notes.includes('Centre Visit') || c.notes.includes('Technician Dispatch')))).length;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // 1. Strict WhatsApp "Yes, Need Help" & "Call Representative" gate: must be true and never resolved
      if (!c.installation_help_requested || c.installation_help_status === 'resolved') {
        return false;
      }

      // 2. Request Type Filter (All / Verification Callbacks / Installation Help)
      if (requestTypeFilter === 'verification' && !isVerificationLead(c)) {
        return false;
      }
      if (requestTypeFilter === 'installation' && isVerificationLead(c)) {
        return false;
      }

      // 3. Tab filter
      if (activeTab === 'pending' && c.installation_help_status && c.installation_help_status !== 'pending') {
        return false;
      }
      if (activeTab === 'contacted' && c.installation_help_status !== 'contacted') {
        return false;
      }
      if (activeTab === 'visits' && c.installation_help_status !== 'visit_scheduled' && (!c.notes || (!c.notes.includes('Centre Visit') && !c.notes.includes('Technician Dispatch')))) {
        return false;
      }

      // 4. Search term
      const q = searchTerm.toLowerCase();
      const latestOrder = c.orders && c.orders.length > 0 ? c.orders[0] : null;
      const matchesQ =
        !searchTerm ||
        c.name?.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q)) ||
        (latestOrder?.order_number && latestOrder.order_number.toLowerCase().includes(q)) ||
        (latestOrder?.product_name && latestOrder.product_name.toLowerCase().includes(q));

      // 5. Status filter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && (!c.installation_help_status || c.installation_help_status === 'pending')) ||
        (statusFilter === 'contacted' && c.installation_help_status === 'contacted') ||
        (statusFilter === 'visit_scheduled' && c.installation_help_status === 'visit_scheduled') ||
        c.installation_help_status === statusFilter;

      // 6. Channel filter
      const matchesChannel =
        channelFilter === 'all' ||
        c.source?.toLowerCase() === channelFilter.toLowerCase();

      return matchesQ && matchesStatus && matchesChannel;
    });
  }, [customers, activeTab, requestTypeFilter, searchTerm, statusFilter, channelFilter]);

  return (
    <AppShell>
      <Topbar
        title="Telecaller Ingestion & Dispatch Suite"
        subtitle="Inbound WhatsApp Leads: Order Verification 'Call Representative' & Delivery 'Yes, Need Help'"
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Gradient Command Bar Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-amber-300 border border-white/20 mb-2">
                <PhoneCall size={13} />
                Inbound WhatsApp Calling Workbench • Verification &amp; Installation
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                Telecaller Calling Workbench
                {verificationCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
                    <PhoneCall size={12} /> {verificationCount} Verification Callback{verificationCount > 1 ? 's' : ''}
                  </span>
                )}
                {installationCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white">
                    <Wrench size={12} /> {installationCount} Installation Help
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Real-time queue of customer requests from WhatsApp: customers who clicked <strong>&quot;Call Representative&quot;</strong> on their Order Verification message (Message 1) and customers who clicked <strong>&quot;Yes, Need Help&quot;</strong> on their Delivery Guide message.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                icon={<RefreshCw size={14} />}
                onClick={fetchLeads}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                icon={<Upload size={15} />}
                onClick={() => setShowChannelModal(true)}
                className="bg-amber hover:bg-amber-600 text-navy font-bold shadow-lg text-xs"
              >
                Bulk Upload Leads
              </Button>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => {
              setActiveTab('all');
              setRequestTypeFilter('all');
            }}
            className={`card flex items-center justify-between cursor-pointer transition-all ${
              activeTab === 'all' && requestTypeFilter === 'all' ? 'ring-2 ring-navy shadow-md' : 'hover:border-navy/30'
            }`}
          >
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">All WhatsApp Leads</p>
              <p className="text-2xl font-bold text-navy mt-1">{customers.length}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-navy/10 text-navy flex items-center justify-center">
              <UserCheck size={20} />
            </div>
          </div>

          <div
            onClick={() => {
              setActiveTab('pending');
              setRequestTypeFilter('verification');
            }}
            className={`card flex items-center justify-between cursor-pointer transition-all border-amber-300/80 bg-amber-50/40 ${
              requestTypeFilter === 'verification' ? 'ring-2 ring-amber-500 shadow-md bg-amber-50' : 'hover:border-amber-400'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">⚡ Verification Callbacks</p>
                {verificationCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
              </div>
              <p className="text-2xl font-extrabold text-amber-700 mt-1">{verificationCount} Urgent</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold">
              <PhoneCall size={20} />
            </div>
          </div>

          <div
            onClick={() => {
              setActiveTab('pending');
              setRequestTypeFilter('installation');
            }}
            className={`card flex items-center justify-between cursor-pointer transition-all border-blue-300/80 bg-blue-50/40 ${
              requestTypeFilter === 'installation' ? 'ring-2 ring-blue-500 shadow-md bg-blue-50' : 'hover:border-blue-400'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">🔧 Installation Help</p>
                {installationCount > 0 && <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
              </div>
              <p className="text-2xl font-extrabold text-blue-700 mt-1">{installationCount} Urgent</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-800 flex items-center justify-center font-bold">
              <Wrench size={20} />
            </div>
          </div>

          <div
            onClick={() => {
              setActiveTab('contacted');
              setRequestTypeFilter('all');
            }}
            className={`card flex items-center justify-between cursor-pointer transition-all ${
              activeTab === 'contacted' ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:border-indigo-300'
            }`}
          >
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">In Progress / Contacted</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{contactedCount} Active</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
            {/* Quick Filter Switcher */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-navy text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Inbound ({customers.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'pending'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300/60'
                }`}
              >
                <PhoneCall size={13} />
                ⚡ Pending Call ({urgentPendingCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contacted')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'contacted'
                    ? 'bg-indigo-700 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Contacted / In Progress ({contactedCount})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('visits')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'visits'
                    ? 'bg-emerald-700 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Scheduled Visits ({scheduledVisitsCount})
              </button>
            </div>

            {/* Category / Trigger Filter Pills */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 border border-slate-300">
              <button
                type="button"
                onClick={() => setRequestTypeFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  requestTypeFilter === 'all'
                    ? 'bg-white text-navy shadow-sm font-bold'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                All Leads ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setRequestTypeFilter('verification')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                  requestTypeFilter === 'verification'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                <PhoneCall size={11} />
                ⚡ Verification ({verificationCount})
              </button>
              <button
                type="button"
                onClick={() => setRequestTypeFilter('installation')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                  requestTypeFilter === 'installation'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                <Wrench size={11} />
                🔧 Installation ({installationCount})
              </button>
            </div>
          </div>

          {/* Search & Select Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80 flex-1 max-w-md">
              <Input
                placeholder="Search by name, phone, order #, product, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 sm:w-52"
                options={[
                  { value: 'all', label: 'All Help Statuses' },
                  { value: 'pending', label: '⚡ Pending Call' },
                  { value: 'contacted', label: '📞 Contacted / In Guidance' },
                  { value: 'visit_scheduled', label: '📍 Visit Scheduled' },
                ]}
              />

              <Select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="flex-1 sm:w-52"
                options={[
                  { value: 'all', label: 'All Channel Sources' },
                  { value: 'amazon', label: 'Amazon' },
                  { value: 'flipkart', label: 'Flipkart' },
                  { value: 'indiamart', label: 'IndiaMART' },
                  { value: 'akuabeat_website', label: 'Akuabeat Website' },
                  { value: 'website', label: 'Website' },
                  { value: 'direct', label: 'Direct Upload' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Leads Table */}
        <div className="card p-0 overflow-hidden shadow-sm">
          <div className="card-header px-4 py-3 bg-slate-50 border-b border-border flex items-center justify-between">
            <p className="card-title flex items-center gap-1.5 font-bold text-navy text-sm">
              <Users size={16} /> WhatsApp Inbound Workbench: Verification Callbacks &amp; Installation Help
            </p>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Filter size={11} /> Showing {filteredCustomers.length} of {customers.length} Inbound Requests
            </span>
          </div>

          {loading ? (
            <PageLoader />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState
              icon={<Users size={36} />}
              title="No WhatsApp Inbound Leads Found"
              description={
                requestTypeFilter === 'verification'
                  ? "No 'Call Representative' order verification callbacks match the current filters. When customers click 'Call Representative' on WhatsApp Message 1, they appear here instantly."
                  : requestTypeFilter === 'installation'
                  ? "No 'Yes, Need Help' post-delivery installation requests match the current filters."
                  : activeTab === 'pending'
                  ? "No pending callback requests at the moment. As customers interact with WhatsApp verification or delivery messages, they will appear here in real time."
                  : "No inbound WhatsApp leads found matching your filter criteria."
              }
              action={
                <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={fetchLeads}>
                  Refresh Workbench
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lead Name &amp; Location</th>
                    <th>Contact Info</th>
                    <th>Order Context &amp; Trigger</th>
                    <th>Callback / Help Status</th>
                    <th>Last Activity / Notes</th>
                    <th style={{ width: 230 }}>Workbench Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((lead) => {
                    const isVerif = isVerificationLead(lead);
                    const isHelpLead = lead.installation_help_requested;
                    const latestOrder = lead.orders && lead.orders.length > 0 ? lead.orders[0] : null;

                    return (
                      <tr
                        key={lead.id}
                        className={
                          isVerif && lead.installation_help_status !== 'resolved'
                            ? 'bg-amber-50/50 hover:bg-amber-100/50 transition-colors border-l-4 border-l-amber-500'
                            : isHelpLead && lead.installation_help_status !== 'resolved'
                            ? 'bg-blue-50/40 hover:bg-blue-50/80 transition-colors border-l-4 border-l-blue-500'
                            : ''
                        }
                      >
                        {/* 1. Lead Name & Location */}
                        <td>
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              isVerif
                                ? 'bg-amber-200 text-amber-950 border border-amber-400'
                                : isHelpLead
                                ? 'bg-blue-200 text-blue-950 border border-blue-400'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {lead.name ? lead.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-navy text-xs">{lead.name}</p>
                              <p className="text-[11px] text-muted flex items-center gap-1">
                                <MapPin size={10} />
                                {[lead.city, lead.state, lead.pincode].filter(Boolean).join(', ') || 'Location N/A'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Contact Details */}
                        <td>
                          <div className="space-y-0.5">
                            <a
                              href={`tel:${lead.phone}`}
                              className="font-mono text-xs text-navy font-semibold hover:text-amber-600 flex items-center gap-1"
                              title="Click to dial"
                            >
                              <Phone size={10} className="text-muted" />
                              {lead.phone || 'No phone'}
                            </a>
                            {lead.whatsapp_number && (
                              <a
                                href={`https://wa.me/${lead.whatsapp_number.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1"
                              >
                                <MessageSquare size={10} /> WhatsApp Active
                              </a>
                            )}
                            {lead.email && <p className="text-[11px] text-muted">{lead.email}</p>}
                          </div>
                        </td>

                        {/* 3. Order Context & Trigger Source */}
                        <td>
                          {isVerif ? (
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <PhoneCall size={11} className="text-amber-700" />
                                <span>⚡ Call Representative (Verification)</span>
                              </div>
                              {latestOrder ? (
                                <div>
                                  <p className="text-xs text-slate-900 font-semibold">
                                    Order{' '}
                                    <a
                                      href={`/orders/${latestOrder.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-navy font-bold hover:underline inline-flex items-center gap-0.5"
                                      title="Open Order in Orders Module"
                                    >
                                      #{latestOrder.order_number}
                                      <ExternalLink size={10} className="text-muted" />
                                    </a>
                                  </p>
                                  {latestOrder.product_name && (
                                    <span className="block text-[11px] font-normal text-muted truncate max-w-[180px]" title={latestOrder.product_name}>
                                      {latestOrder.product_name}
                                    </span>
                                  )}
                                  <span className="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    Pre-Delivery Callback
                                  </span>
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted">Order info linked via phone</p>
                              )}
                              {lead.installation_help_requested_at && (
                                <p className="text-[10px] text-amber-800 flex items-center gap-1 font-mono">
                                  <Clock size={10} /> {fmtDate(lead.installation_help_requested_at)}
                                </p>
                              )}
                            </div>
                          ) : isHelpLead ? (
                            <div className="space-y-1">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                                <Wrench size={11} className="text-blue-700" />
                                <span>🔧 Yes, Need Help (WA)</span>
                              </div>
                              {latestOrder ? (
                                <div>
                                  <p className="text-xs text-slate-800 font-semibold">
                                    Order{' '}
                                    <a
                                      href={`/orders/${latestOrder.id}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-navy font-bold hover:underline inline-flex items-center gap-0.5"
                                      title="Open Order in Orders Module"
                                    >
                                      #{latestOrder.order_number}
                                      <ExternalLink size={10} className="text-muted" />
                                    </a>
                                  </p>
                                  {latestOrder.product_name && (
                                    <span className="block text-[11px] font-normal text-muted truncate max-w-[180px]" title={latestOrder.product_name}>
                                      {latestOrder.product_name}
                                    </span>
                                  )}
                                  <span className="inline-block mt-0.5 text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                    Post-Delivery Installation
                                  </span>
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted">Order info pending</p>
                              )}
                              {lead.installation_help_requested_at && (
                                <p className="text-[10px] text-slate-600 flex items-center gap-1 font-mono">
                                  <Clock size={10} /> {fmtDate(lead.installation_help_requested_at)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Badge
                                label={lead.source || 'Direct Upload'}
                                colorClass="bg-slate-100 text-slate-800 border-slate-200"
                              />
                              {latestOrder && (
                                <p className="text-[11px] text-muted font-mono">
                                  #{latestOrder.order_number}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Help Status / Disposition */}
                        <td>
                          {isHelpLead ? (
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                  lead.installation_help_status === 'pending'
                                    ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                                    : lead.installation_help_status === 'contacted'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : lead.installation_help_status === 'visit_scheduled'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {lead.installation_help_status === 'pending' && '● Pending Call'}
                                {lead.installation_help_status === 'contacted' && '✓ Contacted'}
                                {lead.installation_help_status === 'visit_scheduled' && '📅 Visit Scheduled'}
                                {lead.installation_help_status === 'resolved' && '✅ Resolved'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(lead);
                                  setStatusForm({
                                    status: lead.installation_help_status || 'contacted',
                                    notes: '',
                                  });
                                  setShowStatusModal(true);
                                }}
                                className="text-[10px] text-slate-500 hover:text-navy block underline"
                              >
                                Change Status
                              </button>
                            </div>
                          ) : (
                            <Badge
                              label={lead.status}
                              colorClass={
                                lead.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                              }
                            />
                          )}
                        </td>

                        {/* 5. Last Activity / Notes */}
                        <td className="text-xs text-muted max-w-[200px]">
                          <p className="line-clamp-2 text-[11px] text-slate-700">
                            {lead.notes ? lead.notes.split('\n')[0] : 'No activity logged yet'}
                          </p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {lead.last_contacted_at ? `Contacted: ${fmtDate(lead.last_contacted_at)}` : 'Not called yet'}
                          </p>
                        </td>

                        {/* 6. Workbench Actions */}
                        <td>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Phone size={11} />}
                              onClick={() => {
                                setSelectedCustomer(lead);
                                setCallForm({
                                  status: 'Connected',
                                  installation_status: lead.installation_help_status === 'pending' ? 'contacted' : (lead.installation_help_status || 'contacted'),
                                  remarks: isVerif
                                    ? `Called customer regarding Order #${latestOrder?.order_number || ''} verification. Customer confirmed details.`
                                    : `Called customer regarding installation assistance for ${latestOrder?.product_name || 'Purifier'}.`,
                                });
                                setShowCallModal(true);
                              }}
                              className="text-xs py-1 px-2 font-semibold"
                            >
                              Log Call
                            </Button>

                            {latestOrder && (
                              <a
                                href={`/orders/${latestOrder.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-300 transition-colors"
                                title="Open Order Details in Orders Module"
                              >
                                <ExternalLink size={11} /> Order
                              </a>
                            )}

                            {!isVerif && (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<Send size={11} />}
                                onClick={() => {
                                  setSelectedCustomer(lead);
                                  setVisitForm({
                                    visit_type: 'store_visit',
                                    centre_name: 'Thane Centre',
                                    technician_name: 'Rahul Sharma (Field Tech)',
                                    visit_date: new Date().toISOString().split('T')[0],
                                    visit_time: '11:00 AM',
                                    notes: `Installation visit dispatch for ${lead.name} (Order #${latestOrder?.order_number || 'N/A'})`,
                                  });
                                  setShowVisitModal(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 px-2"
                              >
                                Dispatch Visit
                              </Button>
                            )}
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
      </main>

      {/* Modal 1: Channel Selection Bulk Upload */}
      {showChannelModal && (
        <ChannelSelectionModal
          open={showChannelModal}
          onClose={() => setShowChannelModal(false)}
          file={null}
          onConfirm={(marketplace, channel) => {
            toast.success(`File uploaded and tagged with channel '${channel}' (${marketplace})!`);
            setShowChannelModal(false);
            fetchLeads();
          }}
        />
      )}

      {/* Modal 2: Dispatch Visit / Technician */}
      <Modal
        open={showVisitModal && !!selectedCustomer}
        onClose={() => setShowVisitModal(false)}
        title={selectedCustomer ? `Schedule & Dispatch Visit / Technician — ${selectedCustomer.name}` : 'Dispatch Visit'}
        width="max-w-md"
      >
        {selectedCustomer && (
          <form onSubmit={handleDispatchVisit} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
              <p className="font-bold text-navy">{selectedCustomer.name} ({selectedCustomer.phone})</p>
              {selectedCustomer.installation_help_requested && (
                <p className="text-amber-800 font-semibold text-[11px] flex items-center gap-1">
                  <Wrench size={12} /> WhatsApp Installation Help Request Active
                </p>
              )}
              <p className="text-[11px] text-muted">
                Address: {[selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode].filter(Boolean).join(', ') || 'N/A'}
              </p>
            </div>

            <Select
              label="Dispatch Type *"
              value={visitForm.visit_type}
              onChange={(e) => setVisitForm({ ...visitForm, visit_type: e.target.value })}
              options={[
                { value: 'store_visit', label: 'Store / Experience Centre Visit' },
                { value: 'technician_home_dispatch', label: 'Field Technician Home Visit (Installation)' },
              ]}
            />

            {visitForm.visit_type === 'store_visit' ? (
              <Select
                label="Target Centre / Store Location *"
                value={visitForm.centre_name}
                onChange={(e) => setVisitForm({ ...visitForm, centre_name: e.target.value })}
                options={[
                  { value: 'Thane Centre', label: 'Thane Centre' },
                  { value: 'Dadar Centre', label: 'Dadar Centre' },
                  { value: 'Mira Road Centre', label: 'Mira Road Centre' },
                  { value: 'Kalyan Centre', label: 'Kalyan Centre' },
                  { value: 'Vashi Store', label: 'Vashi Store' },
                ]}
              />
            ) : (
              <Select
                label="Assign Field Technician *"
                value={visitForm.technician_name}
                onChange={(e) => setVisitForm({ ...visitForm, technician_name: e.target.value })}
                options={[
                  { value: 'Rahul Sharma (Field Tech - Thane)', label: 'Rahul Sharma (Thane & Central)' },
                  { value: 'Amit Verma (Field Tech - Western)', label: 'Amit Verma (Western Line)' },
                  { value: 'Suresh Patil (Field Tech - Navi Mumbai)', label: 'Suresh Patil (Navi Mumbai)' },
                  { value: 'Vikas Jadhav (Senior Service Tech)', label: 'Vikas Jadhav (Senior Tech)' },
                ]}
              />
            )}

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Visit Date *"
                type="date"
                value={visitForm.visit_date}
                onChange={(e) => setVisitForm({ ...visitForm, visit_date: e.target.value })}
                required
              />
              <Input
                label="Visit Time *"
                value={visitForm.visit_time}
                onChange={(e) => setVisitForm({ ...visitForm, visit_time: e.target.value })}
                placeholder="e.g. 11:00 AM"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Instructions & Purpose Notes</label>
              <textarea
                value={visitForm.notes}
                onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs border-border"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowVisitModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Confirm & Dispatch WhatsApp
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 3: Log Call */}
      <Modal
        open={showCallModal && !!selectedCustomer}
        onClose={() => setShowCallModal(false)}
        title={
          selectedCustomer
            ? `Log Call — ${selectedCustomer.name} ${isVerificationLead(selectedCustomer) ? '(⚡ Verification Callback)' : '(🔧 Installation Support)'}`
            : 'Log Call'
        }
        width="max-w-md"
      >
        {selectedCustomer && (
          <form onSubmit={handleLogCall} className="space-y-4 text-xs">
            <div className="p-2.5 bg-slate-50 border rounded-lg flex items-center justify-between">
              <div>
                <p className="font-bold text-navy">{selectedCustomer.name}</p>
                <p className="text-[11px] text-muted font-mono">{selectedCustomer.phone}</p>
              </div>
              {isVerificationLead(selectedCustomer) ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  ⚡ Verification Callback
                </span>
              ) : selectedCustomer.installation_help_requested ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  🔧 Installation Help
                </span>
              ) : null}
            </div>

            <Select
              label="Call Disposition / Status *"
              value={callForm.status}
              onChange={(e) => setCallForm({ ...callForm, status: e.target.value })}
              options={[
                { value: 'Connected', label: 'Connected - Customer Answered' },
                { value: 'Call Back', label: 'Call Back Scheduled' },
                { value: 'Busy', label: 'Busy / No Answer / Ringing' },
                { value: 'Visit Scheduled', label: 'Visit / Technician Scheduled' },
                { value: 'Resolved / Installed', label: isVerificationLead(selectedCustomer) ? 'Resolved (Order Verified & Cleared)' : 'Resolved (Installation Completed)' },
                { value: 'Not Interested', label: 'Not Interested / Order Cancelled' },
              ]}
            />

            {selectedCustomer.installation_help_requested && (
              <Select
                label={isVerificationLead(selectedCustomer) ? "Update Lead Disposition *" : "Update Installation Help Disposition *"}
                value={callForm.installation_status}
                onChange={(e) => setCallForm({ ...callForm, installation_status: e.target.value })}
                options={[
                  { value: 'pending', label: 'Keep as Pending Call' },
                  { value: 'contacted', label: 'Mark as Contacted / In Progress' },
                  { value: 'visit_scheduled', label: isVerificationLead(selectedCustomer) ? 'Escalate / Schedule Visit' : 'Mark as Visit / Technician Scheduled' },
                  { value: 'resolved', label: isVerificationLead(selectedCustomer) ? 'Mark as Resolved / Order Verified' : 'Mark as Resolved / Installation Complete' },
                ]}
              />
            )}

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Call Remarks & Discussion Notes *</label>
              <textarea
                value={callForm.remarks}
                onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs border-border"
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCallModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Save Call Log
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal 4: Quick Status Update */}
      <Modal
        open={showStatusModal && !!selectedCustomer}
        onClose={() => setShowStatusModal(false)}
        title={
          selectedCustomer
            ? `${isVerificationLead(selectedCustomer) ? '⚡ Update Verification Callback' : 'Update Installation Help'} — ${selectedCustomer.name}`
            : 'Update Status'
        }
        width="max-w-sm"
      >
        {selectedCustomer && (
          <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
            <Select
              label={isVerificationLead(selectedCustomer) ? "Callback Status *" : "Installation Help Status *"}
              value={statusForm.status}
              onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
              options={[
                { value: 'pending', label: '● Pending Call (Urgent)' },
                { value: 'contacted', label: '✓ Contacted / In Guidance' },
                { value: 'visit_scheduled', label: isVerificationLead(selectedCustomer) ? '📅 Escalate / Technician Visit' : '📅 Visit / Technician Scheduled' },
                { value: 'resolved', label: isVerificationLead(selectedCustomer) ? '✅ Resolved (Order Verified)' : '✅ Resolved (Installation Complete)' },
              ]}
            />

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">Status Remarks (Optional)</label>
              <textarea
                value={statusForm.notes}
                onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-xs border-border"
                rows={2}
                placeholder={isVerificationLead(selectedCustomer) ? "e.g. Customer verified address and requested delivery on Monday." : "e.g. Customer will self-install after video guidance."}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowStatusModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Update Status
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </AppShell>
  );
}
