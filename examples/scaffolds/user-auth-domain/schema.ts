/**
 * User Authentication Domain Contracts v1
 *
 * This is an example scaffold demonstrating contract-first design
 * for a user authentication domain.
 *
 * @module @example/contracts/user-auth/v1
 */

import { z } from 'zod';

// ============================================================================
// Value Objects
// ============================================================================

/**
 * Email value object with validation
 *
 * Invariants:
 * - INV-AUTH-001: Email must be valid format
 * - INV-AUTH-002: Email max length 255 characters
 */
export const EmailSchema = z.string()
  .email('Invalid email format')
  .max(255)
  .toLowerCase()
  .transform((email) => email.trim());

export type Email = z.infer<typeof EmailSchema>;

/**
 * Password requirements
 *
 * Invariants:
 * - INV-AUTH-003: Password minimum 8 characters
 * - INV-AUTH-004: Password maximum 128 characters
 * - INV-AUTH-005: Password must contain mixed characters
 */
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain uppercase, lowercase, and number'
  );

export type Password = z.infer<typeof PasswordSchema>;

/**
 * Hashed password (for storage)
 */
export const HashedPasswordSchema = z.string()
  .min(60)
  .max(128);

export type HashedPassword = z.infer<typeof HashedPasswordSchema>;

// ============================================================================
// Enums
// ============================================================================

/**
 * User roles
 */
