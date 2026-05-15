// src/lib/malayalamVoice.ts
// Professional Malayalam TTS Engine for Sindhu Bakery POS
// Uses Web Speech API — works with Chrome, Edge, and Bluetooth speakers

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Number-to-Words (Malayalam) ─────────────────────────────────────────────

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

/** Convert a number 0–99,999 to Malayalam words */
export function amountToMalayalam(n: number): string {
  const amount = Math.round(n); // ignore paise for speech
  if (amount === 0) return 'പൂജ്യം';
  if (amount < 0) return 'മൈനസ് ' + amountToMalayalam(-amount);

  const parts: string[] = [];

  if (amount >= 1000) {
    const thousands = Math.floor(amount / 1000);
    if (thousands === 1) {
      parts.push('ഒരു ആയിരം');
    } else {
      parts.push(twoDigits(thousands) + ' ആയിരം');
    }
  }

  const rem = amount % 1000;
  if (rem === 0) return parts.join(' ');

  const h = Math.floor(rem / 100);
  const rest = rem % 100;

  if (h > 0) {
    if (rest === 0) {
      parts.push(HUNDREDS[h]);
    } else {
      // e.g. 540 → "അഞ്ഞൂറ്റി നാൽപ്പത്"
      parts.push(HUNDREDS[h] + 'ടി');
    }
  }

  if (rest > 0) {
    parts.push(twoDigits(rest));
  }

  return parts.join(' ');
}

function twoDigits(n: number): string {
  if (n <= 0) return '';
  if (n < 20) return ONES[n];
  if (n % 10 === 0) return TENS[Math.floor(n / 10)];
  return TENS_ONE[n] || (TENS[Math.floor(n / 10)] + ' ' + ONES[n % 10]);
}

// ─── Payment Method → Malayalam ───────────────────────────────────────────────

export const PAYMENT_MALAYALAM: Record<string, string> = {
  cash:   'ക്യാഷ്',
  upi:    'ഫോൺ‌പേ',
  card:   'കാർഡ്',
  credit: 'ക്രെഡിറ്റ്',
};

// ─── Speech Queue ─────────────────────────────────────────────────────────────

interface SpeechJob {
  text: string;
  voiceURI?: string | null;
  volume: number;
  rate: number;
}

let queue: SpeechJob[] = [];
let speaking = false;

// Callbacks for status widgets
const listeners = new Set<(text: string | null) => void>();
export function onSpeechChange(cb: (text: string | null) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notifyListeners(text: string | null) {
  listeners.forEach(cb => cb(text));
}

function processQueue() {
  if (speaking || queue.length === 0) return;
  const job = queue.shift()!;
  speaking = true;
  notifyListeners(job.text);

  const synth = window.speechSynthesis;
  const utt = new SpeechSynthesisUtterance(job.text);

  // Try to find a Malayalam voice
  const voices = synth.getVoices();
  let voice: SpeechSynthesisVoice | null = null;

  if (job.voiceURI) {
    voice = voices.find(v => v.voiceURI === job.voiceURI) || null;
  }
  if (!voice) {
    // Try Malayalam voices first
    voice =
      voices.find(v => v.lang === 'ml-IN') ||
      voices.find(v => v.lang.startsWith('ml')) ||
      null;
  }
  if (voice) utt.voice = voice;

  // For Malayalam text, use ml-IN lang hint so browser renders correctly
  utt.lang = voice?.lang || 'ml-IN';
  utt.volume = Math.max(0, Math.min(1, job.volume));
  utt.rate = Math.max(0.5, Math.min(1.5, job.rate));
  utt.pitch = 1.1; // slightly higher for female-like voice

  utt.onend = () => {
    speaking = false;
    notifyListeners(null);
    processQueue();
  };
  utt.onerror = () => {
    speaking = false;
    notifyListeners(null);
    processQueue();
  };

  // Chrome bug: long text can get cut off; cancel first to be safe
  synth.cancel();
  setTimeout(() => {
    synth.speak(utt);
  }, 80);
}

/** Enqueue a speech utterance. Max queue depth = 8. */
export function speak(text: string, opts: Partial<SpeechJob> = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (queue.length >= 8) return; // drop if too backed up

  queue.push({
    text,
    voiceURI: opts.voiceURI ?? null,
    volume: opts.volume ?? 1,
    rate: opts.rate ?? 0.85,
  });
  processQueue();
}

/** Cancel all pending speech immediately */
export function stopSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  queue = [];
  speaking = false;
  window.speechSynthesis.cancel();
  notifyListeners(null);
}

// ─── High-level Announcement Functions ───────────────────────────────────────

export interface VoiceOptions {
  volume?: number;
  rate?: number;
  voiceURI?: string | null;
}

/** "ബിൽ വിജയകരമായി തയ്യാറാക്കി" */
export function announceBillGenerated(opts: VoiceOptions = {}) {
  speak('ബിൽ വിജയകരമായി തയ്യാറാക്കി', opts);
}

/** "ആകെ തുക [amount] രൂപ" */
export function announceTotalAmount(amount: number, opts: VoiceOptions = {}) {
  const words = amountToMalayalam(amount);
  speak(`ആകെ തുക ${words} രൂപ`, opts);
}

/** "ക്യാഷ്/ഫോൺ‌പേ/കാർഡ് വഴി [amount] രൂപ അടച്ചു" */
export function announcePaymentReceived(
  method: string,
  amount: number,
  opts: VoiceOptions = {}
) {
  const methodWord = PAYMENT_MALAYALAM[method.toLowerCase()] || method;
  const words = amountToMalayalam(amount);
  speak(`${methodWord} വഴി ${words} രൂപ അടച്ചു`, opts);
}

/** "ബാക്കി തുക [amount] രൂപ" */
export function announceChange(amount: number, opts: VoiceOptions = {}) {
  if (amount <= 0) return;
  const words = amountToMalayalam(amount);
  speak(`ബാക്കി തുക ${words} രൂപ`, opts);
}

/** "നന്ദി, വീണ്ടും വരിക" */
export function announceThankYou(opts: VoiceOptions = {}) {
  speak('നന്ദി, വീണ്ടും വരിക', opts);
}

/** Full bill announcement sequence — bill generated + total + payment + change + thank you */
export function announceFullBill(params: {
  amount: number;
  paymentMethod: string;
  change?: number;
  opts?: VoiceOptions;
}) {
  const { amount, paymentMethod, change = 0, opts = {} } = params;
  announceBillGenerated(opts);
  announceTotalAmount(amount, opts);
  announcePaymentReceived(paymentMethod, amount, opts);
  if (change > 0) announceChange(change, opts);
  announceThankYou(opts);
}

/** Flash bill short announcement — just total + payment + thank you */
export function announceFlashBill(params: {
  amount: number;
  paymentMethod: string;
  opts?: VoiceOptions;
}) {
  const { amount, paymentMethod, opts = {} } = params;
  announceTotalAmount(amount, opts);
  announcePaymentReceived(paymentMethod, amount, opts);
  announceThankYou(opts);
}

/** Test a specific phrase */
export function testPhrase(text: string, opts: VoiceOptions = {}) {
  stopSpeech();
  speak(text, opts);
}

/** Get all available voices from browser */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

/** Check if speech synthesis is supported */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
