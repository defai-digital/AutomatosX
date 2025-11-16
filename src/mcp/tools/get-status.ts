/**
 * MCP Tool: get_status
 *
 * Gets AutomatosX system status and configuration.
 * Wraps the existing status command logic.
 */

import type { ToolHandler, GetStatusOutput } from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { SessionManager } from '../../core/session-manager.js';
import { Router } from '../../core/router.js';
import { logger } from '../../utils/logger.js';
import { getVersion } from '../../utils/version.js';
import { mapActualProviderToMcp } from '../utils/provider-mapping.js';

export interface GetStatusDependencies {
  memoryManager: IMemoryManager;
  sessionManager: SessionManager;
  router: Router;
}

export function createGetStatusHandler(
  deps: GetStatusDependencies
): ToolHandler<Record<string, never>, GetStatusOutput> {
  return async (): Promise<GetStatusOutput> => {
    logger.info('[MCP] get_status called');

    try {
      // Get version from package.json (single source of truth)
      const version = getVersion();

      // Get memory stats
      const memoryStats = await deps.memoryManager.getStats();

      // Get session stats
      const activeSessions = await deps.sessionManager.getActiveSessions();
      const totalSessions = await deps.sessionManager.getTotalSessionCount();

      // Get available providers and map to MCP names
      // System uses: 'claude-code', 'gemini-cli', 'openai'
      // MCP returns: 'claude', 'gemini', 'openai'
      const availableProviders = await deps.router.getAvailableProviders();
      const providers = availableProviders.map((p) => mapActualProviderToMcp(p.name));

      // Format dbSize as human-readable string
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
      };

      const result: GetStatusOutput = {
        version,
        providers,
        memory: {
          entries: memoryStats.totalEntries,
          dbSize: formatBytes(memoryStats.dbSize)
        },
        sessions: {
          active: activeSessions.length,
          total: totalSessions
        }
      };

      logger.info('[MCP] get_status completed', {
        version,
        providersCount: providers.length,
        memoryEntries: memoryStats.totalEntries,
        activeSessions: activeSessions.length
      });

      return result;
    } catch (error) {
      logger.error('[MCP] get_status failed', { error });
      throw new Error(`Status check failed: ${(error as Error).message}`);
    }
  };
}
