import { useCallback, useRef, useEffect } from 'react';

interface UseTimerAudioOptions {
  enabled: boolean;
  volume?: number;
}

export const useTimerAudio = ({ enabled, volume = 0.7 }: UseTimerAudioOptions) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize audio context
  useEffect(() => {
    if (enabled && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = volume;
      } catch (error) {
        console.warn('Audio context not supported:', error);
      }
    }
  }, [enabled, volume]);

  // Clean up audio context
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playCompletionSound = useCallback(() => {
    if (!enabled || !audioContextRef.current || !gainNodeRef.current) {
      return;
    }

    try {
      const context = audioContextRef.current;
      const gainNode = gainNodeRef.current;

      // Resume audio context if suspended (required for some browsers)
      if (context.state === 'suspended') {
        context.resume();
      }

      // Create a more pleasant completion sound (ascending notes)
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      const duration = 0.15;

      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();

        oscillator.connect(envelope);
        envelope.connect(gainNode);

        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        oscillator.type = 'sine';

        const startTime = context.currentTime + (index * duration);
        const endTime = startTime + duration;

        // Envelope for smooth attack and decay
        envelope.gain.setValueAtTime(0, startTime);
        envelope.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.01, endTime);

        oscillator.start(startTime);
        oscillator.stop(endTime);
      });

    } catch (error) {
      console.warn('Failed to play completion sound:', error);
    }
  }, [enabled]);

  const playTickSound = useCallback(() => {
    if (!enabled || !audioContextRef.current || !gainNodeRef.current) {
      return;
    }

    try {
      const context = audioContextRef.current;
      const gainNode = gainNodeRef.current;

      if (context.state === 'suspended') {
        context.resume();
      }

      // Subtle tick sound
      const oscillator = context.createOscillator();
      const envelope = context.createGain();

      oscillator.connect(envelope);
      envelope.connect(gainNode);

      oscillator.frequency.setValueAtTime(800, context.currentTime);
      oscillator.type = 'square';

      const duration = 0.05;
      envelope.gain.setValueAtTime(0, context.currentTime);
      envelope.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + duration);

    } catch (error) {
      console.warn('Failed to play tick sound:', error);
    }
  }, [enabled]);

  return {
    playCompletionSound,
    playTickSound
  };
};