# AutomatosX Docs

This directory holds repo-level architecture and migration notes that were previously tracked as package-local CLI docs.

These notes are now intentionally colocated at the repo level because they describe cross-package behavior spanning:

- `packages/cli`
- `packages/shared-runtime`
- `packages/mcp-server`
- `packages/workflow-engine`

## Current Documents

- [ax-bridge-integration-best-practices.md](./ax-bridge-integration-best-practices.md)
  Integration guidance for `ax-bridge` and `ax-skill`, including runtime, MCP, workflow, and governance layering.
- [governance-surface-contract.md](./governance-surface-contract.md)
  Canonical governance aggregate contract for CLI and operator-facing surfaces.
- [governance-migration-note.md](./governance-migration-note.md)
  Migration summary for the removal of the legacy `runtimeGovernance` doctor field.
- [governance-upstream-sync-note.md](./governance-upstream-sync-note.md)
  Repo-level PRD/ADR wording changes implied by the completed governance convergence work.

## Maintenance Rule

When a note describes behavior across multiple packages, keep it here instead of recreating a package-local copy under `packages/cli/docs`.
