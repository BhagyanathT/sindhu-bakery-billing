// src/lib/malayalamVoice.ts
// Sindhu Bakery POS — Malayalam TTS Engine v4.0
// Primary  : Google Cloud WaveNet (ml-IN-Wavenet-A)
// Fallback : Web Speech API (browser built-in) — RELIABLE
// Style    : Natural Kerala supermarket speech

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  synthesizeWithGoogle,
  playBase64Audio,
  clearAudioCache,
  type GoogleTTSOptions,
} from './googleCloudTTS';

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

const HUNDREDS_PREFIX: string[] = [
  '', 'നൂറ്റി', 'ഇരുനൂറ്റി', 'മുന്നൂറ്റി', 'നാനൂറ്റി', 'അഞ്ഞൂറ്റി',
  'അറുനൂറ്റി', 'എഴുനൂറ്റി', 'എണ്ണൂറ്റി', 'തൊള്ളായിരത്തി',
];

function twoDigits(n: number): string {
  if (n <= 0) return '';
  if (n < 20) return ONES[n];
  if (n % 10 === 0) return TENS[Math.floor(n / 10)];
  return TENS_ONE[n] || (TENS[Math.floor(n / 10)] + ' ' + ONES[n % 10]);
}

export function amountToMalayalam(n: number, asAdjective = false): string {
  if (n === null || n === undefined || isNaN(n)) return '';
  const amount = Math.round(n);
  if (amount === 0) return 'പൂജ്യം';
  if (amount < 0) return 'മൈനസ് ' + amountToMalayalam(-amount, asAdjective);

  if (asAdjective && amount === 1) return 'ഒരു';
  if (asAdjective && amount === 2) return 'രണ്ടു';

  const parts: string[] = [];
  const rem = amount % 1000;

  if (amount >= 100000) {
    const lakhs = Math.floor(amount / 100000);
    const lakhRem = amount % 100000;
    if (lakhs === 1) parts.push(lakhRem > 0 ? 'ഒരു ലക്ഷത്തി' : 'ഒരു ലക്ഷം');
    else parts.push(twoDigits(lakhs) + (lakhRem > 0 ? ' ലക്ഷത്തി' : ' ലക്ഷം'));
  }

  const k_amount = amount % 100000;
  if (k_amount >= 10000) {
    const ten_k = Math.floor(k_amount / 1000);
    parts.push(twoDigits(ten_k) + (rem > 0 ? ' ആയിരത്തി' : ' ആയിരം'));
  } else if (k_amount >= 1000) {
    const thousands = Math.floor(k_amount / 1000);
    if (thousands === 1) parts.push(rem > 0 ? 'ആയിരത്തി' : 'ആയിരം');
    else {
      const t_word = thousands === 2 ? 'രണ്ടായിരം' :
                     thousands === 3 ? 'മൂന്നായിരം' :
                     thousands === 4 ? 'നാലായിരം' :
                     thousands === 5 ? 'അയ്യായിരം' :
                     thousands === 6 ? 'ആറായിരം' :
                     thousands === 7 ? 'ഏഴായിരം' :
                     thousands === 8 ? 'എട്ടായിരം' :
                     thousands === 9 ? 'ഒൻപതിനായിരം' :
                     twoDigits(thousands) + ' ആയിരം';
      parts.push(rem > 0 ? t_word.replace(/ആയിരം$/, 'ആയിരത്തി') : t_word);
    }
  }

  if (rem === 0) return parts.join(' ').trim();

  const h = Math.floor(rem / 100);
  const rest = rem % 100;

  if (h > 0) {
    parts.push(rest === 0 ? HUNDREDS[h] : HUNDREDS_PREFIX[h]);
  }
  if (rest > 0) parts.push(twoDigits(rest));

  return parts.join(' ').trim();
}

// ─── Payment Method Labels ─────────────────────────────────────────────────────

export const PAYMENT_MALAYALAM: Record<string, string> = {
  cash:    'ക്യാഷ്',
  upi:     'യൂ പി ഐ',
  gpay:    'ഗൂഗിൾ പേ',
  phonepe: 'ഫോൺ‌പേ',
  paytm:   'പേ‌ടിഎം',
  card:    'കാർഡ്',
  credit:  'ക്രെഡിറ്റ് കാർഡ്',
  debit:   'ഡെബിറ്റ് കാർഡ്',
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
  pauseBefore?: number;
}

