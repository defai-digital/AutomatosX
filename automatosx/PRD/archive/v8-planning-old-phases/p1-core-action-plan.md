# AutomatosX v2 - P1 Core Action Plan

**Version**: 1.0
**Created**: 2025-11-10
**Timeline**: 45 days (Days 81-125)
**Scope**: P1 Core (4 features, high-confidence delivery)

---

## Executive Summary

This action plan details the day-by-day execution strategy for P1 Core features based on metathinking analysis. The plan focuses on high-value, low-risk features that deliver the core P1 PRD goals.

**P1 Core Features**:
1. **Semantic Memory** (10 days) - Vector search with embeddings
2. **Workflow Authoring** (8 days) - YAML workflow MVP
3. **Observability MVP** (5 days) - Structured logging and basic metrics
4. **Agent Learning** (10 days) - Statistical analysis and suggestions
5. **Integration & Polish** (12 days) - Testing, documentation, release prep

**Key Metrics**:
- **Total Duration**: 45 days (vs. 60 days original)
- **New Code**: ~8,000 LOC (vs. ~11,800 LOC original)
- **New Tests**: 80+ (vs. 130+ original)
- **Confidence**: 90% (high)

**Deferred to P1.5 Extended**:
- ReScript State Machines (learning curve, +10 days)
- Plugin SDK with Deno (security complexity, +15 days)

---

## Phase Overview

### Week 1-2: Semantic Memory (Days 81-90)
**Goal**: Add vector search to memory system with @xenova/transformers

**Deliverables**:
- Embedding service with sentence-transformers
- FAISS vector store integration
- Hybrid search (semantic + BM25)
- CLI: `ax memory search --semantic`

### Week 3: Workflow Authoring (Days 91-98)
**Goal**: Enable YAML-based workflow definitions (sequential execution only)

**Deliverables**:
- YAML parser with Zod validation
- Workflow execution engine
- CLI: `ax workflow run`, `ax workflow validate`
- Example templates

### Week 4: Observability MVP (Days 99-103)
**Goal**: Add structured logging and basic metrics

**Deliverables**:
- JSON-structured logging with correlation IDs
- Metrics collection (counters, gauges, histograms)
- CLI: `ax logs tail`, `ax metrics show`

### Week 5-6: Agent Learning (Days 104-113)
**Goal**: Statistical analysis and proactive suggestions

**Deliverables**:
- Success rate tracking by agent
- Failure pattern detection
- Suggestion engine
- CLI: `ax insights show`, integrated into `ax run`

### Week 7-9: Integration & Polish (Days 114-125)
**Goal**: End-to-end testing, documentation, performance optimization

**Deliverables**:
- 80+ integration tests
- Updated documentation
- Performance benchmarks
- Migration guides

---

## Detailed Daily Breakdown

## Sprint 9: Semantic Memory (Days 81-90)

### Day 81: Foundation Setup
**Hours**: 8h
**Focus**: Project setup, dependency installation, schema design

**Tasks**:
- [ ] Install dependencies: `@xenova/transformers`, `faiss-node`, `onnxruntime-node`
- [ ] Create database migration `008_create_memory_embeddings.sql`
- [ ] Design embedding storage schema (384-dim vectors)
- [ ] Create `src/services/EmbeddingService.ts` skeleton
- [ ] Create `src/database/VectorStore.ts` skeleton

**Deliverables**:
```sql
-- 008_create_memory_embeddings.sql
CREATE TABLE memory_embeddings (
  memory_id TEXT PRIMARY KEY REFERENCES memories(id),
  embedding BLOB NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_embeddings_memory ON memory_embeddings(memory_id);
```

**Tests**: Database migration test

---

### Day 82: Embedding Service Implementation
**Hours**: 8h
**Focus**: Core embedding generation with caching

**Tasks**:
- [ ] Implement `EmbeddingService.initialize()` with model loading
- [ ] Implement `EmbeddingService.embed(text)` with batching
- [ ] Add LRU cache for embeddings (1000 items)
- [ ] Handle model download and initialization errors
- [ ] Add telemetry for embedding generation time

**Deliverables**:
```typescript
// src/services/EmbeddingService.ts
export class EmbeddingService {
  private model: any;
  private cache: LRUCache<string, Float32Array>;

  async initialize(): Promise<void> {
    this.model = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }

  async embed(text: string): Promise<Float32Array> {
    // Implementation with caching
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    // Batch processing
  }
}
```

**Tests**:
- Unit tests for `embed()` and `embedBatch()`
- Cache hit/miss tests
- Error handling tests

---

### Day 83: Vector Store Implementation
**Hours**: 8h
**Focus**: FAISS integration for vector search

**Tasks**:
- [ ] Implement `VectorStore` with IndexFlatIP
- [ ] Implement `add(id, embedding)` for indexing
- [ ] Implement `search(query, k)` with cosine similarity
- [ ] Add metadata storage for vector IDs
- [ ] Implement `save()` and `load()` for persistence

**Deliverables**:
```typescript
// src/database/VectorStore.ts
export class VectorStore {
  private index: IndexFlatIP;
  private metadata: Map<number, MemoryMetadata>;

  async search(query: Float32Array, k = 20): Promise<SearchResult[]> {
    const { labels, distances } = this.index.search(query, k);
    return labels.map((label, idx) => ({
      id: this.metadata.get(label)!.id,
      score: distances[idx]
    }));
  }
}
```

**Tests**:
- Vector indexing tests
- Search accuracy tests
- Persistence tests (save/load)

---

### Day 84: Hybrid Search Integration
**Hours**: 8h
**Focus**: Combine semantic search with existing BM25 keyword search

**Tasks**:
- [ ] Create `HybridSearchService` combining semantic + BM25
- [ ] Implement Reciprocal Rank Fusion (RRF) for result merging
- [ ] Add configurable weights (default: 70% semantic, 30% BM25)
- [ ] Optimize query performance (<50ms target)
- [ ] Add search result explanations

**Deliverables**:
```typescript
// src/services/HybridSearchService.ts
export class HybridSearchService {
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const [semantic, keyword] = await Promise.all([
      this.vectorSearch(query, options.k),
      this.keywordSearch(query, options.k)
    ]);
    return this.mergeResults(semantic, keyword, {
      semanticWeight: 0.7,
      keywordWeight: 0.3
    });
  }

  private mergeResults(semantic: Result[], keyword: Result[], weights): Result[] {
    // Reciprocal Rank Fusion
  }
}
```

**Tests**:
- Hybrid search accuracy tests
- RRF algorithm tests
- Weight configuration tests

