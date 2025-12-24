/**
 * Setup command - Interactive setup wizard for AutomatosX
 *
 * Features:
 * - Provider detection
 * - Configuration creation
 * - Non-interactive mode for CI
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  createConfigStore,
  initConfigDirectory,
} from '@automatosx/config-domain';
import {
  DEFAULT_CONFIG,
  KNOWN_PROVIDERS,
  PROVIDER_DEFAULTS,
  DATA_DIR_NAME,
  CONFIG_FILENAME,
  TIMEOUT_SETUP_ADD,
  TIMEOUT_SETUP_REMOVE,
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_WORKFLOW_STEP,
  DEFAULT_SCHEMA_VERSION,
  ITERATE_MAX_DEFAULT,
  ITERATE_TIMEOUT_DEFAULT,
  type AutomatosXConfig,
  type ProviderId,
  type ProviderDetectionResult,
} from '@automatosx/contracts';
import { CONTEXT_DIRECTORY } from '@automatosx/context-domain';
import {
  PROVIDER_CHECKS,
  checkProviderCLI,
  type CheckResult,
} from './doctor.js';

const execAsync = promisify(exec);

// ============================================================================
// Constants
// ============================================================================

/** MCP server name registered with provider CLIs */
const MCP_SERVER_NAME = 'automatosx';

/** Fallback CLI command when binary path cannot be determined */
const CLI_FALLBACK_COMMAND = 'ax';

/** Node.js executable for running scripts */
const NODE_EXECUTABLE = 'node';

/** MCP subcommand arguments */
const MCP_SUBCOMMAND_ARGS = 'mcp server';

/** Conventions file name in context directory */
const CONVENTIONS_FILENAME = 'conventions.md';

/** Provider name display width for aligned output */
const PROVIDER_NAME_WIDTH = 10;

/** Default error message when error type is unknown */
const DEFAULT_ERROR_MESSAGE = 'Unknown error';

/** Stderr redirect suffix for shell commands */
const STDERR_REDIRECT = '2>&1';

/** Regex pattern to extract semver version from CLI output */
const VERSION_PATTERN = /(\d+\.\d+\.\d+)/;

/** Platform-specific command to find executables */
const WHICH_COMMAND = process.platform === 'win32' ? 'where' : 'which';

/** CLI argument flags */
const CLI_FLAGS = {
  force: ['--force', '-f'],
  nonInteractive: ['--non-interactive', '-y'],
  local: ['--local', '-l'],
  global: ['--global', '-g'],
  skipProject: ['--skip-project', '--no-project'],
} as const;

/** Terminal color codes */
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
} as const;

/** Terminal output icons */
const ICONS = {
  check: `${COLORS.green}\u2713${COLORS.reset}`,
  cross: `${COLORS.red}\u2717${COLORS.reset}`,
  warn: `${COLORS.yellow}\u26A0${COLORS.reset}`,
  arrow: `${COLORS.cyan}\u2192${COLORS.reset}`,
} as const;

// ============================================================================
// MCP Configuration for Providers
// ============================================================================

/**
 * MCP command format types:
 * - 'standard': <cli> mcp add <name> <command> [args...]
 * - 'claude': <cli> mcp add <name> -s local <command> [args...]
 * - 'ax-wrapper': <cli> mcp add <name> --command <cmd> --args <args...>
 */
type MCPCommandFormat = 'standard' | 'claude' | 'ax-wrapper';

/** Provider MCP CLI configuration */
interface ProviderMCPConfig {
  cliName: string;
  format: MCPCommandFormat;
}

/** MCP configuration for each provider */
const PROVIDER_MCP_CONFIGS: Record<ProviderId, ProviderMCPConfig> = {
  claude: { cliName: 'claude', format: 'claude' },
  gemini: { cliName: 'gemini', format: 'standard' },
  codex: { cliName: 'codex', format: 'standard' },
  qwen: { cliName: 'qwen', format: 'standard' },
  glm: { cliName: 'ax-glm', format: 'ax-wrapper' },
  grok: { cliName: 'ax-grok', format: 'ax-wrapper' },
  'ax-cli': { cliName: 'ax-cli', format: 'ax-wrapper' },
};

