// Sprint 1 Day 12: Transition Validator Module
// Validates state transitions with pre/post-condition checks and error recovery
//
// Provides:
// - Pre-condition validation for transitions
// - Post-condition validation after transitions
// - Error recovery strategies (rollback, compensation)
// - Transition safety checks
// - Invalid transition detection

open Belt

// Validation result
type validationResult =
  | Valid
  | Invalid(string)

// Validation error with context
type validationError = {
  fromState: StateMachine.State.t,
  toState: StateMachine.State.t,
  event: StateMachine.Event.t,
  reason: string,
  timestamp: float,
}

// Rollback strategy
type rollbackStrategy =
  | NoRollback
  | StateRollback(StateMachine.State.t) // Rollback to specific state
  | CompensateWithEffects(array<StateMachine.Effect.t>) // Run compensating effects
  | FullRollback(StateMachine.State.t, array<StateMachine.Effect.t>) // Rollback + effects

// Error recovery action
type recoveryAction =
  | AbortTransition
  | RetryTransition(int) // Retry count
  | FallbackToState(StateMachine.State.t)
  | ExecuteRollback(rollbackStrategy)

// Validation context for comprehensive checks
type validationContext = {
  context: StateMachine.Context.t,
  previousState: option<StateMachine.State.t>,
  attemptCount: int,
  lastError: option<validationError>,
}

module PreConditionValidator = {
  // Check if state can transition based on current state
  let validateSourceState = (
    fromState: StateMachine.State.t,
    event: StateMachine.Event.t,
  ): validationResult => {
    switch (fromState, event) {
    // Bootstrapping can only accept DependenciesReady
    | (StateMachine.State.Bootstrapping, StateMachine.Event.DependenciesReady) => Valid
    | (StateMachine.State.Bootstrapping, _) =>
      Invalid("Bootstrapping state only accepts DependenciesReady event")

    // Idle can only accept TaskSubmitted
    | (StateMachine.State.Idle, StateMachine.Event.TaskSubmitted(_)) => Valid
    | (StateMachine.State.Idle, _) => Invalid("Idle state only accepts TaskSubmitted events")

    // Preparing accepts DependenciesReady, CancelRequest, Timeout
    | (StateMachine.State.Preparing, StateMachine.Event.DependenciesReady)
    | (StateMachine.State.Preparing, StateMachine.Event.CancelRequest(_))
    | (StateMachine.State.Preparing, StateMachine.Event.Timeout(_)) => Valid
    | (StateMachine.State.Preparing, _) =>
      Invalid("Preparing state only accepts DependenciesReady, CancelRequest, or Timeout")

    // WaitingOnDependency accepts DependenciesReady, RetryTrigger, CancelRequest, Timeout
    | (StateMachine.State.WaitingOnDependency, StateMachine.Event.DependenciesReady)
    | (StateMachine.State.WaitingOnDependency, StateMachine.Event.RetryTrigger)
    | (StateMachine.State.WaitingOnDependency, StateMachine.Event.CancelRequest(_))
    | (StateMachine.State.WaitingOnDependency, StateMachine.Event.Timeout(_)) => Valid
    | (StateMachine.State.WaitingOnDependency, _) =>
      Invalid(
        "WaitingOnDependency state only accepts DependenciesReady, RetryTrigger, CancelRequest, or Timeout",
      )

    // Executing accepts TelemetryFlushed, RuleViolation, Timeout, CancelRequest
    | (StateMachine.State.Executing, StateMachine.Event.TelemetryFlushed)
    | (StateMachine.State.Executing, StateMachine.Event.RuleViolation(_))
    | (StateMachine.State.Executing, StateMachine.Event.Timeout(_))
    | (StateMachine.State.Executing, StateMachine.Event.CancelRequest(_)) => Valid
    | (StateMachine.State.Executing, _) =>
      Invalid(
        "Executing state only accepts TelemetryFlushed, RuleViolation, Timeout, or CancelRequest",
      )

    // Completed only accepts TelemetryFlushed
    | (StateMachine.State.Completed, StateMachine.Event.TelemetryFlushed) => Valid
    | (StateMachine.State.Completed, _) =>
      Invalid("Completed state only accepts TelemetryFlushed")

    // Failed only accepts RetryTrigger
    | (StateMachine.State.Failed, StateMachine.Event.RetryTrigger) => Valid
    | (StateMachine.State.Failed, _) => Invalid("Failed state only accepts RetryTrigger")

    // Canceled only accepts RetryTrigger
    | (StateMachine.State.Canceled, StateMachine.Event.RetryTrigger) => Valid
    | (StateMachine.State.Canceled, _) => Invalid("Canceled state only accepts RetryTrigger")
    }
  }

