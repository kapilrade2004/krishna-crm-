'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Users, CheckSquare,
  Upload, BarChart2, ChevronRight, Building2, Truck, Settings,
  PhoneCall, Briefcase, FileCheck, FileText,
  PanelLeftClose, PanelLeftOpen, UserCheck, ShieldCheck,
  MessageSquare, Fingerprint, ChevronDown, Clock
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useAuthStore, User } from '@/lib/auth';
import { useSidebarStore } from '@/lib/sidebar';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  module?: string;
  perms: string[];
  roles: string[];
}

interface NavSection {
  id: string;
  title: string;
  icon: any;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'workspace',
    title: 'WORKSPACE',
    icon: LayoutDashboard,
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        module: 'dashboard',
        perms: ['dashboard:view'],
        roles: ['admin', 'super_admin', 'manager', 'sales', 'support', 'ceo', 'telecaller', 'hr', 'employee', 'reviewer', 'accountant', 'spn_ads_manager', 'senior_account_manager', 'delivery_boy', 'ecommerce_executive'],
      },
      {
        href: '/tasks',
        label: 'Tasks',
        icon: CheckSquare,
        module: 'tasks',
        perms: ['tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'daily_tasks:view', 'daily_tasks:create', 'daily_tasks:edit', 'daily_tasks:delete'],
        roles: ['admin', 'super_admin', 'manager', 'sales', 'support', 'ceo', 'telecaller', 'hr', 'employee', 'reviewer', 'accountant', 'spn_ads_manager', 'senior_account_manager', 'delivery_boy', 'ecommerce_executive'],
      },
    ],
  },
  {
    id: 'sales_ops',
    title: 'SALES & OPS',
    icon: ShoppingCart,
    items: [
      /*
      {
        href: '/telecaller',
        label: 'Telecaller Suite',
        icon: PhoneCall,
        module: 'telecaller',
        perms: ['telecaller:view', 'csv:import', 'telecaller:confirmation'],
        roles: ['admin', 'super_admin', 'manager', 'telecaller', 'ecommerce_executive', 'senior_account_manager'],
      },
      */
      {
        href: '/orders',
        label: 'Orders',
        icon: ShoppingCart,
        module: 'orders',
        perms: ['orders:view', 'orders:create', 'orders:edit', 'orders:delete'],
        roles: ['admin', 'super_admin', 'manager', 'sales', 'support', 'ceo', 'accountant', 'senior_account_manager', 'ecommerce_executive'],
      },
      {
        href: '/customers',
        label: 'Customers',
        icon: Users,
        module: 'customers',
        perms: ['customers:view', 'customers:create', 'customers:edit', 'customers:delete'],
        roles: ['admin', 'super_admin', 'manager', 'sales', 'support', 'ceo', 'telecaller', 'accountant', 'senior_account_manager', 'ecommerce_executive'],
      },
      {
        href: '/warranty',
        label: 'Warranty',
        icon: ShieldCheck,
        module: 'warranty',
        perms: ['warranty:view', 'warranty:verify'],
        roles: ['admin', 'super_admin', 'manager', 'sales', 'support', 'ceo', 'technician', 'hr', 'ecommerce_executive'],
      },
      {
        href: '/shipping',
        label: 'Shipping',
        icon: Truck,
        module: 'shipping',
        perms: ['shipping:view', 'shipping:edit'],
        roles: ['admin', 'super_admin', 'manager', 'sales', 'support', 'delivery_boy', 'senior_account_manager', 'ecommerce_executive', 'accountant'],
      },
      {
        href: '/csv-import',
        label: 'CSV Import',
        icon: Upload,
        module: 'csv',
        perms: ['csv:import'],
        roles: ['admin', 'super_admin', 'manager', 'sales', 'telecaller', 'ecommerce_executive'],
      },
    ],
  },
  {
    id: 'analytics',
    title: 'ANALYTICS & BI',
    icon: BarChart2,
    items: [
      {
        href: '/whatsapp-audit',
        label: 'WhatsApp Audit & Cost',
        icon: MessageSquare,
        module: 'whatsapp',
        perms: ['whatsapp:audit', 'whatsapp:manage', 'reports:view', 'dashboard:view'],
        roles: ['admin', 'super_admin', 'manager', 'ceo', 'sales', 'telecaller', 'accountant', 'senior_account_manager', 'ecommerce_executive'],
      },
      {
        href: '/reports',
        label: 'Reports',
        icon: BarChart2,
        module: 'reports',
        perms: ['reports:view'],
        roles: ['admin', 'super_admin', 'manager', 'ceo', 'spn_ads_manager', 'senior_account_manager', 'accountant', 'ecommerce_executive'],
      },
    ],
  },
  {
    id: 'hr',
    title: 'HUMAN RESOURCES',
    icon: Briefcase,
    items: [
      {
        href: '/hr',
        label: 'HR Workspace',
        icon: Briefcase,
        module: 'hr',
        perms: ['employees:view', 'employees:create', 'employees:edit', 'employees:delete', 'onboarding:view', 'onboarding:manage'],
        roles: ['admin', 'super_admin', 'hr'],
      },
      {
        href: '/employees',
        label: 'Employees',
        icon: Users,
        module: 'employees',
        perms: ['employees:view', 'employees:create', 'employees:edit', 'employees:delete'],
        roles: ['admin', 'super_admin', 'hr'],
      },
      {
        href: '/employee-audit',
        label: 'Employee Audit',
        icon: Clock,
        module: 'audit',
        perms: ['employees:view', 'access:manage'],
        roles: ['admin', 'super_admin', 'hr', 'manager', 'ceo'],
      },
      {
        href: '/hr/document-center',
        label: 'Document Center',
        icon: FileText,
        module: 'document_center',
        perms: ['document_center:view', 'onboarding:manage'],
        roles: ['admin', 'super_admin', 'hr', 'manager'],
      },
    ],
  },
  {
    id: 'admin',
    title: 'ADMINISTRATION',
    icon: Settings,
    items: [
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        module: 'settings',
        perms: ['settings:view', 'settings:manage', 'access:manage'],
        roles: ['admin', 'super_admin', 'manager', 'ceo'],
      },
      {
        href: '/settings/users',
        label: 'Users & Rights',
        icon: Users,
        module: 'users',
        perms: ['users:view', 'users:manage', 'access:manage'],
        roles: ['admin', 'super_admin', 'manager', 'hr'],
      },
    ],
  },
];

