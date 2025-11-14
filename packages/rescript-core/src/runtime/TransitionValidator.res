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
  fromState: TaskStateMachine.State.t,
  toState: TaskStateMachine.State.t,
  event: TaskStateMachine.Event.t,
  reason: string,
  timestamp: float,
}

// Rollback strategy
type rollbackStrategy =
  | NoRollback
  | StateRollback(TaskStateMachine.State.t) // Rollback to specific state
  | CompensateWithEffects(array<TaskStateMachine.Effect.t>) // Run compensating effects
  | FullRollback(TaskStateMachine.State.t, array<TaskStateMachine.Effect.t>) // Rollback + effects

// Error recovery action
type recoveryAction =
  | AbortTransition
  | RetryTransition(int) // Retry count
  | FallbackToState(TaskStateMachine.State.t)
  | ExecuteRollback(rollbackStrategy)

// Validation context for comprehensive checks
type validationContext = {
  context: TaskStateMachine.Context.t,
  previousState: option<TaskStateMachine.State.t>,
  attemptCount: int,
  lastError: option<validationError>,
}

module PreConditionValidator = {
  // Check if state can transition based on current state
  let validateSourceState = (
    fromState: TaskStateMachine.State.t,
    event: TaskStateMachine.Event.t,
  ): validationResult => {
    switch (fromState, event) {
    // Bootstrapping can only accept DependenciesReady
    | (TaskStateMachine.State.Bootstrapping, TaskStateMachine.Event.DependenciesReady) => Valid
    | (TaskStateMachine.State.Bootstrapping, _) =>
      Invalid("Bootstrapping state only accepts DependenciesReady event")

    // Idle can only accept TaskSubmitted
    | (TaskStateMachine.State.Idle, TaskStateMachine.Event.TaskSubmitted(_)) => Valid
    | (TaskStateMachine.State.Idle, _) => Invalid("Idle state only accepts TaskSubmitted events")

    // Preparing accepts DependenciesReady, CancelRequest, Timeout
    | (TaskStateMachine.State.Preparing, TaskStateMachine.Event.DependenciesReady)
    | (TaskStateMachine.State.Preparing, TaskStateMachine.Event.CancelRequest(_))
    | (TaskStateMachine.State.Preparing, TaskStateMachine.Event.Timeout(_)) => Valid
    | (TaskStateMachine.State.Preparing, _) =>
      Invalid("Preparing state only accepts DependenciesReady, CancelRequest, or Timeout")

    // WaitingOnDependency accepts DependenciesReady, RetryTrigger, CancelRequest, Timeout
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.Event.DependenciesReady)
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.Event.RetryTrigger)
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.Event.CancelRequest(_))
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.Event.Timeout(_)) => Valid
    | (TaskStateMachine.State.WaitingOnDependency, _) =>
      Invalid(
        "WaitingOnDependency state only accepts DependenciesReady, RetryTrigger, CancelRequest, or Timeout",
      )

    // Executing accepts TelemetryFlushed, RuleViolation, Timeout, CancelRequest
    | (TaskStateMachine.State.Executing, TaskStateMachine.Event.TelemetryFlushed)
    | (TaskStateMachine.State.Executing, TaskStateMachine.Event.RuleViolation(_))
    | (TaskStateMachine.State.Executing, TaskStateMachine.Event.Timeout(_))
    | (TaskStateMachine.State.Executing, TaskStateMachine.Event.CancelRequest(_)) => Valid
    | (TaskStateMachine.State.Executing, _) =>
      Invalid(
        "Executing state only accepts TelemetryFlushed, RuleViolation, Timeout, or CancelRequest",
      )

    // Completed only accepts TelemetryFlushed
    | (TaskStateMachine.State.Completed, TaskStateMachine.Event.TelemetryFlushed) => Valid
    | (TaskStateMachine.State.Completed, _) =>
      Invalid("Completed state only accepts TelemetryFlushed")

    // Failed only accepts RetryTrigger
    | (TaskStateMachine.State.Failed, TaskStateMachine.Event.RetryTrigger) => Valid
    | (TaskStateMachine.State.Failed, _) => Invalid("Failed state only accepts RetryTrigger")

    // Canceled only accepts RetryTrigger
    | (TaskStateMachine.State.Canceled, TaskStateMachine.Event.RetryTrigger) => Valid
    | (TaskStateMachine.State.Canceled, _) => Invalid("Canceled state only accepts RetryTrigger")
    }
  }

  // Validate context meets requirements for transition
  let validateContext = (
    event: TaskStateMachine.Event.t,
    context: TaskStateMachine.Context.t,
  ): validationResult => {
    switch event {
    | TaskStateMachine.Event.DependenciesReady =>
      // DependenciesReady requires dependenciesReady flag
      if context.dependenciesReady {
        Valid
      } else {
        Invalid("DependenciesReady event requires context.dependenciesReady = true")
      }

    | TaskStateMachine.Event.CancelRequest(_) =>
      // CancelRequest requires cancellationRequested flag
      if context.cancellationRequested {
        Valid
      } else {
        Invalid("CancelRequest event requires context.cancellationRequested = true")
      }

    | TaskStateMachine.Event.TelemetryFlushed =>
      // TelemetryFlushed should clear telemetryPending
      Valid

    | _ => Valid // Other events don't have specific context requirements
    }
  }

  // Validate guard verdict allows transition
  let validateGuardVerdict = (
    fromState: TaskStateMachine.State.t,
    toState: TaskStateMachine.State.t,
    context: TaskStateMachine.Context.t,
  ): validationResult => {
    // Only check guard verdict when transitioning from Preparing to Executing
    switch (fromState, toState) {
    | (TaskStateMachine.State.Preparing, TaskStateMachine.State.Executing) =>
      switch context.guardVerdict {
      | TaskStateMachine.GuardVerdict.Allowed => Valid
      | TaskStateMachine.GuardVerdict.Blocked(reason) =>
        Invalid(`Guard verdict blocked transition: ${reason}`)
      }
    | _ => Valid // Guards only apply to Preparing -> Executing
    }
  }
}

