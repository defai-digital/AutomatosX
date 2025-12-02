/**
 * Agent Selector - Keyword-based agent auto-selection
 *
 * v11.1.0: Extracted from suggest.ts for reuse in ax run auto-selection.
 *
 * Uses keyword matching and intent scoring to select the best agent for a task.
 * Falls back to "standard" agent when no clear match is found.
 *
 * @module agents/agent-selector
 * @since v11.1.0
 */

import type { AgentProfile } from '../types/agent.js';
import type { ProfileLoader } from './profile-loader.js';
import { logger } from '../utils/logger.js';

/**
 * Agent selection result
 */
export interface AgentSelectionResult {
  /** Selected agent name */
  agent: string;
  /** Agent display name */
  displayName: string;
  /** Agent role */
  role: string;
  /** Selection score (higher = better match) */
  score: number;
  /** Confidence level based on score */
  confidence: 'high' | 'medium' | 'low';
  /** Reasons for selection */
  rationale: string[];
  /** Alternative agents considered */
  alternatives: Array<{ agent: string; score: number }>;
  /** Whether fallback to standard was used */
  usedFallback: boolean;
}

/**
 * Score an agent based on task keywords and selection metadata
 *
 * Scoring weights:
 * - Primary intents: +10 points (2+ keyword match), +5 points (1 keyword)
 * - Secondary signals: +5 points each
 * - Ability keywords: +3 points each
 * - Negative intents: -20 points
 * - Redirect rules: -15 points
 *
 * @param task - Task description
 * @param profile - Agent profile
 * @returns Score (non-negative)
 */
