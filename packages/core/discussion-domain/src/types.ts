/**
 * Discussion Domain Types
 *
 * Core types and interfaces for multi-model discussion orchestration.
 */

import type {
  DiscussionPattern,
  DiscussStepConfig,
  DiscussionRound,
  ConsensusResult,
  ConsensusMethod,
  VotingResults,
} from '@defai.digital/contracts';

// ============================================================================
// Provider Executor Interface
// ============================================================================

/**
 * Interface for executing prompts against LLM providers.
 *
 * This is a port interface that will be implemented by the provider adapters.
 * The discussion domain depends on this abstraction, not concrete providers.
 *
 * Invariants:
 * - INV-DISC-100: Provider availability must be checked before discussions
 * - INV-DISC-102: Provider timeout must be enforced
 */
export interface DiscussionProviderExecutor {
  /**
   * Execute a prompt against a specific provider
   */
  execute(request: ProviderExecuteRequest): Promise<ProviderExecuteResult>;

  /**
   * Check if a provider is available/healthy
   */
  isAvailable(providerId: string): Promise<boolean>;

  /**
   * Get list of available providers
   */
  getAvailableProviders(): Promise<string[]>;
}

/**
 * Request to execute a prompt against a provider
 */
export interface ProviderExecuteRequest {
  /** Provider to use (e.g., 'claude', 'gemini', 'codex', 'grok') */
  providerId: string;

  /** The prompt to send */
  prompt: string;

  /** System prompt/context */
  systemPrompt?: string | undefined;

  /** Temperature (0-2) */
  temperature?: number | undefined;

  /** Max tokens for response */
  maxTokens?: number | undefined;

  /** Timeout in milliseconds */
  timeoutMs?: number | undefined;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal | undefined;
}

/**
 * Result from provider execution
 */
export interface ProviderExecuteResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Response content */
  content?: string | undefined;

  /** Error message if failed */
  error?: string | undefined;

  /** Whether error is retryable */
  retryable?: boolean | undefined;

  /** Duration in milliseconds */
  durationMs: number;

  /** Token count if available */
  tokenCount?: number | undefined;

  /** Whether response was truncated */
  truncated?: boolean | undefined;
}

// ============================================================================
// Pattern Executor Interface
// ============================================================================

/**
 * Cascading confidence configuration for early exit
 */
export interface CascadingConfidenceOptions {
  /** Whether cascading confidence is enabled */
  enabled: boolean;

  /** Confidence threshold for early exit (0-1) */
  threshold: number;

  /** Minimum providers before early exit allowed */
  minProviders: number;
}

/**
 * Context passed to pattern executors
 */
export interface PatternExecutionContext {
  /** The discussion configuration */
  config: DiscussStepConfig;

  /** Provider executor for making calls */
  providerExecutor: DiscussionProviderExecutor;

  /** Providers that are available */
  availableProviders: string[];

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal | undefined;

  /** Trace ID for debugging */
  traceId?: string | undefined;

  /** Callback for progress updates */
  onProgress?: ((event: DiscussionProgressEvent) => void) | undefined;

  /** Cascading confidence configuration for early exit */
  cascadingConfidence?: CascadingConfidenceOptions | undefined;
}

/**
 * Progress event during discussion execution
 */
export interface DiscussionProgressEvent {
  type: 'round_start' | 'provider_start' | 'provider_complete' | 'round_complete' | 'synthesis_start' | 'synthesis_complete';
  round?: number | undefined;
  provider?: string | undefined;
  message?: string | undefined;
  timestamp: string;
}

/**
 * Early exit information
 */
export interface EarlyExitInfo {
  /** Whether early exit was triggered */
  triggered: boolean;

  /** Reason for early exit decision */
  reason?: string | undefined;

  /** Number of providers at exit point */
  atProviderCount?: number | undefined;

  /** Confidence score that triggered exit */
  confidenceScore?: number | undefined;
}

/**
 * Result from pattern execution
 */
export interface PatternExecutionResult {
  /** All discussion rounds */
  rounds: DiscussionRound[];

  /** Providers that participated successfully */
  participatingProviders: string[];

  /** Providers that failed */
  failedProviders: string[];

  /** Total duration in milliseconds */
  totalDurationMs: number;

  /** Whether execution succeeded (enough providers participated) */
  success: boolean;

  /** Error if execution failed */
  error?: string | undefined;

