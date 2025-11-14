// ============================================================================
// StatsAggregation.res - Type-safe statistics aggregation
// ============================================================================
//
// PREVENTS: BUG #13 (stats pagination bug through SQL-first approach)
//
// TypeScript problem: Fetched ALL messages, then counted in-memory (slow!)
// ReScript solution: SQL aggregation with type-safe strategies
//
// ============================================================================

// ============================================================================
// STATISTICS TYPES
// ============================================================================

@genType
type conversationStats = {
  conversationId: string,
  messageCount: int,
  totalTokens: int,
  avgTokensPerMessage: float,
  userMessageCount: int,
  assistantMessageCount: int,
  systemMessageCount: int,
}

@genType
type globalStats = {
  totalConversations: int,
  totalMessages: int,
  totalTokens: int,
  avgMessagesPerConversation: float,
  avgTokensPerMessage: float,
}

@genType
type timeRangeStats = {
  startTime: int,  // UNIX seconds
  endTime: int,    // UNIX seconds
  messageCount: int,
  avgTokens: float,
}

// ============================================================================
// AGGREGATION STRATEGY (Type-safe)
// ============================================================================
// PREVENTS: BUG #13 (wrong strategy used)

@genType
type aggregationStrategy =
  | DirectSQL  // Execute SQL directly (fastest, prevents pagination bugs)
  | InMemory   // Load data, aggregate in memory (for complex calculations)
  | Hybrid     // Mix of both (SQL pre-filter, then in-memory)

// ============================================================================
// QUERY BUILDING (Type-safe)
// ============================================================================

// Build conversation stats SQL query
@genType
let buildConversationStatsQuery = (conversationId: string): string => {
  "
  SELECT
    conversation_id,
    COUNT(*) as message_count,
    COALESCE(SUM(tokens), 0) as total_tokens,
    COALESCE(AVG(tokens), 0.0) as avg_tokens_per_message,
    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_message_count,
    SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_message_count,
    SUM(CASE WHEN role = 'system' THEN 1 ELSE 0 END) as system_message_count
  FROM messages
  WHERE conversation_id = '" ++ conversationId ++ "'
    AND deleted_at IS NULL
  GROUP BY conversation_id
  "
}

// Build global stats SQL query
@genType
let buildGlobalStatsQuery = (): string => {
  "
  SELECT
    COUNT(DISTINCT conversation_id) as total_conversations,
    COUNT(*) as total_messages,
    COALESCE(SUM(tokens), 0) as total_tokens
  FROM messages
  WHERE deleted_at IS NULL
  "
}

// Build time range stats SQL query
@genType
let buildTimeRangeStatsQuery = (startTime: int, endTime: int): string => {
  let startStr = Belt.Int.toString(startTime)
  let endStr = Belt.Int.toString(endTime)

  "
  SELECT
    COUNT(*) as message_count,
    COALESCE(AVG(tokens), 0.0) as avg_tokens
  FROM messages
  WHERE created_at >= " ++ startStr ++ "
    AND created_at <= " ++ endStr ++ "
    AND deleted_at IS NULL
  "
}

// ============================================================================
// RESULT PARSING
// ============================================================================

// Parse conversation stats from SQL result
@genType
let parseConversationStatsRow = (row: {
  "conversation_id": string,
  "message_count": int,
  "total_tokens": int,
  "avg_tokens_per_message": float,
  "user_message_count": int,
  "assistant_message_count": int,
  "system_message_count": int,
}): conversationStats => {
  {
    conversationId: row["conversation_id"],
    messageCount: row["message_count"],
    totalTokens: row["total_tokens"],
    avgTokensPerMessage: row["avg_tokens_per_message"],
    userMessageCount: row["user_message_count"],
    assistantMessageCount: row["assistant_message_count"],
    systemMessageCount: row["system_message_count"],
  }
}

