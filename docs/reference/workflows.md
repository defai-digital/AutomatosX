# Workflows Reference

Complete catalog of available AutomatosX workflows.

## Overview

Workflows orchestrate multi-step processes using AI agents and tools. Each workflow defines a sequence of steps that work together to accomplish a complex task.

```bash
# List all workflows
ax list

# Run a workflow
ax run <workflow-id>

# Run with input
ax run <workflow-id> --input '{"key": "value"}'
```

---

## Workflow Categories

| Category | Workflows | Description |
|----------|-----------|-------------|
| [Development](#development-workflows) | 7 | Software development and coding |
| [ML/MLOps](#mlmlops-workflows) | 7 | Machine learning lifecycle |
| [Enterprise](#enterprise-workflows) | 4 | Strategic and business workflows |
| [Analysis](#analysis-workflows) | 3 | Code analysis and review |
| [Infrastructure](#infrastructure-workflows) | 3 | DevOps and infrastructure |

---

## Development Workflows

### developer

**Feature Development Workflow**

End-to-end feature development from requirements to implementation.

```bash
ax run developer --input '{"feature": "Add user authentication"}'
```

**Steps:**
1. Understand Requirements (product agent)
2. Design Solution (architecture agent)
3. Create Implementation Plan
4. Implement Backend (backend agent)
5. Implement Frontend (frontend agent)
6. Run Integration Tests
7. Update Documentation (writer agent)

---

### code-reviewer

**Code Review Workflow**

Comprehensive multi-perspective code review.

```bash
ax run code-reviewer --input '{"paths": ["src/"]}'
```

**Steps:**
1. Static Analysis
2. Security Review
3. Architecture Review
4. Performance Review
5. Generate Summary

---

### debugger

**Debugging Workflow**

Systematic bug investigation and resolution.

```bash
ax run debugger --input '{"issue": "API returns 500 on user creation"}'
```

**Steps:**
1. Understand the Issue
2. Gather Context
3. Form Hypothesis
4. Investigate
5. Propose Fix
6. Verify Solution

---

### refactoring

**Refactoring Workflow**

Safe, incremental code improvement.

```bash
ax run refactoring --input '{"target": "src/services/"}'
```

**Steps:**
1. Analyze Current State
2. Identify Improvements
3. Plan Refactoring
4. Execute Changes
5. Verify Behavior
6. Update Tests

---

### designer

**UI/UX Design Workflow**

Design-driven development process.

```bash
ax run designer --input '{"feature": "Dashboard redesign"}'
```

**Steps:**
1. User Research
2. Design Exploration
3. Component Design
4. Implementation Handoff

---

### qa-specialist

**Quality Assurance Workflow**

Comprehensive testing and quality validation.

```bash
ax run qa-specialist --input '{"scope": "src/"}'
```

**Steps:**
1. Test Planning
2. Unit Test Generation
3. Integration Test Design
4. Edge Case Analysis
5. Coverage Report

---

### assistant

**General Purpose Assistant Workflow**

Flexible workflow for general development tasks.

```bash
ax run assistant --input '{"task": "Help me understand this codebase"}'
```

---

## ML/MLOps Workflows

### mlops-deployment

**MLOps Deployment Pipeline**

Automate model deployment from registry to production with validation gates.

```bash
ax run mlops-deployment --input '{"model_name": "recommender", "version": "v2.1.0"}'
```

**Steps:**
1. Fetch Model from Registry
2. Validate Deployment Readiness
3. Build Container Image
4. Deploy to Staging
5. Run Shadow Evaluation
6. Traffic Migration
7. Post-Deployment Validation

---

### ml-model-registry

**Model Registry Workflow**

Register and version ML models with metadata tracking.

```bash
ax run ml-model-registry --input '{"model_path": "./models/classifier"}'
```

**Steps:**
1. Validate Model Artifacts
2. Extract Metadata
3. Version Assignment
4. Register in Store
5. Update Catalog

---

### ml-experiment-tracker

**Experiment Tracking Workflow**

Track ML experiments with metrics and artifacts.

```bash
ax run ml-experiment-tracker --input '{"experiment_name": "hyperparameter_sweep"}'
```

**Steps:**
1. Initialize Experiment
2. Log Parameters
3. Track Metrics
4. Save Artifacts
5. Generate Report

---

### ml-model-evaluation

**Model Evaluation Workflow**

Comprehensive model evaluation and validation.

```bash
ax run ml-model-evaluation --input '{"model_id": "clf-v2.1"}'
```

**Steps:**
1. Load Evaluation Dataset
2. Run Predictions
3. Compute Metrics
4. Fairness Analysis
5. Generate Evaluation Report

---

### ml-feature-engineering

**Feature Engineering Workflow**

Automated feature engineering pipeline.

```bash
ax run ml-feature-engineering --input '{"dataset": "users", "target": "churn"}'
```

**Steps:**
1. Data Profiling
2. Feature Generation
3. Feature Selection
4. Validation
5. Feature Store Update

---

### ml-model-monitoring

**Model Monitoring Workflow**

Production model health monitoring and drift detection.

```bash
ax run ml-model-monitoring --input '{"model_id": "prod-recommender"}'
```

**Steps:**
1. Collect Predictions
2. Data Drift Analysis
3. Performance Monitoring
4. Alert Evaluation
5. Generate Health Report

---

### ml-ab-testing

**A/B Testing Workflow**

Structured A/B testing for ML models.

```bash
ax run ml-ab-testing --input '{"control": "model-v1", "treatment": "model-v2"}'
```

**Steps:**
1. Experiment Setup
2. Traffic Splitting
3. Metric Collection
4. Statistical Analysis
5. Decision Report

---

## Enterprise Workflows

### strategic-planning

**Strategic Planning Workflow**

Quarterly and annual strategic planning for technology leadership.

```bash
ax run strategic-planning --input '{"quarter": "Q1", "year": "2025"}'
```

**Steps:**
1. Situation Analysis (CTO agent)
2. Vision Setting
3. Goal Definition
4. Roadmap Creation
5. Resource Planning
6. Communication Plan

---

### product-discovery

**Product Discovery Workflow**

User-centered product discovery and validation.

```bash
ax run product-discovery --input '{"problem_space": "user onboarding"}'
```

**Steps:**
1. Problem Definition
2. User Research
3. Opportunity Mapping
4. Solution Ideation
5. Validation Planning

---

### technology-research

**Technology Research Workflow**

Systematic technology evaluation and recommendation.

```bash
ax run technology-research --input '{"topic": "Vector databases", "use_case": "RAG systems"}'
```

**Steps:**
1. Define Research Scope
2. Technology Survey
3. Evaluation Criteria
4. Comparative Analysis
5. Recommendation Report

---

### analyst

**Business Analysis Workflow**

Data-driven business analysis and insights.

```bash
ax run analyst --input '{"question": "What drives user retention?"}'
```

**Steps:**
1. Understand Question
2. Gather Data
3. Analyze Patterns
4. Generate Insights
5. Create Report

---

## Analysis Workflows

### security-audit

**Security Audit Workflow**

Comprehensive security analysis and vulnerability assessment.

```bash
ax run security-audit --input '{"scope": "src/"}'
```

**Steps:**
1. Threat Modeling
2. Code Security Review
3. Dependency Audit
4. Configuration Review
5. Penetration Test Simulation
6. Remediation Plan

---

## Infrastructure Workflows

### infrastructure-automation

**Infrastructure Automation Workflow**

Infrastructure as Code development and deployment.

```bash
ax run infrastructure-automation --input '{"target": "kubernetes-cluster"}'
```

**Steps:**
1. Requirements Analysis
2. Architecture Design
3. IaC Development
4. Security Review
5. Deployment Plan
6. Monitoring Setup

---

### mobile-development

**Mobile Development Workflow**

Cross-platform mobile application development.

```bash
ax run mobile-development --input '{"feature": "Push notifications"}'
```

**Steps:**
1. Platform Analysis
2. UI/UX Design
3. Implementation
4. Platform Testing
5. Release Preparation

---

### contract-first-project

**Contract-First Project Workflow**

Complete project setup using contract-first methodology.

```bash
ax run contract-first-project --input '{"name": "my-app", "domain": "order"}'
```

**Steps:**
1. Project Scaffolding
2. Contract Definition
3. Domain Implementation
4. Guard Policy Setup
5. Test Generation
6. Documentation

---

## Creating Custom Workflows

Create a YAML file in your workflows directory:

```yaml
workflowId: my-custom-workflow
version: "1.0.0"
name: My Custom Workflow
description: Description of what this workflow does

steps:
  - stepId: step-1
    type: prompt
    name: First Step
    timeout: 60000
    config:
      agentId: architecture
      prompt: |
        Analyze the input and provide recommendations.

  - stepId: step-2
    type: tool
    name: Second Step
    timeout: 30000
    config:
      tool: review_analyze
      args:
        paths: ["src/"]
        focus: security

metadata:
  category: custom
  tags:
    - example
    - custom
```

### Step Types

| Type | Description |
|------|-------------|
| `prompt` | Send prompt to an AI agent |
| `tool` | Execute an MCP tool |
| `conditional` | Conditional branching |
| `loop` | Iterate over items |
| `parallel` | Run steps in parallel |
| `delegate` | Delegate to another workflow |

### Common Configuration

```yaml
# Timeout in milliseconds
timeout: 60000

# Retry policy
retryPolicy:
  maxAttempts: 3
  backoffMs: 5000

# Dependencies (run after these steps)
dependencies: [step-1, step-2]
```

---

## Workflow Best Practices

1. **Start Simple** - Begin with fewer steps and add complexity as needed
2. **Use Appropriate Agents** - Match agents to their expertise
3. **Set Reasonable Timeouts** - Allow enough time for complex operations
4. **Add Retry Policies** - For steps that may fail transiently
5. **Document Metadata** - Add category, tags, and required abilities
