# PRD-003: v14 MCP Parity Wave 1

## 1. Purpose

Close the highest-value interoperability gaps between the current v14 MCP server and the stronger `13.5` MCP surface without pulling net-new product domains into the same wave.

This PRD covers MCP protocol completeness only:
- resources
- prompts
- per-tool input schemas
- shutdown
- basic rate limiting

It does not attempt full `13.5` tool-count parity.

Status:
- Wave 1 is complete in the current repo.
- The same MCP surface has since been extended with runtime-backed follow-on tools that still preserve the Wave 1 protocol baseline.

## 2. Problem Summary

The current v14 MCP server is usable but still too thin for strong client interoperability:
- it supports `tools/list` and `tools/call` only
- tool schemas are generic and do not describe required inputs
- it does not expose MCP resources or prompts
- it does not support `shutdown`
- it has no request throttling

This hurts clients like Claude Code and Cursor because they rely on structured MCP metadata to discover capabilities safely.

## 3. Product Decision

v14 will implement a protocol-complete MCP baseline before adding large numbers of new tools.

Wave 1 decision:
- keep the current tool names and behavior stable
- enrich the MCP protocol around the existing tools
- add only metadata and server-surface features that materially improve interoperability
- defer net-new domains such as semantic, research, design, feedback, and scaffold

## 4. Requirements

### 4.1 Tool Schemas

`tools/list` must return per-tool input schemas for every currently supported v14 MCP tool.

These schemas must:
- mark required fields explicitly
- constrain simple scalar types where possible
- remain compatible with the existing runtime behavior

### 4.2 Resources

The MCP server must support:
- `resources/list`
- `resources/read`

Wave 1 resources must cover at least:
- workspace config
- local MCP config
- project AX context
- workflow catalog
- recent trace summary

Resources may be generated dynamically from the shared runtime and local workspace state.

### 4.3 Prompts

The MCP server must support:
- `prompts/list`
- `prompts/get`

Wave 1 prompts must cover at least:
- workflow execution guidance
- architecture planning guidance
- review guidance
- discussion guidance

Prompts must be returned in MCP message format and accept structured arguments when useful.

### 4.4 Shutdown

The MCP server must support the `shutdown` method and stop accepting new work after it is received.

### 4.5 Rate Limiting

The MCP stdio server must apply a basic request limit to expensive MCP methods.

The rate limit must:
- be enabled by default
- be configurable for tests
- return a structured JSON-RPC error when exceeded

## 5. Non-Goals

- full `13.5` tool-count parity
- restoring every missing MCP tool in one wave
- implementing net-new backend domains solely to satisfy parity accounting
- renaming the current v14 tools to a different namespace

## 6. Acceptance Criteria

- `tools/list` returns specific schemas for the current MCP tool set.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts`
- `resources/list` returns the v14 Wave 1 resource catalog and `resources/read` returns resource contents.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts`
- `prompts/list` returns the v14 Wave 1 prompt catalog and `prompts/get` returns structured prompt messages.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts`
- `shutdown` is supported by the stdio server.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts`
- request throttling rejects excess MCP requests with a rate-limit error.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts`
- existing `tools/call` behavior remains compatible for the current v14 tool set.
  Verification: `packages/mcp-server/tests/mcp-server.test.ts` and `packages/cli/tests/advanced-commands.test.ts`

Current verified baseline:
- runtime-backed tool schemas now cover the expanded trace, workflow, review, memory, config, session, and agent tools currently shipped in v14
- trace correlation is exposed through `trace.analyze` and `trace.by_session`
- legacy `ax_*` MCP aliases remain accepted for compatibility

## 7. Implementation Notes

- Keep the MCP surface layered on top of the current shared runtime and dashboard services.
- Prefer generated resources/prompts over static files when they reflect live workspace state.
- Do not add missing domains in this PRD just to inflate tool counts.
