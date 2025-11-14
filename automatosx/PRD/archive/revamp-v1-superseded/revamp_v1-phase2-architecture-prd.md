# revamp_v1 Phase 2: AI Provider Layer - Architecture PRD

**Project:** AutomatosX Revamp v1
**Phase:** Phase 2 - AI Provider Layer
**Duration:** 3 weeks (15 working days)
**Dates:** December 8-28, 2025
**Status:** Ready for Implementation

---

## Executive Summary

Phase 2 implements a multi-provider AI abstraction layer with automatic fallback, rate limiting, and streaming support. Following the proven ReScript + TypeScript + Zod architecture from AutomatosX v2, this phase creates a robust provider system supporting Claude (Anthropic), Gemini (Google), and OpenAI (GPT).

**Key Deliverables:**
- ReScript state machine for provider request lifecycle
- TypeScript service layer with 3 provider implementations
- Zod validation schemas for all provider interactions
- Database migration for request/response tracking
- 45+ comprehensive tests
- Performance benchmarks (<2s first token latency)

---

## Architecture Overview

### Three-Layer Architecture

Following AutomatosX v2's proven pattern:

```
┌─────────────────────────────────────────────────────┐
│  ReScript Core Layer                                │
│  ProviderStateMachine.res                           │
│  • Deterministic state transitions                  │
│  • Type-safe event handling                         │
│  • Request lifecycle management                     │
└──────────────┬──────────────────────────────────────┘
               │ Compiled to .bs.js
┌──────────────▼──────────────────────────────────────┐
│  TypeScript Service Layer                           │
│  ProviderRouter.ts → ClaudeProvider.ts              │
│                   → GeminiProvider.ts               │
│                   → OpenAIProvider.ts               │
│  • Provider orchestration                           │
│  • Fallback logic                                   │
│  • Rate limiting & streaming                        │
└──────────────┬──────────────────────────────────────┘
               │ Zod validation
┌──────────────▼──────────────────────────────────────┐
│  Database Layer                                      │
│  Migration 009: provider_requests, provider_metrics │
│  • Request/response tracking                        │
│  • Cost and usage metrics                           │
│  • Performance monitoring                           │
└─────────────────────────────────────────────────────┘
```

---

## Component 1: ReScript State Machine

### File: `packages/rescript-core/src/providers/ProviderStateMachine.res`

**Purpose:** Manage provider request lifecycle with deterministic state transitions.

#### State Definitions

```rescript
module State = {
  type t =
    | Idle
    | Validating
    | Requesting
    | Streaming
    | RateLimited
    | Retrying
    | Completed
    | Failed

  let toString = (state: t): string => {
    switch state {
    | Idle => "idle"
    | Validating => "validating"
    | Requesting => "requesting"
    | Streaming => "streaming"
    | RateLimited => "rate_limited"
    | Retrying => "retrying"
    | Completed => "completed"
    | Failed => "failed"
    }
  }

  let fromString = (str: string): option<t> => {
    switch str {
    | "idle" => Some(Idle)
    | "validating" => Some(Validating)
    | "requesting" => Some(Requesting)
    | "streaming" => Some(Streaming)
    | "rate_limited" => Some(RateLimited)
    | "retrying" => Some(Retrying)
    | "completed" => Some(Completed)
    | "failed" => Some(Failed)
    | _ => None
    }
  }
}
```

#### Event Definitions

