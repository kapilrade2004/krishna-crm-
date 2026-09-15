'use client';

import { useState, useEffect } from 'react';
import { Role, Permission } from '@/types';
import { Button, Badge } from '@/components/ui';
import { Shield, Check, Save, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  roles: Role[];
  permissions: Permission[];
  onRefresh?: () => void;
}

export default function RolePermissionMatrix({ roles, permissions, onRefresh }: Props) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      const defaultRole = roles.find(r => r.name === 'Super admin') || roles[0];
      setSelectedRole(defaultRole);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    if (selectedRole) {
      const permIds = (selectedRole.permissions || []).map(p => p.id);
      setSelectedPermIds(permIds);
    }
  }, [selectedRole]);

  const togglePermission = (permId: string) => {
    setSelectedPermIds(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    );
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await api.put(`/user-access/roles/${selectedRole.id}/permissions`, {
        permissionIds: selectedPermIds,
      });

      const enabledModules = Array.from(
        new Set(
          permissions
            .filter(p => selectedPermIds.includes(p.id))
            .map(p => (p.module ? p.module.toUpperCase() : 'GENERAL'))
        )
      );
      const moduleSummaryStr = enabledModules.length > 0 ? enabledModules.join(', ') : 'Default';

      const { useNotificationStore } = await import('@/lib/notifications');
      useNotificationStore.getState().addNotification({
        userId: 'all',
        title: `Role Matrix Updated: ${selectedRole.name}`,
        message: `Super Admin has updated the default access permissions for the '${selectedRole.name}' role: Allowed [${moduleSummaryStr}].`,
        type: 'access_granted',
      });

      toast.success(`Role '${selectedRole.name}' permissions saved. Broadcasted update for modules: ${moduleSummaryStr}`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save role permissions');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const moduleMap = new Map<string, Permission[]>();
  permissions.forEach(p => {
    const list = moduleMap.get(p.module) || [];
    list.push(p);
    moduleMap.set(p.module, list);
  });

  // Friendly module metadata
  const MODULE_LABELS: Record<string, { label: string; desc: string }> = {
    daily_tasks: { label: 'Daily Tasks & Checklists', desc: 'Shift task assignments, checklists, DSR exports & completion logging' },
    activities: { label: 'Shift Activities & Live Audit', desc: 'Real-time shift activity timers, break logs & managerial review' },
    ecommerce: { label: 'E-Commerce & Marketplaces', desc: 'Amazon/Flipkart orders, FBA shipments, listings & OMS Guru' },
    spn_ads: { label: 'SPN & Advertising Management', desc: 'Keyword bids, negative keywords, ad budgets & product research' },
    accounting: { label: 'Accounting & Invoicing', desc: 'Tally entries, MyBillBook invoicing, sales returns & bank reconciliation' },
    returns_rma: { label: 'Returns & RMA Logistics', desc: 'Amazon returns, putaway, 60-day claims & replacement authorizations' },
    telecalling: { label: 'Telecalling & Call Center', desc: 'Confirmation calling, Easyship ratings, reviews & installation help' },
    warranty: { label: 'Warranty & Protection Services', desc: '24h post-delivery activation, technician repairs & coverage resets' },
    biometrics: { label: 'SmartOffice Biometric Devices', desc: 'Biometric terminals, device endpoints & raw punch event sync' },
    attendance: { label: 'Attendance & Shift Management', desc: 'Shift scheduling, overtime calculations & manual punch corrections' },
    payroll: { label: 'Payroll & Compensation', desc: 'Salary profiles, monthly payroll execution & bank payout exports' },
    shipping: { label: 'Shipping & Serviceability', desc: 'Pincode courier rules, delivery run-sheets & NDR handling' },
    customers: { label: 'Customer 360 & Timeline', desc: 'Customer identities, contact records, document uploads & VIP status' },
    orders: { label: 'Orders & Fulfillment Pipeline', desc: 'Order ingestion, WhatsApp verification, tracking & cancellation' },
    csv: { label: 'CSV Bulk Ingestion', desc: 'Marketplace CSV imports & batch history audit' },
    access: { label: 'Access Authority & RBAC', desc: 'User management, role matrices, password controls & audit logs' },
  };

  const handleToggleAllInModule = (permList: Permission[]) => {
    const modulePermIds = permList.map(p => p.id);
    const allSelected = modulePermIds.every(id => selectedPermIds.includes(id));
    if (allSelected) {
      // Deselect all in module
      setSelectedPermIds(prev => prev.filter(id => !modulePermIds.includes(id)));
    } else {
      // Select all in module
      setSelectedPermIds(prev => Array.from(new Set([...prev, ...modulePermIds])));
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Selection Grid */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber" />
            <span className="text-xs font-bold text-gray-900">Select System Role to Configure Authority</span>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-navy text-amber">
            {roles.length} Roles Configured
          </span>
        </div>

        {roles.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">No System Roles Loaded</p>
              <p className="text-xs text-gray-500 mt-0.5">Click below to fetch system roles and authority matrices from the server.</p>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="px-4 py-2 bg-navy text-amber hover:bg-navy/90 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Roles Matrix
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {roles.map(r => {
              const isActive = selectedRole?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all flex flex-col justify-between gap-1 border text-left cursor-pointer ${
                    isActive
                      ? 'bg-navy text-amber border-navy shadow-md ring-2 ring-amber/20'
                      : 'bg-gray-50/80 hover:bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate text-xs">{r.name}</span>
                    {r.is_system && (
                      <span className={`text-[8px] px-1 py-0.2 rounded font-extrabold uppercase ${
                        isActive ? 'bg-amber text-navy' : 'bg-gray-200 text-gray-600'
                      }`}>
                        SYS
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium truncate ${
                    isActive ? 'text-amber/80' : 'text-gray-400'
                  }`}>
                    Scope: {r.data_scope || 'all'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedRole && (
        <div className="space-y-6">
          {/* Role Header Info */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{selectedRole.name}</h3>
                <Badge label={`Scope: ${selectedRole.data_scope}`} colorClass="bg-amber-500/20 text-amber-300 border border-amber-500/30" />
                {selectedRole.is_system && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-400/30">
                    System Role
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                {selectedRole.description || 'Configured default permissions for users assigned to this role.'}
              </p>
            </div>

            <Button
              variant="primary"
              icon={<Save size={14} />}
              loading={saving}
              onClick={handleSaveRole}
              className="bg-amber hover:bg-amber-600 text-navy font-bold flex-shrink-0 cursor-pointer shadow-md"
            >
              Save Role Matrix
            </Button>
          </div>

          {/* Module Permissions Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from(moduleMap.entries()).map(([moduleName, permList]) => {
              const meta = MODULE_LABELS[moduleName.toLowerCase()] || {
                label: `${moduleName.toUpperCase()} Module`,
                desc: 'Operational permissions for this system module',
              };
              const activeCount = permList.filter(p => selectedPermIds.includes(p.id)).length;
              const isAllSelected = activeCount === permList.length && permList.length > 0;

              return (
                <div key={moduleName} className="card p-4 space-y-3 border-gray-200/90 shadow-xs hover:border-amber/40 transition-all bg-white">
                  <div className="flex items-start justify-between border-b border-gray-100 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center gap-1.5">
                        <Shield size={13} className="text-amber" />
                        {meta.label}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{meta.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleAllInModule(permList)}
                        className="text-[10px] font-bold text-amber hover:text-amber-800 transition-colors cursor-pointer"
                      >
                        {isAllSelected ? 'Deselect All' : 'Select All'}
                      </button>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        activeCount > 0 ? 'bg-amber/15 text-navy font-bold' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {activeCount} / {permList.length}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {permList.map(p => {
                      const isChecked = selectedPermIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          onClick={() => togglePermission(p.id)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs cursor-pointer select-none transition-all border ${
                            isChecked
                              ? 'bg-amber-50/40 border-amber/40 text-navy shadow-2xs'
                              : 'bg-gray-50/50 border-gray-100 text-gray-600 hover:bg-gray-100/70 hover:border-gray-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded border-gray-300 text-amber focus:ring-amber shrink-0 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 leading-snug text-xs">{p.description || p.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{p.name}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
