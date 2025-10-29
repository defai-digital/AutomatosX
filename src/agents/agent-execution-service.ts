/**
 * Agent Execution Service - Native agent invocation for Spec-Kit
 *
 * Phase 1 (v5.13.0): Complete native in-process execution implementation
 *
 * This service provides direct access to AutomatosX agent execution without subprocess overhead.
 * Designed for Spec-Kit integration to eliminate the 50-200ms startup cost per task.
 *
 * Performance Impact:
 * - Subprocess execution: ~150ms startup + execution time
 * - Native execution: <15ms startup + execution time (10x improvement)
 *
 * @module agents/agent-execution-service
 * @since v5.13.0
 */

import type { AutomatosXConfig } from '../types/config.js';
import type { ExecutionResponse } from '../types/provider.js';
import { Router } from '../core/router.js';
import { SessionManager } from '../core/session-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { LazyMemoryManager } from '../core/lazy-memory-manager.js';
import { ProfileLoader } from './profile-loader.js';
import { AbilitiesManager } from './abilities-manager.js';
import { TeamManager } from '../core/team-manager.js';
import { PathResolver } from '../core/path-resolver.js';
import { ContextManager } from './context-manager.js';
import { AgentExecutor } from './executor.js';
import { ClaudeProvider } from '../providers/claude-provider.js';
import { GeminiProvider } from '../providers/gemini-provider.js';
import { OpenAIProvider } from '../providers/openai-provider.js';
import type { BaseProvider } from '../providers/base-provider.js';
import { logger } from '../utils/logger.js';
import { join } from 'path';

/**
 * Options for agent execution (SpecExecutor-compatible interface)
 */
export interface AgentExecutionServiceOptions {
  // Required
  agentName: string;
  task: string;

  // Optional execution options
  sessionId?: string;
  timeout?: number;
  verbose?: boolean;
  saveMemory?: boolean;
  provider?: string;
  model?: string;
}

/**
 * Result from agent execution (SpecExecutor-compatible interface)
 */
export interface AgentExecutionServiceResult {
  success: boolean;
  output: string;
  duration: number;
  error?: Error;
  response?: ExecutionResponse;
}

/**
 * Configuration for AgentExecutionService
 */
export interface AgentExecutionServiceConfig {
  /**
   * Project root directory
   */
  projectDir: string;

  /**
   * AutomatosX configuration
   */
  config: AutomatosXConfig;

  /**
   * Optional shared resources to avoid re-initialization
   * If not provided, service will create its own instances
   */
  router?: Router;
  sessionManager?: SessionManager;
  workspaceManager?: WorkspaceManager;
  memoryManager?: LazyMemoryManager;
  profileLoader?: ProfileLoader;
  teamManager?: TeamManager;
  abilitiesManager?: AbilitiesManager;
  pathResolver?: PathResolver;
  contextManager?: ContextManager;
}

/**
 * AgentExecutionService
 *
 * Native in-process agent execution service for high-performance
 * multi-agent workflows (particularly Spec-Kit integration).
 *
 * ## Key Features
 *
 * - **Zero subprocess overhead**: Direct in-process execution
 * - **Resource sharing**: Reuse router, providers, memory across tasks
 * - **Session-aware**: Automatic session management for workflows
 * - **Memory integration**: Automatic memory injection and persistence
 * - **Provider pooling**: Share provider instances across tasks
 *
 * ## Usage
 *
 * ```typescript
 * const service = new AgentExecutionService({
 *   projectDir: '/path/to/project',
 *   config: await loadConfig(),
 *   // Optional: pass shared resources
 *   router: existingRouter,
 *   sessionManager: existingSessionManager
 * });
 *
 * const result = await service.execute({
 *   agentName: 'backend',
 *   task: 'Implement user authentication',
 *   sessionId: 'workflow-123',
 *   saveMemory: true
 * });
 *
 * console.log(result.output);
 * await service.cleanup();
 * ```
 *
 * @since v5.13.0
 */
export class AgentExecutionService {
  private readonly projectDir: string;
  private readonly config: AutomatosXConfig;

  // Core managers (owned or shared)
  private readonly router: Router;
  private readonly sessionManager: SessionManager;
  private readonly workspaceManager: WorkspaceManager;
  private readonly memoryManager: LazyMemoryManager | undefined;
  private readonly profileLoader: ProfileLoader;
  private readonly teamManager: TeamManager;
  private readonly abilitiesManager: AbilitiesManager;
  private readonly pathResolver: PathResolver;
  private readonly contextManager: ContextManager;

