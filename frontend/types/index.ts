// ── Shared pagination ─────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  status: string;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  name: string;
  description?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  data_scope: string;
  is_system: boolean;
  permissions?: Permission[];
}

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_id: string;
  is_allowed: boolean;
  permission?: Permission;
}

// ── User ──────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: 'admin' | 'super_admin' | 'manager' | 'employee' | 'hr' | 'sales' | 'support' | 'ceo' | 'telecaller' | 'technician' | 'reviewer' | 'accountant' | 'spn_ads_manager' | 'senior_account_manager' | 'delivery_boy' | 'ecommerce_executive' | string;
  status?: 'active' | 'inactive' | 'suspended' | 'pending_activation' | 'archived';
  is_active: boolean;
  phone?: string;
  department?: string;
  designation?: string;
  employee_id?: string;
  reporting_manager_id?: string;
  is_locked?: boolean;
  locked_reason?: string;
  locked_at?: string;
  force_password_reset?: boolean;
  temp_password_created_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  avatar_url?: string;
  last_login_at?: string;
  permissions?: string[];
  display_password?: string;
  created_at: string;
}

export interface LoginHistoryLog {
  id: string;
  user_id?: string;
  email: string;
  login_at: string;
  ip_address?: string;
  user_agent?: string;
  browser?: string;
  os?: string;
  device?: string;
  status: 'success' | 'failed' | 'locked' | 'suspended' | 'pending_activation' | 'inactive';
  failure_reason?: string;
}

export interface UserAuditLogEntry {
  id: string;
  actor_user_id?: string;
  target_user_id?: string;
  event_type: string;
  module: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AccessTemplateItem {
  id: string;
  name: string;
  description?: string;
  role_id?: string;
  permissions?: string[];
  created_by?: string;
  created_at: string;
}

// ── Customer ──────────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country: string;
  source: 'amazon' | 'flipkart' | 'indiamart' | 'akuabeat_website' | 'website' | 'direct' | 'other';
  status: 'active' | 'inactive' | 'blocked';
  // CR4 — post-sale journey
  lifecycle_stage: 'prospect' | 'customer' | 'installation_pending' | 'installation_done' | 'feedback_pending' | 'engaged';
  installation_sent_at?: string;
  installation_confirmed_at?: string;
  feedback_collected_at?: string;
  engagement_notes?: string;
  tags?: string[];
  notes?: string;
  total_orders: number;
  total_revenue: number;
  assigned_to?: string;
  whatsapp_opt_in: boolean;
  last_contacted_at?: string;
  assignedUser?: User;
  orders?: Order[];
  warranties?: any[];
  warrantyReturns?: any[];
  callLogs?: any[];
  followUps?: FollowUp[];
  created_at: string;
  updated_at: string;
}

// ── Order ─────────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'image_verification'    // CR1 — awaiting product image approval
  | 'pending_confirmation'
  | 'confirmed'
  | 'processing'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type VerificationStatus =
  | 'pending_verification'
  | 'screenshot_requested'
  | 'image_received'
  | 'verification_in_review'
  | 'sku_matched'
  | 'sku_mismatched'
  | 'image_unreadable'
  | 'product_not_found'
  | 'pending_confirmation'
  | 'confirmed'
  | 'cancelled'
  | 'verification_exception';

export interface ProductMaster {
  sku: string;
  product_name: string;
  category: string;
  model: string;
  mrp: number;
  price: number;
  status: string;
  specifications?: string;
  is_generated?: boolean;
}

export type FlowStage  = 'ask_images' | 'match_pending' | 'match_confirmed' | 'match_alternate' | 'match_reorder' | 'match_cancelled' | 'processing' | 'delivery_confirmed' | 'installation' | 'feedback_pending' | 'completed';
export type Marketplace = 'amazon' | 'flipkart' | 'indiamart' | 'akuabeat_website' | 'website' | 'direct' | 'other';

