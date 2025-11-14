# revamp_v1 Phase 2: AI Provider Layer - Detailed Action Plan

**Project:** AutomatosX Revamp v1
**Phase:** Phase 2 - AI Provider Layer
**Duration:** 3 weeks (15 working days)
**Start Date:** December 8, 2025 (Monday)
**End Date:** December 28, 2025 (Saturday, working day)
**Team:** 2 backend developers + 1 QA engineer

---

## Overview

This document provides day-by-day execution plan for Phase 2, implementing multi-provider AI abstraction with Claude, Gemini, and OpenAI support. Following the ReScript + TypeScript + Zod architecture pattern established in Phase 1.

**Key Deliverables:**
- ReScript state machine for provider lifecycle (~450 lines)
- TypeScript provider implementations (~600 lines)
- Zod validation schemas (~150 lines)
- Database migration 009 (~130 lines)
- 45+ comprehensive tests
- Performance benchmarks and documentation

---

## Week 1: Foundation & ReScript State Machine

**Goals:**
- Complete ReScript state machine
- Define Zod schemas
- Create database migration
- Setup provider infrastructure

**Deliverables:**
- ProviderStateMachine.res (functional)
- provider.schema.ts (complete)
- Migration 009 (applied)
- 15+ tests passing

---

### Day 1 (Monday, Dec 8): ReScript State & Event Modules

**Time Allocation:** 8 hours

**Tasks:**

1. **Create ReScript Provider Module Structure** (1 hour)
   ```bash
   mkdir -p packages/rescript-core/src/providers
   touch packages/rescript-core/src/providers/ProviderStateMachine.res
   ```

2. **Implement State Module** (~1.5 hours)

   File: `packages/rescript-core/src/providers/ProviderStateMachine.res`

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

     let isTerminal = (state: t): bool => {
       switch state {
       | Completed | Failed => true
       | _ => false
       }
     }
   }
   ```

   **Lines:** ~50

3. **Implement Event Module** (~2 hours)

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

   **Lines:** ~70

4. **Update rescript.json Configuration** (30 min)

   File: `packages/rescript-core/rescript.json`

   ```json
   {
     "sources": [
       {
         "dir": "src/providers",
         "subdirs": true
       }
     ]
   }
   ```

5. **Build and Verify** (1 hour)
   ```bash
   cd packages/rescript-core
   npm run build
   # Verify .bs.js files generated
   ls lib/js/src/providers/
   ```

6. **Write Initial Tests** (2 hours)

   File: `packages/rescript-core/src/providers/__tests__/ProviderStateMachine_test.res`

   ```rescript
   open Vitest

   describe("State Module", () => {
     test("toString converts states correctly", () => {
       expect(State.toString(State.Idle))->toBe("idle")
       expect(State.toString(State.Validating))->toBe("validating")
       expect(State.toString(State.Completed))->toBe("completed")
       expect(State.toString(State.Failed))->toBe("failed")
     })

     test("fromString parses states correctly", () => {
       expect(State.fromString("idle"))->toEqual(Some(State.Idle))
       expect(State.fromString("requesting"))->toEqual(Some(State.Requesting))
       expect(State.fromString("invalid"))->toEqual(None)
     })

     test("isTerminal identifies terminal states", () => {
       expect(State.isTerminal(State.Completed))->toBe(true)
       expect(State.isTerminal(State.Failed))->toBe(true)
       expect(State.isTerminal(State.Requesting))->toBe(false)
     })
   })

   describe("Event Module", () => {
     test("toString converts events correctly", () => {
       expect(Event.toString(Event.ValidateRequest))->toBe("validate_request")
       expect(Event.toString(Event.SendRequest))->toBe("send_request")
     })
   })
   ```

   **Tests Written:** 6 tests

**End of Day Status:**
- ✅ State module complete (~50 lines)
- ✅ Event module complete (~70 lines)
- ✅ 6 tests passing
- ✅ ReScript building successfully

---

### Day 2 (Tuesday, Dec 9): Context & Transition Logic

**Time Allocation:** 8 hours

**Tasks:**

1. **Implement Context Module** (~2.5 hours)

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

   **Lines:** ~120

2. **Implement Guards Module** (~1.5 hours)

   ```rescript
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

     let hasProvider = (ctx: Context.t): bool => {
       switch ctx.provider {
       | Some(_) => true
       | None => false
       }
     }

     let isWithinTokenLimit = (ctx: Context.t): bool => {
       switch ctx.maxTokens {
       | Some(limit) => ctx.metrics.totalTokens <= limit
       | None => true
       }
     }
   }
   ```

   **Lines:** ~35

3. **Implement Machine Module (Part 1: Structure)** (~2 hours)

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

     let transition = (machine: t, event: Event.t): result<t, string> => {
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

       // More transitions will be added on Day 3
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

     let getState = (machine: t): State.t => machine.currentState
     let getContext = (machine: t): Context.t => machine.context
     let isTerminal = (machine: t): bool => State.isTerminal(machine.currentState)
     let getHistory = (machine: t): array<State.t> => machine.history
   }
   ```

   **Lines:** ~80 (partial implementation)

