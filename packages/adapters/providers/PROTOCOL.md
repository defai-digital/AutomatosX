# CLI Provider Adapter Protocol

This document specifies the protocol for CLI-based provider adapters in AutomatosX.

## Overview

AutomatosX providers use CLI adapters that wrap external CLI tools. This design:
- Delegates authentication to external CLIs (no credential management in AutomatosX)
- Leverages existing CLI tool ecosystems
- Enables easy addition of new providers

## Supported Providers

| Provider | CLI Command | Output Format | Prompt Style | Authentication |
|----------|-------------|---------------|--------------|----------------|
| `claude` | `claude` | `stream-json` | stdin | `~/.claude/` config |
| `gemini` | `gemini` | `stream-json` | stdin | Google Cloud auth |
| `codex` | `codex` | `stream-json` | stdin | OpenAI credentials |
| `qwen` | `qwen` | `text` | stdin | DashScope credentials |
| `glm` | `ax-glm` | `stream-json` | arg | `ZAI_API_KEY` env var |
| `grok` | `ax-grok` | `stream-json` | arg | `XAI_API_KEY` env var |

## Output Formats

### `text` Format

Plain text output. The entire stdout is treated as the response content.

**Example:**
```
Hello! I'm an AI assistant. How can I help you today?
```

**Used by:** `qwen`

### `json` Format

Single JSON object response. Content is extracted from standard fields.

**Example:**
```json
{"content": "Hello! How can I help you?"}
```

**Content Field Priority:**
1. `content` (direct string)
2. `text` (direct string)
3. `response`, `message`, `output`, `result` (direct strings)
4. `content[].text` (Anthropic-style array of text blocks)
5. `choices[0].message.content` (OpenAI-style)
6. Nested: `message.content`, `message.text`

### `stream-json` Format (JSON Lines)

Multiple JSON objects, one per line. Content accumulated from relevant events.

**Common Event Types:**

| Event Type | Provider | Content Extraction |
|------------|----------|-------------------|
| `content` | Claude | `content` field |
| `turn.started` | Claude/Codex | Skip (metadata) |
| `turn.completed` | Claude/Codex | Skip (metadata), save usage |
| `thread.started` | Codex | Skip (metadata) |
| `item.completed` | Codex | `item.text` or `item.agent_message.text` |
| `role: "assistant"` | ax-glm/ax-grok | `content` field |
| `role: "user"` | ax-glm/ax-grok | Skip (echo) |

**Claude Example:**
```json
{"type":"turn.started","id":"turn_123"}
{"type":"content","content":"Hello! "}
{"type":"content","content":"How can I help?"}
{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":8}}
```
**Extracted:** `Hello! How can I help?`

**Codex Example:**
```json
{"type":"thread.started","thread_id":"thread_abc"}
{"type":"item.completed","item":{"type":"agent_message","text":"Here's my response."}}
{"type":"turn.completed"}
```
**Extracted:** `Here's my response.`

**ax-glm/ax-grok Example:**
```json
{"role":"user","content":"Hello"}
{"role":"assistant","content":"Hi there! How can I help?"}
```
**Extracted:** `Hi there! How can I help?`

## Prompt Styles

### `stdin` Style (Default)

Prompt is written to the CLI's stdin:

```bash
echo "Your prompt here" | claude --print
```

**Used by:** `claude`, `gemini`, `codex`, `qwen`

### `arg` Style

Prompt is passed as a command-line argument:

```bash
ax-glm "Your prompt here"
```

**Used by:** `glm`, `grok` (via ax-cli wrappers)

## Error Classification

Errors are classified into categories with retry/fallback guidance.

### Error Categories

| Category | shouldRetry | shouldFallback | Description |
|----------|-------------|----------------|-------------|
| `quota` | false | true | Usage quota exceeded |
| `rate_limit` | true | false | Rate limiting in effect |
| `authentication` | false | false | Credential issues |
| `validation` | false | false | Invalid request |
| `network` | true | true | Network connectivity |
| `server` | true | true | Server-side errors |
| `timeout` | true | true | Request timeout |
| `not_found` | false | true | Resource not found |
| `configuration` | false | false | Config issues |
| `unknown` | false | true | Unrecognized error |

