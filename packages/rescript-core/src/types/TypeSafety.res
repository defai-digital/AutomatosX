// ============================================================================
// TypeSafety.res - Branded types and type-safe wrappers to prevent ID confusion
// ============================================================================
//
// PREVENTS: BUG #17 (Passing userId where conversationId expected)
//
// TypeScript problem: All IDs are strings, easy to mix up parameters
// ReScript solution: Branded types make IDs incompatible at compile time
//
// ============================================================================

// Import ErrorHandling for Result types
open ErrorHandling

// ============================================================================
// BRANDED ID TYPES (Compile-time type safety)
// ============================================================================

// Note: These types are structurally identical to strings at runtime,
// but the ReScript compiler treats them as distinct types!

// User ID brand
@genType
type userId = UserId(string)

// Conversation ID brand
@genType
type conversationId = ConversationId(string)

// Message ID brand
@genType
type messageId = MessageId(string)

// Model ID brand
@genType
type modelId = ModelId(string)

// Session ID brand
@genType
type sessionId = SessionId(string)

// Token ID brand
@genType
type tokenId = TokenId(string)

// ============================================================================
// SMART CONSTRUCTORS (Validated creation)
// ============================================================================

// Create user ID with validation
@genType
let makeUserId = (id: string): result<userId, string> => {
  if Js.String.length(id) == 0 {
    Error("User ID cannot be empty")
  } else if !Js.String.startsWith("user-", id) {
    Error(`User ID must start with 'user-': ${id}`)
  } else {
    Ok(UserId(id))
  }
}

// Create conversation ID with validation
@genType
let makeConversationId = (id: string): result<conversationId, string> => {
  if Js.String.length(id) == 0 {
    Error("Conversation ID cannot be empty")
  } else if !Js.String.startsWith("conv-", id) {
    Error(`Conversation ID must start with 'conv-': ${id}`)
  } else {
    Ok(ConversationId(id))
  }
}

// Create message ID with validation
@genType
let makeMessageId = (id: string): result<messageId, string> => {
  if Js.String.length(id) == 0 {
    Error("Message ID cannot be empty")
  } else if !Js.String.startsWith("msg-", id) {
    Error(`Message ID must start with 'msg-': ${id}`)
  } else {
    Ok(MessageId(id))
  }
}

// Create model ID with validation
@genType
let makeModelId = (id: string): result<modelId, string> => {
  if Js.String.length(id) == 0 {
    Error("Model ID cannot be empty")
  } else {
    Ok(ModelId(id))
  }
}

// Create session ID with validation
@genType
let makeSessionId = (id: string): result<sessionId, string> => {
  if Js.String.length(id) == 0 {
    Error("Session ID cannot be empty")
  } else {
    Ok(SessionId(id))
  }
}

// Create token ID with validation
@genType
let makeTokenId = (id: string): result<tokenId, string> => {
  if Js.String.length(id) == 0 {
    Error("Token ID cannot be empty")
  } else {
    Ok(TokenId(id))
  }
}

// ============================================================================
// UNSAFE CONSTRUCTORS (Use only when already validated)
// ============================================================================

// Create user ID without validation (UNSAFE!)
@genType
let unsafeUserId = (id: string): userId => UserId(id)

@genType
let unsafeConversationId = (id: string): conversationId => ConversationId(id)

@genType
let unsafeMessageId = (id: string): messageId => MessageId(id)

@genType
let unsafeModelId = (id: string): modelId => ModelId(id)

@genType
let unsafeSessionId = (id: string): sessionId => SessionId(id)

@genType
let unsafeTokenId = (id: string): tokenId => TokenId(id)

// ============================================================================
// ID UNWRAPPING (Extract string value)
// ============================================================================

// Extract string from userId
@genType
let unwrapUserId = (UserId(id): userId): string => id

@genType
let unwrapConversationId = (ConversationId(id): conversationId): string => id

@genType
let unwrapMessageId = (MessageId(id): messageId): string => id

@genType
let unwrapModelId = (ModelId(id): modelId): string => id

@genType
let unwrapSessionId = (SessionId(id): sessionId): string => id

@genType
let unwrapTokenId = (TokenId(id): tokenId): string => id

// ============================================================================
// ID COMPARISON (Type-safe equality)
// ============================================================================

// Compare user IDs
@genType
let eqUserId = (a: userId, b: userId): bool => {
  unwrapUserId(a) == unwrapUserId(b)
}

@genType
let eqConversationId = (a: conversationId, b: conversationId): bool => {
  unwrapConversationId(a) == unwrapConversationId(b)
}

