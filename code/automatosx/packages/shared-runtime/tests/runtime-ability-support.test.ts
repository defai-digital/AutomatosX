import { describe, expect, it } from 'vitest';
import type { FeedbackEntry } from '@defai.digital/state-store';
import {
  buildFeedbackAdjustment,
  buildFeedbackOverview,
  buildFeedbackStats,
  filterAbilities,
  injectAbilities,
} from '../src/runtime-ability-support.js';

describe('runtime ability support', () => {
  const entries: FeedbackEntry[] = [
    {
      feedbackId: 'fb-1',
      selectedAgent: 'agent-alpha',
      rating: 5,
      feedbackType: 'explicit',
      outcome: 'success',
      taskDescription: 'Review auth flow',
      createdAt: '2026-03-25T12:00:00.000Z',
      durationMs: 1200,
    },
    {
      feedbackId: 'fb-2',
      selectedAgent: 'agent-alpha',
      rating: 3,
      feedbackType: 'explicit',
      outcome: 'mixed',
      taskDescription: 'Review payments',
      createdAt: '2026-03-24T12:00:00.000Z',
      durationMs: 800,
    },
    {
      feedbackId: 'fb-3',
      selectedAgent: 'agent-beta',
      rating: 4,
      feedbackType: 'explicit',
      outcome: 'success',
      taskDescription: 'Review checkout',
      createdAt: '2026-03-23T12:00:00.000Z',
      durationMs: 600,
    },
  ];

  it('builds feedback summaries and bounded adjustments', () => {
    expect(buildFeedbackStats('agent-alpha', entries.filter((entry) => entry.selectedAgent === 'agent-alpha'))).toMatchObject({
      agentId: 'agent-alpha',
      totalFeedback: 2,
      ratingsCount: 2,
      averageRating: 4,
      averageDurationMs: 1000,
      latestOutcome: 'success',
    });

    expect(buildFeedbackOverview(entries)).toMatchObject({
      totalFeedback: 3,
      ratedFeedback: 3,
      agentsWithFeedback: 2,
      averageRating: 4,
    });

    expect(buildFeedbackAdjustment('agent-alpha', entries.filter((entry) => entry.selectedAgent === 'agent-alpha'))).toMatchObject({
      agentId: 'agent-alpha',
      confidence: 0.4,
      averageRating: 4,
      adjustment: 0.1,
      sampleSize: 2,
    });
  });

  it('filters and ranks abilities for injection', () => {
    const abilities = [
      {
        abilityId: 'workflow-first',
        name: 'Workflow First',
        category: 'workflow',
        tags: ['workflow', 'planning', 'orchestration'],
        content: 'Prefer first-class workflows.',
      },
      {
        abilityId: 'code-review',
        name: 'Code Review',
        category: 'review',
        tags: ['review', 'correctness', 'security'],
        content: 'Prioritize concrete findings.',
      },
      {
        abilityId: 'git-hygiene',
        name: 'Git Hygiene',
        category: 'git',
        tags: ['git', 'commit', 'review'],
        content: 'Keep commits scoped.',
      },
    ];

    expect(filterAbilities(abilities, { tags: ['review'] }).map((entry) => entry.abilityId)).toEqual([
      'code-review',
      'git-hygiene',
    ]);

    const injection = injectAbilities(abilities, {
      task: 'Do a review and check correctness issues before commit',
      requiredAbilities: ['git-hygiene'],
      maxAbilities: 2,
      includeMetadata: true,
    });

    expect(injection.abilities.map((entry) => entry.abilityId)).toEqual([
      'git-hygiene',
      'code-review',
    ]);
    expect(injection.content).toContain('## Git Hygiene');
    expect(injection.content).toContain('Tags: git, commit, review');
  });
});
