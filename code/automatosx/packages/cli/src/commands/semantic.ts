import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { parseCommandArgs } from '../utils/command-args.js';
import { parseOptionalJsonInput, splitCommaList } from '../utils/validation.js';

const SEMANTIC_HELP = `Usage: ax semantic <subcommand> [options]

Subcommands:
  store <key>     Store a semantic entry (content from --content or stdin)
  search <query>  Semantic search across stored entries
  list            List entries (optionally filtered by namespace or key prefix)
  get <key>       Retrieve a single semantic entry by key
  delete <key>    Remove a semantic entry
  clear           Remove all entries in a namespace
  stats           Show per-namespace semantic storage statistics

Options:
  --namespace <ns>    Scope to a specific namespace
  --content <text>    Content to embed and store (for "store")
  --tags <a,b,c>      Comma-separated tags (for "store")
  --input <json>      Metadata JSON (for "store")
  --top-k <n>         Max results to return from "search" (default: 5)
  --min-similarity    Minimum cosine similarity threshold 0..1 (default: 0)
  --key-prefix <p>    Filter "list" by key prefix
  --format json       Output raw JSON

Examples:
  ax semantic store arch.decision --content "We use event sourcing for audit trails" --tags architecture,audit
  ax semantic search "audit trail patterns" --top-k 3
  ax semantic list --namespace architecture
  ax semantic get arch.decision
  ax semantic stats
  ax semantic delete arch.decision
  ax semantic clear --namespace scratch
`;

export async function semanticCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (options.help || args[0] === 'help' || args.length === 0) {
    return success(SEMANTIC_HELP.trim());
  }

  const subcommand = args[0];
  const parsedArgs = parseSemanticArgs(args.slice(1), options);
  if (parsedArgs.error !== undefined) {
    return failure(parsedArgs.error);
  }

  const runtime = createRuntime(options);
  const namespace = parsedArgs.namespace;

  switch (subcommand) {
    case 'store': {
      const key = parsedArgs.positionals[0];
      if (key === undefined || key.trim().length === 0) {
        return usageError('ax semantic store <key> --content <text>');
      }

      const content = parsedArgs.content ?? parsedArgs.positionals.slice(1).join(' ');
      if (content.trim().length === 0) {
        return usageError('ax semantic store <key> --content <text>');
      }

      const metadata = parseOptionalJsonInput(options.input, 'Semantic metadata');
      if (metadata.error !== undefined) {
        return failure(metadata.error);
      }

      const entry = await runtime.storeSemantic({
        key,
        namespace,
        content,
        tags: parsedArgs.tags,
        metadata: metadata.value,
      });
      const tags = parsedArgs.tags;
      const tagLabel = tags && tags.length > 0 ? `  Tags: ${tags.join(', ')}` : '';
      const lines = [
        `Semantic entry stored: ${entry.key}`,
        `  Namespace: ${entry.namespace ?? 'default'}`,
        ...(tagLabel ? [tagLabel] : []),
      ];
      return success(lines.join('\n'), entry);
    }

    case 'search': {
      const query = parsedArgs.positionals.join(' ');
      if (query.trim().length === 0) {
        return usageError('ax semantic search <query>');
      }

      const results = await runtime.searchSemantic(query, {
        namespace,
        filterTags: parsedArgs.tags,
        topK: parsedArgs.topK,
        minSimilarity: parsedArgs.minSimilarity,
      });

      if (results.length === 0) {
        return success(`No semantic entries matched "${query}".`, results);
      }

      const lines = [
        `Found ${results.length} result(s) for "${query}":`,
        ...results.map((r) => {
          const sim = typeof r.score === 'number' ? ` (${(r.score * 100).toFixed(1)}%)` : '';
          const contentPreview = r.content.length > 100
            ? `${r.content.slice(0, 100)}…`
            : r.content;
          const nsLabel = r.namespace && r.namespace !== 'default' ? ` [${r.namespace}]` : '';
          const tagsLabel = r.tags && r.tags.length > 0 ? ` #${r.tags.join(' #')}` : '';
          return `  ${r.key}${nsLabel}${sim}${tagsLabel}\n    ${contentPreview}`;
        }),
      ];
      return success(lines.join('\n'), results);
    }

    case 'list': {
      const entries = await runtime.listSemantic({
        namespace,
        keyPrefix: parsedArgs.keyPrefix,
        filterTags: parsedArgs.tags,
        limit: parsedArgs.limit,
      });
      if (entries.length === 0) {
        const hint = namespace !== undefined ? ` in namespace "${namespace}"` : '';
        return success(`No semantic entries${hint}.`, entries);
      }

      const lines = [
        `Semantic entries (${entries.length})${namespace !== undefined ? ` [ns: ${namespace}]` : ''}:`,
        ...entries.map((entry) => {
          const nsLabel = entry.namespace && entry.namespace !== 'default' ? ` [${entry.namespace}]` : '';
          const tagsLabel = entry.tags && entry.tags.length > 0 ? ` #${entry.tags.join(' #')}` : '';
          const preview = entry.content.length > 80 ? `${entry.content.slice(0, 80)}…` : entry.content;
          return `  ${entry.key}${nsLabel}${tagsLabel}: ${preview}`;
        }),
      ];
      return success(lines.join('\n'), entries);
    }

    case 'get': {
      const key = parsedArgs.positionals[0];
      if (key === undefined || key.trim().length === 0) {
        return usageError('ax semantic get <key>');
      }

      const entry = await runtime.getSemantic(key, namespace);
      if (entry === undefined) {
        const nsHint = namespace !== undefined ? ` in namespace "${namespace}"` : '';
        return failure(`Semantic entry not found: ${key}${nsHint}`);
      }

      const lines = [
        `Key: ${entry.key}`,
        `Namespace: ${entry.namespace ?? 'default'}`,
        ...(entry.tags && entry.tags.length > 0 ? [`Tags: ${entry.tags.join(', ')}`] : []),
        `Updated: ${entry.updatedAt}`,
        `Content:\n${entry.content}`,
      ];
      return success(lines.join('\n'), entry);
    }

    case 'delete': {
      const key = parsedArgs.positionals[0];
      if (key === undefined || key.trim().length === 0) {
        return usageError('ax semantic delete <key>');
      }

      const removed = await runtime.deleteSemantic(key, namespace);
      if (!removed) {
        const nsHint = namespace !== undefined ? ` in namespace "${namespace}"` : '';
        return failure(`Semantic entry not found: ${key}${nsHint}`);
      }
      return success(`Semantic entry deleted: ${key}`, { deleted: true, key, namespace });
    }

    case 'clear': {
      if (namespace === undefined || namespace.trim().length === 0) {
        return usageError('ax semantic clear --namespace <namespace>  (namespace required to prevent accidental data loss)');
      }

      const count = await runtime.clearSemantic(namespace);
      return success(`Cleared ${count} semantic entry/entries from namespace "${namespace}".`, { cleared: count, namespace });
    }

    case 'stats': {
      const stats = await runtime.semanticStats(namespace);
      if (stats.length === 0) {
        return success('No semantic entries found.', stats);
      }

      const lines = [
        'Semantic storage statistics:',
        ...stats.map((s) => `  ${s.namespace}: ${s.totalItems} entry/entries, ${s.uniqueTags} unique tag(s)`),
      ];
      return success(lines.join('\n'), stats);
    }

    default:
      return usageError('ax semantic [store|search|list|get|delete|clear|stats]');
  }
}