```rescript
module Event = {
  type t =
    | InitiateRequest({
        provider: string,
        model: string,
        messages: array<Js.Json.t>,
        maxTokens: option<int>,
        temperature: option<float>,
        stream: bool,
      })
    | ValidateRequest
    | ValidationPassed
    | ValidationFailed({reason: string})
    | SendRequest
    | ReceiveResponse({
        content: string,
        tokens: {
          "input": int,
          "output": int,
          "total": int,
        },
        duration: int,
      })
    | ReceiveStreamChunk({chunk: string, index: int})
    | StreamComplete
    | RateLimitHit({retryAfter: int})
    | RetryRequest({attempt: int})
    | RequestFailed({error: string, code: option<string>})
    | FallbackToProvider({provider: string})
    | Complete
    | Reset

  let toString = (event: t): string => {
    switch event {
    | InitiateRequest(_) => "initiate_request"
    | ValidateRequest => "validate_request"
    | ValidationPassed => "validation_passed"
    | ValidationFailed(_) => "validation_failed"
    | SendRequest => "send_request"
    | ReceiveResponse(_) => "receive_response"
    | ReceiveStreamChunk(_) => "receive_stream_chunk"
    | StreamComplete => "stream_complete"
    | RateLimitHit(_) => "rate_limit_hit"
    | RetryRequest(_) => "retry_request"
    | RequestFailed(_) => "request_failed"
    | FallbackToProvider(_) => "fallback_to_provider"
    | Complete => "complete"
    | Reset => "reset"
    }
  }
}
```

#### Context Management

```rescript
module Context = {
  type providerInfo = {
    name: string,
    model: string,
    priority: int,
    available: bool,
  }

  type requestMetrics = {
    startTime: float,
    endTime: option<float>,
    duration: option<int>,
    inputTokens: int,
    outputTokens: int,
    totalTokens: int,
    cost: float,
  }

  type t = {
    requestId: string,
    provider: option<providerInfo>,
    fallbackProviders: array<providerInfo>,
    messages: array<Js.Json.t>,
    model: option<string>,
    maxTokens: option<int>,
    temperature: option<float>,
    stream: bool,
    response: option<string>,
    streamChunks: array<string>,
    retryCount: int,
    maxRetries: int,
    error: option<string>,
    errorCode: option<string>,
    metrics: requestMetrics,
    metadata: Js.Dict.t<Js.Json.t>,
  }

  let create = (requestId: string): t => {
    {
      requestId: requestId,
      provider: None,
      fallbackProviders: [],
      messages: [],
      model: None,
      maxTokens: None,
      temperature: None,
      stream: false,
      response: None,
      streamChunks: [],
      retryCount: 0,
      maxRetries: 3,
      error: None,
      errorCode: None,
      metrics: {
        startTime: Js.Date.now(),
        endTime: None,
        duration: None,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0.0,
      },
      metadata: Js.Dict.empty(),
    }
  }

  let updateProvider = (ctx: t, provider: providerInfo): t => {
    {...ctx, provider: Some(provider)}
  }

  let updateResponse = (ctx: t, content: string, tokens: 'a): t => {
    let inputTokens = tokens["input"]
    let outputTokens = tokens["output"]
    let totalTokens = tokens["total"]

    {
      ...ctx,
      response: Some(content),
      metrics: {
        ...ctx.metrics,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalTokens: totalTokens,
        endTime: Some(Js.Date.now()),
        duration: Some(
          Belt.Int.fromFloat(Js.Date.now() -. ctx.metrics.startTime)
        ),
      },
    }
  }

  let addStreamChunk = (ctx: t, chunk: string): t => {
    {...ctx, streamChunks: Belt.Array.concat(ctx.streamChunks, [chunk])}
  }

  let incrementRetry = (ctx: t): t => {
    {...ctx, retryCount: ctx.retryCount + 1}
  }

  let setError = (ctx: t, error: string, code: option<string>): t => {
    {...ctx, error: Some(error), errorCode: code}
  }
}
```

#### State Machine Implementation

