import React from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';

export default function DeactivatedPage() {
  return (
    <AppShell>
      <Topbar title="Field Ops & Delivery" subtitle="Module Disabled" />
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
// import { Truck, CheckCircle, Phone, MapPin, IndianRupee, Clock, Plus, RefreshCw, AlertTriangle, Send } from 'lucide-react';
// import { KpiCard, Badge, Button, Modal, PageLoader, EmptyState } from '@/components/ui';
// import { formatCurrency } from '@/lib/utils';
// import PermissionGate from '@/components/auth/PermissionGate';
// import api from '@/lib/api';
// 
// export default function FieldOpsPage() {
//   const [activeTab, setActiveTab] = useState<'deliveries' | 'cheques'>('deliveries');
//   const [deliveries, setDeliveries] = useState<any[]>([]);
//   const [cheques, setCheques] = useState<any[]>([]);
//   const [stats, setStats] = useState<any>({ totalAssigned: 0, deliveredCount: 0, pendingDeliveries: 0 });
//   const [loading, setLoading] = useState(true);
//   const [isChequeModalOpen, setIsChequeModalOpen] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
// 
//   const [chequeForm, setChequeForm] = useState({
//     customer_name: '',
//     customer_phone: '',
//     cheque_number: '',
//     bank_name: '',
//     amount: '',
//     notes: '',
//   });
// 
//   const fetchData = () => {
//     setLoading(true);
//     if (activeTab === 'deliveries') {
//       api.get('/delivery/run-sheet')
//         .then(res => {
//           if (res.data?.data) {
//             setDeliveries(res.data.data.deliveries || []);
//             if (res.data.data.stats) setStats(res.data.data.stats);
//           }
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else {
//       api.get('/delivery/cheques')
//         .then(res => {
//           if (res.data?.data?.cheques) setCheques(res.data.data.cheques);
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
//   const handleUpdateStatus = async (id: string, status: string) => {
//     try {
//       await api.put(`/delivery/deliveries/${id}/status`, { status });
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to update delivery');
//     }
//   };
// 
//   const handleSaveCheque = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       await api.post('/delivery/cheques', chequeForm);
//       setIsChequeModalOpen(false);
//       setChequeForm({
//         customer_name: '',
//         customer_phone: '',
//         cheque_number: '',
//         bank_name: '',
//         amount: '',
//         notes: '',
//       });
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to record cheque');
//     } finally {
//       setSubmitting(false);
//     }
//   };
// 
//   const handleSubmitAllCheques = async () => {
//     const unsubmittedIds = cheques.filter(c => c.status === 'collected').map(c => c.id);
//     if (unsubmittedIds.length === 0) {
//       alert('No collected cheques pending office submission.');
//       return;
//     }
//     try {
//       await api.post('/delivery/cheques/submit-office', { cheque_ids: unsubmittedIds });
//       alert('All collected cheques successfully marked as submitted to office desk.');
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Submission failed');
//     }
//   };
// 
//   return (
//     <AppShell>
//       <Topbar title="Field Operations & Delivery Associate Desk" subtitle="Assigned parcel deliveries, on-field customer cheque pick-up & office handover" />
//       <main className="flex-1 overflow-y-auto p-6 space-y-6">
//         {/* KPI Deck */}
//         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//           <KpiCard label="Assigned Deliveries" value={stats.totalAssigned} icon={Truck} subtext={`${stats.deliveredCount} Delivered`} />
//           <KpiCard label="Pending Deliveries" value={stats.pendingDeliveries} icon={Clock} subtext="Requires drop-off today" />
//           <KpiCard label="Cheques Collected" value={cheques.length} icon={IndianRupee} subtext="Logged on field" />
//         </div>
// 
//         {/* Tab & Actions */}
//         <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
//           <div className="flex items-center gap-2">
//             <button
//               onClick={() => setActiveTab('deliveries')}
//               className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'deliveries' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Delivery Run-Sheet
//             </button>
//             <button
//               onClick={() => setActiveTab('cheques')}
//               className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'cheques' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Cheque Collection Desk
//             </button>
//           </div>
// 
//           <div className="flex items-center gap-2">
//             <Button variant="secondary" size="sm" onClick={fetchData}>
//               <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
//             </Button>
//             {activeTab === 'cheques' && (
//               <>
//                 <Button variant="secondary" size="sm" onClick={handleSubmitAllCheques}>
//                   <Send size={14} className="mr-1.5" />
//                   <span>Submit Cheques to Office</span>
//                 </Button>
//                 <Button variant="primary" size="sm" onClick={() => setIsChequeModalOpen(true)}>
//                   <Plus size={14} className="mr-1.5" />
//                   <span>Log New Cheque</span>
//                 </Button>
//               </>
//             )}
//           </div>
//         </div>
// 
//         {/* Content Render */}
//         <div className="card overflow-hidden">
//           {loading ? (
//             <div className="p-12"><PageLoader /></div>
//           ) : activeTab === 'deliveries' ? (
//             // Deliveries Run-Sheet Cards
//             <div className="p-6 space-y-4">
//               {deliveries.length === 0 ? (
//                 <EmptyState icon={<Truck size={36} />} title="No deliveries scheduled" description="Your delivery run-sheet is clear right now." />
//               ) : (
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   {deliveries.map(d => (
//                     <div key={d.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
//                       <div className="flex items-start justify-between">
//                         <div>
//                           <span className="font-mono text-xs font-bold text-slate-800">{d.order_number}</span>
//                           <h4 className="font-bold text-sm text-navy mt-0.5">{d.customer?.name || 'Customer'}</h4>
//                         </div>
//                         <Badge colour={d.flow_stage === 'delivered' ? 'green' : 'amber'}>
//                           {d.flow_stage.replace(/_/g, ' ')}
//                         </Badge>
//                       </div>
// 
//                       <div className="text-xs text-slate-600 space-y-1">
//                         <div className="flex items-center gap-2">
//                           <Phone size={13} className="text-slate-400" />
//                           <a href={`tel:${d.customer?.phone}`} className="text-amber hover:underline font-semibold">
//                             {d.customer?.phone || 'No phone'}
//                           </a>
//                         </div>
//                         <div className="flex items-start gap-2">
//                           <MapPin size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
//                           <span>{d.customer?.address || 'Address pending'}, {d.customer?.city} ({d.customer?.pincode})</span>
//                         </div>
//                         <div className="font-bold text-slate-900 mt-2">
//                           Amount to Collect: {formatCurrency(d.total_amount || 0)} ({d.payment_type || 'COD'})
//                         </div>
//                       </div>
// 
//                       <div className="flex gap-2 pt-2 border-t border-slate-200">
//                         {d.flow_stage !== 'delivered' && (
//                           <button
//                             onClick={() => handleUpdateStatus(d.id, 'delivered')}
//                             className="flex-1 py-1.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg hover:bg-emerald-700 transition"
//                           >
//                             Mark Delivered
//                           </button>
//                         )}
//                         <button
//                           onClick={() => handleUpdateStatus(d.id, 'failed')}
//                           className="px-3 py-1.5 bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg hover:bg-slate-300 transition"
//                         >
//                           Failed / Re-attempt
//                         </button>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           ) : (
//             // Cheques Table
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Customer Name</th>
//                     <th className="py-3 px-4">Cheque Number</th>
//                     <th className="py-3 px-4">Bank Name</th>
//                     <th className="py-3 px-4">Amount</th>
//                     <th className="py-3 px-4">Cheque Date</th>
//                     <th className="py-3 px-4">Status</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {cheques.map(c => (
//                     <tr key={c.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-semibold text-slate-900">{c.customer_name}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-slate-800">{c.cheque_number}</td>
//                       <td className="py-3 px-4 text-slate-600">{c.bank_name}</td>
//                       <td className="py-3 px-4 font-bold text-emerald-700">{formatCurrency(c.amount)}</td>
//                       <td className="py-3 px-4 font-mono text-slate-600">{c.cheque_date}</td>
//                       <td className="py-3 px-4">
//                         <Badge colour={c.status === 'verified_by_accountant' ? 'green' : c.status === 'submitted_to_office' ? 'blue' : 'amber'}>
//                           {c.status.replace(/_/g, ' ')}
//                         </Badge>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
// 
//         {/* Log Cheque Modal */}
//         <Modal isOpen={isChequeModalOpen} onClose={() => setIsChequeModalOpen(false)} title="Record Cheque Collection on Field">
//           <form onSubmit={handleSaveCheque} className="space-y-4 text-xs">
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Customer / Firm Name *</label>
//               <input
//                 type="text"
//                 required
//                 value={chequeForm.customer_name}
//                 onChange={e => setChequeForm({ ...chequeForm, customer_name: e.target.value })}
//                 placeholder="e.g. Suresh Singhania"
//                 className="w-full border border-slate-200 rounded-lg p-2"
//               />
//             </div>
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Cheque Number *</label>
//                 <input
//                   type="text"
//                   required
//                   value={chequeForm.cheque_number}
//                   onChange={e => setChequeForm({ ...chequeForm, cheque_number: e.target.value })}
//                   placeholder="e.g. 782910"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Bank Name *</label>
//                 <input
//                   type="text"
//                   required
//                   value={chequeForm.bank_name}
//                   onChange={e => setChequeForm({ ...chequeForm, bank_name: e.target.value })}
//                   placeholder="e.g. HDFC Bank"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//             </div>
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Amount (₹) *</label>
//                 <input
//                   type="number"
//                   required
//                   value={chequeForm.amount}
//                   onChange={e => setChequeForm({ ...chequeForm, amount: e.target.value })}
//                   placeholder="e.g. 25000"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Customer Phone</label>
//                 <input
//                   type="text"
//                   value={chequeForm.customer_phone}
//                   onChange={e => setChequeForm({ ...chequeForm, customer_phone: e.target.value })}
//                   placeholder="e.g. 9820011223"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//             </div>
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Notes / Pickup Remarks</label>
//               <textarea
//                 rows={2}
//                 value={chequeForm.notes}
//                 onChange={e => setChequeForm({ ...chequeForm, notes: e.target.value })}
//                 className="w-full border border-slate-200 rounded-lg p-2"
//               />
//             </div>
//             <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
//               <Button type="button" variant="secondary" size="sm" onClick={() => setIsChequeModalOpen(false)}>Cancel</Button>
//               <Button type="submit" variant="primary" size="sm" disabled={submitting}>
//                 {submitting ? 'Saving...' : 'Record Cheque'}
//               </Button>
//             </div>
//           </form>
//         </Modal>
//       </main>
//     </AppShell>
//   );
// }
// 
