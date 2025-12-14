# Provider Adapter Specifications

## Overview

This document specifies the 6 provider adapters for the new AutomatosX, based on analysis of the old implementation patterns.

---

## Provider Summary

| Provider | Type | API Style | Auth Env Var | Base URL |
|----------|------|-----------|--------------|----------|
| Claude | CLI | Anthropic | `ANTHROPIC_API_KEY` | (CLI managed) |
| Gemini | CLI | Google | `GEMINI_API_KEY` | (CLI managed) |
| OpenAI | SDK | OpenAI | `OPENAI_API_KEY` | `api.openai.com` |
| GLM | SDK | OpenAI-compat | `ZAI_API_KEY` | `open.bigmodel.cn` |
| Grok | SDK | OpenAI-compat | `XAI_API_KEY` | `api.x.ai` |
| Qwen | SDK | OpenAI-compat | `DASHSCOPE_API_KEY` | `dashscope.aliyuncs.com` |

---

## Architecture

### Two Adapter Families

```
┌─────────────────────────────────────────────────────────┐
│                    ProviderPort                          │
│  (interface in core/provider-domain)                    │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────┐
│   CLIAdapter        │       │   OpenAICompatAdapter   │
│   (Base class)      │       │   (Base class)          │
└─────────────────────┘       └─────────────────────────┘
          │                               │
    ┌─────┴─────┐               ┌────────┼────────┬────────┐
    │           │               │        │        │        │
    ▼           ▼               ▼        ▼        ▼        ▼
┌────────┐ ┌────────┐     ┌────────┐┌────────┐┌────────┐┌────────┐
│ Claude │ │ Gemini │     │ OpenAI ││  GLM   ││  Grok  ││  Qwen  │
└────────┘ └────────┘     └────────┘└────────┘└────────┘└────────┘
```

### Package Structure

```
packages/adapters/
├── provider-claude/
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── models.ts
│   │   └── index.ts
│   └── package.json
├── provider-gemini/
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── models.ts
│   │   └── index.ts
│   └── package.json
├── provider-openai/
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── models.ts
│   │   └── index.ts
│   └── package.json
├── provider-glm/
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── models.ts
│   │   └── index.ts
│   └── package.json
├── provider-grok/
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── models.ts
│   │   └── index.ts
│   └── package.json
├── provider-qwen/
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── models.ts
│   │   └── index.ts
│   └── package.json
└── provider-common/
    ├── src/
    │   ├── cli-adapter-base.ts
    │   ├── openai-compat-base.ts
    │   ├── error-patterns.ts
    │   └── index.ts
    └── package.json
```

---

## Common Contracts

### Provider Port Interface

```typescript
// Defined in core/provider-domain/src/ports.ts

interface ProviderPort {
  /** Provider identifier */
  readonly providerId: string;

  /** Execute a completion request */
  execute(request: ExecutionRequest): Promise<ExecutionResult>;

  /** Check provider health */
  checkHealth(): Promise<HealthCheckResult>;

  /** Get available models */
  getModels(): Model[];

  /** Estimate token count for text */
  estimateTokens(text: string): number;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;
}
```

### Execution Request

```typescript
interface ExecutionRequest {
  requestId: string;           // UUID
  modelId: string;             // Model to use
  prompt: string;              // User prompt
  systemPrompt?: string;       // System instructions
  options?: {
    temperature?: number;      // 0-2, default varies by provider
    maxTokens?: number;        // Max output tokens
    topP?: number;             // Nucleus sampling
    stream?: boolean;          // Enable streaming
    timeout?: number;          // Request timeout ms
  };
}
```

### Execution Result

