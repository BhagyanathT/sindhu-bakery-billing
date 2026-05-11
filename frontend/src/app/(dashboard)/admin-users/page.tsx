'use client';
// src/app/(dashboard)/admin-users/page.tsx — Admin User Management
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Plus, UserCheck, UserX, RefreshCw, Smartphone,
  Clock, Wifi, WifiOff, Eye, EyeOff, Trash2, Edit2, X, Save,
  Activity, LogOut, Download, Upload,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';

interface Session {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  deviceId: string;
  ip: string;
  userAgent: string;
  connectedAt: string;
  lastSeen: string;
  isOnline: boolean;
}

interface StaffUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  loginCount?: number;
  activeSessions?: any[];
  createdAt: string;
}

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'staff' };

export default function AdminUsersPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'sessions'>('users');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, sessionsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/users/sessions'),
      ]);
      setUsers(usersRes.data.data.users || []);
      setSessions(sessionsRes.data.data.sessions || []);
      setOnlineCount(sessionsRes.data.data.onlineCount || 0);
    } catch (err: any) {
      toast.error('Failed to load users: ' + (err?.response?.data?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh sessions every 30s
  useEffect(() => {
    const t = setInterval(() => {
      api.get('/admin/users/sessions').then(res => {
        setSessions(res.data.data.sessions || []);
        setOnlineCount(res.data.data.onlineCount || 0);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const openAdd = () => { setEditUser(null); setForm({ ...emptyForm }); setShowAddModal(true); };
  const openEdit = (u: StaffUser) => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '', phone: '', role: u.role }); setShowAddModal(true); };

  const saveUser = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email are required'); return; }
    if (!editUser && !form.password) { toast.error('Password is required for new users'); return; }
    setSaving(true);
    try {
      if (editUser) {
        const payload: any = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/admin/users/${editUser._id}`, payload);
        toast.success('User updated!');
      } else {
        await api.post('/admin/users', form);
        toast.success('User created! They can now login.');
      }
      setShowAddModal(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: StaffUser) => {
    if (u._id === me?._id) { toast.error("Can't disable your own account"); return; }
    try {
      await api.patch(`/admin/users/${u._id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? `${u.name} disabled` : `${u.name} enabled`);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed');
    }
  };

  const killSessions = async (userId: string, userName: string) => {
    if (!confirm(`Force logout ${userName}? All their devices will be disconnected.`)) return;
    try {
      await api.delete(`/admin/users/${userId}/sessions`);
      toast.success(`${userName} sessions cleared`);
      fetchAll();
    } catch { toast.error('Failed to clear sessions'); }
  };

  const deleteUser = async (u: StaffUser) => {
    if (!confirm(`Delete "${u.name}" permanently? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${u._id}`);
      toast.success(`${u.name} deleted`);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/users/export');
      const rows: any[] = res.data.data.users;
      const header = ['Name', 'Email', 'Role', 'Phone', 'Active', 'Last Login', 'Login Count', 'Created'];
      const lines = [header.join(','), ...rows.map(r =>
        [r.name, r.email, r.role, r.phone, r.isActive, r.lastLogin, r.loginCount, r.createdAt]
          .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
      )];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `staff-users-${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} users`);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const nameI = headers.indexOf('name'), emailI = headers.indexOf('email');
      const passI = headers.indexOf('password'), roleI = headers.indexOf('role'), phoneI = headers.indexOf('phone');
      if (nameI === -1 || emailI === -1 || passI === -1) {
        toast.error('CSV must have columns: name, email, password'); return;
      }
      const users = lines.slice(1).filter(l => l.trim()).map(l => {
        const cols = l.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        return { name: cols[nameI], email: cols[emailI], password: cols[passI],
          role: roleI > -1 ? cols[roleI] : 'staff', phone: phoneI > -1 ? cols[phoneI] : '' };
      });
      const res = await api.post('/admin/users/import', { users });
      const { imported, skipped } = res.data.data;
      toast.success(`Imported ${imported}, skipped ${skipped}`);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  const formatTime = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    const diffMs = Date.now() - dt.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getBrowserName = (ua: string) => {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Mobile')) return 'Mobile Browser';
    return 'Browser';
  };

  const getDeviceType = (ua: string) => {
    if (!ua) return '💻';
    if (/Android|iPhone|iPad|Mobile/i.test(ua)) return '📱';
    return '💻';
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <Users className="w-7 h-7 text-amber-600" /> User Management
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            Manage staff accounts &amp; monitor active sessions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchAll} className="btn-icon" title="Refresh"><RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /></button>
          <button onClick={exportCSV} disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-bold hover:bg-emerald-100 transition-colors disabled:opacity-60">
            <Download className="w-4 h-4" />{exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button onClick={() => importRef.current?.click()} disabled={importing}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-60">
            <Upload className="w-4 h-4" />{importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, icon: <Users className="w-4 h-4"/>, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Active Users', value: users.filter(u => u.isActive).length, icon: <UserCheck className="w-4 h-4"/>, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Online Now', value: onlineCount, icon: <Wifi className="w-4 h-4"/>, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Total Sessions', value: sessions.length, icon: <Smartphone className="w-4 h-4"/>, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map(c => (
          <div key={c.label} className={clsx('rounded-2xl p-3 border border-stone-200 dark:border-stone-700 flex items-center gap-3', c.bg)}>
            <div className={clsx('p-2 rounded-xl bg-white dark:bg-stone-800 shadow-sm', c.color)}>{c.icon}</div>
            <div>
              <p className="text-xs text-stone-500">{c.label}</p>
              <p className={clsx('font-black text-lg', c.color)}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl w-fit">
        {(['users', 'sessions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize',
              activeTab === tab ? 'bg-white dark:bg-stone-700 text-amber-600 shadow-sm' : 'text-stone-500 hover:text-stone-700')}>
            {tab === 'users' ? `👥 Users (${users.length})` : `🌐 Sessions (${sessions.length})`}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {loading ? (
            <div className="card p-12 text-center">
              <div className="w-10 h-10 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-stone-400 text-sm">Loading users…</p>
            </div>
          ) : users.length === 0 ? (
            <div className="card p-12 text-center">
              <Users className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="font-bold text-stone-500">No staff users yet</p>
              <p className="text-stone-400 text-sm mt-1">Click "Add User" to create the first staff account.</p>
            </div>
          ) : users.map(u => {
            const isOnline = sessions.some(s => s.userId === u._id && s.isOnline);
            const userSessions = sessions.filter(s => s.userId === u._id);
            const isMe = u._id === me?._id;
            return (
              <div key={u._id} className={clsx('card p-4 flex flex-wrap sm:flex-nowrap items-center gap-4 transition-all', !u.isActive && 'opacity-60')}>
                {/* Avatar */}
                <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black flex-shrink-0 relative',
                  u.role === 'admin' ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600')}>
                  {u.name.charAt(0).toUpperCase()}
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-stone-800" title="Online" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{u.name} {isMe && <span className="text-xs text-amber-500">(You)</span>}</p>
                    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                      u.role === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30')}>
                      {u.role}
                    </span>
                    {!u.isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">DISABLED</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5 truncate">{u.email}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {u.lastLogin ? `Last login ${formatTime(u.lastLogin)}` : 'Never logged in'}
                    </span>
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {u.loginCount || 0} total logins
                    </span>
                    <span className={clsx('text-[11px] flex items-center gap-1 font-semibold',
                      isOnline ? 'text-emerald-600' : 'text-stone-400')}>
                      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {isOnline ? `${userSessions.filter(s => s.isOnline).length} device(s) online` : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {userSessions.length > 0 && (
                    <button onClick={() => killSessions(u._id, u.name)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-500 transition-colors"
                      title="Force logout all devices">
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(u)}
                    className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-stone-400 hover:text-amber-600 transition-colors"
                    title="Edit user">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!isMe && (
                    <button onClick={() => toggleActive(u)}
                      className={clsx('p-2 rounded-lg transition-colors',
                        u.isActive
                          ? 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-stone-400 hover:text-orange-500'
                          : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-stone-400 hover:text-emerald-600')}
                      title={u.isActive ? 'Disable account' : 'Enable account'}>
                      {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  )}
                  {!isMe && u.role !== 'admin' && (
                    <button onClick={() => deleteUser(u)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-600 transition-colors"
                      title="Delete user permanently">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="card p-12 text-center">
              <Smartphone className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="font-bold text-stone-500">No active sessions</p>
              <p className="text-stone-400 text-sm mt-1">Sessions appear when users log in.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-sm text-stone-500"><strong className="text-stone-700 dark:text-stone-300">{onlineCount}</strong> device(s) online in the last 30 minutes</p>
              </div>
              {sessions.map((s, i) => (
                <div key={i} className={clsx('card p-4 flex items-center gap-4', !s.isOnline && 'opacity-60')}>
                  <div className="text-2xl flex-shrink-0">{getDeviceType(s.userAgent)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{s.userName}</p>
                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase',
                        s.userRole === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                        {s.userRole}
                      </span>
                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1',
                        s.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500')}>
                        {s.isOnline ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>Online</> : 'Offline'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      <span className="text-[11px] text-stone-400">{getBrowserName(s.userAgent)} · {s.ip}</span>
                      <span className="text-[11px] text-stone-400 flex items-center gap-1">
                        <Clock className="w-3 h-3"/>Last seen: {formatTime(s.lastSeen)}
                      </span>
                      <span className="text-[11px] text-stone-400">Connected: {formatTime(s.connectedAt)}</span>
                    </div>
                    <p className="text-[10px] text-stone-300 mt-0.5 truncate font-mono">{s.userAgent?.slice(0, 80)}…</p>
                  </div>
                  <button onClick={() => killSessions(s.userId, s.userName)}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Force logout this device">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-stone-800 dark:text-stone-100 text-lg">
                  {editUser ? '✏️ Edit User' : '➕ Add New User'}
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  {editUser ? 'Update account details' : 'Create a staff login account'}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="input-field" placeholder="e.g. Ravi Kumar" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Email Address *</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="input-field" type="email" placeholder="staff@sindhubakery.com"
                    disabled={!!editUser} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                    {editUser ? 'New Password (leave blank to keep)' : 'Password *'}
                  </label>
                  <div className="relative">
                    <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="input-field pr-10" type={showPassword ? 'text' : 'password'}
                      placeholder={editUser ? 'Leave blank to keep current' : 'Min 6 characters'} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="input-field">
                    <option value="staff">Staff (Limited access)</option>
                    <option value="cashier">Cashier (Billing only)</option>
                  </select>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Staff can access: Billing, Flash Billing, Orders, Inventory, Leave
                  </p>
                </div>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
                <p className="font-bold mb-1">📋 Staff user will be able to:</p>
                <p>✅ Create bills (POS &amp; Flash Billing) · View orders · Manage stock · Apply for leave</p>
                <p className="mt-0.5">❌ Cannot view revenue stats, expenses, salary, reports or admin settings</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 font-bold text-sm">
                  Cancel
                </button>
                <button onClick={saveUser} disabled={saving}
                  className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="w-4 h-4" /> {editUser ? 'Update User' : 'Create User'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
