/**
 * Setup command - Global setup wizard for AutomatosX
 *
 * Creates global configuration with detected providers.
 * For per-project initialization (MCP registration), use `ax init`.
 *
 * Features:
 * - Provider detection
 * - Global configuration creation
 * - Non-interactive mode for CI
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { CommandResult, CLIOptions } from '../types.js';
import {
  createConfigStore,
  initConfigDirectory,
} from '@defai.digital/config-domain';
import {
  DEFAULT_CONFIG,
  KNOWN_PROVIDERS,
  PROVIDER_DEFAULTS,
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_WORKFLOW_STEP,
  DATA_DIR_NAME,
  AGENTS_FILENAME,
  type AutomatosXConfig,
  type ProviderId,
  type ProviderDetectionResult,
} from '@defai.digital/contracts';
import { COLORS, ICONS } from '../utils/terminal.js';
import { getDatabase, getDatabasePath } from '../utils/database.js';
import {
  createPersistentAgentRegistry,
  createAgentLoader,
} from '@defai.digital/agent-domain';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';

const execAsync = promisify(exec);

// ============================================================================
// Constants
// ============================================================================

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

type ConfigScope = (typeof CONFIG_SCOPE)[keyof typeof CONFIG_SCOPE];

/** CLI argument flags */
const CLI_FLAGS = {
  force: ['--force', '-f'],
  nonInteractive: ['--non-interactive', '-y'],
  silent: ['--silent', '-s'],
  local: ['--local', '-l'],
  global: ['--global', '-g'],
} as const;


// ============================================================================
// Database Migration
// ============================================================================

/** Result of database migration */
interface DatabaseMigrationResult {
  success: boolean;
  path: string;
  created: boolean;
  migrated: boolean;
  migrationsApplied: string[];
  error?: string;
}

/** Hierarchy columns that need to exist in trace_summaries */
const HIERARCHY_COLUMNS = [
  { name: 'parent_trace_id', type: 'TEXT' },
  { name: 'root_trace_id', type: 'TEXT' },
  { name: 'trace_depth', type: 'INTEGER' },
  { name: 'session_id', type: 'TEXT' },
  { name: 'agent_id', type: 'TEXT' },
];

/** Type for SQLite database operations used in migrations */
interface SqliteDb {
  prepare(sql: string): { get(): unknown; all(): unknown[] };
  exec(sql: string): void;
}

/**
 * Migrates the SQLite database to the latest schema
 */
