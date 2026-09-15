'use strict';
'use client';

import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedUserRow {
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  designation?: string;
  employee_id?: string;
  isValid: boolean;
  error?: string;
}

export default function BulkUserImportModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkUserImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedUserRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ imported: number; errors: any[] } | null>(null);

  const downloadSampleTemplate = () => {
    const csvContent =
      'First Name,Last Name,Email,Phone,Role,Department,Designation,Employee ID\n' +
      'Amit,Kumar,amit.kumar@krishnacrm.com,9876543210,sales,Sales,Sales Officer,EMP-2001\n' +
      'Sunita,Rao,sunita.rao@krishnacrm.com,9876543211,telecaller,Telecalling,Telecaller,EMP-2002\n' +
      'Vikas,Verma,vikas.verma@krishnacrm.com,9876543212,technician,Service,Field Engineer,EMP-2003\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'users_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setParsing(true);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          toast.error('File contains no data rows.');
          setParsing(false);
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s_-]/g, ''));
        const parsed: ParsedUserRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length === 0 || cols.every((c) => !c)) continue;

          let firstName = '';
          let lastName = '';
          let email = '';
          let phone = '';
          let role = 'sales';
          let department = '';
          let designation = '';
          let employeeId = '';

          headers.forEach((h, idx) => {
            const val = cols[idx] || '';
            if (h.includes('firstname') || h === 'first') firstName = val;
            else if (h.includes('lastname') || h === 'last') lastName = val;
            else if (h.includes('email') || h === 'mail') email = val;
            else if (h.includes('phone') || h.includes('mobile')) phone = val;
            else if (h.includes('role')) role = val.toLowerCase() || 'sales';
            else if (h.includes('department') || h.includes('dept')) department = val;
            else if (h.includes('designation') || h.includes('title')) designation = val;
            else if (h.includes('employeeid') || h.includes('empid') || h.includes('code')) employeeId = val;
            else if (h.includes('name') && !firstName) {
              const parts = val.split(' ');
              firstName = parts[0] || '';
              lastName = parts.slice(1).join(' ') || '';
            }
          });

          const fullName = `${firstName} ${lastName}`.trim();
          let isValid = true;
          let error = '';

          if (!email || !email.includes('@')) {
            isValid = false;
            error = 'Invalid email address';
          } else if (!fullName && !email) {
            isValid = false;
            error = 'Name or First Name required';
          }

          parsed.push({
            name: fullName || email.split('@')[0],
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            role,
            department,
            designation,
            employee_id: employeeId,
            isValid,
            error,
          });
        }

        setRows(parsed);
        toast.success(`Parsed ${parsed.length} rows from file.`);
      } catch (err) {
        toast.error('Failed to parse file.');
      } finally {
        setParsing(false);
      }
    };

    reader.readAsText(uploadedFile);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      return toast.error('No valid user rows to import.');
    }

    setImporting(true);
    try {
      const res = await api.post('/user-access/users/bulk-import', { users: validRows });
      const data = res.data?.data;
      setImportResults({
        imported: data?.importedUsers?.length || validRows.length,
        errors: data?.errors || [],
      });
      toast.success(`Successfully imported ${data?.importedUsers?.length || validRows.length} users!`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Bulk import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Bulk Import Users (Excel / CSV)"
      size="xl"
    >
      <div className="space-y-4">
        {/* Header CTA */}
        <div className="flex items-center justify-between p-3.5 bg-amber/5 border border-amber/20 rounded-2xl">
          <div className="text-xs text-navy">
            <span className="font-bold text-navy">Download Template: </span>
            Use our pre-configured CSV structure with auto-generated headers.
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={downloadSampleTemplate}
            className="flex items-center gap-1.5 text-xs text-amber-800 border-amber/30 bg-amber/10 hover:bg-amber/20"
          >
            <Download className="w-3.5 h-3.5 text-amber-800" /> Download Template (.csv)
          </Button>
        </div>

        {/* Upload Dropzone */}
        {!rows.length && (
          <label className="border-2 border-dashed border-gray-300 hover:border-amber rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-white hover:bg-amber/5">
            <FileSpreadsheet className="w-10 h-10 text-amber mb-2" />
            <span className="text-sm font-bold text-navy">Click or Drag CSV / Excel file here</span>
            <span className="text-xs text-gray-400 mt-1">Supports standard .csv and .txt spreadsheet exports</span>
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
          </label>
        )}

        {/* Preview Table */}
        {rows.length > 0 && !importResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-navy">
                Preview Data ({rows.filter((r) => r.isValid).length} Valid, {rows.filter((r) => !r.isValid).length} Errors)
              </span>
              <label className="text-xs text-amber-700 hover:underline cursor-pointer font-semibold flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Change File
                <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Department</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, idx) => (
                    <tr key={idx} className={r.isValid ? 'hover:bg-gray-50' : 'bg-red-50/60'}>
                      <td className="p-2 text-gray-400">{idx + 1}</td>
                      <td className="p-2 font-medium">{r.name}</td>
                      <td className="p-2 text-gray-600 font-mono text-[11px]">{r.email}</td>
                      <td className="p-2">
                        <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-800 text-[10px] uppercase font-mono">
                          {r.role}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500">{r.department || '—'}</td>
                      <td className="p-2">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                            <Check className="w-3 h-3" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]" title={r.error}>
                            <AlertCircle className="w-3 h-3" /> {r.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results Screen */}
        {importResults && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-emerald-900">
              Bulk Import Completed: {importResults.imported} User(s) Created
            </h4>
            <p className="text-xs text-emerald-700">
              Temporary passwords were automatically generated for each account with force-reset on first login.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {importResults ? 'Close' : 'Cancel'}
          </Button>

          {rows.length > 0 && !importResults && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={importing}
              onClick={handleImport}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4" /> Import {rows.filter((r) => r.isValid).length} Valid Users
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