/**
 * Get the absolute path to the CLI binary.
 * Uses process.argv[1] which works for both global and local installations.
 */
function getCLIBinaryPath(): string {
  const binPath = process.argv[1];
  return binPath || CLI_FALLBACK_COMMAND;
}

/**
 * Check if a path is absolute (Unix or Windows style)
 */
function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.includes('\\');
}

/**
 * Build the MCP server command parts based on binary path.
 * Returns { command, args } for use in MCP add commands.
 */
function buildMCPServerCommand(binPath: string): { command: string; args: string } {
  if (isAbsolutePath(binPath)) {
    return { command: NODE_EXECUTABLE, args: `"${binPath}" ${MCP_SUBCOMMAND_ARGS}` };
  }
  return { command: binPath, args: MCP_SUBCOMMAND_ARGS };
}

/**
 * Get the CLI command to add AutomatosX MCP server for a provider.
 * Uses provider's native CLI to ensure proper formatting and validation.
 */
function getMCPAddCommand(providerId: ProviderId): string | null {
  const config = PROVIDER_MCP_CONFIGS[providerId];
  if (!config) return null;

  const binPath = getCLIBinaryPath();
  const { command, args } = buildMCPServerCommand(binPath);

  switch (config.format) {
    case 'standard':
      return `${config.cliName} mcp add ${MCP_SERVER_NAME} ${command} ${args}`;

    case 'claude':
      // Claude uses -s local to add to user's local config (not project .mcp.json)
      return `${config.cliName} mcp add ${MCP_SERVER_NAME} -s local ${command} ${args}`;

    case 'ax-wrapper':
      if (isAbsolutePath(binPath)) {
        return `${config.cliName} mcp add ${MCP_SERVER_NAME} --command ${NODE_EXECUTABLE} --args "${binPath}" ${MCP_SUBCOMMAND_ARGS}`;
      }
      return `${config.cliName} mcp add ${MCP_SERVER_NAME} --command ${CLI_FALLBACK_COMMAND} --args ${MCP_SUBCOMMAND_ARGS}`;

    default:
      return null;
  }
}

/**
 * Get the CLI command to remove MCP server for a provider.
 */
function getMCPRemoveCommand(providerId: ProviderId): string | null {
  const config = PROVIDER_MCP_CONFIGS[providerId];
  if (!config) return null;

  // Claude requires explicit scope flag
  const scopeFlag = config.format === 'claude' ? ' -s local' : '';
  return `${config.cliName} mcp remove ${MCP_SERVER_NAME}${scopeFlag}`;
}

/**
 * Configure MCP for a detected provider using CLI commands
 *
 * Strategy (always remove-then-add for clean state):
 * 1. Remove any existing automatosx MCP config (ignore errors if not exists)
 * 2. Add automatosx MCP server using provider's native CLI
 *
 * This ensures a clean configuration state and updates any stale configs.
 */
