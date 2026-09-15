// import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
// import api from '@/lib/api';
// import toast from 'react-hot-toast';
// import { getErrorMessage } from '@/lib/utils';
// const onError = (err: unknown) => toast.error(getErrorMessage(err));



// // ═══════════════════════════════════════════════════════════════════════════════
// // AUTH
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useUsers = () =>
//   useQuery<User[]>({
//     queryKey: ['users'],
//     queryFn: async () => {
//       const { data } = await api.get('/auth/users');
//       return data.data.users;
//     },
//   });

// export const useCreateUser = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: { name: string; email: string; password: string; role: string; phone?: string }) =>
//       api.post('/auth/users', body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created successfully.'); },
//     onError,
//   });
// };

// export const useUpdateUser = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: { id: string; name?: string; role?: string; is_active?: boolean; phone?: string }) =>
//       api.patch(`/auth/users/${id}`, body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated.'); },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // DASHBOARD
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useDashboardKpis = () =>
//   useQuery<DashboardKpis>({
//     queryKey: ['dashboard', 'kpis'],
//     queryFn: async () => {
//       const { data } = await api.get('/dashboard/kpis');
//       return data.data.kpis;
//     },
//     refetchInterval: 60_000,
//   });

// export const useCeoView = () =>
//   useQuery({
//     queryKey: ['dashboard', 'ceo'],
//     queryFn: async () => {
//       const { data } = await api.get('/dashboard/ceo');
//       return data.data.ceoView;
//     },
//   });

// // ═══════════════════════════════════════════════════════════════════════════════
// // CUSTOMERS
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useCustomers = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['customers', params],
//     queryFn: async () => {
//       const { data } = await api.get('/customers', { params });
//       return data;
//     },
//     placeholderData: keepPreviousData,
//   });

// export const useCustomer = (id: string | null) =>
//   useQuery<Customer>({
//     queryKey: ['customer', id],
//     queryFn: async () => {
//       const { data } = await api.get(`/customers/${id}`);
//       return data.data.customer;
//     },
//     enabled: !!id,
//   });

// export const useCreateCustomer = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: Partial<Customer>) => api.post('/customers', body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer created.'); },
//     onError,
//   });
// };

// export const useUpdateCustomer = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: Partial<Customer> & { id: string }) => api.patch(`/customers/${id}`, body),
//     onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['customer', vars.id] }); qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer updated.'); },
//     onError,
//   });
// };

// export const useDeleteCustomer = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => api.delete(`/customers/${id}`),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer deleted.'); },
//     onError,
//   });
// };

// export const useToggleWhatsappOptin = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, value }: { id: string; value: boolean }) =>
//       api.patch(`/customers/${id}/whatsapp-optin`, { whatsapp_opt_in: value }),
//     onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['customer', vars.id] }); qc.invalidateQueries({ queryKey: ['customers'] }); },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // ORDERS
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useOrders = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['orders', params],
//     queryFn: async () => {
//       const { data } = await api.get('/orders', { params });
//       return data;
//     },
//     placeholderData: keepPreviousData,
//   });

// export const useOrder = (id: string | null) =>
//   useQuery<Order>({
//     queryKey: ['order', id],
//     queryFn: async () => {
//       const { data } = await api.get(`/orders/${id}`);
//       return data.data.order;
//     },
//     enabled: !!id,
//   });

// export const useOrderStats = (params?: Record<string, unknown>) =>
//   useQuery({
//     queryKey: ['orders', 'stats', params],
//     queryFn: async () => {
//       const { data } = await api.get('/orders/stats', { params });
//       return data.data.stats;
//     },
//   });

// export const useCreateOrder = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: Partial<Order>) => api.post('/orders', body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order created.'); },
//     onError,
//   });
// };

// export const useUpdateOrder = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: Partial<Order> & { id: string }) => api.patch(`/orders/${id}`, body),
//     onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['order', vars.id] }); qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order updated.'); },
//     onError,
//   });
// };

// export const useUpdateOrderStatus = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
//       api.patch(`/orders/${id}/status`, { status, note }),
//     onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['order', vars.id] }); qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Status updated.'); },
//     onError,
//   });
// };

// export const useUpdateFlowStage = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, flow_stage, note }: { id: string; flow_stage: string; note?: string }) =>
//       api.patch(`/orders/${id}/flow-stage`, { flow_stage, note }),
//     onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['order', vars.id] }); toast.success('Flow stage updated.'); },
//     onError,
//   });
// };

// export const useBulkUpdateStatus = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ order_ids, status, note }: { order_ids: string[]; status: string; note?: string }) =>
//       api.patch('/orders/bulk-status', { order_ids, status, note }),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Bulk update complete.'); },
//     onError,
//   });
// };

// export const useDeleteOrder = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => api.delete(`/orders/${id}`),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order deleted.'); },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // FOLLOW-UPS
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useFollowUps = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['follow-ups', params],
//     queryFn: async () => {
//       const { data } = await api.get('/follow-ups', { params });
//       return data;
//     },
//     placeholderData: keepPreviousData,
//   });

// export const useFollowUp = (id: string | null) =>
//   useQuery<FollowUp>({
//     queryKey: ['follow-up', id],
//     queryFn: async () => {
//       const { data } = await api.get(`/follow-ups/${id}`);
//       return data.data.followUp;
//     },
//     enabled: !!id,
//   });

// export const useCreateFollowUp = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: Partial<FollowUp>) => api.post('/follow-ups', body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Follow-up created.'); },
//     onError,
//   });
// };

// export const useUpdateFollowUp = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: Partial<FollowUp> & { id: string }) => api.patch(`/follow-ups/${id}`, body),
//     onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['follow-up', vars.id] }); qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Follow-up updated.'); },
//     onError,
//   });
// };

// export const useDeleteFollowUp = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => api.delete(`/follow-ups/${id}`),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Follow-up deleted.'); },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // TASKS
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useTasks = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['tasks', params],
//     queryFn: async () => {
//       const { data } = await api.get('/tasks', { params });
//       return data;
//     },
//     placeholderData: keepPreviousData,
//   });

// export const useTaskDashboard = (userId?: string) =>
//   useQuery({
//     queryKey: ['tasks', 'dashboard', userId],
//     queryFn: async () => {
//       const { data } = await api.get('/tasks/dashboard', { params: userId ? { user_id: userId } : {} });
//       return data.data.dashboard;
//     },
//   });

// export const useCreateTask = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: Partial<Task>) => api.post('/tasks', body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task created.'); },
//     onError,
//   });
// };

