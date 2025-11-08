// Event dispatcher routes runtime events through the state machine and invokes effect handlers
// Sprint 1 Day 2: Wiring telemetry hook stubs for structured event emission

open Belt

// Telemetry event payload structure
type telemetryEvent = {
  timestamp: float,
  eventType: string,
  payload: Js.Dict.t<Js.Json.t>,
}

// Helper: Create telemetry event with timestamp
let createTelemetryEvent = (eventType: string, payload: Js.Dict.t<Js.Json.t>): telemetryEvent => {
  timestamp: Js.Date.now(),
  eventType: eventType,
  payload: payload,
}

// Helper: Emit telemetry event (stub implementation - logs to console)
let emitTelemetryEvent = (event: telemetryEvent): unit => {
  // Stub: Log structured telemetry to console
  // TODO: Replace with actual telemetry backend integration (Day 3+)
  let payloadJson = Js.Json.object_(event.payload)
  Js.log(`[Telemetry] ${event.eventType} @ ${Belt.Float.toString(event.timestamp)}`)
  Js.log2("[Telemetry] Payload:", payloadJson)
}

// Helper: Create payload dict from key-value pairs
let createPayload = (pairs: array<(string, Js.Json.t)>): Js.Dict.t<Js.Json.t> => {
  let dict = Js.Dict.empty()
  pairs->Array.forEach(((key, value)) => {
    Js.Dict.set(dict, key, value)
  })
  dict
}

module Handler = {
  type effectHandler = (StateMachine.Effect.t, StateMachine.Context.t) => unit
  type decisionHandler = StateMachine.outcome => unit

  type t = {
    onDecision: decisionHandler,
    onEffect: effectHandler,
  }

  // Effect handler with telemetry emission stubs
  let placeholderEffect = (effect: StateMachine.Effect.t, context: StateMachine.Context.t) =>
    switch effect {
    | StateMachine.Effect.HydratePlan(taskId) => {
        let payload = createPayload([
          ("taskId", Js.Json.string(taskId)),
          ("dependenciesReady", Js.Json.boolean(context.dependenciesReady)),
        ])
        emitTelemetryEvent(createTelemetryEvent("plan.hydrated", payload))
      }
    | StateMachine.Effect.EvaluateGuards => {
        let guardVerdictStr = StateMachine.GuardVerdict.toString(context.guardVerdict)
        let payload = createPayload([
          ("verdict", Js.Json.string(guardVerdictStr)),
        ])
        emitTelemetryEvent(createTelemetryEvent("guards.evaluated", payload))
      }
    | StateMachine.Effect.StartExecution(taskId) => {
        let payload = createPayload([
          ("taskId", Js.Json.string(taskId)),
        ])
        emitTelemetryEvent(createTelemetryEvent("execution.started", payload))
      }
    | StateMachine.Effect.EnterWaitState => {
        let payload = createPayload([
          ("reason", Js.Json.string("dependencies_not_ready")),
        ])
        emitTelemetryEvent(createTelemetryEvent("wait_state.entered", payload))
      }
    | StateMachine.Effect.EmitTelemetry(label) => {
        let payload = createPayload([
          ("label", Js.Json.string(label)),
        ])
        emitTelemetryEvent(createTelemetryEvent("custom.event", payload))
      }
    | StateMachine.Effect.ScheduleRetry => {
        let payload = createPayload([
          ("scheduled", Js.Json.boolean(true)),
        ])
        emitTelemetryEvent(createTelemetryEvent("retry.scheduled", payload))
      }
    | StateMachine.Effect.PerformRollback(reason) => {
        let payload = createPayload([
          ("reason", Js.Json.string(reason)),
        ])
        emitTelemetryEvent(createTelemetryEvent("rollback.performed", payload))
      }
    | StateMachine.Effect.RecordCancellation(actor) => {
        let payload = createPayload([
          ("actor", Js.Json.string(actor)),
        ])
        emitTelemetryEvent(createTelemetryEvent("cancellation.recorded", payload))
      }
    | StateMachine.Effect.FlushTelemetryBuffer => {
        let payload = createPayload([
          ("flushed", Js.Json.boolean(true)),
        ])
        emitTelemetryEvent(createTelemetryEvent("telemetry.flushed", payload))
      }
    }

  // Decision handler that emits telemetry for all state transitions
  let telemetryDecisionHandler = (decision: StateMachine.outcome): unit => {
    let payload = createPayload([
      ("status", Js.Json.string(StateMachine.statusToString(decision.status))),
      ("fromState", Js.Json.string(StateMachine.State.toString(decision.fromState))),
      ("toState", Js.Json.string(StateMachine.State.toString(decision.toState))),
      ("event", Js.Json.string(StateMachine.Event.toString(decision.event))),
      ("effectCount", Js.Json.number(Belt.Int.toFloat(Array.length(decision.effects)))),
    ])

    // Add reason if present
    switch decision.reason {
    | Some(reason) => Js.Dict.set(payload, "reason", Js.Json.string(reason))
    | None => ()
    }

    emitTelemetryEvent(createTelemetryEvent("transition.executed", payload))
  }

  let default: t = {
    onDecision: telemetryDecisionHandler,
    onEffect: placeholderEffect,
  }
}

let applyEffects = (
  effects: array<StateMachine.Effect.t>,
  context: StateMachine.Context.t,
  handler: Handler.effectHandler,
) =>
  effects->Array.forEach(effect => handler(effect, context))

let dispatchWithHandlers = (
  state: StateMachine.State.t,
  event: StateMachine.Event.t,
  context: StateMachine.Context.t,
  handlers: Handler.t,
) => {
  let decision = StateMachine.transition(state, event, context)
  handlers.onDecision(decision)
  applyEffects(decision.effects, context, handlers.onEffect)
  decision
}

let dispatch = (
  state: StateMachine.State.t,
  event: StateMachine.Event.t,
  context: StateMachine.Context.t,
) =>
  dispatchWithHandlers(state, event, context, Handler.default)

let dispatchSerialized = (
  state: StateMachine.State.t,
  event: StateMachine.Event.t,
  context: StateMachine.Context.t,
  handlers: Handler.t,
) =>
  dispatchWithHandlers(state, event, context, handlers)->StateMachine.serializeOutcome
