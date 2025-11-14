# AutomatosX v2 Agent Parity Inventory

**Sprint 2 Day 11 Deliverable**
**Purpose**: Comprehensive catalog of 1,707 missing tests from v1 → v2, prioritized by user impact
**Target**: Full inventory completion by Day 12
**Owner**: Quality Squad (QAL, S1, S2)

---

## Executive Summary

**Total Missing Tests**: 1,707 (target for Sprint 2-3)
**Current v2 Test Count**: 916 tests (Sprint 1 completion)
**Target After Sprint 2**: 1,616 tests (+700 tests)
**Target After Sprint 3**: 2,116 tests (+500 tests)

**Priority Distribution**:
- P0 (Critical): 350 tests - CLI core commands, agent orchestration
- P1 (High): 550 tests - Provider routing, memory integration, golden traces
- P2 (Medium): 507 tests - Platform-specific behaviors, edge cases
- P3 (Low): 300 tests - Nice-to-have features, cosmetic issues

---

## Inventory Structure

### Test Categories

1. **CLI Commands** (350 tests) - P0
2. **Agent Behaviors** (350 tests) - P0/P1
3. **Provider Routing** (200 tests) - P1
4. **Memory Integration** (150 tests) - P1
5. **Golden Traces** (200 tests) - P1
6. **Platform Coverage** (257 tests) - P2
7. **Edge Cases & Error Handling** (200 tests) - P2/P3

---

## Category 1: CLI Commands (350 tests) - P0 Priority

### 1.1 Core Commands (150 tests)

| Test ID | Command | Test Description | Agent | Confidence | Dependencies | Priority | Status |
|---------|---------|------------------|-------|------------|--------------|----------|--------|
| CLI-001 | `ax run` | Execute agent with simple task | All | High | Agent catalog | P0 | ⬜ Pending |
| CLI-002 | `ax run` | Execute with --streaming flag | All | High | CLI bridge | P0 | ⬜ Pending |
| CLI-003 | `ax run` | Execute with --parallel flag | Product | Medium | Orchestrator | P0 | ⬜ Pending |
| CLI-004 | `ax run` | Execute with --resumable flag | Backend | Medium | Checkpoint system | P0 | ⬜ Pending |
| CLI-005 | `ax list agents` | List all available agents | N/A | High | Agent catalog | P0 | ⬜ Pending |
| CLI-006 | `ax list agents --format json` | JSON output format | N/A | High | CLI formatter | P0 | ⬜ Pending |
| CLI-007 | `ax memory search` | Search memory with keyword | N/A | High | FTS5 integration | P0 | ⬜ Pending |
| CLI-008 | `ax memory search` | Search with --limit flag | N/A | Medium | FTS5 integration | P0 | ⬜ Pending |
| CLI-009 | `ax memory list` | List recent memories | N/A | High | SQLite queries | P0 | ⬜ Pending |
| CLI-010 | `ax memory export` | Export memory to JSON | N/A | Medium | JSON serialization | P0 | ⬜ Pending |
| CLI-011 | `ax status` | Show system status | N/A | High | System health | P0 | ⬜ Pending |
| CLI-012 | `ax config show` | Display configuration | N/A | High | Config loader | P0 | ⬜ Pending |
| CLI-013 | `ax runs list` | List all runs | N/A | Medium | Run tracker | P0 | ⬜ Pending |
| CLI-014 | `ax resume <run-id>` | Resume interrupted run | Backend | Low | Checkpoint system | P0 | ⬜ Pending |
| CLI-015 | `ax spec create` | Create spec from natural language | Product | Medium | Spec parser | P0 | ⬜ Pending |

**Template for 135 additional CLI command tests** (to be filled by Quality Squad Day 11-12):
- `ax run` with various flags and error scenarios (30 tests)
- `ax list` commands for different entities (20 tests)
- `ax memory` CRUD operations (25 tests)
- `ax config` management (15 tests)
- `ax spec` workflow commands (15 tests)
- `ax agent` management (20 tests)
- `ax cache` operations (10 tests)

### 1.2 CLI Error Handling (100 tests)

