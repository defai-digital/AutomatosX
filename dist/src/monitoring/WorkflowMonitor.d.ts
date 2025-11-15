/**
 * WorkflowMonitor.ts
 *
 * Real-time workflow execution monitoring and tracking
 * Phase 6 Week 1: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { WorkflowExecution, WorkflowStepExecution, WorkflowStats } from '../types/monitoring.types.js';
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
export declare class WorkflowMonitor extends EventEmitter {
    private db;
    private activeExecutions;
    private executionMetrics;
    constructor(db?: Database.Database);
    /**
     * Initialize monitoring schema if not exists
     */
    private initializeSchema;
    /**
     * Start tracking a workflow execution
     */
    startExecution(workflowId: string, workflowName: string, tenantId: string, userId: string, stepsTotal: number, metadata?: Record<string, unknown>): string;
    /**
     * Update execution status
     */
    updateExecution(executionId: string, updates: Partial<Pick<WorkflowExecution, 'status' | 'currentStep' | 'stepsCompleted' | 'stepsFailed' | 'errorMessage'>>): void;
    /**
     * Start tracking a step execution
     */
    startStep(executionId: string, stepKey: string, stepName: string): string;
    /**
     * Complete a step execution
     */
    completeStep(stepId: string, result?: {
        tokensUsed?: number;
        cost?: number;
        inputSize?: number;
        outputSize?: number;
    }): void;
    /**
     * Fail a step execution
     */
    failStep(stepId: string, errorMessage: string): void;
    /**
     * Get active workflows
     */
    getActiveExecutions(tenantId?: string): WorkflowExecution[];
    /**
     * Get execution by ID
     */
    getExecution(executionId: string): WorkflowExecution | null;
    /**
     * Get recent executions
     */
    getRecentExecutions(limit?: number, tenantId?: string): WorkflowExecution[];
    /**
     * Get workflow statistics
     */
    getWorkflowStats(tenantId?: string): WorkflowStats;
    /**
     * Get step executions for a workflow execution
     */
    getStepExecutions(executionId: string): WorkflowStepExecution[];
    private rowToExecution;
    private rowToStepExecution;
    /**
     * Cleanup old executions (retention policy)
     */
    cleanup(retentionDays?: number): Promise<number>;
}
//# sourceMappingURL=WorkflowMonitor.d.ts.map