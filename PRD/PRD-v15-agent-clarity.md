# PRD: Agent Clarity & MCP Discovery Improvements

**Version**: 1.0
**Author**: Architecture Review
**Date**: 2025-12-17
**Status**: In Progress

---

## 1. Executive Summary

This PRD addresses critical gaps in agent role clarity, ability-to-agent mapping, and MCP tool specificity. The current system has **22 agents with overlapping roles**, **abilities that conflict with agent names**, and **no automated agent selection** for CLI tools.

**Problem**: CLI tools cannot auto-route tasks to appropriate agents because:
1. Agent roles overlap (5 major overlap areas identified)
2. Abilities share names with agents (confusion)
3. No MCP tool exists to recommend agents based on task

**Solution**: Add agent recommendation MCP tools, clarify agent boundaries via selection metadata, and rename conflicting abilities.

**Estimated Effort**: ~4-5 days

---

## 2. Problem Statement

### Current Gaps

| Gap | Impact | Risk |
|-----|--------|------|
| No `agent_recommend` tool | CLI must hardcode agent selection | High |
| Agent role overlaps | Ambiguous routing, user confusion | Medium |
| Ability naming conflicts | `security` ability vs `security` agent | Medium |
| Missing selection examples | Poor keyword matching accuracy | Medium |

### Overlap Analysis

| Overlap Area | Agents | Issue |
|--------------|--------|-------|
| Architecture/Strategy | `architecture`, `cto` | Both do system design |
| Full-Stack | `fullstack`, `backend`, `frontend` | Redundant composite |
| Review Functions | `reviewer`, `quality`, `security` | All do code review |
| Research | `researcher`, specialized agents | Vague vs specific |
| Leadership | `ceo`, `cto` | Both do strategy |

### What This PRD Addresses

1. **MCP Discovery**: Add `agent_recommend` and `agent_capabilities` tools
2. **Selection Clarity**: Add `exampleTasks`, `notForTasks` to selection metadata
3. **Ability Conflicts**: Rename abilities that conflict with agent names
4. **Agent Boundaries**: Update systemPrompts with explicit scope

---

## 3. Goals & Non-Goals

### Goals

