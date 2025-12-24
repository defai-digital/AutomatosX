# User Authentication Domain Invariants

## Overview

The User Authentication domain handles user registration, authentication,
session management, and access control.

## Schema Invariants

### INV-AUTH-001: Valid Email Format
Email MUST conform to RFC 5322 email format.
- **Enforcement**: schema
- **Test**: `z.string().email()` rejects invalid formats
- **Rationale**: Ensures deliverability and uniqueness

### INV-AUTH-002: Email Max Length
Email MUST NOT exceed 255 characters.
- **Enforcement**: schema
- **Test**: `z.string().max(255)` rejects longer emails
- **Rationale**: Database column limit and RFC compliance

### INV-AUTH-003: Password Minimum Length
Password MUST be at least 8 characters.
- **Enforcement**: schema
- **Test**: `z.string().min(8)` rejects shorter passwords
- **Rationale**: NIST SP 800-63B recommendation

### INV-AUTH-004: Password Maximum Length
Password MUST NOT exceed 128 characters.
- **Enforcement**: schema
- **Test**: `z.string().max(128)` rejects longer passwords
- **Rationale**: Prevent DoS via bcrypt processing time

### INV-AUTH-005: Password Complexity
Password MUST contain at least one uppercase, one lowercase, and one digit.
- **Enforcement**: schema
- **Test**: Regex validation in PasswordSchema
- **Rationale**: Basic complexity requirement

### INV-AUTH-006: User ID Format
User ID MUST be a valid UUID v4.
- **Enforcement**: schema
- **Test**: `z.string().uuid()` rejects invalid UUIDs

### INV-AUTH-007: Unique Email
Email MUST be unique across all users.
- **Enforcement**: database (unique constraint)
- **Test**: Duplicate email registration → error
- **Rationale**: Email is the primary identifier

### INV-AUTH-008: Display Name Requirements
Display name MUST be 1-100 characters.
- **Enforcement**: schema
- **Test**: Empty or too-long names rejected

## Runtime Invariants

### INV-AUTH-101: Valid Status Transitions
User status transitions MUST follow the defined state machine.
- **Enforcement**: runtime
- **Test**: Invalid transitions throw error
- **Valid Transitions**:
  ```
  pending_verification → active, deactivated
  active               → suspended, deactivated
  suspended            → active, deactivated
  deactivated          → (terminal state)
  ```

### INV-AUTH-102: Password Never in Response
Password hash MUST NEVER be included in API responses.
- **Enforcement**: runtime (DTO transformation)
- **Test**: API response serialization excludes password
- **Rationale**: Security best practice

### INV-AUTH-103: Session Expiration
Sessions MUST have an expiration timestamp in the future.
- **Enforcement**: runtime
- **Test**: Session creation with past expiration → error

### INV-AUTH-104: Cryptographic Session ID
Session ID MUST be cryptographically random (min 32 bytes).
- **Enforcement**: runtime (generation function)
- **Test**: Session ID entropy verification

### INV-AUTH-105: Hashed Token Storage
Refresh tokens MUST be stored as hashes, never plaintext.
- **Enforcement**: runtime
- **Test**: Database inspection shows only hashes

### INV-AUTH-106: Email Verification Before Activation
User MUST verify email before status can transition to 'active'.
- **Enforcement**: runtime
- **Test**: Activation without verification → error

## Business Invariants

### INV-AUTH-201: Rate Limiting
Login attempts MUST be rate-limited to 5 attempts per 15 minutes per IP.
- **Enforcement**: test (middleware)
- **Test**: 6th attempt within window → rate limit error
- **Owner**: Security Team

### INV-AUTH-202: Session Limit
User MUST NOT have more than 10 active sessions.
- **Enforcement**: test
- **Test**: 11th session creation revokes oldest
- **Owner**: Security Team

### INV-AUTH-203: Password History
New password MUST NOT match any of the last 5 passwords.
- **Enforcement**: test
- **Test**: Reusing recent password → rejection
- **Owner**: Security Team

### INV-AUTH-204: Verification Token Expiry
Email verification tokens MUST expire after 24 hours.
- **Enforcement**: test
- **Test**: Token used after 24h → invalid
- **Owner**: Product Team

### INV-AUTH-205: Password Reset Token Expiry
Password reset tokens MUST expire after 1 hour.
- **Enforcement**: test
- **Test**: Token used after 1h → invalid
- **Owner**: Security Team

### INV-AUTH-206: Admin Role Assignment
Admin role MUST only be assigned by existing admins.
- **Enforcement**: test
- **Test**: Non-admin role escalation → forbidden
- **Owner**: Security Team

## Security Invariants

### INV-AUTH-301: Password Hashing Algorithm
Passwords MUST be hashed using bcrypt with cost factor >= 12.
- **Enforcement**: runtime (hash function)
- **Test**: Hash format verification
- **Rationale**: Industry standard secure hashing

### INV-AUTH-302: Constant-Time Comparison
Password verification MUST use constant-time comparison.
- **Enforcement**: runtime
- **Test**: Timing attack resistance verification

### INV-AUTH-303: Secure Session Cookie
Session cookies MUST have Secure, HttpOnly, SameSite=Strict flags.
- **Enforcement**: runtime (cookie configuration)
- **Test**: Cookie attribute verification

### INV-AUTH-304: Token Rotation
Refresh tokens MUST be rotated on each use.
- **Enforcement**: runtime
- **Test**: Using refresh token returns new token

### INV-AUTH-305: Revocation Cascade
When password is changed, ALL existing sessions MUST be revoked.
- **Enforcement**: runtime
- **Test**: Password change → all sessions invalid

## Cross-Aggregate Invariants

### INV-AUTH-401: Audit Logging
All authentication events MUST be logged for audit.
- **Enforcement**: event handler
- **Aggregates**: User, AuditLog
- **Events**: All auth.* events → audit log

### INV-AUTH-402: Notification on Security Events
User MUST be notified of security-sensitive events.
- **Enforcement**: event handler
- **Aggregates**: User, Notification
- **Events**: login from new device, password change, 2FA change

### INV-AUTH-403: Suspicious Activity Detection
Multiple failed login attempts MUST trigger security alert.
- **Enforcement**: event handler
- **Aggregates**: User, SecurityMonitor
- **Threshold**: 10 failed attempts in 1 hour
