# Payment Domain Invariants

## Overview

The Payment domain handles payment processing, including creating payment intents,
processing payments through external processors, and handling refunds.

## Schema Invariants

### INV-PAY-001: Non-negative Amount
Money amount MUST be a non-negative integer representing the smallest currency unit.
- **Enforcement**: schema
- **Test**: `z.number().int().min(0)` rejects negative amounts
- **Rationale**: Prevents invalid monetary values; cents are always >= 0

### INV-PAY-002: Valid Currency Code
Currency MUST be a valid ISO 4217 currency code from the supported list.
- **Enforcement**: schema
- **Test**: `z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD'])` rejects invalid codes
- **Rationale**: Ensures we only process supported currencies

### INV-PAY-003: Payment ID Format
Payment intent ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: `z.string().uuid()` rejects invalid UUIDs
- **Rationale**: Guarantees unique, collision-resistant identifiers

### INV-PAY-004: Positive Payment Amount
Payment intent amount MUST be greater than zero.
- **Enforcement**: schema
- **Test**: MoneySchema with amount validation
- **Rationale**: Zero-amount payments are meaningless

### INV-PAY-005: Valid Customer Reference
Customer ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: `z.string().uuid()` on customerId field
- **Rationale**: Ensures valid reference to customer aggregate

## Runtime Invariants

### INV-PAY-101: Valid Status Transitions
Payment status transitions MUST follow the defined state machine.
- **Enforcement**: runtime
- **Test**: Attempt invalid transitions and verify rejection
- **Valid Transitions**:
  ```
  created        → processing, cancelled
  processing     → requires_action, succeeded, failed
  requires_action → processing, succeeded, failed, cancelled
  succeeded      → (terminal - no transitions)
  failed         → processing (retry allowed)
  cancelled      → (terminal - no transitions)
  ```

### INV-PAY-102: Immutable After Completion
Succeeded or cancelled payment intents MUST NOT be modified.
- **Enforcement**: runtime
- **Test**: Attempt to modify completed payment → error
- **Exception**: Refunds can be created against succeeded payments

### INV-PAY-103: Payment Method Required for Processing
Payment method MUST be provided before transitioning to 'processing'.
- **Enforcement**: runtime
- **Test**: Attempt to process without payment method → error

### INV-PAY-104: Single Active Processing
A payment intent MUST NOT have concurrent processing attempts.
- **Enforcement**: runtime (optimistic locking)
- **Test**: Concurrent confirm requests → one succeeds, others fail

## Business Invariants

### INV-PAY-201: Refund Amount Limit
Total refunded amount MUST NOT exceed the original payment amount.
- **Enforcement**: test
- **Test**: Attempt to refund more than paid → rejection
- **Owner**: Finance Team

### INV-PAY-202: Refund Window
Refunds SHOULD be processed within 180 days of original payment.
- **Enforcement**: test (warning after 180 days)
- **Test**: Old payment refund triggers warning
- **Owner**: Finance Team

### INV-PAY-203: High-Value Review
Payments over $10,000 MAY require additional verification.
- **Enforcement**: test
- **Test**: High-value payment triggers fraud check
- **Owner**: Risk Management

### INV-PAY-204: Currency Consistency
Refund currency MUST match the original payment currency.
- **Enforcement**: test
- **Test**: Mismatched currency refund → rejection

## Cross-Aggregate Invariants

### INV-PAY-301: Order Payment Sync
When payment succeeds, associated order MUST be marked as paid.
- **Enforcement**: event handler
- **Aggregates**: Payment, Order
- **Event**: `payment.succeeded` → `order.paid`
- **Compensation**: If order update fails, payment remains succeeded (reconcile later)

### INV-PAY-302: Customer Balance Update
When refund succeeds, customer balance/credit MUST be updated if applicable.
- **Enforcement**: event handler
- **Aggregates**: Payment, Customer
- **Event**: `refund.succeeded` → customer credit updated

### INV-PAY-303: Notification on Status Change
Customer MUST be notified on payment status changes.
- **Enforcement**: event handler
- **Aggregates**: Payment, Notification
- **Events**: `payment.succeeded`, `payment.failed`, `refund.succeeded`

## Audit Invariants

### INV-PAY-401: Event Sourcing
All payment state changes MUST be recorded as domain events.
- **Enforcement**: runtime
- **Test**: Every state change produces corresponding event

### INV-PAY-402: Immutable Events
Payment events MUST NOT be modified after creation.
- **Enforcement**: runtime (event store)
- **Test**: Attempt to update event → error

### INV-PAY-403: Correlation Tracking
All payment events MUST include correlation ID for tracing.
- **Enforcement**: schema
- **Test**: Events without correlation ID rejected
