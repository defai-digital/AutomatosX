/**
 * Status Command
 *
 * Display system health and status information with visual indicators.
 * Enhanced with sparklines, progress bars, and color-coded output.
 *
 * Usage:
 *   ax status                # Show visual system status
 *   ax status --verbose      # Show detailed status with metrics
 *   ax status --format json  # Output as JSON
 *   ax status --compact      # Compact single-line output
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { CLI_VERSION } from './help.js';
import {
  type SystemStatus,
  type ProviderStatus,
  type SystemHealthLevel,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from '@defai.digital/contracts';
import {
  createSessionManager,
  createSessionStore,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type SessionManager,
} from '@defai.digital/session-domain';
import {
  createPersistentAgentRegistry,
  getDefaultAgentStoragePath,
  type AgentRegistry,
} from '@defai.digital/agent-domain';
import { bootstrap, getProviderRegistry, getTraceStore } from '../bootstrap.js';
import { getCheckpointStorage } from '../utils/storage-instances.js';
import { COLORS, ICONS } from '../utils/terminal.js';

// Lazy-initialized singletons
let sessionManager: SessionManager | undefined;
let agentRegistry: AgentRegistry | undefined;

// Box drawing characters (horizontal used for header line)
const BOX_HORIZONTAL = '\u2500';

/**
 * Extended status with additional metrics
 */
interface ExtendedStatus extends SystemStatus {
  agents: { total: number; enabled: number };
  traces: { total: number; running: number; failed: number };
  memory: { usedMb: number; totalMb: number };
}

/**
 * Status command handler
 */
export async function statusCommand(
  _args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Initialize bootstrap to get SQLite storage
  await bootstrap();

  const isJsonFormat = options.format === 'json';
  const isCompact = options.compact;
  const showProgress = !isJsonFormat && !isCompact && process.stdout.isTTY;

  // Show progress message for interactive terminals
  if (showProgress) {
    const registry = getProviderRegistry();
    const providerCount = registry.getProviderIds().length;
    process.stdout.write(`\n${COLORS.cyan}Checking ${providerCount} providers (up to ${PROVIDER_HEALTH_CHECK_TIMEOUT / 1000}s each)...${COLORS.reset}`);
  }

  // Gather system status with progress updates
  const status = await gatherExtendedStatus(showProgress);

  // Clear the progress line
  if (showProgress) {
    process.stdout.write('\r\x1b[K'); // Clear line
  }

  // Format for JSON output
  if (isJsonFormat) {
    return {
      success: true,
      exitCode: status.status === 'unhealthy' ? 1 : 0,
      message: undefined,
      data: status,
    };
  }

  // Compact mode - single line output
  if (isCompact) {
    const icon = getStatusEmoji(status.status);
    const providerSummary = status.providers.filter((p: ProviderStatus) => p.available).length + '/' + status.providers.length;
    console.log(`${icon} AutomatosX ${status.version} | Providers: ${providerSummary} | Sessions: ${status.activeSessions} | Agents: ${status.agents.enabled}`);
    return {
      success: true,
      exitCode: status.status === 'unhealthy' ? 1 : 0,
      message: undefined,
      data: status,
    };
  }

  // Visual text output
  renderVisualStatus(status, options.verbose ?? false);

  return {
    success: true,
    exitCode: status.status === 'unhealthy' ? 1 : 0,
    message: undefined,
    data: status,
  };
}

/**
 * Render visual status display
 */