  // Validate context meets requirements for transition
  let validateContext = (
    event: StateMachine.Event.t,
    context: StateMachine.Context.t,
  ): validationResult => {
    switch event {
    | StateMachine.Event.DependenciesReady =>
      // DependenciesReady requires dependenciesReady flag
      if context.dependenciesReady {
        Valid
      } else {
        Invalid("DependenciesReady event requires context.dependenciesReady = true")
      }

    | StateMachine.Event.CancelRequest(_) =>
      // CancelRequest requires cancellationRequested flag
      if context.cancellationRequested {
        Valid
      } else {
        Invalid("CancelRequest event requires context.cancellationRequested = true")
      }

    | StateMachine.Event.TelemetryFlushed =>
      // TelemetryFlushed should clear telemetryPending
      Valid

    | _ => Valid // Other events don't have specific context requirements
    }
  }

  // Validate guard verdict allows transition
  let validateGuardVerdict = (
    fromState: StateMachine.State.t,
    toState: StateMachine.State.t,
    context: StateMachine.Context.t,
  ): validationResult => {
    // Only check guard verdict when transitioning from Preparing to Executing
    switch (fromState, toState) {
    | (StateMachine.State.Preparing, StateMachine.State.Executing) =>
      switch context.guardVerdict {
      | StateMachine.GuardVerdict.Allowed => Valid
      | StateMachine.GuardVerdict.Blocked(reason) =>
        Invalid(`Guard verdict blocked transition: ${reason}`)
      }
    | _ => Valid // Guards only apply to Preparing -> Executing
    }
  }
}

