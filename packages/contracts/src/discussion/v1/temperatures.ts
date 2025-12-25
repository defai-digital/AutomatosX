/**
 * Discussion Temperature Configuration Contracts v1
 *
 * Centralized temperature defaults for discussion patterns and consensus methods.
 * Replaces hardcoded temperature values scattered across discussion-domain.
 *
 * @module @defai.digital/contracts/discussion/v1/temperatures
 */

import { z } from 'zod';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Temperature ranges for different use cases
 *
 * Lower temperatures (0.0-0.3): More deterministic, consistent outputs
 * Medium temperatures (0.4-0.7): Balanced creativity and consistency
 * Higher temperatures (0.8-1.0+): More creative, varied outputs
 */
export const TEMPERATURE_RANGES = {
  /** Deterministic operations requiring consistency */
  deterministic: { min: 0, max: 0.3, recommended: 0.0 },
  /** Analytical tasks like code review, voting */
  analytical: { min: 0.2, max: 0.5, recommended: 0.3 },
  /** Balanced tasks like moderation, judgment */
  balanced: { min: 0.4, max: 0.6, recommended: 0.5 },
  /** Standard generation tasks */
  standard: { min: 0.5, max: 0.8, recommended: 0.7 },
  /** Creative tasks requiring variation */
  creative: { min: 0.7, max: 1.2, recommended: 0.9 },
} as const;

/**
 * Default temperature by discussion pattern
 *
 * Based on pattern semantics:
 * - synthesis: Standard temperature for balanced perspective merging
 * - voting: Lower temperature for consistent vote interpretation
 * - debate: Slightly higher for argument variation
 * - critique: Balanced for fair critique generation
 * - round-robin: Standard for building on previous responses
 */
export const DEFAULT_PATTERN_TEMPERATURES = {
  synthesis: 0.7,
  voting: 0.5,
  debate: 0.7,
  critique: 0.6,
  'round-robin': 0.7,
} as const;

/**
 * Default temperature by consensus method
 *
 * Based on method requirements:
 * - synthesis: Standard for combining perspectives
 * - voting: Lower for consistent aggregation
 * - moderator: Balanced for fair judgment
 * - unanimous: Lower for precise agreement detection
 * - majority: Lower for clear counting
 */
export const DEFAULT_CONSENSUS_TEMPERATURES = {
  synthesis: 0.7,
  voting: 0.5,
  moderator: 0.5,
  unanimous: 0.4,
  majority: 0.4,
} as const;

/**
 * Default temperature by use case
 *
 * For specific operations outside patterns:
 * - codeReview: Low for consistent, precise feedback
 * - summarization: Standard for balanced output
 * - translation: Low for accuracy
 * - brainstorming: High for creativity
 * - analysis: Low-medium for precision
 */
export const DEFAULT_USECASE_TEMPERATURES = {
  codeReview: 0.3,
  summarization: 0.7,
  translation: 0.3,
  brainstorming: 0.9,
  analysis: 0.5,
  documentation: 0.6,
  refactoring: 0.4,
  testing: 0.4,
} as const;

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Temperature value schema with LLM-standard range
 */
export const TemperatureValueSchema = z.number().min(0).max(2);

/**
 * Pattern temperature configuration
 */
export const PatternTemperaturesSchema = z.object({
  synthesis: TemperatureValueSchema.default(DEFAULT_PATTERN_TEMPERATURES.synthesis),
  voting: TemperatureValueSchema.default(DEFAULT_PATTERN_TEMPERATURES.voting),
  debate: TemperatureValueSchema.default(DEFAULT_PATTERN_TEMPERATURES.debate),
  critique: TemperatureValueSchema.default(DEFAULT_PATTERN_TEMPERATURES.critique),
  'round-robin': TemperatureValueSchema.default(DEFAULT_PATTERN_TEMPERATURES['round-robin']),
}).strict();

export type PatternTemperatures = z.infer<typeof PatternTemperaturesSchema>;

/**
 * Consensus method temperature configuration
 */
export const ConsensusTemperaturesSchema = z.object({
  synthesis: TemperatureValueSchema.default(DEFAULT_CONSENSUS_TEMPERATURES.synthesis),
  voting: TemperatureValueSchema.default(DEFAULT_CONSENSUS_TEMPERATURES.voting),
  moderator: TemperatureValueSchema.default(DEFAULT_CONSENSUS_TEMPERATURES.moderator),
  unanimous: TemperatureValueSchema.default(DEFAULT_CONSENSUS_TEMPERATURES.unanimous),
  majority: TemperatureValueSchema.default(DEFAULT_CONSENSUS_TEMPERATURES.majority),
}).strict();

export type ConsensusTemperatures = z.infer<typeof ConsensusTemperaturesSchema>;

/**
 * Use-case specific temperature configuration
 */
