# PRD: Comprehensive Workflow Coverage Enhancement

**Version:** 1.0.0
**Created:** 2025-12-18
**Status:** Draft
**Author:** AI Analysis

---

## Executive Summary

AutomatosX has **25 agents** but only **15 workflows**, leaving **40% of agents without dedicated workflows**. This PRD defines high-value workflows to achieve **95%+ agent utilization** and complete pipeline coverage.

### Current State

| Metric | Value |
|--------|-------|
| Total Agents | 25 |
| Total Workflows | 15 |
| Agents with Workflows | 15 (60%) |
| Agents without Workflows | 10 (40%) |

### Target State

| Metric | Target |
|--------|--------|
| Total Workflows | 25 |
| Agents with Workflows | 24 (96%) |
| Coverage by Domain | 100% |

---

## Agent Inventory by Coverage Status

### Fully Covered Agents (Good)

| Agent | Role | Workflows Used In |
|-------|------|-------------------|
| data-scientist | Senior Data Scientist | 7 workflows |
| ml-engineer | ML Engineer | 6 workflows |
| writer | Technical Writer | 9 workflows |
| architecture | Principal Architect | 4 workflows |
| backend | Backend Engineer | 3 workflows |
| security | Security Engineer | 3 workflows |
| quality | QA Engineer | 3 workflows |

### Partially Covered Agents (Needs Improvement)

| Agent | Role | Workflows | Gap |
|-------|------|-----------|-----|
| frontend | Frontend Developer | 2 | No dedicated frontend workflow |
| devops | DevOps Engineer | 1 | Only security-audit, no infra workflow |
| researcher | Technical Researcher | 1 | Only debugger, no research workflow |
| reviewer | Code Reviewer | 1 | Has dedicated workflow, OK |
| standard | General Assistant | 1 | General purpose, OK |

### Uncovered Agents (Critical)

| Agent | Role | Team | Priority |
|-------|------|------|----------|
| mlops-engineer | MLOps Engineer | platform | CRITICAL |
| product | Product Manager | product | CRITICAL |
| cto | CTO | leadership | CRITICAL |
| mobile | Mobile Engineer | engineering | CRITICAL |
| ceo | CEO | leadership | HIGH |
| fullstack | Fullstack Engineer | engineering | HIGH |
| blockchain-developer | Blockchain Developer | engineering | MEDIUM |
| creative-marketer | Marketing Strategist | marketing | MEDIUM |
| quantum-engineer | Quantum Engineer | research | LOW |
| aerospace-scientist | Aerospace Scientist | research | LOW |

---

## Priority Matrix

### Tier 1: Critical Business Value (Implement Week 1-2)

| Workflow | Primary Agent | Business Impact |
|----------|---------------|-----------------|
| Product Discovery | product | Enables feature validation before building |
| MLOps Deployment | mlops-engineer | Automates model deployment pipeline |
| Mobile Development | mobile | Enables mobile app features |
| Infrastructure Automation | devops | Automates cloud/infrastructure |

### Tier 2: High Business Value (Implement Week 3-4)

| Workflow | Primary Agent | Business Impact |
|----------|---------------|-----------------|
| Strategic Planning | cto, ceo | Enables leadership decision-making |
| Fullstack Feature | fullstack | End-to-end feature development |
| Technology Research | researcher | Enables informed tech decisions |
| Frontend Feature | frontend | Dedicated frontend development |

### Tier 3: Domain-Specific (Implement Quarter 2)

| Workflow | Primary Agent | Business Impact |
|----------|---------------|-----------------|
| Blockchain Development | blockchain-developer | Smart contract development |
| Marketing Campaign | creative-marketer | Campaign planning and execution |
| Quantum Computing | quantum-engineer | Quantum algorithm development |
| Aerospace Systems | aerospace-scientist | Space systems engineering |

---

## Tier 1 Workflow Specifications

### 1. Product Discovery Workflow

**File:** `examples/workflows/product-discovery.yaml`

**Purpose:** Validate product ideas and features before engineering investment.

**Why Critical:** Building wrong features is the biggest waste. This ensures we build the right things.

