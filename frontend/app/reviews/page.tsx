import React from 'react';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';

export default function ReviewsPage() {
  return (
    <AppShell>
      <Topbar title="Reviews & Ratings" subtitle="Module Disabled" />
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <h2 className="text-xl font-semibold text-gray-700">Module Deactivated</h2>
        <p className="text-sm text-gray-500 mt-2">This page and module have been commented out across the system.</p>
      </div>
    </AppShell>
  );
}


// ORIGINAL CODE COMMENTED OUT:
// import React, { useState, useEffect } from 'react';
// import AppShell from '@/components/layout/AppShell';
// import Topbar from '@/components/layout/Topbar';
// import { Star, CheckCircle, AlertTriangle, Trash2, Plus, Search, Filter, ShieldCheck, RefreshCw } from 'lucide-react';
// import { KpiCard, Badge, Button, Modal, Input, CustomSelect, PageLoader, EmptyState } from '@/components/ui';
// import PermissionGate from '@/components/auth/PermissionGate';
// import api from '@/lib/api';
// 
// function OriginalReviewsPage() {
//   const [reviews, setReviews] = useState<any[]>([]);
//   const [stats, setStats] = useState<any>({ totalReviews: 0, verifiedCount: 0, pendingCount: 0, flaggedCount: 0, auditedToday: 0 });
//   const [loading, setLoading] = useState(true);
//   const [statusFilter, setStatusFilter] = useState('all');
//   const [searchQuery, setSearchQuery] = useState('');
//   const [isAddModalOpen, setIsAddModalOpen] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
// 
//   // New review form
//   const [formData, setFormData] = useState({
//     product_name: '',
//     product_sku: '',
//     marketplace: 'amazon',
//     customer_name: '',
//     customer_phone: '',
//     product_rating: 5,
//     seller_rating: 5,
//     review_title: '',
//     review_text: '',
//     notes: '',
//   });
// 
//   const fetchReviews = () => {
//     setLoading(true);
//     let url = `/reviews?status=${statusFilter}`;
//     if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
// 
//     api.get(url)
//       .then(res => {
//         if (res.data?.data) {
//           setReviews(res.data.data.reviews || []);
//           if (res.data.data.stats) setStats(res.data.data.stats);
//         }
//       })
//       .catch(() => {})
//       .finally(() => setLoading(false));
//   };
// 
//   useEffect(() => {
//     fetchReviews();
//   }, [statusFilter]);
// 
//   const handleSearch = (e: React.FormEvent) => {
//     e.preventDefault();
//     fetchReviews();
//   };
// 
//   const handleModerate = async (id: string, status: string, notes?: string) => {
//     try {
//       await api.put(`/reviews/${id}/moderate`, { status, notes });
//       fetchReviews();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to update review status');
//     }
//   };
// 
//   const handleDelete = async (id: string) => {
//     if (!confirm('Are you sure you want to delete this invalid/fraudulent review?')) return;
//     try {
//       await api.delete(`/reviews/${id}`);
//       fetchReviews();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to delete review');
//     }
//   };
// 
//   const handleCreate = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       await api.post('/reviews', formData);
//       setIsAddModalOpen(false);
//       setFormData({
//         product_name: '',
//         product_sku: '',
//         marketplace: 'amazon',
//         customer_name: '',
//         customer_phone: '',
//         product_rating: 5,
//         seller_rating: 5,
//         review_title: '',
//         review_text: '',
//         notes: '',
//       });
//       fetchReviews();
//     } catch (err: any) {
//       alert(err.response?.data?.message || 'Failed to add review');
//     } finally {
//       setSubmitting(false);
//     }
//   };
// 
//   return (
//     <AppShell>
//       <Topbar title="Reviews & Rating Compliance" subtitle="Product review auditing, customer feedback verification & daily quota" />
//       <main className="flex-1 overflow-y-auto p-6 space-y-6">
//         {/* KPI Deck */}
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
//           <KpiCard label="Total Reviews" value={stats.totalReviews} icon={Star} subtext="Tracked across channels" />
//           <KpiCard label="Verified Genuine" value={stats.verifiedCount} icon={ShieldCheck} subtext="Invoice cross-verified" />
//           <KpiCard label="Pending Audit" value={stats.pendingCount} icon={CheckCircle} subtext="Awaiting review" />
//           <KpiCard label="Flagged / Fake" value={stats.flaggedCount} icon={AlertTriangle} subtext="Competitor spam" />
//           <KpiCard label="Audited Today" value={`${stats.auditedToday} / 10`} icon={CheckCircle} subtext="Sushil's daily quota" />
//         </div>
// 
//         {/* Filter & Action Bar */}
//         <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
//           <form onSubmit={handleSearch} className="flex-1 flex gap-2">
//             <div className="relative flex-1">
//               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
//               <input
//                 type="text"
//                 value={searchQuery}
//                 onChange={e => setSearchQuery(e.target.value)}
//                 placeholder="Search by product, customer name, phone, or keyword..."
//                 className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber"
//               />
//             </div>
//             <Button type="submit" variant="secondary" size="sm">Search</Button>
//           </form>
// 
//           <div className="flex items-center gap-3">
//             <CustomSelect
//               value={statusFilter}
//               onChange={e => setStatusFilter((e.target as any).value)}
//               options={[
//                 { value: 'all', label: 'All Statuses' },
//                 { value: 'pending_verification', label: 'Pending Verification', badge: 'Review', badgeColor: 'bg-amber-100 text-amber-800' },
//                 { value: 'verified_genuine', label: 'Verified Genuine', badge: 'Approved', badgeColor: 'bg-emerald-100 text-emerald-800' },
//                 { value: 'flagged_suspicious', label: 'Flagged Suspicious', badge: 'Alert', badgeColor: 'bg-rose-100 text-rose-800' },
//               ]}
//               size="sm"
//               className="w-48"
//             />
// 
//             <Button variant="secondary" size="sm" onClick={fetchReviews}>
//               <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
//             </Button>
// 
//             <PermissionGate permission="reviews:create">
//               <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
//                 <Plus size={14} className="mr-1.5" />
//                 <span>Add Review</span>
//               </Button>
//             </PermissionGate>
//           </div>
//         </div>
// 
//         {/* Reviews Table */}
//         <div className="card overflow-hidden">
//           {loading ? (
//             <div className="p-12"><PageLoader /></div>
//           ) : reviews.length === 0 ? (
//             <div className="p-12">
//               <EmptyState
//                 icon={Star}
//                 title="No reviews found"
//                 description="Try adjusting your search or status filter to see customer ratings."
//               />
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-xs text-left">
//                 <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
//                   <tr>
//                     <th className="py-3 px-4">Product Details</th>
//                     <th className="py-3 px-4">Channel</th>
//                     <th className="py-3 px-4">Customer</th>
//                     <th className="py-3 px-4">Ratings</th>
//                     <th className="py-3 px-4">Review Content</th>
//                     <th className="py-3 px-4">Audit Status</th>
//                     <th className="py-3 px-4 text-right">Moderation Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {reviews.map(rev => (
//                     <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
//                       <td className="py-3 px-4">
//                         <div className="font-semibold text-slate-900">{rev.product_name}</div>
//                         {rev.product_sku && <div className="text-[11px] font-mono text-slate-500 mt-0.5">{rev.product_sku}</div>}
//                       </td>
//                       <td className="py-3 px-4">
//                         <span className="uppercase text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
//                           {rev.marketplace}
//                         </span>
//                       </td>
//                       <td className="py-3 px-4">
//                         <div className="font-medium text-slate-800">{rev.customer_name || 'Anonymous'}</div>
//                         {rev.customer_phone && <div className="text-[11px] text-slate-500">{rev.customer_phone}</div>}
//                       </td>
//                       <td className="py-3 px-4">
//                         <div className="flex items-center gap-1 text-amber font-bold">
//                           <span>Product: ★ {rev.product_rating || 5}</span>
//                         </div>
//                         {rev.seller_rating && (
//                           <div className="text-[10px] text-slate-500">Seller: ★ {rev.seller_rating}</div>
//                         )}
//                       </td>
//                       <td className="py-3 px-4 max-w-sm">
//                         {rev.review_title && <div className="font-semibold text-slate-800">{rev.review_title}</div>}
//                         <div className="text-slate-600 line-clamp-2 mt-0.5">{rev.review_text || 'No comments provided.'}</div>
//                       </td>
//                       <td className="py-3 px-4">
//                         <Badge
//                           colour={
//                             rev.status === 'verified_genuine'
//                               ? 'green'
//                               : rev.status === 'flagged_suspicious'
//                               ? 'red'
//                               : rev.status === 'rejected_fake'
//                               ? 'red'
//                               : 'amber'
//                           }
//                         >
//                           {rev.status.replace(/_/g, ' ')}
//                         </Badge>
//                       </td>
//                       <td className="py-3 px-4 text-right">
//                         <div className="flex items-center justify-end gap-1.5">
//                           <PermissionGate permission="reviews:verify">
//                             {rev.status !== 'verified_genuine' && (
//                               <button
//                                 onClick={() => handleModerate(rev.id, 'verified_genuine')}
//                                 className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-semibold transition"
//                                 title="Mark Verified Genuine"
//                               >
//                                 Verify
//                               </button>
//                             )}
//                             {rev.status !== 'flagged_suspicious' && (
//                               <button
//                                 onClick={() => handleModerate(rev.id, 'flagged_suspicious', 'Flagged as potential competitor spam')}
//                                 className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[11px] font-semibold transition"
//                                 title="Flag Suspicious"
//                               >
//                                 Flag
//                               </button>
//                             )}
//                           </PermissionGate>
//                           <PermissionGate permission="reviews:delete">
//                             <button
//                               onClick={() => handleDelete(rev.id)}
//                               className="p-1 text-slate-400 hover:text-red-600 rounded transition"
//                               title="Delete Review"
//                             >
//                               <Trash2 size={14} />
//                             </button>
//                           </PermissionGate>
//                         </div>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </div>
// 
//         {/* Add Review Modal */}
//         <Modal
//           isOpen={isAddModalOpen}
//           onClose={() => setIsAddModalOpen(false)}
//           title="Record Customer Review & Rating"
//         >
//           <form onSubmit={handleCreate} className="space-y-4 text-xs">
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Product Name *</label>
//               <input
//                 type="text"
//                 required
//                 value={formData.product_name}
//                 onChange={e => setFormData({ ...formData, product_name: e.target.value })}
//                 placeholder="e.g. AkuaBeat Copper Alkaline RO Water Purifier"
//                 className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-amber"
//               />
//             </div>
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Product SKU</label>
//                 <input
//                   type="text"
//                   value={formData.product_sku}
//                   onChange={e => setFormData({ ...formData, product_sku: e.target.value })}
//                   placeholder="e.g. PUR-AKUA-COP"
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//               <div>
//                 <CustomSelect
//                   label="Marketplace"
//                   value={formData.marketplace}
//                   onChange={e => setFormData({ ...formData, marketplace: (e.target as any).value })}
//                   options={[
//                     { value: 'amazon', label: 'Amazon' },
//                     { value: 'flipkart', label: 'Flipkart' },
//                     { value: 'indiamart', label: 'IndiaMART' },
//                     { value: 'website', label: 'Direct Website' },
//                   ]}
//                 />
//               </div>
//             </div>
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Customer Name</label>
//                 <input
//                   type="text"
//                   value={formData.customer_name}
//                   onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//               <div>
//                 <label className="block text-slate-700 font-semibold mb-1">Customer Phone</label>
//                 <input
//                   type="text"
//                   value={formData.customer_phone}
//                   onChange={e => setFormData({ ...formData, customer_phone: e.target.value })}
//                   className="w-full border border-slate-200 rounded-lg p-2"
//                 />
//               </div>
//             </div>
//             <div className="grid grid-cols-2 gap-3">
//               <div>
//                 <CustomSelect
//                   label="Product Star Rating (1–5)"
//                   value={String(formData.product_rating)}
//                   onChange={e => setFormData({ ...formData, product_rating: parseInt((e.target as any).value, 10) })}
//                   options={[
//                     { value: '5', label: '5 Stars ★★★★★' },
//                     { value: '4', label: '4 Stars ★★★★☆' },
//                     { value: '3', label: '3 Stars ★★★☆☆' },
//                     { value: '2', label: '2 Stars ★★☆☆☆' },
//                     { value: '1', label: '1 Star ★☆☆☆☆' },
//                   ]}
//                 />
//               </div>
//               <div>
//                 <CustomSelect
//                   label="Seller Rating (1–5)"
//                   value={String(formData.seller_rating)}
//                   onChange={e => setFormData({ ...formData, seller_rating: parseInt((e.target as any).value, 10) })}
//                   options={[
//                     { value: '5', label: '5 Stars ★★★★★' },
//                     { value: '4', label: '4 Stars ★★★★☆' },
//                     { value: '3', label: '3 Stars ★★★☆☆' },
//                     { value: '2', label: '2 Stars ★★☆☆☆' },
//                     { value: '1', label: '1 Star ★☆☆☆☆' },
//                   ]}
//                 />
//               </div>
//             </div>
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Review Title</label>
//               <input
//                 type="text"
//                 value={formData.review_title}
//                 onChange={e => setFormData({ ...formData, review_title: e.target.value })}
//                 placeholder="e.g. Excellent TDS reduction and fast installation"
//                 className="w-full border border-slate-200 rounded-lg p-2"
//               />
//             </div>
//             <div>
//               <label className="block text-slate-700 font-semibold mb-1">Customer Review Text</label>
//               <textarea
//                 rows={3}
//                 value={formData.review_text}
//                 onChange={e => setFormData({ ...formData, review_text: e.target.value })}
//                 placeholder="Paste customer comments..."
//                 className="w-full border border-slate-200 rounded-lg p-2"
//               />
//             </div>
// 
//             <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
//               <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
//               <Button type="submit" variant="primary" size="sm" disabled={submitting}>
//                 {submitting ? 'Saving...' : 'Save Review'}
//               </Button>
//             </div>
//           </form>
//         </Modal>
//       </main>
//     </AppShell>
//   );
// }
// 
