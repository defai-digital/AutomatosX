// Runtime State Machine skeleton for AutomatosX v2
// Provides typed states, events, effects, and transition outcomes

open Belt

module State = {
  type t =
    | Bootstrapping
    | Idle
    | Preparing
    | WaitingOnDependency
    | Executing
    | Completed
    | Failed
    | Canceled

  let toString = state =>
    switch state {
    | Bootstrapping => "BOOTSTRAPPING"
    | Idle => "IDLE"
    | Preparing => "PREPARING"
    | WaitingOnDependency => "WAITING_ON_DEP"
    | Executing => "EXECUTING"
    | Completed => "COMPLETED"
    | Failed => "FAILED"
    | Canceled => "CANCELED"
    }
}

module GuardVerdict = {
  type t =
    | Allowed
    | Blocked(string)

  let toString = verdict =>
    switch verdict {
    | Allowed => "ALLOWED"
    | Blocked(reason) => `BLOCKED:${reason}`
    }
}

module Event = {
  type submission = {
    taskId: string,
    manifestVersion: string,
  }

  type cancellation = {
    requestedBy: string,
  }

  type t =
    | TaskSubmitted(submission)
    | DependenciesReady
    | RuleViolation(string)
    | Timeout(int)
    | CancelRequest(cancellation)
    | RetryTrigger
    | TelemetryFlushed

  let toString = event =>
    switch event {
    | TaskSubmitted(payload) =>
      `TASK_SUBMITTED:${payload.taskId}@${payload.manifestVersion}`
    | DependenciesReady => "DEPS_READY"
    | RuleViolation(rule) => `RULE_VIOLATION:${rule}`
    | Timeout(ms) => `TIMEOUT:${Int.toString(ms)}`
    | CancelRequest(payload) => `CANCEL_REQUEST:${payload.requestedBy}`
    | RetryTrigger => "RETRY_TRIGGER"
    | TelemetryFlushed => "TELEMETRY_FLUSHED"
    }
}

module Effect = {
  type t =
    | HydratePlan(string)
    | EvaluateGuards
    | StartExecution(string)
    | EnterWaitState
    | EmitTelemetry(string)
    | ScheduleRetry
    | PerformRollback(string)
    | RecordCancellation(string)
    | FlushTelemetryBuffer

  let toString = effect =>
    switch effect {
    | HydratePlan(taskId) => `HydratePlan(${taskId})`
    | EvaluateGuards => "EvaluateGuards"
    | StartExecution(taskId) => `StartExecution(${taskId})`
    | EnterWaitState => "EnterWaitState"
    | EmitTelemetry(label) => `EmitTelemetry(${label})`
    | ScheduleRetry => "ScheduleRetry"
    | PerformRollback(taskId) => `PerformRollback(${taskId})`
    | RecordCancellation(actor) => `RecordCancellation(${actor})`
    | FlushTelemetryBuffer => "FlushTelemetryBuffer"
    }
}

module Context = {
  type t = {
    dependenciesReady: bool,
    guardVerdict: GuardVerdict.t,
    telemetryPending: bool,
    cancellationRequested: bool,
  }
}

type status =
  | Transitioned
  | Rejected
  | Deferred

type outcome = {
  status: status,
  fromState: State.t,
  toState: State.t,
  event: Event.t,
  effects: array<Effect.t>,
  reason: option<string>,
}

let emptyEffects: array<Effect.t> = []

let defaultContext: Context.t = {
  dependenciesReady: false,
  guardVerdict: GuardVerdict.Allowed,
  telemetryPending: false,
  cancellationRequested: false,
}

let makeContext = (
  ~dependenciesReady: option<bool>=?,
  ~guardVerdict: option<GuardVerdict.t>=?,
  ~telemetryPending: option<bool>=?,
  ~cancellationRequested: option<bool>=?,
  ()
): Context.t => {
  let deps =
    switch dependenciesReady {
    | Some(value) => value
    | None => defaultContext.dependenciesReady
    }

  let guards =
    switch guardVerdict {
    | Some(value) => value
    | None => defaultContext.guardVerdict
    }

  let telemetry =
    switch telemetryPending {
    | Some(value) => value
    | None => defaultContext.telemetryPending
    }

  let cancellation =
    switch cancellationRequested {
    | Some(value) => value
    | None => defaultContext.cancellationRequested
    }

  {
    dependenciesReady: deps,
    guardVerdict: guards,
    telemetryPending: telemetry,
    cancellationRequested: cancellation,
  }
}

let allowGuards = () => GuardVerdict.Allowed
let blockGuards = reason => GuardVerdict.Blocked(reason)

let transitioned = (fromState, toState, event, effects) => {
  status: Transitioned,
  fromState: fromState,
  toState: toState,
  event: event,
  effects: effects,
  reason: None,
}

let rejected = (state, event, reason) => {
  status: Rejected,
  fromState: state,
  toState: state,
  event: event,
  effects: emptyEffects,
  reason: Some(reason),
}

let deferred = (state, event, reason) => {
  status: Deferred,
  fromState: state,
  toState: state,
  event: event,
  effects: [Effect.EmitTelemetry("transition.deferred")],
  reason: Some(reason),
}

