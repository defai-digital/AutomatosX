# AutomatosX Agentic Product Requirements Document (PRD)

**Version**: 2.1.0
**Last Updated**: 2025-12-14
**Status**: Living Document

---

## Executive Summary

AutomatosX is an AI-powered agentic workflow automation platform that orchestrates multiple LLM providers through a unified, contract-driven architecture. The system enables deterministic model routing, event-sourced memory management, comprehensive execution tracing, multi-agent orchestration, and post-check governance for AI coding sessions.

### Core Principles

1. **Contract-Driven**: All behavior defined by Zod schemas as single source of truth
2. **Domain-Driven**: Clear boundaries with explicit aggregate roots
3. **Behavior-Driven**: Explicit invariants with testable guarantees
4. **Governance-Driven**: Policy enforcement for code and agent behavior

### Design Decisions

- **No Cost-Based Routing**: Provider pricing changes frequently; cost management delegated to external tools
- **Credential Delegation**: AutomatosX is a pure orchestrator; external CLIs own authentication
- **Event Sourcing**: Immutable event logs enable temporal queries and replay

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Contract Foundation](#2-contract-foundation)
3. [Domain Model](#3-domain-model)
4. [Workflow Domain](#4-workflow-domain)
5. [Agent Domain](#5-agent-domain)
6. [Session Domain](#6-session-domain)
7. [Routing Domain](#7-routing-domain)
8. [Memory Domain](#8-memory-domain)
9. [Trace Domain](#9-trace-domain)
10. [Provider Domain](#10-provider-domain)
11. [Token Budget Domain](#11-token-budget-domain)
12. [Guard Domain](#12-guard-domain)
13. [CLI & MCP Server](#13-cli--mcp-server)
14. [Cross-Cutting Concerns](#14-cross-cutting-concerns)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Future Roadmap](#16-future-roadmap)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI / MCP Server                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Agent     │  │   Workflow   │  │   Routing    │           │
│  │   Domain     │  │   Domain     │  │   Domain     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Session    │  │    Guard     │  │    Token     │           │
│  │   Domain     │  │   Domain     │  │   Budget     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Memory     │  │    Trace     │  │   Provider   │           │
│  │   Domain     │  │   Domain     │  │   Domain     │           │
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

### 1.2 Package Structure

| Package | Purpose | Dependencies |
|---------|---------|--------------|
| `@defai.digital/contracts` | Zod schemas - Single Source of Truth | zod |
| `@defai.digital/workflow-domain` | Workflow execution engine | contracts |
| `@defai.digital/agent-domain` | Agent profiles and orchestration | contracts, workflow-domain |
| `@defai.digital/session-domain` | Session lifecycle management | contracts |
| `@defai.digital/routing-domain` | Deterministic model selection | contracts |
| `@defai.digital/memory-domain` | Event-sourced conversation state | contracts |
| `@defai.digital/trace-domain` | Execution tracing and replay | contracts |
| `@defai.digital/token-budget` | Context window management | contracts |
| `@defai.digital/provider-domain` | CLI-based LLM integration | contracts, routing-domain |
| `@defai.digital/guard-domain` | Governance gates | contracts, trace-domain |
| `@defai.digital/sqlite` | SQLite persistence adapters | contracts |
| `@defai.digital/mcp-server` | Model Context Protocol server | all domains |
| `@defai.digital/cli` | Command-line interface | all packages |

---

## 2. Contract Foundation

### 2.1 Naming Conventions

All schema fields use **camelCase** consistently:
```typescript
// ✅ Correct
interface Policy {
  policyId: string;
  allowedPaths: string[];
  forbiddenPaths: string[];
  requiredContracts: ContractType[];
}

// ❌ Incorrect (legacy - migrate)
interface Policy {
  policy_id: string;  // Use policyId
  allowed_paths: string[];  // Use allowedPaths
}
```

### 2.2 Contract Versioning Strategy

```typescript
/**
 * Contract Version Schema
 * All contracts include version for evolution tracking
 */
interface ContractVersion {
  major: number;  // Breaking changes
  minor: number;  // Additive changes
  patch: number;  // Bug fixes
}

/**
 * Schema Evolution Rules:
 * 1. New optional fields = minor version bump
 * 2. Removed fields = major version bump (with deprecation period)
 * 3. Type changes = major version bump
 * 4. Validation rule changes = patch or minor depending on strictness
 */

// Deprecation marker
interface DeprecatedField {
  /** @deprecated Use `newFieldName` instead. Removal in v3.0.0 */
  oldFieldName?: string;
  newFieldName: string;
}
```

### 2.3 Base Event Schema

All domain events extend this base:
```typescript
interface BaseEvent {
  eventId: string;           // UUID v4
  timestamp: string;         // ISO8601
  version: number;           // Event sequence

  // Correlation chain (required for all events)
  correlationId: string;     // Request chain ID
  causationId?: string;      // Parent event ID

  // Observability
  spanId?: string;           // OpenTelemetry span
  traceId?: string;          // OpenTelemetry trace
}
```

### 2.4 Pagination Schema

Standard pagination for all list operations:
```typescript
interface PaginationRequest {
  limit?: number;            // Max 1000, default 100
  offset?: number;           // For offset-based
  cursor?: string;           // For cursor-based
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}
```

### 2.5 Idempotency Schema

All mutating operations support idempotency:
```typescript
interface IdempotentRequest {
  idempotencyKey?: string;   // Client-provided UUID
  // If same key sent twice, return cached result
}

interface IdempotentResponse {
  idempotencyKey: string;
  cached: boolean;           // True if returned from cache
  cachedAt?: string;         // When original response was cached
}
```

---

## 3. Domain Model

### 3.1 Aggregate Roots

Each domain has explicit aggregate roots:

| Domain | Aggregate Root | Identity | Events |
|--------|---------------|----------|--------|
| Workflow | `Workflow` | workflowId | workflow.* |
| Agent | `AgentProfile` | agentId | agent.* |
| Session | `Session` | sessionId | session.* |
| Memory | `Conversation` | conversationId | conversation.*, message.*, memory.* |
| Trace | `Trace` | traceId | trace.*, step.*, tool.* |
| Routing | `RoutingDecision` | requestId | routing.* |

### 3.2 Aggregate Root Schema

```typescript
interface AggregateRoot {
  type: AggregateType;
  id: string;                // UUID
  version: number;           // For optimistic concurrency
  createdAt: string;         // ISO8601
  updatedAt: string;         // ISO8601
}

type AggregateType =
  | 'Workflow'
  | 'AgentProfile'
  | 'Session'
  | 'Conversation'
  | 'Trace'
  | 'RoutingDecision';
```

### 3.3 Domain Event Registry

```typescript
type DomainEventType =
  // Workflow Events
  | 'workflow.created'
  | 'workflow.started'
  | 'workflow.stepStarted'
  | 'workflow.stepCompleted'
  | 'workflow.stepFailed'
  | 'workflow.completed'
  | 'workflow.failed'

  // Agent Events
  | 'agent.registered'
  | 'agent.started'
  | 'agent.stageStarted'
  | 'agent.stageCompleted'
  | 'agent.stageFailed'
  | 'agent.delegated'
  | 'agent.delegationReturned'
  | 'agent.completed'
  | 'agent.failed'

  // Session Events
  | 'session.created'
  | 'session.agentJoined'
  | 'session.taskStarted'
  | 'session.taskCompleted'
  | 'session.completed'
  | 'session.failed'

  // Memory Events
  | 'conversation.created'
  | 'conversation.updated'
  | 'message.added'
  | 'memory.stored'
  | 'memory.retrieved'
  | 'memory.deleted'
  | 'context.snapshot'

  // Trace Events
  | 'trace.started'
  | 'trace.ended'
  | 'step.started'
  | 'step.executed'
  | 'step.ended'
  | 'tool.invoked'
  | 'tool.resulted'
  | 'error.captured'

  // Routing Events
  | 'routing.requested'
  | 'routing.decided'
  | 'routing.fallbackUsed';
```

---

## 4. Workflow Domain

### 4.1 Purpose

Execute workflows step-by-step with retry logic, timeouts, and invariant enforcement.

### 4.2 Unified Workflow Step Schema

```typescript
/**
 * Unified WorkflowStep - used by both Workflow Engine and Agent System
 */
interface WorkflowStep {
  stepId: string;              // Unique within workflow
  name: string;                // Human-readable name
  description?: string;        // Step description

  // Step Type
  type: StepType;
  config: Record<string, unknown>;

  // Execution Control
  dependencies?: string[];     // Step IDs this depends on
  condition?: string;          // Expression to evaluate
  parallel?: boolean;          // Run in parallel with siblings

  // Retry & Timeout
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;

  // Agent-specific extensions
  keyQuestions?: string[];     // Questions to answer in this step
  outputs?: string[];          // Expected outputs
  streaming?: boolean;         // Enable streaming output
  saveToMemory?: boolean;      // Persist results to memory
  checkpoint?: boolean;        // Create checkpoint after step
}

type StepType = 'prompt' | 'tool' | 'conditional' | 'loop' | 'parallel' | 'delegate';

interface RetryPolicy {
  maxAttempts: number;         // 1-10
  backoffMs: number;           // 100-60000
  backoffMultiplier: number;   // 1-5
  retryOn?: RetryCondition[];
}

type RetryCondition = 'timeout' | 'rateLimit' | 'serverError' | 'networkError';
```

### 4.3 Workflow Schema

```typescript
interface Workflow {
  workflowId: string;          // kebab-case, 1-64 chars
  version: string;             // SemVer (e.g., "1.0.0")
  name: string;                // Human-readable name
  description?: string;
  steps: WorkflowStep[];       // Ordered execution steps
  metadata?: Record<string, unknown>;
}
```

### 4.4 Workflow Result Schema

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
  skipped: boolean;
  error?: StepError;
}
```

### 4.5 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-WF-001 | Sequential Execution | Steps execute in dependency order |
| INV-WF-002 | Scoped Retries | Retries apply to current step only |
| INV-WF-003 | Schema Strictness | All inputs/outputs validated against schemas |
| INV-WF-004 | Unique Step IDs | No duplicate stepIds within workflow |
| INV-WF-005 | Immutable Definition | Workflow frozen after validation |
| INV-WF-006 | Dependency Acyclic | Step dependencies form DAG (no cycles) |

### 4.6 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `WORKFLOW_VALIDATION_ERROR` | Schema validation failed | No |
| `WORKFLOW_DUPLICATE_STEP_ID` | Non-unique step identifier | No |
| `WORKFLOW_CYCLIC_DEPENDENCY` | Circular dependency detected | No |
| `WORKFLOW_STEP_FAILED` | Step threw error | Maybe |
| `WORKFLOW_STEP_TIMEOUT` | Step exceeded timeoutMs | Yes |
| `WORKFLOW_MAX_RETRIES` | All retry attempts failed | No |
| `WORKFLOW_UNKNOWN_STEP_TYPE` | Unrecognized step type | No |
| `WORKFLOW_DEPENDENCY_FAILED` | Dependent step failed | No |

---

## 5. Agent Domain

### 5.1 Purpose

Manage specialized AI agents with defined workflows, personalities, abilities, and orchestration rules.

### 5.2 Agent Profile Schema

```typescript
interface AgentProfile {
  // Identity
  agentId: string;             // alphanumeric with dash/underscore, 1-50 chars
  displayName?: string;        // Human-friendly name, max 100 chars
  version?: string;            // SemVer format
  description: string;         // Required description

  // Role and Expertise
  role?: string;               // Agent's primary role
  expertise?: string[];        // Areas of expertise
  capabilities?: string[];     // What the agent can do

  // System Prompt
  systemPrompt?: string;       // Base system prompt

  // Workflow Definition (uses unified WorkflowStep)
  workflow?: WorkflowStep[];

  // Personality
  personality?: AgentPersonality;

  // Abilities
  abilities?: AbilitySelection;

  // Thinking Patterns
  thinkingPatterns?: string[];

  // Dependencies
  dependencies?: string[];     // Other agents this depends on

  // Execution Settings
  parallel?: boolean;          // Enable parallel execution
  temperature?: number;        // 0-2, model temperature
  maxTokens?: number;          // Max output tokens

  // Orchestration
  orchestration?: OrchestrationConfig;

  // Selection Metadata
  selectionMetadata?: SelectionMetadata;

  // Team and Collaboration
  team?: string;               // Team this agent belongs to
  collaboratesWith?: string[]; // Agents this can collaborate with

  // Additional Metadata
  tags?: string[];
  priority?: number;           // 1-100
  enabled?: boolean;           // default: true
  metadata?: Record<string, unknown>;
}
```

### 5.3 Supporting Schemas

```typescript
interface AgentPersonality {
  traits?: string[];
  catchphrase?: string;
  communicationStyle?: string;
  decisionMaking?: string;
}

interface AbilitySelection {
  core?: string[];                      // Always loaded
  taskBased?: Record<string, string[]>; // Per task type
  loadAll?: boolean;
}

interface OrchestrationConfig {
  maxDelegationDepth?: number;          // Max delegation chain length
  canReadWorkspaces?: string[];         // Accessible workspaces
  canWriteToShared?: boolean;           // Shared workspace write access
  delegationTimeout?: number;           // Timeout for delegated tasks
}

interface SelectionMetadata {
  primaryIntents?: string[];
  secondarySignals?: string[];
  negativeIntents?: string[];
  redirectWhen?: RedirectRule[];
  keywords?: string[];
  antiKeywords?: string[];
}

interface RedirectRule {
  phrase: string;    // Regex pattern
  suggest: string;   // Agent to suggest
}
```

### 5.4 Agent Execution Options

```typescript
interface AgentRunOptions {
  // Memory
  memory?: boolean;
  saveMemory?: boolean;

  // Session
  sessionId?: string;
  createSession?: boolean;

  // Provider
  provider?: string;
  model?: string;

  // Output
  format?: 'text' | 'json';
  verbose?: boolean;
  debug?: boolean;
  quiet?: boolean;

  // Execution
  parallel?: boolean;
  streaming?: boolean;
  resumable?: boolean;
  checkpoint?: boolean;

  // Idempotency
  idempotencyKey?: string;
}
```

### 5.5 Agent Domain Events

```typescript
interface AgentEvent extends BaseEvent {
  aggregateId: string;         // agentId
  type: AgentEventType;
  payload: AgentEventPayload;
}

type AgentEventType =
  | 'agent.registered'
  | 'agent.started'
  | 'agent.stageStarted'
  | 'agent.stageCompleted'
  | 'agent.stageFailed'
  | 'agent.delegated'
  | 'agent.delegationReturned'
  | 'agent.completed'
  | 'agent.failed';

type AgentEventPayload =
  | { type: 'registered'; profile: AgentProfile }
  | { type: 'started'; sessionId?: string; input: unknown }
  | { type: 'stageStarted'; stepId: string; stageName: string }
  | { type: 'stageCompleted'; stepId: string; output: unknown }
  | { type: 'stageFailed'; stepId: string; error: AgentError }
  | { type: 'delegated'; targetAgent: string; task: string }
  | { type: 'delegationReturned'; fromAgent: string; result: unknown }
  | { type: 'completed'; output: unknown; durationMs: number }
  | { type: 'failed'; error: AgentError };
```

### 5.6 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-AG-001 | Profile Validation | All profiles validated against schema |
| INV-AG-002 | Unique Names | Agent names unique within workspace |
| INV-AG-003 | Dependency Resolution | Dependencies resolved before execution |
| INV-AG-004 | Stage Ordering | Stages execute in defined order |
| INV-AG-005 | Checkpoint Recovery | Execution resumable from checkpoints |
| INV-AG-006 | Delegation Depth | maxDelegationDepth strictly enforced |
| INV-AG-007 | Agent Isolation | Agents cannot access other agents' private state |

### 5.7 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `AGENT_NOT_FOUND` | Agent profile not found | No |
| `AGENT_VALIDATION_ERROR` | Profile validation failed | No |
| `AGENT_DELEGATION_DEPTH_EXCEEDED` | Max delegation depth reached | No |
| `AGENT_DELEGATION_TIMEOUT` | Delegated task timed out | Yes |
| `AGENT_STAGE_FAILED` | Stage execution failed | Maybe |
| `AGENT_DEPENDENCY_FAILED` | Dependent agent failed | No |
| `AGENT_PERMISSION_DENIED` | Agent lacks required permission | No |
| `AGENT_ALREADY_RUNNING` | Agent already executing | No |

---

## 6. Session Domain

### 6.1 Purpose

Track multi-agent collaboration, task progress, and shared state across agent executions.

### 6.2 Session Schema

```typescript
interface Session {
  sessionId: string;           // UUID
  initiator: string;           // Agent that started session
  task: string;                // Task description (max 5KB)
  participants: SessionParticipant[];
  status: SessionStatus;
  createdAt: string;           // ISO8601
  updatedAt: string;           // ISO8601
  completedAt?: string;        // ISO8601
  version: number;             // Optimistic concurrency
  metadata?: Record<string, unknown>;
}

interface SessionParticipant {
  agentId: string;
  role: 'initiator' | 'collaborator' | 'delegate';
  joinedAt: string;
  leftAt?: string;
  tasks: SessionTask[];
}

interface SessionTask {
  taskId: string;              // UUID
  title: string;               // Max 500 chars
  status: TaskStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: SessionError;
}
```

### 6.3 State Machine: Session Status

```typescript
type SessionStatus = 'active' | 'completed' | 'failed';

const SESSION_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  active: ['completed', 'failed'],
  completed: [],  // Terminal
  failed: [],     // Terminal
};
```

### 6.4 State Machine: Task Status

```typescript
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],   // Terminal
  failed: ['pending'],  // Retry allowed
  cancelled: [],   // Terminal
};
```

### 6.5 Session Domain Events

```typescript
interface SessionEvent extends BaseEvent {
  aggregateId: string;         // sessionId
  type: SessionEventType;
  payload: SessionEventPayload;
}

type SessionEventType =
  | 'session.created'
  | 'session.agentJoined'
  | 'session.agentLeft'
  | 'session.taskStarted'
  | 'session.taskCompleted'
  | 'session.taskFailed'
  | 'session.completed'
  | 'session.failed';
```

### 6.6 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-SS-001 | Single Active | Agent can have one active session per workspace |
| INV-SS-002 | Task Tracking | All tasks tracked with status |
| INV-SS-003 | State Consistency | Session state always consistent |
| INV-SS-004 | Valid Transitions | Status changes follow state machine |
| INV-SS-005 | Optimistic Concurrency | Version conflicts detected |
| INV-SS-006 | Initiator Required | Session must have initiator |

### 6.7 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `SESSION_NOT_FOUND` | Session not found | No |
| `SESSION_ALREADY_COMPLETED` | Session already terminal | No |
| `SESSION_CONCURRENT_MODIFICATION` | Version conflict | Yes |
| `SESSION_INVALID_TRANSITION` | Invalid status transition | No |
| `SESSION_AGENT_NOT_PARTICIPANT` | Agent not in session | No |
| `SESSION_TASK_NOT_FOUND` | Task not found in session | No |
| `SESSION_MAX_PARTICIPANTS` | Max participants reached | No |

---

## 7. Routing Domain

### 7.1 Purpose

Deterministically select optimal LLM model based on task requirements.

### 7.2 Routing Input Schema

```typescript
interface RoutingInput {
  taskType: TaskType;
  riskLevel: RiskLevel;        // default: 'medium'
  requirements?: ModelRequirements;
  context?: Record<string, unknown>;
}

type TaskType = 'chat' | 'completion' | 'code' | 'analysis' | 'creative';
type RiskLevel = 'low' | 'medium' | 'high';

interface ModelRequirements {
  minContextLength?: number;
  maxLatencyMs?: number;
  capabilities?: ModelCapability[];
  preferredProviders?: Provider[];
  excludedModels?: string[];
}

type ModelCapability = 'vision' | 'functionCalling' | 'jsonMode' | 'streaming';
type Provider = 'anthropic' | 'openai' | 'google' | 'local';
```

### 7.3 Routing Decision Schema

```typescript
interface RoutingDecision {
  requestId: string;           // UUID
  selectedModel: string;
  provider: Provider;
  reasoning: string;           // Human-readable explanation
  fallbackModels: string[];    // Ordered by preference
  constraints: RoutingConstraints;
  timestamp: string;           // ISO8601
}

interface RoutingConstraints {
  capabilitiesMet: boolean;
  riskCompliant: boolean;
  latencyCompliant: boolean;
}
```

### 7.4 Scoring Algorithm

```
Score = BaseScore (50)
      + TaskTypeBonus (0-20)      // Model optimized for task
      + CapabilityBonus (10 per match)
      + ProviderPreference (0-10)
      + PriorityScore (0-50)      // Model priority
      - ContextPenalty (100 if insufficient)

Disqualification:
  - Experimental model with riskLevel: 'high' → score = 0
  - Missing required capability → score = 0
  - Context length insufficient → score = 0
  - Model in excludedModels → score = 0
  - Latency exceeds maxLatencyMs → score = 0
```

### 7.5 Model Registry

| Model ID | Provider | Context | Experimental | Capabilities | Optimized For |
|----------|----------|---------|--------------|--------------|---------------|
| claude-3-opus | anthropic | 200K | No | vision, functionCalling, jsonMode, streaming | code, analysis, creative |
| claude-3-sonnet | anthropic | 200K | No | vision, functionCalling, jsonMode, streaming | chat, code, analysis |
| claude-3-haiku | anthropic | 200K | No | vision, functionCalling, jsonMode, streaming | chat, completion |
| gemini-pro | google | 32K | No | functionCalling, jsonMode, streaming | chat, completion, analysis |
| gemini-ultra | google | 128K | Yes | vision, functionCalling, jsonMode, streaming | code, analysis, creative |
| local-llama | local | 8K | No | streaming | chat, completion |

**Note**: Cost/pricing information is intentionally excluded.

### 7.6 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-RT-001 | Determinism | Identical inputs yield identical outputs |
| INV-RT-002 | Risk Gating | High risk never selects experimental models |
| INV-RT-003 | Reasoning Required | All decisions include human-readable reasoning |
| INV-RT-004 | Fallback Consistency | Fallbacks satisfy same constraints |
| INV-RT-005 | Capability Match | Selected model has all required capabilities |

### 7.7 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `ROUTING_NO_SUITABLE_MODEL` | No model meets requirements | No |
| `ROUTING_CAPABILITY_NOT_FOUND` | Required capability unavailable | No |
| `ROUTING_INVALID_INPUT` | Input validation failed | No |

---

## 8. Memory Domain

### 8.1 Purpose

Event-sourced conversation and context management with temporal consistency.

### 8.2 Memory Entry Schema

```typescript
interface MemoryEntry {
  id: number;                  // Auto-increment
  content: string;             // Max 100KB
  metadata: MemoryMetadata;
  createdAt: string;           // ISO8601
  lastAccessedAt?: string;
  accessCount: number;
}

interface MemoryMetadata {
  type: string;                // Max 100 chars
  source: string;              // Max 200 chars
  agentId?: string;
  sessionId?: string;          // UUID
  tags?: string[];             // Max 20 tags, each max 50 chars
  importance?: number;         // 0-1
  description?: string;        // Max 500 chars
}
```

### 8.3 Conversation State Schema

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

### 8.4 Memory Cleanup Configuration

```typescript
interface MemoryCleanupConfig {
  enabled?: boolean;
  strategy?: CleanupStrategy;
  triggerThreshold?: number;   // 0.5-1.0
  targetThreshold?: number;    // 0.1-0.9
  minCleanupCount?: number;
  maxCleanupCount?: number;
  retentionDays?: number;      // Max 365
}

type CleanupStrategy = 'oldest' | 'leastAccessed' | 'hybrid';
```

### 8.5 Memory Domain Events

```typescript
type MemoryEventType =
  | 'conversation.created'
  | 'conversation.updated'
  | 'message.added'
  | 'memory.stored'
  | 'memory.retrieved'
  | 'memory.deleted'
  | 'context.snapshot';
```

### 8.6 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-MEM-001 | Event Immutability | Events never modified after storage |
| INV-MEM-002 | Pure Handlers | Event handlers have no side effects |
| INV-MEM-003 | Version Ordering | Events returned in version order |
| INV-MEM-004 | Correlation Tracing | All events support correlationId |
| INV-MEM-005 | Optimistic Concurrency | Version conflicts detected |

### 8.7 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `MEMORY_CONVERSATION_NOT_FOUND` | Conversation not found | No |
| `MEMORY_VERSION_CONFLICT` | Optimistic lock failed | Yes |
| `MEMORY_CONTENT_TOO_LARGE` | Content exceeds 100KB | No |
| `MEMORY_INVALID_METADATA` | Metadata validation failed | No |

---

## 9. Trace Domain

### 9.1 Purpose

Full execution trace capture for observability, debugging, and decision replay.

### 9.2 Trace Event Schema

```typescript
interface TraceEvent extends BaseEvent {
  traceId: string;             // Aggregate ID
  parentEventId?: string;      // Parent event for hierarchy
  type: TraceEventType;
  durationMs?: number;
  sequence: number;
  payload?: Record<string, unknown>;
  context?: TraceContext;
  status?: TraceStatus;
}

interface TraceContext {
  workflowId?: string;
  stepId?: string;
  agentId?: string;
  model?: string;
  provider?: string;
  userId?: string;
}

type TraceStatus = 'running' | 'success' | 'failure' | 'skipped';
```

### 9.3 Trace Analysis Output

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
    providersUsed: Provider[];
  };
  errors: {
    count: number;
    codes: string[];
    messages: string[];
  };
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  eventId: string;
  type: string;
  timestamp: string;
  durationMs?: number;
  status: TraceStatus;
}
```

### 9.4 Data Retention Configuration

```typescript
interface TraceRetentionConfig {
  enabled: boolean;
  retentionDays: number;       // Max 365
  archiveBeforeDelete: boolean;
  archivePath?: string;
}
```

### 9.5 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-TR-001 | Complete Chain | Every trace has start and end events |
| INV-TR-002 | Strict Ordering | Events ordered by sequence number |
| INV-TR-003 | Replay Capability | Traces enable full decision replay |
| INV-TR-004 | Trace Isolation | Each trace independent |
| INV-TR-005 | Error Traceability | Errors include full context |

### 9.6 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `TRACE_NOT_FOUND` | Trace not found | No |
| `TRACE_ALREADY_ENDED` | Trace already finalized | No |
| `TRACE_SEQUENCE_ERROR` | Event sequence out of order | No |

---

## 10. Provider Domain

### 10.1 Purpose

CLI-based LLM provider integration with unified interface.

### 10.2 Supported Providers

| Provider | CLI Command | Auth Method | Output Format |
|----------|-------------|-------------|---------------|
| Claude | `claude` | ~/.claude/ | stream-json |
| Gemini | `gemini` | Google Cloud | stream-json |
| Codex | `codex exec` | OpenAI | stream-json |
| Qwen | `qwen` | DashScope | stream-json |
| GLM | `ax-glm` | ZAI_API_KEY | stream-json |
| Grok | `ax-grok` | XAI_API_KEY | stream-json |

### 10.3 Provider Interface

```typescript
interface LLMProvider {
  providerId: string;

  complete(request: CompletionRequest): Promise<CompletionResponse>;
  checkHealth(): Promise<HealthStatus>;
  supportsModel(model: string): boolean;
  getModels(): readonly ModelConfig[];
  isAvailable(): Promise<boolean>;
  estimateTokens(text: string): number;
}
```

### 10.4 Completion Request/Response (Contract)

```typescript
interface CompletionRequest {
  requestId: string;           // UUID
  messages: Message[];
  model: string;
  systemPrompt?: string;
  temperature?: number;        // 0-2
  maxTokens?: number;
  timeout?: number;            // ms
  idempotencyKey?: string;
}

interface CompletionResponse {
  success: boolean;
  requestId: string;
  content?: string;
  model?: string;
  usage?: TokenUsage;
  stopReason?: StopReason;
  latencyMs: number;
  error?: ClassifiedError;
  cached?: boolean;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

type StopReason = 'stop' | 'length' | 'contentFilter' | 'toolCalls' | 'error';
```

### 10.5 Health Status Schema

```typescript
interface HealthStatus {
  available: boolean;
  latencyMs: number;
  errorRate: number;           // 0-1
  consecutiveFailures: number;
  lastCheckTime: string;       // ISO8601
  circuitState: CircuitState;
}

type CircuitState = 'closed' | 'open' | 'halfOpen';
```

### 10.6 Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before open (default: 5)
  resetTimeoutMs: number;      // Time before half-open (default: 30000)
  halfOpenRequests: number;    // Test requests in half-open (default: 3)
  monitorIntervalMs: number;   // Health check interval (default: 10000)
}
```

### 10.7 Error Classification

| Category | Code | Retryable | Fallback |
|----------|------|-----------|----------|
| Network | `PROVIDER_NETWORK_ERROR` | Yes | No |
| Timeout | `PROVIDER_TIMEOUT` | Yes | Yes |
| Rate Limit | `PROVIDER_RATE_LIMITED` | Yes | Yes |
| Auth | `PROVIDER_AUTH_ERROR` | No | No |
| Input | `PROVIDER_INVALID_INPUT` | No | No |
| Server | `PROVIDER_SERVER_ERROR` | Yes | Yes |
| Unavailable | `PROVIDER_UNAVAILABLE` | Yes | Yes |

---

## 11. Token Budget Domain

### 11.1 Purpose

Manage token allocation for embedded instructions to prevent context window overflow. This is NOT cost-based - it manages limited context window tokens.

### 11.2 Token Budget Config

```typescript
interface TokenBudgetConfig {
  maxTotal: number;            // Total token budget
  perType: {                   // Per-type limits
    memory: number;
    todo: number;
    session: number;
    system: number;
  };
  criticalReserve: number;     // Reserve for critical instructions
}

const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  maxTotal: 4000,
  perType: {
    memory: 1500,
    todo: 800,
    session: 700,
    system: 500,
  },
  criticalReserve: 500,
};
```

### 11.3 Embedded Instruction Schema

```typescript
interface EmbeddedInstruction {
  id: string;
  type: InstructionType;
  content: string;
  priority: InstructionPriority;
  estimatedTokens?: number;
  metadata?: Record<string, unknown>;
}

type InstructionType = 'memory' | 'todo' | 'session' | 'context' | 'system';
type InstructionPriority = 'critical' | 'high' | 'normal' | 'low';
```

### 11.4 Budget Allocation Result

```typescript
interface BudgetAllocation {
  included: EmbeddedInstruction[];
  excluded: EmbeddedInstruction[];
  totalTokens: number;
  remaining: number;
  usageByType: Record<InstructionType, number>;
  criticalReserveUsed: number;
}
```

### 11.5 Allocation Priority Order

1. **Critical** - Always included (uses reserve if needed)
2. **High** - Included if budget allows
3. **Normal** - Included if budget allows
4. **Low** - Only if significant budget remains

Within same priority, ordered by:
1. Type priority (system > memory > session > todo)
2. Creation order (FIFO)

### 11.6 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-TB-001 | Priority Ordering | Higher priority always allocated first |
| INV-TB-002 | Critical Reserve | Critical instructions use reserve |
| INV-TB-003 | Type Limits | Per-type limits respected |
| INV-TB-004 | No Overflow | Total never exceeds maxTotal |
| INV-TB-005 | Graceful Degradation | Low priority dropped first |

### 11.7 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `TOKEN_BUDGET_EXCEEDED` | Total budget exceeded | No |
| `TOKEN_TYPE_LIMIT_EXCEEDED` | Type limit exceeded | No |
| `TOKEN_CRITICAL_DROPPED` | Critical instruction couldn't fit | No |
| `TOKEN_ESTIMATION_FAILED` | Token estimation failed | Yes |

---

## 12. Guard Domain

### 12.1 Purpose

Post-check governance for code changes and agent behavior.

### 12.2 Code Change Policy Schema

```typescript
interface CodePolicy {
  policyId: string;            // kebab-case
  description?: string;

  // Path control
  allowedPaths: string[];      // Glob patterns
  forbiddenPaths: string[];    // Glob patterns

  // Contract requirements
  requiredContracts: ContractType[];

  // Gates to run
  gates: GateType[];

  // Limits
  changeRadiusLimit: number;   // Max packages affected
}

type ContractType = 'workflow' | 'routing' | 'memory' | 'trace' | 'mcp' | 'agent' | 'session';
type GateType = 'pathViolation' | 'dependency' | 'changeRadius' | 'contractTests';
```

### 12.3 Agent Behavior Policy Schema

```typescript
interface AgentPolicy {
  policyId: string;
  agentId?: string;            // Specific agent or '*' for all

  // Data access control
  canAccessMemory: boolean;
  canAccessSessions: boolean;
  memoryScopes: string[];      // Allowed memory types

  // Delegation control
  canDelegate: boolean;
  allowedDelegates: string[];  // Agent IDs or patterns
  maxDelegationDepth: number;

  // Resource limits
  maxTokensPerRequest: number;
  maxRequestsPerMinute: number;
  maxConcurrentExecutions: number;

  // Capability restrictions
  allowedCapabilities: string[];
  forbiddenCapabilities: string[];
}
```

### 12.4 Guard Result Schema

```typescript
interface GuardResult {
  status: GuardStatus;
  policyId: string;
  target: string;
  gates: GateResult[];
  summary: string;
  suggestions: string[];
  timestamp: string;
}

type GuardStatus = 'pass' | 'fail' | 'warn';

interface GateResult {
  gate: GateType;
  status: GuardStatus;
  message: string;
  details?: Record<string, unknown>;
}
```

### 12.5 Audit Event Schema

```typescript
interface AuditEvent extends BaseEvent {
  type: 'audit';
  actor: AuditActor;
  action: string;
  resource: AuditResource;
  outcome: AuditOutcome;
  policyId?: string;
  details?: Record<string, unknown>;
}

interface AuditActor {
  type: 'agent' | 'user' | 'system';
  id: string;
  name?: string;
}

interface AuditResource {
  type: string;
  id: string;
  path?: string;
}

type AuditOutcome = 'success' | 'failure' | 'denied';
```

### 12.6 Built-in Code Policies

**provider-refactor**
```yaml
policyId: provider-refactor
allowedPaths:
  - packages/adapters/providers/src/providers/{{target}}/**
  - tests/integration/providers/**
forbiddenPaths:
  - packages/contracts/**
  - packages/core/**
requiredContracts: [routing, trace]
gates: [pathViolation, dependency, changeRadius, contractTests]
changeRadiusLimit: 2
```

**bugfix**
```yaml
policyId: bugfix
allowedPaths:
  - packages/**
forbiddenPaths:
  - packages/contracts/**
requiredContracts: []
gates: [pathViolation, changeRadius]
changeRadiusLimit: 3
```

### 12.7 Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-GD-001 | Policy Validation | All policies validated against schema |
| INV-GD-002 | Gate Execution | All configured gates must execute |
| INV-GD-003 | Audit Trail | All guard decisions audited |
| INV-GD-004 | Fail Safe | Unknown gates default to fail |

### 12.8 Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `GUARD_POLICY_NOT_FOUND` | Policy not found | No |
| `GUARD_GATE_FAILED` | Gate execution failed | Maybe |
| `GUARD_PATH_VIOLATION` | Path constraint violated | No |
| `GUARD_DEPENDENCY_VIOLATION` | Import violation | No |

---

## 13. CLI & MCP Server

### 13.1 CLI Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `ax run` | `ax run <workflow-id> [--input JSON]` | Execute workflow |
| `ax list` | `ax list [--limit N]` | List workflows |
| `ax trace` | `ax trace [trace-id]` | View traces |
| `ax doctor` | `ax doctor [provider]` | System diagnostics |
| `ax guard` | `ax guard check --policy P --target T` | Run governance |
| `ax call` | `ax call <provider> <prompt>` | Direct provider call |
| `ax agent` | `ax agent <subcommand>` | Agent management |
| `ax session` | `ax session <subcommand>` | Session management |
| `ax memory` | `ax memory <subcommand>` | Memory operations |
| `ax help` | `ax help` | Show usage |
| `ax version` | `ax version` | Show version |

### 13.2 Agent Subcommands

| Command | Description |
|---------|-------------|
| `ax agent list` | List available agents |
| `ax agent run <name> [prompt]` | Run agent |
| `ax agent create <name>` | Create new agent |
| `ax agent validate <name>` | Validate agent profile |
| `ax agent info <name>` | Show agent details |

### 13.3 Session Subcommands

| Command | Description |
|---------|-------------|
| `ax session list` | List sessions |
| `ax session create` | Create new session |
| `ax session status <id>` | Get session status |
| `ax session complete <id>` | Complete session |
| `ax session join <id>` | Join existing session |

### 13.4 Memory Subcommands

| Command | Description |
|---------|-------------|
| `ax memory search <query>` | Search memory |
| `ax memory add <content>` | Add memory entry |
| `ax memory list` | List memory entries |
| `ax memory export` | Export memory |
| `ax memory import` | Import memory |
| `ax memory cleanup` | Run cleanup |

### 13.5 Global Options

| Option | Description |
|--------|-------------|
| `--verbose, -v` | Enable verbose output |
| `--format` | Output format: text (default) or json |
| `--help, -h` | Show help |
| `--version, -V` | Show version |

### 13.6 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error or failure |

### 13.7 MCP Server Tools

| Tool | Description |
|------|-------------|
| `memory-add` | Add memory entry |
| `memory-search` | Search memory |
| `memory-list` | List memory entries |
| `memory-delete` | Delete memory entry |
| `session-create` | Create session |
| `session-status` | Get session status |
| `session-complete` | Complete session |
| `trace-analyze` | Analyze execution trace |
| `agent-run` | Run agent |
| `agent-list` | List agents |

### 13.8 MCP Resources

| Resource | Description |
|----------|-------------|
| `memory://conversations` | Conversation list |
| `memory://entries` | Memory entries |
| `sessions://active` | Active sessions |
| `traces://recent` | Recent traces |
| `agents://available` | Available agents |

---

## 14. Cross-Cutting Concerns

### 14.1 Observability

```typescript
interface ObservabilityConfig {
  // OpenTelemetry
  enableTracing: boolean;
  tracingEndpoint?: string;

  // Structured Logging
  logLevel: LogLevel;
  logFormat: 'json' | 'text';

  // Metrics
  enableMetrics: boolean;
  metricsPort?: number;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
```

### 14.2 Rate Limiting

```typescript
interface RateLimitConfig {
  enabled: boolean;

  // Per-provider limits
  perProvider: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };

  // Per-agent limits
  perAgent: {
    requestsPerMinute: number;
    concurrentExecutions: number;
  };

  // Global limits
  global: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}
```

### 14.3 Data Retention

```typescript
interface DataRetentionConfig {
  // Trace retention
  traces: {
    retentionDays: number;
    archiveBeforeDelete: boolean;
  };

  // Session retention
  sessions: {
    completedRetentionDays: number;
    failedRetentionDays: number;
  };

  // Memory retention
  memory: {
    retentionDays: number;
    cleanupStrategy: CleanupStrategy;
  };

  // Audit retention
  audit: {
    retentionDays: number;
    immutable: boolean;
  };
}
```

### 14.4 Compensation Pattern (Saga)

For multi-step agent workflows:
```typescript
interface CompensationAction {
  stepId: string;
  action: 'rollback' | 'notify' | 'log';
  handler: string;             // Function or agent to call
  timeout?: number;
}

interface WorkflowSaga {
  workflowId: string;
  compensations: CompensationAction[];
  onFailure: 'compensate' | 'pause' | 'continue';
}
```

### 14.5 Dead Letter Queue

```typescript
interface DeadLetterConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
  storePath: string;
}

interface DeadLetterEntry {
  id: string;
  originalEvent: BaseEvent;
  error: string;
  retryCount: number;
  lastRetryAt: string;
  createdAt: string;
}
```

---

## 15. Non-Functional Requirements

### 15.1 Performance

| Metric | Target |
|--------|--------|
| Workflow step latency overhead | < 10ms |
| Routing decision time | < 5ms |
| Memory event append | < 1ms |
| Trace event record | < 1ms |
| CLI command startup | < 100ms |
| Token budget allocation | < 1ms |
| Agent stage transition | < 5ms |

### 15.2 Reliability

| Requirement | Description |
|-------------|-------------|
| Retry resilience | Exponential backoff with configurable limits |
| Fallback chains | Automatic model failover on errors |
| Circuit breaker | Prevent cascading failures |
| Graceful degradation | Continue on non-critical failures |
| Event durability | Events persisted before acknowledgment |
| Checkpoint recovery | Resume from last checkpoint on failure |
| Compensation | Saga pattern for multi-step rollback |

### 15.3 Security

| Requirement | Description |
|-------------|-------------|
| Credential isolation | AutomatosX never stores API keys |
| CLI delegation | External CLIs handle authentication |
| Input validation | All inputs validated via Zod schemas |
| Path restrictions | Guard enforces allowed/forbidden paths |
| Agent isolation | Agents cannot access other agents' state |
| Audit trail | All decisions logged for compliance |

### 15.4 Observability

| Requirement | Description |
|-------------|-------------|
| Full tracing | Every execution fully traceable |
| Decision audit | All routing decisions recorded |
| Error context | Errors include full execution context |
| Replay capability | Traces enable decision replay |
| OpenTelemetry | Standard observability integration |
| Structured logging | JSON logs with correlation IDs |

---

## 16. Future Roadmap

### Phase 2: Advanced Persistence
- PostgreSQL event store adapter
- Trace archival and retention policies
- Event stream partitioning

### Phase 3: Advanced Routing
- Latency-based routing optimization
- A/B testing support
- Custom scoring plugins

### Phase 4: Enterprise Features
- Multi-tenant isolation
- RBAC for policies
- SSO integration

### Phase 5: Ecosystem
- Plugin system
- Custom gate development
- Third-party provider adapters

### Phase 6: Advanced Agent System
- Agent marketplace
- Visual workflow builder
- Multi-agent debugging tools

---

## Glossary

| Term | Definition |
|------|------------|
| **Agent** | Specialized AI assistant with defined workflow and personality |
| **Aggregate** | Event-sourced entity with state from events |
| **Contract** | Zod schema defining interface shape |
| **Gate** | Governance check in Guard system |
| **Invariant** | Condition that must always hold |
| **MCP** | Model Context Protocol |
| **Policy** | Governance rules for code/agent behavior |
| **Provider** | External LLM service (Claude, Gemini, etc.) |
| **Routing** | Model selection process |
| **Saga** | Compensation pattern for distributed transactions |
| **Session** | Multi-agent collaboration context |
| **Token Budget** | Context window allocation management |
| **Trace** | Complete execution record |
| **Workflow** | Sequence of executable steps |

---

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [OpenTelemetry](https://opentelemetry.io/)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-14 | AutomatosX Team | Initial PRD |
| 2.0.0 | 2025-12-14 | AutomatosX Team | Added Agent, Session, Token Budget domains |
| 2.1.0 | 2025-12-14 | AutomatosX Team | Architecture review: unified workflows, state machines, error codes, agent governance, circuit breaker, pagination, idempotency, correlation chain, data retention, saga pattern |
