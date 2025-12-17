# AutomatosX Product Requirements Document (PRD)

**Version**: 1.0.0
**Last Updated**: 2025-12-14
**Status**: Living Document

---

## Executive Summary

AutomatosX is an AI-powered workflow automation platform that orchestrates multiple LLM providers through a unified, contract-driven architecture. The system enables deterministic model routing, event-sourced memory management, comprehensive execution tracing, and post-check governance for AI coding sessions.

**Core Principle**: AutomatosX is a pure orchestrator. All authentication and credentials are delegated to external CLI tools.

---

## 1. Product Vision

### 1.1 Problem Statement

Organizations using multiple AI providers face:
- **Fragmented tooling**: Each provider has different APIs, authentication, and capabilities
- **No unified observability**: Difficult to trace decisions across AI interactions
- **Inconsistent model selection**: No deterministic control over which model handles which task
- **Governance gaps**: No systematic validation of AI-generated code changes
- **Context loss**: Conversation history scattered across sessions

### 1.2 Solution

AutomatosX provides:
- **Unified orchestration** of 6+ LLM providers through CLI adapters
- **Deterministic routing** with risk level and capability constraints
- **Full execution tracing** for auditability and replay
- **Event-sourced memory** for temporal consistency
- **Post-check governance** via policy-driven gates

**Note**: AutomatosX intentionally does NOT perform cost calculations or cost-based routing. Provider pricing changes frequently, and cost management is delegated to external tools and provider dashboards.

### 1.3 Target Users

| User Type | Primary Use Case |
|-----------|------------------|
| AI Engineers | Build and orchestrate multi-provider workflows |
| Platform Teams | Enforce governance policies on AI coding |
| DevOps | Monitor and trace AI system behavior |
| Security | Audit AI decisions and code changes |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI / MCP Server                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Workflow   │  │   Routing    │  │    Guard     │           │
│  │   Engine     │  │   Engine     │  │   System     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Memory     │  │    Trace     │  │   Provider   │           │
│  │   Domain     │  │   Domain     │  │   Adapters   │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      Contracts (Zod Schemas)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Provider CLIs                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────┐│
│  │ claude │ │ gemini │ │ codex  │ │  qwen  │ │ ax-glm │ │grok ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └─────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Package Structure

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@automatosx/contracts` | Zod schemas - Single Source of Truth | zod |
| `@automatosx/workflow-engine` | Step-by-step workflow execution | contracts |
| `@automatosx/routing-engine` | Deterministic model selection | contracts |
| `@automatosx/memory-domain` | Event-sourced conversation state | contracts |
| `@automatosx/trace-domain` | Execution tracing and replay | contracts |
| `@automatosx/provider-adapters` | CLI-based LLM integration | contracts, routing-engine |
| `@automatosx/sqlite` | SQLite persistence adapters | contracts |
| `@automatosx/guard` | Post-check governance gates | contracts, trace-domain |
| `@automatosx/mcp-server` | Model Context Protocol server | all core domains |
| `@automatosx/cli` | Command-line interface | all packages |

---

## 3. Functional Requirements

### 3.1 Contracts Package

#### 3.1.1 Workflow Contract

**Purpose**: Define executable workflow specifications

**Schema**: `Workflow`
```typescript
interface Workflow {
  workflowId: string;      // kebab-case, 1-64 chars
  version: string;         // SemVer (e.g., "1.0.0")
  name: string;            // Human-readable name
  description?: string;
  steps: WorkflowStep[];   // Ordered execution steps
  metadata?: Record<string, unknown>;
}

interface WorkflowStep {
  stepId: string;          // Unique within workflow
  name: string;
  type: 'prompt' | 'tool' | 'conditional' | 'loop' | 'parallel';
  config: Record<string, unknown>;
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
}

