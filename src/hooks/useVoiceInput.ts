import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VoiceInputState = 'idle' | 'recording' | 'transcribing' | 'error';

export interface UseVoiceInputReturn {
  state: VoiceInputState;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<string | null>;
  cancel: () => Promise<void>;
  errorMessage: string | null;
}

// ─── Opciones de grabación (igual que useAudioRecorder pero sin metering) ─────

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceInput(): UseVoiceInputReturn {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // ── Iniciar grabación ─────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (state !== 'idle') return;

    setErrorMessage(null);

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setErrorMessage('Permiso de micrófono denegado.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setState('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err) {
      setState('error');
      setErrorMessage('No se pudo iniciar la grabación.');
    }
  }, [state]);

  // ── Detener, subir y transcribir ──────────────────────────────────────────

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (state !== 'recording' || !recordingRef.current) return null;

    setState('transcribing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!uri) throw new Error('No se obtuvo URI del archivo de audio.');

      // Leer el archivo como base64
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Limpiar el archivo temporal inmediatamente
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // Llamar al Cloud Function para transcribir
      const callTranscribeAnswer = httpsCallable<
        { audioBase64: string; mimeType: string },
        { text: string }
      >(functions, 'transcribeAnswer');

      const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a';
      const result = await callTranscribeAnswer({ audioBase64, mimeType });
      setState('idle');
      return result.data.text;
    } catch (err: any) {
      recordingRef.current = null;
      setState('error');
      setErrorMessage('No se pudo transcribir tu respuesta. Escríbela manualmente.');
      return null;
    }
  }, [state]);

  // ── Cancelar grabación sin transcribir ────────────────────────────────────

  const cancel = useCallback(async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // ignorar
      }
      recordingRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    setState('idle');
    setErrorMessage(null);
  }, []);

  return { state, startRecording, stopAndTranscribe, cancel, errorMessage };
}
