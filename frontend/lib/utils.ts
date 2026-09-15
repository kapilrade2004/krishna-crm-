// import { type ClassValue, clsx } from 'clsx';
// import { twMerge } from 'tailwind-merge';
// import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

// // ── className merge ───────────────────────────────────────────────────────────
// export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// // ── Currency ─────────────────────────────────────────────────────────────────
// export const formatCurrency = (amount: number | string | null | undefined) => {
//   const n = Number(amount ?? 0);
//   return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
// };

// export const formatNumber = (n: number | null | undefined) =>
//   new Intl.NumberFormat('en-IN').format(n ?? 0);

// // ── Dates ─────────────────────────────────────────────────────────────────────
// export const fmtDate = (d: string | Date | null | undefined) => {
//   if (!d) return '—';
//   const date = typeof d === 'string' ? parseISO(d) : d;
//   return isValid(date) ? format(date, 'dd MMM yyyy') : '—';
// };

// export const fmtDateTime = (d: string | Date | null | undefined) => {
//   if (!d) return '—';
//   const date = typeof d === 'string' ? parseISO(d) : d;
//   return isValid(date) ? format(date, 'dd MMM yyyy, hh:mm a') : '—';
// };

// export const timeAgo = (d: string | Date | null | undefined) => {
//   if (!d) return '—';
//   const date = typeof d === 'string' ? parseISO(d) : d;
//   return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '—';
// };

// // ── Status colours ────────────────────────────────────────────────────────────
// export const ORDER_STATUS_COLOURS: Record<string, string> = {
//   pending:            'bg-yellow-100 text-yellow-700',
//   image_verification: 'bg-purple-100 text-purple-700',  // CR1
//   confirmed:          'bg-blue-100 text-blue-700',
//   processing:         'bg-purple-100 text-purple-700',
//   dispatched:         'bg-orange-100 text-orange-700',
//   delivered:          'bg-emerald-100 text-emerald-700',
//   cancelled:          'bg-red-100 text-red-600',
//   returned:           'bg-gray-100 text-gray-600',
//   refunded:           'bg-gray-100 text-gray-500',
// };

// export const TASK_STATUS_COLOURS: Record<string, string> = {
//   todo:        'bg-gray-100 text-gray-600',
//   in_progress: 'bg-blue-100 text-blue-700',
//   review:      'bg-amber-100 text-amber-700',
//   done:        'bg-emerald-100 text-emerald-700',
//   cancelled:   'bg-red-100 text-red-500',
// };

// export const PRIORITY_COLOURS: Record<string, string> = {
//   low:    'bg-blue-50 text-blue-600',
//   medium: 'bg-yellow-50 text-yellow-700',
//   high:   'bg-orange-100 text-orange-700',
//   urgent: 'bg-red-100 text-red-700',
// };

// export const FOLLOWUP_STATUS_COLOURS: Record<string, string> = {
//   pending:     'bg-yellow-100 text-yellow-700',
//   in_progress: 'bg-blue-100 text-blue-700',
//   completed:   'bg-emerald-100 text-emerald-700',
//   cancelled:   'bg-gray-100 text-gray-500',
//   rescheduled: 'bg-purple-100 text-purple-600',
// };

// export const MARKETPLACE_COLOURS: Record<string, string> = {
//   amazon:   'bg-orange-100 text-orange-700',
//   flipkart: 'bg-blue-100 text-blue-700',
//   indiamart:'bg-yellow-100 text-yellow-700',
//   website:  'bg-teal-100 text-teal-700',
//   direct:   'bg-gray-100 text-gray-600',
//   other:    'bg-gray-50 text-gray-500',
// };

// // ── Constants ─────────────────────────────────────────────────────────────────
// export const MARKETPLACES = ['amazon', 'flipkart', 'indiamart', 'website', 'direct', 'other'];
// export const ORDER_STATUSES = [
//   'pending', 'image_verification', 'confirmed', 'processing',
//   'dispatched', 'delivered', 'cancelled', 'returned', 'refunded',
// ];
// export const TASK_STATUSES  = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
// export const PRIORITIES     = ['low', 'medium', 'high', 'urgent'];
// export const FOLLOWUP_TYPES = ['call', 'whatsapp', 'email', 'visit', 'other'];

