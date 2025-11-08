// Sprint 1 Day 1: Event Dispatcher
// RE2: Event dispatcher that routes all events to stub handlers with placeholder effects
//
// Purpose: Dispatch runtime events to registered handlers with effect management
// Architecture: Event-driven runtime with typed event routing and effect isolation
// Compliance: Zero warnings required for merge

// Import state machine types
open StateMachine

// Effect type representing side effects that handlers may trigger
type effect =
  | NoEffect
  | LogEvent(string)
  | EmitTelemetry(string, Js.Json.t)
  | UpdatePersistence(string, Js.Json.t)
  | TriggerCallback(unit => unit)

// Handler result containing new state and effects to execute
type handlerResult = {
  newState: state,
  effects: array<effect>,
}

// Event handler function type
type eventHandler = (state, event) => handlerResult

// Dispatcher context holding current state and registered handlers
type dispatcherContext = {
  mutable currentState: state,
  mutable eventHandler: eventHandler,
  mutable effectExecutor: effect => unit,
}

// Create default stub event handler that uses state machine transitions
let defaultEventHandler: eventHandler = (currentState, event) => {
  switch transition(currentState, event) {
  | ValidTransition(newState) => {
      // Log successful transition
      let logMsg = `Transition: ${stateToString(currentState)} --[${eventToString(event)}]--> ${stateToString(newState)}`
      {
        newState: newState,
        effects: [LogEvent(logMsg)],
      }
    }
  | InvalidTransition(error) => {
      // Log invalid transition attempt but don't change state
      let errorMsg = `Invalid transition rejected: ${error}`
      {
        newState: currentState,
        effects: [LogEvent(errorMsg)],
      }
    }
  }
}

// Default effect executor stub - logs effects but doesn't execute side effects
let defaultEffectExecutor: effect => unit = effect => {
  switch effect {
  | NoEffect => ()
  | LogEvent(msg) => Js.log(`[EventDispatcher] ${msg}`)
  | EmitTelemetry(eventType, payload) =>
    Js.log2(`[Telemetry] ${eventType}:`, payload)
  | UpdatePersistence(key, value) =>
    Js.log2(`[Persistence] ${key}:`, value)
  | TriggerCallback(callback) =>
    Js.log("[Callback] Executing callback")
    callback()
  }
}

// Create a new dispatcher context with initial state
let createDispatcher = (initialState: state): dispatcherContext => {
  {
    currentState: initialState,
    eventHandler: defaultEventHandler,
    effectExecutor: defaultEffectExecutor,
  }
}

// Register a custom event handler (for testing or custom logic)
let registerEventHandler = (ctx: dispatcherContext, handler: eventHandler): unit => {
  ctx.eventHandler = handler
}

// Register a custom effect executor (for production or custom side effects)
let registerEffectExecutor = (ctx: dispatcherContext, executor: effect => unit): unit => {
  ctx.effectExecutor = executor
}

// Dispatch an event through the dispatcher
// Returns the new state after handling the event
let dispatch = (ctx: dispatcherContext, event: event): state => {
  // Call the registered event handler
  let result = ctx.eventHandler(ctx.currentState, event)

  // Update current state
  ctx.currentState = result.newState

  // Execute all effects
  Belt.Array.forEach(result.effects, effect => {
    ctx.effectExecutor(effect)
  })

  // Return the new state
  result.newState
}

// Get current state from dispatcher
let getCurrentState = (ctx: dispatcherContext): state => {
  ctx.currentState
}

// Helper: Dispatch multiple events in sequence
// Useful for workflow automation and testing
let dispatchBatch = (ctx: dispatcherContext, events: array<event>): state => {
  Belt.Array.reduce(events, ctx.currentState, (_, event) => {
    dispatch(ctx, event)
  })
}

// Helper: Check if dispatcher is in a terminal state
let isTerminalState = (ctx: dispatcherContext): bool => {
  switch ctx.currentState {
  | Completed | Failed(_) | Cancelled => true
  | _ => false
  }
}

// Helper: Reset dispatcher to Idle state
let reset = (ctx: dispatcherContext): state => {
  dispatch(ctx, Reset)
}

// Create a telemetry effect helper
let createTelemetryEffect = (eventType: string, data: Js.Dict.t<Js.Json.t>): effect => {
  EmitTelemetry(eventType, Js.Json.object_(data))
}

// Create a persistence effect helper
let createPersistenceEffect = (key: string, value: Js.Json.t): effect => {
  UpdatePersistence(key, value)
}
