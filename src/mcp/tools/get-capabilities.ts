/**
 * MCP Tool: get_capabilities
 *
 * Returns comprehensive system capabilities for service discovery.
 * Enables AI assistants to understand what AutomatosX offers:
 * - Available providers (with execution modes)
 * - Agent profiles
 * - Available MCP tools
 * - Memory and session status
 *
 * @version 13.0.0
 */

import type { ToolHandler } from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import { SessionManager } from '../../core/session/manager.js';
import { Router } from '../../core/router/router.js';
import { ProfileLoader } from '../../agents/profile-loader.js';
import { logger } from '../../shared/logging/logger.js';
import { getVersion } from '../../shared/helpers/version.js';
import { loadConfig } from '../../core/config/loader.js';

/**
 * Provider information with execution mode
 */
export interface ProviderCapability {
  name: string;
  enabled: boolean;
  available: boolean;
  type: 'cli' | 'sdk' | 'hybrid';
  executionMode: 'cli' | 'sdk' | 'hybrid';
  priority: number;
  model?: string;
}

/**
 * Agent information for discovery
 */
export interface AgentCapability {
  name: string;
  displayName?: string;
  role?: string;
  description?: string;
  team?: string;
  abilities?: string[];
}

/**
 * Tool information for discovery
 */
export interface ToolCapability {
  name: string;
  description: string;
  category: 'discovery' | 'execution' | 'memory' | 'session' | 'task' | 'context';
}

/**
 * Output of get_capabilities tool
 */
export interface GetCapabilitiesOutput {
  version: string;

  providers: ProviderCapability[];

  agents: AgentCapability[];

  tools: ToolCapability[];

  memory: {
    enabled: boolean;
    entryCount: number;
    maxEntries: number;
  };

  sessions: {
    enabled: boolean;
    activeCount: number;
    maxSessions: number;
  };

  features: {
    smartRouting: boolean;
    memorySearch: boolean;
    multiAgentSessions: boolean;
    streamingNotifications: boolean;
  };
}

export interface GetCapabilitiesDependencies {
  memoryManager: IMemoryManager;
  sessionManager: SessionManager;
  router: Router;
  profileLoader: ProfileLoader;
  toolSchemas: Array<{ name: string; description: string }>;
}

/**
 * Categorize tool by name
 */
function categorizeTools(name: string): ToolCapability['category'] {
  if (name.startsWith('memory_') || name === 'search_memory') return 'memory';
  if (name.startsWith('session_')) return 'session';
  if (name.startsWith('create_task') || name.startsWith('run_task') ||
      name.startsWith('get_task') || name.startsWith('list_task') ||
      name.startsWith('delete_task')) return 'task';
  if (name === 'get_capabilities' || name === 'list_agents' ||
      name === 'get_status' || name === 'get_agent_context') return 'discovery';
  if (name.includes('context')) return 'context';
  return 'execution';
}

/**
 * Determine provider execution mode based on type
 */
function getExecutionMode(providerName: string, _providerConfig: Record<string, unknown>): 'cli' | 'sdk' | 'hybrid' {
  // SDK-only providers (no CLI execution)
  if (providerName === 'glm' || providerName === 'grok') {
    return 'sdk';
  }
  // CLI-only providers (no SDK available)
  if (providerName === 'claude-code' || providerName === 'gemini-cli') {
    return 'cli';
  }
  // Hybrid providers (SDK preferred, CLI fallback)
  if (providerName === 'openai') {
    return 'hybrid';
  }
  // Default to CLI for unknown providers
  return 'cli';
}

/**
 * Determine provider type
 */
function getProviderType(providerName: string): 'cli' | 'sdk' | 'hybrid' {
  if (providerName === 'glm' || providerName === 'grok') return 'sdk';
  if (providerName === 'openai') return 'hybrid';
  return 'cli';
}

export function createGetCapabilitiesHandler(
  deps: GetCapabilitiesDependencies
): ToolHandler<Record<string, never>, GetCapabilitiesOutput> {
  return async (): Promise<GetCapabilitiesOutput> => {
    logger.info('[MCP] get_capabilities called');

    try {
      const projectDir = process.cwd();
      const config = await loadConfig(projectDir);
      const version = getVersion();

      // Build provider capabilities
      const providers: ProviderCapability[] = [];
      const providerConfigs = config.providers || {};

      for (const [name, providerConfig] of Object.entries(providerConfigs)) {
        const cfg = providerConfig as unknown as Record<string, unknown>;
        const enabled = cfg.enabled === true;

        // Check availability via router
        let available = false;
        try {
          const availableProviders = await deps.router.getAvailableProviders();
          available = availableProviders.some(p => p.name === name);
        } catch {
          // Router not available, check config only
          available = enabled;
        }

        providers.push({
          name,
          enabled,
          available,
          type: getProviderType(name),
          executionMode: getExecutionMode(name, cfg),
          priority: (cfg.priority as number) || 0,
          model: cfg.model as string | undefined
        });
      }

      // Sort by priority (higher first)
      providers.sort((a, b) => b.priority - a.priority);

      // Build agent capabilities
      // v12.5.3: Parallelize profile loading for better performance
      const agentNames = await deps.profileLoader.listProfiles();
      const agentResults = await Promise.all(
        agentNames.map(async (agentName) => {
          try {
            const profile = await deps.profileLoader.loadProfile(agentName);
            return {
              name: profile.name,
              displayName: profile.displayName,
              role: profile.role,
              description: profile.systemPrompt?.substring(0, 200),
              team: profile.team,
              abilities: profile.abilities || []
            } as AgentCapability;
          } catch (error) {
            logger.warn(`Failed to load profile for ${agentName}`, { error });
            return null;
          }
        })
      );
      const agents = agentResults.filter((a): a is AgentCapability => a !== null);

      // Build tool capabilities
      const tools: ToolCapability[] = deps.toolSchemas.map(schema => ({
        name: schema.name,
        description: schema.description,
        category: categorizeTools(schema.name)
      }));

      // v12.5.3: Parallelize memory and session stats fetching
      const [memoryStats, activeSessions] = await Promise.all([
        deps.memoryManager.getStats(),
        deps.sessionManager.getActiveSessions()
      ]);

      const result: GetCapabilitiesOutput = {
        version,
        providers,
        agents,
        tools,
        memory: {
          enabled: true,
          entryCount: memoryStats.totalEntries,
          maxEntries: config.memory?.maxEntries || 10000
        },
        sessions: {
          enabled: true,
          activeCount: activeSessions.length,
          maxSessions: config.orchestration?.session?.maxSessions || 100
        },
        features: {
          smartRouting: true, // Always enabled in v13.0.0
          memorySearch: true,
          multiAgentSessions: true,
          streamingNotifications: false // Configured via MCP server options
        }
      };

      logger.info('[MCP] get_capabilities completed', {
        version,
        providersCount: providers.length,
        agentsCount: agents.length,
        toolsCount: tools.length
      });

      return result;
    } catch (error) {
      logger.error('[MCP] get_capabilities failed', { error });
      throw new Error(`Capabilities check failed: ${(error as Error).message}`);
    }
  };
}
