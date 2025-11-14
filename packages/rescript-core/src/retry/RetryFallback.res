// RetryFallback.res - Retry and Fallback System
// Day 66: Retry/Fallback System Implementation
// Provides retry strategies, exponential backoff, fallback mechanisms, and circuit breakers

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

@genType
type retryId = string

@genType
type strategyId = string

// Retry strategy types
@genType
type retryStrategy =
  | @genType.as("FixedDelay") FixedDelay({delayMs: int})
  | @genType.as("ExponentialBackoff") ExponentialBackoff({
      initialDelayMs: int,
      maxDelayMs: int,
      multiplier: float,
    })
  | @genType.as("LinearBackoff") LinearBackoff({
      initialDelayMs: int,
      incrementMs: int,
    })
  | @genType.as("RandomJitter") RandomJitter({
      baseDelayMs: int,
      maxJitterMs: int,
    })

// Error classification
@genType
type errorType =
  | @genType.as("Retryable") Retryable
  | @genType.as("NonRetryable") NonRetryable
  | @genType.as("RateLimited") RateLimited
  | @genType.as("Timeout") Timeout

// Retry configuration
@genType
type retryConfig = {
  maxAttempts: int,
  strategy: retryStrategy,
  timeout: option<int>,
  shouldRetry: option<string => bool>,
}

