/**
 * Script para generar archivos de audio de ondas binaurales y ruido.
 *
 * Genera archivos WAV estéreo de 30 segundos para cada tipo de onda
 * y los sube a Firebase Storage bajo `ambient-sounds/`.
 *
 * Uso:
 *   node scripts/generateBinauralBeats.js
 *
 * Requisitos:
 *   npm install wavefile firebase-admin
 *
 * El script usa la cuenta de servicio por defecto del proyecto Firebase.
 * Asegúrate de tener GOOGLE_APPLICATION_CREDENTIALS configurado o de
 * ejecutarlo en un entorno con acceso al proyecto.
 */

const { WaveFile } = require('wavefile');
const fs = require('fs');
const path = require('path');

// ─── Configuración ────────────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 30;
const NUM_SAMPLES = SAMPLE_RATE * DURATION_SECONDS;
const AMPLITUDE = 0.6; // 60% del máximo para no saturar

// ─── Ondas binaurales ─────────────────────────────────────────────────────────

const BINAURAL_CONFIGS = [
  {
    id: 'binaural_delta',
    name: 'Delta 2Hz',
    baseFreq: 150,
    beatFreq: 2,
  },
  {
    id: 'binaural_theta',
    name: 'Theta 6Hz',
    baseFreq: 200,
    beatFreq: 6,
  },
  {
    id: 'binaural_alpha',
    name: 'Alpha 10Hz',
    baseFreq: 200,
    beatFreq: 10,
  },
  {
    id: 'binaural_gamma',
    name: 'Gamma 40Hz',
    baseFreq: 300,
    beatFreq: 40,
  },
];

/**
 * Genera un buffer de audio estéreo con ondas binaurales.
 * Canal izquierdo: frecuencia base
 * Canal derecho: frecuencia base + beat frequency
 *
 * El beat se aplica con un fade-in/out suave para evitar clicks en el loop.
 */
function generateBinaural(baseFreq, beatFreq) {
  const samples = new Float64Array(NUM_SAMPLES * 2);
  const freqLeft = baseFreq;
  const freqRight = baseFreq + beatFreq;

  // Fade de 0.5 segundos al inicio y fin para loop seamless
  const fadeLength = Math.floor(SAMPLE_RATE * 0.5);

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    let envelope = 1.0;
    if (i < fadeLength) {
      envelope = i / fadeLength;
    } else if (i > NUM_SAMPLES - fadeLength) {
      envelope = (NUM_SAMPLES - i) / fadeLength;
    }

    const left = Math.sin(2 * Math.PI * freqLeft * t) * AMPLITUDE * envelope;
    const right = Math.sin(2 * Math.PI * freqRight * t) * AMPLITUDE * envelope;

    samples[i * 2] = left;
    samples[i * 2 + 1] = right;
  }

  return samples;
}

// ─── Ruido ────────────────────────────────────────────────────────────────────

/**
 * Ruido rosa (1/f noise): potencia inversamente proporcional a la frecuencia.
 * Usa el algoritmo de Voss-McCartney para una generación eficiente.
 */
function generatePinkNoise() {
  const samples = new Float64Array(NUM_SAMPLES * 2);
  const fadeLength = Math.floor(SAMPLE_RATE * 0.5);

  // Voss-McCartney con 16 generadores
  const numGenerators = 16;
  const generators = new Float64Array(numGenerators);

  for (let i = 0; i < NUM_SAMPLES; i++) {
    // Actualizar generadores según los bits que cambian
    for (let g = 0; g < numGenerators; g++) {
      if ((i & (1 << g)) === 0) {
        generators[g] = (Math.random() * 2 - 1);
      }
    }

    let value = 0;
    for (let g = 0; g < numGenerators; g++) {
      value += generators[g];
    }
    value /= numGenerators;
    value *= AMPLITUDE * 0.8;

    let envelope = 1.0;
    if (i < fadeLength) {
      envelope = i / fadeLength;
    } else if (i > NUM_SAMPLES - fadeLength) {
      envelope = (NUM_SAMPLES - i) / fadeLength;
    }

    const sample = value * envelope;
    samples[i * 2] = sample;     // mono → ambos canales iguales
    samples[i * 2 + 1] = sample;
  }

  return samples;
}

/**
 * Ruido marrón (browniano): integral del ruido blanco.
 * Más suave y grave que el ruido rosa — ideal para dormir.
 */
function generateBrownNoise() {
  const samples = new Float64Array(NUM_SAMPLES * 2);
  const fadeLength = Math.floor(SAMPLE_RATE * 0.5);

  let lastValue = 0;
  const leak = 0.998; // Pequeño leak para evitar drift infinito

  for (let i = 0; i < NUM_SAMPLES; i++) {
    lastValue = lastValue * leak + (Math.random() * 2 - 1) * 0.1;

    // Clamp para evitar saturación
    if (lastValue > 1) lastValue = 1;
    if (lastValue < -1) lastValue = -1;

    let envelope = 1.0;
    if (i < fadeLength) {
      envelope = i / fadeLength;
    } else if (i > NUM_SAMPLES - fadeLength) {
      envelope = (NUM_SAMPLES - i) / fadeLength;
    }

    const sample = lastValue * AMPLITUDE * envelope;
    samples[i * 2] = sample;
    samples[i * 2 + 1] = sample;
  }

  return samples;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function float64ToInt16(samples) {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

function createWav(floatSamples) {
  const wav = new WaveFile();
  const int16Samples = float64ToInt16(floatSamples);
  wav.fromScratch(2, SAMPLE_RATE, '16', int16Samples);
  return wav.toBuffer();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.join(__dirname, '..', 'temp_audio');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('🧠 Generando ondas binaurales...\n');
  for (const config of BINAURAL_CONFIGS) {
    console.log(`  Generando ${config.name} (${config.baseFreq}Hz base, ${config.beatFreq}Hz beat)...`);
    const samples = generateBinaural(config.baseFreq, config.beatFreq);
    const wavBuffer = createWav(samples);
    const localPath = path.join(outDir, `${config.id}.wav`);
    fs.writeFileSync(localPath, wavBuffer);
    console.log(`  ✅ ${localPath}`);
  }

  console.log('\n🎧 Generando ruido rosa...');
  {
    const samples = generatePinkNoise();
    const wavBuffer = createWav(samples);
    const localPath = path.join(outDir, 'noise_pink.wav');
    fs.writeFileSync(localPath, wavBuffer);
    console.log(`  ✅ ${localPath}`);
  }

  console.log('\n🎧 Generando ruido marrón...');
  {
    const samples = generateBrownNoise();
    const wavBuffer = createWav(samples);
    const localPath = path.join(outDir, 'noise_brown.wav');
    fs.writeFileSync(localPath, wavBuffer);
    console.log(`  ✅ ${localPath}`);
  }

  console.log('\n✨ Archivos generados en:', outDir);
  console.log('\n📤 Para subir a Firebase Storage, ejecuta:');
  console.log(`  npx firebase-tools storage:upload --bucket ubuntu-coliving.firebasestorage.app --path ambient-sounds/ ${outDir}`);
  console.log('\n  O manualmente desde la consola de Firebase:');
  console.log('  https://console.firebase.google.com/project/ubuntu-coliving/storage');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