```yaml
workflowId: product-discovery
name: Product Discovery Workflow
description: Validate product ideas through user research, market analysis, and requirements definition
version: "1.0.0"
category: product
tags:
  - product
  - discovery
  - research
  - requirements

metadata:
  requiredAbilities:
    - product-management
    - user-research
    - competitive-analysis
  estimatedDuration: 480
  complexity: high

steps:
  - stepId: problem-definition
    name: Define Problem Space
    type: prompt
    timeout: 120000
    config:
      agent: product
      task: |
        Define the problem space we're exploring.

        ## Problem Definition Framework

        1. **Problem Statement**:
           - What problem are we solving?
           - Who experiences this problem?
           - How painful is this problem (1-10)?
           - How frequently does it occur?

        2. **Current Solutions**:
           - How do users solve this today?
           - What are the limitations of current solutions?
           - Why haven't existing solutions worked?

        3. **Success Criteria**:
           - How will we know we've solved the problem?
           - What metrics define success?
           - What's the minimum viable outcome?

        4. **Constraints**:
           - Technical constraints
           - Business constraints
           - Time constraints
           - Resource constraints

  - stepId: user-research
    name: User Research Synthesis
    type: prompt
    timeout: 180000
    config:
      agent: product
      task: |
        Synthesize user research to validate the problem.

        ## User Research Analysis

        1. **User Segments**:
           - Primary user persona
           - Secondary user personas
           - User jobs-to-be-done

        2. **Pain Points**:
           - Top 5 pain points identified
           - Severity ranking
           - Frequency of occurrence

        3. **User Quotes**:
           - Key verbatim quotes that illustrate the problem
           - Emotional context

        4. **Behavioral Insights**:
           - Current user workflows
           - Workarounds users employ
           - Trigger events for seeking solutions

        5. **Willingness to Pay**:
           - Value of solving this problem
           - Budget indicators
           - Purchasing decision makers

  - stepId: competitive-analysis
    name: Competitive Analysis
    type: prompt
    timeout: 180000
    config:
      agent: researcher
      task: |
        Analyze competitive landscape.

        ## Competitive Analysis

        1. **Direct Competitors**:
           | Competitor | Strengths | Weaknesses | Pricing | Market Position |
           |------------|-----------|------------|---------|-----------------|

        2. **Indirect Competitors**:
           - Alternative solutions users employ
           - Substitute products/services

        3. **Competitive Advantages**:
           - What can we do better?
           - What's our unique angle?
           - Defensibility of our approach

        4. **Market Gaps**:
           - Underserved segments
           - Unmet needs
           - Opportunity areas

        5. **Risks**:
           - Competitive responses
           - Market timing risks
           - Technology risks

  - stepId: solution-ideation
    name: Solution Ideation
    type: prompt
    timeout: 180000
    config:
      agent: product
      task: |
        Generate and evaluate solution concepts.

        ## Solution Ideation

        1. **Solution Concepts**:
           For each concept:
           - Description
           - How it solves the problem
           - Key features
           - Technical feasibility (1-10)
           - Business viability (1-10)
           - User desirability (1-10)

        2. **MVP Definition**:
           - Minimum features for first version
           - What we're explicitly NOT building
           - Success metrics for MVP

        3. **Validation Approach**:
           - How will we test this solution?
           - What experiments should we run?
           - What would prove us wrong?

        4. **Risk Assessment**:
           - Technical risks
           - Market risks
           - Execution risks
           - Mitigation strategies

  - stepId: requirements-definition
    name: Define Requirements
    type: prompt
    timeout: 180000
    config:
      agent: product
      task: |
        Create detailed requirements documentation.

        ## Product Requirements Document

        1. **Overview**:
           - Product name
           - One-line description
           - Target release

        2. **Goals & Success Metrics**:
           | Goal | Metric | Target | Current Baseline |
           |------|--------|--------|------------------|

        3. **User Stories**:
           Format: As a [user type], I want [action], so that [benefit]

           **Must Have (P0)**:
           - Story 1
           - Story 2

           **Should Have (P1)**:
           - Story 3
           - Story 4

           **Nice to Have (P2)**:
           - Story 5

        4. **Functional Requirements**:
           - Feature 1: Description, acceptance criteria
           - Feature 2: Description, acceptance criteria

        5. **Non-Functional Requirements**:
           - Performance requirements
           - Security requirements
           - Scalability requirements
           - Accessibility requirements

        6. **Out of Scope**:
           - Explicitly excluded features
           - Future considerations

  - stepId: technical-feasibility
    name: Technical Feasibility Assessment
    type: prompt
    timeout: 120000
    config:
      agent: architecture
      task: |
        Assess technical feasibility of proposed solution.

        ## Technical Feasibility Assessment

        1. **Architecture Approach**:
           - High-level system design
           - Key components
           - Integration points

        2. **Technology Stack**:
           - Recommended technologies
           - Build vs buy decisions
           - Third-party dependencies

        3. **Effort Estimation**:
           | Component | Complexity | Effort (days) | Risk |
           |-----------|------------|---------------|------|

        4. **Technical Risks**:
           - Identified risks
           - Mitigation strategies
           - Unknowns to investigate

        5. **Recommendation**:
           - GO / NO-GO / NEEDS MORE RESEARCH
           - Conditions for proceeding
           - Recommended next steps

  - stepId: create-roadmap
    name: Create Roadmap
    type: prompt
    timeout: 120000
    config:
      agent: product
      task: |
        Create product roadmap based on discovery findings.

        ## Product Roadmap

        1. **Phase 1: MVP** (Target: X weeks)
           - Features included
           - Success criteria
           - Go/no-go decision point

        2. **Phase 2: Enhancement** (Target: X weeks)
           - Features included
           - Dependencies on Phase 1

        3. **Phase 3: Scale** (Target: X weeks)
           - Features included
           - Market expansion

        4. **Key Milestones**:
           | Milestone | Date | Success Criteria |
           |-----------|------|------------------|

        5. **Resource Requirements**:
           - Team composition
           - Skills needed
           - External dependencies

  - stepId: store-discovery
    name: Store Discovery Artifacts
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: product-discovery
      key: "{{product_id}}/{{version}}"
      ttl: 31536000
      value:
        product_id: "{{product_id}}"
        version: "{{version}}"
        problem_statement: "{{problem_statement}}"
        user_research: "{{user_research}}"
        competitive_analysis: "{{competitive_analysis}}"
        solution_concept: "{{solution_concept}}"
        requirements: "{{requirements}}"
        feasibility: "{{feasibility}}"
        roadmap: "{{roadmap}}"
        created_at: "{{timestamp}}"
        created_by: "{{user}}"
```

