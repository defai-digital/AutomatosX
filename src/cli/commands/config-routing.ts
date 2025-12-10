/**
 * Config Routing Command - Configure provider routing (v14.0.0)
 *
 * Auto-configures provider routing based on detection, or allows
 * manual viewing/modification of routing settings.
 *
 * Usage:
 *   ax config routing              # Auto-configure based on detection
 *   ax config routing --show       # Show current routing configuration
 *   ax config routing --reset      # Reset to auto-detected defaults
 *   ax config routing --dry-run    # Show what would change without applying
 *   ax config routing --agent <n>  # Show affinity for specific agent
 *   ax config routing --ability <t># Show routing for specific ability type
 *   ax config routing --optimizer  # Show dynamic optimizer stats (v14.0.0)
 */

import type { CommandModule } from 'yargs';
import { resolve } from 'path';
import { access } from 'fs/promises';
import { constants } from 'fs';
import chalk from 'chalk';
import { logger } from '../../shared/logging/logger.js';
import { printError } from '../../shared/errors/error-formatter.js';
import { RoutingConfigurator } from '../../core/routing-configurator.js';
import { loadConfigFile } from '../../core/config/loader.js';
import { getDynamicOptimizer, resetDynamicOptimizer } from '../../core/router/dynamic-optimizer.js';

interface ConfigRoutingOptions {
  show?: boolean;
  reset?: boolean;
  dryRun?: boolean;
  json?: boolean;
  verbose?: boolean;
  agent?: string;    // v13.1.0: Show affinity for specific agent
  ability?: string;  // v13.2.0: Show routing for specific ability type
  optimizer?: boolean; // v14.0.0: Show dynamic optimizer stats
}

/**
 * Routing subcommand for config command
 * Exported as nested command to be registered inside configCommand builder
 */
