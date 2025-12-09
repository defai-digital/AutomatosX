/**
 * MCP Tool: create_task
 *
 * Creates a new task with payload for deferred execution.
 * Returns task_id for later execution via run_task.
 *
 * Part of Phase 2: MCP Tools + Caching
 *
 * @module mcp/tools/task/create-task
 * @version 1.0.0
 */

import type { ToolHandler, McpSession } from '../../types.js';
import { getTaskEngine, type CreateTaskInput, type OriginClient } from '../../../core/task-engine/index.js';
import { logger } from '../../../shared/logging/logger.js';

/**
 * create_task tool input
 */
export interface CreateTaskToolInput {
  /** Task type for routing optimization */
  type: 'web_search' | 'code_review' | 'code_generation' | 'analysis' | 'custom';
  /** Task data (max 1MB after JSON serialization) */
  payload: Record<string, unknown>;
  /** Target engine (auto = router decides) */
  engine?: 'auto' | 'gemini' | 'claude' | 'codex' | 'glm' | 'grok';
  /** Execution priority (1=lowest, 10=highest) */
  priority?: number;
  /** Task time-to-live in hours */
  ttl_hours?: number;
}

/**
 * create_task tool output
 */
export interface CreateTaskToolOutput {
  /** Generated task ID */
  task_id: string;
  /** Task status (always 'pending' for new tasks) */
  status: 'pending';
  /** Estimated engine based on task type */
  estimated_engine: string | null;
  /** When the task will expire (ISO 8601) */
  expires_at: string;
  /** Payload size in bytes */
  payload_size_bytes: number;
  /** Compression ratio achieved */
  compression_ratio: number;
}

/**
 * Dependencies for create_task handler
 */
export interface CreateTaskDependencies {
  /** Function to get current MCP session */
  getSession: () => McpSession | null;
}

/**
 * Create the create_task tool handler
 */
export function createCreateTaskHandler(deps: CreateTaskDependencies): ToolHandler<CreateTaskToolInput, CreateTaskToolOutput> {
  return async (input: CreateTaskToolInput): Promise<CreateTaskToolOutput> => {
    const startTime = Date.now();

    logger.info('[create_task] Creating task', {
      type: input.type,
      engine: input.engine ?? 'auto',
      priority: input.priority ?? 5,
      payloadSize: JSON.stringify(input.payload).length
    });

    try {
      const taskEngine = getTaskEngine();
      const session = deps.getSession();

      // Build task input with loop context from MCP session
      const taskInput: CreateTaskInput = {
        type: input.type,
        payload: input.payload,
        engine: input.engine,
        priority: input.priority,
        ttlHours: input.ttl_hours,
        context: session ? {
          originClient: mapNormalizedProviderToOriginClient(session.normalizedProvider),
          callChain: [mapNormalizedProviderToOriginClient(session.normalizedProvider)],
          depth: 0
        } : undefined
      };

      const result = await taskEngine.createTask(taskInput);

      const output: CreateTaskToolOutput = {
        task_id: result.id,
        status: 'pending',
        estimated_engine: result.estimatedEngine,
        expires_at: new Date(result.expiresAt).toISOString(),
        payload_size_bytes: result.payloadSize,
        compression_ratio: result.compressionRatio
      };

      logger.info('[create_task] Task created successfully', {
        taskId: result.id,
        estimatedEngine: result.estimatedEngine,
        durationMs: Date.now() - startTime
      });

      return output;
    } catch (error) {
      logger.error('[create_task] Failed to create task', {
        error: error instanceof Error ? error.message : String(error),
        type: input.type
      });
      throw error;
    }
  };
}

/**
 * Map normalized MCP provider to origin client ID
 */
function mapNormalizedProviderToOriginClient(provider: string): OriginClient {
  const mapping: Record<string, OriginClient> = {
    'claude': 'claude-code',
    'gemini': 'gemini-cli',
    'codex': 'codex-cli',
    'glm': 'glm',
    'grok': 'grok',
    'unknown': 'unknown'
  };
  return mapping[provider] ?? 'unknown';
}

/**
 * Static schema for create_task tool
 */
export const createTaskSchema = {
  name: 'create_task',
  description: `Create a new task with payload for deferred execution. Returns task_id for later execution via run_task.

**When to use**: For tasks that benefit from decoupled creation and execution:
- Queue work for later processing
- Create multiple tasks in batch, then execute selectively
- Store task definitions for retries on failure

**Task types** optimize routing:
- web_search: Internet searches, fact-checking (uses Gemini for free tier)
- code_review: Code analysis, style checks (uses Claude for accuracy)
- code_generation: Write new code (uses best available coding model)
- analysis: Data analysis, summarization (general purpose)
- custom: User-defined tasks

**Workflow**:
1. create_task({ type: "code_review", payload: { files: ["src/api.ts"] } })
2. ... later ...
3. run_task({ task_id: "abc-123" })

**Returns**: task_id, estimated_engine, expires_at, compression info`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['web_search', 'code_review', 'code_generation', 'analysis', 'custom'],
        description: 'Task type: web_search, code_review, code_generation, analysis, or custom'
      },
      payload: {
        type: 'object',
        description: 'Task data (max 1MB after JSON serialization)'
      },
      engine: {
        type: 'string',
        enum: ['auto', 'gemini', 'claude', 'codex', 'glm', 'grok'],
        default: 'auto',
        description: 'Target engine (auto = router decides)'
      },
      priority: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 5,
        description: 'Execution priority (1=lowest, 10=highest)'
      },
      ttl_hours: {
        type: 'integer',
        minimum: 1,
        maximum: 168,
        default: 24,
        description: 'Task time-to-live in hours'
      }
    },
    required: ['type', 'payload']
  }
};
