// src/store/whatsappStore.ts
import { create } from 'zustand';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export interface WaMessage {
  _id: string;
  phone: string;
  messageType: 'invoice' | 'promo' | 'alert' | 'custom' | 'order_status';
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  provider: 'twilio' | 'deeplink' | 'meta' | 'wa_web';
  createdAt: string;
  customer?: { _id: string; name: string; phone: string };
  invoiceRef?: { _id: string; invoiceNumber: string; grandTotal: number };
  sentBy?: { name: string };
  errorMessage?: string;
}

export interface WaTemplate {
  _id: string;
  name: string;
  type: string;
  body: string;
  isActive: boolean;
}

export interface WaConfig {
  enabled: boolean;
  provider: 'twilio' | 'meta';
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  adminPhone?: string;
  autoSendInvoice: boolean;
  autoSendPromo: boolean;
}

export interface WaStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  recentMessages: WaMessage[];
}

export interface SendBillResult {
  deepLinkUrl: string;
  phone: string;
  sendPdf: boolean;
  pdfShortUrl: string | null;
  pdfShortId: string | null;
  messageBody: string;
}

// ── WhatsApp Web QR session types ─────────────────────────────────────────────
export type WaWebStatus = 'idle' | 'loading' | 'qr' | 'authenticated' | 'connected' | 'disconnected' | 'not_installed';

export interface WaWebState {
  status: WaWebStatus;
  phone: string | null;
  qr: string | null;  // base64 PNG data URL
}

interface WhatsAppState {
  messages: WaMessage[];
  totalMessages: number;
  stats: WaStats | null;
  config: WaConfig | null;
  templates: WaTemplate[];
  loading: boolean;
  sendingBill: boolean;

  // WA Web QR session state
  waWeb: WaWebState;

