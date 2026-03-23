import packageJson from '../../../package.json' with { type: 'json' };
import {
  abilityCommand,
  agentCommand,
  architectCommand,
  auditCommand,
  callCommand,
  cleanupCommand,
  configCommand,
  doctorCommand,
  discussCommand,
  feedbackCommand,
  guardCommand,
  helpCommand,
  historyCommand,
  initCommand,
  iterateCommand,
  monitorCommand,
  listCommand,
  mcpCommand,
  qaCommand,
  releaseCommand,
  reviewCommand,
  resumeCommand,
  runCommand,
  scaffoldCommand,
  sessionCommand,
  setupCommand,
  shipCommand,
  statusCommand,
  traceCommand,
  updateCommand,
} from './commands/index.js';
import type { CLIOptions, CommandHandler, CommandResult, ParsedCommand } from './types.js';
import { failure, success } from './utils/formatters.js';

export const CLI_VERSION = packageJson.version;
export const CLI_COMMAND_NAMES = [
  'help',
  'version',
  'iterate',
  'ability',
  'call',
  'run',
  'ship',
  'architect',
  'audit',
  'qa',
  'release',
  'setup',
  'init',
  'doctor',
  'status',
  'config',
  'cleanup',
  'feedback',
  'history',
  'list',
  'monitor',
  'scaffold',
  'trace',
  'discuss',
  'guard',
  'resume',
  'agent',
  'mcp',
  'session',
  'review',
  'update',
] as const;

const GLOBAL_BOOLEAN_FLAGS = new Map<string, keyof CLIOptions>([
  ['--help', 'help'],
  ['--version', 'version'],
  ['--verbose', 'verbose'],
  ['--iterate', 'iterate'],
  ['--no-context', 'noContext'],
  ['--compact', 'compact'],
  ['--dry-run', 'dryRun'],
  ['--quiet', 'quiet'],
]);

const GLOBAL_STRING_FLAGS = new Map<string, keyof CLIOptions>([
  ['--format', 'format'],
  ['--workflow-dir', 'workflowDir'],
  ['--workflow-id', 'workflowId'],
  ['--trace-id', 'traceId'],
  ['--session-id', 'sessionId'],
  ['--input', 'input'],
  ['--max-time', 'maxTime'],
  ['--category', 'category'],
  ['--agent', 'agent'],
  ['--task', 'task'],
  ['--core', 'core'],
  ['--team', 'team'],
  ['--provider', 'provider'],
  ['--output-dir', 'outputDir'],
]);

const GLOBAL_NUMBER_FLAGS = new Map<string, keyof CLIOptions>([
  ['--limit', 'limit'],
  ['--max-iterations', 'maxIterations'],
  ['--max-tokens', 'maxTokens'],
  ['--refresh', 'refresh'],
]);

const GLOBAL_ARRAY_FLAGS = new Map<string, keyof CLIOptions>([
  ['--tags', 'tags'],
]);

const COMMAND_REGISTRY: Record<string, CommandHandler> = {
  help: helpCommand,
  run: runCommand,
  ship: shipCommand,
  architect: architectCommand,
  audit: auditCommand,
  qa: qaCommand,
  release: releaseCommand,
  setup: setupCommand,
  init: initCommand,
  doctor: doctorCommand,
  status: statusCommand,
  config: configCommand,
  cleanup: cleanupCommand,
  ability: abilityCommand,
  feedback: feedbackCommand,
  call: callCommand,
  history: historyCommand,
  iterate: iterateCommand,
  list: listCommand,
  monitor: monitorCommand,
  scaffold: scaffoldCommand,
  trace: traceCommand,
  discuss: discussCommand,
  guard: guardCommand,
  agent: agentCommand,
  mcp: mcpCommand,
  session: sessionCommand,
  review: reviewCommand,
  resume: resumeCommand,
  update: updateCommand,
};

