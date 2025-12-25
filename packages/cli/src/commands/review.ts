/**
 * Review Command
 *
 * AI-powered code review with focused analysis modes.
 * Usage: ax review <paths...> [options]
 *        ax review help
 */

import type { CommandResult, CLIOptions } from '../types.js';
import {
  createReviewService,
  type ReviewPromptExecutor,
  type ReviewResult,
  type ReviewComment,
} from '@defai.digital/review-domain';
import {
  type ReviewFocus,
  ReviewFocusSchema,
  ReviewErrorCode,
  TIMEOUT_PROVIDER_DEFAULT,
  CONFIDENCE_DEFAULT_MIN,
  ANALYSIS_MAX_FILES_DEFAULT,
} from '@defai.digital/contracts';
import { createAnalysisProviderRouter } from '../utils/provider-factory.js';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Status icons
 */
const ICONS = {
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

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--focus' && i + 1 < args.length) {
      const focusArg = args[++i]!;
      const parsed = ReviewFocusSchema.safeParse(focusArg);
      if (parsed.success) {
        focus = parsed.data;
      }
    } else if (arg === '--min-confidence' && i + 1 < args.length) {
      minConfidence = parseFloat(args[++i]!);
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
  };
}

/**
 * Shows review help
 */
function showReviewHelp(): CommandResult {
  const helpText = `
${COLORS.bold}AX Review - AI-Powered Code Review${COLORS.reset}

Usage:
  ax review <paths...> [options]
  ax review help

Options:
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

Focus Modes:
  ${COLORS.red}security${COLORS.reset}        OWASP Top 10, injection, auth issues
  ${COLORS.magenta}architecture${COLORS.reset}    SRP, coupling, dependency issues
  ${COLORS.yellow}performance${COLORS.reset}     N+1 queries, memory leaks, complexity
  ${COLORS.cyan}maintainability${COLORS.reset} Code smells, duplication, naming
  ${COLORS.blue}correctness${COLORS.reset}     Logic errors, edge cases, null handling
  ${COLORS.green}all${COLORS.reset}             Comprehensive review (default)

Severity Levels:
  ${ICONS.critical} critical    Must fix - security vulnerability, data loss risk
  ${ICONS.warning} warning     Should fix - potential bug, bad practice
  ${ICONS.suggestion} suggestion  Could improve - enhancement opportunity
  ${ICONS.note} note        Informational - observation, documentation

Output Formats:
  markdown  Human-readable report (default)
  json      Structured JSON for processing
  sarif     SARIF 2.1.0 for CI integration

Examples:
  ax review src/                              # Review all code in src/
  ax review src/ --focus security             # Security-focused review
  ax review src/api/ --focus performance      # Performance review of API
  ax review src/ --dry-run                    # Preview what would be analyzed
  ax review src/ --format sarif > report.sarif  # SARIF output for CI
  ax review src/ --min-confidence 0.9         # Only high-confidence findings
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
    severityParts.push(`${ICONS.critical} ${summary.bySeverity.critical} critical`);
  }
  if (summary.bySeverity.warning > 0) {
    severityParts.push(`${ICONS.warning} ${summary.bySeverity.warning} warning`);
  }
  if (summary.bySeverity.suggestion > 0) {
    severityParts.push(`${ICONS.suggestion} ${summary.bySeverity.suggestion} suggestion`);
  }
  if (summary.bySeverity.note > 0) {
    severityParts.push(`${ICONS.note} ${summary.bySeverity.note} note`);
  }

  if (severityParts.length > 0) {
    lines.push(severityParts.join(' | '));
  } else {
    lines.push(`${ICONS.check} No issues found`);
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
  const icon = ICONS[severity];
  const location = comment.lineEnd
    ? `${comment.file}:${comment.line}-${comment.lineEnd}`
    : `${comment.file}:${comment.line}`;

  lines.push(`${icon} ${COLORS.bold}${comment.title}${COLORS.reset}`);
  lines.push(`  ${ICONS.file} ${COLORS.cyan}${location}${COLORS.reset}`);
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
 * Runs code review
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
      });

      const message = `
${COLORS.bold}Dry Run - Would Analyze:${COLORS.reset}
Focus: ${COLORS.cyan}${args.focus}${COLORS.reset}
Files: ${dryRunResult.files.length}
Lines: ${dryRunResult.totalLines.toLocaleString()}
Estimated time: ${formatDuration(dryRunResult.estimatedDurationMs)}

${COLORS.bold}Files:${COLORS.reset}
${dryRunResult.files.map((f: string) => `  ${ICONS.file} ${f}`).join('\n')}
`.trim();

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
    const message = error instanceof Error ? error.message : 'Unknown error during review';
    const errorCode =
      error instanceof Error && 'code' in error ? (error as { code: string }).code : 'UNKNOWN';

    let userMessage = `${ICONS.critical} Review failed: ${message}`;

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

/**
 * Review command handler
 */
export async function reviewCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const parsed = parseReviewArgs(args);

  // If first arg is a path (not "help"), treat it as a review command
  if (parsed.subcommand !== 'help' && !parsed.subcommand.startsWith('-')) {
    // Subcommand is actually a path
    if (parsed.subcommand !== 'help') {
      parsed.paths.unshift(parsed.subcommand);
    }
    return runReview(parsed.paths, options, parsed);
  }

  // Help command
  return showReviewHelp();
}
