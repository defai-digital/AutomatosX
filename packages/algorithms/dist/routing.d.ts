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
/**
 * Three primary task classes with clear provider assignments:
 *
 * CLASS 1: PLANNING/STRATEGY → OpenAI (primary)
 *   - Product planning, roadmaps, requirements
 *   - Architecture design, system design
 *   - Strategy, research, analysis
 *   - Complex reasoning tasks
 *
 * CLASS 2: FRONTEND/CREATIVE → Gemini (primary)
 *   - UI/UX design and implementation
 *   - Frontend components (React, Vue, etc.)
 *   - Creative content, styling, animation
 *   - Visual design, branding
 *
 * CLASS 3: CODING/TECHNICAL → Claude (primary)
 *   - Backend implementation
 *   - Debugging and bug fixing
 *   - Code review and refactoring
 *   - Testing, security, DevOps
 *
 * FALLBACK: ax-cli (always last)
 *   - Universal fallback when others fail
 *   - Lower scores across all task types
 */
/**
 * Task class enumeration
 */
type TaskClass = 'planning' | 'creative' | 'technical' | 'general';
/**
 * Classify a task into one of the three primary classes
 * Handles case-insensitive matching and common task type variants.
 */
declare function classifyTask(taskType: string): TaskClass;
/**
 * Task type to provider affinity mapping
 *
 * Scoring ensures:
 * - Primary provider gets highest score (100)
 * - Secondary providers get moderate scores (60-70)
 * - ax-cli always gets lowest score (30) as fallback
 *
 * This ensures all providers get utilized based on task type.
 */
declare const TASK_PROVIDER_AFFINITY: Record<string, Record<string, number>>;
/**
 * Agent type to provider affinity
 *
 * Maps agent specialties to their best-fit providers following
 * the same three-class system.
 */
declare const AGENT_PROVIDER_AFFINITY: Record<string, Record<string, number>>;
interface Provider {
    id: string;
    priority: number;
    healthy: boolean;
    rateLimit: number;
    latencyMs: number;
    successRate: number;
    integrationMode: 'mcp' | 'sdk' | 'bash';
}
interface RoutingContext {
    taskType: string;
    complexity: number;
    preferMcp: boolean;
    excludeProviders: string[];
    forceProvider?: string;
    /** Agent ID for agent-specific provider affinity */
    agentId?: string;
    /** Original task description for keyword analysis */
    taskDescription?: string;
}
interface RoutingResult {
    provider: Provider | null;
    score: number;
    reason: string;
    alternatives: Array<{
        provider: Provider;
        score: number;
        reason: string;
    }>;
}
declare const defaultRoutingContext: RoutingContext;
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
declare function calculateScore(provider: Provider, ctx: RoutingContext): number;
/**
 * Select the best provider based on context
 */
declare function selectProvider(providers: Provider[], ctx?: RoutingContext): RoutingResult;
/**
 * Get providers sorted by preference for fallback
 */
declare function getFallbackOrder(providers: Provider[], ctx?: RoutingContext): Provider[];
/**
 * Get the best provider for a specific task type
 * Handles case-insensitive task type matching.
 */
declare function getBestProviderForTask(taskType: string): string;
/**
 * Get the best provider for a specific agent
 * Handles case-insensitive agent ID matching.
 */
declare function getBestProviderForAgent(agentId: string): string;
/**
 * Get all supported task types
 */
declare function getSupportedTaskTypes(): string[];
/**
 * Get all agents with defined provider affinities
 */
declare function getAgentsWithAffinities(): string[];
/**
 * Get affinity score for a specific provider-task combination
 */
declare function getProviderTaskAffinity(providerId: string, taskType: string): number;
/**
 * Get affinity score for a specific provider-agent combination
 */
declare function getProviderAgentAffinity(providerId: string, agentId: string): number;

export { AGENT_PROVIDER_AFFINITY, type Provider, type RoutingContext, type RoutingResult, TASK_PROVIDER_AFFINITY, type TaskClass, calculateScore, classifyTask, defaultRoutingContext, getAgentsWithAffinities, getBestProviderForAgent, getBestProviderForTask, getFallbackOrder, getProviderAgentAffinity, getProviderTaskAffinity, getSupportedTaskTypes, selectProvider };
