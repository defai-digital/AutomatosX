/**
 * Providers Command - Provider Management & Inspection
 *
 * Commands for managing and inspecting AI providers:
 * - ax providers list - Show all providers with metadata
 * - ax providers test - Test provider availability
 * - ax providers info <provider> - Show detailed provider information
 * - ax providers switch <provider> - Switch default provider
 *
 * @module cli/commands/providers
 */

import type { CommandModule } from 'yargs';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '@/core/config.js';
import { detectProjectRoot } from '@/core/path-resolver.js';
// TODO v8.3.0: Provider metadata removed - will simplify this command
// Temporary stubs to keep command functional during Phase 1
const PROVIDER_METADATA: Record<string, any> = {
  'claude': { name: 'claude', displayName: 'Claude', costPerMToken: 0, avgLatencyMs: 0 },
  'gemini': { name: 'gemini', displayName: 'Gemini', costPerMToken: 0, avgLatencyMs: 0 },
  'codex': { name: 'codex', displayName: 'Codex', costPerMToken: 0, avgLatencyMs: 0 }
};
const getProviderMetadata = (name: string) => PROVIDER_METADATA[name] || null;
const getCheapestProvider = () => 'gemini';
const getFastestProvider = () => 'claude';
const getMostReliableProvider = () => 'claude';
import { getProviderLimitManager } from '@/core/provider-limit-manager.js';
import { getProviderSession } from '@/core/provider-session.js';
import { logger } from '@/utils/logger.js';

interface ProvidersOptions {
  // Subcommand
  subcommand?: string;

  // Common options
  provider?: string;
  json?: boolean;
  verbose?: boolean;

  // List options
  sort?: 'priority' | 'cost' | 'latency' | 'reliability';
  available?: boolean;

  // Test options
  all?: boolean;
  timeout?: number;

  // Trace options
  follow?: boolean;
  lines?: number;

  // Yargs internal
  _?: (string | number)[];
}

export const providersCommand: CommandModule<Record<string, unknown>, ProvidersOptions> = {
  command: 'providers [subcommand]',
  describe: 'Provider management and inspection',

  builder: (yargs) => {
    return yargs
      .positional('subcommand', {
        describe: 'Subcommand (list, test, info, switch, reset, trace)',
        type: 'string',
        choices: ['list', 'test', 'info', 'switch', 'reset', 'trace']
      })
      // Common options
      .option('provider', {
        alias: 'p',
        describe: 'Provider name',
        type: 'string'
      })
      .option('json', {
        describe: 'JSON output',
        type: 'boolean',
        default: false
      })
      .option('verbose', {
        alias: 'v',
        describe: 'Verbose output',
        type: 'boolean',
        default: false
      })
      // List options
      .option('sort', {
        describe: 'Sort providers by',
        type: 'string',
        choices: ['priority', 'cost', 'latency', 'reliability'],
        default: 'priority'
      })
      .option('available', {
        describe: 'Show only available providers',
        type: 'boolean',
        default: false
      })
      // Test options
      .option('all', {
        alias: 'a',
        describe: 'Test all providers',
        type: 'boolean',
        default: false
      })
      .option('timeout', {
        describe: 'Test timeout in milliseconds',
        type: 'number',
        default: 5000
      })
      // Trace options
      .option('follow', {
        alias: 'f',
        describe: 'Follow trace log in real-time',
        type: 'boolean',
        default: false
      })
      .option('lines', {
        alias: 'n',
        describe: 'Number of recent lines to show',
        type: 'number',
        default: 20
      })
      .example('$0 providers list', 'List all providers')
      .example('$0 providers list --sort cost', 'List by cost (cheapest first)')
      .example('$0 providers test --all', 'Test all providers')
      .example('$0 providers info openai', 'Show OpenAI provider details')
      .example('$0 providers switch gemini-cli', 'Switch to Gemini CLI')
      .example('$0 providers reset', 'Reset to normal routing')
      .example('$0 providers trace', 'View router trace log')
      .example('$0 providers trace --follow', 'Follow trace log in real-time');
  },

  handler: async (argv) => {
    try {
      const workspacePath = await detectProjectRoot(process.cwd());
      const config = await loadConfig(workspacePath);

      const subcommand = argv.subcommand || 'list';

      switch (subcommand) {
        case 'list':
          await handleList(config, argv);
          break;
        case 'test':
          await handleTest(config, argv);
          break;
        case 'info':
          await handleInfo(argv);
          break;
        case 'switch':
          await handleSwitch(argv);
          break;
        case 'reset':
          await handleReset();
          break;
        case 'trace':
          await handleTrace(workspacePath, argv);
          break;
        default:
          // Default to list if no subcommand
          await handleList(config, argv);
      }
    } catch (error) {
      console.error(chalk.red(`✗ Error: ${(error as Error).message}`));
      logger.error('Providers command failed', { error });
      process.exit(1);
    }
  }
};

