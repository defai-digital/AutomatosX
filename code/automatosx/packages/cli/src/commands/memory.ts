import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { parseCommandArgs } from '../utils/command-args.js';
import { parseJsonValueString } from '../utils/validation.js';

const MEMORY_HELP = `Usage: ax memory <subcommand> [options]

Subcommands:
  list                     List all memory entries (optionally filter by namespace)
  get <key>                Retrieve a memory entry by key
  set <key> <value>        Store a memory entry (value is a plain string)
  set <key> --input <json> Store a memory entry with structured JSON value
  search <query>           Full-text search across memory entries
  delete <key>             Remove a memory entry

Options:
  --namespace <ns>   Scope to a specific namespace (default: global)
  --format json      Output raw JSON

Examples:
  ax memory list
  ax memory list --namespace agents
  ax memory get project.goal
  ax memory set project.goal "Build a multi-agent platform"
  ax memory set project.config --input '{"provider":"claude","model":"opus"}'
  ax memory search "authentication"
  ax memory delete project.goal
`;

export async function memoryCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (options.help || args[0] === 'help' || args.length === 0) {
    return success(MEMORY_HELP.trim());
  }

  const subcommand = args[0];
  const parsedArgs = parseMemoryArgs(args.slice(1));
  if (parsedArgs.error !== undefined) {
    return failure(parsedArgs.error);
  }

  const runtime = createRuntime(options);
  const namespace = parsedArgs.namespace;

  switch (subcommand) {
    case 'list': {
      const entries = await runtime.listMemory(namespace);
      if (entries.length === 0) {
        const nsHint = namespace !== undefined ? ` in namespace "${namespace}"` : '';
        return success(`No memory entries${nsHint}.`, entries);
      }

      const lines = [
        `Memory entries (${entries.length})${namespace !== undefined ? ` [ns: ${namespace}]` : ''}:`,
        ...entries.map((entry) => {
          const valPreview = formatValuePreview(entry.value);
          const nsLabel = entry.namespace && entry.namespace !== 'default' ? ` [${entry.namespace}]` : '';
          return `  ${entry.key}${nsLabel}: ${valPreview}`;
        }),
      ];
      return success(lines.join('\n'), entries);
    }

    case 'get': {
      const key = parsedArgs.positionals[0];
      if (key === undefined || key.trim().length === 0) {
        return usageError('ax memory get <key>');
      }

      const entry = await runtime.getMemory(key, namespace);
      if (entry === undefined) {
        const nsHint = namespace !== undefined ? ` in namespace "${namespace}"` : '';
        return failure(`Memory key not found: ${key}${nsHint}`);
      }

      const lines = [
        `Key: ${entry.key}`,
        `Namespace: ${entry.namespace ?? 'default'}`,
        `Updated: ${entry.updatedAt}`,
        `Value: ${typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value, null, 2)}`,
      ];
      return success(lines.join('\n'), entry);
    }

    case 'set': {
      const key = parsedArgs.positionals[0];
      if (key === undefined || key.trim().length === 0) {
        return usageError('ax memory set <key> <value>  OR  ax memory set <key> --input <json>');
      }

      let value: unknown;
      if (options.input !== undefined) {
        const parsed = parseJsonValueString(options.input, {
          invalidJsonMessage: 'Invalid JSON in --input. Provide a valid JSON value.',
          invalidValueMessage: 'Invalid JSON in --input. Provide a valid JSON value.',
        });
        if (parsed.error !== undefined) {
          return failure(parsed.error);
        }
        value = parsed.value;
      } else {
        const rawValue = parsedArgs.positionals.slice(1).join(' ');
        if (rawValue.trim().length === 0) {
          return usageError('ax memory set <key> <value>  OR  ax memory set <key> --input <json>');
        }
        value = rawValue;
      }

      const entry = await runtime.storeMemory({ key, namespace, value });
      return success(`Memory stored: ${entry.key}`, entry);
    }

    case 'search': {
      const query = parsedArgs.positionals.join(' ');
      if (query.trim().length === 0) {
        return usageError('ax memory search <query>');
      }

      const results = await runtime.searchMemory(query, namespace);
      if (results.length === 0) {
        return success(`No memory entries matched "${query}".`, results);
      }

      const lines = [
        `Found ${results.length} memory entry/entries matching "${query}":`,
        ...results.map((entry) => {
          const valPreview = formatValuePreview(entry.value);
          const nsLabel = entry.namespace && entry.namespace !== 'default' ? ` [${entry.namespace}]` : '';
          return `  ${entry.key}${nsLabel}: ${valPreview}`;
        }),
      ];
      return success(lines.join('\n'), results);
    }

    case 'delete': {
      const key = parsedArgs.positionals[0];
      if (key === undefined || key.trim().length === 0) {
        return usageError('ax memory delete <key>');
      }

      const removed = await runtime.deleteMemory(key, namespace);
      if (!removed) {
        const nsHint = namespace !== undefined ? ` in namespace "${namespace}"` : '';
        return failure(`Memory key not found: ${key}${nsHint}`);
      }
      return success(`Memory deleted: ${key}`, { deleted: true, key, namespace });
    }

    default:
      return usageError('ax memory [list|get|set|search|delete]');
  }
}

interface ParsedMemoryArgs {
  positionals: string[];
  namespace?: string;
  error?: string;
}

function parseMemoryArgs(args: string[]): ParsedMemoryArgs {
  const parsed = parseCommandArgs<{ namespace?: string }>({
    args,
    initial: {},
    flags: {
      namespace: {
        kind: 'string',
        apply: (state, value) => {
          state.namespace = value;
        },
      },
    },
    unknownFlagMessage: (token) => `Unknown memory flag: ${token}.`,
  });

  if (parsed.error !== undefined) {
    return {
      positionals: parsed.positionals,
      namespace: parsed.value.namespace,
      error: parsed.error,
    };
  }

  return {
    positionals: parsed.positionals,
    namespace: parsed.value.namespace,
  };
}

function formatValuePreview(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  }
  const json = JSON.stringify(value);
  return json.length > 80 ? `${json.slice(0, 80)}…` : json;
}
