/**
 * Refactor Command
 *
 * LLM-delegated code refactoring analysis.
 * Usage: ax refactor scan <paths...> [options]
 *        ax refactor help
 */

import type { CommandResult, CLIOptions } from '../types.js';
import {
  createAnalysisService,
  createCodeContextBuilder,
  createAnalysisPromptBuilder,
  createAnalysisResponseParser,
} from '@automatosx/analysis-domain';
import type {
  AnalysisResult,
  AnalysisFinding,
  AnalysisSeverityFilter,
} from '@automatosx/contracts';
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
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Status icons
 */
const ICONS = {
  opportunity: `${COLORS.blue}\u2022${COLORS.reset}`,
  applied: `${COLORS.green}\u2713${COLORS.reset}`,
  info: `${COLORS.cyan}\u2139${COLORS.reset}`,
};

/**
 * Parsed refactor arguments
 */
interface ParsedRefactorArgs {
  subcommand: string;
  paths: string[];
  severity: AnalysisSeverityFilter;
  maxFiles: number;
  maxLinesPerFile: number;
  context: string | undefined;
  providerId: string | undefined;
  timeoutMs: number;
}

/**
 * Parses refactor subcommand and options
 */
function parseRefactorArgs(args: string[]): ParsedRefactorArgs {
  const subcommand = args[0] ?? 'help';
  const paths: string[] = [];
  let severity: AnalysisSeverityFilter = 'all';
  let maxFiles = 20;
  let maxLinesPerFile = 1000;
  let context: string | undefined;
  let providerId: string | undefined;
  let timeoutMs = 60000;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--paths' && i + 1 < args.length) {
      paths.push(...args[++i]!.split(','));
    } else if (arg === '--severity' && i + 1 < args.length) {
      severity = args[++i] as AnalysisSeverityFilter;
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
    } else if (arg !== undefined && !arg.startsWith('-')) {
      // Positional arg is a path
      paths.push(arg);
    }
  }

  return {
    subcommand,
    paths,
    severity,
    maxFiles,
    maxLinesPerFile,
    context,
    providerId,
    timeoutMs,
  };
}

/**
 * Shows refactor help
 */
function showRefactorHelp(): CommandResult {
  const helpText = `
${COLORS.bold}AX Refactor - LLM-Delegated Refactoring Analysis${COLORS.reset}

Usage:
  ax refactor scan <paths...> [options]
  ax refactor help

Commands:
  scan      Analyze code for refactoring opportunities using LLM
  help      Show this help message

Scan Options:
  --paths <paths>        Comma-separated paths to analyze
  --severity <level>     Filter by impact: all, high, medium (default: all)
  --max-files <n>        Maximum files to analyze (default: 20)
  --max-lines <n>        Max lines per file (default: 1000)
  --context <text>       Additional context for analysis
  --provider <id>        Specific provider to use
  --timeout <seconds>    Analysis timeout (default: 60)

Impact Levels (mapped to severity):
  high      - Significant improvements (extract functions, remove duplication)
  medium    - Moderate improvements (simplify conditionals, improve types)
  low       - Minor improvements (rename, style improvements)
  info      - Optional suggestions

Refactoring Categories:
  extract-function, extract-variable, simplify-conditional,
  remove-duplication, improve-types, rename, modernize,
  split-responsibility

Examples:
  ax refactor scan src/
  ax refactor scan --paths src/,lib/ --severity high
  ax refactor scan src/services/ --context "Focus on DRY violations"
  ax refactor scan . --max-files 50 --timeout 120
`.trim();

  return {
    success: true,
    message: helpText,
    data: undefined,
    exitCode: 0,
  };
}

/**
 * Formats analysis result for text output
 */
