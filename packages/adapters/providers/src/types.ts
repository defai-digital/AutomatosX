/**
 * Provider adapter types (CLI-based)
 *
 * DESIGN: AutomatosX does NOT manage credentials.
 * Each provider CLI handles its own authentication:
 * - claude, gemini, codex: Official CLIs with built-in auth
 * - ax-grok: Grok CLI wrapper (handles XAI_API_KEY)
 *
 * INV-MEM-003: Adapters must not accept domain objects directly
 */

/**
 * Message role in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * A message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * Request to generate a completion
 */
export interface CompletionRequest {
  /**
   * Unique request identifier
   */
  requestId: string;

  /**
   * The model to use for completion
   */
  model: string;

  /**
   * Messages to send to the model
   */
  messages: Message[];

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number | undefined;

  /**
   * Temperature for sampling (0-1)
   */
  temperature?: number | undefined;

  /**
   * Stop sequences
   */
  stopSequences?: string[] | undefined;

  /**
   * System prompt (if not included in messages)
   */
  systemPrompt?: string | undefined;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number | undefined;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Successful completion response
 */
export interface CompletionSuccess {
  success: true;
  requestId: string;
  content: string;
  model: string;
  usage: TokenUsage;
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'unknown';
  latencyMs: number;
  cached: boolean;
}

/**
 * Failed completion response
 */
export interface CompletionFailure {
  success: false;
  requestId: string;
  error: ClassifiedError;
  latencyMs: number;
}

/**
 * Completion response (discriminated union)
 */
export type CompletionResponse = CompletionSuccess | CompletionFailure;

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | 'authentication'
  | 'quota'
  | 'rate_limit'
  | 'validation'
  | 'network'
  | 'server'
  | 'timeout'
  | 'not_found'
  | 'configuration'
  | 'unknown';

/**
 * Classified error with retry/fallback guidance
 */
export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  shouldRetry: boolean;
  shouldFallback: boolean;
  retryAfterMs: number | null;
  originalError: unknown;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  providerId: string;
  timestamp: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  details: {
    cliAvailable: boolean;
    cliCommand: string;
    version?: string | undefined;
  };
}

/**
 * Model configuration
 */
export interface ModelConfig {
  modelId: string;
  name: string;
  contextWindow: number;
  capabilities: ('text' | 'code' | 'vision')[];
  isDefault?: boolean | undefined;
}

/**
 * CLI provider configuration
 * No API keys - CLIs handle their own authentication
 */
export interface CLIProviderConfig {
  /**
   * Provider identifier (e.g., 'claude', 'gemini')
   */
  providerId: string;

  /**
   * CLI command name (e.g., 'claude', 'gemini')
   */
  command: string;

  /**
   * Default CLI arguments
   */
  args: readonly string[];

  /**
   * Environment variables to set (non-secret)
   */
  env: Readonly<Record<string, string>>;

  /**
   * Expected output format
   */
  outputFormat: 'json' | 'stream-json' | 'text';

  /**
   * Default timeout in milliseconds
   */
  timeout: number;

  /**
   * Available models
   */
  models: readonly ModelConfig[];

  /**
   * How the prompt is passed to the CLI
   * - 'stdin': Write prompt to stdin (default for claude, gemini, codex)
   * - 'arg': Pass prompt as command-line argument (for ax-grok)
   */
  promptStyle?: 'stdin' | 'arg' | undefined;

  /**
   * Optional callback to detect when output is complete and process can be terminated early.
   * Called on each stdout data event. Return true to terminate the process immediately.
   * Useful for CLIs that hang during shutdown after producing valid output (e.g., ax-grok).
   */
  earlyTerminateOn?: ((stdout: string) => boolean) | undefined;
}

/**
 * LLM Provider interface (CLI-based)
 */
export interface LLMProvider {
  /**
   * Provider identifier (e.g., 'claude', 'gemini', 'ax-grok')
   */
  readonly providerId: string;

  /**
   * Provider configuration
   */
  readonly config: CLIProviderConfig;

  /**
   * Generates a completion
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Checks if the provider is available and healthy
   */
  checkHealth(): Promise<HealthCheckResult>;

  /**
   * Checks if a model is supported
   */
  supportsModel(model: string): boolean;

  /**
   * Gets available models
   */
  getModels(): readonly ModelConfig[];

  /**
   * Checks if the provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Estimates token count for text (approximate)
   */
  estimateTokens(text: string): number;
}

/**
 * Result of spawning a CLI process
 */
export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  /**
   * True if the process was terminated early due to earlyTerminateOn callback returning true.
   * This indicates we got the output we needed and intentionally killed the process.
   */
  earlyTerminated: boolean;
}

/**
 * Options for spawning a CLI process
 */
export interface SpawnOptions {
  command: string;
  args: readonly string[];
  stdin: string;
  env: Readonly<Record<string, string | undefined>>;
  timeout: number;
  cwd?: string | undefined;
  /**
   * Optional callback to detect when output is complete and process can be terminated early.
   * Called on each stdout data event. Return true to terminate the process immediately.
   * Useful for CLIs that hang during shutdown after producing valid output (e.g., ax-grok).
   */
  earlyTerminateOn?: ((stdout: string) => boolean) | undefined;
}

/**
 * Parsed output from CLI
 */
export interface ParsedOutput {
  content: string;
  metadata?: Record<string, unknown> | undefined;
}
