# PRD: ML/Data Science Workflow Enhancements

**Version:** 1.0.0
**Created:** 2025-12-18
**Status:** Draft
**Author:** AI Analysis

---

## Executive Summary

Current AutomatosX ML/Data Science coverage is **50%** of the industry-standard ML lifecycle. This PRD defines high-value workflows to achieve **90%+ coverage**, making AutomatosX competitive with MLflow + Weights & Biases for ML lifecycle management.

### Current State

| Covered | Not Covered |
|---------|-------------|
| Problem Definition | Model Training Workflow |
| Data Exploration (EDA) | Hyperparameter Tuning |
| Data Cleaning | Model Evaluation Pipeline |
| Feature Engineering | Experiment Tracking |
| Model Selection | Model Registry |
| | Production Monitoring |
| | A/B Testing |

### Target State

Full ML lifecycle coverage from experimentation through production monitoring.

---

## Priority Matrix

### Tier 1: Critical (Implement Immediately)

| Workflow | Effort | Impact | Dependencies |
|----------|--------|--------|--------------|
| Experiment Tracking | 2 days | Critical | memory_store |
| Model Evaluation | 2 days | Critical | data-scientist agent |
| Model Registry | 1 day | Critical | memory_store |

### Tier 2: Important (Next Quarter)

| Workflow | Effort | Impact | Dependencies |
|----------|--------|--------|--------------|
| Model Monitoring | 3 days | High | Model Registry |
| Feature Engineering | 2 days | High | data-scientist agent |
| A/B Testing | 2 days | High | data-scientist agent |
| MLOps Engineer Agent | 1 day | High | None |

### Tier 3: Future

| Workflow | Effort | Impact |
|----------|--------|--------|
| AutoML Pipeline | 1 week | Medium |
| Model Explainability | 3 days | Medium |
| Data Labeling | 1 week | Low |

---

## Tier 1 Workflow Specifications

### 1. Experiment Tracking Workflow

**File:** `examples/workflows/ml-experiment-tracker.yaml`

**Purpose:** Track, compare, and manage ML experiments for reproducibility.

**Why Critical:** Without experiment tracking, ML is not reproducible. This is table stakes for any serious ML team.

```yaml
workflowId: ml-experiment-tracker
name: ML Experiment Tracker
description: Track, compare, and manage ML experiments
version: "1.0.0"
category: machine-learning
tags:
  - ml
  - experiments
  - tracking
  - reproducibility

metadata:
  requiredAbilities:
    - machine-learning
    - statistical-analysis
    - data-analysis
  estimatedDuration: 300  # 5 minutes
  complexity: medium

steps:
  - stepId: define-experiment
    name: Define Experiment
    type: prompt
    timeout: 60000
    config:
      agent: ml-engineer
      task: |
        Define the ML experiment with the following structure:

        ## Experiment Definition

        1. **Hypothesis**: What are we testing?
        2. **Baseline Model**: What is the current best model?
        3. **Metrics to Track**:
           - Primary metric (optimization target)
           - Secondary metrics (guardrails)
        4. **Success Criteria**: What improvement is significant?
        5. **Dataset Version**: Which data split are we using?

        Provide structured output for logging.

  - stepId: log-parameters
    name: Log Experiment Parameters
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-experiments
      key: "{{experiment_id}}/parameters"
      value:
        experiment_id: "{{experiment_id}}"
        experiment_name: "{{experiment_name}}"
        hypothesis: "{{hypothesis}}"
        model_type: "{{model_type}}"
        hyperparameters: "{{hyperparameters}}"
        dataset_version: "{{dataset_version}}"
        baseline_model: "{{baseline_model}}"
        success_criteria: "{{success_criteria}}"
        created_at: "{{timestamp}}"
        created_by: "{{user}}"
        status: "running"

  - stepId: log-metrics
    name: Log Training Metrics
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-experiments
      key: "{{experiment_id}}/metrics"
      value:
        experiment_id: "{{experiment_id}}"
        metrics:
          accuracy: "{{accuracy}}"
          precision: "{{precision}}"
          recall: "{{recall}}"
          f1_score: "{{f1_score}}"
          auc_roc: "{{auc_roc}}"
          loss: "{{loss}}"
        training_metrics:
          training_time_seconds: "{{training_time}}"
          epochs_completed: "{{epochs}}"
          early_stopping_epoch: "{{early_stop_epoch}}"
        resource_usage:
          peak_memory_mb: "{{peak_memory}}"
          gpu_utilization: "{{gpu_util}}"
        logged_at: "{{timestamp}}"

  - stepId: compare-experiments
    name: Compare with Baseline
    type: prompt
    timeout: 120000
    config:
      agent: data-scientist
      task: |
        Compare experiment {{experiment_id}} against the baseline model.

        ## Analysis Required

        1. **Metric Comparison**:
           - Calculate absolute and relative improvement
           - For each metric: baseline vs experiment

        2. **Statistical Significance**:
           - Is the improvement statistically significant?
           - Calculate p-value if applicable
           - Report confidence intervals

        3. **Trade-off Analysis**:
           - Accuracy vs inference latency
           - Model complexity vs performance
           - Training cost vs improvement

        4. **Recommendation**:
           - PROMOTE: Significant improvement, ready for production
           - ITERATE: Promising but needs refinement
           - REJECT: No improvement or regression

        Provide structured recommendation with justification.

  - stepId: update-status
    name: Update Experiment Status
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-experiments
      key: "{{experiment_id}}/status"
      value:
        experiment_id: "{{experiment_id}}"
        status: "{{recommendation}}"  # promoted | iterate | rejected
        comparison_summary: "{{comparison_summary}}"
        statistical_significance: "{{p_value}}"
        recommendation_rationale: "{{rationale}}"
        completed_at: "{{timestamp}}"

  - stepId: store-comparison-report
    name: Store Comparison Report
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-experiment-reports
      key: "{{experiment_id}}/comparison"
      ttl: 7776000  # 90 days retention
      value:
        experiment_id: "{{experiment_id}}"
        baseline_id: "{{baseline_model}}"
        full_report: "{{comparison_report}}"
        created_at: "{{timestamp}}"
```

