import type { MCPCacheStats, MCPRequestLimits } from '@automatosx/contracts';
export type GuardStatus = 'PASS' | 'WARN' | 'FAIL';
export interface GuardCheckResult {
    status: GuardStatus;
    gate: string;
    message: string;
    details?: Record<string, unknown>;
    /** Suggested action when check fails */
    suggestion?: string;
    /** Audit data for logging */
    audit?: Record<string, unknown>;
}
export interface RuntimeGuardResult {
    /** Overall status (FAIL if any gate fails) */
    status: GuardStatus;
    /** Individual gate results */
    gates: GuardCheckResult[];
    /** Human-readable summary */
    summary: string;
    /** Whether the request should proceed */
    allowed: boolean;
    /** Timestamp of check */
    timestamp: string;
}
export interface RuntimeGuardConfig {
    /** Enable memory pressure checks */
    checkMemoryPressure: boolean;
    /** Enable request validation */
    checkRequestLimits: boolean;
    /** Block on critical memory pressure */
    blockOnCriticalPressure: boolean;
    /** Block on validation failures */
    blockOnValidationFailure: boolean;
    /** Custom request limits */
    requestLimits?: MCPRequestLimits;
}
export declare const DEFAULT_GUARD_CONFIG: RuntimeGuardConfig;
export interface RuntimeGuardContext {
    /** Tool being called */
    toolName: string;
    /** Tool arguments */
    args: unknown;
    /** Current cache stats (optional) */
    cacheStats?: MCPCacheStats | undefined;
    /** Request size in bytes (optional) */
    requestSizeBytes?: number | undefined;
    /** Request ID for tracing */
    requestId?: string | undefined;
}
/**
 * Runtime guard for MCP operations.
 *
 * Enforces runtime governance policies:
 * - Memory pressure checks
 * - Request size and array limits
 * - Timeout tracking (via audit)
 *
 * Invariants:
 * - INV-MCP-GUARD-001: Critical pressure blocks operations
 * - INV-MCP-GUARD-002: Invalid requests rejected before processing
 * - INV-MCP-GUARD-003: All checks logged for audit
 */
export declare class RuntimeGuard {
    private readonly config;
    private readonly limits;
    constructor(config?: Partial<RuntimeGuardConfig>);
    /**
     * Run all guard checks for a request.
     */
    check(context: RuntimeGuardContext): Promise<RuntimeGuardResult>;
    /**
     * Check memory pressure.
     * INV-MCP-GUARD-001: Critical pressure blocks operations.
     */
    private checkMemoryPressure;
    /**
     * Check request limits.
     * INV-MCP-GUARD-002: Invalid requests rejected before processing.
     */
    private checkRequestLimits;
    /**
     * Determine if request should be allowed based on results.
     */
    private shouldAllow;
    /**
     * Generate human-readable summary.
     */
    private generateSummary;
}
/**
 * Create a runtime guard instance.
 */
export declare function createRuntimeGuard(config?: Partial<RuntimeGuardConfig>): RuntimeGuard;
/**
 * Quick check helper for common use case.
 */
export declare function quickGuardCheck(toolName: string, args: unknown, cacheStats?: MCPCacheStats): Promise<RuntimeGuardResult>;
//# sourceMappingURL=runtime-guard.d.ts.map