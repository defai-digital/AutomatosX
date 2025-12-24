# PRD v15: Comprehensive Workflow Coverage Enhancement

**Version:** 15.0.0
**Created:** 2025-12-18
**Status:** Approved for Implementation
**Author:** AI Analysis

---

## 1. Executive Summary

This PRD defines the contract-first implementation of workflow coverage enhancements for AutomatosX. Following the established architecture principles:

1. **Contract-First**: Define Zod schemas before implementation
2. **Invariants**: Document behavioral guarantees
3. **Domain Logic**: Implement in core domain packages
4. **Guard Policies**: Enforce governance gates

### Current State

| Metric | Value |
|--------|-------|
| Total Agents | 25 |
| Total Workflows | 15 |
| Agent Coverage | 60% |
| ML Pipeline | 50% |

### Target State

| Metric | Value |
|--------|-------|
| Total Workflows | 27 (+12) |
| Agent Coverage | 96% |
| ML Pipeline | 100% |
| Business Pipeline | 100% |

---

## 2. Architecture Principles

### 2.1 Contract-First Design

All new workflows MUST be defined in contracts before implementation:

```
packages/contracts/src/workflow-templates/v1/
├── schema.ts          # Zod schemas for workflow templates
├── invariants.md      # Behavioral guarantees
├── index.ts           # Public exports
└── README.md          # Documentation
```

### 2.2 Invariant Requirements

Every new workflow category MUST define:

1. **Execution Order Invariants** - Step execution guarantees
2. **Data Flow Invariants** - Input/output validation
3. **State Management Invariants** - Memory and checkpoint behavior
4. **Error Handling Invariants** - Failure modes and recovery

### 2.3 Guard Policy Integration

New workflow categories MUST integrate with the guard system:

- ML workflows → `ml-governance` policy
- Business workflows → `business-governance` policy
- Infrastructure workflows → `infrastructure-governance` policy

---

## 3. Contract Specifications

### 3.1 Workflow Template Contract

```typescript
// packages/contracts/src/workflow-templates/v1/schema.ts

import { z } from 'zod';

/**
 * Workflow template categories
 */
export const WorkflowCategorySchema = z.enum([
  'ml-lifecycle',        // Machine learning workflows
  'product-development', // Product management workflows
  'engineering',         // Software engineering workflows
  'infrastructure',      // DevOps/infrastructure workflows
  'leadership',          // Strategic planning workflows
  'quality',             // QA and testing workflows
  'security',            // Security audit workflows
  'research',            // Technology research workflows
]);

/**
 * Workflow step configuration for templates
 */
export const TemplateStepConfigSchema = z.object({
  agent: z.string().min(1).max(50),
  task: z.string().min(1).max(5000),
  tools: z.array(z.string()).max(10).optional(),
  outputs: z.array(z.string()).max(20).optional(),
});

/**
 * Workflow template step
 */
export const WorkflowTemplateStepSchema = z.object({
  stepId: z.string().regex(/^[a-z][a-z0-9-]*$/).max(64),
  name: z.string().max(128),
  type: z.enum(['prompt', 'tool', 'conditional', 'parallel']),
  timeout: z.number().int().min(1000).max(3600000).default(120000),
  config: TemplateStepConfigSchema,
  retryPolicy: z.object({
    maxAttempts: z.number().int().min(1).max(5).default(2),
    backoffMs: z.number().int().min(1000).max(30000).default(2000),
  }).optional(),
});

/**
 * Complete workflow template definition
 */
export const WorkflowTemplateSchema = z.object({
  workflowId: z.string().regex(/^[a-z][a-z0-9-]*$/).max(64),
  name: z.string().max(128),
  description: z.string().max(512),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: WorkflowCategorySchema,
  tags: z.array(z.string().max(50)).max(20),

  metadata: z.object({
    requiredAbilities: z.array(z.string()).max(20),
    requiredAgents: z.array(z.string()).max(10),
    estimatedDuration: z.number().int().min(60).max(86400), // seconds
    complexity: z.enum(['low', 'medium', 'high']),
    schedule: z.string().max(100).optional(), // cron expression
  }),

  steps: z.array(WorkflowTemplateStepSchema).min(1).max(50),

  storage: z.object({
    namespace: z.string().max(100),
    ttl: z.number().int().min(3600).max(31536000).optional(), // seconds
  }).optional(),
});

export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;
export type WorkflowCategory = z.infer<typeof WorkflowCategorySchema>;
```