  /** Early exit information */
  earlyExit?: EarlyExitInfo | undefined;
}

/**
 * Interface for discussion pattern executors
 */
export interface PatternExecutor {
  /** Pattern type this executor handles */
  readonly pattern: DiscussionPattern;

  /**
   * Execute the discussion pattern
   */
  execute(context: PatternExecutionContext): Promise<PatternExecutionResult>;
}

// ============================================================================
// Consensus Executor Interface
// ============================================================================

/**
 * Context for consensus execution
 */
export interface ConsensusExecutionContext {
  /** Original topic/prompt */
  topic: string;

  /** All discussion rounds */
  rounds: DiscussionRound[];

  /** Providers that participated */
  participatingProviders: string[];

  /** Consensus configuration */
  config: DiscussStepConfig['consensus'];

  /** Agent weight multiplier for consensus (INV-DISC-642) */
  agentWeightMultiplier?: number | undefined;

  /** Provider executor for synthesis calls */
  providerExecutor: DiscussionProviderExecutor;

  /** Abort signal */
  abortSignal?: AbortSignal | undefined;

  /** Progress callback */
  onProgress?: ((event: DiscussionProgressEvent) => void) | undefined;
}

/**
 * Result from consensus execution
 */
export interface ConsensusExecutionResult {
  /** Synthesized final output */
  synthesis: string;

  /** Consensus details */
  consensus: ConsensusResult;

  /** Voting results if applicable */
  votingResults?: VotingResults | undefined;

  /** Duration in milliseconds */
  durationMs: number;

  /** Whether consensus was reached */
  success: boolean;

  /** Error if failed */
  error?: string | undefined;
}

/**
 * Interface for consensus mechanism executors
 */
export interface ConsensusExecutor {
  /** Consensus method this executor handles */
  readonly method: ConsensusMethod;

  /**
   * Execute consensus mechanism
   */
  execute(context: ConsensusExecutionContext): Promise<ConsensusExecutionResult>;
}

// ============================================================================
// Discussion Executor Options
// ============================================================================

/**
 * Options for creating a discussion executor
 */
export interface DiscussionExecutorOptions {
  /** Provider executor implementation */
  providerExecutor: DiscussionProviderExecutor;

  /** Default timeout per provider in milliseconds */
  defaultTimeoutMs?: number | undefined;

  /** Whether to check provider health before starting */
  checkProviderHealth?: boolean | undefined;

  /** Trace ID for debugging */
  traceId?: string | undefined;
}

// ============================================================================
// Recursive Discussion Types
// ============================================================================

import type {
  DiscussionContext,
  TimeoutConfig,
  RecursiveConfig,
  CostControlConfig,
  SubDiscussionResult,
} from '@defai.digital/contracts';

/**
 * Extended options for recursive discussion executor
 */
export interface RecursiveDiscussionExecutorOptions extends DiscussionExecutorOptions {
  /** Recursive discussion configuration */
  recursive?: RecursiveConfig | undefined;

  /** Timeout configuration */
  timeout?: TimeoutConfig | undefined;

  /** Cost control configuration */
  cost?: CostControlConfig | undefined;

  /** Parent context for nested discussions */
  parentContext?: DiscussionContext | undefined;

  /** Callback when sub-discussion is spawned */
  onSubDiscussionSpawn?: ((context: DiscussionContext, topic: string) => void) | undefined;

  /** Callback when sub-discussion completes */
  onSubDiscussionComplete?: ((result: SubDiscussionResult) => void) | undefined;
}

/**
 * Extended pattern execution context for recursive discussions
 */
export interface RecursivePatternExecutionContext extends PatternExecutionContext {
  /** Discussion context for recursion tracking */
  discussionContext?: DiscussionContext | undefined;

  /** Whether sub-discussions are allowed */
  allowSubDiscussions?: boolean | undefined;

  /** Function to spawn a sub-discussion */
  spawnSubDiscussion?: ((topic: string, providers?: string[]) => Promise<SubDiscussionResult | null>) | undefined;
}

/**
 * Extended pattern execution result with sub-discussion info
 */
export interface RecursivePatternExecutionResult extends PatternExecutionResult {
  /** Sub-discussions spawned during execution */
  subDiscussions?: SubDiscussionResult[] | undefined;

  /** Total calls including sub-discussions */
  totalProviderCalls?: number | undefined;
}

