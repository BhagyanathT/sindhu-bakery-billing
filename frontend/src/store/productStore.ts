'use client';
// src/store/productStore.ts — persisted product store shared between inventory & billing
import { create } from 'zustand';
import api from '@/lib/api';

export interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  sellingPrice: number;
  mrp: number;
  discount: number;
  costPrice: number;
  tax: { gstRate: number };
  stock: { current: number; minLevel: number };
  unit: string;
  images: string[];
  salesCount: number;
  emoji: string;
}

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  type: 'add' | 'remove' | 'sale';
  qty: number;
  reason: string;
  date: string;
}

export interface Order {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone?: string;
  items: { product?: any; name: string; qty: number; rate: number; taxRate?: number; total: number }[];
  subtotal: number;
  gst: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  date: string;
  notes?: string;
}

interface ProductState {
  products: Product[];
  stockLogs: StockLog[];
  orders: Order[];
  guestCounter: number;

  // Product CRUD (now purely backend-driven)
  addProduct: (p: Omit<Product, '_id' | 'salesCount'>) => Promise<Product | null>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;

  // Sync utilities
  setProducts: (products: Product[]) => void;
  bulkAddProducts: (newProducts: Product[]) => void;

  // Stock management
  adjustStock: (id: string, qty: number, reason: string, type: 'add' | 'remove') => Promise<boolean>;

  // Billing
  createOrder: (
    items: { product: Product; quantity: number; rate: number; taxRate: number }[],
    customerName: string,
    paymentMethod: string,
    discount: number,
    gstEnabled: boolean,
    customerPhone?: string,
  ) => Promise<{ orderId: string; invoiceId: string }>;
  fetchOrders: (query?: string) => Promise<{ total: number; pages: number }>;
  deleteOrder: (id: string) => Promise<boolean>;
  updateOrder: (id: string, payload: any) => Promise<boolean>;
}

