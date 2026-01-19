---
abilityId: invariant-writing
displayName: Invariant Writing
category: architecture
tags: [invariants, contracts, documentation, testing]
priority: 75
---

# Invariant Writing

## What is an Invariant?

An invariant is a condition that **must always be true** for a system to be in a valid state. Invariants are the behavioral guarantees that contracts enforce.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Invariant Lifecycle                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   DEFINE  ──▶  DOCUMENT  ──▶  ENFORCE  ──▶  TEST              │
│                                                                 │
│   "What must   "Write in     "Add to      "Verify it          │
│    be true?"   invariants.md" schema/code" holds"             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Invariant ID Format

All invariants follow the `INV-XXX-NNN` format:

```
INV - XXX - NNN
 │     │     │
 │     │     └── Sequence number (001-999)
 │     │
 │     └── Domain abbreviation (2-4 uppercase letters)
 │
 └── Invariant prefix
```

### Domain Abbreviations

| Domain | Abbreviation |
|--------|--------------|
| Order | ORD |
| User | USR |
| Payment | PAY |
| Inventory | INV |
| Product | PRD |
| Session | SES |
| Trace | TRC |
| Memory | MEM |
| Guard | GRD |
| Workflow | WF |

## Invariant Categories

### Schema Invariants (001-099)

Enforced by Zod schema validation at parse time.

```markdown
### INV-ORD-001: Order ID Format
Order ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: `z.string().uuid()` rejects invalid UUIDs
```

```typescript
// Schema enforcement
export const OrderSchema = z.object({
  orderId: z.string().uuid(), // INV-ORD-001
});
```

### Runtime Invariants (100-199)

Enforced by application code during operations.

```markdown
### INV-ORD-101: Status Transition Validity
Order status transitions MUST follow the valid state machine.
- **Enforcement**: runtime
- **Test**: Attempt invalid transitions, verify rejection

Valid transitions:
- draft → submitted
- submitted → paid, cancelled
- paid → shipped, refunded
- shipped → delivered
```

```typescript
// Runtime enforcement
function transitionOrder(order: Order, newStatus: OrderStatus): Order {
  // INV-ORD-101: Validate transition
  if (!canTransition(order.status, newStatus)) {
    throw new InvariantViolationError(
      'INV-ORD-101',
      `Invalid transition from ${order.status} to ${newStatus}`
    );
  }
  return { ...order, status: newStatus };
}
```

### Business Invariants (200-299)

Enforced by tests, code reviews, and business processes.

```markdown
### INV-ORD-201: Order Value Limits
Orders above $10,000 MUST require manager approval.
- **Enforcement**: test
- **Test**: High-value order creates approval workflow

### INV-ORD-202: Refund Window
Refunds MUST be requested within 30 days of delivery.
- **Enforcement**: test
- **Test**: Refund after 30 days is rejected
```

### Cross-Aggregate Invariants (300-399)

Involve multiple aggregates, often eventually consistent.

```markdown
### INV-ORD-301: Inventory Reservation
When order is submitted, inventory MUST be reserved.
- **Enforcement**: runtime (saga/process manager)
- **Test**: Submit order → verify inventory decremented
- **Compensation**: If reservation fails, reject order
```

## Invariant Documentation Template

```markdown
# {{Domain}} Domain Invariants

## Overview

Brief description of the domain and its key invariants.

## Schema Invariants

### INV-XXX-001: {{Name}}
{{Description of what must be true}}
- **Enforcement**: schema
- **Test**: {{How the schema enforces this}}
- **Zod**: `{{zod expression}}`

### INV-XXX-002: {{Name}}
{{Description}}
- **Enforcement**: schema
- **Test**: {{Verification method}}

## Runtime Invariants

### INV-XXX-101: {{Name}}
{{Description of what must be true}}
- **Enforcement**: runtime
- **Test**: {{Test scenario}}
- **Error**: {{Error thrown on violation}}

## Business Invariants

### INV-XXX-201: {{Name}}
{{Description of business rule}}
- **Enforcement**: test
- **Test**: {{Test case description}}
- **Owner**: {{Business owner}}

## Cross-Aggregate Invariants

### INV-XXX-301: {{Name}}
{{Description involving multiple aggregates}}
- **Enforcement**: {{saga/process manager/event}}
- **Aggregates**: {{List of involved aggregates}}
- **Compensation**: {{What happens on failure}}
```

## Complete Example: Order Domain