function renderVisualStatus(status: ExtendedStatus, verbose: boolean): void {
  const width = Math.min(process.stdout.columns || 80, 80);

  // Header
  console.log('');
  renderHeader('AutomatosX Status', width);
  console.log('');

  // Overall health indicator
  const healthBar = renderHealthBar(status.status);
  const healthColor = getHealthColor(status.status);
  console.log(`  ${healthColor}${COLORS.bold}${status.status.toUpperCase()}${COLORS.reset} ${healthBar}  v${status.version}  ${COLORS.dim}uptime: ${status.uptime}${COLORS.reset}`);
  console.log('');

  // Providers section with sparklines
  renderSectionHeader('Providers', width);
  if (status.providers.length === 0) {
    console.log(`  ${COLORS.dim}No providers configured${COLORS.reset}`);
  } else {
    for (const provider of status.providers) {
      renderProviderRow(provider);
    }
  }
  console.log('');

  // Quick metrics row
  renderSectionHeader('Metrics', width);
  const metricsLine = [
    `${COLORS.cyan}Sessions:${COLORS.reset} ${status.activeSessions}`,
    `${COLORS.cyan}Agents:${COLORS.reset} ${status.agents.enabled}/${status.agents.total}`,
    `${COLORS.cyan}Traces:${COLORS.reset} ${status.traces.total}`,
    `${COLORS.cyan}Checkpoints:${COLORS.reset} ${status.pendingCheckpoints}`,
  ].join('  ');
  console.log(`  ${metricsLine}`);

  // Memory usage bar (process heap)
  const memPercent = status.memory.totalMb > 0
    ? (status.memory.usedMb / status.memory.totalMb)
    : 0;
  const memBar = renderProgressBar(memPercent, 20);
  console.log(`  ${COLORS.cyan}Heap:${COLORS.reset}     ${memBar} ${status.memory.usedMb.toFixed(0)}/${status.memory.totalMb.toFixed(0)}MB`);
  console.log('');

  // Trace status if any running/failed
  if (status.traces.running > 0 || status.traces.failed > 0) {
    renderSectionHeader('Active Work', width);
    if (status.traces.running > 0) {
      console.log(`  ${COLORS.yellow}\u25cf${COLORS.reset} ${status.traces.running} trace(s) running`);
    }
    if (status.traces.failed > 0) {
      console.log(`  ${COLORS.red}\u2717${COLORS.reset} ${status.traces.failed} trace(s) failed recently`);
    }
    console.log('');
  }

  // Verbose details
  if (verbose) {
    renderSectionHeader('Details', width);
    console.log(`  ${COLORS.dim}Checked: ${status.checkedAt}${COLORS.reset}`);

    for (const provider of status.providers) {
      const icon = provider.available ? ICONS.check : ICONS.cross;
      console.log(`  ${icon} ${provider.providerId}`);
      if (provider.latencyMs !== undefined) {
        console.log(`      Latency: ${provider.latencyMs}ms`);
      }
      if (provider.errorRate !== undefined && provider.errorRate > 0) {
        console.log(`      Errors:  ${(provider.errorRate * 100).toFixed(1)}%`);
      }
      if (provider.circuitState && provider.circuitState !== 'closed') {
        console.log(`      Circuit: ${COLORS.yellow}${provider.circuitState}${COLORS.reset}`);
      }
    }
    console.log('');
  }

  // Footer hint
  console.log(`  ${COLORS.dim}Use 'ax monitor' for web dashboard, 'ax status --verbose' for details${COLORS.reset}`);
  console.log('');
}

/**
 * Render a section header
 */
function renderSectionHeader(title: string, _width: number): void {
  console.log(`  ${COLORS.bold}${COLORS.cyan}${title}${COLORS.reset}`);
}

/**
 * Render the main header
 */
function renderHeader(title: string, width: number): void {
  const time = new Date().toLocaleTimeString();
  const padding = width - title.length - time.length - 4;
  const line = BOX_HORIZONTAL.repeat(Math.max(0, padding));
  console.log(`${COLORS.cyan}${COLORS.bold}  ${title}${COLORS.reset} ${COLORS.dim}${line} ${time}${COLORS.reset}`);
}

/**
 * Render a provider status row with visual indicators
 */
function renderProviderRow(provider: ProviderStatus): void {
  const icon = provider.available
    ? `${COLORS.green}\u2713${COLORS.reset}`
    : `${COLORS.red}\u2717${COLORS.reset}`;

  const name = provider.providerId.padEnd(12);

  // Latency with color coding (adjusted for LLM response times)
  let latencyStr = '       -   ';
  if (provider.latencyMs !== undefined) {
    const latencyColor = provider.latencyMs < 2000 ? COLORS.green
      : provider.latencyMs < 5000 ? COLORS.yellow
      : COLORS.red;
    latencyStr = `${latencyColor}${String(provider.latencyMs).padStart(6)}ms${COLORS.reset}`;
  }

  // Circuit state indicator
  let circuitIndicator = '';
  if (provider.circuitState === 'open') {
    circuitIndicator = ` ${COLORS.red}[OPEN]${COLORS.reset}`;
  } else if (provider.circuitState === 'halfOpen') {
    circuitIndicator = ` ${COLORS.yellow}[HALF]${COLORS.reset}`;
  }

  // Error message for unavailable providers
  let errorStr = '';
  if (!provider.available && provider.error) {
    errorStr = ` ${COLORS.dim}(${provider.error})${COLORS.reset}`;
  }

  // Status indicator
  const statusIndicator = provider.available
    ? `${COLORS.green}\u25cf${COLORS.reset}`
    : `${COLORS.red}\u25cb${COLORS.reset}`;

  console.log(`  ${icon} ${name} ${latencyStr}  ${statusIndicator}${circuitIndicator}${errorStr}`);
}

/**
 * Render a health indicator bar
 */
