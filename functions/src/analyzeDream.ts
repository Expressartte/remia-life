import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerativeModel,
} from '@google/generative-ai';
import { computeClarityIndex, levelForDreams } from './streakUtils';
import { LEVEL_LABELS, LEVEL_MESSAGES, sendFCM } from './updateStreaks';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface EmotionPhase {
  phase: string;
  emotion: string;
  intensity: number;
}

interface Archetype {
  name: string;
  description: string;
  relevance: number;
}

interface FreudianDefense {
  mechanism: string;
  evidence: string;
}

interface Symbol {
  symbol: string;
  freudian_interpretation: string;
  jungian_interpretation: string;
  personal_interpretation: string;
}

interface DreamAnalysis {
  dream_title?: string;
  emotional_intensity: number;
  dominant_emotion: string;
  emotion_progression: EmotionPhase[];
  active_archetypes: Archetype[];
  freudian_defenses: FreudianDefense[];
  symbols: Symbol[];
  compensation_analysis: string;
  subconscious_message: string;
  mental_screen_recommendation: string;
  confidence_level: number;
}

interface SocraticEntry {
  id: number;
  question: string;
  answer: string | null;
}

interface NightCheckin {
  stressLevel?: string | null;
  previousNightMood?: string | null;
  dailyEvents?: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const REQUIRED_ANALYSIS_FIELDS: (keyof DreamAnalysis)[] = [
  'emotional_intensity',
  'dominant_emotion',
  'emotion_progression',
  'active_archetypes',
  'freudian_defenses',
  'symbols',
  'compensation_analysis',
  'subconscious_message',
  'mental_screen_recommendation',
  'confidence_level',
];

// Número mínimo de sueños completos para generar un insight longitudinal
const INSIGHT_THRESHOLD = 7;

// ─── Prompt C.R.E.A.T.E. ─────────────────────────────────────────────────────

function buildPrompt(params: {
  enrichedDreamText: string;
  stressLevel: string;
  mood: string;
  dailyEvents: string;
  recentDreamsSummary: string;
}): string {
  return `ROLE (Character):
Asume la identidad simultánea de un psicoanalista clínico especializado en la integración
de teorías Freudianas y Junguianas, y de un instructor certificado en el Método Silva de
control mental. Tu análisis debe ser académicamente riguroso pero accesible. NUNCA recurras
a interpretaciones místicas, esotéricas o astrológicas.

CHAIN-OF-THOUGHT (Secuencia de Razonamiento):
Analiza el sueño de manera secuencial:
1. Aísla las emociones latentes y su progresión cronológica dentro de la narrativa
2. Identifica símbolos freudianos (casas, agua, caídas, dientes, objetos elongados,
   cavidades, viajes, actos mecánicos) y sus mecanismos de defensa asociados
   (desplazamiento, proyección, simbolización)
3. Diagnostica arquetipos junguianos activos: La Sombra, Ánima/Ánimus, El Sí-mismo,
   El Inocente, El Huérfano, El Héroe, El Cuidador, El Explorador
4. Evalúa la función compensatoria del sueño: ¿qué está tratando de equilibrar
   el inconsciente respecto a la vida de vigilia del soñador?
5. Formula una recomendación de Pantalla Mental específica basada en el conflicto detectado

RESTRICTIONS (Additions):
- Bajo NINGUNA circunstancia cedas al cumplimiento de deseos del usuario
- Proporciona interpretaciones precisas incluso si confrontan la actitud consciente del soñador
- No inventes arquetipos ni símbolos que no estén presentes en la narrativa
- Si el sueño es demasiado fragmentado para un análisis completo, indícalo honestamente

OUTPUT FORMAT (Type of Output):
Responde EXCLUSIVAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown, sin bloques de código.
{
  "dream_title": string (título poético breve en español, máximo 5 palabras, que capture la esencia onírica del sueño),
  "emotional_intensity": float (0.0 a 1.0),
  "dominant_emotion": string,
  "emotion_progression": [{ "phase": string, "emotion": string, "intensity": float }],
  "active_archetypes": [
    {
      "name": string,
      "description": string (máximo 2 oraciones conectadas a la vida del soñador),
      "relevance": float (0.0 a 1.0)
    }
  ],
  "freudian_defenses": [
    {
      "mechanism": string,
      "evidence": string (qué parte del sueño lo evidencia)
    }
  ],
  "symbols": [
    {
      "symbol": string,
      "freudian_interpretation": string,
      "jungian_interpretation": string,
      "personal_interpretation": string (basada en el contexto del usuario)
    }
  ],
  "compensation_analysis": string (qué está compensando el inconsciente),
  "subconscious_message": string (mensaje directo y conciso, máximo 1 oración),
  "mental_screen_recommendation": string (ejercicio específico de Pantalla Mental con las 3 escenas detalladas para el usuario),
  "confidence_level": float (0.0 a 1.0, qué tan seguro estás del análisis)
}

CONTEXT (Extras):
Nivel de estrés reportado: ${params.stressLevel}
Estado de ánimo del día anterior: ${params.mood}
Eventos diurnos relevantes: ${params.dailyEvents}
Resúmenes de los últimos 5 sueños (para detectar patrones):
${params.recentDreamsSummary}

NARRATIVA DEL SUEÑO + RESPUESTAS SOCRÁTICAS:
${params.enrichedDreamText}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae y parsea el JSON de la respuesta de Gemini.
 * Tolerante a bloques ```json ... ``` y texto antes/después.
 */
function extractJson(raw: string): unknown {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No se encontró JSON en la respuesta de Gemini: ${raw.slice(0, 300)}`);
  }
  return JSON.parse(jsonMatch[0]);
}

