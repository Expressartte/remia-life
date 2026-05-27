import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { functions, storage } from '../services/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AudioState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface SynthRequest {
  text: string;
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

interface DreamAnalysisLite {
  subconscious_message?: string;
  compensation_analysis?: string;
  mental_screen_recommendation?: string;
  dream_title?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construye el texto a leer a partir del análisis. ~300-500 caracteres. */
export function buildSummaryText(analysis: DreamAnalysisLite): string {
  const parts: string[] = [];

  if (analysis.subconscious_message) {
    parts.push(analysis.subconscious_message.trim());
  }

  if (analysis.compensation_analysis) {
    // Primeras 2 frases (Whisper devuelve texto con puntuación normalizada)
    const sentences = analysis.compensation_analysis.match(/[^.!?]+[.!?]+/g) ?? [];
    const snippet = sentences.slice(0, 2).join(' ').trim();
    if (snippet) parts.push(snippet);
  }

  if (analysis.mental_screen_recommendation) {
    parts.push('Para tu pantalla mental hoy: ' + analysis.mental_screen_recommendation.trim());
  }

  return parts.join(' ');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDreamSummaryAudio(dreamId: string, analysis: DreamAnalysisLite | null) {
  const [state, setState] = useState<AudioState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0–1
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionRef = useRef(0);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.durationMillis && status.positionMillis != null) {
      setProgress(status.positionMillis / status.durationMillis);
      positionRef.current = status.positionMillis;
    }
    if (status.didJustFinish) {
      setState('idle');
      setProgress(0);
      positionRef.current = 0;
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
    positionRef.current = 0;
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
    // Si ya hay un sound cargado, simplemente reanuda
    if (soundRef.current) {
      await resume();
      return;
    }

    if (!analysis) {
      setError('Análisis no disponible');
      setState('error');
      return;
    }

    const text = buildSummaryText(analysis);
    if (!text) {
      setError('No hay texto para leer');
      setState('error');
      return;
    }

    setError(null);
    setState('loading');

    try {
      const synth = httpsCallable<SynthRequest, SynthResponse>(functions, 'synthesizeSpeech');
      const result = await synth({
        text,
        dreamId,
        provider: 'openai',
        voice: 'nova',
        speed: 1.0,
      });

      const audioUrl = await getDownloadURL(ref(storage, result.data.audioPath));

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setState('playing');
    } catch (err: any) {
      console.error('[useDreamSummaryAudio] play error:', err);
      setError(err?.message ?? 'No se pudo generar el audio');
      setState('error');
    }
  }, [analysis, dreamId, onPlaybackStatusUpdate, resume]);

  return { state, error, progress, play, pause, resume, stop };
}
