'use client';

import React, { useEffect, useState } from 'react';
import { getStaff, createStaff, updateStaff, deleteStaff, permanentDeleteStaff } from '@/lib/staffApi';
import { Plus, Edit2, Trash2, Shield, Loader2, Eye, EyeOff, UserCheck, Phone, Mail, Calendar, DollarSign, Key } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  password: '',
  role: 'staff',
  salaryType: 'monthly',
  salaryAmount: '',
  joinDate: new Date().toISOString().split('T')[0],
};

const ROLE_COLORS: Record<string, string> = {
  staff: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cashier: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  accountant: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const SALARY_TYPE_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  daily: 'Daily',
};

export default function StaffPage() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await getStaff();
      setStaffList(data);
    } catch {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleOpenModal = (staff?: any) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        name: staff.name,
        phone: staff.phone || '',
        email: staff.email || '',
        password: '',
        role: staff.role,
        salaryType: staff.salaryType || 'monthly',
        salaryAmount: staff.salaryAmount || '',
        joinDate: staff.joinDate ? staff.joinDate.split('T')[0] : new Date().toISOString().split('T')[0],
      });
    } else {
      setEditingStaff(null);
      setFormData({ ...EMPTY_FORM });
    }
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingStaff) {
        const updateData: any = { ...formData };
        if (!updateData.password) delete updateData.password;
        await updateStaff(editingStaff._id, updateData);
        toast.success('✅ Staff updated');
      } else {
        await createStaff(formData);
        toast.success('✅ Staff added successfully');
      }
      setIsModalOpen(false);
      fetchStaff();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save staff');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Deactivate "${name}"? They won't be able to login but data is kept.`)) return;
    try {
      await deleteStaff(id);
      toast.success(`${name} deactivated`);
      fetchStaff();
    } catch {
      toast.error('Failed to deactivate staff');
    }
  };

  const handlePermanentDelete = async (id: string, name: string) => {
    if (!confirm(`⚠️ Permanently DELETE "${name}"?\n\nThis will remove them completely and cannot be undone!`)) return;
    try {
      await permanentDeleteStaff(id);
      toast.success(`${name} permanently deleted`);
      fetchStaff();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> Staff Management
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">{staffList.length} staff members</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-md"
        >
          <Plus className="w-5 h-5" /> Add Staff
        </button>
      </div>

      {/* Staff Cards */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : staffList.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">👨‍💼</p>
          <p className="font-semibold text-stone-500">No staff added yet</p>
          <p className="text-sm text-stone-400 mt-1">Click "Add Staff" to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((staff) => (
            <div key={staff._id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {staff.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-stone-800 dark:text-stone-100">{staff.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${ROLE_COLORS[staff.role] || ROLE_COLORS.staff}`}>
                      {staff.role}
                    </span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${staff.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600'}`}>
                  {staff.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                {staff.phone && (
                  <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {staff.phone}
                  </div>
                )}
                {staff.email && (
                  <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{staff.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
                  <DollarSign className="w-3.5 h-3.5 flex-shrink-0" />
                  ₹{staff.salaryAmount}
                  <span className="text-stone-400 text-xs">/ {SALARY_TYPE_LABELS[staff.salaryType] || staff.salaryType}</span>
                </div>
                <div className="flex items-center gap-2 text-stone-500 dark:text-stone-500">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  Joined {new Date(staff.joinDate).toLocaleDateString('en-IN')}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-700">
                <button
                  onClick={() => handleOpenModal(staff)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-stone-600 dark:text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                {staff.isActive && (
                  <button
                    onClick={() => handleDeactivate(staff._id, staff.name)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-stone-600 dark:text-stone-400 hover:text-orange-600 dark:hover:text-orange-400 text-xs font-medium transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Deactivate
                  </button>
                )}
                <button
                  onClick={() => handlePermanentDelete(staff._id, staff.name)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-600 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10">
              <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-700">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Full Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Raju Kumar"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Phone</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Join Date *</label>
                  <input
                    required
                    type="date"
                    value={formData.joinDate}
                    onChange={e => setFormData({ ...formData, joinDate: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Role *</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="input-field"
                  >
                    <option value="staff">Staff</option>
                    <option value="cashier">Cashier</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Salary Type *</label>
                  <select
                    value={formData.salaryType}
                    onChange={e => setFormData({ ...formData, salaryType: e.target.value })}
                    className="input-field"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily Wage</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">
                    Salary Amount (₹ per {formData.salaryType === 'monthly' ? 'month' : formData.salaryType === 'weekly' ? 'week' : 'day'}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder={formData.salaryType === 'daily' ? '500' : formData.salaryType === 'weekly' ? '3000' : '12000'}
                    value={formData.salaryAmount}
                    onChange={e => setFormData({ ...formData, salaryAmount: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 bg-blue-50/50 dark:bg-blue-900/10 space-y-3">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Login Credentials
                  {editingStaff && <span className="text-stone-400 font-normal ml-1">(leave password blank to keep existing)</span>}
                </p>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Email Address {!editingStaff && '*'}</label>
                  <input
                    required={!editingStaff}
                    type="email"
                    placeholder="staff@sindhubakery.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase mb-1 block">Password {!editingStaff && '* (min 6 chars)'}</label>
                  <div className="relative">
                    <input
                      required={!editingStaff}
                      type={showPassword ? 'text' : 'password'}
                      minLength={editingStaff ? 0 : 6}
                      placeholder={editingStaff ? 'Leave blank to keep' : 'Min 6 characters'}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="input-field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 font-bold text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-[2] py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-60">
                  {saving ? 'Saving...' : editingStaff ? 'Update Staff' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
