/**
 * Config command - Configuration management for AutomatosX
 */

import type { CommandResult, CLIOptions } from '../types.js';
import {
  createConfigStore,
  getValue,
  setValue,
} from '@defai.digital/config-domain';
import { safeValidateConfig } from '@defai.digital/contracts';
import { COLORS, ICONS } from '../utils/terminal.js';
import { success, successJson, failure, failureFromError } from '../utils/formatters.js';

type ConfigScope = 'global' | 'local' | 'merged';

// ============================================================================
// Helper Functions
// ============================================================================

function parseScope(args: string[]): ConfigScope {
  for (const arg of args) {
    if (arg === '--global' || arg === '-g') return 'global';
    if (arg === '--local' || arg === '-l') return 'local';
    if (arg === '--merged' || arg === '-m') return 'merged';
  }
  return 'merged';
}

function formatValue(value: unknown): string {
  if (value === undefined) return `${COLORS.dim}(undefined)${COLORS.reset}`;
  if (value === null) return `${COLORS.dim}null${COLORS.reset}`;
  if (typeof value === 'boolean') return value ? `${COLORS.green}true${COLORS.reset}` : `${COLORS.red}false${COLORS.reset}`;
  if (typeof value === 'number') return `${COLORS.cyan}${value}${COLORS.reset}`;
  if (typeof value === 'string') return `"${value}"`;
  return JSON.stringify(value, null, 2);
}

