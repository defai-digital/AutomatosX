/**
 * Discussion Domain
 *
 * Multi-model discussion orchestration for AutomatosX.
 * Enables Claude, GLM, Qwen, Gemini, Codex, and Grok to collaborate on complex problems.
 *
 * @module @automatosx/discussion-domain
 */

// Main executor
export { DiscussionExecutor, createDiscussionExecutor } from './executor.js';

// Types and interfaces
export type {
  DiscussionProviderExecutor,
  ProviderExecuteRequest,
  ProviderExecuteResult,
  PatternExecutor,
  PatternExecutionContext,
  PatternExecutionResult,
  ConsensusExecutor,
  ConsensusExecutionContext,
  ConsensusExecutionResult,
  DiscussionExecutorOptions,
  DiscussionProgressEvent,
} from './types.js';

// Stub implementation for testing
export { StubProviderExecutor } from './types.js';

// Pattern executors
export {
  RoundRobinPattern,
  SynthesisPattern,
  DebatePattern,
  CritiquePattern,
  VotingPattern,
  getPatternExecutor,
  isPatternSupported,
  getSupportedPatterns,
} from './patterns/index.js';

// Consensus executors
export {
  SynthesisConsensus,
  VotingConsensus,
  ModeratorConsensus,
  getConsensusExecutor,
  isConsensusMethodSupported,
  getSupportedConsensusMethods,
} from './consensus/index.js';

// Prompt templates
export {
  getProviderSystemPrompt,
  interpolate,
  formatPreviousResponses,
  formatVotingOptions,
  formatVotes,
  getRolePromptModifier,
} from './prompts/index.js';

// Provider bridge (for connecting to provider-adapters)
export {
  createProviderBridge,
  createSimpleProviderBridge,
  type ProviderRegistryLike,
  type ProviderBridgeOptions,
} from './provider-bridge.js';