  // Ownership flags (for cleanup)
  private readonly ownsRouter: boolean;
  private readonly ownsSessionManager: boolean;
  private readonly ownsWorkspaceManager: boolean;
  private readonly ownsMemoryManager: boolean;
  private readonly ownsProfileLoader: boolean;
  private readonly ownsTeamManager: boolean;
  private readonly ownsAbilitiesManager: boolean;
  private readonly ownsPathResolver: boolean;
  private readonly ownsContextManager: boolean;

  /**
   * Create AgentExecutionService
   *
   * @param config - Service configuration
   */
  constructor(config: AgentExecutionServiceConfig) {
    this.projectDir = config.projectDir;
    this.config = config.config;

    // Initialize or use shared TeamManager
    if (config.teamManager) {
      this.teamManager = config.teamManager;
      this.ownsTeamManager = false;
    } else {
      this.teamManager = new TeamManager(
        join(this.projectDir, '.automatosx', 'teams')
      );
      this.ownsTeamManager = true;
    }

    // Initialize or use shared ProfileLoader
    if (config.profileLoader) {
      this.profileLoader = config.profileLoader;
      this.ownsProfileLoader = false;
    } else {
      this.profileLoader = new ProfileLoader(
        join(this.projectDir, '.automatosx', 'agents'),
        undefined,
        this.teamManager
      );
      this.ownsProfileLoader = true;
    }

    // Initialize or use shared AbilitiesManager
    if (config.abilitiesManager) {
      this.abilitiesManager = config.abilitiesManager;
      this.ownsAbilitiesManager = false;
    } else {
      this.abilitiesManager = new AbilitiesManager(
        join(this.projectDir, '.automatosx', 'abilities')
      );
      this.ownsAbilitiesManager = true;
    }

    // Initialize or use shared MemoryManager
    if (config.memoryManager) {
      this.memoryManager = config.memoryManager;
      this.ownsMemoryManager = false;
    } else {
      // Create own memory manager
      this.memoryManager = new LazyMemoryManager({
        dbPath: join(this.projectDir, '.automatosx', 'memory', 'memory.db')
      });
      this.ownsMemoryManager = true;
    }

    // Initialize or use shared PathResolver
    if (config.pathResolver) {
      this.pathResolver = config.pathResolver;
      this.ownsPathResolver = false;
    } else {
      this.pathResolver = new PathResolver({
        projectDir: this.projectDir,
        workingDir: this.projectDir,
        agentWorkspace: join(this.projectDir, '.automatosx', 'workspaces')
      });
      this.ownsPathResolver = true;
    }

    // Initialize or use shared Router
    if (config.router) {
      this.router = config.router;
      this.ownsRouter = false;
    } else {
      // Create providers from config
      const providers: BaseProvider[] = [];

      if (this.config.providers['claude-code']?.enabled) {
        const claudeConfig = this.config.providers['claude-code'];
        providers.push(new ClaudeProvider({
          name: 'claude-code',
          enabled: true,
          priority: claudeConfig.priority,
          timeout: claudeConfig.timeout,
          command: claudeConfig.command || 'claude'
        }));
      }

      if (this.config.providers['gemini-cli']?.enabled) {
        const geminiConfig = this.config.providers['gemini-cli'];
        providers.push(new GeminiProvider({
          name: 'gemini-cli',
          enabled: true,
          priority: geminiConfig.priority,
          timeout: geminiConfig.timeout,
          command: geminiConfig.command || 'gemini'
        }));
      }

      if (this.config.providers['openai']?.enabled) {
        const openaiConfig = this.config.providers['openai'];
        providers.push(new OpenAIProvider({
          name: 'openai',
          enabled: true,
          priority: openaiConfig.priority,
          timeout: openaiConfig.timeout,
          command: openaiConfig.command || 'codex'
        }));
      }

      // Create router
      this.router = new Router({
        providers,
        fallbackEnabled: true,
        healthCheckInterval: this.config.router?.healthCheckInterval,
        providerCooldownMs: this.config.router?.providerCooldownMs
      });
      this.ownsRouter = true;
    }

    // Initialize or use shared SessionManager
    if (config.sessionManager) {
      this.sessionManager = config.sessionManager;
      this.ownsSessionManager = false;
    } else {
      this.sessionManager = new SessionManager({
        persistencePath: join(this.projectDir, '.automatosx', 'sessions', 'sessions.json')
      });
      this.ownsSessionManager = true;

      // Initialize session manager (async operation - fire and forget)
      this.sessionManager.initialize().catch((error) => {
        logger.warn('Failed to initialize session manager', {
          error: (error as Error).message
        });
      });
    }

    // Initialize or use shared WorkspaceManager
    if (config.workspaceManager) {
      this.workspaceManager = config.workspaceManager;
      this.ownsWorkspaceManager = false;
    } else {
      this.workspaceManager = new WorkspaceManager(this.projectDir);
      this.ownsWorkspaceManager = true;
    }

    // Initialize or use shared ContextManager
    if (config.contextManager) {
      this.contextManager = config.contextManager;
      this.ownsContextManager = false;
    } else {
      this.contextManager = new ContextManager({
        profileLoader: this.profileLoader,
        abilitiesManager: this.abilitiesManager,
        memoryManager: this.memoryManager || null,
        router: this.router,
        pathResolver: this.pathResolver,
        sessionManager: this.sessionManager,
        workspaceManager: this.workspaceManager
      });
      this.ownsContextManager = true;
    }

    logger.debug('AgentExecutionService initialized (native mode)', {
      ownsRouter: this.ownsRouter,
      ownsSessionManager: this.ownsSessionManager,
      ownsMemoryManager: this.ownsMemoryManager,
      sharedResources: !this.ownsRouter || !this.ownsSessionManager
    });
  }

