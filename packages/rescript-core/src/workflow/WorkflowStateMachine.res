// WorkflowStateMachine.res - Day 1: Deterministic Workflow State Machine
// Complete state machine for workflow orchestration with ReScript type safety

module State = {
  type t =
    | Idle
    | Parsing
    | Validating
    | Executing
    | Paused
    | Completed
    | Failed
    | Cancelled

  let toString = (state: t): string => {
    switch state {
    | Idle => "idle"
    | Parsing => "parsing"
    | Validating => "validating"
    | Executing => "executing"
    | Paused => "paused"
    | Completed => "completed"
    | Failed => "failed"
    | Cancelled => "cancelled"
    }
  }

  let fromString = (str: string): option<t> => {
    switch str {
    | "idle" => Some(Idle)
    | "parsing" => Some(Parsing)
    | "validating" => Some(Validating)
    | "executing" => Some(Executing)
    | "paused" => Some(Paused)
    | "completed" => Some(Completed)
    | "failed" => Some(Failed)
    | "cancelled" => Some(Cancelled)
    | _ => None
    }
  }

  let isTerminal = (state: t): bool => {
    switch state {
    | Completed | Failed | Cancelled => true
    | _ => false
    }
  }

  let isActive = (state: t): bool => {
    switch state {
    | Executing | Parsing | Validating => true
    | _ => false
    }
  }
}

module Event = {
  type t =
    | Start
    | Parse
    | Validate
    | Execute
    | Pause
    | Resume
    | Complete
    | Fail({error: string})
    | Cancel

  let toString = (event: t): string => {
    switch event {
    | Start => "start"
    | Parse => "parse"
    | Validate => "validate"
    | Execute => "execute"
    | Pause => "pause"
    | Resume => "resume"
    | Complete => "complete"
    | Fail(_) => "fail"
    | Cancel => "cancel"
    }
  }

  let getError = (event: t): option<string> => {
    switch event {
    | Fail({error}) => Some(error)
    | _ => None
    }
  }
}

module StepState = {
  type status =
    | Pending
    | Running
    | Completed
    | Failed
    | Skipped

  type t = {
    id: string,
    status: status,
    startedAt: option<float>,
    completedAt: option<float>,
    error: option<string>,
    result: option<Js.Dict.t<string>>,
  }

  let make = (id: string): t => {
    {
      id,
      status: Pending,
      startedAt: None,
      completedAt: None,
      error: None,
      result: None,
    }
  }

  let statusToString = (status: status): string => {
    switch status {
    | Pending => "pending"
    | Running => "running"
    | Completed => "completed"
    | Failed => "failed"
    | Skipped => "skipped"
    }
  }

  let statusFromString = (str: string): option<status> => {
    switch str {
    | "pending" => Some(Pending)
    | "running" => Some(Running)
    | "completed" => Some(Completed)
    | "failed" => Some(Failed)
    | "skipped" => Some(Skipped)
    | _ => None
    }
  }

  let start = (step: t): t => {
    {
      ...step,
      status: Running,
      startedAt: Some(Js.Date.now()),
    }
  }

  let complete = (step: t, result: Js.Dict.t<string>): t => {
    {
      ...step,
      status: Completed,
      completedAt: Some(Js.Date.now()),
      result: Some(result),
    }
  }

  let fail = (step: t, error: string): t => {
    {
      ...step,
      status: Failed,
      completedAt: Some(Js.Date.now()),
      error: Some(error),
    }
  }

  let skip = (step: t): t => {
    {
      ...step,
      status: Skipped,
      completedAt: Some(Js.Date.now()),
    }
  }
}

module Context = {
  type t = {
    workflowId: string,
    workflowName: string,
    variables: Js.Dict.t<string>,
    steps: array<StepState.t>,
    currentStepIndex: int,
    history: array<State.t>,
    error: option<string>,
    startedAt: option<float>,
    completedAt: option<float>,
    pausedAt: option<float>,
  }

  let make = (~workflowId: string, ~workflowName: string, ~steps: array<string>): t => {
    {
      workflowId,
      workflowName,
      variables: Js.Dict.empty(),
      steps: Belt.Array.map(steps, StepState.make),
      currentStepIndex: 0,
      history: [State.Idle],
      error: None,
      startedAt: None,
      completedAt: None,
      pausedAt: None,
    }
  }