---

### 2. Model Evaluation Workflow

**File:** `examples/workflows/ml-model-evaluation.yaml`

**Purpose:** Comprehensive model evaluation across multiple dimensions (performance, fairness, robustness, production-readiness).

**Why Critical:** Most ML projects fail in production because evaluation was superficial. This ensures models are thoroughly validated.

```yaml
workflowId: ml-model-evaluation
name: Model Evaluation Pipeline
description: Comprehensive model evaluation with performance, fairness, robustness, and production-readiness checks
version: "1.0.0"
category: machine-learning
tags:
  - ml
  - evaluation
  - fairness
  - robustness
  - production

metadata:
  requiredAbilities:
    - machine-learning
    - statistical-analysis
    - data-analysis
  estimatedDuration: 600  # 10 minutes
  complexity: high

steps:
  - stepId: performance-metrics
    name: Calculate Performance Metrics
    type: prompt
    timeout: 180000
    config:
      agent: data-scientist
      task: |
        Evaluate model performance on the test dataset.

        ## Classification Metrics (if applicable)
        - Accuracy
        - Precision (macro, micro, weighted)
        - Recall (macro, micro, weighted)
        - F1 Score (macro, micro, weighted)
        - AUC-ROC (one-vs-rest for multiclass)
        - AUC-PR (Precision-Recall curve)
        - Log Loss
        - Confusion Matrix
        - Per-class metrics breakdown

        ## Regression Metrics (if applicable)
        - Mean Squared Error (MSE)
        - Root Mean Squared Error (RMSE)
        - Mean Absolute Error (MAE)
        - R² (Coefficient of Determination)
        - Mean Absolute Percentage Error (MAPE)
        - Residual analysis

        ## Confidence Intervals
        - Bootstrap 95% CI for primary metric
        - Report standard deviation across folds

        Provide structured output with all applicable metrics.

  - stepId: fairness-audit
    name: Fairness & Bias Audit
    type: prompt
    timeout: 180000
    config:
      agent: data-scientist
      task: |
        Conduct a comprehensive fairness and bias audit.

        ## Demographic Analysis
        For each protected attribute (gender, age, race, etc.):

        1. **Demographic Parity**:
           - Selection rate across groups
           - Disparate impact ratio (should be > 0.8)

        2. **Equal Opportunity**:
           - True positive rate across groups
           - False negative rate disparity

        3. **Equalized Odds**:
           - TPR and FPR across groups
           - Maximum disparity

        4. **Calibration**:
           - Predicted probability vs actual outcome by group

        ## Bias Detection
        - Identify any systematic prediction bias
        - Check for proxy discrimination
        - Analyze error distribution across groups

        ## Mitigation Recommendations
        If bias is detected:
        - Recommend specific mitigation strategies
        - Estimate impact of mitigation on overall performance

        ## Compliance Check
        - Flag any potential regulatory concerns (GDPR, CCPA, ECOA)

  - stepId: robustness-testing
    name: Robustness & Edge Case Testing
    type: prompt
    timeout: 180000
    config:
      agent: ml-engineer
      task: |
        Test model robustness and behavior on edge cases.

        ## Input Perturbation Testing
        1. **Noise Sensitivity**:
           - Add Gaussian noise to numerical features
           - Measure performance degradation curve

        2. **Missing Values**:
           - Simulate missing data patterns
           - Test model behavior with incomplete inputs

        3. **Out-of-Range Values**:
           - Test with extreme values
           - Check for catastrophic failures

        ## Distribution Shift Testing
        1. **Covariate Shift**:
           - Test on data with shifted feature distributions
           - Measure performance drop

        2. **Label Shift**:
           - Test with different class proportions
           - Check calibration under shift

        ## Edge Cases
        1. Boundary conditions
        2. Rare class handling
        3. Adversarial-like examples (if applicable)

        ## Out-of-Distribution Detection
        - Can the model identify when inputs are OOD?
        - Confidence calibration on OOD samples

  - stepId: latency-profiling
    name: Latency & Resource Profiling
    type: prompt
    timeout: 120000
    config:
      agent: ml-engineer
      task: |
        Profile model for production deployment.

        ## Inference Latency
        - Single sample latency (p50, p95, p99)
        - Batch inference latency by batch size
        - Cold start latency
        - Warm cache latency

        ## Resource Requirements
        - Memory footprint (model size)
        - Peak memory during inference
        - CPU utilization pattern
        - GPU utilization (if applicable)
        - GPU memory requirements

        ## Scalability Analysis
        - Throughput (requests/second)
        - Scaling behavior under load
        - Recommended instance type
        - Cost per 1M predictions

        ## Optimization Opportunities
        - Quantization potential
        - Pruning opportunities
        - Distillation candidates
        - Caching strategies

  - stepId: evaluation-report
    name: Generate Evaluation Report
    type: prompt
    timeout: 120000
    config:
      agent: data-scientist
      task: |
        Create a comprehensive model evaluation report.

        ## Executive Summary
        - Model name and version
        - One-paragraph assessment
        - Go/No-Go recommendation with confidence level

        ## Performance Summary
        - Primary metric with confidence interval
        - Comparison to baseline
        - Key strengths and weaknesses

        ## Fairness Summary
        - Overall fairness assessment (Pass/Fail/Warning)
        - Groups with highest disparity
        - Required mitigations before deployment

        ## Robustness Summary
        - Robustness score (1-10)
        - Critical failure modes identified
        - Recommended guardrails

        ## Production Readiness
        - Latency requirements: Met/Not Met
        - Resource requirements: Acceptable/High/Excessive
        - Scaling assessment

        ## Recommendations
        1. **If Go**: Deployment checklist
        2. **If No-Go**: Required improvements ranked by priority
        3. **Monitoring requirements** for production

        ## Appendix
        - Full metrics tables
        - Visualization references
        - Test dataset description

  - stepId: store-evaluation
    name: Store Evaluation Results
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-evaluations
      key: "{{model_name}}/{{model_version}}/evaluation"
      ttl: 15552000  # 180 days retention
      value:
        model_name: "{{model_name}}"
        model_version: "{{model_version}}"
        evaluation_id: "{{evaluation_id}}"
        recommendation: "{{go_no_go}}"
        performance_metrics: "{{performance_metrics}}"
        fairness_results: "{{fairness_results}}"
        robustness_score: "{{robustness_score}}"
        latency_profile: "{{latency_profile}}"
        full_report: "{{evaluation_report}}"
        evaluated_at: "{{timestamp}}"
        evaluated_by: "{{user}}"
```

