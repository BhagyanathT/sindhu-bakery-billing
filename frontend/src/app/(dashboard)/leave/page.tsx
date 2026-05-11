'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { applyLeave, adminAddLeave, getMyLeaves, getAllLeaves, updateLeaveStatus, deleteLeave, getLeaveExportUrl } from '@/lib/leaveApi';
import { getStaff } from '@/lib/staffApi';
import { CalendarOff, Plus, Check, X, Loader2, UserPlus, Download, Trash2, List, Calendar as CalIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { clsx } from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const STAFF_COLORS = [
  'bg-blue-500','bg-purple-500','bg-pink-500','bg-orange-500','bg-teal-500',
  'bg-indigo-500','bg-red-500','bg-green-500','bg-yellow-500','bg-cyan-500',
];

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun
}

// Build a set of "YYYY-MM-DD_staffName" strings for fast lookup
function buildLeaveSet(leaves: any[]) {
  const set: Record<string, { name: string; type: string; status: string; colorIdx: number }[]> = {};
  leaves.forEach((l, li) => {
    if (l.status === 'rejected') return;
    const start = new Date(l.startDate);
    const end = new Date(l.endDate);
    const name = l.staffId?.name || 'Staff';
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!set[key]) set[key] = [];
      set[key].push({ name, type: l.type, status: l.status, colorIdx: li % STAFF_COLORS.length });
    }
  });
  return set;
}

const EMPTY_SELF = { startDate: '', endDate: '', type: 'unpaid', reason: '' };
const EMPTY_ADMIN = { staffId: '', startDate: '', endDate: '', type: 'unpaid', reason: '' };

