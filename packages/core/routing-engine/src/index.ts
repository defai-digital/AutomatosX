// Routing Engine
// Deterministic model selection following contract invariants

export { RoutingEngine, RoutingError, createRoutingEngine } from './router.js';
export { scoreModel, sortScoredModels } from './scorer.js';
export { DEFAULT_MODELS, createModelRegistry } from './models.js';
export {
  RoutingErrorCodes,
  type RoutingErrorCode,
  type ModelDefinition,
  type RoutingEngineConfig,
  type RoutingContext,
  type ScoredModel,
} from './types.js';

// Re-export contract types for consumer convenience
export type {
  TaskType,
  RiskLevel,
  Provider,
  ModelCapability,
  RoutingInput,
  RoutingConstraints,
  RoutingDecision,
  RoutingRecord,
} from '@defai.digital/contracts';

// Re-export validation functions
export {
  validateRoutingInput,
  validateRoutingDecision,
  validateRoutingRecord,
} from '@defai.digital/contracts';