export interface Order {
  id: string;
  order_number: string;
  marketplace_order_id?: string;
  marketplace: Marketplace;
  channel?: string;
  sub_channel?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  shipping_address?: any;
  customer?: Customer;
  status: OrderStatus;
  verification_status?: VerificationStatus;
  verified_by?: string;
  verifier?: User;
  verified_at?: string;
  verification_notes?: string;
  confirmation_sent_at?: string;
  customer_confirmed_at?: string;
  screenshot_requested_at?: string;
  screenshot_received_at?: string;
  second_message_due_at?: string;
  second_message_sent_at?: string;
  confirmation_message_sent_at?: string;
  delivered_message_sent_at?: string;
  flow_stage: FlowStage;
  images_provided: boolean;
  image_rejection_reason?: string;        // CR1
  product_name?: string;
  product_sku?: string;
  quantity: number;
  unit_price?: number;
  total_amount?: number;
  discount_amount: number;
  shipping_charge: number;
  shipping_partner?: string;
  tracking_number?: string;
  delivery_pincode?: string;
  estimated_delivery_date?: string;
  dispatched_at?: string;
  delivered_at?: string;
  whatsapp_confirmation_sent: boolean;
  whatsapp_dispatch_sent: boolean;
  whatsapp_delivery_sent: boolean;
  assigned_to?: string;
  assignedUser?: User;
  internal_notes?: string;
  customer_feedback?: string;
  feedback_rating?: number;
  feedback_status: 'not_collected' | 'happy' | 'unhappy' | 'escalated' | 'resolved'; // CR7
  feedback_issue_notes?: string;          // CR7
  order_date?: string;
  import_batch_id?: string;
  importBatch?: CsvBatch;
  activities?: OrderActivity[];
  customerImages?: CustomerImage[];
  warranty?: any;
  created_at: string;
  updated_at: string;
}

export interface CustomerImage {
  id: string;
  order_id?: string | null;
  customer_id?: string | null;
  wa_message_id?: string | null;
  media_id?: string | null;
  s3_key?: string | null;
  file_url?: string | null;
  presigned_url?: string | null;
  view_url?: string | null;
  proxy_view_url?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  image_type?: string;
  status: 'received' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  reviewer?: { id: string; name: string };
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  uploaded_at: string;
}

export interface OrderActivity {
  id: string;
  order_id: string;
  user_id?: string;
  user?: User;
  action: string;
  from_value?: string;
  to_value?: string;
  note?: string;
  created_at: string;
}

// ── Follow-Up ─────────────────────────────────────────────────────────────────
export type FollowUpStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
export type FollowUpType   = 'call' | 'whatsapp' | 'email' | 'visit' | 'other';
export type Priority       = 'low' | 'medium' | 'high' | 'urgent';

