/**
 * AutomatosX v8.0.0 - Natural Language Router
 *
 * Routes natural language input to appropriate AutomatosX systems
 * Routes: MemoryService, WorkflowEngine, AgentRuntime, ProviderRouter
 */

import * as path from 'path';
import * as fs from 'fs';
import type { ProviderRouterV2 } from '../../services/ProviderRouterV2.js';
import type { WorkflowEngineV2 } from '../../services/WorkflowEngineV2.js';
import type { AgentRegistry } from '../../agents/AgentRegistry.js';
import type { ConversationContext } from './ConversationContext.js';
import { IntentClassifier, type Intent } from './IntentClassifier.js';

/**
 * Route result display format
 */
export type RouteResultFormat =
  | 'search-results'
  | 'workflow-status'
  | 'agent-response'
  | 'chat-response'
  | 'error';

/**
 * Route result with source and display information
 */
export interface RouteResult {
  source: 'memory-service' | 'workflow-engine' | 'agent-runtime' | 'provider-router' | 'error';
  intent: Intent;
  displayFormat: RouteResultFormat;

  // Search results
  results?: string;
  raw?: any[];

  // Workflow execution
  workflowId?: string;
  workflowName?: string;
  status?: string;

  // Agent delegation
  agentName?: string;
  response?: string;

  // Chat response
  content?: string;

  // Error
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
export const defaultFileSystem: FileSystem = {
  existsSync: fs.existsSync,
  readdirSync: fs.readdirSync
};

/**
 * Natural Language Router
 *
 * Routes user input to appropriate AutomatosX system based on intent
 */
export class NaturalLanguageRouter {
  private intentClassifier: IntentClassifier;
  private fs: FileSystem;

  constructor(
    private memoryService: MemoryService,
    private workflowEngine: WorkflowEngineV2,
    private agentRegistry: AgentRegistry,
    private providerRouter: ProviderRouterV2,
    fileSystem?: FileSystem
  ) {
    this.intentClassifier = new IntentClassifier(providerRouter);
    this.fs = fileSystem || defaultFileSystem;
  }

  /**
   * Route user input to appropriate system
   */
  async route(input: string, context: ConversationContext): Promise<RouteResult> {
    try {
      // Classify intent
      const intent = await this.intentClassifier.classify(input);

      // Route based on intent type
      switch (intent.type) {
        case 'memory-search':
          return await this.routeToMemoryService(input, intent, context);

        case 'workflow-execute':
          return await this.routeToWorkflowEngine(input, intent, context);

        case 'agent-delegate':
          return await this.routeToAgentRuntime(input, intent, context);

        case 'chat':
        default:
          return await this.routeToProviderRouter(input, intent, context);
      }
    } catch (error) {
      return {
        source: 'error',
        intent: { type: 'chat', confidence: 0, method: 'pattern' },
        displayFormat: 'error',
        error: (error as Error).message
      };
    }
  }

  /**
   * ROUTE 1: Memory Service (Code Search)
   */
  private async routeToMemoryService(
    input: string,
    intent: Intent,
    context: ConversationContext
  ): Promise<RouteResult> {
    try {
      const query = intent.extractedData?.query || input;

      // Execute memory search
      const results = await this.memoryService.search(query, {
        limit: 10,
        includeContent: true
      });

      // Format results for display
      const formattedResults = this.formatSearchResults(results, query);

      // Add to conversation context
      context.addMessage('user', input);
      context.addMessage('assistant', `Found ${results.length} results for "${query}":\n\n${formattedResults}`);

      return {
        source: 'memory-service',
        intent,
        displayFormat: 'search-results',
        results: formattedResults,
        raw: results
      };
    } catch (error) {
      const errorMsg = `Memory search failed: ${(error as Error).message}`;
      context.addMessage('user', input);
      context.addMessage('assistant', errorMsg);

      return {
        source: 'memory-service',
        intent,
        displayFormat: 'error',
        error: errorMsg
      };
    }
  }