export default function LeavePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [modal, setModal] = useState<'self' | 'admin' | null>(null);
  const [selfForm, setSelfForm] = useState({ ...EMPTY_SELF });
  const [adminForm, setAdminForm] = useState({ ...EMPTY_ADMIN });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const data = isAdmin ? await getAllLeaves() : await getMyLeaves();
      setLeaves(data);
    } catch { toast.error('Failed to load leaves'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => {
    if (user) {
      fetchLeaves();
      if (isAdmin) getStaff().then(setStaffList).catch(() => {});
    }
  }, [user, fetchLeaves, isAdmin]);

  // Calendar data
  const [calYear, calMonth] = month.split('-').map(Number);
  const leaveSet = useMemo(() => buildLeaveSet(leaves), [leaves]);
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const handleSelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await applyLeave(selfForm);
      toast.success('✅ Leave request submitted!');
      setModal(null);
      setSelfForm({ ...EMPTY_SELF });
      fetchLeaves();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.staffId) { toast.error('Select a staff member'); return; }
    setSaving(true);
    try {
      await adminAddLeave(adminForm);
      toast.success('✅ Leave added');
      setModal(null);
      setAdminForm({ ...EMPTY_ADMIN });
      fetchLeaves();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateLeaveStatus(id, status);
      toast.success(`Leave ${status}`);
      fetchLeaves();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this leave record?')) return;
    setDeleting(id);
    try {
      await deleteLeave(id);
      toast.success('Deleted');
      fetchLeaves();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  };

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-purple-600" /> Leave Management
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">{leaves.length} total records</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month picker */}
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field py-1.5 w-auto text-sm" />

          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700">
            <button onClick={() => setViewMode('calendar')} className={clsx('p-2 transition-colors', viewMode === 'calendar' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-stone-800 text-stone-500')}>
              <CalIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={clsx('p-2 transition-colors', viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-stone-800 text-stone-500')}>
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Export */}
          {isAdmin && (
            <a href={getLeaveExportUrl(month, token)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-sm transition-colors">
              <Download className="w-4 h-4" /> Export
            </a>
          )}

          {/* Add buttons */}
          {!isAdmin && (
            <button onClick={() => setModal('self')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md">
              <Plus className="w-4 h-4" /> Apply
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setModal('admin')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md">
              <UserPlus className="w-4 h-4" /> Add Leave
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>
      ) : viewMode === 'calendar' ? (
        /* ─── CALENDAR VIEW ─── */
        <div className="card overflow-hidden">
          {/* Month navigation */}
          <div className="px-4 py-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10">
            <button
              onClick={() => {
                const d = new Date(calYear, calMonth - 2, 1);
                setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
              }}
              className="p-2 rounded-lg hover:bg-white/60 text-stone-600 font-bold"
            >‹</button>
            <h2 className="font-bold text-stone-800 dark:text-stone-100">
              {new Date(calYear, calMonth - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => {
                const d = new Date(calYear, calMonth, 1);
                setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
              }}
              className="p-2 rounded-lg hover:bg-white/60 text-stone-600 font-bold"
            >›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-stone-100 dark:border-stone-800">
            {days.map(d => (
              <div key={d} className="py-2 text-center text-xs font-bold text-stone-400 dark:text-stone-500">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[70px] sm:min-h-[90px] border-r border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/20" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === today;
              const leavesOnDay = leaveSet[dateStr] || [];
              const isSunday = (firstDay + idx) % 7 === 0;

              return (
                <div
                  key={day}
                  className={clsx(
                    'min-h-[70px] sm:min-h-[90px] border-r border-b border-stone-100 dark:border-stone-800 p-1 flex flex-col overflow-hidden',
                    isToday && 'bg-purple-50 dark:bg-purple-900/10',
                    isSunday && !isToday && 'bg-red-50/30 dark:bg-red-900/5'
                  )}
                >
                  <span className={clsx(
                    'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 flex-shrink-0',
                    isToday ? 'bg-purple-600 text-white' : isSunday ? 'text-red-400' : 'text-stone-500 dark:text-stone-400'
                  )}>
                    {day}
                  </span>
                  <div className="space-y-0.5 overflow-hidden">
                    {leavesOnDay.slice(0, 3).map((l, i) => (
                      <div
                        key={i}
                        className={clsx('text-[9px] sm:text-[10px] text-white px-1 py-0.5 rounded truncate font-medium', STAFF_COLORS[l.colorIdx])}
                        title={`${l.name} (${l.type})`}
                      >
                        {l.name.split(' ')[0]}
                      </div>
                    ))}
                    {leavesOnDay.length > 3 && (
                      <div className="text-[9px] text-stone-400 px-1">+{leavesOnDay.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          {isAdmin && leaves.length > 0 && (
            <div className="px-4 py-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap gap-2">
              {Array.from(new Set(leaves.filter(l => l.status !== 'rejected').map(l => l.staffId?.name))).map((name, i) => (
                <div key={name as string} className="flex items-center gap-1.5">
                  <div className={clsx('w-3 h-3 rounded-full', STAFF_COLORS[i % STAFF_COLORS.length])} />
                  <span className="text-xs text-stone-600 dark:text-stone-400">{name as string}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ─── LIST VIEW ─── */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 text-xs uppercase">
                <tr>
                  {isAdmin && <th className="px-4 py-3">Staff</th>}
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Days</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 hidden md:table-cell">Reason</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {leaves.map(leave => {
                  const days = Math.round((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / 86400000) + 1;
                  return (
                    <tr key={leave._id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{leave.staffId?.name}</p>
                          <p className="text-xs text-stone-400 capitalize">{leave.staffId?.role}</p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium">{new Date(leave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                        <p className="text-stone-400 text-xs">to {new Date(leave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="font-bold text-stone-700 dark:text-stone-300">{days}</span>
                        <span className="text-xs text-stone-400 ml-1">d</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded font-bold', leave.type === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-400')}>
                          {leave.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500 hidden md:table-cell max-w-[150px] truncate">{leave.reason || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold capitalize', STATUS_STYLES[leave.status] || STATUS_STYLES.pending)}>
                          {leave.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {leave.status === 'pending' && (
                              <>
                                <button onClick={() => handleStatusChange(leave._id, 'approved')} className="p-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 hover:bg-green-100 rounded-lg" title="Approve">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleStatusChange(leave._id, 'rejected')} className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 rounded-lg" title="Reject">
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDelete(leave._id)}
                              disabled={deleting === leave._id}
                              className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete"
                            >
                              {deleting === leave._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {leaves.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 5} className="px-4 py-12 text-center text-stone-400">
                    <CalendarOff className="w-8 h-8 mx-auto mb-2 text-stone-300" />No leave records found
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Self Apply Modal ─── */}
      {modal === 'self' && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
              <h2 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2"><Plus className="w-4 h-4 text-purple-600" /> Apply for Leave</h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-700 text-xl">✕</button>
            </div>
            <form onSubmit={handleSelfSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Start *</label>
                  <input required type="date" value={selfForm.startDate} onChange={e => setSelfForm({ ...selfForm, startDate: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">End *</label>
                  <input required type="date" min={selfForm.startDate} value={selfForm.endDate} onChange={e => setSelfForm({ ...selfForm, endDate: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Type *</label>
                <select value={selfForm.type} onChange={e => setSelfForm({ ...selfForm, type: e.target.value })} className="input-field">
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="paid">Paid Leave</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Reason *</label>
                <textarea required value={selfForm.reason} onChange={e => setSelfForm({ ...selfForm, reason: e.target.value })} rows={2} placeholder="Reason..." className="input-field resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm disabled:opacity-60">
                  {saving ? '...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Admin Add Leave Modal ─── */}
      {modal === 'admin' && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
              <h2 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2"><UserPlus className="w-4 h-4 text-indigo-600" /> Add Leave for Staff</h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-700 text-xl">✕</button>
            </div>
            <form onSubmit={handleAdminSubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Staff Member *</label>
                <select required value={adminForm.staffId} onChange={e => setAdminForm({ ...adminForm, staffId: e.target.value })} className="input-field">
                  <option value="">— Select Staff —</option>
                  {staffList.map(s => <option key={s._id} value={s._id}>{s.name} ({s.role})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Start *</label>
                  <input required type="date" value={adminForm.startDate} onChange={e => setAdminForm({ ...adminForm, startDate: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">End *</label>
                  <input required type="date" min={adminForm.startDate} value={adminForm.endDate} onChange={e => setAdminForm({ ...adminForm, endDate: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Type *</label>
                <select value={adminForm.type} onChange={e => setAdminForm({ ...adminForm, type: e.target.value })} className="input-field">
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="paid">Paid Leave (marks attendance as Present)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Note</label>
                <input type="text" value={adminForm.reason} onChange={e => setAdminForm({ ...adminForm, reason: e.target.value })} placeholder="e.g. Sick, Festival" className="input-field" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-[2] py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-60">
                  {saving ? '...' : 'Add Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
