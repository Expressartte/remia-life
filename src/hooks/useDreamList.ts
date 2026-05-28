import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';
import { DreamDoc } from './useDreamAnalysis';
import { DreamStatus } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DreamListItem {
  id: string;
  // 'complete' dreams have full analysis. 'captured' dreams have only the
  // transcription — the user has not yet opted into the socratic deepening
  // flow, so they're surfaced with a distinct CTA in the journal.
  status: DreamStatus;
  date: string;                 // YYYY-MM-DD
  dream_title?: string;
  dominant_emotion: string;
  emotional_intensity: number;
  dominant_archetype: string;
  transcriptionPreview: string; // first 200 chars of transcription
}

export type DateRange = 'week' | 'month' | 'quarter' | null;

export interface DreamFilters {
  emotion: string | null;
  archetype: string | null;
  dateRange: DateRange;
  searchQuery: string;
}

const DEFAULT_FILTERS: DreamFilters = {
  emotion: null,
  archetype: null,
  dateRange: null,
  searchQuery: '',
};

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapDocToItem(docSnap: DocumentSnapshot): DreamListItem {
  const data = docSnap.data() as DreamDoc & { createdAt?: unknown; status?: DreamStatus };
  const analysis = data.analysis;
  const topArchetype =
    (analysis?.active_archetypes ?? [])
      .slice()
      .sort((a, b) => b.relevance - a.relevance)[0]?.name ?? '';

  return {
    id: docSnap.id,
    // Default to 'complete' for documents that pre-date the captured-status
    // pivot and never carried an explicit status field on the analysis path.
    status: (data.status as DreamStatus) ?? 'complete',
    date: data.date ?? '',
    dream_title: data.dream_title || analysis?.dream_title,
    dominant_emotion: analysis?.dominant_emotion ?? '',
    emotional_intensity: analysis?.emotional_intensity ?? 0,
    dominant_archetype: topArchetype,
    transcriptionPreview: (data.transcription?.text ?? '').slice(0, 200),
  };
}

function cutoffDateForRange(range: DateRange): string | null {
  if (!range) return null;
  const days = range === 'week' ? 7 : range === 'month' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDreamList() {
  const { user } = useAuth();
  const [dreams, setDreams] = useState<DreamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<DreamFilters>(DEFAULT_FILTERS);

  const cursorRef = useRef<DocumentSnapshot | null>(null);
  const inFlightRef = useRef(false);

  // ── Core fetch ──────────────────────────────────────────────────────────────

  async function doFetch(uid: string, reset: boolean) {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (reset) {
      setLoading(true);
      cursorRef.current = null;
    } else {
      setLoadingMore(true);
    }

    try {
      const dreamsRef = collection(db, 'users', uid, 'dreams');
      let q;

      if (!reset && cursorRef.current) {
        q = query(
          dreamsRef,
          // Include both fully-analysed dreams and captured-but-not-deepened
          // dreams so the journal surfaces the "deepen this" CTA next to the
          // dream entry itself, not as a separate buried section.
          where('status', 'in', ['complete', 'captured']),
          orderBy('createdAt', 'desc'),
          startAfter(cursorRef.current),
          limit(PAGE_SIZE),
        );
      } else {
        q = query(
          dreamsRef,
          // Include both fully-analysed dreams and captured-but-not-deepened
          // dreams so the journal surfaces the "deepen this" CTA next to the
          // dream entry itself, not as a separate buried section.
          where('status', 'in', ['complete', 'captured']),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        );
      }

      const snap = await getDocs(q);
      const items = snap.docs.map(mapDocToItem);
      cursorRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setDreams(prev => (reset ? items : [...prev, ...items]));
    } catch (err) {
      console.error('[useDreamList] fetch error:', err);
    } finally {
      inFlightRef.current = false;
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user) {
      doFetch(user.uid, true);
    } else {
      setDreams([]);
      setLoading(false);
    }
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public actions ───────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    if (user && hasMore && !loadingMore) doFetch(user.uid, false);
  }, [user?.uid, hasMore, loadingMore]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    if (user) doFetch(user.uid, true);
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  // ── Client-side filtering ───────────────────────────────────────────────────

  const filteredDreams = useMemo(() => {
    const cutoff = cutoffDateForRange(filters.dateRange);

    return dreams.filter(d => {
      if (
        filters.emotion &&
        d.dominant_emotion.toLowerCase() !== filters.emotion.toLowerCase()
      )
        return false;

      if (
        filters.archetype &&
        d.dominant_archetype.toLowerCase() !== filters.archetype.toLowerCase()
      )
        return false;

      if (cutoff && d.date < cutoff) return false;

      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const inTitle = (d.dream_title ?? '').toLowerCase().includes(q);
        const inPreview = d.transcriptionPreview.toLowerCase().includes(q);
        const inEmotion = d.dominant_emotion.toLowerCase().includes(q);
        if (!inTitle && !inPreview && !inEmotion) return false;
      }

      return true;
    });
  }, [dreams, filters]);

  // ── Derived lists for filter chips ──────────────────────────────────────────

  const uniqueEmotions = useMemo(
    () => [...new Set(dreams.map(d => d.dominant_emotion).filter(Boolean))],
    [dreams],
  );

  const uniqueArchetypes = useMemo(
    () =>
      [...new Set(dreams.map(d => d.dominant_archetype).filter(Boolean))].slice(
        0,
        6,
      ),
    [dreams],
  );

  const hasActiveFilters =
    filters.emotion !== null ||
    filters.archetype !== null ||
    filters.dateRange !== null ||
    filters.searchQuery !== '';

  return {
    dreams: filteredDreams,
    loading,
    loadingMore,
    hasMore,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    uniqueEmotions,
    uniqueArchetypes,
    loadMore,
    refresh,
  };
}
