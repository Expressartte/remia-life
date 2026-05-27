import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { functions, storage } from '../services/firebase';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface SynthRequest {
  text: string;
  kind?: string;
  dreamId?: string;
  provider?: 'openai' | 'elevenlabs';
  voice?: string;
  speed?: number;
}

interface SynthResponse {
  audioPath: string;
  cached: boolean;
  provider: 'openai' | 'elevenlabs';
  contentType: string;
}

export interface MeditationPlayerOptions {
  /** Identificador semántico del audio (e.g. `meditation-med_sleep_descent`).
   *  Se usa para agrupar el cache en Storage. */
  kind: string;
  text: string;
  provider?: 'openai' | 'elevenlabs';
  voice?: string;
}

export function useMeditationPlayer(opts: MeditationPlayerOptions) {
  const [state, setState] = useState<PlayerState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reset audio cuando cambian las opciones (e.g. eliges otra meditación)
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [opts.kind, opts.text, opts.voice, opts.provider]);

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.durationMillis) setDurationMs(status.durationMillis);
    if (status.positionMillis != null) {
      setPositionMs(status.positionMillis);
      if (status.durationMillis) {
        setProgress(status.positionMillis / status.durationMillis);
      }
    }
    if (status.didJustFinish) {
      setState('idle');
      setProgress(0);
      setPositionMs(0);
    }
  }, []);

  const stop = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setState('idle');
    setProgress(0);
    setPositionMs(0);
  }, []);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync().catch(() => {});
      setState('paused');
    }
  }, []);

  const resume = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync().catch(() => {});
      setState('playing');
    }
  }, []);

  const play = useCallback(async () => {
    if (soundRef.current) {
      await resume();
      return;
    }
    setError(null);
    setState('loading');
    try {
      const synth = httpsCallable<SynthRequest, SynthResponse>(functions, 'synthesizeSpeech');
      const result = await synth({
        text: opts.text,
        kind: opts.kind,
        provider: opts.provider ?? 'elevenlabs',
        voice: opts.voice,
      });
      const audioUrl = await getDownloadURL(ref(storage, result.data.audioPath));

      // Permitir reproducción en modo silencioso en iOS
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      }).catch(() => {});

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onStatus,
      );
      soundRef.current = sound;
      setState('playing');
    } catch (err: any) {
      console.error('[useMeditationPlayer] play error:', err);
      setError(err?.message ?? 'No se pudo reproducir el audio');
      setState('error');
    }
  }, [opts, onStatus, resume]);

  return { state, error, progress, durationMs, positionMs, play, pause, resume, stop };
}
