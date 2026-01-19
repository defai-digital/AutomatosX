/**
 * Review Command
 *
 * AI-powered code review with focused analysis modes.
 * Integrates with trace store for dashboard visibility.
 * Usage: ax review <paths...> [options]
 *        ax review help
 */

import { randomUUID } from 'node:crypto';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  createReviewService,
  type ReviewPromptExecutor,
  type ReviewResult,
  type ReviewComment,
} from '@defai.digital/review-domain';
import {
  type ReviewFocus,
  type TraceEvent,
  type TraceHierarchy,
  ReviewFocusSchema,
  ReviewErrorCode,
  TIMEOUT_PROVIDER_DEFAULT,
  CONFIDENCE_DEFAULT_MIN,
  ANALYSIS_MAX_FILES_DEFAULT,
  LIMIT_DEFAULT,
  getErrorMessage,
  createRootTraceHierarchy,
} from '@defai.digital/contracts';
import { createAnalysisProviderRouter } from '../utils/provider-factory.js';
import { COLORS } from '../utils/terminal.js';
import { bootstrap, getTraceStore } from '../bootstrap.js';

/**
 * Review-specific status icons
 */
const REVIEW_ICONS = {
  critical: `${COLORS.red}✖${COLORS.reset}`,
  warning: `${COLORS.yellow}⚠${COLORS.reset}`,
  suggestion: `${COLORS.blue}◉${COLORS.reset}`,
  note: `${COLORS.dim}ℹ${COLORS.reset}`,
  check: `${COLORS.green}✓${COLORS.reset}`,
  file: `${COLORS.cyan}▸${COLORS.reset}`,
};

/**
 * Parsed review arguments
 */
interface ParsedReviewArgs {
  subcommand: string;
  paths: string[];
  focus: ReviewFocus;
  minConfidence: number;
  maxFiles: number;
  maxLinesPerFile: number;
  context: string | undefined;
  providerId: string | undefined;
  timeoutMs: number;
  outputFormat: 'markdown' | 'json' | 'sarif';
  dryRun: boolean;
  limit: number;
  // Tier 2 & 3 parameters
  since: string | undefined;
  smartBatching: boolean;
  dependencyOrdering: boolean;
  enableRecovery: boolean;
}

/**
 * Parses review subcommand and options
 */
function parseReviewArgs(args: string[]): ParsedReviewArgs {
  const subcommand = args[0] ?? 'help';
  const paths: string[] = [];
  let focus: ReviewFocus = 'all';
  let minConfidence = CONFIDENCE_DEFAULT_MIN;
  let maxFiles = ANALYSIS_MAX_FILES_DEFAULT;
  let maxLinesPerFile = 500;
  let context: string | undefined;
  let providerId: string | undefined;
  let timeoutMs = TIMEOUT_PROVIDER_DEFAULT;
  let outputFormat: 'markdown' | 'json' | 'sarif' = 'markdown';
  let dryRun = false;
  let limit = LIMIT_DEFAULT;
  // Tier 2 & 3 parameters with defaults
  let since: string | undefined;
  let smartBatching = true;
  let dependencyOrdering = false;
  let enableRecovery = true;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--focus' && i + 1 < args.length) {
      const focusArg = args[++i]!;
      const parsed = ReviewFocusSchema.safeParse(focusArg);
      if (parsed.success) {
        focus = parsed.data;
      }
    } else if (arg === '--min-confidence' && i + 1 < args.length) {
      const parsed = parseFloat(args[++i]!);
      if (Number.isFinite(parsed)) {
        minConfidence = parsed;
      }
    } else if (arg === '--max-files' && i + 1 < args.length) {
      maxFiles = parseInt(args[++i]!, 10);
    } else if (arg === '--max-lines' && i + 1 < args.length) {
      maxLinesPerFile = parseInt(args[++i]!, 10);
    } else if (arg === '--context' && i + 1 < args.length) {
      context = args[++i];
    } else if (arg === '--provider' && i + 1 < args.length) {
      providerId = args[++i];
    } else if (arg === '--timeout' && i + 1 < args.length) {
      timeoutMs = parseInt(args[++i]!, 10) * 1000;
    } else if (arg === '--format' && i + 1 < args.length) {
      const fmt = args[++i]!;
      if (fmt === 'markdown' || fmt === 'json' || fmt === 'sarif') {
        outputFormat = fmt;
      }
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--limit' && i + 1 < args.length) {
      limit = parseInt(args[++i]!, 10);
    // Tier 2 & 3 parameters
    } else if (arg === '--since' && i + 1 < args.length) {
      since = args[++i];
    } else if (arg === '--no-smart-batching') {
      smartBatching = false;
    } else if (arg === '--dependency-ordering') {
      dependencyOrdering = true;
    } else if (arg === '--no-recovery') {
      enableRecovery = false;
    } else if (arg !== undefined && !arg.startsWith('-')) {
      // Positional arg is a path
      paths.push(arg);
    }
  }

  return {
    subcommand,
    paths,
    focus,
    minConfidence,
    maxFiles,
    maxLinesPerFile,
    context,
    providerId,
    timeoutMs,
    outputFormat,
    dryRun,
    limit,
    // Tier 2 & 3 parameters
    since,
    smartBatching,
    dependencyOrdering,
    enableRecovery,
  };
}

