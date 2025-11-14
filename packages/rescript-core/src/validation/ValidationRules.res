// ============================================================================
// ValidationRules.res - Type-safe validation with phantom types
// ============================================================================
//
// PREVENTS: BUG #5 (Invalid embedding dimensions), BUG #14 (Missing validation)
//
// TypeScript problem: Runtime validation, missing checks, dimension mismatches
// ReScript solution: Phantom types enforce validation at compile time
//
// ============================================================================

// Import ErrorHandling for Result types
open ErrorHandling

// ============================================================================
// PHANTOM TYPES (Zero-cost validation state tracking)
// ============================================================================

// Validation states (phantom types - exist only at compile time)
type validated
type unvalidated

// ============================================================================
// VALIDATED PRIMITIVES (Smart constructors with phantom types)
// ============================================================================

// Non-empty string (must be validated)
@genType
type nonEmptyString<'state> = string

// Create non-empty string (smart constructor)
@genType
let nonEmptyString = (s: string): result<nonEmptyString<validated>, string> => {
  if Js.String.length(s) > 0 {
    Ok(s)
  } else {
    Error("String cannot be empty")
  }
}

// Positive integer (must be validated)
@genType
type positiveInt<'state> = int

// Create positive integer (smart constructor)
@genType
let positiveInt = (n: int): result<positiveInt<validated>, string> => {
  if n > 0 {
    Ok(n)
  } else {
    Error(`Value must be positive, got ${Belt.Int.toString(n)}`)
  }
}

// Non-negative integer (0 or positive)
@genType
type nonNegativeInt<'state> = int

// Create non-negative integer (smart constructor)
@genType
let nonNegativeInt = (n: int): result<nonNegativeInt<validated>, string> => {
  if n >= 0 {
    Ok(n)
  } else {
    Error(`Value must be non-negative, got ${Belt.Int.toString(n)}`)
  }
}

// Valid email (must be validated)
@genType
type validEmail<'state> = string

// Create valid email (smart constructor with regex validation)
@genType
let validEmail = (email: string): result<validEmail<validated>, string> => {
  // Simple email validation regex
  let emailRegex = %re("/^[^\s@]+@[^\s@]+\.[^\s@]+$/")
  if Js.Re.test_(emailRegex, email) {
    Ok(email)
  } else {
    Error(`Invalid email format: ${email}`)
  }
}

// URL (must be validated)
@genType
type validUrl<'state> = string

// Create valid URL (smart constructor)
@genType
let validUrl = (url: string): result<validUrl<validated>, string> => {
  // Simple URL validation
  let urlRegex = %re("/^https?:\/\/.+/")
  if Js.Re.test_(urlRegex, url) {
    Ok(url)
  } else {
    Error(`Invalid URL format: ${url}`)
  }
}

// ============================================================================
// VALIDATED EMBEDDING (Phantom types for dimension safety)
// ============================================================================

// Embedding with validation state
@genType
type validatedEmbedding<'state> = {
  dimensions: int,
  vector: array<float>,
  model: string,
}

// Create unvalidated embedding (from external source)
@genType
let createUnvalidatedEmbedding = (
  ~dimensions: int,
  ~vector: array<float>,
  ~model: string,
): validatedEmbedding<unvalidated> => {
  {
    dimensions: dimensions,
    vector: vector,
    model: model,
  }
}

// Validate embedding dimensions (smart constructor)
@genType
let validateEmbedding = (
  embedding: validatedEmbedding<unvalidated>,
  ~expectedDimensions: int,
): result<validatedEmbedding<validated>, string> => {
  let actualDimensions = Belt.Array.length(embedding.vector)

  // Check declared dimensions match actual vector length
  if embedding.dimensions != actualDimensions {
    Error(
      `Declared dimensions (${Belt.Int.toString(embedding.dimensions)}) don't match vector length (${Belt.Int.toString(actualDimensions)})`,
    )
  } else if actualDimensions != expectedDimensions {
    // Check dimensions match expected
    Error(
      `Invalid embedding dimensions: expected ${Belt.Int.toString(expectedDimensions)}, got ${Belt.Int.toString(actualDimensions)}`,
    )
  } else {
    // All checks passed - return validated embedding
    Ok({
      dimensions: embedding.dimensions,
      vector: embedding.vector,
      model: embedding.model,
    })
  }
}

// Get dimensions from validated embedding (type-safe!)
@genType
let getEmbeddingDimensions = (embedding: validatedEmbedding<validated>): int => {
  embedding.dimensions
}