interface ParsedSemanticArgs {
  positionals: string[];
  namespace?: string;
  content?: string;
  tags?: string[];
  topK?: number;
  minSimilarity?: number;
  keyPrefix?: string;
  limit?: number;
  error?: string;
}

function parseSemanticArgs(args: string[], options: CLIOptions): ParsedSemanticArgs {
  const parsed = parseCommandArgs<Omit<ParsedSemanticArgs, 'positionals' | 'error'>>({
    args,
    initial: {
      namespace: undefined,
      content: undefined,
      tags: options.tags,
      topK: undefined,
      minSimilarity: undefined,
      keyPrefix: undefined,
      limit: options.limit,
    },
    flags: {
      namespace: {
        kind: 'string',
        apply: (state, value) => {
          state.namespace = value;
        },
      },
      content: {
        kind: 'string',
        apply: (state, value) => {
          state.content = value;
        },
      },
      tags: {
        kind: 'string',
        apply: (state, value) => {
          state.tags = splitCommaList(value);
        },
      },
      'top-k': {
        kind: 'string',
        aliases: ['topK'],
        apply: (state, value) => {
          const topK = parseOptionalPositiveInt(value);
          if (topK.error !== undefined) {
            return topK.error;
          }
          state.topK = topK.value;
        },
      },
      'min-similarity': {
        kind: 'string',
        aliases: ['minSimilarity'],
        apply: (state, value) => {
          const minSimilarity = parseOptionalFloat(value);
          if (minSimilarity.error !== undefined) {
            return minSimilarity.error;
          }
          state.minSimilarity = minSimilarity.value;
        },
      },
      'key-prefix': {
        kind: 'string',
        aliases: ['keyPrefix'],
        apply: (state, value) => {
          state.keyPrefix = value;
        },
      },
      limit: {
        kind: 'string',
        apply: (state, value) => {
          const limit = parseOptionalPositiveInt(value);
          if (limit.error !== undefined) {
            return limit.error;
          }
          state.limit = limit.value;
        },
      },
    },
    unknownFlagMessage: (token) => `Unknown semantic flag: ${token}.`,
  });

  if (parsed.error !== undefined) {
    return {
      positionals: parsed.positionals,
      ...parsed.value,
      error: parsed.error,
    };
  }

  return {
    positionals: parsed.positionals,
    ...parsed.value,
  };
}

interface IntResult {
  value: number | undefined;
  error?: string;
}

function parseOptionalPositiveInt(value: string | undefined): IntResult {
  if (value === undefined) return { value: undefined };
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) {
    return { value: undefined, error: `Expected a positive integer, got: ${value}` };
  }
  return { value: n };
}

interface FloatResult {
  value: number | undefined;
  error?: string;
}

function parseOptionalFloat(value: string | undefined): FloatResult {
  if (value === undefined) return { value: undefined };
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return { value: undefined, error: `--min-similarity must be a number between 0 and 1, got: ${value}` };
  }
  return { value: n };
}