  /**
   * Format search results for display
   */
  private formatSearchResults(results: any[], query: string): string {
    if (results.length === 0) {
      return `No results found for "${query}".`;
    }

    const lines: string[] = [];
    results.forEach((result, i) => {
      // Format: "1. src/auth/AuthService.ts:45 - authenticate(credentials)"
      const location = `${result.file || 'unknown'}:${result.line || '?'}`;
      const name = result.name || result.symbol || 'unknown';
      lines.push(`${i + 1}. ${location} - ${name}`);

      // Add preview if available
      if (result.preview) {
        lines.push(`   ${result.preview.trim()}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * ROUTE 2: Workflow Engine (Workflow Execution)
   */
  private async routeToWorkflowEngine(
    input: string,
    intent: Intent,
    context: ConversationContext
  ): Promise<RouteResult> {
    try {
      const workflowName = intent.extractedData?.workflowName || '';

      // Find workflow file
      const workflowPath = await this.findWorkflowPath(workflowName);

      if (!workflowPath) {
        const availableWorkflows = await this.listWorkflows();
        const errorMsg = `Workflow "${workflowName}" not found.\n\nAvailable workflows: ${availableWorkflows}`;

        context.addMessage('user', input);
        context.addMessage('assistant', errorMsg);

        return {
          source: 'workflow-engine',
          intent,
          displayFormat: 'error',
          error: errorMsg
        };
      }

      // Execute workflow (async)
      const result = await this.workflowEngine.executeWorkflowFromFile(workflowPath);

      // Add to conversation context
      const successMsg = `Started workflow: ${workflowName}\nID: ${result.executionId}\nState: ${result.state}\n\nUse /workflow status ${result.executionId} to check progress.`;
      context.addMessage('user', input);
      context.addMessage('assistant', successMsg);

      // Store workflow ID in context
      context.setVariable('lastWorkflowId', result.executionId);
      context.setActiveWorkflow(workflowName);

      return {
        source: 'workflow-engine',
        intent,
        displayFormat: 'workflow-status',
        workflowId: result.executionId,
        workflowName,
        status: result.state
      };
    } catch (error) {
      const errorMsg = `Workflow execution failed: ${(error as Error).message}`;
      context.addMessage('user', input);
      context.addMessage('assistant', errorMsg);

      return {
        source: 'workflow-engine',
        intent,
        displayFormat: 'error',
        error: errorMsg
      };
    }
  }

  /**
   * Find workflow file by name
   */
  private async findWorkflowPath(name: string): Promise<string | null> {
    // Search in workflows/ directory
    const workflowsDir = path.join(process.cwd(), 'workflows');

    if (!this.fs.existsSync(workflowsDir)) {
      return null;
    }

    const files = this.fs.readdirSync(workflowsDir);

    // Normalize name for matching (spaces -> dashes)
    const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

    // Exact match (case-insensitive, normalized)
    const exactMatch = files.find(f => {
      const baseName = f.replace(/\.(yaml|yml)$/i, '');
      const normalizedBaseName = baseName.toLowerCase().replace(/\s+/g, '-');
      return normalizedBaseName === normalizedName;
    });

    if (exactMatch) {
      return path.join(workflowsDir, exactMatch);
    }

    // Partial match (case-insensitive, normalized, contains)
    const partialMatch = files.find(f => {
      const baseName = f.replace(/\.(yaml|yml)$/i, '');
      const normalizedBaseName = baseName.toLowerCase().replace(/\s+/g, '-');
      return normalizedBaseName.includes(normalizedName) &&
             (f.endsWith('.yaml') || f.endsWith('.yml'));
    });

    if (partialMatch) {
      return path.join(workflowsDir, partialMatch);
    }

    return null;
  }

  /**
   * List available workflows
   */
  private async listWorkflows(): Promise<string> {
    const workflowsDir = path.join(process.cwd(), 'workflows');

    if (!this.fs.existsSync(workflowsDir)) {
      return 'none (workflows/ directory not found)';
    }

    const files = this.fs.readdirSync(workflowsDir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => f.replace(/\.(yaml|yml)$/, ''));

    return files.length > 0 ? files.join(', ') : 'none';
  }

  /**
   * ROUTE 3: Agent Runtime (Agent Delegation)
   */
  private async routeToAgentRuntime(
    input: string,
    intent: Intent,
    context: ConversationContext
  ): Promise<RouteResult> {
    try {
      const agentName = intent.extractedData?.agentName || '';

      // Get agent from registry
      const agent = this.agentRegistry.get(agentName as any);

      if (!agent) {
        const availableAgents = this.listAgents();
        const errorMsg = `Agent "${agentName}" not found.\n\nAvailable agents: ${availableAgents}`;

        context.addMessage('user', input);
        context.addMessage('assistant', errorMsg);

        return {
          source: 'agent-runtime',
          intent,
          displayFormat: 'error',
          error: errorMsg
        };
      }

      // Set active agent in context
      context.setActiveAgent(agentName);

      // Delegate to agent
      const response = await this.delegateToAgent(agent, input, context);

      // Add to conversation context
      context.addMessage('user', input);
      context.addMessage('assistant', response);

      return {
        source: 'agent-runtime',
        intent,
        displayFormat: 'agent-response',
        agentName,
        response
      };
    } catch (error) {
      const errorMsg = `Agent delegation failed: ${(error as Error).message}`;
      context.addMessage('user', input);
      context.addMessage('assistant', errorMsg);

      return {
        source: 'agent-runtime',
        intent,
        displayFormat: 'error',
        error: errorMsg
      };
    }
  }

  /**
   * List available agents
   */
  private listAgents(): string {
    const agents = this.agentRegistry.getAll();
    return agents.map(a => a.getMetadata().name).join(', ');
  }

  /**
   * Delegate to specific agent
   */
  private async delegateToAgent(
    agent: any,
    input: string,
    context: ConversationContext
  ): Promise<string> {
    // Build messages with agent context
    const metadata = agent.getMetadata();
    const systemPrompt = `You are ${metadata.name}, ${metadata.description || 'an AI assistant'}.`;

    const messages = [
      {
        role: 'system' as const,
        content: systemPrompt
      },
      ...context.getRecentMessages(5).map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    // Call provider with agent context
    const response = await this.providerRouter.request({
      messages,
      temperature: 0.7,
      maxTokens: 2000
    });

    return response.content;
  }

  /**
   * ROUTE 4: Provider Router (Chat Fallback)
   */
  private async routeToProviderRouter(
    input: string,
    intent: Intent,
    context: ConversationContext
  ): Promise<RouteResult> {
    try {
      // Add user message to context
      context.addMessage('user', input);

      // Build conversation history
      const messages = [
        {
          role: 'system' as const,
          content: this.buildSystemPrompt(context)
        },
        ...context.getRecentMessages(5).map(m => ({
          role: m.role,
          content: m.content
        }))
      ];

      // Call AI provider
      const response = await this.providerRouter.request({
        messages,
        temperature: 0.7,
        maxTokens: 2000
      });

      // Add assistant response to context
      context.addMessage('assistant', response.content);

      return {
        source: 'provider-router',
        intent,
        displayFormat: 'chat-response',
        content: response.content
      };
    } catch (error) {
      const errorMsg = `Chat failed: ${(error as Error).message}`;
      context.addMessage('assistant', errorMsg);

      return {
        source: 'provider-router',
        intent,
        displayFormat: 'error',
        error: errorMsg
      };
    }
  }

  /**
   * Build system prompt with context awareness
   */
  private buildSystemPrompt(context: ConversationContext): string {
    const activeAgent = context.getActiveAgent();

    if (activeAgent) {
      const agent = this.agentRegistry.get(activeAgent as any);
      if (agent) {
        const metadata = agent.getMetadata();
        return `You are ${activeAgent}, ${metadata.description || 'an AI assistant'}.`;
      }
    }

    return `You are a helpful AI assistant for AutomatosX, a code intelligence and workflow automation system.

You have access to these capabilities:
- Code search: Users can find code with natural language like "find authentication logic"
- Workflow execution: Users can run workflows like "run security audit"
- Agent delegation: Users can use specialized agents like "use BackendAgent"

When users ask about code or workflows, suggest using these natural language commands instead of giving generic advice.`;
  }
}
