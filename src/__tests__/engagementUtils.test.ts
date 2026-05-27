import { computeBreakdown, getLevelConfig, computeLevelProgress } from '../utils/engagementUtils';
import { LEVEL_CONFIGS } from '../types';

// ─── computeBreakdown ────────────────────────────────────────────────────────

describe('computeBreakdown', () => {
  it('returns all zeros for zero inputs', () => {
    const breakdown = computeBreakdown(0, 0, 0, 0);
    expect(breakdown).toEqual({ morningScore: 0, nightScore: 0, dreamsScore: 0, qualityScore: 0 });
  });

  it('caps morningScore at 40 (30+ day streak)', () => {
    const breakdown = computeBreakdown(60, 0, 0, 0);
    expect(breakdown.morningScore).toBe(40);
  });

  it('caps nightScore at 30 (30+ day streak)', () => {
    const breakdown = computeBreakdown(0, 60, 0, 0);
    expect(breakdown.nightScore).toBe(30);
  });

  it('caps dreamsScore at 20 (50+ dreams)', () => {
    const breakdown = computeBreakdown(0, 0, 100, 0);
    expect(breakdown.dreamsScore).toBe(20);
  });

  it('caps qualityScore at 10', () => {
    // With 10 dreams, maxAnswered = 30; giving 30 answered = 100%
    const breakdown = computeBreakdown(0, 0, 10, 30);
    expect(breakdown.qualityScore).toBe(10);
  });

  it('does not divide by zero when totalDreams is 0', () => {
    expect(() => computeBreakdown(0, 0, 0, 999)).not.toThrow();
    // qualityScore still capped at 10
    expect(computeBreakdown(0, 0, 0, 999).qualityScore).toBe(10);
  });

  it('returns max total of 100 at full engagement', () => {
    const { morningScore, nightScore, dreamsScore, qualityScore } =
      computeBreakdown(30, 30, 50, 150);
    expect(morningScore + nightScore + dreamsScore + qualityScore).toBe(100);
  });

  it('rounds scores to integers', () => {
    // 1 day morning streak: round(1/30 * 40) = round(1.33) = 1
    const breakdown = computeBreakdown(1, 0, 0, 0);
    expect(Number.isInteger(breakdown.morningScore)).toBe(true);
    expect(Number.isInteger(breakdown.nightScore)).toBe(true);
    expect(Number.isInteger(breakdown.dreamsScore)).toBe(true);
    expect(Number.isInteger(breakdown.qualityScore)).toBe(true);
  });

  it('calculates proportional scores correctly (15d morning, 15d night, 25 dreams)', () => {
    const breakdown = computeBreakdown(15, 15, 25, 0);
    // morning: round(15/30 * 40) = round(20) = 20
    expect(breakdown.morningScore).toBe(20);
    // night: round(15/30 * 30) = round(15) = 15
    expect(breakdown.nightScore).toBe(15);
    // dreams: round(25/50 * 20) = round(10) = 10
    expect(breakdown.dreamsScore).toBe(10);
    expect(breakdown.qualityScore).toBe(0);
  });

  it('qualityScore uses totalDreams-relative max (more dreams = harder to max quality)', () => {
    // 1 dream → maxAnswered = 3; 3 answered → qualityScore = 10
    const few = computeBreakdown(0, 0, 1, 3);
    // 10 dreams → maxAnswered = 30; 3 answered → round(3/30 * 10) = 1
    const many = computeBreakdown(0, 0, 10, 3);
    expect(few.qualityScore).toBe(10);
    expect(many.qualityScore).toBe(1);
  });
});

// ─── getLevelConfig ──────────────────────────────────────────────────────────

