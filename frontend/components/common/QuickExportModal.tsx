'use client';
import React, { useState } from 'react';
import { Modal, Button } from '@/components/ui';
import { Download } from 'lucide-react';
import ExportFormatSelector, { ExportFormat } from './ExportFormatSelector';

interface QuickExportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  onConfirm: (format: ExportFormat) => Promise<void> | void;
  loading?: boolean;
  defaultFormat?: ExportFormat;
}

export default function QuickExportModal({
  open,
  onClose,
  title,
  subtitle = 'Please choose your preferred file format for export.',
  onConfirm,
  loading = false,
  defaultFormat = 'xlsx',
}: QuickExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultFormat);

  if (!open) return null;

  const handleExport = async () => {
    await onConfirm(selectedFormat);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4 pt-1">
        <p className="text-xs text-muted leading-relaxed">{subtitle}</p>

        <ExportFormatSelector
          value={selectedFormat}
          onChange={setSelectedFormat}
          label="Select Export Format:"
        />

        <div className="flex items-center justify-between pt-3 border-t border-border mt-4">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={handleExport}
            icon={<Download size={14} />}
            className="shadow-xs"
          >
            Export {selectedFormat.toUpperCase()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