module PostConditionValidator = {
  // Validate transition destination is valid
  let validateDestinationState = (
    fromState: StateMachine.State.t,
    toState: StateMachine.State.t,
    event: StateMachine.Event.t,
  ): validationResult => {
    switch (fromState, toState, event) {
    // Valid transitions from Bootstrapping
    | (StateMachine.State.Bootstrapping, StateMachine.State.Idle, StateMachine.Event.DependenciesReady) =>
      Valid

    // Valid transitions from Idle
    | (StateMachine.State.Idle, StateMachine.State.Preparing, StateMachine.Event.TaskSubmitted(_)) =>
      Valid

    // Valid transitions from Preparing
    | (StateMachine.State.Preparing, StateMachine.State.Executing, StateMachine.Event.DependenciesReady)
    | (StateMachine.State.Preparing, StateMachine.State.Canceled, StateMachine.Event.CancelRequest(_))
    | (StateMachine.State.Preparing, StateMachine.State.Failed, StateMachine.Event.Timeout(_)) =>
      Valid

    // Valid transitions from WaitingOnDependency
    | (StateMachine.State.WaitingOnDependency, StateMachine.State.Preparing, StateMachine.Event.DependenciesReady)
    | (StateMachine.State.WaitingOnDependency, StateMachine.State.Preparing, StateMachine.Event.RetryTrigger)
    | (StateMachine.State.WaitingOnDependency, StateMachine.State.Canceled, StateMachine.Event.CancelRequest(_))
    | (StateMachine.State.WaitingOnDependency, StateMachine.State.Failed, StateMachine.Event.Timeout(_)) =>
      Valid

    // Valid transitions from Executing
    | (StateMachine.State.Executing, StateMachine.State.Completed, StateMachine.Event.TelemetryFlushed)
    | (StateMachine.State.Executing, StateMachine.State.Executing, StateMachine.Event.TelemetryFlushed) // Can stay in Executing if telemetry pending
    | (StateMachine.State.Executing, StateMachine.State.Failed, StateMachine.Event.RuleViolation(_))
    | (StateMachine.State.Executing, StateMachine.State.Failed, StateMachine.Event.Timeout(_))
    | (StateMachine.State.Executing, StateMachine.State.Canceled, StateMachine.Event.CancelRequest(_)) =>
      Valid

    // Valid transitions from Completed
    | (StateMachine.State.Completed, StateMachine.State.Idle, StateMachine.Event.TelemetryFlushed) =>
      Valid

    // Valid transitions from Failed
    | (StateMachine.State.Failed, StateMachine.State.Preparing, StateMachine.Event.RetryTrigger) =>
      Valid

    // Valid transitions from Canceled
    | (StateMachine.State.Canceled, StateMachine.State.Idle, StateMachine.Event.RetryTrigger) =>
      Valid

    // All other transitions are invalid
    | (from, to, _) => {
        let fromStr = StateMachine.State.toString(from)
        let toStr = StateMachine.State.toString(to)
        Invalid(`Invalid transition from ${fromStr} to ${toStr}`)
      }
    }
  }

  // Validate effects are appropriate for transition
  let validateEffects = (
    _fromState: StateMachine.State.t,
    toState: StateMachine.State.t,
    effects: array<StateMachine.Effect.t>,
  ): validationResult => {
    // Check that rollback effects are only used when transitioning to Failed/Canceled
    let hasRollback = effects->Array.some(effect =>
      switch effect {
      | StateMachine.Effect.PerformRollback(_) => true
      | _ => false
      }
    )

    if hasRollback {
      switch toState {
      | StateMachine.State.Failed
      | StateMachine.State.Canceled => Valid
      | _ =>
        Invalid(
          `PerformRollback effect should only be used when transitioning to Failed or Canceled`,
        )
      }
    } else {
      Valid
    }
  }
}

module ErrorRecovery = {
  // Determine rollback strategy based on transition error
  let determineRollbackStrategy = (
    fromState: StateMachine.State.t,
    toState: StateMachine.State.t,
    event: StateMachine.Event.t,
  ): rollbackStrategy => {
    switch (fromState, toState, event) {
    // Timeout errors require full rollback
    | (_, StateMachine.State.Failed, StateMachine.Event.Timeout(ms)) =>
      FullRollback(
        fromState,
        [StateMachine.Effect.PerformRollback(`timeout:${Int.toString(ms)}`)],
      )

    // Rule violations require rollback with telemetry
    | (_, StateMachine.State.Failed, StateMachine.Event.RuleViolation(rule)) =>
      CompensateWithEffects([
        StateMachine.Effect.PerformRollback(rule),
        StateMachine.Effect.EmitTelemetry("rule.violation"),
      ])

    // Cancellations require state rollback + recording
    | (_, StateMachine.State.Canceled, StateMachine.Event.CancelRequest(payload)) =>
      CompensateWithEffects([
        StateMachine.Effect.RecordCancellation(payload.requestedBy),
        StateMachine.Effect.EmitTelemetry("task.canceled"),
      ])

    // For other failures, simple state rollback
    | (_, StateMachine.State.Failed, _) => StateRollback(StateMachine.State.Idle)

    // No rollback needed for successful transitions
    | _ => NoRollback
    }
  }

