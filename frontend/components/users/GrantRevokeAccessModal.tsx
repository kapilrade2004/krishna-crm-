'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Badge } from '@/components/ui';
import { User, Permission, UserPermissionOverride } from '@/types';
import { Shield, ShieldCheck, ShieldOff, Check, X, RotateCcw, Lock } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
  allPermissions: Permission[];
  onSaved?: () => void;
}

// Override state: null = inherit role default, true = explicit grant, false = explicit revoke
type OverrideStateMap = Record<string, boolean | null>;

export default function GrantRevokeAccessModal({ open, onClose, user, allPermissions, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [effectivePerms, setEffectivePerms] = useState<string[]>([]);
  const [overrideMap, setOverrideMap] = useState<OverrideStateMap>({});

  useEffect(() => {
    if (!open || !user) return;

    setLoading(true);
    api.get(`/user-access/users/${user.id}/permissions`)
      .then(res => {
        const payload = res.data?.data || {};
        setEffectivePerms(payload.effectivePermissions || []);

        const initialOverrides: OverrideStateMap = {};
        (payload.overrides || []).forEach((ov: UserPermissionOverride) => {
          initialOverrides[ov.permission_id] = ov.is_allowed;
        });
        setOverrideMap(initialOverrides);
      })
      .catch(err => {
        toast.error('Failed to load user permissions');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [open, user]);

  const modules = useMemo(() => {
    const map = new Map<string, Permission[]>();
    allPermissions.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return Array.from(map.entries());
  }, [allPermissions]);

  const handleToggle = (permissionId: string, currentState: boolean | null) => {
    setOverrideMap(prev => {
      const next = { ...prev };
      // Cycle: null (Inherit) -> true (Grant) -> false (Revoke) -> null (Inherit)
      if (currentState === null || currentState === undefined) {
        next[permissionId] = true;
      } else if (currentState === true) {
        next[permissionId] = false;
      } else {
        delete next[permissionId];
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const overridesArray = Object.entries(overrideMap).map(([permission_id, is_allowed]) => ({
        permission_id,
        is_allowed,
      }));

      await api.put(`/user-access/users/${user.id}/permissions`, {
        overrides: overridesArray,
      });

      // Calculate granted modules for notification summary
      const grantedPermIds = Object.entries(overrideMap)
        .filter(([, allowed]) => allowed === true)
        .map(([id]) => id);

      const grantedModules = Array.from(
        new Set(
          allPermissions
            .filter(p => grantedPermIds.includes(p.id))
            .map(p => (p.module ? p.module.toUpperCase() : 'GENERAL'))
        )
      );

      const moduleSummaryStr = grantedModules.length > 0 ? grantedModules.join(', ') : 'Updated Rights';

      // Dispatch notification store event for the target user
      const { useNotificationStore } = await import('@/lib/notifications');
      useNotificationStore.getState().addNotification({
        userId: user.email,
        title: 'Module Access Granted',
        message: `Super Admin has granted you access to the following module(s): ${moduleSummaryStr}.`,
        type: 'access_granted',
      });

      toast.success(
        `Access updated for ${user.name}! Notification sent: "Super Admin has granted you access of ${moduleSummaryStr}"`
      );
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update access rights');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Grant / Revoke Access Rights — ${user.name}`}
      width="max-w-3xl"
    >
      <div className="space-y-4">
        {/* User Info Header */}
        <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-lg border border-indigo-400/30">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm leading-none text-white">{user.name}</p>
              <p className="text-xs text-slate-400 mt-1">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge label={`Base Role: ${user.role.toUpperCase()}`} colorClass="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" />
            {user.role === 'admin' || user.role === 'super_admin' ? (
              <Badge label="Full Access (Super Admin)" colorClass="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" />
            ) : null}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between bg-surface border border-border p-3 rounded-lg text-xs">
          <span className="text-muted font-medium">Click any permission to toggle state:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
              <RotateCcw size={11} /> Inherit (Role Default)
            </span>
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
              <Check size={11} /> Granted (Custom Access)
            </span>
            <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
              <X size={11} /> Revoked (Access Denied)
            </span>
          </div>
        </div>

        {/* Module Permissions Grid */}
        <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="py-8 text-center text-muted text-sm">Loading permissions matrix...</div>
          ) : (
            modules.map(([moduleName, permList]) => (
              <div key={moduleName} className="border border-border rounded-xl p-4 bg-white shadow-xs">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-navy mb-3 flex items-center gap-1.5">
                  <Shield size={14} className="text-amber" />
                  {moduleName} Module
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {permList.map(p => {
                    const state = overrideMap[p.id] ?? null;
                    const isEffective = effectivePerms.includes(p.name);

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggle(p.id, state)}
                        className={`text-left p-2.5 rounded-lg border transition-all flex items-center justify-between group ${
                          state === true
                            ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100'
                            : state === false
                            ? 'bg-red-50 border-red-300 hover:bg-red-100'
                            : 'bg-surface border-border hover:border-gray-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium text-navy truncate">{p.description || p.name}</p>
                          <p className="text-[10px] text-muted truncate font-mono mt-0.5">{p.name}</p>
                        </div>

                        <div className="flex-shrink-0">
                          {state === true ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-600 text-white shadow-xs">
                              <ShieldCheck size={11} /> Granted
                            </span>
                          ) : state === false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-600 text-white shadow-xs">
                              <ShieldOff size={11} /> Revoked
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                              isEffective
                                ? 'bg-gray-100 text-gray-700 border-gray-300'
                                : 'bg-gray-50 text-gray-400 border-gray-200'
                            }`}>
                              {isEffective ? 'Role Allowed' : 'Role Restricted'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save Access Rights
          </Button>
        </div>
      </div>
    </Modal>
  );
}
