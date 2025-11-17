/**
 * Status Command - Display system status and health
 *
 * Shows comprehensive system information including:
 * - Project and configuration info
 * - Directory structure and existence
 * - Provider availability and health
 * - Workspace statistics
 * - Memory system status
 */

import type { CommandModule } from 'yargs';
import { PathResolver } from '../../core/path-resolver.js';
import { WorkspaceManager } from '../../core/workspace-manager.js';
import { BaseProvider } from '../../providers/base-provider.js';
import { ClaudeProvider } from '../../providers/claude-provider.js';
import { GeminiProvider } from '../../providers/gemini-provider.js';
import { GrokProvider } from '../../providers/grok-provider.js';
import { createOpenAIProviderSync } from '../../providers/openai-provider-factory.js';
import { loadConfig } from '../../core/config.js';
import type { AutomatosXConfig } from '../../types/config.js';
import { DEFAULT_CONFIG } from '../../types/config.js';
import { logger } from '../../utils/logger.js';
import chalk from 'chalk';
import { existsSync, statSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import os from 'os';
import { printError } from '../../utils/error-formatter.js';
import { getVersion } from '../../utils/version.js';
import { getProviderLimitManager } from '../../core/provider-limit-manager.js';

// Get version from package.json (single source of truth)
const VERSION = getVersion();

interface StatusOptions {
  verbose?: boolean;
  json?: boolean;
}

export const statusCommand: CommandModule<Record<string, unknown>, StatusOptions> = {
  command: 'status',
  describe: 'Display system status and health',

  builder: (yargs) => {
    return yargs
      .option('verbose', {
        describe: 'Verbose output with detailed statistics',
        type: 'boolean',
        default: false
      })
      .option('json', {
        describe: 'Output as JSON',
        type: 'boolean',
        default: false
      });
  },

  handler: async (argv) => {
    try {
      const startTime = Date.now();
      const workingDir = process.cwd();
      const pathResolver = new PathResolver({
        projectDir: workingDir,
        workingDir,
        agentWorkspace: join(workingDir, '.automatosx', 'workspaces')
      });

      const detectedProjectDir = await pathResolver.detectProjectRoot();
      let config: AutomatosXConfig;

      try {
        config = await loadConfig(detectedProjectDir);
      } catch (error) {
        logger.warn('Status command using default configuration due to load failure', {
          error: (error as Error).message
        });
        config = DEFAULT_CONFIG;
      }

      if (!config) {
        logger.warn('Status command received empty configuration, falling back to defaults');
        config = DEFAULT_CONFIG;
      }

      const providerConfigs = config.providers ?? {};

      // Check directories
      const automatosxDir = join(detectedProjectDir, '.automatosx');
      const agentsDir = join(automatosxDir, 'agents');
      const abilitiesDir = join(automatosxDir, 'abilities');
      const memoryDir = join(automatosxDir, 'memory');

      // v5.2.0: New workspace structure
      const prdDir = join(detectedProjectDir, 'automatosx', 'PRD');
      const tmpDir = join(detectedProjectDir, 'automatosx', 'tmp');

      // Initialize providers
      const providers: BaseProvider[] = [];

      if (providerConfigs['claude-code']?.enabled) {
        providers.push(new ClaudeProvider({
          name: 'claude-code',
          enabled: true,
          priority: providerConfigs['claude-code'].priority,
          timeout: providerConfigs['claude-code'].timeout,
          command: providerConfigs['claude-code'].command
        }));
      }

      if (providerConfigs['gemini-cli']?.enabled) {
        providers.push(new GeminiProvider({
          name: 'gemini-cli',
          enabled: true,
          priority: providerConfigs['gemini-cli'].priority,
          timeout: providerConfigs['gemini-cli'].timeout,
          command: providerConfigs['gemini-cli'].command
        }));
      }

      if (providerConfigs['openai']?.enabled) {
        const openaiConfig = providerConfigs['openai'];
        // v6.0.7: Use factory to create provider based on integration mode
        const provider = createOpenAIProviderSync(
          {
            name: 'openai',
            enabled: true,
            priority: openaiConfig.priority,
            timeout: openaiConfig.timeout,
            command: openaiConfig.command || 'codex',
            integration: openaiConfig.integration,
            sdk: openaiConfig.sdk,
            circuitBreaker: openaiConfig.circuitBreaker,
            processManagement: openaiConfig.processManagement,
            versionDetection: openaiConfig.versionDetection,
            limitTracking: openaiConfig.limitTracking
          },
          openaiConfig.integration
        );
        providers.push(provider);
      }

      if (providerConfigs['grok']?.enabled) {
        providers.push(new GrokProvider({
          name: 'grok',
          enabled: true,
          priority: providerConfigs['grok'].priority,
          timeout: providerConfigs['grok'].timeout,
          command: providerConfigs['grok'].command
        }));
      }

      // v5.6.25: Optimize status command - avoid Router initialization
      // Status command only needs to check provider availability, not full Router functionality
      // This eliminates unnecessary health check timers and cache warmup delays
      const providerHealth = await Promise.all(
        providers.map(async (p) => ({
          name: p.name,
          available: await p.isAvailable(),
          health: await p.getHealth(),
          priority: p.priority
        }))
      );

      // Calculate available providers count for router status display
      const availableProvidersCount = providerHealth.filter(p => p.available).length;

      // v5.2.0: Collect workspace statistics using WorkspaceManager
      // Bug #v8.4.12: Use read-only mode to avoid creating directories during status check
      const workspaceManager = new WorkspaceManager(detectedProjectDir);
      const workspaceStats = await workspaceManager.getStats({ readOnly: true });

      // Collect memory statistics
      const memoryStats = await getMemoryStatistics(memoryDir);

      // Collect agent and ability counts
      const agentCount = await countFiles(agentsDir, ['.yaml', '.yml']);
      const abilityCount = await countFiles(abilitiesDir, ['.md']);

      // Get project info
      const projectInfo = await getProjectInfo(detectedProjectDir);

      // Bug #v8.4.12: Collect provider limit data for JSON output
      let limitData: {
        limits: Array<{
          provider: string;
          status: string;
          window: string;
          detectedAtMs: number;
          resetAtMs: number;
          remainingMs: number;
          reason?: string;
          manualHold: boolean;
        }>;
        manualOverride: {
          provider: string;
          expiresAtMs?: number;
          remainingMs?: number;
        } | null;
        envOverrides: Array<{
          name: string;
          provider: string;
          value: string;
          valid: boolean;
        }>;
      } = {
        limits: [],
        manualOverride: null,
        envOverrides: []
      };

      try {
        const limitManager = await getProviderLimitManager();
        await limitManager.initialize();
        await limitManager.refreshExpired();

        const limitStates = limitManager.getAllStates();
        const manualOverride = limitManager.getManualOverride();
        const now = Date.now();

        // Collect limit states
        limitData.limits = Array.from(limitStates.entries()).map(([name, state]) => ({
          provider: name,
          status: state.status,
          window: state.window,
          detectedAtMs: state.detectedAtMs,
          resetAtMs: state.resetAtMs,
          remainingMs: Math.max(0, state.resetAtMs - now),
          reason: state.reason,
          manualHold: state.manualHold
        }));

        // Collect manual override
        if (manualOverride) {
          limitData.manualOverride = {
            provider: manualOverride.provider,
            expiresAtMs: manualOverride.expiresAtMs,
            remainingMs: manualOverride.expiresAtMs ? Math.max(0, manualOverride.expiresAtMs - now) : undefined
          };
        }

        // Collect ENV overrides
        const envVars = [
          { name: 'CLAUDE_CLI', provider: 'claude-code' },
          { name: 'GEMINI_CLI', provider: 'gemini-cli' },
          { name: 'CODEX_CLI', provider: 'openai' }
        ];

        for (const { name, provider } of envVars) {
          const value = process.env[name];
          if (value) {
            limitData.envOverrides.push({
              name,
              provider,
              value,
              valid: existsSync(value)
            });
          }
        }
      } catch (error) {
        logger.warn('Failed to collect provider limit data', { error: (error as Error).message });
      }

      // Build status object
      const status = {
        system: {
          version: VERSION,
          nodeVersion: process.version,
          platform: `${os.platform()} ${os.arch()}`,
          uptime: Math.floor(process.uptime()),
          projectDir: detectedProjectDir,
          workingDir: process.cwd()
        },
        project: projectInfo,
        configuration: {
          configFile: join(detectedProjectDir, 'automatosx.config.json'),
          configExists: existsSync(join(detectedProjectDir, 'automatosx.config.json')),
          logLevel: config.logging?.level ?? DEFAULT_CONFIG.logging.level,
          memoryMaxEntries: config.memory?.maxEntries ?? DEFAULT_CONFIG.memory.maxEntries,
          memoryRetentionDays: config.memory?.cleanupDays ?? DEFAULT_CONFIG.memory.cleanupDays
        },
        directories: {
          automatosx: { path: automatosxDir, exists: existsSync(automatosxDir) },
          agents: { path: agentsDir, exists: existsSync(agentsDir), count: agentCount },
          abilities: { path: abilitiesDir, exists: existsSync(abilitiesDir), count: abilityCount },
          memory: { path: memoryDir, exists: existsSync(memoryDir), ...memoryStats },
          prd: {
            path: prdDir,
            exists: existsSync(prdDir),
            files: workspaceStats.prdFiles,
            sizeBytes: workspaceStats.prdSizeBytes
          },
          tmp: {
            path: tmpDir,
            exists: existsSync(tmpDir),
            files: workspaceStats.tmpFiles,
            sizeBytes: workspaceStats.tmpSizeBytes
          }
        },
        providers: providerHealth,
        router: {
          totalProviders: providers.length,
          availableProviders: availableProvidersCount,
          fallbackEnabled: true,
          healthCheck: {
            enabled: config.router?.healthCheckInterval !== undefined,
            interval: config.router?.healthCheckInterval,
            checksPerformed: 0,
            successRate: 100,
            avgDuration: 0,
            lastCheck: undefined
          }
        },
        // Bug #v8.4.12: Include provider limit data in JSON output
        providerLimits: limitData,
        performance: {
          statusCheckMs: Date.now() - startTime
        }
      };

      // Output
      if (argv.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(chalk.blue.bold('\n📊 AutomatosX Status\n'));

        // System
        console.log(chalk.cyan('System:'));
        console.log(`  Version: ${chalk.white(status.system.version)}`);
        console.log(`  Node: ${chalk.white(status.system.nodeVersion)}`);
        console.log(`  Platform: ${chalk.white(status.system.platform)}`);
        if (argv.verbose) {
          console.log(`  Process Uptime: ${chalk.white(formatUptime(status.system.uptime))}`);
        }
        console.log();

        // Project Info
        if (status.project.name || argv.verbose) {
          console.log(chalk.cyan('Project:'));
          if (status.project.name) {
            console.log(`  Name: ${chalk.white(status.project.name)}`);
          }
          if (status.project.type) {
            console.log(`  Type: ${chalk.white(status.project.type)}`);
          }
          console.log(`  Directory: ${chalk.white(status.system.projectDir)}`);
          if (status.system.workingDir !== status.system.projectDir) {
            console.log(`  Working Dir: ${chalk.white(status.system.workingDir)}`);
          }
          console.log();
        }

        // Configuration
        console.log(chalk.cyan('Configuration:'));
        const configIcon = status.configuration.configExists ? chalk.green('✓') : chalk.yellow('⚠');
        const configText = status.configuration.configExists ? 'found' : 'using defaults';
        console.log(`  ${configIcon} Config: ${configText}`);
        if (argv.verbose && status.configuration.configExists) {
          console.log(chalk.gray(`     ${status.configuration.configFile}`));
        }
        console.log(`  Log Level: ${chalk.white(status.configuration.logLevel)}`);
        console.log(`  Memory Limit: ${chalk.white(status.configuration.memoryMaxEntries.toLocaleString())} entries`);
        console.log(`  Retention: ${chalk.white(status.configuration.memoryRetentionDays)} days`);
        console.log();

        // Directories
        console.log(chalk.cyan('Resources:'));
        for (const [name, dir] of Object.entries(status.directories)) {
          const statusIcon = dir.exists ? chalk.green('✓') : chalk.red('✗');

          let info = '';
          if (name === 'agents' && 'count' in dir) {
            const agentDir = dir as { count: number };
            info = ` (${agentDir.count} ${agentDir.count === 1 ? 'agent' : 'agents'})`;
          } else if (name === 'abilities' && 'count' in dir) {
            const abilityDir = dir as { count: number };
            info = ` (${abilityDir.count} ${abilityDir.count === 1 ? 'ability' : 'abilities'})`;
          } else if (name === 'memory' && 'files' in dir) {
            const memDir = dir as { files: number; sizeBytes: number };
            info = ` (${memDir.files} ${memDir.files === 1 ? 'file' : 'files'}, ${formatBytes(memDir.sizeBytes || 0)})`;
          } else if ((name === 'prd' || name === 'tmp') && 'files' in dir) {
            const wsDir = dir as { files: number; sizeBytes: number };
            info = ` (${wsDir.files} ${wsDir.files === 1 ? 'file' : 'files'}, ${formatBytes(wsDir.sizeBytes || 0)})`;
          }

          console.log(`  ${statusIcon} ${name}${info}`);
          if (argv.verbose) {
            console.log(chalk.gray(`     ${dir.path}`));
          }
        }
        console.log();

        // Providers
        console.log(chalk.cyan('Providers:'));
        for (const provider of status.providers) {
          const statusIcon = provider.available ? chalk.green('✓') : chalk.red('✗');
          const statusText = provider.available ? chalk.green('available') : chalk.red('unavailable');
          console.log(`  ${statusIcon} ${provider.name}: ${statusText} (priority: ${provider.priority})`);

          if (argv.verbose) {
            console.log(chalk.gray(`     Failures: ${provider.health.consecutiveFailures}`));
            console.log(chalk.gray(`     Latency: ${provider.health.latencyMs}ms`));
            console.log(chalk.gray(`     Error rate: ${(provider.health.errorRate * 100).toFixed(2)}%`));
          }
        }
        console.log();

        // v5.7.0: Provider Limits Status
        console.log(chalk.cyan('Provider Limits:'));
        try {
          const limitManager = await getProviderLimitManager();
          await limitManager.initialize();

          // Bug #v8.4.11: Refresh expired limits before displaying
          await limitManager.refreshExpired();

          const limitStates = limitManager.getAllStates();
          const manualOverride = limitManager.getManualOverride();
          const now = Date.now();

          if (limitStates.size === 0 && !manualOverride) {
            console.log(chalk.gray('  No limits detected. All providers available.'));
          } else {
            // Show limited providers
            if (limitStates.size > 0) {
              for (const [name, state] of limitStates.entries()) {
                // Bug #v8.4.11: Clamp negative remainingMs to 0
                const remainingMs = Math.max(0, state.resetAtMs - now);
                const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
                console.log(chalk.yellow(`  ⚠️  ${name}: LIMITED (resets in ${hours}h)`));

                if (argv.verbose) {
                  const resetDate = new Date(state.resetAtMs);
                  console.log(chalk.gray(`     Window: ${state.window}`));
                  console.log(chalk.gray(`     Resets: ${resetDate.toLocaleString()}`));
                  if (state.reason) {
                    console.log(chalk.gray(`     Reason: ${state.reason}`));
                  }
                }
              }
            }

            // Show manual override
            if (manualOverride) {
              const expiresText = manualOverride.expiresAtMs
                ? `expires in ${Math.ceil((manualOverride.expiresAtMs - now) / (1000 * 60))}m`
                : 'no expiry';
              console.log(chalk.cyan(`  🔧 Manual Override: ${manualOverride.provider} (${expiresText})`));
            }

            // Show available providers
            const availableCount = status.providers.filter(p => {
              const isLimited = limitStates.has(p.name);
              const isOverridden = manualOverride && manualOverride.provider !== p.name;
              return p.available && !isLimited && !isOverridden;
            }).length;

            if (availableCount > 0) {
              console.log(chalk.green(`  ✅ ${availableCount} provider(s) available`));
            }
          }
        } catch (error) {
          logger.warn('Failed to get provider limits', { error: (error as Error).message });
          console.log(chalk.gray('  (Unable to load limit status)'));
        }
        console.log();

        // ENV Variable Overrides (Phase 2: v5.4.0)
        console.log(chalk.cyan('ENV Variable Overrides:'));
        const envVars = [
          { name: 'CLAUDE_CLI', provider: 'claude-code' },
          { name: 'GEMINI_CLI', provider: 'gemini-cli' },
          { name: 'CODEX_CLI', provider: 'openai' }
        ];

        let hasAnyEnvVar = false;
        for (const { name, provider } of envVars) {
          const value = process.env[name];
          if (value) {
            hasAnyEnvVar = true;
            const exists = existsSync(value);
            const icon = exists ? chalk.green('✓') : chalk.yellow('⚠');
            const statusMsg = exists ? chalk.green('valid') : chalk.yellow('path not found');
            console.log(`  ${icon} ${name}: ${statusMsg}`);
            if (argv.verbose) {
              console.log(chalk.gray(`     ${value}`));
            }
          }
        }

        if (!hasAnyEnvVar) {
          console.log(chalk.gray('  No ENV variables set (using PATH detection)'));
          if (argv.verbose) {
            console.log(chalk.gray('  Tip: Set CLAUDE_CLI, GEMINI_CLI, or CODEX_CLI to override detection'));
          }
        }
        console.log();

        // Router
        console.log(chalk.cyan('Router:'));
        console.log(`  Total providers: ${chalk.white(status.router.totalProviders)}`);
        console.log(`  Available: ${chalk.white(status.router.availableProviders)}`);
        console.log(`  Fallback: ${chalk.white(status.router.fallbackEnabled ? 'enabled' : 'disabled')}`);

        // v5.7.0: Health check status
        const healthCheck = status.router.healthCheck;
        if (healthCheck.enabled) {
          console.log(`  Health Checks: ${chalk.green('✓ enabled')} (${(healthCheck.interval! / 1000).toFixed(0)}s interval)`);
          if (healthCheck.checksPerformed > 0) {
            console.log(`    Checks: ${chalk.white(healthCheck.checksPerformed.toLocaleString())} (${chalk.white(healthCheck.successRate.toFixed(1))}% success)`);
            console.log(`    Avg Duration: ${chalk.white(Math.round(healthCheck.avgDuration))}ms`);
            if (healthCheck.lastCheck) {
              const lastCheckAgo = Math.floor((Date.now() - healthCheck.lastCheck) / 1000);
              console.log(`    Last Check: ${chalk.white(lastCheckAgo)}s ago`);
            }
          }
        } else {
          console.log(`  Health Checks: ${chalk.gray('disabled')}`);
        }
        console.log();

        // Performance (verbose only)
        if (argv.verbose) {
          console.log(chalk.cyan('Performance:'));
          console.log(`  Status check: ${chalk.white(status.performance.statusCheckMs)}ms`);
          console.log();
        }

        // Overall status
        const allDirsExist = Object.values(status.directories).every(d => d.exists);
        const hasAvailableProviders = status.router.availableProviders > 0;
        const isHealthy = allDirsExist && hasAvailableProviders;

        if (isHealthy) {
          console.log(chalk.green.bold('✅ System is healthy\n'));
        } else {
          console.log(chalk.yellow.bold('⚠️  System has issues\n'));
          if (!allDirsExist) {
            console.log(chalk.yellow('  Some directories are missing. Run `automatosx setup` to initialize.'));
          }
          if (!hasAvailableProviders) {
            console.log(chalk.yellow('  No providers available. Check provider configuration.'));
          }
          console.log();
        }
      }

    } catch (error) {
      printError(error, {
        verbose: argv.verbose,
        showCode: true,
        showSuggestions: true,
        colors: true
      });
      logger.error('Status check failed', { error: (error as Error).message });
      process.exit(1);
    }
  }
};

/**
 * Helper Functions
 */


/**
 * Get memory statistics
 */
async function getMemoryStatistics(memoryDir: string): Promise<{
  files: number;
  sizeBytes: number;
}> {
  if (!existsSync(memoryDir)) {
    return { files: 0, sizeBytes: 0 };
  }

  try {
    const stats = await getDirectoryStats(memoryDir);
    return {
      files: stats.files,
      sizeBytes: stats.size
    };
  } catch (error) {
    logger.warn('Failed to get memory statistics', { error: (error as Error).message });
    return { files: 0, sizeBytes: 0 };
  }
}

/**
 * Get directory statistics recursively
 */
async function getDirectoryStats(dirPath: string): Promise<{ size: number; files: number }> {
  let totalSize = 0;
  let totalFiles = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subStats = await getDirectoryStats(fullPath);
        totalSize += subStats.size;
        totalFiles += subStats.files;
      } else if (entry.isFile()) {
        const stats = await stat(fullPath);
        totalSize += stats.size;
        totalFiles++;
      }
    }
  } catch (error) {
    // Silently ignore errors (permission denied, etc.)
  }

  return { size: totalSize, files: totalFiles };
}

/**
 * Count files with specific extensions in a directory
 */
async function countFiles(dirPath: string, extensions: string[]): Promise<number> {
  if (!existsSync(dirPath)) {
    return 0;
  }

  try {
    const files = await readdir(dirPath);
    return files.filter(f => extensions.some(ext => f.endsWith(ext))).length;
  } catch (error) {
    logger.warn('Failed to count files', { dirPath, error: (error as Error).message });
    return 0;
  }
}

/**
 * Get project information from package.json
 */
async function getProjectInfo(projectDir: string): Promise<{
  name?: string;
  version?: string;
  type?: string;
}> {
  const packageJsonPath = join(projectDir, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const { readFile } = await import('fs/promises');
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    return {
      name: pkg.name,
      version: pkg.version,
      type: pkg.type || 'commonjs'
    };
  } catch (error) {
    logger.warn('Failed to read package.json', { error: (error as Error).message });
    return {};
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format uptime to human-readable string
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
