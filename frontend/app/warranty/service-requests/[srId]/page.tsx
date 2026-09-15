'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import { Button, Badge, PageLoader } from '@/components/ui';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import {
  Wrench, User, MapPin, Phone, ShieldCheck, CheckCircle2, Play, ArrowLeft, Clock,
  FileText, Copy, Navigation, CheckSquare, Layers, AlertTriangle, ArrowUpRight,
  Shield, Check, Flame, X
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface ServiceRequestDetail {
  id: string;
  service_request_number: string;
  issue: string;
  description: string;
  priority: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  resolution?: string;
  parts_used?: string;
  created_at: string;
  warranty?: {
    id: string;
    warranty_number: string;
    product_name_snapshot: string;
    model_snapshot: string;
    brand_snapshot: string;
    status: string;
    serial_number?: string;
    warranty_end_date: string;
  };
  customer?: {
    id: string;
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode?: string;
  };
  technician?: {
    name: string;
    phone: string;
  };
}

const STEPS = ['OPEN', 'IN_PROGRESS', 'COMPLETED'] as const;

export default function TechnicianServiceJobPage() {
  const params = useParams();
  const router = useRouter();
  const srId = params?.srId as string;

  const [sr, setSr] = useState<ServiceRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchServiceRequest = useCallback(async () => {
    if (!srId) return;
    setLoading(true);
    try {
      const res = await api.get(`/warranty/service-requests/${srId}`);
      const req = res.data?.data?.serviceRequest || res.data?.serviceRequest;
      if (req) {
        setSr(req);
        if (req.resolution) setResolution(req.resolution);
        if (req.parts_used) setPartsUsed(req.parts_used);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load service request detail.');
    } finally {
      setLoading(false);
    }
  }, [srId]);

  useEffect(() => {
    fetchServiceRequest();
  }, [fetchServiceRequest]);

  const handleStartJob = async () => {
    setUpdating(true);
    try {
      await api.patch(`/warranty/service-requests/${srId}/status`, {
        status: 'IN_PROGRESS',
      });
      toast.success('Service job started! Status updated to In Progress.');
      fetchServiceRequest();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update job status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolution.trim()) {
      toast.error('Please enter resolution summary.');
      return;
    }

    setUpdating(true);
    try {
      await api.patch(`/warranty/service-requests/${srId}/status`, {
        status: 'COMPLETED',
        resolution: resolution.trim(),
        parts_used: partsUsed.trim(),
      });

      toast.success('Service job completed & logged to Audit Trail!');
      setIsCompleteModalOpen(false);
      fetchServiceRequest();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to complete job.');
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loading) {
    return (
      <AppShell>
        <Topbar title="Technician Service Job" />
        <PageLoader />
      </AppShell>
    );
  }

  if (!sr) {
    return (
      <AppShell>
        <Topbar title="Job Not Found" />
        <div className="p-12 text-center text-slate-400">
          <Wrench size={36} className="mx-auto mb-3 text-slate-400" />
          <p className="text-sm font-bold text-slate-800">Service ticket not found.</p>
          <Link href="/warranty" className="mt-3 inline-block text-xs text-amber-600 hover:underline">
            &larr; Return to Warranty Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const currentStepIndex = sr.status === 'COMPLETED' ? 2 : sr.status === 'IN_PROGRESS' ? 1 : 0;
  const fullAddress = [sr.customer?.address, sr.customer?.city, sr.customer?.state, sr.customer?.pincode].filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress || sr.customer?.city || '')}`;

  return (
    <AppShell>
      <Topbar
        title={`Service Ticket ${sr.service_request_number}`}
        subtitle="Technician service dispatch console, customer location, and job completion workflow"
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

          {sr.warranty?.id && (
            <Link
              href={`/warranty/${sr.warranty.id}`}
              className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              <span>View Warranty {sr.warranty.warranty_number}</span>
              <ArrowUpRight size={13} />
            </Link>
          )}
        </div>

        {/* Hero Dispatch Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-navy to-slate-950 p-6 md:p-8 text-white shadow-xl border border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  {sr.service_request_number}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                    sr.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : sr.status === 'IN_PROGRESS'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  {sr.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-300 border border-white/20">
                  {sr.priority} Urgency
                </span>
              </div>

              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                  {sr.issue}
                </h2>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                  <span>Assigned Tech: <strong className="text-amber-400">{sr.technician?.name || 'Unassigned Queue'}</strong></span>
                  {sr.technician?.phone && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-slate-400">{sr.technician.phone}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>Created: {fmtDateTime(sr.created_at)}</span>
                </p>
              </div>
            </div>

            {/* Technician Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
              {sr.status !== 'IN_PROGRESS' && sr.status !== 'COMPLETED' && (
                <button
                  onClick={handleStartJob}
                  disabled={updating}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all"
                >
                  <Play size={16} />
                  <span>Start Field Job</span>
                </button>
              )}

              {sr.status !== 'COMPLETED' && (
                <button
                  onClick={() => setIsCompleteModalOpen(true)}
                  disabled={updating}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
                >
                  <CheckCircle2 size={16} />
                  <span>Record Completion</span>
                </button>
              )}
            </div>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="pt-6 mt-6 border-t border-slate-800/80">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {STEPS.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;
                return (
                  <div key={step} className="flex flex-col items-center text-center space-y-1.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isPassed
                          ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                    >
                      {isPassed ? <Check size={14} /> : idx + 1}
                    </div>
                    <span className={`text-[11px] font-bold ${isCurrent ? 'text-amber-400' : isPassed ? 'text-slate-200' : 'text-slate-500'}`}>
                      {step.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2-Column Core Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Location & Contact Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <User size={15} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Customer Location &amp; Contact</h3>
                </div>
                {sr.customer?.id && (
                  <Link href={`/customers/${sr.customer.id}`} className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-0.5">
                    Customer Profile <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>

              {sr.customer ? (
                <div className="space-y-2.5 pt-2 text-xs text-slate-800">
                  <p className="text-base font-bold text-slate-900">{sr.customer.name}</p>

                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone size={14} className="text-slate-400" />
                    <span className="font-mono font-bold text-slate-900">{sr.customer.phone}</span>
                  </div>

                  <div className="flex items-start gap-2 text-slate-600 leading-relaxed pt-1">
                    <MapPin size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>{fullAddress || 'No full address registered.'}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 pt-2">No customer details available.</p>
              )}
            </div>

            {/* Quick Action Navigation */}
            {sr.customer && (
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <a
                  href={`tel:${sr.customer.phone}`}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-center text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Phone size={13} />
                  <span>Call Customer</span>
                </a>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-center text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Navigation size={13} />
                  <span>Open Maps</span>
                </a>
              </div>
            )}
          </div>

          {/* Warranty & Product Snapshot Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
                    <ShieldCheck size={15} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Product &amp; Warranty Coverage</h3>
                </div>
                {sr.warranty?.id && (
                  <Link href={`/warranty/${sr.warranty.id}`} className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-0.5">
                    Warranty Record <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>

              {sr.warranty ? (
                <div className="space-y-2.5 pt-2 text-xs text-slate-800">
                  <p className="text-base font-bold text-slate-900">{sr.warranty.product_name_snapshot}</p>
                  <p className="text-slate-500">
                    Model: <strong className="text-slate-800">{sr.warranty.model_snapshot || 'Standard'}</strong> ({sr.warranty.brand_snapshot || 'AkuaBeat'})
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="font-mono font-bold text-indigo-600">{sr.warranty.warranty_number}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● {sr.warranty.status} (Valid till {fmtDate(sr.warranty.warranty_end_date)})
                    </span>
                  </div>

                  {sr.warranty.serial_number && (
                    <p className="text-[11px] text-slate-500 font-mono">
                      Unit Serial No: <strong className="text-slate-900">{sr.warranty.serial_number}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 pt-2">No warranty record linked.</p>
              )}
            </div>
          </div>
        </div>

        {/* Symptoms & Customer Notes Box */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
            Customer Complaint &amp; Problem Symptoms
          </h3>
          <p className="text-xs text-slate-800 bg-slate-50 p-4 rounded-xl leading-relaxed border border-slate-200/60">
            {sr.description || 'No detailed instructions provided.'}
          </p>

          {sr.status === 'COMPLETED' && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 text-xs bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
              <h4 className="font-extrabold text-emerald-800 flex items-center gap-1.5 text-sm">
                <CheckCircle2 size={18} className="text-emerald-600" /> Technician Resolution Record
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-500">Completed At:</span>
                  <p className="font-bold text-slate-900">{fmtDateTime(sr.completed_at || '')}</p>
                </div>
                <div>
                  <span className="text-slate-500">Parts / Spares Replaced:</span>
                  <p className="font-bold text-slate-900">{sr.parts_used || 'None (Serviced / Calibrated)'}</p>
                </div>
              </div>
              <div>
                <span className="text-slate-500">Resolution Summary:</span>
                <p className="font-semibold text-slate-900 mt-0.5">{sr.resolution}</p>
              </div>
            </div>
          )}
        </div>

        {/* Job Completion Modal */}
        {isCompleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsCompleteModalOpen(false)}
            />

            <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-900/25 w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 fade-in-0 duration-200 ease-out z-10 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Record Job Completion</h3>
                </div>
                <button
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCompleteJobSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Resolution Summary <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Describe how the problem was resolved (e.g., replaced 10-inch sediment filter and adjusted membrane pressure)..."
                    className="w-full p-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1.5">
                    Parts / Spares Replaced (Optional)
                  </label>
                  <input
                    type="text"
                    value={partsUsed}
                    onChange={(e) => setPartsUsed(e.target.value)}
                    placeholder="e.g. RO Membrane 80 GPD, Flow Restrictor"
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                  <Button type="button" variant="secondary" onClick={() => setIsCompleteModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={updating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {updating ? 'Submitting...' : 'Submit Completion'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
