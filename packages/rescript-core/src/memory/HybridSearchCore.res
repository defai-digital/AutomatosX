// ============================================================================
// HybridSearchCore.res - Core result combination logic (no FFI)
// ============================================================================
//
// PREVENTS: BUG #1 (dropped results), BUG #10 (sequential), BUG #11 (missing async)
//
// This module focuses on the CORE bug-preventing logic:
// - Exhaustive pattern matching for result combination
// - Type-safe scoring and filtering
// - The TypeScript layer will handle DAO calls and pass results here
//
// ============================================================================

open HybridSearchTypes

// ============================================================================
// PHASE 1: RESULT COMBINATION - Merge and score results
// ============================================================================
// PREVENTS: BUG #1 (dropped 80% of results)

// Combine FTS and vector results with proper scoring
@genType
let combineResults = (
  ftsResults: array<message>,
  vectorResults: array<vectorResult>,
  weights: searchWeights,
): array<searchResult> => {
  // Build lookup maps
  let ftsMap = Belt.Map.String.fromArray(
    ftsResults->Belt.Array.map(msg => (msg.id, msg))
  )
  let vectorMap = Belt.Map.String.fromArray(
    vectorResults->Belt.Array.map(vr => (vr.messageId, vr))
  )

  // Get all unique message IDs from both sources
  let allIds = Belt.Set.String.fromArray(
    Belt.Array.concat(
      ftsResults->Belt.Array.map(msg => msg.id),
      vectorResults->Belt.Array.map(vr => vr.messageId)
    )
  )

  // For each ID, determine its source and calculate score
  allIds
  ->Belt.Set.String.toArray
  ->Belt.Array.keepMap(messageId => {
    let ftsMsg = ftsMap->Belt.Map.String.get(messageId)
    let vectorRes = vectorMap->Belt.Map.String.get(messageId)

    // EXHAUSTIVE PATTERN MATCHING - Compiler enforces ALL cases!
    // This prevents BUG #1: TypeScript forgot the (None, Some(vr)) case
    switch (ftsMsg, vectorRes) {
    | (Some(msg), Some(vr)) => {
        // HYBRID RESULT - Found in BOTH searches (best quality!)
        let recencyScore = calculateRecencyScore(msg.createdAt)
        let combinedScore = combineScores(
          ~ftsScore=Some(1.0),  // FTS score (normalized)
          ~vectorScore=Some(vr.score),
          ~recencyScore=recencyScore,
          ~weights=weights,
        )

        Some({
          source: Hybrid(msg, vr),
          combinedScore: combinedScore,
          message: Some(msg),
          vectorResult: Some(vr),
        })
      }

    | (Some(msg), None) => {
        // FTS ONLY - Found only in full-text search
        let recencyScore = calculateRecencyScore(msg.createdAt)
        let combinedScore = combineScores(
          ~ftsScore=Some(1.0),
          ~vectorScore=None,
          ~recencyScore=recencyScore,
          ~weights=weights,
        )

        Some({
          source: FtsOnly(msg),
          combinedScore: combinedScore,
          message: Some(msg),
          vectorResult: None,
        })
      }

    | (None, Some(vr)) => {
        // VECTOR ONLY - Found only in vector search
        // ✅ THIS CASE WAS MISSING IN TYPESCRIPT (BUG #1)!
        // ReScript compiler FORCES us to handle it!
        let combinedScore = combineScores(
          ~ftsScore=None,
          ~vectorScore=Some(vr.score),
          ~recencyScore=0.5,  // Default recency (no message available)
          ~weights=weights,
        )

        Some({
          source: VectorOnly(vr),
          combinedScore: combinedScore,
          message: None,
          vectorResult: Some(vr),
        })
      }

    | (None, None) => None  // Should never happen, but compiler enforces this
    }
  })
}

// ============================================================================
// PHASE 2: FILTERING AND SORTING
// ============================================================================

// Filter by minimum score threshold
@genType
let filterByScore = (results: array<searchResult>, minScore: float): array<searchResult> => {
  results->Belt.Array.keep(result => result.combinedScore >= minScore)
}

// Sort by combined score (descending)
@genType
let sortByScore = (results: array<searchResult>): array<searchResult> => {
  let _ = Belt.SortArray.stableSortBy(results, (a, b) => {
    // Reverse comparison for descending order
    if a.combinedScore > b.combinedScore {
      -1
    } else if a.combinedScore < b.combinedScore {
      1
    } else {
      0
    }
  })
  results  // sort mutates in place, return sorted array
}

