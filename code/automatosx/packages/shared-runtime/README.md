# @defai.digital/shared-runtime

Shared runtime package for AutomatosX CLI and MCP surfaces.

## Purpose

This package owns the canonical runtime entrypoint exposed through:

- `createSharedRuntimeService`
- runtime request/response/service types
- curated public bridge, governance, catalog, and workflow helpers

It is intentionally **not** a flat export of every module under `src/`.

## Public API Shape

The package entrypoint is a facade:

- [src/index.ts](./src/index.ts)
- [src/runtime-service-types.ts](./src/runtime-service-types.ts)
- [src/runtime-service-factory.ts](./src/runtime-service-factory.ts)
- [src/runtime-public-exports.ts](./src/runtime-public-exports.ts)

Curated public exports are split by domain:

- [src/runtime-public-bridge-exports.ts](./src/runtime-public-bridge-exports.ts)
- [src/runtime-public-catalog-exports.ts](./src/runtime-public-catalog-exports.ts)

Internal support modules such as execution, workflow runner, provider-call helpers, dependency resolvers, and guard-summary builders are intentionally kept off the package entrypoint.

## Stability Rules

Public API changes should be explicit.

Current guardrails:

- [tests/support/runtime-public-api-manifest.ts](./tests/support/runtime-public-api-manifest.ts)
  Canonical manifest for intended public value exports, blocked internal helpers, and allowed type barrels.
- [tests/runtime-public-api.test.ts](./tests/runtime-public-api.test.ts)
  Locks the value-export surface and blocks internal helper leakage against the manifest.
- [tests/runtime-public-type-surface.test.ts](./tests/runtime-public-type-surface.test.ts)
  Locks bridge, governance, review, catalog, and workflow type barrels against the manifest.

When changing the package entrypoint:

1. update the public barrel under `src/runtime-public-*.ts`
2. update [tests/support/runtime-public-api-manifest.ts](./tests/support/runtime-public-api-manifest.ts)
3. update the entrypoint tests
4. update this README if the intended public surface changed

## Recent Contraction Work

Recent cleanup removed low-level helpers from the package entrypoint when they had no repo consumers. Examples:

- bridge/skill registry plumbing such as discovery and low-level resolution helpers
- governance plumbing such as trust-config readers and provenance builders
- unused catalog/workflow-path re-exports
- unused type exports that were broader than the actual consumer surface

The result is a curated public API with:

- explicit value-export snapshot coverage
- explicit blocked-internal helper coverage
- explicit type-barrel coverage

The running record is kept in:

- [TODO/runtime-public-api-contraction-candidates.md](./TODO/runtime-public-api-contraction-candidates.md)

## Internal Architecture

The runtime is assembled in [src/runtime-service-factory.ts](./src/runtime-service-factory.ts).

Major internal seams now live in dedicated modules:

- provider calls: [src/runtime-provider-call-service.ts](./src/runtime-provider-call-service.ts)
- workflow orchestration: [src/runtime-workflow-runner-service.ts](./src/runtime-workflow-runner-service.ts)
- workflow tool dispatch: [src/runtime-workflow-tool-executor.ts](./src/runtime-workflow-tool-executor.ts)
- workflow prompt/discussion execution:
  - [src/runtime-workflow-prompt-executor.ts](./src/runtime-workflow-prompt-executor.ts)
  - [src/runtime-workflow-discussion-executor.ts](./src/runtime-workflow-discussion-executor.ts)
- builtins and catalog support:
  - [src/runtime-builtins.ts](./src/runtime-builtins.ts)
  - [src/stable-agent-catalog.ts](./src/stable-agent-catalog.ts)
  - [src/stable-workflow-catalog.ts](./src/stable-workflow-catalog.ts)

## Maintenance Guidance

Prefer this sequence when adding new runtime features:

1. add or update internal support modules
2. wire them through `runtime-service-factory`
3. expose only the minimal stable surface through `runtime-public-*.ts`
4. avoid importing `./index.js` from internal modules; prefer direct internal dependencies
5. keep the manifest and barrels aligned; do not rely on implicit re-export drift

If a helper is only used by CLI or MCP through internal package code, keep it internal until there is a clear external consumer need.
