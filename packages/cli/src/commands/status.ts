/**
 * Status Command
 *
 * Display system health and status information.
 * Aggregates health data from providers, sessions, and checkpoints.
 *
 * Usage:
 *   ax status                # Show system status
 *   ax status --verbose      # Show detailed status
 *   ax status --format=json  # Output as JSON
 */

import type { CommandResult, CLIOptions } from '../types.js';
import { CLI_VERSION } from './help.js';
import {
  type SystemStatus,
  type ProviderStatus,
  type SystemHealthLevel,
} from '@defai.digital/contracts';
import {
  createSessionManager,
  createSessionStore,
  DEFAULT_SESSION_DOMAIN_CONFIG,
  type SessionManager,
} from '@defai.digital/session-domain';
import { getProviderRegistry } from '../utils/provider-factory.js';
import { getCheckpointStorage } from '../utils/storage-instances.js';

// Lazy-initialized session manager (shared across commands)
let sessionManager: SessionManager | undefined;

/**
 * Status command handler
 */
export async function statusCommand(
  _args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  // Gather system status
  const status = await gatherSystemStatus();

  // Format for JSON output
  if (options.format === 'json') {
    return {
      success: true,
      exitCode: status.status === 'unhealthy' ? 1 : 0,
      message: undefined,
      data: status,
    };
  }

  // Format for text output
  const statusIcon = getStatusIcon(status.status);

  console.log('');
  console.log(`AutomatosX Status: ${statusIcon} ${status.status.toUpperCase()}`);
  console.log(`Version: ${status.version}`);
  console.log(`Uptime:  ${status.uptime}`);
  console.log('');

  // Provider status
  if (status.providers.length > 0) {
    console.log('Providers:');
    for (const provider of status.providers) {
      const icon = provider.available ? '[OK]' : '[ERR]';
      const latency = provider.latencyMs !== undefined ? `${provider.latencyMs}ms` : '-';
      const circuit = provider.circuitState ? `(${provider.circuitState})` : '';
      console.log(`  ${icon} ${provider.providerId.padEnd(15)} ${latency.padEnd(8)} ${circuit}`);
    }
  } else {
    console.log('Providers: (none configured)');
  }
  console.log('');

  // Session and checkpoint info
  console.log(`Active Sessions:     ${status.activeSessions}`);
  console.log(`Pending Checkpoints: ${status.pendingCheckpoints}`);
  console.log('');

  // Verbose details
  if (options.verbose) {
    console.log('Details:');
    console.log(`  Checked at: ${status.checkedAt}`);
    if (status.providers.length > 0) {
      console.log('  Provider Details:');
      for (const provider of status.providers) {
        console.log(`    ${provider.providerId}:`);
        console.log(`      Available:    ${provider.available}`);
        if (provider.latencyMs !== undefined) {
          console.log(`      Latency:      ${provider.latencyMs}ms`);
        }
        if (provider.errorRate !== undefined) {
          console.log(`      Error Rate:   ${(provider.errorRate * 100).toFixed(1)}%`);
        }
        if (provider.circuitState) {
          console.log(`      Circuit:      ${provider.circuitState}`);
        }
      }
    }
    console.log('');
  }

  return {
    success: true,
    exitCode: status.status === 'unhealthy' ? 1 : 0,
    message: undefined,
    data: status,
  };
}

/**
 * Gather system status from all sources
 */
async function gatherSystemStatus(): Promise<SystemStatus> {
  const providers = await getProviderStatus();
  const activeSessions = await getActiveSessionCount();
  const pendingCheckpoints = await getPendingCheckpointCount();

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
  };
}

/**
 * Get provider status from provider registry
 * Checks availability of each registered provider
 */
async function getProviderStatus(): Promise<ProviderStatus[]> {
  try {
    const registry = getProviderRegistry();
    const providerIds = registry.getProviderIds();
    const statuses: ProviderStatus[] = [];

    // Check each provider's availability in parallel
    const checks = providerIds.map(async (providerId: string) => {
      const provider = registry.get(providerId);
      if (provider === undefined) return;

      try {
        const available = await provider.isAvailable();
        statuses.push({
          providerId,
          available,
          latencyMs: undefined, // Only populated after actual API calls
          errorRate: undefined,
          circuitState: 'closed',
        });
      } catch {
        statuses.push({
          providerId,
          available: false,
          latencyMs: undefined,
          errorRate: undefined,
          circuitState: 'closed',
        });
      }
    });

    await Promise.all(checks);
    return statuses;
  } catch {
    return [];
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
 * Get status icon for display
 */
function getStatusIcon(status: SystemHealthLevel): string {
  switch (status) {
    case 'healthy':
      return '[OK]';
    case 'degraded':
      return '[WARN]';
    case 'unhealthy':
      return '[ERR]';
  }
}

/**
 * Format uptime in seconds to human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
