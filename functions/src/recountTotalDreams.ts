import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { computeClarityIndex, levelForDreams } from './streakUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecountRequest {
  userId?: string;
  all?: boolean;
}

interface UserResult {
  userId: string;
  prevTotalDreams: number;
  newTotalDreams: number;
  newLevel: string;
  newClarityIndex: number;
}

interface RecountResponse {
  success: true;
  results: UserResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function recountForUser(
  db: admin.firestore.Firestore,
  userId: string,
): Promise<UserResult> {
  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', `User ${userId} not found`);
  }

  const userData = userSnap.data()!;
  const prevTotalDreams: number = userData.profile?.totalDreams ?? 0;

  // Aggregation count avoids paging through every dream doc.
  const completeCountSnap = await userRef
    .collection('dreams')
    .where('status', '==', 'complete')
    .count()
    .get();
  const newTotalDreams = completeCountSnap.data().count;

  const totalAnsweredQ: number = userData.profile?.totalAnsweredQuestions ?? 0;
  const morningCurrent: number = userData.streaks?.morningCurrent ?? 0;
  const nightCurrent: number = userData.streaks?.nightCurrent ?? 0;

  const newClarityIndex = computeClarityIndex(
    morningCurrent,
    nightCurrent,
    newTotalDreams,
    totalAnsweredQ,
  );
  const newLevel = levelForDreams(newTotalDreams);

  await userRef.update({
    'profile.totalDreams': newTotalDreams,
    'profile.currentLevel': newLevel,
    'profile.clarityIndex': newClarityIndex,
    'profile.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  functions.logger.info('[recountTotalDreams] User recounted', {
    userId,
    prevTotalDreams,
    newTotalDreams,
    newLevel,
    newClarityIndex,
  });

  return { userId, prevTotalDreams, newTotalDreams, newLevel, newClarityIndex };
}

// ─── Callable ─────────────────────────────────────────────────────────────────

/**
 * Recalcula `profile.totalDreams`, `profile.currentLevel` y `profile.clarityIndex`
 * a partir de la cuenta real de sueños con `status: 'complete'`.
 *
 * Reglas:
 * - Sin args → recalcula el usuario que invoca (cualquier autenticado).
 * - `userId` → solo admin, recalcula ese usuario.
 * - `all: true` → solo admin, recalcula TODOS los usuarios (uno por uno).
 *
 * Se diseñó como callable one-shot para corregir el desajuste histórico de
 * `totalDreams` que se incrementaba en `onDreamCreated`. Una vez backfilleado,
 * la única fuente de verdad es `analyzeDream` (paso `finalizeDreamCounter`).
 */
export const recountTotalDreams = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data: RecountRequest, context): Promise<RecountResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const callerUid = context.auth.uid;
    const db = admin.firestore();

    const wantsOtherUser = !!data?.userId && data.userId !== callerUid;
    const wantsAll = data?.all === true;

    if (wantsOtherUser || wantsAll) {
      const callerSnap = await db.collection('users').doc(callerUid).get();
      if (callerSnap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Solo admins pueden recalcular otros usuarios o el lote completo',
        );
      }
    }

    if (wantsAll) {
      const usersSnap = await db.collection('users').get();
      const results: UserResult[] = [];
      for (const doc of usersSnap.docs) {
        try {
          results.push(await recountForUser(db, doc.id));
        } catch (err) {
          functions.logger.warn('[recountTotalDreams] Skip user', { userId: doc.id, err });
        }
      }
      return { success: true, results };
    }

    const targetUid = data?.userId ?? callerUid;
    const result = await recountForUser(db, targetUid);
    return { success: true, results: [result] };
  });
