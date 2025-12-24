# Action Plan: Multi-Model Discussion System Implementation

**Version**: 1.0.0
**Status**: Ready for Execution
**Created**: 2025-12-24
**Related PRDs**:
- PRD-v16-multi-model-discussion.md
- PRD-v16-multi-model-discussion-implementation.md

---

## Executive Summary

This action plan outlines a 5-phase implementation of the Multi-Model Discussion System, enabling Claude, GLM, Qwen, Gemini, Codex, and Grok to collaborate on complex problems.

**Total Duration**: 4 weeks
**Team Size**: 1-2 engineers
**Priority**: High (user-requested feature)

---

## Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1        Phase 2         Phase 3        Phase 4        Phase 5       │
│  CONTRACTS      CORE DOMAIN     INTEGRATION    CLI & MCP      POLISH        │
│  ─────────      ───────────     ───────────    ─────────      ──────        │
│  Days 1-3       Days 4-8        Days 9-12      Days 13-16     Days 17-20    │
│                                                                              │
│  ┌─────────┐   ┌───────────┐   ┌───────────┐  ┌─────────┐   ┌─────────┐    │
│  │ Schemas │──▶│  Patterns │──▶│ Workflow  │──▶│ax discuss│──▶│  Tests  │    │
│  │Invariants│   │ Consensus │   │  Engine   │  │MCP Tools │   │  Docs   │    │
│  └─────────┘   └───────────┘   └───────────┘  └─────────┘   └─────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Contracts & Schemas (Days 1-3)

### Objective
Define all Zod schemas and invariants for the discussion domain.

### Tasks

| ID | Task | Priority | Effort | Dependencies |
|----|------|----------|--------|--------------|
| 1.1 | Create `packages/contracts/src/discussion/v1/` directory | High | 0.5h | None |
| 1.2 | Implement `DiscussionPatternSchema` | High | 1h | 1.1 |
| 1.3 | Implement `ConsensusConfigSchema` | High | 1h | 1.2 |
| 1.4 | Implement `DiscussStepConfigSchema` | High | 2h | 1.3 |
| 1.5 | Implement `ProviderResponseSchema` | High | 1h | 1.2 |
| 1.6 | Implement `DiscussionResultSchema` | High | 2h | 1.5 |
| 1.7 | Implement `DiscussionRequestSchema` (CLI/MCP) | Medium | 1h | 1.4 |
| 1.8 | Write `invariants.md` with all INV-DISC-* rules | High | 2h | 1.6 |
| 1.9 | Create `index.ts` with exports | Medium | 0.5h | 1.8 |
| 1.10 | Update `packages/contracts/src/index.ts` | Medium | 0.5h | 1.9 |
| 1.11 | Add `ProviderAffinitySchema` to agent contracts | Medium | 1h | None |
| 1.12 | Update `StepTypeSchema` to include 'discuss' | High | 0.5h | None |
| 1.13 | Write contract tests | High | 3h | 1.10 |

### Deliverables
- [ ] `packages/contracts/src/discussion/v1/schema.ts`
- [ ] `packages/contracts/src/discussion/v1/invariants.md`
- [ ] `packages/contracts/src/discussion/v1/index.ts`
- [ ] Updated agent schema with `ProviderAffinitySchema`
- [ ] Updated workflow schema with `discuss` step type
- [ ] `tests/contract/discussion.test.ts`

### Acceptance Criteria
- [ ] All schemas pass Zod validation
- [ ] `pnpm typecheck` passes
- [ ] All contract tests pass
- [ ] Invariants documented with enforcement strategy

### Files to Create/Modify

```
packages/contracts/src/
├── discussion/
│   └── v1/
│       ├── schema.ts      # NEW
│       ├── invariants.md  # NEW
│       └── index.ts       # NEW
├── agent/v1/schema.ts     # MODIFY (add ProviderAffinitySchema)
├── workflow/v1/schema.ts  # MODIFY (add 'discuss' step type)
└── index.ts               # MODIFY (add discussion exports)

tests/contract/
└── discussion.test.ts     # NEW
```

---

## Phase 2: Core Domain (Days 4-8)

### Objective
Implement the discussion execution engine with all 5 patterns.

### Tasks

