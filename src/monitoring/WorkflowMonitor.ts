/**
 * WorkflowMonitor.ts
 *
 * Real-time workflow execution monitoring and tracking
 * Phase 6 Week 1: Advanced Monitoring & Observability
 */

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import {
  WorkflowExecution,
  WorkflowStepExecution,
  WorkflowMetrics,
  WorkflowStatus,
  WorkflowStats,
} from '../types/monitoring.types.js';
import { getDatabase } from '../database/connection.js';

/**
 * WorkflowMonitor - Real-time workflow execution tracking
 *
 * Features:
 * - Track workflow execution lifecycle
 * - Monitor step-by-step progress
 * - Real-time metrics collection
 * - Active workflow subscriptions
 * - Historical execution queries
 */
export class WorkflowMonitor extends EventEmitter {
  private db: Database.Database;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private executionMetrics: Map<string, WorkflowMetrics> = new Map();

  constructor(db?: Database.Database) {
    super();
    this.db = db || getDatabase();
    this.initializeSchema();
  }

  /**
   * Initialize monitoring schema if not exists
   */
  private initializeSchema(): void {
    // Workflow executions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_executions_monitor (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        workflow_name TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration INTEGER,
        steps_total INTEGER NOT NULL,
        steps_completed INTEGER NOT NULL DEFAULT 0,
        steps_failed INTEGER NOT NULL DEFAULT 0,
        current_step TEXT,
        error_message TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions_monitor(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions_monitor(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON workflow_executions_monitor(started_at DESC);

      -- Step executions table
      CREATE TABLE IF NOT EXISTS workflow_step_executions (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        step_key TEXT NOT NULL,
        step_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration INTEGER,
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        input_size INTEGER,
        output_size INTEGER,
        tokens_used INTEGER,
        cost REAL,
        FOREIGN KEY (execution_id) REFERENCES workflow_executions_monitor(id)
      );

      CREATE INDEX IF NOT EXISTS idx_step_executions_execution ON workflow_step_executions(execution_id);
      CREATE INDEX IF NOT EXISTS idx_step_executions_status ON workflow_step_executions(status);
    `);
  }

  // ============================================================================
  // Execution Tracking
  // ============================================================================

  /**
   * Start tracking a workflow execution
   */
  startExecution(
    workflowId: string,
    workflowName: string,
    tenantId: string,
    userId: string,
    stepsTotal: number,
    metadata?: Record<string, unknown>
  ): string {
    const id = randomUUID();
    const now = Date.now();

    const execution: WorkflowExecution = {
      id,
      workflowId,
      workflowName,
      tenantId,
      userId,
      status: 'running',
      startedAt: now,
      stepsTotal,
      stepsCompleted: 0,
      stepsFailed: 0,
      metadata,
    };

    // Store in memory
    this.activeExecutions.set(id, execution);

    // Initialize metrics
    this.executionMetrics.set(id, {
      executionId: id,
      totalDuration: 0,
      stepDurations: new Map(),
      totalTokens: 0,
      totalCost: 0,
      cacheHits: 0,
      cacheMisses: 0,
      parallelSteps: 0,
      retryCount: 0,
    });

    // Persist to database
    this.db.prepare(`
      INSERT INTO workflow_executions_monitor (
        id, workflow_id, workflow_name, tenant_id, user_id, status,
        started_at, steps_total, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      workflowId,
      workflowName,
      tenantId,
      userId,
      'running',
      now,
      stepsTotal,
      JSON.stringify(metadata || {})
    );

    this.emit('workflow.started', execution);

    return id;
  }

  /**
   * Update execution status
   */
  updateExecution(
    executionId: string,
    updates: Partial<Pick<WorkflowExecution, 'status' | 'currentStep' | 'stepsCompleted' | 'stepsFailed' | 'errorMessage'>>
  ): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    // Update in-memory
    Object.assign(execution, updates);

    // Calculate duration if completing
    if (updates.status && ['completed', 'failed', 'cancelled'].includes(updates.status)) {
      const now = Date.now();
      execution.completedAt = now;
      execution.duration = now - execution.startedAt;

      // Remove from active tracking
      this.activeExecutions.delete(executionId);

      this.emit(`workflow.${updates.status}`, execution);
    }

    // Update database
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.currentStep !== undefined) {
      setClauses.push('current_step = ?');
      values.push(updates.currentStep);
    }
    if (updates.stepsCompleted !== undefined) {
      setClauses.push('steps_completed = ?');
      values.push(updates.stepsCompleted);
    }
    if (updates.stepsFailed !== undefined) {
      setClauses.push('steps_failed = ?');
      values.push(updates.stepsFailed);
    }
    if (updates.errorMessage) {
      setClauses.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (execution.completedAt) {
      setClauses.push('completed_at = ?, duration = ?');
      values.push(execution.completedAt, execution.duration);
    }

    if (setClauses.length > 0) {
      values.push(executionId);
      this.db.prepare(`
        UPDATE workflow_executions_monitor
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `).run(...values);
    }
  }

  /**
   * Start tracking a step execution
   */
  startStep(
    executionId: string,
    stepKey: string,
    stepName: string
  ): string {
    const id = randomUUID();
    const now = Date.now();

    const stepExecution: WorkflowStepExecution = {
      id,
      executionId,
      stepKey,
      stepName,
      status: 'running',
      startedAt: now,
      retryCount: 0,
    };

    this.db.prepare(`
      INSERT INTO workflow_step_executions (
        id, execution_id, step_key, step_name, status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, executionId, stepKey, stepName, 'running', now);

    // Update current step
    this.updateExecution(executionId, { currentStep: stepKey });

    this.emit('workflow.step.started', stepExecution);

    return id;
  }

  /**
   * Complete a step execution
   */
  completeStep(
    stepId: string,
    result?: {
      tokensUsed?: number;
      cost?: number;
      inputSize?: number;
      outputSize?: number;
    }
  ): void {
    const now = Date.now();

    const row = this.db.prepare(`
      SELECT * FROM workflow_step_executions WHERE id = ?
    `).get(stepId) as any;

    if (!row) return;

    const duration = now - row.started_at;

    this.db.prepare(`
      UPDATE workflow_step_executions
      SET status = 'completed',
          completed_at = ?,
          duration = ?,
          tokens_used = ?,
          cost = ?,
          input_size = ?,
          output_size = ?
      WHERE id = ?
    `).run(
      now,
      duration,
      result?.tokensUsed || null,
      result?.cost || null,
      result?.inputSize || null,
      result?.outputSize || null,
      stepId
    );

    // Update execution metrics
    const metrics = this.executionMetrics.get(row.execution_id);
    if (metrics) {
      metrics.stepDurations.set(row.step_key, duration);
      metrics.totalTokens += result?.tokensUsed || 0;
      metrics.totalCost += result?.cost || 0;
    }

    // Update execution progress
    const execution = this.activeExecutions.get(row.execution_id);
    if (execution) {
      execution.stepsCompleted++;
      this.updateExecution(row.execution_id, { stepsCompleted: execution.stepsCompleted });
    }

    this.emit('workflow.step.completed', { stepId, executionId: row.execution_id, duration, result });
  }

  /**
   * Fail a step execution
   */
  failStep(stepId: string, errorMessage: string): void {
    const now = Date.now();

    const row = this.db.prepare(`
      SELECT * FROM workflow_step_executions WHERE id = ?
    `).get(stepId) as any;

    if (!row) return;

    const duration = now - row.started_at;

    this.db.prepare(`
      UPDATE workflow_step_executions
      SET status = 'failed',
          completed_at = ?,
          duration = ?,
          error_message = ?
      WHERE id = ?
    `).run(now, duration, errorMessage, stepId);

    // Update execution
    const execution = this.activeExecutions.get(row.execution_id);
    if (execution) {
      execution.stepsFailed++;
      this.updateExecution(row.execution_id, { stepsFailed: execution.stepsFailed });
    }

    this.emit('workflow.step.failed', { stepId, executionId: row.execution_id, errorMessage });
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Get active workflows
   */
  getActiveExecutions(tenantId?: string): WorkflowExecution[] {
    const executions = Array.from(this.activeExecutions.values());

    if (tenantId) {
      return executions.filter(e => e.tenantId === tenantId);
    }

    return executions;
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | null {
    // Check active first
    const active = this.activeExecutions.get(executionId);
    if (active) return active;

    // Query database
    const row = this.db.prepare(`
      SELECT * FROM workflow_executions_monitor WHERE id = ?
    `).get(executionId) as any;

    if (!row) return null;

    return this.rowToExecution(row);
  }

  /**
   * Get recent executions
   */
  getRecentExecutions(limit: number = 100, tenantId?: string): WorkflowExecution[] {
    let query = `
      SELECT * FROM workflow_executions_monitor
    `;

    if (tenantId) {
      query += ` WHERE tenant_id = ?`;
    }

    query += ` ORDER BY started_at DESC LIMIT ?`;

    const rows = tenantId
      ? this.db.prepare(query).all(tenantId, limit)
      : this.db.prepare(query).all(limit);

    return (rows as any[]).map(row => this.rowToExecution(row));
  }

  /**
   * Get completed workflow executions
   */
  getCompletedExecutions(limit: number = 100, tenantId?: string): WorkflowExecution[] {
    let query = `
      SELECT * FROM workflow_executions_monitor
      WHERE status = 'completed'
    `;

    if (tenantId) {
      query += ` AND tenant_id = ?`;
    }

    query += ` ORDER BY completed_at DESC LIMIT ?`;

    const rows = tenantId
      ? this.db.prepare(query).all(tenantId, limit)
      : this.db.prepare(query).all(limit);

    return (rows as any[]).map(row => this.rowToExecution(row));
  }

  /**
   * Get failed workflow executions
   */
  getFailedExecutions(limit: number = 100, tenantId?: string): WorkflowExecution[] {
    let query = `
      SELECT * FROM workflow_executions_monitor
      WHERE status = 'failed'
    `;

    if (tenantId) {
      query += ` AND tenant_id = ?`;
    }

    query += ` ORDER BY started_at DESC LIMIT ?`;

    const rows = tenantId
      ? this.db.prepare(query).all(tenantId, limit)
      : this.db.prepare(query).all(limit);

    return (rows as any[]).map(row => this.rowToExecution(row));
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats(tenantId?: string): WorkflowStats {
    const baseQuery = tenantId
      ? `SELECT * FROM workflow_executions_monitor WHERE tenant_id = ?`
      : `SELECT * FROM workflow_executions_monitor`;

    const rows = (tenantId
      ? this.db.prepare(baseQuery).all(tenantId)
      : this.db.prepare(baseQuery).all()) as any[];

    const total = rows.length;
    const running = rows.filter(r => r.status === 'running').length;
    const completed = rows.filter(r => r.status === 'completed').length;
    const failed = rows.filter(r => r.status === 'failed').length;
    const cancelled = rows.filter(r => r.status === 'cancelled').length;

    const completedRows = rows.filter(r => r.duration);
    const avgDuration = completedRows.length > 0
      ? completedRows.reduce((sum, r) => sum + r.duration, 0) / completedRows.length
      : 0;

    const successRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      running,
      completed,
      failed,
      cancelled,
      avgDuration,
      successRate,
    };
  }

  /**
   * Get step executions for a workflow execution
   */
  getStepExecutions(executionId: string): WorkflowStepExecution[] {
    const rows = this.db.prepare(`
      SELECT * FROM workflow_step_executions
      WHERE execution_id = ?
      ORDER BY started_at ASC
    `).all(executionId) as any[];

    return rows.map(row => this.rowToStepExecution(row));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private rowToExecution(row: any): WorkflowExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name,
      tenantId: row.tenant_id,
      userId: row.user_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      stepsTotal: row.steps_total,
      stepsCompleted: row.steps_completed,
      stepsFailed: row.steps_failed,
      currentStep: row.current_step,
      errorMessage: row.error_message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private rowToStepExecution(row: any): WorkflowStepExecution {
    return {
      id: row.id,
      executionId: row.execution_id,
      stepKey: row.step_key,
      stepName: row.step_name,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      retryCount: row.retry_count,
      errorMessage: row.error_message,
      inputSize: row.input_size,
      outputSize: row.output_size,
      tokensUsed: row.tokens_used,
      cost: row.cost,
    };
  }

  /**
   * Cleanup old executions (retention policy)
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    const result = this.db.prepare(`
      DELETE FROM workflow_executions_monitor
      WHERE started_at < ?
    `).run(cutoff);

    return result.changes;
  }
}
