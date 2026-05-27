import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface UserSettings {
  nightReminderEnabled: boolean;
  nightReminderTime: string; // "HH:MM" en la zona horaria del usuario
}

interface UserDoc {
  settings: UserSettings;
  timezone: string;           // IANA timezone, e.g. "America/Mexico_City"
  fcmTokens: string[];
  displayName: string;
  accountStatus: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Devuelve la hora actual en la zona horaria dada como string "HH:MM".
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
    // Normalize "24" hour (midnight edge case)
    return `${h === '24' ? '00' : h}:${m}`;
  } catch {
    return '00:00';
  }
}

/**
 * Resta 60 minutos a un tiempo "HH:MM".
 * "21:00" → "20:00", "00:30" → "23:30"
 */
function subtractOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m - 60;
  const adjusted = ((totalMinutes % 1440) + 1440) % 1440; // wrap midnight
  const newH = Math.floor(adjusted / 60);
  const newM = adjusted % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// ─── Función principal: cron cada 5 minutos ───────────────────────────────────

/**
 * Busca usuarios cuya ventana de recordatorio cae ahora mismo y les envía
 * una notificación FCM: "Tu mente necesita prepararse. 🌙"
 *
 * Lógica:
 *   - El usuario configura "nightReminderTime" = hora de dormir (ej. "22:00")
 *   - La notificación se envía 1 hora ANTES = 21:00 en su timezone
 *   - Este cron corre cada 5 min; comparamos HH:MM redondeado a múltiplos de 5.
 */
export const sendNightReminders = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('every 5 minutes')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const messaging = admin.messaging();

    // Redondear el minuto actual a múltiplos de 5 para matching estable
    const now = new Date();
    const roundedMinute = Math.floor(now.getUTCMinutes() / 5) * 5;
    const utcHH = String(now.getUTCHours()).padStart(2, '0');
    const utcMM = String(roundedMinute).padStart(2, '0');
    const currentUTCTime = `${utcHH}:${utcMM}`;

    functions.logger.info('sendNightReminders running', { currentUTCTime });

    // Traer todos los usuarios activos con recordatorio nocturno habilitado
    // En producción con muchos usuarios, esto debería paginar o usar un índice de zona horaria.
    const snapshot = await db
      .collection('users')
      .where('settings.nightReminderEnabled', '==', true)
      .where('accountStatus', '==', 'active')
      .get();

    if (snapshot.empty) {
      functions.logger.info('No users with night reminders enabled');
      return null;
    }

    const batch: Promise<void>[] = [];

    for (const docSnap of snapshot.docs) {
      const user = docSnap.data() as UserDoc;
      const { settings, timezone, fcmTokens, displayName } = user;

      if (!fcmTokens || fcmTokens.length === 0) continue;
      if (!settings?.nightReminderTime) continue;

      const tz = timezone || 'UTC';

      // Hora actual en la zona del usuario
      const localNow = getCurrentTimeInZone(tz);
      const localNowRounded =
        localNow.slice(0, 3) +
        String(Math.floor(Number(localNow.slice(3)) / 5) * 5).padStart(2, '0');

      // Hora en que debe llegar la notif = bedtime - 1h
      const reminderFireTime = subtractOneHour(settings.nightReminderTime);
      const reminderFireTimeRounded =
        reminderFireTime.slice(0, 3) +
        String(Math.floor(Number(reminderFireTime.slice(3)) / 5) * 5).padStart(2, '0');

      if (localNowRounded !== reminderFireTimeRounded) continue;

      // Componer mensaje FCM
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title: 'Remia 🌙',
          body: 'Tu mente necesita prepararse. Comienza tu ritual nocturno.',
        },
        data: {
          type: 'night_ritual_reminder',
          screen: 'Night',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'night_ritual',
            sound: 'default',
            icon: 'notification_icon',
            color: '#6C63FF',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      batch.push(
        messaging
          .sendEachForMulticast(message)
          .then(response => {
            functions.logger.info(`Night reminder sent to ${displayName}`, {
              userId: docSnap.id,
              successCount: response.successCount,
              failureCount: response.failureCount,
            });

            // Limpiar tokens inválidos
            const invalidTokens: string[] = [];
            response.responses.forEach((r, i) => {
              if (!r.success) {
                const code = r.error?.code;
                if (
                  code === 'messaging/registration-token-not-registered' ||
                  code === 'messaging/invalid-registration-token'
                ) {
                  invalidTokens.push(fcmTokens[i]);
                }
              }
            });

            if (invalidTokens.length > 0) {
              return db
                .collection('users')
                .doc(docSnap.id)
                .update({
                  fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
                })
                .then(() => undefined);
            }
            return undefined;
          })
          .catch(err => {
            functions.logger.error(`Error sending to ${displayName}`, { error: err });
          })
      );
    }

    await Promise.allSettled(batch);
    functions.logger.info(`sendNightReminders complete`, { usersProcessed: batch.length });
    return null;
  });

// ─── Callable: registrar token FCM del dispositivo ───────────────────────────

/**
 * El cliente llama esto al iniciar sesión para que los tokens FCM queden
 * almacenados en el documento del usuario.
 */
export const registerFcmToken = functions
  .region('us-central1')
  .https.onCall(async (data: { token: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Autenticación requerida.');
    }

    const { token } = data;
    if (!token || typeof token !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'token requerido.');
    }

    const userId = context.auth.uid;
    const db = admin.firestore();

    await db
      .collection('users')
      .doc(userId)
      .update({
        fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true };
  });
