/**
 * AgentExecutor - Main orchestration engine for agent execution
 * Combines ProfileLoader, AbilitiesManager, ContextManager, and TeamManager
 * Restores v7.6.1 agent execution for v8.x
 */
import { type ContextOptions } from './ContextManager.js';
/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
    agent: string;
    task: string;
    context?: ContextOptions;
    verbose?: boolean;
    stream?: boolean;
}
/**
 * Agent execution result
 */
export interface AgentExecutionResult {
    success: boolean;
    response?: string;
    error?: Error;
    metadata: {
        agent: string;
        task: string;
        timestamp: Date;
        duration: number;
        provider?: string;
        abilities: number;
    };
}
/**
 * Main agent execution orchestrator
 */
export declare class AgentExecutor {
    private messagesConfig;
    private runtimeConfig;
    private profileLoader;
    private abilitiesManager;
    private contextManager;
    private teamManager;
    private providerRouter;
    constructor(projectRoot?: string);
    /**
     * Execute an agent task
     */
    execute(options: AgentExecutionOptions): Promise<AgentExecutionResult>;
    /**
     * Build execution metadata
     */
    private buildExecutionMetadata;
    /**
     * Build complete system prompt from profile, abilities, and context
     */
    private buildSystemPrompt;
    /**
     * Execute task with AI provider
     */
    private executeWithProvider;
    /**
     * List all available agents
     */
    listAgents(): Promise<Array<{
        name: string;
        displayName?: string;
        role: string;
        description: string;
        team?: string;
        abilities: number;
    }>>;
    /**
     * Clear all caches (useful for testing and hot reload)
     * BUG FIX #34: Also clear configuration caches
     */
    clearCaches(): void;
}
//# sourceMappingURL=AgentExecutor.d.ts.map