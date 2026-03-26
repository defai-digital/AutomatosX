import type { CLIOptions, CommandResult } from '../types.js';
import { parseCommandArgs } from '../utils/command-args.js';
import { createRuntime, failure, success, usageError } from '../utils/formatters.js';
import { splitCommaList } from '../utils/validation.js';

interface DiscussArgs {
  variant?: 'run' | 'quick' | 'recursive';
  topic?: string;
  providers?: string[];
  pattern?: string;
  rounds?: number;
  consensusMethod?: string;
  context?: string;
  subtopics?: string[];
}

export async function discussCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const parsed = parseDiscussArgs(args);
  if (parsed.error !== undefined) {
    return failure(parsed.error);
  }

  if (parsed.value.topic === undefined || parsed.value.topic.length === 0) {
    return usageError('ax discuss <topic>');
  }

  const basePath = options.outputDir ?? process.cwd();
  const runtime = createRuntime(options);
  const providers = parsed.value.providers ?? (options.provider !== undefined ? [options.provider] : undefined);
  const variant = parsed.value.variant ?? 'run';
  const commonRequest = {
    topic: parsed.value.topic,
    traceId: options.traceId,
    sessionId: options.sessionId,
    basePath,
    provider: options.provider,
    surface: 'cli' as const,
    providers,
    pattern: parsed.value.pattern,
    rounds: parsed.value.rounds,
    consensusMethod: parsed.value.consensusMethod,
    context: parsed.value.context,
    minProviders: Math.min(2, Math.max(1, providers?.length ?? 0)),
    verbose: options.verbose,
  };
  const result = variant === 'quick'
    ? await runtime.runDiscussionQuick(commonRequest)
    : variant === 'recursive'
      ? await runtime.runDiscussionRecursive({
        ...commonRequest,
        subtopics: parsed.value.subtopics ?? [],
      })
      : await runtime.runDiscussion(commonRequest);

  if (!result.success) {
    return failure(`Discussion failed: ${result.error?.message ?? 'Unknown error'}`, result);
  }

  const warningText = result.warnings.length === 0
    ? ''
    : `\nWarnings:\n${result.warnings.map((warning) => `- ${warning}`).join('\n')}`;
  const variantText = variant === 'run' ? 'Discussion' : `Discussion (${variant})`;
  const providerText = 'providers' in result ? result.providers.join(', ') : result.root.providers.join(', ');
  const subtopicText = variant === 'recursive' && 'subtopics' in result
    ? `\nSubtopics:\n${result.subtopics.map((entry: string) => `- ${entry}`).join('\n')}`
    : '';

  return success(
    `${variantText} completed with trace ${result.traceId} using ${providerText}.${subtopicText}${warningText}`,
    result,
  );
}

function parseDiscussArgs(args: string[]): { value: DiscussArgs; error?: string } {
  const parsed = parseCommandArgs<DiscussArgs>({
    args,
    initial: {},
    flags: {
      providers: {
        kind: 'string',
        apply: (state, value) => {
          state.providers = splitCommaList(value);
        },
      },
      pattern: {
        kind: 'string',
        apply: (state, value) => {
          state.pattern = value;
        },
      },
      rounds: {
        kind: 'string',
        apply: (state, value) => {
          const rounds = Number.parseInt(value, 10);
          if (!Number.isFinite(rounds) || rounds < 1) {
            return 'Rounds must be a positive integer.';
          }
          state.rounds = rounds;
        },
      },
      consensus: {
        kind: 'string',
        apply: (state, value) => {
          state.consensusMethod = value;
        },
      },
      context: {
        kind: 'string',
        apply: (state, value) => {
          state.context = value;
        },
      },
      topic: {
        kind: 'string',
        apply: (state, value) => {
          state.topic = value;
        },
      },
      subtopics: {
        kind: 'string',
        apply: (state, value) => {
          state.subtopics = splitCommaList(value);
        },
      },
    },
    onPositional: (state, value, positionals) => {
      if ((value === 'quick' || value === 'recursive') && positionals.length === 0 && state.variant === undefined) {
        state.variant = value;
        return false;
      }
      return true;
    },
    unknownFlagMessage: (token) => `Unknown discuss flag: ${token}.`,
  });

  if (parsed.error !== undefined) {
    return { value: parsed.value, error: parsed.error };
  }

  if (parsed.value.topic === undefined && parsed.positionals.length > 0) {
    parsed.value.topic = parsed.positionals.join(' ');
  }

  if (parsed.value.variant === 'recursive'
    && (parsed.value.subtopics === undefined || parsed.value.subtopics.length === 0)) {
    return { value: parsed.value, error: 'Recursive discussions require --subtopics <a,b,c>.' };
  }

  return { value: parsed.value };
}
