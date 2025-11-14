# AutomatosX v2 - P1 Core PRD (Optimized)

**Version**: 2.0 (Metathinking-Optimized)
**Status**: Ready for Execution
**Timeline**: 45 days (Conservative, High-Confidence)
**Scope**: Core P1 Features Only
**Created**: November 10, 2025

---

## Executive Summary

Based on deep metathinking analysis, this PRD focuses on **4 core P1 features** that deliver maximum value with minimal risk. We've removed Plugin SDK and ReScript State Machines to de-risk the timeline while still achieving all critical PRD goals.

**Strategic Decision**: Ship a solid P1 Core in 45 days, then evaluate P1.5 (extended features) based on user feedback.

---

## What Changed from Original P1?

### Removed from P1 Core

❌ **ReScript State Machines** → Defer to P1.5
- **Why removed**: High learning curve, TypeScript alternatives exist (XState)
- **Impact**: Minor (can use TypeScript state machines)
- **Saved**: 10 days

❌ **Plugin SDK** → Defer to P1.5
- **Why removed**: Security concerns (vm2 deprecated, need Deno), adoption timeline extends beyond P1
- **Impact**: Medium (delays ecosystem growth)
- **Saved**: 10 days

### Simplified in P1 Core

⚠️ **Workflow Authoring** → MVP only
- Removed: Parallel execution, conditional branches, loops
- Kept: Sequential workflows with dependencies, variable substitution
- **Saved**: 4 days

⚠️ **Observability** → Basic metrics and logs
- Removed: Full OpenTelemetry exporters, Jaeger, Grafana dashboards
- Kept: Structured logging, basic metrics, correlation IDs
- **Saved**: 2 days

### Kept Unchanged

✅ **Semantic Memory** → Full implementation
✅ **Agent Learning** → Full implementation

---

## Table of Contents

