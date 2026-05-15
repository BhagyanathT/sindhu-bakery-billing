// src/lib/malayalamVoice.ts
// ═══════════════════════════════════════════════════════════════════
//  Sindhu Bakery POS — Hybrid Malayalam Neural TTS Engine v3.0
//  Primary  : Google Cloud WaveNet (ml-IN-Wavenet-A — Female)
//  Fallback : Web Speech API (browser built-in)
//  Goal     : Sound exactly like a real Kerala supermarket POS
// ═══════════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  synthesizeWithGoogle,
  playBase64Audio,
  clearAudioCache,
  type GoogleTTSOptions,
} from './googleCloudTTS';

// ─── Settings import (lazy to avoid circular deps) ────────────────────────────
// We read voiceSettings via a getter callback set by the hook
let _getSettings: (() => VoiceOptions & { googleApiKey?: string; ttsProvider?: string; pitch?: number }) | null = null;
export function registerSettingsGetter(
  fn: () => VoiceOptions & { googleApiKey?: string; ttsProvider?: string; pitch?: number }
) {
  _getSettings = fn;
}

// ─── Number → Malayalam Words ─────────────────────────────────────────────────

const ONES: string[] = [
  '', 'ഒന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'അഞ്ച്',
  'ആറ്', 'ഏഴ്', 'എട്ട്', 'ഒൻപത്', 'പത്ത്',
  'പതിനൊന്ന്', 'പന്ത്രണ്ട്', 'പതിമൂന്ന്', 'പതിന്നാല്', 'പതിനഞ്ച്',
  'പതിനാറ്', 'പതിനേഴ്', 'പതിനെട്ട്', 'പത്തൊൻപത്',
];

const TENS: string[] = [
  '', '', 'ഇരുപത്', 'മുപ്പത്', 'നാൽപ്പത്', 'അമ്പത്',
  'അറുപത്', 'എഴുപത്', 'എൺപത്', 'തൊണ്ണൂറ്',
];

const TENS_ONE: Record<number, string> = {
  21: 'ഇരുപത്തൊന്ന്', 22: 'ഇരുപത്തിരണ്ട്', 23: 'ഇരുപത്തിമൂന്ന്',
  24: 'ഇരുപത്തിനാല്', 25: 'ഇരുപത്തിയഞ്ച്', 26: 'ഇരുപത്തിയാറ്',
  27: 'ഇരുപത്തിയേഴ്', 28: 'ഇരുപത്തിയെട്ട്', 29: 'ഇരുപത്തൊൻപത്',
  31: 'മുപ്പത്തൊന്ന്', 32: 'മുപ്പത്തിരണ്ട്', 33: 'മുപ്പത്തിമൂന്ന്',
  34: 'മുപ്പത്തിനാല്', 35: 'മുപ്പത്തിയഞ്ച്', 36: 'മുപ്പത്തിയാറ്',
  37: 'മുപ്പത്തിയേഴ്', 38: 'മുപ്പത്തിയെട്ട്', 39: 'മുപ്പത്തൊൻപത്',
  41: 'നാൽപ്പത്തൊന്ന്', 42: 'നാൽപ്പത്തിരണ്ട്', 43: 'നാൽപ്പത്തിമൂന്ന്',
  44: 'നാൽപ്പത്തിനാല്', 45: 'നാൽപ്പത്തിയഞ്ച്', 46: 'നാൽപ്പത്തിയാറ്',
  47: 'നാൽപ്പത്തിയേഴ്', 48: 'നാൽപ്പത്തിയെട്ട്', 49: 'നാൽപ്പത്തൊൻപത്',
  51: 'അമ്പത്തൊന്ന്', 52: 'അമ്പത്തിരണ്ട്', 53: 'അമ്പത്തിമൂന്ന്',
  54: 'അമ്പത്തിനാല്', 55: 'അമ്പത്തിയഞ്ച്', 56: 'അമ്പത്തിയാറ്',
  57: 'അമ്പത്തിയേഴ്', 58: 'അമ്പത്തിയെട്ട്', 59: 'അമ്പത്തൊൻപത്',
  61: 'അറുപത്തൊന്ന്', 62: 'അറുപത്തിരണ്ട്', 63: 'അറുപത്തിമൂന്ന്',
  64: 'അറുപത്തിനാല്', 65: 'അറുപത്തിയഞ്ച്', 66: 'അറുപത്തിയാറ്',
  67: 'അറുപത്തിയേഴ്', 68: 'അറുപത്തിയെട്ട്', 69: 'അറുപത്തൊൻപത്',
  71: 'എഴുപത്തൊന്ന്', 72: 'എഴുപത്തിരണ്ട്', 73: 'എഴുപത്തിമൂന്ന്',
  74: 'എഴുപത്തിനാല്', 75: 'എഴുപത്തിയഞ്ച്', 76: 'എഴുപത്തിയാറ്',
  77: 'എഴുപത്തിയേഴ്', 78: 'എഴുപത്തിയെട്ട്', 79: 'എഴുപത്തൊൻപത്',
  81: 'എൺപത്തൊന്ന്', 82: 'എൺപത്തിരണ്ട്', 83: 'എൺപത്തിമൂന്ന്',
  84: 'എൺപത്തിനാല്', 85: 'എൺപത്തിയഞ്ച്', 86: 'എൺപത്തിയാറ്',
  87: 'എൺപത്തിയേഴ്', 88: 'എൺപത്തിയെട്ട്', 89: 'എൺപത്തൊൻപത്',
  91: 'തൊണ്ണൂറ്റൊന്ന്', 92: 'തൊണ്ണൂറ്റിരണ്ട്', 93: 'തൊണ്ണൂറ്റിമൂന്ന്',
  94: 'തൊണ്ണൂറ്റിനാല്', 95: 'തൊണ്ണൂറ്റിയഞ്ച്', 96: 'തൊണ്ണൂറ്റിയാറ്',
  97: 'തൊണ്ണൂറ്റിയേഴ്', 98: 'തൊണ്ണൂറ്റിയെട്ട്', 99: 'തൊണ്ണൂറ്റൊൻപത്',
};

