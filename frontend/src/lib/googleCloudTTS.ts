// src/lib/googleCloudTTS.ts
// Google Cloud Text-to-Speech — WaveNet Neural Voice (ml-IN-Wavenet-A, Female)
// Provides ultra-realistic, human-quality Malayalam voice output
// Falls back to browser TTS automatically if API key is not configured

/* eslint-disable @typescript-eslint/no-explicit-any */

const GOOGLE_TTS_REST = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export type GoogleVoiceName =
  | 'ml-IN-Wavenet-A'   // Female — warm, natural (recommended)
  | 'ml-IN-Wavenet-B'   // Male
  | 'ml-IN-Wavenet-C'   // Female — slightly higher pitch
  | 'ml-IN-Wavenet-D'   // Male — deeper
  | 'ml-IN-Standard-A'  // Female Standard (free, less natural)
  | 'ml-IN-Standard-B'; // Male Standard

export interface GoogleTTSOptions {
  apiKey: string;
  voiceName?: GoogleVoiceName;
  speakingRate?: number;   // 0.25 – 4.0  (default 1.0)
  pitch?: number;          // -20 – 20 semitones (default 0)
  volumeGainDb?: number;   // -96 – 16 dB (default 0)
}

// Audio cache: text → base64 mp3
const audioCache = new Map<string, string>();

/**
 * Synthesize text using Google Cloud TTS WaveNet.
 * Returns a base64-encoded MP3 string, or null on failure.
 */
export async function synthesizeWithGoogle(
  text: string,
  opts: GoogleTTSOptions
): Promise<string | null> {
  if (!opts.apiKey) return null;

  const cacheKey = `${text}||${opts.voiceName}||${opts.speakingRate}||${opts.pitch}`;
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey)!;

  try {
    const isSsml = text.trim().startsWith('<speak>');
    const body = {
      input: isSsml ? { ssml: text } : { text },
      voice: {
        languageCode: 'ml-IN',
        name: opts.voiceName || 'ml-IN-Wavenet-A',
        ssmlGender: (opts.voiceName || '').includes('-B') || (opts.voiceName || '').includes('-D')
          ? 'MALE'
          : 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: opts.speakingRate ?? 1.0,
        pitch: opts.pitch ?? -1.0,          // standard/natural pitch
        volumeGainDb: opts.volumeGainDb ?? 6.0,
        effectsProfileId: ['large-home-entertainment-class-device'], // speaker optimized
      },
    };

    const res = await fetch(`${GOOGLE_TTS_REST}?key=${opts.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[GoogleTTS] API error:', res.status, err?.error?.message);
      return null;
    }

    const json = await res.json();
    const b64 = json.audioContent as string | undefined;
    if (!b64) return null;

    // Cache (limit to 100 entries to avoid memory bloat)
    if (audioCache.size >= 100) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, b64);
    return b64;
  } catch (e) {
    console.warn('[GoogleTTS] Network error:', e);
    return null;
  }
}

/**
 * Play a base64 MP3 string through the browser's AudioContext.
 * Returns a Promise that resolves when playback ends.
 */
export async function playBase64Audio(
  b64: string,
  volumeMultiplier = 1.0
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const playAudio = () => {
        ctx.decodeAudioData(bytes.buffer, (buffer) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const gain = ctx.createGain();
          gain.gain.value = Math.max(0, Math.min(2, volumeMultiplier));

          source.connect(gain);
          gain.connect(ctx.destination);
          source.start(0);
          source.onended = () => {
            ctx.close().catch(() => {});
            resolve();
          };
          // Safety timeout
          setTimeout(() => { ctx.close().catch(() => {}); resolve(); }, 15000);
        }, () => {
          ctx.close().catch(() => {});
          resolve();
        });
      };

      // Resume suspended AudioContext (happens when no user gesture yet)
      if (ctx.state === 'suspended') {
        ctx.resume().then(playAudio).catch(() => resolve());
      } else {
        playAudio();
      }
    } catch {
      resolve();
    }
  });
}

/** Clear the audio cache (e.g., when voice settings change) */
export function clearAudioCache() {
  audioCache.clear();
}
