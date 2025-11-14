/**
 * FailureAnalyzer Tests
 *
 * Comprehensive test suite for failure analysis logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FailureAnalyzer } from '../FailureAnalyzer.js';
import type { IterationResult, ProgressSnapshot } from '../../types/iterate.types.js';

describe('FailureAnalyzer', () => {
  let analyzer: FailureAnalyzer;

  beforeEach(() => {
    analyzer = new FailureAnalyzer();
  });

  describe('Error Classification', () => {
    it('should classify timeout errors', async () => {
      const error = new Error('Connection timeout after 5000ms');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('timeout');
      expect(analysis.isTransient).toBe(true);
      expect(analysis.isPermanent).toBe(false);
    });

    it('should classify rate limit errors', async () => {
      const error = new Error('Rate limit exceeded: 429 Too Many Requests');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('rateLimit');
      expect(analysis.isTransient).toBe(true);
      expect(analysis.isPermanent).toBe(false);
    });

    it('should classify network errors', async () => {
      const error = new Error('ENOTFOUND - DNS lookup failed');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('network');
      expect(analysis.isTransient).toBe(true);
      expect(analysis.isPermanent).toBe(false);
    });

    it('should classify auth errors', async () => {
      const error = new Error('401 Unauthorized - invalid API key');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('auth');
      expect(analysis.isTransient).toBe(false);
      expect(analysis.isPermanent).toBe(true);
    });

    it('should classify validation errors', async () => {
      const error = new Error('400 Bad Request - schema validation failed');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('validation');
      expect(analysis.isTransient).toBe(false);
      expect(analysis.isPermanent).toBe(true);
    });

    it('should classify resource exhaustion errors', async () => {
      const error = new Error('EMFILE: too many open files');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('resource');
      expect(analysis.isTransient).toBe(true);
      expect(analysis.isPermanent).toBe(false);
    });

    it('should classify provider errors', async () => {
      const error = new Error('503 Service Unavailable - API overloaded');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('provider');
      expect(analysis.isTransient).toBe(true);
      expect(analysis.isPermanent).toBe(false);
    });

    it('should classify permanent errors', async () => {
      const error = new Error('404 Not Found - workflow does not exist');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('permanent');
      expect(analysis.isTransient).toBe(false);
      expect(analysis.isPermanent).toBe(true);
    });

    it('should handle unknown errors gracefully', async () => {
      const error = new Error('Something weird happened');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.errorType).toBe('unknown');
      expect(analysis.isTransient).toBe(false);
      expect(analysis.isPermanent).toBe(false);
    });
  });

  describe('Severity Assessment', () => {
    it('should assess low severity for early timeout errors', async () => {
      const error = new Error('Connection timeout');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.severity).toBe('low');
    });

    it('should assess medium severity for provider errors', async () => {
      const error = new Error('500 Internal Server Error');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.severity).toBe('medium');
    });

    it('should assess high severity for auth errors', async () => {
      const error = new Error('403 Forbidden - insufficient permissions');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.severity).toBe('high');
    });

    it('should assess high severity after multiple failures', async () => {
      const error = new Error('Timeout');
      const progress = createMockProgress();
      const history: IterationResult[] = [
        createFailedIteration(1, new Error('Error 1')),
        createFailedIteration(2, new Error('Error 2')),
        createFailedIteration(3, new Error('Error 3')),
        createFailedIteration(4, new Error('Error 4')),
        createFailedIteration(5, new Error('Error 5'))
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.severity).toBe('high');
    });

    it('should assess critical severity for permanent errors', async () => {
      const error = new Error('404 Not Found - permanently failed');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.severity).toBe('critical');
    });

    it('should assess critical severity after many iterations', async () => {
      const error = new Error('Timeout');
      const progress = createMockProgress();
      const history: IterationResult[] = Array.from({ length: 8 }, (_, i) =>
        createFailedIteration(i + 1, new Error(`Error ${i + 1}`))
      );

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.severity).toBe('critical');
    });
  });

  describe('Failure Pattern Detection', () => {
    it('should detect no pattern with insufficient history', async () => {
      const error = new Error('Timeout');
      const progress = createMockProgress();
      const history: IterationResult[] = [
        createFailedIteration(1, new Error('Error 1'))
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failurePattern).toBeUndefined();
    });

    it('should detect repeated same error pattern', async () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      const progress = createMockProgress();

      const error1 = new Error('Timeout 1');
      error1.name = 'TimeoutError';
      const error2 = new Error('Timeout 2');
      error2.name = 'TimeoutError';
      const error3 = new Error('Timeout 3');
      error3.name = 'TimeoutError';

      const history: IterationResult[] = [
        createFailedIteration(1, error1),
        createFailedIteration(2, error2),
        createFailedIteration(3, error3)
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failurePattern).toBe('repeated_same_error');
    });

    it('should detect consistent failure pattern', async () => {
      const error = new Error('Error');
      const progress = createMockProgress();

      // Create errors with different names to avoid repeated_same_error detection
      const error1 = new Error('Error 1');
      error1.name = 'NetworkError';
      const error2 = new Error('Error 2');
      error2.name = 'ValidationError';

      const history: IterationResult[] = [
        createFailedIteration(1, error1),
        createFailedIteration(2, error2)
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failurePattern).toBe('consistent_failure');
    });

    it('should detect performance degradation pattern', async () => {
      const error = new Error('Slow response');
      const progress = createMockProgress();

      // Create iterations with increasing duration
      // Mix success/failure to avoid consistent_failure (last 2 must differ)
      const error1 = new Error('E1');
      error1.name = 'TimeoutError';
      const error3 = new Error('E3');
      error3.name = 'ProviderError';

      const history: IterationResult[] = [
        { ...createFailedIteration(1, error1), duration: 1000, success: false },
        { ...createFailedIteration(2, new Error('E2')), duration: 2000, success: true }, // Success to break consistent_failure
        { ...createFailedIteration(3, error3), duration: 3000, success: false }
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failurePattern).toBe('performance_degradation');
    });
  });

  describe('Recommendation Generation', () => {
    it('should recommend increasing timeout for timeout errors', async () => {
      const error = new Error('Connection timeout');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.recommendations).toContain('Increase timeout values');
      expect(analysis.recommendations).toContain('Check network connectivity');
    });

    it('should recommend fallback providers for rate limit errors', async () => {
      const error = new Error('Rate limit exceeded');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.recommendations).toContain('Use fallback AI providers');
      expect(analysis.recommendations).toContain('Reduce parallelism to slow down requests');
    });

    it('should recommend reducing parallelism for resource errors', async () => {
      const error = new Error('Out of memory');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.recommendations).toContain('Reduce parallelism to lower resource usage');
      expect(analysis.recommendations).toContain('Close unused connections');
    });

    it('should recommend verification for auth errors', async () => {
      const error = new Error('401 Unauthorized');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.recommendations).toContain('Verify API credentials');
      expect(analysis.recommendations).toContain('Check token expiration');
    });

    it('should recommend manual intervention for permanent errors', async () => {
      const error = new Error('404 Not Found');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.recommendations).toContain('Manual intervention required');
      expect(analysis.recommendations).toContain('Review error details and fix root cause');
    });

    it('should add strategy change recommendation for repeated errors', async () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      const progress = createMockProgress();

      const error1 = new Error('Timeout 1');
      error1.name = 'TimeoutError';
      const error2 = new Error('Timeout 2');
      error2.name = 'TimeoutError';

      const history: IterationResult[] = [
        createFailedIteration(1, error1),
        createFailedIteration(2, error2)
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.recommendations).toContain('Try a different strategy approach');
    });

    it('should recommend manual intervention after many failures', async () => {
      const error = new Error('Error');
      const progress = createMockProgress();
      const history: IterationResult[] = Array.from({ length: 7 }, (_, i) =>
        createFailedIteration(i + 1, new Error(`Error ${i + 1}`))
      );

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.recommendations).toContain('Consider manual intervention - many iterations failed');
    });
  });

  describe('Confidence Calculation', () => {
    it('should have low confidence for unknown errors with no history', async () => {
      const error = new Error('Unknown error');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.confidence).toBe(0.5); // Base confidence
    });

    it('should increase confidence for known error types', async () => {
      const error = new Error('Connection timeout');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.confidence).toBe(0.7); // Base + known type
    });

    it('should increase confidence with more history', async () => {
      const error = new Error('Timeout');
      const progress = createMockProgress();

      // Create different error types to avoid pattern bonus
      const error1 = new Error('E1');
      error1.name = 'NetworkError';
      const error2 = new Error('E2');
      error2.name = 'TimeoutError';
      const error3 = new Error('E3');
      error3.name = 'ValidationError';

      const history: IterationResult[] = [
        createFailedIteration(1, error1),
        createFailedIteration(2, error2),
        createFailedIteration(3, error3)
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.confidence).toBe(0.85); // Base + known + history
    });

    it('should have maximum confidence with consistent patterns', async () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      const progress = createMockProgress();

      const error1 = new Error('T1');
      error1.name = 'TimeoutError';
      const error2 = new Error('T2');
      error2.name = 'TimeoutError';
      const error3 = new Error('T3');
      error3.name = 'TimeoutError';

      const history: IterationResult[] = [
        createFailedIteration(1, error1),
        createFailedIteration(2, error2),
        createFailedIteration(3, error3)
      ];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.confidence).toBe(1.0); // Base + known + history + pattern
    });
  });

  describe('Failed Step Extraction', () => {
    it('should extract step from progress currentStep', async () => {
      const error = new Error('Step failed');
      const progress: ProgressSnapshot = {
        totalSteps: 5,
        completedSteps: 2,
        failedSteps: 1,
        completionPercent: 40,
        currentStep: 'data-validation'
      };
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failedStep).toBe('data-validation');
    });

    it('should extract step from error message', async () => {
      const error = new Error('Failed at step: "api-integration"');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failedStep).toBe('api-integration');
    });

    it('should extract step from progress steps array', async () => {
      const error = new Error('Generic failure occurred');
      const progress: ProgressSnapshot = {
        totalSteps: 3,
        completedSteps: 1,
        failedSteps: 1,
        completionPercent: 33,
        steps: [
          { name: 'step1', status: 'completed' },
          { name: 'step2', status: 'failed' },
          { name: 'step3', status: 'pending' }
        ]
      };
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failedStep).toBe('step2');
    });

    it('should return unknown when no step information available', async () => {
      const error = new Error('Generic error');
      const progress = createMockProgress();
      const history: IterationResult[] = [];

      const analysis = await analyzer.analyze(error, progress, history);

      expect(analysis.failedStep).toBe('unknown');
    });
  });
});

// Helper functions

function createMockProgress(): ProgressSnapshot {
  return {
    totalSteps: 5,
    completedSteps: 2,
    failedSteps: 1,
    completionPercent: 40
  };
}

function createFailedIteration(iteration: number, error: Error): IterationResult {
  return {
    iteration,
    success: false,
    complete: false,
    strategy: {
      name: 'default',
      description: 'Default strategy',
      config: {},
      priority: 10,
      applicableErrors: []
    },
    error,
    progress: createMockProgress(),
    duration: 1000,
    cost: 0.1,
    metadata: {}
  };
}