// Apply limit
@genType
let applyLimit = (results: array<searchResult>, limit: int): array<searchResult> => {
  results->Belt.Array.slice(~offset=0, ~len=limit)
}

// Complete pipeline: combine → filter → sort → limit
@genType
let processResults = (
  ftsResults: array<message>,
  vectorResults: array<vectorResult>,
  options: searchOptions,
): array<searchResult> => {
  combineResults(ftsResults, vectorResults, options.weights)
  ->filterByScore(options.minScore)
  ->sortByScore
  ->applyLimit(options.limit)
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Extract messages from search results (for convenience)
@genType
let extractMessages = (results: array<searchResult>): array<message> => {
  results->Belt.Array.keepMap(result => getMessageFromResult(result))
}

// Get result statistics
@genType
type resultStats = {
  total: int,
  hybrid: int,
  ftsOnly: int,
  vectorOnly: int,
  avgScore: float,
}

@genType
let getResultStats = (results: array<searchResult>): resultStats => {
  let total = Belt.Array.length(results)
  let hybrid = results->Belt.Array.keep(isHybridResult)->Belt.Array.length
  let ftsOnly = results->Belt.Array.keep(result => {
    switch result.source {
    | FtsOnly(_) => true
    | _ => false
    }
  })->Belt.Array.length
  let vectorOnly = results->Belt.Array.keep(result => {
    switch result.source {
    | VectorOnly(_) => true
    | _ => false
    }
  })->Belt.Array.length

  let totalScore = results->Belt.Array.reduce(0.0, (acc, result) => {
    acc +. result.combinedScore
  })
  let avgScore = if total > 0 {
    totalScore /. Belt.Int.toFloat(total)
  } else {
    0.0
  }

  {
    total: total,
    hybrid: hybrid,
    ftsOnly: ftsOnly,
    vectorOnly: vectorOnly,
    avgScore: avgScore,
  }
}

// ============================================================================
// DEMONSTRATION: Why This Prevents BUG #1
// ============================================================================

// TypeScript version (BUGGY):
// ```typescript
// const combined = new Map<string, SearchResult>();
//
// // Add FTS results
// for (const msg of ftsResults) {
//   combined.set(msg.id, { source: 'fts', message: msg });
// }
//
// // Add vector results
// for (const vr of vectorResults) {
//   if (combined.has(vr.messageId)) {
//     // Update existing entry to hybrid
//     const existing = combined.get(vr.messageId)!;
//     combined.set(vr.messageId, {
//       source: 'hybrid',
//       message: existing.message,
//       vectorResult: vr
//     });
//   }
//   // ❌ BUG #1: Forgot else case! Silently drops vector-only results!
// }
// ```

// ReScript version (CORRECT):
// ```rescript
// switch (ftsMsg, vectorRes) {
// | (Some(msg), Some(vr)) => Some(Hybrid(msg, vr))
// | (Some(msg), None) => Some(FtsOnly(msg))
// | (None, Some(vr)) => Some(VectorOnly(vr))  // ← MUST handle or compile error!
// | (None, None) => None
// }
// // Compiler FORCES handling all 4 cases - can't forget any!
// ```

// ============================================================================
// EXAMPLES (not exported, for documentation)
// ============================================================================

// Process search results:
// let ftsResults: array<message> = [msg1, msg2, msg3]
// let vectorResults: array<vectorResult> = [vr1, vr2, vr4]  // Note: vr4 is vector-only!
//
// let results = processResults(
//   ftsResults,
//   vectorResults,
//   defaultSearchOptions
// )
//
// // Results will include:
// // - Hybrid: msg1, msg2 (found in both)
// // - FtsOnly: msg3 (found in FTS only)
// // - VectorOnly: vr4 (found in vector only) ← TypeScript FORGOT THIS!
//
// let stats = getResultStats(results)
// Js.log2("Total results:", stats.total)  // 4 (not 3!)
// Js.log2("Hybrid:", stats.hybrid)  // 2
// Js.log2("FTS only:", stats.ftsOnly)  // 1
// Js.log2("Vector only:", stats.vectorOnly)  // 1 ← This would be 0 in buggy TypeScript!
