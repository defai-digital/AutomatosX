# Phase 2 API Documentation

**AutomatosX v2 - AI Provider Layer**
**Version**: 2.0.0
**Date**: 2025-11-10

---

## Table of Contents

1. [Overview](#overview)
2. [ProviderService API](#providerservice-api)
3. [CLI Commands](#cli-commands)
4. [Provider Types](#provider-types)
5. [Schemas](#schemas)
6. [Database Schema](#database-schema)
7. [Environment Configuration](#environment-configuration)
8. [Examples](#examples)

---

## Overview

The AI Provider Layer provides a unified interface for interacting with multiple AI providers (Claude, Gemini, OpenAI) with automatic fallback, circuit breaker resilience, and complete observability.

### Architecture

```
┌─────────────────────────────────────┐
│     ProviderService (Public API)     │
│  • sendRequest()                     │
│  • sendStreamingRequest()           │
│  • getProviderHealth()              │
│  • getProviderStats()               │
└────────────┬─────────────────────────┘
             │
┌────────────▼─────────────────────────┐
│         ProviderRouter               │
│  • Fallback: claude→gemini→openai   │
│  • Circuit Breaker                   │
└────────────┬─────────────────────────┘
             │
      ┌──────┴──────┬──────────┐
      ▼             ▼          ▼
  Claude        Gemini      OpenAI
```

---

## ProviderService API

### Constructor

```typescript
new ProviderService(config?: ProviderServiceConfig)
```

**Parameters**:
- `config` (optional): Service configuration

**ProviderServiceConfig**:
```typescript
{
  primaryProvider?: 'claude' | 'gemini' | 'openai',  // Default: 'claude'
  fallbackChain?: ProviderType[],                    // Default: ['gemini', 'openai']
  enableFallback?: boolean,                          // Default: true
  circuitBreakerThreshold?: number,                  // Default: 5
  circuitBreakerTimeout?: number,                    // Default: 60000 (ms)
  enableLogging?: boolean,                           // Default: true
  enableTelemetry?: boolean                          // Default: true
}
```

**Example**:
```typescript
const service = new ProviderService({
  primaryProvider: 'claude',
  fallbackChain: ['gemini', 'openai'],
  circuitBreakerThreshold: 3,
  enableLogging: true
});
```

---

### sendRequest()

Send a non-streaming request to an AI provider.

```typescript
async sendRequest(
  request: Partial<ProviderRequest>,
  userId?: string
): Promise<ProviderResponse>
```

**Parameters**:
- `request`: Provider request object
  - `messages`: Array of messages (required)
  - `provider`: Provider to use (optional, defaults to primary)
  - `model`: Model name (optional, uses provider default)
  - `temperature`: Temperature 0-2 (optional)
  - `maxTokens`: Maximum tokens to generate (optional)
  - `topP`: Top-p sampling (optional)
  - `topK`: Top-k sampling (optional)
  - `stopSequences`: Stop sequences (optional)
- `userId`: User ID for logging (optional)

**Returns**: `ProviderResponse`
```typescript
{
  content: string,
  tokens: {
    input: number,
    output: number,
    total: number
  },
  duration: number,
  model: string,
  provider: 'claude' | 'gemini' | 'openai',
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error'
}
```

**Example**:
```typescript
const response = await service.sendRequest({
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  temperature: 0.7,
  maxTokens: 500
}, 'user-123');

console.log(response.content);  // AI-generated response
console.log(response.tokens);   // { input: 10, output: 234, total: 244 }
```

---

### sendStreamingRequest()

Send a streaming request with real-time chunk delivery.

```typescript
async sendStreamingRequest(
  request: Partial<ProviderRequest>,
  options?: StreamingOptions,
  userId?: string
): Promise<ProviderResponse>
```

**Parameters**:
- `request`: Provider request (set `stream: true`)
- `options`: Streaming callbacks
  - `onChunk`: Called for each chunk
  - `onComplete`: Called when streaming completes
  - `onError`: Called on error
- `userId`: User ID for logging

**StreamingOptions**:
```typescript
{
  onChunk?: (chunk: StreamChunk) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
}
```

**StreamChunk**:
```typescript
{
  chunk: string,      // Accumulated content so far
  index: number,      // Chunk index
  delta: string       // New content in this chunk
}
```

**Example**:
```typescript
const response = await service.sendStreamingRequest({
  messages: [
    { role: 'user', content: 'Write a story' }
  ],
  stream: true
}, {
  onChunk: (chunk) => {
    process.stdout.write(chunk.delta);  // Print each chunk
  },
  onComplete: () => {
    console.log('\n\nStreaming complete!');
  }
}, 'user-123');

console.log(`Total tokens: ${response.tokens.total}`);
```

---

### getProviderHealth()

Check health status of all registered providers.

```typescript
async getProviderHealth(): Promise<Map<ProviderType, boolean>>
```

**Returns**: Map of provider → health status

**Example**:
```typescript
const healthMap = await service.getProviderHealth();

for (const [provider, healthy] of healthMap) {
  console.log(`${provider}: ${healthy ? 'Healthy' : 'Unhealthy'}`);
}
// claude: Healthy
// gemini: Healthy
// openai: Unhealthy
```

---

### getCircuitBreakerStates()

Get circuit breaker states for all providers.

```typescript
getCircuitBreakerStates(): Map<ProviderType, CircuitBreakerState>
```

**CircuitBreakerState**:
```typescript
{
  failures: number,
  lastFailureTime: number,
  state: 'closed' | 'open' | 'half-open'
}
```

**Example**:
```typescript
const states = service.getCircuitBreakerStates();

for (const [provider, state] of states) {
  console.log(`${provider}: ${state.state} (${state.failures} failures)`);
}
```

---

### resetCircuitBreaker()

Manually reset a provider's circuit breaker.

```typescript
resetCircuitBreaker(provider: ProviderType): void
```

**Example**:
```typescript
service.resetCircuitBreaker('claude');
console.log('Circuit breaker reset for Claude');
```

---

### getProviderStats()

Get usage statistics for all providers.

```typescript
async getProviderStats(timeRangeMs?: number): Promise<ProviderStats[]>
```

**Parameters**:
- `timeRangeMs`: Time range in milliseconds (default: 24 hours)

**Returns**: Array of statistics per provider/model

**ProviderStats**:
```typescript
{
  provider: string,
  model: string,
  total_requests: number,
  successful_requests: number,
  avg_duration: number,
  total_tokens: number,
  avg_input_tokens: number,
  avg_output_tokens: number
}
```

**Example**:
```typescript
// Last 24 hours
const stats = await service.getProviderStats();

// Last 7 days
const weekStats = await service.getProviderStats(7 * 24 * 60 * 60 * 1000);

stats.forEach(stat => {
  console.log(`${stat.provider}/${stat.model}: ${stat.total_requests} requests`);
});
```

---

### getRecentLogs()

Get recent provider request logs.

```typescript
async getRecentLogs(limit?: number): Promise<ProviderLog[]>
```

**Parameters**:
- `limit`: Number of logs to return (default: 50)

**Returns**: Array of log entries

**ProviderLog**:
```typescript
{
  id: string,
  request_id: string,
  provider: string,
  model: string,
  state: string,
  start_time: number,
  end_time?: number,
  duration?: number,
  error_message?: string,
  created_at: number
}
```

**Example**:
```typescript
const logs = await service.getRecentLogs(20);

logs.forEach(log => {
  console.log(`${log.provider} - ${log.state} - ${log.duration}ms`);
});
```

---

### updateConfig()

Update service configuration at runtime.

```typescript
updateConfig(config: Partial<ProviderServiceConfig>): void
```

**Example**:
```typescript
service.updateConfig({
  primaryProvider: 'gemini',
  circuitBreakerThreshold: 10
});
```

---

## CLI Commands

### ax provider health

Check health status of all providers.

```bash
ax provider health [options]
```

**Options**:
- `-v, --verbose`: Show detailed circuit breaker information

**Example**:
```bash
$ ax provider health

Provider  Status       Circuit Breaker  Failures
claude    ✓ Healthy    CLOSED          0
gemini    ✓ Healthy    CLOSED          0
openai    ✗ Unhealthy  OPEN            5

$ ax provider health --verbose

Circuit Breaker Details:

claude:
  State: closed
  Failures: 0
  Last Failure: Never
```

---

### ax provider stats

Show provider usage statistics.

```bash
ax provider stats [options]
```

**Options**:
- `-t, --time <hours>`: Time range in hours (default: 24)
- `--json`: Output as JSON

**Example**:
```bash
$ ax provider stats --time 24

Provider Statistics (Last 24 hours)

Provider  Model                      Requests  Success  Avg Duration  Total Tokens
claude    claude-3-5-sonnet-20241022    150    99.3%    324ms        45,230
gemini    gemini-2.0-flash-exp           45    100%     198ms        12,450
openai    gpt-4o                         30    96.7%    401ms         8,920

Summary:
  Total Requests: 225
  Total Tokens: 66,600
```

---

### ax provider logs

Show recent provider request logs.

```bash
ax provider logs [options]
```

**Options**:
- `-n, --number <count>`: Number of logs (default: 20)
- `-p, --provider <provider>`: Filter by provider
- `--failed`: Show only failed requests
- `--json`: Output as JSON

**Example**:
```bash
$ ax provider logs --provider claude --number 10

Recent Provider Logs

Time      Provider  Model                      State      Duration  Tokens
10:15:23  claude    claude-3-5-sonnet-20241022 completed  287ms     234
10:14:18  claude    claude-3-5-sonnet-20241022 completed  312ms     189
10:12:45  claude    claude-3-5-sonnet-20241022 failed     1543ms    -

$ ax provider logs --failed
# Shows only failed requests
```

---

### ax provider circuit

Manage circuit breakers.

```bash
# Show status
ax provider circuit status

# Reset circuit breaker
ax provider circuit reset <provider>
```

**Example**:
```bash
$ ax provider circuit status

Provider  State   Failures  Last Failure
claude    CLOSED  0         Never
gemini    OPEN    5         2025-11-10T10:15:23Z
openai    CLOSED  1         2025-11-10T09:30:12Z

$ ax provider circuit reset gemini
✓ Circuit breaker reset for gemini
```

---

### ax provider test

Test a provider with a simple request.

```bash
ax provider test <provider> [options]
```

**Arguments**:
- `provider`: Provider to test (claude|gemini|openai)

**Options**:
- `-m, --model <model>`: Specific model to test
- `--stream`: Test streaming

**Example**:
```bash
$ ax provider test claude

✓ claude test successful

Response:
  Content: test successful
  Model: claude-3-5-sonnet-20241022
  Tokens: 15
  Duration: 287ms

$ ax provider test gemini --stream
✓ gemini streaming test successful (23 chunks)
```

---

## Provider Types

### Supported Providers

1. **Claude** (Anthropic)
   - Default model: `claude-3-5-sonnet-20241022`
   - Supports: System prompts, streaming (SSE), tool calling
   - API key: `ANTHROPIC_API_KEY`

2. **Gemini** (Google)
   - Default model: `gemini-2.0-flash-exp`
   - Supports: Safety settings, streaming (async), multimodal
   - API key: `GOOGLE_API_KEY`

3. **OpenAI**
   - Default model: `gpt-4o`
   - Supports: Chat completions, streaming, function calling
   - API key: `OPENAI_API_KEY`

---

## Schemas

### ProviderRequest

```typescript
{
  provider: 'claude' | 'gemini' | 'openai',
  model: string,
  messages: MessageContent[],
  stream?: boolean,
  temperature?: number,      // 0-2
  topP?: number,            // 0-1
  topK?: number,
  maxTokens?: number,
  stopSequences?: string[],
  metadata: {
    requestId: string,      // UUID
    conversationId?: string,// UUID
    userId?: string,
    tags: string[]
  }
}
```

### MessageContent

```typescript
{
  role: 'user' | 'assistant' | 'system',
  content: string
}
```

### ProviderResponse

```typescript
{
  content: string,
  tokens: {
    input: number,
    output: number,
    total: number
  },
  duration: number,
  model: string,
  provider: 'claude' | 'gemini' | 'openai',
  finishReason?: 'stop' | 'length' | 'content_filter' | 'error'
}
```

### ProviderError

```typescript
{
  error: string,
  code?: 'authentication_error' | 'invalid_request' | 'rate_limit_exceeded' |
         'server_error' | 'timeout' | 'network_error' | 'content_filter' |
         'model_not_found' | 'quota_exceeded' | 'unknown_error',
  provider?: 'claude' | 'gemini' | 'openai',
  statusCode?: number,
  retryable: boolean
}
```

---

## Database Schema

### provider_logs

Stores complete request lifecycle logs.

```sql
CREATE TABLE provider_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  conversation_id TEXT,
  user_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  state TEXT NOT NULL,  -- idle, validating, requesting, streaming, completed, failed
  request_data TEXT NOT NULL,
  response_data TEXT,
  error_message TEXT,
  error_code TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration INTEGER,
  retry_attempt INTEGER DEFAULT 0,
  tags TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### provider_metrics

Stores performance and usage metrics.

```sql
CREATE TABLE provider_metrics (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  first_token_latency INTEGER,
  total_duration INTEGER,
  chunks_received INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  is_fallback INTEGER DEFAULT 0,
  fallback_provider TEXT,
  success INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

### Views

**provider_success_rate**:
```sql
SELECT provider, model,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
  CAST(SUM(success) AS REAL) / COUNT(*) * 100 as success_rate,
  AVG(total_duration) as avg_duration
FROM provider_metrics
WHERE created_at >= strftime('%s', 'now', '-7 days') * 1000
GROUP BY provider, model;
```

---

## Environment Configuration

### Required Variables

```bash
# Claude
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Gemini
export GOOGLE_API_KEY="AIza..."

# OpenAI
export OPENAI_API_KEY="sk-proj-..."
```

### Optional Variables

```bash
# Default models
export CLAUDE_DEFAULT_MODEL="claude-3-5-sonnet-20241022"
export GEMINI_DEFAULT_MODEL="gemini-2.0-flash-exp"
export OPENAI_DEFAULT_MODEL="gpt-4o"

# OpenAI organization
export OPENAI_ORGANIZATION="org-..."

# Service configuration
export PROVIDER_CIRCUIT_THRESHOLD="5"
export PROVIDER_CIRCUIT_TIMEOUT="60000"
export PRIMARY_PROVIDER="claude"
export FALLBACK_CHAIN="gemini,openai"
```

---

## Examples

### Basic Request

```typescript
import { ProviderService } from './services/ProviderService.js';

const service = new ProviderService();

const response = await service.sendRequest({
  messages: [
    { role: 'user', content: 'What is TypeScript?' }
  ]
});

console.log(response.content);
```

### Streaming Request

```typescript
let fullResponse = '';

await service.sendStreamingRequest({
  messages: [
    { role: 'user', content: 'Write a poem about code' }
  ],
  stream: true
}, {
  onChunk: (chunk) => {
    fullResponse += chunk.delta;
    process.stdout.write(chunk.delta);
  },
  onComplete: () => {
    console.log('\n\nDone!');
  }
});
```

### With Conversation History

```typescript
const conversationId = '550e8400-e29b-41d4-a716-446655440000';

const response1 = await service.sendRequest({
  messages: [
    { role: 'user', content: 'My name is Alice' }
  ],
  metadata: {
    conversationId
  }
});

const response2 = await service.sendRequest({
  messages: [
    { role: 'user', content: 'My name is Alice' },
    { role: 'assistant', content: response1.content },
    { role: 'user', content: 'What is my name?' }
  ],
  metadata: {
    conversationId
  }
});
```

### Error Handling

```typescript
try {
  const response = await service.sendRequest({
    messages: [
      { role: 'user', content: 'Hello' }
    ]
  });
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    console.log('Rate limit hit, try again later');
  } else if (error.code === 'authentication_error') {
    console.log('Invalid API key');
  } else {
    console.log('Request failed:', error.message);
  }
}
```

### Circuit Breaker Recovery

```typescript
// Check circuit breaker states
const states = service.getCircuitBreakerStates();

for (const [provider, state] of states) {
  if (state.state === 'open') {
    console.log(`${provider} circuit is open, resetting...`);
    service.resetCircuitBreaker(provider);
  }
}
```

### Monitoring

```typescript
// Get health status
const healthMap = await service.getProviderHealth();
console.log('Health:', Array.from(healthMap.entries()));

// Get 24-hour statistics
const stats = await service.getProviderStats();
console.log('Stats:', stats);

// Get recent logs
const logs = await service.getRecentLogs(10);
console.log('Recent logs:', logs);
```

---

## Best Practices

1. **Always handle errors**: Use try-catch and check error codes
2. **Set appropriate timeouts**: Default is 30s, adjust as needed
3. **Use streaming for long responses**: Better UX and memory efficiency
4. **Monitor circuit breaker states**: Reset manually if needed
5. **Track conversation IDs**: For multi-turn conversations
6. **Review logs regularly**: Identify patterns and issues
7. **Configure fallback chain**: Based on your use case and costs
8. **Test provider health**: Before critical operations
9. **Use appropriate models**: Balance cost vs quality
10. **Enable telemetry**: For production monitoring

---

**Document Version**: 1.0
**Last Updated**: 2025-11-10
**Status**: Production Ready ✅
