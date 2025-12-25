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

// ============================================================================
// MCP Constants
// ============================================================================

/** MCP server name registered with provider CLIs */
const MCP_SERVER_NAME = 'automatosx';

/** MCP subcommands */
const MCP_COMMANDS = {
  add: 'mcp add',
  remove: 'mcp remove',
  serverArgs: 'mcp server',
} as const;

/** MCP command flags for different formats */
const MCP_FLAGS = {
  /** Claude uses -s local for user-scope config */
  claudeScope: '-s local',
  /** ax-wrapper uses -c for command */
  command: '-c',
  /** ax-wrapper uses -a for arguments */
  args: '-a',
} as const;

/** Pattern to detect successful MCP server addition in output */
const MCP_SUCCESS_PATTERN = /Added MCP server|server.*added|successfully added/i;

// ============================================================================
// CLI Constants
// ============================================================================

/** Fallback CLI command when binary path cannot be determined */
const CLI_FALLBACK_COMMAND = 'ax';

/** Node.js executable for running scripts */
const NODE_EXECUTABLE = 'node';

/** Conventions file name in context directory */
const CONVENTIONS_FILENAME = 'conventions.md';

/** Provider name display width for aligned output */
const PROVIDER_DISPLAY_WIDTH = 10;

/** Default error message when error type is unknown */
const FALLBACK_ERROR_MESSAGE = 'Unknown error';

/** Stderr redirect suffix for shell commands */
const STDERR_REDIRECT = '2>&1';

/** Regex pattern to extract semver version from CLI output */
const SEMVER_PATTERN = /(\d+\.\d+\.\d+)/;

/** Platform-specific command to find executables */
const WHICH_COMMAND = process.platform === 'win32' ? 'where' : 'which';

/** JSON formatting indentation */
const JSON_INDENT = 2;

/** Exit codes for CLI commands */
const EXIT_CODE = {
  SUCCESS: 0,
  FAILURE: 1,
} as const;

/** Config scope values */
const CONFIG_SCOPE = {
  GLOBAL: 'global',
  LOCAL: 'local',
} as const;

type ConfigScope = typeof CONFIG_SCOPE[keyof typeof CONFIG_SCOPE];

/** Health check status values */
const HEALTH_STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
} as const;

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

/** MCP configuration for each provider (null = provider doesn't support MCP) */
const PROVIDER_MCP_CONFIGS: Record<ProviderId, ProviderMCPConfig | null> = {
  claude: { cliName: 'claude', format: 'claude' },
  gemini: { cliName: 'gemini', format: 'standard' },
  codex: { cliName: 'codex', format: 'standard' },
  qwen: { cliName: 'qwen', format: 'standard' },
  glm: { cliName: 'ax-glm', format: 'ax-wrapper' },
  grok: { cliName: 'ax-grok', format: 'ax-wrapper' },
  'ax-cli': null, // ax-cli doesn't support MCP yet
};

/**
 * Get the absolute path to the CLI binary.
 * Uses process.argv[1] which works for both global and local installations.
 */
function getCLIBinaryPath(): string {
  const binaryPath = process.argv[1];
  return binaryPath || CLI_FALLBACK_COMMAND;
}

/**
 * Check if a path is absolute (Unix or Windows style)
 */
function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith('/') || filePath.includes('\\');
}

/**
 * Build the MCP server command parts based on binary path.
 * Returns { executable, arguments } for use in MCP add commands.
 */
function buildMCPServerCommand(binaryPath: string): { executable: string; arguments: string } {
  if (isAbsolutePath(binaryPath)) {
    return { executable: NODE_EXECUTABLE, arguments: `"${binaryPath}" ${MCP_COMMANDS.serverArgs}` };
  }
  return { executable: binaryPath, arguments: MCP_COMMANDS.serverArgs };
}