```rescript
module Machine = {
  type t = {
    currentState: State.t,
    context: Context.t,
    history: array<State.t>,
  }

  let create = (requestId: string): t => {
    {
      currentState: State.Idle,
      context: Context.create(requestId),
      history: [],
    }
  }

  // Transition guards
  module Guards = {
    let canValidate = (ctx: Context.t): bool => {
      Belt.Array.length(ctx.messages) > 0
    }

    let canRetry = (ctx: Context.t): bool => {
      ctx.retryCount < ctx.maxRetries
    }

    let hasFallback = (ctx: Context.t): bool => {
      Belt.Array.length(ctx.fallbackProviders) > 0
    }

    let isStreamMode = (ctx: Context.t): bool => {
      ctx.stream
    }
  }

  // State transition logic
  let transition = (
    machine: t,
    event: Event.t,
  ): result<t, string> => {
    let {currentState, context, history} = machine

    let result = switch (currentState, event) {
    // Idle → Validating
    | (State.Idle, Event.InitiateRequest(req)) => {
        let newContext = {
          ...context,
          messages: req.messages,
          model: Some(req.model),
          maxTokens: req.maxTokens,
          temperature: req.temperature,
          stream: req.stream,
        }
        Ok((State.Validating, newContext))
      }

    // Validating → Requesting (success)
    | (State.Validating, Event.ValidationPassed) =>
        if Guards.canValidate(context) {
          Ok((State.Requesting, context))
        } else {
          Error("Cannot validate: invalid context")
        }

    // Validating → Failed (validation error)
    | (State.Validating, Event.ValidationFailed({reason})) => {
        let newContext = Context.setError(context, reason, Some("VALIDATION_ERROR"))
        Ok((State.Failed, newContext))
      }

    // Requesting → Streaming (if streaming enabled)
    | (State.Requesting, Event.ReceiveStreamChunk(data)) =>
        if Guards.isStreamMode(context) {
          let newContext = Context.addStreamChunk(context, data.chunk)
          Ok((State.Streaming, newContext))
        } else {
          Error("Not in stream mode")
        }

    // Requesting → Completed (non-streaming)
    | (State.Requesting, Event.ReceiveResponse(data)) => {
        let newContext = Context.updateResponse(context, data.content, data.tokens)
        Ok((State.Completed, newContext))
      }

    // Streaming → Streaming (more chunks)
    | (State.Streaming, Event.ReceiveStreamChunk(data)) => {
        let newContext = Context.addStreamChunk(context, data.chunk)
        Ok((State.Streaming, newContext))
      }

    // Streaming → Completed
    | (State.Streaming, Event.StreamComplete) => {
        let fullResponse = Js.Array.joinWith("", context.streamChunks)
        let newContext = {...context, response: Some(fullResponse)}
        Ok((State.Completed, newContext))
      }

    // Any → RateLimited
    | (_, Event.RateLimitHit(_)) => Ok((State.RateLimited, context))

    // RateLimited → Retrying
    | (State.RateLimited, Event.RetryRequest(data)) =>
        if Guards.canRetry(context) {
          let newContext = Context.incrementRetry(context)
          Ok((State.Retrying, newContext))
        } else {
          Error("Max retries exceeded")
        }

    // Retrying → Requesting
    | (State.Retrying, Event.SendRequest) => Ok((State.Requesting, context))

    // Any → Failed (on error)
    | (_, Event.RequestFailed({error, code})) => {
        let newContext = Context.setError(context, error, code)
        Ok((State.Failed, newContext))
      }

    // Failed → Requesting (fallback)
    | (State.Failed, Event.FallbackToProvider({provider})) =>
        if Guards.hasFallback(context) {
          // Update to fallback provider
          Ok((State.Requesting, context))
        } else {
          Error("No fallback providers available")
        }

    // Completed → Idle (reset)
    | (State.Completed, Event.Reset) => Ok((State.Idle, Context.create(context.requestId)))

    // Invalid transitions
    | (state, event) =>
        Error(
          "Invalid transition: " ++
          State.toString(state) ++
          " -> " ++
          Event.toString(event)
        )
    }

    switch result {
    | Ok((newState, newContext)) =>
        Ok({
          currentState: newState,
          context: newContext,
          history: Belt.Array.concat(history, [currentState]),
        })
    | Error(msg) => Error(msg)
    }
  }

  // Get current state
  let getState = (machine: t): State.t => machine.currentState

  // Get context
  let getContext = (machine: t): Context.t => machine.context

  // Check if in terminal state
  let isTerminal = (machine: t): bool => {
    switch machine.currentState {
    | State.Completed | State.Failed => true
    | _ => false
    }
  }

  // Get state history
  let getHistory = (machine: t): array<State.t> => machine.history
}

// JavaScript interop
@genType
let createMachine = (requestId: string): Machine.t => {
  Machine.create(requestId)
}

@genType
let transitionMachine = (machine: Machine.t, eventJson: Js.Json.t): result<Machine.t, string> => {
  // Parse event from JSON
  // This would be implemented with proper JSON parsing
  Error("Not implemented")
}

@genType
let getMachineState = (machine: Machine.t): string => {
  State.toString(Machine.getState(machine))
}

@genType
let getMachineContext = (machine: Machine.t): Context.t => {
  Machine.getContext(machine)
}
```