// Get vector from validated embedding (type-safe!)
@genType
let getEmbeddingVector = (embedding: validatedEmbedding<validated>): array<float> => {
  embedding.vector
}

// Only validated embeddings can be stored!
@genType
let storeEmbedding = (
  embedding: validatedEmbedding<validated>,
): Js.Promise.t<result<unit, string>> => {
  // Simulate database storage
  Js.Promise.resolve(Ok())
}

// ============================================================================
// VALIDATED COLLECTIONS (Arrays with size constraints)
// ============================================================================

// Non-empty array (must contain at least one element)
@genType
type nonEmptyArray<'a, 'state> = array<'a>

// Create non-empty array (smart constructor)
@genType
let nonEmptyArray = (arr: array<'a>): result<nonEmptyArray<'a, validated>, string> => {
  if Belt.Array.length(arr) > 0 {
    Ok(arr)
  } else {
    Error("Array cannot be empty")
  }
}

// Bounded array (must be within size limits)
@genType
type boundedArray<'a, 'state> = {
  items: array<'a>,
  minSize: int,
  maxSize: int,
}

// Create bounded array (smart constructor)
@genType
let boundedArray = (
  arr: array<'a>,
  ~minSize: int,
  ~maxSize: int,
): result<boundedArray<'a, validated>, string> => {
  let size = Belt.Array.length(arr)
  if size < minSize {
    Error(`Array too small: ${Belt.Int.toString(size)} < ${Belt.Int.toString(minSize)}`)
  } else if size > maxSize {
    Error(`Array too large: ${Belt.Int.toString(size)} > ${Belt.Int.toString(maxSize)}`)
  } else {
    Ok({
      items: arr,
      minSize: minSize,
      maxSize: maxSize,
    })
  }
}

// ============================================================================
// VALIDATED RANGES (Numbers within bounds)
// ============================================================================

// Value within range
@genType
type rangedValue<'state> = {
  value: float,
  min: float,
  max: float,
}

// Create ranged value (smart constructor)
@genType
let rangedValue = (
  value: float,
  ~min: float,
  ~max: float,
): result<rangedValue<validated>, string> => {
  if value < min {
    Error(
      `Value ${Belt.Float.toString(value)} below minimum ${Belt.Float.toString(min)}`,
    )
  } else if value > max {
    Error(
      `Value ${Belt.Float.toString(value)} above maximum ${Belt.Float.toString(max)}`,
    )
  } else {
    Ok({
      value: value,
      min: min,
      max: max,
    })
  }
}

// Get value from ranged value (type-safe!)
@genType
let getRangedValue = (ranged: rangedValue<validated>): float => {
  ranged.value
}

// Percentage (0.0 to 1.0)
@genType
type percentage<'state> = float

// Create percentage (smart constructor)
@genType
let percentage = (value: float): result<percentage<validated>, string> => {
  if value < 0.0 || value > 1.0 {
    Error(`Percentage must be 0.0-1.0, got ${Belt.Float.toString(value)}`)
  } else {
    Ok(value)
  }
}

// ============================================================================
// VALIDATION PIPELINE (Combine multiple validations)
// ============================================================================

// Validation rule (predicate function)
@genType
type validationRule<'a> = 'a => result<unit, string>

// Apply validation rule
@genType
let applyRule = (value: 'a, rule: validationRule<'a>): result<'a, string> => {
  switch rule(value) {
  | Ok(_) => Ok(value)
  | Error(err) => Error(err)
  }
}

// Combine multiple validation rules (all must pass)
@genType
let combineRules = (
  value: 'a,
  rules: array<validationRule<'a>>,
): result<'a, array<string>> => {
  let errors = []
  let valid = ref(true)

  for i in 0 to Belt.Array.length(rules) - 1 {
    switch rules[i] {
    | rule =>
      switch rule(value) {
      | Ok(_) => ()
      | Error(err) => {
          valid := false
          Js.Array.push(err, errors)->ignore
        }
      }
    }
  }

  if valid.contents {
    Ok(value)
  } else {
    Error(errors)
  }
}

// ============================================================================
// DOMAIN OBJECTS (Validated composite types)
// ============================================================================

// User with validated fields
@genType
type validatedUser = {
  id: nonEmptyString<validated>,
  email: validEmail<validated>,
  age: positiveInt<validated>,
}

