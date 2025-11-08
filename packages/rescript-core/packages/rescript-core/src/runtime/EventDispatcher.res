// Event dispatcher routes runtime events through the state machine and invokes effect handlers

open Belt

module Handler = {
  type effectHandler = (StateMachine.Effect.t, StateMachine.Context.t) => unit
  type decisionHandler = StateMachine.outcome => unit

  type t = {
    onDecision: decisionHandler,
    onEffect: effectHandler,
  }

  let placeholderEffect = (effect, _context) =>
    switch effect {
    | StateMachine.Effect.HydratePlan(taskId) => ignore(taskId)
    | StateMachine.Effect.EvaluateGuards => ()
    | StateMachine.Effect.StartExecution(taskId) => ignore(taskId)
    | StateMachine.Effect.EnterWaitState => ()
    | StateMachine.Effect.EmitTelemetry(label) => ignore(label)
    | StateMachine.Effect.ScheduleRetry => ()
    | StateMachine.Effect.PerformRollback(taskId) => ignore(taskId)
    | StateMachine.Effect.RecordCancellation(actor) => ignore(actor)
    | StateMachine.Effect.FlushTelemetryBuffer => ()
    }

  let default: t = {
    onDecision: _ => (),
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
