import type { ParsedCommand, CLIOptions } from './types.js';

/**
 * Default CLI options
 */
const DEFAULT_OPTIONS: CLIOptions = {
  help: false,
  version: false,
  verbose: false,
  format: 'text',
  workflowDir: undefined,
  workflowId: undefined,
  traceId: undefined,
  limit: undefined,
  input: undefined,
  // Iterate mode defaults
  iterate: false,
  maxIterations: undefined,
  maxTime: undefined,
  noContext: false,
  // Ability-related defaults
  category: undefined,
  tags: undefined,
  agent: undefined,
  task: undefined,
  core: undefined,
  maxTokens: undefined,
};

/**
 * Global options that are handled by the parser
 */
const GLOBAL_OPTIONS = new Set([
  'help',
  'version',
  'verbose',
  'format',
  'workflow-dir',
  'workflow-id',
  'trace-id',
  'limit',
  'input',
  // Iterate mode options
  'iterate',
  'max-iterations',
  'max-time',
  'no-context',
  // Ability-related options
  'category',
  'tags',
  'agent',
  'task',
  'core',
  'max-tokens',
]);

const GLOBAL_SHORT_FLAGS = new Set(['h', 'v', 'V']);

/**
 * Parses CLI arguments into a command and options
 */
export function parseArgs(argv: string[]): ParsedCommand {
  // Skip node and script name
  const args = argv.slice(2);
  const options: CLIOptions = { ...DEFAULT_OPTIONS };
  const positionalArgs: string[] = [];
  const commandArgs: string[] = []; // Args to pass through to command
  let command = 'help';

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === undefined) {
      i++;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if this is a global option
      if (!GLOBAL_OPTIONS.has(key)) {
        // Pass unknown flags through to command
        commandArgs.push(arg);
        i++;
        continue;
      }

      switch (key) {
        case 'help':
          options.help = true;
          break;
        case 'version':
          options.version = true;
          break;
        case 'verbose':
          options.verbose = true;
          break;
        case 'format':
          if (nextArg === 'json' || nextArg === 'text') {
            options.format = nextArg;
            i++;
          }
          break;
        case 'workflow-dir':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.workflowDir = nextArg;
            i++;
          }
          break;
        case 'workflow-id':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.workflowId = nextArg;
            i++;
          }
          break;
        case 'trace-id':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.traceId = nextArg;
            i++;
          }
          break;
        case 'limit':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            const num = parseInt(nextArg, 10);
            if (!isNaN(num)) {
              options.limit = num;
            }
            i++;
          }
          break;
        case 'input':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.input = nextArg;
            i++;
          }
          break;
        // Iterate mode options
        case 'iterate':
          options.iterate = true;
          break;
        case 'max-iterations':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            const num = parseInt(nextArg, 10);
            if (!isNaN(num)) {
              options.maxIterations = num;
            }
            i++;
          }
          break;
        case 'max-time':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.maxTime = nextArg;
            i++;
          }
          break;
        case 'no-context':
          options.noContext = true;
          break;
        // Ability-related options
        case 'category':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.category = nextArg;
            i++;
          }
          break;
        case 'tags':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.tags = nextArg.split(',').map((t) => t.trim());
            i++;
          }
          break;
        case 'agent':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.agent = nextArg;
            i++;
          }
          break;
        case 'task':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.task = nextArg;
            i++;
          }
          break;
        case 'core':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            options.core = nextArg;
            i++;
          }
          break;
        case 'max-tokens':
          if (nextArg !== undefined && !nextArg.startsWith('-')) {
            const num = parseInt(nextArg, 10);
            if (!isNaN(num)) {
              options.maxTokens = num;
            }
            i++;
          }
          break;
      }
    } else if (arg.startsWith('-')) {
      // Short flags - check if all are global
      const flags = arg.slice(1);
      let allGlobal = true;
      for (const flag of flags) {
        if (!GLOBAL_SHORT_FLAGS.has(flag)) {
          allGlobal = false;
          break;
        }
      }

      if (!allGlobal) {
        // Pass through to command if any flag is not global
        commandArgs.push(arg);
      } else {
        // Process global short flags
        for (const flag of flags) {
          switch (flag) {
            case 'h':
              options.help = true;
              break;
            case 'v':
              options.verbose = true;
              break;
            case 'V':
              options.version = true;
              break;
          }
        }
      }
    } else {
      positionalArgs.push(arg);
    }

    i++;
  }

  // First positional arg is the command
  if (positionalArgs.length > 0) {
    command = positionalArgs[0] ?? 'help';
  }

  // Handle --help and --version as commands
  if (options.help && positionalArgs.length === 0) {
    command = 'help';
  }
  if (options.version && positionalArgs.length === 0) {
    command = 'version';
  }

  return {
    command,
    args: [...positionalArgs.slice(1), ...commandArgs],
    options,
  };
}

/**
 * Formats output based on format option
 */
export function formatOutput(
  data: unknown,
  format: 'text' | 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => formatOutput(item, 'text')).join('\n');
  }

  if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n');
  }

  return String(data);
}

/**
 * Parses a time string (e.g., "5m", "1h", "30s") into milliseconds
 */
export function parseTime(timeStr: string): number {
  const match = /^(\d+)(s|m|h)$/.exec(timeStr);
  if (match === null) {
    throw new Error(
      `Invalid time format: "${timeStr}". Use formats like: 30s, 5m, 1h`
    );
  }

  const value = parseInt(match[1] ?? '0', 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}
