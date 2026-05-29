import { useState, useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { getDownloadURL, ref } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { storage, functions } from '../services/firebase';
import { AmbientSound, TimerMinutes } from '../config/ambientSounds';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AmbientState = 'idle' | 'loading' | 'playing' | 'error';

interface BinauralRequest {
  soundId: string;
  type: 'binaural' | 'noise';
  baseFreq?: number;
  beatFreq?: number;
  noiseType?: 'pink' | 'brown';
}
interface BinauralResponse {
  storagePath: string;
  cached: boolean;
}

// Mapeo de configuración para binaurales
const BINAURAL_CONFIG: Record<string, { baseFreq: number; beatFreq: number }> = {
  binaural_delta: { baseFreq: 150, beatFreq: 2 },
  binaural_theta: { baseFreq: 200, beatFreq: 6 },
  binaural_alpha: { baseFreq: 200, beatFreq: 10 },
  binaural_gamma: { baseFreq: 300, beatFreq: 40 },
};

const NOISE_CONFIG: Record<string, 'pink' | 'brown'> = {
  noise_pink: 'pink',
  noise_brown: 'brown',
};

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Volumen bajo mientras la narración está activa */
const VOLUME_UNDER_NARRATION = 0.25;
/** Volumen normal cuando no hay narración */
const VOLUME_NORMAL = 0.5;
/** Duración del fade-out al terminar el timer (ms) */
const FADE_OUT_DURATION_MS = 8000;
/** Pasos del fade-out */
const FADE_OUT_STEPS = 40;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook para reproducción de sonidos ambientales en loop.
 *
 * Características:
 * - Descarga el audio desde Firebase Storage
 * - Genera binaurales/ruido con `generateBinauralSound` la primera vez
 * - Loop continuo con `isLooping: true`
 * - Control de volumen (bajo durante narración, normal después)
 * - Timer con fade-out suave al finalizar
 * - Cleanup automático al desmontar
 */
export function useAmbientSound() {
  const [state, setState] = useState<AmbientState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentSound, setCurrentSound] = useState<AmbientSound | null>(null);
  const [timerMinutes, setTimerMinutes] = useState<TimerMinutes>(30);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const isNarrationActiveRef = useRef(false);

  // ── Cleanup al desmontar ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  // ── Resolver URL del audio ──────────────────────────────────────────────
  const resolveAudioUrl = useCallback(async (sound: AmbientSound): Promise<string> => {
    // Para binaurales, generar con Cloud Function
    if (BINAURAL_CONFIG[sound.id]) {
      try {
        const generate = httpsCallable<BinauralRequest, BinauralResponse>(
          functions,
          'generateBinauralSound'
        );
        const config = BINAURAL_CONFIG[sound.id];
        await generate({
          soundId: sound.id,
          type: 'binaural',
          baseFreq: config.baseFreq,
          beatFreq: config.beatFreq,
        });
      } catch (err) {
        console.warn('[useAmbientSound] generate binaural failed:', err);
      }
    }

    // Para ruido, generar con Cloud Function
    if (NOISE_CONFIG[sound.id]) {
      try {
        const generate = httpsCallable<BinauralRequest, BinauralResponse>(
          functions,
          'generateBinauralSound'
        );
        await generate({
          soundId: sound.id,
          type: 'noise',
          noiseType: NOISE_CONFIG[sound.id],
        });
      } catch (err) {
        console.warn('[useAmbientSound] generate noise failed:', err);
      }
    }

    // Intentar obtener URL — primero .mp3, luego .wav (binaurales)
    try {
      return await getDownloadURL(ref(storage, sound.storagePath));
    } catch {
      // Intentar con extensión .wav (los binaurales se guardan así)
      const wavPath = sound.storagePath.replace('.mp3', '.wav');
      return await getDownloadURL(ref(storage, wavPath));
    }
  }, []);

  // ── Fade out suave ──────────────────────────────────────────────────────
  const fadeOutAndStop = useCallback(async () => {
    if (!soundRef.current) return;

    const sound = soundRef.current;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    const startVolume = status.volume ?? VOLUME_NORMAL;
    const step = startVolume / FADE_OUT_STEPS;
    let currentVolume = startVolume;
    let stepCount = 0;

    return new Promise<void>((resolve) => {
      fadeIntervalRef.current = setInterval(async () => {
        stepCount++;
        currentVolume = Math.max(0, currentVolume - step);

        try {
          await sound.setVolumeAsync(currentVolume);
        } catch {
          // Sound may already be unloaded
        }

        if (stepCount >= FADE_OUT_STEPS) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
          try {
            await sound.stopAsync();
            await sound.unloadAsync();
          } catch {}
          soundRef.current = null;
          setState('idle');
          setCurrentSound(null);
          setTimerRemaining(null);
          resolve();
        }
      }, FADE_OUT_DURATION_MS / FADE_OUT_STEPS);
    });
  }, []);

  // ── Timer de duración ───────────────────────────────────────────────────
  const startTimer = useCallback((minutes: number) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const totalMs = minutes * 60 * 1000;
    startTimeRef.current = Date.now();
    setTimerRemaining(totalMs);

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
      const remaining = totalMs - elapsed;

      if (remaining <= 0) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
        setTimerRemaining(0);
        fadeOutAndStop();
      } else {
        setTimerRemaining(remaining);
      }
    }, 1000);
  }, [fadeOutAndStop]);

  // ── Seleccionar y reproducir un sonido ──────────────────────────────────
  const play = useCallback(async (sound: AmbientSound, minutes: TimerMinutes) => {
    // Detener audio anterior si existe
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

    setError(null);
    setState('loading');
    setCurrentSound(sound);
    setTimerMinutes(minutes);

    try {
      // iOS: permitir audio en silencioso
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      }).catch(() => {});

      const audioUrl = await resolveAudioUrl(sound);

      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        {
          shouldPlay: true,
          isLooping: true,
          volume: isNarrationActiveRef.current ? VOLUME_UNDER_NARRATION : VOLUME_NORMAL,
        },
      );

      soundRef.current = audioSound;
      setState('playing');

      // Iniciar timer
      startTimer(minutes);
    } catch (err: any) {
      console.error('[useAmbientSound] play error:', err);
      setError(err?.message ?? 'No se pudo reproducir el sonido');
      setState('error');
      setCurrentSound(null);
    }
  }, [resolveAudioUrl, startTimer]);

  // ── Detener manualmente ─────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setState('idle');
    setCurrentSound(null);
    setTimerRemaining(null);
  }, []);

  // ── Ajustar volumen según narración ─────────────────────────────────────
  const setNarrationActive = useCallback(async (active: boolean) => {
    isNarrationActiveRef.current = active;
    if (soundRef.current) {
      const targetVolume = active ? VOLUME_UNDER_NARRATION : VOLUME_NORMAL;
      await soundRef.current.setVolumeAsync(targetVolume).catch(() => {});
    }
  }, []);

  // ── Preview de 3 segundos ──────────────────────────────────────────────
  const previewRef = useRef<Audio.Sound | null>(null);

  const preview = useCallback(async (sound: AmbientSound) => {
    // Detener preview anterior
    if (previewRef.current) {
      await previewRef.current.stopAsync().catch(() => {});
      await previewRef.current.unloadAsync().catch(() => {});
      previewRef.current = null;
    }

    try {
      const audioUrl = await resolveAudioUrl(sound);
      const { sound: previewSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, volume: VOLUME_NORMAL },
      );
      previewRef.current = previewSound;

      // Detener después de 3 segundos
      setTimeout(async () => {
        if (previewRef.current === previewSound) {
          await previewSound.stopAsync().catch(() => {});
          await previewSound.unloadAsync().catch(() => {});
          previewRef.current = null;
        }
      }, 3000);
    } catch (err) {
      console.warn('[useAmbientSound] preview error:', err);
    }
  }, [resolveAudioUrl]);

  // Cleanup preview al desmontar
  useEffect(() => {
    return () => {
      if (previewRef.current) {
        previewRef.current.stopAsync().catch(() => {});
        previewRef.current.unloadAsync().catch(() => {});
        previewRef.current = null;
      }
    };
  }, []);

  return {
    state,
    error,
    currentSound,
    timerMinutes,
    timerRemaining,
    play,
    stop,
    preview,
    setTimerMinutes,
    setNarrationActive,
  };
}