const PERSONAL_NAV_ITEMS: NavItem[] = [
  {
    href: '/my-attendance',
    label: 'My Attendance',
    icon: Clock,
    module: 'my_attendance',
    perms: ['attendance:view'],
    roles: ['admin', 'super_admin', 'manager', 'sales', 'support', 'ceo', 'telecaller', 'hr', 'employee', 'reviewer', 'accountant', 'spn_ads_manager', 'senior_account_manager', 'delivery_boy', 'ecommerce_executive', 'technician'],
  },
  {
    href: '/my-documents',
    label: 'My Documents',
    icon: FileText,
    module: 'my_documents',
    perms: [],
    roles: ['admin', 'super_admin', 'hr', 'manager', 'sales', 'support', 'ceo', 'telecaller', 'employee', 'reviewer', 'accountant', 'spn_ads_manager', 'senior_account_manager', 'delivery_boy', 'ecommerce_executive', 'technician'],
  },
];

const isNavItemVisible = (item: NavItem, user: User | null): boolean => {
  if (!user) return true;
  const role = (user.role || '').toLowerCase().trim();

  if (role === 'admin' || role === 'super_admin' || role === 'super admin' || user.permissions?.includes('*')) {
    return true;
  }

  if (item.href === '/my-documents' || item.href === '/my-attendance') {
    return true;
  }

  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    if (item.href === '/dashboard') {
      return user.permissions.includes('dashboard:view') || user.permissions.length > 0;
    }

    if (item.perms.length > 0 && item.perms.some(p => user.permissions?.includes(p))) {
      return true;
    }

    if (item.module) {
      if (user.permissions.some(p => p.startsWith(item.module + ':'))) {
        return true;
      }
      if (item.module === 'tasks' && user.permissions.some(p => p.startsWith('daily_tasks:'))) {
        return true;
      }
      if (item.module === 'hr' && user.permissions.some(p => p.startsWith('employees:') || p.startsWith('onboarding:'))) {
        return true;
      }
    }

    const standardRoles = [
      'admin', 'super_admin', 'super admin', 'manager', 'sales', 'support', 'ceo',
      'telecaller', 'hr', 'employee', 'reviewer', 'accountant', 'spn_ads_manager',
      'senior_account_manager', 'delivery_boy', 'ecommerce_executive', 'technician'
    ];
    if (standardRoles.includes(role)) {
      return item.roles.map(r => r.toLowerCase().trim()).includes(role);
    }

    return false;
  }

  return item.roles.map(r => r.toLowerCase().trim()).includes(role);
};

