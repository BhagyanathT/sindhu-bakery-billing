'use client';
// src/app/(dashboard)/customers/page.tsx
import { useState, useEffect } from 'react';
import { Search, Plus, Phone, Mail, CreditCard, X, ChevronRight, TrendingUp, AlertCircle, MessageCircle, Receipt, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const mockCustomers = [
  { _id: '1', name: 'Priya Sharma', phone: '9876543001', email: 'priya@example.com', creditBalance: 500, totalPurchase: 5000, totalPaid: 4500, customerType: 'retail' },
  { _id: '2', name: 'Raju Kumar', phone: '9876543002', creditBalance: 1200, totalPurchase: 8000, totalPaid: 6800, customerType: 'retail' },
  { _id: '3', name: 'Hotel Sunrise', phone: '9876543003', email: 'hotel@sunrise.com', gstin: '29AAAAA0000A1Z5', creditBalance: 0, totalPurchase: 25000, totalPaid: 25000, customerType: 'wholesale' },
  { _id: '4', name: 'Meera Bakery Supplies', phone: '9876543004', creditBalance: 0, totalPurchase: 45000, totalPaid: 45000, customerType: 'distributor' },
  { _id: '5', name: 'Vikram Singh', phone: '9876543005', creditBalance: 800, totalPurchase: 3200, totalPaid: 2400, customerType: 'retail' },
];

const emptyCustomer = { name: '', phone: '', email: '', gstin: '', customerType: 'retail', creditLimit: 0, address: { line1: '', city: '', state: '', pincode: '' } };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyCustomer);
  const [totalCredit, setTotalCredit] = useState(0);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter === 'credit') params.set('hasCredit', 'true');
      const res = await api.get(`/customers?${params}&limit=50`);
      setCustomers(res.data.data.customers || []);
      setTotalCredit(res.data.data.totalCredit || 0);
    } catch {
      setCustomers(filter === 'credit' ? mockCustomers.filter(c => c.creditBalance > 0) : mockCustomers);
      setTotalCredit(mockCustomers.reduce((s, c) => s + c.creditBalance, 0));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    setSelectedCustomers([]);
    fetchCustomers(); 
  }, [search, filter]);

  const handleSelectAll = () => {
    if (selectedCustomers.length === customers.length && customers.length > 0) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map(c => c._id));
    }
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomers(prev => 
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedCustomers.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedCustomers.length} selected customers?`)) return;

    setLoading(true);
    try {
      await api.post('/customers/bulk-delete', { ids: selectedCustomers });
      toast.success(`${selectedCustomers.length} customers deleted successfully`);
      setSelectedCustomers([]);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete customers');
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/customers/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'customers_backup.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      toast.error('Failed to export customers');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const res = await api.post('/customers/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'Customers imported successfully');
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import customers');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };


  const openModal = (c?: any) => {
    setEditing(c || null);
    setForm(c ? { ...c } : emptyCustomer);
    setShowModal(true);
  };

  const saveCustomer = async () => {
    try {
      if (editing) {
        await api.patch(`/customers/${editing._id}`, form);
        toast.success('Customer updated!');
      } else {
        await api.post('/customers', form);
        toast.success('Customer added!');
      }
      setShowModal(false);
      fetchCustomers();
    } catch {
      toast.success(editing ? 'Customer updated (demo)' : 'Customer added (demo)');
      setShowModal(false);
    }
  };

  const typeColors: Record<string, string> = {
    retail: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    wholesale: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    distributor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Customers</h1>
          <p className="text-slate-400 text-sm">{customers.length} customers · ₹{totalCredit.toLocaleString('en-IN')} total credit</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            id="import-excel"
            onChange={handleImportExcel}
          />
          <button onClick={() => document.getElementById('import-excel')?.click()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors whitespace-nowrap">
            Import Excel
          </button>
          <button onClick={handleExportExcel} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors whitespace-nowrap">
            Export Excel
          </button>
          <button onClick={() => openModal()} className="btn-primary whitespace-nowrap" id="add-customer-btn">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Credit Alert */}
      {totalCredit > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Total outstanding credit (Udhar): <strong>₹{totalCredit.toLocaleString('en-IN')}</strong> across {customers.filter(c => c.creditBalance > 0).length} customers
          </p>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-1">
          <input 
            type="checkbox" 
            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            checked={customers.length > 0 && selectedCustomers.length === customers.length}
            onChange={handleSelectAll}
            title="Select All Customers"
          />
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input id="customer-search-main" type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email..."
            className="input-field pl-9" />
        </div>
        {['all', 'credit'].map((f) => (
          <button key={f} id={`cust-filter-${f}`} onClick={() => setFilter(f)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition-colors', filter === f ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300')}>
            {f === 'all' ? 'All Customers' : '💳 With Credit'}
          </button>
        ))}
        {selectedCustomers.length > 0 && (
          <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl font-medium transition-colors flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Delete ({selectedCustomers.length})
          </button>
        )}
      </div>

      {/* Customers Grid */}
      <div className="grid gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-24 shimmer" />
          ))
        ) : customers.map((c) => (
          <div key={c._id} className="card p-4 hover:shadow-md transition-all duration-200 card-glow group">
            <div className="flex items-center gap-4">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                checked={selectedCustomers.includes(c._id)}
                onChange={() => handleSelectCustomer(c._id)}
              />
              {/* Avatar */}
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                {c.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</h3>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium capitalize', typeColors[c.customerType] || typeColors.retail)}>
                    {c.customerType}
                  </span>
                  {c.gstin && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-mono">{c.gstin}</span>}
                </div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {c.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="w-3 h-3" /> {c.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-6 text-right">
                <div>
                  <p className="text-xs text-slate-400">Total Purchase</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">₹{(c.totalPurchase || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Credit (Udhar)</p>
                  <p className={clsx('font-semibold text-sm', c.creditBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {c.creditBalance > 0 ? `₹${c.creditBalance.toLocaleString('en-IN')}` : '✓ Cleared'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <a href={`/orders?search=${encodeURIComponent(c.name)}`} className="btn-icon" title="View Orders">
                  <Receipt className="w-3.5 h-3.5" />
                </a>
                <a href={`tel:${c.phone}`} className="btn-icon" title="Call">
                  <Phone className="w-3.5 h-3.5" />
                </a>
                {c.phone && (
                  <a
                    href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Hi ${c.name}! 👋 Greetings from Sindhu Bakery 🍞`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-icon text-[#25D366] hover:bg-[#25D366]/10"
                    title="Chat on WhatsApp"
                    id={`wa-chat-${c._id}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => openModal(c)} className="btn-icon" title="Edit" id={`edit-cust-${c._id}`}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">{editing ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Customer name" id="cust-name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+91-XXXXXXXXXX" id="cust-phone" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="email@example.com" id="cust-email" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">GSTIN</label>
                  <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} className="input-field font-mono" placeholder="29ABCDE1234F1Z5" id="cust-gstin" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Type</label>
                  <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })} className="input-field" id="cust-type">
                    <option value="retail">Retail</option>
                    <option value="wholesale">Wholesale</option>
                    <option value="distributor">Distributor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Credit Limit (₹)</label>
                  <input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} className="input-field" placeholder="0" id="cust-credit-limit" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">City</label>
                  <input value={form.address?.city || ''} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} className="input-field" placeholder="City" id="cust-city" />
                </div>
              </div>
              <button onClick={saveCustomer} className="w-full btn-primary py-3.5" id="save-customer-btn">
                {editing ? 'Update Customer' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
