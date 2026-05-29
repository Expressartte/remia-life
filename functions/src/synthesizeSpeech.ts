import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import OpenAI from 'openai';

// Init defensivo (transcribeAudio.ts también lo llama; admin.apps evita doble init)
if (!admin.apps.length) {
  admin.initializeApp();
}

const bucket = admin.storage().bucket();

// ─── Tipos ────────────────────────────────────────────────────────────────────

// OpenAI-only. El campo `provider` se conserva por compat de clientes viejos
// pero se ignora: ElevenLabs se removió al dejar de pagarlo (mayo 2026).
type Provider = 'openai';

interface SynthRequest {
  text: string;
  dreamId?: string;        // opcional: si se pasa, agrupa el cache bajo el sueño
  kind?: string;           // opcional: si se pasa (sin dreamId), agrupa bajo users/{uid}/tts/{kind}/...
  provider?: string;       // legacy/ignorado: el servicio es OpenAI-only
  voice?: string;          // override del default
  speed?: number;          // 0.25 - 4.0 (OpenAI)
}

interface SynthResponse {
  audioPath: string;       // path en Storage (cliente lo lee via getDownloadURL)
  cached: boolean;
  provider: Provider;
  contentType: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const OPENAI_DEFAULT_VOICE = 'nova';     // femenina cálida, buena para narración
const OPENAI_MODEL = 'tts-1';            // tts-1-hd cuesta el doble; tts-1 alcanza

const MAX_TEXT_LENGTH = 4000;            // safety cap
const STORAGE_AUDIO_PREFIX = 'tts';      // users/{uid}/dreams/{dreamId}/tts-{provider}.mp3
const GENERIC_TTS_PREFIX = 'tts';        // users/{uid}/tts/{kind}/{provider}-{hash}.mp3

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStoragePath(
  userId: string,
  provider: Provider,
  dreamId: string | undefined,
  kind: string | undefined,
  textHash: string
): string {
  if (dreamId) {
    return `users/${userId}/dreams/${dreamId}/${STORAGE_AUDIO_PREFIX}-${provider}.mp3`;
  }
  const safeKind = (kind ?? 'misc').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return `users/${userId}/${GENERIC_TTS_PREFIX}/${safeKind}/${provider}-${textHash}.mp3`;
}

function hashText(text: string, voice: string): string {
  return crypto
    .createHash('sha1')
    .update(text + '|' + voice)
    .digest('hex')
    .slice(0, 16);
}

async function fileMatchesText(storagePath: string, expectedHash: string): Promise<boolean> {
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) return false;
  const [meta] = await file.getMetadata();
  return meta.metadata?.textHash === expectedHash;
}

async function uploadAudio(
  storagePath: string,
  buffer: Buffer,
  textHash: string,
  provider: Provider
): Promise<void> {
  await bucket.file(storagePath).save(buffer, {
    contentType: 'audio/mpeg',
    metadata: {
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000', // 1 año (es contenido derivado e inmutable por hash)
      metadata: {
        provider,
        textHash,
        generatedAt: new Date().toISOString(),
      },
    },
  });
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function synthesizeWithOpenAI(
  text: string,
  voice: string,
  speed: number
): Promise<Buffer> {
  const apiKey = functions.config().openai?.key ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'OPENAI_API_KEY no configurada');
  }
  const openai = new OpenAI({ apiKey });
  const resp = await openai.audio.speech.create({
    model: OPENAI_MODEL,
    voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
    input: text,
    speed: Math.max(0.25, Math.min(4.0, speed)),
    response_format: 'mp3',
  });
  return Buffer.from(await resp.arrayBuffer());
}

// ─── Cloud Function ──────────────────────────────────────────────────────────

export const synthesizeSpeech = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data: SynthRequest, context): Promise<SynthResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    const userId = context.auth.uid;

    const text = (data.text ?? '').trim();
    if (!text) {
      throw new functions.https.HttpsError('invalid-argument', 'text vacío');
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `text supera ${MAX_TEXT_LENGTH} caracteres (recibido ${text.length})`
      );
    }

    const provider: Provider = 'openai';
    const voice = data.voice ?? OPENAI_DEFAULT_VOICE;
    const speed = data.speed ?? 1.0;

    const textHash = hashText(text, voice);
    const storagePath = buildStoragePath(userId, provider, data.dreamId, data.kind, textHash);

    // ── Cache hit? ────────────────────────────────────────────────────────────
    if (await fileMatchesText(storagePath, textHash)) {
      functions.logger.info('[synthesizeSpeech] cache hit', { userId, provider, storagePath });
      return { audioPath: storagePath, cached: true, provider, contentType: 'audio/mpeg' };
    }

    // ── Generar ───────────────────────────────────────────────────────────────
    functions.logger.info('[synthesizeSpeech] generating', {
      userId,
      provider,
      voice,
      textLength: text.length,
      dreamId: data.dreamId ?? null,
    });

    const audio = await synthesizeWithOpenAI(text, voice, speed);

    await uploadAudio(storagePath, audio, textHash, provider);

    return { audioPath: storagePath, cached: false, provider, contentType: 'audio/mpeg' };
  });
