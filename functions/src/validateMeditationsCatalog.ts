import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Guard como en recommendMeditation: otras CFs ya hacen initializeApp().
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ─── oEmbed check ─────────────────────────────────────────────────────────────
//
// YouTube oEmbed (https://www.youtube.com/oembed?...) devuelve 200+JSON para
// videos públicos embeddables, y 401/403/404 para los que fueron borrados,
// privados, o tienen embed deshabilitado por el creador. No requiere API key
// y no consume cuota de Data API.

async function isYoutubeVideoAvailable(youtubeId: string): Promise<boolean> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(
      youtubeId,
    )}&format=json`;
    const res = await axios.get(url, {
      timeout: 5000,
      validateStatus: () => true,
    });
    return res.status === 200;
  } catch (err) {
    functions.logger.warn(
      '[validateMeditationsCatalog] oEmbed request failed',
      { err, youtubeId },
    );
    return false;
  }
}

// ─── Cloud Function: scheduled weekly ─────────────────────────────────────────
//
// Cron: domingos 06:00 UTC (~01:00 hora Bogotá). Ventana de bajo tráfico.

export const validateMeditationsCatalog = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '256MB' })
  .pubsub.schedule('0 6 * * 0')
  .timeZone('Etc/UTC')
  .onRun(async () => {
    const snap = await db.collection('meditations').get();
    functions.logger.info(
      `[validateMeditationsCatalog] checking ${snap.size} entries`,
    );

    let checked = 0;
    let nowUnavailable = 0;
    let nowAvailable = 0;
    let skipped = 0;

    for (const doc of snap.docs) {
      const data = doc.data() as {
        youtube_id?: string;
        unavailable?: boolean;
      };
      const ytId = data.youtube_id;
      if (!ytId) {
        skipped++;
        continue;
      }

      const available = await isYoutubeVideoAvailable(ytId);
      const wasUnavailable = data.unavailable === true;

      if (!available && !wasUnavailable) {
        await doc.ref.update({
          unavailable: true,
          last_validated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        nowUnavailable++;
      } else if (available && wasUnavailable) {
        // Restaurado: el creador lo re-publicó o re-habilitó embed.
        await doc.ref.update({
          unavailable: false,
          last_validated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        nowAvailable++;
      } else {
        await doc.ref.update({
          last_validated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      checked++;
    }

    functions.logger.info('[validateMeditationsCatalog] done', {
      checked,
      nowUnavailable,
      nowAvailable,
      skipped,
    });
    return null;
  });