---

### 2. MLOps Deployment Workflow

**File:** `examples/workflows/mlops-deployment.yaml`

**Purpose:** Automate model deployment from registry to production.

**Why Critical:** Manual deployments are error-prone and slow. This enables continuous deployment for ML.

```yaml
workflowId: mlops-deployment
name: MLOps Deployment Pipeline
description: Automate model deployment from registry to production with validation gates
version: "1.0.0"
category: mlops
tags:
  - mlops
  - deployment
  - automation
  - production

metadata:
  requiredAbilities:
    - mlops
    - infrastructure
    - deployment
  estimatedDuration: 300
  complexity: high

steps:
  - stepId: fetch-model
    name: Fetch Model from Registry
    type: tool
    timeout: 30000
    tool: memory_retrieve
    config:
      namespace: ml-model-registry
      key: "{{model_name}}/versions/{{version}}"

  - stepId: validate-deployment-readiness
    name: Validate Deployment Readiness
    type: prompt
    timeout: 120000
    config:
      agent: mlops-engineer
      task: |
        Validate model is ready for deployment.

        ## Pre-Deployment Checklist

        1. **Model Artifact Validation**:
           - [ ] Model file exists and is accessible
           - [ ] Checksum matches registry
           - [ ] Model loads successfully

        2. **Evaluation Gate**:
           - [ ] Model passed evaluation workflow
           - [ ] Metrics meet production thresholds
           - [ ] Fairness audit passed

        3. **Schema Validation**:
           - [ ] Input schema documented
           - [ ] Output schema documented
           - [ ] Feature list matches training

        4. **Dependency Validation**:
           - [ ] All dependencies available
           - [ ] Version compatibility verified
           - [ ] No security vulnerabilities in deps

        5. **Configuration Validation**:
           - [ ] Serving config defined
           - [ ] Resource requirements specified
           - [ ] Scaling parameters set

        Return: READY / NOT_READY with blocking issues

  - stepId: generate-infrastructure
    name: Generate Infrastructure Code
    type: prompt
    timeout: 180000
    config:
      agent: mlops-engineer
      task: |
        Generate infrastructure-as-code for model deployment.

        ## Infrastructure Requirements

        Based on model requirements:
        - Model size: {{model_size}}
        - Expected QPS: {{expected_qps}}
        - Latency SLA: {{latency_sla}}
        - Availability SLA: {{availability_sla}}

        ## Generate Artifacts

        1. **Kubernetes Deployment**:
           ```yaml
           apiVersion: apps/v1
           kind: Deployment
           metadata:
             name: {{model_name}}-{{version}}
           spec:
             replicas: {{replicas}}
             # ... complete deployment spec
           ```

        2. **Service Configuration**:
           ```yaml
           apiVersion: v1
           kind: Service
           # ... complete service spec
           ```

        3. **Horizontal Pod Autoscaler**:
           ```yaml
           apiVersion: autoscaling/v2
           kind: HorizontalPodAutoscaler
           # ... complete HPA spec
           ```

        4. **Resource Quotas**:
           - CPU requests/limits
           - Memory requests/limits
           - GPU allocation (if needed)

        5. **Health Checks**:
           - Liveness probe configuration
           - Readiness probe configuration

  - stepId: deploy-canary
    name: Deploy Canary
    type: prompt
    timeout: 120000
    config:
      agent: mlops-engineer
      task: |
        Deploy model as canary with limited traffic.

        ## Canary Deployment Plan

        1. **Traffic Split**:
           - Production (current): 95%
           - Canary (new): 5%

        2. **Canary Configuration**:
           - Duration: 1 hour minimum
           - Success criteria: error rate < 0.1%, latency p99 < {{latency_sla}}
           - Auto-rollback triggers

        3. **Monitoring Setup**:
           - Metrics to watch
           - Alerting thresholds
           - Dashboard links

        4. **Rollback Procedure**:
           - Immediate rollback command
           - Traffic drain time
           - Verification steps

  - stepId: monitor-canary
    name: Monitor Canary Health
    type: prompt
    timeout: 60000
    config:
      agent: mlops-engineer
      task: |
        Analyze canary deployment health.

        ## Canary Health Check

        1. **Error Rate**:
           - Canary: {{canary_error_rate}}
           - Production: {{prod_error_rate}}
           - Delta: {{error_delta}}
           - Status: OK / WARNING / CRITICAL

        2. **Latency**:
           - Canary P50: {{canary_p50}}
           - Canary P99: {{canary_p99}}
           - Production P50: {{prod_p50}}
           - Production P99: {{prod_p99}}
           - Status: OK / WARNING / CRITICAL

        3. **Model Metrics**:
           - Prediction distribution comparison
           - Confidence score distribution
           - Feature value ranges

        4. **Decision**:
           - PROMOTE: Canary healthy, proceed to full rollout
           - HOLD: Needs more observation
           - ROLLBACK: Issues detected

  - stepId: promote-or-rollback
    name: Promote or Rollback
    type: conditional
    config:
      condition: "{{canary_decision}}"
      branches:
        PROMOTE:
          - stepId: full-rollout
            type: prompt
            config:
              agent: mlops-engineer
              task: |
                Execute full rollout of new model version.

                ## Rollout Plan
                1. Gradual traffic shift: 5% → 25% → 50% → 100%
                2. Monitoring at each step
                3. Final verification

        ROLLBACK:
          - stepId: execute-rollback
            type: prompt
            config:
              agent: mlops-engineer
              task: |
                Execute rollback to previous version.

                ## Rollback Steps
                1. Shift traffic back to production
                2. Scale down canary
                3. Document incident
                4. Create follow-up tasks

  - stepId: update-registry
    name: Update Model Registry
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-model-registry
      key: "{{model_name}}/versions/{{version}}"
      merge: true
      value:
        status: "{{final_status}}"
        deployment_completed_at: "{{timestamp}}"
        deployment_environment: "production"
        serving_endpoint: "{{endpoint_url}}"

  - stepId: notify-stakeholders
    name: Notify Stakeholders
    type: prompt
    timeout: 60000
    config:
      agent: writer
      task: |
        Create deployment notification.

        ## Deployment Notification

        **Subject**: Model Deployment: {{model_name}} v{{version}}

        **Status**: {{deployment_status}}

        **Details**:
        - Deployed at: {{timestamp}}
        - Environment: Production
        - Endpoint: {{endpoint_url}}
        - Traffic: 100%

        **Metrics**:
        - Current error rate: {{error_rate}}
        - P99 latency: {{latency}}

        **Rollback Command**:
        ```
        ax deploy rollback {{model_name}} --to-version {{previous_version}}
        ```

  - stepId: store-deployment-event
    name: Log Deployment Event
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: ml-deployment-events
      key: "{{model_name}}/{{timestamp}}"
      ttl: 31536000
      value:
        event_type: "deployment"
        model_name: "{{model_name}}"
        version: "{{version}}"
        status: "{{deployment_status}}"
        environment: "production"
        canary_duration: "{{canary_duration}}"
        rollback_occurred: "{{rollback_occurred}}"
        deployed_by: "{{user}}"
        timestamp: "{{timestamp}}"
```

