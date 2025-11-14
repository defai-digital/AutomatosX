// ============================================================================
// Timestamp.res - Type-safe timestamps with phantom types
// ============================================================================
//
// PREVENTS: BUG #2, BUG #17 (timestamp unit confusion)
//
// Problem: TypeScript allows mixing milliseconds and seconds
//   const ms = Date.now();  // milliseconds
//   const sec = Math.floor(Date.now() / 1000);  // seconds
//   db.insert(ms);  // ❌ Wrong unit, but compiles!
//
// Solution: Phantom types make units part of the type system
//   let ms: t<milliseconds> = nowMilliseconds()
//   let sec: t<seconds> = nowSeconds()
//   db.insert(ms)  // ❌ COMPILE ERROR! Type mismatch
//   db.insert(toDbInt(sec))  // ✓ OK, explicitly seconds
//
// Zero-cost abstraction: Types only exist at compile time, no runtime overhead
// ============================================================================

// Phantom type tags for compile-time unit checking
type milliseconds
type seconds

// Timestamp type parameterized by unit
// The unit is ONLY in the type, not runtime value (zero-cost abstraction)
type t<'unit> = int

// ============================================================================
// CONSTRUCTORS - Only way to create timestamps
// ============================================================================

@genType
let fromMilliseconds = (ms: int): t<milliseconds> => ms

@genType
let fromSeconds = (sec: int): t<seconds> => sec

// ============================================================================
// CURRENT TIME - Type-safe "now" functions
// ============================================================================

@genType
let nowMilliseconds = (): t<milliseconds> => {
  Js.Date.now()->Belt.Float.toInt->fromMilliseconds
}

@genType
let nowSeconds = (): t<seconds> => {
  (Js.Date.now()->Belt.Float.toInt / 1000)->fromSeconds
}

// ============================================================================
// CONVERSIONS - Explicit only
// ============================================================================

@genType
let millisecondsToSeconds = (ms: t<milliseconds>): t<seconds> => {
  (ms / 1000)->fromSeconds
}

@genType
let secondsToMilliseconds = (sec: t<seconds>): t<milliseconds> => {
  (sec * 1000)->fromMilliseconds
}

// ============================================================================
// COMPARISONS - Type-safe, only within same unit
// ============================================================================

@genType
let compareSeconds = (a: t<seconds>, b: t<seconds>): int => {
  compare(a, b)
}

@genType
let compareMilliseconds = (a: t<milliseconds>, b: t<milliseconds>): int => {
  compare(a, b)
}

// ============================================================================
// ARITHMETIC - Type-safe operations
// ============================================================================

module Seconds = {
  @genType
  let add = (a: t<seconds>, b: t<seconds>): t<seconds> => {
    (a + b)->fromSeconds
  }

  @genType
  let subtract = (a: t<seconds>, b: t<seconds>): t<seconds> => {
    (a - b)->fromSeconds
  }

  @genType
  let toInt = (ts: t<seconds>): int => ts

  @genType
  let fromInt = (i: int): t<seconds> => fromSeconds(i)
}

module Milliseconds = {
  @genType
  let add = (a: t<milliseconds>, b: t<milliseconds>): t<milliseconds> => {
    (a + b)->fromMilliseconds
  }

  @genType
  let subtract = (a: t<milliseconds>, b: t<milliseconds>): t<milliseconds> => {
    (a - b)->fromMilliseconds
  }

  @genType
  let toInt = (ts: t<milliseconds>): int => ts

  @genType
  let fromInt = (i: int): t<milliseconds> => fromMilliseconds(i)
}

// ============================================================================
// DATABASE INTEROP - Always use seconds for storage
// ============================================================================

@genType
let toDbInt = (ts: t<seconds>): int => Seconds.toInt(ts)

@genType
let fromDbInt = (i: int): t<seconds> => Seconds.fromInt(i)

// ============================================================================
// JAVASCRIPT INTEROP - For TypeScript integration
// ============================================================================

@genType
let toJsDate = (ts: t<seconds>): Js.Date.t => {
  let ms = secondsToMilliseconds(ts)->Milliseconds.toInt->Belt.Int.toFloat
  Js.Date.fromFloat(ms)
}

@genType
let fromJsDate = (date: Js.Date.t): t<seconds> => {
  let ms = Js.Date.getTime(date)->Belt.Float.toInt->Milliseconds.fromInt
  millisecondsToSeconds(ms)
}

// ============================================================================
// VALIDATION - Check if timestamp is in valid range
// ============================================================================

@genType
let isValidSeconds = (ts: t<seconds>): bool => {
  let value = Seconds.toInt(ts)
  // Valid range: 2000-01-01 to 2100-01-01
  value >= 946_684_800 && value <= 4_102_444_800
}

@genType
let isValidMilliseconds = (ts: t<milliseconds>): bool => {
  let value = Milliseconds.toInt(ts)
  // Valid range: 2000-01-01 to 2100-01-01
  value >= 946_684_800_000 && value <= 4_102_444_800_000
}

// ============================================================================
// FORMATTING - Human-readable strings
// ============================================================================

@genType
let toIsoString = (ts: t<seconds>): string => {
  toJsDate(ts)->Js.Date.toISOString
}

// ============================================================================
// EXAMPLES (not exported, for documentation)
// ============================================================================

// Create timestamps with correct units
// let created: t<seconds> = nowSeconds()
// let updated: t<seconds> = nowSeconds()

// Arithmetic with same units
// let age = Seconds.subtract(updated, created)

// Store in database (always seconds)
// let dbValue: int = toDbInt(created)

// Load from database
// let loaded: t<seconds> = fromDbInt(dbValue)

// COMPILE ERROR: Can't mix units
// let wrong: t<milliseconds> = nowSeconds()  // ❌ Type error!

// Must explicitly convert
// let rightMs = secondsToMilliseconds(nowSeconds())  // ✓ OK
