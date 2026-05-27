import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortraitSections {
  emotional_pattern: string;
  dominant_archetypes: string;
  active_conflicts: string;
  defense_mechanisms: string;
  psychic_progress: string;
  long_term_recommendations: string;
}

interface PortraitResult {
  sections: PortraitSections;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Gemini response');
  return JSON.parse(match[0]);
}

function buildPortraitPrompt(dreamSummaries: string, totalDreams: number): string {
  return `Eres un psicoanalista clínico experto en la integración de las teorías de Freud y Jung.
Has analizado ${totalDreams} sueños del mismo usuario a lo largo del tiempo.

Tu tarea: generar un RETRATO DEL INCONSCIENTE — un informe comprehensivo, empático y riguroso
que sintetiza los patrones psíquicos del usuario basándote ÚNICAMENTE en la evidencia de sus sueños.

Responde EXCLUSIVAMENTE con este objeto JSON (sin texto adicional, sin markdown):
{
  "sections": {
    "emotional_pattern": string (3-4 párrafos: patrón emocional recurrente, evolución temporal, intensidades dominantes),
    "dominant_archetypes": string (3-4 párrafos: los 3 arquetipos más presentes, sus dinámicas, conflictos entre ellos),
    "active_conflicts": string (3-4 párrafos: conflictos subconscientes activos, tensiones no resueltas, temas recurrentes),
    "defense_mechanisms": string (2-3 párrafos: mecanismos de defensa habituales identificados en los sueños),
    "psychic_progress": string (2-3 párrafos: evolución observada en los últimos sueños, señales de integración o regresión),
    "long_term_recommendations": string (3-4 párrafos: acciones concretas de largo plazo basadas en los patrones detectados, ejercicios de Pantalla Mental específicos, áreas de trabajo psíquico prioritarias)
  }
}

Historial de sueños (ID | fecha | emoción | arquetipos activos | símbolos | mensaje subconsciente | compensación):
${dreamSummaries}`;
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

/**
 * HTTP Callable — generates the Portrait of the Unconscious.
 * Client calls this when the user has 50+ dreams and taps "Generar Retrato".
 */
export const generatePortrait = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 300, memory: '1GB' })
  .https.onCall(async (_data, context) => {
    // Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = context.auth.uid;
    const db = admin.firestore();

    // ── 1. Check dream count ──────────────────────────────────────────────────

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'User document not found');
    }

    const totalDreams: number = userSnap.data()?.profile?.totalDreams ?? 0;
    const MIN_DREAMS = 50;

    if (totalDreams < MIN_DREAMS) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Need ${MIN_DREAMS} dreams. Currently have ${totalDreams}.`,
      );
    }

    // ── 2. Check if portrait is recent enough (skip regen if < 10 new dreams) ─

    const portraitRef = db
      .collection('users')
      .doc(userId)
      .collection('insights')
      .doc('portrait');

    const existingPortrait = await portraitRef.get();
    if (existingPortrait.exists) {
      const existing = existingPortrait.data()!;
      if (totalDreams < (existing.dreamsAnalyzed ?? 0) + 10) {
        // Return existing portrait — still fresh enough
        return { portrait: existing };
      }
    }

    // ── 3. Fetch all complete dreams ──────────────────────────────────────────

    const dreamsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('dreams')
      .where('status', '==', 'complete')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    if (dreamsSnap.empty) {
      throw new functions.https.HttpsError('not-found', 'No complete dreams found');
    }

    // ── 4. Build summaries ────────────────────────────────────────────────────

    const dreamSummaries = dreamsSnap.docs
      .map(d => {
        const data = d.data();
        const an = data.analysis ?? {};
        const archetypes = (an.active_archetypes ?? [])
          .slice(0, 3)
          .map((a: { name: string }) => a.name)
          .join(', ');
        const symbols = (an.symbols ?? [])
          .slice(0, 5)
          .map((s: { symbol: string }) => s.symbol)
          .join(', ');
        return [
          d.id,
          data.date ?? 'desconocida',
          an.dominant_emotion ?? 'desconocida',
          archetypes || 'ninguno',
          symbols || 'ninguno',
          an.subconscious_message ?? '',
          an.compensation_analysis ?? '',
        ].join(' | ');
      })
      .join('\n');

    // ── 5. Generate with Gemini ───────────────────────────────────────────────

    const apiKey = functions.config().gemini?.key ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError('internal', 'API key not configured');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    let portrait: PortraitResult;

    try {
      const response = await model.generateContent(
        buildPortraitPrompt(dreamSummaries, totalDreams),
      );
      const parsed = extractJson(response.response.text()) as PortraitResult;
      if (!parsed.sections || typeof parsed.sections !== 'object') {
        throw new Error('Invalid portrait structure');
      }
      portrait = parsed;
    } catch (err) {
      functions.logger.error('[portrait] Gemini generation failed', { err, userId });
      throw new functions.https.HttpsError('internal', 'Portrait generation failed');
    }

    // ── 6. Store portrait ─────────────────────────────────────────────────────

    const portraitDoc = {
      sections: portrait.sections,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      dreamsAnalyzed: totalDreams,
    };

    await portraitRef.set(portraitDoc);

    functions.logger.info('[portrait] Generated successfully', { userId, totalDreams });

    return { portrait: portraitDoc };
  });