---

### 3. Model Registry Workflow

**File:** `examples/workflows/ml-model-registry.yaml`

**Purpose:** Version, store, and manage ML models through their lifecycle.

**Why Critical:** Without a model registry, you can't answer "what model is in production?" or "can we rollback?"

```yaml
workflowId: ml-model-registry
name: Model Registry Management
description: Version, store, and manage ML models through their lifecycle
version: "1.0.0"
category: machine-learning
tags:
  - ml
  - model-registry
  - versioning
  - deployment

metadata:
  requiredAbilities:
    - machine-learning
  estimatedDuration: 120  # 2 minutes
  complexity: low

steps:
  - stepId: validate-model
    name: Validate Model Artifact
    type: prompt
    timeout: 60000
    config:
      agent: ml-engineer
      task: |
        Validate the model artifact before registration.

        ## Validation Checks
        1. **Artifact Integrity**:
           - Model file exists and is readable
           - Checksum matches expected value

        2. **Schema Validation**:
           - Input schema is defined
           - Output schema is defined
           - Feature names match training data

        3. **Metadata Completeness**:
           - Training dataset version recorded
           - Hyperparameters recorded
           - Evaluation metrics recorded
           - Experiment ID linked

        4. **Dependency Check**:
           - Required libraries documented
           - Version compatibility verified

        Return validation status: PASS or FAIL with details.

  - stepId: register-model
    name: Register Model Version
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-model-registry
      key: "{{model_name}}/versions/{{version}}"
      value:
        model_name: "{{model_name}}"
        version: "{{version}}"
        description: "{{description}}"

        # Lineage
        experiment_id: "{{experiment_id}}"
        training_dataset: "{{dataset_version}}"
        parent_model: "{{parent_version}}"  # for fine-tuned models

        # Artifact
        artifact_path: "{{artifact_path}}"
        artifact_checksum: "{{checksum}}"
        artifact_size_bytes: "{{size}}"

        # Schemas
        input_schema: "{{input_schema}}"
        output_schema: "{{output_schema}}"
        feature_names: "{{feature_names}}"

        # Performance
        metrics: "{{metrics}}"
        evaluation_id: "{{evaluation_id}}"

        # Dependencies
        framework: "{{framework}}"  # pytorch, tensorflow, sklearn
        framework_version: "{{framework_version}}"
        dependencies: "{{dependencies}}"

        # Lifecycle
        status: "staged"  # staged | canary | production | archived | deprecated
        created_at: "{{timestamp}}"
        created_by: "{{user}}"

        # Tags
        tags: "{{tags}}"

  - stepId: update-model-index
    name: Update Model Index
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-model-registry
      key: "{{model_name}}/index"
      value:
        model_name: "{{model_name}}"
        latest_version: "{{version}}"
        production_version: "{{production_version}}"
        all_versions: "{{version_list}}"
        updated_at: "{{timestamp}}"

  - stepId: compare-versions
    name: Compare Model Versions
    type: prompt
    timeout: 120000
    config:
      agent: data-scientist
      task: |
        Compare the new model version against the current production version.

        ## Comparison Dimensions

        1. **Performance Delta**:
           - Metric-by-metric comparison
           - Statistical significance of differences
           - Confidence intervals

        2. **Schema Compatibility**:
           - Input schema changes (breaking/non-breaking)
           - Output schema changes
           - Feature additions/removals

        3. **Resource Changes**:
           - Model size difference
           - Inference latency change
           - Memory requirement change

        4. **Risk Assessment**:
           - Breaking changes identified
           - Rollback complexity
           - Required client updates

        ## Recommendation
        - **PROMOTE**: Ready for production rollout
        - **CANARY**: Recommend gradual rollout with monitoring
        - **HOLD**: Needs more evaluation
        - **REJECT**: Does not meet requirements

  - stepId: promotion-decision
    name: Handle Promotion Decision
    type: conditional
    config:
      condition: "{{recommendation}}"
      branches:
        promote:
          - stepId: promote-to-production
            type: tool
            tool: memory_store
            config:
              namespace: ml-model-registry
              key: "{{model_name}}/versions/{{version}}"
              merge: true
              value:
                status: "production"
                promoted_at: "{{timestamp}}"
                promoted_by: "{{user}}"
          - stepId: archive-old-production
            type: tool
            tool: memory_store
            config:
              namespace: ml-model-registry
              key: "{{model_name}}/versions/{{old_production_version}}"
              merge: true
              value:
                status: "archived"
                archived_at: "{{timestamp}}"
                archived_reason: "Superseded by {{version}}"

        canary:
          - stepId: set-canary-status
            type: tool
            tool: memory_store
            config:
              namespace: ml-model-registry
              key: "{{model_name}}/versions/{{version}}"
              merge: true
              value:
                status: "canary"
                canary_started_at: "{{timestamp}}"
                canary_traffic_percent: 10

  - stepId: notify-promotion
    name: Generate Promotion Notification
    type: prompt
    timeout: 60000
    config:
      agent: writer
      task: |
        Create a model promotion notification for stakeholders.

        ## Notification Content

        **Subject**: Model Promotion: {{model_name}} v{{version}}

        **Summary**:
        - Previous production version: {{old_version}}
        - New production version: {{version}}
        - Promotion type: {{promotion_type}} (immediate/canary)

        **Key Changes**:
        - Performance improvement: {{performance_delta}}
        - Notable changes: {{changes}}

        **Rollback Plan**:
        - Rollback command/procedure
        - Rollback criteria
        - On-call contact

        **Timeline**:
        - Promotion start: {{timestamp}}
        - Full rollout (if canary): {{full_rollout_date}}
        - Monitoring period: {{monitoring_period}}

  - stepId: store-promotion-event
    name: Log Promotion Event
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-model-events
      key: "{{model_name}}/promotions/{{timestamp}}"
      ttl: 31536000  # 1 year retention
      value:
        event_type: "promotion"
        model_name: "{{model_name}}"
        from_version: "{{old_production_version}}"
        to_version: "{{version}}"
        promotion_type: "{{promotion_type}}"
        initiated_by: "{{user}}"
        timestamp: "{{timestamp}}"
        notification_sent: true
```

