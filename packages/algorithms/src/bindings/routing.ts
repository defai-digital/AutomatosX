/**
 * TypeScript bindings for ReScript Routing module
 *
 * Intelligent task-aware provider routing with:
 * - Task type to provider affinity mapping
 * - Agent specialty to provider matching
 * - Dynamic scoring based on task requirements
 *
 * Provider Specialties:
 * - OpenAI (codex): Planning, architecture, complex reasoning
 * - Gemini: Frontend, creative, UI/UX, design tasks
 * - Claude: Coding, debugging, implementation, analysis
 * - ax-cli: Universal fallback for all task types
 *
 * @module @ax/algorithms/routing
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Routing Algorithm Constants
// =============================================================================

/** Priority scoring parameters */
const PRIORITY_MIN = 1;
const PRIORITY_MAX = 10;
const PRIORITY_BASE_SCORE = 100;
const PRIORITY_SCORE_MULTIPLIER = 10;

/** Rate limit scoring */
const RATE_LIMIT_SCORE_MULTIPLIER = 50;

/** Latency scoring parameters */
const LATENCY_BASELINE_MS = 5000;
const LATENCY_SCORE_DIVISOR = 100;

/** Success rate scoring */
const SUCCESS_RATE_MULTIPLIER = 100;

/** MCP preference bonus */
const MCP_PREFERENCE_BONUS = 25;

/** Complexity threshold and bonus */
const COMPLEXITY_HIGH_THRESHOLD = 7;
const COMPLEXITY_BONUS_MULTIPLIER = 20;

/** Score thresholds for reason categorization */
const SCORE_THRESHOLD_EXCELLENT = 200;
const SCORE_THRESHOLD_GOOD = 150;
const SCORE_THRESHOLD_ACCEPTABLE = 100;

/** Unhealthy provider penalty */
const UNHEALTHY_PROVIDER_PENALTY = -1000;

/** Forced provider score */
const FORCED_PROVIDER_SCORE = 1000;

/** Default complexity value */
const DEFAULT_COMPLEXITY = 5;

/** Integration mode constant */
const INTEGRATION_MODE_MCP = 'mcp';

/** Maximum number of alternative providers to return */
const MAX_ALTERNATIVES = 3;

// =============================================================================
// Task-Provider Affinity System
// =============================================================================

/**
 * Task type to provider affinity mapping
 * Higher values = better fit for that task type
 * Scale: 0-100 (0 = not suitable, 100 = perfect fit)
 */
const TASK_PROVIDER_AFFINITY: Record<string, Record<string, number>> = {
  // Planning and architecture tasks → OpenAI excels
  planning: { openai: 95, codex: 95, claude: 70, gemini: 60, 'ax-cli': 40 },
  architecture: { openai: 90, codex: 90, claude: 75, gemini: 50, 'ax-cli': 40 },
  design: { openai: 85, codex: 85, gemini: 80, claude: 65, 'ax-cli': 40 },
  strategy: { openai: 95, codex: 95, claude: 70, gemini: 55, 'ax-cli': 40 },

  // Frontend and creative tasks → Gemini excels
  frontend: { gemini: 95, claude: 75, openai: 65, codex: 65, 'ax-cli': 40 },
  ui: { gemini: 95, claude: 70, openai: 60, codex: 60, 'ax-cli': 40 },
  creative: { gemini: 95, openai: 75, codex: 75, claude: 60, 'ax-cli': 40 },
  styling: { gemini: 90, claude: 70, openai: 55, codex: 55, 'ax-cli': 40 },
  animation: { gemini: 90, claude: 65, openai: 50, codex: 50, 'ax-cli': 40 },

  // Coding and debugging tasks → Claude excels
  coding: { claude: 95, openai: 75, codex: 75, gemini: 65, 'ax-cli': 40 },
  debugging: { claude: 95, openai: 70, codex: 70, gemini: 55, 'ax-cli': 40 },
  implementation: { claude: 90, openai: 75, codex: 75, gemini: 65, 'ax-cli': 40 },
  refactoring: { claude: 90, openai: 70, codex: 70, gemini: 55, 'ax-cli': 40 },
  testing: { claude: 85, openai: 75, codex: 75, gemini: 60, 'ax-cli': 40 },
  analysis: { claude: 85, openai: 80, codex: 80, gemini: 65, 'ax-cli': 40 },
  review: { claude: 85, openai: 80, codex: 80, gemini: 60, 'ax-cli': 40 },

  // General tasks → balanced scoring, slight preference for Claude
  general: { claude: 75, openai: 70, codex: 70, gemini: 70, 'ax-cli': 50 },
  documentation: { claude: 80, openai: 75, codex: 75, gemini: 70, 'ax-cli': 45 },
  research: { openai: 80, codex: 80, claude: 75, gemini: 75, 'ax-cli': 45 },

  // Security tasks → Claude preferred for careful analysis
  security: { claude: 90, openai: 80, codex: 80, gemini: 55, 'ax-cli': 40 },

  // DevOps tasks → balanced
  devops: { claude: 80, openai: 75, codex: 75, gemini: 60, 'ax-cli': 45 },
  infrastructure: { claude: 80, openai: 75, codex: 75, gemini: 55, 'ax-cli': 45 },

  // Data tasks → OpenAI/Claude both good
  data: { openai: 85, codex: 85, claude: 85, gemini: 60, 'ax-cli': 45 },
  'machine-learning': { openai: 90, codex: 90, claude: 80, gemini: 65, 'ax-cli': 40 },
};

