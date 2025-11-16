# AutomatosX - P0 + P1 Complete PRD

**Version**: 2.0
**Status**: Active Development
**Timeline**: P0 Complete (Days 1-80) + P1 Target (Days 81-120)
**Created**: November 10, 2025
**Scope**: Production-Ready Core + Essential Enhancements

---

## Executive Summary

AutomatosX is a production-ready code intelligence platform with AI-powered agents, multi-language support (45 languages), and comprehensive tooling. **P0 is complete** with core features operational. **P1 will add critical enhancements** to make the platform best-in-class.

**P0 Status**: ✅ **100% Complete**
- Code intelligence (45 languages, Tree-sitter AST, SQLite FTS5)
- Memory system (search, recall, storage)
- Provider system (Claude, Gemini, OpenAI)
- CLI commands (find, def, flow, lint, index, watch, agent, run)
- Web UI (React dashboard, quality metrics, dependency graphs)
- LSP server (definition, references, hover, completion, diagnostics)
- VS Code extension (editor integration)
- Agent system (20 specialized AI agents, multi-agent collaboration)

**P1 Scope**: Essential enhancements for production excellence
1. ReScript Core State Machines
2. Semantic Memory with Embeddings
3. Advanced Workflow Authoring
4. Plugin SDK Beta
5. Observability Stack (OpenTelemetry)
6. Agent Learning & Improvement

**Out of Scope (P2)**: Cloud deployment, enterprise features, marketplace, mobile apps

---

## Table of Contents

