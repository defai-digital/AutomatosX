# MLOps Guide

This guide covers AutomatosX's machine learning operations (MLOps) capabilities, including model lifecycle management, experiment tracking, deployment automation, and production monitoring.

## Overview

AutomatosX provides a comprehensive suite of ML/MLOps workflows and specialized agents for managing the entire machine learning lifecycle:

| Phase | Workflow | Description |
|-------|----------|-------------|
| Experimentation | `ml-experiment-tracker` | Track experiments, metrics, and artifacts |
| Feature Engineering | `ml-feature-engineering` | Automated feature generation and selection |
| Evaluation | `ml-model-evaluation` | Comprehensive model validation |
| Registry | `ml-model-registry` | Model versioning and cataloging |
| Deployment | `mlops-deployment` | Production deployment pipeline |
| Monitoring | `ml-model-monitoring` | Drift detection and health monitoring |
| Testing | `ml-ab-testing` | A/B testing framework |

---

## ML Agents

AutomatosX includes specialized agents for ML/MLOps tasks:

### data-scientist

Statistical analysis and model development.

```bash
ax agent run data-scientist --input '{"query": "Build a churn prediction model using the customer dataset"}'
```

**Best for:** Exploratory analysis, feature engineering, model development

### ml-engineer

Production ML systems and optimization.

```bash
ax agent run ml-engineer --input '{"query": "Optimize model inference latency to under 50ms"}'
```

**Best for:** Model optimization, training pipelines, serving architecture

### mlops-engineer

ML infrastructure and operations.

```bash
ax agent run mlops-engineer --input '{"query": "Set up model monitoring with drift detection"}'
```

**Philosophy:** *"Automate everything. Monitor everything. Trust nothing."*

**Best for:** Deployment, monitoring, infrastructure, cost optimization

---

## Experiment Tracking

### Track New Experiments

```bash
ax run ml-experiment-tracker --input '{
  "experiment_name": "churn_prediction_v2",
  "description": "Testing new feature set with XGBoost",
  "tags": ["churn", "xgboost", "production-candidate"]
}'
```

### What Gets Tracked

- **Parameters:** Hyperparameters, model configuration
- **Metrics:** Training loss, validation accuracy, custom metrics
- **Artifacts:** Model files, plots, datasets
- **Environment:** Dependencies, versions, hardware

### Compare Experiments

```bash
ax call claude "Compare experiments churn_v1 and churn_v2. Which performs better on precision and recall?"
```

---

## Feature Engineering

### Automated Feature Generation

```bash
ax run ml-feature-engineering --input '{
  "dataset": "customer_transactions",
  "target": "is_churned",
  "feature_types": ["temporal", "aggregation", "interaction"]
}'
```

### Pipeline Steps

1. **Data Profiling** - Analyze data distributions and quality
2. **Feature Generation** - Create candidate features
3. **Feature Selection** - Select based on importance
4. **Validation** - Ensure feature quality
5. **Feature Store Update** - Register selected features

### Feature Store Integration

```bash
# Store features for reuse
ax memory store --key "features/churn_v2" --value '{
  "features": ["recency", "frequency", "monetary", "tenure"],
  "version": "2.0.0",
  "created": "2025-01-15"
}' --namespace ml-features
```

---

## Model Evaluation

### Comprehensive Evaluation

```bash
ax run ml-model-evaluation --input '{
  "model_id": "churn-classifier-v2",
  "evaluation_dataset": "holdout_2024q4",
  "metrics": ["accuracy", "precision", "recall", "f1", "auc_roc"],
  "include_fairness": true
}'
```

### Evaluation Components

1. **Performance Metrics** - Standard ML metrics
2. **Fairness Analysis** - Bias detection across groups
3. **Error Analysis** - Failure pattern identification
4. **Threshold Analysis** - Optimal threshold selection
5. **Comparison** - vs. baseline and previous versions

### Fairness Checks

The evaluation workflow includes fairness analysis:
- Demographic parity
- Equalized odds
- Calibration across groups

---

## Model Registry

### Register a New Model

```bash
ax run ml-model-registry --input '{
  "model_path": "./models/churn_classifier_v2",
  "model_name": "churn-classifier",
  "version": "2.1.0",
  "metrics": {
    "accuracy": 0.94,
    "f1": 0.87,
    "auc_roc": 0.96
  },
  "training_data": "customer_data_2024",
  "framework": "xgboost"
}'
```

### Model Metadata

Each registered model includes:
- Model artifacts (serialized model)
- Training configuration
- Evaluation metrics
- Input/output schemas
- Dependencies
- Lineage (data, features, experiments)

### Query Registry

```bash
# Retrieve model info
ax memory retrieve --key "churn-classifier/versions/2.1.0" --namespace ml-model-registry

# List all versions
ax memory search --query "churn-classifier" --namespace ml-model-registry
```

---

## Deployment Pipeline

### Deploy to Production

```bash
ax run mlops-deployment --input '{
  "model_name": "churn-classifier",
  "version": "2.1.0",
  "deployment_target": "kubernetes",
  "rollout_strategy": "canary",
  "traffic_percentage": 10
}'
```