/**
 * Agent type to provider affinity
 * Maps agent specialties to their best-fit providers
 */
const AGENT_PROVIDER_AFFINITY: Record<string, Record<string, number>> = {
  // Planning/strategy agents → OpenAI
  product: { openai: 90, codex: 90, claude: 70, gemini: 65, 'ax-cli': 40 },
  architecture: { openai: 90, codex: 90, claude: 75, gemini: 55, 'ax-cli': 40 },
  cto: { openai: 90, codex: 90, claude: 75, gemini: 60, 'ax-cli': 40 },
  ceo: { openai: 90, codex: 90, claude: 70, gemini: 65, 'ax-cli': 40 },
  researcher: { openai: 85, codex: 85, claude: 80, gemini: 70, 'ax-cli': 45 },

  // Frontend/creative agents → Gemini
  frontend: { gemini: 95, claude: 75, openai: 60, codex: 60, 'ax-cli': 40 },
  design: { gemini: 95, openai: 70, codex: 70, claude: 60, 'ax-cli': 40 },
  mobile: { gemini: 85, claude: 80, openai: 65, codex: 65, 'ax-cli': 40 },
  'creative-marketer': { gemini: 95, openai: 75, codex: 75, claude: 60, 'ax-cli': 40 },

  // Coding/technical agents → Claude
  backend: { claude: 95, openai: 70, codex: 70, gemini: 55, 'ax-cli': 40 },
  fullstack: { claude: 90, gemini: 70, openai: 65, codex: 65, 'ax-cli': 40 },
  security: { claude: 95, openai: 75, codex: 75, gemini: 50, 'ax-cli': 40 },
  quality: { claude: 90, openai: 75, codex: 75, gemini: 60, 'ax-cli': 40 },
  devops: { claude: 85, openai: 75, codex: 75, gemini: 55, 'ax-cli': 45 },

  // Data agents → OpenAI/Claude balanced
  data: { openai: 85, codex: 85, claude: 85, gemini: 55, 'ax-cli': 40 },
  'data-scientist': { openai: 90, codex: 90, claude: 80, gemini: 60, 'ax-cli': 40 },

  // Documentation → Claude slightly preferred
  writer: { claude: 85, openai: 80, codex: 80, gemini: 75, 'ax-cli': 45 },

  // Specialized technical agents → Claude
  'quantum-engineer': { claude: 85, openai: 85, codex: 85, gemini: 50, 'ax-cli': 40 },
  'aerospace-scientist': { claude: 85, openai: 85, codex: 85, gemini: 55, 'ax-cli': 40 },

  // Standard/fallback → balanced
  standard: { claude: 75, openai: 70, codex: 70, gemini: 70, 'ax-cli': 50 },
};

