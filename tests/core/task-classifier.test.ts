/**
 * Task Classifier Tests
 *
 * Tests for task classification invariants (INV-TC-001 to INV-TC-005)
 * as documented in packages/contracts/src/agent/v1/invariants.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTaskClassifier,
  classifyTask,
  extractTaskDescription,
  DEFAULT_CLASSIFICATION_RULES,
  DEFAULT_WORKFLOW,
  type TaskClassifier,
  type TaskClassificationResult,
} from '@defai.digital/agent-domain';
import type { TaskClassifierConfig, TaskClassifierRule } from '@defai.digital/contracts';

describe('Task Classifier', () => {
  describe('INV-TC-001: Case-Insensitive Pattern Matching', () => {
    it('should match patterns regardless of input case', () => {
      const classifier = createTaskClassifier();

      // Test various case combinations
      const testCases = [
        'Fix the bug in login',
        'FIX THE BUG IN LOGIN',
        'fix the bug in login',
        'FiX tHe BuG iN lOgIn',
      ];

      const results = testCases.map((input) => classifier.classifyTask(input));

      // All should classify as debugging
      results.forEach((result, index) => {
        expect(result.taskType).toBe('debugging');
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    it('should match mixed case keywords', () => {
      const classifier = createTaskClassifier();

      expect(classifier.classifyTask('REVIEW this code').taskType).toBe('code-review');
      expect(classifier.classifyTask('Deploy to PRODUCTION').taskType).toBe('deployment');
      expect(classifier.classifyTask('Write TESTS for auth').taskType).toBe('testing');
    });
  });

  describe('INV-TC-002: First-Match-Wins (Priority Ordered)', () => {
    it('should evaluate rules by priority (highest first)', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [
          { pattern: 'task', taskType: 'low-priority', workflow: 'low.yaml', priority: 10 },
          { pattern: 'task', taskType: 'high-priority', workflow: 'high.yaml', priority: 90 },
          { pattern: 'task', taskType: 'medium-priority', workflow: 'medium.yaml', priority: 50 },
        ],
        defaultWorkflow: 'default.yaml',
      };

      const classifier = createTaskClassifier(config);
      const result = classifier.classifyTask('do this task');

      // High priority rule should win even though it's not first in array
      expect(result.taskType).toBe('high-priority');
      expect(result.workflow).toBe('high.yaml');
    });

    it('should preserve definition order for same-priority rules', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [
          { pattern: 'task', taskType: 'first', workflow: 'first.yaml', priority: 50 },
          { pattern: 'task', taskType: 'second', workflow: 'second.yaml', priority: 50 },
          { pattern: 'task', taskType: 'third', workflow: 'third.yaml', priority: 50 },
        ],
        defaultWorkflow: 'default.yaml',
      };

      const classifier = createTaskClassifier(config);
      const result = classifier.classifyTask('do this task');

      // First rule in definition order should win for same priority
      expect(result.taskType).toBe('first');
    });

    it('should return first match immediately without evaluating further rules', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [
          { pattern: 'fix', taskType: 'debugging', workflow: 'debug.yaml', priority: 80 },
          { pattern: 'fix|implement', taskType: 'implementation', workflow: 'impl.yaml', priority: 70 },
        ],
        defaultWorkflow: 'default.yaml',
      };

      const classifier = createTaskClassifier(config);
      const result = classifier.classifyTask('fix the bug');

      // Should match debugging, not implementation (even though both could match)
      expect(result.taskType).toBe('debugging');
    });
  });

  describe('INV-TC-003: Default Workflow Fallback', () => {
    it('should return defaultWorkflow when no rules match', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [
          { pattern: 'specific-keyword', taskType: 'specific', workflow: 'specific.yaml', priority: 80 },
        ],
        defaultWorkflow: 'fallback.yaml',
      };

      const classifier = createTaskClassifier(config);
      const result = classifier.classifyTask('random unrelated task');

      expect(result.taskType).toBe('general');
      expect(result.workflow).toBe('fallback.yaml');
    });

    it('should use DEFAULT_WORKFLOW constant when no config provided', () => {
      const classifier = createTaskClassifier();
      const result = classifier.classifyTask('zzzzz nonsense zzzzz');

      expect(result.workflow).toBe(DEFAULT_WORKFLOW);
    });

    it('should return defaultWorkflow from config over DEFAULT_WORKFLOW', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [],
        defaultWorkflow: 'my-custom-default.yaml',
      };

      const classifier = createTaskClassifier(config);
      const result = classifier.classifyTask('anything');

      expect(result.workflow).toBe('my-custom-default.yaml');
    });
  });

  describe('INV-TC-004: Classification Determinism', () => {
    it('should produce same output for same input (multiple calls)', () => {
      const classifier = createTaskClassifier();
      const input = 'Fix the authentication bug in user service';

      const results: TaskClassificationResult[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(classifier.classifyTask(input));
      }

      // All results should be identical
      const first = results[0];
      results.forEach((result, index) => {
        expect(result.taskType).toBe(first.taskType);
        expect(result.confidence).toBe(first.confidence);
        expect(result.workflow).toBe(first.workflow);
        expect(result.matchedKeywords).toEqual(first.matchedKeywords);
      });
    });

    it('should produce same output for same input (multiple classifier instances)', () => {
      const input = 'Implement new feature for dashboard';

      const classifiers = [
        createTaskClassifier(),
        createTaskClassifier(),
        createTaskClassifier(),
      ];

      const results = classifiers.map((c) => c.classifyTask(input));

      // All should produce identical results
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

    it('should be deterministic with custom config', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [
          { pattern: 'alpha|beta', taskType: 'greek', workflow: 'greek.yaml', priority: 50 },
          { pattern: 'one|two', taskType: 'numbers', workflow: 'numbers.yaml', priority: 50 },
        ],
        defaultWorkflow: 'default.yaml',
      };

      const results: TaskClassificationResult[] = [];
      for (let i = 0; i < 5; i++) {
        const classifier = createTaskClassifier(config);
        results.push(classifier.classifyTask('test alpha one'));
      }

      // All results should be identical
      const first = results[0];
      results.forEach((result) => {
        expect(result).toEqual(first);
      });
    });
  });

  describe('INV-TC-005: Unknown Task Routing', () => {
    it('should route unknown tasks to defaultWorkflow, not fail', () => {
      const classifier = createTaskClassifier();

      // Completely unrelated input that matches no patterns
      const result = classifier.classifyTask('xyzzy plugh qwerty asdf');

      expect(result.taskType).toBe('general');
      expect(result.confidence).toBe(0);
      expect(result.workflow).toBe(DEFAULT_WORKFLOW);
      expect(result.matchedKeywords).toEqual([]);
    });

    it('should handle empty string input gracefully', () => {
      const classifier = createTaskClassifier();
      const result = classifier.classifyTask('');

      expect(result.taskType).toBe('general');
      expect(result.confidence).toBe(0);
      expect(result.workflow).toBeDefined();
    });

    it('should handle whitespace-only input gracefully', () => {
      const classifier = createTaskClassifier();
      const result = classifier.classifyTask('   \t\n   ');

      expect(result.taskType).toBe('general');
      expect(result.confidence).toBe(0);
    });

    it('should never throw exceptions for any input', () => {
      const classifier = createTaskClassifier();

      const edgeCases = [
        '',
        '   ',
        '\n\t\r',
        'a'.repeat(10000), // Very long input
        '!@#$%^&*()_+{}|:"<>?', // Special characters
        '日本語テスト', // Unicode
        'emoji 🚀 test 🎉',
        'null',
        'undefined',
        'NaN',
      ];

      edgeCases.forEach((input) => {
        expect(() => classifier.classifyTask(input)).not.toThrow();
      });
    });
  });

  describe('Default Classification Rules', () => {
    let classifier: TaskClassifier;

    beforeEach(() => {
      classifier = createTaskClassifier();
    });

    it('should classify code review tasks', () => {
      const tasks = [
        'Review this pull request',
        'Please audit the security code',
        'Check this PR for issues',
        'Give me feedback on my code',
      ];

      tasks.forEach((task) => {
        expect(classifier.classifyTask(task).taskType).toBe('code-review');
      });
    });

    it('should classify debugging tasks', () => {
      const tasks = [
        'Fix the login bug',
        'Debug the memory leak',
        'The app crashes on startup',
        'Error when clicking submit button',
      ];

      tasks.forEach((task) => {
        expect(classifier.classifyTask(task).taskType).toBe('debugging');
      });
    });

    it('should classify testing tasks', () => {
      const tasks = [
        'Write unit tests for auth module',
        'Add integration tests',
        'Improve test coverage',
        'Create e2e tests for checkout',
      ];

      tasks.forEach((task) => {
        expect(classifier.classifyTask(task).taskType).toBe('testing');
      });
    });

    it('should classify deployment tasks', () => {
      const tasks = [
        'Deploy the application to production',
        'Set up a new CI pipeline',
        'Configure Kubernetes cluster',
        'Create Docker image for the service',
      ];

      tasks.forEach((task) => {
        expect(classifier.classifyTask(task).taskType).toBe('deployment');
      });
    });

    it('should classify research tasks', () => {
      const tasks = [
        'Research caching strategies',
        'Learn about new React hooks',
        'Compare different database options',
        'Search for authentication libraries',
      ];

      tasks.forEach((task) => {
        expect(classifier.classifyTask(task).taskType).toBe('research');
      });
    });

    it('should classify implementation tasks', () => {
      const tasks = [
        'Implement user authentication',
        'Build the dashboard component',
        'Create the new login page',
        'Add dark mode feature',
      ];

      tasks.forEach((task) => {
        expect(classifier.classifyTask(task).taskType).toBe('implementation');
      });
    });

    it('should include valid workflow paths for all default rules', () => {
      const expectedWorkflowPaths = [
        'workflows/std/code-review.yaml',
        'workflows/std/debugging.yaml',
        'workflows/std/testing.yaml',
        'workflows/std/refactoring.yaml',
        'workflows/std/documentation.yaml',
        'workflows/std/analysis.yaml',
        'workflows/std/research.yaml',
        'workflows/std/deployment.yaml',
        'workflows/std/implementation.yaml',
      ];

      const usedWorkflows = new Set(DEFAULT_CLASSIFICATION_RULES.map((r) => r.workflow));

      expectedWorkflowPaths.forEach((path) => {
        expect(usedWorkflows.has(path)).toBe(true);
      });
    });
  });

  describe('Classifier Configuration', () => {
    it('should respect enabled=false configuration', () => {
      const config: TaskClassifierConfig = {
        enabled: false,
        rules: [
          { pattern: 'fix', taskType: 'debugging', workflow: 'debug.yaml', priority: 80 },
        ],
        defaultWorkflow: 'disabled-default.yaml',
      };

      const classifier = createTaskClassifier(config);
      const result = classifier.classifyTask('fix the bug');

      // Should return general even though "fix" would normally match
      expect(result.taskType).toBe('general');
      expect(result.confidence).toBe(0);
      expect(result.workflow).toBe('disabled-default.yaml');
    });

    it('should expose rules through getRules()', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [
          { pattern: 'a', taskType: 'a-type', workflow: 'a.yaml', priority: 30 },
          { pattern: 'b', taskType: 'b-type', workflow: 'b.yaml', priority: 70 },
        ],
        defaultWorkflow: 'default.yaml',
      };

      const classifier = createTaskClassifier(config);
      const rules = classifier.getRules();

      // Rules should be sorted by priority
      expect(rules[0].priority).toBe(70);
      expect(rules[1].priority).toBe(30);
    });

    it('should expose defaultWorkflow through getDefaultWorkflow()', () => {
      const config: TaskClassifierConfig = {
        enabled: true,
        rules: [],
        defaultWorkflow: 'my-default.yaml',
      };

      const classifier = createTaskClassifier(config);
      expect(classifier.getDefaultWorkflow()).toBe('my-default.yaml');
    });
  });

  describe('extractTaskDescription', () => {
    it('should extract string input directly', () => {
      expect(extractTaskDescription('fix the bug')).toBe('fix the bug');
    });

    it('should extract from object with task field', () => {
      expect(extractTaskDescription({ task: 'implement feature' })).toBe('implement feature');
    });

    it('should extract from object with prompt field', () => {
      expect(extractTaskDescription({ prompt: 'review code' })).toBe('review code');
    });

    it('should extract from object with description field', () => {
      expect(extractTaskDescription({ description: 'add tests' })).toBe('add tests');
    });

    it('should handle null and undefined', () => {
      expect(extractTaskDescription(null)).toBe('');
      expect(extractTaskDescription(undefined)).toBe('');
    });

    it('should stringify objects without known fields', () => {
      const obj = { foo: 'bar', baz: 123 };
      const result = extractTaskDescription(obj);
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });
  });

  describe('Legacy classifyTask function', () => {
    it('should work without availableCapabilities parameter', () => {
      const result = classifyTask('Fix the bug');
      expect(result.taskType).toBe('debugging');
    });

    it('should filter by availableCapabilities when provided', () => {
      const capabilities = [
        { taskType: 'implementation' as const, workflowRef: 'impl.yaml', priority: 50 },
      ];

      // "Fix" normally maps to debugging, but debugging not in capabilities
      const result = classifyTask('Fix the bug', capabilities);

      // Should fall back to general since debugging not available
      expect(result.taskType).toBe('general');
    });
  });
});
