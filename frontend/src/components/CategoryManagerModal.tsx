'use client';
import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Category {
  _id: string;
  name: string;
}

interface Props {
  onClose: () => void;
  onCategoriesUpdated: () => void;
}

export default function CategoryManagerModal({ onClose, onCategoriesUpdated }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      if (res.data?.success) {
        setCategories(res.data.data.categories || []);
      }
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await api.post('/categories', { name: newCatName.trim() });
      if (res.data?.success) {
        toast.success('Category added');
        setNewCatName('');
        fetchCategories();
        onCategoriesUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add category');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    
    try {
      const res = await api.patch(`/categories/${id}`, { name: editName.trim() });
      if (res.data?.success) {
        toast.success('Category updated');
        setEditingId(null);
        fetchCategories();
        onCategoriesUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    try {
      const res = await api.delete(`/categories/${id}`);
      if (res.data?.success) {
        toast.success('Category deleted');
        fetchCategories();
        onCategoriesUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800">
          <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Manage Categories</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Add New */}
          <form onSubmit={handleAdd} className="flex items-center gap-2 mb-6">
            <input 
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New category name..."
              className="flex-1 px-4 py-2 bg-stone-100 dark:bg-stone-800 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none transition-all"
            />
            <button 
              type="submit"
              disabled={!newCatName.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-stone-500 text-sm font-medium">
              No custom categories found.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {categories.map((c) => (
                <div key={c._id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-800/50 group">
                  
                  {editingId === c._id ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <input 
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-sm font-medium outline-none"
                      />
                      <button onClick={() => handleUpdate(c._id)} className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-semibold text-stone-700 dark:text-stone-300 text-sm">
                        {c.name}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setEditingId(c._id); setEditName(c.name); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(c._id, c.name)}
                          className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}

                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
