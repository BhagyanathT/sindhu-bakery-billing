'use client';
import { useState, useEffect } from 'react';
import { MessageCircle, Send, History, FileText, Settings, Receipt, Loader2, Trash2, Plus, Check, X, RefreshCw, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { useWhatsAppStore, WaMessage, WaTemplate } from '@/store/whatsappStore';
import { useProductStore } from '@/store/productStore';
import { WaWebConnect } from '@/components/WaWebConnect';
import api from '@/lib/api';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'connect',   label: 'Connect',      icon: Wifi },
  { id: 'send',      label: 'Send Message', icon: Send },
  { id: 'bill',      label: 'Send Bill',    icon: Receipt },
  { id: 'history',   label: 'History',      icon: History },
  { id: 'templates', label: 'Templates',    icon: FileText },
  { id: 'settings',  label: 'Settings',     icon: Settings },
];

const STATUS_COLOR: Record<string, string> = {
  sent:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30',
  delivered: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/30',
  pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
};

const TYPE_EMOJI: Record<string, string> = {
  invoice: '🧾', promo: '🎁', alert: '⚠️', custom: '💬', order_status: '📦',
};

export default function WhatsAppPage() {
  const [tab, setTab] = useState('connect');
  const { messages, totalMessages, stats, config, templates, loading, sendingBill, waWeb,
    fetchHistory, fetchStats, fetchConfig, saveConfig, fetchTemplates,
    saveTemplate, deleteTemplate, sendCustom, sendPromo, sendLowStockAlert, sendBill } = useWhatsAppStore();
  const { products } = useProductStore();

  // Send Bill tab state
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [billCustomerId, setBillCustomerId] = useState('');
  const [billInvoiceId, setBillInvoiceId] = useState('');
  const [billSendPdf, setBillSendPdf] = useState(false);
  const [billPhone, setBillPhone] = useState('');
  const [billResult, setBillResult] = useState<any>(null);

  // Send tab state
  const [sendType, setSendType] = useState<'custom' | 'promo' | 'alert'>('custom');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Template tab state
  const [newTpl, setNewTpl] = useState({ name: '', type: 'custom', body: '' });
  const [savingTpl, setSavingTpl] = useState(false);

  // Settings state
  const [cfg, setCfg] = useState<any>({});
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchConfig();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab]);

  // Load recent invoices for Send Bill tab
  useEffect(() => {
    if (tab === 'bill') {
      import('@/lib/api').then(m => m.default.get('/invoices?limit=50'))
        .then(r => setInvoices(r.data.data?.invoices || []))
        .catch(() => {});
    }
  }, [tab]);

  useEffect(() => {
    if (config) setCfg({ ...config });
  }, [config]);

  // ── Send handlers ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    setSending(true);
    setLastResult(null);
    let result: any = null;

    if (sendType === 'custom') {
      if (!phone && !message) { toast.error('Phone and message required'); setSending(false); return; }
      result = await sendCustom({ phone, body: message });
    } else if (sendType === 'promo') {
      result = await sendPromo({ productId: selectedProduct || undefined, customMessage: message || undefined });
    } else if (sendType === 'alert') {
      result = await sendLowStockAlert(phone || undefined);
    }

    if (result) {
      setLastResult(result);
      setMessage('');
      fetchStats();
    }
    setSending(false);
  };

  const handleSaveConfig = async () => {
    setSavingCfg(true);
    await saveConfig(cfg);
    setSavingCfg(false);
  };

  const handleSaveTemplate = async () => {
    if (!newTpl.name || !newTpl.body) { toast.error('Name and body required'); return; }
    setSavingTpl(true);
    const ok = await saveTemplate(newTpl);
    if (ok) setNewTpl({ name: '', type: 'custom', body: '' });
    setSavingTpl(false);
  };

  const handleSendBill = async () => {
    if (!billInvoiceId) { toast.error('Please select an invoice'); return; }
    setBillResult(null);
    const result = await sendBill(billInvoiceId, { sendPdf: billSendPdf, phone: billPhone || undefined });
    if (result) {
      setBillResult(result);
      setTimeout(() => window.open(result.deepLinkUrl, '_blank'), 300);
      fetchStats();
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-[#25D366]" /> WhatsApp Hub
          </h1>
          <p className="text-stone-400 text-sm">Customer communication & automation</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full',
            waWeb.status === 'connected'  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
            config?.enabled               ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-stone-100 text-stone-500')}>
            <span className={clsx('w-2 h-2 rounded-full animate-pulse',
              waWeb.status === 'connected' ? 'bg-emerald-500' : config?.enabled ? 'bg-blue-500' : 'bg-stone-400')} />
            {waWeb.status === 'connected' ? `WA Web · ${waWeb.phone || 'Connected'}` : config?.enabled ? 'Twilio Active' : 'Deep-link Mode'}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Sent', value: stats.total, emoji: '📤', color: 'border-l-amber-500' },
            { label: 'Delivered', value: stats.byStatus?.delivered || 0, emoji: '✅', color: 'border-l-emerald-500' },
            { label: 'Failed', value: stats.byStatus?.failed || 0, emoji: '❌', color: 'border-l-red-500' },
            { label: 'Invoices Sent', value: stats.byType?.invoice || 0, emoji: '🧾', color: 'border-l-blue-500' },
          ].map(s => (
            <div key={s.label} className={`card p-4 border-l-4 ${s.color}`}>
              <p className="text-xl font-black text-stone-800 dark:text-stone-100">{s.emoji} {s.value}</p>
              <p className="text-xs text-stone-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-2xl max-w-full overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap',
              tab === t.id ? 'bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300')}>
            <t.icon className="w-4 h-4 shrink-0" />{t.label}
          </button>
        ))}
      </div>

      {/* ── CONNECT TAB ─────────────────────────────────────────────────── */}
      {tab === 'connect' && <WaWebConnect />}

      {/* ── SEND BILL TAB ─────────────────────────────────────────────────── */}
      {tab === 'bill' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6 space-y-5">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">📋 Send Bill via WhatsApp</h3>

            {/* Invoice */}
            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Select Recent Invoice</label>
              <select value={billInvoiceId} onChange={e => {
                setBillInvoiceId(e.target.value);
                const inv = invoices.find(i => i._id === e.target.value);
                if (inv && inv.customerPhone) setBillPhone(inv.customerPhone);
              }} className="input-field">
                <option value="">— Select invoice —</option>
                {invoices.map((inv: any) => (
                  <option key={inv._id} value={inv._id}>
                    {inv.invoiceNumber} · {inv.customerName || 'Walk-in'} · ₹{inv.grandTotal?.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone override */}
            <div>
              <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Phone (leave empty to use customer phone)</label>
              <input value={billPhone} onChange={e => setBillPhone(e.target.value)} placeholder="+91 9876543210" className="input-field" />
            </div>

            {/* PDF Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700">
              <div>
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Send as PDF</p>
                <p className="text-xs text-stone-400">Generates a branded invoice PDF with download link</p>
              </div>
              <button onClick={() => setBillSendPdf(p => !p)}
                className={clsx('w-11 h-6 rounded-full transition-colors relative flex-shrink-0', billSendPdf ? 'bg-blue-500' : 'bg-stone-300')}>
                <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', billSendPdf ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>

            {billSendPdf && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-600 dark:text-blue-400">
                📄 A PDF invoice will be generated and a short download link added to the WhatsApp message.
              </div>
            )}

            <button onClick={handleSendBill} disabled={sendingBill || !billInvoiceId}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-green-500/20">
              {sendingBill ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>💬</span>}
              {sendingBill ? 'Preparing…' : 'Send WhatsApp'}
            </button>

            {billResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-emerald-700">✅ WhatsApp opened!</p>
                {billResult.pdfShortUrl && (
                  <a href={billResult.pdfShortUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline">
                    📄 PDF Link: {billResult.pdfShortUrl}
                  </a>
                )}
                <a href={billResult.deepLinkUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#25D366] font-semibold hover:underline">
                  <ExternalLink className="w-3 h-3" /> Re-open WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="space-y-4">
            <div className="card p-5 border-l-4 border-l-[#25D366]">
              <p className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">💡 How Send Bill works</p>
              <ol className="text-xs text-stone-500 space-y-1.5 list-decimal list-inside">
                <li>Select customer and their invoice</li>
                <li>Toggle PDF on/off as needed</li>
                <li>Click Send WhatsApp — message is auto-composed</li>
                <li>WhatsApp opens with the pre-filled message</li>
                <li>Staff clicks Send in WhatsApp</li>
              </ol>
            </div>
            <div className="card p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-600 mb-1">📄 PDF Mode</p>
              <p className="text-xs text-stone-500">PDF invoices are stored on the server and accessible via a short link (e.g. /b/AbC12345). Links expire after 30 days. Customer can open and download the PDF directly from WhatsApp.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND TAB ────────────────────────────────────────────────────────── */}
      {tab === 'send' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6 space-y-5">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">Compose Message</h3>

            {/* Message type */}
            <div className="flex gap-2">
              {(['custom', 'promo', 'alert'] as const).map(t => (
                <button key={t} onClick={() => setSendType(t)}
                  className={clsx('flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all',
                    sendType === t ? 'bg-[#25D366] text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-500 hover:bg-stone-200')}>
                  {t === 'custom' ? '💬 Custom' : t === 'promo' ? '🎁 Promo' : '⚠️ Alert'}
                </button>
              ))}
            </div>

            {/* Phone (custom + alert) */}
            {(sendType === 'custom' || sendType === 'alert') && (
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">
                  {sendType === 'alert' ? 'Admin Phone (leave empty to use saved)' : 'Customer Phone *'}
                </label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="input-field" />
              </div>
            )}

            {/* Product (promo) */}
            {sendType === 'promo' && (
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Product (optional)</label>
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="input-field">
                  <option value="">— All customers, custom message —</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.emoji} {p.name} — ₹{p.sellingPrice}</option>)}
                </select>
              </div>
            )}

            {/* Message body */}
            {(sendType === 'custom' || sendType === 'promo') && (
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  rows={5} placeholder={sendType === 'promo' ? 'Leave empty to auto-generate from product...' : 'Type your message...'}
                  className="input-field resize-none" />
                {/* Quick templates */}
                {templates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {templates.slice(0, 4).map(t => (
                      <button key={t._id} onClick={() => setMessage(t.body)}
                        className="text-[10px] font-semibold px-2 py-1 bg-stone-100 dark:bg-stone-700 text-stone-500 rounded-lg hover:bg-amber-50 hover:text-amber-700 transition-colors">
                        📄 {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sendType === 'alert' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                ⚠️ This will send a low-stock alert for all products below their minimum level.
              </div>
            )}

            <button onClick={handleSend} disabled={sending}
              className="w-full btn-primary bg-[#25D366] hover:bg-[#1ebe5d] shadow-green-500/20">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending…' : 'Send Message'}
            </button>

            {/* Result */}
            {lastResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">✅ Sent via {lastResult.provider}</p>
                {lastResult.deepLinkUrl && (
                  <a href={lastResult.deepLinkUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#25D366] font-semibold hover:underline">
                    <ExternalLink className="w-3 h-3" /> Open in WhatsApp
                  </a>
                )}
                {lastResult.deeplinks?.length > 0 && (
                  <div className="space-y-1">
                    {lastResult.deeplinks.slice(0, 5).map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[#25D366] hover:underline">
                        <ExternalLink className="w-3 h-3" /> Customer {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info / Quick Actions */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-bold text-stone-800 dark:text-stone-100 mb-3 text-sm">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: 'Low Stock Alert', desc: 'Notify admin of low stock items', emoji: '⚠️', action: () => { setSendType('alert'); setTab('send'); } },
                  { label: 'Promo Broadcast', desc: 'Send offer to all customers', emoji: '🎁', action: () => setSendType('promo') },
                  { label: 'View History', desc: 'See all sent messages', emoji: '📋', action: () => setTab('history') },
                  { label: 'Add Template', desc: 'Save reusable messages', emoji: '📄', action: () => setTab('templates') },
                ].map(a => (
                  <button key={a.label} onClick={a.action}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors text-left">
                    <span className="text-xl">{a.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">{a.label}</p>
                      <p className="text-xs text-stone-400">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="card p-4 bg-[#25D366]/5 border-[#25D366]/20">
              <p className="text-xs font-semibold text-[#25D366] mb-1">💡 Deep-link Mode (Free)</p>
              <p className="text-xs text-stone-500">Works without any API key. Clicking Send opens WhatsApp with a pre-filled message. Enable Twilio in Settings for programmatic sending & logs.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ─────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-700">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">Message History ({totalMessages})</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!confirm('Are you sure you want to clear all message history? This cannot be undone.')) return;
                  try {
                    const res = await api.delete('/whatsapp/messages');
                    if (res.data.success) {
                      toast.success('History cleared');
                      fetchHistory();
                      fetchStats();
                    }
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || 'Failed to clear history');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-red-100 dark:border-red-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
              <button onClick={() => fetchHistory()} className="btn-icon">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="text-stone-500 font-semibold">No messages yet</p>
              <p className="text-stone-400 text-sm mt-1">Send your first message from the Send tab</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 dark:divide-stone-700/50">
              {messages.map(msg => (
                <div key={msg._id} className="flex items-start gap-4 px-5 py-4 hover:bg-stone-50 dark:hover:bg-stone-800/50">
                  <span className="text-xl mt-0.5">{TYPE_EMOJI[msg.messageType] || '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                        {msg.customer?.name || msg.phone}
                      </p>
                      <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', STATUS_COLOR[msg.status])}>
                        {msg.status}
                      </span>
                      <span className="text-[10px] font-semibold text-stone-400 capitalize bg-stone-100 dark:bg-stone-700 px-2 py-0.5 rounded-full">
                        {msg.messageType}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 truncate">{msg.body.slice(0, 80)}…</p>
                    {msg.errorMessage && <p className="text-xs text-red-500 mt-1">Error: {msg.errorMessage}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-stone-400">{new Date(msg.createdAt).toLocaleDateString('en-IN')}</p>
                    <p className="text-[10px] text-stone-400">{new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    <span className="text-[10px] text-stone-400 capitalize">{msg.provider}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEMPLATES TAB ───────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* New template form */}
          <div className="card p-6 space-y-4">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">New Template</h3>
            <input value={newTpl.name} onChange={e => setNewTpl(p => ({ ...p, name: e.target.value }))}
              placeholder="Template name" className="input-field" />
            <select value={newTpl.type} onChange={e => setNewTpl(p => ({ ...p, type: e.target.value }))} className="input-field">
              {['custom', 'invoice', 'promo', 'alert', 'order_status'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <textarea value={newTpl.body} onChange={e => setNewTpl(p => ({ ...p, body: e.target.value }))}
              rows={6} placeholder="Use {{customerName}}, {{total}}, {{invoiceNo}} as variables..."
              className="input-field resize-none" />
            <button onClick={handleSaveTemplate} disabled={savingTpl} className="btn-primary w-full">
              {savingTpl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Template
            </button>
          </div>

          {/* Template list */}
          <div className="space-y-3">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">Saved Templates ({templates.length})</h3>
            {templates.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-2xl mb-2">📄</p>
                <p className="text-stone-500 text-sm">No templates yet. Create one to speed up messaging!</p>
              </div>
            ) : templates.map(tpl => (
              <div key={tpl._id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{tpl.name}</p>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full capitalize">{tpl.type}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setMessage(tpl.body)} title="Use this template"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteTemplate(tpl._id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-stone-500 line-clamp-2">{tpl.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ────────────────────────────────────────────────────── */}
      {tab === 'settings' && (
        <div className="max-w-lg space-y-6">
          <div className="card p-6 space-y-5">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">WhatsApp Configuration</h3>

            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-900 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Enable Twilio API</p>
                <p className="text-xs text-stone-400">Enables programmatic sending & message logs</p>
              </div>
              <button onClick={() => setCfg((c: any) => ({ ...c, enabled: !c.enabled }))}
                className={clsx('w-11 h-6 rounded-full transition-colors relative', cfg.enabled ? 'bg-[#25D366]' : 'bg-stone-300')}>
                <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', cfg.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>

            {[
              { key: 'twilioAccountSid', label: 'Twilio Account SID', placeholder: 'ACxxxxxxxxxxxxxxx', type: 'text' },
              { key: 'twilioAuthToken',  label: 'Twilio Auth Token',  placeholder: '••••••••', type: 'password' },
              { key: 'twilioFromNumber', label: 'Twilio WhatsApp Number', placeholder: '+14155238886', type: 'text' },
              { key: 'adminPhone',       label: 'Admin Phone (for alerts)', placeholder: '+91 9876543210', type: 'text' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">{field.label}</label>
                <input
                  type={field.type}
                  value={cfg[field.key] || ''}
                  onChange={e => setCfg((c: any) => ({ ...c, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="input-field"
                />
              </div>
            ))}

            {/* Auto-send toggles */}
            <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-700">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Automation</p>
              {[
                { key: 'autoSendInvoice', label: 'Auto-send invoice after billing', desc: 'Sends invoice to customer after each successful sale' },
                { key: 'autoSendPromo', label: 'Auto-send promo for new products', desc: 'Notifies customers when a new product is added' },
              ].map(toggle => (
                <div key={toggle.key} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-900 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">{toggle.label}</p>
                    <p className="text-xs text-stone-400">{toggle.desc}</p>
                  </div>
                  <button onClick={() => setCfg((c: any) => ({ ...c, [toggle.key]: !c[toggle.key] }))}
                    className={clsx('w-11 h-6 rounded-full transition-colors relative', cfg[toggle.key] ? 'bg-[#25D366]' : 'bg-stone-300')}>
                    <span className={clsx('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', cfg[toggle.key] ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={handleSaveConfig} disabled={savingCfg} className="btn-primary w-full">
              {savingCfg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Settings
            </button>
          </div>

          <div className="card p-4 border-l-4 border-l-blue-500">
            <p className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-2">📋 Twilio Setup Guide</p>
            <ol className="text-xs text-stone-500 space-y-1 list-decimal list-inside">
              <li>Sign up at <a href="https://twilio.com" target="_blank" className="text-blue-500 underline">twilio.com</a></li>
              <li>Go to Messaging → Try WhatsApp (sandbox)</li>
              <li>Copy your Account SID & Auth Token from Console</li>
              <li>From number for sandbox: <code className="bg-stone-100 px-1 rounded">+14155238886</code></li>
              <li>Each customer must send <code className="bg-stone-100 px-1 rounded">join &lt;word&gt;</code> to activate sandbox</li>
              <li>For production: apply for WhatsApp Business approval</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
