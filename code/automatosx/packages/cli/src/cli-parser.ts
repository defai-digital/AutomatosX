import type { CLIOptions, ParsedCommand } from './types.js';
import { normalizeFlagToken } from './utils/command-args.js';
import { splitCommaList } from './utils/validation.js';

type GlobalFlagApplyResult = void | string;

interface GlobalBooleanFlagSpec {
  kind: 'boolean';
  apply: (options: CLIOptions) => GlobalFlagApplyResult;
}

interface GlobalStringFlagSpec {
  kind: 'string';
  apply: (options: CLIOptions, value: string) => GlobalFlagApplyResult;
}

type GlobalFlagSpec = GlobalBooleanFlagSpec | GlobalStringFlagSpec;

const INTEGER_RE = /^-?\d+$/;

const GLOBAL_FLAG_SPECS: Record<string, GlobalFlagSpec> = {
  help: {
    kind: 'boolean',
    apply: (options) => {
      options.help = true;
    },
  },
  version: {
    kind: 'boolean',
    apply: (options) => {
      options.version = true;
    },
  },
  verbose: {
    kind: 'boolean',
    apply: (options) => {
      options.verbose = true;
    },
  },
  iterate: {
    kind: 'boolean',
    apply: (options) => {
      options.iterate = true;
    },
  },
  'no-context': {
    kind: 'boolean',
    apply: (options) => {
      options.noContext = true;
    },
  },
  compact: {
    kind: 'boolean',
    apply: (options) => {
      options.compact = true;
    },
  },
  'dry-run': {
    kind: 'boolean',
    apply: (options) => {
      options.dryRun = true;
    },
  },
  quiet: {
    kind: 'boolean',
    apply: (options) => {
      options.quiet = true;
    },
  },
  format: {
    kind: 'string',
    apply: (options, value) => {
      if (value !== 'text' && value !== 'json') {
        return 'Invalid value for --format: expected "text" or "json".';
      }
      options.format = value;
    },
  },
  'workflow-dir': {
    kind: 'string',
    apply: (options, value) => {
      options.workflowDir = value;
    },
  },
  'workflow-id': {
    kind: 'string',
    apply: (options, value) => {
      options.workflowId = value;
    },
  },
  'trace-id': {
    kind: 'string',
    apply: (options, value) => {
      options.traceId = value;
    },
  },
  'session-id': {
    kind: 'string',
    apply: (options, value) => {
      options.sessionId = value;
    },
  },
  input: {
    kind: 'string',
    apply: (options, value) => {
      options.input = value;
    },
  },
  'max-time': {
    kind: 'string',
    apply: (options, value) => {
      options.maxTime = value;
    },
  },
  category: {
    kind: 'string',
    apply: (options, value) => {
      options.category = value;
    },
  },
  status: {
    kind: 'string',
    apply: (options, value) => {
      options.status = value;
    },
  },
  agent: {
    kind: 'string',
    apply: (options, value) => {
      options.agent = value;
    },
  },
  task: {
    kind: 'string',
    apply: (options, value) => {
      options.task = value;
    },
  },
  core: {
    kind: 'string',
    apply: (options, value) => {
      options.core = value;
    },
  },
  team: {
    kind: 'string',
    apply: (options, value) => {
      options.team = value;
    },
  },
  provider: {
    kind: 'string',
    apply: (options, value) => {
      options.provider = value;
    },
  },
  'output-dir': {
    kind: 'string',
    apply: (options, value) => {
      options.outputDir = value;
    },
  },
  limit: createIntegerFlagApplier('limit', (options, value) => {
    options.limit = value;
  }),
  'max-iterations': createIntegerFlagApplier('max-iterations', (options, value) => {
    options.maxIterations = value;
  }),
  'max-tokens': createIntegerFlagApplier('max-tokens', (options, value) => {
    options.maxTokens = value;
  }),
  refresh: createIntegerFlagApplier('refresh', (options, value) => {
    options.refresh = value;
  }),
  tags: {
    kind: 'string',
    apply: (options, value) => {
      options.tags = splitCommaList(value);
    },
  },
};

export function parseCommand(argv: string[]): ParsedCommand {
  const options = createDefaultOptions();
  const args: string[] = [];
  let command: string | undefined;
  let parseError: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }

    if (command === undefined && !token.startsWith('-')) {
      command = token;
      continue;
    }

    const normalized = normalizeFlagToken(token);
    if (normalized !== undefined) {
      const spec = GLOBAL_FLAG_SPECS[normalized.name];
      if (spec !== undefined) {
        if (spec.kind === 'boolean') {
          if (normalized.inlineValue !== undefined) {
            parseError = `Flag ${token} does not accept a value.`;
            break;
          }
          const error = spec.apply(options);
          if (error !== undefined) {
            parseError = error;
            break;
          }
          continue;
        }

        let value = normalized.inlineValue;
        if (value === undefined) {
          const nextToken = argv[index + 1];
          if (nextToken === undefined || normalizeFlagToken(nextToken) !== undefined) {
            parseError = `Missing value for --${normalized.name}.`;
            break;
          }
          value = nextToken;
          index += 1;
        }

        const error = spec.apply(options, value);
        if (error !== undefined) {
          parseError = error;
          break;
        }
        continue;
      }
    }

    args.push(token);
  }

  return {
    command: command ?? (options.version ? 'version' : 'help'),
    args,
    options,
    parseError,
  };
}

export function createDefaultOptions(): CLIOptions {
  return {
    help: false,
    version: false,
    verbose: false,
    format: 'text',
    workflowDir: undefined,
    workflowId: undefined,
    traceId: undefined,
    sessionId: undefined,
    limit: undefined,
    input: undefined,
    iterate: false,
    maxIterations: undefined,
    maxTime: undefined,
    noContext: false,
    category: undefined,
    status: undefined,
    tags: undefined,
    agent: undefined,
    task: undefined,
    core: undefined,
    maxTokens: undefined,
    refresh: undefined,
    compact: false,
    team: undefined,
    provider: undefined,
    outputDir: undefined,
    dryRun: false,
    quiet: false,
  };
}

function createIntegerFlagApplier(
  flagName: string,
  apply: (options: CLIOptions, value: number) => void,
): GlobalStringFlagSpec {
  return {
    kind: 'string',
    apply: (options, value) => {
      if (!INTEGER_RE.test(value)) {
        return `Invalid value for --${flagName}: expected an integer.`;
      }
      apply(options, Number.parseInt(value, 10));
    },
  };
}