export const UseCaseTemperaturesSchema = z.object({
  codeReview: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.codeReview),
  summarization: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.summarization),
  translation: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.translation),
  brainstorming: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.brainstorming),
  analysis: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.analysis),
  documentation: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.documentation),
  refactoring: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.refactoring),
  testing: TemperatureValueSchema.default(DEFAULT_USECASE_TEMPERATURES.testing),
}).strict();

export type UseCaseTemperatures = z.infer<typeof UseCaseTemperaturesSchema>;

/**
 * Complete temperature configuration
 *
 * Allows overriding defaults at global, pattern, consensus, or use-case level.
 */
export const TemperatureConfigSchema = z.object({
  /** Global default temperature (used when no specific config matches) */
  globalDefault: TemperatureValueSchema.default(0.7),

  /** Pattern-specific temperatures */
  patterns: PatternTemperaturesSchema.default({}),

  /** Consensus method temperatures */
  consensus: ConsensusTemperaturesSchema.default({}),

  /** Use-case specific temperatures */
  useCases: UseCaseTemperaturesSchema.default({}),

  /** Per-provider temperature overrides (some providers work better at different temps) */
  providerOverrides: z.record(z.string(), TemperatureValueSchema).default({}),
}).strict();

export type TemperatureConfig = z.infer<typeof TemperatureConfigSchema>;

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_TEMPERATURE_CONFIG: TemperatureConfig = TemperatureConfigSchema.parse({});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get temperature for a specific discussion pattern
 */
export function getPatternTemperature(
  pattern: keyof PatternTemperatures,
  config: TemperatureConfig = DEFAULT_TEMPERATURE_CONFIG
): number {
  return config.patterns[pattern] ?? DEFAULT_PATTERN_TEMPERATURES[pattern] ?? config.globalDefault;
}

/**
 * Get temperature for a specific consensus method
 */
export function getConsensusTemperature(
  method: keyof ConsensusTemperatures,
  config: TemperatureConfig = DEFAULT_TEMPERATURE_CONFIG
): number {
  return config.consensus[method] ?? DEFAULT_CONSENSUS_TEMPERATURES[method] ?? config.globalDefault;
}

/**
 * Get temperature for a specific use case
 */
export function getUseCaseTemperature(
  useCase: keyof UseCaseTemperatures,
  config: TemperatureConfig = DEFAULT_TEMPERATURE_CONFIG
): number {
  return config.useCases[useCase] ?? DEFAULT_USECASE_TEMPERATURES[useCase] ?? config.globalDefault;
}

/**
 * Get temperature with provider-specific override
 */
export function getTemperatureForProvider(
  baseTemperature: number,
  providerId: string,
  config: TemperatureConfig = DEFAULT_TEMPERATURE_CONFIG
): number {
  return config.providerOverrides[providerId] ?? baseTemperature;
}

/**
 * Resolve temperature for a discussion execution context
 */
export function resolveTemperature(
  options: {
    pattern?: keyof PatternTemperatures;
    consensusMethod?: keyof ConsensusTemperatures;
    useCase?: keyof UseCaseTemperatures;
    providerId?: string;
    explicit?: number;
  },
  config: TemperatureConfig = DEFAULT_TEMPERATURE_CONFIG
): number {
  // Explicit override takes precedence
  if (options.explicit !== undefined) {
    return options.explicit;
  }

  // Pattern temperature
  if (options.pattern) {
    const patternTemp = getPatternTemperature(options.pattern, config);
    if (options.providerId) {
      return getTemperatureForProvider(patternTemp, options.providerId, config);
    }
    return patternTemp;
  }

  // Consensus method temperature
  if (options.consensusMethod) {
    const consensusTemp = getConsensusTemperature(options.consensusMethod, config);
    if (options.providerId) {
      return getTemperatureForProvider(consensusTemp, options.providerId, config);
    }
    return consensusTemp;
  }

  // Use-case temperature
  if (options.useCase) {
    const useCaseTemp = getUseCaseTemperature(options.useCase, config);
    if (options.providerId) {
      return getTemperatureForProvider(useCaseTemp, options.providerId, config);
    }
    return useCaseTemp;
  }

  // Provider override or global default
  if (options.providerId) {
    return getTemperatureForProvider(config.globalDefault, options.providerId, config);
  }

  return config.globalDefault;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

export function validateTemperatureConfig(data: unknown): TemperatureConfig {
  return TemperatureConfigSchema.parse(data);
}

export function safeValidateTemperatureConfig(data: unknown): {
  success: boolean;
  data?: TemperatureConfig;
  error?: z.ZodError;
} {
  const result = TemperatureConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// =============================================================================
// ERROR CODES
// =============================================================================

export const TemperatureErrorCodes = {
  INVALID_TEMPERATURE: 'TEMP_INVALID_VALUE',
  TEMPERATURE_OUT_OF_RANGE: 'TEMP_OUT_OF_RANGE',
  UNKNOWN_PATTERN: 'TEMP_UNKNOWN_PATTERN',
  UNKNOWN_CONSENSUS_METHOD: 'TEMP_UNKNOWN_CONSENSUS_METHOD',
} as const;
