// Sprint 1 Day 11: Effect Runtime Tests
// Effect execution runtime with async support for real system operations

import { describe, expect, it, beforeEach, vi } from 'vitest'
import * as EffectRuntime from '../../../packages/rescript-core/src/runtime/EffectRuntime.bs.js'
import * as StateMachine from '../../../packages/rescript-core/src/runtime/StateMachineV2.bs.js'

describe('EffectRuntime - Effect Execution', () => {
  it('executes plan hydration effect successfully', async () => {
    const context = EffectRuntime.defaultExecutionContext
    const taskContext = StateMachine.createInitialContext()
    const effect = StateMachine.createHydratePlanEffect('task-123')

    const result = await EffectRuntime.executeEffect(effect, taskContext, context)

    expect(result).toBe('Success')
  })

  it('executes guard evaluation effect successfully', async () => {
    const context = EffectRuntime.defaultExecutionContext
    const taskContext = StateMachine.createInitialContext()
    const effect = StateMachine.createEvaluateGuardsEffect()

    const result = await EffectRuntime.executeEffect(effect, taskContext, context)

    expect(result).toBe('Success')
  })

  it('executes task execution effect successfully', async () => {
    const context = EffectRuntime.defaultExecutionContext
    const taskContext = StateMachine.createInitialContext()
    const effect = StateMachine.createStartExecutionEffect('task-123')

    const result = await EffectRuntime.executeEffect(effect, taskContext, context)

    expect(result).toBe('Success')
  })

  it('calculates exponential backoff with jitter correctly', () => {
    const policy = {
      maxRetries: 3,
      backoffMs: 1000.0,
      maxBackoffMs: 60000.0
    }

    // First retry: 1000 * 2^0 = 1000ms + jitter
    const backoff1 = EffectRuntime.calculateRetryBackoff(0, policy)
    expect(backoff1).toBeGreaterThanOrEqual(1000) // Base
    expect(backoff1).toBeLessThanOrEqual(1100) // Base + 10% jitter

    // Second retry: 1000 * 2^1 = 2000ms + jitter
    const backoff2 = EffectRuntime.calculateRetryBackoff(1, policy)
    expect(backoff2).toBeGreaterThanOrEqual(2000)
    expect(backoff2).toBeLessThanOrEqual(2200)

    // Third retry: 1000 * 2^2 = 4000ms + jitter
    const backoff3 = EffectRuntime.calculateRetryBackoff(2, policy)
    expect(backoff3).toBeGreaterThanOrEqual(4000)
    expect(backoff3).toBeLessThanOrEqual(4400)
  })

  it('caps exponential backoff at maxBackoffMs', () => {
    const policy = {
      maxRetries: 10,
      backoffMs: 1000.0,
      maxBackoffMs: 10000.0 // Cap at 10 seconds
    }

    // Large attempt number would normally exceed cap
    const backoff = EffectRuntime.calculateRetryBackoff(10, policy) // 1000 * 2^10 = 1,024,000ms

    // Should be capped at maxBackoffMs plus jitter (10%)
    expect(backoff).toBeLessThanOrEqual(11000) // 10000 + 10% jitter
  })
})

describe('EffectRuntime - Sequential Effect Execution', () => {
  it('executes multiple effects sequentially', async () => {
    const context = EffectRuntime.defaultExecutionContext
    const taskContext = StateMachine.createInitialContext()

    const effects = [
      StateMachine.createHydratePlanEffect('task-123'),
      StateMachine.createEvaluateGuardsEffect(),
      StateMachine.createStartExecutionEffect('task-123')
    ]

    const results = await EffectRuntime.executeEffectList(effects, taskContext, context)

    expect(results).toHaveLength(3)
    expect(results[0]).toBe('Success')
    expect(results[1]).toBe('Success')
    expect(results[2]).toBe('Success')
  })

  it('executes multiple effects concurrently', async () => {
    const context = EffectRuntime.defaultExecutionContext
    const taskContext = StateMachine.createInitialContext()

    const effects = [
      StateMachine.createEmitTelemetryEffect('event-1'),
      StateMachine.createEmitTelemetryEffect('event-2'),
      StateMachine.createEmitTelemetryEffect('event-3')
    ]

    const results = await EffectRuntime.executeEffectListConcurrent(effects, taskContext, context)

    expect(results).toHaveLength(3)
    expect(results[0]).toBe('Success')
    expect(results[1]).toBe('Success')
    expect(results[2]).toBe('Success')
  })
})

describe('EffectRuntime - Runtime State Management', () => {
  it('creates runtime with empty state', () => {
    const context = EffectRuntime.defaultExecutionContext
    const runtime = EffectRuntime.createEffectRuntime(context)

    const [total, successful, failed] = EffectRuntime.getRuntimeStats(runtime)

    expect(total).toBe(0)
    expect(successful).toBe(0)
    expect(failed).toBe(0)
  })

  it('tracks successful effect executions', async () => {
    const context = EffectRuntime.defaultExecutionContext
    const taskContext = StateMachine.createInitialContext()
    let runtime = EffectRuntime.createEffectRuntime(context)

    const effects = [
      StateMachine.createHydratePlanEffect('task-123'),
      StateMachine.createEvaluateGuardsEffect()
    ]

    runtime = EffectRuntime.queueEffects(runtime, effects)
    runtime = await EffectRuntime.executePendingEffects(runtime, taskContext, false)

    const [total, successful, failed] = EffectRuntime.getRuntimeStats(runtime)

    expect(total).toBe(2)
    expect(successful).toBe(2)
    expect(failed).toBe(0)
    expect(EffectRuntime.checkAllSucceeded(runtime)).toBe(true)
  })

  it('reports runtime statistics correctly', async () => {
    const context = EffectRuntime.defaultExecutionContext
    const taskContext = StateMachine.createInitialContext()
    let runtime = EffectRuntime.createEffectRuntime(context)

    const effects = [
      StateMachine.createHydratePlanEffect('task-123'),
      StateMachine.createEvaluateGuardsEffect(),
      StateMachine.createStartExecutionEffect('task-123'),
      StateMachine.createEmitTelemetryEffect('test-event')
    ]

    runtime = EffectRuntime.queueEffects(runtime, effects)
    runtime = await EffectRuntime.executePendingEffects(runtime, taskContext, false)

    const [total, successful, failed] = EffectRuntime.getRuntimeStats(runtime)

    expect(total).toBe(4)
    expect(successful).toBe(4)
    expect(failed).toBe(0)
  })
})
