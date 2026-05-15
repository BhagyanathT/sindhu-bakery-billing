'use client';
// src/app/(dashboard)/billing/page.tsx — Sindhu Bakery POS (Multi-tab)
import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  Search, Plus, Minus, Trash2, CreditCard, Smartphone, Banknote,
  Tag, ToggleLeft, ToggleRight, ShoppingCart, ChevronRight, Printer, X,
  PlusCircle, Users, MessageCircle, UserPlus, Scan, Camera, XCircle,
} from 'lucide-react';
import { useProductStore } from '@/store/productStore';
import { useBillingStore, BillingTab } from '@/store/billingStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { openWhatsApp, buildInvoiceMsg } from '@/lib/whatsapp';
import { announceFullBill } from '@/lib/malayalamVoice';
import { useVoiceSettings, getVoiceOpts } from '@/hooks/useVoiceSettings';
import VoiceStatusWidget, { VoiceMuteButton } from '@/components/VoiceStatusWidget';

const PAYMENT_METHODS = [
  { id: 'cash',   label: 'Cash',   icon: Banknote },
  { id: 'upi',    label: 'UPI',    icon: Smartphone },
  { id: 'card',   label: 'Card',   icon: CreditCard },
  { id: 'credit', label: 'Credit', icon: Tag },
] as const;

// CATEGORIES will be derived dynamically from products

