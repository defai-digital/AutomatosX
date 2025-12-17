# MCP Tool Value Analysis

## Evaluation Criteria

| Criteria | Weight | Description |
|----------|--------|-------------|
| Core Functionality | 40% | Essential for platform to work |
| Usage Frequency | 25% | How often tools are likely used |
| Uniqueness | 20% | Can't be done easily another way |
| User Value | 15% | Direct benefit to end users |

## Value Tiers

---

## HIGH VALUE (Essential - Always Load)

These tools provide core platform functionality that cannot be replicated by the LLM natively.

### 1. Memory Core (4 tools) - **KEEP**
| Tool | Score | Justification |
|------|-------|---------------|
| `memory_store` | 95 | Core state persistence - LLM has no persistent memory |
| `memory_retrieve` | 95 | Core state retrieval - essential for context |
| `memory_search` | 85 | Find relevant context - unique capability |
| `memory_list` | 75 | Discovery of stored keys - needed for navigation |

**Recommendation**: Consolidate to `memory` with actions: store, get, search, list

### 2. Agent Execution (2 tools) - **KEEP**
| Tool | Score | Justification |
|------|-------|---------------|
| `agent_run` | 95 | Core execution - the main purpose of the platform |
| `agent_list` | 80 | Discover available agents - essential for orchestration |

**Recommendation**: Keep `agent_run` separate (high frequency), consolidate management tools

### 3. Session Core (3 tools) - **KEEP**
| Tool | Score | Justification |
|------|-------|---------------|
| `session_create` | 90 | Start collaboration - essential entry point |
| `session_status` | 85 | Monitor progress - frequently needed |
| `session_complete` | 85 | Clean termination - required for lifecycle |

**Recommendation**: Consolidate to `session` with actions: create, status, complete

### 4. Workflow Execution (2 tools) - **KEEP**
| Tool | Score | Justification |
|------|-------|---------------|
| `workflow_run` | 90 | Execute workflows - core orchestration |
| `workflow_list` | 75 | Discover workflows - needed for selection |

**Recommendation**: Consolidate to `workflow` with actions: run, list

### 5. Configuration (3 tools) - **KEEP**
| Tool | Score | Justification |
|------|-------|---------------|
| `config_get` | 85 | Read settings - essential for behavior |
| `config_set` | 80 | Modify settings - needed for customization |
| `config_show` | 70 | View all config - useful for debugging |

**Recommendation**: Consolidate to `config` with actions: get, set, show

---

## MEDIUM VALUE (Useful - Load On-Demand)

These tools provide value but are used less frequently or have partial overlap with LLM capabilities.

### 6. Agent Management (3 tools) - **CONSOLIDATE**
| Tool | Score | Justification |
|------|-------|---------------|
| `agent_get` | 70 | View agent details - occasionally needed |
| `agent_register` | 65 | Create agents - setup-time only |
| `agent_remove` | 60 | Delete agents - rare operation |

**Recommendation**: Consolidate into `agent` tool with agent_run, actions: run, list, get, register, remove

### 7. Session Extended (4 tools) - **CONSOLIDATE**
| Tool | Score | Justification |
|------|-------|---------------|
| `session_list` | 70 | View sessions - occasional |
| `session_join` | 65 | Multi-agent scenarios - less common |
| `session_leave` | 60 | Multi-agent scenarios - less common |
| `session_fail` | 65 | Error handling - important but rare |

**Recommendation**: Add to `session` tool: list, join, leave, fail

### 8. Guard/Governance (3 tools) - **CONSOLIDATE**
| Tool | Score | Justification |
|------|-------|---------------|
| `guard_check` | 75 | Policy enforcement - important for safety |
| `guard_list` | 65 | View policies - setup/debug |
| `guard_apply` | 70 | Apply policies - important for compliance |

**Recommendation**: Consolidate to `guard` with actions: check, list, apply

### 9. Trace/Debugging (3 tools) - **CONSOLIDATE**
| Tool | Score | Justification |
|------|-------|---------------|
| `trace_list` | 70 | View execution history - debugging |
| `trace_get` | 70 | Detailed trace - debugging |
| `trace_analyze` | 65 | Performance analysis - occasional |

