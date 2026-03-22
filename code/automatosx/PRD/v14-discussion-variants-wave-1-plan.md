# v14 Discussion Variants Wave 1 Plan

## 1. Purpose

Execution plan for [PRD-005](./PRD-005-v14-discussion-variants-wave-1.md).

Current status:
- Phase A is implemented and verified in the current repo.
- Phase B is implemented and verified in the current repo.

## 2. Scope

This wave implements:
- `discuss.quick`
- `discuss.recursive`

This wave does not implement:
- automatic recursive branching
- broader discussion redesign

## 3. Delivery Sequence

### Phase A: Runtime Variants

Tickets:
- `D-101` — extend runtime discussion request shape for parent/root trace linkage
- `D-102` — implement `runDiscussionQuick`
- `D-103` — implement `runDiscussionRecursive`

Exit gate:
- both variants execute through the shared runtime and produce traceable outputs

### Phase B: Surface Exposure

Tickets:
- `D-201` — add MCP tools and schemas
- `D-202` — add CLI variant parsing and output
- `D-203` — add regression coverage

Exit gate:
- runtime, MCP, and CLI all expose the new discussion variants consistently

## 4. Verification

Wave completion gate:
- `npm run typecheck` passes
- `npm test` passes

Primary test targets:
- `packages/shared-runtime/tests/shared-runtime.test.ts`
- `packages/mcp-server/tests/mcp-server.test.ts`
- `packages/cli/tests/retained-commands.test.ts`