// export const useUpdateTask = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: Partial<Task> & { id: string }) => api.patch(`/tasks/${id}`, body),
//     onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task updated.'); },
//     onError,
//   });
// };

// export const useDeleteTask = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => api.delete(`/tasks/${id}`),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task deleted.'); },
//     onError,
//   });
// };

// // ── SOW §3.7 — Task Score Management ────────────────────────────────────────
// export const useSetTaskScore = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, score, score_comment }: { id: string; score: number; score_comment?: string }) =>
//       api.patch(`/tasks/${id}/score`, { score, score_comment }),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['tasks'] });
//       qc.invalidateQueries({ queryKey: ['tasks', 'score-dashboard'] });
//       toast.success('Task score saved.');
//     },
//     onError,
//   });
// };

// export const useTaskScoreDashboard = (params: Record<string, unknown> = {}) =>
//   useQuery<TaskScoreDashboard>({
//     queryKey: ['tasks', 'score-dashboard', params],
//     queryFn: async () => {
//       const { data } = await api.get('/tasks/score-dashboard', { params });
//       return data.data.scoreDashboard;
//     },
//   });

// export const useUnscoredTasks = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['tasks', 'unscored', params],
//     queryFn: async () => {
//       const { data } = await api.get('/tasks/unscored', { params });
//       return data;
//     },
//   });

// // ═══════════════════════════════════════════════════════════════════════════════
// // CSV IMPORT
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useCsvBatches = () =>
//   useQuery({
//     queryKey: ['csv-batches'],
//     queryFn: async () => {
//       const { data } = await api.get('/csv/batches');
//       return data;
//     },
//   });

// export const useCsvBatch = (id: string | null) =>
//   useQuery<CsvBatch>({
//     queryKey: ['csv-batch', id],
//     queryFn: async () => {
//       const { data } = await api.get(`/csv/batches/${id}`);
//       return data.data.batch;
//     },
//     enabled: !!id,
//     refetchInterval: (query) => {
//       const status = query.state.data?.status;
//       return status === 'processing' || status === 'uploaded' ? 2000 : false;
//     },
//   });

// export const useUploadCsv = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (formData: FormData) =>
//       api.post('/csv/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['csv-batches'] }); toast.success('File uploaded. Processing started.'); },
//     onError,
//   });
// };

// // Two-Way Delivery CSV Upload (Client Email Point 5)
// export const useUploadDeliveryCsv = () =>
//   useMutation({
//     mutationFn: (formData: FormData) =>
//       api.post('/csv/delivery-upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
//     onError,
//   });

// // ═══════════════════════════════════════════════════════════════════════════════
// // REPORTS
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useSalesReport = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['reports', 'sales', params],
//     queryFn: async () => {
//       const { data } = await api.get('/reports/sales', { params });
//       return data.data.report;
//     },
//   });

// export const useTeamReport = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['reports', 'team', params],
//     queryFn: async () => {
//       const { data } = await api.get('/reports/team', { params });
//       return data.data.report;
//     },
//   });

// export const downloadReport = async (type: 'orders' | 'customers', params: Record<string, string> = {}) => {
//   const query = new URLSearchParams(params).toString();
//   const token = localStorage.getItem('access_token');
//   const res = await fetch(
//     `${process.env.NEXT_PUBLIC_API_URL}/api/reports/export/${type}?${query}`,
//     { headers: { Authorization: `Bearer ${token}` } }
//   );
//   if (!res.ok) throw new Error('Export failed');
//   const blob = await res.blob();
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement('a');
//   a.href = url;
//   a.download = `${type}_export.csv`;
//   a.click();
//   URL.revokeObjectURL(url);
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // SHIPPING & TRACKING
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useShippingDashboard = () =>
//   useQuery<ShippingDashboard>({
//     queryKey: ['shipping', 'dashboard'],
//     queryFn: async () => {
//       const { data } = await api.get('/shipping/dashboard');
//       return data.data.dashboard;
//     },
//     refetchInterval: 60_000,
//   });

// export const useShippingPartners = (params: Record<string, unknown> = {}) =>
//   useQuery<ShippingPartner[]>({
//     queryKey: ['shipping-partners', params],
//     queryFn: async () => {
//       const { data } = await api.get('/shipping/partners', { params });
//       return data.data.partners;
//     },
//   });

// export const useShippingPartner = (id: string | null) =>
//   useQuery<ShippingPartner>({
//     queryKey: ['shipping-partner', id],
//     queryFn: async () => {
//       const { data } = await api.get(`/shipping/partners/${id}`);
//       return data.data.partner;
//     },
//     enabled: !!id,
//   });

// export const useCreateShippingPartner = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: Partial<ShippingPartner>) => api.post('/shipping/partners', body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['shipping-partners'] }); toast.success('Shipping partner created.'); },
//     onError,
//   });
// };

// export const useUpdateShippingPartner = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: Partial<ShippingPartner> & { id: string }) => api.patch(`/shipping/partners/${id}`, body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['shipping-partners'] }); toast.success('Shipping partner updated.'); },
//     onError,
//   });
// };

// export const useDeleteShippingPartner = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => api.delete(`/shipping/partners/${id}`),
//     onSuccess: (res) => {
//       qc.invalidateQueries({ queryKey: ['shipping-partners'] });
//       toast.success(res.data?.message || 'Shipping partner removed.');
//     },
//     onError,
//   });
// };

// // ── Pincode Serviceability ──────────────────────────────────────────────────────
// export const useServiceabilityList = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['serviceability', params],
//     queryFn: async () => {
//       const { data } = await api.get('/shipping/serviceability/list', { params });
//       return data;
//     },
//     placeholderData: keepPreviousData,
//   });

// export const useCheckServiceability = (pincode: string | null) =>
//   useQuery<ServiceabilityCheck>({
//     queryKey: ['serviceability-check', pincode],
//     queryFn: async () => {
//       const { data } = await api.get('/shipping/serviceability', { params: { pincode } });
//       return data.data;
//     },
//     enabled: !!pincode && pincode.length >= 4,
//   });

// export const useCreateServiceability = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: Partial<PincodeServiceability>) => api.post('/shipping/serviceability', body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Serviceability entry added.'); },
//     onError,
//   });
// };

// export const useUpdateServiceability = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: Partial<PincodeServiceability> & { id: string }) => api.patch(`/shipping/serviceability/${id}`, body),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Entry updated.'); },
//     onError,
//   });
// };

// export const useDeleteServiceability = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => api.delete(`/shipping/serviceability/${id}`),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Entry deleted.'); },
//     onError,
//   });
// };

// export const useBulkServiceability = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (entries: Record<string, unknown>[]) => api.post('/shipping/serviceability/bulk', { entries }),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Bulk upload complete.'); },
//     onError,
//   });
// };

