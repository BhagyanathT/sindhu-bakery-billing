'use client';
// src/components/WaWebConnect.tsx — WhatsApp Web QR scanner panel
import { useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, LogOut, Loader2, Smartphone, Terminal, Copy } from 'lucide-react';
import { useWhatsAppStore, WaWebStatus } from '@/store/whatsappStore';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

// Lazy-load socket.io-client (only when this component mounts)
let _socket: any = null;
const getSocket = () => {
  if (typeof window === 'undefined') return null;
  if (_socket && _socket.connected) return _socket;
  try {
    const { io } = require('socket.io-client');
    const BACKEND = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    _socket = io(BACKEND, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
    });
  } catch (e) {
    console.warn('socket.io-client not available', e);
  }
  return _socket;
};

const STATUS_META: Record<WaWebStatus, { label: string; dotColor: string; badgeClass: string }> = {
  idle:          { label: 'Initialising…',    dotColor: 'bg-stone-300',   badgeClass: 'bg-stone-100 text-stone-500' },
  loading:       { label: 'Connecting…',      dotColor: 'bg-amber-400',   badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  qr:            { label: 'Scan QR Code',     dotColor: 'bg-blue-400',    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  authenticated: { label: 'Authenticated',    dotColor: 'bg-emerald-400', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  connected:     { label: 'Connected',        dotColor: 'bg-emerald-500', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  disconnected:  { label: 'Disconnected',     dotColor: 'bg-red-400',     badgeClass: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  not_installed: { label: 'Package Missing',  dotColor: 'bg-orange-400',  badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
};

const INSTALL_CMD = 'npm install whatsapp-web.js qrcode';

export function WaWebConnect() {
  const { waWeb, fetchWaWebStatus, disconnectWaWeb, reconnectWaWeb, setWaWebState } = useWhatsAppStore();
  const socketRef = useRef<any>(null);

  // ── Mount: fetch HTTP status + subscribe to Socket.IO events ───────────────
  useEffect(() => {
    fetchWaWebStatus();

    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    const onStatus = (data: { status: WaWebStatus; phone: string | null; qr: string | null }) => {
      setWaWebState(data);
      if (data.status === 'connected') toast.success(`✅ WhatsApp connected: ${data.phone || ''}`);
      if (data.status === 'disconnected') toast.error('WhatsApp Web disconnected');
    };

    socket.on('wa:status', onStatus);
    return () => { socket.off('wa:status', onStatus); };
  }, []);

  const meta = STATUS_META[waWeb.status] ?? STATUS_META.idle;
  const isSpinning = waWeb.status === 'idle' || waWeb.status === 'loading' || waWeb.status === 'authenticated';

  const copyInstallCmd = () => {
    navigator.clipboard.writeText(`cd "e:\\sindu baker billing\\backend" && ${INSTALL_CMD}`).then(() => {
      toast.success('Command copied!');
    });
  };

  return (
    <div className="max-w-lg space-y-5">

      {/* Status card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-800 dark:text-stone-100 text-lg">📱 WhatsApp Web</h3>
          <span className={clsx('flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full', meta.badgeClass)}>
            <span className={clsx('w-2 h-2 rounded-full', isSpinning ? 'animate-pulse' : '', meta.dotColor)} />
            {meta.label}
          </span>
        </div>

        {/* ── NOT INSTALLED ─────────────────────────────────────────────────── */}
        {waWeb.status === 'not_installed' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-200 dark:border-orange-800">
              <Terminal className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-orange-700 dark:text-orange-400 text-sm">Package not installed</p>
                <p className="text-xs text-stone-500 mt-1">
                  <code className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded text-xs font-mono">whatsapp-web.js</code> needs
                  to be installed in your backend. Run the command below in your terminal, then restart the backend server.
                </p>
              </div>
            </div>

            {/* Install command box */}
            <div className="rounded-2xl bg-stone-900 dark:bg-stone-950 overflow-hidden border border-stone-700">
              <div className="flex items-center justify-between px-4 py-2 bg-stone-800 border-b border-stone-700">
                <span className="text-xs text-stone-400 font-mono">Terminal — backend folder</span>
                <button onClick={copyInstallCmd}
                  className="flex items-center gap-1 text-xs text-stone-400 hover:text-white transition-colors">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
              <div className="px-4 py-3 space-y-1 font-mono text-sm">
                <p className="text-stone-400 text-xs select-none"># Step 1 — navigate to backend</p>
                <p className="text-green-400">cd &quot;e:\sindu baker billing\backend&quot;</p>
                <p className="text-stone-400 text-xs mt-2 select-none"># Step 2 — install packages (~170MB first time)</p>
                <p className="text-green-400">{INSTALL_CMD}</p>
                <p className="text-stone-400 text-xs mt-2 select-none"># Step 3 — restart backend</p>
                <p className="text-green-400">npm run dev</p>
              </div>
            </div>

            <p className="text-xs text-stone-400 text-center">
              After restart, come back here — the QR code will appear automatically.
            </p>
          </div>
        )}

        {/* ── CONNECTED ────────────────────────────────────────────────────── */}
        {waWeb.status === 'connected' && (
          <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
            <div className="w-12 h-12 rounded-full bg-[#25D366]/20 flex items-center justify-center text-2xl">📱</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-emerald-700 dark:text-emerald-400">Session Active</p>
              <p className="text-sm text-stone-500 truncate">{waWeb.phone || 'WhatsApp account connected'}</p>
              <p className="text-xs text-stone-400 mt-0.5">Messages send automatically via this account</p>
            </div>
            <Wifi className="w-6 h-6 text-emerald-500 shrink-0" />
          </div>
        )}

        {/* ── QR CODE ──────────────────────────────────────────────────────── */}
        {waWeb.status === 'qr' && waWeb.qr && (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-sm text-stone-500 text-center">
              Open WhatsApp → <strong>Settings → Linked Devices → Link a Device</strong>
            </p>
            <div className="p-3 bg-white rounded-2xl shadow-lg border border-stone-200 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={waWeb.qr} alt="WhatsApp QR Code" className="w-56 h-56 rounded-xl" />
            </div>
            <p className="text-xs text-stone-400 text-center">QR auto-refreshes. Keep this page open.</p>
          </div>
        )}

        {/* ── QR state but no data yet ─────────────────────────────────────── */}
        {waWeb.status === 'qr' && !waWeb.qr && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            <p className="text-sm text-stone-500">Generating QR code…</p>
          </div>
        )}

        {/* ── LOADING / IDLE / AUTHENTICATED ───────────────────────────────── */}
        {isSpinning && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
            <p className="text-sm text-stone-500">
              {waWeb.status === 'authenticated' ? 'Session restored — finishing startup…' : 'Initialising WhatsApp Web…'}
            </p>
            <p className="text-xs text-stone-400">May take up to 30 seconds on first launch</p>
          </div>
        )}

        {/* ── DISCONNECTED ─────────────────────────────────────────────────── */}
        {waWeb.status === 'disconnected' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <WifiOff className="w-10 h-10 text-red-400" />
            <p className="text-sm text-stone-500">No active WhatsApp Web session</p>
            <p className="text-xs text-stone-400">Click <strong>Reconnect</strong> to generate a QR code</p>
          </div>
        )}

        {/* ── ACTION BUTTONS ────────────────────────────────────────────────── */}
        {waWeb.status !== 'not_installed' && (
          <div className="flex gap-3 pt-2">
            {(waWeb.status === 'disconnected' || waWeb.status === 'connected') && (
              <button onClick={reconnectWaWeb}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-semibold text-sm transition-colors">
                <RefreshCw className="w-4 h-4" />
                {waWeb.status === 'connected' ? 'Relink Account' : 'Reconnect'}
              </button>
            )}
            {waWeb.status === 'connected' && (
              <button onClick={disconnectWaWeb}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold text-sm transition-colors">
                <LogOut className="w-4 h-4" /> Disconnect
              </button>
            )}
            <button onClick={fetchWaWebStatus} title="Refresh status"
              className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-500 text-sm font-semibold transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Refresh button alone for not_installed */}
        {waWeb.status === 'not_installed' && (
          <button onClick={fetchWaWebStatus}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-700 text-stone-500 font-semibold text-sm transition-colors">
            <RefreshCw className="w-4 h-4" /> Check again after installing
          </button>
        )}
      </div>

      {/* How it works — only show when installed */}
      {waWeb.status !== 'not_installed' && (
        <div className="card p-5 border-l-4 border-l-[#25D366] space-y-3">
          <p className="text-sm font-bold text-stone-700 dark:text-stone-300">💡 How it works</p>
          <ol className="text-xs text-stone-500 space-y-1.5 list-decimal list-inside">
            <li>Click <strong>Reconnect</strong> — QR code appears</li>
            <li>Open WhatsApp → Settings → Linked Devices → Link a Device</li>
            <li>Scan the QR — status turns <span className="text-emerald-600 font-semibold">Connected</span></li>
            <li>All invoices &amp; messages send automatically</li>
            <li>Session persists across restarts — <strong>scan once only</strong></li>
          </ol>
        </div>
      )}

      {/* Upgrade path */}
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 space-y-1.5">
        <p className="text-xs font-bold text-blue-600 dark:text-blue-400">🚀 Production Upgrade: Twilio / Meta Cloud API</p>
        <p className="text-xs text-stone-500">
          For high-volume messaging, set up Twilio in the <strong>Settings</strong> tab. It takes priority over WA Web when credentials are saved.
        </p>
      </div>

    </div>
  );
}
