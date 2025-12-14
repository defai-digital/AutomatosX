import type { Provider, TaskType, ModelCapability } from '@automatosx/contracts';

/**
 * Model definition for routing
 */
export interface ModelDefinition {
  id: string;
  provider: Provider;
  displayName: string;
  isExperimental: boolean;
  costPerMillionTokens: number;
  contextLength: number;
  capabilities: ModelCapability[];
  /**
   * Priority for selection (higher = preferred)
   */
  priority: number;
  /**
   * Task types this model is optimized for
   */
  optimizedFor: TaskType[];
}

/**
 * Configuration for the routing engine
 */
export interface RoutingEngineConfig {
  /**
   * Available models for routing
   */
  models: ModelDefinition[];

  /**
   * Default model to use when no better match found
   */
  defaultModelId?: string;
}

/**
 * Internal routing context used for decision making
 */
export interface RoutingContext {
  taskType: TaskType;
  budgetMaxCost?: number | undefined;
  budgetMaxTokens?: number | undefined;
  budgetMaxLatency?: number | undefined;
  riskLevel: 'low' | 'medium' | 'high';
  requiredCapabilities: ModelCapability[];
  preferredProviders: string[];
  excludedModels: string[];
  minContextLength?: number | undefined;
}

/**
 * Candidate model with score
 */
export interface ScoredModel {
  model: ModelDefinition;
  score: number;
  reasons: string[];
  disqualified: boolean;
  disqualificationReason?: string;
}

/**
 * Error codes for routing engine
 */
export const RoutingErrorCodes = {
  NO_SUITABLE_MODEL: 'ROUTING_NO_SUITABLE_MODEL',
  BUDGET_EXCEEDED: 'ROUTING_BUDGET_EXCEEDED',
  CAPABILITY_NOT_FOUND: 'ROUTING_CAPABILITY_NOT_FOUND',
  INVALID_INPUT: 'ROUTING_INVALID_INPUT',
} as const;

export type RoutingErrorCode =
  (typeof RoutingErrorCodes)[keyof typeof RoutingErrorCodes];
