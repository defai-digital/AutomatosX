/**
 * Dependency Updater
 * Sprint 6 Day 53: Automated dependency update and PR creation
 */
import { EventEmitter } from 'events';
/**
 * Dependency update type
 */
export declare enum UpdateType {
    PATCH = "patch",// 1.0.0 → 1.0.1
    MINOR = "minor",// 1.0.0 → 1.1.0
    MAJOR = "major"
}
/**
 * Outdated dependency
 */
export interface OutdatedDependency {
    name: string;
    current: string;
    latest: string;
    wanted: string;
    type: UpdateType;
    location: string;
}
/**
 * Dependency update
 */
export interface DependencyUpdate {
    dependency: OutdatedDependency;
    updateTo: string;
    changelog?: string;
    breakingChanges?: string[];
}
/**
 * Update PR
 */
export interface UpdatePR {
    id: string;
    title: string;
    body: string;
    branch: string;
    updates: DependencyUpdate[];
    testsPass: boolean;
    createdAt: number;
}
/**
 * Update check result
 */
export interface UpdateCheckResult {
    outdated: OutdatedDependency[];
    upToDate: number;
    total: number;
    securityVulnerabilities: number;
}
/**
 * Dependency updater
 */
export declare class DependencyUpdater extends EventEmitter {
    private prs;
    private prCounter;
    /**
     * Check for outdated dependencies
     */
    checkOutdated(projectPath: string): Promise<UpdateCheckResult>;
    /**
     * Create update PR
     */
    createUpdatePR(updates: DependencyUpdate[], options?: {
        title?: string;
        branch?: string;
        runTests?: boolean;
    }): Promise<UpdatePR>;
    /**
     * Get PR
     */
    getPR(prId: string): UpdatePR | undefined;
    /**
     * Get all PRs
     */
    getAllPRs(): UpdatePR[];
    /**
     * Generate PR body
     */
    private generatePRBody;
    /**
     * Run tests
     */
    private runTests;
    /**
     * Determine update type
     */
    static determineUpdateType(current: string, latest: string): UpdateType;
    /**
     * Should auto-merge
     */
    static shouldAutoMerge(update: DependencyUpdate, policy: MergePolicy): boolean;
    /**
     * Clear PR
     */
    clearPR(prId: string): void;
    /**
     * Clear all PRs
     */
    clearAll(): void;
}
/**
 * Merge policy
 */
export type MergePolicy = 'none' | 'patch-only' | 'patch-and-minor' | 'all';
/**
 * Create dependency updater
 */
export declare function createDependencyUpdater(): DependencyUpdater;
/**
 * Get global updater
 */
export declare function getGlobalUpdater(): DependencyUpdater;
/**
 * Reset global updater
 */
export declare function resetGlobalUpdater(): void;
//# sourceMappingURL=DependencyUpdater.d.ts.map