/**
 * Shows review help
 */
function showReviewHelp(): CommandResult {
  const helpText = `
${COLORS.bold}AX Review - AI-Powered Code Review${COLORS.reset}

Usage:
  ax review analyze <paths...> [options]
  ax review list [options]
  ax review help

Subcommands:
  analyze <paths...>     Analyze code at specified paths
  list                   List past review results

Analyze Options:
  --focus <mode>           Focus mode: security, architecture, performance,
                          maintainability, correctness, all (default: all)
  --min-confidence <n>     Minimum confidence threshold 0-1 (default: 0.7)
  --max-files <n>          Maximum files to analyze (default: 20)
  --max-lines <n>          Max lines per file (default: 500)
  --context <text>         Additional context for the review
  --provider <id>          Specific provider to use
  --timeout <seconds>      Review timeout (default: 120)
  --format <fmt>           Output format: markdown, json, sarif (default: markdown)
  --dry-run                Only show what would be analyzed
  --since <commit>         Only review files changed since commit (Tier 2)
  --no-smart-batching      Disable focus-mode smart batching (Tier 2)
  --dependency-ordering    Order files by dependency graph (Tier 3)
  --no-recovery            Disable partial result recovery (Tier 3)

List Options:
  --focus <mode>           Filter by focus mode
  --limit <n>              Maximum number of results (default: 10)

Focus Modes:
  ${COLORS.red}security${COLORS.reset}        OWASP Top 10, injection, auth issues
  ${COLORS.magenta}architecture${COLORS.reset}    SRP, coupling, dependency issues
  ${COLORS.yellow}performance${COLORS.reset}     N+1 queries, memory leaks, complexity
  ${COLORS.cyan}maintainability${COLORS.reset} Code smells, duplication, naming
  ${COLORS.blue}correctness${COLORS.reset}     Logic errors, edge cases, null handling
  ${COLORS.green}all${COLORS.reset}             Comprehensive review (default)

Severity Levels:
  ${REVIEW_ICONS.critical} critical    Must fix - security vulnerability, data loss risk
  ${REVIEW_ICONS.warning} warning     Should fix - potential bug, bad practice
  ${REVIEW_ICONS.suggestion} suggestion  Could improve - enhancement opportunity
  ${REVIEW_ICONS.note} note        Informational - observation, documentation

Output Formats:
  markdown  Human-readable report (default)
  json      Structured JSON for processing
  sarif     SARIF 2.1.0 for CI integration

Examples:
  ax review analyze src/                      # Review all code in src/
  ax review analyze src/ --focus security     # Security-focused review
  ax review analyze src/api/ --focus performance  # Performance review of API
  ax review analyze src/ --dry-run            # Preview what would be analyzed
  ax review analyze src/ --format sarif       # SARIF output for CI
  ax review analyze src/ --since main         # Only files changed since main
  ax review analyze src/ --dependency-ordering  # Order by dependency graph
  ax review list                              # List past reviews
  ax review list --limit 5                    # Show last 5 reviews
  ax review list --focus security             # Filter by focus mode
`.trim();

  return {
    success: true,
    message: helpText,
    data: undefined,
    exitCode: 0,
  };
}

/**
 * Creates a prompt executor that uses the provider router
 */
