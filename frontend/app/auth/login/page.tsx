'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { Input, Button } from '@/components/ui';
import { getErrorMessage } from '@/lib/utils';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Lock,
  Mail,
  Shield,
  UserCheck,
  Briefcase,
  UserCog,
  ShoppingBag,
  Eye,
  EyeOff,
  PhoneCall,
  Wrench,
  Copy,
  Check,
  Key,
  ArrowRight,
  ShieldCheck,
  Calculator,
  Truck,
  Star,
  TrendingUp,
  Layers,
  Search,
  Building2,
  RefreshCw,
} from 'lucide-react';

const getRoleIcon = (role: string) => {
  const r = (role || '').toLowerCase();
  if (r.includes('admin') || r.includes('ceo')) return Shield;
  if (r.includes('sam') || r.includes('senior') || r.includes('manager')) return UserCheck;
  if (r.includes('hr')) return UserCog;
  if (r.includes('telecaller')) return PhoneCall;
  if (r.includes('sales')) return ShoppingBag;
  if (r.includes('tech')) return Wrench;
  if (r.includes('account')) return Calculator;
  if (r.includes('delivery')) return Truck;
  if (r.includes('ecom')) return Layers;
  if (r.includes('review')) return Star;
  if (r.includes('spn')) return TrendingUp;
  if (r.includes('support')) return ShieldCheck;
  return Briefcase;
};

