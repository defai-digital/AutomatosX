// ============================================================================
// MessageTransform.res - Type-safe data transformation
// ============================================================================
//
// PREVENTS: BUG #2, #8, #9, #17 (through safe conversions)
//
// This module provides safe transformations between:
// - Database rows → Domain objects
// - Domain objects → Database rows
// - JSON → Typed data
//
// ============================================================================

open HybridSearchTypes
open Timestamp

// ============================================================================
// DATABASE ROW TYPES (from TypeScript DAOs)
// ============================================================================

// Message row from database
type dbMessageRow = {
  "id": string,
  "conversationId": string,
  "role": string,
  "content": string,
  "tokens": Js.Nullable.t<int>,
  "metadata": Js.Nullable.t<Js.Json.t>,
  "createdAt": int,  // Always UNIX seconds from database
  "updatedAt": int,  // Always UNIX seconds from database
}

// Vector result from database
type dbVectorRow = {
  "messageId": string,
  "distance": float,
}

// ============================================================================
// DB ROW → DOMAIN CONVERSION
// ============================================================================
// PREVENTS: BUG #8 (missing fields), BUG #9 (null handling), BUG #2/#17 (timestamps)

// Convert database message row to domain message
@genType
let messageFromDb = (row: dbMessageRow): option<message> => {
  // Validate and parse role
  let roleOpt = parseMessageRole(row["role"])

  switch roleOpt {
  | None => None  // Invalid role → reject the message
  | Some(role) => {
      // Convert to domain message with ALL required fields
      Some({
        id: row["id"],
        conversationId: row["conversationId"],
        role: role,  // Validated variant type
        content: row["content"],
        tokens: row["tokens"]->Js.Nullable.toOption,  // Nullable → option
        metadata: row["metadata"]->Js.Nullable.toOption,  // Nullable → option
        createdAt: Timestamp.Seconds.fromInt(row["createdAt"]),  // Type-safe timestamp
        updatedAt: Timestamp.Seconds.fromInt(row["updatedAt"]),  // Type-safe timestamp
      })
    }
  }
}

// Convert database vector row to domain vectorResult
@genType
let vectorResultFromDb = (row: dbVectorRow): vectorResult => {
  {
    messageId: row["messageId"],
    distance: row["distance"],
    score: 1.0 -. (row["distance"] /. 2.0),  // Convert distance to score
  }
}

// Batch convert message rows
@genType
let messagesFromDb = (rows: array<dbMessageRow>): array<message> => {
  rows->Belt.Array.keepMap(messageFromDb)  // Only keep valid messages
}

// Batch convert vector rows
@genType
let vectorResultsFromDb = (rows: array<dbVectorRow>): array<vectorResult> => {
  rows->Belt.Array.map(vectorResultFromDb)
}

// ============================================================================
// DOMAIN → DB CONVERSION
// ============================================================================
// PREVENTS: BUG #2/#17 (timestamp units)

// Convert domain message to database row
@genType
let messageToDb = (msg: message): dbMessageRow => {
  {
    "id": msg.id,
    "conversationId": msg.conversationId,
    "role": messageRoleToString(msg.role),  // Variant → string
    "content": msg.content,
    "tokens": msg.tokens->Belt.Option.mapWithDefault(
      Js.Nullable.undefined,
      t => Js.Nullable.return(t)
    ),
    "metadata": msg.metadata->Belt.Option.mapWithDefault(
      Js.Nullable.undefined,
      m => Js.Nullable.return(m)
    ),
    "createdAt": Timestamp.toDbInt(msg.createdAt),  // Always UNIX seconds
    "updatedAt": Timestamp.toDbInt(msg.updatedAt),  // Always UNIX seconds
  }
}

// ============================================================================
// JSON PARSING (Safe)
// ============================================================================
// PREVENTS: Runtime errors from malformed JSON

// Parse metadata JSON safely
@genType
let parseMetadata = (jsonStr: string): option<Js.Json.t> => {
  try {
    Some(Js.Json.parseExn(jsonStr))
  } catch {
  | _ => None  // Parse error → None
  }
}

// Stringify metadata safely
@genType
let stringifyMetadata = (json: Js.Json.t): string => {
  Js.Json.stringify(json)
}

