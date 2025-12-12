/**
 * MCP Tool: orchestrate_task (Option B)
 *
 * All-in-one tool that analyzes a complex task, creates an execution plan,
 * and optionally executes it with parallel agent orchestration.
 *
 * Combines planning (Option C) with execution capability.
 *
 * @version 12.6.0
 */

import type { ToolHandler, McpSession } from '../types.js';
import type { ProfileLoader } from '../../agents/profile-loader.js';
import type { IMemoryManager } from '../../types/memory.js';
import type { ContextManager } from '../../agents/context-manager.js';
import type { SessionManager } from '../../core/session/manager.js';
import type { WorkspaceManager } from '../../core/workspace-manager.js';
import { AgentExecutor, type AgentExecutorConfig } from '../../agents/executor.js';
import { logger } from '../../shared/logging/logger.js';
import { sendMcpProgress } from '../streaming-notifier.js';
import {
  createPlanMultiAgentHandler,
  type PlanMultiAgentOutput,
  type PlannedSubtask,
  type ExecutionGroup
} from './plan-multi-agent.js';

/**
 * Execution result for a single subtask
 */
export interface SubtaskResult {
  id: string;
  task: string;
  agent: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  durationMs: number;
}

export type GroupMetric = {
  level: number;
  parallelized: boolean;
  durationMs: number;
  taskCount: number;
};

/**
 * Input for orchestrate_task tool
 */
export interface OrchestrateTaskInput {
  /** Complex task to orchestrate */
  task: string;
  /** Execution mode */
  mode?: 'plan_only' | 'execute' | 'execute_parallel';
  /** Optional: Maximum concurrent subtasks when parallelizing (default: 3) */
  maxParallel?: number;
  /** Optional: Per-subtask timeout in milliseconds (default: 5 minutes) */
  subtaskTimeoutMs?: number;
  /** Optional: Preferred agents */
  preferredAgents?: string[];
  /** Optional: Max subtasks */
  maxSubtasks?: number;
  /** Optional: Continue on failure */
  continueOnFailure?: boolean;
  /** Optional: Create session for tracking */
  createSession?: boolean;
  /** Optional: Include memory context */
  includeMemory?: boolean;
}

/**
 * Output of orchestrate_task tool
 */
export interface OrchestrateTaskOutput {
  /** Execution mode used */
  mode: 'plan_only' | 'execute' | 'execute_parallel';
  /** Planning output (always included) */
  plan: PlanMultiAgentOutput;
  /** Execution results (only if executed) */
  execution?: {
    /** Overall success */
    success: boolean;
    /** Results per subtask */
    results: SubtaskResult[];
    /** Per-group execution metrics */
    groupMetrics: GroupMetric[];
    /** Total duration */
    totalDurationMs: number;
    /** Session ID (if created) */
    sessionId?: string;
  };
  /** Summary message */
  summary: string;
}

export interface OrchestrateTaskDependencies {
  profileLoader: ProfileLoader;
  memoryManager?: IMemoryManager;
  contextManager: ContextManager;
  sessionManager?: SessionManager;
  executorConfig: AgentExecutorConfig;
  getSession?: () => McpSession | null;
}

/**
 * Execute a single subtask
 */
