/**
 * HealthCheckService.ts
 *
 * System health monitoring and component status tracking
 * Phase 6 Week 2: Advanced Monitoring & Observability
 */
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { HealthCheck, SystemHealth } from '../types/monitoring.types.js';
/**
 * HealthCheckService - System health monitoring
 *
 * Features:
 * - Component-level health checks (database, cache, queue, etc.)
 * - System-level health aggregation
 * - Periodic health check execution
 * - Health status events (healthy → degraded → unhealthy)
 * - Response time tracking
 * - Uptime monitoring
 */
export declare class HealthCheckService extends EventEmitter {
    private db;
    private startTime;
    private checkInterval;
    private lastHealthStatus;
    constructor(db?: Database.Database);
    /**
     * Check database health
     */
    checkDatabase(): Promise<HealthCheck>;
    /**
     * Check cache health (simulated - would connect to actual cache)
     */
    checkCache(): Promise<HealthCheck>;
    /**
     * Check queue health (checks workflow execution queue)
     */
    checkQueue(): Promise<HealthCheck>;
    /**
     * Check worker pool health (simulated)
     */
    checkWorkerPool(): Promise<HealthCheck>;
    /**
     * Check providers health (AI providers connectivity)
     */
    checkProviders(): Promise<HealthCheck>;
    /**
     * Check disk health
     */
    checkDisk(): Promise<HealthCheck>;
    /**
     * Check memory health
     */
    checkMemory(): Promise<HealthCheck>;
    /**
     * Get overall system health
     */
    getSystemHealth(): Promise<SystemHealth>;
    /**
     * Check all components
     */
    private checkAllComponents;
    /**
     * Get component health by name
     */
    getComponentHealth(componentName: string): Promise<HealthCheck | null>;
    /**
     * Start periodic health checks
     */
    startPeriodicChecks(intervalMs?: number): void;
    /**
     * Stop periodic health checks
     */
    stopPeriodicChecks(): void;
    /**
     * Get uptime in milliseconds
     */
    getUptime(): number;
    /**
     * Get uptime formatted as string
     */
    getUptimeFormatted(): string;
}
//# sourceMappingURL=HealthCheckService.d.ts.map