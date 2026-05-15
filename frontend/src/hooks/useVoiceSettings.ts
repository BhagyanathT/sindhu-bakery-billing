// src/hooks/useVoiceSettings.ts
// Persisted Zustand store for Malayalam voice announcement settings
// Supports: Browser TTS | Google Cloud WaveNet Neural TTS

import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerSettingsGetter } from '@/lib/malayalamVoice';

export type TTSProvider = 'browser' | 'google';

export interface VoiceSettings {
  /** Master voice enable/disable */
  voiceEnabled: boolean;
  /** TTS provider: 'browser' (Web Speech API) or 'google' (Google Cloud WaveNet) */
  ttsProvider: TTSProvider;
  /** Google Cloud TTS API key (stored locally, never sent to our server) */
  googleApiKey: string;
  /** Volume 0–1 */
  volume: number;
  /** Speech rate 0.5–1.5 */
  rate: number;
  /** Voice pitch 0–2 (browser) / -20 to 20 semitones (mapped internally for Google) */
  pitch: number;
  /** Announce when item is added to cart */
  announceItemAdd: boolean;
  /** Selected browser voice URI (null = auto-pick best Malayalam voice) */
  selectedVoiceURI: string | null;

  // Setters
  setVoiceEnabled: (v: boolean) => void;
  setTtsProvider: (v: TTSProvider) => void;
  setGoogleApiKey: (v: string) => void;
  setVolume: (v: number) => void;
  setRate: (v: number) => void;
  setPitch: (v: number) => void;
  setAnnounceItemAdd: (v: boolean) => void;
  setSelectedVoiceURI: (v: string | null) => void;
}

export const useVoiceSettings = create<VoiceSettings>()(
  persist(
    (set) => ({
      voiceEnabled:     true,
      ttsProvider:      'browser',
      googleApiKey:     '',
      volume:           1,
      rate:             0.82,
      pitch:            1.0,
      announceItemAdd:  false,
      selectedVoiceURI: null,

      setVoiceEnabled:    (v) => set({ voiceEnabled: v }),
      setTtsProvider:     (v) => set({ ttsProvider: v }),
      setGoogleApiKey:    (v) => set({ googleApiKey: v }),
      setVolume:          (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setRate:            (v) => set({ rate: Math.max(0.5, Math.min(1.5, v)) }),
      setPitch:           (v) => set({ pitch: Math.max(0, Math.min(2, v)) }),
      setAnnounceItemAdd: (v) => set({ announceItemAdd: v }),
      setSelectedVoiceURI:(v) => set({ selectedVoiceURI: v }),
    }),
    {
      name: 'sindhu-voice-settings-v2',
      partialize: (s) => ({
        voiceEnabled:     s.voiceEnabled,
        ttsProvider:      s.ttsProvider,
        googleApiKey:     s.googleApiKey,
        volume:           s.volume,
        rate:             s.rate,
        pitch:            s.pitch,
        announceItemAdd:  s.announceItemAdd,
        selectedVoiceURI: s.selectedVoiceURI,
      }),
    }
  )
);

/**
 * Call once at app mount (in a layout or provider) to wire up the
 * malayalamVoice engine so it can read current settings without
 * creating a circular import.
 */
export function useRegisterVoiceSettings() {
  const settings = useVoiceSettings();
  useEffect(() => {
    registerSettingsGetter(() => ({
      volume:       settings.volume,
      rate:         settings.rate,
      pitch:        settings.pitch,
      voiceURI:     settings.selectedVoiceURI,
      googleApiKey: settings.googleApiKey,
      ttsProvider:  settings.ttsProvider,
    }));
  }, [settings]);
}

/** Returns the VoiceOptions object consumed by malayalamVoice functions */
export function getVoiceOpts(s: VoiceSettings) {
  return {
    volume:   s.volume,
    rate:     s.rate,
    pitch:    s.pitch,
    voiceURI: s.selectedVoiceURI,
  };
}