```typescript
type ExecutionResult =
  | {
      success: true;
      requestId: string;
      content: string;
      usage: TokenUsage;
      finishReason: 'stop' | 'length' | 'content_filter';
      latencyMs: number;
      modelId: string;
      cached: boolean;
    }
  | {
      success: false;
      requestId: string;
      error: ClassifiedError;
      latencyMs: number;
    };

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

---

## Provider 1: Claude

### Identity

| Property | Value |
|----------|-------|
| Provider ID | `claude` |
| Type | CLI |
| CLI Command | `claude` |
| Auth | `ANTHROPIC_API_KEY` or CLI config |

### Models

| Model ID | Context | Cost/1M Input | Cost/1M Output | Capabilities |
|----------|---------|---------------|----------------|--------------|
| `claude-sonnet-4-20250514` | 200K | $3.00 | $15.00 | text, code, vision |
| `claude-opus-4-20250514` | 200K | $15.00 | $75.00 | text, code, vision |
| `claude-3-5-sonnet-20241022` | 200K | $3.00 | $15.00 | text, code, vision |
| `claude-3-5-haiku-20241022` | 200K | $0.80 | $4.00 | text, code |

### Input Transformation

```typescript
interface ClaudeInput {
  command: 'claude';
  args: ['--print', '--output-format', 'stream-json'];
  stdin: string;  // prompt
  env: {
    TERM: 'dumb';
    NO_COLOR: '1';
    CI: 'true';
    ANTHROPIC_API_KEY?: string;
  };
}
```

**Prompt Format:**
- Direct text passed via stdin
- System prompt: Prepend to user prompt with separator
- No special escaping needed (stdin, not args)

### Output Transformation

```typescript
interface ClaudeOutput {
  // Streaming JSON lines from stdout
  content: string;          // Concatenated text chunks

  // Token usage (estimated - Claude CLI doesn't provide exact)
  usage: {
    promptTokens: number;   // Estimated: ceil(prompt.length / 4)
    completionTokens: number; // Estimated: ceil(content.length / 4)
    totalTokens: number;
  };

  finishReason: 'stop';     // Always 'stop' (CLI doesn't report)
}
```

### Error Patterns

| Pattern | Category | Retry |
|---------|----------|-------|
| `rate_limit_error` | rate_limit | Yes |
| `overloaded_error` | rate_limit | Yes |
| HTTP 429 | rate_limit | Yes |
| HTTP 529 | rate_limit | Yes |
| `invalid_api_key` | authentication | No |
| `unauthorized` | authentication | No |
| `ECONNRESET` | network | Yes |
| `ETIMEDOUT` | network | Yes |

### Adapter Implementation Notes

1. **CLI Execution**: Spawn `claude` with `--print --output-format stream-json`
2. **Non-Interactive**: Set environment variables to prevent prompts
3. **Timeout**: Default 120s, configurable
4. **Process Cleanup**: SIGTERM → wait 5s → SIGKILL
5. **Token Estimation**: `Math.ceil(text.length / 4)` (conservative)

---

## Provider 2: Gemini

### Identity

| Property | Value |
|----------|-------|
| Provider ID | `gemini` |
| Type | CLI |
| CLI Command | `gemini` |
| Auth | `GEMINI_API_KEY` or `GOOGLE_APPLICATION_CREDENTIALS` |

### Models

| Model ID | Context | Cost/1M Input | Cost/1M Output | Capabilities |
|----------|---------|---------------|----------------|--------------|
| `gemini-2.5-pro` | 1M | $1.25 | $10.00 | text, code, vision |
| `gemini-2.5-flash` | 1M | $0.075 | $0.30 | text, code, vision |
| `gemini-2.0-flash` | 1M | $0.10 | $0.40 | text, code |
| `gemini-1.5-pro` | 2M | $1.25 | $5.00 | text, code, vision |

### Input Transformation

```typescript
interface GeminiInput {
  command: 'gemini';
  args: ['--approval-mode', 'auto_edit', '--output-format', 'stream-json'];
  stdin: string;  // prompt
  env: {
    TERM: 'dumb';
    NO_COLOR: '1';
    CI: 'true';
    GEMINI_API_KEY?: string;
    GOOGLE_APPLICATION_CREDENTIALS?: string;
  };
}
```

### Output Transformation

```typescript
interface GeminiOutput {
  content: string;
  usage: {
    promptTokens: number;     // Estimated
    completionTokens: number; // Estimated
    totalTokens: number;
  };
  finishReason: 'stop';
}
```

### Error Patterns

| Pattern | Category | Retry |
|---------|----------|-------|
| `RESOURCE_EXHAUSTED` | quota | No (fallback) |
| `quotaExceeded` | quota | No (fallback) |
| `RATE_LIMIT_EXCEEDED` | rate_limit | Yes |
| `DEADLINE_EXCEEDED` | network | Yes |
| `UNAUTHENTICATED` | authentication | No |
| `PERMISSION_DENIED` | authentication | No |
| HTTP 429 | rate_limit | Yes |
| HTTP 403 | authentication | No |

### Adapter Implementation Notes

1. **Auto-Edit Mode**: `--approval-mode auto_edit` prevents interactive prompts
2. **Service Account**: Support both API key and service account auth
3. **Long Context**: Gemini supports up to 2M tokens (model dependent)

---

## Provider 3: OpenAI

### Identity

| Property | Value |
|----------|-------|
| Provider ID | `openai` |
| Type | SDK |
| SDK Package | `openai` |
| Auth | `OPENAI_API_KEY` |
| Base URL | `https://api.openai.com/v1` |