/** Task affinity bonus multiplier (how much task type affects scoring) */
const TASK_AFFINITY_MULTIPLIER = 1.5;

/** Agent affinity bonus multiplier */
const AGENT_AFFINITY_MULTIPLIER = 1.0;

// =============================================================================
// Types
// =============================================================================

// Types that mirror ReScript types
export interface Provider {
  id: string;
  priority: number;
  healthy: boolean;
  rateLimit: number; // 0.0 - 1.0
  latencyMs: number;
  successRate: number; // 0.0 - 1.0
  integrationMode: 'mcp' | 'sdk' | 'bash';
}

export interface RoutingContext {
  taskType: string;
  complexity: number; // 1-10
  preferMcp: boolean;
  excludeProviders: string[];
  forceProvider?: string;
  /** Agent ID for agent-specific provider affinity */
  agentId?: string;
  /** Original task description for keyword analysis */
  taskDescription?: string;
}

export interface RoutingResult {
  provider: Provider | null;
  score: number;
  reason: string;
  alternatives: Array<{
    provider: Provider;
    score: number;
    reason: string;
  }>;
}

/**
 * Clamp a number between min and max bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Default context
export const defaultRoutingContext: RoutingContext = {
  taskType: 'general',
  complexity: DEFAULT_COMPLEXITY,
  preferMcp: true,
  excludeProviders: [],
};

/**
 * Get task-provider affinity score
 * Returns 0-100 based on how well the provider fits the task type
 */
function getTaskAffinity(providerId: string, taskType: string): number {
  const taskAffinities = TASK_PROVIDER_AFFINITY[taskType];
  if (!taskAffinities) {
    // Unknown task type, use general affinity
    return TASK_PROVIDER_AFFINITY['general']?.[providerId] ?? 50;
  }
  return taskAffinities[providerId] ?? 50;
}

/**
 * Get agent-provider affinity score
 * Returns 0-100 based on how well the provider fits the agent type
 */
function getAgentAffinity(providerId: string, agentId: string | undefined): number {
  if (!agentId) return 50; // No agent specified, neutral score

  const agentAffinities = AGENT_PROVIDER_AFFINITY[agentId];
  if (!agentAffinities) {
    // Unknown agent, use standard agent affinity
    return AGENT_PROVIDER_AFFINITY['standard']?.[providerId] ?? 50;
  }
  return agentAffinities[providerId] ?? 50;
}

/**
 * Infer additional task types from task description keywords
 */
function inferTaskTypeFromDescription(description: string | undefined): string[] {
  if (!description) return [];

  const lowerDesc = description.toLowerCase();
  const inferred: string[] = [];

  // Planning keywords
  if (/\b(plan|roadmap|strategy|requirements|prd|spec|propose)\b/.test(lowerDesc)) {
    inferred.push('planning');
  }

  // Architecture keywords
  if (/\b(architect|design system|infrastructure|scalab|microservice|monolith)\b/.test(lowerDesc)) {
    inferred.push('architecture');
  }

  // Frontend keywords
  if (/\b(ui|ux|component|react|vue|angular|css|tailwind|responsive|layout|frontend)\b/.test(lowerDesc)) {
    inferred.push('frontend');
  }

  // Creative keywords
  if (/\b(creative|visual|animation|style|theme|brand|marketing)\b/.test(lowerDesc)) {
    inferred.push('creative');
  }

  // Coding keywords
  if (/\b(implement|code|write|create function|build|develop)\b/.test(lowerDesc)) {
    inferred.push('coding');
  }

  // Debugging keywords
  if (/\b(debug|fix|bug|error|issue|problem|troubleshoot|resolve)\b/.test(lowerDesc)) {
    inferred.push('debugging');
  }

  // Testing keywords
  if (/\b(test|spec|coverage|unit|e2e|integration|verify|validate)\b/.test(lowerDesc)) {
    inferred.push('testing');
  }

  // Security keywords
  if (/\b(security|vulnerab|audit|threat|owasp|penetration|xss|injection)\b/.test(lowerDesc)) {
    inferred.push('security');
  }

  return inferred;
}

