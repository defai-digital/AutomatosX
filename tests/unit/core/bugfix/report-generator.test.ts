/**
 * Report Generator Tests
 *
 * @module tests/unit/core/bugfix/report-generator
 * @since v12.6.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  generateJsonOutput,
  generateMarkdownReport,
  writeReport,
  getDefaultReportPath,
  type BugfixJsonOutput
} from '../../../../src/core/bugfix/report-generator.js';
import type { BugfixResult, BugfixStats, BugfixConfig, BugFinding, FixAttempt } from '../../../../src/core/bugfix/types.js';
import { getVersion } from '../../../../src/shared/helpers/version.js';

describe('Report Generator', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `report-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createMockResult = (overrides?: Partial<BugfixResult>): BugfixResult => {
    const finding: BugFinding = {
      id: 'finding-1',
      file: 'src/test.ts',
      lineStart: 10,
      lineEnd: 15,
      type: 'timer_leak',
      severity: 'high',
      message: 'setInterval() without .unref() blocks process exit',
      context: 'const interval = setInterval(() => {}, 1000);',
      fixStrategy: 'add_unref',
      confidence: 0.9,
      detectionMethod: 'regex',
      detectedAt: new Date().toISOString()
    };

    const attempt: FixAttempt = {
      id: 'attempt-1',
      bugId: 'finding-1',
      attemptNumber: 1,
      strategy: 'add_unref',
      diff: '- const interval = setInterval(() => {}, 1000);\n+ const interval = setInterval(() => {}, 1000);\n+ interval.unref();',
      status: 'verified',
      attemptedAt: new Date().toISOString(),
      durationMs: 150
    };

    const config: BugfixConfig = {
      maxBugs: 10,
      maxDurationMinutes: 45,
      maxTokens: 500000,
      maxRetriesPerBug: 3,
      minConfidence: 0.7,
      bugTypes: ['timer_leak', 'missing_destroy'],
      severityThreshold: 'medium',
      excludePatterns: [],
      dryRun: false,
      requireTests: false,
      requireTypecheck: true,
      generateTests: false,
      verbose: false
    };

    const stats: BugfixStats = {
      bugsFound: 1,
      bugsFixed: 1,
      bugsFailed: 0,
      bugsSkipped: 0,
      totalAttempts: 1,
      successRate: 1,
      totalDurationMs: 1500,
      totalTokens: 0,
      patternsLearned: 1,
      regressions: 0,
      stopReason: 'complete',
      bugsByType: {
        timer_leak: 1,
        missing_destroy: 0,
        promise_timeout_leak: 0,
        event_leak: 0,
        resource_leak: 0,
        race_condition: 0,
        memory_leak: 0,
        uncaught_promise: 0,
        deprecated_api: 0,
        security_issue: 0,
        type_error: 0,
        test_failure: 0,
        custom: 0
      },
      bugsBySeverity: {
        critical: 0,
        high: 1,
        medium: 0,
        low: 0
      }
    };

    return {
      sessionId: 'session-123',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      config,
      findings: [finding],
      attempts: [attempt],
      stats,
      finalState: 'COMPLETE',
      ...overrides
    };
  };

  describe('generateJsonOutput', () => {
    it('should generate valid JSON structure', () => {
      const result = createMockResult();
      const json = generateJsonOutput(result);

      expect(json.version).toBe(getVersion());
      expect(json.timestamp).toBeDefined();
      expect(json.sessionId).toBe('session-123');
    });

    it('should include summary with correct values', () => {
      const result = createMockResult();
      const json = generateJsonOutput(result);

      expect(json.summary.bugsFound).toBe(1);
      expect(json.summary.bugsFixed).toBe(1);
      expect(json.summary.bugsFailed).toBe(0);
      expect(json.summary.bugsSkipped).toBe(0);
      expect(json.summary.successRate).toBe(1);
    });

    it('should include config', () => {
      const result = createMockResult();
      const json = generateJsonOutput(result);

      expect(json.config.maxBugs).toBe(10);
      expect(json.config.severityThreshold).toBe('medium');
      expect(json.config.dryRun).toBe(false);
    });

    it('should include findings with required fields', () => {
      const result = createMockResult();
      const json = generateJsonOutput(result);

      expect(json.findings.length).toBe(1);
      const finding = json.findings[0];
      expect(finding?.id).toBe('finding-1');
      expect(finding?.file).toBe('src/test.ts');
      expect(finding?.line).toBe(10);
      expect(finding?.type).toBe('timer_leak');
      expect(finding?.severity).toBe('high');
      expect(finding?.hasAutoFix).toBe(true);
    });

    it('should include fixed bugs', () => {
      const result = createMockResult();
      const json = generateJsonOutput(result);

      expect(json.fixed.length).toBe(1);
      expect(json.fixed[0]?.file).toBe('src/test.ts');
      expect(json.fixed[0]?.type).toBe('timer_leak');
    });

    it('should include failed bugs when present', () => {
      const result = createMockResult({
        attempts: [{
          id: 'attempt-1',
          bugId: 'finding-1',
          attemptNumber: 1,
          strategy: 'add_unref',
          diff: '',
          status: 'failed',
          error: 'Typecheck failed',
          attemptedAt: new Date().toISOString(),
          durationMs: 100
        }]
      });
      result.stats.bugsFixed = 0;
      result.stats.bugsFailed = 1;

      const json = generateJsonOutput(result);

      expect(json.failed.length).toBe(1);
      expect(json.failed[0]?.error).toBe('Typecheck failed');
    });

    it('should include skipped bugs when present', () => {
      const result = createMockResult({
        attempts: [{
          id: 'attempt-1',
          bugId: 'finding-1',
          attemptNumber: 1,
          strategy: 'manual_review',
          diff: '',
          status: 'skipped',
          error: 'No automatic fix available',
          attemptedAt: new Date().toISOString(),
          durationMs: 0
        }]
      });
      result.stats.bugsFixed = 0;
      result.stats.bugsSkipped = 1;

      const json = generateJsonOutput(result);

      expect(json.skipped.length).toBe(1);
      expect(json.skipped[0]?.reason).toBe('No automatic fix available');
    });
  });

  describe('generateMarkdownReport', () => {
    it('should generate valid markdown', () => {
      const result = createMockResult();
      const markdown = generateMarkdownReport(result);

      expect(markdown).toContain('# AutomatosX Bugfix Report');
      expect(markdown).toContain('**Session ID:**');
      expect(markdown).toContain('## Summary');
    });

    it('should include summary table', () => {
      const result = createMockResult();
      const markdown = generateMarkdownReport(result);

      expect(markdown).toContain('| Metric | Value |');
      expect(markdown).toContain('| Bugs Found | 1 |');
      expect(markdown).toContain('| Bugs Fixed | 1 |');
      expect(markdown).toContain('| Success Rate | 100.0% |');
    });

    it('should include bugs by severity', () => {
      const result = createMockResult();
      const markdown = generateMarkdownReport(result);

      expect(markdown).toContain('## Bugs by Severity');
      expect(markdown).toContain('**HIGH**: 1');
    });

    it('should include bugs by type', () => {
      const result = createMockResult();
      const markdown = generateMarkdownReport(result);

      expect(markdown).toContain('## Bugs by Type');
      expect(markdown).toContain('**Timer Leak**: 1');
    });

    // v12.9.1: Section renamed to Auto-Fixed Bugs with markers (PRD-021)
    it('should include auto-fixed bugs section with diff and markers', () => {
      const result = createMockResult();
      const markdown = generateMarkdownReport(result);

      expect(markdown).toContain('## Auto-Fixed Bugs');
      expect(markdown).toContain('✓ [AUTO]');
      expect(markdown).toContain('**Diff:**');
      expect(markdown).toContain('```diff');
    });

    it('should include footer', () => {
      const result = createMockResult();
      const markdown = generateMarkdownReport(result);

      expect(markdown).toContain(`*Generated by AutomatosX v${getVersion()}*`);
    });
  });

  describe('writeReport', () => {
    it('should write markdown report to file', async () => {
      const result = createMockResult();
      const reportPath = join(testDir, 'report.md');

      await writeReport(result, reportPath, 'markdown');

      const content = await readFile(reportPath, 'utf-8');
      expect(content).toContain('# AutomatosX Bugfix Report');
    });

    it('should write JSON report to file', async () => {
      const result = createMockResult();
      const reportPath = join(testDir, 'report.json');

      await writeReport(result, reportPath, 'json');

      const content = await readFile(reportPath, 'utf-8');
      const json = JSON.parse(content) as BugfixJsonOutput;
      expect(json.version).toBe(getVersion());
    });

    it('should create directory if it does not exist', async () => {
      const result = createMockResult();
      const reportPath = join(testDir, 'nested', 'dir', 'report.md');

      await writeReport(result, reportPath, 'markdown');

      const content = await readFile(reportPath, 'utf-8');
      expect(content).toContain('# AutomatosX Bugfix Report');
    });
  });

  describe('getDefaultReportPath', () => {
    it('should return path with markdown extension', () => {
      const path = getDefaultReportPath('/project', 'markdown');

      // Use platform-independent check (Windows uses \, Unix uses /)
      expect(path).toContain('.automatosx');
      expect(path).toContain('reports');
      expect(path).toContain('bugfix-');
      expect(path.endsWith('.md')).toBe(true);
    });

    it('should return path with json extension', () => {
      const path = getDefaultReportPath('/project', 'json');

      // Use platform-independent check (Windows uses \, Unix uses /)
      expect(path).toContain('.automatosx');
      expect(path).toContain('reports');
      expect(path).toContain('bugfix-');
      expect(path.endsWith('.json')).toBe(true);
    });

    it('should include timestamp in filename', () => {
      const path = getDefaultReportPath('/project', 'markdown');

      // Should match pattern like bugfix-2025-12-09T...
      expect(path).toMatch(/bugfix-\d{4}-\d{2}-\d{2}T/);
    });
  });

  /**
   * v12.9.0: LLM Triage output tests (PRD-020)
   */
  describe('LLM Triage Output (v12.9.0)', () => {
    const createTriageMetrics = () => ({
      findingsTotal: 10,
      findingsTriaged: 8,
      findingsAccepted: 5,
      findingsRejected: 3,
      findingsSkipped: 2,
      findingsFallback: 0,
      llmRequests: 3,
      llmTokensUsed: 1500,
      llmCostEstimateUsd: 0.0045,
      triageDurationMs: 2500
    });

    describe('generateJsonOutput with triage', () => {
      it('should include triage section when triageMetrics provided', () => {
        const result = createMockResult();
        const json = generateJsonOutput(result, {
          triageMetrics: createTriageMetrics(),
          triageProvider: 'claude'
        });

        expect(json.triage).toBeDefined();
        expect(json.triage?.enabled).toBe(true);
        expect(json.triage?.provider).toBe('claude');
      });

      it('should include all triage metrics fields', () => {
        const result = createMockResult();
        const triageMetrics = createTriageMetrics();
        const json = generateJsonOutput(result, {
          triageMetrics,
          triageProvider: 'gemini'
        });

        expect(json.triage?.findingsTriaged).toBe(8);
        expect(json.triage?.findingsAccepted).toBe(5);
        expect(json.triage?.findingsRejected).toBe(3);
        expect(json.triage?.findingsSkipped).toBe(2);
        expect(json.triage?.findingsFallback).toBe(0);
        expect(json.triage?.llmRequests).toBe(3);
        expect(json.triage?.llmTokensUsed).toBe(1500);
        expect(json.triage?.llmCostEstimateUsd).toBe(0.0045);
        expect(json.triage?.durationMs).toBe(2500);
      });

      it('should not include triage section when no triageMetrics', () => {
        const result = createMockResult();
        const json = generateJsonOutput(result);

        expect(json.triage).toBeUndefined();
      });

      it('should use default provider when not specified', () => {
        const result = createMockResult();
        const json = generateJsonOutput(result, {
          triageMetrics: createTriageMetrics()
        });

        expect(json.triage?.provider).toBe('claude');
      });

      it('should include triage summary fields when originalFindingsCount provided', () => {
        const result = createMockResult();
        const json = generateJsonOutput(result, {
          triageMetrics: createTriageMetrics(),
          originalFindingsCount: 10
        });

        expect(json.summary.bugsAfterTriage).toBeDefined();
        expect(json.summary.triageFiltered).toBe(3);
      });
    });

    describe('generateMarkdownReport with triage', () => {
      it('should include LLM Triage section when triageMetrics provided', () => {
        const result = createMockResult();
        const markdown = generateMarkdownReport(result, {
          triageMetrics: createTriageMetrics(),
          triageProvider: 'claude'
        });

        expect(markdown).toContain('## LLM Triage');
        expect(markdown).toContain('LLM triage was used to filter false positives');
      });

      it('should include triage metrics table', () => {
        const result = createMockResult();
        const markdown = generateMarkdownReport(result, {
          triageMetrics: createTriageMetrics(),
          triageProvider: 'gemini'
        });

        expect(markdown).toContain('| Provider | gemini |');
        expect(markdown).toContain('| Findings Scanned | 10 |');
        expect(markdown).toContain('| Sent to LLM | 8 |');
        expect(markdown).toContain('| Accepted (Real Bugs) | 5 |');
        expect(markdown).toContain('| Rejected (False Positives) | 3 |');
        expect(markdown).toContain('| Skipped (High Confidence) | 2 |');
      });

      it('should include LLM cost and token info', () => {
        const result = createMockResult();
        const markdown = generateMarkdownReport(result, {
          triageMetrics: createTriageMetrics(),
          triageProvider: 'claude'
        });

        expect(markdown).toContain('| LLM Requests | 3 |');
        expect(markdown).toContain('| Tokens Used | 1500 |');
        expect(markdown).toContain('| Estimated Cost | $0.0045 |');
      });

      it('should include filter rate calculation', () => {
        const result = createMockResult();
        const markdown = generateMarkdownReport(result, {
          triageMetrics: createTriageMetrics(),
          triageProvider: 'claude'
        });

        // 3 rejected / 8 triaged = 37.5%
        expect(markdown).toContain('37.5%');
        expect(markdown).toContain('false positives');
      });

      it('should include fallback count when present', () => {
        const result = createMockResult();
        const triageMetrics = createTriageMetrics();
        triageMetrics.findingsFallback = 2;

        const markdown = generateMarkdownReport(result, {
          triageMetrics,
          triageProvider: 'claude'
        });

        expect(markdown).toContain('| Fallback (LLM Unavailable) | 2 |');
      });

      it('should not include fallback row when zero', () => {
        const result = createMockResult();
        const markdown = generateMarkdownReport(result, {
          triageMetrics: createTriageMetrics(),
          triageProvider: 'claude'
        });

        expect(markdown).not.toContain('Fallback (LLM Unavailable)');
      });

      it('should not include LLM Triage section when no triageMetrics', () => {
        const result = createMockResult();
        const markdown = generateMarkdownReport(result);

        expect(markdown).not.toContain('## LLM Triage');
      });
    });
  });
});
