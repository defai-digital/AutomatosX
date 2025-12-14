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
};

/**
 * Parses CLI arguments into a command and options
 */
export function parseArgs(argv: string[]): ParsedCommand {
  // Skip node and script name
  const args = argv.slice(2);
  const options: CLIOptions = { ...DEFAULT_OPTIONS };
  const positionalArgs: string[] = [];
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
      }
    } else if (arg.startsWith('-')) {
      // Short flags
      const flags = arg.slice(1);
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
    args: positionalArgs.slice(1),
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
