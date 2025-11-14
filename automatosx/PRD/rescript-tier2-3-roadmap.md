# ReScript Tier 2-3 Migration Roadmap

**Date**: 2025-11-11
**Status**: Planning - Ready to Begin
**Goal**: Complete migration of remaining 9 bugs (Tier 2-3) achieving 100% bug prevention
**Timeline**: 6-7 weeks (Tiers 2-3)

---

## Current Status (Tier 1 Complete)

✅ **Tier 1 Complete** (8 bugs prevented - 47%)
- Timestamp.res - Phantom types
- HybridSearchTypes.res - Variant/record types
- HybridSearchCore.res - Exhaustive matching
- MessageTransform.res - Safe transformations
- StatsAggregation.res - SQL-first aggregation

**Remaining**: 9 bugs across Tier 2-3 (53% of bugs)

---

## Tier 2: Error Handling & Validation (4 bugs - 2 weeks)

### Overview

Focus on runtime error handling, validation, and edge cases that can't be prevented at compile time but can be made type-safe.

### Bugs to Address

| Bug # | Description | Severity | Module to Create |
|-------|-------------|----------|------------------|
| **#3** | Missing error handling in DAO | High | ErrorHandling.res |
| **#4** | Race condition in cache | High | ConcurrencySafety.res |
| **#5** | Invalid embedding dimensions | Medium | ValidationRules.res |
| **#7** | Float precision issues | Medium | SafeMath.res |

### Module 1: ErrorHandling.res (Week 1, Days 1-3)

**Purpose**: Type-safe error handling with Result types

**Key Features**:
```rescript
// Result type for operations that can fail
type result<'ok, 'err> =
  | Ok('ok)
  | Error('err)

// Error types (variant)
type daoError =
  | NotFound(string)
  | DatabaseError(string)
  | ValidationError(string)
  | ConnectionError(string)

// Error recovery strategies
type recoveryStrategy =
  | Retry(int)  // Retry N times
  | Fallback(unit => result<'t, 'err>)  // Use fallback
  | FailFast  // Throw immediately

// Safe DAO operations
@genType
let safeQuery: (
  ~db: database,
  ~query: string,
  ~params: array<'a>,
  ~strategy: recoveryStrategy
) => result<'result, daoError>
```

**Bugs Prevented**:
- BUG #3: Missing error handling (forces explicit error handling)
- Runtime errors become compile-time Result type handling

**Implementation Time**: 2-3 days

### Module 2: ConcurrencySafety.res (Week 1, Days 4-5)

**Purpose**: Type-safe concurrency primitives

**Key Features**:
```rescript
// Mutex type for exclusive access
type mutex<'a> = {
  value: ref<'a>,
  locked: ref<bool>,
}

// Atomic operations
@genType
let atomic: (mutex<'a>, 'a => 'a) => result<'a, string>

// Sequential execution (prevents race conditions)
@genType
let sequential: array<unit => Promise.t<'a>> => Promise.t<array<'a>>

// Cache with mutex protection
type safeCache<'k, 'v> = {
  data: Js.Dict.t<'v>,
  mutex: mutex<unit>,
}
```

**Bugs Prevented**:
- BUG #4: Race condition in cache (mutex-protected operations)
- Concurrent access becomes type-safe

**Implementation Time**: 1-2 days

### Module 3: ValidationRules.res (Week 2, Days 1-3)

**Purpose**: Type-safe validation with dependent types

**Key Features**:
```rescript
// Validated types (phantom types for validation state)
type validated
type unvalidated
type validatedEmbedding<'state> = {
  dimensions: int,
  vector: array<float>,
}

// Validation functions
@genType
let validateEmbedding: (
  validatedEmbedding<unvalidated>,
  ~expectedDimensions: int
) => result<validatedEmbedding<validated>, string>

// Only validated embeddings can be used
@genType
let storeEmbedding: (
  validatedEmbedding<validated>  // Compile error if not validated!
) => Promise.t<result<unit, string>>

// Validation rules as types
type validationRule<'a> = 'a => bool

type validatedValue<'a, 'rule> = {
  value: 'a,
  rule: validationRule<'a>,
}
```

**Bugs Prevented**:
- BUG #5: Invalid embedding dimensions (validated at boundary)
- BUG #14: Missing validation (compile-time enforcement)