const HUNDREDS: string[] = [
  '', 'നൂറ്', 'ഇരുനൂറ്', 'മുന്നൂറ്', 'നാനൂറ്', 'അഞ്ഞൂറ്',
  'അറുനൂറ്', 'എഴുനൂറ്', 'എണ്ണൂറ്', 'തൊള്ളായിരം',
];

function twoDigits(n: number): string {
  if (n <= 0) return '';
  if (n < 20) return ONES[n];
  if (n % 10 === 0) return TENS[Math.floor(n / 10)];
  return TENS_ONE[n] || (TENS[Math.floor(n / 10)] + ' ' + ONES[n % 10]);
}

/** Convert integer 0–99,999 to natural Malayalam words */
export function amountToMalayalam(n: number): string {
  const amount = Math.round(n);
  if (amount === 0) return 'പൂജ്യം';
  if (amount < 0) return 'മൈനസ് ' + amountToMalayalam(-amount);

  const parts: string[] = [];

  if (amount >= 10000) {
    const ten_thousands = Math.floor(amount / 10000);
    parts.push(twoDigits(ten_thousands) + ' പതിനായിരം');
  } else if (amount >= 1000) {
    const thousands = Math.floor(amount / 1000);
    if (thousands === 1) parts.push('ഒരു ആയിരം');
    else parts.push(twoDigits(thousands) + ' ആയിരം');
  }

  const rem = amount % 1000;
  if (rem === 0) return parts.join(' ');

  const h = Math.floor(rem / 100);
  const rest = rem % 100;

  if (h > 0) {
    parts.push(rest === 0 ? HUNDREDS[h] : HUNDREDS[h] + 'ടി');
  }
  if (rest > 0) parts.push(twoDigits(rest));

  return parts.join(' ');
}

// ─── Payment Method Labels ─────────────────────────────────────────────────────

export const PAYMENT_MALAYALAM: Record<string, string> = {
  cash:   'ക്യാഷ്',
  upi:    'ഫോൺ‌പേ',
  gpay:   'ഗൂഗിൾ പേ',
  phonepe:'ഫോൺ‌പേ',
  paytm:  'പേ‌ടിഎം',
  card:   'കാർഡ്',
  credit: 'ക്രെഡിറ്റ്',
  debit:  'ഡെബിറ്റ് കാർഡ്',
};

// ─── Speech Event Listeners ───────────────────────────────────────────────────

export interface SpeechEvent {
  text: string | null;
  provider: 'google' | 'browser' | null;
}

const listeners = new Set<(ev: SpeechEvent) => void>();

