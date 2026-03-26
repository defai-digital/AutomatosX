import type { CLIOptions, CommandResult } from '../types.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { parseCommandArgs } from '../utils/command-args.js';
import { asOptionalRecord, asStringArray, parseJsonValueString } from '../utils/validation.js';
import type { RuntimeParallelTask } from '@defai.digital/shared-runtime';

const PARALLEL_HELP = `Usage: ax parallel <subcommand> [options]

Subcommands:
  plan    Validate and dry-run a parallel agent DAG (no execution)
  run     Execute a bounded parallel agent DAG

Options:
  --input <json>          Tasks array as JSON (array of task objects)
  --tasks <json>          Alias for --input
  --max-concurrent <n>    Max tasks running at once (default: unbounded)
  --failure-strategy      failFast | failSafe (default: failFast)
  --result-aggregation    list | merge (default: list)
  --session <id>          Attach all tasks to a session
  --trace <id>            Use an explicit trace ID for the run
  --format json           Output raw JSON result

Task object fields:
  taskId       (required) Unique ID for the task
  agentId      (required) Agent to execute the task
  task         Human-readable description of the task
  input        Input data for the task
  dependencies Array of taskIds this task depends on
  priority     Numeric priority (higher = run first)
  provider     Provider override
  model        Model override
  timeoutMs    Per-task timeout in ms

Examples:
  ax parallel plan --input '[{"taskId":"a","agentId":"agent-1","task":"Analyse auth"},{"taskId":"b","agentId":"agent-2","task":"Analyse perf"}]'
  ax parallel run --input '[{"taskId":"a","agentId":"agent-1"},{"taskId":"b","agentId":"agent-2","dependencies":["a"]}]'
  ax parallel run --input '[...]' --max-concurrent 2 --failure-strategy failSafe
`;

export async function parallelCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (options.help || args[0] === 'help' || args.length === 0) {
    return success(PARALLEL_HELP.trim());
  }

  const subcommand = args[0];
  const parsedArgs = parseParallelArgs(args.slice(1), options);
  if (parsedArgs.error !== undefined) {
    return failure(parsedArgs.error);
  }

  const runtime = createRuntime(options);
  const traceId = parsedArgs.traceId ?? options.traceId;
  const sessionId = parsedArgs.sessionId ?? options.sessionId;

  switch (subcommand) {
    case 'plan': {
      if (parsedArgs.rawInput === undefined) {
        return failure('Command requires --input <json-tasks> or --tasks <json-tasks>.');
      }

      const parsed = parseJsonValueString(parsedArgs.rawInput, {
        invalidJsonMessage: 'Invalid JSON input. Please provide a valid tasks array or {"tasks":[...]} wrapper.',
        invalidValueMessage: 'Tasks input must be a JSON array or an object containing a "tasks" array.',
      });
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const tasks = parseTasks(parsed.value);
      if (tasks.error !== undefined) {
        return failure(tasks.error);
      }

      const plan = await runtime.planParallel({ tasks: tasks.value });

      if (!plan.valid) {
        const lines = [
          'Parallel plan validation failed:',
          ...plan.errors.map((e) => `  ✗ ${e}`),
        ];
        return failure(lines.join('\n'), { valid: false, errors: plan.errors });
      }

      const lines = [
        `Parallel plan valid — ${tasks.value.length} task(s), ${plan.layers.length} execution layer(s)`,
        '',
        'Execution order:',
        ...plan.layers.map((layer, i) => `  Layer ${i + 1}: ${layer.join(', ')}`),
      ];
      return success(lines.join('\n'), plan);
    }

    case 'run': {
      if (parsedArgs.rawInput === undefined) {
        return failure('Command requires --input <json-tasks> or --tasks <json-tasks>.');
      }

      const parsed = parseJsonValueString(parsedArgs.rawInput, {
        invalidJsonMessage: 'Invalid JSON input. Please provide a valid tasks array or {"tasks":[...]} wrapper.',
        invalidValueMessage: 'Tasks input must be a JSON array or an object containing a "tasks" array.',
      });
      if (parsed.error !== undefined) {
        return failure(parsed.error);
      }

      const tasks = parseTasks(parsed.value);
      if (tasks.error !== undefined) {
        return failure(tasks.error);
      }

      const result = await runtime.runParallel({
        tasks: tasks.value,
        traceId,
        sessionId,
        surface: 'cli',
        maxConcurrent: parsedArgs.maxConcurrent,
        failureStrategy: parsedArgs.failureStrategy,
        resultAggregation: parsedArgs.resultAggregation,
      });

      const succeeded = result.results.filter((r) => r.status === 'completed').length;
      const failed = result.results.filter((r) => r.status === 'failed').length;
      const skipped = result.results.filter((r) => r.status === 'skipped').length;
      const dur = result.totalDurationMs < 1000
        ? `${result.totalDurationMs}ms`
        : `${(result.totalDurationMs / 1000).toFixed(1)}s`;

      const lines = [
        result.success
          ? `✓ Parallel run complete — ${succeeded}/${result.results.length} tasks succeeded in ${dur}`
          : `✗ Parallel run failed — ${failed} failed, ${skipped} skipped, ${succeeded} succeeded in ${dur}`,
        `  Trace: ${result.traceId}`,
        `  Strategy: ${result.failureStrategy} · Aggregation: ${result.resultAggregation}`,
        '',
        'Task results:',
        ...result.results.map((r) => {
          const icon = r.status === 'completed' ? '✓' : r.status === 'failed' ? '✗' : '–';
          const suffix = r.error?.message ? `  [${r.error.message}]` : '';
          return `  ${icon} ${r.taskId} (${r.agentId}) — ${r.status}${suffix}`;
        }),
      ];

      if (!result.success && result.error?.message !== undefined) {
        lines.push('', `Error: ${result.error.message}`);
      }

      const message = lines.join('\n');
      return result.success
        ? success(message, result)
        : failure(message, result);
    }

    default:
      return usageError('ax parallel [plan|run] --input <tasks-json>');
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ParsedTasks {
  value: RuntimeParallelTask[];
  error?: string;
}

function parseTasks(input: unknown): ParsedTasks {
  if (Array.isArray(input)) {
    return validateTasks(input);
  }

  const record = asOptionalRecord(input);
  if (record !== undefined && Array.isArray(record['tasks'])) {
    return validateTasks(record['tasks']);
  }

  return { value: [], error: 'Tasks must be a JSON array. Use --input \'[{"taskId":"...","agentId":"..."},...]\'' };
}

function validateTasks(raw: unknown[]): ParsedTasks {
  const tasks: RuntimeParallelTask[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return { value: [], error: `Task at index ${i} must be an object.` };
    }
    const obj = asOptionalRecord(item);
    if (obj === undefined) {
      return { value: [], error: `Task at index ${i} must be an object.` };
    }
    if (typeof obj['taskId'] !== 'string' || obj['taskId'].trim().length === 0) {
      return { value: [], error: `Task at index ${i} is missing a non-empty "taskId" string.` };
    }
    if (typeof obj['agentId'] !== 'string' || obj['agentId'].trim().length === 0) {
      return { value: [], error: `Task at index ${i} is missing a non-empty "agentId" string.` };
    }
    tasks.push({
      taskId: obj['taskId'],
      agentId: obj['agentId'],
      task: typeof obj['task'] === 'string' ? obj['task'] : undefined,
      input: asOptionalRecord(obj['input']),
      dependencies: asStringArray(obj['dependencies']),
      priority: typeof obj['priority'] === 'number' ? obj['priority'] : undefined,
      provider: typeof obj['provider'] === 'string' ? obj['provider'] : undefined,
      model: typeof obj['model'] === 'string' ? obj['model'] : undefined,
      timeoutMs: typeof obj['timeoutMs'] === 'number' ? obj['timeoutMs'] : undefined,
    });
  }
  return { value: tasks };
}

