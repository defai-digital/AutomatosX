/**
 * AgentExecutor - Main orchestration engine for agent execution
 * Combines ProfileLoader, AbilitiesManager, ContextManager, and TeamManager
 * Restores v7.6.1 agent execution for v8.x
 */

import { ProfileLoader, type AgentProfile } from './ProfileLoader.js';
import { AbilitiesManager } from './AbilitiesManager.js';
import { ContextManager, type ContextOptions, type ExecutionContext } from './ContextManager.js';
import { TeamManager } from './TeamManager.js';
import { logger } from '../utils/logger.js';
import { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
import { getDefaultProviderConfig, getModelForProvider, PROVIDERS } from './provider-config.js';
import { loadAgentMessagesConfig, clearAgentMessagesConfigCache, type AgentMessagesConfig } from '../config/AgentMessagesConfig.js';
import { loadAgentRuntimeConfig, clearAgentRuntimeConfigCache, type AgentRuntimeConfig } from '../config/AgentRuntimeConfig.js';

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  agent: string;
  task: string;
  context?: ContextOptions;
  verbose?: boolean;
  stream?: boolean;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  success: boolean;
  response?: string;
  error?: Error;
  metadata: {
    agent: string;
    task: string;
    timestamp: Date;
    duration: number;
    provider?: string;
    abilities: number;
  };
}

/**
 * Main agent execution orchestrator
 */
export class AgentExecutor {
  // REFACTORING #32: Load messages configuration from YAML
  private messagesConfig: AgentMessagesConfig;

  // REFACTORING #33: Load runtime configuration from YAML
  private runtimeConfig: AgentRuntimeConfig;

  private profileLoader: ProfileLoader;
  private abilitiesManager: AbilitiesManager;
  private contextManager: ContextManager;
  private teamManager: TeamManager;
  private providerRouter: ProviderRouterV2;

  constructor(projectRoot: string = process.cwd()) {
    this.profileLoader = new ProfileLoader(projectRoot);
    this.abilitiesManager = new AbilitiesManager(projectRoot);
    this.contextManager = new ContextManager();
    this.teamManager = new TeamManager(projectRoot);
    this.messagesConfig = loadAgentMessagesConfig();
    this.runtimeConfig = loadAgentRuntimeConfig();

    // Initialize ProviderRouterV2 with default configuration
    this.providerRouter = new ProviderRouterV2(getDefaultProviderConfig());
  }

  /**
   * Execute an agent task
   */
  async execute(options: AgentExecutionOptions): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      // REFACTORING #33: Use YAML-configured task log length
      const taskForLog = options.task.length > this.runtimeConfig.execution.maxTaskLogLength
        ? options.task.substring(0, this.runtimeConfig.execution.maxTaskLogLength) + this.messagesConfig.formatting.ellipsis
        : options.task;

      // REFACTORING #32: Use YAML-configured log message
      logger.info(`${this.messagesConfig.logging.executingAgent}: ${options.agent}`, {
        task: taskForLog
      });

      // Step 1: Load agent profile
      const profile = await this.profileLoader.loadProfile(options.agent);

      // Step 2: Merge with team configuration
      const mergedProfile = await this.teamManager.mergeWithTeam(profile);

      // Step 3: Load abilities (core + task-specific)
      const abilities = await this.abilitiesManager.loadAllAbilities(
        options.task,
        mergedProfile
      );

      // Step 4: Build execution context
      const context = await this.contextManager.buildContext(
        options.task,
        options.context || {}
      );

      // Step 5: Build system prompt
      const systemPrompt = this.buildSystemPrompt(mergedProfile, abilities, context);

      // Step 6: Execute with AI provider
      const response = await this.executeWithProvider(
        mergedProfile,
        systemPrompt,
        options.task,
        options.stream || false
      );

      const duration = Date.now() - startTime;

      // REFACTORING #32: Use YAML-configured log message
      logger.info(`${this.messagesConfig.logging.executionCompleted}: ${options.agent}`, {
        duration: `${duration}ms`,
        abilities: abilities.length
      });

