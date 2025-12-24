/**
 * Markdown Formatter
 *
 * Formats review results as markdown output.
 * INV-REV-OUT-001: Comments ordered by severity.
 */

import {
  type ReviewResult,
  type ReviewComment,
  sortCommentsBySeverity,
} from '@automatosx/contracts';

/**
 * Format review result as markdown
 */
export function formatReviewAsMarkdown(result: ReviewResult): string {
  const { summary, comments, filesReviewed, linesAnalyzed, durationMs, providerId } = result;

  // Sort comments by severity (INV-REV-OUT-001)
  const sortedComments = sortCommentsBySeverity(comments);

  const lines: string[] = [];

  // Header
  lines.push('# Code Review Report');
  lines.push('');
  const focusMode = result.comments.length > 0 && result.comments[0] ? result.comments[0].focus : 'all';
  lines.push(
    `**Focus:** ${focusMode} | ` +
      `**Files:** ${filesReviewed.length} | ` +
      `**Lines:** ${linesAnalyzed.toLocaleString()} | ` +
      `**Duration:** ${formatDuration(durationMs)}`
  );
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Critical | ${summary.bySeverity.critical} |`);
  lines.push(`| Warning | ${summary.bySeverity.warning} |`);
  lines.push(`| Suggestion | ${summary.bySeverity.suggestion} |`);
  lines.push(`| Note | ${summary.bySeverity.note} |`);
  lines.push('');

  lines.push(`**Health Score:** ${summary.healthScore}/100`);
  lines.push(`**Verdict:** ${summary.verdict}`);
  lines.push('');

  // Provider info
  lines.push(`*Reviewed by ${providerId}*`);
  lines.push('');

  if (sortedComments.length === 0) {
    lines.push('---');
    lines.push('');
    lines.push('No issues found.');
    return lines.join('\n');
  }

  // Group comments by severity
  const critical = sortedComments.filter((c) => c.severity === 'critical');
  const warnings = sortedComments.filter((c) => c.severity === 'warning');
  const suggestions = sortedComments.filter((c) => c.severity === 'suggestion');
  const notes = sortedComments.filter((c) => c.severity === 'note');

  // Critical Issues
  if (critical.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Critical Issues');
    lines.push('');
    for (const comment of critical) {
      lines.push(...formatComment(comment, 'CRITICAL'));
    }
  }

  // Warnings
  if (warnings.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Warnings');
    lines.push('');
    for (const comment of warnings) {
      lines.push(...formatComment(comment, 'WARNING'));
    }
  }

  // Suggestions
  if (suggestions.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Suggestions');
    lines.push('');
    for (const comment of suggestions) {
      lines.push(...formatComment(comment, 'SUGGESTION'));
    }
  }

  // Notes
  if (notes.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    for (const comment of notes) {
      lines.push(...formatComment(comment, 'NOTE'));
    }
  }

  // Hotspots
  if (summary.hotspots.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## File Hotspots');
    lines.push('');
    lines.push('Files with the most issues:');
    lines.push('');
    for (const hotspot of summary.hotspots) {
      lines.push(`- \`${hotspot.file}\`: ${hotspot.commentCount} issue(s)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a single comment
 */
function formatComment(comment: ReviewComment, badge: string): string[] {
  const lines: string[] = [];

  // Title with severity badge
  lines.push(`### [${badge}] ${comment.title}`);

  // Location
  const location = comment.lineEnd
    ? `\`${comment.file}:${comment.line}-${comment.lineEnd}\``
    : `\`${comment.file}:${comment.line}\``;
  lines.push(`**File:** ${location}`);
  lines.push(`**Confidence:** ${Math.round(comment.confidence * 100)}%`);
  lines.push(`**Category:** ${comment.category}`);
  lines.push('');

  // Body (explanation)
  lines.push(comment.body);
  lines.push('');

  // Rationale (if present)
  if (comment.rationale) {
    lines.push('**Why this matters:**');
    lines.push(comment.rationale);
    lines.push('');
  }

  // Suggestion (if present)
  if (comment.suggestion) {
    lines.push('**Suggestion:**');
    lines.push(comment.suggestion);
    lines.push('');
  }

  // Suggested code (if present)
  if (comment.suggestedCode) {
    lines.push('**Suggested fix:**');
    lines.push('```');
    lines.push(comment.suggestedCode);
    lines.push('```');
    lines.push('');
  }

  return lines;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format a compact summary for CLI output
 */
export function formatCompactSummary(result: ReviewResult): string {
  const { summary, durationMs } = result;

  const parts: string[] = [];

  if (summary.bySeverity.critical > 0) {
    parts.push(`${summary.bySeverity.critical} critical`);
  }
  if (summary.bySeverity.warning > 0) {
    parts.push(`${summary.bySeverity.warning} warning`);
  }
  if (summary.bySeverity.suggestion > 0) {
    parts.push(`${summary.bySeverity.suggestion} suggestion`);
  }
  if (summary.bySeverity.note > 0) {
    parts.push(`${summary.bySeverity.note} note`);
  }

  const issuesSummary = parts.length > 0 ? parts.join(', ') : 'No issues';

  return `${issuesSummary} | Health: ${summary.healthScore}/100 | ${formatDuration(durationMs)}`;
}
