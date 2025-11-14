/**
 * Sprint 3 Day 26: State Machine Runtime Integration
 *
 * Integrates StateMachineBridge with ProviderRouterV2 for complete workflow execution.
 * Adds checkpoint persistence, task orchestration, and provider coordination.
 */

import { EventEmitter } from 'events'
import {
  StateMachineBridge,
  WorkflowOrchestrator,
  createStateMachine,
  type MachineState,
  type MachineEvent,
  type MachineCheckpoint,
} from './StateMachineBridge.js'
import type { IProvider, ProviderRequest as SDKProviderRequest, ProviderResponse as SDKProviderResponse } from '../providers/ProviderBase.js'
import type { ProviderRouterV2 } from '../services/ProviderRouterV2.js'

// Union type for providers
type Provider = IProvider | ProviderRouterV2

// Provider request type that works with both
interface ProviderRequest extends SDKProviderRequest {}
import { getDatabase } from '../database/connection.js'
import type { Database } from 'better-sqlite3'

/**
 * Task execution context
 */
export interface TaskContext {
  taskId: string
  agentName: string
  provider: Provider
  request: ProviderRequest
  checkpointInterval?: number // Save checkpoint every N seconds
  maxRetries?: number
}

/**
 * Task execution result
 */
// Response type that works with both provider types
type ProviderResponse = SDKProviderResponse

export interface TaskResult {
  taskId: string
  success: boolean
  finalState: MachineState
  response?: ProviderResponse
  error?: string
  checkpoints: MachineCheckpoint[]
  duration: number
}

/**
 * Checkpoint storage interface
 */
export interface CheckpointStorage {
  save(taskId: string, checkpoint: MachineCheckpoint): Promise<void>
  load(taskId: string): Promise<MachineCheckpoint | null>
  list(agentName?: string): Promise<Array<{ taskId: string; timestamp: number }>>
  delete(taskId: string): Promise<void>
}

/**
 * SQLite checkpoint storage implementation
 */
export class SQLiteCheckpointStorage implements CheckpointStorage {
  private db: Database

