// ============================================================================
// RetryOrchestrator.res - Type-safe retry logic with exponential backoff
// ============================================================================
//
// PREVENTS: BUG #6 (Incorrect retry logic leading to infinite loops)
//
// TypeScript problem: Manual retry loops, missing backoff, infinite retries
// ReScript solution: Type-safe retry strategies, circuit breaker, configurable limits
//
// ============================================================================

// Import ErrorHandling for Result types
open ErrorHandling

// ============================================================================
// RETRY STRATEGY TYPES
// ============================================================================

// Retry strategy configuration
@genType
type retryConfig = {
  maxAttempts: int,         // Maximum number of retry attempts
  initialDelayMs: int,      // Initial delay in milliseconds
  maxDelayMs: int,          // Maximum delay (cap for exponential backoff)
  backoffMultiplier: float, // Multiplier for exponential backoff (e.g., 2.0)
  jitter: bool,             // Add randomness to prevent thundering herd
}

// Retry strategy variants
@genType
type retryStrategy =
  | @as("Exponential") Exponential(retryConfig)
  | @as("Linear") Linear(int, int)  // (attempts, delayMs)
  | @as("Immediate") Immediate(int) // (attempts) - no delay
  | @as("Fixed") Fixed(int, int)    // (attempts, delayMs) - constant delay

// Default exponential backoff configuration
@genType
let defaultRetryConfig: retryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,     // 1 second
  maxDelayMs: 30000,        // 30 seconds
  backoffMultiplier: 2.0,   // Double each time
  jitter: true,             // Add randomness
}

// ============================================================================
// RETRYABLE OPERATION TYPE
// ============================================================================