function renderHealthBar(status: SystemHealthLevel): string {
  switch (status) {
    case 'healthy':
      return `${COLORS.green}\u2588\u2588\u2588\u2588\u2588${COLORS.reset}`;
    case 'degraded':
      return `${COLORS.yellow}\u2588\u2588\u2588${COLORS.dim}\u2591\u2591${COLORS.reset}`;
    case 'unhealthy':
      return `${COLORS.red}\u2588${COLORS.dim}\u2591\u2591\u2591\u2591${COLORS.reset}`;
  }
}

/**
 * Render a progress bar
 */
function renderProgressBar(percent: number, width: number): string {
  const filled = Math.round(percent * width);
  const empty = width - filled;

  const color = percent < 0.6 ? COLORS.green
    : percent < 0.8 ? COLORS.yellow
    : COLORS.red;

  const filledStr = '\u2588'.repeat(filled);
  const emptyStr = '\u2591'.repeat(empty);

  return `${color}${filledStr}${COLORS.dim}${emptyStr}${COLORS.reset}`;
}


/**
 * Get color for health status
 */
function getHealthColor(status: SystemHealthLevel): string {
  switch (status) {
    case 'healthy': return COLORS.green;
    case 'degraded': return COLORS.yellow;
    case 'unhealthy': return COLORS.red;
  }
}

/**
 * Get emoji for status (compact mode)
 */
function getStatusEmoji(status: SystemHealthLevel): string {
  switch (status) {
    case 'healthy': return `${COLORS.green}\u2713${COLORS.reset}`;
    case 'degraded': return `${COLORS.yellow}\u26A0${COLORS.reset}`;
    case 'unhealthy': return `${COLORS.red}\u2717${COLORS.reset}`;
  }
}

/**
 * Gather extended system status from all sources
 * @param showProgress - Whether to show real-time progress (for TTY)
 */
async function gatherExtendedStatus(showProgress = false): Promise<ExtendedStatus> {
  // Get sync memory stats immediately
  const memoryStats = getMemoryStats();

  // Run async status checks in parallel
  const [providers, activeSessions, pendingCheckpoints, agentStats, traceStats] = await Promise.all([
    getProviderStatus(showProgress),
    getActiveSessionCount(),
    getPendingCheckpointCount(),
    getAgentStats(),
    getTraceStats(),
  ]);

  // Determine overall health
  const allHealthy = providers.length === 0 || providers.every((p) => p.available);
  const someHealthy = providers.some((p) => p.available);

  let status: SystemHealthLevel = 'healthy';
  if (providers.length > 0) {
    if (!allHealthy && someHealthy) {
      status = 'degraded';
    } else if (!someHealthy) {
      status = 'unhealthy';
    }
  }

  return {
    status,
    providers,
    activeSessions,
    pendingCheckpoints,
    uptime: formatUptime(process.uptime()),
    version: CLI_VERSION,
    checkedAt: new Date().toISOString(),
    agents: agentStats,
    traces: traceStats,
    memory: memoryStats,
  };
}

/** Timeout for provider health check (30 seconds) */
export const PROVIDER_HEALTH_CHECK_TIMEOUT = 30000;

/** Test prompt for health check */
const HEALTH_CHECK_PROMPT = 'hello';

/** Check if running in test environment */
const IS_TEST_ENV = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

/**
 * Get provider status from provider registry
 * Tests each provider by sending a "hello" prompt with timeout
 * In test environment, only checks CLI availability (no actual LLM calls)
 * @param showProgress - Whether to show real-time progress
 */
export async function getProviderStatus(showProgress = false): Promise<ProviderStatus[]> {
  try {
    const registry = getProviderRegistry();
    const providerIds = registry.getProviderIds();

    // Always check in parallel for speed
    if (showProgress && !IS_TEST_ENV) {
      // Track completion progress
      let completed = 0;
      const total = providerIds.length;

      // Show initial progress
      process.stdout.write(`\r\x1b[K${COLORS.cyan}Checking ${total} providers in parallel...${COLORS.reset}`);

      // Start all checks in parallel, update progress as each completes
      const results = await Promise.all(
        providerIds.map(async (providerId) => {
          const result = await checkSingleProvider(providerId, registry);
          completed++;
          // Update progress
          process.stdout.write(`\r\x1b[K${COLORS.cyan}[${completed}/${total}] Provider checks completed...${COLORS.reset}`);
          return result;
        })
      );

      return results.filter((r): r is ProviderStatus => r !== null);
    } else {
      // Parallel check without progress display
      const results = await Promise.all(
        providerIds.map((providerId) => checkSingleProvider(providerId, registry))
      );
      return results.filter((r): r is ProviderStatus => r !== null);
    }
  } catch {
    return [];
  }
}

