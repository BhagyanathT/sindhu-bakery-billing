'use client';
// src/app/(dashboard)/flash-billing/page.tsx — ⚡ Flash Billing — Mobile-First
import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Delete, CheckCircle, Clock, Banknote, CreditCard, Smartphone, ChevronLeft, List, Printer } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { announceFlashBill } from '@/lib/malayalamVoice';
import { useVoiceSettings, getVoiceOpts } from '@/hooks/useVoiceSettings';
import VoiceStatusWidget, { VoiceMuteButton } from '@/components/VoiceStatusWidget';

type PayMethod = 'cash' | 'upi' | 'card';
type Op = '+' | '-' | '*' | '/';
type MobileTab = 'calc' | 'history';

interface QuickBill {
  _id: string;
  invoiceNumber: string;
  grandTotal: number;
  quickNote: string;
  paymentMethod: string;
  createdAt: string;
  items?: any[];
  subtotal?: number;
  totalTax?: number;
  totalDiscount?: number;
}

const PAY_METHODS: { id: PayMethod; label: string; icon: React.ElementType }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi',  label: 'UPI (G)',  icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
];

const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500];

function compute(a: number, b: number, op: Op): number {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return b === 0 ? 0 : a / b;
  return b;
}

function fmtDisplay(s: string): string {
  if (!s || s === '-') return s || '0';
  const isNeg = s.startsWith('-');
  const absS = isNeg ? s.slice(1) : s;
  const [int, dec] = absS.split('.');
  const f = parseInt(int || '0').toLocaleString('en-IN');
  const res = dec !== undefined ? `${f}.${dec}` : f;
  return isNeg ? '-' + res : res;
}