---

### 3. Mobile Development Workflow

**File:** `examples/workflows/mobile-development.yaml`

**Purpose:** End-to-end mobile feature development from design to app store.

**Why Critical:** Mobile is a key platform. Without a workflow, mobile development is ad-hoc.

```yaml
workflowId: mobile-development
name: Mobile Feature Development Workflow
description: End-to-end mobile feature development from design to app store deployment
version: "1.0.0"
category: mobile
tags:
  - mobile
  - ios
  - android
  - cross-platform

metadata:
  requiredAbilities:
    - mobile-development
    - cross-platform
    - ui-design
  estimatedDuration: 600
  complexity: high

steps:
  - stepId: requirements-review
    name: Review Feature Requirements
    type: prompt
    timeout: 120000
    config:
      agent: mobile
      task: |
        Review and clarify mobile feature requirements.

        ## Requirements Analysis

        1. **Feature Overview**:
           - Feature name and description
           - User story
           - Acceptance criteria

        2. **Platform Requirements**:
           - iOS minimum version: {{ios_min}}
           - Android minimum version: {{android_min}}
           - Cross-platform or native?

        3. **UI/UX Requirements**:
           - Screen designs available?
           - Platform-specific adaptations needed?
           - Accessibility requirements

        4. **Technical Requirements**:
           - API dependencies
           - Local storage needs
           - Offline capability
           - Push notifications
           - Deep linking

        5. **Performance Requirements**:
           - Launch time impact
           - Memory constraints
           - Battery impact

        6. **Questions/Clarifications**:
           - List any ambiguities
           - Missing information

  - stepId: architecture-design
    name: Design Mobile Architecture
    type: prompt
    timeout: 180000
    config:
      agent: mobile
      task: |
        Design the mobile architecture for this feature.

        ## Architecture Design

        1. **Component Structure**:
           - Screen/View components
           - Business logic components
           - Data layer components
           - Shared utilities

        2. **State Management**:
           - State architecture (Redux, MobX, Provider, etc.)
           - State shape
           - Actions/mutations

        3. **Navigation**:
           - Navigation flow
           - Deep link handling
           - Back stack management

        4. **Data Layer**:
           - API client design
           - Local storage schema
           - Caching strategy
           - Sync strategy (if offline-capable)

        5. **Platform Considerations**:
           - iOS-specific code
           - Android-specific code
           - Shared code percentage

        6. **Dependencies**:
           - New libraries needed
           - Version compatibility
           - License compliance

  - stepId: implement-feature
    name: Implement Feature
    type: prompt
    timeout: 300000
    config:
      agent: mobile
      task: |
        Implement the mobile feature.

        ## Implementation

        1. **UI Components**:
           - Create screen components
           - Implement UI interactions
           - Handle different screen sizes
           - Support dark/light mode

        2. **Business Logic**:
           - Implement feature logic
           - Handle edge cases
           - Error handling

        3. **Data Integration**:
           - API integration
           - Local storage
           - State updates

        4. **Platform Specifics**:
           - iOS adaptations
           - Android adaptations
           - Platform-specific APIs

        5. **Accessibility**:
           - VoiceOver/TalkBack support
           - Dynamic type support
           - Contrast requirements

  - stepId: write-tests
    name: Write Tests
    type: prompt
    timeout: 180000
    config:
      agent: quality
      task: |
        Create comprehensive test suite for mobile feature.

        ## Test Suite

        1. **Unit Tests**:
           - Business logic tests
           - State management tests
           - Utility function tests

        2. **Widget/Component Tests**:
           - UI component rendering
           - User interaction tests
           - State change tests

        3. **Integration Tests**:
           - API integration tests
           - Navigation tests
           - Data flow tests

        4. **Platform Tests**:
           - iOS-specific tests
           - Android-specific tests

        5. **Accessibility Tests**:
           - Screen reader compatibility
           - Touch target sizes
           - Color contrast

        6. **Performance Tests**:
           - Launch time impact
           - Memory usage
           - Frame rate

  - stepId: code-review
    name: Code Review
    type: prompt
    timeout: 120000
    config:
      agent: reviewer
      task: |
        Review mobile feature implementation.

        ## Review Checklist

        1. **Code Quality**:
           - Clean architecture adherence
           - Code organization
           - Naming conventions
           - Documentation

        2. **Performance**:
           - No unnecessary re-renders
           - Efficient data structures
           - Lazy loading where appropriate

        3. **Security**:
           - Secure data storage
           - API security
           - Input validation

        4. **Platform Guidelines**:
           - iOS Human Interface Guidelines
           - Android Material Design
           - Platform idioms

        5. **Accessibility**:
           - WCAG compliance
           - Platform accessibility APIs

  - stepId: qa-testing
    name: QA Testing
    type: prompt
    timeout: 180000
    config:
      agent: quality
      task: |
        Perform QA testing on mobile feature.

        ## QA Test Plan

        1. **Functional Testing**:
           - All acceptance criteria met
           - Happy path works
           - Edge cases handled

        2. **Device Testing**:
           - Test on minimum supported devices
           - Test on latest devices
           - Test on different screen sizes

        3. **OS Version Testing**:
           - Minimum supported versions
           - Latest versions
           - Beta versions (if applicable)

        4. **Network Testing**:
           - WiFi
           - Cellular (4G/5G)
           - Offline mode
           - Poor connectivity

        5. **Regression Testing**:
           - Existing features still work
           - No performance regression

        6. **Bug Report**:
           - Issues found
           - Severity classification
           - Reproduction steps

  - stepId: app-store-preparation
    name: App Store Preparation
    type: prompt
    timeout: 120000
    config:
      agent: mobile
      task: |
        Prepare for app store submission.

        ## App Store Checklist

        1. **App Store Connect / Play Console**:
           - Version number updated
           - Build number incremented
           - Release notes written

        2. **Screenshots**:
           - All required sizes
           - Feature highlighted
           - Localized if needed

        3. **Metadata**:
           - Description updated
           - Keywords optimized
           - Category correct

        4. **Compliance**:
           - Privacy policy updated
           - Data collection disclosed
           - Age rating accurate

        5. **Release Strategy**:
           - Phased rollout percentage
           - Geographic targeting
           - Release timing

  - stepId: store-feature-record
    name: Store Feature Record
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: mobile-features
      key: "{{feature_id}}/{{version}}"
      value:
        feature_id: "{{feature_id}}"
        version: "{{version}}"
        platforms: "{{platforms}}"
        status: "{{status}}"
        architecture: "{{architecture}}"
        test_results: "{{test_results}}"
        release_notes: "{{release_notes}}"
        created_at: "{{timestamp}}"
```