/**
 * Sub-discussion request
 */
export interface SubDiscussionRequest {
  /** Topic for sub-discussion */
  topic: string;

  /** Providers to use (optional, uses parent's allowed providers) */
  providers?: string[] | undefined;

  /** Pattern to use (defaults to synthesis) */
  pattern?: DiscussionPattern | undefined;

  /** Maximum rounds (defaults to 1 for sub-discussions) */
  rounds?: number | undefined;

  /** Requesting provider ID */
  requestedBy: string;
}

// ============================================================================
// Stub Provider Executor (for testing/development)
// ============================================================================

/**
 * Stub provider executor that returns mock responses.
 * Used for testing and development when real providers aren't available.
 */
export class StubProviderExecutor implements DiscussionProviderExecutor {
  private availableProviders: Set<string>;
  private responseDelay: number;

  constructor(
    providers: string[] = ['claude', 'grok', 'gemini'],
    responseDelayMs = 100
  ) {
    this.availableProviders = new Set(providers);
    this.responseDelay = responseDelayMs;
  }

  async execute(request: ProviderExecuteRequest): Promise<ProviderExecuteResult> {
    const start = Date.now();

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, this.responseDelay));

    if (!this.availableProviders.has(request.providerId)) {
      return {
        success: false,
        error: `Provider ${request.providerId} not available`,
        retryable: false,
        durationMs: Date.now() - start,
      };
    }

    // Generate mock response based on provider
    const content = this.generateMockResponse(request.providerId, request.prompt);

    return {
      success: true,
      content,
      durationMs: Date.now() - start,
      tokenCount: content.length / 4, // Rough estimate
    };
  }

  async isAvailable(providerId: string): Promise<boolean> {
    return this.availableProviders.has(providerId);
  }

  async getAvailableProviders(): Promise<string[]> {
    return Array.from(this.availableProviders);
  }

  private generateMockResponse(providerId: string, prompt: string): string {
    const providerStyles: Record<string, string> = {
      claude: 'From a nuanced reasoning perspective',
      glm: 'From a practical implementation standpoint',
      gemini: 'Based on extensive research and analysis',
      codex: 'From a code-centric viewpoint',
      grok: 'With real-time context in mind',
    };

    const style = providerStyles[providerId] || 'In my analysis';
    const topicPreview = prompt.slice(0, 100).replace(/\n/g, ' ');

    // Check if this is a voting prompt
    if (prompt.includes('Your Vote:') || prompt.includes('evaluating options')) {
      // Extract options from prompt - try numbered list format first (1. Option)
      const numberedPattern = /^\d+\.\s*(.+)$/gm;
      const matches = [...prompt.matchAll(numberedPattern)];
      let options: string[];

      if (matches.length >= 2) {
        options = matches.map(m => m[1] ? m[1].trim() : '').filter(Boolean);
      } else {
        // Try comma-separated format
        const optionsMatch = /Options:\s*([^\n]+)/i.exec(prompt);
        options = optionsMatch?.[1]
          ? optionsMatch[1].split(/[,;]/).map(o => o.trim()).filter(Boolean)
          : ['Yes', 'No'];
      }

      const chosenOption = options[Math.floor(Math.random() * options.length)] || 'Yes';
      const confidence = 70 + Math.floor(Math.random() * 25); // 70-94%

      return `${style}, evaluating the options:\n\n` +
        `After careful consideration of each option:\n\n` +
        `Your Vote: [${chosenOption}]\n` +
        `Confidence: [${confidence}%]\n\n` +
        `Reasoning: This option best aligns with the requirements because ` +
        `it offers the most balanced approach. ${providerId} recommends this ` +
        `based on practical experience and technical merit.\n`;
    }

    return `${style}, regarding "${topicPreview}...":\n\n` +
      `This is a mock response from ${providerId}. ` +
      `In a real discussion, this would contain the provider's unique perspective ` +
      `based on its strengths and training.\n\n` +
      `Key points:\n` +
      `1. First consideration from ${providerId}\n` +
      `2. Second insight unique to this provider\n` +
      `3. Practical recommendation\n`;
  }

  /** Add a provider to available set (for testing) */
  addProvider(providerId: string): void {
    this.availableProviders.add(providerId);
  }

  /** Remove a provider from available set (for testing) */
  removeProvider(providerId: string): void {
    this.availableProviders.delete(providerId);
  }
}