1. [P1 Core Features](#p1-core-features)
2. [Technical Specifications](#technical-specifications)
3. [Success Metrics](#success-metrics)
4. [Timeline](#timeline)
5. [Risk Management](#risk-management)

---

## P1 Core Features

### Feature 1: Semantic Memory (10 days)

**Goal**: Enable natural language code search using ML embeddings.

**Problem**:
```
CURRENT: ax find "getUserById" (exact match only)
DESIRED: ax semantic search "authentication logic" (concept-based)

USER STORY:
Developer: "I know there's JWT validation code somewhere..."
Current: Must grep for exact keywords ("jwt", "validate", "token")
With Semantic: Finds code by concept, even with different naming
```

**Solution Architecture**:
```
┌─────────────┐
│ User Query  │
└──────┬──────┘
       │ "find auth logic"
       ↓
┌──────────────────────┐
│ EmbeddingService     │
│ (@xenova/transformers│
│  all-MiniLM-L6-v2)   │
└──────┬───────────────┘
       │ [0.12, -0.43, ..., 0.87] (384 dims)
       ↓
┌───────────────────────┐
│ Vector Search (FAISS) │
│ Find top-K similar    │
└──────┬────────────────┘
       │ Top 20 results
       ↓
┌────────────────────────┐
│ Hybrid Ranking         │
│ (Semantic 70% +        │
│  BM25 30%)             │
└──────┬─────────────────┘
       │ Top 10 final results
       ↓
┌─────────────┐
│ User Sees   │
│ Ranked      │
│ Results     │
└─────────────┘
```

**Implementation Details**:

**1. Embedding Service**:
```typescript
// src/services/EmbeddingService.ts
import { pipeline } from '@xenova/transformers';

export class EmbeddingService {
  private model: any;
  private cache: LRUCache<string, Float32Array>;

  async initialize(): Promise<void> {
    // Load model (22MB download first time)
    this.model = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
    this.cache = new LRUCache({ max: 1000 });
  }

  async embed(text: string): Promise<Float32Array> {
    // Check cache first
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }

    // Generate embedding (384 dimensions)
    const output = await this.model(text, {
      pooling: 'mean',
      normalize: true
    });

    const embedding = output.data;
    this.cache.set(text, embedding);
    return embedding;
  }

  async batchEmbed(texts: string[], batchSize = 32): Promise<Float32Array[]> {
    // Process in batches for efficiency
    const results: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text))
      );
      results.push(...batchResults);
    }
    return results;
  }
}
```

**2. Vector Store (FAISS)**:
```typescript
// src/database/VectorStore.ts
import { IndexFlatIP } from 'faiss-node';

export class VectorStore {
  private index: IndexFlatIP;
  private metadata: Map<number, { id: string; type: string }>;

  constructor(dimensions = 384) {
    this.index = new IndexFlatIP(dimensions);
    this.metadata = new Map();
  }

  async addVectors(
    vectors: Float32Array[],
    ids: string[],
    types: string[]
  ): Promise<void> {
    // Add vectors to FAISS index
    this.index.add(vectors);

    // Store metadata
    const startIdx = this.index.ntotal() - vectors.length;
    for (let i = 0; i < vectors.length; i++) {
      this.metadata.set(startIdx + i, {
        id: ids[i],
        type: types[i]
      });
    }
  }

  async search(
    query: Float32Array,
    k = 20
  ): Promise<Array<{ id: string; score: number; type: string }>> {
    const { labels, distances } = this.index.search(query, k);

    return labels.map((label, idx) => ({
      id: this.metadata.get(label)!.id,
      type: this.metadata.get(label)!.type,
      score: distances[idx]
    }));
  }

  async save(path: string): Promise<void> {
    await this.index.write(path);
  }

  async load(path: string): Promise<void> {
    this.index = IndexFlatIP.read(path);
  }
}
```

**3. Hybrid Search**:
```typescript
// src/services/HybridSearch.ts
export class HybridSearch {
  constructor(
    private embedding: EmbeddingService,
    private vectorStore: VectorStore,
    private memoryService: MemoryService
  ) {}

  async search(
    query: string,
    options: { limit?: number; filters?: Filters } = {}
  ): Promise<SearchResult[]> {
    // 1. Semantic search (vector similarity)
    const queryEmbedding = await this.embedding.embed(query);
    const semanticResults = await this.vectorStore.search(
      queryEmbedding,
      20
    );

    // 2. Keyword search (BM25)
    const keywordResults = await this.memoryService.search(query, {
      limit: 20,
      ...options.filters
    });

    // 3. Reciprocal Rank Fusion (RRF)
    const combined = this.reciprocalRankFusion(
      semanticResults,
      keywordResults,
      { semanticWeight: 0.7, keywordWeight: 0.3 }
    );

    return combined.slice(0, options.limit || 10);
  }

  private reciprocalRankFusion(
    semantic: SearchResult[],
    keyword: SearchResult[],
    weights: { semanticWeight: number; keywordWeight: number }
  ): SearchResult[] {
    const scores = new Map<string, number>();

    // Score from semantic results (higher rank = better)
    semantic.forEach((result, idx) => {
      const rank = idx + 1;
      const score = weights.semanticWeight / (60 + rank);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    // Score from keyword results
    keyword.forEach((result, idx) => {
      const rank = idx + 1;
      const score = weights.keywordWeight / (60 + rank);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
    });

    // Combine and sort by score
    const combined = Array.from(scores.entries())
      .map(([id, score]) => ({
        id,
        score,
        // Merge metadata from both sources
        ...this.getMetadata(id, semantic, keyword)
      }))
      .sort((a, b) => b.score - a.score);

    return combined;
  }
}
```

**4. Database Schema**:
```sql
-- Migration 008: Add embeddings support
CREATE TABLE memory_embeddings (
  memory_id TEXT PRIMARY KEY REFERENCES memories(id),
  embedding BLOB NOT NULL,  -- 384 floats (1536 bytes)
  chunk_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memory_embeddings_created ON memory_embeddings(created_at);
CREATE INDEX idx_memory_embeddings_chunk ON memory_embeddings(chunk_index);

-- Trigger to keep embeddings in sync
CREATE TRIGGER sync_embeddings_on_memory_insert
AFTER INSERT ON memories
BEGIN
  -- Embedding will be generated asynchronously
  INSERT INTO embedding_queue (memory_id, operation)
  VALUES (NEW.id, 'create');
END;

CREATE TRIGGER sync_embeddings_on_memory_update
AFTER UPDATE ON memories
BEGIN
  INSERT INTO embedding_queue (memory_id, operation)
  VALUES (NEW.id, 'update');
END;

CREATE TABLE embedding_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id TEXT NOT NULL,
  operation TEXT NOT NULL,  -- 'create', 'update', 'delete'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);
```

**5. CLI Commands**:
```bash
# Semantic search
ax semantic search "authentication logic"
ax semantic search "database connection code" --lang typescript
ax semantic search "error handling patterns" --limit 20
ax semantic search "JWT validation" --agent security

# Reindex with embeddings
ax semantic reindex              # Reindex all memories
ax semantic reindex --incremental # Only new/updated memories
ax semantic status               # Show indexing progress
```

**Success Criteria**:
- ✅ Semantic search returns >80% relevant results in top-10
- ✅ Query latency <500ms (P95)
- ✅ Embedding generation <100ms per item
- ✅ Model loads in <5 seconds
- ✅ 90%+ test coverage

**Timeline**: 10 days (includes buffer)

---

### Feature 2: Workflow Authoring (8 days)

**Goal**: Enable users to define, save, and reuse multi-agent workflows via YAML.

**Problem**:
```
CURRENT STATE:
User: "Build auth system with DB, API, security, tests"
System: Executes successfully
User: "Do the same for payment system"
System: User must describe entire workflow again

DESIRED STATE:
User: Saves workflow as "microservice-template"
User: "Run microservice-template for payment system"
System: Executes saved workflow with new parameters
```

**Solution: YAML Workflow DSL**

**Example Workflow**:
```yaml
# .automatosx/workflows/microservice-template.yaml
name: "Build Production Microservice"
version: "1.0"
description: "Complete microservice with DB, API, security, tests, docs"

variables:
  service_name: "user-service"
  db_type: "PostgreSQL"
  api_port: 3000

steps:
  - id: database
    name: "Design Database Schema"
    agent: database
    input:
      description: "Design ${db_type} schema for ${service_name}"
      constraints:
        - "Use foreign keys for relationships"
        - "Include created_at/updated_at timestamps"
        - "Add indexes for common queries"
    timeout: 300  # 5 minutes

  - id: api
    name: "Implement API Endpoints"
    agent: api
    depends_on: [database]
    input:
      description: "Create REST API for ${service_name}"
      base_url: "http://localhost:${api_port}"
      schema: "{{outputs.database.schema}}"
      endpoints:
        - "GET /${service_name}"
        - "POST /${service_name}"
        - "PUT /${service_name}/:id"
        - "DELETE /${service_name}/:id"

  - id: security
    name: "Security Review"
    agent: security
    depends_on: [api]
    input:
      description: "Audit ${service_name} security"
      focus_areas:
        - "Input validation"
        - "SQL injection prevention"
        - "Authentication/Authorization"
        - "Rate limiting"

  - id: testing
    name: "Write Tests"
    agent: quality
    depends_on: [api]
    input:
      description: "Write tests for ${service_name}"
      coverage_threshold: 85
      test_types:
        - "Unit tests"
        - "Integration tests"
        - "API tests"

  - id: documentation
    name: "Write Documentation"
    agent: writer
    depends_on: [api, security]
    input:
      description: "Document ${service_name} API and deployment"
      sections:
        - "API Reference"
        - "Database Schema"
        - "Security Considerations"
        - "Deployment Guide"

retry_policy:
  max_attempts: 3
  backoff: exponential
  backoff_multiplier: 2
  backoff_initial: 1000  # 1 second

on_failure:
  action: abort  # Options: abort, continue, skip
  notify: true
```

**Implementation**:

**1. Workflow Parser**:
```typescript
// src/workflow/WorkflowParser.ts
import YAML from 'yaml';
import { z } from 'zod';

// Zod schema for validation
const WorkflowSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  variables: z.record(z.any()).optional(),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    agent: z.string(),
    depends_on: z.array(z.string()).optional(),
    input: z.record(z.any()),
    timeout: z.number().optional(),
  })),
  retry_policy: z.object({
    max_attempts: z.number(),
    backoff: z.enum(['fixed', 'exponential']),
    backoff_multiplier: z.number().optional(),
    backoff_initial: z.number().optional(),
  }).optional(),
  on_failure: z.object({
    action: z.enum(['abort', 'continue', 'skip']),
    notify: z.boolean().optional(),
  }).optional(),
});

export class WorkflowParser {
  async parse(yamlContent: string): Promise<Workflow> {
    // Parse YAML
    const parsed = YAML.parse(yamlContent);

    // Validate with Zod
    const workflow = WorkflowSchema.parse(parsed);

    // Validate dependencies (no cycles)
    this.validateDependencies(workflow);

    return workflow;
  }

  private validateDependencies(workflow: Workflow): void {
    const graph = new Map<string, string[]>();

    // Build dependency graph
    for (const step of workflow.steps) {
      graph.set(step.id, step.depends_on || []);
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const step of workflow.steps) {
      if (this.hasCycle(step.id, graph, visited, recursionStack)) {
        throw new Error(`Circular dependency detected involving step: ${step.id}`);
      }
    }
  }

  private hasCycle(
    node: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    visited.add(node);
    recursionStack.add(node);

    for (const dependency of graph.get(node) || []) {
      if (!visited.has(dependency)) {
        if (this.hasCycle(dependency, graph, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(dependency)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }
}
```

**2. Workflow Engine**:
```typescript
// src/workflow/WorkflowEngine.ts
export class WorkflowEngine {
  constructor(
    private registry: AgentRegistry,
    private parser: WorkflowParser
  ) {}

  async loadWorkflow(path: string): Promise<Workflow> {
    const content = await fs.readFile(path, 'utf-8');
    return this.parser.parse(content);
  }

  async executeWorkflow(
    workflow: Workflow,
    overrides?: Record<string, any>
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const context = this.createContext(workflow, overrides);

    // Resolve execution order (topological sort)
    const executionOrder = this.topologicalSort(workflow.steps);

    const results = new Map<string, TaskResult>();
    const errors: string[] = [];

    // Execute steps in order
    for (const step of executionOrder) {
      try {
        // Check if dependencies succeeded
        if (step.depends_on) {
          for (const depId of step.depends_on) {
            const depResult = results.get(depId);
            if (!depResult || !depResult.success) {
              throw new Error(`Dependency ${depId} failed or didn't execute`);
            }
          }
        }

        // Substitute variables and outputs
        const input = this.substituteVariables(
          step.input,
          context,
          results
        );

        // Get agent
        const agent = this.registry.getAgent(step.agent);
        if (!agent) {
          throw new Error(`Agent not found: ${step.agent}`);
        }

        // Create task
        const task: Task = {
          id: `${workflow.name}-${step.id}`,
          description: input.description || step.name,
          status: 'pending',
          priority: 'medium',
          createdAt: Date.now(),
        };

        // Execute with timeout
        const result = await this.executeWithRetry(
          agent,
          task,
          context,
          workflow.retry_policy,
          step.timeout
        );

        results.set(step.id, result);

        if (!result.success) {
          errors.push(`Step ${step.id} failed: ${result.message}`);

          if (workflow.on_failure?.action === 'abort') {
            break;
          }
        }
      } catch (error: any) {
        errors.push(`Step ${step.id} error: ${error.message}`);

        if (workflow.on_failure?.action === 'abort') {
          break;
        }
      }
    }

    return {
      success: errors.length === 0,
      workflow: workflow.name,
      steps: executionOrder.map(s => s.id),
      results: Object.fromEntries(results),
      errors,
      executionTime: Date.now() - startTime,
    };
  }

  private substituteVariables(
    input: any,
    context: WorkflowContext,
    results: Map<string, TaskResult>
  ): any {
    const json = JSON.stringify(input);

    // Replace ${variable}
    let substituted = json.replace(/\$\{(\w+)\}/g, (match, varName) => {
      return context.variables[varName] || match;
    });

    // Replace {{outputs.stepId.field}}
    substituted = substituted.replace(
      /\{\{outputs\.(\w+)\.(\w+)\}\}/g,
      (match, stepId, field) => {
        const result = results.get(stepId);
        if (result && result.data && typeof result.data === 'object') {
          return result.data[field] || match;
        }
        return match;
      }
    );

    return JSON.parse(substituted);
  }

  private async executeWithRetry(
    agent: AgentBase,
    task: Task,
    context: AgentContext,
    retryPolicy?: RetryPolicy,
    timeout?: number
  ): Promise<TaskResult> {
    const maxAttempts = retryPolicy?.max_attempts || 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute with timeout
        const result = timeout
          ? await Promise.race([
              agent.execute(task, context),
              this.timeoutPromise(timeout)
            ])
          : await agent.execute(task, context);

        if (result.success) {
          return result;
        }

        lastError = new Error(result.message || 'Task failed');
      } catch (error: any) {
        lastError = error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxAttempts && retryPolicy) {
        const delay = this.calculateBackoff(
          attempt,
          retryPolicy
        );
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      message: `Failed after ${maxAttempts} attempts: ${lastError?.message}`
    };
  }
}
```

**3. CLI Commands**:
```bash
# Workflow management
ax workflow list                             # List saved workflows
ax workflow create microservice-template     # Interactive wizard
ax workflow validate microservice.yaml       # Validate workflow
ax workflow run microservice-template        # Execute workflow
ax workflow run microservice-template \
  --var service_name=payment \
  --var api_port=3001                        # Override variables
