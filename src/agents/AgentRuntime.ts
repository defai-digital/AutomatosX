/**
 * AgentRuntime.ts
 *
 * Agent execution engine with context injection
 * Phase 7: Agent System Implementation - Day 1
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { AgentRegistry } from './AgentRegistry.js';
import { AgentBase } from './AgentBase.js';
import {
  Task,
  TaskResult,
  AgentContext,
  AgentExecutionOptions,
  AgentType,
  TaskStatus,
  DelegationRequest,
} from '../types/agents.types.js';
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
export class AgentRuntime extends EventEmitter {
  private registry: AgentRegistry;
  private memoryService: MemoryService;
  private fileService: FileService;
  private claudeProvider: ClaudeProvider;
  private geminiProvider: GeminiProvider;
  private openaiProvider: OpenAIProvider;
  private metrics: MetricsCollector;
  private logger: StructuredLogger;
  private tracer: DistributedTracer;
  private activeTasks: Map<string, Task> = new Map();

  constructor(
    registry: AgentRegistry,
    memoryService: MemoryService,
    fileService: FileService,
    providers: {
      claude: ClaudeProvider;
      gemini: GeminiProvider;
      openai: OpenAIProvider;
    },
    monitoring: {
      metrics: MetricsCollector;
      logger: StructuredLogger;
      tracer: DistributedTracer;
    }
  ) {
    super();
    this.registry = registry;
    this.memoryService = memoryService;
    this.fileService = fileService;
    this.claudeProvider = providers.claude;
    this.geminiProvider = providers.gemini;
    this.openaiProvider = providers.openai;
    this.metrics = monitoring.metrics;
    this.logger = monitoring.logger;
    this.tracer = monitoring.tracer;
  }

  /**
   * Execute a task with an agent
   */
  async executeTask(task: Task, options?: AgentExecutionOptions): Promise<TaskResult> {
    const taskId = task.id || randomUUID();
    task.id = taskId;

    this.logger.info(`Task execution started: ${task.description}`, 'AgentRuntime', {
      metadata: { taskId, priority: task.priority },
    });

    // Track active task
    task.status = 'running';
    task.startedAt = Date.now();
    this.activeTasks.set(taskId, task);

    try {
      // 1. Select agent
      const agent = this.selectAgent(task);

      if (!agent) {
        throw new Error(`No suitable agent found for task: ${task.description}`);
      }

      this.logger.debug(`Agent selected: ${agent.getMetadata().type}`, 'AgentRuntime', {
        metadata: { taskId, agent: agent.getMetadata().type },
      });

      // 2. Build context
      const context = await this.buildContext(task, options);

      // 3. Execute with agent
      const result = await agent.execute(task, context, options);

      // 4. Update task status
      task.status = result.success ? 'completed' : 'failed';
      task.completedAt = Date.now();
      task.result = result;

      // 5. Record metrics
      this.metrics.recordMetric('agent.task.duration', task.completedAt - task.startedAt!, {
        agent: agent.getMetadata().type,
        status: task.status,
      });

      this.logger.info(`Task execution ${task.status}: ${task.description}`, 'AgentRuntime', {
        metadata: { taskId, agent: agent.getMetadata().type, duration: task.completedAt - task.startedAt! },
      });

      this.emit('task.completed', { task, result });

      return result;
    } catch (error) {
      task.status = 'failed';
      task.completedAt = Date.now();
      task.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Task execution failed: ${task.description}`, 'AgentRuntime', {
        metadata: { taskId, error: task.error },
        error: error instanceof Error ? error : undefined,
      });

      this.emit('task.failed', { task, error });

      return {
        success: false,
        message: `Task failed: ${task.error}`,
      };
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Select best agent for task
   */
  private selectAgent(task: Task): AgentBase | null {
    if (task.assignedAgent) {
      return this.registry.get(task.assignedAgent) || null;
    }

    return this.registry.findBestAgent(task);
  }

  /**
   * Build execution context for agent
   */
  private async buildContext(task: Task, options?: AgentExecutionOptions): Promise<AgentContext> {
    const context: AgentContext = {
      task,

      // Memory access
      memory: {
        search: async (query: string) => {
          return this.memoryService.search(query, { limit: 10 });
        },
        recall: async (conversationId: string) => {
          return this.memoryService.getConversation(conversationId);
        },
        store: async (data: any) => {
          await this.memoryService.createEntry({
            content: JSON.stringify(data),
            metadata: { taskId: task.id, timestamp: Date.now() },
          });
        },
      },

      // Code intelligence access
      codeIntelligence: {
        findSymbol: async (name: string) => {
          return this.fileService.findSymbol(name);
        },
        getCallGraph: async (functionName: string) => {
          return this.fileService.getCallGraph(functionName);
        },
        searchCode: async (query: string) => {
          return this.fileService.search(query);
        },
        analyzeQuality: async (filePath: string) => {
          return this.fileService.analyzeQuality(filePath);
        },
      },

      // Provider access
      provider: {
        call: async (prompt: string, providerOptions?: any) => {
          return this.callProvider(prompt, options?.provider, providerOptions);
        },
        stream: async function* (prompt: string, providerOptions?: any) {
          // Streaming not implemented yet - return single response
          const response = await this.call(prompt, providerOptions);
          yield response;
        },
      },

      // Delegation
      delegate: async (agentType: AgentType, taskDescription: string) => {
        return this.delegateTask(agentType, taskDescription, task);
      },

      // Monitoring
      monitoring: {
        recordMetric: (name: string, value: number) => {
          this.metrics.recordMetric(name, value, { taskId: task.id });
        },
        startTrace: () => {
          return this.tracer.startTrace(task.id);
        },
        startSpan: (traceId: string, name: string) => {
          return this.tracer.startSpan(traceId, name, 'internal');
        },
        completeSpan: (spanId: string) => {
          this.tracer.completeSpan(spanId);
        },
        log: (level: string, message: string) => {
          const logMethod = this.logger[level as keyof StructuredLogger];
          if (typeof logMethod === 'function') {
            (logMethod as any).call(this.logger, message, 'AgentContext', {
              metadata: { taskId: task.id },
            });
          }
        },
      },
    };

    return context;
  }

  /**
   * Call AI provider
   */
  private async callProvider(
    prompt: string,
    preferredProvider?: 'claude' | 'gemini' | 'openai',
    options?: any
  ): Promise<string> {
    const provider = preferredProvider || 'claude'; // Default to Claude

    try {
      let selectedProvider;
      switch (provider) {
        case 'claude':
          selectedProvider = this.claudeProvider;
          break;
        case 'gemini':
          selectedProvider = this.geminiProvider;
          break;
        case 'openai':
          selectedProvider = this.openaiProvider;
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      const response = await selectedProvider.request({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
      });

      return response.content;
    } catch (error) {
      this.logger.error(`Provider call failed: ${provider}`, 'AgentRuntime', {
        error: error instanceof Error ? error : undefined,
      });
      throw error;
    }
  }

  /**
   * Delegate task to another agent
   */
  private async delegateTask(
    agentType: AgentType,
    taskDescription: string,
    parentTask: Task
  ): Promise<TaskResult> {
    this.logger.info(`Delegating task to @${agentType}`, 'AgentRuntime', {
      metadata: { parentTaskId: parentTask.id, targetAgent: agentType },
    });

    const delegatedTask: Task = {
      id: randomUUID(),
      description: taskDescription,
      priority: parentTask.priority,
      status: 'pending',
      assignedAgent: agentType,
      context: {
        ...parentTask.context,
        delegatedFrom: parentTask.id,
      },
      createdAt: Date.now(),
    };

    // Execute delegated task
    const result = await this.executeTask(delegatedTask);

    return result;
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): Task[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Cancel task
   */
  cancelTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);

    if (task) {
      task.status = 'cancelled';
      task.completedAt = Date.now();
      this.activeTasks.delete(taskId);
      this.emit('task.cancelled', { task });
      return true;
    }

    return false;
  }

  /**
   * Get runtime statistics
   */
  getStats(): {
    activeTasks: number;
    totalAgents: number;
    registryInitialized: boolean;
  } {
    return {
      activeTasks: this.activeTasks.size,
      totalAgents: this.registry.size(),
      registryInitialized: this.registry.isInitialized(),
    };
  }
}
