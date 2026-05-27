import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

// Init defensivo
if (!admin.apps.length) {
  admin.initializeApp();
}

const bucket = admin.storage().bucket();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GenerateRequest {
  /** ID predefinido (sonidos del catálogo). Si NO se pasa, se trata como comunitario. */
  soundId?: string;
  /** Título legible. Solo requerido para sonidos comunitarios. */
  title?: string;
  prompt: string;
  durationSeconds?: number; // default 22
  /** Aplica crossfade interno para que el audio loopee sin click. Default true. */
  seamlessLoop?: boolean;
  /** Duración del crossfade en segundos. Default 2. */
  crossfadeSeconds?: number;
}

interface GenerateResponse {
  soundId: string;
  storagePath: string;
  cached: boolean;
  durationSeconds: number;
  seamlessLoop: boolean;
  /** True si fue un sonido comunitario recién creado. */
  isCommunity: boolean;
}

const db = admin.firestore();
const COMMUNITY_RATE_LIMIT_PER_DAY = 5;
const TITLE_MAX = 40;
const PROMPT_MAX = 500;

/** Lista negra básica (mejorable). Comparación case-insensitive sobre palabras enteras. */
const BLOCKLIST_PATTERNS: RegExp[] = [
  /\b(porn|sex|sexual|orgasm|moan|nude|naked)\b/i,
  /\b(gore|blood|bloody|killing|murder|torture|rape|abuse)\b/i,
  /\b(nazi|hitler|isis|terrorist)\b/i,
  /\b(porno|sexual|gemido|gemir|desnudo|orgia)\b/i,
  /\b(asesin|tortura|violaci[oó]n|maltrat|sangre)\b/i,
  /\b(racis|fascis|terroris)\w*/i,
];

function isPromptAllowed(text: string): boolean {
  return !BLOCKLIST_PATTERNS.some(rx => rx.test(text));
}

function getLocalDateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function shortRandomId(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

async function getCreatorNickname(uid: string): Promise<string> {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.data();
    if (!data) return 'Anónimo';
    const name = (data.name as string) ?? '';
    if (name && name.trim()) {
      // Primera palabra del nombre, capitalizada (e.g., "Juan Pérez" → "Juan")
      return name.trim().split(/\s+/)[0].slice(0, 20);
    }
    const email = (data.email as string) ?? '';
    if (email && email.includes('@')) {
      return email.split('@')[0].slice(0, 20);
    }
  } catch (err) {
    functions.logger.warn('[generateAmbientSound] could not resolve nickname', { uid, err });
  }
  return 'Anónimo';
}

// ─── Helpers: post-procesamiento para loop sin costuras ──────────────────────

/** Sufijo para el prompt que empuja a ElevenLabs a generar audio loopeable.
 *  Se concatena al prompt original cuando seamlessLoop=true. */
const SEAMLESS_LOOP_HINT =
  ' Continuous ambient texture, even amplitude throughout, no fade in or fade out, suitable for seamless looping.';

/** Ejecuta ffmpeg con args. Resuelve si exit code 0, rechaza si no. */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';
    proc.stderr.on('data', d => {
      stderr += d.toString();
    });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-600)}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Aplica un crossfade interno al audio para que loopee sin click audible.
 *
 * Técnica:
 *   - Toma los últimos X seg con fade-out
 *   - Toma los primeros X seg con fade-in
 *   - Mezcla ambos al inicio del archivo (overlay)
 *   - Trunca el archivo a (N - X) seg
 *
 * Resultado: el final del clip ES la transición al inicio. Cuando loopea,
 * el oyente escucha continuidad porque el último frame del clip equivale al
 * primer frame del próximo loop.
 *
 * Requiere durationSec > 2 * crossfadeSec.
 */
