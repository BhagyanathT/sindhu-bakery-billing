'use client';
// src/components/WhatsAppPreviewModal.tsx — Preview + PDF toggle before sending
import { useEffect, useState } from 'react';
import { X, Send, ExternalLink, Loader2, Edit3, Check, FileText, Download } from 'lucide-react';
import { useWhatsAppStore } from '@/store/whatsappStore';

interface Props {
  invoiceId: string;
  phone?: string;
  sendPdf?: boolean;
  onClose: () => void;
  onSend: (customMessage?: string) => void;
}

export default function WhatsAppPreviewModal({ invoiceId, phone, sendPdf = false, onClose, onSend }: Props) {
  const { previewInvoice } = useWhatsAppStore();
  const [preview, setPreview] = useState<{ body: string; deepLinkUrl?: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');
  const [manualPhone, setManualPhone] = useState(phone || '');

  useEffect(() => {
    previewInvoice(invoiceId).then((data) => {
      setPreview(data);
      setEditedBody(data?.body || '');
      if (data?.phone && !phone) setManualPhone(data.phone);
      setLoading(false);
    });
  }, [invoiceId]);

  const handleSend = async () => {
    setSending(true);
    await onSend(editing ? editedBody : undefined);
    setSending(false);
  };

  const openDeepLink = () => {
    const body = editing ? editedBody : preview?.body || '';
    const digits = manualPhone.replace(/[^\d]/g, '');
    if (!digits) return;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(body)}`, '_blank');
  };

  // Format WhatsApp bold (*text*) for HTML preview
  const formatBody = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-200 dark:border-stone-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center">
              <span className="text-white text-lg">💬</span>
            </div>
            <div>
              <h3 className="font-bold text-stone-800 dark:text-stone-100 text-sm">WhatsApp Preview</h3>
              <p className="text-xs text-stone-400">
                {sendPdf ? '📄 PDF + message' : '💬 Text message'} · Review before sending
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* PDF badge */}
          {sendPdf && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                A PDF invoice will be generated and a download link appended to the message.
              </p>
            </div>
          )}

          {/* Phone input */}
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1.5">Customer Phone</label>
            <input
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          {/* Message preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-500">Message Preview</label>
              <button
                onClick={() => setEditing(!editing)}
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                  editing ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 dark:bg-stone-700 text-stone-500 hover:text-stone-700'
                }`}
              >
                {editing ? <><Check className="w-3 h-3" /> Done</> : <><Edit3 className="w-3 h-3" /> Edit</>}
              </button>
            </div>

            {loading ? (
              <div className="h-40 flex items-center justify-center bg-stone-50 dark:bg-stone-900 rounded-2xl">
                <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
              </div>
            ) : editing ? (
              <textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={12}
                className="w-full px-3 py-3 rounded-2xl border border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
              />
            ) : (
              /* WhatsApp bubble preview */
              <div className="bg-[#ECE5DD] dark:bg-stone-900 rounded-2xl p-3">
                <div className="bg-white dark:bg-stone-700 rounded-xl p-3 shadow-sm max-w-[90%] ml-auto">
                  <div
                    className="text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-sans"
                    dangerouslySetInnerHTML={{ __html: formatBody(preview?.body || '') }}
                  />
                  {sendPdf && (
                    <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-600">
                      <div className="flex items-center gap-1.5 text-xs text-blue-600">
                        <Download className="w-3 h-3" />
                        <span className="font-medium">📄 PDF download link will appear here</span>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-stone-400 text-right mt-1.5">
                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t border-stone-200 dark:border-stone-700">
          <button
            onClick={openDeepLink}
            disabled={!manualPhone}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#25D366] text-[#25D366] font-semibold text-sm hover:bg-[#25D366]/10 transition-colors disabled:opacity-50"
          >
            <ExternalLink className="w-4 h-4" /> Open in WhatsApp
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !manualPhone || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send via API'}
          </button>
        </div>
      </div>
    </div>
  );
}
