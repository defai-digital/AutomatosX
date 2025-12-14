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
