/**
 * Init command - Per-project initialization for AutomatosX
 *
 * Creates project-local structure and registers MCP with provider CLIs.
 * Run this in each project directory to set up AutomatosX integration.
 *
 * Separation of concerns:
 * - `ax setup`: Global, one-time system setup (provider detection, global config)
 * - `ax init`: Per-project initialization (project structure, MCP registration)
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  DATA_DIR_NAME,
  CONFIG_FILENAME,
  TIMEOUT_SETUP_ADD,
  TIMEOUT_SETUP_REMOVE,
  DEFAULT_SCHEMA_VERSION,
  ITERATE_MAX_DEFAULT,
  ITERATE_TIMEOUT_DEFAULT,
  type ProviderId,
} from '@defai.digital/contracts';
import { CONTEXT_DIRECTORY } from '@defai.digital/context-domain';
import { createConfigStore } from '@defai.digital/config-domain';
import { PROVIDER_CHECKS, IDE_CHECKS, checkProviderCLI, type CheckResult } from './doctor.js';
import { COLORS, ICONS } from '../utils/terminal.js';

const execAsync = promisify(exec);

// ============================================================================
// Constants
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
  claudeScope: '-s local',
  command: '-c',
  args: '-a',
} as const;

/** Pattern to detect successful MCP server addition in output */
const MCP_SUCCESS_PATTERN = /Added MCP server|server.*added|successfully added/i;

/** Fallback CLI command when binary path cannot be determined */
const CLI_FALLBACK_COMMAND = 'ax';

/** Node.js executable for running scripts */
const NODE_EXECUTABLE = 'node';

/** Conventions file name in context directory */
const CONVENTIONS_FILENAME = 'conventions.md';

/** Default error message when error type is unknown */
const FALLBACK_ERROR_MESSAGE = 'Unknown error';

/** Stderr redirect suffix for shell commands */
const STDERR_REDIRECT = '2>&1';

/** JSON formatting indentation */
const JSON_INDENT = 2;

/** File encoding for config files */
const FILE_ENCODING = 'utf-8' as const;

/** Config file names */
const CONFIG_FILES = {
  settings: 'settings.json',
  opencode: 'opencode.json',
  cursorMcp: 'mcp.json',
  antigravityMcp: 'mcp_config.json',
} as const;

/** Config directory names */
const CONFIG_DIRS = {
  cursor: '.cursor',
  gemini: '.gemini',
  antigravity: 'antigravity',
} as const;

/** OpenCode schema URL */
const OPENCODE_SCHEMA_URL = 'https://opencode.ai/config.json';

/** MCP transport configuration */
const MCP_TRANSPORT = {
  type: 'stdio',
  framing: 'ndjson',
} as const;

/** OpenCode MCP type */
const OPENCODE_MCP_TYPE = 'local' as const;

/** Exit codes for CLI commands */
const EXIT_CODE = {
  SUCCESS: 0,
  FAILURE: 1,
} as const;

/** Health check status values */
const HEALTH_STATUS = {
  PASS: 'pass',
  FAIL: 'fail',
} as const;

/** CLI argument flags */
const CLI_FLAGS = {
  force: ['--force', '-f'],
  silent: ['--silent', '-s'],
  skipMcp: ['--skip-mcp', '--no-mcp'],
} as const;


// ============================================================================
// MCP Configuration for Providers
// ============================================================================

type MCPCommandFormat = 'standard' | 'claude' | 'ax-wrapper' | 'opencode-config' | 'antigravity-config' | 'cursor-config';

interface ProviderMCPConfig {
  cliName: string;
  format: MCPCommandFormat;
}

const PROVIDER_MCP_CONFIGS: Record<ProviderId, ProviderMCPConfig | null> = {
  claude: { cliName: 'claude', format: 'claude' },
  gemini: { cliName: 'gemini', format: 'standard' },
  codex: { cliName: 'codex', format: 'standard' },
  grok: { cliName: 'ax-grok', format: 'ax-wrapper' },
  opencode: { cliName: 'opencode', format: 'opencode-config' },
  antigravity: { cliName: 'antigravity', format: 'antigravity-config' },
  cursor: { cliName: 'cursor', format: 'cursor-config' },
  'ax-cli': null,
};

