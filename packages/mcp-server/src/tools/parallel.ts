/**
 * Parallel Agent Execution MCP Tools
 *
 * Tools for executing multiple agents in parallel with DAG-based
 * dependency management and result aggregation.
 * Integrates with trace store for dashboard visibility.
 *
 * INV-MCP-001: All inputs validated via Zod schemas
 * INV-MCP-002: Side effects documented in descriptions
 */

import { randomUUID } from 'node:crypto';
import type { MCPTool, ToolHandler, MCPToolResult } from '../types.js';
import {
  type AgentParallelTask,
  type AgentParallelExecutionConfig,
  type ExecutionPlan,
  type TraceEvent,
  type TraceHierarchy,
  createAgentParallelTask,
  ParallelExecutionErrorCodes,
  getErrorMessage,
  createRootTraceHierarchy,
  TIMEOUT_AGENT_STEP_DEFAULT,
  TIMEOUT_AGENT_STEP_MAX,
} from '@defai.digital/contracts';
import {
  createAgentParallelOrchestrator,
  type AgentExecutorPort,
  type AgentExecuteResult,
} from '@defai.digital/agent-parallel';
import { getSharedRegistry, getSharedExecutor } from '../registry-accessor.js';
import { getTraceStore } from '../bootstrap.js';

// ============================================================================
// Agent Executor Adapter
// ============================================================================

/**
 * Creates an agent executor port that wraps the shared executor
 */
async function createAgentExecutorPort(): Promise<AgentExecutorPort> {
  const registry = await getSharedRegistry();
  const executor = await getSharedExecutor();

  return {
    async execute(request: {
      agentId: string;
      input: unknown;
      provider?: string;
      model?: string;
      timeout?: number;
      sessionId?: string;
    }): Promise<AgentExecuteResult> {
      const startTime = Date.now();
      try {
        const executeOptions: {
          provider?: string;
          model?: string;
          timeout?: number;
          sessionId?: string;
        } = {};
        if (request.provider) executeOptions.provider = request.provider;
        if (request.model) executeOptions.model = request.model;
        if (request.timeout) executeOptions.timeout = request.timeout;
        if (request.sessionId) executeOptions.sessionId = request.sessionId;

        const result = await executor.execute(request.agentId, request.input, executeOptions);

        const executeResult: AgentExecuteResult = {
          success: result.success,
          agentId: result.agentId,
          output: result.output,
          durationMs: result.totalDurationMs ?? Date.now() - startTime,
        };
        if (result.error?.message) executeResult.error = result.error.message;
        if (result.error?.code) executeResult.errorCode = result.error.code;
        return executeResult;
      } catch (error) {
        return {
          success: false,
          agentId: request.agentId,
          error: getErrorMessage(error),
          durationMs: Date.now() - startTime,
        };
      }
    },

    async exists(agentId: string): Promise<boolean> {
      const agent = await registry.get(agentId);
      return agent !== undefined;
    },
  };
}

// Cached orchestrator instance - uses Promise to prevent race conditions
let _orchestratorPromise: Promise<Awaited<ReturnType<typeof createAgentParallelOrchestrator>>> | null = null;

/**
 * Get or create the parallel orchestrator
 * Uses Promise caching to prevent race conditions when multiple concurrent
 * requests try to initialize the orchestrator simultaneously.
 * Clears cache on failure so subsequent calls can retry initialization.
 */
async function getOrchestrator() {
  if (_orchestratorPromise === null) {
    // Cache the Promise immediately to prevent race conditions
    _orchestratorPromise = (async () => {
      try {
        const agentExecutor = await createAgentExecutorPort();
        return createAgentParallelOrchestrator({
          agentExecutor,
        });
      } catch (error) {
        // Clear cache on failure so subsequent calls can retry
        _orchestratorPromise = null;
        throw error;
      }
    })();
  }
  return _orchestratorPromise;
}

/**
 * Reset orchestrator (for testing)
 */
export function resetOrchestrator(): void {
  _orchestratorPromise = null;
}

// ============================================================================
// parallel_run Tool
// ============================================================================

/**
 * Parallel run tool definition
 * INV-MCP-002: Side effects - executes multiple agent workflows
 * INV-APE-001: Respects maxConcurrentAgents
 * INV-APE-002: Honors dependencies
 */