// // ── Order Shipping Update ───────────────────────────────────────────────────────
// export const useUpdateOrderShipping = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: {
//       id: string; shipping_partner?: string; tracking_number?: string;
//       delivery_pincode?: string; estimated_delivery_date?: string;
//       mark_dispatched?: boolean;
//     }) => api.patch(`/orders/${id}/shipping`, body),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['order', vars.id] });
//       qc.invalidateQueries({ queryKey: ['orders'] });
//       qc.invalidateQueries({ queryKey: ['shipping', 'dashboard'] });
//       toast.success('Shipping details updated.');
//     },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // CR1 — Image Verification
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useOrderImages = (orderId: string | null) =>
//   useQuery<CustomerImage[]>({
//     queryKey: ['order-images', orderId],
//     queryFn: async () => {
//       const { data } = await api.get(`/orders/${orderId}/images`);
//       return data.data.images;
//     },
//     enabled: !!orderId,
//   });

// export const useApproveImages = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, note }: { id: string; note?: string }) =>
//       api.post(`/orders/${id}/approve-images`, { note }),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['order', vars.id] });
//       qc.invalidateQueries({ queryKey: ['order-images', vars.id] });
//       qc.invalidateQueries({ queryKey: ['orders'] });
//       toast.success('Images approved. Order confirmed.');
//     },
//     onError,
//   });
// };

// export const useRejectImages = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, reason, request_new }: { id: string; reason: string; request_new?: boolean }) =>
//       api.post(`/orders/${id}/reject-images`, { reason, request_new }),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['order', vars.id] });
//       qc.invalidateQueries({ queryKey: ['order-images', vars.id] });
//       toast.success('Images rejected. Customer notified.');
//     },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // CR2 — Manual Call Logs
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useCallLogs = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['call-logs', params],
//     queryFn: async () => {
//       const { data } = await api.get('/call-logs', { params });
//       return data;
//     },
//     placeholderData: keepPreviousData,
//   });

// export const useOrderCallLogs = (orderId: string | null) =>
//   useQuery({
//     queryKey: ['call-logs', 'order', orderId],
//     queryFn: async () => {
//       const { data } = await api.get(`/orders/${orderId}/call-logs`);
//       return data;
//     },
//     enabled: !!orderId,
//   });

// export const useCustomerCallLogs = (customerId: string | null) =>
//   useQuery({
//     queryKey: ['call-logs', 'customer', customerId],
//     queryFn: async () => {
//       const { data } = await api.get(`/customers/${customerId}/call-logs`);
//       return data;
//     },
//     enabled: !!customerId,
//   });

// export const useCreateCallLog = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (body: Partial<ManualCallLog> & { customer_id: string }) =>
//       api.post('/call-logs', body),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['call-logs'] });
//       if (vars.order_id) qc.invalidateQueries({ queryKey: ['call-logs', 'order', vars.order_id] });
//       toast.success('Call logged.');
//     },
//     onError,
//   });
// };

// export const useUpdateCallLog = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, ...body }: Partial<ManualCallLog> & { id: string }) =>
//       api.patch(`/call-logs/${id}`, body),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['call-logs'] });
//       toast.success('Call log updated.');
//     },
//     onError,
//   });
// };

// export const useDeleteCallLog = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (id: string) => api.delete(`/call-logs/${id}`),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['call-logs'] });
//       toast.success('Call log deleted.');
//     },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // CR4 — Customer Lifecycle
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useAdvanceLifecycle = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, stage, engagement_notes }: { id: string; stage: string; engagement_notes?: string }) =>
//       api.patch(`/customers/${id}/lifecycle`, { stage, engagement_notes }),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['customer', vars.id] });
//       qc.invalidateQueries({ queryKey: ['customers'] });
//       toast.success('Customer lifecycle updated.');
//     },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // CR7 — Feedback Resolution
// // ═══════════════════════════════════════════════════════════════════════════════
// export const useUpdateFeedbackResolution = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({
//       id, feedback_status, feedback_issue_notes, customer_feedback, feedback_rating,
//     }: {
//       id: string;
//       feedback_status: string;
//       feedback_issue_notes?: string;
//       customer_feedback?: string;
//       feedback_rating?: number;
//     }) => api.patch(`/orders/${id}/feedback-resolution`, {
//       feedback_status, feedback_issue_notes, customer_feedback, feedback_rating,
//     }),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['order', vars.id] });
//       qc.invalidateQueries({ queryKey: ['follow-ups'] });
//       toast.success('Feedback resolution saved.');
//     },
//     onError,
//   });
// };

// // ═══════════════════════════════════════════════════════════════════════════════
// // SOW §3.6 — EMPLOYEE DOCUMENT MANAGEMENT
// // ═══════════════════════════════════════════════════════════════════════════════

// export const useEmployees = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['employees', params],
//     queryFn: async () => {
//       const { data } = await api.get('/employees', { params });
//       return data.data.employees as (EmployeeProfile & { completeness: number })[];
//     },
//   });

// export const useEmployee = (userId: string | null) =>
//   useQuery<EmployeeDetail>({
//     queryKey: ['employee', userId],
//     queryFn: async () => {
//       const { data } = await api.get(`/employees/${userId}`);
//       return data.data as EmployeeDetail;
//     },
//     enabled: !!userId,
//   });

// export const useUpsertEmployeeProfile = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ userId, ...body }: Partial<EmployeeProfile> & { userId: string }) =>
//       api.put(`/employees/${userId}/profile`, body),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['employee', vars.userId] });
//       qc.invalidateQueries({ queryKey: ['employees'] });
//       toast.success('Profile saved.');
//     },
//     onError,
//   });
// };

// export const useUploadEmployeeDocument = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ userId, formData }: { userId: string; formData: FormData }) =>
//       api.post(`/employees/${userId}/documents`, formData, {
//         headers: { 'Content-Type': 'multipart/form-data' },
//       }),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['employee', vars.userId] });
//       toast.success('Document uploaded.');
//     },
//     onError,
//   });
// };

// export const useVerifyDocument = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ docId, action, rejection_reason }: {
//       docId: string; action: 'verify' | 'reject'; rejection_reason?: string;
//     }) => api.patch(`/employees/documents/${docId}/verify`, { action, rejection_reason }),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['employee'] });
//       toast.success('Document status updated.');
//     },
//     onError,
//   });
// };

// export const useDeleteEmployeeDocument = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: (docId: string) => api.delete(`/employees/documents/${docId}`),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['employee'] });
//       toast.success('Document deleted.');
//     },
//     onError,
//   });
// };