---

## Tier 2 Workflow Specifications

### 4. Model Monitoring Workflow

**File:** `examples/workflows/ml-model-monitoring.yaml`

**Purpose:** Detect drift, degradation, and anomalies in production models.

**Why Important:** Models degrade silently. This catches problems before they impact users.

```yaml
workflowId: ml-model-monitoring
name: Production Model Monitoring
description: Detect drift, degradation, and anomalies in production models
version: "1.0.0"
category: machine-learning
tags:
  - ml
  - monitoring
  - drift
  - production

metadata:
  requiredAbilities:
    - machine-learning
    - statistical-analysis
    - data-analysis
  estimatedDuration: 300  # 5 minutes
  complexity: high
  schedule: "0 */6 * * *"  # Every 6 hours

steps:
  - stepId: fetch-baseline
    name: Fetch Baseline Statistics
    type: tool
    timeout: 10000
    tool: memory_retrieve
    config:
      namespace: ml-model-registry
      key: "{{model_name}}/versions/{{production_version}}/baseline_stats"

  - stepId: fetch-production-data
    name: Fetch Recent Production Data
    type: tool
    timeout: 30000
    tool: memory_search
    config:
      namespace: ml-production-predictions
      query: "model:{{model_name}} AND timestamp:[{{window_start}} TO {{window_end}}]"
      limit: 10000

  - stepId: data-drift-detection
    name: Detect Data Drift
    type: prompt
    timeout: 180000
    config:
      agent: data-scientist
      task: |
        Analyze production data for drift compared to training data.

        ## Feature Distribution Analysis
        For each feature:

        1. **Statistical Tests**:
           - Kolmogorov-Smirnov test (continuous features)
           - Chi-squared test (categorical features)
           - Population Stability Index (PSI)

        2. **Drift Severity**:
           - No Drift: PSI < 0.1
           - Moderate Drift: 0.1 <= PSI < 0.25
           - Significant Drift: PSI >= 0.25

        3. **Per-Feature Report**:
           - Feature name
           - Drift score
           - Baseline mean/distribution
           - Current mean/distribution
           - Visual: distribution comparison

        ## Overall Assessment
        - Total features with significant drift
        - Most drifted features (top 5)
        - Drift trend (increasing/stable/decreasing)

        ## Alert Level
        - GREEN: No significant drift
        - YELLOW: Moderate drift, monitor closely
        - RED: Significant drift, action required

  - stepId: prediction-drift
    name: Detect Prediction Drift
    type: prompt
    timeout: 120000
    config:
      agent: data-scientist
      task: |
        Analyze prediction distribution for drift.

        ## Prediction Distribution Analysis

        1. **Output Distribution**:
           - Compare current vs baseline prediction distribution
           - For classification: class probability distributions
           - For regression: prediction value distribution

        2. **Confidence Scores**:
           - Average confidence: baseline vs current
           - Confidence distribution shift
           - Low-confidence prediction rate

        3. **Prediction Patterns**:
           - Class balance (classification)
           - Prediction range (regression)
           - Unusual prediction clusters

        ## Anomaly Detection
        - Identify sudden prediction shifts
        - Detect prediction patterns not seen in training
        - Flag potential model failures

  - stepId: performance-degradation
    name: Check Performance Degradation
    type: prompt
    timeout: 120000
    config:
      agent: ml-engineer
      task: |
        Compare current model performance against baseline.

        ## Metric Comparison (if ground truth available)

        | Metric | Baseline | Current | Delta | Status |
        |--------|----------|---------|-------|--------|
        | Accuracy | X | Y | Z% | OK/WARN/ALERT |
        | Precision | X | Y | Z% | OK/WARN/ALERT |
        | Recall | X | Y | Z% | OK/WARN/ALERT |

        ## Thresholds
        - OK: Within 5% of baseline
        - WARN: 5-10% degradation
        - ALERT: >10% degradation

        ## Latency Analysis
        - P50 latency: baseline vs current
        - P99 latency: baseline vs current
        - Timeout rate

        ## Error Analysis
        - Error rate trend
        - Error type distribution
        - New error patterns

  - stepId: retraining-decision
    name: Retraining Recommendation
    type: prompt
    timeout: 60000
    config:
      agent: ml-engineer
      task: |
        Based on drift and degradation analysis, recommend action.

        ## Decision Matrix

        | Data Drift | Performance Drop | Recommendation |
        |------------|------------------|----------------|
        | None | None | NO_ACTION |
        | Moderate | None | MONITOR |
        | Significant | None | INVESTIGATE |
        | None | Moderate | INVESTIGATE |
        | Moderate | Moderate | RETRAIN |
        | Significant | Any | RETRAIN_URGENT |
        | Any | Significant | RETRAIN_URGENT |

        ## Recommendation Output
        - **Action**: NO_ACTION / MONITOR / INVESTIGATE / RETRAIN / RETRAIN_URGENT
        - **Confidence**: HIGH / MEDIUM / LOW
        - **Reasoning**: Explanation

        ## If RETRAIN Recommended
        - Suggested training data window
        - Features to focus on
        - Hyperparameter adjustments to consider

        ## If INVESTIGATE Recommended
        - Likely root causes to check
        - Data quality checks to run
        - External factors to consider

  - stepId: generate-alerts
    name: Generate Monitoring Alerts
    type: conditional
    config:
      condition: "{{action}} != 'NO_ACTION'"
      then:
        - stepId: store-alert
          type: tool
          tool: memory_store
          config:
            namespace: ml-alerts
            key: "{{model_name}}/{{timestamp}}"
            value:
              alert_id: "{{alert_id}}"
              model_name: "{{model_name}}"
              model_version: "{{production_version}}"
              severity: "{{severity}}"  # INFO / WARNING / CRITICAL
              action_required: "{{action}}"

              drift_summary:
                data_drift_level: "{{data_drift_level}}"
                prediction_drift_level: "{{prediction_drift_level}}"
                top_drifted_features: "{{top_drifted_features}}"

              performance_summary:
                degradation_detected: "{{degradation_detected}}"
                metrics_affected: "{{metrics_affected}}"

              recommendation: "{{recommendation}}"
              created_at: "{{timestamp}}"
              acknowledged: false

  - stepId: store-monitoring-report
    name: Store Monitoring Report
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-monitoring-reports
      key: "{{model_name}}/{{report_date}}"
      ttl: 2592000  # 30 days retention
      value:
        model_name: "{{model_name}}"
        model_version: "{{production_version}}"
        report_period:
          start: "{{window_start}}"
          end: "{{window_end}}"
        data_drift_report: "{{data_drift_report}}"
        prediction_drift_report: "{{prediction_drift_report}}"
        performance_report: "{{performance_report}}"
        action_taken: "{{action}}"
        generated_at: "{{timestamp}}"
```