export const parallelRunTool: MCPTool = {
  name: 'parallel_run',
  description: `Execute multiple agents in parallel with DAG-based dependency management. Supports configurable concurrency, failure strategies, and result aggregation. SIDE EFFECTS: Creates new agent executions, may modify session state and emit trace events.`,
  inputSchema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Agent ID to execute',
            },
            input: {
              type: 'object',
              description: 'Input data for the agent',
            },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Task IDs this task depends on (must complete first)',
            },
            priority: {
              type: 'number',
              description: 'Execution priority (higher = earlier in same layer)',
              minimum: 0,
              maximum: 100,
              default: 50,
            },
            timeout: {
              type: 'number',
              description: 'Timeout override for this task in ms',
              minimum: 1000,
              maximum: 7200000,
            },
            provider: {
              type: 'string',
              description: 'Provider override for this task',
            },
          },
          required: ['agentId'],
        },
        minItems: 1,
        maxItems: 100,
        description: 'Tasks to execute in parallel',
      },
      config: {
        type: 'object',
        properties: {
          maxConcurrentAgents: {
            type: 'number',
            description: 'Maximum concurrent agents (default: 5)',
            minimum: 1,
            maximum: 10,
            default: 5,
          },
          agentTimeout: {
            type: 'number',
            description: `Default timeout per agent in ms (default: ${TIMEOUT_AGENT_STEP_DEFAULT} / 20 min, max: ${TIMEOUT_AGENT_STEP_MAX} / 60 min)`,
            minimum: 1000,
            maximum: TIMEOUT_AGENT_STEP_MAX,
            default: TIMEOUT_AGENT_STEP_DEFAULT,
          },
          failureStrategy: {
            type: 'string',
            enum: ['failFast', 'failSafe', 'continueOnError'],
            description: 'How to handle failures (default: failSafe)',
            default: 'failSafe',
          },
          resultAggregation: {
            type: 'string',
            enum: ['merge', 'list', 'firstSuccess'],
            description: 'How to aggregate results (default: merge)',
            default: 'merge',
          },
          shareContext: {
            type: 'boolean',
            description: 'Share context between agents (default: true)',
            default: true,
          },
        },
        description: 'Execution configuration',
      },
      sharedContext: {
        type: 'object',
        description: 'Shared context for all agents (read-only during execution)',
      },
      sessionId: {
        type: 'string',
        description: 'Session ID for tracking',
      },
    },
    required: ['tasks'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      groupId: { type: 'string', description: 'Unique execution group ID' },
      allSucceeded: { type: 'boolean', description: 'Whether all tasks succeeded' },
      tasksExecuted: { type: 'number', description: 'Number of tasks executed' },
      tasksSkipped: { type: 'number', description: 'Number of tasks skipped' },
      totalDurationMs: { type: 'number', description: 'Total duration in ms' },
      aggregatedOutput: { type: 'object', description: 'Aggregated output based on strategy' },
      taskResults: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            agentId: { type: 'string' },
            status: { type: 'string' },
            success: { type: 'boolean' },
            output: { type: 'object' },
            error: { type: 'string' },
            durationMs: { type: 'number' },
          },
        },
        description: 'Individual task results',
      },
      failedTasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Failed task IDs',
      },
      layerCount: { type: 'number', description: 'Number of execution layers' },
      peakConcurrency: { type: 'number', description: 'Maximum concurrent tasks reached' },
    },
    required: ['groupId', 'allSucceeded', 'tasksExecuted', 'totalDurationMs', 'taskResults'],
  },
  idempotent: false,
};

/**
 * Handler for parallel_run tool
 * Records traces for dashboard visibility - high-value multi-agent orchestration
 */