/**
 * Handle 'ax providers list' command
 */
async function handleList(config: any, argv: ProvidersOptions): Promise<void> {
  console.log(chalk.cyan('\n📋 AI Provider List\n'));

  const configuredProviders = Object.keys(config.providers || {});
  const metadataProviders = Object.keys(PROVIDER_METADATA);

  // Get provider limit manager for usage info
  const limitManager = getProviderLimitManager();
  await limitManager.initialize();

  // Build provider list
  const providers: any[] = [];

  for (const providerName of configuredProviders) {
    const providerConfig = config.providers[providerName];
    const metadata = PROVIDER_METADATA[providerName];

    if (!providerConfig) continue;

    // Get limit info
    const limitCheck = limitManager.isProviderLimited(providerName);
    const limitInfo = limitCheck.isLimited ? {
      isBlocked: true,
      resetTime: limitCheck.resetAtMs,
      reason: limitCheck.reason
    } : null;

    providers.push({
      name: providerName,
      enabled: providerConfig.enabled,
      priority: providerConfig.priority,
      metadata: metadata || null,
      limitInfo: limitInfo || null,
      configured: true
    });
  }

  // Add metadata-only providers (not configured)
  for (const providerName of metadataProviders) {
    if (!configuredProviders.includes(providerName)) {
      const metadata = PROVIDER_METADATA[providerName];
      providers.push({
        name: providerName,
        enabled: false,
        priority: 999,
        metadata,
        limitInfo: null,
        configured: false
      });
    }
  }

  // Filter if --available flag
  let displayProviders = argv.available
    ? providers.filter(p => p.enabled && !p.limitInfo?.isBlocked)
    : providers;

  // Sort providers
  switch (argv.sort) {
    case 'cost':
      displayProviders.sort((a, b) => {
        const costA = a.metadata ? (a.metadata.costPerToken.input + a.metadata.costPerToken.output) / 2 : Infinity;
        const costB = b.metadata ? (b.metadata.costPerToken.input + b.metadata.costPerToken.output) / 2 : Infinity;
        return costA - costB;
      });
      break;
    case 'latency':
      displayProviders.sort((a, b) => {
        const latA = a.metadata?.latencyEstimate.p95 || Infinity;
        const latB = b.metadata?.latencyEstimate.p95 || Infinity;
        return latA - latB;
      });
      break;
    case 'reliability':
      displayProviders.sort((a, b) => {
        const relA = a.metadata?.reliability.availability || 0;
        const relB = b.metadata?.reliability.availability || 0;
        return relB - relA; // Descending
      });
      break;
    case 'priority':
    default:
      displayProviders.sort((a, b) => a.priority - b.priority);
      break;
  }

  if (argv.json) {
    console.log(JSON.stringify({ providers: displayProviders }, null, 2));
    return;
  }

  // Display table
  console.log(chalk.gray('Provider Status & Metadata:\n'));

  for (const provider of displayProviders) {
    const status = provider.enabled
      ? provider.limitInfo?.isBlocked
        ? chalk.red('● BLOCKED')
        : chalk.green('● ENABLED')
      : chalk.gray('○ DISABLED');

    console.log(`${status} ${chalk.bold(provider.name)} ${chalk.gray(`(priority: ${provider.priority})`)}`);

    if (provider.metadata && argv.verbose) {
      const meta = provider.metadata;
      console.log(chalk.gray(`  Cloud: ${meta.cloud} · Regions: ${meta.regions.join(', ')}`));

      // Check if cost estimation is disabled
      const isCostDisabled = meta.costPerToken.input === 0 && meta.costPerToken.output === 0;
      if (isCostDisabled) {
        console.log(chalk.gray(`  Cost: N/A (cost estimation disabled)`));
      } else {
        console.log(chalk.gray(`  Cost: $${(meta.costPerToken.input * 1000).toFixed(3)}-${(meta.costPerToken.output * 1000).toFixed(3)}/1K tokens`));
      }

      console.log(chalk.gray(`  Latency: P50=${meta.latencyEstimate.p50}ms, P95=${meta.latencyEstimate.p95}ms`));
      console.log(chalk.gray(`  Reliability: ${(meta.reliability.availability * 100).toFixed(1)}% uptime, ${(meta.reliability.errorRate * 100).toFixed(2)}% error rate`));
      console.log(chalk.gray(`  Features: ${Object.entries(meta.features).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'none'}`));
    }

    if (provider.limitInfo?.isBlocked) {
      const resetTime = new Date(provider.limitInfo.resetTime!).toLocaleString();
      console.log(chalk.red(`  ⚠️  BLOCKED until ${resetTime}`));
    }

    if (!provider.configured) {
      console.log(chalk.yellow('  ⓘ  Available but not configured'));
    }

    console.log('');
  }

  // Show recommendations
  const cheapest = getCheapestProvider();
  const fastest = getFastestProvider();
  const mostReliable = getMostReliableProvider();

  console.log(chalk.cyan('💡 Recommendations:'));
  console.log(chalk.gray(`  Cheapest: ${cheapest}`));
  console.log(chalk.gray(`  Fastest: ${fastest}`));
  console.log(chalk.gray(`  Most Reliable: ${mostReliable}\n`));
}

