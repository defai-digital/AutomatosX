---
abilityId: typescript
displayName: TypeScript Best Practices
category: languages
tags: [typescript, types, javascript]
priority: 85
---

# TypeScript Best Practices

## Type System Fundamentals

### Prefer Interfaces for Objects
```typescript
// Prefer interface for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// Use type for unions, intersections, mapped types
type Status = 'pending' | 'active' | 'inactive';
type WithTimestamps<T> = T & { createdAt: Date; updatedAt: Date };
```

### Strict Mode Settings
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Avoid `any`, Use `unknown`
```typescript
// BAD
function parse(json: string): any {
  return JSON.parse(json);
}

// GOOD
function parse(json: string): unknown {
  return JSON.parse(json);
}

// Type guard to narrow unknown
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}
```

## Advanced Types

### Discriminated Unions
```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function handleResult<T>(result: Result<T>) {
  if (result.success) {
    console.log(result.data); // TypeScript knows data exists
  } else {
    console.error(result.error); // TypeScript knows error exists
  }
}
```

### Utility Types
```typescript
// Partial - all properties optional
type PartialUser = Partial<User>;

// Required - all properties required
type RequiredUser = Required<User>;

// Pick - select specific properties
type UserName = Pick<User, 'id' | 'name'>;

// Omit - exclude specific properties
type UserWithoutEmail = Omit<User, 'email'>;

// Record - key-value mapping
type UserMap = Record<string, User>;

// ReturnType - infer function return type
type FetchResult = ReturnType<typeof fetchUser>;
```

### Template Literal Types
```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiPath = '/users' | '/orders' | '/products';
type ApiEndpoint = `${HttpMethod} ${ApiPath}`;

// Result: 'GET /users' | 'GET /orders' | 'POST /users' | ...
```

### Branded Types
```typescript
type UserId = string & { readonly brand: unique symbol };
type OrderId = string & { readonly brand: unique symbol };

function createUserId(id: string): UserId {
  return id as UserId;
}

function getUser(id: UserId): User { /* ... */ }

// Prevents mixing up IDs
const userId = createUserId('123');
const orderId = createOrderId('456');
getUser(userId);  // OK
getUser(orderId); // Error!
```

## Type Guards

```typescript
// Type predicate
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Assertion function
function assertNonNull<T>(value: T): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error('Value is null or undefined');
  }
}

// Using in array operations
const values: (string | null)[] = ['a', null, 'b'];
const strings: string[] = values.filter((v): v is string => v !== null);
```

## Generics

```typescript
// Generic function
function first<T>(array: T[]): T | undefined {
  return array[0];
}

// Generic constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Default generic parameters
interface PaginatedResult<T = unknown> {
  data: T[];
  total: number;
  page: number;
}
```

## Module Patterns

```typescript
// Barrel exports (index.ts)
export * from './user.js';
export * from './order.js';
export type { Config } from './config.js';

// Named exports over default
export function createUser() { /* ... */ }
export const USER_ROLES = ['admin', 'user'] as const;

// Type-only imports
import type { User } from './types.js';
```

## Error Handling

```typescript
// Custom error classes
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Result type pattern
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function safeJsonParse(json: string): Result<unknown> {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}
```

## Best Practices Checklist

- [ ] Enable strict mode in tsconfig
- [ ] Avoid `any`, use `unknown` and narrow
- [ ] Use discriminated unions for state
- [ ] Leverage utility types
- [ ] Create branded types for IDs
- [ ] Write type guards for runtime checks
- [ ] Use `as const` for literal types
- [ ] Prefer interfaces for public APIs
- [ ] Document complex types with JSDoc
