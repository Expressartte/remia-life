// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreakUpdateInput {
  current: number;
  longest: number;
  lastDate: string;
  freezeAvailable: boolean;
  lastFreezeResetWeek: string;
  today: string;
}

export interface StreakUpdateOutput {
  current: number;
  longest: number;
  lastDate: string;
  freezeAvailable: boolean;
  lastFreezeResetWeek: string;
  streakReset: boolean;   // true if streak was broken (no freeze saved it)
  freezeUsed: boolean;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Current date in a given IANA timezone as "YYYY-MM-DD".
 */
export function getTodayInZone(tz: string): string {
  try {
    // en-CA locale produces YYYY-MM-DD naturally
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * ISO week string, e.g. "2026-W15".
 */
export function isoWeekString(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Shift to nearest Thursday to find the ISO week
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Integer days between two "YYYY-MM-DD" strings (b - a).
 * Returns null if either string is empty/missing.
 */
export function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const msPerDay = 86400000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

/**
 * Compute the composite clarity index (0-100).
 */
export function computeClarityIndex(
  morningCurrent: number,
  nightCurrent: number,
  totalDreams: number,
  totalAnsweredQ: number,
): number {
  const morning = Math.min(morningCurrent / 30, 1) * 40;
  const night = Math.min(nightCurrent / 30, 1) * 30;
  const dreams = Math.min(totalDreams / 50, 1) * 20;
  const maxAnswered = Math.max(totalDreams * 3, 1);
  const quality = Math.min(totalAnsweredQ / maxAnswered, 1) * 10;
  return Math.round(morning + night + dreams + quality);
}

/**
 * Level key from dream count.
 */
export function levelForDreams(dreams: number): string {
  if (dreams >= 50) return 'oneironaut';
  if (dreams >= 21) return 'arquitecto';
  if (dreams >= 7) return 'explorador';
  return 'novato';
}

/**
 * Core streak state machine — pure and injectable for testing.
 *
 * @param input       - Current streak state and today's date (YYYY-MM-DD)
 * @param currentWeek - ISO week string for "now"; defaults to actual current week.
 *                      Injectable so tests can control time without mocking Date.
 */
export function processStreak(
  input: StreakUpdateInput,
  currentWeek: string = isoWeekString(new Date()),
): StreakUpdateOutput {
  let { current, longest, lastDate, freezeAvailable } = input;
  let { lastFreezeResetWeek } = input;
  let streakReset = false;
  let freezeUsed = false;

  // Regenerate freeze at start of new ISO week
  if (currentWeek !== lastFreezeResetWeek) {
    freezeAvailable = true;
    lastFreezeResetWeek = currentWeek;
  }

  const diff = daysBetween(lastDate, input.today);

  if (diff === null) {
    // First ever activity
    current = 1;
  } else if (diff === 0) {
    // Already recorded today — no change
  } else if (diff === 1) {
    // Consecutive day
    current += 1;
  } else if (diff === 2 && freezeAvailable) {
    // Missed exactly one day — consume freeze
    current += 1;
    freezeAvailable = false;
    freezeUsed = true;
  } else {
    // Streak broken
    current = 1;
    streakReset = true;
  }

  if (current > longest) longest = current;

  return {
    current,
    longest,
    lastDate: diff === 0 ? lastDate : input.today,
    freezeAvailable,
    lastFreezeResetWeek,
    streakReset,
    freezeUsed,
  };
}