// Fallback strategy
@genType
type fallbackStrategy<'a> =
  | @genType.as("DefaultValue") DefaultValue('a)
  | @genType.as("AlternativeFunction") AlternativeFunction(unit => promise<result<'a, string>>)
  | @genType.as("Cached") Cached('a)
  | @genType.as("Degraded") Degraded('a)

// Circuit breaker states
@genType
type circuitState =
  | @genType.as("Closed") Closed
  | @genType.as("Open") Open
  | @genType.as("HalfOpen") HalfOpen

// Circuit breaker configuration
@genType
type circuitBreakerConfig = {
  failureThreshold: int,
  successThreshold: int,
  timeout: int,
  halfOpenMaxAttempts: int,
}

// Circuit breaker
@genType
type circuitBreaker = {
  id: string,
  state: circuitState,
  failureCount: int,
  successCount: int,
  lastFailureTime: option<float>,
  config: circuitBreakerConfig,
}

// Retry attempt record
@genType
type retryAttempt = {
  attemptNumber: int,
  timestamp: float,
  error: option<string>,
  delayMs: int,
}

// Retry execution result
@genType
type retryExecution<'a> = {
  result: result<'a, string>,
  attempts: array<retryAttempt>,
  totalDuration: float,
  usedFallback: bool,
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

let getCurrentTime = (): float => Js.Date.now()

let generateId = (prefix: string): string => {
  let timestamp = getCurrentTime()
  let random = Js.Math.random()
  `${prefix}-${Belt.Float.toString(timestamp)}-${Belt.Float.toString(random)}`
}

// Calculate delay based on strategy
let calculateDelay = (strategy: retryStrategy, attemptNumber: int): int => {
  switch strategy {
  | FixedDelay({delayMs}) => delayMs
  | ExponentialBackoff({initialDelayMs, maxDelayMs, multiplier}) => {
      let delay = Belt.Int.toFloat(initialDelayMs) *. Js.Math.pow_float(
        ~base=multiplier,
        ~exp=Belt.Int.toFloat(attemptNumber - 1),
      )
      let delayInt = Belt.Float.toInt(delay)
      Js.Math.min_int(delayInt, maxDelayMs)
    }
  | LinearBackoff({initialDelayMs, incrementMs}) =>
    initialDelayMs + incrementMs * (attemptNumber - 1)
  | RandomJitter({baseDelayMs, maxJitterMs}) => {
      let jitter = Belt.Float.toInt(Js.Math.random() *. Belt.Int.toFloat(maxJitterMs))
      baseDelayMs + jitter
    }
  }
}

// Sleep for specified milliseconds
let sleep = (ms: int): promise<unit> => {
  Js.Promise.make((~resolve, ~reject as _) => {
    let _ = Js.Global.setTimeout(() => resolve(. ()), ms)
  })
}

// Default retry predicate - retry on all errors
let defaultShouldRetry = (_error: string): bool => true

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

@genType
let createCircuitBreakerConfig = (
  ~failureThreshold: int=5,
  ~successThreshold: int=2,
  ~timeout: int=60000,
  ~halfOpenMaxAttempts: int=3,
  (),
): circuitBreakerConfig => {
  {
    failureThreshold,
    successThreshold,
    timeout,
    halfOpenMaxAttempts,
  }
}

@genType
let createCircuitBreaker = (
  ~id: option<string>=?,
  ~config: option<circuitBreakerConfig>=?,
  (),
): circuitBreaker => {
  let defaultConfig = createCircuitBreakerConfig()
  let finalConfig = switch config {
  | None => defaultConfig
  | Some(c) => c
  }

  let finalId = switch id {
  | None => generateId("cb")
  | Some(i) => i
  }

  {
    id: finalId,
    state: Closed,
    failureCount: 0,
    successCount: 0,
    lastFailureTime: None,
    config: finalConfig,
  }
}

@genType
let recordSuccess = (cb: circuitBreaker): circuitBreaker => {
  switch cb.state {
  | Closed => {
      // Reset failure count on success in closed state
      {...cb, failureCount: 0, successCount: 0}
    }
  | HalfOpen => {
      let newSuccessCount = cb.successCount + 1
      if newSuccessCount >= cb.config.successThreshold {
        // Transition to Closed
        {
          ...cb,
          state: Closed,
          successCount: 0,
          failureCount: 0,
          lastFailureTime: None,
        }
      } else {
        {...cb, successCount: newSuccessCount}
      }
    }
  | Open => cb // Should not happen, but keep current state
  }
}

@genType
let recordFailure = (cb: circuitBreaker): circuitBreaker => {
  let now = getCurrentTime()

  switch cb.state {
  | Closed => {
      let newFailureCount = cb.failureCount + 1
      if newFailureCount >= cb.config.failureThreshold {
        // Transition to Open
        {
          ...cb,
          state: Open,
          failureCount: newFailureCount,
          successCount: 0,
          lastFailureTime: Some(now),
        }
      } else {
        {...cb, failureCount: newFailureCount, lastFailureTime: Some(now)}
      }
    }
  | HalfOpen => {
      // Transition back to Open
      {
        ...cb,
        state: Open,
        failureCount: cb.failureCount + 1,
        successCount: 0,
        lastFailureTime: Some(now),
      }
    }
  | Open => {...cb, lastFailureTime: Some(now)}
  }
}

@genType
let shouldAttempt = (cb: circuitBreaker): (bool, circuitBreaker) => {
  switch cb.state {
  | Closed => (true, cb)
  | HalfOpen => (true, cb)
  | Open => {
      let now = getCurrentTime()
      switch cb.lastFailureTime {
      | None => (true, {...cb, state: HalfOpen, successCount: 0})
      | Some(lastFailure) => {
          let elapsed = now -. lastFailure
          if elapsed >= Belt.Int.toFloat(cb.config.timeout) {
            // Transition to HalfOpen
            (true, {...cb, state: HalfOpen, successCount: 0})
          } else {
            (false, cb)
          }
        }
      }
    }
  }
}

@genType
let getCircuitState = (cb: circuitBreaker): circuitState => cb.state

@genType
let resetCircuitBreaker = (cb: circuitBreaker): circuitBreaker => {
  {
    ...cb,
    state: Closed,
    failureCount: 0,
    successCount: 0,
    lastFailureTime: None,
  }
}

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

@genType
let createRetryConfig = (
  ~maxAttempts: int=3,
  ~strategy: option<retryStrategy>=?,
  ~timeout: option<int>=?,
  ~shouldRetry: option<string => bool>=?,
  (),
): retryConfig => {
  let defaultStrategy = ExponentialBackoff({
    initialDelayMs: 100,
    maxDelayMs: 30000,
    multiplier: 2.0,
  })

  {
    maxAttempts,
    strategy: switch strategy {
    | None => defaultStrategy
    | Some(s) => s
    },
    timeout,
    shouldRetry,
  }
}

// ============================================================================
// RETRY EXECUTION
// ============================================================================

@genType
let retry = async (
  fn: unit => promise<result<'a, string>>,
  config: retryConfig,
) => {
  let startTime = getCurrentTime()
  let attempts = []
  let shouldRetryFn = switch config.shouldRetry {
  | None => defaultShouldRetry
  | Some(fn) => fn
  }

  let rec executeAttempt = async (attemptNumber: int) => {
    if attemptNumber > config.maxAttempts {
      // Max attempts reached
      let lastError = switch Belt.Array.get(attempts, Belt.Array.length(attempts) - 1) {
      | Some(attempt) =>
        switch attempt.error {
        | Some(e) => e
        | None => "Unknown error"
        }
      | None => "Max attempts reached"
      }
      Error(`Max retry attempts (${Belt.Int.toString(config.maxAttempts)}) reached. Last error: ${lastError}`)
    } else {
      // Execute attempt
      let attemptStart = getCurrentTime()
      let result = try {
        await fn()
      } catch {
      | Js.Exn.Error(e) =>
        switch Js.Exn.message(e) {
        | Some(msg) => Error(msg)
        | None => Error("Unknown error")
        }
      }

      let attemptEnd = getCurrentTime()
      let delayMs = if attemptNumber < config.maxAttempts {
        calculateDelay(config.strategy, attemptNumber)
      } else {
        0
      }

      // Record attempt
      let attempt = {
        attemptNumber,
        timestamp: attemptStart,
        error: switch result {
        | Error(e) => Some(e)
        | Ok(_) => None
        },
        delayMs,
      }
      let _ = Js.Array2.push(attempts, attempt)

      switch result {
      | Ok(_) => result
      | Error(error) => {
          // Check if we should retry
          if attemptNumber < config.maxAttempts && shouldRetryFn(error) {
            // Wait before retry
            if delayMs > 0 {
              await sleep(delayMs)
            }
            // Retry
            await executeAttempt(attemptNumber + 1)
          } else {
            // Don't retry
            result
          }
        }
      }
    }
  }

  let result = await executeAttempt(1)
  let endTime = getCurrentTime()

  {
    result,
    attempts,
    totalDuration: endTime -. startTime,
    usedFallback: false,
  }
}

// ============================================================================
// RETRY WITH FALLBACK
// ============================================================================

@genType
let retryWithFallback = async (
  fn: unit => promise<result<'a, string>>,
  config: retryConfig,
  fallback: fallbackStrategy<'a>,
) => {
  let execution = await retry(fn, config)

  switch execution.result {
  | Ok(_) => execution
  | Error(_) => {
      // Apply fallback
      let fallbackResult = switch fallback {
      | DefaultValue(value) => Js.Promise.resolve(Ok(value))
      | AlternativeFunction(altFn) => altFn()
      | Cached(value) => Js.Promise.resolve(Ok(value))
      | Degraded(value) => Js.Promise.resolve(Ok(value))
      }

      let finalResult = await fallbackResult
      {
        ...execution,
        result: finalResult,
        usedFallback: true,
      }
    }
  }
}

// ============================================================================
// RETRY WITH CIRCUIT BREAKER
// ============================================================================

@genType
let retryWithCircuitBreaker = async (
  fn: unit => promise<result<'a, string>>,
  config: retryConfig,
  circuitBreaker: circuitBreaker,
) => {
  // Check if circuit breaker allows attempt
  let (shouldTry, updatedCb) = shouldAttempt(circuitBreaker)

  if !shouldTry {
    // Circuit is open, return error immediately
    let execution = {
      result: Error("Circuit breaker is open"),
      attempts: [],
      totalDuration: 0.0,
      usedFallback: false,
    }
    (execution, updatedCb)
  } else {
    // Attempt execution with retry
    let execution = await retry(fn, config)

    // Update circuit breaker based on result
    let finalCb = switch execution.result {
    | Ok(_) => recordSuccess(updatedCb)
    | Error(_) => recordFailure(updatedCb)
    }

    (execution, finalCb)
  }
}

// ============================================================================
// BATCH RETRY
// ============================================================================

@genType
let retryBatch = async (
  fns: array<unit => promise<result<'a, string>>>,
  config: retryConfig,
) => {
  let promises = Belt.Array.map(fns, fn => retry(fn, config))
  let results = await Js.Promise.all(promises)
  results
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

@genType
let wasSuccessful = (execution: retryExecution<'a>): bool => {
  switch execution.result {
  | Ok(_) => true
  | Error(_) => false
  }
}

@genType
let getAttemptCount = (execution: retryExecution<'a>): int => {
  Belt.Array.length(execution.attempts)
}

@genType
let getTotalRetries = (execution: retryExecution<'a>): int => {
  let count = Belt.Array.length(execution.attempts)
  if count > 0 {
    count - 1
  } else {
    0
  }
}

@genType
let getAverageDelay = (execution: retryExecution<'a>): float => {
  let attempts = execution.attempts
  if Belt.Array.length(attempts) === 0 {
    0.0
  } else {
    let totalDelay = Belt.Array.reduce(attempts, 0, (acc, attempt) => acc + attempt.delayMs)
    Belt.Int.toFloat(totalDelay) /. Belt.Int.toFloat(Belt.Array.length(attempts))
  }
}

@genType
let getLastError = (execution: retryExecution<'a>): option<string> => {
  switch execution.result {
  | Ok(_) => None
  | Error(e) => Some(e)
  }
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

@genType
let classifyError = (error: string): errorType => {
  let lowerError = Js.String2.toLowerCase(error)

  if (
    Js.String2.includes(lowerError, "rate limit") ||
    Js.String2.includes(lowerError, "too many requests") ||
    Js.String2.includes(lowerError, "429")
  ) {
    RateLimited
  } else if (
    Js.String2.includes(lowerError, "timeout") ||
    Js.String2.includes(lowerError, "timed out") ||
    Js.String2.includes(lowerError, "deadline")
  ) {
    Timeout
  } else if (
    Js.String2.includes(lowerError, "network") ||
    Js.String2.includes(lowerError, "connection") ||
    Js.String2.includes(lowerError, "unavailable") ||
    Js.String2.includes(lowerError, "503") ||
    Js.String2.includes(lowerError, "502")
  ) {
    Retryable
  } else if (
    Js.String2.includes(lowerError, "unauthorized") ||
    Js.String2.includes(lowerError, "forbidden") ||
    Js.String2.includes(lowerError, "401") ||
    Js.String2.includes(lowerError, "403") ||
    Js.String2.includes(lowerError, "invalid") ||
    Js.String2.includes(lowerError, "not found") ||
    Js.String2.includes(lowerError, "404")
  ) {
    NonRetryable
  } else {
    Retryable // Default to retryable
  }
}

@genType
let isRetryable = (error: string): bool => {
  switch classifyError(error) {
  | Retryable | RateLimited | Timeout => true
  | NonRetryable => false
  }
}

// ============================================================================
// STRATEGY BUILDERS
// ============================================================================

@genType
let fixedDelay = (~delayMs: int): retryStrategy => FixedDelay({delayMs: delayMs})

@genType
let exponentialBackoff = (
  ~initialDelayMs: int=100,
  ~maxDelayMs: int=30000,
  ~multiplier: float=2.0,
  (),
): retryStrategy => ExponentialBackoff({initialDelayMs, maxDelayMs, multiplier})

@genType
let linearBackoff = (~initialDelayMs: int=100, ~incrementMs: int=100, ()): retryStrategy =>
  LinearBackoff({initialDelayMs, incrementMs})

@genType
let randomJitter = (~baseDelayMs: int=100, ~maxJitterMs: int=1000, ()): retryStrategy =>
  RandomJitter({baseDelayMs, maxJitterMs})
