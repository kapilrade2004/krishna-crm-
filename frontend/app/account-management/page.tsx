import React from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';

export default function DeactivatedPage() {
  return (
    <AppShell>
      <Topbar title="Account Management" subtitle="Module Disabled" />
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
// import { Briefcase, ShieldCheck, AlertTriangle, TrendingUp, IndianRupee, Tag, CheckCircle, RefreshCw, Package, RotateCcw } from 'lucide-react';
// import { KpiCard, Badge, Button, PageLoader, Modal } from '@/components/ui';
// import { formatCurrency } from '@/lib/utils';
// import { useAuthStore } from '@/lib/auth';
// import toast from 'react-hot-toast';
// import api from '@/lib/api';
// 
// export default function AccountManagementPage() {
//   const { user: currentUser } = useAuthStore();
//   const isSuperAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
// 
//   const [activeTab, setActiveTab] = useState<'health' | 'promotions' | 'profitability' | 'fba'>('health');
//   const [healthData, setHealthData] = useState<any>(null);
//   const [promotions, setPromotions] = useState<any[]>([]);
//   const [profitability, setProfitability] = useState<any>(null);
//   const [fbaData, setFbaData] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
// 
//   // Reset Department State
//   const [resetModal, setResetModal] = useState(false);
//   const [resetting, setResetting] = useState(false);
// 
//   const fetchData = () => {
//     setLoading(true);
//     Promise.all([
//       api.get('/account-management/health'),
//       api.get('/account-management/promotions'),
//       api.get('/account-management/profitability'),
//       api.get('/account-management/fba-oms'),
//     ])
//       .then(([healthRes, promoRes, profitRes, fbaRes]) => {
//         if (healthRes.data?.data) setHealthData(healthRes.data.data);
//         if (promoRes.data?.data?.promotions) setPromotions(promoRes.data.data.promotions);
//         if (profitRes.data?.data) setProfitability(profitRes.data.data);
//         if (fbaRes.data?.data) setFbaData(fbaRes.data.data);
//       })
//       .catch(() => {})
//       .finally(() => setLoading(false));
//   };
// 
//   const handleResetDepartment = async () => {
//     setResetting(true);
//     try {
//       await api.post('/account-management/reset');
//       toast.success('Account department data reset to clean slate.');
//       setResetModal(false);
//       fetchData();
//     } catch (err: any) {
//       toast.error(err.response?.data?.message || 'Failed to reset department.');
//     } finally {
//       setResetting(false);
//     }
//   };
// 
//   useEffect(() => {
//     fetchData();
//   }, []);
// 
//   const totalRev = profitability?.summary?.totalRevenue !== undefined ? profitability.summary.totalRevenue : 1770000;
//   const netMargin = profitability?.summary?.overallMarginPercent !== undefined ? profitability.summary.overallMarginPercent : 27.4;
//   const totalProfitVal = profitability?.summary?.totalProfit !== undefined ? profitability.summary.totalProfit : 484400;
//   const healthScore = healthData?.overallHealthScore !== undefined ? healthData.overallHealthScore : 98;
//   const suppressedCount = healthData?.suppressedItems !== undefined ? healthData.suppressedItems.length : 3;
// 
//   return (
//     <AppShell>
//       <Topbar title="Senior Account Management" subtitle="E-Commerce marketplace account health, promotions, FBA reports & account-wise net margins" />
//       <main className="flex-1 overflow-y-auto p-6 space-y-6">
//         {/* KPI Deck */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//           <KpiCard label="Account Health Score" value={`${healthScore}%`} icon={ShieldCheck} subtext="ODR, VTR & LSR compliant" />
//           <KpiCard label="Total Gross Revenue" value={formatCurrency(totalRev)} icon={IndianRupee} subtext="All marketplace accounts" />
//           <KpiCard label="Blended Net Margin" value={`${netMargin}%`} icon={TrendingUp} subtext={formatCurrency(totalProfitVal) + ' Net Profit'} />
//           <KpiCard label="Suppressed Listings" value={suppressedCount} icon={AlertTriangle} subtext="Requires image / brand doc fixes" />
//         </div>
// 
//         {/* Tab Strip */}
//         <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
//           <div className="flex items-center gap-1.5 overflow-x-auto">
//             <button
//               onClick={() => setActiveTab('health')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'health' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Account Health & Compliance
//             </button>
//             <button
//               onClick={() => setActiveTab('promotions')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'promotions' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Coupons & BXGY Deals
//             </button>
//             <button
//               onClick={() => setActiveTab('profitability')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'profitability' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Profitability Matrix
//             </button>
//             <button
//               onClick={() => setActiveTab('fba')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'fba' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               FBA Discrepancies & OMS Guru
//             </button>
//           </div>
// 
//           <div className="flex items-center gap-2">
//             {isSuperAdmin && (
//               <Button
//                 variant="danger"
//                 size="sm"
//                 className="text-xs flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
//                 onClick={() => setResetModal(true)}
//                 title="Reset Department Data (Super Admin Only)"
//               >
//                 <RotateCcw size={13} /> Reset Department
//               </Button>
//             )}
//             <Button variant="secondary" size="sm" onClick={fetchData}>
//               <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
//             </Button>
//           </div>
//         </div>
// 
//         {/* Content Render Based on Tab */}
//         <div className="card overflow-hidden">
//           {loading ? (
//             <div className="p-12"><PageLoader /></div>
//           ) : activeTab === 'health' ? (
//             // Account Health Tab
//             <div className="p-6 space-y-6">
//               <div className="space-y-3">
//                 <h3 className="text-sm font-bold text-navy">Marketplace Policy Health & Fulfillment Metrics</h3>
//                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//                   {healthData?.marketplaces?.map((m: any, i: number) => (
//                     <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
//                       <div className="font-bold text-xs text-slate-800">{m.name}</div>
//                       <div className="text-[11px] text-slate-600 flex justify-between">
//                         <span>Valid Tracking (VTR):</span>
//                         <span className="font-bold text-emerald-700">{m.vtr}%</span>
//                       </div>
//                       <div className="text-[11px] text-slate-600 flex justify-between">
//                         <span>Late Dispatch (LSR):</span>
//                         <span className="font-bold text-slate-800">{m.lsr}%</span>
//                       </div>
//                       <div className="text-[11px] text-slate-600 flex justify-between">
//                         <span>Safety Stock Risks:</span>
//                         <span className="font-bold text-amber">{m.safetyStockRiskCount} SKUs</span>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
// 
//               {/* Suppressed Listings Table */}
//               <div className="space-y-3">
//                 <h3 className="text-sm font-bold text-navy">Suppressed Catalog Listings (Action Required)</h3>
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-xs text-left">
//                     <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                       <tr>
//                         <th className="py-2.5 px-3">SKU</th>
//                         <th className="py-2.5 px-3">Product Title</th>
//                         <th className="py-2.5 px-3">Marketplace</th>
//                         <th className="py-2.5 px-3">Suppression Reason & Action</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-slate-100">
//                       {healthData?.suppressedItems?.map((item: any, idx: number) => (
//                         <tr key={idx} className="hover:bg-slate-50/80">
//                           <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{item.sku}</td>
//                           <td className="py-2.5 px-3 font-medium text-slate-800">{item.title}</td>
//                           <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-500">{item.marketplace}</td>
//                           <td className="py-2.5 px-3 text-red-600 font-medium">{item.issue}</td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             </div>
//           ) : activeTab === 'promotions' ? (
//             // Promotions & BXGY Tab
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Deal / Promotion Name</th>
//                     <th className="py-3 px-4">Type</th>
//                     <th className="py-3 px-4">Discount Offered</th>
//                     <th className="py-3 px-4">Marketplace</th>
//                     <th className="py-3 px-4">Budget</th>
//                     <th className="py-3 px-4">Spent</th>
//                     <th className="py-3 px-4">Status</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {promotions.map(p => (
//                     <tr key={p.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
//                       <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">{p.type}</td>
//                       <td className="py-3 px-4 font-bold text-emerald-700">{p.discount}</td>
//                       <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{p.marketplace}</td>
//                       <td className="py-3 px-4 font-mono">{formatCurrency(p.budget)}</td>
//                       <td className="py-3 px-4 font-mono font-medium text-slate-800">{formatCurrency(p.spend)}</td>
//                       <td className="py-3 px-4">
//                         <Badge colour={p.status === 'active' ? 'green' : 'amber'}>{p.status}</Badge>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : activeTab === 'profitability' ? (
//             // Profitability Matrix Tab
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Marketplace Channel</th>
//                     <th className="py-3 px-4">Gross Sales</th>
//                     <th className="py-3 px-4">Product Cost</th>
//                     <th className="py-3 px-4">Channel Fees</th>
//                     <th className="py-3 px-4">PPC Ad Spend</th>
//                     <th className="py-3 px-4">Net Profit</th>
//                     <th className="py-3 px-4 text-right">Net Margin %</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {profitability?.accounts?.map((acc: any, idx: number) => (
//                     <tr key={idx} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-semibold text-slate-900">{acc.account}</td>
//                       <td className="py-3 px-4 font-mono">{formatCurrency(acc.grossRevenue)}</td>
//                       <td className="py-3 px-4 font-mono text-slate-600">-{formatCurrency(acc.productCost)}</td>
//                       <td className="py-3 px-4 font-mono text-slate-500">-{formatCurrency(acc.channelFees)}</td>
//                       <td className="py-3 px-4 font-mono text-red-600">-{formatCurrency(acc.adSpend)}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-emerald-700">{formatCurrency(acc.netProfit)}</td>
//                       <td className="py-3 px-4 text-right">
//                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
//                           {acc.netMarginPercent}%
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : (
//             // FBA & OMS Guru Tab
//             <div className="p-6 space-y-6">
//               <div className="space-y-3">
//                 <h3 className="text-sm font-bold text-navy">FBA Inbound Shipments & Shortage Discrepancy Tracking</h3>
//                 <div className="overflow-x-auto">
//                   <table className="w-full text-xs text-left">
//                     <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                       <tr>
//                         <th className="py-2.5 px-3">Shipment ID</th>
//                         <th className="py-2.5 px-3">Fulfillment Center (FC)</th>
//                         <th className="py-2.5 px-3">Sent Qty</th>
//                         <th className="py-2.5 px-3">Received Qty</th>
//                         <th className="py-2.5 px-3">Discrepancy</th>
//                         <th className="py-2.5 px-3">Status</th>
//                       </tr>
//                     </thead>
//                     <tbody className="divide-y divide-slate-100">
//                       {fbaData?.fbaInboundShipments?.map((s: any, i: number) => (
//                         <tr key={i} className="hover:bg-slate-50/80">
//                           <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{s.shipmentId}</td>
//                           <td className="py-2.5 px-3 font-semibold text-slate-700">{s.fc}</td>
//                           <td className="py-2.5 px-3 font-mono">{s.sentQty}</td>
//                           <td className="py-2.5 px-3 font-mono">{s.receivedQty}</td>
//                           <td className="py-2.5 px-3 font-mono font-bold text-red-600">{s.discrepancy}</td>
//                           <td className="py-2.5 px-3">
//                             <Badge colour={s.discrepancy === 0 ? 'green' : 'amber'}>
//                               {s.status.replace(/_/g, ' ')}
//                             </Badge>
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
// 
//               <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
//                 <div>
//                   <h4 className="font-bold text-xs text-slate-800">OMS Guru Inventory Sync State</h4>
//                   <p className="text-[11px] text-slate-500 mt-0.5">
//                     Last automated sync: {fbaData?.omsGuruSync?.lastSyncTime ? new Date(fbaData.omsGuruSync.lastSyncTime).toLocaleTimeString() : 'Recent'} | {fbaData?.omsGuruSync?.syncedInventorySkus || 84} SKUs active
//                   </p>
//                 </div>
//                 <Badge colour="green">OMS Operational</Badge>
//               </div>
//             </div>
//           )}
//         </div>
//       </main>
// 
//       {/* Reset Department Confirmation Modal (Super Admin Only) */}
//       <Modal
//         open={resetModal}
//         onClose={() => !resetting && setResetModal(false)}
//         title="Reset Account Management Department"
//         size="md"
//       >
//         <div className="space-y-4">
//           <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800">
//             <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
//             <div className="text-xs space-y-1">
//               <p className="font-bold text-red-900">This action is restricted to Super Admin.</p>
//               <p>
//                 Resetting will clear out mock/legacy metrics, reset marketplace policy compliance metrics, profitability ledgers, and wipe test accounting records back to a clean zero-base slate.
//               </p>
//             </div>
//           </div>
// 
//           <div className="flex items-center justify-end gap-3 pt-2">
//             <Button
//               variant="secondary"
//               size="sm"
//               disabled={resetting}
//               onClick={() => setResetModal(false)}
//             >
//               Cancel
//             </Button>
//             <Button
//               variant="danger"
//               size="sm"
//               disabled={resetting}
//               onClick={handleResetDepartment}
//               className="bg-red-600 hover:bg-red-700 text-white"
//             >
//               {resetting ? 'Resetting...' : 'Confirm Reset Department'}
//             </Button>
//           </div>
//         </div>
//       </Modal>
//     </AppShell>
//   );
// }
// 
