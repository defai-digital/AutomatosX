# PRD: AX-BRIDGE Governance Admission Improvements
**Status:** Proposed
**Date:** 2026-03-25
**Scope:** Bridge install admission, skill import admission parity, governance warnings, and operator-facing health visibility

---

## Problem Statement

AutomatosX now has a strong runtime governance model for bridges and skills:

- provenance is recorded
- trust is evaluated
- `bridge.run` enforces trust
- workflow `runtime_trust` guards enforce trust
- trace and runtime summaries preserve governance state

However, admission policy is still incomplete.

Today, a bridge can be installed even if its trust decision is `denied`. This is not an execution bypass, because later execution is still blocked, but it leaves a product gap:

- admission and execution policy are misaligned
- denied artifacts can accumulate in the local registry
- operator visibility is weaker than it should be
- skill import policy has not yet been aligned with bridge install policy

This PRD defines how AutomatosX should improve governance admission without breaking the internal-first workflow that values auditability and inspection.

---

## Goals

1. Make admission policy explicit for bridge install and, if approved, skill import
2. Allow teams to choose between deferred admission and strict admission
3. Surface denied admission clearly in CLI, MCP, doctor, and monitor surfaces
4. Keep trust, provenance, and approval semantics consistent across install, run, workflow, and trace paths
5. Preserve internal-first usability while adding enterprise-grade control points

---

## Non-Goals

- No redesign of `BridgeSpec` or `SkillSpec`
- No change to the current execution-time governance model for `bridge.run` and `skill.run`
- No public marketplace workflow
- No new external registry support
- No change to clean-room implementation constraints

---

## Product Principles

### G-01: Admission And Execution Must Tell The Same Story

If execution would be denied, install or import must at minimum report that clearly and optionally reject it immediately.

### G-02: Deferred Admission Is Valid, But Must Be Explicit

AutomatosX may allow installation of denied artifacts for inspection and auditability, but it must not make that state easy to miss.

### G-03: Source Trust Is Real Trust

If an organization trusts a source prefix, that trust must consistently satisfy explicit trust requirements where appropriate.

### G-04: Bridge And Skill Governance Should Not Drift Accidentally

If bridge install and skill import differ, the difference must be intentional and documented.

### G-05: No Surface Should Need To Recompute Governance

Install, import, run, trace, doctor, and monitor surfaces should all consume the same structured trust and provenance outcomes.

---

## Primary Users

- Platform administrators who define workspace trust policy
- Engineers who install local bridge bundles into a workspace
- Teams importing external skills for controlled interoperability
- Operators reviewing monitor and doctor output to detect governance debt

---

## User Stories

1. As a platform administrator, I want denied bridge installs to fail in strict mode so the workspace registry only contains admissible bridges.
2. As an engineer, I want local installs to remain inspectable in non-strict mode, but I want a clear warning when the installed bridge is not trusted to run.
3. As an operator, I want doctor and monitor to show denied installed artifacts so governance debt is visible without reading raw trace metadata.
4. As a team importing community skills, I want skill admission semantics to match bridge admission semantics unless AutomatosX explicitly documents a different rule.

---

## Functional Requirements

### F-01: Configurable Bridge Install Admission

AutomatosX must support two bridge install admission modes:

- deferred admission
  - install succeeds
  - trust result is returned
  - denied state is explicitly warned
- strict admission
  - install fails when trust evaluates to `denied`
  - installed artifacts are not written

Minimum controls:

- workspace config:
  - `axBridge.install.rejectDenied`
  - `axBridge.install.warnOnDenied`
- CLI flag:
  - `ax bridge install --require-trusted`
- MCP input:
  - `bridge_install.requireTrusted`

Precedence:

1. explicit command/tool input
2. workspace config
3. default behavior

Default behavior for initial release:

- `rejectDenied = false`
- `warnOnDenied = true`

### F-02: Structured Install Result

`bridge.install` results must include:

- installed definition
- provenance
- trust decision:
  - `allowed`
  - `state`
  - `reason`
  - `approvalMode`
  - `approvalPolicyId`
  - `sourceRef`
  - `remoteSource`

This structure must be available to:

- shared-runtime
- CLI text output
- CLI JSON output
- MCP tool output
- workflow artifact summaries where relevant

### F-03: Admission Warning UX

When install succeeds with `trust.allowed = false`, AutomatosX must emit an explicit warning in human-readable output.

Minimum warning content:

- artifact id
- trust state
- denial reason
- whether execution is currently blocked
- how to fix it:
  - allowlist id
  - allowlist source
  - approve policy
  - rerun with strict mode if desired

### F-04: Governance Visibility In Doctor And Monitor

AutomatosX must surface denied installed artifacts through health and dashboard surfaces.

Minimum support:

- doctor check for denied installed bridges
- monitor aggregate for denied installed bridges

Optional follow-on:

- separate aggregate for denied imported skills if skill admission parity is implemented

### F-05: Skill Import Admission Parity

AutomatosX must make an explicit decision about skill admission:

- option A:
  - skill import follows the same deferred/strict model as bridge install
- option B:
  - skill import remains permissive and only execution is governed

If option A is selected, minimum controls are:

- `axBridge.skillImport.rejectDenied`
- `ax skill import --require-trusted`

If option B is selected, AutomatosX must document why the asymmetry is intentional.

Recommended direction:

- follow the same admission policy pattern as bridges, but allow a separate config key

### F-06: Trusted Source Must Satisfy Explicit Trust

For `approval.mode = prompt`, a trusted source prefix must satisfy explicit trust in the same way as a trusted id.

This behavior must apply consistently to:

- bridges
- skills
- workflow guard evaluation
- trace and run summaries

### F-07: Workflow Guard Consistency

Workflow `runtime_trust` guards must understand installed bridge trust metadata as first-class governance state.

This includes:

- PASS when installed bridge trust is acceptable
- FAIL when install output is missing trust metadata
- FAIL when trust is denied
- FAIL when trust state does not satisfy `requiredTrustStates`

---

## Non-Functional Requirements

- No duplicated governance computation in UI surfaces
- No silent downgrade from strict mode to deferred mode
- Regression coverage for:
  - bridge install default mode
  - bridge install strict mode
  - trusted source satisfying explicit trust
  - denied install blocked by workflow guard
  - doctor and monitor visibility

---

## UX Notes

### CLI Example: Deferred Admission

`ax bridge install ./fixtures/remote-bridge`

Expected outcome:
- install succeeds
- output clearly states:
  - installed bridge id
  - `trust: denied`
  - execution will be blocked
  - recommended remediation

### CLI Example: Strict Admission

`ax bridge install ./fixtures/remote-bridge --require-trusted`

Expected outcome:
- install fails
- no bridge is written to the workspace registry
- output explains denial reason and remediation path

---

## Success Metrics

1. No denied bridge can be mistaken for a healthy bridge by reading standard CLI output
2. Doctor and monitor can identify denied installed artifacts without trace inspection
3. Bridge install strict mode prevents denied artifacts from entering the local registry
4. Trusted source prefixes consistently satisfy explicit trust for both bridges and skills

---

## Rollout Plan

### Milestone 1

- structured install trust result
- CLI/MCP deferred warning behavior
- trusted source satisfies explicit trust

### Milestone 2

- strict install mode
- doctor and monitor denied-install aggregation

### Milestone 3

- skill import admission parity decision and implementation

---

## Open Questions

1. Should strict install mode eventually become the enterprise default?
2. Should denied installed bridges be treated as `warn` or `fail` in doctor output?
3. Should skill import use the exact same config keys as bridge install, or parallel keys under `axBridge.skillImport.*`?