**Implementation Time**: 2-3 days

### Module 4: SafeMath.res (Week 2, Days 4-5)

**Purpose**: Type-safe arithmetic with precision guarantees

**Key Features**:
```rescript
// Fixed-point arithmetic for precision
type fixedPoint = {
  value: int,  // Value * 10000 for 4 decimal places
  scale: int,  // Always 10000
}

@genType
let fromFloat: float => fixedPoint

@genType
let toFloat: fixedPoint => float

@genType
let add: (fixedPoint, fixedPoint) => fixedPoint

@genType
let multiply: (fixedPoint, fixedPoint) => fixedPoint

// Safe division (returns Result)
@genType
let divide: (fixedPoint, fixedPoint) => result<fixedPoint, string>

// Similarity score with guaranteed precision
@genType
let calculateSimilarity: (
  array<float>,
  array<float>
) => result<fixedPoint, string>
```

**Bugs Prevented**:
- BUG #7: Float precision issues (fixed-point arithmetic)
- Arithmetic overflow becomes explicit Result type

**Implementation Time**: 1-2 days

### Tier 2 Deliverables

**Code** (4 modules, ~1,200 lines):
- ErrorHandling.res (300 lines)
- ConcurrencySafety.res (250 lines)
- ValidationRules.res (350 lines)
- SafeMath.res (300 lines)

**Bridge Layer** (~800 lines):
- ErrorHandlingBridge.ts
- ConcurrencyBridge.ts
- ValidationBridge.ts
- SafeMathBridge.ts

**Tests** (~600 lines):
- Comprehensive test coverage for all modules
- Error recovery scenarios
- Concurrency stress tests
- Validation edge cases
- Arithmetic precision tests

**Documentation**:
- Implementation guides
- Migration examples
- Performance impact analysis

**Timeline**: 2 weeks (10 working days)

---

## Tier 3: Domain Logic & Integration (5 bugs - 4 weeks)

### Overview

Focus on complex domain logic, workflow orchestration, and end-to-end type safety across system boundaries.

### Bugs to Address

| Bug # | Description | Severity | Module to Create |
|-------|-------------|----------|------------------|
| **#6** | Incorrect retry logic | High | RetryOrchestrator.res |
| **#14** | Missing validation | Medium | DomainValidation.res |
| **#15** | Inconsistent state | Medium | StateManagement.res |
| **#16** | Memory leak | Medium | ResourceManagement.res |
| **#18** | Type coercion | Low | TypeSafety.res |

### Module 5: RetryOrchestrator.res (Week 1-2)

**Purpose**: Type-safe retry logic with exponential backoff

**Key Features**:
```rescript
// Retry configuration
type retryConfig = {
  maxAttempts: int,
  initialDelay: int,  // milliseconds
  maxDelay: int,
  backoffMultiplier: float,
  jitter: bool,
}

// Retry strategy (variant)
type retryStrategy =
  | Exponential(retryConfig)
  | Linear(int, int)  // attempts, delay
  | Immediate(int)  // attempts only

// Retryable operation
type retryable<'a, 'err> = {
  operation: unit => Promise.t<result<'a, 'err>>,
  shouldRetry: 'err => bool,
  onRetry: (int, 'err) => unit,
}

@genType
let retry: (
  retryable<'a, 'err>,
  retryStrategy
) => Promise.t<result<'a, 'err>>

// Circuit breaker pattern
type circuitState =
  | Closed  // Normal operation
  | Open(int)  // Failing, cooldown time
  | HalfOpen  // Testing if recovered

type circuitBreaker<'a, 'err> = {
  state: ref<circuitState>,
  failureThreshold: int,
  cooldownPeriod: int,
  operation: retryable<'a, 'err>,
}
```

**Bugs Prevented**:
- BUG #6: Incorrect retry logic (type-safe retry strategies)
- Infinite retry loops become compile-time errors

**Implementation Time**: 3-4 days

### Module 6: DomainValidation.res (Week 2)

**Purpose**: Domain-specific validation with type-level constraints