export const useProductStore = create<ProductState>((set, get) => ({
      products: [],
      stockLogs: [],
      orders: [],
      guestCounter: 0,

      setProducts: (products) => set({ products }),

      bulkAddProducts: (newProducts) => {
        set((s) => {
          const existingIds = new Set(s.products.map((p) => p._id));
          const fresh = newProducts.filter((p) => !existingIds.has(p._id));
          return { products: [...s.products, ...fresh] };
        });
      },

      addProduct: async (p) => {
        try {
          const res = await api.post('/products', p);
          const created = res.data.data?.product || res.data.data;
          set((s) => ({ products: [...s.products, created] }));
          return created;
        } catch (err) {
          console.error('Add product failed:', err);
          return null;
        }
      },

      updateProduct: async (id, data) => {
        try {
          await api.patch(`/products/${id}`, data);
          set((s) => ({
            products: s.products.map((p) => p._id === id ? { ...p, ...data } : p)
          }));
          return true;
        } catch (err) {
          console.error('Update product failed:', err);
          return false;
        }
      },

      deleteProduct: async (id) => {
        try {
          await api.delete(`/products/${id}`);
          set((s) => ({
            products: s.products.filter((p) => p._id !== id)
          }));
          return true;
        } catch (err) {
          console.error('Delete product failed:', err);
          return false;
        }
      },

      adjustStock: async (id, qty, reason, type) => {
        try {
          const res = await api.post(`/products/${id}/adjust-stock`, { quantity: qty, type, reason });
          const updatedProduct = res.data.data?.product || res.data.data;
          set((s) => ({
            products: s.products.map((p) => p._id === id ? updatedProduct : p)
          }));
          return true;
        } catch (err) {
          console.error('Adjust stock failed:', err);
          return false;
        }
      },

      createOrder: async (items, customerName, paymentMethod, discount, gstEnabled, customerPhone?) => {
        try {
          // Calculate grand total for payment record
          const subtotal = items.reduce((s, i) => s + i.rate * i.quantity, 0);
          const tax = gstEnabled
            ? items.reduce((s, i) => s + (i.rate * i.quantity * (i.taxRate || 0)) / 100, 0)
            : 0;
          const grandTotal = Math.max(0, subtotal + tax - discount);

          const payload = {
            items: items.map(i => ({
              product: i.product._id,
              name: i.product.name,
              quantity: i.quantity,
              rate: i.rate,          // ✅ backend expects 'rate', not 'price'
              mrp: i.product.mrp || 0,    // ✅ carry MRP for PDF/print display
              discount: i.product.discount || 0, // ✅ carry discount % for PDF
              taxRate: gstEnabled ? (i.taxRate || 0) : 0,
              discountType: 'percentage',
              taxType: 'exclusive',
            })),
            customerName: customerName || 'Walk-in Customer',
            customerPhone: customerPhone || '',
            discount: discount || 0,
            isInterState: false,
            // ✅ Include payment so it's actually stored
            payments: [{
              method: paymentMethod || 'cash',
              amount: grandTotal,
            }],
          };

          const res = await api.post('/invoices', payload);
          if (!res.data?.success) throw new Error(res.data?.message || 'Invoice creation failed');

          const invoice = res.data.data?.invoice || res.data.data;

          // Build a properly-shaped Order for the orders page.
          // The raw invoice has no 'paymentMethod' field (payments is an array),
          // so we construct the Order using local variables we already have.
          const order: Order = {
            id: invoice._id,
            orderId: invoice.invoiceNumber || invoice._id,
            customerName: invoice.customerName || customerName || 'Walk-in Customer',
            items: items.map(i => ({
              name: i.product.name,
              qty: i.quantity,
              rate: i.rate,
              total: i.rate * i.quantity,
            })),
            subtotal,
            gst: tax,
            discount: discount || 0,
            grandTotal,
            paymentMethod: paymentMethod || 'cash',
            date: invoice.date || new Date().toISOString(),
          };

          set((s) => ({
            orders: [order, ...s.orders].slice(0, 1000),
          }));

          return { orderId: invoice.invoiceNumber || invoice._id, invoiceId: invoice._id };
        } catch (err: any) {
          console.error('Create order failed:', err?.response?.data || err?.message || err);
          return { orderId: '', invoiceId: '' };
        }
      },

      fetchOrders: async (query = '?limit=50') => {
        try {
          const res = await api.get(`/invoices${query}`);
          if (res.data?.success) {
            const { invoices, total = 0, pages = 1 } = res.data.data;
            const orders: Order[] = invoices.map((inv: any) => ({
              id: inv._id,
              orderId: inv.invoiceNumber || inv._id,
              customerName: inv.customerName || inv.customer?.name || 'Walk-in Customer',
              customerPhone: inv.customerPhone || inv.customer?.phone || '',
              items: (inv.items || []).map((i: any) => ({
                product: { _id: i.product?._id || i.product, name: i.name || i.product?.name || 'Unknown', unit: i.unit },
                name: i.name || i.product?.name || 'Unknown',
                qty: i.quantity,
                rate: i.rate,
                mrp: i.mrp || 0,
                discount: i.discount || 0,
                taxRate: i.taxRate || 0,
                total: i.amount || (i.rate * i.quantity),
              })),
              subtotal: inv.subtotal,
              gst: inv.totalTax || 0,
              discount: inv.totalDiscount || 0,
              grandTotal: inv.grandTotal,
              paymentMethod: inv.payments?.[0]?.method || 'cash',
              date: inv.date || inv.createdAt,
              notes: inv.notes,
            }));
            set({ orders });
            return { total, pages };
          }
          return { total: 0, pages: 1 };
        } catch (err) {
          console.error('Fetch orders failed:', err);
          return { total: 0, pages: 1 };
        }
      },

      deleteOrder: async (id: string) => {
        try {
          await api.delete(`/invoices/${id}`);
          set((s) => ({ orders: s.orders.filter(o => o.id !== id) }));
          return true;
        } catch (err) {
          console.error('Delete order failed', err);
          return false;
        }
      },

      updateOrder: async (id: string, payload: any) => {
        try {
          await api.put(`/invoices/${id}`, payload);
          // Re-fetch orders to ensure consistency
          get().fetchOrders();
          return true;
        } catch (err) {
          console.error('Update order failed', err);
          return false;
        }
      },
    })
);