function getCLIBinaryPath(): string {
  const binaryPath = process.argv[1];
  return binaryPath || CLI_FALLBACK_COMMAND;
}

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith('/') || filePath.includes('\\');
}

/** Return type for CLI command string building */
interface CLICommandParts {
  command: string;
  argsString: string;
}

/** Builds command parts for CLI-based MCP registration (string format) */
function buildMCPServerCommandForCLI(binaryPath: string): CLICommandParts {
  if (isAbsolutePath(binaryPath)) {
    return { command: NODE_EXECUTABLE, argsString: `"${binaryPath}" ${MCP_COMMANDS.serverArgs}` };
  }
  return { command: binaryPath, argsString: MCP_COMMANDS.serverArgs };
}

function buildMCPAddCommand(providerId: ProviderId): string | null {
  const mcpConfig = PROVIDER_MCP_CONFIGS[providerId];
  if (!mcpConfig) return null;

  const binaryPath = getCLIBinaryPath();
  const { command, argsString } = buildMCPServerCommandForCLI(binaryPath);
  const { cliName, format } = mcpConfig;

  switch (format) {
    case 'standard':
      return `${cliName} ${MCP_COMMANDS.add} ${MCP_SERVER_NAME} ${command} ${argsString}`;

    case 'claude':
      return `${cliName} ${MCP_COMMANDS.add} ${MCP_SERVER_NAME} ${MCP_FLAGS.claudeScope} ${command} ${argsString}`;

    case 'ax-wrapper': {
      const wrapperCommand = isAbsolutePath(binaryPath) ? NODE_EXECUTABLE : CLI_FALLBACK_COMMAND;
      const wrapperArgsString = isAbsolutePath(binaryPath) ? `${binaryPath} ${MCP_COMMANDS.serverArgs}` : MCP_COMMANDS.serverArgs;
      return `${cliName} ${MCP_COMMANDS.add} ${MCP_SERVER_NAME} ${MCP_FLAGS.command} ${wrapperCommand} ${MCP_FLAGS.args} ${wrapperArgsString}`;
    }

    default:
      return null;
  }
}

function buildMCPRemoveCommand(providerId: ProviderId): string | null {
  const mcpConfig = PROVIDER_MCP_CONFIGS[providerId];
  if (!mcpConfig) return null;

  const scopeFlag = mcpConfig.format === 'claude' ? ` ${MCP_FLAGS.claudeScope}` : '';
  return `${mcpConfig.cliName} ${MCP_COMMANDS.remove} ${MCP_SERVER_NAME}${scopeFlag}`;
}

interface MCPConfigResult {
  success: boolean;
  skipped: boolean;
  error?: string;
}

// ============================================================================
// MCP Command Building Utilities
// ============================================================================

/** Return type for JSON config-based MCP server command (array format) */
interface MCPServerCommandConfig {
  command: string;
  args: string[];
}

/** Builds command parts for JSON config files (array format) */
function buildMCPServerCommandForConfig(): MCPServerCommandConfig {
  const binaryPath = getCLIBinaryPath();
  if (isAbsolutePath(binaryPath)) {
    return { command: NODE_EXECUTABLE, args: [binaryPath, 'mcp', 'server'] };
  }
  return { command: binaryPath, args: ['mcp', 'server'] };
}

// ============================================================================
// Ax-Wrapper MCP Configuration (Grok)
// ============================================================================

interface AxWrapperMCPConfig {
  mcpServers: Record<string, {
    name: string;
    transport: {
      type: 'stdio';
      command: string;
      args: string[];
      env: Record<string, string>;
      framing: 'ndjson';
    };
  }>;
}

