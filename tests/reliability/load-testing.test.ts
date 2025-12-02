/**
 * Load Testing for Parallel Agent Execution
 *
 * Tests system behavior under increasing load (10, 20, 50 agents).
 * Validates maxConcurrentAgents limit and graceful degradation.
 *
 * FIXED: Now uses actual ParallelAgentExecutor instead of custom implementation
 */

import { describe, it, expect, vi } from 'vitest';
import { ParallelAgentExecutor } from '../../src/agents/parallel-agent-executor';
import type { AgentProfile, ExecutionContext } from '../../src/types/agent';
import type { Provider, ExecutionRequest, ExecutionResponse } from '../../src/types/provider';
import type { TimelineEntry } from '../../src/agents/parallel-agent-executor';

// Helper to create mock provider with realistic timing
interface MockProviderOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  fixedDelayMs?: number;
}

interface ConcurrencyMetrics {
  maxConcurrent: number;
  currentConcurrent: number;
}

function createMockProvider(
  name: string,
  options: MockProviderOptions = {}
): { provider: Provider; metrics: ConcurrencyMetrics } {
  const metrics: ConcurrencyMetrics = {
    maxConcurrent: 0,
    currentConcurrent: 0
  };

  const provider: Provider = {
    name,
    version: '1.0.0',
    priority: 1,
    capabilities: [],
    isAvailable: async () => true,
    getHealth: async () => ({ status: 'healthy', latency: 0 }),
    validateConfig: async () => ({ valid: true }),
    supportsStreaming: false,
    supportsTools: false,
    supportedModels: ['mock'],
    execute: vi.fn(async (request: ExecutionRequest): Promise<ExecutionResponse> => {
      // Track concurrency
      metrics.currentConcurrent++;
      metrics.maxConcurrent = Math.max(metrics.maxConcurrent, metrics.currentConcurrent);

      // Simulate realistic LLM response time
      let delay: number;
      if (options.fixedDelayMs !== undefined) {
        delay = options.fixedDelayMs;
      } else {
        const min = options.minDelayMs ?? 300;
        const max = options.maxDelayMs ?? 700;
        delay = min + Math.random() * (max - min);
      }

      await new Promise(resolve => setTimeout(resolve, delay));

      metrics.currentConcurrent--;

      return {
        content: `Response for: ${request.prompt.substring(0, 30)}`,
        model: 'mock-model',
        tokensUsed: {
          prompt: 50,
          completion: 50,
          total: 100
        },
        latencyMs: delay,
        finishReason: 'stop',
        cached: false
      };
    }),
    estimateCost: async () => ({ estimatedCost: 0, breakdown: [] })
  } as unknown as Provider;

  return { provider, metrics };
}

// Helper to create test agents
function createAgents(count: number): AgentProfile[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `agent-${i + 1}`,
    displayName: `Agent ${i + 1}`,
    team: 'engineering',
    role: 'Load Test Agent',
    description: `Load test agent ${i + 1}`,
    systemPrompt: 'You are a test agent for load testing',
    abilities: [],
    provider: 'mock',
    orchestration: {
      maxDelegationDepth: 2
    }
  }));
}

// Helper to create execution context
function createExecutionContext(agent: AgentProfile, provider: Provider): ExecutionContext {
  return {
    agent,
    task: `Load test task for ${agent.name}`,
    memory: [],
    projectDir: '/test/project',
    workingDir: '/test/project',
    agentWorkspace: `/test/project/.automatosx/workspaces/${agent.name}`,
    provider,
    abilities: '',
    createdAt: new Date()
  };
}

// Helper to calculate max concurrency from timeline
function calculateMaxConcurrency(timeline: TimelineEntry[]): number {
  if (timeline.length === 0) return 0;

  const events: Array<{ time: number; type: 'start' | 'end' }> = [];

  for (const entry of timeline) {
    events.push({ time: entry.startTime, type: 'start' });
    events.push({ time: entry.endTime, type: 'end' });
  }

  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.type === 'end' ? -1 : 1; // Process 'end' before 'start' for same time
  });

  let currentConcurrent = 0;
  let maxConcurrent = 0;

  for (const event of events) {
    if (event.type === 'start') {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
    } else {
      currentConcurrent--;
    }
  }

  return maxConcurrent;
}

// Helper to verify queued execution
function ensureQueuedExecution(
  timeline: TimelineEntry[],
  maxConcurrent: number,
  toleranceMs: number = 10
): boolean {
  const maxObserved = calculateMaxConcurrency(timeline);
  return maxObserved <= maxConcurrent;
}

