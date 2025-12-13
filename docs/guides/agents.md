# AutomatosX Agents Guide

> **Version**: v12.9.0 | **Last Updated**: December 2024

This comprehensive guide covers everything you need to know about using AutomatosX agents effectively - from basic usage to advanced multi-agent workflows.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Agent Tiers](#agent-tiers)
3. [Core Agents](#core-agents-recommended)
4. [Extended Agents](#extended-agents)
5. [Specialty Agents](#specialty-agents)
6. [Choosing the Right Agent](#choosing-the-right-agent)
7. [Usage Patterns](#usage-patterns)
8. [Multi-Agent Workflows](#multi-agent-workflows)
9. [Custom Agents](#custom-agents)
10. [CLI Reference](#cli-reference)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Quick Start

### List Available Agents

```bash
# Show all visible agents (10 agents)
ax list agents

# Show with example prompts
ax list agents --examples

# Show all agents including hidden specialty agents
ax list agents --all

# JSON output for scripting
ax list agents --format json
```

### Run an Agent

```bash
# Direct execution
ax run backend "Design a REST API for user authentication"

# With specific provider
ax run security "Audit this code for vulnerabilities" --provider claude

# Interactive mode
ax run quality "Review the test coverage" --interactive
```

### Natural Language (Recommended)

Just talk to Claude Code naturally - AutomatosX routes to the best agent automatically:

```
"Help me design a database schema for user management"
→ Routes to backend agent

"Review this code for security issues"
→ Routes to security agent

"Set up GitHub Actions for deployment"
→ Routes to devops agent
```

---

## Agent Tiers

AutomatosX organizes agents into tiers based on usage frequency and specialization:

| Tier | Count | Visibility | Description |
|------|-------|------------|-------------|
| **Core** | 6 | Always visible | Daily development tasks |
| **Extended** | 8 | Visible | Specialized workflows |
| **Specialty** | 1 | Hidden (`--all`) | Domain-specific expertise |
| **Deprecated** | 4 | Hidden | Legacy, use alternatives |

---

## Core Agents (Recommended)

These 6 agents cover 90% of typical development workflows.

### backend

**Best For**: API design, databases, server-side logic

| Attribute | Value |
|-----------|-------|
| Expertise | Go, Rust, Node.js, Python, databases, microservices |
| Provider | Gemini (implementation), Claude (design) |
| Use When | Building APIs, database schemas, server logic |

**Example Prompts**:
```
"Design REST API for user authentication with JWT"
"Optimize this PostgreSQL query for better performance"
"Implement rate limiting middleware"
"Create database migration for user preferences"
```

**Sample Workflow**:
```bash
ax run backend "Design REST API for order management system" --save
ax run backend "Implement the order API endpoints"
ax run quality "Write tests for the order API"
```

---

### frontend

**Best For**: UI components, React, accessibility

| Attribute | Value |
|-----------|-------|
| Expertise | React, Next.js, Vue, CSS, accessibility, responsive design |
| Provider | Gemini (components), Claude (architecture) |
| Use When | Building UI, fixing styling, accessibility audits |

**Example Prompts**:
```
"Build responsive dashboard component with data grid"
"Fix accessibility issues in the navigation menu"
"Create reusable form validation component"
"Implement dark mode toggle with CSS variables"
```

**Sample Workflow**:
```bash
ax run frontend "Create login form with validation"
ax run frontend "Add accessibility attributes to the form"
ax run quality "Test the login form across browsers"
```

---

### quality

**Best For**: Testing, QA automation, code review

| Attribute | Value |
|-----------|-------|
| Expertise | Unit testing, integration testing, E2E, code review |
| Provider | Gemini (test generation), Claude (review) |
| Use When | Writing tests, reviewing PRs, improving coverage |

**Example Prompts**:
```
"Write unit tests for the payment module"
"Review this PR for potential issues"
"Create E2E tests for the checkout flow"
"Improve test coverage for the auth service"
```

**Sample Workflow**:
```bash
ax run quality "Analyze test coverage gaps in src/core/"
ax run quality "Write missing unit tests for router.ts"
ax run quality "Create integration tests for the API"
```

---

### architecture

**Best For**: System design, scalability, technical decisions

| Attribute | Value |
|-----------|-------|
| Expertise | System design, patterns, scalability, technical debt |
| Provider | Claude (reasoning), Gemini (diagrams) |
| Use When | Planning systems, evaluating trade-offs, ADRs |

**Example Prompts**:
```
"Design microservices architecture for order system"
"Evaluate trade-offs between REST and GraphQL"
"Create ADR for database technology selection"
"Plan migration from monolith to microservices"
```

**Sample Workflow**:
```bash
ax run architecture "Design high-level architecture for e-commerce platform"
ax run architecture "Create ADR for the auth service design"
ax run backend "Implement the auth service based on the ADR"
```

---

### security

**Best For**: Security audits, vulnerabilities, authentication

| Attribute | Value |
|-----------|-------|
| Expertise | OWASP, penetration testing, auth systems, encryption |
| Provider | Claude (critical accuracy) |
| Use When | Security reviews, vulnerability scanning, auth design |

**Example Prompts**:
```
"Audit this code for OWASP Top 10 vulnerabilities"
"Review authentication implementation for security issues"
"Check for SQL injection vulnerabilities"
"Design secure session management"
```

**Sample Workflow**:
```bash
ax run security "Scan the authentication module for vulnerabilities"
ax run security "Review JWT implementation for security issues"
ax run backend "Fix the identified security vulnerabilities"
```

---

### devops

**Best For**: CI/CD, Docker, infrastructure

| Attribute | Value |
|-----------|-------|
| Expertise | GitHub Actions, Docker, Kubernetes, Terraform, monitoring |
| Provider | Gemini (scripts), Claude (architecture) |
| Use When | Setting up pipelines, containerization, deployment |

**Example Prompts**:
```
"Create GitHub Actions workflow for deployment"
"Write Dockerfile for Node.js application"
"Set up Kubernetes deployment configuration"
"Configure monitoring with Prometheus and Grafana"
```

**Sample Workflow**:
```bash
ax run devops "Create CI pipeline with testing and linting"
ax run devops "Write Dockerfile for production deployment"
ax run devops "Set up staging environment in Kubernetes"
```

---

## Extended Agents

These agents handle specialized workflows that complement the core agents.

### data

**Best For**: Data pipelines, ETL, analytics

| Attribute | Value |
|-----------|-------|
| Expertise | ETL, data warehouses, SQL, data modeling |
| Use When | Building data pipelines, analytics queries |

**Example Prompts**:
```
"Build ETL pipeline for user analytics data"
"Design data warehouse schema for sales reporting"
"Create SQL query for monthly revenue report"
```

---

### product

**Best For**: Requirements, user stories, acceptance criteria

| Attribute | Value |
|-----------|-------|
| Expertise | PRDs, user stories, acceptance criteria, roadmaps |
| Use When | Defining requirements, writing stories, planning features |

**Example Prompts**:
```
"Write user stories for checkout flow feature"
"Create acceptance criteria for user registration"
"Draft PRD for the notification system"
```

---

### writer

**Best For**: Technical documentation, API docs, guides

| Attribute | Value |
|-----------|-------|
| Expertise | Technical writing, API documentation, tutorials |
| Use When | Writing docs, READMEs, API references |

**Example Prompts**:
```
"Write API documentation for the auth endpoints"
"Create getting started guide for the SDK"
"Document the configuration options"
```

---

### design

**Best For**: UX/UI design, wireframes, design systems

| Attribute | Value |
|-----------|-------|
| Expertise | User flows, wireframes, design systems, accessibility |
| Use When | Designing user experiences, creating flows |

**Example Prompts**:
```
"Design user flow for onboarding experience"
"Create wireframe for the dashboard layout"
"Define component library structure"
```

---

### data-scientist (Dana)

**Best For**: Machine learning, statistical modeling, algorithms

| Attribute | Value |
|-----------|-------|
| Display Name | Dana |
| Expertise | ML/AI, statistical modeling, predictive analytics, algorithms |
| Use When | Building ML models, data analysis, algorithm implementation |

**Example Prompts**:
```
"Build classification model for churn prediction"
"Implement gradient descent optimization algorithm"
"Design A/B testing framework with statistical analysis"
"Create recommendation engine for product suggestions"
```

---

### mobile (Maya)

**Best For**: iOS/Android development, cross-platform apps

| Attribute | Value |
|-----------|-------|
| Display Name | Maya |
| Expertise | iOS, Android, React Native, Flutter, mobile UX |
| Use When | Building mobile apps, native features, cross-platform development |

**Example Prompts**:
```
"Build cross-platform auth screen with biometrics"
"Implement push notification handler for iOS"
"Create offline-first data sync for mobile app"
"Design responsive mobile navigation pattern"
```

---

### quantum-engineer (Quinn)

**Best For**: Quantum computing, quantum algorithms, hybrid workflows

| Attribute | Value |
|-----------|-------|
| Display Name | Quinn |
| Expertise | Qiskit, Cirq, quantum algorithms, VQE, QAOA, hybrid quantum-classical |
| Use When | Designing quantum circuits, quantum optimization, quantum ML |

**Example Prompts**:
```
"Design VQE circuit for molecular simulation"
"Implement QAOA for combinatorial optimization"
"Create hybrid quantum-classical ML pipeline"
"Optimize quantum circuit depth for NISQ devices"
```

---

### aerospace-scientist (Astrid)

**Best For**: Space systems, orbital mechanics, mission planning

| Attribute | Value |
|-----------|-------|
| Display Name | Astrid |
| Expertise | Orbital mechanics, trajectory optimization, telemetry, mission planning |
| Use When | Space mission design, satellite systems, trajectory calculations |

**Example Prompts**:
```
"Calculate orbital transfer trajectory to Mars"
"Design telemetry system for CubeSat mission"
"Optimize launch window for lunar orbit insertion"
"Model atmospheric re-entry thermal dynamics"
```

---

## Specialty Agents

These agents require explicit selection and handle niche domains. Use `ax list agents --all` to see them.

| Agent | Domain | Example Use Case |
|-------|--------|------------------|
| `creative-marketer` | Marketing, GenAI content | "Create Imagen prompts for product campaign" |

**Usage**:
```bash
# Must specify agent explicitly
ax run creative-marketer "Create social media campaign for product launch"
```

---

## Choosing the Right Agent

### Decision Flowchart

```
What are you trying to do?
│
├─ Build/implement code?
│  ├─ Server-side/API → backend
│  ├─ UI/components → frontend
│  └─ Both → backend first, then frontend
│
├─ Review/test code?
│  ├─ Security concerns → security
│  ├─ Code quality/tests → quality
│  └─ Architecture review → architecture
│
├─ Set up infrastructure?
│  └─ CI/CD, Docker, deploy → devops
│
├─ Plan/document?
│  ├─ Requirements → product
│  ├─ Documentation → writer
│  └─ UX/flows → design
│
├─ Work with data?
│  ├─ Pipelines/ETL → data
│  └─ ML models → data-scientist (--all)
│
└─ Not sure?
   └─ Just describe your task - AutomatosX auto-routes!
```

### Quick Reference Table

| Task Type | Primary Agent | Alternative |
|-----------|---------------|-------------|
| REST API design | backend | architecture |
| Database schema | backend | data |
| React component | frontend | - |
| Unit tests | quality | - |
| Security audit | security | quality |
| System design | architecture | - |
| CI/CD pipeline | devops | - |
| User stories | product | - |
| API docs | writer | backend |
| UX wireframes | design | product |

---

## Usage Patterns

### Pattern 1: Direct Execution

Best for quick, single-purpose tasks.

```bash
ax run backend "Add pagination to the users API endpoint"
```

### Pattern 2: Natural Language

Best for exploratory work - just talk naturally.

```
"Help me optimize this database query that's running slow"
→ AutomatosX routes to backend agent automatically
```

### Pattern 3: Sequential Workflow

Best for multi-step features.

```bash
# Step 1: Design
ax run architecture "Design auth system with OAuth2 and JWT"

# Step 2: Implement
ax run backend "Implement the auth system based on the design"

# Step 3: Test
ax run quality "Write comprehensive tests for the auth system"

# Step 4: Document
ax run writer "Document the auth API endpoints"
```

### Pattern 4: Parallel Execution

Best for independent tasks.

```bash
# Run multiple agents in parallel
ax run backend "Implement user API" &
ax run frontend "Build user profile component" &
ax run quality "Write user module tests" &
wait
```

---

## Multi-Agent Workflows

### Delegation Syntax

Agents can delegate to other agents using `@agent` syntax:

```
@backend please implement the authentication API
@security please audit the implementation
@quality please write tests for the auth module
```

### DELEGATE TO Syntax

```
DELEGATE TO backend: implement the user service
DELEGATE TO security: review the implementation for vulnerabilities
```

### Workflow Example: Feature Development

```yaml
# .automatosx/workflows/feature.yaml
name: Feature Development Workflow
steps:
  - agent: product
    task: "Define requirements and acceptance criteria"

  - agent: architecture
    task: "Design technical approach"

  - agent: backend
    task: "Implement backend services"
    parallel: true

  - agent: frontend
    task: "Implement UI components"
    parallel: true

  - agent: quality
    task: "Write tests and review"

  - agent: security
    task: "Security audit"

  - agent: writer
    task: "Update documentation"
```

### Workflow Example: Code Review

```bash
# Comprehensive code review workflow
ax run quality "Review the PR for code quality issues"
ax run security "Check for security vulnerabilities"
ax run architecture "Evaluate architectural implications"
```

---

## Custom Agents

### Create a Custom Agent

```bash
# Interactive creation
ax agent create my-agent --template developer --interactive

# From template
ax agent create data-engineer --template specialist
```

### Agent Profile Structure

```yaml
# .automatosx/agents/my-agent.yaml
name: my-agent
displayName: Custom Agent
description: My custom agent for specific tasks
specialization: Domain-specific expertise
personality: Professional and thorough

expertise:
  - Skill 1
  - Skill 2
  - Skill 3

instructions: |
  You are a specialized agent for [domain].

  **Core Responsibilities**:
  - Task 1
  - Task 2

  **CRITICAL - Non-Interactive Mode**:
  When running in background mode, proceed automatically
  without asking for permission or confirmation.
```

### Test Your Agent

```bash
# View agent details
ax agent show my-agent

# Test with a task
ax run my-agent "Test task to verify agent works"
```

---

## CLI Reference

### List Commands

```bash
ax list agents              # Show visible agents (10)
ax list agents --all        # Show all agents including hidden (15+)
ax list agents --examples   # Show with example prompts
ax list agents --format json # JSON output
```

### Run Commands

```bash
ax run <agent> "task"           # Basic execution
ax run <agent> "task" --provider claude  # Specific provider
ax run <agent> "task" --save    # Save to memory
ax run <agent> "task" --interactive  # Interactive mode
ax run <agent> "task" --timeout 300000  # Custom timeout (ms)
ax run <agent> "task" --quiet   # Minimal output (CI mode)
```

### Agent Management

```bash
ax agent show <name>        # View agent details
ax agent create <name>      # Create new agent
ax agent list               # List all agents
```

---

## Best Practices

### 1. Start with the Right Agent

- Don't use `backend` for UI work
- Don't use `frontend` for API design
- When in doubt, let AutomatosX auto-route

### 2. Use Specific Prompts

```
# Bad: Too vague
"Help me with the code"

# Good: Specific and actionable
"Design REST API endpoints for user CRUD operations with pagination"
```

### 3. Chain Agents for Complex Tasks

```bash
# Design → Implement → Test → Document
ax run architecture "Design the payment system"
ax run backend "Implement payment processing"
ax run quality "Write payment module tests"
ax run writer "Document the payment API"
```

### 4. Leverage Memory

```bash
# Save important context
ax run backend "Design auth system" --save

# Later sessions will have this context automatically
ax run backend "Add rate limiting to auth endpoints"
# Memory auto-injects previous auth system design
```

### 5. Use the Right Provider

- **Claude**: Best for reasoning, security, architecture
- **Gemini**: Best for implementation, tests, routine tasks
- **Let AutomatosX decide**: Usually optimal

---

## Troubleshooting

### Agent Not Found

```bash
# Check available agents
ax list agents --all

# Verify agent name (case-sensitive)
ax agent show backend
```

### Wrong Agent Selected

```bash
# Force specific agent
ax run security "audit code" --agent security

# Or be more specific in your prompt
"Security agent, please audit this authentication code for vulnerabilities"
```

### Agent Hangs

- Check timeout settings: `--timeout 300000`
- Ensure non-interactive mode for background execution
- Review agent profile for interactive prompts

### Low Routing Confidence

If AutomatosX frequently selects `standard` agent:
- Be more specific in your task description
- Explicitly mention the domain (API, UI, test, etc.)
- Use agent name directly: `ax run backend "task"`

---

## Related Documentation

- [Agent Communication](./agent-communication.md) - Delegation patterns
- [Multi-Agent Orchestration](./multi-agent-orchestration.md) - Complex workflows
- [Agent Templates](./agent-templates.md) - Creating custom agents
- [Team Configuration](./team-configuration.md) - Team-based agent setup

---

**Need help?** Run `ax doctor` to diagnose issues or visit [GitHub Issues](https://github.com/defai-digital/automatosx/issues).