export const handleParallelRun: ToolHandler = async (args): Promise<MCPToolResult> => {
  const {
    tasks: rawTasks,
    config,
    sharedContext,
    sessionId,
  } = args as {
    tasks: Array<{
      agentId: string;
      input?: unknown;
      dependencies?: string[];
      priority?: number;
      timeout?: number;
      provider?: string;
    }>;
    config?: Partial<AgentParallelExecutionConfig>;
    sharedContext?: Record<string, unknown>;
    sessionId?: string;
  };

  // Get trace store and create trace context
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();
  const traceHierarchy: TraceHierarchy = createRootTraceHierarchy(traceId, sessionId);

  const taskCount = rawTasks?.length ?? 0;
  const agentIds = rawTasks?.map(t => t.agentId) ?? [];

  // Emit run.start trace event
  const startEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTime,
    context: {
      workflowId: 'parallel-run',
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      tool: 'parallel_run',
      taskCount,
      agentIds: agentIds.slice(0, 10), // Limit to first 10 for payload size
      failureStrategy: config?.failureStrategy ?? 'failSafe',
      maxConcurrentAgents: config?.maxConcurrentAgents ?? 5,
    },
  };
  await traceStore.write(startEvent);

  // Validate tasks
  if (!rawTasks || rawTasks.length === 0) {
    // Emit run.end trace event for validation failure
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'failure',
      context: {
        workflowId: 'parallel-run',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: 'at least one task is required',
        tool: 'parallel_run',
      },
    });

    return {
      content: [{ type: 'text', text: 'Error: at least one task is required' }],
      isError: true,
    };
  }

  if (rawTasks.length > 100) {
    // Emit run.end trace event for validation failure
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'failure',
      context: {
        workflowId: 'parallel-run',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: 'maximum 100 tasks allowed',
        taskCount: rawTasks.length,
        tool: 'parallel_run',
      },
    });

    return {
      content: [{ type: 'text', text: 'Error: maximum 100 tasks allowed' }],
      isError: true,
    };
  }

  try {
    // Create tasks with generated IDs
    const taskIdMap = new Map<number, string>();
    const tasks: AgentParallelTask[] = rawTasks.map((rawTask, index) => {
      const taskId = randomUUID();
      taskIdMap.set(index, taskId);
      const taskOptions: Partial<Omit<AgentParallelTask, 'taskId' | 'agentId' | 'input'>> = {};
      if (rawTask.priority !== undefined) taskOptions.priority = rawTask.priority;
      if (rawTask.timeout !== undefined) taskOptions.timeout = rawTask.timeout;
      if (rawTask.provider !== undefined) taskOptions.provider = rawTask.provider;
      return createAgentParallelTask(rawTask.agentId, rawTask.input ?? {}, taskOptions);
    });

    // Resolve dependencies (convert indices to task IDs)
    for (let i = 0; i < rawTasks.length; i++) {
      const rawTask = rawTasks[i]!;
      if (rawTask.dependencies && rawTask.dependencies.length > 0) {
        // Dependencies can be indices (as strings) or task IDs
        const resolvedDeps: string[] = [];
        for (const dep of rawTask.dependencies) {
          const depIndex = parseInt(dep, 10);
          if (!isNaN(depIndex) && taskIdMap.has(depIndex)) {
            resolvedDeps.push(taskIdMap.get(depIndex)!);
          } else if (tasks.some((t) => t.taskId === dep)) {
            resolvedDeps.push(dep);
          } else {
            // INV-TR-013: Emit run.end trace event for validation failure
            await traceStore.write({
              eventId: randomUUID(),
              traceId,
              type: 'run.end',
              timestamp: new Date().toISOString(),
              durationMs: Date.now() - new Date(startTime).getTime(),
              status: 'failure',
              context: {
                workflowId: 'parallel-run',
                parentTraceId: traceHierarchy.parentTraceId,
                rootTraceId: traceHierarchy.rootTraceId,
                traceDepth: traceHierarchy.traceDepth,
                sessionId: traceHierarchy.sessionId,
              },
              payload: {
                success: false,
                error: `invalid dependency "${dep}" for task ${i}`,
                tool: 'parallel_run',
              },
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `Error: invalid dependency "${dep}" for task ${i}`,
                },
              ],
              isError: true,
            };
          }
        }
        tasks[i]!.dependencies = resolvedDeps;
      }
    }

    // Execute parallel
    const orchestrator = await getOrchestrator();
    const result = await orchestrator.executeParallel(tasks, config, sharedContext);

    // Emit run.end trace event on success
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: result.totalDurationMs,
      status: result.allSucceeded ? 'success' : 'failure',
      context: {
        workflowId: 'parallel-run',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: result.allSucceeded,
        groupId: result.groupId,
        tasksExecuted: result.tasksExecuted,
        tasksSkipped: result.tasksSkipped,
        failedTaskCount: result.failedTasks.length,
        layerCount: result.layerCount,
        peakConcurrency: result.peakConcurrency,
        tool: 'parallel_run',
      },
    });

    // Build response
    const response = {
      groupId: result.groupId,
      allSucceeded: result.allSucceeded,
      tasksExecuted: result.tasksExecuted,
      tasksSkipped: result.tasksSkipped,
      totalDurationMs: result.totalDurationMs,
      aggregatedOutput: result.aggregatedOutput,
      taskResults: result.taskResults.map((r) => ({
        taskId: r.taskId,
        agentId: r.agentId,
        status: r.status,
        success: r.success,
        output: r.output,
        error: r.error,
        durationMs: r.durationMs,
        layer: r.layer,
      })),
      failedTasks: result.failedTasks,
      cancelledTasks: result.cancelledTasks,
      skippedTasks: result.skippedTasks,
      layerCount: result.layerCount,
      peakConcurrency: result.peakConcurrency,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
      isError: !result.allSucceeded,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const code =
      error instanceof Error && 'code' in error
        ? (error as { code: string }).code
        : ParallelExecutionErrorCodes.TASK_FAILED;

    // Emit run.end trace event on failure
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'failure',
      context: {
        workflowId: 'parallel-run',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: message,
        errorCode: code,
        taskCount,
        tool: 'parallel_run',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: code,
            message: `Parallel execution failed: ${message}`,
          }),
        },
      ],
      isError: true,
    };
  }
};

