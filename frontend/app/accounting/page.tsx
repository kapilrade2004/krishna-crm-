import React from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';

export default function DeactivatedPage() {
  return (
    <AppShell>
      <Topbar title="Accounting & Finance" subtitle="Module Disabled" />
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <h2 className="text-xl font-semibold text-gray-700">Module Deactivated</h2>
        <p className="text-sm text-gray-500 mt-2">This page and module have been commented out across the system.</p>
      </div>
    </AppShell>
  );
}

// ORIGINAL CODE COMMENTED OUT:
// 'use strict';
// 
// 'use client';
// 
// import React, { useState, useEffect } from 'react';
// import AppShell from '@/components/layout/AppShell';
// import Topbar from '@/components/layout/Topbar';
// import { Calculator, IndianRupee, FileText, CheckCircle, Clock, AlertTriangle, Plus, Search, RefreshCw, CheckSquare, Layers } from 'lucide-react';
// import { KpiCard, Badge, Button, Modal, PageLoader, EmptyState } from '@/components/ui';
// import { formatCurrency } from '@/lib/utils';
// import PermissionGate from '@/components/auth/PermissionGate';
// import api from '@/lib/api';
// 
// export default function AccountingPage() {
//   const [activeTab, setActiveTab] = useState<'tally' | 'stock' | 'cheques' | 'invoicing' | 'dsr'>('tally');
//   const [records, setRecords] = useState<any[]>([]);
//   const [cheques, setCheques] = useState<any[]>([]);
//   const [dsr, setDsr] = useState<any>(null);
//   const [summary, setSummary] = useState<any>({ totalDebit: 0, totalCredit: 0, netBalance: 0, pendingStockAudits: 0 });
//   const [loading, setLoading] = useState(true);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
// 
//   const [formData, setFormData] = useState({
//     record_type: 'tally_entry',
//     voucher_number: '',
//     party_name: '',
//     category: 'Vendor PO Inward',
//     debit_amount: 0,
//     credit_amount: 0,
//     stock_sku: '',
//     physical_quantity: 0,
//     book_quantity: 0,
//     portal_name: 'Tally',
//     remarks: '',
//   });
// 
//   const fetchData = () => {
//     setLoading(true);
//     if (activeTab === 'cheques') {
//       api.get('/accounting/cheques')
//         .then(res => {
//           if (res.data?.data?.cheques) setCheques(res.data.data.cheques);
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else if (activeTab === 'dsr') {
//       api.get('/accounting/dsr-summary')
//         .then(res => {
//           if (res.data?.data) setDsr(res.data.data);
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else {
//       let rType = 'all';
//       if (activeTab === 'tally') rType = 'tally_entry';
//       if (activeTab === 'stock') rType = 'stock_reconciliation';
//       if (activeTab === 'invoicing') rType = 'mybillbook_invoice';
// 
//       api.get(`/accounting/records?record_type=${rType}`)
//         .then(res => {
//           if (res.data?.data) {
//             setRecords(res.data.data.records || []);
//             if (res.data.data.summary) setSummary(res.data.data.summary);
//           }
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     }
//   };
// 
//   useEffect(() => {
//     fetchData();
//   }, [activeTab]);
// 
//   const handleVerifyCheque = async (id: string, status: string) => {
//     try {
//       await api.put(`/accounting/cheques/${id}/verify`, { status });
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to update cheque');
//     }
//   };
// 
//   const handleCreateRecord = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       await api.post('/accounting/records', formData);
//       setIsModalOpen(false);
//       setFormData({
//         record_type: 'tally_entry',
//         voucher_number: '',
//         party_name: '',
//         category: 'Vendor PO Inward',
//         debit_amount: 0,
//         credit_amount: 0,
//         stock_sku: '',
//         physical_quantity: 0,
//         book_quantity: 0,
//         portal_name: 'Tally',
//         remarks: '',
//       });
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to create record');
//     } finally {
//       setSubmitting(false);
//     }
//   };
// 
//   return (
//     <AppShell>
//       <Topbar title="Accounting & Financial Administration" subtitle="Tally ERP sync, stock audit reconciliation, MyBillBook invoicing & cheque management" />
//       <main className="flex-1 overflow-y-auto p-6 space-y-6">
//         {/* KPI Deck */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//           <KpiCard label="Total Inflow / Credits" value={formatCurrency(summary.totalCredit)} icon={IndianRupee} subtext="Reconciled collections" />
//           <KpiCard label="Total Outflow / Debits" value={formatCurrency(summary.totalDebit)} icon={IndianRupee} subtext="Vendor POs & expenses" />
//           <KpiCard label="Net Ledger Balance" value={formatCurrency(summary.netBalance)} icon={Calculator} subtext="Operational surplus" />
//           <KpiCard label="Pending Stock Audits" value={summary.pendingStockAudits} icon={AlertTriangle} subtext="Inventory discrepancies" />
//         </div>
// 
//         {/* Workspace Sub-Tabs & Action Bar */}
//         <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
//           <div className="flex items-center gap-1.5 overflow-x-auto">
//             <button
//               onClick={() => setActiveTab('tally')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'tally' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Tally Entries & Vouchers
//             </button>
//             <button
//               onClick={() => setActiveTab('stock')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'stock' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Stock Audit & Discrepancies
//             </button>
//             <button
//               onClick={() => setActiveTab('cheques')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'cheques' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Cheque Verification Desk
//             </button>
//             <button
//               onClick={() => setActiveTab('invoicing')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'invoicing' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               MyBillBook Invoicing
//             </button>
//             <button
//               onClick={() => setActiveTab('dsr')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'dsr' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Daily Status Report (DSR)
//             </button>
//           </div>
// 
//           <div className="flex items-center gap-2">
//             <Button variant="secondary" size="sm" onClick={fetchData}>
//               <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
//             </Button>
//             <PermissionGate permission="accounting:tally">
//               <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
//                 <Plus size={14} className="mr-1.5" />
//                 <span>New Accounting Entry</span>
//               </Button>
//             </PermissionGate>
//           </div>
//         </div>
// 
//         {/* Content Render Based on Tab */}
//         <div className="card overflow-hidden">
//           {loading ? (
//             <div className="p-12"><PageLoader /></div>
//           ) : activeTab === 'cheques' ? (
//             // Cheques Verification Queue
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Customer</th>
//                     <th className="py-3 px-4">Cheque Number</th>
//                     <th className="py-3 px-4">Bank Name</th>
//                     <th className="py-3 px-4">Amount</th>
//                     <th className="py-3 px-4">Collected By</th>
//                     <th className="py-3 px-4">Status</th>
//                     <th className="py-3 px-4 text-right">Accountant Action</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {cheques.length === 0 ? (
//                     <tr>
//                       <td colSpan={7} className="py-6 text-center text-slate-400">
//                         No cheque collection records found.
//                       </td>
//                     </tr>
//                   ) : (
//                     cheques.map(c => (
//                       <tr key={c.id} className="hover:bg-slate-50/80">
//                         <td className="py-3 px-4 font-semibold text-slate-900">{c.customer_name}</td>
//                         <td className="py-3 px-4 font-mono font-bold">{c.cheque_number}</td>
//                         <td className="py-3 px-4 text-slate-600">{c.bank_name}</td>
//                         <td className="py-3 px-4 font-bold text-emerald-700">{formatCurrency(c.amount)}</td>
//                         <td className="py-3 px-4 text-slate-600">{c.assignedUser?.name || 'Manoj'}</td>
//                         <td className="py-3 px-4">
//                           <Badge
//                             colour={
//                               c.status === 'verified_by_accountant'
//                                 ? 'green'
//                                 : c.status === 'submitted_to_office'
//                                 ? 'amber'
//                                 : 'blue'
//                             }
//                           >
//                             {c.status.replace(/_/g, ' ')}
//                           </Badge>
//                         </td>
//                         <td className="py-3 px-4 text-right">
//                           <div className="flex justify-end gap-1.5">
//                             {c.status !== 'verified_by_accountant' && (
//                               <button
//                                 onClick={() => handleVerifyCheque(c.id, 'verified_by_accountant')}
//                                 className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-semibold"
//                               >
//                                 Mark Verified
//                               </button>
//                             )}
//                             {c.status !== 'deposited' && (
//                               <button
//                                 onClick={() => handleVerifyCheque(c.id, 'deposited')}
//                                 className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold"
//                               >
//                                 Deposit
//                               </button>
//                             )}
//                           </div>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           ) : activeTab === 'stock' ? (
//             // Stock Reconciliation Tab
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Date</th>
//                     <th className="py-3 px-4">Warehouse / Location</th>
//                     <th className="py-3 px-4">SKU</th>
//                     <th className="py-3 px-4">Physical Count</th>
//                     <th className="py-3 px-4">Book Count</th>
//                     <th className="py-3 px-4">Discrepancy</th>
//                     <th className="py-3 px-4">Reconciled?</th>
//                     <th className="py-3 px-4">Remarks</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {records.map(r => (
//                     <tr key={r.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-mono text-slate-600">{r.date}</td>
//                       <td className="py-3 px-4 font-semibold text-slate-800">{r.party_name}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-navy">{r.stock_sku || 'N/A'}</td>
//                       <td className="py-3 px-4 font-mono">{r.physical_quantity || 0}</td>
//                       <td className="py-3 px-4 font-mono">{r.book_quantity || 0}</td>
//                       <td className="py-3 px-4 font-mono font-bold">
//                         <span className={(r.discrepancy_quantity || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}>
//                           {r.discrepancy_quantity || 0}
//                         </span>
//                       </td>
//                       <td className="py-3 px-4">
//                         <Badge colour={r.reconciled ? 'green' : 'red'}>
//                           {r.reconciled ? 'Balanced' : 'Mismatch'}
//                         </Badge>
//                       </td>
//                       <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{r.remarks || 'None'}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : activeTab === 'dsr' ? (
//             // DSR Summary Tab
//             <div className="p-6 space-y-4">
//               <h3 className="text-sm font-bold text-navy">Daily Status Report (DSR) Summary for {dsr?.date || 'Today'}</h3>
//               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
//                   <span className="text-xs text-muted">Total Vouchers Logged</span>
//                   <p className="text-xl font-bold text-navy mt-1">{dsr?.recordCount || 0}</p>
//                 </div>
//                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
//                   <span className="text-xs text-muted">Total Debits</span>
//                   <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(dsr?.totalDebit || 0)}</p>
//                 </div>
//                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
//                   <span className="text-xs text-muted">Total Credits</span>
//                   <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(dsr?.totalCredit || 0)}</p>
//                 </div>
//                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
//                   <span className="text-xs text-muted">Pending Cheques</span>
//                   <p className="text-xl font-bold text-amber mt-1">{dsr?.pendingCheques || 0}</p>
//                 </div>
//               </div>
//               <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
//                 <CheckCircle size={16} />
//                 <span>Today&apos;s DSR has been compiled and verified for management submission.</span>
//               </div>
//             </div>
//           ) : (
//             // General Tally & Invoicing Records Table
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Date</th>
//                     <th className="py-3 px-4">Voucher #</th>
//                     <th className="py-3 px-4">Party / Vendor</th>
//                     <th className="py-3 px-4">Category</th>
//                     <th className="py-3 px-4">Debit</th>
//                     <th className="py-3 px-4">Credit</th>
//                     <th className="py-3 px-4">Portal</th>
//                     <th className="py-3 px-4">Remarks</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {records.length === 0 ? (
//                     <tr>
//                       <td colSpan={8} className="py-6 text-center text-slate-400">
//                         No accounting records found in this category.
//                       </td>
//                     </tr>
//                   ) : (
//                     records.map(r => (
//                       <tr key={r.id} className="hover:bg-slate-50/80">
//                         <td className="py-3 px-4 font-mono text-slate-600">{r.date}</td>
//                         <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.voucher_number}</td>
//                         <td className="py-3 px-4 font-semibold text-slate-900">{r.party_name}</td>
//                         <td className="py-3 px-4 text-slate-600">{r.category}</td>
//                         <td className="py-3 px-4 font-mono text-red-600">
//                           {r.debit_amount > 0 ? formatCurrency(r.debit_amount) : '-'}
//                         </td>
//                         <td className="py-3 px-4 font-mono font-bold text-emerald-700">
//                           {r.credit_amount > 0 ? formatCurrency(r.credit_amount) : '-'}
//                         </td>
//                         <td className="py-3 px-4">
//                           <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
//                             {r.portal_name}
//                           </span>
//                         </td>
//                         <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{r.remarks || 'None'}</td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
// 
//         {/* New Entry Modal */}
//         <Modal
//           isOpen={isModalOpen}
//           onClose={() => setIsModalOpen(false)}
//           title="Create Accounting / Stock Voucher"
//         >
//           <form onSubmit={handleCreateRecord} className="space-y-4 text-xs">
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Voucher Type *</label>
//                 <select
//                   value={formData.record_type}
//                   onChange={e => setFormData({ ...formData, record_type: e.target.value })}
//                   className="form-select w-full"
//                 >
//                   <option value="tally_entry">Tally Entry (Inward/Outward/PO)</option>
//                   <option value="stock_reconciliation">Stock Reconciliation (Audit)</option>
//                   <option value="mybillbook_invoice">MyBillBook Sales Invoicing</option>
//                   <option value="banking_deposit">Banking / Cash Deposit</option>
//                 </select>
//               </div>
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Voucher / Bill # *</label>
//                 <input
//                   type="text"
//                   required
//                   value={formData.voucher_number}
//                   onChange={e => setFormData({ ...formData, voucher_number: e.target.value })}
//                   placeholder="e.g. VCH-2026-901"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//             </div>
// 
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Party / Vendor / Account Name *</label>
//               <input
//                 type="text"
//                 required
//                 value={formData.party_name}
//                 onChange={e => setFormData({ ...formData, party_name: e.target.value })}
//                 placeholder="e.g. Kent RO Systems Ltd / Bhiwandi Warehouse"
//                 className="w-full border border-slate-200 rounded-lg p-2"
//               />
//             </div>
// 
//             {formData.record_type === 'stock_reconciliation' ? (
//               <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
//                 <div>
//                   <label className="block text-slate-700 font-semibold mb-1">Stock SKU *</label>
//                   <input
//                     type="text"
//                     required
//                     value={formData.stock_sku}
//                     onChange={e => setFormData({ ...formData, stock_sku: e.target.value })}
//                     placeholder="e.g. PUR-AKUA-COP"
//                     className="w-full border border-slate-200 rounded-lg p-2"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-slate-700 font-semibold mb-1">Physical Count *</label>
//                   <input
//                     type="number"
//                     required
//                     value={formData.physical_quantity}
//                     onChange={e => setFormData({ ...formData, physical_quantity: parseInt(e.target.value, 10) })}
//                     className="w-full border border-slate-200 rounded-lg p-2"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-slate-700 font-semibold mb-1">Book Count *</label>
//                   <input
//                     type="number"
//                     required
//                     value={formData.book_quantity}
//                     onChange={e => setFormData({ ...formData, book_quantity: parseInt(e.target.value, 10) })}
//                     className="w-full border border-slate-200 rounded-lg p-2"
//                   />
//                 </div>
//               </div>
//             ) : (
//               <div className="grid grid-cols-2 gap-3">
//                 <div>
//                   <label className="block text-slate-700 font-semibold mb-1">Debit Amount (₹)</label>
//                   <input
//                     type="number"
//                     value={formData.debit_amount}
//                     onChange={e => setFormData({ ...formData, debit_amount: parseFloat(e.target.value) || 0 })}
//                     className="w-full border border-slate-200 rounded-lg p-2"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-slate-700 font-semibold mb-1">Credit Amount (₹)</label>
//                   <input
//                     type="number"
//                     value={formData.credit_amount}
//                     onChange={e => setFormData({ ...formData, credit_amount: parseFloat(e.target.value) || 0 })}
//                     className="w-full border border-slate-200 rounded-lg p-2"
//                   />
//                 </div>
//               </div>
//             )}
// 
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Remarks / Internal Notes</label>
//               <textarea
//                 rows={2}
//                 value={formData.remarks}
//                 onChange={e => setFormData({ ...formData, remarks: e.target.value })}
//                 className="w-full border border-slate-200 rounded-lg p-2"
//               />
//             </div>
// 
//             <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
//               <Button type="button" variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
//               <Button type="submit" variant="primary" size="sm" disabled={submitting}>
//                 {submitting ? 'Saving...' : 'Record Voucher'}
//               </Button>
//             </div>
//           </form>
//         </Modal>
//       </main>
//     </AppShell>
//   );
// }
// 
