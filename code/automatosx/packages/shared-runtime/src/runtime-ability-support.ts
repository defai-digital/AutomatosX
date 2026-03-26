import type { FeedbackEntry } from '@defai.digital/state-store';
import type {
  RuntimeAbility,
  RuntimeAbilityInjection,
  RuntimeFeedbackAdjustment,
  RuntimeFeedbackOverview,
  RuntimeFeedbackStats,
} from './runtime-service-types.js';

export function buildFeedbackStats(agentId: string, entries: FeedbackEntry[]): RuntimeFeedbackStats {
  const ratings = entries.flatMap((entry) => typeof entry.rating === 'number' ? [entry.rating] : []);
  const ratingDistribution = {
    '1': ratings.filter((rating) => rating === 1).length,
    '2': ratings.filter((rating) => rating === 2).length,
    '3': ratings.filter((rating) => rating === 3).length,
    '4': ratings.filter((rating) => rating === 4).length,
    '5': ratings.filter((rating) => rating === 5).length,
  };
  const durations = entries.flatMap((entry) => typeof entry.durationMs === 'number' ? [entry.durationMs] : []);
  return {
    agentId,
    totalFeedback: entries.length,
    ratingsCount: ratings.length,
    averageRating: ratings.length > 0 ? roundNumber(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : undefined,
    ratingDistribution,
    averageDurationMs: durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : undefined,
    latestOutcome: entries[0]?.outcome,
  };
}

export function buildFeedbackOverview(entries: FeedbackEntry[]): RuntimeFeedbackOverview {
  const byAgent = new Map<string, FeedbackEntry[]>();
  for (const entry of entries) {
    const list = byAgent.get(entry.selectedAgent) ?? [];
    list.push(entry);
    byAgent.set(entry.selectedAgent, list);
  }

  const topAgents = [...byAgent.entries()]
    .map(([agentId, agentEntries]) => buildFeedbackStats(agentId, agentEntries))
    .sort((left, right) => (right.averageRating ?? 0) - (left.averageRating ?? 0) || right.totalFeedback - left.totalFeedback)
    .slice(0, 5);

  const ratings = entries.flatMap((entry) => typeof entry.rating === 'number' ? [entry.rating] : []);
  return {
    totalFeedback: entries.length,
    ratedFeedback: ratings.length,
    agentsWithFeedback: byAgent.size,
    averageRating: ratings.length > 0 ? roundNumber(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) : undefined,
    topAgents,
  };
}

export function buildFeedbackAdjustment(agentId: string, entries: FeedbackEntry[]): RuntimeFeedbackAdjustment {
  const stats = buildFeedbackStats(agentId, entries);
  const confidence = Math.min(1, stats.ratingsCount / 5);
  const averageRating = stats.averageRating;
  const normalized = averageRating === undefined ? 0 : (averageRating - 3) / 2;
  return {
    agentId,
    adjustment: roundNumber(normalized * 0.5 * confidence),
    confidence: roundNumber(confidence),
    sampleSize: stats.ratingsCount,
    averageRating,
  };
}

export function filterAbilities(
  abilities: RuntimeAbility[],
  options?: { category?: string; tags?: string[] },
): RuntimeAbility[] {
  const tags = normalizeStringArray(options?.tags);
  return abilities.filter((ability) => {
    if (options?.category !== undefined && ability.category !== options.category) {
      return false;
    }
    if (tags.length > 0 && !tags.every((tag) => ability.tags.includes(tag))) {
      return false;
    }
    return true;
  });
}

export function injectAbilities(
  abilities: RuntimeAbility[],
  request: {
    task: string;
    requiredAbilities?: string[];
    category?: string;
    tags?: string[];
    maxAbilities?: number;
    includeMetadata?: boolean;
  },
): RuntimeAbilityInjection {
  const required = new Set(normalizeStringArray(request.requiredAbilities));
  const taskTokens = new Set(tokenizeForMatching(request.task));
  const ranked = filterAbilities(abilities, { category: request.category, tags: request.tags })
    .map((ability) => {
      let score = required.has(ability.abilityId) ? 100 : 0;
      for (const token of taskTokens) {
        if (ability.tags.includes(token)) {
          score += 8;
        }
        if (ability.category === token) {
          score += 4;
        }
        if (ability.name.toLowerCase().includes(token)) {
          score += 2;
        }
        if (ability.content.toLowerCase().includes(token)) {
          score += 1;
        }
      }
      return { ability, score };
    })
    .filter((entry) => entry.score > 0 || required.has(entry.ability.abilityId))
    .sort((left, right) => right.score - left.score || left.ability.name.localeCompare(right.ability.name))
    .slice(0, Math.max(1, request.maxAbilities ?? 3))
    .map((entry) => entry.ability);

  const content = ranked.map((ability) => (
    request.includeMetadata === true
      ? `## ${ability.name}\nCategory: ${ability.category}\nTags: ${ability.tags.join(', ')}\n${ability.content}`
      : ability.content
  )).join('\n\n');

  return {
    task: request.task,
    abilities: ranked,
    content,
  };
}

function normalizeStringArray(values: string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  return Array.from(new Set(values.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0)));
}

function tokenizeForMatching(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_-]+/i)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 2);
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}