  // Determine recovery action based on validation error
  let determineRecoveryAction = (
    error: validationError,
    validationCtx: validationContext,
  ): recoveryAction => {
    // Check attempt count for retry logic
    if validationCtx.attemptCount >= 3 {
      // Too many attempts, abort
      AbortTransition
    } else {
      switch error.fromState {
      // For Preparing state errors, try fallback to WaitingOnDependency
      | StateMachine.State.Preparing =>
        FallbackToState(StateMachine.State.WaitingOnDependency)

      // For Executing state errors, execute rollback
      | StateMachine.State.Executing => {
          let strategy = determineRollbackStrategy(
            error.fromState,
            error.toState,
            error.event,
          )
          ExecuteRollback(strategy)
        }

      // For other states, retry with incremented count
      | _ => RetryTransition(validationCtx.attemptCount + 1)
      }
    }
  }

  // Execute rollback based on strategy
  let executeRollback = (strategy: rollbackStrategy): (StateMachine.State.t, array<StateMachine.Effect.t>) => {
    switch strategy {
    | NoRollback => (StateMachine.State.Idle, [])
    | StateRollback(state) => (state, [])
    | CompensateWithEffects(effects) => (StateMachine.State.Idle, effects)
    | FullRollback(state, effects) => (state, effects)
    }
  }
}

module TransitionValidation = {
  // Comprehensive validation of a transition
  let validateTransition = (
    fromState: StateMachine.State.t,
    toState: StateMachine.State.t,
    event: StateMachine.Event.t,
    context: StateMachine.Context.t,
    effects: array<StateMachine.Effect.t>,
  ): validationResult => {
    // Step 1: Validate source state
    let sourceValid = PreConditionValidator.validateSourceState(fromState, event)
    switch sourceValid {
    | Invalid(_) => sourceValid
    | Valid => {
        // Step 2: Validate context
        let contextValid = PreConditionValidator.validateContext(event, context)
        switch contextValid {
        | Invalid(_) => contextValid
        | Valid => {
            // Step 3: Validate guard verdict
            let guardValid = PreConditionValidator.validateGuardVerdict(
              fromState,
              toState,
              context,
            )
            switch guardValid {
            | Invalid(_) => guardValid
            | Valid => {
                // Step 4: Validate destination state
                let destValid = PostConditionValidator.validateDestinationState(
                  fromState,
                  toState,
                  event,
                )
                switch destValid {
                | Invalid(_) => destValid
                | Valid => {
                    // Step 5: Validate effects
                    PostConditionValidator.validateEffects(fromState, toState, effects)
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Validate and recover from transition errors
  let validateWithRecovery = (
    fromState: StateMachine.State.t,
    toState: StateMachine.State.t,
    event: StateMachine.Event.t,
    context: StateMachine.Context.t,
    effects: array<StateMachine.Effect.t>,
    validationCtx: validationContext,
  ): (validationResult, option<recoveryAction>) => {
    let result = validateTransition(fromState, toState, event, context, effects)

    switch result {
    | Valid => (Valid, None)
    | Invalid(reason) => {
        let error = {
          fromState: fromState,
          toState: toState,
          event: event,
          reason: reason,
          timestamp: Js.Date.now(),
        }

        let recoveryAction = ErrorRecovery.determineRecoveryAction(error, validationCtx)
        (Invalid(reason), Some(recoveryAction))
      }
    }
  }
}

// Export types and functions for JavaScript/TypeScript consumption
let validateTransition = TransitionValidation.validateTransition
let validateWithRecovery = TransitionValidation.validateWithRecovery
let determineRollbackStrategy = ErrorRecovery.determineRollbackStrategy
let executeRollback = ErrorRecovery.executeRollback

// Helper to create validation context
let createValidationContext = (
  context: StateMachine.Context.t,
  ~previousState: option<StateMachine.State.t>=?,
  ~attemptCount: int=0,
  ~lastError: option<validationError>=?,
  ()
): validationContext => {
  context: context,
  previousState: previousState,
  attemptCount: attemptCount,
  lastError: lastError,
}