async function configureMCPForProvider(providerId: ProviderId): Promise<{
  success: boolean;
  skipped: boolean;
  error?: string;
}> {
  const addCommand = getMCPAddCommand(providerId);
  const removeCommand = getMCPRemoveCommand(providerId);

  if (!addCommand) {
    return { success: true, skipped: true }; // Provider doesn't support MCP
  }

  try {
    // Step 1: Always remove first for clean state (ignore errors - may not exist)
    if (removeCommand) {
      try {
        await execAsync(`${removeCommand} ${STDERR_REDIRECT}`, { timeout: TIMEOUT_SETUP_REMOVE });
      } catch {
        // Ignore - server might not exist, that's OK
      }
    }

    // Step 2: Add automatosx MCP server using provider's native CLI
    await execAsync(`${addCommand} ${STDERR_REDIRECT}`, { timeout: TIMEOUT_SETUP_ADD });

    return { success: true, skipped: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
    // Extract meaningful error from command output if available
    const cleanError = errorMessage.includes('Command failed')
      ? errorMessage.split('\n').pop() || errorMessage
      : errorMessage;
    return {
      success: false,
      skipped: false,
      error: cleanError,
    };
  }
}

/**
 * Use ax doctor logic to check which provider CLIs are installed
 * This ensures consistent detection between 'ax doctor' and 'ax setup'
 */
async function getInstalledProviderCLIs(): Promise<Map<string, CheckResult>> {
  const results = new Map<string, CheckResult>();

  // Run doctor-style checks for all providers
  for (const provider of PROVIDER_CHECKS) {
    const checkResult = await checkProviderCLI(provider);
    results.set(provider.id, checkResult);
  }

  return results;
}

/**
 * Configure MCP for all detected providers using their native CLI commands
 *
 * Uses 'ax doctor' check logic to determine which CLIs are installed.
 * Only configures MCP for providers that pass the doctor check.
 */
async function configureMCPForAllProviders(): Promise<{
  configured: string[];
  skipped: string[];
  notInstalled: string[];
  failed: { providerId: string; error: string }[];
}> {
  const configured: string[] = [];
  const skipped: string[] = [];
  const notInstalled: string[] = [];
  const failed: { providerId: string; error: string }[] = [];

  // Step 1: Use doctor check to determine installed CLIs
  const installedCLIs = await getInstalledProviderCLIs();

  // Step 2: Only configure MCP for providers that are installed (pass doctor check)
  for (const [providerId, checkResult] of installedCLIs) {
    // Skip if CLI is not installed (failed doctor check)
    if (checkResult.status === 'fail') {
      notInstalled.push(providerId);
      continue;
    }

    // Configure MCP for installed provider
    const result = await configureMCPForProvider(providerId as ProviderId);

    if (result.skipped) {
      skipped.push(providerId);
    } else if (result.success) {
      configured.push(providerId);
    } else {
      failed.push({
        providerId,
        error: result.error || DEFAULT_ERROR_MESSAGE,
      });
    }
  }

  return { configured, skipped, notInstalled, failed };
}

// ============================================================================
// Provider Detection
// ============================================================================

/**
 * Checks if a command is available on PATH
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await execAsync(`${WHICH_COMMAND} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the version of a CLI command
 */
async function getCommandVersion(command: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`${command} --version ${STDERR_REDIRECT}`, {
      timeout: TIMEOUT_HEALTH_CHECK,
    });
    const versionMatch = VERSION_PATTERN.exec(stdout);
    return versionMatch?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Detects a single provider
 *
 * Note: AutomatosX does NOT check for authentication.
 * All CLIs handle their own authentication internally.
 * If a CLI is detected, it's considered ready to use.
 */
async function detectProvider(providerId: ProviderId): Promise<ProviderDetectionResult> {
  const defaults = PROVIDER_DEFAULTS[providerId];
  const detected = await isCommandAvailable(defaults.command);

  if (!detected) {
    return {
      providerId,
      detected: false,
      command: defaults.command,
    };
  }

  const version = await getCommandVersion(defaults.command);

  return {
    providerId,
    detected: true,
    command: defaults.command,
    version,
  };
}

/**
 * Detects all providers in parallel
 */
async function detectAllProviders(): Promise<ProviderDetectionResult[]> {
  const results = await Promise.all(
    KNOWN_PROVIDERS.map((id) => detectProvider(id))
  );
  return results;
}

// ============================================================================
// Project Structure Creation
// ============================================================================

/**
 * Template for project conventions file
 */
const CONVENTIONS_TEMPLATE = `# Project Conventions

## Code Style
<!-- Describe your coding standards -->
- Example: Use TypeScript strict mode
- Example: Prefer functional components over class components
- Example: Use named exports over default exports

## Architecture
<!-- Describe your project structure -->
- Example: Domain-driven design with packages/core/*/
- Example: Contract-first: all types in packages/contracts/
- Example: No circular dependencies between packages

## Testing
<!-- Describe testing practices -->
- Example: Use vitest for unit tests
- Example: Co-locate tests with source: *.test.ts
- Example: Mock external dependencies, not internal modules

## Naming Conventions
<!-- Describe naming conventions -->
- Example: Use camelCase for variables and functions
- Example: Use PascalCase for types and classes
- Example: Prefix interfaces with I (e.g., IUserService)
`;

/**
 * Template for project config.json
 */
const PROJECT_CONFIG_TEMPLATE = {
  version: DEFAULT_SCHEMA_VERSION,
  iterate: {
    maxIterations: ITERATE_MAX_DEFAULT,
    maxTimeMs: ITERATE_TIMEOUT_DEFAULT,
    autoConfirm: false,
  },
};

/**
 * Creates the .automatosx/ project structure
 */
async function createProjectStructure(
  projectDir: string,
  force: boolean
): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const automatosxDir = join(projectDir, DATA_DIR_NAME);
  const contextDir = join(automatosxDir, CONTEXT_DIRECTORY);
  const configPath = join(automatosxDir, CONFIG_FILENAME);
  const conventionsPath = join(contextDir, CONVENTIONS_FILENAME);

  // Create data directory
  try {
    await mkdir(automatosxDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Create context directory
  try {
    await mkdir(contextDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  // Create project config.json
  const configExists = await fileExists(configPath);
  if (!configExists || force) {
    await writeFile(configPath, JSON.stringify(PROJECT_CONFIG_TEMPLATE, null, 2) + '\n');
    created.push(`${DATA_DIR_NAME}/${CONFIG_FILENAME}`);
  } else {
    skipped.push(`${DATA_DIR_NAME}/${CONFIG_FILENAME} (already exists)`);
  }

  // Create conventions template
  const conventionsExists = await fileExists(conventionsPath);
  if (!conventionsExists || force) {
    await writeFile(conventionsPath, CONVENTIONS_TEMPLATE);
    created.push(`${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME}`);
  } else {
    skipped.push(`${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME} (already exists)`);
  }

  return { created, skipped };
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Setup Logic
// ============================================================================

interface SetupOptions {
  force: boolean;
  nonInteractive: boolean;
  scope: 'global' | 'local';
  skipProjectStructure: boolean;
}

/**
 * Runs the setup process
 */
async function runSetup(options: SetupOptions): Promise<{
  success: boolean;
  config: AutomatosXConfig;
  providers: ProviderDetectionResult[];
  configPath: string;
}> {
  const store = createConfigStore();
  const configPath = store.getPath(options.scope);

  // Check if config already exists
  const exists = await store.exists(options.scope);
  if (exists && !options.force) {
    throw new Error(
      `Configuration already exists at ${configPath}. Use --force to overwrite.`
    );
  }

  // Initialize directory
  await initConfigDirectory(options.scope);

  // Detect providers
  const providers = await detectAllProviders();

  // Build config - all detected providers are enabled
  // AutomatosX does NOT manage credentials - CLIs handle their own auth
  const detectedProviders = providers.filter((p) => p.detected);

  // Build providers as Record keyed by providerId (matches old working design)
  const providersConfig: Record<string, { enabled: boolean; priority: number; timeout: number; command?: string }> = {};
  for (const p of detectedProviders) {
    const defaults = PROVIDER_DEFAULTS[p.providerId];
    providersConfig[p.providerId] = {
      enabled: true,
      priority: defaults.priority,
      timeout: TIMEOUT_WORKFLOW_STEP,
      command: defaults.command,
    };
  }

  // Sort provider IDs by priority to find default (highest first)
  const sortedProviderIds = Object.keys(providersConfig).sort(
    (a, b) => (providersConfig[b]?.priority ?? 0) - (providersConfig[a]?.priority ?? 0)
  );

  const config: AutomatosXConfig = {
    ...DEFAULT_CONFIG,
    providers: providersConfig,
    defaultProvider: sortedProviderIds[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save config
  await store.write(config, options.scope);

  return {
    success: true,
    config,
    providers,
    configPath,
  };
}

// ============================================================================
// Command Handler
// ============================================================================

/**
 * Check if an argument matches any of the given flags
 */
function matchesFlag(arg: string, flags: readonly string[]): boolean {
  return flags.includes(arg);
}

/**
 * Parses setup-specific arguments
 */
function parseSetupArgs(args: string[]): SetupOptions {
  let force = false;
  let nonInteractive = false;
  let scope: 'global' | 'local' = 'global';
  let skipProjectStructure = false;

  for (const arg of args) {
    if (matchesFlag(arg, CLI_FLAGS.force)) {
      force = true;
    } else if (matchesFlag(arg, CLI_FLAGS.nonInteractive)) {
      nonInteractive = true;
    } else if (matchesFlag(arg, CLI_FLAGS.local)) {
      scope = 'local';
    } else if (matchesFlag(arg, CLI_FLAGS.global)) {
      scope = 'global';
    } else if (matchesFlag(arg, CLI_FLAGS.skipProject)) {
      skipProjectStructure = true;
    }
  }

  return { force, nonInteractive, scope, skipProjectStructure };
}

/**
 * Formats provider detection result
 *
 * Note: AutomatosX does NOT check authentication.
 * All CLIs handle their own auth internally.
 */
function formatProviderResult(result: ProviderDetectionResult): string {
  let status: string;

  if (!result.detected) {
    status = `${ICONS.cross} Not detected`;
  } else {
    status = `${ICONS.check} Detected${result.version !== undefined ? ` (v${result.version})` : ''}`;
  }

  return `  ${result.providerId.padEnd(PROVIDER_NAME_WIDTH)} ${status}`;
}

/**
 * Setup command handler
 */
export async function setupCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const setupOptions = parseSetupArgs(args);
  const isJson = options.format === 'json';
  const output: string[] = [];

  try {
    // Header
    if (!isJson) {
      output.push('');
      output.push(`${COLORS.bold}AutomatosX Setup${COLORS.reset}`);
      output.push('');
    }

    // Step 1: Check prerequisites
    if (!isJson) {
      output.push(`${COLORS.bold}Step 1: System Check${COLORS.reset}`);
      const nodeVersion = process.version;
      output.push(`  ${ICONS.check} Node.js: ${nodeVersion}`);
      output.push('');
    }

    // Step 2: Detect providers
    if (!isJson) {
      output.push(`${COLORS.bold}Step 2: Provider Detection${COLORS.reset}`);
    }

    const providers = await detectAllProviders();

    if (!isJson) {
      for (const provider of providers) {
        output.push(formatProviderResult(provider));
      }
      output.push('');
    }

    // Step 3: Create configuration
    if (!isJson) {
      output.push(`${COLORS.bold}Step 3: Creating Configuration${COLORS.reset}`);
    }

    const result = await runSetup(setupOptions);

    if (!isJson) {
      output.push(`  ${ICONS.check} Configuration saved to: ${result.configPath}`);
      output.push('');
    }

    // Step 4: Create project structure (unless skipped)
    let projectStructure: { created: string[]; skipped: string[] } | undefined;

    if (!setupOptions.skipProjectStructure) {
      if (!isJson) {
        output.push(`${COLORS.bold}Step 4: Project Structure${COLORS.reset}`);
      }

      projectStructure = await createProjectStructure(process.cwd(), setupOptions.force);

      if (!isJson) {
        for (const file of projectStructure.created) {
          output.push(`  ${ICONS.check} Created ${file}`);
        }
        for (const file of projectStructure.skipped) {
          output.push(`  ${ICONS.warn} Skipped ${file}`);
        }
        output.push('');
      }
    }

    // Step 5: Configure MCP for all detected providers (using ax doctor check)
    if (!isJson) {
      output.push(`${COLORS.bold}Step 5: MCP Configuration${COLORS.reset}`);
      output.push(`  ${COLORS.dim}Using 'ax doctor' check to verify installed CLIs...${COLORS.reset}`);
    }

    const mcpResult = await configureMCPForAllProviders();

    if (!isJson) {
      for (const providerId of mcpResult.configured) {
        output.push(`  ${ICONS.check} ${providerId}: AutomatosX MCP configured`);
      }
      for (const providerId of mcpResult.notInstalled) {
        output.push(`  ${COLORS.dim}  - ${providerId}: CLI not installed, skipped${COLORS.reset}`);
      }
      for (const { providerId, error } of mcpResult.failed) {
        output.push(`  ${ICONS.warn} ${providerId}: ${error}`);
      }
      if (mcpResult.configured.length === 0 && mcpResult.failed.length === 0 && mcpResult.notInstalled.length === 0) {
        output.push(`  ${ICONS.warn} No providers detected for MCP configuration`);
      }
      output.push('');
    }

    if (!isJson) {
      // Summary
      const detected = providers.filter((p) => p.detected).length;
      const enabled = Object.keys(result.config.providers).length;

      output.push(`${COLORS.bold}Summary${COLORS.reset}`);
      output.push(`  Providers detected: ${String(detected)}/${String(KNOWN_PROVIDERS.length)}`);
      output.push(`  Providers enabled: ${String(enabled)}`);

      if (result.config.defaultProvider !== undefined) {
        output.push(`  Default provider: ${result.config.defaultProvider}`);
      }

      if (projectStructure !== undefined) {
        output.push(`  Project files created: ${projectStructure.created.length}`);
      }

      output.push(`  MCP configured: ${mcpResult.configured.length} provider(s)`);

      output.push('');
      output.push(`${COLORS.bold}Next Steps${COLORS.reset}`);
      output.push(`  1. Run ${COLORS.cyan}ax doctor${COLORS.reset} to verify installation`);
      output.push(`  2. Edit ${COLORS.cyan}${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME}${COLORS.reset} to add your project conventions`);
      output.push(`  3. Run ${COLORS.cyan}ax call --iterate <provider> "task"${COLORS.reset} to use iterate mode`);
      output.push('');
    }

    if (isJson) {
      return {
        success: true,
        message: undefined,
        data: {
          success: true,
          configPath: result.configPath,
          providers: {
            detected: providers.filter((p) => p.detected).map((p) => p.providerId),
            enabled: Object.keys(result.config.providers).filter(id => result.config.providers[id]?.enabled),
          },
          defaultProvider: result.config.defaultProvider,
          version: result.config.version,
          projectStructure: projectStructure !== undefined
            ? {
                created: projectStructure.created,
                skipped: projectStructure.skipped,
              }
            : undefined,
          mcpConfiguration: {
            configured: mcpResult.configured,
            skipped: mcpResult.skipped,
            notInstalled: mcpResult.notInstalled,
            failed: mcpResult.failed,
          },
        },
        exitCode: 0,
      };
    }

    return {
      success: true,
      message: output.join('\n'),
      data: undefined,
      exitCode: 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;

    if (isJson) {
      return {
        success: false,
        message: undefined,
        data: { error: errorMessage },
        exitCode: 1,
      };
    }

    output.push(`${ICONS.cross} Setup failed: ${errorMessage}`);
    output.push('');

    return {
      success: false,
      message: output.join('\n'),
      data: undefined,
      exitCode: 1,
    };
  }
}
