import {
  daysBetween,
  isoWeekString,
  processStreak,
  computeClarityIndex,
  levelForDreams,
  getTodayInZone,
} from '../streakUtils';

// ─── daysBetween ──────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns null when both dates are empty', () => {
    expect(daysBetween('', '')).toBeNull();
  });

  it('returns null when first date is empty', () => {
    expect(daysBetween('', '2026-04-10')).toBeNull();
  });

  it('returns null when second date is empty', () => {
    expect(daysBetween('2026-04-10', '')).toBeNull();
  });

  it('returns 0 for the same date', () => {
    expect(daysBetween('2026-04-10', '2026-04-10')).toBe(0);
  });

  it('returns 1 for consecutive days', () => {
    expect(daysBetween('2026-04-09', '2026-04-10')).toBe(1);
  });

  it('returns 2 for two days apart', () => {
    expect(daysBetween('2026-04-08', '2026-04-10')).toBe(2);
  });

  it('returns negative for reversed dates', () => {
    expect(daysBetween('2026-04-10', '2026-04-08')).toBe(-2);
  });

  it('handles month boundary correctly (Mar→Apr)', () => {
    expect(daysBetween('2026-03-31', '2026-04-01')).toBe(1);
  });

  it('handles year boundary correctly (Dec→Jan)', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });

  it('handles leap-year day correctly (Feb 28 → Mar 1 in leap year)', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // Feb 29 exists in 2024
  });

  it('handles non-leap-year Feb correctly', () => {
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1); // No Feb 29 in 2025
  });
});

// ─── isoWeekString ────────────────────────────────────────────────────────────