| Test ID | Command | Test Description | Agent | Confidence | Dependencies | Priority | Status |
|---------|---------|------------------|-------|------------|--------------|----------|--------|
| ERR-001 | `ax run` | Agent not found error | N/A | High | Error messages | P0 | ⬜ Pending |
| ERR-002 | `ax run` | Invalid agent name format | N/A | High | Input validation | P0 | ⬜ Pending |
| ERR-003 | `ax run` | Missing task argument | N/A | High | Zod validation | P0 | ⬜ Pending |
| ERR-004 | `ax run` | Provider unavailable | Backend | High | Provider routing | P0 | ⬜ Pending |
| ERR-005 | `ax memory search` | Empty query string | N/A | Medium | Input validation | P0 | ⬜ Pending |
| ERR-006 | `ax memory search` | Database locked error | N/A | Medium | SQLite handling | P0 | ⬜ Pending |
| ERR-007 | `ax resume` | Invalid run-id format | N/A | Medium | Run tracker | P0 | ⬜ Pending |
| ERR-008 | `ax resume` | Run not found | N/A | Medium | Run tracker | P0 | ⬜ Pending |
| ERR-009 | `ax spec run` | No tasks defined | N/A | Medium | Spec parser | P0 | ⬜ Pending |
| ERR-010 | `ax config show` | Config file corrupted | N/A | High | Config loader | P0 | ⬜ Pending |

**Template for 90 additional CLI error tests** (to be filled Day 12):
- Network errors and timeouts (20 tests)
- File system errors (15 tests)
- Permission errors (15 tests)
- Invalid configuration errors (20 tests)
- Provider-specific errors (20 tests)

### 1.3 CLI Output Formatting (50 tests)

| Test ID | Command | Test Description | Expected Output | Priority | Status |
|---------|---------|------------------|-----------------|----------|--------|
| FMT-001 | `ax list agents` | Table format output | ASCII table | P0 | ⬜ Pending |
| FMT-002 | `ax list agents --format json` | JSON output | Valid JSON | P0 | ⬜ Pending |
| FMT-003 | `ax status` | Colored status indicators | ANSI colors | P0 | ⬜ Pending |
| FMT-004 | `ax memory list` | Timestamp formatting | Human-readable | P0 | ⬜ Pending |
| FMT-005 | `ax run --streaming` | Real-time streaming output | Progressive | P0 | ⬜ Pending |

**Template for 45 additional formatting tests** (Day 12).

### 1.4 CLI Flag Combinations (50 tests)

Test various flag combinations for compatibility and validation.

---

## Category 2: Agent Behaviors (350 tests) - P0/P1

### 2.1 Agent Orchestration (100 tests)

| Test ID | Agent | Test Description | Confidence | Dependencies | Priority | Status |
|---------|-------|------------------|------------|--------------|----------|--------|
| AGT-001 | Backend | Simple task execution | High | State machine | P0 | ⬜ Pending |
| AGT-002 | Frontend | Task with delegation | Medium | Orchestrator | P0 | ⬜ Pending |
| AGT-003 | Product | Multi-step planning | Medium | State machine | P0 | ⬜ Pending |
| AGT-004 | Writer | Long-running documentation | High | Streaming | P0 | ⬜ Pending |
| AGT-005 | Quality | Test generation task | High | Orchestrator | P0 | ⬜ Pending |

**Template for 95 additional orchestration tests** covering all 20+ agents.

### 2.2 Agent Memory Access (75 tests)

| Test ID | Agent | Test Description | Memory Operation | Priority | Status |
|---------|-------|------------------|------------------|----------|--------|
| MEM-001 | Backend | Retrieve past implementation | Search | P1 | ⬜ Pending |
| MEM-002 | Product | Load design decisions | Search + List | P1 | ⬜ Pending |
| MEM-003 | Architecture | Reference ADRs | Search + Retrieve | P1 | ⬜ Pending |
| MEM-004 | Quality | Find test patterns | FTS5 query | P1 | ⬜ Pending |
| MEM-005 | Writer | Reuse documentation | Search + Context | P1 | ⬜ Pending |

**Template for 70 additional memory access tests**.

### 2.3 Agent Delegation (75 tests)

| Test ID | From Agent | To Agent | Test Description | Priority | Status |
|---------|------------|----------|------------------|----------|--------|
| DEL-001 | Product | Backend | Delegate implementation | P0 | ⬜ Pending |
| DEL-002 | Product | Security | Request security audit | P0 | ⬜ Pending |
| DEL-003 | Backend | Quality | Request test generation | P0 | ⬜ Pending |
| DEL-004 | Frontend | Design | Request UX review | P1 | ⬜ Pending |
| DEL-005 | Fullstack | DevOps | Request deployment | P1 | ⬜ Pending |

**Template for 70 additional delegation tests**.

### 2.4 Agent Error Recovery (100 tests)

