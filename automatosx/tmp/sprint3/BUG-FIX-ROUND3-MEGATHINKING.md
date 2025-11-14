# Bug Fix Round 3 - Deep Analysis & Implementation
**Date**: 2025-11-13
**Current**: 40/81 tests passing (49%)
**Target**: 70+/81 tests passing (86%+)

## Executive Summary

After reading PatternDetector.ts and FeatureDetector.ts, I've identified the EXACT root causes of the remaining 41 test failures. The issues are:

1. **FeatureDetector sends queries correctly** - Our mock IS correct!
2. **But FeatureDetector.detectAuthFeatures() on line 104** uses a pipe-separated regex pattern: `'auth|login|signup|password|token|session|jwt'`
3. **ADRGenerator test mocks are COMPLETELY WRONG** - They don't match PatternDetector's actual queries
4. **Confidence thresholds filter out low-confidence results** - Both detectors filter at 0.5 confidence

## Critical Discoveries

### Discovery #1: FeatureDetector Implementation (LINE 104)

```typescript
// FeatureDetector.ts:104
private async detectAuthFeatures(): Promise<DetectedFeature[]> {
  const results = await this.searchCode('auth|login|signup|password|token|session|jwt');
  // ^^^ THIS IS THE ACTUAL QUERY SENT!
```

**OUR MOCK (from Round 1)** - CORRECT!
```typescript
if (query.match(/auth|login|signup|password|token|session|jwt/i)) {
  return Promise.resolve([...]);
}
```

**Why tests still fail**: Confidence calculation on line 140:
```typescript
const confidence = Math.min((authFiles.length / 10) * 0.6 + (endpoints.length / 5) * 0.4, 1);
```

- If authFiles.length = 2, endpoints.length = 2: confidence = (2/10)*0.6 + (2/5)*0.4 = 0.12 + 0.16 = **0.28**
- Threshold is 0.5 → **FILTERED OUT!**

**Solution**: Make mock return more results to push confidence > 0.5

---

### Discovery #2: PatternDetector Queries (COMPLETELY DIFFERENT!)

**ADRGenerator test mocks expect**:
```typescript
if (query.includes('static instance')) {
  return Promise.resolve([singleton results]);
}
```

**PatternDetector ACTUALLY sends** (line 77):
```typescript
const results = await this.searchCode('static instance'); // ✅ MATCHES!
```

**But then FILTERS results** (lines 78-82):
```typescript
const singletons = results.filter((r) =>
  r.content.includes('getInstance') ||
  r.content.includes('static instance') ||
  r.content.includes('private constructor')
);
```

**Mock returns**:
```typescript
{
  file: 'src/ServiceLocator.ts',
  content: 'static instance'  // ✅ HAS 'static instance'
}
```

**Should pass filter... Why doesn't it?**

Let me check the test more carefully...

---

### Discovery #3: PatternDetector Confidence Calculation

**Singleton** (line 96):
```typescript
confidence: Math.min(singletons.length / 5, 1)
```

- If 1 singleton found: confidence = 1/5 = **0.2**
- Threshold is 0.5 (line 55) → **FILTERED OUT!**

**CRITICAL ISSUE**: Mock only returns 1 result per pattern, but needs 3+ to pass confidence threshold!

---

## Root Cause Summary

| Detector | Query | Mock Status | Issue | Fix |
|----------|-------|-------------|-------|-----|
| FeatureDetector (auth) | `'auth\|login\|...'` | ✅ CORRECT | Low confidence (need 10+ files) | Return 10+ files |
| FeatureDetector (API) | `'router\\.\|@Get\\(\|...'` | ✅ CORRECT | Low confidence (need 5+ files) | Return 5+ files |
| PatternDetector (Singleton) | `'static instance'` | ✅ CORRECT | Low confidence (need 3+ results) | Return 3+ results |
| PatternDetector (Factory) | `'factory'` | ✅ CORRECT | Low confidence (need 3+ results) | Return 3+ results |
| PatternDetector (DI) | `'constructor'` | ✅ CORRECT | Low confidence (need 5+ results) | Return 5+ results |

**THE PATTERN**: All mocks are correct but return too FEW results to pass confidence thresholds!

---

## Detailed Fix Plan

### Fix #1: Update ADRGenerator Test Mocks (21 tests)