// export const useDepartments = () =>
//   useQuery<string[]>({
//     queryKey: ['departments'],
//     queryFn: async () => {
//       const { data } = await api.get('/employees/departments');
//       return data.data.departments;
//     },
//   });


// // ── All documents across all employees (Document Management page) ─────────────
// export const useAllDocuments = (params: Record<string, unknown> = {}) =>
//   useQuery({
//     queryKey: ['employee-documents', params],
//     queryFn: async () => {
//       const { data } = await api.get('/employees/documents', { params });
//       return data;
//     },
//     placeholderData: keepPreviousData,
//   });

// export const useDocumentStats = () =>
//   useQuery({
//     queryKey: ['employee-documents', 'stats'],
//     queryFn: async () => {
//       const { data } = await api.get('/employees/documents/stats');
//       return data.data.stats;
//     },
//   });

// export const useUpdateDocument = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ docId, ...body }: { docId: string; document_name?: string; document_type?: string; notes?: string; expiry_date?: string }) =>
//       api.patch(`/employees/documents/${docId}`, body),
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['employee-documents'] });
//       qc.invalidateQueries({ queryKey: ['employee'] });
//       toast.success('Document updated.');
//     },
//     onError,
//   });
// };




//testing


import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/utils';
// import type {
//   Customer, Order, FollowUp, Task, CsvBatch, DashboardKpis, User,
//   ShippingPartner, PincodeServiceability, ShippingDashboard, ServiceabilityCheck,
//   ManualCallLog, CustomerImage, TaskScoreDashboard,
//   Employee, EmployeeDocument,
// } from '@/types';

import type {
  Customer, Order, FollowUp, Task, CsvBatch, DashboardKpis, User,
  ShippingPartner, PincodeServiceability, ShippingDashboard, ServiceabilityCheck,
  ManualCallLog, CustomerImage, TaskScoreDashboard,
  Employee, EmployeeDocument, EmployeeProfile, EmployeeDetail,
  DailyTask, DailyTaskHistory,
  DailyActivity, DailyActivityHistory, DailyActivityAnalytics,
  DailyCalendarDaySummary, DailyStatsSummary, PersonalScorecardData,
  DocumentCenterEmployee, OnboardingDashboardWidgets, OnboardingChecklistItem,
} from '@/types';

// ── Generic helpers ───────────────────────────────────────────────────────────
const onError = (err: unknown) => toast.error(getErrorMessage(err));

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════
export const useUsers = () =>
  useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/auth/users');
      return data.data.users;
    },
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; password: string; role: string; phone?: string }) =>
      api.post('/auth/users', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created successfully.'); },
    onError,
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; role?: string; is_active?: boolean; phone?: string }) =>
      api.patch(`/auth/users/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated.'); },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export const useDashboardKpis = () =>
  useQuery<DashboardKpis>({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/kpis');
      return data.data.kpis;
    },
    refetchInterval: 60_000,
  });

export const useCeoView = () =>
  useQuery({
    queryKey: ['dashboard', 'ceo'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/ceo');
      return data.data.ceoView;
    },
  });

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════
export const useCustomers = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['customers', params],
    queryFn: async () => {
      const { data } = await api.get('/customers', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const useCustomer = (id: string | null) =>
  useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${id}`);
      return data.data.customer;
    },
    enabled: !!id,
  });

export const useCreateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Customer>) => api.post('/customers', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer created.'); },
    onError,
  });
};

export const useUpdateCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Customer> & { id: string }) => api.patch(`/customers/${id}`, body),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['customer', vars.id] }); qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer updated.'); },
    onError,
  });
};

export const useDeleteCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer deleted.'); },
    onError,
  });
};

export const useToggleWhatsappOptin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.patch(`/customers/${id}/whatsapp-optin`, { whatsapp_opt_in: value }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['customer', vars.id] }); qc.invalidateQueries({ queryKey: ['customers'] }); },
    onError,
  });
};

export const useClearAllCustomers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/customers/clear-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('All customers cleared successfully.');
    },
    onError,
  });
};

export const useBulkDeleteCustomers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/customers/bulk-delete', { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Selected customers deleted.');
    },
    onError,
  });
};

export const useBulkAssignCustomers = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, assigned_to }: { ids: string[]; assigned_to: string }) =>
      api.post('/customers/bulk-assign', { ids, assigned_to }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customers reassigned successfully.');
    },
    onError,
  });
};

export const useExportCustomers = () => {
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const response = await api.post('/customers/export', payload, {
        responseType: 'blob',
      });
      const fmt = (payload.format || 'xlsx').toLowerCase();
      const mimeType =
        fmt === 'pdf'
          ? 'application/pdf'
          : fmt === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = fmt === 'excel' ? 'xlsx' : fmt;
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `customers_export_${Date.now()}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Customers exported successfully.'),
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════════════════
export const useOrders = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['orders', params],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params });
      return data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
  });

export const useOrder = (id: string | null) =>
  useQuery<Order>({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data.order;
    },
    enabled: !!id,
  });

export const useOrderStats = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['orders', 'stats', params],
    queryFn: async () => {
      const { data } = await api.get('/orders/stats', { params });
      return data.data.stats;
    },
  });

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Order>) => api.post('/orders', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order created.'); },
    onError,
  });
};

export const useUpdateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, any> & { id: string }) => api.patch(`/orders/${id}`, body),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['order', vars.id] }); qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order updated.'); },
    onError,
  });
};

export const useClearAllOrders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/orders/clear-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('All orders cleared successfully.');
    },
    onError,
  });
};

export const useBulkDeleteOrders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order_ids: string[]) => api.post('/orders/bulk-delete', { ids: order_ids, order_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Selected orders deleted.');
    },
    onError,
  });
};

export const useBulkAssignOrders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ order_ids, assigned_to }: { order_ids: string[]; assigned_to: string }) =>
      api.post('/orders/bulk-assign', { order_ids, assigned_to }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Orders reassigned successfully.');
    },
    onError,
  });
};

export const useExportOrders = () => {
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const response = await api.post('/orders/export', payload, {
        responseType: 'blob',
      });
      const fmt = (payload.format || 'xlsx').toLowerCase();
      const mimeType =
        fmt === 'pdf'
          ? 'application/pdf'
          : fmt === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = fmt === 'excel' ? 'xlsx' : fmt;
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders_export_${Date.now()}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Orders exported successfully.'),
    onError,
  });
};

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/orders/${id}/status`, { status, note }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['order', vars.id] }); qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Status updated.'); },
    onError,
  });
};