1. **Automated Routing**: CLI can call `agent_recommend` to select best agent for task
2. **Clear Boundaries**: Each agent has explicit scope (what it does and doesn't do)
3. **No Naming Conflicts**: Abilities and agents have distinct names
4. **Introspection**: CLI can query capabilities across all agents

### Non-Goals

- Removing agents (consolidation deferred to future PRD)
- Changing agent execution logic
- Adding new agents
- Modifying ability content

---

## 4. Contract Design

### 4.1 New Schemas

#### Agent Selection Request Schema
```typescript
// packages/contracts/src/agent/v1/schema.ts

export const AgentRecommendRequestSchema = z.object({
  task: z.string().min(1).max(2000).describe('Task description to match'),
  team: z.string().optional().describe('Filter by team'),
  requiredCapabilities: z.array(z.string()).optional().describe('Required capabilities'),
  excludeAgents: z.array(z.string()).optional().describe('Agents to exclude'),
  maxResults: z.number().int().min(1).max(10).default(3).describe('Max recommendations'),
});

export const AgentRecommendResultSchema = z.object({
  recommended: z.string().describe('Best matching agent ID'),
  confidence: z.number().min(0).max(1).describe('Match confidence 0-1'),
  reason: z.string().describe('Why this agent was selected'),
  alternatives: z.array(z.object({
    agentId: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string().optional(),
  })).describe('Alternative agent matches'),
});
```

#### Agent Capabilities Query Schema
```typescript
export const AgentCapabilitiesRequestSchema = z.object({
  category: z.enum(['implementation', 'review', 'strategy', 'research', 'all']).optional(),
  includeDisabled: z.boolean().default(false),
});

export const AgentCapabilitiesResultSchema = z.object({
  capabilities: z.array(z.string()).describe('All unique capabilities'),
  agentsByCapability: z.record(z.string(), z.array(z.string())).describe('Capability → agent IDs'),
  capabilitiesByAgent: z.record(z.string(), z.array(z.string())).describe('Agent ID → capabilities'),
});
```

#### Extended Selection Metadata Schema
```typescript
export const AgentSelectionMetadataSchema = z.object({
  primaryIntents: z.array(z.string()).optional(),
  secondarySignals: z.array(z.string()).optional(),
  negativeIntents: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  antiKeywords: z.array(z.string()).optional(),
  redirectWhen: z.array(RedirectRuleSchema).optional(),
  // NEW: Explicit task examples
  exampleTasks: z.array(z.string()).max(10).optional()
    .describe('Example tasks this agent handles well'),
  notForTasks: z.array(z.string()).max(10).optional()
    .describe('Tasks this agent should NOT handle'),
  // NEW: Agent category for grouping
  agentCategory: z.enum([
    'orchestrator',    // Delegates to others (CEO, CTO, architecture)
    'implementer',     // Executes tasks directly (backend, frontend, devops)
    'reviewer',        // Reviews/audits (reviewer, security, quality)
    'specialist',      // Domain expert (blockchain, ml-engineer, quantum)
    'generalist',      // Fallback (standard)
  ]).optional(),
});
```

### 4.2 Invariants

New invariants for `packages/contracts/src/agent/v1/invariants.md`:

```markdown
## Agent Selection Invariants

### INV-AGT-SEL-001: Selection Determinism

**Statement:** Agent selection MUST be deterministic - same task + context = same result.

**Rationale:** Non-deterministic selection causes unpredictable behavior and debugging difficulties.

**Enforcement:**
- Scoring algorithm has no random components
- Results sorted by score then agentId for tie-breaking
- Tests verify same input produces same output

### INV-AGT-SEL-002: Confidence Range

**Statement:** Selection confidence MUST be between 0 and 1 inclusive.

**Rationale:** Normalized confidence enables threshold-based decisions.

**Enforcement:**
- Score clamped via `Math.max(0, Math.min(1, score))`
- Values outside range logged as error
- Schema validation enforces range

### INV-AGT-SEL-003: Result Ordering

**Statement:** Selection results MUST be sorted by confidence descending.

**Rationale:** Best match should always be first in results.

**Enforcement:**
- Results sorted before return
- Tests verify ordering invariant

### INV-AGT-SEL-004: Fallback Agent

**Statement:** Selection MUST always return at least one result (fallback to `standard`).

**Rationale:** Empty results cause caller errors. Fallback ensures graceful degradation.

**Enforcement:**
- If no matches, return `standard` agent with confidence 0.5
- `standard` agent MUST always exist and be enabled
- Tests verify fallback behavior

### INV-AGT-SEL-005: Example Task Matching

**Statement:** `exampleTasks` MUST boost confidence when matched.

**Rationale:** Explicit examples are highest-quality signal for matching.

**Enforcement:**
- Example task substring match adds +0.4 confidence
- Exact match (normalized) adds +0.6 confidence
- Tests verify example matching boost

### INV-AGT-SEL-006: Negative Task Exclusion

**Statement:** `notForTasks` MUST reduce confidence when matched.

**Rationale:** Explicit exclusions prevent misrouting.

**Enforcement:**
- NotForTask match subtracts -0.5 confidence
- Can drive confidence to 0 (but not below)
- Agent still selectable if other signals strong
```

---

## 5. Proposed Solutions

### 5.1 `agent_recommend` MCP Tool (P0)

**Problem**: CLI has no way to auto-select the best agent for a task.

**Solution**: Add MCP tool that exposes existing `KeywordAgentSelector`.

**Scope**:
- Modify: `packages/mcp-server/src/tools/agent.ts`
- Modify: `packages/mcp-server/src/schema-registry.ts`
- Modify: `packages/contracts/src/mcp/v1/tools/tool-list-schemas.ts`

**Tool Definition**:
```typescript
export const agent_recommend = {
  name: 'agent_recommend',
  description: 'Recommend the best agent for a given task. Returns ranked matches with confidence scores. Use this to auto-route tasks to appropriate agents.',
  inputSchema: AgentRecommendRequestSchema,
  outputSchema: AgentRecommendResultSchema,
  idempotent: true,
  sideEffects: false,
};
```

**Handler Implementation**:
```typescript
async function handleAgentRecommend(input: AgentRecommendRequest): Promise<AgentRecommendResult> {
  const selector = new KeywordAgentSelector(getSharedRegistry());
  const result = await selector.select(input.task, {
    team: input.team,
    requiredCapabilities: input.requiredCapabilities,
    excludeAgents: input.excludeAgents,
  });

  return {
    recommended: result.agentId,
    confidence: result.confidence,
    reason: result.reason,
    alternatives: result.alternatives.slice(0, (input.maxResults ?? 3) - 1),
  };
}
```

**Acceptance Criteria**:
- [ ] Tool returns best agent for task
- [ ] Confidence score 0-1
- [ ] Alternatives included
- [ ] Falls back to `standard` when no match
- [ ] Tests verify determinism

**Effort**: 1 day

---

### 5.2 `agent_capabilities` MCP Tool (P1)

**Problem**: CLI cannot discover what capabilities exist across agents.

**Solution**: Add MCP tool to aggregate and query capabilities.

**Tool Definition**:
```typescript
export const agent_capabilities = {
  name: 'agent_capabilities',
  description: 'List all unique capabilities across agents with mapping to agent IDs. Use for capability-based routing.',
  inputSchema: AgentCapabilitiesRequestSchema,
  outputSchema: AgentCapabilitiesResultSchema,
  idempotent: true,
  sideEffects: false,
};
```

**Handler Implementation**:
```typescript
async function handleAgentCapabilities(input: AgentCapabilitiesRequest): Promise<AgentCapabilitiesResult> {
  const agents = await getSharedRegistry().list({
    enabled: input.includeDisabled ? undefined : true
  });

  const agentsByCapability: Record<string, string[]> = {};
  const capabilitiesByAgent: Record<string, string[]> = {};

  for (const agent of agents) {
    const caps = agent.capabilities ?? [];
    capabilitiesByAgent[agent.agentId] = caps;

    for (const cap of caps) {
      if (!agentsByCapability[cap]) agentsByCapability[cap] = [];
      agentsByCapability[cap].push(agent.agentId);
    }
  }

  // Filter by category if specified
  // ... category filtering logic

  return {
    capabilities: Object.keys(agentsByCapability).sort(),
    agentsByCapability,
    capabilitiesByAgent,
  };
}
```

**Acceptance Criteria**:
- [ ] Returns all unique capabilities
- [ ] Maps capabilities to agents bidirectionally
- [ ] Category filter works
- [ ] Tests verify completeness

**Effort**: 0.5 day

---

### 5.3 Update Agent Selection Metadata (P1)

**Problem**: Agents lack explicit task examples, causing poor keyword matching.

**Solution**: Add `exampleTasks` and `notForTasks` to all agents.

**Scope**:
- Modify: `.automatosx/agents.json` (all 22 agents)

**Example Updates**:

```json
{
  "agentId": "reviewer",
  "selectionMetadata": {
    "exampleTasks": [
      "Review this pull request",
      "Check this code for bugs",
      "Analyze code quality",
      "Find security vulnerabilities in this file",
      "Review architecture of this module"
    ],
    "notForTasks": [
      "Write new code",
      "Fix this bug",
      "Implement this feature",
      "Design system architecture"
    ],
    "agentCategory": "reviewer"
  }
}
```

```json
{
  "agentId": "backend",
  "selectionMetadata": {
    "exampleTasks": [
      "Build an API endpoint",
      "Optimize this database query",
      "Implement a microservice",
      "Add caching to this service",
      "Create a REST API"
    ],
    "notForTasks": [
      "Review code",
      "Write documentation",
      "Design UI components",
      "Create mobile app"
    ],
    "agentCategory": "implementer"
  }
}
```

**Acceptance Criteria**:
- [ ] All agents have exampleTasks (3-5 each)
- [ ] All agents have notForTasks (3-5 each)
- [ ] All agents have agentCategory
- [ ] Selection accuracy improved

**Effort**: 1.5 days

---

### 5.4 Rename Conflicting Abilities (P1)

**Problem**: Ability names conflict with agent names (e.g., `security` ability vs `security` agent).

**Solution**: Rename abilities to be distinct.

**Scope**:
- Rename: `examples/abilities/security.md` → `security-practices.md`
- Rename: `examples/abilities/code-review.md` → `review-checklist.md`
- Update: abilityId in frontmatter

**Changes**:

| Current | New | Rationale |
|---------|-----|-----------|
| `security` | `security-practices` | Distinguish from `security` agent |
| `code-review` | `review-checklist` | Distinguish from `reviewer` agent |

**Acceptance Criteria**:
- [ ] No ability shares name with agent
- [ ] Agent ability references updated
- [ ] Tests pass

**Effort**: 0.5 day

---

### 5.5 Update Agent systemPrompts with Scope (P2)

**Problem**: Agent systemPrompts don't clearly state what they should NOT do.

**Solution**: Add explicit scope boundaries to systemPrompts.

**Template Addition**:
```
## Scope

**You SHOULD handle:**
- [Task type 1]
- [Task type 2]

**You should NOT handle (delegate or reject):**
- [Task type A] → suggest: [agent]
- [Task type B] → suggest: [agent]
```

**Example for `reviewer` agent**:
```
## Scope

**You SHOULD handle:**
- Code reviews (all focus modes: security, architecture, performance, correctness)
- PR analysis and feedback
- Code quality assessment

**You should NOT handle (delegate or reject):**
- Writing new code → suggest: backend, frontend
- Fixing bugs → suggest: backend, frontend, fullstack
- System design → suggest: architecture
- Documentation → suggest: writer
```

**Acceptance Criteria**:
- [ ] All agents have scope section
- [ ] Suggestions reference valid agents
- [ ] Reduces cross-agent confusion

**Effort**: 1 day

---

## 6. Guard Policy Integration

### New Guard Policy: `agent-selection-quality`

Ensures agent selection metadata is complete:

```typescript
// packages/guard/src/policies/agent-selection-quality.ts

export const agentSelectionQualityPolicy: GuardPolicy = {
  policyId: 'agent-selection-quality',
  description: 'Validates agent selection metadata completeness',
  gates: [
    {
      gateId: 'selection-metadata-complete',
      name: 'Selection Metadata Complete',
      check: (agent: AgentProfile) => {
        const meta = agent.selectionMetadata;
        const issues: string[] = [];

        if (!meta?.exampleTasks?.length) {
          issues.push('Missing exampleTasks');
        }
        if (!meta?.notForTasks?.length) {
          issues.push('Missing notForTasks');
        }
        if (!meta?.agentCategory) {
          issues.push('Missing agentCategory');
        }

        return {
          status: issues.length === 0 ? 'PASS' : 'WARN',
          issues,
        };
      },
    },
  ],
};
```

---

## 7. Implementation Phases

### Phase 1: Contracts & Tools (Day 1-2)
- Add schemas to contracts package
- Add invariants to agent domain
- Implement `agent_recommend` MCP tool
- Implement `agent_capabilities` MCP tool

### Phase 2: Agent Metadata (Day 2-3)
- Update all 22 agents with exampleTasks
- Update all 22 agents with notForTasks
- Add agentCategory to all agents
- Rename conflicting abilities

### Phase 3: Polish & Tests (Day 4)
- Update agent systemPrompts with scope
- Add contract tests for new invariants
- Integration tests for new MCP tools

---

## 8. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Agent discovery tools | 0 | 2 (`recommend`, `capabilities`) |
| Agents with exampleTasks | 0 | 22 (100%) |
| Agents with notForTasks | 0 | 22 (100%) |
| Ability/agent naming conflicts | 2 | 0 |
| Selection invariants | 3 | 6 |

---

## 9. Files to Create/Modify

### New Files
```
PRD/PRD-v15-agent-clarity.md (this file)
```

### Modified Files
```
packages/contracts/src/agent/v1/schema.ts (add selection schemas)
packages/contracts/src/agent/v1/invariants.md (add selection invariants)
packages/contracts/src/mcp/v1/tools/tool-list-schemas.ts (add tool schemas)
packages/mcp-server/src/tools/agent.ts (add recommend/capabilities handlers)
packages/mcp-server/src/schema-registry.ts (register new schemas)
packages/mcp-server/src/tools/index.ts (export new tools)
packages/core/agent-domain/src/selector.ts (enhance scoring)
.automatosx/agents.json (update all agents)
examples/abilities/security.md → security-practices.md (rename)
examples/abilities/code-review.md → review-checklist.md (rename)
tests/contract/agent-selection.test.ts (new tests)
```

---

## 10. Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Add MCP tools vs CLI commands | MCP enables cross-tool integration | CLI-only (less flexible) |
| Rename abilities vs agents | Abilities are knowledge, agents are actors | Rename agents (more disruption) |
| Add examples to metadata vs systemPrompt | Metadata enables programmatic matching | systemPrompt-only (not queryable) |
| Keep all agents vs consolidate | Defer consolidation to future PRD | Remove now (more risk) |