describe('isoWeekString', () => {
  it('returns format YYYY-WNN', () => {
    expect(isoWeekString(new Date('2026-04-10'))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('Mon–Sun of same ISO week produce identical string', () => {
    // Week 15 of 2026: Mon Apr 6 – Sun Apr 12
    const monday = isoWeekString(new Date('2026-04-06'));
    const sunday = isoWeekString(new Date('2026-04-12'));
    expect(monday).toBe(sunday);
    expect(monday).toBe('2026-W15');
  });

  it('Sun and next Mon are in different ISO weeks', () => {
    const sunday = isoWeekString(new Date('2026-04-05')); // W14
    const monday = isoWeekString(new Date('2026-04-06')); // W15
    expect(sunday).not.toBe(monday);
  });

  it('Jan 1 of years straddling week boundaries works correctly', () => {
    // ISO 2015-W01 starts on Dec 29 2014
    const dec29 = isoWeekString(new Date('2014-12-29'));
    const jan4  = isoWeekString(new Date('2015-01-04'));
    expect(dec29).toBe(jan4);
    expect(dec29).toBe('2015-W01');
  });
});

// ─── processStreak ────────────────────────────────────────────────────────────

describe('processStreak', () => {
  // Fixed week so tests don't depend on the actual current date
  const WEEK = '2026-W15';

  const BASE: Parameters<typeof processStreak>[0] = {
    current: 5,
    longest: 5,
    lastDate: '2026-04-09',
    freezeAvailable: true,
    lastFreezeResetWeek: WEEK,
    today: '2026-04-10',
  };

  it('increments streak on a consecutive day', () => {
    const r = processStreak(BASE, WEEK);
    expect(r.current).toBe(6);
    expect(r.longest).toBe(6);
    expect(r.lastDate).toBe('2026-04-10');
    expect(r.streakReset).toBe(false);
    expect(r.freezeUsed).toBe(false);
  });

  it('does not change streak when activity already recorded today', () => {
    const r = processStreak({ ...BASE, lastDate: '2026-04-10', today: '2026-04-10' }, WEEK);
    expect(r.current).toBe(5);
    expect(r.lastDate).toBe('2026-04-10');
    expect(r.streakReset).toBe(false);
  });

  it('starts streak at 1 on first ever activity (empty lastDate)', () => {
    const r = processStreak({ ...BASE, lastDate: '', current: 0 }, WEEK);
    expect(r.current).toBe(1);
    expect(r.streakReset).toBe(false);
  });

  it('consumes freeze when exactly 1 day was missed', () => {
    // lastDate = Apr 8, today = Apr 10 → diff = 2
    const r = processStreak({ ...BASE, lastDate: '2026-04-08', freezeAvailable: true }, WEEK);
    expect(r.current).toBe(6);
    expect(r.freezeAvailable).toBe(false);
    expect(r.freezeUsed).toBe(true);
    expect(r.streakReset).toBe(false);
  });

  it('resets streak when 1 day missed but freeze not available', () => {
    const r = processStreak(
      { ...BASE, lastDate: '2026-04-08', freezeAvailable: false },
      WEEK,
    );
    expect(r.current).toBe(1);
    expect(r.streakReset).toBe(true);
    expect(r.freezeUsed).toBe(false);
  });

  it('resets streak when 2+ days missed even with freeze available', () => {
    // lastDate = Apr 7, today = Apr 10 → diff = 3
    const r = processStreak({ ...BASE, lastDate: '2026-04-07', freezeAvailable: true }, WEEK);
    expect(r.current).toBe(1);
    expect(r.streakReset).toBe(true);
  });

  it('updates longest streak when current exceeds it', () => {
    const r = processStreak({ ...BASE, current: 10, longest: 10 }, WEEK);
    expect(r.longest).toBe(11);
    expect(r.current).toBe(11);
  });

  it('never decreases longest streak after a reset', () => {
    const r = processStreak(
      { ...BASE, current: 3, longest: 20, lastDate: '2026-04-07' },
      WEEK,
    );
    expect(r.streakReset).toBe(true);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(20); // unchanged
  });

  it('regenerates freeze when a new ISO week has started', () => {
    // freeze was consumed last week; this week it should regenerate
    const r = processStreak(
      { ...BASE, freezeAvailable: false, lastFreezeResetWeek: '2026-W14' },
      '2026-W15', // new week
    );
    // streak is consecutive → freeze not consumed, but it should have been regenerated
    expect(r.freezeAvailable).toBe(true);
    expect(r.lastFreezeResetWeek).toBe('2026-W15');
  });

  it('does NOT regenerate freeze in the same ISO week', () => {
    // freeze already consumed this week, missed 1 day → streak resets
    const r = processStreak(
      { ...BASE, lastDate: '2026-04-08', freezeAvailable: false, lastFreezeResetWeek: WEEK },
      WEEK,
    );
    expect(r.freezeAvailable).toBe(false);
    expect(r.streakReset).toBe(true);
  });

  it('freeze regenerated at new week + missed day = freeze consumed (not reset)', () => {
    // A new week started, so freeze regenerates. Missed exactly 1 day → freeze used.
    const r = processStreak(
      {
        ...BASE,
        lastDate: '2026-04-08', // 2 days ago → diff = 2
        freezeAvailable: false,
        lastFreezeResetWeek: '2026-W14', // previous week
      },
      '2026-W15',
    );
    // freeze regenerated first, then consumed
    expect(r.current).toBe(6);
    expect(r.freezeAvailable).toBe(false);
    expect(r.freezeUsed).toBe(true);
    expect(r.streakReset).toBe(false);
  });

  it('handles timezone edge: consecutive across midnight', () => {
    const r = processStreak(
      { ...BASE, lastDate: '2026-03-31', today: '2026-04-01' },
      WEEK,
    );
    expect(r.current).toBe(6);
    expect(r.streakReset).toBe(false);
  });
});

// ─── computeClarityIndex ──────────────────────────────────────────────────────

describe('computeClarityIndex', () => {
  it('returns 0 for all-zero inputs', () => {
    expect(computeClarityIndex(0, 0, 0, 0)).toBe(0);
  });

  it('returns 100 for full engagement', () => {
    // 30+ morning (→40) + 30+ night (→30) + 50+ dreams (→20) + enough answers (→10)
    expect(computeClarityIndex(30, 30, 50, 150)).toBe(100);
  });

  it('caps morning score at 40 (streak > 30)', () => {
    expect(computeClarityIndex(60, 0, 0, 0)).toBe(40);
  });

  it('caps night score at 30 (streak > 30)', () => {
    expect(computeClarityIndex(0, 60, 0, 0)).toBe(30);
  });

  it('caps dreams score at 20 (> 50 dreams)', () => {
    expect(computeClarityIndex(0, 0, 100, 0)).toBe(20);
  });

  it('does not divide by zero when totalDreams is 0', () => {
    // maxAnswered = max(0*3, 1) = 1; even with huge answered count, quality capped at 10
    expect(() => computeClarityIndex(0, 0, 0, 999)).not.toThrow();
    expect(computeClarityIndex(0, 0, 0, 999)).toBe(10);
  });

  it('calculates partial scores correctly (15 morning, 15 night, 25 dreams, 0 answered)', () => {
    // morning: round(15/30 * 40) = 20
    // night:   round(15/30 * 30) = 15
    // dreams:  round(25/50 * 20) = 10
    // quality: 0
    expect(computeClarityIndex(15, 15, 25, 0)).toBe(45);
  });

  it('total never exceeds 100', () => {
    const index = computeClarityIndex(999, 999, 999, 999);
    expect(index).toBeLessThanOrEqual(100);
  });

  it('is always non-negative', () => {
    expect(computeClarityIndex(0, 0, 0, 0)).toBeGreaterThanOrEqual(0);
  });
});

// ─── levelForDreams ───────────────────────────────────────────────────────────

describe('levelForDreams', () => {
  const cases: Array<[number, string]> = [
    [0,   'novato'],
    [1,   'novato'],
    [6,   'novato'],
    [7,   'explorador'],   // boundary
    [13,  'explorador'],
    [20,  'explorador'],
    [21,  'arquitecto'],   // boundary
    [35,  'arquitecto'],
    [49,  'arquitecto'],
    [50,  'oneironaut'],   // boundary
    [100, 'oneironaut'],
    [999, 'oneironaut'],
  ];

  test.each(cases)('%i dreams → %s', (dreams, expected) => {
    expect(levelForDreams(dreams)).toBe(expected);
  });
});

// ─── getTodayInZone ───────────────────────────────────────────────────────────

describe('getTodayInZone', () => {
  it('returns a YYYY-MM-DD string for a valid timezone', () => {
    const result = getTodayInZone('America/New_York');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('falls back to ISO date for an invalid timezone', () => {
    const result = getTodayInZone('Invalid/Zone');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a date within 2 days of UTC (timezone offset)', () => {
    const utc   = new Date().toISOString().slice(0, 10);
    const local = getTodayInZone('Pacific/Auckland'); // UTC+13
    // Auckland is at most 1 calendar day ahead of UTC
    const diff  = Math.abs(daysBetween(utc, local) ?? 0);
    expect(diff).toBeLessThanOrEqual(1);
  });
});
