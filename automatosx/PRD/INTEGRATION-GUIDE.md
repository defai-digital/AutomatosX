# AutomatosX Integration Guide

**Complete guide to using the three core systems together**

**Version:** 8.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [System Architecture](#system-architecture)
4. [Configuration](#configuration)
5. [Usage Patterns](#usage-patterns)
6. [Examples](#examples)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

AutomatosX provides three integrated systems that work together seamlessly:

1. **AI Agent System** - 21 specialized agents for different tasks
2. **Multi-Provider Integration** - Claude, Gemini, OpenAI with automatic fallback
3. **Workflow Orchestration** - ReScript state machines with checkpointing

### When to Use Each System

**Use Agents Directly** when you need:
- Single-task execution
- Dynamic agent selection based on task
- Agent-to-agent collaboration
- Real-time agent responses

**Use Workflows** when you need:
- Multi-step processes
- Dependency management
- Checkpoint/resume capability
- Parallel execution
- Long-running tasks

**Use Provider Router** when you need:
- Direct AI model access
- Custom provider selection
- Fallback handling
- Provider health monitoring

---

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Basic Setup

```typescript
import { AgentRegistry } from './src/agents/AgentRegistry.js';
import { ProviderRouterV2 } from './src/services/ProviderRouterV2.js';
import { WorkflowEngineV2 } from './src/services/WorkflowEngineV2.js';
import { getDatabase } from './src/database/connection.js';

// Initialize core systems
const db = getDatabase();
const registry = new AgentRegistry();
const router = new ProviderRouterV2({
  providers: {
    claude: {
      enabled: true,
      priority: 1,
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 3,
      timeout: 60000,
    }
  }
});
const engine = new WorkflowEngineV2(db);

// Register agents
import { BackendAgent } from './src/agents/BackendAgent.js';
registry.register(new BackendAgent(router, db));

// Execute workflow
const result = await engine.executeWorkflowFromFile('workflows/cicd-pipeline.yaml');
```

### Environment Variables

Create `.env` file:

```bash
# AI Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
OPENAI_API_KEY=sk-proj-...

# Database
DATABASE_PATH=./.automatosx/db/automatosx.db

# Logging
LOG_LEVEL=info

# Optional
NODE_ENV=production
ENABLE_TELEMETRY=true
```

---

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│  (CLI, API, Web UI)                                         │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┴───────────┬─────────────────────────┐
    │                       │                         │
    ▼                       ▼                         ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Workflow        │  │  Agent           │  │  Provider        │
│  Engine          │──│  Registry        │──│  Router          │
│  (Orchestration) │  │  (21 Agents)     │  │  (Multi-AI)      │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         └─────────────────────┴──────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  ReScript Core   │
                    │  (State Machines)│
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │  SQLite Database │
                    │  (Persistence)   │
                    └──────────────────┘
```

### Data Flow

**1. Workflow Execution:**
```
YAML/JSON → WorkflowParser → WorkflowEngine → ReScript StateMachine
                                    ↓
                              AgentRegistry
                                    ↓
                            Selected Agent(s)
                                    ↓
                             ProviderRouter
                                    ↓
                          AI Provider (Claude/Gemini/OpenAI)
```

**2. Agent Task Execution:**
```
Task → AgentRuntime → Agent.canHandle() → Agent.execute()
                                              ↓
                                        ProviderRouter
                                              ↓
                                         AI Provider
```

**3. Provider Fallback:**
```
Request → Primary Provider → (failure) → Retry
                                            ↓
                                        (all retries failed)
                                            ↓
                                    Fallback Provider → (failure) → Retry
                                                                      ↓
                                                          Next Fallback...
```

---

## Configuration

### Provider Configuration

**File: `automatosx.config.json`**

```json
{
  "providers": {
    "claude": {
      "enabled": true,
      "priority": 1,
      "defaultModel": "claude-sonnet-4-5-20250929",
      "maxRetries": 3,
      "timeout": 60000,
      "rateLimitPerMinute": 50
    },
    "gemini": {
      "enabled": true,
      "priority": 2,
      "defaultModel": "gemini-2.0-flash-exp",
      "maxRetries": 3,
      "timeout": 60000,
      "rateLimitPerMinute": 60
    },
    "openai": {
      "enabled": true,
      "priority": 3,
      "defaultModel": "gpt-4o",
      "maxRetries": 2,
      "timeout": 60000,
      "rateLimitPerMinute": 50
    }
  },
  "workflow": {
    "checkpointInterval": 5000,
    "maxConcurrentSteps": 5,
    "enableCache": true,
    "cacheTTL": 3600000
  },
  "agents": {
    "defaultTimeout": 30000,
    "enableTelemetry": true,
    "maxRetries": 2
  }
}
```

### Agent Configuration

Agents can be configured individually:

```typescript
const agent = new BackendAgent(router, db, {
  timeout: 45000,
  maxRetries: 3,
  preferredProviders: ['claude', 'gemini'],
  toolsEnabled: ['bash', 'file', 'code-intelligence'],
});
```

### Workflow Configuration

Workflows can override global settings:

```yaml
name: my-workflow
version: 1.0.0

# Workflow-level config
config:
  checkpointInterval: 10000
  maxParallelSteps: 10
  timeout: 300000

steps:
  - key: step1
    # Step-level overrides
    timeout: 60000
    retries: 5
```

---

## Usage Patterns

### Pattern 1: Single Agent Execution

**When to use:** Simple, one-off tasks that don't require orchestration.

```typescript
import { AgentRuntime } from './src/agents/AgentRuntime.js';
import { SecurityAgent } from './src/agents/SecurityAgent.js';

const runtime = new AgentRuntime(registry, router, db);

const task = {
  id: 'task-1',
  type: 'code-analysis',
  description: 'Scan for security vulnerabilities',
  context: { repositoryPath: './src' },
  assignedAgent: 'security',
  priority: 1,
  createdAt: Date.now(),
};

const result = await runtime.executeTask(task);
console.log(`Found ${result.result.vulnerabilities.length} vulnerabilities`);
```

### Pattern 2: Agent Collaboration

**When to use:** Multiple agents need to work together without formal workflow.

```typescript
const runtime = new AgentRuntime(registry, router, db);

// Primary task
const reviewTask = {
  id: 'task-1',
  type: 'code-review',
  description: 'Comprehensive code review',
  context: { repositoryPath: './src' },
  assignedAgent: 'quality',
  priority: 1,
  createdAt: Date.now(),
};

// QualityAgent delegates to SecurityAgent and ArchitectAgent
const result = await runtime.executeTask(reviewTask);

// Result includes findings from all agents
console.log(result.result.delegatedTasks); // SecurityAgent, ArchitectAgent results
```

### Pattern 3: Simple Workflow

**When to use:** Multi-step process with dependencies.

```typescript
const workflow: WorkflowDefinition = {
  name: 'simple-review',
  steps: [
    { key: 'lint', agent: 'quality', action: 'lint' },
    { key: 'test', agent: 'testing', action: 'test', dependsOn: ['lint'] },
    { key: 'report', agent: 'writer', action: 'report', dependsOn: ['test'] },
  ],
};

const result = await engine.executeWorkflow(workflow);
```

### Pattern 4: Complex Workflow with Checkpoints

**When to use:** Long-running workflow that needs to be resumable.

```yaml
name: long-running-workflow
steps:
  # Stage 1: Analysis (parallel)
  - key: step1
    agent: quality
  - key: step2
    agent: security

  # Checkpoint created here automatically

  # Stage 2: Build (depends on stage 1)
  - key: step3
    agent: devops
    dependsOn: [step1, step2]

  # Checkpoint created here

  # Stage 3: Deploy
  - key: step4
    agent: devops
    dependsOn: [step3]
```

```typescript
// Execute
const result = await engine.executeWorkflow(workflow);

// If it fails, resume from last checkpoint
const checkpointId = getLastCheckpointId(result.executionId);
const resumed = await engine.resumeWorkflow(checkpointId);
```

### Pattern 5: Provider Fallback Testing

**When to use:** Testing provider resilience.

```typescript
// Enable chaos mode to simulate failures
const router = new ProviderRouterV2({
  providers: { /* ... */ },
  chaosMode: true, // 30% random failure rate
});

// Monitor events
router.on('error', ({ provider, error }) => {
  console.log(`${provider} failed: ${error.message}`);
});

router.on('success', ({ provider }) => {
  console.log(`${provider} succeeded after fallback`);
});

// Execute - will automatically fallback on failures
const result = await router.request({
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### Pattern 6: Custom Agent Implementation

**When to use:** Need specialized agent for domain-specific tasks.

```typescript
import { AgentBase } from './src/agents/AgentBase.js';

export class CustomAgent extends AgentBase {
  getMetadata() {
    return {
      type: 'custom',
      name: 'Custom Agent',
      description: 'Handles custom domain tasks',
      version: '1.0.0',
      capabilities: [
        {
          name: 'Custom Analysis',
          confidence: 0.95,
          keywords: ['custom', 'domain-specific'],
        },
      ],
      specializations: ['custom-domain'],
      tools: ['bash', 'file'],
      preferredProviders: ['claude'],
    };
  }

  canHandle(task: Task): number {
    if (task.type === 'custom-analysis') return 0.95;
    if (task.description.includes('custom')) return 0.7;
    return 0;
  }

  async execute(task: Task): Promise<TaskResult> {
    // Custom implementation
    const prompt = this.buildPrompt(task);
    const response = await this.providerRouter.request({
      messages: [{ role: 'user', content: prompt }],
    });

    return {
      taskId: task.id,
      success: true,
      result: this.parseResponse(response.content),
      duration: 0,
    };
  }
}

// Register custom agent
registry.register(new CustomAgent(router, db));
```

---

## Examples

### Example 1: Multi-Agent Code Review

**Goal:** Security, Quality, and Architecture agents collaborate on code review.

**File:** `examples/01-multi-agent-collaboration.ts`

```bash
npm run build
node examples/01-multi-agent-collaboration.ts
```

**What it demonstrates:**
- Agent registration and discovery
- Task routing to appropriate agents
- Provider selection and usage
- Result aggregation

### Example 2: Workflow with Fallback

**Goal:** Show automatic provider fallback during workflow execution.

**File:** `examples/02-workflow-with-fallback.ts`

```bash
# Normal mode
node examples/02-workflow-with-fallback.ts

# Chaos mode (simulates random failures)
CHAOS_MODE=true node examples/02-workflow-with-fallback.ts
```

**What it demonstrates:**
- Workflow definition and execution
- Automatic provider fallback
- Checkpoint creation
- Health monitoring

### Example 3: CI/CD Pipeline

**Goal:** Complete CI/CD pipeline with 15+ steps.

**File:** `workflows/cicd-pipeline.yaml`

```bash
ax workflow execute workflows/cicd-pipeline.yaml \
  --context '{"repository": "./", "branch": "main"}'
```

**What it demonstrates:**
- Multi-stage workflow (10 stages)
- Parallel and sequential execution
- Multiple agents (Security, Testing, DevOps, Quality)
- Error handling (continueOnError flags)

### Example 4: Technical Debt Analysis

**Goal:** Comprehensive tech debt analysis with prioritization.

**File:** `workflows/tech-debt-analysis.yaml`

```bash
ax workflow execute workflows/tech-debt-analysis.yaml \
  --context '{"repository": "./", "targetVersion": "2.0.0"}'
```

**What it demonstrates:**
- Complex dependency graph (10 stages)
- Multi-agent collaboration (12+ agents)
- Report generation
- Executive summary creation

---

## Production Deployment

### Infrastructure Requirements

**Minimum:**
- 2 CPU cores
- 4GB RAM
- 10GB disk space
- Node.js 18+

**Recommended (for 100 concurrent workflows):**
- 8 CPU cores
- 16GB RAM
- 50GB SSD
- Redis for caching
- PostgreSQL (alternative to SQLite)

### Deployment Architecture

```
┌─────────────────────┐
│  Load Balancer      │
│  (nginx/ALB)        │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐   ┌─────────┐
│ API     │   │ API     │
│ Server 1│   │ Server 2│
└────┬────┘   └────┬────┘
     │             │
     └──────┬──────┘
            │
            ▼
    ┌───────────────┐
    │  Queue        │
    │  (Redis/NATS) │
    └───────┬───────┘
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
┌──────────┐    ┌──────────┐
│ Worker 1 │    │ Worker 2 │
└────┬─────┘    └────┬─────┘
     │               │
     └───────┬───────┘
             │
             ▼
     ┌────────────┐
     │  Database  │
     └────────────┘
```

### Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy built files
COPY dist/ ./dist/
COPY workflows/ ./workflows/

# Environment
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/automatosx.db

# Expose ports
EXPOSE 3000

# Run
CMD ["node", "dist/cli/index.js", "server"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./data:/data
    depends_on:
      - redis

  worker:
    build: .
    command: node dist/workers/workflow-worker.js
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./data:/data
    depends_on:
      - redis
    deploy:
      replicas: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

### Kubernetes Deployment

**k8s/deployment.yaml:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: automatosx-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: automatosx-api
  template:
    metadata:
      labels:
        app: automatosx-api
    spec:
      containers:
      - name: api
        image: automatosx:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-providers
              key: anthropic-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: automatosx-api
spec:
  selector:
    app: automatosx-api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Monitoring & Observability

**Metrics to Track:**

```typescript
// Custom metrics collection
import { MetricsCollector } from './src/services/MetricsCollector.js';

const metrics = new MetricsCollector();

// Workflow metrics
metrics.recordWorkflowExecution(executionId, duration, status);
metrics.recordStepExecution(stepKey, duration, status);

// Agent metrics
metrics.recordAgentTask(agentType, taskType, duration, success);

// Provider metrics
metrics.recordProviderRequest(provider, model, latency, tokensUsed);

// Export to Prometheus
app.get('/metrics', (req, res) => {
  res.send(metrics.exportPrometheus());
});
```

**Grafana Dashboard:** (see `docs/grafana-dashboard.json`)

---

## Troubleshooting

### Common Issues

#### 1. Provider Authentication Errors

**Symptom:** `ProviderAuthError: Invalid API key`

**Solution:**
```bash
# Check API keys are set
echo $ANTHROPIC_API_KEY
echo $GOOGLE_API_KEY

# Test provider connectivity
ax provider test claude
ax provider test gemini
```

#### 2. Workflow Execution Stalls

**Symptom:** Workflow hangs indefinitely

**Solutions:**
- Check for circular dependencies in workflow YAML
- Verify all steps have proper `dependsOn` chains
- Enable debug logging: `LOG_LEVEL=debug ax workflow execute ...`
- Check checkpoint status: `ax workflow status <execution-id>`

#### 3. Agent Selection Fails

**Symptom:** `No suitable agent found for task`

**Solutions:**
- Verify agents are registered: `ax agent list`
- Check task type matches agent capabilities
- Lower minimum confidence threshold
- Add explicit `assignedAgent` to task

#### 4. Database Lock Errors

**Symptom:** `database is locked`

**Solutions:**
- Enable WAL mode (default in production)
- Reduce concurrent workflow execution
- Use PostgreSQL instead of SQLite for high-concurrency scenarios

#### 5. High Memory Usage

**Symptom:** Node.js process using excessive memory

**Solutions:**
- Enable workflow cache eviction
- Reduce `maxConcurrentSteps` in config
- Clear old workflow executions: `ax workflow cleanup --older-than 30d`
- Monitor with: `ax system stats --memory`

### Debug Mode

Enable verbose logging:

```bash
# Environment variable
export LOG_LEVEL=debug
export DEBUG=automatosx:*

# CLI flag
ax workflow execute --debug workflows/cicd-pipeline.yaml

# Programmatic
import { setLogLevel } from './src/utils/logger.js';
setLogLevel('debug');
```

### Health Checks

```bash
# System health
ax system health

# Provider health
ax provider health

# Agent health
ax agent health

# Database health
ax db health
```

---

## Best Practices

### 1. Workflow Design

✅ **DO:**
- Keep workflows modular (10-20 steps max)
- Use meaningful step keys
- Set appropriate timeouts
- Handle errors gracefully with `continueOnError`
- Create checkpoints at logical boundaries

❌ **DON'T:**
- Create circular dependencies
- Use overly long timeouts
- Ignore error handling
- Create monolithic workflows (>50 steps)

### 2. Agent Usage

✅ **DO:**
- Let agents auto-select when possible
- Use delegation for complex tasks
- Specify `assignedAgent` when necessary
- Monitor agent performance

❌ **DON'T:**
- Hard-code provider selection in agents
- Bypass the registry
- Share agent instances across threads

### 3. Provider Configuration

✅ **DO:**
- Configure multiple providers for fallback
- Set appropriate timeouts and retries
- Monitor provider health
- Use cost-effective models when possible

❌ **DON'T:**
- Rely on single provider
- Use excessively short timeouts
- Ignore rate limits
- Use expensive models for simple tasks

---

## Next Steps

1. **Try the Examples:** Run all examples in `examples/` directory
2. **Explore Workflows:** Review and modify workflows in `workflows/`
3. **Read Agent Docs:** See `docs/agent-development.md` for custom agents
4. **Production Checklist:** Review `docs/production-checklist.md`

## Support

- **Documentation:** `docs/`
- **Examples:** `examples/`
- **Workflows:** `workflows/`
- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions

---

**Last Updated:** January 11, 2025
**Version:** 8.0.0
