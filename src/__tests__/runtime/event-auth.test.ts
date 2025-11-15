import { describe, expect, it, beforeEach } from 'vitest'
import * as EventAuth from '../../../packages/rescript-core/src/security/EventAuth.bs.js'
import * as StateMachine from '../../../packages/rescript-core/src/runtime/StateMachineV2.bs.js'
import { createDeterministicUuidGenerator } from './securityTestUtils'
import { runtimeEvents } from './runtimeTestUtils'

// Sprint 1 Day 5: Event Authentication Tests
// T3 Mitigation - Event Spoofing & Replay (High/P0)

describe('Event Authentication - Trace Context Attachment', () => {
  it('attaches trace context with UUID trace and span IDs', () => {
    const uuidGen = createDeterministicUuidGenerator('trace')
    const event = runtimeEvents.dependenciesReady

    const traceContext = EventAuth.attachTraceContext(event, uuidGen)

    expect(traceContext.traceId).toContain('trace-00000001')
    expect(traceContext.spanId).toContain('trace-00000002')
    expect(traceContext.timestamp).toBeGreaterThan(0)
  })

  it('creates authenticated event with trace context and nonce', () => {
    const uuidGen = createDeterministicUuidGenerator('auth')
    const event = runtimeEvents.dependenciesReady
    const nonce = 1

    const authEvent = EventAuth.authenticateEvent(event, nonce, uuidGen)

    expect(authEvent.nonce).toBe(1)
    expect(authEvent.traceContext.traceId).toContain('auth-00000001')
    expect(authEvent.traceContext.spanId).toContain('auth-00000002')
    expect(authEvent.event).toBe(event)
  })

  it('generates unique trace IDs for different events', () => {
    const uuidGen = createDeterministicUuidGenerator('unique')
    const event1 = runtimeEvents.dependenciesReady
    const event2 = runtimeEvents.retryTrigger

    const trace1 = EventAuth.attachTraceContext(event1, uuidGen)
    const trace2 = EventAuth.attachTraceContext(event2, uuidGen)

    expect(trace1.traceId).not.toBe(trace2.traceId)
    expect(trace1.spanId).not.toBe(trace2.spanId)
  })

  it('converts trace context to string for logging', () => {
    const traceContext = EventAuth.createTraceContext(
      'trace-123',
      'span-456',
      1234567890.0
    )

    const str = EventAuth.traceContextToString(traceContext)

    expect(str).toContain('TraceID=trace-123')
    expect(str).toContain('SpanID=span-456')
    expect(str).toContain('Timestamp=1234567890')
  })

  it('converts authenticated event to string for logging', () => {
    const uuidGen = createDeterministicUuidGenerator('log')
    const event = runtimeEvents.dependenciesReady
    const authEvent = EventAuth.authenticateEvent(event, 42, uuidGen)

    const str = EventAuth.authenticatedEventToString(authEvent)

    expect(str).toContain('Event=DEPS_READY')
    expect(str).toContain('Nonce=42')
    expect(str).toContain('TraceID')
    expect(str).toContain('SpanID')
  })
})