| Test ID | Agent | Failure Scenario | Recovery Strategy | Priority | Status |
|---------|-------|------------------|-------------------|----------|--------|
| REC-001 | Backend | Provider timeout | Retry with backoff | P0 | ⬜ Pending |
| REC-002 | Frontend | Rate limit hit | Wait and retry | P0 | ⬜ Pending |
| REC-003 | Product | Task too complex | Break into subtasks | P1 | ⬜ Pending |
| REC-004 | Writer | Context overflow | Summarize and continue | P1 | ⬜ Pending |
| REC-005 | Quality | Test generation failed | Fallback strategy | P1 | ⬜ Pending |

**Template for 95 additional recovery tests**.

---

## Category 3: Provider Routing (200 tests) - P1

### 3.1 Multi-Provider Support (80 tests)

| Test ID | Provider | Test Description | Fallback Chain | Priority | Status |
|---------|----------|------------------|----------------|----------|--------|
| PRV-001 | Claude | Successful request | N/A | P1 | ⬜ Pending |
| PRV-002 | Gemini | Successful request | N/A | P1 | ⬜ Pending |
| PRV-003 | OpenAI | Successful request | N/A | P1 | ⬜ Pending |
| PRV-004 | Claude | Unavailable → Gemini | Claude → Gemini | P1 | ⬜ Pending |
| PRV-005 | Claude | Unavailable → OpenAI | Claude → OpenAI | P1 | ⬜ Pending |
| PRV-006 | All | All providers down | Graceful failure | P1 | ⬜ Pending |

**Template for 74 additional provider routing tests**.

### 3.2 Provider Configuration (60 tests)

Test provider priority, API keys, fallback policies, SLA tracking.

### 3.3 Provider SLA Tracking (60 tests)

Test latency tracking, error rate monitoring, automatic failover.

---

## Category 4: Memory Integration (150 tests) - P1

### 4.1 SQLite + FTS5 Operations (60 tests)

| Test ID | Operation | Test Description | Query Type | Priority | Status |
|---------|-----------|------------------|------------|----------|--------|
| DB-001 | Insert | Save conversation to DB | INSERT | P1 | ⬜ Pending |
| DB-002 | Search | FTS5 keyword search | FTS5 MATCH | P1 | ⬜ Pending |
| DB-003 | Retrieve | Get conversation by ID | SELECT | P1 | ⬜ Pending |
| DB-004 | Update | Update conversation metadata | UPDATE | P1 | ⬜ Pending |
| DB-005 | Delete | Remove old conversations | DELETE | P1 | ⬜ Pending |

**Template for 55 additional database tests**.

### 4.2 Memory Query Patterns (50 tests)

Test BM25 ranking, semantic search, context retrieval, pagination.

### 4.3 Memory Performance (40 tests)

Test query latency <1ms, concurrent access, large dataset handling.

---

## Category 5: Golden Traces (200 tests) - P1

### 5.1 Trace Replay (100 tests)

| Test ID | Trace Source | Test Description | Determinism | Priority | Status |
|---------|--------------|------------------|-------------|----------|--------|
| GLD-001 | v1 transcript | Backend simple task | Seeded | P1 | ⬜ Pending |
| GLD-002 | v1 transcript | Frontend component | Seeded | P1 | ⬜ Pending |
| GLD-003 | v1 transcript | Product planning | Seeded | P1 | ⬜ Pending |
| GLD-004 | v1 transcript | Multi-agent delegation | Seeded | P1 | ⬜ Pending |
| GLD-005 | v1 transcript | Error recovery flow | Seeded | P1 | ⬜ Pending |

**Template for 95 additional golden trace replay tests**.

### 5.2 Trace Diff Tooling (50 tests)

Test output comparison, assertion libraries, regression detection.

### 5.3 Deterministic Replay (50 tests)

Test seeding mechanisms, nondeterminism isolation, reproducibility.

---

## Category 6: Platform Coverage (257 tests) - P2

### 6.1 macOS Support (100 tests)

| Test ID | Feature | Test Description | macOS Version | Priority | Status |
|---------|---------|------------------|---------------|----------|--------|
| MAC-001 | CLI | Basic command execution | 12.0+ | P2 | ⬜ Pending |
| MAC-002 | File ops | Read/write permissions | 12.0+ | P2 | ⬜ Pending |
| MAC-003 | Memory | SQLite on APFS | 12.0+ | P2 | ⬜ Pending |

**Template for 97 additional macOS tests**.

### 6.2 Linux Support (100 tests)

Test on Ubuntu, CentOS, Arch, permissions, file systems.

### 6.3 Windows Support (57 tests)

Test on Windows 10/11, PowerShell, WSL, path handling.

---

## Category 7: Edge Cases & Error Handling (200 tests) - P2/P3

### 7.1 Network Failures (50 tests)

