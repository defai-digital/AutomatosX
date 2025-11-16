/**
 * ContextManager - Build execution context for agent tasks
 * Provides environment and workspace information
 */
/**
 * Memory entry structure
 */
export interface MemoryEntry {
    id: string;
    content: string;
    timestamp: Date;
    relevance?: number;
}
/**
 * Session context structure
 */
export interface SessionContext {
    id: string;
    name: string;
    agents: string[];
    createdAt: Date;
}
export interface ExecutionContext {
    task: string;
    timestamp: Date;
    cwd: string;
    environment: string;
    memory?: MemoryEntry[];
    session?: SessionContext;
}
export interface ContextOptions {
    memory?: boolean;
    session?: string;
    verbose?: boolean;
}
/**
 * Manages execution context for agent tasks
 */
export declare class ContextManager {
    private messagesConfig;
    constructor();
    /**
     * Build execution context from task and options
     */
    buildContext(task: string, options?: ContextOptions): Promise<ExecutionContext>;
    /**
     * Format context for inclusion in prompts
     */
    formatContextForPrompt(context: ExecutionContext): string;
}
//# sourceMappingURL=ContextManager.d.ts.map