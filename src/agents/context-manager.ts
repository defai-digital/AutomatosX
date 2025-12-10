/**
 * Context Manager - Create and manage execution contexts for agents
 *
 * v5.2.0: Simplified to use shared automatosx/PRD and automatosx/tmp
 * instead of agent-specific workspaces
 */

import { join } from 'path';
import { access } from 'fs/promises';
import type {
  ExecutionContext,
  AgentProfile,
  ContextOptions
} from '../types/agent.js';
import type { Provider } from '../types/provider.js';
// MemoryEntry type imported via IMemoryManager
import type { OrchestrationMetadata, Session } from '../types/orchestration.js';
import { ProfileLoader } from './profile-loader.js';
import { AbilitiesManager } from './abilities-manager.js';
import type { IMemoryManager } from '../types/memory.js';
import type { SessionManager } from '../core/session/manager.js';
import type { WorkspaceManager } from '../core/workspace-manager.js';
import { Router } from '../core/router/router.js';
import { PathResolver } from '../shared/validation/path-resolver.js';
import { ProjectContextLoader } from '../core/project-context.js';
import { logger } from '../shared/logging/logger.js';
import { ProviderError } from '../shared/errors/errors.js';
import {
  ComponentType,
  LifecycleState,
  markState,
  PerformanceTimer
} from '../shared/profiling/performance-markers.js';

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

  /**
   * v6.5.16: Cached list of available agent profiles
   * Performance: Prevents disk I/O on every context build
   * Invalidate when agents are added/removed
   */
  private cachedProfileList: string[] | null = null;

  /**
   * v8.4.14: Cached ProjectContextLoader instance
   * Performance: Reuse loader to utilize its internal cache (5min TTL)
   * Previous issue: Creating new loader every time = cache miss every time
   */
  private projectContextLoader: ProjectContextLoader | null = null;

  constructor(config: ContextManagerConfig) {
    this.config = config;
  }

  /**
   * Invalidate the cached profile list
   * Call this when agents are added or removed
   * @since v6.5.16 - Performance optimization
   */
  invalidateProfileCache(): void {
    this.cachedProfileList = null;
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
    // v7.1.0: Also load project context in parallel
    // v8.5.0: Also try to select relevant files from workspace index
    const selectedAbilities = this.selectAbilities(agent, task);
    const [abilities, provider, projectContext, relevantFiles] = await Promise.all([
      this.config.abilitiesManager.getAbilitiesText(selectedAbilities),
      this.selectProviderForAgent(agent, options),
      this.loadProjectContext(projectDir),
      this.selectRelevantFilesFromIndex(projectDir, task)
    ]);

    logger.debug('Abilities selected', {
      total: agent.abilities.length,
      selected: selectedAbilities.length,
      abilities: selectedAbilities
    });

    if (relevantFiles && relevantFiles.length > 0) {
      logger.debug('Relevant files selected from index', {
        count: relevantFiles.length,
        files: relevantFiles
      });
    }

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

        // v6.5.16: Use cached profile list to avoid disk I/O on every context build
        // Get list of available agents for delegation
        if (this.cachedProfileList === null) {
          this.cachedProfileList = await this.config.profileLoader.listProfiles();
          logger.debug('Profile list cached', {
            count: this.cachedProfileList.length
          });
        }
        const allAgents = this.cachedProfileList;

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
      session,
      projectContext: projectContext || undefined,
      relevantFiles: (relevantFiles && relevantFiles.length > 0) ? relevantFiles : undefined
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

    // v12.7.1: Extract keywords instead of truncating for better memory search
    // Memory search has a 1000 character limit for the search text
    const MAX_QUERY_LENGTH = 1000;
    const optimizedQuery = this.extractSearchKeywords(searchQuery, MAX_QUERY_LENGTH);

    if (optimizedQuery !== searchQuery) {
      logger.debug('Memory search query optimized', {
        originalLength: searchQuery.length,
        optimizedLength: optimizedQuery.length,
        maxLength: MAX_QUERY_LENGTH,
        method: searchQuery.length > MAX_QUERY_LENGTH ? 'keyword_extraction' : 'passthrough'
      });
    }

    try {
      const results = await this.config.memoryManager.search({
        text: optimizedQuery,  // Use optimized query with keywords
        limit
      });

      context.memory = results.map(r => r.entry);

      logger.debug('Memory injected', {
        query: optimizedQuery.substring(0, 100) + (optimizedQuery.length > 100 ? '...' : ''),
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
   * Extract meaningful keywords from a query for memory search
   *
   * Instead of truncating long queries (which loses context at the end),
   * this extracts the most meaningful terms for FTS5 search.
   *
   * @param query - The full query text
   * @param maxLength - Maximum output length
   * @returns Optimized search query with keywords
   *
   * @since v12.7.1
   */
  private extractSearchKeywords(query: string, maxLength: number): string {
    // If already within limit, return as-is
    if (query.length <= maxLength) {
      return query;
    }

    // Common stop words to filter out (extends FTS5 stopwords)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
      'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once', 'please',
      'want', 'need', 'help', 'me', 'my', 'your', 'our', 'their', 'its'
    ]);

    // Extract words (alphanumeric sequences, preserving case for proper nouns)
    const words = query.match(/[a-zA-Z0-9_-]+/g) || [];

    // Score words by importance
    const wordScores = new Map<string, number>();

    for (const word of words) {
      const lower = word.toLowerCase();

      // Skip stop words and very short words
      if (stopWords.has(lower) || word.length < 3) {
        continue;
      }

      // Calculate importance score
      let score = wordScores.get(lower) || 0;

      // Boost technical terms (CamelCase, snake_case, contains numbers)
      if (/[A-Z]/.test(word) && /[a-z]/.test(word)) score += 3;  // CamelCase
      if (word.includes('_') || word.includes('-')) score += 2;  // snake_case/kebab
      if (/\d/.test(word)) score += 2;  // Contains numbers (e.g., v12, API2)

      // Boost longer words (more specific)
      if (word.length > 8) score += 2;
      if (word.length > 5) score += 1;

      // Frequency boost (appears multiple times = more important)
      score += 1;

      wordScores.set(lower, score);
    }

    // Sort by score descending
    const sortedWords = Array.from(wordScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);

    // Build result within limit, preserving highest-scored terms
    const result: string[] = [];
    let currentLength = 0;

    for (const word of sortedWords) {
      const wordWithSpace = result.length > 0 ? ` ${word}` : word;
      if (currentLength + wordWithSpace.length > maxLength) {
        break;
      }
      result.push(word);
      currentLength += wordWithSpace.length;
    }

    // If we got fewer than 5 keywords, also include first 200 chars as fallback
    if (result.length < 5) {
      const prefix = query.substring(0, Math.min(200, maxLength - currentLength - 1));
      if (prefix && currentLength + prefix.length + 1 <= maxLength) {
        return `${prefix} ${result.join(' ')}`.trim();
      }
    }

    return result.join(' ');
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
                // v9.0.0+: Always log fallback usage (even in quiet mode)
                // This is important information users should see
                console.log(`ℹ️  Using fallback provider: ${providerName} (primary ${teamConfig.provider.primary} unavailable)`);

                logger.info('Team primary provider unavailable, using fallback', {
                  team: teamConfig.name,
                  primary: teamConfig.provider.primary,
                  using: providerName
                });
              }
              return provider;
            } else {
              // v9.0.0+: Log failed provider attempts for debugging
              const remainingProviders = providersToTry.slice(providersToTry.indexOf(providerName) + 1);
              logger.info('Provider unavailable, trying next in fallback chain', {
                tried: providerName,
                remaining: remainingProviders.length,
                remainingProviders: remainingProviders
              });
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
   * Load project context from ax.index.json (v12.9.0+)
   *
   * Loads project-specific context from ax.index.json and CUSTOM.md.
   * Falls back gracefully if files don't exist.
   *
   * @param projectDir - Project root directory
   * @returns Project context or null if not found
   */
  private async loadProjectContext(projectDir: string): Promise<import('../core/project-context.js').ProjectContext | null> {
    try {
      // v8.4.14: Reuse loader instance to utilize internal cache
      // Previous issue: Creating new loader every time = lost cache = slow
      if (!this.projectContextLoader) {
        this.projectContextLoader = new ProjectContextLoader(projectDir);
      }

      const loader = this.projectContextLoader;

      // Check if context exists before loading (faster)
      const exists = await loader.exists();
      if (!exists) {
        logger.debug('No ax.index.json or CUSTOM.md found, skipping project context');
        return null;
      }

      const context = await loader.load();

      logger.debug('Project context loaded', {
        hasIndex: !!context.index,
        hasCustomInstructions: !!context.customInstructions,
        guardrails: context.guardrails?.length ?? 0,
        isStale: context.isStale
      });

      return context;
    } catch (error) {
      // Graceful fallback - don't fail execution if context loading fails
      logger.warn('Failed to load project context, continuing without it', {
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Select relevant files from workspace index
   *
   * v8.5.0: Smart file selection for context compression
   * @param projectDir - Project root directory
   * @param task - Task description for keyword extraction
   * @returns Array of relevant file paths, or undefined if index not available
   */
  private async selectRelevantFilesFromIndex(
    projectDir: string,
    task: string
  ): Promise<string[] | undefined> {
    try {
      const { WorkspaceIndexer } = await import('../core/workspace-indexer.js');
      const indexPath = join(projectDir, '.automatosx', 'workspace', 'index.db');

      // Check if index exists
      const indexExists = await access(indexPath).then(() => true).catch(() => false);
      if (!indexExists) {
        logger.debug('No workspace index found, skipping file selection');
        return undefined;
      }

      // Load indexer and select files
      const indexer = new WorkspaceIndexer(projectDir, { dbPath: indexPath });
      const files = await indexer.selectRelevantFiles(task, {
        maxFiles: 10,
        includeTests: false,
        includeRecent: true
      });

      indexer.close();

      return files.length > 0 ? files : undefined;
    } catch (error) {
      // Non-critical failure - continue without index
      logger.debug('Failed to select files from index', {
        error: (error as Error).message
      });
      return undefined;
    }
  }

  /**
   * Cleanup context
   *
   * v5.2: No cleanup needed - agent workspaces no longer created
   * Note: Returns Promise for interface compatibility
   */
  cleanup(context: ExecutionContext): Promise<void> {
    // v5.2: Agent-specific workspaces no longer created
    // All agents share automatosx/PRD and automatosx/tmp
    logger.debug('Context cleanup (no-op in v5.2)', {
      agent: context.agent.name
    });
    return Promise.resolve();
  }
}
