/**
 * Context Manager - Create and manage execution contexts for agents
 *
 * v5.2.0: Simplified to use shared automatosx/PRD and automatosx/tmp
 * instead of agent-specific workspaces
 */

import { join } from 'path';
import type {
  ExecutionContext,
  AgentProfile,
  ContextOptions
} from '../types/agent.js';
import type { Provider } from '../types/provider.js';
import type { MemoryEntry } from '../types/memory.js';
import type { OrchestrationMetadata, Session } from '../types/orchestration.js';
import { ProfileLoader } from './profile-loader.js';
import { AbilitiesManager } from './abilities-manager.js';
import type { IMemoryManager } from '../types/memory.js';
import type { SessionManager } from '../core/session-manager.js';
import type { WorkspaceManager } from '../core/workspace-manager.js';
import { Router } from '../core/router.js';
import { PathResolver } from '../core/path-resolver.js';
import { logger } from '../utils/logger.js';
import { PathError, ProviderError } from '../utils/errors.js';
import {
  ComponentType,
  LifecycleState,
  markState,
  PerformanceTimer
} from '../utils/performance-markers.js';

/**
 * Provider name aliases (v5.0.7 fix)
 * Maps team config names to actual registered provider names
 */
const PROVIDER_ALIASES: Record<string, string> = {
  'claude': 'claude-code',
  'gemini': 'gemini-cli',
  'codex': 'openai',
  'openai': 'openai'
};

export interface ContextManagerConfig {
  profileLoader: ProfileLoader;
  abilitiesManager: AbilitiesManager;
  memoryManager: IMemoryManager | null;
  router: Router;
  pathResolver: PathResolver;
  sessionManager?: SessionManager;
  workspaceManager?: WorkspaceManager;
}

/**
 * Context Manager - Create and manage execution contexts
 */
export class ContextManager {
  private config: ContextManagerConfig;

  constructor(config: ContextManagerConfig) {
    this.config = config;
  }

