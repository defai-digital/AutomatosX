# Sprint 4 PRD — Plugin SDK Beta & Marketplace Foundation (Weeks 7–8)

## 1. Sprint Overview
- **Mission**: Deliver Plugin SDK Beta and establish the marketplace foundation so AutomatosX reaches GA-ready extensibility.
- **Scope**: Mature the SDK (dependencies, versioning, permissions, persistence), build the marketplace infrastructure (registry, discovery, publishing, installation, updates), and finish the final 307 tests to hit 2,423 total.
- **Outcome Definition**:
  - Plugin SDK Beta provides production-ready APIs, persistence, and inter-plugin communication with enforced permissions.
  - Marketplace discovery, publishing, installation, and update flows operate via CLI + backend registry with auditability.
  - CI reports 2,423 passing tests (95%+ coverage on plugin + marketplace modules) and four operational plugins (two internal, two community exemplars).

## 2. Technical Deep-Dive
### 2.1 Plugin SDK Beta Features
- **Dependency management**: Directed acyclic graph (DAG) resolver handles transitive dependencies, circular detection, and lockfile generation for deterministic installs.
- **Semantic versioning**: Enforce semver ranges in manifests, calculate compatibility against AutomatosX runtime versions, and expose resolver hints in CLI diagnostics.
- **Permissions model**: Capability grants expressed in manifest scopes (workspace IO, memory access, command execution) with runtime enforcement + audit logs.
- **State persistence & configuration**: Provide storage API (namespaced KV + secrets envelope) and configuration loader so plugins can store durable state between runs while respecting WorkspaceManager contracts.

### 2.2 Plugin Marketplace Architecture
- **Registry schema**: Postgres-backed registry with tables for plugins, versions, maintainers, capability tags, and verification status; exposes signed manifests and integrity hashes.
- **Discovery API**: REST surface (`/plugins`, `/plugins/{id}`, `/search`) supporting filters (category, capability, compatibility) and pagination for CLI + docs site.
- **Publishing workflow**: `ax plugin publish` packages plugin, runs validation suite, uploads artifact, records provenance, and supports staged releases (draft, beta, GA).
- **Installation & updates**: `ax plugin install <pkg>` pulls from registry, resolves dependencies, writes lockfile, and registers plugin; update mechanism evaluates compatibility, fetches changelog, and supports rollbacks.

### 2.3 Plugin Inter-Communication
- **Event bus**: Namespaced event topics (`plugin.<name>.<event>`) enabling publish/subscribe with QoS guarantees and backpressure.
- **Shared services**: Provide request/reply channel for shared services (telemetry, data fetchers) with per-plugin throttles.
- **Data exchange**: Typed message contracts enforced via schema registry so plugins can safely exchange data without leaking workspace secrets; includes message TTL + tracing IDs for debugging.

### 2.4 Security & Sandboxing
- **Permission boundaries**: Runtime enforces least-privilege by binding capability tokens to each plugin process; attempts outside scope raise structured errors.
- **Resource limits**: CPU, memory, and IO quotas enforced via runtime governors; plugins exceeding budgets are throttled or terminated with diagnostic events.
- **Isolation guarantees**: Sandbox ensures filesystem isolation, prohibits network access unless explicitly granted, and uses signature verification before executing plugin bundles; marketplace flags verified publishers.

## 3. Work Breakdown Structure
### Item 1. Dependency Graph Resolver
- **Description**: Implement DAG-based dependency resolution with cycle detection, lockfile output, and deterministic ordering for plugin installs.
- **Acceptance Criteria**:
  - [ ] Resolver handles nested dependencies and reports conflicts with actionable CLI errors.
  - [ ] Lockfile format documented and stored alongside manifests.
  - [ ] 40 automated tests cover success + conflict scenarios.
- **Estimate**: 32h
- **Dependencies**: Sprint 3 manifest schema, runtime loader.
- **Risks**: Edge-case cycles or optional deps could stall installs; mitigate with resolver fallback heuristics.

