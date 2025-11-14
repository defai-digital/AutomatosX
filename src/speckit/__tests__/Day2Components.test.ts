/**
 * Day 2 Components Tests
 *
 * Week 3-4 Implementation - Day 2
 * Comprehensive tests for DependencyGraph, CostEstimator, and PlanGenerator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../utils/DependencyGraph.js';
import { CostEstimator } from '../utils/CostEstimator.js';
import { PlanGenerator } from '../generators/PlanGenerator.js';
import { WorkflowParser } from '../../services/WorkflowParser.js';
import type { WorkflowDefinition } from '../types/speckit.types.js';

describe('DependencyGraph', () => {
  let simpleWorkflow: WorkflowDefinition;
  let complexWorkflow: WorkflowDefinition;
  let cyclicWorkflow: WorkflowDefinition;

  beforeEach(() => {
    // Simple linear workflow
    simpleWorkflow = {
      name: 'Simple Workflow',
      version: '1.0.0',
      description: 'A simple linear workflow',
      steps: [
        {
          id: 'step-1',
          name: 'Step 1',
          agent: 'test-agent',
          action: 'action1',
          timeout: 10000,
        },
        {
          id: 'step-2',
          name: 'Step 2',
          agent: 'test-agent',
          action: 'action2',
          dependsOn: ['step-1'],
          timeout: 15000,
        },
        {
          id: 'step-3',
          name: 'Step 3',
          agent: 'test-agent',
          action: 'action3',
          dependsOn: ['step-2'],
          timeout: 20000,
        },
      ],
    };

    // Complex workflow with parallel steps
    complexWorkflow = {
      name: 'Complex Workflow',
      version: '1.0.0',
      description: 'Complex workflow with parallel execution',
      steps: [
        {
          id: 'analyze',
          name: 'Analyze Code',
          agent: 'analyzer',
          action: 'analyze',
          timeout: 30000,
        },
        {
          id: 'test-unit',
          name: 'Run Unit Tests',
          agent: 'tester',
          action: 'test',
          dependsOn: ['analyze'],
          timeout: 60000,
        },
        {
          id: 'test-integration',
          name: 'Run Integration Tests',
          agent: 'tester',
          action: 'test',
          dependsOn: ['analyze'],
          timeout: 90000,
        },
        {
          id: 'lint',
          name: 'Lint Code',
          agent: 'linter',
          action: 'lint',
          dependsOn: ['analyze'],
          timeout: 20000,
        },
        {
          id: 'report',
          name: 'Generate Report',
          agent: 'reporter',
          action: 'report',
          dependsOn: ['test-unit', 'test-integration', 'lint'],
          timeout: 15000,
        },
      ],
    };

    // Workflow with circular dependency
    cyclicWorkflow = {
      name: 'Cyclic Workflow',
      version: '1.0.0',
      description: 'Workflow with cycle',
      steps: [
        {
          id: 'step-a',
          name: 'Step A',
          agent: 'test-agent',
          action: 'action',
          dependsOn: ['step-c'],
          timeout: 10000,
        },
        {
          id: 'step-b',
          name: 'Step B',
          agent: 'test-agent',
          action: 'action',
          dependsOn: ['step-a'],
          timeout: 10000,
        },
        {
          id: 'step-c',
          name: 'Step C',
          agent: 'test-agent',
          action: 'action',
          dependsOn: ['step-b'],
          timeout: 10000,
        },
      ],
    };
  });

  describe('topologicalSort', () => {
    it('should sort simple linear workflow', () => {
      const graph = new DependencyGraph(simpleWorkflow);
      const sorted = graph.topologicalSort();

      expect(sorted).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('should sort complex workflow with parallel steps', () => {
      const graph = new DependencyGraph(complexWorkflow);
      const sorted = graph.topologicalSort();

      // First step must be 'analyze'
      expect(sorted[0]).toBe('analyze');

      // Last step must be 'report'
      expect(sorted[sorted.length - 1]).toBe('report');

      // Parallel steps should come after analyze and before report
      const parallelSteps = ['test-unit', 'test-integration', 'lint'];
      const analyzeIndex = sorted.indexOf('analyze');
      const reportIndex = sorted.indexOf('report');

      for (const step of parallelSteps) {
        const stepIndex = sorted.indexOf(step);
        expect(stepIndex).toBeGreaterThan(analyzeIndex);
        expect(stepIndex).toBeLessThan(reportIndex);
      }
    });

    it('should throw error for cyclic workflow', () => {
      const graph = new DependencyGraph(cyclicWorkflow);

      expect(() => graph.topologicalSort()).toThrow('contains cycles');
    });
  });

  describe('detectCycles', () => {
    it('should detect no cycles in acyclic workflow', () => {
      const graph = new DependencyGraph(simpleWorkflow);
      const cycles = graph.detectCycles();

      expect(cycles).toHaveLength(0);
    });

    it('should detect cycle in cyclic workflow', () => {
      const graph = new DependencyGraph(cyclicWorkflow);
      const cycles = graph.detectCycles();

      expect(cycles.length).toBeGreaterThan(0);

      // Cycle should contain all three steps
      const cycle = cycles[0];
      expect(cycle).toContain('step-a');
      expect(cycle).toContain('step-b');
      expect(cycle).toContain('step-c');
    });
  });

  describe('getCriticalPath', () => {
    it('should identify critical path in simple workflow', () => {
      const graph = new DependencyGraph(simpleWorkflow);
      const criticalPath = graph.getCriticalPath();

      // All steps are on critical path in linear workflow
      expect(criticalPath).toContain('step-1');
      expect(criticalPath).toContain('step-2');
      expect(criticalPath).toContain('step-3');
    });

    it('should calculate critical path duration', () => {
      const graph = new DependencyGraph(simpleWorkflow);
      const duration = graph.getCriticalPathDuration();

      // Sum of all step durations in linear workflow
      expect(duration).toBe(10000 + 15000 + 20000);
    });

    it('should identify longest path in complex workflow', () => {
      const graph = new DependencyGraph(complexWorkflow);
      const criticalPath = graph.getCriticalPath();

      // Critical path should include analyze, test-integration (longest parallel), and report
      expect(criticalPath).toContain('analyze');
      expect(criticalPath).toContain('test-integration'); // Longest parallel step (90s)
      expect(criticalPath).toContain('report');
    });
  });

  describe('getExecutionLevels', () => {
    it('should group steps by execution level', () => {
      const graph = new DependencyGraph(complexWorkflow);
      const levels = graph.getExecutionLevels();

      // Level 0: analyze
      expect(levels[0]).toEqual(['analyze']);

      // Level 1: parallel steps
      expect(levels[1]).toHaveLength(3);
      expect(levels[1]).toContain('test-unit');
      expect(levels[1]).toContain('test-integration');
      expect(levels[1]).toContain('lint');

      // Level 2: report
      expect(levels[2]).toEqual(['report']);
    });
  });

  describe('getParallelizableNodes', () => {
    it('should identify parallelizable steps', () => {
      const graph = new DependencyGraph(complexWorkflow);
      const parallel = graph.getParallelizableNodes();

      // Level 1 has 3 parallel steps
      expect(parallel.has(1)).toBe(true);
      expect(parallel.get(1)).toHaveLength(3);
    });

    it('should return empty for linear workflow', () => {
      const graph = new DependencyGraph(simpleWorkflow);
      const parallel = graph.getParallelizableNodes();

      expect(parallel.size).toBe(0);
    });
  });

  describe('getMetadata', () => {
    it('should return correct metadata', () => {
      const graph = new DependencyGraph(complexWorkflow);
      const metadata = graph.getMetadata();

      expect(metadata.nodeCount).toBe(5);
      expect(metadata.edgeCount).toBe(6);
      expect(metadata.maxDepth).toBe(2);
      expect(metadata.hasCycles).toBe(false);
      expect(metadata.cycles).toBeUndefined();
    });

    it('should detect cycles in metadata', () => {
      const graph = new DependencyGraph(cyclicWorkflow);
      const metadata = graph.getMetadata();

      expect(metadata.hasCycles).toBe(true);
      expect(metadata.cycles).toBeDefined();
      expect(metadata.cycles!.length).toBeGreaterThan(0);
    });
  });
});

describe('CostEstimator', () => {
  let estimator: CostEstimator;
  let testWorkflow: WorkflowDefinition;

  beforeEach(() => {
    estimator = new CostEstimator();

    testWorkflow = {
      name: 'Test Workflow',
      version: '1.0.0',
      description: 'Test workflow for cost estimation',
      steps: [
        {
          id: 'step-1',
          name: 'Analyze',
          agent: 'analyzer',
          action: 'analyze',
        },
        {
          id: 'step-2',
          name: 'Transform',
          agent: 'transformer',
          action: 'transform',
        },
        {
          id: 'step-3',
          name: 'Generate',
          agent: 'generator',
          action: 'generate',
        },
      ],
    };
  });

  describe('estimateStepCost', () => {
    it('should estimate cost for claude', () => {
      const cost = estimator.estimateStepCost(
        testWorkflow.steps[0],
        'claude'
      );

      expect(cost.provider).toBe('claude');
      expect(cost.model).toBe('claude-3-5-sonnet-20241022');
      expect(cost.inputTokens).toBeGreaterThan(0);
      expect(cost.outputTokens).toBeGreaterThan(0);
      expect(cost.cost).toBeGreaterThan(0);
    });

    it('should estimate cost for gemini', () => {
      const cost = estimator.estimateStepCost(
        testWorkflow.steps[0],
        'gemini'
      );

      expect(cost.provider).toBe('gemini');
      expect(cost.model).toBe('gemini-1.5-flash');
      expect(cost.inputTokens).toBeGreaterThan(0);
      expect(cost.outputTokens).toBeGreaterThan(0);
    });

    it('should apply complexity multiplier', () => {
      const lowCost = estimator.estimateStepCost(
        testWorkflow.steps[0],
        'claude',
        undefined,
        'low'
      );

      const highCost = estimator.estimateStepCost(
        testWorkflow.steps[0],
        'claude',
        undefined,
        'high'
      );

      expect(highCost.totalTokens).toBeGreaterThan(lowCost.totalTokens);
      expect(highCost.cost).toBeGreaterThan(lowCost.cost);
    });
  });

  describe('estimateWorkflowCost', () => {
    it('should estimate total workflow cost', () => {
      const cost = estimator.estimateWorkflowCost(testWorkflow, 'claude');

      expect(cost.breakdown.apiCalls).toBe(3);
      expect(cost.totalTokens).toBeGreaterThan(0);
      expect(cost.cost).toBeGreaterThan(0);
    });
  });

  describe('compareProviders', () => {
    it('should compare costs across providers', () => {
      const comparison = estimator.compareProviders(testWorkflow);

      expect(comparison).toHaveProperty('claude');
      expect(comparison).toHaveProperty('gemini');
      expect(comparison).toHaveProperty('openai');

      // All should have cost estimates
      expect(comparison.claude.cost).toBeGreaterThanOrEqual(0);
      expect(comparison.gemini.cost).toBeGreaterThanOrEqual(0);
      expect(comparison.openai.cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCheapestProvider', () => {
    it('should find cheapest provider', () => {
      const { provider, estimate } = estimator.getCheapestProvider(testWorkflow);

      expect(provider).toBeTruthy();
      expect(estimate.cost).toBeGreaterThanOrEqual(0);

      // Verify it's actually cheapest
      const comparison = estimator.compareProviders(testWorkflow);
      const costs = Object.values(comparison).map(e => e.cost);
      const minCost = Math.min(...costs);

      expect(estimate.cost).toBe(minCost);
    });
  });

  describe('getBalancedProvider', () => {
    it('should find balanced provider', () => {
      const { provider, estimate } = estimator.getBalancedProvider(testWorkflow);

      expect(provider).toBeTruthy();
      expect(estimate.cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatCost', () => {
    it('should format cost correctly', () => {
      expect(estimator.formatCost(0.001234)).toBe('$0.0012');
      expect(estimator.formatCost(0.0001)).toBe('<$0.001');
      expect(estimator.formatCost(1.5)).toBe('$1.5000');
    });
  });

  describe('formatTokens', () => {
    it('should format tokens with suffixes', () => {
      expect(estimator.formatTokens(500)).toBe('500');
      expect(estimator.formatTokens(1500)).toBe('1.5K');
      expect(estimator.formatTokens(1500000)).toBe('1.50M');
    });
  });
});

describe('PlanGenerator', () => {
  let generator: PlanGenerator;
  let workflowParser: WorkflowParser;
  let testWorkflow: WorkflowDefinition;

  beforeEach(() => {
    workflowParser = new WorkflowParser();
    generator = new PlanGenerator(workflowParser);

    testWorkflow = {
      name: 'Test Workflow',
      version: '1.0.0',
      description: 'Test workflow',
      steps: [
        {
          id: 'analyze',
          name: 'Analyze Code',
          agent: 'analyzer',
          action: 'analyze',
          timeout: 30000,
          retryConfig: {
            maxRetries: 3,
            backoffMs: 1000,
          },
        },
        {
          id: 'test',
          name: 'Run Tests',
          agent: 'tester',
          action: 'test',
          dependsOn: ['analyze'],
          timeout: 60000,
          retryConfig: {
            maxRetries: 2,
            backoffMs: 2000,
          },
        },
        {
          id: 'report',
          name: 'Generate Report',
          agent: 'reporter',
          action: 'report',
          dependsOn: ['test'],
          timeout: 15000,
          retryConfig: {
            maxRetries: 1,
            backoffMs: 500,
          },
        },
      ],
    };
  });

  describe('generatePlan', () => {
    it('should generate execution plan', async () => {
      const plan = await generator.generatePlan(testWorkflow);

      expect(plan.summary).toContain('Test Workflow');
      expect(plan.phases).toHaveLength(3);
      expect(plan.totalDuration).toBe(30000 + 60000 + 15000);
      expect(plan.criticalPath).toEqual(['analyze', 'test', 'report']);
    });

    it('should include cost estimates when requested', async () => {
      const plan = await generator.generatePlan(testWorkflow, {
        includeCost: true,
      });

      expect(plan.totalCost).toBeGreaterThan(0);
      expect(plan.phases[0].cost).toBeGreaterThan(0);
    });

    it('should calculate resource requirements', async () => {
      const plan = await generator.generatePlan(testWorkflow, {
        includeResources: true,
      });

      expect(plan.resources.apiCalls).toBe(3);
      expect(plan.resources.agents).toContain('analyzer');
      expect(plan.resources.agents).toContain('tester');
      expect(plan.resources.agents).toContain('reporter');
      expect(plan.resources.maxConcurrency).toBe(1); // Linear workflow
    });

    it('should assess risks', async () => {
      const plan = await generator.generatePlan(testWorkflow);

      expect(plan.risks).toBeDefined();
      expect(Array.isArray(plan.risks)).toBe(true);
    });

    it('should throw error for cyclic workflow', async () => {
      const cyclicWorkflow: WorkflowDefinition = {
        name: 'Cyclic',
        version: '1.0.0',
        description: 'Has cycle',
        steps: [
          {
            id: 'a',
            name: 'A',
            agent: 'test',
            action: 'test',
            dependsOn: ['b'],
          },
          {
            id: 'b',
            name: 'B',
            agent: 'test',
            action: 'test',
            dependsOn: ['a'],
          },
        ],
      };

      await expect(generator.generatePlan(cyclicWorkflow)).rejects.toThrow(
        'circular dependencies'
      );
    });

    it('should optimize for cost when requested', async () => {
      const plan = await generator.generatePlan(testWorkflow, {
        optimize: 'cost',
        includeCost: true,
      });

      expect(plan.totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should optimize for speed when requested', async () => {
      const plan = await generator.generatePlan(testWorkflow, {
        optimize: 'speed',
        includeCost: true,
      });

      expect(plan.totalCost).toBeGreaterThanOrEqual(0);
    });
  });
});
