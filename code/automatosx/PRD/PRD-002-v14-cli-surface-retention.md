# PRD-002: v14 CLI Surface Retention

## 1. Purpose

Define which CLI commands and legacy feature surfaces from `11.4` and `13.5` should remain part of the v14 product, which should stay advanced, and which should not return as first-class defaults.

This PRD is intentionally narrower than `PRD-001`. It covers the post-migration command-surface retention wave only.

## 2. Review Summary

### 2.1 Legacy Findings

`11.4` contributed the workflow-first product story:
- `ship`
- `architect`
- `audit`
- `qa`
- `release`
- project bootstrap via `setup`
- project context onboarding via `init`

`13.5` contributed the modular operational surface:
- `run`
- `list`
- `trace`
- `discuss`
- `mcp`, `agent`, `session`, `review`, `guard`, `scaffold`, `doctor`, `config`, `status`, `history`, `resume`, `cleanup`

### 2.2 High-Value Commands To Keep

Keep as active v14 surface now:
- `setup`
  Restores the project bootstrap path users actually need before workflows are useful.
- `init`
  Keeps the AI-tool and project-context onboarding path that both old versions promoted.
- `list`
  Gives users a lightweight discovery path for workflow inventory.
- `trace`
  Restores operational visibility without forcing MCP or dashboard usage.
- `discuss`
  Preserves one of the best `13.5` ideas and reuses the shared runtime discussion path already present in v14.

Keep as v14 defaults already shipped:
- `ship`
- `architect`
- `audit`
- `qa`
- `release`
- `run`

Keep later or advanced-only:
- `agent`
- `mcp`
- `session`
- `review`
- `scaffold`
- `guard`
- `doctor`
- `config`
- `status`
- `history`
- `resume`
- `cleanup`

Do not restore as default top-level product surface:
- provider-specific wrappers from `11.4` such as `codex`, `gemini`, and similar monolith-era command splits
- authoring-heavy or internal-only monolith commands as default onboarding

## 3. Product Decision

v14 remains workflow-first, but it retains a small set of high-value support commands from the legacy versions:
- `ax setup`
- `ax init`
- `ax list`
- `ax trace`
- `ax discuss`

These commands must sit on the current shared runtime, shared stores, and MCP-aligned architecture. No monolith command restoration is allowed.

Follow-on advanced retention wave:
- `ax agent`
- `ax mcp`
- `ax session`
- `ax review`

## 4. Requirements

### 4.1 `ax setup`

`ax setup` must:
- create the local `.automatosx/` workspace structure
- create deterministic local config for runtime and artifact paths
- register the default retained agents in the shared runtime state store
- register at least one retained baseline policy for workflow artifact expectations

### 4.2 `ax init`

`ax init` must:
- ensure `ax setup` has already been applied for the target workspace
- create `AX.md`
- create `.automatosx/context/conventions.md`
- create `.automatosx/context/rules.md`
- create local MCP metadata that reflects the actual shared-runtime-backed tool surface

### 4.3 `ax list`

`ax list` must:
- enumerate workflows from the shared runtime loader
- identify which workflows are stable first-class v14 surfaces

### 4.4 `ax trace`

`ax trace` must:
- list recent traces from the shared runtime trace store
- show a single trace record by ID
- analyze a trace record and summarize execution health
- list traces correlated to a specific session id
- work for both workflow and discussion traces

### 4.5 `ax discuss`

`ax discuss` must:
- execute through the shared runtime, not through ad hoc CLI-only logic
- write a durable trace record
- return provider participation, synthesis, and consensus summary

### 4.6 `ax agent`

`ax agent` must:
- list retained agents from shared runtime state
- show a single retained agent by ID
- register a new agent from JSON input through the shared runtime state store

### 4.7 `ax mcp`

`ax mcp` must:
- list the locally available MCP tools
- invoke a selected MCP tool through the in-process MCP surface
- accept JSON input for tool arguments

### 4.8 `ax session`

`ax session` must:
- create a session with a durable session id and initiator
- list and fetch sessions through shared runtime state
- support join, leave, complete, and fail lifecycle transitions

### 4.9 `ax review`

`ax review` must:
- analyze files or directories with deterministic retained heuristics
- persist review artifacts under `.automatosx/reviews/<trace-id>/`
- emit a shared trace record for each review run
- list prior review traces

## 5. Non-Goals

- full restoration of every `11.4` or `13.5` command
- restoring provider-specific command sprawl as the default v14 UX
- reintroducing monolith bootstrap behavior that bypasses shared runtime or shared stores
- shipping all advanced operational commands in the same retention wave

## 6. Acceptance Criteria

- `setup` creates local workspace state, registers retained agents, and registers the retained baseline policy.
  Verification: `packages/cli/tests/retained-commands.test.ts`
- `init` creates `AX.md`, context templates, and local MCP metadata that matches the real MCP tool list.
  Verification: `packages/cli/tests/retained-commands.test.ts`
- `list` shows workflow inventory and marks flagship workflows as stable.
  Verification: `packages/cli/tests/retained-commands.test.ts`
- `trace` lists and reads back shared-runtime trace records.
  Verification: `packages/cli/tests/retained-commands.test.ts`
- `trace` also supports health analysis and session-correlation lookup.
  Verification: `packages/cli/tests/retained-commands.test.ts`, `packages/cli/tests/cli-dispatch.test.ts`, `packages/shared-runtime/tests/shared-runtime.test.ts`, and `packages/mcp-server/tests/mcp-server.test.ts`
- `discuss` executes through shared runtime and persists traceable discussion output.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts` and `packages/cli/tests/retained-commands.test.ts`
- `agent` lists, reads, and registers agents through the shared runtime state store.
  Verification: `packages/cli/tests/advanced-commands.test.ts`
- `mcp` lists tools and invokes MCP operations through the local MCP surface.
  Verification: `packages/cli/tests/advanced-commands.test.ts`
- `session` creates and transitions sessions through shared runtime state.
  Verification: `packages/cli/tests/advanced-commands.test.ts`, `packages/state-store/tests/state-store.test.ts`, and `packages/mcp-server/tests/mcp-server.test.ts`
- `review` produces durable review artifacts and traceable results from a v14-native analyzer.
  Verification: `packages/cli/tests/review-command.test.ts`
- help output and README must reflect the retained surface accurately.
  Verification: `packages/cli/tests/workflow-commands.test.ts`

## 7. Implementation Notes

- Keep the workflow-first help story. `setup`, `init`, `list`, `trace`, and `discuss` are support commands, not replacements for the five flagship workflows.
- Prefer deterministic local artifacts over implicit machine-global setup.
- Use the existing shared runtime/store path for persistence and discussion traces.
