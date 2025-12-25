# CLI Output Fixtures

This directory contains CLI output fixtures for consumer-driven contract testing.

## Purpose

These fixtures capture real or realistic CLI outputs from each provider, enabling:
1. **Regression testing**: Detect when output formats change
2. **Parser validation**: Ensure content extraction works correctly
3. **Error classification**: Validate error patterns are recognized

## Fixture Schema

Each fixture is a JSON file following the `CLIOutputFixtureSchema` from
`@defai.digital/contracts/cli/v1`. See `fixtures.schema.json` for the JSON Schema.

## Structure

```
cli-outputs/
├── README.md              # This file
├── fixtures.schema.json   # JSON Schema for validation
├── claude/
│   ├── success-simple.json      # Simple text response
│   ├── success-stream.json      # Multi-event stream response
│   └── error-rate-limit.json    # Rate limit error
├── gemini/
│   ├── success-simple.json
│   └── error-quota.json
├── codex/
│   ├── success-item-completed.json
│   └── error-timeout.json
├── qwen/
│   └── success-text.json
├── glm/
│   └── success-stream.json
└── grok/
    └── success-stream.json
```

## Adding New Fixtures

### 1. Capture Real Output

Run the provider CLI and capture stdout/stderr:

```bash
# Example for Claude
echo "Hello" | claude --print 2>stderr.txt >stdout.txt
echo $? > exitcode.txt
```

### 2. Create Fixture File

Create a JSON file with this structure:

```json
{
  "provider": "claude",
  "scenario": "success-simple",
  "outputFormat": "stream-json",
  "capturedAt": "2025-12-17T10:00:00Z",
  "cliVersion": "1.0.0",
  "rawOutput": {
    "stdout": "<contents of stdout.txt>",
    "stderr": "",
    "exitCode": 0
  },
  "expected": {
    "content": "Expected extracted content",
    "isError": false
  }
}
```

### 3. Validate Fixture

Run the contract tests to validate:

```bash
pnpm test tests/contract/cli-outputs.test.ts
```

## Error Fixtures

For error scenarios, set `isError: true` and specify `errorCategory`:

```json
{
  "provider": "claude",
  "scenario": "error-rate-limit",
  "outputFormat": "stream-json",
  "rawOutput": {
    "stdout": "",
    "stderr": "Error: rate_limit_exceeded",
    "exitCode": 1
  },
  "expected": {
    "content": "",
    "isError": true,
    "errorCategory": "rate_limit"
  }
}
```

## Valid Error Categories

- `authentication` - API key or credential issues
- `quota` - Usage quota exceeded
- `rate_limit` - Rate limiting in effect
- `validation` - Invalid request parameters
- `network` - Network connectivity issues
- `server` - Server-side errors (5xx)
- `timeout` - Request timed out
- `not_found` - Resource or command not found
- `configuration` - Configuration issues
- `unknown` - Unrecognized error type

## Maintenance

- Update fixtures when CLI output formats change
- Add new fixtures for edge cases discovered in production
- Remove fixtures for deprecated providers or formats