async function executeSubtask(
  subtask: PlannedSubtask,
  deps: OrchestrateTaskDependencies,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<SubtaskResult> {
  const startTime = Date.now();

  try {
    if (signal?.aborted) {
      throw new Error('Execution cancelled');
    }

    sendMcpProgress(`Executing ${subtask.agent}: ${subtask.task.substring(0, 40)}...`);

    const context = await deps.contextManager.createContext(subtask.agent, subtask.task, {
      skipMemory: false
    });

    const executor = new AgentExecutor(deps.executorConfig);
    const result = await executor.execute(context, {
      showProgress: false,
      verbose: false,
      signal,
      timeout: timeoutMs
    });

    return {
      id: subtask.id,
      task: subtask.task,
      agent: subtask.agent,
      status: 'completed',
      output: result.response.content,
      durationMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      id: subtask.id,
      task: subtask.task,
      agent: subtask.agent,
      status: 'failed',
      error: (error as Error).message.toLowerCase().includes('cancel') ? 'Execution cancelled' : (error as Error).message,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Execute subtasks in a group (parallel or sequential)
 */
async function executeGroup(
  group: ExecutionGroup,
  subtasks: PlannedSubtask[],
  deps: OrchestrateTaskDependencies,
  parallel: boolean,
  continueOnFailure: boolean,
  maxParallel: number,
  subtaskTimeoutMs: number,
  signal?: AbortSignal
): Promise<SubtaskResult[]> {
  const tasksToExecute = subtasks.filter(t => group.tasks.includes(t.id));

  const results: SubtaskResult[] = [];

  if (parallel && group.canParallelize && maxParallel > 1) {
    // Execute with bounded parallelism
    const controller = new AbortController();
    let aborted = false;

    if (signal) {
      if (signal.aborted) {
        return tasksToExecute.map(t => ({
          id: t.id,
          task: t.task,
          agent: t.agent,
          status: 'skipped',
          error: 'Execution cancelled',
          durationMs: 0
        }));
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    sendMcpProgress(`Level ${group.level}: Executing up to ${Math.min(maxParallel, tasksToExecute.length)} tasks in parallel...`);

    const queue = [...tasksToExecute];
    const workers = Array.from({ length: Math.min(maxParallel, queue.length) }, async () => {
      while (queue.length && !aborted) {
        const subtask = queue.shift();
        if (!subtask) break;

        const result = await executeSubtask(subtask, deps, subtaskTimeoutMs, controller.signal);
        results.push(result);

        if (result.status === 'failed' && !continueOnFailure) {
          aborted = true;
          controller.abort();
        }
      }
    });

    await Promise.all(workers);

    // Mark any not-started tasks as skipped if we aborted early
    if (aborted && queue.length) {
      for (const remaining of queue) {
        results.push({
          id: remaining.id,
          task: remaining.task,
          agent: remaining.agent,
          status: 'skipped',
          error: 'Previous task failed',
          durationMs: 0
        });
      }
    }

    return results;
  }

  // Execute sequentially
  for (const subtask of tasksToExecute) {
    if (signal?.aborted) {
      results.push({
        id: subtask.id,
        task: subtask.task,
        agent: subtask.agent,
        status: 'skipped',
        error: 'Execution cancelled',
        durationMs: 0
      });
      continue;
    }

    const result = await executeSubtask(subtask, deps, subtaskTimeoutMs, signal);
    results.push(result);

    // Stop on failure if not continuing
    if (result.status === 'failed' && !continueOnFailure) {
      // Mark remaining as skipped
      const remaining = tasksToExecute.slice(tasksToExecute.indexOf(subtask) + 1);
      for (const r of remaining) {
        results.push({
          id: r.id,
          task: r.task,
          agent: r.agent,
          status: 'skipped',
          error: 'Previous task failed',
          durationMs: 0
        });
      }
      break;
    }
  }

  return results;
}

export function createOrchestrateTaskHandler(
  deps: OrchestrateTaskDependencies
): ToolHandler<OrchestrateTaskInput, OrchestrateTaskOutput> {
  // Create the planning handler
  const planHandler = createPlanMultiAgentHandler({
    profileLoader: deps.profileLoader,
    memoryManager: deps.memoryManager
  });

  return async (input: OrchestrateTaskInput, context?: { signal?: AbortSignal }): Promise<OrchestrateTaskOutput> => {
    const {
      task,
      mode = 'plan_only',
      preferredAgents,
      maxSubtasks = 6,
      maxParallel = 3,
      subtaskTimeoutMs = 300000,
      continueOnFailure = true,
      createSession = false,
      includeMemory = false
    } = input;

    logger.info('[MCP] orchestrate_task called', {
      taskPreview: task.substring(0, 100),
      mode,
      maxSubtasks,
      createSession
    });

    // Phase 1: Planning
    sendMcpProgress('Analyzing task and creating execution plan...');

    const plan = await planHandler({
      task,
      preferredAgents,
      maxSubtasks,
      includeMemory
    });

    // If plan_only mode, return just the plan
    if (mode === 'plan_only') {
      logger.info('[MCP] orchestrate_task completed (plan_only mode)', {
        subtaskCount: plan.subtasks.length
      });

      return {
        mode: 'plan_only',
        plan,
        summary: `Created execution plan with ${plan.subtasks.length} subtasks. ` +
          `${plan.recommendParallel ? 'Parallel execution recommended.' : 'Sequential execution recommended.'} ` +
          `Use mode='execute' or mode='execute_parallel' to run the plan.`
      };
    }

    // Phase 2: Execution
    const startTime = Date.now();
    const parallel = mode === 'execute_parallel';
    const results: SubtaskResult[] = [];
    let sessionId: string | undefined;
    const groupMetrics: GroupMetric[] = [];

    // Create session if requested
    if (createSession && deps.sessionManager) {
      try {
        const session = await deps.sessionManager.createSession(task, 'orchestrator');
        sessionId = session.id;
        sendMcpProgress(`Created session: ${sessionId}`);
      } catch (error) {
        logger.warn('[orchestrate_task] Failed to create session', { error });
      }
    }

    // Execute groups in order
    sendMcpProgress(`Executing ${plan.subtasks.length} subtasks ${parallel ? 'with parallel optimization' : 'sequentially'}...`);

    const completedTasks = new Set<string>();

    for (const group of plan.executionPlan) {
      const groupStart = Date.now();

      // Check if dependencies are met
      const groupTasks = plan.subtasks.filter(t => group.tasks.includes(t.id));
      const canExecute = groupTasks.every(t =>
        t.dependencies.every(dep => completedTasks.has(dep))
      );

      if (!canExecute) {
        // Mark group as skipped
        for (const t of groupTasks) {
          results.push({
            id: t.id,
            task: t.task,
            agent: t.agent,
            status: 'skipped',
            error: 'Dependencies not met',
            durationMs: 0
          });
        }
        continue;
      }

      // Execute group
      const groupResults = await executeGroup(
        group,
        plan.subtasks,
        deps,
        parallel,
        continueOnFailure,
        Math.max(1, Math.floor(maxParallel)),
        subtaskTimeoutMs,
        context?.signal
      );

      results.push(...groupResults);

      // Track completed tasks
      for (const r of groupResults) {
        if (r.status === 'completed') {
          completedTasks.add(r.id);
        }
      }

      // Check if we should stop
      const hasFailure = groupResults.some(r => r.status === 'failed');
      if (hasFailure && !continueOnFailure) {
        // Mark remaining groups as skipped
        const remainingGroups = plan.executionPlan.slice(plan.executionPlan.indexOf(group) + 1);
        for (const rg of remainingGroups) {
          const remaining = plan.subtasks.filter(t => rg.tasks.includes(t.id));
          for (const t of remaining) {
            results.push({
              id: t.id,
              task: t.task,
              agent: t.agent,
              status: 'skipped',
              error: 'Previous group failed',
              durationMs: 0
            });
          }
        }
        break;
      }

      groupMetrics.push({
        level: group.level,
        parallelized: parallel && group.canParallelize && maxParallel > 1,
        durationMs: Date.now() - groupStart,
        taskCount: groupTasks.length
      });
    }

    const totalDurationMs = Date.now() - startTime;
    const completedCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const success = failedCount === 0;

    // Complete session
    if (sessionId && deps.sessionManager) {
      try {
        if (success) {
          await deps.sessionManager.completeSession(sessionId);
        } else {
          await deps.sessionManager.failSession(sessionId, new Error(`${failedCount} subtasks failed`));
        }
      } catch (error) {
        logger.warn('[orchestrate_task] Failed to update session', { error });
      }
    }

    logger.info('[MCP] orchestrate_task completed', {
      mode,
      success,
      completed: completedCount,
      failed: failedCount,
      skipped: skippedCount,
      totalDurationMs
    });

    // Build summary
    const summary = success
      ? `Successfully executed ${completedCount} subtasks in ${(totalDurationMs / 1000).toFixed(1)}s. ` +
        `${parallel ? 'Parallel execution' : 'Sequential execution'} used.`
      : `Execution completed with ${failedCount} failures. ` +
        `${completedCount} completed, ${skippedCount} skipped. ` +
        `Total time: ${(totalDurationMs / 1000).toFixed(1)}s`;

    return {
      mode,
      plan,
      execution: {
        success,
        results,
        groupMetrics,
        totalDurationMs,
        sessionId
      },
      summary
    };
  };
}

/**
 * JSON Schema for orchestrate_task tool (for MCP registration)
 */
export const orchestrateTaskSchema = {
  name: 'orchestrate_task',
  description: `Analyze, plan, and optionally execute a complex multi-agent task.

**When to use**: For complex tasks that require multiple agents. This is the "fire and forget" option for multi-agent orchestration.

**Modes**:
- \`plan_only\` (default): Just analyze and return execution plan (same as plan_multi_agent)
- \`execute\`: Plan and execute subtasks sequentially
- \`execute_parallel\`: Plan and execute with parallel optimization (faster)

**What it does**:
1. Analyzes your complex task
2. Breaks it into subtasks with optimal agent assignments
3. Identifies dependencies and parallelization opportunities
4. (If execute mode) Runs all subtasks automatically
5. Returns combined results

**When to use plan_only vs execute**:
- Use \`plan_only\` when you want to review/modify the plan before executing
- Use \`execute\` for trusted automation where you want AutomatosX to handle everything
- Use \`execute_parallel\` for maximum speed on independent subtasks

**Example**:
orchestrate_task({
  task: "Build a complete user registration system with email verification",
  mode: "execute_parallel",
  createSession: true
})

This will:
1. Plan: security → requirements, backend → API, frontend → UI, quality → tests
2. Execute: Run backend and frontend in parallel (both depend only on security)
3. Return: Combined results from all agents

**Timeout**: Each subtask has a 5-minute timeout. For very long tasks, use plan_only mode and execute manually.`,
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Complex task to orchestrate. Be detailed about requirements.'
      },
      mode: {
        type: 'string',
        enum: ['plan_only', 'execute', 'execute_parallel'],
        description: 'Execution mode: plan_only (default), execute (sequential), execute_parallel (optimized)',
        default: 'plan_only'
      },
      preferredAgents: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: Prefer these agents for subtask assignment'
      },
      maxParallel: {
        type: 'number',
        description: 'Maximum concurrent subtasks when parallelizing (default: 3)',
        default: 3
      },
      subtaskTimeoutMs: {
        type: 'number',
        description: 'Per-subtask timeout in milliseconds (default: 300000)',
        default: 300000
      },
      maxSubtasks: {
        type: 'number',
        description: 'Maximum subtasks to generate (default: 6)',
        default: 6
      },
      continueOnFailure: {
        type: 'boolean',
        description: 'Continue executing remaining subtasks if one fails (default: true)',
        default: true
      },
      createSession: {
        type: 'boolean',
        description: 'Create a session to track this orchestration (default: false)',
        default: false
      },
      includeMemory: {
        type: 'boolean',
        description: 'Include relevant memory context in planning (default: false)',
        default: false
      }
    },
    required: ['task']
  }
};