**Estimated Lines:** ~450 lines

---

## Component 2: Zod Validation Schemas

### File: `src/types/schemas/provider.schema.ts`

```typescript
import { z } from 'zod';

// Provider configuration schema
export const ProviderConfigSchema = z.object({
  name: z.enum(['claude', 'gemini', 'openai']),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(10).default(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  timeout: z.number().int().positive().default(60000), // 60 seconds
  maxRetries: z.number().int().nonnegative().default(3),
  rateLimits: z.object({
    requestsPerMinute: z.number().int().positive(),
    tokensPerMinute: z.number().int().positive().optional(),
  }),
  models: z.array(z.string()).min(1),
  defaultModel: z.string(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// Message schema (for chat messages)
export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(1000000), // 1M chars max
  name: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

// Provider request schema
export const ProviderRequestSchema = z.object({
  requestId: z.string().uuid(),
  provider: z.enum(['claude', 'gemini', 'openai']),
  model: z.string().min(1).max(100),
  messages: z.array(MessageSchema).min(1).max(1000),
  maxTokens: z.number().int().positive().max(200000).optional(),
  temperature: z.number().min(0).max(2).default(1.0),
  topP: z.number().min(0).max(1).optional(),
  stream: z.boolean().default(false),
  stopSequences: z.array(z.string()).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProviderRequest = z.infer<typeof ProviderRequestSchema>;

// Token usage schema
export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

// Provider response schema
export const ProviderResponseSchema = z.object({
  requestId: z.string().uuid(),
  provider: z.enum(['claude', 'gemini', 'openai']),
  model: z.string().min(1),
  content: z.string(),
  tokens: TokenUsageSchema,
  finishReason: z.enum(['stop', 'length', 'content_filter', 'tool_calls']).optional(),
  duration: z.number().int().nonnegative(), // milliseconds
  cost: z.number().nonnegative().optional(), // USD
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number().int().positive(),
});

export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;

// Stream chunk schema
export const StreamChunkSchema = z.object({
  requestId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  chunk: z.string(),
  done: z.boolean().default(false),
  timestamp: z.number().int().positive(),
});

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// Provider health schema
export const ProviderHealthSchema = z.object({
  provider: z.enum(['claude', 'gemini', 'openai']),
  status: z.enum(['healthy', 'degraded', 'down']),
  latency: z.number().nonnegative().optional(), // milliseconds
  rateLimitRemaining: z.number().int().nonnegative().optional(),
  rateLimitReset: z.number().int().positive().optional(), // timestamp
  lastChecked: z.number().int().positive(),
});

export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

// Rate limit info schema
export const RateLimitInfoSchema = z.object({
  limit: z.number().int().positive(),
  remaining: z.number().int().nonnegative(),
  reset: z.number().int().positive(), // timestamp
  retryAfter: z.number().int().nonnegative().optional(), // seconds
});

export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

// Provider router options schema
export const ProviderRouterOptionsSchema = z.object({
  primaryProvider: z.enum(['claude', 'gemini', 'openai']),
  fallbackProviders: z.array(z.enum(['claude', 'gemini', 'openai'])).default([]),
  enableFallback: z.boolean().default(true),
  enableCircuitBreaker: z.boolean().default(true),
  circuitBreakerThreshold: z.number().int().positive().default(5),
  circuitBreakerTimeout: z.number().int().positive().default(60000), // 1 minute
});

export type ProviderRouterOptions = z.infer<typeof ProviderRouterOptionsSchema>;

// Cost calculation schema
export const CostMetricsSchema = z.object({
  provider: z.enum(['claude', 'gemini', 'openai']),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  inputCostPerToken: z.number().nonnegative(),
  outputCostPerToken: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  currency: z.string().default('USD'),
});

export type CostMetrics = z.infer<typeof CostMetricsSchema>;
```

