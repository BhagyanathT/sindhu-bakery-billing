// src/hooks/useVoiceSettings.ts
// Persisted Zustand store for Malayalam voice announcement settings

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VoiceSettings {
  /** Master voice enable/disable */
  voiceEnabled: boolean;
  /** Volume 0–1 */
  volume: number;
  /** Speech rate 0.6–1.3 */
  rate: number;
  /** Announce when item is added to cart */
  announceItemAdd: boolean;
  /** Selected voice URI (null = auto-pick best Malayalam voice) */
  selectedVoiceURI: string | null;

  // Setters
  setVoiceEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setRate: (v: number) => void;
  setAnnounceItemAdd: (v: boolean) => void;
  setSelectedVoiceURI: (v: string | null) => void;
}

export const useVoiceSettings = create<VoiceSettings>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      volume: 1,
      rate: 0.85,
      announceItemAdd: false,
      selectedVoiceURI: null,

      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setRate: (v) => set({ rate: Math.max(0.5, Math.min(1.5, v)) }),
      setAnnounceItemAdd: (v) => set({ announceItemAdd: v }),
      setSelectedVoiceURI: (v) => set({ selectedVoiceURI: v }),
    }),
    {
      name: 'sindhu-voice-settings',
      // Only persist data fields, not setters
      partialize: (s) => ({
        voiceEnabled: s.voiceEnabled,
        volume: s.volume,
        rate: s.rate,
        announceItemAdd: s.announceItemAdd,
        selectedVoiceURI: s.selectedVoiceURI,
      }),
    }
  )
);

/** Helper — returns the VoiceOptions object needed by malayalamVoice functions */
export function getVoiceOpts(settings: VoiceSettings) {
  return {
    volume: settings.volume,
    rate: settings.rate,
    voiceURI: settings.selectedVoiceURI,
  };
}