// // CR2 — Call log constants
// export const CALL_OUTCOMES  = ['answered', 'no_answer', 'busy', 'callback_requested', 'confirmed', 'rejected', 'escalated'];
// export const CALL_CONTEXTS  = ['image_collection', 'reorder_assistance', 'feedback_resolution', 'general'];
// export const CALL_OUTCOME_COLOURS: Record<string, string> = {
//   answered:           'bg-emerald-100 text-emerald-700',
//   no_answer:          'bg-gray-100 text-gray-500',
//   busy:               'bg-yellow-100 text-yellow-700',
//   callback_requested: 'bg-blue-100 text-blue-700',
//   confirmed:          'bg-emerald-100 text-emerald-700',
//   rejected:           'bg-red-100 text-red-600',
//   escalated:          'bg-red-200 text-red-800',
// };

// // CR4 — Lifecycle stage labels and colours
// export const LIFECYCLE_STAGES = [
//   'prospect', 'customer', 'installation_pending',
//   'installation_done', 'feedback_pending', 'engaged',
// ];
// export const LIFECYCLE_COLOURS: Record<string, string> = {
//   prospect:             'bg-gray-100 text-gray-600',
//   customer:             'bg-blue-100 text-blue-700',
//   installation_pending: 'bg-amber-100 text-amber-700',
//   installation_done:    'bg-teal-100 text-teal-700',
//   feedback_pending:     'bg-purple-100 text-purple-700',
//   engaged:              'bg-emerald-100 text-emerald-700',
// };

// // CR7 — Feedback status colours
// export const FEEDBACK_STATUS_COLOURS: Record<string, string> = {
//   not_collected: 'bg-gray-100 text-gray-500',
//   happy:         'bg-emerald-100 text-emerald-700',
//   unhappy:       'bg-red-100 text-red-600',
//   escalated:     'bg-red-200 text-red-800',
//   resolved:      'bg-teal-100 text-teal-700',
// };

// // Build a shipment tracking URL from a partner's template
// export const buildTrackingUrl = (template: string | undefined | null, trackingNumber: string | undefined | null) => {
//   if (!template || !trackingNumber) return null;
//   return template.replace('{tracking_number}', encodeURIComponent(trackingNumber));
// };

// // ── Error message extractor ───────────────────────────────────────────────────
// export const getErrorMessage = (err: unknown): string => {
//   if (!err) return 'An unexpected error occurred.';
//   const e = err as { response?: { data?: { message?: string; errors?: { message: string }[] } } };
//   if (e.response?.data?.errors?.length) {
//     return e.response.data.errors.map((x) => x.message).join(', ');
//   }
//   return e.response?.data?.message || 'An unexpected error occurred.';
// };

// // ── Truncate text ─────────────────────────────────────────────────────────────
// export const truncate = (str: string | null | undefined, len = 40) =>
//   str && str.length > len ? str.slice(0, len) + '…' : (str ?? '');



//testing





import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

// ── className merge ───────────────────────────────────────────────────────────
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// ── Currency ─────────────────────────────────────────────────────────────────
export const formatCurrency = (amount: number | string | null | undefined) => {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
};

export const formatNumber = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-IN').format(n ?? 0);

// ── Dates ─────────────────────────────────────────────────────────────────────
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const date = typeof d === 'string' ? parseISO(d) : d;
  return isValid(date) ? format(date, 'dd MMM yyyy') : '—';
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const date = typeof d === 'string' ? parseISO(d) : d;
  return isValid(date) ? format(date, 'dd MMM yyyy, hh:mm a') : '—';
};

export const timeAgo = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const date = typeof d === 'string' ? parseISO(d) : d;
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '—';
};

