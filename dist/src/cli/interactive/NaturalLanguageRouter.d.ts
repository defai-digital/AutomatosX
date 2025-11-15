/**
 * AutomatosX v8.0.0 - Natural Language Router
 *
 * Routes natural language input to appropriate AutomatosX systems
 * Routes: MemoryService, WorkflowEngine, AgentRuntime, ProviderRouter
 */
import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import type { WorkflowEngineV2 } from '../../services/WorkflowEngineV2.js';
import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { ConversationContext } from './ConversationContext.js';
import { type Intent } from './IntentClassifier.js';
/**
 * Route result display format
 */
export type RouteResultFormat = 'search-results' | 'workflow-status' | 'agent-response' | 'chat-response' | 'error';
/**
 * Route result with source and display information
 */
export interface RouteResult {
    source: 'memory-service' | 'workflow-engine' | 'agent-runtime' | 'provider-router' | 'error';
    intent: Intent;
    displayFormat: RouteResultFormat;
    results?: string;
    raw?: any[];
    workflowId?: string;
    workflowName?: string;
    status?: string;
    agentName?: string;
    response?: string;
    content?: string;
    error?: string;
}
/**
 * Memory service interface (simplified for routing)
 */
interface MemoryService {
    search(query: string, options?: any): Promise<any[]>;
}
/**
 * Filesystem abstraction for testability
 */
export interface FileSystem {
    existsSync(path: string): boolean;
    readdirSync(path: string): string[];
}
/**
 * Default filesystem implementation
 */
export declare const defaultFileSystem: FileSystem;
/**
 * Natural Language Router
 *
 * Routes user input to appropriate AutomatosX system based on intent
 */
export declare class NaturalLanguageRouter {
    private memoryService;
    private workflowEngine;
    private agentRegistry;
    private providerRouter;
    private intentClassifier;
    private fs;
    constructor(memoryService: MemoryService, workflowEngine: WorkflowEngineV2, agentRegistry: AgentRegistry, providerRouter: ProviderRouterV2, fileSystem?: FileSystem);
    /**
     * Route user input to appropriate system
     */
    route(input: string, context: ConversationContext): Promise<RouteResult>;
    /**
     * ROUTE 1: Memory Service (Code Search)
     */
    private routeToMemoryService;
    /**
     * Format search results for display
     */
    private formatSearchResults;
    /**
     * ROUTE 2: Workflow Engine (Workflow Execution)
     */
    private routeToWorkflowEngine;
    /**
     * Find workflow file by name
     */
    private findWorkflowPath;
    /**
     * List available workflows
     */
    private listWorkflows;
    /**
     * ROUTE 3: Agent Runtime (Agent Delegation)
     */
    private routeToAgentRuntime;
    /**
     * List available agents
     */
    private listAgents;
    /**
     * Delegate to specific agent
     */
    private delegateToAgent;
    /**
     * ROUTE 4: Provider Router (Chat Fallback)
     */
    private routeToProviderRouter;
    /**
     * Build system prompt with context awareness
     */
    private buildSystemPrompt;
}
export {};
//# sourceMappingURL=NaturalLanguageRouter.d.ts.map