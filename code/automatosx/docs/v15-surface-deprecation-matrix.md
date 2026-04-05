# AutomatosX v15 Surface Deprecation Matrix

Date: 2026-03-27
Status: Accepted v15 reference

This document translates the v15 product-scope PRD into a practical surface-tier decision table.
It reflects the accepted v15 boundary and should stay aligned with `automatosx/product-surface/v15-surface-registry.json`.

It is intentionally opinionated:

- `stable` means default product story
- `advanced` means supported but not headline
- `experimental` means retained only with clear caveats

---

## Tier Definitions

### Stable

- Included in default onboarding
- Safe to highlight in README
- Must have consistent CLI, MCP, and doc naming

### Advanced

- Supported and documented
- Not part of the core value proposition
- May require stronger operator knowledge

### Experimental

- Not suitable for default marketing
- Candidate for removal or further contraction
- Should be clearly labeled if retained

---

## Recommended v15 Command Tiering

| Surface | Recommended Tier | Decision |
|---|---|---|
| `ax setup` | `stable` | Keep as primary bootstrap |
| `ax ship` | `stable` | Keep |
| `ax architect` | `stable` | Keep |
| `ax audit` | `stable` | Keep |
| `ax qa` | `stable` | Keep |
| `ax release` | `stable` | Keep |
| `ax list` | `stable` | Keep as workflow catalog |
| `ax trace` | `stable` | Keep |
| `ax discuss` | `stable` | Keep |
| `ax agent` | `stable` | Keep, but only market real stable agents |
| `ax review` | `stable` | Keep |
| `ax policy` | `stable` | Keep (`ax guard` remains a compatibility alias) |
| `ax doctor` | `stable` | Keep |
| `ax status` | `stable` | Keep |
| `ax run` | `stable` | Keep |
| `ax resume` | `stable` | Keep |
| `ax config` | `stable` | Keep |
| `ax cleanup` | `advanced` | Keep, not headline |
| `ax history` | `advanced` | Keep |
| `ax call` | `advanced` | Keep for direct-provider power users |
| `ax iterate` | `advanced` | Keep while workflow-first remains the center |
| `ax ability` | `advanced` | Keep |
| `ax governance` | `advanced` | Keep until governance story stabilizes |
| `ax bridge` | `advanced` | Architecturally core, but advanced in default product positioning |
| `ax skill` | `advanced` | Companion surface; advanced in default product positioning |
| `ax mcp` | `advanced` | Keep for operator/debug use |
| `ax scaffold` | `advanced` | Keep, not headline |
| `ax feedback` | `advanced` | Keep, not headline |
| `ax monitor` | `advanced` | Keep as an optional local operator dashboard, not onboarding-core |
| `ax update` | `advanced` | Keep if still useful operationally |

---

## Recommended v15 MCP Tool Tiering

### Stable MCP Tools

- `workflow_run`
- `workflow_list`
- `workflow_describe`
- `trace_get`
- `trace_list`
- `trace_analyze`
- `trace_by_session`
- `trace_tree`
- `agent_get`
- `agent_list`
- `agent_run`
- `agent_recommend`
- `discuss_run`
- `discuss_quick`
- `discuss_recursive`
- `review_analyze`
- `review_list`
- `guard_check`
- `guard_list`
- `guard_apply`
- `session_create`
- `session_get`
- `session_list`
- `session_join`
- `session_leave`
- `session_complete`
- `session_fail`

### Advanced MCP Tools

- memory and semantic surfaces
- config/file/directory helpers
- git/pr helpers
- governance aggregate helpers
- bridge/skill helpers
- feedback/metrics/telemetry helpers
- task/queue/timer helpers
- mcp ecosystem helpers
- scaffold helpers

### Experimental MCP Tools

- `design_api`
- `design_architecture`
- `design_component`
- `design_schema`
- `design_list`
- any other helper surface whose primary value is prompt-time generation rather than stable operator workflow

Recommended rule:

- keep experimental tools available only if they are clearly marked and removed from top-level product positioning

---

## Surfaces To Remove From Headline README Claims

Remove or rewrite:

- inflated total tool counts unless generated from real shipped config
- inflated agent counts unless generated from the real stable catalog
- persona catalogs that imply stable built-in agents where only future or registry-defined agents exist
- any wording that implies UX/Figma/product-design ownership as a core AutomatosX capability

Replace with:

- workflow-first use cases
- stable agent ownership
- execution tracing
- review/governance posture
- durable workflow/runtime behavior

---

## Agent Catalog Policy For v15

Only market built-in agents that are present in the stable catalog and aligned with seeded/default runtime behavior.

Current safe built-in catalog:

- `architect`
- `quality`
- `bug-hunter`
- `release-manager`

Do not headline broader personas until they are:

- real
- stable
- documented
- executable

---

## Monitor Decision

`ax monitor` remains in v15 as an `advanced` local operator dashboard.

Decision:

- keep it available for operators and debugging
- remove it from first-run positioning and default product claims
- do not require it to clear a promotion bar before shipping v15

Operator improvements may continue, but they are no longer a blocker for the v15 product boundary.

---

## Migration Notes Required For v15

The release must include:

1. a stable vs advanced vs experimental reference table
2. corrected examples for MCP tool names
3. corrected agent catalog claims
4. a note explaining that some previously advertised helpers are no longer part of the default product story
