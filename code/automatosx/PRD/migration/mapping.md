# v14 Migration Mapping: 11.4 -> 13.5

## Purpose
This is the authoritative migration mapping for Sprint 1 and the source for V14-101 and V14-102.

## Legend
- `KEEP`: preserve behavior exactly
- `PORT`: move behavior into a new package boundary
- `REIMPLEMENT`: rebuild behavior with cleaner abstraction
- `RETIRED`: intentionally removed from default product path
- `DEFER`: postpone to post-v14 GA

## Workflow Surface Mapping (v11.4 → v14)

| 11.4 Command | Runtime Source | 11.4 Contract Files | 13.5 Target Package(s) | Decision | Migration Notes |
|---|---|---|---|---|---|
| `ax ship` | workflow registry + artifact writer | `src/cli/commands/workflows.ts`, `src/core/workflow/workflow-command-registry.ts`, `src/core/workflow/workflow-artifacts.ts` | `packages/cli`, `packages/workflow-engine`, `packages/contracts` | PORT | Create workflow command adapter in CLI to call `workflow-engine`; preserve `manifest.json`, `summary.json`, artifact placeholders, and `--dry-run` preview output. |
| `ax architect` | workflow registry + artifact writer | `src/cli/commands/workflows.ts`, `src/core/workflow/workflow-command-registry.ts`, `src/core/workflow/workflow-artifacts.ts`, `src/core/workflow/specs/architect.v0.json` | `packages/cli`, `packages/workflow-engine`, `packages/contracts` | PORT | Keep ADR/proposal structure as explicit artifact type in v14 workflow templates. Migration risk: ADR/proposal output may regress into generic markdown unless artifact shape is asserted. |
| `ax audit` | workflow registry + artifact writer | `src/cli/commands/workflows.ts`, `src/core/workflow/workflow-command-registry.ts`, `src/core/workflow/workflow-artifacts.ts`, `src/core/workflow/specs/audit.v0.json` | `packages/cli`, `packages/workflow-engine`, `packages/contracts` | PORT | Preserve severity/risk ordering outputs and severity sections. Migration risk: findings may be emitted without stable severity ordering unless compatibility checks assert ranking behavior. |
| `ax qa` | workflow registry + artifact writer | `src/cli/commands/workflows.ts`, `src/core/workflow/workflow-command-registry.ts`, `src/core/workflow/workflow-artifacts.ts`, `src/core/workflow/specs/qa.v0.json` | `packages/cli`, `packages/workflow-engine`, `packages/contracts` | PORT | Add quality/defect evidence output contract to workflow template artifact set. Migration risk: evidence references may be lost if artifact contract is reduced to generic summaries only. |
| `ax release` | workflow registry + artifact writer | `src/cli/commands/workflows.ts`, `src/core/workflow/workflow-command-registry.ts`, `src/core/workflow/workflow-artifacts.ts`, `src/core/workflow/specs/release.v0.json` | `packages/cli`, `packages/workflow-engine`, `packages/contracts` | PORT | Preserve changelog/release notes/deployment checklist artifact names to avoid downstream tool drift. Migration risk: release notes may drift semantically if artifact names remain stable but content contract is not enforced. |

## Command-to-Artifact Contract (11.4 Baseline)

| Command | Options | Required Outputs | Stages Source |
|---|---|---|---|
| `ship` | `--provider`, `--dry-run`, `--output-dir`, `--verbose`, `--quiet`, `scope`, `issue`, `policy`, `branch` | `review summary`, `test summary or test plan`, `risk notes`, `PR draft summary` | `src/core/workflow/specs/ship.v0.json` |
| `architect` | `--provider`, `--dry-run`, `--output-dir`, `--verbose`, `--quiet`, `request`, `input`, `timeline`, `constraints` | `architecture proposal`, `ADR draft`, `phased implementation plan`, `risk matrix` | `src/core/workflow/specs/architect.v0.json` |
| `audit` | `--provider`, `--dry-run`, `--output-dir`, `--verbose`, `--quiet`, `scope`, `repo`, `depth` | `audit report`, `severity ranking`, `bottleneck list`, `remediation plan` | `src/core/workflow/specs/audit.v0.json` |
| `qa` | `--provider`, `--dry-run`, `--output-dir`, `--verbose`, `--quiet`, `target`, `url`, `scenario` | `pass/fail report`, `scenario summary`, `defect summary`, `reproduction steps` | `src/core/workflow/specs/qa.v0.json` |
| `release` | `--provider`, `--dry-run`, `--output-dir`, `--verbose`, `--quiet`, `releaseVersion`, `commits`, `target` | `changelog draft`, `release notes`, `upgrade notes`, `deployment checklist` | `src/core/workflow/specs/release.v0.json` |

## 11.4 MCP/Integration Mapping

| 11.4 Area | 11.4 Source | 13.5 Target | Decision | Notes |
|---|---|---|---|---|
| MCP tool set | `src/mcp/*` | `packages/mcp-server` | KEEP | Keep MCP tool interfaces and naming stable unless contract mismatch is found. |
| Agent registries | `src/agents/*` + config + storage | `packages/agent-domain`, `packages/session-domain`, `packages/sqlite-adapter` | PORT | Resolve duplicate registry behavior before surfacing v14 workflow commands. |
| Memory/session tracing | `src/shared`, `src/core/memory`, `src/core/trace` (11.4 inline equivalents) | `packages/memory-domain`, `packages/trace-domain`, `packages/cross-cutting`, `packages/sqlite-adapter` | PORT | v14 migration requires shared runtime for CLI + MCP to satisfy adapter invariants. |

## 13.5 Modular Capabilities to Preserve

| Capability | Source | Decision | Notes |
|---|---|---|---|
| Domain isolation | `packages/core/*` | KEEP | Use this as the hard boundary for v14 ownership and dependency flow. |
| MCP orchestration | `packages/mcp-server` | KEEP | Preserve MCP API/tool contracts and registration behavior. |
| Guard policy engine | `packages/guard` | PORT | Integrate into all workflow command execution paths. |
| Shared adapters/store | `packages/adapters/*` + `packages/core/*` | KEEP/PORT | Single storage and provider abstraction path for both CLI and MCP. |

## Sprint 1 Exit-Gate Decisions
The required Sprint 1 exit-gate decisions are resolved in [sprint-1-exit-decisions.md](./sprint-1-exit-decisions.md).

### Resolution Summary
1. Workflow template format
   - Resolved: adopt `13.5` workflow definition shape as canonical runtime format.
2. Command surface
   - Resolved: `ship`, `architect`, `audit`, `qa`, and `release` remain first-class commands.
3. Artifact location
   - Resolved: default path is `.automatosx/workflows/<command>/<trace-id>/`.
4. Telemetry fallback
   - Resolved: `traceId` plus artifact state is the mandatory fallback baseline; no legacy CLI-local telemetry restoration.

## Ownership
- Product/Requirements: PM
- Architecture: Platform Team
- Workflow Execution: CLI + Workflow Engine Team
- Storage/Tracing: Core Platform Team
- MCP: MCP Team
