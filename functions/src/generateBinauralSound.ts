import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Init defensivo
if (!admin.apps.length) {
  admin.initializeApp();
}

const bucket = admin.storage().bucket();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GenerateRequest {
  soundId: string;
  type: 'binaural' | 'noise';
  baseFreq?: number;  // para binaural
  beatFreq?: number;  // para binaural
  noiseType?: 'pink' | 'brown'; // para noise
}

interface GenerateResponse {
  storagePath: string;
  cached: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 30;
const NUM_SAMPLES = SAMPLE_RATE * DURATION_SECONDS;
const AMPLITUDE = 0.6;

// ─── Generadores ──────────────────────────────────────────────────────────────

function generateBinaural(baseFreq: number, beatFreq: number): Float64Array {
  const samples = new Float64Array(NUM_SAMPLES * 2);
  const freqLeft = baseFreq;
  const freqRight = baseFreq + beatFreq;
  const fadeLength = Math.floor(SAMPLE_RATE * 0.5);

  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let envelope = 1.0;
    if (i < fadeLength) envelope = i / fadeLength;
    else if (i > NUM_SAMPLES - fadeLength) envelope = (NUM_SAMPLES - i) / fadeLength;

    samples[i * 2] = Math.sin(2 * Math.PI * freqLeft * t) * AMPLITUDE * envelope;
    samples[i * 2 + 1] = Math.sin(2 * Math.PI * freqRight * t) * AMPLITUDE * envelope;
  }
  return samples;
}

function generatePinkNoise(): Float64Array {
  const samples = new Float64Array(NUM_SAMPLES * 2);
  const fadeLength = Math.floor(SAMPLE_RATE * 0.5);
  const numGenerators = 16;
  const generators = new Float64Array(numGenerators);

  for (let i = 0; i < NUM_SAMPLES; i++) {
    for (let g = 0; g < numGenerators; g++) {
      if ((i & (1 << g)) === 0) generators[g] = Math.random() * 2 - 1;
    }
    let value = 0;
    for (let g = 0; g < numGenerators; g++) value += generators[g];
    value /= numGenerators;
    value *= AMPLITUDE * 0.8;

    let envelope = 1.0;
    if (i < fadeLength) envelope = i / fadeLength;
    else if (i > NUM_SAMPLES - fadeLength) envelope = (NUM_SAMPLES - i) / fadeLength;

    const sample = value * envelope;
    samples[i * 2] = sample;
    samples[i * 2 + 1] = sample;
  }
  return samples;
}

function generateBrownNoise(): Float64Array {
  const samples = new Float64Array(NUM_SAMPLES * 2);
  const fadeLength = Math.floor(SAMPLE_RATE * 0.5);
  let lastValue = 0;
  const leak = 0.998;

  for (let i = 0; i < NUM_SAMPLES; i++) {
    lastValue = lastValue * leak + (Math.random() * 2 - 1) * 0.1;
    if (lastValue > 1) lastValue = 1;
    if (lastValue < -1) lastValue = -1;

    let envelope = 1.0;
    if (i < fadeLength) envelope = i / fadeLength;
    else if (i > NUM_SAMPLES - fadeLength) envelope = (NUM_SAMPLES - i) / fadeLength;

    const sample = lastValue * AMPLITUDE * envelope;
    samples[i * 2] = sample;
    samples[i * 2 + 1] = sample;
  }
  return samples;
}

// ─── WAV encoder (mínimo, sin dependencias) ───────────────────────────────────

function encodeWav(floatSamples: Float64Array, sampleRate: number, numChannels: number): Buffer {
  const numSamples = floatSamples.length;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);           // Subchunk1Size
  buffer.writeUInt16LE(1, 20);            // AudioFormat (PCM)
  buffer.writeUInt16LE(numChannels, 22);   // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);    // SampleRate
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // BlockAlign
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Samples
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.round(int16), headerSize + i * 2);
  }

  return buffer;
}

// ─── Cloud Function ──────────────────────────────────────────────────────────

export const generateBinauralSound = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 30, memory: '512MB' })
  .https.onCall(async (data: GenerateRequest, context): Promise<GenerateResponse> => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const { soundId, type } = data;
    if (!soundId || !type) {
      throw new functions.https.HttpsError('invalid-argument', 'soundId y type son requeridos');
    }

    const storagePath = `ambient-sounds/${soundId}.wav`;
    const file = bucket.file(storagePath);

    // Cache hit?
    const [exists] = await file.exists();
    if (exists) {
      functions.logger.info('[generateBinauralSound] cache hit', { soundId });
      return { storagePath, cached: true };
    }

    // Generar audio
    functions.logger.info('[generateBinauralSound] generating', { soundId, type });

    let samples: Float64Array;
    if (type === 'binaural') {
      const baseFreq = data.baseFreq ?? 200;
      const beatFreq = data.beatFreq ?? 10;
      samples = generateBinaural(baseFreq, beatFreq);
    } else if (type === 'noise' && data.noiseType === 'brown') {
      samples = generateBrownNoise();
    } else {
      samples = generatePinkNoise();
    }

    // Encode to WAV
    const wavBuffer = encodeWav(samples, SAMPLE_RATE, 2);

    // Upload
    await file.save(wavBuffer, {
      contentType: 'audio/wav',
      metadata: {
        contentType: 'audio/wav',
        cacheControl: 'public, max-age=31536000',
        metadata: {
          generatedBy: 'generateBinauralSound',
          soundId,
          type,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    await file.makePublic();

    functions.logger.info('[generateBinauralSound] uploaded', { soundId, storagePath });
    return { storagePath, cached: false };
  });