---

### 4. Infrastructure Automation Workflow

**File:** `examples/workflows/infrastructure-automation.yaml`

**Purpose:** Automate infrastructure provisioning and management.

**Why Critical:** Manual infrastructure management is error-prone and doesn't scale.

```yaml
workflowId: infrastructure-automation
name: Infrastructure Automation Workflow
description: Automate infrastructure provisioning, configuration, and management
version: "1.0.0"
category: infrastructure
tags:
  - devops
  - infrastructure
  - automation
  - cloud

metadata:
  requiredAbilities:
    - infrastructure-as-code
    - cloud-architecture
    - ci-cd
  estimatedDuration: 300
  complexity: high

steps:
  - stepId: requirements-gathering
    name: Gather Infrastructure Requirements
    type: prompt
    timeout: 120000
    config:
      agent: devops
      task: |
        Gather and document infrastructure requirements.

        ## Infrastructure Requirements

        1. **Service Requirements**:
           - Service name and purpose
           - Expected load (requests/second)
           - Data storage needs
           - Compute requirements

        2. **Availability Requirements**:
           - Uptime SLA (99.9%, 99.99%, etc.)
           - RPO (Recovery Point Objective)
           - RTO (Recovery Time Objective)
           - Disaster recovery needs

        3. **Security Requirements**:
           - Network isolation needs
           - Encryption requirements
           - Access control
           - Compliance requirements

        4. **Cost Constraints**:
           - Monthly budget
           - Cost optimization priorities
           - Reserved vs on-demand

        5. **Integration Requirements**:
           - Existing services to connect
           - External APIs
           - Data pipelines

  - stepId: architecture-design
    name: Design Infrastructure Architecture
    type: prompt
    timeout: 180000
    config:
      agent: devops
      task: |
        Design infrastructure architecture.

        ## Architecture Design

        1. **Compute Layer**:
           - Kubernetes cluster configuration
           - Node pools and sizing
           - Auto-scaling configuration

        2. **Data Layer**:
           - Database selection and configuration
           - Caching layer
           - Object storage

        3. **Network Layer**:
           - VPC design
           - Subnets and routing
           - Load balancing
           - CDN configuration

        4. **Security Layer**:
           - IAM roles and policies
           - Network security groups
           - Secrets management
           - Encryption at rest/transit

        5. **Observability Layer**:
           - Logging infrastructure
           - Metrics collection
           - Tracing
           - Alerting

        6. **Cost Estimation**:
           - Monthly cost breakdown
           - Cost optimization opportunities

  - stepId: generate-terraform
    name: Generate Terraform Code
    type: prompt
    timeout: 300000
    config:
      agent: devops
      task: |
        Generate Terraform infrastructure-as-code.

        ## Terraform Modules

        1. **Network Module**:
           ```hcl
           module "network" {
             source = "./modules/network"
             # ... configuration
           }
           ```

        2. **Compute Module**:
           ```hcl
           module "compute" {
             source = "./modules/compute"
             # ... configuration
           }
           ```

        3. **Data Module**:
           ```hcl
           module "data" {
             source = "./modules/data"
             # ... configuration
           }
           ```

        4. **Security Module**:
           ```hcl
           module "security" {
             source = "./modules/security"
             # ... configuration
           }
           ```

        5. **Variables and Outputs**:
           - Environment-specific variables
           - Sensitive variable handling
           - Output values for integration

  - stepId: generate-kubernetes
    name: Generate Kubernetes Manifests
    type: prompt
    timeout: 180000
    config:
      agent: devops
      task: |
        Generate Kubernetes manifests.

        ## Kubernetes Resources

        1. **Namespace and RBAC**:
           - Namespace definition
           - ServiceAccount
           - Role and RoleBinding

        2. **Workloads**:
           - Deployment/StatefulSet
           - ConfigMap
           - Secret references

        3. **Networking**:
           - Service
           - Ingress
           - NetworkPolicy

        4. **Scaling**:
           - HorizontalPodAutoscaler
           - PodDisruptionBudget

        5. **Observability**:
           - ServiceMonitor (Prometheus)
           - PodMonitor

  - stepId: setup-cicd
    name: Setup CI/CD Pipeline
    type: prompt
    timeout: 180000
    config:
      agent: devops
      task: |
        Configure CI/CD pipeline for infrastructure.

        ## CI/CD Configuration

        1. **Terraform Pipeline**:
           - Plan stage
           - Apply stage (with approval)
           - State management

        2. **Kubernetes Pipeline**:
           - Manifest validation
           - Dry-run apply
           - Progressive rollout

        3. **Security Scanning**:
           - Terraform security scan
           - Container image scanning
           - Secrets detection

        4. **Notifications**:
           - Deployment notifications
           - Failure alerts
           - Approval requests

  - stepId: validation
    name: Validate Infrastructure
    type: prompt
    timeout: 120000
    config:
      agent: devops
      task: |
        Validate infrastructure configuration.

        ## Validation Checks

        1. **Terraform Validation**:
           - `terraform validate`
           - `terraform plan` review
           - Cost estimation

        2. **Security Validation**:
           - tfsec scan results
           - checkov scan results
           - Policy compliance

        3. **Kubernetes Validation**:
           - kubeval/kubeconform
           - OPA/Gatekeeper policies
           - Resource quota compliance

        4. **Documentation**:
           - Architecture diagram
           - Runbook
           - Disaster recovery procedure

  - stepId: store-infrastructure
    name: Store Infrastructure Record
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: infrastructure
      key: "{{service_name}}/{{environment}}"
      value:
        service_name: "{{service_name}}"
        environment: "{{environment}}"
        architecture: "{{architecture}}"
        terraform_modules: "{{terraform_modules}}"
        kubernetes_manifests: "{{kubernetes_manifests}}"
        cost_estimate: "{{cost_estimate}}"
        created_at: "{{timestamp}}"
        created_by: "{{user}}"
```

