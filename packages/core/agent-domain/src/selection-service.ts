/**
 * Agent Selection Service
 *
 * Domain service for agent recommendation and capability discovery.
 * Implements contract-defined invariants for agent selection.
 *
 * Invariants:
 * - INV-AGT-SEL-001: Selection is deterministic (same input = same output)
 * - INV-AGT-SEL-002: Confidence scores must be between 0 and 1
 * - INV-AGT-SEL-003: Results must be sorted by confidence descending
 * - INV-AGT-SEL-004: Always returns at least one result (fallback to 'standard')
 * - INV-AGT-SEL-005: exampleTasks boost confidence when matched
 * - INV-AGT-SEL-006: notForTasks reduce confidence when matched
 */

import type {
  AgentProfile,
  AgentRecommendRequest,
  AgentRecommendResult,
  AgentCapabilitiesRequest,
  AgentCapabilitiesResult,
  AgentCategory,
} from '@automatosx/contracts';
import type { AgentRegistry } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default agent ID when no match is found (INV-AGT-SEL-004)
 */
const FALLBACK_AGENT_ID = 'standard';

/**
 * Default confidence for fallback agent (INV-AGT-SEL-004)
 */
const FALLBACK_CONFIDENCE = 0.5;

/**
 * Minimum confidence threshold for selection
 */
const MIN_CONFIDENCE_THRESHOLD = 0.1;

/**
 * Scoring weights (INV-AGT-SEL-005, INV-AGT-SEL-006)
 */
