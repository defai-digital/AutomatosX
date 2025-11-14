/**
 * Dependency Resolver
 * Sprint 4 Day 31: DAG resolver with cycle detection and topological sort
 */
import type { PluginManifest } from './types/PluginManifest.js';
import type { DependencyNode, FlatDependencyEntry } from './types/Lockfile.js';
/**
 * Dependency resolution result
 */
export interface ResolutionResult {
    resolved: DependencyNode[];
    errors: ResolutionError[];
    warnings: ResolutionWarning[];
}
/**
 * Resolution error
 */
export interface ResolutionError {
    type: 'CYCLE' | 'VERSION_CONFLICT' | 'NOT_FOUND' | 'INVALID_VERSION';
    message: string;
    path?: string[];
    dependency?: string;
}
/**
 * Resolution warning
 */
export interface ResolutionWarning {
    type: 'OPTIONAL_MISSING' | 'PEER_UNMET';
    message: string;
    dependency?: string;
}
/**
 * Dependency Resolver
 */
export declare class DependencyResolver {
    private visited;
    private stack;
    private resolved;
    /**
     * Resolve dependencies from manifest
     */
    resolve(manifest: PluginManifest): Promise<ResolutionResult>;
    /**
     * Build dependency graph recursively
     */
    private buildDependencyGraph;
    /**
     * Detect cycles in dependency graph
     */
    private detectCycles;
    /**
     * Topological sort of dependency graph
     */
    private topologicalSort;
    /**
     * Detect version conflicts
     */
    private detectVersionConflicts;
    /**
     * Check optional dependencies
     */
    private checkOptionalDependencies;
    /**
     * Resolve version from range
     */
    private resolveVersion;
    /**
     * Flatten dependency tree to list
     */
    flattenDependencies(nodes: DependencyNode[]): FlatDependencyEntry[];
}
/**
 * Create dependency resolver
 */
export declare function createDependencyResolver(): DependencyResolver;
//# sourceMappingURL=DependencyResolver.d.ts.map