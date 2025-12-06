/**
 * AxCliSdkAdapter - SDK-based execution adapter (v10.4.0)
 *
 * Provides 10-40x performance improvement over CLI process spawning by
 * using the ax-cli SDK directly in-process.
 *
 * Performance characteristics:
 * - First call: ~50-100ms (agent initialization)
 * - Subsequent calls: ~5ms (direct function call)
 * - vs CLI: 50-200ms overhead per call
 *
 * New in v10.4.0:
 * - SubagentAdapter for parallel multi-agent execution
 * - CheckpointAdapter for resumable workflows
 * - InstructionsBridge for unified agent instructions
 *
 * @module integrations/ax-cli-sdk/adapter
 */

import type { AxCliAdapter, AxCliOptions } from '../ax-cli/interface.js';
import type { ExecutionResponse } from '../../types/provider.js';
import { logger } from '../../shared/logging/logger.js';
import { TokenEstimator } from './token-estimator.js';
import { SubagentAdapter, type SubagentTask, type SubagentResult, type OrchestratorOptions } from './subagent-adapter.js';
import { CheckpointAdapter, type Checkpoint, type Workflow, type CheckpointOptions } from './checkpoint-adapter.js';
import { InstructionsBridge, type CombinedInstructions, type InstructionsBridgeOptions, getInstructionsBridge } from './instructions-bridge.js';
import { AxCliMCPManager, getAxCliMCPManager, type MCPTemplate, type MCPServerConfig, type MCPManagerOptions } from './mcp-manager.js';
import type { SDKAgent, SDKStreamChunk, SDKChatEntry } from './sdk-types.js';

/**
 * SDK Adapter configuration options
 */
export interface SdkAdapterOptions {
  /** Reuse agent instances between calls (recommended for performance) */
  reuseEnabled?: boolean;

  /** Enable streaming events */
  streamingEnabled?: boolean;
}

/**
 * Default maximum tool execution rounds for SDK agent
 */
const DEFAULT_MAX_TOOL_ROUNDS = 400;

/**
 * Agent configuration for tracking (SDK handles actual config via settings)
 */
interface AgentConfig {
  maxToolRounds: number;
}

/**
 * Adapter for ax-cli SDK (programmatic API)
 *
 * Features:
 * - In-process execution (no process spawning)
 * - Direct ExecutionResponse format (no parsing)
 * - Agent reuse for performance
 * - Streaming event support
 * - Automatic error mapping
 */
export class AxCliSdkAdapter implements AxCliAdapter {
  // PRODUCTION FIX: Use typed SDKAgent interface instead of 'any'
  private agent: SDKAgent | null = null;
  private agentConfig: AgentConfig | null = null;
  private initPromise: Promise<void> | null = null;
  private executionLock: Promise<void> = Promise.resolve();
  private readonly reuseEnabled: boolean;
  private readonly streamingEnabled: boolean;
  private sdkAvailable: boolean | null = null;

  // New adapters (v10.4.0)
  private subagentAdapter: SubagentAdapter | null = null;
  private checkpointAdapter: CheckpointAdapter | null = null;
  private instructionsBridge: InstructionsBridge | null = null;
  private mcpManager: AxCliMCPManager | null = null;

  constructor(options: SdkAdapterOptions = {}) {
    this.reuseEnabled = options.reuseEnabled ?? true;
    this.streamingEnabled = options.streamingEnabled ?? false;

    logger.debug('AxCliSdkAdapter initialized', {
      reuseEnabled: this.reuseEnabled,
      streamingEnabled: this.streamingEnabled
    });
  }

  // ==========================================
  // Subagent Orchestration (v10.4.0)
  // ==========================================

  /**
   * Get or create SubagentAdapter for parallel multi-agent execution
   *
   * BUG FIX: Log warning when options are provided but adapter already exists,
   * as the options will be ignored.
   *
   * @example
   * ```typescript
   * const subagents = adapter.getSubagentAdapter();
   * const results = await subagents.executeParallel([
   *   { task: 'Implement API', config: { role: 'developer' } },
   *   { task: 'Write tests', config: { role: 'tester' } }
   * ]);
   * ```
   */
  getSubagentAdapter(options?: OrchestratorOptions): SubagentAdapter {
    if (!this.subagentAdapter) {
      this.subagentAdapter = new SubagentAdapter(options);
      logger.debug('SubagentAdapter created');
    } else if (options) {
      // BUG FIX: Warn when options are provided but adapter already exists
      logger.warn('SubagentAdapter already exists, ignoring new options', {
        hint: 'Call destroy() first to recreate with new options'
      });
    }
    return this.subagentAdapter;
  }

