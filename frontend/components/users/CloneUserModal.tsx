'use client';

import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { Copy, Users, CheckCircle2, Key, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User as UserType } from '@/types';
import api from '@/lib/api';

interface CloneUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sourceUser: UserType | null;
}

export default function CloneUserModal({
  isOpen,
  onClose,
  onSuccess,
  sourceUser,
}: CloneUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState(sourceUser?.department || '');
  const [designation, setDesignation] = useState(sourceUser?.designation || '');
  const [employeeId, setEmployeeId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Kri@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    toast.success('Generated secure password');
  };

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUser) return;
    if (!name.trim() || !email.trim() || !password) {
      return toast.error('Name, Email, and Password are required for cloning.');
    }

    setSubmitting(true);
    try {
      const res = await api.post('/user-access/users/clone', {
        sourceUserId: sourceUser.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        password,
        department: department.trim() || sourceUser.department,
        designation: designation.trim() || sourceUser.designation,
        employee_id: employeeId.trim() || null,
      });

      toast.success(res.data?.message || 'User cloned successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to clone user.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!sourceUser) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Clone User Profile: ${sourceUser.name}`}
      size="lg"
    >
      <form onSubmit={handleClone} className="space-y-4">
        <div className="p-3.5 bg-amber/5 border border-amber/20 rounded-2xl text-xs text-navy space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-800">
            <Users className="w-3.5 h-3.5" /> Inheritance Blueprint
          </p>
          <p className="text-gray-600">
            The new user will automatically inherit base role{' '}
            <strong className="uppercase font-mono bg-amber/20 px-1.5 py-0.5 rounded text-navy">
              {sourceUser.role}
            </strong>{' '}
            along with all {sourceUser.permissions?.length || 0} customized module permissions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="New Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Patel"
            required
          />
          <Input
            label="New Email Address *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="priya.patel@krishnacrm.com"
            required
          />
          <Input
            label="Mobile Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
          <Input
            label="Employee ID"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="e.g. KR-EMP-1045"
          />
          <Input
            label="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder={sourceUser.department || 'Department'}
          />
          <Input
            label="Designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder={sourceUser.designation || 'Designation'}
          />
        </div>

        <div className="space-y-2 p-3 bg-gray-50 border border-gray-200 rounded-2xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700">Account Password *</label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={generateTempPassword}
              className="text-xs flex items-center gap-1 text-amber-700 hover:text-amber-800"
            >
              <Key className="w-3.5 h-3.5 text-amber-700" /> Generate Password
            </Button>
          </div>
          <Input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter temporary password for new account"
            className="font-mono text-sm"
            required
          />
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
            <Copy className="w-4 h-4 text-navy" /> Clone &amp; Create User
          </button>
        </div>
      </form>
    </Modal>
  );
}
