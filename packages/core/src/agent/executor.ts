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

// =============================================================================
// Executor Constants
// =============================================================================

/** Default execution timeout in milliseconds (5 minutes) */
const DEFAULT_EXECUTION_TIMEOUT_MS = 300_000;

/** Maximum delegation depth */
const MAX_DELEGATION_DEPTH = 3;

/** Default agent for tasks without specific agent */
const DEFAULT_AGENT_ID = 'standard';

// =============================================================================
// Imports
// =============================================================================

import {
  type AgentProfile,
  type ExecutionRequest,
  type ExecutionResponse,
  type DelegationRequest,
  type DelegationResult,
  type Session,
  type SessionTask,
  type SessionIdType,
  DelegationRequestSchema,
  DelegationResultSchema,
  SessionId,
} from '@ax/schemas';

/**
 * Parse a session ID string to the branded SessionId type.
 * Falls back to casting if not a valid UUID (for backward compatibility with tests).
 */
function parseSessionId(sessionId: string): SessionIdType {
  const result = SessionId.safeParse(sessionId);
  if (result.success) {
    return result.data;
  }
  // Fallback for non-UUID session IDs (backward compatibility)
  return sessionId as SessionIdType;
}

/**
 * Safely invoke an event callback, catching and logging any errors.
 */
function safeInvokeEvent<T extends unknown[]>(
  eventName: string,
  callback: ((...args: T) => void) | undefined,
  ...args: T
): void {
  if (!callback) return;
  try {
    callback(...args);
  } catch (error) {
    console.error(
      `[ax/executor] Event callback "${eventName}" threw an error:`,
      error instanceof Error ? error.message : error
    );
  }
}

import { type ProviderRouter } from '../router/provider-router.js';
import { type SessionManager } from '../session/manager.js';
import { type MemoryManager } from '../memory/manager.js';
import { type AgentRegistry } from './registry.js';

// =============================================================================
// Types
// =============================================================================

export interface AgentExecutorOptions {
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

export interface ExecuteOptions {
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

export interface ExecutionResult {
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

export interface AgentExecutorEvents {
  onExecutionStart?: (agentId: string, task: string) => void;
  onExecutionEnd?: (result: ExecutionResult) => void;
  onDelegation?: (from: string, to: string, task: string) => void;
  onError?: (agentId: string, error: Error) => void;
}

// =============================================================================
// Agent Executor Class
// =============================================================================

export class AgentExecutor {
  private readonly router: ProviderRouter;
  private readonly sessionManager: SessionManager;
  private readonly agentRegistry: AgentRegistry;
  private readonly memoryManager: MemoryManager | null;
  private readonly defaultTimeout: number;
  private readonly events: AgentExecutorEvents = {};

  constructor(options: AgentExecutorOptions) {
    this.router = options.router;
    this.sessionManager = options.sessionManager;
    this.agentRegistry = options.agentRegistry;
    this.memoryManager = options.memoryManager ?? null;
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  }

  // =============================================================================
  // Public Methods
  // =============================================================================

  /**
   * Execute a task with a specific agent
   */
  async execute(
    agentId: string,
    task: string,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    // Validate task is not empty
    if (!task || task.trim() === '') {
      throw new Error('Task description cannot be empty');
    }

    // Get or create session
    const session = options.sessionId
      ? await this.sessionManager.getOrThrow(options.sessionId)
      : await this.sessionManager.create({
          name: `Task: ${task.slice(0, 50)}${task.length > 50 ? '...' : ''}`,
          agents: [agentId],
        });

    // Validate agent exists
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      // Fall back to default agent if available
      const defaultAgent = this.agentRegistry.get(DEFAULT_AGENT_ID);
      if (!defaultAgent) {
        throw new Error(
          `Agent "${agentId}" not found and fallback agent "${DEFAULT_AGENT_ID}" is also unavailable. ` +
          `Available agents: ${this.agentRegistry.getAll().map(a => a.name).join(', ') || 'none'}`
        );
      }
      console.warn(`[ax/executor] Agent "${agentId}" not found, using "${DEFAULT_AGENT_ID}"`);
      return this.executeWithAgent(defaultAgent, task, session, options);
    }

    return this.executeWithAgent(agent, task, session, options);
  }