async function configureAxWrapperMCP(cliName: string): Promise<MCPConfigResult> {
  const settingsDir = join(process.cwd(), `.${cliName}`);
  const settingsPath = join(settingsDir, CONFIG_FILES.settings);

  try {
    await mkdir(settingsDir, { recursive: true });

    let existingConfig: AxWrapperMCPConfig = { mcpServers: {} };
    try {
      const content = await readFile(settingsPath, FILE_ENCODING);
      existingConfig = JSON.parse(content) as AxWrapperMCPConfig;
      existingConfig.mcpServers ??= {};
    } catch {
      // File doesn't exist or is invalid
    }

    const { command, args } = buildMCPServerCommandForConfig();
    existingConfig.mcpServers[MCP_SERVER_NAME] = {
      name: MCP_SERVER_NAME,
      transport: {
        type: MCP_TRANSPORT.type,
        command,
        args,
        env: {},
        framing: MCP_TRANSPORT.framing,
      },
    };

    await writeFile(settingsPath, JSON.stringify(existingConfig, null, JSON_INDENT) + '\n');
    return { success: true, skipped: false };
  } catch (err) {
    return {
      success: false,
      skipped: false,
      error: err instanceof Error ? err.message : FALLBACK_ERROR_MESSAGE,
    };
  }
}

// ============================================================================
// OpenCode MCP Configuration
// ============================================================================

interface OpenCodeConfig {
  $schema?: string;
  mcp?: Record<string, { type: 'local'; command: string[]; enabled: boolean }>;
  [key: string]: unknown;
}

async function configureOpenCodeMCP(): Promise<MCPConfigResult> {
  const configPath = join(process.cwd(), CONFIG_FILES.opencode);

  try {
    let existingConfig: OpenCodeConfig = {};
    try {
      const content = await readFile(configPath, FILE_ENCODING);
      existingConfig = JSON.parse(content) as OpenCodeConfig;
    } catch {
      existingConfig = { $schema: OPENCODE_SCHEMA_URL };
    }

    existingConfig.mcp ??= {};
    const { command, args } = buildMCPServerCommandForConfig();
    existingConfig.mcp[MCP_SERVER_NAME] = {
      type: OPENCODE_MCP_TYPE,
      command: [command, ...args],
      enabled: true,
    };

    await writeFile(configPath, JSON.stringify(existingConfig, null, JSON_INDENT) + '\n');
    return { success: true, skipped: false };
  } catch (err) {
    return {
      success: false,
      skipped: false,
      error: err instanceof Error ? err.message : FALLBACK_ERROR_MESSAGE,
    };
  }
}

// ============================================================================
// JSON-based MCP Configuration (Cursor, Antigravity, etc.)
// ============================================================================

/** Standard MCP server config format used by Cursor, Antigravity */
interface StandardMCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface StandardMCPConfig {
  mcpServers: Record<string, StandardMCPServerConfig>;
}

/** Configuration for JSON-based MCP config files */
interface JSONMCPConfigTarget {
  configPath: string;
  configDir: string;
}

const MCP_CONFIG_TARGETS: Record<string, JSONMCPConfigTarget> = {
  cursor: {
    configPath: join(process.cwd(), CONFIG_DIRS.cursor, CONFIG_FILES.cursorMcp),
    configDir: join(process.cwd(), CONFIG_DIRS.cursor),
  },
  antigravity: {
    configPath: join(homedir(), CONFIG_DIRS.gemini, CONFIG_DIRS.antigravity, CONFIG_FILES.antigravityMcp),
    configDir: join(homedir(), CONFIG_DIRS.gemini, CONFIG_DIRS.antigravity),
  },
};

/**
 * Configures MCP for apps using standard mcpServers JSON format (Cursor, Antigravity)
 */
async function configureStandardMCP(targetId: string): Promise<MCPConfigResult> {
  const target = MCP_CONFIG_TARGETS[targetId];
  if (!target) {
    return { success: true, skipped: true };
  }

  try {
    // Create config directory if needed
    await mkdir(target.configDir, { recursive: true });

    // Load existing config or create new
    let existingConfig: StandardMCPConfig = { mcpServers: {} };
    try {
      const content = await readFile(target.configPath, FILE_ENCODING);
      existingConfig = JSON.parse(content) as StandardMCPConfig;
      existingConfig.mcpServers ??= {};
    } catch {
      // File doesn't exist or is invalid - start fresh
    }

    // Build command and args using shared helper
    const { command, args } = buildMCPServerCommandForConfig();
    existingConfig.mcpServers[MCP_SERVER_NAME] = { command, args };

    await writeFile(target.configPath, JSON.stringify(existingConfig, null, JSON_INDENT) + '\n');

    return { success: true, skipped: false };
  } catch (err) {
    return {
      success: false,
      skipped: false,
      error: err instanceof Error ? err.message : FALLBACK_ERROR_MESSAGE,
    };
  }
}

