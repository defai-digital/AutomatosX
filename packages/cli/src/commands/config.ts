/**
 * Config command - Configuration management for AutomatosX
 *
 * Subcommands:
 * - show: Display current configuration
 * - get: Get a specific config value
 * - set: Set a config value
 * - reset: Reset configuration to defaults
 * - path: Show config file paths
 */

import type { CommandResult, CLIOptions } from '../types.js';
import {
  createConfigStore,
  getValue,
  setValue,
} from '@defai.digital/config-domain';
import {
  type AutomatosXConfig,
  safeValidateConfig,
} from '@defai.digital/contracts';

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const ICONS = {
  check: `${COLORS.green}\u2713${COLORS.reset}`,
  cross: `${COLORS.red}\u2717${COLORS.reset}`,
  warn: `${COLORS.yellow}\u26A0${COLORS.reset}`,
  arrow: `${COLORS.cyan}\u2192${COLORS.reset}`,
};

// ============================================================================
// Helper Functions
// ============================================================================

type ConfigScope = 'global' | 'local' | 'merged';

/**
 * Parses scope from arguments
 */
function parseScope(args: string[]): ConfigScope {
  for (const arg of args) {
    if (arg === '--global' || arg === '-g') return 'global';
    if (arg === '--local' || arg === '-l') return 'local';
    if (arg === '--merged' || arg === '-m') return 'merged';
  }
  return 'merged';
}

/**
 * Formats a config value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return `${COLORS.dim}(undefined)${COLORS.reset}`;
  }
  if (value === null) {
    return `${COLORS.dim}null${COLORS.reset}`;
  }
  if (typeof value === 'boolean') {
    return value ? `${COLORS.green}true${COLORS.reset}` : `${COLORS.red}false${COLORS.reset}`;
  }
  if (typeof value === 'number') {
    return `${COLORS.cyan}${String(value)}${COLORS.reset}`;
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Parses a value from string input
 */
function parseValue(input: string): unknown {
  // Try to parse as JSON
  try {
    return JSON.parse(input);
  } catch {
    // Return as string if not valid JSON
    return input;
  }
}

// ============================================================================
// Subcommand Handlers
// ============================================================================

/**
 * Shows full configuration
 */
