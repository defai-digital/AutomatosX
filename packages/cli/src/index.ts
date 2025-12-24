// Main CLI exports
export { run, createCLI } from './cli.js';
export { parseArgs, formatOutput, parseTime } from './parser.js';

// Command exports
export {
  runCommand,
  listCommand,
  traceCommand,
  doctorCommand,
  guardCommand,
  discussCommand,
  helpCommand,
  versionCommand,
  CLI_VERSION,
  // High-value additions
  resumeCommand,
  historyCommand,
  statusCommand,
  cleanupCommand,
} from './commands/index.js';

// Utility exports
export {
  checkDangerousOp,
  listDangerousOperations,
  isDangerousOp,
  type DangerousOpOptions,
} from './utils/index.js';

// Bootstrap exports (for testing)
export { resetStepExecutor } from './bootstrap.js';

// Type exports
export type {
  CLIConfig,
  CLIOptions,
  ParsedCommand,
  CommandResult,
  CommandHandler,
  CLICommand,
} from './types.js';

export { CLI_COMMANDS } from './types.js';