// ============================================================================
// parallel_plan Tool
// ============================================================================

/**
 * Parallel plan tool definition
 * INV-MCP-004: Idempotent - read-only operation
 */
export const parallelPlanTool: MCPTool = {
  name: 'parallel_plan',
  description: `Preview the execution plan for parallel agent tasks without executing. Shows DAG structure, execution layers, and parallelism analysis. Read-only, no side effects.`,
  inputSchema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: 'Agent ID to execute',
            },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Task IDs this task depends on',
            },
            priority: {
              type: 'number',
              description: 'Execution priority',
              minimum: 0,
              maximum: 100,
            },
          },
          required: ['agentId'],
        },
        minItems: 1,
        maxItems: 100,
        description: 'Tasks to plan',
      },
    },
    required: ['tasks'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      planId: { type: 'string', description: 'Unique plan ID' },
      totalTasks: { type: 'number', description: 'Total tasks in plan' },
      totalLayers: { type: 'number', description: 'Total execution layers' },
      maxParallelism: { type: 'number', description: 'Maximum parallel tasks in any layer' },
      hasCycles: { type: 'boolean', description: 'Whether plan has circular dependencies' },
      layers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            taskCount: { type: 'number' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  taskId: { type: 'string' },
                  agentId: { type: 'string' },
                  priority: { type: 'number' },
                  dependencies: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        description: 'Execution layers',
      },
    },
    required: ['planId', 'totalTasks', 'totalLayers', 'maxParallelism', 'hasCycles', 'layers'],
  },
  idempotent: true,
};

/**
 * Handler for parallel_plan tool
 * Records traces for dashboard visibility - DAG planning preview
 */
