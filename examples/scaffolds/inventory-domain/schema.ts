/**
 * Inventory Domain Contracts v1
 *
 * This is an example scaffold demonstrating contract-first design
 * for an inventory management domain.
 *
 * @module @example/contracts/inventory/v1
 */

import { z } from 'zod';

// ============================================================================
// Value Objects
// ============================================================================

/**
 * SKU (Stock Keeping Unit) value object
 *
 * Invariants:
 * - INV-INV-001: SKU must be alphanumeric with dashes
 * - INV-INV-002: SKU max length 50 characters
 */
export const SkuSchema = z.string()
  .min(1)
  .max(50)
  .regex(/^[A-Z0-9-]+$/, 'SKU must be uppercase alphanumeric with dashes')
  .toUpperCase();

export type Sku = z.infer<typeof SkuSchema>;

/**
 * Quantity value object
 *
 * Invariants:
 * - INV-INV-003: Quantity must be non-negative integer
 */
export const QuantitySchema = z.number().int().min(0);

export type Quantity = z.infer<typeof QuantitySchema>;

/**
 * Location within warehouse
 */
export const LocationSchema = z.object({
  warehouseId: z.string().uuid(),
  zone: z.string().min(1).max(10),
  aisle: z.string().min(1).max(10),
  rack: z.string().min(1).max(10),
  shelf: z.string().min(1).max(10),
});

export type Location = z.infer<typeof LocationSchema>;

// ============================================================================
// Enums
// ============================================================================

/**
 * Inventory movement types
 */
export const MovementTypeSchema = z.enum([
  'receipt',        // Stock received from supplier
  'shipment',       // Stock shipped to customer
  'transfer',       // Stock moved between locations
  'adjustment',     // Manual adjustment
  'return',         // Customer return
  'damage',         // Damaged goods write-off
  'expiration',     // Expired goods write-off
]);

export type MovementType = z.infer<typeof MovementTypeSchema>;

/**
 * Stock status
 */
export const StockStatusSchema = z.enum([
  'available',      // Ready for sale
  'reserved',       // Reserved for order
  'on_hold',        // Quality hold
  'damaged',        // Cannot be sold
  'in_transit',     // Being transferred
]);

export type StockStatus = z.infer<typeof StockStatusSchema>;

/**
 * Reservation status
 */
export const ReservationStatusSchema = z.enum([
  'pending',
  'confirmed',
  'released',
  'fulfilled',
  'cancelled',
]);

export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

// ============================================================================
// Entities
// ============================================================================

/**
 * Product inventory - Aggregate Root
 *
 * Represents the inventory state for a single product across all locations.
 *
 * Invariants:
 * - INV-INV-004: Total quantity = sum of all location quantities
 * - INV-INV-005: Available = total - reserved - on_hold
 */
export const ProductInventorySchema = z.object({
  /** Product identifier */
  productId: z.string().uuid(),

  /** Stock keeping unit */
  sku: SkuSchema,

  /** Total quantity across all locations */
  totalQuantity: QuantitySchema,

  /** Available for sale (not reserved or held) */
  availableQuantity: QuantitySchema,

  /** Reserved for orders */
  reservedQuantity: QuantitySchema,

  /** On quality hold */
  onHoldQuantity: QuantitySchema,

  /** Reorder point - trigger replenishment below this */
  reorderPoint: QuantitySchema,

  /** Reorder quantity when replenishing */
  reorderQuantity: QuantitySchema,

  /** Safety stock level */
  safetyStock: QuantitySchema,

  /** Maximum stock level */
  maxStock: QuantitySchema.optional(),

  /** Timestamps */
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(
  (inv) => inv.availableQuantity === inv.totalQuantity - inv.reservedQuantity - inv.onHoldQuantity,
  { message: 'INV-INV-005: Available must equal total minus reserved minus on_hold' }
);

export type ProductInventory = z.infer<typeof ProductInventorySchema>;

/**
 * Stock at a specific location
 */
export const LocationStockSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid(),

  /** Product this stock belongs to */
  productId: z.string().uuid(),

  /** Location details */
  location: LocationSchema,

  /** Quantity at this location */
  quantity: QuantitySchema,

  /** Status of stock at this location */
  status: StockStatusSchema,

  /** Lot/batch number if applicable */
  lotNumber: z.string().max(50).optional(),

  /** Expiration date if applicable */
  expiresAt: z.string().datetime().optional(),

  /** Timestamps */
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LocationStock = z.infer<typeof LocationStockSchema>;

/**
 * Stock reservation for an order
 *
 * Invariants:
 * - INV-INV-006: Reservation quantity cannot exceed available
 * - INV-INV-007: Cannot reserve from on_hold stock
 */
export const ReservationSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid(),

  /** Product being reserved */
  productId: z.string().uuid(),

  /** Order this reservation is for */
  orderId: z.string().uuid(),

  /** Quantity reserved */
  quantity: QuantitySchema.min(1),

  /** Current status */
  status: ReservationStatusSchema,

  /** Reservation expiration (for pending) */
  expiresAt: z.string().datetime().optional(),

  /** Timestamps */
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  fulfilledAt: z.string().datetime().optional(),
});

export type Reservation = z.infer<typeof ReservationSchema>;

/**
 * Inventory movement record
 */
