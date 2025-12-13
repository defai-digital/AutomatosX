/**
 * DAG Generator
 *
 * Generates DAG JSON from YAML specs with change detection via hashing.
 *
 * @module core/spec/DagGenerator
 */

import { createHash } from 'crypto';
import type { SpecYAML } from '@/types/spec-yaml.js';
import type {
  DagJson,
  DagNode,
  DagEdge,
  DagValidationResult
} from '@/types/dag.js';
import { logger } from '@/shared/logging/logger.js';

/**
 * DAG generator for YAML specs
 */
export class DagGenerator {
  /**
   * Generate DAG JSON from spec
   *
   * @param spec - Parsed YAML spec
   * @param specContent - Raw spec content for hashing
   * @param sourceFile - Source file path (optional)
   * @returns Generated DAG JSON
   */
  generate(spec: SpecYAML, specContent: string, sourceFile?: string): DagJson {
    // FIXED (v6.0.1): Validate spec.actors exists before processing
    if (!spec.actors || spec.actors.length === 0) {
      throw new Error('Spec must have at least one actor');
    }

    // FIXED (Bug #18): Validate spec.metadata exists and has required fields
    if (!spec.metadata || typeof spec.metadata !== 'object') {
      throw new Error('Spec must have metadata object');
    }
    if (!spec.metadata.id || typeof spec.metadata.id !== 'string') {
      throw new Error('Spec metadata must have id field (string)');
    }
    if (!spec.metadata.name || typeof spec.metadata.name !== 'string') {
      throw new Error('Spec metadata must have name field (string)');
    }

    // FIXED (Bug #19): Validate specContent is a non-empty string
    if (typeof specContent !== 'string') {
      throw new Error(`specContent must be a string, got ${typeof specContent}`);
    }
    if (specContent.trim().length === 0) {
      throw new Error('specContent cannot be empty or whitespace-only');
    }

    const hash = this.calculateHash(specContent);
    const nodes = this.buildNodes(spec);
    const edges = this.buildEdges(nodes);

    const dag: DagJson = {
      version: '1.0',
      specHash: hash,
      metadata: {
        id: spec.metadata.id,
        name: spec.metadata.name,
        generated: new Date().toISOString(),
        sourceFile
      },
      nodes,
      edges
    };

    // Include policy if present
    if (spec.policy) {
      dag.policy = {
        goal: spec.policy.goal,
        optimization: spec.policy.optimization,
        constraints: spec.policy.constraints
      };
    }

    // Include execution config if present
    if (spec.recovery) {
      dag.execution = {
        parallel: true,  // Enable by default
        maxConcurrency: spec.actors.length,
        timeoutMs: spec.recovery.timeout?.task
      };
    }

    logger.debug('DAG generated', {
      specId: spec.metadata.id,
      nodes: nodes.length,
      edges: edges.length,
      hash: hash.substring(0, 8)
    });

    return dag;
  }

