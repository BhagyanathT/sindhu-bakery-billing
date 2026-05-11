// src/lib/whatsapp.ts — Unified WhatsApp link builder
// On mobile: opens native WhatsApp app instantly (no browser page load)
// On desktop: opens WhatsApp Web

/**
 * Build the best WhatsApp link for the current device.
 * - Mobile/tablet → whatsapp://send (opens app instantly, zero loading)
 * - Desktop       → https://web.whatsapp.com/send (WhatsApp Web)
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(message);

  // Detect mobile/tablet
  const isMobile = typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // Native app protocol — opens WhatsApp instantly, no browser loading
    return `whatsapp://send?phone=${digits}&text=${encoded}`;
  }

  // Desktop — WhatsApp Web (faster than api.whatsapp.com)
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encoded}`;
}

/**
 * Build invoice WhatsApp message text
 */
export function buildInvoiceMsg(params: {
  orderId: string;
  customerName?: string;
  grandTotal: number;
  paymentMethod?: string;
  items?: { name: string; qty: number; rate: number }[];
}): string {
  const { orderId, customerName, grandTotal, paymentMethod, items } = params;

  let itemList = '';
  if (items && items.length > 0) {
    itemList = '\n' + items.map(i => `  • ${i.name} × ${i.qty} = ₹${(i.rate * i.qty).toFixed(0)}`).join('\n');
  }

  return `🧾 *Invoice from Sindhu Bakery*\n──────────────────────\nBill No: *${orderId}*\nCustomer: *${customerName || 'Walk-in Customer'}*${itemList}\n\n💰 *Total: ₹${grandTotal.toFixed(2)}*\nPayment: ${(paymentMethod || 'cash').toUpperCase()}\n\nThank you for shopping with us! 🙏\n_Sindhu Bakery, Marayamuttam_`;
}

/**
 * Open WhatsApp — no new browser tab ever.
 * Mobile: whatsapp:// opens the app, browser page stays untouched.
 * Desktop: opens wa.me in same tab (user expects browser nav).
 */
export function openWhatsApp(phone: string, message: string): void {
  const digits = phone.replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(message);

  const isMobile = typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // Native protocol → opens WhatsApp app instantly, browser page stays open
    const url = digits
      ? `whatsapp://send?phone=${digits}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`;
    window.location.href = url;
  } else {
    // Desktop → open WhatsApp Web in the SAME tab (as requested by user)
    const url = digits
      ? `https://web.whatsapp.com/send?phone=${digits}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`;
    window.location.href = url;
  }
}