// ── Status colours ────────────────────────────────────────────────────────────
export const ORDER_STATUS_COLOURS: Record<string, string> = {
  pending:              'bg-yellow-100 text-yellow-700',
  image_verification:   'bg-purple-100 text-purple-700',  // CR1
  pending_confirmation: 'bg-sky-100 text-sky-800 border border-sky-300',
  confirmed:            'bg-blue-100 text-blue-700',
  processing:           'bg-purple-100 text-purple-700',
  dispatched:           'bg-orange-100 text-orange-700',
  delivered:            'bg-emerald-100 text-emerald-700',
  cancelled:            'bg-red-100 text-red-600',
  returned:             'bg-gray-100 text-gray-600',
  refunded:             'bg-gray-100 text-gray-500',
};

export const VERIFICATION_STATUS_COLOURS: Record<string, string> = {
  pending_verification:   'bg-amber-100 text-amber-800 border border-amber-300',
  screenshot_requested:   'bg-blue-100 text-blue-800 border border-blue-300',
  image_received:         'bg-purple-100 text-purple-800 border border-purple-300',
  verification_in_review: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
  sku_matched:            'bg-emerald-100 text-emerald-800 border border-emerald-300',
  sku_mismatched:         'bg-rose-100 text-rose-800 border border-rose-300',
  image_unreadable:       'bg-orange-100 text-orange-800 border border-orange-300',
  product_not_found:      'bg-red-100 text-red-800 border border-red-300',
  pending_confirmation:   'bg-sky-100 text-sky-800 border border-sky-300',
  confirmed:              'bg-teal-100 text-teal-800 border border-teal-300',
  cancelled:              'bg-gray-100 text-gray-700 border border-gray-300',
  verification_exception: 'bg-red-100 text-red-700 border border-red-300',
};

export const TASK_STATUS_COLOURS: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-amber-100 text-amber-700',
  done:        'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-red-100 text-red-500',
};

export const PRIORITY_COLOURS: Record<string, string> = {
  low:    'bg-blue-50 text-blue-600',
  medium: 'bg-yellow-50 text-yellow-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export const FOLLOWUP_STATUS_COLOURS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-gray-100 text-gray-500',
  rescheduled: 'bg-purple-100 text-purple-600',
};

export const MARKETPLACE_COLOURS: Record<string, string> = {
  amazon:           'bg-orange-100 text-orange-700',
  flipkart:         'bg-blue-100 text-blue-700',
  indiamart:        'bg-yellow-100 text-yellow-700',
  akuabeat_website: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  website:          'bg-teal-100 text-teal-700',
  direct:           'bg-gray-100 text-gray-600',
  other:            'bg-gray-50 text-gray-500',
};

// ── Constants ─────────────────────────────────────────────────────────────────
export const MARKETPLACES = ['amazon', 'flipkart', 'indiamart', 'akuabeat_website', 'website', 'direct', 'other'];
export const ORDER_STATUSES = [
  'pending', 'image_verification', 'confirmed', 'processing',
  'dispatched', 'delivered', 'cancelled', 'returned', 'refunded',
];
export const VERIFICATION_STATUSES = [
  'pending_verification', 'screenshot_requested', 'image_received', 'verification_in_review',
  'sku_matched', 'sku_mismatched', 'image_unreadable', 'product_not_found',
  'pending_confirmation', 'confirmed', 'verification_exception', 'cancelled',
];
export const VERIFICATION_STATUS_OPTIONS = [
  { value: 'pending_verification',   label: 'Pending Verification' },
  { value: 'screenshot_requested',   label: 'Screenshot Requested (15m Timer)' },
  { value: 'image_received',         label: 'Image Received' },
  { value: 'verification_in_review', label: 'In Review' },
  { value: 'sku_matched',            label: 'SKU Matched' },
  { value: 'sku_mismatched',         label: 'SKU Mismatched' },
  { value: 'image_unreadable',       label: 'Image Unreadable' },
  { value: 'product_not_found',      label: 'Product Not Found' },
  { value: 'pending_confirmation',   label: 'Pending Confirmation' },
  { value: 'confirmed',              label: 'Confirmed' },
  { value: 'verification_exception', label: 'Exception' },
  { value: 'cancelled',              label: 'Cancelled' },
];
export const TASK_STATUSES  = ['todo', 'in_progress', 'review', 'done', 'cancelled'];
export const PRIORITIES     = ['low', 'medium', 'high', 'urgent'];
export const FOLLOWUP_TYPES = ['call', 'whatsapp', 'email', 'visit', 'other'];

