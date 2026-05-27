import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';
import { NarrativeThreadsDoc, PortraitDoc } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsightsState {
  narrativeThreads: NarrativeThreadsDoc | null;
  portrait: PortraitDoc | null;
  loadingThreads: boolean;
  loadingPortrait: boolean;
  generatingPortrait: boolean;
  portraitError: string | null;
  generatePortrait: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInsights(): InsightsState {
  const { user } = useAuth();
  const [narrativeThreads, setNarrativeThreads] = useState<NarrativeThreadsDoc | null>(null);
  const [portrait, setPortrait] = useState<PortraitDoc | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingPortrait, setLoadingPortrait] = useState(true);
  const [generatingPortrait, setGeneratingPortrait] = useState(false);
  const [portraitError, setPortraitError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoadingThreads(false);
      setLoadingPortrait(false);
      return;
    }

    const threadsRef = doc(db, 'users', user.uid, 'insights', 'narrativeThreads');
    const portraitRef = doc(db, 'users', user.uid, 'insights', 'portrait');

    const unsubThreads = onSnapshot(threadsRef, snap => {
      setNarrativeThreads(
        snap.exists() ? (snap.data() as NarrativeThreadsDoc) : null,
      );
      setLoadingThreads(false);
    });

    const unsubPortrait = onSnapshot(portraitRef, snap => {
      setPortrait(snap.exists() ? (snap.data() as PortraitDoc) : null);
      setLoadingPortrait(false);
    });

    return () => {
      unsubThreads();
      unsubPortrait();
    };
  }, [user?.uid]);

  const generatePortrait = async () => {
    if (!user || generatingPortrait) return;
    setGeneratingPortrait(true);
    setPortraitError(null);

    try {
      const fns = getFunctions();
      const callable = httpsCallable(fns, 'generatePortrait');
      await callable({});
      // Portrait is updated via the onSnapshot listener above
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al generar el retrato. Inténtalo de nuevo.';
      setPortraitError(msg);
    } finally {
      setGeneratingPortrait(false);
    }
  };

  return {
    narrativeThreads,
    portrait,
    loadingThreads,
    loadingPortrait,
    generatingPortrait,
    portraitError,
    generatePortrait,
  };
}
