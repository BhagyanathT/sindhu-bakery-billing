'use client';
import { useState, useEffect } from 'react';
import { Save, Building2, CreditCard, Shield, Palette, Database, Trash2, AlertTriangle, LogOut, Loader2, Users, ShoppingBag, Calendar, ClipboardList, Wallet, X, DollarSign, UserPlus, Eye, EyeOff, Volume2, Wifi, WifiOff, Mic, Key, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from 'next-themes';
import api from '@/lib/api';
import { clsx } from 'clsx';
import { useVoiceSettings, getVoiceOpts, type TTSProvider } from '@/hooks/useVoiceSettings';
import { testPhrase, getAvailableVoices, stopSpeech, announceTotalAmount, announcePaymentReceived, announceChange, announceThankYou, announceBillGenerated, onApiKeyChange } from '@/lib/malayalamVoice';

const TABS = [
  { id: 'company',    label: 'Company',    icon: Building2 },
  { id: 'billing',   label: 'Billing',    icon: CreditCard },
  { id: 'appearance',label: 'Appearance', icon: Palette },
  { id: 'security',  label: 'Security',   icon: Shield },
  { id: 'users',     label: 'Users',      icon: Users },
  { id: 'voice',     label: 'Voice',      icon: Volume2 },
  { id: 'data',      label: 'Data',       icon: Database },
];

const WIPE_ITEMS = [
  { key: 'customers',  label: 'All Customers',         icon: Users,         color: 'red',    desc: 'Deletes all customer profiles and resets invoice customer links.' },
  { key: 'orders',     label: 'All Orders / Invoices', icon: ShoppingBag,   color: 'red',    desc: 'Deletes all billing history. Product stock counts will be reset.' },
  { key: 'expenses',   label: 'All Expenses',          icon: DollarSign,    color: 'orange', desc: 'Deletes all recorded expenses.' },
  { key: 'attendance', label: 'All Attendance',        icon: Calendar,      color: 'orange', desc: 'Clears all attendance check-in/out and admin-marked records.' },
  { key: 'leaves',     label: 'All Leave Records',     icon: ClipboardList, color: 'orange', desc: 'Removes all leave applications and approvals.' },
  { key: 'salaries',   label: 'All Salary Records',    icon: Wallet,        color: 'orange', desc: 'Deletes all generated salary and payroll data.' },
  { key: 'all',        label: 'âš ï¸ WIPE ALL DATA',       icon: AlertTriangle, color: 'red',    desc: 'Nuclear option â€” deletes ALL records. Products & Staff are kept.' },
];

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();

  // â”€â”€ Voice settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const voice = useVoiceSettings();
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [googleKeyDraft, setGoogleKeyDraft] = useState(voice.googleApiKey || '');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setAvailableVoices(getAvailableVoices());
    window.speechSynthesis.onvoiceschanged = load;
    load();
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const saveGoogleKey = () => {
    voice.setGoogleApiKey(googleKeyDraft.trim());
    onApiKeyChange();
    toast.success(googleKeyDraft.trim() ? '✅ Google API key saved!' : '🗑️ API key cleared');
  };

  const testGoogleVoice = async () => {
    const keyToTest = googleKeyDraft.trim() || voice.googleApiKey;
    if (!keyToTest) { toast.error('Enter your Google API key first'); return; }
    setTestingGoogle(true);
    const toastId = toast.loading('Testing Google WaveNet voice...');
    try {
      const prev = voice.ttsProvider;
      voice.setTtsProvider('google');
      
      // We call the API directly here for a diagnostic test
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${keyToTest}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: 'അമ്പത്തൊന്ന്' },
          voice: { languageCode: 'ml-IN', name: 'ml-IN-Wavenet-A' },
          audioConfig: { audioEncoding: 'MP3' }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || 'Unknown error';
        const status = res.status;
        console.error('[VoiceTest] Google API Error:', status, err);
        
        if (status === 403) {
          toast.error(`❌ Google API Key issue: ${msg}. Check if Cloud TTS API is enabled and Billing is active.`, { id: toastId, duration: 6000 });
        } else {
          toast.error(`❌ Google API Error (${status}): ${msg}`, { id: toastId, duration: 6000 });
        }
        return;
      }

      toast.success('✅ Connection successful! Playing voice...', { id: toastId });
      await new Promise(r => setTimeout(r, 100));
      testPhrase('ആകെ തുക അഞ്ഞൂറ്റമ്പത് രൂപ. നന്ദി, വീണ്ടും വരിക', getVoiceOpts(voice));
      if (prev !== 'google') setTimeout(() => voice.setTtsProvider(prev), 4000);
    } catch (e: any) {
      toast.error(`❌ Network Error: ${e.message}`, { id: toastId });
    } finally { setTestingGoogle(false); }
  };

  const [activeTab, setActiveTab] = useState('company');
  const [wiping, setWiping]       = useState<string|null>(null);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ key: string; label: string } | null>(null);

  const [company, setCompany] = useState({
    name: user?.company?.name || 'Sindhu Bakery',
    gstin: user?.company?.gstin || '',
    email: user?.company?.email || '',
    phone: '',
    address: { line1: '', city: 'Thiruvananthapuram', state: 'Kerala', pincode: '' },
  });
  const [billing, setBilling] = useState({
    invoicePrefix: 'INV', defaultTaxRate: 18,
    showGSTBreakdown: true, roundOff: true,
    termsAndConditions: 'Payment due within 30 days.',
  });
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [changingPass, setChangingPass] = useState(false);

  // â”€â”€ Create User state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', role: 'staff', password: '', confirm: '' });
  const [showNewPw, setShowNewPw] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdUsers, setCreatedUsers] = useState<any[]>([]);

  const handleCreateUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) {
      toast.error('Name, email and password are required'); return;
    }
    if (newUser.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newUser.password !== newUser.confirm) { toast.error('Passwords do not match'); return; }
    setCreatingUser(true);
    try {
      const res = await api.post('/admin/users', {
        name: newUser.name.trim(),
        email: newUser.email.trim().toLowerCase(),
        phone: newUser.phone.trim(),
        role: newUser.role,
        password: newUser.password,
      });
      toast.success(`âœ… User "${res.data.data.user.name}" created!`);
      setCreatedUsers(prev => [res.data.data.user, ...prev]);
      setNewUser({ name: '', email: '', phone: '', role: 'staff', password: '', confirm: '' });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create user');
    } finally { setCreatingUser(false); }
  };

  const handleSave = () => toast.success('Settings saved!');

  // Called from the Delete button â€” opens confirm modal, NO window.confirm
  const requestWipe = (key: string) => {
    const item = WIPE_ITEMS.find(i => i.key === key);
    if (!item) return;
    setConfirmModal({ key, label: item.label });
  };

  // Called from modal confirm button â€” actually does the delete
  const executeWipe = async () => {
    if (!confirmModal) return;
    const { key } = confirmModal;
    setConfirmModal(null);
    setWiping(key);
    try {
      const res = await api.delete(`/admin/wipe/${key}`);
      toast.success(res.data?.message || 'âœ… Deleted successfully');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Delete failed';
      const status = e.response?.status;
      toast.error(status === 403 ? 'âŒ Admin access required' : `âŒ ${msg}`);
      console.error('[wipe]', status, e.response?.data);
    } finally {
      setWiping(null);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.newPass) { toast.error('Fill all fields'); return; }
    if (passwords.newPass !== passwords.confirm) { toast.error('Passwords do not match'); return; }
    if (passwords.newPass.length < 6) { toast.error('Min 6 characters'); return; }
    setChangingPass(true);
    try {
      await api.patch('/auth/update-password', { currentPassword: passwords.current, newPassword: passwords.newPass });
      toast.success('âœ… Password changed!');
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setChangingPass(false); }
  };

  return (
    <>
      {/* â”€â”€ Confirm Modal (replaces window.confirm) â”€â”€ */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="font-black text-stone-800 dark:text-stone-100">Confirm Delete</p>
                <p className="text-xs text-stone-500">This action is irreversible</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-3">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                Are you sure you want to delete <strong>{confirmModal.label}</strong>?
              </p>
              <p className="text-xs text-red-500 mt-1">All data will be permanently erased and cannot be recovered.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold text-sm hover:bg-stone-200 transition-colors">
                Cancel
              </button>
              <button onClick={executeWipe}
                className="flex-[2] py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                <Trash2 className="w-4 h-4" /> Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 max-w-4xl">
        <div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">Settings</h1>
          <p className="text-stone-400 text-sm">Manage business preferences & data</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-48 flex-shrink-0">
            <div className="card p-2 flex flex-row md:flex-col overflow-x-auto gap-1 md:space-y-0.5">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={clsx('flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap w-full',
                      activeTab === tab.id ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700')}>
                    <Icon className="w-4 h-4 flex-shrink-0" />{tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">

            {/* â”€â”€â”€ Company â”€â”€â”€ */}
            {activeTab === 'company' && (
              <div className="card p-6 space-y-4">
                <h2 className="font-bold text-stone-800 dark:text-stone-100">Company Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Business Name</label>
                    <input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">GSTIN</label>
                    <input value={company.gstin} onChange={e => setCompany(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} className="input-field font-mono" placeholder="29ABCDE1234F1Z5" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Phone</label>
                    <input value={company.phone} onChange={e => setCompany(p => ({ ...p, phone: e.target.value }))} className="input-field" placeholder="9544208030" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Email</label>
                    <input type="email" value={company.email} onChange={e => setCompany(p => ({ ...p, email: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">City</label>
                    <input value={company.address.city} onChange={e => setCompany(p => ({ ...p, address: { ...p.address, city: e.target.value } }))} className="input-field" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Address</label>
                    <input value={company.address.line1} onChange={e => setCompany(p => ({ ...p, address: { ...p.address, line1: e.target.value } }))} className="input-field" placeholder="Street address" />
                  </div>
                </div>
                <button onClick={handleSave} className="btn-primary"><Save className="w-4 h-4" />Save</button>
              </div>
            )}

            {/* â”€â”€â”€ Billing â”€â”€â”€ */}
            {activeTab === 'billing' && (
              <div className="card p-6 space-y-4">
                <h2 className="font-bold text-stone-800 dark:text-stone-100">Billing Settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Invoice Prefix</label>
                    <input value={billing.invoicePrefix} onChange={e => setBilling(p => ({ ...p, invoicePrefix: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Default GST Rate</label>
                    <select value={billing.defaultTaxRate} onChange={e => setBilling(p => ({ ...p, defaultTaxRate: parseInt(e.target.value) }))} className="input-field">
                      {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Terms & Conditions</label>
                    <textarea value={billing.termsAndConditions} onChange={e => setBilling(p => ({ ...p, termsAndConditions: e.target.value }))} className="input-field resize-none" rows={3} />
                  </div>
                  {[{ key: 'showGSTBreakdown', label: 'Show GST breakdown on invoice' }, { key: 'roundOff', label: 'Auto round-off grand total' }].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-700/50 rounded-xl sm:col-span-2">
                      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{label}</span>
                      <button onClick={() => setBilling(p => ({ ...p, [key]: !(p as any)[key] }))}
                        className={clsx('w-11 h-6 rounded-full relative transition-all', (billing as any)[key] ? 'bg-amber-600' : 'bg-stone-300 dark:bg-stone-600')}>
                        <div className={clsx('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all', (billing as any)[key] ? 'left-6' : 'left-1')} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={handleSave} className="btn-primary"><Save className="w-4 h-4" />Save</button>
              </div>
            )}

            {/* â”€â”€â”€ Appearance â”€â”€â”€ */}
            {activeTab === 'appearance' && (
              <div className="card p-6 space-y-4">
                <h2 className="font-bold text-stone-800 dark:text-stone-100">Appearance</h2>
                <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Theme</p>
                <div className="flex gap-3">
                  {['light', 'dark', 'system'].map(t => (
                    <button key={t} onClick={() => setTheme(t)}
                      className={clsx('flex-1 py-4 rounded-2xl border-2 text-sm font-bold capitalize transition-all',
                        theme === t ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700' : 'border-stone-200 dark:border-stone-600 text-stone-500')}>
                      {t === 'light' ? 'â˜€ï¸' : t === 'dark' ? 'ðŸŒ™' : 'ðŸ’»'} {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* â”€â”€â”€ Security â”€â”€â”€ */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="card p-6 space-y-4">
                  <h2 className="font-bold text-stone-800 dark:text-stone-100">Current Session</h2>
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg">
                      {user?.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-stone-800 dark:text-stone-100">{user?.name}</p>
                      <p className="text-xs text-stone-500">{user?.email} Â· <span className="capitalize text-emerald-600 font-semibold">{user?.role}</span></p>
                      <p className="text-xs text-stone-400 mt-0.5">Session active Â· {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200 rounded-xl text-sm font-bold">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
                <div className="card p-6 space-y-4">
                  <h2 className="font-bold text-stone-800 dark:text-stone-100">Change Password</h2>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Current Password</label>
                    <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} className="input-field" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">New Password</label>
                    <input type="password" value={passwords.newPass} onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))} className="input-field" placeholder="Min 6 characters" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Confirm New Password</label>
                    <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} className="input-field" placeholder="Repeat password" />
                  </div>
                  <button onClick={handleChangePassword} disabled={changingPass} className="btn-primary disabled:opacity-60">
                    {changingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} Change Password
                  </button>
                </div>
              </div>
            )}

            {/* â”€â”€â”€ Users (Admin Only) â”€â”€â”€ */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Info banner */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
                  <UserPlus className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-700 dark:text-amber-400">Create New User</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Only admins can create new accounts. Public registration is disabled.</p>
                  </div>
                </div>

                {/* Create form */}
                <div className="card p-6 space-y-4">
                  <h2 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-600" /> Add New Staff / User
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Full Name *</label>
                      <input
                        value={newUser.name}
                        onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))}
                        placeholder="Enter full name"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Email Address *</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                        placeholder="user@email.com"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Phone Number</label>
                      <input
                        value={newUser.phone}
                        onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+91 9876543210"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Role</label>
                      <select
                        value={newUser.role}
                        onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                        className="input-field"
                      >
                        <option value="staff">Staff</option>
                        <option value="cashier">Cashier</option>
                        <option value="accountant">Accountant</option>
                      </select>
                    </div>
                    <div className="relative">
                      <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Password *</label>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newUser.password}
                        onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                        placeholder="Min 6 characters"
                        className="input-field pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(v => !v)}
                        className="absolute right-3 top-[30px] text-stone-400 hover:text-stone-600"
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-stone-500 mb-1 block uppercase">Confirm Password *</label>
                      <input
                        type="password"
                        value={newUser.confirm}
                        onChange={e => setNewUser(p => ({ ...p, confirm: e.target.value }))}
                        placeholder="Repeat password"
                        className="input-field"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleCreateUser}
                    disabled={creatingUser}
                    className="btn-primary disabled:opacity-60"
                  >
                    {creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    {creatingUser ? 'Creating...' : 'Create User'}
                  </button>
                </div>

                {/* Newly created users in this session */}
                {createdUsers.length > 0 && (
                  <div className="card p-6 space-y-3">
                    <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm">Recently Created</h3>
                    {createdUsers.map(u => (
                      <div key={u._id} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-base">
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{u.name}</p>
                          <p className="text-xs text-stone-500">{u.email} Â· <span className="capitalize text-emerald-600 font-semibold">{u.role}</span></p>
                        </div>
                        <button onClick={() => setCreatedUsers(prev => prev.filter(x => x._id !== u._id))} className="text-stone-400 hover:text-stone-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* â”€â”€â”€ Voice â”€â”€â”€ */}
            {activeTab === 'voice' && (
              <div className="space-y-4">

                {/* Header banner */}
                <div className="rounded-2xl p-4 flex items-start gap-3 border"
                  style={{ background: 'linear-gradient(135deg,#4c1d95 0%,#6d28d9 60%,#7c3aed 100%)', borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Mic className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Malayalam Neural Voice Announcements</p>
                    <p className="text-xs text-violet-200 mt-0.5">
                      Speaks bill details aloud â€” like a real Kerala supermarket POS machine.
                      Use <strong className="text-white">Google WaveNet</strong> for ultra-realistic human voice,
                      or <strong className="text-white">Browser TTS</strong> as free fallback.
                    </p>
                  </div>
                </div>

                {/* Master toggle + provider picker */}
                <div className="card p-6 space-y-5">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-stone-800 dark:text-stone-100">Voice Announcements</p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {voice.voiceEnabled ? 'ðŸ”Š à´¸à´•àµà´°à´¿à´¯à´®à´¾à´£àµâ€ â€” Active' : 'ðŸ”‡ à´¨à´¿à´·àµà´•àµà´°à´¿à´¯à´®à´¾à´£àµâ€ â€” Muted'}
                      </p>
                    </div>
                    <button
                      id="voice-enable-toggle"
                      onClick={() => { if (voice.voiceEnabled) stopSpeech(); voice.setVoiceEnabled(!voice.voiceEnabled); }}
                      className={clsx('w-12 h-6 rounded-full relative transition-all', voice.voiceEnabled ? 'bg-violet-600' : 'bg-stone-300 dark:bg-stone-600')}
                    >
                      <div className={clsx('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all', voice.voiceEnabled ? 'left-7' : 'left-1')} />
                    </button>
                  </div>

                  {/* TTS Provider */}
                  <div>
                    <label className="text-xs font-bold text-stone-500 uppercase mb-2 block">Voice Engine / Provider</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { id: 'browser' as TTSProvider, label: 'Browser TTS', sub: 'Free Â· Built-in', icon: WifiOff, color: 'stone' },
                        { id: 'google'  as TTSProvider, label: 'Google WaveNet', sub: 'Neural Â· Human-quality', icon: Wifi, color: 'violet' },
                      ]).map(({ id, label, sub, icon: Icon, color }) => (
                        <button key={id} onClick={() => voice.setTtsProvider(id)}
                          className={clsx('flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all',
                            voice.ttsProvider === id
                              ? (color === 'violet' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-stone-400 bg-stone-50 dark:bg-stone-700/40')
                              : 'border-stone-200 dark:border-stone-700 hover:border-stone-300'
                          )}>
                          <Icon className={clsx('w-4 h-4 flex-shrink-0', voice.ttsProvider === id ? (color === 'violet' ? 'text-violet-600' : 'text-stone-600') : 'text-stone-400')} />
                          <div>
                            <p className="text-xs font-bold text-stone-800 dark:text-stone-100">{label}</p>
                            <p className="text-[10px] text-stone-500">{sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Volume */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-stone-500 uppercase">Volume</label>
                      <span className="text-xs font-bold text-violet-600">{Math.round(voice.volume * 100)}%</span>
                    </div>
                    <input id="voice-volume-slider" type="range" min="0" max="1" step="0.05"
                      value={voice.volume} onChange={e => voice.setVolume(parseFloat(e.target.value))}
                      className="w-full accent-violet-600 h-2 rounded-full cursor-pointer" />
                  </div>

                  {/* Rate */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-stone-500 uppercase">Speech Speed</label>
                      <span className="text-xs font-bold text-violet-600">
                        {voice.rate < 0.75 ? 'Slow' : voice.rate < 1.0 ? 'Natural' : voice.rate < 1.2 ? 'Fast' : 'Very Fast'} ({voice.rate.toFixed(2)}Ã—)
                      </span>
                    </div>
                    <input id="voice-rate-slider" type="range" min="0.5" max="1.5" step="0.05"
                      value={voice.rate} onChange={e => voice.setRate(parseFloat(e.target.value))}
                      className="w-full accent-violet-600 h-2 rounded-full cursor-pointer" />
                  </div>

                  {/* Advanced (pitch + browser voice selector) */}
                  <button onClick={() => setAdvancedOpen(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-stone-500 hover:text-violet-600 transition-colors">
                    {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Advanced Options
                  </button>

                  {advancedOpen && (
                    <div className="space-y-4 pt-2 border-t border-stone-100 dark:border-stone-700">
                      {/* Pitch */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-stone-500 uppercase">Pitch</label>
                          <span className="text-xs font-bold text-violet-600">
                            {voice.pitch < 0.9 ? 'Deep' : voice.pitch < 1.05 ? 'Natural' : 'High'} ({voice.pitch.toFixed(2)})
                          </span>
                        </div>
                        <input type="range" min="0.5" max="1.5" step="0.05"
                          value={voice.pitch} onChange={e => voice.setPitch(parseFloat(e.target.value))}
                          className="w-full accent-violet-600 h-2 rounded-full cursor-pointer" />
                      </div>

                      {/* Browser voice selector */}
                      {voice.ttsProvider === 'browser' && (
                        <div>
                          <label className="text-xs font-bold text-stone-500 uppercase mb-2 block">Browser Voice</label>
                          <select id="voice-selector" value={voice.selectedVoiceURI || ''}
                            onChange={e => voice.setSelectedVoiceURI(e.target.value || null)} className="input-field">
                            <option value="">âœ¨ Auto â€” best Malayalam voice</option>
                            {availableVoices.map(v => (
                              <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name} ({v.lang}){v.lang.startsWith('ml') ? ' âœ“ Malayalam' : ''}
                              </option>
                            ))}
                          </select>
                          {availableVoices.filter(v => v.lang.startsWith('ml')).length === 0 && (
                            <p className="text-xs text-amber-600 mt-1.5">
                              âš ï¸ No Malayalam voice on this device. For best results, install a Malayalam TTS pack:
                              Windows Settings â†’ Time &amp; Language â†’ Speech â†’ Add voices â†’ Malayalam.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Item-add toggle */}
                      <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-700/50 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Announce item added to cart</p>
                          <p className="text-xs text-stone-400">&quot;à´šàµ‡àµ¼à´¤àµà´¤àµ&quot; when a product is added</p>
                        </div>
                        <button onClick={() => voice.setAnnounceItemAdd(!voice.announceItemAdd)}
                          className={clsx('w-11 h-6 rounded-full relative transition-all', voice.announceItemAdd ? 'bg-violet-600' : 'bg-stone-300 dark:bg-stone-600')}>
                          <div className={clsx('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all', voice.announceItemAdd ? 'left-6' : 'left-1')} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Google WaveNet API key card */}
                <div className={clsx('card p-6 space-y-4 border-2 transition-colors',
                  voice.ttsProvider === 'google' ? 'border-violet-300 dark:border-violet-700' : 'border-transparent')}>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-violet-600" />
                    <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm">Google Cloud TTS â€” API Key</h3>
                    {voice.googleApiKey && (
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        âœ“ Configured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">
                    Get a free API key at <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-violet-600 underline">console.cloud.google.com</a> â†’ Enable &quot;Cloud Text-to-Speech API&quot;.
                    Uses <strong>ml-IN-Wavenet-A</strong> (female, ultra-realistic Kerala accent). Key is stored only on this device.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={googleKeyDraft}
                        onChange={e => setGoogleKeyDraft(e.target.value)}
                        placeholder="AIzaSy..."
                        className="input-field pr-10 font-mono text-sm"
                      />
                      <button type="button" onClick={() => setShowApiKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button onClick={saveGoogleKey}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors">
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                  <button onClick={testGoogleVoice} disabled={testingGoogle || !voice.googleApiKey}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400 text-sm font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {testingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                    Test Google WaveNet Voice
                  </button>
                </div>

                {/* Test Buttons */}
                <div className="card p-6 space-y-3">
                  <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm">ðŸŽ™ Test Announcements</h3>
                  <p className="text-xs text-stone-400">Hear sample announcements using your current voice settings.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'ðŸ§¾ Bill Generated', action: () => announceBillGenerated(getVoiceOpts(voice)) },
                      { label: 'ðŸ’° Total: â‚¹540', action: () => announceTotalAmount(540, getVoiceOpts(voice)) },
                      { label: 'ðŸ“± UPI Payment', action: () => announcePaymentReceived('upi', 540, getVoiceOpts(voice)) },
                      { label: 'ðŸ’µ Cash Payment', action: () => announcePaymentReceived('cash', 540, getVoiceOpts(voice)) },
                      { label: 'ðŸ”„ Change: â‚¹60', action: () => announceChange(60, getVoiceOpts(voice)) },
                      { label: 'ðŸ™ Thank You', action: () => announceThankYou(getVoiceOpts(voice)) },
                      { label: 'ðŸ›’ Full Bill Demo', action: () => testPhrase('à´¬à´¿àµ½ à´µà´¿à´œà´¯à´•à´°à´®à´¾à´¯à´¿ à´¤à´¯àµà´¯à´¾à´±à´¾à´•àµà´•à´¿. à´†à´•àµ† à´¤àµà´• à´…à´žàµà´žàµ‚à´±àµà´±à´¿ à´¨à´¾àµ½à´ªàµà´ªà´¤àµ à´°àµ‚à´ª. à´«àµ‹àµºâ€Œà´ªàµ‡ à´µà´´à´¿ à´…à´žàµà´žàµ‚à´±àµà´±à´¿ à´¨à´¾àµ½à´ªàµà´ªà´¤àµ à´°àµ‚à´ª à´…à´Ÿà´šàµà´šàµ. à´¨à´¨àµà´¦à´¿, à´µàµ€à´£àµà´Ÿàµà´‚ à´µà´°à´¿à´•', getVoiceOpts(voice)) },
                      { label: 'â¹ Stop', action: () => stopSpeech(), style: 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100' },
                    ].map(({ label, action, style }) => (
                      <button key={label} onClick={action}
                        disabled={!voice.voiceEnabled && label !== 'â¹ Stop'}
                        className={clsx('px-3 py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left',
                          style || 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                        )}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* â”€â”€â”€ Data Management â”€â”€â”€ */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-700 dark:text-red-400">Danger Zone</p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Click the <strong>Delete</strong> button to delete. A confirmation dialog will appear.</p>
                  </div>
                </div>

                {WIPE_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isRed = item.color === 'red';
                  const isWiping = wiping === item.key;
                  return (
                    <div key={item.key} className={clsx('card p-4 border-2', isRed ? 'border-red-100 dark:border-red-900/30' : 'border-orange-100 dark:border-orange-900/30')}>
                      <div className="flex items-center gap-3">
                        <div className={clsx('p-2 rounded-xl flex-shrink-0', isRed ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600')}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{item.label}</p>
                          <p className="text-xs text-stone-500 mt-0.5 truncate">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => requestWipe(item.key)}
                          disabled={isWiping}
                          className={clsx(
                            'flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60',
                            isRed ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
                          )}
                        >
                          {isWiping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          {isWiping ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
