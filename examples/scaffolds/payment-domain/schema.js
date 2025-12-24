/**
 * Payment Domain Contracts v1
 *
 * This is an example scaffold demonstrating contract-first design
 * for a payment processing domain.
 *
 * @module @example/contracts/payment/v1
 */
import { z } from 'zod';
// ============================================================================
// Value Objects
// ============================================================================
/**
 * Money value object
 * Immutable representation of monetary amounts
 *
 * Invariants:
 * - INV-PAY-001: Amount must be non-negative integer (cents)
 * - INV-PAY-002: Currency must be valid ISO 4217 code
 */
export const MoneySchema = z.object({
    /** Amount in smallest currency unit (cents for USD) */
    amount: z.number().int().min(0),
    /** ISO 4217 currency code */
    currency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD']),
}).readonly();
/**
 * Payment method value object
 */
export const PaymentMethodSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('card'),
        last4: z.string().length(4).regex(/^\d{4}$/),
        brand: z.enum(['visa', 'mastercard', 'amex', 'discover']),
        expiryMonth: z.number().int().min(1).max(12),
        expiryYear: z.number().int().min(2024).max(2050),
    }),
    z.object({
        type: z.literal('bank_transfer'),
        bankName: z.string().min(1).max(100),
        last4: z.string().length(4).regex(/^\d{4}$/),
    }),
    z.object({
        type: z.literal('wallet'),
        provider: z.enum(['paypal', 'apple_pay', 'google_pay']),
        accountId: z.string().min(1).max(100),
    }),
]);
// ============================================================================
// Enums
// ============================================================================
/**
 * Payment intent status
 *
 * Invariants:
 * - INV-PAY-101: Status transitions must follow valid state machine
 */
export const PaymentIntentStatusSchema = z.enum([
    'created',
    'processing',
    'requires_action',
    'succeeded',
    'failed',
    'cancelled',
]);
/**
 * Valid status transitions
 */
export const PAYMENT_STATUS_TRANSITIONS = {
    created: ['processing', 'cancelled'],
    processing: ['requires_action', 'succeeded', 'failed'],
    requires_action: ['processing', 'succeeded', 'failed', 'cancelled'],
    succeeded: [], // Terminal state
    failed: ['processing'], // Can retry
    cancelled: [], // Terminal state
};
/**
 * Refund status
 */
export const RefundStatusSchema = z.enum([
    'pending',
    'processing',
    'succeeded',
    'failed',
]);
// ============================================================================
// Entities
// ============================================================================
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
export const PaymentIntentSchema = z.object({
    /** Unique identifier */
    id: z.string().uuid(),
    /** Customer making the payment */
    customerId: z.string().uuid(),
    /** Order or invoice being paid (optional) */
    orderId: z.string().uuid().optional(),
    /** Payment amount */
    amount: MoneySchema,
    /** Current status */
    status: PaymentIntentStatusSchema,
    /** Selected payment method (set when processing) */
    paymentMethod: PaymentMethodSchema.optional(),
    /** Description shown to customer */
    description: z.string().max(500).optional(),
    /** Metadata for custom data */
    metadata: z.record(z.string(), z.string()).optional(),
    /** Error information if failed */
    error: z.object({
        code: z.string(),
        message: z.string(),
        declineCode: z.string().optional(),
    }).optional(),
    /** External processor reference */
    processorId: z.string().max(100).optional(),
    /** Timestamps */
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
});
/**
 * Refund entity
 *
 * Represents a refund against a payment.
 *
 * Invariants:
 * - INV-PAY-006: Refund amount cannot exceed payment amount
 * - INV-PAY-007: Can only refund succeeded payments
 */
export const RefundSchema = z.object({
    /** Unique identifier */
    id: z.string().uuid(),
    /** Payment being refunded */
    paymentIntentId: z.string().uuid(),
    /** Refund amount */
    amount: MoneySchema,
    /** Current status */
    status: RefundStatusSchema,
    /** Reason for refund */
    reason: z.enum([
        'duplicate',
        'fraudulent',
        'requested_by_customer',
        'other',
    ]),
    /** Additional notes */
    notes: z.string().max(1000).optional(),
    /** External processor reference */
    processorId: z.string().max(100).optional(),
    /** Timestamps */
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
});
// ============================================================================
// Domain Events
// ============================================================================
/**
 * Payment domain events
 */
