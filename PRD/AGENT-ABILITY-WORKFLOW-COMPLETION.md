# PRD: Agent, Ability & Workflow System Completion

**Version:** 1.0.0
**Status:** Draft
**Created:** 2025-12-16
**Author:** AutomatosX Team

---

## Executive Summary

The AutomatosX platform has foundational implementations for agents, abilities, and workflows that are incomplete or disconnected. This PRD defines the work required to make these systems fully functional and integrated.

### Current State

| Component | Contract | Implementation | Integration | Tests |
|-----------|----------|----------------|-------------|-------|
| Agent Profiles | ✅ | ✅ | ✅ | ✅ 59 tests |
| Ability System | ✅ | ✅ | ❌ BROKEN | ❌ 0 tests |
| Workflow Engine | ✅ | ⚠️ Partial | ⚠️ Infra only | ✅ 23 tests |

### Target State

| Component | Contract | Implementation | Integration | Tests |
|-----------|----------|----------------|-------------|-------|
| Agent Profiles | ✅ | ✅ | ✅ | ✅ |
| Ability System | ✅ | ✅ | ✅ | ✅ |
| Workflow Engine | ✅ | ✅ | ✅ | ✅ |

---

## Problem Statement

### 1. Ability System is Orphaned

The ability system (`packages/core/ability-domain/`) is fully implemented but never connected:

- `AbilityManager` exists but is never called
- Agent executor ignores `coreAbilities` field in agent profiles
- No MCP tools expose ability functionality
- No CLI commands for ability management
- Zero test coverage despite full implementation
- 52 example abilities exist in `examples/abilities/` but are unused

**Impact:** Users cannot leverage the ability injection system to enhance agent capabilities.

### 2. Workflow Step Executors are Placeholders

In `packages/core/workflow-engine/src/executor.ts`, all step handlers return mock data:

```typescript
// Current state - all are TODO stubs
executePromptStep()      // Returns mock "Prompt result"
executeToolStep()        // Returns mock { result: 'Tool executed' }
executeConditionalStep() // Returns mock { branch: 'default' }
executeLoopStep()        // Returns mock { iterations: 0 }
executeParallelStep()    // Returns mock { results: [] }
```

**Impact:** Workflows validate and sequence correctly but perform no actual work.

### 3. Missing Documentation

- No `invariants.md` for ability contracts
- Ability system behavior undocumented

---

## Requirements

### Phase 1: Ability System Integration (Priority: Critical)

#### 1.1 Ability Domain Tests

**Files to create:**
- `tests/contract/ability.test.ts` - Schema validation tests
- `tests/core/ability-domain.test.ts` - Domain logic tests

**Test coverage required:**
- AbilitySchema validation (valid/invalid cases)
- AbilityManifestSchema validation
- AbilityLoadResultSchema validation
- AbilityInjectionRequestSchema validation
- InMemoryAbilityRegistry operations (register, get, list, filter, remove)
- FileSystemAbilityLoader (markdown parsing, frontmatter extraction)
- DefaultAbilityManager (scoring, injection, token counting)
- Error codes (ABILITY_NOT_FOUND, ABILITY_VALIDATION_ERROR, etc.)

**Acceptance criteria:**
- [ ] 15+ contract tests passing
- [ ] 25+ domain tests passing
- [ ] All error codes tested

#### 1.2 Ability MCP Tools

**Tools to implement in `packages/mcp-server/src/tools/ability.ts`:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `ability_list` | List available abilities | `category?`, `tags?`, `enabled?`, `limit?` |
| `ability_get` | Get ability by ID | `abilityId` (required) |
| `ability_inject` | Inject abilities into prompt | `agentId`, `task`, `maxAbilities?`, `maxTokens?` |
| `ability_register` | Register new ability | `abilityId`, `content`, `category?`, `tags?`, etc. |
| `ability_remove` | Remove ability | `abilityId` (required) |

**Acceptance criteria:**
- [ ] All 5 tools implemented with proper schemas
- [ ] Tools registered in MCP server
- [ ] Idempotency documented per tool
- [ ] Error handling for all failure cases

#### 1.3 Agent-Ability Integration