---

### Day 85: CLI Integration
**Hours**: 8h
**Focus**: Add semantic search to `ax memory search` command

**Tasks**:
- [ ] Add `--semantic` flag to `ax memory search`
- [ ] Add `--hybrid` flag for combined search
- [ ] Display search scores and rankings
- [ ] Add search result highlighting
- [ ] Update command help and examples

**Deliverables**:
```typescript
// src/cli/commands/memory.ts
async function handleMemorySearch(query: string, options: SearchOptions) {
  if (options.semantic || options.hybrid) {
    const results = await hybridSearchService.search(query, {
      k: options.limit,
      mode: options.hybrid ? 'hybrid' : 'semantic'
    });
    displaySemanticResults(results);
  } else {
    // Original keyword search
  }
}
```

**CLI Examples**:
```bash
ax memory search "authentication" --semantic
ax memory search "REST API design" --hybrid --limit 10
```

**Tests**:
- CLI argument parsing tests
- Output formatting tests

---

### Day 86: Background Indexing
**Hours**: 8h
**Focus**: Auto-generate embeddings for existing and new memories

**Tasks**:
- [ ] Create `EmbeddingIndexer` service for batch processing
- [ ] Add embedding generation to memory write path
- [ ] Implement background job for existing memories
- [ ] Add progress tracking for indexing
- [ ] Handle indexing failures gracefully

**Deliverables**:
```typescript
// src/services/EmbeddingIndexer.ts
export class EmbeddingIndexer {
  async indexAllMemories(batchSize = 100): Promise<void> {
    const memories = await memoryDAO.getAllUnindexed();
    for (const batch of chunk(memories, batchSize)) {
      await this.processBatch(batch);
      this.reportProgress();
    }
  }

  async indexMemory(memory: Memory): Promise<void> {
    const embedding = await embeddingService.embed(memory.content);
    await vectorStore.add(memory.id, embedding);
    await memoryDAO.markIndexed(memory.id);
  }
}
```

**CLI**:
```bash
ax memory reindex --background
ax memory reindex --status
```

**Tests**:
- Batch processing tests
- Error recovery tests
- Progress tracking tests

---

### Day 87: Performance Optimization
**Hours**: 8h
**Focus**: Optimize embedding generation and vector search

**Tasks**:
- [ ] Profile embedding generation performance
- [ ] Implement embedding batch processing (50 items/batch)
- [ ] Add vector search result caching
- [ ] Optimize vector store memory usage
- [ ] Add performance metrics collection

**Deliverables**:
- Embedding generation: <100ms per item (P95)
- Vector search: <50ms (P95)
- Cache hit rate: >70%
- Memory usage: <500MB for 10K memories

**Tests**:
- Performance benchmark tests
- Memory usage tests
- Cache performance tests

---

### Day 88: Integration Testing
**Hours**: 8h
**Focus**: End-to-end semantic search testing

**Tasks**:
- [ ] Write integration tests for full search pipeline
- [ ] Test search quality with curated test set
- [ ] Test edge cases (empty query, large result sets)
- [ ] Test error handling (model loading failures)
- [ ] Load testing (1000+ memories)

**Deliverables**:
```typescript
// src/__tests__/integration/semantic-search.test.ts
describe('Semantic Search Integration', () => {
  it('should find semantically similar memories', async () => {
    await indexMemory({ content: 'REST API authentication with JWT' });
    await indexMemory({ content: 'User login system' });

    const results = await hybridSearch('how to secure API endpoints');
    expect(results[0].content).toContain('authentication');
  });

  it('should handle 1000+ memories efficiently', async () => {
    await indexManyMemories(1000);
    const start = Date.now();
    const results = await hybridSearch('test query');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // <100ms
  });
});
```

**Tests**: 15+ integration tests

---

### Day 89: Documentation
**Hours**: 6h
**Focus**: User-facing and developer documentation

**Tasks**:
- [ ] Write user guide for semantic search
- [ ] Document CLI commands and flags
- [ ] Create developer guide for embedding service
- [ ] Add API documentation
- [ ] Create example use cases

**Deliverables**:
- `docs/features/semantic-memory.md` (user guide)
- `docs/api/embedding-service.md` (API docs)
- Updated `README.md` with semantic search examples
- `examples/semantic-search.sh` (example scripts)

---

### Day 90: Sprint Review & Buffer
**Hours**: 8h
**Focus**: Testing, bug fixes, sprint retrospective

**Tasks**:
- [ ] Manual testing of all semantic search features
- [ ] Fix any remaining bugs
- [ ] Performance testing and optimization
- [ ] Sprint retrospective document
- [ ] Prepare for next sprint

**Deliverables**:
- All tests passing (100%)
- Performance targets met
- Sprint 9 completion report: `automatosx/tmp/sprint9-semantic-memory-complete.md`

---

## Sprint 10: Workflow Authoring (Days 91-98)

### Day 91: Workflow Schema Design
**Hours**: 8h
**Focus**: Define YAML workflow format and validation

**Tasks**:
- [ ] Design workflow YAML schema
- [ ] Create Zod validation schemas
- [ ] Define workflow execution model
- [ ] Design error handling strategy
- [ ] Create example workflows

**Deliverables**:
```typescript
// src/workflow/schemas.ts
import { z } from 'zod';

export const WorkflowStepSchema = z.object({
  id: z.string(),
  agent: z.string(),
  input: z.record(z.any()),
  depends_on: z.array(z.string()).optional(),
  timeout: z.number().default(600),
  retry: z.object({
    max_attempts: z.number().default(3),
    backoff: z.enum(['linear', 'exponential']).default('exponential')
  }).optional()
});

export const WorkflowSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  variables: z.record(z.any()).optional(),
  steps: z.array(WorkflowStepSchema),
  retry_policy: z.object({
    max_attempts: z.number().default(3),
    backoff: z.enum(['linear', 'exponential']).default('exponential')
  }).optional()
});
```

**Example Workflow**:
```yaml
# .automatosx/workflows/microservice-template.yaml
name: "Build Production Microservice"
version: "1.0"
description: "End-to-end microservice creation workflow"

variables:
  service_name: "user-service"
  db_type: "PostgreSQL"
  language: "TypeScript"

steps:
  - id: database
    agent: database
    input:
      description: "Design ${db_type} schema for ${service_name}"
      tables: ["users", "sessions", "audit_logs"]
    timeout: 300

  - id: api
    agent: api
    depends_on: [database]
    input:
      description: "Create REST API for ${service_name} in ${language}"
      schema: "{{outputs.database.schema}}"
      endpoints: ["POST /users", "GET /users/:id", "PUT /users/:id"]

  - id: tests
    agent: quality
    depends_on: [api]
    input:
      description: "Write integration tests for ${service_name}"
      api_spec: "{{outputs.api.openapi}}"

retry_policy:
  max_attempts: 3
  backoff: exponential
```