| ID | Task | Priority | Effort | Dependencies |
|----|------|----------|--------|--------------|
| 2.1 | Create `packages/core/discussion-domain/` package | High | 1h | Phase 1 |
| 2.2 | Implement `DiscussionProviderExecutor` interface | High | 1h | 2.1 |
| 2.3 | Implement `DiscussionExecutor` main class | High | 3h | 2.2 |
| 2.4 | Implement `RoundRobinPattern` | High | 3h | 2.3 |
| 2.5 | Implement `SynthesisPattern` | High | 3h | 2.3 |
| 2.6 | Implement `DebatePattern` | High | 4h | 2.3 |
| 2.7 | Implement `CritiquePattern` | Medium | 3h | 2.3 |
| 2.8 | Implement `VotingPattern` | Medium | 3h | 2.3 |
| 2.9 | Implement `SynthesisConsensus` | High | 2h | 2.4-2.8 |
| 2.10 | Implement `VotingConsensus` | Medium | 2h | 2.9 |
| 2.11 | Implement `ModeratorConsensus` | Medium | 2h | 2.9 |
| 2.12 | Create prompt templates for each pattern | High | 3h | 2.4-2.8 |
| 2.13 | Implement provider health check | Medium | 2h | 2.3 |
| 2.14 | Implement parallel provider execution | High | 2h | 2.3 |
| 2.15 | Write unit tests for patterns | High | 4h | 2.4-2.8 |
| 2.16 | Write unit tests for consensus | High | 2h | 2.9-2.11 |

### Deliverables
- [ ] `packages/core/discussion-domain/` package
- [ ] All 5 pattern executors
- [ ] All 3 consensus mechanisms
- [ ] Prompt templates
- [ ] Unit tests with >90% coverage

### Package Structure

```
packages/core/discussion-domain/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── discussion-executor.ts
│   ├── patterns/
│   │   ├── index.ts
│   │   ├── base-pattern.ts
│   │   ├── round-robin.ts
│   │   ├── synthesis.ts
│   │   ├── debate.ts
│   │   ├── critique.ts
│   │   └── voting.ts
│   ├── consensus/
│   │   ├── index.ts
│   │   ├── synthesis-consensus.ts
│   │   ├── voting-consensus.ts
│   │   └── moderator-consensus.ts
│   └── prompts/
│       ├── index.ts
│       ├── provider-prompts.ts    # Provider-specific prompts
│       ├── pattern-prompts.ts     # Pattern-specific prompts
│       └── synthesis-prompts.ts   # Consensus prompts
└── tests/
    ├── discussion-executor.test.ts
    ├── patterns/
    │   ├── round-robin.test.ts
    │   ├── synthesis.test.ts
    │   ├── debate.test.ts
    │   ├── critique.test.ts
    │   └── voting.test.ts
    └── consensus/
        └── consensus.test.ts
```

### Pattern Implementation Details

#### Round-Robin Pattern
```typescript
// Execution flow
for (round = 1; round <= config.rounds; round++) {
  for (provider of config.providers) {
    // Each provider sees all previous responses
    response = await executeWithContext(provider, previousResponses);
    previousResponses.push(response);
  }
}
```

#### Debate Pattern
```typescript
// Execution flow
// 1. Opening statements (parallel)
openings = await Promise.all([
  execute(proponent, "Argue FOR"),
  execute(opponent, "Argue AGAINST"),
]);

// 2. Rebuttals (parallel)
rebuttals = await Promise.all([
  execute(proponent, `Respond to: ${openings.opponent}`),
  execute(opponent, `Respond to: ${openings.proponent}`),
]);

// 3. Judge verdict
verdict = await execute(judge, `Evaluate: ${openings} ${rebuttals}`);
```

#### Provider Priority (for default selection)
```typescript
const PROVIDER_PRIORITY = {
  synthesis: ['claude', 'glm', 'gemini', 'qwen'],
  debate: ['claude', 'glm', 'codex'],
  critique: ['glm', 'claude', 'qwen'],
  voting: ['claude', 'glm', 'qwen', 'gemini'],
  'round-robin': ['claude', 'glm', 'qwen'],
};
```

---

## Phase 3: Workflow Integration (Days 9-12)