  /**
   * Execute multiple tasks in parallel using subagents
   * Convenience method that wraps SubagentAdapter.executeParallel()
   */
  async executeParallelTasks(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const adapter = this.getSubagentAdapter();
    return adapter.executeParallel(tasks);
  }

  /**
   * Execute tasks sequentially with context propagation
   * Convenience method that wraps SubagentAdapter.executeSequential()
   */
  async executeSequentialTasks(tasks: SubagentTask[]): Promise<SubagentResult[]> {
    const adapter = this.getSubagentAdapter();
    return adapter.executeSequential(tasks);
  }

  // ==========================================
  // Checkpoint/Resume Support (v10.4.0)
  // ==========================================

  /**
   * Get or create CheckpointAdapter for resumable workflows
   *
   * BUG FIX: Log warning when options are provided but adapter already exists,
   * as the options will be ignored.
   *
   * @example
   * ```typescript
   * const checkpoints = adapter.getCheckpointAdapter();
   * await checkpoints.save('my-workflow', { phase: 2, context: '...' });
   * const latest = await checkpoints.load('my-workflow');
   * ```
   */
  getCheckpointAdapter(options?: CheckpointOptions): CheckpointAdapter {
    if (!this.checkpointAdapter) {
      this.checkpointAdapter = new CheckpointAdapter(options);
      logger.debug('CheckpointAdapter created');
    } else if (options) {
      // BUG FIX: Warn when options are provided but adapter already exists
      logger.warn('CheckpointAdapter already exists, ignoring new options', {
        hint: 'Call destroy() first to recreate with new options'
      });
    }
    return this.checkpointAdapter;
  }

  /**
   * Save a checkpoint for a workflow
   * Convenience method that wraps CheckpointAdapter.save()
   */
  async saveCheckpoint(workflowId: string, data: Partial<Checkpoint>): Promise<Checkpoint> {
    const adapter = this.getCheckpointAdapter();
    return adapter.save(workflowId, data);
  }

  /**
   * Load the latest checkpoint for a workflow
   * Convenience method that wraps CheckpointAdapter.load()
   */
  async loadCheckpoint(workflowId: string): Promise<Checkpoint | null> {
    const adapter = this.getCheckpointAdapter();
    return adapter.load(workflowId);
  }

  /**
   * Check if a checkpoint exists and can be resumed
   */
  async canResumeWorkflow(workflowId: string): Promise<boolean> {
    const adapter = this.getCheckpointAdapter();
    return adapter.exists(workflowId);
  }

  /**
   * Get remaining phases for a workflow based on checkpoint
   */
  async getRemainingPhases(workflowId: string, workflow: Workflow): Promise<import('./checkpoint-adapter.js').WorkflowPhase[]> {
    const adapter = this.getCheckpointAdapter();
    return adapter.getRemainingPhases(workflowId, workflow);
  }

  // ==========================================
  // Instructions Bridge (v10.4.0)
  // ==========================================

  /**
   * Get or create InstructionsBridge for unified agent instructions
   *
   * BUG FIX: Log warning when options are provided but bridge already exists,
   * as the options will be ignored.
   *
   * @example
   * ```typescript
   * const bridge = adapter.getInstructionsBridge();
   * const instructions = await bridge.getInstructions('backend');
   * // instructions.systemPrompt contains merged agent + custom instructions
   * ```
   */
  getInstructionsBridge(options?: InstructionsBridgeOptions): InstructionsBridge {
    if (!this.instructionsBridge) {
      this.instructionsBridge = getInstructionsBridge(options);
      logger.debug('InstructionsBridge created');
    } else if (options) {
      // BUG FIX: Warn when options are provided but bridge already exists
      logger.warn('InstructionsBridge already exists, ignoring new options', {
        hint: 'Call destroy() first to recreate with new options'
      });
    }
    return this.instructionsBridge;
  }

