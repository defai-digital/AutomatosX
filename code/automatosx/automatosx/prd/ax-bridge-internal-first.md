# PRD: AX-BRIDGE Core and AX-SKILL Companion Surface for AutomatosX
**Status:** Proposed
**Date:** 2026-03-25
**Scope:** Internal bridge generation, bridge runtime integration, skill interoperability, artifact generation, registry strategy, and clean-room implementation constraints

---

## Problem Statement

The current framing around Skills and CLI-Anything is directionally useful but product-strategically incomplete for AutomatosX.

It over-weights external ecosystem integration and under-weights the actual value AutomatosX can own:

- turning internal codebases, services, scripts, and tools into agent-native capabilities
- governing those capabilities through trace, guard, policy, and delegation
- distributing those capabilities through internal channels that enterprises already trust

Most AutomatosX users are more likely to bridge internal systems than to install community CLIs from a public hub. That changes the product center of gravity:

- `ax-bridge` must be the primary product and runtime surface
- `ax-skill` must be the companion surface for invocation, guidance, discovery, and interoperability
- `BridgeSpec` must be the single source of truth
- bridge runtime packages or runtime entrypoints must be the primary derived outputs
- generated `SKILL.md` files must be companion outputs, not parallel sources of truth
- the internal registry must be the primary distribution channel
- OpenClaw community skills should be the initial external interoperability target
- CLI-Hub and unproven external bridge catalogs should not shape the v1 architecture
- implementation must be clean-room: use ideas and concepts only, not copied source code

This PRD supersedes the earlier marketplace-first draft in `automatosx/todo/PRD-skills-clianything-integration.md`.

---

## Goals

1. Make `ax bridge` a first-class AutomatosX surface for converting internal systems into agent-native bridges
2. Make `ax skill` a first-class companion surface for invocation, guidance, discovery, and interoperability
3. Establish `BridgeSpec` as the canonical execution and governance unit inside AutomatosX
4. Generate bridge runtime outputs and companion `SKILL.md` artifacts from bridge-owned metadata where appropriate
5. Make internal registries the default way to publish, review, install, and reuse bridges
6. Support selective interoperability with external skill ecosystems, starting with OpenClaw community skills
7. Implement the system as a clean-room rewrite that is better integrated, easier to maintain, and faster to evolve than the reference systems

---

## Non-Goals

- No standalone `AX-BRIDGE` project outside AutomatosX
- No standalone `AX-SKILL` project outside AutomatosX
- No marketplace-first architecture optimized around public community packages
- No direct port or translation of CLI-Anything source code into TypeScript
- No CLI-Hub dependency or CLI-Hub compatibility commitment in v1
- No promise that v1 can reliably generate bridges from arbitrary source trees or arbitrary GUI software
- No rewrite of shared-runtime, workflow-engine, or MCP core contracts

---

## Product Principles

### P-01: Bridge Is Core

The thing AutomatosX executes, traces, governs, and installs is a bridge, not a skill.

### P-02: AX-SKILL Is a Companion Surface

`ax-skill` and `SKILL.md` are useful for invocation, guidance, discovery, compatibility, and prompt packaging, but they are not the canonical runtime contract.

### P-03: BridgeSpec Is the Single Source of Truth

Generated bridge runtime entrypoints, generated `SKILL.md`, registry entries, and runtime execution metadata must all derive from `BridgeSpec` and linked companion metadata instead of maintaining separate behavior definitions.

### P-04: Load Skill Content on Demand

AutomatosX should not inject the full contents of every available skill into the base runtime context. It should expose compact skill metadata for discovery and load full skill content only when selected or required.

### P-05: Internal-First Distribution

Workspace-local and organization-managed registries come before public registries.

### P-06: Governance Before Convenience

Every installed bridge must be compatible with AutomatosX traceability, guard checks, and policy controls.

### P-07: Clean-Room Implementation

