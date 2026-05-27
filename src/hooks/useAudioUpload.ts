import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage, db, auth } from '../services/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type UploadState = 'idle' | 'creating_doc' | 'uploading' | 'done' | 'offline' | 'error';

export interface UseAudioUploadReturn {
  uploadState: UploadState;
  progress: number;       // 0–1
  dreamId: string | null;
  errorMessage: string | null;
  uploadAudio: (params: UploadParams) => Promise<string | null>;
  reset: () => void;
}

interface UploadParams {
  audioUri: string;
  userId: string;
  durationSecs: number;
}

// ─── Clave de la cola offline en AsyncStorage ─────────────────────────────────

const OFFLINE_QUEUE_KEY = '@remia/offline_upload_queue';

interface OfflineQueueEntry {
  dreamId: string;
  userId: string;
  localPath: string;
  storagePath: string;
  durationSecs: number;
  createdAt: string;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Extensión y MIME del audio producido por useAudioRecorder para la plataforma actual.
 *  Whisper usa el nombre del archivo para inferir el contenedor; si mentimos
 *  (webm etiquetado como m4a) la petición a OpenAI se cuelga y termina en ECONNRESET. */
const getAudioFormat = (): { ext: string; mime: string } => {
  if (Platform.OS === 'web') {
    return { ext: 'webm', mime: 'audio/webm' };
  }
  return { ext: 'm4a', mime: 'audio/m4a' };
};

/** Lee el archivo de audio y lo convierte a Blob para Firebase Storage */
const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  return response.blob();
};

/** Copia el audio a un directorio persistente si es un archivo temporal.
 *  En web no existe FileSystem.documentDirectory, así que devolvemos el URI tal cual
 *  (suele ser un blob: URL que sigue siendo válido mientras la página esté abierta). */
const persistAudioLocally = async (
  uri: string,
  dreamId: string
): Promise<string> => {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return uri;
  }

  const dir = `${FileSystem.documentDirectory}remia/pending/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${dreamId}.m4a`;

  // Solo copia si no está ya en el directorio de documentos
  if (!uri.startsWith(FileSystem.documentDirectory)) {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }
  return uri;
};

