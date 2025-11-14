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
import { getDatabase } from '../database/connection.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { TaskRouter } from '../agents/TaskRouter.js';
import { AgentBase } from '../agents/AgentBase.js';
import { type AgentType } from '../types/agents.types.js';

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
 * Step type hints for Tier 2 routing
 */
interface StepTypeHints {
  hasApiKeywords: boolean;
  hasDatabaseKeywords: boolean;
  hasSecurityKeywords: boolean;
  hasUIKeywords: boolean;
  hasTestKeywords: boolean;
  hasDeploymentKeywords: boolean;
  hasDocumentationKeywords: boolean;
  hasArchitectureKeywords: boolean;
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
export class WorkflowAgentBridge {
  private db: Database.Database;
  private registry: AgentRegistry;
  private router: TaskRouter;
  private retryConfig: RetryConfig;

  constructor(db?: Database.Database, registry?: AgentRegistry, router?: TaskRouter) {
    this.db = db || getDatabase();
    this.registry = registry || new AgentRegistry();
    this.router = router || new TaskRouter(this.registry);

    // Default retry configuration
    this.retryConfig = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        'rate_limit',
        'timeout',
        'network_error',
        'temporary_unavailable',
      ],
    };
  }

  /**
   * Execute a workflow step with 3-tier agent routing
   *
   * @param step - Workflow step definition
   * @param context - Execution context with variables and previous results
   * @returns Step execution result
   */
  async executeStep(step: any, context: WorkflowContext): Promise<StepExecutionResult> {
    const startTime = Date.now();

    try {
      // Select agent using 3-tier routing strategy
      const selection = await this.selectAgent(step);

      // Execute with retry logic
      const result = await this.executeWithRetry(
        selection.agent,
        step,
        context,
        this.retryConfig.maxRetries
      );

      return {
        stepId: step.key,
        success: true,
        output: result,
        duration: Date.now() - startTime,
        agentUsed: selection.agent.getName(),
        tier: selection.tier,
        confidence: selection.confidence,
        retryCount: 0, // TODO: Track actual retry count
      };
    } catch (error) {
      return {
        stepId: step.key,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

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
  private async selectAgent(step: any): Promise<AgentSelection> {
    // Tier 1: Explicit agent field (90% confidence)
    if (step.agent) {
      const agent = this.registry.get(step.agent as AgentType);

      if (!agent) {
        throw new Error(
          `Agent not found in registry: ${step.agent}. ` +
          `Available agents: ${this.registry.getAll().map(a => a.getName()).join(', ')}`
        );
      }

      return {
        agent,
        tier: 'explicit',
        confidence: 0.95,
        reason: `Explicit agent assignment: ${step.agent}`,
      };
    }

    // Tier 2: Step type inference (70% confidence)
    const typeHints = this.detectStepType(step);
    const typeAgent = this.selectAgentByType(typeHints);

    if (typeAgent) {
      return {
        agent: typeAgent.agent,
        tier: 'type',
        confidence: typeAgent.confidence,
        reason: typeAgent.reason,
      };
    }

    // Tier 3: Semantic matching via TaskRouter (60% confidence)
    const semanticAgent = this.router.routeToAgent({
      description: step.prompt,
      context: {},
      priority: 'normal',
    });

    if (semanticAgent) {
      return {
        agent: semanticAgent,
        tier: 'semantic',
        confidence: 0.60,
        reason: `Semantic matching on prompt: "${step.prompt.substring(0, 50)}..."`,
      };
    }

    // Fallback: Use general-purpose backend agent
    const fallback = this.registry.get('backend');
    if (!fallback) {
      throw new Error('No suitable agent found and fallback backend agent is missing');
    }

    return {
      agent: fallback,
      tier: 'semantic',
      confidence: 0.40,
      reason: 'Fallback to general-purpose backend agent',
    };
  }

  /**
   * Detect step type hints from prompt keywords
   *
   * @param step - Workflow step
   * @returns Step type hints for agent selection
   */
  private detectStepType(step: any): StepTypeHints {
    const promptLower = step.prompt.toLowerCase();

    return {
      hasApiKeywords: /\b(api|rest|graphql|endpoint|route|http|request)\b/i.test(promptLower),
      hasDatabaseKeywords: /\b(database|sql|schema|query|table|migration|orm)\b/i.test(promptLower),
      hasSecurityKeywords: /\b(security|auth|authentication|authorization|vulnerability|encrypt|ssl|tls)\b/i.test(promptLower),
      hasUIKeywords: /\b(ui|interface|component|frontend|react|vue|angular|html|css)\b/i.test(promptLower),
      hasTestKeywords: /\b(test|testing|coverage|qa|quality|unit|integration|e2e)\b/i.test(promptLower),
      hasDeploymentKeywords: /\b(deploy|deployment|ci\/cd|docker|kubernetes|k8s|container)\b/i.test(promptLower),
      hasDocumentationKeywords: /\b(document|documentation|readme|guide|tutorial|api docs)\b/i.test(promptLower),
      hasArchitectureKeywords: /\b(architecture|design|pattern|structure|system design)\b/i.test(promptLower),
    };
  }

  /**
   * Select agent based on step type hints
   *
   * @param hints - Step type hints
   * @returns Agent selection or null if no match
   */
  private selectAgentByType(hints: StepTypeHints): AgentSelection | null {
    // Calculate keyword density for each agent type
    const scores: Array<{ agentType: AgentType; score: number; reason: string[] }> = [];

    if (hints.hasApiKeywords) {
      scores.push({
        agentType: 'backend',
        score: 0.80,
        reason: ['API/REST/endpoint keywords detected'],
      });
    }

    if (hints.hasDatabaseKeywords) {
      scores.push({
        agentType: 'backend',
        score: 0.75,
        reason: ['Database/SQL keywords detected'],
      });
    }

    if (hints.hasSecurityKeywords) {
      scores.push({
        agentType: 'security',
        score: 0.85,
        reason: ['Security/auth keywords detected'],
      });
    }

    if (hints.hasUIKeywords) {
      scores.push({
        agentType: 'frontend',
        score: 0.80,
        reason: ['UI/component keywords detected'],
      });
    }

    if (hints.hasTestKeywords) {
      scores.push({
        agentType: 'quality',
        score: 0.75,
        reason: ['Testing/QA keywords detected'],
      });
    }

    if (hints.hasDeploymentKeywords) {
      scores.push({
        agentType: 'devops',
        score: 0.80,
        reason: ['Deployment/CI/CD keywords detected'],
      });
    }

    if (hints.hasDocumentationKeywords) {
      scores.push({
        agentType: 'writer',
        score: 0.70,
        reason: ['Documentation keywords detected'],
      });
    }

    if (hints.hasArchitectureKeywords) {
      scores.push({
        agentType: 'architect',
        score: 0.75,
        reason: ['Architecture/design keywords detected'],
      });
    }

    // Sort by score and get best match
    if (scores.length === 0) {
      return null;
    }

    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    const agent = this.registry.get(best.agentType);
    if (!agent) {
      return null; // Agent not in registry
    }

    return {
      agent,
      tier: 'type',
      confidence: best.score,
      reason: best.reason.join(', '),
    };
  }

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
  private async executeWithRetry(
    agent: AgentBase,
    step: any,
    context: WorkflowContext,
    maxRetries: number
  ): Promise<Record<string, unknown>> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute step with agent
        const result = await agent.execute({
          description: step.prompt,
          context: {
            workflowContext: context,
            stepKey: step.key,
            stepName: step.name,
            dependencies: step.dependencies || [],
          },
          priority: 'normal',
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        const isRetryable = this.isRetryableError(lastError);

        // Don't retry on last attempt or if not retryable
        if (attempt === maxRetries || !isRetryable) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        await this.sleep(delay);
        delay = Math.min(delay * this.retryConfig.backoffMultiplier, this.retryConfig.maxDelayMs);
      }
    }

    throw lastError || new Error('Execution failed with unknown error');
  }

  /**
   * Check if error is retryable
   *
   * @param error - Error to check
   * @returns true if error should be retried
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    for (const retryableError of this.retryConfig.retryableErrors) {
      if (errorMessage.includes(retryableError.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if step can be executed by an agent
   *
   * @param step - Workflow step
   * @returns true if agent can handle step
   */
  canExecuteStep(step: any): boolean {
    try {
      // Try to select agent - if successful, step can be executed
      const selection = this.selectAgent(step);
      return selection !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get recommended agent for step (async version of selectAgent)
   *
   * @param step - Workflow step
   * @returns Agent name or 'unknown'
   */
  async getRecommendedAgent(step: any): Promise<string> {
    try {
      const selection = await this.selectAgent(step);
      return selection.agent.getName();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get all possible agents for step with confidence scores
   *
   * @param step - Workflow step
   * @param limit - Maximum number of suggestions
   * @returns Array of agent suggestions
   */
  async getSuggestedAgents(step: any, limit: number = 3): Promise<Array<{ agent: string; confidence: number; reason: string }>> {
    const suggestions: Array<{ agent: string; confidence: number; reason: string }> = [];

    // Add explicit agent if present
    if (step.agent) {
      const agent = this.registry.get(step.agent as AgentType);
      if (agent) {
        suggestions.push({
          agent: agent.getName(),
          confidence: 0.95,
          reason: 'Explicit assignment',
        });
      }
    }

    // Add type-based suggestions
    const typeHints = this.detectStepType(step);
    const typeAgent = this.selectAgentByType(typeHints);
    if (typeAgent) {
      suggestions.push({
        agent: typeAgent.agent.getName(),
        confidence: typeAgent.confidence,
        reason: typeAgent.reason,
      });
    }

    // Add semantic suggestions from TaskRouter
    const task = {
      description: step.prompt,
      context: {},
      priority: 'normal' as const,
    };

    const semanticSuggestions = this.router.getSuggestedAgents(task, limit);
    for (const suggestion of semanticSuggestions) {
      suggestions.push({
        agent: suggestion.agent.getName(),
        confidence: suggestion.confidence,
        reason: 'Semantic matching',
      });
    }

    // Deduplicate and sort by confidence
    const uniqueSuggestions = new Map<string, { confidence: number; reason: string }>();
    for (const suggestion of suggestions) {
      const existing = uniqueSuggestions.get(suggestion.agent);
      if (!existing || existing.confidence < suggestion.confidence) {
        uniqueSuggestions.set(suggestion.agent, {
          confidence: suggestion.confidence,
          reason: suggestion.reason,
        });
      }
    }

    return Array.from(uniqueSuggestions.entries())
      .map(([agent, { confidence, reason }]) => ({ agent, confidence, reason }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Update retry configuration
   *
   * @param config - Partial retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config,
    };
  }

  /**
   * Get current retry configuration
   *
   * @returns Retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }
}
