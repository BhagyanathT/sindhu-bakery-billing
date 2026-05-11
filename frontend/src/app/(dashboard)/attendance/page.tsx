'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { checkIn, checkOut, getMyTodayAttendance, getAllAttendance, markAttendance, getMonthlyAttendanceSummary, deleteAttendance, getAttendanceExportUrl } from '@/lib/attendanceApi';
import { getStaff } from '@/lib/staffApi';
import { Clock, CheckCircle, Play, Square, Loader2, Calendar, Users, Download, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { clsx } from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  Present: 'bg-green-500 text-white',
  Half: 'bg-yellow-500 text-white',
  Absent: 'bg-red-400 text-white',
  '': 'bg-stone-200 dark:bg-stone-700 text-stone-500',
};

const todayStr = () => new Date().toISOString().split('T')[0];
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function AttendancePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Staff self view
  const [todayAtt, setTodayAtt] = useState<any>(null);
  const [loadingSelf, setLoadingSelf] = useState(true);

  // Admin views
  const [activeTab, setActiveTab] = useState<'mark' | 'history' | 'summary'>('mark');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [markDate, setMarkDate] = useState(todayStr());
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [deletingAtt, setDeletingAtt] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

  // Fetch self attendance
  const fetchSelf = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingSelf(true);
      const att = await getMyTodayAttendance();
      setTodayAtt(att);
    } catch { /* ignore */ }
    finally { setLoadingSelf(false); }
  }, [user]);

  // Fetch attendance for mark date (admin)
  const fetchMarkDateAttendance = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingAdmin(true);
      const [staff, records] = await Promise.all([
        getStaff(),
        getAllAttendance(markDate, undefined, undefined),
      ]);
      setStaffList(staff);
      const map: Record<string, string> = {};
      records.forEach((r: any) => { map[r.staffId?._id || r.staffId] = r.status; });
      setAttendanceMap(map);
    } catch { toast.error('Failed to load staff'); }
    finally { setLoadingAdmin(false); }
  }, [isAdmin, markDate]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingAdmin(true);
      const [year, m] = month.split('-');
      const startDate = `${year}-${m}-01`;
      const endDate = new Date(parseInt(year), parseInt(m), 0).toISOString().split('T')[0];
      const records = await getAllAttendance(undefined, startDate, endDate);
      setHistory(records);
    } catch { toast.error('Failed to load history'); }
    finally { setLoadingAdmin(false); }
  }, [isAdmin, month]);

  // Fetch monthly summary
  const fetchSummary = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingAdmin(true);
      const data = await getMonthlyAttendanceSummary(month);
      setSummary(data.summary || []);
    } catch { toast.error('Failed to load summary'); }
    finally { setLoadingAdmin(false); }
  }, [isAdmin, month]);

  useEffect(() => { fetchSelf(); }, [fetchSelf]);
  useEffect(() => { if (isAdmin && activeTab === 'mark') fetchMarkDateAttendance(); }, [fetchMarkDateAttendance, activeTab]);
  useEffect(() => { if (isAdmin && activeTab === 'history') fetchHistory(); }, [fetchHistory, activeTab]);
  useEffect(() => { if (isAdmin && activeTab === 'summary') fetchSummary(); }, [fetchSummary, activeTab]);

  const handleMarkStatus = async (staffId: string, status: 'Present' | 'Half' | 'Absent') => {
    setSavingId(staffId);
    try {
      await markAttendance({ staffId, date: markDate, status });
      setAttendanceMap(prev => ({ ...prev, [staffId]: status }));
      toast.success(`Marked ${status}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to mark');
    } finally { setSavingId(null); }
  };

  const handleDeleteAtt = async (id: string) => {
    if (!confirm('Delete this attendance record?')) return;
    setDeletingAtt(id);
    try {
      await deleteAttendance(id);
      toast.success('Deleted');
      fetchHistory();
    } catch { toast.error('Failed to delete'); }
    finally { setDeletingAtt(null); }
  };

  const handleCheckIn = async () => {
    try { await checkIn(); toast.success('✅ Checked in!'); fetchSelf(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed to check in'); }
  };

  const handleCheckOut = async () => {
    try { await checkOut(); toast.success('✅ Checked out!'); fetchSelf(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Failed to check out'); }
  };

  return (
    <div className="space-y-6">
      {/* Self Check-in/out card — for all users */}
      <div className="bg-gradient-to-br from-indigo-900 to-blue-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Clock className="w-32 h-32" /></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Today's Attendance</h1>
            <p className="text-blue-200 text-sm">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            {todayAtt?.checkInTime && (
              <div className="mt-3 flex items-center gap-4 bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20 text-sm">
                <div><p className="text-blue-300 text-xs uppercase">Check In</p><p className="font-mono font-bold">{new Date(todayAtt.checkInTime).toLocaleTimeString()}</p></div>
                {todayAtt?.checkOutTime && (
                  <>
                    <div className="w-px h-8 bg-white/20" />
                    <div><p className="text-blue-300 text-xs uppercase">Check Out</p><p className="font-mono font-bold">{new Date(todayAtt.checkOutTime).toLocaleTimeString()}</p></div>
                    <div className="w-px h-8 bg-white/20" />
                    <div><p className="text-blue-300 text-xs uppercase">Hours</p><p className="font-mono font-bold">{todayAtt.totalHours}h</p></div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {loadingSelf ? <Loader2 className="animate-spin w-8 h-8" /> : !todayAtt?.checkInTime ? (
              <button onClick={handleCheckIn} className="flex flex-col items-center justify-center w-28 h-28 bg-green-500 hover:bg-green-400 text-white rounded-xl shadow-lg active:scale-95 transition-all">
                <Play className="w-7 h-7 mb-1" fill="currentColor" /><span className="font-bold text-sm">CHECK IN</span>
              </button>
            ) : !todayAtt?.checkOutTime ? (
              <button onClick={handleCheckOut} className="flex flex-col items-center justify-center w-28 h-28 bg-red-500 hover:bg-red-400 text-white rounded-xl shadow-lg active:scale-95 transition-all">
                <Square className="w-7 h-7 mb-1" fill="currentColor" /><span className="font-bold text-sm">CHECK OUT</span>
              </button>
            ) : (
              <div className="flex flex-col items-center justify-center w-28 h-28 bg-white/10 text-white rounded-xl border border-white/20">
                <CheckCircle className="w-7 h-7 mb-1 text-green-400" /><span className="font-bold text-xs text-center">COMPLETED<br />FOR TODAY</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Section */}
      {isAdmin && (
        <div className="card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-stone-200 dark:border-stone-700">
            {[
              { key: 'mark', label: '✏️ Mark Attendance', icon: Users },
              { key: 'history', label: '📋 History', icon: Calendar },
              { key: 'summary', label: '📊 Monthly Summary', icon: CheckCircle },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={clsx(
                  'flex-1 py-3 text-sm font-semibold transition-colors border-b-2',
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mark Attendance Tab */}
          {activeTab === 'mark' && (
            <div>
              <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-3">
                <label className="text-sm font-semibold text-stone-600 dark:text-stone-400">Date:</label>
                <input
                  type="date"
                  value={markDate}
                  onChange={e => setMarkDate(e.target.value)}
                  className="input-field py-1.5 w-auto"
                />
                <span className="text-xs text-stone-400">Click P/H/A to mark each staff</span>
              </div>
              {loadingAdmin ? (
                <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
              ) : staffList.length === 0 ? (
                <div className="p-10 text-center text-stone-400">No active staff found. Add staff first.</div>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {staffList.map(staff => {
                    const currentStatus = attendanceMap[staff._id] || '';
                    const isSaving = savingId === staff._id;
                    return (
                      <div key={staff._id} className="flex items-center justify-between px-5 py-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {staff.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{staff.name}</p>
                            <p className="text-xs text-stone-400 capitalize">{staff.role} · {staff.salaryType}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
                          {(['Present', 'Half', 'Absent'] as const).map(status => (
                            <button
                              key={status}
                              disabled={isSaving}
                              onClick={() => handleMarkStatus(staff._id, status)}
                              className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                currentStatus === status
                                  ? STATUS_STYLES[status]
                                  : 'bg-stone-100 dark:bg-stone-700 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-600'
                              )}
                            >
                              {status === 'Present' ? 'P' : status === 'Half' ? 'H' : 'A'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-3 flex-wrap">
                <label className="text-sm font-semibold text-stone-600 dark:text-stone-400">Month:</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field py-1.5 w-auto" />
                <a href={getAttendanceExportUrl(month, token)} target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium text-xs transition-colors">
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </a>
              </div>
              {loadingAdmin ? (
                <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 text-xs uppercase">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Staff</th>
                        <th className="px-5 py-3">In</th>
                        <th className="px-5 py-3">Out</th>
                        <th className="px-5 py-3">Hours</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">OT</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {history.map(r => (
                        <tr key={r._id} className="hover:bg-stone-50 dark:hover:bg-stone-800/30">
                          <td className="px-5 py-3 font-mono text-xs">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                          <td className="px-5 py-3 font-semibold">{r.staffId?.name}</td>
                          <td className="px-5 py-3 font-mono text-xs">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td className="px-5 py-3 font-mono text-xs">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                          <td className="px-5 py-3">{r.totalHours || '-'}</td>
                          <td className="px-5 py-3">
                            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', STATUS_STYLES[r.status] || STATUS_STYLES[''])}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-indigo-600 dark:text-indigo-400 font-medium">{r.overtimeHours > 0 ? `+${r.overtimeHours}h` : '-'}</td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => handleDeleteAtt(r._id)}
                              disabled={deletingAtt === r._id}
                              className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete"
                            >
                              {deletingAtt === r._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr><td colSpan={8} className="px-5 py-10 text-center text-stone-400">No records for this month</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Monthly Summary Tab */}
          {activeTab === 'summary' && (
            <div>
              <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-3">
                <label className="text-sm font-semibold text-stone-600 dark:text-stone-400">Month:</label>
                <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field py-1.5 w-auto" />
              </div>
              {loadingAdmin ? (
                <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {summary.map(s => (
                    <div key={s.staff._id} className="px-5 py-4 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold">
                          {s.staff.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{s.staff.name}</p>
                          <p className="text-xs text-stone-400 capitalize">{s.staff.role} · ₹{s.staff.salaryAmount}/{s.staff.salaryType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-center">
                        <div className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-xl">
                          <p className="text-xs text-green-600 dark:text-green-400 font-bold">{s.present}</p>
                          <p className="text-[10px] text-green-500">Present</p>
                        </div>
                        <div className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">{s.half}</p>
                          <p className="text-[10px] text-yellow-500">Half</p>
                        </div>
                        <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
                          <p className="text-xs text-red-600 dark:text-red-400 font-bold">{s.absent}</p>
                          <p className="text-[10px] text-red-500">Absent</p>
                        </div>
                        {s.totalOT > 0 && (
                          <div className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{s.totalOT}h</p>
                            <p className="text-[10px] text-indigo-500">OT</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {summary.length === 0 && (
                    <div className="p-10 text-center text-stone-400">No summary data for this month</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
