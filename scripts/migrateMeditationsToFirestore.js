#!/usr/bin/env node
/**
 * migrateMeditationsToFirestore.js
 *
 * Bridges the legacy ElevenLabs meditation catalog (src/config/meditations.ts)
 * into the new YouTube-backed Firestore schema (/meditations).
 *
 * It does NOT invent YouTube IDs. It emits the 6 legacy meditations as a seed
 * JSON with empty youtube_id and unavailable=true, so they don't surface in the
 * app until Juanes curates real videos for each. That JSON is the starting
 * point for the curation workflow (see content/CURATION_GUIDE.md from the
 * wt-content-curation branch) and is consumed by scripts/seedMeditationsCatalog.js.
 *
 * Usage:
 *   node scripts/migrateMeditationsToFirestore.js              # dry-run, writes JSON only
 *   node scripts/migrateMeditationsToFirestore.js --write      # also writes to Firestore
 *   node scripts/migrateMeditationsToFirestore.js --project remia
 *
 * Requires firebase-admin (already a functions dependency) and, for --write,
 * application default credentials or a service account.
 */

const fs = require('fs');
const path = require('path');

// ─── Legacy catalog (metadata only; ElevenLabs scripts are intentionally dropped) ──
// Kept in sync manually with src/config/meditations.ts. We only carry the
// human-facing metadata; the narration scripts are obsolete under the YouTube model.

const LEGACY_MEDITATIONS = [
  {
    id: 'med_sleep_descent',
    title: 'Descenso al sueño',
    subtitle: 'Body scan + cuenta regresiva para dormir profundo',
    category: 'sleep',
    categoryLabel: 'Sueño profundo',
    duration_min: 5,
  },
  {
    id: 'med_recall',
    title: 'Intención de recordar',
    subtitle: 'Programa tu mente para recordar tus sueños esta noche',
    category: 'recall',
    categoryLabel: 'Recall onírico',
    duration_min: 3,
  },
  {
    id: 'med_lucid',
    title: 'Puerta al sueño lúcido',
    subtitle: 'Técnica MILD para inducir consciencia dentro del sueño',
    category: 'lucid',
    categoryLabel: 'Sueño lúcido',
    duration_min: 5,
  },
  {
    id: 'med_anxiety',
    title: 'Calma para mente acelerada',
    subtitle: 'Respiración 4-7-8 + visualización para soltar la ansiedad',
    category: 'anxiety',
    categoryLabel: 'Ansiedad',
    duration_min: 4,
  },
  {
    id: 'med_gratitude',
    title: 'Gratitud nocturna',
    subtitle: 'Cierra el día con tres reconocimientos al corazón',
    category: 'gratitude',
    categoryLabel: 'Gratitud',
    duration_min: 3,
  },
  {
    id: 'med_reconnect',
    title: 'Reconexión con el cuerpo',
    subtitle: 'Para mentes inquietas que no encuentran el sueño',
    category: 'focus',
    categoryLabel: 'Reconexión',
    duration_min: 4,
  },
];

function toFirestoreDoc(legacy) {
  return {
    id: legacy.id,
    title: legacy.title,
    subtitle: legacy.subtitle,
    category: legacy.category,
    categoryLabel: legacy.categoryLabel,
    mood_tags: [],
    duration_min: legacy.duration_min,
    youtube_id: '', // TODO: curate a real Spanish YouTube video for each
    verified_no_ads: false,
    language: 'es',
    creator: '',
    embed_allowed: true,
    // Hidden until curated — picker filters unavailable=true out.
    unavailable: true,
    last_validated_at: null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const doWrite = args.includes('--write');
  const projectIdx = args.indexOf('--project');
  const projectId = projectIdx >= 0 ? args[projectIdx + 1] : undefined;

  const docs = LEGACY_MEDITATIONS.map(toFirestoreDoc);

  // Always emit the JSON starting point.
  const outDir = path.resolve(__dirname, '..', 'content');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'meditations-from-legacy.json');
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`✓ Wrote ${docs.length} legacy entries to ${outPath}`);
  console.log('  Each has youtube_id="" and unavailable=true — curate before seeding.');

  if (!doWrite) {
    console.log('\nDry-run (no Firestore write). Pass --write to upload these placeholders.');
    return;
  }

  // --write path: upload placeholders to Firestore.
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
  const db = admin.firestore();

  let written = 0;
  for (const doc of docs) {
    await db.collection('meditations').doc(doc.id).set(
      {
        ...doc,
        last_validated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    written++;
    console.log(`  → meditations/${doc.id}`);
  }
  console.log(`✓ Wrote ${written} placeholder docs to Firestore (project: ${projectId ?? 'default'}).`);
}

main().catch((err) => {
  console.error('migrateMeditationsToFirestore failed:', err);
  process.exit(1);
});