export const handleParallelPlan: ToolHandler = async (args): Promise<MCPToolResult> => {
  const { tasks: rawTasks } = args as {
    tasks: Array<{
      agentId: string;
      dependencies?: string[];
      priority?: number;
    }>;
  };

  // Get trace store and create trace context
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();
  const traceHierarchy: TraceHierarchy = createRootTraceHierarchy(traceId, undefined);

  const taskCount = rawTasks?.length ?? 0;

  // Emit run.start trace event
  const startEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTime,
    context: {
      workflowId: 'parallel-plan',
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      tool: 'parallel_plan',
      taskCount,
    },
  };
  await traceStore.write(startEvent);

  // Validate tasks
  if (!rawTasks || rawTasks.length === 0) {
    // Emit run.end trace event for validation failure
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'failure',
      context: {
        workflowId: 'parallel-plan',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: 'at least one task is required',
        tool: 'parallel_plan',
      },
    });

    return {
      content: [{ type: 'text', text: 'Error: at least one task is required' }],
      isError: true,
    };
  }

  try {
    // Create tasks with generated IDs
    const taskIdMap = new Map<number, string>();
    const tasks: AgentParallelTask[] = rawTasks.map((rawTask, index) => {
      const taskId = randomUUID();
      taskIdMap.set(index, taskId);
      const planOptions: Partial<Omit<AgentParallelTask, 'taskId' | 'agentId' | 'input'>> = {};
      if (rawTask.priority !== undefined) planOptions.priority = rawTask.priority;
      return createAgentParallelTask(rawTask.agentId, {}, planOptions);
    });

    // Resolve dependencies
    for (let i = 0; i < rawTasks.length; i++) {
      const rawTask = rawTasks[i]!;
      if (rawTask.dependencies && rawTask.dependencies.length > 0) {
        const resolvedDeps: string[] = [];
        for (const dep of rawTask.dependencies) {
          const depIndex = parseInt(dep, 10);
          if (!isNaN(depIndex) && taskIdMap.has(depIndex)) {
            resolvedDeps.push(taskIdMap.get(depIndex)!);
          } else if (tasks.some((t) => t.taskId === dep)) {
            resolvedDeps.push(dep);
          } else {
            // INV-TR-013: Emit run.end trace event for validation failure
            await traceStore.write({
              eventId: randomUUID(),
              traceId,
              type: 'run.end',
              timestamp: new Date().toISOString(),
              durationMs: Date.now() - new Date(startTime).getTime(),
              status: 'failure',
              context: {
                workflowId: 'parallel-plan',
                parentTraceId: traceHierarchy.parentTraceId,
                rootTraceId: traceHierarchy.rootTraceId,
                traceDepth: traceHierarchy.traceDepth,
                sessionId: traceHierarchy.sessionId,
              },
              payload: {
                success: false,
                error: `invalid dependency "${dep}" for task ${i}`,
                tool: 'parallel_plan',
              },
            });

            return {
              content: [
                {
                  type: 'text',
                  text: `Error: invalid dependency "${dep}" for task ${i}`,
                },
              ],
              isError: true,
            };
          }
        }
        tasks[i]!.dependencies = resolvedDeps;
      }
    }

    // Build execution plan
    const orchestrator = await getOrchestrator();
    const plan: ExecutionPlan = orchestrator.buildExecutionPlan(tasks);

    // Emit run.end trace event on success
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: plan.hasCycles ? 'failure' : 'success',
      context: {
        workflowId: 'parallel-plan',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: !plan.hasCycles,
        planId: plan.planId,
        totalTasks: plan.totalTasks,
        totalLayers: plan.totalLayers,
        maxParallelism: plan.maxParallelism,
        hasCycles: plan.hasCycles,
        tool: 'parallel_plan',
      },
    });

    // Build response with simplified layer view
    const response = {
      planId: plan.planId,
      totalTasks: plan.totalTasks,
      totalLayers: plan.totalLayers,
      maxParallelism: plan.maxParallelism,
      hasCycles: plan.hasCycles,
      layers: plan.layers.map((layer) => ({
        index: layer.index,
        taskCount: layer.taskCount,
        tasks: layer.tasks.map((t) => ({
          taskId: t.taskId,
          agentId: t.agentId,
          priority: t.priority,
          dependencies: t.dependencies,
        })),
      })),
      createdAt: plan.createdAt,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const code =
      error instanceof Error && 'code' in error
        ? (error as { code: string }).code
        : ParallelExecutionErrorCodes.INVALID_PLAN;

    // Emit run.end trace event on failure
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'failure',
      context: {
        workflowId: 'parallel-plan',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: message,
        errorCode: code,
        taskCount,
        tool: 'parallel_plan',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: code,
            message: `Plan generation failed: ${message}`,
          }),
        },
      ],
      isError: true,
    };
  }
};

// ============================================================================
// Export Arrays
// ============================================================================

/**
 * All parallel tools
 */
export const PARALLEL_TOOLS: MCPTool[] = [parallelRunTool, parallelPlanTool];

/**
 * All parallel handlers
 */
export const PARALLEL_HANDLERS: Record<string, ToolHandler> = {
  parallel_run: handleParallelRun,
  parallel_plan: handleParallelPlan,
};