/**
 * Valida que el objeto parseado tenga todos los campos requeridos
 * con los tipos básicos correctos.
 */
function validateAnalysis(obj: unknown): DreamAnalysis {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('La respuesta no es un objeto JSON.');
  }

  const analysis = obj as Record<string, unknown>;

  for (const field of REQUIRED_ANALYSIS_FIELDS) {
    if (!(field in analysis) || analysis[field] === null || analysis[field] === undefined) {
      throw new Error(`Campo requerido ausente: "${field}"`);
    }
  }

  // Validaciones numéricas
  for (const numField of ['emotional_intensity', 'confidence_level'] as const) {
    const val = analysis[numField];
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new Error(`Campo "${numField}" fuera de rango [0,1]: ${val}`);
    }
  }

  // Validaciones de arrays
  for (const arrField of [
    'emotion_progression',
    'active_archetypes',
    'freudian_defenses',
    'symbols',
  ] as const) {
    if (!Array.isArray(analysis[arrField])) {
      throw new Error(`Campo "${arrField}" debe ser un array.`);
    }
  }

  return analysis as unknown as DreamAnalysis;
}

/**
 * Llama a Gemini con reintento automático en caso de JSON inválido.
 */
async function callGeminiWithRetry(
  model: GenerativeModel,
  prompt: string
): Promise<DreamAnalysis> {
  // Intento 1
  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    return validateAnalysis(extractJson(raw));
  } catch (firstErr) {
    functions.logger.warn('[analyzeDream] Primer intento falló, reintentando con instrucción más estricta', {
      error: String(firstErr),
    });
  }

  // Intento 2: refuerza la restricción de JSON puro
  const strictPrompt =
    prompt +
    '\n\nIMPORTANTE: Tu respuesta anterior no fue JSON válido. ' +
    'Responde ÚNICAMENTE con el objeto JSON, sin ningún carácter adicional antes o después. ' +
    'Empieza directamente con "{" y termina con "}".';

  const result2 = await model.generateContent(strictPrompt);
  const raw2 = result2.response.text();
  return validateAnalysis(extractJson(raw2));
}

/**
 * Construye el texto enriquecido del sueño: transcripción + respuestas socráticas.
 */
function buildEnrichedText(
  transcriptionText: string,
  socraticDialog: SocraticEntry[]
): string {
  const answeredQuestions = socraticDialog.filter((q) => q.answer);

  if (answeredQuestions.length === 0) {
    return `RELATO DEL SUEÑO:\n${transcriptionText}`;
  }

  const qa = answeredQuestions
    .map((q) => `Pregunta: ${q.question}\nRespuesta: ${q.answer}`)
    .join('\n\n');

  return `RELATO DEL SUEÑO:\n${transcriptionText}\n\nPROFUNDIZACIÓN SOCRÁTICA:\n${qa}`;
}

