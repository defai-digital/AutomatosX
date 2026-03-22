# PRD-005: v14 Discussion Variants Wave 1

## 1. Purpose

Define the next post-release extension to the v14 discussion surface.

This PRD adds two focused discussion variants on top of the existing `discuss.run` capability:
- `discuss.quick`
- `discuss.recursive`

This wave is intentionally narrow. It extends the existing discussion runtime rather than introducing a new orchestration model.

## 2. Problem Summary

The current v14 repo supports a standard multi-round discussion path through `discuss.run`, but it does not yet provide:
- a fast single-round discussion variant for low-latency synthesis
- a recursive discussion variant for explicit nested subtopics

That creates a usability gap relative to the stronger `13.5` surface, even though the underlying runtime, tracing, and provider bridge already exist.

## 3. Product Decision

v14 will add two bounded discussion variants:
- `discuss.quick`
  A single-round, low-overhead wrapper over the existing discussion runtime.
- `discuss.recursive`
  A structured nested discussion wrapper that runs child discussions for explicit subtopics and returns a rooted aggregate result.

This wave will:
- stay within the current shared runtime and trace model
- require explicit subtopics for recursion
- remain local-first and in-process

## 4. Requirements

### 4.1 `discuss.quick`

`discuss.quick` must:
- execute through the shared runtime
- force a single discussion round
- return the same core response envelope shape as `discuss.run`
- emit a durable trace
- preserve provider warnings and execution-mode metadata

### 4.2 `discuss.recursive`

`discuss.recursive` must:
- execute a root discussion for the main topic
- accept explicit subtopics
- run child discussions for each subtopic
- emit a durable root trace and child discussion traces
- preserve parent/root trace linkage
- return a structured aggregate result with root result plus child results

### 4.3 MCP Surface

The MCP server must expose:
- `discuss.quick`
- `discuss.recursive`

Both tools must have typed input schemas.

### 4.4 CLI Surface

The CLI must support:
- `ax discuss quick <topic>`
- `ax discuss recursive <topic> --subtopics a,b,c`

CLI output must remain concise and surface warnings clearly when simulation fallback occurs.

## 5. Non-Goals

- automatic topic decomposition in Wave 1
- recursive discussion trees deeper than explicit subtopic recursion
- learned branching logic
- replacing the standard `discuss.run` path

## 6. Acceptance Criteria

- `discuss.quick` runs as a single-round discussion with durable trace output.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts` and `packages/mcp-server/tests/mcp-server.test.ts`
- `discuss.recursive` runs a rooted discussion plus child discussions for explicit subtopics.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts` and `packages/mcp-server/tests/mcp-server.test.ts`
- child recursive traces preserve root/parent linkage.
  Verification: `packages/shared-runtime/tests/shared-runtime.test.ts`
- CLI supports `quick` and `recursive` discussion variants.
  Verification: `packages/cli/tests/retained-commands.test.ts`
- MCP schemas and invocation paths are exposed for both new tools.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts`

## 7. Implementation Notes

- Keep the root discussion response shape compatible with the existing `runDiscussion` contract where possible.
- Use explicit `subtopics` input for recursion in Wave 1 instead of inferred decomposition.
- Prefer predictable trace linkage over clever orchestration.
