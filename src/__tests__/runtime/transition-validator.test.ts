// Sprint 1 Day 12: Transition Validator Tests
// Tests for transition validation with pre/post-condition checks and error recovery

import { describe, expect, it } from 'vitest'
import * as TransitionValidator from '../../../packages/rescript-core/src/runtime/TransitionValidator.bs.js'
import * as StateMachine from '../../../packages/rescript-core/src/runtime/StateMachine.bs.js'

describe('TransitionValidator - Pre-Condition Validation', () => {
  it('validates source state accepts correct events', () => {
    const context = StateMachine.defaultContext
    const validationContext = TransitionValidator.createValidationContext(context, undefined, 0, undefined)

    // Idle can only accept TaskSubmitted
    const taskSubmission = StateMachine.makeTaskSubmissionEvent('task-123', 'v1.0.0')
    const result = TransitionValidator.validateTransition(
      { TAG: 'Idle' },
      { TAG: 'Preparing' },
      taskSubmission,
      context,
      []
    )

    expect(result).toBe('Valid')
  })

  it('rejects invalid source state and event combinations', () => {
    const context = StateMachine.defaultContext

    // Idle should reject DependenciesReady
    const depsReady = { TAG: 'DependenciesReady' }
    const result = TransitionValidator.validateTransition(
      { TAG: 'Idle' },
      { TAG: 'Executing' },
      depsReady,
      context,
      []
    )

    expect(result.TAG).toBe('Invalid')
    expect(result._0).toContain('Idle state only accepts TaskSubmitted')
  })

  it('validates context requirements for DependenciesReady event', () => {
    // Context without dependenciesReady flag
    const invalidContext = StateMachine.makeContext(false, undefined, undefined, undefined)
    const depsReady = { TAG: 'DependenciesReady' }

    const result = TransitionValidator.validateTransition(
      { TAG: 'Preparing' },
      { TAG: 'Executing' },
      depsReady,
      invalidContext,
      []
    )

    expect(result.TAG).toBe('Invalid')
    expect(result._0).toContain('DependenciesReady event requires context.dependenciesReady = true')
  })

  it('validates context requirements for CancelRequest event', () => {
    // Context without cancellationRequested flag
    const invalidContext = StateMachine.makeContext(undefined, undefined, undefined, false)
    const cancelEvent = StateMachine.makeCancellationEvent('user-123')

    const result = TransitionValidator.validateTransition(
      { TAG: 'Preparing' },
      { TAG: 'Canceled' },
      cancelEvent,
      invalidContext,
      []
    )

    expect(result.TAG).toBe('Invalid')
    expect(result._0).toContain('CancelRequest event requires context.cancellationRequested = true')
  })

  it('validates guard verdict allows transition from Preparing to Executing', () => {
    // Context with Blocked guard verdict
    const blockedContext = StateMachine.makeContext(
      true,
      StateMachine.blockGuards('Security policy violation'),
      undefined,
      undefined
    )
    const depsReady = { TAG: 'DependenciesReady' }

    const result = TransitionValidator.validateTransition(
      { TAG: 'Preparing' },
      { TAG: 'Executing' },
      depsReady,
      blockedContext,
      []
    )

    expect(result.TAG).toBe('Invalid')
    expect(result._0).toContain('Guard verdict blocked transition')
  })
})

describe('TransitionValidator - Post-Condition Validation', () => {
  it('validates correct destination state for transitions', () => {
    const context = StateMachine.makeContext(true, StateMachine.allowGuards(), undefined, undefined)
    const depsReady = { TAG: 'DependenciesReady' }

    // Bootstrapping -> Idle on DependenciesReady is valid
    const result = TransitionValidator.validateTransition(
      { TAG: 'Bootstrapping' },
      { TAG: 'Idle' },
      depsReady,
      context,
      [{ TAG: 'EmitTelemetry', _0: 'runtime.bootstrapped' }]
    )

    expect(result).toBe('Valid')
  })

  it('rejects invalid destination states for transitions', () => {
    const context = StateMachine.makeContext(true, StateMachine.allowGuards(), undefined, undefined)
    const depsReady = { TAG: 'DependenciesReady' }

    // Bootstrapping -> Executing is invalid (should go to Idle first)
    const result = TransitionValidator.validateTransition(
      { TAG: 'Bootstrapping' },
      { TAG: 'Executing' },
      depsReady,
      context,
      []
    )

    expect(result.TAG).toBe('Invalid')
    expect(result._0).toContain('Invalid transition from BOOTSTRAPPING to EXECUTING')
  })

  it('validates rollback effects are only used for Failed/Canceled states', () => {
    const context = StateMachine.defaultContext
    const timeout = { TAG: 'Timeout', _0: 30000 }

    // Rollback effect should only be used with Failed/Canceled destination
    const invalidResult = TransitionValidator.validateTransition(
      { TAG: 'Executing' },
      { TAG: 'Completed' },
      timeout,
      context,
      [{ TAG: 'PerformRollback', _0: 'timeout' }]
    )

    expect(invalidResult.TAG).toBe('Invalid')
    expect(invalidResult._0).toContain('PerformRollback effect should only be used when transitioning to Failed or Canceled')

    // Rollback effect with Failed state should be valid
    const validResult = TransitionValidator.validateTransition(
      { TAG: 'Executing' },
      { TAG: 'Failed' },
      timeout,
      context,
      [{ TAG: 'PerformRollback', _0: 'timeout:30000' }]
    )

    expect(validResult).toBe('Valid')
  })
})