/**
 * Obtiene el resumen de los últimos N sueños completados del usuario
 * (excluyendo el que se está analizando ahora).
 */
async function getRecentDreamsSummary(
  db: admin.firestore.Firestore,
  userId: string,
  currentDreamId: string,
  limit = 5
): Promise<string> {
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('dreams')
    .where('status', '==', 'complete')
    .orderBy('createdAt', 'desc')
    .limit(limit + 1) // +1 por si el actual ya está marcado como complete
    .get();

  const summaries = snap.docs
    .filter((d) => d.id !== currentDreamId)
    .slice(0, limit)
    .map((d, i) => {
      const data = d.data();
      const date: string = data.date ?? 'fecha desconocida';
      const msg: string = data.analysis?.subconscious_message ?? '';
      const emotion: string = data.analysis?.dominant_emotion ?? '';
      return `Sueño ${i + 1} (${date}): Emoción dominante: ${emotion || 'desconocida'}. ${msg}`;
    });

  return summaries.length > 0
    ? summaries.join('\n')
    : 'No hay sueños anteriores registrados.';
}

/**
 * Determina si se debe generar un insight longitudinal en función del nuevo
 * `totalDreams`. El umbral se lee del perfil del usuario para soportar
 * progresión dinámica. NO incrementa el contador — eso lo hace
 * `finalizeDreamCounter`, que corre antes en el mismo flujo de `analyzeDream`.
 */
async function evaluateInsightTrigger(
  db: admin.firestore.Firestore,
  userId: string,
  newTotalDreams: number
): Promise<boolean> {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) return false;

  const userData = userSnap.data()!;
  const nextInsightAt: number = userData.profile?.nextInsightAt ?? INSIGHT_THRESHOLD;

  if (newTotalDreams >= nextInsightAt) {
    const nextThreshold = nextInsightAt + Math.ceil(Math.sqrt(nextInsightAt));
    await userRef.update({
      'profile.nextInsightAt': nextThreshold,
    });
    return true;
  }

  return false;
}

/**
 * Incrementa `profile.totalDreams` y recalcula `currentLevel` + `clarityIndex`
 * cuando un sueño llega a `status: 'complete'`. Es la ÚNICA fuente de verdad
 * para esos campos — `onDreamCreated` solo gestiona streaks.
 *
 * Devuelve el nuevo total, el flag de level-up y los tokens FCM para que el
 * caller emita la notificación si corresponde.
 */
