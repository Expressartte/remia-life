import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { DreamStatus } from '../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

export interface DreamAnalysisData {
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
  generatedAt: unknown;
  model: string;
}

export interface DreamDoc {
  status: DreamStatus;
  transcription?: { text: string };
  analysis?: DreamAnalysisData;
  error?: { code: string; message: string };
  date: string;
  dream_title?: string;
  createdAt?: unknown;
  recording?: { durationSeconds: number };
}

export type AnalysisLoadState = 'loading' | 'analyzing' | 'complete' | 'error';

export interface UseDreamAnalysisReturn {
  loadState: AnalysisLoadState;
  dream: DreamDoc | null;
  analysis: DreamAnalysisData | null;
  errorMessage: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDreamAnalysis(
  userId: string,
  dreamId: string
): UseDreamAnalysisReturn {
  const [loadState, setLoadState] = useState<AnalysisLoadState>('loading');
  const [dream, setDream] = useState<DreamDoc | null>(null);
  const [analysis, setAnalysis] = useState<DreamAnalysisData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !dreamId) return;

    const dreamRef = doc(db, 'users', userId, 'dreams', dreamId);

    const unsub = onSnapshot(dreamRef, (snap) => {
      if (!snap.exists()) {
        setLoadState('error');
        setErrorMessage('El sueño no fue encontrado.');
        return;
      }

      const data = snap.data() as DreamDoc;
      setDream(data);

      switch (data.status) {
        case 'analyzing':
          setLoadState('analyzing');
          break;

        case 'complete':
          if (data.analysis) {
            setAnalysis(data.analysis);
            setLoadState('complete');
          } else {
            setLoadState('error');
            setErrorMessage('El análisis no está disponible.');
          }
          break;

        case 'error':
          setLoadState('error');
          setErrorMessage(
            data.error?.message ?? 'Ocurrió un error al analizar tu sueño.'
          );
          break;

        default:
          // Otros estados: seguir esperando
          setLoadState('loading');
      }
    });

    return unsub;
  }, [userId, dreamId]);

  return { loadState, dream, analysis, errorMessage };
}
