/**
 * Lockfile Types and Schema
 * Sprint 4 Day 31: Lockfile format for deterministic plugin resolution
 */
import { z } from 'zod';
/**
 * Locked dependency entry
 */
export const LockedDependencySchema = z.object({
    version: z.string(),
    resolved: z.string(), // URL or path
    integrity: z.string(), // SHA-512 hash
    dependencies: z.record(z.string()).optional(),
    optional: z.boolean().default(false),
});
/**
 * Lockfile schema
 */
export const LockfileSchema = z.object({
    lockfileVersion: z.number().default(1),
    name: z.string().optional(),
    version: z.string().optional(),
    dependencies: z.record(LockedDependencySchema).default({}),
    metadata: z
        .object({
        generatedAt: z.string().datetime(),
        generatedBy: z.string().default('automatosx'),
        nodeVersion: z.string().optional(),
        automatosxVersion: z.string().optional(),
    })
        .optional(),
});
//# sourceMappingURL=Lockfile.js.map