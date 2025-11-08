// Sprint 1 Day 9: Cancellation Rate Limiting Module
// Threat T5 Mitigation: Cancellation Abuse (Low/P2)
//
// Prevents DoS via cancellation flooding through:
// - Per-user rate limiting (max 10 cancellations/minute)
// - Dual confirmation for EXECUTING state cancellations
// - Cancellation audit logging
// - Effect queue throttling

module RateLimiter = {
  // Token bucket rate limiter for per-user cancellation requests

  type bucket = {
    tokens: float,
    lastRefill: float,
    maxTokens: float,
    refillRate: float, // tokens per millisecond
  }

  type t = Js.Dict.t<bucket>

  // Create empty rate limiter
  let create = (): t => Js.Dict.empty()

  // Rate limit configuration: 10 cancellations per 60 seconds
  let maxCancellationsPerMinute = 10.0
  let windowMs = 60000.0 // 1 minute in milliseconds

  // Refill rate: maxTokens / windowMs tokens per millisecond
  let getRefillRate = () => maxCancellationsPerMinute /. windowMs

  // Create or get bucket for user
  let getBucket = (limiter: t, userId: string): bucket => {
    switch limiter->Js.Dict.get(userId) {
    | Some(bucket) => bucket
    | None =>
      let now = Js.Date.now()
      let newBucket = {
        tokens: maxCancellationsPerMinute,
        lastRefill: now,
        maxTokens: maxCancellationsPerMinute,
        refillRate: getRefillRate(),
      }
      limiter->Js.Dict.set(userId, newBucket)
      newBucket
    }
  }

  // Refill bucket based on time elapsed
  let refillBucket = (bucket: bucket, now: float): bucket => {
    let elapsed = now -. bucket.lastRefill
    let tokensToAdd = elapsed *. bucket.refillRate
    let newTokens = Js.Math.min_float(bucket.tokens +. tokensToAdd, bucket.maxTokens)

    {
      ...bucket,
      tokens: newTokens,
      lastRefill: now,
    }
  }

  // Check if cancellation is allowed (consumes 1 token if allowed)
  let tryConsume = (limiter: t, userId: string): bool => {
    let now = Js.Date.now()
    let bucket = getBucket(limiter, userId)
    let refilled = refillBucket(bucket, now)

    if refilled.tokens >= 1.0 {
      // Consume token and update bucket
      let consumed = {...refilled, tokens: refilled.tokens -. 1.0}
      limiter->Js.Dict.set(userId, consumed)
      true
    } else {
      // Rate limit exceeded
      limiter->Js.Dict.set(userId, refilled)
      false
    }
  }

  // Get current tokens for user (for debugging/monitoring)
  let getTokens = (limiter: t, userId: string): float => {
    let now = Js.Date.now()
    let bucket = getBucket(limiter, userId)
    let refilled = refillBucket(bucket, now)
    refilled.tokens
  }
}

module ConfirmationRequired = {
  // Dual confirmation requirement for EXECUTING state cancellations

  type state =
    | Idle
    | Preparing
    | WaitingOnDependency
    | Executing
    | Completed
    | Failed
    | Canceled

  type confirmationStatus =
    | NotRequired
    | Required({requestedAt: float})
    | Confirmed({requestedAt: float, confirmedAt: float})

  // Check if cancellation requires confirmation based on state
  let requiresConfirmation = (state: state): bool => {
    switch state {
    | Executing => true // EXECUTING state requires dual confirmation
    | _ => false
    }
  }

  // Create confirmation requirement
  let createRequirement = (state: state): confirmationStatus => {
    if requiresConfirmation(state) {
      Required({requestedAt: Js.Date.now()})
    } else {
      NotRequired
    }
  }

  // Confirm cancellation
  let confirm = (status: confirmationStatus): confirmationStatus => {
    switch status {
    | Required({requestedAt}) =>
      Confirmed({requestedAt: requestedAt, confirmedAt: Js.Date.now()})
    | _ => status // Already confirmed or not required
    }
  }

  // Check if confirmation is complete
  let isConfirmed = (status: confirmationStatus): bool => {
    switch status {
    | Confirmed(_) => true
    | NotRequired => true // Not requiring confirmation counts as confirmed
    | Required(_) => false
    }
  }

  // Check if confirmation expired (30 seconds timeout)
  let isExpired = (status: confirmationStatus, now: float): bool => {
    switch status {
    | Required({requestedAt}) =>
      let age = now -. requestedAt
      age > 30000.0 // 30 second timeout
    | _ => false
    }
  }
}

module CancellationAudit = {
  // Immutable audit log for cancellation requests

  type entry = {
    taskId: string,
    userId: string,
    state: ConfirmationRequired.state,
    timestamp: float,
    rateLimitPassed: bool,
    confirmationRequired: bool,
    confirmationProvided: bool,
    allowed: bool,
    reason: option<string>,
  }

  type t = array<entry>

  let create = (): t => []

  let append = (log: t, entry: entry): t => {
    log->Js.Array2.concat([entry])
  }

  let getEntries = (log: t): array<entry> => log

  // Get cancellation count for user in time window
  let getCancellationCount = (log: t, userId: string, windowMs: float): int => {
    let now = Js.Date.now()
    let cutoff = now -. windowMs

    log
    ->Js.Array2.filter(entry => {
      entry.userId === userId && entry.timestamp > cutoff && entry.allowed
    })
    ->Js.Array2.length
  }
}

