/**
 * Provider adapters (CLI-based)
 *
 * DESIGN: AutomatosX does NOT manage credentials.
 * Each provider CLI handles its own authentication:
 * - claude, gemini, codex: Official CLIs with built-in auth
 * - ax-grok: Grok CLI wrapper (handles XAI_API_KEY)
 */

// Types
export type {
  MessageRole,
  Message,
  CompletionRequest,
  CompletionResponse,
  CompletionSuccess,
  CompletionFailure,
  TokenUsage,
  LLMProvider,
  CLIProviderConfig,
  ModelConfig,
  HealthCheckResult,
  ErrorCategory,
  ClassifiedError,
  SpawnResult,
  SpawnOptions,
  ParsedOutput,
} from './types.js';

// CLI Adapter
export { createCLIAdapter, createCLIAdapters } from './cli-adapter.js';

// Process Manager
export {
  spawnCLI,
  isCommandAvailable,
  getCommandVersion,
  buildPromptFromMessages,
} from './process-manager.js';

// Output Parser
export {
  parseOutput,
  estimateTokenUsage,
  extractOrEstimateTokenUsage,
} from './output-parser.js';

// Error Classifier
export {
  classifyError,
  classifySpawnResult,
  isRetryable,
  shouldFallback,
} from './error-classifier.js';

// Provider Configurations
export {
  claudeConfig,
  geminiConfig,
  codexConfig,
  grokConfig,
  antigravityConfig,
  opencodeConfig,
  ALL_PROVIDER_CONFIGS,
  getProviderConfig,
  getAllProviderIds,
} from './providers/index.js';

// Provider Registry
export {
  ProviderRegistry,
  createProviderRegistry,
  createEmptyRegistry,
} from './registry.js';

// Resilient Provider Registry
export {
  ResilientProviderRegistry,
  createResilientProviderRegistry,
  type ResilientRegistryConfig,
} from './resilient-registry.js';