/**
 * Get the CLI command to add AutomatosX MCP server for a provider.
 * Uses provider's native CLI to ensure proper formatting and validation.
 */
function buildMCPAddCommand(providerId: ProviderId): string | null {
  const mcpConfig = PROVIDER_MCP_CONFIGS[providerId];
  if (!mcpConfig) return null;

  const binaryPath = getCLIBinaryPath();
  const { executable, arguments: execArgs } = buildMCPServerCommand(binaryPath);
  const { cliName, format } = mcpConfig;

  switch (format) {
    case 'standard':
      return `${cliName} ${MCP_COMMANDS.add} ${MCP_SERVER_NAME} ${executable} ${execArgs}`;

    case 'claude':
      return `${cliName} ${MCP_COMMANDS.add} ${MCP_SERVER_NAME} ${MCP_FLAGS.claudeScope} ${executable} ${execArgs}`;

    case 'ax-wrapper': {
      const command = isAbsolutePath(binaryPath) ? NODE_EXECUTABLE : CLI_FALLBACK_COMMAND;
      const commandArgs = isAbsolutePath(binaryPath) ? `"${binaryPath}" ${MCP_COMMANDS.serverArgs}` : MCP_COMMANDS.serverArgs;
      return `${cliName} ${MCP_COMMANDS.add} ${MCP_SERVER_NAME} ${MCP_FLAGS.command} ${command} ${MCP_FLAGS.args} ${commandArgs}`;
    }

    default:
      return null;
  }
}

/**
 * Get the CLI command to remove MCP server for a provider.
 */
function buildMCPRemoveCommand(providerId: ProviderId): string | null {
  const mcpConfig = PROVIDER_MCP_CONFIGS[providerId];
  if (!mcpConfig) return null;

  const scopeFlag = mcpConfig.format === 'claude' ? ` ${MCP_FLAGS.claudeScope}` : '';
  return `${mcpConfig.cliName} ${MCP_COMMANDS.remove} ${MCP_SERVER_NAME}${scopeFlag}`;
}

