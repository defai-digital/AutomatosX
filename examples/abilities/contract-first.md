---
abilityId: contract-first
displayName: Contract-First Development
category: architecture
tags: [contract-first, zod, schema, ddd, architecture]
priority: 85
---

# Contract-First Development

## Core Philosophy

**Contract-First** means: Define the interface (schema) before the implementation.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Contract-First Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. REQUIREMENTS  ──▶  2. CONTRACT  ──▶  3. IMPLEMENTATION    │
│                                                                 │
│   "What do we need?"    "How is it      "Build it according    │
│                          shaped?"        to contract"           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why Contract-First?

| Benefit | Description |
|---------|-------------|
| **Clear Boundaries** | Contracts define explicit interfaces between components |
| **Early Validation** | Catch design issues before implementation |
| **Documentation** | Contracts serve as living documentation |
| **Type Safety** | Zod provides runtime + compile-time type safety |
| **Testability** | Contracts enable contract testing |

## Contract Structure

A complete contract consists of:

```
packages/contracts/src/<domain>/v1/
├── schema.ts        # Zod schemas (source of truth)
├── invariants.md    # Behavioral guarantees
├── index.ts         # Public exports
└── *.schema.json    # Optional JSON Schema exports
```

## Zod Schema Patterns

### Basic Entity Schema

```typescript
import { z } from 'zod';

/**
 * User entity schema
 *
 * Invariants:
 * - INV-USR-001: Email must be unique (enforced by database)
 * - INV-USR-002: Password must be hashed (enforced by runtime)
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(255),
  displayName: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;
```

### Aggregate Root Schema

```typescript
/**
 * Order aggregate root
 *
 * Invariants:
 * - INV-ORD-001: Order total = sum of line item totals
 * - INV-ORD-002: Cannot add items to completed order
 */
export const OrderSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  status: z.enum(['draft', 'pending', 'paid', 'shipped', 'completed', 'cancelled']),
  lineItems: z.array(LineItemSchema).min(1),
  total: z.number().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(
  (order) => order.total === order.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice, 0
  ),
  { message: 'Order total must equal sum of line items (INV-ORD-001)' }
);

export type Order = z.infer<typeof OrderSchema>;
```

### Value Object Schema

```typescript
/**
 * Money value object (immutable)
 */
export const MoneySchema = z.object({
  amount: z.number().int().min(0), // Store as cents
  currency: z.enum(['USD', 'EUR', 'GBP']),
}).readonly();

export type Money = z.infer<typeof MoneySchema>;
```

### Domain Event Schema

```typescript
/**
 * Order domain events
 */
export const OrderEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('order.created'),
    payload: z.object({
      orderId: z.string().uuid(),
      customerId: z.string().uuid(),
    }),
  }),
  z.object({
    type: z.literal('order.item_added'),
    payload: z.object({
      orderId: z.string().uuid(),
      itemId: z.string().uuid(),
      quantity: z.number().int().min(1),
    }),
  }),
  z.object({
    type: z.literal('order.completed'),
    payload: z.object({
      orderId: z.string().uuid(),
      completedAt: z.string().datetime(),
    }),
  }),
]);

export type OrderEvent = z.infer<typeof OrderEventSchema>;
```

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Schema field names | camelCase | `userId`, `createdAt` |
| Entity/Type names | PascalCase | `User`, `PaymentIntent` |
| Domain names | kebab-case | `payment-processing` |
| Schema constants | PascalCase + Schema | `UserSchema`, `OrderEventSchema` |
| Invariant IDs | INV-XXX-NNN | `INV-ORD-001` |

## Validation Functions

Always export validation functions alongside schemas:

```typescript
/**
 * Validates user data
 * @throws ZodError if validation fails
 */
export function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}

/**
 * Safely validates user data
 * @returns Result object with success/error
 */
export function safeValidateUser(
  data: unknown
): { success: true; data: User } | { success: false; error: z.ZodError } {
  const result = UserSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
```

## Index Exports Pattern

```typescript
// packages/contracts/src/user/v1/index.ts

// Schemas
export {
  UserSchema,
  UserRoleSchema,
  UserEventSchema,
} from './schema.js';

// Types
export type {
  User,
  UserRole,
  UserEvent,
} from './schema.js';

// Validation functions
export {
  validateUser,
  safeValidateUser,
} from './schema.js';
```

## Contract Testing

```typescript
import { describe, it, expect } from 'vitest';
import { UserSchema, validateUser } from '@pkg/contracts';

describe('User contract', () => {
  const validUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  it('should validate valid user', () => {
    expect(() => validateUser(validUser)).not.toThrow();
  });

  it('should reject invalid email', () => {
    expect(() => validateUser({ ...validUser, email: 'invalid' }))
      .toThrow();
  });

  it('should reject invalid role', () => {
    expect(() => validateUser({ ...validUser, role: 'superadmin' }))
      .toThrow();
  });
});
```

## Integration with Guard System

Create a guard policy for your domain:

```yaml
# packages/guard/policies/user.yaml
policy_id: user-development

allowed_paths:
  - packages/contracts/src/user/**
  - packages/core/user-domain/**
  - tests/contract/user.test.ts
  - tests/core/user-domain.test.ts

forbidden_paths:
  - packages/cli/**
  - packages/mcp-server/**

gates:
  - path_violation
  - dependency
  - change_radius
  - contract_tests

change_radius_limit: 2
```

Run guard check:

```bash
ax guard check --policy user-development --paths packages/contracts/src/user
```

## Anti-Patterns to Avoid

### 1. Implementation Before Contract

```typescript
// BAD: Writing implementation first
class UserService {
  createUser(name: string, email: string) {
    // Implementation without schema
  }
}

// GOOD: Contract first
const CreateUserInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

// Then implement
class UserService {
  createUser(input: CreateUserInput) {
    const validated = CreateUserInputSchema.parse(input);
    // Implementation with validated input
  }
}
```

### 2. Missing Invariant Documentation

```typescript
// BAD: Undocumented business rules
export const OrderSchema = z.object({
  total: z.number(),
  items: z.array(ItemSchema),
}).refine(/* some rule */);

// GOOD: Documented invariants
/**
 * Order aggregate
 *
 * Invariants:
 * - INV-ORD-001: Total equals sum of items
 * - INV-ORD-002: At least one item required
 */
export const OrderSchema = z.object({
  total: z.number(),
  items: z.array(ItemSchema).min(1), // INV-ORD-002
}).refine(
  (o) => o.total === sum(o.items),
  { message: 'INV-ORD-001: Total must equal sum of items' }
);
```

### 3. Leaking Internal Types

```typescript
// BAD: Exposing internal implementation details
export const UserSchema = z.object({
  _internalId: z.number(), // Internal DB ID leaked
  passwordHash: z.string(), // Security risk
});

// GOOD: Clean public contract
export const UserSchema = z.object({
  id: z.string().uuid(), // Public ID
  // passwordHash is internal, not in contract
});
```

## Quick Reference

```bash
# Create new domain contract
ax agent run contract-architect --input "Design contract for payment processing"

# Run contract-first workflow
ax workflow run contract-first-project --input "E-commerce order management"

# Validate contract changes
ax guard check --policy domain-development --paths packages/contracts/src/domain
```
