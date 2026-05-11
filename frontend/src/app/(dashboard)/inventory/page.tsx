'use client';
// src/app/(dashboard)/inventory/page.tsx — Full Inventory Management + Excel Import
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, AlertTriangle, Package, Edit2, Trash2,
  RefreshCw, X, ChevronUp, ChevronDown, CheckCircle,
  Upload, Download, FileSpreadsheet, BarChart2, PieChart as PieIcon,
  Database, Info, MoreVertical, LayoutGrid, List as ListIcon, TrendingUp,
  ChevronLeft, ChevronRight, Scan, Tag, Percent, Camera
} from 'lucide-react';
import { useProductStore, Product } from '@/store/productStore';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';
import api from '@/lib/api';
import CategoryManagerModal from '@/components/CategoryManagerModal';
import { useAuthStore } from '@/store/authStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

const GST_SLABS = [0, 5, 12, 18, 28];
const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'm', 'dozens', 'pair'];
const CATEGORIES = ['Bakery', 'Beverages', 'Snacks', 'Dairy', 'Cakes', 'Other'];
const EMOJIS = ['🍞', '🥐', '🎂', '☕', '🥤', '🍪', '🧈', '🍰', '🧁', '🥛', '🍵', '🍔', '🥖', '🍩', '🍫', '🥧'];

const emptyForm = {
  name: '', sku: '', barcode: '', category: 'Bakery',
  sellingPrice: 0, mrp: 0, discount: 0, costPrice: 0,
  tax: { gstRate: 0 }, stock: { current: 0, minLevel: 5 },
  unit: 'pcs', images: [] as string[], emoji: '🍞',
};

// ── Import result type ─────────────────────────────────────────────────────
interface ImportResult {
  imported: number;
  skipped: number;
  skippedItems: { name: string; reason: string }[];
  categoriesCreated: number;
  categoriesReused: number;
  products: any[];
}