let queue: SpeechJob[] = [];
let isSpeaking = false;
let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

function clearWatchdog() {
  if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
}

// ─── AudioContext User-Gesture Unlock ─────────────────────────────────────────
// AudioContext needs a user gesture to start. We unlock on first interaction.

let _audioCtxUnlocked = false;

function unlockAudioContext() {
  if (_audioCtxUnlocked) return;
  _audioCtxUnlocked = true;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    setTimeout(() => ctx.close().catch(() => {}), 100);
  } catch { /* ignore */ }
}

// Register on first user interaction
if (typeof window !== 'undefined') {
  const unlock = () => { unlockAudioContext(); };
  ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(e =>
    window.addEventListener(e, unlock, { once: false, passive: true })
  );
}

// ─── Provider: Web Speech API (PRIMARY BROWSER FALLBACK) ──────────────────────

function pickBrowserVoice(voiceURI?: string | null): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  if (voiceURI) {
    const v = voices.find(v => v.voiceURI === voiceURI);
    if (v) return v;
  }
  // Prefer ml-IN voices (native Malayalam)
  return (
    voices.find(v => v.lang === 'ml-IN') ||
    voices.find(v => v.lang.startsWith('ml')) ||
    null
  );
}

function speakWithBrowser(job: SpeechJob): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;

    // Cancel any stuck speech first
    synth.cancel();

    const cleanText = job.text.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) { resolve(); return; }

    const utt = new SpeechSynthesisUtterance(cleanText);

    const doSpeak = () => {
      const voice = pickBrowserVoice(job.opts.voiceURI);
      if (voice) {
        utt.voice = voice;
        utt.lang = voice.lang;
      } else {
        utt.lang = 'ml-IN';
      }

      utt.volume = Math.max(0, Math.min(1, job.opts.volume ?? 1));
      utt.rate   = Math.max(0.5, Math.min(1.5, job.opts.rate ?? 0.88));
      utt.pitch  = Math.max(0, Math.min(2, job.opts.pitch ?? 1.1));

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearWatchdog();
        resolve();
      };

      utt.onend   = finish;
      utt.onerror = (e) => {
        console.warn('[Voice] Browser TTS error:', e.error);
        finish();
      };

      // Watchdog: Chrome bug — onend sometimes never fires
      const wdMs = Math.max(6000, cleanText.length * 220);
      watchdogTimer = setTimeout(() => {
        console.warn('[Voice] Watchdog fired — resetting');
        synth.cancel();
        finish();
      }, wdMs);

      synth.speak(utt);

      // Chrome workaround: resume if paused
      setTimeout(() => {
        if (synth.paused) synth.resume();
      }, 100);
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
      // Fallback if voiceschanged never fires
      setTimeout(() => { if (!handled) onReady(); }, 1500);
    }
  });
}

// ─── Provider: Google Cloud WaveNet ──────────────────────────────────────────

async function speakWithGoogle(job: SpeechJob, googleOpts: GoogleTTSOptions): Promise<boolean> {
  try {
    const b64 = await synthesizeWithGoogle(job.text, googleOpts);
    if (!b64) return false;
    await playBase64Audio(b64, job.opts.volume ?? 1);
    return true;
  } catch {
    return false;
  }
}

// ─── Core Queue Processor ─────────────────────────────────────────────────────