### 3.2 ML Lifecycle Contract Extension

```typescript
// packages/contracts/src/ml-lifecycle/v1/schema.ts

import { z } from 'zod';

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
 * Drift severity levels
 */
export const DriftSeveritySchema = z.enum([
  'none',
  'moderate',
  'significant',
  'critical',
]);

/**
 * ML experiment definition
 */
export const MLExperimentSchema = z.object({
  experimentId: z.string().uuid(),
  experimentName: z.string().max(200),
  hypothesis: z.string().max(1000),
  modelType: z.string().max(100),
  hyperparameters: z.record(z.string(), z.unknown()),
  datasetVersion: z.string().max(100),
  baselineModel: z.string().max(100).optional(),
  successCriteria: z.string().max(500),
  status: ExperimentStatusSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string().max(100),
});

/**
 * ML model registration
 */
export const MLModelSchema = z.object({
  modelName: z.string().max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500).optional(),

  lineage: z.object({
    experimentId: z.string().uuid(),
    trainingDataset: z.string().max(200),
    parentModel: z.string().max(100).optional(),
  }),

  artifact: z.object({
    path: z.string().max(500),
    checksum: z.string().max(128),
    sizeBytes: z.number().int().min(0),
  }),

  schemas: z.object({
    inputSchema: z.record(z.string(), z.unknown()),
    outputSchema: z.record(z.string(), z.unknown()),
    featureNames: z.array(z.string()).max(1000),
  }),

  metrics: z.record(z.string(), z.number()),

  dependencies: z.object({
    framework: z.string().max(50),
    frameworkVersion: z.string().max(50),
    packages: z.array(z.string()).max(100),
  }),

  status: ModelStatusSchema,
  createdAt: z.string().datetime(),
  createdBy: z.string().max(100),
});

/**
 * Model monitoring alert
 */
export const MonitoringAlertSchema = z.object({
  alertId: z.string().uuid(),
  modelName: z.string().max(100),
  modelVersion: z.string().max(50),
  severity: z.enum(['info', 'warning', 'critical']),
  alertType: z.enum(['data_drift', 'prediction_drift', 'performance_degradation', 'error_rate']),

  driftSummary: z.object({
    dataDriftLevel: DriftSeveritySchema,
    predictionDriftLevel: DriftSeveritySchema,
    topDriftedFeatures: z.array(z.string()).max(10),
  }).optional(),

  performanceSummary: z.object({
    degradationDetected: z.boolean(),
    metricsAffected: z.array(z.string()).max(20),
  }).optional(),

  recommendation: z.enum(['no_action', 'monitor', 'investigate', 'retrain', 'retrain_urgent']),
  createdAt: z.string().datetime(),
  acknowledged: z.boolean(),
});

export type MLExperiment = z.infer<typeof MLExperimentSchema>;
export type MLModel = z.infer<typeof MLModelSchema>;
export type MonitoringAlert = z.infer<typeof MonitoringAlertSchema>;
```

---

## 4. Invariant Specifications

### 4.1 ML Lifecycle Invariants

