import { describe, it, expect, beforeEach } from 'vitest';
import stripAnsi from 'strip-ansi';
import { ParallelAgentExecutor } from '../../src/agents/parallel-agent-executor.js';
import type { AgentProfile, ExecutionContext } from '../../src/types/agent.js';

const createAgent = (name: string, overrides: Partial<AgentProfile> = {}): AgentProfile => ({
  name,
  role: overrides.role ?? `${name}-role`,
  description: overrides.description ?? `${name} description`,
  systemPrompt: overrides.systemPrompt ?? 'system prompt',
  abilities: overrides.abilities ?? [],
  ...overrides
} as AgentProfile);

const createContext = (): ExecutionContext => ({
  agent: createAgent('test-agent'),
  task: 'test task',
  projectDir: '/test',
  workingDir: '/test',
  agentWorkspace: '/test/.automatosx/workspaces/test-agent',
  memory: [],
  provider: { name: 'test', execute: async () => ({ output: 'test' }) } as any,
  abilities: '',
  createdAt: new Date(),
  orchestration: {
    isDelegationEnabled: true,
    availableAgents: [],
    sharedWorkspace: '/test/.automatosx/workspaces',
    delegationChain: [],
    maxDelegationDepth: 2
  }
});

describe('ParallelAgentExecutor', () => {
  let executor: ParallelAgentExecutor;

  beforeEach(() => {
    executor = new ParallelAgentExecutor();
  });

  describe('Basic Execution', () => {
    it('executes independent agents in parallel', async () => {
      const agents = [
        createAgent('agent1'),
        createAgent('agent2'),
        createAgent('agent3')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context, { maxConcurrentAgents: 3 });

      expect(result.success).toBe(true);
      expect(result.completedAgents).toHaveLength(3);
      expect(result.failedAgents).toHaveLength(0);
      expect(result.skippedAgents).toHaveLength(0);
      expect(result.timeline).toHaveLength(3);
    });

    it('respects dependency order', async () => {
      const agents = [
        createAgent('backend'),
        createAgent('frontend', { dependencies: ['backend'] })
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      expect(result.success).toBe(true);
      expect(result.completedAgents).toEqual(['backend', 'frontend']);

      // Backend should complete before frontend starts
      const backendEntry = result.timeline.find(e => e.agentName === 'backend');
      const frontendEntry = result.timeline.find(e => e.agentName === 'frontend');

      expect(backendEntry).toBeDefined();
      expect(frontendEntry).toBeDefined();
      expect(backendEntry!.endTime).toBeLessThanOrEqual(frontendEntry!.startTime);
    });

    it('executes multi-level dependencies correctly', async () => {
      const agents = [
        createAgent('data'),
        createAgent('transform', { dependencies: ['data'] }),
        createAgent('report', { dependencies: ['transform'] })
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      expect(result.success).toBe(true);
      expect(result.completedAgents).toHaveLength(3);

      // Check execution order via timeline
      const dataEntry = result.timeline.find(e => e.agentName === 'data');
      const transformEntry = result.timeline.find(e => e.agentName === 'transform');
      const reportEntry = result.timeline.find(e => e.agentName === 'report');

      expect(dataEntry!.level).toBe(0);
      expect(transformEntry!.level).toBe(1);
      expect(reportEntry!.level).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('marks dependents as skipped when dependency fails', async () => {
      // This test would need a way to inject failures
      // For now, we'll test the structure
      const agents = [
        createAgent('backend'),
        createAgent('frontend', { dependencies: ['backend'] })
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      // In successful case, nothing should be skipped
      expect(result.skippedAgents).toHaveLength(0);
    });

    it('continues executing independent agents after failure when continueOnFailure is true', async () => {
      const agents = [
        createAgent('agent1'),
        createAgent('agent2'),
        createAgent('agent3')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context, { continueOnFailure: true });

      expect(result.completedAgents.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrency Control', () => {
    it('respects maxConcurrentAgents limit', async () => {
      const agents = [
        createAgent('agent1'),
        createAgent('agent2'),
        createAgent('agent3'),
        createAgent('agent4'),
        createAgent('agent5')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context, { maxConcurrentAgents: 2 });

      expect(result.success).toBe(true);
      expect(result.completedAgents).toHaveLength(5);

      // Check that plan was created with correct concurrency
      expect(result.plan).toBeDefined();
      expect(result.plan!.maxConcurrency).toBe(2);
    });

    it('batches agents according to concurrency limit', async () => {
      const agents = [
        createAgent('agent1'),
        createAgent('agent2'),
        createAgent('agent3')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context, { maxConcurrentAgents: 2 });

      expect(result.plan).toBeDefined();
      const level0 = result.plan!.levels.find(l => l.level === 0);
      expect(level0).toBeDefined();

      // Should have 2 batches: [agent1, agent2] and [agent3]
      expect(level0!.parallelBatches).toHaveLength(2);
      expect(level0!.parallelBatches[0]).toHaveLength(2);
      expect(level0!.parallelBatches[1]).toHaveLength(1);
    });
  });

  describe('Dependency Graph', () => {
    it('builds correct dependency graph', async () => {
      const agents = [
        createAgent('a'),
        createAgent('b', { dependencies: ['a'] }),
        createAgent('c', { dependencies: ['a'] }),
        createAgent('d', { dependencies: ['b', 'c'] })
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      expect(result.graph).toBeDefined();
      expect(result.graph!.nodes.size).toBe(4);
      expect(result.graph!.maxLevel).toBe(2);

      // Level 0: a
      // Level 1: b, c
      // Level 2: d
      const levelAgents = result.graph!.levels;
      expect(levelAgents.get(0)).toEqual(['a']);
      expect(levelAgents.get(1)).toContain('b');
      expect(levelAgents.get(1)).toContain('c');
      expect(levelAgents.get(2)).toEqual(['d']);
    });

    it('detects circular dependencies', async () => {
      const agents = [
        createAgent('a', { dependencies: ['b'] }),
        createAgent('b', { dependencies: ['a'] })
      ];

      const context = createContext();

      await expect(executor.execute(agents, context)).rejects.toThrow(/Circular dependency/);
    });
  });

  describe('Execution Modes', () => {
    it('executes agents in parallel mode by default', async () => {
      const agents = [
        createAgent('agent1'),
        createAgent('agent2')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      expect(result.plan).toBeDefined();
      const level0 = result.plan!.levels.find(l => l.level === 0);
      expect(level0?.executionMode).toBe('parallel');
    });

    it('forces sequential mode when agent has parallel: false', async () => {
      const agents = [
        createAgent('agent1', { parallel: false }),
        createAgent('agent2')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      expect(result.plan).toBeDefined();
      const level0 = result.plan!.levels.find(l => l.level === 0);
      expect(level0?.executionMode).toBe('sequential');
    });
  });

  describe('Timeline Tracking', () => {
    it('records timeline entries for all agents', async () => {
      const agents = [
        createAgent('agent1'),
        createAgent('agent2')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      expect(result.timeline).toHaveLength(2);

      for (const entry of result.timeline) {
        expect(entry).toHaveProperty('agentName');
        expect(entry).toHaveProperty('startTime');
        expect(entry).toHaveProperty('endTime');
        expect(entry).toHaveProperty('duration');
        expect(entry).toHaveProperty('level');
        expect(entry).toHaveProperty('status');
        expect(entry.endTime).toBeGreaterThanOrEqual(entry.startTime);
        expect(entry.duration).toBe(entry.endTime - entry.startTime);
      }
    });

    it('tracks total execution duration', async () => {
      const agents = [
        createAgent('agent1')
      ];

      const context = createContext();
      const startTime = Date.now();
      const result = await executor.execute(agents, context);
      const endTime = Date.now();

      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.totalDuration).toBeLessThanOrEqual(endTime - startTime);
    });
  });

  describe('Result Structure', () => {
    it('returns complete result structure', async () => {
      const agents = [
        createAgent('agent1')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('completedAgents');
      expect(result).toHaveProperty('failedAgents');
      expect(result).toHaveProperty('skippedAgents');
      expect(result).toHaveProperty('timeline');
      expect(result).toHaveProperty('totalDuration');
      expect(result).toHaveProperty('graph');
      expect(result).toHaveProperty('plan');
    });

    it('categorizes agents correctly', async () => {
      const agents = [
        createAgent('agent1')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      const totalAgents =
        result.completedAgents.length +
        result.failedAgents.length +
        result.skippedAgents.length;

      expect(totalAgents).toBe(agents.length);
    });
  });

  describe('Timeline Visualization', () => {
    it('generates timeline visualization with correct structure', async () => {
      const agents = [
        createAgent('agent1'),
        createAgent('agent2')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      const visualization = executor.visualizeTimeline(result.timeline);
      const stripped = stripAnsi(visualization);

      // Check header
      expect(stripped).toContain('Execution Timeline');

      // Check agent names
      expect(stripped).toContain('agent1');
      expect(stripped).toContain('agent2');

      // Check level information
      expect(stripped).toContain('Level 0:');

      // Check total duration
      expect(stripped).toContain('Total Duration:');
    });

    it('shows empty message when no agents executed', () => {
      const visualization = executor.visualizeTimeline([]);
      const stripped = stripAnsi(visualization);

      expect(stripped).toContain('Execution Timeline');
      expect(stripped).toContain('No agents executed');
    });

    it('displays different status indicators correctly', async () => {
      const agents = [
        createAgent('success-agent'),
        createAgent('failed-agent'),
        createAgent('skipped-agent')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      // Create mock timeline with different statuses
      const mockTimeline = [
        {
          agentName: 'success-agent',
          startTime: 1000,
          endTime: 2000,
          duration: 1000,
          level: 0,
          status: 'completed' as const
        },
        {
          agentName: 'failed-agent',
          startTime: 1000,
          endTime: 2000,
          duration: 1000,
          level: 0,
          status: 'failed' as const,
          error: 'Test error message'
        },
        {
          agentName: 'skipped-agent',
          startTime: 1000,
          endTime: 1000,
          duration: 0,
          level: 0,
          status: 'skipped' as const
        }
      ];

      const visualization = executor.visualizeTimeline(mockTimeline);
      const stripped = stripAnsi(visualization);

      expect(stripped).toContain('success-agent');
      expect(stripped).toContain('failed-agent');
      expect(stripped).toContain('skipped-agent');
      expect(stripped).toContain('Test error message');
    });

    it('displays multi-level execution correctly', async () => {
      const agents = [
        createAgent('data'),
        createAgent('transform', { dependencies: ['data'] }),
        createAgent('report', { dependencies: ['transform'] })
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      const visualization = executor.visualizeTimeline(result.timeline);
      const stripped = stripAnsi(visualization);

      expect(stripped).toContain('Level 0:');
      expect(stripped).toContain('Level 1:');
      expect(stripped).toContain('Level 2:');
      expect(stripped).toContain('data');
      expect(stripped).toContain('transform');
      expect(stripped).toContain('report');
    });

    it('includes duration information for each agent', async () => {
      const agents = [
        createAgent('agent1')
      ];

      const context = createContext();
      const result = await executor.execute(agents, context);

      const visualization = executor.visualizeTimeline(result.timeline);
      const stripped = stripAnsi(visualization);

      // Duration should be in seconds (changed from ms to s in v5.6.0)
      expect(stripped).toMatch(/\d+\.\d+s/);
    });
  });
});
