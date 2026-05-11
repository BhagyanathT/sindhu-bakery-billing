'use client';
// src/app/(dashboard)/reports/page.tsx — Sindhu Bakery Reports & Daily Summary
import { useState, useEffect } from 'react';
import {
  TrendingUp, DollarSign, FileText, Download, Calendar,
  Banknote, Smartphone, CreditCard, Tag, Package, Receipt
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '@/lib/api';
import Link from 'next/link';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Mock Data ─────────────────────────────────────────────────────────────
const mockDailySummary = {
  date: new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  totalSales: 8450,
  invoiceCount: 14,
  avgBillValue: 603,
  cashSales: 4800,
  upiSales: 2900,
  cardSales: 750,
  creditSales: 0,
  topItems: [
    { name: 'Croissant', qty: 32, total: 1920, emoji: '🥐' },
    { name: 'Cappuccino', qty: 28, total: 2240, emoji: '☕' },
    { name: 'Sourdough Bread', qty: 18, total: 2160, emoji: '🍞' },
    { name: 'Muffin', qty: 25, total: 1125, emoji: '🧁' },
    { name: 'Fresh Juice', qty: 16, total: 960, emoji: '🥤' },
  ],
  hourlyData: [
    { hour: '8am', sales: 450 }, { hour: '9am', sales: 1200 }, { hour: '10am', sales: 1800 },
    { hour: '11am', sales: 950 }, { hour: '12pm', sales: 750 }, { hour: '1pm', sales: 600 },
    { hour: '2pm', sales: 300 }, { hour: '3pm', sales: 550 }, { hour: '4pm', sales: 850 }, { hour: '5pm', sales: 1000 },
  ],
  gstCollected: 380,
};

const mockPL = {
  revenue: { total: 184500, discounts: 4200, tax: 8100, invoices: 312 },
  expenses: { total: 75500, breakdown: [
    { _id: 'rent', total: 25000 }, { _id: 'salary', total: 38000 },
    { _id: 'utilities', total: 3500 }, { _id: 'marketing', total: 5000 }, { _id: 'maintenance', total: 4000 },
  ]},
  netProfit: 109000,
  profitMargin: 59.1,
};

const mockGST = {
  totalSales: 184500, totalCGST: 4050, totalSGST: 4050, totalIGST: 0, totalTax: 8100, invoiceCount: 312
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'pl' | 'gst' | 'cashflow'>('daily');
  const [dailyData, setDailyData] = useState<any>(mockDailySummary);
  const [plData, setPlData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gstMonth, setGstMonth] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pl, cf] = await Promise.all([
          api.get('/reports/profit-loss'),
          api.get(`/reports/cash-flow?year=${gstMonth.year}`),
        ]);
        setPlData(pl.data.data);
        setCashFlowData(cf.data.data?.months?.map((m: any) => ({
          month: MONTHS[m.month - 1], income: m.income, expense: m.expense, netFlow: m.netFlow
        })) || []);
      } catch {
        setPlData(mockPL);
        setCashFlowData(MONTHS.map((m, i) => ({
          month: m,
          income: [22000, 28000, 31000, 26000, 35000, 42000, 38000, 45000, 39000, 47000, 52000, 55000][i],
          expense: [15000, 18000, 16000, 17000, 19000, 21000, 18000, 20000, 19000, 21000, 23000, 24000][i],
          netFlow: 0,
        })).map(d => ({ ...d, netFlow: d.income - d.expense })));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [gstMonth.year]);

  useEffect(() => {
    const loadGST = async () => {
      try {
        const res = await api.get(`/reports/gst?month=${gstMonth.month}&year=${gstMonth.year}`);
        setGstData(res.data.data);
      } catch { setGstData(mockGST); }
    };
    loadGST();
  }, [gstMonth]);

  const TABS = [
    { id: 'daily', label: "Today's Summary", emoji: '📅' },
    { id: 'pl', label: 'Profit & Loss', emoji: '📈' },
    { id: 'gst', label: 'GST Report', emoji: '📋' },
    { id: 'cashflow', label: 'Cash Flow', emoji: '💵' },
  ];

  const paymentPieData = [
    { name: 'Cash', value: dailyData.cashSales, color: '#d97706' },
    { name: 'UPI', value: dailyData.upiSales, color: '#10b981' },
    { name: 'Card', value: dailyData.cardSales, color: '#6366f1' },
    { name: 'Credit', value: dailyData.creditSales, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">📊 Reports</h1>
          <p className="text-stone-400 text-sm">Sales, GST & financial summaries</p>
        </div>
        <button className="btn-secondary" id="export-report">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 dark:bg-stone-800 rounded-2xl p-1 gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === t.id
                ? 'bg-white dark:bg-stone-700 text-amber-700 dark:text-amber-400 shadow-sm'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            <span>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ── DAILY SUMMARY TAB ────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div className="space-y-5 animate-slide-up">
          {/* Date Banner */}
          <div className="card p-4 bg-gradient-to-r from-amber-600 to-orange-500 border-0 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">{dailyData.date}</span>
            </div>
            <p className="text-amber-100 text-xs">Daily Business Summary · Sindhu Bakery</p>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Today's Sales", value: `₹${dailyData.totalSales.toLocaleString('en-IN')}`, icon: DollarSign, cls: 'from-amber-500 to-orange-600' },
              { label: 'Invoices Created', value: dailyData.invoiceCount, icon: Receipt, cls: 'from-emerald-500 to-teal-600' },
              { label: 'Avg Bill Value', value: `₹${dailyData.avgBillValue}`, icon: TrendingUp, cls: 'from-blue-500 to-indigo-600' },
              { label: 'GST Collected', value: `₹${dailyData.gstCollected}`, icon: FileText, cls: 'from-violet-500 to-purple-600' },
            ].map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="card p-5">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.cls} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xl font-bold text-stone-800 dark:text-stone-100">{c.value}</p>
                  <p className="text-xs text-stone-400 mt-1">{c.label}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Hourly Sales */}
            <div className="card p-5">
              <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-4">Hourly Sales Today</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-700" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Sales']}
                    contentStyle={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: '12px' }}
                  />
                  <Bar dataKey="sales" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Payment breakdown */}
            <div className="card p-5">
              <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-4">Payment Breakdown</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="40%" height={150}>
                  <PieChart>
                    <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={4} dataKey="value">
                      {paymentPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {[
                    { label: 'Cash', value: dailyData.cashSales, icon: Banknote, color: '#d97706' },
                    { label: 'UPI', value: dailyData.upiSales, icon: Smartphone, color: '#10b981' },
                    { label: 'Card', value: dailyData.cardSales, icon: CreditCard, color: '#6366f1' },
                    { label: 'Credit', value: dailyData.creditSales, icon: Tag, color: '#ef4444' },
                  ].map(p => {
                    const Icon = p.icon;
                    return (
                      <div key={p.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                          <span className="text-xs text-stone-600 dark:text-stone-400">{p.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                          ₹{p.value.toLocaleString('en-IN')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Top Items */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-800 dark:text-stone-100">Top Items Sold Today</h3>
              <Link href="/inventory" className="text-amber-600 dark:text-amber-400 text-xs font-medium hover:underline">
                Manage stock →
              </Link>
            </div>
            <div className="space-y-3">
              {dailyData.topItems.map((item: any, i: number) => {
                const maxTotal = dailyData.topItems[0].total;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{item.name}</span>
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-400">₹{item.total.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                          style={{ width: `${(item.total / maxTotal) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{item.qty} units sold</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── P&L TAB ────────────────────────────────────────────────── */}
      {activeTab === 'pl' && plData && (
        <div className="space-y-5 animate-slide-up">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: `₹${plData.revenue.total.toLocaleString('en-IN')}`, emoji: '💰', cls: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Total Expenses', value: `₹${plData.expenses.total.toLocaleString('en-IN')}`, emoji: '💸', cls: 'text-red-600 dark:text-red-400' },
              { label: 'Net Profit', value: `₹${plData.netProfit.toLocaleString('en-IN')}`, emoji: '📈', cls: 'text-amber-700 dark:text-amber-400' },
              { label: 'Profit Margin', value: `${plData.profitMargin}%`, emoji: '🎯', cls: 'text-violet-600 dark:text-violet-400' },
            ].map(card => (
              <div key={card.label} className="card p-5">
                <div className="text-2xl mb-2">{card.emoji}</div>
                <p className={`text-xl font-bold ${card.cls}`}>{card.value}</p>
                <p className="text-xs text-stone-400 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
          <div className="card p-5">
            <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-4">Expense Breakdown</h3>
            <div className="space-y-3">
              {plData.expenses.breakdown.map((exp: any) => {
                const pct = ((exp.total / plData.expenses.total) * 100).toFixed(1);
                return (
                  <div key={exp._id} className="flex items-center gap-3">
                    <span className="text-sm text-stone-600 dark:text-stone-300 w-24 capitalize">{exp._id}</span>
                    <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-stone-700 dark:text-stone-300 w-24 text-right">₹{exp.total.toLocaleString('en-IN')}</span>
                    <span className="text-xs text-stone-400 w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── GST TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'gst' && (
        <div className="space-y-5 animate-slide-up">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <select value={gstMonth.month} onChange={e => setGstMonth(p => ({ ...p, month: parseInt(e.target.value) }))} className="input-field w-auto" id="gst-month">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={gstMonth.year} onChange={e => setGstMonth(p => ({ ...p, year: parseInt(e.target.value) }))} className="input-field w-auto" id="gst-year">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {gstData && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Total Sales', value: `₹${gstData.totalSales?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: `${gstData.invoiceCount} invoices` },
                { label: 'CGST Collected', value: `₹${gstData.totalCGST?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: 'Central GST' },
                { label: 'SGST Collected', value: `₹${gstData.totalSGST?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: 'State GST' },
                { label: 'IGST', value: `₹${gstData.totalIGST?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: 'Inter-state' },
                { label: 'Total GST Payable', value: `₹${gstData.totalTax?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, desc: 'Net tax liability', highlight: true },
              ].map(item => (
                <div key={item.label} className={`card p-5 ${item.highlight ? 'border-amber-500/40 bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                  <p className={`text-xl font-bold ${item.highlight ? 'text-amber-700 dark:text-amber-400' : 'text-stone-800 dark:text-stone-100'}`}>{item.value}</p>
                  <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mt-1">{item.label}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CASH FLOW TAB ───────────────────────────────────────────── */}
      {activeTab === 'cashflow' && (
        <div className="card p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">Cash Flow — {gstMonth.year}</h3>
            <select value={gstMonth.year} onChange={e => setGstMonth(p => ({ ...p, year: parseInt(e.target.value) }))} className="input-field w-28 text-xs" id="cf-year">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-700" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any, name) => [`₹${Number(v).toLocaleString('en-IN')}`, name]}
                contentStyle={{ background: '#1c1917', border: '1px solid #44403c', borderRadius: '12px' }}
              />
              <Legend />
              <Bar dataKey="income" fill="#d97706" name="Income" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