const COMMAND_HELP: Record<string, { usage: string[]; description: string }> = {
  help: {
    description: 'Show root help or command-specific help.',
    usage: [
      'ax help',
      'ax help <command>',
    ],
  },
  run: {
    description: 'Run a workflow directly through the shared runtime bridge.',
    usage: [
      'ax run <workflow-id>',
      'ax run <workflow-id> --input <json-object>',
    ],
  },
  call: {
    description: 'Call a provider directly through the shared runtime bridge.',
    usage: [
      'ax call <prompt>',
      'ax call --files src/index.ts,README.md "<prompt>"',
      'ax call --system "<system-prompt>" "<prompt>"',
      'ax call --autonomous --intent analysis --max-rounds 2 "<prompt>"',
      'ax call --autonomous --goal "<outcome>" --require-real "<prompt>"',
    ],
  },
  ship: {
    description: 'Run the ship workflow as a first-class v14 command.',
    usage: [
      'ax ship --scope <area>',
      'ax ship <scope> --dry-run',
    ],
  },
  architect: {
    description: 'Run the architect workflow as a first-class v14 command.',
    usage: [
      'ax architect --request "<requirement>"',
      'ax architect "<requirement>" --dry-run',
    ],
  },
  audit: {
    description: 'Run the audit workflow as a first-class v14 command.',
    usage: [
      'ax audit --scope <path-or-area>',
    ],
  },
  qa: {
    description: 'Run the QA workflow as a first-class v14 command.',
    usage: [
      'ax qa --target <service-or-feature> --url <url>',
    ],
  },
  release: {
    description: 'Run the release workflow as a first-class v14 command.',
    usage: [
      'ax release --release-version <version>',
    ],
  },
  setup: {
    description: 'Bootstrap local AutomatosX workspace state and write an environment baseline.',
    usage: [
      'ax setup',
      'ax setup --output-dir <path>',
    ],
  },
  init: {
    description: 'Create project context files plus provider/IDE MCP integration files.',
    usage: [
      'ax init',
      'ax init --output-dir <path>',
      'ax init --skip-cursor --skip-gemini',
      'ax init --skip-mcp',
    ],
  },
  doctor: {
    description: 'Validate workspace, workflow, and shared runtime readiness.',
    usage: [
      'ax doctor',
      'ax doctor --workflow-dir <path>',
      'ax doctor --output-dir <path>',
    ],
  },
  status: {
    description: 'Show active sessions, running traces, and provider/runtime readiness.',
    usage: [
      'ax status',
      'ax status --limit 5',
    ],
  },
  config: {
    description: 'Inspect or update workspace config used by runtime and provider bridges.',
    usage: [
      'ax config show',
      'ax config get <path>',
      'ax config set <path> <value>',
      'ax config set <path> --input <json-value>',
    ],
  },
  ability: {
    description: 'List built-in runtime abilities or inject matched ability context.',
    usage: [
      'ax ability list',
      'ax ability list --category review --tags security',
      'ax ability inject --task "<task>"',
      'ax ability inject --task "<task>" --core workflow-first,git-hygiene',
    ],
  },
  feedback: {
    description: 'Capture feedback events and inspect aggregate agent feedback signals.',
    usage: [
      'ax feedback overview',
      'ax feedback history [agent-id]',
      'ax feedback stats <agent-id>',
      'ax feedback adjustments <agent-id>',
      'ax feedback submit --agent <agent-id> --task "<task>" --input <json-object>',
    ],
  },
  cleanup: {
    description: 'Auto-close stale sessions and traces in shared runtime storage.',
    usage: [
      'ax cleanup',
      'ax cleanup stuck [max-age-ms]',
      'ax cleanup sessions [max-age-ms]',
      'ax cleanup traces [max-age-ms]',
    ],
  },
  list: {
    description: 'List workflows visible to the shared runtime loader.',
    usage: [
      'ax list',
      'ax list --workflow-dir <path>',
      'ax list <workflow-id>',
      'ax list describe <workflow-id>',
    ],
  },
  trace: {
    description: 'List traces, inspect a trace record, or analyze trace health.',
    usage: [
      'ax trace',
      'ax trace <trace-id>',
      'ax trace analyze <trace-id>',
      'ax trace tree <trace-id>',
      'ax trace by-session <session-id>',
    ],
  },
  discuss: {
    description: 'Run a top-level multi-provider discussion.',
    usage: [
      'ax discuss <topic>',
      'ax discuss quick <topic>',
      'ax discuss recursive <topic> --subtopics a,b,c',
      'ax discuss --providers claude,gemini "<topic>"',
    ],
  },
  guard: {
    description: 'List, apply, and evaluate workflow guard policies.',
    usage: [
      'ax guard list',
      'ax guard apply <policy-id>',
      'ax guard apply --input <json-object>',
      'ax guard check --input <json-object>',
    ],
  },
  agent: {
    description: 'Inspect or register retained agents.',
    usage: [
      'ax agent list',
      'ax agent get <agent-id>',
      'ax agent register --input <json-object>',
      'ax agent remove <agent-id>',
      'ax agent capabilities',
      'ax agent run <agent-id> --task <text>',
      'ax agent recommend --task <text>',
    ],
  },
  mcp: {
    description: 'Inspect MCP tools, resources, prompts, or invoke one through the local MCP surface.',
    usage: [
      'ax mcp tools',
      'ax mcp describe <tool-name>',
      'ax mcp resources',
      'ax mcp read <resource-uri>',
      'ax mcp prompts',
      'ax mcp prompt <prompt-name> --input <json-object>',
      'ax mcp call <tool-name> --input <json-object>',
    ],
  },
  session: {
    description: 'Create and manage collaboration sessions.',
    usage: [
      'ax session list',
      'ax session create --input <json-object>',
      'ax session join <session-id> --input <json-object>',
    ],
  },
  review: {
    description: 'Run deterministic v14-native review heuristics with durable artifacts.',
    usage: [
      'ax review analyze <paths...>',
      'ax review analyze <paths...> --focus security',
      'ax review list',
    ],
  },
  version: {
    description: 'Show the AutomatosX CLI version.',
    usage: [
      'ax version',
      'ax --version',
    ],
  },
  history: {
    description: 'View past workflow run history from the trace store.',
    usage: [
      'ax history',
      'ax history --limit 50',
      'ax history --agent <workflow-id>',
      'ax history --status failed',
      'ax history --verbose',
    ],
  },
  iterate: {
    description: 'Repeat a runnable command until success, iteration budget, or time budget is exhausted.',
    usage: [
      'ax iterate <command> [args...]',
      'ax iterate run <workflow-id> --max-iterations 3',
      'ax iterate run <workflow-id> --max-time 5m',
      'ax ship --iterate --max-iterations 3',
    ],
  },
  monitor: {
    description: 'Launch a local HTTP dashboard showing active sessions, traces, and agents.',
    usage: [
      'ax monitor',
      'ax monitor --port 8080',
      'ax monitor --no-open',
    ],
  },
  scaffold: {
    description: 'Generate contract-first components: Zod schemas, domain packages, guard policies.',
    usage: [
      'ax scaffold contract <name>',
      'ax scaffold domain <name> --scope @myorg',
      'ax scaffold guard <policy-id>',
      'ax scaffold contract <name> --dry-run',
    ],
  },
  update: {
    description: 'Check for CLI updates and optionally install the latest version.',
    usage: [
      'ax update',
      'ax update --check',
      'ax update --yes',
    ],
  },
  resume: {
    description: 'Rerun a prior workflow or discussion trace using its stored execution context.',
    usage: [
      'ax resume <trace-id>',
    ],
  },
};