### Objective
Integrate discussion steps into the workflow engine.

### Tasks

| ID | Task | Priority | Effort | Dependencies |
|----|------|----------|--------|--------------|
| 3.1 | Create `DiscussStepHandler` class | High | 3h | Phase 2 |
| 3.2 | Add step handler to workflow runner | High | 2h | 3.1 |
| 3.3 | Implement context interpolation for prompts | High | 2h | 3.1 |
| 3.4 | Add provider routing to step execution | High | 2h | 3.2 |
| 3.5 | Integrate with trace domain | Medium | 2h | 3.2 |
| 3.6 | Add discussion events to trace | Medium | 2h | 3.5 |
| 3.7 | Create `DiscussionProviderBridge` adapter | High | 3h | 3.1 |
| 3.8 | Add provider affinity resolution | Medium | 2h | 3.4 |
| 3.9 | Write integration tests | High | 4h | 3.1-3.8 |
| 3.10 | Test with example workflows | High | 2h | 3.9 |

### Deliverables
- [ ] `DiscussStepHandler` in workflow engine
- [ ] Provider bridge adapter
- [ ] Trace integration
- [ ] Integration tests
- [ ] Verified example workflows

### Files to Create/Modify

```
packages/core/workflow-engine/src/
├── step-handlers/
│   ├── index.ts              # MODIFY
│   └── discuss.ts            # NEW
├── runner.ts                 # MODIFY (register discuss handler)
└── provider-bridge.ts        # NEW (adapter to provider adapters)

packages/adapters/providers/src/
└── discussion-adapter.ts     # NEW (implement DiscussionProviderExecutor)

tests/integration/
└── discussion-workflow.test.ts  # NEW
```

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Workflow Engine                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐         ┌─────────────────────────────────┐   │
│  │ Workflow Runner │────────▶│ Step Handler Registry           │   │
│  └─────────────────┘         │  - prompt: PromptStepHandler    │   │
│                              │  - tool: ToolStepHandler        │   │
│                              │  - discuss: DiscussStepHandler  │◀──│───NEW
│                              └─────────────────────────────────┘   │
│                                         │                           │
│                                         ▼                           │
│                              ┌─────────────────────────────────┐   │
│                              │    DiscussionProviderBridge     │   │
│                              └─────────────────────────────────┘   │
│                                         │                           │
└─────────────────────────────────────────│───────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Provider Adapters                             │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │ Claude │  │  GLM   │  │  Qwen  │  │ Gemini │  │ Codex  │        │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 4: CLI & MCP (Days 13-16)

### Objective
Expose discussion functionality via CLI commands and MCP tools.

### Tasks

| ID | Task | Priority | Effort | Dependencies |
|----|------|----------|--------|--------------|
| 4.1 | Implement `ax discuss` command | High | 4h | Phase 3 |
| 4.2 | Add provider flag parsing | High | 1h | 4.1 |
| 4.3 | Add pattern flag parsing | High | 1h | 4.1 |
| 4.4 | Add rounds flag parsing | Medium | 0.5h | 4.1 |
| 4.5 | Add consensus flag parsing | Medium | 0.5h | 4.1 |
| 4.6 | Implement verbose output mode | Medium | 2h | 4.1 |
| 4.7 | Implement JSON output mode | Medium | 1h | 4.1 |
| 4.8 | Add progress indicators | Low | 2h | 4.1 |
| 4.9 | Implement `ax_discuss` MCP tool | High | 3h | Phase 3 |
| 4.10 | Implement `ax_discuss_quick` MCP tool | Medium | 1h | 4.9 |
| 4.11 | Register MCP tools | High | 1h | 4.9-4.10 |
| 4.12 | Write CLI tests | High | 3h | 4.1-4.8 |
| 4.13 | Write MCP tool tests | High | 2h | 4.9-4.11 |
| 4.14 | Manual testing with all providers | High | 2h | 4.1-4.11 |

### Deliverables
- [ ] `ax discuss` CLI command
- [ ] `ax_discuss` MCP tool
- [ ] `ax_discuss_quick` MCP tool
- [ ] CLI and MCP tests

### CLI Command Specification

