# Inventory Domain Invariants

## Overview

The Inventory domain manages stock levels, reservations, movements,
and replenishment across warehouse locations.

## Schema Invariants

### INV-INV-001: SKU Format
SKU MUST be uppercase alphanumeric with dashes only.
- **Enforcement**: schema
- **Test**: `z.string().regex(/^[A-Z0-9-]+$/)` rejects invalid SKUs

### INV-INV-002: SKU Length
SKU MUST NOT exceed 50 characters.
- **Enforcement**: schema
- **Test**: `z.string().max(50)` rejects longer SKUs

### INV-INV-003: Non-Negative Quantity
All quantity values MUST be non-negative integers.
- **Enforcement**: schema
- **Test**: `z.number().int().min(0)` rejects negatives

### INV-INV-004: Total Quantity Consistency
Total quantity MUST equal sum of quantities across all locations.
- **Enforcement**: runtime (aggregate calculation)
- **Test**: Query all location stocks, verify sum equals total

### INV-INV-005: Available Quantity Calculation
Available quantity MUST equal total minus reserved minus on_hold.
- **Enforcement**: schema (refine)
- **Test**: Schema validation rejects inconsistent values
- **Formula**: `available = total - reserved - onHold`

## Runtime Invariants

### INV-INV-101: Reservation Within Available
Reservation quantity MUST NOT exceed available quantity.
- **Enforcement**: runtime
- **Test**: Reserve more than available → INSUFFICIENT_STOCK error

### INV-INV-102: No Reservation of Held Stock
Stock with status 'on_hold' MUST NOT be reserved.
- **Enforcement**: runtime
- **Test**: Reserve from on_hold stock → STOCK_ON_HOLD error

### INV-INV-103: Reservation Expiration
Pending reservations MUST be released after expiration.
- **Enforcement**: runtime (background job)
- **Test**: Expired reservation → auto-release

### INV-INV-104: Movement Balance
For transfers, quantity out MUST equal quantity in.
- **Enforcement**: runtime (transaction)
- **Test**: Transfer with quantity mismatch → error

### INV-INV-105: Non-Negative After Movement
Stock quantity MUST NOT go negative after any movement.
- **Enforcement**: runtime
- **Test**: Movement causing negative → INSUFFICIENT_STOCK error

### INV-INV-106: Location Uniqueness
Each product can have only one stock record per location.
- **Enforcement**: runtime (database constraint)
- **Test**: Duplicate location → merge or error

## Business Invariants

### INV-INV-201: Reorder Point Alert
System MUST alert when available quantity drops below reorder point.
- **Enforcement**: event handler
- **Test**: Quantity below reorder point → low_stock_alert event
- **Owner**: Supply Chain Team

### INV-INV-202: Safety Stock Protection
Regular orders SHOULD NOT deplete stock below safety stock level.
- **Enforcement**: test (soft constraint)
- **Test**: Warning when approaching safety stock
- **Owner**: Supply Chain Team

### INV-INV-203: Expiration Tracking
Stock with expiration MUST trigger alert 30 days before expiry.
- **Enforcement**: test (background job)
- **Test**: Expiring stock → expiring_soon event
- **Owner**: Warehouse Team

### INV-INV-204: FIFO for Perishables
Perishable items MUST be picked FIFO (first-in-first-out).
- **Enforcement**: test
- **Test**: Pick allocation prefers oldest lot
- **Owner**: Warehouse Team

### INV-INV-205: Adjustment Audit
All manual adjustments MUST have a reason and auditor.
- **Enforcement**: schema + test
- **Test**: Adjustment without reason → validation error
- **Owner**: Finance Team

## Cross-Aggregate Invariants

### INV-INV-301: Order Reservation Sync
When order is created, inventory MUST be reserved.
- **Enforcement**: saga
- **Aggregates**: Order, Inventory
- **Event**: `order.created` → `inventory.reserved`
- **Compensation**: If reservation fails, order creation fails

### INV-INV-302: Shipment Fulfillment
When order ships, reservation MUST be fulfilled.
- **Enforcement**: event handler
- **Aggregates**: Inventory, Shipping
- **Event**: `order.shipped` → `inventory.reservation_fulfilled`

### INV-INV-303: Order Cancellation Release
When order is cancelled, reservation MUST be released.
- **Enforcement**: event handler
- **Aggregates**: Order, Inventory
- **Event**: `order.cancelled` → `inventory.reservation_released`

### INV-INV-304: Return Stock Receipt
When return is received, stock MUST be incremented.
- **Enforcement**: event handler
- **Aggregates**: Returns, Inventory
- **Event**: `return.received` → `inventory.received` (if resaleable)

### INV-INV-305: Purchase Order Receipt
When purchase order is received, stock MUST be incremented.
- **Enforcement**: event handler
- **Aggregates**: Purchasing, Inventory
- **Event**: `purchase_order.received` → `inventory.received`

## Audit Invariants

### INV-INV-401: Movement Traceability
All stock movements MUST be recorded with full audit trail.
- **Enforcement**: runtime
- **Test**: Every quantity change produces movement record

### INV-INV-402: Reservation History
All reservation state changes MUST be logged.
- **Enforcement**: runtime
- **Test**: Every status change produces event

### INV-INV-403: Reconciliation Support
System MUST support point-in-time inventory reconstruction.
- **Enforcement**: event sourcing
- **Test**: Replay movements → reconstruct historical state
