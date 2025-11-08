import { describe, expect, it, beforeEach } from 'vitest'
import * as ManifestValidator from '../../../packages/rescript-core/src/security/ManifestValidator.bs.js'
import * as DependencyValidator from '../../../packages/rescript-core/src/security/DependencyValidator.bs.js'
import * as EventAuth from '../../../packages/rescript-core/src/security/EventAuth.bs.js'
import * as RuleEngine from '../../../packages/rescript-core/src/rules/RuleEngine.bs.js'
import * as PolicyDSL from '../../../packages/rescript-core/src/rules/PolicyDSL.bs.js'
import * as StateMachine from '../../../packages/rescript-core/src/runtime/StateMachine.bs.js'
import { runtimeStates, runtimeEvents } from './runtimeTestUtils'
import { generateSha256Checksum, createDeterministicUuidGenerator } from './securityTestUtils'

// Sprint 1 Day 5: Integration Tests
// Complete Security + Runtime Flows

describe('Integration - Manifest Validation → Dependency Checks → Rule Evaluation', () => {
  it('validates manifest, checks dependencies, and evaluates rules for secure task submission', () => {
    // Step 1: Validate manifest with signature
    const secretKey = 'integration-secret-key'
    const manifest = ManifestValidator.createManifest(
      'integration-task-001',
      '1.0.0',
      ['dep-a', 'dep-b'],
      undefined,
      'valid-signature',
      undefined
    )

    const hmacVerifier = (_canonical: string, _key: string, sig: string) => sig === 'valid-signature'
    const manifestResult = ManifestValidator.validateManifest(manifest, secretKey, hmacVerifier)

    expect(manifestResult.TAG).toBe('Ok')

    // Step 2: Validate dependencies with checksums
    const checksumA = generateSha256Checksum('dep-a-content')
    const checksumB = generateSha256Checksum('dep-b-content')

    const depA = DependencyValidator.createDependency('dep-a', '1.0.0', checksumA, undefined)
    const depB = DependencyValidator.createDependency('dep-b', '2.0.0', checksumB, undefined)

    const checksumVerifier = (actual: string, expected: string) => actual === expected

    const depAResult = DependencyValidator.verifyChecksum(depA, checksumA, checksumVerifier)
    const depBResult = DependencyValidator.verifyChecksum(depB, checksumB, checksumVerifier)

    expect(DependencyValidator.isChecksumValid(depAResult)).toBe(true)
    expect(DependencyValidator.isChecksumValid(depBResult)).toBe(true)

    // Step 3: Evaluate rules
    const rule = PolicyDSL.createPolicyRule(
      'secure-submission-rule',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.allowAction()
    )

    const policy = PolicyDSL.createPolicy('secure-policy', '1.0.0', 'Secure submission policy', [rule])

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      policy,
      undefined
    )

    const outcome = RuleEngine.execute(context)

    expect(RuleEngine.isPassed(outcome.result)).toBe(true)
  })

  it('rejects tampered manifest signature in integration flow', () => {
    const secretKey = 'integration-secret-key'
    const manifest = ManifestValidator.createManifest(
      'tampered-task',
      '1.0.0',
      ['dep-a'],
      undefined,
      'tampered-signature',
      undefined
    )

    const hmacVerifier = (_canonical: string, _key: string, sig: string) => sig === 'valid-signature'
    const manifestResult = ManifestValidator.validateManifest(manifest, secretKey, hmacVerifier)

    expect(manifestResult.TAG).toBe('Error')
    expect(manifestResult._0).toContain('Signature verification failed')
  })

  it('rejects tampered dependency checksum in integration flow', () => {
    const checksumA = generateSha256Checksum('expected-content')
    const tamperedChecksum = generateSha256Checksum('tampered-content')

    const dep = DependencyValidator.createDependency('dep-a', '1.0.0', checksumA, undefined)
    const checksumVerifier = (actual: string, expected: string) => actual === expected

    const result = DependencyValidator.verifyChecksum(dep, tamperedChecksum, checksumVerifier)

    expect(DependencyValidator.isChecksumValid(result)).toBe(false)
    expect(DependencyValidator.checksumResultToString(result)).toContain('ChecksumMismatch')
  })

  it('blocks rule violation in integration flow', () => {
    const rule = PolicyDSL.createPolicyRule(
      'block-executing-rule',
      [PolicyDSL.stateIsCondition('EXECUTING')],
      PolicyDSL.denyAction('cannot submit task while executing')
    )

    const policy = PolicyDSL.createPolicy('blocking-policy', '1.0.0', 'Block policy', [rule])

    const context = RuleEngine.createExecutionContext(
      runtimeStates.executing,
      runtimeEvents.dependenciesReady,
      undefined,
      policy,
      undefined
    )

    const outcome = RuleEngine.execute(context)

    expect(RuleEngine.isFailed(outcome.result)).toBe(true)
    expect(outcome.reason).toContain('cannot submit task while executing')
  })

  it('validates config bundle with all dependencies and signature', () => {
    const secretKey = 'bundle-key'
    const checksumA = generateSha256Checksum('dep-a-content')
    const checksumB = generateSha256Checksum('dep-b-content')

    const depA = DependencyValidator.createDependency('dep-a', '1.0.0', checksumA, undefined)
    const depB = DependencyValidator.createDependency('dep-b', '2.0.0', checksumB, undefined)

    const bundle = DependencyValidator.createConfigBundle(
      'integration-bundle',
      '1.0.0',
      [depA, depB],
      'valid-bundle-sig',
      undefined
    )

    const bundleSignatureVerifier = (_canonical: string, _key: string, sig: string) => {
      return sig === 'valid-bundle-sig'
    }

    const checksumVerifier = (actual: string, expected: string) => actual === expected

    const getActualChecksum = (depName: string) => {
      if (depName === 'dep-a') return checksumA
      if (depName === 'dep-b') return checksumB
      return ''
    }

    const result = DependencyValidator.validateConfigBundle(
      bundle,
      secretKey,
      getActualChecksum,
      checksumVerifier,
      bundleSignatureVerifier
    )

    expect(result.TAG).toBe('Ok')
  })
})

