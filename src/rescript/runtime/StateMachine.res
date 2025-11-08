// Sprint 1 Day 1: State Machine Skeleton
// RE1 + ARCH: State variant module with typed transitions
//
// Purpose: Define core runtime states and transition logic for AutomatosX v2
// Architecture: Exhaustive pattern matching ensures all state transitions are explicit
// Compliance: Zero warnings required for merge

// State variant representing all possible runtime states
type state =
  | Idle
  | Planning
  | Executing
  | Recovering
  | Completed
  | Failed(string)  // Failed with error message
  | Cancelled

// Event variant representing all possible runtime events
type event =
  | StartPlanning
  | PlanReady
  | StartExecution
  | ExecutionSuccess
  | ExecutionFailure(string)
  | RecoveryAttempt
  | RecoverySuccess
  | RecoveryFailure(string)
  | CancelRequest
  | Reset

// Transition result - either successful new state or error
type transitionResult =
  | ValidTransition(state)
  | InvalidTransition(string)

// Core transition function with exhaustive pattern matching
// Enforces valid state machine transitions with compile-time guarantees
let transition = (currentState: state, event: event): transitionResult => {
  switch (currentState, event) {
  // Idle state transitions
  | (Idle, StartPlanning) => ValidTransition(Planning)
  | (Idle, Reset) => ValidTransition(Idle)

  // Planning state transitions
  | (Planning, PlanReady) => ValidTransition(Executing)
  | (Planning, ExecutionFailure(msg)) => ValidTransition(Failed(msg))
  | (Planning, CancelRequest) => ValidTransition(Cancelled)
  | (Planning, Reset) => ValidTransition(Idle)

  // Executing state transitions
  | (Executing, ExecutionSuccess) => ValidTransition(Completed)
  | (Executing, ExecutionFailure(msg)) => ValidTransition(Recovering)
  | (Executing, CancelRequest) => ValidTransition(Cancelled)

  // Recovering state transitions
  | (Recovering, RecoverySuccess) => ValidTransition(Executing)
  | (Recovering, RecoveryFailure(msg)) => ValidTransition(Failed(msg))
  | (Recovering, CancelRequest) => ValidTransition(Cancelled)

  // Completed state transitions
  | (Completed, Reset) => ValidTransition(Idle)

  // Failed state transitions
  | (Failed(_), Reset) => ValidTransition(Idle)
  | (Failed(_), RecoveryAttempt) => ValidTransition(Recovering)

  // Cancelled state transitions
  | (Cancelled, Reset) => ValidTransition(Idle)

  // All other transitions are invalid
  | (state, event) => InvalidTransition(
      `Invalid transition: Cannot handle event ${eventToString(event)} in state ${stateToString(state)}`
    )
  }
}

// Helper: Convert state to string for logging and debugging
and stateToString = (state: state): string => {
  switch state {
  | Idle => "Idle"
  | Planning => "Planning"
  | Executing => "Executing"
  | Recovering => "Recovering"
  | Completed => "Completed"
  | Failed(msg) => `Failed(${msg})`
  | Cancelled => "Cancelled"
  }
}

// Helper: Convert event to string for logging and debugging
and eventToString = (event: event): string => {
  switch event {
  | StartPlanning => "StartPlanning"
  | PlanReady => "PlanReady"
  | StartExecution => "StartExecution"
  | ExecutionSuccess => "ExecutionSuccess"
  | ExecutionFailure(msg) => `ExecutionFailure(${msg})`
  | RecoveryAttempt => "RecoveryAttempt"
  | RecoverySuccess => "RecoverySuccess"
  | RecoveryFailure(msg) => `RecoveryFailure(${msg})`
  | CancelRequest => "CancelRequest"
  | Reset => "Reset"
  }
}

// Validation: Check if a transition is valid without executing it
let isValidTransition = (currentState: state, event: event): bool => {
  switch transition(currentState, event) {
  | ValidTransition(_) => true
  | InvalidTransition(_) => false
  }
}

// Get all valid events for a given state (useful for introspection)
let getValidEvents = (state: state): array<event> => {
  let allEvents = [
    StartPlanning,
    PlanReady,
    StartExecution,
    ExecutionSuccess,
    ExecutionFailure("test"),
    RecoveryAttempt,
    RecoverySuccess,
    RecoveryFailure("test"),
    CancelRequest,
    Reset,
  ]

  allEvents->Belt.Array.keep(event => isValidTransition(state, event))
}