  /**
   * Create execution context for an agent task
   * v5.6.13: Phase 2.3 - Parallel context creation for 20-40ms improvement
   */
  async createContext(
    agentName: string,
    task: string,
    options?: ContextOptions
  ): Promise<ExecutionContext> {
    const timer = new PerformanceTimer(
      ComponentType.CONTEXT_MANAGER,
      'createContext',
      'config',
      { agentName }
    );

    markState(ComponentType.CONTEXT_MANAGER, LifecycleState.INITIALIZING, {
      message: 'creating execution context',
      agentName,
      task: task.substring(0, 100) // Truncate long tasks for logging
    });

    // 1. Resolve agent name (supports displayName)
    const resolvedName = await this.config.profileLoader.resolveAgentName(agentName);
    logger.debug('Agent name resolved', {
      input: agentName,
      resolved: resolvedName
    });

    // v5.6.13: Phase 2.3 - Parallel execution of independent operations
    // Step 2-5: Load profile, detect project root in parallel
    const [agent, projectDir] = await Promise.all([
      this.config.profileLoader.loadProfile(resolvedName),
      this.config.pathResolver.detectProjectRoot()
    ]);

    // Step 3-4: After profile loaded, select abilities and provider in parallel
    const selectedAbilities = this.selectAbilities(agent, task);
    const [abilities, provider] = await Promise.all([
      this.config.abilitiesManager.getAbilitiesText(selectedAbilities),
      this.selectProviderForAgent(agent, options)
    ]);

    logger.debug('Abilities selected', {
      total: agent.abilities.length,
      selected: selectedAbilities.length,
      abilities: selectedAbilities
    });

    // 5. Get working directory (synchronous)
    const workingDir = process.cwd();

    // v5.2: Agent-specific workspaces removed
    // Keep agentWorkspace field for backward compatibility, but don't create directory
    // All agents now share automatosx/PRD and automatosx/tmp
    const agentDirName = agent.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const agentWorkspace = join(projectDir, '.automatosx', 'workspaces', agentDirName);

    logger.debug('Agent workspace path defined (not created)', { workspace: agentWorkspace });

    // v5.6.13: Phase 2.3 - Parallel session and orchestration loading
    // Step 7-8: Load session and build orchestration metadata in parallel
    const [session, orchestration] = await Promise.all([
      // 7. Handle session (if sessionId provided)
      (async (): Promise<Session | undefined> => {
        if (!options?.sessionId) {
          return undefined;
        }

        if (!this.config.sessionManager) {
          throw new Error(
            `SessionManager not configured but session ID was provided: ${options.sessionId}`
          );
        }

        const foundSession = await this.config.sessionManager.getSession(options.sessionId);
        if (!foundSession) {
          throw new Error(
            `Session not found: ${options.sessionId}. Please verify the session ID or create a new session.`
          );
        }
        return foundSession;
      })(),

      // 8. Build orchestration metadata (v4.7.8+: all agents can delegate)
      (async (): Promise<OrchestrationMetadata | undefined> => {
        if (!this.config.workspaceManager || !this.config.profileLoader) {
          return undefined;
        }

        // Get list of available agents for delegation
        const allAgents = await this.config.profileLoader.listProfiles();

        // v4.7.8+: All agents can delegate by default
        // Only exclude self to prevent direct self-delegation (cycles still detected)
        const availableAgents = allAgents.filter(a => a !== agent.name);

        // v5.2: Shared workspace now points to automatosx/PRD
        // PRD is for planning documents and shared resources across all agents
        const sharedWorkspace = join(projectDir, 'automatosx', 'PRD');

        // Respect maxDelegationDepth from agent config, default to 2
        const maxDelegationDepth = agent.orchestration?.maxDelegationDepth ?? 2;

        const metadata = {
          isDelegationEnabled: true,
          availableAgents,
          sharedWorkspace,
          delegationChain: options?.delegationChain || [],
          maxDelegationDepth
        };

        logger.debug('Orchestration metadata built', {
          availableAgents,
          sharedWorkspace,
          delegationChain: metadata.delegationChain,
          maxDelegationDepth
        });

        return metadata;
      })()
    ]);

    // 9. Create context
    const context: ExecutionContext = {
      agent,
      task,
      memory: [],
      projectDir,
      workingDir,
      agentWorkspace,
      provider,
      abilities,
      createdAt: new Date(),
      orchestration,
      session
    };

    // 10. Inject memory (if not skipped)
    if (!options?.skipMemory) {
      await this.injectMemory(
        context,
        task,
        options?.memoryLimit
      );
    }

    timer.end({
      agent: agent.name,
      provider: provider.name,
      memoryEntries: context.memory.length
    });

    markState(ComponentType.CONTEXT_MANAGER, LifecycleState.READY, {
      message: 'execution context created',
      agent: agent.name,
      provider: provider.name,
      memoryEntries: context.memory.length,
      hasAbilities: abilities.length > 0,
      hasOrchestration: !!orchestration
    });

    return context;
  }

  /**
   * Inject memory into context (search by task)
   */
  async injectMemory(
    context: ExecutionContext,
    query?: string,
    limit: number = 5
  ): Promise<void> {
    // Skip if no memory manager available
    if (!this.config.memoryManager) {
      logger.debug('Memory injection skipped: no memory manager available');
      context.memory = [];
      return;
    }

    const searchQuery = query || context.task;

    try {
      const results = await this.config.memoryManager.search({
        text: searchQuery,
        limit
      });

      context.memory = results.map(r => r.entry);

      logger.debug('Memory injected', {
        query: searchQuery,
        count: context.memory.length
      });

    } catch (error) {
      logger.warn('Failed to inject memory', {
        error: (error as Error).message
      });
      // Continue without memory
      context.memory = [];
    }
  }

