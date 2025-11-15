/**
 * security.types.ts
 *
 * Type definitions for security, RBAC, multi-tenancy, and audit logging
 * Phase 5 Week 3-4: Production Readiness
 */
// ============================================================================
// Errors
// ============================================================================
export class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}
export class ForbiddenError extends Error {
    constructor(permission) {
        super(`Permission denied: ${permission}`);
        this.name = 'ForbiddenError';
    }
}
export class QuotaExceededError extends Error {
    constructor(tenantId, quotaType) {
        super(`Quota exceeded for tenant ${tenantId}: ${quotaType}`);
        this.name = 'QuotaExceededError';
    }
}
export class RateLimitExceededError extends Error {
    constructor(retryAfter) {
        super(`Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}ms` : ''}`);
        this.name = 'RateLimitExceededError';
    }
}
export class TenantSuspendedError extends Error {
    constructor(tenantId, reason) {
        super(`Tenant ${tenantId} is suspended${reason ? `: ${reason}` : ''}`);
        this.name = 'TenantSuspendedError';
    }
}
//# sourceMappingURL=security.types.js.map