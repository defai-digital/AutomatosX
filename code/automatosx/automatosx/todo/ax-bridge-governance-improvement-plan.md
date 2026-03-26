# AX-BRIDGE Governance Improvement Plan

Date: 2026-03-25
Status: Proposed
Related PRD: `automatosx/prd/ax-bridge-governance-admission-improvements.md`

---

## Objective

Close the remaining governance gap between:

- bridge install admission
- skill import admission
- runtime execution trust enforcement
- operator visibility in CLI, MCP, doctor, and monitor surfaces

The current system already records provenance and evaluates trust during install or import, and it blocks execution through `bridge.run` and workflow `runtime_trust` guards. The remaining work is to make admission policy explicit, configurable, and consistently visible.

---

## Priority Problems

### P1: Install admission is not yet configurable

Current behavior:
- `ax bridge install` succeeds even when trust evaluates to `denied`
- the bridge is installed locally
- execution is blocked later by runtime governance

Impact:
- registry pollution
- operator confusion
- admission and execution policy are not aligned

### P2: Denied admission is not visible enough

Current behavior:
- install and import surfaces carry trust data
- denied state is not consistently elevated to warnings or health summaries

Impact:
- teams can miss governance debt
- denied-but-installed artifacts are hard to distinguish from healthy assets

### P2: Skill admission policy parity is undecided

Current behavior:
- skills enforce trust at execution time
- imported skills do not yet have a clearly defined admission policy equivalent to bridge install

Impact:
- bridge and skill governance may drift apart
- future OpenClaw skill import could create inconsistent operator expectations

### P3: Strict-mode UX is not yet defined

Current gap:
- no final decision on config shape and CLI flags for strict admission

Impact:
- product semantics are incomplete for enterprise rollout

---

## Proposed Workstreams

### Workstream 1: Configurable Bridge Install Admission

Deliverables:
- Add workspace config:
  - `axBridge.install.rejectDenied`
  - `axBridge.install.warnOnDenied`
- Add CLI flag:
  - `ax bridge install --require-trusted`
- Add MCP parity:
  - `bridge_install.requireTrusted`

Behavior:
- default mode:
  - install succeeds
  - denied trust is returned and clearly warned
- strict mode:
  - install fails if trust evaluates to `denied`
  - no installed artifact is written

Acceptance criteria:
- denied bridge install is rejected when strict mode is enabled
- default mode still records provenance and trust
- CLI and MCP responses both surface the final trust state

### Workstream 2: Admission Warnings and Health Visibility

Deliverables:
- Add explicit warning text to `ax bridge install` when trust is denied but install still succeeds
- Add explicit warning text to `ax skill import` if the same deferred-admission model is used
- Add doctor check:
  - `installed-denied-bridges`
  - optionally `imported-denied-skills`
- Add monitor aggregation for denied installed artifacts

Acceptance criteria:
- an operator can identify denied-but-installed artifacts without reading raw JSON
- doctor and monitor show governance debt directly

### Workstream 3: Skill Admission Parity

Deliverables:
- Decide whether imported skills follow the same deferred-admission model as bridges
- If yes:
  - add `axBridge.skillImport.rejectDenied`
  - add `ax skill import --require-trusted`
- If no:
  - document the intentional asymmetry and rationale in PRD + ADR follow-up

Acceptance criteria:
- skill admission semantics are explicitly documented
- OpenClaw import path does not create a governance exception by accident

### Workstream 4: Structured Governance Reporting

Deliverables:
- Ensure install/import responses include:
  - `allowed`
  - `state`
  - `reason`
  - `approvalMode`
  - `approvalPolicyId`
  - `sourceRef`
- Ensure the same structure is available to:
  - CLI text output
  - CLI JSON output
  - MCP tool results
  - workflow artifact summaries where relevant

Acceptance criteria:
- no surface has to recompute admission status from raw metadata

---

## Implementation Order

### Phase 1: Bridge Admission Policy

1. Implement `axBridge.install.rejectDenied`
2. Implement `ax bridge install --require-trusted`
3. Add MCP `bridge_install.requireTrusted`
4. Add regression tests for:
   - allowed install
   - denied install in default mode
   - denied install in strict mode

### Phase 2: Operator Visibility

1. Add install warning text
2. Add doctor governance warning for denied installed bridges
3. Add monitor governance aggregate for denied installed bridges
4. Add regression tests for doctor and monitor surfaces

### Phase 3: Skill Admission Parity

1. Decide whether skill import follows bridge install semantics
2. If approved, implement `skill import --require-trusted`
3. Add imported-skill governance warnings and tests

### Phase 4: PRD/ADR Closure

1. Update PRD status after implementation
2. Record final decision on deferred vs strict admission defaults
3. Update ADR if skill admission intentionally differs from bridge admission

---

## Risks

- Rejecting denied install by default may surprise current users who rely on inspect-first workflows.
- Allowing denied install without strong warnings may create governance debt that operators ignore.
- Skill parity work can expand scope if OpenClaw import semantics are not constrained.

---

## Recommendation

Implement bridge strict-mode first, but keep the default as deferred admission with strong warnings.

That keeps current flexibility while giving enterprise teams a clean path to stricter governance.
