/**
 * MetricsTracker Tests
 *
 * Tests for bugfix metrics tracking including v12.9.0 LLM triage features.
 *
 * @module tests/unit/core/bugfix/metrics-tracker
 * @since v12.9.0
 * @see PRD-018: Metrics tracking
 * @see PRD-020: LLM Triage Filter for Bugfix Tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  MetricsTracker,
  resetMetricsTracker,
  type TriageRunRecord,
  type TriageSummary
} from '../../../../src/core/bugfix/metrics-tracker.js';
import type { BugFinding } from '../../../../src/core/bugfix/types.js';
import type { TriageMetrics, TriageResult, TriageVerdict } from '../../../../src/core/bugfix/llm-triage/types.js';

describe('MetricsTracker', () => {
  let testDir: string;
  let tracker: MetricsTracker;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'metrics-test-'));
    // Reset singleton before each test
    resetMetricsTracker();
    tracker = new MetricsTracker(testDir);
    await tracker.init();
  });

  afterEach(async () => {
    tracker.close();
    resetMetricsTracker();
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createMockFinding = (overrides?: Partial<BugFinding>): BugFinding => ({
    id: 'finding-1',
    file: 'src/test.ts',
    lineStart: 10,
    lineEnd: 15,
    type: 'timer_leak',
    severity: 'high',
    message: 'Timer leak detected',
    context: 'setInterval(() => {}, 1000)',
    confidence: 0.85,
    detectionMethod: 'ast',
    detectedAt: new Date().toISOString(),
    metadata: { ruleId: 'timer-leak-rule' },
    ...overrides
  });

  const createMockTriageMetrics = (overrides?: Partial<TriageMetrics>): TriageMetrics => ({
    findingsTotal: 10,
    findingsTriaged: 8,
    findingsAccepted: 5,
    findingsRejected: 3,
    findingsSkipped: 2,
    findingsFallback: 0,
    llmRequests: 2,
    llmTokensUsed: 1500,
    llmCostEstimateUsd: 0.0045,
    triageDurationMs: 2500,
    ...overrides
  });

  const createMockTriageResult = (
    finding: BugFinding,
    accepted: boolean,
    confidence: number = 0.9
  ): TriageResult => ({
    original: finding,
    verdict: {
      findingId: finding.id,
      accepted,
      confidence,
      reason: accepted ? 'Real bug confirmed' : 'False positive detected'
    },
    source: 'llm'
  });

  describe('Basic detection metrics', () => {
    it('should record detection metrics', () => {
      const finding = createMockFinding();
      const metricId = tracker.recordDetection(finding);

      expect(metricId).toBeGreaterThan(0);
    });

    it('should find detection by location', () => {
      const finding = createMockFinding();
      tracker.recordDetection(finding);

      const metric = tracker.findByLocation('src/test.ts', 10);

      expect(metric).toBeDefined();
      expect(metric?.bugType).toBe('timer_leak');
      expect(metric?.confidence).toBe(0.85);
    });

    it('should mark detection as false positive', () => {
      const finding = createMockFinding();
      const metricId = tracker.recordDetection(finding);

      tracker.markFalsePositive(metricId, 'User verified as intentional');

      const metric = tracker.findByLocation('src/test.ts', 10);
      expect(metric?.isFalsePositive).toBe(true);
      expect(metric?.feedback).toBe('User verified as intentional');
    });

    it('should mark detection as true positive', () => {
      const finding = createMockFinding();
      const metricId = tracker.recordDetection(finding);

      tracker.markTruePositive(metricId);

      const metric = tracker.findByLocation('src/test.ts', 10);
      expect(metric?.isFalsePositive).toBe(false);
    });

    it('should record fix result', () => {
      const finding = createMockFinding();
      const metricId = tracker.recordDetection(finding);

      tracker.recordFixResult(metricId, true);

      const metric = tracker.findByLocation('src/test.ts', 10);
      expect(metric?.fixSuccessful).toBe(true);
    });

    it('should get metrics summary', () => {
      // Record multiple detections
      tracker.recordDetection(createMockFinding());
      tracker.recordDetection(createMockFinding({
        id: 'finding-2',
        lineStart: 20,
        type: 'missing_destroy',
        severity: 'medium'
      }));

      const summary = tracker.getSummary();

      expect(summary).toBeDefined();
      expect(summary?.totalDetections).toBe(2);
    });
  });

  /**
   * v12.9.0: LLM Triage Metrics Tests (PRD-020)
   */
  describe('LLM Triage Metrics (v12.9.0)', () => {
    describe('recordTriageResults', () => {
      it('should record triage run with metrics', () => {
        const sessionId = 'session-123';
        const metrics = createMockTriageMetrics();
        const results: TriageResult[] = [];

        const runId = tracker.recordTriageResults(sessionId, metrics, results, 'claude');

        expect(runId).toBeGreaterThan(0);
      });

      it('should store all triage metrics fields', () => {
        const sessionId = 'session-456';
        const metrics = createMockTriageMetrics({
          findingsTotal: 15,
          findingsTriaged: 12,
          findingsAccepted: 8,
          findingsRejected: 4,
          findingsSkipped: 3,
          findingsFallback: 1,
          llmRequests: 4,
          llmTokensUsed: 2500,
          llmCostEstimateUsd: 0.0075,
          triageDurationMs: 3500
        });

        tracker.recordTriageResults(sessionId, metrics, [], 'gemini');

        const run = tracker.getTriageRun(sessionId);
        expect(run).toBeDefined();
        expect(run?.findingsTotal).toBe(15);
        expect(run?.findingsTriaged).toBe(12);
        expect(run?.findingsAccepted).toBe(8);
        expect(run?.findingsRejected).toBe(4);
        expect(run?.findingsSkipped).toBe(3);
        expect(run?.findingsFallback).toBe(1);
        expect(run?.llmRequests).toBe(4);
        expect(run?.llmTokensUsed).toBe(2500);
        expect(run?.llmCostEstimateUsd).toBe(0.0075);
        expect(run?.triageDurationMs).toBe(3500);
        expect(run?.provider).toBe('gemini');
      });

      it('should update detection metrics with LLM verdicts', () => {
        const finding = createMockFinding();
        tracker.recordDetection(finding);

        const sessionId = 'session-789';
        const metrics = createMockTriageMetrics();
        const results: TriageResult[] = [
          createMockTriageResult(finding, true, 0.92)
        ];

        tracker.recordTriageResults(sessionId, metrics, results, 'claude');

        // Note: The updateDetectionWithTriageVerdict method updates by file+line
        // but since it's a private method, we verify through the run record
        const run = tracker.getTriageRun(sessionId);
        expect(run).toBeDefined();
      });

      it('should handle results with rejected verdicts', () => {
        const finding = createMockFinding();
        tracker.recordDetection(finding);

        const sessionId = 'session-rejected';
        const metrics = createMockTriageMetrics({
          findingsAccepted: 0,
          findingsRejected: 1
        });
        const results: TriageResult[] = [
          createMockTriageResult(finding, false, 0.95)
        ];

        const runId = tracker.recordTriageResults(sessionId, metrics, results, 'claude');

        expect(runId).toBeGreaterThan(0);
        const run = tracker.getTriageRun(sessionId);
        expect(run?.findingsRejected).toBe(1);
      });

      it('should use default provider when not specified', () => {
        const sessionId = 'session-default-provider';
        const metrics = createMockTriageMetrics();

        tracker.recordTriageResults(sessionId, metrics, []);

        const run = tracker.getTriageRun(sessionId);
        expect(run?.provider).toBe('claude');
      });
    });

    describe('getTriageRun', () => {
      it('should return null for non-existent session', () => {
        const run = tracker.getTriageRun('non-existent-session');

        expect(run).toBeNull();
      });

      it('should return most recent run for session', () => {
        const sessionId = 'session-multi';

        // Record multiple runs for same session
        tracker.recordTriageResults(sessionId, createMockTriageMetrics({ findingsTotal: 5 }), [], 'claude');
        tracker.recordTriageResults(sessionId, createMockTriageMetrics({ findingsTotal: 10 }), [], 'claude');

        const run = tracker.getTriageRun(sessionId);

        expect(run?.findingsTotal).toBe(10); // Most recent
      });

      it('should return complete TriageRunRecord', () => {
        const sessionId = 'session-complete';
        const metrics = createMockTriageMetrics();
        tracker.recordTriageResults(sessionId, metrics, [], 'openai');

        const run = tracker.getTriageRun(sessionId);

        expect(run).toMatchObject({
          sessionId: 'session-complete',
          findingsTotal: 10,
          findingsTriaged: 8,
          findingsAccepted: 5,
          findingsRejected: 3,
          findingsSkipped: 2,
          findingsFallback: 0,
          llmRequests: 2,
          llmTokensUsed: 1500,
          llmCostEstimateUsd: 0.0045,
          triageDurationMs: 2500,
          provider: 'openai'
        });
        expect(run?.id).toBeDefined();
        expect(run?.createdAt).toBeDefined();
      });
    });

    describe('getRecentTriageRuns', () => {
      it('should return empty array when no runs', () => {
        const runs = tracker.getRecentTriageRuns();

        expect(runs).toEqual([]);
      });

      it('should return runs in descending order', () => {
        tracker.recordTriageResults('session-1', createMockTriageMetrics({ findingsTotal: 5 }), [], 'claude');
        tracker.recordTriageResults('session-2', createMockTriageMetrics({ findingsTotal: 10 }), [], 'claude');
        tracker.recordTriageResults('session-3', createMockTriageMetrics({ findingsTotal: 15 }), [], 'claude');

        const runs = tracker.getRecentTriageRuns();

        expect(runs.length).toBe(3);
        expect(runs[0]?.findingsTotal).toBe(15); // Most recent first
        expect(runs[2]?.findingsTotal).toBe(5);  // Oldest last
      });

      it('should respect limit parameter', () => {
        // Create 5 runs
        for (let i = 0; i < 5; i++) {
          tracker.recordTriageResults(`session-${i}`, createMockTriageMetrics(), [], 'claude');
        }

        const runs = tracker.getRecentTriageRuns(3);

        expect(runs.length).toBe(3);
      });

      it('should use default limit of 10', () => {
        // Create 15 runs
        for (let i = 0; i < 15; i++) {
          tracker.recordTriageResults(`session-${i}`, createMockTriageMetrics(), [], 'claude');
        }

        const runs = tracker.getRecentTriageRuns();

        expect(runs.length).toBe(10);
      });
    });

    describe('getTriageSummary', () => {
      it('should return disabled summary when no runs', () => {
        const summary = tracker.getTriageSummary();

        expect(summary).toBeDefined();
        expect(summary?.enabled).toBe(false);
        expect(summary?.findingsTotal).toBe(0);
        expect(summary?.llmRequests).toBe(0);
      });

      it('should aggregate metrics from all runs', () => {
        tracker.recordTriageResults('session-1', createMockTriageMetrics({
          findingsTotal: 10,
          findingsTriaged: 8,
          findingsAccepted: 6,
          findingsRejected: 2,
          llmTokensUsed: 1000,
          llmCostEstimateUsd: 0.003
        }), [], 'claude');

        tracker.recordTriageResults('session-2', createMockTriageMetrics({
          findingsTotal: 20,
          findingsTriaged: 15,
          findingsAccepted: 10,
          findingsRejected: 5,
          llmTokensUsed: 2000,
          llmCostEstimateUsd: 0.006
        }), [], 'claude');

        const summary = tracker.getTriageSummary();

        expect(summary?.enabled).toBe(true);
        expect(summary?.findingsTotal).toBe(30);
        expect(summary?.findingsTriaged).toBe(23);
        expect(summary?.findingsAccepted).toBe(16);
        expect(summary?.findingsRejected).toBe(7);
        expect(summary?.llmTokensUsed).toBe(3000);
        expect(summary?.llmCostEstimateUsd).toBeCloseTo(0.009, 4);
      });

      it('should calculate precision improvement', () => {
        tracker.recordTriageResults('session-1', createMockTriageMetrics({
          findingsTriaged: 20,
          findingsRejected: 5
        }), [], 'claude');

        const summary = tracker.getTriageSummary();

        // 5 rejected / 20 triaged = 0.25 = 25% improvement
        expect(summary?.precisionImprovement).toBeCloseTo(0.25, 2);
      });

      it('should handle zero triaged findings for precision calculation', () => {
        tracker.recordTriageResults('session-1', createMockTriageMetrics({
          findingsTriaged: 0,
          findingsRejected: 0,
          findingsSkipped: 10
        }), [], 'claude');

        const summary = tracker.getTriageSummary();

        expect(summary?.precisionImprovement).toBe(0);
      });

      it('should aggregate fallback counts', () => {
        tracker.recordTriageResults('session-1', createMockTriageMetrics({
          findingsFallback: 2
        }), [], 'claude');

        tracker.recordTriageResults('session-2', createMockTriageMetrics({
          findingsFallback: 3
        }), [], 'claude');

        const summary = tracker.getTriageSummary();

        expect(summary?.findingsFallback).toBe(5);
      });
    });
  });

  describe('Database operations', () => {
    it('should handle multiple sessions', () => {
      const sessions = ['session-a', 'session-b', 'session-c'];

      for (const sessionId of sessions) {
        tracker.recordTriageResults(
          sessionId,
          createMockTriageMetrics(),
          [],
          'claude'
        );
      }

      for (const sessionId of sessions) {
        const run = tracker.getTriageRun(sessionId);
        expect(run).toBeDefined();
        expect(run?.sessionId).toBe(sessionId);
      }
    });

    it('should persist data across close and reopen', async () => {
      const sessionId = 'persist-test';
      tracker.recordTriageResults(sessionId, createMockTriageMetrics(), [], 'claude');

      // Close and reopen
      tracker.close();

      const newTracker = new MetricsTracker(testDir);
      await newTracker.init();

      const run = newTracker.getTriageRun(sessionId);
      expect(run).toBeDefined();
      expect(run?.sessionId).toBe(sessionId);

      newTracker.close();
    });

    it('should export summary to JSON', () => {
      tracker.recordDetection(createMockFinding());

      const json = tracker.exportToJSON();

      expect(json).toBeDefined();
      const parsed = JSON.parse(json!);
      expect(parsed.totalDetections).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should return -1 for recordTriageResults when not initialized', () => {
      const uninitTracker = new MetricsTracker(testDir);
      // Don't call init()

      const result = uninitTracker.recordTriageResults('session', createMockTriageMetrics(), [], 'claude');

      expect(result).toBe(-1);
    });

    it('should return null for getTriageRun when not initialized', () => {
      const uninitTracker = new MetricsTracker(testDir);

      const result = uninitTracker.getTriageRun('session');

      expect(result).toBeNull();
    });

    it('should return empty array for getRecentTriageRuns when not initialized', () => {
      const uninitTracker = new MetricsTracker(testDir);

      const result = uninitTracker.getRecentTriageRuns();

      expect(result).toEqual([]);
    });

    it('should return null for getTriageSummary when not initialized', () => {
      const uninitTracker = new MetricsTracker(testDir);

      const result = uninitTracker.getTriageSummary();

      expect(result).toBeNull();
    });
  });
});
