# CLI Domain Contract V1 - Behavioral Invariants

## Overview

This document defines the non-negotiable behavioral requirements for the command-line interface.

## Exit Code Invariants

### INV-CLI-001: Exit Codes

**Statement:** CLI MUST return appropriate exit codes.

**Rationale:** Exit codes enable scripting and CI integration.

**Exit Codes:**
- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: Configuration error
- `4`: Provider error

**Enforcement:**
- Exit code set in all code paths
- Non-zero on any failure
- Code documented per command

### INV-CLI-002: Error Messages

**Statement:** Errors MUST include actionable messages.

**Rationale:** Users need to know how to fix problems.

**Enforcement:**
- Error includes cause
- Suggestion for resolution
- Link to documentation when applicable

## Output Invariants

### INV-CLI-OUT-001: Format Consistency

**Statement:** Output format MUST be consistent per format flag.

**Rationale:** Consistent output enables parsing.

**Formats:**
- `text`: Human-readable
- `json`: Machine-parseable JSON
- `yaml`: Machine-parseable YAML

**Enforcement:**
- Format flag controls output
- No mixing formats in single output
- JSON/YAML always valid

### INV-CLI-OUT-002: Progress Feedback

**Statement:** Long operations MUST show progress.

**Rationale:** Silent operations seem hung.

**Enforcement:**
- Progress indicator for operations > 2s
- Spinner or percentage as appropriate
- Clean terminal on completion

## Storage Invariants

### INV-CLI-STORE-001: Consistent Backend

**Statement:** Storage backend MUST be consistent within session.

**Rationale:** Mixed backends cause data inconsistency.

**Enforcement:**
- Backend selected at startup
- Same backend used throughout
- Backend logged for debugging

## Testing Requirements

1. `INV-CLI-001`: Test exit codes
2. `INV-CLI-002`: Test error messages
3. `INV-CLI-OUT-001`: Test format consistency
4. `INV-CLI-OUT-002`: Test progress feedback
5. `INV-CLI-STORE-001`: Test storage consistency

## CLI Output Parsing Invariants

### INV-CLI-PARSE-001: Parse Without Exception

**Statement:** CLI output parsing MUST NOT throw exceptions.

**Rationale:** CLI processes may produce unexpected, malformed, or empty output. The parser must degrade gracefully to ensure the system remains stable.

**Enforcement:**
- `parseOutput()` catches all exceptions internally
- Returns empty content on parse failure
- Malformed JSON falls back to text parsing
- ANSI escape codes stripped before parsing
- Empty input returns `{ content: '' }`

### INV-CLI-PARSE-002: Content Extraction Accuracy

**Statement:** Extracted content MUST match the provider's documented output format.

**Rationale:** Each provider has specific output formats. Content extraction must correctly handle all documented variants to ensure reliable communication.

**Provider-Specific Extraction Rules:**
- **Codex**: Extract `item.text` or `agent_message.text` from `item.completed` events
- **ax-glm/ax-grok**: Extract `content` field from `role: "assistant"` messages
- **Claude/Anthropic**: Concatenate `text` fields from `content` array blocks
- **OpenAI/Gemini**: Extract `choices[0].message.content` or equivalent
- **Unknown formats**: Fall back to raw text content

**Enforcement:**
- Unit tests for each provider format
- Consumer-driven contract tests with real output fixtures
- Content comparison in fixture tests

### INV-CLI-PARSE-003: Error Classification Coverage

**Statement:** Error classifier MUST correctly categorize all documented error patterns.

**Rationale:** Retry and fallback decisions depend on accurate error classification. Misclassification leads to inappropriate retry behavior or service degradation.

**Error Categories and Guidance:**

| Category | shouldRetry | shouldFallback | Example Patterns |
|----------|-------------|----------------|------------------|
| `quota` | false | true | `insufficient_quota`, `RESOURCE_EXHAUSTED` |
| `rate_limit` | true | false | `rate_limit`, `429`, `too_many_requests` |
| `authentication` | false | false | `invalid_api_key`, `401`, `403` |
| `validation` | false | false | `invalid_request`, `400`, `malformed` |
| `network` | true | true | `ECONNRESET`, `ETIMEDOUT`, `socket_hang_up` |
| `server` | true | true | `500`, `502`, `503`, `service_unavailable` |
| `timeout` | true | true | `timed_out`, `SIGTERM`, `SIGKILL` |
| `not_found` | false | true | `command_not_found`, `ENOENT`, `404` |
| `configuration` | false | false | `not_configured`, `missing_config` |
| `unknown` | false | true | Default category for unrecognized errors |

**Enforcement:**
- All patterns in `error-classifier.ts` have corresponding test cases
- Each category's retry/fallback behavior is tested
- Unknown errors default to `shouldFallback: true`

### INV-CLI-PARSE-004: ANSI Stripping

**Statement:** ANSI escape codes MUST be stripped before parsing.

**Rationale:** CLI tools may emit terminal control sequences (colors, cursor movement). These must be removed to ensure clean content extraction.

**Enforcement:**
- `stripAnsi()` called on all input before processing
- Regex pattern covers all standard ANSI sequences
- Tests verify colored output is handled correctly

## Testing Requirements

1. `INV-CLI-001`: Test exit codes for all commands
2. `INV-CLI-002`: Test error messages include cause and suggestion
3. `INV-CLI-OUT-001`: Test format consistency across output types
4. `INV-CLI-OUT-002`: Test progress feedback for long operations
5. `INV-CLI-STORE-001`: Test storage backend consistency
6. `INV-CLI-PARSE-001`: Test parser does not throw on any input
7. `INV-CLI-PARSE-002`: Test content extraction for each provider format
8. `INV-CLI-PARSE-003`: Test error classification for all categories
9. `INV-CLI-PARSE-004`: Test ANSI stripping on colored output

## Version History

- V1 (2024-12-16): Initial contract definition
- V1.1 (2025-12-17): Added CLI output parsing invariants (INV-CLI-PARSE-001/002/003/004)
