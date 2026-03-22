# v14 Release Dry Run

Date: 2026-03-21
Release Candidate: `14.0.0`

## Release Gates

- `ax ship` and `ax architect` compatibility tests pass
- At least one MCP end-to-end flow passes
- Trace persistence works across CLI and MCP execution paths
- High-risk concurrency and persistence defects are fixed or explicitly waived
- README and onboarding reflect the unified v14 story

## Verification Result

- `npm run typecheck` — passed
- `npm test` — passed
- Test baseline — `11` files, `42` tests
- Workflow compatibility matrix — passed
- Runtime bridge suite — passed
- MCP regression suite — passed
- Dashboard visibility suite — passed
- State-store and trace-store hardening suites — passed

## Current Verification Baseline

- Post-release hardening verification now passes with `15` files and `103` tests.
- Added coverage for retained CLI surface execution, MCP protocol expansion, trace analysis, session-correlated trace lookup, provider-subprocess-backed prompt/discussion execution, first-class config/cleanup commands, stale-trace cleanup through MCP/shared runtime, explicit discussion-fallback warnings, guard policy evaluation, and pragmatic iterate/resume flows.

## Sprint 5 Hardening Result

- Storage-layer writes are serialized per backing file
- Agent registration is idempotent and rejects conflicting duplicates
- Discussion execution applies provider budgets and bounded rounds
- Concurrent discussion workflows keep shared-runtime traces stable
- Shared runtime remains the only promoted orchestration path for CLI and MCP

## Release Decision

v14 release dry run passed.

No open blocker remains in the migration tracker for Sprint 5.