**Modify `packages/core/agent-domain/src/executor.ts`:**

1. Import `AbilityManager` from `@automatosx/ability-domain`
2. Before executing prompt steps, call `abilityManager.injectAbilities()`
3. Inject ability content into the prompt context
4. Respect `coreAbilities` from agent profile

**New invariants:**
- `INV-AGT-ABL-001`: Abilities injected before prompt execution
- `INV-AGT-ABL-002`: Core abilities always included if specified
- `INV-AGT-ABL-003`: Token limits respected during injection

**Acceptance criteria:**
- [ ] AbilityManager integrated into DefaultAgentExecutor
- [ ] Prompt steps receive injected abilities
- [ ] Token limits enforced
- [ ] Tests verify ability injection

#### 1.4 Ability Invariants Documentation

**Create `packages/contracts/src/ability/v1/invariants.md`:**

Document behavioral guarantees:
- `INV-ABL-001`: Ability IDs are unique within registry
- `INV-ABL-002`: Abilities sorted by priority descending
- `INV-ABL-003`: Token limits enforced during injection
- `INV-ABL-004`: Conflicts prevent simultaneous loading
- `INV-ABL-005`: Dependencies loaded before dependents

---

### Phase 2: Workflow Step Executors (Priority: High)

#### 2.1 Prompt Step Executor

**File:** `packages/core/workflow-engine/src/executor.ts`

**Implementation:**
```typescript
async function executePromptStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
  const { prompt, model, temperature } = step.config || {};
  // Call provider registry to execute prompt
  // Return LLM response
}
```

**Integration:** Use `@automatosx/providers` for LLM calls

**Acceptance criteria:**
- [ ] Executes prompts via provider registry
- [ ] Supports model selection
- [ ] Supports temperature configuration
- [ ] Returns structured response

#### 2.2 Tool Step Executor

**Implementation:**
```typescript
async function executeToolStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
  const { toolName, toolInput } = step.config || {};
  // Invoke MCP tool
  // Return tool result
}
```

**Acceptance criteria:**
- [ ] Invokes MCP tools by name
- [ ] Passes input parameters
- [ ] Returns tool output
- [ ] Handles tool errors

#### 2.3 Conditional Step Executor

**Implementation:**
```typescript
async function executeConditionalStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
  const { condition, thenSteps, elseSteps } = step.config || {};
  // Evaluate condition expression
  // Execute appropriate branch
  // Return branch result
}
```

**Acceptance criteria:**
- [ ] Evaluates boolean expressions
- [ ] Supports variable substitution from context
- [ ] Executes correct branch
- [ ] Returns branch identifier and result

#### 2.4 Loop Step Executor

**Implementation:**
```typescript
async function executeLoopStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
  const { items, maxIterations, steps } = step.config || {};
  // Iterate over items or until condition
  // Execute nested steps per iteration
  // Collect results
}
```

**Acceptance criteria:**
- [ ] Iterates over arrays
- [ ] Supports max iteration limits
- [ ] Executes nested steps
- [ ] Collects iteration results

#### 2.5 Parallel Step Executor

**Implementation:**
```typescript
async function executeParallelStep(step: WorkflowStep, context: StepContext): Promise<unknown> {
  const { steps, concurrency, failureStrategy } = step.config || {};
  // Execute steps concurrently (up to concurrency limit)
  // Handle failures per strategy
  // Return aggregated results
}
```

**Acceptance criteria:**
- [ ] Executes steps concurrently
- [ ] Respects concurrency limits
- [ ] Supports fail-fast and fail-safe strategies
- [ ] Returns all results

---

### Phase 3: CLI Integration (Priority: Medium)

#### 3.1 Ability CLI Commands

**Add to `packages/cli/src/commands/ability.ts`:**

| Command | Description |
|---------|-------------|
| `ax ability list` | List all abilities |
| `ax ability get <id>` | Show ability details |
| `ax ability load <path>` | Load abilities from directory |
| `ax ability inject <agent> <task>` | Preview ability injection |

**Acceptance criteria:**
- [ ] Commands integrated into CLI
- [ ] Help text for all commands
- [ ] Proper error handling

