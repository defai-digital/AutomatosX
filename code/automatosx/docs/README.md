# AutomatosX Docs

This directory holds repo-level architecture, positioning, and migration notes for the AutomatosX product family.

The current repository-level product in this repo is `AX Trust`.

These notes are now intentionally colocated at the repo level because they describe cross-package behavior spanning:

- `packages/cli`
- `packages/shared-runtime`
- `packages/mcp-server`
- `packages/workflow-engine`

## Current Documents

- [ax-trust-overview.md](./ax-trust-overview.md)
  Current product overview for `AX Trust`, including the family role, component model, and CLI naming guidance.
- [../automatosx/prd/ax-trust-product-repositioning.md](../automatosx/prd/ax-trust-product-repositioning.md)
  Accepted PRD for the AX Trust product definition and target, including category, users, component model, and surface priorities.
- [../automatosx/adr/0003-ax-trust-product-family-and-cli-policy-surface.md](../automatosx/adr/0003-ax-trust-product-family-and-cli-policy-surface.md)
  Accepted ADR for keeping `AutomatosX` as the family brand while defining this repository-level product as `AX Trust`.
- [ax-bridge-integration-best-practices.md](./ax-bridge-integration-best-practices.md)
  Integration guidance for `ax-bridge` and `ax-skill`, including runtime, MCP, workflow, and governance layering.
- [governance-surface-contract.md](./governance-surface-contract.md)
  Canonical governance aggregate contract for CLI and operator-facing surfaces.
- [v15-surface-deprecation-matrix.md](./v15-surface-deprecation-matrix.md)
  Accepted tiering matrix for deciding which surfaces remain core in v15 and which move to advanced or experimental status.

## Maintenance Rule

When a note describes behavior across multiple packages, keep it here instead of recreating a package-local copy under `packages/cli/docs`.
