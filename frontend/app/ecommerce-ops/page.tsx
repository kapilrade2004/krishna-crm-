import React from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';

export default function DeactivatedPage() {
  return (
    <AppShell>
      <Topbar title="E-Commerce Ops" subtitle="Module Disabled" />
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
// import { ShoppingBag, Clock, RotateCcw, AlertTriangle, Package, Plus, Search, RefreshCw, CheckCircle, Upload } from 'lucide-react';
// import { KpiCard, Badge, Button, Modal, PageLoader, EmptyState } from '@/components/ui';
// import { formatCurrency } from '@/lib/utils';
// import PermissionGate from '@/components/auth/PermissionGate';
// import api from '@/lib/api';
// 
// export default function EcommerceOpsPage() {
//   const [activeTab, setActiveTab] = useState<'cutoff' | 'returns' | 'claims' | 'fba'>('cutoff');
//   const [cutoffData, setCutoffData] = useState<any>(null);
//   const [returns, setReturns] = useState<any[]>([]);
//   const [fbaShipments, setFbaShipments] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
// 
//   const [returnForm, setReturnForm] = useState({
//     marketplace: 'amazon',
//     return_order_number: '',
//     product_sku: '',
//     product_name: '',
//     quantity: 1,
//     reason: 'Customer cancelled during transit',
//     customer_calling_status: 'customer_satisfied_resolved',
//     product_condition: 'good_usable',
//     claim_type: 'none',
//     notes: '',
//   });
// 
//   const fetchData = () => {
//     setLoading(true);
//     if (activeTab === 'cutoff') {
//       api.get('/ecommerce-ops/cutoff-orders')
//         .then(res => {
//           if (res.data?.data) setCutoffData(res.data.data);
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else if (activeTab === 'returns' || activeTab === 'claims') {
//       api.get('/ecommerce-ops/returns')
//         .then(res => {
//           if (res.data?.data?.returns) setReturns(res.data.data.returns);
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else {
//       api.get('/ecommerce-ops/fba-shipments')
//         .then(res => {
//           if (res.data?.data?.fbaShipments) setFbaShipments(res.data.data.fbaShipments);
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
//   const handlePutaway = async (id: string, oms_guru_putaway: boolean) => {
//     try {
//       await api.put(`/ecommerce-ops/returns/${id}/putaway`, { oms_guru_putaway });
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Putaway update failed');
//     }
//   };
// 
//   const handleSaveReturn = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       await api.post('/ecommerce-ops/returns', returnForm);
//       setIsReturnModalOpen(false);
//       setReturnForm({
//         marketplace: 'amazon',
//         return_order_number: '',
//         product_sku: '',
//         product_name: '',
//         quantity: 1,
//         reason: 'Customer cancelled during transit',
//         customer_calling_status: 'customer_satisfied_resolved',
//         product_condition: 'good_usable',
//         claim_type: 'none',
//         notes: '',
//       });
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to save return package');
//     } finally {
//       setSubmitting(false);
//     }
//   };
// 
//   return (
//     <AppShell>
//       <Topbar title="E-Commerce Operations Center" subtitle="Channel order processing (1:20 PM cutoff), Amazon returns entry, OMS putaway & 60-day claims" />
//       <main className="flex-1 overflow-y-auto p-6 space-y-6">
//         {/* Mandate Notice */}
//         <div className="card p-4 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-white border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
//           <div className="flex items-center gap-3">
//             <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
//               <Clock size={20} />
//             </div>
//             <div>
//               <h3 className="text-sm font-bold text-navy">Priya&apos;s 1:20 PM Cutoff & 1:59 PM Screenshot Mandate</h3>
//               <p className="text-xs text-muted mt-0.5">
//                 Orders received before 1:20 PM must be packed and manifested immediately. Morning & 1:59 PM screenshot submission required.
//               </p>
//             </div>
//           </div>
//           <div className="flex items-center gap-2">
//             <Badge colour={cutoffData?.timing?.isPastCutoff ? 'red' : 'green'}>
//               {cutoffData?.timing?.isPastCutoff ? 'Past 1:20 PM Cutoff' : 'Processing Window Open'}
//             </Badge>
//           </div>
//         </div>
// 
//         {/* Tab Strip */}
//         <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
//           <div className="flex items-center gap-1.5 overflow-x-auto">
//             <button
//               onClick={() => setActiveTab('cutoff')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'cutoff' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               1:20 PM Cutoff Orders
//             </button>
//             <button
//               onClick={() => setActiveTab('returns')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'returns' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Amazon Returns & Putaway
//             </button>
//             <button
//               onClick={() => setActiveTab('claims')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'claims' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               60-Day Channel Claims
//             </button>
//             <button
//               onClick={() => setActiveTab('fba')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'fba' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               FBA Shipments & FC Files
//             </button>
//           </div>
// 
//           <div className="flex items-center gap-2">
//             <Button variant="secondary" size="sm" onClick={fetchData}>
//               <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
//             </Button>
//             {activeTab === 'returns' && (
//               <PermissionGate permission="ecommerce:returns">
//                 <Button variant="primary" size="sm" onClick={() => setIsReturnModalOpen(true)}>
//                   <Plus size={14} className="mr-1.5" />
//                   <span>Log Amazon Return</span>
//                 </Button>
//               </PermissionGate>
//             )}
//           </div>
//         </div>
// 
//         {/* Content Render Based on Tab */}
//         <div className="card overflow-hidden">
//           {loading ? (
//             <div className="p-12"><PageLoader /></div>
//           ) : activeTab === 'cutoff' ? (
//             // Cutoff Orders Table
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Order ID</th>
//                     <th className="py-3 px-4">Channel</th>
//                     <th className="py-3 px-4">Customer</th>
//                     <th className="py-3 px-4">Amount</th>
//                     <th className="py-3 px-4">Payment</th>
//                     <th className="py-3 px-4">Cutoff Status</th>
//                     <th className="py-3 px-4 text-right">Fulfillment Action</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {cutoffData?.orders?.length === 0 ? (
//                     <tr>
//                       <td colSpan={7} className="py-8 text-center text-slate-400">
//                         All channel orders processed! Zero pending unmanifested parcels.
//                       </td>
//                     </tr>
//                   ) : (
//                     cutoffData?.orders?.map((o: any) => (
//                       <tr key={o.id} className="hover:bg-slate-50/80">
//                         <td className="py-3 px-4 font-mono font-bold text-slate-900">{o.order_number}</td>
//                         <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{o.channel || 'Amazon'}</td>
//                         <td className="py-3 px-4 text-slate-800">{o.customer?.name || 'Customer'}</td>
//                         <td className="py-3 px-4 font-bold text-slate-900">{formatCurrency(o.total_amount || 0)}</td>
//                         <td className="py-3 px-4 uppercase text-[10px] font-semibold text-slate-600">{o.payment_type || 'Prepaid'}</td>
//                         <td className="py-3 px-4">
//                           <Badge colour="amber">Awaiting Manifest</Badge>
//                         </td>
//                         <td className="py-3 px-4 text-right">
//                           <button className="px-2.5 py-1 bg-amber text-navy font-bold rounded text-xs hover:bg-amber-400">
//                             Print Label & Manifest
//                           </button>
//                         </td>
//                       </tr>
//                     ))
//                   )}
//                 </tbody>
//               </table>
//             </div>
//           ) : activeTab === 'returns' ? (
//             // Amazon Returns Desk
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Return Order #</th>
//                     <th className="py-3 px-4">SKU & Item</th>
//                     <th className="py-3 px-4">Condition</th>
//                     <th className="py-3 px-4">Calling Status</th>
//                     <th className="py-3 px-4">OMS Putaway</th>
//                     <th className="py-3 px-4 text-right">Putaway Action</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {returns.map(r => (
//                     <tr key={r.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.return_order_number}</td>
//                       <td className="py-3 px-4">
//                         <div className="font-semibold text-slate-900">{r.product_name}</div>
//                         <div className="text-[11px] font-mono text-slate-500">{r.product_sku} (Qty: {r.quantity})</div>
//                       </td>
//                       <td className="py-3 px-4">
//                         <Badge colour={r.product_condition === 'good_usable' ? 'green' : 'red'}>
//                           {r.product_condition.replace(/_/g, ' ')}
//                         </Badge>
//                       </td>
//                       <td className="py-3 px-4 text-slate-600">{r.customer_calling_status.replace(/_/g, ' ')}</td>
//                       <td className="py-3 px-4">
//                         <Badge colour={r.oms_guru_putaway ? 'green' : 'amber'}>
//                           {r.oms_guru_putaway ? 'Putaway Done' : 'Pending Putaway'}
//                         </Badge>
//                       </td>
//                       <td className="py-3 px-4 text-right">
//                         {!r.oms_guru_putaway && (
//                           <button
//                             onClick={() => handlePutaway(r.id, true)}
//                             className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-semibold"
//                           >
//                             Mark Putaway Done
//                           </button>
//                         )}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : activeTab === 'claims' ? (
//             // 60-Day Claims Table
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Return Order #</th>
//                     <th className="py-3 px-4">SKU</th>
//                     <th className="py-3 px-4">Claim Type</th>
//                     <th className="py-3 px-4">Claim Amount</th>
//                     <th className="py-3 px-4">Status</th>
//                     <th className="py-3 px-4">Handled By</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {returns.filter(r => r.claim_type !== 'none').map(r => (
//                     <tr key={r.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-mono font-bold text-slate-800">{r.return_order_number}</td>
//                       <td className="py-3 px-4 font-mono text-slate-700">{r.product_sku}</td>
//                       <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">{r.claim_type.replace(/_/g, ' ')}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatCurrency(r.claim_amount || 0)}</td>
//                       <td className="py-3 px-4">
//                         <Badge colour={r.claim_status === 'approved' ? 'green' : r.claim_status === 'submitted' ? 'blue' : 'amber'}>
//                           {r.claim_status}
//                         </Badge>
//                       </td>
//                       <td className="py-3 px-4 text-slate-600">{r.handler?.name || 'Shruti'}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : (
//             // FBA Shipments Table
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Shipment ID</th>
//                     <th className="py-3 px-4">Destination FC</th>
//                     <th className="py-3 px-4">Shipment Name</th>
//                     <th className="py-3 px-4">Units Planned</th>
//                     <th className="py-3 px-4">Units Packed</th>
//                     <th className="py-3 px-4">Status</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {fbaShipments.map(s => (
//                     <tr key={s.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-mono font-bold text-slate-800">{s.id}</td>
//                       <td className="py-3 px-4 font-bold text-navy">{s.fcCode}</td>
//                       <td className="py-3 px-4 font-medium text-slate-800">{s.shipmentName}</td>
//                       <td className="py-3 px-4 font-mono">{s.unitsPlanned}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-emerald-700">{s.unitsPacked}</td>
//                       <td className="py-3 px-4">
//                         <Badge colour={s.status === 'ready_for_dispatch' ? 'green' : 'amber'}>
//                           {s.status.replace(/_/g, ' ')}
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
//         {/* Log Return Modal */}
//         <Modal isOpen={isReturnModalOpen} onClose={() => setIsReturnModalOpen(false)} title="Log Amazon Return Package">
//           <form onSubmit={handleSaveReturn} className="space-y-4 text-xs">
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Return Order Number *</label>
//                 <input
//                   type="text"
//                   required
//                   value={returnForm.return_order_number}
//                   onChange={e => setReturnForm({ ...returnForm, return_order_number: e.target.value })}
//                   placeholder="e.g. AMZ-RET-402-9918231"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Marketplace</label>
//                 <select
//                   value={returnForm.marketplace}
//                   onChange={e => setReturnForm({ ...returnForm, marketplace: e.target.value })}
//                   className="form-select w-full"
//                 >
//                   <option value="amazon">Amazon</option>
//                   <option value="flipkart">Flipkart</option>
//                   <option value="meesho">Meesho</option>
//                   <option value="direct">Direct Website</option>
//                 </select>
//               </div>
//             </div>
// 
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Product SKU *</label>
//                 <input
//                   type="text"
//                   required
//                   value={returnForm.product_sku}
//                   onChange={e => setReturnForm({ ...returnForm, product_sku: e.target.value })}
//                   placeholder="e.g. PUR-AKUA-COP"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Quantity</label>
//                 <input
//                   type="number"
//                   value={returnForm.quantity}
//                   onChange={e => setReturnForm({ ...returnForm, quantity: parseInt(e.target.value, 10) || 1 })}
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//             </div>
// 
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Product Name *</label>
//               <input
//                 type="text"
//                 required
//                 value={returnForm.product_name}
//                 onChange={e => setReturnForm({ ...returnForm, product_name: e.target.value })}
//                 placeholder="e.g. AkuaBeat Copper Alkaline RO Water Purifier"
//                 className="w-full border border-slate-200 rounded-lg p-2"
//               />
//             </div>
// 
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Product Physical Condition</label>
//                 <select
//                   value={returnForm.product_condition}
//                   onChange={e => setReturnForm({ ...returnForm, product_condition: e.target.value })}
//                   className="form-select w-full"
//                 >
//                   <option value="good_usable">Good / Restockable Inventory</option>
//                   <option value="damaged_scrap">Damaged / Scrap Box</option>
//                   <option value="incorrect_product_received">Incorrect Product Received (Fraud)</option>
//                   <option value="pending_inspection">Pending QC Inspection</option>
//                 </select>
//               </div>
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Customer Calling Status</label>
//                 <select
//                   value={returnForm.customer_calling_status}
//                   onChange={e => setReturnForm({ ...returnForm, customer_calling_status: e.target.value })}
//                   className="form-select w-full"
//                 >
//                   <option value="customer_satisfied_resolved">Customer Satisfied / Resolved</option>
//                   <option value="return_mandatory">Return Mandatory / Defective</option>
//                   <option value="pending_call">Pending Call</option>
//                   <option value="unreachable">Unreachable / Invalid Phone</option>
//                 </select>
//               </div>
//             </div>
// 
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Claim Type</label>
//               <select
//                 value={returnForm.claim_type}
//                 onChange={e => setReturnForm({ ...returnForm, claim_type: e.target.value })}
//                 className="form-select w-full"
//               >
//                 <option value="none">No Claim Required</option>
//                 <option value="channel_damage_claim">Channel Courier Damage Claim</option>
//                 <option value="60_day_return_claim">60-Day Safe-T Reimbursement Claim</option>
//                 <option value="wrong_product_claim">Wrong Item Received Claim</option>
//               </select>
//             </div>
// 
//             <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
//               <Button type="button" variant="secondary" size="sm" onClick={() => setIsReturnModalOpen(false)}>Cancel</Button>
//               <Button type="submit" variant="primary" size="sm" disabled={submitting}>
//                 {submitting ? 'Saving...' : 'Save Return Package'}
//               </Button>
//             </div>
//           </form>
//         </Modal>
//       </main>
//     </AppShell>
//   );
// }
// 