  /**
   * Execute a task with automatic agent selection
   */
  async executeAuto(
    task: string,
    options: ExecuteOptions = {}
  ): Promise<ExecutionResult> {
    // Validate task is not empty
    if (!task || task.trim() === '') {
      throw new Error('Task description cannot be empty');
    }

    // Infer task type and find suitable agent
    const taskType = this.inferTaskType(task);
    const candidates = this.agentRegistry.findForTask(taskType);

    if (candidates.length === 0) {
      // Fall back to default agent
      return this.execute(DEFAULT_AGENT_ID, task, options);
    }

    // Select best candidate (first match for now)
    const selectedAgent = candidates[0]!;
    return this.execute(selectedAgent.name, task, options);
  }

  /**
   * Delegate a task from one agent to another
   */
  async delegate(request: DelegationRequest): Promise<DelegationResult> {
    const validated = DelegationRequestSchema.parse(request);
    const startTime = Date.now();

    // Check delegation depth
    const currentDepth = validated.context.delegationChain.length;
    if (currentDepth >= MAX_DELEGATION_DEPTH) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Maximum delegation depth (${MAX_DELEGATION_DEPTH}) exceeded`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent,
      });
    }

    // Check for circular delegation (agent delegating to itself or to an agent already in chain)
    if (validated.context.delegationChain.includes(validated.toAgent) || validated.toAgent === validated.fromAgent) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Circular delegation detected: "${validated.toAgent}" is already in the delegation chain`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent,
      });
    }