function createPromptExecutor(): ReviewPromptExecutor {
  const router = createAnalysisProviderRouter();

  return {
    async execute(
      prompt: string,
      options: { providerId?: string; timeoutMs?: number }
    ): Promise<{ content: string; providerId: string; modelId: string }> {
      // Get provider - either specific one or select best available
      const provider = options.providerId
        ? await router.getProvider(options.providerId)
        : await router.selectProvider('review');

      // Execute the prompt
      const response = await provider.complete({
        prompt,
        maxTokens: 16000,
        temperature: 0.3,
      });

      return {
        content: response.content,
        providerId: provider.id,
        modelId: provider.id, // Provider adapters don't expose model ID separately
      };
    },
  };
}

/**
 * Formats review result for CLI text output
 */
function formatReviewResultForCLI(result: ReviewResult, verbose: boolean): string {
  const lines: string[] = [];
  const { summary, comments, filesReviewed, linesAnalyzed, providerId, durationMs } = result;

  // Header
  lines.push('');
  lines.push(`${COLORS.bold}Code Review Report${COLORS.reset}`);
  lines.push(`${COLORS.dim}────────────────────────────────────────${COLORS.reset}`);

  // Metadata
  const focusMode = comments.length > 0 && comments[0] ? comments[0].focus : 'all';
  lines.push(`Focus: ${COLORS.cyan}${focusMode}${COLORS.reset} | Files: ${filesReviewed.length} | Lines: ${linesAnalyzed.toLocaleString()}`);
  lines.push(`Provider: ${providerId} | Duration: ${formatDuration(durationMs)}`);
  lines.push('');

  // Summary
  lines.push(`${COLORS.bold}Summary${COLORS.reset}`);
  const severityParts: string[] = [];
  if (summary.bySeverity.critical > 0) {
    severityParts.push(`${REVIEW_ICONS.critical} ${summary.bySeverity.critical} critical`);
  }
  if (summary.bySeverity.warning > 0) {
    severityParts.push(`${REVIEW_ICONS.warning} ${summary.bySeverity.warning} warning`);
  }
  if (summary.bySeverity.suggestion > 0) {
    severityParts.push(`${REVIEW_ICONS.suggestion} ${summary.bySeverity.suggestion} suggestion`);
  }
  if (summary.bySeverity.note > 0) {
    severityParts.push(`${REVIEW_ICONS.note} ${summary.bySeverity.note} note`);
  }

  if (severityParts.length > 0) {
    lines.push(severityParts.join(' | '));
  } else {
    lines.push(`${REVIEW_ICONS.check} No issues found`);
  }

  // Health score
  const healthColor =
    summary.healthScore >= 80 ? COLORS.green : summary.healthScore >= 50 ? COLORS.yellow : COLORS.red;
  lines.push(`Health Score: ${healthColor}${summary.healthScore}/100${COLORS.reset}`);
  lines.push(`${COLORS.dim}${summary.verdict}${COLORS.reset}`);
  lines.push('');

  if (comments.length === 0) {
    return lines.join('\n');
  }

  // Group comments by severity
  const critical = comments.filter((c: ReviewComment) => c.severity === 'critical');
  const warnings = comments.filter((c: ReviewComment) => c.severity === 'warning');
  const suggestions = comments.filter((c: ReviewComment) => c.severity === 'suggestion');
  const notes = comments.filter((c: ReviewComment) => c.severity === 'note');

  // Critical Issues
  if (critical.length > 0) {
    lines.push(`${COLORS.red}${COLORS.bold}Critical Issues${COLORS.reset}`);
    lines.push(`${COLORS.dim}────────────────────────────────────────${COLORS.reset}`);
    for (const comment of critical) {
      lines.push(...formatCommentForCLI(comment, verbose, 'critical'));
    }
  }

  // Warnings
  if (warnings.length > 0) {
    lines.push(`${COLORS.yellow}${COLORS.bold}Warnings${COLORS.reset}`);
    lines.push(`${COLORS.dim}────────────────────────────────────────${COLORS.reset}`);
    for (const comment of warnings) {
      lines.push(...formatCommentForCLI(comment, verbose, 'warning'));
    }
  }

  // Suggestions
  if (suggestions.length > 0) {
    lines.push(`${COLORS.blue}${COLORS.bold}Suggestions${COLORS.reset}`);
    lines.push(`${COLORS.dim}────────────────────────────────────────${COLORS.reset}`);
    for (const comment of suggestions) {
      lines.push(...formatCommentForCLI(comment, verbose, 'suggestion'));
    }
  }

  // Notes (only in verbose mode)
  if (verbose && notes.length > 0) {
    lines.push(`${COLORS.dim}${COLORS.bold}Notes${COLORS.reset}`);
    lines.push(`${COLORS.dim}────────────────────────────────────────${COLORS.reset}`);
    for (const comment of notes) {
      lines.push(...formatCommentForCLI(comment, verbose, 'note'));
    }
  }

  return lines.join('\n');
}