interface RetryPolicy {
  maxAttempts: number;           // 1-10
  backoffMs: number;             // 100-60000
  backoffMultiplier: number;     // 1-5
  retryOn?: ('timeout' | 'rate_limit' | 'server_error' | 'network_error')[];
}
```

**Validation Rules**:
- `workflowId`: `/^[a-z][a-z0-9-]{0,63}$/`
- `version`: Valid SemVer
- `steps`: Non-empty array with unique stepIds
- `retryPolicy.maxAttempts`: 1-10
- `retryPolicy.backoffMs`: 100-60000ms

---

#### 3.1.2 Routing Decision Contract

**Purpose**: Model selection with risk level and capability constraints

**Schema**: `RoutingInput`
```typescript
interface RoutingInput {
  taskType: 'chat' | 'completion' | 'code' | 'analysis' | 'creative';
  riskLevel: 'low' | 'medium' | 'high';  // default: 'medium'
  requirements?: ModelRequirements;
  context?: Record<string, unknown>;
}

interface ModelRequirements {
  minContextLength?: number;
  maxLatencyMs?: number;
  capabilities?: ModelCapability[];
  preferredProviders?: string[];
  excludedModels?: string[];
}

type ModelCapability = 'vision' | 'function_calling' | 'json_mode' | 'streaming';
type Provider = 'anthropic' | 'openai' | 'google' | 'local';
```

**Schema**: `RoutingDecision`
```typescript
interface RoutingDecision {
  selectedModel: string;
  provider: Provider;
  reasoning: string;           // Human-readable explanation
  fallbackModels: string[];    // Ordered by preference
  constraints: {
    capabilitiesMet: boolean;
    riskCompliant: boolean;
  };
}
```

**Note**: Cost/budget fields are intentionally excluded. Pricing changes frequently and cost management should be handled externally.

---

#### 3.1.3 Memory Event Contract

**Purpose**: Event-sourced conversation and context management

**Event Types**:
| Event Type | Payload | Description |
|------------|---------|-------------|
| `conversation.created` | conversationId, title | New conversation started |
| `conversation.updated` | updates | Metadata changed |
| `message.added` | message | User/assistant message |
| `memory.stored` | key, value, ttlMs | Context persisted |
| `memory.retrieved` | key, value | Context accessed |
| `memory.deleted` | key | Context removed |
| `context.snapshot` | snapshot | Full state capture |

**Schema**: `MemoryEvent`
```typescript
interface MemoryEvent {
  eventId: string;           // UUID
  aggregateId: string;       // conversationId
  type: MemoryEventType;
  timestamp: string;         // ISO8601
  version: number;           // Sequence for ordering
  payload: EventPayload;     // Discriminated union
  metadata?: EventMetadata;
}

interface EventMetadata {
  correlationId?: string;    // Request tracing
  causationId?: string;      // Event chain
  userId?: string;
}
```

---

#### 3.1.4 Trace Event Contract

**Purpose**: Full execution tracing for observability and replay

**Event Types**:
| Event Type | Status Options | Description |
|------------|----------------|-------------|
| `run.start` | running | Workflow execution begins |
| `run.end` | success, failure | Workflow execution completes |
| `decision.routing` | - | Model selection recorded |
| `step.start` | running | Step begins |
| `step.execute` | success, failure | Step completes |
| `step.end` | success, failure, skipped | Step finalized |
| `tool.invoke` | running | Tool called |
| `tool.result` | success, failure | Tool returns |
| `memory.write` | success | Memory persisted |
| `memory.read` | success | Memory retrieved |
| `error` | failure | Error captured |

**Schema**: `TraceEvent`
```typescript
interface TraceEvent {
  traceId: string;           // Execution trace ID (UUID)
  eventId: string;           // Event ID (UUID)
  parentEventId?: string;    // Parent event for hierarchy
  type: TraceEventType;
  timestamp: string;         // ISO8601 datetime
  durationMs?: number;       // Event duration
  sequence?: number;         // Ordering within trace
  payload?: Record<string, unknown>;
  context?: TraceContext;
  status?: TraceStatus;
}