**Tests**: Schema validation tests

---

### Day 92: YAML Parser Implementation
**Hours**: 8h
**Focus**: Parse and validate workflow files

**Tasks**:
- [ ] Implement `WorkflowParser.parse(yamlContent)`
- [ ] Add Zod validation with detailed error messages
- [ ] Implement dependency graph validation
- [ ] Detect circular dependencies
- [ ] Add variable substitution support

**Deliverables**:
```typescript
// src/workflow/WorkflowParser.ts
import YAML from 'yaml';

export class WorkflowParser {
  async parse(yamlContent: string): Promise<Workflow> {
    const parsed = YAML.parse(yamlContent);
    const workflow = WorkflowSchema.parse(parsed);
    this.validateDependencies(workflow);
    this.validateVariables(workflow);
    return workflow;
  }

  private validateDependencies(workflow: Workflow): void {
    const graph = this.buildDependencyGraph(workflow.steps);
    if (this.hasCircularDependency(graph)) {
      throw new Error('Circular dependency detected in workflow');
    }
  }
}
```

**Tests**:
- Valid workflow parsing tests
- Invalid workflow error tests
- Circular dependency detection tests
- Variable substitution tests

---

### Day 93: Workflow Execution Engine
**Hours**: 8h
**Focus**: Execute workflow steps in dependency order

**Tasks**:
- [ ] Implement `WorkflowExecutor.execute(workflow)`
- [ ] Add topological sort for step ordering
- [ ] Implement step execution with timeout
- [ ] Add output capture and variable substitution
- [ ] Implement retry logic with exponential backoff

**Deliverables**:
```typescript
// src/workflow/WorkflowExecutor.ts
export class WorkflowExecutor {
  async execute(workflow: Workflow, context: ExecutionContext): Promise<ExecutionResult> {
    const sortedSteps = this.topologicalSort(workflow.steps);
    const outputs: Record<string, any> = {};

    for (const step of sortedSteps) {
      const input = this.substituteVariables(step.input, {
        variables: workflow.variables,
        outputs
      });

      const result = await this.executeStep(step, input, context);
      outputs[step.id] = result;
    }

    return { success: true, outputs };
  }

  private async executeStep(step: WorkflowStep, input: any, context: ExecutionContext): Promise<any> {
    const retryPolicy = step.retry || { max_attempts: 3, backoff: 'exponential' };

    for (let attempt = 1; attempt <= retryPolicy.max_attempts; attempt++) {
      try {
        return await this.runAgent(step.agent, input, step.timeout);
      } catch (error) {
        if (attempt === retryPolicy.max_attempts) throw error;
        await this.backoff(attempt, retryPolicy.backoff);
      }
    }
  }
}
```

**Tests**:
- Execution order tests
- Retry logic tests
- Variable substitution tests
- Timeout handling tests

---

### Day 94: Variable Substitution
**Hours**: 8h
**Focus**: Dynamic variable replacement in workflow inputs

**Tasks**:
- [ ] Implement `${variable}` syntax for simple variables
- [ ] Implement `{{outputs.step.field}}` syntax for step outputs
- [ ] Add nested object access support
- [ ] Handle missing variables gracefully
- [ ] Add variable validation

**Deliverables**:
```typescript
// src/workflow/VariableSubstitution.ts
export class VariableSubstitution {
  substitute(template: any, context: SubstitutionContext): any {
    if (typeof template === 'string') {
      return this.substituteString(template, context);
    } else if (Array.isArray(template)) {
      return template.map(item => this.substitute(item, context));
    } else if (typeof template === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.substitute(value, context);
      }
      return result;
    }
    return template;
  }

  private substituteString(str: string, context: SubstitutionContext): string {
    // ${variable} - simple variable
    str = str.replace(/\$\{([^}]+)\}/g, (match, key) => {
      return context.variables[key] ?? match;
    });

    // {{outputs.step.field}} - output reference
    str = str.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      return this.getNestedValue(context.outputs, path) ?? match;
    });

    return str;
  }
}
```

**Tests**:
- Simple variable substitution tests
- Output reference tests
- Nested object access tests
- Missing variable handling tests

---

### Day 95: CLI Integration
**Hours**: 8h
**Focus**: Add workflow commands to CLI

**Tasks**:
- [ ] Implement `ax workflow run <file>` command
- [ ] Implement `ax workflow validate <file>` command
- [ ] Implement `ax workflow list` command
- [ ] Add progress display during execution
- [ ] Add workflow execution history

**Deliverables**:
```typescript
// src/cli/commands/workflow.ts
export async function handleWorkflowRun(filePath: string, options: WorkflowRunOptions) {
  const content = await fs.readFile(filePath, 'utf-8');
  const workflow = await workflowParser.parse(content);

  console.log(`Starting workflow: ${workflow.name}`);
  const result = await workflowExecutor.execute(workflow, {
    verbose: options.verbose,
    onStepStart: (step) => console.log(`  Running step: ${step.id}...`),
    onStepComplete: (step, result) => console.log(`  ✓ ${step.id} completed`)
  });

  if (result.success) {
    console.log(`\n✓ Workflow completed successfully`);
  } else {
    console.error(`\n✗ Workflow failed: ${result.error}`);
  }
}
```

**CLI Examples**:
```bash
ax workflow run .automatosx/workflows/microservice-template.yaml
ax workflow run ./custom-workflow.yaml --verbose
ax workflow validate ./workflow.yaml
ax workflow list
```

**Tests**:
- CLI command tests
- Output formatting tests
- Error display tests

---

### Day 96: Workflow Templates
**Hours**: 8h
**Focus**: Create reusable workflow templates

**Tasks**:
- [ ] Create template: microservice creation
- [ ] Create template: feature development (design → implement → test)
- [ ] Create template: security audit workflow
- [ ] Create template: documentation generation
- [ ] Add template validation and testing