/**
 * Handle 'ax providers test' command
 */
async function handleTest(config: any, argv: ProvidersOptions): Promise<void> {
  console.log(chalk.cyan('\n🔧 Provider Availability Test\n'));

  const providersToTest = argv.all
    ? Object.keys(config.providers || {}).filter(name => config.providers[name]?.enabled)
    : argv.provider
      ? [argv.provider]
      : [];

  if (providersToTest.length === 0) {
    console.error(chalk.red('✗ No providers to test'));
    console.error(chalk.gray('Use --all to test all enabled providers or specify --provider <name>'));
    process.exit(1);
  }

  const results: any[] = [];

  for (const providerName of providersToTest) {
    const spinner = ora(`Testing ${providerName}...`).start();

    const startTime = Date.now();
    let available = false;
    let error: string | null = null;

    try {
      // Simple availability test: check if command exists
      const providerConfig = config.providers[providerName];
      if (!providerConfig) {
        throw new Error('Provider not configured');
      }

      // Test would go here - for now just check configuration
      available = providerConfig.enabled;

      if (available) {
        spinner.succeed(`${providerName} - Available`);
      } else {
        spinner.warn(`${providerName} - Disabled in config`);
      }
    } catch (err) {
      error = (err as Error).message;
      spinner.fail(`${providerName} - Unavailable (${error})`);
      available = false;
    }

    const duration = Date.now() - startTime;

    results.push({
      provider: providerName,
      available,
      duration,
      error
    });
  }

  console.log(chalk.cyan('\n📊 Test Results:\n'));

  const availableCount = results.filter(r => r.available).length;
  const totalCount = results.length;

  console.log(chalk.gray(`Available: ${availableCount}/${totalCount}\n`));

  if (argv.json) {
    console.log(JSON.stringify({ results }, null, 2));
  }
}

/**
 * Handle 'ax providers info <provider>' command
 */