### Error Patterns

#### Quota Errors
```
insufficient_quota    quota_exceeded    billing_hard_limit
RESOURCE_EXHAUSTED    credit_limit      usage_limit
```

#### Rate Limit Errors
```
rate_limit            rate.limit        RATE_LIMIT_EXCEEDED
too_many_requests     429               overloaded
throttl*
```

#### Authentication Errors
```
invalid_api_key       unauthorized      UNAUTHENTICATED
PERMISSION_DENIED     authentication_failed
not_authenticated     401               403
```

#### Validation Errors
```
invalid_request       malformed         bad_request
validation_error      invalid_parameter 400
```

#### Network Errors
```
ECONNRESET           ETIMEDOUT          ENOTFOUND
ECONNREFUSED         network_error      connection_failed
DEADLINE_EXCEEDED    socket_hang_up
```

#### Server Errors
```
internal_server_error service_unavailable bad_gateway
500                   502                  503
504
```

#### Timeout Errors
```
timed_out            timeout            SIGTERM
SIGKILL
```

#### Not Found Errors
```
command_not_found    ENOENT             not_found
model_not_found      404
```

#### Configuration Errors
```
not_configured       missing_config     invalid_config
cli_not_installed
```

### Retry-After Extraction

When rate limited, the classifier extracts suggested wait times:

| Pattern | Result |
|---------|--------|
| `retry after 30 seconds` | 30000ms |
| `retry after 100ms` | 100ms |
| `wait 5 seconds` | 5000ms |
| Rate limit without explicit time | 1000ms default |

## Environment Variables

All CLI invocations set these environment variables for non-interactive mode:

```bash
TERM=dumb      # Disable terminal features
NO_COLOR=1     # Disable ANSI colors
CI=true        # Signal CI/non-interactive environment
```

## ANSI Stripping

All output is stripped of ANSI escape codes before parsing:

```javascript
// Pattern matches standard ANSI sequences
text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
```

This handles:
- Color codes (`\x1b[32m`, `\x1b[0m`)
- Cursor movement (`\x1b[2K`, `\x1b[1G`)
- Other terminal control sequences

## Token Usage

Token usage is extracted from metadata when available:

### Metadata Fields

| Provider Style | Input Tokens | Output Tokens |
|----------------|--------------|---------------|
| Anthropic | `usage.input_tokens` | `usage.output_tokens` |
| OpenAI | `usage.prompt_tokens` | `usage.completion_tokens` |

### Estimation Fallback

When token counts are unavailable, estimation is used:

```
inputTokens = Math.ceil(promptLength / 4)
outputTokens = Math.ceil(completionLength / 4)
```

This assumes ~4 characters per token (conservative estimate).

## Health Checking

Provider health is determined by:

1. **Command availability:** `which <command>` succeeds
2. **Version check:** `<command> --version` succeeds
3. **Test request:** Simple completion request succeeds

## Adding New Providers

To add a new provider:

1. Create config in `providers/<name>.ts`:
   ```typescript
   export const newProviderConfig: CLIProviderConfig = {
     providerId: 'new-provider',
     command: 'new-cli',
     defaultArgs: ['--print'],
     outputFormat: 'stream-json',
     promptStyle: 'stdin',
     models: [{ modelId: 'default', name: 'Default Model' }],
     defaultModel: 'default',
     maxTokens: 4096,
     timeout: 120000,
   };
   ```

2. Export from `providers/index.ts`

3. Add extraction logic to `output-parser.ts` if format differs

4. Add error patterns to `error-classifier.ts` if needed

5. Create test fixtures in `tests/fixtures/cli-outputs/<name>/`

## Contract Compliance

All provider adapters must comply with these invariants:

- **INV-CLI-PARSE-001:** Parse without exception
- **INV-CLI-PARSE-002:** Content extraction accuracy
- **INV-CLI-PARSE-003:** Error classification coverage
- **INV-CLI-PARSE-004:** ANSI stripping

See `packages/contracts/src/cli/v1/invariants.md` for details.