// CR2 — Call log constants
export const CALL_OUTCOMES  = ['answered', 'no_answer', 'busy', 'callback_requested', 'confirmed', 'rejected', 'escalated'];
export const CALL_CONTEXTS  = ['image_collection', 'reorder_assistance', 'feedback_resolution', 'general'];
export const CALL_OUTCOME_COLOURS: Record<string, string> = {
  answered:           'bg-emerald-100 text-emerald-700',
  no_answer:          'bg-gray-100 text-gray-500',
  busy:               'bg-yellow-100 text-yellow-700',
  callback_requested: 'bg-blue-100 text-blue-700',
  confirmed:          'bg-emerald-100 text-emerald-700',
  rejected:           'bg-red-100 text-red-600',
  escalated:          'bg-red-200 text-red-800',
};

// CR4 — Lifecycle stage labels and colours
export const LIFECYCLE_STAGES = [
  'prospect', 'customer', 'installation_pending',
  'installation_done', 'feedback_pending', 'engaged',
];
export const LIFECYCLE_COLOURS: Record<string, string> = {
  prospect:             'bg-gray-100 text-gray-600',
  customer:             'bg-blue-100 text-blue-700',
  installation_pending: 'bg-amber-100 text-amber-700',
  installation_done:    'bg-teal-100 text-teal-700',
  feedback_pending:     'bg-purple-100 text-purple-700',
  engaged:              'bg-emerald-100 text-emerald-700',
};

// CR7 — Feedback status colours
export const FEEDBACK_STATUS_COLOURS: Record<string, string> = {
  not_collected: 'bg-gray-100 text-gray-500',
  happy:         'bg-emerald-100 text-emerald-700',
  unhappy:       'bg-red-100 text-red-600',
  escalated:     'bg-red-200 text-red-800',
  resolved:      'bg-teal-100 text-teal-700',
};

// ── Order flow / status transitions (shared: OrdersPage list + Order Detail) ──
// Moved here so both pages import the same source instead of keeping
// separate local copies that can drift out of sync.
export const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  pending:            ['image_verification', 'confirmed', 'cancelled'],
  image_verification: ['confirmed', 'cancelled'],
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed:          ['processing', 'dispatched', 'delivered', 'cancelled'],
  processing:         ['dispatched', 'delivered', 'cancelled'],
  dispatched:         ['delivered', 'returned'],
  delivered:          ['returned', 'refunded'],
  cancelled: [], returned: ['refunded'], refunded: [],
};

export const FLOW_STAGES: { key: string; label: string; group: number }[] = [
  { key: 'ask_images',         label: '1. Ask Images',         group: 1 },
  { key: 'match_pending',      label: '2. Matching',           group: 2 },
  { key: 'match_confirmed',    label: '2.1 Match Confirmed',   group: 2 },
  { key: 'match_alternate',    label: '2.2 Alternate Price',   group: 2 },
  { key: 'match_reorder',      label: '2.3 Reorder',           group: 2 },
  { key: 'match_cancelled',    label: '2.4 Cancellation',      group: 2 },
  { key: 'processing',         label: '3. Processing',         group: 3 },
  { key: 'delivery_confirmed', label: '4. Delivery Confirmed', group: 4 },
  { key: 'installation',       label: '5. Installation',       group: 5 },
  { key: 'feedback_pending',   label: '6. Feedback Pending',   group: 6 },
  { key: 'completed',          label: '7. Completed',          group: 7 },
];

// Build a shipment tracking URL from a partner's template
export const buildTrackingUrl = (template: string | undefined | null, trackingNumber: string | undefined | null) => {
  if (!template || !trackingNumber) return null;
  return template.replace('{tracking_number}', encodeURIComponent(trackingNumber));
};

// ── Error message extractor ───────────────────────────────────────────────────
export const getErrorMessage = (err: unknown): string => {
  if (!err) return 'An unexpected error occurred.';
  const e = err as { message?: string; response?: { data?: { message?: string; errors?: { message: string }[] } } };
  if (e.response?.data?.errors?.length) {
    return e.response.data.errors.map((x) => x.message).join(', ');
  }
  if (e.response?.data?.message) {
    return e.response.data.message;
  }
  if (e.message === 'Network Error' || !e.response) {
    return 'Unable to connect to backend server. Please verify backend API URL / deployment settings.';
  }
  return e.message || 'An unexpected error occurred.';
};