export const UserRoleSchema = z.enum([
  'admin',
  'user',
  'guest',
  'service_account',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * User account status
 *
 * Invariants:
 * - INV-AUTH-101: Status transitions must follow valid state machine
 */
export const UserStatusSchema = z.enum([
  'pending_verification',
  'active',
  'suspended',
  'deactivated',
]);

export type UserStatus = z.infer<typeof UserStatusSchema>;

/**
 * Valid status transitions
 */
export const USER_STATUS_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  pending_verification: ['active', 'deactivated'],
  active: ['suspended', 'deactivated'],
  suspended: ['active', 'deactivated'],
  deactivated: [], // Terminal state
};

/**
 * Authentication method types
 */
export const AuthMethodSchema = z.enum([
  'password',
  'oauth_google',
  'oauth_github',
  'oauth_microsoft',
  'magic_link',
  'passkey',
]);

export type AuthMethod = z.infer<typeof AuthMethodSchema>;

// ============================================================================
// Entities
// ============================================================================

/**
 * User entity - Aggregate Root
 *
 * Invariants:
 * - INV-AUTH-006: User ID must be valid UUID
 * - INV-AUTH-007: Email must be unique (enforced by database)
 * - INV-AUTH-008: Display name required and max 100 chars
 */
export const UserSchema = z.object({
  /** Unique identifier */
  id: z.string().uuid(),

  /** User email (unique) */
  email: EmailSchema,

  /** Display name */
  displayName: z.string().min(1).max(100),

  /** User role */
  role: UserRoleSchema.default('user'),

  /** Account status */
  status: UserStatusSchema.default('pending_verification'),

  /** Profile image URL */
  avatarUrl: z.string().url().optional(),

  /** Email verification status */
  emailVerified: z.boolean().default(false),

  /** Two-factor authentication enabled */
  twoFactorEnabled: z.boolean().default(false),

  /** Last login timestamp */
  lastLoginAt: z.string().datetime().optional(),

  /** Timestamps */
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * User credentials (separate from User for security)
 *
 * Invariants:
 * - INV-AUTH-009: Password hash must never be exposed in API responses
 */
export const UserCredentialsSchema = z.object({
  userId: z.string().uuid(),
  passwordHash: HashedPasswordSchema.optional(),
  authMethods: z.array(AuthMethodSchema),
  twoFactorSecret: z.string().optional(),
  recoveryCodesHash: z.array(z.string()).optional(),
  updatedAt: z.string().datetime(),
});

export type UserCredentials = z.infer<typeof UserCredentialsSchema>;

/**
 * Session entity
 *
 * Invariants:
 * - INV-AUTH-010: Session ID must be cryptographically random
 * - INV-AUTH-011: Session must have expiration
 */
export const SessionSchema = z.object({
  /** Session ID (cryptographically random) */
  id: z.string().min(32).max(128),

  /** User who owns this session */
  userId: z.string().uuid(),

  /** Session expiration */
  expiresAt: z.string().datetime(),

  /** IP address of session creation */
  ipAddress: z.string().ip().optional(),

  /** User agent string */
  userAgent: z.string().max(500).optional(),

  /** Device fingerprint */
  deviceId: z.string().max(100).optional(),

  /** Whether session is revoked */
  revoked: z.boolean().default(false),

  /** Timestamps */
  createdAt: z.string().datetime(),
  lastActiveAt: z.string().datetime(),
});

export type Session = z.infer<typeof SessionSchema>;

/**
 * Refresh token entity
 */
export const RefreshTokenSchema = z.object({
  /** Token ID */
  id: z.string().uuid(),

  /** Associated session */
  sessionId: z.string(),

  /** Token hash (never store plain token) */
  tokenHash: z.string().min(64),

  /** Expiration */
  expiresAt: z.string().datetime(),

  /** Whether token is revoked */
  revoked: z.boolean().default(false),

  /** Timestamps */
  createdAt: z.string().datetime(),
});

export type RefreshToken = z.infer<typeof RefreshTokenSchema>;

// ============================================================================
// Domain Events
// ============================================================================

/**
 * User authentication domain events
 */
export const AuthEventSchema = z.discriminatedUnion('type', [
  // User lifecycle
  z.object({
    type: z.literal('user.registered'),
    userId: z.string().uuid(),
    email: EmailSchema,
    authMethod: AuthMethodSchema,
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('user.email_verified'),
    userId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('user.activated'),
    userId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('user.suspended'),
    userId: z.string().uuid(),
    reason: z.string(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('user.deactivated'),
    userId: z.string().uuid(),
    reason: z.string().optional(),
    occurredAt: z.string().datetime(),
  }),

  // Authentication events
  z.object({
    type: z.literal('auth.login_succeeded'),
    userId: z.string().uuid(),
    sessionId: z.string(),
    authMethod: AuthMethodSchema,
    ipAddress: z.string().ip().optional(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('auth.login_failed'),
    email: EmailSchema,
    reason: z.enum(['invalid_credentials', 'account_locked', 'account_suspended']),
    ipAddress: z.string().ip().optional(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('auth.logout'),
    userId: z.string().uuid(),
    sessionId: z.string(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('auth.password_changed'),
    userId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('auth.password_reset_requested'),
    userId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),

  // 2FA events
  z.object({
    type: z.literal('auth.2fa_enabled'),
    userId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('auth.2fa_disabled'),
    userId: z.string().uuid(),
    occurredAt: z.string().datetime(),
  }),

  // Session events
  z.object({
    type: z.literal('session.created'),
    sessionId: z.string(),
    userId: z.string().uuid(),
    expiresAt: z.string().datetime(),
    occurredAt: z.string().datetime(),
  }),
  z.object({
    type: z.literal('session.revoked'),
    sessionId: z.string(),
    userId: z.string().uuid(),
    reason: z.enum(['logout', 'password_change', 'admin_action', 'expired']),
    occurredAt: z.string().datetime(),
  }),
]);

export type AuthEvent = z.infer<typeof AuthEventSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Register user request
 */
export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().min(1).max(100),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/**
 * Login request
 */
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
  twoFactorCode: z.string().length(6).optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Login response
 */
export const LoginResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  requiresTwoFactor: z.boolean().optional(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/**
 * Password reset request
 */
export const PasswordResetRequestSchema = z.object({
  email: EmailSchema,
});

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

/**
 * Password reset confirmation
 */
export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(32),
  newPassword: PasswordSchema,
});

export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}

export function safeValidateUser(
  data: unknown
): { success: true; data: User } | { success: false; error: z.ZodError } {
  const result = UserSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function validateSession(data: unknown): Session {
  return SessionSchema.parse(data);
}

export function validateAuthEvent(data: unknown): AuthEvent {
  return AuthEventSchema.parse(data);
}

export function isValidStatusTransition(
  from: UserStatus,
  to: UserStatus
): boolean {
  return USER_STATUS_TRANSITIONS[from].includes(to);
}

// ============================================================================
// Error Codes
// ============================================================================

export const AuthErrorCode = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  INVALID_TWO_FACTOR_CODE: 'INVALID_TWO_FACTOR_CODE',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type AuthErrorCode = typeof AuthErrorCode[keyof typeof AuthErrorCode];
