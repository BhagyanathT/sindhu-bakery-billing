'use client';
// src/components/shared/Topbar.tsx — includes real-time DB connection status
import { Bell, Menu, Sun, Moon, Plus, Database } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from 'next-themes';

interface TopbarProps {
  onMenuClick: () => void;
}

type DbState = 'checking' | 'connected' | 'disconnected';

function DbStatusBadge() {
  const [status, setStatus] = useState<DbState>('checking');

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000'}/api/db-status`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      setStatus(data.connected ? 'connected' : 'disconnected');
    } catch {
      setStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [checkStatus]);

  if (status === 'checking') {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-stone-400 animate-pulse" />
        <span>Connecting…</span>
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div
        id="db-status-badge"
        title="Connected to MongoDB Atlas"
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold"
      >
        <Database className="w-3 h-3" />
        <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot" />
        <span>Connected</span>
      </div>
    );
  }

  return (
    <div
      id="db-status-badge"
      title="Cannot reach MongoDB Atlas — check your connection"
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold animate-pulse"
    >
      <Database className="w-3 h-3" />
      <span className="w-2 h-2 rounded-full bg-red-500" />
      <span>Disconnected</span>
    </div>
  );
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());
  const { user } = useAuthStore();

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const greeting = () => {
    const hour = time.getHours();
    if (hour < 12) return '☀️ Good morning';
    if (hour < 17) return '🌤️ Good afternoon';
    return '🌙 Good evening';
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          id="menu-toggle"
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 lg:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <p className="text-xs text-stone-400">{greeting()}, {user?.name?.split(' ')[0] || 'there'}!</p>
          <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">
            {time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* DB Status indicator */}
        <DbStatusBadge />

        <Link
          href="/billing"
          id="new-invoice-btn"
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Bill</span>
        </Link>

        <button id="theme-toggle" onClick={toggleTheme} className="btn-icon" title="Toggle theme">
          {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button id="notifications-btn" className="relative btn-icon">
          <Bell className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full pulse-dot" />
        </button>
      </div>
    </header>
  );
}
