// Generic State Machine Framework for AutomatosX Sprint 7 Day 61
// Provides type-safe, polymorphic state machines with guards, actions, and async support

// Core types for the state machine
type state<'s> =
  | Idle
  | Running('s)
  | Paused('s)
  | Completed('s)
  | Failed(string)

type event<'e> = {
  id: string,
  timestamp: float,
  data: 'e,
  metadata: option<Js.Dict.t<string>>,
}

// Transition configuration
type transition<'s, 'e> = {
  from: state<'s>,
  event: 'e,
  to: state<'s>,
  guard: option<'s => bool>,
  action: option<'s => promise<unit>>,
}

// State machine instance
type rec stateMachine<'s, 'e> = {
  mutable currentState: state<'s>,
  transitions: array<transition<'s, 'e>>,
  mutable history: array<historyEntry<'s, 'e>>,
  config: machineConfig,
}

and historyEntry<'s, 'e> = {
  from: state<'s>,
  to: state<'s>,
  event: event<'e>,
  timestamp: float,
  success: bool,
  error: option<string>,
}

and machineConfig = {
  maxHistorySize: int,
  enableLogging: bool,
  strict: bool, // If true, reject invalid transitions; if false, ignore them
}

// Transition result
type transitionResult<'s> =
  | Success(state<'s>)
  | Rejected(string)
  | GuardBlocked(string)
  | ActionFailed(string)

// Create a new event
@genType
let createEvent = (~id: string, ~data: 'e, ~metadata: option<Js.Dict.t<string>>=?, ()): event<'e> => {
  id,
  timestamp: Js.Date.now(),
  data,
  metadata,
}

// Default configuration
let defaultConfig: machineConfig = {
  maxHistorySize: 100,
  enableLogging: false,
  strict: true,
}

// Create a new state machine
@genType
let create = (
  initialState: state<'s>,
  transitions: array<transition<'s, 'e>>,
  ~config: option<machineConfig>=?,
  ()
): stateMachine<'s, 'e> => {
  let machineConfig = switch config {
  | Some(c) => c
  | None => defaultConfig
  }

  {
    currentState: initialState,
    transitions,
    history: [],
    config: machineConfig,
  }
}

// Helper to compare states (needed for pattern matching)
let statesEqual = (s1: state<'s>, s2: state<'s>): bool => {
  switch (s1, s2) {
  | (Idle, Idle) => true
  | (Running(_), Running(_)) => true
  | (Paused(_), Paused(_)) => true
  | (Completed(_), Completed(_)) => true
  | (Failed(_), Failed(_)) => true
  | _ => false
  }
}

// Find matching transition
let findTransition = (
  machine: stateMachine<'s, 'e>,
  eventData: 'e,
): option<transition<'s, 'e>> => {
  machine.transitions
  ->Core__Array.find(t => statesEqual(t.from, machine.currentState) && t.event == eventData)
}

// Extract state data
let getStateData = (state: state<'s>): option<'s> => {
  switch state {
  | Running(data) | Paused(data) | Completed(data) => Some(data)
  | Idle | Failed(_) => None
  }
}

// Execute guard function
let checkGuard = (guard: option<'s => bool>, state: state<'s>): result<unit, string> => {
  switch (guard, getStateData(state)) {
  | (None, _) => Ok()
  | (Some(guardFn), Some(data)) =>
    if guardFn(data) {
      Ok()
    } else {
      Error("Guard condition not satisfied")
    }
  | (Some(_), None) => Error("Cannot evaluate guard: state has no data")
  }
}

// Execute action function
let executeAction = async (
  action: option<'s => promise<unit>>,
  state: state<'s>,
): result<unit, string> => {
  switch (action, getStateData(state)) {
  | (None, _) => Ok()
  | (Some(actionFn), Some(data)) =>
    try {
      await actionFn(data)
      Ok()
    } catch {
    | Js.Exn.Error(e) =>
      let message = switch Js.Exn.message(e) {
      | Some(msg) => msg
      | None => "Unknown error in action"
      }
      Error(message)
    | _ => Error("Unknown error in action")
    }
  | (Some(_), None) => Error("Cannot execute action: state has no data")
  }
}

// Add entry to history
let addToHistory = (
  machine: stateMachine<'s, 'e>,
  from: state<'s>,
  to: state<'s>,
  event: event<'e>,
  success: bool,
  error: option<string>,
): unit => {
  let entry = {
    from,
    to,
    event,
    timestamp: Js.Date.now(),
    success,
    error,
  }

  machine.history = Core__Array.concat(machine.history, [entry])

  // Trim history if it exceeds max size
  if Core__Array.length(machine.history) > machine.config.maxHistorySize {
    machine.history = Core__Array.sliceToEnd(
      machine.history,
      ~start=Core__Array.length(machine.history) - machine.config.maxHistorySize,
    )
  }
}

// Main transition function
@genType
let transition = async (
  machine: stateMachine<'s, 'e>,
  event: event<'e>,
): result<state<'s>, string> => {
  let currentState = machine.currentState

  // Find matching transition
  let matchingTransition = findTransition(machine, event.data)

  switch matchingTransition {
  | None =>
    if machine.config.strict {
      addToHistory(machine, currentState, currentState, event, false, Some("No matching transition"))
      Error(`No transition from ${currentState->Obj.magic} for event`)
    } else {
      // In non-strict mode, ignore invalid transitions
      Ok(currentState)
    }
  | Some(t) =>
    // Check guard
    let guardResult = checkGuard(t.guard, currentState)

    switch guardResult {
    | Error(reason) =>
      addToHistory(machine, currentState, currentState, event, false, Some(`Guard blocked: ${reason}`))
      Error(`Guard blocked: ${reason}`)
    | Ok() =>
      // Execute action with the target state's data
      let actionResult = await executeAction(t.action, t.to)

      switch actionResult {
      | Error(reason) =>
        addToHistory(machine, currentState, currentState, event, false, Some(`Action failed: ${reason}`))
        Error(`Action failed: ${reason}`)
      | Ok() =>
        // Successful transition
        machine.currentState = t.to
        addToHistory(machine, currentState, t.to, event, true, None)

        if machine.config.enableLogging {
          Js.Console.log(`State transition: ${currentState->Obj.magic} -> ${t.to->Obj.magic}`)
        }

        Ok(t.to)
      }
    }
  }
}

// Get current state
@genType
let getCurrentState = (machine: stateMachine<'s, 'e>): state<'s> => {
  machine.currentState
}

// Get history
@genType
let getHistory = (machine: stateMachine<'s, 'e>): array<historyEntry<'s, 'e>> => {
  machine.history
}

// Get history length
@genType
let getHistoryLength = (machine: stateMachine<'s, 'e>): int => {
  Core__Array.length(machine.history)
}

// Check if machine is in a specific state type
@genType
let isIdle = (machine: stateMachine<'s, 'e>): bool => {
  switch machine.currentState {
  | Idle => true
  | _ => false
  }
}

@genType
let isRunning = (machine: stateMachine<'s, 'e>): bool => {
  switch machine.currentState {
  | Running(_) => true
  | _ => false
  }
}

@genType
let isPaused = (machine: stateMachine<'s, 'e>): bool => {
  switch machine.currentState {
  | Paused(_) => true
  | _ => false
  }
}

@genType
let isCompleted = (machine: stateMachine<'s, 'e>): bool => {
  switch machine.currentState {
  | Completed(_) => true
  | _ => false
  }
}

@genType
let isFailed = (machine: stateMachine<'s, 'e>): bool => {
  switch machine.currentState {
  | Failed(_) => true
  | _ => false
  }
}

// Get failed error message
@genType
let getFailureReason = (machine: stateMachine<'s, 'e>): option<string> => {
  switch machine.currentState {
  | Failed(reason) => Some(reason)
  | _ => None
  }
}

// Reset machine to initial state
@genType
let reset = (machine: stateMachine<'s, 'e>, initialState: state<'s>): unit => {
  machine.currentState = initialState
  machine.history = []
}

// Can transition - check if a transition is possible without executing it
@genType
let canTransition = (machine: stateMachine<'s, 'e>, eventData: 'e): bool => {
  let matchingTransition = findTransition(machine, eventData)

  switch matchingTransition {
  | None => false
  | Some(t) =>
    let guardResult = checkGuard(t.guard, machine.currentState)
    switch guardResult {
    | Ok() => true
    | Error(_) => false
    }
  }
}

// Get all possible transitions from current state
@genType
let getPossibleTransitions = (machine: stateMachine<'s, 'e>): array<transition<'s, 'e>> => {
  machine.transitions->Core__Array.filter(t => statesEqual(t.from, machine.currentState))
}

// State machine statistics
type statistics = {
  totalTransitions: int,
  successfulTransitions: int,
  failedTransitions: int,
  guardBlockedTransitions: int,
  actionFailedTransitions: int,
}

@genType
let getStatistics = (machine: stateMachine<'s, 'e>): statistics => {
  let total = Core__Array.length(machine.history)
  let successful = machine.history->Core__Array.filter(entry => entry.success)->Core__Array.length
  let failed = total - successful

  let guardBlocked =
    machine.history
    ->Core__Array.filter(entry =>
      !entry.success &&
      entry.error->Core__Option.isSome &&
      entry.error->Core__Option.getExn->Js.String2.includes("Guard blocked")
    )
    ->Core__Array.length

  let actionFailed =
    machine.history
    ->Core__Array.filter(entry =>
      !entry.success &&
      entry.error->Core__Option.isSome &&
      entry.error->Core__Option.getExn->Js.String2.includes("Action failed")
    )
    ->Core__Array.length

  {
    totalTransitions: total,
    successfulTransitions: successful,
    failedTransitions: failed,
    guardBlockedTransitions: guardBlocked,
    actionFailedTransitions: actionFailed,
  }
}
