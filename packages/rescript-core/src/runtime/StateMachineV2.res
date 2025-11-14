// Sprint 3 Day 24: State Machine V2 - Simplified Production-Ready Implementation
// Deterministic state machine for task orchestration

module State = {
  type t =
    | Idle
    | Planning
    | Executing
    | Paused
    | Completed
    | Failed

  let toString = (state: t): string => {
    switch state {
    | Idle => "idle"
    | Planning => "planning"
    | Executing => "executing"
    | Paused => "paused"
    | Completed => "completed"
    | Failed => "failed"
    }
  }

  let fromString = (str: string): option<t> => {
    switch str {
    | "idle" => Some(Idle)
    | "planning" => Some(Planning)
    | "executing" => Some(Executing)
    | "paused" => Some(Paused)
    | "completed" => Some(Completed)
    | "failed" => Some(Failed)
    | _ => None
    }
  }
}

module Event = {
  type t =
    | Start
    | Plan
    | Execute
    | Pause
    | Resume
    | Complete
    | Fail({error: string})

  let toString = (event: t): string => {
    switch event {
    | Start => "start"
    | Plan => "plan"
    | Execute => "execute"
    | Pause => "pause"
    | Resume => "resume"
    | Complete => "complete"
    | Fail(_) => "fail"
    }
  }
}

module Transition = {
  type t = {
    from: State.t,
    event: Event.t,
    to: State.t,
  }

  let isValid = (transition: t): bool => {
    switch (transition.from, transition.event, transition.to) {
    // Valid transitions
    | (Idle, Start, Planning) => true
    | (Planning, Plan, Executing) => true
    | (Executing, Pause, Paused) => true
    | (Paused, Resume, Executing) => true
    | (Executing, Complete, Completed) => true
    | (_, Fail(_), Failed) => true // Can fail from any state
    | _ => false
    }
  }

  let make = (from: State.t, event: Event.t, to: State.t): option<t> => {
    let transition = {from, event, to}
    if isValid(transition) {
      Some(transition)
    } else {
      None
    }
  }
}

module Context = {
  type t = {
    taskId: string,
    agentName: string,
    data: Js.Dict.t<string>,
    history: array<State.t>,
  }

  let make = (~taskId: string, ~agentName: string): t => {
    {
      taskId,
      agentName,
      data: Js.Dict.empty(),
      history: [],
    }
  }

  let set = (context: t, key: string, value: string): t => {
    let newData = Js.Dict.fromArray(Js.Dict.entries(context.data))
    Js.Dict.set(newData, key, value)
    {...context, data: newData}
  }

  let get = (context: t, key: string): option<string> => {
    Js.Dict.get(context.data, key)
  }

  let addToHistory = (context: t, state: State.t): t => {
    {...context, history: Js.Array2.concat(context.history, [state])}
  }
}

module Machine = {
  type t = {
    currentState: State.t,
    context: Context.t,
    createdAt: float,
    updatedAt: float,
  }

  let make = (~taskId: string, ~agentName: string): t => {
    let now = Js.Date.now()
    {
      currentState: Idle,
      context: Context.make(~taskId, ~agentName),
      createdAt: now,
      updatedAt: now,
    }
  }

  let transition = (machine: t, event: Event.t, targetState: State.t): result<t, string> => {
    let transition = Transition.make(machine.currentState, event, targetState)

    switch transition {
    | Some(_) => {
        let newContext = Context.addToHistory(machine.context, machine.currentState)
        Ok({
          ...machine,
          currentState: targetState,
          context: newContext,
          updatedAt: Js.Date.now(),
        })
      }
    | None => {
        let from = State.toString(machine.currentState)
        let to = State.toString(targetState)
        let evt = Event.toString(event)
        Error(`Invalid transition: ${from} -[${evt}]-> ${to}`)
      }
    }
  }

  let canTransition = (machine: t, event: Event.t, targetState: State.t): bool => {
    let transition = Transition.make(machine.currentState, event, targetState)
    Core__Option.isSome(transition)
  }

  let getCurrentState = (machine: t): State.t => machine.currentState

  let getContext = (machine: t): Context.t => machine.context

  let updateContext = (machine: t, updater: Context.t => Context.t): t => {
    {...machine, context: updater(machine.context), updatedAt: Js.Date.now()}
  }

  // Checkpoint support for resumable runs
  type checkpoint = {
    state: State.t,
    context: Context.t,
    timestamp: float,
  }

  let createCheckpoint = (machine: t): checkpoint => {
    {
      state: machine.currentState,
      context: machine.context,
      timestamp: Js.Date.now(),
    }
  }

  let restoreFromCheckpoint = (machine: t, checkpoint: checkpoint): t => {
    {
      ...machine,
      currentState: checkpoint.state,
      context: checkpoint.context,
      updatedAt: Js.Date.now(),
    }
  }
}

// JavaScript interop exports
let make = (taskId: string, agentName: string): Machine.t => {
  Machine.make(~taskId, ~agentName)
}

let transition = (machine: Machine.t, event: string, targetState: string): result<Machine.t, string> => {
  let eventObj = switch event {
  | "start" => Event.Start
  | "plan" => Event.Plan
  | "execute" => Event.Execute
  | "pause" => Event.Pause
  | "resume" => Event.Resume
  | "complete" => Event.Complete
  | _ => Event.Fail({error: "Unknown event"})
  }

  let stateObj = State.fromString(targetState)

  switch stateObj {
  | Some(state) => Machine.transition(machine, eventObj, state)
  | None => Error(`Invalid target state: ${targetState}`)
  }
}

let getCurrentState = (machine: Machine.t): string => {
  State.toString(Machine.getCurrentState(machine))
}

let canTransition = (machine: Machine.t, event: string, targetState: string): bool => {
  let eventObj = switch event {
  | "start" => Event.Start
  | "plan" => Event.Plan
  | "execute" => Event.Execute
  | "pause" => Event.Pause
  | "resume" => Event.Resume
  | "complete" => Event.Complete
  | _ => Event.Fail({error: "Unknown event"})
  }

  let stateObj = State.fromString(targetState)

  switch stateObj {
  | Some(state) => Machine.canTransition(machine, eventObj, state)
  | None => false
  }
}

let setContextData = (machine: Machine.t, key: string, value: string): Machine.t => {
  Machine.updateContext(machine, context => Context.set(context, key, value))
}

let getContextData = (machine: Machine.t, key: string): option<string> => {
  Context.get(Machine.getContext(machine), key)
}

let createCheckpoint = (machine: Machine.t): Machine.checkpoint => {
  Machine.createCheckpoint(machine)
}

let restoreFromCheckpoint = (machine: Machine.t, checkpoint: Machine.checkpoint): Machine.t => {
  Machine.restoreFromCheckpoint(machine, checkpoint)
}