export function onSpeechChange(cb: (ev: SpeechEvent) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notifyListeners(ev: SpeechEvent) {
  listeners.forEach(cb => cb(ev));
}

// ─── Job Queue ────────────────────────────────────────────────────────────────

export interface VoiceOptions {
  volume?: number;
  rate?: number;
  pitch?: number;
  voiceURI?: string | null;
}

interface SpeechJob {
  text: string;
  opts: VoiceOptions;
  /** pause in ms BEFORE this job */
  pauseBefore?: number;
}

let queue: SpeechJob[] = [];
let isSpeaking = false;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
let warmUpDone = false;

function clearWatchdog() {
  if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
}

// ─── Provider: Web Speech API ─────────────────────────────────────────────────

function pickBrowserVoice(voiceURI?: string | null): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  if (voiceURI) {
    const v = voices.find(v => v.voiceURI === voiceURI);
    if (v) return v;
  }
  return (
    voices.find(v => v.lang === 'ml-IN') ||
    voices.find(v => v.lang.startsWith('ml')) ||
    voices.find(v => v.lang === 'hi-IN') ||
    voices.find(v => v.lang === 'en-IN') ||
    voices.find(v => v.default) ||
    voices[0] || null
  );
}

/** Warm up Web Speech API — Chrome needs a first empty utterance */
function warmUpBrowserTTS() {
  if (warmUpDone || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  warmUpDone = true;
  try {
    const utt = new SpeechSynthesisUtterance('');
    utt.volume = 0;
    window.speechSynthesis.speak(utt);
  } catch { /* ignore */ }
}

function speakWithBrowser(job: SpeechJob): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const utt = new SpeechSynthesisUtterance(job.text);

    const doSpeak = () => {
      const voice = pickBrowserVoice(job.opts.voiceURI);
      if (voice) { utt.voice = voice; utt.lang = voice.lang; }
      else utt.lang = 'ml-IN';

      utt.volume = Math.max(0, Math.min(1, job.opts.volume ?? 1));
      utt.rate   = Math.max(0.5, Math.min(1.5, job.opts.rate ?? 0.82));
      utt.pitch  = Math.max(0, Math.min(2, job.opts.pitch ?? 1.0));

      const finish = () => { clearWatchdog(); resolve(); };
      utt.onend   = finish;
      utt.onerror = (e) => {
        console.warn('[Voice] Browser TTS error:', e.error);
        finish();
      };

      // Safety watchdog — Chrome bug: onend sometimes never fires
      const wdMs = Math.max(5000, job.text.length * 200);
      watchdogTimer = setTimeout(() => {
        console.warn('[Voice] Watchdog fired — resetting');
        finish();
      }, wdMs);

      synth.speak(utt);
    };

    const voices = synth.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      let handled = false;
      const onReady = () => {
        if (handled) return;
        handled = true;
        synth.removeEventListener('voiceschanged', onReady);
        doSpeak();
      };
      synth.addEventListener('voiceschanged', onReady);
      setTimeout(onReady, 2000);
    }
  });
}

// ─── Provider: Google Cloud WaveNet ──────────────────────────────────────────

async function speakWithGoogle(job: SpeechJob, googleOpts: GoogleTTSOptions): Promise<boolean> {
  const b64 = await synthesizeWithGoogle(job.text, googleOpts);
  if (!b64) return false;
  await playBase64Audio(b64, job.opts.volume ?? 1);
  return true;
}

// ─── Core Queue Processor ─────────────────────────────────────────────────────

async function processQueue() {
  if (isSpeaking || queue.length === 0) return;
  isSpeaking = true;

  const job = queue.shift()!;

  // Natural pause before utterance
  if (job.pauseBefore && job.pauseBefore > 0) {
    await new Promise(r => setTimeout(r, job.pauseBefore));
  }

  notifyListeners({ text: job.text, provider: null });

  // Determine provider from settings
  const settings = _getSettings?.();
  const provider  = settings?.ttsProvider ?? 'browser';
  const apiKey    = settings?.googleApiKey ?? '';

  let usedGoogle = false;

  if (provider === 'google' && apiKey) {
    const googleOpts: GoogleTTSOptions = {
      apiKey,
      voiceName: 'ml-IN-Wavenet-A',
      speakingRate: job.opts.rate ?? 0.9,
      pitch:        job.opts.pitch ?? -1.5,
      volumeGainDb: 2.0,
    };
    notifyListeners({ text: job.text, provider: 'google' });
    usedGoogle = await speakWithGoogle(job, googleOpts);
  }

  if (!usedGoogle) {
    notifyListeners({ text: job.text, provider: 'browser' });
    await speakWithBrowser(job);
  }

  notifyListeners({ text: null, provider: null });

  isSpeaking = false;

  // Natural 180 ms gap between utterances for realistic rhythm
  setTimeout(processQueue, 180);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Enqueue a text utterance (max queue depth 12) */
export function speak(text: string, opts: VoiceOptions = {}, pauseBefore = 0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!text.trim()) return;
  if (queue.length >= 12) return;
  warmUpBrowserTTS();
  queue.push({ text, opts, pauseBefore });
  processQueue();
}

