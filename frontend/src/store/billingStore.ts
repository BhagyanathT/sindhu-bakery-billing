// src/store/billingStore.ts — Multi-tab billing state for Sindhu Bakery POS
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from './productStore';

export interface CartItem {
  product: Product;
  quantity: number;
  rate: number;
  taxRate: number;
}

export interface BillingTab {
  id: string;
  label: string;
  cart: CartItem[];
  customerName: string;
  customerPhone: string;
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
  discount: number;
  gstEnabled: boolean;
  amountPaid: string;
  lastOrder: LastOrder | null;
  editOrderId?: string;
}

export interface LastOrder {
  orderId: string;
  invoiceId: string;
  customerPhone: string;
  items: CartItem[];
  totals: { subtotal: number; tax: number; items: number };
  grandTotal: number;
  customerName: string;
  discount: number;
  paymentMethod: string;
  printedAt: string;
}

function newTab(label: string): BillingTab {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    label,
    cart: [],
    customerName: '',
    customerPhone: '',
    paymentMethod: 'cash',
    discount: 0,
    gstEnabled: true,
    amountPaid: '',
    lastOrder: null,
  };
}

interface BillingStore {
  tabs: BillingTab[];
  activeTabId: string;
  tabCounter: number;

  // Tab management
  addTab: () => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, label: string) => void;

  // Patch any field(s) on a specific tab
  updateTab: (id: string, patch: Partial<Omit<BillingTab, 'id'>>) => void;

  // Cart helpers — all operate on the specified tab
  addToCart: (tabId: string, product: Product) => 'added' | 'incremented';
  updateQty: (tabId: string, productId: string, qty: number) => 'ok';
  removeItem: (tabId: string, productId: string) => void;
  clearTab: (tabId: string) => void;
}

export const useBillingStore = create<BillingStore>((set, get) => {
  const initialTab = newTab('Customer 1');

  return {
    tabs: [initialTab],
    activeTabId: initialTab.id,
    tabCounter: 1,

    addTab: () => {
      const counter = get().tabCounter + 1;
      const tab = newTab(`Customer ${counter}`);
      set((s) => ({
        tabs: [...s.tabs, tab],
        activeTabId: tab.id,
        tabCounter: counter,
      }));
      return tab.id;
    },

    removeTab: (id) => {
      const { tabs, activeTabId } = get();
      if (tabs.length === 1) return; // always keep at least one tab
      const idx = tabs.findIndex((t) => t.id === id);
      const newTabs = tabs.filter((t) => t.id !== id);
      let newActive = activeTabId;
      if (activeTabId === id) {
        // Switch to the tab before, or the first tab
        newActive = newTabs[Math.max(0, idx - 1)].id;
      }
      set({ tabs: newTabs, activeTabId: newActive });
    },

    setActiveTab: (id) => set({ activeTabId: id }),

    renameTab: (id, label) => {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, label } : t)),
      }));
    },

    updateTab: (id, patch) => {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }));
    },

    addToCart: (tabId, product) => {
      // Bakery items are made fresh — never block adding to cart
      let result: 'added' | 'incremented' = 'added';
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== tabId) return t;
          const existing = t.cart.find((i) => i.product._id === product._id);
          if (existing) {
            result = 'incremented';
            return {
              ...t,
              cart: t.cart.map((i) =>
                i.product._id === product._id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return {
            ...t,
            cart: [
              ...t.cart,
              { product, quantity: 1, rate: product.sellingPrice, taxRate: product.tax?.gstRate || 0 },
            ],
          };
        }),
      }));
      return result;
    },

    updateQty: (tabId, productId, qty) => {
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== tabId) return t;
          if (qty <= 0) {
            return { ...t, cart: t.cart.filter((i) => i.product._id !== productId) };
          }
          return {
            ...t,
            cart: t.cart.map((i) =>
              i.product._id === productId ? { ...i, quantity: qty } : i
            ),
          };
        }),
      }));
      return 'ok';
    },

    removeItem: (tabId, productId) => {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, cart: t.cart.filter((i) => i.product._id !== productId) }
            : t
        ),
      }));
    },

    clearTab: (tabId) => {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, cart: [], amountPaid: '', discount: 0, customerName: '', customerPhone: '', lastOrder: null, editOrderId: undefined }
            : t
        ),
      }));
    },
  };
});