async function migrateDatabase(): Promise<DatabaseMigrationResult> {
  const dbPath = getDatabasePath();
  const migrationsApplied: string[] = [];

  try {
    // Get the database instance (creates if doesn't exist)
    const rawDb = await getDatabase();

    if (!rawDb) {
      return {
        success: true,
        path: dbPath,
        created: false,
        migrated: false,
        migrationsApplied: [],
        error: 'SQLite not available, using in-memory storage',
      };
    }

    const db = rawDb as SqliteDb;

    // Check if trace_summaries table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='trace_summaries'"
    ).get();

    if (!tableExists) {
      // Table will be created by SqliteTraceStore, mark as new
      return {
        success: true,
        path: dbPath,
        created: true,
        migrated: false,
        migrationsApplied: [],
      };
    }

    // Check which columns need to be added
    const existingColumns = db.prepare(
      "PRAGMA table_info(trace_summaries)"
    ).all() as { name: string }[];
    const existingColumnNames = new Set(existingColumns.map(c => c.name));

    for (const column of HIERARCHY_COLUMNS) {
      if (!existingColumnNames.has(column.name)) {
        try {
          db.exec(`ALTER TABLE trace_summaries ADD COLUMN ${column.name} ${column.type}`);
          migrationsApplied.push(column.name);
        } catch {
          // Column might already exist from partial migration
        }
      }
    }

    // Create indexes if they don't exist
    const indexMigrations = [
      { name: 'idx_trace_summaries_parent_trace_id', column: 'parent_trace_id' },
      { name: 'idx_trace_summaries_root_trace_id', column: 'root_trace_id' },
      { name: 'idx_trace_summaries_session_id', column: 'session_id' },
    ];

    for (const idx of indexMigrations) {
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS ${idx.name} ON trace_summaries(${idx.column})`);
      } catch {
        // Index might already exist
      }
    }

    return {
      success: true,
      path: dbPath,
      created: false,
      migrated: migrationsApplied.length > 0,
      migrationsApplied,
    };
  } catch (error) {
    return {
      success: false,
      path: dbPath,
      created: false,
      migrated: false,
      migrationsApplied,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Agent Sync
// ============================================================================

/** Result of agent sync */
interface AgentSyncResult {
  success: boolean;
  storagePath: string;
  totalAgents: number;
  updatedAgents: string[];
  newAgents: string[];
  error?: string;
}

/**
 * Get the path to the bundled agents directory
 * Works both in development and when installed as a package
 */
function getBundledAgentsPath(): string {
  // Get the directory of this file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Go up from src/commands to the package root, then into bundled/agents
  // Structure: packages/cli/src/commands/setup.ts -> packages/cli/bundled/agents
  // In dist: packages/cli/dist/commands/setup.js -> packages/cli/bundled/agents
  // Both cases: ../../bundled/agents works since bundled/ is at package root
  return resolve(__dirname, '../../bundled/agents');
}

/**
 * Get the global agents storage path
 * Uses ~/.automatosx/agents.json
 */
function getGlobalAgentsPath(): string {
  return join(homedir(), DATA_DIR_NAME, AGENTS_FILENAME);
}

/**
 * Syncs bundled agents to local storage
 * Updates existing agents with latest bundled versions
 */
async function syncAgents(force: boolean): Promise<AgentSyncResult> {
  const storagePath = getGlobalAgentsPath();
  const updatedAgents: string[] = [];
  const newAgents: string[] = [];

  try {
    // Get bundled agents directory path
    const bundledAgentsDir = getBundledAgentsPath();

    // Create loader for bundled agents
    const loader = createAgentLoader({ agentsDir: bundledAgentsDir });

    // Load all bundled agents
    const bundledAgents = await loader.loadAll();

    if (bundledAgents.length === 0) {
      return {
        success: true,
        storagePath,
        totalAgents: 0,
        updatedAgents: [],
        newAgents: [],
      };
    }

    // Get the agent registry
    const registry = createPersistentAgentRegistry({ storagePath });

    // Get existing agents
    const existingAgents = await registry.list();
    const existingAgentIds = new Set(existingAgents.map(a => a.agentId));

    // Sync each bundled agent
    for (const bundledAgent of bundledAgents) {
      const exists = existingAgentIds.has(bundledAgent.agentId);

      if (exists) {
        // Update existing agent with bundled version when force is true
        if (force) {
          // Remove existing agent first, then register the bundled version
          await registry.remove(bundledAgent.agentId);
          await registry.register(bundledAgent);
          updatedAgents.push(bundledAgent.agentId);
        }
      } else {
        // Register new agent
        await registry.register(bundledAgent);
        newAgents.push(bundledAgent.agentId);
      }
    }

    return {
      success: true,
      storagePath,
      totalAgents: bundledAgents.length,
      updatedAgents,
      newAgents,
    };
  } catch (error) {
    return {
      success: false,
      storagePath,
      totalAgents: 0,
      updatedAgents,
      newAgents,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
  const results = await Promise.all(KNOWN_PROVIDERS.map((id) => detectProvider(id)));
  return results;
}

// ============================================================================
// Setup Logic
// ============================================================================

interface SetupOptions {
  force: boolean;
  nonInteractive: boolean;
  silent: boolean;
  scope: ConfigScope;
}

/** Result of the setup process */
interface SetupResult {
  success: boolean;
  config: AutomatosXConfig;
  providers: ProviderDetectionResult[];
  configPath: string;
  alreadyUpToDate?: boolean;
  newProvidersDetected?: string[];
  removedProviders?: string[];
}

/**
 * Runs the setup process
 */
async function runSetup(options: SetupOptions): Promise<SetupResult> {
  const configStore = createConfigStore();
  const configFilePath = configStore.getPath(options.scope);

  // Detect providers first (needed for comparison)
  const allProviders = await detectAllProviders();
  const availableProviders = allProviders.filter((provider) => provider.detected);
  const detectedProviderIds = new Set(availableProviders.map((p) => p.providerId as string));

  // Check if config already exists
  const configExists = await configStore.exists(options.scope);

  if (configExists && !options.force) {
    // Read existing config and compare
    const existingConfig = await configStore.read(options.scope);
    const existingProviderIds = new Set(
      Object.keys(existingConfig?.providers ?? {}).filter(
        (id) => existingConfig?.providers[id]?.enabled
      )
    );

    // Find differences
    const newProviders = [...detectedProviderIds].filter((id) => !existingProviderIds.has(id));
    const removedProviders = [...existingProviderIds].filter((id) => !detectedProviderIds.has(id));

    // If no changes, return "up to date"
    if (newProviders.length === 0 && removedProviders.length === 0) {
      return {
        success: true,
        config: existingConfig as AutomatosXConfig,
        providers: allProviders,
        configPath: configFilePath,
        alreadyUpToDate: true,
      };
    }

    // Changes detected but no --force flag
    return {
      success: true,
      config: existingConfig as AutomatosXConfig,
      providers: allProviders,
      configPath: configFilePath,
      alreadyUpToDate: false,
      newProvidersDetected: newProviders,
      removedProviders: removedProviders,
    };
  }

  // Initialize directory
  await initConfigDirectory(options.scope);

  // Build providers config record
  const providersConfig: Record<
    string,
    { enabled: boolean; priority: number; timeout: number; command?: string }
  > = {};
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
  let silent = false;
  let scope: ConfigScope = CONFIG_SCOPE.GLOBAL;

  for (const arg of args) {
    if (matchesFlag(arg, CLI_FLAGS.force)) {
      force = true;
    } else if (matchesFlag(arg, CLI_FLAGS.nonInteractive)) {
      nonInteractive = true;
    } else if (matchesFlag(arg, CLI_FLAGS.silent)) {
      silent = true;
      nonInteractive = true;
      force = true;
    } else if (matchesFlag(arg, CLI_FLAGS.local)) {
      scope = CONFIG_SCOPE.LOCAL;
    } else if (matchesFlag(arg, CLI_FLAGS.global)) {
      scope = CONFIG_SCOPE.GLOBAL;
    }
  }

  return { force, nonInteractive, silent, scope };
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
 *
 * Global setup for AutomatosX:
 * 1. Detects installed provider CLIs
 * 2. Creates global configuration
 *
 * For per-project initialization (MCP registration), use `ax init`.
 */
export async function setupCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const setupOptions = parseSetupArgs(args);
  const isJsonFormat = options.format === 'json';
  const isSilent = setupOptions.silent;
  const showOutput = !isJsonFormat && !isSilent;
  const outputLines: string[] = [];

  try {
    // Header
    if (showOutput) {
      outputLines.push('');
      outputLines.push(`${COLORS.bold}AutomatosX Setup${COLORS.reset}`);
      outputLines.push('');
    }

    // Step 1: Check prerequisites
    if (showOutput) {
      outputLines.push(`${COLORS.bold}Step 1: System Check${COLORS.reset}`);
      outputLines.push(`  ${ICONS.check} Node.js: ${process.version}`);
      outputLines.push('');
    }

    // Step 2: Database Migration
    if (showOutput) {
      outputLines.push(`${COLORS.bold}Step 2: Database Setup${COLORS.reset}`);
    }

    const dbResult = await migrateDatabase();
    if (showOutput) {
      if (dbResult.migrated) {
        outputLines.push(`  ${ICONS.check} Database migrated: ${dbResult.migrationsApplied.join(', ')}`);
      } else if (dbResult.created) {
        outputLines.push(`  ${ICONS.check} Database created: ${dbResult.path}`);
      } else {
        outputLines.push(`  ${ICONS.check} Database up to date: ${dbResult.path}`);
      }
      outputLines.push('');
    }

    // Step 3: Sync bundled agents
    if (showOutput) {
      outputLines.push(`${COLORS.bold}Step 3: Agent Sync${COLORS.reset}`);
    }

    const agentResult = await syncAgents(setupOptions.force);
    if (showOutput) {
      if (agentResult.error) {
        outputLines.push(`  ${ICONS.warn} Agent sync failed: ${agentResult.error}`);
      } else if (agentResult.newAgents.length > 0 || agentResult.updatedAgents.length > 0) {
        if (agentResult.newAgents.length > 0) {
          outputLines.push(`  ${ICONS.check} New agents added: ${agentResult.newAgents.length}`);
        }
        if (agentResult.updatedAgents.length > 0) {
          outputLines.push(`  ${ICONS.check} Agents updated: ${agentResult.updatedAgents.length}`);
        }
      } else {
        outputLines.push(`  ${ICONS.check} Agents up to date (${agentResult.totalAgents} bundled)`);
        if (!setupOptions.force) {
          outputLines.push(`  ${COLORS.dim}Use --force to update existing agents${COLORS.reset}`);
        }
      }
      outputLines.push('');
    }

    // Step 4: Detect providers and create/check configuration
    if (showOutput) {
      outputLines.push(`${COLORS.bold}Step 4: Provider Detection & Configuration${COLORS.reset}`);
    }

    const setupResult = await runSetup(setupOptions);
    const detectedProviders = setupResult.providers;

    if (showOutput) {
      for (const provider of detectedProviders) {
        outputLines.push(formatProviderResult(provider));
      }
      outputLines.push('');
    }

    // Handle idempotent cases
    if (setupResult.alreadyUpToDate) {
      if (showOutput) {
        outputLines.push(`${ICONS.check} Configuration is up to date at: ${setupResult.configPath}`);
        outputLines.push('');
        outputLines.push(`${COLORS.bold}Summary${COLORS.reset}`);
        outputLines.push(`  No changes needed - providers match existing configuration`);
        outputLines.push('');
        outputLines.push(`${COLORS.bold}Next Steps${COLORS.reset}`);
        outputLines.push(`  1. Run ${COLORS.cyan}ax doctor${COLORS.reset} to verify providers are working`);
        outputLines.push(
          `  2. Run ${COLORS.cyan}ax init${COLORS.reset} in your project directory to register MCP`
        );
        outputLines.push('');
      }

      if (isJsonFormat) {
        return {
          success: true,
          message: undefined,
          data: {
            success: true,
            configPath: setupResult.configPath,
            alreadyUpToDate: true,
            providers: {
              detected: detectedProviders
                .filter((provider) => provider.detected)
                .map((provider) => provider.providerId),
              enabled: Object.keys(setupResult.config.providers).filter(
                (id) => setupResult.config.providers[id]?.enabled
              ),
            },
            defaultProvider: setupResult.config.defaultProvider,
            version: setupResult.config.version,
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
    }

    // Changes detected but no --force
    if (setupResult.newProvidersDetected || setupResult.removedProviders) {
      if (showOutput) {
        outputLines.push(`${ICONS.warn} Configuration exists but providers have changed:`);
        if (setupResult.newProvidersDetected && setupResult.newProvidersDetected.length > 0) {
          outputLines.push(
            `  ${COLORS.green}+ New:${COLORS.reset} ${setupResult.newProvidersDetected.join(', ')}`
          );
        }
        if (setupResult.removedProviders && setupResult.removedProviders.length > 0) {
          outputLines.push(
            `  ${COLORS.red}- Removed:${COLORS.reset} ${setupResult.removedProviders.join(', ')}`
          );
        }
        outputLines.push('');
        outputLines.push(
          `Run ${COLORS.cyan}ax setup --force${COLORS.reset} to update configuration.`
        );
        outputLines.push('');
      }

      if (isJsonFormat) {
        return {
          success: true,
          message: undefined,
          data: {
            success: true,
            configPath: setupResult.configPath,
            alreadyUpToDate: false,
            changesDetected: {
              newProviders: setupResult.newProvidersDetected,
              removedProviders: setupResult.removedProviders,
            },
            providers: {
              detected: detectedProviders
                .filter((provider) => provider.detected)
                .map((provider) => provider.providerId),
              enabled: Object.keys(setupResult.config.providers).filter(
                (id) => setupResult.config.providers[id]?.enabled
              ),
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
    }

    // Normal setup (new configuration created)
    if (showOutput) {
      outputLines.push(`${ICONS.check} Configuration saved to: ${setupResult.configPath}`);
      outputLines.push('');
    }

    if (showOutput) {
      // Summary
      const detectedCount = detectedProviders.filter((provider) => provider.detected).length;
      const enabledCount = Object.keys(setupResult.config.providers).length;

      outputLines.push(`${COLORS.bold}Summary${COLORS.reset}`);
      outputLines.push(`  Providers detected: ${detectedCount}/${KNOWN_PROVIDERS.length}`);
      outputLines.push(`  Providers enabled: ${enabledCount}`);

      if (setupResult.config.defaultProvider !== undefined) {
        outputLines.push(`  Default provider: ${setupResult.config.defaultProvider}`);
      }

      outputLines.push('');
      outputLines.push(`${COLORS.bold}Next Steps${COLORS.reset}`);
      outputLines.push(`  1. Run ${COLORS.cyan}ax doctor${COLORS.reset} to verify providers are working`);
      outputLines.push(
        `  2. Run ${COLORS.cyan}ax init${COLORS.reset} in your project directory to register MCP`
      );
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
            detected: detectedProviders
              .filter((provider) => provider.detected)
              .map((provider) => provider.providerId),
            enabled: Object.keys(setupResult.config.providers).filter(
              (id) => setupResult.config.providers[id]?.enabled
            ),
          },
          defaultProvider: setupResult.config.defaultProvider,
          version: setupResult.config.version,
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