4. **Write Context and Guards Tests** (~2 hours)

   ```rescript
   describe("Context Module", () => {
     test("create initializes context correctly", () => {
       let ctx = Context.create("req-123")
       expect(ctx.requestId)->toBe("req-123")
       expect(ctx.retryCount)->toBe(0)
       expect(ctx.maxRetries)->toBe(3)
       expect(ctx.stream)->toBe(false)
     })

     test("updateProvider sets provider info", () => {
       let ctx = Context.create("req-123")
       let provider = {
         name: "claude",
         model: "claude-3-5-sonnet",
         priority: 1,
         available: true,
       }
       let updated = Context.updateProvider(ctx, provider)
       expect(updated.provider)->toEqual(Some(provider))
     })

     test("addStreamChunk appends to chunks", () => {
       let ctx = Context.create("req-123")
       let ctx1 = Context.addStreamChunk(ctx, "Hello")
       let ctx2 = Context.addStreamChunk(ctx1, " World")
       expect(Belt.Array.length(ctx2.streamChunks))->toBe(2)
       expect(ctx2.streamChunks)->toEqual(["Hello", " World"])
     })

     test("incrementRetry increases count", () => {
       let ctx = Context.create("req-123")
       let updated = Context.incrementRetry(ctx)
       expect(updated.retryCount)->toBe(1)
     })
   })

   describe("Guards Module", () => {
     test("canValidate requires messages", () => {
       let ctx = Context.create("req-123")
       expect(Guards.canValidate(ctx))->toBe(false)

       let withMessages = {...ctx, messages: [Js.Json.string("test")]}
       expect(Guards.canValidate(withMessages))->toBe(true)
     })

     test("canRetry respects max retries", () => {
       let ctx = Context.create("req-123")
       expect(Guards.canRetry(ctx))->toBe(true)

       let maxedOut = {...ctx, retryCount: 3}
       expect(Guards.canRetry(maxedOut))->toBe(false)
     })

     test("isStreamMode checks stream flag", () => {
       let ctx = Context.create("req-123")
       expect(Guards.isStreamMode(ctx))->toBe(false)

       let streaming = {...ctx, stream: true}
       expect(Guards.isStreamMode(streaming))->toBe(true)
     })
   })
   ```

   **Tests Written:** 10 tests

**End of Day Status:**
- ✅ Context module complete (~120 lines)
- ✅ Guards module complete (~35 lines)
- ✅ Machine module started (~80 lines partial)
- ✅ 16 tests passing (6 + 10)

---

### Day 3 (Wednesday, Dec 10): Complete State Machine & JavaScript Interop

**Time Allocation:** 8 hours

**Tasks:**

1. **Complete Machine Transition Logic** (~3 hours)

   Add remaining transitions:

   ```rescript
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
         Ok((State.Requesting, context))
       } else {
         Error("No fallback providers available")
       }

   // Completed → Idle (reset)
   | (State.Completed, Event.Reset) =>
       Ok((State.Idle, Context.create(context.requestId)))
   ```

   **Additional Lines:** ~70
   **Total Machine Lines:** ~150

