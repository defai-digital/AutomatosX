# AutomatosX Revamp v1 Project - PRD Index

**Project:** AutomatosX Revamp v1 (v1 to v2 Migration - Strategy A)
**Status:** ✅ Planning Complete - Ready to Start Phase 1
**Start Date:** November 10, 2025
**Target Completion:** March 31, 2026 (18 weeks)

---

## Quick Navigation

### Core Planning Documents

1. **[revamp_v1-master-prd.md](./revamp_v1-master-prd.md)** - Master PRD
   - Executive summary and vision
   - Overall architecture
   - Success criteria and metrics
   - High-level phase breakdown

2. **[revamp_v1-timeline-milestones.md](./revamp_v1-timeline-milestones.md)** - Timeline & Milestones
   - Detailed 18-week timeline
   - Phase gate criteria
   - Risk management
   - Progress tracking framework

3. **[migration-strategy-evaluation.md](./migration-strategy-evaluation.md)** - Strategy Evaluation (Traditional Chinese)
   - Three migration strategies analyzed
   - Strategy A recommendation (chosen)
   - Cost-benefit analysis

4. **[revamp_v1-project-kickoff.md](./revamp_v1-project-kickoff.md)** - Project Kickoff Guide
   - Complete project overview and naming conventions
   - Team structure and communication
   - Risk management strategy
   - First week execution guide

---

## Phase Action Plans

### revamp_v1 Phase 1: Memory System (4 weeks)

**Architecture PRD:** **[revamp_v1-phase1-architecture-prd.md](./revamp_v1-phase1-architecture-prd.md)**
- ReScript + TypeScript + Zod architecture
- Complete component specifications
- Database schema design
- State machine design

**Detailed Action Plan:** **[revamp_v1-phase1-detailed-action-plan.md](./revamp_v1-phase1-detailed-action-plan.md)**
- 20 working days, day-by-day tasks
- ReScript state machine implementation
- TypeScript services with Zod validation
- 55+ test specifications

**Summary:**
- Database schema and migrations
- MemoryService and ConversationManager
- CLI commands and API
- 30+ tests (55+ with all layers)
- **Start:** November 10, 2025
- **End:** December 7, 2025

### revamp_v1 Phase 2: AI Provider Layer (3 weeks)

**Architecture PRD:** **[revamp_v1-phase2-architecture-prd.md](./revamp_v1-phase2-architecture-prd.md)**
- ReScript state machine for provider lifecycle
- Multi-provider abstraction (Claude, Gemini, OpenAI)
- Circuit breaker and fallback logic
- Streaming support and rate limiting

**Detailed Action Plan:** **[revamp_v1-phase2-detailed-action-plan.md](./revamp_v1-phase2-detailed-action-plan.md)**
- 15 working days, day-by-day tasks
- Provider implementations with streaming
- Integration and performance testing
- 45+ test specifications

**Summary:**
- ProviderRouter with automatic fallback
- 3 provider implementations (Claude, Gemini, OpenAI)
- Database migration 009
- 45+ tests
- **Start:** December 8, 2025
- **End:** December 28, 2025

### revamp_v1 Phase 3: Agent System (5 weeks)

**Architecture PRD:** **[revamp_v1-phase3-architecture-prd.md](./revamp_v1-phase3-architecture-prd.md)**
- ReScript state machine for agent task execution
- 20 specialized agents with domain expertise
- Tool system (bash, file, web, code intelligence)
- Agent-to-agent delegation and collaboration

**Detailed Action Plan:** **[revamp_v1-phase3-detailed-action-plan.md](./revamp_v1-phase3-detailed-action-plan.md)**
- 25 working days, week-by-week breakdown
- Complete tool system implementation
- All 20 agent implementations with tests
- 95+ test specifications

**Summary:**
- 20 specialized AI agents (Backend, Frontend, Architecture, etc.)
- Tool system with 6 tools
- Agent collaboration and delegation
- Database migration 010
- Code intelligence integration
- 95+ tests
- **Start:** December 29, 2025
- **End:** February 1, 2026

### revamp_v1 Phase 4: Workflow Engine (4 weeks)

**Architecture PRD:** **[revamp_v1-phase4-architecture-prd.md](./revamp_v1-phase4-architecture-prd.md)**
- ReScript state machine for workflow execution
- Workflow parser (YAML/JSON to workflow AST)
- Dependency graph with cycle detection
- Parallel step execution with topological sort

**Detailed Action Plan:** **[revamp_v1-phase4-detailed-action-plan.md](./revamp_v1-phase4-detailed-action-plan.md)**
- 20 working days, week-by-week breakdown
- Complete workflow parser and engine
- Checkpoint/resume system implementation
- 75+ test specifications

