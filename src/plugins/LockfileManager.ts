/**
 * Lockfile Manager
 * Sprint 4 Day 31: Lockfile serialization, deserialization, and validation
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import type { Lockfile, LockedDependency } from './types/Lockfile.js'
import { LockfileSchema } from './types/Lockfile.js'
import type { DependencyNode, FlatDependencyEntry } from './types/Lockfile.js'

/**
 * Lockfile Manager
 */
export class LockfileManager {
  private lockfilePath: string

  constructor(projectPath: string) {
    this.lockfilePath = join(projectPath, 'ax-plugin.lock')
  }

  /**
   * Read and parse lockfile
   */
  async read(): Promise<Lockfile | null> {
    try {
      const content = await fs.readFile(this.lockfilePath, 'utf-8')
      const parsed = JSON.parse(content)
      return LockfileSchema.parse(parsed)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      throw new Error(
        `Failed to read lockfile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Write lockfile
   */
  async write(lockfile: Lockfile): Promise<void> {
    try {
      const validated = LockfileSchema.parse(lockfile)
      const content = JSON.stringify(validated, null, 2)
      await fs.writeFile(this.lockfilePath, content, 'utf-8')
    } catch (error) {
      throw new Error(
        `Failed to write lockfile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Generate lockfile from dependency nodes
   */
  async generate(
    projectName: string,
    projectVersion: string,
    nodes: DependencyNode[]
  ): Promise<Lockfile> {
    const dependencies: Record<string, LockedDependency> = {}

    for (const node of nodes) {
      // Skip root node
      if (node.name === projectName) {
        continue
      }

      const deps: Record<string, string> = {}
      for (const child of node.dependencies) {
        deps[child.name] = child.version
      }

      dependencies[node.name] = {
        version: node.version,
        resolved: node.resolved || `https://registry.automatosx.io/${node.name}/-/${node.name}-${node.version}.tgz`,
        integrity: node.integrity || this.generateIntegrity(node.name, node.version),
        dependencies: Object.keys(deps).length > 0 ? deps : undefined,
        optional: node.optional,
      }
    }

    const lockfile: Lockfile = {
      lockfileVersion: 1,
      name: projectName,
      version: projectVersion,
      dependencies,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'automatosx',
        automatosxVersion: '2.0.0', // Would be dynamic
        nodeVersion: process.version,
      },
    }

    return lockfile
  }

  /**
   * Update lockfile with new dependencies
   */
  async update(newNodes: DependencyNode[]): Promise<Lockfile> {
    const existing = await this.read()

    if (!existing) {
      throw new Error('No existing lockfile found. Use generate() instead.')
    }

    // Merge new dependencies
    for (const node of newNodes) {
      const deps: Record<string, string> = {}
      for (const child of node.dependencies) {
        deps[child.name] = child.version
      }

      existing.dependencies[node.name] = {
        version: node.version,
        resolved: node.resolved || existing.dependencies[node.name]?.resolved || '',
        integrity: node.integrity || existing.dependencies[node.name]?.integrity || '',
        dependencies: Object.keys(deps).length > 0 ? deps : undefined,
        optional: node.optional,
      }
    }

    // Update metadata
    if (existing.metadata) {
      existing.metadata.generatedAt = new Date().toISOString()
    }

    return existing
  }

  /**
   * Validate lockfile integrity
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const lockfile = await this.read()

    if (!lockfile) {
      return { valid: false, errors: ['Lockfile not found'] }
    }

    const errors: string[] = []

    // Check lockfile version
    if (lockfile.lockfileVersion !== 1) {
      errors.push(`Unsupported lockfile version: ${lockfile.lockfileVersion}`)
    }

    // Validate each dependency entry
    for (const [name, dep] of Object.entries(lockfile.dependencies)) {
      if (!dep.version) {
        errors.push(`Missing version for ${name}`)
      }
      if (!dep.resolved) {
        errors.push(`Missing resolved URL for ${name}`)
      }
      if (!dep.integrity) {
        errors.push(`Missing integrity hash for ${name}`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Compare lockfile with manifest
   */
  async compare(
    manifestDeps: Record<string, string>
  ): Promise<{ matching: boolean; differences: string[] }> {
    const lockfile = await this.read()

    if (!lockfile) {
      return { matching: false, differences: ['No lockfile exists'] }
    }

    const differences: string[] = []
    const lockfileDeps = Object.keys(lockfile.dependencies)
    const manifestDepNames = Object.keys(manifestDeps)

    // Find missing dependencies
    for (const depName of manifestDepNames) {
      if (!lockfileDeps.includes(depName)) {
        differences.push(`Dependency ${depName} in manifest but not in lockfile`)
      }
    }

    // Find extra dependencies
    for (const depName of lockfileDeps) {
      if (!manifestDepNames.includes(depName)) {
        differences.push(`Dependency ${depName} in lockfile but not in manifest`)
      }
    }

    return { matching: differences.length === 0, differences }
  }

  /**
   * Get flat dependency list from lockfile
   */
  async getFlatDependencies(): Promise<FlatDependencyEntry[]> {
    const lockfile = await this.read()

    if (!lockfile) {
      return []
    }

    return Object.entries(lockfile.dependencies).map(([name, dep]) => ({
      name,
      version: dep.version,
      resolved: dep.resolved,
      integrity: dep.integrity,
      isOptional: dep.optional || false,
    }))
  }

  /**
   * Generate integrity hash (mock)
   */
  private generateIntegrity(name: string, version: string): string {
    // Mock SHA-512 hash - in real impl, would hash the actual package tarball
    const crypto = require('crypto')
    const hash = crypto.createHash('sha512')
    hash.update(`${name}@${version}`)
    return `sha512-${hash.digest('base64')}`
  }
}

/**
 * Create lockfile manager
 */
export function createLockfileManager(projectPath: string): LockfileManager {
  return new LockfileManager(projectPath)
}