// Operation that can be retried
@genType
type retryable<'ok, 'err> = {
  operation: unit => Js.Promise.t<result<'ok, 'err>>,
  shouldRetry: 'err => bool,              // Predicate: should we retry this error?
  onRetry: (int, 'err) => unit,          // Callback on each retry
  onSuccess: 'ok => unit,                 // Callback on success
  onFailure: 'err => unit,                // Callback on final failure
}

// Create retryable operation with defaults
@genType
let createRetryable = (
  ~operation: unit => Js.Promise.t<result<'ok, 'err>>,
  ~shouldRetry: 'err => bool = _ => true,
  ~onRetry: (int, 'err) => unit = (_, _) => (),
  ~onSuccess: 'ok => unit = _ => (),
  ~onFailure: 'err => unit = _ => (),
): retryable<'ok, 'err> => {
  {
    operation,
    shouldRetry,
    onRetry,
    onSuccess,
    onFailure,
  }
}

// ============================================================================
// DELAY CALCULATION
// ============================================================================

// Calculate delay with jitter
let calculateDelayWithJitter = (baseDelay: int, useJitter: bool): int => {
  if useJitter {
    // Add ±25% randomness
    let jitterFactor = 0.75 +. (Js.Math.random() *. 0.5) // 0.75 to 1.25
    Belt.Float.toInt(Belt.Int.toFloat(baseDelay) *. jitterFactor)
  } else {
    baseDelay
  }
}

// Calculate exponential backoff delay
@genType
let calculateExponentialDelay = (config: retryConfig, attemptNumber: int): int => {
  let power = Belt.Int.toFloat(attemptNumber - 1) // 0-indexed for calculation
  let delay = Belt.Int.toFloat(config.initialDelayMs) *.
    Js.Math.pow_float(~base=config.backoffMultiplier, ~exp=power)

  let cappedDelay = Js.Math.min_float(delay, Belt.Int.toFloat(config.maxDelayMs))
    ->Belt.Float.toInt

  calculateDelayWithJitter(cappedDelay, config.jitter)
}

// Calculate linear delay
@genType
let calculateLinearDelay = (baseDelayMs: int, attemptNumber: int): int => {
  baseDelayMs * attemptNumber
}

// Get delay for strategy
@genType
let getDelayForStrategy = (strategy: retryStrategy, attemptNumber: int): int => {
  switch strategy {
  | Exponential(config) => calculateExponentialDelay(config, attemptNumber)
  | Linear(_, delayMs) => calculateLinearDelay(delayMs, attemptNumber)
  | Immediate(_) => 0
  | Fixed(_, delayMs) => delayMs
  }
}

// Get max attempts for strategy
@genType
let getMaxAttempts = (strategy: retryStrategy): int => {
  switch strategy {
  | Exponential(config) => config.maxAttempts
  | Linear(attempts, _) => attempts
  | Immediate(attempts) => attempts
  | Fixed(attempts, _) => attempts
  }
}

// ============================================================================
// RETRY EXECUTION
// ============================================================================

// Execute operation with retry logic
@genType
let retry = (
  retryable: retryable<'ok, 'err>,
  strategy: retryStrategy,
): Js.Promise.t<result<'ok, 'err>> => {
  let maxAttempts = getMaxAttempts(strategy)

  let rec attempt = (attemptNumber: int): Js.Promise.t<result<'ok, 'err>> => {
    retryable.operation()
    ->Js.Promise.then_(result => {
      switch result {
      | Ok(value) => {
          retryable.onSuccess(value)
          Js.Promise.resolve(Ok(value))
        }
      | Error(err) => {
          if attemptNumber >= maxAttempts {
            // Final failure - no more retries
            retryable.onFailure(err)
            Js.Promise.resolve(Error(err))
          } else if retryable.shouldRetry(err) {
            // Retry after delay
            retryable.onRetry(attemptNumber, err)
            let delayMs = getDelayForStrategy(strategy, attemptNumber)

            Js.Promise.make((~resolve, ~reject as _) => {
              let _ = Js.Global.setTimeout(() => {
                attempt(attemptNumber + 1)
                ->Js.Promise.then_(result => {
                  resolve(. result)
                  Js.Promise.resolve(())
                }, _)
                ->ignore
              }, delayMs)
            })
          } else {
            // Error is not retryable
            retryable.onFailure(err)
            Js.Promise.resolve(Error(err))
          }
        }
      }
    }, _)
  }

  attempt(1)
}

// ============================================================================
// CIRCUIT BREAKER PATTERN
// ============================================================================

// Circuit breaker states
@genType
type circuitState =
  | @as("Closed") Closed                    // Normal operation
  | @as("Open") Open(int)                   // Failing, timestamp when opened
  | @as("HalfOpen") HalfOpen                // Testing if recovered

// Circuit breaker configuration
@genType
type circuitBreakerConfig = {
  failureThreshold: int,      // Number of failures before opening
  successThreshold: int,      // Number of successes to close from half-open
  cooldownPeriodMs: int,      // How long to wait before trying again
  timeoutMs: int,             // Operation timeout
}

// Circuit breaker
@genType
type circuitBreaker<'ok, 'err> = {
  mutable state: circuitState,
  mutable failureCount: int,
  mutable successCount: int,
  config: circuitBreakerConfig,
  operation: retryable<'ok, 'err>,
}

// Default circuit breaker configuration
@genType
let defaultCircuitBreakerConfig: circuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  cooldownPeriodMs: 60000,  // 1 minute
  timeoutMs: 5000,          // 5 seconds
}

// Create circuit breaker
@genType
let createCircuitBreaker = (
  ~operation: retryable<'ok, 'err>,
  ~config: circuitBreakerConfig = defaultCircuitBreakerConfig,
): circuitBreaker<'ok, 'err> => {
  {
    state: Closed,
    failureCount: 0,
    successCount: 0,
    config,
    operation,
  }
}

// Check if circuit breaker should allow operation
@genType
let shouldAllowOperation = (breaker: circuitBreaker<'ok, 'err>): result<unit, string> => {
  switch breaker.state {
  | Closed => Ok()
  | HalfOpen => Ok()
  | Open(openedAt) => {
      let now = Js.Date.now()->Belt.Float.toInt
      let timeSinceOpen = now - openedAt

      if timeSinceOpen >= breaker.config.cooldownPeriodMs {
        // Cooldown period elapsed, transition to half-open
        breaker.state = HalfOpen
        breaker.successCount = 0
        Ok()
      } else {
        Error("Circuit breaker is open")
      }
    }
  }
}

// Record success in circuit breaker
@genType
let recordSuccess = (breaker: circuitBreaker<'ok, 'err>): unit => {
  switch breaker.state {
  | Closed => {
      breaker.failureCount = 0
    }
  | HalfOpen => {
      breaker.successCount = breaker.successCount + 1
      if breaker.successCount >= breaker.config.successThreshold {
        // Enough successes, close the circuit
        breaker.state = Closed
        breaker.failureCount = 0
        breaker.successCount = 0
      }
    }
  | Open(_) => ()
  }
}

// Record failure in circuit breaker
@genType
let recordFailure = (breaker: circuitBreaker<'ok, 'err>): unit => {
  switch breaker.state {
  | Closed => {
      breaker.failureCount = breaker.failureCount + 1
      if breaker.failureCount >= breaker.config.failureThreshold {
        // Too many failures, open the circuit
        breaker.state = Open(Js.Date.now()->Belt.Float.toInt)
      }
    }
  | HalfOpen => {
      // Failed during test, reopen the circuit
      breaker.state = Open(Js.Date.now()->Belt.Float.toInt)
      breaker.successCount = 0
    }
  | Open(_) => ()
  }
}

// Execute operation with circuit breaker
@genType
let executeWithCircuitBreaker = (
  breaker: circuitBreaker<'ok, 'err>,
): Js.Promise.t<result<'ok, 'err>> => {
  switch shouldAllowOperation(breaker) {
  | Error(err) => Js.Promise.resolve(Error(err))
  | Ok(_) => {
      breaker.operation.operation()
      ->Js.Promise.then_(result => {
        switch result {
        | Ok(value) => {
            recordSuccess(breaker)
            breaker.operation.onSuccess(value)
            Js.Promise.resolve(Ok(value))
          }
        | Error(err) => {
            recordFailure(breaker)
            breaker.operation.onFailure(err)
            Js.Promise.resolve(Error(err))
          }
        }
      }, _)
    }
  }
}

// ============================================================================
// RETRY WITH CIRCUIT BREAKER
// ============================================================================

// Execute operation with both retry and circuit breaker
@genType
let retryWithCircuitBreaker = (
  retryable: retryable<'ok, 'err>,
  strategy: retryStrategy,
  circuitConfig: circuitBreakerConfig,
): Js.Promise.t<result<'ok, 'err>> => {
  let breaker = createCircuitBreaker(~operation=retryable, ~config=circuitConfig)

  let wrappedOperation = createRetryable(
    ~operation=() => executeWithCircuitBreaker(breaker),
    ~shouldRetry=retryable.shouldRetry,
    ~onRetry=retryable.onRetry,
    ~onSuccess=retryable.onSuccess,
    ~onFailure=retryable.onFailure,
  )

  retry(wrappedOperation, strategy)
}

// ============================================================================
// BATCH RETRY (Multiple operations)
// ============================================================================

// Retry multiple operations sequentially
@genType
let retryBatch = (
  operations: array<retryable<'ok, 'err>>,
  strategy: retryStrategy,
): Js.Promise.t<result<array<'ok>, 'err>> => {
  let results = ref([])
  let error = ref(None)

  let rec processNext = (index: int): Js.Promise.t<result<array<'ok>, 'err>> => {
    if index >= Belt.Array.length(operations) {
      switch error.contents {
      | Some(err) => Js.Promise.resolve(Error(err))
      | None => Js.Promise.resolve(Ok(results.contents))
      }
    } else {
      switch Belt.Array.get(operations, index) {
      | Some(op) =>
        retry(op, strategy)
        ->Js.Promise.then_(result => {
          switch result {
          | Ok(value) => {
              results := Belt.Array.concat(results.contents, [value])
              processNext(index + 1)
            }
          | Error(err) => {
              error := Some(err)
              Js.Promise.resolve(Error(err))
            }
          }
        }, _)
      | None => processNext(index + 1)
      }
    }
  }

  processNext(0)
}

// Retry multiple operations in parallel
@genType
let retryBatchParallel = (
  operations: array<retryable<'ok, 'err>>,
  strategy: retryStrategy,
): Js.Promise.t<array<result<'ok, 'err>>> => {
  let promises = Belt.Array.map(operations, op => retry(op, strategy))
  Js.Promise.all(promises)
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Get strategy name
@genType
let getStrategyName = (strategy: retryStrategy): string => {
  switch strategy {
  | Exponential(_) => "Exponential"
  | Linear(_, _) => "Linear"
  | Immediate(_) => "Immediate"
  | Fixed(_, _) => "Fixed"
  }
}

// Get circuit breaker state name
@genType
let getCircuitStateName = (state: circuitState): string => {
  switch state {
  | Closed => "Closed"
  | Open(_) => "Open"
  | HalfOpen => "HalfOpen"
  }
}

// Check if error is retryable (common patterns)
@genType
let isNetworkError = (statusCode: int): bool => {
  statusCode >= 500 || statusCode == 429 // Server errors or rate limit
}

@genType
let isTimeoutError = (message: string): bool => {
  Js.String.includes("timeout", Js.String.toLowerCase(message))
}

@genType
let isConnectionError = (message: string): bool => {
  Js.String.includes("connection", Js.String.toLowerCase(message)) ||
  Js.String.includes("network", Js.String.toLowerCase(message))
}

// ============================================================================
// EXAMPLE USAGE (not exported, for documentation)
// ============================================================================

// Example 1: Retry with exponential backoff (BUG #6 prevention)
// let fetchUser = createRetryable(
//   ~operation=() => {
//     // Fetch user from API
//     fetchUserFromAPI("user-123")
//   },
//   ~shouldRetry=err => {
//     // Retry on network errors, not on 404
//     switch err {
//     | NetworkError(status, _) => isNetworkError(status)
//     | TimeoutError(_) => true
//     | NotFound(_) => false  // Don't retry 404
//     | _ => true
//     }
//   },
//   ~onRetry=(attempt, err) => {
//     Js.log2(`Retry attempt ${Belt.Int.toString(attempt)}:`, err)
//   },
//   ~onSuccess=user => {
//     Js.log2("Successfully fetched user:", user.name)
//   },
//   ~onFailure=err => {
//     Js.log2("Failed to fetch user after retries:", err)
//   }
// )
//
// let result = await retry(fetchUser, Exponential(defaultRetryConfig))
// switch result {
// | Ok(user) => // Process user
// | Error(err) => // Handle final error
// }

// Example 2: Circuit breaker pattern
// let breaker = createCircuitBreaker(
//   ~operation=fetchUser,
//   ~config={
//     failureThreshold: 5,
//     successThreshold: 2,
//     cooldownPeriodMs: 60000,
//     timeoutMs: 5000,
//   }
// )
//
// let result = await executeWithCircuitBreaker(breaker)
// // Circuit opens after 5 failures
// // Won't call API during cooldown period
// // Tests recovery in half-open state

// Example 3: Batch retry
// let operations = [
//   createRetryable(~operation=() => fetchUser("user-1")),
//   createRetryable(~operation=() => fetchUser("user-2")),
//   createRetryable(~operation=() => fetchUser("user-3")),
// ]
//
// let results = await retryBatch(operations, Exponential(defaultRetryConfig))
// // Retries each operation independently
// // Stops on first failure