/** Result of MCP configuration for a provider */
interface MCPConfigResult {
  success: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Check if command output indicates successful MCP server addition.
 * Some providers output success message even when validation times out.
 */
function isMCPAdditionSuccessful(commandOutput: string): boolean {
  return MCP_SUCCESS_PATTERN.test(commandOutput);
}

/**
 * Extract clean error message from exec error.
 */
function extractErrorMessage(rawError: string): string {
  if (rawError.includes('Command failed')) {
    return rawError.split('\n').pop() || rawError;
  }
  return rawError;
}

/**
 * Configure MCP for a detected provider using CLI commands.
 *
 * Strategy (always remove-then-add for clean state):
 * 1. Remove any existing automatosx MCP config (ignore errors if not exists)
 * 2. Add automatosx MCP server using provider's native CLI
 *
 * Note: Some providers (ax-glm, ax-grok) validate connection after adding,
 * which may timeout. We detect success by checking output for "Added MCP server".
 */
async function configureMCPForProvider(providerId: ProviderId): Promise<MCPConfigResult> {
  const addCommand = buildMCPAddCommand(providerId);
  const removeCommand = buildMCPRemoveCommand(providerId);

  if (!addCommand) {
    return { success: true, skipped: true };
  }

  try {
    // Step 1: Remove existing config for clean state (ignore if not exists)
    if (removeCommand) {
      try {
        await execAsync(`${removeCommand} ${STDERR_REDIRECT}`, { timeout: TIMEOUT_SETUP_REMOVE });
      } catch {
        // Server might not exist - that's expected
      }
    }

    // Step 2: Add MCP server using provider's native CLI
    const { stdout, stderr } = await execAsync(`${addCommand} ${STDERR_REDIRECT}`, { timeout: TIMEOUT_SETUP_ADD });
    const commandOutput = `${stdout}${stderr}`;

    if (isMCPAdditionSuccessful(commandOutput)) {
      return { success: true, skipped: false };
    }

    return { success: true, skipped: false };
  } catch (err) {
    // Node's exec error includes stdout/stderr as properties
    const execResult = err as { message?: string; stdout?: string; stderr?: string };
    const errorMsg = execResult.message || FALLBACK_ERROR_MESSAGE;
    const fullOutput = `${execResult.stdout || ''}${execResult.stderr || ''}${errorMsg}`;

    // Check if server was added despite command failure (validation timeout)
    if (isMCPAdditionSuccessful(fullOutput)) {
      return { success: true, skipped: false };
    }

    return {
      success: false,
      skipped: false,
      error: extractErrorMessage(errorMsg),
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

/** Result of configuring MCP for all providers */
interface MCPBatchConfigResult {
  configured: string[];
  skipped: string[];
  notInstalled: string[];
  failed: Array<{ providerId: string; error: string }>;
}

/**
 * Configure MCP for all detected providers using their native CLI commands.
 *
 * Uses 'ax doctor' check logic to determine which CLIs are installed.
 * Only configures MCP for providers that pass the doctor check.
 */
async function configureMCPForAllProviders(): Promise<MCPBatchConfigResult> {
  const result: MCPBatchConfigResult = {
    configured: [],
    skipped: [],
    notInstalled: [],
    failed: [],
  };

  const installedProviders = await getInstalledProviderCLIs();

  for (const [providerId, healthCheck] of installedProviders) {
    if (healthCheck.status === HEALTH_STATUS.FAIL) {
      result.notInstalled.push(providerId);
      continue;
    }

    const configResult = await configureMCPForProvider(providerId as ProviderId);

    if (configResult.skipped) {
      result.skipped.push(providerId);
    } else if (configResult.success) {
      result.configured.push(providerId);
    } else {
      result.failed.push({
        providerId,
        error: configResult.error || FALLBACK_ERROR_MESSAGE,
      });
    }
  }

  return result;
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
    const versionMatch = SEMVER_PATTERN.exec(stdout);
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
  const providerDefaults = PROVIDER_DEFAULTS[providerId];
  const isDetected = await isCommandAvailable(providerDefaults.command);

  if (!isDetected) {
    return {
      providerId,
      detected: false,
      command: providerDefaults.command,
    };
  }

  const version = await getCommandVersion(providerDefaults.command);

  return {
    providerId,
    detected: true,
    command: providerDefaults.command,
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
    await writeFile(configPath, JSON.stringify(PROJECT_CONFIG_TEMPLATE, null, JSON_INDENT) + '\n');
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
  scope: ConfigScope;
  skipProjectStructure: boolean;
}

/** Result of the setup process */
interface SetupResult {
  success: boolean;
  config: AutomatosXConfig;
  providers: ProviderDetectionResult[];
  configPath: string;
}

/**
 * Runs the setup process
 */
async function runSetup(options: SetupOptions): Promise<SetupResult> {
  const configStore = createConfigStore();
  const configFilePath = configStore.getPath(options.scope);

  // Check if config already exists
  const configExists = await configStore.exists(options.scope);
  if (configExists && !options.force) {
    throw new Error(
      `Configuration already exists at ${configFilePath}. Use --force to overwrite.`
    );
  }

  // Initialize directory
  await initConfigDirectory(options.scope);

  // Detect providers
  const allProviders = await detectAllProviders();
  const availableProviders = allProviders.filter((provider) => provider.detected);

  // Build providers config record
  const providersConfig: Record<string, { enabled: boolean; priority: number; timeout: number; command?: string }> = {};
  for (const provider of availableProviders) {
    const providerDefaults = PROVIDER_DEFAULTS[provider.providerId];
    providersConfig[provider.providerId] = {
      enabled: true,
      priority: providerDefaults.priority,
      timeout: TIMEOUT_WORKFLOW_STEP,
      command: providerDefaults.command,
    };
  }

  // Sort provider IDs by priority to find default (highest first)
  const providersByPriority = Object.keys(providersConfig).sort(
    (a, b) => (providersConfig[b]?.priority ?? 0) - (providersConfig[a]?.priority ?? 0)
  );

  const config: AutomatosXConfig = {
    ...DEFAULT_CONFIG,
    providers: providersConfig,
    defaultProvider: providersByPriority[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save config
  await configStore.write(config, options.scope);

  return {
    success: true,
    config,
    providers: allProviders,
    configPath: configFilePath,
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
  let scope: ConfigScope = CONFIG_SCOPE.GLOBAL;
  let skipProjectStructure = false;

  for (const arg of args) {
    if (matchesFlag(arg, CLI_FLAGS.force)) {
      force = true;
    } else if (matchesFlag(arg, CLI_FLAGS.nonInteractive)) {
      nonInteractive = true;
    } else if (matchesFlag(arg, CLI_FLAGS.local)) {
      scope = CONFIG_SCOPE.LOCAL;
    } else if (matchesFlag(arg, CLI_FLAGS.global)) {
      scope = CONFIG_SCOPE.GLOBAL;
    } else if (matchesFlag(arg, CLI_FLAGS.skipProject)) {
      skipProjectStructure = true;
    }
  }

  return { force, nonInteractive, scope, skipProjectStructure };
}

/**
 * Formats provider detection result for display.
 */
function formatProviderResult(detection: ProviderDetectionResult): string {
  const statusText = detection.detected
    ? `${ICONS.check} Detected${detection.version ? ` (v${detection.version})` : ''}`
    : `${ICONS.cross} Not detected`;

  return `  ${detection.providerId.padEnd(PROVIDER_DISPLAY_WIDTH)} ${statusText}`;
}

/**
 * Setup command handler
 */
export async function setupCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const setupOptions = parseSetupArgs(args);
  const isJsonFormat = options.format === 'json';
  const outputLines: string[] = [];

  try {
    // Header
    if (!isJsonFormat) {
      outputLines.push('');
      outputLines.push(`${COLORS.bold}AutomatosX Setup${COLORS.reset}`);
      outputLines.push('');
    }

    // Step 1: Check prerequisites
    if (!isJsonFormat) {
      outputLines.push(`${COLORS.bold}Step 1: System Check${COLORS.reset}`);
      outputLines.push(`  ${ICONS.check} Node.js: ${process.version}`);
      outputLines.push('');
    }

    // Step 2: Detect providers
    if (!isJsonFormat) {
      outputLines.push(`${COLORS.bold}Step 2: Provider Detection${COLORS.reset}`);
    }

    const detectedProviders = await detectAllProviders();

    if (!isJsonFormat) {
      for (const provider of detectedProviders) {
        outputLines.push(formatProviderResult(provider));
      }
      outputLines.push('');
    }

    // Step 3: Create configuration
    if (!isJsonFormat) {
      outputLines.push(`${COLORS.bold}Step 3: Creating Configuration${COLORS.reset}`);
    }

    const setupResult = await runSetup(setupOptions);

    if (!isJsonFormat) {
      outputLines.push(`  ${ICONS.check} Configuration saved to: ${setupResult.configPath}`);
      outputLines.push('');
    }

    // Step 4: Create project structure (unless skipped)
    let projectStructure: { created: string[]; skipped: string[] } | undefined;

    if (!setupOptions.skipProjectStructure) {
      if (!isJsonFormat) {
        outputLines.push(`${COLORS.bold}Step 4: Project Structure${COLORS.reset}`);
      }

      projectStructure = await createProjectStructure(process.cwd(), setupOptions.force);

      if (!isJsonFormat) {
        for (const filePath of projectStructure.created) {
          outputLines.push(`  ${ICONS.check} Created ${filePath}`);
        }
        for (const filePath of projectStructure.skipped) {
          outputLines.push(`  ${ICONS.warn} Skipped ${filePath}`);
        }
        outputLines.push('');
      }
    }

    // Step 5: Configure MCP for all detected providers
    if (!isJsonFormat) {
      outputLines.push(`${COLORS.bold}Step 5: MCP Configuration${COLORS.reset}`);
      outputLines.push(`  ${COLORS.dim}Using 'ax doctor' check to verify installed CLIs...${COLORS.reset}`);
    }

    const mcpResult = await configureMCPForAllProviders();

    if (!isJsonFormat) {
      for (const providerId of mcpResult.configured) {
        outputLines.push(`  ${ICONS.check} ${providerId}: AutomatosX MCP configured`);
      }
      for (const providerId of mcpResult.notInstalled) {
        outputLines.push(`  ${COLORS.dim}  - ${providerId}: CLI not installed, skipped${COLORS.reset}`);
      }
      for (const { providerId, error } of mcpResult.failed) {
        outputLines.push(`  ${ICONS.warn} ${providerId}: ${error}`);
      }
      if (mcpResult.configured.length === 0 && mcpResult.failed.length === 0 && mcpResult.notInstalled.length === 0) {
        outputLines.push(`  ${ICONS.warn} No providers detected for MCP configuration`);
      }
      outputLines.push('');
    }

    if (!isJsonFormat) {
      // Summary
      const detectedCount = detectedProviders.filter((provider) => provider.detected).length;
      const enabledCount = Object.keys(setupResult.config.providers).length;

      outputLines.push(`${COLORS.bold}Summary${COLORS.reset}`);
      outputLines.push(`  Providers detected: ${detectedCount}/${KNOWN_PROVIDERS.length}`);
      outputLines.push(`  Providers enabled: ${enabledCount}`);

      if (setupResult.config.defaultProvider !== undefined) {
        outputLines.push(`  Default provider: ${setupResult.config.defaultProvider}`);
      }

      if (projectStructure !== undefined) {
        outputLines.push(`  Project files created: ${projectStructure.created.length}`);
      }

      outputLines.push(`  MCP configured: ${mcpResult.configured.length} provider(s)`);

      outputLines.push('');
      outputLines.push(`${COLORS.bold}Next Steps${COLORS.reset}`);
      outputLines.push(`  1. Run ${COLORS.cyan}ax doctor${COLORS.reset} to verify installation`);
      outputLines.push(`  2. Edit ${COLORS.cyan}${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME}${COLORS.reset} to add your project conventions`);
      outputLines.push(`  3. Run ${COLORS.cyan}ax call --iterate <provider> "task"${COLORS.reset} to use iterate mode`);
      outputLines.push('');
    }

    if (isJsonFormat) {
      return {
        success: true,
        message: undefined,
        data: {
          success: true,
          configPath: setupResult.configPath,
          providers: {
            detected: detectedProviders.filter((provider) => provider.detected).map((provider) => provider.providerId),
            enabled: Object.keys(setupResult.config.providers).filter(id => setupResult.config.providers[id]?.enabled),
          },
          defaultProvider: setupResult.config.defaultProvider,
          version: setupResult.config.version,
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
        exitCode: EXIT_CODE.SUCCESS,
      };
    }

    return {
      success: true,
      message: outputLines.join('\n'),
      data: undefined,
      exitCode: EXIT_CODE.SUCCESS,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : FALLBACK_ERROR_MESSAGE;

    if (isJsonFormat) {
      return {
        success: false,
        message: undefined,
        data: { error: errorMsg },
        exitCode: EXIT_CODE.FAILURE,
      };
    }

    outputLines.push(`${ICONS.cross} Setup failed: ${errorMsg}`);
    outputLines.push('');

    return {
      success: false,
      message: outputLines.join('\n'),
      data: undefined,
      exitCode: EXIT_CODE.FAILURE,
    };
  }
}
