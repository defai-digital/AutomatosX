/**
 * AgentRuntime.ts
 *
 * Agent execution engine with context injection
 * Phase 7: Agent System Implementation - Day 1
 */
import { EventEmitter } from 'events';
import { AgentRegistry } from './AgentRegistry.js';
import { Task, TaskResult, AgentExecutionOptions } from '../types/agents.types.js';
import { MemoryService } from '../memory/MemoryService.js';
import { FileService } from '../services/FileService.js';
import { ClaudeProvider } from '../providers/ClaudeProvider.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { MetricsCollector } from '../monitoring/MetricsCollector.js';
import { StructuredLogger } from '../monitoring/StructuredLogger.js';
import { DistributedTracer } from '../monitoring/DistributedTracer.js';
/**
 * AgentRuntime - Execution engine for agents
 *
 * Responsibilities:
 * - Context construction (inject dependencies)
 * - Task execution coordination
 * - Provider routing
 * - Monitoring integration
 * - Error handling
 */
export declare class AgentRuntime extends EventEmitter {
    private registry;
    private memoryService;
    private fileService;
    private claudeProvider;
    private geminiProvider;
    private openaiProvider;
    private metrics;
    private logger;
    private tracer;
    private activeTasks;
    constructor(registry: AgentRegistry, memoryService: MemoryService, fileService: FileService, providers: {
        claude: ClaudeProvider;
        gemini: GeminiProvider;
        openai: OpenAIProvider;
    }, monitoring: {
        metrics: MetricsCollector;
        logger: StructuredLogger;
        tracer: DistributedTracer;
    });
    /**
     * Execute a task with an agent
     */
    executeTask(task: Task, options?: AgentExecutionOptions): Promise<TaskResult>;
    /**
     * Select best agent for task
     */
    private selectAgent;
    /**
     * Build execution context for agent
     */
    private buildContext;
    /**
     * Call AI provider
     */
    private callProvider;
    /**
     * Delegate task to another agent
     */
    private delegateTask;
    /**
     * Get active tasks
     */
    getActiveTasks(): Task[];
    /**
     * Get task by ID
     */
    getTask(taskId: string): Task | undefined;
    /**
     * Cancel task
     */
    cancelTask(taskId: string): boolean;
    /**
     * Get runtime statistics
     */
    getStats(): {
        activeTasks: number;
        totalAgents: number;
        registryInitialized: boolean;
    };
}
//# sourceMappingURL=AgentRuntime.d.ts.map