export interface FollowUp {
  id: string;
  customer_id: string;
  customer?: Customer;
  order_id?: string;
  order?: Order;
  assigned_to: string;
  assignedUser?: User;
  type: FollowUpType;
  status: FollowUpStatus;
  priority: Priority;
  subject: string;
  notes?: string;
  outcome?: string;
  due_at: string;
  completed_at?: string;
  next_followup_at?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

// ── Task ──────────────────────────────────────────────────────────────────────
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_to: string;
  assignedUser?: User;
  created_by: string;
  creator?: User;
  customer_id?: string;
  customer?: Customer;
  order_id?: string;
  order?: Order;
  status: TaskStatus;
  priority: Priority;
  due_date?: string;
  completed_at?: string;
  tags?: string[];
  notes?: string;
  progress_percent: number;
  // SOW §3.7 — Task Score Management
  score?: number;
  score_comment?: string;
  scored_by?: string;
  scorer?: User;
  scored_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Task Score Dashboard ──────────────────────────────────────────────────────
export interface TaskScoreEntry {
  id: string;
  name: string;
  role: string;
  total_tasks: number;
  completed_tasks: number;
  scored_tasks: number;
  avg_score: number | null;
  min_score: number | null;
  max_score: number | null;
  pending_score_count: number;
}

export interface TaskScoreDashboard {
  scoreTable: TaskScoreEntry[];
  distribution: { bucket: string; count: number }[];
  summary: { total_scored: number; overall_avg_score: number | null; pending_score_count: number };
}

// ── CSV Batch ─────────────────────────────────────────────────────────────────
export interface CsvBatch {
  id: string;
  uploaded_by: string;
  uploader?: User;
  marketplace: 'amazon' | 'flipkart' | 'indiamart' | 'akuabeat_website' | 'website' | 'direct' | 'other';
  channel?: string;
  filename: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed' | 'partial';
  total_rows: number;
  processed_rows: number;
  success_rows: number;
  failed_rows: number;
  duplicate_rows: number;
  existing_customers_reused?: number;
  error_log?: { row?: number; rowIndex?: number; field?: string; error?: string; errors?: string[] }[];
  processed_at?: string;
  processedAt?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at?: string;
  createdAt?: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardKpis {
  employees?: {
    total: number;
    presentToday: number;
    onboarded: number;
    pendingOnboarding: number;
  };
  orders: {
    today: number;
    pendingDispatch: number;
    overdueDispatch: number;
    total: number;
    delivered?: number;
    returned?: number;
    byStatus: { status: string; count: number }[];
    byMarketplace: { marketplace: string; count: number; revenue: number }[];
    byProduct: { product_name: string; count: number; revenue: number }[];
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    allTime?: number;
    total?: number;
    confirmedThisMonth?: number;
    confirmedAllTime?: number;
    growthPercent: number | null;
    byDay: { date: string; revenue: number; orders: number }[];
  };
  customers: {
    active: number;
    inactive?: number;
    newThisMonth: number;
    total: number;
  };
  warranty?: {
    total: number;
    activated: number;
    pending: number;
  };
  followUps: { pending: number; overdue: number };
  tasks: { open: number; overdue: number };
  cityWise: {
    city: string;
    customer_count: number;
    order_count: number;
    revenue: number;
  }[];
}

// ── Shipping ──────────────────────────────────────────────────────────────────
export interface ShippingPartner {
  id: string;
  name: string;
  code: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  tracking_url_template?: string;
  default_tat_days?: number;
  is_active: boolean;
  notes?: string;
  serviceability?: PincodeServiceability[];
  created_at: string;
  updated_at: string;
}

export interface PincodeServiceability {
  id: string;
  pincode: string;
  city?: string;
  state?: string;
  shipping_partner_id?: string;
  shippingPartner?: ShippingPartner;
  is_serviceable: boolean;
  tat_days: number;
  cod_available: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ShippingDashboard {
  pendingDispatch: number;
  inTransit: number;
  deliveredToday: number;
  byPartner: { shipping_partner: string; count: number }[];
  noTracking: number;
}

export interface ServiceabilityCheck {
  pincode: string;
  serviceable: boolean | null;
  bestOption: PincodeServiceability | null;
  entries: PincodeServiceability[];
  message?: string;
}

// ── CR2 — Manual Call Log ─────────────────────────────────────────────────────
export type CallOutcome = 'answered' | 'no_answer' | 'busy' | 'callback_requested' | 'confirmed' | 'rejected' | 'escalated';
export type CallContext = 'image_collection' | 'reorder_assistance' | 'feedback_resolution' | 'general';

export interface ManualCallLog {
  id: string;
  order_id?: string;
  order?: Order;
  customer_id?: string;
  customer?: Customer;
  user_id: string;
  user?: User;
  call_type: 'outbound' | 'inbound';
  phone_used?: string;
  duration_seconds?: number;
  outcome: CallOutcome;
  context: CallContext;
  notes?: string;
  called_at: string;
  created_at: string;
  updated_at: string;
}

// ── Employee Document Management (SOW §3.6) ───────────────────────────────────
export type DocumentType =
  | 'id_proof' | 'address_proof' | 'photo' | 'pan_card' | 'aadhaar_card'
  | 'offer_letter' | 'appointment_letter' | 'relieving_letter'
  | 'experience_letter' | 'educational_certificate' | 'bank_passbook' | 'resume' | 'other';

export type DocumentStatus = 'missing' | 'uploaded' | 'under_review' | 'verified' | 'rejected';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type OnboardingStatus = 'pending' | 'in_progress' | 'completed' | 'waived';

// ── Employee (list-view row) ──────────────────────────────────────────────────
export type EmployeeStatus = 'active' | 'inactive' | 'terminated';

export interface Employee {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  phone?: string;
  employee_code?: string;
  department?: string;
  designation?: string;
  employment_type: EmploymentType;
  date_of_joining?: string;
  date_of_leaving?: string;
  probation_end_date?: string;
  confirmation_date?: string;
  exit_date?: string;
  exit_reason?: string;
  handover_notes?: string;
  offboarded_by?: string;
  offboarded_at?: string;
  salary?: number;
  status: EmployeeStatus;
  onboarding_status?: OnboardingStatus;
  onboarding_completion?: number;
  missing_docs?: string[];
  doc_count?: number;
  verified_doc_count?: number;
  reporting_manager?: string;
  reporting_manager_id?: string;
  completeness?: number;
  linkedUser?: User;
  reportingManager?: User;
  biometricMapping?: EmployeeBiometricMapping;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeProfile {
  id: string;
  user_id: string;
  user?: User;
  // Personal
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  blood_group?: string;
  personal_email?: string;
  personal_phone?: string;
  present_address?: string;
  permanent_address?: string;
  // Job
  employee_code?: string;
  department?: string;
  designation?: string;
  date_of_joining?: string;
  date_of_leaving?: string;
  probation_end_date?: string;
  confirmation_date?: string;
  exit_date?: string;
  exit_reason?: string;
  handover_notes?: string;
  employment_type: EmploymentType;
  reporting_manager_id?: string;
  reporting_manager?: string;
  reportingManager?: User;
  work_location?: string;
  salary?: number;
  // Bank
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  pan_number?: string;
  aadhaar_last4?: string;
  uan_number?: string;
  // Emergency
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  // Meta
  profile_completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Payroll Profile & Records ────────────────────────────────────────────────
export interface PayrollProfile {
  id?: string;
  employee_id: string;
  salary_type: 'monthly' | 'hourly';
  basic_salary: number;
  fixed_allowances: number;
  fixed_deductions: number;
  net_payable_reference: number;
  effective_from?: string | null;
  payment_method: 'bank_transfer' | 'cheque' | 'cash' | 'upi';
  bank_account_reference?: string;
  bank_name?: string;
  bank_ifsc?: string;
  pan_number?: string;
  status: 'active' | 'inactive' | 'on_hold';
  is_draft?: boolean;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  payroll_month: string;
  gross_amount: number;
  allowances: number;
  deductions: number;
  net_amount: number;
  payment_status: 'draft' | 'approved' | 'processed' | 'cancelled';
  processed_by?: string;
  processed_at?: string;
  payment_method?: string;
  transaction_reference?: string;
  remarks?: string;
  employee?: {
    id: string;
    employee_code?: string;
    first_name: string;
    last_name: string;
    department?: string;
    designation?: string;
    email?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: DocumentType;
  document_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  status: DocumentStatus;
  version?: number;
  is_current?: boolean;
  replaced_by?: string;
  verified_by?: string;
  verifier?: User;
  verified_at?: string;
  rejection_reason?: string;
  remarks?: string;
  review_requested_at?: string;
  expiry_date?: string;
  notes?: string;
  uploaded_by: string;
  uploader?: User;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistItem {
  type: DocumentType;
  label: string;
  status: DocumentStatus;
  doc_id?: string | null;
  updated_at?: string | null;
  rejection_reason?: string | null;
  remarks?: string | null;
}

export interface OnboardingProgress {
  checklist: OnboardingChecklistItem[];
  completion_percent: number;
  verified_percent: number;
  missing_docs: string[];
  is_complete: boolean;
}

export interface EmployeeDetail extends Employee {
  onboarding_progress?: OnboardingProgress;
  documents?: EmployeeDocument[];
}

export interface DocumentCenterEmployee {
  id: string;
  employee_code?: string;
  full_name: string;
  email?: string;
  phone?: string;
  department: string;
  designation: string;
  role: string;
  reporting_manager: string;
  onboarding_status: OnboardingStatus;
  onboarding_completion: number;
  verified_percent: number;
  missing_docs: string[];
  pending_review_count: number;
  rejected_count: number;
  documents: EmployeeDocument[];
  checklist: OnboardingChecklistItem[];
  user_id?: string;
  is_super_admin: boolean;
}

export interface OnboardingDashboardWidgets {
  pending_onboarding: number;
  incomplete_documentation: number;
  rejected_documents: number;
  verification_requests: number;
  total_employees: number;
}

// ── Daily Activities Module ──────────────────────────────────────────────────
export type DailyActivityStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'INCOMPLETE'
  | 'LATE'
  | 'PENDING'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface DailyActivityHistory {
  id: string;
  activity_id: string;
  actor_id: string;
  actor?: User;
  event_type:
    | 'ACTIVITY_CREATED'
    | 'ACTIVITY_ASSIGNED'
    | 'ACTIVITY_STARTED'
    | 'ACTIVITY_COMPLETED'
    | 'ACTIVITY_INCOMPLETE'
    | 'ACTIVITY_LATE'
    | 'STATUS_CHANGED'
    | 'COMMENT_ADDED'
    | 'HOURS_LOGGED'
    | 'ACTIVITY_UPDATED';
  old_status?: string;
  new_status: string;
  notes?: string;
  created_at: string;
}

export interface DailyActivity {
  id: string;
  title: string;
  description: string;
  assigned_by: string;
  assigner?: User;
  assigned_to: string;
  assignee?: User;
  priority: 'low' | 'medium' | 'high' | 'urgent' | Priority;
  category?: string;
  scheduled_date?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completion_notes?: string;
  notes?: string;
  status: DailyActivityStatus;
  assigned_at: string;
  started_at?: string;
  completed_at?: string;
  shift_duration?: number; // in hours (default: 24)
  history?: DailyActivityHistory[];
  created_at: string;
  updated_at: string;
}

export interface DailyActivityKPIs {
  total: number;
  assigned: number;
  in_progress: number;
  completed: number;
  blocked: number;
  incomplete: number;
  late: number;
  total_estimated_hours?: number;
  total_actual_hours?: number;
}

export interface DailyCalendarDaySummary {
  scheduled_date: string;
  total_count: number;
  completed_count: number;
  pending_count: number;
}

export interface DailyStatsSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  blocked: number;
  late: number;
  completion_rate: number;
  total_estimated_hours: number;
  total_actual_hours: number;
}

export interface PersonalScorecardData {
  myTotalTasks: number;
  myCompletedTasks: number;
  overallCompletionRate: number;
  today: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    blocked: number;
    completionRate: number;
  };
  completedTasks: DailyActivity[];
}

export interface DailyActivityAnalytics {
  user: User;
  assigned: number;
  in_progress: number;
  completed: number;
  blocked?: number;
  incomplete: number;
  late: number;
  total: number;
  completion_rate: number;
}

// ── Daily Task Module (Legacy) ───────────────────────────────────────────────
export type DailyTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'INCOMPLETE' | 'LATE';

export interface DailyTaskHistory {
  id: string;
  daily_task_id: string;
  changed_by: string;
  changer?: User;
  field_changed: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface DailyTask {
  id: string;
  title: string;
  description?: string;
  assigned_by: string;
  assigner?: User;
  assigned_to: string;
  assignee?: User;
  priority: Priority;
  due_date?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  shift_duration?: number;
  status: any;
  remarks?: string;
  history?: DailyTaskHistory[];
  created_at: string;
  updated_at: string;
}

export interface DailyTaskKPIs {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

// ── Warranty ─────────────────────────────────────────────────────────────────
export type WarrantyStatusEnum =
  | 'PENDING_DELIVERY'
  | 'DELIVERED'
  | 'INSTALLATION_PENDING'
  | 'INSTALLATION_COMPLETED'
  | 'ACTIVATION_MESSAGE_SCHEDULED'
  | 'ACTIVATION_MESSAGE_SENT'
  | 'ACTIVATION_PENDING'
  | 'ACTIVE'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_PICKUP_SCHEDULED'
  | 'RETURNED'
  | 'RETURN_REJECTED'
  | 'WARRANTY_VOIDED'
  | 'WARRANTY_EXPIRED'
  | 'WARRANTY_CANCELLED'
  | 'inactive'
  | 'pending_activation'
  | 'active'
  | 'return_initiated'
  | 'return_approved'
  | 'expired'
  | 'voided'
  | string;

export type ReturnStatusEnum =
  | 'NONE'
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'RECEIVED'
  | 'INSPECTED'
  | 'ACCEPTED'
  | 'CLOSED'
  | string;

export interface WarrantyEvent {
  id: string;
  warranty_id: string;
  actor_user_id?: string;
  actor?: User;
  event_type: string;
  from_status?: string;
  to_status?: string;
  source_type?: string;
  source_id?: string;
  title: string;
  description: string;
  metadata?: any;
  timestamp: string;
  created_at?: string;
}

export interface WarrantyDocument {
  id: string;
  warranty_id: string;
  file_name: string;
  file_path: string;
  mime_type?: string;
  file_size?: number;
  uploaded_at: string;
}

export interface WarrantyMessage {
  id: string;
  warranty_id: string;
  customer_id?: string;
  phone_number: string;
  template_key: string;
  channel: string;
  scheduled_at?: string;
  sent_at?: string;
  provider_message_id?: string;
  delivery_status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | string;
  failure_reason?: string;
  attempt_count: number;
  idempotency_key: string;
  activation_token?: string;
  activation_url?: string;
  created_at: string;
  updated_at: string;
}

export interface WarrantyReturn {
  id: string;
  return_number: string;
  warranty_id: string;
  warranty?: Warranty;
  order_id?: string;
  order?: Order;
  customer_id: string;
  customer?: Customer;
  requested_at: string;
  request_source: string;
  reason_code?: string;
  reason_text: string;
  photos_json?: string[];
  documents_json?: string[];
  status: ReturnStatusEnum;
  approved_by?: string;
  approver?: User;
  approved_at?: string;
  rejection_reason?: string;
  pickup_id?: string;
  pickup_partner?: string;
  pickup_tracking_number?: string;
  pickup_scheduled_date?: string;
  picked_up_at?: string;
  received_at?: string;
  inspected_at?: string;
  inspection_result?: string;
  inspection_notes?: string;
  refund_id?: string;
  replacement_order_id?: string;
  replacement_warranty_id?: string;
  closed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WarrantyServiceRequest {
  id: string;
  service_request_number: string;
  warranty_id: string;
  customer_id: string;
  technician_id?: string;
  technician?: User;
  created_by?: string;
  creator?: User;
  issue: string;
  description?: string;
  priority: string;
  status: string;
  resolution?: string;
  parts_used?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WarrantyStats {
  total: number;
  pendingDelivery: number;
  installationPending: number;
  activationPending: number;
  active: number;
  inactive?: number;
  expiringSoon: number;
  returnRequested: number;
  returned: number;
  expired: number;
  openServiceRequests: number;
}

export interface Warranty {
  id: string;
  warranty_number: string;
  customer_id: string;
  customer?: Customer;
  order_id?: string;
  order?: Order;
  order_item_id?: string;
  product_id?: string;
  product_name_snapshot: string;
  brand_snapshot?: string;
  model_snapshot?: string;
  serial_number?: string;
  unit_identifier?: string;
  marketplace?: string;
  purchase_date: string;
  delivery_id?: string;
  delivery_partner?: string;
  tracking_number?: string;
  delivered_at?: string;
  installation_id?: string;
  installation_completed_at?: string;
  activation_due_at?: string;
  activation_message_id?: string;
  activation_sent_at?: string;
  activated_at?: string;
  warranty_start_at?: string;
  warranty_end_at?: string;
  warranty_start_date: string;
  warranty_end_date: string;
  status: string;
  verification_status: string;
  registration_source?: string;
  terms_accepted?: boolean;
  privacy_accepted?: boolean;
  registered_at?: string;
  verified_at?: string;
  verified_by?: string;
  verifier?: User;
  rejection_reason?: string;

  // Extended Lifecycle & Reset fields
  warranty_status: WarrantyStatusEnum;
  return_status?: ReturnStatusEnum;
  return_requested_at?: string;
  returned_at?: string;
  returned_reason?: string;
  return_id?: string;
  cancellation_reason?: string;
  warranty_activation_date?: string;
  warranty_expiry_date?: string;
  warranty_reset_date?: string;
  warranty_reset_by?: string;
  resetByUser?: User;
  warranty_reset_reason?: string;
  is_returned: boolean;

  documents?: WarrantyDocument[];
  returns?: WarrantyReturn[];
  messages?: WarrantyMessage[];
  serviceRequests?: WarrantyServiceRequest[];
  events?: WarrantyEvent[];
  created_at: string;
  updated_at: string;
}

// ── Biometric Attendance Module ───────────────────────────────────────────────
export type BiometricDeviceStatus = 'online' | 'degraded' | 'offline' | 'auth_error' | 'sync_error';
export type BiometricEnrollmentStatus = 'not_enrolled' | 'pending_enrollment' | 'enrolled' | 'sync_failed' | 'disabled';
export type AttendanceStatusType =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ON_LEAVE'
  | 'HOLIDAY'
  | 'WEEK_OFF'
  | 'WORK_FROM_HOME'
  | 'INCOMPLETE'
  | 'EARLY_LEAVE'
  | 'OVERTIME';

export interface BiometricDevice {
  id: string;
  device_name: string;
  serial_number: string;
  smartoffice_device_id?: string;
  device_type: string;
  location: string;
  ip_address?: string;
  port?: number;
  status: BiometricDeviceStatus;
  last_sync_at?: string;
  last_successful_log_fetch_at?: string;
  error_count: number;
  last_error_message?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeBiometricMapping {
  id: string;
  employee_id: string;
  employee_code: string;
  smartoffice_employee_code?: string;
  device_id?: string;
  device_serial_number?: string;
  biometric_user_id?: string;
  fingerprint_enabled: boolean;
  face_enabled: boolean;
  card_enabled: boolean;
  card_number?: string;
  enrollment_status: BiometricEnrollmentStatus;
  last_synced_at?: string;
  sync_error?: string;
  device?: BiometricDevice;
  created_at: string;
  updated_at: string;
}

export interface BiometricPunchEvent {
  id: string;
  employee_code: string;
  employee_id?: string;
  device_id?: string;
  device_serial_number?: string;
  punch_timestamp: string;
  punch_date: string;
  punch_direction: 'IN' | 'OUT' | 'UNKNOWN';
  temperature?: number;
  temperature_state?: string;
  source: 'BIOMETRIC' | 'MANUAL' | 'HYBRID';
  external_event_hash: string;
  raw_payload?: any;
  processing_status: 'PENDING' | 'PROCESSED' | 'DUPLICATE' | 'UNMAPPED' | 'ERROR';
  processed_at?: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code?: string;
    department?: string;
  };
  created_at: string;
}

export interface AttendanceShift {
  id: string;
  shift_name: string;
  shift_code: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  late_after_minutes: number;
  early_leave_before_minutes: number;
  min_full_day_hours: number;
  min_half_day_hours: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AttendanceSegment {
  id: string;
  attendance_day_id: string;
  employee_id: string;
  segment_type: 'WORK' | 'BREAK';
  in_time: string;
  out_time?: string;
  duration_minutes: number;
}

export interface AttendanceCorrection {
  id: string;
  attendance_day_id?: string;
  employee_id: string;
  correction_date: string;
  original_in?: string;
  original_out?: string;
  original_status?: string;
  corrected_in?: string;
  corrected_out?: string;
  corrected_status?: string;
  reason: string;
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code?: string;
    department?: string;
  };
  requester?: User;
  approver?: User;
  created_at: string;
  updated_at: string;
}

export interface AttendanceDay {
  id: string;
  employee_id: string;
  employee_code?: string;
  employee_name?: string;
  department?: string;
  designation?: string;
  date: string;
  shift_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  clock_in?: string | null;
  clock_out?: string | null;
  first_in?: string | null;
  last_out?: string | null;
  total_work_minutes?: number;
  total_break_minutes?: number;
  work_hours: number;
  break_hours?: number;
  late_minutes?: number;
  early_leave_minutes?: number;
  overtime_minutes?: number;
  status: AttendanceStatusType;
  source: 'BIOMETRIC' | 'MANUAL' | 'HYBRID';
  is_locked?: boolean;
  is_corrected: boolean;
  remarks?: string;
  biometric_enrolled?: boolean;
  device_serial?: string;
  segments?: AttendanceSegment[];
}

export interface AttendanceSummaryMetrics {
  total_workforce: number;
  active_staff: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  incomplete_today: number;
  on_leave_today: number;
  pending_biometrics: number;
  devices_online: number;
  total_devices: number;
}

export interface IntegrationSyncState {
  id: string;
  integration_name: string;
  last_successful_cursor?: string;
  last_successful_timestamp?: string;
  last_attempt_at?: string;
  last_success_at?: string;
  last_error?: string;
  status: 'healthy' | 'degraded' | 'failing' | 'syncing';
  sync_count: number;
}

