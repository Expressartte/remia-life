#!/usr/bin/env node
/**
 * seedMeditationsCatalog.js
 *
 * Reads content/meditations-catalog.json (the curated, filled version — NOT the
 * template) and seeds the Firestore /meditations collection. Idempotent: re-runs
 * update existing docs by id and create new ones, preserving last_validated_at
 * if already present.
 *
 * Usage:
 *   node scripts/seedMeditationsCatalog.js --dry-run         # validate only, no writes
 *   node scripts/seedMeditationsCatalog.js --project remia   # validate + write
 *
 * Requires firebase-admin (already a project dependency) and credentials
 * (Application Default Credentials or a service account).
 */

const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['sleep', 'recall', 'lucid', 'anxiety', 'gratitude', 'focus'];
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CATALOG_PATH = path.resolve(__dirname, '..', 'content', 'meditations-catalog.json');

// Substrings that flag an entry still has placeholder data.
const PLACEHOLDER_MARKERS = ['PLACEHOLDER', 'TODO', 'Ejemplo:'];

// ─── Validation ─────────────────────────────────────────────────────────────────

function validateEntry(entry, index, seenIds) {
  const errors = [];
  const where = `entry #${index}${entry.id ? ` (${entry.id})` : ''}`;

  if (!entry.id || typeof entry.id !== 'string') {
    errors.push(`${where}: missing/invalid "id"`);
  } else if (seenIds.has(entry.id)) {
    errors.push(`${where}: duplicate id "${entry.id}"`);
  }

  if (!entry.title) errors.push(`${where}: missing "title"`);
  if (!entry.subtitle) errors.push(`${where}: missing "subtitle"`);

  if (!VALID_CATEGORIES.includes(entry.category)) {
    errors.push(
      `${where}: invalid category "${entry.category}" (expected one of ${VALID_CATEGORIES.join(', ')})`,
    );
  }

  if (!entry.categoryLabel) errors.push(`${where}: missing "categoryLabel"`);

  if (!Array.isArray(entry.mood_tags)) {
    errors.push(`${where}: "mood_tags" must be an array`);
  }

  if (typeof entry.duration_min !== 'number' || entry.duration_min <= 0) {
    errors.push(`${where}: "duration_min" must be a positive number`);
  }

  if (!YOUTUBE_ID_RE.test(entry.youtube_id ?? '')) {
    errors.push(
      `${where}: "youtube_id" must match ${YOUTUBE_ID_RE} (got "${entry.youtube_id}")`,
    );
  }

  if (entry.language !== 'es') {
    errors.push(`${where}: "language" must be "es" (got "${entry.language}")`);
  }

  if (!entry.creator) errors.push(`${where}: missing "creator"`);

  // Catch forgotten placeholder text in any string field.
  const serialized = JSON.stringify(entry);
  for (const marker of PLACEHOLDER_MARKERS) {
    if (serialized.includes(marker)) {
      errors.push(`${where}: still contains placeholder text "${marker}"`);
    }
  }

  return errors;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const projectIdx = args.indexOf('--project');
  const projectId = projectIdx >= 0 ? args[projectIdx + 1] : undefined;

  // 1. Load catalog
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`✗ No se encontró ${CATALOG_PATH}`);
    console.error('  Copiá content/meditations-catalog.template.json y llenalo primero.');
    process.exit(1);
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (err) {
    console.error(`✗ JSON inválido en ${CATALOG_PATH}: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(catalog)) {
    console.error('✗ El catálogo debe ser un array JSON.');
    process.exit(1);
  }

  // 2. Validate
  const seenIds = new Set();
  const allErrors = [];
  catalog.forEach((entry, i) => {
    const errs = validateEntry(entry, i, seenIds);
    if (entry.id) seenIds.add(entry.id);
    allErrors.push(...errs);
  });

  if (allErrors.length > 0) {
    console.error(`✗ Validación falló con ${allErrors.length} error(es):\n`);
    allErrors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`✓ ${catalog.length} entradas válidas.`);

  // Report distribution by category
  const byCat = {};
  for (const e of catalog) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  console.log('  Distribución:', JSON.stringify(byCat));

  if (dryRun) {
    console.log('\nDry-run: no se escribió nada en Firestore. Quita --dry-run para sembrar.');
    return;
  }

  // 3. Seed Firestore
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
  const db = admin.firestore();

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const entry of catalog) {
    const ref = db.collection('meditations').doc(entry.id);
    try {
      const existing = await ref.get();
      const doc = {
        id: entry.id,
        title: entry.title,
        subtitle: entry.subtitle,
        category: entry.category,
        categoryLabel: entry.categoryLabel,
        mood_tags: entry.mood_tags,
        duration_min: entry.duration_min,
        youtube_id: entry.youtube_id,
        verified_no_ads: entry.verified_no_ads === true,
        language: entry.language,
        creator: entry.creator,
        embed_allowed: entry.embed_allowed !== false,
        unavailable: false,
      };

      // Preserve last_validated_at if the doc already exists; otherwise null.
      if (existing.exists && existing.data().last_validated_at) {
        doc.last_validated_at = existing.data().last_validated_at;
      } else {
        doc.last_validated_at = null;
      }

      await ref.set(doc, { merge: true });
      if (existing.exists) {
        updated++;
        console.log(`  ↻ updated  meditations/${entry.id}`);
      } else {
        created++;
        console.log(`  + created  meditations/${entry.id}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ✗ failed   meditations/${entry.id}: ${err.message}`);
    }
  }

  console.log(
    `\n✓ Listo. created=${created} updated=${updated} errors=${errors} (project: ${projectId ?? 'default'}).`,
  );
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('seedMeditationsCatalog failed:', err);
  process.exit(1);
});
