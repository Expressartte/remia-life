import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OpenAI from 'openai';

// ─── Init ─────────────────────────────────────────────────────────────────────

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_ATTEMPTS = 3;
const AUDIO_PATH_REGEX = /^users\/([^/]+)\/dreams\/([^/]+)\/audio\..+$/;

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface TranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Descarga un archivo de Storage al directorio temporal de la función.
 * Devuelve la ruta local del archivo descargado.
 */
async function downloadToTemp(storagePath: string, ext: string): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `remia_audio_${Date.now()}${ext}`);
  await bucket.file(storagePath).download({ destination: tmpPath });
  functions.logger.info('[transcribeAudio] Audio descargado', { tmpPath, storagePath });
  return tmpPath;
}

/**
 * Llama a la API de Whisper de OpenAI con el archivo de audio.
 * Devuelve el texto transcrito y metadatos.
 */
async function callWhisper(localPath: string): Promise<TranscriptionResult> {
  const openai = new OpenAI({
    apiKey: functions.config().openai?.key ?? process.env.OPENAI_API_KEY,
  });

  const fileStream = fs.createReadStream(localPath);

  const response = await openai.audio.transcriptions.create({
    file: fileStream,
    model: 'whisper-1',
    response_format: 'verbose_json',
    // Forzar detección de idioma en español; Whisper es multilenguaje
    // pero damos hint para mejorar precisión en sueños narrados en español
    language: 'es',
    temperature: 0,
  });

  return {
    text: response.text,
    language: response.language,
    durationSeconds: response.duration,
    // verbose_json incluye segments con timestamps
    segments: (response.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  };
}

/**
 * Actualiza el documento de Firestore con el estado y los datos de transcripción.
 */
async function updateDreamDoc(
  userId: string,
  dreamId: string,
  data: admin.firestore.UpdateData<admin.firestore.DocumentData>
): Promise<void> {
  const ref = db.collection('users').doc(userId).collection('dreams').doc(dreamId);
  await ref.update({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Limpia el archivo temporal del disco.
 */
function cleanupTemp(tmpPath: string): void {
  try {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    functions.logger.info('[transcribeAudio] Archivo temporal eliminado', { tmpPath });
  } catch (err) {
    functions.logger.warn('[transcribeAudio] No se pudo eliminar archivo temporal', { tmpPath, err });
  }
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const transcribeAudio = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    // Retry automático de GCP con backoff exponencial. El handler lanza para
    // pedir reintento; cuando `attemptCount` alcanza MAX_ATTEMPTS retorna
    // sin throw para cortar la cadena (GCP puede reintentar hasta 7 días,
    // el contador en Firestore es la salvaguarda real).
    failurePolicy: true,
  })
  .storage.object()
  .onFinalize(async (object) => {
    const storagePath = object.name ?? '';
    const contentType = object.contentType ?? '';

    // ── 1. Validar que el path corresponde a un audio de dream ─────────────

    const match = AUDIO_PATH_REGEX.exec(storagePath);
    if (!match) {
      functions.logger.info('[transcribeAudio] Path ignorado (no coincide con patrón)', { storagePath });
      return;
    }

    const [, userId, dreamId] = match;

    functions.logger.info('[transcribeAudio] Procesando audio', { userId, dreamId, storagePath });

    // ── 2. Verificar que es un archivo de audio ────────────────────────────

    if (!contentType.startsWith('audio/')) {
      functions.logger.warn('[transcribeAudio] contentType no es audio, ignorando', { contentType, storagePath });
      return;
    }

    // ── 3. Verificar tamaño máximo (50 MB) ────────────────────────────────

    const fileSizeBytes = parseInt(object.size ?? '0', 10);
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      functions.logger.error('[transcribeAudio] Archivo demasiado grande', {
        fileSizeBytes,
        maxBytes: MAX_FILE_SIZE_BYTES,
        userId,
        dreamId,
      });
      await updateDreamDoc(userId, dreamId, {
        status: 'error',
        'error.code': 'FILE_TOO_LARGE',
        'error.message': `El archivo de audio supera el límite de 50 MB (${Math.round(fileSizeBytes / 1024 / 1024)} MB)`,
        'error.occurredAt': admin.firestore.FieldValue.serverTimestamp(),
      });
      return; // No hacer retry: error permanente
    }

    // ── 4. Verificar metadatos de autenticación ───────────────────────────
    // expo-av / Firebase Storage SDK incluye los customMetadata del cliente

    const metadata = object.metadata ?? {};
    const metaUserId = metadata['userId'];
    const metaDreamId = metadata['dreamId'];

    if (metaUserId && metaUserId !== userId) {
      functions.logger.error('[transcribeAudio] userId en metadata no coincide con path', {
        pathUserId: userId,
        metaUserId,
        storagePath,
      });
      // No procesar archivos cuyo metadata no coincide con el path
      return;
    }

    if (metaDreamId && metaDreamId !== dreamId) {
      functions.logger.error('[transcribeAudio] dreamId en metadata no coincide con path', {
        pathDreamId: dreamId,
        metaDreamId,
        storagePath,
      });
      return;
    }

    // ── 5. Leer el documento actual para conocer el número de intentos ────

    const dreamRef = db.collection('users').doc(userId).collection('dreams').doc(dreamId);
    const dreamSnap = await dreamRef.get();

    if (!dreamSnap.exists) {
      functions.logger.error('[transcribeAudio] Documento de dream no existe', { userId, dreamId });
      return;
    }

    const dreamData = dreamSnap.data()!;
    const attemptCount: number = dreamData?.metadata?.transcriptionAttempts ?? 0;

    if (attemptCount >= MAX_ATTEMPTS) {
      functions.logger.error('[transcribeAudio] Máximo de reintentos alcanzado, no se procesará más', {
        userId,
        dreamId,
        attemptCount,
      });
      // Defensa: si el doc quedó atascado en 'transcribing' (la rama de error
      // del último intento no llegó a ejecutarse), marcarlo como error ahora
      // para que la UI lo muestre y el usuario pueda reintentar manualmente.
      if (dreamData.status === 'transcribing') {
        await updateDreamDoc(userId, dreamId, {
          status: 'error',
          'error.code': 'TRANSCRIPTION_FAILED',
          'error.message': `Transcripción fallida tras ${MAX_ATTEMPTS} intentos`,
          'error.occurredAt': admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return;
    }

    // Incrementar contador de intentos antes de transcribir
    await dreamRef.update({
      'metadata.transcriptionAttempts': admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ── 6. Descargar audio a /tmp ─────────────────────────────────────────

    const ext = path.extname(storagePath) || '.m4a';
    let tmpPath: string | null = null;

    try {
      tmpPath = await downloadToTemp(storagePath, ext);
    } catch (err) {
      functions.logger.error('[transcribeAudio] Error al descargar el archivo', { err, storagePath });
      // Lanzar para que GCP reintente con backoff exponencial
      throw new Error(`Download failed: ${err}`);
    }

    // ── 7. Transcribir con Whisper ────────────────────────────────────────

    let transcription: TranscriptionResult;

    try {
      transcription = await callWhisper(tmpPath);
      functions.logger.info('[transcribeAudio] Transcripción exitosa', {
        userId,
        dreamId,
        textLength: transcription.text.length,
        language: transcription.language,
        durationSeconds: transcription.durationSeconds,
      });
    } catch (err) {
      functions.logger.error('[transcribeAudio] Error en Whisper API', { err, userId, dreamId });
      cleanupTemp(tmpPath);

      const isLastAttempt = attemptCount + 1 >= MAX_ATTEMPTS;

      if (isLastAttempt) {
        // Último intento fallido: marcar como error permanente
        await updateDreamDoc(userId, dreamId, {
          status: 'error',
          'error.code': 'TRANSCRIPTION_FAILED',
          'error.message': `Transcripción fallida tras ${MAX_ATTEMPTS} intentos`,
          'error.occurredAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        return; // No relanzar: evitar retry infinito
      }

      // Hay reintentos disponibles: relanzar para que GCP reintente
      throw new Error(`Whisper API failed (attempt ${attemptCount + 1}/${MAX_ATTEMPTS}): ${err}`);
    }

    // ── 8. Guardar transcripción en Firestore ─────────────────────────────

    try {
      // Land the dream in 'captured', NOT 'awaiting_questions'. The socratic
      // dialog is now opt-in: the user decides at wake time whether to deepen
      // or go back to sleep. The status flips to 'awaiting_questions' only when
      // the user (or the askQuestionsAtWake preference) explicitly requests it,
      // which is what triggers generateSocraticQuestions downstream.
      await updateDreamDoc(userId, dreamId, {
        status: 'captured',
        transcription: {
          text: transcription.text,
          language: transcription.language ?? 'es',
          durationSeconds: transcription.durationSeconds ?? null,
          segments: transcription.segments ?? [],
          transcribedAt: admin.firestore.FieldValue.serverTimestamp(),
          model: 'whisper-1',
        },
        // Limpiar error previo si existía
        error: admin.firestore.FieldValue.delete(),
      });

      functions.logger.info('[transcribeAudio] Firestore actualizado → captured', {
        userId,
        dreamId,
      });
    } catch (err) {
      functions.logger.error('[transcribeAudio] Error al guardar en Firestore', { err, userId, dreamId });
      cleanupTemp(tmpPath);
      throw new Error(`Firestore update failed: ${err}`);
    }

    // ── 9. Limpieza ───────────────────────────────────────────────────────

    cleanupTemp(tmpPath);
  });
