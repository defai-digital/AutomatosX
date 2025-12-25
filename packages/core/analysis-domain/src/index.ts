/**
 * @defai.digital/analysis-domain
 *
 * Analysis Domain - LLM-delegated code analysis
 *
 * Provides bugfix, refactor, review, and explain capabilities
 * by delegating analysis to LLM providers.
 */

// Context Builder
export {
  createCodeContextBuilder,
  formatCodeContext,
  ContextBuilderError,
} from './context-builder.js';

// Prompt Builder
export {
  createAnalysisPromptBuilder,
  getTaskDescription,
} from './prompt-builder.js';

// Response Parser
export {
  createAnalysisResponseParser,
  deduplicateFindings,
  ResponseParserError,
} from './response-parser.js';

// Analysis Service
export {
  createAnalysisService,
  createSimpleProvider,
  AnalysisError,
} from './analysis-service.js';

// Provider Router
export {
  createAnalysisProviderRouter,
  createStubProviderRouter,
  type ProviderLike,
  type ProviderRegistryLike,
  type AnalysisProviderRouterConfig,
} from './provider-router.js';

// Types
export type {
  CodeContextBuilder,
  AnalysisPromptBuilder,
  AnalysisResponseParser,
  AnalysisService,
  AnalysisServiceDeps,
  AnalysisProvider,
  ProviderRouter,
  ProviderRequest,
  ProviderResponse,
  GatherOptions,
} from './types.js';

// Re-export contract types for convenience
export type {
  AnalysisTask,
  AnalysisRequest,
  AnalysisResult,
  AnalysisFinding,
  CodeContext,
  AnalysisFile,
  FindingSeverity,
  AnalysisSeverityFilter,
} from './types.js';
