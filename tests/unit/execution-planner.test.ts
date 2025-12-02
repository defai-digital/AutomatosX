import { describe, it, expect } from 'vitest';
import type { AgentProfile } from '../../src/types/agent.js';
import { DependencyGraphBuilder } from '../../src/agents/dependency-graph.js';
import { ExecutionPlanner } from '../../src/agents/execution-planner.js';

const createAgent = (name: string, overrides: Partial<AgentProfile> = {}): AgentProfile => ({
  name,
  role: overrides.role ?? `${name}-role`,
  description: overrides.description ?? `${name} description`,
  systemPrompt: overrides.systemPrompt ?? 'system prompt',
  abilities: overrides.abilities ?? [],
  ...overrides
} as AgentProfile);

describe('ExecutionPlanner', () => {
  it('groups agents by level respecting max concurrency', () => {
    const builder = new DependencyGraphBuilder();
    const agents = [
      createAgent('alpha'),
      createAgent('beta'),
      createAgent('gamma')
    ];

    const graph = builder.buildGraph(agents);
    const planner = new ExecutionPlanner();
    const plan = planner.createExecutionPlan(graph, { maxConcurrentAgents: 2 });
    const level0 = plan.levels.find(level => level.level === 0);

    expect(plan.maxConcurrency).toBe(2);
    expect(level0?.agents).toEqual(['alpha', 'beta', 'gamma']);
    expect(level0?.parallelBatches).toEqual([['alpha', 'beta'], ['gamma']]);
    expect(level0?.executionMode).toBe('parallel');
  });

  it('forces sequential execution when a level includes non-parallel agent', () => {
    const builder = new DependencyGraphBuilder();
    const agents = [
      createAgent('alpha', { parallel: false }),
      createAgent('beta'),
      createAgent('gamma', { dependencies: ['alpha'] })
    ];

    const graph = builder.buildGraph(agents);
    const planner = new ExecutionPlanner();
    const plan = planner.createExecutionPlan(graph, { maxConcurrentAgents: 3 });
    const level0 = plan.levels.find(level => level.level === 0);
    const level1 = plan.levels.find(level => level.level === 1);

    expect(level0?.executionMode).toBe('sequential');
    expect(level0?.parallelBatches).toEqual([['alpha'], ['beta']]);
    expect(level1?.parallelBatches).toEqual([['gamma']]);
  });

  it('falls back to single concurrency when an invalid limit is provided', () => {
    const builder = new DependencyGraphBuilder();
    const agents = [
      createAgent('alpha'),
      createAgent('beta'),
      createAgent('gamma')
    ];

    const graph = builder.buildGraph(agents);
    const planner = new ExecutionPlanner();
    const plan = planner.createExecutionPlan(graph, { maxConcurrentAgents: 0 as any });
    const level0 = plan.levels.find(level => level.level === 0);

    expect(plan.maxConcurrency).toBe(1);
    expect(level0?.parallelBatches).toEqual([['alpha'], ['beta'], ['gamma']]);
  });
});
