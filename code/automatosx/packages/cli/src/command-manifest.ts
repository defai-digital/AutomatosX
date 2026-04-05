import {
  abilityCommand,
  agentCommand,
  bridgeCommand,
  callCommand,
  cleanupCommand,
  configCommand,
  doctorCommand,
  discussCommand,
  feedbackCommand,
  governanceCommand,
  helpCommand,
  historyCommand,
  initCommand,
  iterateCommand,
  memoryCommand,
  monitorCommand,
  listCommand,
  mcpCommand,
  parallelCommand,
  reviewCommand,
  resumeCommand,
  runCommand,
  scaffoldCommand,
  semanticCommand,
  sessionCommand,
  setupCommand,
  skillCommand,
  statusCommand,
  traceCommand,
  updateCommand,
  policyCommand,
} from './commands/index.js';
import { COMMAND_METADATA, resolveCommandAlias } from './command-metadata.js';
import { WORKFLOW_COMMAND_HANDLERS } from './commands/workflows.js';
import type { CommandHandler } from './types.js';

export interface CommandManifestEntry {
  command: string;
  description: string;
  usage: string[];
  handler?: CommandHandler;
}

const COMMAND_HANDLERS: Record<string, CommandHandler> = {
  help: helpCommand,
  memory: memoryCommand,
  parallel: parallelCommand,
  semantic: semanticCommand,
  run: runCommand,
  setup: setupCommand,
  init: initCommand,
  doctor: doctorCommand,
  status: statusCommand,
  config: configCommand,
  cleanup: cleanupCommand,
  bridge: bridgeCommand,
  skill: skillCommand,
  ability: abilityCommand,
  feedback: feedbackCommand,
  governance: governanceCommand,
  call: callCommand,
  history: historyCommand,
  iterate: iterateCommand,
  list: listCommand,
  monitor: monitorCommand,
  scaffold: scaffoldCommand,
  trace: traceCommand,
  discuss: discussCommand,
  policy: policyCommand,
  agent: agentCommand,
  mcp: mcpCommand,
  session: sessionCommand,
  review: reviewCommand,
  resume: resumeCommand,
  update: updateCommand,
  ...WORKFLOW_COMMAND_HANDLERS,
};

export const COMMAND_MANIFEST: readonly CommandManifestEntry[] = COMMAND_METADATA.map((entry) => ({
  ...entry,
  handler: COMMAND_HANDLERS[entry.command],
}));

const COMMAND_MANIFEST_BY_NAME = new Map(
  COMMAND_MANIFEST.map((entry) => [entry.command, entry] as const),
);

export const COMMAND_REGISTRY: Readonly<Record<string, CommandHandler>> = Object.fromEntries(
  COMMAND_MANIFEST.flatMap((entry) => entry.handler === undefined ? [] : [[entry.command, entry.handler]]),
);

export function getCommandManifestEntry(command: string): CommandManifestEntry | undefined {
  return COMMAND_MANIFEST_BY_NAME.get(resolveCommandAlias(command));
}

export function getCommandHandler(command: string): CommandHandler | undefined {
  return COMMAND_REGISTRY[resolveCommandAlias(command)];
}