  /**
   * Calculate SHA-256 hash of spec content
   */
  calculateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Build DAG nodes from spec actors
   */
  private buildNodes(spec: SpecYAML): DagNode[] {
    return spec.actors.map((actor, index) => {
      // FIXED (Bug #20): Validate actor properties before accessing
      if (!actor.id || typeof actor.id !== 'string') {
        throw new Error(`Actor at index ${index} must have id field (string)`);
      }
      if (!actor.agent || typeof actor.agent !== 'string') {
        throw new Error(`Actor "${actor.id}" must have agent field (string)`);
      }

      const node: DagNode = {
        id: actor.id,
        actor: actor.agent,
        task: actor.description || `Execute ${actor.id}`,
        dependencies: [],  // Would come from explicit dependencies in extended format
        metadata: {}
      };

      // FIXED (Bug #21): Validate timeout is a positive number
      if (actor.timeout !== undefined) {
        if (typeof actor.timeout !== 'number' || !Number.isFinite(actor.timeout) || actor.timeout <= 0) {
          throw new Error(`Actor "${actor.id}" timeout must be a positive finite number, got ${typeof actor.timeout === 'number' ? actor.timeout : typeof actor.timeout}`);
        }
        node.metadata.timeout = actor.timeout;
      }

      // FIXED (Bug #22): Validate maxAttempts is a positive integer
      if (spec.recovery?.retry?.maxAttempts !== undefined) {
        const maxAttempts = spec.recovery.retry.maxAttempts;
        if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
          throw new Error(`spec.recovery.retry.maxAttempts must be a positive integer, got ${typeof maxAttempts === 'number' ? maxAttempts : typeof maxAttempts}`);
        }
        node.metadata.retries = maxAttempts;
      }

      // Add resources if specified
      if (actor.resources) {
        node.metadata.resources = {
          memory: actor.resources.memory?.limit,
          cpu: actor.resources.cpu?.limit
        };
      }

      // Add permissions if specified
      if (actor.permissions) {
        node.metadata.permissions = {
          filesystem: actor.permissions.filesystem,
          network: {
            enabled: actor.permissions.network?.enabled,
            whitelist: actor.permissions.network?.whitelist
          }
        };
      }

      return node;
    });
  }

  /**
   * Build edges from node dependencies
   */
  private buildEdges(nodes: DagNode[]): DagEdge[] {
    const edges: DagEdge[] = [];

    for (const node of nodes) {
      for (const dep of node.dependencies) {
        edges.push({
          from: dep,
          to: node.id,
          type: 'control'  // Control dependency by default
        });
      }
    }

    return edges;
  }

  /**
   * Validate DAG structure
   *
   * Checks for:
   * - Cycles (must be acyclic)
   * - Missing dependencies
   * - Unreachable nodes
   */
  validate(dag: DagJson): DagValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Build adjacency list for validation
    const graph = new Map<string, string[]>();
    for (const node of dag.nodes) {
      graph.set(node.id, node.dependencies);
    }

    // Check for missing dependencies
    for (const node of dag.nodes) {
      for (const dep of node.dependencies) {
        if (!graph.has(dep)) {
          errors.push(`Node "${node.id}" depends on missing node "${dep}"`);
        }
      }
    }

    // Check for cycles using DFS
    // FIXED (v6.0.1): Check ALL nodes, not just unvisited (to catch disconnected cycles)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cyclesFound = new Set<string>();  // Track nodes involved in cycles

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const deps = graph.get(nodeId) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) {
            cyclesFound.add(nodeId);  // Mark this node as part of cycle
            return true;
          }
        } else if (recursionStack.has(dep)) {
          cyclesFound.add(nodeId);  // Mark this node as part of cycle
          cyclesFound.add(dep);     // Mark dependency as part of cycle
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check ALL nodes for cycles (catches disconnected graph components)
    for (const node of dag.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          // Don't add error here - we'll report all cycle nodes below
        }
      }
    }

    // Report all nodes involved in cycles
    if (cyclesFound.size > 0) {
      errors.push(`Cycle detected involving nodes: ${Array.from(cyclesFound).join(', ')}`);
    }

    // Check for unreachable nodes (warnings only)
    const reachable = new Set<string>();
    const findReachable = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      reachable.add(nodeId);

      for (const edge of dag.edges) {
        if (edge.from === nodeId) {
          findReachable(edge.to);
        }
      }
    };

    // Find root nodes (no incoming edges)
    const incomingEdges = new Set<string>();
    for (const edge of dag.edges) {
      incomingEdges.add(edge.to);
    }

    const rootNodes = dag.nodes.filter(n => !incomingEdges.has(n.id));
    for (const root of rootNodes) {
      findReachable(root.id);
    }

    for (const node of dag.nodes) {
      if (!reachable.has(node.id) && node.dependencies.length > 0) {
        warnings.push(`Node "${node.id}" may be unreachable`);
      }
    }

    // Calculate statistics
    const stats = {
      nodeCount: dag.nodes.length,
      edgeCount: dag.edges.length,
      maxDepth: this.calculateMaxDepth(dag),
      parallelizableNodes: this.countParallelizableNodes(dag)
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats
    };
  }

  /**
   * Calculate maximum depth of DAG (longest path)
   * BUG FIX: Added cycle detection with visiting set to prevent infinite recursion
   */
  private calculateMaxDepth(dag: DagJson): number {
    const depths = new Map<string, number>();
    const visiting = new Set<string>(); // Track nodes being visited to detect cycles

    const calculateDepth = (nodeId: string): number => {
      if (depths.has(nodeId)) {
        return depths.get(nodeId)!;
      }

      // BUG FIX: Detect cycle - if we're already visiting this node, we have a cycle
      // Return 0 to break the recursion (cycle was already detected in validate())
      if (visiting.has(nodeId)) {
        return 0;
      }

      visiting.add(nodeId);

      const node = dag.nodes.find(n => n.id === nodeId);
      if (!node || !node.dependencies || node.dependencies.length === 0) {
        depths.set(nodeId, 1);
        visiting.delete(nodeId);
        return 1;
      }

      // FIXED: Add 0 as fallback to handle empty arrays safely
      const depthValues = node.dependencies.map(dep => calculateDepth(dep));
      const maxDepDep = depthValues.length > 0 ? Math.max(...depthValues) : 0;
      const depth = maxDepDep + 1;
      depths.set(nodeId, depth);
      visiting.delete(nodeId);
      return depth;
    };

    let maxDepth = 0;
    for (const node of dag.nodes) {
      maxDepth = Math.max(maxDepth, calculateDepth(node.id));
    }

    return maxDepth;
  }

  /**
   * Count nodes that can be executed in parallel
   * BUG FIX: Added cycle detection with visiting set to prevent infinite recursion
   */
  private countParallelizableNodes(dag: DagJson): number {
    // Group nodes by depth level
    const depthLevels = new Map<number, string[]>();

    const depths = new Map<string, number>();
    const visiting = new Set<string>(); // Track nodes being visited to detect cycles

    const calculateDepth = (nodeId: string): number => {
      if (depths.has(nodeId)) return depths.get(nodeId)!;

      // BUG FIX: Detect cycle - if we're already visiting this node, we have a cycle
      // Return 0 to break the recursion (cycle was already detected in validate())
      if (visiting.has(nodeId)) {
        return 0;
      }

      visiting.add(nodeId);

      const node = dag.nodes.find(n => n.id === nodeId);
      if (!node || !node.dependencies || node.dependencies.length === 0) {
        depths.set(nodeId, 0);
        visiting.delete(nodeId);
        return 0;
      }

      // FIXED: Add -1 as fallback to handle empty arrays safely
      const depthValues = node.dependencies.map(dep => calculateDepth(dep));
      const maxDepDep = depthValues.length > 0 ? Math.max(...depthValues) : -1;
      const depth = maxDepDep + 1;
      depths.set(nodeId, depth);
      visiting.delete(nodeId);
      return depth;
    };

    for (const node of dag.nodes) {
      const depth = calculateDepth(node.id);
      if (!depthLevels.has(depth)) {
        depthLevels.set(depth, []);
      }
      depthLevels.get(depth)!.push(node.id);
    }

    // Count nodes in levels with multiple nodes (can run in parallel)
    let parallelizable = 0;
    for (const [_, nodes] of depthLevels) {
      if (nodes.length > 1) {
        parallelizable += nodes.length;
      }
    }

    return parallelizable;
  }

  /**
   * Export DAG as JSON string
   */
  exportJson(dag: DagJson, pretty = true): string {
    return JSON.stringify(dag, null, pretty ? 2 : 0);
  }

  /**
   * Export DAG as Mermaid diagram
   */
  exportMermaid(dag: DagJson): string {
    const lines: string[] = [
      'graph TD',
      ''
    ];

    // Add nodes
    for (const node of dag.nodes) {
      const label = `${node.id}\\n[${node.actor}]`;
      lines.push(`  ${node.id}["${label}"]`);
    }

    lines.push('');

    // Add edges
    for (const edge of dag.edges) {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }

    return lines.join('\n');
  }

  /**
   * Export DAG as DOT format (Graphviz)
   */
  exportDot(dag: DagJson): string {
    const lines: string[] = [
      `digraph "${dag.metadata.id}" {`,
      '  rankdir=TB;',
      '  node [shape=box, style=rounded];',
      ''
    ];

    // Add nodes
    for (const node of dag.nodes) {
      const label = `${node.id}\\n(${node.actor})`;
      lines.push(`  "${node.id}" [label="${label}"];`);
    }

    lines.push('');

    // Add edges
    for (const edge of dag.edges) {
      lines.push(`  "${edge.from}" -> "${edge.to}";`);
    }

    lines.push('}');

    return lines.join('\n');
  }
}

/**
 * Default singleton instance
 */
let defaultDagGenerator: DagGenerator | null = null;

/**
 * Get default DAG generator instance (singleton)
 */
export function getDefaultDagGenerator(): DagGenerator {
  if (!defaultDagGenerator) {
    defaultDagGenerator = new DagGenerator();
  }
  return defaultDagGenerator;
}

/**
 * Convenience function: generate DAG from spec
 */
export function generateDag(spec: SpecYAML, specContent: string, sourceFile?: string): DagJson {
  return getDefaultDagGenerator().generate(spec, specContent, sourceFile);
}

/**
 * Convenience function: validate DAG
 */
export function validateDag(dag: DagJson): DagValidationResult {
  return getDefaultDagGenerator().validate(dag);
}