### Item 2. Semantic Versioning & Compatibility Matrix
- **Description**: Enforce manifest semver fields, runtime compatibility ranges, and CLI diagnostics showing compatible AutomatosX releases.
- **Acceptance Criteria**:
  - [ ] CLI blocks installs outside declared compatibility range with remediation guidance.
  - [ ] Registry stores compatibility metadata per version.
  - [ ] 30 tests cover semver edge cases (`^`, `~`, prerelease).
- **Estimate**: 20h
- **Dependencies**: Item 1, manifest schema finalization.
- **Risks**: Misinterpreted semver operators could allow incompatible plugins; add contract tests.

### Item 3. Permission & Capability Enforcement
- **Description**: Implement manifest-declared capability scopes with runtime enforcement, audit logging, and CLI inspection (`ax plugin inspect <name>`).
- **Acceptance Criteria**:
  - [ ] Permissions enforced in runtime; unauthorized calls rejected with structured errors.
  - [ ] Audit log captures capability grants and denies per plugin execution.
  - [ ] 45 tests covering positive, negative, and escalation cases.
- **Estimate**: 36h
- **Dependencies**: Runtime sandbox, Items 1–2.
- **Risks**: Overly strict defaults could block legitimate plugins; need PM review of baseline grants.

### Item 4. State Persistence & Configuration Service
- **Description**: Provide namespaces for plugin storage (KV + secrets) and configuration API with migration hooks.
- **Acceptance Criteria**:
  - [ ] Storage API exposes transactional reads/writes with quota enforcement.
  - [ ] Configuration loader reads versioned settings and supports overrides per environment.
  - [ ] 35 tests cover persistence durability, quota failures, and migration scripts.
- **Estimate**: 28h
- **Dependencies**: WorkspaceManager interfaces, Item 3.
- **Risks**: Data corruption risks; add checksum + backup restore path.

### Item 5. Plugin Inter-Communication APIs
- **Description**: Ship event bus + shared services interface enabling controlled plugin-to-plugin messaging.
- **Acceptance Criteria**:
  - [ ] Event bus supports publish/subscribe with filtering and backpressure.
  - [ ] Shared services registry exposes typed endpoints with per-plugin throttles.
  - [ ] 30 tests validate message routing, throttling, and isolation.
- **Estimate**: 24h
- **Dependencies**: Runtime messaging fabric, Items 3–4.
- **Risks**: Deadlocks or message storms; require circuit breakers.

### Item 6. Marketplace Registry Schema & Storage
- **Description**: Design and implement registry DB schema, storage lifecycle, and integrity checks for uploaded artifacts.
- **Acceptance Criteria**:
  - [ ] Schema migrated with tables for plugins, versions, maintainers, tags, and verification status.
  - [ ] Artifacts stored with SHA-256 signatures and provenance metadata.
  - [ ] 35 tests validate migrations, constraints, and integrity workflows.
- **Estimate**: 30h
- **Dependencies**: DevOps provisioning decision (hosted vs self-hosted).
- **Risks**: Schema churn could block publishing; lock schema before Day 32.

### Item 7. Discovery & Search API
- **Description**: Build REST API + CLI integration for listing, filtering, and searching registry entries.
- **Acceptance Criteria**:
  - [ ] `/plugins` and `/search` endpoints deployed with filters (capabilities, compatibility, maintainer).
  - [ ] CLI surfaces search results with sorting, tags, and verification badges.
  - [ ] 30 tests cover API contracts, pagination, and caching.
- **Estimate**: 24h
- **Dependencies**: Item 6, CDN/cache plan.
- **Risks**: Latency spikes; add caching + rate limits early.

### Item 8. Publishing Workflow & CLI (`ax plugin publish`)
- **Description**: Implement CLI command + backend validation pipeline for publishing plugins with staged release support.
- **Acceptance Criteria**:
  - [ ] CLI packages plugin, runs validation tests, signs artifact, and uploads to registry.
  - [ ] Backend enforces review states (draft, beta, GA) with approvals.
  - [ ] 32 tests cover CLI UX, validation failures, and staged promotions.