// ── Truncate text ─────────────────────────────────────────────────────────────
export const truncate = (str: string | null | undefined, len = 40) =>
  str && str.length > len ? str.slice(0, len) + '…' : (str ?? '');

// ── Media / Document URL Resolver ─────────────────────────────────────────────
/**
 * Resolves the backend base URL dynamically with fallback for production domains
 */
export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (envUrl) {
    const candidate = envUrl.split(',')[0].trim().replace(/\/+$/, '').replace(/\/api$/, '');
    if (typeof window !== 'undefined') {
      // If current browser page is HTTPS and backend URL is HTTP (not localhost), upgrade to prevent Mixed Content
      if (window.location.protocol === 'https:' && candidate.startsWith('http://') && !candidate.includes('localhost') && !candidate.includes('127.0.0.1')) {
        return candidate.replace(/^http:\/\//i, 'https://');
      }
      // If deployed on vasifytech domain but env was baked with localhost, override to live backend
      if (window.location.hostname.includes('vasifytech.com') && (candidate.includes('localhost') || candidate.includes('127.0.0.1'))) {
        return 'https://krishabackend.vasifytech.com';
      }
    }
    return candidate;
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('vasifytech.com')) {
      return 'https://krishabackend.vasifytech.com';
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  return 'https://krishabackend.vasifytech.com';
};

/**
 * Resolves any customer image object, relative media path, S3 key, or direct S3 URL
 * into a valid, renderable image URL for <img> tags without 401/403/404 errors.
 */
export const getMediaUrl = (input: any): string => {
  if (!input) return '';

  // 1. If an image object was passed (e.g. CustomerImage), select best candidate URL
  if (typeof input === 'object' && input !== null) {
    const candidate =
      input.proxy_view_url ||
      (input.presigned_url && input.presigned_url.includes('X-Amz-Signature') ? input.presigned_url : null) ||
      input.presigned_url ||
      input.view_url ||
      input.file_url ||
      (input.s3_key ? `customer_images/${input.s3_key}` : null);
    return getMediaUrl(candidate);
  }

  const filePath = String(input).trim();
  if (!filePath) return '';

  const apiBase = getApiBaseUrl();

  // 2. Handle absolute URLs (http:// or https://)
  if (/^https?:\/\//i.test(filePath)) {
    // If it's a signed S3 URL with active AWS signature, browser can fetch directly from S3
    if (filePath.includes('X-Amz-Signature') || filePath.includes('X-Amz-Algorithm')) {
      return filePath;
    }

    // If it's an unsigned direct S3 URL (returns 403 because bucket is private),
    // extract key and route through backend view proxy or static fallback
    if (filePath.includes('.amazonaws.com/')) {
      const parts = filePath.split('.amazonaws.com/');
      let key = parts[1] ? parts[1].split('?')[0] : '';
      if (key.includes('krishna-crm/')) {
        key = key.split('krishna-crm/')[1];
      }
      return `${apiBase}/api/orders/images/view?key=${encodeURIComponent(key)}`;
    }

    // Upgrade insecure HTTP to HTTPS on production pages to prevent mixed content blocking
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && filePath.startsWith('http://') && !filePath.includes('localhost') && !filePath.includes('127.0.0.1')) {
      return filePath.replace(/^http:\/\//i, 'https://');
    }

    return filePath;
  }

  // 3. Extract relative path if string contains absolute disk path (e.g. /opt/... or C:\...\uploads\...)
  const uploadsIdx = filePath.indexOf('uploads');
  if (uploadsIdx !== -1) {
    const rel = filePath.substring(uploadsIdx).replace(/\\/g, '/');
    return `${apiBase}/${rel}`;
  }

  const clean = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (clean.startsWith('customer_images/')) {
    return `${apiBase}/uploads/${clean}`;
  }
  return `${apiBase}/${clean}`;
};