/**
 * Check a single provider's health status
 */
async function checkSingleProvider(
  providerId: string,
  registry: ReturnType<typeof getProviderRegistry>
): Promise<ProviderStatus | null> {
  const provider = registry.get(providerId);
  if (provider === undefined) return null;

  // First check if CLI is available
  const startTime = Date.now();
  const cliAvailable = await provider.isAvailable();
  const cliCheckLatency = Date.now() - startTime;

  if (!cliAvailable) {
    return {
      providerId,
      available: false,
      latencyMs: undefined,
      errorRate: undefined,
      circuitState: 'closed',
      error: 'CLI not installed',
    };
  }

  // In test environment, just check CLI availability (no actual LLM calls)
  if (IS_TEST_ENV) {
    return {
      providerId,
      available: true,
      latencyMs: cliCheckLatency,
      errorRate: undefined,
      circuitState: 'closed',
    };
  }

  // Test with actual prompt
  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), PROVIDER_HEALTH_CHECK_TIMEOUT);
    });

    // Race between completion and timeout
    const response = await Promise.race([
      provider.complete({
        requestId: `health-check-${providerId}-${Date.now()}`,
        model: 'default',
        messages: [{ role: 'user', content: HEALTH_CHECK_PROMPT }],
      }),
      timeoutPromise,
    ]);

    const latencyMs = Date.now() - startTime;

    if (response.success) {
      return {
        providerId,
        available: true,
        latencyMs,
        errorRate: undefined,
        circuitState: 'closed',
      };
    } else {
      return {
        providerId,
        available: false,
        latencyMs,
        errorRate: undefined,
        circuitState: 'closed',
        error: response.error?.message ?? 'Unknown error',
      };
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.message === 'timeout';

    return {
      providerId,
      available: false,
      latencyMs: isTimeout ? undefined : latencyMs,
      errorRate: undefined,
      circuitState: 'closed',
      error: isTimeout
        ? `No response within ${PROVIDER_HEALTH_CHECK_TIMEOUT / 1000} seconds`
        : (err instanceof Error ? err.message : 'Unknown error'),
    };
  }
}

/**
 * Get or create the session manager instance
 */
function getSessionManager(): SessionManager {
  if (sessionManager === undefined) {
    const store = createSessionStore();
    sessionManager = createSessionManager(store, DEFAULT_SESSION_DOMAIN_CONFIG);
  }
  return sessionManager;
}

/**
 * Get active session count from session-domain
 */
async function getActiveSessionCount(): Promise<number> {
  try {
    const manager = getSessionManager();
    return await manager.countActiveSessions();
  } catch {
    // If session-domain fails, return 0 gracefully
    return 0;
  }
}

/**
 * Get pending checkpoint count from agent-execution
 * Counts all checkpoints in storage
 */
async function getPendingCheckpointCount(): Promise<number> {
  try {
    const storage = getCheckpointStorage();
    // List all checkpoints (using wildcard for all agents)
    const checkpoints = await storage.list('*');
    return checkpoints.length;
  } catch {
    return 0;
  }
}

/**
 * Get or create the agent registry instance
 */
function getAgentRegistryInstance(): AgentRegistry {
  if (agentRegistry === undefined) {
    agentRegistry = createPersistentAgentRegistry({
      storagePath: getDefaultAgentStoragePath(),
    });
  }
  return agentRegistry;
}

/**
 * Get agent statistics
 */
async function getAgentStats(): Promise<{ total: number; enabled: number }> {
  try {
    const registry = getAgentRegistryInstance();
    const agents = await registry.list();
    const enabled = agents.filter((a) => a.enabled !== false).length;
    return { total: agents.length, enabled };
  } catch {
    return { total: 0, enabled: 0 };
  }
}

/**
 * Get trace statistics
 */
async function getTraceStats(): Promise<{ total: number; running: number; failed: number }> {
  try {
    const traceStore = getTraceStore();
    const traces = await traceStore.listTraces(50);
    const running = traces.filter((t) => t.status === 'running').length;
    const failed = traces.filter((t) => t.status === 'failure').length;
    return { total: traces.length, running, failed };
  } catch {
    return { total: 0, running: 0, failed: 0 };
  }
}

/**
 * Get memory statistics
 */
function getMemoryStats(): { usedMb: number; totalMb: number } {
  const memUsage = process.memoryUsage();
  const usedMb = memUsage.heapUsed / (1024 * 1024);
  const totalMb = memUsage.heapTotal / (1024 * 1024);
  return { usedMb, totalMb };
}

/**
 * Format uptime in seconds to human-readable string
 */
function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = Math.floor(totalSeconds % SECONDS_PER_MINUTE);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}