async function applySeamlessLoopCrossfade(
  inputBuffer: Buffer,
  durationSec: number,
  crossfadeSec: number,
): Promise<Buffer> {
  if (durationSec <= 2 * crossfadeSec) {
    functions.logger.warn(
      '[generateAmbientSound] crossfade skipped: duration too short',
      { durationSec, crossfadeSec },
    );
    return inputBuffer;
  }

  const stamp = Date.now();
  const inputPath = path.join(os.tmpdir(), `ambient_in_${stamp}.mp3`);
  const outputPath = path.join(os.tmpdir(), `ambient_out_${stamp}.mp3`);

  try {
    fs.writeFileSync(inputPath, inputBuffer);

    const N = durationSec;
    const X = crossfadeSec;
    const trimEnd = N - X;

    // Filtro: mezcla [primeros X con fade-in] + [últimos X con fade-out, repos.
    // al inicio] y rellena con padding para que dure N-X. Después amix con la
    // pista principal (que tiene fade-in en sus primeros X) y truncamos a N-X.
    const filter =
      `[0:a]asplit=2[full][copy];` +
      `[full]atrim=0:${trimEnd},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${X}[main];` +
      `[copy]atrim=${trimEnd}:${N},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${X},apad=whole_dur=${trimEnd}[overlay];` +
      `[main][overlay]amix=inputs=2:duration=first:normalize=0[out]`;

    await runFfmpeg([
      '-i', inputPath,
      '-filter_complex', filter,
      '-map', '[out]',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-y',
      outputPath,
    ]);

    return fs.readFileSync(outputPath);
  } finally {
    for (const p of [inputPath, outputPath]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  }
}

// ─── Cloud Function ──────────────────────────────────────────────────────────

/**
 * Genera un sonido ambiental usando ElevenLabs Sound Effects API.
 * Los sonidos se guardan como archivos compartidos (no por usuario) en
 * `ambient-sounds/{soundId}.mp3` para que cualquier usuario los pueda usar.
 *
 * Cache: si el archivo ya existe en Storage, retorna directamente sin regenerar.
 */
export const generateAmbientSound = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data: GenerateRequest, context): Promise<GenerateResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    const userId = context.auth.uid;

    const promptRaw = (data.prompt ?? '').trim();
    if (!promptRaw) {
      throw new functions.https.HttpsError('invalid-argument', 'prompt es requerido');
    }
    if (promptRaw.length > PROMPT_MAX) {
      throw new functions.https.HttpsError('invalid-argument', `prompt supera ${PROMPT_MAX} caracteres`);
    }

    // Distinguir flujo: catálogo (tiene soundId) vs comunidad (tiene title)
    const isCommunity = !data.soundId;

    let soundId: string;
    let title: string | undefined;

    if (isCommunity) {
      // ── Validaciones específicas comunidad ───────────────────────────────────
      title = (data.title ?? '').trim();
      if (!title) {
        throw new functions.https.HttpsError('invalid-argument', 'title es requerido para sonidos comunitarios');
      }
      if (title.length > TITLE_MAX) {
        throw new functions.https.HttpsError('invalid-argument', `title supera ${TITLE_MAX} caracteres`);
      }
      if (!isPromptAllowed(title) || !isPromptAllowed(promptRaw)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'El contenido no cumple las normas de la comunidad. Intenta con otra descripción.',
        );
      }
      // Rate limit
      const dateKey = getLocalDateKey();
      const usageRef = db.collection('users').doc(userId).collection('usage').doc(`ambient_${dateKey}`);
      await db.runTransaction(async tx => {
        const snap = await tx.get(usageRef);
        const count = (snap.exists ? (snap.data()?.count as number) : 0) ?? 0;
        if (count >= COMMUNITY_RATE_LIMIT_PER_DAY) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            `Llegaste al límite de ${COMMUNITY_RATE_LIMIT_PER_DAY} sonidos por día. Vuelve mañana.`,
          );
        }
        tx.set(
          usageRef,
          {
            count: admin.firestore.FieldValue.increment(1),
            lastAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      // ID generado del título + random
      soundId = `community-${slugify(title)}-${shortRandomId()}`;
    } else {
      soundId = data.soundId!;
    }

    const durationSeconds = data.durationSeconds ?? 22;
    const seamlessLoop = data.seamlessLoop ?? true;
    const crossfadeSeconds = data.crossfadeSeconds ?? 2;
    const storagePath = `ambient-sounds/${soundId}.mp3`;

    const finalDurationSeconds = seamlessLoop
      ? Math.max(durationSeconds - crossfadeSeconds, 1)
      : durationSeconds;

    // ── Cache hit? (solo para sonidos del catálogo; comunitarios siempre nuevos) ─
    if (!isCommunity) {
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (exists) {
        functions.logger.info('[generateAmbientSound] cache hit', { soundId, storagePath });
        const [meta] = await file.getMetadata();
        const cachedSeamless = meta.metadata?.seamlessLoop === 'true';
        const cachedDuration = Number(meta.metadata?.finalDurationSeconds ?? durationSeconds);
        return {
          soundId,
          storagePath,
          cached: true,
          durationSeconds: Number.isFinite(cachedDuration) ? cachedDuration : durationSeconds,
          seamlessLoop: cachedSeamless,
          isCommunity: false,
        };
      }
    }

    // ── Generar con ElevenLabs ────────────────────────────────────────────────
    const apiKey = functions.config().elevenlabs?.key ?? process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'ELEVENLABS_API_KEY no configurada');
    }

    const elPrompt = seamlessLoop ? `${promptRaw}${SEAMLESS_LOOP_HINT}` : promptRaw;

    functions.logger.info('[generateAmbientSound] generating', {
      soundId,
      isCommunity,
      durationSeconds,
      seamlessLoop,
    });

    const url = 'https://api.elevenlabs.io/v1/sound-generation';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: elPrompt,
        duration_seconds: durationSeconds,
        prompt_influence: 0.3,
        output_format: 'mp3_44100_128',
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new functions.https.HttpsError(
        'internal',
        `ElevenLabs Sound Effects error ${resp.status}: ${errBody.slice(0, 300)}`,
      );
    }

    let audioBuffer: Buffer = Buffer.from(await resp.arrayBuffer());

    // ── Post-procesamiento: crossfade interno para loop sin click ────────────
    if (seamlessLoop) {
      try {
        audioBuffer = await applySeamlessLoopCrossfade(audioBuffer, durationSeconds, crossfadeSeconds);
        functions.logger.info('[generateAmbientSound] crossfade applied', {
          soundId,
          crossfadeSeconds,
          newSizeBytes: audioBuffer.length,
        });
      } catch (err) {
        functions.logger.error('[generateAmbientSound] crossfade failed, saving raw audio', {
          soundId,
          err: String(err),
        });
      }
    }

    // ── Subir a Storage ──────────────────────────────────────────────────────
    const file = bucket.file(storagePath);
    await file.save(audioBuffer, {
      contentType: 'audio/mpeg',
      metadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          generatedBy: 'elevenlabs-sound-effects',
          prompt: promptRaw,
          soundId,
          generatedAt: new Date().toISOString(),
          seamlessLoop: String(seamlessLoop),
          crossfadeSeconds: String(crossfadeSeconds),
          finalDurationSeconds: String(finalDurationSeconds),
          isCommunity: String(isCommunity),
          ...(isCommunity ? { creatorUid: userId } : {}),
        },
      },
    });
    await file.makePublic();

    // ── Si comunidad: registrar en Firestore ─────────────────────────────────
    if (isCommunity) {
      const nickname = await getCreatorNickname(userId);
      await db.collection('ambient_sounds').doc(soundId).set({
        soundId,
        title,
        prompt: promptRaw,
        creatorUid: userId,
        creatorNickname: nickname,
        durationSec: finalDurationSeconds,
        storagePath,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active',
        playsCount: 0,
        reportCount: 0,
      });
      functions.logger.info('[generateAmbientSound] community doc created', {
        soundId,
        creatorUid: userId,
      });
    }

    return {
      soundId,
      storagePath,
      cached: false,
      durationSeconds: finalDurationSeconds,
      seamlessLoop,
      isCommunity,
    };
  });