export const useUpdateFlowStage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, flow_stage, note }: { id: string; flow_stage: string; note?: string }) =>
      api.patch(`/orders/${id}/flow-stage`, { flow_stage, note }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['order', vars.id] }); toast.success('Flow stage updated.'); },
    onError,
  });
};

export const useBulkUpdateStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ order_ids, status, note }: { order_ids: string[]; status: string; note?: string }) =>
      api.patch('/orders/bulk-status', { order_ids, status, note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Bulk update complete.'); },
    onError,
  });
};

export const useDeleteOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order deleted.'); },
    onError,
  });
};

// ── Manual Order Verification & Confirmation Hooks ───────────────────────────
export const useOrderVerificationDetail = (id: string | null) =>
  useQuery({
    queryKey: ['order-verification', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}/verification-detail`);
      return data.data;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });

export const useSkuMatchOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/orders/${id}/sku-match`, { notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Product matched! Confirmation message (order_confirmation013) dispatched to customer on WhatsApp.');
    },
    onError,
  });
};

export const useSkuMismatchOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/orders/${id}/sku-mismatch`, { notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order marked as SKU mismatched.');
    },
    onError,
  });
};

export const useRequestNewImageOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/orders/${id}/request-new-image`, { reason }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Requested new image from customer on WhatsApp.');
    },
    onError,
  });
};

export const useMarkUnreadableOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/orders/${id}/mark-unreadable`, { notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Marked image as unreadable.');
    },
    onError,
  });
};

export const useSendVerificationMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/send-verification`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['order-verification', id] });
      qc.invalidateQueries({ queryKey: ['order-whatsapp-logs', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('WhatsApp verification message (order_verification_interactive) sent to customer.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to send WhatsApp verification message.';
      toast.error(msg);
    },
  });
};

export const useBulkSendWhatsAppOrders = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderIds: string[]) => api.post('/orders/bulk-send-whatsapp', { orderIds }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      const msg = res?.data?.message || 'Bulk WhatsApp messages dispatched successfully!';
      toast.success(msg);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to dispatch bulk WhatsApp messages.';
      toast.error(msg);
    },
  });
};

export const useSendOrderTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, template_name }: { id: string; template_name: string }) =>
      api.post(`/orders/${id}/send-template`, { template_name }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-whatsapp-logs', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      const desc = res?.data?.data?.template_description || vars.template_name;
      toast.success(`WhatsApp template '${desc}' dispatched successfully!`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to send WhatsApp template message.';
      toast.error(msg);
    },
  });
};

export const useOrderWhatsAppLogs = (id: string | null) =>
  useQuery({
    queryKey: ['order-whatsapp-logs', id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await api.get(`/orders/${id}/whatsapp-logs`);
      return (data.data?.logs || []) as any[];
    },
    enabled: !!id,
    refetchInterval: 10000,
  });

export const useSendConfirmationOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/orders/${id}/send-confirmation`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['order-verification', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Confirmation request sent to customer on WhatsApp.');
    },
    onError,
  });
};

export const useCustomerConfirmOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, send_whatsapp = true }: { id: string; note?: string; send_whatsapp?: boolean }) =>
      api.post(`/orders/${id}/customer-confirm`, { note, send_whatsapp }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order-stats'] });
      toast.success('Customer confirmation recorded. Order state is now Confirmed ✓');
    },
    onError,
  });
};

export const useSendToExceptionOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/orders/${id}/send-to-exception`, { reason }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Moved order to Verification Exceptions.');
    },
    onError,
  });
};

export const useUpdateOrderVerificationStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verification_status, note }: { id: string; verification_status: string; note?: string }) =>
      api.patch(`/orders/${id}/verification-status`, { verification_status, note }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-verification', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Verification status updated.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to update verification status.';
      toast.error(msg);
    },
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════════════════════
export const useFollowUps = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['follow-ups', params],
    queryFn: async () => {
      const { data } = await api.get('/follow-ups', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const useFollowUp = (id: string | null) =>
  useQuery<FollowUp>({
    queryKey: ['follow-up', id],
    queryFn: async () => {
      const { data } = await api.get(`/follow-ups/${id}`);
      return data.data.followUp;
    },
    enabled: !!id,
  });

export const useCreateFollowUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<FollowUp>) => api.post('/follow-ups', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Follow-up created.'); },
    onError,
  });
};

export const useUpdateFollowUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<FollowUp> & { id: string }) => api.patch(`/follow-ups/${id}`, body),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['follow-up', vars.id] }); qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Follow-up updated.'); },
    onError,
  });
};

export const useDeleteFollowUp = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/follow-ups/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Follow-up deleted.'); },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════
export const useTasks = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      const { data } = await api.get('/tasks', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const useTaskDashboard = (userId?: string) =>
  useQuery({
    queryKey: ['tasks', 'dashboard', userId],
    queryFn: async () => {
      const { data } = await api.get('/tasks/dashboard', { params: userId ? { user_id: userId } : {} });
      return data.data.dashboard;
    },
  });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Task>) => api.post('/tasks', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task created.'); },
    onError,
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Task> & { id: string }) => api.patch(`/tasks/${id}`, body),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task updated.'); },
    onError,
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task deleted.'); },
    onError,
  });
};

// ── SOW §3.7 — Task Score Management ────────────────────────────────────────
export const useSetTaskScore = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score, score_comment }: { id: string; score: number; score_comment?: string }) =>
      api.patch(`/tasks/${id}/score`, { score, score_comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'score-dashboard'] });
      toast.success('Task score saved.');
    },
    onError,
  });
};

export const useTaskScoreDashboard = (params: Record<string, unknown> = {}) =>
  useQuery<TaskScoreDashboard>({
    queryKey: ['tasks', 'score-dashboard', params],
    queryFn: async () => {
      const { data } = await api.get('/tasks/score-dashboard', { params });
      return data.data.scoreDashboard;
    },
  });

export const useUnscoredTasks = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['tasks', 'unscored', params],
    queryFn: async () => {
      const { data } = await api.get('/tasks/unscored', { params });
      return data;
    },
  });

// ═══════════════════════════════════════════════════════════════════════════════
// CSV IMPORT
// ═══════════════════════════════════════════════════════════════════════════════
export const useCsvBatches = () =>
  useQuery({
    queryKey: ['csv-batches'],
    queryFn: async () => {
      const { data } = await api.get('/csv/batches');
      return data;
    },
    refetchInterval: (query) => {
      const batches = query.state.data?.data || [];
      const hasActive = Array.isArray(batches) && batches.some((b: any) => b.status === 'processing' || b.status === 'uploaded');
      return hasActive ? 2000 : false;
    },
  });

