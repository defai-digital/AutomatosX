/**
 * ML Lifecycle Contract V1 - Schema Definitions
 *
 * Defines schemas for machine learning lifecycle management:
 * - Experiment tracking
 * - Model registration
 * - Model monitoring
 * - Drift detection
 * - A/B testing
 */

import { z } from 'zod';

// ============================================================================
// Experiment Tracking
// ============================================================================

/**
 * ML experiment status
 */
export const ExperimentStatusSchema = z.enum([
  'running',
  'completed',
  'failed',
  'promoted',
  'rejected',
  'archived',
]);

/**
 * Experiment hyperparameter value
 */
export const HyperparameterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

/**
 * ML experiment definition
 */
export const MLExperimentSchema = z.object({
  experimentId: z.string().uuid(),
  experimentName: z.string().max(200),
  hypothesis: z.string().max(1000),
  modelType: z.string().max(100),
  hyperparameters: z.record(z.string(), HyperparameterValueSchema),
  datasetVersion: z.string().max(100),
  baselineModel: z.string().max(100).optional(),
  successCriteria: z.string().max(500),
  status: ExperimentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.string().max(100),
});

/**
 * Experiment metric log entry
 */
export const ExperimentMetricSchema = z.object({
  experimentId: z.string().uuid(),
  metricName: z.string().max(100),
  metricValue: z.number(),
  step: z.number().int().min(0).optional(),
  epoch: z.number().int().min(0).optional(),
  timestamp: z.string().datetime(),
});

/**
 * Experiment comparison result
 */
export const ExperimentComparisonSchema = z.object({
  experimentIds: z.array(z.string().uuid()).min(2).max(10),
  metrics: z.array(z.string().max(100)),
  results: z.array(
    z.object({
      experimentId: z.string().uuid(),
      experimentName: z.string().max(200),
      metricsValues: z.record(z.string(), z.number()),
      rank: z.number().int().min(1),
    })
  ),
  recommendation: z.object({
    bestExperiment: z.string().uuid(),
    reason: z.string().max(500),
    confidence: z.number().min(0).max(1),
  }),
  comparedAt: z.string().datetime(),
});

// ============================================================================
// Model Registry
// ============================================================================

/**
 * ML model lifecycle status
 */
export const ModelStatusSchema = z.enum([
  'staged',
  'canary',
  'production',
  'archived',
  'deprecated',
]);

/**
 * Model artifact information
 */
export const ModelArtifactSchema = z.object({
  path: z.string().max(500),
  checksum: z.string().max(128),
  sizeBytes: z.number().int().min(0),
  format: z.string().max(50).optional(), // e.g., "onnx", "pytorch", "tensorflow"
});

/**
 * Model lineage information
 */