const SCORE_WEIGHTS = {
  EXACT_EXAMPLE_MATCH: 0.6,    // INV-AGT-SEL-005: Exact match adds +0.6
  SUBSTRING_EXAMPLE_MATCH: 0.4, // INV-AGT-SEL-005: Substring match adds +0.4
  NOT_FOR_TASK_PENALTY: -0.5,  // INV-AGT-SEL-006: NotForTask subtracts -0.5
  PRIMARY_INTENT: 0.3,
  KEYWORD: 0.15,
  ANTI_KEYWORD: -0.2,
  NEGATIVE_INTENT: -0.3,
  CAPABILITY: 0.1,
  REQUIRED_CAPABILITY_FULL: 0.25,
  EXPERTISE: 0.15,
  ROLE: 0.1,
  DESCRIPTION_WORD: 0.05,
  TEAM: 0.1,
  REDIRECT: -0.5,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Internal scored agent result
 */
interface ScoredAgent {
  agentId: string;
  confidence: number;
  reason: string;
  matchDetails: string[];
}

/**
 * Selection service port interface
 */
export interface AgentSelectionServicePort {
  /**
   * Recommend the best agent for a task
   */
  recommend(request: AgentRecommendRequest): Promise<AgentRecommendResult>;

  /**
   * Get all agent capabilities
   */
  getCapabilities(request: AgentCapabilitiesRequest): Promise<AgentCapabilitiesResult>;
}

// ============================================================================
// Agent Selection Service Implementation
// ============================================================================

/**
 * Agent Selection Service
 *
 * Implements deterministic agent selection based on task matching.
 */
export class AgentSelectionService implements AgentSelectionServicePort {
  constructor(private readonly registry: AgentRegistry) {}

  /**
   * Recommend the best agent for a task
   *
   * Implements:
   * - INV-AGT-SEL-001: Deterministic selection
   * - INV-AGT-SEL-002: Confidence range [0,1]
   * - INV-AGT-SEL-003: Sorted by confidence descending
   * - INV-AGT-SEL-004: Fallback to 'standard'
   */
  async recommend(request: AgentRecommendRequest): Promise<AgentRecommendResult> {
    // Get all enabled agents, optionally filtered by team
    const filter = request.team !== undefined
      ? { team: request.team, enabled: true as const }
      : { enabled: true as const };

    const agents = await this.registry.list(filter);

    // Filter out excluded agents
    const filteredAgents = request.excludeAgents
      ? agents.filter((a) => !request.excludeAgents!.includes(a.agentId))
      : agents;

    // Score each agent (INV-AGT-SEL-001: deterministic)
    const scored = filteredAgents
      .map((agent) => this.scoreAgent(agent, request.task, request.requiredCapabilities))
      .filter((result) => result.confidence >= MIN_CONFIDENCE_THRESHOLD);

    // INV-AGT-SEL-003: Sort by confidence descending, then by agentId for tie-breaking
    scored.sort((a, b) => {
      const confidenceDiff = b.confidence - a.confidence;
      if (confidenceDiff !== 0) return confidenceDiff;
      return a.agentId.localeCompare(b.agentId); // Deterministic tie-breaking
    });

    // INV-AGT-SEL-004: Always return at least one result
    if (scored.length === 0) {
      return {
        recommended: FALLBACK_AGENT_ID,
        confidence: FALLBACK_CONFIDENCE,
        reason: 'No specific agent matched, using default generalist agent',
        alternatives: [],
      };
    }

    // Get top N results based on maxResults
    const topResults = scored.slice(0, request.maxResults);
    const best = topResults[0]!;

    return {
      recommended: best.agentId,
      confidence: best.confidence,
      reason: best.reason,
      alternatives: topResults.slice(1).map((s) => ({
        agentId: s.agentId,
        confidence: s.confidence,
        reason: s.reason,
      })),
    };
  }

  /**
   * Get all agent capabilities
   */
  async getCapabilities(request: AgentCapabilitiesRequest): Promise<AgentCapabilitiesResult> {
    // Get agents based on request filters
    const filter = request.includeDisabled ? {} : { enabled: true as const };
    let agents = await this.registry.list(filter);

    // Filter by category if specified
    if (request.category) {
      agents = agents.filter(
        (a) => a.selectionMetadata?.agentCategory === request.category
      );
    }

    // Build capability mappings
    const allCapabilities = new Set<string>();
    const agentsByCapability: Record<string, string[]> = {};
    const capabilitiesByAgent: Record<string, string[]> = {};
    const categoriesByAgent: Record<string, AgentCategory> = {};

    for (const agent of agents) {
      const caps = agent.capabilities ?? [];
      capabilitiesByAgent[agent.agentId] = caps;

      // Track category
      if (agent.selectionMetadata?.agentCategory) {
        categoriesByAgent[agent.agentId] = agent.selectionMetadata.agentCategory;
      }

      // Build reverse mapping
      for (const cap of caps) {
        allCapabilities.add(cap);
        if (!agentsByCapability[cap]) {
          agentsByCapability[cap] = [];
        }
        agentsByCapability[cap].push(agent.agentId);
      }
    }

    return {
      capabilities: Array.from(allCapabilities).sort(),
      agentsByCapability,
      capabilitiesByAgent,
      categoriesByAgent: Object.keys(categoriesByAgent).length > 0 ? categoriesByAgent : undefined,
    };
  }

  /**
   * Score an agent for a task
   *
   * Implements:
   * - INV-AGT-SEL-002: Confidence clamped to [0,1]
   * - INV-AGT-SEL-005: exampleTasks boost
   * - INV-AGT-SEL-006: notForTasks penalty
   */
  private scoreAgent(
    agent: AgentProfile,
    task: string,
    requiredCapabilities?: string[]
  ): ScoredAgent {
    const taskLower = task.toLowerCase();
    const taskNormalized = this.normalizeText(taskLower);
    const taskWords = this.extractWords(taskLower);

    let score = 0;
    const matchDetails: string[] = [];

    // INV-AGT-SEL-005: Score based on exampleTasks (highest priority)
    const exampleTasks = agent.selectionMetadata?.exampleTasks ?? [];
    for (const example of exampleTasks) {
      const exampleNormalized = this.normalizeText(example.toLowerCase());
      if (taskNormalized === exampleNormalized) {
        score += SCORE_WEIGHTS.EXACT_EXAMPLE_MATCH;
        matchDetails.push(`exact example match: "${example}"`);
        break;
      } else if (
        taskLower.includes(example.toLowerCase()) ||
        example.toLowerCase().includes(taskLower)
      ) {
        score += SCORE_WEIGHTS.SUBSTRING_EXAMPLE_MATCH;
        matchDetails.push(`example match: "${example}"`);
        break;
      }
    }

    // INV-AGT-SEL-006: Negative score for notForTasks
    const notForTasks = agent.selectionMetadata?.notForTasks ?? [];
    for (const notFor of notForTasks) {
      if (
        taskLower.includes(notFor.toLowerCase()) ||
        notFor.toLowerCase().includes(taskLower)
      ) {
        score += SCORE_WEIGHTS.NOT_FOR_TASK_PENALTY;
        matchDetails.push(`not-for match: "${notFor}"`);
        break;
      }
    }

    // Score based on primary intents
    const primaryIntents = agent.selectionMetadata?.primaryIntents ?? [];
    for (const intent of primaryIntents) {
      if (taskLower.includes(intent.toLowerCase())) {
        score += SCORE_WEIGHTS.PRIMARY_INTENT;
        matchDetails.push(`primary intent: ${intent}`);
      }
    }

    // Score based on keywords
    const keywords = agent.selectionMetadata?.keywords ?? [];
    for (const keyword of keywords) {
      if (taskLower.includes(keyword.toLowerCase())) {
        score += SCORE_WEIGHTS.KEYWORD;
        matchDetails.push(`keyword: ${keyword}`);
      }
    }

    // Negative score for anti-keywords
    const antiKeywords = agent.selectionMetadata?.antiKeywords ?? [];
    for (const antiKeyword of antiKeywords) {
      if (taskLower.includes(antiKeyword.toLowerCase())) {
        score += SCORE_WEIGHTS.ANTI_KEYWORD;
        matchDetails.push(`anti-keyword: ${antiKeyword}`);
      }
    }

    // Score based on negative intents
    const negativeIntents = agent.selectionMetadata?.negativeIntents ?? [];
    for (const intent of negativeIntents) {
      if (taskLower.includes(intent.toLowerCase())) {
        score += SCORE_WEIGHTS.NEGATIVE_INTENT;
        matchDetails.push(`negative intent: ${intent}`);
      }
    }

    // Score based on capabilities
    const capabilities = agent.capabilities ?? [];
    for (const cap of capabilities) {
      if (taskWords.some((w) => cap.toLowerCase().includes(w))) {
        score += SCORE_WEIGHTS.CAPABILITY;
        matchDetails.push(`capability: ${cap}`);
      }
    }

    // Score based on required capabilities
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const matches = requiredCapabilities.filter((req) =>
        capabilities.some((cap) => cap.toLowerCase().includes(req.toLowerCase()))
      );
      if (matches.length === requiredCapabilities.length) {
        score += SCORE_WEIGHTS.REQUIRED_CAPABILITY_FULL;
        matchDetails.push('all required capabilities');
      } else if (matches.length > 0) {
        const partial = SCORE_WEIGHTS.CAPABILITY * (matches.length / requiredCapabilities.length);
        score += partial;
        matchDetails.push(`${matches.length}/${requiredCapabilities.length} required capabilities`);
      }
    }

    // Score based on expertise
    const expertise = agent.expertise ?? [];
    for (const exp of expertise) {
      if (taskWords.some((w) => exp.toLowerCase().includes(w))) {
        score += SCORE_WEIGHTS.EXPERTISE;
        matchDetails.push(`expertise: ${exp}`);
      }
    }

    // Score based on role match
    if (agent.role) {
      const roleWords = this.extractWords(agent.role.toLowerCase());
      const roleMatches = roleWords.filter((r) => taskWords.includes(r));
      if (roleMatches.length > 0) {
        score += SCORE_WEIGHTS.ROLE;
        matchDetails.push(`role: ${agent.role}`);
      }
    }

    // Score based on description match
    if (agent.description) {
      const descWords = this.extractWords(agent.description.toLowerCase());
      const descMatches = descWords.filter((d) => taskWords.includes(d)).length;
      if (descMatches > 2) {
        score += SCORE_WEIGHTS.DESCRIPTION_WORD * Math.min(descMatches, 5);
        matchDetails.push(`description: ${descMatches} words`);
      }
    }

    // Check redirect rules (suggests this agent is NOT right)
    const redirectRules = agent.selectionMetadata?.redirectWhen ?? [];
    for (const rule of redirectRules) {
      if (taskLower.includes(rule.phrase.toLowerCase())) {
        score += SCORE_WEIGHTS.REDIRECT;
        matchDetails.push(`redirect to: ${rule.suggest}`);
      }
    }

    // INV-AGT-SEL-002: Clamp confidence to [0,1]
    const confidence = Math.max(0, Math.min(1, score));

    // Build reason from match details
    const reason = matchDetails.length > 0
      ? matchDetails.slice(0, 3).join('; ')
      : 'no specific match';

    return {
      agentId: agent.agentId,
      confidence,
      reason,
      matchDetails,
    };
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract meaningful words from text
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
 * Creates an agent selection service
 */
export function createAgentSelectionService(
  registry: AgentRegistry
): AgentSelectionServicePort {
  return new AgentSelectionService(registry);
}