interface TraceContext {
  workflowId?: string;
  stepId?: string;
  model?: string;
  provider?: string;
  userId?: string;
}
```

---

#### 3.1.5 MCP Tool Contract

**Purpose**: Model Context Protocol tool definitions

**Schema**: `McpTool`
```typescript
interface McpTool {
  name: string;              // Tool identifier
  description: string;       // Human-readable
  inputSchema: JsonSchema;   // Zod-compatible
  outputSchema?: JsonSchema;
  errorCodes: McpErrorCode[];
}

type McpErrorCode =
  | 'INVALID_INPUT'
  | 'RESOURCE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'TIMEOUT'
  | 'NOT_IMPLEMENTED';
```

---

#### 3.1.6 Guard Policy Contract

**Purpose**: Governance policy definitions

**Schema**: `Policy`
```typescript
interface Policy {
  policy_id: string;         // kebab-case identifier
  allowed_paths: string[];   // Glob patterns (supports {{variable}})
  forbidden_paths: string[]; // Glob patterns
  required_contracts: ContractType[];
  gates: GateType[];
  change_radius_limit: number;
}

type GateType = 'path_violation' | 'dependency' | 'change_radius' | 'contract_tests';
type ContractType = 'workflow' | 'routing' | 'memory' | 'trace' | 'mcp';
```

---

### 3.2 Workflow Engine

#### 3.2.1 Purpose
Execute workflows step-by-step with retry logic, timeouts, and invariant enforcement.

#### 3.2.2 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-WF-001 | Sequential Execution | Steps execute in definition order exactly |
| INV-WF-002 | Scoped Retries | Retries apply to current step only |
| INV-WF-003 | Schema Strictness | All inputs/outputs validated against schemas |
| INV-WF-004 | Unique Step IDs | No duplicate stepIds within workflow |
| INV-WF-005 | Immutable Definition | Workflow frozen after validation |

#### 3.2.3 Input/Output

**Input**: `WorkflowRunner.run(workflow, initialInput?)`
```typescript
interface RunInput {
  workflow: Workflow;
  input?: Record<string, unknown>;
}
```

**Output**: `WorkflowResult`
```typescript
interface WorkflowResult {
  success: boolean;
  workflowId: string;
  stepResults: StepResult[];
  output?: Record<string, unknown>;
  error?: WorkflowError;
  totalDurationMs: number;
}

interface StepResult {
  stepId: string;
  success: boolean;
  output?: Record<string, unknown>;
  durationMs: number;
  retryCount: number;
  error?: StepError;
}
```

#### 3.2.4 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `VALIDATION_ERROR` | Schema validation failed | No |
| `DUPLICATE_STEP_ID` | Non-unique step identifier | No |
| `STEP_EXECUTION_FAILED` | Step threw error | Maybe |
| `STEP_TIMEOUT` | Step exceeded timeoutMs | Yes |
| `MAX_RETRIES_EXCEEDED` | All retry attempts failed | No |
| `UNKNOWN_STEP_TYPE` | Unrecognized step type | No |

---

### 3.3 Routing Engine

#### 3.3.1 Purpose
Deterministically select optimal LLM model based on task requirements.

#### 3.3.2 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-RT-001 | Determinism | Identical inputs yield identical outputs |
| INV-RT-002 | Risk Gating | High risk never selects experimental models |
| INV-RT-003 | Reasoning Required | All decisions include human-readable reasoning |
| INV-RT-004 | Fallback Consistency | Fallbacks satisfy same constraints |
| INV-RT-005 | Capability Match | Selected model has all required capabilities |

#### 3.3.3 Scoring Algorithm

```
Score = BaseScore
      + TaskTypeBonus (0-20)
      + CapabilityBonus (10 per match)
      + ProviderPreference (0-10)
      - RiskPenalty (0-100 if experimental + high risk)
      - ContextPenalty (if insufficient)