2. **Add JavaScript Interop** (~1.5 hours)

   ```rescript
   // JavaScript interop exports
   @genType
   let createMachine = (requestId: string): Machine.t => {
     Machine.create(requestId)
   }

   @genType
   let transitionMachine = (
     machine: Machine.t,
     event: Event.t,
   ): result<Machine.t, string> => {
     Machine.transition(machine, event)
   }

   @genType
   let getMachineState = (machine: Machine.t): string => {
     State.toString(Machine.getState(machine))
   }

   @genType
   let getMachineContext = (machine: Machine.t): Context.t => {
     Machine.getContext(machine)
   }

   @genType
   let isMachineTerminal = (machine: Machine.t): bool => {
     Machine.isTerminal(machine)
   }

   @genType
   let getMachineHistory = (machine: Machine.t): array<string> => {
     Belt.Array.map(Machine.getHistory(machine), State.toString)
   }

   // Event constructors for JavaScript
   @genType
   let makeInitiateRequestEvent = (
     provider: string,
     model: string,
     messages: array<Js.Json.t>,
     maxTokens: option<int>,
     temperature: option<float>,
     stream: bool,
   ): Event.t => {
     Event.InitiateRequest({
       provider: provider,
       model: model,
       messages: messages,
       maxTokens: maxTokens,
       temperature: temperature,
       stream: stream,
     })
   }

   @genType
   let makeValidationPassedEvent = (): Event.t => Event.ValidationPassed

   @genType
   let makeReceiveResponseEvent = (
     content: string,
     inputTokens: int,
     outputTokens: int,
     totalTokens: int,
     duration: int,
   ): Event.t => {
     Event.ReceiveResponse({
       content: content,
       tokens: {
         "input": inputTokens,
         "output": outputTokens,
         "total": totalTokens,
       },
       duration: duration,
     })
   }

   @genType
   let makeStreamChunkEvent = (chunk: string, index: int): Event.t => {
     Event.ReceiveStreamChunk({chunk: chunk, index: index})
   }

   @genType
   let makeRequestFailedEvent = (error: string, code: option<string>): Event.t => {
     Event.RequestFailed({error: error, code: code})
   }
   ```

   **Lines:** ~85

3. **Build and Generate TypeScript Definitions** (~1 hour)
   ```bash
   cd packages/rescript-core
   npm run build

   # Verify generated files
   ls lib/js/src/providers/ProviderStateMachine.bs.js
   ls lib/js/src/providers/ProviderStateMachine.gen.tsx
   ```

4. **Write Transition Tests** (~2.5 hours)

   ```rescript
   describe("Machine Transitions", () => {
     test("Idle → Validating on InitiateRequest", () => {
       let machine = Machine.create("req-123")
       let event = Event.InitiateRequest({
         provider: "claude",
         model: "claude-3-5-sonnet",
         messages: [Js.Json.string("Hello")],
         maxTokens: Some(100),
         temperature: Some(1.0),
         stream: false,
       })

       let result = Machine.transition(machine, event)
       expect(result->Belt.Result.isOk)->toBe(true)

       switch result {
       | Ok(newMachine) => {
           expect(Machine.getState(newMachine))->toBe(State.Validating)
           expect(newMachine.context.model)->toEqual(Some("claude-3-5-sonnet"))
         }
       | Error(_) => ()
       }
     })

     test("Validating → Requesting on ValidationPassed", () => {
       let machine = Machine.create("req-123")
       let machine = {...machine, context: {
         ...machine.context,
         messages: [Js.Json.string("test")]
       }}
       let machine = {...machine, currentState: State.Validating}

       let result = Machine.transition(machine, Event.ValidationPassed)
       expect(result->Belt.Result.isOk)->toBe(true)

       switch result {
       | Ok(newMachine) =>
           expect(Machine.getState(newMachine))->toBe(State.Requesting)
       | Error(_) => ()
       }
     })

     test("Requesting → Completed on ReceiveResponse", () => {
       let machine = Machine.create("req-123")
       let machine = {...machine, currentState: State.Requesting}

       let event = Event.ReceiveResponse({
         content: "Hello from AI",
         tokens: {"input": 10, "output": 5, "total": 15},
         duration: 1000,
       })

       let result = Machine.transition(machine, event)
       switch result {
       | Ok(newMachine) => {
           expect(Machine.getState(newMachine))->toBe(State.Completed)
           expect(newMachine.context.response)->toEqual(Some("Hello from AI"))
           expect(newMachine.context.metrics.totalTokens)->toBe(15)
         }
       | Error(_) => ()
       }
     })

     test("RateLimited → Retrying with retry count", () => {
       let machine = Machine.create("req-123")
       let machine = {...machine, currentState: State.RateLimited}

       let result = Machine.transition(machine, Event.RetryRequest({attempt: 1}))
       switch result {
       | Ok(newMachine) => {
           expect(Machine.getState(newMachine))->toBe(State.Retrying)
           expect(newMachine.context.retryCount)->toBe(1)
         }
       | Error(_) => ()
       }
     })

     test("Any → Failed on RequestFailed", () => {
       let machine = Machine.create("req-123")
       let machine = {...machine, currentState: State.Requesting}

       let event = Event.RequestFailed({
         error: "API error",
         code: Some("RATE_LIMIT"),
       })

       let result = Machine.transition(machine, event)
       switch result {
       | Ok(newMachine) => {
           expect(Machine.getState(newMachine))->toBe(State.Failed)
           expect(newMachine.context.error)->toEqual(Some("API error"))
         }
       | Error(_) => ()
       }
     })

     test("Streaming flow: chunks → complete", () => {
       let machine = Machine.create("req-123")
       let machine = {...machine, context: {...machine.context, stream: true}}
       let machine = {...machine, currentState: State.Requesting}

       // First chunk
       let result1 = Machine.transition(
         machine,
         Event.ReceiveStreamChunk({chunk: "Hello", index: 0})
       )
       expect(result1->Belt.Result.isOk)->toBe(true)

       switch result1 {
       | Ok(m1) => {
           expect(Machine.getState(m1))->toBe(State.Streaming)

           // Second chunk
           let result2 = Machine.transition(
             m1,
             Event.ReceiveStreamChunk({chunk: " World", index: 1})
           )

           switch result2 {
           | Ok(m2) => {
               expect(Belt.Array.length(m2.context.streamChunks))->toBe(2)

               // Complete stream
               let result3 = Machine.transition(m2, Event.StreamComplete)
               switch result3 {
               | Ok(m3) => {
                   expect(Machine.getState(m3))->toBe(State.Completed)
                   expect(m3.context.response)->toEqual(Some("Hello World"))
                 }
               | Error(_) => ()
               }
             }
           | Error(_) => ()
           }
         }
       | Error(_) => ()
       }
     })
   })
   ```

   **Tests Written:** 9 tests

