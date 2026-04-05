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
- [src/runtime-public-governance-exports.ts](./src/runtime-public-governance-exports.ts)
- [src/runtime-public-catalog-exports.ts](./src/runtime-public-catalog-exports.ts)

Published subpath entrypoints mirror these domains:

- `@defai.digital/shared-runtime/bridge`
- `@defai.digital/shared-runtime/governance`
- `@defai.digital/shared-runtime/catalog`

Prefer these subpaths for domain-specific bridge, governance, and catalog consumers.
Reserve the top-level `@defai.digital/shared-runtime` entrypoint for the runtime service factory, service types, and a small set of shared runtime-adjacent types.

Internal support modules such as execution, workflow runner, provider-call helpers, dependency resolvers, and guard-summary builders are intentionally kept off the package entrypoint.

## Stability Rules

Public API changes should be explicit.

Current guardrails:

- [tests/support/runtime-public-api-manifest.ts](./tests/support/runtime-public-api-manifest.ts)
  Canonical manifest for intended public value exports, blocked internal helpers, and allowed type barrels.
- [tests/runtime-public-api.test.ts](./tests/runtime-public-api.test.ts)
  Locks the value-export surface and blocks internal helper leakage against the manifest.
- [tests/runtime-public-barrel-surface.test.ts](./tests/runtime-public-barrel-surface.test.ts)
  Locks the bridge, governance, and catalog barrels as separate value-export surfaces instead of only checking the flattened entrypoint.
- [tests/runtime-public-type-surface.test.ts](./tests/runtime-public-type-surface.test.ts)
  Locks bridge, governance, review, catalog, and workflow type barrels against the manifest.
- [tests/runtime-public-consumer-audit.test.ts](./tests/runtime-public-consumer-audit.test.ts)
  Audits repo consumers across the top-level package and public subpath entrypoints so low-level public helpers do not linger without an explicit reason.
- [tests/runtime-public-subpath-imports.test.ts](./tests/runtime-public-subpath-imports.test.ts)
  Verifies the published subpath entrypoints resolve to the intended bridge, governance, and catalog surfaces in the source-level Vitest environment.
- [tests/runtime-published-entrypoint-smoke.test.ts](./tests/runtime-published-entrypoint-smoke.test.ts)
  Verifies the built package resolves the top-level and subpath entrypoints through Node package exports, not just Vitest aliases.
- [tests/runtime-top-level-entrypoint-audit.test.ts](./tests/runtime-top-level-entrypoint-audit.test.ts)
  Ensures domain-specific consumers use the public subpaths instead of pulling bridge, governance, or catalog helpers from the top-level entrypoint.

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
- unused governance schemas and runtime-governance helpers that were only relevant to internal plumbing

The result is a curated public API with:

- explicit value-export snapshot coverage
- explicit blocked-internal helper coverage
- explicit type-barrel coverage
- explicit repo-consumer audit coverage

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