- **Estimate**: 28h
- **Dependencies**: Items 6–7, Quality harness.
- **Risks**: Large artifact uploads may fail; include resumable uploads + checksum verification.

### Item 9. Installation & Update Mechanisms
- **Description**: Deliver `ax plugin install`, `ax plugin update`, and rollback workflow wired to resolver + lockfile.
- **Acceptance Criteria**:
  - [ ] Installation resolves dependencies, writes lockfile, and registers plugin in runtime.
  - [ ] Update flow surfaces changelog, compatibility warnings, and supports rollback to prior version.
  - [ ] 40 tests cover install/uninstall, conflict resolution, and rollback safety.
- **Estimate**: 32h
- **Dependencies**: Items 1–2, 6–8.
- **Risks**: Partial installs could corrupt runtime; add transactional install steps.

### Item 10. Security Hardening & Sandboxing
- **Description**: Extend sandbox to enforce resource limits, signature verification, and permission boundaries for marketplace-delivered plugins.
- **Acceptance Criteria**:
  - [ ] Plugins validated against signature + checksum before execution.
  - [ ] Runtime enforces CPU/memory quotas with observable throttling events.
  - [ ] 30 tests simulate malicious behaviors (permission escalation, resource abuse).
- **Estimate**: 24h
- **Dependencies**: Items 3, 6, 8.
- **Risks**: False positives could block legitimate plugins; include allowlist override with PM approval.

### Item 11. Documentation & Developer Experience
- **Description**: Publish Plugin SDK Beta guide, marketplace onboarding, CLI reference, and sample plugins (two internal, two community-style).
- **Acceptance Criteria**:
  - [ ] AX-GUIDE gains Plugin SDK Beta chapter + marketplace walkthrough.
  - [ ] Sample plugins updated to showcase dependencies, permissions, and persistence.
  - [ ] Release notes enumerate beta scope, known gaps, and upgrade steps.
- **Estimate**: 20h
- **Dependencies**: Items 1–10.
- **Risks**: Doc lag can block plugin authors; enforce doc review as exit criteria.

### Item 12. Test Suite Completion & QA Instrumentation
- **Description**: Author the remaining 307 automated tests, wire coverage dashboards, and ensure CI gates for SDK + marketplace modules.
- **Acceptance Criteria**:
  - [ ] 307 new tests merged (150 SDK Beta, 157 marketplace) with flake triage plan.
  - [ ] Coverage ≥95% on plugin SDK + marketplace codepaths.
  - [ ] Dashboards updated showing 2,423 passing tests across macOS/Linux.
- **Estimate**: 28h
- **Dependencies**: Items 1–11 for scenarios, Quality squad capacity.
- **Risks**: Flaky tests threaten gate; pre-merge soak on nightly runners.

## 4. Testing Strategy
- **Total additions**: +307 tests (2,116 → 2,423).
- **Plugin SDK Beta (150 tests)**:
  - 40 dependency resolver permutations (diamond graphs, optional deps, cycle detection).
  - 35 semver + compatibility enforcement tests.
  - 40 permission + sandbox enforcement scenarios (positive/negative, audit log validation).
  - 35 state persistence & configuration durability tests (quota enforcement, migrations, corruption recovery).
- **Marketplace Foundation (157 tests)**:
  - 30 registry schema + integrity contract tests.
  - 32 discovery/search API tests (filters, pagination, caching).
  - 35 publishing workflow tests (CLI UX, staged releases, validation errors).
  - 30 installation/uninstallation + cross-platform smoke tests.
  - 30 update + rollback tests covering changelog surfacing and version pinning.
