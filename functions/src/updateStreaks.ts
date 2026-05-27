import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserStreaks {
  morningCurrent: number;
  morningLongest: number;
  nightCurrent: number;
  nightLongest: number;
  lastMorningDate: string;
  lastNightDate: string;
  combinedCurrent: number;
  morningStreakFreezeAvailable?: boolean;
  nightStreakFreezeAvailable?: boolean;
  lastFreezeResetWeek?: string;
}

interface UserProfile {
  totalDreams: number;
  totalNightCheckins: number;
  totalAnsweredQuestions?: number;
  clarityIndex?: number;
  currentLevel?: string;
}

interface UserDoc {
  streaks: UserStreaks;
  profile: UserProfile;
  timezone: string;
  fcmTokens?: string[];
  displayName: string;
  accountStatus: string;
  lastEngagementNotificationDate?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Current date in a given IANA timezone as "YYYY-MM-DD".
 */
function getTodayInZone(tz: string): string {
  try {
    // en-CA locale produces YYYY-MM-DD naturally
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * ISO week string, e.g. "2026-W15".
 */
function isoWeekString(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Shift to nearest Thursday to find the ISO week
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Integer days between two "YYYY-MM-DD" strings (b - a).
 * Returns null if either string is empty.
 */
function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const msPerDay = 86400000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

/**
 * Compute the composite clarity index (0-100).
 */
function computeClarityIndex(
  morningCurrent: number,
  nightCurrent: number,
  totalDreams: number,
  totalAnsweredQ: number,
): number {
  const morning = Math.min(morningCurrent / 30, 1) * 40;
  const night = Math.min(nightCurrent / 30, 1) * 30;
  const dreams = Math.min(totalDreams / 50, 1) * 20;
  const maxAnswered = Math.max(totalDreams * 3, 1);
  const quality = Math.min(totalAnsweredQ / maxAnswered, 1) * 10;
  return Math.round(morning + night + dreams + quality);
}

export const LEVEL_LABELS: Record<string, string> = {
  novato: 'Soñador Novato',
  explorador: 'Explorador Onírico',
  arquitecto: 'Arquitecto Mental',
  oneironaut: 'Oneironaut',
};

export const LEVEL_MESSAGES: Record<string, string> = {
  explorador: '¡Desbloqueaste el Dream Map! Los patrones de tu mente son visibles. 🗺️',
  arquitecto: '¡Perfil arquetípico completo desbloqueado! Tu psique tiene forma. 🏛️',
  oneironaut: '¡Retrato del Inconsciente desbloqueado! Eres un maestro del sueño lúcido. 🌌',
};

// ─── Streak update logic (shared) ─────────────────────────────────────────────

interface StreakUpdateInput {
  current: number;
  longest: number;
  lastDate: string;
  freezeAvailable: boolean;
  lastFreezeResetWeek: string;
  today: string;
}

interface StreakUpdateOutput {
  current: number;
  longest: number;
  lastDate: string;
  freezeAvailable: boolean;
  lastFreezeResetWeek: string;
  streakReset: boolean;      // true if streak was broken (no freeze saved it)
  freezeUsed: boolean;
}

function processStreak(input: StreakUpdateInput): StreakUpdateOutput {
  let { current, longest, lastDate, freezeAvailable } = input;
  const currentWeek = isoWeekString(new Date());
  let { lastFreezeResetWeek } = input;
  let streakReset = false;
  let freezeUsed = false;

  // Regenerate freeze at start of new ISO week
  if (currentWeek !== lastFreezeResetWeek) {
    freezeAvailable = true;
    lastFreezeResetWeek = currentWeek;
  }

  const diff = daysBetween(lastDate, input.today);

  if (diff === null) {
    // First ever activity
    current = 1;
  } else if (diff === 0) {
    // Already recorded today — no change
  } else if (diff === 1) {
    // Consecutive day
    current += 1;
  } else if (diff === 2 && freezeAvailable) {
    // Missed exactly one day — consume freeze
    current += 1;
    freezeAvailable = false;
    freezeUsed = true;
  } else {
    // Streak broken
    current = 1;
    streakReset = true;
  }

  if (current > longest) {
    longest = current;
  }

  return {
    current,
    longest,
    lastDate: diff === 0 ? lastDate : input.today, // don't overwrite if already today
    freezeAvailable,
    lastFreezeResetWeek,
    streakReset,
    freezeUsed,
  };
}

// ─── FCM helpers ──────────────────────────────────────────────────────────────

export async function sendFCM(
  messaging: admin.messaging.Messaging,
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  if (tokens.length === 0) return;
  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: { channelId: 'engagement', color: '#6C63FF' },
    },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  };
  await messaging.sendEachForMulticast(message).catch(err => {
    functions.logger.error('FCM send error', { error: err });
  });
}

// ─── onDreamCreated — updates morning streak ──────────────────────────────────

export const onDreamCreated = functions
  .region('us-central1')
  .firestore.document('users/{userId}/dreams/{dreamId}')
  .onCreate(async (_snap, context) => {
    const { userId } = context.params;
    const db = admin.firestore();
    const messaging = admin.messaging();

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return null;

    const user = userSnap.data() as UserDoc;
    if (user.accountStatus !== 'active') return null;

    const tz = user.timezone || 'UTC';
    const today = getTodayInZone(tz);

    const s = user.streaks;
    const result = processStreak({
      current: s.morningCurrent ?? 0,
      longest: s.morningLongest ?? 0,
      lastDate: s.lastMorningDate ?? '',
      freezeAvailable: s.morningStreakFreezeAvailable ?? true,
      lastFreezeResetWeek: s.lastFreezeResetWeek ?? '',
      today,
    });

    // Skip if already recorded today (diff was 0 — result.lastDate unchanged)
    if (result.lastDate === s.lastMorningDate && s.lastMorningDate === today) {
      return null;
    }

    // NOTE: `profile.totalDreams`, `profile.currentLevel` and the level-up FCM
    // are intentionally NOT updated here. They are owned by `analyzeDream`,
    // which fires when the dream actually reaches `status: 'complete'`.
    // This keeps the counter aligned with the journal query, which filters by
    // `status == 'complete'`.
    const totalDreams = user.profile?.totalDreams ?? 0;
    const totalAnsweredQ = user.profile?.totalAnsweredQuestions ?? 0;
    const nightCurrent = s.nightCurrent ?? 0;

    const clarityIndex = computeClarityIndex(
      result.current,
      nightCurrent,
      totalDreams,
      totalAnsweredQ,
    );

    await userRef.update({
      'streaks.morningCurrent': result.current,
      'streaks.morningLongest': result.longest,
      'streaks.lastMorningDate': result.lastDate,
      'streaks.morningStreakFreezeAvailable': result.freezeAvailable,
      'streaks.lastFreezeResetWeek': result.lastFreezeResetWeek,
      'profile.clarityIndex': clarityIndex,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Morning streak updated', {
      userId,
      streak: result.current,
      streakReset: result.streakReset,
    });

    const tokens = user.fcmTokens ?? [];

    // Streak-reset empathy notification
    if (result.streakReset && tokens.length > 0) {
      await sendFCM(
        messaging,
        tokens,
        'Remia 💜',
        'Tu cerebro también necesita descanso. Mañana seguimos.',
        { type: 'streak_reset' },
      );
    }

    return null;
  });

// ─── onNightCheckinCreated — updates night streak ─────────────────────────────

export const onNightCheckinCreated = functions
  .region('us-central1')
  .firestore.document('users/{userId}/nightCheckins/{checkinId}')
  .onCreate(async (_snap, context) => {
    const { userId } = context.params;
    const db = admin.firestore();

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return null;

    const user = userSnap.data() as UserDoc;
    if (user.accountStatus !== 'active') return null;

    const tz = user.timezone || 'UTC';
    const today = getTodayInZone(tz);

    const s = user.streaks;
    const result = processStreak({
      current: s.nightCurrent ?? 0,
      longest: s.nightLongest ?? 0,
      lastDate: s.lastNightDate ?? '',
      freezeAvailable: s.nightStreakFreezeAvailable ?? true,
      lastFreezeResetWeek: s.lastFreezeResetWeek ?? '',
      today,
    });

    // Skip if already recorded today
    if (result.lastDate === s.lastNightDate && s.lastNightDate === today) {
      return null;
    }

    const totalDreams = user.profile?.totalDreams ?? 0;
    const totalAnsweredQ = user.profile?.totalAnsweredQuestions ?? 0;
    const morningCurrent = s.morningCurrent ?? 0;
    const prevTotalNightCheckins = user.profile?.totalNightCheckins ?? 0;

    const clarityIndex = computeClarityIndex(
      morningCurrent,
      result.current,
      totalDreams,
      totalAnsweredQ,
    );

    await userRef.update({
      'streaks.nightCurrent': result.current,
      'streaks.nightLongest': result.longest,
      'streaks.lastNightDate': result.lastDate,
      'streaks.nightStreakFreezeAvailable': result.freezeAvailable,
      'streaks.lastFreezeResetWeek': result.lastFreezeResetWeek,
      'profile.totalNightCheckins': prevTotalNightCheckins + 1,
      'profile.clarityIndex': clarityIndex,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    functions.logger.info('Night streak updated', {
      userId,
      streak: result.current,
      streakReset: result.streakReset,
    });

    return null;
  });
