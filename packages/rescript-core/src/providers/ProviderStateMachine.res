/**
 * ProviderStateMachine.res
 *
 * ReScript state machine for AI provider request lifecycle management.
 * Provides deterministic state transitions with type safety.
 *
 * Phase 2 Week 1 Day 1: State and Event Modules
 */

// ============================================================================
// State Module
// ============================================================================

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

  let canTransitionTo = (from: t, to: t): bool => {
    switch (from, to) {
    // From Idle
    | (Idle, Validating) => true

    // From Validating
    | (Validating, Requesting) => true
    | (Validating, Failed) => true

    // From Requesting
    | (Requesting, Streaming) => true
    | (Requesting, Completed) => true
    | (Requesting, RateLimited) => true
    | (Requesting, Failed) => true

    // From Streaming
    | (Streaming, Completed) => true
    | (Streaming, Failed) => true

    // From RateLimited
    | (RateLimited, Retrying) => true
    | (RateLimited, Failed) => true

    // From Retrying
    | (Retrying, Requesting) => true
    | (Retrying, Failed) => true

    // From terminal states
    | (Completed, Idle) => true
    | (Failed, Idle) => true

    // All other transitions are invalid
    | _ => false
    }
  }
}

// ============================================================================
// Event Module
// ============================================================================

module Event = {
  type providerRequest = {
    provider: string,
    model: string,
    messages: array<Js.Json.t>,
    maxTokens: option<int>,
    temperature: option<float>,
    stream: bool,
  }

  type responseData = {
    content: string,
    tokens: {
      "input": int,
      "output": int,
      "total": int,
    },
    duration: int,
  }

  type streamChunk = {
    chunk: string,
    index: int,
  }

  type rateLimitInfo = {
    retryAfter: int,
  }

  type retryInfo = {
    attempt: int,
  }

  type errorInfo = {
    error: string,
    code: option<string>,
  }

  type fallbackInfo = {
    provider: string,
  }

  type t =
    | InitiateRequest(providerRequest)
    | ValidateRequest
    | ValidationPassed
    | ValidationFailed({reason: string})
    | SendRequest
    | ReceiveResponse(responseData)
    | ReceiveStreamChunk(streamChunk)
    | StreamComplete
    | RateLimitHit(rateLimitInfo)
    | RetryRequest(retryInfo)
    | RequestFailed(errorInfo)
    | FallbackToProvider(fallbackInfo)
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

  let isSystemEvent = (event: t): bool => {
    switch event {
    | ValidateRequest | SendRequest | Complete | Reset => true
    | _ => false
    }
  }

  let isUserEvent = (event: t): bool => {
    switch event {
    | InitiateRequest(_) => true
    | _ => false
    }
  }

  let isProviderEvent = (event: t): bool => {
    switch event {
    | ReceiveResponse(_)
    | ReceiveStreamChunk(_)
    | StreamComplete
    | RateLimitHit(_)
    | RequestFailed(_) => true
    | _ => false
    }
  }
}

// ============================================================================
// Context Module
// ============================================================================

module Context = {
  type providerInfo = {
    provider: string,
    model: string,
    fallbackProvider: option<string>,
  }

  type requestMetrics = {
    startTime: float,
    endTime: option<float>,
    firstTokenLatency: option<float>,
    totalDuration: option<float>,
    tokenCount: {
      "input": int,
      "output": int,
      "total": int,
    },
  }

  type retryState = {
    currentAttempt: int,
    maxAttempts: int,
    lastError: option<string>,
  }

  type streamState = {
    chunksReceived: int,
    totalChunks: option<int>,
    streamStartTime: option<float>,
  }

  type metadata = {
    requestId: string,
    conversationId: option<string>,
    userId: option<string>,
    tags: array<string>,
  }

  type t = {
    state: State.t,
    providerInfo: providerInfo,
    metrics: requestMetrics,
    retryState: retryState,
    streamState: streamState,
    metadata: metadata,
    lastEvent: option<Event.t>,
    history: array<State.t>,
  }

  let create = (
    ~provider: string,
    ~model: string,
    ~requestId: string,
    ~conversationId: option<string>=?,
    ~userId: option<string>=?,
    ~maxAttempts: int=3,
    (),
  ): t => {
    state: State.Idle,
    providerInfo: {
      provider,
      model,
      fallbackProvider: None,
    },
    metrics: {
      startTime: Js.Date.now(),
      endTime: None,
      firstTokenLatency: None,
      totalDuration: None,
      tokenCount: {
        "input": 0,
        "output": 0,
        "total": 0,
      },
    },
    retryState: {
      currentAttempt: 0,
      maxAttempts,
      lastError: None,
    },
    streamState: {
      chunksReceived: 0,
      totalChunks: None,
      streamStartTime: None,
    },
    metadata: {
      requestId,
      conversationId,
      userId,
      tags: [],
    },
    lastEvent: None,
    history: [State.Idle],
  }

