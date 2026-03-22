import { success } from '../utils/formatters.js';
import type { CLIOptions, CommandResult } from '../types.js';
import { WORKFLOW_COMMAND_DEFINITIONS } from './workflows.js';

export const RETAINED_COMMANDS = [
  { command: 'setup', description: 'Bootstrap local AutomatosX workspace state, agents, and policies.' },
  { command: 'init', description: 'Create project context files and local MCP metadata for AI-tool integration.' },
  { command: 'doctor', description: 'Validate workspace, workflow, and shared runtime readiness.' },
  { command: 'status', description: 'Show active sessions, running traces, and provider/runtime readiness.' },
  { command: 'config', description: 'Inspect or update workspace config used by the runtime and provider bridge.' },
  { command: 'cleanup', description: 'Auto-close stale sessions and traces from shared runtime storage.' },
  { command: 'resume', description: 'Rerun a prior workflow or discussion trace from stored execution context.' },
  { command: 'call', description: 'Call a provider directly through the shared runtime bridge.' },
  { command: 'list', description: 'List available workflows from the shared runtime loader.' },
  { command: 'trace', description: 'Inspect recent traces or a single trace record from shared runtime storage.' },
  { command: 'discuss', description: 'Run a top-level multi-provider discussion through shared runtime tracing.' },
] as const;

export const ADVANCED_COMMANDS = [
  { command: 'guard', description: 'List, apply, and evaluate workflow guard policies.' },
  { command: 'agent', description: 'Inspect or register agents through the shared runtime state store.' },
  { command: 'mcp', description: 'Inspect available MCP tools or invoke them through the local MCP surface.' },
  { command: 'session', description: 'Create and manage collaboration sessions through shared runtime state.' },
  { command: 'review', description: 'Run deterministic v14-native code review heuristics with durable artifacts.' },
] as const;

export const WORKFLOW_FIRST_QUICKSTART = [
  'Bootstrap:',
  '  ax setup',
  '  ax init',
  '  ax doctor',
  '',
  'Workflow-first commands:',
  '  ax ship --scope <area>',
  '  ax architect --request "<requirement>"',
  '  ax audit --scope <path-or-area>',
  '  ax qa --target <service-or-feature> --url <url>',
  '  ax release --release-version <version>',
  '',
  'Recommended flow:',
  '  1. Run ax setup and ax init once per project.',
  '  2. Start with one of the five workflow commands above.',
  '  3. Use --dry-run to preview artifacts without runtime side effects.',
  '  4. Inspect manifest.json, summary.json, and artifact markdown in .automatosx/workflows/.',
  '',
  'Retained high-value commands:',
  '  ax doctor',
  '  ax status',
  '  ax config show',
  '  ax cleanup',
  '  ax resume <trace-id>',
  '  ax call "summarize this diff"',
  '  ax call --autonomous --intent analysis "assess release risk"',
  '  ax list',
  '  ax trace [trace-id]',
  '  ax trace analyze <trace-id>',
  '  ax trace by-session <session-id>',
  '  ax discuss "<topic>"',
  '',
  'Advanced operational commands:',
  '  ax iterate run <workflow-id>',
  '  ax guard list',
  '  ax agent list',
  '  ax mcp tools',
  '  ax mcp serve',
  '  ax session list',
  '  ax review analyze <paths...>',
].join('\n');

export async function helpCommand(_args: string[], _options: CLIOptions): Promise<CommandResult> {
  const commandLines = WORKFLOW_COMMAND_DEFINITIONS.map(
    (definition) => `- ax ${definition.command}: ${definition.description}`,
  );
  const retainedLines = RETAINED_COMMANDS.map(
    (definition) => `- ax ${definition.command}: ${definition.description}`,
  );
  const advancedLines = ADVANCED_COMMANDS.map(
    (definition) => `- ax ${definition.command}: ${definition.description}`,
  );

  return success(
    [
      'AutomatosX v14 Help',
      '',
      'Workflow-first default surface:',
      ...commandLines,
      '',
      'Retained high-value support commands:',
      ...retainedLines,
      '',
      'Advanced operational commands:',
      ...advancedLines,
      '',
      WORKFLOW_FIRST_QUICKSTART,
    ].join('\n'),
    {
      workflowFirst: true,
      quickstart: WORKFLOW_FIRST_QUICKSTART,
      commands: [
        ...WORKFLOW_COMMAND_DEFINITIONS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: definition.stable,
        })),
        ...RETAINED_COMMANDS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: true,
        })),
        ...ADVANCED_COMMANDS.map((definition) => ({
          command: definition.command,
          description: definition.description,
          stable: true,
        })),
      ],
    },
  );
}