**Recommendation**: Consolidate to `trace` with actions: list, get, analyze

### 10. Ability System (5 tools) - **CONSOLIDATE**
| Tool | Score | Justification |
|------|-------|---------------|
| `ability_inject` | 75 | Context injection - core feature |
| `ability_list` | 65 | Discovery - setup |
| `ability_get` | 60 | View details - occasional |
| `ability_register` | 55 | Create abilities - setup-time |
| `ability_remove` | 50 | Delete abilities - rare |

**Recommendation**: Consolidate to `ability` with actions: inject, list, get, register, remove

---

## LOW VALUE (Remove or Defer)

These tools have significant overlap with native LLM capabilities or are rarely used.

### 11. Orchestration/Tasks (7 tools) - **DEFER**
| Tool | Score | Justification |
|------|-------|---------------|
| `task_submit` | 55 | Queue tasks - complex feature, rarely used |
| `task_status` | 50 | Check status - only if using task queue |
| `task_list` | 50 | View tasks - only if using task queue |
| `task_cancel` | 45 | Cancel tasks - rare |
| `task_retry` | 45 | Retry tasks - rare |
| `queue_create` | 40 | Create queues - setup-time only |
| `queue_list` | 40 | View queues - setup-time only |

**Recommendation**: **REMOVE from default** - Load only if orchestration feature enabled. Most users don't need task queuing.

### 12. Telemetry (7 tools) - **DEFER**
| Tool | Score | Justification |
|------|-------|---------------|
| `metrics_record` | 45 | Record metrics - observability, not core |
| `metrics_increment` | 45 | Increment counters - observability |
| `metrics_query` | 40 | Query metrics - debugging |
| `metrics_list` | 40 | List metrics - debugging |
| `telemetry_summary` | 40 | Overview - debugging |
| `timer_start` | 35 | Timing - debugging |
| `timer_stop` | 35 | Timing - debugging |

**Recommendation**: **REMOVE from default** - Load only if telemetry feature enabled. LLM can estimate timing, metrics are for ops.

### 13. Design Tools (5 tools) - **REMOVE**
| Tool | Score | Justification |
|------|-------|---------------|
| `design_api` | 30 | Generate OpenAPI - **LLM can do this natively** |
| `design_component` | 30 | Generate code - **LLM can do this natively** |
| `design_schema` | 30 | Generate Zod - **LLM can do this natively** |
| `design_architecture` | 30 | Generate diagrams - **LLM can do this natively** |
| `design_list` | 25 | List designs - only useful if using design tools |

**Recommendation**: **REMOVE** - These duplicate what Claude/LLMs do natively. No unique capability.

### 14. Bugfix Tools (3 tools) - **REMOVE**
| Tool | Score | Justification |
|------|-------|---------------|
| `bugfix_scan` | 35 | Scan for bugs - **LLM can do this natively with read** |
| `bugfix_run` | 35 | Fix bugs - **LLM can edit files directly** |
| `bugfix_list` | 30 | List bugs - only useful if using bugfix scan |

**Recommendation**: **REMOVE** - LLM with file read/write is better at finding and fixing bugs.

### 15. Refactor Tools (3 tools) - **REMOVE**
| Tool | Score | Justification |
|------|-------|---------------|
| `refactor_scan` | 35 | Find opportunities - **LLM can analyze code natively** |
| `refactor_apply` | 35 | Apply refactoring - **LLM can edit files directly** |
| `refactor_list` | 30 | List opportunities - only useful if using refactor scan |

**Recommendation**: **REMOVE** - LLM is already excellent at refactoring code.

### 16. Memory Extended (6 tools) - **CONSOLIDATE/DEFER**
| Tool | Score | Justification |
|------|-------|---------------|
| `memory_delete` | 55 | Delete key - occasional maintenance |
| `memory_export` | 40 | Backup - rare admin operation |
| `memory_import` | 40 | Restore - rare admin operation |
| `memory_stats` | 35 | View stats - debugging |
| `memory_bulk_delete` | 35 | Bulk cleanup - rare admin |
| `memory_clear` | 30 | Wipe namespace - dangerous, rare |

