# ML Lifecycle Contract V1 - Behavioral Invariants

This document defines the behavioral guarantees that MUST be enforced by any implementation of the ML Lifecycle contract.

## Experiment Tracking Invariants

### INV-ML-EXP-001: Experiment Immutability

**Statement:** Experiment parameters (hyperparameters, datasetVersion, modelType) MUST NOT change after experiment starts.

**Rationale:** Changing parameters mid-experiment invalidates reproducibility and comparisons.

**Enforcement:**
- Parameters frozen on creation (status = 'running')
- Updates rejected for non-status fields after start
- Error code: `ML_EXPERIMENT_IMMUTABLE`

**Test Criteria:**
```typescript
// Given an experiment with status = "running"
// When attempting to update hyperparameters
// Then update is rejected with EXPERIMENT_IMMUTABLE error
// And original hyperparameters are preserved
```

### INV-ML-EXP-002: Experiment Uniqueness

**Statement:** Experiment IDs MUST be unique within namespace.

**Rationale:** Unique IDs enable unambiguous experiment tracking and comparison.

**Enforcement:**
- UUID generation ensures global uniqueness
- Registry checks before registration
- Error code: `ML_EXPERIMENT_ALREADY_EXISTS`

**Test Criteria:**
```typescript
// Given experiment with experimentId = "abc-123"
// When registering another experiment with same ID
// Then registration fails with EXPERIMENT_ALREADY_EXISTS
```

### INV-ML-EXP-003: Metric Logging Order

**Statement:** Metrics MUST be logged in chronological order per metric name.

**Rationale:** Time-series analysis requires ordered metrics.

**Enforcement:**
- Timestamp validation on metric insertion
- New metric timestamp >= last metric timestamp for same metricName
- Append-only metric storage

**Test Criteria:**
```typescript
// Given metrics for experiment with timestamps [t1, t2, t3] where t1 < t2 < t3
// When inserting metric with timestamp t0 < t1
// Then insertion is rejected
// And error indicates timestamp order violation
```

### INV-ML-EXP-004: Status Transition Rules

**Statement:** Experiment status MUST follow valid transition paths.

**Rationale:** Prevents invalid state transitions (e.g., archived → running).

**Enforcement:**
- State machine validation:
  - `running` → `completed` | `failed`
  - `completed` → `promoted` | `rejected` | `archived`
  - `failed` → `archived`
  - `promoted` → `archived`
  - `rejected` → `archived`
- Invalid transitions rejected

**Test Criteria:**
```typescript
// Given experiment with status = "archived"
// When attempting to change status to "running"
// Then transition is rejected with INVALID_EXPERIMENT_STATUS
```

## Model Registry Invariants

### INV-ML-REG-001: Version Monotonicity

**Statement:** Model versions MUST increase monotonically (SemVer).

**Rationale:** Ensures clear upgrade path and prevents version confusion.

**Enforcement:**
- Version comparison before registration
- New version > existing highest version for same modelName
- Error code: `ML_MODEL_VERSION_INVALID`

**Test Criteria:**
```typescript
// Given registered model "my-model" version "1.2.0"
// When registering same model with version "1.1.0"
// Then registration fails with MODEL_VERSION_INVALID
// And error indicates version must be greater than 1.2.0
```

### INV-ML-REG-002: Single Production Model

**Statement:** Only ONE model version can be in 'production' status per model name at any time.

**Rationale:** Prevents ambiguity about which model serves production traffic.

**Enforcement:**
- Status update atomically archives previous production version
- Race condition prevention via optimistic locking
- Error code: `ML_PRODUCTION_MODEL_EXISTS` (for concurrent attempts)

**Test Criteria:**
```typescript
// Given model "my-model" v1.0.0 with status = "production"
// When promoting model "my-model" v2.0.0 to production
// Then v2.0.0 status becomes "production"
// And v1.0.0 status becomes "archived"
// And only one model has status "production"
```

### INV-ML-REG-003: Artifact Integrity

**Statement:** Model artifact checksum MUST match registered value on retrieve.

**Rationale:** Ensures model artifact has not been tampered with or corrupted.

**Enforcement:**
- Checksum validation on artifact retrieval
- Checksum algorithm: SHA-256
- Error code: `ML_MODEL_ARTIFACT_INVALID`

**Test Criteria:**
```typescript
// Given model with artifact.checksum = "abc123..."
// When retrieving artifact with different checksum
// Then retrieval fails with MODEL_ARTIFACT_INVALID
// And error indicates checksum mismatch
```

### INV-ML-REG-004: Lineage Completeness

**Statement:** Model registration MUST include complete lineage (experimentId, trainingDataset).

**Rationale:** Enables model provenance tracking and reproducibility.

**Enforcement:**
- Required fields validated on registration
- experimentId must reference existing experiment
- Error code: `ML_MODEL_LINEAGE_INCOMPLETE`

**Test Criteria:**
```typescript
// Given model registration without experimentId
// When registration is attempted
// Then registration fails with MODEL_LINEAGE_INCOMPLETE
```

### INV-ML-REG-005: Promotion Path

**Statement:** Models MUST follow valid promotion paths: staged → canary → production.

**Rationale:** Ensures proper validation before production deployment.

**Enforcement:**
- Direct staged → production blocked (unless override)
- Canary phase required by default
- Error code: `ML_PROMOTION_NOT_ALLOWED`

**Test Criteria:**
```typescript
// Given model with status = "staged"
// When promoting directly to "production" without override
// Then promotion fails with PROMOTION_NOT_ALLOWED
// And error indicates canary phase required
```

## Monitoring Invariants

### INV-ML-MON-001: Alert Ordering