describe('Load Testing: Parallel Agent Execution', () => {
  describe('Load Test 1: 10 Parallel Agents', () => {
    it('should handle 10 agents with maxConcurrentAgents=4', async () => {
      const agentCount = 10;
      const maxConcurrent = 4;
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider, metrics } = createMockProvider('load-test-10', {
        minDelayMs: 300,
        maxDelayMs: 700
      });

      const agents = createAgents(agentCount);
      const context = createExecutionContext(agents[0]!, provider);

      const result = await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: maxConcurrent,
        continueOnFailure: true
      });

      const maxConcurrency = calculateMaxConcurrency(result.timeline);

      console.log('\n=== Load Test 1: 10 Agents ===');
      console.log(`Total Agents: ${agentCount}`);
      console.log(`Max Concurrent (requested): ${maxConcurrent}`);
      console.log(`Max Concurrent (observed):  ${maxConcurrency}`);
      console.log(`Total Duration: ${result.totalDuration.toFixed(2)}ms`);
      console.log(`Completed: ${result.completedAgents.length}/${agentCount}`);
      console.log(`Status: ${result.failedAgents.length === 0 ? '✓ STABLE' : '⚠ FAIL'}\n`);

      expect(result.completedAgents).toHaveLength(agentCount);
      expect(result.failedAgents).toHaveLength(0);
      expect(result.timeline).toHaveLength(agentCount);
      expect(metrics.maxConcurrent).toBeLessThanOrEqual(maxConcurrent);
      expect(maxConcurrency).toBeLessThanOrEqual(maxConcurrent);
      expect(result.totalDuration).toBeLessThan(10_000);
    }, 15_000);

    it('should maintain system stability', async () => {
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider } = createMockProvider('load-test-10-stability', {
        minDelayMs: 200,
        maxDelayMs: 400
      });

      const agents = createAgents(10);
      const context = createExecutionContext(agents[0]!, provider);

      const beforeMemory = process.memoryUsage().heapUsed;

      await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: 4,
        continueOnFailure: true
      });

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - beforeMemory;
      const baseline = Math.max(beforeMemory, 1);
      const memoryIncreasePercent = (memoryIncrease / baseline) * 100;

      console.log('\n=== Stability Check (10 agents) ===');
      console.log(`Memory Before: ${(beforeMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory After:  ${(afterMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Increase: ${memoryIncreasePercent.toFixed(2)}%`);
      console.log(`Status: ${memoryIncreasePercent < 50 ? '✓ STABLE' : '⚠ WARNING'}\n`);

      expect(memoryIncreasePercent).toBeLessThan(50);
    }, 10_000);
  });

  describe('Load Test 2: 20 Parallel Agents', () => {
    it('should handle 20 agents with maxConcurrentAgents=4', async () => {
      const agentCount = 20;
      const maxConcurrent = 4;
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider, metrics } = createMockProvider('load-test-20', {
        minDelayMs: 250,
        maxDelayMs: 650
      });

      const agents = createAgents(agentCount);
      const context = createExecutionContext(agents[0]!, provider);

      const result = await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: maxConcurrent,
        continueOnFailure: true
      });

      const maxConcurrency = calculateMaxConcurrency(result.timeline);

      console.log('\n=== Load Test 2: 20 Agents ===');
      console.log(`Total Agents: ${agentCount}`);
      console.log(`Max Concurrent (requested): ${maxConcurrent}`);
      console.log(`Max Concurrent (observed):  ${maxConcurrency}`);
      console.log(`Total Duration: ${result.totalDuration.toFixed(2)}ms`);
      console.log(`Completed: ${result.completedAgents.length}/${agentCount}`);
      console.log(`Status: ${result.failedAgents.length === 0 ? '✓ STABLE' : '⚠ FAIL'}\n`);

      expect(result.completedAgents).toHaveLength(agentCount);
      expect(result.failedAgents).toHaveLength(0);
      expect(metrics.maxConcurrent).toBeLessThanOrEqual(maxConcurrent);
      expect(maxConcurrency).toBeLessThanOrEqual(maxConcurrent);
      expect(result.totalDuration).toBeLessThan(20_000);
    }, 25_000);

    it('should maintain reasonable throughput', async () => {
      const agentCount = 20;
      const maxConcurrent = 4;
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider } = createMockProvider('load-test-20-throughput', {
        minDelayMs: 250,
        maxDelayMs: 600
      });

      const agents = createAgents(agentCount);
      const context = createExecutionContext(agents[0]!, provider);

      const result = await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: maxConcurrent,
        continueOnFailure: true
      });

      const totalDuration = Math.max(result.totalDuration, 1);
      const throughput = (agentCount / totalDuration) * 1_000;

      console.log('\n=== Throughput Test (20 agents) ===');
      console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} agents/second`);
      console.log(`Average Time per Agent: ${(totalDuration / agentCount).toFixed(2)}ms`);
      console.log(`Status: ${throughput > 0.5 ? '✓ ACCEPTABLE' : '⚠ LOW'}\n`);

      expect(result.completedAgents).toHaveLength(agentCount);
      expect(throughput).toBeGreaterThan(0.5);
    }, 25_000);
  });

  describe('Load Test 3: 50 Parallel Agents (Stress Test)', () => {
    it('should handle 50 agents with graceful degradation', async () => {
      const agentCount = 50;
      const maxConcurrent = 4;
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider, metrics } = createMockProvider('load-test-50', {
        minDelayMs: 275,
        maxDelayMs: 700
      });

      const agents = createAgents(agentCount);
      const context = createExecutionContext(agents[0]!, provider);

      const result = await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: maxConcurrent,
        continueOnFailure: true
      });

      const successCount = result.completedAgents.length;
      const successRate = (successCount / agentCount) * 100;
      const maxConcurrency = calculateMaxConcurrency(result.timeline);

      console.log('\n=== Load Test 3: 50 Agents (Stress) ===');
      console.log(`Total Agents: ${agentCount}`);
      console.log(`Max Concurrent (requested): ${maxConcurrent}`);
      console.log(`Max Concurrent (observed):  ${maxConcurrency}`);
      console.log(`Total Duration: ${result.totalDuration.toFixed(2)}ms`);
      console.log(`Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`Status: ${successRate >= 95 ? '✓ PASS' : '⚠ DEGRADED'}\n`);

      expect(successCount).toBeGreaterThanOrEqual(Math.floor(agentCount * 0.95));
      expect(result.failedAgents.length).toBeLessThanOrEqual(agentCount * 0.05);
      expect(metrics.maxConcurrent).toBeLessThanOrEqual(maxConcurrent);
      expect(maxConcurrency).toBeLessThanOrEqual(maxConcurrent);
      expect(result.totalDuration).toBeLessThan(60_000);
    }, 70_000);

    it('should not exhaust system resources', async () => {
      const agentCount = 50;
      const maxConcurrent = 4;
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider } = createMockProvider('load-test-50-resource', {
        minDelayMs: 250,
        maxDelayMs: 650
      });

      const agents = createAgents(agentCount);
      const context = createExecutionContext(agents[0]!, provider);

      const beforeMemory = process.memoryUsage();
      const beforeCPU = process.cpuUsage();

      await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: maxConcurrent,
        continueOnFailure: true
      });

      const afterMemory = process.memoryUsage();
      const cpuDelta = process.cpuUsage(beforeCPU);

      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
      const baseline = Math.max(beforeMemory.heapUsed, 1);
      const memoryIncreasePercent = (memoryIncrease / baseline) * 100;
      const cpuTimeMs = (cpuDelta.user + cpuDelta.system) / 1_000;

      console.log('\n=== Resource Usage (50 agents) ===');
      console.log(`Memory Increase: ${memoryIncreasePercent.toFixed(2)}%`);
      console.log(`CPU Time: ${cpuTimeMs.toFixed(2)}ms`);
      console.log(`Heap Used: ${(afterMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`RSS: ${(afterMemory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Status: ${memoryIncreasePercent < 100 ? '✓ ACCEPTABLE' : '⚠ WARNING'}\n`);

      expect(memoryIncreasePercent).toBeLessThan(100);
    }, 70_000);
  });

  describe('Concurrency Limit Enforcement', () => {
    it('should respect maxConcurrentAgents limit', async () => {
      const agentCount = 20;
      const maxConcurrent = 3;
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider, metrics } = createMockProvider('limit-check', {
        fixedDelayMs: 150
      });

      const agents = createAgents(agentCount);
      const context = createExecutionContext(agents[0]!, provider);

      const result = await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: maxConcurrent,
        continueOnFailure: true
      });

      const maxConcurrency = calculateMaxConcurrency(result.timeline);

      console.log('\n=== Concurrency Limit Enforcement ===');
      console.log(`Max Concurrent (requested): ${maxConcurrent}`);
      console.log(`Max Concurrent (observed timeline): ${maxConcurrency}`);
      console.log(`Max Concurrent (provider metrics): ${metrics.maxConcurrent}`);
      console.log(`Status: ${maxConcurrency <= maxConcurrent ? '✓ ENFORCED' : '✗ VIOLATED'}\n`);

      expect(result.completedAgents).toHaveLength(agentCount);
      expect(maxConcurrency).toBeLessThanOrEqual(maxConcurrent);
      expect(metrics.maxConcurrent).toBeLessThanOrEqual(maxConcurrent);
    }, 20_000);

    it('should queue agents when limit is reached', async () => {
      const agentCount = 15;
      const maxConcurrent = 5;
      const parallelExecutor = new ParallelAgentExecutor();
      const { provider } = createMockProvider('limit-queue', {
        fixedDelayMs: 120
      });

      const agents = createAgents(agentCount);
      const context = createExecutionContext(agents[0]!, provider);

      const result = await parallelExecutor.execute(agents, context, {
        maxConcurrentAgents: maxConcurrent,
        continueOnFailure: true
      });

      const queueRespected = ensureQueuedExecution(result.timeline, maxConcurrent, 10);
      const sortedStarts = [...result.timeline]
        .sort((a, b) => a.startTime - b.startTime)
        .map(entry => entry.agentName);

      console.log('\n=== Queue Behavior ===');
      console.log(`Total Agents: ${agentCount}`);
      console.log(`Max Concurrent: ${maxConcurrent}`);
      console.log(`Start Order (first 10): [${sortedStarts.slice(0, 10).join(', ')}]`);
      console.log(`Queue Status: ${queueRespected ? '✓ QUEUED' : '✗ VIOLATED'}\n`);

      expect(result.timeline).toHaveLength(agentCount);
      expect(queueRespected).toBe(true);
    }, 20_000);
  });
});
