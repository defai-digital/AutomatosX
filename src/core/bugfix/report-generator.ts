/**
 * Report Generator for Bugfix
 *
 * Generates markdown and JSON reports for bugfix sessions.
 *
 * @module core/bugfix/report-generator
 * @since v12.6.0
 * @updated v12.9.0 - Added triage section (PRD-020)
 */

import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { mkdir } from 'fs/promises';
import { getVersion } from '../../shared/helpers/version.js';
import { logger } from '../../shared/logging/logger.js';
import type {
  BugfixResult,
  BugType,
  BugSeverity
} from './types.js';
import type { TriageMetrics } from './llm-triage/types.js';

/**
 * JSON output format for CLI
 */
export interface BugfixJsonOutput {
  version: string;
  timestamp: string;
  sessionId: string;
  summary: {
    bugsFound: number;
    bugsFixed: number;
    bugsFailed: number;
    bugsSkipped: number;
    /** v12.9.1: Number of bugs that were automatically fixed (PRD-021) */
    autoFixed: number;
    /** v12.9.1: Number of bugs requiring manual review (PRD-021) */
    manualReview: number;
    successRate: number;
    durationMs: number;
    /** v12.9.0: Bugs remaining after triage (PRD-020) */
    bugsAfterTriage?: number;
    /** v12.9.0: Bugs filtered by triage (PRD-020) */
    triageFiltered?: number;
  };
  config: {
    maxBugs: number;
    severityThreshold: string;
    dryRun: boolean;
    scope?: string;
  };
  /**
   * v12.9.0: LLM Triage section (PRD-020)
   *
   * Present when LLM triage was enabled for the session.
   */
  triage?: {
    enabled: boolean;
    provider: string;
    findingsTriaged: number;
    findingsAccepted: number;
    findingsRejected: number;
    findingsSkipped: number;
    findingsFallback: number;
    llmRequests: number;
    llmTokensUsed: number;
    llmCostEstimateUsd: number;
    durationMs: number;
  };
  findings: Array<{
    id: string;
    file: string;
    line: number;
    type: string;
    severity: string;
    message: string;
    confidence: number;
    hasAutoFix: boolean;
    /** v12.9.0: LLM triage verdict (PRD-020) */
    triageVerdict?: {
      accepted: boolean;
      confidence: number;
      reason?: string;
    };
  }>;
  /** v12.9.1: Auto-fixed bugs with autoFixed marker (PRD-021) */
  fixed: Array<{
    file: string;
    line: number;
    type: string;
    message: string;
    /** v12.9.1: Always true for fixed bugs (PRD-021) */
    autoFixed: boolean;
  }>;
  failed: Array<{
    file: string;
    line: number;
    type: string;
    error?: string;
    /** v12.9.1: Always false for failed bugs (PRD-021) */
    autoFixed: boolean;
  }>;
  /** v12.9.1: Renamed from skipped to manualReview (PRD-021) */
  skipped: Array<{
    file: string;
    line: number;
    type: string;
    reason?: string;
    /** v12.9.1: Always false for manual review bugs (PRD-021) */
    autoFixed: boolean;
  }>;
  /** v12.9.1: Alias for skipped (PRD-021) */
  manualReview: Array<{
    file: string;
    line: number;
    type: string;
    reason?: string;
    autoFixed: boolean;
  }>;
}

/**
 * Options for generating JSON output (v12.9.0)
 */
export interface JsonOutputOptions {
  /** Triage metrics from the session */
  triageMetrics?: TriageMetrics;
  /** Provider used for triage */
  triageProvider?: string;
  /** Original findings count before triage */
  originalFindingsCount?: number;
}

/**
 * Generate JSON output for CLI
 *
 * @param result - Bugfix result from controller
 * @param options - Additional options including triage metrics (v12.9.0)
 */