@genType
let eqMessageId = (a: messageId, b: messageId): bool => {
  unwrapMessageId(a) == unwrapMessageId(b)
}

@genType
let eqModelId = (a: modelId, b: modelId): bool => {
  unwrapModelId(a) == unwrapModelId(b)
}

@genType
let eqSessionId = (a: sessionId, b: sessionId): bool => {
  unwrapSessionId(a) == unwrapSessionId(b)
}

@genType
let eqTokenId = (a: tokenId, b: tokenId): bool => {
  unwrapTokenId(a) == unwrapTokenId(b)
}

// ============================================================================
// BRANDED NUMERIC TYPES (Prevent mixing different numeric types)
// ============================================================================

// Token count (cannot mix with other numbers)
@genType
type tokenCount = TokenCount(int)

// Create token count
@genType
let makeTokenCount = (count: int): result<tokenCount, string> => {
  if count < 0 {
    Error(`Token count must be non-negative, got ${Belt.Int.toString(count)}`)
  } else {
    Ok(TokenCount(count))
  }
}

@genType
let unwrapTokenCount = (TokenCount(count): tokenCount): int => count

// Timestamp (milliseconds since epoch)
@genType
type timestamp = Timestamp(int)

@genType
let makeTimestamp = (ms: int): result<timestamp, string> => {
  if ms < 0 {
    Error(`Timestamp cannot be negative: ${Belt.Int.toString(ms)}`)
  } else {
    Ok(Timestamp(ms))
  }
}

@genType
let unwrapTimestamp = (Timestamp(ms): timestamp): int => ms

// Get current timestamp
@genType
let now = (): timestamp => {
  Timestamp(Js.Date.now()->Belt.Float.toInt)
}

// Price (in cents to avoid floating point errors)
@genType
type price = Price(int)

@genType
let makePrice = (cents: int): result<price, string> => {
  if cents < 0 {
    Error(`Price cannot be negative: ${Belt.Int.toString(cents)}`)
  } else {
    Ok(Price(cents))
  }
}

@genType
let unwrapPrice = (Price(cents): price): int => cents

// Convert dollars to price (in cents)
@genType
let dollarsToPrice = (dollars: float): price => {
  Price(Belt.Float.toInt(dollars *. 100.0))
}

// Convert price to dollars
@genType
let priceToDollars = (price: price): float => {
  Belt.Int.toFloat(unwrapPrice(price)) /. 100.0
}

// ============================================================================
// BRANDED EMAIL TYPE (Type-safe email addresses)
// ============================================================================

@genType
type email = Email(string)

// Simple email validation
@genType
let makeEmail = (address: string): result<email, string> => {
  if Js.String.length(address) == 0 {
    Error("Email cannot be empty")
  } else if !Js.String.includes("@", address) {
    Error(`Invalid email format: ${address}`)
  } else {
    Ok(Email(address))
  }
}

@genType
let unwrapEmail = (Email(address): email): string => address

// ============================================================================
// BRANDED PHONE NUMBER TYPE (Type-safe phone numbers)
// ============================================================================

@genType
type phoneNumber = PhoneNumber(string)

// Phone number validation (E.164 format: + followed by 10-15 digits)
@genType
let makePhoneNumber = (phone: string): result<phoneNumber, string> => {
  if Js.String.length(phone) == 0 {
    Error("Phone number cannot be empty")
  } else {
    // Regex: optional +, digit 1-9, followed by 9-14 more digits (10-15 total)
    let phoneRegex = %re("/^\+?[1-9]\d{9,14}$/")
    if Js.Re.test_(phoneRegex, phone) {
      Ok(PhoneNumber(phone))
    } else {
      Error(`Invalid phone number format: ${phone}`)
    }
  }
}

@genType
let unwrapPhoneNumber = (PhoneNumber(phone): phoneNumber): string => phone

// ============================================================================
// BRANDED URL TYPE (Type-safe URLs)
// ============================================================================

@genType
type url = Url(string)

// Simple URL validation
@genType
let makeUrl = (address: string): result<url, string> => {
  if Js.String.length(address) == 0 {
    Error("URL cannot be empty")
  } else if !Js.String.startsWith("http://", address) && !Js.String.startsWith("https://", address) {
    Error(`Invalid URL format (must start with http:// or https://): ${address}`)
  } else {
    Ok(Url(address))
  }
}

@genType
let unwrapUrl = (Url(address): url): string => address

// ============================================================================
// BRANDED COLLECTIONS (Type-safe arrays and maps)
// ============================================================================

