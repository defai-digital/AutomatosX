import { describe, it, expect } from 'vitest';
import stripAnsi from 'strip-ansi';
import { DependencyGraphBuilder } from '../../src/agents/dependency-graph.js';
import type { AgentProfile } from '../../src/types/agent.js';

const createAgent = (name: string, overrides: Partial<AgentProfile> = {}): AgentProfile => ({
  name,
  role: overrides.role ?? `${name}-role`,
  description: overrides.description ?? `${name} description`,
  systemPrompt: overrides.systemPrompt ?? 'system prompt',
  abilities: overrides.abilities ?? [],
  ...overrides
} as AgentProfile);

describe('DependencyGraphBuilder', () => {
  it('builds dependency graph and adjacency list', () => {
    const builder = new DependencyGraphBuilder();
    const agents = [
      createAgent('backend'),
      createAgent('frontend', { dependencies: ['backend'] })
    ];

    const graph = builder.buildGraph(agents);

    expect(graph.nodes.size).toBe(2);
    expect(graph.levels.get(0)).toEqual(['backend']);
    expect(graph.levels.get(1)).toEqual(['frontend']);
    expect(graph.adjacencyList.get('backend')).toEqual(['frontend']);
    expect(graph.nodes.get('frontend')?.dependencies).toEqual(['backend']);
  });

  it('calculates multi-level dependencies', () => {
    const builder = new DependencyGraphBuilder();
    const agents = [
      createAgent('ingest'),
      createAgent('transform', { dependencies: ['ingest'] }),
      createAgent('enrich', { dependencies: ['ingest'] }),
      createAgent('report', { dependencies: ['transform', 'enrich'] })
    ];

    const graph = builder.buildGraph(agents);

    expect(graph.nodes.get('transform')?.level).toBe(1);
    expect(graph.nodes.get('enrich')?.level).toBe(1);
    expect(graph.nodes.get('report')?.level).toBe(2);
    expect(graph.maxLevel).toBe(2);
  });

  it('detects circular dependencies', () => {
    const builder = new DependencyGraphBuilder();
    const graph = builder.buildGraph([
      createAgent('alpha', { dependencies: ['beta'] }),
      createAgent('beta', { dependencies: ['alpha'] })
    ]);

    expect(() => builder.detectCycles(graph)).toThrowError(/Circular dependency detected/);
  });

  it('visualizes dependency graph', () => {
    const builder = new DependencyGraphBuilder();
    const graph = builder.buildGraph([
      createAgent('backend'),
      createAgent('frontend', { dependencies: ['backend'], parallel: false })
    ]);

    const output = builder.visualizeDependencyGraph(graph);
    const normalized = stripAnsi(output);

    expect(normalized).toContain('Level 0:');
    expect(normalized).toContain('backend');
    expect(normalized).toContain('Level 1:');
    expect(normalized).toContain('[sequential]');
    expect(normalized).toContain('depends on: backend');
  });
});