export const routingSubcommand: CommandModule<Record<string, unknown>, ConfigRoutingOptions> = {
  command: 'routing',
  describe: 'Configure provider routing based on installed providers',

  builder: (yargs) => {
    return yargs
      .option('show', {
        alias: 's',
        describe: 'Show current routing configuration',
        type: 'boolean',
        default: false,
      })
      .option('reset', {
        alias: 'r',
        describe: 'Reset routing to auto-detected defaults',
        type: 'boolean',
        default: false,
      })
      .option('dry-run', {
        alias: 'd',
        describe: 'Show changes without applying them',
        type: 'boolean',
        default: false,
      })
      .option('json', {
        describe: 'Output in JSON format',
        type: 'boolean',
        default: false,
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Show detailed output',
        type: 'boolean',
        default: false,
      })
      .option('agent', {
        alias: 'a',
        describe: 'Show affinity configuration for a specific agent',
        type: 'string',
      })
      .option('ability', {
        describe: 'Show routing configuration for a specific ability type',
        type: 'string',
      })
      .option('optimizer', {
        alias: 'o',
        describe: 'Show dynamic optimizer statistics (v14.0.0)',
        type: 'boolean',
        default: false,
      })
      .example('$0 config routing', 'Auto-configure routing based on detection')
      .example('$0 config routing --show', 'Show current routing configuration')
      .example('$0 config routing --reset', 'Reset to auto-detected defaults')
      .example('$0 config routing --dry-run', 'Preview changes without applying')
      .example('$0 config routing --agent backend', 'Show backend agent affinity')
      .example('$0 config routing --ability code-generation', 'Show code-generation routing')
      .example('$0 config routing --optimizer', 'Show dynamic optimizer stats');
  },

  handler: async (argv) => {
    try {
      // Resolve config path
      const configPath = await resolveConfigPath();

      if (!configPath) {
        console.log(chalk.yellow('⚠️  Configuration file not found'));
        console.log(chalk.gray('   Run "ax setup" to create configuration\n'));
        process.exit(1);
      }

      // Handle --show flag
      if (argv.show) {
        await showRoutingConfig(configPath, argv.json || false, argv.verbose || false);
        return;
      }

      // Handle --agent flag: show affinity for specific agent
      if (argv.agent) {
        await showAgentAffinity(configPath, argv.agent, argv.json || false);
        return;
      }

      // Handle --ability flag: show routing for specific ability type
      if (argv.ability) {
        await showAbilityRouting(configPath, argv.ability, argv.json || false);
        return;
      }

      // Handle --optimizer flag: show dynamic optimizer stats
      if (argv.optimizer) {
        await showOptimizerStats(argv.json || false, argv.verbose || false);
        return;
      }

      // Detect and configure
      const configurator = new RoutingConfigurator();

      console.log(chalk.cyan('🔍 Detecting provider capabilities...\n'));
      await configurator.detectCapabilities();

      const recommendation = configurator.generateRecommendation();

      // Handle no providers case
      if (Object.keys(recommendation.providers).length === 0) {
        console.log(chalk.yellow('⚠️  No providers detected\n'));
        for (const line of recommendation.rationale) {
          console.log(chalk.gray(`   ${line}`));
        }
        console.log();
        process.exit(1);
      }

      // Show report
      if (argv.json) {
        console.log(JSON.stringify(recommendation, null, 2));
      } else {
        console.log(chalk.cyan('📊 Provider Routing Recommendation:\n'));
        const report = configurator.generateReport(recommendation);
        for (const line of report.split('\n')) {
          console.log(`   ${line}`);
        }
        console.log();
      }

      // Apply or dry-run
      if (argv.dryRun) {
        console.log(chalk.yellow('🔍 Dry-run mode - no changes applied\n'));

        const { changes } = await configurator.applyRecommendation(
          configPath,
          recommendation,
          { dryRun: true, preserveCustomizations: !argv.reset }
        );

        if (changes.length > 0) {
          console.log(chalk.cyan('Changes that would be applied:'));
          for (const change of changes) {
            console.log(chalk.gray(`   • ${change}`));
          }
        } else {
          console.log(chalk.gray('   No changes needed'));
        }
        console.log();
      } else {
        const { applied, changes } = await configurator.applyRecommendation(
          configPath,
          recommendation,
          { preserveCustomizations: !argv.reset }
        );

        if (applied) {
          console.log(chalk.green(`✓ Provider routing configured (${changes.length} changes)\n`));

          if (argv.verbose && changes.length > 0) {
            console.log(chalk.gray('Changes applied:'));
            for (const change of changes) {
              console.log(chalk.gray(`   • ${change}`));
            }
            console.log();
          }
        } else {
          console.log(chalk.yellow('⚠️  Routing configuration preserved'));
          console.log(chalk.gray('   Use --reset to override existing configuration\n'));
        }
      }

      logger.info('Config routing command completed', {
        dryRun: argv.dryRun,
        reset: argv.reset,
        providers: Object.keys(recommendation.providers).length,
      });

    } catch (error) {
      printError(error, {
        verbose: argv.verbose || false,
        showCode: true,
        showSuggestions: true,
        colors: true,
      });
      logger.error('Config routing command failed', { error: (error as Error).message });
      process.exit(1);
    }
  },
};

/**
 * Resolve configuration file path
 */
async function resolveConfigPath(): Promise<string | null> {
  // Check in priority order
  const candidates = [
    resolve(process.cwd(), 'ax.config.json'),
    resolve(process.cwd(), '.automatosx', 'config.json'),
  ];

  for (const path of candidates) {
    try {
      await access(path, constants.F_OK);
      return path;
    } catch {
      // Try next
    }
  }

  return null;
}

/**
 * Show current routing configuration
 */
