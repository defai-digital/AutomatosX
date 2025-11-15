/**
 * Sprint 3 Day 26: State Machine Runtime Integration
 *
 * Integrates StateMachineBridge with ProviderRouterV2 for complete workflow execution.
 * Adds checkpoint persistence, task orchestration, and provider coordination.
 */
import { EventEmitter } from 'events';
import { WorkflowOrchestrator, } from './StateMachineBridge.js';
import { getDatabase } from '../database/connection.js';
/**
 * SQLite checkpoint storage implementation
 */
export class SQLiteCheckpointStorage {
    db;
    constructor() {
        this.db = getDatabase();
        this.initializeSchema();
    }
    initializeSchema() {
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
    `);
    }
    async save(taskId, checkpoint) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_checkpoints
        (task_id, agent_name, state, context_data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(taskId, checkpoint.context.agentName, checkpoint.state, JSON.stringify(checkpoint.context), checkpoint.timestamp);
    }
    async load(taskId) {
        const stmt = this.db.prepare(`
      SELECT state, context_data, timestamp
      FROM task_checkpoints
      WHERE task_id = ?
    `);
        const row = stmt.get(taskId);
        if (!row) {
            return null;
        }
        return {
            state: row.state,
            context: JSON.parse(row.context_data),
            timestamp: row.timestamp,
        };
    }
    async list(agentName) {
        let stmt;
        let rows;
        if (agentName) {
            stmt = this.db.prepare(`
        SELECT task_id, timestamp
        FROM task_checkpoints
        WHERE agent_name = ?
        ORDER BY timestamp DESC
      `);
            rows = stmt.all(agentName);
        }
        else {
            stmt = this.db.prepare(`
        SELECT task_id, timestamp
        FROM task_checkpoints
        ORDER BY timestamp DESC
      `);
            rows = stmt.all();
        }
        return rows.map((row) => ({
            taskId: row.task_id,
            timestamp: row.timestamp,
        }));
    }
    async delete(taskId) {
        const stmt = this.db.prepare('DELETE FROM task_checkpoints WHERE task_id = ?');
        stmt.run(taskId);
    }
}
/**
 * State Machine Runtime - Orchestrates task execution with state management
 */
export class StateMachineRuntime extends EventEmitter {
    orchestrator;
    storage;
    activeExecutions;
    constructor(storage) {
        super();
        this.orchestrator = new WorkflowOrchestrator();
        this.storage = storage || new SQLiteCheckpointStorage();
        this.activeExecutions = new Map();
    }
    /**
     * Execute a task with state machine orchestration
     */
    async executeTask(context) {
        const { taskId, agentName, provider, request, checkpointInterval, maxRetries = 3 } = context;
        // Create or restore workflow
        let machine;
        const existingCheckpoint = await this.storage.load(taskId);
        if (existingCheckpoint) {
            machine = this.orchestrator.createWorkflow(taskId, agentName);
            machine.restoreFromCheckpoint(existingCheckpoint);
            this.emit('task-resumed', { taskId, state: existingCheckpoint.state });
        }
        else {
            machine = this.orchestrator.createWorkflow(taskId, agentName);
            this.emit('task-started', { taskId, agentName });
        }
        const startTime = Date.now();
        this.activeExecutions.set(taskId, { machine, startTime });
        const checkpoints = [];
        // Setup automatic checkpointing
        let checkpointTimer;
        if (checkpointInterval) {
            checkpointTimer = setInterval(async () => {
                const checkpoint = machine.createCheckpoint();
                await this.storage.save(taskId, checkpoint);
                checkpoints.push(checkpoint);
                this.emit('checkpoint-created', { taskId, state: checkpoint.state });
            }, checkpointInterval * 1000);
        }
        try {
            // Transition to planning
            if (machine.getCurrentState() === 'idle') {
                machine.transition('start', 'planning');
                machine.setContextData('startTime', startTime.toString());
                this.emit('state-changed', { taskId, from: 'idle', to: 'planning' });
            }
            // Transition to executing
            if (machine.getCurrentState() === 'planning') {
                machine.transition('plan', 'executing');
                this.emit('state-changed', { taskId, from: 'planning', to: 'executing' });
            }
            // Execute task with retries
            let response;
            let lastError;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    machine.setContextData('attempt', attempt.toString());
                    this.emit('execution-attempt', { taskId, attempt: attempt + 1, maxRetries });
                    const providerResponse = await provider.request(request);
                    response = {
                        provider: providerResponse.provider,
                        content: providerResponse.content,
                        model: providerResponse.model,
                        usage: {
                            totalTokens: providerResponse.usage.totalTokens,
                            inputTokens: providerResponse.usage.inputTokens,
                            outputTokens: providerResponse.usage.outputTokens,
                        },
                        latency: providerResponse.latency,
                        finishReason: providerResponse.finishReason,
                    };
                    machine.setContextData('tokens', providerResponse.usage.totalTokens.toString());
                    machine.setContextData('latency', providerResponse.latency.toString());
                    break; // Success
                }
                catch (error) {
                    lastError = error;
                    machine.setContextData('lastError', lastError.message);
                    if (attempt < maxRetries - 1) {
                        // Pause and resume for retry
                        machine.transition('pause', 'paused');
                        this.emit('state-changed', { taskId, from: 'executing', to: 'paused' });
                        // Fixed: Cap delay at 60 seconds to prevent excessive wait times
                        await this.delay(Math.min(Math.pow(2, attempt) * 1000, 60000));
                        machine.transition('resume', 'executing');
                        this.emit('state-changed', { taskId, from: 'paused', to: 'executing' });
                    }
                }
            }
            // Transition to terminal state
            if (response) {
                machine.transition('complete', 'completed');
                this.emit('state-changed', { taskId, from: 'executing', to: 'completed' });
                // Save final checkpoint
                const finalCheckpoint = machine.createCheckpoint();
                await this.storage.save(taskId, finalCheckpoint);
                checkpoints.push(finalCheckpoint);
                const duration = Date.now() - startTime;
                this.emit('task-completed', { taskId, duration, tokens: response.usage.totalTokens });
                return {
                    taskId,
                    success: true,
                    finalState: 'completed',
                    response,
                    checkpoints,
                    duration,
                };
            }
            else {
                machine.transition('fail', 'failed');
                this.emit('state-changed', { taskId, from: 'executing', to: 'failed' });
                // Save final checkpoint
                const finalCheckpoint = machine.createCheckpoint();
                await this.storage.save(taskId, finalCheckpoint);
                checkpoints.push(finalCheckpoint);
                const duration = Date.now() - startTime;
                this.emit('task-failed', { taskId, error: lastError?.message, duration });
                return {
                    taskId,
                    success: false,
                    finalState: 'failed',
                    error: lastError?.message || 'Unknown error',
                    checkpoints,
                    duration,
                };
            }
        }
        finally {
            if (checkpointTimer) {
                clearInterval(checkpointTimer);
            }
            this.activeExecutions.delete(taskId);
        }
    }
    /**
     * Resume a task from checkpoint
     */
    async resumeTask(taskId, provider, request) {
        const checkpoint = await this.storage.load(taskId);
        if (!checkpoint) {
            throw new Error(`No checkpoint found for task ${taskId}`);
        }
        return this.executeTask({
            taskId,
            agentName: checkpoint.context.agentName,
            provider,
            request,
        });
    }
    /**
     * Pause a running task
     */
    async pauseTask(taskId) {
        const execution = this.activeExecutions.get(taskId);
        if (!execution) {
            throw new Error(`Task ${taskId} is not running`);
        }
        const { machine } = execution;
        if (machine.getCurrentState() === 'executing') {
            machine.transition('pause', 'paused');
            const checkpoint = machine.createCheckpoint();
            await this.storage.save(taskId, checkpoint);
            this.emit('task-paused', { taskId });
        }
    }
    /**
     * Cancel a task
     */
    async cancelTask(taskId) {
        const execution = this.activeExecutions.get(taskId);
        if (!execution) {
            throw new Error(`Task ${taskId} is not running`);
        }
        const { machine } = execution;
        machine.transition('fail', 'failed');
        machine.setContextData('cancelled', 'true');
        const checkpoint = machine.createCheckpoint();
        await this.storage.save(taskId, checkpoint);
        this.activeExecutions.delete(taskId);
        this.emit('task-cancelled', { taskId });
    }
    /**
     * Get task status
     */
    async getTaskStatus(taskId) {
        const execution = this.activeExecutions.get(taskId);
        if (execution) {
            const { machine, startTime } = execution;
            return {
                state: machine.getCurrentState(),
                context: machine.getContext(),
                isActive: true,
                duration: Date.now() - startTime,
            };
        }
        const checkpoint = await this.storage.load(taskId);
        if (checkpoint) {
            return {
                state: checkpoint.state,
                context: checkpoint.context,
                isActive: false,
            };
        }
        return null;
    }
    /**
     * List all checkpoints
     */
    async listCheckpoints(agentName) {
        return this.storage.list(agentName);
    }
    /**
     * Delete checkpoint
     */
    async deleteCheckpoint(taskId) {
        return this.storage.delete(taskId);
    }
    /**
     * Get active executions
     */
    getActiveExecutions() {
        const result = [];
        for (const [taskId, execution] of this.activeExecutions.entries()) {
            result.push({
                taskId,
                state: execution.machine.getCurrentState(),
                duration: Date.now() - execution.startTime,
            });
        }
        return result;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
/**
 * Factory function to create runtime
 */
export function createStateMachineRuntime(storage) {
    return new StateMachineRuntime(storage);
}
//# sourceMappingURL=StateMachineRuntime.js.map