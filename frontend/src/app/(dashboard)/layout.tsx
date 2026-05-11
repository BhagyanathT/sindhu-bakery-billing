'use client';
// src/app/(dashboard)/layout.tsx — Role-based route guards
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';
import { clsx } from 'clsx';
import { useState } from 'react';
import Sidebar from '@/components/shared/Sidebar';
import Topbar from '@/components/shared/Topbar';

// Pages that staff (non-admin) cannot access — redirect to /billing
const ADMIN_ONLY_PATHS = [
  '/dashboard',
  '/analytics',
  '/reports',
  '/expenses',
  '/staff',
  '/attendance',
  '/salary',
  '/settings',
  '/whatsapp',
  '/admin-users',
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // hydrated = persist store has loaded from localStorage
  const hydrated = useAuthHydrated();
  const { isAuthenticated, user, fetchMe } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isBilling = pathname?.startsWith('/billing') || pathname?.startsWith('/flash-billing');
  const isAdmin = user?.role === 'admin';
  const [authChecked, setAuthChecked] = useState(false);
  // ── Guard: fetchMe must only be called ONCE per mount, never on re-renders.
  // Without this ref, having `user` in the dependency array causes an infinite
  // loop: fetchMe → user updates → effect re-runs → fetchMe again → 100+ req/s
  const fetchCalledRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return; // wait for localStorage restore first
    // ── ONE-SHOT guard: never call fetchMe more than once per mount.
    // This is critical — without it, fetchMe updates `user`, which would
    // re-trigger this effect, causing an infinite /api/auth/me flood.
    if (fetchCalledRef.current) return;
    fetchCalledRef.current = true;

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    // ── Fast path: already have persisted user + token → show dashboard immediately.
    // Fire fetchMe once in background to silently revalidate. No await, no block.
    if (isAuthenticated && token) {
      setAuthChecked(true);
      fetchMe().catch(() => {}); // silent revalidation — errors handled inside fetchMe
      return;
    }

    // ── No persisted session: call fetchMe with a 3-second hard timeout so the
    // spinner can NEVER hang forever even if the backend is unreachable.
    let resolved = false;
    const hardTimeout = setTimeout(() => {
      if (!resolved) { resolved = true; setAuthChecked(true); }
    }, 3000);

    fetchMe().finally(() => {
      if (!resolved) {
        resolved = true;
        clearTimeout(hardTimeout);
        setAuthChecked(true);
      }
    });

    return () => clearTimeout(hardTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]); // ← ONLY hydrated. Adding user/fetchMe here causes infinite loop.

  useEffect(() => {
    // Wait until both the persist store is hydrated and the session is revalidated
    if (!hydrated || !authChecked) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (!isAuthenticated || !token) {
      router.push('/login');
      return;
    }

    // Redirect staff away from admin-only pages
    if (!isAdmin) {
      const blocked = ADMIN_ONLY_PATHS.some(p => pathname?.startsWith(p));
      if (blocked) {
        router.replace('/billing');
      }
    }
  }, [hydrated, authChecked, isAuthenticated, isAdmin, pathname, router]);

  // ── Loading spinner: only while waiting for hydration and validation ──────
  if (!hydrated || !authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading Sindhu Bakery POS…</p>
        </div>
      </div>
    );
  }

  // ── Not authenticated: return null while useEffect pushes to /login ────
  if (!isAuthenticated) {
    return null;
  }

  // ── Staff on admin-only page: show redirect spinner ────────────────────
  if (!isAdmin && ADMIN_ONLY_PATHS.some(p => pathname?.startsWith(p))) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={clsx("flex-1 flex flex-col min-w-0 transition-all duration-300", isBilling ? "lg:ml-[5.5rem]" : "lg:ml-64")}>
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className={clsx("flex-1 overflow-auto", isBilling ? "p-2 sm:p-4" : "p-4 sm:p-6")}>
          {children}
        </main>
      </div>
    </div>
  );
}
