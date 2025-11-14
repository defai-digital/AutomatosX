// Sprint 1 Day 2: Guard Helper Library MVP
// RE1: Guard helper library with schema validation, rate limits, dependency checks
//
// Purpose: Provide reusable guard functions for state transition validation
// Architecture: Guard verdict system with pass/fail/defer logic for async checks
// Compliance: Zero warnings required for merge

// Guard verdict type - result of guard evaluation
type guardVerdict =
  | Pass
  | Fail(string)
  | Defer(string) // Defer for async checks that need completion before proceeding

// Guard context containing state and event being validated
type guardContext = {
  currentState: TaskStateMachine.State.t,
  event: TaskStateMachine.Event.t,
  metadata: option<Js.Dict.t<Js.Json.t>>,
}

// Guard function type - takes context and returns verdict
type guard = guardContext => guardVerdict

// Schema validation result
type schemaValidationResult =
  | Valid
  | Invalid(string)

// Rate limit state for tracking guard invocations
type rateLimitState = {
  mutable lastCheckTime: float,
  mutable checkCount: int,
  windowMs: int,
  maxChecks: int,
}

// Dependency check result
type dependencyCheckResult =
  | Available
  | Missing(string)
  | VersionMismatch(string)

// Helper: Create guard context from state and event
let createGuardContext = (
  currentState: TaskStateMachine.State.t,
  event: TaskStateMachine.Event.t,
  metadata: option<Js.Dict.t<Js.Json.t>>,
): guardContext => {
  {
    currentState: currentState,
    event: event,
    metadata: metadata,
  }
}

// Helper: Convert guard verdict to string for logging
let verdictToString = (verdict: guardVerdict): string => {
  switch verdict {
  | Pass => "Pass"
  | Fail(msg) => `Fail(${msg})`
  | Defer(msg) => `Defer(${msg})`
  }
}

// Helper: Check if verdict is passing
let isPass = (verdict: guardVerdict): bool => {
  switch verdict {
  | Pass => true
  | _ => false
  }
}

// Helper: Check if verdict is failing
let isFail = (verdict: guardVerdict): bool => {
  switch verdict {
  | Fail(_) => true
  | _ => false
  }
}

// Helper: Check if verdict is deferred
let isDefer = (verdict: guardVerdict): bool => {
  switch verdict {
  | Defer(_) => true
  | _ => false
  }
}

// Schema Validation Guard: Validate event payload against schema
let schemaValidationGuard = (
  validator: Js.Json.t => schemaValidationResult,
  ctx: guardContext,
): guardVerdict => {
  // Extract metadata payload for validation
  switch ctx.metadata {
  | None => Fail("No metadata provided for schema validation")
  | Some(dict) => {
      // Convert dict to JSON for validation
      let payload = Js.Json.object_(dict)

      switch validator(payload) {
      | Valid => Pass
      | Invalid(error) => Fail(`Schema validation failed: ${error}`)
      }
    }
  }
}

// Rate Limiting Guard: Prevent excessive guard checks within time window
let rateLimitGuard = (state: rateLimitState, _ctx: guardContext): guardVerdict => {
  let currentTime = Js.Date.now()
  let timeSinceLastCheck = currentTime -. state.lastCheckTime

  // Reset counter if outside window
  if timeSinceLastCheck > Belt.Int.toFloat(state.windowMs) {
    state.lastCheckTime = currentTime
    state.checkCount = 1
    Pass
  } else {
    // Within window - check rate limit
    if state.checkCount >= state.maxChecks {
      Fail(
        `Rate limit exceeded: ${Belt.Int.toString(state.checkCount)} checks in ${Belt.Int.toString(state.windowMs)}ms window`
      )
    } else {
      state.checkCount = state.checkCount + 1
      Pass
    }
  }
}

// Create rate limit state
let createRateLimitState = (windowMs: int, maxChecks: int): rateLimitState => {
  {
    lastCheckTime: 0.0,
    checkCount: 0,
    windowMs: windowMs,
    maxChecks: maxChecks,
  }
}

// Dependency Check Guard: Verify required dependencies are available
let dependencyCheckGuard = (
  checker: unit => dependencyCheckResult,
  _ctx: guardContext,
): guardVerdict => {
  switch checker() {
  | Available => Pass
  | Missing(dep) => Fail(`Required dependency missing: ${dep}`)
  | VersionMismatch(msg) => Fail(`Dependency version mismatch: ${msg}`)
  }
}