  let getCurrentState = (ctx: t): State.t => ctx.state

  let getProviderInfo = (ctx: t): providerInfo => ctx.providerInfo

  let getMetrics = (ctx: t): requestMetrics => ctx.metrics

  let getRetryState = (ctx: t): retryState => ctx.retryState

  let getStreamState = (ctx: t): streamState => ctx.streamState

  let getMetadata = (ctx: t): metadata => ctx.metadata

  let isRetryable = (ctx: t): bool => {
    ctx.retryState.currentAttempt < ctx.retryState.maxAttempts
  }

  let shouldFallback = (ctx: t): bool => {
    !isRetryable(ctx) && Belt.Option.isSome(ctx.providerInfo.fallbackProvider)
  }

  let getDuration = (ctx: t): option<float> => {
    switch ctx.metrics.endTime {
    | Some(endTime) => Some(endTime -. ctx.metrics.startTime)
    | None => None
    }
  }

  let addTag = (ctx: t, tag: string): t => {
    {
      ...ctx,
      metadata: {
        ...ctx.metadata,
        tags: Belt.Array.concat(ctx.metadata.tags, [tag]),
      },
    }
  }

  let setFallbackProvider = (ctx: t, fallbackProvider: string): t => {
    {
      ...ctx,
      providerInfo: {
        ...ctx.providerInfo,
        fallbackProvider: Some(fallbackProvider),
      },
    }
  }

  let updateMetrics = (
    ctx: t,
    ~firstTokenLatency: option<float>=?,
    ~tokenCount: option<{"input": int, "output": int, "total": int}>=?,
    (),
  ): t => {
    let updatedMetrics = {
      ...ctx.metrics,
      firstTokenLatency: switch firstTokenLatency {
      | Some(_) as flt => flt
      | None => ctx.metrics.firstTokenLatency
      },
      tokenCount: switch tokenCount {
      | Some(tc) => tc
      | None => ctx.metrics.tokenCount
      },
    }
    {...ctx, metrics: updatedMetrics}
  }

  let recordStreamChunk = (ctx: t): t => {
    let now = Js.Date.now()
    let streamStartTime = switch ctx.streamState.streamStartTime {
    | Some(time) => Some(time)
    | None => Some(now)
    }

    {
      ...ctx,
      streamState: {
        ...ctx.streamState,
        chunksReceived: ctx.streamState.chunksReceived + 1,
        streamStartTime,
      },
      metrics: {
        ...ctx.metrics,
        firstTokenLatency: switch ctx.metrics.firstTokenLatency {
        | Some(_) as latency => latency
        | None => Some(now -. ctx.metrics.startTime)
        },
      },
    }
  }

  let incrementRetry = (ctx: t, error: string): t => {
    {
      ...ctx,
      retryState: {
        ...ctx.retryState,
        currentAttempt: ctx.retryState.currentAttempt + 1,
        lastError: Some(error),
      },
    }
  }

  let completeRequest = (ctx: t): t => {
    let now = Js.Date.now()
    {
      ...ctx,
      metrics: {
        ...ctx.metrics,
        endTime: Some(now),
        totalDuration: Some(now -. ctx.metrics.startTime),
      },
    }
  }
}

// ============================================================================
// Transition Module
// ============================================================================

module Transition = {
  type transitionResult =
    | Success(Context.t)
    | InvalidTransition({from: State.t, to: State.t, event: Event.t})
    | InvalidState({state: State.t, event: Event.t})

