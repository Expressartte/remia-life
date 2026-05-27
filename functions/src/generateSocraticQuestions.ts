import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SocraticQuestion {
  id: number;
  question: string;
  dimension: 'emotion' | 'figure' | 'symbol' | 'waking_connection' | 'somatic';
}

interface GeminiResponse {
  questions: SocraticQuestion[];
}

// ─── Prompt sistémico ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un psicoanalista clínico experto en teoría freudiana y junguiana. Tu rol es hacer
preguntas que ayuden al soñador a profundizar en su experiencia onírica.

REGLAS:
- Genera exactamente entre 3 y 5 preguntas
- Cada pregunta debe explorar una dimensión diferente: emociones sentidas, personas/figuras
  presentes, símbolos recurrentes, conexiones con la vida de vigilia, sensaciones corporales
- Las preguntas deben ser abiertas, nunca de sí/no
- Tono empático pero directo. No seas complaciente.
- Si el sueño contiene símbolos freudianos obvios (agua, casas, caídas, dientes),
  pregunta específicamente sobre la emoción asociada sin revelar la interpretación
- Responde SOLO en formato JSON válido, sin texto adicional antes ni después:
  {
    "questions": [
      { "id": 1, "question": "...", "dimension": "emotion|figure|symbol|waking_connection|somatic" }
    ]
  }`;

// ─── Helper: llama a Gemini y parsea la respuesta ─────────────────────────────

async function callGemini(dreamText: string): Promise<SocraticQuestion[]> {
  const apiKey = functions.config().gemini?.key ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
  });

  const prompt = `${SYSTEM_PROMPT}\n\nTRANSCRIPCIÓN DEL SUEÑO:\n${dreamText}`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();

  // Extraer JSON aunque venga envuelto en ```json ... ```
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Respuesta de Gemini no contiene JSON válido: ${rawText.slice(0, 200)}`);
  }

  const parsed: GeminiResponse = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.questions) || parsed.questions.length < 3) {
    throw new Error(`Gemini devolvió un número insuficiente de preguntas: ${parsed.questions?.length}`);
  }

  return parsed.questions.slice(0, 5); // máximo 5
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const generateSocraticQuestions = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data: { dreamId: string }, context) => {
    // ── Autenticación ────────────────────────────────────────────────────────

    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión para continuar.');
    }

    const userId = context.auth.uid;
    const { dreamId } = data;

    if (!dreamId || typeof dreamId !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Se requiere dreamId.');
    }

    functions.logger.info('[generateSocraticQuestions] Solicitando preguntas', { userId, dreamId });

    // ── Leer el documento del sueño ──────────────────────────────────────────

    const db = admin.firestore();
    const dreamRef = db.collection('users').doc(userId).collection('dreams').doc(dreamId);
    const snap = await dreamRef.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'El sueño no existe.');
    }

    const dream = snap.data()!;

    // Verificar que el sueño pertenece al usuario que llama
    if (dream.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'No tienes acceso a este sueño.');
    }

    // ── Idempotencia: devolver preguntas existentes si ya se generaron ───────

    if (
      Array.isArray(dream.socraticDialog) &&
      dream.socraticDialog.length > 0 &&
      dream.status !== 'awaiting_questions'
    ) {
      functions.logger.info('[generateSocraticQuestions] Preguntas ya existentes, devolviendo caché', {
        userId,
        dreamId,
        count: dream.socraticDialog.length,
      });
      return { questions: dream.socraticDialog };
    }

    // ── Verificar que hay transcripción disponible ────────────────────────────

    const transcriptionText: string | undefined = dream.transcription?.text;

    if (!transcriptionText || transcriptionText.trim().length < 20) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'La transcripción no está disponible aún. Inténtalo en unos momentos.'
      );
    }

    // ── Generar preguntas con Gemini ─────────────────────────────────────────

    let questions: SocraticQuestion[];

    try {
      questions = await callGemini(transcriptionText);
    } catch (err) {
      functions.logger.error('[generateSocraticQuestions] Error llamando a Gemini', { err, userId, dreamId });
      throw new functions.https.HttpsError(
        'internal',
        'No se pudieron generar las preguntas. Inténtalo de nuevo.'
      );
    }

    // ── Guardar en Firestore y actualizar status ──────────────────────────────

    // Las preguntas se guardan con answer/answeredAt vacíos para ser rellenados progresivamente
    const questionsWithAnswers = questions.map((q) => ({
      ...q,
      answer: null,
      answeredAt: null,
      answerType: null,
    }));

    try {
      await dreamRef.update({
        socraticDialog: questionsWithAnswers,
        status: 'answering_questions',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('[generateSocraticQuestions] Preguntas guardadas', {
        userId,
        dreamId,
        count: questions.length,
      });
    } catch (err) {
      functions.logger.error('[generateSocraticQuestions] Error al guardar en Firestore', { err, userId, dreamId });
      throw new functions.https.HttpsError('internal', 'Error al guardar las preguntas.');
    }

    return { questions: questionsWithAnswers };
  });
