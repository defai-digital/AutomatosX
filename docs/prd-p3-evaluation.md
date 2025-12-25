# P3 Items Re-Evaluation

**Date**: 2025-12-25
**Context**: After completing P0/P1 PRD and P2 implementation

---

## P3 Candidates from Multi-Model Discussion

| Item | Description | Original Assessment |
|------|-------------|---------------------|
| **R4: Time-Travel Debugging CLI** | `ax debug replay <traceId> --step <stepId>` | High effort, medium impact |
| **Streaming Response Aggregation** | Stream partial responses during discussions | High effort, medium impact |
| **Dashboard UI** | Real-time debugging dashboard | High effort, medium impact |

---

## Re-Evaluation Analysis

### R4: Time-Travel Debugging CLI

**Current State**:
- Trace events are now captured with template resolution details (P0 R2)
- Ability injection events now include failure context (P0 R2)
- Trace contract schemas define rich event structure (P0 R1)

**Dependencies Met**:
- [x] Trace event schemas defined
- [x] Template variable resolution captured
- [x] Ability injection status tracked
- [ ] Trace storage with queryable events (exists in trace-domain)
- [ ] Step execution context snapshot (partial)

**Implementation Effort**:
- CLI command scaffolding: Low (2-4 hours)
- Trace query/retrieval: Low (exists)
- Context reconstruction: Medium (8-12 hours)
- Step re-execution engine: High (16-24 hours)
- Total: ~30-40 hours

**Value Assessment**:
| Criteria | Score | Notes |
|----------|-------|-------|
| Debugging productivity | High | Directly addresses "can't reproduce bug" problem |
| Learning curve | Medium | Developers need to understand trace structure |
| Maintenance burden | Medium | Must evolve with trace schema changes |
| Dependency on P0/P1 | High | Requires completed trace infrastructure |

**Recommendation**: **DEFER to next sprint**
- The trace infrastructure from P0 is prerequisite but not yet integrated
- Higher value after P1 DAG execution is in place (more complex traces)
- Consider as part of a "Developer Experience" sprint

---

### Streaming Response Aggregation

**Current State**:
- Discussion executor uses Promise.all for parallel provider calls
- All responses must complete before synthesis begins
- Temperature configuration now centralized (P2 R8)

**Trade-offs**:
| Pro | Con |
|-----|-----|
| Improved perceived latency | Adds complexity to consensus engine |
| Real-time progress visibility | Harder to implement governance gates |
| Better UX for long discussions | Streaming not supported by all providers |

**Value Assessment**:
| Criteria | Score | Notes |
|----------|-------|-------|
| UX improvement | Medium | Only for interactive use, not batch/API |
| Implementation complexity | High | Requires stream merging, partial synthesis |
| Provider compatibility | Low | Not all providers support streaming |
| Governance compatibility | Low | Guards need complete responses |

**Recommendation**: **DEPRIORITIZE**
- AutomatosX is primarily used for backend orchestration
- Governance gates require complete responses
- Not all CLI providers support streaming
- Consider only if strong user demand emerges

---

### Dashboard UI

**Current State**:
- Trace events are structured and queryable
- Rate limiter statistics now available per-provider (P2 R12)
- No existing frontend infrastructure

**Trade-offs**:
| Pro | Con |
|-----|-----|
| Visual debugging | Requires frontend stack decision |
| Real-time monitoring | Separate deployment/maintenance |
| Team visibility | May duplicate CLI capabilities |

**Value Assessment**:
| Criteria | Score | Notes |
|----------|-------|-------|
| Debugging visibility | High | Visual trace exploration |
| Implementation cost | Very High | New frontend project |
| Maintenance burden | High | Separate codebase |
| Core platform value | Low | Nice-to-have, not essential |

**Recommendation**: **DEPRIORITIZE**
- Focus on CLI-first developer experience
- Trace data is available for external tools (Grafana, custom)
- Dashboard is a separate product decision, not core platform

---

## Final P3 Recommendations

### Proceed with Caution
| Item | Action | Reasoning |
|------|--------|-----------|
| Time-Travel Debugging | **Defer to next sprint** | Needs P1 completion first |

### Deprioritize
| Item | Action | Reasoning |
|------|--------|-----------|
| Streaming Responses | **Backlog** | Low provider compatibility, governance issues |
| Dashboard UI | **Backlog** | Separate product decision |

### New P3 Candidates (Emerged from Implementation)

During P2 implementation, these additional items emerged as candidates:

| Item | Description | Priority |
|------|-------------|----------|
| **Rate Limiter Metrics Export** | Expose rate limiter stats for monitoring | Low |
| **Temperature A/B Testing** | Compare outputs at different temperatures | Low |
| **Provider Health Dashboard** | CLI command for provider status overview | Medium |

---

## Summary

**Implemented in this session**:
- P0/P1 Implementation PRD (detailed specifications)
- P2 R8: Temperature Configuration (`packages/contracts/src/discussion/v1/temperatures.ts`)
- P2 R12: Rate Limiter Registry (`packages/core/cross-cutting/src/rate-limiter-registry.ts`)

**Deferred**:
- R4: Time-Travel Debugging CLI → Next sprint after P1 completion

**Deprioritized**:
- Streaming Response Aggregation → Backlog
- Dashboard UI → Backlog (separate product decision)

---

## Next Steps

1. **Implement P0 items** following the PRD specifications
2. **Implement P1 items** once P0 is complete
3. **Re-evaluate R4 (Time-Travel Debugging)** after P1 DAG execution is working
4. **Consider Provider Health Dashboard** as quick-win CLI enhancement
