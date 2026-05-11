'use client';
// src/app/(dashboard)/dashboard/page.tsx — Sindhu Bakery Dashboard
import { useState, useEffect } from 'react';
import {
  TrendingUp, DollarSign, Receipt, Users, Package,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Zap
} from 'lucide-react';
import api from '@/lib/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const StatCard = ({ title, value, change, icon: Icon, gradient, prefix = '₹', isCount = false }: any) => (
  <div className="card p-5 card-glow animate-slide-up overflow-hidden relative">
    <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: gradient }} />
    <div className="flex items-start justify-between mb-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: gradient }}>
        <Icon className="w-5 h-5 text-white" strokeWidth={2} />
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${change >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">
      {isCount ? value?.toLocaleString() : `${prefix}${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
    </p>
    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">{title}</p>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const load = async () => {
    setLoading(true);
    setDbError(null);
    try {
      // Use allSettled so a single failing endpoint doesn't crash the whole dashboard
      const [statsRes, chartRes, insightRes] = await Promise.allSettled([
        api.get('/invoices/dashboard-stats'),
        api.get('/invoices/sales-chart?period=monthly'),
        api.get('/reports/insights'),
      ]);

      // Stats is the critical one — if it fails, show the error screen
      if (statsRes.status === 'rejected') {
        const err = statsRes.reason;
        throw new Error(
          err.response?.data?.message ||
          err.message ||
          'Could not reach the database.'
        );
      }

      setStats(statsRes.value.data.data);

      if (chartRes.status === 'fulfilled') {
        const rawChart = chartRes.value.data.data || [];
        const formatted = MONTHS.map((m, i) => {
          const found = rawChart.find((d: any) => d._id?.month === i + 1);
          return { name: m, sales: found?.sales || 0, invoices: found?.invoices || 0 };
        });
        setChartData(formatted);
      }

      if (insightRes.status === 'fulfilled') {
        setInsights(insightRes.value.data.data);
      }

    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Could not reach the database. Please check your MongoDB Atlas connection.';
      setDbError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 h-32 shimmer" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error screen ─────────────────────────────────────────────────────────────
  if (dbError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-4xl animate-pulse">
          🔴
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-2">
            Dashboard Failed to Load
          </h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm max-w-md">
            {dbError}
          </p>
          <p className="text-stone-400 dark:text-stone-500 text-xs mt-2">
            If this keeps happening, restart the backend server and try again.
          </p>
        </div>
        <button
          onClick={() => load()}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-amber-500/20"
        >
          🔄 Retry
        </button>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const pieData = stats?.paymentMix || [
    { name: 'Cash', value: 0, color: '#d97706' },
    { name: 'UPI', value: 0, color: '#10b981' },
    { name: 'Card', value: 0, color: '#6366f1' },
    { name: 'Credit', value: 0, color: '#ef4444' },
  ];

  const insightColors: Record<string, string> = {
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    alert: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Welcome banner */}
      <div className="card p-5 bg-gradient-to-r from-amber-600 to-orange-500 border-0 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 text-8xl opacity-10 -mt-4">🍞</div>
        <p className="text-amber-100 text-sm">Welcome back,</p>
        <h1 className="text-2xl font-bold font-display mt-0.5">{user?.name || 'Bhagyanath T'} 👋</h1>
        <p className="text-amber-100 text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Sindhu Bakery
        </p>
        <div className="flex gap-4 mt-4">
          <Link href="/billing" className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors backdrop-blur-sm" id="dash-new-bill">
            🧾 New Bill
          </Link>
          <Link href="/inventory" className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors backdrop-blur-sm" id="dash-inventory">
            📦 Inventory
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={stats?.today?.sales || 0}
          change={12}
          icon={DollarSign}
          gradient="linear-gradient(135deg, #d97706, #ea580c)"
        />
        <StatCard
          title="Monthly Revenue"
          value={stats?.month?.sales || 0}
          change={8}
          icon={TrendingUp}
          gradient="linear-gradient(135deg, #059669, #0d9488)"
        />
        <StatCard
          title="Unpaid Balance"
          value={stats?.unpaid?.amount || 0}
          change={-3}
          icon={Receipt}
          gradient="linear-gradient(135deg, #dc2626, #e11d48)"
        />
        <StatCard
          title="Total Customers"
          value={stats?.totalCustomers || 0}
          icon={Users}
          gradient="linear-gradient(135deg, #7c3aed, #9333ea)"
          isCount
          prefix=""
        />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Sales Chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-stone-800 dark:text-stone-100">Revenue Overview</h3>
              <p className="text-stone-400 text-xs mt-0.5">Monthly sales — {new Date().getFullYear()}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full pulse-dot" />
              Live
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-700" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-stone-400" />
              <YAxis tick={{ fontSize: 11 }} className="fill-stone-400" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Sales']}
                contentStyle={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: '12px', fontSize: '13px' }}
                labelStyle={{ color: '#a8a29e' }}
              />
              <Area type="monotone" dataKey="sales" stroke="#d97706" strokeWidth={2.5} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Mix */}
        <div className="card p-5">
          <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-1">Payment Mix</h3>
          <p className="text-stone-400 text-xs mb-4">This month</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={4} dataKey="value">
                {pieData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={v => `${v}%`} contentStyle={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((d: any) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs text-stone-600 dark:text-stone-400">{d.name}</span>
                </div>
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Quick Actions */}
        <div className="card p-5">
          <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-4">Quick Actions</h3>
          <div className="space-y-1.5">
            {[
              { label: 'Create Bill', href: '/billing', emoji: '🧾', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
              { label: 'Add Product', href: '/inventory', emoji: '📦', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
              { label: 'Add Customer', href: '/customers', emoji: '👤', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
              { label: 'Record Expense', href: '/expenses', emoji: '💸', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
              { label: 'View Reports', href: '/reports', emoji: '📊', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
            ].map(a => (
              <Link key={a.label} href={a.href}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-amber-50 dark:hover:bg-stone-700/50 transition-colors group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${a.color}`}>{a.emoji}</div>
                <span className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{a.label}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-amber-600 rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-bold text-stone-800 dark:text-stone-100">Business Insights</h3>
          </div>
          <div className="space-y-2">
            {insights?.insights?.length > 0 ? (
              insights.insights.map((insight: any, i: number) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${insightColors[insight.type] || insightColors.warning}`}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{insight.message}</p>
                    {insight.action && (
                      <Link href={insight.action} className="text-xs underline opacity-70 hover:opacity-100 mt-0.5 block">View →</Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-stone-400 text-sm text-center py-4">All is well! ✅</p>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">Top Products</h3>
            <Link href="/inventory" className="text-amber-600 dark:text-amber-400 text-xs font-medium hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {(insights?.topProducts?.length > 0 ? insights.topProducts : [
              { name: 'Croissant', salesCount: 234 },
              { name: 'Cappuccino', salesCount: 178 },
              { name: 'Chocolate Cake', salesCount: 89 },
            ]).slice(0, 5).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{p.name}</p>
                  <p className="text-xs text-stone-400">{p.salesCount || 0} sold</p>
                </div>
                <div className="w-16 h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, ((p.salesCount || 0) / 300) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