// Create validated user (all fields must be validated)
@genType
let validateUser = (
  ~id: string,
  ~email: string,
  ~age: int,
): result<validatedUser, array<string>> => {
  let errors = []

  // Validate each field
  let validId = switch nonEmptyString(id) {
  | Ok(v) => Some(v)
  | Error(err) => {
      Js.Array.push(err, errors)->ignore
      None
    }
  }

  let validEmail = switch validEmail(email) {
  | Ok(v) => Some(v)
  | Error(err) => {
      Js.Array.push(err, errors)->ignore
      None
    }
  }

  let validAge = switch positiveInt(age) {
  | Ok(v) => Some(v)
  | Error(err) => {
      Js.Array.push(err, errors)->ignore
      None
    }
  }

  // Return user if all validations passed
  switch (validId, validEmail, validAge) {
  | (Some(id), Some(email), Some(age)) =>
    Ok({
      id: id,
      email: email,
      age: age,
    })
  | _ => Error(errors)
  }
}

// Message with validated content
@genType
type validatedMessage = {
  id: nonEmptyString<validated>,
  content: nonEmptyString<validated>,
  embedding: option<validatedEmbedding<validated>>,
  tokens: nonNegativeInt<validated>,
}

// Create validated message
@genType
let validateMessage = (
  ~id: string,
  ~content: string,
  ~embedding: option<validatedEmbedding<validated>>,
  ~tokens: int,
): result<validatedMessage, array<string>> => {
  let errors = []

  // Validate each field
  let validId = switch nonEmptyString(id) {
  | Ok(v) => Some(v)
  | Error(err) => {
      Js.Array.push(err, errors)->ignore
      None
    }
  }

  let validContent = switch nonEmptyString(content) {
  | Ok(v) => Some(v)
  | Error(err) => {
      Js.Array.push(err, errors)->ignore
      None
    }
  }

  let validTokens = switch nonNegativeInt(tokens) {
  | Ok(v) => Some(v)
  | Error(err) => {
      Js.Array.push(err, errors)->ignore
      None
    }
  }

  // Return message if all validations passed
  switch (validId, validContent, validTokens) {
  | (Some(id), Some(content), Some(tokens)) =>
    Ok({
      id: id,
      content: content,
      embedding: embedding,
      tokens: tokens,
    })
  | _ => Error(errors)
  }
}

// ============================================================================
// CONVERSION UTILITIES (Safe unwrapping)
// ============================================================================

// Unwrap validated string (safe because validation already passed)
@genType
let unwrapString = (s: nonEmptyString<validated>): string => s

// Unwrap validated int (safe because validation already passed)
@genType
let unwrapInt = (n: positiveInt<validated>): int => n

// Unwrap validated email (safe because validation already passed)
@genType
let unwrapEmail = (email: validEmail<validated>): string => email

// ============================================================================
// EXAMPLE USAGE (not exported, for documentation)
// ============================================================================

// Example 1: Validated embedding (BUG #5 prevention)
// let unvalidated = createUnvalidatedEmbedding(
//   ~dimensions=1536,
//   ~vector=[1.0, 2.0, ...],  // 1536 elements
//   ~model="text-embedding-ada-002"
// )
//
// let validated = validateEmbedding(unvalidated, ~expectedDimensions=1536)
// switch validated {
// | Ok(embedding) => storeEmbedding(embedding)  // ✅ Type-safe!
// | Error(err) => Js.log2("Validation failed:", err)
// }
//
// // ❌ This won't compile - must validate first!
// // storeEmbedding(unvalidated)

// Example 2: Validated user (BUG #14 prevention)
// let result = validateUser(
//   ~id="user-123",
//   ~email="john@example.com",
//   ~age=30
// )
//
// switch result {
// | Ok(user) => {
//     // All fields guaranteed to be valid!
//     let email = unwrapEmail(user.email)
//     Js.log2("User email:", email)
//   }
// | Error(errors) => {
//     // Multiple validation errors collected
//     Js.Array.forEach(Js.log, errors)
//   }
// }

// Example 3: Validation pipeline
// let rule1: validationRule<string> = (s) => {
//   if Js.String.length(s) >= 8 {
//     Ok()
//   } else {
//     Error("Password too short")
//   }
// }
//
// let rule2: validationRule<string> = (s) => {
//   if Js.Re.test_(%re("/[A-Z]/"), s) {
//     Ok()
//   } else {
//     Error("Password must contain uppercase letter")
//   }
// }
//
// let result = combineRules("password123", [rule1, rule2])
// switch result {
// | Ok(pwd) => Js.log("Valid password")
// | Error(errors) => Js.Array.forEach(Js.log, errors)
// }