  /**
   * Select abilities based on task keywords (smart selection)
   */
  private selectAbilities(agent: AgentProfile, task: string): string[] {
    // If no abilitySelection config, load all abilities (backward compatible)
    if (!agent.abilitySelection || agent.abilitySelection.loadAll) {
      return agent.abilities || [];
    }

    const taskLower = task.toLowerCase();
    const selectedAbilities = new Set<string>();
    const availableAbilities = new Set(agent.abilities || []);

    // Always load core abilities
    if (agent.abilitySelection.core) {
      agent.abilitySelection.core.forEach(a => {
        if (availableAbilities.has(a)) {
          selectedAbilities.add(a);
        } else {
          logger.warn('Core ability not found in agent abilities list', {
            ability: a,
            agent: agent.name
          });
        }
      });
    }

    // Task-based selection
    if (agent.abilitySelection.taskBased) {
      for (const [keyword, abilities] of Object.entries(agent.abilitySelection.taskBased)) {
        if (taskLower.includes(keyword.toLowerCase())) {
          abilities.forEach(a => {
            if (availableAbilities.has(a)) {
              selectedAbilities.add(a);
            } else {
              logger.warn('Task-based ability not found in agent abilities list', {
                ability: a,
                keyword,
                agent: agent.name
              });
            }
          });
          logger.debug('Task keyword matched', { keyword, abilities: abilities.filter(a => availableAbilities.has(a)) });
        }
      }
    }

    // If no task-based matches, return core abilities only
    const selected = Array.from(selectedAbilities);

    // Fallback: if no abilities selected, load core or first 2 abilities
    if (selected.length === 0) {
      logger.debug('No task-based matches, using fallback');
      return agent.abilities.slice(0, 2);
    }

    return selected;
  }

  /**
   * Select provider for an agent (v4.10.0+: team-based configuration)
   * Priority: CLI option → team config → agent config → router
   */
  async selectProviderForAgent(
    agent: AgentProfile,
    options?: ContextOptions
  ): Promise<Provider> {
    // 1. CLI option overrides everything
    if (options?.provider) {
      const provider = await this.tryGetProvider(options.provider);
      if (provider) {
        logger.debug('Using CLI-specified provider', { provider: options.provider });
        return provider;
      }
    }

    // 2. Try team configuration (v4.10.0+)
    if (agent.team) {
      try {
        const teamConfig = await this.config.profileLoader.getTeamConfig(agent.name);
        if (teamConfig) {
          logger.debug('Using team provider configuration', {
            agent: agent.name,
            team: teamConfig.name,
            primary: teamConfig.provider.primary
          });

          // Try fallbackChain if specified, otherwise use primary + fallback
          const providersToTry = teamConfig.provider.fallbackChain ||
            [teamConfig.provider.primary, teamConfig.provider.fallback].filter((p): p is string => Boolean(p));

          for (const providerName of providersToTry) {
            const provider = await this.tryGetProvider(providerName);
            if (provider) {
              if (providerName !== teamConfig.provider.primary) {
                logger.info('Team primary provider unavailable, using fallback', {
                  team: teamConfig.name,
                  primary: teamConfig.provider.primary,
                  using: providerName
                });
              }
              return provider;
            }
          }

          logger.warn('All team providers unavailable, falling back to router', {
            team: teamConfig.name,
            triedProviders: providersToTry
          });
        }
      } catch (error) {
        logger.warn('Failed to load team configuration, using agent defaults', {
          agent: agent.name,
          team: agent.team,
          error: (error as Error).message
        });
      }
    }

    // 3. Fallback to agent's own configuration (deprecated but supported)
    if (agent.provider || agent.fallbackProvider) {
      logger.debug('Using agent provider configuration (deprecated)', {
        agent: agent.name,
        provider: agent.provider,
        fallback: agent.fallbackProvider
      });

      return await this.selectProvider(agent.provider, agent.fallbackProvider);
    }

    // 4. Final fallback: use router (global priority)
    const provider = await this.config.router.selectProvider();
    if (!provider) {
      throw ProviderError.noAvailableProviders();
    }

    logger.info('Using router-selected provider', {
      provider: provider.name,
      agent: agent.name
    });

    return provider;
  }