---

### 5. Feature Engineering Workflow

**File:** `examples/workflows/ml-feature-engineering.yaml`

**Purpose:** Systematic feature creation, validation, and selection.

**Why Important:** Feature engineering is where ML practitioners spend 80% of their time. A structured workflow accelerates this.

```yaml
workflowId: ml-feature-engineering
name: Feature Engineering Pipeline
description: Systematic feature creation, validation, and selection
version: "1.0.0"
category: machine-learning
tags:
  - ml
  - features
  - feature-engineering
  - feature-selection

metadata:
  requiredAbilities:
    - machine-learning
    - data-analysis
    - feature-engineering
  estimatedDuration: 600  # 10 minutes
  complexity: high

steps:
  - stepId: feature-ideation
    name: Feature Ideation
    type: prompt
    timeout: 180000
    config:
      agent: data-scientist
      task: |
        Given the prediction target and available data, brainstorm candidate features.

        ## Feature Categories to Consider

        1. **Raw Features**:
           - Direct columns from source data
           - Basic transformations (log, sqrt, power)

        2. **Domain Knowledge Features**:
           - Business logic features
           - Industry-specific indicators
           - Expert-derived calculations

        3. **Interaction Features**:
           - Feature products (A * B)
           - Feature ratios (A / B)
           - Feature differences (A - B)

        4. **Time-Based Features** (if temporal data):
           - Lag features
           - Rolling statistics (mean, std, min, max)
           - Time since event
           - Seasonal indicators
           - Trend features

        5. **Aggregation Features**:
           - Group-by statistics
           - Entity-level aggregations
           - Window aggregations

        6. **Text Features** (if text data):
           - TF-IDF
           - Word embeddings
           - Sentiment scores
           - Named entities

        7. **Categorical Encodings**:
           - One-hot encoding
           - Target encoding
           - Frequency encoding
           - Embedding encoding

        ## Output Format
        For each candidate feature:
        - Feature name
        - Description
        - Calculation logic
        - Expected predictive value (hypothesis)
        - Implementation complexity (low/medium/high)

  - stepId: feature-implementation
    name: Implement Features
    type: prompt
    timeout: 300000
    config:
      agent: data-scientist
      task: |
        Implement the candidate features with production-quality code.

        ## For Each Feature

        1. **Transformation Code**:
           ```python
           def compute_feature_name(df: pd.DataFrame) -> pd.Series:
               '''
               Description of what this feature represents.

               Args:
                   df: Input dataframe with required columns

               Returns:
                   pd.Series: Computed feature values
               '''
               # Implementation
               pass
           ```

        2. **Missing Value Handling**:
           - Strategy: drop / fill_mean / fill_median / fill_mode / fill_constant
           - Justification for chosen strategy

        3. **Edge Case Handling**:
           - Division by zero
           - Negative values for log transforms
           - Null propagation

        4. **Data Type**:
           - Output dtype
           - Value range

        ## Feature Pipeline
        Create a combined feature pipeline function that:
        - Takes raw data
        - Applies all transformations
        - Returns feature matrix

  - stepId: feature-validation
    name: Validate Features
    type: prompt
    timeout: 180000
    config:
      agent: data-scientist
      task: |
        Validate feature quality and check for common issues.

        ## Data Leakage Check

        1. **Target Leakage**:
           - Does any feature contain information from the target?
           - Is any feature computed using future data?
           - Check correlation with target on train vs test

        2. **Train-Test Leakage**:
           - Are features computed using test data statistics?
           - Is any global normalization applied before split?

        ## Feature Quality Checks

        1. **Missing Values**:
           - Missing rate per feature
           - Flag features with >50% missing

        2. **Cardinality**:
           - Unique value count
           - Flag high-cardinality categoricals

        3. **Distribution**:
           - Check for extreme skewness
           - Identify outliers
           - Check for constant features

        4. **Correlation Analysis**:
           - Correlation with target
           - Inter-feature correlation matrix
           - Flag highly correlated pairs (>0.95)

        ## Validation Report
        For each feature:
        - Leakage risk: SAFE / WARNING / DANGEROUS
        - Quality score: 1-10
        - Issues found
        - Recommendations

  - stepId: feature-selection
    name: Select Final Features
    type: prompt
    timeout: 180000
    config:
      agent: ml-engineer
      task: |
        Select the final feature set for modeling.

        ## Selection Methods

        1. **Importance-Based Selection**:
           - SHAP values from baseline model
           - Permutation importance
           - Random forest feature importance

        2. **Statistical Selection**:
           - Mutual information with target
           - Chi-squared test (categorical)
           - ANOVA F-value (continuous)

        3. **Iterative Selection**:
           - Forward selection results
           - Backward elimination results
           - Recursive feature elimination

        ## Selection Criteria

        - Remove features with:
          - Near-zero variance
          - High missing rate (>50%)
          - High correlation with other features (>0.95)
          - Low importance (bottom 10%)
          - Data leakage risk

        - Keep features with:
          - High target correlation
          - Domain importance
          - Unique information

        ## Final Feature Set

        | Feature | Importance Rank | Rationale |
        |---------|-----------------|-----------|
        | feature_1 | 1 | ... |
        | feature_2 | 2 | ... |

        Total features selected: X out of Y candidates

  - stepId: store-feature-definitions
    name: Store Feature Definitions
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-feature-store
      key: "{{feature_set_name}}/{{version}}"
      value:
        feature_set_name: "{{feature_set_name}}"
        version: "{{version}}"
        description: "{{description}}"
        target_variable: "{{target}}"

        features:
          - name: "{{feature_name}}"
            description: "{{feature_description}}"
            dtype: "{{dtype}}"
            computation: "{{computation_logic}}"
            missing_strategy: "{{missing_strategy}}"
            importance_rank: "{{rank}}"

        validation_results:
          leakage_check: "{{leakage_status}}"
          quality_scores: "{{quality_scores}}"

        selection_summary:
          total_candidates: "{{total_candidates}}"
          selected_count: "{{selected_count}}"
          selection_method: "{{selection_method}}"

        created_at: "{{timestamp}}"
        created_by: "{{user}}"
```

