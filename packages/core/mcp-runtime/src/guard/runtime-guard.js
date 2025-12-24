import { validateRequest } from '../validation/request-validator.js';
export const DEFAULT_GUARD_CONFIG = {
    checkMemoryPressure: true,
    checkRequestLimits: true,
    blockOnCriticalPressure: true,
    blockOnValidationFailure: true,
};
// ============================================================================
// Guard Implementation
// ============================================================================
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
export class RuntimeGuard {
    config;
    limits;
    constructor(config = {}) {
        this.config = { ...DEFAULT_GUARD_CONFIG, ...config };
        this.limits = config.requestLimits;
    }
    /**
     * Run all guard checks for a request.
     */
    async check(context) {
        const gates = [];
        let hasFailure = false;
        let hasWarning = false;
        // Memory pressure check
        if (this.config.checkMemoryPressure && context.cacheStats) {
            const pressureResult = this.checkMemoryPressure(context.cacheStats);
            gates.push(pressureResult);
            if (pressureResult.status === 'FAIL') {
                hasFailure = true;
            }
            else if (pressureResult.status === 'WARN') {
                hasWarning = true;
            }
        }
        // Request validation check
        if (this.config.checkRequestLimits) {
            const validationResult = this.checkRequestLimits(context.toolName, context.args);
            gates.push(validationResult);
            if (validationResult.status === 'FAIL') {
                hasFailure = true;
            }
            else if (validationResult.status === 'WARN') {
                hasWarning = true;
            }
        }
        // Determine overall status
        let status = 'PASS';
        if (hasFailure) {
            status = 'FAIL';
        }
        else if (hasWarning) {
            status = 'WARN';
        }
        // Determine if request should proceed
        const allowed = this.shouldAllow(status, gates);
        // Generate summary
        const summary = this.generateSummary(status, gates);
        return {
            status,
            gates,
            summary,
            allowed,
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Check memory pressure.
     * INV-MCP-GUARD-001: Critical pressure blocks operations.
     */
    checkMemoryPressure(stats) {
        const { pressureLevel, currentSizeBytes, maxSizeBytes, hitRate } = stats;
        if (pressureLevel === 'critical') {
            return {
                status: this.config.blockOnCriticalPressure ? 'FAIL' : 'WARN',
                gate: 'memory_pressure',
                message: `Memory pressure is critical (${Math.round((currentSizeBytes / maxSizeBytes) * 100)}% used)`,
                details: {
                    pressureLevel,
                    usagePercent: (currentSizeBytes / maxSizeBytes) * 100,
                    currentSizeBytes,
                    maxSizeBytes,
                    hitRate,
                },
                suggestion: 'Wait for cache eviction or increase maxSizeBytes',
            };
        }
        if (pressureLevel === 'high') {
            return {
                status: 'WARN',
                gate: 'memory_pressure',
                message: `Memory pressure is high (${Math.round((currentSizeBytes / maxSizeBytes) * 100)}% used)`,
                details: {
                    pressureLevel,
                    usagePercent: (currentSizeBytes / maxSizeBytes) * 100,
                    currentSizeBytes,
                    maxSizeBytes,
                    hitRate,
                },
                suggestion: 'Consider reducing cache usage or increasing limits',
            };
        }
        return {
            status: 'PASS',
            gate: 'memory_pressure',
            message: `Memory pressure is ${pressureLevel}`,
            details: {
                pressureLevel,
                usagePercent: (currentSizeBytes / maxSizeBytes) * 100,
            },
        };
    }
    /**
     * Check request limits.
     * INV-MCP-GUARD-002: Invalid requests rejected before processing.
     */
    checkRequestLimits(toolName, args) {
        const result = validateRequest(toolName, args, this.limits);
        if (!result.valid) {
            const errors = result.errors;
            const errorMessages = errors.map((e) => e.message).join('; ');
            return {
                status: this.config.blockOnValidationFailure ? 'FAIL' : 'WARN',
                gate: 'request_limits',
                message: `Request validation failed: ${errorMessages}`,
                details: {
                    errors,
                    toolName,
                },
                suggestion: 'Reduce array sizes or split into multiple requests',
            };
        }
        return {
            status: 'PASS',
            gate: 'request_limits',
            message: 'Request validation passed',
            details: { toolName },
        };
    }
    /**
     * Determine if request should be allowed based on results.
     */
    shouldAllow(status, gates) {
        if (status === 'PASS' || status === 'WARN') {
            return true;
        }
        // Check if any blocking failures exist
        for (const gate of gates) {
            if (gate.status === 'FAIL') {
                // Memory pressure failure
                if (gate.gate === 'memory_pressure' && this.config.blockOnCriticalPressure) {
                    return false;
                }
                // Validation failure
                if (gate.gate === 'request_limits' && this.config.blockOnValidationFailure) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Generate human-readable summary.
     */
    generateSummary(status, gates) {
        const passCount = gates.filter((g) => g.status === 'PASS').length;
        const warnCount = gates.filter((g) => g.status === 'WARN').length;
        const failCount = gates.filter((g) => g.status === 'FAIL').length;
        if (status === 'PASS') {
            return `All ${gates.length} checks passed`;
        }
        if (status === 'WARN') {
            return `${passCount} passed, ${warnCount} warnings`;
        }
        return `${failCount} failed, ${warnCount} warnings, ${passCount} passed`;
    }
}
/**
 * Create a runtime guard instance.
 */
export function createRuntimeGuard(config) {
    return new RuntimeGuard(config);
}
/**
 * Quick check helper for common use case.
 */
export async function quickGuardCheck(toolName, args, cacheStats) {
    const guard = createRuntimeGuard();
    return guard.check({ toolName, args, cacheStats });
}
//# sourceMappingURL=runtime-guard.js.map