module CancellationLimiter = {
  // Main cancellation limiter with rate limiting + dual confirmation

  type state = ConfirmationRequired.state
  type confirmationStatus = ConfirmationRequired.confirmationStatus

  type result =
    | Allowed
    | RateLimitExceeded({userId: string, retriesIn: float})
    | ConfirmationRequired({status: confirmationStatus})
    | ConfirmationExpired
    | Denied({reason: string})

  type t = {
    rateLimiter: RateLimiter.t,
    auditLog: CancellationAudit.t,
  }

  let create = (): t => {
    rateLimiter: RateLimiter.create(),
    auditLog: CancellationAudit.create(),
  }

  // Check if cancellation is allowed
  let checkCancellation = (
    limiter: t,
    taskId: string,
    userId: string,
    state: state,
    confirmation: confirmationStatus,
  ): (t, result) => {
    // Step 1: Check rate limit
    let rateLimitPassed = RateLimiter.tryConsume(limiter.rateLimiter, userId)

    if !rateLimitPassed {
      // Calculate retry time (when tokens will be available)
      let tokens = RateLimiter.getTokens(limiter.rateLimiter, userId)
      let retriesIn = (1.0 -. tokens) /. RateLimiter.getRefillRate()

      let entry = {
        CancellationAudit.taskId: taskId,
        userId: userId,
        state: state,
        timestamp: Js.Date.now(),
        rateLimitPassed: false,
        confirmationRequired: false,
        confirmationProvided: false,
        allowed: false,
        reason: Some("Rate limit exceeded"),
      }

      let newLog = CancellationAudit.append(limiter.auditLog, entry)
      let newLimiter = {...limiter, auditLog: newLog}

      (newLimiter, RateLimitExceeded({userId: userId, retriesIn: retriesIn}))
    } else {
      // Step 2: Check if confirmation is required
      let requiresConfirm = ConfirmationRequired.requiresConfirmation(state)

      if requiresConfirm {
        let now = Js.Date.now()

        // Check if confirmation expired
        if ConfirmationRequired.isExpired(confirmation, now) {
          let entry = {
            CancellationAudit.taskId: taskId,
            userId: userId,
            state: state,
            timestamp: now,
            rateLimitPassed: true,
            confirmationRequired: true,
            confirmationProvided: false,
            allowed: false,
            reason: Some("Confirmation expired"),
          }

          let newLog = CancellationAudit.append(limiter.auditLog, entry)
          let newLimiter = {...limiter, auditLog: newLog}

          (newLimiter, ConfirmationExpired)
        } else if !ConfirmationRequired.isConfirmed(confirmation) {
          // Confirmation required but not provided
          let entry = {
            CancellationAudit.taskId: taskId,
            userId: userId,
            state: state,
            timestamp: now,
            rateLimitPassed: true,
            confirmationRequired: true,
            confirmationProvided: false,
            allowed: false,
            reason: Some("Confirmation required"),
          }

          let newLog = CancellationAudit.append(limiter.auditLog, entry)
          let newLimiter = {...limiter, auditLog: newLog}

          (newLimiter, ConfirmationRequired({status: confirmation}))
        } else {
          // Confirmed - allow cancellation
          let entry = {
            CancellationAudit.taskId: taskId,
            userId: userId,
            state: state,
            timestamp: now,
            rateLimitPassed: true,
            confirmationRequired: true,
            confirmationProvided: true,
            allowed: true,
            reason: None,
          }

          let newLog = CancellationAudit.append(limiter.auditLog, entry)
          let newLimiter = {...limiter, auditLog: newLog}

          (newLimiter, Allowed)
        }
      } else {
        // No confirmation required - allow cancellation
        let entry = {
          CancellationAudit.taskId: taskId,
          userId: userId,
          state: state,
          timestamp: Js.Date.now(),
          rateLimitPassed: true,
          confirmationRequired: false,
          confirmationProvided: false,
          allowed: true,
          reason: None,
        }

        let newLog = CancellationAudit.append(limiter.auditLog, entry)
        let newLimiter = {...limiter, auditLog: newLog}

        (newLimiter, Allowed)
      }
    }
  }

  // Get audit log
  let getAuditLog = (limiter: t): CancellationAudit.t => limiter.auditLog

  // Get cancellation stats for user
  let getUserStats = (limiter: t, userId: string): (float, int) => {
    let tokens = RateLimiter.getTokens(limiter.rateLimiter, userId)
    let count = CancellationAudit.getCancellationCount(
      limiter.auditLog,
      userId,
      60000.0, // Last minute
    )
    (tokens, count)
  }
}

// Export types and functions for JavaScript/TypeScript consumption
type state = ConfirmationRequired.state
type confirmationStatus = ConfirmationRequired.confirmationStatus
type cancellationResult = CancellationLimiter.result
type auditEntry = CancellationAudit.entry
type cancellationLimiter = CancellationLimiter.t

let createLimiter = CancellationLimiter.create
let checkCancellation = CancellationLimiter.checkCancellation
let getAuditLog = CancellationLimiter.getAuditLog
let getUserStats = CancellationLimiter.getUserStats

let createConfirmationRequirement = ConfirmationRequired.createRequirement
let confirmCancellation = ConfirmationRequired.confirm
let isConfirmationComplete = ConfirmationRequired.isConfirmed
let isConfirmationExpired = ConfirmationRequired.isExpired

let maxCancellationsPerMinute = RateLimiter.maxCancellationsPerMinute
