# Governance Migration Note

## Status

Completed

## Summary

The CLI package now exposes one canonical governance payload:

- field: `governance`
- schema: `RuntimeGovernanceAggregateSchema`
- source contract: `@defai.digital/shared-runtime`

The legacy doctor JSON field `runtimeGovernance` has been removed.

## Affected Surfaces

Canonical governance output is now aligned across:

- `ax governance`
- `ax doctor --format json` -> `data.governance`
- `ax status` -> `data.governance`
- monitor `/api/governance`
- monitor `/api/state.governance`

## Breaking Change

If a downstream consumer previously read:

```json
{
  "data": {
    "runtimeGovernance": { "...": "..." }
  }
}
```

it must now read:

```json
{
  "data": {
    "governance": { "...": "..." }
  }
}
```

## Invariants

- `RuntimeGovernanceAggregateSchema` is the only supported governance payload contract.
- CLI package surfaces should not invent a second governance schema.
- New governance-facing surfaces should be added to parity tests or covered by focused contract tests.

## Verification Gates

The current implementation is protected by:

- `tests/governance-surface-parity.test.ts`
- `tests/governance-alias-audit.test.ts`
- `tests/doctor-command.test.ts`
- process-level doctor JSON tests in `tests/cli-dispatch.test.ts`

## Operator Guidance

For manual inspection:

1. Use `ax governance` for the direct aggregate view.
2. Use `ax doctor --format json` when governance must be consumed alongside broader diagnostics.
3. Use monitor `/api/governance` for dashboard/API access.
