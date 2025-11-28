/**
 * DAG Scheduling Algorithm Tests
 *
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { describe, it, expect } from 'vitest';
import {
  type DagNode,
  hasCycle,
  findCriticalPath,
  scheduleParallel,
  getExecutionOrder,
  validateDag,
} from './dag.js';

// Test nodes - matches actual DagNode interface
const createNode = (id: string, deps: string[] = [], duration = 1000, priority = 5): DagNode => ({
  id,
  deps,
  estimatedDuration: duration,
  priority,
});

describe('hasCycle', () => {
  it('should return false for acyclic graph', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['A']),
      createNode('D', ['B', 'C']),
    ];

    expect(hasCycle(nodes)).toBe(false);
  });

  it('should return true for cyclic graph', () => {
    const nodes: DagNode[] = [
      createNode('A', ['C']),
      createNode('B', ['A']),
      createNode('C', ['B']),
    ];

    expect(hasCycle(nodes)).toBe(true);
  });

  it('should return true for self-referencing node', () => {
    const nodes: DagNode[] = [
      createNode('A', ['A']),
    ];

    expect(hasCycle(nodes)).toBe(true);
  });

  it('should return false for single node without dependencies', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
    ];

    expect(hasCycle(nodes)).toBe(false);
  });

  it('should return false for empty graph', () => {
    expect(hasCycle([])).toBe(false);
  });

  it('should handle complex acyclic graph', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['A']),
      createNode('D', ['B']),
      createNode('E', ['B', 'C']),
      createNode('F', ['D', 'E']),
    ];

    expect(hasCycle(nodes)).toBe(false);
  });
});

describe('findCriticalPath', () => {
  it('should find critical path in simple graph', () => {
    const nodes: DagNode[] = [
      createNode('A', [], 100),
      createNode('B', ['A'], 200),
      createNode('C', ['A'], 50),
      createNode('D', ['B', 'C'], 100),
    ];

    const path = findCriticalPath(nodes);

    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toBe('D');
  });

  it('should return single node for graph with one node', () => {
    const nodes: DagNode[] = [
      createNode('A', [], 100),
    ];

    const path = findCriticalPath(nodes);

    expect(path).toEqual(['A']);
  });

  it('should return empty for empty graph', () => {
    const path = findCriticalPath([]);

    expect(path).toEqual([]);
  });

  it('should find longest duration path', () => {
    const nodes: DagNode[] = [
      createNode('A', [], 100),
      createNode('B', ['A'], 500), // Long path
      createNode('C', ['A'], 50),  // Short path
    ];

    const path = findCriticalPath(nodes);

    expect(path).toContain('B');
  });
});

describe('scheduleParallel', () => {
  it('should schedule independent nodes in parallel', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', []),
      createNode('C', []),
    ];

    const result = scheduleParallel(nodes);

    expect(result.groups.length).toBe(1);
    expect(result.groups[0]!.nodes).toHaveLength(3);
    expect(result.groups[0]!.parallelizable).toBe(true);
  });

  it('should schedule dependent nodes sequentially', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['B']),
    ];

    const result = scheduleParallel(nodes);

    expect(result.groups.length).toBe(3);
    expect(result.groups[0]!.nodes).toContain('A');
    expect(result.groups[1]!.nodes).toContain('B');
    expect(result.groups[2]!.nodes).toContain('C');
  });

  it('should handle mixed dependencies', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', []),
      createNode('C', ['A']),
      createNode('D', ['B']),
      createNode('E', ['C', 'D']),
    ];

    const result = scheduleParallel(nodes);

    // First group: A, B (no dependencies)
    expect(result.groups[0]!.nodes).toContain('A');
    expect(result.groups[0]!.nodes).toContain('B');

    // E should be in the last group
    const lastGroup = result.groups[result.groups.length - 1]!;
    expect(lastGroup.nodes).toContain('E');
  });

  it('should calculate total duration', () => {
    const nodes: DagNode[] = [
      createNode('A', [], 100),
      createNode('B', ['A'], 200),
    ];

    const result = scheduleParallel(nodes);

    expect(result.totalEstimatedDuration).toBeGreaterThanOrEqual(300);
  });

  it('should return error for cyclic graph', () => {
    const nodes: DagNode[] = [
      createNode('A', ['B']),
      createNode('B', ['A']),
    ];

    const result = scheduleParallel(nodes);

    expect(result.error).toBeDefined();
    expect(result.groups).toEqual([]);
  });

  it('should handle empty graph', () => {
    const result = scheduleParallel([]);

    expect(result.groups).toEqual([]);
    expect(result.totalEstimatedDuration).toBe(0);
  });
});

describe('getExecutionOrder', () => {
  it('should return topological order', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['A']),
      createNode('D', ['B', 'C']),
    ];

    const result = scheduleParallel(nodes);
    const order = getExecutionOrder(result);

    // A must come before B and C
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));

    // B and C must come before D
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
  });

  it('should return all nodes', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['B']),
    ];

    const result = scheduleParallel(nodes);
    const order = getExecutionOrder(result);

    expect(order).toHaveLength(3);
    expect(order).toContain('A');
    expect(order).toContain('B');
    expect(order).toContain('C');
  });

  it('should handle empty graph', () => {
    const result = scheduleParallel([]);
    const order = getExecutionOrder(result);

    expect(order).toEqual([]);
  });

  it('should handle single node', () => {
    const nodes: DagNode[] = [createNode('A', [])];

    const result = scheduleParallel(nodes);
    const order = getExecutionOrder(result);

    expect(order).toEqual(['A']);
  });
});

describe('validateDag', () => {
  it('should return valid for acyclic graph', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('B', ['A']),
      createNode('C', ['B']),
    ];

    const result = validateDag(nodes);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return invalid for cyclic graph', () => {
    const nodes: DagNode[] = [
      createNode('A', ['C']),
      createNode('B', ['A']),
      createNode('C', ['B']),
    ];

    const result = validateDag(nodes);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('should return invalid for missing dependencies', () => {
    const nodes: DagNode[] = [
      createNode('A', ['Z']), // Z doesn't exist
    ];

    const result = validateDag(nodes);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Z'))).toBe(true);
  });

  it('should return invalid for duplicate node IDs', () => {
    const nodes: DagNode[] = [
      createNode('A', []),
      createNode('A', []), // Duplicate
    ];

    const result = validateDag(nodes);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('duplicate'))).toBe(true);
  });

  it('should return valid for empty graph', () => {
    const result = validateDag([]);

    expect(result.valid).toBe(true);
  });
});