interface ParsedParallelArgs {
  rawInput?: string;
  maxConcurrent?: number;
  failureStrategy?: 'failFast' | 'failSafe';
  resultAggregation?: 'list' | 'merge';
  sessionId?: string;
  traceId?: string;
  error?: string;
}

function parseParallelArgs(args: string[], options: CLIOptions): ParsedParallelArgs {
  const parsed = parseCommandArgs<ParsedParallelArgs>({
    args,
    initial: {
      rawInput: options.input,
    },
    flags: {
      tasks: {
        kind: 'string',
        apply: (state, value) => {
          state.rawInput = value;
        },
      },
      'max-concurrent': {
        kind: 'string',
        aliases: ['maxConcurrent'],
        apply: (state, value) => {
          const maxConcurrent = parseOptionalInt(value);
          if (maxConcurrent.error !== undefined) {
            return maxConcurrent.error;
          }
          state.maxConcurrent = maxConcurrent.value;
        },
      },
      'failure-strategy': {
        kind: 'string',
        aliases: ['failureStrategy'],
        apply: (state, value) => {
          const failureStrategy = normalizeFailureStrategy(value);
          if (failureStrategy.error !== undefined) {
            return failureStrategy.error;
          }
          state.failureStrategy = failureStrategy.value;
        },
      },
      'result-aggregation': {
        kind: 'string',
        aliases: ['resultAggregation'],
        apply: (state, value) => {
          const resultAggregation = normalizeResultAggregation(value);
          if (resultAggregation.error !== undefined) {
            return resultAggregation.error;
          }
          state.resultAggregation = resultAggregation.value;
        },
      },
      session: {
        kind: 'string',
        apply: (state, value) => {
          state.sessionId = value;
        },
      },
      trace: {
        kind: 'string',
        apply: (state, value) => {
          state.traceId = value;
        },
      },
    },
    allowPositionals: false,
    unknownFlagMessage: (token) => `Unknown parallel flag: ${token}.`,
    unexpectedPositionalMessage: (token) => `Unexpected positional argument: ${token}`,
  });

  if (parsed.error !== undefined) {
    return { ...parsed.value, error: parsed.error };
  }

  return parsed.value;
}

interface IntResult {
  value: number | undefined;
  error?: string;
}

function parseOptionalInt(value: string | undefined): IntResult {
  if (value === undefined) return { value: undefined };
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) {
    return { value: undefined, error: `--max-concurrent must be a positive integer, got: ${value}` };
  }
  return { value: n };
}

interface StrategyResult<T extends string> {
  value: T | undefined;
  error?: string;
}

function normalizeFailureStrategy(value: string | undefined): StrategyResult<'failFast' | 'failSafe'> {
  if (value === undefined) return { value: undefined };
  if (value === 'failFast' || value === 'failSafe') return { value };
  return { value: undefined, error: `--failure-strategy must be "failFast" or "failSafe", got: ${value}` };
}

function normalizeResultAggregation(value: string | undefined): StrategyResult<'list' | 'merge'> {
  if (value === undefined) return { value: undefined };
  if (value === 'list' || value === 'merge') return { value };
  return { value: undefined, error: `--result-aggregation must be "list" or "merge", got: ${value}` };
}
