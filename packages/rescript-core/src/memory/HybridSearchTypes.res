// ============================================================================
// HybridSearchTypes.res - Type-safe message and search result types
// ============================================================================
//
// PREVENTS: BUG #8 (missing fields), BUG #9 (null vs undefined), BUG #12 (role type)
//
// Problem: TypeScript allows:
//   - Missing fields in objects (with type assertions)
//   - null | undefined confusion
//   - String role values ("user" typos as "usr")
//
// Solution: ReScript enforces:
//   - All record fields must be present
//   - option<T> for optional values (no null/undefined)
//   - Variant types for enums (compile-time check)
//
// ============================================================================

// Import Timestamp module for type-safe timestamps
open Timestamp

// ============================================================================
// MESSAGE ROLE - Variant type prevents typos and invalid values
// ============================================================================
// PREVENTS: BUG #12 (role field type mismatch)
//
// TypeScript problem:
//   type MessageRole = "user" | "assistant" | "system"
//   const role = "usr"  // ❌ Typo! But might compile with type assertion
//
// ReScript solution:
//   Variant type - compiler enforces valid values

@genType
type messageRole =
  | @as("user") User
  | @as("assistant") Assistant
  | @as("system") System

// Parse string to messageRole (with validation)
@genType
let parseMessageRole = (str: string): option<messageRole> => {
  switch str {
  | "user" => Some(User)
  | "assistant" => Some(Assistant)
  | "system" => Some(System)
  | _ => None  // Invalid role → None
  }
}

// Convert messageRole to string
@genType
let messageRoleToString = (role: messageRole): string => {
  switch role {
  | User => "user"
  | Assistant => "assistant"
  | System => "system"
  }
}

// ============================================================================
// MESSAGE TYPE - Complete record with all required fields
// ============================================================================
// PREVENTS: BUG #8 (missing metadata field)
//
// TypeScript problem:
//   return {
//     id: row.id,
//     role: row.role,
//     content: row.content,
//     // ❌ Forgot metadata!
//   } as Message;  // Type assertion bypasses check
//
// ReScript solution:
//   Record type - compiler enforces ALL fields present

@genType
type message = {
  id: string,
  conversationId: string,
  role: messageRole,
  content: string,
  tokens: option<int>,  // option<T> instead of number | null | undefined
  metadata: option<Js.Json.t>,  // option<T> instead of any | null | undefined
  createdAt: Timestamp.t<seconds>,  // Type-safe timestamp
  updatedAt: Timestamp.t<seconds>,  // Type-safe timestamp
}

// ============================================================================
// VECTOR RESULT - Embedding search result
// ============================================================================

@genType
type vectorResult = {
  messageId: string,
  distance: float,  // Cosine distance (0.0 = identical, 2.0 = opposite)
  score: float,     // Similarity score (1.0 = identical, 0.0 = unrelated)
}

// ============================================================================
// SEARCH RESULT SOURCE - Tagged union for exhaustive matching
// ============================================================================
// PREVENTS: BUG #1 (dropped 80% of results by forgetting else case)
//
// TypeScript problem:
//   if (message found in FTS) {
//     return message;  // ✓ Handled
//   }
//   // ❌ Forgot else case - silently drops vector-only results!
//
// ReScript solution:
//   Variant type with associated data - compiler forces handling ALL cases

@genType
type searchResultSource =
  | FtsOnly(message)  // Found ONLY in full-text search
  | VectorOnly(vectorResult)  // Found ONLY in vector search
  | Hybrid(message, vectorResult)  // Found in BOTH (best case!)

// ============================================================================
// SEARCH RESULT - Combined result with metadata
// ============================================================================

@genType
type searchResult = {
  source: searchResultSource,  // Which search found this result
  combinedScore: float,  // Weighted combination of FTS + vector scores
  message: option<message>,  // Full message (if available)
  vectorResult: option<vectorResult>,  // Vector result (if available)
}

// Helper: Extract message from search result
@genType
let getMessageFromResult = (result: searchResult): option<message> => {
  switch result.source {
  | FtsOnly(msg) => Some(msg)
  | VectorOnly(_) => None
  | Hybrid(msg, _) => Some(msg)
  }
}

// Helper: Extract vector result from search result
@genType
let getVectorFromResult = (result: searchResult): option<vectorResult> => {
  switch result.source {
  | FtsOnly(_) => None
  | VectorOnly(vr) => Some(vr)
  | Hybrid(_, vr) => Some(vr)
  }
}

// Helper: Check if result has both FTS and vector data
@genType
let isHybridResult = (result: searchResult): bool => {
  switch result.source {
  | Hybrid(_, _) => true
  | _ => false
  }
}

