# AutomatosX v1 to v2 Migration - Master PRD

**Project:** AutomatosX Migration (Strategy A)
**Goal:** Integrate v1 AI agent orchestration features into v2 code intelligence platform
**Duration:** 18 weeks (4.5 months)
**Start Date:** November 10, 2025
**Target Completion:** March 31, 2026

---

## Executive Summary

This PRD outlines the comprehensive migration strategy to combine the AI agent orchestration capabilities of AutomatosX v1 with the advanced code intelligence features of AutomatosX. The result will be a unified platform that provides both powerful code analysis AND intelligent AI agent collaboration.

### Vision

Create a single, powerful development platform where:
- **AI agents** can leverage **deep code understanding** for better task execution
- **Code intelligence** informs **agent decisions** and recommendations
- **Developers** get seamless access to both capabilities through unified CLI, Web UI, and LSP

### Why Migration (Strategy A)?

1. **Preserves v2 Investment** - 245+ tests, 3 months of work, production-ready infrastructure
2. **Feature Synergy** - Agents can use code analysis; code analysis can trigger agents
3. **Single Codebase** - One project to maintain, test, and deploy
4. **Cost Effective** - 4.5 months vs 10.5 months for v3 from scratch
5. **Lower Risk** - Proven v2 foundation with incremental feature addition

---

## Current State Analysis

### AutomatosX (Current - Code Intelligence Engine)

**✅ Completed Features:**
- Multi-language parsing (45+ languages via Tree-sitter)
- SQLite FTS5 full-text search
- Symbol extraction and indexing
- Call graph and dependency analysis
- Code quality metrics (12 smell patterns)
- LSP server for editor integration
- Web UI dashboard (React + Redux + Material-UI)
- Performance infrastructure (AST cache, worker pool, monitoring)
- Export functionality (JSON, CSV, PDF)
- 245+ passing tests (100% for completed features)

**Architecture Strengths:**
- SQLite with FTS5 for fast search (<1ms cached, <5ms uncached)
- Zod validation for all data schemas
- Modular service layer
- Comprehensive test coverage
- Well-documented codebase

### AutomatosX v1 (To Be Migrated)

**🔄 Features to Migrate:**
- 20 specialized AI agents (backend, frontend, security, devops, product, etc.)
- Multi-provider support (Claude, Gemini, OpenAI with automatic fallback)
- Memory system with conversation tracking (SQLite FTS5)
- Workflow engine for task delegation
- Agent-to-agent collaboration
- Interactive CLI for agent chat
- Parallel execution and resumable runs

**Migration Challenges:**
- Different architecture (standalone CLI vs integrated platform)
- Separate memory database (needs schema integration)
- Provider abstraction layer (needs v2 integration)
- CLI commands (need unification with v2 commands)

---

## Migration Goals

### Primary Objectives

1. **100% Feature Parity** - All v1 agent features work in v2
2. **Feature Integration** - Agents can access code intelligence APIs
3. **Unified UX** - Single CLI, Web UI, LSP with consistent experience
4. **Zero Regressions** - Maintain all v2 features and test coverage
5. **Production Ready** - Full test coverage, documentation, deployment guides

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Feature Parity | 100% | All 20 agents working with provider fallback |
| Test Coverage | >85% | Code coverage for new components |
| Integration Tests | 50+ | Agent + code intelligence scenarios |
| Documentation | Complete | PRDs, API docs, user guides |
| Performance | <2s | Agent task initiation latency |
| Zero Bugs | P0/P1 | No critical or high-priority bugs at launch |

---

## High-Level Architecture

