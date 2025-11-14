/**
 * WorkflowAgentBridge.ts
 *
 * Bridge between workflow engine and agent system with 3-tier routing
 * Day 3: Full implementation with explicit, type-based, and semantic routing
 *
 * Routing Strategy:
 * - Tier 1 (90% confidence): Explicit agent field in step definition
 * - Tier 2 (70% confidence): Step type inference from keywords
 * - Tier 3 (60% confidence): Semantic matching via TaskRouter
 */
import { WorkflowContext } from '../types/schemas/workflow.schema.js';
import Database from 'better-sqlite3';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { TaskRouter } from '../agents/TaskRouter.js';
import { AgentBase } from '../agents/AgentBase.js';
/**
 * Step execution result
 */
export interface StepExecutionResult {
    stepId: string;
    success: boolean;
    output?: Record<string, unknown>;
    error?: string;
    duration: number;
    agentUsed?: string;
    tier?: 'explicit' | 'type' | 'semantic';
    confidence?: number;
    retryCount?: number;
}
/**
 * Agent selection result
 */
export interface AgentSelection {
    agent: AgentBase;
    tier: 'explicit' | 'type' | 'semantic';
    confidence: number;
    reason: string;
}
/**
 * Retry configuration
 */
interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    retryableErrors: string[];
}
/**
 * WorkflowAgentBridge - Route workflow steps to appropriate agents
 *
 * Implements 3-tier routing strategy:
 * 1. Explicit agent field (highest priority)
 * 2. Step type inference from keywords
 * 3. Semantic matching via TaskRouter (fallback)
 */
export declare class WorkflowAgentBridge {
    private db;
    private registry;
    private router;
    private retryConfig;
    constructor(db?: Database.Database, registry?: AgentRegistry, router?: TaskRouter);
    /**
     * Execute a workflow step with 3-tier agent routing
     *
     * @param step - Workflow step definition
     * @param context - Execution context with variables and previous results
     * @returns Step execution result
     */
    executeStep(step: any, context: WorkflowContext): Promise<StepExecutionResult>;
    /**
     * Select best agent for step using 3-tier routing
     *
     * Tier 1 (Explicit): Check step.agent field
     * Tier 2 (Type): Infer from step structure and keywords
     * Tier 3 (Semantic): Use TaskRouter for semantic matching
     *
     * @param step - Workflow step
     * @returns Agent selection with confidence and tier
     */
    private selectAgent;
    /**
     * Detect step type hints from prompt keywords
     *
     * @param step - Workflow step
     * @returns Step type hints for agent selection
     */
    private detectStepType;
    /**
     * Select agent based on step type hints
     *
     * @param hints - Step type hints
     * @returns Agent selection or null if no match
     */
    private selectAgentByType;
    /**
     * Execute step with agent using retry logic
     *
     * Implements exponential backoff retry strategy for transient failures.
     *
     * @param agent - Selected agent
     * @param step - Workflow step
     * @param context - Execution context
     * @param maxRetries - Maximum number of retries
     * @returns Execution result
     */
    private executeWithRetry;
    /**
     * Check if error is retryable
     *
     * @param error - Error to check
     * @returns true if error should be retried
     */
    private isRetryableError;
    /**
     * Sleep for specified milliseconds
     *
     * @param ms - Milliseconds to sleep
     */
    private sleep;
    /**
     * Check if step can be executed by an agent
     *
     * @param step - Workflow step
     * @returns true if agent can handle step
     */
    canExecuteStep(step: any): boolean;
    /**
     * Get recommended agent for step (async version of selectAgent)
     *
     * @param step - Workflow step
     * @returns Agent name or 'unknown'
     */
    getRecommendedAgent(step: any): Promise<string>;
    /**
     * Get all possible agents for step with confidence scores
     *
     * @param step - Workflow step
     * @param limit - Maximum number of suggestions
     * @returns Array of agent suggestions
     */
    getSuggestedAgents(step: any, limit?: number): Promise<Array<{
        agent: string;
        confidence: number;
        reason: string;
    }>>;
    /**
     * Update retry configuration
     *
     * @param config - Partial retry configuration
     */
    setRetryConfig(config: Partial<RetryConfig>): void;
    /**
     * Get current retry configuration
     *
     * @returns Retry configuration
     */
    getRetryConfig(): RetryConfig;
}
export {};
//# sourceMappingURL=WorkflowAgentBridge.d.ts.map