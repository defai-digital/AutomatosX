import { AgentProfile, ExecutionResponse, Session, SessionTask, DelegationRequest, DelegationResult } from '@ax/schemas';
import { ProviderRouter } from '../router/index.js';
import { SessionManager } from '../session/index.js';
import { MemoryManager } from '../memory/index.js';
import '@ax/algorithms';
import '@ax/providers';

/**
 * Agent Loader - Load agent profiles from YAML files
 *
 * Loads and validates agent profiles from the .automatosx/agents directory.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

interface AgentLoaderOptions {
    /** Base path to .automatosx directory */
    basePath: string;
    /** Watch for file changes */
    watchForChanges?: boolean;
}
interface LoadedAgent {
    /** Agent profile data */
    profile: AgentProfile;
    /** File path where agent was loaded from */
    filePath: string;
    /** Load timestamp */
    loadedAt: Date;
}
interface AgentLoadError {
    /** Agent ID (from filename) */
    agentId: string;
    /** File path */
    filePath: string;
    /** Error message */
    error: string;
}
declare class AgentLoader {
    private readonly basePath;
    private readonly agentsPath;
    private readonly loadedAgents;
    private readonly loadErrors;
    constructor(options: AgentLoaderOptions);
    /**
     * Load all agent profiles from the agents directory
     */
    loadAll(): Promise<{
        agents: LoadedAgent[];
        errors: AgentLoadError[];
    }>;
    /**
     * Load a specific agent by ID
     */
    loadAgent(agentId: string): Promise<LoadedAgent | null>;
    /**
     * Load agent from a specific file path
     */
    loadAgentFromPath(filePath: string): Promise<LoadedAgent | null>;
    /**
     * Get a loaded agent by ID
     */
    get(agentId: string): LoadedAgent | undefined;
    /**
     * Get all loaded agents
     */
    getAll(): LoadedAgent[];
    /**
     * Get all agent IDs
     */
    getIds(): string[];
    /**
     * Check if an agent exists
     */
    has(agentId: string): boolean;
    /**
     * Get load errors
     */
    getErrors(): AgentLoadError[];
    /**
     * Reload all agents
     */
    reload(): Promise<{
        agents: LoadedAgent[];
        errors: AgentLoadError[];
    }>;
    /**
     * Reload a specific agent
     */
    reloadAgent(agentId: string): Promise<LoadedAgent | null>;
    /**
     * Load an agent from a file in the agents directory
     */
    private loadAgentFile;
}
/**
 * Create a new agent loader instance
 */
declare function createAgentLoader(options: AgentLoaderOptions): AgentLoader;

/**
 * Agent Registry - Central registry for agent profiles
 *
 * Provides fast lookup and querying of agent profiles with
 * support for teams, abilities, and filtering.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

interface AgentFilter {
    /** Filter by team */
    team?: string;
    /** Filter by ability */
    ability?: string;
    /** Filter by any of these abilities */
    abilities?: string[];
    /** Filter by communication style */
    communicationStyle?: 'formal' | 'casual' | 'technical';
    /** Filter by max delegation depth (agents that can delegate) */
    canDelegate?: boolean;
}
interface AgentRegistryOptions {
    /** Agent loader instance */
    loader: AgentLoader;
}
interface AgentRegistryEvents {
    onAgentRegistered?: (agent: AgentProfile) => void;
    onAgentRemoved?: (agentId: string) => void;
    onReloaded?: (agents: AgentProfile[]) => void;
}
declare class AgentRegistry {
    private readonly loader;
    private readonly agents;
    private readonly byTeam;
    private readonly byAbility;
    private readonly events;
    private initialized;
    constructor(options: AgentRegistryOptions);
    /**
     * Initialize registry by loading all agents
     */
    initialize(): Promise<{
        loaded: number;
        errors: AgentLoadError[];
    }>;
    /**
     * Reload all agents from disk
     */
    reload(): Promise<{
        loaded: number;
        errors: AgentLoadError[];
    }>;
    /**
     * Register an agent profile
     */
    registerAgent(profile: AgentProfile): void;
    /**
     * Remove an agent from registry
     */
    removeAgent(agentId: string): boolean;
    /**
     * Get agent by ID
     */
    get(agentId: string): AgentProfile | undefined;
    /**
     * Get agent by ID (throws if not found)
     */
    getOrThrow(agentId: string): AgentProfile;
    /**
     * Check if agent exists
     */
    has(agentId: string): boolean;
    /**
     * Get all agents
     */
    getAll(): AgentProfile[];
    /**
     * Get all agent IDs
     */
    getIds(): string[];
    /**
     * Get agent count
     */
    get size(): number;
    /**
     * Find agents matching filter criteria
     */
    find(filter: AgentFilter): AgentProfile[];
    /**
     * Get agents by team
     */
    getByTeam(team: string): AgentProfile[];
    /**
     * Get all team names
     */
    getTeams(): string[];
    /**
     * Get agents by ability
     */
    getByAbility(ability: string): AgentProfile[];
    /**
     * Get all available abilities
     */
    getAbilities(): string[];
    /**
     * Find agents that can perform a specific task type
     */
    findForTask(taskType: string): AgentProfile[];
    /**
     * Set event handlers
     */
    setEvents(events: AgentRegistryEvents): void;
}
/**
 * Create a new agent registry instance
 */