---

### 6. A/B Testing Workflow

**File:** `examples/workflows/ml-ab-testing.yaml`

**Purpose:** Statistical comparison of model variants in production.

**Why Important:** Most companies deploy models without proper A/B testing. This prevents bad models from reaching all users.

```yaml
workflowId: ml-ab-testing
name: Model A/B Testing
description: Statistical comparison of model variants in production
version: "1.0.0"
category: machine-learning
tags:
  - ml
  - ab-testing
  - experimentation
  - statistics

metadata:
  requiredAbilities:
    - machine-learning
    - statistical-analysis
    - data-analysis
  estimatedDuration: 300  # 5 minutes (per analysis run)
  complexity: high

steps:
  - stepId: experiment-design
    name: Design A/B Experiment
    type: prompt
    timeout: 180000
    config:
      agent: data-scientist
      task: |
        Design a statistically rigorous A/B test for model comparison.

        ## Hypothesis Definition

        1. **Null Hypothesis (H0)**:
           - State: "There is no difference between model A and model B"

        2. **Alternative Hypothesis (H1)**:
           - State: "Model B performs better than model A"
           - Test type: one-tailed or two-tailed

        ## Sample Size Calculation

        Given:
        - Baseline conversion rate / metric: {{baseline_rate}}
        - Minimum detectable effect (MDE): {{mde}}
        - Significance level (α): 0.05
        - Statistical power (1-β): 0.80

        Calculate:
        - Required sample size per variant
        - Estimated test duration based on traffic

        ## Metric Definition

        1. **Primary Metric**:
           - Metric name
           - Definition
           - Success direction (higher/lower is better)

        2. **Secondary Metrics**:
           - List of supporting metrics

        3. **Guardrail Metrics**:
           - Metrics that must not degrade
           - Degradation threshold

        ## Randomization Strategy
        - Randomization unit (user, session, request)
        - Stratification variables (if any)
        - Holdout percentage

  - stepId: traffic-allocation
    name: Define Traffic Allocation
    type: prompt
    timeout: 60000
    config:
      agent: ml-engineer
      task: |
        Plan the traffic allocation strategy.

        ## Traffic Split

        | Variant | Description | Traffic % |
        |---------|-------------|-----------|
        | Control | Current production model | {{control_pct}}% |
        | Treatment | New model candidate | {{treatment_pct}}% |
        | Holdout | No model (baseline) | {{holdout_pct}}% |

        ## Ramping Strategy

        - **Day 1-2**: 1% treatment (burn-in period)
        - **Day 3-7**: 10% treatment (early signal)
        - **Day 8-14**: 50% treatment (full test)

        ## Safeguards

        1. **Auto-Rollback Triggers**:
           - Error rate > {{error_threshold}}%
           - Latency P99 > {{latency_threshold}}ms
           - Guardrail metric degradation > {{guardrail_threshold}}%

        2. **Manual Review Triggers**:
           - Unusual traffic patterns
           - Unexpected metric movements

  - stepId: store-experiment-config
    name: Store Experiment Configuration
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-ab-experiments
      key: "{{experiment_id}}/config"
      value:
        experiment_id: "{{experiment_id}}"
        experiment_name: "{{experiment_name}}"
        status: "configured"

        hypothesis:
          null_hypothesis: "{{h0}}"
          alternative_hypothesis: "{{h1}}"

        variants:
          control:
            model_name: "{{control_model}}"
            model_version: "{{control_version}}"
            traffic_percent: "{{control_pct}}"
          treatment:
            model_name: "{{treatment_model}}"
            model_version: "{{treatment_version}}"
            traffic_percent: "{{treatment_pct}}"

        metrics:
          primary: "{{primary_metric}}"
          secondary: "{{secondary_metrics}}"
          guardrails: "{{guardrail_metrics}}"

        statistical_params:
          significance_level: 0.05
          power: 0.80
          mde: "{{mde}}"
          required_sample_size: "{{sample_size}}"

        schedule:
          start_date: "{{start_date}}"
          estimated_end_date: "{{end_date}}"
          ramping_schedule: "{{ramp_schedule}}"

        created_at: "{{timestamp}}"
        created_by: "{{user}}"

  - stepId: monitor-experiment
    name: Monitor Running Experiment
    type: prompt
    timeout: 120000
    config:
      agent: data-scientist
      task: |
        Monitor the running A/B experiment for issues.

        ## Health Checks

        1. **Sample Ratio Mismatch (SRM)**:
           - Expected ratio: {{expected_ratio}}
           - Observed ratio: {{observed_ratio}}
           - Chi-squared test for SRM
           - ALERT if p-value < 0.001

        2. **Traffic Distribution**:
           - Verify randomization is working
           - Check for selection bias

        3. **Guardrail Metrics**:
           - Current values vs baseline
           - Flag any degradation

        4. **Data Quality**:
           - Missing data rate
           - Logging issues

        ## Early Stopping Check

        - **Sequential testing**: Can we stop early?
        - Current confidence level
        - Projected final sample size

        ## Issues Found
        - List any anomalies
        - Recommended actions

  - stepId: analyze-results
    name: Analyze Experiment Results
    type: prompt
    timeout: 180000
    config:
      agent: data-scientist
      task: |
        Perform statistical analysis of A/B test results.

        ## Primary Metric Analysis

        1. **Descriptive Statistics**:
           | Variant | N | Mean | Std | Median |
           |---------|---|------|-----|--------|
           | Control | | | | |
           | Treatment | | | | |

        2. **Effect Size**:
           - Absolute difference: {{treatment_mean}} - {{control_mean}}
           - Relative lift: (T - C) / C * 100%
           - 95% Confidence Interval: [{{ci_lower}}, {{ci_upper}}]

        3. **Statistical Significance**:
           - Test used: t-test / Mann-Whitney / Chi-squared
           - Test statistic: {{test_stat}}
           - P-value: {{p_value}}
           - Significant at α=0.05: Yes/No

        4. **Practical Significance**:
           - Is the effect size meaningful?
           - Does it meet MDE threshold?

        ## Secondary Metrics

        | Metric | Control | Treatment | Lift | P-value | Significant |
        |--------|---------|-----------|------|---------|-------------|

        ## Guardrail Metrics

        | Metric | Control | Treatment | Change | Status |
        |--------|---------|-----------|--------|--------|

        ## Segment Analysis

        Analyze effect by key segments:
        - New vs returning users
        - Mobile vs desktop
        - Geographic regions
        - User cohorts

        ## Novelty/Primacy Effects

        - Plot metric over time
        - Check for effect decay
        - Estimate steady-state effect

  - stepId: make-decision
    name: Make Experiment Decision
    type: prompt
    timeout: 120000
    config:
      agent: ml-engineer
      task: |
        Based on analysis, make a decision about the experiment.

        ## Decision Framework

        | Significance | Practical Impact | Guardrails | Decision |
        |--------------|------------------|------------|----------|
        | Yes | Positive | Pass | SHIP |
        | Yes | Negative | - | ROLLBACK |
        | No | - | Pass | EXTEND or NO_SHIP |
        | - | - | Fail | ROLLBACK |

        ## Decision

        **Recommendation**: {{decision}}

        **Confidence**: HIGH / MEDIUM / LOW

        **Reasoning**:
        - Statistical evidence: {{stat_reasoning}}
        - Business impact: {{business_reasoning}}
        - Risk assessment: {{risk_reasoning}}

        ## If SHIP
        - Rollout plan (gradual vs immediate)
        - Monitoring requirements
        - Success criteria for full rollout

        ## If ROLLBACK
        - Root cause hypothesis
        - Recommended investigation
        - Next experiment suggestions

        ## If EXTEND
        - Additional sample size needed
        - New end date
        - Any design changes

  - stepId: store-results
    name: Store Experiment Results
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-ab-experiments
      key: "{{experiment_id}}/results"
      ttl: 31536000  # 1 year retention
      value:
        experiment_id: "{{experiment_id}}"
        status: "completed"

        results:
          primary_metric:
            control_mean: "{{control_mean}}"
            treatment_mean: "{{treatment_mean}}"
            relative_lift: "{{lift}}"
            confidence_interval: "{{ci}}"
            p_value: "{{p_value}}"
            significant: "{{significant}}"

          secondary_metrics: "{{secondary_results}}"
          guardrail_metrics: "{{guardrail_results}}"
          segment_analysis: "{{segment_results}}"

        decision:
          recommendation: "{{decision}}"
          confidence: "{{confidence}}"
          reasoning: "{{reasoning}}"

        completed_at: "{{timestamp}}"
        decided_by: "{{user}}"
```