**Estimated Lines:** ~150 lines

---

## Component 3: Database Migration

### File: `src/migrations/009_create_provider_tables.sql`

```sql
-- Migration 009: Provider request tracking and metrics
-- Created: 2025-12-08
-- Purpose: Track provider requests, responses, and usage metrics

-- Provider requests table
CREATE TABLE IF NOT EXISTS provider_requests (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  messages TEXT NOT NULL, -- JSON array
  max_tokens INTEGER,
  temperature REAL DEFAULT 1.0,
  stream INTEGER DEFAULT 0, -- boolean
  state TEXT NOT NULL DEFAULT 'idle',
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT, -- JSON
  CHECK (provider IN ('claude', 'gemini', 'openai')),
  CHECK (state IN ('idle', 'validating', 'requesting', 'streaming', 'rate_limited', 'retrying', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_provider_requests_provider ON provider_requests(provider);
CREATE INDEX IF NOT EXISTS idx_provider_requests_state ON provider_requests(state);
CREATE INDEX IF NOT EXISTS idx_provider_requests_created_at ON provider_requests(created_at);

-- Provider responses table
CREATE TABLE IF NOT EXISTS provider_responses (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  content TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  finish_reason TEXT,
  duration INTEGER NOT NULL, -- milliseconds
  cost REAL, -- USD
  created_at INTEGER NOT NULL,
  metadata TEXT, -- JSON
  FOREIGN KEY (request_id) REFERENCES provider_requests(id) ON DELETE CASCADE,
  CHECK (provider IN ('claude', 'gemini', 'openai'))
);

CREATE INDEX IF NOT EXISTS idx_provider_responses_request_id ON provider_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_provider_responses_provider ON provider_responses(provider);
CREATE INDEX IF NOT EXISTS idx_provider_responses_created_at ON provider_responses(created_at);

-- Provider metrics (aggregated)
CREATE TABLE IF NOT EXISTS provider_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0.0,
  avg_duration INTEGER, -- milliseconds
  p95_duration INTEGER, -- milliseconds
  p99_duration INTEGER, -- milliseconds
  date TEXT NOT NULL, -- YYYY-MM-DD
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (provider IN ('claude', 'gemini', 'openai')),
  UNIQUE(provider, model, date)
);

CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider ON provider_metrics(provider);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_date ON provider_metrics(date);

-- Provider health checks
CREATE TABLE IF NOT EXISTS provider_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  latency INTEGER, -- milliseconds
  rate_limit_remaining INTEGER,
  rate_limit_reset INTEGER, -- timestamp
  error_message TEXT,
  checked_at INTEGER NOT NULL,
  CHECK (provider IN ('claude', 'gemini', 'openai')),
  CHECK (status IN ('healthy', 'degraded', 'down'))
);

CREATE INDEX IF NOT EXISTS idx_provider_health_provider ON provider_health(provider);
CREATE INDEX IF NOT EXISTS idx_provider_health_checked_at ON provider_health(checked_at);

-- Stream chunks (for streaming responses)
CREATE TABLE IF NOT EXISTS stream_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES provider_requests(id) ON DELETE CASCADE,
  UNIQUE(request_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_stream_chunks_request_id ON stream_chunks(request_id);

-- Trigger to update provider_metrics on new response
CREATE TRIGGER IF NOT EXISTS update_provider_metrics_on_response
AFTER INSERT ON provider_responses
BEGIN
  INSERT INTO provider_metrics (
    provider, model, request_count, success_count, total_input_tokens,
    total_output_tokens, total_cost, date, created_at, updated_at
  )
  VALUES (
    NEW.provider,
    NEW.model,
    1,
    CASE WHEN NEW.finish_reason IN ('stop', 'length') THEN 1 ELSE 0 END,
    NEW.input_tokens,
    NEW.output_tokens,
    COALESCE(NEW.cost, 0.0),
    DATE(NEW.created_at / 1000, 'unixepoch'),
    NEW.created_at,
    NEW.created_at
  )
  ON CONFLICT(provider, model, date) DO UPDATE SET
    request_count = request_count + 1,
    success_count = success_count + CASE WHEN NEW.finish_reason IN ('stop', 'length') THEN 1 ELSE 0 END,
    total_input_tokens = total_input_tokens + NEW.input_tokens,
    total_output_tokens = total_output_tokens + NEW.output_tokens,
    total_cost = total_cost + COALESCE(NEW.cost, 0.0),
    updated_at = NEW.created_at;
END;
```