**Current mock** (returns 1 result each):
```typescript
mockMemoryService = {
  search: vi.fn().mockImplementation((query: string) => {
    if (query.includes('static instance')) {
      return Promise.resolve([
        { file: 'src/ServiceLocator.ts', content: 'static instance' }
      ]);
    }
    // ... more patterns
  })
};
```

**FIXED mock** (returns 3+ results to pass confidence):
```typescript
mockMemoryService = {
  search: vi.fn().mockImplementation((query: string) => {
    if (query.includes('static instance')) {
      return Promise.resolve([
        { file: 'src/config/Database.ts', line: 15, content: 'private static instance: Database; static getInstance() { return Database.instance; }' },
        { file: 'src/config/Logger.ts', line: 20, content: 'private static instance: Logger; public static getInstance(): Logger' },
        { file: 'src/cache/CacheManager.ts', line: 10, content: 'static instance: CacheManager; private constructor() {}' },
      ]);
    }

    if (query.includes('factory')) {
      return Promise.resolve([
        { file: 'src/factories/UserFactory.ts', line: 5, content: 'export class UserFactory { create(type: string) { /*...*/ } }' },
        { file: 'src/factories/OrderFactory.ts', line: 8, content: 'class OrderFactory { build(data) { /*...*/ } }' },
        { file: 'src/builders/ProductFactory.ts', line: 12, content: 'export factory function createProduct() {}' },
      ]);
    }

    if (query.includes('constructor')) {
      return Promise.resolve([
        { file: 'src/services/UserService.ts', line: 10, content: 'constructor(private readonly repository: UserRepository) {}' },
        { file: 'src/services/OrderService.ts', line: 5, content: 'constructor(private db: Database, readonly logger: Logger) {}' },
        { file: 'src/controllers/AuthController.ts', line: 15, content: 'constructor(private authService: AuthService) {}' },
        { file: 'src/controllers/ProductController.ts', line: 8, content: 'constructor(private readonly productService: ProductService) {}' },
        { file: 'src/middleware/Validator.ts', line: 20, content: 'constructor(private schema: Schema) {}' },
        { file: 'src/workers/EmailWorker.ts', line: 12, content: '@inject() constructor(private mailer: Mailer) {}' },
      ]);
    }

    if (query.includes('addEventListener')) {
      return Promise.resolve([
        { file: 'src/events/EventBus.ts', line: 5, content: 'eventBus.addEventListener("user.created", handler)' },
        { file: 'src/components/Button.tsx', line: 10, content: 'button.addEventListener("click", onClick)' },
        { file: 'src/services/WebSocketService.ts', line: 15, content: 'socket.addEventListener("message", onMessage)' },
        { file: 'src/hooks/useEvents.ts', line: 8, content: 'window.addEventListener("resize", handleResize)' },
        { file: 'src/utils/DomEvents.ts', line: 12, content: 'element.addEventListener("focus", onFocus)' },
      ]);
    }

    if (query.includes('strategy')) {
      return Promise.resolve([
        { file: 'src/strategies/PaymentStrategy.ts', line: 5, content: 'interface PaymentStrategy { execute(amount: number): Promise<void> }' },
        { file: 'src/strategies/CreditCardStrategy.ts', line: 8, content: 'class CreditCardStrategy implements PaymentStrategy' },
        { file: 'src/strategies/PayPalStrategy.ts', line: 10, content: 'export class PayPalStrategy extends BaseStrategy' },
      ]);
    }

    if (query.includes('repository')) {
      return Promise.resolve([
        { file: 'src/repositories/UserRepository.ts', line: 5, content: 'export class UserRepository { async findById(id: string) { /*...*/ } save(user) { /*...*/ } }' },
        { file: 'src/repositories/OrderRepository.ts', line: 8, content: 'class OrderRepository extends BaseRepository' },
        { file: 'src/data/ProductDAO.ts', line: 10, content: 'export class ProductDAO { find() {} save() {} }' },
      ]);
    }

    if (query.includes('adapter')) {
      return Promise.resolve([
        { file: 'src/adapters/DatabaseAdapter.ts', line: 5, content: 'class DatabaseAdapter { adapt(data) { /*...*/ } }' },
        { file: 'src/adapters/ApiAdapter.ts', line: 8, content: 'export class ApiAdapter wraps external API' },
        { file: 'src/utils/LegacyAdapter.ts', line: 10, content: 'function adapt(legacy: Old): New' },
      ]);
    }

    if (query.includes('decorator')) {
      return Promise.resolve([
        { file: 'src/decorators/Log.ts', line: 5, content: '@Log() export function logDecorator()' },
        { file: 'src/decorators/Cache.ts', line: 8, content: '@Cache(ttl: 60) class CacheDecorator' },
        { file: 'src/decorators/Validate.ts', line: 10, content: 'function Validate(schema) { /*...*/ }' },
      ]);
    }

    if (query.includes('builder')) {
      return Promise.resolve([
        { file: 'src/builders/QueryBuilder.ts', line: 5, content: 'class QueryBuilder { where() { return this; } build() { /*...*/ } }' },
        { file: 'src/builders/UserBuilder.ts', line: 8, content: 'export class UserBuilder { withEmail(email) { /*...*/ } build() {}' },
        { file: 'src/utils/FormBuilder.ts', line: 10, content: 'const builder = new FormBuilder().addField().build()' },
      ]);
    }

    if (query.includes('service')) {
      return Promise.resolve([
        { file: 'src/services/UserService.ts', line: 5, content: 'export class UserService' },
        { file: 'src/services/OrderService.ts', line: 8, content: 'class OrderService' },
        { file: 'src/services/PaymentService.ts', line: 10, content: 'service PaymentService' },
        { file: 'src/controllers/UserController.ts', line: 15, content: 'export class UserController' },
        { file: 'src/repositories/OrderRepository.ts', line: 20, content: 'class OrderRepository' },
      ]);
    }

    if (query.includes('event')) {
      return Promise.resolve([
        { file: 'src/events/EventEmitter.ts', line: 5, content: 'export class EventEmitter { emit(event) {} }' },
        { file: 'src/events/EventBus.ts', line: 8, content: 'class EventBus { publish(event) {} }' },
        { file: 'src/handlers/EventHandler.ts', line: 10, content: 'export function handleEvent()' },
      ]);
    }

    if (query.includes('command')) {
      return Promise.resolve([
        { file: 'src/commands/CreateUserCommand.ts', line: 5, content: 'export class CreateUserCommand' },
        { file: 'src/commands/UpdateOrderCommand.ts', line: 8, content: 'class UpdateOrderCommand' },
        { file: 'src/queries/GetUserQuery.ts', line: 10, content: 'export class GetUserQuery' },
        { file: 'src/handlers/CommandHandler.ts', line: 15, content: 'class CommandHandler { execute(command: Command) {} }' },
        { file: 'src/handlers/QueryHandler.ts', line: 20, content: 'export class QueryHandler { handle(query: Query) {} }' },
      ]);
    }

    return Promise.resolve([]);
  }),
} as any;
```

