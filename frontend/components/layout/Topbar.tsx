'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Search, ShieldCheck, CheckCheck, Trash2, LayoutGrid, LogOut, Settings } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useNotificationStore } from '@/lib/notifications';
import { useSidebarStore } from '@/lib/sidebar';
import { cn, timeAgo } from '@/lib/utils';
import TopBarDateTime from './TopBarDateTime';

interface Props { title: string; subtitle?: string; icon?: any; }

export default function Topbar({ title, subtitle, icon }: Props) {
  const { user, logout } = useAuthStore();
  const { notifications, markAsRead, clearAll } = useNotificationStore();
  const { isCollapsed, toggle: toggleSidebar } = useSidebarStore();
  const [openNotifs, setOpenNotifs] = useState(false);
  const notifsRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Strip any greeting like "Welcome back, [Name]" from title
  const cleanTitle = title?.replace(/^Welcome back,?\s*[^—–-]*/i, 'Dashboard').trim() || 'Dashboard';
  const HeaderIcon = icon || LayoutGrid;

  // Close notifications and profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(event.target as Node)) {
        setOpenNotifs(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter notifications relevant to current user
  const userNotifs = notifications.filter(
    n => n.userId === 'all' || (user && n.userId.toLowerCase() === user.email.toLowerCase())
  );
  const unreadCount = userNotifs.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 hover:bg-blue-100/90 hover:text-blue-700 active:scale-95 shadow-2xs shrink-0 cursor-pointer transition-all duration-150"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label="Toggle Sidebar"
        >
          <HeaderIcon size={19} strokeWidth={2.2} />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">{cleanTitle}</h1>
          {subtitle && <p className="text-[11.5px] text-slate-500 font-normal">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Fixed Editable Operational Date & Time Pills (All Pages) */}
        <TopBarDateTime />

        {/* Circular Search Button */}
        <button
          type="button"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors shrink-0 cursor-pointer"
          title="Search"
        >
          <Search size={14} />
        </button>

        {/* Circular Notifications Toggle */}
        <div className="relative" ref={notifsRef}>
          <button
            type="button"
            onClick={() => setOpenNotifs((v: boolean) => !v)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 relative shadow-2xs transition-colors shrink-0 cursor-pointer"
            title="View Notifications"
          >
            <Bell size={14} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9.5px] rounded-full flex items-center justify-center shadow-xs">
              {unreadCount > 0 ? unreadCount : 3}
            </span>
          </button>

          {/* Notifications Dropdown Panel */}
          {openNotifs && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/15 p-3.5 z-50 animate-in fade-in-0 zoom-in-95 duration-150 ease-out origin-top-right ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <Bell size={14} className="text-amber-500" />
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {userNotifs.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 size={11} /> Clear All
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {userNotifs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No new notifications</p>
                ) : (
                  userNotifs.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        n.read ? 'bg-slate-50/50 border-slate-200 text-slate-600' : 'bg-amber-50/40 border-amber-200/70 text-slate-900 font-medium'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck size={13} className="text-emerald-600 flex-shrink-0" />
                          <span className="font-bold text-slate-900 text-[11px]">{n.title}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed pl-5">
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Circular Avatar with Expandable Profile & Sign Out Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v: boolean) => !v)}
            className={cn(
              "w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#f59e0b] text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0 cursor-pointer select-none transition-all duration-150 ring-offset-2 hover:ring-2 hover:ring-amber-400/60 active:scale-95",
              profileOpen && "ring-2 ring-amber-500"
            )}
            title={`${user?.name || 'Super Admin'} (${user?.role || 'Admin'})`}
            aria-label="User profile menu"
          >
            <span>{user?.name?.charAt(0)?.toUpperCase() || 'S'}</span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/15 p-2.5 z-50 animate-in fade-in-0 zoom-in-95 duration-150 ease-out origin-top-right ring-1 ring-black/5">
              <div className="flex items-center gap-2.5 p-2 bg-slate-50/90 rounded-xl border border-slate-100">
                <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  <span>{user?.name?.charAt(0)?.toUpperCase() || 'S'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate leading-tight">{user?.name || 'Super Admin'}</p>
                  <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">{user?.email || 'admin@krishnacrm.com'}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[9.5px] font-bold uppercase rounded bg-amber-50 text-amber-800 border border-amber-200/70">
                    {user?.role || 'Admin'}
                  </span>
                </div>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5">
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer"
                >
                  <Settings size={14} className="text-slate-500 shrink-0" />
                  <span>Settings & Configuration</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut size={14} className="text-rose-500 shrink-0" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