function parseValue(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

/** Returns result in appropriate format (JSON or text) */
function result(isJson: boolean, text: string, data: unknown): CommandResult {
  return isJson ? successJson(data) : success(text, data);
}

/** Returns error in appropriate format (JSON or text) */
function errorResult(isJson: boolean, text: string, errorData?: unknown): CommandResult {
  return isJson
    ? { success: false, message: undefined, data: errorData ?? { error: text }, exitCode: 1 }
    : failure(text);
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

async function handleShow(args: string[], options: CLIOptions): Promise<CommandResult> {
  const store = createConfigStore();
  const scope = parseScope(args);
  const isJson = options.format === 'json';

  try {
    const config = scope === 'merged' ? await store.readMerged() : await store.read(scope);

    if (config === undefined) {
      return errorResult(isJson, `${ICONS.cross} No configuration found for scope: ${scope}`);
    }

    if (isJson) {
      return successJson({ scope, config });
    }

    const providerLines = Object.entries(config.providers).map(([id, p], i) => {
      const status = p.enabled ? `${COLORS.green}enabled${COLORS.reset}` : `${COLORS.red}disabled${COLORS.reset}`;
      const def = config.defaultProvider === id ? ' [DEFAULT]' : '';
      return `  ${i + 1}. ${id} (priority: ${p.priority}, ${status})${def}`;
    });

    const output = [
      '',
      `${COLORS.bold}AutomatosX Configuration (${scope})${COLORS.reset}`,
      '\u2500'.repeat(50),
      '',
      `${COLORS.bold}Version:${COLORS.reset} ${config.version}`,
      `${COLORS.bold}Log Level:${COLORS.reset} ${config.logLevel}`,
      `${COLORS.bold}Telemetry:${COLORS.reset} ${config.telemetryEnabled ? 'enabled' : 'disabled'}`,
      '',
      `${COLORS.bold}Providers:${COLORS.reset}`,
      providerLines.length > 0 ? providerLines.join('\n') : '  (no providers configured)',
      '',
      `${COLORS.bold}Execution Policy:${COLORS.reset}`,
      `  Timeout: ${config.executionPolicy.defaultTimeoutMs}ms`,
      `  Max Retries: ${config.executionPolicy.maxRetries}`,
      `  Parallel: ${config.executionPolicy.enableParallelExecution ? 'enabled' : 'disabled'}`,
      '',
      `${COLORS.bold}Features:${COLORS.reset}`,
      `  Tracing: ${config.features.enableTracing ? 'enabled' : 'disabled'}`,
      `  Memory: ${config.features.enableMemoryPersistence ? 'enabled' : 'disabled'}`,
      `  Guard: ${config.features.enableGuard ? 'enabled' : 'disabled'}`,
      `  Metrics: ${config.features.enableMetrics ? 'enabled' : 'disabled'}`,
      '',
      `${COLORS.bold}Workspace:${COLORS.reset}`,
      `  Data Dir: ${config.workspace.dataDir}`,
      '',
    ];

    return success(output.join('\n'));
  } catch (error) {
    return failureFromError('read config', error);
  }
}

async function handleGet(args: string[], options: CLIOptions): Promise<CommandResult> {
  const store = createConfigStore();
  const scope = parseScope(args);
  const isJson = options.format === 'json';
  const path = args.find(arg => !arg.startsWith('-') && arg !== 'get');

  if (path === undefined) {
    return errorResult(isJson, 'Usage: ax config get <path> [--scope]');
  }

  try {
    const config = scope === 'merged' ? await store.readMerged() : await store.read(scope);

    if (config === undefined) {
      return errorResult(isJson, `${ICONS.cross} No configuration found`);
    }

    const value = getValue(config, path);

    if (isJson) {
      return successJson({ path, value, scope, found: value !== undefined });
    }

    return success(value === undefined ? `${path}: ${COLORS.dim}(not set)${COLORS.reset}` : formatValue(value));
  } catch (error) {
    return failureFromError('get config value', error);
  }
}

async function handleSet(args: string[], options: CLIOptions): Promise<CommandResult> {
  const store = createConfigStore();
  const isJson = options.format === 'json';

  let scope: 'global' | 'local' = 'global';
  for (const arg of args) {
    if (arg === '--local' || arg === '-l') scope = 'local';
    if (arg === '--global' || arg === '-g') scope = 'global';
  }

  const nonFlagArgs = args.filter(arg => !arg.startsWith('-') && arg !== 'set');
  const path = nonFlagArgs[0];
  const valueStr = nonFlagArgs.slice(1).join(' ');

  if (path === undefined || valueStr === '') {
    return errorResult(isJson, 'Usage: ax config set <path> <value> [--scope]');
  }

  try {
    let config = await store.read(scope);

    if (config === undefined) {
      return errorResult(isJson, `${ICONS.cross} No ${scope} configuration found. Run 'ax setup' first.`);
    }

    const oldValue = getValue(config, path);
    const newValue = parseValue(valueStr);
    config = setValue(config, path, newValue);

    const validation = safeValidateConfig(config);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return errorResult(isJson, `${ICONS.cross} Invalid value: ${errors.join(', ')}`, { error: 'Validation failed', errors });
    }

    await store.write(config, scope);

    return result(isJson, `${ICONS.check} Set ${path} = ${formatValue(newValue)}`, { path, oldValue, newValue, scope });
  } catch (error) {
    return failureFromError('set config value', error);
  }
}

async function handleReset(args: string[], options: CLIOptions): Promise<CommandResult> {
  const store = createConfigStore();
  const isJson = options.format === 'json';

  let scope: 'global' | 'local' | 'all' = 'global';
  let confirmed = false;

  for (const arg of args) {
    if (arg === '--local' || arg === '-l') scope = 'local';
    if (arg === '--global' || arg === '-g') scope = 'global';
    if (arg === '--all' || arg === '-a') scope = 'all';
    if (arg === '--confirm' || arg === '-y') confirmed = true;
  }

  if (!confirmed) {
    return errorResult(isJson, `${ICONS.warn} This will delete ${scope} configuration. Use --confirm to proceed.`);
  }

  try {
    const deleted: string[] = [];

    if (scope === 'all' || scope === 'global') {
      if (await store.delete('global')) deleted.push('global');
    }
    if (scope === 'all' || scope === 'local') {
      if (await store.delete('local')) deleted.push('local');
    }

    if (isJson) {
      return successJson({ scope, deleted });
    }

    return success(deleted.length === 0
      ? `${ICONS.warn} No configuration files found to delete`
      : `${ICONS.check} Deleted configuration: ${deleted.join(', ')}`);
  } catch (error) {
    return failureFromError('reset config', error);
  }
}

async function handlePath(_args: string[], options: CLIOptions): Promise<CommandResult> {
  const store = createConfigStore();
  const isJson = options.format === 'json';

  const globalPath = store.getPath('global');
  const localPath = store.getPath('local');
  const globalExists = await store.exists('global');
  const localExists = await store.exists('local');

  if (isJson) {
    return successJson({
      global: { path: globalPath, exists: globalExists },
      local: { path: localPath, exists: localExists },
    });
  }

  const status = (exists: boolean) => exists
    ? `${COLORS.green}(exists)${COLORS.reset}`
    : `${COLORS.dim}(not found)${COLORS.reset}`;

  const output = [
    '',
    `${COLORS.bold}Configuration Paths${COLORS.reset}`,
    '',
    `Global: ${globalPath} ${status(globalExists)}`,
    `Local:  ${localPath} ${status(localExists)}`,
    '',
  ];

  return success(output.join('\n'));
}

// ============================================================================
// Main Command Handler
// ============================================================================

export async function configCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'show':
      return handleShow(args.slice(1), options);
    case 'get':
      return handleGet(args.slice(1), options);
    case 'set':
      return handleSet(args.slice(1), options);
    case 'reset':
      return handleReset(args.slice(1), options);
    case 'path':
      return handlePath(args.slice(1), options);
    default:
      if (subcommand === undefined || subcommand.startsWith('-')) {
        return handleShow(args, options);
      }

      return failure(`Unknown subcommand: ${subcommand}

Usage: ax config <subcommand> [options]

Subcommands:
  show    Show current configuration
  get     Get a specific config value
  set     Set a config value
  reset   Reset configuration to defaults
  path    Show config file paths

Examples:
  ax config show
  ax config get logLevel
  ax config set logLevel debug
  ax config reset --confirm`);
  }
}