```markdown
# ML Lifecycle Contract V1 - Behavioral Invariants

## Experiment Tracking Invariants

### INV-ML-EXP-001: Experiment Immutability
**Statement:** Experiment parameters MUST NOT change after experiment starts.
**Enforcement:** Parameters frozen on creation, validation rejects modifications.

### INV-ML-EXP-002: Experiment Uniqueness
**Statement:** Experiment IDs MUST be unique within namespace.
**Enforcement:** UUID generation, registry checks before registration.

### INV-ML-EXP-003: Metric Logging Order
**Statement:** Metrics MUST be logged in chronological order.
**Enforcement:** Timestamp validation, append-only metric storage.

## Model Registry Invariants

### INV-ML-REG-001: Version Monotonicity
**Statement:** Model versions MUST increase monotonically (SemVer).
**Enforcement:** Version comparison before registration.

### INV-ML-REG-002: Single Production Model
**Statement:** Only ONE model version can be in 'production' status per model name.
**Enforcement:** Status update atomically archives previous production.

### INV-ML-REG-003: Artifact Integrity
**Statement:** Model artifact checksum MUST match registered value.
**Enforcement:** Checksum validation on retrieve.

## Monitoring Invariants

### INV-ML-MON-001: Alert Ordering
**Statement:** Alerts MUST be ordered by timestamp descending.
**Enforcement:** Index on timestamp, sort on query.

### INV-ML-MON-002: Drift Threshold Consistency
**Statement:** Drift calculations MUST use consistent thresholds.
**Enforcement:** Thresholds from config, not hardcoded.

### INV-ML-MON-003: Retraining Trigger Determinism
**Statement:** Same drift metrics MUST produce same retraining recommendation.
**Enforcement:** Deterministic decision matrix, no random components.
```

### 4.2 Workflow Template Invariants

```markdown
# Workflow Template Contract V1 - Behavioral Invariants

## Template Validation Invariants

### INV-WT-001: Agent Existence
**Statement:** All agents referenced in workflow steps MUST exist in registry.
**Enforcement:** Pre-execution validation, fail-fast on missing agent.

### INV-WT-002: Tool Availability
**Statement:** All tools referenced in workflow steps MUST be available.
**Enforcement:** Tool registry check before execution.

### INV-WT-003: Step ID Uniqueness
**Statement:** Step IDs MUST be unique within workflow.
**Enforcement:** Validation rejects duplicate stepIds.

## Execution Invariants

### INV-WT-004: Category-Specific Policies
**Statement:** Workflows MUST apply category-specific guard policies.
**Enforcement:** Guard check invoked with category-mapped policy.

### INV-WT-005: Output Namespace Isolation
**Statement:** Workflow outputs MUST use declared namespace only.
**Enforcement:** Memory store validates namespace matches config.

### INV-WT-006: Timeout Enforcement
**Statement:** Steps MUST terminate within configured timeout.
**Enforcement:** Timeout wrapper on all step executions.
```

---

## 5. Guard Policy Specifications

### 5.1 ML Governance Policy

```typescript
// packages/guard/src/policies/ml-governance.ts

export const mlGovernancePolicy: GuardPolicy = {
  policyId: 'ml-governance',
  name: 'ML Lifecycle Governance',
  description: 'Governance gates for ML workflows',

  gates: [
    {
      gateId: 'model-evaluation-required',
      name: 'Model Evaluation Gate',
      type: 'contract_test',
      config: {
        requiredTests: ['evaluation-metrics', 'fairness-audit'],
        minCoverage: 0.8,
      },
    },
    {
      gateId: 'experiment-tracking',
      name: 'Experiment Tracking Gate',
      type: 'path',
      config: {
        requiredPaths: ['ml-experiments/*'],
        message: 'Experiment must be tracked before model registration',
      },
    },
    {
      gateId: 'model-registry-lineage',
      name: 'Model Lineage Gate',
      type: 'dependency',
      config: {
        requiredFields: ['experimentId', 'trainingDataset'],
        message: 'Model must have complete lineage information',
      },
    },
  ],

  applicableWorkflows: [
    'ml-experiment-tracker',
    'ml-model-evaluation',
    'ml-model-registry',
    'ml-model-monitoring',
    'mlops-deployment',
  ],
};
```

### 5.2 Business Governance Policy