  let applyEvent = (ctx: Context.t, event: Event.t): transitionResult => {
    let currentState = ctx.state

    // Determine target state based on event
    let targetState = switch (currentState, event) {
    // Idle → Validating
    | (State.Idle, Event.InitiateRequest(_)) => Some(State.Validating)

    // Validating → Requesting | Failed
    | (State.Validating, Event.ValidationPassed) => Some(State.Requesting)
    | (State.Validating, Event.ValidationFailed(_)) => Some(State.Failed)

    // Requesting → Streaming | Completed | RateLimited | Failed
    | (State.Requesting, Event.ReceiveResponse(_)) => Some(State.Completed)
    | (State.Requesting, Event.ReceiveStreamChunk(_)) => Some(State.Streaming)
    | (State.Requesting, Event.RateLimitHit(_)) => Some(State.RateLimited)
    | (State.Requesting, Event.RequestFailed(_)) => Some(State.Failed)

    // Streaming → Completed | Failed
    | (State.Streaming, Event.StreamComplete) => Some(State.Completed)
    | (State.Streaming, Event.RequestFailed(_)) => Some(State.Failed)
    | (State.Streaming, Event.ReceiveStreamChunk(_)) => Some(State.Streaming) // Stay in streaming

    // RateLimited → Retrying | Failed
    | (State.RateLimited, Event.RetryRequest(_)) => Some(State.Retrying)
    | (State.RateLimited, Event.RequestFailed(_)) => Some(State.Failed)

    // Retrying → Requesting | Failed
    | (State.Retrying, Event.SendRequest) => Some(State.Requesting)
    | (State.Retrying, Event.RequestFailed(_)) => Some(State.Failed)

    // Completed → Idle
    | (State.Completed, Event.Reset) => Some(State.Idle)

    // Failed → Idle
    | (State.Failed, Event.Reset) => Some(State.Idle)
    | (State.Failed, Event.FallbackToProvider(_)) => Some(State.Validating) // Fallback restarts validation

    // System events that don't change state
    | (State.Validating, Event.ValidateRequest) => Some(State.Validating)
    | (State.Requesting, Event.SendRequest) => Some(State.Requesting)
    | (_, Event.Complete) when State.isTerminal(currentState) => Some(currentState)

    // Invalid event for current state
    | _ => None
    }

    switch targetState {
    | None => InvalidState({state: currentState, event})
    | Some(newState) =>
      if State.canTransitionTo(currentState, newState) {
        // Apply state change and update context
        let updatedCtx = {
          ...ctx,
          state: newState,
          lastEvent: Some(event),
          history: Belt.Array.concat(ctx.history, [newState]),
        }

        // Apply event-specific side effects
        let finalCtx = switch event {
        | Event.ReceiveResponse(data) =>
          let withMetrics = Context.updateMetrics(
            updatedCtx,
            ~tokenCount=data.tokens,
            (),
          )
          Context.completeRequest(withMetrics)

        | Event.ReceiveStreamChunk(_) => Context.recordStreamChunk(updatedCtx)

        | Event.StreamComplete => Context.completeRequest(updatedCtx)

        | Event.RateLimitHit(_) => Context.addTag(updatedCtx, "rate_limited")

        | Event.RetryRequest(_) =>
          switch ctx.retryState.lastError {
          | Some(error) => Context.incrementRetry(updatedCtx, error)
          | None => Context.incrementRetry(updatedCtx, "unknown_error")
          }

        | Event.RequestFailed(errorInfo) =>
          let withRetry = Context.incrementRetry(updatedCtx, errorInfo.error)
          Context.addTag(withRetry, "failed")

        | Event.FallbackToProvider(fallbackInfo) =>
          let withFallback = Context.setFallbackProvider(updatedCtx, fallbackInfo.provider)
          Context.addTag(withFallback, "fallback")

        | Event.ValidationFailed(_) => Context.addTag(updatedCtx, "validation_failed")

        | _ => updatedCtx
        }

        Success(finalCtx)
      } else {
        InvalidTransition({from: currentState, to: newState, event})
      }
    }
  }

  let transition = (ctx: Context.t, event: Event.t): transitionResult => {
    applyEvent(ctx, event)
  }

  let transitionBatch = (
    ctx: Context.t,
    events: array<Event.t>,
  ): result<Context.t, transitionResult> => {
    let rec processEvents = (currentCtx: Context.t, remainingEvents: array<Event.t>) => {
      switch Belt.Array.get(remainingEvents, 0) {
      | None => Ok(currentCtx)
      | Some(event) =>
        switch applyEvent(currentCtx, event) {
        | Success(newCtx) => processEvents(newCtx, Belt.Array.sliceToEnd(remainingEvents, 1))
        | InvalidTransition(_) as err => Error(err)
        | InvalidState(_) as err => Error(err)
        }
      }
    }

    processEvents(ctx, events)
  }

  let canApplyEvent = (ctx: Context.t, event: Event.t): bool => {
    switch applyEvent(ctx, event) {
    | Success(_) => true
    | InvalidTransition(_) | InvalidState(_) => false
    }
  }

  let resultToString = (result: transitionResult): string => {
    switch result {
    | Success(ctx) => `Success: transitioned to ${State.toString(ctx.state)}`
    | InvalidTransition({from, to, event}) =>
      `InvalidTransition: cannot transition from ${State.toString(from)} to ${State.toString(
          to,
        )} on event ${Event.toString(event)}`
    | InvalidState({state, event}) =>
      `InvalidState: event ${Event.toString(event)} is invalid for state ${State.toString(state)}`
    }
  }
}
