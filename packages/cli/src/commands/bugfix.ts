/**
 * Bugfix Command
 *
 * LLM-delegated bug detection and analysis.
 * Usage: ax bugfix scan <paths...> [options]
 *        ax bugfix help
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
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Status icons
 */
const ICONS = {
  bug: `${COLORS.red}\u2717${COLORS.reset}`,
  fix: `${COLORS.green}\u2713${COLORS.reset}`,
  warn: `${COLORS.yellow}\u26A0${COLORS.reset}`,
  info: `${COLORS.cyan}\u2139${COLORS.reset}`,
};

/**
 * Parsed bugfix arguments
 */
interface ParsedBugfixArgs {
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
 * Parses bugfix subcommand and options
 */
function parseBugfixArgs(args: string[]): ParsedBugfixArgs {
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
 * Shows bugfix help
 */
function showBugfixHelp(): CommandResult {
  const helpText = `
${COLORS.bold}AX Bugfix - LLM-Delegated Bug Detection${COLORS.reset}

Usage:
  ax bugfix scan <paths...> [options]
  ax bugfix help

Commands:
  scan      Analyze code for potential bugs using LLM
  help      Show this help message

Scan Options:
  --paths <paths>        Comma-separated paths to analyze
  --severity <level>     Filter results: all, critical, high, medium (default: all)
  --max-files <n>        Maximum files to analyze (default: 20)
  --max-lines <n>        Max lines per file (default: 1000)
  --context <text>       Additional context for analysis
  --provider <id>        Specific provider to use
  --timeout <seconds>    Analysis timeout (default: 60)

Severity Levels:
  critical  - Crashes, security vulnerabilities
  high      - Bugs that cause incorrect behavior
  medium    - Potential issues, edge cases
  low       - Minor issues
  info      - Suggestions and observations

Analysis Categories:
  logic-error, null-reference, type-error, resource-leak,
  security, concurrency, error-handling, edge-case

Examples:
  ax bugfix scan src/
  ax bugfix scan --paths src/,lib/ --severity high
  ax bugfix scan src/api/ --context "Focus on authentication"
  ax bugfix scan . --max-files 50 --timeout 120
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
  lines.push(`${COLORS.bold}AX Bugfix Analysis${COLORS.reset}`);
  lines.push(`Result ID: ${result.resultId}`);
  lines.push(`Files analyzed: ${result.filesAnalyzed.length}`);
  lines.push(`Lines analyzed: ${result.linesAnalyzed}`);
  lines.push(`Provider: ${result.providerId}`);
  lines.push(`Duration: ${result.durationMs}ms`);
  lines.push('');

  if (result.findings.length === 0) {
    lines.push(`${ICONS.fix} No bugs detected`);
  } else {
    lines.push(`${ICONS.bug} ${result.summary}`);
    lines.push('');

    // Group by severity
    const bySeverity = result.findings.reduce(
      (acc, finding) => {
        (acc[finding.severity] ??= []).push(finding);
        return acc;
      },
      {} as Record<string, AnalysisFinding[]>
    );

    for (const severity of ['critical', 'high', 'medium', 'low', 'info']) {
      const findings = bySeverity[severity];
      if (findings && findings.length > 0) {
        const severityColor =
          severity === 'critical'
            ? COLORS.red
            : severity === 'high'
              ? COLORS.yellow
              : COLORS.dim;
        lines.push(`${severityColor}${COLORS.bold}${severity.toUpperCase()}${COLORS.reset}`);

        for (const finding of findings) {
          lines.push(`  ${ICONS.bug} ${finding.title}`);
          lines.push(
            `    ${COLORS.dim}${finding.file}:${finding.line ?? '?'}${COLORS.reset}`
          );
          lines.push(
            `    ${COLORS.dim}Category: ${finding.category} | Confidence: ${(finding.confidence * 100).toFixed(0)}%${COLORS.reset}`
          );

          if (verbose) {
            lines.push(`    ${finding.description}`);
            if (finding.suggestion) {
              lines.push(`    ${COLORS.cyan}Fix: ${finding.suggestion}${COLORS.reset}`);
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
function createBugfixService() {
  return createAnalysisService({
    contextBuilder: createCodeContextBuilder(),
    promptBuilder: createAnalysisPromptBuilder(),
    responseParser: createAnalysisResponseParser(),
    providerRouter: createAnalysisProviderRouter(),
  });
}

/**
 * Runs bugfix analysis
 */
async function runBugfixScan(
  paths: string[],
  options: CLIOptions,
  args: ParsedBugfixArgs
): Promise<CommandResult> {
  if (paths.length === 0) {
    return {
      success: false,
      message: 'Error: At least one path is required\n\nRun "ax bugfix help" for usage.',
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const service = createBugfixService();
    const result = await service.analyze({
      task: 'bugfix',
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
      message: `${ICONS.bug} Analysis failed: ${message}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Bugfix command handler
 */
export async function bugfixCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const parsed = parseBugfixArgs(args);

  switch (parsed.subcommand) {
    case 'scan':
      return runBugfixScan(parsed.paths, options, parsed);

    case 'help':
    default:
      return showBugfixHelp();
  }
}