// Non-empty array (guarantees at least one element)
@genType
type nonEmptyArray<'a> = NonEmptyArray(array<'a>)

@genType
let makeNonEmptyArray = (arr: array<'a>): result<nonEmptyArray<'a>, string> => {
  if Belt.Array.length(arr) == 0 {
    Error("Array cannot be empty")
  } else {
    Ok(NonEmptyArray(arr))
  }
}

@genType
let unwrapNonEmptyArray = (NonEmptyArray(arr): nonEmptyArray<'a>): array<'a> => arr

// Get first element (safe because array is non-empty)
@genType
let headNonEmpty = (arr: nonEmptyArray<'a>): 'a => {
  let NonEmptyArray(inner) = arr
  // This is safe because we know array is non-empty
  switch Belt.Array.get(inner, 0) {
  | Some(value) => value
  | None => Js.Exn.raiseError("Impossible: non-empty array is empty")
  }
}

// ============================================================================
// DEMONSTRATION: Why This Prevents BUG #17
// ============================================================================

// TypeScript version (BUGGY):
// ```typescript
// function getMessage(userId: string, conversationId: string): Message {
//   // ...
// }
//
// const uid = "user-123";
// const cid = "conv-456";
//
// // ❌ BUG #17: Parameters swapped! TypeScript can't catch this!
// const msg = getMessage(cid, uid);
// ```

// ReScript version (CORRECT):
// ```rescript
// let getMessage = (userId: userId, convId: conversationId): message => {
//   // ...
// }
//
// let uid = unsafeUserId("user-123")
// let cid = unsafeConversationId("conv-456")
//
// // ✅ Type error! Compiler catches the swap!
// let msg = getMessage(cid, uid)  // ERROR: Expected userId, got conversationId
//
// // ✅ Correct usage
// let msg = getMessage(uid, cid)  // OK
// ```

// ============================================================================
// TYPE-SAFE API EXAMPLES
// ============================================================================

// Example function: Get user's conversations (type-safe!)
@genType
let getUserConversations = (uid: userId): array<conversationId> => {
  // Implementation would query database
  // Return type is array<conversationId>, not array<string>
  []
}

// Example function: Get messages in conversation (type-safe!)
@genType
let getConversationMessages = (convId: conversationId): array<messageId> => {
  // Implementation would query database
  []
}

// Example: Can't mix up parameters!
// let uid = unsafeUserId("user-123")
// let cid = unsafeConversationId("conv-456")
//
// getUserConversations(cid)  // ❌ Compile error! Expected userId, got conversationId
// getConversationMessages(uid)  // ❌ Compile error! Expected conversationId, got userId
//
// getUserConversations(uid)  // ✅ OK
// getConversationMessages(cid)  // ✅ OK

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Convert ID to string for logging/display
@genType
let userIdToString = (id: userId): string => {
  "UserId(" ++ unwrapUserId(id) ++ ")"
}

@genType
let conversationIdToString = (id: conversationId): string => {
  "ConversationId(" ++ unwrapConversationId(id) ++ ")"
}

@genType
let messageIdToString = (id: messageId): string => {
  "MessageId(" ++ unwrapMessageId(id) ++ ")"
}

// ============================================================================
// EXAMPLES (not exported, for documentation)
// ============================================================================

// Example 1: Type-safe user operations (BUG #17 prevention)
// type user = {
//   id: userId,
//   name: string,
//   email: email,
// }
//
// type conversation = {
//   id: conversationId,
//   ownerId: userId,
//   title: string,
// }
//
// let getUserById = (id: userId): option<user> => {
//   // Fetch user
//   None
// }
//
// let getConversationById = (id: conversationId): option<conversation> => {
//   // Fetch conversation
//   None
// }
//
// // ✅ Type-safe! Can't mix up IDs
// let uid = unsafeUserId("user-123")
// let cid = unsafeConversationId("conv-456")
//
// getUserById(uid)  // ✅ OK
// getConversationById(cid)  // ✅ OK
//
// getUserById(cid)  // ❌ Compile error!
// getConversationById(uid)  // ❌ Compile error!

// Example 2: Type-safe price calculations
// let basePrice = makePrice(1000)->Belt.Result.getExn  // $10.00
// let taxRate = 0.08
// let tax = makePrice(Belt.Float.toInt(1000.0 *. taxRate))->Belt.Result.getExn  // $0.80
//
// // Can't accidentally use raw integers as prices
// let total = unwrapPrice(basePrice) + unwrapPrice(tax)
// let totalPrice = Price(total)  // $10.80