/**
 * Calculate routing score for a provider
 *
 * The scoring algorithm considers:
 * 1. Base priority (from config)
 * 2. Provider health metrics (latency, success rate)
 * 3. Task-provider affinity (most important for routing)
 * 4. Agent-provider affinity
 * 5. MCP preference and complexity bonuses
 */
export function calculateScore(provider: Provider, ctx: RoutingContext): number {
  if (!provider.healthy) {
    return UNHEALTHY_PROVIDER_PENALTY;
  }

  // Base priority score (lower priority number = higher score)
  const normalizedPriority = clamp(provider.priority, PRIORITY_MIN, PRIORITY_MAX);
  const priorityScore = PRIORITY_BASE_SCORE - normalizedPriority * PRIORITY_SCORE_MULTIPLIER;

  // Rate limit score (lower usage = higher score)
  const clampedRateLimit = clamp(provider.rateLimit, 0, 1);
  const rateLimitScore = (1 - clampedRateLimit) * RATE_LIMIT_SCORE_MULTIPLIER;

  // Latency score (lower latency = higher score)
  const latencyScore = Math.max(0, LATENCY_BASELINE_MS - provider.latencyMs) / LATENCY_SCORE_DIVISOR;

  // Success rate score
  const successScore = provider.successRate * SUCCESS_RATE_MULTIPLIER;

  // MCP preference bonus
  const mcpBonus = ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP ? MCP_PREFERENCE_BONUS : 0;

  // Complexity adjustment (high complexity tasks benefit from reliable providers)
  const complexityFactor = ctx.complexity > COMPLEXITY_HIGH_THRESHOLD
    ? provider.successRate * COMPLEXITY_BONUS_MULTIPLIER
    : 0;

  // === NEW: Task-Provider Affinity Score ===
  // This is the key addition - route tasks to their best-fit provider
  let taskAffinityScore = getTaskAffinity(provider.id, ctx.taskType);

  // Also check inferred task types from description and take the highest affinity
  const inferredTypes = inferTaskTypeFromDescription(ctx.taskDescription);
  for (const inferredType of inferredTypes) {
    const inferredAffinity = getTaskAffinity(provider.id, inferredType);
    taskAffinityScore = Math.max(taskAffinityScore, inferredAffinity);
  }

  // Scale and apply task affinity (this is the dominant factor)
  const taskAffinityBonus = taskAffinityScore * TASK_AFFINITY_MULTIPLIER;

  // === NEW: Agent-Provider Affinity Score ===
  // Route certain agents to their preferred providers
  const agentAffinityScore = getAgentAffinity(provider.id, ctx.agentId);
  const agentAffinityBonus = agentAffinityScore * AGENT_AFFINITY_MULTIPLIER;

  // Total score with task/agent affinity as major factors
  return (
    priorityScore +
    rateLimitScore +
    latencyScore +
    successScore +
    mcpBonus +
    complexityFactor +
    taskAffinityBonus +
    agentAffinityBonus
  );
}

/**
 * Get reason for score with task-aware explanations
 */
function getScoreReason(provider: Provider, score: number, ctx: RoutingContext): string {
  if (!provider.healthy) {
    return 'Provider is unhealthy';
  }

  // Get affinity scores for explanation
  const taskAffinity = getTaskAffinity(provider.id, ctx.taskType);
  const agentAffinity = ctx.agentId ? getAgentAffinity(provider.id, ctx.agentId) : 50;

  // High affinity match
  if (taskAffinity >= 90) {
    return `Best fit: ${provider.id} excels at ${ctx.taskType} tasks`;
  }

  if (agentAffinity >= 90 && ctx.agentId) {
    return `Best fit: ${provider.id} is optimal for ${ctx.agentId} agent`;
  }

  if (taskAffinity >= 80 || agentAffinity >= 80) {
    return `Good fit: ${provider.id} is well-suited for this ${ctx.taskType} task`;
  }

  if (score > SCORE_THRESHOLD_EXCELLENT) {
    return 'Excellent: high success rate, low latency';
  }
  if (score > SCORE_THRESHOLD_GOOD) {
    if (ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP) {
      return 'Good: MCP provider with good metrics';
    }
    return 'Good: balanced performance metrics';
  }
  if (score > SCORE_THRESHOLD_ACCEPTABLE) {
    return 'Acceptable: meets minimum requirements';
  }
  return 'Fallback: other providers unavailable';
}

