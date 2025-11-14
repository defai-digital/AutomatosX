// ============================================================================
// StateManagement.res - Type-safe state machines with validated transitions
// ============================================================================
//
// PREVENTS: BUG #15 (Inconsistent state management)
//
// TypeScript problem: Manual state updates, missing transition validation
// ReScript solution: Type-safe state machine, exhaustive pattern matching
//
// ============================================================================

// Import ErrorHandling for Result types
open ErrorHandling

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================

// Generic state machine state
@genType
type state<'s> = {
  current: 's,
  previous: option<'s>,
  enteredAt: int,  // Timestamp when state was entered
}

// State machine transition
@genType
type transition<'s, 'e> = {
  from: 's,
  event: 'e,
  to: 's,
  guard: option<unit => bool>,  // Optional guard condition
}

// State machine configuration
@genType
type stateMachine<'s, 'e> = {
  initial: 's,
  current: ref<state<'s>>,
  transitions: array<transition<'s, 'e>>,
  onEnter: option<('s, 's) => unit>,  // (from, to) callback
  onExit: option<('s, 's) => unit>,   // (from, to) callback
}

// ============================================================================
// STATE MACHINE CREATION
// ============================================================================

// Create a new state machine
@genType
let createStateMachine = (
  ~initial: 's,
  ~transitions: array<transition<'s, 'e>>,
  ~onEnter: option<('s, 's) => unit> = None,
  ~onExit: option<('s, 's) => unit> = None,
): stateMachine<'s, 'e> => {
  let now = Js.Date.now()->Belt.Float.toInt
  {
    initial,
    current: ref({
      current: initial,
      previous: None,
      enteredAt: now,
    }),
    transitions,
    onEnter,
    onExit,
  }
}

// ============================================================================
// STATE QUERIES
// ============================================================================

// Get current state
@genType
let getCurrentState = (machine: stateMachine<'s, 'e>): 's => {
  machine.current.contents.current
}

// Get previous state
@genType
let getPreviousState = (machine: stateMachine<'s, 'e>): option<'s> => {
  machine.current.contents.previous
}

// Get time in current state (milliseconds)
@genType
let getTimeInState = (machine: stateMachine<'s, 'e>): int => {
  let now = Js.Date.now()->Belt.Float.toInt
  now - machine.current.contents.enteredAt
}

// Check if in specific state
@genType
let isInState = (machine: stateMachine<'s, 'e>, state: 's): bool => {
  getCurrentState(machine) == state
}

// ============================================================================
// TRANSITION VALIDATION
// ============================================================================

// Find valid transition for event
@genType
let findTransition = (
  machine: stateMachine<'s, 'e>,
  event: 'e,
): option<transition<'s, 'e>> => {
  let currentState = getCurrentState(machine)

  Belt.Array.getBy(machine.transitions, t => {
    t.from == currentState && t.event == event
  })
}

// Check if transition is allowed
@genType
let canTransition = (machine: stateMachine<'s, 'e>, event: 'e): bool => {
  switch findTransition(machine, event) {
  | None => false
  | Some(t) => {
      // Check guard condition if present
      switch t.guard {
      | None => true
      | Some(guardFn) => guardFn()
      }
    }
  }
}

// Get all valid transitions from current state
@genType
let getValidTransitions = (machine: stateMachine<'s, 'e>): array<transition<'s, 'e>> => {
  let currentState = getCurrentState(machine)
  Belt.Array.keep(machine.transitions, t => t.from == currentState)
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

// Execute transition (type-safe!)
@genType
let makeTransition = (
  machine: stateMachine<'s, 'e>,
  event: 'e,
): result<'s, string> => {
  switch findTransition(machine, event) {
  | None => {
      Error(`No valid transition for event from current state`)
    }
  | Some(t) => {
      // Check guard condition
      switch t.guard {
      | Some(guardFn) when !guardFn() => {
          Error(`Transition guard failed for event`)
        }
      | _ => {
          let oldState = machine.current.contents.current
          let newState = t.to

          // Call onExit callback
          switch machine.onExit {
          | Some(fn) => fn(oldState, newState)
          | None => ()
          }

          // Update state
          let now = Js.Date.now()->Belt.Float.toInt
          machine.current := {
            current: newState,
            previous: Some(oldState),
            enteredAt: now,
          }

          // Call onEnter callback
          switch machine.onEnter {
          | Some(fn) => fn(oldState, newState)
          | None => ()
          }

          Ok(newState)
        }
      }
    }
  }
}