---

## Tier 2 Workflow Specifications

### 5. Strategic Planning Workflow

**File:** `examples/workflows/strategic-planning.yaml`

```yaml
workflowId: strategic-planning
name: Strategic Planning Workflow
description: Quarterly and annual strategic planning for technology leadership
version: "1.0.0"
category: leadership
tags:
  - strategy
  - planning
  - leadership
  - roadmap

metadata:
  requiredAbilities:
    - strategic-planning
    - technology-evaluation
    - stakeholder-communication
  estimatedDuration: 600
  complexity: high

steps:
  - stepId: situation-analysis
    name: Current Situation Analysis
    type: prompt
    timeout: 180000
    config:
      agent: cto
      task: |
        Analyze current technology situation.

        ## Situation Analysis

        1. **Technology Landscape**:
           - Current tech stack assessment
           - Technical debt inventory
           - Infrastructure status
           - Security posture

        2. **Team Assessment**:
           - Team capabilities
           - Skill gaps
           - Hiring needs
           - Training requirements

        3. **Business Alignment**:
           - Business goals understanding
           - Technology support for goals
           - Gaps in alignment

        4. **Competitive Analysis**:
           - Technology advantages
           - Areas of lag
           - Industry trends

        5. **Risk Assessment**:
           - Technical risks
           - Security risks
           - Operational risks
           - People risks

  - stepId: vision-setting
    name: Set Technology Vision
    type: prompt
    timeout: 180000
    config:
      agent: ceo
      task: |
        Define technology vision aligned with business strategy.

        ## Vision Definition

        1. **3-Year Vision**:
           - Where do we want to be?
           - Key technology capabilities
           - Competitive differentiation

        2. **Strategic Themes**:
           - Theme 1: Description and rationale
           - Theme 2: Description and rationale
           - Theme 3: Description and rationale

        3. **Success Metrics**:
           - How will we measure success?
           - Key milestones
           - Leading indicators

        4. **Investment Areas**:
           - Where should we invest?
           - Build vs buy decisions
           - Partnership opportunities

  - stepId: roadmap-creation
    name: Create Technology Roadmap
    type: prompt
    timeout: 180000
    config:
      agent: cto
      task: |
        Create detailed technology roadmap.

        ## Technology Roadmap

        1. **Quarter 1**:
           - Initiatives
           - Deliverables
           - Resources needed
           - Dependencies

        2. **Quarter 2**:
           - Initiatives
           - Deliverables
           - Resources needed
           - Dependencies

        3. **Quarter 3**:
           - Initiatives
           - Deliverables
           - Resources needed
           - Dependencies

        4. **Quarter 4**:
           - Initiatives
           - Deliverables
           - Resources needed
           - Dependencies

        5. **Resource Plan**:
           - Headcount plan
           - Budget allocation
           - External resources

  - stepId: risk-mitigation
    name: Risk Mitigation Planning
    type: prompt
    timeout: 120000
    config:
      agent: cto
      task: |
        Develop risk mitigation strategies.

        ## Risk Mitigation Plan

        For each identified risk:

        | Risk | Likelihood | Impact | Mitigation Strategy | Owner |
        |------|------------|--------|---------------------|-------|

        1. **Technical Risks**:
           - Mitigation approaches
           - Contingency plans

        2. **Resource Risks**:
           - Backup plans
           - Cross-training strategy

        3. **External Risks**:
           - Vendor dependencies
           - Market changes

  - stepId: communication-plan
    name: Create Communication Plan
    type: prompt
    timeout: 120000
    config:
      agent: writer
      task: |
        Create strategic communication plan.

        ## Communication Plan

        1. **Executive Summary**:
           - One-page strategy summary
           - Key messages

        2. **Stakeholder Communications**:
           | Stakeholder | Message | Frequency | Channel |
           |-------------|---------|-----------|---------|

        3. **Team Communications**:
           - All-hands presentation
           - Team-specific briefings

        4. **Progress Reporting**:
           - Metrics dashboard
           - Review cadence

  - stepId: store-strategy
    name: Store Strategic Plan
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: strategic-plans
      key: "{{plan_year}}/{{plan_quarter}}"
      ttl: 63072000
      value:
        year: "{{plan_year}}"
        quarter: "{{plan_quarter}}"
        vision: "{{vision}}"
        roadmap: "{{roadmap}}"
        risks: "{{risks}}"
        communication_plan: "{{communication_plan}}"
        created_at: "{{timestamp}}"
        approved_by: "{{approver}}"
```