---

## New Agent: MLOps Engineer

**File:** `examples/agents/mlops-engineer.json`

**Purpose:** Focus on ML platform automation, infrastructure, and reliability.

**Rationale:** Data Scientist and ML Engineer focus on models. MLOps Engineer focuses on the platform and automation.

```json
{
  "agentId": "mlops-engineer",
  "displayName": "Devin",
  "role": "MLOps Engineer",
  "team": "platform",
  "enabled": true,
  "priority": 75,

  "description": "MLOps Engineer specializing in ML infrastructure, CI/CD for models, feature stores, experiment tracking systems, model serving, and production reliability.",

  "expertise": [
    "ML Infrastructure",
    "CI/CD for ML",
    "Model Serving",
    "Feature Stores",
    "Experiment Tracking",
    "Model Monitoring",
    "Kubernetes/Docker",
    "Cloud ML Services",
    "Cost Optimization",
    "Data Pipelines"
  ],

  "capabilities": [
    "pipeline-automation",
    "infrastructure-as-code",
    "model-deployment",
    "monitoring-setup",
    "cost-analysis",
    "feature-store-management",
    "experiment-infrastructure",
    "model-versioning",
    "serving-optimization"
  ],

  "coreAbilities": [
    "mlops",
    "infrastructure",
    "deployment"
  ],

  "taskAbilities": {
    "deploy": ["model-deployment", "kubernetes", "docker"],
    "monitor": ["monitoring-setup", "alerting", "observability"],
    "pipeline": ["pipeline-automation", "ci-cd", "data-pipelines"],
    "optimize": ["cost-analysis", "performance-optimization"]
  },

  "systemPrompt": "You are Devin, a Senior MLOps Engineer focused on building reliable, scalable ML infrastructure.\n\n## Philosophy\n\n\"Automate everything. Monitor everything. Trust nothing.\"\n\n## Core Principles\n\n1. **Reproducibility**: Every model training and deployment must be reproducible\n2. **Automation**: Manual processes are bugs waiting to happen\n3. **Observability**: If you can't measure it, you can't improve it\n4. **Cost Awareness**: ML is expensive; optimize ruthlessly\n5. **Reliability**: Production ML must be as reliable as production software\n\n## Expertise Areas\n\n### Model Serving\n- REST/gRPC API design\n- Batch vs real-time inference\n- Model optimization (quantization, distillation)\n- A/B testing infrastructure\n- Canary deployments\n\n### ML Pipelines\n- Training pipeline orchestration\n- Feature pipeline management\n- Data validation pipelines\n- Model validation gates\n\n### Infrastructure\n- Kubernetes for ML workloads\n- GPU cluster management\n- Auto-scaling strategies\n- Cost optimization\n\n### Monitoring\n- Model performance monitoring\n- Data drift detection\n- Alerting and on-call\n- Incident response\n\n## When Engaged\n\nYou are called when:\n- Deploying models to production\n- Setting up ML pipelines\n- Configuring monitoring and alerting\n- Optimizing infrastructure costs\n- Debugging production ML issues\n- Setting up experiment tracking\n- Managing feature stores\n\n## Output Style\n\n- Provide infrastructure-as-code (Terraform, Kubernetes YAML)\n- Include monitoring and alerting configs\n- Document operational runbooks\n- Specify cost estimates\n- Define SLOs and SLIs",

  "selectionMetadata": {
    "primaryIntents": ["deploy", "mlops", "infrastructure", "pipeline", "serving"],
    "secondarySignals": ["kubernetes", "docker", "terraform", "monitoring", "ci-cd"],
    "keywords": [
      "mlops", "deploy", "deployment", "serving", "infrastructure",
      "pipeline", "ci-cd", "kubernetes", "k8s", "docker",
      "monitoring", "alerting", "feature-store", "model-registry",
      "cost", "scaling", "production", "reliability"
    ],
    "antiKeywords": ["research", "algorithm", "theory", "paper"]
  },

  "constraints": {
    "temperature": 0.3,
    "maxTokens": 12000
  },

  "orchestration": {
    "canDelegate": true,
    "maxDelegationDepth": 1,
    "preferredDelegates": ["ml-engineer", "data-scientist"],
    "workspace": {
      "canRead": ["infrastructure", "platform", "ml"],
      "canWriteShared": true
    }
  },

  "tags": ["mlops", "infrastructure", "platform", "deployment", "monitoring"]
}
```