  let setVariable = (ctx: t, key: string, value: string): t => {
    let variables = Js.Dict.fromArray(Js.Dict.entries(ctx.variables))
    Js.Dict.set(variables, key, value)
    {...ctx, variables}
  }

  let getVariable = (ctx: t, key: string): option<string> => {
    Js.Dict.get(ctx.variables, key)
  }

  let updateStep = (ctx: t, stepId: string, updateFn: StepState.t => StepState.t): t => {
    let steps = Belt.Array.map(ctx.steps, step => {
      if step.id == stepId {
        updateFn(step)
      } else {
        step
      }
    })
    {...ctx, steps}
  }

  let getCurrentStep = (ctx: t): option<StepState.t> => {
    Belt.Array.get(ctx.steps, ctx.currentStepIndex)
  }

  let advanceStep = (ctx: t): t => {
    {...ctx, currentStepIndex: ctx.currentStepIndex + 1}
  }

  let setError = (ctx: t, error: string): t => {
    {...ctx, error: Some(error)}
  }

  let recordState = (ctx: t, state: State.t): t => {
    {...ctx, history: Belt.Array.concat(ctx.history, [state])}
  }

  let getCompletedSteps = (ctx: t): array<StepState.t> => {
    Belt.Array.keep(ctx.steps, step => {
      step.status == StepState.Completed
    })
  }

  let getFailedSteps = (ctx: t): array<StepState.t> => {
    Belt.Array.keep(ctx.steps, step => {
      step.status == StepState.Failed
    })
  }

  let getPendingSteps = (ctx: t): array<StepState.t> => {
    Belt.Array.keep(ctx.steps, step => {
      step.status == StepState.Pending
    })
  }

  let isComplete = (ctx: t): bool => {
    ctx.currentStepIndex >= Belt.Array.length(ctx.steps)
  }

