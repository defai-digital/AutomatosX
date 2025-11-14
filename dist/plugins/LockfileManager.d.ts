/**
 * Lockfile Manager
 * Sprint 4 Day 31: Lockfile serialization, deserialization, and validation
 */
import type { Lockfile } from './types/Lockfile.js';
import type { DependencyNode, FlatDependencyEntry } from './types/Lockfile.js';
/**
 * Lockfile Manager
 */
export declare class LockfileManager {
    private lockfilePath;
    constructor(projectPath: string);
    /**
     * Read and parse lockfile
     */
    read(): Promise<Lockfile | null>;
    /**
     * Write lockfile
     */
    write(lockfile: Lockfile): Promise<void>;
    /**
     * Generate lockfile from dependency nodes
     */
    generate(projectName: string, projectVersion: string, nodes: DependencyNode[]): Promise<Lockfile>;
    /**
     * Update lockfile with new dependencies
     */
    update(newNodes: DependencyNode[]): Promise<Lockfile>;
    /**
     * Validate lockfile integrity
     */
    validate(): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    /**
     * Compare lockfile with manifest
     */
    compare(manifestDeps: Record<string, string>): Promise<{
        matching: boolean;
        differences: string[];
    }>;
    /**
     * Get flat dependency list from lockfile
     */
    getFlatDependencies(): Promise<FlatDependencyEntry[]>;
    /**
     * Generate integrity hash (mock)
     */
    private generateIntegrity;
}
/**
 * Create lockfile manager
 */
export declare function createLockfileManager(projectPath: string): LockfileManager;
//# sourceMappingURL=LockfileManager.d.ts.map