export default function FlashBillingPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const voiceSettings = useVoiceSettings();
  
  // ── Calculator ─────────────────────────────────────────────────────────
  const [current, setCurrent]     = useState('');
  const [prev, setPrev]           = useState<number | null>(null);
  const [op, setOp]               = useState<Op | null>(null);
  const [justEvaled, setJustEvaled] = useState(false);
  const [exprHint, setExprHint]   = useState('');
  const [calcString, setCalcString] = useState('');

  // ── Bill ───────────────────────────────────────────────────────────────
  const [note, setNote]           = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [saving, setSaving]       = useState(false);
  const [recentBills, setRecentBills] = useState<QuickBill[]>([]);
  const [todayTotal, setTodayTotal]   = useState(0);
  const [todayCount, setTodayCount]   = useState(0);
  const [mobileTab, setMobileTab]     = useState<MobileTab>('calc');
  const [printTarget, setPrintTarget] = useState<QuickBill | null>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchRecent = async () => {
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      
      // 1. Fetch recent quick bills for the list
      const resRecent = await api.get(`/invoices?limit=15&type=sale&billingMode=quick&startDate=${today}`);
      const recent = (resRecent.data.data?.invoices || []).map((inv: any) => ({
        ...inv,
        paymentMethod: inv.payments?.[0]?.method || 'cash'
      }));
      setRecentBills(recent);

      // 2. Fetch today's flash billing summary stats
      const resStats = await api.get(`/invoices/period-stats?type=sale&billingMode=quick&startDate=${today}&endDate=${today}`);
      if (resStats.data?.success) {
        const d = resStats.data.data;
        setTodayCount(d.totalOrders || 0);
        setTodayTotal(d.totalAmount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch flash bills:', error);
    }
  };

  useEffect(() => { fetchRecent(); }, []);

  // ── Calc logic ─────────────────────────────────────────────────────────
  const pressDigit = useCallback((d: string) => {
    setCurrent(p => {
      if (justEvaled) {
        setJustEvaled(false); setPrev(null); setOp(null); setExprHint('');
        if (d === '00') return '0';
        return d === '.' ? '0.' : d;
      }
      if (d === '.' && p.includes('.')) return p;
      if (d === '.' && p === '') return '0.';
      if (d === '00' && p === '') return p;
      if (p === '0' && d !== '.') return d;
      if (p.replace(/[^0-9]/g, '').length >= 9) return p;
      return p + d;
    });
  }, [justEvaled]);

  const pressOp = useCallback((newOp: Op) => {
    const c = parseFloat(current) || 0;
    if (op && current !== '' && prev !== null) {
      const result = Math.round(compute(prev, c, op) * 100) / 100;
      setExprHint(`${prev} ${op} ${c} =`);
      setCalcString(s => s + ` ${op} ${c}`);
      setPrev(result); setCurrent(''); setOp(newOp); setJustEvaled(false);
    } else {
      const base = current !== '' ? c : (prev ?? 0);
      setCalcString(s => s ? s : base.toString());
      setPrev(base); setCurrent(''); setOp(newOp);
      setExprHint(`${base} ${newOp}`); setJustEvaled(false);
    }
  }, [current, op, prev]);

  const pressEquals = useCallback(() => {
    if (op === null || prev === null) return;
    const c = current !== '' ? (parseFloat(current) || 0) : prev;
    const result = Math.round(compute(prev, c, op) * 100) / 100;
    setExprHint(`${prev} ${op} ${c} =`);
    setCalcString(s => s + ` ${op} ${c}`);
    setCurrent(result.toString());
    setPrev(null); setOp(null); setJustEvaled(true);
  }, [op, prev, current]);

  const pressClear = useCallback(() => {
    setCurrent(''); setPrev(null); setOp(null); setJustEvaled(false); setExprHint(''); setCalcString('');
  }, []);

  const pressBack = useCallback(() => {
    if (justEvaled) { pressClear(); return; }
    setCurrent(p => p.slice(0, -1));
  }, [justEvaled, pressClear]);

  const pressPlusMinus = useCallback(() => {
    setCurrent(p => (!p || p === '0') ? p : p.startsWith('-') ? p.slice(1) : '-' + p);
  }, []);

  const pressPercent = useCallback(() => {
    const c = parseFloat(current) || 0;
    if (op && prev !== null && (op === '+' || op === '-')) {
      // For addition/subtraction, treat % as a percentage of the previous number
      // e.g., 100 + 10% = 100 + 10
      const percentAmount = (prev * c) / 100;
      setCurrent((Math.round(percentAmount * 100) / 100).toString());
    } else {
      // Normal percentage (e.g., 50 * 10% = 50 * 0.1)
      setCurrent((Math.round(c / 100 * 10000) / 10000).toString());
    }
  }, [current, op, prev]);

  const currentNum = parseFloat(current) || 0;
  const finalAmount = (() => {
    if (current !== '') {
      const c = parseFloat(current) || 0;
      if (op && prev !== null) return compute(prev, c, op);
      return c;
    }
    return prev ?? 0;
  })();
  const hasAmount = finalAmount > 0;
  const displayValue = current === '' ? (prev !== null ? prev.toString() : '0') : current;

  // ── Save ───────────────────────────────────────────────────────────────
  const save = useCallback(async (methodOverride?: PayMethod) => {
    if (isSavingRef.current) return;
    const total = Math.round(finalAmount * 100) / 100;
    if (!total || total <= 0) { toast.error('Enter a valid amount!'); return; }
    
    const method = methodOverride || payMethod;
    let finalNote = note.trim();
    let finalCalc = calcString;
    if (op && current !== '' && prev !== null) {
      finalCalc += ` ${op} ${parseFloat(current) || 0}`;
    }
    if (finalCalc && /[+\-*/]/.test(finalCalc)) {
      finalNote = finalNote ? `${finalNote} [${finalCalc}]` : `[${finalCalc}]`;
    }
    
    isSavingRef.current = true;
    setSaving(true);
    try {
      const res = await api.post('/invoices/quick', { total, note: finalNote, paymentMethod: method });
      toast.success(`✅ ₹${total.toLocaleString('en-IN')} saved!`, { icon: '⚡' });
      pressClear(); 
      setNote(''); 
      fetchRecent();

      // 🔊 Malayalam voice announcement (fire-and-forget)
      if (voiceSettings.voiceEnabled) {
        announceFlashBill({ amount: total, paymentMethod: method, opts: getVoiceOpts(voiceSettings) });
      }
    } catch (err: any) {
      console.error('[FlashSave] Error:', err?.response?.data || err);
      toast.error(err?.response?.data?.message || 'Failed to save. Please check amount.');
    } finally { 
      isSavingRef.current = false;
      setSaving(false); 
    }
  }, [finalAmount, note, payMethod, pressClear, calcString, op, current, prev, voiceSettings.voiceEnabled, voiceSettings.volume, voiceSettings.rate, voiceSettings.pitch, voiceSettings.selectedVoiceURI]);

  const handlePrint = (bill: QuickBill) => {
    setPrintTarget(bill);
    setTimeout(() => {
      window.print();
      setPrintTarget(null);
    }, 300);
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

  // ── Keyboard ───────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // If typing in the note field, only intercept Enter to save
      if (document.activeElement === noteRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        }
        return;
      }

      // If saving is in progress, ignore calculator input
      if (isSavingRef.current) {
        e.preventDefault();
        return;
      }

      let handled = true;
      if (e.key >= '0' && e.key <= '9') pressDigit(e.key);
      else if (e.key === '.') pressDigit('.');
      else if (e.key === '+') pressOp('+');
      else if (e.key === '-') pressOp('-');
      else if (e.key === '*') pressOp('*');
      else if (e.key === '/') pressOp('/');
      else if (e.key === '=') pressEquals();
      else if (e.key === 'Enter') save();
      else if (e.key === 'Backspace') pressBack();
      else if (e.key === 'Escape') pressClear();
      else if (e.key.toLowerCase() === 'g') save('upi');
      else handled = false;

      // Prevent default browser behavior (like clicking focused buttons) for handled keys
      if (handled) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pressDigit, pressOp, pressEquals, pressBack, pressClear, save, op]);

  const opLabel: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  // ── Shared calculator JSX ──────────────────────────────────────────────
  const CalcPanel = (
    <div className="bg-gradient-to-br from-stone-900 to-stone-950 rounded-3xl shadow-2xl overflow-hidden border border-stone-800 flex flex-col">
      {/* Display */}
      <div className="px-4 pt-4 pb-2 min-h-[90px] flex flex-col justify-end">
        <p className="text-right text-stone-500 text-xs h-4 truncate">
          {exprHint || (op && prev !== null ? `${prev} ${opLabel[op]}` : '')}
        </p>
        <div className={clsx(
          'text-right font-black leading-none mt-1 truncate transition-colors',
          displayValue.length > 10 ? 'text-3xl' : 'text-4xl md:text-5xl',
          justEvaled ? 'text-amber-400' : current ? 'text-white' : 'text-stone-500'
        )}>
          {fmtDisplay(displayValue)}
        </div>
        {op && current !== '' && prev !== null && (
          <p className="text-right text-emerald-400 text-xs mt-0.5">
            = {compute(prev, currentNum, op).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        )}
      </div>

      {/* Presets */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {PRESET_AMOUNTS.map(v => (
          <button key={v}
            onClick={() => { pressClear(); setCurrent(v.toString()); }}
            className="px-2.5 py-1 rounded-xl bg-stone-800 hover:bg-amber-600/80 text-stone-300 hover:text-white text-xs font-bold transition-all active:scale-95">
            ₹{v}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="px-3 pb-2 grid grid-cols-4 gap-1.5">
        {([
          ['C', pressClear,         'bg-stone-600 hover:bg-stone-500 text-white'],
          ['+/-', pressPlusMinus,   'bg-stone-600 hover:bg-stone-500 text-white'],
          ['%', pressPercent,       'bg-stone-600 hover:bg-stone-500 text-white'],
          ['÷', () => pressOp('/'), op==='/'? 'bg-orange-400 text-white':'bg-amber-600 hover:bg-amber-500 text-white'],
          ['7', () => pressDigit('7'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['8', () => pressDigit('8'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['9', () => pressDigit('9'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['×', () => pressOp('*'), op==='*'? 'bg-orange-400 text-white':'bg-amber-600 hover:bg-amber-500 text-white'],
          ['4', () => pressDigit('4'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['5', () => pressDigit('5'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['6', () => pressDigit('6'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['−', () => pressOp('-'), op==='-'? 'bg-orange-400 text-white':'bg-amber-600 hover:bg-amber-500 text-white'],
          ['1', () => pressDigit('1'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['2', () => pressDigit('2'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['3', () => pressDigit('3'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['+', () => pressOp('+'), op==='+'? 'bg-orange-400 text-white':'bg-amber-600 hover:bg-amber-500 text-white'],
          ['00', () => pressDigit('00'), 'bg-stone-800 hover:bg-stone-700 text-white'],
          ['0',  () => pressDigit('0'),  'bg-stone-800 hover:bg-stone-700 text-white'],
          ['.',  () => pressDigit('.'),  'bg-stone-800 hover:bg-stone-700 text-white'],
          ['=',  pressEquals, 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30'],
        ] as [string, () => void, string][]).map(([label, action, style]) => (
          <button key={label} onClick={action}
            className={clsx('py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center', style)}>
            {label}
          </button>
        ))}
      </div>

      {/* Backspace */}
      <div className="px-3 pb-2">
        <button onClick={pressBack}
          className="w-full py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
          <Delete className="w-4 h-4" /> Backspace
        </button>
      </div>

      {/* Note */}
      <div className="px-3 pb-2">
        <input ref={noteRef} type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="Note (tea, snacks, bread...)"
          className="w-full bg-stone-800/70 text-white placeholder-stone-500 rounded-xl px-4 py-2.5 text-sm border border-stone-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all" />
      </div>

      {/* Payment */}
      <div className="px-3 pb-2 flex gap-2">
        {PAY_METHODS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPayMethod(id)}
            className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
              payMethod === id ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'bg-stone-800 text-stone-400 hover:bg-stone-700')}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Save */}
      <div className="px-3 pb-4">
        <button onClick={() => save()} disabled={!hasAmount || saving}
          className={clsx('w-full py-4 rounded-2xl text-white text-base font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2',
            hasAmount && !saving
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 shadow-xl shadow-emerald-500/30'
              : 'bg-stone-700 opacity-40 cursor-not-allowed')}>
          {saving
            ? <span className="animate-spin text-lg">⏳</span>
            : <><CheckCircle className="w-5 h-5" /> Save Bill{hasAmount ? ` · ₹${finalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : ''}</>}
        </button>
      </div>
    </div>
  );

  const HistoryPanel = (
    <div className="space-y-3">
      <div className="card p-3 flex justify-between items-center">
        <p className="text-sm font-bold text-stone-700 dark:text-stone-300">Today's Flash Bills</p>
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
          {todayCount} Bill{todayCount !== 1 ? 's' : ''} {isAdmin && `· ₹${todayTotal.toLocaleString('en-IN')}`}
        </p>
      </div>
      {recentBills.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-4xl mb-3">⚡</p>
          <p className="font-semibold text-stone-500">No flash bills yet</p>
          <p className="text-stone-400 text-sm mt-1">Enter an amount and hit Save!</p>
        </div>
      ) : recentBills.map((bill, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{bill.invoiceNumber}</p>
            <p className="text-xs text-stone-400 truncate">
              {bill.quickNote || 'Quick bill'} · {new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-bold text-emerald-600 dark:text-emerald-400">₹{(bill.grandTotal || 0).toLocaleString('en-IN')}</p>
            <span className="text-xs bg-stone-100 dark:bg-stone-800 text-stone-500 px-2 py-0.5 rounded-full capitalize mb-2 inline-block">{bill.paymentMethod || 'cash'}</span>
            <div className="flex gap-1.5 justify-end mt-1">
              <button onClick={() => handlePrint(bill)} className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" title="Thermal Print">
                <Printer className="w-3.5 h-3.5" />
              </button>
              <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/invoices/${bill._id}/pdf?token=${token}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors" title="A4 Print">
                <span className="text-[10px] font-bold">A4</span>
              </a>
            </div>
          </div>
        </div>
      ))}
      <div className="card p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1.5">⚡ Tips</p>
        <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-1">
          <li>🍞 <strong>3 breads × ₹20</strong> → press 3 × 20 = Save</li>
          <li>☕ <strong>Tea + Snack</strong> → press 30 + 50 Save</li>
          <li>💰 Tap ₹10 ₹50 ₹100 presets for quick entry</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="group flex flex-col h-[calc(100dvh-70px)] -m-2 sm:-m-4 overflow-hidden">
      {/* Malayalam Voice Status Widget */}
      <VoiceStatusWidget />
      <style>{`
        @media print {
          body { visibility: hidden; background: white; margin: 0; padding: 0; }
          #flash-receipt { 
            visibility: visible !important; 
            display: block !important; 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            color: #000000 !important;
            background: #ffffff !important;
          }
          #flash-receipt * { visibility: visible !important; color: #000000 !important; }
          .no-print { display: none !important; }
          @page { margin: 0; size: auto; }
        }
      `}</style>

      {/* Hidden Thermal Receipt */}
      <div id="flash-receipt" style={{ position: 'absolute', top: '-9999px', left: '-9999px', visibility: 'hidden', fontFamily: 'monospace', fontSize: '15px', padding: '10px', width: '100%', maxWidth: '80mm', margin: '0 auto', background: '#fff', color: '#000' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '20mm', margin: '0 auto 8px', display: 'block', filter: 'grayscale(1) contrast(1.5)' }} />
          <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '2px' }}>Sindhu Bakery</div>
          <div style={{ fontSize: '14px' }}>Marayamuttam, Thiruvananthapuram, Kerala</div>
          <div style={{ fontSize: '14px' }}>Ph: 9544208030, 6238442987</div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000', border: '1px solid #000', padding: '2px 6px', display: 'inline-block', marginBottom: '4px' }}>⚡ FLASH BILL</div>
          <div style={{ fontSize: '15px', marginTop: '4px' }}>Bill No: <strong>{printTarget?.invoiceNumber}</strong></div>
          <div style={{ fontSize: '13px', color: '#444' }}>
            {printTarget?.createdAt ? new Date(printTarget.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
            {' '}
            {printTarget?.createdAt ? new Date(printTarget.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Today's Bills: {todayCount}</div>
        </div>
        <div style={{ borderTop: '1px dashed #000', marginBottom: '8px' }} />

        {/* Bill Note / Description */}
        {printTarget?.quickNote && (
          <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '6px' }}>
            📝 {printTarget.quickNote}
          </div>
        )}

        {/* Amount breakdown */}
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}>
          <span style={{ color: '#555' }}>Bill Amount</span>
          <span style={{ fontWeight: 'bold' }}>₹{(printTarget?.grandTotal || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px', color: '#555' }}>
          <span>Payment Mode</span>
          <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{printTarget?.paymentMethod || 'CASH'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '20px', borderTop: '2px solid #000', paddingTop: '6px', marginTop: '6px' }}>
          <span>TOTAL</span>
          <span>₹{(printTarget?.grandTotal || 0).toFixed(2)}</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '14px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Thank you! Visit again 🙏</div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>Sindhu Bakery POS · Flash Billing</div>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex-shrink-0 bg-white dark:bg-stone-900">
        <Link href="/billing" className="btn-icon flex-shrink-0"><ChevronLeft className="w-4 h-4" /></Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/30 flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-stone-800 dark:text-stone-100 text-sm leading-tight">⚡ Flash Billing</p>
            <p className="text-stone-400 text-xs truncate">Rush hour · amount only</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-stone-400">Today</p>
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
            {todayCount} Bill{todayCount !== 1 ? 's' : ''} {isAdmin && `· ₹${todayTotal.toLocaleString('en-IN')}`}
          </p>
        </div>
        {/* Voice mute button */}
        <VoiceMuteButton />
      </div>

      {/* ── Mobile Tab Switch ── */}
      <div className="lg:hidden flex gap-1 px-3 py-2 bg-stone-100 dark:bg-stone-900 flex-shrink-0 border-b border-stone-200 dark:border-stone-800">
        <button onClick={() => setMobileTab('calc')}
          className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
            mobileTab === 'calc' ? 'bg-amber-600 text-white' : 'text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800')}>
          <Zap className="w-3.5 h-3.5" /> Calculator
        </button>
        <button onClick={() => setMobileTab('history')}
          className={clsx('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
            mobileTab === 'history' ? 'bg-amber-600 text-white' : 'text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800')}>
          <List className="w-3.5 h-3.5" /> History ({todayCount})
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Mobile: show either calc or history */}
        <div className="lg:hidden p-3 flex justify-center">
          <div className="w-full max-w-[380px]">
            {mobileTab === 'calc' ? CalcPanel : HistoryPanel}
          </div>
        </div>

        {/* Desktop: side by side */}
        <div className="hidden lg:flex gap-6 p-6 h-full items-start justify-center max-w-5xl mx-auto w-full">
          <div className="w-[340px] flex-shrink-0">{CalcPanel}</div>
          <div className="flex-1 max-w-[500px] space-y-4">
            <h2 className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Recent Flash Bills
            </h2>
            {HistoryPanel}
          </div>
        </div>
      </div>
    </div>
  );
}
