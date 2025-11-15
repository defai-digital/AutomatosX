/**
 * Lockfile Types and Schema
 * Sprint 4 Day 31: Lockfile format for deterministic plugin resolution
 */
import { z } from 'zod';
/**
 * Locked dependency entry
 */
export declare const LockedDependencySchema: z.ZodObject<{
    version: z.ZodString;
    resolved: z.ZodString;
    integrity: z.ZodString;
    dependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    optional: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    version: string;
    resolved: string;
    optional: boolean;
    integrity: string;
    dependencies?: Record<string, string> | undefined;
}, {
    version: string;
    resolved: string;
    integrity: string;
    dependencies?: Record<string, string> | undefined;
    optional?: boolean | undefined;
}>;
export type LockedDependency = z.infer<typeof LockedDependencySchema>;
/**
 * Lockfile schema
 */
export declare const LockfileSchema: z.ZodObject<{
    lockfileVersion: z.ZodDefault<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        version: z.ZodString;
        resolved: z.ZodString;
        integrity: z.ZodString;
        dependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        optional: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        version: string;
        resolved: string;
        optional: boolean;
        integrity: string;
        dependencies?: Record<string, string> | undefined;
    }, {
        version: string;
        resolved: string;
        integrity: string;
        dependencies?: Record<string, string> | undefined;
        optional?: boolean | undefined;
    }>>>;
    metadata: z.ZodOptional<z.ZodObject<{
        generatedAt: z.ZodString;
        generatedBy: z.ZodDefault<z.ZodString>;
        nodeVersion: z.ZodOptional<z.ZodString>;
        automatosxVersion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        generatedAt: string;
        generatedBy: string;
        nodeVersion?: string | undefined;
        automatosxVersion?: string | undefined;
    }, {
        generatedAt: string;
        generatedBy?: string | undefined;
        nodeVersion?: string | undefined;
        automatosxVersion?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    dependencies: Record<string, {
        version: string;
        resolved: string;
        optional: boolean;
        integrity: string;
        dependencies?: Record<string, string> | undefined;
    }>;
    lockfileVersion: number;
    name?: string | undefined;
    metadata?: {
        generatedAt: string;
        generatedBy: string;
        nodeVersion?: string | undefined;
        automatosxVersion?: string | undefined;
    } | undefined;
    version?: string | undefined;
}, {
    name?: string | undefined;
    metadata?: {
        generatedAt: string;
        generatedBy?: string | undefined;
        nodeVersion?: string | undefined;
        automatosxVersion?: string | undefined;
    } | undefined;
    version?: string | undefined;
    dependencies?: Record<string, {
        version: string;
        resolved: string;
        integrity: string;
        dependencies?: Record<string, string> | undefined;
        optional?: boolean | undefined;
    }> | undefined;
    lockfileVersion?: number | undefined;
}>;
export type Lockfile = z.infer<typeof LockfileSchema>;
/**
 * Lockfile entry for flat dependency tree
 */
export interface FlatDependencyEntry {
    name: string;
    version: string;
    resolved: string;
    integrity: string;
    isOptional: boolean;
}
/**
 * Dependency graph node
 */
export interface DependencyNode {
    name: string;
    version: string;
    dependencies: DependencyNode[];
    depth: number;
    optional: boolean;
    resolved?: string;
    integrity?: string;
}
//# sourceMappingURL=Lockfile.d.ts.map