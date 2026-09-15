'use client';
import { useState, useEffect } from 'react';
import { Modal, Button } from '@/components/ui';
import { CustomSelectOption } from '@/components/ui/CustomSelect';
import { FileSpreadsheet, CheckCircle2, Layers, ShoppingCart, Store, Globe, Package, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChannelSelectionModalProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  onConfirm: (marketplace: string, channel: string) => void;
  onClear?: () => void;
  loading?: boolean;
}

export const CHANNEL_OPTIONS: (CustomSelectOption & { marketplace: string })[] = [
  {
    value: 'amazon_channel_1',
    label: 'Amazon Channel 1',
    marketplace: 'amazon',
    description: 'Primary Seller Central Account',
    icon: <ShoppingCart size={16} />,
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'amazon_channel_2',
    label: 'Amazon Channel 2',
    marketplace: 'amazon',
    description: 'Secondary Seller Central Account',
    icon: <ShoppingCart size={16} />,
    badgeColor: 'bg-amber-50 text-amber-600 border border-amber-200/60',
  },
  {
    value: 'amazon_channel_3',
    label: 'Amazon Channel 3',
    marketplace: 'amazon',
    description: 'Tertiary Seller Central Account',
    icon: <ShoppingCart size={16} />,
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  {
    value: 'flipkart',
    label: 'Flipkart Channel',
    marketplace: 'flipkart',
    description: 'Flipkart Seller Hub Account',
    icon: <Store size={16} />,
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'indiamart',
    label: 'IndiaMart Channel',
    marketplace: 'indiamart',
    description: 'IndiaMart B2B Lead Portal',
    icon: <Globe size={16} />,
    badgeColor: 'bg-teal-100 text-teal-700',
  },
  {
    value: 'akuabeat_website',
    label: 'Akuabeat Website',
    marketplace: 'akuabeat_website',
    description: 'Official Akuabeat Store (akuabeat.com)',
    icon: <Globe size={16} />,
    badgeColor: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  },
  {
    value: 'direct',
    label: 'Direct / Manual Upload',
    marketplace: 'direct',
    description: 'Offline Sales & Manual Orders',
    icon: <Package size={16} />,
    badgeColor: 'bg-slate-100 text-slate-700',
  },
];

export default function ChannelSelectionModal({
  open,
  onClose,
  file,
  onConfirm,
  onClear,
  loading = false,
}: ChannelSelectionModalProps) {
  const [selectedChannel, setSelectedChannel] = useState('amazon_channel_1');

  useEffect(() => {
    if (open) {
      setSelectedChannel('amazon_channel_1');
    }
  }, [open]);

  if (!file) return null;

  const fileSizeFormatted = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : `${(file.size / 1024).toFixed(1)} KB`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedOption = CHANNEL_OPTIONS.find((c) => c.value === selectedChannel);
    const marketplace = matchedOption ? matchedOption.marketplace : 'amazon';
    onConfirm(marketplace, selectedChannel);
  };

  return (
    <Modal open={open} onClose={onClose} title="Select Data Import Channel" width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selected File Header Card */}
        <div className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border/80 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-amber/10 text-amber-700 flex items-center justify-center shrink-0 shadow-xs">
            <FileSpreadsheet size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-navy truncate">{file.name}</p>
            <p className="text-[11px] text-muted mt-0.5">
              Size: {fileSizeFormatted} · Type: {file.name.split('.').pop()?.toUpperCase()}
            </p>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition-all cursor-pointer shrink-0 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear selected file"
            >
              <Trash2 size={13} />
              <span>Clear File</span>
            </button>
          )}
        </div>

        {/* Channel Selection Question */}
        <div className="space-y-1.5 pt-0.5">
          <label className="form-label text-xs font-semibold text-navy flex items-center gap-1.5">
            <Layers size={14} className="text-amber-600" />
            From Which Channel the Data IS From?
          </label>
          <p className="text-[11px] text-muted leading-relaxed">
            Please select the specific seller channel account to correctly tag sales reports and order tracking.
          </p>
        </div>

        {/* Interactive Channel Selection Grid (Fits 100% inside modal, zero scroll overflow) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto p-0.5">
          {CHANNEL_OPTIONS.map((opt) => {
            const isSelected = opt.value === selectedChannel;
            return (
              <div
                key={opt.value}
                onClick={() => setSelectedChannel(opt.value)}
                className={cn(
                  'relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none',
                  isSelected
                    ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 shadow-sm'
                    : 'border-border bg-white hover:border-amber-300 hover:bg-slate-50/60'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'bg-amber-500 text-white shadow-sm' : opt.badgeColor
                  )}
                >
                  {opt.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold truncate', isSelected ? 'text-amber-950' : 'text-navy')}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-muted truncate mt-0.5">{opt.description}</p>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in-50 duration-150">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/80">
          <div>
            {onClear && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClear}
                disabled={loading}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200"
                icon={<Trash2 size={13} />}
              >
                Clear File
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={<CheckCircle2 size={14} />}
            >
              Confirm & Upload Data
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
