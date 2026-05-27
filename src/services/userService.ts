import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  DocumentReference,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { UserDocument } from '../types';

const userRef = (uid: string): DocumentReference =>
  doc(db, 'users', uid);

/**
 * Crea el documento de usuario en Firestore si no existe.
 * Si ya existe, actualiza lastActiveAt.
 * Se llama automáticamente en cada sign-in desde useAuth.
 */
export const syncUserDocument = async (user: User): Promise<void> => {
  const ref = userRef(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const newUser: UserDocument = {
      userId: user.uid,
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: 'es',
      onboardingCompleted: false,
      accountStatus: 'active',
      settings: {
        theme: 'dark',
        morningReminderEnabled: true,
        morningReminderTime: '07:00',
        nightReminderEnabled: true,
        nightReminderTime: '22:00',
        socraticQuestionsCount: 3,
        analysisDepth: 'standard',
      },
      streaks: {
        morningCurrent: 0,
        morningLongest: 0,
        nightCurrent: 0,
        nightLongest: 0,
        lastMorningDate: '',
        lastNightDate: '',
        combinedCurrent: 0,
        morningStreakFreezeAvailable: true,
        nightStreakFreezeAvailable: true,
        lastFreezeResetWeek: '',
      },
      profile: {
        totalDreams: 0,
        totalNightCheckins: 0,
        totalAnsweredQuestions: 0,
        stressLevel: 'moderate',
        currentArchetype: '',
        archetypeHistory: [],
        dominantEmotionLast30: '',
        topSymbolsLast30: [],
        insightMilestones: [],
        nextInsightAt: 7,
        clarityIndex: 0,
        currentLevel: 'novato',
      },
      fcmTokens: [],
      lastEngagementNotificationDate: '',
    };

    await setDoc(ref, newUser);
  } else {
    // Solo actualiza la marca de tiempo de actividad
    await setDoc(ref, { lastActiveAt: serverTimestamp() }, { merge: true });
  }
};

export const getUserDocument = async (
  uid: string
): Promise<UserDocument | null> => {
  const snapshot = await getDoc(userRef(uid));
  return snapshot.exists() ? (snapshot.data() as UserDocument) : null;
};
