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
// MCP Configuration for Providers (using CLI commands - best practice)
// ============================================================================

/**
 * MCP server name for AutomatosX
 */
const AUTOMATOSX_MCP_SERVER_NAME = 'automatosx';

/**
 * Get the CLI command to add AutomatosX MCP server for each provider
 *
 * Best practice: Use each provider's native CLI commands instead of
 * directly modifying config files. This ensures proper formatting,
 * validation, and compatibility.
 */
function getMCPAddCommand(providerId: ProviderId): string | null {
  switch (providerId) {
    case 'claude':
      // Claude Code: claude mcp add <name> <command> [args...]
      return `claude mcp add ${AUTOMATOSX_MCP_SERVER_NAME} automatosx mcp server`;
    case 'gemini':
      // Gemini CLI: gemini mcp add <name> <command> [args...]
      return `gemini mcp add ${AUTOMATOSX_MCP_SERVER_NAME} automatosx mcp server`;
    case 'codex':
      // Codex CLI: codex mcp add <name> <command> [args...]
      return `codex mcp add ${AUTOMATOSX_MCP_SERVER_NAME} automatosx mcp server`;
    case 'qwen':
      // Qwen: qwen mcp add <name> <command> [args...]
      return `qwen mcp add ${AUTOMATOSX_MCP_SERVER_NAME} automatosx mcp server`;
    case 'glm':
      // ax-glm: ax-glm mcp add <name> --command <cmd> --args <args...>
      return `ax-glm mcp add ${AUTOMATOSX_MCP_SERVER_NAME} --command automatosx --args mcp server`;
    case 'grok':
      // ax-grok: ax-grok mcp add <name> --command <cmd> --args <args...>
      return `ax-grok mcp add ${AUTOMATOSX_MCP_SERVER_NAME} --command automatosx --args mcp server`;
    default:
      return null;
  }
}

/**
 * Get the CLI command to remove MCP server for each provider
 */
function getMCPRemoveCommand(providerId: ProviderId): string | null {
  switch (providerId) {
    case 'claude':
      return `claude mcp remove ${AUTOMATOSX_MCP_SERVER_NAME}`;
    case 'gemini':
      return `gemini mcp remove ${AUTOMATOSX_MCP_SERVER_NAME}`;
    case 'codex':
      return `codex mcp remove ${AUTOMATOSX_MCP_SERVER_NAME}`;
    case 'qwen':
      return `qwen mcp remove ${AUTOMATOSX_MCP_SERVER_NAME}`;
    case 'glm':
      return `ax-glm mcp remove ${AUTOMATOSX_MCP_SERVER_NAME}`;
    case 'grok':
      return `ax-grok mcp remove ${AUTOMATOSX_MCP_SERVER_NAME}`;
    default:
      return null;
  }
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
        await execAsync(`${removeCommand} 2>&1`, { timeout: 15000 });
      } catch {
        // Ignore - server might not exist, that's OK
      }
    }

    // Step 2: Add automatosx MCP server using provider's native CLI
    await execAsync(`${addCommand} 2>&1`, { timeout: 30000 });

    return { success: true, skipped: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
  failed: Array<{ providerId: string; error: string }>;
}> {
  const configured: string[] = [];
  const skipped: string[] = [];
  const notInstalled: string[] = [];
  const failed: Array<{ providerId: string; error: string }> = [];

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
        error: result.error || 'Unknown error',
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
    const whichCommand = process.platform === 'win32' ? 'where' : 'which';
    await execAsync(`${whichCommand} ${command}`);
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
    const { stdout } = await execAsync(`${command} --version 2>&1`, {
      timeout: 5000,
    });
    const versionMatch = /(\d+\.\d+\.\d+)/.exec(stdout);
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
 * Template for conventions.md
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
  version: '1.0.0',
  iterate: {
    maxIterations: 20,
    maxTimeMs: 300000,
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

  const automatosxDir = join(projectDir, '.automatosx');
  const contextDir = join(automatosxDir, CONTEXT_DIRECTORY);
  const configPath = join(automatosxDir, 'config.json');
  const conventionsPath = join(contextDir, 'conventions.md');

  // Create .automatosx directory
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
    created.push('.automatosx/config.json');
  } else {
    skipped.push('.automatosx/config.json (already exists)');
  }

  // Create conventions.md template
  const conventionsExists = await fileExists(conventionsPath);
  if (!conventionsExists || force) {
    await writeFile(conventionsPath, CONVENTIONS_TEMPLATE);
    created.push('.automatosx/context/conventions.md');
  } else {
    skipped.push('.automatosx/context/conventions.md (already exists)');
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
      timeout: 2700000, // 45 minutes default
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
 * Parses setup-specific arguments
 */
function parseSetupArgs(args: string[]): SetupOptions {
  let force = false;
  let nonInteractive = false;
  let scope: 'global' | 'local' = 'global';
  let skipProjectStructure = false;

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (arg === '--non-interactive' || arg === '-y') {
      nonInteractive = true;
    } else if (arg === '--local' || arg === '-l') {
      scope = 'local';
    } else if (arg === '--global' || arg === '-g') {
      scope = 'global';
    } else if (arg === '--skip-project' || arg === '--no-project') {
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

  return `  ${result.providerId.padEnd(10)} ${status}`;
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
      output.push(`  2. Edit ${COLORS.cyan}.automatosx/context/conventions.md${COLORS.reset} to add your project conventions`);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
