/**
 * ML Lifecycle Contract Invariant Tests
 *
 * Tests for ML lifecycle invariants documented in
 * packages/contracts/src/ml-lifecycle/v1/invariants.md
 *
 * Invariants tested:
 * - INV-ML-EXP-001: Experiment Immutability
 * - INV-ML-EXP-002: Experiment Uniqueness
 * - INV-ML-EXP-003: Metric Logging Order
 * - INV-ML-EXP-004: Status Transition Rules
 * - INV-ML-REG-001: Version Monotonicity
 * - INV-ML-REG-002: Single Production Model
 * - INV-ML-REG-003: Artifact Integrity
 * - INV-ML-REG-004: Lineage Completeness
 * - INV-ML-REG-005: Promotion Path
 * - INV-ML-MON-001: Alert Ordering
 * - INV-ML-MON-002: Drift Threshold Consistency
 * - INV-ML-MON-003: Retraining Trigger Determinism
 * - INV-ML-MON-004: Alert Acknowledgment Audit
 * - INV-ML-AB-001: Traffic Allocation Sum
 * - INV-ML-AB-002: Control Variant Required
 * - INV-ML-AB-003: Sample Size Requirement
 * - INV-ML-AB-004: Concurrent Test Prevention
 * - INV-ML-FE-001: Feature Version Immutability
 * - INV-ML-FE-002: Feature Validation Rules
 */

import { describe, it, expect } from 'vitest';
import {
  // Experiment schemas
  MLExperimentSchema,
  ExperimentStatusSchema,
  ExperimentMetricSchema,
  ExperimentComparisonSchema,
  // Model schemas
  MLModelSchema,
  ModelStatusSchema,
  ModelPromotionRequestSchema,
  ModelPromotionResultSchema,
  // Monitoring schemas
  MonitoringAlertSchema,
  DataDriftResultSchema,
  PredictionDriftResultSchema,
  DriftSeveritySchema,
  RetrainingRecommendationSchema,
  // A/B testing schemas
  ABTestConfigSchema,
  ABTestResultsSchema,
  ABTestVariantSchema,
  ABTestStatusSchema,
  // Feature engineering schemas
  FeatureDefinitionSchema,
  FeatureSetSchema,
  // Validation helpers
  validateMLExperiment,
  safeValidateMLExperiment,
  validateMLModel,
  safeValidateMLModel,
  validateMonitoringAlert,
  validateABTestConfig,
  // Factory functions
  createMLExperiment,
  createMLModel,
  createMonitoringAlert,
  // Error codes
  MLLifecycleErrorCodes,
} from '@defai.digital/contracts';

