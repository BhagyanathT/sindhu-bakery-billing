'use client';
// src/components/VoiceStatusWidget.tsx
// Floating animated widget that shows current speech status in billing pages

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { onSpeechChange, stopSpeech } from '@/lib/malayalamVoice';
import { useVoiceSettings } from '@/hooks/useVoiceSettings';
import { clsx } from 'clsx';

export default function VoiceStatusWidget() {
  const { voiceEnabled, setVoiceEnabled } = useVoiceSettings();
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to speech events
  useEffect(() => {
    const unsub = onSpeechChange((text) => {
      if (text) {
        setCurrentText(text);
        setVisible(true);
        if (hideTimer) clearTimeout(hideTimer);
      } else {
        // Keep visible for 1.5s after speech ends
        const t = setTimeout(() => {
          setVisible(false);
          setCurrentText(null);
        }, 1500);
        setHideTimer(t);
      }
    });
    return () => {
      unsub();
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    if (voiceEnabled && currentText) stopSpeech();
    setVoiceEnabled(!voiceEnabled);
  };

  // ── Waveform bars animation ──────────────────────────────────────────────
  const bars = [3, 5, 7, 5, 4, 6, 8, 5, 3, 6];

  return (
    <div
      className={clsx(
        'fixed bottom-20 right-4 z-[60] flex items-center gap-2 transition-all duration-500 no-print',
        // Always show mute button; expand when speaking
        visible && voiceEnabled ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      style={{ transform: visible && voiceEnabled ? 'translateY(0)' : 'translateY(10px)' }}
    >
      {/* Main speaking card */}
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl px-3 py-2 shadow-xl shadow-violet-500/30 border border-violet-400/30 backdrop-blur-sm max-w-[220px]">
        {/* Waveform */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {bars.map((h, i) => (
            <div
              key={i}
              className="bg-white/80 rounded-full"
              style={{
                width: '2px',
                height: `${h}px`,
                animation: currentText
                  ? `voiceBar 0.6s ease-in-out ${i * 0.07}s infinite alternate`
                  : 'none',
                opacity: currentText ? 1 : 0.3,
              }}
            />
          ))}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold text-violet-200 uppercase tracking-wide leading-none mb-0.5">
            🎙️ Malayalam Voice
          </p>
          <p className="text-[10px] text-white font-medium truncate leading-tight">
            {currentText || 'Speaking…'}
          </p>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes voiceBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  );
}

/** Small persistent mute/unmute button — always visible in corner of billing */
export function VoiceMuteButton() {
  const { voiceEnabled, setVoiceEnabled } = useVoiceSettings();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const unsub = onSpeechChange((text) => setSpeaking(!!text));
    return () => { unsub(); };
  }, []);

  return (
    <button
      id="voice-mute-btn"
      onClick={() => {
        if (voiceEnabled && speaking) stopSpeech();
        setVoiceEnabled(!voiceEnabled);
      }}
      title={voiceEnabled ? 'Voice ON — click to mute' : 'Voice MUTED — click to enable'}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border no-print',
        voiceEnabled
          ? speaking
            ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/30 animate-pulse'
            : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-200'
          : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
      )}
    >
      {voiceEnabled ? (
        <Volume2 className="w-3.5 h-3.5" />
      ) : (
        <VolumeX className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">{voiceEnabled ? 'Voice ON' : 'Muted'}</span>
    </button>
  );
}