export default function InventoryPage() {
  const { products, addProduct, updateProduct, deleteProduct, adjustStock, stockLogs, setProducts, bulkAddProducts } = useProductStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterStock, setFilterStock] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stockType, setStockType] = useState<'add' | 'remove'>('add');
  const [showLogs, setShowLogs] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Excel import state ─────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [dbConnected, setDbConnected] = useState(true);
  const [categories, setCategories] = useState(CATEGORIES);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(-1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const importFileRef = useRef<HTMLInputElement>(null);

  // ── Barcode Scanner State ─────────────────────────────────────────────────
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);


  // ── Debounced search ─────────────────────────────────────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Data Sync ─────────────────────────────────────────────────────────────
  const fetchData = async () => {
    const stockParam = filterStock !== 'all' ? `&stock=${filterStock}` : '';
    // Products fetch
    try {
      const prodRes = await api.get(`/products?page=${page}&limit=${pageSize === -1 ? 0 : pageSize}&search=${debouncedSearch}&category=${filterCat === 'All' ? '' : filterCat}${stockParam}`);
      const isMock = prodRes.data?.data?.products?.[0]?._id?.startsWith('mock') || prodRes.data?.data?.products?.[0]?._id?.startsWith('local_');
      setDbConnected(!isMock);
      if (prodRes.data?.success && prodRes.data.data?.products) {
        const mapped: Product[] = prodRes.data.data.products.map((p: any) => ({
          _id: p._id,
          name: p.name,
          sku: p.sku || '',
          barcode: p.barcode || '',
          category: p.category?.name || p.category || '',
          sellingPrice: p.sellingPrice ?? 0,
          mrp: p.mrp ?? 0,
          discount: p.mrp > 0 && p.sellingPrice > 0
            ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100)
            : 0,
          costPrice: p.costPrice ?? 0,
          tax: { gstRate: p.tax?.gstRate ?? 0 },
          stock: { current: p.stock?.current ?? 0, minLevel: p.stock?.minLevel ?? 5 },
          unit: p.unit || 'pcs',
          images: p.images || [],
          salesCount: p.salesCount ?? 0,
          emoji: p.emoji || '🥖',
        }));
        setProducts(mapped);
        setTotalPages(prodRes.data.data.pages || 1);
        setTotalProducts(prodRes.data.data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setDbConnected(false);
    }
    // Stats fetch — independent so products still show even if stats fail
    try {
      const statsRes = await api.get('/products/stats');
      if (statsRes.data?.success) {
        setStats(statsRes.data.data);
        const uniqueCats = Array.from(new Set([...CATEGORIES, ...statsRes.data.data.categoryDistribution.map((c: any) => c.name)]));
        setCategories(uniqueCats);
      }
    } catch (statsErr) {
      console.warn('Stats fetch failed (non-critical):', statsErr);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, pageSize, filterCat, debouncedSearch, filterStock]);


  // ── Download blank template ────────────────────────────────────────────────
  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Item name*', 'SKU', 'Barcode', 'Sale price', 'MRP', 'Discount', 'Cost Price', 'Current stock quantity', 'Min Level', 'Category', 'Unit'],
      ['Sourdough Bread', 'B001', '8901234567890', 120, 150, 20, 90, 50, 10, 'Bakery', 'pcs'],
      ['Chocolate Cake', 'C001', '', 650, 800, 19, 450, 8, 2, 'Cakes', 'pcs'],
      ['Cappuccino', 'BEV01', '', 80, 100, 20, 40, 100, 20, 'Beverages', 'pcs'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'sindhu_bakery_import_template.xlsx');
  }, []);

  // ── Export to Excel — fetches ALL products from backend ─────────────────
  const exportToExcel = useCallback(async () => {
    toast.loading('📊 Preparing export...');
    try {
      let allProducts = products;
      // If DB is connected, fetch ALL
      if (dbConnected) {
        const res = await api.get('/products?page=1&limit=2000');

        if (res.data?.success && res.data.data?.products) {
          allProducts = res.data.data.products.map((p: any) => ({
            _id: p._id,
            name: p.name,
            sku: p.sku || '',
            category: p.category?.name || p.category || '',
            sellingPrice: p.sellingPrice ?? 0,
            costPrice: p.costPrice ?? 0,
            tax: { gstRate: p.tax?.gstRate ?? 0 },
            stock: { current: p.stock?.current ?? 0, minLevel: p.stock?.minLevel ?? 5 },
            unit: p.unit || 'pcs',
            images: p.images || [],
            salesCount: p.salesCount ?? 0,
            emoji: p.emoji || '🥖',
          }));
        }
      }

      if (allProducts.length === 0) { toast.dismiss(); toast.error('No products to export'); return; }

      const data = allProducts.map(p => ({
        'Item name*': p.name,
        'SKU': p.sku,
        'Barcode': (p as any).barcode || '',
        'Category': p.category,
        'Sale price': p.sellingPrice,
        'MRP': (p as any).mrp || '',
        'Discount %': (p as any).discount || '',
        'Cost price': p.costPrice,
        'Current stock quantity': p.stock.current,
        'Min Level': p.stock.minLevel,
        'Unit': p.unit,
        'GST %': p.tax.gstRate,
        'Sales Count': p.salesCount
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      XLSX.writeFile(wb, `sindhu_bakery_inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss();
      toast.success(`📊 Exported ${data.length} products!`);
    } catch (_err) {
      toast.dismiss();
      toast.error('Export failed. Please try again.');
    }
  }, [products, dbConnected]);

  // ── Clear All Products ─────────────────────────────────────────────────────
  const clearAllProducts = async () => {
    if (!confirm('🚨 CRITICAL: This will delete ALL products from your inventory.\n\nAre you absolutely sure?')) return;
    const pass = prompt('Type "DELETE ALL" to confirm:');
    if (pass !== 'DELETE ALL') { toast.error('Confirmation failed'); return; }

    try {
      await api.delete('/products/wipe-all');
      setProducts([]);
      toast.success('🗑️ Inventory cleared');
      fetchData();
    } catch (err) {
      toast.error('Failed to clear inventory');
    }

  };

  // ── Product Card Component ────────────────────────────────────────────────
  const ProductCard = ({ p, isSelected, onSelect, onEdit, onDelete, onAdjust }: any) => {
    const isLow = p.stock.current <= p.stock.minLevel && p.stock.current > 0;
    const isOut = p.stock.current === 0;

    return (
      <div className={clsx(
        'card p-4 flex flex-col gap-3 transition-all duration-300 group hover:shadow-xl hover:-translate-y-1',
        isSelected ? 'ring-2 ring-amber-500 bg-amber-50/30 dark:bg-amber-900/10' : 'bg-white dark:bg-stone-800',
        isOut && !isSelected && 'border-red-200 dark:border-red-900/50',
        isLow && !isOut && !isSelected && 'border-amber-200 dark:border-amber-900/50'
      )}>
        {/* Selection overlay */}
        <div className="flex items-start gap-3 relative">
          <div className="absolute -left-2 -top-2 z-10">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={onSelect}
              className="w-4 h-4 rounded border-stone-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
          </div>

          <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-stone-100 dark:bg-stone-700/50 flex items-center justify-center text-3xl shadow-inner">
            {p.images?.[0] ? (
              <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <span>{p.emoji || '🥖'}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <p className="font-black text-stone-800 dark:text-stone-100 text-sm leading-tight truncate">{p.name}</p>
              <span className={clsx('text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 uppercase tracking-tighter',
                isOut ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                isLow ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' :
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
              )}>
                {isOut ? 'Out' : isLow ? 'Low' : 'In Stock'}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5 font-medium">{p.category} · {p.unit}</p>
            <p className="text-[10px] font-mono text-stone-300 uppercase mt-0.5">{p.sku}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-lg font-black text-amber-700 dark:text-amber-400">₹{p.sellingPrice}</p>
              {p.mrp > 0 && p.mrp > p.sellingPrice && (
                <span className="text-[10px] text-stone-400 line-through">₹{p.mrp}</span>
              )}
              {p.discount > 0 && (
                <span className="text-[9px] font-black bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                  -{p.discount}%
                </span>
              )}
            </div>
            {p.barcode && (
              <p className="text-[9px] font-mono text-stone-300 dark:text-stone-600 flex items-center gap-1 mt-0.5">
                <Scan className="w-2.5 h-2.5" />{p.barcode}
              </p>
            )}
            <p className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3" /> {p.salesCount || 0} sold
            </p>
          </div>
          <div className="text-right">
            <p className={clsx("text-sm font-black", isOut ? "text-red-500" : isLow ? "text-amber-600" : "text-stone-700 dark:text-stone-200")}>
              {p.stock.current} {p.unit}
            </p>
            <p className="text-[10px] text-stone-400">Target: {p.stock.minLevel}</p>
          </div>
        </div>


        <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100 dark:border-stone-700/50">
          <button
            onClick={() => onAdjust('add')}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold hover:bg-emerald-100 transition-colors"
          >
            <ChevronUp className="w-3 h-3" /> Add
          </button>
          <button
            onClick={() => onAdjust('remove')}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold hover:bg-red-100 transition-colors"
          >
            <ChevronDown className="w-3 h-3" /> Remove
          </button>
          <button onClick={onEdit} className="p-2 text-stone-400 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-xl transition-all">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button onClick={onDelete} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };


  // Filtered products
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const matchCat = filterCat === 'All' || p.category === filterCat;
    const matchStock = filterStock === 'all' || (filterStock === 'low' && p.stock.current <= p.stock.minLevel) || (filterStock === 'out' && p.stock.current === 0);
    return matchSearch && matchCat && matchStock;
  });

  // Use backend stats for accurate counts across ALL pages
  const lowStockCount = stats?.lowStockCount ?? 0;
  const outOfStockCount = stats?.outOfStockCount ?? 0;

  const openAddModal = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setImagePreview(null);
    setShowScanner(false);
    setScannerError('');
    setShowModal(true);
  };

  const openEditModal = (p: Product) => {
    setEditing(p);
    setForm({
      ...p,
      barcode: p.barcode || '',
      mrp: p.mrp || 0,
      discount: p.discount || (p.mrp > 0 && p.sellingPrice > 0 ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100) : 0),
    });
    setImagePreview(p.images?.[0] || null);
    setShowScanner(false);
    setShowModal(true);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setImagePreview(url);
      setForm((f: any) => ({ ...f, images: [url] }));
    };
    reader.readAsDataURL(file);
  };

  const saveProduct = async () => {
    if (!form.name.trim()) { toast.error('Product name is required'); return; }
    if (!form.sellingPrice || form.sellingPrice <= 0) { toast.error('Enter a valid price'); return; }
    const mrpVal = parseFloat(form.mrp) || 0;
    const spVal = parseFloat(form.sellingPrice) || 0;
    // auto-compute discount % from MRP if MRP is set
    const discountVal = mrpVal > 0 && spVal > 0 ? Math.round(((mrpVal - spVal) / mrpVal) * 100) : 0;
    const data = {
      name: form.name.trim(),
      sku: form.sku || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: form.barcode || '',
      category: form.category,
      sellingPrice: spVal,
      mrp: mrpVal,
      discount: discountVal,
      costPrice: parseFloat(form.costPrice) || 0,
      tax: { gstRate: form.tax?.gstRate ?? 0 },
      stock: { current: parseInt(form.stock?.current) || 0, minLevel: parseInt(form.stock?.minLevel) || 5 },
      unit: form.unit || 'pcs',
      images: form.images || [],
      emoji: form.emoji || '🍞',
    };
    if (editing) {
      const ok = await updateProduct(editing._id, data);
      toast.success('✅ Product updated!');
    } else {
      const result = await addProduct(data as any);
      if (result) toast.success('✅ Product added!');
      else toast.error('Product saved locally (offline mode)');
    }
    setShowModal(false);
    // Refresh list from backend
    setTimeout(() => fetchData(), 500);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm === id) {
      const ok = await deleteProduct(id);
      if (ok) toast.success('Product deleted');
      else toast.error('Delete may have failed — refresh to confirm');
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleStockAdjust = async () => {
    if (!stockModal) return;
    const qty = parseInt(stockQty);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    const ok = await adjustStock(stockModal._id, qty, stockReason || (stockType === 'add' ? 'Stock received' : 'Manual reduction'), stockType);
    if (!ok) { toast.error('Cannot reduce below 0'); return; }
    toast.success(`${stockType === 'add' ? '📦 Added' : '📤 Removed'} ${qty} units`);
    setStockModal(null);
    setStockQty('');
    setStockReason('');
  };

  // ── Barcode Scanner ───────────────────────────────────────────────────
  const startScanner = async () => {
    setScannerError('');
    setShowScanner(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const codeReader = new BrowserMultiFormatReader();
      scannerRef.current = codeReader;
      // small delay to let the video element mount
      setTimeout(async () => {
        if (!videoRef.current) return;
        try {
          await codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
            if (result) {
              setForm((f: any) => ({ ...f, barcode: result.getText() }));
              stopScanner();
              toast.success(`✅ Barcode scanned: ${result.getText()}`);
            }
          });
        } catch (e: any) {
          setScannerError('Camera access denied or not available');
        }
      }, 300);
    } catch (e) {
      setScannerError('Barcode scanner failed to load');
    }
  };

  const stopScanner = () => {
    try {
      if (scannerRef.current?.reset) scannerRef.current.reset();
      // Stop all camera tracks via video srcObject
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      scannerRef.current = null;
    } catch (_) {}
    setShowScanner(false);
  };

  // ── Excel import handler ───────────────────────────────────────────────
  const handleImport = async () => {
    if (!importFile) { toast.error('Please select an Excel file first'); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result: ImportResult = res.data.data;
      setImportResult(result);
      if (result.products?.length > 0) {
        const mapped: Product[] = result.products.map((p: any) => ({
          _id: p._id,
          name: p.name,
          sku: p.sku || '',
          barcode: p.barcode || '',
          mrp: p.mrp ?? 0,
          discount: p.discount ?? 0,
          category: p.category?.name || p.category || '',
          sellingPrice: p.sellingPrice ?? 0,
          costPrice: p.costPrice ?? 0,
          tax: { gstRate: p.tax?.gstRate ?? 0 },
          stock: { current: p.stock?.current ?? 0, minLevel: p.stock?.minLevel ?? 5 },
          unit: p.unit || 'pcs',
          images: p.images || [],
          salesCount: p.salesCount ?? 0,
          emoji: '📦',
        }));
        bulkAddProducts(mapped);
      }
      toast.success(`✅ ${result.imported} product(s) imported!`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Import failed. Please check your file.';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const openImportModal = () => {
    setImportFile(null);
    setImportResult(null);
    setShowImport(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map(p => p._id));
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} products?`)) return;
    if (selectedIds.length === 0) { toast.error('No products selected'); return; }
    try {
      await api.delete('/products', { data: { ids: selectedIds } });
      selectedIds.forEach(id => deleteProduct(id));
      setSelectedIds([]);
      toast.success('Bulk delete successful');
      setTimeout(() => fetchData(), 500);
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <style>{`
        .pos-scrollbar::-webkit-scrollbar { width: 8px; }
        .pos-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
        .pos-scrollbar::-webkit-scrollbar-thumb { background: rgba(217, 119, 6, 0.4); border-radius: 10px; }
        .pos-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(217, 119, 6, 0.6); }
      `}</style>

      {/* Dashboard Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-2">
              <Package className="w-7 h-7 text-amber-600" />
              Product Management
            </h1>
            <p className="text-stone-400 text-sm">{isAdmin ? 'Full catalog control & database management' : 'View products & manage stock'}</p>
          </div>
          <div className="flex gap-2 flex-wrap w-full md:w-auto mt-2 md:mt-0">
            <button onClick={() => setShowLogs(!showLogs)} className="flex-1 md:flex-none justify-center btn-secondary text-sm flex items-center gap-2" id="view-logs-btn">
              <RefreshCw className={clsx("w-4 h-4", showLogs && "animate-spin")} />
              {showLogs ? 'Hide History' : 'Stock History'}
            </button>
            <div className="flex border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden shadow-sm">
              <button onClick={exportToExcel} className="flex-1 md:flex-none px-3 py-2 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border-r border-stone-200 dark:border-stone-700 transition-colors flex justify-center items-center" title="Export Excel">
                <Download className="w-4 h-4 text-blue-600" />
              </button>
              <button onClick={openImportModal} className="flex-1 md:flex-none px-3 py-2 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors flex justify-center items-center" title="Import Excel">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
            <button onClick={openAddModal} className="flex-1 md:flex-none justify-center w-full md:w-auto btn-primary shadow-lg shadow-amber-600/20" id="add-product-btn">
              <Plus className="w-4 h-4" /> New Product
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className={clsx('grid gap-4', isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3')}>
          <div className="card p-4 flex flex-col gap-1 bg-gradient-to-br from-white to-stone-50/50 dark:from-stone-800 dark:to-stone-900 border-l-4 border-l-amber-500">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Products</p>
            <p className="text-2xl font-black text-stone-800 dark:text-stone-100">{dbConnected ? totalProducts : products.length}</p>
            <p className="text-[11px] text-stone-500">{CATEGORIES.length} Categories</p>
          </div>
          {/* Stock Value - Admin only */}
          {isAdmin && (
            <div className="card p-4 flex flex-col gap-1 bg-gradient-to-br from-white to-stone-50/50 dark:from-stone-800 dark:to-stone-900 border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Stock Value</p>
              <p className="text-2xl font-black text-stone-800 dark:text-stone-100">
                {stats ? `₹${Math.round(stats.totalStockValue ?? 0).toLocaleString('en-IN')}` : <span className="text-base text-stone-400">Loading…</span>}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold">Cost Basis</p>
            </div>
          )}
          <div className="card p-4 flex flex-col gap-1 bg-gradient-to-br from-white to-stone-50/50 dark:from-stone-800 dark:to-stone-900 border-l-4 border-l-red-500">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Out of Stock</p>
            <p className="text-2xl font-black text-red-600 dark:text-red-400">
              {stats ? (stats.outOfStockCount ?? 0) : <span className="text-base text-stone-400">…</span>}
            </p>
            <p className="text-[11px] text-stone-500">Needs replenishment</p>
          </div>
          {isAdmin && (
            <div className="card p-4 flex flex-col gap-1 bg-gradient-to-br from-white to-stone-50/50 dark:from-stone-800 dark:to-stone-900 border-l-4 border-l-blue-500">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Potential Rev.</p>
              <p className="text-2xl font-black text-stone-800 dark:text-stone-100">
                {stats ? `₹${Math.round(stats.potentialRevenue ?? 0).toLocaleString('en-IN')}` : <span className="text-base text-stone-400">Loading…</span>}
              </p>
              <p className="text-[11px] text-blue-600 font-semibold">Current Inventory</p>
            </div>
          )}
        </div>
      </div>

      {/* DB Status Indicator */}

      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
            <strong>{lowStockCount} products</strong> are running low on stock. Restock soon.
          </p>
                  <button
          onClick={() => { setFilterStock('low'); setPage(1); }}
          className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap"
        >View Low Stock ({lowStockCount}) →</button>
        </div>
      )}

      {/* Stock Logs Panel */}
      {showLogs && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-700">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">Stock History</h3>
            <button onClick={() => setShowLogs(false)} className="btn-icon"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {stockLogs.length === 0 ? (
              <p className="text-center text-stone-400 text-sm py-8">No stock movements yet</p>
            ) : stockLogs.slice(0, 50).map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 dark:border-stone-700/50 last:border-0">
                <span className={clsx('w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0',
                  log.type === 'add' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                  log.type === 'sale' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'
                )}>
                  {log.type === 'add' ? '📦' : log.type === 'sale' ? '🧾' : '📤'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{log.productName}</p>
                  <p className="text-xs text-stone-400">{log.reason}</p>
                </div>
                <span className={clsx('text-sm font-bold', log.type === 'add' ? 'text-emerald-600' : 'text-red-500')}>
                  {log.type === 'add' ? '+' : '-'}{log.qty}
                </span>
                <span className="text-xs text-stone-400 whitespace-nowrap hidden sm:block">
                  {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Filter & Bulk Actions */}
      <div className="card p-2 bg-white/80 dark:bg-stone-800/80 backdrop-blur-md sticky top-0 z-30 shadow-sm border-stone-200 dark:border-stone-700">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-full md:flex-1 md:w-auto min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input id="inventory-search" type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, SKUs, category..."
              className="w-full bg-transparent border-0 focus:ring-0 text-sm py-2 pl-9 pr-8" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"><X className="w-3.5 h-3.5" /></button>}
          </div>
          
          <div className="h-6 w-px bg-stone-200 dark:bg-stone-700 hidden md:block" />

          <div className="flex gap-1 flex-wrap items-center">
            {['All', ...categories].map((c) => (
              <button key={c} onClick={() => setFilterCat(c)}
                className={clsx('px-3 py-1 rounded-lg text-xs font-bold transition-all',
                  filterCat === c ? 'bg-amber-600 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700'
                )}>{c}</button>
            ))}
            <button 
              onClick={() => setShowCategoryManager(true)}
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-amber-200 dark:border-amber-800 ml-2"
            >
              Manage Categories
            </button>
          </div>

          <div className="h-6 w-px bg-stone-200 dark:bg-stone-700 hidden md:block" />

          <div className="flex items-center gap-2 ml-auto">
            <select 
              value={pageSize} 
              onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}
              className="text-[10px] font-bold text-stone-500 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2 py-1.5 rounded-lg outline-none"
            >
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
              <option value={500}>500 / page</option>
              <option value={-1}>Show All</option>
            </select>
            {selectedIds.length > 0 ? (

              <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                <span className="text-[11px] font-bold text-amber-600">{selectedIds.length} selected</span>
                <button onClick={bulkDelete} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete selected">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedIds([])} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden">
                <button onClick={() => setViewMode('grid')} className={clsx("p-1.5 transition-colors", viewMode === 'grid' ? "bg-stone-100 dark:bg-stone-700 text-amber-600" : "text-stone-400")}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('list')} className={clsx("p-1.5 transition-colors", viewMode === 'list' ? "bg-stone-100 dark:bg-stone-700 text-amber-600" : "text-stone-400")}>
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            <button onClick={selectAll} className="text-[10px] font-bold text-stone-400 hover:text-stone-600 uppercase tracking-tighter border border-stone-200 dark:border-stone-700 px-2 py-1.5 rounded-lg">
              {selectedIds.length === filtered.length ? 'Deselect All' : 'Select Page'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col xl:flex-row gap-6 xl:h-[calc(100vh-280px)] xl:min-h-[500px]">
        {/* Product Grid/List */}
        <div className="flex-1 xl:overflow-y-auto pr-2 pos-scrollbar">


          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.length === 0 ? (
                <div className="col-span-full card p-12 text-center bg-white/50 dark:bg-stone-800/50">
                  <Package className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <p className="font-bold text-stone-500">No matches found</p>
                  <p className="text-stone-400 text-sm mt-1">Adjust filters or add a new product</p>
                </div>
              ) : filtered.map((p) => (
                <ProductCard 
                  key={p._id} 
                  p={p} 
                  isSelected={selectedIds.includes(p._id)}
                  onSelect={() => toggleSelect(p._id)}
                  onEdit={() => openEditModal(p)}
                  onDelete={() => handleDelete(p._id)}
                  onAdjust={(type: 'add' | 'remove') => { setStockType(type); setStockModal(p); }}
                />
              ))}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-stone-50 dark:bg-stone-900/50 text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={selectAll} className="rounded border-stone-300 text-amber-600 focus:ring-amber-500" />
                    </th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Price / MRP</th>
                    <th className="px-4 py-3">Barcode</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-700/50">
                  {filtered.map(p => (
                    <tr key={p._id} className={clsx("hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors group", selectedIds.includes(p._id) && "bg-amber-50/30 dark:bg-amber-900/10")}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.includes(p._id)} onChange={() => toggleSelect(p._id)} className="rounded border-stone-300 text-amber-600 focus:ring-amber-500" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{p.emoji}</span>
                          <div>
                            <p className="text-sm font-bold text-stone-800 dark:text-stone-100">{p.name}</p>
                            <p className="text-[10px] font-mono text-stone-400 uppercase">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs text-stone-500">{p.category}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-amber-700 dark:text-amber-400">₹{p.sellingPrice}</span>
                          {p.mrp > 0 && p.mrp > p.sellingPrice && (
                            <span className="text-[10px] text-stone-400 line-through">₹{p.mrp}</span>
                          )}
                          {p.discount > 0 && (
                            <span className="text-[9px] font-black bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full">-{p.discount}%</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.barcode ? (
                          <span className="text-[10px] font-mono text-stone-500 flex items-center gap-1">
                            <Scan className="w-3 h-3 text-stone-400" />{p.barcode}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-full", 
                          p.stock.current === 0 ? "bg-red-100 text-red-600" : 
                          p.stock.current <= p.stock.minLevel ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          {p.stock.current} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditModal(p)} className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5 text-stone-500" /></button>
                          <button onClick={() => handleDelete(p._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-2">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center sm:text-left">
              Showing <span className="text-stone-900 dark:text-white">{products.length}</span> of {totalProducts} Products
            </p>

            <div className="flex items-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => {
                  setPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 disabled:opacity-30 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] md:max-w-none no-scrollbar">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button 
                    key={p}
                    onClick={() => {
                      setPage(p);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={clsx(
                      "min-w-[32px] h-8 rounded-xl text-[11px] font-black transition-all",
                      page === p 
                        ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20 scale-110 z-10" 
                        : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button 
                disabled={page === totalPages}
                onClick={() => {
                  setPage(p => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 disabled:opacity-30 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="w-full xl:w-72 flex flex-col gap-5">
          {/* Database Control Widget */}
          <div className="card p-5 bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-800 dark:to-stone-900 border-dashed border-2 border-stone-200 dark:border-stone-700 shadow-none">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-stone-500" />
              Database Control
            </h3>
            <div className="space-y-2">
              <button onClick={() => {
                  toast.loading('Refreshing stats...', { id: 'ref-stats' });
                  api.get('/products/stats').then(res => {
                    setStats(res.data.data);
                    fetchData();
                    toast.success('Inventory & Stats updated!', { id: 'ref-stats' });
                  }).catch(() => toast.error('Refresh failed', { id: 'ref-stats' }));

                }} 
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all text-xs font-semibold group shadow-sm">
                <span className="flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 text-blue-500 group-hover:rotate-180 transition-transform duration-500" /> Refresh Index</span>
              </button>

              <button onClick={exportToExcel}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all text-xs font-semibold group shadow-sm">
                <span className="flex items-center gap-2"><Download className="w-3.5 h-3.5 text-emerald-500" /> Full DB Backup</span>
              </button>
              <div className="pt-2 border-t border-stone-200 dark:border-stone-700">
                <button onClick={clearAllProducts} 
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-xs font-bold">
                  <Trash2 className="w-3.5 h-3.5" /> Wipe All Products
                </button>
              </div>
            </div>
          </div>

          {/* Category Distribution Chart */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-amber-500" />
              Category Mix
            </h3>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.categoryDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(stats?.categoryDistribution || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777'][index % 5]} />
                    ))}
                  </Pie>
                  <ReTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {(stats?.categoryDistribution || []).slice(0, 4).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ['#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777'][i % 5] }} />
                    <span className="text-[11px] text-stone-500 truncate">{c.name}</span>
                  </div>
                  <span className="text-[11px] font-bold text-stone-700 dark:text-stone-300">{c.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Info */}
          <div className="flex items-center gap-2 px-2 text-[10px] text-stone-400 font-mono">
            <Info className="w-3 h-3" />
            <span>v2.4.0-PRO · DB: MongoDB Atlas</span>
          </div>
        </div>
      </div>

    {/* ── Add / Edit Product Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-stone-200 dark:border-stone-700 sticky top-0 bg-white dark:bg-stone-800 rounded-t-3xl z-10">
              <h3 className="font-bold text-stone-800 dark:text-stone-100">
                {editing ? '✏️ Edit Product' : '➕ Add New Product'}
              </h3>
              <button onClick={() => { stopScanner(); setShowModal(false); }} className="btn-icon"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Image upload */}
              <div className="flex items-center gap-4 p-4 border-2 border-dashed border-stone-200 dark:border-stone-600 rounded-2xl">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{form.emoji || '🥖'}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-stone-500 mb-2">Product Image</p>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    📷 Upload Photo
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                  {imagePreview && (
                    <button onClick={() => { setImagePreview(null); setForm((f: any) => ({ ...f, images: [] })); }}
                      className="ml-2 text-xs text-red-400 hover:text-red-600">Remove</button>
                  )}
                  <p className="text-[11px] text-stone-400 mt-1">Or pick emoji:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {EMOJIS.map((em) => (
                      <button key={em} onClick={() => setForm((f: any) => ({ ...f, emoji: em }))}
                        className={clsx('text-lg p-0.5 rounded transition-all', form.emoji === em ? 'bg-amber-100 dark:bg-amber-900/40 scale-125' : 'hover:bg-stone-100 dark:hover:bg-stone-700')}
                      >{em}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Product Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field" placeholder="e.g. Chocolate Cake" id="product-name" />
              </div>

              {/* Category + Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-500 block">Category</label>
                    <button onClick={() => setShowNewCatInput(!showNewCatInput)} className="text-[10px] font-bold text-amber-600 hover:underline">
                      {showNewCatInput ? 'Cancel' : '+ New'}
                    </button>
                  </div>
                  {showNewCatInput ? (
                    <div className="flex gap-2">
                      <input 
                        value={newCatName} 
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="input-field py-1.5 text-xs" 
                        placeholder="Cat name..." 
                        autoFocus
                      />
                      <button 
                        onClick={() => {
                          if (newCatName.trim()) {
                            setCategories(prev => [...new Set([...prev, newCatName.trim()])]);
                            setForm({ ...form, category: newCatName.trim() });
                            setNewCatName('');
                            setShowNewCatInput(false);
                          }
                        }}
                        className="p-2 bg-amber-600 text-white rounded-xl"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" id="product-category">
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input-field" id="product-unit">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block">SKU (auto-generated if blank)</label>
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="input-field" placeholder="e.g. BKR-001" id="product-sku" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block flex items-center gap-1">
                    <Scan className="w-3 h-3" /> Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={form.barcode || ''}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      className="input-field flex-1"
                      placeholder="Scan or type..."
                      id="product-barcode"
                    />
                    <button
                      type="button"
                      onClick={startScanner}
                      className="p-2.5 bg-stone-100 dark:bg-stone-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-stone-600 dark:text-stone-300 rounded-xl transition-colors"
                      title="Scan barcode with camera"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Barcode Camera Scanner */}
              {showScanner && (
                <div className="rounded-2xl overflow-hidden border-2 border-amber-400 relative bg-black">
                  <div className="flex items-center justify-between px-3 py-2 bg-amber-600">
                    <span className="text-white text-xs font-bold flex items-center gap-1.5"><Scan className="w-3.5 h-3.5" /> Point camera at barcode</span>
                    <button onClick={stopScanner} className="text-white hover:text-amber-200"><X className="w-4 h-4" /></button>
                  </div>
                  <video ref={videoRef} className="w-full h-44 object-cover" autoPlay muted playsInline />
                  {scannerError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                      <p className="text-red-400 text-sm font-semibold text-center px-4">{scannerError}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-24 border-2 border-amber-400 rounded-lg opacity-70" />
                  </div>
                </div>
              )}

              {/* MRP + Selling Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block flex items-center gap-1">
                    <Tag className="w-3 h-3" /> MRP ₹ <span className="text-stone-300">(Max Retail Price)</span>
                  </label>
                  <input
                    type="number" min="0"
                    value={form.mrp || ''}
                    onChange={(e) => {
                      const mrp = parseFloat(e.target.value) || 0;
                      const sp = parseFloat(form.sellingPrice) || 0;
                      const disc = mrp > 0 && sp > 0 ? Math.round(((mrp - sp) / mrp) * 100) : 0;
                      setForm({ ...form, mrp: e.target.value, discount: disc });
                    }}
                    className="input-field" placeholder="0" id="product-mrp"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Selling Price ₹ *</label>
                  <input
                    type="number" min="0"
                    value={form.sellingPrice || ''}
                    onChange={(e) => {
                      const sp = parseFloat(e.target.value) || 0;
                      const mrp = parseFloat(form.mrp) || 0;
                      const disc = mrp > 0 && sp > 0 ? Math.round(((mrp - sp) / mrp) * 100) : 0;
                      setForm({ ...form, sellingPrice: e.target.value, discount: disc });
                    }}
                    className="input-field" placeholder="0" id="product-price"
                  />
                </div>
              </div>

              {/* Auto Discount display + manual override */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block flex items-center gap-1">
                    <Percent className="w-3 h-3" /> Discount %
                    <span className="text-[10px] text-amber-500 font-bold ml-1">(auto from MRP)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100"
                      value={form.discount || ''}
                      onChange={(e) => {
                        const disc = parseFloat(e.target.value) || 0;
                        const mrp = parseFloat(form.mrp) || 0;
                        const sp = mrp > 0 ? mrp - (mrp * disc / 100) : parseFloat(form.sellingPrice) || 0;
                        setForm({ ...form, discount: e.target.value, sellingPrice: mrp > 0 ? Math.round(sp) : form.sellingPrice });
                      }}
                      className="input-field pr-8" placeholder="0" id="product-discount"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm font-bold">%</span>
                  </div>
                  {(form.discount > 0) && (
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                      You save: ₹{Math.round((parseFloat(form.mrp) || 0) * (parseFloat(form.discount) || 0) / 100)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Cost Price ₹</label>
                  <input type="number" min="0" value={form.costPrice || ''} onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    className="input-field" placeholder="0" id="product-cost" />
                </div>
              </div>


              {/* Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Opening Stock</label>
                  <input type="number" min="0" value={form.stock?.current ?? 0} onChange={(e) => setForm({ ...form, stock: { ...form.stock, current: e.target.value } })}
                    className="input-field" id="product-stock" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Min. Stock Alert Level</label>
                  <input type="number" min="0" value={form.stock?.minLevel ?? 5} onChange={(e) => setForm({ ...form, stock: { ...form.stock, minLevel: e.target.value } })}
                    className="input-field" id="product-min-stock" />
                </div>
              </div>

              {/* GST */}
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-2 block">GST Rate</label>
                <div className="flex gap-2">
                  {GST_SLABS.map((s) => (
                    <button key={s} type="button" onClick={() => setForm({ ...form, tax: { ...form.tax, gstRate: s } })}
                      className={clsx('flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all',
                        form.tax?.gstRate === s ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'border-stone-200 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-amber-300'
                      )} id={`gst-${s}`}>
                      {s}%
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={saveProduct} className="w-full btn-primary py-3.5 text-base" id="save-product-btn">
                {editing ? '✅ Update Product' : '✅ Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Adjustment Modal ── */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-stone-800 dark:text-stone-100">
                {stockType === 'add' ? '📦 Add Stock' : '📤 Remove Stock'}
              </h3>
              <button onClick={() => setStockModal(null)} className="btn-icon"><X className="w-4 h-4" /></button>
            </div>

            {/* Product info */}
            <div className="flex items-center gap-3 mb-5 p-3 bg-stone-50 dark:bg-stone-700/50 rounded-2xl">
              <span className="text-3xl">{stockModal.images?.[0] ? '' : stockModal.emoji}</span>
              {stockModal.images?.[0] && <img src={stockModal.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover" />}
              <div>
                <p className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{stockModal.name}</p>
                <p className="text-xs text-stone-400">Current stock: <strong className="text-stone-700 dark:text-stone-300">{stockModal.stock.current} {stockModal.unit}</strong></p>
              </div>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => setStockType('add')}
                className={clsx('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2',
                  stockType === 'add' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'border-stone-200 dark:border-stone-600 text-stone-500'
                )}>
                <ChevronUp className="w-4 h-4 inline mr-1" />Add Stock
              </button>
              <button onClick={() => setStockType('remove')}
                className={clsx('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2',
                  stockType === 'remove' ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'border-stone-200 dark:border-stone-600 text-stone-500'
                )}>
                <ChevronDown className="w-4 h-4 inline mr-1" />Remove Stock
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1 block">Quantity *</label>
                <input type="number" min="1" value={stockQty} onChange={(e) => setStockQty(e.target.value)}
                  className="input-field text-lg font-bold text-center" placeholder="0" id="stock-qty" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 mb-1 block">Reason (optional)</label>
                <input value={stockReason} onChange={(e) => setStockReason(e.target.value)}
                  className="input-field" placeholder={stockType === 'add' ? 'Purchase received, transfer...' : 'Damaged, expired, transfer...'} id="stock-reason" />
              </div>
              <button onClick={handleStockAdjust} className={clsx('w-full py-3 rounded-xl font-bold text-sm transition-all',
                stockType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              )} id="confirm-stock-adj">
                {stockType === 'add' ? `✅ Add ${stockQty || '0'} Units` : `✅ Remove ${stockQty || '0'} Units`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Excel Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-stone-200 dark:border-stone-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-800 dark:text-stone-100">Import from Excel</h3>
                  <p className="text-xs text-stone-400">Upload .xlsx to bulk-add products</p>
                </div>
              </div>
              <button onClick={() => setShowImport(false)} className="btn-icon" id="close-import-modal">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Template download */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-stone-700/50">
                <div>
                  <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">Need a template?</p>
                  <p className="text-xs text-stone-400">Download the sample Excel file</p>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-700 px-3 py-2 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" id="download-template-btn">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>

              {/* Drag & Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
                    setImportFile(f);
                    setImportResult(null);
                  } else {
                    toast.error('Please drop an .xlsx file');
                  }
                }}
                onClick={() => importFileRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                  dragOver
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : importFile
                    ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10'
                    : 'border-stone-300 dark:border-stone-600 hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10'
                )}
                id="import-dropzone"
              >
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setImportFile(f); setImportResult(null); }
                  }}
                />
                {importFile ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="font-semibold text-stone-700 dark:text-stone-200 text-sm">{importFile.name}</p>
                    <p className="text-xs text-stone-400">{(importFile.size / 1024).toFixed(1)} KB · Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-10 h-10 text-stone-300 dark:text-stone-600 mx-auto" />
                    <p className="font-semibold text-stone-500 dark:text-stone-400 text-sm">Drag & drop your Excel file</p>
                    <p className="text-xs text-stone-400">or click to browse · .xlsx / .xls</p>
                  </div>
                )}
              </div>

              {/* Column guide */}
              <div className="text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-700/50 rounded-xl p-3 space-y-1">
                <p className="font-semibold text-stone-600 dark:text-stone-300 mb-1.5">Expected columns:</p>
                <div className="grid grid-cols-2 gap-x-4">
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">Item name*</code> (required)</span>
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">Sale price</code></span>
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">MRP</code> (optional)</span>
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">Discount</code> (optional %)</span>
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">Barcode</code> (optional)</span>
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">Current stock quantity</code></span>
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">Category</code></span>
                  <span>• <code className="bg-stone-200 dark:bg-stone-600 px-1 rounded">SKU</code> (optional)</span>
                </div>
              </div>

              {/* Result summary */}
              {importResult && (
                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 space-y-3">
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">✅ Import Complete</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white dark:bg-stone-800 rounded-xl p-2.5 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{importResult.imported}</p>
                      <p className="text-stone-500">Imported</p>
                    </div>
                    <div className="bg-white dark:bg-stone-800 rounded-xl p-2.5 text-center">
                      <p className="text-2xl font-bold text-amber-500">{importResult.skipped}</p>
                      <p className="text-stone-500">Skipped</p>
                    </div>
                    <div className="bg-white dark:bg-stone-800 rounded-xl p-2.5 text-center">
                      <p className="text-2xl font-bold text-purple-500">{importResult.categoriesCreated}</p>
                      <p className="text-stone-500">New Categories</p>
                    </div>
                    <div className="bg-white dark:bg-stone-800 rounded-xl p-2.5 text-center">
                      <p className="text-2xl font-bold text-blue-500">{importResult.categoriesReused}</p>
                      <p className="text-stone-500">Reused</p>
                    </div>
                  </div>
                  {importResult.skippedItems?.length > 0 && (
                    <div className="text-xs text-stone-500">
                      <p className="font-semibold mb-1">Skipped rows:</p>
                      <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                        {importResult.skippedItems.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-amber-500">⚠</span>
                            <span>{s.name} — {s.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button onClick={() => setShowImport(false)} className="flex-1 btn-secondary" id="cancel-import-btn">
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                {!importResult && (
                  <button
                    onClick={handleImport}
                    disabled={!importFile || importing}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    id="confirm-import-btn"
                  >
                    {importing ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing…</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Import Now</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Floating Scroll to Top */}
      <button 
        onClick={() => {
          const container = document.querySelector('.pos-scrollbar');
          if (container && container.scrollHeight > container.clientHeight) {
            container.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            const mainContent = document.querySelector('main');
            if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        className="fixed bottom-6 right-6 p-4 bg-amber-600 text-white rounded-2xl shadow-2xl hover:bg-amber-700 transition-all z-40 group"
        id="scroll-to-top"
      >
        <ChevronUp className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
      </button>

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManagerModal 
          onClose={() => setShowCategoryManager(false)} 
          onCategoriesUpdated={() => fetchData()} 
        />
      )}
    </div>
  );
}