```bash
# Command signature
ax discuss <topic> [options]

# Options
  -p, --providers <list>      Comma-separated providers (default: claude,glm,qwen,gemini)
  --pattern <pattern>         Pattern: round-robin, debate, critique, voting, synthesis
  -r, --rounds <n>            Number of rounds (default: 2)
  --consensus <method>        Consensus: synthesis, voting, moderator
  -o, --options <list>        Options for voting pattern
  -c, --context <text>        Additional context
  -v, --verbose               Show all rounds
  --json                      Output as JSON
  --cost-estimate             Show cost estimate before running

# Examples
ax discuss "Best database for real-time app"
ax discuss "REST vs GraphQL" --providers claude,glm,qwen --pattern debate
ax discuss "Monolith vs Microservices" --pattern voting --options "monolith,microservices,hybrid"
ax discuss "翻译这段文字" --providers qwen,glm,gemini  # Multilingual
```

### MCP Tool Specification

```typescript
// ax_discuss tool
{
  name: 'ax_discuss',
  description: 'Start multi-model discussion with Claude, GLM, Qwen, Gemini',
  inputSchema: {
    topic: z.string(),
    pattern: DiscussionPatternSchema.optional(),
    providers: z.array(z.string()).optional(),
    rounds: z.number().optional(),
    consensusMethod: ConsensusMethodSchema.optional(),
  }
}

// ax_discuss_quick tool (simplified)
{
  name: 'ax_discuss_quick',
  description: 'Quick discussion with default settings (claude, glm, qwen)',
  inputSchema: {
    topic: z.string(),
  }
}
```

### Files to Create/Modify

```
packages/cli/src/commands/
├── index.ts                  # MODIFY (add discuss)
└── discuss.ts                # NEW

packages/mcp-server/src/tools/
├── index.ts                  # MODIFY (add discuss tools)
└── discuss.ts                # NEW

tests/cli/
└── discuss.test.ts           # NEW

tests/contract/
└── mcp-discuss.test.ts       # NEW
```

---

## Phase 5: Polish & Launch (Days 17-20)

### Objective
Complete testing, documentation, and launch preparation.

### Tasks

| ID | Task | Priority | Effort | Dependencies |
|----|------|----------|--------|--------------|
| 5.1 | Run full test suite | High | 2h | Phase 4 |
| 5.2 | Fix any failing tests | High | 4h | 5.1 |
| 5.3 | Run `pnpm validate` | High | 1h | 5.2 |
| 5.4 | Update README.md with discuss feature | High | 2h | 5.3 |
| 5.5 | Create `docs/guides/multi-model-discussion.md` | High | 3h | 5.3 |
| 5.6 | Update CLI help text | Medium | 1h | 5.3 |
| 5.7 | Create additional example workflows | Medium | 2h | 5.3 |
| 5.8 | Performance testing | Medium | 2h | 5.3 |
| 5.9 | Cost analysis documentation | Medium | 1h | 5.8 |
| 5.10 | Create demo script | Low | 2h | 5.3 |
| 5.11 | Final code review | High | 3h | 5.1-5.10 |
| 5.12 | Merge to main | High | 1h | 5.11 |

### Deliverables
- [ ] All tests passing
- [ ] `pnpm validate` passing
- [ ] Updated README.md
- [ ] Discussion guide documentation
- [ ] Additional example workflows
- [ ] Performance benchmarks
- [ ] Demo script

### Documentation Structure

```
docs/
├── guides/
│   └── multi-model-discussion.md   # NEW - Complete guide
└── reference/
    └── discussion-patterns.md      # NEW - Pattern reference

examples/workflows/
├── multi-model-discussion.yaml     # UPDATED
├── adversarial-debate.yaml         # EXISTS
├── document-review.yaml            # NEW - Qwen OCR + Claude analysis
├── multilingual-discussion.yaml    # NEW - Qwen + GLM translation
└── code-architecture-debate.yaml   # NEW - GLM + Claude + Codex
```

### Example Workflows to Create

#### 1. Document Review (Qwen OCR Focus)
```yaml
workflowId: document-review
providers: [qwen, claude, gemini]
# Qwen extracts text via OCR
# Claude analyzes content
# Gemini provides research context
```

