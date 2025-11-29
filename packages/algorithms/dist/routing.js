// src/bindings/routing.ts
var PRIORITY_MIN = 1;
var PRIORITY_MAX = 10;
var PRIORITY_BASE_SCORE = 100;
var PRIORITY_SCORE_MULTIPLIER = 10;
var RATE_LIMIT_SCORE_MULTIPLIER = 50;
var LATENCY_BASELINE_MS = 5e3;
var LATENCY_SCORE_DIVISOR = 100;
var SUCCESS_RATE_MULTIPLIER = 100;
var MCP_PREFERENCE_BONUS = 25;
var COMPLEXITY_HIGH_THRESHOLD = 7;
var COMPLEXITY_BONUS_MULTIPLIER = 20;
var SCORE_THRESHOLD_EXCELLENT = 200;
var SCORE_THRESHOLD_GOOD = 150;
var SCORE_THRESHOLD_ACCEPTABLE = 100;
var UNHEALTHY_PROVIDER_PENALTY = -1e3;
var FORCED_PROVIDER_SCORE = 1e3;
var DEFAULT_COMPLEXITY = 5;
var INTEGRATION_MODE_MCP = "mcp";
var MAX_ALTERNATIVES = 3;
function classifyTask(taskType) {
  const normalizedType = taskType.toLowerCase();
  const planningTasks = [
    "planning",
    "architecture",
    "strategy",
    "research",
    "requirements",
    "roadmap",
    "design-system",
    "analysis"
  ];
  if (planningTasks.some((t) => normalizedType === t || normalizedType.startsWith(`${t}-`))) {
    return "planning";
  }
  const creativeTasks = [
    "frontend",
    "ui",
    "ux",
    "creative",
    "styling",
    "animation",
    "visual",
    "design",
    "branding",
    "marketing"
  ];
  if (creativeTasks.some((t) => normalizedType === t || normalizedType.startsWith(`${t}-`))) {
    return "creative";
  }
  const technicalTasks = [
    "coding",
    "debugging",
    "implementation",
    "refactoring",
    "testing",
    "review",
    "security",
    "devops",
    "infrastructure",
    "backend",
    "api",
    "database",
    "documentation"
  ];
  if (technicalTasks.some((t) => normalizedType === t || normalizedType.startsWith(`${t}-`))) {
    return "technical";
  }
  return "general";
}
var TASK_PROVIDER_AFFINITY = {
  // =========================================================================
  // CLASS 1: PLANNING/STRATEGY → OpenAI primary
  // =========================================================================
  planning: { openai: 100, claude: 65, gemini: 55, "ax-cli": 30 },
  architecture: { openai: 100, claude: 70, gemini: 50, "ax-cli": 30 },
  strategy: { openai: 100, claude: 60, gemini: 55, "ax-cli": 30 },
  research: { openai: 95, claude: 70, gemini: 65, "ax-cli": 30 },
  requirements: { openai: 95, claude: 65, gemini: 55, "ax-cli": 30 },
  roadmap: { openai: 100, claude: 60, gemini: 55, "ax-cli": 30 },
  analysis: { openai: 90, claude: 75, gemini: 60, "ax-cli": 30 },
  // =========================================================================
  // CLASS 2: FRONTEND/CREATIVE → Gemini primary
  // =========================================================================
  frontend: { gemini: 100, claude: 70, openai: 55, "ax-cli": 30 },
  ui: { gemini: 100, claude: 65, openai: 50, "ax-cli": 30 },
  ux: { gemini: 100, openai: 65, claude: 55, "ax-cli": 30 },
  creative: { gemini: 100, openai: 70, claude: 55, "ax-cli": 30 },
  styling: { gemini: 100, claude: 65, openai: 45, "ax-cli": 30 },
  animation: { gemini: 100, claude: 60, openai: 45, "ax-cli": 30 },
  visual: { gemini: 100, openai: 65, claude: 50, "ax-cli": 30 },
  design: { gemini: 95, openai: 75, claude: 60, "ax-cli": 30 },
  branding: { gemini: 100, openai: 70, claude: 50, "ax-cli": 30 },
  marketing: { gemini: 95, openai: 75, claude: 55, "ax-cli": 30 },
  // =========================================================================
  // CLASS 3: CODING/TECHNICAL → Claude primary
  // =========================================================================
  coding: { claude: 100, openai: 65, gemini: 55, "ax-cli": 30 },
  debugging: { claude: 100, openai: 60, gemini: 45, "ax-cli": 30 },
  implementation: { claude: 100, openai: 65, gemini: 55, "ax-cli": 30 },
  refactoring: { claude: 100, openai: 65, gemini: 50, "ax-cli": 30 },
  testing: { claude: 95, openai: 70, gemini: 55, "ax-cli": 30 },
  review: { claude: 95, openai: 75, gemini: 55, "ax-cli": 30 },
  security: { claude: 100, openai: 70, gemini: 45, "ax-cli": 30 },
  devops: { claude: 90, openai: 70, gemini: 50, "ax-cli": 30 },
  infrastructure: { claude: 90, openai: 75, gemini: 50, "ax-cli": 30 },
  backend: { claude: 100, openai: 60, gemini: 45, "ax-cli": 30 },
  api: { claude: 100, openai: 65, gemini: 50, "ax-cli": 30 },
  database: { claude: 95, openai: 70, gemini: 45, "ax-cli": 30 },
  documentation: { claude: 85, openai: 75, gemini: 65, "ax-cli": 30 },
  // =========================================================================
  // GENERAL/MIXED → Balanced with slight Claude preference
  // =========================================================================
  general: { claude: 75, openai: 70, gemini: 70, "ax-cli": 35 },
  data: { openai: 85, claude: 80, gemini: 55, "ax-cli": 30 },
  ml: { openai: 90, claude: 75, gemini: 55, "ax-cli": 30 }
};
var AGENT_PROVIDER_AFFINITY = {
  // =========================================================================
  // CLASS 1 AGENTS: Planning/Strategy → OpenAI primary
  // =========================================================================
  product: { openai: 100, claude: 65, gemini: 60, "ax-cli": 30 },
  architecture: { openai: 100, claude: 70, gemini: 50, "ax-cli": 30 },
  cto: { openai: 95, claude: 75, gemini: 55, "ax-cli": 30 },
  ceo: { openai: 100, claude: 65, gemini: 60, "ax-cli": 30 },
  researcher: { openai: 95, claude: 75, gemini: 65, "ax-cli": 30 },
  // =========================================================================
  // CLASS 2 AGENTS: Frontend/Creative → Gemini primary
  // =========================================================================
  frontend: { gemini: 100, claude: 70, openai: 55, "ax-cli": 30 },
  design: { gemini: 100, openai: 70, claude: 55, "ax-cli": 30 },
  mobile: { gemini: 90, claude: 75, openai: 60, "ax-cli": 30 },
  "creative-marketer": { gemini: 100, openai: 70, claude: 55, "ax-cli": 30 },
  // =========================================================================
  // CLASS 3 AGENTS: Coding/Technical → Claude primary
  // =========================================================================
  backend: { claude: 100, openai: 60, gemini: 45, "ax-cli": 30 },
  fullstack: { claude: 90, gemini: 70, openai: 65, "ax-cli": 30 },
  security: { claude: 100, openai: 70, gemini: 45, "ax-cli": 30 },
  quality: { claude: 95, openai: 70, gemini: 55, "ax-cli": 30 },
  devops: { claude: 90, openai: 70, gemini: 50, "ax-cli": 30 },
  data: { openai: 85, claude: 85, gemini: 50, "ax-cli": 30 },
  "data-scientist": { openai: 90, claude: 80, gemini: 55, "ax-cli": 30 },
  writer: { claude: 85, openai: 80, gemini: 70, "ax-cli": 30 },
  "quantum-engineer": { claude: 90, openai: 85, gemini: 45, "ax-cli": 30 },
  "aerospace-scientist": { claude: 90, openai: 85, gemini: 50, "ax-cli": 30 },
  // =========================================================================
  // GENERAL AGENTS → Balanced
  // =========================================================================
  standard: { claude: 75, openai: 70, gemini: 70, "ax-cli": 35 }
};
var TASK_AFFINITY_MULTIPLIER = 2;
var AGENT_AFFINITY_MULTIPLIER = 1;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
var defaultRoutingContext = {
  taskType: "general",
  complexity: DEFAULT_COMPLEXITY,
  preferMcp: true,
  excludeProviders: []
};
function getTaskAffinity(providerId, taskType) {
  const normalizedTaskType = taskType.toLowerCase();
  const taskAffinities = TASK_PROVIDER_AFFINITY[normalizedTaskType];
  if (!taskAffinities) {
    return TASK_PROVIDER_AFFINITY["general"]?.[providerId] ?? 50;
  }
  return taskAffinities[providerId] ?? 50;
}
function getAgentAffinity(providerId, agentId) {
  if (!agentId) return 50;
  const normalizedAgentId = agentId.toLowerCase();
  const agentAffinities = AGENT_PROVIDER_AFFINITY[normalizedAgentId];
  if (!agentAffinities) {
    return AGENT_PROVIDER_AFFINITY["standard"]?.[providerId] ?? 50;
  }
  return agentAffinities[providerId] ?? 50;
}
function inferTaskTypeFromDescription(description) {
  if (!description) return [];
  const lowerDesc = description.toLowerCase();
  const inferred = [];
  if (/\b(plan|roadmap|strategy|requirements|prd|spec|propose)\b/.test(lowerDesc)) {
    inferred.push("planning");
  }
  if (/\b(architect|design system|infrastructure|scalab|microservice|monolith)\b/.test(lowerDesc)) {
    inferred.push("architecture");
  }
  if (/\b(ui|ux|component|react|vue|angular|css|tailwind|responsive|layout|frontend)\b/.test(lowerDesc)) {
    inferred.push("frontend");
  }
  if (/\b(creative|visual|animation|style|theme|brand|marketing)\b/.test(lowerDesc)) {
    inferred.push("creative");
  }
  if (/\b(implement|code|write|create function|build|develop)\b/.test(lowerDesc)) {
    inferred.push("coding");
  }
  if (/\b(debug|fix|bug|error|issue|problem|troubleshoot|resolve)\b/.test(lowerDesc)) {
    inferred.push("debugging");
  }
  if (/\b(test|spec|coverage|unit|e2e|integration|verify|validate)\b/.test(lowerDesc)) {
    inferred.push("testing");
  }
  if (/\b(security|vulnerab|audit|threat|owasp|penetration|xss|injection)\b/.test(lowerDesc)) {
    inferred.push("security");
  }
  return inferred;
}
function calculateScore(provider, ctx) {
  if (!provider.healthy) {
    return UNHEALTHY_PROVIDER_PENALTY;
  }
  const normalizedPriority = clamp(provider.priority, PRIORITY_MIN, PRIORITY_MAX);
  const priorityScore = PRIORITY_BASE_SCORE - normalizedPriority * PRIORITY_SCORE_MULTIPLIER;
  const clampedRateLimit = clamp(provider.rateLimit, 0, 1);
  const rateLimitScore = (1 - clampedRateLimit) * RATE_LIMIT_SCORE_MULTIPLIER;
  const latencyScore = Math.max(0, LATENCY_BASELINE_MS - provider.latencyMs) / LATENCY_SCORE_DIVISOR;
  const successScore = provider.successRate * SUCCESS_RATE_MULTIPLIER;
  const mcpBonus = ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP ? MCP_PREFERENCE_BONUS : 0;
  const complexityFactor = ctx.complexity > COMPLEXITY_HIGH_THRESHOLD ? provider.successRate * COMPLEXITY_BONUS_MULTIPLIER : 0;
  let taskAffinityScore = getTaskAffinity(provider.id, ctx.taskType);
  const inferredTypes = inferTaskTypeFromDescription(ctx.taskDescription);
  for (const inferredType of inferredTypes) {
    const inferredAffinity = getTaskAffinity(provider.id, inferredType);
    taskAffinityScore = Math.max(taskAffinityScore, inferredAffinity);
  }
  const taskAffinityBonus = taskAffinityScore * TASK_AFFINITY_MULTIPLIER;
  const agentAffinityScore = getAgentAffinity(provider.id, ctx.agentId);
  const agentAffinityBonus = agentAffinityScore * AGENT_AFFINITY_MULTIPLIER;
  return priorityScore + rateLimitScore + latencyScore + successScore + mcpBonus + complexityFactor + taskAffinityBonus + agentAffinityBonus;
}
function getScoreReason(provider, score, ctx) {
  if (!provider.healthy) {
    return "Provider is unhealthy";
  }
  const taskAffinity = getTaskAffinity(provider.id, ctx.taskType);
  const agentAffinity = ctx.agentId ? getAgentAffinity(provider.id, ctx.agentId) : 50;
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
    return "Excellent: high success rate, low latency";
  }
  if (score > SCORE_THRESHOLD_GOOD) {
    if (ctx.preferMcp && provider.integrationMode === INTEGRATION_MODE_MCP) {
      return "Good: MCP provider with good metrics";
    }
    return "Good: balanced performance metrics";
  }
  if (score > SCORE_THRESHOLD_ACCEPTABLE) {
    return "Acceptable: meets minimum requirements";
  }
  return "Fallback: other providers unavailable";
}
function selectProvider(providers, ctx = defaultRoutingContext) {
  if (ctx.forceProvider) {
    const forced = providers.find((p) => p.id === ctx.forceProvider);
    if (forced) {
      return {
        provider: forced,
        score: FORCED_PROVIDER_SCORE,
        reason: "Forced provider selection",
        alternatives: []
      };
    }
    return {
      provider: null,
      score: 0,
      reason: `Forced provider '${ctx.forceProvider}' not found`,
      alternatives: []
    };
  }
  const available = providers.filter((p) => !ctx.excludeProviders.includes(p.id));
  const scored = available.map((p) => {
    const score = calculateScore(p, ctx);
    const reason = getScoreReason(p, score, ctx);
    return { provider: p, score, reason };
  });
  scored.sort((a, b) => b.score - a.score);
  const valid = scored.filter((s) => s.score > 0);
  if (valid.length === 0) {
    return {
      provider: null,
      score: 0,
      reason: "No healthy providers available",
      alternatives: []
    };
  }
  const best = valid[0];
  return {
    provider: best.provider,
    score: best.score,
    reason: best.reason,
    alternatives: valid.slice(1, 1 + MAX_ALTERNATIVES)
  };
}
function getFallbackOrder(providers, ctx = defaultRoutingContext) {
  return providers.filter((p) => p.healthy && !ctx.excludeProviders.includes(p.id)).map((p) => ({ provider: p, score: calculateScore(p, ctx) })).sort((a, b) => b.score - a.score).map((s) => s.provider);
}
function getBestProviderForTask(taskType) {
  const normalizedTaskType = taskType.toLowerCase();
  const affinities = TASK_PROVIDER_AFFINITY[normalizedTaskType] ?? TASK_PROVIDER_AFFINITY["general"];
  if (!affinities) return "claude";
  let bestProvider = "claude";
  let bestScore = 0;
  for (const [provider, score] of Object.entries(affinities)) {
    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
    }
  }
  return bestProvider;
}
function getBestProviderForAgent(agentId) {
  const normalizedAgentId = agentId.toLowerCase();
  const affinities = AGENT_PROVIDER_AFFINITY[normalizedAgentId] ?? AGENT_PROVIDER_AFFINITY["standard"];
  if (!affinities) return "claude";
  let bestProvider = "claude";
  let bestScore = 0;
  for (const [provider, score] of Object.entries(affinities)) {
    if (score > bestScore) {
      bestScore = score;
      bestProvider = provider;
    }
  }
  return bestProvider;
}
function getSupportedTaskTypes() {
  return Object.keys(TASK_PROVIDER_AFFINITY);
}
function getAgentsWithAffinities() {
  return Object.keys(AGENT_PROVIDER_AFFINITY);
}
function getProviderTaskAffinity(providerId, taskType) {
  return getTaskAffinity(providerId, taskType);
}
function getProviderAgentAffinity(providerId, agentId) {
  return getAgentAffinity(providerId, agentId);
}
export {
  AGENT_PROVIDER_AFFINITY,
  TASK_PROVIDER_AFFINITY,
  calculateScore,
  classifyTask,
  defaultRoutingContext,
  getAgentsWithAffinities,
  getBestProviderForAgent,
  getBestProviderForTask,
  getFallbackOrder,
  getProviderAgentAffinity,
  getProviderTaskAffinity,
  getSupportedTaskTypes,
  selectProvider
};
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
//# sourceMappingURL=routing.js.map