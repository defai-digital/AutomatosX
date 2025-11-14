/**
 * Operations Runbook
 * Sprint 6 Day 53: Operations runbooks structure and templates
 */
import { EventEmitter } from 'events';
/**
 * Runbook category
 */
export declare enum RunbookCategory {
    INCIDENT_RESPONSE = "incident_response",
    MAINTENANCE = "maintenance",
    DEPLOYMENT = "deployment",
    MONITORING = "monitoring",
    BACKUP_RESTORE = "backup_restore"
}
/**
 * Runbook step
 */
export interface RunbookStep {
    number: number;
    title: string;
    description: string;
    command?: string;
    expectedOutput?: string;
    verification?: string;
}
/**
 * Runbook
 */
export interface Runbook {
    id: string;
    title: string;
    category: RunbookCategory;
    overview: string;
    prerequisites: string[];
    steps: RunbookStep[];
    rollback?: RunbookStep[];
    verification: string[];
    lastUpdated: number;
    version: string;
}
/**
 * Runbook execution record
 */
export interface RunbookExecution {
    id: string;
    runbookId: string;
    executedBy: string;
    startTime: number;
    endTime?: number;
    status: 'in_progress' | 'completed' | 'failed';
    currentStep?: number;
    errors?: string[];
}
/**
 * Operations runbook manager
 */
export declare class OperationsRunbook extends EventEmitter {
    private runbooks;
    private executions;
    private executionCounter;
    constructor();
    /**
     * Register runbook
     */
    registerRunbook(runbook: Omit<Runbook, 'id' | 'lastUpdated' | 'version'>): Runbook;
    /**
     * Get runbook
     */
    getRunbook(id: string): Runbook | undefined;
    /**
     * Get runbooks by category
     */
    getRunbooksByCategory(category: RunbookCategory): Runbook[];
    /**
     * Get all runbooks
     */
    getAllRunbooks(): Runbook[];
    /**
     * Start execution
     */
    startExecution(runbookId: string, executedBy: string): RunbookExecution;
    /**
     * Update execution
     */
    updateExecution(executionId: string, updates: Partial<Pick<RunbookExecution, 'currentStep' | 'status' | 'errors'>>): RunbookExecution | null;
    /**
     * Complete execution
     */
    completeExecution(executionId: string, success: boolean): RunbookExecution | null;
    /**
     * Get execution
     */
    getExecution(executionId: string): RunbookExecution | undefined;
    /**
     * Get executions for runbook
     */
    getExecutionsForRunbook(runbookId: string): RunbookExecution[];
    /**
     * Search runbooks
     */
    searchRunbooks(query: string): Runbook[];
    /**
     * Generate runbook ID from title
     */
    private generateRunbookId;
    /**
     * Register built-in runbooks
     */
    private registerBuiltInRunbooks;
    /**
     * Clear all
     */
    clearAll(): void;
}
/**
 * Create operations runbook
 */
export declare function createOperationsRunbook(): OperationsRunbook;
/**
 * Get global runbook
 */
export declare function getGlobalRunbook(): OperationsRunbook;
/**
 * Reset global runbook
 */
export declare function resetGlobalRunbook(): void;
//# sourceMappingURL=OperationsRunbook.d.ts.map