/**
 * Formats a single comment for CLI output
 */
function formatCommentForCLI(
  comment: ReviewResult['comments'][0],
  verbose: boolean,
  severity: 'critical' | 'warning' | 'suggestion' | 'note'
): string[] {
  const lines: string[] = [];
  const icon = REVIEW_ICONS[severity];
  const location = comment.lineEnd
    ? `${comment.file}:${comment.line}-${comment.lineEnd}`
    : `${comment.file}:${comment.line}`;

  lines.push(`${icon} ${COLORS.bold}${comment.title}${COLORS.reset}`);
  lines.push(`  ${REVIEW_ICONS.file} ${COLORS.cyan}${location}${COLORS.reset}`);
  lines.push(`  ${COLORS.dim}Category: ${comment.category} | Confidence: ${Math.round(comment.confidence * 100)}%${COLORS.reset}`);

  if (verbose) {
    lines.push('');
    lines.push(`  ${comment.body}`);

    if (comment.rationale) {
      lines.push(`  ${COLORS.dim}Why: ${comment.rationale}${COLORS.reset}`);
    }

    if (comment.suggestion) {
      lines.push(`  ${COLORS.green}Suggestion: ${comment.suggestion}${COLORS.reset}`);
    }

    if (comment.suggestedCode) {
      lines.push(`  ${COLORS.dim}Suggested fix:${COLORS.reset}`);
      lines.push(`  ${COLORS.cyan}${comment.suggestedCode}${COLORS.reset}`);
    }
  }

  lines.push('');
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
 * Runs code review with trace recording for dashboard visibility
 */
async function runReview(
  paths: string[],
  options: CLIOptions,
  args: ParsedReviewArgs
): Promise<CommandResult> {
  if (paths.length === 0) {
    return {
      success: false,
      message: 'Error: At least one path is required\n\nRun "ax review help" for usage.',
      data: undefined,
      exitCode: 1,
    };
  }

  // Initialize bootstrap to get trace store
  await bootstrap();
  const traceStore = getTraceStore();
  const traceId = randomUUID();
  const startTime = new Date().toISOString();

  // Create trace hierarchy context for this root trace
  const traceHierarchy: TraceHierarchy = createRootTraceHierarchy(traceId, undefined);

  // Emit run.start trace event
  const startEvent: TraceEvent = {
    eventId: randomUUID(),
    traceId,
    type: 'run.start',
    timestamp: startTime,
    context: {
      workflowId: 'review-analyze',
      parentTraceId: traceHierarchy.parentTraceId,
      rootTraceId: traceHierarchy.rootTraceId,
      traceDepth: traceHierarchy.traceDepth,
      sessionId: traceHierarchy.sessionId,
    },
    payload: {
      command: 'ax review analyze',
      paths,
      focus: args.focus,
      providerId: args.providerId,
      dryRun: args.dryRun,
    },
  };
  await traceStore.write(startEvent);

  try {
    const promptExecutor = createPromptExecutor();
    const service = createReviewService(
      {
        defaultProvider: args.providerId ?? 'claude',
        defaultTimeoutMs: args.timeoutMs,
        providerFallbackOrder: ['claude', 'gemini', 'codex'],
      },
      promptExecutor
    );

    // Handle dry run
    if (args.dryRun) {
      const dryRunResult = await service.dryRun({
        requestId: crypto.randomUUID(),
        paths,
        focus: args.focus,
        minConfidence: args.minConfidence,
        maxFiles: args.maxFiles,
        maxLinesPerFile: args.maxLinesPerFile,
        context: args.context,
        providerId: args.providerId,
        timeoutMs: args.timeoutMs,
        outputFormat: args.outputFormat,
        dryRun: true,
        // Tier 2 & 3 parameters
        since: args.since,
        smartBatching: args.smartBatching,
        dependencyOrdering: args.dependencyOrdering,
        enableRecovery: args.enableRecovery,
      });

      const message = `
${COLORS.bold}Dry Run - Would Analyze:${COLORS.reset}
Focus: ${COLORS.cyan}${args.focus}${COLORS.reset}
Files: ${dryRunResult.files.length}
Lines: ${dryRunResult.totalLines.toLocaleString()}
Estimated time: ${formatDuration(dryRunResult.estimatedDurationMs)}

${COLORS.bold}Files:${COLORS.reset}
${dryRunResult.files.map((f: string) => `  ${REVIEW_ICONS.file} ${f}`).join('\n')}
`.trim();

      // Emit run.end trace event for dry run
      await traceStore.write({
        eventId: randomUUID(),
        traceId,
        type: 'run.end',
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - new Date(startTime).getTime(),
        status: 'success',
        context: {
          workflowId: 'review-analyze',
          parentTraceId: traceHierarchy.parentTraceId,
          rootTraceId: traceHierarchy.rootTraceId,
          traceDepth: traceHierarchy.traceDepth,
          sessionId: traceHierarchy.sessionId,
        },
        payload: {
          success: true,
          dryRun: true,
          fileCount: dryRunResult.files.length,
          totalLines: dryRunResult.totalLines,
          command: 'ax review analyze',
        },
      });

      return {
        success: true,
        message,
        data: dryRunResult,
        exitCode: 0,
      };
    }

    // Run actual review
    const result = await service.review({
      requestId: crypto.randomUUID(),
      paths,
      focus: args.focus,
      minConfidence: args.minConfidence,
      maxFiles: args.maxFiles,
      maxLinesPerFile: args.maxLinesPerFile,
      context: args.context,
      providerId: args.providerId,
      timeoutMs: args.timeoutMs,
      outputFormat: args.outputFormat,
      dryRun: false,
      // Tier 2 & 3 parameters
      since: args.since,
      smartBatching: args.smartBatching,
      dependencyOrdering: args.dependencyOrdering,
      enableRecovery: args.enableRecovery,
    });

    // Emit run.end trace event on success
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: result.durationMs,
      status: 'success',
      context: {
        workflowId: 'review-analyze',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: true,
        focus: args.focus,
        filesReviewed: result.filesReviewed.length,
        linesAnalyzed: result.linesAnalyzed,
        commentCount: result.comments.length,
        healthScore: result.summary.healthScore,
        providerId: result.providerId,
        command: 'ax review analyze',
      },
    });

    // Format output based on requested format
    if (args.outputFormat === 'json' || options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: result,
        exitCode: 0,
      };
    }

    if (args.outputFormat === 'sarif') {
      return {
        success: true,
        message: service.formatResult(result, 'sarif'),
        data: result,
        exitCode: 0,
      };
    }

    if (args.outputFormat === 'markdown') {
      return {
        success: true,
        message: service.formatResult(result, 'markdown'),
        data: result,
        exitCode: 0,
      };
    }

    // Default: CLI formatted output
    return {
      success: true,
      message: formatReviewResultForCLI(result, options.verbose),
      data: result,
      exitCode: 0,
    };
  } catch (error) {
    const message = getErrorMessage(error, 'Unknown error during review');
    const errorCode =
      error instanceof Error && 'code' in error ? (error as { code: string }).code : 'UNKNOWN';

    // Emit run.end trace event on failure
    await traceStore.write({
      eventId: randomUUID(),
      traceId,
      type: 'run.end',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - new Date(startTime).getTime(),
      status: 'failure',
      context: {
        workflowId: 'review-analyze',
        parentTraceId: traceHierarchy.parentTraceId,
        rootTraceId: traceHierarchy.rootTraceId,
        traceDepth: traceHierarchy.traceDepth,
        sessionId: traceHierarchy.sessionId,
      },
      payload: {
        success: false,
        error: message,
        errorCode,
        focus: args.focus,
        command: 'ax review analyze',
      },
    });

    let userMessage = `${REVIEW_ICONS.critical} Review failed: ${message}`;

    if (errorCode === ReviewErrorCode.TIMEOUT) {
      userMessage += '\n\nTip: Try reducing --max-files or increasing --timeout';
    } else if (errorCode === ReviewErrorCode.NO_FILES_FOUND) {
      userMessage += '\n\nTip: Check that the paths exist and contain source files';
    } else if (errorCode === ReviewErrorCode.PROVIDER_UNAVAILABLE) {
      userMessage += '\n\nTip: Check that the provider CLI is installed and configured';
    }

    return {
      success: false,
      message: userMessage,
      data: undefined,
      exitCode: 1,
    };
  }
}