/** Cancel everything immediately */
export function stopSpeech() {
  if (typeof window === 'undefined') return;
  clearWatchdog();
  queue = [];
  isSpeaking = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  notifyListeners({ text: null, provider: null });
}

/** Play a test phrase (clears queue first) */
export function testPhrase(text: string, opts: VoiceOptions = {}) {
  stopSpeech();
  speak(text, opts);
}

/** Get all available browser voices */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

/** Check if speech synthesis is supported */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Call when Google API key changes — clears audio cache */
export function onApiKeyChange() {
  clearAudioCache();
}

// ─── High-Level Announcement Functions ───────────────────────────────────────

/** "ബിൽ വിജയകരമായി തയ്യാറാക്കി" */
export function announceBillGenerated(opts: VoiceOptions = {}) {
  speak('ബിൽ വിജയകരമായി തയ്യാറാക്കി', opts);
}

/** "ആകെ തുക [amount] രൂപ" */
export function announceTotalAmount(amount: number, opts: VoiceOptions = {}) {
  const words = amountToMalayalam(Math.round(amount));
  speak(`ആകെ തുക ${words} രൂപ`, opts);
}

/** "ഫോൺ‌പേ / ക്യാഷ് / കാർഡ് വഴി [amount] രൂപ അടച്ചു" */
export function announcePaymentReceived(method: string, amount: number, opts: VoiceOptions = {}) {
  const methodWord = PAYMENT_MALAYALAM[method.toLowerCase()] || method;
  const words = amountToMalayalam(Math.round(amount));
  speak(`${methodWord} വഴി ${words} രൂപ അടച്ചു`, opts, 120);
}

/** "UPI പേയ്‌മെന്റ് വിജയകരമായി" */
export function announceUPISuccess(opts: VoiceOptions = {}) {
  speak('യൂ‌പി‌ഐ പേയ്‌മെന്റ് വിജയകരമായി', opts, 100);
}

/** "ബാക്കി തുക [amount] രൂപ" */
export function announceChange(amount: number, opts: VoiceOptions = {}) {
  if (amount <= 0) return;
  const words = amountToMalayalam(Math.round(amount));
  speak(`ബാക്കി തുക ${words} രൂപ`, opts, 120);
}

/** "കുടിശ്ശിക തുക [amount] രൂപ" */
export function announcePendingAmount(amount: number, opts: VoiceOptions = {}) {
  if (amount <= 0) return;
  const words = amountToMalayalam(Math.round(amount));
  speak(`കുടിശ്ശിക തുക ${words} രൂപ`, opts, 120);
}

/** "നന്ദി, വീണ്ടും വരിക" */
export function announceThankYou(opts: VoiceOptions = {}) {
  speak('നന്ദി, വീണ്ടും വരിക', opts, 200);
}

/** "[productName] ചേർത്തു" */
export function announceItemAdded(productName: string, opts: VoiceOptions = {}) {
  speak(`${productName} ചേർത്തു`, opts);
}

/**
 * Full bill announcement sequence:
 * Bill generated → Total → Payment → Change → Thank you
 */
export function announceFullBill(params: {
  amount: number;
  paymentMethod: string;
  change?: number;
  opts?: VoiceOptions;
}) {
  const { amount, paymentMethod, change = 0, opts = {} } = params;
  announceBillGenerated(opts);
  announceTotalAmount(amount, opts);

  if (paymentMethod.toLowerCase() === 'upi') {
    announceUPISuccess(opts);
  }
  announcePaymentReceived(paymentMethod, amount, opts);

  if (change > 0) announceChange(change, opts);
  announceThankYou(opts);
}

/**
 * Flash bill (short): Total → Payment → Thank you
 */
export function announceFlashBill(params: {
  amount: number;
  paymentMethod: string;
  opts?: VoiceOptions;
}) {
  const { amount, paymentMethod, opts = {} } = params;
  announceTotalAmount(amount, opts);

  if (paymentMethod.toLowerCase() === 'upi') {
    announceUPISuccess(opts);
  }
  announcePaymentReceived(paymentMethod, amount, opts);
  announceThankYou(opts);
}
