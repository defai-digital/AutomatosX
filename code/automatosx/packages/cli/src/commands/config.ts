import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';

export async function configCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0] ?? 'show';
  const runtime = createRuntime(options);

  switch (subcommand) {
    case 'show': {
      const config = await runtime.showConfig();
      return success([
        'Workspace config:',
        JSON.stringify(config, null, 2),
      ].join('\n'), config);
    }
    case 'get': {
      const path = args[1];
      if (path === undefined || path.length === 0) {
        return usageError('ax config get <path>');
      }

      const value = await runtime.getConfig(path);
      return success([
        `Config value: ${path}`,
        JSON.stringify(value, null, 2),
      ].join('\n'), value);
    }
    case 'set': {
      const path = args[1];
      if (path === undefined || path.length === 0) {
        return usageError('ax config set <path> <value>|--input <json-value>');
      }

      const parsed = parseConfigValue(args.slice(2), options.input);
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const config = await runtime.setConfig(path, parsed.value);
      return success(`Updated config path: ${path}`, config);
    }
    default:
      return usageError('ax config [show|get|set]');
  }
}

function parseConfigValue(args: string[], input: string | undefined): { value: unknown; error?: string } {
  const source = input ?? args.join(' ').trim();
  if (source.length === 0) {
    return { value: undefined, error: 'Config set requires a value via --input <json-value> or a trailing argument.' };
  }

  try {
    return { value: JSON.parse(source) };
  } catch {
    if (input !== undefined) {
      return { value: undefined, error: 'Invalid JSON input. Please provide a valid JSON value.' };
    }
    return { value: source };
  }
}