  let hasFailed = (ctx: t): bool => {
    Belt.Array.some(ctx.steps, step => step.status == StepState.Failed)
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
    // Start workflow: Idle -> Parsing
    | (Idle, Start, Parsing) => true

    // Parse workflow: Parsing -> Validating
    | (Parsing, Parse, Validating) => true

    // Validate workflow: Validating -> Executing
    | (Validating, Validate, Executing) => true

    // Execute workflow: Executing -> Executing (step-by-step)
    | (Executing, Execute, Executing) => true

    // Pause execution: Executing -> Paused
    | (Executing, Pause, Paused) => true

    // Resume execution: Paused -> Executing
    | (Paused, Resume, Executing) => true

    // Complete workflow: Executing -> Completed
    | (Executing, Complete, Completed) => true

    // Cancel workflow: Any active state -> Cancelled
    | (Idle, Cancel, Cancelled) => true
    | (Parsing, Cancel, Cancelled) => true
    | (Validating, Cancel, Cancelled) => true
    | (Executing, Cancel, Cancelled) => true
    | (Paused, Cancel, Cancelled) => true

    // Fail workflow: Any non-terminal state -> Failed
    | (Idle, Fail(_), Failed) => true
    | (Parsing, Fail(_), Failed) => true
    | (Validating, Fail(_), Failed) => true
    | (Executing, Fail(_), Failed) => true
    | (Paused, Fail(_), Failed) => true

    // Invalid transitions
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

module Guards = {
  type t = Context.t => bool

  let canStart: t = ctx => {
    Belt.Array.length(ctx.steps) > 0
  }

  let canParse: t = _ctx => {
    true // Always can parse after starting
  }

  let canValidate: t = _ctx => {
    true // Always can validate after parsing
  }

  let canExecute: t = ctx => {
    !Context.isComplete(ctx)
  }

  let canPause: t = ctx => {
    State.isActive(Belt.Array.getExn(ctx.history, Belt.Array.length(ctx.history) - 1))
  }

  let canResume: t = ctx => {
    Belt.Option.isNone(ctx.pausedAt) == false
  }

  let canComplete: t = ctx => {
    Context.isComplete(ctx) && !Context.hasFailed(ctx)
  }

  let canCancel: t = ctx => {
    !State.isTerminal(Belt.Array.getExn(ctx.history, Belt.Array.length(ctx.history) - 1))
  }

  let check = (event: Event.t, ctx: Context.t): bool => {
    switch event {
    | Start => canStart(ctx)
    | Parse => canParse(ctx)
    | Validate => canValidate(ctx)
    | Execute => canExecute(ctx)
    | Pause => canPause(ctx)
    | Resume => canResume(ctx)
    | Complete => canComplete(ctx)
    | Fail(_) => true // Can always fail
    | Cancel => canCancel(ctx)
    }
  }
}

module type StateMachine = {
  type t

  let make: (~workflowId: string, ~workflowName: string, ~steps: array<string>) => t
  let getState: t => State.t
  let getContext: t => Context.t
  let transition: (t, Event.t) => result<t, string>
  let canTransition: (t, Event.t) => bool
  let setVariable: (t, string, string) => t
  let getVariable: (t, string) => option<string>
  let updateStep: (t, string, StepState.t => StepState.t) => t
  let getCurrentStep: t => option<StepState.t>
  let getCompletedSteps: t => array<StepState.t>
  let getFailedSteps: t => array<StepState.t>
  let getPendingSteps: t => array<StepState.t>
  let serialize: t => Js.Dict.t<string>
  let deserialize: Js.Dict.t<string> => option<t>
}

module Machine: StateMachine = {
  type t = {
    state: State.t,
    context: Context.t,
  }

  let make = (~workflowId: string, ~workflowName: string, ~steps: array<string>): t => {
    {
      state: Idle,
      context: Context.make(~workflowId, ~workflowName, ~steps),
    }
  }

  let getState = (machine: t): State.t => machine.state

  let getContext = (machine: t): Context.t => machine.context

  let transition = (machine: t, event: Event.t): result<t, string> => {
    let currentState = machine.state

    // Check guards before transition
    if !Guards.check(event, machine.context) {
      Error("Guard check failed for event: " ++ Event.toString(event))
    } else {
      // Determine next state
      let nextState = switch event {
      | Start => State.Parsing
      | Parse => State.Validating
      | Validate => State.Executing
      | Execute => State.Executing
      | Pause => State.Paused
      | Resume => State.Executing
      | Complete => State.Completed
      | Fail(_) => State.Failed
      | Cancel => State.Cancelled
      }

      // Validate transition
      switch Transition.make(currentState, event, nextState) {
      | None => Error("Invalid transition from " ++ State.toString(currentState) ++ " with event " ++ Event.toString(event))
      | Some(_) => {
          // Update context based on event
          let updatedContext = switch event {
          | Start => {
              ...machine.context,
              startedAt: Some(Js.Date.now()),
              history: Belt.Array.concat(machine.context.history, [nextState]),
            }
          | Pause => {
              ...machine.context,
              pausedAt: Some(Js.Date.now()),
              history: Belt.Array.concat(machine.context.history, [nextState]),
            }
          | Resume => {
              ...machine.context,
              pausedAt: None,
              history: Belt.Array.concat(machine.context.history, [nextState]),
            }
          | Complete => {
              ...machine.context,
              completedAt: Some(Js.Date.now()),
              history: Belt.Array.concat(machine.context.history, [nextState]),
            }
          | Fail({error}) => {
              ...machine.context,
              error: Some(error),
              completedAt: Some(Js.Date.now()),
              history: Belt.Array.concat(machine.context.history, [nextState]),
            }
          | Cancel => {
              ...machine.context,
              completedAt: Some(Js.Date.now()),
              history: Belt.Array.concat(machine.context.history, [nextState]),
            }
          | _ => Context.recordState(machine.context, nextState)
          }

          Ok({state: nextState, context: updatedContext})
        }
      }
    }
  }

  let canTransition = (machine: t, event: Event.t): bool => {
    Guards.check(event, machine.context)
  }

  let setVariable = (machine: t, key: string, value: string): t => {
    {
      ...machine,
      context: Context.setVariable(machine.context, key, value),
    }
  }

  let getVariable = (machine: t, key: string): option<string> => {
    Context.getVariable(machine.context, key)
  }

  let updateStep = (machine: t, stepId: string, updateFn: StepState.t => StepState.t): t => {
    {
      ...machine,
      context: Context.updateStep(machine.context, stepId, updateFn),
    }
  }

  let getCurrentStep = (machine: t): option<StepState.t> => {
    Context.getCurrentStep(machine.context)
  }

  let getCompletedSteps = (machine: t): array<StepState.t> => {
    Context.getCompletedSteps(machine.context)
  }

  let getFailedSteps = (machine: t): array<StepState.t> => {
    Context.getFailedSteps(machine.context)
  }

  let getPendingSteps = (machine: t): array<StepState.t> => {
    Context.getPendingSteps(machine.context)
  }

  let serialize = (machine: t): Js.Dict.t<string> => {
    let dict = Js.Dict.empty()
    Js.Dict.set(dict, "state", State.toString(machine.state))
    Js.Dict.set(dict, "workflowId", machine.context.workflowId)
    Js.Dict.set(dict, "workflowName", machine.context.workflowName)
    Js.Dict.set(dict, "currentStepIndex", Belt.Int.toString(machine.context.currentStepIndex))

    // Serialize variables as JSON string
    let variablesJson = Js.Dict.entries(machine.context.variables)
      ->Belt.Array.map(((k, v)) => (k, Js.Json.string(v)))
      ->Js.Dict.fromArray
    Js.Dict.set(dict, "variables", Js.Json.stringify(Js.Json.object_(variablesJson)))

    // Serialize steps
    let stepsJson = Belt.Array.map(machine.context.steps, step => {
      let stepDict = Js.Dict.empty()
      Js.Dict.set(stepDict, "id", Js.Json.string(step.id))
      Js.Dict.set(stepDict, "status", Js.Json.string(StepState.statusToString(step.status)))
      Js.Json.object_(stepDict)
    })
    Js.Dict.set(dict, "steps", Js.Json.stringify(Js.Json.array(stepsJson)))

    dict
  }

  let deserialize = (dict: Js.Dict.t<string>): option<t> => {
    switch (Js.Dict.get(dict, "state"), Js.Dict.get(dict, "workflowId"), Js.Dict.get(dict, "workflowName")) {
    | (Some(stateStr), Some(workflowId), Some(workflowName)) => {
        switch State.fromString(stateStr) {
        | Some(state) => {
            // Create base machine
            let machine = make(~workflowId, ~workflowName, ~steps=[])
            Some({...machine, state})
          }
        | None => None
        }
      }
    | _ => None
    }
  }
}

// Export factory functions for TypeScript interop
@genType
let make = Machine.make

@genType
let getState = Machine.getState

@genType
let getContext = Machine.getContext

@genType
let transition = Machine.transition

@genType
let canTransition = Machine.canTransition

@genType
let setVariable = Machine.setVariable

@genType
let getVariable = Machine.getVariable

@genType
let updateStep = Machine.updateStep

@genType
let getCurrentStep = Machine.getCurrentStep

@genType
let getCompletedSteps = Machine.getCompletedSteps

@genType
let getFailedSteps = Machine.getFailedSteps

@genType
let getPendingSteps = Machine.getPendingSteps

@genType
let serialize = Machine.serialize

@genType
let deserialize = Machine.deserialize

// Export state and event constructors for TypeScript
@genType
let stateIdle = State.Idle

@genType
let stateParsing = State.Parsing

@genType
let stateValidating = State.Validating

@genType
let stateExecuting = State.Executing

@genType
let statePaused = State.Paused

@genType
let stateCompleted = State.Completed

@genType
let stateFailed = State.Failed

@genType
let stateCancelled = State.Cancelled

@genType
let eventStart = Event.Start

@genType
let eventParse = Event.Parse

@genType
let eventValidate = Event.Validate

@genType
let eventExecute = Event.Execute

@genType
let eventPause = Event.Pause

@genType
let eventResume = Event.Resume

@genType
let eventComplete = Event.Complete

@genType
let eventCancel = Event.Cancel

@genType
let eventFail = (error: string) => Event.Fail({error: error})
