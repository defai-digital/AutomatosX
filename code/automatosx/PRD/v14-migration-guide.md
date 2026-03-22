# v14 Migration Guide

## Canonical v14 Paths

- Human workflow entry: `ax ship`, `ax architect`, `ax audit`, `ax qa`, `ax release`
- AI-tool integration entry: `ax init`
- Advanced workflow execution: `ax run <workflow-id>`

## What Changed From Legacy Branches

- `11.4` workflow UX is preserved as the default CLI story.
- `13.5` modular runtime and MCP surface are preserved behind shared services and stores.
- CLI and MCP now share runtime, trace, memory, policy, and agent-registration boundaries.

## Deprecation Guidance

- Do not promote `ax run` as the default user-facing entry path.
- Do not reintroduce direct provider orchestration into CLI command handlers.
- Do not treat legacy branch-specific execution paths as separate product surfaces in v14.

## Migration Checklist For Users

1. Move workflow usage to the first-class commands.
2. Use `--dry-run` for artifact previews before real execution.
3. Read workflow outputs from `.automatosx/workflows/<command>/<trace-id>/`.
4. Use MCP initialization/tooling through `ax init` and the shared MCP surface.
5. Verify traces and dashboard visibility through the shared runtime stores.

## Verification References

- [PRD-001-v14-platform-unification.md](/Users/akiralam/code/automatosx/PRD/PRD-001-v14-platform-unification.md)
- [v14-implementation-plan-status.md](/Users/akiralam/code/automatosx/PRD/v14-implementation-plan-status.md)
- [migration-tracker.md](/Users/akiralam/code/automatosx/PRD/migration/migration-tracker.md)