**End of Day Status:**
- ✅ Complete state machine with all transitions (~450 lines total)
- ✅ JavaScript interop exports (~85 lines)
- ✅ 25 tests passing (16 + 9)
- ✅ TypeScript definitions generated

---

### Day 4 (Thursday, Dec 11): Zod Schemas & Database Migration

**Time Allocation:** 8 hours

**Tasks:**

1. **Create Zod Schemas** (~2.5 hours)

   File: `src/types/schemas/provider.schema.ts`

   ```typescript
   import { z } from 'zod';

   export const ProviderConfigSchema = z.object({
     name: z.enum(['claude', 'gemini', 'openai']),
     enabled: z.boolean().default(true),
     priority: z.number().int().min(1).max(10).default(1),
     apiKey: z.string().min(1).optional(),
     baseUrl: z.string().url().optional(),
     timeout: z.number().int().positive().default(60000),
     maxRetries: z.number().int().nonnegative().default(3),
     rateLimits: z.object({
       requestsPerMinute: z.number().int().positive(),
       tokensPerMinute: z.number().int().positive().optional(),
     }),
     models: z.array(z.string()).min(1),
     defaultModel: z.string(),
   });

   export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

   export const MessageSchema = z.object({
     role: z.enum(['system', 'user', 'assistant']),
     content: z.string().min(1).max(1000000),
     name: z.string().optional(),
     metadata: z.record(z.string(), z.unknown()).optional(),
   });

   export type Message = z.infer<typeof MessageSchema>;

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

   export const TokenUsageSchema = z.object({
     inputTokens: z.number().int().nonnegative(),
     outputTokens: z.number().int().nonnegative(),
     totalTokens: z.number().int().nonnegative(),
   });

   export type TokenUsage = z.infer<typeof TokenUsageSchema>;

   export const ProviderResponseSchema = z.object({
     requestId: z.string().uuid(),
     provider: z.enum(['claude', 'gemini', 'openai']),
     model: z.string().min(1),
     content: z.string(),
     tokens: TokenUsageSchema,
     finishReason: z.enum(['stop', 'length', 'content_filter', 'tool_calls']).optional(),
     duration: z.number().int().nonnegative(),
     cost: z.number().nonnegative().optional(),
     metadata: z.record(z.string(), z.unknown()).optional(),
     createdAt: z.number().int().positive(),
   });

   export type ProviderResponse = z.infer<typeof ProviderResponseSchema>;

   export const StreamChunkSchema = z.object({
     requestId: z.string().uuid(),
     index: z.number().int().nonnegative(),
     chunk: z.string(),
     done: z.boolean().default(false),
     timestamp: z.number().int().positive(),
   });

   export type StreamChunk = z.infer<typeof StreamChunkSchema>;

   export const ProviderHealthSchema = z.object({
     provider: z.enum(['claude', 'gemini', 'openai']),
     status: z.enum(['healthy', 'degraded', 'down']),
     latency: z.number().nonnegative().optional(),
     rateLimitRemaining: z.number().int().nonnegative().optional(),
     rateLimitReset: z.number().int().positive().optional(),
     lastChecked: z.number().int().positive(),
   });

   export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

   export const RateLimitInfoSchema = z.object({
     limit: z.number().int().positive(),
     remaining: z.number().int().nonnegative(),
     reset: z.number().int().positive(),
     retryAfter: z.number().int().nonnegative().optional(),
   });

   export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;

   export const ProviderRouterOptionsSchema = z.object({
     primaryProvider: z.enum(['claude', 'gemini', 'openai']),
     fallbackProviders: z.array(z.enum(['claude', 'gemini', 'openai'])).default([]),
     enableFallback: z.boolean().default(true),
     enableCircuitBreaker: z.boolean().default(true),
     circuitBreakerThreshold: z.number().int().positive().default(5),
     circuitBreakerTimeout: z.number().int().positive().default(60000),
   });

   export type ProviderRouterOptions = z.infer<typeof ProviderRouterOptionsSchema>;

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

   **Lines:** ~150

2. **Create Database Migration** (~2 hours)

   File: `src/migrations/009_create_provider_tables.sql`

   (Use the complete SQL from the architecture PRD - ~130 lines)

3. **Create ProviderDAO** (~2.5 hours)

   File: `src/database/dao/ProviderDAO.ts`

   ```typescript
   import Database from 'better-sqlite3';
   import { getDatabase } from '../connection.js';
   import type { ProviderRequest, ProviderResponse } from '../../types/schemas/provider.schema.js';
   import { ProviderRequestSchema, ProviderResponseSchema } from '../../types/schemas/provider.schema.js';

   export class ProviderDAO {
     private db: Database.Database;

     constructor() {
       this.db = getDatabase();
     }

     async saveRequest(request: ProviderRequest): Promise<void> {
       const validated = ProviderRequestSchema.parse(request);

       const stmt = this.db.prepare(`
         INSERT INTO provider_requests (
           id, provider, model, messages, max_tokens, temperature,
           stream, state, retry_count, created_at, updated_at, metadata
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       `);

       stmt.run(
         validated.requestId,
         validated.provider,
         validated.model,
         JSON.stringify(validated.messages),
         validated.maxTokens || null,
         validated.temperature,
         validated.stream ? 1 : 0,
         'idle',
         0,
         Date.now(),
         Date.now(),
         JSON.stringify(validated.metadata || {})
       );
     }

     async updateRequestState(requestId: string, state: string): Promise<void> {
       const stmt = this.db.prepare(`
         UPDATE provider_requests
         SET state = ?, updated_at = ?
         WHERE id = ?
       `);

       stmt.run(state, Date.now(), requestId);
     }

     async saveResponse(response: ProviderResponse): Promise<void> {
       const validated = ProviderResponseSchema.parse(response);

       const stmt = this.db.prepare(`
         INSERT INTO provider_responses (
           id, request_id, provider, model, content,
           input_tokens, output_tokens, total_tokens,
           finish_reason, duration, cost, created_at, metadata
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       `);

       stmt.run(
         validated.requestId,
         validated.requestId,
         validated.provider,
         validated.model,
         validated.content,
         validated.tokens.inputTokens,
         validated.tokens.outputTokens,
         validated.tokens.totalTokens,
         validated.finishReason || null,
         validated.duration,
         validated.cost || null,
         validated.createdAt,
         JSON.stringify(validated.metadata || {})
       );
     }

     async saveStreamChunk(requestId: string, chunkIndex: number, content: string): Promise<void> {
       const stmt = this.db.prepare(`
         INSERT INTO stream_chunks (request_id, chunk_index, chunk_content, timestamp)
         VALUES (?, ?, ?, ?)
       `);

       stmt.run(requestId, chunkIndex, content, Date.now());
     }

     async getProviderMetrics(provider: string, date: string): Promise<any> {
       const stmt = this.db.prepare(`
         SELECT * FROM provider_metrics
         WHERE provider = ? AND date = ?
       `);

       return stmt.get(provider, date);
     }

     async getProviderHealth(provider: string): Promise<any> {
       const stmt = this.db.prepare(`
         SELECT * FROM provider_health
         WHERE provider = ?
         ORDER BY checked_at DESC
         LIMIT 1
       `);

       return stmt.get(provider);
     }

     async saveHealthCheck(
       provider: string,
       status: string,
       latency?: number,
       errorMessage?: string
     ): Promise<void> {
       const stmt = this.db.prepare(`
         INSERT INTO provider_health (provider, status, latency, error_message, checked_at)
         VALUES (?, ?, ?, ?, ?)
       `);

       stmt.run(provider, status, latency || null, errorMessage || null, Date.now());
     }
   }
   ```

   **Lines:** ~120

4. **Write Schema and DAO Tests** (~1 hour)

   File: `src/__tests__/database/dao/ProviderDAO.test.ts`

   ```typescript
   import { describe, test, expect, beforeEach } from 'vitest';
   import { ProviderDAO } from '../../../database/dao/ProviderDAO.js';
   import { v4 as uuidv4 } from 'uuid';

   describe('ProviderDAO', () => {
     let dao: ProviderDAO;

     beforeEach(() => {
       dao = new ProviderDAO();
     });

     test('saveRequest stores request in database', async () => {
       const request = {
         requestId: uuidv4(),
         provider: 'claude' as const,
         model: 'claude-3-5-sonnet',
         messages: [{ role: 'user' as const, content: 'Hello' }],
         temperature: 1.0,
         stream: false,
       };

       await dao.saveRequest(request);

       // Verify saved (would need getRequest method)
     });

     test('updateRequestState changes state', async () => {
       const requestId = uuidv4();
       const request = {
         requestId,
         provider: 'claude' as const,
         model: 'claude-3-5-sonnet',
         messages: [{ role: 'user' as const, content: 'Hello' }],
         temperature: 1.0,
         stream: false,
       };

       await dao.saveRequest(request);
       await dao.updateRequestState(requestId, 'requesting');

       // Verify state updated
     });

     test('saveResponse stores response data', async () => {
       const response = {
         requestId: uuidv4(),
         provider: 'claude' as const,
         model: 'claude-3-5-sonnet',
         content: 'Hello from Claude',
         tokens: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
         duration: 1000,
         createdAt: Date.now(),
       };

       await dao.saveResponse(response);
     });
   });
   ```

   **Tests Written:** 3 tests

**End of Day Status:**
- ✅ Zod schemas complete (~150 lines)
- ✅ Migration 009 complete (~130 lines)
- ✅ ProviderDAO complete (~120 lines)
- ✅ 28 tests passing (25 + 3)

---

### Day 5 (Friday, Dec 12): Week 1 Integration & Code Review

**Time Allocation:** 8 hours

**Tasks:**

1. **Apply Migration** (30 min)
   ```bash
   npm run build:typescript
   node -e "import('./dist/database/migrations.js').then(m => m.runMigrations())"
   ```

2. **Create TypeScript Integration Test** (~2 hours)

   File: `src/__tests__/providers/state-machine-integration.test.ts`

   ```typescript
   import { describe, test, expect } from 'vitest';
   import {
     createMachine,
     transitionMachine,
     getMachineState,
     getMachineContext,
     makeInitiateRequestEvent,
     makeValidationPassedEvent,
     makeReceiveResponseEvent,
   } from '../../../packages/rescript-core/lib/js/src/providers/ProviderStateMachine.bs.js';

   describe('Provider State Machine Integration', () => {
     test('complete request lifecycle', () => {
       // Create machine
       const machine = createMachine('req-123');
       expect(getMachineState(machine)).toBe('idle');

       // Initiate request
       const initiateEvent = makeInitiateRequestEvent(
         'claude',
         'claude-3-5-sonnet',
         [JSON.stringify({ role: 'user', content: 'Hello' })],
         100,
         1.0,
         false
       );

       const machine1 = transitionMachine(machine, initiateEvent);
       expect(machine1.TAG).toBe(0); // Ok
       if (machine1.TAG === 0) {
         expect(getMachineState(machine1._0)).toBe('validating');

         // Validation passed
         const validationEvent = makeValidationPassedEvent();
         const machine2 = transitionMachine(machine1._0, validationEvent);

         if (machine2.TAG === 0) {
           expect(getMachineState(machine2._0)).toBe('requesting');

           // Receive response
           const responseEvent = makeReceiveResponseEvent(
             'Hello from Claude',
             10,
             5,
             15,
             1000
           );

           const machine3 = transitionMachine(machine2._0, responseEvent);
           if (machine3.TAG === 0) {
             expect(getMachineState(machine3._0)).toBe('completed');

             const context = getMachineContext(machine3._0);
             expect(context.response).toBe('Hello from Claude');
             expect(context.metrics.totalTokens).toBe(15);
           }
         }
       }
     });

     test('streaming request lifecycle', () => {
       const machine = createMachine('req-456');

       // Test streaming flow
       // ... similar to above but with stream: true
     });

     test('retry on rate limit', () => {
       // Test rate limit → retry flow
     });

     test('fallback on provider failure', () => {
       // Test failed → fallback flow
     });
   });
   ```

   **Tests Written:** 4 tests

3. **Run All Tests** (1 hour)
   ```bash
   # Run ReScript tests
   cd packages/rescript-core
   npm test

   # Run TypeScript tests
   cd ../..
   npm test -- src/__tests__/providers/
   npm test -- src/__tests__/database/dao/ProviderDAO.test.ts
   ```

4. **Code Review Prep** (1.5 hours)
   - Clean up code formatting
   - Add JSDoc comments
   - Update inline documentation
   - Prepare PR description

5. **Team Code Review** (2 hours)
   - Present state machine architecture
   - Walk through transitions
   - Review Zod schemas
   - Discuss DAO implementation

6. **Weekly Progress Report** (1 hour)

   File: `automatosx/tmp/revamp_v1-phase2-week1-progress.md`

   ```markdown
   # revamp_v1 Phase 2 - Week 1 Progress Report

   **Week:** December 8-12, 2025
   **Status:** ✅ Complete

   ## Deliverables

   1. ✅ ReScript State Machine (~450 lines)
      - State, Event, Context, Guards, Machine modules
      - Complete transition logic
      - JavaScript interop exports

   2. ✅ Zod Validation Schemas (~150 lines)
      - 10 schemas for provider interactions
      - Type inference for TypeScript

   3. ✅ Database Migration 009 (~130 lines)
      - 5 new tables
      - Automatic metrics aggregation

   4. ✅ ProviderDAO (~120 lines)
      - Request/response tracking
      - Stream chunk storage
      - Health check logging

   ## Test Results

   - Total Tests: 32 passing
     - ReScript: 25 tests
     - TypeScript: 7 tests
   - Test Coverage: ~90%
   - Performance: All tests <100ms

   ## Next Week

   - Implement ProviderRouter
   - Create ClaudeProvider
   - Start GeminiProvider
   - Target: 15 additional tests
   ```

**End of Day Status:**
- ✅ Week 1 complete (all deliverables)
- ✅ 32 tests passing
- ✅ Code reviewed and approved
- ✅ Progress report created

---

## Week 2: Provider Implementations

**Goals:**
- Implement ProviderRouter with fallback logic
- Complete ClaudeProvider with streaming
- Complete GeminiProvider
- Start OpenAIProvider

**Deliverables:**
- ProviderRouter.ts (~250 lines)
- ClaudeProvider.ts (~150 lines)
- GeminiProvider.ts (~150 lines)
- OpenAIProvider.ts (partial ~100 lines)
- 15+ tests passing (cumulative 47)

---

### Day 6 (Monday, Dec 15): ProviderRouter Core

**Time Allocation:** 8 hours

**Tasks:**

1. **Install Provider SDKs** (30 min)
   ```bash
   npm install @anthropic-ai/sdk@^0.20.0
   npm install @google/generative-ai@^0.5.0
   npm install openai@^4.28.0
   ```

2. **Create ProviderRouter** (~4 hours)

   File: `src/providers/ProviderRouter.ts`

   ```typescript
   import { v4 as uuidv4 } from 'uuid';
   import type {
     ProviderRequest,
     ProviderResponse,
     ProviderRouterOptions,
   } from '../types/schemas/provider.schema.js';
   import {
     ProviderRequestSchema,
     ProviderRouterOptionsSchema,
   } from '../types/schemas/provider.schema.js';
   import { ClaudeProvider } from './ClaudeProvider.js';
   import { GeminiProvider } from './GeminiProvider.js';
   import { OpenAIProvider } from './OpenAIProvider.js';
   import { Logger } from '../utils/Logger.js';

   export class ProviderRouter {
     private claudeProvider: ClaudeProvider;
     private geminiProvider: GeminiProvider;
     private openaiProvider: OpenAIProvider;
     private options: ProviderRouterOptions;
     private circuitBreakers: Map<string, CircuitBreaker>;

     constructor(options: ProviderRouterOptions) {
       this.options = ProviderRouterOptionsSchema.parse(options);
       this.claudeProvider = new ClaudeProvider();
       this.geminiProvider = new GeminiProvider();
       this.openaiProvider = new OpenAIProvider();
       this.circuitBreakers = new Map();
     }

     async execute(request: ProviderRequest): Promise<ProviderResponse> {
       const validatedRequest = ProviderRequestSchema.parse(request);
       const requestId = validatedRequest.requestId || uuidv4();

       try {
         const primaryProvider = this.getProvider(this.options.primaryProvider);
         const response = await this.executeWithProvider(
           primaryProvider,
           validatedRequest
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
               validatedRequest
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
       request: ProviderRequest
     ): Promise<ProviderResponse | null> {
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

   **Lines:** ~180

3. **Write ProviderRouter Tests** (~2.5 hours)

   File: `src/__tests__/providers/ProviderRouter.test.ts`

   ```typescript
   import { describe, test, expect, beforeEach, vi } from 'vitest';
   import { ProviderRouter } from '../../providers/ProviderRouter.js';
   import { v4 as uuidv4 } from 'uuid';

   describe('ProviderRouter', () => {
     let router: ProviderRouter;

     beforeEach(() => {
       router = new ProviderRouter({
         primaryProvider: 'claude',
         fallbackProviders: ['gemini', 'openai'],
         enableFallback: true,
         enableCircuitBreaker: true,
         circuitBreakerThreshold: 5,
         circuitBreakerTimeout: 60000,
       });
     });

     test('constructor creates router with options', () => {
       expect(router).toBeDefined();
     });

     test('execute uses primary provider', async () => {
       const request = {
         requestId: uuidv4(),
         provider: 'claude' as const,
         model: 'claude-3-5-sonnet',
         messages: [{ role: 'user' as const, content: 'Hello' }],
         temperature: 1.0,
         stream: false,
       };

       // Mock would be needed for actual execution
     });

     test('circuit breaker opens after threshold failures', async () => {
       // Test circuit breaker behavior
     });

     test('falls back to secondary provider on failure', async () => {
       // Test fallback logic
     });
   });
   ```

   **Tests Written:** 4 tests (stubs)

4. **Create Provider Interface** (1 hour)

   File: `src/providers/Provider.ts`

   ```typescript
   import type {
     ProviderRequest,
     ProviderResponse,
     ProviderHealth,
   } from '../types/schemas/provider.schema.js';

   export interface Provider {
     readonly name: string;
     execute(request: ProviderRequest): Promise<ProviderResponse>;
     stream(request: ProviderRequest): AsyncIterableIterator<string>;
     checkHealth(): Promise<ProviderHealth>;
   }
   ```

**End of Day Status:**
- ✅ ProviderRouter core complete (~180 lines)
- ✅ Provider interface defined
- ✅ Circuit breaker implemented
- ✅ 4 router tests (stubs)

---

### Days 7-10: Provider Implementations

**(Detailed breakdown would continue with ClaudeProvider, GeminiProvider, OpenAIProvider implementations - similar granularity to Days 1-6)**

**Day 7:** ClaudeProvider (execute + checkHealth)
**Day 8:** ClaudeProvider (streaming + tests)
**Day 9:** GeminiProvider (complete implementation)
**Day 10:** Week 2 integration testing

**Week 2 End Status:**
- ✅ ProviderRouter complete
- ✅ ClaudeProvider complete (~150 lines)
- ✅ GeminiProvider complete (~150 lines)
- ✅ OpenAIProvider started (~100 lines)
- ✅ 47 tests passing

---

## Week 3: Completion & Testing

**Goals:**
- Complete OpenAIProvider
- Integration testing
- Performance benchmarks
- Documentation
- Phase gate preparation

**Deliverables:**
- OpenAIProvider.ts (complete ~150 lines)
- Integration test suite (10 tests)
- Performance report
- API documentation
- Phase 2 completion report

---

### Days 11-15: Final Implementation & Testing

**(Similar detailed breakdown for final week)**

**Day 11:** Complete OpenAIProvider
**Day 12:** Integration tests (provider fallback, circuit breaker)
**Day 13:** Performance testing and optimization
**Day 14:** Documentation (API reference, user guide)
**Day 15:** Phase gate review and approval

---

## Summary

**Total Deliverables:**
- **ReScript Code:** ~450 lines (state machine)
- **TypeScript Code:** ~850 lines (router + 3 providers + DAOs)
- **Zod Schemas:** ~150 lines
- **SQL:** ~130 lines (migration)
- **Tests:** 45+ tests
- **Documentation:** Architecture PRD, API reference, user guide

**Performance Targets:**
- ✅ First token latency: <2s (P95)
- ✅ Router overhead: <50ms
- ✅ Circuit breaker: <10ms decision time

**Quality Metrics:**
- ✅ Test coverage: >85%
- ✅ All tests passing: 100%
- ✅ Zero P0/P1 bugs

---

**Document Version:** 1.0
**Created:** 2025-11-10
**Status:** ✅ READY FOR EXECUTION
**Phase Gate:** 2025-12-28