### Models

| Model ID | Context | Cost/1M Input | Cost/1M Output | Capabilities |
|----------|---------|---------------|----------------|--------------|
| `gpt-4o` | 128K | $2.50 | $10.00 | text, code, vision, function |
| `gpt-4o-mini` | 128K | $0.15 | $0.60 | text, code, vision, function |
| `gpt-4-turbo` | 128K | $10.00 | $30.00 | text, code, vision, function |
| `o1` | 200K | $15.00 | $60.00 | text, code, reasoning |
| `o1-mini` | 128K | $3.00 | $12.00 | text, code, reasoning |

### Input Transformation

```typescript
interface OpenAIInput {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

// Transform from ExecutionRequest
function toOpenAIInput(request: ExecutionRequest): OpenAIInput {
  const messages = [];

  if (request.systemPrompt) {
    messages.push({ role: 'system', content: request.systemPrompt });
  }

  messages.push({ role: 'user', content: request.prompt });

  return {
    model: request.modelId,
    messages,
    temperature: request.options?.temperature,
    max_tokens: request.options?.maxTokens,
    top_p: request.options?.topP,
    stream: request.options?.stream ?? false,
  };
}
```

### Output Transformation

```typescript
interface OpenAIOutput {
  id: string;
  choices: Array<{
    message: { content: string };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Transform to ExecutionResult
function fromOpenAIOutput(response: OpenAIOutput, requestId: string, latencyMs: number): ExecutionResult {
  return {
    success: true,
    requestId,
    content: response.choices[0].message.content,
    usage: {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    },
    finishReason: response.choices[0].finish_reason,
    latencyMs,
    modelId: response.model,
    cached: false,
  };
}
```

### Error Patterns

| Pattern | Category | Retry |
|---------|----------|-------|
| `insufficient_quota` | quota | No (fallback) |
| `billing_hard_limit_reached` | quota | No (fallback) |
| `rate_limit_exceeded` | rate_limit | Yes |
| HTTP 429 | rate_limit | Yes |
| `invalid_api_key` | authentication | No |
| HTTP 401 | authentication | No |
| HTTP 500-504 | server | Yes |
| `ECONNRESET` | network | Yes |

---

## Provider 4: GLM (Zhipu AI)

### Identity

| Property | Value |
|----------|-------|
| Provider ID | `glm` |
| Type | SDK (OpenAI-compatible) |
| SDK Package | `openai` |
| Auth | `ZAI_API_KEY` |
| Base URL | `https://open.bigmodel.cn/api/paas/v4` |

### Models

| Model ID | Context | Cost/1M Input | Cost/1M Output | Capabilities |
|----------|---------|---------------|----------------|--------------|
| `glm-4-plus` | 128K | $7.00 | $7.00 | text, code |
| `glm-4-air` | 128K | $0.14 | $0.14 | text, code |
| `glm-4-airx` | 8K | $1.40 | $1.40 | text, code (fast) |
| `glm-4-flash` | 128K | $0.014 | $0.014 | text, code (cheap) |
| `glm-4v-plus` | 8K | $1.40 | $1.40 | text, code, vision |

### Input Transformation

Same as OpenAI (OpenAI-compatible API):

```typescript
// Uses OpenAI SDK with different base URL
const client = new OpenAI({
  apiKey: process.env.ZAI_API_KEY,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
});
```

### Output Transformation

Same as OpenAI (OpenAI-compatible response format).

### Error Patterns

