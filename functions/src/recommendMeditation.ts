import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Otras Cloud Functions ya inicializan admin (transcribeAudio lo hace primero).
// Guard para soportar arrancar standalone en emulador / tests.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RecommendInput {
  /** Si se pasa, intenta inferir categoría del análisis del sueño. */
  dreamId?: string;
  /** Mood libre del usuario en este momento ("ansioso", "agradecido"...). */
  mood?: string;
  /** Override directo de categoría. Gana sobre dreamId y mood. */
  category?: string;
  /** Cantidad solicitada (1-10, default 3). */
  limit?: number;
}

interface YoutubeMeditation {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryLabel: string;
  mood_tags: string[];
  duration_min: number;
  youtube_id: string;
  verified_no_ads: boolean;
  language: string;
  creator: string;
  embed_allowed: boolean;
  unavailable: boolean;
  last_validated_at: admin.firestore.Timestamp | null;
}

// ─── Mapeo emoción → categoría ────────────────────────────────────────────────
//
// La lógica es: si el sueño dejó al usuario en cierto estado emocional, qué
// tipo de meditación lo equilibra. No es una traducción literal; es un mapeo
// "compensatorio" — para ansiedad recomendamos calma, no más ansiedad.

const VALID_CATEGORIES = ['sleep', 'recall', 'lucid', 'anxiety', 'gratitude', 'focus'];

const EMOTION_TO_CATEGORY: Record<string, string> = {
  ansiedad: 'anxiety',
  miedo: 'anxiety',
  panico: 'anxiety',
  angustia: 'anxiety',
  rabia: 'anxiety',
  ira: 'anxiety',
  frustracion: 'anxiety',
  tristeza: 'gratitude',
  soledad: 'gratitude',
  pena: 'gratitude',
  culpa: 'gratitude',
  alegria: 'gratitude',
  esperanza: 'gratitude',
  amor: 'gratitude',
  confusion: 'focus',
  curiosidad: 'focus',
  asombro: 'lucid',
  sorpresa: 'lucid',
  calma: 'sleep',
  alivio: 'sleep',
};

function categoryFromEmotion(emotion: string | undefined): string {
  if (!emotion) return 'recall';
  const normalized = emotion
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return EMOTION_TO_CATEGORY[normalized] ?? 'recall';
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const recommendMeditation = functions
  .region('us-central1')
  .https.onCall(async (data: RecommendInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Necesitas iniciar sesión para pedir recomendaciones.',
      );
    }

    const uid = context.auth.uid;
    const wantCount = Math.max(1, Math.min(data.limit ?? 3, 10));

    // Resolver categoría por prioridad: category explícita > dreamId > mood
    let category = 'recall';
    let reason = 'Recomendaciones generales para recordar tus sueños.';

    if (data.category && VALID_CATEGORIES.includes(data.category)) {
      category = data.category;
      reason = `Sugerido por la categoría que elegiste: ${category}.`;
    } else if (data.dreamId) {
      try {
        const dreamSnap = await db
          .collection('users')
          .doc(uid)
          .collection('dreams')
          .doc(data.dreamId)
          .get();
        const dreamData = dreamSnap.data();
        const emotion = dreamData?.analysis?.dominant_emotion as
          | string
          | undefined;
        category = categoryFromEmotion(emotion);
        reason = emotion
          ? `Sugerido por la emoción dominante de tu sueño: ${emotion}.`
          : 'Tu sueño aún se está procesando — sugerencias por defecto.';
      } catch (err) {
        functions.logger.warn(
          '[recommendMeditation] dream lookup failed, using defaults',
          { err, dreamId: data.dreamId, uid },
        );
      }
    } else if (data.mood) {
      category = categoryFromEmotion(data.mood);
      reason = `Sugerido para acompañar tu mood: ${data.mood}.`;
    }

    // Query Firestore catalog
    try {
      const snap = await db
        .collection('meditations')
        .where('category', '==', category)
        .where('unavailable', '==', false)
        .orderBy('duration_min', 'asc')
        .limit(wantCount)
        .get();

      const meditations: YoutubeMeditation[] = snap.docs.map((d) => {
        const md = d.data() as YoutubeMeditation;
        return { ...md, id: md.id ?? d.id };
      });

      return { meditations, reason };
    } catch (err: any) {
      functions.logger.error('[recommendMeditation] query failed', {
        err,
        category,
        uid,
      });
      throw new functions.https.HttpsError(
        'internal',
        `No se pudo consultar el catálogo: ${err.message}`,
      );
    }
  });