describe('Event Authentication - Replay Detection', () => {
  let nonceState: any

  beforeEach(() => {
    nonceState = EventAuth.createNonceState(undefined)
  })

  it('accepts fresh event with increasing nonce', () => {
    const uuidGen = createDeterministicUuidGenerator('replay')
    const event = runtimeEvents.dependenciesReady

    const authEvent1 = EventAuth.authenticateEvent(event, 1, uuidGen)
    const result1 = EventAuth.verifyEvent(authEvent1, nonceState)

    expect(result1.TAG).toBe('Ok')
    expect(EventAuth.getLastNonce(nonceState)).toBe(1)
  })

  it('detects replay attack when same nonce is reused', () => {
    const uuidGen = createDeterministicUuidGenerator('replay')
    const event = runtimeEvents.dependenciesReady

    const authEvent1 = EventAuth.authenticateEvent(event, 1, uuidGen)
    EventAuth.verifyEvent(authEvent1, nonceState) // First use - should pass

    const authEvent2 = EventAuth.authenticateEvent(event, 1, uuidGen)
    const result2 = EventAuth.verifyEvent(authEvent2, nonceState)

    expect(result2.TAG).toBe('Error')
    expect(result2._0).toContain('Replay attack detected')
    expect(result2._0).toContain('Nonce 1 already processed')
  })

  it('rejects event with non-monotonic nonce', () => {
    const uuidGen = createDeterministicUuidGenerator('replay')
    const event = runtimeEvents.dependenciesReady

    // Process nonce 5 first
    const authEvent1 = EventAuth.authenticateEvent(event, 5, uuidGen)
    EventAuth.verifyEvent(authEvent1, nonceState)

    // Try to use nonce 3 (lower than last nonce)
    const authEvent2 = EventAuth.authenticateEvent(event, 3, uuidGen)
    const result2 = EventAuth.verifyEvent(authEvent2, nonceState)

    expect(result2.TAG).toBe('Error')
    expect(result2._0).toContain('Invalid nonce')
    expect(result2._0).toContain('not greater than last nonce')
  })

  it('tracks nonce history for replay detection', () => {
    const uuidGen = createDeterministicUuidGenerator('history')
    const event = runtimeEvents.dependenciesReady

    // Process several nonces
    for (let i = 1; i <= 5; i++) {
      const authEvent = EventAuth.authenticateEvent(event, i, uuidGen)
      EventAuth.verifyEvent(authEvent, nonceState)
    }

    expect(EventAuth.getLastNonce(nonceState)).toBe(5)
    expect(EventAuth.getNonceHistoryCount(nonceState)).toBe(5)
  })

  it('maintains nonce history within max size limit', () => {
    const limitedNonceState = EventAuth.createNonceState(10) // Max 10 entries
    const uuidGen = createDeterministicUuidGenerator('limit')
    const event = runtimeEvents.dependenciesReady

    // Process 15 nonces (exceeds max history size)
    for (let i = 1; i <= 15; i++) {
      const authEvent = EventAuth.authenticateEvent(event, i, uuidGen)
      EventAuth.verifyEvent(authEvent, limitedNonceState)
    }

    expect(EventAuth.getLastNonce(limitedNonceState)).toBe(15)
    expect(EventAuth.getNonceHistoryCount(limitedNonceState)).toBeLessThanOrEqual(10)
  })

  it('checks nonce freshness without recording', () => {
    const uuidGen = createDeterministicUuidGenerator('check')
    const event = runtimeEvents.dependenciesReady

    const authEvent1 = EventAuth.authenticateEvent(event, 1, uuidGen)
    EventAuth.verifyEvent(authEvent1, nonceState)

    // Check nonce 2 (should be fresh)
    const checkResult = EventAuth.checkNonce(nonceState, 2)
    expect(EventAuth.isFresh(checkResult)).toBe(true)

    // Check nonce 1 again (should be replay)
    const replayCheckResult = EventAuth.checkNonce(nonceState, 1)
    expect(EventAuth.isFresh(replayCheckResult)).toBe(false)
    expect(EventAuth.replayResultToString(replayCheckResult)).toContain('Replay')
  })

  it('clears nonce history for testing', () => {
    const uuidGen = createDeterministicUuidGenerator('clear')
    const event = runtimeEvents.dependenciesReady

    // Process some nonces
    const authEvent1 = EventAuth.authenticateEvent(event, 1, uuidGen)
    EventAuth.verifyEvent(authEvent1, nonceState)

    // Clear history
    EventAuth.clearNonceHistory(nonceState)

    expect(EventAuth.getLastNonce(nonceState)).toBe(0)
    expect(EventAuth.getNonceHistoryCount(nonceState)).toBe(0)
  })

  it('records nonce after successful verification', () => {
    const uuidGen = createDeterministicUuidGenerator('record')
    const event = runtimeEvents.dependenciesReady

    const authEvent = EventAuth.authenticateEvent(event, 1, uuidGen)

    expect(EventAuth.getLastNonce(nonceState)).toBe(0)

    EventAuth.verifyEvent(authEvent, nonceState)

    expect(EventAuth.getLastNonce(nonceState)).toBe(1)
    expect(EventAuth.getNonceHistoryCount(nonceState)).toBe(1)
  })

  it('does not record nonce on replay detection', () => {
    const uuidGen = createDeterministicUuidGenerator('no-record')
    const event = runtimeEvents.dependenciesReady

    // First event
    const authEvent1 = EventAuth.authenticateEvent(event, 1, uuidGen)
    EventAuth.verifyEvent(authEvent1, nonceState)

    const historyCountBefore = EventAuth.getNonceHistoryCount(nonceState)

    // Replay attempt
    const authEvent2 = EventAuth.authenticateEvent(event, 1, uuidGen)
    EventAuth.verifyEvent(authEvent2, nonceState)

    // History should not grow
    expect(EventAuth.getNonceHistoryCount(nonceState)).toBe(historyCountBefore)
  })
})