export const useCsvBatch = (id: string | null) => {
  const qc = useQueryClient();
  return useQuery<CsvBatch>({
    queryKey: ['csv-batch', id],
    queryFn: async () => {
      const { data } = await api.get(`/csv/batches/${id}`);
      const batch = data?.data?.batch;
      if (batch && (batch.status === 'completed' || batch.status === 'partial' || batch.status === 'failed')) {
        qc.invalidateQueries({ queryKey: ['csv-batches'] });
        qc.invalidateQueries({ queryKey: ['orders'] });
        qc.invalidateQueries({ queryKey: ['customers'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['reports'] });
      }
      return batch;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'processing' || status === 'uploaded' ? 1500 : false;
    },
  });
};

export const useUploadCsv = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/csv/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['csv-batches'] });
      const batchId = res?.data?.data?.batch?.id;
      if (batchId) {
        qc.invalidateQueries({ queryKey: ['csv-batch', batchId] });
      }
      toast.success('File uploaded. Processing orders...');
    },
    onError,
  });
};

// Two-Way Delivery CSV Upload (Client Email Point 5)
export const useUploadDeliveryCsv = () =>
  useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/csv/delivery-upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onError,
  });

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════
export const useSalesReport = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['reports', 'sales', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/sales', { params });
      return data.data.report;
    },
  });

export const useTeamReport = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['reports', 'team', params],
    queryFn: async () => {
      const { data } = await api.get('/reports/team', { params });
      return data.data.report;
    },
  });

export const downloadReport = async (type: 'orders' | 'customers' | 'team', params: Record<string, string> = {}) => {
  const query = new URLSearchParams(params).toString();
  const token = localStorage.getItem('access_token');
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/reports/export/${type}?${query}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Export failed');
  const fmt = (params.format || 'xlsx').toLowerCase();
  const mimeType =
    fmt === 'pdf'
      ? 'application/pdf'
      : fmt === 'csv'
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const ext = fmt === 'excel' ? 'xlsx' : fmt;
  const blob = await res.blob();
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}_report_${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHIPPING & TRACKING
// ═══════════════════════════════════════════════════════════════════════════════
export const useShippingDashboard = () =>
  useQuery<ShippingDashboard>({
    queryKey: ['shipping', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/shipping/dashboard');
      return data.data.dashboard;
    },
    refetchInterval: 60_000,
  });

export const useShipments = (params: Record<string, unknown> = {}) =>
  useQuery<{ shipments: any[]; total: number; page: number; limit: number; totalPages: number }>({
    queryKey: ['shipping', 'shipments', params],
    queryFn: async () => {
      const { data } = await api.get('/shipping/shipments', { params });
      return {
        shipments: data.data || [],
        total: data.pagination?.total || 0,
        page: data.pagination?.page || 1,
        limit: data.pagination?.limit || 25,
        totalPages: data.pagination?.totalPages || 1,
      };
    },
  });

export const useBulkUploadShipments = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.post('/shipping/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['shipping'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(res.data?.message || 'Shipping bulk upload processed successfully.');
    },
    onError,
  });
};

export const useShippingPartners = (params: Record<string, unknown> = {}) =>
  useQuery<ShippingPartner[]>({
    queryKey: ['shipping-partners', params],
    queryFn: async () => {
      const { data } = await api.get('/shipping/partners', { params });
      return data.data.partners;
    },
  });

export const useShippingPartner = (id: string | null) =>
  useQuery<ShippingPartner>({
    queryKey: ['shipping-partner', id],
    queryFn: async () => {
      const { data } = await api.get(`/shipping/partners/${id}`);
      return data.data.partner;
    },
    enabled: !!id,
  });

export const useCreateShippingPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ShippingPartner>) => api.post('/shipping/partners', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shipping-partners'] }); toast.success('Shipping partner created.'); },
    onError,
  });
};

export const useUpdateShippingPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ShippingPartner> & { id: string }) => api.patch(`/shipping/partners/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shipping-partners'] }); toast.success('Shipping partner updated.'); },
    onError,
  });
};

export const useDeleteShippingPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/shipping/partners/${id}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['shipping-partners'] });
      toast.success(res.data?.message || 'Shipping partner removed.');
    },
    onError,
  });
};

// ── Pincode Serviceability ──────────────────────────────────────────────────────
export const useServiceabilityList = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['serviceability', params],
    queryFn: async () => {
      const { data } = await api.get('/shipping/serviceability/list', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const useCheckServiceability = (pincode: string | null) =>
  useQuery<ServiceabilityCheck>({
    queryKey: ['serviceability-check', pincode],
    queryFn: async () => {
      const { data } = await api.get('/shipping/serviceability', { params: { pincode } });
      return data.data;
    },
    enabled: !!pincode && pincode.length >= 4,
  });

export const useCreateServiceability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PincodeServiceability>) => api.post('/shipping/serviceability', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Serviceability entry added.'); },
    onError,
  });
};

export const useUpdateServiceability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<PincodeServiceability> & { id: string }) => api.patch(`/shipping/serviceability/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Entry updated.'); },
    onError,
  });
};

export const useDeleteServiceability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/shipping/serviceability/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Entry deleted.'); },
    onError,
  });
};

export const useBulkServiceability = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Record<string, unknown>[]) => api.post('/shipping/serviceability/bulk', { entries }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['serviceability'] }); toast.success('Bulk upload complete.'); },
    onError,
  });
};

// ── Order Shipping Update ───────────────────────────────────────────────────────
export const useUpdateOrderShipping = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string; shipping_partner?: string; tracking_number?: string;
      delivery_pincode?: string; estimated_delivery_date?: string;
      mark_dispatched?: boolean;
    }) => api.patch(`/orders/${id}/shipping`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['shipping', 'dashboard'] });
      toast.success('Shipping details updated.');
    },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CR1 — Image Verification
// ═══════════════════════════════════════════════════════════════════════════════
export const useOrderImages = (orderId: string | null) =>
  useQuery<CustomerImage[]>({
    queryKey: ['order-images', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}/images`);
      return data.data.images;
    },
    enabled: !!orderId,
    refetchInterval: 15000, // Auto-refresh every 15s so customer WhatsApp images appear in CRM without manual reload
  });

export const useApproveImages = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.post(`/orders/${id}/approve-images`, { note }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-images', vars.id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Images approved. Order confirmed.');
    },
    onError,
  });
};

export const useRejectImages = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, request_new }: { id: string; reason: string; request_new?: boolean }) =>
      api.post(`/orders/${id}/reject-images`, { reason, request_new }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['order-images', vars.id] });
      toast.success('Images rejected. Customer notified.');
    },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CR2 — Manual Call Logs
// ═══════════════════════════════════════════════════════════════════════════════
export const useCallLogs = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['call-logs', params],
    queryFn: async () => {
      const { data } = await api.get('/call-logs', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const useOrderCallLogs = (orderId: string | null) =>
  useQuery({
    queryKey: ['call-logs', 'order', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}/call-logs`);
      return data;
    },
    enabled: !!orderId,
  });

