// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmotionPhase {
  phase: string;
  emotion: string;
  intensity: number;
}

export interface Archetype {
  name: string;
  description: string;
  relevance: number;
}

export interface FreudianDefense {
  mechanism: string;
  evidence: string;
}

export interface DreamSymbol {
  symbol: string;
  freudian_interpretation: string;
  jungian_interpretation: string;
  personal_interpretation: string;
}

export interface DreamAnalysis {
  dream_title?: string;
  emotional_intensity: number;
  dominant_emotion: string;
  emotion_progression: EmotionPhase[];
  active_archetypes: Archetype[];
  freudian_defenses: FreudianDefense[];
  symbols: DreamSymbol[];
  compensation_analysis: string;
  subconscious_message: string;
  mental_screen_recommendation: string;
  confidence_level: number;
}

const REQUIRED_ANALYSIS_FIELDS: (keyof DreamAnalysis)[] = [
  'emotional_intensity',
  'dominant_emotion',
  'emotion_progression',
  'active_archetypes',
  'freudian_defenses',
  'symbols',
  'compensation_analysis',
  'subconscious_message',
  'mental_screen_recommendation',
  'confidence_level',
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Extracts and parses the first JSON object from a raw string.
 * Tolerant of markdown code blocks (```json...```) and surrounding prose.
 */
export function extractJson(raw: string): unknown {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object found in response: ${raw.slice(0, 300)}`);
  }
  return JSON.parse(jsonMatch[0]);
}

/**
 * Validates that a parsed object has all required DreamAnalysis fields
 * with the correct basic types. Throws descriptive errors on failure.
 */
export function validateAnalysis(obj: unknown): DreamAnalysis {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('AI response is not a JSON object.');
  }

  const analysis = obj as Record<string, unknown>;

  for (const field of REQUIRED_ANALYSIS_FIELDS) {
    if (!(field in analysis) || analysis[field] === null || analysis[field] === undefined) {
      throw new Error(`Required field missing: "${field}"`);
    }
  }

  // Validate numeric range fields [0, 1]
  for (const numField of ['emotional_intensity', 'confidence_level'] as const) {
    const val = analysis[numField];
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new Error(`Field "${numField}" must be a number in [0,1], got: ${val}`);
    }
  }

  // Validate array fields
  for (const arrField of [
    'emotion_progression',
    'active_archetypes',
    'freudian_defenses',
    'symbols',
  ] as const) {
    if (!Array.isArray(analysis[arrField])) {
      throw new Error(`Field "${arrField}" must be an array.`);
    }
  }

  return analysis as unknown as DreamAnalysis;
}

/**
 * Sanitizes user-supplied text before embedding it in an AI prompt.
 *
 * Defends against prompt injection by:
 * - Limiting length (prevents token flooding)
 * - Removing role-switching / override patterns
 * - Collapsing excessive whitespace
 *
 * This is NOT a security guarantee on its own; the AI system prompt
 * already constrains behaviour. Treat this as defence-in-depth.
 */
export function sanitizeForPrompt(text: string, maxLength = 3000): string {
  if (!text) return '';

  const INJECTION_PATTERNS: [RegExp, string][] = [
    [/ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/gi, '[eliminado]'],
    [/you\s+are\s+now\s+(a|an)\s+/gi, '[eliminado] '],
    [/act\s+as\s+(a|an|if)\s+/gi, '[eliminado] '],
    [/\bjailbreak\b/gi, '[eliminado]'],
    [/\bDAN\b/g, '[eliminado]'],
    [/system\s*:\s*/gi, ''],
    [/\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/g, ''],
    [/```[^`]*```/g, '[bloque de código eliminado]'],
  ];

  let result = text.slice(0, maxLength);
  for (const [pattern, replacement] of INJECTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  // Collapse 3+ consecutive whitespace/newlines to 2
  result = result.replace(/\s{3,}/g, '  ').trim();
  return result;
}

/**
 * Builds the enriched dream text combining transcription + socratic answers.
 * Sanitizes both sources before combining.
 */
export function buildEnrichedText(
  transcriptionText: string,
  socraticDialog: Array<{ id: number; question: string; answer: string | null }>,
): string {
  const safeTranscription = sanitizeForPrompt(transcriptionText, 5000);
  const answeredQuestions = socraticDialog.filter(q => q.answer);

  if (answeredQuestions.length === 0) {
    return `RELATO DEL SUEÑO:\n${safeTranscription}`;
  }

  const qa = answeredQuestions
    .map(q => `Pregunta: ${q.question}\nRespuesta: ${sanitizeForPrompt(q.answer!, 500)}`)
    .join('\n\n');

  return `RELATO DEL SUEÑO:\n${safeTranscription}\n\nPROFUNDIZACIÓN SOCRÁTICA:\n${qa}`;
}