1. [P0 Completion Status](#p0-completion-status)
2. [P1 Feature Specifications](#p1-feature-specifications)
3. [Technical Architecture](#technical-architecture)
4. [Implementation Plan](#implementation-plan)
5. [Success Metrics](#success-metrics)
6. [Risk Mitigation](#risk-mitigation)

---

## 1. P0 Completion Status

### ✅ Completed Features (Sprints 1-8 + Phase 7)

#### Sprint 1-2: Code Intelligence Foundation
- **45 Language Parsers**: TypeScript, JavaScript, Python, Go, Rust, Java, C++, Swift, Kotlin, and 36 more
- **Tree-sitter Integration**: AST parsing for all supported languages
- **SQLite FTS5**: Full-text search with BM25 ranking
- **Multi-Modal Search**: Symbol search, natural language search, filter syntax
- **Query Caching**: 10-100x speedup for repeated queries
- **Batch Indexing**: 2000+ files/sec throughput

**Lines of Code**: ~3,500
**Tests**: 45 tests, 90% coverage

#### Sprint 3-4: Memory & Provider Systems
- **Memory Service**: SQLite-based memory with FTS5 search
- **Memory Commands**: `ax memory search`, `ax memory recall`, `ax memory export`
- **Provider System**: Claude, Gemini, OpenAI with automatic fallback
- **Rate Limiting**: Token bucket algorithm, configurable limits
- **Retry Logic**: Exponential backoff with jitter
- **Error Handling**: Circuit breaker pattern, graceful degradation

**Lines of Code**: ~2,200
**Tests**: 38 tests, 85% coverage

#### Sprint 5-6: CLI & Quality Analysis
- **Core Commands**: `ax find`, `ax def`, `ax flow`, `ax lint`
- **Management Commands**: `ax index`, `ax watch`, `ax status`, `ax config`
- **Query Router**: Intent detection (symbol vs natural language)
- **Filter Parser**: `lang:`, `kind:`, `file:` filter syntax
- **Code Quality Analyzer**: Complexity, maintainability, code smells
- **Performance Profiler**: Execution time tracking, bottleneck detection

**Lines of Code**: ~2,800
**Tests**: 42 tests, 88% coverage

#### Sprint 7-8: Web UI & LSP Integration
- **React Dashboard**: Material-UI with responsive design
- **Quality Metrics**: Complexity charts, code smell visualization, grade distribution
- **Dependency Graphs**: Interactive D3.js visualizations
- **LSP Server**: Full Language Server Protocol implementation
- **VS Code Extension**: Editor integration with real-time intelligence
- **WebSocket Server**: Real-time updates for web UI

**Lines of Code**: ~4,200
**Tests**: 52 tests, 82% coverage

#### Phase 7: Agent System (Days 77-80)
- **20 Specialized Agents**: Backend, Frontend, Security, Quality, DevOps, Architecture, Data, Product, DataScience, Database, API, Performance, Mobile, Infrastructure, Testing, CTO, CEO, Writer, Researcher, Standards
- **Multi-Agent Collaboration**: Task decomposition, sequential/parallel execution
- **Intelligent Routing**: Natural language intent detection, @mention support
- **CLI Integration**: `ax agent list`, `ax agent describe`, `ax run`
- **Memory Integration**: All agent executions stored and searchable

**Lines of Code**: ~5,930
**Tests**: 143 tests, 87% coverage

### P0 Total Stats
- **Total Lines**: ~18,630 production code
- **Total Tests**: 320 tests
- **Coverage**: 85%+ across all modules
- **Performance**: <10ms routing, <5ms cached queries, 2000+ files/sec indexing

---

## 2. P1 Feature Specifications

### 2.1 ReScript Core State Machines

**Goal**: Complete the ReScript core integration for deterministic task orchestration and workflow management.

**Current Status**:
- ReScript infrastructure exists (`packages/rescript-core/`)
- Basic state machine types defined
- Build pipeline configured
- **Not yet integrated** with TypeScript layer

**P1 Deliverables**:

#### 2.1.1 State Machine Core
```rescript
// packages/rescript-core/src/runtime/StateMachine.res
type state =
  | Idle
  | Running(taskId)
  | Waiting(reason)
  | Completed(result)
  | Failed(error)

type event =
  | StartTask(taskId, taskData)
  | TaskProgress(progress)
  | TaskComplete(result)
  | TaskFailed(error)
  | Cancel

type transition = {
  from: state,
  to: state,
  event: event,
  guard: option(taskData => bool),
  effect: option(taskData => promise<unit>),
}

let createMachine: (
  ~initial: state,
  ~transitions: array<transition>,
  ~context: taskContext
) => stateMachine

let send: (stateMachine, event) => promise<state>
let getCurrentState: stateMachine => state
let subscribe: (stateMachine, state => unit) => unsubscribe
```

#### 2.1.2 Workflow Orchestrator
```rescript
// packages/rescript-core/src/workflow/WorkflowOrchestrator.res
type workflow = {
  id: string,
  name: string,
  steps: array<workflowStep>,
  checkpoints: array<checkpoint>,
  retryPolicy: retryPolicy,
}

type workflowStep = {
  id: string,
  name: string,
  agent: agentType,
  dependsOn: array<string>,
  input: Json.t,
  timeout: option<int>,
}

let executeWorkflow: (workflow, context) => promise<workflowResult>
let pauseWorkflow: (workflowId) => promise<unit>
let resumeWorkflow: (workflowId) => promise<workflowResult>
let cancelWorkflow: (workflowId) => promise<unit>
```

#### 2.1.3 TypeScript Bridge
```typescript
// src/bridge/RescriptBridge.ts
import * as StateMachine from '../../packages/rescript-core/src/runtime/StateMachine.bs.js';
import * as WorkflowOrchestrator from '../../packages/rescript-core/src/workflow/WorkflowOrchestrator.bs.js';

export class StateMachineService {
  createMachine(config: StateMachineConfig): StateMachine.t;
  sendEvent(machine: StateMachine.t, event: Event): Promise<State>;
  subscribe(machine: StateMachine.t, callback: (state: State) => void): () => void;
}

export class WorkflowService {
  executeWorkflow(workflow: Workflow): Promise<WorkflowResult>;
  pauseWorkflow(id: string): Promise<void>;
  resumeWorkflow(id: string): Promise<WorkflowResult>;
}
```

**Success Criteria**:
- ✅ State machines compile to JavaScript
- ✅ TypeScript can import and use ReScript modules
- ✅ All state transitions are type-safe
- ✅ Workflow execution is deterministic and resumable
- ✅ 95%+ test coverage

**Timeline**: 10 days (Days 81-90)
**Estimated LOC**: ~2,000 ReScript + ~800 TypeScript

---

### 2.2 Semantic Memory with Embeddings

**Goal**: Enable natural language search over past agent executions and code using ML embeddings.

**Architecture**:
```
User Query → Embeddings → Vector Search (FAISS) → Rerank (BM25) → Top Results
                ↓
          Cache Layer (Redis)
```

**Components**:

#### 2.2.1 Embedding Service
```typescript
// src/services/EmbeddingService.ts
import { pipeline } from '@xenova/transformers';

export class EmbeddingService {
  private model: any;

  async initialize(): Promise<void> {
    // Load sentence-transformers/all-MiniLM-L6-v2 (384 dims)
    this.model = await pipeline('feature-extraction',
      'Xenova/all-MiniLM-L6-v2');
  }

  async embed(text: string): Promise<Float32Array> {
    const output = await this.model(text, {
      pooling: 'mean',
      normalize: true
    });
    return output.data;
  }

  async batchEmbed(texts: string[]): Promise<Float32Array[]> {
    // Batch processing for efficiency
  }
}
```

#### 2.2.2 Vector Database
```typescript
// src/database/VectorStore.ts
import { IndexFlatIP } from 'faiss-node';

export class VectorStore {
  private index: IndexFlatIP;
  private metadata: Map<number, MemoryMetadata>;

  async addVectors(
    vectors: Float32Array[],
    metadata: MemoryMetadata[]
  ): Promise<void> {
    // Add vectors to FAISS index
    this.index.add(vectors);
    metadata.forEach((meta, idx) =>
      this.metadata.set(idx, meta));
  }

  async search(
    queryVector: Float32Array,
    k: number = 10
  ): Promise<SearchResult[]> {
    const { labels, distances } = this.index.search(queryVector, k);
    return labels.map((label, idx) => ({
      id: label,
      score: distances[idx],
      metadata: this.metadata.get(label)!
    }));
  }
}
```

#### 2.2.3 Semantic Search Command
```bash
# New CLI command
ax semantic search "find authentication logic"
ax semantic search "show database connection code" --lang typescript
ax semantic search "error handling patterns" --limit 20
```

#### 2.2.4 Hybrid Ranking
```typescript
// src/services/HybridSearch.ts
export class HybridSearch {
  async search(query: string, options: SearchOptions): Promise<SearchResult[]> {
    // 1. Get semantic results (vector search)
    const semanticResults = await this.vectorSearch(query, 20);

    // 2. Get keyword results (BM25)
    const keywordResults = await this.keywordSearch(query, 20);

    // 3. Combine and rerank (Reciprocal Rank Fusion)
    const combined = this.reciprocalRankFusion(
      semanticResults,
      keywordResults
    );

    return combined.slice(0, options.limit);
  }
}
```

**Database Schema**:
```sql
-- New tables
CREATE TABLE memory_embeddings (
  memory_id TEXT PRIMARY KEY REFERENCES memories(id),
  embedding BLOB NOT NULL, -- 384 floats (1536 bytes)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memory_embeddings_created ON memory_embeddings(created_at);
```

**Success Criteria**:
- ✅ Semantic search returns >80% relevant results in top-10
- ✅ Query latency <500ms for 100K indexed items
- ✅ Embedding generation <100ms per item
- ✅ Support incremental indexing (real-time updates)
- ✅ 90%+ test coverage

**Timeline**: 8 days (Days 91-98)
**Estimated LOC**: ~1,800 TypeScript + SQL migrations

---

### 2.3 Advanced Workflow Authoring

**Goal**: Enable users to define, save, and execute custom multi-agent workflows via YAML/JSON.

**Features**:

#### 2.3.1 Workflow DSL (YAML)
```yaml
# .automatosx/workflows/auth-system.yaml
name: "Build Complete Authentication System"
version: "1.0"
description: "Database, API, Security, Tests, and Documentation"

variables:
  db_name: "users_db"
  api_port: 3000

checkpoints:
  - after_step: database-schema
    message: "Review database schema before proceeding"
    require_approval: true

steps:
  - id: database-schema
    name: "Design Database Schema"
    agent: database
    input:
      description: "Design schema for ${db_name} with users, sessions, tokens"
      constraints:
        - "Use PostgreSQL"
        - "Include soft deletes"
    timeout: 300

  - id: api-endpoints
    name: "Implement API Endpoints"
    agent: api
    depends_on: [database-schema]
    input:
      description: "Create REST API for authentication"
      base_url: "http://localhost:${api_port}"
      schema: "{{outputs.database-schema.schema}}"

  - id: security-audit
    name: "Security Review"
    agent: security
    depends_on: [api-endpoints]
    input:
      description: "Audit authentication implementation"
      focus_areas: ["JWT security", "password hashing", "rate limiting"]

  - id: testing
    name: "Write Tests"
    agent: quality
    depends_on: [api-endpoints]
    parallel_with: [security-audit]
    input:
      description: "Write comprehensive tests"
      coverage_threshold: 85

  - id: documentation
    name: "Write Documentation"
    agent: writer
    depends_on: [api-endpoints, security-audit]
    input:
      description: "Document API endpoints and security measures"

retry_policy:
  max_attempts: 3
  backoff: exponential
  backoff_multiplier: 2

on_failure:
  notify: ["email", "slack"]
  rollback: true
```

#### 2.3.2 Workflow Engine
```typescript
// src/workflow/WorkflowEngine.ts
export class WorkflowEngine {
  async loadWorkflow(path: string): Promise<Workflow> {
    const yaml = await fs.readFile(path, 'utf-8');
    const workflow = YAML.parse(yaml);
    return WorkflowSchema.parse(workflow); // Zod validation
  }

  async executeWorkflow(
    workflow: Workflow,
    options: ExecutionOptions
  ): Promise<WorkflowResult> {
    // Use ReScript WorkflowOrchestrator under the hood
    const orchestrator = new RescriptWorkflowService();

    // Convert to ReScript workflow format
    const rescriptWorkflow = this.convertToRescript(workflow);

    // Execute with state machine
    return await orchestrator.executeWorkflow(rescriptWorkflow);
  }

  async pauseWorkflow(id: string): Promise<void>;
  async resumeWorkflow(id: string): Promise<WorkflowResult>;
  async listWorkflows(): Promise<WorkflowSummary[]>;
  async deleteWorkflow(id: string): Promise<void>;
}
```

#### 2.3.3 CLI Commands
```bash
# Workflow management
ax workflow list                                  # List saved workflows
ax workflow create auth-system                    # Interactive wizard
ax workflow validate auth-system.yaml             # Validate workflow file
ax workflow run auth-system                       # Execute workflow
ax workflow run auth-system --var db_name=main_db # Override variables
ax workflow status <execution-id>                 # Check status
ax workflow pause <execution-id>                  # Pause execution
ax workflow resume <execution-id>                 # Resume paused workflow
ax workflow logs <execution-id>                   # View execution logs
```

#### 2.3.4 Workflow Templates
```typescript
// Built-in templates
const templates = {
  'full-stack-feature': {
    steps: ['database', 'backend-api', 'frontend-ui', 'tests', 'docs']
  },
  'bug-fix': {
    steps: ['investigate', 'fix', 'test', 'security-check']
  },
  'refactoring': {
    steps: ['analyze', 'plan', 'refactor', 'test', 'performance-check']
  },
  'security-hardening': {
    steps: ['audit', 'fix-vulnerabilities', 'penetration-test', 'document']
  }
};
```

**Success Criteria**:
- ✅ Users can define workflows in YAML/JSON
- ✅ Workflow validation catches errors early
- ✅ Checkpoints enable human-in-the-loop approval
- ✅ Workflows are resumable after pause/failure
- ✅ 25%+ increase in workflow reuse
- ✅ 90%+ test coverage

**Timeline**: 10 days (Days 99-108)
**Estimated LOC**: ~2,200 TypeScript + 500 YAML templates

---

### 2.4 Plugin SDK Beta

**Goal**: Enable community to extend AutomatosX with custom agents, analyzers, and tools.

**Components**:

#### 2.4.1 Plugin API
```typescript
// @automatosx/plugin-sdk
export interface AgentPlugin {
  metadata: PluginMetadata;
  initialize(context: PluginContext): Promise<void>;
  execute(task: Task, context: AgentContext): Promise<TaskResult>;
  canHandle(task: Task): number; // 0-1 confidence score
  cleanup(): Promise<void>;
}

export interface AnalyzerPlugin {
  metadata: PluginMetadata;
  analyze(code: string, language: string): Promise<AnalysisResult>;
  getSupportedLanguages(): string[];
}

export interface ToolPlugin {
  metadata: PluginMetadata;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
  getSchema(): JSONSchema; // For argument validation
}
```

#### 2.4.2 Plugin Registry
```typescript
// src/plugins/PluginRegistry.ts
export class PluginRegistry {
  async loadPlugin(path: string): Promise<Plugin> {
    // Load plugin from npm package or local directory
    const pkg = await import(path);

    // Validate plugin structure
    const plugin = PluginSchema.parse(pkg.default);

    // Sandbox execution (WASM or Node VM)
    const sandboxed = await this.sandbox(plugin);

    return sandboxed;
  }

  async installPlugin(name: string): Promise<void> {
    // npm install @automatosx/plugin-{name}
    await exec(`npm install @automatosx/plugin-${name}`);

    // Load and register
    await this.loadPlugin(`@automatosx/plugin-${name}`);
  }

  listPlugins(): PluginInfo[];
  uninstallPlugin(name: string): Promise<void>;
}
```

#### 2.4.3 Plugin Scaffold
```bash
# CLI scaffolding
ax plugin create my-agent --template agent
ax plugin create my-analyzer --template analyzer
ax plugin create my-tool --template tool

# Generates:
# my-plugin/
# ├── package.json
# ├── src/
# │   ├── index.ts
# │   └── plugin.ts
# ├── test/
# │   └── plugin.test.ts
# └── README.md
```

#### 2.4.4 Example Plugins

**Custom Agent Plugin**:
```typescript
// @automatosx/plugin-golang-expert
import { AgentPlugin, PluginMetadata } from '@automatosx/plugin-sdk';

export default class GolangExpertAgent implements AgentPlugin {
  metadata: PluginMetadata = {
    name: 'Golang Expert',
    version: '1.0.0',
    type: 'agent',
    description: 'Specialized in Go best practices and performance',
    author: 'community@example.com',
  };

  async initialize(context: PluginContext): Promise<void> {
    // Setup
  }

  canHandle(task: Task): number {
    if (task.description.toLowerCase().includes('go') ||
        task.description.toLowerCase().includes('golang')) {
      return 0.9;
    }
    return 0.0;
  }

  async execute(task: Task, context: AgentContext): Promise<TaskResult> {
    // Implementation
  }
}
```

**Custom Analyzer Plugin**:
```typescript
// @automatosx/plugin-performance-analyzer
import { AnalyzerPlugin } from '@automatosx/plugin-sdk';

export default class PerformanceAnalyzer implements AnalyzerPlugin {
  metadata = {
    name: 'Performance Analyzer',
    version: '1.0.0',
    type: 'analyzer',
  };

  getSupportedLanguages() {
    return ['typescript', 'javascript'];
  }

  async analyze(code: string, language: string): Promise<AnalysisResult> {
    // Detect performance issues:
    // - Unnecessary re-renders
    // - Memory leaks
    // - Expensive computations in loops
    return { issues: [...], score: 0.85 };
  }
}
```

**Success Criteria**:
- ✅ Plugin SDK published to npm
- ✅ Clear documentation and examples
- ✅ First 3 community plugins published
- ✅ Plugin sandboxing prevents malicious code
- ✅ Plugin discovery via `ax plugin search`
- ✅ 95%+ test coverage for SDK

**Timeline**: 8 days (Days 109-116)
**Estimated LOC**: ~1,500 TypeScript SDK + ~800 documentation

---

### 2.5 Observability Stack (OpenTelemetry)

**Goal**: Production-grade observability with traces, metrics, and logs.

**Architecture**:
```
AutomatosX → OpenTelemetry SDK → OTLP Exporter → Collector → Backend
                                                              ↓
                                                    Jaeger (traces)
                                                    Prometheus (metrics)
                                                    Loki (logs)
```

**Components**:

#### 2.5.1 Telemetry Service
```typescript
// src/telemetry/TelemetryService.ts
import { trace, metrics, logs } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

export class TelemetryService {
  private tracer: Tracer;
  private meter: Meter;
  private logger: Logger;

  async initialize(config: TelemetryConfig): Promise<void> {
    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({
        url: config.otlpEndpoint,
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: config.otlpEndpoint,
        }),
      }),
    });

    await sdk.start();

    this.tracer = trace.getTracer('automatosx');
    this.meter = metrics.getMeter('automatosx');
    this.logger = logs.getLogger('automatosx');
  }

  // Traces
  startSpan(name: string, attributes?: Attributes): Span {
    return this.tracer.startSpan(name, { attributes });
  }

  // Metrics
  recordMetric(name: string, value: number, labels?: Labels): void {
    const counter = this.meter.createCounter(name);
    counter.add(value, labels);
  }

  // Logs
  log(level: LogLevel, message: string, context?: Context): void {
    this.logger.emit({
      severityText: level,
      body: message,
      attributes: context,
    });
  }
}
```

#### 2.5.2 Instrumentation
```typescript
// Auto-instrument key operations
export function instrumentAgentExecution() {
  const originalExecute = AgentBase.prototype.execute;

  AgentBase.prototype.execute = async function(task, context) {
    const span = telemetry.startSpan('agent.execute', {
      'agent.type': this.getMetadata().type,
      'task.id': task.id,
      'task.priority': task.priority,
    });

    try {
      const result = await originalExecute.call(this, task, context);

      span.setAttributes({
        'result.success': result.success,
        'result.artifacts_count': result.artifacts?.length || 0,
      });

      telemetry.recordMetric('agent.executions', 1, {
        agent: this.getMetadata().type,
        success: result.success ? 'true' : 'false',
      });

      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  };
}
```

#### 2.5.3 Key Metrics
```typescript
// Metrics to track
const metrics = {
  // Performance
  'ax.query.latency': histogram({ buckets: [10, 50, 100, 500, 1000] }),
  'ax.index.throughput': counter(),
  'ax.cache.hit_rate': gauge(),

  // Agents
  'ax.agent.executions': counter({ labels: ['agent', 'success'] }),
  'ax.agent.latency': histogram({ labels: ['agent'] }),
  'ax.workflow.executions': counter({ labels: ['workflow', 'status'] }),

  // Resources
  'ax.memory.usage': gauge(),
  'ax.cpu.usage': gauge(),
  'ax.database.connections': gauge(),

  // Business
  'ax.users.active': gauge(),
  'ax.memory.searches': counter(),
  'ax.plugins.installed': gauge(),
};
```

#### 2.5.4 Dashboards
```yaml
# Grafana dashboard config
dashboards:
  - name: "AutomatosX Overview"
    panels:
      - title: "Request Rate"
        metric: rate(ax_agent_executions[5m])
      - title: "P95 Latency"
        metric: histogram_quantile(0.95, ax_agent_latency)
      - title: "Error Rate"
        metric: rate(ax_agent_executions{success="false"}[5m])
      - title: "Cache Hit Rate"
        metric: ax_cache_hit_rate
```

**Success Criteria**:
- ✅ All operations traced with OpenTelemetry
- ✅ Metrics exported to Prometheus-compatible backends
- ✅ Structured logs with correlation IDs
- ✅ <1% performance overhead
- ✅ Grafana dashboards for key metrics
- ✅ 90%+ test coverage

**Timeline**: 6 days (Days 117-122)
**Estimated LOC**: ~1,200 TypeScript + config files

---

### 2.6 Agent Learning & Improvement

**Goal**: Agents learn from past executions to improve suggestions and reduce errors.

**Features**:

#### 2.6.1 Execution History Analysis
```typescript
// src/agents/learning/LearningService.ts
export class AgentLearningService {
  async analyzePerformance(agentType: string): Promise<PerformanceReport> {
    // Query memory for past executions
    const executions = await memory.search({
      agent: agentType,
      limit: 1000,
      sortBy: 'date',
    });

    // Analyze patterns
    const analysis = {
      successRate: this.calculateSuccessRate(executions),
      commonFailures: this.detectFailurePatterns(executions),
      avgExecutionTime: this.calculateAvgTime(executions),
      topKeywords: this.extractTopKeywords(executions),
      improvementSuggestions: this.generateSuggestions(executions),
    };

    return analysis;
  }

  async suggestBestAgent(task: Task): Promise<AgentSuggestion[]> {
    // Find similar past tasks
    const similar = await this.findSimilarTasks(task);

    // Rank agents by historical success
    const rankings = similar
      .groupBy(exec => exec.agent)
      .map(group => ({
        agent: group.key,
        successRate: group.filter(e => e.success).length / group.length,
        avgTime: group.avgBy(e => e.executionTime),
        confidence: this.calculateConfidence(group),
      }))
      .sortBy(r => r.successRate * r.confidence)
      .reverse();

    return rankings;
  }
}
```

#### 2.6.2 Pattern Recognition
```typescript
// Detect common patterns in successful executions
export class PatternRecognizer {
  async detectPatterns(executions: Execution[]): Promise<Pattern[]> {
    // Group by task characteristics
    const successful = executions.filter(e => e.success);

    // Find common keywords, structures, approaches
    const patterns = [];

    // Pattern 1: Task complexity vs success rate
    patterns.push(this.analyzeComplexityPattern(successful));

    // Pattern 2: Agent specialization effectiveness
    patterns.push(this.analyzeSpecializationPattern(successful));

    // Pattern 3: Multi-agent collaboration success
    patterns.push(this.analyzeCollaborationPattern(successful));

    return patterns;
  }
}
```

#### 2.6.3 Intelligent Suggestions
```typescript
// Proactive suggestions based on learning
export class SuggestionEngine {
  async getSuggestions(task: Task): Promise<Suggestion[]> {
    const suggestions = [];

    // Suggest best agent based on history
    const agentSuggestion = await learning.suggestBestAgent(task);
    suggestions.push({
      type: 'agent',
      message: `Based on similar tasks, @${agentSuggestion[0].agent} has ${agentSuggestion[0].successRate * 100}% success rate`,
      confidence: agentSuggestion[0].confidence,
    });

    // Suggest workflow if task is complex
    if (this.isComplexTask(task)) {
      const workflow = await learning.suggestWorkflow(task);
      suggestions.push({
        type: 'workflow',
        message: `This task might benefit from multi-agent workflow: ${workflow.name}`,
        workflow: workflow,
      });
    }

    // Suggest context to include
    const context = await learning.suggestContext(task);
    suggestions.push({
      type: 'context',
      message: `Consider including: ${context.join(', ')}`,
      items: context,
    });

    return suggestions;
  }
}
```

#### 2.6.4 CLI Integration
```bash
# Learning commands
ax agent analyze backend              # Analyze agent performance
ax agent suggest "create REST API"    # Get agent suggestions
ax learn report                       # Overall learning report
ax learn export                       # Export learned patterns
```

**Success Criteria**:
- ✅ Agents improve suggestion accuracy by 15%+ over time
- ✅ Failure rate decreases by 10%+ with learning
- ✅ Users see proactive helpful suggestions
- ✅ Learning data exportable for analysis
- ✅ 30%+ faster issue triage (P1 goal)
- ✅ 90%+ test coverage

**Timeline**: 8 days (Days 123-130)
**Estimated LOC**: ~1,800 TypeScript

---

## 3. Technical Architecture

### 3.1 Updated System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                      │
├─────────────────────────────────────────────────────────────────┤
│  CLI (Commander.js)  │  Web UI (React)  │  LSP Server  │ VS Code│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      TypeScript Service Layer                    │
├─────────────────────────────────────────────────────────────────┤
│ Agent System │ Workflow Engine │ Plugin Registry │ Learning     │
│ Memory       │ Code Intelligence│ Provider System │ Telemetry   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      ReScript Core Runtime (P1)                  │
├─────────────────────────────────────────────────────────────────┤
│ State Machines │ Workflow Orchestrator │ Effect Runtime          │
│ Event Dispatcher│ Transition Validator  │ Guards & Policies      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Data & Storage Layer                     │
├─────────────────────────────────────────────────────────────────┤
│ SQLite (FTS5) │ FAISS (Vectors) │ Redis (Cache) │ File System   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 P1 Technology Stack

**Core**:
- ReScript 11+ (state machines, workflow orchestration)
- TypeScript 5+ (service layer, plugins)
- Node.js 20+ (runtime)

**AI & ML**:
- @xenova/transformers (embeddings)
- faiss-node (vector search)
- sentence-transformers/all-MiniLM-L6-v2 (model)

**Observability**:
- @opentelemetry/sdk-node (instrumentation)
- @opentelemetry/exporter-trace-otlp-http (traces)
- @opentelemetry/exporter-metrics-otlp-http (metrics)

**Workflow & Plugins**:
- yaml (workflow DSL parsing)
- zod (schema validation)
- vm2 (plugin sandboxing)

**Storage**:
- better-sqlite3 (SQLite driver)
- faiss-node (vector store)
- ioredis (Redis client)

### 3.3 File Structure (After P1)

```
automatosx2/
├── packages/rescript-core/     (P1: Complete ReScript integration)
│   ├── src/
│   │   ├── runtime/
│   │   │   ├── StateMachine.res
│   │   │   ├── StateMachineV2.res
│   │   │   ├── TaskStateMachine.res
│   │   │   └── EffectRuntime.res
│   │   ├── workflow/
│   │   │   ├── WorkflowOrchestrator.res
│   │   │   ├── WorkflowEngine.res
│   │   │   └── WorkflowValidator.res
│   │   └── events/
│   │       ├── EventDispatcher.res
│   │       └── EventBus.res
│   └── lib/bs/                 (Compiled JS output)
│
├── src/
│   ├── bridge/                 (P1: ReScript-TypeScript bridge)
│   │   ├── RescriptBridge.ts
│   │   ├── StateMachineService.ts
│   │   └── WorkflowService.ts
│   ├── services/
│   │   ├── EmbeddingService.ts (P1: Semantic search)
│   │   ├── HybridSearch.ts
│   │   └── LearningService.ts  (P1: Agent learning)
│   ├── workflow/               (P1: Workflow engine)
│   │   ├── WorkflowEngine.ts
│   │   ├── WorkflowParser.ts
│   │   └── WorkflowExecutor.ts
│   ├── plugins/                (P1: Plugin SDK)
│   │   ├── PluginRegistry.ts
│   │   ├── PluginLoader.ts
│   │   └── PluginSandbox.ts
│   ├── telemetry/              (P1: OpenTelemetry)
│   │   ├── TelemetryService.ts
│   │   ├── TracingService.ts
│   │   └── MetricsService.ts
│   ├── database/
│   │   ├── VectorStore.ts      (P1: FAISS integration)
│   │   └── migrations/
│   │       └── 007_embeddings.sql
│   └── cli/commands/
│       ├── semantic.ts         (P1: New commands)
│       ├── workflow.ts
│       └── plugin.ts
│
├── .automatosx/
│   ├── workflows/              (P1: User workflows)
│   │   ├── auth-system.yaml
│   │   └── bug-fix-template.yaml
│   ├── plugins/                (P1: Installed plugins)
│   └── embeddings/             (P1: Vector indices)
│
└── docs/
    ├── plugin-sdk.md           (P1: SDK documentation)
    ├── workflow-guide.md
    └── observability.md
```

---

## 4. Implementation Plan

### Phase Timeline (40 Days Total)

```
P1 Timeline: Days 81-120

Week 1 (Days 81-85): ReScript State Machines - Foundation
Week 2 (Days 86-90): ReScript State Machines - Integration
Week 3 (Days 91-95): Semantic Memory - Embeddings
Week 4 (Days 96-98): Semantic Memory - Hybrid Search
Week 5 (Days 99-103): Workflow Authoring - DSL Parser
Week 6 (Days 104-108): Workflow Authoring - Execution Engine
Week 7 (Days 109-113): Plugin SDK - Core API
Week 8 (Days 114-116): Plugin SDK - Examples & Docs
Week 9 (Days 117-120): Observability - OpenTelemetry
Week 10 (Days 121-125): Agent Learning - Pattern Recognition
Week 11 (Days 126-130): Agent Learning - Suggestions & Integration
Week 12 (Days 131-140): Testing, Documentation, Polish
```

### Detailed Sprint Plan

#### Sprint 9: ReScript State Machines (Days 81-90)

**Week 1: Foundation**
- Day 81: StateMachine core types and transitions
- Day 82: Event dispatcher and guards
- Day 83: Effect runtime and async handling
- Day 84: State persistence and recovery
- Day 85: Unit tests for state machines

**Week 2: Integration**
- Day 86: TypeScript bridge implementation
- Day 87: WorkflowOrchestrator in ReScript
- Day 88: Integration with existing agent system
- Day 89: End-to-end workflow tests
- Day 90: Documentation and examples

**Deliverables**:
- ✅ ReScript state machine library (~1,500 LOC)
- ✅ TypeScript bridge (~600 LOC)
- ✅ 45 unit tests, 95% coverage
- ✅ Workflow orchestrator integrated

#### Sprint 10: Semantic Memory (Days 91-98)

**Week 3: Embeddings**
- Day 91: EmbeddingService setup with @xenova/transformers
- Day 92: Batch embedding pipeline
- Day 93: FAISS vector store integration
- Day 94: Database schema migration for embeddings
- Day 95: Incremental indexing on memory updates

**Week 4: Search**
- Day 96: Semantic search implementation
- Day 97: Hybrid ranking (semantic + BM25)
- Day 98: CLI command and performance optimization

**Deliverables**:
- ✅ Semantic search system (~1,800 LOC)
- ✅ FAISS integration
- ✅ `ax semantic search` command
- ✅ 35 tests, 90% coverage
- ✅ <500ms query latency

#### Sprint 11: Workflow Authoring (Days 99-108)

**Week 5: DSL & Validation**
- Day 99: YAML workflow parser
- Day 100: Zod schema validation
- Day 101: Variable substitution
- Day 102: Dependency graph resolution
- Day 103: Workflow template system

**Week 6: Execution**
- Day 104: WorkflowEngine implementation
- Day 105: Checkpoint and approval system
- Day 106: Pause/resume functionality
- Day 107: Error handling and retry logic
- Day 108: CLI commands and documentation

**Deliverables**:
- ✅ Workflow authoring system (~2,200 LOC)
- ✅ 5 built-in templates
- ✅ `ax workflow` commands
- ✅ 40 tests, 90% coverage
- ✅ Human-in-the-loop support

#### Sprint 12: Plugin SDK (Days 109-116)

**Week 7: Core SDK**
- Day 109: Plugin interface definitions
- Day 110: PluginRegistry implementation
- Day 111: Plugin sandboxing (vm2)
- Day 112: Plugin lifecycle management
- Day 113: Plugin discovery and search

**Week 8: Ecosystem**
- Day 114: Plugin scaffold generator
- Day 115: Example plugins (3 types)
- Day 116: SDK documentation and publishing

**Deliverables**:
- ✅ @automatosx/plugin-sdk npm package (~1,500 LOC)
- ✅ 3 example plugins
- ✅ Plugin scaffold CLI
- ✅ Comprehensive docs
- ✅ 30 tests, 95% coverage

#### Sprint 13: Observability (Days 117-122)

**Week 9: OpenTelemetry**
- Day 117: TelemetryService setup
- Day 118: Trace instrumentation for agents
- Day 119: Metrics collection and export
- Day 120: Structured logging with correlation IDs
- Day 121: Grafana dashboards
- Day 122: Performance validation (<1% overhead)

**Deliverables**:
- ✅ Full OpenTelemetry integration (~1,200 LOC)
- ✅ 15+ key metrics tracked
- ✅ Grafana dashboard configs
- ✅ 25 tests, 90% coverage

#### Sprint 14: Agent Learning (Days 123-130)

**Week 10: Pattern Recognition**
- Day 123: Execution history analysis
- Day 124: Success rate calculation
- Day 125: Failure pattern detection
- Day 126: Similar task matching
- Day 127: Pattern recognition algorithms

**Week 11: Suggestions**
- Day 128: Agent suggestion engine
- Day 129: Workflow recommendations
- Day 130: Context suggestions and CLI integration

**Deliverables**:
- ✅ Agent learning system (~1,800 LOC)
- ✅ `ax agent analyze`, `ax agent suggest` commands
- ✅ Proactive suggestions in `ax run`
- ✅ 35 tests, 90% coverage
- ✅ 15%+ improvement in accuracy

#### Sprint 15: Polish & Documentation (Days 131-140)

**Week 12: Final Testing**
- Day 131-133: Integration testing across all P1 features
- Day 134-135: Performance benchmarking
- Day 136: Bug fixes and edge cases
- Day 137-138: Documentation updates
- Day 139: User guide and tutorials
- Day 140: Release preparation

**Deliverables**:
- ✅ All P1 features tested end-to-end
- ✅ Updated README and docs
- ✅ Migration guide from P0 to P1
- ✅ Release notes and changelog
- ✅ 450+ total tests, 88%+ coverage

---

## 5. Success Metrics

### P1 Goals (from PRD)
- ✅ 30% faster issue triage
- ✅ 25% increase in workflow reuse
- ✅ First external plugin published
- ✅ Memory recall precision >85%
- ✅ Plugin ecosystem: ≥10 community plugins within 90 days

### Technical Metrics

**Performance**:
- Semantic search latency: <500ms (P95)
- State machine overhead: <5ms per transition
- Embedding generation: <100ms per item
- Observability overhead: <1% CPU/memory

**Quality**:
- Test coverage: ≥88% across all modules
- Total tests: 450+ (P0: 320, P1: 130+)
- Zero critical bugs in production
- Documentation completeness: 100%

**Adoption**:
- Workflow reuse rate: ≥40% of users
- Plugin installations: ≥10 unique plugins
- Agent learning improvement: ≥15% accuracy gain
- User satisfaction (CSAT): ≥4.5/5

### Feature Completion Checklist

**ReScript State Machines**:
- [ ] State machine core implemented
- [ ] TypeScript bridge working
- [ ] Workflow orchestrator integrated
- [ ] 95%+ test coverage
- [ ] Documentation complete

**Semantic Memory**:
- [ ] Embedding service operational
- [ ] FAISS vector store integrated
- [ ] Hybrid search implemented
- [ ] <500ms query latency achieved
- [ ] 90%+ test coverage

**Workflow Authoring**:
- [ ] YAML DSL parser complete
- [ ] Workflow execution engine working
- [ ] Checkpoint/resume functionality
- [ ] 5+ templates available
- [ ] 90%+ test coverage

**Plugin SDK**:
- [ ] SDK published to npm
- [ ] 3 example plugins created
- [ ] Plugin sandboxing secure
- [ ] Documentation comprehensive
- [ ] 95%+ test coverage

**Observability**:
- [ ] OpenTelemetry integrated
- [ ] All operations traced
- [ ] Grafana dashboards deployed
- [ ] <1% overhead verified
- [ ] 90%+ test coverage

**Agent Learning**:
- [ ] Pattern recognition working
- [ ] Suggestion engine operational
- [ ] 15%+ accuracy improvement
- [ ] CLI commands integrated
- [ ] 90%+ test coverage

---

## 6. Risk Mitigation

### Technical Risks

**Risk 1: ReScript Integration Complexity**
- **Impact**: High (core P1 feature)
- **Probability**: Medium
- **Mitigation**:
  - Start with simple state machine, iterate
  - Thorough TypeScript bridge testing
  - Keep ReScript modules small and focused
  - Fallback: Use pure TypeScript state machines if ReScript blocks

**Risk 2: FAISS Performance at Scale**
- **Impact**: Medium (affects search quality)
- **Probability**: Low
- **Mitigation**:
  - Benchmark early with realistic data (100K+ items)
  - Use HNSW index for better performance
  - Implement caching layer
  - Fallback: Use simpler cosine similarity if FAISS issues

**Risk 3: Plugin Security**
- **Impact**: Critical (could execute malicious code)
- **Probability**: Medium
- **Mitigation**:
  - Strict sandboxing with vm2
  - Resource quotas (CPU, memory, time)
  - Plugin review process
  - Code signing for official plugins
  - Fallback: Disable plugins if security issue found

**Risk 4: OpenTelemetry Overhead**
- **Impact**: Medium (affects performance)
- **Probability**: Low
- **Mitigation**:
  - Use sampling (e.g., 10% of requests)
  - Async export to not block operations
  - Performance benchmarks before/after
  - Fallback: Make telemetry optional

### Schedule Risks

**Risk 1: ReScript Learning Curve**
- **Impact**: High (could delay Sprint 9)
- **Probability**: Medium
- **Mitigation**:
  - Team training on ReScript (2 days upfront)
  - Start with small modules
  - Pair programming for knowledge sharing
  - Buffer time in schedule (2 days)

**Risk 2: Third-Party Dependencies**
- **Impact**: Medium (could block features)
- **Probability**: Low
- **Mitigation**:
  - Evaluate all dependencies early
  - Have backup alternatives (@xenova/transformers vs ollama)
  - Lock dependency versions
  - Regular security audits

### Mitigation Strategy Summary

1. **Incremental Development**: Build P1 features incrementally, deploy to staging frequently
2. **Feature Flags**: All P1 features behind flags, can disable if issues
3. **Rollback Plan**: Can revert to P0 baseline if critical P1 bugs
4. **Buffer Time**: 10 days buffer in 40-day plan for unknowns
5. **Early Feedback**: Beta users test P1 features during development

---

## Appendix A: Dependency Management

### New Dependencies (P1)

**Core**:
- `rescript@11.1.0` - ReScript compiler
- `@xenova/transformers@2.8.0` - ML embeddings
- `faiss-node@0.5.1` - Vector search
- `@opentelemetry/sdk-node@1.18.0` - Observability

**Workflow**:
- `yaml@2.3.4` - YAML parsing
- `vm2@3.9.19` - Plugin sandboxing

**Optional**:
- `ioredis@5.3.2` - Redis caching (if needed)

### Version Pinning Strategy
- Pin major and minor versions in `package.json`
- Use `package-lock.json` for reproducible builds
- Update dependencies monthly (security patches weekly)

---

## Appendix B: Migration Path (P0 → P1)

### User-Facing Changes

**Breaking Changes**: NONE
- All P0 commands continue to work
- P1 adds new features, doesn't remove old ones

**New Features**:
- `ax semantic search` - New command
- `ax workflow` - New command family
- `ax plugin` - New command family
- `ax agent analyze` - New command
- Enhanced `ax run` with suggestions

### Data Migration

**Embeddings**:
```bash
# One-time migration to add embeddings to existing memories
ax memory reindex --embeddings
# Estimated time: 1 minute per 1000 memories
```

**Workflows**:
- No migration needed (new feature)
- Users create workflows from scratch

**Plugins**:
- No migration needed (new feature)

### Rollback Procedure

If P1 has critical issues:
```bash
# Disable P1 features via config
ax config set p1.enabled false

# Or install specific version
npm install -g automatosx-v2@2.0.0  # P0 version
```

---

## Appendix C: Documentation Plan

### Documentation Deliverables

**User Guides**:
- [ ] P1 Feature Overview
- [ ] Semantic Search Guide
- [ ] Workflow Authoring Tutorial
- [ ] Plugin Development Guide
- [ ] Observability Setup

**API Documentation**:
- [ ] Plugin SDK API Reference
- [ ] Workflow DSL Schema
- [ ] ReScript Bridge API
- [ ] Telemetry API

**Examples**:
- [ ] 5 workflow templates with explanations
- [ ] 3 example plugins (agent, analyzer, tool)
- [ ] Grafana dashboard configs
- [ ] Migration examples

**Videos/Screencasts** (optional):
- [ ] "Getting Started with Workflows" (5 min)
- [ ] "Building Your First Plugin" (10 min)
- [ ] "Understanding Agent Learning" (5 min)

---

## Summary

**P0 Status**: ✅ 100% Complete (~18,630 LOC, 320 tests)

**P1 Scope**: 6 major features over 40 days
1. ReScript State Machines (~2,500 LOC)
2. Semantic Memory (~1,800 LOC)
3. Workflow Authoring (~2,200 LOC)
4. Plugin SDK (~2,300 LOC)
5. Observability (~1,200 LOC)
6. Agent Learning (~1,800 LOC)

**P1 Total**: ~11,800 new LOC, 130+ new tests

**Combined P0+P1**: ~30,430 LOC, 450+ tests, 88%+ coverage

**Timeline**: 40 days (Days 81-120)

**Outcome**: Production-ready, best-in-class code intelligence platform with AI agents, semantic search, workflow automation, plugin ecosystem, and enterprise observability.

🎯 **Ready to execute P1!**
