/**
 * Dependency Resolver
 * Sprint 4 Day 31: DAG resolver with cycle detection and topological sort
 */

import type { PluginManifest, DependencySpec } from './types/PluginManifest.js'
import type { DependencyNode, FlatDependencyEntry } from './types/Lockfile.js'
import * as semver from 'semver'

/**
 * Dependency resolution result
 */
export interface ResolutionResult {
  resolved: DependencyNode[]
  errors: ResolutionError[]
  warnings: ResolutionWarning[]
}

/**
 * Resolution error
 */
export interface ResolutionError {
  type: 'CYCLE' | 'VERSION_CONFLICT' | 'NOT_FOUND' | 'INVALID_VERSION'
  message: string
  path?: string[]
  dependency?: string
}

/**
 * Resolution warning
 */
export interface ResolutionWarning {
  type: 'OPTIONAL_MISSING' | 'PEER_UNMET'
  message: string
  dependency?: string
}

/**
 * Dependency Resolver
 */
export class DependencyResolver {
  private visited = new Set<string>()
  private stack = new Set<string>()
  private resolved = new Map<string, DependencyNode>()

  /**
   * Resolve dependencies from manifest
   */
  async resolve(manifest: PluginManifest): Promise<ResolutionResult> {
    const errors: ResolutionError[] = []
    const warnings: ResolutionWarning[] = []
    const resolved: DependencyNode[] = []

    this.visited.clear()
    this.stack.clear()
    this.resolved.clear()

    try {
      // Build dependency graph
      const rootNode = await this.buildDependencyGraph(
        manifest.name,
        manifest.version,
        manifest.dependencies,
        0,
        []
      )

      // Detect cycles
      const cycles = this.detectCycles(rootNode)
      if (cycles.length > 0) {
        cycles.forEach((cycle) => {
          errors.push({
            type: 'CYCLE',
            message: `Circular dependency detected: ${cycle.join(' → ')}`,
            path: cycle,
          })
        })
        return { resolved: [], errors, warnings }
      }

      // Topological sort
      const sorted = this.topologicalSort(rootNode)
      resolved.push(...sorted)

      // Check for version conflicts
      const conflicts = this.detectVersionConflicts(sorted)
      errors.push(...conflicts)

      // Check optional dependencies
      const optionalWarnings = await this.checkOptionalDependencies(manifest)
      warnings.push(...optionalWarnings)

      return { resolved, errors, warnings }
    } catch (error) {
      errors.push({
        type: 'NOT_FOUND',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
      return { resolved: [], errors, warnings }
    }
  }

  /**
   * Build dependency graph recursively
   */
  private async buildDependencyGraph(
    name: string,
    version: string,
    dependencies: Record<string, string>,
    depth: number,
    path: string[]
  ): Promise<DependencyNode> {
    const nodeKey = `${name}@${version}`

    // Check if already resolved
    if (this.resolved.has(nodeKey)) {
      return this.resolved.get(nodeKey)!
    }

    const node: DependencyNode = {
      name,
      version,
      dependencies: [],
      depth,
      optional: false,
    }

    this.resolved.set(nodeKey, node)

    // Resolve child dependencies
    for (const [depName, depVersionRange] of Object.entries(dependencies)) {
      // For now, we'll resolve to exact version (in real impl, fetch from registry)
      const resolvedVersion = this.resolveVersion(depVersionRange)

      // Mock: In real implementation, fetch manifest from registry
      const childDeps = {} // Would be fetched from registry

      const childNode = await this.buildDependencyGraph(
        depName,
        resolvedVersion,
        childDeps,
        depth + 1,
        [...path, name]
      )

      node.dependencies.push(childNode)
    }

    return node
  }

  /**
   * Detect cycles in dependency graph
   */
  private detectCycles(root: DependencyNode): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []

    const dfs = (node: DependencyNode) => {
      const nodeKey = `${node.name}@${node.version}`

      if (recursionStack.has(nodeKey)) {
        // Cycle detected - extract cycle path
        const cycleStart = path.indexOf(node.name)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node.name])
        }
        return
      }

      if (visited.has(nodeKey)) {
        return
      }

      visited.add(nodeKey)
      recursionStack.add(nodeKey)
      path.push(node.name)

      for (const dep of node.dependencies) {
        dfs(dep)
      }

      path.pop()
      recursionStack.delete(nodeKey)
    }

    dfs(root)
    return cycles
  }

  /**
   * Topological sort of dependency graph
   */
  private topologicalSort(root: DependencyNode): DependencyNode[] {
    const sorted: DependencyNode[] = []
    const visited = new Set<string>()

    const visit = (node: DependencyNode) => {
      const nodeKey = `${node.name}@${node.version}`

      if (visited.has(nodeKey)) {
        return
      }

      visited.add(nodeKey)

      // Visit dependencies first (post-order traversal)
      for (const dep of node.dependencies) {
        visit(dep)
      }

      sorted.push(node)
    }

    visit(root)
    return sorted
  }

  /**
   * Detect version conflicts
   */
  private detectVersionConflicts(nodes: DependencyNode[]): ResolutionError[] {
    const errors: ResolutionError[] = []
    const versions = new Map<string, Set<string>>()

    // Collect all versions per package
    for (const node of nodes) {
      if (!versions.has(node.name)) {
        versions.set(node.name, new Set())
      }
      versions.get(node.name)!.add(node.version)
    }

    // Check for conflicts
    for (const [name, versionSet] of versions.entries()) {
      if (versionSet.size > 1) {
        errors.push({
          type: 'VERSION_CONFLICT',
          message: `Multiple versions of ${name} required: ${Array.from(versionSet).join(', ')}`,
          dependency: name,
        })
      }
    }

    return errors
  }

  /**
   * Check optional dependencies
   */
  private async checkOptionalDependencies(
    manifest: PluginManifest
  ): Promise<ResolutionWarning[]> {
    const warnings: ResolutionWarning[] = []

    for (const [name, version] of Object.entries(
      manifest.optionalDependencies
    )) {
      try {
        // Mock: In real impl, check if package exists
        const exists = true
        if (!exists) {
          warnings.push({
            type: 'OPTIONAL_MISSING',
            message: `Optional dependency ${name}@${version} not found`,
            dependency: name,
          })
        }
      } catch (error) {
        warnings.push({
          type: 'OPTIONAL_MISSING',
          message: `Failed to resolve optional dependency ${name}`,
          dependency: name,
        })
      }
    }

    return warnings
  }

  /**
   * Resolve version from range
   */
  private resolveVersion(versionRange: string): string {
    // For now, extract version from range (simplified)
    // In real impl, query registry for matching version
    const match = versionRange.match(/[\d.]+/)
    return match ? match[0] : '1.0.0'
  }

  /**
   * Flatten dependency tree to list
   */
  flattenDependencies(nodes: DependencyNode[]): FlatDependencyEntry[] {
    const flat: FlatDependencyEntry[] = []
    const seen = new Set<string>()

    for (const node of nodes) {
      const key = `${node.name}@${node.version}`
      if (!seen.has(key)) {
        seen.add(key)
        flat.push({
          name: node.name,
          version: node.version,
          resolved: node.resolved || '',
          integrity: node.integrity || '',
          isOptional: node.optional,
        })
      }
    }

    return flat
  }
}

/**
 * Create dependency resolver
 */
export function createDependencyResolver(): DependencyResolver {
  return new DependencyResolver()
}
