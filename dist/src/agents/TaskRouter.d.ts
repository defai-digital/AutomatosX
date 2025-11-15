/**
 * TaskRouter.ts
 * Intelligent natural language task parsing and agent routing
 * Phase 7: Agent System Implementation - Day 4
 */
import { AgentRegistry } from './AgentRegistry.js';
import { AgentBase } from './AgentBase.js';
import { Task } from '../types/agents.types.js';
export interface ParsedTask {
    originalDescription: string;
    intent: TaskIntent;
    keywords: string[];
    mentionedAgent?: string;
    confidence: number;
}
export type TaskIntent = 'backend-dev' | 'frontend-dev' | 'api-design' | 'database-design' | 'security-audit' | 'testing' | 'devops' | 'architecture' | 'data-engineering' | 'product-management' | 'ml-ai' | 'mobile-dev' | 'performance-opt' | 'infrastructure' | 'technical-writing' | 'research' | 'standards' | 'leadership' | 'unknown';
export declare class TaskRouter {
    private registry;
    private intentPatterns;
    private intentToAgentType;
    constructor(registry: AgentRegistry);
    /**
     * Parse natural language task description
     */
    parseTask(description: string): ParsedTask;
    /**
     * Route task to best agent
     */
    routeToAgent(task: Task): AgentBase | null;
    /**
     * Extract @mention from description (e.g., "@backend", "@security")
     */
    private extractMention;
    /**
     * Detect user intent from task description
     */
    private detectIntent;
    /**
     * Extract relevant keywords from description
     */
    private extractKeywords;
    /**
     * Calculate confidence score for routing decision
     */
    private calculateConfidence;
    /**
     * Initialize intent detection patterns
     */
    private initializeIntentPatterns;
    /**
     * Map intents to agent types
     */
    private initializeIntentMapping;
    /**
     * Get routing confidence for a task
     */
    getRoutingConfidence(task: Task): number;
    /**
     * Get suggested agents for a task (ordered by confidence)
     */
    getSuggestedAgents(task: Task, limit?: number): Array<{
        agent: AgentBase;
        confidence: number;
    }>;
}
//# sourceMappingURL=TaskRouter.d.ts.map