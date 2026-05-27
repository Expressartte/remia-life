import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Haptics from 'expo-haptics';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type RecorderState =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'preview'
  | 'error';

export interface UseAudioRecorderReturn {
  state: RecorderState;
  durationSecs: number;
  /** Últimas WAVEFORM_BARS lecturas de metering normalizadas 0–1 */
  meteringBuffer: number[];
  audioUri: string | null;
  warning: string | null;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  discardRecording: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const WAVEFORM_BARS = 40;
const MAX_DURATION_SECS = 600; // 10 minutos
const WARNING_SECS = 480;      // 8 minutos
const METERING_INTERVAL_MS = 80;

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 128000,
  },
  isMeteringEnabled: true,
  keepAudioActiveHint: true,
};

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Convierte dBFS (–160 … 0) a valor normalizado 0–1 con curva logarítmica */
const dbToNormalized = (db: number): number => {
  const clamped = Math.max(-60, Math.min(0, db));
  return Math.pow((clamped + 60) / 60, 2);
};

const triggerImpact = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

const triggerNotification = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationSecs, setDurationSecs] = useState(0);
  const [meteringBuffer, setMeteringBuffer] = useState<number[]>(
    Array(WAVEFORM_BARS).fill(0)
  );
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPausedRef = useRef(false);
  const durationRef = useRef(0); // ref para acceso sin stale closure en el timer

  // ── Limpia el timer de duración ───────────────────────────────────────────

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Arranca el timer de duración ──────────────────────────────────────────

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDurationSecs(durationRef.current);

      if (durationRef.current === WARNING_SECS) {
        setWarning('2 minutos restantes de grabación');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }

      if (durationRef.current >= MAX_DURATION_SECS) {
        // Detiene automáticamente al alcanzar el límite
        stopRecording();
      }
    }, 1000);
  }, [clearTimer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-pausa cuando la app pasa a background ───────────────────────────

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active' && state === 'recording') {
        autoPausedRef.current = true;
        pauseRecording();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Configuración de audio mode ───────────────────────────────────────────

  const configureAudioSession = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  };

  // ── startRecording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      setState('requesting');
      setErrorMessage(null);
      setWarning(null);

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setState('error');
        setErrorMessage(
          'Remia necesita acceso al micrófono para grabar tu sueño.\n' +
          'Actívalo en Ajustes → Remia → Micrófono.'
        );
        return;
      }

      await configureAudioSession();

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);

      // Callback de metering: actualiza el buffer de waveform
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording) return;
        if (status.metering !== undefined) {
          const normalized = dbToNormalized(status.metering);
          setMeteringBuffer((prev) => {
            const next = [...prev.slice(1), normalized];
            return next;
          });
        }
      });
      recording.setProgressUpdateInterval(METERING_INTERVAL_MS);

      await recording.startAsync();

      recordingRef.current = recording;
      durationRef.current = 0;
      setDurationSecs(0);
      setState('recording');
      startTimer();
      triggerImpact();
    } catch (err) {
      console.error('[useAudioRecorder] startRecording error:', err);
      setState('error');
      setErrorMessage('No se pudo iniciar la grabación. Intenta de nuevo.');
    }
  }, [startTimer]);

  // ── pauseRecording ────────────────────────────────────────────────────────

  const pauseRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.pauseAsync();
      clearTimer();
      setState('paused');
      triggerImpact();
    } catch (err) {
      console.warn('[useAudioRecorder] pauseRecording error:', err);
    }
  }, [clearTimer]);

  // ── resumeRecording ───────────────────────────────────────────────────────

  const resumeRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.startAsync();
      setState('recording');
      startTimer();
      triggerImpact();
      if (autoPausedRef.current) {
        autoPausedRef.current = false;
        setWarning(null);
      }
    } catch (err) {
      console.warn('[useAudioRecorder] resumeRecording error:', err);
    }
  }, [startTimer]);

  // ── stopRecording ─────────────────────────────────────────────────────────

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    try {
      clearTimer();
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // Restaura audio mode para playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setAudioUri(uri ?? null);
      setState('preview');
      triggerNotification();
    } catch (err) {
      console.error('[useAudioRecorder] stopRecording error:', err);
      setState('error');
      setErrorMessage('Error al guardar la grabación. Intenta de nuevo.');
    }
  }, [clearTimer]);

  // ── discardRecording ──────────────────────────────────────────────────────

  const discardRecording = useCallback(() => {
    clearTimer();
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    setAudioUri(null);
    setDurationSecs(0);
    durationRef.current = 0;
    setMeteringBuffer(Array(WAVEFORM_BARS).fill(0));
    setWarning(null);
    setErrorMessage(null);
    setState('idle');
  }, [clearTimer]);

  // ── Cleanup al desmontar ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearTimer();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, [clearTimer]);

  return {
    state,
    durationSecs,
    meteringBuffer,
    audioUri,
    warning,
    errorMessage,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
  };
}
