import {
  listWorkflowCatalog as listSharedWorkflowCatalog,
} from '@defai.digital/shared-runtime/catalog';

export interface CommandMetadata {
  command: string;
  description: string;
  usage: string[];
  category: 'root' | 'workflow' | 'retained' | 'advanced';
  stable: boolean;
}

const STATIC_COMMAND_METADATA_BEFORE_WORKFLOWS: readonly CommandMetadata[] = [
  {
    command: 'help',
    description: 'Show root help or command-specific help.',
    usage: [
      'ax help',
      'ax help <command>',
    ],
    category: 'root',
    stable: true,
  },
  {
    command: 'version',
    description: 'Show the AutomatosX CLI version.',
    usage: [
      'ax version',
      'ax --version',
    ],
    category: 'root',
    stable: true,
  },
  {
    command: 'iterate',
    description: 'Repeat a runnable command until success, iteration budget, or time budget is exhausted.',
    usage: [
      'ax iterate <command> [args...]',
      'ax iterate run <workflow-id> --max-iterations 3',
      'ax iterate run <workflow-id> --max-time 5m',
      'ax ship --iterate --max-iterations 3',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'ability',
    description: 'List built-in runtime abilities or inject matched ability context.',
    usage: [
      'ax ability list',
      'ax ability list --category review --tags security',
      'ax ability inject --task "<task>"',
      'ax ability inject --task "<task>" --core workflow-first,git-hygiene',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'call',
    description: 'Call a provider directly through the shared runtime bridge.',
    usage: [
      'ax call <prompt>',
      'ax call --files src/index.ts,README.md "<prompt>"',
      'ax call --system "<system-prompt>" "<prompt>"',
      'ax call --autonomous --intent analysis --max-rounds 2 "<prompt>"',
      'ax call --autonomous --goal "<outcome>" --require-real "<prompt>"',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'run',
    description: 'Run a workflow directly through the shared runtime bridge.',
    usage: [
      'ax run <workflow-id>',
      'ax run <workflow-id> --input <json-object>',
    ],
    category: 'retained',
    stable: true,
  },
];

export const WORKFLOW_COMMAND_METADATA: readonly (CommandMetadata & { category: 'workflow' })[] =
  listSharedWorkflowCatalog().map((entry) => ({
    command: entry.commandId,
    description: entry.description,
    usage: [...entry.usage],
    category: 'workflow' as const,
    stable: true,
  }));

export const WORKFLOW_PRIMARY_USAGES: readonly string[] = WORKFLOW_COMMAND_METADATA
  .map((entry) => entry.usage[0])
  .filter((value): value is string => typeof value === 'string' && value.length > 0);

export const WORKFLOW_PRIMARY_EXAMPLES: readonly string[] = listSharedWorkflowCatalog()
  .map((entry) => entry.examples[0])
  .filter((value): value is string => typeof value === 'string' && value.length > 0);

export const DEFAULT_ENTRY_PATH_COMMANDS: readonly string[] = [
  'ax setup',
  ...WORKFLOW_PRIMARY_USAGES,
];

export const README_WORKFLOW_COMMANDS: readonly string[] = [
  'ax run <workflow-id>',
  ...WORKFLOW_PRIMARY_USAGES,
];

export const RETAINED_HIGH_VALUE_COMMANDS: readonly string[] = [
  'ax list',
  'ax trace [trace-id]',
  'ax discuss "<topic>"',
];

const STATIC_COMMAND_METADATA_AFTER_WORKFLOWS: readonly CommandMetadata[] = [
  {
    command: 'setup',
    description: 'Bootstrap local AutomatosX workspace, AGENTS.md, MCP config, and provider integrations.',
    usage: [
      'ax setup',
      'ax setup --force',
      'ax setup -y',
      'ax setup --output-dir <path>',
      'ax setup --skip-cursor --skip-gemini',
      'ax setup --skip-mcp',
      'ax setup --migrate-storage',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'doctor',
    description: 'System health check: Node.js, provider CLIs, workspace config, bootstrap artifacts, and MCP surface.',
    usage: [
      'ax doctor',
      'ax doctor <provider>',
      'ax doctor --verbose',
      'ax doctor --output-dir <path>',
      'ax doctor --format json',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'bridge',
    description: 'Install, inspect, and execute local AX-BRIDGE definitions with shared-runtime governance.',
    usage: [
      'ax bridge list',
      'ax bridge install <path> [--require-trusted]',
      'ax bridge inspect <bridge-id|path>',
      'ax bridge validate [bridge-id|path]',
      'ax bridge run <bridge-id|path> [args...]',
    ],
    category: 'advanced',
    stable: false,
  },
  {
    command: 'skill',
    description: 'Import and inspect local AX-SKILL definitions, including OpenClaw-style SKILL.md files.',
    usage: [
      'ax skill list',
      'ax skill import <path> [--require-trusted]',
      'ax skill export <skill-id|path> <output-path>',
      'ax skill inspect <skill-id|path>',
      'ax skill run <skill-id|path> [args...]',
      'ax skill validate [skill-id|path]',
      'ax skill resolve <query>',
    ],
    category: 'advanced',
    stable: false,
  },
  {
    command: 'status',
    description: 'Show active sessions, running traces, and provider/runtime readiness.',
    usage: [
      'ax status',
      'ax status --limit 5',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'governance',
    description: 'Show the canonical runtime governance aggregate for blocked traces and denied imported skills.',
    usage: [
      'ax governance',
      'ax governance --limit 25',
      'ax governance --format json',
    ],
    category: 'advanced',
    stable: false,
  },
  {
    command: 'config',
    description: 'Inspect or update workspace config used by runtime and provider bridges.',
    usage: [
      'ax config show',
      'ax config get <path>',
      'ax config set <path> <value>',
      'ax config set <path> --input <json-value>',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'cleanup',
    description: 'Auto-close stale sessions and traces in shared runtime storage.',
    usage: [
      'ax cleanup',
      'ax cleanup stuck [max-age-ms]',
      'ax cleanup sessions [max-age-ms]',
      'ax cleanup traces [max-age-ms]',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'feedback',
    description: 'Capture feedback events and inspect aggregate agent feedback signals.',
    usage: [
      'ax feedback overview',
      'ax feedback history [agent-id]',
      'ax feedback stats <agent-id>',
      'ax feedback adjustments <agent-id>',
      'ax feedback submit --agent <agent-id> --task "<task>" --input <json-object>',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'history',
    description: 'View past workflow run history from the trace store.',
    usage: [
      'ax history',
      'ax history --limit 50',
      'ax history --agent <workflow-id>',
      'ax history --status failed',
      'ax history --verbose',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'list',
    description: 'List workflows visible to the shared runtime loader.',
    usage: [
      'ax list',
      'ax list --workflow-dir <path>',
      'ax list <workflow-id>',
      'ax list describe <workflow-id>',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'monitor',
    description: 'Launch a local HTTP dashboard showing active sessions, traces, and agents.',
    usage: [
      'ax monitor',
      'ax monitor --port 8080',
      'ax monitor --no-open',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'scaffold',
    description: 'Generate contract-first components: Zod schemas, domain packages, guard policies.',
    usage: [
      'ax scaffold contract <name>',
      'ax scaffold domain <name> --scope @myorg',
      'ax scaffold guard <policy-id>',
      'ax scaffold contract <name> --dry-run',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'trace',
    description: 'List traces, inspect a trace record, or analyze trace health.',
    usage: [
      'ax trace',
      'ax trace <trace-id>',
      'ax trace analyze <trace-id>',
      'ax trace tree <trace-id>',
      'ax trace by-session <session-id>',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'discuss',
    description: 'Run a top-level multi-provider discussion.',
    usage: [
      'ax discuss <topic>',
      'ax discuss quick <topic>',
      'ax discuss recursive <topic> --subtopics a,b,c',
      'ax discuss --providers claude,gemini "<topic>"',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'guard',
    description: 'List, apply, and evaluate workflow guard policies.',
    usage: [
      'ax guard list',
      'ax guard apply <policy-id>',
      'ax guard apply --input <json-object>',
      'ax guard check --input <json-object>',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'resume',
    description: 'Rerun a prior workflow or discussion trace using its stored execution context.',
    usage: [
      'ax resume <trace-id>',
    ],
    category: 'retained',
    stable: true,
  },
  {
    command: 'agent',
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
    category: 'advanced',
    stable: true,
  },
  {
    command: 'mcp',
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
    category: 'advanced',
    stable: true,
  },
  {
    command: 'session',
    description: 'Create and manage collaboration sessions.',
    usage: [
      'ax session list',
      'ax session create --input <json-object>',
      'ax session join <session-id> --input <json-object>',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'review',
    description: 'Run deterministic v14-native review heuristics with durable artifacts.',
    usage: [
      'ax review analyze <paths...>',
      'ax review analyze <paths...> --focus security',
      'ax review list',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'update',
    description: 'Check for CLI updates and optionally install the latest version.',
    usage: [
      'ax update',
      'ax update --check',
      'ax update --yes',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'parallel',
    description: 'Plan or execute a bounded parallel agent DAG with dependency ordering.',
    usage: [
      'ax parallel plan --input \'[{"taskId":"a","agentId":"agent-1"},...]\'',
      'ax parallel run --input \'[...]\' --max-concurrent 2',
      'ax parallel run --input \'[...]\' --failure-strategy failSafe',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'memory',
    description: 'Store, retrieve, search, and manage key-value memory entries in the shared runtime.',
    usage: [
      'ax memory list',
      'ax memory get <key>',
      'ax memory set <key> <value>',
      'ax memory set <key> --input <json>',
      'ax memory search <query>',
      'ax memory delete <key>',
    ],
    category: 'advanced',
    stable: true,
  },
  {
    command: 'semantic',
    description: 'Store, search, and manage semantic (TF-IDF) entries for context retrieval.',
    usage: [
      'ax semantic store <key> --content <text>',
      'ax semantic search <query> --top-k 5',
      'ax semantic list --namespace <ns>',
      'ax semantic get <key>',
      'ax semantic delete <key>',
      'ax semantic stats',
    ],
    category: 'advanced',
    stable: true,
  },
];

export const COMMAND_METADATA: readonly CommandMetadata[] = [
  ...STATIC_COMMAND_METADATA_BEFORE_WORKFLOWS,
  ...WORKFLOW_COMMAND_METADATA,
  ...STATIC_COMMAND_METADATA_AFTER_WORKFLOWS,
];

export const CLI_COMMAND_NAMES = COMMAND_METADATA.map((entry) => entry.command);
export const WORKFLOW_COMMAND_NAMES = WORKFLOW_COMMAND_METADATA.map((entry) => entry.command);

const COMMAND_METADATA_BY_NAME = new Map(
  COMMAND_METADATA.map((entry) => [entry.command, entry] as const),
);
const WORKFLOW_COMMAND_METADATA_BY_NAME = new Map(
  WORKFLOW_COMMAND_METADATA.map((entry) => [entry.command, entry] as const),
);

export const RETAINED_COMMANDS = COMMAND_METADATA
  .filter((entry) => entry.category === 'retained')
  .map((entry) => ({
    command: entry.command,
    description: entry.description,
  }));

export const ADVANCED_COMMANDS = COMMAND_METADATA
  .filter((entry) => entry.category === 'advanced')
  .map((entry) => ({
    command: entry.command,
    description: entry.description,
  }));

export function getCommandMetadata(command: string): CommandMetadata | undefined {
  return COMMAND_METADATA_BY_NAME.get(command);
}

export function hasCommandMetadata(command: string): boolean {
  return COMMAND_METADATA_BY_NAME.has(command);
}

export function getWorkflowCommandMetadata(command: string): (CommandMetadata & { category: 'workflow' }) | undefined {
  return WORKFLOW_COMMAND_METADATA_BY_NAME.get(command);
}

export function isWorkflowCommand(command: string): boolean {
  return WORKFLOW_COMMAND_METADATA_BY_NAME.has(command);
}