  /**
   * Get combined instructions for an agent
   * Convenience method that wraps InstructionsBridge.getInstructions()
   */
  async getAgentInstructions(agentName: string, additionalContext?: string): Promise<CombinedInstructions> {
    const bridge = this.getInstructionsBridge();
    return bridge.getInstructions(agentName, additionalContext);
  }

  /**
   * Sync an AutomatosX agent profile to ax-cli custom instructions
   */
  async syncAgentToAxCli(agentName: string): Promise<void> {
    const bridge = this.getInstructionsBridge();
    return bridge.syncAgentToAxCli(agentName);
  }

  // ==========================================
  // MCP Manager (v10.4.1)
  // ==========================================

  /**
   * Get or create MCP Manager for ax-cli MCP server management
   *
   * BUG FIX: Log warning when options are provided but manager already exists,
   * as the options will be ignored.
   *
   * @example
   * ```typescript
   * const mcp = adapter.getMCPManager();
   * const templates = await mcp.getTemplateNames();
   * await mcp.addFromTemplate('github', { GITHUB_TOKEN: 'xxx' });
   * ```
   */
  getMCPManager(options?: MCPManagerOptions): AxCliMCPManager {
    if (!this.mcpManager) {
      this.mcpManager = getAxCliMCPManager(options);
      logger.debug('AxCliMCPManager created');
    } else if (options) {
      // BUG FIX: Warn when options are provided but manager already exists
      logger.warn('AxCliMCPManager already exists, ignoring new options', {
        hint: 'Call destroy() first to recreate with new options'
      });
    }
    return this.mcpManager;
  }

  /**
   * Get all available MCP template names
   * Convenience method that wraps MCPManager.getTemplateNames()
   */
  async getMCPTemplateNames(): Promise<string[]> {
    const mcp = this.getMCPManager();
    const result = await mcp.getTemplateNames();
    return result.ok ? result.value : [];
  }

  /**
   * Get a specific MCP template
   * Convenience method that wraps MCPManager.getTemplate()
   */
  async getMCPTemplate(name: string): Promise<MCPTemplate | null> {
    const mcp = this.getMCPManager();
    const result = await mcp.getTemplate(name);
    return result.ok ? result.value : null;
  }

  /**
   * Add an MCP server from template
   * Convenience method that wraps MCPManager.addFromTemplate()
   */
  async addMCPFromTemplate(templateName: string, env?: Record<string, string>): Promise<boolean> {
    const mcp = this.getMCPManager();
    const result = await mcp.addFromTemplate(templateName, env);
    return result.ok;
  }

  /**
   * List all configured MCP servers
   * Convenience method that wraps MCPManager.listServers()
   */
  async listMCPServers(): Promise<string[]> {
    const mcp = this.getMCPManager();
    const result = await mcp.listServers();
    return result.ok ? result.value : [];
  }

  /**
   * Execute prompt via SDK
   *
   * Performance: ~5ms overhead vs ~50-200ms for CLI spawning
   */
  async execute(prompt: string, options: AxCliOptions): Promise<ExecutionResponse> {
    return this.runExclusive(() => this.executeInternal(prompt, options));
  }