**Deliverables**:
```yaml
# templates/feature-development.yaml
name: "Feature Development Workflow"
version: "1.0"
description: "End-to-end feature development: design → implement → test → document"

variables:
  feature_name: ""
  language: "TypeScript"

steps:
  - id: design
    agent: product
    input:
      description: "Design ${feature_name} feature"
      requirements: "{{variables.requirements}}"

  - id: implement
    agent: fullstack
    depends_on: [design]
    input:
      description: "Implement ${feature_name} in ${language}"
      spec: "{{outputs.design.specification}}"

  - id: test
    agent: quality
    depends_on: [implement]
    input:
      description: "Write tests for ${feature_name}"
      code: "{{outputs.implement.files}}"

  - id: document
    agent: writer
    depends_on: [implement, test]
    input:
      description: "Document ${feature_name}"
      spec: "{{outputs.design.specification}}"
      implementation: "{{outputs.implement.summary}}"
```

**Templates**:
- `templates/microservice-template.yaml`
- `templates/feature-development.yaml`
- `templates/security-audit.yaml`
- `templates/documentation-generation.yaml`

**Tests**: Template validation tests

---

### Day 97: Integration Testing
**Hours**: 8h
**Focus**: End-to-end workflow testing

**Tasks**:
- [ ] Write integration tests for workflow execution
- [ ] Test error handling and retries
- [ ] Test variable substitution
- [ ] Test dependency resolution
- [ ] Load testing (complex workflows)

**Deliverables**:
```typescript
// src/__tests__/integration/workflow.test.ts
describe('Workflow Integration', () => {
  it('should execute simple workflow', async () => {
    const workflow = await parser.parse(simpleWorkflowYAML);
    const result = await executor.execute(workflow, context);
    expect(result.success).toBe(true);
    expect(result.outputs).toHaveProperty('step1');
  });

  it('should respect dependencies', async () => {
    const workflow = await parser.parse(dependencyWorkflowYAML);
    const executionOrder: string[] = [];
    const result = await executor.execute(workflow, {
      onStepStart: (step) => executionOrder.push(step.id)
    });
    expect(executionOrder).toEqual(['database', 'api', 'tests']);
  });

  it('should retry failed steps', async () => {
    const workflow = await parser.parse(retryWorkflowYAML);
    mockAgentFailure('api', { failTimes: 2 });
    const result = await executor.execute(workflow, context);
    expect(result.success).toBe(true); // Succeeds after retries
  });
});
```

**Tests**: 12+ integration tests

---

### Day 98: Documentation & Sprint Review
**Hours**: 8h
**Focus**: Documentation and sprint completion

**Tasks**:
- [ ] Write workflow authoring guide
- [ ] Document workflow schema and syntax
- [ ] Create tutorial: "Your First Workflow"
- [ ] Add API documentation
- [ ] Sprint retrospective

**Deliverables**:
- `docs/features/workflow-authoring.md` (user guide)
- `docs/tutorials/first-workflow.md` (tutorial)
- `docs/api/workflow-executor.md` (API docs)
- Sprint 10 completion report: `automatosx/tmp/sprint10-workflow-authoring-complete.md`

---

## Sprint 11: Observability MVP (Days 99-103)

### Day 99: Structured Logging
**Hours**: 8h
**Focus**: JSON-structured logging with correlation IDs

**Tasks**:
- [ ] Create `LoggingService` with JSON output
- [ ] Add correlation ID tracking
- [ ] Implement log levels (debug, info, warn, error)
- [ ] Add context propagation
- [ ] Create log file rotation

**Deliverables**:
```typescript
// src/telemetry/LoggingService.ts
export class LoggingService {
  private correlationId: string | null = null;

  withCorrelation<T>(id: string, fn: () => T): T {
    const previousId = this.correlationId;
    this.correlationId = id;
    try {
      return fn();
    } finally {
      this.correlationId = previousId;
    }
  }

  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      ...context
    };

    console.log(JSON.stringify(entry));
    this.writeToFile(entry);
  }
}
```

**Log Format**:
```json
{
  "timestamp": "2025-11-10T12:34:56.789Z",
  "level": "info",
  "message": "Workflow step completed",
  "correlationId": "wf-12345",
  "stepId": "database",
  "duration": 1234,
  "agent": "database"
}
```

**Tests**: Logging tests with correlation ID validation

---

### Day 100: Metrics Collection
**Hours**: 8h
**Focus**: Basic metrics (counters, gauges, histograms)

**Tasks**:
- [ ] Create `MetricsService` for metric collection
- [ ] Implement counter metrics (e.g., workflow_runs_total)
- [ ] Implement gauge metrics (e.g., active_workflows)
- [ ] Implement histogram metrics (e.g., step_duration_ms)
- [ ] Add metrics persistence to SQLite

**Deliverables**:
```typescript
// src/telemetry/MetricsService.ts
export class MetricsService {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }

  getMetrics(): MetricsSummary {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: this.computeHistogramStats()
    };
  }
}
```

**Key Metrics**:
- `workflow_runs_total` (counter)
- `workflow_step_duration_ms` (histogram)
- `active_workflows` (gauge)
- `agent_invocations_total` (counter)
- `memory_search_duration_ms` (histogram)

**Tests**: Metrics collection and aggregation tests

---

### Day 101: CLI Integration
**Hours**: 8h
**Focus**: Add observability commands to CLI

**Tasks**:
- [ ] Implement `ax logs tail` command
- [ ] Implement `ax logs search` command with filters
- [ ] Implement `ax metrics show` command
- [ ] Add metrics visualization (ASCII charts)
- [ ] Add log correlation tracking

**Deliverables**:
```typescript
// src/cli/commands/logs.ts
export async function handleLogsTail(options: LogsTailOptions) {
  const logs = await loggingService.tail({
    limit: options.lines || 50,
    follow: options.follow,
    filter: options.filter
  });

  for (const log of logs) {
    console.log(formatLogEntry(log));
  }
}

export async function handleLogsSearch(query: string, options: LogsSearchOptions) {
  const logs = await loggingService.search({
    query,
    level: options.level,
    correlationId: options.correlationId,
    startTime: options.since,
    endTime: options.until
  });

  displayLogs(logs);
}
```

**CLI Examples**:
```bash
ax logs tail --follow
ax logs tail --lines 100
ax logs search "error" --level error --since "1 hour ago"
ax logs search --correlation-id wf-12345

ax metrics show
ax metrics show workflow_runs_total
ax metrics show --format json
```

**Tests**: CLI output formatting tests

---

### Day 102: Integration with Existing Features
**Hours**: 8h
**Focus**: Add logging and metrics to workflow, memory, agents

**Tasks**:
- [ ] Add workflow execution logging
- [ ] Add memory search metrics
- [ ] Add agent invocation logging
- [ ] Add error logging with stack traces
- [ ] Performance impact testing