// ============================================================================
// SEARCH OPTIONS - Configuration for hybrid search
// ============================================================================

@genType
type searchWeights = {
  fts: float,      // Weight for FTS score (0.0 - 1.0)
  vector: float,   // Weight for vector score (0.0 - 1.0)
  recency: float,  // Weight for recency (0.0 - 1.0)
}

// Default weights: balanced approach
@genType
let defaultWeights: searchWeights = {
  fts: 0.4,
  vector: 0.4,
  recency: 0.2,
}

@genType
type searchOptions = {
  conversationId: option<string>,  // Filter by conversation
  limit: int,  // Max results
  weights: searchWeights,  // Score weights
  minScore: float,  // Minimum combined score threshold
}

// Default search options
@genType
let defaultSearchOptions: searchOptions = {
  conversationId: None,
  limit: 10,
  weights: defaultWeights,
  minScore: 0.1,
}

// ============================================================================
// SEARCH QUERY - Input to hybrid search
// ============================================================================

@genType
type searchQuery = {
  query: string,  // User's search query
  conversationId: option<string>,  // Optional conversation filter
  options: searchOptions,  // Search configuration
}

// Create search query with defaults
@genType
let makeSearchQuery = (
  ~query: string,
  ~conversationId: option<string>=None,
  ~options: searchOptions=defaultSearchOptions,
  ()
): searchQuery => {
  {
    query: query,
    conversationId: conversationId,
    options: options,
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

// Validate message has required fields
@genType
let isValidMessage = (msg: message): bool => {
  // In ReScript, all fields are guaranteed present by type system
  // This function checks semantic validity (e.g., non-empty ID)
  msg.id != "" && msg.content != ""
}

// Validate search weights sum to ~1.0
@genType
let areWeightsValid = (weights: searchWeights): bool => {
  let sum = weights.fts +. weights.vector +. weights.recency
  sum >= 0.95 && sum <= 1.05  // Allow small floating point error
}

// Normalize weights to sum to 1.0
@genType
let normalizeWeights = (weights: searchWeights): searchWeights => {
  let sum = weights.fts +. weights.vector +. weights.recency
  if sum == 0.0 {
    defaultWeights  // Avoid division by zero
  } else {
    {
      fts: weights.fts /. sum,
      vector: weights.vector /. sum,
      recency: weights.recency /. sum,
    }
  }
}

// ============================================================================
// SCORE CALCULATION HELPERS
// ============================================================================

// Calculate recency score (newer = higher score)
@genType
let calculateRecencyScore = (timestamp: Timestamp.t<seconds>): float => {
  let now = Timestamp.nowSeconds()
  let age = Timestamp.Seconds.subtract(now, timestamp)->Timestamp.Seconds.toInt

  // Decay function: score = e^(-age / halfLife)
  // halfLife = 30 days = 2,592,000 seconds
  let halfLife = 2_592_000
  let decay = Belt.Float.fromInt(-age) /. Belt.Float.fromInt(halfLife)
  Js.Math.exp(decay)
}

// Combine scores with weights
@genType
let combineScores = (
  ~ftsScore: option<float>,
  ~vectorScore: option<float>,
  ~recencyScore: float,
  ~weights: searchWeights,
): float => {
  let fts = Belt.Option.getWithDefault(ftsScore, 0.0)
  let vector = Belt.Option.getWithDefault(vectorScore, 0.0)

  fts *. weights.fts +. vector *. weights.vector +. recencyScore *. weights.recency
}

// ============================================================================
// EXAMPLES (not exported, for documentation)
// ============================================================================

// Create a message with all required fields
// let msg: message = {
//   id: "msg-123",
//   conversationId: "conv-456",
//   role: User,
//   content: "Hello world",
//   tokens: Some(42),
//   metadata: Some(Js.Json.parseExn("{}")),
//   createdAt: Timestamp.nowSeconds(),
//   updatedAt: Timestamp.nowSeconds(),
// }
// // COMPILE ERROR if any field missing!

// Pattern match on search result source
// let handleResult = (result: searchResult) => {
//   switch result.source {
//   | FtsOnly(msg) => Js.log("Found in FTS only")
//   | VectorOnly(vr) => Js.log("Found in vector only")
//   | Hybrid(msg, vr) => Js.log("Found in both!")
//   }
//   // COMPILE ERROR if case missing!
// }

// Safe role parsing
// let role = parseMessageRole("user")  // Some(User)
// let invalid = parseMessageRole("usr")  // None (typo caught!)
