/**
 * AgentExecutor - Main orchestration engine for agent execution
 * Combines ProfileLoader, AbilitiesManager, ContextManager, and TeamManager
 * Restores v7.6.1 agent execution for v8.x
 */
import { ProfileLoader } from './ProfileLoader.js';
import { AbilitiesManager } from './AbilitiesManager.js';
import { ContextManager } from './ContextManager.js';
import { TeamManager } from './TeamManager.js';
import { logger } from '../utils/logger.js';
import { ProviderRouterV2 } from '../services/ProviderRouterV2.js';
import { getDefaultProviderConfig, getModelForProvider, PROVIDERS } from './provider-config.js';
import { loadAgentMessagesConfig, clearAgentMessagesConfigCache } from '../config/AgentMessagesConfig.js';
import { loadAgentRuntimeConfig, clearAgentRuntimeConfigCache } from '../config/AgentRuntimeConfig.js';
/**
 * Main agent execution orchestrator
 */
export class AgentExecutor {
    // REFACTORING #32: Load messages configuration from YAML
    messagesConfig;
    // REFACTORING #33: Load runtime configuration from YAML
    runtimeConfig;
    profileLoader;
    abilitiesManager;
    contextManager;
    teamManager;
    providerRouter;
    constructor(projectRoot = process.cwd()) {
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
    async execute(options) {
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
            const abilities = await this.abilitiesManager.loadAllAbilities(options.task, mergedProfile);
            // Step 4: Build execution context
            const context = await this.contextManager.buildContext(options.task, options.context || {});
            // Step 5: Build system prompt
            const systemPrompt = this.buildSystemPrompt(mergedProfile, abilities, context);
            // Step 6: Execute with AI provider
            const response = await this.executeWithProvider(mergedProfile, systemPrompt, options.task, options.stream || false);
            const duration = Date.now() - startTime;
            // REFACTORING #32: Use YAML-configured log message
            logger.info(`${this.messagesConfig.logging.executionCompleted}: ${options.agent}`, {
                duration: `${duration}ms`,
                abilities: abilities.length
            });
            return {
                success: true,
                response,
                metadata: this.buildExecutionMetadata(options.agent, options.task, duration, mergedProfile.providers?.default, abilities.length)
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // REFACTORING #32: Use YAML-configured log message
            logger.error(`${this.messagesConfig.logging.executionFailed}: ${options.agent}`, {
                error: error.message,
                duration: `${duration}ms`
            });
            return {
                success: false,
                error: error,
                metadata: this.buildExecutionMetadata(options.agent, options.task, duration, undefined, 0)
            };
        }
    }
    /**
     * Build execution metadata
     */
    buildExecutionMetadata(agent, task, duration, provider, abilitiesCount = 0) {
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
    buildSystemPrompt(profile, abilities, context) {
        const parts = [];
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
    async executeWithProvider(profile, systemPrompt, userMessage, stream) {
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
                    role: 'user',
                    content: combinedMessage
                }
            ],
            // REFACTORING #33: Use YAML-configured execution defaults
            temperature: profile.temperature || this.runtimeConfig.execution.defaultTemperature,
            maxTokens: profile.maxTokens || this.runtimeConfig.execution.defaultMaxTokens,
            // Pass agent's provider preferences to router
            // BUG FIX: Type-safe provider preference passing
            preferredProvider: providerName,
            fallbackProviders: (profile.providers?.fallback || []),
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
    async listAgents() {
        const agentNames = await this.profileLoader.listAgents();
        // Load agent info in parallel for better performance
        const agentPromises = agentNames.map(async (agentName) => {
            try {
                return await this.profileLoader.getAgentInfo(agentName);
            }
            catch (error) {
                logger.warn(`Failed to load agent info: ${agentName}`, { error });
                return null;
            }
        });
        const results = await Promise.all(agentPromises);
        // Filter out failed loads
        return results.filter((info) => info !== null);
    }
    /**
     * Clear all caches (useful for testing and hot reload)
     * BUG FIX #34: Also clear configuration caches
     */
    clearCaches() {
        this.profileLoader.clearCache();
        this.abilitiesManager.clearCache();
        this.teamManager.clearCache();
        // Clear configuration caches
        clearAgentMessagesConfigCache();
        clearAgentRuntimeConfigCache();
    }
}
//# sourceMappingURL=AgentExecutor.js.map