```

**Disqualification Criteria**:
- Latency exceeds `maxLatencyMs` (if specified)
- Missing required capability
- Experimental model with `riskLevel: 'high'`
- Context length insufficient
- Model in `excludedModels` list

#### 3.3.4 Model Registry (Routing Engine)

| Model ID | Provider | Context | Experimental | Capabilities | Optimized For |
|----------|----------|---------|--------------|--------------|---------------|
| claude-3-opus | anthropic | 200K | No | vision, function_calling, json_mode, streaming | code, analysis, creative |
| claude-3-sonnet | anthropic | 200K | No | vision, function_calling, json_mode, streaming | chat, code, analysis |
| claude-3-haiku | anthropic | 200K | No | vision, function_calling, json_mode, streaming | chat, completion |
| gemini-pro | google | 32K | No | function_calling, json_mode, streaming | chat, completion, analysis |
| gemini-ultra | google | 128K | Yes | vision, function_calling, json_mode, streaming | code, analysis, creative |
| local-llama | local | 8K | No | streaming | chat, completion |

**Note**: Cost/pricing information is intentionally excluded from the model registry. Provider adapters (CLI) support additional models: Claude 4, GPT-4o, Gemini 2.5, Qwen, GLM, Grok. The routing engine model registry and provider adapter models are separate - routing selects from its registry, then the actual provider CLI executes with its supported models.

---

### 3.4 Memory Domain

#### 3.4.1 Purpose
Event-sourced conversation and context management with temporal consistency.

#### 3.4.2 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-MEM-001 | Event Immutability | Events never modified after storage |
| INV-MEM-002 | Pure Handlers | Event handlers have no side effects |
| INV-MEM-003 | Version Ordering | Events returned in version order |
| INV-MEM-004 | Correlation Tracing | All events support correlationId |
| INV-MEM-005 | Optimistic Concurrency | Version conflicts detected |

#### 3.4.3 State Model

```typescript
interface ConversationState {
  conversationId: string;
  title?: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface Message {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount?: number;
  timestamp: string;
}
```

#### 3.4.4 Operations

| Operation | Input | Output | Events Emitted |
|-----------|-------|--------|----------------|
| `create` | conversationId, options | ConversationState | conversation.created |
| `addMessage` | conversationId, message | ConversationState | message.added |
| `update` | conversationId, updates | ConversationState | conversation.updated |
| `get` | conversationId | ConversationState | - |
| `getAtVersion` | conversationId, version | ConversationState | - |

---

### 3.5 Trace Domain

#### 3.5.1 Purpose
Full execution trace capture for observability, debugging, and decision replay.

#### 3.5.2 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-TR-001 | Complete Chain | Every trace has run.start and run.end |
| INV-TR-002 | Strict Ordering | Events ordered by sequence number |
| INV-TR-003 | Replay Capability | Traces enable full decision replay |
| INV-TR-004 | Trace Isolation | Each trace independent |
| INV-TR-005 | Error Traceability | Errors include full context |

#### 3.5.3 Operations

| Operation | Input | Output | Description |
|-----------|-------|--------|-------------|
| `startTrace` | workflowId, options | traceId | Initialize trace |
| `endTrace` | traceId, success, output | void | Finalize trace |
| `recordEvent` | traceId, type, payload | eventId | Add event |
| `recordError` | traceId, code, message | eventId | Capture error |
| `getTrace` | traceId | Trace | Retrieve full trace |
| `analyze` | traceId | TraceAnalysis | Analyze decisions |

#### 3.5.4 Analysis Output

```typescript
interface TraceAnalysis {
  traceId: string;
  summary: {
    totalEvents: number;
    totalDurationMs: number;
    status: 'success' | 'failure';
  };
  routing: {
    decisions: RoutingDecision[];
    modelsUsed: string[];
    providersUsed: string[];
  };
  errors: {
    count: number;
    codes: string[];
    messages: string[];
  };
  timeline: TimelineEvent[];
}
```

---

### 3.6 Provider Adapters

#### 3.6.1 Purpose
CLI-based LLM provider integration with unified interface.

#### 3.6.2 Supported Providers

| Provider | CLI Command | Auth Method | Output Format |
|----------|-------------|-------------|---------------|
| Claude | `claude` | ~/.claude/ | stream-json |
| Gemini | `gemini` | Google Cloud | stream-json |
| Codex | `codex exec` | OpenAI | stream-json |
| Qwen | `qwen` | DashScope | stream-json |
| GLM | `ax-glm` | ZAI_API_KEY | stream-json |
| Grok | `ax-grok` | XAI_API_KEY | stream-json |

#### 3.6.3 Interface

```typescript
interface LLMProvider {
  providerId: string;

