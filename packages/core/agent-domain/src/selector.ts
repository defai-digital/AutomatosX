/**
 * Agent Selector
 *
 * Selects the best agent for a given task based on keywords,
 * capabilities, context, and example tasks.
 *
 * Invariants:
 * - INV-AGT-SEL-001: Selection is deterministic (same input = same output)
 * - INV-AGT-SEL-002: Confidence scores must be between 0 and 1
 * - INV-AGT-SEL-003: Results must be sorted by confidence descending
 * - INV-AGT-SEL-004: Always returns at least one result (fallback to 'standard')
 * - INV-AGT-SEL-005: exampleTasks boost confidence when matched
 * - INV-AGT-SEL-006: notForTasks reduce confidence when matched
 */

import type { AgentProfile } from '@defai.digital/contracts';
import type {
  AgentRegistry,
  AgentSelector,
  AgentSelectionResult,
  AgentSelectionContext,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default agent ID when no match is found
 */
const DEFAULT_AGENT_ID = 'standard';

/**
 * Minimum confidence threshold for selection
 */
const MIN_CONFIDENCE_THRESHOLD = 0.1;

// ============================================================================
// Keyword-Based Agent Selector
// ============================================================================

/**
 * Keyword-based agent selector implementation
 */
export class KeywordAgentSelector implements AgentSelector {
  constructor(private readonly registry: AgentRegistry) {}

  /**
   * Select the best agent for a task
   */
  async select(
    task: string,
    context?: AgentSelectionContext
  ): Promise<AgentSelectionResult> {
    const matches = await this.match(task, context);

    if (matches.length === 0) {
      // Return default agent
      return {
        agentId: DEFAULT_AGENT_ID,
        confidence: 0.5,
        reason: 'No specific agent matched, using default',
        alternatives: [],
      };
    }

    const best = matches[0]!;
    return {
      ...best,
      alternatives: matches.slice(1).map((m) => ({
        agentId: m.agentId,
        confidence: m.confidence,
      })),
    };
  }

  /**
   * Get all agents that match a task
   */
  async match(
    task: string,
    context?: AgentSelectionContext
  ): Promise<AgentSelectionResult[]> {
    const filter = context?.team !== undefined
      ? { team: context.team, enabled: true as const }
      : { enabled: true as const };
    const agents = await this.registry.list(filter);

    // Filter by excluded agents
    const filtered = context?.excludeAgents
      ? agents.filter((a) => !context.excludeAgents!.includes(a.agentId))
      : agents;

    // Score each agent
    const scored = filtered
      .map((agent) => this.scoreAgent(agent, task, context))
      .filter((result) => result.confidence >= MIN_CONFIDENCE_THRESHOLD);

    // INV-AGT-SEL-003: Sort by confidence descending
    scored.sort((a, b) => b.confidence - a.confidence);

    return scored;
  }

  /**
   * Score an agent for a task
   *
   * Implements invariants:
   * - INV-AGT-SEL-005: exampleTasks boost confidence when matched
   * - INV-AGT-SEL-006: notForTasks reduce confidence when matched
   */
  private scoreAgent(
    agent: AgentProfile,
    task: string,
    context?: AgentSelectionContext
  ): AgentSelectionResult {
    const taskLower = task.toLowerCase();
    const taskNormalized = this.normalizeText(taskLower);
    const taskWords = this.extractWords(taskLower);

    let score = 0;
    const reasons: string[] = [];

    // INV-AGT-SEL-005: Score based on exampleTasks (highest priority)
    const exampleTasks = agent.selectionMetadata?.exampleTasks ?? [];
    for (const example of exampleTasks) {
      const exampleNormalized = this.normalizeText(example.toLowerCase());
      if (taskNormalized === exampleNormalized) {
        // Exact match (normalized) adds +0.6
        score += 0.6;
        reasons.push(`exact example match: "${example}"`);
        break; // Only count best match
      } else if (taskLower.includes(example.toLowerCase()) || example.toLowerCase().includes(taskLower)) {
        // Substring match adds +0.4
        score += 0.4;
        reasons.push(`example match: "${example}"`);
        break; // Only count best match
      }
    }

    // INV-AGT-SEL-006: Negative score for notForTasks
    const notForTasks = agent.selectionMetadata?.notForTasks ?? [];
    for (const notFor of notForTasks) {
      if (taskLower.includes(notFor.toLowerCase()) || notFor.toLowerCase().includes(taskLower)) {
        // NotForTask match subtracts -0.5
        score -= 0.5;
        reasons.push(`not-for match: "${notFor}"`);
        break; // Only count first match
      }
    }

    // Score based on primary intents
    const primaryIntents = agent.selectionMetadata?.primaryIntents ?? [];
    for (const intent of primaryIntents) {
      if (taskLower.includes(intent.toLowerCase())) {
        score += 0.3;
        reasons.push(`primary intent match: ${intent}`);
      }
    }

    // Score based on keywords
    const keywords = agent.selectionMetadata?.keywords ?? [];
    for (const keyword of keywords) {
      if (taskLower.includes(keyword.toLowerCase())) {
        score += 0.15;
        reasons.push(`keyword match: ${keyword}`);
      }
    }

    // Negative score for anti-keywords
    const antiKeywords = agent.selectionMetadata?.antiKeywords ?? [];
    for (const antiKeyword of antiKeywords) {
      if (taskLower.includes(antiKeyword.toLowerCase())) {
        score -= 0.2;
        reasons.push(`anti-keyword match: ${antiKeyword}`);
      }
    }

    // Score based on negative intents
    const negativeIntents = agent.selectionMetadata?.negativeIntents ?? [];
    for (const intent of negativeIntents) {
      if (taskLower.includes(intent.toLowerCase())) {
        score -= 0.3;
        reasons.push(`negative intent match: ${intent}`);
      }
    }

    // Score based on capabilities
    const capabilities = agent.capabilities ?? [];
    for (const cap of capabilities) {
      if (taskWords.some((w) => cap.toLowerCase().includes(w))) {
        score += 0.1;
        reasons.push(`capability match: ${cap}`);
      }
    }

    // Score based on required capabilities in context
    if (context?.requiredCapabilities) {
      const matches = context.requiredCapabilities.filter((req) =>
        capabilities.some((cap) =>
          cap.toLowerCase().includes(req.toLowerCase())
        )
      );
      if (matches.length === context.requiredCapabilities.length) {
        score += 0.25;
        reasons.push('all required capabilities match');
      } else if (matches.length > 0) {
        score += 0.1 * (matches.length / context.requiredCapabilities.length);
        reasons.push(`${matches.length}/${context.requiredCapabilities.length} required capabilities`);
      }
    }

    // Score based on expertise
    const expertise = agent.expertise ?? [];
    for (const exp of expertise) {
      if (taskWords.some((w) => exp.toLowerCase().includes(w))) {
        score += 0.15;
        reasons.push(`expertise match: ${exp}`);
      }
    }

    // Score based on role match
    if (agent.role) {
      const roleWords = this.extractWords(agent.role.toLowerCase());
      const roleMatches = roleWords.filter((r) => taskWords.includes(r));
      if (roleMatches.length > 0) {
        score += 0.1;
        reasons.push(`role match: ${agent.role}`);
      }
    }

    // Score based on description match
    if (agent.description) {
      const descWords = this.extractWords(agent.description.toLowerCase());
      const descMatches = descWords.filter((d) => taskWords.includes(d)).length;
      if (descMatches > 2) {
        score += 0.05 * Math.min(descMatches, 5);
        reasons.push(`description match: ${descMatches} words`);
      }
    }

    // Team bonus
    if (context?.team && agent.team === context.team) {
      score += 0.1;
      reasons.push(`team match: ${agent.team}`);
    }

    // Check redirect rules
    const redirectRules = agent.selectionMetadata?.redirectWhen ?? [];
    for (const rule of redirectRules) {
      if (taskLower.includes(rule.phrase.toLowerCase())) {
        // This agent suggests redirecting to another
        score -= 0.5;
        reasons.push(`redirect suggested to: ${rule.suggest}`);
      }
    }

    // INV-AGT-SEL-002: Clamp confidence between 0 and 1
    const confidence = Math.max(0, Math.min(1, score));

    return {
      agentId: agent.agentId,
      confidence,
      reason: reasons.length > 0 ? reasons.join('; ') : 'no specific match',
      alternatives: [],
    };
  }

  /**
   * Normalize text for comparison (remove punctuation, extra spaces)
   */
  private normalizeText(text: string): string {
    return text
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract words from text
   */
  private extractWords(text: string): string[] {
    return text
      .split(/[\s\-_,./]+/)
      .filter((w) => w.length > 2)
      .map((w) => w.toLowerCase());
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a keyword-based agent selector
 */
export function createAgentSelector(registry: AgentRegistry): AgentSelector {
  return new KeywordAgentSelector(registry);
}
