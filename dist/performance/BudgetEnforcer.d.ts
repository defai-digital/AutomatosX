/**
 * Budget Enforcer
 * Sprint 5 Day 43: Resource budget enforcement for memory and CPU limits
 */
import { EventEmitter } from 'events';
/**
 * Resource budget configuration
 */
export interface ResourceBudget {
    maxMemory?: number;
    maxCPUTime?: number;
    maxDuration?: number;
    enabled?: boolean;
}
/**
 * Budget violation
 */
export interface BudgetViolation {
    type: 'memory' | 'cpu' | 'duration';
    limit: number;
    actual: number;
    timestamp: number;
    message: string;
}
/**
 * Budget check result
 */
export interface BudgetCheckResult {
    withinBudget: boolean;
    violations: BudgetViolation[];
    usage: ResourceUsage;
}
/**
 * Resource usage
 */
export interface ResourceUsage {
    memory: number;
    cpuTime: number;
    duration: number;
}
/**
 * Budget enforcer for resource limits
 */
export declare class BudgetEnforcer extends EventEmitter {
    private budget;
    private enabled;
    private monitoredOperations;
    constructor(budget?: ResourceBudget);
    /**
     * Start monitoring an operation
     */
    startMonitoring(operationId: string): void;
    /**
     * Stop monitoring an operation
     */
    stopMonitoring(operationId: string): BudgetCheckResult | null;
    /**
     * Check budget for an operation
     */
    private checkBudget;
    /**
     * Perform budget check
     */
    private performCheck;
    /**
     * Check if operation is within budget
     */
    checkWithinBudget(operationId: string): Promise<BudgetCheckResult | null>;
    /**
     * Get budget configuration
     */
    getBudget(): Required<ResourceBudget>;
    /**
     * Update budget
     */
    updateBudget(budget: Partial<ResourceBudget>): void;
    /**
     * Enable enforcement
     */
    enable(): void;
    /**
     * Disable enforcement
     */
    disable(): void;
    /**
     * Check if enabled
     */
    isEnabled(): boolean;
    /**
     * Get all violations for an operation
     */
    getViolations(operationId: string): BudgetViolation[];
    /**
     * Get monitored operations
     */
    getMonitoredOperations(): string[];
    /**
     * Format bytes for display
     */
    private formatBytes;
    /**
     * Enforce budget for async operation
     */
    withBudget<T>(operationId: string, operation: () => Promise<T>): Promise<T>;
}
/**
 * Budget exceeded error
 */
export declare class BudgetExceededError extends Error {
    violations: BudgetViolation[];
    constructor(message: string, violations: BudgetViolation[]);
}
/**
 * Create budget enforcer
 */
export declare function createBudgetEnforcer(budget?: ResourceBudget): BudgetEnforcer;
/**
 * Get global enforcer
 */
export declare function getGlobalEnforcer(): BudgetEnforcer;
/**
 * Reset global enforcer
 */
export declare function resetGlobalEnforcer(): void;
//# sourceMappingURL=BudgetEnforcer.d.ts.map