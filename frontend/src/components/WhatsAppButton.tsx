'use client';
// src/components/WhatsAppButton.tsx — Fast WhatsApp button (native app on mobile)
import { useState } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { openWhatsApp, buildInvoiceMsg } from '@/lib/whatsapp';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  invoiceId?: string;
  phone?: string;
  customerName?: string;
  grandTotal?: number;
  paymentMethod?: string;
  orderId?: string;
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
  message?: string; // custom override message
}

export default function WhatsAppButton({
  invoiceId,
  phone,
  customerName,
  grandTotal = 0,
  paymentMethod,
  orderId,
  className = '',
  size = 'md',
  label,
  message,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!phone) { toast.error('No phone number for this customer!'); return; }

    setLoading(true);
    try {
      let msg = message;

      // If we have an invoiceId, try to get the full invoice details from backend
      if (invoiceId && !msg) {
        try {
          const res = await api.get(`/whatsapp/preview/invoice/${invoiceId}`);
          msg = res.data?.data?.body;
        } catch {
          // fallback — build message client-side
          msg = buildInvoiceMsg({ orderId: orderId || invoiceId, customerName, grandTotal, paymentMethod });
        }
      }

      if (!msg) {
        msg = buildInvoiceMsg({ orderId: orderId || 'N/A', customerName, grandTotal, paymentMethod });
      }

      // Log to backend (fire and forget — don't block UI)
      if (invoiceId) {
        api.post(`/whatsapp/send/bill/${invoiceId}`, { phone }).catch(() => {});
      }

      openWhatsApp(phone, msg);
    } catch (err) {
      toast.error('Could not open WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const base = size === 'sm'
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95'
    : 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95';

  return (
    <button
      onClick={handleClick}
      disabled={loading || !phone}
      className={`${base} bg-[#25D366] hover:bg-[#1ebe5d] text-white shadow-lg shadow-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      title={phone ? 'Send via WhatsApp' : 'No phone number'}
      id="wa-send-btn"
    >
      {loading
        ? <Loader2 className={size === 'sm' ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} />
        : <MessageCircle className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {label ?? (size === 'sm' ? 'WhatsApp' : 'Send via WhatsApp')}
    </button>
  );
}