  /**
   * Serialize executions to avoid chat history corruption and token mis-tracking
   * when the same adapter instance is used concurrently.
   */
  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const resultPromise = this.executionLock.then(fn, fn);
    this.executionLock = resultPromise.then(
      () => Promise.resolve(),
      () => Promise.resolve()
    );
    return resultPromise;
  }

  private async executeInternal(prompt: string, options: AxCliOptions): Promise<ExecutionResponse> {
    const startTime = Date.now();

    // Token tracking from SDK events
    let totalTokens = 0;

    try {
      // Ensure SDK is available
      if (!(await this.ensureSDKAvailable())) {
        throw new Error('ax-cli SDK not available. Install with: npm install @defai.digital/ax-cli');
      }

      // Initialize or recreate agent if config changed (serialized via initPromise)
      await this.ensureAgent(options);

      logger.debug('Executing via SDK (streaming mode for token tracking)', {
        promptLength: prompt.length,
        userWantsCallbacks: !!(options.onStream || options.onTool),
        note: 'SDK handles custom instructions and project memory'
      });

      // Use streaming API internally (even if user doesn't want callbacks)
      // This is the ONLY way to get token counts from SDK

      // Get history length before execution (to identify new entries)
      // BUG FIX (v11.3.3): Handle case where getChatHistory() is not available
      // or returns undefined/null. Some SDK agent implementations may not
      // expose this method or may return empty results.
      // BUG FIX (v11.3.4): Add null guard for this.agent before property access
      const chatHistory = this.agent && typeof this.agent.getChatHistory === 'function'
        ? this.agent.getChatHistory()
        : null;
      const historyLengthBefore = Array.isArray(chatHistory) ? chatHistory.length : 0;

      // PRODUCTION FIX: Assert agent is not null (ensureAgent guarantees this)
      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      for await (const chunk of this.agent.processUserMessageStream(prompt)) {
        // Track token counts from chunks
        if (chunk.type === 'token_count' && chunk.tokenCount) {
          totalTokens += chunk.tokenCount;
          logger.debug('Token count from stream', {
            count: chunk.tokenCount,
            total: totalTokens
          });
        }

        // Forward streaming callbacks if user wants them
        if (options.onStream && (chunk.type === 'content' || chunk.type === 'reasoning')) {
          try {
            options.onStream({
              type: chunk.type === 'reasoning' ? 'thinking' : 'content',
              content: chunk.content || chunk.reasoningContent,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            logger.warn('Stream callback error', {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        if (options.onTool && chunk.type === 'tool_calls' && chunk.toolCalls) {
          try {
            for (const toolCall of chunk.toolCalls) {
              options.onTool({
                name: toolCall.function.name,
                args: toolCall.function.arguments
              });
            }
          } catch (error) {
            logger.warn('Tool callback error', {
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      // Get only the NEW entries from this execution
      // BUG FIX (v11.3.3): Handle case where getChatHistory() is not available
      // BUG FIX (v11.3.4): Add null guard for this.agent before property access
      const fullHistory = this.agent && typeof this.agent.getChatHistory === 'function'
        ? this.agent.getChatHistory()
        : [];
      const result = Array.isArray(fullHistory) ? fullHistory.slice(historyLengthBefore) : [];

      logger.debug('Chat history extraction', {
        historyLengthBefore,
        historyLengthAfter: fullHistory.length,
        newEntries: result.length,
        entryTypes: result.map((e: any) => e.type)
      });

      // Validate we got a response
      if (result.length === 0) {
        logger.error('No new chat entries after execution', {
          historyLengthBefore,
          historyLengthAfter: fullHistory.length,
          fullHistory: fullHistory.map((e: any) => ({ type: e.type, content: e.content?.substring(0, 50) }))
        });
        throw new Error('SDK did not add any new chat entries. This may indicate an execution error.');
      }

      // Convert SDK response to ExecutionResponse format
      const response = this.convertToExecutionResponse(result, prompt, startTime, totalTokens);

      logger.info('SDK execution successful', {
        model: response.model,
        contentLength: response.content.length,
        tokensUsed: response.tokensUsed.total,
        latencyMs: response.latencyMs
      });

      return response;
    } catch (error) {
      logger.error('SDK execution failed', {
        error: error instanceof Error ? error.message : String(error),
        note: 'Model configured via ax-cli setup'
      });

      // Map SDK errors to AutomatosX error format
      throw this.mapError(error);
    }
  }

  /**
   * Initialize or reinitialize agent
   *
   * IMPORTANT: The SDK loads ALL credentials (API key, base URL, model) from
   * ~/.ax-cli/config.json which is created by running "ax-cli setup".
   *
   * We do NOT pass credentials to the SDK - it manages its own configuration.
   */
  private async initializeAgent(options: AxCliOptions): Promise<void> {
    // Dispose any existing agent before creating a new one to avoid listener/memory leaks
    await this.destroyAgentInstance();

    // Dynamic import to avoid loading SDK unless needed
    const { createAgent } = await import('@defai.digital/ax-cli/sdk');

    try {
      // BUG FIX: Use ?? instead of || to allow maxToolRounds: 0 (disable tools)
      const config: AgentConfig = {
        maxToolRounds: options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS
      };

      logger.debug('Creating SDK agent (credentials from ax-cli settings)', {
        maxToolRounds: config.maxToolRounds,
        reuse: this.reuseEnabled,
        note: 'SDK loads apiKey, baseURL, model from ~/.ax-cli/config.json'
      });

      // Create agent via SDK
      // SDK will load apiKey, baseURL, model from ~/.ax-cli/config.json
      // Cast to SDKAgent as SDK's actual type may differ but must be compatible
      this.agent = await createAgent({
        maxToolRounds: config.maxToolRounds
      }) as unknown as SDKAgent;

      this.agentConfig = config;

      // Set up event handlers if streaming enabled
      if (this.streamingEnabled) {
        this.setupEventHandlers();
      }

      logger.info('SDK agent initialized successfully', {
        maxToolRounds: config.maxToolRounds,
        note: 'Using credentials from ax-cli setup'
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Check for common setup issues in error message
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes('setup') || errorMsg.includes('not configured')) {
        logger.error('ax-cli setup required', {
          error: error.message,
          solution: 'Run: ax-cli setup'
        });
        throw new Error(
          'ax-cli setup has not been run. Please run "ax-cli setup" to configure your API key, model, and base URL. ' +
          `Original error: ${error.message}`
        );
      }

      if (errorMsg.includes('api key') || errorMsg.includes('apikey')) {
        logger.error('API key not configured', {
          error: error.message,
          solution: 'Run: ax-cli setup'
        });
        throw new Error(
          `No API key configured in ax-cli settings. Please run "ax-cli setup" to configure your credentials. Original error: ${error.message}`
        );
      }

      if (errorMsg.includes('base url') || errorMsg.includes('baseurl') || errorMsg.includes('endpoint')) {
        logger.error('Base URL not configured', {
          error: error.message,
          solution: 'Run: ax-cli setup'
        });
        throw new Error(
          `No base URL configured in ax-cli settings. Please run "ax-cli setup" to configure your AI provider endpoint. Original error: ${error.message}`
        );
      }

      // Generic error handling
      logger.error('Failed to initialize SDK agent', {
        error: error.message
      });
      throw new Error(`Failed to initialize SDK agent: ${error.message}`);
    }
  }

  /**
   * Check if agent config has changed (requires new agent)
   *
   * Since SDK manages credentials via settings, we only track maxToolRounds
   * v11.2.8: Removed unnecessary async (no async operations)
   */
  private hasConfigChanged(options: AxCliOptions): boolean {
    if (!this.agentConfig) return true;

    // BUG FIX: Use ?? instead of || to allow maxToolRounds: 0 (disable tools)
    const changed = this.agentConfig.maxToolRounds !== (options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS);

    if (changed) {
      logger.debug('Agent config changed, will reinitialize', {
        oldMaxToolRounds: this.agentConfig.maxToolRounds,
        newMaxToolRounds: options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS,
        note: 'SDK credentials managed by ax-cli setup'
      });
    }

    return changed;
  }

  /**
   * Ensure agent is initialized exactly once even if execute() is called
   * concurrently. Reinitializes when config changes.
   *
   * BUG FIX: If config changes while initialization is in progress, we need to
   * wait for current init to complete, then reinitialize with new config.
   *
   * BUG FIX (v11.3.3): Track initialization errors to prevent repeated init
   * attempts from creating a retry storm. If init fails, remember the error
   * and rethrow it for subsequent callers until reset.
   */
  private initError: Error | null = null;

  private async ensureAgent(options: AxCliOptions): Promise<void> {
    // Fast path: agent exists and config hasn't changed
    if (this.agent && !this.hasConfigChanged(options)) {
      return;
    }

    // BUG FIX: If previous initialization failed, rethrow immediately
    // to prevent retry storms. Reset via destroy() to allow retry.
    if (this.initError && !this.agent) {
      throw this.initError;
    }

    // If there's an initialization in progress, wait for it first
    if (this.initPromise) {
      await this.initPromise;
      // After waiting, check again if we still need to reinitialize
      // (the completed init might have used different config)
      if (this.agent && !this.hasConfigChanged(options)) {
        return;
      }
      // Also check if the in-progress init failed
      if (this.initError) {
        throw this.initError;
      }
    }

    // Start new initialization - clear any previous error
    this.initError = null;
    this.initPromise = this.initializeAgent(options)
      .catch((error) => {
        // BUG FIX: Capture initialization error for subsequent callers
        this.initError = error instanceof Error ? error : new Error(String(error));
        throw error;
      })
      .finally(() => {
        this.initPromise = null;
      });

    await this.initPromise;
  }

  /**
   * Set up streaming event handlers (for initialization)
   *
   * BUG FIX (v11.3.3): Check if removeAllListeners exists before calling it.
   * Not all SDK agent implementations extend EventEmitter, and calling
   * a non-existent method would cause an error. Use optional chaining and
   * type guards to safely handle this.
   */
  private setupEventHandlers(): void {
    if (!this.agent) return;

    try {
      // BUG FIX: Safely remove existing listeners to prevent accumulation
      // Check if the agent has EventEmitter-like methods before calling them
      if (typeof this.agent.removeAllListeners === 'function') {
        this.agent.removeAllListeners('stream');
        this.agent.removeAllListeners('tool');
        this.agent.removeAllListeners('error');
      } else if (typeof this.agent.off === 'function') {
        // Fallback for agents that use off() instead of removeAllListeners()
        // We can't remove all without knowing the listener refs, so just skip
        logger.debug('Agent uses off() instead of removeAllListeners(), skipping listener cleanup');
      }

      // BUG FIX: Check if agent supports event subscription before adding listeners
      if (typeof this.agent.on !== 'function') {
        logger.debug('Agent does not support event subscription, skipping event handlers');
        return;
      }

      // SDK events: 'stream', 'tool', 'reasoning', etc.
      this.agent.on('stream', (chunk: any) => {
        logger.debug('Stream chunk received', {
          type: chunk.type,
          contentLength: chunk.content?.length
        });
      });

      this.agent.on('tool', (data: any) => {
        logger.debug('Tool invocation', {
          name: data.name
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.agent.on('error', (error: any) => {
        logger.error('Agent error event', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    } catch (error) {
      logger.warn('Failed to setup event handlers', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Extract token usage from various sources with priority:
   * 1. SDK events (token_count emissions) - most accurate
   * 2. Usage object (ChatEntry.usage or response.usage)
   * 3. Estimation fallback
   */
  private extractTokenUsage(
    prompt: string,
    content: string,
    totalTokensFromEvents: number,
    usageObject: any,
    sourceName: string
  ): { prompt: number; completion: number; total: number } {
    // Priority 1: SDK events (100% accurate total)
    if (totalTokensFromEvents > 0) {
      const estimated = TokenEstimator.estimateUsage(prompt, content);
      const tokens = {
        prompt: estimated.prompt,
        completion: estimated.completion,
        total: totalTokensFromEvents
      };

      logger.info(`Using token count from SDK events${sourceName ? ` (${sourceName})` : ''}`, {
        tokens: TokenEstimator.format(tokens),
        accuracy: '100% (total), 80-90% (split)',
        source: 'token_count events'
      });
      return tokens;
    }

    // Priority 2: Usage object from response
    // BUG FIX: Use nullish coalescing (??) instead of logical OR (||) to properly handle
    // zero values. If a provider returns completion_tokens: 0, || would skip it and check
    // the next property, while ?? correctly preserves the zero value.
    // BUG FIX: Coerce values to numbers and derive total from prompt+completion if not provided
    const usage = usageObject || {};
    const promptTokens = Number(usage.prompt_tokens ?? usage.prompt ?? usage.input ?? usage.promptTokens ?? 0) || 0;
    const completionTokens = Number(usage.completion_tokens ?? usage.completion ?? usage.output ?? usage.completionTokens ?? 0) || 0;
    const totalFromUsage = Number(usage.total_tokens ?? usage.total ?? usage.totalTokens ?? 0) || 0;

    // Derive total from prompt + completion if total is not provided but components are
    const actualTokens = {
      prompt: promptTokens,
      completion: completionTokens,
      total: totalFromUsage > 0 ? totalFromUsage : (promptTokens + completionTokens)
    };

    if (actualTokens.total > 0) {
      logger.info(`Using token counts from ${sourceName || 'usage object'}`, {
        tokens: TokenEstimator.format(actualTokens),
        accuracy: totalFromUsage > 0 ? '100%' : '100% (derived from prompt+completion)',
        source: sourceName || 'usage'
      });
      return actualTokens;
    }

    // Priority 3: Estimation fallback
    const estimated = TokenEstimator.estimateUsage(prompt, content);
    logger.warn(`SDK did not provide token counts${sourceName ? ` (${sourceName})` : ''}, using estimation`, {
      tokens: TokenEstimator.format(estimated, true),
      accuracy: '80-90% (estimated)',
      source: 'estimation'
    });
    return estimated;
  }

  /**
   * Convert SDK response to ExecutionResponse format
   *
   * SDK returns an array of chat entries:
   * [
   *   { type: "user", content: "...", timestamp: "..." },
   *   { type: "assistant", content: "...", timestamp: "..." }
   * ]
   *
   * Token usage priority: SDK events (totalTokens) > ChatEntry.usage > estimation fallback
   */
  private convertToExecutionResponse(result: any, prompt: string, startTime: number, totalTokensFromEvents: number = 0): ExecutionResponse {
    const latencyMs = Date.now() - startTime;

    // SDK returns array of chat entries
    if (Array.isArray(result)) {
      // Find the last assistant message
      const assistantMessages = result.filter((entry: any) => entry.type === 'assistant');

      if (assistantMessages.length === 0) {
        logger.error('No assistant message in result', {
          resultLength: result.length,
          entryTypes: result.map((e: any) => e.type),
          entries: result.map((e: any) => ({
            type: e.type,
            content: e.content?.substring(0, 100),
            hasToolCalls: !!e.toolCalls,
            hasToolResults: !!e.toolResult
          }))
        });
        throw new Error(`No assistant response found in SDK result. Got ${result.length} entries with types: ${result.map((e: any) => e.type).join(', ')}`);
      }

      // Get the last assistant message
      const lastAssistant = assistantMessages[assistantMessages.length - 1];
      const content = lastAssistant.content || '';

      const tokensUsed = this.extractTokenUsage(
        prompt,
        content,
        totalTokensFromEvents,
        lastAssistant.usage || lastAssistant.tokens,
        'ChatEntry.usage'
      );

      return {
        content,
        model: this.agent?.getCurrentModel?.() ?? 'unknown',
        tokensUsed,
        latencyMs,
        finishReason: 'stop',
        cached: false
      };
    }

    // Fallback: single response object (if SDK API changes)
    // BUG FIX (v11.3.3): Handle null/undefined result gracefully to avoid
    // TypeError when accessing result.content or result.usage
    const content = typeof result === 'string'
      ? result
      : (result?.content || result?.text || '');

    const tokensUsed = this.extractTokenUsage(
      prompt,
      content,
      totalTokensFromEvents,
      result?.usage || result?.tokens,
      'response.usage (fallback path)'
    );

    return {
      content,
      model: this.agent?.getCurrentModel?.() ?? 'unknown',
      tokensUsed,
      latencyMs,
      finishReason: 'stop',
      cached: false
    };
  }

  /** Error mapping patterns: [patterns, prefix, code] */
  private static readonly ERROR_MAPPINGS: ReadonlyArray<[string[], string, string]> = [
    [['rate limit', 'rate_limit'], 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED'],
    [['context length', 'max_tokens'], 'Context length exceeded', 'CONTEXT_LENGTH_EXCEEDED'],
    [['timeout', 'timed out'], 'Request timeout', 'TIMEOUT'],
    [['invalid api key', 'authentication'], 'Authentication failed', 'AUTHENTICATION_FAILED'],
    [['network', 'econnrefused'], 'Network error', 'NETWORK_ERROR'],
  ];

  /**
   * Map SDK errors to AutomatosX error types
   */
  private mapError(error: unknown): Error {
    if (!(error instanceof Error)) {
      return new Error(`SDK error: ${String(error)}`);
    }

    const message = error.message.toLowerCase();

    // Find matching error pattern
    for (const [patterns, prefix, code] of AxCliSdkAdapter.ERROR_MAPPINGS) {
      if (patterns.some(pattern => message.includes(pattern))) {
        const mappedError = new Error(`${prefix}: ${error.message}`);
        (mappedError as any).code = code;
        return mappedError;
      }
    }

    // Pass through other errors
    return error;
  }

  /**
   * Ensure SDK is available
   */
  private async ensureSDKAvailable(): Promise<boolean> {
    if (this.sdkAvailable !== null) {
      return this.sdkAvailable;
    }

    try {
      // Try to import SDK
      await import('@defai.digital/ax-cli/sdk');
      this.sdkAvailable = true;
      logger.debug('SDK is available');
      return true;
    } catch (error) {
      this.sdkAvailable = false;
      logger.warn('SDK not available', {
        error: error instanceof Error ? error.message : String(error),
        hint: 'Run: npm install @defai.digital/ax-cli'
      });
      return false;
    }
  }

  /**
   * Check if SDK is available
   */
  async isAvailable(): Promise<boolean> {
    return await this.ensureSDKAvailable();
  }

  /**
   * Get SDK version
   */
  async getVersion(): Promise<string> {
    // Reuse SDK availability check to avoid duplicate import
    if (await this.ensureSDKAvailable()) {
      // SDK doesn't expose version directly, return expected version
      return '3.14.5+';
    }
    return 'unknown';
  }

  /**
   * Get command name (for compatibility with AxCliAdapter interface)
   */
  getCommand(): string {
    return 'ax-cli-sdk';
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    return 'ax-cli (SDK)';
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.destroyAgentInstance();

    // Cleanup SubagentAdapter (v10.4.0)
    if (this.subagentAdapter) {
      try {
        await this.subagentAdapter.destroy();
        this.subagentAdapter = null;
        logger.debug('SubagentAdapter destroyed');
      } catch (error) {
        logger.warn('Error during SubagentAdapter cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup CheckpointAdapter (v10.4.0)
    // BUG FIX: Handle async destroy to ensure pending checkpoint is flushed
    if (this.checkpointAdapter) {
      try {
        const result = this.checkpointAdapter.destroy();
        if (result instanceof Promise) {
          await result;
        }
        this.checkpointAdapter = null;
        logger.debug('CheckpointAdapter destroyed');
      } catch (error) {
        logger.warn('Error during CheckpointAdapter cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup InstructionsBridge cache (v10.4.0)
    if (this.instructionsBridge) {
      try {
        this.instructionsBridge.clearCache();
        this.instructionsBridge = null;
        logger.debug('InstructionsBridge cache cleared');
      } catch (error) {
        logger.warn('Error during InstructionsBridge cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cleanup MCP Manager (v10.4.1)
    if (this.mcpManager) {
      try {
        const shutdownResult = await this.mcpManager.shutdown();
        if (!shutdownResult.ok) {
          logger.warn('Error while shutting down MCP servers', {
            error: shutdownResult.error instanceof Error ? shutdownResult.error.message : String(shutdownResult.error)
          });
        }
      } catch (error) {
        logger.warn('Error during MCP Manager cleanup', {
          error: error instanceof Error ? error.message : String(error)
        });
      } finally {
        this.mcpManager = null;
        logger.debug('MCP Manager cleared');
      }
    }
  }

  /**
   * Dispose the primary agent without touching ancillary adapters.
   * BUG FIX (v11.3.3): Also clear initError to allow retry after destroy.
   */
  private async destroyAgentInstance(): Promise<void> {
    // BUG FIX: Clear initError to allow retry after destroy
    this.initError = null;

    if (!this.agent) return;

    try {
      if (this.agent.dispose) {
        const result = this.agent.dispose();
        if (result instanceof Promise) {
          await result;
        }
      }
    } catch (error) {
      logger.warn('Error during agent cleanup', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.agent = null;
      this.agentConfig = null;
      logger.debug('SDK agent destroyed');
    }
  }
}

// Re-export types for convenience
export type {
  SubagentTask,
  SubagentResult,
  OrchestratorOptions,
  Checkpoint,
  Workflow,
  CheckpointOptions,
  CombinedInstructions,
  InstructionsBridgeOptions,
  MCPTemplate,
  MCPServerConfig,
  MCPManagerOptions
};

// Re-export MCP manager
export { AxCliMCPManager, getAxCliMCPManager, resetAxCliMCPManager } from './mcp-manager.js';