**Deliverables**:
- Logging integration in `WorkflowExecutor`
- Metrics in `HybridSearchService`
- Logging in agent execution
- Performance overhead: <5%

**Tests**: Integration tests with logging/metrics validation

---

### Day 103: Documentation & Sprint Review
**Hours**: 8h
**Focus**: Documentation and sprint completion

**Tasks**:
- [ ] Write observability guide
- [ ] Document metrics catalog
- [ ] Create troubleshooting guide using logs
- [ ] Sprint retrospective
- [ ] Performance validation

**Deliverables**:
- `docs/features/observability.md` (user guide)
- `docs/metrics-catalog.md` (metrics reference)
- `docs/troubleshooting.md` (troubleshooting guide)
- Sprint 11 completion report: `automatosx/tmp/sprint11-observability-complete.md`

---

## Sprint 12: Agent Learning (Days 104-113)

### Day 104: Database Schema Design
**Hours**: 8h
**Focus**: Design schema for learning data

**Tasks**:
- [ ] Create migration `009_create_agent_learning.sql`
- [ ] Design `agent_performance` table
- [ ] Design `task_patterns` table
- [ ] Design `suggestions` table
- [ ] Create indexes for efficient queries

**Deliverables**:
```sql
-- 009_create_agent_learning.sql
CREATE TABLE agent_performance (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  task_hash TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_perf_agent ON agent_performance(agent_name);
CREATE INDEX idx_perf_task ON agent_performance(task_hash);
CREATE INDEX idx_perf_success ON agent_performance(success);

CREATE TABLE task_patterns (
  task_hash TEXT PRIMARY KEY,
  task_description TEXT NOT NULL,
  task_type TEXT,
  keywords TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suggestions (
  id TEXT PRIMARY KEY,
  task_hash TEXT NOT NULL,
  suggestion_type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_hash) REFERENCES task_patterns(task_hash)
);
```

**Tests**: Migration tests

---

### Day 105: Performance Tracking Service
**Hours**: 8h
**Focus**: Track agent success/failure rates

**Tasks**:
- [ ] Create `PerformanceTracker` service
- [ ] Implement `recordExecution(agent, task, result)`
- [ ] Add task hashing for pattern matching
- [ ] Implement success rate calculation
- [ ] Add statistical significance testing

**Deliverables**:
```typescript
// src/agents/learning/PerformanceTracker.ts
export class PerformanceTracker {
  async recordExecution(execution: AgentExecution): Promise<void> {
    const taskHash = this.hashTask(execution.task);

    await db.run(`
      INSERT INTO agent_performance (id, agent_name, task_hash, success, duration_ms, error_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      generateId(),
      execution.agent,
      taskHash,
      execution.success,
      execution.duration,
      execution.error?.type
    ]);
  }

  async getAgentStats(agent: string, taskPattern?: string): Promise<AgentStats> {
    const query = taskPattern
      ? `SELECT * FROM agent_performance WHERE agent_name = ? AND task_hash = ?`
      : `SELECT * FROM agent_performance WHERE agent_name = ?`;

    const executions = await db.all(query, taskPattern ? [agent, taskPattern] : [agent]);

    return {
      totalExecutions: executions.length,
      successCount: executions.filter(e => e.success).length,
      successRate: executions.filter(e => e.success).length / executions.length,
      avgDuration: this.average(executions.map(e => e.duration_ms)),
      confidence: this.calculateConfidence(executions.length)
    };
  }

  private hashTask(task: string): string {
    // Normalize and hash task description
    const normalized = task.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }
}
```

**Tests**:
- Execution recording tests
- Stats calculation tests
- Confidence scoring tests

---

### Day 106: Pattern Recognition
**Hours**: 8h
**Focus**: Identify task patterns and commonalities

**Tasks**:
- [ ] Create `PatternRecognition` service
- [ ] Implement keyword extraction from tasks
- [ ] Implement task similarity detection
- [ ] Add pattern clustering
- [ ] Create pattern analysis queries

**Deliverables**:
```typescript
// src/agents/learning/PatternRecognition.ts
export class PatternRecognition {
  async analyzeTask(task: string): Promise<TaskPattern> {
    const keywords = this.extractKeywords(task);
    const taskType = this.classifyTask(task, keywords);
    const taskHash = this.hashTask(task);

    await db.run(`
      INSERT OR REPLACE INTO task_patterns (task_hash, task_description, task_type, keywords)
      VALUES (?, ?, ?, ?)
    `, [taskHash, task, taskType, JSON.stringify(keywords)]);

    return { taskHash, taskType, keywords };
  }

  async findSimilarTasks(task: string, limit = 20): Promise<SimilarTask[]> {
    const pattern = await this.analyzeTask(task);

    // Find tasks with overlapping keywords
    const similar = await db.all(`
      SELECT tp.*,
             (SELECT COUNT(*) FROM agent_performance WHERE task_hash = tp.task_hash) as execution_count
      FROM task_patterns tp
      WHERE EXISTS (
        SELECT 1 FROM json_each(tp.keywords)
        WHERE value IN (SELECT value FROM json_each(?))
      )
      ORDER BY execution_count DESC
      LIMIT ?
    `, [JSON.stringify(pattern.keywords), limit]);

    return similar.map(row => ({
      taskHash: row.task_hash,
      description: row.task_description,
      similarity: this.calculateSimilarity(pattern.keywords, JSON.parse(row.keywords))
    }));
  }

  private extractKeywords(task: string): string[] {
    // Simple keyword extraction (can be enhanced with NLP)
    const words = task.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    return words.filter(w => !stopWords.has(w) && w.length > 3);
  }

