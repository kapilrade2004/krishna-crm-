import React from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';

export default function DeactivatedPage() {
  return (
    <AppShell>
      <Topbar title="SPN & Ads Optimizer" subtitle="Module Disabled" />
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
// import { TrendingUp, IndianRupee, Zap, Target, Search, Plus, RefreshCw, ArrowRight, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
// import { KpiCard, Badge, Button, Modal, PageLoader, EmptyState } from '@/components/ui';
// import { formatCurrency } from '@/lib/utils';
// import PermissionGate from '@/components/auth/PermissionGate';
// import api from '@/lib/api';
// 
// export default function MarketingPage() {
//   const [activeTab, setActiveTab] = useState<'campaigns' | 'keywords' | 'negatives' | 'bottom10' | 'research'>('campaigns');
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [keywords, setKeywords] = useState<any[]>([]);
//   const [bottom10, setBottom10] = useState<any[]>([]);
//   const [overview, setOverview] = useState<any>({ totalSpend: 0, totalSales: 0, blendedRoas: 0, blendedAcos: 0 });
//   const [loading, setLoading] = useState(true);
// 
//   const fetchData = () => {
//     setLoading(true);
//     if (activeTab === 'campaigns') {
//       api.get('/spn-ads/campaigns')
//         .then(res => {
//           if (res.data?.data) {
//             setCampaigns(res.data.data.campaigns || []);
//             if (res.data.data.overview) setOverview(res.data.data.overview);
//           }
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else if (activeTab === 'keywords') {
//       api.get('/spn-ads/keywords?is_negative=false')
//         .then(res => {
//           if (res.data?.data?.keywords) setKeywords(res.data.data.keywords);
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else if (activeTab === 'negatives') {
//       api.get('/spn-ads/keywords?is_negative=true')
//         .then(res => {
//           if (res.data?.data?.keywords) setKeywords(res.data.data.keywords);
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else if (activeTab === 'bottom10') {
//       api.get('/spn-ads/bottom-10-skus')
//         .then(res => {
//           if (res.data?.data?.skus) setBottom10(res.data.data.skus);
//         })
//         .catch(() => {})
//         .finally(() => setLoading(false));
//     } else {
//       setLoading(false);
//     }
//   };
// 
//   useEffect(() => {
//     fetchData();
//   }, [activeTab]);
// 
//   const handleMigrateAuto = async (id: string) => {
//     try {
//       await api.put(`/spn-ads/keywords/${id}/migrate-auto`);
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to migrate keyword');
//     }
//   };
// 
//   const handleAddNegative = async (id: string) => {
//     try {
//       await api.put(`/spn-ads/keywords/${id}/negative`);
//       fetchData();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to flag negative keyword');
//     }
//   };
// 
//   return (
//     <AppShell>
//       <Topbar title="SPN & Advertising Growth Center" subtitle="PPC bid optimization, Auto-to-Exact keyword migrations & bottom 10 SKUs turnaround" />
//       <main className="flex-1 overflow-y-auto p-6 space-y-6">
//         {/* KPI Deck */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//           <KpiCard label="Total PPC Ad Spend" value={formatCurrency(overview.totalSpend)} icon={IndianRupee} subtext="Amazon & Flipkart ads" />
//           <KpiCard label="Ad Generated Sales" value={formatCurrency(overview.totalSales)} icon={TrendingUp} subtext="Attributed order revenue" />
//           <KpiCard label="Blended ROAS" value={`${overview.blendedRoas}x`} icon={Zap} subtext="Target: > 3.8x ROAS" />
//           <KpiCard label="Blended ACOS" value={`${overview.blendedAcos}%`} icon={Target} subtext="Target: < 25% ACOS" />
//         </div>
// 
//         {/* Tab Navigation */}
//         <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
//           <div className="flex items-center gap-1.5 overflow-x-auto">
//             <button
//               onClick={() => setActiveTab('campaigns')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'campaigns' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               PPC Campaigns
//             </button>
//             <button
//               onClick={() => setActiveTab('keywords')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'keywords' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Keywords & Bid Optimizer
//             </button>
//             <button
//               onClick={() => setActiveTab('negatives')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'negatives' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Negative Keyword Targeting
//             </button>
//             <button
//               onClick={() => setActiveTab('bottom10')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'bottom10' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Bottom 10 SKUs Action Plan
//             </button>
//             <button
//               onClick={() => setActiveTab('research')}
//               className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
//                 activeTab === 'research' ? 'bg-amber text-navy' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
//               }`}
//             >
//               Product & Competitor Research
//             </button>
//           </div>
// 
//           <Button variant="secondary" size="sm" onClick={fetchData}>
//             <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
//           </Button>
//         </div>
// 
//         {/* Content Tabs */}
//         <div className="card overflow-hidden">
//           {loading ? (
//             <div className="p-12"><PageLoader /></div>
//           ) : activeTab === 'campaigns' ? (
//             // Campaigns Table
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Campaign Name</th>
//                     <th className="py-3 px-4">Marketplace</th>
//                     <th className="py-3 px-4">Type</th>
//                     <th className="py-3 px-4">Daily Budget</th>
//                     <th className="py-3 px-4">Spend</th>
//                     <th className="py-3 px-4">Sales</th>
//                     <th className="py-3 px-4">ROAS</th>
//                     <th className="py-3 px-4">ACOS</th>
//                     <th className="py-3 px-4">Status</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {campaigns.map(c => (
//                     <tr key={c.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-semibold text-slate-900">{c.campaign_name}</td>
//                       <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{c.marketplace}</td>
//                       <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">{c.campaign_type}</td>
//                       <td className="py-3 px-4 font-mono font-medium">{formatCurrency(c.budget_daily)}</td>
//                       <td className="py-3 px-4 font-mono font-medium text-slate-800">{formatCurrency(c.spend)}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-emerald-700">{formatCurrency(c.sales)}</td>
//                       <td className="py-3 px-4 font-bold text-navy">{c.roas}x</td>
//                       <td className="py-3 px-4 font-medium text-slate-700">{c.acos_percent}%</td>
//                       <td className="py-3 px-4">
//                         <Badge colour={c.status === 'active' ? 'green' : 'amber'}>{c.status}</Badge>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : activeTab === 'keywords' || activeTab === 'negatives' ? (
//             // Keywords Table
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Search Keyword</th>
//                     <th className="py-3 px-4">Campaign</th>
//                     <th className="py-3 px-4">Match</th>
//                     <th className="py-3 px-4">Current Bid</th>
//                     <th className="py-3 px-4">Suggested Bid</th>
//                     <th className="py-3 px-4">Spend</th>
//                     <th className="py-3 px-4">Sales</th>
//                     <th className="py-3 px-4">Conversion Rate</th>
//                     <th className="py-3 px-4 text-right">Optimization Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {keywords.map(kw => (
//                     <tr key={kw.id} className="hover:bg-slate-50/80">
//                       <td className="py-3 px-4 font-semibold text-slate-900">{kw.keyword}</td>
//                       <td className="py-3 px-4 text-slate-600">{kw.campaign_name}</td>
//                       <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-500">{kw.match_type}</td>
//                       <td className="py-3 px-4 font-mono">₹{kw.current_bid}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-navy">₹{kw.suggested_bid}</td>
//                       <td className="py-3 px-4 font-mono">{formatCurrency(kw.spend)}</td>
//                       <td className="py-3 px-4 font-mono font-bold text-emerald-700">{formatCurrency(kw.sales)}</td>
//                       <td className="py-3 px-4 font-medium">{kw.conversion_rate}%</td>
//                       <td className="py-3 px-4 text-right">
//                         <div className="flex justify-end gap-1.5">
//                           {!kw.is_migrated_from_auto && !kw.is_negative && (
//                             <button
//                               onClick={() => handleMigrateAuto(kw.id)}
//                               className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[11px] font-semibold"
//                             >
//                               Auto to Exact
//                             </button>
//                           )}
//                           {!kw.is_negative && (
//                             <button
//                               onClick={() => handleAddNegative(kw.id)}
//                               className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded text-[11px] font-semibold"
//                             >
//                               Flag Negative
//                             </button>
//                           )}
//                         </div>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           ) : activeTab === 'bottom10' ? (
//             // Bottom 10 SKUs
//             <div className="p-6 space-y-4">
//               <h3 className="text-sm font-bold text-navy">Bottom 10 Catalog SKUs Requiring Traffic & Conversion Turnaround</h3>
//               <div className="space-y-3">
//                 {bottom10.map((item, idx) => (
//                   <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
//                     <div className="flex items-start gap-3">
//                       <span className="w-7 h-7 rounded-full bg-amber text-navy font-extrabold text-xs flex items-center justify-center flex-shrink-0">
//                         {idx + 1}
//                       </span>
//                       <div>
//                         <div className="flex items-center gap-2">
//                           <span className="font-mono text-xs font-bold text-slate-800">{item.sku}</span>
//                           <span className="text-xs font-semibold text-slate-700">{item.name}</span>
//                         </div>
//                         <p className="text-xs text-amber-800 font-medium mt-1">Recommended Action: {item.action}</p>
//                       </div>
//                     </div>
//                     <div className="flex items-center gap-4 text-xs font-mono font-medium text-slate-600">
//                       <span>{item.impressions} Impr.</span>
//                       <span>{item.clicks} Clicks</span>
//                       <span className="font-bold text-slate-900">{item.orders} Orders</span>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           ) : (
//             // Research Radar
//             <div className="p-6 space-y-4">
//               <h3 className="text-sm font-bold text-navy">Product Opportunity & Competitor Radar</h3>
//               <p className="text-xs text-muted">Weekly product research, pricing gap analysis, and demand trends.</p>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
//                   <h4 className="font-bold text-xs text-slate-800">Alkaline Water Stick for Travel Bottles</h4>
//                   <p className="text-[11px] text-slate-600 mt-1">Competitor selling at ₹499 with 4,200 monthly orders. Opportunity to launch AkuaBeat mineral stick at ₹399 with 52% gross margin.</p>
//                 </div>
//                 <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
//                   <h4 className="font-bold text-xs text-slate-800">Smart TDS Meter with Bluetooth App</h4>
//                   <p className="text-[11px] text-slate-600 mt-1">High search volume surge (+140% YoY). Bundle opportunity with high-end copper alkaline purifier models.</p>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </main>
//     </AppShell>
//   );
// }
// 
