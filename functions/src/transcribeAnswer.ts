import * as functions from 'firebase-functions';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OpenAI from 'openai';

// ─── Límites ──────────────────────────────────────────────────────────────────

const MAX_BASE64_LENGTH = 7 * 1024 * 1024; // ~5 MB de audio (base64 añade ~33%)

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const transcribeAnswer = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(
    async (data: { audioBase64: string; mimeType?: string }, context) => {
      // ── Autenticación ──────────────────────────────────────────────────────

      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Debes iniciar sesión para continuar.'
        );
      }

      const { audioBase64, mimeType = 'audio/m4a' } = data;

      if (!audioBase64 || typeof audioBase64 !== 'string') {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Se requiere audioBase64.'
        );
      }

      if (audioBase64.length > MAX_BASE64_LENGTH) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'El audio es demasiado largo para una respuesta de diálogo.'
        );
      }

      functions.logger.info('[transcribeAnswer] Transcribiendo respuesta de voz', {
        userId: context.auth.uid,
        audioLength: audioBase64.length,
      });

      // ── Decodificar y guardar en /tmp ──────────────────────────────────────

      const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? '.m4a' : '.webm';
      const tmpPath = path.join(os.tmpdir(), `answer_${Date.now()}${ext}`);

      try {
        const buffer = Buffer.from(audioBase64, 'base64');
        fs.writeFileSync(tmpPath, buffer);
      } catch (err) {
        throw new functions.https.HttpsError('internal', 'Error al procesar el audio.');
      }

      // ── Transcribir con Whisper ────────────────────────────────────────────

      let text: string;

      try {
        const openai = new OpenAI({
          apiKey: functions.config().openai?.key ?? process.env.OPENAI_API_KEY,
        });

        const response = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tmpPath),
          model: 'whisper-1',
          language: 'es',
          temperature: 0,
        });

        text = response.text;

        functions.logger.info('[transcribeAnswer] Transcripción exitosa', {
          userId: context.auth.uid,
          textLength: text.length,
        });
      } catch (err) {
        functions.logger.error('[transcribeAnswer] Error en Whisper API', { err });
        throw new functions.https.HttpsError(
          'internal',
          'No se pudo transcribir el audio. Inténtalo de nuevo.'
        );
      } finally {
        // Limpiar siempre el archivo temporal
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {
          // No crítico
        }
      }

      return { text };
    }
  );