  private classifyTask(task: string, keywords: string[]): string {
    if (keywords.some(k => ['api', 'endpoint', 'rest', 'graphql'].includes(k))) return 'api-development';
    if (keywords.some(k => ['database', 'schema', 'migration'].includes(k))) return 'database-design';
    if (keywords.some(k => ['test', 'testing', 'spec'].includes(k))) return 'testing';
    if (keywords.some(k => ['security', 'auth', 'authentication'].includes(k))) return 'security';
    return 'general';
  }
}
```

**Tests**:
- Keyword extraction tests
- Task classification tests
- Similarity calculation tests

---

### Day 107: Suggestion Engine
**Hours**: 8h
**Focus**: Generate proactive suggestions

**Tasks**:
- [ ] Create `SuggestionEngine` service
- [ ] Implement agent recommendation logic
- [ ] Implement workflow suggestion logic
- [ ] Add confidence scoring
- [ ] Create suggestion ranking

**Deliverables**:
```typescript
// src/agents/learning/SuggestionEngine.ts
export class SuggestionEngine {
  async getSuggestionsForTask(task: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Find similar past tasks
    const similarTasks = await patternRecognition.findSimilarTasks(task, 20);

    if (similarTasks.length > 0) {
      // Analyze which agents succeeded most
      const agentStats = await this.analyzeAgentSuccess(similarTasks);

      if (agentStats.length > 0 && agentStats[0].confidence > 0.7) {
        suggestions.push({
          type: 'agent',
          title: `Recommended Agent: @${agentStats[0].agent}`,
          reason: `${Math.round(agentStats[0].successRate * 100)}% success rate based on ${agentStats[0].sampleSize} similar tasks`,
          confidence: agentStats[0].confidence,
          action: {
            command: `ax run ${agentStats[0].agent} "${task}"`
          }
        });
      }

      // Suggest workflow if pattern detected
      const workflow = await this.detectWorkflowPattern(similarTasks);
      if (workflow && workflow.confidence > 0.6) {
        suggestions.push({
          type: 'workflow',
          title: 'Suggested Workflow',
          reason: `Similar tasks often use ${workflow.steps.length}-step workflow`,
          confidence: workflow.confidence,
          action: {
            workflow: workflow.template
          }
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeAgentSuccess(tasks: SimilarTask[]): Promise<AgentStats[]> {
    const stats = new Map<string, { success: number; total: number }>();

    for (const task of tasks) {
      const executions = await db.all(`
        SELECT agent_name, success FROM agent_performance WHERE task_hash = ?
      `, [task.taskHash]);

      for (const exec of executions) {
        if (!stats.has(exec.agent_name)) {
          stats.set(exec.agent_name, { success: 0, total: 0 });
        }
        const s = stats.get(exec.agent_name)!;
        s.total++;
        if (exec.success) s.success++;
      }
    }

    return Array.from(stats.entries())
      .map(([agent, { success, total }]) => ({
        agent,
        successRate: success / total,
        sampleSize: total,
        confidence: this.calculateConfidence(total)
      }))
      .sort((a, b) => b.successRate - a.successRate);
  }

  private calculateConfidence(sampleSize: number): number {
    // Wilson score interval for binomial confidence
    if (sampleSize < 5) return 0.3;
    if (sampleSize < 10) return 0.6;
    if (sampleSize < 20) return 0.8;
    return 0.95;
  }
}
```

**Tests**:
- Suggestion generation tests
- Confidence calculation tests
- Ranking tests

---

### Day 108: CLI Integration
**Hours**: 8h
**Focus**: Integrate suggestions into `ax run`

**Tasks**:
- [ ] Add `--suggest` flag to `ax run`
- [ ] Display suggestions before execution
- [ ] Add `ax insights show` command
- [ ] Add `ax insights agents` command
- [ ] Create suggestion UI/UX

**Deliverables**:
```typescript
// src/cli/commands/run.ts (enhanced)
export async function handleRun(agent: string, task: string, options: RunOptions) {
  // Get suggestions if enabled
  if (options.suggest !== false) {
    const suggestions = await suggestionEngine.getSuggestionsForTask(task);

    if (suggestions.length > 0) {
      console.log('\n💡 Suggestions based on similar past tasks:\n');
      for (const suggestion of suggestions.slice(0, 3)) {
        console.log(`  ${suggestion.title}`);
        console.log(`  Reason: ${suggestion.reason}`);
        console.log(`  Confidence: ${formatConfidence(suggestion.confidence)}\n`);
      }

      const topSuggestion = suggestions[0];
      if (topSuggestion.type === 'agent' && topSuggestion.confidence > 0.8) {
        const suggestedAgent = extractAgentName(topSuggestion.action.command);
        if (suggestedAgent !== agent) {
          const shouldSwitch = await confirm(`Use recommended agent @${suggestedAgent} instead?`);
          if (shouldSwitch) {
            agent = suggestedAgent;
          }
        }
      }
    }
  }

  // Execute task
  const result = await executeAgent(agent, task, options);

  // Record execution for learning
  await performanceTracker.recordExecution({
    agent,
    task,
    success: result.success,
    duration: result.duration,
    error: result.error
  });

  return result;
}
```

**CLI Examples**:
```bash
ax run backend "create user authentication API" --suggest
ax insights show
ax insights agents --task "API development"
```

**Tests**: CLI integration tests

---

### Day 109: Insights Dashboard
**Hours**: 8h
**Focus**: Create insights reporting commands

**Tasks**:
- [ ] Implement `ax insights show` command
- [ ] Implement `ax insights agents` command
- [ ] Implement `ax insights tasks` command
- [ ] Add visualization (ASCII charts)
- [ ] Add export to JSON

**Deliverables**:
```typescript
// src/cli/commands/insights.ts
export async function handleInsightsShow(options: InsightsOptions) {
  const stats = await performanceTracker.getOverallStats();

  console.log('\n📊 AutomatosX Insights\n');
  console.log(`Total Task Executions: ${stats.totalExecutions}`);
  console.log(`Overall Success Rate: ${formatPercent(stats.successRate)}`);
  console.log(`Average Duration: ${formatDuration(stats.avgDuration)}\n`);

  console.log('Top Performing Agents:');
  const topAgents = await performanceTracker.getTopAgents(5);
  for (const agent of topAgents) {
    console.log(`  ${agent.name}: ${formatPercent(agent.successRate)} (${agent.executionCount} runs)`);
  }

  console.log('\nCommon Task Types:');
  const taskTypes = await patternRecognition.getTaskTypeDistribution();
  for (const type of taskTypes) {
    console.log(`  ${type.name}: ${type.count} tasks`);
  }
}
```

**CLI Examples**:
```bash
ax insights show
ax insights agents
ax insights agents --task "API development"
ax insights tasks --type api-development
ax insights export > insights.json
```

**Tests**: Insights command tests

---

### Day 110: Integration Testing
**Hours**: 8h
**Focus**: End-to-end learning system testing

**Tasks**:
- [ ] Write integration tests for learning pipeline
- [ ] Test suggestion quality
- [ ] Test performance tracking accuracy
- [ ] Load testing (1000+ executions)
- [ ] Edge case testing

**Deliverables**:
```typescript
// src/__tests__/integration/agent-learning.test.ts
describe('Agent Learning Integration', () => {
  it('should track agent performance', async () => {
    await executeAgent('backend', 'create API', { success: true });
    await executeAgent('backend', 'create API endpoint', { success: true });

    const stats = await performanceTracker.getAgentStats('backend');
    expect(stats.successRate).toBe(1.0);
    expect(stats.totalExecutions).toBe(2);
  });

  it('should suggest best agent for task', async () => {
    // Record historical data
    for (let i = 0; i < 20; i++) {
      await executeAgent('backend', 'create REST API', { success: true });
    }
    for (let i = 0; i < 5; i++) {
      await executeAgent('frontend', 'create REST API', { success: false });
    }

    const suggestions = await suggestionEngine.getSuggestionsForTask('build REST API for users');
    expect(suggestions[0].title).toContain('backend');
    expect(suggestions[0].confidence).toBeGreaterThan(0.8);
  });

  it('should improve suggestions over time', async () => {
    const task = 'implement authentication';

    // Initial state: no suggestions
    let suggestions = await suggestionEngine.getSuggestionsForTask(task);
    expect(suggestions.length).toBe(0);

    // Record successful executions
    for (let i = 0; i < 15; i++) {
      await executeAgent('security', task, { success: true });
    }

    // Should now suggest security agent
    suggestions = await suggestionEngine.getSuggestionsForTask(task);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].title).toContain('security');
  });
});
```

**Tests**: 15+ integration tests

---

### Day 111-112: Performance Optimization & Testing
**Hours**: 16h
**Focus**: Optimize learning system performance

**Tasks**:
- [ ] Profile suggestion generation performance
- [ ] Optimize database queries with indexes
- [ ] Add caching for frequent patterns
- [ ] Load testing (10K+ task records)
- [ ] Memory usage optimization

**Deliverables**:
- Suggestion generation: <50ms (P95)
- Pattern recognition: <100ms (P95)
- Database size: <10MB for 10K tasks
- Memory usage: <100MB

**Tests**: Performance benchmark tests

---

### Day 113: Documentation & Sprint Review
**Hours**: 8h
**Focus**: Documentation and sprint completion

**Tasks**:
- [ ] Write agent learning guide
- [ ] Document insights commands
- [ ] Create tutorial: "Understanding Agent Insights"
- [ ] Sprint retrospective
- [ ] Performance validation

**Deliverables**:
- `docs/features/agent-learning.md` (user guide)
- `docs/tutorials/agent-insights.md` (tutorial)
- `docs/api/suggestion-engine.md` (API docs)
- Sprint 12 completion report: `automatosx/tmp/sprint12-agent-learning-complete.md`

---

## Phase 13: Integration & Polish (Days 114-125)

### Week 7: Integration Testing (Days 114-118)

#### Day 114: Feature Integration
**Hours**: 8h
**Focus**: Integrate all P1 Core features

**Tasks**:
- [ ] Test semantic memory + workflow integration
- [ ] Test workflow + observability integration
- [ ] Test agent learning with all features
- [ ] Fix integration bugs
- [ ] Validate feature interactions

**Tests**: Cross-feature integration tests

---

#### Day 115: End-to-End Scenarios
**Hours**: 8h
**Focus**: Test real-world use cases

**Tasks**:
- [ ] Test scenario: "Build microservice with workflow"
- [ ] Test scenario: "Search memory semantically in workflow"
- [ ] Test scenario: "Learn from workflow executions"
- [ ] Test scenario: "Observe workflow with logs/metrics"
- [ ] Document test results

**Tests**: E2E scenario tests

---

#### Day 116: Performance Testing
**Hours**: 8h
**Focus**: Validate performance targets

**Tasks**:
- [ ] Run full performance test suite
- [ ] Load testing (1000+ memories, 100+ workflows)
- [ ] Stress testing (concurrent operations)
- [ ] Memory usage profiling
- [ ] Performance optimization

**Targets**:
- Semantic search: <100ms (P95)
- Workflow execution: <5s for 10-step workflow
- Observability overhead: <5%
- Memory usage: <1GB under load

---

#### Day 117: Bug Fixes
**Hours**: 8h
**Focus**: Fix all known bugs

**Tasks**:
- [ ] Triage bug list
- [ ] Fix P0 bugs (blocking)
- [ ] Fix P1 bugs (high priority)
- [ ] Regression testing
- [ ] Update issue tracker

---

#### Day 118: Security & Stability
**Hours**: 8h
**Focus**: Security review and stability

**Tasks**:
- [ ] Security audit of new features
- [ ] Input validation review
- [ ] Error handling review
- [ ] Stability testing (24-hour run)
- [ ] Fix security issues

---

### Week 8: Documentation & Examples (Days 119-122)

#### Day 119: User Documentation
**Hours**: 8h
**Focus**: Complete user-facing docs

**Tasks**:
- [ ] Update README.md with P1 features
- [ ] Write P1 feature guides
- [ ] Create CLI reference documentation
- [ ] Write troubleshooting guide
- [ ] Add FAQ section

**Deliverables**:
- Updated `README.md`
- `docs/features/` (all P1 features)
- `docs/cli-reference.md`
- `docs/troubleshooting.md`
- `docs/faq.md`

---

#### Day 120: Developer Documentation
**Hours**: 8h
**Focus**: API and architecture docs

**Tasks**:
- [ ] Document P1 architecture
- [ ] Write API documentation
- [ ] Create extension guides
- [ ] Document database schema
- [ ] Add code examples

**Deliverables**:
- `docs/architecture/p1-architecture.md`
- `docs/api/` (all services)
- `docs/extending-automatosx.md`
- `docs/schema.md`

---

#### Day 121: Tutorials & Examples
**Hours**: 8h
**Focus**: Hands-on tutorials

**Tasks**:
- [ ] Tutorial: "Getting Started with Workflows"
- [ ] Tutorial: "Semantic Memory Search"
- [ ] Tutorial: "Using Observability"
- [ ] Tutorial: "Understanding Agent Insights"
- [ ] Create example workflows

**Deliverables**:
- `docs/tutorials/workflows.md`
- `docs/tutorials/semantic-search.md`
- `docs/tutorials/observability.md`
- `docs/tutorials/insights.md`
- `examples/workflows/` (10+ examples)

---

#### Day 122: Video & Visual Content
**Hours**: 8h
**Focus**: Visual documentation

**Tasks**:
- [ ] Create architecture diagrams
- [ ] Create workflow diagrams
- [ ] Create CLI usage GIFs
- [ ] Record demo videos (optional)
- [ ] Update website/README visuals

---

### Week 9: Release Preparation (Days 123-125)

#### Day 123: Changelog & Migration Guide
**Hours**: 8h
**Focus**: Release documentation

**Tasks**:
- [ ] Write comprehensive CHANGELOG.md
- [ ] Create migration guide (v1 → v2 P1)
- [ ] Document breaking changes
- [ ] Create upgrade checklist
- [ ] Write release notes

**Deliverables**:
- `CHANGELOG.md` (complete P1 changes)
- `docs/migration/v1-to-v2-p1.md`
- `docs/RELEASE_NOTES_v2.1.md`

---

#### Day 124: Release Testing
**Hours**: 8h
**Focus**: Final validation

**Tasks**:
- [ ] Fresh install testing
- [ ] Upgrade testing (v2.0 → v2.1)
- [ ] Cross-platform testing (macOS, Linux, Windows)
- [ ] CLI command testing
- [ ] Documentation accuracy review

---

#### Day 125: Release & Celebration
**Hours**: 8h
**Focus**: Release P1 Core

**Tasks**:
- [ ] Final version bump (v2.1.0)
- [ ] Tag release in git
- [ ] Publish to npm (if applicable)
- [ ] Update documentation sites
- [ ] Announce release
- [ ] Create completion report

**Deliverables**:
- Git tag: `v2.1.0`
- Release announcement
- Final completion report: `automatosx/PRD/p1-core-completion-report.md`
- Team retrospective document

---

## Success Criteria

### Technical Metrics

**Performance**:
- [x] Semantic search: <100ms (P95)
- [x] Workflow execution: <5s for 10-step workflow
- [x] Observability overhead: <5%
- [x] Memory usage: <1GB under load

**Quality**:
- [x] Test coverage: >85%
- [x] All tests passing: 100%
- [x] Zero P0 bugs
- [x] <5 P1 bugs

**Code**:
- [x] ~8,000 new LOC
- [x] 80+ new tests
- [x] Type-safe (TypeScript strict mode)
- [x] Linting: zero errors

### Feature Completeness

**Semantic Memory**:
- [x] Vector search with embeddings
- [x] Hybrid search (semantic + BM25)
- [x] CLI: `ax memory search --semantic`
- [x] Background indexing

**Workflow Authoring**:
- [x] YAML workflow parser
- [x] Sequential execution
- [x] Variable substitution
- [x] CLI: `ax workflow run`
- [x] 5+ workflow templates

**Observability**:
- [x] Structured JSON logging
- [x] Correlation IDs
- [x] Basic metrics (counters, gauges, histograms)
- [x] CLI: `ax logs tail`, `ax metrics show`

**Agent Learning**:
- [x] Performance tracking
- [x] Pattern recognition
- [x] Suggestion engine
- [x] CLI: `ax insights show`
- [x] Integrated suggestions in `ax run`

### Documentation

- [x] User guides (4 features)
- [x] API documentation
- [x] Tutorials (4+)
- [x] Migration guide
- [x] CHANGELOG.md

---

## Risk Mitigation

### Identified Risks

**Risk 1: Embedding Model Size**
- **Impact**: 22MB download on first run
- **Mitigation**: Show progress bar, cache model, document requirements
- **Status**: Acceptable

**Risk 2: FAISS Dependency**
- **Impact**: Native compilation required
- **Mitigation**: Use `faiss-node` (pre-built binaries), document installation
- **Status**: Monitored

**Risk 3: Workflow Complexity**
- **Impact**: Users may create complex workflows that fail
- **Mitigation**: Start with MVP (sequential only), provide examples, validate workflows
- **Status**: Mitigated

**Risk 4: Performance Overhead**
- **Impact**: New features slow down system
- **Mitigation**: Performance testing every sprint, optimization days, caching
- **Status**: Monitored

### Contingency Plans

**If semantic search is too slow**:
- Use smaller embedding model (all-MiniLM-L6-v2 is already smallest)
- Implement more aggressive caching
- Limit search to recent memories (e.g., last 1000)

**If FAISS installation fails**:
- Fall back to pure keyword search
- Document manual FAISS installation
- Consider alternative vector stores (Annoy, hnswlib)

**If timeline slips**:
- Prioritize features: Memory > Learning > Workflow > Observability
- Reduce scope within features (e.g., fewer workflow features)
- Defer polish/optimization to P1.5

---

## Timeline Visualization

```
Week 1-2 (Days 81-90):  [==========] Semantic Memory
Week 3 (Days 91-98):    [========  ] Workflow Authoring
Week 4 (Days 99-103):   [=====     ] Observability MVP
Week 5-6 (Days 104-113):[==========] Agent Learning
Week 7 (Days 114-118):  [=====     ] Integration Testing
Week 8 (Days 119-122):  [====      ] Documentation
Week 9 (Days 123-125):  [===       ] Release Prep
```

**Total**: 45 days (9 weeks)

---

## Resource Requirements

### Team

- **Primary Developer**: 1 FTE (full-time equivalent)
- **Code Reviewer**: 0.25 FTE (periodic reviews)
- **Documentation Writer**: 0.5 FTE (parallel with dev)

### Infrastructure

- **Development**: Local machine (16GB+ RAM, 50GB disk)
- **Testing**: CI/CD pipeline (GitHub Actions or similar)
- **Storage**: ~1GB for codebase + dependencies

### External Dependencies

- `@xenova/transformers` (MIT license)
- `faiss-node` (MIT license)
- `yaml` (ISC license)
- `zod` (MIT license)

---

## Post-P1 Core Roadmap

### P1.5 Extended (Optional, +25 days)

**If P1 Core is successful, consider**:

1. **ReScript State Machines** (+10 days)
   - Type-safe state transitions
   - Deterministic workflow execution
   - Integration with workflow engine

2. **Plugin SDK with Deno** (+15 days)
   - Secure plugin sandboxing
   - Plugin registry
   - Example plugins
   - Plugin marketplace (P2 goal)

### P2 Vision (Future)

- Cross-project memory
- Distributed indexing
- Enterprise features
- Cloud deployment
- Advanced ML (fine-tuning, RAG)

---

## Sign-Off

**Plan Approved By**:
- [ ] Product Owner
- [ ] Tech Lead
- [ ] Engineering Manager

**Date**: _______________

**Next Steps**:
1. Review and approve this plan
2. Allocate resources (developer, reviewer, writer)
3. Set up project tracking (Jira, Linear, etc.)
4. Kick off Day 81: Semantic Memory Sprint

---

**Document Version**: 1.0
**Last Updated**: 2025-11-10
**Status**: Ready for Review