export function generateJsonOutput(
  result: BugfixResult,
  options: JsonOutputOptions = {}
): BugfixJsonOutput {
  const fixed = result.attempts.filter(a => a.status === 'verified');
  const failed = result.attempts.filter(a => a.status === 'failed');
  const skipped = result.attempts.filter(a => a.status === 'skipped');

  // Map attempts to findings
  const findingMap = new Map(result.findings.map(f => [f.id, f]));

  // v12.9.1: Build summary with autoFixed and manualReview counts (PRD-021)
  const summary: BugfixJsonOutput['summary'] = {
    bugsFound: result.stats.bugsFound,
    bugsFixed: result.stats.bugsFixed,
    bugsFailed: result.stats.bugsFailed,
    bugsSkipped: result.stats.bugsSkipped,
    autoFixed: result.stats.bugsFixed, // All verified fixes are auto-fixed
    manualReview: result.stats.bugsSkipped, // All skipped bugs need manual review
    successRate: result.stats.successRate,
    durationMs: result.stats.totalDurationMs
  };

  // v12.9.0: Add triage summary fields if triage was used (PRD-020)
  if (options.triageMetrics && options.originalFindingsCount !== undefined) {
    const triageFiltered = options.triageMetrics.findingsRejected;
    summary.bugsAfterTriage = result.stats.bugsFound;
    summary.triageFiltered = triageFiltered;
  }

  // Build output
  const output: BugfixJsonOutput = {
    version: getVersion(),
    timestamp: new Date().toISOString(),
    sessionId: result.sessionId,
    summary,
    config: {
      maxBugs: result.config.maxBugs,
      severityThreshold: result.config.severityThreshold,
      dryRun: result.config.dryRun,
      scope: result.config.scope
    },
    findings: result.findings.map(f => ({
      id: f.id,
      file: f.file,
      line: f.lineStart,
      type: f.type,
      severity: f.severity,
      message: f.message,
      confidence: f.confidence,
      hasAutoFix: !!f.fixStrategy
    })),
    // v12.9.1: Add autoFixed field to fixed bugs (PRD-021)
    fixed: fixed.map(a => {
      const finding = findingMap.get(a.bugId);
      if (!finding) {
        logger.warn('Data inconsistency: fix attempt references non-existent finding', {
          bugId: a.bugId,
          attemptId: a.id
        });
      }
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'unknown',
        message: finding?.message || '',
        autoFixed: true // All verified fixes are auto-fixed
      };
    }),
    // v12.9.1: Add autoFixed field to failed bugs (PRD-021)
    failed: failed.map(a => {
      const finding = findingMap.get(a.bugId);
      if (!finding) {
        logger.warn('Data inconsistency: failed attempt references non-existent finding', {
          bugId: a.bugId,
          attemptId: a.id
        });
      }
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'unknown',
        error: a.error,
        autoFixed: false // Failed fixes are not auto-fixed
      };
    }),
    // v12.9.1: Add autoFixed field to skipped bugs (PRD-021)
    skipped: skipped.map(a => {
      const finding = findingMap.get(a.bugId);
      if (!finding) {
        logger.warn('Data inconsistency: skipped attempt references non-existent finding', {
          bugId: a.bugId,
          attemptId: a.id
        });
      }
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'unknown',
        reason: a.error || 'No automatic fix available',
        autoFixed: false // Skipped bugs need manual review
      };
    }),
    // v12.9.1: Add manualReview array as alias for skipped (PRD-021)
    manualReview: skipped.map(a => {
      const finding = findingMap.get(a.bugId);
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'unknown',
        reason: a.error || 'No automatic fix available',
        autoFixed: false
      };
    })
  };

  // v12.9.0: Add triage section if triage was used (PRD-020)
  if (options.triageMetrics) {
    output.triage = {
      enabled: true,
      provider: options.triageProvider || 'claude',
      findingsTriaged: options.triageMetrics.findingsTriaged,
      findingsAccepted: options.triageMetrics.findingsAccepted,
      findingsRejected: options.triageMetrics.findingsRejected,
      findingsSkipped: options.triageMetrics.findingsSkipped,
      findingsFallback: options.triageMetrics.findingsFallback,
      llmRequests: options.triageMetrics.llmRequests,
      llmTokensUsed: options.triageMetrics.llmTokensUsed,
      llmCostEstimateUsd: options.triageMetrics.llmCostEstimateUsd,
      durationMs: options.triageMetrics.triageDurationMs
    };
  }

  return output;
}

/**
 * Options for generating markdown report (v12.9.0)
 */
export interface MarkdownReportOptions {
  /** Triage metrics from the session */
  triageMetrics?: TriageMetrics;
  /** Provider used for triage */
  triageProvider?: string;
  /** Original findings count before triage */
  originalFindingsCount?: number;
}

/**
 * Generate markdown report
 *
 * @param result - Bugfix result from controller
 * @param options - Additional options including triage metrics (v12.9.0)
 */
