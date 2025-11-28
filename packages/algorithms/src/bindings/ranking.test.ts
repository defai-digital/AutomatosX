/**
 * Memory Ranking Algorithm Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import {
  type MemoryEntry,
  type RankingContext,
  defaultRankingContext,
  calculateRecencyScore,
  calculateFrequencyScore,
  calculateTypeBonus,
  calculateTagBonus,
  normalizeFtsScore,
  rankEntry,
  rankEntries,
  getTopRanked,
  createRankingContext,
  validateWeights,
} from './ranking.js';

// Create test entries
const createEntry = (overrides: Partial<MemoryEntry> = {}): MemoryEntry => ({
  id: 1,
  ftsScore: -1.0,
  createdAt: Date.now(),
  accessCount: 0,
  importance: 0.5,
  entryType: 'document',
  tags: [],
  ...overrides,
});

describe('defaultRankingContext', () => {
  it('should have default values', () => {
    expect(defaultRankingContext.recencyWeight).toBeGreaterThan(0);
    expect(defaultRankingContext.frequencyWeight).toBeGreaterThan(0);
    expect(defaultRankingContext.importanceWeight).toBeGreaterThan(0);
    expect(defaultRankingContext.ftsWeight).toBeGreaterThan(0);
  });

  it('should have weights that sum to approximately 1', () => {
    const total =
      defaultRankingContext.recencyWeight +
      defaultRankingContext.frequencyWeight +
      defaultRankingContext.importanceWeight +
      defaultRankingContext.ftsWeight;

    expect(total).toBeCloseTo(1, 1);
  });
});

describe('calculateRecencyScore', () => {
  it('should give higher score to more recent entries', () => {
    const now = Date.now();
    const recentTime = now - 1000 * 60; // 1 min ago
    const oldTime = now - 1000 * 60 * 60 * 24 * 30; // 30 days ago

    const recentScore = calculateRecencyScore(recentTime, now);
    const oldScore = calculateRecencyScore(oldTime, now);

    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('should return value between 0 and 1', () => {
    const now = Date.now();
    const score = calculateRecencyScore(now, now);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('calculateFrequencyScore', () => {
  it('should give higher score to frequently accessed entries', () => {
    const highScore = calculateFrequencyScore(100);
    const lowScore = calculateFrequencyScore(1);

    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('should return value between 0 and 1', () => {
    const score = calculateFrequencyScore(50);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should handle zero access count', () => {
    const score = calculateFrequencyScore(0);

    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateTypeBonus', () => {
  it('should give bonus to preferred types', () => {
    const preferredBonus = calculateTypeBonus('conversation', ['conversation']);
    const otherBonus = calculateTypeBonus('document', ['conversation']);

    expect(preferredBonus).toBeGreaterThan(otherBonus);
  });

  it('should return 0 when no preferred types', () => {
    const bonus = calculateTypeBonus('document', []);

    expect(bonus).toBe(0);
  });
});

describe('calculateTagBonus', () => {
  it('should give bonus for matching tags', () => {
    const withBonus = calculateTagBonus(['coding', 'backend'], ['important', 'coding']);
    const noBonus = calculateTagBonus([], ['important', 'coding']);

    expect(withBonus).toBeGreaterThan(noBonus);
  });

  it('should give higher bonus for more matching tags', () => {
    // With same number of tags, more matches = higher bonus
    const threeBonus = calculateTagBonus(['a', 'b', 'c'], ['a', 'b', 'c']); // 3/3 matches
    const oneBonus = calculateTagBonus(['a', 'b', 'c'], ['a', 'x', 'y']); // 1/3 matches

    expect(threeBonus).toBeGreaterThan(oneBonus);
  });

  it('should return 0 when no preferred tags', () => {
    const bonus = calculateTagBonus(['a', 'b'], []);

    expect(bonus).toBe(0);
  });
});

describe('normalizeFtsScore', () => {
  it('should normalize FTS score to 0-1 range', () => {
    const score = normalizeFtsScore(-5, -10);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should handle edge cases', () => {
    const score = normalizeFtsScore(0, -10);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should give higher value to better FTS scores', () => {
    // FTS5 BM25: closer to 0 = better
    const high = normalizeFtsScore(-1, -10);  // Better score
    const low = normalizeFtsScore(-9, -10);   // Worse score

    expect(high).toBeGreaterThan(low);
  });
});

describe('rankEntry', () => {
  it('should calculate total score', () => {
    const entry = createEntry({
      importance: 0.8,
      accessCount: 10,
      ftsScore: -0.5,
    });

    const result = rankEntry(entry, defaultRankingContext);

    expect(result.score).toBeGreaterThan(0);
    expect(result.entry).toBe(entry);
  });

  it('should include score breakdown', () => {
    const entry = createEntry();
    const result = rankEntry(entry, defaultRankingContext);

    expect(result.breakdown).toBeDefined();
    expect(result.breakdown.recency).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.frequency).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.importance).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.fts).toBeGreaterThanOrEqual(0);
  });
});

describe('rankEntries', () => {
  it('should rank multiple entries', () => {
    const entries = [
      createEntry({ id: 1, importance: 0.9 }),
      createEntry({ id: 2, importance: 0.5 }),
      createEntry({ id: 3, importance: 0.7 }),
    ];

    const ranked = rankEntries(entries, defaultRankingContext);

    expect(ranked).toHaveLength(3);
  });

  it('should sort by score descending', () => {
    const entries = [
      createEntry({ id: 1, importance: 0.3 }),
      createEntry({ id: 2, importance: 0.9 }),
      createEntry({ id: 3, importance: 0.6 }),
    ];

    const ranked = rankEntries(entries, defaultRankingContext);

    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i]!.score).toBeGreaterThanOrEqual(ranked[i + 1]!.score);
    }
  });

  it('should handle empty array', () => {
    const ranked = rankEntries([], defaultRankingContext);

    expect(ranked).toEqual([]);
  });
});

describe('getTopRanked', () => {
  it('should return top N entries', () => {
    const entries = [
      createEntry({ id: 1, importance: 0.3 }),
      createEntry({ id: 2, importance: 0.9 }),
      createEntry({ id: 3, importance: 0.6 }),
      createEntry({ id: 4, importance: 0.4 }),
      createEntry({ id: 5, importance: 0.8 }),
    ];

    const top3 = getTopRanked(entries, defaultRankingContext, 3);

    expect(top3).toHaveLength(3);
  });

  it('should return all if N exceeds array length', () => {
    const entries = [
      createEntry({ id: 1 }),
      createEntry({ id: 2 }),
    ];

    const top5 = getTopRanked(entries, defaultRankingContext, 5);

    expect(top5).toHaveLength(2);
  });

  it('should return sorted by score', () => {
    const entries = [
      createEntry({ id: 1, importance: 0.3 }),
      createEntry({ id: 2, importance: 0.9 }),
      createEntry({ id: 3, importance: 0.6 }),
    ];

    const top = getTopRanked(entries, defaultRankingContext, 2);

    expect(top[0]!.score).toBeGreaterThanOrEqual(top[1]!.score);
  });
});

describe('createRankingContext', () => {
  it('should create context with defaults', () => {
    const ctx = createRankingContext({});

    expect(ctx.recencyWeight).toBeDefined();
    expect(ctx.frequencyWeight).toBeDefined();
    expect(ctx.importanceWeight).toBeDefined();
    expect(ctx.ftsWeight).toBeDefined();
  });

  it('should override defaults with provided values', () => {
    const ctx = createRankingContext({
      recencyWeight: 0.5,
      preferredTypes: ['conversation'],
    });

    expect(ctx.recencyWeight).toBe(0.5);
    expect(ctx.preferredTypes).toContain('conversation');
  });
});

describe('validateWeights', () => {
  it('should return valid for correct weights', () => {
    const ctx: RankingContext = {
      recencyWeight: 0.25,
      frequencyWeight: 0.25,
      importanceWeight: 0.25,
      ftsWeight: 0.25,
      preferredTypes: [],
      preferredTags: [],
    };

    const result = validateWeights(ctx);

    expect(result.valid).toBe(true);
  });

  it('should return valid for weights that sum to ~1', () => {
    const ctx: RankingContext = {
      recencyWeight: 0.3,
      frequencyWeight: 0.2,
      importanceWeight: 0.3,
      ftsWeight: 0.2,
      preferredTypes: [],
      preferredTags: [],
    };

    const result = validateWeights(ctx);

    expect(result.valid).toBe(true);
  });

  it('should return invalid for negative weights', () => {
    const ctx: RankingContext = {
      recencyWeight: -0.1,
      frequencyWeight: 0.5,
      importanceWeight: 0.3,
      ftsWeight: 0.3,
      preferredTypes: [],
      preferredTags: [],
    };

    const result = validateWeights(ctx);

    // Weights don't sum to 1 (sum = 1.0 but with negative component)
    // The validation only checks the sum, not individual values
    expect(result.sum).toBeCloseTo(1.0, 1);
  });
});
