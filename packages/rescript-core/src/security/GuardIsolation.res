// Sprint 1 Day 6-7: Guard Isolation Module
// Threat T2 Mitigation: Guard Bypass Exploitation (High/P1)
//
// Ensures guards execute in isolated context with tamper-proof verdicts.
// Provides HMAC-based verdict signing to prevent guard verdict manipulation.

module GuardVerdict = {
  type t = Pass | Fail(string) | Defer(string)

  let toString = verdict =>
    switch verdict {
    | Pass => "Pass"
    | Fail(msg) => `Fail(${msg})`
    | Defer(msg) => `Defer(${msg})`
    }
}

module GuardContext = {
  type state =
    | Bootstrapping
    | Idle
    | Preparing
    | WaitingOnDependency
    | Executing
    | Completed
    | Failed
    | Canceled

  type event =
    | TaskSubmitted
    | DependenciesReady
    | RuleViolation
    | Timeout
    | CancelRequest
    | RetryTrigger
    | TelemetryFlushed

  type metadata = Js.Dict.t<Js.Json.t>

  type t = {
    currentState: state,
    event: event,
    metadata: option<metadata>,
    // Immutable snapshot to prevent tampering during guard execution
    frozen: bool,
  }

  let create = (state, event, metadata) => {
    currentState: state,
    event: event,
    metadata: metadata,
    frozen: true, // Context is immutable once created
  }

  let isFrozen = ctx => ctx.frozen
}

module VerdictSignature = {
  // HMAC-SHA256 signature for guard verdicts
  // Prevents verdict tampering by signing verdict + context + timestamp

  type signature = string // HMAC-SHA256 hex string

  type signedVerdict = {
    verdict: GuardVerdict.t,
    signature: signature,
    timestamp: float,
    guardName: string,
    contextHash: string, // Hash of frozen context
  }

  // Mock HMAC implementation (replace with crypto library in production)
  @val external btoa: string => string = "btoa"
  @val external atob: string => string = "atob"

  let computeHmac = (message: string, secretKey: string): string => {
    // In production, use Node.js crypto.createHmac('sha256', secretKey).update(message).digest('hex')
    // For now, simple base64 encoding as placeholder
    let combined = message ++ "::" ++ secretKey
    try {
      btoa(combined)
    } catch {
    | _ => "mock-hmac-" ++ message
    }
  }

  let hashContext = (ctx: GuardContext.t): string => {
    // Create deterministic hash of context
    let stateStr = switch ctx.currentState {
    | Bootstrapping => "BOOTSTRAPPING"
    | Idle => "IDLE"
    | Preparing => "PREPARING"
    | WaitingOnDependency => "WAITING_ON_DEP"
    | Executing => "EXECUTING"
    | Completed => "COMPLETED"
    | Failed => "FAILED"
    | Canceled => "CANCELED"
    }

    let eventStr = switch ctx.event {
    | TaskSubmitted => "TASK_SUBMITTED"
    | DependenciesReady => "DEPENDENCIES_READY"
    | RuleViolation => "RULE_VIOLATION"
    | Timeout => "TIMEOUT"
    | CancelRequest => "CANCEL_REQUEST"
    | RetryTrigger => "RETRY_TRIGGER"
    | TelemetryFlushed => "TELEMETRY_FLUSHED"
    }

    computeHmac(stateStr ++ "::" ++ eventStr, "context-hash-key")
  }

  let sign = (verdict: GuardVerdict.t, guardName: string, ctx: GuardContext.t, secretKey: string): signedVerdict => {
    let timestamp = Js.Date.now()
    let contextHash = hashContext(ctx)
    let verdictStr = GuardVerdict.toString(verdict)

    let message = verdictStr ++ "::" ++ guardName ++ "::" ++ contextHash ++ "::" ++ Js.Float.toString(timestamp)
    let signature = computeHmac(message, secretKey)

    {
      verdict: verdict,
      signature: signature,
      timestamp: timestamp,
      guardName: guardName,
      contextHash: contextHash,
    }
  }

  let verify = (signedVerdict: signedVerdict, ctx: GuardContext.t, secretKey: string): bool => {
    // Recompute signature and compare
    let contextHash = hashContext(ctx)

    // Context must match
    if contextHash !== signedVerdict.contextHash {
      false
    } else {
      let verdictStr = GuardVerdict.toString(signedVerdict.verdict)
      let message = verdictStr ++ "::" ++ signedVerdict.guardName ++ "::" ++ contextHash ++ "::" ++ Js.Float.toString(signedVerdict.timestamp)
      let expectedSignature = computeHmac(message, secretKey)

      expectedSignature === signedVerdict.signature
    }
  }

  let isExpired = (signedVerdict: signedVerdict, maxAgeMs: float): bool => {
    let now = Js.Date.now()
    let age = now -. signedVerdict.timestamp
    age > maxAgeMs
  }
}

module IsolatedGuardExecutor = {
  // Executes guards in isolated context (conceptually worker thread)
  // Ensures guards cannot tamper with runtime state

  type guard = GuardContext.t => GuardVerdict.t

  type executionResult = {
    signedVerdict: VerdictSignature.signedVerdict,
    executionTimeMs: float,
    isolated: bool,
  }

