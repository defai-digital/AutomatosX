# MCP Tool Value Analysis v2

## Current State: 40 Tools (~25,500 tokens)

After removing 24 low-value tools, we now have 40 tools. This analysis re-evaluates the remaining tools.

---

## Evaluation Criteria

| Criteria | Weight | Description |
|----------|--------|-------------|
| **Unique Capability** | 40% | Can't be done by LLM natively |
| **Usage Frequency** | 30% | How often used in typical sessions |
| **Core vs Support** | 20% | Essential for platform to work |
| **Complexity Justified** | 10% | Tool complexity worth the token cost |

---

## HIGH VALUE - Keep (22 tools, ~14,000 tokens)

Essential tools that provide unique capabilities LLM cannot replicate.

### Memory Core (5 tools) - KEEP ALL
| Tool | Score | Justification |
|------|-------|---------------|
| `memory_store` | 95 | **LLM has no persistent memory** - essential |
| `memory_retrieve` | 95 | **LLM cannot retrieve stored data** - essential |
| `memory_search` | 90 | Semantic search across stored data - unique |
| `memory_list` | 80 | Discover stored keys - needed for navigation |
| `memory_delete` | 75 | Cleanup - necessary for management |

### Agent Core (3 tools) - KEEP
| Tool | Score | Justification |
|------|-------|---------------|
| `agent_run` | 95 | **Core execution** - the platform's purpose |
| `agent_list` | 80 | Discover available agents - essential for orchestration |
| `agent_get` | 70 | View agent details before execution |

### Session Core (4 tools) - KEEP
| Tool | Score | Justification |
|------|-------|---------------|
| `session_create` | 90 | Start collaboration - essential entry point |
| `session_status` | 85 | Monitor progress - frequently needed |
| `session_complete` | 85 | Clean termination - required for lifecycle |
| `session_list` | 70 | View active sessions - management |

### Workflow Core (2 tools) - KEEP
| Tool | Score | Justification |
|------|-------|---------------|
| `workflow_run` | 90 | Execute defined workflows - core orchestration |
| `workflow_list` | 75 | Discover available workflows |

### Config (3 tools) - KEEP
| Tool | Score | Justification |
|------|-------|---------------|
| `config_get` | 85 | Read settings - essential for behavior |
| `config_set` | 80 | Modify settings - needed for customization |
| `config_show` | 65 | View all config - useful for debugging |

### Guard (3 tools) - KEEP
| Tool | Score | Justification |
|------|-------|---------------|
| `guard_check` | 80 | **Policy enforcement** - important for safety |
| `guard_list` | 65 | View available policies |
| `guard_apply` | 75 | Apply governance to session |

### Trace (2 tools) - KEEP (reduced)
| Tool | Score | Justification |
|------|-------|---------------|
| `trace_list` | 70 | View execution history - debugging |
| `trace_get` | 70 | Detailed trace inspection |

---

## MEDIUM VALUE - Consolidate or Defer (9 tools, ~6,000 tokens)

Useful but less frequently used or partially redundant.

### Agent Management (2 tools) - DEFER to setup mode
| Tool | Score | Justification |
|------|-------|---------------|
| `agent_register` | 55 | Setup-time only - rarely used in sessions |
| `agent_remove` | 50 | Rare operation - cleanup |

**Recommendation**: Move to `ax agent register/remove` CLI commands only

### Session Extended (3 tools) - CONSOLIDATE
| Tool | Score | Justification |
|------|-------|---------------|
| `session_join` | 55 | Multi-agent - less common use case |
| `session_leave` | 50 | Multi-agent - less common |
| `session_fail` | 60 | Error handling - important but rare |

**Recommendation**: Keep `session_fail`, defer `join/leave` to advanced mode

### Workflow Extended (1 tool) - OPTIONAL
| Tool | Score | Justification |
|------|-------|---------------|
| `workflow_describe` | 55 | View workflow details - occasional |

