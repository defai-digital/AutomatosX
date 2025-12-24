/**
 * Inventory Domain Contracts v1
 *
 * This is an example scaffold demonstrating contract-first design
 * for an inventory management domain.
 *
 * @module @example/contracts/inventory/v1
 */
import { z } from 'zod';
/**
 * SKU (Stock Keeping Unit) value object
 *
 * Invariants:
 * - INV-INV-001: SKU must be alphanumeric with dashes
 * - INV-INV-002: SKU max length 50 characters
 */
export declare const SkuSchema: any;
export type Sku = z.infer<typeof SkuSchema>;
/**
 * Quantity value object
 *
 * Invariants:
 * - INV-INV-003: Quantity must be non-negative integer
 */
export declare const QuantitySchema: any;
export type Quantity = z.infer<typeof QuantitySchema>;
/**
 * Location within warehouse
 */
export declare const LocationSchema: any;
export type Location = z.infer<typeof LocationSchema>;
/**
 * Inventory movement types
 */
export declare const MovementTypeSchema: any;
export type MovementType = z.infer<typeof MovementTypeSchema>;
/**
 * Stock status
 */
export declare const StockStatusSchema: any;
export type StockStatus = z.infer<typeof StockStatusSchema>;
/**
 * Reservation status
 */
export declare const ReservationStatusSchema: any;
export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;
/**
 * Product inventory - Aggregate Root
 *
 * Represents the inventory state for a single product across all locations.
 *
 * Invariants:
 * - INV-INV-004: Total quantity = sum of all location quantities
 * - INV-INV-005: Available = total - reserved - on_hold
 */
export declare const ProductInventorySchema: any;
export type ProductInventory = z.infer<typeof ProductInventorySchema>;
/**
 * Stock at a specific location
 */
export declare const LocationStockSchema: any;
export type LocationStock = z.infer<typeof LocationStockSchema>;
/**
 * Stock reservation for an order
 *
 * Invariants:
 * - INV-INV-006: Reservation quantity cannot exceed available
 * - INV-INV-007: Cannot reserve from on_hold stock
 */
export declare const ReservationSchema: any;
export type Reservation = z.infer<typeof ReservationSchema>;
/**
 * Inventory movement record
 */
export declare const InventoryMovementSchema: any;
export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;
/**
 * Inventory domain events
 */
export declare const InventoryEventSchema: any;
export type InventoryEvent = z.infer<typeof InventoryEventSchema>;
/**
 * Receive stock request
 */
export declare const ReceiveStockRequestSchema: any;
export type ReceiveStockRequest = z.infer<typeof ReceiveStockRequestSchema>;
/**
 * Reserve stock request
 */
export declare const ReserveStockRequestSchema: any;
export type ReserveStockRequest = z.infer<typeof ReserveStockRequestSchema>;
/**
 * Transfer stock request
 */
export declare const TransferStockRequestSchema: any;
export type TransferStockRequest = z.infer<typeof TransferStockRequestSchema>;
/**
 * Adjust stock request
 */
export declare const AdjustStockRequestSchema: any;
export type AdjustStockRequest = z.infer<typeof AdjustStockRequestSchema>;
export declare function validateProductInventory(data: unknown): ProductInventory;
export declare function validateReservation(data: unknown): Reservation;
export declare function validateInventoryMovement(data: unknown): InventoryMovement;
export declare function validateInventoryEvent(data: unknown): InventoryEvent;
export declare const InventoryErrorCode: {
    readonly PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND";
    readonly INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK";
    readonly RESERVATION_NOT_FOUND: "RESERVATION_NOT_FOUND";
    readonly RESERVATION_EXPIRED: "RESERVATION_EXPIRED";
    readonly INVALID_LOCATION: "INVALID_LOCATION";
    readonly STOCK_ON_HOLD: "STOCK_ON_HOLD";
    readonly QUANTITY_MISMATCH: "QUANTITY_MISMATCH";
    readonly TRANSFER_SAME_LOCATION: "TRANSFER_SAME_LOCATION";
};
export type InventoryErrorCode = typeof InventoryErrorCode[keyof typeof InventoryErrorCode];
//# sourceMappingURL=schema.d.ts.map