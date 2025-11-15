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
import { getDatabase } from '../database/connection.js';
import { AgentRegistry } from '../agents/AgentRegistry.js';
import { TaskRouter } from '../agents/TaskRouter.js';
import { randomUUID } from 'crypto';
/**
 * WorkflowAgentBridge - Route workflow steps to appropriate agents
 *
 * Implements 3-tier routing strategy:
 * 1. Explicit agent field (highest priority)
 * 2. Step type inference from keywords
 * 3. Semantic matching via TaskRouter (fallback)
 */
export class WorkflowAgentBridge {
    db;
    registry;
    router;
    retryConfig;
    constructor(db, registry, router) {
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
     * Create a Task object from a description
     */
    createTask(description, priority = 'normal', context = {}) {
        return {
            id: randomUUID(),
            description,
            priority,
            status: 'pending',
            context,
            createdAt: Date.now(),
        };
    }
    /**
     * Execute a workflow step with 3-tier agent routing
     *
     * @param step - Workflow step definition
     * @param context - Execution context with variables and previous results
     * @returns Step execution result
     */
    async executeStep(step, context) {
        const startTime = Date.now();
        try {
            // Select agent using 3-tier routing strategy
            const selection = await this.selectAgent(step);
            // Execute with retry logic
            const result = await this.executeWithRetry(selection.agent, step, context, this.retryConfig.maxRetries);
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
        }
        catch (error) {
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
    async selectAgent(step) {
        // Tier 1: Explicit agent field (90% confidence)
        if (step.agent) {
            const agent = this.registry.get(step.agent);
            if (!agent) {
                throw new Error(`Agent not found in registry: ${step.agent}. ` +
                    `Available agents: ${this.registry.getAll().map(a => a.getName()).join(', ')}`);
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
        const semanticAgent = this.router.routeToAgent(this.createTask(step.prompt, 'normal', {}));
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
    detectStepType(step) {
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
    selectAgentByType(hints) {
        // Calculate keyword density for each agent type
        const scores = [];
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
                agentType: 'architecture', // Fixed: Correct AgentType is 'architecture' not 'architect'
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
    async executeWithRetry(agent, step, context, maxRetries) {
        let lastError = null;
        let delay = this.retryConfig.initialDelayMs;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Execute step with agent
                const task = this.createTask(step.prompt, 'normal', {
                    workflowContext: context,
                    stepKey: step.key,
                    stepName: step.name,
                    dependencies: step.dependencies || [],
                });
                // Create empty AgentContext (minimal implementation)
                const agentContext = {
                    task,
                    memory: { search: async () => [], recall: async () => null, store: async () => { } },
                    codeIntelligence: { findSymbol: async () => [], getCallGraph: async () => null, searchCode: async () => [], analyzeQuality: async () => null },
                    provider: { call: async () => '' },
                };
                const result = await agent.execute(task, agentContext);
                return result.data;
            }
            catch (error) {
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
    isRetryableError(error) {
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
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Check if step can be executed by an agent
     *
     * @param step - Workflow step
     * @returns true if agent can handle step
     */
    canExecuteStep(step) {
        try {
            // Try to select agent - if successful, step can be executed
            const selection = this.selectAgent(step);
            return selection !== null;
        }
        catch {
            return false;
        }
    }
    /**
     * Get recommended agent for step (async version of selectAgent)
     *
     * @param step - Workflow step
     * @returns Agent name or 'unknown'
     */
    async getRecommendedAgent(step) {
        try {
            const selection = await this.selectAgent(step);
            return selection.agent.getName();
        }
        catch {
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
    async getSuggestedAgents(step, limit = 3) {
        const suggestions = [];
        // Add explicit agent if present
        if (step.agent) {
            const agent = this.registry.get(step.agent);
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
        const task = this.createTask(step.prompt, 'normal', {});
        const semanticSuggestions = this.router.getSuggestedAgents(task, limit);
        for (const suggestion of semanticSuggestions) {
            suggestions.push({
                agent: suggestion.agent.getName(),
                confidence: suggestion.confidence,
                reason: 'Semantic matching',
            });
        }
        // Deduplicate and sort by confidence
        const uniqueSuggestions = new Map();
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
    setRetryConfig(config) {
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
    getRetryConfig() {
        return { ...this.retryConfig };
    }
}
//# sourceMappingURL=WorkflowAgentBridge.js.map