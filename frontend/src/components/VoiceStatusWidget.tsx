'use client';
// src/components/VoiceStatusWidget.tsx
// ── Premium Malayalam Voice Announcement Widget ──
// Shows animated waveform + current phrase while speaking
// Supports Google WaveNet badge and browser TTS badge

import { useEffect, useState } from 'react';
import { Volume2, VolumeX, Mic, Wifi } from 'lucide-react';
import { onSpeechChange, stopSpeech, type SpeechEvent } from '@/lib/malayalamVoice';
import { useVoiceSettings } from '@/hooks/useVoiceSettings';
import { clsx } from 'clsx';

// ── Waveform bar heights (20 bars, varied for organic look) ──────────────────
const BAR_HEIGHTS = [4, 7, 11, 16, 22, 18, 14, 20, 25, 18, 22, 15, 20, 12, 18, 9, 14, 8, 5, 7];

export default function VoiceStatusWidget() {
  const { voiceEnabled, setVoiceEnabled } = useVoiceSettings();
  const [event, setEvent] = useState<SpeechEvent>({ text: null, provider: null });
  const [visible, setVisible] = useState(false);
  const [hideTimer, setHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onSpeechChange((ev) => {
      if (ev.text) {
        setEvent(ev);
        setVisible(true);
        if (hideTimer) clearTimeout(hideTimer);
      } else {
        const t = setTimeout(() => {
          setVisible(false);
          setEvent({ text: null, provider: null });
        }, 1800);
        setHideTimer(t);
      }
    });
    return () => {
      unsub();
      if (hideTimer) clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSpeaking = !!event.text && voiceEnabled;

  return (
    <>
      {/* Animated waveform card — only when speaking */}
      <div
        className={clsx(
          'fixed bottom-20 right-4 z-[60] transition-all duration-500 ease-out no-print',
          isSpeaking ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95 pointer-events-none'
        )}
      >
        <div className="relative flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl border border-white/10 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)',
            boxShadow: '0 8px 32px rgba(109, 40, 217, 0.45), 0 0 0 1px rgba(255,255,255,0.08)',
            minWidth: 220,
            maxWidth: 280,
          }}
        >
          {/* Glossy reflection */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/10 to-transparent rounded-t-2xl" />

          {/* Mic icon */}
          <div className="relative flex-shrink-0 w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-xl border border-white/40 animate-ping opacity-60" />
          </div>

          {/* Waveform + text */}
          <div className="flex-1 min-w-0">
            {/* Provider badge */}
            <div className="flex items-center gap-1.5 mb-1">
              {event.provider === 'google' ? (
                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
                  <Wifi className="w-2.5 h-2.5" />
                  Google WaveNet
                </span>
              ) : (
                <span className="text-[9px] font-bold text-violet-300 uppercase tracking-wider">
                  🎙 Malayalam Voice
                </span>
              )}
            </div>

            {/* Animated waveform bars */}
            <div className="flex items-end gap-[2px] h-6 mb-1">
              {BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="rounded-full bg-white/80 flex-shrink-0"
                  style={{
                    width: '2.5px',
                    height: isSpeaking ? `${h}px` : '3px',
                    animation: isSpeaking
                      ? `voiceBar ${0.4 + (i % 5) * 0.08}s ease-in-out ${i * 0.035}s infinite alternate`
                      : 'none',
                    opacity: isSpeaking ? 0.9 : 0.25,
                    transition: 'height 0.3s ease',
                  }}
                />
              ))}
            </div>

            {/* Current text (truncated) */}
            <p className="text-[10px] text-white/90 font-medium truncate leading-none">
              {event.text || '…'}
            </p>
          </div>
        </div>

        {/* Keyframes */}
        <style>{`
          @keyframes voiceBar {
            from { transform: scaleY(0.35); }
            to   { transform: scaleY(1.0); }
          }
        `}</style>
      </div>
    </>
  );
}

// ─── Compact Mute/Unmute Button ───────────────────────────────────────────────
export function VoiceMuteButton() {
  const { voiceEnabled, setVoiceEnabled } = useVoiceSettings();
  const [speaking, setSpeaking] = useState(false);
  const [provider, setProvider] = useState<'google' | 'browser' | null>(null);

  useEffect(() => {
    const unsub = onSpeechChange((ev) => {
      setSpeaking(!!ev.text);
      setProvider(ev.provider);
    });
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
            ? 'bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-500/30'
            : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800 hover:bg-violet-200 dark:hover:bg-violet-900/50'
          : 'bg-stone-100 dark:bg-stone-800 text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
      )}
    >
      {voiceEnabled ? (
        <Volume2 className={clsx('w-3.5 h-3.5', speaking && 'animate-pulse')} />
      ) : (
        <VolumeX className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">
        {voiceEnabled
          ? (speaking ? (provider === 'google' ? '✨ WaveNet' : 'Speaking…') : 'Voice ON')
          : 'Muted'}
      </span>
    </button>
  );
}
