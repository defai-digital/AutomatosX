# PRD: AutomatosX v14 Improvements

**Version**: 1.1
**Author**: Architecture Review
**Date**: 2025-12-17
**Status**: Draft

---

## 1. Executive Summary

This PRD outlines targeted improvements to AutomatosX based on an architecture review. The focus is on **security hardening**, **agent functionality**, and **developer experience** - areas where gaps exist in the current v13.0.0 implementation.

**Scope**: 4 focused improvements prioritized by impact-to-effort ratio.

**Estimated Effort**: ~9 days

---

## 2. Problem Statement

### Current Gaps Identified

| Gap | Risk | Impact |
|-----|------|--------|
| No rate limiting on MCP tools | Runaway agent loops can exhaust resources | High |
| No secrets detection in Guard | Credentials may leak in code changes | High |
| Workflow agents lack execution steps | Agents return without doing work | Medium |
| No domain documentation | Slow onboarding, knowledge silos | Low |

### What This PRD Does NOT Address

- Event store partitioning (premature - current scale doesn't require it)
- Connection pooling (premature - CLI process overhead acceptable)
- Feature flags (no immediate use case)
- Metrics export (trace data sufficient for current needs)
- Workflow visualization (nice-to-have, not blocking)
- Structured logging contract (existing trace domain sufficient; use simple utility if needed)
- Provider health aggregation (existing circuit breaker in resilience-domain handles this)

---

## 3. Goals & Non-Goals

### Goals

1. **Security**: Prevent resource exhaustion and credential leaks
2. **Usability**: Make agents actually executable with workflows
3. **Onboarding**: Improve developer documentation for faster ramp-up

### Non-Goals

- Redesigning core architecture (it's solid)
- Adding new providers
- Changing storage backend
- Building a UI
- Duplicating functionality that exists (circuit breaker, trace domain)

---

## 4. Proposed Solutions

### 4.1 MCP Tool Rate Limiting (P0)

**Problem**: MCP tools have no call limits. A malfunctioning agent could call `agent_run` in a loop indefinitely.

**Solution**: Add configurable rate limits per tool category.

**Scope**:
- New file: `packages/mcp-server/src/middleware/rate-limiter.ts`
- Modify: `packages/mcp-server/src/server.ts` to apply middleware
- New contract: `packages/contracts/src/mcp/v1/rate-limit.schema.ts`

**Configuration**:
```typescript
const DEFAULT_LIMITS = {
  // Execution tools - most restricted
  agent_run: { rpm: 30, burst: 5 },
  workflow_run: { rpm: 20, burst: 3 },

  // Mutation tools - moderate
  memory_store: { rpm: 100, burst: 20 },
  memory_delete: { rpm: 50, burst: 10 },
  session_create: { rpm: 30, burst: 5 },

  // Read tools - least restricted
  memory_retrieve: { rpm: 200, burst: 50 },
  agent_list: { rpm: 200, burst: 50 },
  trace_list: { rpm: 200, burst: 50 },
};
```

**Behavior**:
- Return 429 with `retryAfter` when limit exceeded
- Log rate limit events to trace domain
- Configurable via `config_set mcp.rateLimits.<tool>`

**Acceptance Criteria**:
- [ ] Rate limits enforced per tool
- [ ] Clear error message with retry timing
- [ ] Limits configurable without code change
- [ ] Tests verify limit enforcement

**Effort**: 2-3 days

---

### 4.2 Secrets Detection Gate (P0)

**Problem**: Guard system doesn't detect hardcoded secrets in code changes.

**Solution**: Add `secrets_detection` gate to Guard.

**Scope**:
- New file: `packages/guard/src/gates/secrets.ts`
- Modify: `packages/guard/src/executor.ts` to register gate
- New patterns file: `packages/guard/src/patterns/secret-patterns.ts`

**Detection Patterns**:
```typescript
const SECRET_PATTERNS = [
  // API Keys
  { name: 'generic_api_key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi },
  { name: 'aws_key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'github_token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },

  // Passwords/Secrets
  { name: 'password_assignment', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
  { name: 'secret_assignment', pattern: /(?:secret|private[_-]?key)\s*[:=]\s*['"][^'"]+['"]/gi },

  // Connection strings
  { name: 'connection_string', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi },
];
```

**Behavior**:
- Scan diff content against patterns
- FAIL gate if secrets detected
- Provide file:line location in suggestions
- Allow `.secretsignore` for false positives

**Acceptance Criteria**:
- [ ] Detects common secret patterns
- [ ] Reports exact location of secret
- [ ] Supports ignore file for false positives
- [ ] Zero false positives on existing codebase

**Effort**: 2-3 days

---

### 4.3 Agent Workflow Registration (P1)

**Problem**: Registered agents have system prompts but no workflow steps. Running them returns immediately without execution.

**Solution**: Provide default workflow templates and update agent registration.

**Scope**:
- New file: `packages/core/agent-domain/src/workflow-templates.ts`
- Modify: `packages/mcp-server/src/tools/agent.ts` to support templates
- Update existing agent registrations

**Templates**:
```typescript
export const WORKFLOW_TEMPLATES = {
  // Simple prompt-response pattern
  'prompt-response': [
    {
      stepId: 'execute',
      name: 'Execute Prompt',
      type: 'prompt' as const,
      config: { useSystemPrompt: true }
    }
  ],

  // Research pattern with web search
  'research': [
    { stepId: 'search', name: 'Web Search', type: 'tool', config: { tool: 'web_search' } },
    { stepId: 'analyze', name: 'Analyze Results', type: 'prompt', config: {} },
    { stepId: 'summarize', name: 'Summarize', type: 'prompt', config: {} }
  ],

  // Code review pattern
  'code-review': [
    { stepId: 'read', name: 'Read Code', type: 'tool', config: { tool: 'read_files' } },
    { stepId: 'analyze', name: 'Analyze', type: 'prompt', config: {} },
    { stepId: 'report', name: 'Generate Report', type: 'prompt', config: {} }
  ]
};
```

**Updated Registration**:
```typescript
// agent_register now accepts workflowTemplate
{
  agentId: 'architecture',
  description: '...',
  workflowTemplate: 'prompt-response', // Uses predefined template
  // OR
  workflow: [...] // Custom workflow
}
```

**Acceptance Criteria**:
- [ ] 3+ workflow templates available
- [ ] `agent_register` accepts `workflowTemplate` parameter
- [ ] Existing agents updated with appropriate templates
- [ ] `agent_run` executes workflow steps

**Effort**: 3-4 days

---

### 4.4 Domain README Documentation (P2)

**Problem**: Contract domains only have `invariants.md`. New developers lack context on domain purpose and usage.

**Solution**: Add README.md to each contract domain.

**Scope**:
- Add `README.md` to 10 core domains in `packages/contracts/src/*/v1/`

**Template**:
```markdown
# {Domain} Contract

## Purpose
Brief description of what this domain handles.

## Key Concepts
- **Term 1**: Definition
- **Term 2**: Definition

## Schemas
| Schema | Purpose |
|--------|---------|
| `FooSchema` | Represents... |

## Usage Example
\```typescript
import { FooSchema, validateFoo } from '@automatosx/contracts/foo/v1';

const result = validateFoo({ ... });
\```

## Related Domains
- `bar-domain`: How it relates
- `baz-domain`: How it relates

## Invariants
See [invariants.md](./invariants.md) for behavioral guarantees.
```

**Priority Domains**:
1. routing
2. provider
3. agent
4. workflow
5. memory
6. trace
7. guard
8. session
9. mcp
10. config

**Acceptance Criteria**:
- [ ] README exists for 10 core domains
- [ ] Each README follows template structure
- [ ] Usage examples are runnable
- [ ] Cross-references are accurate

**Effort**: 2 days

---

## 5. Implementation Phases

### Phase 1: Security (Week 1)
- 4.1 MCP Tool Rate Limiting (2-3 days)
- 4.2 Secrets Detection Gate (2-3 days)

### Phase 2: Usability (Week 2)
- 4.3 Agent Workflow Registration (3-4 days)
- 4.4 Domain README Documentation (2 days, can parallelize)

---

## 6. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| MCP tools with rate limits | 0% | 100% |
| Guard gates for security | 1 | 2 |
| Agents with executable workflows | 0% | 100% |
| Domains with README | 0 | 10 |

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Rate limits too restrictive | Medium | Medium | Start conservative, tune based on usage |
| Secrets detection false positives | Medium | Low | Implement `.secretsignore` from start |
| Agent workflows break existing behavior | Low | High | Default to no-op workflow for backward compat |

---

## 8. Out of Scope (Explicitly Deferred)

The following were considered but intentionally excluded:

1. **Structured Logging Contract** - Trace domain provides observability. If simple logging needed, use a 10-line utility function, not a new contract domain.

2. **Provider Health Aggregation** - Existing circuit breaker in resilience-domain already handles provider failures. Adding parallel health tracking duplicates functionality.

3. **Event Store Partitioning** - Current SQLite handles expected scale. Revisit at 1M+ events.

4. **Process Connection Pooling** - CLI spawn overhead (~50ms) acceptable. Revisit if latency becomes issue.

5. **Feature Flags System** - No current use case for gradual rollouts.

6. **Prometheus Metrics Export** - Trace data sufficient. Revisit when operating at scale.

7. **Property-Based Testing** - Example-based tests provide adequate coverage.

8. **Workflow Visualization** - Nice-to-have, not blocking any use case.

9. **Token Budget Integration** - Token tracking exists but integration with routing premature.

10. **Audit Log Contract** - Trace domain provides sufficient audit trail.

11. **Saga Implementation** - Cross-cutting stubs sufficient until multi-step workflows needed.

12. **Contract Migration Strategy** - No v2 contracts planned, document when needed.

---

## 9. Appendix: Files to Create/Modify

### New Files
```
packages/mcp-server/src/middleware/rate-limiter.ts
packages/contracts/src/mcp/v1/rate-limit.schema.ts
packages/guard/src/gates/secrets.ts
packages/guard/src/patterns/secret-patterns.ts
packages/core/agent-domain/src/workflow-templates.ts
packages/contracts/src/*/v1/README.md (10 files)
```

### Modified Files
```
packages/mcp-server/src/server.ts
packages/guard/src/executor.ts
packages/mcp-server/src/tools/agent.ts
```

**Total New Files**: ~16
**Total Modified Files**: ~3

---

## 10. Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Rate limit at MCP layer | Single enforcement point | Per-tool, per-domain |
| Regex-based secrets detection | Simple, fast, good enough | AST analysis (complex) |
| Workflow templates over full DSL | Covers common cases, simple | Full workflow DSL (overengineering) |
| Skip logging contract | Trace domain exists, avoid duplication | New logging domain (overengineering) |
| Skip health aggregation | Circuit breaker exists, avoid duplication | New health tracker (overengineering) |
