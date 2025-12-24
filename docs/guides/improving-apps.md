# Improving Existing Applications with AutomatosX

This guide shows you how to use AutomatosX (ax) to analyze, improve, and modernize existing codebases. Whether you're dealing with legacy code, technical debt, or want to add new capabilities, ax provides AI-powered tools to help.

## Table of Contents

1. [Assessment: Understanding Your Codebase](#assessment-understanding-your-codebase)
2. [Code Review & Analysis](#code-review--analysis)
3. [Security Hardening](#security-hardening)
4. [Performance Optimization](#performance-optimization)
5. [Refactoring Strategies](#refactoring-strategies)
6. [Adding New Features](#adding-new-features)
7. [Modernizing Legacy Code](#modernizing-legacy-code)
8. [Adopting Contract-First](#adopting-contract-first)
9. [Continuous Improvement](#continuous-improvement)

---

## Assessment: Understanding Your Codebase

Before improving, you need to understand what you're working with.

### Quick Codebase Analysis

```bash
# Get an overview of your codebase
pnpm ax call claude --file ./package.json "Analyze this project structure and dependencies. What type of application is this? What are the main technologies?"

# Analyze architecture
pnpm ax call claude --file ./src/index.ts --file ./src/app.ts "Describe the architecture of this application. Identify patterns used."
```

### Comprehensive Review

```bash
# Full codebase review
pnpm ax review analyze . --focus all

# View the analysis
pnpm ax review list --limit 1
```

### Use the Architecture Agent

```bash
pnpm ax agent run architecture --input '{
  "query": "Analyze the architecture of this codebase. Identify strengths, weaknesses, and opportunities for improvement. Focus on: separation of concerns, dependency management, scalability, and maintainability."
}'
```

---

## Code Review & Analysis

### Focus-Specific Reviews

AutomatosX provides focused reviews to identify specific issues:

```bash
# Security vulnerabilities
pnpm ax review analyze src/ --focus security

# Architecture issues
pnpm ax review analyze src/ --focus architecture

# Performance bottlenecks
pnpm ax review analyze src/ --focus performance

# Maintainability problems
pnpm ax review analyze src/ --focus maintainability

# Logic errors and edge cases
pnpm ax review analyze src/ --focus correctness
```

### Review Specific Files or Directories

```bash
# Review just the API layer
pnpm ax review analyze src/api/ --focus all

# Review authentication code
pnpm ax review analyze src/auth/ --focus security

# Review database queries
pnpm ax review analyze src/db/ --focus performance
```

### Understanding Review Results

Reviews identify:

| Category | What's Found |
|----------|--------------|
| **Critical** | Security vulnerabilities, data loss risks |
| **High** | Bugs, performance issues, anti-patterns |
| **Medium** | Code smells, missing error handling |
| **Low** | Style issues, documentation gaps |

---

## Security Hardening

### Security Audit

```bash
# Comprehensive security review
pnpm ax review analyze src/ --focus security

# Run security audit workflow
pnpm ax run security-audit --input '{
  "scope": "src/",
  "depth": "comprehensive"
}'
```

### Common Security Issues

The security review checks for:

- **Injection vulnerabilities**: SQL, NoSQL, command injection
- **Authentication issues**: Weak passwords, missing MFA, session problems
- **Authorization flaws**: Missing access controls, privilege escalation
- **Data exposure**: Sensitive data in logs, responses, or errors
- **Secrets in code**: API keys, passwords, tokens
- **Dependency vulnerabilities**: Known CVEs in packages

### Use Security Agent

```bash
pnpm ax agent run security --input '{
  "query": "Perform a thorough security audit of the authentication and authorization system. Check for OWASP Top 10 vulnerabilities."
}'
```

### Fix Security Issues

```bash
# Get specific fixes
pnpm ax call claude --file ./src/auth/login.ts "This code has security issues. Provide a secure implementation with:
1. Input validation
2. Rate limiting
3. Secure password handling
4. Proper session management"
```

---

## Performance Optimization

### Performance Analysis

```bash
# Performance-focused review
pnpm ax review analyze src/ --focus performance

# Analyze specific hot paths
pnpm ax call claude --file ./src/api/products.ts "Analyze this code for performance issues. Identify:
1. N+1 query problems
2. Missing indexes
3. Unnecessary computations
4. Memory leaks
5. Caching opportunities"
```

### Use the QA Specialist

```bash
pnpm ax agent run quality --input '{
  "query": "Analyze performance characteristics of the application. Identify bottlenecks and provide optimization recommendations."
}'
```

### Common Performance Improvements

```bash
# Database query optimization
pnpm ax call claude --file ./src/db/queries.ts "Optimize these database queries. Add proper indexing suggestions and batch operations."

# API response caching
pnpm ax call claude --file ./src/api/endpoints.ts "Add appropriate caching strategies to these endpoints. Consider cache invalidation."

# Frontend bundle optimization
pnpm ax call claude --file ./webpack.config.js "Optimize this build configuration for smaller bundle sizes and faster loading."
```

---

## Refactoring Strategies

### Identify Refactoring Opportunities

```bash
# Run refactoring workflow
pnpm ax run refactoring --input '{
  "target": "src/",
  "goals": ["reduce complexity", "improve testability", "extract reusable components"]
}'

# Or use maintainability review
pnpm ax review analyze src/ --focus maintainability
```

### Common Refactoring Patterns

#### Extract Functions/Classes

```bash
pnpm ax call claude --file ./src/services/order.ts "This file is too large. Refactor it by:
1. Extracting related functions into separate modules
2. Creating proper service classes
3. Implementing dependency injection
4. Adding proper TypeScript types"
```

#### Reduce Complexity

```bash
pnpm ax call claude --file ./src/utils/helpers.ts "Simplify these utility functions. Reduce cyclomatic complexity and improve readability."
```

#### Improve Type Safety

```bash
pnpm ax call claude --file ./src/api/handlers.ts "Add proper TypeScript types to this code. Replace 'any' types with specific types. Add input validation."
```

### Gradual Refactoring with Guards

Limit the scope of changes to prevent breaking things:

```bash
# Create a refactoring policy
pnpm ax scaffold guard refactor-orders --domain order --radius 2

# Check your changes comply
pnpm ax guard check --policy refactor-orders \
  --changed-paths "src/services/order.ts,src/models/order.ts"
```

---

## Adding New Features

### Feature Planning

```bash
# Use the product agent to plan
pnpm ax agent run product --input '{
  "query": "Plan the implementation of a subscription billing feature. Consider: user experience, technical requirements, integration points, and potential challenges."
}'
```

### Contract-First Feature Development

```bash
# 1. Define the contract first
pnpm ax scaffold contract subscription \
  --description "Subscription billing - plans, payments, upgrades"

# 2. Review and refine the contract
pnpm ax call claude --file ./packages/contracts/src/subscription/v1/schema.ts \
  "Review this subscription schema. Suggest improvements for production use."

# 3. Generate domain implementation
pnpm ax scaffold domain subscription

# 4. Implement the feature
pnpm ax run developer --input '{
  "feature": "Implement subscription management with Stripe integration"
}'
```

### Feature Implementation Workflow

```bash
pnpm ax run developer --input '{
  "feature": "Add user notifications for order status updates",
  "requirements": [
    "Email notifications",
    "Push notifications",
    "User preferences",
    "Notification history"
  ]
}'
```

### Review New Feature Code

```bash
# Review the implementation
pnpm ax review analyze src/features/notifications/ --focus all
```

---

## Modernizing Legacy Code

### Assessment

```bash
# Understand the legacy codebase
pnpm ax agent run architecture --input '{
  "query": "Analyze this legacy codebase. Identify:
  1. Outdated patterns and dependencies
  2. Missing type safety
  3. Test coverage gaps
  4. Documentation needs
  5. Recommended modernization path"
}'
```

### Step-by-Step Modernization

#### 1. Add TypeScript

```bash
pnpm ax call claude --file ./src/utils.js "Convert this JavaScript file to TypeScript with proper types. Maintain backward compatibility."
```

#### 2. Add Tests

```bash
pnpm ax agent run quality --input '{
  "query": "Generate comprehensive tests for the order service. Include unit tests, integration tests, and edge cases."
}'
```

#### 3. Improve Error Handling

```bash
pnpm ax call claude --file ./src/api/handlers.js "Improve error handling in this file:
1. Add proper try-catch blocks
2. Create custom error classes
3. Return appropriate HTTP status codes
4. Log errors properly"
```

#### 4. Add Documentation

```bash
pnpm ax agent run writer --input '{
  "query": "Document the API endpoints in the order module. Create OpenAPI/Swagger documentation."
}'
```

### Extract to Contracts

Convert existing code to contract-first approach:

```bash
# 1. Analyze existing types
pnpm ax call claude --file ./src/types/order.ts "Convert these TypeScript interfaces to Zod schemas. Add validation rules based on the business logic."

# 2. Create proper contract
pnpm ax scaffold contract order

# 3. Migrate to use new contracts
pnpm ax call claude --file ./src/services/order.ts "Refactor this service to use the new Zod schemas from @myorg/contracts. Add input validation."
```

---

## Adopting Contract-First

Transitioning an existing codebase to contract-first development.

### Step 1: Create Contracts Package

```bash
# If not already a monorepo, restructure first
mkdir -p packages/contracts/src

# Initialize the contracts package
cd packages/contracts
npm init -y

# Add Zod
pnpm add zod
```

### Step 2: Extract Existing Types

```bash
# For each domain, create a contract
pnpm ax scaffold contract user
pnpm ax scaffold contract order
pnpm ax scaffold contract product
```

### Step 3: Define Invariants

For each domain, document the rules:

```bash
pnpm ax call claude --file ./src/services/order.ts "Analyze this service and extract all business rules and invariants. Format them using the INV-XXX-NNN naming convention."
```

### Step 4: Migrate Services

```bash
# Generate new domain structure
pnpm ax scaffold domain order

# Migrate existing logic
pnpm ax call claude --file ./src/services/order.ts --file ./packages/core/order-domain/src/service.ts "Migrate the business logic from the old service to the new contract-first domain service. Use Zod schemas for validation."
```

### Step 5: Add Guard Policies

```bash
# Create policies for each domain
pnpm ax scaffold guard order-policy --domain order --radius 2
pnpm ax scaffold guard user-policy --domain user --radius 2
```

---

## Continuous Improvement

### Automated Reviews

Set up regular code reviews:

```bash
# Daily security scan
pnpm ax review analyze src/ --focus security

# Weekly comprehensive review
pnpm ax review analyze src/ --focus all
```

### Track Improvements

```bash
# View review history
pnpm ax review list --limit 20

# Compare over time
pnpm ax trace
```

### Improvement Workflow

Create a custom workflow for continuous improvement:

```yaml
# workflows/improve-codebase.yaml
workflowId: improve-codebase
version: "1.0.0"
name: Codebase Improvement Cycle
description: Regular codebase health check and improvement

steps:
  - stepId: review
    type: tool
    name: Comprehensive Review
    config:
      tool: review_analyze
      args:
        paths: ["src/"]
        focus: all

  - stepId: prioritize
    type: prompt
    name: Prioritize Issues
    config:
      agentId: architecture
      prompt: |
        Based on the review results, prioritize the improvements:
        ${previousOutputs.review.content}

        Create a prioritized list considering:
        1. Security impact
        2. Performance impact
        3. Maintainability improvement
        4. Implementation effort
    dependencies: [review]

  - stepId: plan
    type: prompt
    name: Create Improvement Plan
    config:
      agentId: quality
      prompt: |
        Create an actionable improvement plan:
        ${previousOutputs.prioritize.content}

        For each item:
        1. Specific changes needed
        2. Files affected
        3. Testing approach
        4. Rollback strategy
    dependencies: [prioritize]

metadata:
  category: maintenance
  tags: [improvement, review, quality]
```

Run periodically:

```bash
pnpm ax run improve-codebase
```

---

## Quick Reference

### Assessment Commands

```bash
# Quick overview
pnpm ax call claude --file ./package.json "Analyze this project"

# Full review
pnpm ax review analyze . --focus all
```

### Review Commands

```bash
pnpm ax review analyze <path> --focus security
pnpm ax review analyze <path> --focus architecture
pnpm ax review analyze <path> --focus performance
pnpm ax review analyze <path> --focus maintainability
pnpm ax review analyze <path> --focus correctness
pnpm ax review analyze <path> --focus all
```

### Improvement Workflows

```bash
pnpm ax run refactoring --input '{"target": "src/"}'
pnpm ax run security-audit --input '{"scope": "src/"}'
pnpm ax run debugger --input '{"issue": "describe the bug"}'
```

### Agent Commands

```bash
pnpm ax agent run security --input '{"query": "..."}'
pnpm ax agent run architecture --input '{"query": "..."}'
pnpm ax agent run quality --input '{"query": "..."}'
pnpm ax agent run backend --input '{"query": "..."}'
pnpm ax agent run frontend --input '{"query": "..."}'
```

---

## Autonomous Improvement Mode

For larger improvement tasks, use autonomous iterate mode:

```bash
# Let AI work autonomously on improvements
pnpm ax iterate claude "modernize the authentication system to use JWT"

# With iteration limits
pnpm ax iterate gemini --max-iterations 40 "add comprehensive error handling"

# Time-limited
pnpm ax iterate codex --max-time 20m "improve test coverage to 80%"
```

---

## System Status and History

### Check Improvement Progress

```bash
# View system status
pnpm ax status

# Check run history
pnpm ax history

# Filter by status
pnpm ax history --status completed
```

### Resume Interrupted Work

```bash
# List available checkpoints
pnpm ax resume list --agent coder

# Resume from checkpoint
pnpm ax resume --agent coder
```

---

## Next Steps

- **[Quickstart Guide](../quickstart.md)** - Get running in 5 minutes
- **[Building Software Guide](./building-software.md)** - Build new applications
- **[MLOps Guide](./mlops-guide.md)** - Machine learning operations
- **[CLI Reference](../reference/cli-commands.md)** - Complete CLI documentation
- **[Workflows Reference](../reference/workflows.md)** - All available workflows
- **[Agents Reference](../reference/agents.md)** - All available agents