  complete(request: CompletionRequest): Promise<CompletionResponse>;
  checkHealth(): Promise<HealthCheckResult>;
  supportsModel(model: string): boolean;
  getModels(): readonly ModelConfig[];
  isAvailable(): Promise<boolean>;
  estimateTokens(text: string): number;
}

interface CompletionRequest {
  requestId: string;
  messages: Message[];
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface CompletionResponse {
  success: boolean;
  requestId: string;
  content?: string;
  model?: string;
  usage?: TokenUsage;
  stopReason?: string;
  latencyMs: number;
  error?: ClassifiedError;
}
```

#### 3.6.4 Error Classification

| Category | Retryable | Fallback | Examples |
|----------|-----------|----------|----------|
| `network_error` | Yes | No | Connection refused |
| `timeout` | Yes | Yes | Request timed out |
| `rate_limit` | Yes | Yes | 429 Too Many Requests |
| `auth_error` | No | No | Invalid API key |
| `invalid_input` | No | No | Malformed request |
| `server_error` | Yes | Yes | 500 Internal Error |

---

### 3.7 SQLite Adapter

#### 3.7.1 Purpose
Persistent storage adapters for event stores and trace stores using SQLite.

#### 3.7.2 Components

**SqliteEventStore**
- Implements `EventStore` interface from memory-domain
- Persistent event storage with SQLite
- Supports: `append()`, `getEvents()`, `getEventsByType()`, `getVersion()`

**SqliteTraceStore**
- Implements `TraceStore` interface from trace-domain
- Persistent trace storage with SQLite
- Supports: `saveTrace()`, `getTrace()`, `listTraces()`, `deleteTrace()`

#### 3.7.3 Factory Functions

```typescript
// Create SQLite event store
const eventStore = createSqliteEventStore({
  filename: './data/events.db'
});

// Create SQLite trace store
const traceStore = createSqliteTraceStore({
  filename: './data/traces.db'
});
```

#### 3.7.4 Error Codes

| Code | Description |
|------|-------------|
| `DATABASE_ERROR` | SQLite operation failed |
| `SERIALIZATION_ERROR` | JSON serialization failed |
| `NOT_FOUND` | Record not found |
| `CONSTRAINT_VIOLATION` | Unique constraint violated |

---

### 3.8 Guard System

#### 3.8.1 Purpose
Post-check AI coding governance to validate changes before merge.

#### 3.8.2 Built-in Policies

**provider-refactor**
```yaml
allowed_paths:
  - packages/adapters/providers/src/providers/{{target}}/**
  - packages/adapters/providers/src/providers/{{target}}.ts
  - tests/integration/providers/**
forbidden_paths:
  - packages/contracts/**
  - packages/core/**
  - packages/cli/**
  - packages/mcp-server/**
  - packages/guard/**
required_contracts: [routing, trace]
gates: [path_violation, dependency, change_radius, contract_tests]
change_radius_limit: 2
```

**bugfix**
```yaml
allowed_paths:
  - packages/**
forbidden_paths:
  - packages/contracts/**
required_contracts: []
gates: [path_violation, change_radius]
change_radius_limit: 3
```

**rebuild**
```yaml
allowed_paths:
  - packages/**
  - tests/**
forbidden_paths: []
required_contracts: [workflow, routing, memory, trace, mcp]
gates: [dependency, contract_tests]
change_radius_limit: 10
```

#### 3.8.3 Gates

| Gate | Purpose | Failure Condition |
|------|---------|-------------------|
| `path_violation` | Check file paths | File in forbidden_paths or outside allowed_paths |
| `change_radius` | Limit package scope | More than N packages modified |
| `dependency` | Check imports | Import violates layer boundaries |
| `contract_tests` | Verify contracts | Contract tests fail or modified |

#### 3.8.4 Output

```typescript
interface GuardResult {
  status: 'PASS' | 'FAIL' | 'WARN';
  policyId: string;
  target: string;
  gates: GateResult[];
  summary: string;
  suggestions: string[];
  timestamp: string;
}

interface GateResult {
  gate: GateType;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: Record<string, unknown>;
}
```

---

### 3.9 CLI

#### 3.9.1 Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `run` | `ax run <workflow-id> [--input JSON]` | Execute workflow |
| `list` | `ax list [--limit N]` | List workflows |
| `trace` | `ax trace [trace-id]` | View traces |
| `doctor` | `ax doctor [provider]` | System diagnostics |
| `guard` | `ax guard check --policy P --target T` | Run governance |
| `call` | `ax call <provider> <prompt>` | Direct provider call |
| `help` | `ax help` | Show usage |
| `version` | `ax version` | Show version |

#### 3.9.2 Global Options

| Option | Description |
|--------|-------------|
| `--verbose, -v` | Enable verbose output |
| `--format` | Output format: text (default) or json |
| `--help, -h` | Show help |
| `--version, -V` | Show version |

#### 3.9.3 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error or failure |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target |
|--------|--------|
| Workflow step latency overhead | < 10ms |
| Routing decision time | < 5ms |
| Memory event append | < 1ms |
| Trace event record | < 1ms |
| CLI command startup | < 100ms |

### 4.2 Reliability

| Requirement | Description |
|-------------|-------------|
| Retry resilience | Exponential backoff with configurable limits |
| Fallback chains | Automatic model failover on errors |
| Graceful degradation | Continue on non-critical failures |
| Event durability | Events persisted before acknowledgment |

### 4.3 Security

| Requirement | Description |
|-------------|-------------|
| Credential isolation | AutomatosX never stores API keys |
| CLI delegation | External CLIs handle authentication |
| Input validation | All inputs validated via Zod schemas |
| Path restrictions | Guard enforces allowed/forbidden paths |

### 4.4 Observability

| Requirement | Description |
|-------------|-------------|
| Full tracing | Every execution fully traceable |
| Decision audit | All routing decisions recorded |
| Error context | Errors include full execution context |
| Replay capability | Traces enable decision replay |

---

## 5. Design Principles

### 5.1 Contract-Driven Development
- All behavior defined by Zod schemas
- Single source of truth in contracts package
- Validation at all boundaries

### 5.2 Event Sourcing
- Immutable event logs
- State reconstructed from events
- Temporal queries supported

### 5.3 Determinism
- Same inputs yield same outputs
- Stable sorting for reproducibility
- No hidden state dependencies

### 5.4 Isolation
- Each domain independently deployable
- Clear dependency boundaries
- No circular dependencies

### 5.5 Credential Delegation
- AutomatosX is a pure orchestrator
- External CLIs own authentication
- No secrets in application code

---

## 6. Future Roadmap

### 6.1 Phase 2: Advanced Persistence
- PostgreSQL event store adapter
- Trace archival and retention policies
- Event stream partitioning

### 6.2 Phase 3: Advanced Routing
- Latency-based routing optimization
- A/B testing support
- Custom scoring plugins

### 6.3 Phase 4: Enterprise Features
- Multi-tenant isolation
- RBAC for policies
- SSO integration

### 6.4 Phase 5: Ecosystem
- Plugin system
- Custom gate development
- Third-party provider adapters

---

## 7. Glossary

| Term | Definition |
|------|------------|
| **Aggregate** | Event-sourced entity with state from events |
| **Contract** | Zod schema defining interface shape |
| **Gate** | Governance check in Guard system |
| **Invariant** | Condition that must always hold |
| **MCP** | Model Context Protocol |
| **Policy** | Governance rules for code changes |
| **Provider** | External LLM service (Claude, Gemini, etc.) |
| **Routing** | Model selection process |
| **Trace** | Complete execution record |
| **Workflow** | Sequence of executable steps |

---

## 8. References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Claude CLI](https://docs.anthropic.com/claude-code)
- [OpenAI Codex CLI](https://github.com/openai/codex)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-14 | AutomatosX Team | Initial PRD |