export const ModelLineageSchema = z.object({
  experimentId: z.string().uuid(),
  trainingDataset: z.string().max(200),
  parentModel: z.string().max(100).optional(),
  trainingConfig: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Model schemas for input/output
 */
export const ModelIOSchemaSchema = z.object({
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  featureNames: z.array(z.string()).max(1000),
});

/**
 * Model dependencies
 */
export const ModelDependenciesSchema = z.object({
  framework: z.string().max(50), // e.g., "pytorch", "tensorflow"
  frameworkVersion: z.string().max(50),
  packages: z.array(z.string().max(100)).max(100),
});

/**
 * ML model registration
 */
export const MLModelSchema = z.object({
  modelName: z.string().max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500).optional(),
  lineage: ModelLineageSchema,
  artifact: ModelArtifactSchema,
  schemas: ModelIOSchemaSchema,
  metrics: z.record(z.string(), z.number()),
  dependencies: ModelDependenciesSchema,
  status: ModelStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.string().max(100),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

/**
 * Model promotion request
 */
export const ModelPromotionRequestSchema = z.object({
  modelName: z.string().max(100),
  fromVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  toStatus: z.enum(['canary', 'production']),
  reason: z.string().max(500),
  approver: z.string().max(100).optional(),
  canaryConfig: z
    .object({
      trafficPercentage: z.number().int().min(1).max(50),
      durationMinutes: z.number().int().min(5).max(10080), // max 1 week
      successThreshold: z.number().min(0).max(1),
    })
    .optional(),
});

/**
 * Model promotion result
 */
export const ModelPromotionResultSchema = z.object({
  modelName: z.string().max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  previousStatus: ModelStatusSchema,
  newStatus: ModelStatusSchema,
  promotedAt: z.string().datetime(),
  promotedBy: z.string().max(100),
  previousProductionVersion: z.string().max(20).optional(),
});

// ============================================================================
// Model Monitoring
// ============================================================================

/**
 * Drift severity levels
 */
export const DriftSeveritySchema = z.enum(['none', 'moderate', 'significant', 'critical']);

/**
 * Drift detection result for a single feature
 */
export const FeatureDriftResultSchema = z.object({
  featureName: z.string().max(100),
  driftScore: z.number().min(0).max(1),
  severity: DriftSeveritySchema,
  baselineStats: z.object({
    mean: z.number().optional(),
    std: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    distribution: z.record(z.string(), z.number()).optional(),
  }),
  currentStats: z.object({
    mean: z.number().optional(),
    std: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    distribution: z.record(z.string(), z.number()).optional(),
  }),
});

/**
 * Data drift detection result
 */
export const DataDriftResultSchema = z.object({
  modelName: z.string().max(100),
  modelVersion: z.string().max(50),
  overallDriftLevel: DriftSeveritySchema,
  featureResults: z.array(FeatureDriftResultSchema).max(1000),
  topDriftedFeatures: z.array(z.string()).max(10),
  detectedAt: z.string().datetime(),
});

/**
 * Prediction drift detection result
 */
export const PredictionDriftResultSchema = z.object({
  modelName: z.string().max(100),
  modelVersion: z.string().max(50),
  driftLevel: DriftSeveritySchema,
  driftScore: z.number().min(0).max(1),
  baselineDistribution: z.record(z.string(), z.number()),
  currentDistribution: z.record(z.string(), z.number()),
  detectedAt: z.string().datetime(),
});

/**
 * Performance degradation result
 */
export const PerformanceDegradationResultSchema = z.object({
  modelName: z.string().max(100),
  modelVersion: z.string().max(50),
  degradationDetected: z.boolean(),
  metricsComparison: z.array(
    z.object({
      metricName: z.string().max(100),
      baselineValue: z.number(),
      currentValue: z.number(),
      degradationPercent: z.number(),
      threshold: z.number(),
      breached: z.boolean(),
    })
  ),
  detectedAt: z.string().datetime(),
});

/**
 * Retraining recommendation
 */
export const RetrainingRecommendationSchema = z.enum([
  'no_action',
  'monitor',
  'investigate',
  'retrain',
  'retrain_urgent',
]);

/**
 * Model monitoring alert
 */
export const MonitoringAlertSchema = z.object({
  alertId: z.string().uuid(),
  modelName: z.string().max(100),
  modelVersion: z.string().max(50),
  severity: z.enum(['info', 'warning', 'critical']),
  alertType: z.enum(['data_drift', 'prediction_drift', 'performance_degradation', 'error_rate']),
  driftSummary: z
    .object({
      dataDriftLevel: DriftSeveritySchema,
      predictionDriftLevel: DriftSeveritySchema,
      topDriftedFeatures: z.array(z.string()).max(10),
    })
    .optional(),
  performanceSummary: z
    .object({
      degradationDetected: z.boolean(),
      metricsAffected: z.array(z.string()).max(20),
    })
    .optional(),
  recommendation: RetrainingRecommendationSchema,
  createdAt: z.string().datetime(),
  acknowledged: z.boolean(),
  acknowledgedAt: z.string().datetime().optional(),
  acknowledgedBy: z.string().max(100).optional(),
});

// ============================================================================
// A/B Testing
// ============================================================================

/**
 * A/B test status
 */
export const ABTestStatusSchema = z.enum([
  'draft',
  'running',
  'paused',
  'completed',
  'cancelled',
]);

/**
 * A/B test variant
 */
export const ABTestVariantSchema = z.object({
  variantId: z.string().max(50),
  variantName: z.string().max(100),
  modelVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  trafficAllocation: z.number().min(0).max(1),
  isControl: z.boolean(),
});

/**
 * A/B test configuration
 */
export const ABTestConfigSchema = z.object({
  testId: z.string().uuid(),
  testName: z.string().max(200),
  modelName: z.string().max(100),
  hypothesis: z.string().max(1000),
  variants: z.array(ABTestVariantSchema).min(2).max(10),
  primaryMetric: z.string().max(100),
  secondaryMetrics: z.array(z.string().max(100)).max(10).optional(),
  minimumSampleSize: z.number().int().min(100),
  confidenceLevel: z.number().min(0.9).max(0.99).default(0.95),
  durationDays: z.number().int().min(1).max(90),
  status: ABTestStatusSchema,
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  createdBy: z.string().max(100),
});

/**
 * A/B test results
 */
export const ABTestResultsSchema = z.object({
  testId: z.string().uuid(),
  status: z.enum(['inconclusive', 'control_wins', 'variant_wins']),
  variantResults: z.array(
    z.object({
      variantId: z.string().max(50),
      sampleSize: z.number().int().min(0),
      primaryMetricValue: z.number(),
      secondaryMetricValues: z.record(z.string(), z.number()).optional(),
      conversionRate: z.number().min(0).max(1).optional(),
    })
  ),
  statisticalSignificance: z.number().min(0).max(1),
  pValue: z.number().min(0).max(1),
  winningVariant: z.string().max(50).optional(),
  uplift: z.number().optional(), // percentage improvement
  recommendation: z.string().max(500),
  analyzedAt: z.string().datetime(),
});

// ============================================================================
// Feature Engineering
// ============================================================================

/**
 * Feature definition
 */
export const FeatureDefinitionSchema = z.object({
  featureId: z.string().uuid(),
  featureName: z.string().max(100),
  description: z.string().max(500),
  dataType: z.enum(['numeric', 'categorical', 'boolean', 'datetime', 'text', 'embedding']),
  transformations: z.array(z.string().max(200)).max(10),
  sourceColumns: z.array(z.string().max(100)).max(10),
  validationRules: z
    .object({
      notNull: z.boolean().optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional(),
      allowedValues: z.array(z.string()).max(1000).optional(),
      regex: z.string().max(200).optional(),
    })
    .optional(),
  statistics: z
    .object({
      nullRate: z.number().min(0).max(1).optional(),
      uniqueCount: z.number().int().min(0).optional(),
      mean: z.number().optional(),
      std: z.number().optional(),
      importance: z.number().min(0).max(1).optional(),
    })
    .optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
  createdBy: z.string().max(100),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

/**
 * Feature set definition
 */
export const FeatureSetSchema = z.object({
  featureSetId: z.string().uuid(),
  featureSetName: z.string().max(100),
  description: z.string().max(500),
  features: z.array(z.string().uuid()).max(1000), // feature IDs
  targetVariable: z.string().max(100).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
  createdBy: z.string().max(100),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;
export type HyperparameterValue = z.infer<typeof HyperparameterValueSchema>;
export type MLExperiment = z.infer<typeof MLExperimentSchema>;
export type ExperimentMetric = z.infer<typeof ExperimentMetricSchema>;
export type ExperimentComparison = z.infer<typeof ExperimentComparisonSchema>;

export type ModelStatus = z.infer<typeof ModelStatusSchema>;
export type ModelArtifact = z.infer<typeof ModelArtifactSchema>;
export type ModelLineage = z.infer<typeof ModelLineageSchema>;
export type ModelIOSchema = z.infer<typeof ModelIOSchemaSchema>;
export type ModelDependencies = z.infer<typeof ModelDependenciesSchema>;
export type MLModel = z.infer<typeof MLModelSchema>;
export type ModelPromotionRequest = z.infer<typeof ModelPromotionRequestSchema>;
export type ModelPromotionResult = z.infer<typeof ModelPromotionResultSchema>;

export type DriftSeverity = z.infer<typeof DriftSeveritySchema>;
export type FeatureDriftResult = z.infer<typeof FeatureDriftResultSchema>;
export type DataDriftResult = z.infer<typeof DataDriftResultSchema>;
export type PredictionDriftResult = z.infer<typeof PredictionDriftResultSchema>;
export type PerformanceDegradationResult = z.infer<typeof PerformanceDegradationResultSchema>;
export type RetrainingRecommendation = z.infer<typeof RetrainingRecommendationSchema>;
export type MonitoringAlert = z.infer<typeof MonitoringAlertSchema>;

export type ABTestStatus = z.infer<typeof ABTestStatusSchema>;
export type ABTestVariant = z.infer<typeof ABTestVariantSchema>;
export type ABTestConfig = z.infer<typeof ABTestConfigSchema>;
export type ABTestResults = z.infer<typeof ABTestResultsSchema>;

export type FeatureDefinition = z.infer<typeof FeatureDefinitionSchema>;
export type FeatureSet = z.infer<typeof FeatureSetSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export const validateMLExperiment = (data: unknown): MLExperiment => {
  return MLExperimentSchema.parse(data);
};

export const safeValidateMLExperiment = (
  data: unknown
): { success: true; data: MLExperiment } | { success: false; error: z.ZodError } => {
  const result = MLExperimentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

export const validateMLModel = (data: unknown): MLModel => {
  return MLModelSchema.parse(data);
};

export const safeValidateMLModel = (
  data: unknown
): { success: true; data: MLModel } | { success: false; error: z.ZodError } => {
  const result = MLModelSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

export const validateMonitoringAlert = (data: unknown): MonitoringAlert => {
  return MonitoringAlertSchema.parse(data);
};

export const validateABTestConfig = (data: unknown): ABTestConfig => {
  return ABTestConfigSchema.parse(data);
};

// ============================================================================
// Factory Functions
// ============================================================================

export const createMLExperiment = (
  params: Omit<MLExperiment, 'experimentId' | 'createdAt' | 'status'>
): MLExperiment => {
  return MLExperimentSchema.parse({
    ...params,
    experimentId: crypto.randomUUID(),
    status: 'running',
    createdAt: new Date().toISOString(),
  });
};

export const createMLModel = (
  params: Omit<MLModel, 'createdAt' | 'status'>
): MLModel => {
  return MLModelSchema.parse({
    ...params,
    status: 'staged',
    createdAt: new Date().toISOString(),
  });
};

export const createMonitoringAlert = (
  params: Omit<MonitoringAlert, 'alertId' | 'createdAt' | 'acknowledged'>
): MonitoringAlert => {
  return MonitoringAlertSchema.parse({
    ...params,
    alertId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    acknowledged: false,
  });
};

// ============================================================================
// Error Codes
// ============================================================================

export const MLLifecycleErrorCodes = {
  // Experiment errors
  EXPERIMENT_NOT_FOUND: 'ML_EXPERIMENT_NOT_FOUND',
  EXPERIMENT_ALREADY_EXISTS: 'ML_EXPERIMENT_ALREADY_EXISTS',
  EXPERIMENT_IMMUTABLE: 'ML_EXPERIMENT_IMMUTABLE',
  INVALID_EXPERIMENT_STATUS: 'ML_INVALID_EXPERIMENT_STATUS',

  // Model registry errors
  MODEL_NOT_FOUND: 'ML_MODEL_NOT_FOUND',
  MODEL_VERSION_EXISTS: 'ML_MODEL_VERSION_EXISTS',
  MODEL_VERSION_INVALID: 'ML_MODEL_VERSION_INVALID',
  MODEL_ARTIFACT_INVALID: 'ML_MODEL_ARTIFACT_INVALID',
  MODEL_LINEAGE_INCOMPLETE: 'ML_MODEL_LINEAGE_INCOMPLETE',
  PROMOTION_NOT_ALLOWED: 'ML_PROMOTION_NOT_ALLOWED',
  PRODUCTION_MODEL_EXISTS: 'ML_PRODUCTION_MODEL_EXISTS',

  // Monitoring errors
  BASELINE_NOT_FOUND: 'ML_BASELINE_NOT_FOUND',
  DRIFT_CALCULATION_FAILED: 'ML_DRIFT_CALCULATION_FAILED',
  ALERT_NOT_FOUND: 'ML_ALERT_NOT_FOUND',

  // A/B testing errors
  ABTEST_NOT_FOUND: 'ML_ABTEST_NOT_FOUND',
  ABTEST_INVALID_CONFIG: 'ML_ABTEST_INVALID_CONFIG',
  ABTEST_ALREADY_RUNNING: 'ML_ABTEST_ALREADY_RUNNING',
  ABTEST_INSUFFICIENT_DATA: 'ML_ABTEST_INSUFFICIENT_DATA',

  // Feature errors
  FEATURE_NOT_FOUND: 'ML_FEATURE_NOT_FOUND',
  FEATURE_VALIDATION_FAILED: 'ML_FEATURE_VALIDATION_FAILED',
  FEATURE_SET_NOT_FOUND: 'ML_FEATURE_SET_NOT_FOUND',
} as const;

export type MLLifecycleErrorCode =
  (typeof MLLifecycleErrorCodes)[keyof typeof MLLifecycleErrorCodes];