export const PaymentEventSchema = z.discriminatedUnion('type', [
    // Payment Intent events
    z.object({
        type: z.literal('payment.created'),
        paymentIntentId: z.string().uuid(),
        customerId: z.string().uuid(),
        amount: MoneySchema,
        occurredAt: z.string().datetime(),
    }),
    z.object({
        type: z.literal('payment.processing'),
        paymentIntentId: z.string().uuid(),
        paymentMethod: PaymentMethodSchema,
        occurredAt: z.string().datetime(),
    }),
    z.object({
        type: z.literal('payment.succeeded'),
        paymentIntentId: z.string().uuid(),
        processorId: z.string(),
        occurredAt: z.string().datetime(),
    }),
    z.object({
        type: z.literal('payment.failed'),
        paymentIntentId: z.string().uuid(),
        errorCode: z.string(),
        errorMessage: z.string(),
        occurredAt: z.string().datetime(),
    }),
    z.object({
        type: z.literal('payment.cancelled'),
        paymentIntentId: z.string().uuid(),
        reason: z.string().optional(),
        occurredAt: z.string().datetime(),
    }),
    // Refund events
    z.object({
        type: z.literal('refund.created'),
        refundId: z.string().uuid(),
        paymentIntentId: z.string().uuid(),
        amount: MoneySchema,
        occurredAt: z.string().datetime(),
    }),
    z.object({
        type: z.literal('refund.succeeded'),
        refundId: z.string().uuid(),
        occurredAt: z.string().datetime(),
    }),
    z.object({
        type: z.literal('refund.failed'),
        refundId: z.string().uuid(),
        errorCode: z.string(),
        errorMessage: z.string(),
        occurredAt: z.string().datetime(),
    }),
]);
// ============================================================================
// Request/Response Schemas
// ============================================================================
/**
 * Create payment intent request
 */
export const CreatePaymentIntentRequestSchema = z.object({
    customerId: z.string().uuid(),
    amount: MoneySchema,
    orderId: z.string().uuid().optional(),
    description: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
});
/**
 * Confirm payment request
 */
export const ConfirmPaymentRequestSchema = z.object({
    paymentIntentId: z.string().uuid(),
    paymentMethod: PaymentMethodSchema,
});
/**
 * Create refund request
 */
export const CreateRefundRequestSchema = z.object({
    paymentIntentId: z.string().uuid(),
    amount: MoneySchema.optional(), // If not provided, full refund
    reason: RefundSchema.shape.reason,
    notes: z.string().max(1000).optional(),
});
// ============================================================================
// Validation Functions
// ============================================================================
/**
 * Validates a payment intent
 */
export function validatePaymentIntent(data) {
    return PaymentIntentSchema.parse(data);
}
/**
 * Safely validates a payment intent
 */
export function safeValidatePaymentIntent(data) {
    const result = PaymentIntentSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
}
/**
 * Validates a refund
 */
export function validateRefund(data) {
    return RefundSchema.parse(data);
}
/**
 * Validates a payment event
 */
export function validatePaymentEvent(data) {
    return PaymentEventSchema.parse(data);
}
/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(from, to) {
    return PAYMENT_STATUS_TRANSITIONS[from].includes(to);
}
// ============================================================================
// Error Codes
// ============================================================================
export const PaymentErrorCode = {
    PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
    INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
    PAYMENT_ALREADY_COMPLETED: 'PAYMENT_ALREADY_COMPLETED',
    REFUND_EXCEEDS_PAYMENT: 'REFUND_EXCEEDS_PAYMENT',
    INVALID_PAYMENT_METHOD: 'INVALID_PAYMENT_METHOD',
    PROCESSOR_ERROR: 'PROCESSOR_ERROR',
};
//# sourceMappingURL=schema.js.map