**Statement:** Alerts MUST be ordered by timestamp descending (newest first).

**Rationale:** Most recent alerts are typically most relevant.

**Enforcement:**
- Index on timestamp field
- Query results sorted by createdAt DESC

**Test Criteria:**
```typescript
// Given alerts created at [t1, t2, t3] where t1 < t2 < t3
// When listing alerts
// Then alerts returned in order [t3, t2, t1]
```

### INV-ML-MON-002: Drift Threshold Consistency

**Statement:** Drift calculations MUST use consistent, configurable thresholds.

**Rationale:** Same input data with same thresholds must produce same drift severity.

**Enforcement:**
- Thresholds loaded from configuration, not hardcoded
- Default thresholds:
  - `none`: score < 0.1
  - `moderate`: 0.1 <= score < 0.3
  - `significant`: 0.3 <= score < 0.5
  - `critical`: score >= 0.5

**Test Criteria:**
```typescript
// Given drift score = 0.35
// When calculating severity with default thresholds
// Then severity = "significant"
// And same score always produces same severity
```

### INV-ML-MON-003: Retraining Trigger Determinism

**Statement:** Same drift metrics MUST produce same retraining recommendation.

**Rationale:** Reproducible recommendations for auditing and automation.

**Enforcement:**
- Deterministic decision matrix
- No random components in recommendation logic
- Decision based on:
  - `no_action`: no drift detected
  - `monitor`: moderate drift only
  - `investigate`: significant data OR prediction drift
  - `retrain`: significant data AND prediction drift
  - `retrain_urgent`: critical drift OR performance degradation

**Test Criteria:**
```typescript
// Given dataDriftLevel = "significant", predictionDriftLevel = "moderate"
// When calculating recommendation
// Then recommendation = "investigate"
// And running again produces same recommendation
```

### INV-ML-MON-004: Alert Acknowledgment Audit

**Statement:** Alert acknowledgment MUST record who acknowledged and when.

**Rationale:** Audit trail for compliance and accountability.

**Enforcement:**
- acknowledged = true requires acknowledgedBy and acknowledgedAt
- Cannot unacknowledge (set acknowledged = false after true)

**Test Criteria:**
```typescript
// Given alert with acknowledged = false
// When acknowledging alert
// Then acknowledged = true
// And acknowledgedAt is set to current time
// And acknowledgedBy is set to acknowledger ID
```

## A/B Testing Invariants

### INV-ML-AB-001: Traffic Allocation Sum

**Statement:** Variant traffic allocations MUST sum to 1.0 (100%).

**Rationale:** All traffic must be routed to exactly one variant.

**Enforcement:**
- Schema validation on ABTestConfig
- Sum of variant.trafficAllocation = 1.0 ± 0.001 (float tolerance)
- Error code: `ML_ABTEST_INVALID_CONFIG`

**Test Criteria:**
```typescript
// Given variants with trafficAllocation [0.5, 0.3]
// When creating A/B test
// Then creation fails with ABTEST_INVALID_CONFIG
// And error indicates traffic must sum to 1.0
```

### INV-ML-AB-002: Control Variant Required

**Statement:** Every A/B test MUST have exactly one control variant (isControl = true).

**Rationale:** Statistical significance requires baseline comparison.

**Enforcement:**
- Exactly one variant with isControl = true
- Error code: `ML_ABTEST_INVALID_CONFIG`

**Test Criteria:**
```typescript
// Given variants with no isControl = true
// When creating A/B test
// Then creation fails with ABTEST_INVALID_CONFIG
// And error indicates control variant required
```

### INV-ML-AB-003: Sample Size Requirement

**Statement:** A/B test results MUST NOT be declared conclusive until minimum sample size reached.

**Rationale:** Statistical validity requires sufficient sample size.

**Enforcement:**
- Total samples across variants >= minimumSampleSize
- Results marked 'inconclusive' until threshold met
- Error code: `ML_ABTEST_INSUFFICIENT_DATA`

**Test Criteria:**
```typescript
// Given A/B test with minimumSampleSize = 1000
// When analyzing results with 500 total samples
// Then status = "inconclusive"
// And winningVariant is null
```

### INV-ML-AB-004: Concurrent Test Prevention

**Statement:** Only ONE A/B test per model can be in 'running' status.

**Rationale:** Concurrent tests contaminate results.

**Enforcement:**
- Check for running tests before starting new test
- Error code: `ML_ABTEST_ALREADY_RUNNING`

**Test Criteria:**
```typescript
// Given running A/B test for model "my-model"
// When starting another test for same model
// Then start fails with ABTEST_ALREADY_RUNNING
```

## Feature Engineering Invariants

### INV-ML-FE-001: Feature Version Immutability

**Statement:** Feature definitions MUST NOT change for a given version; create new version instead.

**Rationale:** Training data consistency requires stable feature definitions.

**Enforcement:**
- Updates create new version
- Existing versions immutable
- Error code: `ML_FEATURE_VALIDATION_FAILED`

**Test Criteria:**
```typescript
// Given feature "age" version "1.0.0" with type = "numeric"
// When attempting to change type to "categorical"
// Then update is rejected
// And error indicates immutability
```

### INV-ML-FE-002: Feature Validation Rules

**Statement:** Feature values MUST pass defined validation rules.

**Rationale:** Data quality enforcement at feature level.

**Enforcement:**
- Validation rules applied during feature computation
- Failed validations logged with details
- Error code: `ML_FEATURE_VALIDATION_FAILED`

**Test Criteria:**
```typescript
// Given feature with validationRules.minValue = 0
// When computing feature with value = -5
// Then validation fails with FEATURE_VALIDATION_FAILED
// And error includes feature name and invalid value
```