**Summary:**
- Workflow parser for YAML and JSON definitions
- Dependency graph builder with cycle detection
- Multi-agent orchestration with parallel execution
- Checkpoint creation and restoration
- Database migration 011
- 75+ tests
- **Start:** February 2, 2026
- **End:** February 28, 2026

### revamp_v1 Phase 5: CLI and UI Integration (2 weeks)

**Architecture PRD:** **[revamp_v1-phase5-architecture-prd.md](./revamp_v1-phase5-architecture-prd.md)**
- Unified CLI commands (workflow, agent, system)
- Terminal UI (TUI) dashboard with Ink
- Web UI dashboard with real-time WebSocket updates
- LSP enhancements for workflow validation and completion
- Production deployment with Docker

**Detailed Action Plan:** **[revamp_v1-phase5-detailed-action-plan.md](./revamp_v1-phase5-detailed-action-plan.md)**
- 10 working days, day-by-day tasks
- Week 1: CLI implementation (workflow, agent, system commands, TUI dashboard)
- Week 2: Web UI (React dashboard, WebSocket, LSP, production deployment)
- 45+ test specifications

**Summary:**
- Unified CLI orchestrating all services
- Terminal dashboard with real-time metrics
- Web dashboard with charts and visualizations
- LSP workflow support (validation, completion)
- Docker deployment configuration
- 45+ tests (cumulative 530+ across all phases)
- **Start:** March 1, 2026
- **End:** March 14, 2026

---

## Current Status

### Completed ✅

1. **P1 Phase Complete**
   - Performance infrastructure (AST cache, worker pool, monitoring)
   - LSP improvements (84% pass rate)
   - Export functionality (JSON/CSV/PDF)
   - Code quality patterns (12 patterns)
   - 245+ tests passing (100%)

2. **Planning Complete**
   - Master PRD created
   - 5 phase action plans detailed
   - Timeline and milestones defined
   - Risk management documented
   - Old files archived (75 tmp files, 25 old PRDs)

### Ready to Start 🚀

**revamp_v1 Phase 1: Memory System**
- Start Date: November 10, 2025
- Duration: 4 weeks
- First Task: Create migration 008 (database schema)
- Success Criteria: 30+ tests, <5ms search latency

---

## Project Summary

### What We're Building

**Unified Platform:** Combine AutomatosX v1 (AI agent orchestration) + AutomatosX v2 (code intelligence)

**Key Features:**
- ✅ Multi-language code parsing (45+ languages)
- ✅ SQLite FTS5 search (<5ms)
- ✅ Code quality metrics (12 patterns)
- ✅ LSP server integration
- ✅ Web UI dashboard
- 🆕 20 specialized AI agents
- 🆕 Multi-provider support (Claude, Gemini, OpenAI)
- 🆕 Memory system with conversation tracking
- 🆕 Workflow engine for multi-agent orchestration

### Success Metrics

| Metric | Target |
|--------|--------|
| Test Coverage | >85% |
| Total Tests | 530+ |
| Agent Task Latency | <2s |
| Memory Search | <5ms |
| Code Intelligence | <5ms |
| Documentation | 100% |
| P0/P1 Bugs | 0 |

---

## Getting Started with revamp_v1 Phase 1

### Day 1 Tasks

1. **Review Phase 1 Plan**
   - Read [revamp_v1-phase1-architecture-prd.md](./revamp_v1-phase1-architecture-prd.md)
   - Read [revamp_v1-phase1-detailed-action-plan.md](./revamp_v1-phase1-detailed-action-plan.md)
   - Understand Week 1 deliverables (ReScript state machine + database)

2. **Setup Development Environment**
   - Ensure Node.js 18+ installed
   - Run `npm install`
   - Run `npm test` to verify v2 tests pass

3. **Create Migration 008**
   - File: `src/migrations/008_create_memory_system.sql`
   - Tables: conversations, messages, messages_fts, agents, agent_state, workflows
   - Follow schema in revamp_v1 Phase 1 plan

4. **Define Zod Schemas**
   - File: `src/types/schemas/memory.schema.ts`
   - Schemas: ConversationSchema, MessageSchema, AgentSchema

---

## Archive

All completed phase documentation has been moved to:
- **PRDs:** `automatosx/PRD/archive/completed-phases/`
- **Tmp Files:** `automatosx/tmp/archive/2025-11-09/`

---

**Last Updated:** November 10, 2025
**Project Status:** ✅ PLANNING COMPLETE - All 5 Phases Fully Detailed
**Ready to Start:** revamp_v1 Phase 1 - Memory System (November 10, 2025)
**Documentation:** All 5 phases architecture PRDs and detailed action plans complete