  /**
   * Execute an agent task using native in-process execution
   *
   * This method provides the same functionality as `ax run` but without
   * subprocess overhead, making it ideal for Spec-Kit workflows.
   *
   * @param options - Agent execution options
   * @returns Promise resolving to execution result
   */
  async execute(options: AgentExecutionServiceOptions): Promise<AgentExecutionServiceResult> {
    const startTime = Date.now();

    try {
      logger.debug('Native agent execution started', {
        agent: options.agentName,
        task: options.task.substring(0, 50) + (options.task.length > 50 ? '...' : ''),
        sessionId: options.sessionId,
        saveMemory: options.saveMemory
      });

      // Resolve agent name (supports display name → actual name)
      const resolvedAgentName = await this.profileLoader.resolveAgentName(options.agentName);

      // Join session if provided
      if (options.sessionId) {
        await this.sessionManager.addAgent(options.sessionId, resolvedAgentName);
      }

      // Create execution context
      const context = await this.contextManager.createContext(
        resolvedAgentName,
        options.task,
        {
          provider: options.provider,
          model: options.model,
          skipMemory: false, // Always inject memory for context
          sessionId: options.sessionId
        }
      );

      // Create agent executor
      const executor = new AgentExecutor({
        sessionManager: this.sessionManager,
        workspaceManager: this.workspaceManager,
        contextManager: this.contextManager,
        profileLoader: this.profileLoader,
        defaultRetryConfig: this.config.execution?.retry,
        config: this.config
      });

      // Execute agent
      const result = await executor.execute(context, {
        verbose: options.verbose,
        showProgress: false, // No progress bars in native execution
        timeout: options.timeout,
        streaming: {
          enabled: false // No streaming in native execution
        }
      });

      // Save to memory if requested
      if (options.saveMemory && this.memoryManager) {
        await this.memoryManager.add(
          result.response.content,
          null, // No embedding required (FTS5 mode)
          {
            type: 'task',
            source: 'agent-execution-service',
            agentId: resolvedAgentName,
            sessionId: options.sessionId,
            tags: [resolvedAgentName, 'task', 'native-execution']
          }
        );
      }

      const duration = Date.now() - startTime;

      logger.debug('Native agent execution completed', {
        agent: resolvedAgentName,
        duration,
        success: true
      });

      return {
        success: true,
        output: result.response.content,
        duration,
        response: result.response
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Native agent execution failed', {
        agent: options.agentName,
        error: (error as Error).message,
        duration
      });

      return {
        success: false,
        output: '',
        error: error as Error,
        duration
      };
    }
  }

  /**
   * Cleanup resources
   *
   * Cleans up only resources owned by this service instance.
   * Shared resources are left intact for other consumers.
   */
  async cleanup(): Promise<void> {
    logger.debug('AgentExecutionService cleanup started', {
      ownsRouter: this.ownsRouter,
      ownsSessionManager: this.ownsSessionManager,
      ownsMemoryManager: this.ownsMemoryManager
    });

    try {
      // Cleanup owned resources only
      if (this.ownsMemoryManager && this.memoryManager) {
        await this.memoryManager.close();
      }

      // Note: SessionManager and Router don't have close() methods
      // They are designed to be long-lived and cleanup automatically

      logger.debug('AgentExecutionService cleanup completed');
    } catch (error) {
      logger.warn('AgentExecutionService cleanup failed', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Get service statistics (for debugging)
   */
  getStats() {
    return {
      native: true,
      ownsRouter: this.ownsRouter,
      ownsSessionManager: this.ownsSessionManager,
      ownsMemoryManager: this.ownsMemoryManager
    };
  }
}
