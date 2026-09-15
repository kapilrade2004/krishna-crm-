'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { Key, Copy, Check, Lock, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User as UserType } from '@/types';
import api from '@/lib/api';

interface PasswordManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserType | null;
}

export default function PasswordManagementModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: PasswordManagementModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [forcePasswordReset, setForcePasswordReset] = useState(true);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Kri@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pwd);
    toast.success('Generated temporary password');
  };

  const copyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    toast.success('Password copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!newPassword || newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters.');
    }

    setSubmitting(true);
    try {
      const res = await api.post(`/user-access/users/${user.id}/reset-password`, {
        newPassword,
        forcePasswordReset,
      });
      toast.success(res.data?.message || 'Password reset successfully!');
      onSuccess();
      onClose();
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Reset Password for ${user.name}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber/5 border border-amber/20 rounded-2xl text-xs text-navy space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-800">
            <Lock className="w-3.5 h-3.5" /> Security Notice
          </p>
          <p className="text-gray-600">
            Resetting the password will immediately invalidate all active sessions for{' '}
            <strong className="text-navy">{user.email}</strong>.
          </p>
        </div>

        {user.display_password && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs flex items-center justify-between">
            <div>
              <span className="text-gray-500 text-[11px] block">Current Active Password:</span>
              <span className="font-mono font-bold text-navy select-all">{user.display_password}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(user.display_password || '');
                toast.success('Current password copied to clipboard!');
              }}
              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3 text-gray-500" /> Copy
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700">New Temporary Password *</label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={generateTempPassword}
              className="text-xs flex items-center gap-1 text-amber-700 hover:text-amber-800 border-amber/20 bg-amber/5"
            >
              <Key className="w-3.5 h-3.5 text-amber-700" /> Generate Secure Password
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password or click generate"
              className="font-mono text-sm"
              required
            />
            {newPassword && (
              <Button
                type="button"
                variant="secondary"
                onClick={copyPassword}
                className="flex-shrink-0"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
              </Button>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={forcePasswordReset}
              onChange={(e) => setForcePasswordReset(e.target.checked)}
              className="w-4 h-4 text-amber rounded border-gray-300 focus:ring-amber"
            />
            <span className="text-xs font-medium text-gray-700">
              Force user to change password upon next login
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 text-xs bg-amber hover:bg-amber/90 text-navy font-bold px-4 py-2 rounded-xl shadow-xs transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-navy" /> Reset Password
          </button>
        </div>
      </form>
    </Modal>
  );
}