**Estimated Lines:** ~130 lines

---

## Component 4: TypeScript Service Layer

### 4.1 ProviderRouter

**File:** `src/providers/ProviderRouter.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { ProviderStateMachine } from '../../packages/rescript-core/lib/js/src/providers/ProviderStateMachine.bs.js';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderRouterOptions,
  ProviderHealth,
} from '../types/schemas/provider.schema.js';
import {
  ProviderRequestSchema,
  ProviderRouterOptionsSchema,
} from '../types/schemas/provider.schema.js';
import { ClaudeProvider } from './ClaudeProvider.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { ProviderDAO } from '../database/dao/ProviderDAO.js';
import { Logger } from '../utils/Logger.js';

export class ProviderRouter {
  private claudeProvider: ClaudeProvider;
  private geminiProvider: GeminiProvider;
  private openaiProvider: OpenAIProvider;
  private dao: ProviderDAO;
  private options: ProviderRouterOptions;
  private circuitBreakers: Map<string, CircuitBreaker>;

  constructor(options: ProviderRouterOptions) {
    this.options = ProviderRouterOptionsSchema.parse(options);
    this.claudeProvider = new ClaudeProvider();
    this.geminiProvider = new GeminiProvider();
    this.openaiProvider = new OpenAIProvider();
    this.dao = new ProviderDAO();
    this.circuitBreakers = new Map();
  }

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    // Validate request
    const validatedRequest = ProviderRequestSchema.parse(request);
    const requestId = validatedRequest.requestId || uuidv4();

    // Create state machine
    const machine = ProviderStateMachine.createMachine(requestId);

    try {
      // Try primary provider
      const primaryProvider = this.getProvider(this.options.primaryProvider);
      const response = await this.executeWithProvider(
        primaryProvider,
        validatedRequest,
        machine
      );

      if (response) {
        return response;
      }

      // Fallback logic
      if (this.options.enableFallback) {
        for (const fallbackName of this.options.fallbackProviders) {
          Logger.warn(`Falling back to ${fallbackName}`);
          const fallbackProvider = this.getProvider(fallbackName);
          const fallbackResponse = await this.executeWithProvider(
            fallbackProvider,
            validatedRequest,
            machine
          );

          if (fallbackResponse) {
            return fallbackResponse;
          }
        }
      }

      throw new Error('All providers failed');
    } catch (error) {
      Logger.error('ProviderRouter execution failed', error);
      throw error;
    }
  }

  async stream(request: ProviderRequest): AsyncIterableIterator<string> {
    const validatedRequest = ProviderRequestSchema.parse({
      ...request,
      stream: true,
    });

    const provider = this.getProvider(this.options.primaryProvider);
    return provider.stream(validatedRequest);
  }

  async healthCheck(providerName: string): Promise<ProviderHealth> {
    const provider = this.getProvider(providerName);
    return provider.checkHealth();
  }

  private getProvider(name: string): ClaudeProvider | GeminiProvider | OpenAIProvider {
    switch (name) {
      case 'claude':
        return this.claudeProvider;
      case 'gemini':
        return this.geminiProvider;
      case 'openai':
        return this.openaiProvider;
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }

  private async executeWithProvider(
    provider: ClaudeProvider | GeminiProvider | OpenAIProvider,
    request: ProviderRequest,
    machine: any
  ): Promise<ProviderResponse | null> {
    // Check circuit breaker
    if (this.isCircuitOpen(provider.name)) {
      Logger.warn(`Circuit breaker open for ${provider.name}`);
      return null;
    }

    try {
      const response = await provider.execute(request);
      this.recordSuccess(provider.name);
      return response;
    } catch (error) {
      this.recordFailure(provider.name);
      Logger.error(`Provider ${provider.name} failed`, error);
      return null;
    }
  }

  private isCircuitOpen(providerName: string): boolean {
    if (!this.options.enableCircuitBreaker) {
      return false;
    }

    const breaker = this.circuitBreakers.get(providerName);
    return breaker ? breaker.isOpen() : false;
  }

  private recordSuccess(providerName: string): void {
    const breaker = this.getOrCreateCircuitBreaker(providerName);
    breaker.recordSuccess();
  }

  private recordFailure(providerName: string): void {
    const breaker = this.getOrCreateCircuitBreaker(providerName);
    breaker.recordFailure();
  }

  private getOrCreateCircuitBreaker(providerName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(providerName)) {
      this.circuitBreakers.set(
        providerName,
        new CircuitBreaker(
          this.options.circuitBreakerThreshold,
          this.options.circuitBreakerTimeout
        )
      );
    }
    return this.circuitBreakers.get(providerName)!;
  }
}

// Circuit breaker implementation
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number,
    private timeout: number
  ) {}

  isOpen(): boolean {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

**Estimated Lines:** ~200 lines

### 4.2 ClaudeProvider

**File:** `src/providers/ClaudeProvider.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderHealth,
} from '../types/schemas/provider.schema.js';
import { ProviderResponseSchema } from '../types/schemas/provider.schema.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { Logger } from '../utils/Logger.js';