ax workflow status <execution-id>            # Check execution status
ax workflow logs <execution-id>              # View execution logs
```

**Success Criteria**:
- ✅ Users can define workflows in YAML
- ✅ Workflow validation catches errors before execution
- ✅ Variable substitution works (${var} and {{outputs}})
- ✅ Dependencies execute in correct order
- ✅ Retry logic works with exponential backoff
- ✅ 90%+ test coverage

**Timeline**: 8 days (includes buffer)

---

### Feature 3: Observability MVP (5 days)

**Goal**: Enable debugging and monitoring with structured logging and basic metrics.

**What We're Building** (MVP Only):

**1. Structured Logging with Correlation IDs**:
```typescript
// src/telemetry/LoggingService.ts
export class LoggingService {
  private correlationId: string | null = null;

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      ...context
    };

    // Write structured JSON
    console.log(JSON.stringify(entry));

    // Also write to file for later analysis
    this.writeToFile(entry);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
}
```

**2. Basic Metrics**:
```typescript
// src/telemetry/MetricsService.ts
export class MetricsService {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  increment(metric: string, value = 1, labels?: Labels): void {
    const key = this.buildKey(metric, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  gauge(metric: string, value: number, labels?: Labels): void {
    const key = this.buildKey(metric, labels);
    this.gauges.set(key, value);
  }

  histogram(metric: string, value: number, labels?: Labels): void {
    const key = this.buildKey(metric, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  getMetrics(): MetricsSummary {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, values]) => [
          key,
          this.calculateHistogramStats(values)
        ])
      )
    };
  }
}
```

**3. Key Metrics to Track**:
```
PERFORMANCE:
- ax.query.latency (histogram)
- ax.index.throughput (counter)
- ax.cache.hit_rate (gauge)

