import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';
import {
  UserDocument,
  LevelConfig,
  LEVEL_CONFIGS,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClarityBreakdown {
  morningScore: number;   // 0-40
  nightScore: number;     // 0-30
  dreamsScore: number;    // 0-20
  qualityScore: number;   // 0-10
}

export interface EngagementState {
  userDoc: UserDocument | null;
  loading: boolean;
  // Clarity
  clarityIndex: number;
  clarityBreakdown: ClarityBreakdown;
  // Level
  currentLevelConfig: LevelConfig;
  nextLevelConfig: LevelConfig | null;
  levelProgress: number;           // 0-1 within current level range
  dreamsToNextLevel: number;       // dreams needed to reach next level
  // Streaks
  morningStreak: number;
  morningLongest: number;
  nightStreak: number;
  nightLongest: number;
  morningFreezeAvailable: boolean;
  nightFreezeAvailable: boolean;
  // Stats
  totalDreams: number;
  totalNightCheckins: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeBreakdown(
  morningCurrent: number,
  nightCurrent: number,
  totalDreams: number,
  totalAnsweredQ: number,
): ClarityBreakdown {
  const morningScore = Math.round(Math.min(morningCurrent / 30, 1) * 40);
  const nightScore = Math.round(Math.min(nightCurrent / 30, 1) * 30);
  const dreamsScore = Math.round(Math.min(totalDreams / 50, 1) * 20);
  const maxAnswered = Math.max(totalDreams * 3, 1);
  const qualityScore = Math.round(Math.min(totalAnsweredQ / maxAnswered, 1) * 10);
  return { morningScore, nightScore, dreamsScore, qualityScore };
}

function getLevelConfig(totalDreams: number): LevelConfig {
  return (
    [...LEVEL_CONFIGS].reverse().find(l => totalDreams >= l.minDreams) ??
    LEVEL_CONFIGS[0]
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEngagement(): EngagementState {
  const { user } = useAuth();
  const [userDoc, setUserDoc] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, snap => {
      setUserDoc(snap.exists() ? (snap.data() as UserDocument) : null);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const totalDreams = userDoc?.profile?.totalDreams ?? 0;
  const totalNightCheckins = userDoc?.profile?.totalNightCheckins ?? 0;
  const totalAnsweredQ = userDoc?.profile?.totalAnsweredQuestions ?? 0;
  const morningStreak = userDoc?.streaks?.morningCurrent ?? 0;
  const morningLongest = userDoc?.streaks?.morningLongest ?? 0;
  const nightStreak = userDoc?.streaks?.nightCurrent ?? 0;
  const nightLongest = userDoc?.streaks?.nightLongest ?? 0;
  const morningFreezeAvailable = userDoc?.streaks?.morningStreakFreezeAvailable ?? false;
  const nightFreezeAvailable = userDoc?.streaks?.nightStreakFreezeAvailable ?? false;

  const clarityBreakdown = computeBreakdown(
    morningStreak,
    nightStreak,
    totalDreams,
    totalAnsweredQ,
  );
  const clarityIndex =
    userDoc?.profile?.clarityIndex ??
    clarityBreakdown.morningScore +
      clarityBreakdown.nightScore +
      clarityBreakdown.dreamsScore +
      clarityBreakdown.qualityScore;

  const currentLevelConfig = getLevelConfig(totalDreams);
  const currentIdx = LEVEL_CONFIGS.indexOf(currentLevelConfig);
  const nextLevelConfig =
    currentIdx < LEVEL_CONFIGS.length - 1 ? LEVEL_CONFIGS[currentIdx + 1] : null;

  let levelProgress = 0;
  let dreamsToNextLevel = 0;
  if (nextLevelConfig) {
    const range = nextLevelConfig.minDreams - currentLevelConfig.minDreams;
    const done = totalDreams - currentLevelConfig.minDreams;
    levelProgress = Math.min(done / range, 1);
    dreamsToNextLevel = nextLevelConfig.minDreams - totalDreams;
  } else {
    levelProgress = 1;
    dreamsToNextLevel = 0;
  }

  return {
    userDoc,
    loading,
    clarityIndex,
    clarityBreakdown,
    currentLevelConfig,
    nextLevelConfig,
    levelProgress,
    dreamsToNextLevel,
    morningStreak,
    morningLongest,
    nightStreak,
    nightLongest,
    morningFreezeAvailable,
    nightFreezeAvailable,
    totalDreams,
    totalNightCheckins,
  };
}