export function generateMarkdownReport(
  result: BugfixResult,
  options: MarkdownReportOptions = {}
): string {
  const lines: string[] = [];

  // Header
  lines.push('# AutomatosX Bugfix Report');
  lines.push('');
  lines.push(`**Session ID:** ${result.sessionId}`);
  lines.push(`**Date:** ${new Date(result.startedAt).toLocaleString()}`);
  lines.push(`**Duration:** ${(result.stats.totalDurationMs / 1000).toFixed(1)}s`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Bugs Found | ${result.stats.bugsFound} |`);
  lines.push(`| Bugs Fixed | ${result.stats.bugsFixed} |`);
  lines.push(`| Bugs Failed | ${result.stats.bugsFailed} |`);
  lines.push(`| Bugs Skipped | ${result.stats.bugsSkipped} |`);
  lines.push(`| Success Rate | ${(result.stats.successRate * 100).toFixed(1)}% |`);
  lines.push(`| Stop Reason | ${result.stats.stopReason} |`);
  lines.push('');

  // v12.9.0: LLM Triage section (PRD-020)
  if (options.triageMetrics) {
    const metrics = options.triageMetrics;
    lines.push('## LLM Triage');
    lines.push('');
    lines.push(`LLM triage was used to filter false positives from the initial scan.`);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Provider | ${options.triageProvider || 'claude'} |`);
    lines.push(`| Findings Scanned | ${metrics.findingsTotal} |`);
    lines.push(`| Sent to LLM | ${metrics.findingsTriaged} |`);
    lines.push(`| Accepted (Real Bugs) | ${metrics.findingsAccepted} |`);
    lines.push(`| Rejected (False Positives) | ${metrics.findingsRejected} |`);
    lines.push(`| Skipped (High Confidence) | ${metrics.findingsSkipped} |`);
    if (metrics.findingsFallback > 0) {
      lines.push(`| Fallback (LLM Unavailable) | ${metrics.findingsFallback} |`);
    }
    lines.push(`| LLM Requests | ${metrics.llmRequests} |`);
    lines.push(`| Tokens Used | ${metrics.llmTokensUsed} |`);
    lines.push(`| Estimated Cost | $${metrics.llmCostEstimateUsd.toFixed(4)} |`);
    lines.push(`| Triage Duration | ${(metrics.triageDurationMs / 1000).toFixed(2)}s |`);
    lines.push('');

    // Calculate precision improvement
    if (metrics.findingsTriaged > 0) {
      const filterRate = (metrics.findingsRejected / metrics.findingsTriaged * 100).toFixed(1);
      lines.push(`> **${filterRate}%** of triaged findings were identified as false positives.`);
      lines.push('');
    }
  }

  // Configuration
  lines.push('## Configuration');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({
    maxBugs: result.config.maxBugs,
    severityThreshold: result.config.severityThreshold,
    bugTypes: result.config.bugTypes,
    dryRun: result.config.dryRun,
    scope: result.config.scope || '(all)'
  }, null, 2));
  lines.push('```');
  lines.push('');

  // Bugs by severity
  lines.push('## Bugs by Severity');
  lines.push('');
  const severities: BugSeverity[] = ['critical', 'high', 'medium', 'low'];
  for (const severity of severities) {
    const count = result.stats.bugsBySeverity[severity] || 0;
    if (count > 0) {
      lines.push(`- **${severity.toUpperCase()}**: ${count}`);
    }
  }
  lines.push('');

  // Bugs by type
  lines.push('## Bugs by Type');
  lines.push('');
  const typeNames: Record<BugType, string> = {
    timer_leak: 'Timer Leak',
    missing_destroy: 'Missing destroy()',
    promise_timeout_leak: 'Promise Timeout Leak',
    event_leak: 'Event Listener Leak',
    resource_leak: 'Resource Leak',
    race_condition: 'Race Condition',
    memory_leak: 'Memory Leak',
    uncaught_promise: 'Uncaught Promise',
    deprecated_api: 'Deprecated API',
    security_issue: 'Security Issue',
    type_error: 'Type Error',
    test_failure: 'Test Failure',
    custom: 'Custom'
  };

  for (const [type, count] of Object.entries(result.stats.bugsByType)) {
    if (count > 0) {
      const name = typeNames[type as BugType] || type;
      lines.push(`- **${name}**: ${count}`);
    }
  }
  lines.push('');

  // v12.9.1: Fixed bugs with [AUTO] marker (PRD-021)
  const fixed = result.attempts.filter(a => a.status === 'verified');
  if (fixed.length > 0) {
    lines.push('## Auto-Fixed Bugs');
    lines.push('');
    lines.push('> These bugs were automatically fixed and verified.');
    lines.push('');
    lines.push('| Status | Type | File | Line | Confidence |');
    lines.push('|--------|------|------|------|------------|');

    const findingMap = new Map(result.findings.map(f => [f.id, f]));

    for (const attempt of fixed) {
      const finding = findingMap.get(attempt.bugId);
      if (finding) {
        const typeName = typeNames[finding.type] || finding.type;
        const confidence = `${(finding.confidence * 100).toFixed(0)}%`;
        lines.push(`| ✓ [AUTO] | ${typeName} | \`${finding.file}\` | ${finding.lineStart} | ${confidence} |`);
      }
    }
    lines.push('');

    // Detailed diffs for fixed bugs
    lines.push('### Fix Details');
    lines.push('');

    for (const attempt of fixed) {
      const finding = findingMap.get(attempt.bugId);
      if (finding && attempt.diff) {
        lines.push(`#### ${finding.file}:${finding.lineStart}`);
        lines.push('');
        lines.push(`- **Type:** ${typeNames[finding.type] || finding.type}`);
        lines.push(`- **Severity:** ${finding.severity}`);
        lines.push(`- **Message:** ${finding.message}`);
        lines.push('');
        lines.push('**Diff:**');
        lines.push('```diff');
        lines.push(attempt.diff);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // v12.9.1: Failed bugs with [FAILED] marker (PRD-021)
  const failed = result.attempts.filter(a => a.status === 'failed');
  if (failed.length > 0) {
    lines.push('## Failed Fixes');
    lines.push('');
    lines.push('> These bugs could not be automatically fixed.');
    lines.push('');
    lines.push('| Status | Type | File | Line | Error |');
    lines.push('|--------|------|------|------|-------|');

    const findingMap = new Map(result.findings.map(f => [f.id, f]));

    for (const attempt of failed) {
      const finding = findingMap.get(attempt.bugId);
      if (finding) {
        const typeName = typeNames[finding.type] || finding.type;
        const error = attempt.error?.slice(0, 50) || 'Unknown';
        lines.push(`| ✗ [FAILED] | ${typeName} | \`${finding.file}\` | ${finding.lineStart} | ${error} |`);
      }
    }
    lines.push('');
  }

  // v12.9.1: Skipped bugs with [MANUAL] marker (PRD-021)
  const skipped = result.attempts.filter(a => a.status === 'skipped');
  if (skipped.length > 0) {
    lines.push('## Manual Review Required');
    lines.push('');
    lines.push('> These bugs require manual review and cannot be auto-fixed.');
    lines.push('');
    lines.push('| Status | Type | File | Line | Reason |');
    lines.push('|--------|------|------|------|--------|');

    const findingMap = new Map(result.findings.map(f => [f.id, f]));

    for (const attempt of skipped) {
      const finding = findingMap.get(attempt.bugId);
      if (finding) {
        const typeName = typeNames[finding.type] || finding.type;
        const reason = attempt.error?.slice(0, 50) || 'No automatic fix available';
        lines.push(`| ⚠ [MANUAL] | ${typeName} | \`${finding.file}\` | ${finding.lineStart} | ${reason} |`);
      }
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated by AutomatosX v${getVersion()}*`);

  return lines.join('\n');
}

/**
 * Options for writing report (v12.9.0)
 */
export interface WriteReportOptions {
  /** Triage metrics from the session */
  triageMetrics?: TriageMetrics;
  /** Provider used for triage */
  triageProvider?: string;
  /** Original findings count before triage */
  originalFindingsCount?: number;
}

/**
 * Write report to file
 *
 * @param result - Bugfix result from controller
 * @param outputPath - File path for the report
 * @param format - Output format ('markdown' or 'json')
 * @param options - Additional options including triage metrics (v12.9.0)
 */
export async function writeReport(
  result: BugfixResult,
  outputPath: string,
  format: 'markdown' | 'json' = 'markdown',
  options: WriteReportOptions = {}
): Promise<void> {
  // Ensure directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  let content: string;

  if (format === 'json') {
    content = JSON.stringify(generateJsonOutput(result, options), null, 2);
  } else {
    content = generateMarkdownReport(result, options);
  }

  await writeFile(outputPath, content, 'utf-8');
}

/**
 * Generate default report path
 */
export function getDefaultReportPath(rootDir: string, format: 'markdown' | 'json'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = format === 'json' ? 'json' : 'md';
  return join(rootDir, '.automatosx', 'reports', `bugfix-${timestamp}.${ext}`);
}