declare function createAgentRegistry(options: AgentRegistryOptions): AgentRegistry;

/**
 * Agent Executor - Task execution engine for agents
 *
 * Executes tasks using agent profiles with support for
 * delegation, session tracking, and memory integration.
 *
 * @module @ax/core/agent
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

interface AgentExecutorOptions {
    /** Provider router for task execution */
    router: ProviderRouter;
    /** Session manager for tracking */
    sessionManager: SessionManager;
    /** Agent registry for profile lookup */
    agentRegistry: AgentRegistry;
    /** Memory manager for persistence (optional) */
    memoryManager?: MemoryManager;
    /** Default timeout in milliseconds */
    defaultTimeout?: number;
}
interface ExecuteOptions {
    /** Session ID to use (creates new session if not provided) */
    sessionId?: string | undefined;
    /** Execution timeout in milliseconds */
    timeout?: number | undefined;
    /** Enable streaming output */
    stream?: boolean | undefined;
    /** Additional context to include */
    context?: Record<string, unknown> | undefined;
    /** Delegation chain (for tracking depth) */
    delegationChain?: string[] | undefined;
    /** Save result to memory */
    saveToMemory?: boolean | undefined;
}
interface ExecutionResult {
    /** Execution response from provider */
    response: ExecutionResponse;
    /** Session used for execution */
    session: Session;
    /** Task created in session */
    task: SessionTask;
    /** Agent that executed the task */
    agentId: string;
    /** Whether task was delegated */
    delegated: boolean;
}
interface AgentExecutorEvents {
    onExecutionStart?: (agentId: string, task: string) => void;
    onExecutionEnd?: (result: ExecutionResult) => void;
    onDelegation?: (from: string, to: string, task: string) => void;
    onError?: (agentId: string, error: Error) => void;
}
declare class AgentExecutor {
    private readonly router;
    private readonly sessionManager;
    private readonly agentRegistry;
    private readonly memoryManager;
    private readonly defaultTimeout;
    private readonly events;
    constructor(options: AgentExecutorOptions);
    /**
     * Execute a task with a specific agent
     */
    execute(agentId: string, task: string, options?: ExecuteOptions): Promise<ExecutionResult>;
    /**
     * Execute a task with automatic agent selection
     */
    executeAuto(task: string, options?: ExecuteOptions): Promise<ExecutionResult>;
    /**
     * Delegate a task from one agent to another
     */
    delegate(request: DelegationRequest): Promise<DelegationResult>;
    /**
     * Set event handlers
     */
    setEvents(events: AgentExecutorEvents): void;
    /**
     * Execute task with a specific agent profile
     */
    private executeWithAgent;
    /**
     * Build prompt with agent context
     */
    private buildPrompt;
    /**
     * Infer task type from description
     */
    private inferTaskType;
    /**
     * Save execution result to memory
     */
    private saveToMemory;
}
/**
 * Create a new agent executor instance
 */
declare function createAgentExecutor(options: AgentExecutorOptions): AgentExecutor;

export { AgentExecutor, type AgentExecutorEvents, type AgentExecutorOptions, type AgentFilter, type AgentLoadError, AgentLoader, type AgentLoaderOptions, AgentRegistry, type AgentRegistryEvents, type AgentRegistryOptions, type ExecuteOptions, type ExecutionResult, type LoadedAgent, createAgentExecutor, createAgentLoader, createAgentRegistry };