  fetchHistory: (params?: Record<string, any>) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  saveConfig: (config: Partial<WaConfig>) => Promise<boolean>;
  fetchTemplates: () => Promise<void>;
  saveTemplate: (template: Partial<WaTemplate>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;

  sendInvoice: (invoiceId: string, phone?: string, customMessage?: string) => Promise<{ deepLinkUrl?: string; provider: string } | null>;
  sendCustom: (data: { phone?: string; customerId?: string; body: string; messageType?: string }) => Promise<{ deepLinkUrl?: string; provider: string } | null>;
  sendPromo: (data: { productId?: string; customerIds?: string[]; customMessage?: string }) => Promise<any>;
  sendLowStockAlert: (phone?: string) => Promise<{ deepLinkUrl?: string; provider: string } | null>;
  previewInvoice: (invoiceId: string) => Promise<{ body: string; deepLinkUrl?: string; phone: string } | null>;
  sendBill: (invoiceId: string, opts: { sendPdf?: boolean; phone?: string }) => Promise<SendBillResult | null>;

  // WA Web session actions
  fetchWaWebStatus: () => Promise<void>;
  disconnectWaWeb: () => Promise<void>;
  reconnectWaWeb: () => Promise<void>;
  setWaWebState: (state: Partial<WaWebState>) => void;
}

export const useWhatsAppStore = create<WhatsAppState>((set, get) => ({
  messages: [],
  totalMessages: 0,
  stats: null,
  config: null,
  templates: [],
  loading: false,
  sendingBill: false,
  waWeb: { status: 'idle', phone: null, qr: null },

  setWaWebState: (state) => set((s) => ({ waWeb: { ...s.waWeb, ...state } })),

  fetchHistory: async (params = {}) => {
    set({ loading: true });
    try {
      const res = await api.get('/whatsapp/messages', { params });
      set({ messages: res.data.data.messages, totalMessages: res.data.data.total });
    } catch { toast.error('Failed to load message history'); }
    finally { set({ loading: false }); }
  },

  fetchStats: async () => {
    try {
      const res = await api.get('/whatsapp/stats');
      set({ stats: res.data.data });
    } catch {}
  },

  fetchConfig: async () => {
    try {
      const res = await api.get('/whatsapp/config');
      set({ config: res.data.data });
    } catch {}
  },

  saveConfig: async (config) => {
    try {
      await api.put('/whatsapp/config', config);
      await get().fetchConfig();
      toast.success('WhatsApp settings saved');
      return true;
    } catch {
      toast.error('Failed to save settings');
      return false;
    }
  },

  fetchTemplates: async () => {
    try {
      const res = await api.get('/whatsapp/templates');
      set({ templates: res.data.data });
    } catch {}
  },

  saveTemplate: async (template) => {
    try {
      await api.post('/whatsapp/templates', template);
      await get().fetchTemplates();
      toast.success(template._id ? 'Template updated' : 'Template saved');
      return true;
    } catch { toast.error('Failed to save template'); return false; }
  },

  deleteTemplate: async (id) => {
    try {
      await api.delete(`/whatsapp/templates/${id}`);
      set((s) => ({ templates: s.templates.filter((t) => t._id !== id) }));
      toast.success('Template deleted');
      return true;
    } catch { toast.error('Failed to delete template'); return false; }
  },

  sendInvoice: async (invoiceId, phone, customMessage) => {
    try {
      const res = await api.post(`/whatsapp/send/invoice/${invoiceId}`, { phone, customMessage });
      toast.success('Invoice sent via WhatsApp! ✅');
      return res.data.data;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send');
      return null;
    }
  },

  sendCustom: async (data) => {
    try {
      const res = await api.post('/whatsapp/send/custom', data);
      toast.success('Message sent! ✅');
      return res.data.data;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send');
      return null;
    }
  },

  sendPromo: async (data) => {
    try {
      const res = await api.post('/whatsapp/send/promo', data);
      const { sent, failed, total } = res.data.data;
      toast.success(`Promo sent to ${sent}/${total} customers`);
      return res.data.data;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send promo');
      return null;
    }
  },

  sendLowStockAlert: async (phone) => {
    try {
      const res = await api.post('/whatsapp/send/alert/lowstock', { phone });
      const { products } = res.data.data;
      if (products === 0) toast.success('All products are well-stocked! ✅');
      else toast.success(`Low stock alert sent for ${products} product(s)`);
      return res.data.data;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send alert');
      return null;
    }
  },

  previewInvoice: async (invoiceId) => {
    try {
      const res = await api.get(`/whatsapp/preview/invoice/${invoiceId}`);
      return res.data.data;
    } catch { return null; }
  },

  sendBill: async (invoiceId, { sendPdf = false, phone } = {}) => {
    set({ sendingBill: true });
    try {
      const res = await api.post(`/whatsapp/send/bill/${invoiceId}`, { sendPdf, phone });
      const data = res.data.data;
      if (sendPdf && data.pdfShortUrl) {
        toast.success('PDF bill prepared! Opening WhatsApp… 📄');
      } else {
        toast.success('Bill prepared! Opening WhatsApp… 💬');
      }
      return data;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to prepare bill');
      return null;
    } finally {
      set({ sendingBill: false });
    }
  },

  // ── WA Web QR session ───────────────────────────────────────────────────────
  fetchWaWebStatus: async () => {
    try {
      const res = await api.get('/whatsapp/web/status');
      set((s) => ({ waWeb: { ...s.waWeb, ...res.data.data } }));
    } catch {}
  },

  disconnectWaWeb: async () => {
    try {
      await api.post('/whatsapp/web/disconnect');
      set((s) => ({ waWeb: { ...s.waWeb, status: 'disconnected', phone: null, qr: null } }));
      toast.success('WhatsApp Web disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  },

  reconnectWaWeb: async () => {
    try {
      set((s) => ({ waWeb: { ...s.waWeb, status: 'loading', qr: null } }));
      await api.post('/whatsapp/web/reconnect');
      toast.success('Reconnecting… scan the new QR code');
    } catch {
      toast.error('Failed to reconnect');
    }
  },
}));