function formatAnalysisResult(result: AnalysisResult, verbose: boolean): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${COLORS.bold}AX Refactor Analysis${COLORS.reset}`);
  lines.push(`Result ID: ${result.resultId}`);
  lines.push(`Files analyzed: ${result.filesAnalyzed.length}`);
  lines.push(`Lines analyzed: ${result.linesAnalyzed}`);
  lines.push(`Provider: ${result.providerId}`);
  lines.push(`Duration: ${result.durationMs}ms`);
  lines.push('');

  if (result.findings.length === 0) {
    lines.push(`${ICONS.applied} No refactoring opportunities detected`);
  } else {
    lines.push(`${ICONS.opportunity} ${result.summary}`);
    lines.push('');

    // Group by severity (impact)
    const bySeverity = result.findings.reduce(
      (acc, finding) => {
        (acc[finding.severity] ??= []).push(finding);
        return acc;
      },
      {} as Record<string, AnalysisFinding[]>
    );

    // Show from low impact to high impact
    for (const severity of ['info', 'low', 'medium', 'high', 'critical']) {
      const findings = bySeverity[severity];
      if (findings && findings.length > 0) {
        const impactColor =
          severity === 'high' || severity === 'critical'
            ? COLORS.yellow
            : severity === 'medium'
              ? COLORS.blue
              : COLORS.dim;
        const impactLabel = severity === 'critical' ? 'HIGH' : severity.toUpperCase();
        lines.push(`${impactColor}${COLORS.bold}${impactLabel} IMPACT${COLORS.reset}`);

        for (const finding of findings) {
          lines.push(`  ${ICONS.opportunity} ${finding.title}`);
          const lineRange =
            finding.lineEnd && finding.lineEnd !== finding.line
              ? `${finding.line}-${finding.lineEnd}`
              : String(finding.line ?? '?');
          lines.push(`    ${COLORS.dim}${finding.file}:${lineRange}${COLORS.reset}`);
          lines.push(
            `    ${COLORS.dim}Category: ${finding.category} | Confidence: ${(finding.confidence * 100).toFixed(0)}%${COLORS.reset}`
          );

          if (verbose) {
            lines.push(`    ${finding.description}`);
            if (finding.suggestion) {
              lines.push(`    ${COLORS.cyan}Suggestion: ${finding.suggestion}${COLORS.reset}`);
            }
            if (finding.codeSnippet) {
              lines.push(`    ${COLORS.dim}Code: ${finding.codeSnippet}${COLORS.reset}`);
            }
          }
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Creates the analysis service with domain dependencies
 */
function createRefactorService() {
  return createAnalysisService({
    contextBuilder: createCodeContextBuilder(),
    promptBuilder: createAnalysisPromptBuilder(),
    responseParser: createAnalysisResponseParser(),
    providerRouter: createAnalysisProviderRouter(),
  });
}

/**
 * Runs refactor analysis
 */
async function runRefactorScan(
  paths: string[],
  options: CLIOptions,
  args: ParsedRefactorArgs
): Promise<CommandResult> {
  if (paths.length === 0) {
    return {
      success: false,
      message: 'Error: At least one path is required\n\nRun "ax refactor help" for usage.',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const service = createRefactorService();
    const result = await service.analyze({
      task: 'refactor',
      paths,
      severity: args.severity,
      maxFiles: args.maxFiles,
      maxLinesPerFile: args.maxLinesPerFile,
      context: args.context,
      providerId: args.providerId,
      timeoutMs: args.timeoutMs,
    });

    if (options.format === 'json') {
      return {
        success: true,
        message: undefined,
        data: result,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: formatAnalysisResult(result, options.verbose),
      data: result,
      exitCode: 0,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during analysis';
    return {
      success: false,
      message: `${ICONS.info} Analysis failed: ${message}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Refactor command handler
 */
export async function refactorCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const parsed = parseRefactorArgs(args);

  switch (parsed.subcommand) {
    case 'scan':
      return runRefactorScan(parsed.paths, options, parsed);

    case 'help':
    default:
      return showRefactorHelp();
  }
}