Inherits OpenAI patterns (OpenAI-compatible API).

### Adapter Implementation Notes

1. **OpenAI SDK**: Uses standard OpenAI npm package with custom base URL
2. **Model Mapping**: Legacy model names map to current (`glm-4` → `glm-4-plus`)
3. **Vision Models**: Use `glm-4v-plus` for image understanding

---

## Provider 5: Grok (xAI)

### Identity

| Property | Value |
|----------|-------|
| Provider ID | `grok` |
| Type | SDK (OpenAI-compatible) |
| SDK Package | `openai` |
| Auth | `XAI_API_KEY` |
| Base URL | `https://api.x.ai/v1` |

### Models

| Model ID | Context | Cost/1M Input | Cost/1M Output | Capabilities |
|----------|---------|---------------|----------------|--------------|
| `grok-3` | 131K | $3.00 | $15.00 | text, code, reasoning |
| `grok-3-fast` | 131K | $5.00 | $25.00 | text, code (fast) |
| `grok-2-vision` | 32K | $2.00 | $10.00 | text, code, vision |
| `grok-2` | 131K | $2.00 | $10.00 | text, code |

### Input Transformation

Same as OpenAI (OpenAI-compatible API):

```typescript
const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
});
```

### Output Transformation

Same as OpenAI.

### Error Patterns

Inherits OpenAI patterns.

### Adapter Implementation Notes

1. **Extended Thinking**: Grok-3 supports reasoning traces (like o1)
2. **Live Search**: Grok-2 can search the web in real-time
3. **Model Mapping**: `grok-beta` → `grok-3`

---

## Provider 6: Qwen (Alibaba)

### Identity

| Property | Value |
|----------|-------|
| Provider ID | `qwen` |
| Type | SDK (OpenAI-compatible) |
| SDK Package | `openai` |
| Auth | `DASHSCOPE_API_KEY` |
| Base URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |

### Models

| Model ID | Context | Cost/1M Input | Cost/1M Output | Capabilities |
|----------|---------|---------------|----------------|--------------|
| `qwen-max` | 32K | $2.80 | $11.20 | text, code |
| `qwen-plus` | 131K | $0.56 | $1.68 | text, code |
| `qwen-turbo` | 1M | $0.042 | $0.126 | text, code (cheap) |
| `qwen-coder-plus` | 131K | $0.49 | $1.96 | code |
| `qwen-vl-max` | 32K | $2.80 | $11.20 | text, code, vision |

### Input Transformation

Same as OpenAI (OpenAI-compatible API):

```typescript
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});
```

### Output Transformation

Same as OpenAI.

### Error Patterns

Inherits OpenAI patterns.

### Adapter Implementation Notes

1. **DashScope**: Alibaba's ML platform providing OpenAI-compatible API
2. **Long Context**: Qwen-turbo supports up to 1M tokens
3. **Vision**: Use `qwen-vl-max` for image understanding
4. **Code Specialist**: `qwen-coder-plus` optimized for code tasks

---

## Common Base Classes

### CLI Adapter Base

```typescript
// packages/adapters/provider-common/src/cli-adapter-base.ts

interface CLIAdapterConfig {
  command: string;
  args: string[];
  timeout: number;
  env: Record<string, string>;
}

abstract class CLIAdapterBase implements ProviderPort {
  protected abstract getCommand(): string;
  protected abstract getArgs(): string[];
  protected abstract getEnv(): Record<string, string | undefined>;
  protected abstract parseOutput(stdout: string): ExecutionResult;

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const result = await this.spawnProcess(request.prompt);
      return this.parseOutput(result.stdout);
    } catch (error) {
      return {
        success: false,
        requestId: request.requestId,
        error: classifyError(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async spawnProcess(stdin: string): Promise<{ stdout: string }> {
    // Spawn child process
    // Write stdin
    // Collect stdout
    // Handle timeout with SIGTERM → SIGKILL
    // Return result
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

### OpenAI-Compatible Adapter Base

```typescript
// packages/adapters/provider-common/src/openai-compat-base.ts

interface OpenAICompatConfig {
  apiKey: string;
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
}

abstract class OpenAICompatAdapterBase implements ProviderPort {
  protected client: OpenAI;