export class ClaudeProvider {
  public readonly name = 'claude';
  private client: Anthropic;
  private config: any;

  constructor() {
    this.config = ConfigManager.get('providers.claude');
    this.client = new Anthropic({
      apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: request.model || this.config.defaultModel,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        messages: request.messages.map((msg) => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          content: msg.content,
        })),
      });

      const duration = Date.now() - startTime;

      const providerResponse: ProviderResponse = {
        requestId: request.requestId,
        provider: 'claude',
        model: response.model,
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        tokens: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: this.mapStopReason(response.stop_reason),
        duration,
        cost: this.calculateCost(response.usage, response.model),
        createdAt: Date.now(),
      };

      return ProviderResponseSchema.parse(providerResponse);
    } catch (error) {
      Logger.error('Claude provider error', error);
      throw error;
    }
  }

  async *stream(request: ProviderRequest): AsyncIterableIterator<string> {
    try {
      const stream = await this.client.messages.create({
        model: request.model || this.config.defaultModel,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        messages: request.messages.map((msg) => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          content: msg.content,
        })),
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } catch (error) {
      Logger.error('Claude streaming error', error);
      throw error;
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Simple health check with minimal tokens
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      return {
        provider: 'claude',
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    } catch (error: any) {
      return {
        provider: 'claude',
        status: error.status === 429 ? 'degraded' : 'down',
        latency: Date.now() - startTime,
        lastChecked: Date.now(),
      };
    }
  }

  private mapStopReason(reason: string | null): 'stop' | 'length' | 'content_filter' | undefined {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return undefined;
    }
  }

  private calculateCost(usage: { input_tokens: number; output_tokens: number }, model: string): number {
    // Claude 3.5 Sonnet pricing (as of 2024)
    const pricing = {
      'claude-3-5-sonnet-20241022': {
        input: 3.0 / 1_000_000, // $3 per million tokens
        output: 15.0 / 1_000_000, // $15 per million tokens
      },
      'claude-3-opus-20240229': {
        input: 15.0 / 1_000_000,
        output: 75.0 / 1_000_000,
      },
    };

    const modelPricing = pricing[model] || pricing['claude-3-5-sonnet-20241022'];
    return usage.input_tokens * modelPricing.input + usage.output_tokens * modelPricing.output;
  }
}
```

**Estimated Lines:** ~150 lines

### 4.3 GeminiProvider & OpenAIProvider

Similar implementations for Gemini and OpenAI providers (~150 lines each).

---

## Component 5: Testing Strategy

### 5.1 Unit Tests

**ReScript State Machine Tests:**
- State transitions (15 tests)
- Guard conditions (8 tests)
- Context updates (10 tests)

**Provider Tests:**
- ClaudeProvider (12 tests)
- GeminiProvider (12 tests)
- OpenAIProvider (12 tests)

### 5.2 Integration Tests

**ProviderRouter Tests:**
- Fallback logic (8 tests)
- Circuit breaker (5 tests)
- Rate limiting (5 tests)

### 5.3 Performance Tests

- First token latency (<2s target)
- Streaming throughput
- Concurrent request handling

**Total Tests:** 45+ tests

---

## Success Criteria

### Functional Requirements

- ✅ All 3 providers (Claude, Gemini, OpenAI) operational
- ✅ Automatic fallback working
- ✅ Streaming support for all providers
- ✅ Rate limiting enforced
- ✅ Circuit breaker preventing cascading failures

### Performance Requirements

- ✅ First token latency: <2 seconds (P95)
- ✅ Streaming latency: <100ms per chunk (P95)
- ✅ Router overhead: <50ms
- ✅ Database write latency: <10ms

### Quality Requirements

- ✅ 45+ tests passing (100%)
- ✅ Test coverage >85%
- ✅ Zero P0/P1 bugs
- ✅ Complete documentation

---

## Dependencies

### NPM Packages

```json
{
  "@anthropic-ai/sdk": "^0.20.0",
  "@google/generative-ai": "^0.5.0",
  "openai": "^4.28.0"
}
```

### Internal Dependencies

- Phase 1 Memory System (conversations, messages tables)
- Database connection and DAOs
- Zod validation schemas
- ReScript compiler and runtime

---

## Risk Analysis

### High-Priority Risks

**Risk 1: API Rate Limits**
- **Probability:** High
- **Impact:** Medium
- **Mitigation:** Implement robust rate limiting, use tiered API keys, implement queue system

**Risk 2: Provider API Changes**
- **Probability:** Low
- **Impact:** High
- **Mitigation:** Version pinning, comprehensive integration tests, provider abstraction layer

**Risk 3: Cost Overruns**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:** Cost tracking, usage alerts, token limits

---

## Documentation Deliverables

1. **API Reference**
   - ProviderRouter API
   - Individual provider APIs
   - Configuration options

2. **User Guide**
   - Provider setup
   - Configuration examples
   - Troubleshooting common issues

3. **Architecture Docs**
   - State machine diagram
   - Fallback flow diagram
   - Circuit breaker behavior

---

**Document Version:** 1.0
**Created:** 2025-11-10
**Status:** ✅ READY FOR IMPLEMENTATION
**Next Review:** 2025-12-28 (Phase 2 Gate Review)