// Extract string field from JSON object
@genType
let getStringField = (json: Js.Json.t, field: string): option<string> => {
  switch Js.Json.decodeObject(json) {
  | None => None
  | Some(obj) => {
      switch Js.Dict.get(obj, field) {
      | None => None
      | Some(value) => Js.Json.decodeString(value)
      }
    }
  }
}

// Extract int field from JSON object
@genType
let getIntField = (json: Js.Json.t, field: string): option<int> => {
  switch Js.Json.decodeObject(json) {
  | None => None
  | Some(obj) => {
      switch Js.Dict.get(obj, field) {
      | None => None
      | Some(value) => {
          switch Js.Json.decodeNumber(value) {
          | None => None
          | Some(num) => Some(Belt.Float.toInt(num))
          }
        }
      }
    }
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

// Validate message has required fields
@genType
let validateMessage = (msg: message): bool => {
  // In ReScript, all fields are guaranteed present by type system
  // This function checks semantic validity
  msg.id != "" &&
  msg.conversationId != "" &&
  msg.content != "" &&
  isValidSeconds(msg.createdAt) &&
  isValidSeconds(msg.updatedAt)
}

// Validate message timestamps are in correct order
@genType
let validateTimestamps = (msg: message): bool => {
  let createdSec = Timestamp.Seconds.toInt(msg.createdAt)
  let updatedSec = Timestamp.Seconds.toInt(msg.updatedAt)
  createdSec <= updatedSec  // Created must be before or equal to updated
}

// Complete validation
@genType
let isValidMessage = (msg: message): bool => {
  validateMessage(msg) && validateTimestamps(msg)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Create a new message with current timestamps
@genType
let createMessage = (
  ~id: string,
  ~conversationId: string,
  ~role: messageRole,
  ~content: string,
  ~tokens: option<int>=None,
  ~metadata: option<Js.Json.t>=None,
  ()
): message => {
  let now = Timestamp.nowSeconds()
  {
    id: id,
    conversationId: conversationId,
    role: role,
    content: content,
    tokens: tokens,
    metadata: metadata,
    createdAt: now,
    updatedAt: now,
  }
}

// Update message with new timestamp
@genType
let updateMessage = (
  msg: message,
  ~content: option<string>=None,
  ~tokens: option<int>=None,
  ~metadata: option<Js.Json.t>=None,
  ()
): message => {
  {
    ...msg,
    content: content->Belt.Option.getWithDefault(msg.content),
    tokens: switch tokens {
    | Some(t) => Some(t)
    | None => msg.tokens
    },
    metadata: switch metadata {
    | Some(m) => Some(m)
    | None => msg.metadata
    },
    updatedAt: Timestamp.nowSeconds(),  // Update timestamp
  }
}

// ============================================================================
// EXAMPLES (not exported, for documentation)
// ============================================================================

// Convert from database:
// let dbRow: dbMessageRow = {
//   "id": "msg-123",
//   "conversationId": "conv-456",
//   "role": "user",
//   "content": "Hello",
//   "tokens": Js.Nullable.return(42),
//   "metadata": Js.Nullable.null,
//   "createdAt": 1699999999,  // UNIX seconds
//   "updatedAt": 1699999999,
// }
//
// let msgOpt = messageFromDb(dbRow)
// switch msgOpt {
// | None => Js.log("Invalid message (bad role?)")
// | Some(msg) => Js.log2("Valid message:", msg.id)
// }

// Convert to database:
// let msg = createMessage(
//   ~id="msg-123",
//   ~conversationId="conv-456",
//   ~role=User,
//   ~content="Hello",
//   ()
// )
//
// let dbRow = messageToDb(msg)
// // dbRow.createdAt is guaranteed to be UNIX seconds!

// Safe JSON parsing:
// let metadataStr = "{\"key\":\"value\"}"
// let jsonOpt = parseMetadata(metadataStr)
// switch jsonOpt {
// | None => Js.log("Invalid JSON")
// | Some(json) => {
//     let keyOpt = getStringField(json, "key")
//     switch keyOpt {
//     | None => Js.log("No 'key' field")
//     | Some(value) => Js.log2("key =", value)
//     }
//   }
// }
