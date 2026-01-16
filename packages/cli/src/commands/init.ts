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
import { PROVIDER_CHECKS, checkProviderCLI, type CheckResult } from './doctor.js';

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

type MCPCommandFormat = 'standard' | 'claude' | 'ax-wrapper' | 'opencode-config';

interface ProviderMCPConfig {
  cliName: string;
  format: MCPCommandFormat;
}

const PROVIDER_MCP_CONFIGS: Record<ProviderId, ProviderMCPConfig | null> = {
  claude: { cliName: 'claude', format: 'claude' },
  gemini: { cliName: 'gemini', format: 'standard' },
  codex: { cliName: 'codex', format: 'standard' },
  grok: { cliName: 'ax-grok', format: 'ax-wrapper' },
  antigravity: { cliName: 'antigravity', format: 'standard' },
  opencode: { cliName: 'opencode', format: 'opencode-config' },
  'ax-cli': null,
};

function getCLIBinaryPath(): string {
  const binaryPath = process.argv[1];
  return binaryPath || CLI_FALLBACK_COMMAND;
}

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith('/') || filePath.includes('\\');
}

function buildMCPServerCommand(binaryPath: string): { executable: string; arguments: string } {
  if (isAbsolutePath(binaryPath)) {
    return { executable: NODE_EXECUTABLE, arguments: `"${binaryPath}" ${MCP_COMMANDS.serverArgs}` };
  }
  return { executable: binaryPath, arguments: MCP_COMMANDS.serverArgs };
}

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
      const commandArgs = isAbsolutePath(binaryPath) ? `${binaryPath} ${MCP_COMMANDS.serverArgs}` : MCP_COMMANDS.serverArgs;
      return `${cliName} ${MCP_COMMANDS.add} ${MCP_SERVER_NAME} ${MCP_FLAGS.command} ${command} ${MCP_FLAGS.args} ${commandArgs}`;
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

interface AxWrapperMCPConfig {
  mcpServers: {
    [name: string]: {
      name: string;
      transport: {
        type: 'stdio';
        command: string;
        args: string[];
        env: Record<string, string>;
        framing: 'ndjson';
      };
    };
  };
}

function getAxWrapperSettingsPath(cliName: string): string {
  return join(process.cwd(), `.${cliName}`, 'settings.json');
}

async function configureAxWrapperMCP(cliName: string): Promise<MCPConfigResult> {
  const binaryPath = getCLIBinaryPath();
  const settingsPath = getAxWrapperSettingsPath(cliName);
  const settingsDir = join(process.cwd(), `.${cliName}`);

  try {
    await mkdir(settingsDir, { recursive: true });

    let existingConfig: AxWrapperMCPConfig = { mcpServers: {} };
    try {
      const content = await readFile(settingsPath, 'utf-8');
      existingConfig = JSON.parse(content) as AxWrapperMCPConfig;
      if (!existingConfig.mcpServers) {
        existingConfig.mcpServers = {};
      }
    } catch {
      // File doesn't exist or is invalid
    }

    const args = isAbsolutePath(binaryPath)
      ? [binaryPath, 'mcp', 'server']
      : ['mcp', 'server'];

    const command = isAbsolutePath(binaryPath) ? NODE_EXECUTABLE : binaryPath;

    existingConfig.mcpServers[MCP_SERVER_NAME] = {
      name: MCP_SERVER_NAME,
      transport: {
        type: 'stdio',
        command,
        args,
        env: {},
        framing: 'ndjson',
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

/** OpenCode config file name */
const OPENCODE_CONFIG_FILENAME = 'opencode.json';

interface OpenCodeMCPServerConfig {
  type: 'local';
  command: string[];
  enabled: boolean;
  environment?: Record<string, string>;
}

interface OpenCodeConfig {
  $schema?: string;
  mcp?: Record<string, OpenCodeMCPServerConfig>;
  [key: string]: unknown;
}

function getOpenCodeConfigPath(): string {
  return join(process.cwd(), OPENCODE_CONFIG_FILENAME);
}

async function configureOpenCodeMCP(): Promise<MCPConfigResult> {
  const binaryPath = getCLIBinaryPath();
  const configPath = getOpenCodeConfigPath();

  try {
    let existingConfig: OpenCodeConfig = {};
    try {
      const content = await readFile(configPath, 'utf-8');
      existingConfig = JSON.parse(content) as OpenCodeConfig;
    } catch {
      // File doesn't exist or is invalid - start fresh
      existingConfig = {
        $schema: 'https://opencode.ai/config.json',
      };
    }

    if (!existingConfig.mcp) {
      existingConfig.mcp = {};
    }

    // Build command array for opencode
    const command = isAbsolutePath(binaryPath)
      ? [NODE_EXECUTABLE, binaryPath, 'mcp', 'server']
      : [binaryPath, 'mcp', 'server'];

    existingConfig.mcp[MCP_SERVER_NAME] = {
      type: 'local',
      command,
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

  if (mcpConfig.format === 'ax-wrapper') {
    return configureAxWrapperMCP(mcpConfig.cliName);
  }

  if (mcpConfig.format === 'opencode-config') {
    return configureOpenCodeMCP();
  }

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
  const results = new Map<string, CheckResult>();

  for (const provider of PROVIDER_CHECKS) {
    const checkResult = await checkProviderCLI(provider);
    results.set(provider.id, checkResult);
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

  try {
    await mkdir(automatosxDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  try {
    await mkdir(contextDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  const configExists = await fileExists(configPath);
  if (!configExists || force) {
    await writeFile(configPath, JSON.stringify(PROJECT_CONFIG_TEMPLATE, null, JSON_INDENT) + '\n');
    created.push(`${DATA_DIR_NAME}/${CONFIG_FILENAME}`);
  } else {
    skipped.push(`${DATA_DIR_NAME}/${CONFIG_FILENAME} (already exists)`);
  }

  const conventionsExists = await fileExists(conventionsPath);
  if (!conventionsExists || force) {
    await writeFile(conventionsPath, CONVENTIONS_TEMPLATE);
    created.push(`${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME}`);
  } else {
    skipped.push(`${DATA_DIR_NAME}/${CONTEXT_DIRECTORY}/${CONVENTIONS_FILENAME} (already exists)`);
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
    // Check if global config exists (warning only, don't block)
    const configStore = createConfigStore();
    const globalConfigExists = await configStore.exists('global');

    if (showOutput) {
      outputLines.push('');
      outputLines.push(`${COLORS.bold}AutomatosX Project Init${COLORS.reset}`);
      outputLines.push(`${COLORS.dim}Initializing project: ${process.cwd()}${COLORS.reset}`);
      outputLines.push('');

      if (!globalConfigExists) {
        outputLines.push(`${ICONS.warn} Global config not found. Consider running ${COLORS.cyan}ax setup${COLORS.reset} first.`);
        outputLines.push('');
      }
    }

    // Check if project is already initialized
    const projectDir = process.cwd();
    const automatosxDir = join(projectDir, DATA_DIR_NAME);
    const projectAlreadyInitialized = await fileExists(join(automatosxDir, CONFIG_FILENAME));

    // Step 1: Create project structure
    if (showOutput) {
      if (projectAlreadyInitialized && !initOptions.force) {
        outputLines.push(`${COLORS.bold}Step 1: Project Structure${COLORS.reset} ${COLORS.dim}(already initialized)${COLORS.reset}`);
      } else {
        outputLines.push(`${COLORS.bold}Step 1: Project Structure${COLORS.reset}`);
      }
    }

    const projectStructure = await createProjectStructure(process.cwd(), initOptions.force);

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
          projectDir: process.cwd(),
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
