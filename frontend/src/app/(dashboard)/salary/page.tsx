'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getSalaries, generateSalary, getPendingSalaries, updateSalary, deleteSalary, getSalaryExportUrl } from '@/lib/salaryApi';
import { Wallet, Calculator, Check, Loader2, AlertCircle, RefreshCw, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';


const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const currentWeek = () => {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const mondayW1 = new Date(jan4);
  mondayW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const week = Math.ceil(((now.getTime() - mondayW1.getTime()) / 86400000 + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
};

export default function SalaryPage() {
  const [periodType, setPeriodType] = useState<'monthly' | 'weekly'>('monthly');
  const [period, setPeriod] = useState(currentMonth());
  const [salaries, setSalaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pendingData, setPendingData] = useState<{ count: number; totalPending: number; records: any[] } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

  const fetchSalaries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSalaries(period);
      setSalaries(data);
    } catch { toast.error('Failed to load salaries'); }
    finally { setLoading(false); }
  }, [period]);

  const fetchPending = useCallback(async () => {
    try {
      const data = await getPendingSalaries();
      setPendingData(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);
  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Auto switch period type when period input changes
  const handlePeriodTypeChange = (type: 'monthly' | 'weekly') => {
    setPeriodType(type);
    setPeriod(type === 'monthly' ? currentMonth() : currentWeek());
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await generateSalary(period, periodType === 'weekly');
      toast.success(`✅ Salaries generated for ${period}`);
      fetchSalaries();
      fetchPending();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate salaries');
    } finally { setGenerating(false); }
  };

  const handleMarkPaid = async (id: string) => {
    if (!confirm('Mark this salary as Paid?')) return;
    try {
      await updateSalary(id, { status: 'Paid' });
      toast.success('✅ Marked as Paid');
      fetchSalaries();
      fetchPending();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this salary record?')) return;
    setDeleting(id);
    try {
      await deleteSalary(id);
      toast.success('Deleted');
      fetchSalaries();
      fetchPending();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  const handleAdvance = async (id: string, current: number) => {
    const val = prompt('Enter advance amount to deduct:', current.toString());
    if (val === null) return;
    try {
      await updateSalary(id, { advances: parseFloat(val) || 0 });
      toast.success('Advance updated');
      fetchSalaries();
    } catch { toast.error('Failed'); }
  };

  const pendingInList = salaries.filter(s => s.status === 'Pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-green-600" /> Salary Management
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">Generate and manage staff payroll</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => handlePeriodTypeChange('monthly')}
              className={clsx('px-3 py-2 text-xs font-bold transition-colors', periodType === 'monthly' ? 'bg-green-600 text-white' : 'bg-white dark:bg-stone-800 text-stone-500 hover:bg-stone-50')}
            >Monthly</button>
            <button
              onClick={() => handlePeriodTypeChange('weekly')}
              className={clsx('px-3 py-2 text-xs font-bold transition-colors', periodType === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-stone-800 text-stone-500 hover:bg-stone-50')}
            >Weekly</button>
          </div>
          {periodType === 'monthly' ? (
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="input-field py-2 w-auto" />
          ) : (
            <input type="week" value={period} onChange={e => setPeriod(e.target.value)} className="input-field py-2 w-auto" />
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-md disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Generate
          </button>
          <button onClick={() => { fetchSalaries(); fetchPending(); }} className="btn-icon">
            <RefreshCw className="w-4 h-4" />
          </button>
          <a href={getSalaryExportUrl(period, token)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-sm transition-colors">
            <Download className="w-4 h-4" /> Export
          </a>
        </div>
      </div>

      {/* Pending Salary Alert */}
      {pendingData && pendingData.count > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-orange-700 dark:text-orange-400">
              ⚠️ {pendingData.count} Pending Salary Payment{pendingData.count > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-500 mt-0.5">
              Total outstanding: <strong>₹{pendingData.totalPending.toLocaleString('en-IN')}</strong>
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {pendingData.records.slice(0, 5).map((r: any) => (
                <span key={r._id} className="text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                  {r.staffId?.name} — ₹{r.finalSalary} ({r.month})
                </span>
              ))}
              {pendingData.records.length > 5 && (
                <span className="text-xs text-orange-500">+{pendingData.records.length - 5} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Salary Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3">Staff</th>
                  <th className="px-5 py-3 text-center">Attendance</th>
                  <th className="px-5 py-3 text-center">OT (hrs)</th>
                  <th className="px-5 py-3 text-right">Base / Type</th>
                  <th className="px-5 py-3 text-right">Advance</th>
                  <th className="px-5 py-3 text-right">Final Salary</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {salaries.map(sal => (
                  <tr key={sal._id} className={clsx('transition-colors', sal.status === 'Pending' ? 'hover:bg-orange-50/40 dark:hover:bg-orange-900/10' : 'hover:bg-stone-50 dark:hover:bg-stone-800/30')}>
                    <td className="px-5 py-3">
                      <p className="font-bold text-stone-800 dark:text-stone-100">{sal.staffId?.name}</p>
                      <p className="text-xs text-stone-400 capitalize">{sal.staffId?.role}</p>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex justify-center gap-1.5 text-xs font-bold">
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded" title="Present">{sal.presentDays}P</span>
                        <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded" title="Half">{sal.halfDays}H</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center font-medium text-indigo-600 dark:text-indigo-400">{sal.overtimeHours || 0}</td>
                    <td className="px-5 py-3 text-right">
                      <p className="font-medium dark:text-stone-200">₹{sal.baseSalary}</p>
                      <p className="text-xs text-stone-400 capitalize">{sal.staffId?.salaryType}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => sal.status === 'Pending' && handleAdvance(sal._id, sal.advances)}
                        className={clsx('font-medium text-sm', sal.status === 'Pending' ? 'text-red-500 hover:text-red-700 border-b border-dashed border-red-300 cursor-pointer' : 'text-stone-400 cursor-default')}
                      >
                        ₹{sal.advances}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-black text-lg text-stone-800 dark:text-stone-100">₹{sal.finalSalary}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={clsx('px-2.5 py-1 rounded-full text-xs font-bold', sal.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400')}>
                        {sal.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {sal.status === 'Pending' ? (
                          <button
                            onClick={() => handleMarkPaid(sal._id)}
                            className="bg-stone-900 dark:bg-stone-100 hover:bg-green-700 dark:hover:bg-green-400 text-white dark:text-stone-900 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Pay
                          </button>
                        ) : (
                          <span className="text-xs text-stone-400">{sal.paidDate && new Date(sal.paidDate).toLocaleDateString('en-IN')}</span>
                        )}
                        <button
                          onClick={() => handleDelete(sal._id)}
                          disabled={deleting === sal._id}
                          className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          {deleting === sal._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {salaries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center">
                      <Wallet className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-stone-400 font-medium">No salaries generated for {period}</p>
                      <p className="text-stone-400 text-sm mt-1">Click "Generate" to calculate payroll based on attendance</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