async function showRoutingConfig(
  configPath: string,
  json: boolean,
  verbose: boolean
): Promise<void> {
  const config = await loadConfigFile(configPath);

  // Extract routing-related info
  const routingInfo = {
    providers: Object.entries(config.providers).map(([name, provider]) => ({
      name,
      enabled: provider.enabled,
      priority: provider.priority,
      command: provider.command,
    })).sort((a, b) => a.priority - b.priority),
    router: config.router,
  };

  if (json) {
    console.log(JSON.stringify(routingInfo, null, 2));
    return;
  }

  console.log(chalk.bold.cyan('\n📊 Current Provider Routing Configuration\n'));

  // Provider priorities
  console.log(chalk.bold('Provider Priorities:'));
  for (const p of routingInfo.providers) {
    const status = p.enabled ? chalk.green('✓') : chalk.gray('✗');
    const priority = chalk.yellow(`[${p.priority}]`);
    console.log(`   ${status} ${priority} ${p.name}`);
  }
  console.log();

  // Router config
  if (routingInfo.router) {
    console.log(chalk.bold('Router Settings:'));

    if (routingInfo.router.healthCheckInterval) {
      console.log(chalk.gray(`   • Health check interval: ${routingInfo.router.healthCheckInterval}ms`));
    }
    if (routingInfo.router.providerCooldownMs) {
      console.log(chalk.gray(`   • Provider cooldown: ${routingInfo.router.providerCooldownMs}ms`));
    }
    if (routingInfo.router.enableFreeTierPrioritization !== undefined) {
      const status = routingInfo.router.enableFreeTierPrioritization ? 'enabled' : 'disabled';
      console.log(chalk.gray(`   • Free tier prioritization: ${status}`));
    }

    // Auto-configured routing
    const routing = routingInfo.router.routing;
    if (routing) {
      console.log();
      console.log(chalk.bold('Auto-Configured Routing:'));
      console.log(chalk.gray(`   • Auto-configured: ${routing.autoConfigured ? 'yes' : 'no'}`));
      if (routing.lastConfiguredAt) {
        console.log(chalk.gray(`   • Last configured: ${routing.lastConfiguredAt}`));
      }
      if (routing.strategy) {
        console.log(chalk.gray(`   • Strategy: ${routing.strategy}`));
      }

      if (verbose && routing.agentAffinities) {
        console.log();
        console.log(chalk.bold('Agent Affinities:'));
        for (const [agent, affinity] of Object.entries(routing.agentAffinities)) {
          const fallback = affinity.fallback.length > 0
            ? ` → [${affinity.fallback.slice(0, 2).join(', ')}${affinity.fallback.length > 2 ? ', ...' : ''}]`
            : '';
          console.log(chalk.gray(`   • ${agent.padEnd(15)} → ${affinity.primary}${fallback}`));
        }
      }
    }

    console.log();
  }

  console.log(chalk.gray(`Config file: ${configPath}\n`));
}

/**
 * Show affinity configuration for a specific agent
 * v13.1.0: New feature to inspect agent-specific routing
 */
