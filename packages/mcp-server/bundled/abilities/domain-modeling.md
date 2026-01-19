---
abilityId: domain-modeling
displayName: Domain Modeling
category: architecture
tags: [ddd, domain-driven-design, modeling, entities, aggregates]
priority: 80
---

# Domain Modeling

## Domain-Driven Design Fundamentals

Domain modeling is the practice of creating a conceptual model of the problem domain that reflects business logic, rules, and relationships.

## Core Concepts

### Bounded Context

A bounded context is a logical boundary within which a particular domain model is defined and applicable.

```
┌─────────────────────────────────────────────────────────────────┐
│                        E-Commerce System                        │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Order Context │ Inventory Context│    Customer Context        │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ - Order         │ - Product       │ - Customer                  │
│ - LineItem      │ - Stock         │ - Address                   │
│ - Payment       │ - Warehouse     │ - Preferences               │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Entities

Objects with a distinct identity that persists over time.

```typescript
/**
 * Customer entity
 * Identity: customerId (remains constant)
 * State: can change over time
 */
export const CustomerSchema = z.object({
  // Identity (immutable)
  customerId: z.string().uuid(),

  // State (mutable)
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  status: z.enum(['active', 'suspended', 'deleted']),

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### Value Objects

Immutable objects defined by their attributes, not identity.

```typescript
/**
 * Address value object
 * No identity - defined entirely by its values
 * Immutable - changes create new instances
 */
export const AddressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().length(2),
}).readonly();

// Value objects are compared by value
const addr1 = { street: '123 Main', city: 'NYC', ... };
const addr2 = { street: '123 Main', city: 'NYC', ... };
// addr1 equals addr2 if all properties match
```

### Aggregate Roots

An aggregate is a cluster of domain objects that can be treated as a single unit. The aggregate root is the entry point.

```typescript
/**
 * Order aggregate root
 *
 * Rules:
 * 1. External objects can only reference the root (Order)
 * 2. LineItems can only be accessed through Order
 * 3. Order maintains invariants for all its children
 */
export const OrderSchema = z.object({
  // Aggregate root identity
  orderId: z.string().uuid(),

  // Reference to external aggregate (Customer)
  customerId: z.string().uuid(),

  // Owned entities (LineItems)
  lineItems: z.array(LineItemSchema),

  // Aggregate state
  status: OrderStatusSchema,
  total: MoneySchema,

  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * LineItem - owned by Order aggregate
 * Cannot exist without parent Order
 */
export const LineItemSchema = z.object({
  lineItemId: z.string().uuid(),
  productId: z.string().uuid(), // Reference to external aggregate
  quantity: z.number().int().min(1),
  unitPrice: MoneySchema,
});
```

### Domain Events

Events that represent something that happened in the domain.

```typescript
/**
 * Domain events capture state transitions
 */
export const OrderEventSchema = z.discriminatedUnion('type', [
  // Order lifecycle events
  z.object({
    type: z.literal('order.created'),
    orderId: z.string().uuid(),
    customerId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('order.submitted'),
    orderId: z.string().uuid(),
    total: MoneySchema,
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('order.paid'),
    orderId: z.string().uuid(),
    paymentId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('order.shipped'),
    orderId: z.string().uuid(),
    trackingNumber: z.string(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('order.cancelled'),
    orderId: z.string().uuid(),
    reason: z.string(),
    occurredAt: z.string().datetime(),
  }),
]);
```

## Modeling Process

### Step 1: Identify Bounded Contexts

```markdown
## Order Management Context

### Purpose
Handles the lifecycle of customer orders from creation to fulfillment.

### Key Concepts
- Order (aggregate root)
- LineItem (entity)
- Money (value object)
- OrderStatus (value object)

### External Dependencies
- Customer Context (customerId reference)
- Inventory Context (productId reference)
- Payment Context (paymentId reference)
```

### Step 2: Identify Aggregates

```
┌─────────────────────────────────────────────┐
│              Order Aggregate                │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐   │
│  │         Order (Root)                │   │
│  │  - orderId                          │   │
│  │  - customerId (ref)                 │   │
│  │  - status                           │   │
│  │  - total                            │   │
│  └─────────────────────────────────────┘   │
│              │                              │
│              │ owns                         │
│              ▼                              │
│  ┌─────────────────────────────────────┐   │
│  │      LineItem[] (Children)          │   │
│  │  - lineItemId                       │   │
│  │  - productId (ref)                  │   │
│  │  - quantity                         │   │
│  │  - unitPrice                        │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Step 3: Define Invariants

```markdown
## Order Aggregate Invariants

### INV-ORD-001: Total Consistency
Order total MUST equal sum of (lineItem.quantity * lineItem.unitPrice) for all line items.
- **Enforcement**: Schema refinement
- **Test**: Calculate and compare totals

### INV-ORD-002: Minimum Items
Order MUST have at least one line item.
- **Enforcement**: Schema (array.min(1))
- **Test**: Empty array validation

### INV-ORD-003: Status Transitions
Order status MUST follow valid state machine transitions.
- **Enforcement**: Runtime validation
- **Valid Transitions**:
  - draft → submitted
  - submitted → paid | cancelled
  - paid → shipped | cancelled
  - shipped → completed
```

### Step 4: Model State Transitions

```typescript
/**
 * Order status with valid transitions
 */
export const OrderStatusSchema = z.enum([
  'draft',
  'submitted',
  'paid',
  'shipped',
  'completed',
  'cancelled',
]);

/**
 * Valid status transitions
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['submitted'],
  submitted: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

/**
 * Validate status transition
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
```

## Relationship Patterns

### Reference by ID (Preferred)

```typescript
// Reference to aggregate in different bounded context
export const OrderSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(), // Reference by ID, not embedded
});
```

### Embedded Value Objects

```typescript
// Value objects are embedded in their parent
export const OrderSchema = z.object({
  orderId: z.string().uuid(),
  shippingAddress: AddressSchema, // Embedded value object
  billingAddress: AddressSchema,  // Embedded value object
});
```

### Owned Entities

```typescript
// Child entities owned by aggregate
export const OrderSchema = z.object({
  orderId: z.string().uuid(),
  lineItems: z.array(LineItemSchema), // Owned entities
});
```

## Anti-Patterns

### 1. Anemic Domain Model

```typescript
// BAD: Just data, no behavior
export const OrderSchema = z.object({
  id: z.string(),
  items: z.array(z.object({ price: z.number() })),
  total: z.number(), // Who calculates this?
});

// GOOD: Enforce invariants in schema
export const OrderSchema = z.object({
  id: z.string().uuid(),
  items: z.array(LineItemSchema).min(1),
  total: z.number().min(0),
}).refine(
  (o) => o.total === calculateTotal(o.items),
  { message: 'INV-ORD-001: Total must match items' }
);
```

### 2. God Aggregate

```typescript
// BAD: Aggregate too large
export const EverythingSchema = z.object({
  order: OrderSchema,
  customer: CustomerSchema, // Should be separate aggregate
  products: z.array(ProductSchema), // Should be separate aggregate
  payments: z.array(PaymentSchema), // Should be separate aggregate
});

// GOOD: Focused aggregate with references
export const OrderSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(), // Reference only
  lineItems: z.array(z.object({
    productId: z.string().uuid(), // Reference only
    quantity: z.number(),
  })),
});
```

### 3. Missing Bounded Context

```typescript
// BAD: Same "Product" used everywhere with different meanings
// In Catalog context: has description, images, categories
// In Inventory context: has stock levels, warehouse locations
// In Order context: just needs ID and price

// GOOD: Different representations per context
// catalog/v1/schema.ts
export const CatalogProductSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  images: z.array(z.string().url()),
  categories: z.array(z.string()),
});

// inventory/v1/schema.ts
export const InventoryItemSchema = z.object({
  productId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().int().min(0),
  reorderPoint: z.number().int().min(0),
});

// order/v1/schema.ts
export const OrderLineItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitPrice: MoneySchema,
});
```

## Quick Reference

| Concept | Characteristics | Example |
|---------|-----------------|---------|
| Entity | Has identity, mutable | Customer, Order |
| Value Object | No identity, immutable | Money, Address |
| Aggregate | Cluster with root | Order + LineItems |
| Domain Event | Past tense, immutable | OrderCreated |
| Bounded Context | Logical boundary | Order Management |