async function finalizeDreamCounter(
  db: admin.firestore.Firestore,
  userId: string
): Promise<{
  newTotalDreams: number;
  leveledUp: boolean;
  newLevel: string;
  fcmTokens: string[];
}> {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return { newTotalDreams: 0, leveledUp: false, newLevel: 'novato', fcmTokens: [] };
  }

  const userData = userSnap.data()!;
  const prevTotalDreams: number = userData.profile?.totalDreams ?? 0;
  const newTotalDreams = prevTotalDreams + 1;
  const totalAnsweredQ: number = userData.profile?.totalAnsweredQuestions ?? 0;
  const morningCurrent: number = userData.streaks?.morningCurrent ?? 0;
  const nightCurrent: number = userData.streaks?.nightCurrent ?? 0;

  const clarityIndex = computeClarityIndex(
    morningCurrent,
    nightCurrent,
    newTotalDreams,
    totalAnsweredQ,
  );

  const prevLevel = levelForDreams(prevTotalDreams);
  const newLevel = levelForDreams(newTotalDreams);
  const leveledUp = newLevel !== prevLevel;

  await userRef.update({
    'profile.totalDreams': newTotalDreams,
    'profile.clarityIndex': clarityIndex,
    'profile.currentLevel': newLevel,
    'profile.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    newTotalDreams,
    leveledUp,
    newLevel,
    fcmTokens: userData.fcmTokens ?? [],
  };
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const analyzeDream = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .firestore.document('users/{userId}/dreams/{dreamId}')
  .onUpdate(async (change, context) => {
    const { userId, dreamId } = context.params as { userId: string; dreamId: string };

    const newData = change.after.data();
    const oldData = change.before.data();

    // ── Condición de disparo: solo si el status cambió A "analyzing" ──────────

    if (newData.status !== 'analyzing' || oldData.status === 'analyzing') {
      return null;
    }

    functions.logger.info('[analyzeDream] Iniciando análisis onírico', { userId, dreamId });

    const db = admin.firestore();
    const dreamRef = change.after.ref;

    // ── 1. Extraer transcripción y diálogo socrático ───────────────────────────

    const transcriptionText: string = newData.transcription?.text ?? '';
    const socraticDialog: SocraticEntry[] = newData.socraticDialog ?? [];

    if (transcriptionText.trim().length < 10) {
      functions.logger.error('[analyzeDream] Transcripción vacía o muy corta', { userId, dreamId });
      await dreamRef.update({
        status: 'error',
        'error.code': 'EMPTY_TRANSCRIPTION',
        'error.message': 'La transcripción está vacía o es demasiado corta para analizar.',
        'error.occurredAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    }

    // ── 2. Leer contexto diurno (último nightCheckin) ─────────────────────────

    let nightCheckin: NightCheckin = {};
    try {
      const checkinSnap = await db
        .collection('users')
        .doc(userId)
        .collection('nightCheckins')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!checkinSnap.empty) {
        nightCheckin = checkinSnap.docs[0].data() as NightCheckin;
      }
    } catch (err) {
      functions.logger.warn('[analyzeDream] No se pudo leer nightCheckin, continuando sin contexto', {
        err,
        userId,
      });
    }

    // ── 3. Leer los últimos 5 sueños completados ──────────────────────────────

    let recentDreamsSummary = 'No hay sueños anteriores registrados.';
    try {
      recentDreamsSummary = await getRecentDreamsSummary(db, userId, dreamId);
    } catch (err) {
      functions.logger.warn('[analyzeDream] No se pudo leer historial de sueños, continuando', {
        err,
        userId,
      });
    }

    // ── 4. Construir el prompt C.R.E.A.T.E. ──────────────────────────────────

    const enrichedDreamText = buildEnrichedText(transcriptionText, socraticDialog);

    const prompt = buildPrompt({
      enrichedDreamText,
      stressLevel: nightCheckin.stressLevel ?? 'No reportado',
      mood: nightCheckin.previousNightMood ?? 'No reportado',
      dailyEvents: nightCheckin.dailyEvents ?? 'No reportado',
      recentDreamsSummary,
    });

    // ── 5. Llamar a Gemini con reintento ─────────────────────────────────────

    const apiKey = functions.config().gemini?.key ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      functions.logger.error('[analyzeDream] GEMINI_API_KEY no configurada');
      await dreamRef.update({
        status: 'error',
        'error.code': 'MISSING_API_KEY',
        'error.message': 'Configuración del servidor incompleta.',
        'error.occurredAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      generationConfig: {
        temperature: 0.4,       // baja temperatura para mayor coherencia analítica
        maxOutputTokens: 4096,
        responseMimeType: 'application/json', // Gemini 1.5 soporta JSON mode
      },
    });

    let analysis: DreamAnalysis;

    try {
      analysis = await callGeminiWithRetry(model, prompt);
      functions.logger.info('[analyzeDream] Análisis generado exitosamente', {
        userId,
        dreamId,
        dominantEmotion: analysis.dominant_emotion,
        archetypeCount: analysis.active_archetypes.length,
        symbolCount: analysis.symbols.length,
        confidence: analysis.confidence_level,
      });
    } catch (err) {
      functions.logger.error('[analyzeDream] Gemini falló en ambos intentos', { err, userId, dreamId });
      await dreamRef.update({
        status: 'error',
        'error.code': 'ANALYSIS_FAILED',
        'error.message': 'La IA no pudo generar un análisis válido. Por favor, inténtalo de nuevo.',
        'error.occurredAt': admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    }

    // ── 6. Guardar análisis y actualizar status a "complete" ──────────────────

    try {
      await dreamRef.update({
        analysis: {
          ...analysis,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          model: 'gemini-2.5-pro',
          promptVersion: '1.0',
        },
        dream_title: analysis.dream_title ?? '',
        enrichedText: enrichedDreamText,
        status: 'complete',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Limpiar error previo si existía
        error: admin.firestore.FieldValue.delete(),
      });

      functions.logger.info('[analyzeDream] Documento actualizado → complete', { userId, dreamId });
    } catch (err) {
      functions.logger.error('[analyzeDream] Error al guardar el análisis en Firestore', {
        err,
        userId,
        dreamId,
      });
      // Lanzar para que GCP reintente (el análisis ya fue generado, vale la pena reintentar la escritura)
      throw new Error(`Firestore write failed: ${err}`);
    }

    // ── 7. Actualizar perfil del usuario: emoción dominante y arquetipos ──────

    try {
      const topArchetype =
        analysis.active_archetypes.sort((a, b) => b.relevance - a.relevance)[0]?.name ?? '';

      await db
        .collection('users')
        .doc(userId)
        .update({
          'profile.dominantEmotionLast30': analysis.dominant_emotion,
          'profile.currentArchetype': topArchetype,
          // Acumula los símbolos del sueño en el campo de análisis longitudinal
          'profile.topSymbolsLast30': admin.firestore.FieldValue.arrayUnion(
            ...analysis.symbols.map((s) => s.symbol).slice(0, 5)
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
      // No crítico: el análisis ya está guardado
      functions.logger.warn('[analyzeDream] No se pudo actualizar el perfil del usuario', {
        err,
        userId,
      });
    }

    // ── 8. Incrementar contador, nivel y clarity index ────────────────────────
    // Se hace SOLO aquí (no en onDreamCreated) para que `profile.totalDreams`
    // refleje únicamente los sueños con status === 'complete', alineado con
    // la query del Journal.

    let newTotalDreams = 0;
    let leveledUp = false;
    let newLevel = 'novato';
    let fcmTokens: string[] = [];

    try {
      const result = await finalizeDreamCounter(db, userId);
      newTotalDreams = result.newTotalDreams;
      leveledUp = result.leveledUp;
      newLevel = result.newLevel;
      fcmTokens = result.fcmTokens;

      functions.logger.info('[analyzeDream] Contador y nivel actualizados', {
        userId,
        newTotalDreams,
        leveledUp,
        newLevel,
      });
    } catch (err) {
      functions.logger.error('[analyzeDream] Error al actualizar contador/nivel', {
        err,
        userId,
      });
      // No abortamos: el análisis ya está guardado y el contador puede
      // recuperarse por backfill. Seguimos para evaluar insight con el valor
      // que tenga el perfil ahora mismo.
    }

    // ── 9. Notificación de level-up ───────────────────────────────────────────

    if (leveledUp && fcmTokens.length > 0) {
      const msg = LEVEL_MESSAGES[newLevel];
      if (msg) {
        try {
          await sendFCM(
            admin.messaging(),
            fcmTokens,
            `Nuevo nivel: ${LEVEL_LABELS[newLevel]} 🎉`,
            msg,
            { type: 'level_up', level: newLevel },
          );
        } catch (err) {
          functions.logger.warn('[analyzeDream] No se pudo enviar FCM de level-up', {
            err,
            userId,
          });
        }
      }
    }

    // ── 10. Evaluar trigger de insight longitudinal ───────────────────────────

    try {
      const shouldGenerateInsight = await evaluateInsightTrigger(
        db,
        userId,
        newTotalDreams,
      );

      if (shouldGenerateInsight) {
        functions.logger.info('[analyzeDream] Umbral de insight alcanzado, encolando generación', {
          userId,
        });

        // Crear documento en la colección "insightJobs" para que otra función lo procese
        await db.collection('insightJobs').add({
          userId,
          triggeredByDreamId: dreamId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'pending',
        });
      }
    } catch (err) {
      functions.logger.warn('[analyzeDream] Error al evaluar insight trigger', { err, userId });
    }

    return null;
  });