---

### 6. Technology Research Workflow

**File:** `examples/workflows/technology-research.yaml`

```yaml
workflowId: technology-research
name: Technology Research & Evaluation Workflow
description: Systematic technology evaluation for informed decision-making
version: "1.0.0"
category: research
tags:
  - research
  - evaluation
  - technology
  - analysis

metadata:
  requiredAbilities:
    - research
    - technology-evaluation
    - analysis
  estimatedDuration: 480
  complexity: medium

steps:
  - stepId: define-scope
    name: Define Research Scope
    type: prompt
    timeout: 60000
    config:
      agent: researcher
      task: |
        Define the research scope and objectives.

        ## Research Scope

        1. **Research Question**:
           - Primary question to answer
           - Secondary questions

        2. **Context**:
           - Why this research is needed
           - Business driver
           - Timeline for decision

        3. **Scope Boundaries**:
           - What's in scope
           - What's out of scope
           - Constraints

        4. **Evaluation Criteria**:
           - Must-have requirements
           - Nice-to-have requirements
           - Deal-breakers

        5. **Deliverables**:
           - Expected outputs
           - Format
           - Audience

  - stepId: market-research
    name: Conduct Market Research
    type: prompt
    timeout: 180000
    config:
      agent: researcher
      task: |
        Research the market landscape.

        ## Market Research

        1. **Technology Landscape**:
           - Major players
           - Emerging solutions
           - Open source options

        2. **Market Trends**:
           - Growth trends
           - Adoption patterns
           - Future predictions

        3. **Case Studies**:
           - Similar company implementations
           - Success stories
           - Failure cases

        4. **Analyst Reports**:
           - Gartner/Forrester positioning
           - Industry analyst opinions

  - stepId: technical-evaluation
    name: Technical Deep Dive
    type: prompt
    timeout: 240000
    config:
      agent: researcher
      task: |
        Conduct technical evaluation of top candidates.

        ## Technical Evaluation

        For each candidate technology:

        1. **Architecture**:
           - How it works
           - Components
           - Integration points

        2. **Performance**:
           - Benchmarks
           - Scalability
           - Resource requirements

        3. **Security**:
           - Security model
           - Compliance certifications
           - Known vulnerabilities

        4. **Developer Experience**:
           - Documentation quality
           - Learning curve
           - Community support

        5. **Operational Aspects**:
           - Deployment complexity
           - Monitoring/observability
           - Maintenance burden

  - stepId: poc-design
    name: Design Proof of Concept
    type: prompt
    timeout: 120000
    config:
      agent: architecture
      task: |
        Design proof of concept for top candidates.

        ## POC Design

        1. **Objectives**:
           - What are we trying to prove?
           - Success criteria

        2. **Scope**:
           - Features to implement
           - Integrations to test

        3. **Timeline**:
           - Duration
           - Milestones

        4. **Resources**:
           - Team needed
           - Infrastructure needed

        5. **Evaluation Framework**:
           - Metrics to collect
           - Comparison methodology

  - stepId: recommendation
    name: Generate Recommendation
    type: prompt
    timeout: 120000
    config:
      agent: researcher
      task: |
        Generate final recommendation.

        ## Recommendation Report

        1. **Executive Summary**:
           - Recommendation
           - Key rationale
           - Confidence level

        2. **Comparison Matrix**:
           | Criteria | Option A | Option B | Option C |
           |----------|----------|----------|----------|
           | ... | ... | ... | ... |

        3. **Recommendation**:
           - Recommended option
           - Rationale
           - Trade-offs accepted

        4. **Implementation Roadmap**:
           - Adoption phases
           - Resource requirements
           - Risk mitigation

        5. **Alternatives Considered**:
           - Why not chosen
           - When to reconsider

  - stepId: store-research
    name: Store Research Report
    type: tool
    timeout: 10000
    tool: memory_store
    config:
      namespace: technology-research
      key: "{{research_id}}"
      ttl: 31536000
      value:
        research_id: "{{research_id}}"
        topic: "{{topic}}"
        recommendation: "{{recommendation}}"
        report: "{{full_report}}"
        created_at: "{{timestamp}}"
        created_by: "{{user}}"
```

