import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserStreaks {
  morningCurrent: number;
  morningLongest: number;
  lastMorningDate: string;
}

interface UserDoc {
  streaks: UserStreaks;
  profile: { totalDreams: number };
  timezone: string;
  fcmTokens?: string[];
  displayName: string;
  accountStatus: string;
  settings: {
    morningReminderEnabled: boolean;
  };
  lastEngagementNotificationDate?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Current time as "HH:MM" in a given IANA timezone.
 */
function getCurrentTimeInZone(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const h = parts.find(p => p.type === 'hour')?.value ?? '00';
    const m = parts.find(p => p.type === 'minute')?.value ?? '00';
    return `${h === '24' ? '00' : h}:${m}`;
  } catch {
    return '00:00';
  }
}

/**
 * Current date in a given IANA timezone as "YYYY-MM-DD".
 */
function getTodayInZone(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Days between two "YYYY-MM-DD" strings (b − a).
 * Returns null if either is empty.
 */
function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/**
 * Round minute to nearest multiple of 5, return "HH:MM".
 */
function roundToFive(time: string): string {
  const [h, m] = time.split(':');
  const rounded = Math.floor(Number(m) / 5) * 5;
  return `${h}:${String(rounded).padStart(2, '0')}`;
}

// ─── FCM helper ───────────────────────────────────────────────────────────────

async function sendFCM(
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
      priority: 'normal',
      notification: { channelId: 'engagement', color: '#6C63FF' },
    },
    apns: { payload: { aps: { sound: 'default' } } },
  };
  await messaging.sendEachForMulticast(message).catch(err => {
    functions.logger.error('FCM engagement send error', { error: err });
  });
}

// ─── Notification composer ────────────────────────────────────────────────────

/**
 * Picks the right notification based on streak state.
 * Returns null if no notification should be sent.
 */
interface NotifPayload {
  title: string;
  body: string;
  type: string;
}

function buildNotification(
  streak: number,
  longest: number,
  daysSinceLastDream: number | null,
): NotifPayload | null {
  // 3+ days without recording (include first-time users with daysSinceLastDream === null)
  if (daysSinceLastDream === null || daysSinceLastDream >= 3) {
    return {
      title: 'Remia 🧠',
      body: 'Tu subconsciente tiene mensajes acumulados. ¿Retomamos?',
      type: 're_engage',
    };
  }

  // About to beat personal record: if user records today their streak will exceed longest
  // We send this when streak === longest (next recording breaks the record)
  if (streak > 0 && streak === longest && longest >= 3) {
    return {
      title: 'Remia 🔥',
      body: `Llevas ${streak} días seguidos. Tu récord es ${longest}. Mañana lo superas.`,
      type: 'streak_record_alert',
    };
  }

  // Standard morning prompt (didn't record today)
  return {
    title: 'Remia 🌅',
    body: '¿Soñaste algo anoche? Incluso fragmentos cuentan.',
    type: 'morning_prompt',
  };
}

// ─── Scheduled function ───────────────────────────────────────────────────────

/**
 * Runs every 5 minutes (UTC). For each active user with morning reminders enabled,
 * checks whether it's 10:00 in their local timezone and sends the right
 * engagement notification — deduplicated to once per day.
 */
export const sendEngagementNotifications = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 180, memory: '256MB' })
  .pubsub.schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    // Target window: 10:00 local time
    const TARGET_TIME = '10:00';

    // Fetch active users who have morning reminders on
    // (We reuse the morningReminderEnabled flag — it signals the user wants to be prompted)
    const snapshot = await db
      .collection('users')
      .where('settings.morningReminderEnabled', '==', true)
      .where('accountStatus', '==', 'active')
      .get();

    if (snapshot.empty) return null;

    const batch: Promise<void>[] = [];

    for (const docSnap of snapshot.docs) {
      const user = docSnap.data() as UserDoc;
      const { fcmTokens, timezone, streaks, displayName } = user;

      if (!fcmTokens || fcmTokens.length === 0) continue;

      const tz = timezone || 'UTC';
      const localNow = getCurrentTimeInZone(tz);
      const localNowRounded = roundToFive(localNow);

      // Only fire at exactly 10:00 (rounded to nearest 5-min slot)
      if (localNowRounded !== TARGET_TIME) continue;

      const today = getTodayInZone(tz);

      // Deduplicate: only one notification per day per user
      if (user.lastEngagementNotificationDate === today) continue;

      // If user already recorded today → no morning prompt needed
      const lastMorningDate = streaks?.lastMorningDate ?? '';
      if (lastMorningDate === today) continue;

      const daysSince = daysBetween(lastMorningDate, today);
      const morningStreak = streaks?.morningCurrent ?? 0;
      const morningLongest = streaks?.morningLongest ?? 0;

      const notif = buildNotification(morningStreak, morningLongest, daysSince);
      if (!notif) continue;

      functions.logger.info(`Sending engagement notif to ${displayName}`, {
        userId: docSnap.id,
        type: notif.type,
        daysSince,
        streak: morningStreak,
      });

      batch.push(
        sendFCM(messaging, fcmTokens, notif.title, notif.body, {
          type: notif.type,
          screen: 'Morning',
        }).then(async () => {
          // Mark today as notified
          await db
            .collection('users')
            .doc(docSnap.id)
            .update({ lastEngagementNotificationDate: today });
        }),
      );
    }

    await Promise.allSettled(batch);
    functions.logger.info('sendEngagementNotifications complete', {
      processed: batch.length,
    });
    return null;
  });
