/**
 * CLI configuration options
 */
export interface CLIConfig {
  /**
   * Path to workflow files directory
   */
  workflowDir: string | undefined;

  /**
   * Enable verbose output
   */
  verbose: boolean;

  /**
   * Output format
   */
  format: 'text' | 'json';
}

/**
 * Parsed command from CLI arguments
 */
export interface ParsedCommand {
  command: string;
  args: string[];
  options: CLIOptions;
}

/**
 * CLI options parsed from arguments
 */
export interface CLIOptions {
  help: boolean;
  version: boolean;
  verbose: boolean;
  format: 'text' | 'json';
  workflowDir: string | undefined;
  workflowId: string | undefined;
  traceId: string | undefined;
  limit: number | undefined;
  input: string | undefined;
  // Iterate mode options
  iterate: boolean;
  maxIterations: number | undefined;
  maxTime: string | undefined;
  noContext: boolean;
  // Ability-related options
  category: string | undefined;
  tags: string[] | undefined;
  agent: string | undefined;
  task: string | undefined;
  core: string | undefined;
  maxTokens: number | undefined;
  // Status display options
  refresh: number | undefined;
  compact: boolean;
  // Agent filter options
  team: string | undefined;
  // Provider options
  provider: string | undefined;
}

/**
 * Command handler result
 */
export interface CommandResult {
  success: boolean;
  message: string | undefined;
  data: unknown;
  exitCode: number;
}

/**
 * Command handler function
 */
export type CommandHandler = (
  args: string[],
  options: CLIOptions
) => Promise<CommandResult>;

/**
 * Available CLI commands
 */
export const CLI_COMMANDS = {
  RUN: 'run',
  LIST: 'list',
  TRACE: 'trace',
  DOCTOR: 'doctor',
  GUARD: 'guard',
  CALL: 'call',
  AGENT: 'agent',
  ABILITY: 'ability',
  SESSION: 'session',
  SETUP: 'setup',
  CONFIG: 'config',
  REVIEW: 'review',
  SCAFFOLD: 'scaffold',
  DISCUSS: 'discuss',
  HELP: 'help',
  VERSION: 'version',
  // High-value additions
  RESUME: 'resume',
  HISTORY: 'history',
  STATUS: 'status',
  CLEANUP: 'cleanup',
  ITERATE: 'iterate',
  UPDATE: 'update',
  MONITOR: 'monitor',
} as const;

export type CLICommand = (typeof CLI_COMMANDS)[keyof typeof CLI_COMMANDS];
