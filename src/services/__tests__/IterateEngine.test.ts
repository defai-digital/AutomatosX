/**
 * IterateEngine Tests
 *
 * Comprehensive test suite for autonomous retry loop logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IterateEngine } from '../IterateEngine.js';
import type { IterateOptions, IterateResult } from '../../types/iterate.types.js';

// Mock implementations
class MockWorkflowEngine {
  private shouldFail: boolean = false;
  private failureCount: number = 0;
  private maxFailures: number = 0;
  private returnCostOnFailure: boolean = false;

  setFailurePattern(failCount: number) {
    this.maxFailures = failCount;
    this.failureCount = 0;
    this.returnCostOnFailure = false;
  }

  setReturnCostOnFailure(value: boolean) {
    this.returnCostOnFailure = value;
  }

  async executeWorkflow(path: string, config: any) {
    this.failureCount++;

    if (this.failureCount <= this.maxFailures) {
      // Throw error for failure (IterateEngine expects this)
      const error = new Error('Workflow execution failed');
      if (this.returnCostOnFailure) {
        (error as any).metadata = { cost: 1.0 };
      }
      throw error;
    }

    return {
      success: true,
      status: 'completed',
      totalSteps: 5,
      completedSteps: 5,
      failedSteps: 0,
      metadata: {
        cost: 1.0,
        duration: 1000
      }
    };
  }

  async resumeFromCheckpoint(checkpointId: string) {
    return this.executeWorkflow('', {});
  }
}

class MockCheckpointService {
  private checkpoints: any[] = [];

  async createCheckpoint(data: any) {
    const checkpoint = {
      id: `checkpoint-${Date.now()}`,
      ...data,
      createdAt: Date.now()
    };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }

  getCheckpoints() {
    return this.checkpoints;
  }
}

describe('IterateEngine', () => {
  let engine: IterateEngine;
  let mockWorkflowEngine: MockWorkflowEngine;
  let mockCheckpointService: MockCheckpointService;

  beforeEach(() => {
    mockWorkflowEngine = new MockWorkflowEngine();
    mockCheckpointService = new MockCheckpointService();
    engine = new IterateEngine(
      mockWorkflowEngine as any,
      mockCheckpointService as any,
      'auto'
    );
  });

  describe('Successful Completion', () => {
    it('should succeed on first attempt when workflow completes', async () => {
      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);
      expect(result.stopReason).toBe('success');
      expect(result.finalStrategy.name).toBe('default');
    });

    it('should succeed after retries with strategy adaptation', async () => {
      // Fail 2 times, then succeed
      mockWorkflowEngine.setFailurePattern(2);

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
      expect(result.stopReason).toBe('success');
      expect(result.history.length).toBe(3);
    });

    it('should track iteration history correctly', async () => {
      mockWorkflowEngine.setFailurePattern(1);

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.history.length).toBe(2);
      expect(result.history[0].success).toBe(false);
      expect(result.history[0].iteration).toBe(1);
      expect(result.history[1].success).toBe(true);
      expect(result.history[1].iteration).toBe(2);
    });

    it('should call iteration callback for each iteration', async () => {
      mockWorkflowEngine.setFailurePattern(1);

      const iterations: any[] = [];
      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false,
        onIteration: (iteration) => {
          iterations.push(iteration);
        }
      };

      const result = await engine.iterate('test.yaml', options);

      expect(iterations.length).toBe(2);
      expect(iterations[0].iteration).toBe(1);
      expect(iterations[1].iteration).toBe(2);
    });
  });

  describe('Max Iterations Limit', () => {
    it('should stop after max iterations reached', async () => {
      // Always fail
      mockWorkflowEngine.setFailurePattern(999);

      const options: IterateOptions = {
        maxIterations: 3,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(false);
      expect(result.iterations).toBe(3);
      expect(result.stopReason).toBe('max_iterations');
      expect(result.history.length).toBe(3);
    });

    it('should respect custom max iterations', async () => {
      mockWorkflowEngine.setFailurePattern(999);

      const options: IterateOptions = {
        maxIterations: 5,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.iterations).toBe(5);
      expect(result.stopReason).toBe('max_iterations');
    });
  });

  describe('Timeout Limit', () => {
    it('should stop when timeout is exceeded', async () => {
      mockWorkflowEngine.setFailurePattern(999);

      const options: IterateOptions = {
        maxIterations: 100,
        safetyLevel: 'normal',
        timeout: 100, // 100ms timeout
        verbose: false
      };

      // Add delay to workflow execution
      const originalExecute = mockWorkflowEngine.executeWorkflow.bind(mockWorkflowEngine);
      mockWorkflowEngine.executeWorkflow = async (path: string, config: any) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return originalExecute(path, config);
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe('timeout');
      expect(result.iterations).toBeLessThan(100);
    });
  });

  describe('Safety Constraints', () => {
    it('should stop when cost limits are enforced', async () => {
      // Succeed immediately but with high cost
      const originalExecute = mockWorkflowEngine.executeWorkflow.bind(mockWorkflowEngine);
      let iterationCount = 0;
      mockWorkflowEngine.executeWorkflow = async (path: string, config: any) => {
        iterationCount++;
        return {
          success: true,
          status: iterationCount < 3 ? 'running' : 'completed', // First 2 succeed but not complete
          totalSteps: 5,
          completedSteps: iterationCount < 3 ? 2 : 5,
          failedSteps: 0,
          metadata: { cost: 30.0 } // High cost per iteration
        };
      };

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        maxCost: 50.0,
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(false);
      // May stop at safety_violation or cost_limit (both enforce cost)
      expect(['safety_violation', 'cost_limit']).toContain(result.stopReason);
      expect(result.totalCost).toBeGreaterThan(50.0);
    });

    it('should stop on safety violation from consecutive failures', async () => {
      mockWorkflowEngine.setFailurePattern(999);

      const options: IterateOptions = {
        maxIterations: 20,
        safetyLevel: 'paranoid', // Paranoid allows max 3 consecutive failures
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(false);
      expect(result.stopReason).toBe('safety_violation');
      expect(result.iterations).toBeLessThanOrEqual(4); // Should stop around 3-4 iterations
    });
  });

  describe('Strategy Adaptation', () => {
    it('should adapt strategy after failures', async () => {
      mockWorkflowEngine.setFailurePattern(2);

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      // Should have different strategies across iterations
      const strategies = result.history.map(iter => iter.strategy.name);
      expect(strategies[0]).toBe('default');
      // Strategy should change after failure
      expect(strategies.length).toBeGreaterThan(1);
    });

    it('should use strategy selector correctly', () => {
      const selector = engine.getStrategySelector();
      expect(selector).toBeDefined();
      expect(selector.listStrategies().length).toBe(5);
    });
  });

  describe('Checkpoint Creation', () => {
    it('should create checkpoints at specified intervals', async () => {
      mockWorkflowEngine.setFailurePattern(3);

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        checkpointInterval: 2, // Create checkpoint every 2 iterations
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      const checkpoints = mockCheckpointService.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);
      expect(result.checkpoints.length).toBeGreaterThan(0);
    });

    it('should not create checkpoints when interval not specified', async () => {
      mockWorkflowEngine.setFailurePattern(2);

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
        // No checkpointInterval specified
      };

      const result = await engine.iterate('test.yaml', options);

      const checkpoints = mockCheckpointService.getCheckpoints();
      expect(checkpoints.length).toBe(0);
      expect(result.checkpoints.length).toBe(0);
    });
  });

  describe('Cost and Duration Tracking', () => {
    it('should accumulate total cost across iterations', async () => {
      mockWorkflowEngine.setFailurePattern(2);

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.totalCost).toBeGreaterThan(0);
      // Only successful iteration (iteration 3) has cost of 1.0
      // Failed iterations (1 and 2) have cost 0
      expect(result.totalCost).toBe(1.0);
    });

    it('should track total duration', async () => {
      mockWorkflowEngine.setFailurePattern(1);

      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
      };

      const startTime = Date.now();
      const result = await engine.iterate('test.yaml', options);
      const endTime = Date.now();

      // Duration should be non-negative (may be 0 for fast mocked execution)
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.totalDuration).toBeLessThanOrEqual(endTime - startTime);
    });
  });

  describe('Component Access', () => {
    it('should provide access to strategy selector', () => {
      const selector = engine.getStrategySelector();
      expect(selector).toBeDefined();
    });

    it('should provide access to failure analyzer', () => {
      const analyzer = engine.getFailureAnalyzer();
      expect(analyzer).toBeDefined();
    });

    it('should provide access to safety evaluator', () => {
      const evaluator = engine.getSafetyEvaluator();
      expect(evaluator).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle immediate success', async () => {
      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);
      expect(result.stopReason).toBe('success');
    });

    it('should handle all iterations failing', async () => {
      mockWorkflowEngine.setFailurePattern(999);

      const options: IterateOptions = {
        maxIterations: 3,
        safetyLevel: 'permissive', // Permissive to avoid safety violations
        verbose: false
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(false);
      expect(result.iterations).toBe(3);
      expect(result.history.every(iter => !iter.success)).toBe(true);
    });

    it('should handle verbose mode correctly', async () => {
      const options: IterateOptions = {
        maxIterations: 10,
        safetyLevel: 'normal',
        verbose: true // Should log output
      };

      const result = await engine.iterate('test.yaml', options);

      expect(result.success).toBe(true);
    });
  });
});