  constructor() {
    this.db = getDatabase()
    this.initializeSchema()
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_checkpoints (
        task_id TEXT PRIMARY KEY,
        agent_name TEXT NOT NULL,
        state TEXT NOT NULL,
        context_data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoints_agent
        ON task_checkpoints(agent_name);

      CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp
        ON task_checkpoints(timestamp DESC);
    `)
  }

  async save(taskId: string, checkpoint: MachineCheckpoint): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_checkpoints
        (task_id, agent_name, state, context_data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(
      taskId,
      checkpoint.context.agentName,
      checkpoint.state,
      JSON.stringify(checkpoint.context),
      checkpoint.timestamp
    )
  }

  async load(taskId: string): Promise<MachineCheckpoint | null> {
    const stmt = this.db.prepare(`
      SELECT state, context_data, timestamp
      FROM task_checkpoints
      WHERE task_id = ?
    `)

    const row = stmt.get(taskId) as any

    if (!row) {
      return null
    }

    return {
      state: row.state as MachineState,
      context: JSON.parse(row.context_data),
      timestamp: row.timestamp,
    }
  }

  async list(agentName?: string): Promise<Array<{ taskId: string; timestamp: number }>> {
    let stmt
    let rows

    if (agentName) {
      stmt = this.db.prepare(`
        SELECT task_id, timestamp
        FROM task_checkpoints
        WHERE agent_name = ?
        ORDER BY timestamp DESC
      `)
      rows = stmt.all(agentName)
    } else {
      stmt = this.db.prepare(`
        SELECT task_id, timestamp
        FROM task_checkpoints
        ORDER BY timestamp DESC
      `)
      rows = stmt.all()
    }

    return rows.map((row: any) => ({
      taskId: row.task_id,
      timestamp: row.timestamp,
    }))
  }

  async delete(taskId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM task_checkpoints WHERE task_id = ?')
    stmt.run(taskId)
  }
}

/**
 * State Machine Runtime - Orchestrates task execution with state management
 */
export class StateMachineRuntime extends EventEmitter {
  private orchestrator: WorkflowOrchestrator
  private storage: CheckpointStorage
  private activeExecutions: Map<string, { machine: StateMachineBridge; startTime: number }>

  constructor(storage?: CheckpointStorage) {
    super()
    this.orchestrator = new WorkflowOrchestrator()
    this.storage = storage || new SQLiteCheckpointStorage()
    this.activeExecutions = new Map()
  }

  /**
   * Execute a task with state machine orchestration
   */
  async executeTask(context: TaskContext): Promise<TaskResult> {
    const { taskId, agentName, provider, request, checkpointInterval, maxRetries = 3 } = context

    // Create or restore workflow
    let machine: StateMachineBridge
    const existingCheckpoint = await this.storage.load(taskId)

    if (existingCheckpoint) {
      machine = this.orchestrator.createWorkflow(taskId, agentName)
      machine.restoreFromCheckpoint(existingCheckpoint)
      this.emit('task-resumed', { taskId, state: existingCheckpoint.state })
    } else {
      machine = this.orchestrator.createWorkflow(taskId, agentName)
      this.emit('task-started', { taskId, agentName })
    }

    const startTime = Date.now()
    this.activeExecutions.set(taskId, { machine, startTime })

    const checkpoints: MachineCheckpoint[] = []

    // Setup automatic checkpointing
    let checkpointTimer: NodeJS.Timeout | undefined
    if (checkpointInterval) {
      checkpointTimer = setInterval(async () => {
        const checkpoint = machine.createCheckpoint()
        await this.storage.save(taskId, checkpoint)
        checkpoints.push(checkpoint)
        this.emit('checkpoint-created', { taskId, state: checkpoint.state })
      }, checkpointInterval * 1000)
    }

    try {
      // Transition to planning
      if (machine.getCurrentState() === 'idle') {
        machine.transition('start', 'planning')
        machine.setContextData('startTime', startTime.toString())
        this.emit('state-changed', { taskId, from: 'idle', to: 'planning' })
      }

      // Transition to executing
      if (machine.getCurrentState() === 'planning') {
        machine.transition('plan', 'executing')
        this.emit('state-changed', { taskId, from: 'planning', to: 'executing' })
      }

      // Execute task with retries
      let response: ProviderResponse | undefined
      let lastError: Error | undefined

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          machine.setContextData('attempt', attempt.toString())
          this.emit('execution-attempt', { taskId, attempt: attempt + 1, maxRetries })

          response = await provider.request(request)

          machine.setContextData('tokens', response.usage.totalTokens.toString())
          machine.setContextData('latency', response.latency.toString())

          break // Success
        } catch (error) {
          lastError = error as Error
          machine.setContextData('lastError', lastError.message)

          if (attempt < maxRetries - 1) {
            // Pause and resume for retry
            machine.transition('pause', 'paused')
            this.emit('state-changed', { taskId, from: 'executing', to: 'paused' })

            await this.delay(Math.pow(2, attempt) * 1000)

            machine.transition('resume', 'executing')
            this.emit('state-changed', { taskId, from: 'paused', to: 'executing' })
          }
        }
      }

      // Transition to terminal state
      if (response) {
        machine.transition('complete', 'completed')
        this.emit('state-changed', { taskId, from: 'executing', to: 'completed' })

        // Save final checkpoint
        const finalCheckpoint = machine.createCheckpoint()
        await this.storage.save(taskId, finalCheckpoint)
        checkpoints.push(finalCheckpoint)

        const duration = Date.now() - startTime
        this.emit('task-completed', { taskId, duration, tokens: response.usage.totalTokens })

        return {
          taskId,
          success: true,
          finalState: 'completed',
          response,
          checkpoints,
          duration,
        }
      } else {
        machine.transition('fail', 'failed')
        this.emit('state-changed', { taskId, from: 'executing', to: 'failed' })

        // Save final checkpoint
        const finalCheckpoint = machine.createCheckpoint()
        await this.storage.save(taskId, finalCheckpoint)
        checkpoints.push(finalCheckpoint)

        const duration = Date.now() - startTime
        this.emit('task-failed', { taskId, error: lastError?.message, duration })

        return {
          taskId,
          success: false,
          finalState: 'failed',
          error: lastError?.message || 'Unknown error',
          checkpoints,
          duration,
        }
      }
    } finally {
      if (checkpointTimer) {
        clearInterval(checkpointTimer)
      }
      this.activeExecutions.delete(taskId)
    }
  }

  /**
   * Resume a task from checkpoint
   */
  async resumeTask(taskId: string, provider: Provider, request: ProviderRequest): Promise<TaskResult> {
    const checkpoint = await this.storage.load(taskId)

    if (!checkpoint) {
      throw new Error(`No checkpoint found for task ${taskId}`)
    }

    return this.executeTask({
      taskId,
      agentName: checkpoint.context.agentName,
      provider,
      request,
    })
  }

  /**
   * Pause a running task
   */
  async pauseTask(taskId: string): Promise<void> {
    const execution = this.activeExecutions.get(taskId)

    if (!execution) {
      throw new Error(`Task ${taskId} is not running`)
    }

    const { machine } = execution

    if (machine.getCurrentState() === 'executing') {
      machine.transition('pause', 'paused')

      const checkpoint = machine.createCheckpoint()
      await this.storage.save(taskId, checkpoint)

      this.emit('task-paused', { taskId })
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<void> {
    const execution = this.activeExecutions.get(taskId)

    if (!execution) {
      throw new Error(`Task ${taskId} is not running`)
    }

    const { machine } = execution

    machine.transition('fail', 'failed')
    machine.setContextData('cancelled', 'true')

    const checkpoint = machine.createCheckpoint()
    await this.storage.save(taskId, checkpoint)

    this.activeExecutions.delete(taskId)

    this.emit('task-cancelled', { taskId })
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<{
    state: MachineState
    context: any
    isActive: boolean
    duration?: number
  } | null> {
    const execution = this.activeExecutions.get(taskId)

    if (execution) {
      const { machine, startTime } = execution
      return {
        state: machine.getCurrentState(),
        context: machine.getContext(),
        isActive: true,
        duration: Date.now() - startTime,
      }
    }

    const checkpoint = await this.storage.load(taskId)

    if (checkpoint) {
      return {
        state: checkpoint.state,
        context: checkpoint.context,
        isActive: false,
      }
    }

    return null
  }

  /**
   * List all checkpoints
   */
  async listCheckpoints(agentName?: string): Promise<Array<{ taskId: string; timestamp: number }>> {
    return this.storage.list(agentName)
  }

  /**
   * Delete checkpoint
   */
  async deleteCheckpoint(taskId: string): Promise<void> {
    return this.storage.delete(taskId)
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): Array<{ taskId: string; state: MachineState; duration: number }> {
    const result: Array<{ taskId: string; state: MachineState; duration: number }> = []

    for (const [taskId, execution] of this.activeExecutions.entries()) {
      result.push({
        taskId,
        state: execution.machine.getCurrentState(),
        duration: Date.now() - execution.startTime,
      })
    }

    return result
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Factory function to create runtime
 */
export function createStateMachineRuntime(storage?: CheckpointStorage): StateMachineRuntime {
  return new StateMachineRuntime(storage)
}