      return {
        success: true,
        response,
        metadata: this.buildExecutionMetadata(
          options.agent,
          options.task,
          duration,
          mergedProfile.providers?.default,
          abilities.length
        )
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // REFACTORING #32: Use YAML-configured log message
      logger.error(`${this.messagesConfig.logging.executionFailed}: ${options.agent}`, {
        error: (error as Error).message,
        duration: `${duration}ms`
      });

      return {
        success: false,
        error: error as Error,
        metadata: this.buildExecutionMetadata(
          options.agent,
          options.task,
          duration,
          undefined,
          0
        )
      };
    }
  }

  /**
   * Build execution metadata
   */
  private buildExecutionMetadata(
    agent: string,
    task: string,
    duration: number,
    provider?: string,
    abilitiesCount: number = 0
  ): AgentExecutionResult['metadata'] {
    return {
      agent,
      task,
      timestamp: new Date(),
      duration,
      provider,
      abilities: abilitiesCount
    };
  }

  /**
   * Build complete system prompt from profile, abilities, and context
   */
  private buildSystemPrompt(
    profile: AgentProfile,
    abilities: string[],
    context: ExecutionContext
  ): string {
    const parts: string[] = [];

    // Agent identity
    parts.push(`# Agent Identity`);
    parts.push(`Name: ${profile.displayName || profile.name}`);
    parts.push(`Role: ${profile.role}`);
    parts.push(`Description: ${profile.description}`);
    parts.push('');

    // Core system prompt
    parts.push(`# Core Instructions`);
    parts.push(profile.systemPrompt);
    parts.push('');

    // Abilities (if any)
    if (abilities.length > 0) {
      const abilitiesText = this.abilitiesManager.formatAbilitiesForPrompt(abilities);
      parts.push(abilitiesText);
      parts.push('');
    }

    // Execution context
    const contextText = this.contextManager.formatContextForPrompt(context);
    parts.push(contextText);

    return parts.join('\n');
  }

  /**
   * Execute task with AI provider
   */
  private async executeWithProvider(
    profile: AgentProfile,
    systemPrompt: string,
    userMessage: string,
    stream: boolean
  ): Promise<string> {
    // Determine provider to use (default to Claude)
    const providerName = profile.providers?.default || PROVIDERS.CLAUDE;

    logger.debug(`Using provider: ${providerName}`, {
      fallback: profile.providers?.fallback
    });

    // WORKAROUND: ProviderRouterV2 doesn't support system prompts in the request
    // So we prepend the system prompt to the user message
    // REFACTORING #32: Use YAML-configured formatting constants
    const combinedMessage = `${systemPrompt}${this.messagesConfig.formatting.messageSeparator}${this.messagesConfig.formatting.taskHeader}\n\n${userMessage}`;

    // Build request (using ProviderRequest interface)
    const request = {
      model: getModelForProvider(providerName),
      messages: [
        {
          role: 'user' as const,
          content: combinedMessage
        }
      ],
      // REFACTORING #33: Use YAML-configured execution defaults
      temperature: profile.temperature || this.runtimeConfig.execution.defaultTemperature,
      maxTokens: profile.maxTokens || this.runtimeConfig.execution.defaultMaxTokens,
      // Pass agent's provider preferences to router
      // BUG FIX: Type-safe provider preference passing
      preferredProvider: providerName as 'claude' | 'gemini' | 'openai',
      fallbackProviders: (profile.providers?.fallback || []) as ('claude' | 'gemini' | 'openai')[],
      // Pass streaming flag via metadata
      metadata: {
        streaming: stream
      }
    };

    logger.debug(`Sending request to provider router`, {
      preferredProvider: providerName,
      fallbackProviders: profile.providers?.fallback,
      messageLength: combinedMessage.length,
      temperature: request.temperature,
      maxTokens: request.maxTokens
    });

    // Execute with provider router
    const response = await this.providerRouter.route(request);

    return response.content;
  }

  /**
   * List all available agents
   */
  async listAgents(): Promise<Array<{
    name: string;
    displayName?: string;
    role: string;
    description: string;
    team?: string;
    abilities: number;
  }>> {
    const agentNames = await this.profileLoader.listAgents();

    // Load agent info in parallel for better performance
    const agentPromises = agentNames.map(async (agentName) => {
      try {
        return await this.profileLoader.getAgentInfo(agentName);
      } catch (error) {
        logger.warn(`Failed to load agent info: ${agentName}`, { error });
        return null;
      }
    });

    const results = await Promise.all(agentPromises);

    // Filter out failed loads
    return results.filter((info): info is NonNullable<typeof info> => info !== null);
  }

  /**
   * Clear all caches (useful for testing and hot reload)
   * BUG FIX #34: Also clear configuration caches
   */
  clearCaches(): void {
    this.profileLoader.clearCache();
    this.abilitiesManager.clearCache();
    this.teamManager.clearCache();

    // Clear configuration caches
    clearAgentMessagesConfigCache();
    clearAgentRuntimeConfigCache();
  }
}