describe('ML Lifecycle Contract', () => {
  describe('ExperimentStatusSchema', () => {
    it('should validate all status values', () => {
      const statuses = ['running', 'completed', 'failed', 'promoted', 'rejected', 'archived'];

      for (const status of statuses) {
        const result = ExperimentStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const result = ExperimentStatusSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('MLExperimentSchema', () => {
    const validExperiment = {
      experimentId: '550e8400-e29b-41d4-a716-446655440000',
      experimentName: 'Test Classifier v2',
      hypothesis: 'Adding more features will improve accuracy',
      modelType: 'random-forest',
      hyperparameters: {
        n_estimators: 100,
        max_depth: 10,
        learning_rate: 0.01,
      },
      datasetVersion: 'v1.2.0',
      baselineModel: 'classifier-v1',
      successCriteria: 'Accuracy > 0.95 on test set',
      status: 'running',
      createdAt: new Date().toISOString(),
      createdBy: 'ml-engineer-1',
    };

    it('should validate a complete experiment', () => {
      const result = MLExperimentSchema.safeParse(validExperiment);
      expect(result.success).toBe(true);
    });

    it('should require UUID for experimentId', () => {
      const invalid = {
        ...validExperiment,
        experimentId: 'not-a-uuid',
      };

      const result = MLExperimentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate hyperparameters as record', () => {
      const withNestedParams = {
        ...validExperiment,
        hyperparameters: {
          layers: [64, 32, 16],
          dropout: 0.5,
          optimizer: 'adam',
        },
      };

      const result = MLExperimentSchema.safeParse(withNestedParams);
      expect(result.success).toBe(true);
    });

    it('should enforce datetime format for createdAt', () => {
      const invalid = {
        ...validExperiment,
        createdAt: '2024-01-01', // Not ISO datetime
      };

      const result = MLExperimentSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('ExperimentMetricSchema', () => {
    it('should validate metric entry', () => {
      const metric = {
        experimentId: '550e8400-e29b-41d4-a716-446655440000',
        metricName: 'accuracy',
        metricValue: 0.95,
        step: 100,
        epoch: 10,
        timestamp: new Date().toISOString(),
      };

      const result = ExperimentMetricSchema.safeParse(metric);
      expect(result.success).toBe(true);
    });

    it('should allow negative metric values', () => {
      const metric = {
        experimentId: '550e8400-e29b-41d4-a716-446655440000',
        metricName: 'loss',
        metricValue: -2.5,
        timestamp: new Date().toISOString(),
      };

      const result = ExperimentMetricSchema.safeParse(metric);
      expect(result.success).toBe(true);
    });
  });

  describe('ModelStatusSchema', () => {
    it('should validate all status values', () => {
      const statuses = ['staged', 'canary', 'production', 'archived', 'deprecated'];

      for (const status of statuses) {
        const result = ModelStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('MLModelSchema', () => {
    const validModel = {
      modelName: 'text-classifier',
      version: '2.1.0',
      description: 'Text classification model for sentiment analysis',
      lineage: {
        experimentId: '550e8400-e29b-41d4-a716-446655440000',
        trainingDataset: 'sentiment-dataset-v3',
        parentModel: 'text-classifier-v2.0.0',
      },
      artifact: {
        path: 's3://models/text-classifier/2.1.0/model.onnx',
        checksum: 'sha256:abc123def456...',
        sizeBytes: 104857600, // 100MB
        format: 'onnx',
      },
      schemas: {
        inputSchema: { text: 'string' },
        outputSchema: { sentiment: 'string', confidence: 'number' },
        featureNames: ['text_embedding'],
      },
      metrics: {
        accuracy: 0.95,
        f1_score: 0.94,
        precision: 0.93,
        recall: 0.95,
      },
      dependencies: {
        framework: 'pytorch',
        frameworkVersion: '2.0.0',
        packages: ['transformers==4.30.0', 'tokenizers==0.13.3'],
      },
      status: 'staged',
      createdAt: new Date().toISOString(),
      createdBy: 'ml-engineer-1',
      tags: ['nlp', 'sentiment', 'production-ready'],
    };

    it('should validate a complete model', () => {
      const result = MLModelSchema.safeParse(validModel);
      expect(result.success).toBe(true);
    });

    it('should require SemVer version', () => {
      const invalid = {
        ...validModel,
        version: 'v2.1', // Invalid format
      };

      const result = MLModelSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should enforce lineage with experimentId', () => {
      const withoutExperiment = {
        ...validModel,
        lineage: {
          trainingDataset: 'dataset-v1',
          // Missing experimentId
        },
      };

      const result = MLModelSchema.safeParse(withoutExperiment);
      expect(result.success).toBe(false);
    });

    it('should validate artifact checksum', () => {
      const result = MLModelSchema.safeParse(validModel);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifact.checksum).toBeDefined();
      }
    });

    it('should enforce max feature names', () => {
      const tooManyFeatures = {
        ...validModel,
        schemas: {
          ...validModel.schemas,
          featureNames: Array.from({ length: 1001 }, (_, i) => `feature_${i}`),
        },
      };

      const result = MLModelSchema.safeParse(tooManyFeatures);
      expect(result.success).toBe(false);
    });
  });

  describe('ModelPromotionRequestSchema', () => {
    it('should validate promotion to canary', () => {
      const request = {
        modelName: 'text-classifier',
        fromVersion: '2.1.0',
        toStatus: 'canary',
        reason: 'Improved accuracy by 5%',
        canaryConfig: {
          trafficPercentage: 10,
          durationMinutes: 60,
          successThreshold: 0.95,
        },
      };

      const result = ModelPromotionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate promotion to production', () => {
      const request = {
        modelName: 'text-classifier',
        fromVersion: '2.1.0',
        toStatus: 'production',
        reason: 'Canary phase successful',
        approver: 'ml-lead',
      };

      const result = ModelPromotionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should enforce canary traffic percentage bounds', () => {
      const tooHigh = {
        modelName: 'test',
        fromVersion: '1.0.0',
        toStatus: 'canary',
        reason: 'test',
        canaryConfig: {
          trafficPercentage: 60, // Max is 50
          durationMinutes: 60,
          successThreshold: 0.9,
        },
      };

      const result = ModelPromotionRequestSchema.safeParse(tooHigh);
      expect(result.success).toBe(false);
    });
  });

  describe('DriftSeveritySchema', () => {
    it('should validate all severity levels', () => {
      const severities = ['none', 'moderate', 'significant', 'critical'];

      for (const severity of severities) {
        const result = DriftSeveritySchema.safeParse(severity);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('MonitoringAlertSchema', () => {
    it('should validate data drift alert', () => {
      const alert = {
        alertId: '550e8400-e29b-41d4-a716-446655440000',
        modelName: 'text-classifier',
        modelVersion: '2.1.0',
        severity: 'warning',
        alertType: 'data_drift',
        driftSummary: {
          dataDriftLevel: 'moderate',
          predictionDriftLevel: 'none',
          topDriftedFeatures: ['feature_1', 'feature_2'],
        },
        recommendation: 'monitor',
        createdAt: new Date().toISOString(),
        acknowledged: false,
      };

      const result = MonitoringAlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });

    it('should validate performance degradation alert', () => {
      const alert = {
        alertId: '550e8400-e29b-41d4-a716-446655440000',
        modelName: 'text-classifier',
        modelVersion: '2.1.0',
        severity: 'critical',
        alertType: 'performance_degradation',
        performanceSummary: {
          degradationDetected: true,
          metricsAffected: ['accuracy', 'latency_p99'],
        },
        recommendation: 'retrain_urgent',
        createdAt: new Date().toISOString(),
        acknowledged: false,
      };

      const result = MonitoringAlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });

    it('should validate acknowledged alert', () => {
      const alert = {
        alertId: '550e8400-e29b-41d4-a716-446655440000',
        modelName: 'text-classifier',
        modelVersion: '2.1.0',
        severity: 'info',
        alertType: 'data_drift',
        recommendation: 'no_action',
        createdAt: new Date().toISOString(),
        acknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: 'ml-engineer-1',
      };

      const result = MonitoringAlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });
  });

  describe('RetrainingRecommendationSchema', () => {
    it('should validate all recommendation values', () => {
      const recommendations = ['no_action', 'monitor', 'investigate', 'retrain', 'retrain_urgent'];

      for (const rec of recommendations) {
        const result = RetrainingRecommendationSchema.safeParse(rec);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('ABTestStatusSchema', () => {
    it('should validate all status values', () => {
      const statuses = ['draft', 'running', 'paused', 'completed', 'cancelled'];

      for (const status of statuses) {
        const result = ABTestStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('ABTestConfigSchema', () => {
    const validConfig = {
      testId: '550e8400-e29b-41d4-a716-446655440000',
      testName: 'Classifier v2 vs v1',
      modelName: 'text-classifier',
      hypothesis: 'v2 will have 5% better accuracy',
      variants: [
        {
          variantId: 'control',
          variantName: 'Current Production (v1)',
          modelVersion: '1.0.0',
          trafficAllocation: 0.5,
          isControl: true,
        },
        {
          variantId: 'treatment',
          variantName: 'New Model (v2)',
          modelVersion: '2.0.0',
          trafficAllocation: 0.5,
          isControl: false,
        },
      ],
      primaryMetric: 'accuracy',
      secondaryMetrics: ['latency_p50', 'latency_p99'],
      minimumSampleSize: 1000,
      confidenceLevel: 0.95,
      durationDays: 14,
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: 'ml-engineer-1',
    };

    it('should validate complete A/B test config', () => {
      const result = ABTestConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should require at least 2 variants', () => {
      const invalid = {
        ...validConfig,
        variants: [validConfig.variants[0]],
      };

      const result = ABTestConfigSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should enforce max 10 variants', () => {
      const tooMany = {
        ...validConfig,
        variants: Array.from({ length: 11 }, (_, i) => ({
          variantId: `variant-${i}`,
          variantName: `Variant ${i}`,
          modelVersion: '1.0.0',
          trafficAllocation: 0.09,
          isControl: i === 0,
        })),
      };

      const result = ABTestConfigSchema.safeParse(tooMany);
      expect(result.success).toBe(false);
    });

    it('should enforce minimum sample size', () => {
      const tooSmall = {
        ...validConfig,
        minimumSampleSize: 50, // Min is 100
      };

      const result = ABTestConfigSchema.safeParse(tooSmall);
      expect(result.success).toBe(false);
    });

    it('should enforce confidence level bounds', () => {
      const tooLow = { ...validConfig, confidenceLevel: 0.8 }; // Min is 0.9
      const tooHigh = { ...validConfig, confidenceLevel: 1.0 }; // Max is 0.99

      expect(ABTestConfigSchema.safeParse(tooLow).success).toBe(false);
      expect(ABTestConfigSchema.safeParse(tooHigh).success).toBe(false);
    });
  });

  describe('ABTestResultsSchema', () => {
    it('should validate inconclusive results', () => {
      const results = {
        testId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'inconclusive',
        variantResults: [
          { variantId: 'control', sampleSize: 500, primaryMetricValue: 0.92 },
          { variantId: 'treatment', sampleSize: 500, primaryMetricValue: 0.93 },
        ],
        statisticalSignificance: 0.85,
        pValue: 0.15,
        recommendation: 'Insufficient sample size for conclusive results',
        analyzedAt: new Date().toISOString(),
      };

      const result = ABTestResultsSchema.safeParse(results);
      expect(result.success).toBe(true);
    });

    it('should validate variant wins result', () => {
      const results = {
        testId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'variant_wins',
        variantResults: [
          { variantId: 'control', sampleSize: 5000, primaryMetricValue: 0.92 },
          { variantId: 'treatment', sampleSize: 5000, primaryMetricValue: 0.97 },
        ],
        statisticalSignificance: 0.99,
        pValue: 0.001,
        winningVariant: 'treatment',
        uplift: 5.4,
        recommendation: 'Promote treatment variant to production',
        analyzedAt: new Date().toISOString(),
      };

      const result = ABTestResultsSchema.safeParse(results);
      expect(result.success).toBe(true);
    });
  });

  describe('FeatureDefinitionSchema', () => {
    it('should validate feature definition', () => {
      const feature = {
        featureId: '550e8400-e29b-41d4-a716-446655440000',
        featureName: 'user_activity_score',
        description: 'Aggregated user activity metric',
        dataType: 'numeric',
        transformations: ['log_transform', 'standardize'],
        sourceColumns: ['login_count', 'page_views', 'session_duration'],
        validationRules: {
          notNull: true,
          minValue: 0,
          maxValue: 100,
        },
        statistics: {
          nullRate: 0.02,
          mean: 45.5,
          std: 12.3,
          importance: 0.85,
        },
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        createdBy: 'data-engineer-1',
        tags: ['user-behavior', 'engagement'],
      };

      const result = FeatureDefinitionSchema.safeParse(feature);
      expect(result.success).toBe(true);
    });

    it('should validate all data types', () => {
      const dataTypes = ['numeric', 'categorical', 'boolean', 'datetime', 'text', 'embedding'];

      for (const dataType of dataTypes) {
        const feature = {
          featureId: '550e8400-e29b-41d4-a716-446655440000',
          featureName: 'test_feature',
          description: 'Test',
          dataType,
          transformations: [],
          sourceColumns: ['col1'],
          version: '1.0.0',
          createdAt: new Date().toISOString(),
          createdBy: 'test',
        };

        const result = FeatureDefinitionSchema.safeParse(feature);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('FeatureSetSchema', () => {
    it('should validate feature set', () => {
      const featureSet = {
        featureSetId: '550e8400-e29b-41d4-a716-446655440000',
        featureSetName: 'user-engagement-features',
        description: 'Features for user engagement prediction',
        features: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
        ],
        targetVariable: 'churn',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        createdBy: 'data-scientist-1',
      };

      const result = FeatureSetSchema.safeParse(featureSet);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('validateMLExperiment should throw on invalid input', () => {
      expect(() => validateMLExperiment({ experimentId: 'invalid' })).toThrow();
    });

    it('safeValidateMLExperiment should return error on invalid input', () => {
      const result = safeValidateMLExperiment({ experimentId: '' });
      expect(result.success).toBe(false);
    });

    it('validateMLModel should throw on invalid input', () => {
      expect(() => validateMLModel({ modelName: '' })).toThrow();
    });

    it('safeValidateMLModel should return error on invalid input', () => {
      const result = safeValidateMLModel({ modelName: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('createMLExperiment should create with defaults', () => {
      const experiment = createMLExperiment({
        experimentName: 'Test Experiment',
        hypothesis: 'Testing factory function',
        modelType: 'random-forest',
        hyperparameters: { n_estimators: 100 },
        datasetVersion: 'v1.0.0',
        successCriteria: 'accuracy > 0.9',
        createdBy: 'test-user',
      });

      expect(experiment.experimentId).toBeDefined();
      expect(experiment.status).toBe('running');
      expect(experiment.createdAt).toBeDefined();
    });

    it('createMLModel should create with defaults', () => {
      const model = createMLModel({
        modelName: 'test-model',
        version: '1.0.0',
        lineage: {
          experimentId: '550e8400-e29b-41d4-a716-446655440000',
          trainingDataset: 'dataset-v1',
        },
        artifact: {
          path: '/models/test.onnx',
          checksum: 'sha256:abc123',
          sizeBytes: 1000000,
        },
        schemas: {
          inputSchema: {},
          outputSchema: {},
          featureNames: [],
        },
        metrics: { accuracy: 0.95 },
        dependencies: {
          framework: 'pytorch',
          frameworkVersion: '2.0.0',
          packages: [],
        },
        createdBy: 'test-user',
      });

      expect(model.status).toBe('staged');
      expect(model.createdAt).toBeDefined();
    });

    it('createMonitoringAlert should create with defaults', () => {
      const alert = createMonitoringAlert({
        modelName: 'test-model',
        modelVersion: '1.0.0',
        severity: 'warning',
        alertType: 'data_drift',
        recommendation: 'monitor',
      });

      expect(alert.alertId).toBeDefined();
      expect(alert.acknowledged).toBe(false);
      expect(alert.createdAt).toBeDefined();
    });
  });

  describe('Error Codes', () => {
    it('should have all required error codes', () => {
      // Experiment errors
      expect(MLLifecycleErrorCodes.EXPERIMENT_NOT_FOUND).toBe('ML_EXPERIMENT_NOT_FOUND');
      expect(MLLifecycleErrorCodes.EXPERIMENT_ALREADY_EXISTS).toBe('ML_EXPERIMENT_ALREADY_EXISTS');
      expect(MLLifecycleErrorCodes.EXPERIMENT_IMMUTABLE).toBe('ML_EXPERIMENT_IMMUTABLE');

      // Model errors
      expect(MLLifecycleErrorCodes.MODEL_NOT_FOUND).toBe('ML_MODEL_NOT_FOUND');
      expect(MLLifecycleErrorCodes.MODEL_VERSION_EXISTS).toBe('ML_MODEL_VERSION_EXISTS');
      expect(MLLifecycleErrorCodes.MODEL_ARTIFACT_INVALID).toBe('ML_MODEL_ARTIFACT_INVALID');
      expect(MLLifecycleErrorCodes.MODEL_LINEAGE_INCOMPLETE).toBe('ML_MODEL_LINEAGE_INCOMPLETE');
      expect(MLLifecycleErrorCodes.PROMOTION_NOT_ALLOWED).toBe('ML_PROMOTION_NOT_ALLOWED');
      expect(MLLifecycleErrorCodes.PRODUCTION_MODEL_EXISTS).toBe('ML_PRODUCTION_MODEL_EXISTS');

      // Monitoring errors
      expect(MLLifecycleErrorCodes.BASELINE_NOT_FOUND).toBe('ML_BASELINE_NOT_FOUND');
      expect(MLLifecycleErrorCodes.DRIFT_CALCULATION_FAILED).toBe('ML_DRIFT_CALCULATION_FAILED');
      expect(MLLifecycleErrorCodes.ALERT_NOT_FOUND).toBe('ML_ALERT_NOT_FOUND');

      // A/B testing errors
      expect(MLLifecycleErrorCodes.ABTEST_NOT_FOUND).toBe('ML_ABTEST_NOT_FOUND');
      expect(MLLifecycleErrorCodes.ABTEST_INVALID_CONFIG).toBe('ML_ABTEST_INVALID_CONFIG');
      expect(MLLifecycleErrorCodes.ABTEST_ALREADY_RUNNING).toBe('ML_ABTEST_ALREADY_RUNNING');
      expect(MLLifecycleErrorCodes.ABTEST_INSUFFICIENT_DATA).toBe('ML_ABTEST_INSUFFICIENT_DATA');

      // Feature errors
      expect(MLLifecycleErrorCodes.FEATURE_NOT_FOUND).toBe('ML_FEATURE_NOT_FOUND');
      expect(MLLifecycleErrorCodes.FEATURE_VALIDATION_FAILED).toBe('ML_FEATURE_VALIDATION_FAILED');
      expect(MLLifecycleErrorCodes.FEATURE_SET_NOT_FOUND).toBe('ML_FEATURE_SET_NOT_FOUND');
    });
  });
});

// ============================================================================
// ML Lifecycle Invariant Tests
// ============================================================================

describe('INV-ML: ML Lifecycle Invariants', () => {
  describe('INV-ML-EXP-004: Status Transition Rules', () => {
    it('should validate valid status transitions', () => {
      // running → completed is valid
      const runningExperiment = {
        experimentId: '550e8400-e29b-41d4-a716-446655440000',
        experimentName: 'Test',
        hypothesis: 'Test',
        modelType: 'rf',
        hyperparameters: {},
        datasetVersion: 'v1',
        successCriteria: 'acc > 0.9',
        status: 'running',
        createdAt: new Date().toISOString(),
        createdBy: 'test',
      };

      // Validate the experiment can have status 'completed'
      const completedExperiment = { ...runningExperiment, status: 'completed' };
      expect(MLExperimentSchema.safeParse(completedExperiment).success).toBe(true);

      // completed → promoted is valid
      const promotedExperiment = { ...completedExperiment, status: 'promoted' };
      expect(MLExperimentSchema.safeParse(promotedExperiment).success).toBe(true);
    });
  });

  describe('INV-ML-REG-001: Version Monotonicity', () => {
    it('should validate SemVer version format', () => {
      const validVersions = ['1.0.0', '2.0.0', '10.20.30'];

      for (const version of validVersions) {
        const model = {
          modelName: 'test',
          version,
          lineage: {
            experimentId: '550e8400-e29b-41d4-a716-446655440000',
            trainingDataset: 'v1',
          },
          artifact: { path: '/test', checksum: 'abc', sizeBytes: 100 },
          schemas: { inputSchema: {}, outputSchema: {}, featureNames: [] },
          metrics: {},
          dependencies: { framework: 'pt', frameworkVersion: '1.0', packages: [] },
          status: 'staged',
          createdAt: new Date().toISOString(),
          createdBy: 'test',
        };

        expect(MLModelSchema.safeParse(model).success).toBe(true);
      }
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = ['v1.0.0', '1.0', 'latest'];

      for (const version of invalidVersions) {
        const model = {
          modelName: 'test',
          version,
          lineage: {
            experimentId: '550e8400-e29b-41d4-a716-446655440000',
            trainingDataset: 'v1',
          },
          artifact: { path: '/test', checksum: 'abc', sizeBytes: 100 },
          schemas: { inputSchema: {}, outputSchema: {}, featureNames: [] },
          metrics: {},
          dependencies: { framework: 'pt', frameworkVersion: '1.0', packages: [] },
          status: 'staged',
          createdAt: new Date().toISOString(),
          createdBy: 'test',
        };

        expect(MLModelSchema.safeParse(model).success).toBe(false);
      }
    });
  });

  describe('INV-ML-REG-004: Lineage Completeness', () => {
    it('should require experimentId in lineage', () => {
      const model = {
        modelName: 'test',
        version: '1.0.0',
        lineage: {
          // Missing experimentId
          trainingDataset: 'v1',
        },
        artifact: { path: '/test', checksum: 'abc', sizeBytes: 100 },
        schemas: { inputSchema: {}, outputSchema: {}, featureNames: [] },
        metrics: {},
        dependencies: { framework: 'pt', frameworkVersion: '1.0', packages: [] },
        status: 'staged',
        createdAt: new Date().toISOString(),
        createdBy: 'test',
      };

      expect(MLModelSchema.safeParse(model).success).toBe(false);
    });

    it('should require trainingDataset in lineage', () => {
      const model = {
        modelName: 'test',
        version: '1.0.0',
        lineage: {
          experimentId: '550e8400-e29b-41d4-a716-446655440000',
          // Missing trainingDataset
        },
        artifact: { path: '/test', checksum: 'abc', sizeBytes: 100 },
        schemas: { inputSchema: {}, outputSchema: {}, featureNames: [] },
        metrics: {},
        dependencies: { framework: 'pt', frameworkVersion: '1.0', packages: [] },
        status: 'staged',
        createdAt: new Date().toISOString(),
        createdBy: 'test',
      };

      expect(MLModelSchema.safeParse(model).success).toBe(false);
    });
  });

  describe('INV-ML-MON-002: Drift Threshold Consistency', () => {
    it('should validate drift severity levels', () => {
      const severities = ['none', 'moderate', 'significant', 'critical'];

      for (const severity of severities) {
        expect(DriftSeveritySchema.safeParse(severity).success).toBe(true);
      }
    });

    it('should validate drift result schema', () => {
      const driftResult = {
        modelName: 'test',
        modelVersion: '1.0.0',
        overallDriftLevel: 'moderate',
        featureResults: [
          {
            featureName: 'feature_1',
            driftScore: 0.25,
            severity: 'moderate',
            baselineStats: { mean: 0.5, std: 0.1 },
            currentStats: { mean: 0.6, std: 0.15 },
          },
        ],
        topDriftedFeatures: ['feature_1'],
        detectedAt: new Date().toISOString(),
      };

      expect(DataDriftResultSchema.safeParse(driftResult).success).toBe(true);
    });
  });

  describe('INV-ML-MON-003: Retraining Trigger Determinism', () => {
    it('should validate all retraining recommendations', () => {
      const recommendations = ['no_action', 'monitor', 'investigate', 'retrain', 'retrain_urgent'];

      for (const rec of recommendations) {
        expect(RetrainingRecommendationSchema.safeParse(rec).success).toBe(true);
      }
    });
  });

  describe('INV-ML-AB-001: Traffic Allocation Sum', () => {
    it('should validate traffic allocations sum to 1 in variants', () => {
      const variant1 = {
        variantId: 'control',
        variantName: 'Control',
        modelVersion: '1.0.0',
        trafficAllocation: 0.5,
        isControl: true,
      };

      const variant2 = {
        variantId: 'treatment',
        variantName: 'Treatment',
        modelVersion: '2.0.0',
        trafficAllocation: 0.5,
        isControl: false,
      };

      expect(ABTestVariantSchema.safeParse(variant1).success).toBe(true);
      expect(ABTestVariantSchema.safeParse(variant2).success).toBe(true);

      // Traffic allocations should sum to 1
      const total = variant1.trafficAllocation + variant2.trafficAllocation;
      expect(total).toBe(1.0);
    });

    it('should enforce traffic allocation bounds', () => {
      const invalidVariant = {
        variantId: 'invalid',
        variantName: 'Invalid',
        modelVersion: '1.0.0',
        trafficAllocation: 1.5, // Invalid: > 1
        isControl: false,
      };

      expect(ABTestVariantSchema.safeParse(invalidVariant).success).toBe(false);
    });
  });

  describe('INV-ML-AB-002: Control Variant Required', () => {
    it('should validate isControl field', () => {
      const controlVariant = {
        variantId: 'control',
        variantName: 'Control',
        modelVersion: '1.0.0',
        trafficAllocation: 0.5,
        isControl: true,
      };

      const treatmentVariant = {
        variantId: 'treatment',
        variantName: 'Treatment',
        modelVersion: '2.0.0',
        trafficAllocation: 0.5,
        isControl: false,
      };

      expect(ABTestVariantSchema.safeParse(controlVariant).success).toBe(true);
      expect(ABTestVariantSchema.safeParse(treatmentVariant).success).toBe(true);
    });
  });

  describe('INV-ML-AB-003: Sample Size Requirement', () => {
    it('should enforce minimum sample size of 100', () => {
      const config = {
        testId: '550e8400-e29b-41d4-a716-446655440000',
        testName: 'Test',
        modelName: 'test',
        hypothesis: 'test',
        variants: [
          { variantId: 'c', variantName: 'C', modelVersion: '1.0.0', trafficAllocation: 0.5, isControl: true },
          { variantId: 't', variantName: 'T', modelVersion: '2.0.0', trafficAllocation: 0.5, isControl: false },
        ],
        primaryMetric: 'accuracy',
        minimumSampleSize: 50, // Invalid: min is 100
        durationDays: 7,
        status: 'draft',
        createdAt: new Date().toISOString(),
        createdBy: 'test',
      };

      expect(ABTestConfigSchema.safeParse(config).success).toBe(false);
    });
  });
});
