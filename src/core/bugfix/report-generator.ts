/**
 * Report Generator for Bugfix
 *
 * Generates markdown and JSON reports for bugfix sessions.
 *
 * @module core/bugfix/report-generator
 * @since v12.6.0
 */

import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { mkdir } from 'fs/promises';
import type {
  BugfixResult,
  BugFinding,
  FixAttempt,
  BugType,
  BugSeverity
} from './types.js';

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
    successRate: number;
    durationMs: number;
  };
  config: {
    maxBugs: number;
    severityThreshold: string;
    dryRun: boolean;
    scope?: string;
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
  }>;
  fixed: Array<{
    file: string;
    line: number;
    type: string;
    message: string;
  }>;
  failed: Array<{
    file: string;
    line: number;
    type: string;
    error?: string;
  }>;
  skipped: Array<{
    file: string;
    line: number;
    type: string;
    reason?: string;
  }>;
}

/**
 * Generate JSON output for CLI
 */
export function generateJsonOutput(result: BugfixResult): BugfixJsonOutput {
  const fixed = result.attempts.filter(a => a.status === 'verified');
  const failed = result.attempts.filter(a => a.status === 'failed');
  const skipped = result.attempts.filter(a => a.status === 'skipped');

  // Map attempts to findings
  const findingMap = new Map(result.findings.map(f => [f.id, f]));

  return {
    version: '12.6.0',
    timestamp: new Date().toISOString(),
    sessionId: result.sessionId,
    summary: {
      bugsFound: result.stats.bugsFound,
      bugsFixed: result.stats.bugsFixed,
      bugsFailed: result.stats.bugsFailed,
      bugsSkipped: result.stats.bugsSkipped,
      successRate: result.stats.successRate,
      durationMs: result.stats.totalDurationMs
    },
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
    fixed: fixed.map(a => {
      const finding = findingMap.get(a.bugId);
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'unknown',
        message: finding?.message || ''
      };
    }),
    failed: failed.map(a => {
      const finding = findingMap.get(a.bugId);
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'unknown',
        error: a.error
      };
    }),
    skipped: skipped.map(a => {
      const finding = findingMap.get(a.bugId);
      return {
        file: finding?.file || 'unknown',
        line: finding?.lineStart || 0,
        type: finding?.type || 'unknown',
        reason: a.error || 'No automatic fix available'
      };
    })
  };
}

/**
 * Generate markdown report
 */
export function generateMarkdownReport(result: BugfixResult): string {
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

  // Fixed bugs
  const fixed = result.attempts.filter(a => a.status === 'verified');
  if (fixed.length > 0) {
    lines.push('## Fixed Bugs');
    lines.push('');

    const findingMap = new Map(result.findings.map(f => [f.id, f]));

    for (const attempt of fixed) {
      const finding = findingMap.get(attempt.bugId);
      if (finding) {
        lines.push(`### ${finding.file}:${finding.lineStart}`);
        lines.push('');
        lines.push(`- **Type:** ${typeNames[finding.type] || finding.type}`);
        lines.push(`- **Severity:** ${finding.severity}`);
        lines.push(`- **Message:** ${finding.message}`);
        lines.push('');

        if (attempt.diff) {
          lines.push('**Diff:**');
          lines.push('```diff');
          lines.push(attempt.diff);
          lines.push('```');
          lines.push('');
        }
      }
    }
  }

  // Failed bugs
  const failed = result.attempts.filter(a => a.status === 'failed');
  if (failed.length > 0) {
    lines.push('## Failed Bugs');
    lines.push('');

    const findingMap = new Map(result.findings.map(f => [f.id, f]));

    for (const attempt of failed) {
      const finding = findingMap.get(attempt.bugId);
      if (finding) {
        lines.push(`- **${finding.file}:${finding.lineStart}** - ${finding.type}`);
        if (attempt.error) {
          lines.push(`  - Error: ${attempt.error}`);
        }
      }
    }
    lines.push('');
  }

  // Skipped bugs (manual review needed)
  const skipped = result.attempts.filter(a => a.status === 'skipped');
  if (skipped.length > 0) {
    lines.push('## Skipped (Manual Review Needed)');
    lines.push('');

    const findingMap = new Map(result.findings.map(f => [f.id, f]));

    for (const attempt of skipped) {
      const finding = findingMap.get(attempt.bugId);
      if (finding) {
        lines.push(`- **${finding.file}:${finding.lineStart}** - ${typeNames[finding.type] || finding.type}`);
        lines.push(`  - ${finding.message}`);
      }
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by AutomatosX v12.6.0*');

  return lines.join('\n');
}

/**
 * Write report to file
 */
export async function writeReport(
  result: BugfixResult,
  outputPath: string,
  format: 'markdown' | 'json' = 'markdown'
): Promise<void> {
  // Ensure directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  let content: string;

  if (format === 'json') {
    content = JSON.stringify(generateJsonOutput(result), null, 2);
  } else {
    content = generateMarkdownReport(result);
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
