# ADR 0001: AX-BRIDGE Is Core and AX-SKILL Is the Companion Surface
**Status:** Accepted
**Date:** 2026-03-25

---

## Context

AutomatosX initially explored a direction centered on:

- integrating community Skills
- integrating CLI-Anything and CLI-Hub
- using external ecosystem assets to expand agent capabilities

That direction surfaced a useful opportunity, but it put the center of the architecture in the wrong place.

The expected primary value for AutomatosX is not public marketplace consumption. It is enabling users to convert internal systems into governed, reusable, agent-native capabilities inside the AutomatosX runtime.

The platform already has strong native primitives for this:

- shared runtime execution
- trace persistence
- guard and policy enforcement
- agent routing and delegation
- MCP exposure

Those strengths are best expressed if AutomatosX treats bridges as first-class runtime objects and treats Skills as companion invocation and discovery artifacts.

---

## Decision

AutomatosX adopts the following product and architecture decisions.

### 1. `ax-bridge` remains inside AutomatosX

`ax-bridge` is a native AutomatosX capability and CLI surface under `ax bridge`.

It will not be spun out as a separate project at this stage.

### 2. `ax-skill` is the companion surface

`ax-skill` is a native companion capability and CLI surface under `ax skill`.

It exists to support invocation, guidance, discovery, import, export, and interoperability around bridges.

### 3. Bridge is the canonical model

The canonical unit for installation, execution, governance, traceability, and routing is a `BridgeSpec`.

AutomatosX runtime paths must resolve to a bridge, not to raw skill text.

Generated CLI artifacts and generated skill artifacts are derived outputs and must not replace `BridgeSpec` as the source of truth.

### 4. Skill is the invocation and discovery layer

`SKILL.md` is supported for:

- invocation
- guidance
- import
- export
- compatibility
- prompt packaging
- discovery metadata

It is not the primary execution model and it must not bypass bridge validation, guard checks, or trace emission.

Skill content should be loaded on demand rather than injected globally into every runtime context.

Skills may resolve to:

- prompt guidance in the current context
- delegate-compatible execution
- governed bridge invocation

### 5. Internal registry is the default distribution channel

AutomatosX prioritizes:

1. workspace-local bridges
2. organization-managed internal registries
3. explicit local file or git sources

This ordering reflects the expected enterprise usage pattern.

### 6. OpenClaw skill compatibility is the initial external target

AutomatosX will support selective interoperability with OpenClaw-style community skills through `ax-skill` import and export flows.

AutomatosX will not make its internal model depend on external registries or public bridge marketplaces.

The vendored source under `Archived/CLI-Anything/` is treated as a reference and migration source, not as a live runtime dependency.

### 7. Clean-room implementation is required

AutomatosX may use CLI-Anything and similar systems as conceptual references only.

AutomatosX must not copy source code from those systems into `ax-bridge` or `ax-skill`.

AutomatosX must not mechanically port those systems line by line into TypeScript.

### 8. Bridge execution must remain governed

Bridge installation and execution must integrate with:

- trace-store
- guard checks
- policy controls
- agent routing
- delegate-compatible runtime flows

### 9. The bridge compiler is constrained in v1

Initial bridge generation targets supported source profiles only:

- OpenAPI or similar API specs
- existing CLIs
- repo-local scripts
- stable library entrypoints

AutomatosX does not promise arbitrary source-to-CLI generation in v1.

---

## Rationale

This decision makes the product fit the likely customer reality:

- enterprises want to bridge internal systems
- they need approval, provenance, and auditability
- they care more about reuse and governance than public marketplace volume

It also prevents structural mistakes:

- a skill-first architecture would fragment execution between prompt artifacts and runtime artifacts
- a CLI-Hub-first architecture would optimize for an ecosystem that is useful but not central to AutomatosX differentiation
- a direct CLI-Anything port would inherit foreign implementation constraints instead of building around AutomatosX runtime strengths

By making Bridge the core model, AutomatosX keeps one clean runtime path while still supporting selective skill interoperability where useful.

---

## Consequences

### Positive

- tighter alignment with AutomatosX runtime strengths
- clearer enterprise story for internal automation
- cleaner trace, guard, and policy integration
- easier future support for private bridge catalogs
- cleaner separation between canonical metadata and derived artifacts
- external compatibility without external architectural lock-in

### Negative

- less immediate marketplace-centric positioning
- more upfront design work around `BridgeSpec` and registry semantics
- external skill ecosystems become selective interoperability work rather than the fastest path to feature breadth
- clean-room delivery requires more design discipline than a direct port

### Neutral

- OpenClaw skill compatibility still matters, but as a companion interoperability layer
- Skills still matter, but as a companion layer

---

## Rejected Alternatives

### A. Standalone `AX-BRIDGE` project

Rejected because it would split product attention, dilute AutomatosX differentiation, and force early externalization before the model is proven.

### B. Skill-first architecture

Rejected because prompt packaging and runtime execution are different concerns. Using Skills as the primary runtime object would weaken governance and observability.

### C. CLI-Hub-first marketplace architecture

Rejected because public catalog consumption is not expected to be the dominant customer workflow.

### D. Direct CLI-Anything port or translation

Rejected because it would increase maintenance risk, blur licensing boundaries, and produce an architecture optimized around another system instead of AutomatosX.

---

## Follow-On Work

1. Define `BridgeSpec` schema and invariants
2. Define `SkillSpec` schema and linkage to bridges
3. Add `ax bridge` CLI surface
4. Add `ax skill` companion CLI surface
5. Implement workspace-local and internal registry handling
6. Add derived CLI and `SKILL.md` artifact rendering
7. Add OpenClaw-compatible skill import and export flows
8. Implement constrained bridge compiler targets
9. Maintain clean-room review notes proving concept reuse without code reuse