export async function executeCli(argv: string[]): Promise<CommandResult> {
  const parsed = parseCommand(argv);

  if (parsed.parseError !== undefined) {
    return failure(parsed.parseError);
  }

  if (parsed.command === 'help' && parsed.options.help) {
    return success(formatCommandHelp('help'), { command: 'help' });
  }

  if (parsed.command === 'help' && parsed.args[0] !== undefined) {
    const helpTarget = parsed.args[0];
    if (helpTarget !== undefined && COMMAND_HELP[helpTarget] !== undefined) {
      return success(formatCommandHelp(helpTarget), { command: helpTarget });
    }
    return failure(`Unknown command: ${helpTarget}\nRun "ax help" to see the available commands.`);
  }

  if (parsed.options.version && (parsed.command === 'help' || parsed.command === 'version')) {
    return success(`AutomatosX v${CLI_VERSION}`, { version: CLI_VERSION });
  }

  if (parsed.options.help && parsed.command !== 'help') {
    if (COMMAND_HELP[parsed.command] !== undefined) {
      return success(formatCommandHelp(parsed.command), { command: parsed.command });
    }
    return helpCommand([], parsed.options);
  }

  if (parsed.command === 'version') {
    return success(`AutomatosX v${CLI_VERSION}`, { version: CLI_VERSION });
  }

  if (parsed.command === 'iterate') {
    return executeIterateCommand(parsed.args, parsed.options);
  }

  const handler = COMMAND_REGISTRY[parsed.command];
  if (handler === undefined) {
    return failure(`Unknown command: ${parsed.command}\nRun "ax help" to see the available commands.`);
  }

  if (parsed.options.iterate) {
    return runIterativeHandler(parsed.command, handler, parsed.args, parsed.options);
  }

  return handler(parsed.args, parsed.options);
}

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

    const booleanKey = GLOBAL_BOOLEAN_FLAGS.get(token);
    if (booleanKey !== undefined) {
      (options[booleanKey] as boolean | undefined) = true;
      continue;
    }

    const stringKey = GLOBAL_STRING_FLAGS.get(token);
    if (stringKey !== undefined) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        parseError = `Missing value for ${token}.`;
        break;
      }

      if (stringKey === 'format' && value !== 'text' && value !== 'json') {
        parseError = `Invalid value for ${token}: expected "text" or "json".`;
        break;
      }

      (options[stringKey] as string | undefined) = value;
      index += 1;
      continue;
    }

    const numberKey = GLOBAL_NUMBER_FLAGS.get(token);
    if (numberKey !== undefined) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        parseError = `Missing value for ${token}.`;
        break;
      }

      const parsedValue = Number.parseInt(value, 10);
      if (!Number.isFinite(parsedValue)) {
        parseError = `Invalid value for ${token}: expected an integer.`;
        break;
      }

      (options[numberKey] as number | undefined) = parsedValue;
      index += 1;
      continue;
    }

    const arrayKey = GLOBAL_ARRAY_FLAGS.get(token);
    if (arrayKey !== undefined) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        parseError = `Missing value for ${token}.`;
        break;
      }

      (options[arrayKey] as string[] | undefined) = value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      index += 1;
      continue;
    }

    if (command === undefined && token === '--version') {
      command = 'version';
      continue;
    }

    if (command === undefined && token === '--help') {
      command = 'help';
      continue;
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

export function renderCommandResult(result: CommandResult, options: CLIOptions): string {
  if (options.format === 'json') {
    return `${JSON.stringify({
      success: result.success,
      message: result.message,
      data: result.data,
      exitCode: result.exitCode,
    }, null, 2)}\n`;
  }

  if (result.message !== undefined) {
    return `${result.message}\n`;
  }

  if (result.data !== undefined) {
    return `${JSON.stringify(result.data, null, 2)}\n`;
  }

  return '';
}

async function executeIterateCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const targetCommand = args[0];
  if (targetCommand === undefined || targetCommand.length === 0) {
    return failure('Usage: ax iterate <command> [args...]');
  }
  if (targetCommand === 'iterate') {
    return failure('ax iterate cannot target itself.');
  }

  const handler = COMMAND_REGISTRY[targetCommand];
  if (handler === undefined) {
    return failure(`Unknown command: ${targetCommand}\nRun "ax help" to see the available commands.`);
  }

  return runIterativeHandler(targetCommand, handler, args.slice(1), {
    ...options,
    iterate: false,
  });
}