const isItemActive = (itemHref: string, currentPathname: string, sectionItems?: NavItem[]): boolean => {
  if (currentPathname === itemHref) return true;
  // Settings overview page must only match exactly so /settings/users does not trigger both
  if (itemHref === '/settings') {
    return currentPathname === '/settings';
  }
  // If another item in the section has a more specific href matching current pathname, don't highlight this one
  if (sectionItems && sectionItems.some(other => other.href !== itemHref && other.href.startsWith(itemHref + '/') && (currentPathname === other.href || currentPathname.startsWith(other.href + '/')))) {
    return false;
  }
  return currentPathname.startsWith(itemHref + '/');
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, syncUser } = useAuthStore();
  const { isCollapsed, toggle } = useSidebarStore();
  const [hoveredSection, setHoveredSection] = useState<{ id: string; top: number } | null>(null);
  const [openAccordion, setOpenAccordion] = useState<Record<string, boolean>>({
    workspace: true,
    sales_ops: true,
    analytics: true,
    hr: true,
    admin: true,
  });

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    syncUser?.();
  }, [syncUser]);

  const handleMouseEnter = (sectionId: string, event: React.MouseEvent<HTMLElement>) => {
    if (!isCollapsed) return;
    const targetSection = visibleSections.find(s => s.id === sectionId);
    if (!targetSection || targetSection.items.length <= 1) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredSection({
      id: sectionId,
      top: rect.top,
    });
  };

  const handleMouseLeave = () => {
    if (!isCollapsed) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSection(null);
    }, 180);
  };

  const handlePopoverMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const toggleAccordion = (id: string) => {
    setOpenAccordion(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter sections and items based on permissions
  const visibleSections = NAV_SECTIONS.map(section => {
    const visibleItems = section.items.filter(item => isNavItemVisible(item, user));
    return {
      ...section,
      items: visibleItems,
    };
  }).filter(section => section.items.length > 0);

  const visiblePersonalItems = PERSONAL_NAV_ITEMS.filter(item => isNavItemVisible(item, user));

  const activeFlyoutSection = visibleSections.find(s => s.id === hoveredSection?.id);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-[#0c1322] flex flex-col z-50 select-none transition-all duration-300 ease-in-out border-r border-slate-800/80',
        isCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Header / Logo */}
      <div className={cn('py-3 border-b border-slate-800/80 flex items-center justify-between', isCollapsed ? 'px-2 justify-center' : 'px-3')}>
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
          <div
            onClick={toggle}
            className="w-8 h-8 rounded-lg bg-[#f97316] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span>K</span>
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold text-xs leading-tight truncate" title="Khrisha Enterprises">Khrisha Enterprises</p>
              <p className="text-slate-400 text-[10px] leading-tight mt-0.5">CRM Platform</p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={toggle}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10 shrink-0"
            title="Collapse sidebar"
          >
            <ChevronDown size={14} />
          </button>
        )}
      </div>

      {/* Nav list */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3.5 overflow-x-hidden">
        {visibleSections.map((section) => {
          const isSectionActive = section.items.some(
            item => isItemActive(item.href, pathname, section.items)
          );

          if (isCollapsed) {
            // Collapsed mode single item
            if (section.items.length === 1) {
              const singleItem = section.items[0];
              const isSingleActive = isItemActive(singleItem.href, pathname, section.items);
              return (
                <div key={section.id} className="relative flex justify-center px-1">
                  <Link href={singleItem.href} className="block">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150',
                        isSingleActive
                          ? 'bg-[#2563eb] text-white shadow-md font-medium'
                          : 'text-slate-400 hover:bg-white/[0.08] hover:text-white'
                      )}
                      title={singleItem.label}
                    >
                      <singleItem.icon size={18} strokeWidth={2} />
                    </div>
                  </Link>
                </div>
              );
            }

            // Collapsed multi-item with flyout
            return (
              <div
                key={section.id}
                onMouseEnter={(e) => handleMouseEnter(section.id, e)}
                onMouseLeave={handleMouseLeave}
                className="relative flex justify-center px-1"
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150',
                    isSectionActive
                      ? 'bg-[#2563eb] text-white shadow-md font-medium'
                      : 'text-slate-400 hover:bg-white/[0.08] hover:text-white'
                  )}
                >
                  <section.icon size={18} strokeWidth={2} />
                </div>
              </div>
            );
          }

          // Expanded Mode
          return (
            <div key={section.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleAccordion(section.id)}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span>{section.title}</span>
                {section.items.length > 1 && (
                  <ChevronDown
                    size={12}
                    className={cn('transition-transform duration-200 text-slate-400', !openAccordion[section.id] && '-rotate-90')}
                  />
                )}
              </button>

              {openAccordion[section.id] && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isItemActive(item.href, pathname, section.items);
                    return (
                      <Link key={item.href} href={item.href} className="block">
                        <span
                          className={cn(
                            'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs cursor-pointer transition-all duration-150',
                            active
                              ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                              : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                          )}
                        >
                          <item.icon size={16} strokeWidth={2} className="flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Hover Flyout Dropdown Popover for Collapsed Mode */}
      {isCollapsed && activeFlyoutSection && hoveredSection && (
        <div
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            top: Math.max(12, Math.min(hoveredSection.top, window.innerHeight - 240)),
            backgroundColor: '#0c1322'
          }}
          className="fixed left-16 z-50 bg-[#0c1322] border border-slate-700/90 shadow-2xl rounded-r-2xl py-2 px-1.5 min-w-[210px] animate-in fade-in slide-in-from-left-2 duration-150 text-white"
        >
          <div className="px-3 py-2 border-b border-slate-800 mb-1 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              {activeFlyoutSection.title}
            </p>
            <span className="text-[10px] text-slate-400 font-medium">
              {activeFlyoutSection.items.length} {activeFlyoutSection.items.length === 1 ? 'module' : 'modules'}
            </span>
          </div>

          <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
            {activeFlyoutSection.items.map((item) => {
              const active = isItemActive(item.href, pathname, activeFlyoutSection.items);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setHoveredSection(null)}
                  className="block"
                >
                  <span
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl text-xs px-3 py-2 cursor-pointer transition-all duration-150',
                      active
                        ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                        : 'text-slate-200 hover:bg-white/[0.09] hover:text-white'
                    )}
                  >
                    <item.icon size={16} strokeWidth={2} className="flex-shrink-0 text-slate-400" />
                    <span className="truncate">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pinned Bottom Self-Service Items: My Attendance & My Documents */}
      {visiblePersonalItems.length > 0 && (
        <div className={cn('shrink-0 py-2 border-t border-slate-800/80', isCollapsed ? 'px-1 space-y-2' : 'px-2 space-y-0.5')}>
          {visiblePersonalItems.map((item) => {
            const active = isItemActive(item.href, pathname, visiblePersonalItems);

            if (isCollapsed) {
              return (
                <div key={item.href} className="relative flex justify-center">
                  <Link href={item.href} className="block">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-150',
                        active
                          ? 'bg-[#2563eb] text-white shadow-md font-medium'
                          : 'text-slate-400 hover:bg-white/[0.08] hover:text-white'
                      )}
                      title={item.label}
                    >
                      <item.icon size={18} strokeWidth={2} />
                    </div>
                  </Link>
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href} className="block">
                <span
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs cursor-pointer transition-all duration-150',
                    active
                      ? 'bg-[#2563eb] text-white font-medium shadow-sm'
                      : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                  )}
                >
                  <item.icon size={16} strokeWidth={2} className="flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

    </aside>
  );
}