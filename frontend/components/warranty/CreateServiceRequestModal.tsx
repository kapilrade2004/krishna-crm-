'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Select } from '@/components/ui';
import {
  Wrench,
  Shield,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  X,
  Flame,
  AlertTriangle,
  Clock,
  Layers
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface TechnicianUser {
  id: string;
  name: string;
  phone?: string;
  role: string;
}

interface CreateServiceRequestModalProps {
  isOpen?: boolean;
  open?: boolean;
  warrantyId?: string;
  warranty?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const PRIORITY_OPTIONS = [
  {
    value: 'LOW',
    label: 'Low',
    desc: 'Routine maintenance & minor query',
    badgeClass: 'border-slate-200 text-slate-700 hover:border-slate-400',
    activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
    icon: Clock,
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    desc: 'Standard repair / filter replacement',
    badgeClass: 'border-amber-200 text-amber-800 hover:border-amber-400',
    activeClass: 'bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-sm',
    icon: Wrench,
  },
  {
    value: 'HIGH',
    label: 'High',
    desc: 'Leakage / device malfunctioning',
    badgeClass: 'border-orange-200 text-orange-800 hover:border-orange-400',
    activeClass: 'bg-orange-600 text-white border-orange-600 shadow-sm',
    icon: AlertTriangle,
  },
  {
    value: 'CRITICAL',
    label: 'Critical',
    desc: 'Electrical fault / immediate visit',
    badgeClass: 'border-rose-200 text-rose-800 hover:border-rose-400',
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm',
    icon: Flame,
  },
] as const;

export default function CreateServiceRequestModal({
  isOpen,
  open,
  warrantyId,
  warranty,
  onClose,
  onSuccess,
}: CreateServiceRequestModalProps) {
  const targetWarrantyId = warrantyId || warranty?.id;
  const isVisible = isOpen !== undefined ? isOpen : (open !== undefined ? open : true);

  const [issue, setIssue] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [technicianId, setTechnicianId] = useState('');
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setLoadingTechnicians(true);
      api.get('/user-access/users')
        .then((res) => {
          const usersList = res.data?.data || res.data?.users || [];
          if (Array.isArray(usersList)) {
            setTechnicians(usersList);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingTechnicians(false));
    }
  }, [isVisible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue.trim()) {
      toast.error('Please specify the issue title.');
      return;
    }

    if (!targetWarrantyId) {
      toast.error('No warranty record associated with this ticket.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/warranty/${targetWarrantyId}/service-requests`, {
        issue: issue.trim(),
        description: description.trim(),
        priority,
        technician_id: technicianId || null,
      });

      toast.success('Service Request ticket created successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create service request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isVisible) return null;

  const customerName = warranty?.customer?.name || warranty?.customer_name_snapshot;
  const customerPhone = warranty?.customer?.phone || warranty?.customer_phone_snapshot;
  const productName = warranty?.product_name_snapshot || warranty?.product_name;
  const warrantyNumber = warranty?.warranty_number;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl shadow-slate-900/25 w-full max-w-xl overflow-hidden border border-slate-100 animate-in zoom-in-95 fade-in-0 duration-200 ease-out z-10 max-h-[92vh] flex flex-col">
        {/* Header Ribbon */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-navy to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Wrench size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Create Service Ticket</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-amber-400 text-slate-950">
                  Technician Dispatch
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Log a customer complaint, assign technician & trigger resolution workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto flex-1 text-xs">
          {/* Context Snippet (If warranty info available) */}
          {(warrantyNumber || customerName) && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Shield size={16} />
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{warrantyNumber || 'Warranty Record'}</span>
                    {productName && (
                      <span className="text-[11px] font-normal text-slate-500">
                        • {productName}
                      </span>
                    )}
                  </div>
                  {customerName && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                      <span className="font-medium">{customerName}</span>
                      {customerPhone && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{customerPhone}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Issue Title */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              Service Issue Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="e.g., Water Leakage from Membrane, RO Filter Beeping, Low Water Flow"
              className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-xs"
            />
          </div>

          {/* Priority Level Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5 flex items-center justify-between">
              <span>Ticket Priority</span>
              <span className="text-[11px] font-normal text-slate-500">Determines SLA & Dispatch Urgency</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? opt.activeClass
                        : `bg-white ${opt.badgeClass} hover:bg-slate-50`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs flex items-center gap-1">
                        <Icon size={13} />
                        {opt.label}
                      </span>
                      {isSelected && <CheckCircle2 size={13} />}
                    </div>
                    <span className={`text-[10px] leading-tight line-clamp-1 ${isSelected ? 'opacity-90' : 'text-slate-500'}`}>
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assign Technician */}
          <div>
            <Select
              label="Assign Technician (Optional)"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              placeholder="-- Unassigned (Dispatch Queue) --"
              options={[
                { value: '', label: '-- Unassigned (Dispatch Queue) --' },
                ...technicians.map((t) => ({
                  value: t.id,
                  label: `${t.name} ${t.phone ? `(${t.phone})` : ''} — ${t.role}`,
                })),
              ]}
              hint="Can be dispatched later"
            />
          </div>

          {/* Detailed Problem Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-900">
                Detailed Symptoms & Customer Notes
              </label>
              <span className="text-[10px] text-slate-400">{description.length} / 500</span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe exact customer symptoms, visit time preference, or previous service observations..."
              className="w-full p-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-xs resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 rounded-xl shadow-md hover:shadow-amber-500/25 transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Creating Ticket...</span>
                </>
              ) : (
                <>
                  <Wrench size={14} />
                  <span>Create Service Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
