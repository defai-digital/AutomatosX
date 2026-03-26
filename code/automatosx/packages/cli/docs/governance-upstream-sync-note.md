# Governance Upstream Sync Note

## Purpose

This note captures the repo-level PRD / ADR deltas implied by the completed governance convergence work inside `packages/cli`.

It is meant to be copied into upstream product / architecture documents outside this package.

## Completed Outcome

The CLI package now treats governance as a canonical, cross-surface contract instead of a doctor-local or monitor-local payload.

Canonical field and schema:

- field: `governance`
- schema: `RuntimeGovernanceAggregateSchema`
- source package: `@defai.digital/shared-runtime`

Legacy field removed:

- `runtimeGovernance`

## Upstream PRD Deltas

Product-facing governance wording should now say:

- `ax governance` is the direct operator surface for governance state
- `ax doctor --format json` exposes governance under `data.governance`
- `ax status` exposes governance under `data.governance`
- monitor exposes governance under `/api/governance` and `/api/state.governance`
- governance payloads reuse shared-runtime aggregate builders and do not define product-specific variants

PRD text should not say:

- doctor exposes `runtimeGovernance`
- monitor or status use separate governance payloads
- downstream consumers are expected to parse raw trace metadata for governance summaries

## Upstream ADR Deltas

Architecture wording should now say:

- governance aggregation is a shared-runtime contract, not a CLI-local shape
- exported governance surfaces must reuse `RuntimeGovernanceAggregateSchema`
- CLI, monitor, and MCP governance surfaces must stay schema-aligned
- legacy alias fields are not part of the steady-state architecture

Recommended ADR decision statement:

`Runtime governance surfaces standardize on the shared-runtime aggregate contract and expose it through the canonical field name "governance".`

## Evidence From This Package

Implementation surfaces:

- `src/commands/governance.ts`
- `src/commands/doctor.ts`
- `src/commands/status.ts`
- `src/commands/monitor.ts`
- `src/commands/monitor-state.ts`

Contract / docs:

- `docs/governance-surface-contract.md`
- `docs/governance-migration-note.md`
- `docs/ax-bridge-integration-best-practices.md`

Verification gates:

- `tests/governance-surface-parity.test.ts`
- `tests/governance-alias-audit.test.ts`
- `tests/doctor-command.test.ts`
- process-level doctor JSON tests in `tests/cli-dispatch.test.ts`

## Suggested Upstream Wording

Short version:

`Governance is now a canonical shared-runtime aggregate exposed consistently as "governance" across CLI, doctor JSON, status JSON, monitor APIs, and MCP-derived consumers.`

Longer version:

`AutomatosX runtime governance is surfaced through a single aggregate contract defined in shared-runtime. CLI and operator-facing surfaces must expose this aggregate through the canonical field name "governance" and should not introduce alias fields or surface-specific governance schemas.`