const MAX_TABS = 20;

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function TabBar() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab } = useBillingStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (tab: BillingTab) => {
    setEditingId(tab.id);
    setEditValue(tab.label);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const commitRename = () => {
    if (editingId && editValue.trim()) renameTab(editingId, editValue.trim());
    setEditingId(null);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === id);
    if (tab && tab.cart.length > 0) {
      if (!confirm(`"${tab.label}" has items in the cart.\nClose this tab anyway?`)) return;
    }
    removeTab(id);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-2 bg-stone-100 dark:bg-stone-900 border-b border-stone-200 dark:border-stone-700 overflow-x-auto scrollbar-none flex-shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const itemCount = tab.cart.reduce((s, i) => s + i.quantity, 0);
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onDoubleClick={() => startRename(tab)}
            title="Double-click to rename"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold cursor-pointer select-none transition-all whitespace-nowrap flex-shrink-0 group border',
              isActive
                ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-400/30'
                : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
            )}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent outline-none w-24 text-sm font-semibold"
                maxLength={20}
              />
            ) : (
              <span>{tab.label}</span>
            )}
            {itemCount > 0 && (
              <span className={clsx(
                'text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                isActive ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              )}>
                {itemCount}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => handleClose(e, tab.id)}
                className={clsx(
                  'ml-0.5 rounded-full p-0.5 transition-colors',
                  isActive ? 'hover:bg-white/20 text-white/70 hover:text-white' : 'text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100'
                )}
                title="Close tab"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* New Tab button */}
      {tabs.length < MAX_TABS && (
        <button
          id="new-tab-btn"
          onClick={addTab}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-stone-500 dark:text-stone-400 border border-dashed border-stone-300 dark:border-stone-600 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all flex-shrink-0 ml-1"
          title="New customer tab"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          New Tab
        </button>
      )}

      <div className="ml-auto flex-shrink-0 flex items-center gap-1 text-xs text-stone-400 pl-3">
        <Users className="w-3.5 h-3.5" />
        <span>{tabs.length}/{MAX_TABS}</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const { products, setProducts, createOrder, updateOrder } = useProductStore();
  const { tabs, activeTabId, updateTab, addToCart, updateQty, removeItem, clearTab } = useBillingStore();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');

  // 🔊 Voice settings — must be declared before handleSave
  const voiceSettings = useVoiceSettings();

  // ── Barcode Scanner ────────────────────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopScanner = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setScannerOpen(false);
    setScannerError('');
    setTimeout(() => searchRef.current?.focus(), 100);
  }, []);

  const startScanner = useCallback(async () => {
    setScannerError('');
    setScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Use BarcodeDetector API (Chrome/Edge 83+)
      if (!('BarcodeDetector' in window)) {
        setScannerError('Barcode scanner is not supported in this browser. Please use Chrome or Edge.');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'] });
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            // Find matching product by barcode
            const matched = products.find(p => p.barcode === code || p.sku === code);
            if (matched) {
              stopScanner();
              handleAddToCart(matched);
              toast.success(`✅ ${matched.name} added via barcode`);
            } else {
              stopScanner();
              setSearch(code);
              toast(`🔍 Barcode: ${code} — no exact match, showing search results`, { icon: '📷' });
            }
          }
        } catch { /* frame not ready */ }
      }, 300);
    } catch {
      setScannerError('Camera access denied. Please allow camera permission and try again.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, stopScanner]);

  // Cleanup scanner on unmount
  useEffect(() => () => stopScanner(), [stopScanner]);

  // Customer search
  const [customers, setCustomers] = useState<any[]>([]);
  const [lastStatsUpdate, setLastStatsUpdate] = useState(Date.now());
  const [showFullCustModal, setShowFullCustModal] = useState(false);
  const [fullCustData, setFullCustData] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    address: { line1: '', city: '' },
    customerType: 'retail'
  });
  const [custSearch, setCustSearch] = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const custRef = useRef<HTMLDivElement>(null);

  // Fetch customers once
  useEffect(() => {
    import('@/lib/api').then(m => m.default.get('/customers?limit=200'))
      .then(res => setCustomers(res.data.data?.customers || []))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync products on mount
  useEffect(() => {
    setLoading(true);
    import('@/lib/api').then(m => m.default.get('/products?limit=500'))
      .then(res => {
        if (res.data?.success && res.data.data?.products) {
          const mapped = res.data.data.products.map((p: any) => ({
            _id: p._id,
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            category: p.category?.name || p.category || 'Other',
            sellingPrice: p.sellingPrice ?? 0,
            mrp: p.mrp ?? 0,
            discount: p.mrp > 0 && p.sellingPrice > 0
              ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100)
              : (p.discount ?? 0),
            costPrice: p.costPrice ?? 0,
            tax: { gstRate: p.tax?.gstRate ?? 0 },
            stock: { current: p.stock?.current ?? 0, minLevel: p.stock?.minLevel ?? 5 },
            unit: p.unit || 'pcs',
            images: p.images || [],
            salesCount: p.salesCount ?? 0,
            emoji: p.emoji || '🥖',
          }));
          setProducts(mapped);
        }
      })
      .catch(() => {
        toast.error('Failed to sync products from server');
      })
      .finally(() => setLoading(false));
  }, [setProducts]);


  // Derive the active tab's data
  const tab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const tabId = tab?.id ?? '';

  const { cart, customerName, customerPhone, paymentMethod, discount, gstEnabled, amountPaid, lastOrder } = tab ?? {
    cart: [], customerName: '', customerPhone: '', paymentMethod: 'cash', discount: 0, gstEnabled: true, amountPaid: '', lastOrder: null,
  };

  // Helpers to update active tab fields
  const setCustomerName = (v: string) => { updateTab(tabId, { customerName: v }); setCustSearch(v); };
  const setCustomerPhone = (v: string) => updateTab(tabId, { customerPhone: v });

  // Auto-prefix +91
  const handlePhoneFocus = () => {
    if (!customerPhone || customerPhone.trim() === '+91') {
      setCustomerPhone('+91 ');
    }
  };

  const handlePhoneChange = (v: string) => {
    // If user clears everything
    if (v === '' || v === '+') { 
      setCustomerPhone(''); 
      return; 
    }

    // If user types a 10-digit number directly, prepend +91
    if (/^\d{10}$/.test(v)) {
      setCustomerPhone(`+91 ${v}`);
      return;
    }

    // Force +91 prefix
    if (!v.startsWith('+91')) {
      const digits = v.replace(/[^\d]/g, '');
      if (digits.startsWith('91')) {
        setCustomerPhone(`+91 ${digits.slice(2)}`);
      } else {
        setCustomerPhone(`+91 ${digits}`);
      }
    } else {
      setCustomerPhone(v);
    }
  };

  const selectCustomer = (c: any) => {
    let ph = c.phone || '';
    if (ph) {
      // Clean up and ensure +91
      const digits = ph.replace(/[^\d]/g, '');
      if (digits.length === 10) ph = `+91 ${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) ph = `+91 ${digits.slice(2)}`;
      else if (!ph.startsWith('+')) ph = `+${digits}`;
    }
    updateTab(tabId, { customerName: c.name, customerPhone: ph });
    setCustSearch(c.name);
    setShowCustDrop(false);
  };
  const setPaymentMethod = (v: string) => updateTab(tabId, { paymentMethod: v as BillingTab['paymentMethod'] });
  const setDiscount = (v: number) => updateTab(tabId, { discount: v });
  const setGstEnabled = (v: boolean) => updateTab(tabId, { gstEnabled: v });
  const setAmountPaid = (v: string) => updateTab(tabId, { amountPaid: v });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F10') { e.preventDefault(); if (cart.length > 0) handleSave(); }
      if (e.key === 'Escape') setSearch('');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line
  }, [cart, tabId]);

  // Focus search on tab switch
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 80);
  }, [activeTabId]);

  // Derived Categories
  const derivedCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))].sort();

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    return matchSearch && matchCat;
  });


  const handleAddToCart = useCallback((product: typeof products[0]) => {
    addToCart(tabId, product);
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [tabId, addToCart]);

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeItem(tabId, productId); return; }
    updateQty(tabId, productId, qty);
  };

  const totals = cart.reduce((acc, item) => {
    const gross = item.rate * item.quantity;
    const tax = gstEnabled ? (gross * item.taxRate) / 100 : 0;
    return { subtotal: acc.subtotal + gross, tax: acc.tax + tax, items: acc.items + item.quantity };
  }, { subtotal: 0, tax: 0, items: 0 });

  const grandTotal = Math.max(0, totals.subtotal + totals.tax - discount);
  const change = parseFloat(amountPaid || '0') - grandTotal;

  // Re-fetch products from server to reflect real-time stock after billing
  const refreshProducts = () => {
    import('@/lib/api').then(m => m.default.get('/products?limit=500'))
      .then(res => {
        if (res.data?.success && res.data.data?.products) {
          setProducts(res.data.data.products.map((p: any) => ({
            _id: p._id, name: p.name, sku: p.sku || '',
            barcode: p.barcode || '',
            category: p.category?.name || p.category || 'Other',
            sellingPrice: p.sellingPrice ?? 0,
            mrp: p.mrp ?? 0,
            discount: p.mrp > 0 && p.sellingPrice > 0
              ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100)
              : (p.discount ?? 0),
            costPrice: p.costPrice ?? 0,
            tax: { gstRate: p.tax?.gstRate ?? 0 },
            stock: { current: p.stock?.current ?? 0, minLevel: p.stock?.minLevel ?? 5 },
            unit: p.unit || 'pcs', images: p.images || [],
            salesCount: p.salesCount ?? 0, emoji: p.emoji || '🥖',
          })));
        }
      }).catch(() => {});
  };

  const handleSave = async (withPrint = true) => {
    if (cart.length === 0) { toast.error('Cart is empty!'); return; }
    setLoading(true);
    try {
      let orderId = '', invoiceId = '';
      if (tab.editOrderId) {
        const subtotal = cart.reduce((s, i) => s + i.rate * i.quantity, 0);
        const tax = gstEnabled ? cart.reduce((s, i) => s + (i.rate * i.quantity * (i.taxRate || 0)) / 100, 0) : 0;
        const grandTotalCalc = Math.max(0, subtotal + tax - discount);
        
        const payload = {
          items: cart.map(i => ({
            product: i.product._id,
            name: i.product.name,
            quantity: i.quantity,
            rate: i.rate,
            mrp: i.product.mrp || 0,
            discount: i.product.discount || 0,
            discountType: 'percentage',
            taxRate: gstEnabled ? (i.taxRate || 0) : 0,
            taxType: 'exclusive',
          })),
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || '',
          discount: discount || 0,
          isInterState: false,
          payments: [{ method: paymentMethod || 'cash', amount: grandTotalCalc }],
        };
        const ok = await updateOrder(tab.editOrderId, payload);
        if (!ok) {
           toast.error('❌ Update failed!');
           setLoading(false);
           return;
        }
        orderId = tab.label.replace('Edit ', ''); 
        invoiceId = tab.editOrderId;
      } else {
        const res = await createOrder(cart, customerName, paymentMethod, discount, gstEnabled, customerPhone);
        orderId = res.orderId;
        invoiceId = res.invoiceId;
      }

      if (!orderId) {
        toast.error('❌ Order failed! Please check stock.');
        setLoading(false);
        return;
      }
      const now = new Date();
      const snapshot = {
        orderId,
        invoiceId,
        customerPhone: customerPhone || '',
        items: [...cart],
        totals: { ...totals },
        grandTotal,
        customerName: customerName || '',
        discount,
        paymentMethod,
        printedAt: `${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      };

      flushSync(() => {
        updateTab(tabId, { lastOrder: snapshot });
        updateTab(tabId, {
          cart: [],
          amountPaid: '',
          discount: 0,
          customerName: '',
          customerPhone: '',
        });
        toast.success(`✅ Bill ${orderId} saved — ${tab.label}!`);
      });

      // 🔊 Malayalam voice announcement
      if (voiceSettings.voiceEnabled) {
        const voiceOpts = getVoiceOpts(voiceSettings);
        const cashChange = Math.max(0, parseFloat(amountPaid || '0') - grandTotal);
        announceFullBill({ amount: grandTotal, paymentMethod, change: cashChange, opts: voiceOpts });
      }

      // ✅ Bill saved — WhatsApp is only sent when user explicitly taps the button

      // 🔄 Auto-refresh stock counts instantly
      refreshProducts();

      if (withPrint) {
        setTimeout(() => {
          window.print();
          setTimeout(() => searchRef.current?.focus(), 300);
        }, 300);
      } else {
        setTimeout(() => searchRef.current?.focus(), 100);
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOnly = () => handleSave(false);

  const resetBill = () => {
    clearTab(tabId);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const stockBadge = (p: typeof products[0]) => {
    if (p.stock.current <= 0) return { label: 'Out', cls: 'bg-red-500 text-white' };
    if (p.stock.current <= p.stock.minLevel) return { label: `⚠ ${p.stock.current}`, cls: 'bg-orange-500 text-white' };
    return { label: String(p.stock.current), cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' };
  };

  // voiceSettings is declared earlier (above handleSave) — see top of component

  return (
    <>
      {/* ── Print Styles ── */}
      <style>{`
        @media print {
          body { visibility: hidden; background: white; margin: 0; padding: 0; }
          #sindu-receipt { 
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
          #sindu-receipt * { visibility: visible !important; color: #000000 !important; }
          .no-print { display: none !important; }
          @page { margin: 0; size: auto; }
        }

        /* Custom Scrollbar for POS */
        .pos-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .pos-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .pos-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(217, 119, 6, 0.4);
          border-radius: 10px;
        }
        .pos-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(217, 119, 6, 0.6);
        }
      `}</style>

      {/* ── Malayalam Voice Status Widget ── */}
      <VoiceStatusWidget />

      {/* ── Hidden Receipt for Print ── */}
      <div
        id="sindu-receipt"
        style={{
          position: 'absolute', top: '-9999px', left: '-9999px', visibility: 'hidden',
          fontFamily: "'Courier New', Courier, monospace", fontSize: '15px', lineHeight: '1.5',
          padding: '10px', width: '100%', maxWidth: '80mm', margin: '0 auto', background: '#ffffff', color: '#000000',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '20mm', margin: '0 auto 8px', display: 'block', filter: 'grayscale(1) contrast(1.5)' }} />
          <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '2px' }}>Sindhu Bakery</div>
          <div style={{ fontSize: '14px' }}>Marayamuttam, Thiruvananthapuram, Kerala</div>
          <div style={{ fontSize: '14px' }}>Ph: 9544208030, 6238442987</div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ fontSize: '15px' }}>Bill No: <strong>{lastOrder?.orderId || '—'}</strong></div>
          <div style={{ fontSize: '15px' }}>Customer: <strong>{lastOrder?.customerName || 'Walk-in Customer'}</strong></div>
          <div style={{ fontSize: '13px', color: '#555' }}>{lastOrder?.printedAt || ''}</div>
        </div>
        <div style={{ borderTop: '1px dashed #000', marginBottom: '8px' }} />
        {(lastOrder?.items || []).map((item, i) => {
          const gross = item.rate * item.quantity;
          const tax = gstEnabled ? (gross * item.taxRate) / 100 : 0;
          const mrp = item.product.mrp || item.rate;
          const discountPct = item.product.discount || 0;
          return (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold' }}>{item.product.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#555', fontSize: '12px' }}>
                  {mrp > item.rate && <span style={{ textDecoration: 'line-through', marginRight: '4px' }}>₹{mrp}</span>}
                  ₹{item.rate} x {item.quantity} {discountPct > 0 ? `(${discountPct}% off)` : ''}
                </span>
                <span style={{ fontWeight: 'bold' }}>₹{(gross + tax).toFixed(0)}</span>
              </div>
            </div>
          );
        })}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ color: '#555' }}>Items ({lastOrder?.totals.items || 0})</span>
          <span>₹{(lastOrder?.totals.subtotal || 0).toFixed(2)}</span>
        </div>
        {gstEnabled && (lastOrder?.totals.tax || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#555' }}>GST</span>
            <span>₹{(lastOrder?.totals.tax || 0).toFixed(2)}</span>
          </div>
        )}
        {(lastOrder?.discount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ color: '#555' }}>Discount Savings</span>
            <span style={{ color: 'green' }}>-₹{(lastOrder?.discount || 0).toFixed(2)}</span>
          </div>
        )}
        {(() => {
          const mrpSavings = (lastOrder?.items || []).reduce((sum: number, item: any) => {
            const mrp = item.product?.mrp ?? 0;
            return mrp > 0 && mrp > item.rate ? sum + (mrp - item.rate) * item.quantity : sum;
          }, 0);
          const totalSaved = mrpSavings + (lastOrder?.discount || 0);
          return totalSaved > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f0fff0', border: '1px dashed #008800', padding: '4px 6px', borderRadius: '4px', margin: '4px 0', fontWeight: 'bold', color: '#006600' }}>
              <span>🎉 You Saved</span>
              <span>₹{totalSaved.toFixed(2)}</span>
            </div>
          ) : null;
        })()}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '1px solid #000', paddingTop: '5px', marginTop: '5px' }}>
          <span>TOTAL</span>
          <span>₹{(lastOrder?.grandTotal || 0).toFixed(2)}</span>
        </div>
        <div style={{ marginTop: '3px', fontSize: '12px', color: '#555' }}>Payment: {(lastOrder?.paymentMethod || '').toUpperCase()}</div>
        <div style={{ textAlign: 'center', marginTop: '12px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
          <div style={{ fontWeight: 'bold' }}>Thank you! Visit again</div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>Sindhu Bakery POS</div>
        </div>
      </div>

      {/* ── Main POS Layout ── */}
      <div className="flex flex-col h-[calc(100dvh-70px)] -m-2 sm:-m-4 overflow-hidden relative">

        {/* Mobile View Toggle — fixed, always visible */}
        <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 shadow-[0_8px_30px_rgb(0,0,0,0.18)] rounded-full bg-white dark:bg-stone-800 p-1.5 border border-stone-200 dark:border-stone-700">
          <button
            onClick={() => setMobileView('products')}
            className={clsx(
              "px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all",
              mobileView === 'products' ? "bg-amber-600 text-white shadow-md shadow-amber-500/30" : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
            )}
          >
            <Tag className="w-4 h-4" /> Products
          </button>
          <button
            onClick={() => setMobileView('cart')}
            className={clsx(
              "px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all",
              mobileView === 'cart' ? "bg-amber-600 text-white shadow-md shadow-amber-500/30" : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
            )}
          >
            <ShoppingCart className="w-4 h-4" /> Cart
            {totals.items > 0 && (
              <span className={clsx(
                "px-1.5 rounded-full text-xs",
                mobileView === 'cart' ? "bg-white text-amber-600" : "bg-amber-100 text-amber-700"
              )}>
                {totals.items}
              </span>
            )}
          </button>
        </div>


        {/* ── Tab Bar (full width) ── */}
        <TabBar />

        {/* ── POS Body (left products + right bill) ── */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 lg:overflow-hidden">

          {/* ── LEFT: Products ── */}
          <div className={clsx(
            "lg:w-3/5 flex flex-col bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-700 min-h-0",
            mobileView === 'products' ? 'flex-1' : 'hidden lg:flex'
          )}>
            {/* Full Customer Modal */}
      {showFullCustModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-900/10">
              <h3 className="font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" /> New Customer
              </h3>
              <button onClick={() => setShowFullCustModal(false)} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-none">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Full Name *</label>
                  <input
                    autoFocus
                    value={fullCustData.name}
                    onChange={e => setFullCustData({...fullCustData, name: e.target.value})}
                    placeholder="Enter customer name"
                    className="input-field"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Phone Number</label>
                  <input
                    value={fullCustData.phone}
                    onFocus={() => { if(!fullCustData.phone) setFullCustData({...fullCustData, phone: '+91 '}); }}
                    onChange={e => {
                      let v = e.target.value;
                      if (/^\d{10}$/.test(v)) v = `+91 ${v}`;
                      else if (!v.startsWith('+91') && v !== '' && v !== '+') {
                        const digits = v.replace(/[^\d]/g, '');
                        v = digits.startsWith('91') ? `+91 ${digits.slice(2)}` : `+91 ${digits}`;
                      }
                      setFullCustData({...fullCustData, phone: v});
                    }}
                    placeholder="+91 9876543210"
                    className="input-field"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Type</label>
                  <select
                    value={fullCustData.customerType}
                    onChange={e => setFullCustData({...fullCustData, customerType: e.target.value})}
                    className="input-field"
                  >
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Email Address</label>
                  <input
                    type="email"
                    value={fullCustData.email}
                    onChange={e => setFullCustData({...fullCustData, email: e.target.value})}
                    placeholder="customer@email.com"
                    className="input-field"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">GSTIN (Optional)</label>
                  <input
                    value={fullCustData.gstin}
                    onChange={e => setFullCustData({...fullCustData, gstin: e.target.value.toUpperCase()})}
                    placeholder="22AAAAA0000A1Z5"
                    className="input-field uppercase"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Address / Location</label>
                  <input
                    value={fullCustData.address.line1}
                    onChange={e => setFullCustData({...fullCustData, address: {...fullCustData.address, line1: e.target.value}})}
                    placeholder="House name, Street..."
                    className="input-field mb-2"
                  />
                  <input
                    value={fullCustData.address.city}
                    onChange={e => setFullCustData({...fullCustData, address: {...fullCustData.address, city: e.target.value}})}
                    placeholder="City / Town"
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-800 flex gap-3">
              <button
                onClick={() => setShowFullCustModal(false)}
                className="flex-1 py-3 rounded-2xl bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!fullCustData.name.trim()) { toast.error('Name is required'); return; }
                  try {
                    let ph = fullCustData.phone || '';
                    if (ph) {
                      const digits = ph.replace(/[^\d]/g, '');
                      if (digits.length === 10) ph = `+91${digits}`;
                      else if (digits.length === 12 && digits.startsWith('91')) ph = `+${digits}`;
                    }
                    
                    const res = await import('@/lib/api').then(m => m.default.post('/customers', {
                      ...fullCustData,
                      phone: ph
                    }));
                    
                    const saved = res.data?.data?.customer;
                    if (saved) {
                      setCustomers(prev => [saved, ...prev]);
                      selectCustomer(saved);
                      setShowFullCustModal(false);
                      toast.success(`✅ Customer "${saved.name}" saved!`);
                    }
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || 'Failed to save customer');
                  }
                }}
                className="flex-[2] py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition-all shadow-lg shadow-amber-600/20"
              >
                Save & Select Customer
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Search + Customer */}
            <div className="p-4 border-b border-stone-100 dark:border-stone-800 space-y-2">
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    ref={searchRef}
                    id="product-search"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search product by name, SKU or barcode... (F2)"
                    className="input-field pl-10 pr-8 py-3 text-base w-full"
                    autoFocus
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {/* Barcode Scan Button */}
                <button
                  id="barcode-scan-btn"
                  onClick={startScanner}
                  title="Scan barcode with camera"
                  className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95"
                >
                  <Scan className="w-4 h-4" />
                  <span className="hidden sm:inline">Scan</span>
                </button>
              </div>
            </div>

            {/* ── Barcode Scanner Modal ── */}
            {scannerOpen && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-stone-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-stone-700">
                    <div className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-amber-400" />
                      <span className="font-bold text-white">Scan Barcode</span>
                    </div>
                    <button onClick={stopScanner} className="text-stone-400 hover:text-white transition-colors">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    {scannerError ? (
                      <div className="text-center py-6">
                        <p className="text-4xl mb-3">📷</p>
                        <p className="text-red-400 text-sm font-medium">{scannerError}</p>
                        <button onClick={stopScanner} className="mt-4 px-4 py-2 bg-stone-700 text-white rounded-xl text-sm">Close</button>
                      </div>
                    ) : (
                      <>
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                          {/* Scan frame overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-52 h-32 border-2 border-amber-400 rounded-xl relative">
                              <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                              <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                              <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                              {/* Animated scan line */}
                              <div className="absolute left-1 right-1 h-0.5 bg-amber-400/80 animate-bounce top-1/2" style={{animationDuration:'1.5s'}} />
                            </div>
                          </div>
                        </div>
                        <p className="text-stone-400 text-xs text-center">Point camera at product barcode — it will auto-detect</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex gap-1.5 px-4 py-2.5 border-b border-stone-100 dark:border-stone-800 overflow-x-auto scrollbar-none flex-shrink-0">
              {derivedCategories.map((cat) => (
                <button
                  key={cat}
                  id={`cat-${cat.toLowerCase()}`}
                  onClick={() => setActiveCategory(cat)}
                  className={clsx(
                    'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
                    activeCategory === cat
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>


            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 pb-28 lg:pb-4 pos-scrollbar">

              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="font-semibold text-stone-500">No products found</p>
                  <p className="text-stone-400 text-sm mt-1">Try a different search or category</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((p) => {
                    const badge = stockBadge(p);
                    const isOut = p.stock.current <= 0;
                    const inCart = cart.find((i) => i.product._id === p._id);
                    return (
                      <button
                        key={p._id}
                        id={`product-${p._id}`}
                        onClick={() => handleAddToCart(p)}
                        disabled={isOut}
                        className={clsx(
                          'product-tile relative flex flex-col items-center text-center p-4 rounded-3xl border-2 transition-all',
                          isOut
                            ? 'border-stone-200 dark:border-stone-700 opacity-40 cursor-not-allowed'
                            : inCart
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md shadow-amber-200 dark:shadow-amber-900/20'
                            : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-amber-400 hover:bg-amber-50/50 shadow-sm'
                        )}
                      >
                        {inCart && (
                          <div className="absolute top-2 right-2 w-7 h-7 bg-amber-600 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-md">
                            {inCart.quantity}
                          </div>
                        )}
                        <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl mb-2 overflow-hidden bg-amber-50/50 dark:bg-amber-900/20 flex-shrink-0 shadow-inner">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{p.emoji || '🥖'}</span>
                          )}
                        </div>
                        <p className="text-sm font-extrabold text-stone-800 dark:text-stone-100 leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                        <div className="flex items-center justify-center gap-1.5 flex-wrap mt-1">
                          <p className="text-base font-black text-amber-700 dark:text-amber-400">₹{p.sellingPrice}</p>
                          {p.mrp > 0 && p.mrp > p.sellingPrice && (
                            <span className="text-xs text-stone-400 line-through">₹{p.mrp}</span>
                          )}
                        </div>
                        {(p.discount ?? 0) > 0 && (
                          <span className="text-[10px] font-black bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                            -{p.discount}% OFF
                          </span>
                        )}
                        <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full mt-1 shadow-sm', badge.cls)}>{badge.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Bill Panel ── */}
          <div className={clsx(
            "lg:w-2/5 flex flex-col bg-amber-50 dark:bg-stone-950 min-h-0 overflow-hidden border-l border-amber-200 dark:border-stone-700",
            mobileView === 'cart' ? 'flex-1' : 'hidden lg:flex'
          )}>

            {/* Bill Header */}
            <div className="px-5 py-3 border-b border-amber-200 dark:border-stone-800 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                <h2 className="font-bold text-stone-800 dark:text-stone-100 truncate max-w-[140px]">{tab?.label ?? 'Current Bill'}</h2>
                {totals.items > 0 && (
                  <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                    {totals.items} items
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Voice mute button */}
                <VoiceMuteButton />
                {/* GST Toggle */}
                <button
                  id="gst-toggle"
                  onClick={() => setGstEnabled(!gstEnabled)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                    gstEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                      : 'bg-stone-200 dark:bg-stone-700 text-stone-500 border-stone-300 dark:border-stone-600'
                  )}
                >
                  {gstEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  GST {gstEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Customer search + phone */}
            <div className="px-4 py-2 border-b border-amber-100 dark:border-stone-800 space-y-2 flex-shrink-0">
              {/* Customer autocomplete */}
              <div ref={custRef} className="relative">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="customer-name"
                      type="text"
                      value={custSearch || customerName}
                      onChange={e => { setCustSearch(e.target.value); setCustomerName(e.target.value); setShowCustDrop(true); }}
                      onFocus={() => setShowCustDrop(true)}
                      placeholder="Customer name / search..."
                      className="input-field text-xs py-2 pr-8 w-full"
                      autoComplete="off"
                    />
                    {(custSearch || customerName) && (
                      <button onClick={() => { setCustSearch(''); setCustomerName(''); setCustomerPhone(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Dropdown */}
                {showCustDrop && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-stone-800 rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 overflow-hidden max-h-48 overflow-y-auto">
                    {customers
                      .filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || (c.phone || '').includes(custSearch))
                      .slice(0, 8)
                      .map(c => (
                        <button key={c._id} onMouseDown={() => selectCustomer(c)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-stone-700 text-left transition-colors">
                          <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400 flex-shrink-0">
                            {c.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{c.name}</p>
                            {c.phone && <p className="text-xs text-stone-400">{c.phone}</p>}
                          </div>
                          {c.creditBalance > 0 && <span className="text-[10px] text-red-500 font-bold">₹{c.creditBalance} due</span>}
                        </button>
                      ))}
                    
                    {/* Quick add customer button */}
                    {custSearch && (
                      <div className="p-1 border-t border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50">
                        <button
                          onMouseDown={async () => {
                            if (!custSearch.trim()) return;
                            try {
                              let ph = customerPhone || '';
                              if (ph) {
                                const digits = ph.replace(/[^\d]/g, '');
                                if (digits.length === 10) ph = `+91${digits}`;
                                else if (digits.length === 12 && digits.startsWith('91')) ph = `+${digits}`;
                              }
                              
                              const res = await import('@/lib/api').then(m => m.default.post('/customers', {
                                name: custSearch.trim(),
                                phone: ph,
                              }));
                              const saved = res.data?.data?.customer;
                              if (saved) {
                                setCustomers(prev => [saved, ...prev]);
                                selectCustomer(saved);
                                toast.success(`✅ Customer "${custSearch}" saved!`);
                              }
                            } catch {
                              setCustomerName(custSearch);
                              setShowCustDrop(false);
                            }
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Quick Add "{custSearch}"
                        </button>
                        <button
                          onMouseDown={() => {
                            setFullCustData({ ...fullCustData, name: custSearch, phone: customerPhone });
                            setShowFullCustModal(true);
                            setShowCustDrop(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Add with Full Details
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                id="customer-phone"
                type="tel"
                value={customerPhone}
                onFocus={handlePhoneFocus}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="📱 Phone number (auto-WhatsApp)"
                className="input-field text-xs py-2"
              />
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto min-h-0 pos-scrollbar">

              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
                  <div className="w-20 h-20 bg-amber-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-4 text-4xl">🛒</div>
                  <p className="font-semibold text-stone-600 dark:text-stone-300">Cart is empty</p>
                  <p className="text-stone-400 text-sm mt-1">Click a product to add it to <strong>{tab?.label}</strong></p>
                  <p className="text-xs text-stone-400 mt-3 bg-stone-200 dark:bg-stone-800 px-3 py-1.5 rounded-lg font-mono">
                    F2 — Search &middot; F10 — Save &amp; Print
                  </p>
                </div>
              ) : (
                <div className="px-3 py-3 space-y-2">
                  {cart.map((item) => {
                    const gross = item.rate * item.quantity;
                    const tax = gstEnabled ? (gross * item.taxRate) / 100 : 0;
                    const total = gross + tax;
                    return (
                      <div key={item.product._id} className="bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
                        {/* Top row: name + remove */}
                        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-lg">
                            {item.product.images?.[0] ? (
                              <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{item.product.emoji || '🥖'}</span>
                            )}
                          </div>
                          <p className="flex-1 text-sm font-bold text-stone-800 dark:text-stone-100 truncate">{item.product.name}</p>
                          <button onClick={() => removeItem(tabId, item.product._id)}
                            className="text-stone-300 hover:text-red-500 transition-colors flex-shrink-0"
                            id={`remove-${item.product._id}`}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Price + Discount row */}
                        <div className="flex items-center gap-2 px-3 pb-1">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">₹{item.rate}/{item.product.unit}</span>
                          {item.product.mrp > 0 && item.product.mrp > item.rate && (
                            <span className="text-[10px] text-stone-400 line-through">₹{item.product.mrp}</span>
                          )}
                          {(item.product.discount ?? 0) > 0 && (
                            <span className="text-[10px] font-black bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                              -{item.product.discount}% OFF
                            </span>
                          )}
                        </div>
                        {/* Bottom row: qty controls + total */}
                        <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
                          {/* Qty controls */}
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleUpdateQty(item.product._id, item.quantity - 1)}
                              className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-700 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                              id={`minus-${item.product._id}`}>
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input type="number" value={item.quantity}
                              onChange={e => handleUpdateQty(item.product._id, parseInt(e.target.value) || 1)}
                              className="w-10 text-center text-sm font-bold bg-transparent text-stone-800 dark:text-stone-100 outline-none border-b border-stone-200 dark:border-stone-600" min={1} />
                            <button onClick={() => handleUpdateQty(item.product._id, item.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-700 flex items-center justify-center hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                              id={`plus-${item.product._id}`}>
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Total + savings */}
                          <div className="text-right flex-shrink-0 min-w-[70px]">
                            <p className="text-base font-extrabold text-amber-700 dark:text-amber-400">₹{total.toFixed(0)}</p>
                            {gstEnabled && tax > 0 && <p className="text-[10px] text-stone-400">+₹{tax.toFixed(0)} GST</p>}
                            {item.product.mrp > 0 && item.product.mrp > item.rate && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                Save ₹{((item.product.mrp - item.rate) * item.quantity).toFixed(0)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bill Summary + Actions */}
            {cart.length > 0 && (
              <div className="border-t border-amber-200 dark:border-stone-800 p-3 pb-28 lg:pb-3 space-y-2 flex-shrink-0">
                {/* Discount */}
                <input type="number" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="Discount (₹)" className="input-field text-xs py-1.5" id="invoice-discount" />

                {/* Totals */}
                <div className="bg-white dark:bg-stone-800 rounded-2xl p-3 space-y-1.5 border border-stone-200 dark:border-stone-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Subtotal</span>
                    <span className="font-medium text-stone-700 dark:text-stone-300">₹{totals.subtotal.toFixed(2)}</span>
                  </div>
                  {gstEnabled && totals.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">GST</span>
                      <span className="font-medium text-stone-700 dark:text-stone-300">+₹{totals.tax.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span>-₹{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-stone-100 dark:border-stone-700 pt-2 flex justify-between">
                    <span className="font-bold text-stone-800 dark:text-stone-100">Grand Total</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-xl">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button key={m.id} id={`pay-${m.id}`} onClick={() => setPaymentMethod(m.id)}
                        className={clsx('flex flex-col items-center gap-0.5 p-1.5 rounded-xl border-2 transition-all text-[10px] font-semibold',
                          paymentMethod === m.id
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:border-amber-300 dark:bg-stone-800'
                        )}>
                        <Icon className="w-3.5 h-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {/* Amount Received */}
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-medium text-stone-500 whitespace-nowrap">Received(₹)</label>
                    <input id="amount-paid" type="number" value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={`${grandTotal.toFixed(0)}`}
                      className="input-field text-sm font-bold py-1 min-w-0" />
                  </div>
                  {parseFloat(amountPaid) > grandTotal && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium text-right">
                      Change: ₹{change.toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5">
                  <button
                    id="save-print-btn"
                    onClick={() => handleSave(true)}
                    disabled={cart.length === 0 || loading}
                    className="w-full flex items-center justify-between px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-500/20"
                  >
                    <span className="flex items-center gap-2">
                      <Printer className="w-4 h-4" />
                      {loading ? 'Saving...' : 'Save & Print (F10)'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="save-only-btn"
                      onClick={handleSaveOnly}
                      disabled={cart.length === 0 || loading}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-stone-700 hover:bg-stone-600 dark:bg-stone-700 dark:hover:bg-stone-600 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all"
                    >
                      💾 Save Only
                    </button>
                    <button onClick={resetBill}
                      className="w-full btn-secondary text-xs py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      id="clear-cart-btn">
                      <Trash2 className="w-3.5 h-3.5" /> Clear Bill
                    </button>
                  </div>
                </div>
              </div>
            )}

            {lastOrder && cart.length === 0 && (
              <div className="border-t border-amber-200 dark:border-stone-800 p-4 pb-28 lg:pb-4 space-y-2 flex-shrink-0">
                <p className="text-xs font-semibold text-stone-500 text-center">✅ Bill <strong>{lastOrder.orderId}</strong> saved</p>
                {/* Removed auto-opened message. Show WhatsApp Send button explicitly */}
                <button
                  onClick={() => {
                    const msg = buildInvoiceMsg({
                      orderId: lastOrder.orderId,
                      customerName: lastOrder.customerName || 'Walk-in Customer',
                      grandTotal: lastOrder.grandTotal,
                      paymentMethod: lastOrder.paymentMethod,
                      items: lastOrder.items?.map((i: any) => ({ name: i.product?.name || i.name, qty: i.qty || i.quantity, rate: i.rate })),
                    });
                    openWhatsApp(lastOrder.customerPhone || '', msg);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-2xl font-semibold text-sm transition-all shadow-lg shadow-green-500/20 active:scale-[0.98]"
                  id="wa-invoice-btn"
                >
                  <MessageCircle className="w-4 h-4" />
                  Send Invoice via WhatsApp
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <a 
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/invoices/${lastOrder.invoiceId}/pdf?token=${localStorage.getItem('accessToken')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-semibold text-xs transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" /> A4 Print
                  </a>
                  <button onClick={() => window.print()} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold text-xs transition-all border border-stone-200">
                    <Printer className="w-3.5 h-3.5" /> Thermal
                  </button>
                </div>
                <button onClick={resetBill} className="w-full btn-secondary text-sm py-2.5">
                  🆕 New Bill
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