AGENTS:
- ax.agent.executions (counter by agent + success/failure)
- ax.agent.latency (histogram by agent)
- ax.workflow.executions (counter by workflow + status)

RESOURCES:
- ax.memory.usage (gauge)
- ax.database.connections (gauge)
- ax.embedding.queue_size (gauge)
```

**4. Simple Trace Output**:
```typescript
// Trace to console or file (no distributed tracing yet)
export class TraceService {
  private traces: Trace[] = [];

  startTrace(name: string, attributes?: Attributes): Trace {
    const trace: Trace = {
      id: generateId(),
      name,
      startTime: Date.now(),
      attributes: attributes || {}
    };
    this.traces.push(trace);
    return trace;
  }

  endTrace(trace: Trace): void {
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;

    // Log trace
    logger.info('Trace completed', {
      traceId: trace.id,
      name: trace.name,
      duration: trace.duration,
      ...trace.attributes
    });
  }
}
```

**Success Criteria**:
- ✅ All operations log with correlation IDs
- ✅ Basic metrics tracked (10+ key metrics)
- ✅ Metrics accessible via `ax metrics` command
- ✅ Logs written to file for analysis
- ✅ <1% performance overhead

**Timeline**: 5 days (includes buffer)

**What's Deferred to P1.5**:
- OpenTelemetry exporters (OTLP)
- Jaeger integration
- Grafana dashboards
- Distributed tracing
- Production alerting

---

### Feature 4: Agent Learning (10 days)

**Goal**: Agents learn from execution history to improve suggestions and reduce errors.

**How It Works**:

```
EXECUTION → Memory Storage → Pattern Analysis → Suggestions

