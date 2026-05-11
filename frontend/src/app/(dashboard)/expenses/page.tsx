'use client';
// src/app/(dashboard)/expenses/page.tsx
import { useState, useEffect } from 'react';
import { Plus, X, Trash2, DollarSign, Calendar, Filter } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const CATEGORIES = ['rent', 'salary', 'utilities', 'marketing', 'travel', 'office', 'equipment', 'maintenance', 'taxes', 'other'];
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'];
const CATEGORY_ICONS: Record<string, string> = { rent: '🏢', salary: '👷', utilities: '💡', marketing: '📣', travel: '✈️', office: '🖥️', equipment: '🔧', maintenance: '⚙️', taxes: '📋', other: '💼' };

const emptyExpense = { title: '', amount: '', category: 'other', date: new Date().toISOString().split('T')[0], paymentMethod: 'cash', notes: '' };

const mockExpenses = [
  { _id: '1', title: 'Monthly Rent', amount: 25000, category: 'rent', date: '2026-04-01', paymentMethod: 'bank_transfer' },
  { _id: '2', title: 'Staff Salaries', amount: 45000, category: 'salary', date: '2026-04-01', paymentMethod: 'bank_transfer' },
  { _id: '3', title: 'Electricity Bill', amount: 3500, category: 'utilities', date: '2026-04-05', paymentMethod: 'upi' },
  { _id: '4', title: 'Oven Maintenance', amount: 2000, category: 'maintenance', date: '2026-04-10', paymentMethod: 'cash' },
  { _id: '5', title: 'Google Ads', amount: 5000, category: 'marketing', date: '2026-04-15', paymentMethod: 'card' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>(emptyExpense);
  const [filter, setFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let params = '?';
      if (filter) params += `category=${filter}&`;
      if (startDate) params += `startDate=${startDate}&`;
      if (endDate) params += `endDate=${endDate}&`;
      const res = await api.get(`/expenses${params}`);
      setExpenses(res.data.data.expenses || []);
      setTotalAmount(res.data.data.totalAmount || 0);
    } catch {
      const filtered = filter ? mockExpenses.filter(e => e.category === filter) : mockExpenses;
      setExpenses(filtered);
      setTotalAmount(filtered.reduce((s, e) => s + e.amount, 0));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpenses(); }, [filter, startDate, endDate]);

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/expenses/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'expenses_backup.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      toast.error('Failed to export expenses');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await api.post('/expenses/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'Expenses imported successfully');
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import expenses');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const saveExpense = async () => {
    if (!form.title || !form.amount) { toast.error('Title and amount are required'); return; }
    try {
      await api.post('/expenses', { ...form, amount: parseFloat(form.amount) });
      toast.success('Expense recorded!');
    } catch {
      toast.success('Expense recorded (demo)');
    }
    setShowModal(false);
    setForm(emptyExpense);
    fetchExpenses();
  };

  const deleteExpense = async (id: string) => {
    try {
      await api.delete(`/expenses/${id}`);
    } catch {}
    toast.success('Expense deleted');
    setExpenses(prev => prev.filter(e => e._id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Expenses</h1>
          <p className="text-slate-400 text-sm">Total: <strong className="text-red-500">₹{totalAmount.toLocaleString('en-IN')}</strong></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            id="import-excel"
            onChange={handleImportExcel}
          />
          <button onClick={() => document.getElementById('import-excel')?.click()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors whitespace-nowrap">
            Import Excel
          </button>
          <button onClick={handleExportExcel} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors whitespace-nowrap">
            Export Excel
          </button>
          <button onClick={() => { setForm(emptyExpense); setShowModal(true); }} className="btn-primary whitespace-nowrap" id="add-expense-btn">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 flex-1">
        <button onClick={() => setFilter('')} className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition-all', !filter ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')} id="filter-all-exp">
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize flex items-center gap-1', filter === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}
            id={`filter-${cat}`}>
            {CATEGORY_ICONS[cat]} {cat}
          </button>
        ))}
        </div>

        {/* Date Filters */}
        <div className="flex gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field pl-9 text-sm py-1.5 md:w-[140px]" />
            </div>
          </div>
          <div className="flex-1 md:flex-none">
            <label className="block text-xs font-semibold text-slate-500 mb-1">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field pl-9 text-sm py-1.5 md:w-[140px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Expense List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead className="bg-slate-50 dark:bg-slate-800/80">
              <tr>
                <th>Expense</th>
                <th>Category</th>
                <th>Date</th>
                <th>Payment</th>
                <th className="text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={6}><div className="h-12 shimmer rounded" /></td></tr>
                ))
              ) : expenses.map((exp) => (
                <tr key={exp._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{CATEGORY_ICONS[exp.category]}</span>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{exp.title}</p>
                        {exp.notes && <p className="text-xs text-slate-400 truncate max-w-xs">{exp.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="capitalize text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full font-medium">
                      {exp.category}
                    </span>
                  </td>
                  <td className="text-slate-500 dark:text-slate-400 text-sm">
                    {new Date(exp.date).toLocaleDateString('en-IN')}
                  </td>
                  <td className="capitalize text-slate-500 dark:text-slate-400 text-sm">{exp.paymentMethod?.replace('_', ' ')}</td>
                  <td className="text-right font-bold text-red-600 dark:text-red-400">
                    ₹{exp.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="text-right">
                    <button onClick={() => deleteExpense(exp._id)} className="btn-icon text-red-400" id={`del-exp-${exp._id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Record Expense</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Expense Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" placeholder="e.g., Monthly Rent, Salary" id="exp-title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Amount *</label>
                  <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" placeholder="0.00" id="exp-amount" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" id="exp-date" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                      className={clsx('px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all', form.category === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300')}
                      id={`cat-${cat}`}>
                      {CATEGORY_ICONS[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Payment Method</label>
                <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="input-field capitalize" id="exp-payment">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes (optional)</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field resize-none" rows={2} placeholder="Additional details..." id="exp-notes" />
              </div>
              <button onClick={saveExpense} className="w-full btn-primary py-3.5" id="save-expense-btn">
                Record Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
