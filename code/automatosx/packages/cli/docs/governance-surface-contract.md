# Governance Surface Contract

## Status

Current

## Canonical Aggregate

AutomatosX CLI surfaces expose one canonical governance aggregate based on the shared-runtime contract:

- schema: `RuntimeGovernanceAggregateSchema`
- source package: `@defai.digital/shared-runtime`

Canonical shape:

```json
{
  "blockedCount": 0,
  "latest": {
    "traceId": "trace-001",
    "workflowId": "ship",
    "startedAt": "2026-03-25T00:00:00.000Z",
    "summary": "Runtime governance blocked step \"run-skill\".",
    "failedGates": [],
    "failedGateMessages": [],
    "blockedByRuntimeGovernance": true,
    "toolName": "skill.run",
    "trustState": "implicit-local",
    "requiredTrustStates": ["trusted-id"],
    "sourceRef": "skill:deploy-review"
  },
  "deniedImportedSkills": {
    "deniedCount": 0,
    "latest": {
      "skillId": "guarded-import-skill",
      "relativePath": ".automatosx/skills/guarded-import-skill/skill.json",
      "importedAt": "2026-03-25T00:00:00.000Z",
      "summary": "Imported skill \"guarded-import-skill\" is currently denied (denied).",
      "trustState": "denied",
      "approvalMode": "prompt",
      "sourceRef": "fixtures/guarded-import/SKILL.md"
    }
  }
}
```

## Supported Surfaces

The following CLI package surfaces are expected to expose the same canonical aggregate:

- `ax governance`
- `ax doctor --format json` -> `data.governance`
- `ax status` -> `data.governance`
- monitor `/api/governance`
- monitor `/api/state.governance`

## Non-Goals

These surfaces should not invent a second governance schema:

- custom doctor-only governance payloads
- monitor-only governance payloads
- legacy alias fields
- trace-metadata parsing in downstream consumers

## Test Gates

The CLI package keeps this contract stable through:

- `tests/governance-surface-parity.test.ts`
  verifies canonical aggregate parity across governance, doctor, status, and monitor
- `tests/governance-alias-audit.test.ts`
  verifies the removed legacy field name does not reappear
- process-level doctor JSON tests in `tests/cli-dispatch.test.ts`
  verify the main entrypoint returns canonical `data.governance`

## Maintenance Rule

When adding a new governance-facing surface:

1. Reuse `RuntimeGovernanceAggregateSchema`.
2. Reuse existing shared-runtime aggregate builders.
3. Add the new surface to the parity test or add a focused contract test.