#### 2. Multilingual Discussion
```yaml
workflowId: multilingual-discussion
providers: [qwen, glm, gemini]
# Qwen handles translation (29 languages)
# GLM provides Chinese perspective
# Gemini adds research
```

#### 3. Code Architecture Debate
```yaml
workflowId: code-architecture-debate
providers: [glm, claude, codex]
# GLM proposes implementation (73.8% SWE-bench)
# Claude critiques architecture
# Codex provides alternatives
```

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Provider API changes | Low | High | Abstract provider interface, version lock |
| Performance bottleneck | Medium | Medium | Parallel execution, timeouts, caching |
| Cost overruns | Medium | Low | Cost estimates, round limits, GLM default |
| Provider unavailability | Medium | Medium | Graceful degradation, min 2 providers |
| Consensus quality issues | Low | Medium | Multiple consensus options, user override |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test coverage | > 90% | `pnpm test --coverage` |
| Build success | 100% | `pnpm validate` |
| CLI response time | < 5s startup | Manual timing |
| Discussion completion | > 95% | Integration tests |
| User satisfaction | > 4/5 | User feedback |

---

## Team Allocation

| Phase | Engineer 1 | Engineer 2 (Optional) |
|-------|------------|----------------------|
| Phase 1 | Contracts & schemas | Contract tests |
| Phase 2 | Pattern executors | Consensus mechanisms |
| Phase 3 | Workflow integration | Provider bridge |
| Phase 4 | CLI command | MCP tools |
| Phase 5 | Documentation | Testing & polish |

---

## Dependencies & Prerequisites

### External Dependencies
- Node.js >= 20.0.0
- pnpm >= 9.15.0
- Provider CLIs installed (claude, glm, qwen, gemini, etc.)

### Internal Dependencies
- `@automatosx/contracts` (Phase 1)
- `@automatosx/workflow-engine` (Phase 3)
- `@automatosx/providers` (Phase 3)
- `@automatosx/cli` (Phase 4)
- `@automatosx/mcp-server` (Phase 4)

---

## Rollback Plan

If issues arise post-launch:

1. **Feature flag**: `features.enableDiscussions: false`
2. **Version rollback**: Revert to previous release
3. **Graceful degradation**: Fall back to single-provider execution

---

## Appendix: Daily Schedule

### Week 1 (Days 1-5)
| Day | Tasks | Deliverables |
|-----|-------|--------------|
| 1 | 1.1-1.4 | Schema directory, basic schemas |
| 2 | 1.5-1.10 | Complete schemas, exports |
| 3 | 1.11-1.13, 2.1-2.2 | Contract tests, domain setup |
| 4 | 2.3-2.5 | Executor, round-robin, synthesis |
| 5 | 2.6-2.8 | Debate, critique, voting patterns |

### Week 2 (Days 6-10)
| Day | Tasks | Deliverables |
|-----|-------|--------------|
| 6 | 2.9-2.12 | Consensus mechanisms, prompts |
| 7 | 2.13-2.16 | Provider health, parallel exec, tests |
| 8 | 3.1-3.4 | Step handler, workflow integration |
| 9 | 3.5-3.8 | Trace, provider bridge, affinity |
| 10 | 3.9-3.10 | Integration tests, workflow testing |

### Week 3 (Days 11-15)
| Day | Tasks | Deliverables |
|-----|-------|--------------|
| 11 | 4.1-4.5 | CLI command with flags |
| 12 | 4.6-4.8 | Output modes, progress |
| 13 | 4.9-4.11 | MCP tools |
| 14 | 4.12-4.14 | CLI/MCP tests, manual testing |
| 15 | 5.1-5.3 | Full test suite, validation |

### Week 4 (Days 16-20)
| Day | Tasks | Deliverables |
|-----|-------|--------------|
| 16 | 5.4-5.5 | README, guide documentation |
| 17 | 5.6-5.7 | Help text, example workflows |
| 18 | 5.8-5.9 | Performance testing, cost docs |
| 19 | 5.10-5.11 | Demo script, code review |
| 20 | 5.12 | Merge to main, launch |

---

*This action plan is ready for execution. Update status in PRD/STATUS-multi-model-discussion.md as tasks complete.*