  /**
   * Try to get a specific provider if available
   */
  /**
   * Try to get provider by name, with alias support (v5.0.7+)
   * v5.6.0: Skip claude-code in Claude Code environment to prevent recursion
   */
  private async tryGetProvider(providerName: string): Promise<Provider | undefined> {
    const availableProviders = await this.config.router.getAvailableProviders();

    // Try exact match first
    let provider = availableProviders.find(p => p.name === providerName);
    if (provider) {
      // v5.6.0: Skip claude-code if running in Claude Code environment
      if (provider.name === 'claude-code' && this.isRunningInClaudeCode()) {
        logger.warn('Skipping claude-code provider in Claude Code environment', {
          requested: providerName,
          reason: 'Prevents recursion - Claude Code cannot call itself'
        });
        return undefined;
      }
      return provider;
    }

    // Try alias mapping (e.g., 'claude' → 'claude-code')
    const aliasedName = PROVIDER_ALIASES[providerName];
    if (aliasedName) {
      // v5.6.0: Skip claude-code if running in Claude Code environment
      if (aliasedName === 'claude-code' && this.isRunningInClaudeCode()) {
        logger.warn('Skipping claude-code provider alias in Claude Code environment', {
          requested: providerName,
          aliased: aliasedName,
          reason: 'Prevents recursion - Claude Code cannot call itself'
        });
        return undefined;
      }

      provider = availableProviders.find(p => p.name === aliasedName);
      if (provider) {
        logger.debug('Resolved provider via alias', {
          requested: providerName,
          resolved: aliasedName
        });
        return provider;
      }
    }

    return undefined;
  }

  /**
   * Check if running in Claude Code environment (v5.6.0+)
   */
  private isRunningInClaudeCode(): boolean {
    return Boolean(
      process.env.CLAUDECODE ||
      process.env.CLAUDE_CODE_SSE_PORT ||
      process.env.CLAUDE_CODE_ENTRYPOINT
    );
  }

  /**
   * Select provider (from agent preference or router)
   * Tries: primary → fallback → router (global priority)
   * @deprecated v4.10.0+ Use selectProviderForAgent instead
   */
  async selectProvider(
    preferredProvider?: string,
    fallbackProvider?: string
  ): Promise<Provider> {
    const availableProviders = await this.config.router.getAvailableProviders();

    // 1. Try primary provider
    if (preferredProvider) {
      const provider = availableProviders.find(p => p.name === preferredProvider);

      if (provider) {
        logger.debug('Using primary provider', { provider: preferredProvider });
        return provider;
      }

      logger.warn('Primary provider not available', {
        primary: preferredProvider
      });
    }

    // 2. Try fallback provider
    if (fallbackProvider) {
      const provider = availableProviders.find(p => p.name === fallbackProvider);

      if (provider) {
        logger.info('Using fallback provider', {
          fallback: fallbackProvider,
          primary: preferredProvider
        });
        return provider;
      }

      logger.warn('Fallback provider not available', {
        fallback: fallbackProvider
      });
    }

    // 3. Use router to select best provider (global priority)
    const provider = await this.config.router.selectProvider();

    if (!provider) {
      throw ProviderError.noAvailableProviders();
    }

    logger.info('Using router-selected provider (final fallback)', {
      provider: provider.name,
      primary: preferredProvider,
      fallback: fallbackProvider
    });
    return provider;
  }

  /**
   * Cleanup context
   *
   * v5.2: No cleanup needed - agent workspaces no longer created
   */
  async cleanup(context: ExecutionContext): Promise<void> {
    // v5.2: Agent-specific workspaces no longer created
    // All agents share automatosx/PRD and automatosx/tmp
    logger.debug('Context cleanup (no-op in v5.2)', {
      agent: context.agent.name
    });
  }
}
