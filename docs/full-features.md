# AutomatosX - Full Features & CLI Reference

**For advanced users who need direct CLI access** (5% of users)

> ⚠️ **Note**: This document is for advanced users who need direct CLI control. **95% of users should use AutomatosX through Claude Code/Codex with natural language** (see [README.md](../README.md)).

---

## Table of Contents

1. [Direct CLI Usage](#direct-cli-usage)
2. [All Available Agents](#all-available-agents)
3. [Memory Commands](#memory-commands)
4. [Session Management](#session-management)
5. [Provider Management](#provider-management)
6. [MCP Server Management](#mcp-server-management)
7. [Workflow Execution](#workflow-execution)
8. [Advanced Configuration](#advanced-configuration)
9. [Debugging & Diagnostics](#debugging--diagnostics)

---

## Direct CLI Usage

### Basic Execution

```bash
# Run an agent with a task
ax run <agent-name> "task description"

# Examples
ax run backend "implement user authentication API"
ax run security "audit the auth implementation"
ax run quality "write integration tests for auth"
```

### With Provider Selection

```bash
# Force specific provider
ax run backend "task" --provider gemini-cli
ax run security "task" --provider claude-code
ax run quality "task" --provider openai

# Auto-select optimal provider (default)
ax run backend "task"  # AutomatosX chooses best provider
```

### With Memory Management

```bash
# Save task results to memory
ax run backend "implement feature X" --save-to-memory

# Use memory context automatically (default)
ax run backend "implement feature X"  # Auto-injects relevant context

# Disable memory for this task
ax run backend "implement feature X" --no-memory
```

### Advanced Options

```bash
# Streaming output
ax run backend "task" --streaming

# Quiet mode (minimal output)
ax run backend "task" --quiet

# Verbose mode (debug output)
ax run backend "task" --verbose

# With timeout
ax run backend "long task" --timeout 3600000  # 1 hour in ms

# With max iterations
ax run backend "task" --iterate --iterate-max-iterations 5

# With token budget
ax run backend "task" --iterate-max-tokens 100000
ax run backend "task" --iterate-max-tokens-per-iteration 10000
```

---

## All Available Agents

### Development Agents

#### Backend Agent (Bob)
```bash
ax run backend "task description"
```
**Specialties**: Go, Rust, Node.js, API design, database optimization, microservices

**Example Tasks**:
```bash
ax run backend "design REST API for user management"
ax run backend "optimize this SQL query for performance"
ax run backend "implement JWT authentication middleware"
```

#### Frontend Agent (Frank)
```bash
ax run frontend "task description"
```
**Specialties**: React, Next.js, Vue, Swift UI, responsive design, accessibility

**Example Tasks**:
```bash
ax run frontend "create responsive dashboard component"
ax run frontend "implement dark mode toggle in React"
ax run frontend "optimize bundle size for production"
```

#### Fullstack Agent (Felix)
```bash
ax run fullstack "task description"
```
**Specialties**: End-to-end features, Node.js, TypeScript, React, database + API + UI

**Example Tasks**:
```bash
ax run fullstack "build complete CRUD app for blog posts"
ax run fullstack "add real-time notifications with WebSockets"
```

#### Mobile Agent (Maya)
```bash
ax run mobile "task description"
```
**Specialties**: iOS (Swift), Android (Kotlin), React Native, Flutter

**Example Tasks**:
```bash
ax run mobile "implement push notifications in iOS"
ax run mobile "create cross-platform auth flow with React Native"
```

### Architecture & Design

#### Architecture Agent (Avery)
```bash
ax run architecture "task description"
```
**Specialties**: System design, ADRs, microservices, event-driven architecture

**Example Tasks**:
```bash
ax run architecture "design payment processing system"
ax run architecture "create ADR for database migration strategy"
ax run architecture "evaluate monolith vs microservices for our scale"
```

#### Design Agent (Debbee)
```bash
ax run design "task description"
```
**Specialties**: UX/UI design, wireframes, user flows, design systems

**Example Tasks**:
```bash
ax run design "create user flow for onboarding process"
ax run design "design dashboard layout with Figma export"
ax run design "audit accessibility issues in current UI"
```

### Quality & Testing

#### Quality Agent (Queenie)
```bash
ax run quality "task description"
```
**Specialties**: Test planning, unit tests, integration tests, E2E tests, QA automation

**Example Tasks**:
```bash
ax run quality "write unit tests for auth service"
ax run quality "create E2E test suite for checkout flow"
ax run quality "review test coverage and suggest improvements"
```

#### Security Agent (Steve)
```bash
ax run security "task description"
```
**Specialties**: Threat modeling, penetration testing, OWASP, security audits

**Example Tasks**:
```bash
ax run security "audit authentication implementation"
ax run security "perform threat modeling for payment system"
ax run security "check for SQL injection vulnerabilities"
```

### Infrastructure & Data

#### DevOps Agent (Oliver)
```bash
ax run devops "task description"
```
**Specialties**: CI/CD, Docker, Kubernetes, AWS/GCP/Azure, infrastructure as code

**Example Tasks**:
```bash
ax run devops "set up CI/CD pipeline with GitHub Actions"
ax run devops "create Kubernetes deployment manifests"
ax run devops "optimize Docker image size"
```

#### Data Agent (Daisy)
```bash
ax run data "task description"
```
**Specialties**: ETL pipelines, data warehousing, Apache Spark, Airflow

**Example Tasks**:
```bash
ax run data "design ETL pipeline for user analytics"
ax run data "optimize Spark job performance"
ax run data "create data warehouse schema"
```

#### Data Scientist Agent (Dana)
```bash
ax run data-scientist "task description"
```
**Specialties**: Machine learning, feature engineering, model training, PyTorch, TensorFlow

**Example Tasks**:
```bash
ax run data-scientist "build recommendation system"
ax run data-scientist "analyze user churn with ML models"
ax run data-scientist "optimize hyperparameters for neural network"
```

### Business & Product

#### Product Agent (Paris)
```bash
ax run product "task description"
```
**Specialties**: Requirements gathering, roadmaps, user stories, feature prioritization

**Example Tasks**:
```bash
ax run product "create user stories for payment feature"
ax run product "prioritize backlog based on user feedback"
ax run product "design A/B test for new onboarding flow"
```

#### CTO Agent (Tony)
```bash
ax run cto "task description"
```
**Specialties**: Technical strategy, architecture decisions, team organization, tech debt

**Example Tasks**:
```bash
ax run cto "evaluate build vs buy for notification system"
ax run cto "create technical roadmap for Q1 2025"
ax run cto "analyze tech debt and create remediation plan"
```

#### CEO Agent (Eric)
```bash
ax run ceo "task description"
```
**Specialties**: Business strategy, market analysis, competitive positioning, growth

**Example Tasks**:
```bash
ax run ceo "analyze competitor landscape"
ax run ceo "create go-to-market strategy for new product"
ax run ceo "evaluate pricing model options"
```

### Content & Research

#### Writer Agent (Wendy)
```bash
ax run writer "task description"
```
**Specialties**: Technical documentation, API docs, user guides, blog posts

**Example Tasks**:
```bash
ax run writer "write API documentation for auth endpoints"
ax run writer "create user guide for dashboard feature"
ax run writer "draft release notes for v2.0"
```

#### Researcher Agent (Rodman)
```bash
ax run researcher "task description"
```
**Specialties**: Market research, technical analysis, competitive intelligence

**Example Tasks**:
```bash
ax run researcher "research best practices for API rate limiting"
ax run researcher "analyze top 5 competitors' pricing models"
ax run researcher "investigate latest trends in AI orchestration"
```

#### Creative Marketer Agent (Candy)
```bash
ax run creative-marketer "task description"
```
**Specialties**: Marketing copy, social media, content strategy, campaigns

**Example Tasks**:
```bash
ax run creative-marketer "write launch announcement for new feature"
ax run creative-marketer "create social media campaign for Q1"
ax run creative-marketer "draft landing page copy"
```

### Specialized Technical

#### Quantum Engineer Agent (Quinn)
```bash
ax run quantum-engineer "task description"
```
**Specialties**: Quantum computing, quantum algorithms, Qiskit, Cirq

**Example Tasks**:
```bash
ax run quantum-engineer "implement Shor's algorithm in Qiskit"
ax run quantum-engineer "optimize quantum circuit depth"
```

#### Aerospace Scientist Agent (Astrid)
```bash
ax run aerospace-scientist "task description"
```
**Specialties**: Orbital mechanics, mission design, flight dynamics

**Example Tasks**:
```bash
ax run aerospace-scientist "calculate delta-v for Mars transfer"
ax run aerospace-scientist "design satellite constellation"
```

#### Standard Agent (Stan)
```bash
ax run standard "task description"
```
**Specialties**: Standards compliance, best practices, code review

**Example Tasks**:
```bash
ax run standard "review code for PEP 8 compliance"
ax run standard "audit for REST API best practices"
```

---

## Memory Commands

### Search Memory

```bash
# Search for past conversations
ax memory search "authentication"
ax memory search "payment API"
ax memory search "database schema"

# Search with limit
ax memory search "authentication" --limit 10

# Search with filters
ax memory search "authentication" --agent backend
ax memory search "authentication" --after "2025-01-01"
ax memory search "authentication" --before "2025-12-31"
```

### List Memories

```bash
# List recent memories
ax memory list

# List with limit
ax memory list --limit 20

# List by agent
ax memory list --agent backend
ax memory list --agent security

# List by date range
ax memory list --after "2025-01-01"
ax memory list --before "2025-12-31"
```

### Add Memory Manually

```bash
# Add a memory entry
ax memory add "Important: API uses JWT tokens with 1hr expiry"

# Add with metadata
ax memory add "Database: PostgreSQL 15, schema in schema.sql" --agent backend

# Add from file
ax memory add-file docs/architecture.md --agent architecture
```

### Export/Import Memory

```bash
# Export all memories
ax memory export > backup.json

# Export with filters
ax memory export --agent backend > backend-memories.json
ax memory export --after "2025-01-01" > recent-memories.json

# Import memories
ax memory import backup.json

# Import and merge (skip duplicates)
ax memory import backup.json --merge
```

### Clear Memory

```bash
# Clear all memories (requires confirmation)
ax memory clear

# Clear by agent
ax memory clear --agent backend

# Clear by date
ax memory clear --before "2024-01-01"

# Clear with force (no confirmation)
ax memory clear --force
```

### Memory Stats

```bash
# View memory statistics
ax memory stats

# Output:
# Total memories: 1,234
# Total size: 45.6 MB
# Oldest entry: 2024-06-15
# Newest entry: 2025-11-23
# Agents: backend (456), security (234), quality (123), ...
```

---

## Session Management

### Create Session

```bash
# Create a multi-agent session
ax session create "auth-implementation" backend security quality

# Start working in session
ax session use auth-implementation

# Run tasks in session (shared memory)
ax run backend "implement JWT auth"
ax run security "audit the implementation"
ax run quality "write tests"
```

### List Sessions

```bash
# List all sessions
ax session list

# Output:
# ID                    Name                  Agents                     Created
# a1b2c3d4              auth-implementation   backend,security,quality   2025-11-23
# e5f6g7h8              payment-feature       backend,product,quality    2025-11-22
```

### Show Session Details

```bash
# View session details
ax session show auth-implementation

# Output includes:
# - Session metadata
# - Participating agents
# - Task history
# - Shared memory entries
```

### Delete Session

```bash
# Delete a session
ax session delete auth-implementation

# Force delete (no confirmation)
ax session delete auth-implementation --force
```

---

## Provider Management

### List Providers

```bash
# List all configured providers
ax providers list

# Output:
# Provider       Status     Priority   Availability
# claude-code    enabled    1          ✓ available
# gemini-cli     enabled    2          ✓ available
# openai         enabled    3          ✓ available
# ax-cli         disabled   4          ✗ not installed
```

### Show Provider Info

```bash
# View detailed provider information
ax providers info claude-code

# Output includes:
# - Configuration
# - Health status
# - Usage statistics
# - Performance metrics
```

### Test Provider

```bash
# Test provider availability
ax providers test claude-code
ax providers test gemini-cli

# Output:
# ✓ claude-code is available
# ✓ CLI executable found: /usr/local/bin/claude
# ✓ Version: 1.2.3
# ✓ Authentication: OK
```

### View Provider Trace Logs

```bash
# View real-time routing decisions
ax providers trace --follow

# Output (JSONL format):
# {"timestamp":"2025-11-23T10:30:15.123Z","event":"execution_start","provider":"claude-code","task":"implement auth"}
# {"timestamp":"2025-11-23T10:30:18.456Z","event":"delegation","from":"product","to":"backend"}
# {"timestamp":"2025-11-23T10:30:25.789Z","event":"execution_complete","provider":"gemini-cli","tokens":1234}

# View last 100 trace entries
ax providers trace --tail 100

# Filter by provider
ax providers trace --provider claude-code

# Filter by date
ax providers trace --since "2025-11-23"
```

### Free Tier Status

```bash
# Check free tier quota status
ax free-tier status

# Output:
# Provider     Quota Used   Quota Remaining   Reset Date
# gemini-cli   15/60        45                2025-12-01
# openai       0/60         60                2025-12-01

# View usage history
ax free-tier history

# Output (last 7 days):
# Date         Provider     Requests   Tokens
# 2025-11-23   gemini-cli   12         45,678
# 2025-11-22   gemini-cli   8          32,145
```

---

## MCP Server Management

### Start MCP Server

```bash
# Start AutomatosX as MCP server for Claude Code
ax mcp server

# Start with custom port
ax mcp server --port 3000

# Start in background
ax mcp server --daemon
```

### Install MCP Servers

```bash
# Install MCP server from npm
ax mcp install @modelcontextprotocol/server-filesystem
ax mcp install @modelcontextprotocol/server-github
ax mcp install @modelcontextprotocol/server-database

# Install from local path
ax mcp install ./my-custom-mcp-server

# Install with configuration
ax mcp install @modelcontextprotocol/server-filesystem --config config.json
```

### List MCP Servers

```bash
# List all installed MCP servers
ax mcp list

# Output:
# Name                 Status    CPU      Memory   Uptime
# filesystem-server    running   2.5%     45 MB    2h 15m
# github-server        running   1.2%     32 MB    2h 15m
# database-server      stopped   -        -        -
```

### MCP Server Metrics

```bash
# View metrics summary
ax mcp metrics --summary

# Output:
# Total servers: 3
# Running: 2
# Stopped: 1
# Total CPU: 3.7%
# Total memory: 77 MB
# Total requests (24h): 1,234

# View detailed metrics for specific server
ax mcp metrics filesystem-server

# Output includes:
# - Request count
# - Latency (p50, p95, p99)
# - Error rate
# - Resource usage
```

### Resource Limits

```bash
# Set resource limits for MCP server
ax mcp limits filesystem-server --memory 512 --cpu 50

# View current limits
ax mcp limits filesystem-server

# Output:
# Memory limit: 512 MB
# CPU limit: 50%
# Network: allowed
# Filesystem: sandboxed to /project/path
```

### MCP Server Logs

```bash
# View logs for all MCP servers
ax mcp logs

# View logs for specific server
ax mcp logs filesystem-server

# Follow logs in real-time
ax mcp logs --follow

# Filter by level
ax mcp logs --level error
ax mcp logs --level warn
```

### Stop/Restart MCP Servers

```bash
# Stop MCP server
ax mcp stop filesystem-server

# Restart MCP server
ax mcp restart filesystem-server

# Stop all MCP servers
ax mcp stop --all
```

---

## Workflow Execution

### Create Workflow Spec

```yaml
# workflow.ax.yaml
metadata:
  id: user-auth-system
  name: User Authentication System
  version: 1.0.0

actors:
  - id: backend
    agent: backend
    description: Implement JWT authentication API
    provider: gemini-cli  # Cost-efficient for implementation

  - id: security
    agent: security
    description: Audit authentication implementation
    provider: claude-code  # Best reasoning for security

  - id: quality
    agent: quality
    description: Generate comprehensive test suite
    provider: gemini-cli  # Fast test generation

dependencies:
  - backend → security  # Security audits after implementation
  - security → quality  # Tests after security review

policies:
  retry:
    maxAttempts: 3
    backoff: exponential

  budget:
    maxTokens: 100000
    maxTokensPerStep: 30000
```

### Generate Execution Plan

```bash
# Generate plan from spec
ax gen plan workflow.ax.yaml

# Output:
# ✓ Loaded workflow spec: user-auth-system
# ✓ Validated 3 actors, 2 dependencies
# ✓ Generated execution plan:
#   Step 1: backend (provider: gemini-cli, est. 15-20 min)
#   Step 2: security (provider: claude-code, est. 10-15 min)
#   Step 3: quality (provider: gemini-cli, est. 10-12 min)
# ✓ Total estimated time: 35-47 minutes
# ✓ Total estimated tokens: 85,000-95,000

# Save plan to file
ax gen plan workflow.ax.yaml --output plan.json
```

### Generate DAG Visualization

```bash
# Generate dependency graph
ax gen dag workflow.ax.yaml

# Output: Mermaid diagram
# graph TD
#   backend[Backend: Implement JWT]
#   security[Security: Audit Implementation]
#   quality[Quality: Test Suite]
#   backend --> security
#   security --> quality

# Save to file
ax gen dag workflow.ax.yaml --output dag.mermaid
```

### Execute Workflow

```bash
# Execute workflow
ax spec run workflow.ax.yaml

# Execute with parallelization (where possible)
ax spec run workflow.ax.yaml --parallel

# Execute with custom budget
ax spec run workflow.ax.yaml --max-tokens 200000

# Execute with streaming output
ax spec run workflow.ax.yaml --streaming
```

### Check Workflow Status

```bash
# View workflow execution status
ax spec status workflow.ax.yaml

# Output:
# Workflow: user-auth-system (v1.0.0)
# Status: running
# Progress: 2/3 steps complete (66%)
#
# Steps:
#   ✓ backend - Complete (18m 32s, 28,456 tokens)
#   ✓ security - Complete (12m 15s, 19,234 tokens)
#   ⏳ quality - Running (5m 10s elapsed)
#
# Total tokens used: 47,690 / 100,000 (48%)
```

---

## Advanced Configuration

### Provider Configuration

```json
// ax.config.json
{
  "providers": {
    "default": "claude-code",

    "claude-code": {
      "enabled": true,
      "priority": 1,
      "timeout": 120000,
      "retries": 3,
      "useCases": ["complex reasoning", "architecture", "security"]
    },

    "gemini-cli": {
      "enabled": true,
      "priority": 2,
      "timeout": 90000,
      "retries": 3,
      "useCases": ["code generation", "refactoring", "tests"]
    },

    "openai": {
      "enabled": true,
      "priority": 3,
      "timeout": 60000,
      "retries": 3,
      "useCases": ["quick questions", "documentation"]
    }
  },

  "router": {
    "enableAutomaticFallback": true,
    "healthCheckInterval": 60000,
    "taskRouting": {
      "backend": "gemini-cli",
      "frontend": "gemini-cli",
      "security": "claude-code",
      "quality": "gemini-cli",
      "architecture": "claude-code",
      "product": "claude-code"
    }
  }
}
```

### Memory Configuration

```json
{
  "memory": {
    "enabled": true,
    "maxEntries": 10000,
    "persistencePath": ".automatosx/memory",
    "autoCleanup": true,
    "cleanupStrategy": "hybrid",
    "searchLimit": 10,
    "encryption": {
      "enabled": false,
      "algorithm": "aes-256-gcm"
    }
  }
}
```

### Execution Configuration

```json
{
  "execution": {
    "defaultTimeout": 1500000,
    "maxRetries": 3,
    "retryBackoff": "exponential",
    "concurrency": {
      "maxConcurrentAgents": 4,
      "queueStrategy": "priority"
    },
    "budget": {
      "maxTotalTokens": 1000000,
      "maxTokensPerIteration": 100000,
      "warnAtPercent": 75
    }
  }
}
```

---

## Debugging & Diagnostics

### Debug Mode

```bash
# Run with debug output
ax --debug run backend "task"

# Output includes:
# - Configuration loading
# - Provider selection logic
# - Memory queries
# - Token usage
# - Execution timing
# - Error stack traces
```

### Diagnostic Checks

```bash
# Run system diagnostics
ax doctor

# Output:
# ✓ Node.js version: 24.11.1 (OK)
# ✓ AutomatosX version: 9.2.3 (OK)
# ✓ Database: .automatosx/memory/memories.db (OK)
# ✓ Configuration: ax.config.json (OK)
# ✓ Providers:
#   ✓ claude-code (available)
#   ✓ gemini-cli (available)
#   ✗ openai (not installed)
# ✓ MCP servers: 2 running, 0 stopped
# ⚠ Warnings:
#   - Memory database is 450MB (consider cleanup)

# Check specific provider
ax doctor claude-code

# Output includes:
# - CLI executable location
# - Version information
# - Authentication status
# - Configuration validation
```

### Performance Profiling

```bash
# Profile task execution
ax run backend "task" --profile

# Output:
# ✓ Task complete (18.5s total)
#
# Performance breakdown:
#   Configuration load: 125ms (0.7%)
#   Memory search: 8ms (0.04%)
#   Provider selection: 45ms (0.2%)
#   Execution: 17,850ms (96.5%)
#   Memory save: 350ms (1.9%)
#   Trace logging: 122ms (0.7%)
```

### Cache Management

```bash
# View cache statistics
ax cache stats

# Output:
# Provider availability cache: 15 entries, 2.3 KB
# Profile cache: 20 entries, 45.6 KB
# Team cache: 5 entries, 12.1 KB
# Total cache size: 59.9 KB

# Clear all caches
ax cache clear

# Clear specific cache
ax cache clear --type provider
ax cache clear --type profile
```

---

## Environment Variables

### Core Settings

```bash
# Verbosity control
export AUTOMATOSX_VERBOSITY=0  # Quiet (for AI assistants)
export AUTOMATOSX_VERBOSITY=1  # Normal (default)
export AUTOMATOSX_VERBOSITY=2  # Verbose (debugging)

# Log level control
export AUTOMATOSX_LOG_LEVEL=error  # Minimal
export AUTOMATOSX_LOG_LEVEL=warn   # Default
export AUTOMATOSX_LOG_LEVEL=info   # Verbose
export AUTOMATOSX_LOG_LEVEL=debug  # Maximum

# Offline mode
export AUTOMATOSX_OFFLINE_MODE=true

# Mock providers (for testing)
export AX_MOCK_PROVIDERS=true
```

### Provider Configuration

```bash
# Default provider
export AUTOMATOSX_PROVIDER=gemini-cli

# Provider timeouts
export AUTOMATOSX_CLAUDE_TIMEOUT=120000
export AUTOMATOSX_GEMINI_TIMEOUT=90000

# Token budgets
export AUTOMATOSX_MAX_TOKENS=100000
export AUTOMATOSX_MAX_TOKENS_PER_ITERATION=10000
```

### Memory Configuration

```bash
# Memory database path
export AUTOMATOSX_MEMORY_PATH=/custom/path/to/memory.db

# Disable memory
export AUTOMATOSX_MEMORY_ENABLED=false

# Memory encryption
export AUTOMATOSX_MEMORY_ENCRYPTION=true
export AUTOMATOSX_MEMORY_ENCRYPTION_KEY=your-encryption-key
```

---

## Quick Reference

### Most Common Commands

```bash
# Run agent
ax run <agent> "task"

# Search memory
ax memory search "keyword"

# List providers
ax providers list

# View trace logs
ax providers trace --follow

# Start MCP server
ax mcp server

# Run workflow
ax spec run workflow.ax.yaml

# System diagnostics
ax doctor
```

### Most Useful Flags

```bash
--provider <name>          # Force specific provider
--streaming                # Real-time output
--quiet                    # Minimal output
--verbose                  # Debug output
--no-memory                # Disable memory
--save-to-memory           # Force save to memory
--timeout <ms>             # Custom timeout
--iterate                  # Multi-iteration mode
--iterate-max-tokens <n>   # Token budget
--parallel                 # Parallel execution
--profile                  # Performance profiling
```

---

## Need Help?

**This document is for advanced users (5%).** If you're looking for the natural language interface (recommended for 95% of users), see:

- [README.md](../README.md) - Main documentation with natural language examples
- [docs/guides/claude-code-integration.md](guides/claude-code-integration.md) - Using with Claude Code
- [docs/guides/codex-integration.md](guides/codex-integration.md) - Using with OpenAI Codex

**Support**:
- Issues: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- Email: <support@defai.digital>