    // Verify target agent can receive delegations
    const targetAgent = this.agentRegistry.get(validated.toAgent);
    if (!targetAgent) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: `Target agent not found: ${validated.toAgent}`,
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent,
      });
    }

    // Verify source agent can delegate
    const sourceAgent = this.agentRegistry.get(validated.fromAgent);
    if (sourceAgent) {
      const maxDepth = sourceAgent.orchestration?.maxDelegationDepth ?? 0;
      if (maxDepth === 0) {
        return DelegationResultSchema.parse({
          success: false,
          request: validated,
          error: `Agent "${validated.fromAgent}" is not allowed to delegate`,
          duration: Date.now() - startTime,
          completedBy: validated.fromAgent,
        });
      }
    }

    safeInvokeEvent('onDelegation', this.events.onDelegation, validated.fromAgent, validated.toAgent, validated.task);

    try {
      // Execute with target agent
      const executeOptions: ExecuteOptions = {
        timeout: validated.options.timeout,
        context: validated.context.sharedData,
        delegationChain: [...validated.context.delegationChain, validated.fromAgent],
      };
      // Only set sessionId if it exists
      if (validated.context.sessionId) {
        executeOptions.sessionId = validated.context.sessionId;
      }
      const result = await this.execute(validated.toAgent, validated.task, executeOptions);

      return DelegationResultSchema.parse({
        success: result.response.success,
        request: validated,
        result: result.response.output,
        error: result.response.error,
        duration: Date.now() - startTime,
        completedBy: validated.toAgent,
      });
    } catch (error) {
      return DelegationResultSchema.parse({
        success: false,
        request: validated,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        completedBy: validated.fromAgent,
      });
    }
  }

  /**
   * Set event handlers
   */
  setEvents(events: AgentExecutorEvents): void {
    Object.assign(this.events, events);
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Execute task with a specific agent profile
   */
  private async executeWithAgent(
    agent: AgentProfile,
    task: string,
    session: Session,
    options: ExecuteOptions
  ): Promise<ExecutionResult> {
    const agentId = agent.name;
    safeInvokeEvent('onExecutionStart', this.events.onExecutionStart, agentId, task);

    // Add task to session
    const sessionTask = await this.sessionManager.addTask({
      sessionId: parseSessionId(session.id),
      description: task,
      agentId,
      metadata: {
        delegationChain: options.delegationChain ?? [],
      },
    });

    // Start task
    await this.sessionManager.startTask(session.id, sessionTask.id);

    // Build execution request with agent context
    const request: ExecutionRequest = {
      task: this.buildPrompt(agent, task, options.context),
      agent: agentId,
      context: {
        systemPrompt: agent.systemPrompt,
        abilities: agent.abilities,
        personality: agent.personality,
        delegationChain: options.delegationChain ?? [],
        ...options.context,
      },
      timeout: options.timeout ?? this.defaultTimeout,
      stream: options.stream ?? false,
      priority: 'normal',
    };

    try {
      // Route and execute
      const response = await this.router.route(request);

      // Update task based on result
      if (response.success) {
        await this.sessionManager.completeTask(session.id, sessionTask.id, response.output);
      } else {
        await this.sessionManager.failTask(session.id, sessionTask.id, response.error ?? 'Unknown error');
      }

      // Save to memory if enabled
      if (options.saveToMemory !== false && this.memoryManager && response.success) {
        this.saveToMemory(agentId, task, response.output, session.id);
      }

      // Get updated session
      const updatedSession = await this.sessionManager.getOrThrow(session.id);
      const updatedTask = updatedSession.tasks.find(t => t.id === sessionTask.id);
      if (!updatedTask) {
        throw new Error(`Task ${sessionTask.id} not found in session ${session.id} after execution`);
      }

      const result: ExecutionResult = {
        response,
        session: updatedSession,
        task: updatedTask,
        agentId,
        delegated: (options.delegationChain?.length ?? 0) > 0,
      };

      safeInvokeEvent('onExecutionEnd', this.events.onExecutionEnd, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.sessionManager.failTask(session.id, sessionTask.id, errorMessage);

      safeInvokeEvent('onError', this.events.onError, agentId, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  /**
   * Build prompt with agent context
   */
  private buildPrompt(
    agent: AgentProfile,
    task: string,
    additionalContext?: Record<string, unknown>
  ): string {
    const parts: string[] = [];

    // Add system prompt context
    if (agent.systemPrompt) {
      parts.push(`[Agent Context]\n${agent.systemPrompt}\n`);
    }

    // Add personality context
    if (agent.personality) {
      const { traits, communicationStyle, catchphrase } = agent.personality;
      parts.push(`[Communication]\nStyle: ${communicationStyle}\nTraits: ${traits.join(', ')}`);
      if (catchphrase) {
        parts.push(`Catchphrase: "${catchphrase}"`);
      }
      parts.push('');
    }

    // Add abilities context
    if (agent.abilities.length > 0) {
      parts.push(`[Abilities]\n${agent.abilities.join(', ')}\n`);
    }

    // Add additional context (with circular reference protection)
    if (additionalContext && Object.keys(additionalContext).length > 0) {
      try {
        const seen = new WeakSet();
        const json = JSON.stringify(additionalContext, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
          }
          return value;
        }, 2);
        parts.push(`[Additional Context]\n${json}\n`);
      } catch (error) {
        parts.push(`[Additional Context]\n[Failed to serialize: ${error instanceof Error ? error.message : 'Unknown error'}]\n`);
      }
    }

    // Add the task
    parts.push(`[Task]\n${task}`);

    return parts.join('\n');
  }

  /**
   * Infer task type from description
   */
  private inferTaskType(task: string): string {
    const lowerTask = task.toLowerCase();

    if (lowerTask.includes('code') || lowerTask.includes('implement') || lowerTask.includes('write function')) {
      return 'coding';
    }
    if (lowerTask.includes('test') || lowerTask.includes('verify') || lowerTask.includes('validate')) {
      return 'testing';
    }
    if (lowerTask.includes('review') || lowerTask.includes('analyze') || lowerTask.includes('audit')) {
      return 'review';
    }
    if (lowerTask.includes('design') || lowerTask.includes('architect') || lowerTask.includes('plan')) {
      return 'design';
    }
    if (lowerTask.includes('document') || lowerTask.includes('explain') || lowerTask.includes('describe')) {
      return 'documentation';
    }
    if (lowerTask.includes('fix') || lowerTask.includes('debug') || lowerTask.includes('resolve')) {
      return 'debugging';
    }
    if (lowerTask.includes('security') || lowerTask.includes('vulnerabilit') || lowerTask.includes('threat')) {
      return 'security';
    }

    return 'general';
  }

  /**
   * Save execution result to memory
   */
  private saveToMemory(
    agentId: string,
    task: string,
    result: string,
    sessionId: string
  ): void {
    if (!this.memoryManager) return;

    try {
      this.memoryManager.add({
        content: `Task: ${task}\n\nResult: ${result}`,
        metadata: {
          type: 'task',
          source: 'agent-execution',
          agentId,
          sessionId,
          tags: ['execution', agentId],
          importance: 0.5,
        },
      });
    } catch (error) {
      console.warn(
        `[ax/executor] Failed to save to memory: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new agent executor instance
 */
export function createAgentExecutor(options: AgentExecutorOptions): AgentExecutor {
  return new AgentExecutor(options);
}
