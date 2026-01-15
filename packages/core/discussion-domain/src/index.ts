/**
 * Discussion Domain
 *
 * Multi-model discussion orchestration for AutomatosX.
 * Enables Claude, Gemini, Codex, and Grok to collaborate on complex problems.
 *
 * @module @defai.digital/discussion-domain
 */

// Main executor
export { DiscussionExecutor, createDiscussionExecutor } from './executor.js';

// Recursive executor
export {
  RecursiveDiscussionExecutor,
  createRecursiveDiscussionExecutor,
  type RecursiveDiscussionResult,
} from './recursive-executor.js';

// Context tracker for recursion management
export {
  createContextTracker,
  DiscussionContextError,
  type DiscussionContextTracker,
  type SubDiscussionCheck,
  type ContextTrackerConfig,
} from './context-tracker.js';

// Budget manager for timeout cascade
export {
  createBudgetManager,
  formatBudgetStatus,
  recommendProvidersForBudget,
  type DiscussionBudgetManager,
  type BudgetAllocation,
  type BudgetStatus,
} from './budget-manager.js';

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
  // Cascading confidence types
  CascadingConfidenceOptions,
  EarlyExitInfo,
  // Recursive types
  RecursiveDiscussionExecutorOptions,
  RecursivePatternExecutionContext,
  RecursivePatternExecutionResult,
  SubDiscussionRequest,
} from './types.js';

// Stub implementation for testing
export { StubProviderExecutor } from './types.js';

// Confidence extraction and early exit
export {
  extractConfidence,
  evaluateEarlyExit,
  calculateAgreementScore,
  DEFAULT_CASCADING_CONFIDENCE,
  type ExtractedConfidence,
  type EarlyExitDecision,
} from './confidence-extractor.js';

// Cost tracking
export {
  createCostTracker,
  formatCost,
  formatCostSummary,
  PROVIDER_COSTS,
  type DiscussionCostTracker,
  type ProviderCallRecord,
  type CostSummary,
  type BudgetCheckResult,
} from './cost-tracker.js';

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

// Participant resolution (for agent/provider mixing)
export {
  resolveParticipant,
  resolveParticipants,
  providersToParticipants,
  parseParticipantString,
  parseParticipantList,
  getProviderIds,
  buildEnhancedSystemPrompt,
  type ResolvedParticipant,
  type AgentProfileLike,
  type AgentRegistryLike,
  type AbilityManagerLike,
  type ParticipantResolverOptions,
} from './participant-resolver.js';
