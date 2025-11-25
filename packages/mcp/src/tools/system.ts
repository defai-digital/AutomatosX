/**
 * System Tools
 *
 * MCP tools for system status and configuration.
 *
 * @module @ax/mcp/tools/system
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

import { formatBytes, formatDuration, VERSION } from '@ax/schemas';
import type { ToolHandler, ToolResult } from '../types.js';
import type { CLIContext } from './context.js';

// =============================================================================
// Tool: ax_status
// =============================================================================

export function createStatusTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_status',
      description: 'Get the current status of the AutomatosX system.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    async execute(): Promise<ToolResult> {
      try {
        const ctx = await getContext();
        const healthStatus = await ctx.providerRouter.checkAllHealth();
        const memoryStats = ctx.memoryManager.getStats();
        const agentCount = ctx.agentRegistry.getIds().length;
        const enabledAgents = ctx.agentRegistry.getAll().filter((a) => a.enabled).length;

        let healthyProviders = 0;
        const providerLines: string[] = [];
        for (const [name, healthy] of healthStatus) {
          if (healthy) healthyProviders++;
          providerLines.push(`  - ${name}: ${healthy ? 'healthy' : 'unhealthy'}`);
        }
        const totalProviders = healthStatus.size;

        const info = [
          'AutomatosX Status',
          '═══════════════════',
          '',
          'System:',
          `  Version: ${VERSION}`,
          `  Base path: ${ctx.basePath}`,
          '',
          `Providers (${healthyProviders}/${totalProviders} healthy):`,
          ...providerLines,
          '',
          'Agents:',
          `  Total: ${agentCount}`,
          `  Enabled: ${enabledAgents}`,
          '',
          'Memory:',
          `  Entries: ${memoryStats.totalEntries.toLocaleString()}`,
          `  Size: ${formatBytes(memoryStats.databaseSizeBytes)}`,
        ];

        return {
          content: [
            {
              type: 'text',
              text: info.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}

// =============================================================================
// Tool: ax_provider_status
// =============================================================================

export function createProviderStatusTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_provider_status',
      description: 'Check the health status of AI providers.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    async execute(): Promise<ToolResult> {
      try {
        const ctx = await getContext();
        const healthStatus = await ctx.providerRouter.checkAllHealth();

        const providerLines: string[] = [];
        for (const [name, healthy] of healthStatus) {
          const provider = ctx.providerRouter.getProvider(name);
          const health = provider?.getHealth();
          const statusStr = healthy ? '✓' : '✗';
          const latency = health?.latencyMs ? `${health.latencyMs}ms` : 'N/A';
          providerLines.push(`${statusStr} ${name}: ${healthy ? 'healthy' : 'unhealthy'} (${latency})`);
        }
        const providerList = providerLines.join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Provider Status:\n\n${providerList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}

// =============================================================================
// Tool: ax_config
// =============================================================================

export function createConfigTool(getContext: () => Promise<CLIContext>): ToolHandler {
  return {
    definition: {
      name: 'ax_config',
      description: 'Get the current AutomatosX configuration.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },

    async execute(): Promise<ToolResult> {
      try {
        const ctx = await getContext();
        const { config, configPath } = ctx;

        const fallbackOrder = config.providers.fallbackOrder ?? config.providers.enabled;
        const info = [
          'AutomatosX Configuration',
          '═══════════════════════════',
          '',
          `Config file: ${configPath ?? 'Using defaults'}`,
          '',
          'Providers:',
          `  Default: ${config.providers.default}`,
          `  Enabled: ${config.providers.enabled.join(', ')}`,
          `  Fallback order: ${fallbackOrder.join(' → ')}`,
          '',
          'Router:',
          `  Health check interval: ${formatDuration(config.router.healthCheckInterval)}`,
          `  Circuit breaker threshold: ${config.router.circuitBreakerThreshold}`,
          '',
          'Execution:',
          `  Default timeout: ${formatDuration(config.execution.timeout)}`,
          `  Max retries: ${config.execution.retry.maxAttempts}`,
          `  Concurrency: ${config.execution.concurrency}`,
          '',
          'Memory:',
          `  Max entries: ${config.memory.maxEntries.toLocaleString()}`,
          `  Cleanup enabled: ${config.memory.autoCleanup ? 'Yes' : 'No'}`,
        ];

        if (config.memory.autoCleanup) {
          info.push(`  Cleanup strategy: ${config.memory.cleanupStrategy}`);
          info.push(`  Retention days: ${config.memory.retentionDays}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: info.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}

