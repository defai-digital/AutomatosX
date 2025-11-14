/**
 * Plugin Manifest Types
 * Sprint 4 Day 31: Plugin manifest schema and validation
 */

import { z } from 'zod'

/**
 * Semantic version schema
 */
export const SemVerSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    'Must be valid semantic version'
  )

/**
 * Dependency specification
 */
export const DependencySpecSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1), // Can be semver range like "^1.2.3", "~2.0.0"
  optional: z.boolean().default(false),
})

export type DependencySpec = z.infer<typeof DependencySpecSchema>

/**
 * Plugin permissions
 */
export const PluginPermissionsSchema = z.object({
  filesystem: z
    .object({
      read: z.array(z.string()).optional(),
      write: z.array(z.string()).optional(),
    })
    .optional(),
  network: z
    .object({
      allowedDomains: z.array(z.string()).optional(),
    })
    .optional(),
  memory: z
    .object({
      maxMB: z.number().positive().optional(),
    })
    .optional(),
  runtime: z
    .object({
      canSpawnProcess: z.boolean().default(false),
      canAccessEnv: z.boolean().default(false),
    })
    .optional(),
})

export type PluginPermissions = z.infer<typeof PluginPermissionsSchema>

/**
 * Plugin manifest
 */
export const PluginManifestSchema = z.object({
  name: z.string().min(1),
  version: SemVerSchema,
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().default('MIT'),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  main: z.string().default('index.js'),
  dependencies: z.record(z.string()).default({}),
  optionalDependencies: z.record(z.string()).default({}),
  peerDependencies: z.record(z.string()).default({}),
  permissions: PluginPermissionsSchema.default({}),
  engines: z
    .object({
      automatosx: z.string().optional(),
      node: z.string().optional(),
    })
    .default({}),
  keywords: z.array(z.string()).default([]),
})

export type PluginManifest = z.infer<typeof PluginManifestSchema>

/**
 * Resolved dependency
 */
export interface ResolvedDependency {
  name: string
  version: string
  resolved: string // URL or path to package
  integrity: string // SHA-512 hash
  dependencies: Record<string, string>
}

/**
 * Plugin metadata (registry)
 */
export const PluginMetadataSchema = z.object({
  name: z.string().min(1),
  version: SemVerSchema,
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().default('MIT'),
  downloads: z.number().default(0),
  rating: z.number().min(0).max(5).default(0),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  verified: z.boolean().default(false),
})

export type PluginMetadata = z.infer<typeof PluginMetadataSchema>