async function runIterativeHandler(
  commandName: string,
  handler: CommandHandler,
  args: string[],
  options: CLIOptions,
): Promise<CommandResult> {
  const maxIterations = options.maxIterations ?? 3;
  const maxTimeMs = parseMaxTimeMs(options.maxTime);
  const startedAt = Date.now();
  let iterationsRun = 0;
  let lastResult: CommandResult | undefined;

  while (iterationsRun < maxIterations && Date.now() - startedAt <= maxTimeMs) {
    iterationsRun += 1;
    const iterationTraceId = options.traceId === undefined
      ? undefined
      : `${options.traceId}-iter-${iterationsRun}`;
    lastResult = await handler(args, {
      ...options,
      iterate: false,
      traceId: iterationTraceId,
    });

    if (lastResult.success) {
      return success(`${lastResult.message ?? `${commandName} completed.`}\n\nIterate completed after ${iterationsRun} iteration(s).`, {
        iterationsRun,
        lastResult: lastResult.data,
      });
    }
  }

  return failure(`${lastResult?.message ?? `${commandName} failed.`}\n\nIterate exhausted ${iterationsRun} iteration(s).`, {
    iterationsRun,
    lastResult: lastResult?.data,
  });
}

function parseMaxTimeMs(value: string | undefined): number {
  if (value === undefined || value.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const match = value.match(/^(\d+)(ms|s|m|h)?$/);
  if (match === null) {
    return Number.POSITIVE_INFINITY;
  }

  const amount = Number.parseInt(match[1]!, 10);
  const unit = match[2] ?? 'ms';
  switch (unit) {
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 's':
      return amount * 1000;
    default:
      return amount;
  }
}

function formatCommandHelp(command: string): string {
  const entry = COMMAND_HELP[command];
  if (entry === undefined) {
    return 'Command help is not available.';
  }

  return [
    `AutomatosX v14 Help: ${command}`,
    '',
    entry.description,
    '',
    'Usage:',
    ...entry.usage.map((usage) => `  ${usage}`),
  ].join('\n');
}

export function getCommandHelp(command: string): string | undefined {
  return COMMAND_HELP[command] === undefined ? undefined : formatCommandHelp(command);
}

function createDefaultOptions(): CLIOptions {
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