// Reset to initial state
@genType
let reset = (machine: stateMachine<'s, 'e>): unit => {
  let now = Js.Date.now()->Belt.Float.toInt
  machine.current := {
    current: machine.initial,
    previous: Some(machine.current.contents.current),
    enteredAt: now,
  }
}

// ============================================================================
// CONCRETE STATE MACHINES (Common patterns)
// ============================================================================

// Task state
@genType
type taskState =
  | @as("pending") Pending
  | @as("running") Running
  | @as("completed") Completed
  | @as("failed") Failed
  | @as("cancelled") Cancelled

// Task event
@genType
type taskEvent =
  | @as("start") Start
  | @as("complete") Complete
  | @as("fail") Fail
  | @as("cancel") Cancel
  | @as("retry") Retry

// Convert task state to string
let taskStateToString = (state: taskState): string => {
  switch state {
  | Pending => "pending"
  | Running => "running"
  | Completed => "completed"
  | Failed => "failed"
  | Cancelled => "cancelled"
  }
}

// Create task state machine
@genType
let createTaskStateMachine = (): stateMachine<taskState, taskEvent> => {
  createStateMachine(
    ~initial=Pending,
    ~transitions=[
      {from: Pending, event: Start, to: Running, guard: None},
      {from: Running, event: Complete, to: Completed, guard: None},
      {from: Running, event: Fail, to: Failed, guard: None},
      {from: Running, event: Cancel, to: Cancelled, guard: None},
      {from: Failed, event: Retry, to: Pending, guard: None},
      {from: Cancelled, event: Retry, to: Pending, guard: None},
    ],
    ~onEnter=Some((from, to) => {
      Js.log2("Task state:", taskStateToString(from) ++ " -> " ++ taskStateToString(to))
    }),
    ~onExit=None,
  )
}

// Connection state
@genType
type connectionState =
  | @as("disconnected") Disconnected
  | @as("connecting") Connecting
  | @as("connected") Connected
  | @as("reconnecting") Reconnecting
  | @as("failed") ConnectionFailed

// Connection event
@genType
type connectionEvent =
  | @as("connect") Connect
  | @as("connected") ConnectionSuccess
  | @as("disconnect") Disconnect
  | @as("error") ConnectionError
  | @as("retry") RetryConnection

// Create connection state machine
@genType
let createConnectionStateMachine = (): stateMachine<connectionState, connectionEvent> => {
  createStateMachine(
    ~initial=Disconnected,
    ~transitions=[
      {from: Disconnected, event: Connect, to: Connecting, guard: None},
      {from: Connecting, event: ConnectionSuccess, to: Connected, guard: None},
      {from: Connecting, event: ConnectionError, to: ConnectionFailed, guard: None},
      {from: Connected, event: Disconnect, to: Disconnected, guard: None},
      {from: Connected, event: ConnectionError, to: Reconnecting, guard: None},
      {from: ConnectionFailed, event: RetryConnection, to: Connecting, guard: None},
      {from: Reconnecting, event: ConnectionSuccess, to: Connected, guard: None},
      {from: Reconnecting, event: ConnectionError, to: ConnectionFailed, guard: None},
    ],
    ~onEnter=None,
    ~onExit=None,
  )
}

// Request state
@genType
type requestState =
  | @as("idle") Idle
  | @as("loading") Loading
  | @as("success") RequestSuccess
  | @as("error") RequestError

// Request event
@genType
type requestEvent =
  | @as("fetch") Fetch
  | @as("success") FetchSuccess
  | @as("error") FetchError
  | @as("reset") ResetRequest

// Create request state machine
@genType
let createRequestStateMachine = (): stateMachine<requestState, requestEvent> => {
  createStateMachine(
    ~initial=Idle,
    ~transitions=[
      {from: Idle, event: Fetch, to: Loading, guard: None},
      {from: Loading, event: FetchSuccess, to: RequestSuccess, guard: None},
      {from: Loading, event: FetchError, to: RequestError, guard: None},
      {from: RequestSuccess, event: ResetRequest, to: Idle, guard: None},
      {from: RequestError, event: ResetRequest, to: Idle, guard: None},
      {from: RequestError, event: Fetch, to: Loading, guard: None},
    ],
    ~onEnter=None,
    ~onExit=None,
  )
}

