# AX-BRIDGE Governance Follow-ups

Date: 2026-03-25
Status: Open

## Install Admission Policy

Current behavior:
- `ax bridge install` records provenance on the installed `bridge.json`.
- Install results now also carry a trust decision.
- `bridge.run` and workflow `runtime_trust` guards block execution when trust is denied.

Open decision:
- Should `ax bridge install` reject denied bridges at install time, instead of allowing installation and deferring enforcement to runtime?

Why this matters:
- Allowing install but denying execution preserves auditability and lets teams inspect artifacts before trust approval.
- Rejecting install earlier reduces registry pollution and narrows the gap between admission and execution policy.

Recommended default:
- Keep local install allowed for now, but make denied trust state explicit in CLI/MCP output.
- Add a stricter mode later:
  - `axBridge.install.rejectDenied: true`
  - or `ax bridge install --require-trusted`

## Follow-up Checks

- Verify whether `ax bridge install` should emit a warning when trust is denied but install still succeeds.
- Decide whether monitor/doctor should surface installed-but-denied bridges as a governance warning.
- Decide whether imported OpenClaw skills should follow the same admission policy pattern as bridges.
