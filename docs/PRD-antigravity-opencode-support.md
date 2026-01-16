# PRD: Antigravity and OpenCode Provider Support

**Version**: 1.0
**Date**: 2026-01-15
**Author**: AutomatosX Team
**Status**: Draft

---

## Executive Summary

Add support for Google Antigravity and OpenCode as AI coding assistant providers in AutomatosX. Both tools support MCP (Model Context Protocol), enabling seamless integration using the same pattern already established for Claude Code, Gemini CLI, and Codex CLI.

---

## Background

### Current State

AutomatosX currently supports 5 providers:
| Provider | CLI Command | MCP Format |
|----------|-------------|------------|
| Claude Code | `claude` | claude (with `-s local`) |
| Gemini CLI | `gemini` | standard |
| Codex CLI | `codex` | standard |
| Grok | `ax-grok` | ax-wrapper (JSON config) |
| AX-CLI | `ax-cli` | N/A (wrapper only) |

### New Providers

**Google Antigravity** (https://developers.google.com/agentic-experience)
- Google's agentic development platform
- Cross-platform (macOS, Linux, Windows)
- MCP support for external tools
- Multi-model support (Gemini 2.5 Pro/Flash)
- CLI command: `antigravity` (assumed)

**OpenCode** (https://github.com/opencode-ai/opencode)
- Open source terminal-based AI coding agent
- 60K+ GitHub stars
- MCP integration for external tools
- Multi-provider support (OpenAI, Anthropic, etc.)
- CLI command: `opencode`

---

## Goals

1. **Enable MCP registration** for Antigravity and OpenCode during `ax init`
2. **Add health checks** in `ax doctor` for both providers
3. **Support multi-model discussions** with new providers in `ax discuss`
4. **Maintain backwards compatibility** with existing provider configurations

### Non-Goals

- Direct API integration (we use CLI-only approach)
- Custom provider configurations beyond MCP
- Credential management (delegated to provider CLIs)

---

## Requirements

### Functional Requirements

#### FR-1: Provider Detection (`ax doctor`)

| Requirement | Description |
|-------------|-------------|
| FR-1.1 | Detect if `antigravity` CLI is installed |
| FR-1.2 | Detect if `opencode` CLI is installed |
| FR-1.3 | Display installation hints when not found |
| FR-1.4 | Show version information when available |

**Implementation Location**: `packages/cli/src/commands/doctor.ts`

```typescript
// Add to PROVIDER_CHECKS array
{
  id: 'antigravity',
  name: 'Antigravity',
  command: 'antigravity',
  installHint: 'See https://developers.google.com/agentic-experience'
},
{
  id: 'opencode',
  name: 'OpenCode',
  command: 'opencode',
  installHint: 'npm install -g opencode'
},
```

#### FR-2: MCP Registration (`ax init`)

| Requirement | Description |
|-------------|-------------|
| FR-2.1 | Register AutomatosX MCP server with Antigravity |
| FR-2.2 | Register AutomatosX MCP server with OpenCode |
| FR-2.3 | Support appropriate MCP format for each provider |
| FR-2.4 | Skip registration if provider not installed |

**Implementation Location**: `packages/cli/src/commands/init.ts`

```typescript
// Add to PROVIDER_MCP_CONFIGS
antigravity: { cliName: 'antigravity', format: 'standard' }, // TBD: verify format
opencode: { cliName: 'opencode', format: 'standard' },       // TBD: verify format
```

#### FR-3: Provider Adapters

| Requirement | Description |
|-------------|-------------|
| FR-3.1 | Create CLI adapter configuration for Antigravity |
| FR-3.2 | Create CLI adapter configuration for OpenCode |
| FR-3.3 | Support default model selection |
| FR-3.4 | Handle provider-specific output formats |

**Implementation Location**: `packages/adapters/providers/src/configs/`

#### FR-4: Multi-Model Discussions

| Requirement | Description |
|-------------|-------------|
| FR-4.1 | Include Antigravity in `ax discuss` provider list |
| FR-4.2 | Include OpenCode in `ax discuss` provider list |
| FR-4.3 | Support provider selection via `--providers` flag |

---

### Technical Requirements

#### TR-1: MCP Command Format Research

Before implementation, verify the MCP registration command format for each provider:

**Antigravity** (needs verification):
```bash
# Option A: Standard format
antigravity mcp add automatosx -- ax mcp server

# Option B: Config file format
# Check if antigravity uses a config file like ~/.antigravity/config.json
```

**OpenCode** (needs verification):
```bash
# Option A: Standard format
opencode mcp add automatosx -- ax mcp server

# Option B: Config-based
# Check OpenCode documentation for MCP configuration method
```

#### TR-2: Provider Config Structure

```typescript
// packages/adapters/providers/src/configs/antigravity.ts
export const antigravityConfig: CLIProviderConfig = {
  providerId: 'antigravity',
  command: 'antigravity',
  args: ['--print'],  // TBD: verify args
  env: { TERM: 'dumb', NO_COLOR: '1', CI: 'true' },
  outputFormat: 'stream-json',  // TBD: verify format
  timeout: 120000,
  models: [
    { modelId: 'default', name: 'Antigravity Default', contextWindow: 128000, capabilities: ['text', 'code'] }
  ],
};

// packages/adapters/providers/src/configs/opencode.ts
export const opencodeConfig: CLIProviderConfig = {
  providerId: 'opencode',
  command: 'opencode',
  args: [],  // TBD: verify args
  env: { TERM: 'dumb', NO_COLOR: '1', CI: 'true' },
  outputFormat: 'stream-json',  // TBD: verify format
  timeout: 120000,
  models: [
    { modelId: 'default', name: 'OpenCode Default', contextWindow: 128000, capabilities: ['text', 'code'] }
  ],
};
```

#### TR-3: Type Updates

```typescript
// packages/contracts/src/provider/v1/schema.ts
export const ProviderIdSchema = z.enum([
  'claude',
  'gemini',
  'codex',
  'grok',
  'ax-cli',
  'antigravity',  // NEW
  'opencode',     // NEW
]);
```

---

## Implementation Plan

### Phase 1: Research & Validation (Pre-Implementation)

| Task | Description | Owner |
|------|-------------|-------|
| 1.1 | Install and test Antigravity CLI locally | Dev |
| 1.2 | Install and test OpenCode CLI locally | Dev |
| 1.3 | Document MCP registration commands for each | Dev |
| 1.4 | Verify output format (text, json, stream-json) | Dev |
| 1.5 | Test non-interactive mode flags | Dev |

### Phase 2: Core Implementation

| Task | Description | Files |
|------|-------------|-------|
| 2.1 | Add provider IDs to schema | `packages/contracts/src/provider/v1/schema.ts` |
| 2.2 | Create Antigravity config | `packages/adapters/providers/src/configs/antigravity.ts` |
| 2.3 | Create OpenCode config | `packages/adapters/providers/src/configs/opencode.ts` |
| 2.4 | Export configs from index | `packages/adapters/providers/src/index.ts` |
| 2.5 | Add to doctor checks | `packages/cli/src/commands/doctor.ts` |
| 2.6 | Add to init MCP configs | `packages/cli/src/commands/init.ts` |
| 2.7 | Register in bootstrap | `packages/cli/src/bootstrap.ts` |

### Phase 3: Testing

| Task | Description | Files |
|------|-------------|-------|
| 3.1 | Add provider config tests | `tests/integration/providers/cli-adapter.test.ts` |
| 3.2 | Add discussion tests | `tests/integration/discussion-workflow.test.ts` |
| 3.3 | Add contract tests | `tests/contract/provider.test.ts` |
| 3.4 | Manual E2E testing | N/A |

### Phase 4: Documentation

| Task | Description | Files |
|------|-------------|-------|
| 4.1 | Update README provider table | `README.md` |
| 4.2 | Update CLAUDE.md | `CLAUDE.md` |
| 4.3 | Add to changelog | Release notes |

---

## Files to Modify

| File | Changes |
|------|---------|
| `packages/contracts/src/provider/v1/schema.ts` | Add `antigravity`, `opencode` to enum |
| `packages/adapters/providers/src/configs/antigravity.ts` | NEW: Antigravity config |
| `packages/adapters/providers/src/configs/opencode.ts` | NEW: OpenCode config |
| `packages/adapters/providers/src/index.ts` | Export new configs |
| `packages/cli/src/commands/doctor.ts` | Add provider checks |
| `packages/cli/src/commands/init.ts` | Add MCP configs |
| `packages/cli/src/bootstrap.ts` | Register providers |
| `README.md` | Update provider table |
| `CLAUDE.md` | Update provider list |
| `tests/integration/providers/cli-adapter.test.ts` | Add tests |
| `tests/contract/provider.test.ts` | Update provider count |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP format differs from expectations | Medium | Medium | Research Phase 1 validates format before coding |
| Provider CLI not yet stable | Medium | Low | Mark as experimental in docs |
| Output format parsing issues | Low | Medium | Test with real CLI before release |
| Breaking changes in provider CLI | Low | Medium | Pin to known working versions |

---

## Success Criteria

1. `ax doctor` correctly detects Antigravity and OpenCode installations
2. `ax init` successfully registers MCP with both providers
3. `ax discuss --providers antigravity,opencode` executes without errors
4. All existing tests continue to pass
5. No regressions in existing provider support

---

## Open Questions

1. **Antigravity MCP format**: What is the exact command to register an MCP server?
2. **OpenCode MCP format**: Does OpenCode use `opencode mcp add` or a config file?
3. **Output formats**: Do both providers support `--print` or similar for non-interactive mode?
4. **Model selection**: How to specify models in each provider CLI?

---

## Appendix

### A. MCP Registration Patterns (Current)

```bash
# Claude (claude format)
claude mcp add automatosx -s local -- ax mcp server

# Gemini (standard format)
gemini mcp add automatosx -- ax mcp server

# Codex (standard format)
codex mcp add automatosx -- ax mcp server

# Grok (ax-wrapper format - JSON config)
# Writes to ~/.ax-grok/mcp.json
```

### B. References

- [Google Antigravity](https://developers.google.com/agentic-experience)
- [OpenCode GitHub](https://github.com/opencode-ai/opencode)
- [MCP Protocol](https://modelcontextprotocol.io)
- [AutomatosX MCP Server](packages/mcp-server/)
