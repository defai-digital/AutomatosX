// ============================================================================
// ErrorHandling.res - Type-safe error handling with Result types
// ============================================================================
//
// PREVENTS: BUG #3 (missing error handling in DAO operations)
//
// TypeScript problem: Exceptions and missing error handling
// ReScript solution: Result type forces explicit error handling at compile time
//
// ============================================================================

// ============================================================================
// RESULT TYPE (Standard functional programming pattern)
// ============================================================================

// Result type - either success (Ok) or failure (Error)
// Forces caller to handle both cases explicitly
@genType
type result<'ok, 'err> =
  | Ok('ok)
  | Error('err)

// ============================================================================
// ERROR TYPES (Variant types for all possible errors)
// ============================================================================

// Database access object errors
@genType
type daoError =
  | @as("NotFound") NotFound(string)  // Record not found
  | @as("DatabaseError") DatabaseError(string)  // SQL error
  | @as("ValidationError") ValidationError(string)  // Invalid data
  | @as("ConnectionError") ConnectionError(string)  // Connection failed
  | @as("TimeoutError") TimeoutError(int)  // Timeout in milliseconds
  | @as("ConstraintViolation") ConstraintViolation(string)  // Unique constraint, etc.

// Network/API errors
@genType
type networkError =
  | @as("RequestFailed") RequestFailed(int, string)  // status code, message
  | @as("NetworkTimeout") NetworkTimeout(int)  // timeout in ms
  | @as("InvalidResponse") InvalidResponse(string)  // parsing error
  | @as("Unauthorized") Unauthorized  // 401
  | @as("Forbidden") Forbidden  // 403
  | @as("RateLimited") RateLimited(int)  // retry after seconds

// Validation errors
@genType
type validationError =
  | @as("MissingField") MissingField(string)  // field name
  | @as("InvalidFormat") InvalidFormat(string, string)  // field, reason
  | @as("OutOfRange") OutOfRange(string, float, float)  // field, min, max
  | @as("TooLong") TooLong(string, int, int)  // field, actual, max
  | @as("TooShort") TooShort(string, int, int)  // field, actual, min

// Application errors (domain-specific)
@genType
type appError =
  | @as("DaoError") DaoError(daoError)
  | @as("NetworkError") NetworkError(networkError)
  | @as("ValidationError") ValidationError(validationError)
  | @as("BusinessLogicError") BusinessLogicError(string)
  | @as("ConfigurationError") ConfigurationError(string)
  | @as("UnknownError") UnknownError(string)

// ============================================================================
// ERROR RECOVERY STRATEGIES
// ============================================================================

// How to recover from errors
@genType
type recoveryStrategy<'ok, 'err> =
  | @as("Retry") Retry(int)  // Retry N times
  | @as("Fallback") Fallback('ok)  // Use default value
  | @as("FallbackFn") FallbackFn(unit => result<'ok, 'err>)  // Compute fallback
  | @as("FailFast") FailFast  // Propagate error immediately
  | @as("Ignore") Ignore('ok)  // Ignore error, return default

// ============================================================================
// RESULT UTILITIES
// ============================================================================

// Check if result is Ok
@genType
let isOk = (result: result<'ok, 'err>): bool => {
  switch result {
  | Ok(_) => true
  | Error(_) => false
  }
}

// Check if result is Error
@genType
let isError = (result: result<'ok, 'err>): bool => {
  switch result {
  | Ok(_) => false
  | Error(_) => true
  }
}

// Get Ok value or default
@genType
let getOr = (result: result<'ok, 'err>, defaultValue: 'ok): 'ok => {
  switch result {
  | Ok(value) => value
  | Error(_) => defaultValue
  }
}

// Get Ok value or compute default
@genType
let getOrElse = (result: result<'ok, 'err>, fn: unit => 'ok): 'ok => {
  switch result {
  | Ok(value) => value
  | Error(_) => fn()
  }
}

// Get Error or default
@genType
let getErrorOr = (result: result<'ok, 'err>, defaultValue: 'err): 'err => {
  switch result {
  | Ok(_) => defaultValue
  | Error(err) => err
  }
}

// Map over Ok value
@genType
let map = (result: result<'ok, 'err>, fn: 'ok => 'b): result<'b, 'err> => {
  switch result {
  | Ok(value) => Ok(fn(value))
  | Error(err) => Error(err)
  }
}

// Map over Error value
@genType
let mapError = (result: result<'ok, 'err>, fn: 'err => 'e): result<'ok, 'e> => {
  switch result {
  | Ok(value) => Ok(value)
  | Error(err) => Error(fn(err))
  }
}

// Flat map (chain) for sequencing operations
@genType
let flatMap = (result: result<'ok, 'err>, fn: 'ok => result<'b, 'err>): result<'b, 'err> => {
  switch result {
  | Ok(value) => fn(value)
  | Error(err) => Error(err)
  }
}

// Also known as "bind" or "chain"
@genType
let chain = flatMap

// Apply function in Result to value in Result
@genType
let apply = (
  resultFn: result<'ok => 'b, 'err>,
  resultValue: result<'ok, 'err>
): result<'b, 'err> => {
  switch (resultFn, resultValue) {
  | (Ok(fn), Ok(value)) => Ok(fn(value))
  | (Error(err), _) => Error(err)
  | (_, Error(err)) => Error(err)
  }
}

// Convert Option to Result
@genType
let fromOption = (opt: option<'ok>, error: 'err): result<'ok, 'err> => {
  switch opt {
  | Some(value) => Ok(value)
  | None => Error(error)
  }
}

// Convert Result to Option (loses error information)
@genType
let toOption = (result: result<'ok, 'err>): option<'ok> => {
  switch result {
  | Ok(value) => Some(value)
  | Error(_) => None
  }
}

// Recover from error using strategy
@genType
let recover = (
  result: result<'ok, 'err>,
  strategy: recoveryStrategy<'ok, 'err>
): result<'ok, 'err> => {
  switch result {
  | Ok(_) => result  // Already succeeded
  | Error(_) => {
      switch strategy {
      | Fallback(value) => Ok(value)
      | Ignore(value) => Ok(value)
      | FailFast => result  // Propagate error
      | _ => result  // Retry/FallbackFn handled by caller
      }
    }
  }
}

// ============================================================================
// ERROR HANDLING FOR PROMISES
// ============================================================================

// Wrap Promise in Result (for async operations)
@genType
let fromPromise = (
  promise: Js.Promise.t<'ok>,
  onError: Js.Promise.error => 'err
): Js.Promise.t<result<'ok, 'err>> => {
  promise
  |> Js.Promise.then_(value => Js.Promise.resolve(Ok(value)), _)
  |> Js.Promise.catch(error => Js.Promise.resolve(Error(onError(error))), _)
}

// Convert Result to Promise (throws on Error)
@genType
let toPromise = (result: result<'ok, 'err>): Js.Promise.t<'ok> => {
  switch result {
  | Ok(value) => Js.Promise.resolve(value)
  | Error(_) => Js.Promise.reject(Js.Exn.raiseError("Result is Error"))
  }
}

// ============================================================================
// COMBINING RESULTS
// ============================================================================

// Combine two Results (both must be Ok)
@genType
let combine2 = (
  r1: result<'a, 'err>,
  r2: result<'b, 'err>
): result<('a, 'b), 'err> => {
  switch (r1, r2) {
  | (Ok(a), Ok(b)) => Ok((a, b))
  | (Error(err), _) => Error(err)
  | (_, Error(err)) => Error(err)
  }
}

// Combine three Results
@genType
let combine3 = (
  r1: result<'a, 'err>,
  r2: result<'b, 'err>,
  r3: result<'c, 'err>
): result<('a, 'b, 'c), 'err> => {
  switch (r1, r2, r3) {
  | (Ok(a), Ok(b), Ok(c)) => Ok((a, b, c))
  | (Error(err), _, _) => Error(err)
  | (_, Error(err), _) => Error(err)
  | (_, _, Error(err)) => Error(err)
  }
}

// Combine array of Results (all must be Ok)
@genType
let combineArray = (results: array<result<'ok, 'err>>): result<array<'ok>, 'err> => {
  let values = []
  let error = ref(None)

  for i in 0 to Belt.Array.length(results) - 1 {
    switch results[i] {
    | Ok(value) => {
        if error.contents == None {
          Js.Array.push(value, values)->ignore
        }
      }
    | Error(err) => {
        if error.contents == None {
          error := Some(err)
        }
      }
    }
  }

  switch error.contents {
  | None => Ok(values)
  | Some(err) => Error(err)
  }
}

// ============================================================================
// ERROR CONVERSION
// ============================================================================

// Convert DAO error to app error
@genType
let daoErrorToAppError = (err: daoError): appError => {
  DaoError(err)
}

// Convert network error to app error
@genType
let networkErrorToAppError = (err: networkError): appError => {
  NetworkError(err)
}

// Convert validation error to app error
@genType
let validationErrorToAppError = (err: validationError): appError => {
  ValidationError(err)
}

// ============================================================================
// ERROR MESSAGES (for logging/display)
// ============================================================================

// Get human-readable error message
@genType
let daoErrorToString = (err: daoError): string => {
  switch err {
  | NotFound(entity) => `${entity} not found`
  | DatabaseError(msg) => `Database error: ${msg}`
  | ValidationError(msg) => `Validation error: ${msg}`
  | ConnectionError(msg) => `Connection error: ${msg}`
  | TimeoutError(ms) => `Operation timed out after ${Belt.Int.toString(ms)}ms`
  | ConstraintViolation(msg) => `Constraint violation: ${msg}`
  }
}

@genType
let networkErrorToString = (err: networkError): string => {
  switch err {
  | RequestFailed(status, msg) => `Request failed (${Belt.Int.toString(status)}): ${msg}`
  | NetworkTimeout(ms) => `Network timeout after ${Belt.Int.toString(ms)}ms`
  | InvalidResponse(msg) => `Invalid response: ${msg}`
  | Unauthorized => "Unauthorized (401)"
  | Forbidden => "Forbidden (403)"
  | RateLimited(retryAfter) => `Rate limited, retry after ${Belt.Int.toString(retryAfter)}s`
  }
}

@genType
let validationErrorToString = (err: validationError): string => {
  switch err {
  | MissingField(field) => `Missing required field: ${field}`
  | InvalidFormat(field, reason) => `Invalid format for ${field}: ${reason}`
  | OutOfRange(field, min, max) =>
      `${field} out of range (${Belt.Float.toString(min)}-${Belt.Float.toString(max)})`
  | TooLong(field, actual, max) =>
      `${field} too long (${Belt.Int.toString(actual)} > ${Belt.Int.toString(max)})`
  | TooShort(field, actual, min) =>
      `${field} too short (${Belt.Int.toString(actual)} < ${Belt.Int.toString(min)})`
  }
}

@genType
let appErrorToString = (err: appError): string => {
  switch err {
  | DaoError(e) => daoErrorToString(e)
  | NetworkError(e) => networkErrorToString(e)
  | ValidationError(e) => validationErrorToString(e)
  | BusinessLogicError(msg) => `Business logic error: ${msg}`
  | ConfigurationError(msg) => `Configuration error: ${msg}`
  | UnknownError(msg) => `Unknown error: ${msg}`
  }
}

// ============================================================================
// EXAMPLE USAGE (not exported, for documentation)
// ============================================================================

// Example 1: Safe DAO operation
// let getUser = (id: string): result<user, daoError> => {
//   // ... database query ...
//   NotFound(`User ${id}`)  // Type-safe error!
// }
//
// let user = getUser("123")
// switch user {
// | Ok(u) => Js.log2("Found user:", u.name)
// | Error(NotFound(msg)) => Js.log2("Not found:", msg)
// | Error(DatabaseError(msg)) => Js.log2("DB error:", msg)
// | Error(_) => Js.log("Other error")
// }

// Example 2: Chaining operations
// let result = getUser("123")
//   ->map(user => user.email)
//   ->flatMap(email => validateEmail(email))
//   ->map(validEmail => sendEmail(validEmail))
//
// // Errors propagate automatically!
// // Only succeeds if all operations succeed

// Example 3: Combining results
// let result = combine3(
//   getUser("123"),
//   getConversation("conv-456"),
//   getMessage("msg-789")
// )
//
// switch result {
// | Ok((user, conv, msg)) => // All succeeded!
// | Error(err) => // Any one failed
// }

// Example 4: Recovery strategies
// let result = getUser("123")
//   ->recover(Fallback(defaultUser))  // Use default if not found
//
// // Always succeeds with either real user or default