### Deployment Stages

1. **Fetch Model** - Retrieve from registry
2. **Validate Readiness** - Pre-deployment checklist
3. **Build Container** - Create serving container
4. **Deploy to Staging** - Staging environment deployment
5. **Shadow Evaluation** - Compare with production
6. **Traffic Migration** - Gradual rollout
7. **Post-Deployment Validation** - Verify health

### Rollout Strategies

| Strategy | Description |
|----------|-------------|
| `canary` | Gradual traffic increase |
| `blue-green` | Full switchover with rollback |
| `shadow` | Mirror traffic, compare results |
| `direct` | Immediate full deployment |

### Rollback

```bash
ax run mlops-deployment --input '{
  "model_name": "churn-classifier",
  "action": "rollback",
  "target_version": "2.0.0"
}'
```

---

## Production Monitoring

### Set Up Monitoring

```bash
ax run ml-model-monitoring --input '{
  "model_id": "churn-classifier-prod",
  "monitoring_config": {
    "data_drift_threshold": 0.1,
    "prediction_drift_threshold": 0.05,
    "latency_p99_threshold_ms": 100,
    "error_rate_threshold": 0.01
  }
}'
```

### Monitoring Components

1. **Data Drift** - Feature distribution changes
2. **Prediction Drift** - Output distribution changes
3. **Performance Metrics** - Accuracy over time
4. **Latency Monitoring** - Response time tracking
5. **Error Tracking** - Failure rate and patterns

### Alert Configuration

The monitoring workflow sets up alerts for:
- Significant data drift detected
- Model performance degradation
- Latency SLA violations
- Error rate spikes
- Feature pipeline failures

### Health Dashboard

```bash
# Check model health
ax status

# Detailed monitoring report
ax agent run mlops-engineer --input '{"query": "Generate health report for churn-classifier-prod"}'
```

---

## A/B Testing

### Set Up A/B Test

```bash
ax run ml-ab-testing --input '{
  "experiment_name": "churn_model_comparison",
  "control": {
    "model_id": "churn-classifier-v1",
    "traffic_percent": 50
  },
  "treatment": {
    "model_id": "churn-classifier-v2",
    "traffic_percent": 50
  },
  "primary_metric": "conversion_rate",
  "duration_days": 14,
  "min_sample_size": 10000
}'
```

### Test Phases

1. **Setup** - Configure experiment
2. **Traffic Splitting** - Route users to variants
3. **Metric Collection** - Gather results
4. **Statistical Analysis** - Significance testing
5. **Decision Report** - Winner determination

### Analyze Results

```bash
ax call claude "Analyze the A/B test results for churn_model_comparison. Is there a statistically significant winner?"
```

---

## MLOps Best Practices

### 1. Version Everything

```bash
# Model versions in registry
ax run ml-model-registry --input '{"version": "2.1.0", ...}'

# Feature versions in store
ax memory store --key "features/churn/v2" --namespace ml-features

# Experiment tracking
ax run ml-experiment-tracker --input '{"experiment_name": "exp_20250115_001"}'
```

### 2. Automate Pipelines

Use workflows for repeatability:

```bash
# Training pipeline
ax run developer --input '{"feature": "Automate model retraining on new data"}'

# Evaluation pipeline
ax run ml-model-evaluation --input '{...}'

# Deployment pipeline
ax run mlops-deployment --input '{...}'
```

### 3. Monitor Business Metrics

```bash
ax agent run mlops-engineer --input '{
  "query": "Set up monitoring for business metrics: customer retention, revenue impact"
}'
```

### 4. Implement Guardrails

```bash
# Create guard policy for ML changes
ax scaffold guard ml-production --domain ml --radius 2 --gates path_violation,contract_tests
```

### 5. Document Runbooks

```bash
ax agent run writer --input '{
  "query": "Create runbook for model rollback procedure"
}'
```

---

## Quick Reference

### Experiment Phase

```bash
ax run ml-experiment-tracker --input '{"experiment_name": "..."}'
ax run ml-feature-engineering --input '{"dataset": "...", "target": "..."}'
```

### Validation Phase

```bash
ax run ml-model-evaluation --input '{"model_id": "..."}'
ax run ml-model-registry --input '{"model_path": "..."}'
```

### Production Phase

```bash
ax run mlops-deployment --input '{"model_name": "...", "version": "..."}'
ax run ml-model-monitoring --input '{"model_id": "..."}'
ax run ml-ab-testing --input '{"control": {...}, "treatment": {...}}'
```

### Agent Commands

```bash
ax agent run data-scientist --input '{"query": "..."}'
ax agent run ml-engineer --input '{"query": "..."}'
ax agent run mlops-engineer --input '{"query": "..."}'
```

---

## Next Steps

- **[Workflows Reference](../reference/workflows.md)** - Complete workflow catalog
- **[Agents Reference](../reference/agents.md)** - All available agents
- **[Building Software Guide](./building-software.md)** - General development guide