AutomatosX may study reference systems, artifacts, formats, and public behavior, but it must not copy source code from those systems into the implementation.

### P-08: External Compatibility Without External Dependency

AutomatosX should support selective external skill interoperability without making its internal architecture dependent on external registries.

---

## Primary Use Cases

1. A platform team wants to expose an internal REST service as an agent-usable capability with policy, auditability, and reuse.
2. A product engineering team wants to wrap an internal CLI or maintenance script so agents can execute it safely in workflows.
3. A company wants to standardize reusable bridges for internal systems through a curated private registry.
4. A user wants to import or export a `SKILL.md` so an AutomatosX bridge can interoperate with OpenClaw-style skill ecosystems.
5. A team wants bridge definitions to generate a runtime-ready bridge package or entrypoint plus a companion skill artifact without maintaining duplicated behavior specs.

---

## Design Guidance From Reference Platforms

Claude Code and OpenClaw show a consistent pattern that AutomatosX should adopt selectively:

- skills are agent-facing invocation assets, not the primary runtime contract
- skills may be user-invocable, model-invocable, or both
- skills may run inline, or in a forked/delegated execution context
- full skill content should be loaded on demand rather than always injected
- skills may carry install and requirement metadata
- skills can dispatch to a tool or runtime capability instead of only expanding prompt text

AutomatosX should borrow these interaction patterns while keeping `BridgeSpec` as the governed runtime object.

For near-term interoperability, OpenClaw community skills are the relevant external reference surface. CLI-Hub and similar bridge marketplaces are explicitly out of scope for early implementation.

The first practical step for AutomatosX is to treat the CLI-Anything concept as a problem statement to surpass, not a codebase to port:

- study the methodology
- identify the valuable abstractions
- re-express them natively for AutomatosX
- improve them with better governance, stronger typing, cleaner boundaries, and lower maintenance cost

Reference observation:

- the reference system generates an installable harness/package and embeds `SKILL.md` inside that package for agent discovery
- AutomatosX should preserve the useful companion relationship between runtime package and skill artifact without copying the implementation

---

## Feature Requirements

### F-01: Bridge Core Model

AutomatosX must introduce a canonical `BridgeSpec` model with the minimum fields needed for installation, execution, discovery, and governance.

Required model areas:

- bridge id and version
- source type and source reference
- install instructions and runtime prerequisites
- entrypoint contract
- capability metadata for routing and semantic discovery
- input and output shape metadata
- security and approval metadata
- trace and observability metadata
- linked skill metadata
- derived artifact metadata for bridge runtime packages or runtime entrypoints and generated skill surfaces

The bridge model must support at least these bridge kinds in v1:

- `command`: wraps an existing CLI or executable
- `service`: wraps a REST, RPC, or local server surface
- `script`: wraps a repo-local or workspace-local script
- `external`: wraps an explicitly approved external bridge package or distribution source

`generated` bridges may exist in v1 only for constrained source profiles and do not need to cover arbitrary source repos.

The bridge model must be the object that runtime, MCP, trace, guard, and policy systems operate on directly.

`BridgeSpec` must be capable of linking to:

- one or more bridge runtime packages or runtime entrypoints
- zero or more companion `SkillSpec` entries
- registry provenance and approval metadata

### F-02: AX-BRIDGE CLI Surface

AutomatosX must provide a first-class CLI surface under `ax bridge`.

Minimum command set:

- `ax bridge build <path|git-url|spec>`
- `ax bridge validate <bridge-ref>`
- `ax bridge install <bridge-ref>`
- `ax bridge list`
- `ax bridge inspect <bridge-id>`
- `ax bridge run <bridge-id>`
- `ax bridge search <query>`

Command behavior requirements:

- `build` generates or scaffolds a bridge from supported source profiles
- `validate` checks schema, prerequisites, and policy compatibility
- `install` installs from internal or explicitly approved sources
- `list` shows installed and available bridges by scope
- `inspect` shows capability, source, entrypoint, requirements, and approval posture
- `run` executes through the shared runtime, not as an ungoverned raw shell shortcut
- `search` defaults to internal registries and explicit local sources