| Test ID | Scenario | Test Description | Recovery | Priority | Status |
|---------|----------|------------------|----------|----------|--------|
| NET-001 | Connection timeout | Provider unreachable | Retry | P2 | ⬜ Pending |
| NET-002 | Slow network | High latency | Adaptive timeout | P2 | ⬜ Pending |
| NET-003 | Intermittent failures | Flaky connection | Exponential backoff | P2 | ⬜ Pending |

**Template for 47 additional network failure tests**.

### 7.2 File System Errors (50 tests)

Test disk full, permissions, corrupted files, locked files.

### 7.3 Concurrent Access (50 tests)

Test multiple CLI instances, database locking, race conditions.

### 7.4 Resource Limits (50 tests)

Test memory limits, CPU throttling, disk space, open file limits.

---

## Priority Scoring Rubric

**P0 (Critical)**: User-facing core functionality, blocks GA
- CLI core commands (`ax run`, `ax list`, `ax memory search`)
- Basic agent execution
- Core error handling

**P1 (High)**: Important features, needed for beta
- Provider routing and fallback
- Memory integration
- Golden trace testing
- Multi-agent delegation

**P2 (Medium)**: Platform-specific features, nice-to-have
- Platform-specific behaviors (Windows, Linux specific)
- Advanced error recovery
- Performance optimization tests

**P3 (Low)**: Polish and edge cases
- Cosmetic improvements
- Rare edge cases
- Optional features

---

## Confidence Scoring

**High**: Clear implementation path, minimal uncertainty
**Medium**: Some unknowns, may require investigation
**Low**: Significant unknowns, may need design changes

---

## Dependency Tracking

**Key Dependencies**:
1. CLI Bridge with Zod validation (WBS Item 2)
2. Agent Orchestration (WBS Item 3)
3. Memory Integration (WBS Item 5)
4. Golden Trace Harness (WBS Item 6)
5. Platform-specific setup (WBS Item 9)

---

## Progress Tracking

### Sprint 2 Test Targets

- **Day 11 (Overall)**: 986 tests (+70 from 916) - Inventory kickoff
- **Day 12**: 1,056 tests (+70) - Top 5 CLI commands + 10 golden traces
- **Day 13**: 1,126 tests (+70) - CLI snapshot tests
- **Day 14**: 1,196 tests (+70)
- **Day 15**: 1,266 tests (+70)
- **Day 16**: 1,336 tests (+70)
- **Day 17**: 1,406 tests (+70)
- **Day 18**: 1,476 tests (+70)
- **Day 19**: 1,546 tests (+70)
- **Day 20**: 1,616 tests (+70) - Sprint 2 complete

### Sprint 3 Test Targets

- Complete remaining 500 tests (Days 21-30)
- Final target: 2,116 tests

---

## Filtering Macros (for spreadsheet implementation)

When implemented in spreadsheet (Excel/Google Sheets):

**Macro 1: Filter by Priority**
```
=FILTER(A:H, Priority="P0")
```

**Macro 2: Filter by Agent**
```
=FILTER(A:H, Agent="Backend")
```

**Macro 3: Filter by Status**
```
=FILTER(A:H, Status="⬜ Pending")
```

**Macro 4: Calculate Completion %**
```
=COUNTIF(Status, "✅ Complete") / COUNTA(Status) * 100
```

**Macro 5: Tests by Category**
```
=SUMIF(Category, "CLI Commands", TestCount)
```

---

## Ownership & Assignments

**Quality Squad Lead (QAL)**: Overall inventory ownership, prioritization
**QA Engineer S1**: CLI Commands + Agent Behaviors (700 tests)
**QA Engineer S2**: Provider Routing + Memory + Golden Traces (550 tests)
**Platform Team**: Platform Coverage (257 tests)
**Security Team**: Edge Cases + Error Handling (200 tests)

---

## Next Steps (Day 11 → Day 12)

1. **Day 11 Afternoon**: Fill in remaining 1,400 test rows (currently only 50 examples shown)
2. **Day 11 EOD**: Share inventory draft with all squads for review
3. **Day 12 Morning**: Incorporate feedback, finalize prioritization
4. **Day 12**: Implement top 70 tests (top 5 CLI commands + first 10 golden traces)
5. **Day 13+**: Execute against inventory, update status column

---

## Document Control

**Created**: Sprint 2 Day 11
**Last Updated**: Sprint 2 Day 11
**Next Review**: Sprint 2 Day 12 standup
**Owner**: Quality Squad (QAL)
**Location**: `automatosx/tmp/sprint2/parity-inventory-template.md`