---

## Implementation Checklist

### Phase 1: Critical Workflows (Week 1-2)

- [ ] Create `examples/workflows/ml-experiment-tracker.yaml`
- [ ] Create `examples/workflows/ml-model-evaluation.yaml`
- [ ] Create `examples/workflows/ml-model-registry.yaml`
- [ ] Test workflows with data-scientist and ml-engineer agents
- [ ] Add workflow documentation

### Phase 2: Monitoring & Features (Week 3-4)

- [ ] Create `examples/workflows/ml-model-monitoring.yaml`
- [ ] Create `examples/workflows/ml-feature-engineering.yaml`
- [ ] Create `examples/workflows/ml-ab-testing.yaml`
- [ ] Create `examples/agents/mlops-engineer.json`
- [ ] Update agent registry with new agent

### Phase 3: Integration & Testing (Week 5-6)

- [ ] Integration tests for all new workflows
- [ ] End-to-end test: experiment → evaluation → registry → monitoring
- [ ] Performance benchmarks
- [ ] Documentation updates

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| ML Lifecycle Coverage | 50% | 90% |
| Workflow Count (ML) | 1 | 7 |
| ML Agent Count | 2 | 3 |
| Experiment Tracking | None | Full |
| Model Registry | None | Full |
| Production Monitoring | None | Full |

---

## Appendix: Memory Namespace Schema

### Namespaces Used

| Namespace | Purpose | TTL |
|-----------|---------|-----|
| `ml-experiments` | Experiment parameters and metrics | 90 days |
| `ml-experiment-reports` | Comparison reports | 90 days |
| `ml-evaluations` | Model evaluation results | 180 days |
| `ml-model-registry` | Model versions and metadata | Permanent |
| `ml-model-events` | Promotion/deprecation events | 1 year |
| `ml-alerts` | Monitoring alerts | 30 days |
| `ml-monitoring-reports` | Drift and degradation reports | 30 days |
| `ml-feature-store` | Feature definitions | Permanent |
| `ml-ab-experiments` | A/B test configs and results | 1 year |
| `ml-production-predictions` | Production inference logs | 7 days |
