# P0 Week 1 Day 2 – Regression Suite Plan (v1 Feature Preservation)

Quality is not an act, it's a habit. Test early, test often, test everything.

## Suite Structure
- **Tier 0 – Smoke Guard (`@p0-smoke`)**: 12 tests covering multi-provider routing sanity, session resume, memory keyword search, CLI `status`/`run`, workspace CRUD smoke.
- **Tier 1 – Core Feature Preservation (`@p0-regression`)**: 86 tests grouped by the 10 preservation items; balanced mix of unit-focused fast suites and integration/CLI specs.
- **Tier 2 – Extended Confidence (`@p0-deep`)**: 44 longer-running tests (parallel workflow DAGs, multi-hop delegation chaos, synthetic billing reconciliation) executed nightly.
- **Supplemental Suites**: `@telemetry`, `@observability`, `@chaos` tags to validate metrics and chaos scenarios without blocking core regressions.

## Test Prioritization
- **P0**: All tests required for release gating (Tier 0 + Tier 1). Failure blocks deploy.
- **P1**: Tier 2 plus telemetry/observability suites. Failures trigger hotfix follow-up but do not immediately block if mitigated.
- **P2**: Emerging scenarios (mobile clients, experimental commands) tracked separately; run weekly.

## Execution Strategy
- **On Pull Request**: Run Tier 0 and impacted segments of Tier 1 via change-impact analysis (router, memory, CLI modules).
- **Nightly**: Execute full Tier 1 and Tier 2 on dedicated runners; publish dashboards + artifacts.
- **Pre-Release Gate (P0 Exit)**: Three consecutive green runs of Tier 1 (≥95% pass) and Tier 2 (≥92% pass) with flake rate ≤2%.
- **Chaos Windows**: Twice-weekly chaos sessions running `@chaos` tag to stress provider fallback and delegation recovery.

## CI/CD Integration Plan
- Integrate tag filters into GitHub Actions workflow `ci-regression.yml`.
- Enforce traceability check: PRs touching preservation modules must include updated matrix IDs.
- Store CLI transcripts, coverage reports, telemetry snapshots in S3 artifact bucket (`ax-regression-artifacts`) for 14 days.
- Webhook notifications to QA Slack channel on failure with auto-ticket creation (Jira `QA-P0` project).

## Test Data Requirements
- Deterministic provider mocks with latency/error toggles for fallback testing.
- Golden dataset for memory search (keyword/vector/hybrid) stored as snapshot `memory_golden_v1.json`.
- Synthetic billing feed generator producing multi-provider invoices for cost tracking validation.
- Workspace sandbox images (macOS/Linux) with symlink and ACL fixtures.
- Spec workflow fixture library containing sequential, parallel, and failure injection specs.

## Environment Requirements
- Dedicated CI runners with sqlite-vec and MCP stub servers pre-installed.
- Ability to shard `@p0-regression` across 6 parallel workers (Node 18, 8 GB RAM).
- Telemetry sandbox connected to staging observability stack for metric verification.
- Secure secrets management (Vault) for provider credentials with read-only scopes.

## Estimated Execution Time & Resources
- Tier 0: ~6 minutes on single runner.
- Tier 1: ~32 minutes total, 8 minutes wall-clock with 6-way sharding.
- Tier 2: ~45 minutes total, 15 minutes wall-clock with 4-way sharding.
- Chaos suites: 20 minutes duration executed on off-peak runners.

## Tagging Strategy
- `@p0-smoke`, `@p0-regression`, `@p0-deep` for tiering.
- Sub-tags: `@provider-router`, `@delegation`, `@memory`, `@checkpoint`, `@spec`, `@config`, `@mcp`, `@cli-parity`, `@workspace`, `@cost`.
- Meta-tags: `@telemetry`, `@chaos`, `@observability`, `@manual-followup`.
- Enforce tag presence via lint rule in test harness; fail CI if untagged test touches preservation module.

## Resource & Ownership Alignment
- QA Automation (Queenie) maintains suite health, triages flakes, coordinates with feature teams.
- Backend (Bob) owns provider, orchestration, and checkpoint suites.
- Architecture (Avery) oversees telemetry, cost, and state machine integrations.
- Standards (Stan) validates coverage thresholds and code health bots.

## Reporting & Escalation
- Nightly report summarising pass/fail, flake rate, coverage deltas; distributed via Slack + Confluence.
- Escalation triggers align with traceability matrix risk table (fallback success, resume latency, recall variance, CLI flake, cost drift).
- Defects routed through Jira with traceability IDs referencing this plan and matrix rows.