async function processQueue() {
  if (isSpeaking || queue.length === 0) return;
  isSpeaking = true;

  const job = queue.shift()!;

  // Safety: reset after 12s if stuck
  const globalWatchdog = setTimeout(() => {
    if (isSpeaking) {
      console.warn('[Voice] Queue stuck — force resetting');
      isSpeaking = false;
      processQueue();
    }
  }, 12000);

  if (job.pauseBefore && job.pauseBefore > 0) {
    await new Promise(r => setTimeout(r, job.pauseBefore));
  }

  notifyListeners({ text: job.text, provider: null });

  const settings = _getSettings?.();
  const provider  = settings?.ttsProvider ?? 'browser';
  const apiKey    = settings?.googleApiKey ?? '';

  let usedGoogle = false;

  if (provider === 'google' && apiKey) {
    const googleOpts: GoogleTTSOptions = {
      apiKey,
      voiceName: 'ml-IN-Wavenet-A',
      speakingRate: job.opts.rate ?? 1.0,
      pitch:        job.opts.pitch ?? -1.0,
      volumeGainDb: 10.0,
    };
    notifyListeners({ text: job.text, provider: 'google' });
    usedGoogle = await speakWithGoogle(job, googleOpts);
  }

  if (!usedGoogle) {
    notifyListeners({ text: job.text, provider: 'browser' });
    await speakWithBrowser(job);
  }

  notifyListeners({ text: null, provider: null });

  clearTimeout(globalWatchdog);
  isSpeaking = false;

  setTimeout(processQueue, 200);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function speak(text: string, opts: VoiceOptions = {}, pauseBefore = 0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!text.trim()) return;

  if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  if (queue.length >= 12) return;

  queue.push({ text, opts, pauseBefore });
  processQueue();
}

export function stopSpeech() {
  if (typeof window === 'undefined') return;
  clearWatchdog();
  queue = [];
  isSpeaking = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  notifyListeners({ text: null, provider: null });
}

export function testPhrase(text: string, opts: VoiceOptions = {}) {
  stopSpeech();
  speak(text, opts);
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function onApiKeyChange() {
  clearAudioCache();
}

// ─── Kerala-Style Natural Announcement Phrases ────────────────────────────────
// Sounds like a real Kerala supermarket POS machine

/** "ബിൽ റെഡി" */
export function announceBillGenerated(opts: VoiceOptions = {}) {
  speak('ബിൽ റെഡി ആയിട്ടുണ്ട്.', opts);
}

/** "ആകെ [amount] രൂപ ആകും" */
export function announceTotalAmount(amount: number, opts: VoiceOptions = {}) {
  const words = amountToMalayalam(amount, true);
  speak(`ആകെ ${words} രൂപ ആകും.`, opts);
}

/** Kerala style: "ക്യാഷ് [amount] രൂപ കിട്ടി" */
export function announcePaymentReceived(method: string, amount: number, opts: VoiceOptions = {}) {
  const methodWord = PAYMENT_MALAYALAM[method.toLowerCase()] || method;
  const words = amountToMalayalam(amount, true);
  speak(`${methodWord}, ${words} രൂപ കിട്ടി.`, opts, 120);
}

/** "യൂ പി ഐ സക്സസ്" */
export function announceUPISuccess(opts: VoiceOptions = {}) {
  speak('യൂ പി ഐ സക്സസ്.', opts, 120);
}

/** "ബാക്കി [amount] രൂപ തിരിച്ചു കൊടുക്കണം" */
export function announceChange(amount: number, opts: VoiceOptions = {}) {
  if (amount <= 0) return;
  const words = amountToMalayalam(amount, true);
  speak(`ബാക്കി ${words} രൂപ തിരിച്ചു കൊടുക്കണം.`, opts, 120);
}

/** "കൊടുക്കാൻ ബാക്കി [amount] രൂപ" */
export function announcePendingAmount(amount: number, opts: VoiceOptions = {}) {
  if (amount <= 0) return;
  const words = amountToMalayalam(amount, true);
  speak(`കൊടുക്കാൻ ബാക്കി ${words} രൂപ ഉണ്ട്.`, opts, 120);
}

/** "നന്ദി, വീണ്ടും വരൂ" */
export function announceThankYou(opts: VoiceOptions = {}) {
  speak('നന്ദി, വീണ്ടും വരൂ.', opts, 250);
}

/** "[productName] ചേർത്തു" */
export function announceItemAdded(productName: string, opts: VoiceOptions = {}) {
  speak(`${productName} ചേർത്തു.`, opts);
}

/**
 * Full bill announcement:
 * Bill ready → Total → Payment → Change → Thank you
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
 * Flash bill (short): Payment → Thank you
 */
export function announceFlashBill(params: {
  amount: number;
  paymentMethod: string;
  opts?: VoiceOptions;
}) {
  const { amount, paymentMethod, opts = {} } = params;

  if (paymentMethod.toLowerCase() === 'upi') {
    announceUPISuccess(opts);
  }
  announcePaymentReceived(paymentMethod, amount, opts);
  announceThankYou(opts);
}