**Impact**: Should unlock 18-20 ADRGenerator tests

---

### Fix #2: Update PRDGenerator Test Mocks (20 tests)

**Current mock** (from Round 1, returns 2 results):
```typescript
if (query.match(/auth|login|signup|password|token|session|jwt/i)) {
  return Promise.resolve([
    { file: 'src/auth/AuthService.ts', line: 10, content: 'async login() {}' },
    { file: 'src/auth/routes.ts', line: 5, content: 'router.post("/auth/login")' },
  ]);
}
```

**Confidence calculation** (FeatureDetector line 140):
```
confidence = (2/10)*0.6 + (0/5)*0.4 = 0.12
```
**Result**: 0.12 < 0.5 → **FILTERED OUT!**

**FIXED mock** (returns 10+ files to pass confidence):
```typescript
if (query.match(/auth|login|signup|password|token|session|jwt/i)) {
  return Promise.resolve([
    // Auth services
    { file: 'src/auth/AuthService.ts', line: 10, content: 'export class AuthService { async login(email: string, password: string) { const token = jwt.sign({...}); } }' },
    { file: 'src/auth/PasswordService.ts', line: 5, content: 'import bcrypt from "bcrypt"; export class PasswordService { async hash(password: string) {} }' },
    { file: 'src/auth/TokenService.ts', line: 8, content: 'import jwt from "jsonwebtoken"; export function generateToken(payload) { return jwt.sign(payload, secret); }' },
    { file: 'src/auth/SessionManager.ts', line: 15, content: 'export class SessionManager { createSession(userId) {} destroySession(sessionId) {} }' },

    // Auth routes/endpoints
    { file: 'src/auth/routes.ts', line: 20, content: 'router.post("/auth/login", loginHandler); router.post("/auth/signup", signupHandler);' },
    { file: 'src/controllers/AuthController.ts', line: 25, content: '@Post("/login") async login(@Body() credentials) { await this.authService.authenticate(credentials); }' },
    { file: 'src/api/v1/auth.ts', line: 12, content: 'app.post("/api/v1/auth/register", async (req, res) => { /*...*/ });' },

    // Middleware
    { file: 'src/middleware/authenticate.ts', line: 5, content: 'export function authenticate(req, res, next) { const token = req.headers.authorization; jwt.verify(token); }' },
    { file: 'src/middleware/session.ts', line: 8, content: 'import session from "express-session"; app.use(session({ secret: process.env.SESSION_SECRET }));' },

    // Models
    { file: 'src/models/User.ts', line: 10, content: 'interface User { id: string; email: string; password: string; token?: string; }' },
    { file: 'src/schemas/LoginSchema.ts', line: 5, content: 'export const loginSchema = z.object({ email: z.string(), password: z.string() });' },

    // Utils
    { file: 'src/utils/jwt.ts', line: 3, content: 'import jwt from "jsonwebtoken"; export const jwtSecret = process.env.JWT_SECRET;' },
  ]);
}
```