// ─── reportAmbientSound: usuarios reportan, ≥2 reports → flagged ──────────────

export const reportAmbientSound = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data: { soundId: string; reason?: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    const userId = context.auth.uid;
    const { soundId, reason } = data;
    if (!soundId) {
      throw new functions.https.HttpsError('invalid-argument', 'soundId requerido');
    }

    const soundRef = db.collection('ambient_sounds').doc(soundId);
    const reportRef = soundRef.collection('reports').doc(userId);

    await db.runTransaction(async tx => {
      const reportSnap = await tx.get(reportRef);
      if (reportSnap.exists) {
        // Ya reportado por este usuario, no doblar
        return;
      }
      tx.set(reportRef, {
        reporterUid: userId,
        reason: reason ?? '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(soundRef, {
        reportCount: admin.firestore.FieldValue.increment(1),
      });
    });

    // Auto-flag si ≥2 reports
    const updated = await soundRef.get();
    const reportCount = (updated.data()?.reportCount as number) ?? 0;
    if (reportCount >= 2 && updated.data()?.status === 'active') {
      await soundRef.update({ status: 'flagged' });
      functions.logger.info('[reportAmbientSound] auto-flagged', { soundId, reportCount });
    }
    return { success: true, reportCount };
  });

// ─── moderateAmbientSound: solo admins, cambia status ────────────────────────

export const moderateAmbientSound = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data: { soundId: string; action: 'approve' | 'remove' }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }
    const userId = context.auth.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Solo admins');
    }
    const { soundId, action } = data;
    const newStatus = action === 'approve' ? 'active' : 'removed';
    await db.collection('ambient_sounds').doc(soundId).update({ status: newStatus });
    return { success: true, newStatus };
  });