### Trace Extended (1 tool) - DEFER
| Tool | Score | Justification |
|------|-------|---------------|
| `trace_analyze` | 50 | Performance analysis - debugging only |

### Ability (2 tools worth keeping) - PARTIAL KEEP
| Tool | Score | Justification |
|------|-------|---------------|
| `ability_inject` | 65 | Context injection - useful for prompts |
| `ability_list` | 55 | Discovery - occasional |

---

## LOW VALUE - Remove (9 tools, ~5,500 tokens)

These tools duplicate LLM native capabilities or are rarely used.

### Bugfix (3 tools) - REMOVE
| Tool | Score | Justification |
|------|-------|---------------|
| `bugfix_scan` | 35 | **LLM can read code and find bugs natively** |
| `bugfix_run` | 35 | **LLM can edit files to fix bugs** |
| `bugfix_list` | 30 | Only useful if using bugfix_scan |

**Why Remove**: Claude/LLMs with file read/edit tools are **better** at finding and fixing bugs than a static scanner. The scanner can only find pattern-based bugs; LLM understands context.

### Refactor (3 tools) - REMOVE
| Tool | Score | Justification |
|------|-------|---------------|
| `refactor_scan` | 35 | **LLM can analyze code for improvements natively** |
| `refactor_apply` | 35 | **LLM can edit files to refactor** |
| `refactor_list` | 30 | Only useful if using refactor_scan |

**Why Remove**: Same as bugfix - LLM with file tools is better at refactoring because it understands intent and context.

### Ability Management (3 tools) - REMOVE
| Tool | Score | Justification |
|------|-------|---------------|
| `ability_get` | 40 | View details - rarely needed |
| `ability_register` | 35 | Setup-time only - use CLI instead |
| `ability_remove` | 30 | Rare operation - use CLI instead |

**Why Remove**: Ability registration should be done via CLI/config files, not runtime MCP calls.

---

## Summary: Recommended Actions

### Action 1: Remove 9 Low-Value Tools
```
bugfix_scan, bugfix_run, bugfix_list (3)
refactor_scan, refactor_apply, refactor_list (3)
ability_get, ability_register, ability_remove (3)
```

**Result: 40 → 31 tools (~20,000 tokens)**

### Action 2: Defer 6 Medium-Value Tools (Optional)
Move to "advanced mode" or CLI-only:
```
agent_register, agent_remove (2)
session_join, session_leave (2)
workflow_describe, trace_analyze (2)
```

**Result: 31 → 25 tools (~16,000 tokens)**

---

## Final Recommended Tool Set

### Tier 1: Always Loaded (25 tools, ~16,000 tokens)

| Category | Tools | Count |
|----------|-------|-------|
| memory | store, retrieve, search, list, delete | 5 |
| agent | run, list, get | 3 |
| session | create, status, complete, list, fail | 5 |
| workflow | run, list | 2 |
| config | get, set, show | 3 |
| guard | check, list, apply | 3 |
| trace | list, get | 2 |
| ability | inject, list | 2 |

### Tier 2: On-Demand / CLI-Only (6 tools)
```
agent_register, agent_remove
session_join, session_leave
workflow_describe, trace_analyze
```

### Removed (33 tools total from original 64)
```
design_* (5), task_*/queue_* (7), telemetry_* (7)
memory_admin (5), bugfix_* (3), refactor_* (3), ability_admin (3)
```

---

## Token Estimates

| Configuration | Tools | Est. Tokens | vs Original |
|---------------|-------|-------------|-------------|
| Original | 64 | ~42,435 | - |
| After Phase 1 (remove low-value) | 31 | ~20,000 | **53% reduction** |
| After Phase 2 (defer medium) | 25 | ~16,000 | **62% reduction** |

---

## Decision Matrix

| Remove? | Criteria |
|---------|----------|
| YES | LLM can do this natively with read/edit |
| YES | Only used at setup time (use CLI instead) |
| YES | Debugging/observability only |
| NO | Provides persistent state LLM lacks |
| NO | Executes platform-specific logic |
| NO | Enforces governance/safety policies |