async function handleShow(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const store = createConfigStore();
  const scope = parseScope(args);
  const isJson = options.format === 'json';

  try {
    let config: AutomatosXConfig | undefined;

    if (scope === 'merged') {
      config = await store.readMerged();
    } else {
      config = await store.read(scope);
    }

    if (config === undefined) {
      if (isJson) {
        return {
          success: false,
          message: undefined,
          data: { error: `No configuration found for scope: ${scope}` },
          exitCode: 1,
        };
      }
      return {
        success: false,
        message: `${ICONS.cross} No configuration found for scope: ${scope}`,
        data: undefined,
        exitCode: 1,
      };
    }

    if (isJson) {
      return {
        success: true,
        message: undefined,
        data: { scope, config },
        exitCode: 0,
      };
    }

    // Text format
    const output: string[] = [];
    output.push('');
    output.push(`${COLORS.bold}AutomatosX Configuration (${scope})${COLORS.reset}`);
    output.push('\u2500'.repeat(50));
    output.push('');

    // Version and metadata
    output.push(`${COLORS.bold}Version:${COLORS.reset} ${config.version}`);
    output.push(`${COLORS.bold}Log Level:${COLORS.reset} ${config.logLevel}`);
    output.push(`${COLORS.bold}Telemetry:${COLORS.reset} ${config.telemetryEnabled ? 'enabled' : 'disabled'}`);
    output.push('');

    // Providers (Record format keyed by provider name)
    output.push(`${COLORS.bold}Providers:${COLORS.reset}`);
    const providerEntries = Object.entries(config.providers);
    if (providerEntries.length === 0) {
      output.push('  (no providers configured)');
    } else {
      let i = 0;
      for (const [providerId, p] of providerEntries) {
        const isDefault = config.defaultProvider === providerId;
        const status = p.enabled ? COLORS.green + 'enabled' + COLORS.reset : COLORS.red + 'disabled' + COLORS.reset;
        const defaultMarker = isDefault ? ' [DEFAULT]' : '';
        output.push(`  ${String(i + 1)}. ${providerId} (priority: ${String(p.priority)}, ${status})${defaultMarker}`);
        i++;
      }
    }
    output.push('');

    // Execution Policy
    output.push(`${COLORS.bold}Execution Policy:${COLORS.reset}`);
    output.push(`  Timeout: ${String(config.executionPolicy.defaultTimeoutMs)}ms`);
    output.push(`  Max Retries: ${String(config.executionPolicy.maxRetries)}`);
    output.push(`  Parallel: ${config.executionPolicy.enableParallelExecution ? 'enabled' : 'disabled'}`);
    output.push('');

    // Features
    output.push(`${COLORS.bold}Features:${COLORS.reset}`);
    output.push(`  Tracing: ${config.features.enableTracing ? 'enabled' : 'disabled'}`);
    output.push(`  Memory: ${config.features.enableMemoryPersistence ? 'enabled' : 'disabled'}`);
    output.push(`  Guard: ${config.features.enableGuard ? 'enabled' : 'disabled'}`);
    output.push(`  Metrics: ${config.features.enableMetrics ? 'enabled' : 'disabled'}`);
    output.push('');

    // Workspace
    output.push(`${COLORS.bold}Workspace:${COLORS.reset}`);
    output.push(`  Data Dir: ${config.workspace.dataDir}`);
    output.push('');

    return {
      success: true,
      message: output.join('\n'),
      data: undefined,
      exitCode: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (isJson) {
      return {
        success: false,
        message: undefined,
        data: { error: errorMessage },
        exitCode: 1,
      };
    }
    return {
      success: false,
      message: `${ICONS.cross} Error: ${errorMessage}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Gets a specific config value
 */
async function handleGet(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const store = createConfigStore();
  const scope = parseScope(args);
  const isJson = options.format === 'json';

  // Find the path argument (first non-flag argument after 'get')
  const path = args.find((arg) => !arg.startsWith('-') && arg !== 'get');

  if (path === undefined) {
    const message = 'Usage: ax config get <path> [--scope]';
    if (isJson) {
      return { success: false, message: undefined, data: { error: message }, exitCode: 1 };
    }
    return { success: false, message, data: undefined, exitCode: 1 };
  }

  try {
    let config: AutomatosXConfig | undefined;

    if (scope === 'merged') {
      config = await store.readMerged();
    } else {
      config = await store.read(scope);
    }

    if (config === undefined) {
      if (isJson) {
        return {
          success: false,
          message: undefined,
          data: { error: 'No configuration found' },
          exitCode: 1,
        };
      }
      return {
        success: false,
        message: `${ICONS.cross} No configuration found`,
        data: undefined,
        exitCode: 1,
      };
    }

    const value = getValue(config, path);

    if (isJson) {
      return {
        success: true,
        message: undefined,
        data: { path, value, scope, found: value !== undefined },
        exitCode: 0,
      };
    }

    if (value === undefined) {
      return {
        success: true,
        message: `${path}: ${COLORS.dim}(not set)${COLORS.reset}`,
        data: undefined,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: formatValue(value),
      data: undefined,
      exitCode: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (isJson) {
      return { success: false, message: undefined, data: { error: errorMessage }, exitCode: 1 };
    }
    return { success: false, message: `${ICONS.cross} Error: ${errorMessage}`, data: undefined, exitCode: 1 };
  }
}

/**
 * Sets a config value
 */
async function handleSet(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const store = createConfigStore();
  const isJson = options.format === 'json';

  // Parse scope (default to global for set)
  let scope: 'global' | 'local' = 'global';
  for (const arg of args) {
    if (arg === '--local' || arg === '-l') scope = 'local';
    if (arg === '--global' || arg === '-g') scope = 'global';
  }

  // Find path and value (non-flag arguments after 'set')
  const nonFlagArgs = args.filter((arg) => !arg.startsWith('-') && arg !== 'set');
  const path = nonFlagArgs[0];
  const valueStr = nonFlagArgs.slice(1).join(' ');

  if (path === undefined || valueStr === '') {
    const message = 'Usage: ax config set <path> <value> [--scope]';
    if (isJson) {
      return { success: false, message: undefined, data: { error: message }, exitCode: 1 };
    }
    return { success: false, message, data: undefined, exitCode: 1 };
  }

  try {
    // Read existing config
    let config = await store.read(scope);

    if (config === undefined) {
      if (isJson) {
        return {
          success: false,
          message: undefined,
          data: { error: `No ${scope} configuration found. Run 'ax setup' first.` },
          exitCode: 1,
        };
      }
      return {
        success: false,
        message: `${ICONS.cross} No ${scope} configuration found. Run 'ax setup' first.`,
        data: undefined,
        exitCode: 1,
      };
    }

    const oldValue = getValue(config, path);
    const newValue = parseValue(valueStr);

    // Update config
    config = setValue(config, path, newValue);

    // Validate
    const validation = safeValidateConfig(config);
    if (!validation.success) {
      const errors = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      if (isJson) {
        return {
          success: false,
          message: undefined,
          data: { error: 'Validation failed', errors },
          exitCode: 1,
        };
      }
      return {
        success: false,
        message: `${ICONS.cross} Invalid value: ${errors.join(', ')}`,
        data: undefined,
        exitCode: 1,
      };
    }

    // Save
    await store.write(config, scope);

    if (isJson) {
      return {
        success: true,
        message: undefined,
        data: { path, oldValue, newValue, scope },
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `${ICONS.check} Set ${path} = ${formatValue(newValue)}`,
      data: undefined,
      exitCode: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (isJson) {
      return { success: false, message: undefined, data: { error: errorMessage }, exitCode: 1 };
    }
    return { success: false, message: `${ICONS.cross} Error: ${errorMessage}`, data: undefined, exitCode: 1 };
  }
}

/**
 * Resets configuration to defaults
 */
async function handleReset(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const store = createConfigStore();
  const isJson = options.format === 'json';

  // Parse scope
  let scope: 'global' | 'local' | 'all' = 'global';
  let confirmed = false;

  for (const arg of args) {
    if (arg === '--local' || arg === '-l') scope = 'local';
    if (arg === '--global' || arg === '-g') scope = 'global';
    if (arg === '--all' || arg === '-a') scope = 'all';
    if (arg === '--confirm' || arg === '-y') confirmed = true;
  }

  if (!confirmed) {
    const message = `This will delete ${scope} configuration. Use --confirm to proceed.`;
    if (isJson) {
      return { success: false, message: undefined, data: { error: message }, exitCode: 1 };
    }
    return { success: false, message: `${ICONS.warn} ${message}`, data: undefined, exitCode: 1 };
  }

  try {
    const deleted: string[] = [];

    if (scope === 'all' || scope === 'global') {
      const globalDeleted = await store.delete('global');
      if (globalDeleted) deleted.push('global');
    }

    if (scope === 'all' || scope === 'local') {
      const localDeleted = await store.delete('local');
      if (localDeleted) deleted.push('local');
    }

    if (isJson) {
      return {
        success: true,
        message: undefined,
        data: { scope, deleted },
        exitCode: 0,
      };
    }

    if (deleted.length === 0) {
      return {
        success: true,
        message: `${ICONS.warn} No configuration files found to delete`,
        data: undefined,
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: `${ICONS.check} Deleted configuration: ${deleted.join(', ')}`,
      data: undefined,
      exitCode: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (isJson) {
      return { success: false, message: undefined, data: { error: errorMessage }, exitCode: 1 };
    }
    return { success: false, message: `${ICONS.cross} Error: ${errorMessage}`, data: undefined, exitCode: 1 };
  }
}

/**
 * Shows config file paths
 */
async function handlePath(
  _args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const store = createConfigStore();
  const isJson = options.format === 'json';

  const globalPath = store.getPath('global');
  const localPath = store.getPath('local');
  const globalExists = await store.exists('global');
  const localExists = await store.exists('local');

  if (isJson) {
    return {
      success: true,
      message: undefined,
      data: {
        global: { path: globalPath, exists: globalExists },
        local: { path: localPath, exists: localExists },
      },
      exitCode: 0,
    };
  }

  const output: string[] = [];
  output.push('');
  output.push(`${COLORS.bold}Configuration Paths${COLORS.reset}`);
  output.push('');
  output.push(`Global: ${globalPath} ${globalExists ? COLORS.green + '(exists)' + COLORS.reset : COLORS.dim + '(not found)' + COLORS.reset}`);
  output.push(`Local:  ${localPath} ${localExists ? COLORS.green + '(exists)' + COLORS.reset : COLORS.dim + '(not found)' + COLORS.reset}`);
  output.push('');

  return {
    success: true,
    message: output.join('\n'),
    data: undefined,
    exitCode: 0,
  };
}

// ============================================================================
// Main Command Handler
// ============================================================================

/**
 * Config command handler
 */
export async function configCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
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
      // Default to 'show' if no subcommand
      if (subcommand === undefined || subcommand.startsWith('-')) {
        return handleShow(args, options);
      }

      const message = `Unknown subcommand: ${subcommand}

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
  ax config reset --confirm`;

      return {
        success: false,
        message,
        data: undefined,
        exitCode: 1,
      };
  }
}