// ============================================================================
// CLI-Based MCP Helpers
// ============================================================================

function isMCPAdditionSuccessful(commandOutput: string): boolean {
  return MCP_SUCCESS_PATTERN.test(commandOutput);
}

function extractErrorMessage(rawError: string): string {
  if (rawError.includes('Command failed')) {
    return rawError.split('\n').pop() || rawError;
  }
  return rawError;
}

async function configureMCPForProvider(providerId: ProviderId): Promise<MCPConfigResult> {
  const mcpConfig = PROVIDER_MCP_CONFIGS[providerId];
  if (!mcpConfig) {
    return { success: true, skipped: true };
  }

  // Handle JSON config file formats
  switch (mcpConfig.format) {
    case 'ax-wrapper':
      return configureAxWrapperMCP(mcpConfig.cliName);
    case 'opencode-config':
      return configureOpenCodeMCP();
    case 'antigravity-config':
    case 'cursor-config':
      return configureStandardMCP(providerId);
  }

  // Handle CLI-based MCP registration (standard, claude formats)
  const addCommand = buildMCPAddCommand(providerId);
  const removeCommand = buildMCPRemoveCommand(providerId);

  if (!addCommand) {
    return { success: true, skipped: true };
  }

  try {
    if (removeCommand) {
      try {
        await execAsync(`${removeCommand} ${STDERR_REDIRECT}`, { timeout: TIMEOUT_SETUP_REMOVE });
      } catch {
        // Server might not exist
      }
    }

    const { stdout, stderr } = await execAsync(`${addCommand} ${STDERR_REDIRECT}`, { timeout: TIMEOUT_SETUP_ADD });
    const commandOutput = `${stdout}${stderr}`;

    if (isMCPAdditionSuccessful(commandOutput)) {
      return { success: true, skipped: false };
    }

    return { success: true, skipped: false };
  } catch (err) {
    const execResult = err as { message?: string; stdout?: string; stderr?: string };
    const errorMsg = execResult.message || FALLBACK_ERROR_MESSAGE;
    const fullOutput = `${execResult.stdout || ''}${execResult.stderr || ''}${errorMsg}`;

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

async function getInstalledProviderCLIs(): Promise<Map<string, CheckResult>> {
  // Combine provider CLIs and IDE integrations
  const allChecks = [...PROVIDER_CHECKS, ...IDE_CHECKS];

  // Run all checks in parallel for better performance
  const checkResults = await Promise.all(
    allChecks.map(async (provider) => {
      const checkResult = await checkProviderCLI(provider);
      return { id: provider.id, checkResult };
    })
  );

  // Convert results to Map
  const results = new Map<string, CheckResult>();
  for (const { id, checkResult } of checkResults) {
    results.set(id, checkResult);
  }

  return results;
}

interface MCPBatchConfigResult {
  configured: string[];
  skipped: string[];
  notInstalled: string[];
  failed: Array<{ providerId: string; error: string }>;
}

async function configureMCPForAllProviders(): Promise<MCPBatchConfigResult> {
  const result: MCPBatchConfigResult = {
    configured: [],
    skipped: [],
    notInstalled: [],
    failed: [],
  };

  const installedProviders = await getInstalledProviderCLIs();

  // Separate installed from not-installed providers
  const toConfig: string[] = [];

  for (const [providerId, healthCheck] of installedProviders) {
    if (healthCheck.status === HEALTH_STATUS.FAIL) {
      result.notInstalled.push(providerId);
    } else {
      toConfig.push(providerId);
    }
  }

  // Use Promise.allSettled for fault tolerance - reports partial successes
  const configResults = await Promise.allSettled(
    toConfig.map(async (providerId) => {
      const configResult = await configureMCPForProvider(providerId as ProviderId);
      return { providerId, configResult };
    })
  );

  // Process results
  for (const settledResult of configResults) {
    if (settledResult.status === 'rejected') {
      // Handle unexpected errors (not from configureMCPForProvider)
      result.failed.push({
        providerId: 'unknown',
        error: settledResult.reason?.message || FALLBACK_ERROR_MESSAGE,
      });
      continue;
    }

    const { providerId, configResult } = settledResult.value;
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
// Project Structure Creation
// ============================================================================

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

const PROJECT_CONFIG_TEMPLATE = {
  version: DEFAULT_SCHEMA_VERSION,
  iterate: {
    maxIterations: ITERATE_MAX_DEFAULT,
    maxTimeMs: ITERATE_TIMEOUT_DEFAULT,
    autoConfirm: false,
  },
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

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

  // Create directories in parallel (both have recursive: true, so order doesn't matter)
  await Promise.all([
    mkdir(automatosxDir, { recursive: true }).catch(() => { /* Directory may already exist */ }),
    mkdir(contextDir, { recursive: true }).catch(() => { /* Directory may already exist */ }),
  ]);

  // Check file existence in parallel
  const [configExists, conventionsExists] = await Promise.all([
    fileExists(configPath),
    fileExists(conventionsPath),
  ]);

  // Prepare write operations based on existence checks
  const writeOperations: Promise<void>[] = [];

  if (!configExists || force) {
    writeOperations.push(
      writeFile(configPath, JSON.stringify(PROJECT_CONFIG_TEMPLATE, null, JSON_INDENT) + '\n')
    );
    created.push(`${DATA_DIR_NAME}/${CONFIG_FILENAME}`);
  } else {
    skipped.push(`${DATA_DIR_NAME}/${CONFIG_FILENAME} (already exists)`);
  }

  if (!conventionsExists || force) {
    writeOperations.push(writeFile(conventionsPath, CONVENTIONS_TEMPLATE));
    created.push(`${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME}`);
  } else {
    skipped.push(`${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME} (already exists)`);
  }

  // Execute writes in parallel
  if (writeOperations.length > 0) {
    await Promise.all(writeOperations);
  }

  return { created, skipped };
}

// ============================================================================
// Init Command Handler
// ============================================================================

interface InitOptions {
  force: boolean;
  silent: boolean;
  skipMcp: boolean;
}

function matchesFlag(arg: string, flags: readonly string[]): boolean {
  return flags.includes(arg);
}

function parseInitArgs(args: string[]): InitOptions {
  let force = false;
  let silent = false;
  let skipMcp = false;

  for (const arg of args) {
    if (matchesFlag(arg, CLI_FLAGS.force)) {
      force = true;
    } else if (matchesFlag(arg, CLI_FLAGS.silent)) {
      silent = true;
    } else if (matchesFlag(arg, CLI_FLAGS.skipMcp)) {
      skipMcp = true;
    }
  }

  return { force, silent, skipMcp };
}

/**
 * Init command handler
 *
 * Initializes AutomatosX for the current project:
 * 1. Creates .automatosx/ project structure
 * 2. Registers MCP with all detected provider CLIs
 *
 * Usage:
 *   ax init                  Initialize current project
 *   ax init --force          Overwrite existing files
 *   ax init --skip-mcp       Skip MCP registration
 *   ax init --silent         Minimal output
 */
export async function initCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const initOptions = parseInitArgs(args);
  const isJsonFormat = options.format === 'json';
  const isSilent = initOptions.silent;
  const showOutput = !isJsonFormat && !isSilent;
  const outputLines: string[] = [];

  try {
    const projectDir = process.cwd();
    const automatosxDir = join(projectDir, DATA_DIR_NAME);

    // Run independent checks in parallel for faster startup
    const configStore = createConfigStore();
    const [globalConfigExists, projectAlreadyInitialized] = await Promise.all([
      configStore.exists('global'),
      fileExists(join(automatosxDir, CONFIG_FILENAME)),
    ]);

    if (showOutput) {
      outputLines.push('');
      outputLines.push(`${COLORS.bold}AutomatosX Project Init${COLORS.reset}`);
      outputLines.push(`${COLORS.dim}Initializing project: ${projectDir}${COLORS.reset}`);
      outputLines.push('');

      if (!globalConfigExists) {
        outputLines.push(`${ICONS.warn} Global config not found. Consider running ${COLORS.cyan}ax setup${COLORS.reset} first.`);
        outputLines.push('');
      }
    }

    // Step 1: Create project structure
    if (showOutput) {
      if (projectAlreadyInitialized && !initOptions.force) {
        outputLines.push(`${COLORS.bold}Step 1: Project Structure${COLORS.reset} ${COLORS.dim}(already initialized)${COLORS.reset}`);
      } else {
        outputLines.push(`${COLORS.bold}Step 1: Project Structure${COLORS.reset}`);
      }
    }

    const projectStructure = await createProjectStructure(projectDir, initOptions.force);

    if (showOutput) {
      if (projectStructure.created.length > 0) {
        for (const filePath of projectStructure.created) {
          outputLines.push(`  ${ICONS.check} Created ${filePath}`);
        }
      }
      if (projectStructure.skipped.length > 0) {
        for (const filePath of projectStructure.skipped) {
          outputLines.push(`  ${ICONS.check} Verified ${filePath.replace(' (already exists)', '')}`);
        }
      }
      outputLines.push('');
    }

    // Step 2: Configure MCP for all detected providers
    let mcpResult: MCPBatchConfigResult | undefined;

    if (!initOptions.skipMcp) {
      if (showOutput) {
        outputLines.push(`${COLORS.bold}Step 2: MCP Registration${COLORS.reset}`);
        outputLines.push(`  ${COLORS.dim}Registering AutomatosX MCP server with provider CLIs...${COLORS.reset}`);
      }

      mcpResult = await configureMCPForAllProviders();

      if (showOutput) {
        for (const providerId of mcpResult.configured) {
          outputLines.push(`  ${ICONS.check} ${providerId}: MCP registered`);
        }
        for (const providerId of mcpResult.notInstalled) {
          outputLines.push(`  ${COLORS.dim}  - ${providerId}: CLI not installed${COLORS.reset}`);
        }
        for (const { providerId, error } of mcpResult.failed) {
          outputLines.push(`  ${ICONS.warn} ${providerId}: ${error}`);
        }
        if (mcpResult.configured.length === 0 && mcpResult.failed.length === 0) {
          outputLines.push(`  ${ICONS.warn} No provider CLIs detected. Run 'ax doctor' to check.`);
        }
        outputLines.push('');
      }
    } else if (showOutput) {
      outputLines.push(`${COLORS.bold}Step 2: MCP Registration${COLORS.reset}`);
      outputLines.push(`  ${COLORS.dim}Skipped (--skip-mcp)${COLORS.reset}`);
      outputLines.push('');
    }

    // Summary
    if (showOutput) {
      outputLines.push(`${COLORS.bold}Done!${COLORS.reset}`);
      outputLines.push(`  Project files: ${projectStructure.created.length} created, ${projectStructure.skipped.length} skipped`);
      if (mcpResult) {
        outputLines.push(`  MCP registered: ${mcpResult.configured.length} provider(s)`);
      }
      outputLines.push('');
      outputLines.push(`${COLORS.bold}Next Steps${COLORS.reset}`);
      outputLines.push(`  1. Edit ${COLORS.cyan}${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME}${COLORS.reset} to add your project conventions`);
      outputLines.push(`  2. Run ${COLORS.cyan}ax doctor${COLORS.reset} to verify providers`);
      outputLines.push(`  3. Use ${COLORS.cyan}ax call claude "your task"${COLORS.reset} to start`);
      outputLines.push('');
    }

    if (isJsonFormat) {
      return {
        success: true,
        message: undefined,
        data: {
          success: true,
          projectDir,
          globalConfigExists,
          alreadyInitialized: projectAlreadyInitialized,
          projectStructure: {
            created: projectStructure.created,
            skipped: projectStructure.skipped,
          },
          mcpConfiguration: mcpResult
            ? {
                configured: mcpResult.configured,
                skipped: mcpResult.skipped,
                notInstalled: mcpResult.notInstalled,
                failed: mcpResult.failed,
              }
            : undefined,
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

    outputLines.push(`${ICONS.cross} Init failed: ${errorMsg}`);
    outputLines.push('');

    return {
      success: false,
      message: outputLines.join('\n'),
      data: undefined,
      exitCode: EXIT_CODE.FAILURE,
    };
  }
}