module PostConditionValidator = {
  // Validate transition destination is valid
  let validateDestinationState = (
    fromState: TaskStateMachine.State.t,
    toState: TaskStateMachine.State.t,
    event: TaskStateMachine.Event.t,
  ): validationResult => {
    switch (fromState, toState, event) {
    // Valid transitions from Bootstrapping
    | (TaskStateMachine.State.Bootstrapping, TaskStateMachine.State.Idle, TaskStateMachine.Event.DependenciesReady) =>
      Valid

    // Valid transitions from Idle
    | (TaskStateMachine.State.Idle, TaskStateMachine.State.Preparing, TaskStateMachine.Event.TaskSubmitted(_)) =>
      Valid

    // Valid transitions from Preparing
    | (TaskStateMachine.State.Preparing, TaskStateMachine.State.Executing, TaskStateMachine.Event.DependenciesReady)
    | (TaskStateMachine.State.Preparing, TaskStateMachine.State.Canceled, TaskStateMachine.Event.CancelRequest(_))
    | (TaskStateMachine.State.Preparing, TaskStateMachine.State.Failed, TaskStateMachine.Event.Timeout(_)) =>
      Valid

    // Valid transitions from WaitingOnDependency
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.State.Preparing, TaskStateMachine.Event.DependenciesReady)
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.State.Preparing, TaskStateMachine.Event.RetryTrigger)
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.State.Canceled, TaskStateMachine.Event.CancelRequest(_))
    | (TaskStateMachine.State.WaitingOnDependency, TaskStateMachine.State.Failed, TaskStateMachine.Event.Timeout(_)) =>
      Valid

    // Valid transitions from Executing
    | (TaskStateMachine.State.Executing, TaskStateMachine.State.Completed, TaskStateMachine.Event.TelemetryFlushed)
    | (TaskStateMachine.State.Executing, TaskStateMachine.State.Executing, TaskStateMachine.Event.TelemetryFlushed) // Can stay in Executing if telemetry pending
    | (TaskStateMachine.State.Executing, TaskStateMachine.State.Failed, TaskStateMachine.Event.RuleViolation(_))
    | (TaskStateMachine.State.Executing, TaskStateMachine.State.Failed, TaskStateMachine.Event.Timeout(_))
    | (TaskStateMachine.State.Executing, TaskStateMachine.State.Canceled, TaskStateMachine.Event.CancelRequest(_)) =>
      Valid

    // Valid transitions from Completed
    | (TaskStateMachine.State.Completed, TaskStateMachine.State.Idle, TaskStateMachine.Event.TelemetryFlushed) =>
      Valid

    // Valid transitions from Failed
    | (TaskStateMachine.State.Failed, TaskStateMachine.State.Preparing, TaskStateMachine.Event.RetryTrigger) =>
      Valid

    // Valid transitions from Canceled
    | (TaskStateMachine.State.Canceled, TaskStateMachine.State.Idle, TaskStateMachine.Event.RetryTrigger) =>
      Valid

    // All other transitions are invalid
    | (from, to, _) => {
        let fromStr = TaskStateMachine.State.toString(from)
        let toStr = TaskStateMachine.State.toString(to)
        Invalid(`Invalid transition from ${fromStr} to ${toStr}`)
      }
    }
  }

  // Validate effects are appropriate for transition
  let validateEffects = (
    _fromState: TaskStateMachine.State.t,
    toState: TaskStateMachine.State.t,
    effects: array<TaskStateMachine.Effect.t>,
  ): validationResult => {
    // Check that rollback effects are only used when transitioning to Failed/Canceled
    let hasRollback = effects->Array.some(effect =>
      switch effect {
      | TaskStateMachine.Effect.PerformRollback(_) => true
      | _ => false
      }
    )

    if hasRollback {
      switch toState {
      | TaskStateMachine.State.Failed
      | TaskStateMachine.State.Canceled => Valid
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
    fromState: TaskStateMachine.State.t,
    toState: TaskStateMachine.State.t,
    event: TaskStateMachine.Event.t,
  ): rollbackStrategy => {
    switch (fromState, toState, event) {
    // Timeout errors require full rollback
    | (_, TaskStateMachine.State.Failed, TaskStateMachine.Event.Timeout(ms)) =>
      FullRollback(
        fromState,
        [TaskStateMachine.Effect.PerformRollback(`timeout:${Int.toString(ms)}`)],
      )

    // Rule violations require rollback with telemetry
    | (_, TaskStateMachine.State.Failed, TaskStateMachine.Event.RuleViolation(rule)) =>
      CompensateWithEffects([
        TaskStateMachine.Effect.PerformRollback(rule),
        TaskStateMachine.Effect.EmitTelemetry("rule.violation"),
      ])

    // Cancellations require state rollback + recording
    | (_, TaskStateMachine.State.Canceled, TaskStateMachine.Event.CancelRequest(payload)) =>
      CompensateWithEffects([
        TaskStateMachine.Effect.RecordCancellation(payload.requestedBy),
        TaskStateMachine.Effect.EmitTelemetry("task.canceled"),
      ])

    // For other failures, simple state rollback
    | (_, TaskStateMachine.State.Failed, _) => StateRollback(TaskStateMachine.State.Idle)

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
      | TaskStateMachine.State.Preparing =>
        FallbackToState(TaskStateMachine.State.WaitingOnDependency)

      // For Executing state errors, execute rollback
      | TaskStateMachine.State.Executing => {
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
  let executeRollback = (strategy: rollbackStrategy): (TaskStateMachine.State.t, array<TaskStateMachine.Effect.t>) => {
    switch strategy {
    | NoRollback => (TaskStateMachine.State.Idle, [])
    | StateRollback(state) => (state, [])
    | CompensateWithEffects(effects) => (TaskStateMachine.State.Idle, effects)
    | FullRollback(state, effects) => (state, effects)
    }
  }
}

module TransitionValidation = {
  // Comprehensive validation of a transition
  let validateTransition = (
    fromState: TaskStateMachine.State.t,
    toState: TaskStateMachine.State.t,
    event: TaskStateMachine.Event.t,
    context: TaskStateMachine.Context.t,
    effects: array<TaskStateMachine.Effect.t>,
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
    fromState: TaskStateMachine.State.t,
    toState: TaskStateMachine.State.t,
    event: TaskStateMachine.Event.t,
    context: TaskStateMachine.Context.t,
    effects: array<TaskStateMachine.Effect.t>,
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
  context: TaskStateMachine.Context.t,
  ~previousState: option<TaskStateMachine.State.t>=?,
  ~attemptCount: int=0,
  ~lastError: option<validationError>=?,
  ()
): validationContext => {
  context: context,
  previousState: previousState,
  attemptCount: attemptCount,
  lastError: lastError,
}