**Recommendation**: Keep `memory_delete` in consolidated tool. **DEFER** export/import/stats/bulk_delete/clear to admin mode.

---

## Summary: Value-Based Tool Reduction

### Tier 1: Always Loaded (14 tools → 6 consolidated)
| Original Tools | Consolidated | Est. Tokens |
|----------------|--------------|-------------|
| memory_store, memory_retrieve, memory_search, memory_list, memory_delete | `memory` | ~1,500 |
| agent_run, agent_list, agent_get, agent_register, agent_remove | `agent` | ~1,800 |
| session_create, session_status, session_complete, session_list, session_join, session_leave, session_fail | `session` | ~1,500 |
| workflow_run, workflow_list, workflow_describe | `workflow` | ~800 |
| config_get, config_set, config_show | `config` | ~600 |
| guard_check, guard_list, guard_apply | `guard` | ~700 |
| **Total Tier 1** | **6 tools** | **~6,900** |

### Tier 2: On-Demand (12 tools → 3 consolidated)
| Original Tools | Consolidated | Est. Tokens |
|----------------|--------------|-------------|
| trace_list, trace_get, trace_analyze | `trace` | ~600 |
| ability_list, ability_get, ability_inject, ability_register, ability_remove | `ability` | ~1,200 |
| memory_export, memory_import, memory_stats, memory_bulk_delete, memory_clear | `memory_admin` | ~800 |
| **Total Tier 2** | **3 tools** | **~2,600** |

### Tier 3: Feature-Gated (14 tools → 2 consolidated)
| Original Tools | Consolidated | Load Condition |
|----------------|--------------|----------------|
| task_submit, task_status, task_list, task_cancel, task_retry, queue_create, queue_list | `orchestration` | `features.orchestration=true` |
| metrics_record, metrics_increment, metrics_query, metrics_list, telemetry_summary, timer_start, timer_stop | `telemetry` | `features.telemetry=true` |

### Tier 4: Removed (11 tools)
| Tools | Reason |
|-------|--------|
| design_api, design_component, design_schema, design_architecture, design_list | LLM native capability |
| bugfix_scan, bugfix_run, bugfix_list | LLM native capability |
| refactor_scan, refactor_apply, refactor_list | LLM native capability |

---

## Final Token Estimates

| Mode | Tools | Tokens | Reduction |
|------|-------|--------|-----------|
| Current | 64 | ~42,435 | - |
| Tier 1 Only (Default) | 6 | ~6,900 | **84%** |
| Tier 1 + Tier 2 | 9 | ~9,500 | **78%** |
| All Features | 11 | ~12,500 | **71%** |

---

## Recommended Default Configuration

```typescript
// packages/mcp-server/src/config/tools.ts

export const DEFAULT_TOOLS = [
  'memory',      // store, get, search, list, delete
  'agent',       // run, list, get, register, remove
  'session',     // create, status, complete, list, join, leave, fail
  'workflow',    // run, list, describe
  'config',      // get, set, show
  'guard',       // check, list, apply
];

export const EXTENDED_TOOLS = [
  'trace',       // list, get, analyze
  'ability',     // inject, list, get, register, remove
  'memory_admin', // export, import, stats, bulk_delete, clear
];

export const FEATURE_TOOLS = {
  orchestration: ['task', 'queue'],
  telemetry: ['metrics', 'timer'],
};

// Removed tools (LLM native): design_*, bugfix_*, refactor_*
```

---

## Decision Matrix

| Question | Yes → | No → |
|----------|-------|------|
| Does this provide capability LLM can't do natively? | Keep | Remove |
| Is this used in >50% of sessions? | Tier 1 | Tier 2+ |
| Is this setup/admin only? | Tier 2/3 | Tier 1 |
| Is this debugging/observability? | Tier 2 | Tier 1 |
| Is this an advanced feature most users won't need? | Tier 3 | Tier 1/2 |