/** Guarda la entrada en la cola offline de AsyncStorage */
const enqueueOffline = async (entry: OfflineQueueEntry): Promise<void> => {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  const queue: OfflineQueueEntry[] = raw ? JSON.parse(raw) : [];
  queue.push(entry);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioUpload(): UseAudioUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [dreamId, setDreamId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUploadState('idle');
    setProgress(0);
    setDreamId(null);
    setErrorMessage(null);
  }, []);

  const uploadAudio = useCallback(
    async ({ audioUri, userId, durationSecs }: UploadParams): Promise<string | null> => {
      let newDreamId: string | null = null;

      const { ext: audioExt, mime: audioMime } = getAudioFormat();

      try {
        // 1. Crea el documento en Firestore con status "recording"
        setUploadState('creating_doc');

        const current = auth.currentUser;
        if (!current) {
          throw new Error(`auth.currentUser is null (param userId=${userId})`);
        }
        if (current.uid !== userId) {
          throw new Error(`auth mismatch: currentUser.uid=${current.uid} vs param userId=${userId}`);
        }

        const dreamsRef = collection(db, 'users', userId, 'dreams');
        const dreamDoc = await addDoc(dreamsRef, {
          userId,
          date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'recording',
          recording: {
            durationSeconds: durationSecs,
            mimeType: audioMime,
          },
          transcription: null,
          socraticDialog: [],
          enrichedText: null,
          analysis: null,
          context: {
            stressLevel: null,
            previousNightMood: null,
            dailyEvents: null,
            sleepQualityEstimate: null,
          },
          metadata: {
            isInsightSource: false,
            insightIds: [],
            analysisRetryCount: 0,
            clientVersion: '1.0.0',
          },
        });

        newDreamId = dreamDoc.id;
        setDreamId(newDreamId);

        // 2. Verifica conectividad
        //    En web confiamos en navigator.onLine; expo-network a veces devuelve
        //    isInternetReachable=null en browsers y rompería la detección.
        let isConnected = true;
        if (Platform.OS === 'web') {
          isConnected = typeof navigator === 'undefined' ? true : navigator.onLine;
        } else {
          const network = await Network.getNetworkStateAsync();
          isConnected = Boolean(network.isConnected && network.isInternetReachable);
        }

        // 3. Persiste el audio localmente (protege contra archivos temporales)
        const localPath = await persistAudioLocally(audioUri, newDreamId);

        // En web no podemos persistir un blob URL entre recargas, así que offline
        // no es recuperable: se propaga el error y la UI ofrece reintentar.
        if (!isConnected && Platform.OS === 'web') {
          throw new Error('offline-web');
        }

        if (!isConnected) {
          // ── Modo offline: encola para sincronización posterior ────────────
          const storagePath = `users/${userId}/dreams/${newDreamId}/audio.${audioExt}`;

          await enqueueOffline({
            dreamId: newDreamId,
            userId,
            localPath,
            storagePath,
            durationSecs,
            createdAt: new Date().toISOString(),
          });

          // Marca el sueño con status especial para que la UI lo indique
          await updateDoc(doc(db, 'users', userId, 'dreams', newDreamId), {
            status: 'pending_upload',
            updatedAt: serverTimestamp(),
            'recording.audioLocalPath': localPath,
          });

          setUploadState('offline');
          return newDreamId;
        }

        // 4. Sube a Firebase Storage con tracking de progreso
        setUploadState('uploading');

        const storagePath = `users/${userId}/dreams/${newDreamId}/audio.${audioExt}`;
        const storageRef = ref(storage, storagePath);
        const blob = await uriToBlob(localPath);

        await new Promise<void>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(storageRef, blob, {
            contentType: audioMime,
            customMetadata: {
              userId,
              dreamId: newDreamId!,
              durationSeconds: String(durationSecs),
            },
          });

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const pct = snapshot.bytesTransferred / snapshot.totalBytes;
              setProgress(pct);
            },
            reject,
            resolve
          );
        });

        // 5. Actualiza Firestore: status → "transcribing", guarda path
        await updateDoc(doc(db, 'users', userId, 'dreams', newDreamId), {
          status: 'transcribing',
          updatedAt: serverTimestamp(),
          'recording.audioStoragePath': storagePath,
        });

        setUploadState('done');
        setProgress(1);
        return newDreamId;
      } catch (err: any) {
        console.error('[useAudioUpload] upload error:', err);
        const code = err?.code ? `[${err.code}] ` : '';
        const msg = err?.message ?? String(err);
        setErrorMessage(`${code}${msg}`);
        setUploadState('error');

        // Intenta marcar el error en Firestore si ya tenemos dreamId
        if (newDreamId) {
          updateDoc(doc(db, 'users', userId, 'dreams', newDreamId), {
            status: 'error',
            errorCode: 'UPLOAD_FAILED',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }

        return null;
      }
    },
    []
  );

  return { uploadState, progress, dreamId, errorMessage, uploadAudio, reset };
}

// ─── Función auxiliar exportada: procesa la cola offline ─────────────────────
// Llamar desde un componente cuando se detecta que se restauró la conexión

export const processPendingUploads = async (userId: string): Promise<void> => {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!raw) return;

  const queue: OfflineQueueEntry[] = JSON.parse(raw);
  const remaining: OfflineQueueEntry[] = [];

  for (const entry of queue) {
    if (entry.userId !== userId) {
      remaining.push(entry);
      continue;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
      if (!fileInfo.exists) continue;

      const blob = await uriToBlob(entry.localPath);
      const storageRef = ref(storage, entry.storagePath);
      await new Promise<void>((resolve, reject) => {
        uploadBytesResumable(storageRef, blob, { contentType: 'audio/m4a' })
          .on('state_changed', null, reject, resolve);
      });

      await updateDoc(doc(db, 'users', userId, 'dreams', entry.dreamId), {
        status: 'transcribing',
        updatedAt: serverTimestamp(),
        'recording.audioStoragePath': entry.storagePath,
      });

      // Limpia el archivo local una vez subido
      await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
    } catch {
      remaining.push(entry); // Reintentará en la próxima llamada
    }
  }

  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
};