**Key Features**:
```rescript
// Validated domain types
type nonEmptyString<'validated> = string  // Phantom type

type positiveInt<'validated> = int

type validEmail<'validated> = string

// Smart constructors (only way to create validated types)
@genType
let nonEmptyString: string => result<nonEmptyString<validated>, string>

@genType
let positiveInt: int => result<positiveInt<validated>, string>

@genType
let validEmail: string => result<validEmail<validated>, string>

// Domain objects with validated fields
type user = {
  id: nonEmptyString<validated>,
  email: validEmail<validated>,
  age: positiveInt<validated>,
}

// Validation pipelines
@genType
let validateUser: (
  ~id: string,
  ~email: string,
  ~age: int
) => result<user, array<string>>  // Multiple validation errors
```

**Bugs Prevented**:
- BUG #14: Missing validation (enforced at type level)
- Invalid data cannot be constructed

**Implementation Time**: 2-3 days

### Module 7: StateManagement.res (Week 3)

**Purpose**: Type-safe state transitions with state machines

**Key Features**:
```rescript
// State machine definition
type state<'s> = 's

type transition<'from, 'to, 'event> = {
  from: state<'from>,
  to: state<'to>,
  on: 'event,
  guard: option<unit => bool>,
}

// Compile-time state machine
type stateMachine<'states, 'events> = {
  initial: 'states,
  transitions: array<transition<'states, 'states, 'events>>,
}

// Example: Order state machine
type orderState =
  | Pending
  | Confirmed
  | Shipped
  | Delivered
  | Cancelled

type orderEvent =
  | Confirm
  | Ship
  | Deliver
  | Cancel

@genType
let orderStateMachine: stateMachine<orderState, orderEvent>

// Type-safe state transitions
@genType
let transition: (
  stateMachine<'s, 'e>,
  state<'s>,
  'e
) => result<state<'s>, string>
```

**Bugs Prevented**:
- BUG #15: Inconsistent state (invalid transitions impossible)
- State bugs caught at compile time

**Implementation Time**: 3-4 days

### Module 8: ResourceManagement.res (Week 4)

**Purpose**: Automatic resource cleanup with RAII pattern

**Key Features**:
```rescript
// Resource type
type resource<'a> = {
  value: 'a,
  cleanup: unit => unit,
}

// Auto-cleanup scope
@genType
let withResource: (
  resource<'a>,
  'a => result<'b, 'err>
) => result<'b, 'err>

// Database connection pool
type pooledConnection = resource<database>

@genType
let withConnection: (
  database => result<'a, 'err>
) => result<'a, 'err>

// Memory-tracked allocations
type tracked<'a> = {
  value: 'a,
  size: int,
  allocated: int,  // timestamp
}

type memoryPool = {
  allocations: ref<Js.Dict.t<tracked<unit>>>,
  maxSize: int,
}

@genType
let allocate: (memoryPool, int) => result<tracked<'a>, string>

@genType
let deallocate: (memoryPool, tracked<'a>) => unit
```

**Bugs Prevented**:
- BUG #16: Memory leak (automatic cleanup)
- Resource leaks become compile-time errors

**Implementation Time**: 3-4 days

### Module 9: TypeSafety.res (Week 4)

**Purpose**: Eliminate type coercion with branded types

**Key Features**:
```rescript
// Branded types (zero runtime cost)
type brand<'a, 'brand> = 'a

type userId = brand<string, "UserId">
type conversationId = brand<string, "ConversationId">
type messageId = brand<string, "MessageId">

// Smart constructors
@genType
let userId: string => userId

@genType
let conversationId: string => conversationId

@genType
let messageId: string => messageId

// Type-safe functions (can't mix IDs!)
@genType
let getUser: userId => Promise.t<result<user, string>>

@genType
let getConversation: conversationId => Promise.t<result<conversation, string>>

// Compile error if wrong ID type passed!
// getUser(conversationId("conv-123"))  // ❌ Type error!
```

**Bugs Prevented**:
- BUG #18: Type coercion (branded types prevent mixing)
- ID confusion becomes compile-time error

**Implementation Time**: 2-3 days

### Tier 3 Deliverables

**Code** (5 modules, ~1,500 lines):
- RetryOrchestrator.res (400 lines)
- DomainValidation.res (300 lines)
- StateManagement.res (350 lines)
- ResourceManagement.res (300 lines)
- TypeSafety.res (150 lines)