describe('getLevelConfig', () => {
  const levelCases: Array<[number, string]> = [
    [0,   'novato'],
    [1,   'novato'],
    [6,   'novato'],
    [7,   'explorador'],
    [20,  'explorador'],
    [21,  'arquitecto'],
    [49,  'arquitecto'],
    [50,  'oneironaut'],
    [100, 'oneironaut'],
    [999, 'oneironaut'],
  ];

  test.each(levelCases)('%i dreams → level "%s"', (dreams, expectedKey) => {
    const config = getLevelConfig(dreams);
    expect(config.key).toBe(expectedKey);
  });

  it('always returns a LevelConfig (never undefined)', () => {
    expect(getLevelConfig(0)).toBeDefined();
    expect(getLevelConfig(0).label).toBeTruthy();
  });

  it('returns the highest qualifying level (not the first match)', () => {
    // 21 dreams qualifies for both novato (>=0), explorador (>=7), arquitecto (>=21)
    // Should return arquitecto
    const config = getLevelConfig(21);
    expect(config.key).toBe('arquitecto');
  });

  it('config objects have all required fields', () => {
    const config = getLevelConfig(50);
    expect(config.key).toBeTruthy();
    expect(config.label).toBeTruthy();
    expect(config.icon).toBeTruthy();
    expect(config.color).toMatch(/^#/);
    expect(typeof config.minDreams).toBe('number');
    expect(Array.isArray(config.unlocks)).toBe(true);
  });
});

// ─── computeLevelProgress ────────────────────────────────────────────────────

describe('computeLevelProgress', () => {
  const novato     = LEVEL_CONFIGS[0]; // minDreams: 0
  const explorador = LEVEL_CONFIGS[1]; // minDreams: 7
  const arquitecto = LEVEL_CONFIGS[2]; // minDreams: 21
  const oneironaut = LEVEL_CONFIGS[3]; // minDreams: 50 (no upper cap)

  it('returns progress=1 and dreamsToNext=0 when at max level', () => {
    const result = computeLevelProgress(100, oneironaut, null);
    expect(result.progress).toBe(1);
    expect(result.dreamsToNext).toBe(0);
  });

  it('returns progress=0 at the start of a level', () => {
    // 0 dreams into novato (0 done out of 7 range)
    const result = computeLevelProgress(0, novato, explorador);
    expect(result.progress).toBe(0);
    expect(result.dreamsToNext).toBe(7);
  });

  it('returns progress=0.5 at the midpoint of a level', () => {
    // novato range: 0–7 (7 range). At 3 dreams: 3/7 ≈ 0.43... wait
    // Actually novato minDreams=0, explorador minDreams=7 → range=7
    // At 3 dreams done=3, progress=3/7≈0.43
    // Let me use explorador→arquitecto: range=14, at 7 done = 0.5
    const result = computeLevelProgress(14, explorador, arquitecto);
    expect(result.progress).toBeCloseTo(0.5, 5);
    expect(result.dreamsToNext).toBe(7);
  });

  it('caps progress at 1 (never exceeds next level threshold)', () => {
    // Edge case: passing in wrong dreams count > nextLevel.minDreams
    const result = computeLevelProgress(100, novato, explorador);
    expect(result.progress).toBe(1);
  });

  it('dreamsToNext is never negative', () => {
    const result = computeLevelProgress(50, explorador, arquitecto);
    // Already past arquitecto threshold
    expect(result.dreamsToNext).toBeGreaterThanOrEqual(0);
  });

  it('calculates correct dreamsToNext approaching a level boundary', () => {
    // Need 50 for oneironaut, have 42 → 8 more
    const result = computeLevelProgress(42, arquitecto, oneironaut);
    expect(result.dreamsToNext).toBe(8);
  });
});

// ─── Integration: full clarity snapshot ──────────────────────────────────────

describe('Clarity Index integration', () => {
  it('matches expected values for a typical mid-engagement user', () => {
    // 10d morning, 5d night, 15 dreams, 30 answered questions
    const breakdown = computeBreakdown(10, 5, 15, 30);
    const total = breakdown.morningScore + breakdown.nightScore + breakdown.dreamsScore + breakdown.qualityScore;

    // morning: round(10/30 * 40) = round(13.33) = 13
    expect(breakdown.morningScore).toBe(13);
    // night: round(5/30 * 30) = round(5) = 5
    expect(breakdown.nightScore).toBe(5);
    // dreams: round(15/50 * 20) = round(6) = 6
    expect(breakdown.dreamsScore).toBe(6);
    // maxAnswered = 15*3 = 45; quality: round(30/45 * 10) = round(6.67) = 7
    expect(breakdown.qualityScore).toBe(7);
    expect(total).toBe(31);
  });

  it('level unlocks at exactly the right dream counts', () => {
    expect(getLevelConfig(6).key).toBe('novato');
    expect(getLevelConfig(7).key).toBe('explorador');
    expect(getLevelConfig(20).key).toBe('explorador');
    expect(getLevelConfig(21).key).toBe('arquitecto');
    expect(getLevelConfig(49).key).toBe('arquitecto');
    expect(getLevelConfig(50).key).toBe('oneironaut');
  });
});
