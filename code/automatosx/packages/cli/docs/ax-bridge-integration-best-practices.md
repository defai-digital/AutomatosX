# AX-BRIDGE Integration Best Practices

## Purpose

This note captures the recommended integration approach for `ax-bridge` and `ax-skill` inside AutomatosX.

The goal is to keep implementation speed high in the CLI package today without letting the long-term architecture collapse into a CLI-only design.

## Current Baseline

The current local prototype already proves the right split:

- `ax bridge` owns bridge discovery, validation, and local execution.
- `ax skill` owns skill import/export/discovery and can resolve a `dispatch: bridge` skill to a linked bridge.
- canonical local assets live under:
  - `.automatosx/bridges/`
  - `.automatosx/skills/`

Current implementation entry points:

- CLI manifest and command metadata are centralized in `src/command-manifest.ts` and `src/command-metadata.ts`.
- shared-runtime now owns the core bridge and skill service layer in `../shared-runtime/src/bridge-runtime-service.ts`.
- bridge runtime execution is isolated behind a thin CLI adapter in `src/bridge-runtime.ts`.
- bridge registry logic is isolated behind a thin CLI adapter in `src/bridge-registry.ts`.
- skill registry logic is isolated behind a thin CLI adapter in `src/skill-registry.ts`.

This is the correct short-term shape for fast delivery.

## Existing AutomatosX Seams

The current repository already has the right extension points for a maintainable integration:

- CLI command registration is centralized through metadata and manifest dispatch.
- shared runtime state is already exposed through service boundaries in `../shared-runtime/src/runtime-state-service.ts`.
- MCP tool exposure is centralized in `../mcp-server/src/runtime-state-tool-service.ts`.
- workflow delegation already has bounded semantics in `../workflow-engine/src/step-executor-factory.ts`.
- workspace-scoped config is already cached in `../shared-runtime/src/workspace-config-cache.ts`.

The best practice is to reuse these seams instead of inventing a parallel subsystem.

## Architecture Rules

### 1. Keep CLI Thin

The CLI package should own:

- authoring UX
- local filesystem discovery
- developer-facing commands
- local execution prototype logic

The CLI package should not become the permanent home for:

- registry trust policy
- trace persistence
- guard evaluation
- workflow dispatch orchestration
- external interoperability policy

### 2. Keep `BridgeSpec` Canonical

`BridgeSpec` is the source of truth for execution behavior.

Use:

- `bridge.json` / canonical bridge definitions for execution
- `skill.json` / canonical skill definitions for invocation metadata
- `SKILL.md` only as an interchange and human-facing artifact

Do not let community `SKILL.md` files become the runtime source of truth.

### 3. Keep `Skill` as Invocation, Not Runtime

Use `Skill` for:

- discovery
- invocation metadata
- user/model visibility
- dispatch routing
- compatibility with OpenClaw-style ecosystems

Use `Bridge` for:

- execution
- install/run lifecycle
- approval and trust
- tracing and guard integration

### 4. Keep External Interop at the Edge

External skill ecosystems should be handled by import/export adapters.

Do:

- import external `SKILL.md`
- normalize into canonical `skill.json`
- resolve `dispatch: bridge` to a local bridge

Do not:

- execute community skill text directly as privileged runtime logic
- bind the core model to OpenClaw or CLI-Anything metadata quirks
- make marketplace support a prerequisite for the local runtime

### 5. Reuse Existing Runtime Boundaries

When moving beyond the CLI prototype:

- move `BridgeSpec` / `SkillSpec` contracts into `shared-runtime`
- introduce a dedicated bridge runtime service in `shared-runtime`
- expose bridge operations through a dedicated MCP service module
- map `dispatch: delegate` to workflow-engine delegation semantics
- store trust and registry config in `.automatosx/config.json`

Do not expand the existing MCP switch or CLI handlers into giant multi-purpose files.

### 6. Separate Execution from Compilation

Treat these as distinct layers:

- registry and canonical definition storage
- execution runtime
- skill import/export
- source-to-bridge compiler

The compiler must stay last.

Do not block runtime adoption on source analysis or auto-generation quality.

### 7. Prefer Incremental Capability Growth

Supported first:

- local bridge definitions
- local skill definitions
- script and command entrypoints
- linked skill-to-bridge dispatch

Supported later:

- install workflows
- policy and trust integration
- MCP exposure
- workflow-native bridge steps
- compiler and remote registry adapters

This keeps early iterations small and testable.

### 8. Keep Layout Conventions Centralized

Filesystem layout rules should live in one small module.

Current examples:

- `src/bridge-layout.ts`
- `src/bridge-registry.ts`
- `src/skill-registry.ts`

Path conventions should not be duplicated across commands, tests, and services.

### 9. Test the Contract, Not Only the Parsing

Minimum test layers:

- schema validation tests
- import/export round-trip tests
- local execution tests
- failure-path tests for non-zero exit and unsupported dispatch

Later, add:

- shared-runtime service tests
- MCP integration tests
- workflow step integration tests

## Recommended Phased Plan

### Phase 0: CLI Local Prototype

Status: in progress

Scope:

- `ax bridge list|inspect|validate|run`
- `ax skill list|import|export|inspect|run|validate|resolve`
- local filesystem layout
- linked `skill -> bridge|agent` execution

### Phase 1: Extract Stable Contracts

Status: completed

Move to `shared-runtime` once semantics stop changing:

- `BridgeSpec`
- `SkillSpec`
- canonical layout constants
- registry load/validation helpers

Rule:

- do not move unstable parser details too early

### Phase 2: Runtime Service

Status: completed

Initial implementation now exists in `../shared-runtime/src/bridge-runtime-service.ts`, with CLI commands calling it through thin wrapper modules.

Skill dispatch now also lives in `../shared-runtime/src/runtime-skill-service.ts`, so CLI/MCP no longer own bridge-vs-delegate branching.

Add a dedicated bridge service in `shared-runtime` for:

- discovery
- validation
- execution
- approval lookup
- future trace hooks

Rule:

- keep command handlers as thin adapters over the service

### Phase 3: MCP Surface

Status: completed

Initial MCP bridge integration now exists as a dedicated service module in `../mcp-server/src/runtime-bridge-tool-service.ts`, with separate tool definitions for bridge and skill discovery/execution.

Add a dedicated MCP bridge tool service instead of bloating the current monolithic switch.

Likely tools:

- `bridge_list`
- `bridge_inspect`
- `bridge_run`
- `skill_list`
- `skill_resolve`
- `skill_run`

### Phase 4: Workflow Integration

Status: completed

Shared runtime skill execution now maps:

- `bridge` -> bridge runtime execution
- `delegate` -> shared runtime agent orchestration with trace linkage
- `prompt` -> guidance-only failure path

Workflow-driven execution now reuses the same shared-runtime semantics instead of reimplementing dispatch inside workflow steps. Current canonical tool-step mappings are:

- `skill.run` -> `runSkill()` in `../shared-runtime/src/runtime-skill-service.ts`
- `bridge.run` -> bridge resolution + execution in `../shared-runtime/src/bridge-runtime-service.ts`
- `bridge.install` -> canonical local install + provenance writeback in `../shared-runtime/src/bridge-runtime-service.ts`

Bridge the skill dispatch model into workflow semantics:

- `prompt` stays prompt-oriented
- `bridge` calls the bridge runtime
- `delegate` maps onto workflow delegation

Rule:

- do not create a separate skill runtime engine

### Phase 5: Install and Trust

Status: started

Current implementation now enforces workspace trust from `.automatosx/config.json` for:

- bridge ids that require explicit approval
- skill ids that require explicit approval
- remote source refs carried in `source` or `provenance`
- local bridge bundle / `bridge.json` installation with canonical provenance written on install
- workflow tool steps that consume canonical trust/provenance metadata through the built-in `runtime-governance` after-guard

Workflow-native governance currently reuses shared-runtime outputs instead of recomputing policy state:

- `skill.run` tool output carries `skillTrust` and `skillProvenance`
- `bridge.run` tool output carries `execution.trust`
- `bridge.install` tool output carries installed bridge provenance
- workflow authors can set `requiredTrustStates` on canonical tool steps when explicit trust levels are required
- CLI `ax run` and MCP `workflow_run` now surface a guard summary directly when `runtime-governance` blocks a step
- workflow dispatch `manifest.json` / `summary.json` now persist the same guard summary on failed runs
- workflow artifact markdown now includes the same guard summary and error context on failed dispatches
- monitor activity rows and trace detail views now surface the persisted runtime-governance summary
- monitor overview now aggregates recent runtime-governance blocks into a dedicated operator-facing section
- `ax status` and `ax history` now reuse the same persisted guard summary instead of inventing a second failure format
- `ax trace <trace-id>` and `ax trace analyze <trace-id>` now reuse the same persisted guard summary and expose it as a canonical trace-analysis signal
- `ax doctor` now treats recent runtime-governance blocks as a first-class health signal instead of hiding them behind raw trace inspection
- `ax doctor` data payload and `/api/state` now carry a structured runtime-governance aggregate so external consumers do not need to parse raw trace metadata
- `ax doctor --format json` now exposes canonical `data.governance` only
- the CLI package governance contract is documented in `docs/governance-surface-contract.md`
- the alias-removal outcome is summarized in `docs/governance-migration-note.md`
- repo-level follow-up wording is staged in `docs/governance-upstream-sync-note.md`

Current config shape:

```json
{
  "axBridge": {
    "trust": {
      "trustedBridgeIds": ["internal-release-bridge"],
      "trustedSkillIds": ["ops-review"],
      "trustedSourcePrefixes": ["https://github.com/example/"],
      "approvedPolicyIds": ["security-review"],
      "allowRemoteSources": false
    }
  }
}
```

Add:

- approval policy integration
- richer remote-source provenance and approval flows

Store configuration in `.automatosx/config.json`, not ad hoc local files.

### Phase 6: Compiler

Only after execution and governance are stable:

- scaffold bridge definitions from existing CLI, script, or OpenAPI
- add richer source analysis later

## Anti-Patterns To Avoid

- putting runtime policy logic in CLI handlers
- treating `SKILL.md` as the canonical runtime model
- binding core design to CLI-Hub or other unproven registries
- mixing compiler logic into execution modules
- growing a new all-in-one `bridge-service.ts` that does registry, execution, parsing, trust, and MCP glue at once
- implementing `delegate` in a CLI-only way instead of reusing workflow-engine semantics

## Near-Term Next Steps

Recommended order:

1. Keep OpenClaw skill import/export compatibility narrow and testable.
2. Add richer provenance and approval flows before any remote install support.
3. Reuse the same guard summary in more exported/reporting surfaces before inventing any new failure taxonomy.
4. Keep exported governance payloads aligned on `data.governance` only and update the governance contract note when new surfaces are added.
4. Only then start compiler work.

This preserves momentum without locking AutomatosX into a hobby-grade integration shape.