### Integrated System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AutomatosX+                           │
│              (Code Intelligence + AI Agents)                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │   CLI   │          │ Web UI  │          │   LSP   │
   │Commands │          │Dashboard│          │ Server  │
   └────┬────┘          └────┬────┘          └────┬────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
   ┌────▼─────────────┐                   ┌────────▼──────────┐
   │  Agent Layer     │                   │  Code Intelligence│
   │  (NEW - v1)      │◄─────────────────►│  (EXISTING - v2)  │
   ├──────────────────┤                   ├───────────────────┤
   │ - AgentRegistry  │                   │ - FileService     │
   │ - AgentRuntime   │                   │ - ParserRegistry  │
   │ - WorkflowEngine │                   │ - QueryRouter     │
   │ - TaskPlanner    │                   │ - ChunkingService │
   └────┬─────────────┘                   └───────────┬───────┘
        │                                             │
   ┌────▼─────────────┐                   ┌───────────▼───────┐
   │  Provider Layer  │                   │  Database Layer   │
   │  (NEW - v1)      │                   │  (EXISTING - v2)  │
   ├──────────────────┤                   ├───────────────────┤
   │ - ProviderRouter │                   │ - FileDAO         │
   │ - ClaudeProvider │                   │ - SymbolDAO       │
   │ - GeminiProvider │                   │ - ChunkDAO        │
   │ - OpenAIProvider │                   │ - TelemetryDAO    │
   └────┬─────────────┘                   └───────────┬───────┘
        │                                             │
   ┌────▼─────────────┐                   ┌───────────▼───────┐
   │  Memory System   │◄─────────────────►│  SQLite Database  │
   │  (NEW - v1)      │                   │  (SHARED)         │
   ├──────────────────┤                   ├───────────────────┤
   │ - MemoryService  │                   │ - files           │
   │ - ConversationMgr│                   │ - symbols         │
   │ - MemorySearch   │                   │ - chunks + FTS5   │
   └──────────────────┘                   │ - conversations   │
                                          │ - messages        │
                                          │ - agents          │
                                          └───────────────────┘
```

### Key Integration Points

1. **Shared Database** - Single SQLite with FTS5 for both code and memory
2. **Unified Services** - Agents call FileService, QueryRouter for code intelligence
3. **Event Bus** - Agents emit events; code intelligence subscribes
4. **Common CLI** - `ax` command with both agent and code intelligence subcommands
5. **Web UI Integration** - Dashboard shows both code metrics and agent activity

---

## Migration Phases

### Phase 1: Memory System (4 weeks)

**Goal:** Integrate v1 memory system with v2 database infrastructure

**Deliverables:**
- Memory database schema (conversations, messages, agent_state)
- MemoryService class with SQLite FTS5 search
- ConversationManager for session management
- Memory API integrated with v2 database connection
- 30+ tests for memory operations

**Success Criteria:**
- ✅ Memory searches return results in <1ms (cached) / <5ms (uncached)
- ✅ Conversation CRUD operations working
- ✅ FTS5 search across conversation history
- ✅ 100% test pass rate

### Phase 2: AI Provider Layer (3 weeks)

**Goal:** Implement multi-provider abstraction with fallback

**Deliverables:**
- ProviderRouter with automatic fallback logic
- ClaudeProvider (primary for Claude Code users)
- GeminiProvider (secondary fallback)
- OpenAIProvider (tertiary fallback)
- Provider health checks and rate limiting
- 40+ tests for provider operations

**Success Criteria:**
- ✅ All 3 providers working with streaming support
- ✅ Automatic fallback within 2s on provider failure
- ✅ Rate limiting and quota management
- ✅ 100% test pass rate

### Phase 3: Agent System (5 weeks)

**Goal:** Migrate 20 specialized agents with code intelligence integration

**Deliverables:**
- AgentRegistry with 20 agent definitions
- AgentRuntime for task execution
- Agent base class with code intelligence APIs
- Tool system (bash, file, web, code analysis)
- 20 agent manifests with capabilities
- 60+ tests for agent operations

**Success Criteria:**
- ✅ All 20 agents operational
- ✅ Agents can query code intelligence (symbols, search, dependencies)
- ✅ Tool execution working (bash, file read/write, web fetch)
- ✅ Agent-to-agent communication
- ✅ 100% test pass rate

### Phase 4: Workflow Engine (4 weeks)

**Goal:** Implement task planning, delegation, and orchestration

**Deliverables:**
- WorkflowEngine for multi-agent coordination
- TaskPlanner with dependency resolution
- Parallel execution infrastructure
- Resumable workflow system
- Workflow visualization in Web UI
- 50+ tests for workflow operations

**Success Criteria:**
- ✅ Multi-agent workflows executing correctly
- ✅ Parallel task execution (3+ agents simultaneously)
- ✅ Workflow pause/resume working
- ✅ Task dependency resolution
- ✅ 100% test pass rate

### Phase 5: CLI and UI Integration (2 weeks)

**Goal:** Unify CLI commands and Web UI for seamless UX

**Deliverables:**
- Unified CLI with `ax` command (agent + code intelligence)
- Web UI dashboard with agent activity panel
- LSP integration for agent suggestions in editors
- User documentation and guides
- End-to-end integration tests

**Success Criteria:**
- ✅ Single `ax` CLI with all commands
- ✅ Web UI shows code metrics + agent activity
- ✅ LSP provides agent-powered code suggestions
- ✅ 30+ end-to-end integration tests
- ✅ Complete user documentation

---

## Detailed Technical Specifications

### Database Schema Extensions

#### New Tables for v1 Features

```sql
-- Conversations (agent chat sessions)
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT, -- JSON
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Messages (conversation history)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  tokens INTEGER,
  provider TEXT, -- 'claude', 'gemini', 'openai'
  created_at INTEGER NOT NULL,
  metadata TEXT, -- JSON
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Messages FTS5 (full-text search)
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- Agents (agent registry)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  capabilities TEXT NOT NULL, -- JSON array
  system_prompt TEXT NOT NULL,
  tools TEXT, -- JSON array of available tools
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 50,
  created_at INTEGER NOT NULL,
  metadata TEXT -- JSON
);