**New confidence calculation**:
```
authFiles.length = 12
endpoints = 3 (extracted from routes/controllers)
confidence = (12/10)*0.6 + (3/5)*0.4 = 0.72 + 0.24 = 0.96
```
**Result**: 0.96 > 0.5 → **PASSES!**

**Apply same pattern for all feature types**:
- API features: Return 5+ endpoint files
- UI features: Return 5+ component files
- Data features: Return 5+ model files
- Integration features: Return 3+ integration files
- Security features: Return 3+ security files

**Impact**: Should unlock 15-18 PRDGenerator tests

---

## Implementation Order

### Phase 1: Fix ADRGenerator Mock (Priority 1)
**File**: `src/speckit/__tests__/ADRGenerator.test.ts`
**Lines**: 35-85 (beforeEach mock setup)
**Changes**: Update mockMemoryService.search to return 3-6 results per pattern
**Expected Impact**: +18 tests (4→22 passing)

### Phase 2: Fix PRDGenerator Mock (Priority 2)
**File**: `src/speckit/__tests__/PRDGenerator.test.ts`
**Lines**: 56-133 (beforeEach mock setup)
**Changes**: Update mockMemoryService.search to return 10-12 results for auth, 5+ for others
**Expected Impact**: +15 tests (10→25 passing)

### Phase 3: Polish & Edge Cases (Priority 3)
- Add `cached` field to metadata objects
- Fix progress callback expectations
- Handle edge cases

**Expected Impact**: +3-5 tests

---

## Expected Outcomes

### Conservative Estimate
- SpecKitGenerator: 26/26 ✅ (done)
- ADRGenerator: 22/25 ✅ (+18 from current 4)
- PRDGenerator: 25/30 ✅ (+15 from current 10)
- **Total: 73/81 (90%)**

### Optimistic Estimate
- SpecKitGenerator: 26/26 ✅ (done)
- ADRGenerator: 24/25 ✅ (+20)
- PRDGenerator: 28/30 ✅ (+18)
- **Total: 78/81 (96%)**

---

## Key Insights

1. **Our regex mocks were CORRECT all along!** The issue was quantity, not quality.

2. **Confidence thresholds are HARD**:
   - Singleton: needs 3+ instances (confidence = 3/5 = 0.6)
   - Factory: needs 3+ factories (confidence = 3/5 = 0.6)
   - DI: needs 5+ constructors (confidence = 5/10 = 0.5)
   - Auth: needs 10+ files (confidence = 10/10 * 0.6 = 0.6)

3. **All detectors filter at 0.5 confidence** (line 55 in PatternDetector, line 75 in FeatureDetector)

4. **Tests expect REAL detection behavior**, not simplified mocks

---

## Time Estimate

- Phase 1 (ADRGenerator): 20 minutes
- Phase 2 (PRDGenerator): 20 minutes
- Phase 3 (Polish): 15 minutes
- Testing & Verification: 10 minutes
- **Total: ~1 hour**

---

## Conclusion

The path to 90%+ test coverage is clear:

1. ✅ Mocks are correctly pattern-matching queries
2. ❌ Mocks return too few results to pass confidence thresholds
3. ✅ Fix: Return 3-12 results per query (based on pattern type)
4. ✅ Expected: 73-78/81 tests passing (90-96%)

The detective work is done. Now it's just data entry - adding more mock results to each pattern.

Let's implement!