---

## Implementation Checklist

### Phase 1: Critical Workflows (Week 1-2)

- [ ] Create `examples/workflows/product-discovery.yaml`
- [ ] Create `examples/workflows/mlops-deployment.yaml`
- [ ] Create `examples/workflows/mobile-development.yaml`
- [ ] Create `examples/workflows/infrastructure-automation.yaml`
- [ ] Test all workflows with respective agents
- [ ] Update documentation

### Phase 2: High-Value Workflows (Week 3-4)

- [ ] Create `examples/workflows/strategic-planning.yaml`
- [ ] Create `examples/workflows/technology-research.yaml`
- [ ] Create `examples/workflows/fullstack-feature.yaml`
- [ ] Create `examples/workflows/frontend-feature.yaml`
- [ ] Integration testing
- [ ] Documentation updates

### Phase 3: Domain-Specific (Quarter 2)

- [ ] Create `examples/workflows/blockchain-development.yaml`
- [ ] Create `examples/workflows/marketing-campaign.yaml`
- [ ] Create quantum computing workflow (if needed)
- [ ] Create aerospace workflow (if needed)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Agent Workflow Coverage | 60% | 96% |
| Workflow Count | 15 | 25 |
| Uncovered Agents | 10 | 1 |
| Domain Coverage | 6/11 | 11/11 |

---

## Appendix: Agent-Workflow Matrix (Target State)

| Agent | Current Workflows | Target Workflows |
|-------|-------------------|------------------|
| product | 0 | product-discovery |
| mlops-engineer | 0 | mlops-deployment |
| mobile | 0 | mobile-development |
| devops | 1 | infrastructure-automation, security-audit |
| cto | 0 | strategic-planning |
| ceo | 0 | strategic-planning |
| researcher | 1 | technology-research, debugger |
| fullstack | 0 | fullstack-feature |
| frontend | 2 | frontend-feature, developer |
| blockchain-developer | 0 | blockchain-development |
| creative-marketer | 0 | marketing-campaign |