describe('Integration - Event Authentication → Replay Detection → State Transitions', () => {
  let nonceState: any

  beforeEach(() => {
    nonceState = EventAuth.createNonceState(undefined)
  })

  it('authenticates event and transitions state machine', () => {
    const uuidGen = createDeterministicUuidGenerator('integration')
    const event = runtimeEvents.dependenciesReady

    // Authenticate event
    const authEvent = EventAuth.authenticateEvent(event, 1, uuidGen)
    const verifyResult = EventAuth.verifyEvent(authEvent, nonceState)

    expect(verifyResult.TAG).toBe('Ok')

    // Transition state machine
    const context = StateMachine.makeContext(
      true, // dependenciesReady
      undefined,
      undefined,
      undefined,
      undefined
    )

    const outcome = StateMachine.transition(
      runtimeStates.preparing,
      runtimeEvents.dependenciesReady,
      context
    )

    expect(outcome.status).toBe('Transitioned')
    expect(outcome.toState).toBe('Executing')
  })

  it('detects replay attack and prevents state transition', () => {
    const uuidGen = createDeterministicUuidGenerator('replay-attack')
    const event = runtimeEvents.dependenciesReady

    // First submission - should succeed
    const authEvent1 = EventAuth.authenticateEvent(event, 1, uuidGen)
    const verifyResult1 = EventAuth.verifyEvent(authEvent1, nonceState)

    expect(verifyResult1.TAG).toBe('Ok')

    // Replay attack - same nonce
    const authEvent2 = EventAuth.authenticateEvent(event, 1, uuidGen)
    const verifyResult2 = EventAuth.verifyEvent(authEvent2, nonceState)

    expect(verifyResult2.TAG).toBe('Error')
    expect(verifyResult2._0).toContain('Replay attack detected')
  })

  it('processes multiple authenticated events with increasing nonces', () => {
    const uuidGen = createDeterministicUuidGenerator('multi-event')

    for (let i = 1; i <= 5; i++) {
      const event = runtimeEvents.dependenciesReady
      const authEvent = EventAuth.authenticateEvent(event, i, uuidGen)
      const result = EventAuth.verifyEvent(authEvent, nonceState)

      expect(result.TAG).toBe('Ok')
      expect(EventAuth.getLastNonce(nonceState)).toBe(i)
    }

    expect(EventAuth.getNonceHistoryCount(nonceState)).toBe(5)
  })

  it('attaches trace context to all events for telemetry', () => {
    const uuidGen = createDeterministicUuidGenerator('telemetry')
    const events = [
      runtimeEvents.dependenciesReady,
      runtimeEvents.retryTrigger,
      runtimeEvents.telemetryFlushed,
    ]

    const authEvents = events.map((event, idx) =>
      EventAuth.authenticateEvent(event, idx + 1, uuidGen)
    )

    authEvents.forEach(authEvent => {
      expect(authEvent.traceContext.traceId).toBeDefined()
      expect(authEvent.traceContext.spanId).toBeDefined()
      expect(authEvent.traceContext.timestamp).toBeGreaterThan(0)
    })

    // Verify all trace IDs are unique
    const traceIds = authEvents.map(ae => ae.traceContext.traceId)
    const uniqueTraceIds = new Set(traceIds)
    expect(uniqueTraceIds.size).toBe(traceIds.length)
  })

  it('combines event authentication with rule evaluation', () => {
    const uuidGen = createDeterministicUuidGenerator('auth-rules')
    const event = runtimeEvents.dependenciesReady

    // Authenticate event
    const authEvent = EventAuth.authenticateEvent(event, 1, uuidGen)
    const verifyResult = EventAuth.verifyEvent(authEvent, nonceState)

    expect(verifyResult.TAG).toBe('Ok')

    // Evaluate rules on authenticated event
    const rule = PolicyDSL.createPolicyRule(
      'auth-rule',
      [PolicyDSL.eventIsCondition('DEPS_READY')],
      PolicyDSL.allowAction()
    )

    const policy = PolicyDSL.createPolicy('auth-policy', '1.0.0', 'Auth policy', [rule])

    const context = RuleEngine.createExecutionContext(
      runtimeStates.preparing,
      authEvent.event,
      undefined,
      policy,
      undefined
    )

    const outcome = RuleEngine.execute(context)

    expect(RuleEngine.isPassed(outcome.result)).toBe(true)
  })
})