EXAMPLE:
User: "Create REST API"
SecurityAgent: Suggests HTTP Basic auth
User: Manually changes to JWT
System: Stores this pattern

Next time:
User: "Create REST API"
SecurityAgent: "Based on past executions, JWT is recommended (85% success rate)"
```

**Implementation**:

**1. Execution History Analysis**:
```typescript
// src/agents/learning/LearningService.ts
export class AgentLearningService {
  async analyzePerformance(
    agentType: string,
    timeWindow?: { from: Date; to: Date }
  ): Promise<PerformanceReport> {
    // Query memory for past executions
    const executions = await this.memory.search({
      filters: {
        agent: agentType,
        dateFrom: timeWindow?.from,
        dateTo: timeWindow?.to
      },
      limit: 1000
    });

    // Calculate metrics
    const total = executions.length;
    const successful = executions.filter(e => e.success).length;
    const failed = executions.filter(e => !e.success).length;
    const successRate = total > 0 ? successful / total : 0;

    // Analyze execution times
    const times = executions.map(e => e.executionTime);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const medianTime = this.median(times);

    // Find common keywords in successful tasks
    const successfulKeywords = this.extractTopKeywords(
      executions.filter(e => e.success)
    );

    // Find common failure patterns
    const failurePatterns = this.detectFailurePatterns(
      executions.filter(e => !e.success)
    );

    return {
      agent: agentType,
      timeWindow,
      totalExecutions: total,
      successRate,
      avgExecutionTime: avgTime,
      medianExecutionTime: medianTime,
      topSuccessKeywords: successfulKeywords,
      commonFailures: failurePatterns,
      recommendations: this.generateRecommendations(executions)
    };
  }

