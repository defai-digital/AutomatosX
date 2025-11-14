/**
 * Migration Validator
 * Sprint 6 Day 55: v1 to v2 migration validation and compatibility checking
 */
import { EventEmitter } from 'events';
/**
 * Migration compatibility level
 */
export declare enum CompatibilityLevel {
    FULLY_COMPATIBLE = "fully_compatible",
    MOSTLY_COMPATIBLE = "mostly_compatible",
    BREAKING_CHANGES = "breaking_changes",
    INCOMPATIBLE = "incompatible"
}
/**
 * Migration issue severity
 */
export declare enum IssueSeverity {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    CRITICAL = "critical"
}
/**
 * Migration issue
 */
export interface MigrationIssue {
    severity: IssueSeverity;
    category: string;
    message: string;
    location?: string;
    autoFixable: boolean;
    recommendation?: string;
}
/**
 * V1 configuration
 */
export interface V1Config {
    version: string;
    plugins?: string[];
    settings?: Record<string, unknown>;
    workflows?: Array<{
        name: string;
        steps: string[];
    }>;
}
/**
 * Migration validation result
 */
export interface ValidationResult {
    compatible: boolean;
    compatibilityLevel: CompatibilityLevel;
    issues: MigrationIssue[];
    warnings: number;
    errors: number;
    autoFixableCount: number;
    estimatedMigrationTime: number;
}
/**
 * Migration plan
 */
export interface MigrationPlan {
    id: string;
    sourceVersion: string;
    targetVersion: string;
    steps: MigrationStep[];
    estimatedDuration: number;
    requiresBackup: boolean;
    requiresDowntime: boolean;
    rollbackSupported: boolean;
}
/**
 * Migration step
 */
export interface MigrationStep {
    number: number;
    title: string;
    description: string;
    automated: boolean;
    command?: string;
    validation?: string;
    estimatedDuration: number;
}
/**
 * Migration execution result
 */
export interface MigrationExecutionResult {
    success: boolean;
    planId: string;
    startTime: number;
    endTime: number;
    duration: number;
    stepsCompleted: number;
    stepsTotal: number;
    errors?: string[];
}
/**
 * Migration Validator
 */
export declare class MigrationValidator extends EventEmitter {
    private plans;
    private validationCache;
    private planCounter;
    /**
     * Validate v1 configuration for migration
     */
    validateV1Config(config: V1Config): ValidationResult;
    /**
     * Create migration plan
     */
    createMigrationPlan(sourceVersion: string, targetVersion?: string): MigrationPlan;
    /**
     * Execute migration plan
     */
    executeMigrationPlan(planId: string): Promise<MigrationExecutionResult>;
    /**
     * Get migration plan
     */
    getPlan(planId: string): MigrationPlan | undefined;
    /**
     * Get all plans
     */
    getAllPlans(): MigrationPlan[];
    /**
     * Clear all plans
     */
    clearAll(): void;
    /**
     * Check if version is supported
     */
    private isVersionSupported;
    /**
     * Validate plugin
     */
    private validatePlugin;
    /**
     * Validate settings
     */
    private validateSettings;
    /**
     * Validate workflow
     */
    private validateWorkflow;
    /**
     * Estimate migration time
     */
    private estimateMigrationTime;
    /**
     * Execute migration step (simulated)
     */
    private executeStep;
}
/**
 * Create migration validator
 */
export declare function createMigrationValidator(): MigrationValidator;
/**
 * Get global migration validator
 */
export declare function getGlobalMigrationValidator(): MigrationValidator;
/**
 * Reset global migration validator
 */
export declare function resetGlobalMigrationValidator(): void;
//# sourceMappingURL=MigrationValidator.d.ts.map