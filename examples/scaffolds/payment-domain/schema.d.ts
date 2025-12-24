/**
 * Payment Domain Contracts v1
 *
 * This is an example scaffold demonstrating contract-first design
 * for a payment processing domain.
 *
 * @module @example/contracts/payment/v1
 */
import { z } from 'zod';
/**
 * Money value object
 * Immutable representation of monetary amounts
 *
 * Invariants:
 * - INV-PAY-001: Amount must be non-negative integer (cents)
 * - INV-PAY-002: Currency must be valid ISO 4217 code
 */
export declare const MoneySchema: any;
export type Money = z.infer<typeof MoneySchema>;
/**
 * Payment method value object
 */
export declare const PaymentMethodSchema: any;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
/**
 * Payment intent status
 *
 * Invariants:
 * - INV-PAY-101: Status transitions must follow valid state machine
 */
export declare const PaymentIntentStatusSchema: any;
export type PaymentIntentStatus = z.infer<typeof PaymentIntentStatusSchema>;
/**
 * Valid status transitions
 */
export declare const PAYMENT_STATUS_TRANSITIONS: Record<PaymentIntentStatus, PaymentIntentStatus[]>;
/**
 * Refund status
 */
export declare const RefundStatusSchema: any;
export type RefundStatus = z.infer<typeof RefundStatusSchema>;
/**
 * Payment Intent - Aggregate Root
 *
 * Represents an intent to collect payment from a customer.
 *
 * Invariants:
 * - INV-PAY-003: Payment ID must be valid UUID
 * - INV-PAY-004: Amount must be positive
 * - INV-PAY-005: Customer ID must be valid UUID
 * - INV-PAY-101: Status transitions must be valid
 * - INV-PAY-102: Cannot modify succeeded/cancelled payments
 */
export declare const PaymentIntentSchema: any;
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;
/**
 * Refund entity
 *
 * Represents a refund against a payment.
 *
 * Invariants:
 * - INV-PAY-006: Refund amount cannot exceed payment amount
 * - INV-PAY-007: Can only refund succeeded payments
 */
export declare const RefundSchema: any;
export type Refund = z.infer<typeof RefundSchema>;
/**
 * Payment domain events
 */
export declare const PaymentEventSchema: any;
export type PaymentEvent = z.infer<typeof PaymentEventSchema>;
/**
 * Create payment intent request
 */
export declare const CreatePaymentIntentRequestSchema: any;
export type CreatePaymentIntentRequest = z.infer<typeof CreatePaymentIntentRequestSchema>;
/**
 * Confirm payment request
 */
export declare const ConfirmPaymentRequestSchema: any;
export type ConfirmPaymentRequest = z.infer<typeof ConfirmPaymentRequestSchema>;
/**
 * Create refund request
 */
export declare const CreateRefundRequestSchema: any;
export type CreateRefundRequest = z.infer<typeof CreateRefundRequestSchema>;
/**
 * Validates a payment intent
 */
export declare function validatePaymentIntent(data: unknown): PaymentIntent;
/**
 * Safely validates a payment intent
 */
export declare function safeValidatePaymentIntent(data: unknown): {
    success: true;
    data: PaymentIntent;
} | {
    success: false;
    error: z.ZodError;
};
/**
 * Validates a refund
 */
export declare function validateRefund(data: unknown): Refund;
/**
 * Validates a payment event
 */
export declare function validatePaymentEvent(data: unknown): PaymentEvent;
/**
 * Check if status transition is valid
 */
export declare function isValidStatusTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): boolean;
export declare const PaymentErrorCode: {
    readonly PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND";
    readonly INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION";
    readonly PAYMENT_ALREADY_COMPLETED: "PAYMENT_ALREADY_COMPLETED";
    readonly REFUND_EXCEEDS_PAYMENT: "REFUND_EXCEEDS_PAYMENT";
    readonly INVALID_PAYMENT_METHOD: "INVALID_PAYMENT_METHOD";
    readonly PROCESSOR_ERROR: "PROCESSOR_ERROR";
};
export type PaymentErrorCode = typeof PaymentErrorCode[keyof typeof PaymentErrorCode];
//# sourceMappingURL=schema.d.ts.map