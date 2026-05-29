import { useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { functions, storage } from '../services/firebase';
import { MeditationPhase } from './useNightRitual';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SynthRequest {
  text: string;
  kind?: string;
  provider?: 'openai' | 'elevenlabs';
  voice?: string;
}
interface SynthResponse {
  audioPath: string;
  cached: boolean;
}

interface PreloadedPhase {
  phaseId: string;
  sound: Audio.Sound;
  durationMs: number;
}

// ─── Scripts enriquecidos por fase ────────────────────────────────────────────

/**
 * Genera un texto de narración más completo para cada fase.
 * Cada bloque se mantiene corto (100-300 chars): bloques cortos suenan más
 * naturales con el TTS y permiten encadenar fases con silencios calculados.
 */
function buildPhaseScript(
  phase: MeditationPhase,
  pendingSilvaText: string | null,
): string {
  switch (phase.id) {
    case 'relax':
      return (
        'Cierra los ojos suavemente. ' +
        'Afloja los músculos de tu frente, tu mandíbula, tus hombros. ' +
        'Siente cómo cada parte de tu cuerpo se vuelve más pesada y relajada. ' +
        'Con cada respiración, suelta las tensiones que acumulaste hoy.'
      );

    case 'countdown':
      return (
        'Ahora imagina que desciendes por una escalera suave, iluminada por una luz cálida. ' +
        'Cada peldaño te lleva más profundo, más tranquilo. ' +
        'Sientes cómo tu mente se aquieta, como la superficie de un lago en calma. ' +
        'Estás entrando en un estado de profunda receptividad.'
      );

    case 'intention':
      return (
        'Repite mentalmente conmigo: Esta noche recordaré mis sueños con claridad y detalle. ' +
        'Mi mente está abierta y receptiva. ' +
        'Cada imagen, cada sensación, cada escena quedará grabada en mi memoria. ' +
        'Mañana al despertar, lo recordaré todo.'
      );

    case 'silva':
      if (pendingSilvaText) {
        return (
          'Ahora activa tu pantalla mental. Visualiza con todos tus sentidos la siguiente escena: ' +
          pendingSilvaText.trim() + '. ' +
          'Observa cada detalle. Siente las emociones. Haz esta experiencia completamente tuya.'
        );
      }
      return (
        'Ahora activa tu pantalla mental. ' +
        'Visualiza un lugar que te transmita paz absoluta. ' +
        'Observa los colores, las texturas, los sonidos de ese espacio. ' +
        'Permítete habitar esta escena con todos tus sentidos.'
      );

    case 'reinforcement':
      return (
        'Imagínate despertando mañana con la mente clara. ' +
        'Puedes ver cada escena de tu sueño con nitidez, como si volvieras a vivirla. ' +
        'Te sientes agradecido por la riqueza de tus sueños. ' +
        'Esta imagen se está grabando en tu subconsciente.'
      );

    case 'close':
      return (
        'Muy bien. Tu mente está programada y lista para soñar. ' +
        'Ahora simplemente descansa. ' +
        'Confía en tu subconsciente. Él se encargará de todo esta noche. ' +
        'Dulces sueños.'
      );

    default:
      return phase.guidance;
  }
}

// ─── Utilidad de fecha ────────────────────────────────────────────────────────

function getLocalDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─── Hook principal ──────────────────────────────────────────────────────────

/**
 * Pre-genera audios enriquecidos para cada fase del ritual nocturno y los
 * reproduce encadenados con silencios calculados entre ellos.
 *
 * Flujo:
 *  [Audio Fase 1] → [silencio] → [Audio Fase 2] → [silencio] → … → [Audio N]
 *
 * El silencio entre fases se calcula como:
 *   silencioMs = (phaseDurationSecs - audioDurationSecs) * 1000
 *
 * @param phases       Las fases de meditación
 * @param progress     Progreso actual del timer (0-1)
 * @param enabled      Si la narración está activa (voiceEnabled && isPlaying)
 * @param pendingSilvaText  Texto de mental_screen_recommendation (puede ser null)
 * @param totalDurationSecs Duración total de la meditación en segundos
 */
export function useRitualNarration(
  phases: MeditationPhase[],
  progress: number,
  enabled: boolean,
  pendingSilvaText: string | null,
  totalDurationSecs: number,
) {
  // ── Refs para estado mutable (evitar re-renders) ────────────────────────
  const preloadedRef = useRef<Map<string, PreloadedPhase>>(new Map());
  const currentSoundRef = useRef<Audio.Sound | null>(null);
  const currentPhaseIdxRef = useRef(-1);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  const isPlayingChainRef = useRef(false);
  const preloadingRef = useRef(false);

  // Mantener enabledRef sincronizado
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // ── Pre-cargar audios al activar narración ──────────────────────────────
  useEffect(() => {
    if (!enabled || preloadingRef.current) return;
    if (preloadedRef.current.size === phases.length) return; // ya precargados

    let cancelled = false;
    preloadingRef.current = true;

    (async () => {
      // iOS: permitir audio en silencioso
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      }).catch(() => {});

      const synth = httpsCallable<SynthRequest, SynthResponse>(functions, 'synthesizeSpeech');
      const dateKey = getLocalDateKey();

      for (const phase of phases) {
        if (cancelled) return;
        if (preloadedRef.current.has(phase.id)) continue;

        try {
          const script = buildPhaseScript(phase, pendingSilvaText);
          const result = await synth({
            text: script,
            kind: `night-ritual-${dateKey}-${phase.id}`,
            provider: 'openai',
          });
          if (cancelled) return;

          const url = await getDownloadURL(ref(storage, result.data.audioPath));
          const { sound, status } = await Audio.Sound.createAsync(
            { uri: url },
            { shouldPlay: false },
          );

          // Obtener duración real del audio
          let durationMs = 15000; // fallback de 15s
          if (status.isLoaded && status.durationMillis) {
            durationMs = status.durationMillis;
          }

          preloadedRef.current.set(phase.id, {
            phaseId: phase.id,
            sound,
            durationMs,
          });
        } catch (err) {
          console.warn('[useRitualNarration] preload failed for', phase.id, err);
        }
      }

      preloadingRef.current = false;

      // Si sigue habilitado y aún no ha comenzado la cadena, iniciarla
      if (!cancelled && enabledRef.current && !isPlayingChainRef.current) {
        startChain();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, phases, pendingSilvaText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Función: iniciar la cadena de reproducción ──────────────────────────
  const startChain = useCallback(() => {
    if (isPlayingChainRef.current) return;
    isPlayingChainRef.current = true;
    currentPhaseIdxRef.current = -1;
    playNextPhase();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Función: reproducir la siguiente fase ───────────────────────────────
  const playNextPhase = useCallback(() => {
    if (!enabledRef.current) {
      isPlayingChainRef.current = false;
      return;
    }

    const nextIdx = currentPhaseIdxRef.current + 1;
    if (nextIdx >= phases.length) {
      // Cadena terminada
      isPlayingChainRef.current = false;
      return;
    }

    const phase = phases[nextIdx];
    const preloaded = preloadedRef.current.get(phase.id);
    if (!preloaded) {
      // Audio no disponible aún, saltar fase
      currentPhaseIdxRef.current = nextIdx;
      // Calcular duración de fase en ms y esperar antes de la siguiente
      const phaseDurationMs = (phase.endPct - phase.startPct) * totalDurationSecs * 1000;
      silenceTimeoutRef.current = setTimeout(() => playNextPhase(), phaseDurationMs);
      return;
    }

    currentPhaseIdxRef.current = nextIdx;

    (async () => {
      try {
        // Detener el audio anterior si aún sonaba
        if (currentSoundRef.current && currentSoundRef.current !== preloaded.sound) {
          await currentSoundRef.current.stopAsync().catch(() => {});
        }

        currentSoundRef.current = preloaded.sound;

        // Listener para detectar fin del audio
        preloaded.sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            // Calcular silencio: duración de fase - duración del audio
            const phaseDurationMs = (phase.endPct - phase.startPct) * totalDurationSecs * 1000;
            const silenceMs = Math.max(0, phaseDurationMs - preloaded.durationMs);

            if (silenceMs > 500) {
              // Esperar el silencio calculado antes de la siguiente fase
              silenceTimeoutRef.current = setTimeout(() => {
                if (enabledRef.current) {
                  playNextPhase();
                }
              }, silenceMs);
            } else {
              // Sin silencio significativo, pasar directo
              if (enabledRef.current) {
                playNextPhase();
              }
            }
          }
        });

        await preloaded.sound.setPositionAsync(0);
        await preloaded.sound.playAsync();
      } catch (err) {
        console.warn('[useRitualNarration] play failed for', phase.id, err);
        // Intentar con la siguiente fase
        const phaseDurationMs = (phase.endPct - phase.startPct) * totalDurationSecs * 1000;
        silenceTimeoutRef.current = setTimeout(() => playNextPhase(), Math.min(phaseDurationMs, 3000));
      }
    })();
  }, [phases, totalDurationSecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pausar/reanudar cuando cambia `enabled` ────────────────────────────
  useEffect(() => {
    if (enabled) {
      // Activar: si hay audios precargados, iniciar o reanudar
      if (preloadedRef.current.size > 0 && !isPlayingChainRef.current) {
        // Si ya se reprodujo algo, reanudar el audio actual
        if (currentPhaseIdxRef.current >= 0 && currentSoundRef.current) {
          currentSoundRef.current.playAsync().catch(() => {});
          isPlayingChainRef.current = true;
        } else {
          startChain();
        }
      }
    } else {
      // Desactivar: pausar audio actual + cancelar timeout
      if (currentSoundRef.current) {
        currentSoundRef.current.pauseAsync().catch(() => {});
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      isPlayingChainRef.current = false;
    }
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup al desmontar ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Cancelar timeout pendiente
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      // Detener y descargar todos los audios
      preloadedRef.current.forEach(p => {
        p.sound.stopAsync().catch(() => {});
        p.sound.unloadAsync().catch(() => {});
      });
      preloadedRef.current.clear();
      currentSoundRef.current = null;
      currentPhaseIdxRef.current = -1;
      isPlayingChainRef.current = false;
      preloadingRef.current = false;
    };
  }, []);
}