  constructor(config: OpenAICompatConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout ?? 120000,
      maxRetries: config.maxRetries ?? 0, // We handle retries
    });
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: request.modelId,
        messages: this.buildMessages(request),
        temperature: request.options?.temperature,
        max_tokens: request.options?.maxTokens,
        top_p: request.options?.topP,
      });

      return {
        success: true,
        requestId: request.requestId,
        content: response.choices[0].message.content ?? '',
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        finishReason: this.mapFinishReason(response.choices[0].finish_reason),
        latencyMs: Date.now() - startTime,
        modelId: response.model,
        cached: false,
      };
    } catch (error) {
      return {
        success: false,
        requestId: request.requestId,
        error: classifyError(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private buildMessages(request: ExecutionRequest) {
    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system' as const, content: request.systemPrompt });
    }
    messages.push({ role: 'user' as const, content: request.prompt });
    return messages;
  }

  estimateTokens(text: string): number {
    // Use tiktoken for accurate estimation if available
    // Fallback to character-based estimation
    return Math.ceil(text.length / 4);
  }
}
```

---

## Error Classification

```typescript
// packages/adapters/provider-common/src/error-patterns.ts

const ERROR_PATTERNS = {
  // Quota errors (fallback to different provider)
  quota: [
    /insufficient_quota/i,
    /quota_exceeded/i,
    /billing_hard_limit/i,
    /RESOURCE_EXHAUSTED/i,
    /credit.?limit/i,
  ],

  // Rate limit errors (retry with backoff)
  rate_limit: [
    /rate_limit/i,
    /too_many_requests/i,
    /overloaded/i,
    /RATE_LIMIT_EXCEEDED/i,
  ],

  // Authentication errors (don't retry)
  authentication: [
    /invalid_api_key/i,
    /unauthorized/i,
    /UNAUTHENTICATED/i,
    /PERMISSION_DENIED/i,
    /401/,
    /403/,
  ],

  // Network errors (retry)
  network: [
    /ECONNRESET/,
    /ETIMEDOUT/,
    /ENOTFOUND/,
    /ECONNREFUSED/,
    /timeout/i,
    /DEADLINE_EXCEEDED/i,
  ],

  // Server errors (retry then fallback)
  server: [
    /internal_server_error/i,
    /service_unavailable/i,
    /bad_gateway/i,
    /500/,
    /502/,
    /503/,
    /504/,
  ],
};

function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as any)?.status;

  // Check patterns in priority order
  for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message) || pattern.test(String(status))) {
        return {
          category: category as ErrorCategory,
          shouldRetry: category === 'network' || category === 'rate_limit' || category === 'server',
          shouldFallback: category === 'quota' || category === 'server',
          retryAfterMs: extractRetryAfter(error),
          message,
          originalError: error,
        };
      }
    }
  }

  return {
    category: 'unknown',
    shouldRetry: false,
    shouldFallback: false,
    retryAfterMs: null,
    message,
    originalError: error,
  };
}
```

---

## Implementation Priority

### Phase 1: Foundation
1. `provider-common` - Base classes and error patterns
2. Provider contracts in `packages/contracts/src/provider/v1/`

### Phase 2: First Provider (Claude)
3. `provider-claude` - CLI adapter for Claude
4. Integration tests with mock CLI

### Phase 3: OpenAI-Compatible Family
5. `provider-openai` - Direct OpenAI SDK
6. `provider-glm` - Extends OpenAI-compat base
7. `provider-grok` - Extends OpenAI-compat base
8. `provider-qwen` - Extends OpenAI-compat base

### Phase 4: Gemini
9. `provider-gemini` - CLI adapter

### Phase 5: Registry & Wiring
10. `provider-registry` - Provider discovery and management
11. Wire to CLI and MCP server

---

## Testing Strategy

### Unit Tests
- Error classification (pattern matching)
- Input transformation (request → provider format)
- Output transformation (provider format → result)
- Token estimation

### Integration Tests (with mocks)
- CLI adapter process spawning
- SDK adapter API calls
- Error handling and classification

### Contract Tests
- All inputs validate against schemas
- All outputs validate against schemas

### E2E Tests (optional, requires API keys)
- Real provider calls with test prompts
- Rate limit handling
- Error recovery
