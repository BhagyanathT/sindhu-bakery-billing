'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Printer, X, ChevronDown, ChevronUp, Copy, Edit2, Trash2, Calendar, FileSpreadsheet, Send, Upload, RefreshCw, TrendingUp, ShoppingBag, Tag, Zap, Loader2 } from 'lucide-react';
import { useProductStore, Order } from '@/store/productStore';
import { useBillingStore } from '@/store/billingStore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { openWhatsApp } from '@/lib/whatsapp';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const MONTH_START = `${TODAY.split('-')[0]}-${TODAY.split('-')[1]}-01`;

const QUICK_FILTERS = [
  { label: 'Today', start: TODAY, end: TODAY },
  { label: 'This Week', start: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })(), end: TODAY },
  { label: 'This Month', start: MONTH_START, end: TODAY },
  { label: 'All', start: '', end: '' },
];

export default function OrdersPage() {
  const { orders, fetchOrders, deleteOrder } = useProductStore();
  const { addTab, updateTab } = useBillingStore();
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(TODAY);
  const [endDate, setEndDate] = useState(TODAY);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [activeFilter, setActiveFilter] = useState('Today');
  const [expanded, setExpanded] = useState<string|null>(null);
  const [printTarget, setPrintTarget] = useState<Order|null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ totalAmount:0, totalOrders:0, avgOrderValue:0, totalDiscount:0 });
  const [loadingStats, setLoadingStats] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [showImport, setShowImport]   = useState(false);
  const [importJson, setImportJson]   = useState('');
  const [allImportRows, setAllImportRows] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken')||'' : '';

  const load = useCallback(async () => {
    let q = `?limit=50&page=${page}`;
    if (startDate) q += `&startDate=${startDate}`;
    if (endDate) q += `&endDate=${endDate}`;
    if (search) q += `&search=${encodeURIComponent(search)}`;
    if (paymentMethod) q += `&paymentMethod=${paymentMethod}`;

    let statsQuery = '';
    if (startDate || endDate || paymentMethod) {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (paymentMethod) params.append('paymentMethod', paymentMethod);
      statsQuery = `?${params.toString()}`;
    }

    setLoadingStats(true);
    const [result] = await Promise.all([
      fetchOrders(q),
      api.get(`/invoices/period-stats${statsQuery}`)
        .then(res => {
          if (res.data?.success) {
            const d = res.data.data;
            setStats({ totalAmount: d.totalAmount, totalOrders: d.totalOrders, avgOrderValue: d.avgOrderValue, totalDiscount: d.totalDiscount });
            setTotalCount(d.totalOrders);
            setTotalPages(Math.ceil(d.totalOrders / 50));
          }
        })
        .catch(() => {})
        .finally(() => setLoadingStats(false)),
    ]);
    // fallback pagination from fetchOrders
    if (result.total > 0 && stats.totalOrders === 0) {
      setTotalCount(result.total);
      setTotalPages(result.pages);
    }
  }, [fetchOrders, startDate, endDate, search, page, paymentMethod]);


  useEffect(() => { load(); }, [load]);

  const applyQuick = (f: typeof QUICK_FILTERS[0]) => {
    setActiveFilter(f.label);
    setStartDate(f.start);
    setEndDate(f.end);
    setPage(1);
  };

  const filtered = search
    ? orders.filter(o => o.orderId.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase()))
    : orders;

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this bill? Stock will be restored.')) return;
    const ok = await deleteOrder(id);
    if (ok) { toast.success('Deleted!'); load(); }
  };

  const handlePrint = (order: Order) => {
    setPrintTarget(order);
    setTimeout(() => { window.print(); setPrintTarget(null); }, 300);
  };

  const handleDuplicate = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const id = addTab();
    updateTab(id, {
      cart: order.items.map(i => ({ product: { _id: i.product?._id||`t-${Date.now()}`, name: i.name, unit:'pcs', images:[] }, quantity:i.qty, rate:i.rate, taxRate:i.taxRate||0 })) as any,
      customerName: order.customerName, customerPhone: order.customerPhone||'', discount: order.discount,
      paymentMethod: order.paymentMethod as any, label:`Copy ${order.orderId}`,
    });
    toast.success('Duplicated!'); router.push('/billing');
  };

  const handleEdit = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!confirm('Load into POS for editing?')) return;
    const id = addTab();
    updateTab(id, {
      cart: order.items.map(i => ({ product:{ _id:i.product?._id||`t-${Date.now()}`, name:i.name, unit:'pcs', images:[] }, quantity:i.qty, rate:i.rate, taxRate:i.taxRate||0 })) as any,
      customerName:order.customerName, customerPhone:order.customerPhone||'', discount:order.discount,
      paymentMethod:order.paymentMethod as any, label:`Edit ${order.orderId}`, editOrderId:order.id,
    });
    router.push('/billing');
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      // Fetch ALL orders (no pagination) for the selected date range
      let q = `?limit=10000&page=1`;
      if (startDate) q += `&startDate=${startDate}`;
      if (endDate)   q += `&endDate=${endDate}`;
      if (search)    q += `&search=${encodeURIComponent(search)}`;
      if (paymentMethod) q += `&paymentMethod=${paymentMethod}`;

      const res = await api.get(`/invoices${q}`);
      const allInvoices: any[] = res.data?.data?.invoices || [];

      if (allInvoices.length === 0) { toast.error('No orders to export'); return; }

      const data = allInvoices.map((inv: any) => ({
        'Date'        : new Date(inv.date || inv.createdAt).toLocaleDateString('en-IN'),
        'Time'        : new Date(inv.date || inv.createdAt).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }),
        'Bill No'     : inv.invoiceNumber || inv._id,
        'Customer'    : inv.customerName || 'Walk-in',
        'Phone'       : inv.customerPhone || '',
        'Payment'     : (inv.payments?.[0]?.method || 'cash').toUpperCase(),
        'Subtotal'    : inv.subtotal || 0,
        'Discount'    : inv.totalDiscount || 0,
        'GST'         : inv.totalTax || 0,
        'Grand Total' : inv.grandTotal || 0,
        'Items Count' : inv.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0,
        'Status'      : inv.paymentStatus || 'paid',
      }));

      // Add summary row at bottom
      const totalRow = {
        'Date': '', 'Time': '', 'Bill No': `TOTAL (${data.length} bills)`,
        'Customer': '', 'Phone': '', 'Payment': '',
        'Subtotal'    : data.reduce((s, r) => s + r['Subtotal'], 0),
        'Discount'    : data.reduce((s, r) => s + r['Discount'], 0),
        'GST'         : data.reduce((s, r) => s + r['GST'], 0),
        'Grand Total' : data.reduce((s, r) => s + r['Grand Total'], 0),
        'Items Count' : data.reduce((s, r) => s + r['Items Count'], 0),
        'Status': '',
      };
      data.push(totalRow);

      const ws = XLSX.utils.json_to_sheet(data);
      // Auto column widths
      ws['!cols'] = [8,6,12,18,12,8,10,10,8,12,10,8].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      const sheetName = startDate === endDate && startDate ? startDate : (startDate ? `${startDate}_to_${endDate}` : 'All_Orders');
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      XLSX.writeFile(wb, `sindhu_bakery_orders_${sheetName}.xlsx`);
      toast.success(`✅ Exported ${allInvoices.length} orders to Excel`);
    } catch (e: any) {
      toast.error('Export failed: ' + (e.message || 'Unknown error'));
    } finally { setExporting(false); }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      if (rows.length === 0) { toast.error('File is empty or has no rows'); return; }
      setAllImportRows(rows);                              // store ALL rows for import
      setImportJson(JSON.stringify(rows.slice(0, 5), null, 2)); // preview first 5
      setShowImport(true);
    } catch (err: any) {
      toast.error('Could not read file: ' + err.message);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const doImport = async () => {
    const toImport = allImportRows.length > 0 ? allImportRows : (() => { try { return JSON.parse(importJson); } catch { return []; } })();
    if (!toImport || toImport.length === 0) { toast.error('No data to import'); return; }
    setImporting(true);
    try {
      const res = await api.post('/invoices/bulk-import', { orders: toImport });
      const d = res.data.data;
      if (d.imported > 0) toast.success(`✅ Imported ${d.imported}/${d.total} orders`);
      if (d.failed > 0) {
        const firstErr = d.errors?.[0];
        toast.error(`${d.failed} rows failed${firstErr ? `: Row ${firstErr.row} — ${firstErr.error}` : ''}`);
      }
      setShowImport(false); setImportJson(''); setAllImportRows([]); load();
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Import failed';
      toast.error('Import error: ' + msg);
    } finally { setImporting(false); }
  };

  const PM_COLORS: Record<string,string> = { cash:'bg-amber-100 text-amber-700', upi:'bg-emerald-100 text-emerald-700', card:'bg-indigo-100 text-indigo-700', credit:'bg-red-100 text-red-600' };

  return (
    <>
      <style>{`@media print{body{visibility:hidden;background:white;margin:0;padding:0;}#order-receipt{visibility:visible!important;display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;max-width:80mm!important;margin:0 auto!important;padding:0!important;color:#000!important;background:#fff!important}#order-receipt *{visibility:visible!important;color:#000!important}.no-print{display:none!important}@page{margin:0;size:auto;}}`}</style>

      {/* Hidden thermal receipt */}
      {printTarget && (
        <div id="order-receipt" style={{display:'none',fontFamily:'monospace',fontSize:'14px',padding:'8px',width:'100%',maxWidth:'80mm',margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:'8px'}}>
            <img src="/logo.jpg" alt="Logo" style={{width:'20mm',margin:'0 auto 6px',display:'block',filter:'grayscale(1) contrast(1.5)'}} />
            <div style={{fontSize:'18px',fontWeight:'bold'}}>Sindhu Bakery</div>
            <div>Marayamuttam, Thiruvananthapuram</div>
            <div>Ph: 9544208030, 6238442987</div>
            <div style={{borderTop:'1px dashed #000',margin:'5px 0'}} />
            <div>Bill No: <strong>{printTarget.orderId}</strong></div>
            <div>Customer: <strong>{printTarget.customerName}</strong></div>
            <div>{new Date(printTarget.date).toLocaleDateString('en-IN')} {new Date(printTarget.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <div style={{borderTop:'1px dashed #000',marginBottom:'6px'}} />
          {printTarget.items.map((item,i) => {
            const mrp = (item as any).mrp || 0;
            const discPct = (item as any).discount || (mrp > 0 && item.rate > 0 ? Math.round(((mrp - item.rate) / mrp) * 100) : 0);
            return (
              <div key={i} style={{marginBottom:'5px'}}>
                <div style={{fontWeight:'bold'}}>{item.name}</div>
                {mrp > 0 && mrp > item.rate && (
                  <div style={{fontSize:'11px',color:'#777'}}>
                    MRP: <span style={{textDecoration:'line-through'}}>₹{mrp}</span>
                    {discPct > 0 && <span style={{marginLeft:'5px',fontWeight:'bold',color:'#c00'}}>({discPct}% OFF)</span>}
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span>₹{item.rate} × {item.qty} {discPct > 0 && mrp <= 0 ? `(${discPct}% off)` : ''}</span>
                  <span>₹{item.total.toFixed(0)}</span>
                </div>
              </div>
            );
          })}
          <div style={{borderTop:'1px dashed #000',margin:'5px 0'}} />
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span>Items ({printTarget.items.reduce((s,i)=>s+i.qty,0)} qty)</span>
            <span>₹{printTarget.subtotal.toFixed(2)}</span>
          </div>
          {printTarget.gst>0 && <div style={{display:'flex',justifyContent:'space-between'}}><span>GST</span><span>₹{printTarget.gst.toFixed(2)}</span></div>}
          {printTarget.discount>0 && <div style={{display:'flex',justifyContent:'space-between',color:'green'}}><span>Discount Savings</span><span>-₹{printTarget.discount.toFixed(2)}</span></div>}
          {(() => {
            const mrpSavings = printTarget.items.reduce((s,item)=>{
              const mrp = (item as any).mrp||0;
              return mrp>item.rate ? s+(mrp-item.rate)*item.qty : s;
            },0);
            const totalSavings = mrpSavings + (printTarget.discount||0);
            return totalSavings > 0 ? (
              <div style={{display:'flex',justifyContent:'space-between',color:'#006600',fontSize:'12px'}}><span>You Saved</span><span>₹{totalSavings.toFixed(2)}</span></div>
            ) : null;
          })()}
          <div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold',fontSize:'16px',borderTop:'1px solid #000',paddingTop:'4px',marginTop:'4px'}}><span>TOTAL</span><span>₹{printTarget.grandTotal.toFixed(2)}</span></div>
          <div>Payment: {(printTarget.paymentMethod||'CASH').toUpperCase()}</div>
          <div style={{textAlign:'center',marginTop:'10px',borderTop:'1px dashed #000',paddingTop:'6px'}}>Thank you! Visit again 🙏</div>
        </div>
      )}

      <div className="space-y-4 no-print">
        {/* Header */}
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-600" /> Order History
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              {loadingStats ? '...' : `${stats.totalOrders} bills`}
              {(startDate||endDate) && ` · ${startDate||'start'} → ${endDate||'today'}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={load} className="btn-icon" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
            {isAdmin && (
              <>
                <button onClick={exportExcel} disabled={exporting} className="btn-secondary h-9 px-3 flex items-center gap-1.5 text-sm disabled:opacity-60">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                  <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Excel'}</span>
                </button>
                <label className="btn-secondary h-9 px-3 flex items-center gap-1.5 text-sm cursor-pointer">
                  <Upload className="w-4 h-4 text-blue-600" /><span className="hidden sm:inline">Import</span>
                  <input ref={fileRef} type="file" accept=".xlsx,.csv,.json" className="hidden" onChange={handleFileImport} />
                </label>
                <button onClick={() => openWhatsApp('', `📊 *Sindhu Bakery Sales*\n${startDate||'All'} → ${endDate||'Today'}\n🧾 Orders: ${stats.totalOrders}\n💰 Revenue: ₹${stats.totalAmount.toLocaleString('en-IN')}`)}
                  className="btn-secondary h-9 px-3 flex items-center gap-1.5 text-sm bg-emerald-50 border-emerald-200 text-emerald-700">
                  <Send className="w-4 h-4" /><span className="hidden sm:inline">Share</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards — admin sees all 4, staff sees only Total Bills */}
        <div className={clsx("grid gap-3", isAdmin ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
          {(isAdmin ? [
            { label:'Total Revenue', value:`₹${stats.totalAmount.toLocaleString('en-IN')}`, icon:<TrendingUp className="w-4 h-4"/>, color:'text-green-600', bg:'bg-green-50 dark:bg-green-900/20' },
            { label:'Total Bills', value:stats.totalOrders, icon:<ShoppingBag className="w-4 h-4"/>, color:'text-blue-600', bg:'bg-blue-50 dark:bg-blue-900/20' },
            { label:'Avg Bill Value', value:`₹${stats.avgOrderValue.toLocaleString('en-IN')}`, icon:<Zap className="w-4 h-4"/>, color:'text-amber-600', bg:'bg-amber-50 dark:bg-amber-900/20' },
            { label:'Total Discount', value:`₹${Math.round(stats.totalDiscount).toLocaleString('en-IN')}`, icon:<Tag className="w-4 h-4"/>, color:'text-purple-600', bg:'bg-purple-50 dark:bg-purple-900/20' },
          ] : [
            { label:'Total Bills', value:stats.totalOrders, icon:<ShoppingBag className="w-4 h-4"/>, color:'text-blue-600', bg:'bg-blue-50 dark:bg-blue-900/20' },
          ]).map(c => (
            <div key={c.label} className={clsx('rounded-2xl p-3 border border-stone-200 dark:border-stone-700 flex items-center gap-3', c.bg)}>
              <div className={clsx('p-2 rounded-xl bg-white dark:bg-stone-800 shadow-sm', c.color)}>{c.icon}</div>
              <div><p className="text-xs text-stone-500">{c.label}</p><p className={clsx('font-black text-sm', c.color)}>{c.value}</p></div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-3 space-y-3">
          {/* Quick filters */}
          <div className="flex gap-2 flex-wrap">
            {QUICK_FILTERS.map(f => (
              <button key={f.label} onClick={() => applyQuick(f)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                  activeFilter===f.label ? 'bg-amber-600 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-200')}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Date + Search */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search bill / customer..." className="input-field pl-9 py-2" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"><X className="w-3.5 h-3.5"/></button>}
            </div>
            {isAdmin && (
              <select 
                value={paymentMethod} 
                onChange={e => { setPaymentMethod(e.target.value); setPage(1); }} 
                className="input-field py-2 w-auto"
              >
                <option value="">All Payments</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="credit">Credit</option>
              </select>
            )}
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveFilter('Custom'); setPage(1); }} className="input-field py-2 w-auto" />
              <span className="text-stone-400 text-sm">–</span>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveFilter('Custom'); setPage(1); }} className="input-field py-2 w-auto" />
            </div>
          </div>
        </div>

        {/* Orders list */}
        {filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-4xl mb-3">🧾</p>
            <p className="font-semibold text-stone-500">{orders.length===0 ? 'No orders found' : 'No orders match your filter'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(order => (
              <div key={order.id} className="card overflow-hidden">
                <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-stone-50 dark:hover:bg-stone-700/30"
                  onClick={() => setExpanded(expanded===order.id ? null : order.id)}>
                  <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-lg flex-shrink-0">🧾</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{order.orderId}</p>
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded font-bold uppercase', PM_COLORS[order.paymentMethod]||'bg-stone-100 text-stone-600')}>
                        {order.paymentMethod||'cash'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5 truncate">
                      {order.customerName} · {new Date(order.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} {new Date(order.date).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
                    </p>
                    {order.notes && (
                      <p className="text-xs text-stone-500 font-medium truncate mt-0.5">
                        📝 {order.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-amber-700 dark:text-amber-400">₹{order.grandTotal.toFixed(0)}</p>
                    {!order.orderId.startsWith('QB-') && (
                      <p className="text-xs text-stone-400">{order.items.length} item{order.items.length!==1?'s':''}</p>
                    )}
                  </div>
                  {expanded===order.id ? <ChevronUp className="w-4 h-4 text-stone-400 shrink-0"/> : <ChevronDown className="w-4 h-4 text-stone-400 shrink-0"/>}
                </button>

                {expanded===order.id && (
                  <div className="border-t border-stone-200 dark:border-stone-700 p-4 space-y-3 bg-stone-50 dark:bg-stone-800/50">
                    {/* Items */}
                    <div className="space-y-1.5">
                      {order.items.map((item,i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-stone-700 dark:text-stone-300">{item.name}</span>
                          <span className="text-stone-500">₹{item.rate} × {item.qty} = <strong className="text-stone-700 dark:text-stone-200">₹{item.total.toFixed(0)}</strong></span>
                        </div>
                      ))}
                    </div>
                    {/* Totals */}
                    <div className="border-t border-stone-200 dark:border-stone-700 pt-2 space-y-1 text-sm">
                      <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
                      {order.gst>0 && <div className="flex justify-between text-stone-500"><span>GST</span><span>+₹{order.gst.toFixed(2)}</span></div>}
                      {order.discount>0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-₹{order.discount.toFixed(2)}</span></div>}
                      <div className="flex justify-between font-bold text-base pt-1 border-t border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100">
                        <span>Grand Total</span><span>₹{order.grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={() => handlePrint(order)} className="flex items-center gap-1.5 px-3 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 rounded-xl text-xs font-bold">
                        <Printer className="w-3.5 h-3.5"/> Thermal
                      </button>
                      <a href={`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000/api'}/invoices/${order.id}/pdf?token=${token}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold">
                        <Printer className="w-3.5 h-3.5"/> A4
                      </a>
                      {order.customerPhone && (
                        <button onClick={() => openWhatsApp(order.customerPhone!, `🧾 *Invoice - Sindhu Bakery*\nBill: *${order.orderId}*\nCustomer: *${order.customerName}*\n💰 Total: ₹${order.grandTotal.toFixed(2)}\nPayment: ${(order.paymentMethod||'cash').toUpperCase()}\nThank you! 🙏`)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold">
                          <Send className="w-3.5 h-3.5"/> WA
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button onClick={e => handleDuplicate(e,order)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 text-blue-700 dark:text-blue-400 rounded-xl text-xs font-bold">
                            <Copy className="w-3.5 h-3.5"/> Duplicate
                          </button>
                          <button onClick={e => handleEdit(e,order)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold">
                            <Edit2 className="w-3.5 h-3.5"/> Edit
                          </button>
                          <button onClick={e => handleDelete(e,order.id)} className="flex items-center gap-1.5 px-3 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold ml-auto">
                            <Trash2 className="w-3.5 h-3.5"/> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-2">
                <button disabled={page===1} onClick={() => setPage(p => Math.max(1,p-1))}
                  className="px-4 py-2 bg-stone-200 dark:bg-stone-700 rounded-xl text-sm font-bold disabled:opacity-40">← Prev</button>
                <span className="text-sm text-stone-500">Page {page} of {totalPages}</span>
                <button disabled={page>=totalPages} onClick={() => setPage(p => p+1)}
                  className="px-4 py-2 bg-stone-200 dark:bg-stone-700 rounded-xl text-sm font-bold disabled:opacity-40">Next →</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-stone-800 dark:text-stone-100">📥 Import Old Orders</h2>
                {allImportRows.length > 0 && (
                  <p className="text-xs text-emerald-600 font-semibold mt-0.5">✅ {allImportRows.length} rows ready to import</p>
                )}
              </div>
              <button onClick={() => { setShowImport(false); setAllImportRows([]); setImportJson(''); }} className="text-stone-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
                <p className="font-bold mb-1">📋 Supported columns in your Excel/CSV:</p>
                <p><code>date</code> · <code>customerName</code> · <code>grandTotal</code> · <code>paymentMethod</code> · <code>invoiceNumber</code> · <code>phone</code> · <code>discount</code></p>
              </div>
              <p className="text-xs text-stone-500">Preview of first 5 rows (all {allImportRows.length || '?'} rows will be imported):</p>
              <textarea value={importJson} onChange={e => setImportJson(e.target.value)}
                rows={7} className="input-field font-mono text-xs resize-none" placeholder='[{"date":"2024-01-01","customerName":"John","grandTotal":500,"paymentMethod":"cash"}]' />
              <div className="flex gap-3">
                <button onClick={() => { setShowImport(false); setAllImportRows([]); setImportJson(''); }} className="flex-1 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 font-bold text-sm">Cancel</button>
                <button onClick={doImport} disabled={importing || (allImportRows.length === 0 && !importJson)}
                  className="flex-[2] py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  {importing ? <><Loader2 className="w-4 h-4 animate-spin"/> Importing...</> : `📥 Import ${allImportRows.length > 0 ? allImportRows.length : ''} Orders`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