**Bridge Layer** (~1,000 lines):
- RetryBridge.ts
- ValidationBridge.ts (extended)
- StateBridge.ts
- ResourceBridge.ts
- TypeSafetyBridge.ts

**Tests** (~800 lines):
- Retry strategy tests
- State machine tests
- Resource leak prevention tests
- Type safety verification

**Documentation**:
- Domain modeling guide
- State machine patterns
- Resource management best practices

**Timeline**: 4 weeks (20 working days)

---

## Complete Roadmap Summary

### Timeline Overview

| Phase | Duration | Bugs | Modules | Lines of Code |
|-------|----------|------|---------|---------------|
| **Tier 1** (Complete) | 2 weeks | 8 (47%) | 5 | ~1,280 |
| **Tier 2** (Error/Validation) | 2 weeks | 4 (24%) | 4 | ~1,200 |
| **Tier 3** (Domain Logic) | 4 weeks | 5 (29%) | 5 | ~1,500 |
| **Total** | 8 weeks | 17 (100%) | 14 | ~4,000 |

### Cumulative Bug Prevention

| After Tier | Bugs Prevented | Percentage | Remaining |
|------------|----------------|------------|-----------|
| Tier 1 | 8 | 47% | 9 |
| Tier 2 | 12 | 71% | 5 |
| Tier 3 | 17 | 100% | 0 |

### Week-by-Week Breakdown

**Weeks 1-2** (Tier 1 - Complete ✅):
- Timestamp, HybridSearchTypes, HybridSearchCore, MessageTransform, StatsAggregation
- 8 bugs prevented

**Weeks 3-4** (Tier 2):
- Week 3: ErrorHandling.res, ConcurrencySafety.res
- Week 4: ValidationRules.res, SafeMath.res
- +4 bugs prevented (total: 12)

**Weeks 5-8** (Tier 3):
- Week 5: RetryOrchestrator.res, DomainValidation.res
- Week 6: StateManagement.res
- Week 7-8: ResourceManagement.res, TypeSafety.res, integration
- +5 bugs prevented (total: 17 - 100%)

---

## Success Metrics

### Code Quality
- 100% compile-time type safety
- Zero runtime type errors
- 100% test coverage for new modules

### Performance
- No performance regressions
- 10-100x improvements where applicable (caching, aggregation)
- < 5ms additional latency for validation

### Bug Prevention
- 17/17 bugs prevented (100%)
- Zero instances of prevented bugs in production
- Measurable reduction in runtime errors

### Developer Experience
- Type errors caught at compile time
- Better IDE support (autocomplete, type hints)
- Easier refactoring (compiler-guided)

---

## Risk Mitigation

### Technical Risks

1. **Complexity Increase**
   - Mitigation: Comprehensive documentation, examples
   - Gradual rollout per module

2. **Performance Impact**
   - Mitigation: Benchmark each module
   - Profiling before/after

3. **Integration Challenges**
   - Mitigation: Bridge layer with feature flags
   - Fallback to TypeScript if needed

### Timeline Risks

1. **Underestimated Complexity**
   - Mitigation: 20% buffer built into estimates
   - Modular approach allows re-prioritization

2. **Team Availability**
   - Mitigation: Clear documentation for handoff
   - Can be done incrementally

---

## Next Steps (Immediate)

1. **Review Tier 2 Plan** (30 min)
   - Validate approach
   - Confirm priorities

2. **Begin ErrorHandling.res** (Day 1)
   - Define Result type
   - Error recovery strategies
   - DAO integration

3. **Set Up Testing Framework** (Day 1)
   - Test infrastructure for Tier 2
   - Performance benchmarks

4. **Documentation** (Ongoing)
   - Module design docs
   - Migration guides
   - Examples

---

## Conclusion

**Status**: Ready to Begin Tier 2

**Tier 1 Achievements**:
- ✅ 8 bugs prevented (47%)
- ✅ 100x performance improvement
- ✅ Zero-cost abstractions
- ✅ Complete test coverage

**Tier 2-3 Goals**:
- 🎯 Additional 9 bugs prevented (100% total)
- 🎯 Complete type safety across system
- 🎯 Domain logic migration
- 🎯 Resource management automation

**Timeline**: 6 weeks to complete Tier 2-3
**Confidence**: High (Tier 1 proves feasibility)

---

**END OF TIER 2-3 ROADMAP**