-- Agent State (runtime state)
CREATE TABLE agent_state (
  agent_id TEXT PRIMARY KEY,
  state TEXT NOT NULL, -- 'idle', 'running', 'paused', 'failed'
  current_task_id TEXT,
  task_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  last_active INTEGER,
  metadata TEXT, -- JSON
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Workflows (multi-agent task orchestration)
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  tasks TEXT NOT NULL, -- JSON array of task definitions
  dependencies TEXT, -- JSON adjacency list
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  metadata TEXT -- JSON
);
```

### API Layer Design

#### Agent API

```typescript
// src/agents/AgentRegistry.ts
interface Agent {
  id: string;
  name: string;
  category: AgentCategory;
  capabilities: string[];
  systemPrompt: string;
  tools: Tool[];
  enabled: boolean;
  priority: number;
}

class AgentRegistry {
  listAgents(options?: ListAgentsOptions): Agent[];
  getAgent(id: string): Agent | null;
  executeTask(agentId: string, task: Task): Promise<TaskResult>;
  delegateTask(fromAgent: string, toAgent: string, task: Task): Promise<void>;
}

// src/agents/AgentRuntime.ts
class AgentRuntime {
  async executeTask(agent: Agent, task: Task): Promise<TaskResult>;
  async streamTask(agent: Agent, task: Task): AsyncIterator<TaskChunk>;
  getTaskStatus(taskId: string): TaskStatus;
  pauseTask(taskId: string): Promise<void>;
  resumeTask(taskId: string): Promise<void>;
  cancelTask(taskId: string): Promise<void>;
}
```

#### Memory API

```typescript
// src/memory/MemoryService.ts
interface Conversation {
  id: string;
  agentId: string;
  userId?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

class MemoryService {
  async createConversation(agentId: string, title: string): Promise<Conversation>;
  async getConversation(id: string): Promise<Conversation | null>;
  async addMessage(conversationId: string, message: Message): Promise<void>;
  async searchMessages(query: string, options?: SearchOptions): Promise<Message[]>;
  async getRecentConversations(limit: number): Promise<Conversation[]>;
}
```

#### Provider API

```typescript
// src/providers/ProviderRouter.ts
interface ProviderRequest {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

class ProviderRouter {
  async execute(request: ProviderRequest): Promise<ProviderResponse>;
  async executeWithFallback(request: ProviderRequest): Promise<ProviderResponse>;
  checkProviderHealth(provider: string): Promise<ProviderHealth>;
  getProviderStats(): ProviderStats[];
}

// src/providers/ClaudeProvider.ts
class ClaudeProvider implements Provider {
  async execute(request: ProviderRequest): Promise<ProviderResponse>;
  async stream(request: ProviderRequest): AsyncIterator<string>;
  checkHealth(): Promise<ProviderHealth>;
}
```

#### Workflow API

```typescript
// src/workflows/WorkflowEngine.ts
interface Workflow {
  id: string;
  name: string;
  tasks: Task[];
  dependencies: Map<string, string[]>; // taskId -> dependent taskIds
  status: WorkflowStatus;
}

class WorkflowEngine {
  async createWorkflow(definition: WorkflowDefinition): Promise<Workflow>;
  async executeWorkflow(workflowId: string): Promise<WorkflowResult>;
  async pauseWorkflow(workflowId: string): Promise<void>;
  async resumeWorkflow(workflowId: string): Promise<void>;
  getWorkflowStatus(workflowId: string): WorkflowStatus;
}
```

---

## CLI Command Structure

### Unified CLI Design

```bash
# Code Intelligence Commands (existing v2)
ax find "Calculator"                    # Search symbols/code
ax def "getUserById"                    # Find symbol definition
ax flow "processPayment"                # Analyze call graph
ax index ./src                          # Index codebase
ax lint --pattern "code-smell"          # Run code quality checks
ax status                               # Show index and cache stats
ax analyze quality --path src/          # Run quality analysis
ax export --format pdf                  # Export analysis report

# Agent Commands (new v1)
ax agent list                           # List all agents
ax agent run backend "implement auth"   # Run agent with task
ax agent chat backend                   # Interactive chat with agent
ax agent status                         # Show agent activity

# Memory Commands (new v1)
ax memory search "authentication"       # Search conversation history
ax memory list --agent backend          # List conversations for agent
ax memory export                        # Export memory to backup

# Workflow Commands (new v1)
ax workflow create --spec workflow.yaml # Create multi-agent workflow
ax workflow run <workflow-id>           # Execute workflow
ax workflow status <workflow-id>        # Check workflow status
ax workflow pause <workflow-id>         # Pause running workflow
ax workflow resume <workflow-id>        # Resume paused workflow

# Configuration Commands
ax config show                          # Show configuration
ax config set <key> <value>             # Set configuration value
ax config reset                         # Reset to defaults

# System Commands
ax status --verbose                     # Show all system status
ax version                              # Show version info
ax help [command]                       # Show help
```

---

## Testing Strategy

### Test Coverage Requirements

| Component | Unit Tests | Integration Tests | E2E Tests | Total |
|-----------|-----------|-------------------|-----------|-------|
| Memory System | 30 | 10 | 5 | 45 |
| Provider Layer | 40 | 15 | 10 | 65 |
| Agent System | 60 | 20 | 15 | 95 |
| Workflow Engine | 50 | 15 | 10 | 75 |
| CLI Integration | 20 | 10 | 15 | 45 |
| **Total New Tests** | **200** | **70** | **55** | **325** |
| **v2 Existing Tests** | | | | **245** |
| **Grand Total** | | | | **570** |

### Test Categories

**Unit Tests:**
- Individual functions and methods
- Mock all external dependencies
- Fast execution (<100ms per test)

**Integration Tests:**
- Component interactions (e.g., Agent + Memory + Provider)
- Real database (SQLite in-memory)
- Medium execution (<1s per test)

**E2E Tests:**
- Full user workflows (e.g., "Run agent, delegate task, complete workflow")
- Real providers (with test accounts)
- Longer execution (<10s per test)

### Testing Tools

- **Vitest** - Test runner and assertions
- **Mock Service Worker (MSW)** - API mocking for providers
- **SQLite in-memory** - Fast database for integration tests
- **Test fixtures** - Reusable test data and scenarios

---

## Documentation Requirements

### User Documentation

1. **Quick Start Guide**
   - Installation instructions
   - Basic usage examples
   - Common workflows

2. **Agent Guide**
   - Agent capabilities reference
   - How to run agents
   - Agent-to-agent delegation
   - Custom agent creation

3. **Memory System Guide**
   - Conversation management
   - Memory search techniques
   - Export and backup

4. **Workflow Guide**
   - Creating workflows
   - Task dependencies
   - Parallel execution
   - Monitoring and debugging

5. **CLI Reference**
   - Complete command reference
   - Options and flags
   - Configuration files
   - Environment variables

### Developer Documentation

1. **Architecture Guide**
   - System architecture diagram
   - Component interactions
   - Data flow
   - Extension points

2. **API Reference**
   - Agent API
   - Memory API
   - Provider API
   - Workflow API
   - Code Intelligence API

3. **Development Guide**
   - Setup development environment
   - Running tests
   - Building and deployment
   - Contributing guidelines

4. **Migration Guide**
   - v1 to v2 migration steps
   - Breaking changes
   - Upgrade path

---

## Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Provider API changes | Medium | High | Abstract provider interface, version locking |
| Database schema conflicts | Low | High | Careful schema design, migration testing |
| Performance degradation | Medium | Medium | Benchmarking, profiling, optimization |
| Test coverage gaps | Low | Medium | Automated coverage tracking, PR checks |
| Integration bugs | Medium | High | Comprehensive integration tests, staging environment |

### Schedule Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Phase overruns | Medium | High | 20% buffer per phase, weekly progress reviews |
| Dependency delays | Low | Medium | Early integration testing, parallel work streams |
| Scope creep | Medium | High | Strict change control, Phase gate reviews |
| Resource unavailability | Low | Medium | Cross-training, documentation |

### Quality Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Regression in v2 features | Low | High | Full v2 test suite runs on every commit |
| Poor agent performance | Medium | Medium | Performance benchmarks, user testing |
| Documentation gaps | Low | Low | Documentation review in each phase |
| Security vulnerabilities | Low | High | Security audit, dependency scanning |

---

## Success Criteria

### Phase Gate Requirements

Each phase must meet these criteria before proceeding to next phase:

1. **100% Test Pass Rate** - All unit, integration, and E2E tests passing
2. **Code Review** - All code reviewed and approved
3. **Documentation** - Phase documentation complete
4. **Performance** - Performance benchmarks met
5. **Demo** - Working demo of phase deliverables
6. **User Acceptance** - Sign-off from stakeholders

### Final Launch Criteria

1. ✅ All 5 phases complete
2. ✅ 570+ tests passing (100%)
3. ✅ Performance benchmarks met:
   - Agent task initiation <2s
   - Memory search <5ms (uncached)
   - Code intelligence queries <5ms (uncached)
4. ✅ Complete documentation (user + developer)
5. ✅ Zero P0/P1 bugs
6. ✅ Security audit passed
7. ✅ User acceptance testing complete
8. ✅ Deployment automation tested

---

## Timeline and Milestones

### Overall Schedule

```
Week 1-4:   Phase 1 - Memory System
Week 5-7:   Phase 2 - AI Provider Layer
Week 8-12:  Phase 3 - Agent System
Week 13-16: Phase 4 - Workflow Engine
Week 17-18: Phase 5 - CLI and UI Integration
```

### Key Milestones

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 4 | Phase 1 Complete | Memory system with FTS5 search |
| 7 | Phase 2 Complete | Multi-provider with fallback |
| 12 | Phase 3 Complete | 20 agents with code intelligence |
| 16 | Phase 4 Complete | Workflow engine with parallelism |
| 18 | Phase 5 Complete | Unified CLI, Web UI, LSP |
| 18 | Launch Ready | All success criteria met |

---

## Appendices

### A. Agent Catalog (20 Agents)

1. **backend** - Backend development (Go/Rust)
2. **frontend** - Frontend development (React/Next.js/Swift)
3. **fullstack** - Full-stack development (Node.js/TypeScript)
4. **mobile** - Mobile development (iOS/Android)
5. **devops** - DevOps and infrastructure
6. **security** - Security auditing
7. **data** - Data engineering and ETL
8. **quality** - QA and testing
9. **design** - UX/UI design
10. **writer** - Technical writing
11. **product** - Product management
12. **cto** - Technical strategy
13. **ceo** - Business leadership
14. **researcher** - Research and analysis
15. **data-scientist** - ML and data science
16. **aerospace-scientist** - Aerospace engineering
17. **quantum-engineer** - Quantum computing
18. **creative-marketer** - Marketing and content
19. **architecture** - System architecture
20. **standard** - Standards and best practices

### B. Provider Specifications

**Claude (Anthropic)** - Primary
- Models: claude-3-5-sonnet, claude-3-opus
- Max tokens: 200K
- Streaming: Yes
- Cost: $3/$15 per 1M tokens (input/output)

**Gemini (Google)** - Secondary
- Models: gemini-1.5-pro, gemini-1.5-flash
- Max tokens: 2M
- Streaming: Yes
- Cost: $7/$21 per 1M tokens (input/output)

**OpenAI** - Tertiary
- Models: gpt-4-turbo, gpt-4o
- Max tokens: 128K
- Streaming: Yes
- Cost: $10/$30 per 1M tokens (input/output)

### C. Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Agent Task Initiation | <2s | Time from command to first provider response |
| Memory Search (cached) | <1ms | SQLite query with warm cache |
| Memory Search (uncached) | <5ms | SQLite FTS5 query cold |
| Code Intelligence (cached) | <1ms | Existing v2 benchmark |
| Code Intelligence (uncached) | <5ms | Existing v2 benchmark |
| Workflow Initiation | <3s | Multi-agent coordination overhead |
| Provider Fallback | <2s | Automatic failover time |
| Database Write | <10ms | P95 latency for inserts |

---

**Document Version:** 1.0
**Last Updated:** November 10, 2025
**Status:** APPROVED - Ready for Phase 1 Execution
**Next Review:** End of Phase 1 (Week 4)
