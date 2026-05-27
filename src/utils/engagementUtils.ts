import { LevelConfig, LEVEL_CONFIGS } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClarityBreakdown {
  morningScore: number;   // 0-40
  nightScore: number;     // 0-30
  dreamsScore: number;    // 0-20
  qualityScore: number;   // 0-10
}

export interface LevelProgress {
  progress: number;       // 0-1 within current level range
  dreamsToNext: number;   // dreams needed to reach next level
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Computes the four-component clarity breakdown from raw engagement numbers.
 * All scores are rounded integers.
 */
export function computeBreakdown(
  morningCurrent: number,
  nightCurrent: number,
  totalDreams: number,
  totalAnsweredQ: number,
): ClarityBreakdown {
  const morningScore = Math.round(Math.min(morningCurrent / 30, 1) * 40);
  const nightScore   = Math.round(Math.min(nightCurrent / 30, 1) * 30);
  const dreamsScore  = Math.round(Math.min(totalDreams / 50, 1) * 20);
  // Avoid division by zero: max(totalDreams * 3, 1) questions expected
  const maxAnswered  = Math.max(totalDreams * 3, 1);
  const qualityScore = Math.round(Math.min(totalAnsweredQ / maxAnswered, 1) * 10);
  return { morningScore, nightScore, dreamsScore, qualityScore };
}

/**
 * Returns the LevelConfig corresponding to the given dream count.
 * Walks the level list in reverse to find the highest qualifying level.
 */
export function getLevelConfig(totalDreams: number): LevelConfig {
  return (
    [...LEVEL_CONFIGS].reverse().find(l => totalDreams >= l.minDreams) ??
    LEVEL_CONFIGS[0]
  );
}

/**
 * Computes progress toward the next level (0-1) and remaining dreams needed.
 */
export function computeLevelProgress(
  totalDreams: number,
  currentLevel: LevelConfig,
  nextLevel: LevelConfig | null,
): LevelProgress {
  if (!nextLevel) return { progress: 1, dreamsToNext: 0 };
  const range = nextLevel.minDreams - currentLevel.minDreams;
  const done  = totalDreams - currentLevel.minDreams;
  return {
    progress:    Math.min(done / range, 1),
    dreamsToNext: Math.max(nextLevel.minDreams - totalDreams, 0),
  };
}