export const useCustomerCallLogs = (customerId: string | null) =>
  useQuery({
    queryKey: ['call-logs', 'customer', customerId],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${customerId}/call-logs`);
      return data;
    },
    enabled: !!customerId,
  });

export const useCreateCallLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ManualCallLog> & { customer_id?: string }) =>
      api.post('/call-logs', body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['call-logs'] });
      if (vars.order_id) qc.invalidateQueries({ queryKey: ['call-logs', 'order', vars.order_id] });
      toast.success('Call logged.');
    },
    onError,
  });
};

export const useUpdateCallLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ManualCallLog> & { id: string }) =>
      api.patch(`/call-logs/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success('Call log updated.');
    },
    onError,
  });
};

export const useDeleteCallLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/call-logs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call-logs'] });
      toast.success('Call log deleted.');
    },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CR4 — Customer Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════
export const useAdvanceLifecycle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage, engagement_notes }: { id: string; stage: string; engagement_notes?: string }) =>
      api.patch(`/customers/${id}/lifecycle`, { stage, engagement_notes }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['customer', vars.id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer lifecycle updated.');
    },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// CR7 — Feedback Resolution
// ═══════════════════════════════════════════════════════════════════════════════
export const useUpdateFeedbackResolution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id, feedback_status, feedback_issue_notes, customer_feedback, feedback_rating,
    }: {
      id: string;
      feedback_status: string;
      feedback_issue_notes?: string;
      customer_feedback?: string;
      feedback_rating?: number;
    }) => api.patch(`/orders/${id}/feedback-resolution`, {
      feedback_status, feedback_issue_notes, customer_feedback, feedback_rating,
    }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
      qc.invalidateQueries({ queryKey: ['follow-ups'] });
      toast.success('Feedback resolution saved.');
    },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// SOW §3.6 — STANDALONE EMPLOYEE MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export const useEmployees = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['employees', params],
    queryFn: async () => {
      const { data } = await api.get('/employees', { params });
      return data.data.employees as Employee[];
    },
    placeholderData: keepPreviousData,
  });

// export const useEmployee = (id: string | null) =>
//   useQuery<Employee>({
//     queryKey: ['employee', id],
//     queryFn: async () => {
//       const { data } = await api.get(`/employees/${id}`);
//       return data.data.employee as Employee;
//     },
//     enabled: !!id,
//   });


export const useEmployee = (id: string | null) =>
  useQuery<EmployeeDetail>({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data } = await api.get(`/employees/${id}`);
      return data.data.employee;
    },
    enabled: !!id,
  });
export const useCreateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Employee>) => api.post('/employees', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employee created.'); },
    onError,
  });
};

export const useUpdateEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Employee> & { id: string }) => api.patch(`/employees/${id}`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee', vars.id] });
      toast.success('Employee updated.');
    },
    onError,
  });
};

export const useDeleteEmployee = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('Employee deleted.'); },
    onError,
  });
};

export const useDepartments = () =>
  useQuery<string[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get('/employees/departments');
      return data.data.departments;
    },
  });

// export const useUploadEmployeeDocument = () => {
//   const qc = useQueryClient();
//   return useMutation({
//     mutationFn: ({ employeeId, formData }: { employeeId: string; formData: FormData }) =>
//       api.post(`/employees/${employeeId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
//     onSuccess: (_, vars) => {
//       qc.invalidateQueries({ queryKey: ['employee', vars.employeeId] });
//       toast.success('Document uploaded.');
//     },
//     onError,
//   });
// };


export const useUploadEmployeeDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, formData }: { userId: string; formData: FormData }) =>
      api.post(`/employees/${userId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employee'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['document-center'] });
      qc.invalidateQueries({ queryKey: ['onboarding-dashboard'] });
      toast.success('Document uploaded.');
    },
    onError,
  });
};

export const useReplaceDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, docId, formData }: { employeeId: string; docId: string; formData: FormData }) =>
      api.post(`/employees/${employeeId}/documents/${docId}/replace`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['document-center'] });
      qc.invalidateQueries({ queryKey: ['onboarding-dashboard'] });
      toast.success('Document version replaced.');
    },
    onError,
  });
};

export const useDocumentVersions = (employeeId: string | null, docId: string | null) =>
  useQuery({
    queryKey: ['document-versions', employeeId, docId],
    queryFn: async () => {
      const { data } = await api.get(`/employees/${employeeId}/documents/${docId}/versions`);
      return data.data.versions as EmployeeDocument[];
    },
    enabled: !!employeeId && !!docId,
  });

export const useRequestReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => api.patch(`/employees/documents/${docId}/request-review`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee'] });
      qc.invalidateQueries({ queryKey: ['document-center'] });
      qc.invalidateQueries({ queryKey: ['onboarding-dashboard'] });
      toast.success('Document submitted for review.');
    },
    onError,
  });
};

export const useVerifyDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, action, rejection_reason, remarks }: { docId: string; action: 'verify'|'reject'; rejection_reason?: string; remarks?: string }) =>
      api.patch(`/employees/documents/${docId}/verify`, { action, rejection_reason, remarks }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employee'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee-documents'] });
      qc.invalidateQueries({ queryKey: ['document-center'] });
      qc.invalidateQueries({ queryKey: ['onboarding-dashboard'] });
      toast.success(vars.action === 'verify' ? 'Document verified successfully!' : 'Document rejected.');
    },
    onError,
  });
};

export const useDeleteEmployeeDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => api.delete(`/employees/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee-documents'] });
      qc.invalidateQueries({ queryKey: ['document-center'] });
      qc.invalidateQueries({ queryKey: ['onboarding-dashboard'] });
      toast.success('Document deleted.');
    },
    onError,
  });
};

export const useUpsertEmployeeProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string } & Record<string, unknown>) =>
      api.put(`/employees/${userId}/profile`, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employee', vars.userId] });
      toast.success('Profile saved.');
    },
    onError,
  });
};