describe('TransitionValidator - Comprehensive Validation', () => {
  it('validates complete transition pipeline with all checks', () => {
    // Valid complete transition
    const context = StateMachine.makeContext(
      true,
      StateMachine.allowGuards(),
      undefined,
      undefined
    )
    const depsReady = { TAG: 'DependenciesReady' }
    const effects = [
      { TAG: 'EvaluateGuards' },
      { TAG: 'StartExecution', _0: 'plan' }
    ]

    const result = TransitionValidator.validateTransition(
      { TAG: 'Preparing' },
      { TAG: 'Executing' },
      depsReady,
      context,
      effects
    )

    expect(result).toBe('Valid')
  })

  it('determines appropriate error recovery actions for validation failures', () => {
    const context = StateMachine.makeContext(
      false,
      StateMachine.allowGuards(),
      undefined,
      undefined
    )
    const validationContext = TransitionValidator.createValidationContext(context, undefined, 1, undefined)
    const depsReady = { TAG: 'DependenciesReady' }

    // Validation with recovery
    const [result, recoveryAction] = TransitionValidator.validateWithRecovery(
      { TAG: 'Preparing' },
      { TAG: 'Executing' },
      depsReady,
      context,
      [],
      validationContext
    )

    // Should fail validation
    expect(result.TAG).toBe('Invalid')

    // Should provide a recovery action
    expect(recoveryAction).toBeDefined()

    // For Preparing state errors, should suggest fallback to WaitingOnDependency
    if (recoveryAction && recoveryAction.TAG === 'FallbackToState') {
      expect(recoveryAction._0.TAG).toBe('WaitingOnDependency')
    }
  })
})

describe('TransitionValidator - Error Recovery', () => {
  it('determines rollback strategy for timeout errors', () => {
    const timeout = { TAG: 'Timeout', _0: 30000 }

    const strategy = TransitionValidator.determineRollbackStrategy(
      { TAG: 'Executing' },
      { TAG: 'Failed' },
      timeout
    )

    // Timeout should trigger full rollback
    expect(strategy.TAG).toBe('FullRollback')
    expect(strategy._0.TAG).toBe('Executing')
    expect(strategy._1.length).toBeGreaterThan(0)
    expect(strategy._1[0].TAG).toBe('PerformRollback')
  })

  it('determines rollback strategy for rule violations', () => {
    const ruleViolation = { TAG: 'RuleViolation', _0: 'max-retries-exceeded' }

    const strategy = TransitionValidator.determineRollbackStrategy(
      { TAG: 'Executing' },
      { TAG: 'Failed' },
      ruleViolation
    )

    // Rule violations should trigger compensating effects
    expect(strategy.TAG).toBe('CompensateWithEffects')
    expect(strategy._0.length).toBe(2)
    expect(strategy._0[0].TAG).toBe('PerformRollback')
    expect(strategy._0[1].TAG).toBe('EmitTelemetry')
  })

  it('determines rollback strategy for cancellations', () => {
    const cancelEvent = StateMachine.makeCancellationEvent('user-123')

    const strategy = TransitionValidator.determineRollbackStrategy(
      { TAG: 'Preparing' },
      { TAG: 'Canceled' },
      cancelEvent
    )

    // Cancellations should record and emit telemetry
    expect(strategy.TAG).toBe('CompensateWithEffects')
    expect(strategy._0.length).toBeGreaterThan(0)
    expect(strategy._0[0].TAG).toBe('RecordCancellation')
  })

  it('executes rollback and returns correct state and effects', () => {
    const fullRollbackStrategy = {
      TAG: 'FullRollback',
      _0: { TAG: 'Idle' },
      _1: [{ TAG: 'PerformRollback', _0: 'test-rollback' }]
    }

    const [state, effects] = TransitionValidator.executeRollback(fullRollbackStrategy)

    expect(state.TAG).toBe('Idle')
    expect(effects.length).toBe(1)
    expect(effects[0].TAG).toBe('PerformRollback')
    expect(effects[0]._0).toBe('test-rollback')
  })

  it('aborts transition after too many retry attempts', () => {
    const context = StateMachine.defaultContext
    const validationContext = TransitionValidator.createValidationContext(
      context,
      undefined,
      3, // Too many attempts
      undefined
    )
    const depsReady = { TAG: 'DependenciesReady' }

    const [result, recoveryAction] = TransitionValidator.validateWithRecovery(
      { TAG: 'Preparing' },
      { TAG: 'Executing' },
      depsReady,
      context,
      [],
      validationContext
    )

    // Should fail validation
    expect(result.TAG).toBe('Invalid')

    // Should abort transition (no recovery)
    expect(recoveryAction).toBeDefined()
    if (recoveryAction) {
      expect(recoveryAction.TAG).toBe('AbortTransition')
    }
  })
})
