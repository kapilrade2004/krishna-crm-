'use strict';
'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User as UserType } from '@/types';
import api from '@/lib/api';

interface LockAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserType | null;
}

export default function LockAccountModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: LockAccountModalProps) {
  const isCurrentlyLocked = Boolean(user?.is_locked);
  const [reason, setReason] = useState(user?.locked_reason || '');
  const [submitting, setSubmitting] = useState(false);

  const handleToggleLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      const res = await api.post(`/user-access/users/${user.id}/lock`, {
        lock: !isCurrentlyLocked,
        reason: !isCurrentlyLocked ? reason.trim() || 'Locked by administrator' : null,
      });
      toast.success(res.data?.message || `User account ${isCurrentlyLocked ? 'unlocked' : 'locked'} successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isCurrentlyLocked ? `Unlock Account: ${user.name}` : `Lock Account: ${user.name}`}
      size="md"
    >
      <form onSubmit={handleToggleLock} className="space-y-4">
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
            isCurrentlyLocked
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            {isCurrentlyLocked ? (
              <Unlock className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
            <span>{isCurrentlyLocked ? 'Restore Account Access' : 'Immediate Lockout Notice'}</span>
          </div>
          <p>
            {isCurrentlyLocked
              ? `Unlocking will restore standard login capabilities for ${user.email}.`
              : `Locking this account will immediately terminate any active user sessions and prevent any further login attempts until unlocked by an administrator.`}
          </p>
        </div>

        {!isCurrentlyLocked && (
          <Input
            label="Reason for Locking Account"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Suspected security compromise, temporary leave"
          />
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={isCurrentlyLocked ? 'primary' : 'danger'}
            size="sm"
            loading={submitting}
            className="flex items-center gap-1.5"
          >
            {isCurrentlyLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {isCurrentlyLocked ? 'Unlock Account' : 'Lock Account Now'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