export function scoreAgent(task: string, profile: AgentProfile): number {
  let score = 0;
  const taskLower = task.toLowerCase();

  // Primary intents matching (weight: 10 points each)
  if (profile.selectionMetadata?.primaryIntents) {
    for (const intent of profile.selectionMetadata.primaryIntents) {
      const intentKeywords = intent.toLowerCase().split(/\s+/);
      const matchedKeywords = intentKeywords.filter(keyword =>
        taskLower.includes(keyword) && keyword.length > 3
      );
      if (matchedKeywords.length >= 2) {
        score += 10;
      } else if (matchedKeywords.length === 1) {
        score += 5;
      }
    }
  }

  // Secondary signals matching (weight: 5 points each)
  if (profile.selectionMetadata?.secondarySignals) {
    for (const signal of profile.selectionMetadata.secondarySignals) {
      if (taskLower.includes(signal.toLowerCase())) {
        score += 5;
      }
    }
  }

  // Negative intents penalty (weight: -20 points)
  if (profile.selectionMetadata?.negativeIntents) {
    for (const negative of profile.selectionMetadata.negativeIntents) {
      // Extract keywords from negative intent (before parentheses)
      const keywords = negative.split('(')[0]?.toLowerCase() || '';
      const negativeKeywords = keywords.split(/\s+/).filter(k => k.length > 3);
      const matchedNegative = negativeKeywords.filter(keyword =>
        taskLower.includes(keyword)
      );
      if (matchedNegative.length >= 2) {
        score -= 20;
      }
    }
  }

  // Redirect rules penalty (weight: -15 points)
  if (profile.selectionMetadata?.redirectWhen) {
    for (const rule of profile.selectionMetadata.redirectWhen) {
      try {
        const regex = new RegExp(rule.phrase, 'i');
        if (regex.test(task)) {
          score -= 15;
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  // Ability keywords matching (weight: 3 points each)
  if (profile.abilitySelection?.taskBased) {
    for (const keyword of Object.keys(profile.abilitySelection.taskBased)) {
      if (taskLower.includes(keyword.toLowerCase())) {
        score += 3;
      }
    }
  }

  return Math.max(0, score); // Ensure non-negative
}

/**
 * Build rationale explanation for agent selection
 */
export function buildRationale(task: string, profile: AgentProfile): string[] {
  const rationale: string[] = [];
  const taskLower = task.toLowerCase();

  // Check primary intents
  if (profile.selectionMetadata?.primaryIntents) {
    const matchedIntents = profile.selectionMetadata.primaryIntents.filter(intent => {
      const keywords = intent.toLowerCase().split(/\s+/);
      return keywords.some(k => taskLower.includes(k) && k.length > 3);
    });
    if (matchedIntents.length > 0) {
      rationale.push(`Matches: ${matchedIntents.slice(0, 2).join(', ')}`);
    }
  }

  // Check secondary signals
  if (profile.selectionMetadata?.secondarySignals) {
    const matchedSignals = profile.selectionMetadata.secondarySignals.filter(signal =>
      taskLower.includes(signal.toLowerCase())
    );
    if (matchedSignals.length > 0) {
      rationale.push(`Keywords: ${matchedSignals.slice(0, 3).join(', ')}`);
    }
  }

  // Check ability keywords
  if (profile.abilitySelection?.taskBased) {
    const matchedAbilities = Object.keys(profile.abilitySelection.taskBased).filter(
      keyword => taskLower.includes(keyword.toLowerCase())
    );
    if (matchedAbilities.length > 0) {
      rationale.push(`Abilities: ${matchedAbilities.slice(0, 2).join(', ')}`);
    }
  }

  if (rationale.length === 0) {
    rationale.push('General capability match');
  }

  return rationale;
}

/**
 * Determine confidence level based on score
 */
export function getConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 30) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

/**
 * Minimum score threshold for auto-selection
 * Below this, we fall back to "standard" agent
 */
const MIN_SELECTION_SCORE = 5;

/**
 * Default fallback agent when no good match is found
 */
const FALLBACK_AGENT = 'standard';

/**
 * Agent Selector
 *
 * Selects the best agent for a task based on keyword matching.
 * Used by `ax run` for auto-selection when no agent is specified.
 *
 * @example
 * ```typescript
 * const selector = new AgentSelector(profileLoader);
 * const result = await selector.selectAgent('implement user authentication');
 * console.log(`Selected: ${result.agent} (${result.confidence} confidence)`);
 * ```
 */
export class AgentSelector {
  private profileLoader: ProfileLoader;

  constructor(profileLoader: ProfileLoader) {
    this.profileLoader = profileLoader;
  }

  /**
   * Select the best agent for a task
   *
   * @param task - Task description
   * @returns Selection result with agent, score, confidence, and rationale
   */
  async selectAgent(task: string): Promise<AgentSelectionResult> {
    logger.debug('[AgentSelector] Selecting agent for task', {
      taskPreview: task.substring(0, 100)
    });

    // Load all agent profiles
    const agentNames = await this.profileLoader.listProfiles();

    if (agentNames.length === 0) {
      logger.warn('[AgentSelector] No agents found, using fallback');
      return this.createFallbackResult(task);
    }

    // Score each agent
    const scoredAgents: Array<{
      name: string;
      profile: AgentProfile;
      score: number;
    }> = [];

    for (const name of agentNames) {
      try {
        const profile = await this.profileLoader.loadProfile(name);
        const score = scoreAgent(task, profile);
        scoredAgents.push({ name, profile, score });
      } catch (error) {
        logger.debug(`[AgentSelector] Failed to load profile: ${name}`, { error });
      }
    }

    if (scoredAgents.length === 0) {
      logger.warn('[AgentSelector] Failed to load any profiles, using fallback');
      return this.createFallbackResult(task);
    }

    // Sort by score (descending)
    scoredAgents.sort((a, b) => b.score - a.score);

    const best = scoredAgents[0]!;
    const alternatives = scoredAgents.slice(1, 4).map(a => ({
      agent: a.name,
      score: a.score
    }));

    // Check if score is below threshold
    if (best.score < MIN_SELECTION_SCORE) {
      logger.info('[AgentSelector] Best score below threshold, using fallback', {
        bestAgent: best.name,
        bestScore: best.score,
        threshold: MIN_SELECTION_SCORE
      });

      // Try to find "standard" agent
      const standardAgent = scoredAgents.find(a => a.name === FALLBACK_AGENT);
      if (standardAgent) {
        return {
          agent: standardAgent.name,
          displayName: standardAgent.profile.displayName || standardAgent.name,
          role: standardAgent.profile.role,
          score: standardAgent.score,
          confidence: 'low',
          rationale: ['No strong match found, using general-purpose agent'],
          alternatives: scoredAgents
            .filter(a => a.name !== FALLBACK_AGENT)
            .slice(0, 3)
            .map(a => ({ agent: a.name, score: a.score })),
          usedFallback: true
        };
      }

      // If no standard agent, use best anyway with warning
      return {
        agent: best.name,
        displayName: best.profile.displayName || best.name,
        role: best.profile.role,
        score: best.score,
        confidence: 'low',
        rationale: ['Low confidence match - consider specifying agent explicitly'],
        alternatives,
        usedFallback: false
      };
    }

    // Good match found
    const rationale = buildRationale(task, best.profile);
    const confidence = getConfidence(best.score);

    logger.info('[AgentSelector] Agent selected', {
      agent: best.name,
      score: best.score,
      confidence,
      rationale
    });

    return {
      agent: best.name,
      displayName: best.profile.displayName || best.name,
      role: best.profile.role,
      score: best.score,
      confidence,
      rationale,
      alternatives,
      usedFallback: false
    };
  }

  /**
   * Create a fallback result when no agents are available
   */
  private async createFallbackResult(task: string): Promise<AgentSelectionResult> {
    // Try to load standard agent profile
    try {
      const profile = await this.profileLoader.loadProfile(FALLBACK_AGENT);
      return {
        agent: FALLBACK_AGENT,
        displayName: profile.displayName || FALLBACK_AGENT,
        role: profile.role,
        score: 0,
        confidence: 'low',
        rationale: ['No agents available, using fallback'],
        alternatives: [],
        usedFallback: true
      };
    } catch {
      // No standard agent either
      return {
        agent: FALLBACK_AGENT,
        displayName: 'Standard',
        role: 'General-purpose agent',
        score: 0,
        confidence: 'low',
        rationale: ['No agents available'],
        alternatives: [],
        usedFallback: true
      };
    }
  }
}