export const useUpdateDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, ...body }: { docId: string; document_name?: string; document_type?: string; notes?: string; remarks?: string; expiry_date?: string }) =>
      api.patch(`/employees/documents/${docId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-documents'] });
      qc.invalidateQueries({ queryKey: ['employee'] });
      qc.invalidateQueries({ queryKey: ['document-center'] });
      toast.success('Document updated.');
    },
    onError,
  });
};

export const useAllDocuments = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['employee-documents', params],
    queryFn: async () => { const { data } = await api.get('/employees/documents', { params }); return data; },
    placeholderData: keepPreviousData,
  });

export const useDocumentStats = () =>
  useQuery({
    queryKey: ['employee-documents', 'stats'],
    queryFn: async () => { const { data } = await api.get('/employees/documents/stats'); return data.data.stats; },
  });

export const useDocumentCenter = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['document-center', params],
    queryFn: async () => {
      const { data } = await api.get('/employees/document-center', { params });
      return data.data as {
        employees: DocumentCenterEmployee[];
        summary: {
          total: number;
          pending_onboarding: number;
          completed_onboarding: number;
          pending_verifications: number;
          rejected_documents: number;
        };
      };
    },
    placeholderData: keepPreviousData,
  });

export const useOnboardingDashboard = () =>
  useQuery({
    queryKey: ['onboarding-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/employees/onboarding-dashboard');
      return data.data.widgets as OnboardingDashboardWidgets;
    },
  });

export const useOnboardingChecklist = (id: string | null) =>
  useQuery({
    queryKey: ['onboarding-checklist', id],
    queryFn: async () => {
      const { data } = await api.get(`/employees/${id}/onboarding`);
      return data.data as {
        employee_id: string;
        employee_name: string;
        onboarding_status: string;
        checklist: OnboardingChecklistItem[];
        completion_percent: number;
        verified_percent: number;
        missing_docs: string[];
        is_complete: boolean;
      };
    },
    enabled: !!id,
  });

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY ACTIVITIES MODULE
// ═══════════════════════════════════════════════════════════════════════════════
export const useDailyActivities = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['daily-activities', params],
    queryFn: async () => {
      const { data } = await api.get('/daily-activities', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const useDailyActivityCalendarOverview = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['daily-activities', 'calendar-overview', params],
    queryFn: async () => {
      const { data } = await api.get('/daily-activities/calendar-overview', { params });
      return (data.data?.daySummaries || []) as DailyCalendarDaySummary[];
    },
  });

export const useDailyActivitySummary = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['daily-activities', 'daily-summary', params],
    queryFn: async () => {
      const { data } = await api.get('/daily-activities/daily-summary', { params });
      return data.data as { date: string; stats: DailyStatsSummary };
    },
  });

export const useDailyActivityScorecard = () =>
  useQuery({
    queryKey: ['daily-activities', 'scorecard'],
    queryFn: async () => {
      const { data } = await api.get('/daily-activities/scorecard');
      return data.data as PersonalScorecardData;
    },
  });

export const useDailyActivityAssignableUsers = () =>
  useQuery({
    queryKey: ['daily-activities', 'assignable-users'],
    queryFn: async () => {
      const { data } = await api.get('/daily-activities/assignable-users');
      return data.data as User[];
    },
  });

export const useDailyActivityById = (id?: string) =>
  useQuery({
    queryKey: ['daily-activities', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/daily-activities/${id}`);
      return data.data as DailyActivity;
    },
    enabled: !!id,
  });

export const useDailyActivityHistory = (id?: string) =>
  useQuery({
    queryKey: ['daily-activities', id, 'history'],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await api.get(`/daily-activities/${id}/history`);
      return data.data as DailyActivityHistory[];
    },
    enabled: !!id,
  });

export const useDailyActivityAnalytics = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['daily-activities', 'analytics', params],
    queryFn: async () => {
      const { data } = await api.get('/daily-activities/analytics', { params });
      return data.data as DailyActivityAnalytics[];
    },
  });

export const useCreateDailyActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      assigned_to: string | string[];
      priority: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
      scheduled_date?: string;
      due_date?: string;
      estimated_hours?: number;
      notes?: string;
    }) => api.post('/daily-activities', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success('Daily task created and assigned successfully.');
    },
    onError,
  });
};

export const useUpdateDailyActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      title?: string;
      description?: string;
      priority?: string;
      category?: string;
      scheduled_date?: string;
      due_date?: string;
      estimated_hours?: number;
      actual_hours?: number;
      completion_notes?: string;
      status?: string;
      note?: string;
    }) => api.put(`/daily-activities/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success('Daily task updated.');
    },
    onError,
  });
};

export const useStartDailyActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/daily-activities/${id}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success('Task started (In Progress).');
    },
    onError,
  });
};

export const useCompleteDailyActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      notes,
      actual_hours,
    }: {
      id: string;
      notes?: string;
      actual_hours?: number;
    }) => api.patch(`/daily-activities/${id}/complete`, { notes, actual_hours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success('Task marked as completed.');
    },
    onError,
  });
};

export const useDeleteDailyActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/daily-activities/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success('Daily task deleted.');
    },
    onError,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY TASKS MODULE (LEGACY WRAPPER)
// ═══════════════════════════════════════════════════════════════════════════════
export const useDailyTasks = (params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ['daily-tasks', params],
    queryFn: async () => {
      const { data } = await api.get('/daily-tasks', { params });
      return data;
    },
    placeholderData: keepPreviousData,
  });

export const useDailyTaskAssignableUsers = () =>
  useQuery({
    queryKey: ['daily-tasks', 'assignable-users'],
    queryFn: async () => {
      const { data } = await api.get('/daily-tasks/assignable-users');
      return data.data as User[];
    },
  });

export const useDailyTaskById = (id?: string) =>
  useQuery({
    queryKey: ['daily-tasks', id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await api.get(`/daily-tasks/${id}`);
      return data.data as DailyTask;
    },
    enabled: !!id,
  });

export const useCreateDailyTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description?: string;
      assigned_to: string | string[];
      priority: 'low' | 'medium' | 'high';
      due_date?: string;
      remarks?: string;
    }) => api.post('/daily-tasks', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      toast.success('Daily task created and assigned successfully.');
    },
    onError,
  });
};

export const useUpdateDailyTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; title?: string; description?: string; priority?: string; due_date?: string; assigned_to?: string; remarks?: string }) =>
      api.patch(`/daily-tasks/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      toast.success('Daily task updated.');
    },
    onError,
  });
};

export const useUpdateDailyTaskStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, remarks }: { id: string; status: string; remarks?: string }) =>
      api.patch(`/daily-tasks/${id}/status`, { status, remarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      toast.success('Daily task status updated.');
    },
    onError,
  });
};

export const useDeleteDailyTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/daily-tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      qc.invalidateQueries({ queryKey: ['daily-activities'] });
      toast.success('Daily task deleted.');
    },
    onError,
  });
};