async function showAgentAffinity(
  configPath: string,
  agentName: string,
  json: boolean
): Promise<void> {
  const config = await loadConfigFile(configPath);
  const routing = config.router?.routing;

  if (!routing?.agentAffinities) {
    console.log(chalk.yellow('⚠️  No agent affinities configured'));
    console.log(chalk.gray('   Run "ax config routing" to auto-configure\n'));
    return;
  }

  const affinity = routing.agentAffinities[agentName];

  if (!affinity) {
    // Show similar agents as suggestions
    const knownAgents = Object.keys(routing.agentAffinities);
    const similar = knownAgents.filter(a =>
      a.includes(agentName) || agentName.includes(a)
    );

    console.log(chalk.yellow(`⚠️  No affinity configured for agent: ${agentName}\n`));

    if (similar.length > 0) {
      console.log(chalk.gray('   Did you mean:'));
      for (const s of similar) {
        console.log(chalk.gray(`     • ${s}`));
      }
      console.log();
    }

    console.log(chalk.gray('   Available agents:'));
    for (const agent of knownAgents.slice(0, 10)) {
      console.log(chalk.gray(`     • ${agent}`));
    }
    if (knownAgents.length > 10) {
      console.log(chalk.gray(`     ... and ${knownAgents.length - 10} more`));
    }
    console.log();
    return;
  }

  if (json) {
    console.log(JSON.stringify({ agent: agentName, ...affinity }, null, 2));
    return;
  }

  console.log(chalk.bold.cyan(`\n🎯 Agent Affinity: ${agentName}\n`));

  // Primary provider
  if (affinity.primary) {
    console.log(chalk.bold('Primary Provider:'));
    console.log(chalk.green(`   ✓ ${affinity.primary}`));
    console.log();
  } else {
    console.log(chalk.yellow('   No primary provider configured'));
    console.log();
  }

  // Fallback chain
  if (affinity.fallback.length > 0) {
    console.log(chalk.bold('Fallback Chain:'));
    affinity.fallback.forEach((provider, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${provider}`));
    });
    console.log();
  } else {
    console.log(chalk.gray('   No fallback providers configured'));
    console.log();
  }

  // Strategy info
  if (routing.strategy) {
    console.log(chalk.bold('Routing Strategy:'));
    console.log(chalk.gray(`   ${routing.strategy}`));
    console.log();
  }

  // Last configured
  if (routing.lastConfiguredAt) {
    console.log(chalk.gray(`Last configured: ${routing.lastConfiguredAt}`));
  }
  console.log(chalk.gray(`Config file: ${configPath}\n`));
}

/**
 * Known ability types for display
 * v13.2.0: Matches ABILITY_TYPES from ability-manager.ts
 */
const KNOWN_ABILITY_TYPES = [
  'code-generation',
  'code-review',
  'security-audit',
  'documentation',
  'data-analysis',
  'architecture',
  'testing',
  'devops',
  'research',
  'creative',
] as const;

/**
 * Default ability-to-provider mappings for display
 * v13.2.0: Matches DEFAULT_ABILITY_ROUTING from ability-manager.ts
 */
const DEFAULT_ABILITY_ROUTING: Record<string, string[]> = {
  'code-generation': ['claude-code', 'codex', 'qwen', 'gemini-cli'],
  'code-review': ['gemini-cli', 'claude-code', 'grok', 'codex'],
  'security-audit': ['claude-code', 'grok', 'codex'],
  'documentation': ['gemini-cli', 'claude-code', 'grok'],
  'data-analysis': ['gemini-cli', 'claude-code', 'grok', 'qwen'],
  'architecture': ['claude-code', 'gemini-cli', 'grok'],
  'testing': ['gemini-cli', 'claude-code', 'codex'],
  'devops': ['codex', 'claude-code', 'gemini-cli'],
  'research': ['grok', 'gemini-cli', 'claude-code'],
  'creative': ['grok', 'gemini-cli', 'claude-code'],
};

/**
 * Show routing configuration for a specific ability type
 * v13.2.0: New feature to inspect ability-specific routing
 */
async function showAbilityRouting(
  configPath: string,
  abilityType: string,
  json: boolean
): Promise<void> {
  const config = await loadConfigFile(configPath);
  const routing = config.router?.routing;

  // Check if it's a known ability type
  const isKnown = KNOWN_ABILITY_TYPES.includes(abilityType as typeof KNOWN_ABILITY_TYPES[number]);

  // Get configured routing (if any)
  const configuredRouting = routing?.abilityRouting?.[abilityType];

  // Get default routing (if ability is known)
  const defaultRouting = DEFAULT_ABILITY_ROUTING[abilityType];

  // Determine which routing to use
  const preferredProviders = configuredRouting?.preferredProviders ?? defaultRouting ?? [];
  const source: 'config' | 'default' | 'none' = configuredRouting
    ? 'config'
    : defaultRouting
      ? 'default'
      : 'none';

  if (json) {
    console.log(JSON.stringify({
      abilityType,
      isKnown,
      source,
      preferredProviders,
      hasRouting: preferredProviders.length > 0,
    }, null, 2));
    return;
  }

  // Handle unknown ability type
  if (!isKnown && !configuredRouting) {
    console.log(chalk.yellow(`⚠️  Unknown ability type: ${abilityType}\n`));

    // Show similar types as suggestions
    const similar = KNOWN_ABILITY_TYPES.filter(t =>
      t.includes(abilityType) || abilityType.includes(t)
    );

    if (similar.length > 0) {
      console.log(chalk.gray('   Did you mean:'));
      for (const s of similar) {
        console.log(chalk.gray(`     • ${s}`));
      }
      console.log();
    }

    console.log(chalk.gray('   Available ability types:'));
    for (const ability of KNOWN_ABILITY_TYPES) {
      console.log(chalk.gray(`     • ${ability}`));
    }
    console.log();
    return;
  }

  console.log(chalk.bold.cyan(`\n🎯 Ability Routing: ${abilityType}\n`));

  // Source
  console.log(chalk.bold('Source:'));
  if (source === 'config') {
    console.log(chalk.green('   ✓ Custom configuration'));
  } else if (source === 'default') {
    console.log(chalk.gray('   Default routing (no custom config)'));
  }
  console.log();

  // Preferred providers
  if (preferredProviders.length > 0) {
    console.log(chalk.bold('Preferred Providers (in order):'));
    preferredProviders.forEach((provider, index) => {
      const marker = index === 0 ? chalk.green('★') : chalk.gray(`${index + 1}.`);
      console.log(`   ${marker} ${provider}`);
    });
    console.log();
  } else {
    console.log(chalk.yellow('   No preferred providers configured'));
    console.log();
  }

  // Strategy info
  if (routing?.strategy) {
    console.log(chalk.bold('Routing Strategy:'));
    console.log(chalk.gray(`   ${routing.strategy}`));
    console.log();
  }

  // Last configured
  if (routing?.lastConfiguredAt) {
    console.log(chalk.gray(`Last configured: ${routing.lastConfiguredAt}`));
  }
  console.log(chalk.gray(`Config file: ${configPath}\n`));
}

/**
 * Show dynamic optimizer statistics
 * v14.0.0: New feature to inspect runtime optimization state
 */
async function showOptimizerStats(
  json: boolean,
  verbose: boolean
): Promise<void> {
  // Get or create optimizer instance
  const optimizer = getDynamicOptimizer();

  // Initialize if not already done
  await optimizer.initialize();

  const stats = optimizer.getStats();
  const costSummary = optimizer.getCostSummary();
  const adaptivePriorities = optimizer.getAdaptivePriorities();

  if (json) {
    console.log(JSON.stringify({
      enabled: true,
      ...stats,
      costSummary,
      adaptivePriorities,
    }, null, 2));

    // Cleanup
    resetDynamicOptimizer();
    return;
  }

  console.log(chalk.bold.cyan('\n⚡ Dynamic Optimizer Statistics (v14.0.0)\n'));

  // Basic status
  console.log(chalk.bold('Status:'));
  console.log(chalk.gray(`   • Initialized: ${stats.isInitialized ? chalk.green('yes') : chalk.yellow('no')}`));
  console.log(chalk.gray(`   • Providers tracked: ${stats.providersTracked}`));
  if (stats.lastOptimizationAt) {
    console.log(chalk.gray(`   • Last optimization: ${stats.lastOptimizationAt}`));
  }
  console.log();

  // Cost summary
  console.log(chalk.bold('Cost Summary:'));
  console.log(chalk.gray(`   • Total cost: $${costSummary.totalCostUsd.toFixed(4)}`));
  if (costSummary.topSpenders.length > 0) {
    console.log(chalk.gray('   • Top spenders:'));
    for (const spender of costSummary.topSpenders.slice(0, 5)) {
      console.log(chalk.gray(`       ${spender.provider}: $${spender.costUsd.toFixed(4)}`));
    }
  }
  console.log();

  // Adaptive priorities
  const priorityEntries = Object.entries(adaptivePriorities);
  if (priorityEntries.length > 0) {
    console.log(chalk.bold('Adaptive Priorities:'));
    const sorted = priorityEntries.sort((a, b) => b[1] - a[1]);
    for (const [provider, priority] of sorted) {
      const bar = '█'.repeat(Math.round(priority * 10));
      const color = priority > 0.7 ? chalk.green : priority > 0.4 ? chalk.yellow : chalk.red;
      console.log(chalk.gray(`   • ${provider.padEnd(15)} ${color(bar)} ${(priority * 100).toFixed(0)}%`));
    }
    console.log();
  }

  // Performance snapshots (if verbose)
  if (verbose && stats.providersTracked > 0) {
    console.log(chalk.bold('Performance Snapshots:'));
    const providers = Object.keys(adaptivePriorities);
    for (const providerName of providers) {
      const snapshot = await optimizer.getPerformanceSnapshot(providerName);
      if (snapshot) {
        console.log(chalk.gray(`   ${providerName}:`));
        console.log(chalk.gray(`       Avg latency: ${snapshot.latency.avg.toFixed(0)}ms (p95: ${snapshot.latency.p95.toFixed(0)}ms)`));
        console.log(chalk.gray(`       Success rate: ${(snapshot.successRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`       Quality score: ${(snapshot.qualityScore * 100).toFixed(1)}%`));
        console.log(chalk.gray(`       Last updated: ${snapshot.lastUpdatedAt}`));
      }
    }
    console.log();
  }

  // Recommendations
  const providers = Object.keys(adaptivePriorities);
  if (providers.length > 0) {
    const recommendations = await optimizer.generateRecommendations(providers);
    if (recommendations.length > 0) {
      console.log(chalk.bold('Recommendations:'));
      for (const rec of recommendations.slice(0, 5)) {
        const icon = rec.impact === 'high' ? chalk.red('⚠️')
          : rec.impact === 'medium' ? chalk.yellow('⚡')
          : chalk.gray('ℹ️');
        console.log(`   ${icon} [${rec.provider}] ${rec.reason}`);
        console.log(chalk.gray(`      Type: ${rec.type}, Recommended: ${rec.recommendedValue}`));
      }
      console.log();
    }
  }

  console.log(chalk.gray('Note: Stats are from the current session. Use --verbose for detailed performance data.\n'));

  // Cleanup
  resetDynamicOptimizer();
}
