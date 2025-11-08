// Sprint 1 Day 5: Event Authentication
// Security Module: T3 Mitigation - Event Spoofing & Replay (High/P0)
//
// Purpose: Attach trace/span IDs to events and implement nonce-based replay detection
// Architecture: OpenTelemetry-compatible tracing + monotonic nonce tracking
// Compliance: Zero warnings required for merge

open Belt

// Trace context for OpenTelemetry compatibility
type traceContext = {
  traceId: string, // UUID v4 format
  spanId: string, // UUID v4 format
  timestamp: float, // Unix timestamp in milliseconds
}

// Authenticated event with trace context and nonce
type authenticatedEvent = {
  event: StateMachine.Event.t,
  traceContext: traceContext,
  nonce: int, // Monotonic sequence number
  signature: option<string>,
}

// Replay detection result
type replayResult =
  | Fresh
  | Replay(string)
  | InvalidNonce(string)

// Nonce state for replay detection
type nonceState = {
  mutable lastNonce: int,
  mutable processedNonces: array<int>,
  maxHistorySize: int,
}

// Create trace context
let createTraceContext = (
  ~traceId: string,
  ~spanId: string,
  ~timestamp: float,
): traceContext => {
  {
    traceId: traceId,
    spanId: spanId,
    timestamp: timestamp,
  }
}

// Create authenticated event
let createAuthenticatedEvent = (
  ~event: StateMachine.Event.t,
  ~traceContext: traceContext,
  ~nonce: int,
  ~signature: option<string>=?,
  (),
): authenticatedEvent => {
  {
    event: event,
    traceContext: traceContext,
    nonce: nonce,
    signature: signature,
  }
}

// Create nonce state for replay detection
let createNonceState = (~maxHistorySize: int=1000, ()): nonceState => {
  {
    lastNonce: 0,
    processedNonces: [],
    maxHistorySize: maxHistorySize,
  }
}

// Generate trace ID (UUID v4 format)
// Note: Actual UUID generation happens in TypeScript layer via FFI
type uuidGenerator = unit => string

// Attach trace context to event
let attachTraceContext = (
  _event: StateMachine.Event.t,
  generateUuid: uuidGenerator,
): traceContext => {
  let traceId = generateUuid()
  let spanId = generateUuid()
  let timestamp = Js.Date.now()

  createTraceContext(~traceId, ~spanId, ~timestamp)
}

// Check if nonce has been processed (replay detection)
let checkNonce = (state: nonceState, nonce: int): replayResult => {
  // Check if nonce is in processed history
  if Array.some(state.processedNonces, n => n == nonce) {
    Replay(`Nonce ${Int.toString(nonce)} already processed`)
  } else if nonce <= state.lastNonce {
    // Nonce must be strictly increasing
    InvalidNonce(
      `Nonce ${Int.toString(nonce)} is not greater than last nonce ${Int.toString(state.lastNonce)}`
    )
  } else {
    Fresh
  }
}

// Record nonce as processed
let recordNonce = (state: nonceState, nonce: int): unit => {
  // Add to processed history
  state.processedNonces = Array.concat(state.processedNonces, [nonce])

  // Trim history if exceeds max size
  if Array.length(state.processedNonces) > state.maxHistorySize {
    // Keep only recent nonces
    state.processedNonces = Array.sliceToEnd(
      state.processedNonces,
      Array.length(state.processedNonces) - state.maxHistorySize,
    )
  }

  // Update last nonce
  state.lastNonce = nonce
}

// Verify event authenticity
let verifyEvent = (
  authEvent: authenticatedEvent,
  nonceState: nonceState,
): result<authenticatedEvent, string> => {
  // Check nonce for replay detection
  switch checkNonce(nonceState, authEvent.nonce) {
  | Fresh => {
      // Record nonce
      recordNonce(nonceState, authEvent.nonce)
      Ok(authEvent)
    }
  | Replay(msg) => Error(`Replay attack detected: ${msg}`)
  | InvalidNonce(msg) => Error(`Invalid nonce: ${msg}`)
  }
}

// Create authenticated event from raw event
let authenticateEvent = (
  event: StateMachine.Event.t,
  nonce: int,
  generateUuid: uuidGenerator,
): authenticatedEvent => {
  let traceContext = attachTraceContext(event, generateUuid)

  createAuthenticatedEvent(
    ~event,
    ~traceContext,
    ~nonce,
    (),
  )
}

// Convert trace context to string for logging
let traceContextToString = (ctx: traceContext): string => {
  `TraceID=${ctx.traceId}, SpanID=${ctx.spanId}, Timestamp=${Float.toString(ctx.timestamp)}`
}

// Convert authenticated event to string for logging
let authenticatedEventToString = (authEvent: authenticatedEvent): string => {
  let eventStr = StateMachine.Event.toString(authEvent.event)
  let traceStr = traceContextToString(authEvent.traceContext)
  let nonceStr = Int.toString(authEvent.nonce)

  `Event=${eventStr}, ${traceStr}, Nonce=${nonceStr}`
}

// Helper: Convert replay result to string
let replayResultToString = (result: replayResult): string => {
  switch result {
  | Fresh => "Fresh"
  | Replay(msg) => `Replay(${msg})`
  | InvalidNonce(msg) => `InvalidNonce(${msg})`
  }
}

// Helper: Check if event is fresh (not a replay)
let isFresh = (result: replayResult): bool => {
  switch result {
  | Fresh => true
  | _ => false
  }
}

// Helper: Get nonce history count
let getNonceHistoryCount = (state: nonceState): int => {
  Array.length(state.processedNonces)
}

// Helper: Get last processed nonce
let getLastNonce = (state: nonceState): int => {
  state.lastNonce
}

// Helper: Clear nonce history (for testing)
let clearNonceHistory = (state: nonceState): unit => {
  state.processedNonces = []
  state.lastNonce = 0
}
