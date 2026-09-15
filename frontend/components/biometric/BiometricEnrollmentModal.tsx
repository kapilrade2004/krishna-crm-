'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge } from '@/components/ui';
import { Fingerprint, Upload, CheckCircle2, AlertCircle, RefreshCw, Smartphone, ShieldCheck, Zap } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { Employee, BiometricDevice } from '@/types';

interface BiometricEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onEnrollmentSuccess?: () => void;
}

export default function BiometricEnrollmentModal({
  isOpen,
  onClose,
  employee,
  onEnrollmentSuccess,
}: BiometricEnrollmentModalProps) {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [prompting, setPrompting] = useState(false);

  useEffect(() => {
    if (isOpen && employee) {
      api.get('/biometric/devices').then((res) => {
        const list = res.data?.data?.devices || [];
        setDevices(list);
        if (list.length > 0) setSelectedDeviceId(list[0].id);
      });
    }
  }, [isOpen, employee]);

  if (!employee) return null;

  const handleUpload = async () => {
    setUploading(true);
    try {
      await api.post(`/biometric/employees/${employee.id}/upload`, {
        device_id: selectedDeviceId,
      });
      toast.success(`Employee ${employee.first_name} ${employee.last_name} uploaded to BioMax device!`);
      if (onEnrollmentSuccess) onEnrollmentSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload user to biometric device.');
    } finally {
      setUploading(false);
    }
  };

  const handleTriggerOnlineEnrollment = async () => {
    setPrompting(true);
    try {
      await api.post(`/biometric/employees/${employee.id}/trigger-enrollment`);
      toast.success('Enrollment prompt triggered! Please place finger on the BioMax machine.');
      if (onEnrollmentSuccess) onEnrollmentSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to trigger online enrollment.');
    } finally {
      setPrompting(false);
    }
  };

  const empCode = employee.employee_code || `EMP-${employee.id.slice(0, 5)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Biometric Enrollment & Hardware Sync" size="md">
      <div className="space-y-4 text-xs">
        {/* Employee Banner */}
        <div className="bg-gradient-to-r from-navy to-indigo-950 p-4 rounded-xl text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 text-amber flex items-center justify-center font-bold text-sm border border-white/20">
              <Fingerprint size={22} />
            </div>
            <div>
              <p className="font-bold text-sm text-white">{employee.first_name} {employee.last_name}</p>
              <p className="text-[11px] text-slate-300 font-mono">Code: {empCode} • {employee.department || 'General'}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber/20 text-amber border border-amber/30">
            Biometric Sync
          </span>
        </div>

        {/* Step 1: Device Allocation */}
        <div className="p-3 bg-surface/50 rounded-xl border border-border space-y-2">
          <label className="font-bold text-navy flex items-center gap-1.5">
            <Smartphone size={13} className="text-indigo-600" /> Target Biometric Device
          </label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="form-select w-full text-xs"
          >
            {devices.length === 0 ? (
              <option value="">No devices registered (Default BioMax Terminal)</option>
            ) : (
              devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.device_name} ({d.serial_number}) — {d.location}
                </option>
              ))
            )}
          </select>
          <p className="text-[11px] text-muted">
            The employee code <strong>{empCode}</strong> will be synchronized to this biometric device.
          </p>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="border border-border p-3.5 rounded-xl bg-white space-y-2">
            <p className="font-bold text-navy flex items-center gap-1.5">
              <Upload size={14} className="text-blue-600" /> Step 1: Upload to Machine
            </p>
            <p className="text-[11px] text-muted">
              Sends employee code & name to SmartOffice and provisions user profile on the BioMax machine.
            </p>
            <Button
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={handleUpload}
              className="w-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
            >
              Upload User to Device
            </Button>
          </div>

          <div className="border border-border p-3.5 rounded-xl bg-white space-y-2">
            <p className="font-bold text-navy flex items-center gap-1.5">
              <Zap size={14} className="text-amber-600" /> Step 2: Trigger Enrollment
            </p>
            <p className="text-[11px] text-muted">
              Prompts the BioMax terminal screen to capture and verify fingerprint on the scanner.
            </p>
            <Button
              variant="primary"
              size="sm"
              loading={prompting}
              onClick={handleTriggerOnlineEnrollment}
              className="w-full text-xs font-semibold bg-amber hover:bg-amber-600 text-slate-900"
            >
              Trigger Online Scanner
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-border">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