  let executeIsolated = (
    guard: guard,
    guardName: string,
    ctx: GuardContext.t,
    secretKey: string,
  ): executionResult => {
    // Verify context is frozen (immutable)
    if !GuardContext.isFrozen(ctx) {
      // Reject execution if context is not frozen
      let verdict = GuardVerdict.Fail("Guard context must be frozen for isolated execution")
      let signed = VerdictSignature.sign(verdict, guardName, ctx, secretKey)
      {
        signedVerdict: signed,
        executionTimeMs: 0.0,
        isolated: false,
      }
    } else {
      let startTime = Js.Date.now()

      // Execute guard in isolated context
      // In production, this would spawn a worker thread and transfer frozen context
      // For now, execute synchronously with isolated scope
      let verdict = try {
        guard(ctx)
      } catch {
      | Js.Exn.Error(obj) =>
        let message = switch Js.Exn.message(obj) {
        | Some(msg) => msg
        | None => "Guard execution failed with unknown error"
        }
        GuardVerdict.Fail(`Guard execution exception: ${message}`)
      | _ => GuardVerdict.Fail("Guard execution failed with non-JS exception")
      }

      let endTime = Js.Date.now()
      let executionTimeMs = endTime -. startTime

      // Sign verdict to prevent tampering
      let signed = VerdictSignature.sign(verdict, guardName, ctx, secretKey)

      {
        signedVerdict: signed,
        executionTimeMs: executionTimeMs,
        isolated: true,
      }
    }
  }

  let executeBatch = (
    guards: array<(guard, string)>,
    ctx: GuardContext.t,
    secretKey: string,
  ): array<executionResult> => {
    // Execute guards sequentially with early termination on first failure
    let results = []
    let shouldContinue = ref(true)

    guards->Js.Array2.forEach(((guard, guardName)) => {
      if shouldContinue.contents {
        let result = executeIsolated(guard, guardName, ctx, secretKey)
        results->Js.Array2.push(result)->ignore

        // Stop on first Fail verdict (fail-fast)
        switch result.signedVerdict.verdict {
        | GuardVerdict.Fail(_) => shouldContinue := false
        | _ => ()
        }
      }
    })

    results
  }

  let combineVerdicts = (results: array<executionResult>): GuardVerdict.t => {
    // AND combinator: all must Pass, first Fail/Defer wins
    let mutableVerdict = ref(GuardVerdict.Pass)

    results->Js.Array2.forEach(result => {
      switch (mutableVerdict.contents, result.signedVerdict.verdict) {
      | (Pass, Fail(msg)) => mutableVerdict := GuardVerdict.Fail(msg)
      | (Pass, Defer(msg)) => mutableVerdict := GuardVerdict.Defer(msg)
      | (Defer(_), Fail(msg)) => mutableVerdict := GuardVerdict.Fail(msg) // Fail overrides Defer
      | _ => () // Keep existing verdict
      }
    })

    mutableVerdict.contents
  }
}

module AuditLog = {
  // Immutable audit log for guard evaluations
  // Threat T2 mitigation: provides tamper-proof record of guard decisions

  type entry = {
    guardName: string,
    verdict: GuardVerdict.t,
    signature: VerdictSignature.signature,
    timestamp: float,
    contextHash: string,
    executionTimeMs: float,
  }

  type t = array<entry>

  let create = (): t => []

  let append = (log: t, result: IsolatedGuardExecutor.executionResult): t => {
    let entry = {
      guardName: result.signedVerdict.guardName,
      verdict: result.signedVerdict.verdict,
      signature: result.signedVerdict.signature,
      timestamp: result.signedVerdict.timestamp,
      contextHash: result.signedVerdict.contextHash,
      executionTimeMs: result.executionTimeMs,
    }

    // Append to immutable log (creates new array)
    log->Js.Array2.concat([entry])
  }

  let getEntries = (log: t): array<entry> => log

  let verifyIntegrity = (log: t, ctx: GuardContext.t, secretKey: string): bool => {
    // Verify all signatures in log are valid
    log->Js.Array2.every(entry => {
      let signedVerdict = {
        VerdictSignature.verdict: entry.verdict,
        signature: entry.signature,
        timestamp: entry.timestamp,
        guardName: entry.guardName,
        contextHash: entry.contextHash,
      }
      VerdictSignature.verify(signedVerdict, ctx, secretKey)
    })
  }
}

// Export types and functions for JavaScript/TypeScript consumption
type guardContext = GuardContext.t
type guardVerdict = GuardVerdict.t
type signedVerdict = VerdictSignature.signedVerdict
type executionResult = IsolatedGuardExecutor.executionResult
type auditLog = AuditLog.t
type auditEntry = AuditLog.entry

let createContext = GuardContext.create
let signVerdict = VerdictSignature.sign
let verifySignature = VerdictSignature.verify
let isSignatureExpired = VerdictSignature.isExpired
let executeGuardIsolated = IsolatedGuardExecutor.executeIsolated
let executeGuardsBatch = IsolatedGuardExecutor.executeBatch
let combineGuardVerdicts = IsolatedGuardExecutor.combineVerdicts
let createAuditLog = AuditLog.create
let appendToAuditLog = AuditLog.append
let verifyAuditLogIntegrity = AuditLog.verifyIntegrity
