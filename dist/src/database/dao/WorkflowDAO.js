/**
 * WorkflowDAO.ts
 *
 * Data Access Object for workflow tables
 * Provides CRUD operations for workflows, executions, steps, and checkpoints
 * Phase 4 Week 1: Foundation & State Machine
 */
import { getDatabase } from '../connection.js';
import { randomUUID } from 'crypto';
/**
 * WorkflowDAO - Data Access Object for workflow tables
 */
export class WorkflowDAO {
    db;
    constructor(db) {
        this.db = db || getDatabase();
    }
    // ============================================================================
    // Workflow Definition Methods
    // ============================================================================
    /**
     * Create a new workflow definition
     */
    createWorkflow(input) {
        const id = randomUUID();
        const now = Date.now();
        const definition = JSON.stringify(input.definition);
        const tags = input.tags ? JSON.stringify(input.tags) : null;
        const stmt = this.db.prepare(`
      INSERT INTO workflows (id, name, description, definition, version, author, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, input.name, input.description || null, definition, input.definition.version || '1.0.0', input.author || null, tags, now, now);
        return this.getWorkflowById(id);
    }
    /**
     * Get workflow by ID
     */
    getWorkflowById(id) {
        const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?');
        const row = stmt.get(id);
        return row ? this.rowToWorkflow(row) : null;
    }
    /**
     * Get workflow by name
     */
    getWorkflowByName(name) {
        const stmt = this.db.prepare('SELECT * FROM workflows WHERE name = ?');
        const row = stmt.get(name);
        return row ? this.rowToWorkflow(row) : null;
    }
    /**
     * List all active workflows
     */
    listWorkflows() {
        const stmt = this.db.prepare('SELECT * FROM workflows WHERE is_active = 1 ORDER BY created_at DESC');
        const rows = stmt.all();
        return rows.map((row) => this.rowToWorkflow(row));
    }
    /**
     * Update workflow definition
     */
    updateWorkflow(id, definition) {
        const now = Date.now();
        const stmt = this.db.prepare(`
      UPDATE workflows SET definition = ?, version = ?, updated_at = ? WHERE id = ?
    `);
        stmt.run(JSON.stringify(definition), definition.version || '1.0.0', now, id);
    }
    /**
     * Archive a workflow (soft delete)
     */
    archiveWorkflow(id) {
        const stmt = this.db.prepare('UPDATE workflows SET is_active = 0 WHERE id = ?');
        stmt.run(id);
    }
    // ============================================================================
    // Workflow Execution Methods
    // ============================================================================
    /**
     * Create a new workflow execution
     */
    createExecution(input) {
        const id = randomUUID();
        const now = Date.now();
        const context = JSON.stringify(input.context || {});
        const stmt = this.db.prepare(`
      INSERT INTO workflow_executions (
        id, workflow_id, state, context, created_at, triggered_by, priority, parent_execution_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, input.workflowId, 'idle', context, now, input.triggeredBy || null, input.priority || 0, input.parentExecutionId || null);
        return this.getExecutionById(id);
    }
    /**
     * Get execution by ID
     */
    getExecutionById(id) {
        const stmt = this.db.prepare('SELECT * FROM workflow_executions WHERE id = ?');
        const row = stmt.get(id);
        return row ? this.rowToExecution(row) : null;
    }
    /**
     * List executions for a workflow
     */
    listExecutions(workflowId, limit = 50) {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_executions WHERE workflow_id = ? ORDER BY created_at DESC LIMIT ?
    `);
        const rows = stmt.all(workflowId, limit);
        return rows.map((row) => this.rowToExecution(row));
    }
    /**
     * List active executions (not completed/failed/cancelled)
     */
    listActiveExecutions() {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_executions
      WHERE state NOT IN ('completed', 'failed', 'cancelled')
      ORDER BY priority DESC, created_at ASC
    `);
        const rows = stmt.all();
        return rows.map((row) => this.rowToExecution(row));
    }
    /**
     * Update execution state
     */
    updateExecutionState(id, state, error) {
        const now = Date.now();
        let stmt;
        if (state === 'executing') {
            // Starting execution
            stmt = this.db.prepare(`
        UPDATE workflow_executions SET state = ?, started_at = ? WHERE id = ?
      `);
            stmt.run(state, now, id);
        }
        else if (state === 'completed') {
            // Completing execution
            stmt = this.db.prepare(`
        UPDATE workflow_executions SET state = ?, completed_at = ?, duration_ms = completed_at - started_at WHERE id = ?
      `);
            stmt.run(state, now, id);
        }
        else if (state === 'failed') {
            // Failing execution
            stmt = this.db.prepare(`
        UPDATE workflow_executions SET state = ?, completed_at = ?, error = ? WHERE id = ?
      `);
            stmt.run(state, now, error || null, id);
        }
        else if (state === 'paused') {
            // Pausing execution
            stmt = this.db.prepare(`
        UPDATE workflow_executions SET state = ?, paused_at = ? WHERE id = ?
      `);
            stmt.run(state, now, id);
        }
        else if (state === 'cancelled') {
            // Cancelling execution
            stmt = this.db.prepare(`
        UPDATE workflow_executions SET state = ?, cancelled_at = ? WHERE id = ?
      `);
            stmt.run(state, now, id);
        }
        else {
            // Generic state update
            stmt = this.db.prepare('UPDATE workflow_executions SET state = ? WHERE id = ?');
            stmt.run(state, id);
        }
    }
    /**
     * Update execution context
     */
    updateExecutionContext(id, context) {
        const stmt = this.db.prepare('UPDATE workflow_executions SET context = ? WHERE id = ?');
        stmt.run(JSON.stringify(context), id);
    }
    /**
     * Increment resume count
     */
    incrementResumeCount(id) {
        const stmt = this.db.prepare('UPDATE workflow_executions SET resume_count = resume_count + 1 WHERE id = ?');
        stmt.run(id);
    }
    // ============================================================================
    // Step Execution Methods
    // ============================================================================
    /**
     * Create step execution
     */
    createStepExecution(input) {
        const id = randomUUID();
        const stmt = this.db.prepare(`
      INSERT INTO workflow_step_executions (id, execution_id, step_id, state, agent_used)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, input.executionId, input.stepId, input.state, input.agentUsed || null);
        return this.getStepExecutionById(id);
    }
    /**
     * Get step execution by ID
     */
    getStepExecutionById(id) {
        const stmt = this.db.prepare('SELECT * FROM workflow_step_executions WHERE id = ?');
        const row = stmt.get(id);
        return row ? this.rowToStepExecution(row) : null;
    }
    /**
     * List step executions for an execution
     */
    listStepExecutions(executionId) {
        const stmt = this.db.prepare('SELECT * FROM workflow_step_executions WHERE execution_id = ? ORDER BY started_at ASC');
        const rows = stmt.all(executionId);
        return rows.map((row) => this.rowToStepExecution(row));
    }
    /**
     * Update step execution state
     */
    updateStepExecutionState(id, state, result, error) {
        const now = Date.now();
        if (state === 'running') {
            const stmt = this.db.prepare('UPDATE workflow_step_executions SET state = ?, started_at = ? WHERE id = ?');
            stmt.run(state, now, id);
        }
        else if (state === 'completed') {
            const stmt = this.db.prepare(`
        UPDATE workflow_step_executions
        SET state = ?, result = ?, completed_at = ?, duration_ms = completed_at - started_at
        WHERE id = ?
      `);
            stmt.run(state, result ? JSON.stringify(result) : null, now, id);
        }
        else if (state === 'failed') {
            const stmt = this.db.prepare(`
        UPDATE workflow_step_executions SET state = ?, error = ?, completed_at = ? WHERE id = ?
      `);
            stmt.run(state, error || null, now, id);
        }
        else {
            const stmt = this.db.prepare('UPDATE workflow_step_executions SET state = ? WHERE id = ?');
            stmt.run(state, id);
        }
    }
    /**
     * Increment retry count for step execution
     */
    incrementStepRetryCount(id, error) {
        const stmt = this.db.prepare(`
      UPDATE workflow_step_executions
      SET retry_count = retry_count + 1,
          previous_errors = CASE
            WHEN previous_errors IS NULL THEN json_array(?)
            ELSE json_insert(previous_errors, '$[#]', ?)
          END
      WHERE id = ?
    `);
        stmt.run(error, error, id);
    }
    // ============================================================================
    // Checkpoint Methods
    // ============================================================================
    /**
     * Create checkpoint
     */
    createCheckpoint(input) {
        const id = randomUUID();
        const now = Date.now();
        const context = JSON.stringify(input.context);
        const completedSteps = JSON.stringify(input.completedSteps);
        const pendingSteps = JSON.stringify(input.pendingSteps);
        const sizeBytes = Buffer.byteLength(context, 'utf8');
        const stmt = this.db.prepare(`
      INSERT INTO workflow_checkpoints (
        id, execution_id, state, context, completed_steps, pending_steps, created_at, created_by, label, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, input.executionId, input.state, context, completedSteps, pendingSteps, now, input.createdBy || 'automatic', input.label || null, sizeBytes);
        // Update execution with last checkpoint ID
        const updateStmt = this.db.prepare('UPDATE workflow_executions SET last_checkpoint_id = ? WHERE id = ?');
        updateStmt.run(id, input.executionId);
        return this.getCheckpointById(id);
    }
    /**
     * Get checkpoint by ID
     */
    getCheckpointById(id) {
        const stmt = this.db.prepare('SELECT * FROM workflow_checkpoints WHERE id = ?');
        const row = stmt.get(id);
        return row ? this.rowToCheckpoint(row) : null;
    }
    /**
     * List checkpoints for execution
     */
    listCheckpoints(executionId, limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_checkpoints WHERE execution_id = ? ORDER BY created_at DESC LIMIT ?
    `);
        const rows = stmt.all(executionId, limit);
        return rows.map((row) => this.rowToCheckpoint(row));
    }
    /**
     * Get latest checkpoint for execution
     */
    getLatestCheckpoint(executionId) {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_checkpoints WHERE execution_id = ? ORDER BY created_at DESC LIMIT 1
    `);
        const row = stmt.get(executionId);
        return row ? this.rowToCheckpoint(row) : null;
    }
    /**
     * Delete checkpoint
     */
    deleteCheckpoint(id) {
        const stmt = this.db.prepare('DELETE FROM workflow_checkpoints WHERE id = ?');
        stmt.run(id);
    }
    /**
     * Prune old checkpoints
     */
    pruneOldCheckpoints(retentionDays = 7) {
        const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const stmt = this.db.prepare('DELETE FROM workflow_checkpoints WHERE created_at < ?');
        const result = stmt.run(cutoffTime);
        return result.changes;
    }
    // ============================================================================
    // Event Methods
    // ============================================================================
    /**
     * Log workflow event
     */
    logEvent(input) {
        const id = randomUUID();
        const now = Date.now();
        const eventData = input.eventData ? JSON.stringify(input.eventData) : null;
        const stmt = this.db.prepare(`
      INSERT INTO workflow_events (id, execution_id, event_type, event_data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, input.executionId, input.eventType, eventData, now);
    }
    /**
     * Get events for execution
     */
    getEvents(executionId, limit = 100) {
        const stmt = this.db.prepare(`
      SELECT * FROM workflow_events WHERE execution_id = ? ORDER BY timestamp DESC LIMIT ?
    `);
        const rows = stmt.all(executionId, limit);
        return rows.map((row) => this.rowToEvent(row));
    }
    // ============================================================================
    // Statistics Methods
    // ============================================================================
    /**
     * Get workflow statistics
     */
    getWorkflowStats(workflowId) {
        let stmt;
        if (workflowId) {
            stmt = this.db.prepare('SELECT * FROM v_workflow_stats WHERE workflow_id = ?');
            const row = stmt.get(workflowId);
            return row ? [this.rowToStats(row)] : [];
        }
        else {
            stmt = this.db.prepare('SELECT * FROM v_workflow_stats');
            const rows = stmt.all();
            return rows.map((row) => this.rowToStats(row));
        }
    }
    // ============================================================================
    // Helper Methods - Row to Object Conversion
    // ============================================================================
    rowToWorkflow(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description || undefined,
            definition: row.definition,
            version: row.version,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            author: row.author || undefined,
            tags: row.tags || undefined,
            isActive: row.is_active,
            totalExecutions: row.total_executions,
            successfulExecutions: row.successful_executions,
            failedExecutions: row.failed_executions,
            avgDurationMs: row.avg_duration_ms || undefined,
        };
    }
    rowToExecution(row) {
        return {
            id: row.id,
            workflowId: row.workflow_id,
            state: row.state,
            context: row.context,
            createdAt: row.created_at,
            startedAt: row.started_at || undefined,
            completedAt: row.completed_at || undefined,
            pausedAt: row.paused_at || undefined,
            cancelledAt: row.cancelled_at || undefined,
            durationMs: row.duration_ms || undefined,
            error: row.error || undefined,
            errorStepId: row.error_step_id || undefined,
            lastCheckpointId: row.last_checkpoint_id || undefined,
            resumeCount: row.resume_count,
            triggeredBy: row.triggered_by || undefined,
            priority: row.priority,
            parentExecutionId: row.parent_execution_id || undefined,
        };
    }
    rowToStepExecution(row) {
        return {
            id: row.id,
            executionId: row.execution_id,
            stepId: row.step_id,
            state: row.state,
            result: row.result || undefined,
            error: row.error || undefined,
            startedAt: row.started_at || undefined,
            completedAt: row.completed_at || undefined,
            durationMs: row.duration_ms || undefined,
            retryCount: row.retry_count,
            previousErrors: row.previous_errors || undefined,
            agentUsed: row.agent_used || undefined,
            providerUsed: row.provider_used || undefined,
            modelUsed: row.model_used || undefined,
            tokensUsed: row.tokens_used || undefined,
            cost: row.cost || undefined,
        };
    }
    rowToCheckpoint(row) {
        return {
            id: row.id,
            executionId: row.execution_id,
            state: row.state,
            context: row.context,
            completedSteps: row.completed_steps,
            pendingSteps: row.pending_steps,
            createdAt: row.created_at,
            createdBy: row.created_by || undefined,
            label: row.label || undefined,
            sizeBytes: row.size_bytes || undefined,
        };
    }
    rowToEvent(row) {
        return {
            id: row.id,
            executionId: row.execution_id,
            eventType: row.event_type,
            eventData: row.event_data || undefined,
            timestamp: row.timestamp,
        };
    }
    rowToStats(row) {
        return {
            workflowId: row.workflow_id,
            workflowName: row.workflow_name,
            version: row.version,
            totalExecutions: row.total_executions,
            successfulExecutions: row.successful_executions,
            failedExecutions: row.failed_executions,
            successRatePercent: row.success_rate_percent,
            avgDurationMs: row.avg_duration_ms || undefined,
            activeExecutions: row.active_executions,
            lastExecutionAt: row.last_execution_at || undefined,
        };
    }
}
//# sourceMappingURL=WorkflowDAO.js.map