// In-memory storage for review results (mirrors MCP server behavior)
const reviewStore = new Map<string, StoredReviewResult>();

interface StoredReviewResult {
  resultId: string;
  requestId: string;
  focus: string;
  filesReviewed: string[];
  summary: {
    bySeverity: {
      critical: number;
      warning: number;
      suggestion: number;
      note: number;
    };
    healthScore: number;
    verdict: string;
  };
  commentCount: number;
  completedAt: string;
}

/**
 * Store a review result for later listing
 */
export function storeReviewResult(result: {
  resultId: string;
  requestId: string;
  focus: string;
  filesReviewed: string[];
  summary: {
    bySeverity: { critical: number; warning: number; suggestion: number; note: number };
    healthScore: number;
    verdict: string;
  };
  comments: unknown[];
  completedAt: string;
}): void {
  reviewStore.set(result.resultId, {
    resultId: result.resultId,
    requestId: result.requestId,
    focus: result.focus,
    filesReviewed: result.filesReviewed,
    summary: result.summary,
    commentCount: result.comments.length,
    completedAt: result.completedAt,
  });
}

/**
 * Lists past review results
 */
function listReviews(
  options: CLIOptions,
  args: ParsedReviewArgs
): CommandResult {
  let results = Array.from(reviewStore.values());

  // Filter by focus if specified (not 'all')
  if (args.focus !== 'all') {
    results = results.filter((r) => r.focus === args.focus);
  }

  // Sort by completion time (newest first)
  results.sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  // Limit results
  results = results.slice(0, args.limit);

  if (options.format === 'json') {
    return {
      success: true,
      message: undefined,
      data: { reviews: results, count: results.length },
      exitCode: 0,
    };
  }

  if (results.length === 0) {
    return {
      success: true,
      message: `${COLORS.dim}No review results found.${COLORS.reset}\n\nRun ${COLORS.cyan}ax review analyze <paths>${COLORS.reset} to perform a code review.`,
      data: undefined,
      exitCode: 0,
    };
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(`${COLORS.bold}Recent Code Reviews${COLORS.reset}`);
  lines.push(`${COLORS.dim}────────────────────────────────────────────────────────────────────────────${COLORS.reset}`);
  lines.push(
    `${'ID'.padEnd(12)} | ${'Focus'.padEnd(15)} | ${'Files'.padEnd(6)} | ${'Score'.padEnd(6)} | ${'Issues'.padEnd(8)} | Completed`
  );
  lines.push(`${COLORS.dim}────────────────────────────────────────────────────────────────────────────${COLORS.reset}`);

  for (const result of results) {
    const id = result.resultId.slice(0, 8);
    const focus = result.focus.padEnd(15);
    const files = String(result.filesReviewed.length).padEnd(6);
    const score = String(result.summary.healthScore).padEnd(6);
    const issues = String(result.commentCount).padEnd(8);
    const date = new Date(result.completedAt).toLocaleString();
    lines.push(`${id} | ${focus} | ${files} | ${score} | ${issues} | ${date}`);
  }

  lines.push('');

  return {
    success: true,
    message: lines.join('\n'),
    data: { reviews: results, count: results.length },
    exitCode: 0,
  };
}

/**
 * Review command handler
 */
export async function reviewCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const parsed = parseReviewArgs(args);

  // Handle explicit subcommands
  switch (parsed.subcommand) {
    case 'help':
      return showReviewHelp();

    case 'list':
      return listReviews(options, parsed);

    case 'analyze':
      // 'analyze' subcommand - paths are in parsed.paths
      return runReview(parsed.paths, options, parsed);

    default:
      // If not a known subcommand and not starting with '-', treat as a path
      if (!parsed.subcommand.startsWith('-')) {
        // Subcommand is actually a path - add it to paths
        parsed.paths.unshift(parsed.subcommand);
        return runReview(parsed.paths, options, parsed);
      }
      // Otherwise show help
      return showReviewHelp();
  }
}
