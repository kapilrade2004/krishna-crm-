'use strict';
'use client';

import { useState } from 'react';
import { Button, Input, Modal, Badge } from '@/components/ui';
import { Layers, Plus, Trash2, ShieldCheck, Check, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AccessTemplateItem, Permission } from '@/types';
import api from '@/lib/api';

interface AccessTemplatesTabProps {
  templates: AccessTemplateItem[];
  allPermissions: Permission[];
  onRefresh: () => void;
}

export default function AccessTemplatesTab({
  templates,
  allPermissions,
  onRefresh,
}: AccessTemplatesTabProps) {
  const [createModal, setCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermNames, setSelectedPermNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const togglePerm = (permName: string) => {
    setSelectedPermNames((prev) =>
      prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Template name is required.');

    setSaving(true);
    try {
      await api.post('/user-access/templates', {
        name: name.trim(),
        description: description.trim() || null,
        permissions: selectedPermNames,
      });
      toast.success('Access template created successfully!');
      onRefresh();
      setCreateModal(false);
      setName('');
      setDescription('');
      setSelectedPermNames([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, tplName: string) => {
    if (!confirm(`Are you sure you want to delete template "${tplName}"?`)) return;
    try {
      await api.delete(`/user-access/templates/${id}`);
      toast.success('Template deleted.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete template.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 border border-gray-200 rounded-2xl shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" /> Access & Permission Templates
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Predefined permission sets to quickly onboard new team members with standardized access.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCreateModal(true)}
          className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-3.5 h-3.5" /> Create Access Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-indigo-300 transition-all space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" /> {t.name}
                </h4>
                <p className="text-xs text-gray-500 mt-1">{t.description || 'No description provided.'}</p>
              </div>
              <button
                onClick={() => handleDelete(t.id, t.name)}
                className="text-gray-400 hover:text-red-600 p-1 rounded-lg transition-colors"
                title="Delete Template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <div className="text-[11px] font-bold text-gray-700 mb-1.5">
                Included Permissions ({t.permissions?.length || 0}):
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {(t.permissions || []).map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-md text-[10px] font-mono"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Create Access Template"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Template Title *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Telecaller Level 2, Service Manager"
            required
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief explanation of who this template is for"
          />

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700">
              Select Permissions ({selectedPermNames.length} selected)
            </label>
            <div className="border border-gray-200 rounded-xl p-3 max-h-60 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-50/50">
              {allPermissions.map((p) => {
                const isSelected = selectedPermNames.includes(p.name);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePerm(p.name)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded"
                    />
                    <span className="truncate" title={p.name}>
                      {p.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