- **End-to-End lifecycle**: Full-stack suites run `ax plugin publish → install → enable → update → rollback` for both internal and community example plugins, exercising resolver, permissions, and marketplace APIs.
- **Security & permission tests**: Property-based tests randomize capability grants, sandbox resource budgets, and message exchanges between plugins to validate isolation invariants.

## 5. Quality Gates
- **Week 7 Gate (Day 35)**:
  - 2,266 tests passing (150 new SDK tests).
  - Dependency resolution, semver compatibility, permissions, state persistence, and inter-communication APIs feature-complete.
  - Plugin SDK Beta documentation draft reviewed; runtime isolation metrics green.
- **Week 8 Gate (Day 40)**:
  - 2,423 tests passing (157 marketplace tests) with coverage ≥95% on plugin modules.
  - Marketplace registry, discovery, publishing, installation, and update flows operational end-to-end.
  - GA-ready sign-off with demo showing four operational plugins and marketplace install/update lifecycle.

## 6. Dependencies & Blockers
- **Sprint 3 completion**: 2,116 tests already passing with Plugin SDK Alpha (manifest, lifecycle hooks, two internal plugins) must remain green to start Beta upgrades.
- **Plugin manifest schema**: Needs final approval (fields for dependencies, permissions, semver) before Day 31 to avoid refactoring downstream work.
- **Registry infrastructure decision**: Choose hosted vs. self-hosted deployment (and credential model) before kicking off Items 6–8; delay blocks publishing pipeline.

## 7. Success Metrics
- **Testing**: 2,423 total tests passing with ≥95% coverage on plugin SDK and marketplace modules.
- **Ecosystem**: Minimum four operational plugins (two internal, two community-style references) demonstrating dependency + marketplace flows.
- **Performance & reliability**: Resolver installs in <3 s for median plugin, marketplace API P95 <250 ms, zero critical sandbox escapes.
- **Documentation**: Plugin developer guide, marketplace operations guide, and API reference published with beta tags and code samples.

## 8. Team Structure & Ownership
- **CLI/TypeScript Squad (3 engineers)**: Own Items 1, 2, 8, 9, and CLI touchpoints for discovery + docs snippets.
- **Quality Squad (3 engineers)**: Lead Item 12, co-own testing strategy, security fuzzing, and gate reporting.
- **Runtime Squad (3 engineers)**: Deliver Items 3–5, collaborate on sandbox enforcement, and ensure event bus reliability.
- **DevOps Squad (2 engineers)**: Handle Items 6–7 + registry ops, CI coverage enforcement, artifact signing.
- **Product Manager (1 person)**: Align requirements, prioritize backlog, manage marketplace strategy, and own Definition of Done checklist + stakeholder demos.
- Collaboration cadences: Daily standups, mid-sprint SDK Beta review (Day 34), marketplace architecture review (Day 37), and Day 40 demo rehearsal.

## 9. Risk Management
- **Dependency resolution complexity**: Circular or conflicting versions could block installs; mitigate with early resolver fuzz tests and clear CLI remediation.
- **Marketplace scalability**: High query volumes might degrade discovery; introduce caching, rate limits, and staged rollout before GA.
- **Security model completeness**: Any permission gap undermines trust; perform threat modeling review and red-team tests before Week 8 gate.
- **Community plugin quality**: Low-quality submissions could erode confidence; add verification badges, automated linting, and manual review policy.

## 10. Definition of Done
- All 12 work items reviewed, merged, and documented.
- 2,423 tests passing with ≥95% coverage for plugin SDK + marketplace codepaths.
- Plugin SDK Beta shipped with dependency management, semver, permissions, persistence, and inter-plugin communication.
- Marketplace operational with registry, discovery, publishing, installation, and update workflows accessible via CLI.
- Four plugins (two internal, two community-style examples) running end-to-end through marketplace flows.
- Plugin developer guide, marketplace guide, and API reference published and linked within AX-GUIDE.
- Sprint 4 demo delivered with stakeholder approval showcasing SDK Beta + marketplace outcomes.
- GA-ready status granted, enabling transition to subsequent release activities.
