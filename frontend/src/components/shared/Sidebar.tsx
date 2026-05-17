'use client';
// src/components/shared/Sidebar.tsx — Role-filtered navigation
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Receipt, Package, Users, DollarSign,
  BarChart3, Settings, LogOut, ChevronRight, Bell, ClipboardList, MessageCircle, Zap,
  UserCog,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useCallback } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  emoji: string;
  badge?: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard',       href: '/dashboard',    icon: LayoutDashboard, emoji: '📊',  adminOnly: true },
  { label: 'Billing / POS',   href: '/billing',      icon: Receipt,         emoji: '🧾',  badge: 'POS' },
  { label: '⚡ Flash Billing', href: '/flash-billing',icon: Zap,             emoji: '⚡',  badge: 'FAST' },
  { label: 'Orders',          href: '/orders',       icon: ClipboardList,   emoji: '🧾' },
  { label: 'Inventory',       href: '/inventory',    icon: Package,         emoji: '📦' },
  { label: 'Leave',           href: '/leave',        icon: ClipboardList,   emoji: '📅' },
  { label: 'Customers',       href: '/customers',    icon: Users,           emoji: '👥' },
  { label: 'Expenses',        href: '/expenses',     icon: DollarSign,      emoji: '💸',  adminOnly: true },
  { label: 'Staff',           href: '/staff',        icon: Users,           emoji: '👨‍💼',  adminOnly: true },
  { label: 'Attendance',      href: '/attendance',   icon: ClipboardList,   emoji: '🕒',  adminOnly: true },
  { label: 'Salary',          href: '/salary',       icon: DollarSign,      emoji: '💰',  adminOnly: true },
  { label: 'Reports',         href: '/reports',      icon: BarChart3,       emoji: '📈',  adminOnly: true },
  { label: 'WhatsApp',        href: '/whatsapp',     icon: MessageCircle,   emoji: '💬',  badge: 'NEW', adminOnly: true },
  { label: 'User Mgmt',       href: '/admin-users',  icon: UserCog,         emoji: '👥',  badge: 'ADMIN', adminOnly: true },
  { label: 'Settings',        href: '/settings',     icon: Settings,        emoji: '⚙️' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const isCollapsed = pathname?.startsWith('/billing') || pathname?.startsWith('/flash-billing');
  const isAdmin = user?.role === 'admin';

  const visibleItems = navItems.filter(item => isAdmin || !item.adminOnly);

  const checkDb = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}/api/db-status`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      setDbConnected(data.connected);
    } catch {
      setDbConnected(false);
    }
  }, []);

  useEffect(() => {
    checkDb();
    const interval = setInterval(checkDb, 15000);
    return () => clearInterval(interval);
  }, [checkDb]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-50 flex flex-col',
          'border-r border-stone-800',
          'transform transition-all duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0',
          isCollapsed ? 'w-[5.5rem]' : 'w-64'
        )}
        style={{ background: 'rgb(12 10 9)' }}
      >
        {/* Logo + DB status dot */}
        <div className={clsx("flex items-center gap-3 py-5 border-b border-stone-800", isCollapsed ? "justify-center px-0" : "px-5")}>
          <div className="relative flex-shrink-0" title={isCollapsed ? 'Sindhu Bakery' : undefined}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-stone-800 bg-stone-900 shadow-lg shadow-amber-500/10">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            {dbConnected !== null && (
              <span
                title={dbConnected ? 'MongoDB Atlas Connected' : 'MongoDB Atlas Disconnected'}
                className={clsx(
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-stone-900',
                  dbConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
                )}
              />
            )}
          </div>
          {!isCollapsed && (
            <div>
              <p className="font-bold text-amber-400 text-sm font-display leading-tight">Sindhu Bakery</p>
              <p className="text-stone-500 text-xs">
                {dbConnected === null ? 'Connecting…' : dbConnected ? 'Database Connected ✓' : 'Database Offline ✗'}
              </p>
            </div>
          )}
        </div>

        {/* Role badge */}
        {!isCollapsed && (
          <div className="px-5 pt-3 pb-1">
            <span className={clsx(
              'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
              isAdmin
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            )}>
              {isAdmin ? '👑 Admin' : '👤 Staff'}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx('nav-item', isActive && 'active', isCollapsed && 'justify-center')}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={clsx("text-base leading-none", isCollapsed && "text-xl")}>{item.emoji}</span>
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={clsx(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                        item.badge === 'ADMIN'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-amber-500/20 text-amber-400'
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-stone-800">
          {/* Quick action */}
          <div className={clsx("flex gap-2 mb-3", isCollapsed && "flex-col")}>
            <Link
              href="/billing"
              onClick={onClose}
              className={clsx("flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-600/15 hover:bg-amber-600/25 text-amber-400 text-xs font-medium transition-colors", !isCollapsed && "flex-1")}
              title={isCollapsed ? "New Bill" : undefined}
            >
              <Receipt className="w-3.5 h-3.5" />
              {!isCollapsed && "New Bill"}
            </Link>
            <button className="p-2 flex items-center justify-center rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 transition-colors" title={isCollapsed ? "Notifications" : undefined}>
              <Bell className="w-4 h-4" />
            </button>
          </div>

          {/* User info */}
          <div className={clsx("flex items-center gap-3 rounded-xl hover:bg-stone-800 transition-colors group", isCollapsed ? "p-1.5 justify-center flex-col" : "p-2.5")}>
            <div
              className={clsx(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold",
                isAdmin
                  ? "bg-gradient-to-br from-amber-500 to-orange-600"
                  : "bg-gradient-to-br from-blue-500 to-indigo-600"
              )}
              title={isCollapsed ? user?.name || 'User' : undefined}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-stone-200 text-xs font-semibold truncate">{user?.name || 'User'}</p>
                <p className="text-stone-500 text-[11px] capitalize">{user?.role}</p>
              </div>
            )}
            <button
              id="logout-btn"
              onClick={handleLogout}
              className={clsx("transition-opacity text-stone-500 hover:text-red-400", isCollapsed ? "" : "opacity-0 group-hover:opacity-100")}
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
