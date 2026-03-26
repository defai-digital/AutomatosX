/**
 * CLI configuration options.
 */
export interface CLIOptions {
  /**
   * Show help output.
   */
  help: boolean;

  /**
   * Print version information.
   */
  version: boolean;

  /**
   * Enable verbose output.
   */
  verbose: boolean;

  /**
   * Output format.
   */
  format: 'text' | 'json';

  /**
   * Optional global workflow directory override.
   */
  workflowDir: string | undefined;

  /**
   * Workflow id selected by generic run options.
   */
  workflowId: string | undefined;

  /**
   * Optional trace id override.
   */
  traceId: string | undefined;

  /**
   * Optional session id for correlating runtime activity.
   */
  sessionId?: string;

  /**
   * Limit for list-like command output.
   */
  limit: number | undefined;

  /**
   * JSON payload passed through run input.
   */
  input: string | undefined;

  /**
   * Enable iterate mode.
   */
  iterate: boolean;

  /**
   * Max iterate rounds.
   */
  maxIterations: number | undefined;

  /**
   * Max run time for iterate mode.
   */
  maxTime: string | undefined;

  /**
   * Disable context loading when iterating.
   */
  noContext: boolean;

  /**
   * Capability category filter.
   */
  category: string | undefined;

  /**
   * Tag filter list.
   */
  tags: string[] | undefined;

  /**
   * Selected agent override.
   */
  agent: string | undefined;

  /**
   * Task text override.
   */
  task: string | undefined;

  /**
   * Optional core override.
   */
  core: string | undefined;

  /**
   * Max token override.
   */
  maxTokens: number | undefined;

  /**
   * Optional refresh interval for status output.
   */
  refresh: number | undefined;

  /**
   * Trace status filter for history-like output.
   */
  status?: string;

  /**
   * Compact output formatting.
   */
  compact: boolean;

  /**
   * Team filter.
   */
  team: string | undefined;

  /**
   * Optional provider override.
   */
  provider?: string;

  /**
   * Command output directory.
   */
  outputDir?: string;

  /**
   * Internal runtime workspace base path override.
   */
  basePath?: string;

  /**
   * Dry-run mode.
   */
  dryRun?: boolean;

  /**
   * Quiet mode.
   */
  quiet?: boolean;
}

/**
 * Parsed command from CLI arguments.
 */
export interface ParsedCommand {
  command: string;
  args: string[];
  options: CLIOptions;
  parseError?: string;
}

/**
 * CLI command result.
 */
export interface CommandResult {
  success: boolean;
  message: string | undefined;
  data: unknown;
  exitCode: number;
}

/**
 * Command handler function.
 */
export type CommandHandler = (
  args: string[],
  options: CLIOptions
) => Promise<CommandResult>;
