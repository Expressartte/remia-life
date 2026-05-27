/**
 * Sube los archivos WAV a Firebase Storage usando la API REST.
 * Usa el token de la sesión de Firebase CLI para autenticación.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUCKET = 'banded-torus-434917-c1.firebasestorage.app';
const AUDIO_DIR = path.join(__dirname, '..', 'temp_audio');

// Obtener token via firebase CLI
function getFirebaseToken() {
  try {
    // Usa el token del login existente de Firebase CLI
    const tokenOutput = execSync('npx firebase-tools login:ci --interactive 2>&1', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return tokenOutput.trim();
  } catch {
    return null;
  }
}

async function uploadFile(localPath, storageName) {
  const fileBuffer = fs.readFileSync(localPath);
  const encodedName = encodeURIComponent(`ambient-sounds/${storageName}`);
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedName}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/wav',
    },
    body: fileBuffer,
  });

  if (resp.ok) {
    console.log(`  ✅ ${storageName}`);

    // Hacer público
    const patchUrl = `${url}?alt=json`;
    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata: {
          firebaseStorageDownloadTokens: 'public',
        },
      }),
    }).catch(() => {});
  } else {
    const errText = await resp.text();
    console.error(`  ❌ ${storageName}: ${resp.status} ${errText.slice(0, 200)}`);
  }
}

async function main() {
  if (!fs.existsSync(AUDIO_DIR)) {
    console.error('No se encontró temp_audio/. Ejecuta primero: node scripts/generateBinauralBeats.js');
    process.exit(1);
  }

  const files = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.wav'));
  console.log(`\n📤 Subiendo ${files.length} archivos a Firebase Storage (${BUCKET})...\n`);

  for (const file of files) {
    const localPath = path.join(AUDIO_DIR, file);
    await uploadFile(localPath, file);
  }

  console.log('\n✨ ¡Upload completo!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
