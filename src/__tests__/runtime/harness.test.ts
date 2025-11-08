import { describe, expect, it } from 'vitest'
import * as StateMachine from '../../../packages/rescript-core/src/runtime/StateMachine.bs.js'
import * as EventDispatcher from '../../../packages/rescript-core/src/runtime/EventDispatcher.bs.js'
import { buildGuardContext } from './guardFixtureFactory'
import { runtimeEvents, runtimeStates } from './runtimeTestUtils'

const buildSubmission = (taskId = 'task-runtime', manifestVersion = 'v1') => ({
  taskId,
  manifestVersion,
})

describe('runtime harness', () => {
  it('promotes idle tasks through preparing into execution when guards allow', () => {
    const submissionEvent = runtimeEvents.taskSubmitted(buildSubmission('task-001'))

    const idleToPreparing = StateMachine.transition(
      runtimeStates.idle,
      submissionEvent,
      buildGuardContext({ dependenciesReady: true }),
    )

    expect(StateMachine.serializeOutcome(idleToPreparing)).toMatchObject({
      status: 'transitioned',
      toState: 'PREPARING',
    })

    const preparingToExecuting = StateMachine.transition(
      runtimeStates.preparing,
      runtimeEvents.dependenciesReady,
      buildGuardContext({ dependenciesReady: true, guardVerdict: { kind: 'allow' } }),
    )

    expect(StateMachine.serializeOutcome(preparingToExecuting)).toMatchObject({
      status: 'transitioned',
      toState: 'EXECUTING',
    })
  })

  it('rejects execution when policy guard blocks the transition', () => {
    const blockedOutcome = StateMachine.transition(
      runtimeStates.preparing,
      runtimeEvents.dependenciesReady,
      buildGuardContext({
        dependenciesReady: true,
        guardVerdict: { kind: 'block', reason: 'policy:change-window' },
      }),
    )

    expect(StateMachine.serializeOutcome(blockedOutcome)).toMatchObject({
      status: 'rejected',
      toState: 'PREPARING',
    })
    expect(StateMachine.serializeOutcome(blockedOutcome).reason).toBeDefined()
  })

  it('routes events and placeholder effects through the dispatcher', () => {
    const recordedEffects: string[] = []
    const recordedDecisions: Array<ReturnType<typeof StateMachine.serializeOutcome>> = []

    const handlers = {
      onDecision: (decision: any) => {
        recordedDecisions.push(StateMachine.serializeOutcome(decision))
      },
      onEffect: (effect: any, context: any) => {
        recordedEffects.push(StateMachine.Effect.toString(effect))
        expect(context).toHaveProperty('dependenciesReady')
      },
    }

    const dispatchOutcome = EventDispatcher.dispatchWithHandlers(
      runtimeStates.idle,
      runtimeEvents.taskSubmitted(buildSubmission('task-dispatcher')),
      buildGuardContext({ dependenciesReady: true }),
      handlers,
    )

    expect(StateMachine.serializeOutcome(dispatchOutcome)).toMatchObject({
      status: 'transitioned',
      toState: 'PREPARING',
    })
    expect(recordedDecisions).toHaveLength(1)
    expect(recordedEffects).toContain('HydratePlan(task-dispatcher)')
    expect(recordedEffects).toContain('EmitTelemetry(task.accepted)')
  })
})
