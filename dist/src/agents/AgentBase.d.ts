/**
 * AgentBase.ts
 *
 * Base class for all AI agents
 * Phase 7: Agent System Implementation - Day 1
 */
import { EventEmitter } from 'events';
import { AgentMetadata, AgentContext, Task, TaskResult, AgentExecutionOptions } from '../types/agents.types.js';
/**
 * AgentBase - Abstract base class for all agents
 *
 * Provides:
 * - Standard execution interface
 * - Context management
 * - Error handling and retry logic
 * - Event emission for monitoring
 */
export declare abstract class AgentBase extends EventEmitter {
    protected metadata: AgentMetadata;
    constructor(metadata: AgentMetadata);
    /**
     * Get agent metadata
     */
    getMetadata(): AgentMetadata;
    /**
     * Get agent name
     */
    getName(): string;
    /**
     * Execute a task
     * This is the main entry point for agent execution
     */
    execute(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    /**
     * Execute task with timeout
     */
    private executeWithTimeout;
    /**
     * Execute task (implemented by subclasses)
     */
    protected abstract executeTask(task: Task, context: AgentContext, options?: AgentExecutionOptions): Promise<TaskResult>;
    /**
     * Build prompt for AI provider
     */
    protected buildPrompt(task: Task, context: AgentContext): string;
    /**
     * Get system prompt (describes agent role and capabilities)
     */
    protected getSystemPrompt(): string;
    /**
     * Get task prompt
     */
    protected getTaskPrompt(task: Task): string;
    /**
     * Get context prompt (additional context from memory, code, etc.)
     */
    protected getContextPrompt(context: AgentContext): string;
    /**
     * Call AI provider
     */
    protected callProvider(prompt: string, context: AgentContext, options?: AgentExecutionOptions): Promise<string>;
    /**
     * Check if task matches agent capabilities
     */
    canHandle(task: Task): number;
    /**
     * Suggest delegation if task is outside specialization
     */
    protected suggestDelegation(task: Task): string | null;
}
//# sourceMappingURL=AgentBase.d.ts.map