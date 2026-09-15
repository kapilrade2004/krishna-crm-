'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Badge } from '@/components/ui';
import { Cpu, Plus, Trash2, CheckCircle2, AlertTriangle, RefreshCw, Server, Wifi, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import type { BiometricDevice } from '@/types';

interface DeviceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshDevices?: () => void;
}

export default function DeviceManagementModal({ isOpen, onClose, onRefreshDevices }: DeviceManagementModalProps) {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // New device form
  const [form, setForm] = useState({
    device_name: '',
    serial_number: '',
    location: 'Main Office',
    ip_address: '',
    port: 4370,
  });
  const [saving, setSaving] = useState(false);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/biometric/devices');
      setDevices(res.data?.data?.devices || []);
    } catch (err: any) {
      toast.error('Failed to load biometric devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
      setIsAdding(false);
    }
  }, [isOpen]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.device_name.trim() || !form.serial_number.trim()) {
      return toast.error('Device Name and Serial Number are required.');
    }

    setSaving(true);
    try {
      await api.post('/biometric/devices', form);
      toast.success(`Biometric device "${form.device_name}" registered successfully!`);
      setForm({ device_name: '', serial_number: '', location: 'Main Office', ip_address: '', port: 4370 });
      setIsAdding(false);
      fetchDevices();
      if (onRefreshDevices) onRefreshDevices();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to register device.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (device: BiometricDevice) => {
    setTestingId(device.id);
    try {
      const res = await api.post(`/biometric/devices/${device.id}/test`);
      toast.success(`Device ${device.serial_number} is Online! Enrolled users: ${res.data?.data?.live_users_count ?? 0}`);
      fetchDevices();
      if (onRefreshDevices) onRefreshDevices();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Connection test failed.');
      fetchDevices();
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (device: BiometricDevice) => {
    if (!confirm(`Are you sure you want to delete biometric device "${device.device_name}" (${device.serial_number})?`)) return;

    try {
      await api.delete(`/biometric/devices/${device.id}`);
      toast.success('Device removed successfully.');
      fetchDevices();
      if (onRefreshDevices) onRefreshDevices();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete device.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Biometric Devices & Hardware Fleet" size="lg">
      <div className="space-y-5 text-xs">
        {/* Top Header */}
        <div className="flex items-center justify-between bg-surface/50 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy/10 text-navy flex items-center justify-center">
              <Cpu size={16} />
            </div>
            <div>
              <p className="font-bold text-navy">SmartOffice & BioMax Infrastructure</p>
              <p className="text-[11px] text-muted">Manage fingerprint & facial attendance hardware endpoints</p>
            </div>
          </div>
          {!isAdding && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setIsAdding(true)}
              className="bg-navy hover:bg-navy/90 text-white font-bold"
            >
              Add Device
            </Button>
          )}
        </div>

        {/* Add Device Sub-Form */}
        {isAdding && (
          <form onSubmit={handleRegister} className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-3 animate-in fade-in zoom-in-95">
            <p className="font-bold text-navy flex items-center gap-1.5">
              <Server size={14} className="text-indigo-600" /> Register New BioMax Device
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Device Name *"
                placeholder="e.g. Main Office BioMax - Ground Floor"
                value={form.device_name}
                onChange={(e) => setForm({ ...form, device_name: e.target.value })}
                required
              />
              <Input
                label="Device Serial Number *"
                placeholder="e.g. C26044CB4F352330"
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                required
              />
              <Input
                label="Physical Location"
                placeholder="e.g. Reception Lobby / HQ"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="IP Address (Optional)"
                  placeholder="192.168.1.201"
                  value={form.ip_address}
                  onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                />
                <Input
                  label="Port"
                  type="number"
                  placeholder="4370"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setIsAdding(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Save & Connect
              </Button>
            </div>
          </form>
        )}

        {/* Devices List Table */}
        {loading ? (
          <div className="p-8 text-center text-muted">Loading registered biometric devices...</div>
        ) : devices.length === 0 ? (
          <div className="text-center p-8 border border-dashed border-border rounded-xl space-y-2">
            <Cpu className="w-8 h-8 text-muted mx-auto" />
            <p className="font-bold text-navy">No Biometric Devices Connected</p>
            <p className="text-muted text-[11px] max-w-sm mx-auto">
              Add your BioMax terminal serial number to start syncing real-time attendance logs with SmartOffice.
            </p>
            <Button variant="primary" size="sm" onClick={() => setIsAdding(true)} className="bg-amber text-slate-900 font-bold mt-2">
              Add First Device
            </Button>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted font-bold border-b border-border">
                <tr>
                  <th className="p-3">Device Name & Location</th>
                  <th className="p-3">Serial Number</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Sync</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-surface/50 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-navy">{d.device_name}</p>
                      <p className="text-[10px] text-muted">{d.location || 'Office'}</p>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-700">{d.serial_number}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          d.status === 'online'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : d.status === 'degraded'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="p-3 text-[11px] text-muted">
                      {d.last_sync_at ? new Date(d.last_sync_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="xs"
                          loading={testingId === d.id}
                          onClick={() => handleTestConnection(d)}
                          className="text-[10px]"
                          title="Test SmartOffice & BioMax Connection"
                        >
                          <Wifi size={12} className="mr-1" /> Ping Test
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d)}
                          className="text-rose-600 hover:text-rose-800 p-1 rounded transition-colors"
                          title="Remove Device"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