/**
 * Select the best provider based on context
 */
export function selectProvider(providers: Provider[], ctx: RoutingContext = defaultRoutingContext): RoutingResult {
  // Handle forced provider
  if (ctx.forceProvider) {
    const forced = providers.find((p) => p.id === ctx.forceProvider);
    if (forced) {
      return {
        provider: forced,
        score: FORCED_PROVIDER_SCORE,
        reason: 'Forced provider selection',
        alternatives: [],
      };
    }
    return {
      provider: null,
      score: 0,
      reason: `Forced provider '${ctx.forceProvider}' not found`,
      alternatives: [],
    };
  }

  // Filter out excluded providers
  const available = providers.filter((p) => !ctx.excludeProviders.includes(p.id));

  // Calculate scores
  const scored = available.map((p) => {
    const score = calculateScore(p, ctx);
    const reason = getScoreReason(p, score, ctx);
    return { provider: p, score, reason };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Filter out unhealthy (negative scores)
  const valid = scored.filter((s) => s.score > 0);

  if (valid.length === 0) {
    return {
      provider: null,
      score: 0,
      reason: 'No healthy providers available',
      alternatives: [],
    };
  }

  const best = valid[0]!;
  return {
    provider: best.provider,
    score: best.score,
    reason: best.reason,
    alternatives: valid.slice(1, 1 + MAX_ALTERNATIVES),
  };
}

/**
 * Get providers sorted by preference for fallback
 */
export function getFallbackOrder(providers: Provider[], ctx: RoutingContext = defaultRoutingContext): Provider[] {
  return providers
    .filter((p) => p.healthy && !ctx.excludeProviders.includes(p.id))
    .map((p) => ({ provider: p, score: calculateScore(p, ctx) }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.provider);
}

// =============================================================================
// Affinity Lookup Functions
// =============================================================================

/**
 * Get the best provider for a specific task type
 */
export function getBestProviderForTask(taskType: string): string {
  const affinities = TASK_PROVIDER_AFFINITY[taskType] ?? TASK_PROVIDER_AFFINITY['general'];
  if (!affinities) return 'claude'; // Default fallback

  let bestProvider = 'claude';
  let bestScore = 0;

  for (const [provider, score] of Object.entries(affinities)) {
    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
    }
  }

  return bestProvider;
}

/**
 * Get the best provider for a specific agent
 */
export function getBestProviderForAgent(agentId: string): string {
  const affinities = AGENT_PROVIDER_AFFINITY[agentId] ?? AGENT_PROVIDER_AFFINITY['standard'];
  if (!affinities) return 'claude'; // Default fallback

  let bestProvider = 'claude';
  let bestScore = 0;

  for (const [provider, score] of Object.entries(affinities)) {
    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
    }
  }

  return bestProvider;
}

/**
 * Get all supported task types
 */
export function getSupportedTaskTypes(): string[] {
  return Object.keys(TASK_PROVIDER_AFFINITY);
}

/**
 * Get all agents with defined provider affinities
 */
export function getAgentsWithAffinities(): string[] {
  return Object.keys(AGENT_PROVIDER_AFFINITY);
}

/**
 * Get affinity score for a specific provider-task combination
 */
export function getProviderTaskAffinity(providerId: string, taskType: string): number {
  return getTaskAffinity(providerId, taskType);
}

/**
 * Get affinity score for a specific provider-agent combination
 */
export function getProviderAgentAffinity(providerId: string, agentId: string): number {
  return getAgentAffinity(providerId, agentId);
}

// =============================================================================
// Exports
// =============================================================================

export { TASK_PROVIDER_AFFINITY, AGENT_PROVIDER_AFFINITY };