```markdown
# Order Domain Invariants

## Overview

The Order domain manages customer orders from creation through fulfillment.
These invariants ensure order integrity and business rule compliance.

## Schema Invariants

### INV-ORD-001: Order ID Format
Order ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: `z.string().uuid()` rejects invalid UUIDs
- **Zod**: `orderId: z.string().uuid()`

### INV-ORD-002: Minimum Line Items
Order MUST have at least one line item.
- **Enforcement**: schema
- **Test**: Empty line items array is rejected
- **Zod**: `lineItems: z.array(LineItemSchema).min(1)`

### INV-ORD-003: Positive Quantities
Line item quantity MUST be a positive integer.
- **Enforcement**: schema
- **Test**: Zero or negative quantities rejected
- **Zod**: `quantity: z.number().int().min(1)`

### INV-ORD-004: Total Calculation
Order total MUST equal sum of (quantity * unitPrice) for all line items.
- **Enforcement**: schema
- **Test**: Mismatched totals rejected by refinement
- **Zod**: `.refine((o) => o.total === calculateTotal(o.lineItems))`

### INV-ORD-005: Valid Currency
Currency MUST be a supported ISO 4217 code.
- **Enforcement**: schema
- **Test**: Invalid currency codes rejected
- **Zod**: `currency: z.enum(['USD', 'EUR', 'GBP'])`

## Runtime Invariants

### INV-ORD-101: Status Transition Validity
Order status transitions MUST follow the valid state machine.
- **Enforcement**: runtime
- **Test**: Invalid transitions throw `InvalidTransitionError`
- **Valid Transitions**:
  ```
  draft      → submitted
  submitted  → paid, cancelled
  paid       → shipped, refunded
  shipped    → delivered
  delivered  → (terminal)
  cancelled  → (terminal)
  refunded   → (terminal)
  ```

### INV-ORD-102: Immutable After Completion
Completed orders (delivered/cancelled/refunded) MUST NOT be modified.
- **Enforcement**: runtime
- **Test**: Modification attempts throw `ImmutableOrderError`

### INV-ORD-103: Payment Before Shipment
Order MUST be in 'paid' status before transitioning to 'shipped'.
- **Enforcement**: runtime
- **Test**: Attempt to ship unpaid order → rejection

## Business Invariants

### INV-ORD-201: High-Value Approval
Orders exceeding $10,000 MUST require manager approval before processing.
- **Enforcement**: test
- **Test**: High-value order triggers approval workflow
- **Owner**: Finance Team

### INV-ORD-202: Refund Window
Refunds MUST be requested within 30 days of delivery.
- **Enforcement**: test
- **Test**: Late refund requests are rejected
- **Owner**: Customer Service

### INV-ORD-203: Fraud Check
Orders from new customers over $500 MUST pass fraud check.
- **Enforcement**: test
- **Test**: New customer high-value order → fraud check triggered
- **Owner**: Risk Management

## Cross-Aggregate Invariants

### INV-ORD-301: Inventory Reservation
When order transitions to 'submitted', inventory MUST be reserved.
- **Enforcement**: saga
- **Aggregates**: Order, Inventory
- **Compensation**: If reservation fails, order remains in 'draft'
- **Test**: Submit order → verify inventory decremented

### INV-ORD-302: Payment Capture
When order transitions to 'paid', payment MUST be captured.
- **Enforcement**: saga
- **Aggregates**: Order, Payment
- **Compensation**: If capture fails, order reverts to 'submitted'
- **Test**: Pay order → verify payment captured

### INV-ORD-303: Customer Notification
When order status changes, customer MUST be notified.
- **Enforcement**: event handler
- **Aggregates**: Order, Notification
- **Test**: Status change → verify notification sent
```

## Enforcement Strategies

### Schema Enforcement

```typescript
// Use Zod features for schema invariants
export const OrderSchema = z.object({
  orderId: z.string().uuid(),                    // INV-ORD-001
  lineItems: z.array(LineItemSchema).min(1),     // INV-ORD-002
  total: z.number().min(0),
}).refine(
  (order) => {
    const calculated = order.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    return Math.abs(order.total - calculated) < 0.01; // INV-ORD-004
  },
  { message: 'INV-ORD-004: Total must match line items' }
);
```

### Runtime Enforcement

```typescript
// Domain service enforces runtime invariants
class OrderService {
  transition(order: Order, newStatus: OrderStatus): Order {
    // INV-ORD-101: Validate transition
    if (!isValidTransition(order.status, newStatus)) {
      throw new InvariantViolation('INV-ORD-101', {
        from: order.status,
        to: newStatus,
      });
    }

    // INV-ORD-102: Check immutability
    if (isTerminalStatus(order.status)) {
      throw new InvariantViolation('INV-ORD-102', {
        status: order.status,
      });
    }

    // INV-ORD-103: Payment before shipment
    if (newStatus === 'shipped' && order.status !== 'paid') {
      throw new InvariantViolation('INV-ORD-103', {
        currentStatus: order.status,
      });
    }

    return { ...order, status: newStatus };
  }
}
```

### Test Enforcement

```typescript
describe('Order business invariants', () => {
  // INV-ORD-201
  it('should require approval for orders over $10,000', async () => {
    const order = createOrder({ total: 15000 });
    const result = await orderService.submit(order);
    expect(result.requiresApproval).toBe(true);
  });

  // INV-ORD-202
  it('should reject refunds after 30 days', async () => {
    const order = createDeliveredOrder({ deliveredAt: daysAgo(31) });
    await expect(orderService.refund(order))
      .rejects.toThrow('INV-ORD-202');
  });
});
```

## Common Mistakes

### 1. Vague Invariants

```markdown
// BAD: Too vague
### INV-ORD-001: Valid Order
Order must be valid.

// GOOD: Specific and testable
### INV-ORD-001: Order ID Format
Order ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: `z.string().uuid()` rejects invalid UUIDs
```

### 2. Missing Enforcement Strategy

```markdown
// BAD: No enforcement specified
### INV-ORD-101: Status Rules
Status must follow rules.

// GOOD: Clear enforcement
### INV-ORD-101: Status Transition Validity
Order status transitions MUST follow the valid state machine.
- **Enforcement**: runtime
- **Test**: Invalid transitions throw `InvalidTransitionError`
```

### 3. Untestable Invariants

```markdown
// BAD: Can't be tested
### INV-ORD-201: User Happiness
Users should be happy with their orders.

// GOOD: Testable condition
### INV-ORD-201: Order Confirmation
Order confirmation email MUST be sent within 5 minutes of order creation.
- **Enforcement**: test
- **Test**: Create order → verify email sent within SLA
```

## Quick Reference

| Category | ID Range | Enforcement | Example |
|----------|----------|-------------|---------|
| Schema | 001-099 | Zod validation | Field formats, required fields |
| Runtime | 100-199 | Application code | State transitions, business logic |
| Business | 200-299 | Tests, reviews | Approval workflows, SLAs |
| Cross-Aggregate | 300-399 | Sagas, events | Inventory reservation |