```typescript
// packages/guard/src/policies/business-governance.ts

export const businessGovernancePolicy: GuardPolicy = {
  policyId: 'business-governance',
  name: 'Business Workflow Governance',
  description: 'Governance gates for business workflows',

  gates: [
    {
      gateId: 'product-discovery-validation',
      name: 'Product Discovery Gate',
      type: 'contract_test',
      config: {
        requiredArtifacts: ['problem-statement', 'user-research', 'requirements'],
        message: 'Product discovery must be complete before engineering',
      },
    },
    {
      gateId: 'technical-feasibility',
      name: 'Technical Feasibility Gate',
      type: 'path',
      config: {
        requiredPaths: ['product-discovery/*/feasibility'],
        message: 'Technical feasibility assessment required',
      },
    },
  ],

  applicableWorkflows: [
    'product-discovery',
    'strategic-planning',
    'technology-research',
  ],
};
```

---

## 6. Implementation Plan

### Phase 1: Contracts & Invariants (Days 1-2)

1. Create `packages/contracts/src/workflow-templates/v1/`
   - `schema.ts` - Workflow template schemas
   - `invariants.md` - Behavioral guarantees
   - `index.ts` - Exports

2. Create `packages/contracts/src/ml-lifecycle/v1/`
   - `schema.ts` - ML lifecycle schemas
   - `invariants.md` - ML invariants
   - `index.ts` - Exports

3. Update `packages/contracts/src/index.ts` with new exports

### Phase 2: Guard Policies (Days 3-4)

1. Create `packages/guard/src/policies/ml-governance.ts`
2. Create `packages/guard/src/policies/business-governance.ts`
3. Update policy registry in `packages/guard/src/executor.ts`
4. Add contract tests for new policies

### Phase 3: Domain Logic (Days 5-7)

1. Create `packages/core/ml-lifecycle-domain/`
   - Experiment tracking service
   - Model registry service
   - Monitoring service

2. Update `packages/core/workflow-engine/`
   - Template validation
   - Category-specific execution

### Phase 4: Workflow Implementations (Days 8-10)

1. ML Workflows (6 files)
2. Business Workflows (6 files)
3. Update workflow registry

### Phase 5: Testing & Validation (Days 11-12)

1. Contract tests for all new schemas
2. Invariant tests
3. Integration tests
4. Guard policy tests

---

## 7. File Structure

```
packages/
├── contracts/
│   └── src/
│       ├── workflow-templates/
│       │   └── v1/
│       │       ├── schema.ts
│       │       ├── invariants.md
│       │       ├── index.ts
│       │       └── README.md
│       ├── ml-lifecycle/
│       │   └── v1/
│       │       ├── schema.ts
│       │       ├── invariants.md
│       │       ├── index.ts
│       │       └── README.md
│       └── index.ts (updated)
├── guard/
│   └── src/
│       └── policies/
│           ├── ml-governance.ts
│           ├── business-governance.ts
│           └── index.ts
├── core/
│   └── ml-lifecycle-domain/
│       └── src/
│           ├── experiment-service.ts
│           ├── registry-service.ts
│           ├── monitoring-service.ts
│           └── index.ts
└── examples/
    └── workflows/
        ├── ml-experiment-tracker.yaml
        ├── ml-model-evaluation.yaml
        ├── ml-model-registry.yaml
        ├── ml-model-monitoring.yaml
        ├── ml-feature-engineering.yaml
        ├── ml-ab-testing.yaml
        ├── mlops-deployment.yaml
        ├── product-discovery.yaml
        ├── mobile-development.yaml
        ├── infrastructure-automation.yaml
        ├── strategic-planning.yaml
        └── technology-research.yaml
```

---

## 8. Success Metrics

| Metric | Current | Target | Validation |
|--------|---------|--------|------------|
| Agent Coverage | 60% | 96% | Agent-workflow mapping |
| ML Lifecycle | 50% | 100% | Phase coverage |
| Contract Coverage | N/A | 100% | Schema validation |
| Invariant Tests | N/A | 100% | Test coverage |
| Guard Integration | N/A | 100% | Policy application |

---

## 9. Dependencies

- Zod 3.x for schema validation
- Vitest for testing
- Existing workflow engine
- Existing guard system
- Existing memory domain

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema breaking changes | High | Version contracts (v1, v2) |
| Performance impact | Medium | Lazy validation, caching |
| Agent not found | Medium | Fallback to 'standard' agent |
| Circular dependencies | High | Dependency cruiser enforcement |
