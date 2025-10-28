/**
 * Spec-Kit Integration Module
 * Phase 2: Deep Integration
 *
 * Public API for spec-driven development with AutomatosX
 *
 * @module core/spec
 */

// Core classes
export { SpecLoader } from './SpecLoader.js';
export { SpecValidator } from './SpecValidator.js';
export { SpecGraphBuilder } from './SpecGraphBuilder.js';
export { SpecCache, getGlobalCache, resetGlobalCache } from './SpecCache.js';
export { SpecRegistry, SpecRegistryFactory } from './SpecRegistry.js';

// Re-export types from types/spec.ts
export type {
  SpecMetadata,
  SpecTask,
  TaskStatus,
  SpecRunState,
  RunStatus,
  TaskExecutionState,
  SpecValidationResult,
  ValidationIssue,
  SpecContext,
  SpecGraph,
  SpecLoaderOptions,
  SpecValidatorOptions,
  ValidationRule,
  ParsedSpec,
  SpecCacheEntry,
  SpecExecutorOptions,
  TaskFilter,
  SpecRegistryOptions,
  SpecEvent,
  SpecEventType,
  RelevanceScores,
  ContextScope,
  SpecTelemetry
} from '../../types/spec.js';

export { SpecError, SpecErrorCode } from '../../types/spec.js';

// Re-export cache types
export type { CacheStats, SpecCacheOptions } from './SpecCache.js';
