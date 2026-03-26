import type { CLIOptions, CommandResult } from '../types.js';
import { parseCommandArgs } from '../utils/command-args.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';

type ReviewFocus = 'all' | 'security' | 'correctness' | 'maintainability';

interface ParsedReviewArgs {
  subcommand: 'analyze' | 'list' | 'help';
  paths: string[];
  focus: ReviewFocus;
  maxFiles: number;
  error?: string;
}

export async function reviewCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const parsed = parseReviewArgs(args);

  if (parsed.error !== undefined) {
    return failure(parsed.error);
  }

  switch (parsed.subcommand) {
    case 'help':
      return success([
        'AX Review',
        '',
        'Usage:',
        '  ax review analyze <paths...> [--focus security|correctness|maintainability|all] [--max-files <n>]',
        '  ax review list',
      ].join('\n'));
    case 'list':
      return listReviews(options);
    case 'analyze':
      if (parsed.paths.length === 0) {
        return usageError('ax review analyze <paths...>');
      }
      return analyzeReview(parsed, options);
  }
}

function parseReviewArgs(args: string[]): ParsedReviewArgs {
  const subcommand = (args[0] === 'list' || args[0] === 'help' || args[0] === 'analyze')
    ? args[0]
    : 'analyze';
  const startIndex = args[0] === subcommand ? 1 : 0;
  const parsed = parseCommandArgs<Pick<ParsedReviewArgs, 'focus' | 'maxFiles'>>({
    args: args.slice(startIndex),
    initial: {
      focus: 'all',
      maxFiles: 25,
    },
    flags: {
      focus: {
        kind: 'string',
        apply: (state, value) => {
          if (value !== 'all' && value !== 'security' && value !== 'correctness' && value !== 'maintainability') {
            return 'Review focus must be one of: all, security, correctness, maintainability.';
          }
          state.focus = value;
        },
      },
      'max-files': {
        kind: 'string',
        apply: (state, value) => {
          const parsedMax = Number.parseInt(value, 10);
          if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
            return 'Review max-files must be a positive integer.';
          }
          state.maxFiles = parsedMax;
        },
      },
    },
    unknownFlagMessage: (token) => `Unknown review flag: ${token}.`,
  });

  if (parsed.error !== undefined) {
    return {
      subcommand,
      paths: parsed.positionals,
      focus: parsed.value.focus,
      maxFiles: parsed.value.maxFiles,
      error: parsed.error,
    };
  }

  return {
    subcommand,
    paths: parsed.positionals,
    focus: parsed.value.focus,
    maxFiles: parsed.value.maxFiles,
  };
}

async function analyzeReview(parsed: ParsedReviewArgs, options: CLIOptions): Promise<CommandResult> {
  const basePath = options.outputDir ?? process.cwd();
  const runtime = createRuntime(options);
  const result = await runtime.analyzeReview({
    paths: parsed.paths,
    focus: parsed.focus,
    maxFiles: parsed.maxFiles,
    traceId: options.traceId,
    sessionId: options.sessionId,
    basePath,
    surface: 'cli',
  });

  if (!result.success) {
    return failure(`Review failed: ${result.error?.message ?? 'Unknown error'}`, result);
  }

  return success(
    `Review completed with trace ${result.traceId}. Files scanned: ${result.filesScanned}. Findings: ${result.findings.length}.`,
    result,
  );
}

async function listReviews(options: CLIOptions): Promise<CommandResult> {
  const runtime = createRuntime(options);
  const reviews = await runtime.listReviewTraces(options.limit);
  if (reviews.length === 0) {
    return success('No review traces found.', reviews);
  }

  const lines = [
    'Review traces:',
    ...reviews.map((trace) => `- ${trace.traceId} ${trace.status} ${trace.startedAt}`),
  ];
  return success(lines.join('\n'), reviews);
}
