/**
 * monitoring.types.ts
 *
 * Type definitions for monitoring, observability, and alerting
 * Phase 6 Week 1: Advanced Monitoring & Observability
 */
// ============================================================================
// Errors
// ============================================================================
export class MonitoringError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MonitoringError';
    }
}
export class AlertRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AlertRuleError';
    }
}
//# sourceMappingURL=monitoring.types.js.map