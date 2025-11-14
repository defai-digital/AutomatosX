/**
 * Lockfile Types and Schema
 * Sprint 4 Day 31: Lockfile format for deterministic plugin resolution
 */

import { z } from 'zod'

/**
 * Locked dependency entry
 */
export const LockedDependencySchema = z.object({
  version: z.string(),
  resolved: z.string(), // URL or path
  integrity: z.string(), // SHA-512 hash
  dependencies: z.record(z.string()).optional(),
  optional: z.boolean().default(false),
})

export type LockedDependency = z.infer<typeof LockedDependencySchema>

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
})

export type Lockfile = z.infer<typeof LockfileSchema>

/**
 * Lockfile entry for flat dependency tree
 */
export interface FlatDependencyEntry {
  name: string
  version: string
  resolved: string
  integrity: string
  isOptional: boolean
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  name: string
  version: string
  dependencies: DependencyNode[]
  depth: number
  optional: boolean
  resolved?: string
  integrity?: string
}
