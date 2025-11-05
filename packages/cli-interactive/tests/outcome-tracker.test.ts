/**
 * Tests for outcome-tracker.ts
 * Verifies task completion tracking and progress metrics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createOutcomeTracker,
  addOutcome,
  updateOutcome,
  renderOutcomeTracker,
  renderOutcomeStatusBar,
  renderProgressBar,
  renderNextActions,
  detectOutcomeFromCommand,
  getOutcomeProgress,
  suggestNextActions,
  OUTCOME_PRESETS,
  type OutcomeTracker,
  type Outcome,
  type OutcomeStatus
} from '../src/outcome-tracker.js';

describe('Outcome Tracker', () => {
  describe('createOutcomeTracker', () => {
    it('should create a new tracker', () => {
      const tracker = createOutcomeTracker('test-session');

      expect(tracker.sessionId).toBe('test-session');
      expect(tracker.outcomes).toEqual([]);
    });

    it('should initialize with empty outcomes', () => {
      const tracker = createOutcomeTracker('session');

      expect(Array.isArray(tracker.outcomes)).toBe(true);
      expect(tracker.outcomes.length).toBe(0);
    });
  });

  describe('addOutcome', () => {
    let tracker: OutcomeTracker;

    beforeEach(() => {
      tracker = createOutcomeTracker('test');
    });

    it('should add an outcome to tracker', () => {
      const updated = addOutcome(tracker, {
        id: 'tests',
        label: 'Tests passing',
        status: 'complete'
      });

      expect(updated.outcomes.length).toBe(1);
      expect(updated.outcomes[0].id).toBe('tests');
      expect(updated.outcomes[0].label).toBe('Tests passing');
      expect(updated.outcomes[0].status).toBe('complete');
    });

    it('should set timestamp automatically', () => {
      const before = Date.now();
      const updated = addOutcome(tracker, {
        id: 'build',
        label: 'Build complete',
        status: 'complete'
      });
      const after = Date.now();

      const timestamp = updated.outcomes[0].timestamp.getTime();
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should preserve existing outcomes', () => {
      let updated = addOutcome(tracker, {
        id: 'test1',
        label: 'Test 1',
        status: 'complete'
      });

      updated = addOutcome(updated, {
        id: 'test2',
        label: 'Test 2',
        status: 'pending'
      });

      expect(updated.outcomes.length).toBe(2);
      expect(updated.outcomes[0].id).toBe('test1');
      expect(updated.outcomes[1].id).toBe('test2');
    });

    it('should accept optional outcome properties', () => {
      const updated = addOutcome(tracker, {
        id: 'coverage',
        label: 'Code coverage',
        status: 'warning',
        message: 'Below threshold',
        details: ['Missing tests in auth.ts'],
        metric: { value: 75, unit: '%', threshold: 80 }
      });

      const outcome = updated.outcomes[0];
      expect(outcome.message).toBe('Below threshold');
      expect(outcome.details).toEqual(['Missing tests in auth.ts']);
      expect(outcome.metric).toEqual({ value: 75, unit: '%', threshold: 80 });
    });

    it('should be immutable', () => {
      const original = tracker.outcomes.length;
      addOutcome(tracker, {
        id: 'test',
        label: 'Test',
        status: 'pending'
      });

      expect(tracker.outcomes.length).toBe(original);
    });
  });

  describe('updateOutcome', () => {
    let tracker: OutcomeTracker;

    beforeEach(() => {
      tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, {
        id: 'tests',
        label: 'Tests running',
        status: 'in_progress'
      });
    });

    it('should update existing outcome', () => {
      const updated = updateOutcome(tracker, 'tests', {
        status: 'complete',
        message: 'All tests passed'
      });

      expect(updated.outcomes[0].status).toBe('complete');
      expect(updated.outcomes[0].message).toBe('All tests passed');
    });

    it('should update timestamp', () => {
      const originalTimestamp = tracker.outcomes[0].timestamp;

      // Wait a bit to ensure timestamp changes
      const updated = updateOutcome(tracker, 'tests', {
        status: 'complete'
      });

      expect(updated.outcomes[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        originalTimestamp.getTime()
      );
    });

    it('should preserve other outcomes', () => {
      tracker = addOutcome(tracker, {
        id: 'build',
        label: 'Build',
        status: 'pending'
      });

      const updated = updateOutcome(tracker, 'tests', {
        status: 'complete'
      });

      expect(updated.outcomes.length).toBe(2);
      expect(updated.outcomes[1].id).toBe('build');
      expect(updated.outcomes[1].status).toBe('pending');
    });

    it('should handle non-existent outcome ID', () => {
      const updated = updateOutcome(tracker, 'nonexistent', {
        status: 'complete'
      });

      // Should not crash, original outcome unchanged
      expect(updated.outcomes[0].id).toBe('tests');
      expect(updated.outcomes[0].status).toBe('in_progress');
    });

    it('should support partial updates', () => {
      const updated = updateOutcome(tracker, 'tests', {
        message: 'Progress update'
      });

      expect(updated.outcomes[0].status).toBe('in_progress'); // Unchanged
      expect(updated.outcomes[0].message).toBe('Progress update'); // Updated
    });
  });

  describe('detectOutcomeFromCommand', () => {
    it('should detect successful test run', () => {
      const outcome = detectOutcomeFromCommand(
        'test',
        'Tests: 47 passed, 47 total',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('tests');
      expect(outcome!.status).toBe('complete');
      expect(outcome!.metric?.value).toBe(47);
    });

    it('should detect failed tests', () => {
      const outcome = detectOutcomeFromCommand(
        'test',
        'Tests: 3 failed, 50 total',
        1
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('tests');
      expect(outcome!.status).toBe('error');
      expect(outcome!.message).toContain('3 tests failed');
    });

    it('should detect successful build', () => {
      const outcome = detectOutcomeFromCommand(
        'build',
        'Build completed successfully',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('build');
      expect(outcome!.status).toBe('complete');
    });

    it('should detect failed build', () => {
      const outcome = detectOutcomeFromCommand(
        'build',
        'Build failed with errors',
        1
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('build');
      expect(outcome!.status).toBe('error');
    });

    it('should detect lint success', () => {
      const outcome = detectOutcomeFromCommand(
        'lint',
        'No linting errors found',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('lint');
      expect(outcome!.status).toBe('complete');
    });

    it('should detect lint warnings', () => {
      const outcome = detectOutcomeFromCommand(
        'lint',
        'Found 5 warnings',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('lint');
      expect(outcome!.status).toBe('warning');
      expect(outcome!.metric?.value).toBe(5);
    });

    it('should detect lint errors', () => {
      const outcome = detectOutcomeFromCommand(
        'lint',
        'Found 3 errors',
        1
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('lint');
      expect(outcome!.status).toBe('error');
    });

    it('should detect coverage metrics', () => {
      const outcome = detectOutcomeFromCommand(
        'coverage',
        'All files      |   85.5 | 80.2 | 90.1 | 85.5 |',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.id).toBe('coverage');
      expect(outcome!.metric?.value).toBeCloseTo(85.5);
      expect(outcome!.metric?.unit).toBe('%');
    });

    it('should detect below threshold coverage', () => {
      const outcome = detectOutcomeFromCommand(
        'coverage',
        'All files      |   65.0 | 60.0 | 70.0 | 65.0 |',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.status).toBe('warning');
      expect(outcome!.message).toContain('Below');
    });

    it('should return null for unrecognized commands', () => {
      const outcome = detectOutcomeFromCommand(
        'random-command',
        'Some output',
        0
      );

      expect(outcome).toBeNull();
    });

    it('should handle Jest output format', () => {
      const outcome = detectOutcomeFromCommand(
        'jest',
        'Test Suites: 12 passed, 12 total\nTests: 47 passed, 47 total',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.status).toBe('complete');
    });

    it('should handle Vitest output format', () => {
      const outcome = detectOutcomeFromCommand(
        'vitest',
        ' ✓ src/app.test.ts (10)\n   ✓ test case 1\n\nTest Files  1 passed (1)\nTests  10 passed (10)',
        0
      );

      expect(outcome).not.toBeNull();
      expect(outcome!.status).toBe('complete');
    });
  });

  describe('renderOutcomeTracker', () => {
    let tracker: OutcomeTracker;

    beforeEach(() => {
      tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, {
        id: 'tests',
        label: 'Tests passing',
        status: 'complete',
        metric: { value: 47, unit: ' tests' }
      });
      tracker = addOutcome(tracker, {
        id: 'coverage',
        label: 'Code coverage',
        status: 'warning',
        message: 'Below threshold',
        metric: { value: 75, unit: '%', threshold: 80 }
      });
    });

    it('should render outcome tracker', () => {
      const result = renderOutcomeTracker(tracker);

      expect(result).toContain('Task Progress');
      expect(result).toContain('Tests passing');
      expect(result).toContain('Code coverage');
    });

    it('should show status icons', () => {
      const result = renderOutcomeTracker(tracker);

      expect(result).toContain('✓'); // Complete
      expect(result).toContain('⚠'); // Warning
    });

    it('should show metrics', () => {
      const result = renderOutcomeTracker(tracker);

      expect(result).toContain('47 tests');
      expect(result).toContain('75%');
    });

    it('should show messages', () => {
      const result = renderOutcomeTracker(tracker);

      expect(result).toContain('Below threshold');
    });

    it('should show details when enabled', () => {
      tracker = updateOutcome(tracker, 'coverage', {
        details: ['Missing tests in auth.ts', 'Missing tests in db.ts']
      });

      const result = renderOutcomeTracker(tracker, { showDetails: true });

      expect(result).toContain('auth.ts');
      expect(result).toContain('db.ts');
    });

    it('should hide details when disabled', () => {
      tracker = updateOutcome(tracker, 'coverage', {
        details: ['Missing tests in auth.ts']
      });

      const result = renderOutcomeTracker(tracker, { showDetails: false });

      expect(result).not.toContain('auth.ts');
    });

    it('should support compact mode', () => {
      const full = renderOutcomeTracker(tracker, { compact: false });
      const compact = renderOutcomeTracker(tracker, { compact: true });

      expect(compact.length).toBeLessThan(full.length);
      expect(compact).not.toContain('Task Progress');
    });

    it('should return empty string for no outcomes', () => {
      const empty = createOutcomeTracker('empty');
      const result = renderOutcomeTracker(empty);

      expect(result).toBe('');
    });
  });

  describe('renderOutcomeStatusBar', () => {
    it('should render compact status bar', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task 1', status: 'complete' });
      tracker = addOutcome(tracker, { id: '2', label: 'Task 2', status: 'complete' });
      tracker = addOutcome(tracker, { id: '3', label: 'Task 3', status: 'warning' });
      tracker = addOutcome(tracker, { id: '4', label: 'Task 4', status: 'error' });

      const result = renderOutcomeStatusBar(tracker);

      expect(result).toContain('✓ 2'); // 2 complete
      expect(result).toContain('⚠ 1'); // 1 warning
      expect(result).toContain('✗ 1'); // 1 error
      expect(result).toContain('/ 4'); // Total 4
    });

    it('should handle all pending outcomes', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task 1', status: 'pending' });
      tracker = addOutcome(tracker, { id: '2', label: 'Task 2', status: 'pending' });

      const result = renderOutcomeStatusBar(tracker);

      expect(result).toMatch(/2 tasks pending/);
    });

    it('should be concise', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task', status: 'complete' });

      const result = renderOutcomeStatusBar(tracker);

      expect(result.length).toBeLessThan(50);
    });
  });

  describe('getOutcomeProgress', () => {
    it('should calculate progress percentage', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task 1', status: 'complete' });
      tracker = addOutcome(tracker, { id: '2', label: 'Task 2', status: 'complete' });
      tracker = addOutcome(tracker, { id: '3', label: 'Task 3', status: 'pending' });
      tracker = addOutcome(tracker, { id: '4', label: 'Task 4', status: 'pending' });

      const progress = getOutcomeProgress(tracker);

      expect(progress.percentage).toBe(50); // 2/4 = 50%
      expect(progress.complete).toBe(2);
      expect(progress.total).toBe(4);
    });

    it('should handle 100% completion', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task 1', status: 'complete' });
      tracker = addOutcome(tracker, { id: '2', label: 'Task 2', status: 'complete' });

      const progress = getOutcomeProgress(tracker);

      expect(progress.percentage).toBe(100);
    });

    it('should handle 0% completion', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task 1', status: 'pending' });

      const progress = getOutcomeProgress(tracker);

      expect(progress.percentage).toBe(0);
    });

    it('should handle empty tracker', () => {
      const tracker = createOutcomeTracker('test');
      const progress = getOutcomeProgress(tracker);

      expect(progress.percentage).toBe(0);
      expect(progress.complete).toBe(0);
      expect(progress.total).toBe(0);
    });
  });

  describe('renderProgressBar', () => {
    it('should render progress bar', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task 1', status: 'complete' });
      tracker = addOutcome(tracker, { id: '2', label: 'Task 2', status: 'pending' });

      const result = renderProgressBar(tracker);

      expect(result).toContain('█'); // Filled
      expect(result).toContain('░'); // Empty
      expect(result).toContain('1/2');
      expect(result).toContain('50%');
    });

    it('should respect width parameter', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task', status: 'complete' });

      const narrow = renderProgressBar(tracker, 10);
      const wide = renderProgressBar(tracker, 50);

      expect(wide.length).toBeGreaterThan(narrow.length);
    });

    it('should handle 100% completion', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: '1', label: 'Task', status: 'complete' });

      const result = renderProgressBar(tracker, 10);

      expect(result).toContain('█'.repeat(10));
      expect(result).not.toContain('░');
    });
  });

  describe('suggestNextActions', () => {
    it('should suggest running tests if pending', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: 'tests', label: 'Tests', status: 'pending' });

      const suggestions = suggestNextActions(tracker);

      expect(suggestions).toContainEqual(expect.stringMatching(/test/i));
    });

    it('should suggest build after tests complete', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: 'tests', label: 'Tests', status: 'complete' });
      tracker = addOutcome(tracker, { id: 'build', label: 'Build', status: 'pending' });

      const suggestions = suggestNextActions(tracker);

      expect(suggestions).toContainEqual(expect.stringMatching(/build/i));
    });

    it('should suggest review after build completes', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: 'build', label: 'Build', status: 'complete' });

      const suggestions = suggestNextActions(tracker);

      expect(suggestions.some(s => s.match(/review|commit/i))).toBe(true);
    });

    it('should return empty array if no suggestions', () => {
      const tracker = createOutcomeTracker('test');

      const suggestions = suggestNextActions(tracker);

      expect(suggestions).toEqual([]);
    });
  });

  describe('renderNextActions', () => {
    it('should render next action suggestions', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: 'tests', label: 'Tests', status: 'pending' });

      const result = renderNextActions(tracker);

      expect(result).toContain('Suggested Next Steps');
      expect(result).toMatch(/test/i);
    });

    it('should number suggestions', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, { id: 'tests', label: 'Tests', status: 'complete' });
      tracker = addOutcome(tracker, { id: 'build', label: 'Build', status: 'pending' });

      const result = renderNextActions(tracker);

      expect(result).toMatch(/1\./);
      expect(result).toMatch(/2\./);
    });

    it('should return empty string if no suggestions', () => {
      const tracker = createOutcomeTracker('test');

      const result = renderNextActions(tracker);

      expect(result).toBe('');
    });
  });

  describe('OUTCOME_PRESETS', () => {
    it('should have common outcome presets', () => {
      expect(OUTCOME_PRESETS.tests).toBeDefined();
      expect(OUTCOME_PRESETS.build).toBeDefined();
      expect(OUTCOME_PRESETS.lint).toBeDefined();
      expect(OUTCOME_PRESETS.coverage).toBeDefined();
      expect(OUTCOME_PRESETS.deploy).toBeDefined();
    });

    it('should have valid preset structure', () => {
      Object.values(OUTCOME_PRESETS).forEach(preset => {
        expect(preset.id).toBeTruthy();
        expect(preset.label).toBeTruthy();
        expect(preset.status).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long outcome labels', () => {
      let tracker = createOutcomeTracker('test');
      const longLabel = 'A'.repeat(200);
      tracker = addOutcome(tracker, {
        id: 'test',
        label: longLabel,
        status: 'pending'
      });

      const result = renderOutcomeTracker(tracker);
      expect(result).toBeTruthy();
    });

    it('should handle many outcomes', () => {
      let tracker = createOutcomeTracker('test');
      for (let i = 0; i < 50; i++) {
        tracker = addOutcome(tracker, {
          id: `task-${i}`,
          label: `Task ${i}`,
          status: 'pending'
        });
      }

      const result = renderOutcomeTracker(tracker);
      expect(result).toBeTruthy();
      expect(tracker.outcomes.length).toBe(50);
    });

    it('should handle outcome with no message', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, {
        id: 'test',
        label: 'Test',
        status: 'complete'
      });

      const result = renderOutcomeTracker(tracker);
      expect(result).toBeTruthy();
    });

    it('should handle outcome with very large metric', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, {
        id: 'tests',
        label: 'Tests',
        status: 'complete',
        metric: { value: 9999, unit: ' tests' }
      });

      const result = renderOutcomeTracker(tracker);
      expect(result).toContain('9999');
    });

    it('should handle fractional percentages', () => {
      let tracker = createOutcomeTracker('test');
      tracker = addOutcome(tracker, {
        id: 'coverage',
        label: 'Coverage',
        status: 'complete',
        metric: { value: 85.7, unit: '%' }
      });

      const result = renderOutcomeTracker(tracker);
      expect(result).toContain('85.7');
    });
  });
});