describe('Integration - Complete Secure Task Flow', () => {
  it('executes complete secure task submission flow', () => {
    const secretKey = 'flow-secret'
    const uuidGen = createDeterministicUuidGenerator('complete-flow')
    const nonceState = EventAuth.createNonceState(undefined)

    // 1. Validate manifest
    const manifest = ManifestValidator.createManifest(
      'complete-flow-task',
      '1.0.0',
      ['dep-x', 'dep-y'],
      undefined,
      'valid-signature',
      undefined
    )

    const hmacVerifier = (_canonical: string, _key: string, sig: string) => sig === 'valid-signature'
    const manifestResult = ManifestValidator.validateManifest(manifest, secretKey, hmacVerifier)

    expect(manifestResult.TAG).toBe('Ok')

    // 2. Validate dependencies
    const checksumX = generateSha256Checksum('dep-x-content')
    const depX = DependencyValidator.createDependency('dep-x', '1.0.0', checksumX, undefined)

    const checksumVerifier = (actual: string, expected: string) => actual === expected
    const depResult = DependencyValidator.verifyChecksum(depX, checksumX, checksumVerifier)

    expect(DependencyValidator.isChecksumValid(depResult)).toBe(true)

    // 3. Authenticate event
    const event = runtimeEvents.dependenciesReady
    const authEvent = EventAuth.authenticateEvent(event, 1, uuidGen)
    const authResult = EventAuth.verifyEvent(authEvent, nonceState)

    expect(authResult.TAG).toBe('Ok')

    // 4. Evaluate rules
    const rule = PolicyDSL.createPolicyRule(
      'flow-rule',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.allowAction()
    )

    const policy = PolicyDSL.createPolicy('flow-policy', '1.0.0', 'Complete flow policy', [rule])

    const ruleContext = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      authEvent.event,
      undefined,
      policy,
      undefined
    )

    const ruleOutcome = RuleEngine.execute(ruleContext)

    expect(RuleEngine.isPassed(ruleOutcome.result)).toBe(true)

    // 5. Transition state machine
    const smContext = StateMachine.makeContext(undefined, undefined, undefined, undefined, undefined)

    const taskSubmittedEvent = runtimeEvents.taskSubmitted({
      taskId: 'complete-flow-task',
      manifestVersion: '1.0.0',
    })

    const smOutcome = StateMachine.transition(runtimeStates.idle, taskSubmittedEvent, smContext)

    expect(smOutcome.status).toBe('Transitioned')
    expect(smOutcome.toState).toBe('Preparing')
  })

  it('rejects insecure task submission at manifest validation stage', () => {
    const secretKey = 'security-key'

    // Invalid manifest - missing signature
    const manifest = ManifestValidator.createManifest(
      'insecure-task',
      '1.0.0',
      ['dep-a'],
      undefined,
      undefined,
      undefined
    )

    const hmacVerifier = () => true
    const manifestResult = ManifestValidator.validateManifest(manifest, secretKey, hmacVerifier)

    expect(manifestResult.TAG).toBe('Error')
    expect(manifestResult._0).toContain('missing signature')
  })

  it('rejects insecure task submission at dependency validation stage', () => {
    const secretKey = 'security-key'

    // Valid manifest
    const manifest = ManifestValidator.createManifest(
      'task-with-bad-deps',
      '1.0.0',
      ['dep-a'],
      undefined,
      'valid-signature',
      undefined
    )

    const hmacVerifier = (_canonical: string, _key: string, sig: string) => sig === 'valid-signature'
    const manifestResult = ManifestValidator.validateManifest(manifest, secretKey, hmacVerifier)

    expect(manifestResult.TAG).toBe('Ok')

    // Invalid dependency - missing checksum
    const dep = DependencyValidator.createDependency('dep-a', '1.0.0', undefined, undefined)
    const checksumVerifier = () => true
    const depResult = DependencyValidator.verifyChecksum(dep, 'some-checksum', checksumVerifier)

    expect(DependencyValidator.isChecksumValid(depResult)).toBe(false)
  })

  it('rejects insecure task submission at event authentication stage', () => {
    const nonceState = EventAuth.createNonceState(undefined)
    const uuidGen = createDeterministicUuidGenerator('auth-fail')

    // Process nonce 5
    const event1 = runtimeEvents.dependenciesReady
    const authEvent1 = EventAuth.authenticateEvent(event1, 5, uuidGen)
    EventAuth.verifyEvent(authEvent1, nonceState)

    // Try to use nonce 3 (non-monotonic)
    const event2 = runtimeEvents.dependenciesReady
    const authEvent2 = EventAuth.authenticateEvent(event2, 3, uuidGen)
    const authResult = EventAuth.verifyEvent(authEvent2, nonceState)

    expect(authResult.TAG).toBe('Error')
    expect(authResult._0).toContain('Invalid nonce')
  })

  it('rejects insecure task submission at rule evaluation stage', () => {
    const uuidGen = createDeterministicUuidGenerator('rule-fail')
    const nonceState = EventAuth.createNonceState(undefined)

    // Authenticate event successfully
    const event = runtimeEvents.dependenciesReady
    const authEvent = EventAuth.authenticateEvent(event, 1, uuidGen)
    const authResult = EventAuth.verifyEvent(authEvent, nonceState)

    expect(authResult.TAG).toBe('Ok')

    // Block via rule
    const rule = PolicyDSL.createPolicyRule(
      'block-rule',
      [PolicyDSL.stateIsCondition('EXECUTING')],
      PolicyDSL.denyAction('task submission blocked during execution')
    )

    const policy = PolicyDSL.createPolicy('block-policy', '1.0.0', 'Blocking policy', [rule])

    const context = RuleEngine.createExecutionContext(
      runtimeStates.executing,
      authEvent.event,
      undefined,
      policy,
      undefined
    )

    const outcome = RuleEngine.execute(context)

    expect(RuleEngine.isFailed(outcome.result)).toBe(true)
    expect(outcome.reason).toContain('task submission blocked')
  })

  it('tracks telemetry across entire secure flow', () => {
    const uuidGen = createDeterministicUuidGenerator('telemetry-flow')
    const nonceState = EventAuth.createNonceState(undefined)

    const events = [
      runtimeEvents.dependenciesReady,
      runtimeEvents.retryTrigger,
      runtimeEvents.telemetryFlushed,
    ]

    const telemetryData: any[] = []

    events.forEach((event, idx) => {
      const authEvent = EventAuth.authenticateEvent(event, idx + 1, uuidGen)
      const authResult = EventAuth.verifyEvent(authEvent, nonceState)

      expect(authResult.TAG).toBe('Ok')

      telemetryData.push({
        traceId: authEvent.traceContext.traceId,
        spanId: authEvent.traceContext.spanId,
        nonce: authEvent.nonce,
        timestamp: authEvent.traceContext.timestamp,
      })
    })

    // Verify telemetry captured for all events
    expect(telemetryData).toHaveLength(3)
    telemetryData.forEach((data, idx) => {
      expect(data.nonce).toBe(idx + 1)
      expect(data.traceId).toBeDefined()
      expect(data.spanId).toBeDefined()
    })
  })
})
