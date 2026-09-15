'use strict';
'use client';

import React, { useState, useRef } from 'react';
import { Modal, Button } from '@/components/ui';
import { Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Cpu, Usb } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface UploadUSBLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function UploadUSBLogsModal({ isOpen, onClose, onSuccess }: UploadUSBLogsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    duplicates: number;
    unmapped: number;
    total: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file && !manualText.trim()) {
      return toast.error('Please select a BioMax USB log file or paste punch logs.');
    }

    setLoading(true);
    setResult(null);

    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await api.post('/biometric/upload-logs', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/biometric/upload-logs', {
          file_content: manualText.trim(),
        });
      }

      const data = res.data?.data || {};
      setResult({
        inserted: data.inserted ?? 0,
        duplicates: data.duplicates ?? 0,
        unmapped: data.unmapped ?? 0,
        total: data.total ?? (data.inserted + data.duplicates),
      });

      toast.success(res.data?.message || 'USB logs imported and attendance synchronized!');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process USB log file.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setManualText('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upload Offline USB BioMax Logs">
      <div className="space-y-4 p-1">
        {/* Info Banner */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 mt-0.5">
            <Usb className="w-5 h-5" />
          </div>
          <div className="text-xs text-indigo-950 space-y-1">
            <p className="font-bold">Sync Without Wire via USB Pen Drive</p>
            <p className="text-indigo-800/80 leading-relaxed">
              If your BioMax hardware terminal is operated offline or without a network wire, export the logs to a USB pen drive via <span className="font-semibold">MENU → PenDrive → Download AttLog</span>, then upload the generated <code className="bg-white/80 px-1 py-0.5 rounded border border-indigo-200 text-indigo-900 font-mono text-[11px]">attlog.dat</code>, <code className="bg-white/80 px-1 py-0.5 rounded border border-indigo-200 text-indigo-900 font-mono text-[11px]">.csv</code>, or <code className="bg-white/80 px-1 py-0.5 rounded border border-indigo-200 text-indigo-900 font-mono text-[11px]">.txt</code> file here.
            </p>
          </div>
        </div>

        {/* File Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            file
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-border hover:border-indigo-400 bg-surface/40 hover:bg-indigo-50/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".dat,.csv,.txt,.tsv,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          {file ? (
            <div className="space-y-1.5">
              <FileText className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="font-bold text-xs text-navy">{file.name}</p>
              <p className="text-[11px] text-muted">
                {(file.size / 1024).toFixed(1)} KB • Click to choose a different file
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Upload className="w-8 h-8 text-muted mx-auto" />
              <p className="font-bold text-xs text-navy">Click or drag & drop USB log file</p>
              <p className="text-[11px] text-muted">Supports BioMax attlog.dat, attendance.csv, or .txt</p>
            </div>
          )}
        </div>

        {/* Or Paste Raw Text */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-navy block">
            Or Paste Raw BioMax Log Text:
          </label>
          <textarea
            rows={3}
            value={manualText}
            onChange={(e) => {
              setManualText(e.target.value);
              setResult(null);
            }}
            placeholder="1&#9;2026-08-29 09:30:15&#9;1&#9;1&#9;0&#10;2&#9;2026-08-29 09:32:00&#9;1&#9;1&#9;0"
            className="w-full p-2.5 text-xs font-mono border border-border rounded-lg bg-surface/50 focus:bg-white focus:ring-2 focus:ring-navy focus:outline-none"
          />
        </div>

        {/* Ingestion Results Feedback */}
        {result && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <CheckCircle2 size={16} /> Attendance Punches Ingested Successfully
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-muted block">New Punches</span>
                <span className="font-bold text-emerald-700 text-sm">{result.inserted}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-muted block">Duplicates Skipped</span>
                <span className="font-bold text-slate-700 text-sm">{result.duplicates}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-muted block">Unmapped</span>
                <span className="font-bold text-amber-700 text-sm">{result.unmapped}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button variant="secondary" size="sm" onClick={handleReset} className="text-xs">
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpload}
              disabled={loading || (!file && !manualText.trim())}
              className="bg-navy text-white text-xs font-bold"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> Processing...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Import & Calculate Attendance
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