const getRoleBadgeColor = (role: string) => {
  const r = (role || '').toLowerCase();
  if (r.includes('admin') || r.includes('ceo')) return 'bg-red-50 text-red-700 border-red-200';
  if (r.includes('sam') || r.includes('senior')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (r.includes('manager') || r.includes('spn')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (r.includes('hr')) return 'bg-pink-50 text-pink-700 border-pink-200';
  if (r.includes('telecaller')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (r.includes('sales')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (r.includes('tech')) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (r.includes('account')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (r.includes('delivery')) return 'bg-lime-50 text-lime-800 border-lime-200';
  if (r.includes('ecom')) return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
  if (r.includes('review')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const ALL_SYSTEM_ACCOUNTS = [
  {
    name: 'Super Admin',
    roleLabel: 'Super Admin',
    email: 'admin@krishnacrm.com',
    password: 'Admin@123456',
    roleDesc: 'Full unrestricted system access & administration',
    role: 'super_admin',
    department: 'Management',
  },
  {
    name: 'Vikram Malhotra',
    roleLabel: 'Operations Manager',
    email: 'manager@krishnacrm.com',
    password: 'Manager@123456',
    roleDesc: 'Operations, orders & team tasks management',
    role: 'manager',
    department: 'Operations',
  },
  {
    name: 'Pooja Hegde',
    roleLabel: 'HR Executive',
    email: 'hr@krishnacrm.com',
    password: 'Hr@123456',
    roleDesc: 'Employee onboarding, attendance & audits',
    role: 'hr',
    department: 'Human Resources',
  },
  {
    name: 'Neha Sharma',
    roleLabel: 'Telecaller',
    email: 'telecaller@krishnacrm.com',
    password: 'Telecaller@123456',
    roleDesc: 'Customer calls, follow-ups & verification',
    role: 'telecaller',
    department: 'Customer Support',
  },
  {
    name: 'Yash',
    roleLabel: 'Telecaller',
    email: 'yash.telecaller@nityamenterprises.com',
    password: 'Telecaller@123456',
    roleDesc: 'Inbound customer calls & lead routing',
    role: 'telecaller',
    department: 'Customer Support',
  },
  {
    name: 'Meenakshi',
    roleLabel: 'Telecaller',
    email: 'meenakshi.telecaller@nityamenterprises.com',
    password: 'Telecaller@123456',
    roleDesc: 'Outbound dispatch confirmations & customer care',
    role: 'telecaller',
    department: 'Customer Support',
  },
  {
    name: 'Rahul Deshmukh',
    roleLabel: 'Sales Executive',
    email: 'sales@krishnacrm.com',
    password: 'Sales@123456',
    roleDesc: 'Direct sales orders & customer pipeline',
    role: 'sales',
    department: 'Sales',
  },
  {
    name: 'Amit Shinde',
    roleLabel: 'Field Technician',
    email: 'technician@krishnacrm.com',
    password: 'Technician@123456',
    roleDesc: 'Installation tickets & warranty repairs',
    role: 'technician',
    department: 'Field Services',
  },
  {
    name: 'Sanjay',
    roleLabel: 'Accountant',
    email: 'sanjay.accountant@leretailproject.com',
    password: 'Accountant@123456',
    roleDesc: 'Ledger entries, invoicing & bank recon',
    role: 'accountant',
    department: 'Finance & Accounts',
  },
  {
    name: 'Riya',
    roleLabel: 'Accountant',
    email: 'riya.accountant@leretailproject.com',
    password: 'Accountant@123456',
    roleDesc: 'Expense claims & GST filing compliance',
    role: 'accountant',
    department: 'Finance & Accounts',
  },
  {
    name: 'Priti',
    roleLabel: 'Accountant',
    email: 'priti.accountant@leretailproject.com',
    password: 'Accountant@123456',
    roleDesc: 'Vendor payments & daily accounts reconciliation',
    role: 'accountant',
    department: 'Finance & Accounts',
  },
  {
    name: 'Naushad',
    roleLabel: 'SPN & Ads Manager',
    email: 'smallbusiness.ecs@gmail.com',
    password: 'Manager@123456',
    roleDesc: 'Campaign ROAS, keyword bids & ads analytics',
    role: 'spn_ads_manager',
    department: 'E-Commerce Marketing',
  },
  {
    name: 'Bharat',
    roleLabel: 'Senior Account Manager',
    email: 'bharat.manager@nityamenterprises.com',
    password: 'Manager@123456',
    roleDesc: 'Key accounts, marketplace strategy & escalations',
    role: 'senior_account_manager',
    department: 'Account Management',
  },
  {
    name: 'Manoj',
    roleLabel: 'Delivery / Dispatch',
    email: 'manoj.delivery@krishnacrm.com',
    password: 'Delivery@123456',
    roleDesc: 'Order dispatches, pickups & delivery proof',
    role: 'delivery_boy',
    department: 'Logistics & Dispatch',
  },
  {
    name: 'Shruti',
    roleLabel: 'E-Commerce Executive',
    email: 'shruti.ecom@nityamenterprises.com',
    password: 'Executive@123456',
    roleDesc: 'Marketplace product listings & inventory update',
    role: 'ecommerce_executive',
    department: 'E-Commerce Operations',
  },
  {
    name: 'Faijal',
    roleLabel: 'E-Commerce Executive',
    email: 'faijal.ecom@nityamenterprises.com',
    password: 'Executive@123456',
    roleDesc: 'Stock sync, order packing & marketplace catalog',
    role: 'ecommerce_executive',
    department: 'E-Commerce Operations',
  },
  {
    name: 'Priya',
    roleLabel: 'E-Commerce Executive',
    email: 'priya.ecom@nityamenterprises.com',
    password: 'Executive@123456',
    roleDesc: 'Pricing, promotions & seller panel monitoring',
    role: 'ecommerce_executive',
    department: 'E-Commerce Operations',
  },
  {
    name: 'Sushil',
    roleLabel: 'Product Reviewer',
    email: 'sushil@akuabeat.com',
    password: 'Reviewer@123456',
    roleDesc: 'Marketplace product reviews & quality sentiment',
    role: 'reviewer',
    department: 'Product Quality',
  },
  {
    name: 'Laxmi',
    roleLabel: 'Operations Executive',
    email: 'laxmi.exec@nityamenterprises.com',
    password: 'Employee@123456',
    roleDesc: 'General operational support & customer files',
    role: 'employee',
    department: 'General Operations',
  },
  {
    name: 'Manish',
    roleLabel: 'Operations Executive',
    email: 'manish.exec@nityamenterprises.com',
    password: 'Employee@123456',
    roleDesc: 'Inventory handling & daily dispatch tasks',
    role: 'employee',
    department: 'General Operations',
  },
  {
    name: 'Standard Employee',
    roleLabel: 'Staff Employee',
    email: 'employee@krishnacrm.com',
    password: 'Employee@123456',
    roleDesc: 'Daily shift activities & profile management',
    role: 'employee',
    department: 'Operations',
  },
  {
    name: 'CEO User',
    roleLabel: 'Chief Executive Officer',
    email: 'ceo@krishnacrm.com',
    password: 'Ceo@123456',
    roleDesc: 'Executive oversight, strategic operations & governance',
    role: 'ceo',
    department: 'Executive Management',
  },
  {
    name: 'Customer Support',
    roleLabel: 'Customer Support',
    email: 'support@krishnacrm.com',
    password: 'Support@123456',
    roleDesc: 'Customer queries, ticket escalation & support desk',
    role: 'support',
    department: 'Customer Support',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('admin@krishnacrm.com');
  const [password, setPassword] = useState('Admin@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState(ALL_SYSTEM_ACCOUNTS);
  const [selectedRole, setSelectedRole] = useState('Super Admin');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshingAccounts, setRefreshingAccounts] = useState(false);

  // Search, Category Filter, and Password Reveal
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [revealPasswords, setRevealPasswords] = useState(true);

  const fetchLiveAccounts = useCallback((showToast = false) => {
    setRefreshingAccounts(true);
    api.get('/auth/demo-accounts')
      .then((res) => {
        const serverDemos = res.data?.data;
        if (Array.isArray(serverDemos) && serverDemos.length > 0) {
          const mapped = serverDemos.map((d: any) => ({
            id: d.id,
            name: d.name,
            roleLabel: d.roleLabel || d.role,
            email: d.email,
            password: d.password,
            roleDesc: d.roleDesc || d.department || 'CRM User',
            role: d.role || 'employee',
            department: d.department || 'Operations',
            badgeColor: d.badgeColor || getRoleBadgeColor(d.role),
          }));
          setDemoAccounts(mapped);
          if (showToast) {
            toast.success(`Synchronized ${mapped.length} users from CRM!`, { id: 'sync-users' });
          }
        }
      })
      .catch((err) => {
        console.warn('Could not refresh demo accounts from database', err);
      })
      .finally(() => {
        setRefreshingAccounts(false);
      });
  }, []);

  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (isAuthenticated && storedToken) {
      if (user?.role === 'hr') {
        router.replace('/employees');
      } else if (user?.role === 'telecaller') {
        router.replace('/telecaller');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    fetchLiveAccounts(false);

    // Re-synchronize accounts whenever this window or tab regains focus
    const handleFocus = () => fetchLiveAccounts(false);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchLiveAccounts]);

  const handleSelectAccount = (acc: any) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelectedRole(acc.roleLabel || acc.name);
    setEmailError('');
    setPasswordError('');
    setError('');
    toast.success(`Selected ${acc.name || acc.roleLabel} credentials`, { id: 'role-select' });
  };

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied!`, { id: 'copy-toast' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const validateForm = () => {
    let isValid = true;
    let errEmail = '';
    let errPass = '';

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errEmail = 'Email address is required.';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      errEmail = 'Please enter a valid email address.';
      isValid = false;
    }

    if (!password) {
      errPass = 'Password is required.';
      isValid = false;
    } else if (password.length < 6) {
      errPass = 'Password must be at least 6 characters long.';
      isValid = false;
    }

    setEmailError(errEmail);
    setPasswordError(errPass);
    return isValid;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      const role = useAuthStore.getState().user?.role;
      if (role === 'hr') {
        router.push('/employees');
      } else if (role === 'telecaller') {
        router.push('/telecaller');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Filtered list based on search and category
  const filteredAccounts = demoAccounts.filter((acc) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (acc.name && acc.name.toLowerCase().includes(q)) ||
      (acc.roleLabel && acc.roleLabel.toLowerCase().includes(q)) ||
      (acc.email && acc.email.toLowerCase().includes(q)) ||
      (acc.department && acc.department.toLowerCase().includes(q)) ||
      (acc.role && acc.role.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (selectedCategory === 'all') return true;
    const r = (acc.role || '').toLowerCase();
    if (selectedCategory === 'admin') return r.includes('admin') || r.includes('manager') || r.includes('ceo');
    if (selectedCategory === 'telecaller') return r.includes('telecaller');
    if (selectedCategory === 'accounts') return r.includes('account');
    if (selectedCategory === 'ecom') return r.includes('ecom') || r.includes('spn') || r.includes('delivery') || r.includes('review');
    if (selectedCategory === 'staff') return r.includes('employee') || r.includes('tech') || r.includes('sales') || r.includes('hr');
    return true;
  });

  return (
    <div className="w-full max-w-6xl h-full lg:h-[calc(100vh-2.5rem)] max-h-[880px] min-h-[580px] my-auto flex flex-col justify-center">
      {/* ── Main 2-Part Container ──────────────────────────────────────── */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 grid grid-cols-1 lg:grid-cols-12 h-full max-h-full">
        
        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* PART 1: ALL CREDENTIALS DIRECTORY (Left Side - 7 Cols)          */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 bg-slate-50/70 p-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col h-full min-h-0 overflow-hidden">
          
          {/* 1. Fixed Header */}
          <div className="shrink-0 space-y-2.5 pb-2.5 mb-2 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber/15 text-amber flex items-center justify-center font-bold shrink-0">
                  <Key size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 tracking-tight">System Roles &amp; Credentials</h2>
                  <p className="text-[11px] text-gray-500">Click any user to automatically populate login credentials</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchLiveAccounts(true)}
                  disabled={refreshingAccounts}
                  className="text-[11px] font-semibold flex items-center gap-1 text-gray-600 hover:text-navy px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                  title="Sync live users & passwords from CRM database"
                >
                  <RefreshCw size={11} className={`text-navy ${refreshingAccounts ? 'animate-spin' : ''}`} />
                  <span>{refreshingAccounts ? 'Syncing...' : 'Sync'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRevealPasswords(!revealPasswords)}
                  className="text-[11px] font-semibold flex items-center gap-1 text-gray-600 hover:text-navy px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
                  title={revealPasswords ? "Mask Passwords" : "Show Plain Passwords"}
                >
                  {revealPasswords ? <EyeOff size={12} className="text-gray-400" /> : <Eye size={12} className="text-amber-600" />}
                  <span>{revealPasswords ? 'Mask' : 'Show All'}</span>
                </button>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-navy text-white shadow-xs">
                  {demoAccounts.length} Roles
                </span>
              </div>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search user by name, role, email, department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] custom-scrollbar">
                {[
                  { id: 'all', label: `All (${demoAccounts.length})` },
                  { id: 'admin', label: 'Admins & Mgrs' },
                  { id: 'telecaller', label: 'Telecallers' },
                  { id: 'accounts', label: 'Accounts' },
                  { id: 'ecom', label: 'E-Commerce' },
                  { id: 'staff', label: 'Field & Staff' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedCategory === tab.id
                        ? 'bg-navy text-amber font-bold shadow-2xs'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Scrollable Role / User Cards List */}
          <div 
            tabIndex={0}
            aria-label="System Roles and User Credentials List"
            className="flex-1 min-h-0 overflow-y-auto pr-1.5 custom-scrollbar space-y-2 focus:outline-none focus:ring-1 focus:ring-amber/30 rounded-xl"
          >
            {filteredAccounts.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
                No accounts found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredAccounts.map((acc, idx) => {
                const IconComponent = getRoleIcon(acc.role);
                const badgeColorClass = getRoleBadgeColor(acc.role);
                const isSelected = email.toLowerCase() === acc.email.toLowerCase();

                return (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectAccount(acc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectAccount(acc);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    className={`group relative p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-amber ${
                      isSelected
                        ? 'bg-white border-amber shadow-md ring-2 ring-amber/20'
                        : 'bg-white/90 hover:bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Left: Role Info */}
                    <div className="flex items-center gap-2.5 min-w-[160px]">
                      <div className={`p-2 rounded-xl border ${badgeColorClass} flex items-center justify-center shrink-0`}>
                        <IconComponent size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900">{acc.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                            {acc.roleLabel}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber text-navy font-extrabold uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 leading-tight">{acc.roleDesc}</p>
                      </div>
                    </div>

                    {/* Right: Email, Password & Action Buttons */}
                    <div className="flex items-center gap-1.5 text-xs flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                      {/* Email Pill */}
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200/80 text-gray-800 font-mono text-[11px]">
                        <Mail size={11} className="text-gray-400 shrink-0" />
                        <span className="max-w-[140px] truncate" title={acc.email}>{acc.email}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(acc.email, `email_${idx}`, 'Email');
                          }}
                          className="text-gray-400 hover:text-navy ml-0.5 p-0.5 cursor-pointer"
                          title="Copy Email"
                        >
                          {copiedKey === `email_${idx}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        </button>
                      </div>

                      {/* Password Pill */}
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50/70 border border-amber-200 text-gray-900 font-mono text-[11px]">
                        <Lock size={11} className="text-amber-700 shrink-0" />
                        <span className="font-bold text-amber-950 select-all">
                          {revealPasswords ? acc.password : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(acc.password, `pass_${idx}`, 'Password');
                          }}
                          className="text-amber-700 hover:text-navy ml-0.5 p-0.5 cursor-pointer"
                          title="Copy Password"
                        >
                          {copiedKey === `pass_${idx}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        </button>
                      </div>

                      {/* Select Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAccount(acc);
                        }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-navy text-amber shadow-xs'
                            : 'bg-gray-100 group-hover:bg-amber group-hover:text-navy text-gray-700'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Use'}
                        <ArrowRight size={10} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 3. Fixed Footer */}
          <div className="shrink-0 pt-2.5 mt-2 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <ShieldCheck size={13} className="text-emerald-600" /> All {demoAccounts.length} System Role Logins &amp; Passwords
            </span>
            <span>Khrisha Enterprises</span>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* PART 2: SIGN IN WINDOW (Right Side - 5 Cols)                    */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-white h-full shrink-0 overflow-y-auto lg:overflow-visible">
          <div>
            {/* Brand Logo & Heading */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber flex items-center justify-center shadow-md shadow-amber/20 font-black text-navy text-xl">
                  K
                </div>
                <div>
                  <h1 className="text-lg font-bold text-navy tracking-tight">Khrisha Enterprises</h1>
                  <p className="text-xs text-gray-500">Enterprise Management Suite</p>
                </div>
              </div>
              <h2 className="text-base font-bold text-navy mt-4">Sign in to your account</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Selected profile: <span className="font-semibold text-amber-700">{selectedRole}</span>
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@krishnacrm.com"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                  if (error) setError('');
                }}
                error={emailError}
                required
                autoFocus
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                    if (error) setError('');
                  }}
                  error={passwordError}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-navy transition-colors focus:outline-none cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <span className="font-bold">Error:</span> {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full justify-center py-2.5 font-bold text-sm rounded-xl shadow-md mt-2 cursor-pointer"
              >
                Sign In to Workspace
              </Button>
            </form>
          </div>

          {/* Part 2 Footer */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
            Khrisha Enterprises • Operations &amp; Management Portal
          </div>
        </div>

      </div>
    </div>
  );
}