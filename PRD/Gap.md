# AutomatosX Gap Analysis: Old vs New

## Executive Summary

| Metric | Old AutomatosX | New AutomatosX | Gap |
|--------|----------------|----------------|-----|
| **MCP Tools** | 32 | 29 | -3 (but different focus) |
| **Agent Profiles** | 20+ | 0 | **MISSING** |
| **Abilities** | 50+ | 0 | **MISSING** |
| **Workflows** | 9 | 0 | **MISSING** |
| **Specs** | 7 | 0 | **MISSING** |
| **Core Modules** | 40+ | 15 | **MISSING** |
| **CLI Commands** | Full CLI | 12 commands | Partial |

---

## MISSING FEATURES (Critical)

### 1. Agent System (HIGH PRIORITY)

**Old**: 20+ specialized agent profiles

```
agents/
├── aerospace-scientist.yaml
├── architecture.yaml
├── backend.yaml
├── ceo.yaml, cto.yaml
├── creative-marketer.yaml
├── data-scientist.yaml
├── devops.yaml
├── frontend.yaml, fullstack.yaml
├── mobile.yaml
├── product.yaml
├── quality.yaml
├── quantum-engineer.yaml
├── researcher.yaml
├── security.yaml
├── writer.yaml
└── ... more
```

**New**: Only domain contracts, no actual agent profiles

- No agent YAML profiles
- No agent selection/routing
- No agent tiers system
- No parallel agent executor
- No delegation parser

---

### 2. Abilities System (HIGH PRIORITY)

**Old**: 50+ ability templates

```
abilities/
├── accessibility.md
├── api-design.md
├── best-practices.md
├── caching-strategy.md
├── ci-cd.md
├── clean-code.md
├── code-generation.md
├── code-review.md
├── debugging.md
├── design-patterns.md
├── documentation.md
├── etl-pipelines.md
├── ... 40+ more
```

**New**: **COMPLETELY MISSING**

---

### 3. MCP Tools Gap

| OLD Tool | NEW Equivalent | Status |
|----------|----------------|--------|
| `bugfix-run` | - | **MISSING** |
| `bugfix-scan` | - | **MISSING** |
| `design-check` | - | **MISSING** |
| `design-apply-fixes` | - | **MISSING** |
| `design-suggest-fixes` | - | **MISSING** |
| `design-rules` | - | **MISSING** |
| `refactor-run` | - | **MISSING** |
| `refactor-scan` | - | **MISSING** |
| `implement-and-document` | - | **MISSING** |
| `orchestrate-task` | - | **MISSING** |
| `plan-multi-agent` | - | **MISSING** |
| `get-conversation-context` | - | **MISSING** |
| `inject-conversation-context` | - | **MISSING** |
| `memory-import` | - | **MISSING** |
| `memory-export` | - | **MISSING** |
| `memory-stats` | - | **MISSING** |
| `memory-clear` | - | **MISSING** |

---

### 4. Core Modules Gap

| OLD Module | NEW Equivalent | Status |
|------------|----------------|--------|
| `bugfix/` | - | **MISSING** |
| `refactor/` | - | **MISSING** |
| `analytics/` | - | **MISSING** |
| `cache/` | - | **MISSING** |
| `iterate/` | - | **MISSING** |
| `orchestration/` | - | **MISSING** |
| `task-engine/` | - | **MISSING** |
| `telemetry/` | - | **MISSING** |
| `workload/` | - | **MISSING** |
| `feature-flags/` | - | **MISSING** |
| `spec/` | - | **MISSING** |
| `events/normalizers/` | - | **MISSING** |
| `metrics/` | - | **MISSING** |
| `config-loaders/` | config-domain | Partial |
| `memory/` | memory-domain | Present |
| `session/` | session-domain | Present |
| `router/` | routing-engine | Present |
| `workflow/` | workflow-engine | Present |
| `database/` | sqlite-adapter | Present |

---

### 5. Workflow/Specs System

**Old**: Full YAML-based workflow system

```
examples/workflows/
├── analyst.yaml
├── assistant.yaml
├── code-reviewer.yaml
├── debugger.yaml
├── designer.yaml
├── developer.yaml
├── fullstack-developer.yaml
├── qa-specialist.yaml

examples/specs/
├── automatosx-release.ax.yaml
├── enterprise.ax.yaml
├── government.ax.yaml
├── minimal.ax.yaml
```

**New**: Only workflow engine contract, no actual workflows

- No workflow YAML files
- No spec executor
- No template engine

---

### 6. Provider System

**Old**: Full multi-provider support with:

- Provider connection pool
- Provider limit manager
- Provider metrics tracker
- Provider session management
- CLI provider detector

**New**: Basic CLI-only provider adapters

- CLI wrapper adapters (claude, gemini, codex, etc.) - Present
- No connection pooling
- No rate limiting
- No metrics tracking
- No session management

---

### 7. Observability & Telemetry

**Old**:

- Full telemetry module
- Metrics tracking
- Analytics
- Progress channel
- Warning emitter

**New**:

- Trace domain (basic) - Present
- No telemetry
- No metrics
- No analytics

---

## FEATURES PRESENT IN NEW (Improvements)

| Feature | Status | Notes |
|---------|--------|-------|
| **Monorepo structure** | NEW | Better modularity |
| **Contract-driven design** | NEW | Zod schemas first |
| **Guard/Governance** | NEW | Policy-based governance |
| **Token budget** | NEW | Token management |
| **Event sourcing** | NEW | Config aggregate |
| **Provider detection** | NEW | Auto-detect CLIs |
| **Doctor command** | NEW | System diagnostics |

---

## Priority Implementation Roadmap

### Phase 1: Agent System (Critical)

1. Port agent YAML profiles to `examples/agents/`
2. Implement agent loader
3. Implement agent selector/router
4. Add parallel agent executor

### Phase 2: Abilities System

1. Port abilities to `examples/abilities/`
2. Implement abilities manager
3. Add ability injection to agents

### Phase 3: Bugfix/Refactor Tools

1. Port `bugfix-scan`, `bugfix-run`
2. Port `refactor-scan`, `refactor-run`
3. Add AST-based detection

### Phase 4: Design Tools

1. Port `design-check`, `design-rules`
2. Port `design-suggest-fixes`, `design-apply-fixes`

### Phase 5: Orchestration

1. Port task engine
2. Port orchestration module
3. Add `orchestrate-task`, `plan-multi-agent` tools

### Phase 6: Memory Enhancements

1. Add `memory-import`, `memory-export`
2. Add `memory-clear`, `memory-stats`
3. Add vector search (sqlite-vec)

### Phase 7: Telemetry/Metrics

1. Port telemetry module
2. Port metrics tracking
3. Add analytics

---

## Summary

| Category | Status |
|----------|--------|
| **Critical Missing** | Agent profiles, Abilities, Bugfix/Refactor, Orchestration, Workflows |
| **Partially Missing** | Provider management, Telemetry, Metrics |
| **Present but Basic** | Memory, Session, Routing, Workflow engine (contracts only) |
| **New Improvements** | Contracts, Guard, Token Budget, Event Sourcing, Monorepo |