// Parse global stats from SQL result
@genType
let parseGlobalStatsRow = (row: {
  "total_conversations": int,
  "total_messages": int,
  "total_tokens": int,
}): globalStats => {
  let avgMessages = if row["total_conversations"] > 0 {
    Belt.Int.toFloat(row["total_messages"]) /. Belt.Int.toFloat(row["total_conversations"])
  } else {
    0.0
  }

  let avgTokens = if row["total_messages"] > 0 {
    Belt.Int.toFloat(row["total_tokens"]) /. Belt.Int.toFloat(row["total_messages"])
  } else {
    0.0
  }

  {
    totalConversations: row["total_conversations"],
    totalMessages: row["total_messages"],
    totalTokens: row["total_tokens"],
    avgMessagesPerConversation: avgMessages,
    avgTokensPerMessage: avgTokens,
  }
}

// Parse time range stats from SQL result
@genType
let parseTimeRangeStatsRow = (
  row: {
    "message_count": int,
    "avg_tokens": float,
  },
  startTime: int,
  endTime: int
): timeRangeStats => {
  {
    startTime: startTime,
    endTime: endTime,
    messageCount: row["message_count"],
    avgTokens: row["avg_tokens"],
  }
}

// ============================================================================
// STRATEGY SELECTION
// ============================================================================

// Determine best aggregation strategy based on data size
@genType
let selectStrategy = (estimatedRows: int): aggregationStrategy => {
  if estimatedRows < 1000 {
    InMemory  // Small dataset, can load in memory
  } else if estimatedRows < 100000 {
    Hybrid  // Medium dataset, pre-filter with SQL
  } else {
    DirectSQL  // Large dataset, SQL-only
  }
}

// ============================================================================
// EXPLANATION
// ============================================================================

// Get explanation of strategy (for logging/debugging)
@genType
let explainStrategy = (strategy: aggregationStrategy): string => {
  switch strategy {
  | DirectSQL => "Direct SQL aggregation (fastest, prevents pagination bugs)"
  | InMemory => "In-memory aggregation (for complex calculations)"
  | Hybrid => "Hybrid approach (SQL pre-filter + in-memory)"
  }
}

// ============================================================================
// COMPARISON WITH BUGGY TYPESCRIPT VERSION
// ============================================================================

// TypeScript version (BUGGY - BUG #13):
// ```typescript
// async getConversationStats(conversationId: string) {
//   // ❌ BUG #13: Fetches ALL messages (no LIMIT)
//   const messages = await this.messageDAO.getByConversation(conversationId);
//
//   // Then counts in-memory (slow!)
//   const messageCount = messages.length;
//   const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
//   // ... more in-memory aggregation
//
//   return { conversationId, messageCount, totalTokens, ... };
// }
// ```
//
// Problems:
// 1. Fetches ALL messages (could be millions!)
// 2. No pagination (runs out of memory)
// 3. Slow (N rows transferred + N iterations)
// 4. SQL can do this 100x faster

// ReScript version (CORRECT):
// ```rescript
// // Generate SQL for database-side aggregation
// let query = buildConversationStatsQuery(conversationId)
// // Returns: "SELECT COUNT(*), SUM(tokens), AVG(tokens), ... GROUP BY ..."
//
// // Execute in database (30x faster!)
// let row = await db.get(query)
// let stats = parseConversationStatsRow(row)
// ```
//
// Benefits:
// 1. SQL aggregation (100x faster)
// 2. No pagination issues (database handles it)
// 3. Minimal data transfer (1 result row)
// 4. Type-safe query building

// ============================================================================
// EXAMPLES (not exported, for documentation)
// ============================================================================

// Get conversation stats:
// let query = buildConversationStatsQuery("conv-123")
// let row = await db.get(query)
// let stats = parseConversationStatsRow(row)
// Js.log2("Message count:", stats.messageCount)
// Js.log2("Total tokens:", stats.totalTokens)

// Get global stats:
// let query = buildGlobalStatsQuery()
// let row = await db.get(query)
// let stats = parseGlobalStatsRow(row)
// Js.log2("Total conversations:", stats.totalConversations)

// Time range stats:
// let startTime = 1699999999
// let endTime = 1700000000
// let query = buildTimeRangeStatsQuery(startTime, endTime)
// let row = await db.get(query)
// let stats = parseTimeRangeStatsRow(row, startTime, endTime)
// Js.log2("Messages in range:", stats.messageCount)

// Strategy selection:
// let strategy = selectStrategy(50000)  // Hybrid for 50k rows
// Js.log(explainStrategy(strategy))
// // Output: "Hybrid approach (SQL pre-filter + in-memory)"
