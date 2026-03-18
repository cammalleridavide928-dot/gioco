import { useCallback, useEffect, useMemo, useRef } from 'react';

function playTone(audioContext, frequency, duration, type = 'sine', volume = 0.04) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.stop(audioContext.currentTime + duration);
}

export function useSoundEffects(muted) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioRef.current = new AudioContextClass();
      }
    }
  }, []);

  const perform = useCallback((fn) => {
    if (muted || !audioRef.current) {
      return;
    }
    if (audioRef.current.state === 'suspended') {
      audioRef.current.resume().catch(() => {});
    }
    fn(audioRef.current);
  }, [muted]);

  return useMemo(() => ({
    playFlip: () => perform((ctx) => playTone(ctx, 420, 0.18, 'triangle')),
    playVote: () => perform((ctx) => {
      playTone(ctx, 620, 0.08, 'square');
      setTimeout(() => playTone(ctx, 820, 0.14, 'triangle'), 80);
    }),
    playRoundEnd: () => perform((ctx) => {
      playTone(ctx, 320, 0.1, 'sawtooth');
      setTimeout(() => playTone(ctx, 520, 0.16, 'triangle'), 120);
    }),
    playWinner: () => perform((ctx) => {
      playTone(ctx, 392, 0.12, 'triangle');
      setTimeout(() => playTone(ctx, 523, 0.14, 'triangle'), 120);
      setTimeout(() => playTone(ctx, 659, 0.2, 'triangle'), 240);
    })
  }), [perform]);
}