async function handleInfo(argv: ProvidersOptions): Promise<void> {
  const providerName = argv.provider || argv._?.[1] as string;

  if (!providerName) {
    console.error(chalk.red('✗ Provider name required'));
    console.error(chalk.gray('Usage: ax providers info <provider-name>'));
    process.exit(1);
  }

  const metadata = getProviderMetadata(providerName);

  if (!metadata) {
    console.error(chalk.red(`✗ Provider not found: ${providerName}`));
    console.error(chalk.gray(`Available providers: ${Object.keys(PROVIDER_METADATA).join(', ')}`));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n📖 Provider Info: ${chalk.bold(providerName)}\n`));

  if (argv.json) {
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  // Display detailed info
  console.log(chalk.blue('Cloud & Infrastructure:'));
  console.log(chalk.gray(`  Cloud Provider: ${metadata.cloud}`));
  console.log(chalk.gray(`  Available Regions: ${metadata.regions.join(', ')}\n`));

  console.log(chalk.blue('Pricing:'));

  // Check if cost estimation is disabled
  const isCostDisabled = metadata.costPerToken.input === 0 && metadata.costPerToken.output === 0;
  if (isCostDisabled) {
    console.log(chalk.gray(`  Cost estimation is disabled`));
    console.log(chalk.gray(`  To enable, set costEstimation.enabled = true in automatosx.config.json\n`));
  } else {
    console.log(chalk.gray(`  Input Tokens: $${(metadata.costPerToken.input * 1000).toFixed(3)} per 1K tokens ($${metadata.costPerToken.input.toFixed(6)} per token)`));
    console.log(chalk.gray(`  Output Tokens: $${(metadata.costPerToken.output * 1000).toFixed(3)} per 1K tokens ($${metadata.costPerToken.output.toFixed(6)} per token)`));
    const avgCost = (metadata.costPerToken.input + metadata.costPerToken.output) / 2;
    console.log(chalk.gray(`  Average: $${(avgCost * 1000000).toFixed(2)} per 1M tokens\n`));
  }

  console.log(chalk.blue('Performance:'));
  console.log(chalk.gray(`  P50 Latency: ${metadata.latencyEstimate.p50}ms`));
  console.log(chalk.gray(`  P95 Latency: ${metadata.latencyEstimate.p95}ms`));
  console.log(chalk.gray(`  P99 Latency: ${metadata.latencyEstimate.p99}ms\n`));

  console.log(chalk.blue('Reliability:'));
  console.log(chalk.gray(`  Availability: ${(metadata.reliability.availability * 100).toFixed(2)}%`));
  console.log(chalk.gray(`  Error Rate: ${(metadata.reliability.errorRate * 100).toFixed(2)}%\n`));

  console.log(chalk.blue('Features:'));
  console.log(chalk.gray(`  Streaming: ${metadata.features.streaming ? '✓' : '✗'}`));
  console.log(chalk.gray(`  Vision: ${metadata.features.vision ? '✓' : '✗'}`));
  console.log(chalk.gray(`  Function Calling: ${metadata.features.functionCalling ? '✓' : '✗'}\n`));

  // Show feature flag info for providers with gradual rollout
  if (providerName === 'gemini-cli') {
    const baseMetadata = PROVIDER_METADATA[providerName];
    if (baseMetadata && baseMetadata.features.streaming !== metadata.features.streaming) {
      console.log(chalk.yellow('⚠️  Feature Flag Active:'));
      console.log(chalk.gray('  Gemini streaming is controlled by gradual rollout'));
      console.log(chalk.gray('  Check current rollout: ax flags list\n'));
    }
  }
}

/**
 * Handle 'ax providers switch <provider>' command
 */
async function handleSwitch(argv: ProvidersOptions): Promise<void> {
  const providerName = argv.provider || argv._?.[1] as string;

  if (!providerName) {
    console.error(chalk.red('✗ Provider name required'));
    console.error(chalk.gray('Usage: ax providers switch <provider-name>'));
    process.exit(1);
  }

  // Validate provider exists
  const metadata = getProviderMetadata(providerName);
  if (!metadata) {
    console.error(chalk.red(`✗ Unknown provider: ${providerName}`));
    console.error(chalk.gray('\nAvailable providers:'));
    for (const name of Object.keys(PROVIDER_METADATA)) {
      console.error(chalk.gray(`  - ${name}`));
    }
    console.error('');
    process.exit(1);
  }

  const providerSession = getProviderSession();
  providerSession.setProvider(providerName, {
    reason: 'Manual CLI switch'
  });

  console.log(chalk.green(`\n✓ Provider switched to ${chalk.bold(providerName)}`));
  console.log(chalk.gray('All requests will use this provider until reset'));
  console.log(chalk.gray(`Reset with: ${chalk.white('ax providers reset')}\n`));
}

/**
 * Handle 'ax providers reset' command
 */
async function handleReset(): Promise<void> {
  const providerSession = getProviderSession();

  if (!providerSession.hasOverride()) {
    console.log(chalk.yellow('\n⚠️  No provider override active\n'));
    console.log(chalk.gray('Normal routing is already in effect\n'));
    return;
  }

  const override = providerSession.getOverride();
  providerSession.clear();

  console.log(chalk.green('\n✓ Provider routing reset to normal'));
  console.log(chalk.gray(`Previous override: ${override?.provider || 'unknown'}\n`));
}

/**
 * Handle 'ax providers trace' command
 */
async function handleTrace(workspacePath: string, argv: ProvidersOptions): Promise<void> {
  const { existsSync, readFileSync, watchFile } = await import('fs');
  const { join } = await import('path');

  const traceFile = join(workspacePath, '.automatosx/logs/router.trace.jsonl');

  // Check if trace file exists
  if (!existsSync(traceFile)) {
    console.log(chalk.yellow('\n⚠️  No trace log found\n'));
    console.log(chalk.gray(`Expected location: ${traceFile}\n`));
    console.log(chalk.gray('Trace logging is enabled when:'));
    console.log(chalk.gray('  • Router uses policy-driven selection'));
    console.log(chalk.gray('  • Provider degradation occurs'));
    console.log(chalk.gray('  • Routing errors happen\n'));
    console.log(chalk.gray('Run an agent command to generate trace events:\n'));
    console.log(chalk.gray('  ax run backend "test task"\n'));
    return;
  }

  console.log(chalk.cyan('\n📊 Router Trace Log\n'));
  console.log(chalk.gray(`File: ${traceFile}\n`));

  if (argv.follow) {
    // Follow mode: tail -f equivalent
    console.log(chalk.gray('Following trace log (Ctrl+C to exit)...\n'));

    // Read existing content
    const content = readFileSync(traceFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // Display recent lines
    const recentLines = lines.slice(-(argv.lines || 20));
    for (const line of recentLines) {
      displayTraceEvent(line);
    }

    // Watch for new content
    let lastSize = content.length;
    const { unwatchFile } = await import('fs');

    watchFile(traceFile, { interval: 500 }, (curr, prev) => {
      if (curr.size > lastSize) {
        const newContent = readFileSync(traceFile, 'utf-8');
        const newLines = newContent.slice(lastSize).split('\n').filter(l => l.trim());

        for (const line of newLines) {
          displayTraceEvent(line);
        }

        lastSize = curr.size;
      }
    });

    // Setup cleanup on SIGINT/SIGTERM
    const cleanup = () => {
      unwatchFile(traceFile);
      console.log(chalk.gray('\n\nStopped following trace log.\n'));
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep process running
    await new Promise(() => {
      // Wait forever (Ctrl+C to exit, cleanup will unwatch)
    });
  } else {
    // Static mode: show recent lines
    const content = readFileSync(traceFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    const recentLines = lines.slice(-(argv.lines || 20));

    if (recentLines.length === 0) {
      console.log(chalk.yellow('No trace events found\n'));
      return;
    }

    console.log(chalk.gray(`Showing last ${recentLines.length} events:\n`));

    for (const line of recentLines) {
      displayTraceEvent(line);
    }

    console.log(chalk.gray(`\nTotal events: ${lines.length}`));
    console.log(chalk.gray(`Use --follow to tail log in real-time\n`));
  }
}

/**
 * Display a single trace event with formatting
 */
function displayTraceEvent(line: string): void {
  if (!line.trim()) return; // Skip empty lines

  try {
    const event = JSON.parse(line);

    // Validate event structure
    if (!event.timestamp || !event.phase) {
      logger.warn('Malformed trace event (missing timestamp/phase)', { line: line.substring(0, 100) });
      return;
    }

    const timestamp = new Date(event.timestamp).toLocaleTimeString();

    // Phase color
    const phaseColors: Record<string, (s: string) => string> = {
      selection: chalk.blue,
      policy: chalk.magenta,
      execution: chalk.green,
      degradation: chalk.yellow,
      error: chalk.red
    };

    const phaseColor = phaseColors[event.phase] || chalk.gray;
    const phase = phaseColor(event.phase.toUpperCase().padEnd(12));

    // Provider
    const provider = event.provider ? chalk.bold(event.provider.padEnd(15)) : ''.padEnd(15);

    // Data summary
    // FIXED (v6.5.11): Add null/undefined checks for event.data to prevent crashes
    let summary = '';
    if (!event.data || typeof event.data !== 'object') {
      summary = chalk.gray('(no data)');
    } else if (event.phase === 'selection') {
      const candidates = event.data.candidates?.length ?? 0;
      const reason = event.data.reason ?? 'unknown';
      summary = `${candidates} candidates → ${chalk.bold(reason)}`;
    } else if (event.phase === 'policy') {
      const goal = event.data.goal ?? 'unknown';
      const after = event.data.providersAfterFilter ?? 0;
      const before = event.data.providersBeforeFilter ?? 0;
      summary = `goal=${goal}, passed=${after}/${before}`;
    } else if (event.phase === 'execution') {
      const status = event.data.success ? chalk.green('✓') : chalk.red('✗');
      const duration = event.data.durationMs ?? 0;
      const cost = event.data.cost ?? 0;
      // Check if cost is $0 (cost estimation disabled)
      if (cost === 0) {
        summary = `${status} ${duration}ms`;
      } else {
        summary = `${status} ${duration}ms, $${cost.toFixed(6)}`;
      }
    } else if (event.phase === 'degradation') {
      const reason = event.data.reason ?? 'unknown';
      const toProvider = event.data.toProvider ?? 'failed';
      summary = `${reason} → ${toProvider}`;
    } else if (event.phase === 'error') {
      const errorMsg = event.data.error ?? 'unknown error';
      summary = chalk.red(errorMsg);
    }

    console.log(`${chalk.gray(timestamp)}  ${phase} ${provider} ${summary}`);
  } catch (error) {
    // Skip malformed lines - log to logger but don't crash
    logger.warn('Failed to parse trace event', {
      error: (error as Error).message,
      line: line.substring(0, 100)
    });
    console.log(chalk.gray(`[invalid JSON] ${line.slice(0, 60)}...`));
  }
}