---

## Technical Design

### Architecture Changes

```
┌─────────────────────────────────────────────────────┐
│  CLI / MCP Server                                   │
│  ├── ability commands (NEW)                         │
│  └── ability tools (NEW)                            │
├─────────────────────────────────────────────────────┤
│  Agent Domain                                       │
│  └── executor.ts ──imports──> AbilityManager (NEW)  │
├─────────────────────────────────────────────────────┤
│  Workflow Engine                                    │
│  └── executor.ts ──imports──> ProviderRegistry (NEW)│
├─────────────────────────────────────────────────────┤
│  Ability Domain (existing, now connected)           │
│  ├── InMemoryAbilityRegistry                        │
│  ├── FileSystemAbilityLoader                        │
│  └── DefaultAbilityManager                          │
└─────────────────────────────────────────────────────┘
```

### New Dependencies

| Package | New Dependency | Purpose |
|---------|----------------|---------|
| `@automatosx/agent-domain` | `@automatosx/ability-domain` | Inject abilities |
| `@automatosx/workflow-engine` | `@automatosx/providers` | Execute prompts |
| `@automatosx/mcp-server` | `@automatosx/ability-domain` | Ability tools |
| `@automatosx/cli` | `@automatosx/ability-domain` | Ability commands |

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/contracts/src/ability/v1/invariants.md` | CREATE | Behavioral documentation |
| `packages/core/agent-domain/src/executor.ts` | MODIFY | Add ability injection |
| `packages/core/agent-domain/package.json` | MODIFY | Add ability-domain dep |
| `packages/core/workflow-engine/src/executor.ts` | MODIFY | Implement step executors |
| `packages/core/workflow-engine/package.json` | MODIFY | Add providers dep |
| `packages/mcp-server/src/tools/ability.ts` | CREATE | Ability MCP tools |
| `packages/mcp-server/src/tools/index.ts` | MODIFY | Register ability tools |
| `packages/mcp-server/package.json` | MODIFY | Add ability-domain dep |
| `packages/cli/src/commands/ability.ts` | CREATE | Ability CLI commands |
| `packages/cli/src/commands/index.ts` | MODIFY | Register ability commands |
| `tests/contract/ability.test.ts` | CREATE | Contract tests |
| `tests/core/ability-domain.test.ts` | CREATE | Domain tests |

---

## Success Metrics

1. **Test Coverage:** 40+ new tests passing
2. **Integration:** Abilities injected in agent prompts
3. **MCP Tools:** 5 ability tools functional
4. **CLI Commands:** 4 ability commands functional
5. **Workflow Execution:** All 5 step types execute real work

---

## Implementation Order

1. **Phase 1.1:** Ability tests (foundation for validation)
2. **Phase 1.4:** Ability invariants.md (documentation)
3. **Phase 1.2:** Ability MCP tools (expose functionality)
4. **Phase 1.3:** Agent-ability integration (core feature)
5. **Phase 2.1-2.5:** Workflow step executors (sequential)
6. **Phase 3.1:** CLI commands (user interface)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token counting inaccurate | Medium | Use tiktoken or provider tokenizers |
| Circular ability dependencies | High | Implement DAG validation |
| Workflow step timeout handling | Medium | Consistent timeout propagation |
| Provider integration complexity | High | Use existing provider registry |

---

## Appendix: Affected Invariants

### Existing (Must Preserve)
- `INV-WF-001`: Steps execute in order
- `INV-WF-002`: Retries scoped to step
- `INV-WF-003`: Schema strictness
- `INV-WF-004`: Step ID uniqueness
- `INV-WF-005`: Immutable definition
- `INV-AGT-*`: All agent invariants

### New (To Implement)
- `INV-ABL-001`: Ability ID uniqueness
- `INV-ABL-002`: Priority sorting
- `INV-ABL-003`: Token limit enforcement
- `INV-ABL-004`: Conflict prevention
- `INV-ABL-005`: Dependency ordering
- `INV-AGT-ABL-001`: Abilities injected before prompts
- `INV-AGT-ABL-002`: Core abilities included
- `INV-AGT-ABL-003`: Token limits respected