// State-Based Guard: Only allow transitions from specific states
let stateBasedGuard = (allowedStates: array<TaskStateMachine.State.t>, ctx: guardContext): guardVerdict => {
  let isAllowed = Belt.Array.some(allowedStates, allowedState => {
    // Compare states using string representation for simplicity
    TaskStateMachine.State.toString(allowedState) == TaskStateMachine.State.toString(ctx.currentState)
  })

  if isAllowed {
    Pass
  } else {
    let allowedStateNames = Belt.Array.map(allowedStates, TaskStateMachine.State.toString)->Js.Array2.joinWith(", ")
    Fail(`Transition not allowed from state ${TaskStateMachine.State.toString(ctx.currentState)}. Allowed states: ${allowedStateNames}`)
  }
}

// Event-Based Guard: Only allow specific events
let eventBasedGuard = (allowedEvents: array<TaskStateMachine.Event.t>, ctx: guardContext): guardVerdict => {
  let isAllowed = Belt.Array.some(allowedEvents, allowedEvent => {
    // Compare events using string representation
    TaskStateMachine.Event.toString(allowedEvent) == TaskStateMachine.Event.toString(ctx.event)
  })

  if isAllowed {
    Pass
  } else {
    let allowedEventNames = Belt.Array.map(allowedEvents, TaskStateMachine.Event.toString)->Js.Array2.joinWith(", ")
    Fail(`Event ${TaskStateMachine.Event.toString(ctx.event)} not allowed. Allowed events: ${allowedEventNames}`)
  }
}

// Guard Combinator: AND - All guards must pass
let andGuard = (guards: array<guard>, ctx: guardContext): guardVerdict => {
  let results = Belt.Array.map(guards, g => g(ctx))

  // If any guard fails, return first failure
  switch Belt.Array.getBy(results, isFail) {
  | Some(Fail(msg)) => Fail(msg)
  | _ => {
      // If any guard defers, return first defer
      switch Belt.Array.getBy(results, isDefer) {
      | Some(Defer(msg)) => Defer(msg)
      | _ => Pass // All guards passed
      }
    }
  }
}

// Guard Combinator: OR - At least one guard must pass
let orGuard = (guards: array<guard>, ctx: guardContext): guardVerdict => {
  let results = Belt.Array.map(guards, g => g(ctx))

  // If any guard passes, return pass
  if Belt.Array.some(results, isPass) {
    Pass
  } else {
    // Collect all failure messages
    let failures = Belt.Array.keepMap(results, verdict => {
      switch verdict {
      | Fail(msg) => Some(msg)
      | _ => None
      }
    })

    // If all failed, combine failure messages
    let combinedMsg = Js.Array2.joinWith(failures, "; ")
    Fail(`All guards failed: ${combinedMsg}`)
  }
}

// Guard Combinator: NOT - Invert guard result
let notGuard = (guard: guard, ctx: guardContext): guardVerdict => {
  switch guard(ctx) {
  | Pass => Fail("Guard passed but NOT combinator inverted it")
  | Fail(_) => Pass
  | Defer(msg) => Defer(msg) // Preserve defer
  }
}

// Helper: Execute guard and log result
let executeGuard = (guard: guard, ctx: guardContext, guardName: string): guardVerdict => {
  let verdict = guard(ctx)

  // Log guard execution (can be replaced with proper telemetry)
  let logMsg = `[Guards] ${guardName}: ${verdictToString(verdict)} for ${TaskStateMachine.Event.toString(ctx.event)} in ${TaskStateMachine.State.toString(ctx.currentState)}`
  Js.log(logMsg)

  verdict
}

// Helper: Execute multiple guards and return combined verdict
let executeGuards = (guards: array<(guard, string)>, ctx: guardContext): guardVerdict => {
  let guardFunctions = Belt.Array.map(guards, ((g, _name)) => g)
  andGuard(guardFunctions, ctx)
}

// Helper: Create a simple always-pass guard (for testing)
let alwaysPassGuard = (_ctx: guardContext): guardVerdict => Pass

// Helper: Create a simple always-fail guard (for testing)
let alwaysFailGuard = (reason: string, _ctx: guardContext): guardVerdict => Fail(reason)

// Helper: Create a guard that checks metadata field existence
let metadataFieldGuard = (fieldName: string, ctx: guardContext): guardVerdict => {
  switch ctx.metadata {
  | None => Fail(`No metadata provided, expected field: ${fieldName}`)
  | Some(dict) => {
      switch Js.Dict.get(dict, fieldName) {
      | None => Fail(`Required metadata field missing: ${fieldName}`)
      | Some(_) => Pass
      }
    }
  }
}