### F-03: AX-SKILL Companion Surface

AutomatosX must provide a first-class companion CLI surface under `ax skill`.

Minimum command set:

- `ax skill list`
- `ax skill inspect <skill-id>`
- `ax skill import <path|url>`
- `ax skill export <bridge-id>`
- `ax skill validate <skill-ref>`
- `ax skill resolve <query>`

Command behavior requirements:

- `list` shows installed or available skills with compact metadata only
- `inspect` shows dispatch mode, linked bridge, requirements, and invocation posture
- `import` converts external skill definitions, especially OpenClaw-style community skills, into governed companion metadata linked to bridges where possible
- `export` renders a bridge-linked skill artifact from AutomatosX-owned metadata
- `validate` checks syntax, metadata, and compatibility with AutomatosX dispatch rules
- `resolve` ranks candidate skills for a task without eagerly injecting all skill content

### F-04: Internal Registry as Primary Distribution Channel

AutomatosX must support internal bridge distribution before any public marketplace distribution.

Required registry scopes:

- workspace-local registry
- organization-configured registry
- explicit local file or git reference

Suggested precedence order:

1. workspace-local bridge definitions
2. configured internal registries
3. explicit file path or git ref provided by the user

Registry requirements:

- bridge metadata index for search and inspection
- companion skill metadata index for discovery and resolution
- version pinning
- source provenance
- allowlist and approval controls
- compatibility checks against local runtime and platform

### F-05: Skill Invocation, Guidance, and Discovery Layer

AutomatosX must support Skills as the invocation and guidance layer above bridges, not as a parallel execution architecture.

AutomatosX must introduce a lightweight `SkillSpec` companion model for skills that are imported, authored, indexed, exported, or generated from bridge definitions.

Required capabilities:

- import `SKILL.md` and convert it into bridge-compatible metadata plus a `SkillSpec`
- export a bridge or bridge-linked skill as `SKILL.md` for compatible external agent ecosystems
- support model-invocable and user-invocable skill metadata
- support dispatch modes:
  - `prompt`
  - `delegate`
  - `bridge`
- support optional requirements and install metadata in skill metadata
- store skill-derived metadata alongside bridge metadata
- allow semantic discovery to consider both bridge metadata and skill metadata when ranking candidates

Invocation rules:

- `prompt` dispatch injects or loads skill guidance into the current execution context
- `delegate` dispatch maps to a bounded AutomatosX delegate-compatible execution path
- `bridge` dispatch resolves to a governed bridge invocation path

Runtime rule:

- if a skill is referenced in AutomatosX, resolution must end in a governed execution path or a governed install/approval path
- raw skill text must not bypass bridge validation, runtime guards, or trace emission
- full skill content must be loaded on demand rather than added globally to every execution context

### F-06: Bridge Runtime and Skill Artifact Generation

AutomatosX must support generation of derived execution and companion artifacts from canonical bridge-owned metadata.

Required derived artifacts:

- generated bridge runtime package metadata or runtime entrypoint metadata
- generated `SKILL.md` companion artifacts for compatible ecosystems

Optional derived artifacts:

- lightweight command wrappers where the bridge kind benefits from a user-facing command surface

Artifact generation rules:

- generated artifacts must carry provenance back to the owning bridge id and version
- generated artifacts must not become the canonical editable source of behavior
- regeneration must be deterministic for the same canonical inputs
- teams must be able to review generated artifacts without hand-maintaining duplicate definitions
- `SKILL.md` should normally be packaged with or linked to the generated bridge runtime output rather than treated as an isolated primary artifact

### F-07: Bridge Runtime Integration

Bridge execution must integrate with existing AutomatosX runtime surfaces.

Required integrations:

- trace-store for durable execution evidence
- guard checks before bridge execution and before installation where applicable
- policy checks for source trust, approval mode, and change radius
- agent routing and delegation compatibility
- MCP exposure for listing, installing, discovering, and invoking bridges
- compatibility with the existing semantic store for bridge and skill discovery

Execution invariants:

- bridges are observable
- bridges are governable
- bridges are routable
- bridges are auditable

### F-08: Constrained Bridge Compiler

`ax bridge build` must target a small number of high-value internal source profiles first.

Supported source profiles for v1:

- OpenAPI or similar HTTP API specs
- existing CLIs with stable help output
- repo-local scripts with explicit arguments
- Node.js or Python libraries with stable callable entrypoints

Out of scope for v1:

- arbitrary GUI software without a scriptable interface
- arbitrary large source trees with no stable operational boundary
- generalized source-to-CLI generation for every language and framework

### F-09: Selective External Skill Compatibility

AutomatosX should support selective external skill compatibility, but not marketplace-driven bridge ingestion.

Initial external support should include:

- import of OpenClaw-style community `SKILL.md`
- export of bridge-linked `SKILL.md` compatible with OpenClaw-style consumption
- normalization of imported skill metadata into `SkillSpec`

Out of scope for early implementation:

- CLI-Hub registry ingestion
- automatic installation from unproven public bridge catalogs
- public bridge marketplace synchronization

### F-10: Clean-Room Development Constraint

AutomatosX must implement `ax-bridge` and `ax-skill` as a clean-room system.

Hard constraints:

- no copying source code from `Archived/CLI-Anything/` or upstream CLI-Anything repositories
- no file-by-file translation or mechanical porting from Python to TypeScript
- no runtime dependency on the archived CLI-Anything source tree

Allowed inputs:

- public behavior and UX observations
- architectural ideas and concepts
- artifact formats such as `SKILL.md`
- methodology-level insights
- independent validation against generated outputs

Required engineering posture:

- define AutomatosX-native schemas first
- implement AutomatosX-native runtime services first
- generate AutomatosX-owned artifacts from canonical metadata
- document deliberate improvements over the reference systems

### F-11: Incremental Integration Strategy

The first implementation must optimize for maintainability and delivery speed.

Required implementation constraints:

- no rewrite of the existing command dispatch architecture
- no rewrite of shared-runtime service composition
- no monolithic skill engine that mixes registry, runtime, compiler, and prompting concerns
- no mandatory dependency on external registries for local bridge workflows

Preferred delivery order:

1. Introduce `BridgeSpec` and `SkillSpec` schemas plus local storage conventions
2. Add `ax bridge` CLI commands using the existing command manifest pattern
3. Add shared-runtime bridge services for install, list, inspect, search, and run
4. Add MCP bridge tools that wrap those runtime services
5. Add `ax skill` import/export, resolve, and bridge-linked dispatch behavior
6. Add constrained bridge compiler targets
7. Add OpenClaw-compatible skill import and export flows

Preferred implementation boundaries:

- `bridge-core`: schemas, validation, type contracts
- `bridge-runtime`: install, inspect, execution, approvals, trace integration
- `bridge-registry`: local and configured registry handling
- `bridge-skills`: skill parsing, export, indexing, dispatch metadata
- `bridge-compiler`: constrained source-profile builders
- `bridge-artifacts`: bridge runtime entrypoint rendering and skill artifact rendering where separation helps maintainability

Maintainability rule:

- the bridge runtime must stay independent from any one skill ecosystem
- the skill layer must stay independent from any one external registry or community hub
- compiler outputs must target stable `BridgeSpec`, not ad hoc runtime wiring

---

## User Experience Expectations

The intended user story is not "find a random public skill first."

The intended user story is:

1. identify an internal system that matters
2. build or scaffold a bridge from that system
3. validate and install the bridge into a governed registry
4. derive the bridge runtime package or entrypoint and companion skill artifacts as needed
5. let agents discover and use that bridge through AutomatosX
6. optionally export or interoperate with OpenClaw-style skill ecosystems when needed

---

## Success Metrics

- Internal bridge build success rate for supported source profiles exceeds 80%
- Installed bridges can be executed through traceable runtime paths with no unmanaged execution escapes
- At least 70% of bridge installs in early usage come from internal registries rather than external registries
- Bridge discovery relevance, including skill-derived metadata, exceeds 80% by manual evaluation
- Derived bridge runtime and skill artifact regeneration is deterministic for stable inputs
- OpenClaw skill interoperability remains optional and does not block internal bridge workflows
- The first `ax-bridge` release is demonstrably implemented without copied CLI-Anything source code

---

## Validation Plan

- Add schema tests for `BridgeSpec`
- Add schema tests for `SkillSpec`
- Add CLI tests for `ax bridge build`, `validate`, `install`, `list`, and `inspect`
- Add CLI tests for `ax skill list`, `inspect`, `import`, `export`, and `resolve`
- Add runtime tests for trace, guard, and policy enforcement during bridge execution
- Add registry tests for precedence order and provenance handling
- Add interoperability tests for `SKILL.md` import and export
- Add deterministic artifact rendering tests for generated bridge runtime outputs and generated skill outputs
- Add interoperability tests for OpenClaw-style skill import/export without making core runtime dependent on any external registry
- Add clean-room review checkpoints documenting behavior parity goals and intentional improvements without code reuse

---

## Implementation Notes

Current AutomatosX surfaces already provide low-friction integration points:

- CLI command registration is centralized through command metadata and manifest wiring
- shared-runtime already centralizes semantic search, policy checks, ability injection, and session-aware state handling
- MCP runtime-state tools already expose stateful runtime methods through a stable wrapper layer
- workspace config already supports cached `.automatosx/config.json` reads and writes
- workflow-engine already has a bounded delegate model that can back skill fork/delegate semantics
- the existing ability and semantic machinery provides an obvious place to integrate ranked bridge and skill discovery before inventing new routing infrastructure

Suggested package boundaries inside AutomatosX:

- `bridge-core`
- `bridge-runtime`
- `bridge-registry`
- `bridge-skills`
- `bridge-compiler`
- `skill-core`
- `skill-runtime`

Suggested local storage surfaces:

- workspace-local bridge definitions under `.automatosx/bridges/`
- workspace-local skill definitions under `.automatosx/skills/`
- state-store namespace for bridge metadata and discovery index
- state-store namespace for skill metadata and dispatch index
- config-managed registry definitions for internal and external sources

Reference source posture:

- `Archived/CLI-Anything/` may be used as a local reference corpus for bridge patterns, skill templates, and behavior comparison
- AutomatosX runtime code must not depend directly on the archived tree at execution time
- direct code reuse from the archived source is prohibited for `ax-bridge` and `ax-skill`

Suggested MCP additions:

- `bridge_list`
- `bridge_search`
- `bridge_inspect`
- `bridge_install`
- `bridge_validate`
- `bridge_run`
- `skill_list`
- `skill_resolve`
- `skill_dispatch`

---

## Open Questions

1. Which registry format should the internal registry use first: git-backed manifests, filesystem manifests, or package-registry metadata?
2. Should bridge installation from trusted internal registries be auto-approved by policy, or still require per-install confirmation?
3. How much of `SKILL.md` frontmatter should map directly into `SkillSpec`, and how much should map into linked `BridgeSpec` metadata?
4. Which supported source profile should be the first bridge compiler target: OpenAPI, existing CLI, or repo-local scripts?
5. Should `ability_inject` eventually rank bridges and skills together, or should skill resolution remain a distinct layer above ability routing?
6. For v1, should generated command surfaces be lightweight wrappers over bridge runtime, or should some bridge kinds emit fuller standalone CLIs?