  private detectFailurePatterns(
    failures: Execution[]
  ): FailurePattern[] {
    // Group by error message
    const errorGroups = new Map<string, Execution[]>();

    for (const failure of failures) {
      const errorKey = this.normalizeError(failure.error);
      const group = errorGroups.get(errorKey) || [];
      group.push(failure);
      errorGroups.set(errorKey, group);
    }

    // Sort by frequency
    const patterns = Array.from(errorGroups.entries())
      .map(([error, execs]) => ({
        error,
        count: execs.length,
        percentage: (execs.length / failures.length) * 100,
        examples: execs.slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count);

    return patterns;
  }
}
```

**2. Suggestion Engine**:
```typescript
// src/agents/learning/SuggestionEngine.ts
export class SuggestionEngine {
  async getSuggestionsForTask(
    task: Task
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // 1. Find similar past tasks (semantic search)
    const similar = await this.findSimilarTasks(task, 20);

    // 2. Analyze which agents succeeded most
    const agentStats = this.analyzeAgentSuccess(similar);

    if (agentStats.length > 0) {
      const best = agentStats[0];
      suggestions.push({
        type: 'agent',
        title: `Recommended Agent: @${best.agent}`,
        reason: `Based on ${similar.length} similar tasks, @${best.agent} has ${(best.successRate * 100).toFixed(0)}% success rate`,
        confidence: best.confidence,
        action: `ax run @${best.agent} "${task.description}"`
      });
    }

    // 3. Suggest workflow if task is complex
    if (this.isComplexTask(task)) {
      const matchingWorkflows = await this.findMatchingWorkflows(task);

      if (matchingWorkflows.length > 0) {
        suggestions.push({
          type: 'workflow',
          title: `Use Workflow: ${matchingWorkflows[0].name}`,
          reason: `This task matches the "${matchingWorkflows[0].name}" workflow pattern`,
          confidence: matchingWorkflows[0].matchScore,
          action: `ax workflow run ${matchingWorkflows[0].id}`
        });
      }
    }

    // 4. Suggest context to include
    const contextSuggestions = await this.suggestContext(task, similar);

    if (contextSuggestions.length > 0) {
      suggestions.push({
        type: 'context',
        title: 'Include Context',
        reason: `Similar tasks benefited from: ${contextSuggestions.join(', ')}`,
        confidence: 0.7,
        items: contextSuggestions
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private async findSimilarTasks(
    task: Task,
    limit: number
  ): Promise<Execution[]> {
    // Use semantic search to find similar tasks
    const results = await this.hybridSearch.search(
      task.description,
      { limit, filters: { type: 'execution' } }
    );

    return results.map(r => r.data as Execution);
  }

  private analyzeAgentSuccess(
    executions: Execution[]
  ): Array<{ agent: string; successRate: number; confidence: number }> {
    const agentGroups = new Map<string, Execution[]>();

    // Group by agent
    for (const exec of executions) {
      const group = agentGroups.get(exec.agent) || [];
      group.push(exec);
      agentGroups.set(exec.agent, group);
    }

    // Calculate success rates
    const stats = Array.from(agentGroups.entries())
      .map(([agent, execs]) => ({
        agent,
        successRate: execs.filter(e => e.success).length / execs.length,
        sampleSize: execs.length,
        confidence: Math.min(execs.length / 10, 1.0) // More samples = higher confidence
      }))
      .filter(s => s.sampleSize >= 3) // Need at least 3 samples
      .sort((a, b) => b.successRate - a.successRate);

    return stats;
  }
}
```

**3. CLI Integration**:
```bash
# Agent learning commands
ax agent analyze backend              # Show performance report
ax agent suggest "create REST API"    # Get suggestions
ax learn report                       # Overall learning report
ax learn export                       # Export learned patterns
```

**4. Proactive Suggestions in `ax run`**:
```typescript
// When user runs: ax run "create API"
// Before execution, show suggestions:

Suggestions based on similar past tasks:
✓ Recommended Agent: @api
  85% success rate based on 47 similar tasks

✓ Use Workflow: microservice-template
  This task matches the "Build Production Microservice" workflow

✓ Include Context:
  Similar tasks benefited from: authentication requirements, database schema

Proceed with execution? (Y/n)
```

**Success Criteria**:
- ✅ Agents track success rate by task type
- ✅ Suggestions improve accuracy by 15%+
- ✅ Failure rate decreases by 10%+ with learning
- ✅ Proactive suggestions in `ax run`
- ✅ 90%+ test coverage

**Timeline**: 10 days (includes buffer)

---

## Success Metrics

### PRD Goals Achievement

**Goal 1: 30% faster issue triage** ✅
- **Dependencies**: Semantic search + Agent learning
- **How**: Semantic search finds code faster, learning suggests best approach
- **Measurement**: Time from "issue reported" to "root cause found"

**Goal 2: 25% increase in workflow reuse** ✅
- **Dependencies**: Workflow authoring
- **How**: Users save successful workflows, reuse for similar tasks
- **Measurement**: % of workflow executions that are saved workflows

**Goal 3: Memory recall precision >85%** ✅
- **Dependencies**: Semantic search + Hybrid ranking
- **How**: Semantic + BM25 combination improves relevance
- **Measurement**: Top-10 precision in search results

**Goal 4: First external plugin published** ❌ DEFERRED
- **Status**: Moved to P1.5 (Plugin SDK not in Core P1)
- **Mitigation**: Plugin SDK will be added in P1.5 based on user feedback

**Goal 5: ≥10 community plugins within 90 days** ❌ OUT OF SCOPE
- **Status**: This is a P2 goal (requires adoption time beyond P1)
- **Mitigation**: Clarify that P1 focuses on foundation, P2 on ecosystem

### Technical Metrics

**Performance**:
- Semantic search latency: <500ms (P95)
- Workflow execution: Deterministic and resumable
- Observability overhead: <1% CPU/memory
- Agent learning: 15%+ accuracy improvement

**Quality**:
- Test coverage: ≥88% overall
- Total tests: ~420 (P0: 320, P1 Core: 100)
- Zero critical bugs in production
- Documentation complete

**Code**:
- New LOC: ~8,500 (production + tests)
- Files added: ~35
- Dependencies added: 5 (carefully vetted)

---

## Timeline

### 45-Day Schedule

**Week 1-2: Semantic Memory** (10 days)
- Days 1-2: Embedding service + model loading
- Days 3-4: FAISS integration + vector store
- Days 5-6: Database migration + sync triggers
- Days 7-8: Semantic search + hybrid ranking
- Days 9-10: CLI command + optimization

**Week 3-4: Workflow Authoring** (8 days)
- Days 11-12: YAML parser + Zod validation
- Days 13-14: Variable substitution + dependency graph
- Days 15-16: Workflow engine + execution
- Days 17-18: CLI commands + templates

**Week 5: Observability MVP** (5 days)
- Days 19-20: Structured logging + correlation IDs
- Days 21-22: Basic metrics collection
- Day 23: Integration + testing

**Week 6-7: Agent Learning** (10 days)
- Days 24-26: History analysis + pattern recognition
- Days 27-28: Success rate tracking + failure patterns
- Days 29-31: Suggestion engine + CLI integration
- Days 32-33: Proactive suggestions in `ax run`

**Week 8-9: Integration & Polish** (12 days)
- Days 34-36: Cross-feature integration testing
- Days 37-38: Performance benchmarking
- Days 39-40: Bug fixes + edge cases
- Days 41-42: Documentation updates
- Days 43-44: User guides + tutorials
- Day 45: Release preparation

### Milestones

**Milestone 1 (Day 10)**: Semantic search working
**Milestone 2 (Day 18)**: Workflows can be saved and executed
**Milestone 3 (Day 23)**: Basic observability operational
**Milestone 4 (Day 33)**: Agent learning providing suggestions
**Milestone 5 (Day 45)**: P1 Core shipped! 🎉

---

## Risk Management

### Top Risks

**Risk 1: FAISS performance at scale**
- **Impact**: Medium (affects search quality)
- **Probability**: Low
- **Mitigation**: Benchmark early with 100K+ items, use HNSW if needed
- **Fallback**: Simple cosine similarity (slower but works)

**Risk 2: Embedding model size/speed**
- **Impact**: Low (model is only 22MB, inference ~50ms)
- **Probability**: Very Low
- **Mitigation**: Batch processing, caching, background indexing
- **Fallback**: Use OpenAI embeddings API (costs money but faster)

**Risk 3: Workflow complexity edge cases**
- **Impact**: Medium (workflows might fail in unexpected ways)
- **Probability**: Medium
- **Mitigation**: Comprehensive testing, user beta testing
- **Fallback**: Users can still hardcode workflows in TypeScript

**Risk 4: Integration bugs between features**
- **Impact**: High (could block release)
- **Probability**: Medium
- **Mitigation**: 12 days dedicated to integration testing
- **Fallback**: Disable problematic feature, ship others

### Derisking Strategy

**Incremental Development**:
- Build features independently (minimal cross-dependencies)
- Each feature has isolated tests
- Feature flags to enable/disable if issues

**Early Testing**:
- Unit tests during development (not at end)
- Integration tests after each feature
- Performance benchmarks early (Day 38)

**User Feedback**:
- Beta users test after each milestone
- Quick feedback loop (1-2 days)
- Adjust based on real usage

---

## What's Next (P1.5 - Optional)

If P1 Core ships successfully and on time, we can consider P1.5:

**P1.5 Features** (Optional, +20 days):
1. **ReScript State Machines** (8 days)
   - Simple state machine runtime
   - TypeScript bridge
   - Better architecture for future

2. **Plugin SDK with Deno** (15 days)
   - Secure plugin system
   - 3 example plugins
   - Foundation for ecosystem

**Decision Point**: Day 45 (after P1 Core complete)
- Assess: User feedback, time availability, team capacity
- Go/No-go on P1.5
- Alternative: Ship P1 Core, plan P1.5 as separate release

---

## Summary

**P1 Core Scope**: 4 essential features in 45 days
1. ✅ Semantic Memory (10 days)
2. ✅ Workflow Authoring (8 days)
3. ✅ Observability MVP (5 days)
4. ✅ Agent Learning (10 days)
5. ✅ Integration & Polish (12 days)

**Why This Scope?**:
- Achieves critical PRD goals (30% faster triage, 25% workflow reuse, >85% precision)
- De-risks timeline (removed high-risk features)
- Maintains quality (12 days for testing and polish)
- Enables iteration (P1.5 for additional features)

**Outcome**:
- Production-ready platform with semantic search, workflow automation, and learning
- High confidence delivery (90% probability)
- Foundation for future growth (plugins, state machines in P1.5)

🎯 **Ready to execute P1 Core!**
