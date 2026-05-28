import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../services/firebase';
import {
  YoutubeMeditation,
  MeditationCategory,
  MeditationContext,
} from '../types/meditations';

// ─── Mapping de contextos a categorías ────────────────────────────────────────
//
// Un contexto representa la situación del usuario en el momento que pide la
// meditación. La categoría representa el tipo de contenido. La mayoría son
// 1-a-1 pero pre_sleep y post_dream mapean a categorías más amplias.

const CONTEXT_TO_CATEGORY: Record<MeditationContext, MeditationCategory> = {
  pre_sleep: 'sleep',
  post_dream: 'recall',
  anxiety: 'anxiety',
  recall: 'recall',
  gratitude: 'gratitude',
  focus: 'focus',
  lucid: 'lucid',
  sleep: 'sleep',
};

// ─── Tipos del hook ───────────────────────────────────────────────────────────

export interface UseMeditationPickerOptions {
  /** Si se pasa context Y no se pasa category, infiere la categoría del mapping. */
  context?: MeditationContext;
  /** Override directo de categoría — gana sobre context. */
  category?: MeditationCategory;
  /** Cuando hay un dreamId, prefiere llamar a recommendMeditation CF para que
   *  use la emoción/arquetipo del sueño para rankear mejor. */
  dreamId?: string;
  /** Resultados máximos (default 6). */
  pageSize?: number;
}

export interface UseMeditationPickerReturn {
  meditations: YoutubeMeditation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMeditationPicker(
  opts: UseMeditationPickerOptions,
): UseMeditationPickerReturn {
  const [meditations, setMeditations] = useState<YoutubeMeditation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategory: MeditationCategory | null =
    opts.category ?? (opts.context ? CONTEXT_TO_CATEGORY[opts.context] : null);
  const pageSize = opts.pageSize ?? 6;
  const dreamId = opts.dreamId;

  const fetchMeditations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Path A: con dreamId, delegar al CF para ranking smart basado en análisis.
      if (dreamId) {
        const recommend = httpsCallable<
          { dreamId: string; limit?: number },
          { meditations: YoutubeMeditation[]; reason: string }
        >(functions, 'recommendMeditation');
        const result = await recommend({ dreamId, limit: pageSize });
        setMeditations(result.data.meditations ?? []);
        return;
      }

      // Path B: query directo a Firestore — más barato y funciona offline-first.
      const ref = collection(db, 'meditations');
      const q = effectiveCategory
        ? query(
            ref,
            where('category', '==', effectiveCategory),
            where('unavailable', '==', false),
            orderBy('duration_min', 'asc'),
            limit(pageSize),
          )
        : query(ref, where('unavailable', '==', false), limit(pageSize));

      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data() as YoutubeMeditation;
        // Trust the stored id field but fall back to Firestore doc id.
        return { ...data, id: data.id ?? d.id };
      });
      setMeditations(items);
    } catch (err: any) {
      console.error('[useMeditationPicker] fetch error:', err);
      setError(err?.message ?? 'No se pudieron cargar las meditaciones.');
      setMeditations([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveCategory, dreamId, pageSize]);

  useEffect(() => {
    fetchMeditations();
  }, [fetchMeditations]);

  return { meditations, loading, error, refresh: fetchMeditations };
}