export const InventoryMovementSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid(),

  /** Product affected */
  productId: z.string().uuid(),

  /** Type of movement */
  type: MovementTypeSchema,

  /** Quantity moved (positive for inbound, negative for outbound) */
  quantity: z.number().int(),

  /** From location (for transfers and shipments) */
  fromLocation: LocationSchema.optional(),

  /** To location (for transfers and receipts) */
  toLocation: LocationSchema.optional(),

  /** Reference document */
  referenceType: z.enum(['order', 'purchase_order', 'transfer_order', 'adjustment', 'return']),
  referenceId: z.string().uuid(),

  /** Reason for movement */
  reason: z.string().max(500).optional(),

  /** Performed by */
  performedBy: z.string().uuid(),

  /** Timestamp */
  occurredAt: z.string().datetime(),
});

export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;

// ============================================================================
// Domain Events
// ============================================================================

/**
 * Inventory domain events
 */
export const InventoryEventSchema = z.discriminatedUnion('type', [
  // Stock level events
  z.object({
    type: z.literal('inventory.received'),
    productId: z.string().uuid(),
    quantity: QuantitySchema,
    location: LocationSchema,
    purchaseOrderId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('inventory.shipped'),
    productId: z.string().uuid(),
    quantity: QuantitySchema,
    orderId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('inventory.adjusted'),
    productId: z.string().uuid(),
    previousQuantity: QuantitySchema,
    newQuantity: QuantitySchema,
    reason: z.string(),
    adjustedBy: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('inventory.transferred'),
    productId: z.string().uuid(),
    quantity: QuantitySchema,
    fromLocation: LocationSchema,
    toLocation: LocationSchema,
    occurredAt: z.string().datetime(),
  }),

  // Reservation events
  z.object({
    type: z.literal('inventory.reserved'),
    reservationId: z.string().uuid(),
    productId: z.string().uuid(),
    orderId: z.string().uuid(),
    quantity: QuantitySchema,
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('inventory.reservation_released'),
    reservationId: z.string().uuid(),
    productId: z.string().uuid(),
    quantity: QuantitySchema,
    reason: z.enum(['order_cancelled', 'expired', 'manual']),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('inventory.reservation_fulfilled'),
    reservationId: z.string().uuid(),
    productId: z.string().uuid(),
    orderId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),

  // Alert events
  z.object({
    type: z.literal('inventory.low_stock_alert'),
    productId: z.string().uuid(),
    sku: SkuSchema,
    currentQuantity: QuantitySchema,
    reorderPoint: QuantitySchema,
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('inventory.out_of_stock'),
    productId: z.string().uuid(),
    sku: SkuSchema,
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('inventory.expiring_soon'),
    productId: z.string().uuid(),
    locationStockId: z.string().uuid(),
    quantity: QuantitySchema,
    expiresAt: z.string().datetime(),
    occurredAt: z.string().datetime(),
  }),
]);

export type InventoryEvent = z.infer<typeof InventoryEventSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Receive stock request
 */
export const ReceiveStockRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: QuantitySchema.min(1),
  location: LocationSchema,
  purchaseOrderId: z.string().uuid(),
  lotNumber: z.string().max(50).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type ReceiveStockRequest = z.infer<typeof ReceiveStockRequestSchema>;

/**
 * Reserve stock request
 */
export const ReserveStockRequestSchema = z.object({
  productId: z.string().uuid(),
  orderId: z.string().uuid(),
  quantity: QuantitySchema.min(1),
  expiresInMinutes: z.number().int().min(1).max(60).default(15),
});

export type ReserveStockRequest = z.infer<typeof ReserveStockRequestSchema>;

/**
 * Transfer stock request
 */
export const TransferStockRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: QuantitySchema.min(1),
  fromLocation: LocationSchema,
  toLocation: LocationSchema,
  reason: z.string().max(500).optional(),
});

export type TransferStockRequest = z.infer<typeof TransferStockRequestSchema>;

/**
 * Adjust stock request
 */
export const AdjustStockRequestSchema = z.object({
  productId: z.string().uuid(),
  location: LocationSchema,
  newQuantity: QuantitySchema,
  reason: z.string().min(1).max(500),
});

export type AdjustStockRequest = z.infer<typeof AdjustStockRequestSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateProductInventory(data: unknown): ProductInventory {
  return ProductInventorySchema.parse(data);
}

export function validateReservation(data: unknown): Reservation {
  return ReservationSchema.parse(data);
}

export function validateInventoryMovement(data: unknown): InventoryMovement {
  return InventoryMovementSchema.parse(data);
}

export function validateInventoryEvent(data: unknown): InventoryEvent {
  return InventoryEventSchema.parse(data);
}

// ============================================================================
// Error Codes
// ============================================================================

export const InventoryErrorCode = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  RESERVATION_NOT_FOUND: 'RESERVATION_NOT_FOUND',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  INVALID_LOCATION: 'INVALID_LOCATION',
  STOCK_ON_HOLD: 'STOCK_ON_HOLD',
  QUANTITY_MISMATCH: 'QUANTITY_MISMATCH',
  TRANSFER_SAME_LOCATION: 'TRANSFER_SAME_LOCATION',
} as const;

export type InventoryErrorCode = typeof InventoryErrorCode[keyof typeof InventoryErrorCode];