let transition = (state: State.t, event: Event.t, context: Context.t) =>
  switch state {
  | State.Bootstrapping =>
    switch event {
    | Event.DependenciesReady =>
      transitioned(
        State.Bootstrapping,
        State.Idle,
        event,
        [Effect.EmitTelemetry("runtime.bootstrapped")],
      )
    | _ =>
      rejected(
        State.Bootstrapping,
        event,
        "Runtime must finish bootstrapping before processing events.",
      )
    }
  | State.Idle =>
    switch event {
    | Event.TaskSubmitted(payload) =>
      transitioned(
        State.Idle,
        State.Preparing,
        event,
        [
          Effect.HydratePlan(payload.taskId),
          Effect.EmitTelemetry("task.accepted"),
        ],
      )
    | _ => rejected(State.Idle, event, "Idle state only accepts task submissions.")
    }
  | State.Preparing =>
    switch event {
    | Event.DependenciesReady =>
      if context.dependenciesReady {
        switch context.guardVerdict {
        | GuardVerdict.Allowed =>
          transitioned(
            State.Preparing,
            State.Executing,
            event,
            [Effect.EvaluateGuards, Effect.StartExecution("plan")],
          )
        | GuardVerdict.Blocked(reason) =>
          rejected(State.Preparing, event, `Guard blocked transition: ${reason}`)
        }
      } else {
        deferred(State.Preparing, event, "Dependencies not confirmed by controller.")
      }
    | Event.CancelRequest(payload) =>
      if context.cancellationRequested {
        transitioned(
          State.Preparing,
          State.Canceled,
          event,
          [Effect.RecordCancellation(payload.requestedBy)],
        )
      } else {
        rejected(State.Preparing, event, "Cancellation request not acknowledged.")
      }
    | Event.Timeout(ms) =>
      transitioned(
        State.Preparing,
        State.Failed,
        event,
        [Effect.PerformRollback(`timeout:${Int.toString(ms)}`)],
      )
    | _ =>
      rejected(State.Preparing, event, "Preparing state only responds to deps/cancel/timeouts.")
    }
  | State.WaitingOnDependency =>
    switch event {
    | Event.DependenciesReady =>
      if context.dependenciesReady {
        transitioned(
          State.WaitingOnDependency,
          State.Preparing,
          event,
          [Effect.EmitTelemetry("dependencies.ready")],
        )
      } else {
        deferred(
          State.WaitingOnDependency,
          event,
          "Dependency graph not ready; remaining in wait state.",
        )
      }
    | Event.RetryTrigger =>
      transitioned(
        State.WaitingOnDependency,
        State.Preparing,
        event,
        [Effect.ScheduleRetry],
      )
    | Event.CancelRequest(payload) =>
      transitioned(
        State.WaitingOnDependency,
        State.Canceled,
        event,
        [Effect.RecordCancellation(payload.requestedBy)],
      )
    | Event.Timeout(ms) =>
      transitioned(
        State.WaitingOnDependency,
        State.Failed,
        event,
        [Effect.PerformRollback(`wait-timeout:${Int.toString(ms)}`)],
      )
    | _ =>
      rejected(
        State.WaitingOnDependency,
        event,
        "Waiting state expects dependency updates, retries, or cancellation.",
      )
    }
  | State.Executing =>
    switch event {
    | Event.TelemetryFlushed =>
      let nextState =
        if context.telemetryPending {
          State.Executing
        } else {
          State.Completed
        }

      transitioned(
        State.Executing,
        nextState,
        event,
        [Effect.FlushTelemetryBuffer],
      )
    | Event.RuleViolation(rule) =>
      transitioned(
        State.Executing,
        State.Failed,
        event,
        [Effect.PerformRollback(rule)],
      )
    | Event.Timeout(ms) =>
      transitioned(
        State.Executing,
        State.Failed,
        event,
        [Effect.PerformRollback(`execution-timeout:${Int.toString(ms)}`)],
      )
    | Event.CancelRequest(payload) =>
      transitioned(
        State.Executing,
        State.Canceled,
        event,
        [
          Effect.RecordCancellation(payload.requestedBy),
          Effect.PerformRollback("canceled"),
        ],
      )
    | _ =>
      rejected(State.Executing, event, "Executing state ignores unrelated events.")
    }
  | State.Completed =>
    switch event {
    | Event.TelemetryFlushed =>
      transitioned(
        State.Completed,
        State.Idle,
        event,
        [Effect.EmitTelemetry("task.completed")],
      )
    | _ => rejected(State.Completed, event, "Completed tasks await telemetry flush only.")
    }
  | State.Failed =>
    switch event {
    | Event.RetryTrigger =>
      transitioned(
        State.Failed,
        State.Preparing,
        event,
        [Effect.ScheduleRetry],
      )
    | _ =>
      rejected(State.Failed, event, "Failed state only responds to retry triggers.")
    }
  | State.Canceled =>
    switch event {
    | Event.RetryTrigger =>
      transitioned(
        State.Canceled,
        State.Idle,
        event,
        [Effect.EmitTelemetry("task.canceled.retry")],
      )
    | _ =>
      rejected(State.Canceled, event, "Canceled state only allows retries into idle.")
    }
  }

let statusToString = status =>
  switch status {
  | Transitioned => "transitioned"
  | Rejected => "rejected"
  | Deferred => "deferred"
  }

type serializedOutcome = {
  status: string,
  fromState: string,
  toState: string,
  event: string,
  effects: array<string>,
  reason: Js.Nullable.t<string>,
}

let serializeOutcome = (outcome: outcome) => {
  {
    status: statusToString(outcome.status),
    fromState: State.toString(outcome.fromState),
    toState: State.toString(outcome.toState),
    event: Event.toString(outcome.event),
    effects: outcome.effects->Array.map(Effect.toString),
    reason: outcome.reason->Js.Nullable.fromOption,
  }
}
