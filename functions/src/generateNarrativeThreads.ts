import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NarrativeThreadEvidence {
  dreamId: string;
  element: string;
}

interface NarrativeThread {
  title: string;
  description: string;
  evidence: NarrativeThreadEvidence[];
  jungian_compensation: string;
  recommendation: string;
}

interface NarrativeThreadsResult {
  narrative_threads: NarrativeThread[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]);
}

function buildPrompt(dreamSummaries: string): string {
  return `Analiza los siguientes resúmenes de sueños del mismo usuario ordenados cronológicamente.
Identifica HILOS NARRATIVOS — patrones recurrentes que sugieran que el subconsciente está procesando un tema persistente.
Solo incluye hilos con evidencia en al menos 2 sueños distintos.

Para cada hilo narrativo detectado, responde EXCLUSIVAMENTE con este objeto JSON (sin texto adicional):
{
  "narrative_threads": [
    {
      "title": string (nombre corto del hilo, máximo 5 palabras),
      "description": string (explicación de qué está procesando el subconsciente, 2-3 oraciones),
      "evidence": [{ "dreamId": string, "element": string (símbolo/emoción/arquetipo específico) }],
      "jungian_compensation": string (qué está intentando compensar la psique, 1 oración),
      "recommendation": string (acción concreta sugerida para la vida de vigilia, 1-2 oraciones)
    }
  ]
}

Sueños del usuario (formato: ID | fecha | emoción dominante | arquetipos | símbolos | mensaje subconsciente):
${dreamSummaries}`;
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

/**
 * Triggered when a new insightJob document is created.
 * Generates narrative threads if the user has 14+ analyzed dreams.
 */
export const generateNarrativeThreads = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .firestore.document('insightJobs/{jobId}')
  .onCreate(async (snap, _context) => {
    const jobData = snap.data();
    const userId: string = jobData?.userId;

    if (!userId) {
      functions.logger.error('[narrativeThreads] No userId in insightJob');
      await snap.ref.update({ status: 'failed', reason: 'no userId' });
      return null;
    }

    const db = admin.firestore();

    // ── 1. Check if user has enough dreams ───────────────────────────────────

    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      await snap.ref.update({ status: 'skipped', reason: 'user not found' });
      return null;
    }

    const totalDreams: number = userSnap.data()?.profile?.totalDreams ?? 0;
    const MIN_DREAMS_FOR_THREADS = 14;

    if (totalDreams < MIN_DREAMS_FOR_THREADS) {
      await snap.ref.update({
        status: 'skipped',
        reason: `only ${totalDreams} dreams, need ${MIN_DREAMS_FOR_THREADS}`,
      });
      return null;
    }

    // ── 2. Check if we already generated threads for this dream count ─────────

    const insightRef = db
      .collection('users')
      .doc(userId)
      .collection('insights')
      .doc('narrativeThreads');

    const existingSnap = await insightRef.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data()!;
      // Regenerate only if user has at least 3 more dreams than last generation
      if (totalDreams < (existing.dreamsAnalyzed ?? 0) + 3) {
        await snap.ref.update({ status: 'skipped', reason: 'not enough new dreams' });
        return null;
      }
    }

    // ── 3. Fetch last 30 complete dreams ─────────────────────────────────────

    const dreamsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('dreams')
      .where('status', '==', 'complete')
      .orderBy('createdAt', 'asc')
      .limit(30)
      .get();

    if (dreamsSnap.empty) {
      await snap.ref.update({ status: 'skipped', reason: 'no complete dreams found' });
      return null;
    }

    // ── 4. Build dream summaries for prompt ───────────────────────────────────

    const dreamSummaries = dreamsSnap.docs
      .map(d => {
        const data = d.data();
        const analysis = data.analysis ?? {};
        const archetypes = (analysis.active_archetypes ?? [])
          .slice(0, 3)
          .map((a: { name: string }) => a.name)
          .join(', ');
        const symbols = (analysis.symbols ?? [])
          .slice(0, 5)
          .map((s: { symbol: string }) => s.symbol)
          .join(', ');
        return [
          d.id,
          data.date ?? 'fecha desconocida',
          analysis.dominant_emotion ?? 'desconocida',
          archetypes || 'ninguno',
          symbols || 'ninguno',
          analysis.subconscious_message ?? '',
        ].join(' | ');
      })
      .join('\n');

    // ── 5. Call Gemini ────────────────────────────────────────────────────────

    const apiKey = functions.config().gemini?.key ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      functions.logger.error('[narrativeThreads] GEMINI_API_KEY not set');
      await snap.ref.update({ status: 'failed', reason: 'missing api key' });
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 3000,
        responseMimeType: 'application/json',
      },
    });

    let result: NarrativeThreadsResult;

    try {
      const response = await model.generateContent(buildPrompt(dreamSummaries));
      const parsed = extractJson(response.response.text()) as NarrativeThreadsResult;
      if (!Array.isArray(parsed.narrative_threads)) {
        throw new Error('Invalid response structure');
      }
      result = parsed;
    } catch (err) {
      functions.logger.error('[narrativeThreads] Gemini failed', { err, userId });
      await snap.ref.update({ status: 'failed', reason: String(err) });
      return null;
    }

    // ── 6. Store result ───────────────────────────────────────────────────────

    await insightRef.set({
      threads: result.narrative_threads,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      dreamsAnalyzed: totalDreams,
    });

    await snap.ref.update({ status: 'complete', generatedAt: admin.firestore.FieldValue.serverTimestamp() });

    functions.logger.info('[narrativeThreads] Generated successfully', {
      userId,
      threadCount: result.narrative_threads.length,
      dreamsAnalyzed: totalDreams,
    });

    return null;
  });