// ============================================================================
// STATE HISTORY (Track state changes)
// ============================================================================

// State history entry
@genType
type historyEntry<'s> = {
  state: 's,
  enteredAt: int,
  exitedAt: option<int>,
}

// State machine with history
@genType
type stateMachineWithHistory<'s, 'e> = {
  machine: stateMachine<'s, 'e>,
  history: ref<array<historyEntry<'s>>>,
}

// Create state machine with history tracking
@genType
let createWithHistory = (
  machine: stateMachine<'s, 'e>,
): stateMachineWithHistory<'s, 'e> => {
  let now = Js.Date.now()->Belt.Float.toInt
  {
    machine,
    history: ref([{
      state: machine.initial,
      enteredAt: now,
      exitedAt: None,
    }]),
  }
}

// Make transition with history
@genType
let makeTransitionWithHistory = (
  sm: stateMachineWithHistory<'s, 'e>,
  event: 'e,
): result<'s, string> => {
  let result = makeTransition(sm.machine, event)

  switch result {
  | Ok(newState) => {
      let now = Js.Date.now()->Belt.Float.toInt

      // Update last entry's exitedAt
      let lastIndex = Belt.Array.length(sm.history.contents) - 1
      if lastIndex >= 0 {
        switch Belt.Array.get(sm.history.contents, lastIndex) {
        | Some(entry) => {
            let updated = {...entry, exitedAt: Some(now)}
            sm.history := Belt.Array.mapWithIndex(sm.history.contents, (i, e) => {
              if i == lastIndex {updated} else {e}
            })
          }
        | None => ()
        }
      }

      // Add new entry
      let newEntry = {
        state: newState,
        enteredAt: now,
        exitedAt: None,
      }
      sm.history := Belt.Array.concat(sm.history.contents, [newEntry])

      Ok(newState)
    }
  | Error(err) => Error(err)
  }
}

// Get state history
@genType
let getHistory = (sm: stateMachineWithHistory<'s, 'e>): array<historyEntry<'s>> => {
  sm.history.contents
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Get state name as string (for debugging)
@genType
let stateToString = (state: 'a): string => {
  // This is a placeholder - actual implementation depends on the state type
  "state"
}

// Check if transition is valid (without executing)
@genType
let isValidTransition = (
  machine: stateMachine<'s, 'e>,
  fromState: 's,
  event: 'e,
): bool => {
  Belt.Array.some(machine.transitions, t => {
    t.from == fromState && t.event == event
  })
}

// ============================================================================
// EXAMPLE USAGE (not exported, for documentation)
// ============================================================================

// Example 1: Task state machine (BUG #15 prevention)
// let taskMachine = createTaskStateMachine()
//
// // Start task
// let result = makeTransition(taskMachine, Start)
// switch result {
// | Ok(newState) => Js.log2("Task started, state:", newState)
// | Error(err) => Js.log2("Transition failed:", err)
// }
//
// // Try invalid transition (prevented by type system!)
// let invalid = makeTransition(taskMachine, Complete)  // From Pending -> Error!
// // Only valid from Running state

// Example 2: Connection state machine with guards
// let canConnect = ref(true)
// let connectionMachine = createStateMachine(
//   ~initial=Disconnected,
//   ~transitions=[
//     {
//       from: Disconnected,
//       event: Connect,
//       to: Connecting,
//       guard: Some(() => canConnect.contents),  // Only connect if allowed
//     },
//   ],
//   ~onEnter=None,
//   ~onExit=None,
// )

// Example 3: State machine with history
// let taskMachine = createTaskStateMachine()
// let taskWithHistory = createWithHistory(taskMachine)
//
// makeTransitionWithHistory(taskWithHistory, Start)->ignore
// makeTransitionWithHistory(taskWithHistory, Complete)->ignore
//
// let history = getHistory(taskWithHistory)
// // Returns: [Pending, Running, Completed] with timestamps
