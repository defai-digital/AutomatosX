/**
 * User Authentication Domain Contracts v1
 *
 * This is an example scaffold demonstrating contract-first design
 * for a user authentication domain.
 *
 * @module @example/contracts/user-auth/v1
 */
import { z } from 'zod';
/**
 * Email value object with validation
 *
 * Invariants:
 * - INV-AUTH-001: Email must be valid format
 * - INV-AUTH-002: Email max length 255 characters
 */
export declare const EmailSchema: any;
export type Email = z.infer<typeof EmailSchema>;
/**
 * Password requirements
 *
 * Invariants:
 * - INV-AUTH-003: Password minimum 8 characters
 * - INV-AUTH-004: Password maximum 128 characters
 * - INV-AUTH-005: Password must contain mixed characters
 */
export declare const PasswordSchema: any;
export type Password = z.infer<typeof PasswordSchema>;
/**
 * Hashed password (for storage)
 */
export declare const HashedPasswordSchema: any;
export type HashedPassword = z.infer<typeof HashedPasswordSchema>;
/**
 * User roles
 */
export declare const UserRoleSchema: any;
export type UserRole = z.infer<typeof UserRoleSchema>;
/**
 * User account status
 *
 * Invariants:
 * - INV-AUTH-101: Status transitions must follow valid state machine
 */
export declare const UserStatusSchema: any;
export type UserStatus = z.infer<typeof UserStatusSchema>;
/**
 * Valid status transitions
 */
export declare const USER_STATUS_TRANSITIONS: Record<UserStatus, UserStatus[]>;
/**
 * Authentication method types
 */
export declare const AuthMethodSchema: any;
export type AuthMethod = z.infer<typeof AuthMethodSchema>;
/**
 * User entity - Aggregate Root
 *
 * Invariants:
 * - INV-AUTH-006: User ID must be valid UUID
 * - INV-AUTH-007: Email must be unique (enforced by database)
 * - INV-AUTH-008: Display name required and max 100 chars
 */
export declare const UserSchema: any;
export type User = z.infer<typeof UserSchema>;
/**
 * User credentials (separate from User for security)
 *
 * Invariants:
 * - INV-AUTH-009: Password hash must never be exposed in API responses
 */
export declare const UserCredentialsSchema: any;
export type UserCredentials = z.infer<typeof UserCredentialsSchema>;
/**
 * Session entity
 *
 * Invariants:
 * - INV-AUTH-010: Session ID must be cryptographically random
 * - INV-AUTH-011: Session must have expiration
 */
export declare const SessionSchema: any;
export type Session = z.infer<typeof SessionSchema>;
/**
 * Refresh token entity
 */
export declare const RefreshTokenSchema: any;
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
/**
 * User authentication domain events
 */
export declare const AuthEventSchema: any;
export type AuthEvent = z.infer<typeof AuthEventSchema>;
/**
 * Register user request
 */
export declare const RegisterRequestSchema: any;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
/**
 * Login request
 */
export declare const LoginRequestSchema: any;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
/**
 * Login response
 */
export declare const LoginResponseSchema: any;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
/**
 * Password reset request
 */
export declare const PasswordResetRequestSchema: any;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
/**
 * Password reset confirmation
 */
export declare const PasswordResetConfirmSchema: any;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export declare function validateUser(data: unknown): User;
export declare function safeValidateUser(data: unknown): {
    success: true;
    data: User;
} | {
    success: false;
    error: z.ZodError;
};
export declare function validateSession(data: unknown): Session;
export declare function validateAuthEvent(data: unknown): AuthEvent;
export declare function isValidStatusTransition(from: UserStatus, to: UserStatus): boolean;
export declare const AuthErrorCode: {
    readonly USER_NOT_FOUND: "USER_NOT_FOUND";
    readonly USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED";
    readonly ACCOUNT_DEACTIVATED: "ACCOUNT_DEACTIVATED";
    readonly EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly SESSION_EXPIRED: "SESSION_EXPIRED";
    readonly SESSION_REVOKED: "SESSION_REVOKED";
    readonly TWO_FACTOR_REQUIRED: "TWO_FACTOR_REQUIRED";
    readonly INVALID_TWO_FACTOR_CODE: "INVALID_TWO_FACTOR_CODE";
    readonly PASSWORD_TOO_WEAK: "PASSWORD_TOO_WEAK";
    readonly RATE_LIMITED: "RATE_LIMITED";
};
export type AuthErrorCode = typeof AuthErrorCode[keyof typeof AuthErrorCode];
//# sourceMappingURL=schema.d.ts.map